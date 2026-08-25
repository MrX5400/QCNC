import { Path2DPoint } from './dragKnifeCorrection';
import { VectorPolyline } from './vectorRasterGenerator';
import { RasterSettings } from '../types/cnc';

/**
 * Calculates optimal B&W threshold value (0..255) using Otsu's method
 */
export function calculateOtsuThreshold(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  brightness: number = 0,
  contrast: number = 0,
  gamma: number = 1.0
): number {
  const histogram = new Int32Array(256);
  const totalPixels = width * height;
  if (totalPixels === 0) return 128;

  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] + brightness * 2.55;
    let g = data[i + 1] + brightness * 2.55;
    let b = data[i + 2] + brightness * 2.55;

    r = factor * (r - 128) + 128;
    g = factor * (g - 128) + 128;
    b = factor * (b - 128) + 128;

    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));

    let lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (gamma && gamma !== 1.0 && gamma > 0.1) {
      lum = Math.pow(lum, 1 / gamma);
    }
    const val = Math.max(0, Math.min(255, Math.round(lum * 255)));
    histogram[val]++;
  }

  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }

  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let maxVariance = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    wF = totalPixels - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;

    const varianceBetween = wB * wF * (mB - mF) * (mB - mF);
    if (varianceBetween > maxVariance) {
      maxVariance = varianceBetween;
      threshold = t;
    }
  }

  return threshold;
}

/**
 * Douglas-Peucker Polyline Simplification Algorithm in Millimeters with Collinear Point Pruning
 */
export function simplifyPolylineDP(points: Path2DPoint[], tolerance: number): Path2DPoint[] {
  if (points.length <= 2) return points;

  const sqTolerance = Math.max(1e-6, tolerance * tolerance);

  function getSqSegDist(p: Path2DPoint, p1: Path2DPoint, p2: Path2DPoint): number {
    let x = p1.x, y = p1.y, dx = p2.x - x, dy = p2.y - y;
    if (dx !== 0 || dy !== 0) {
      const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) {
        x = p2.x;
        y = p2.y;
      } else if (t > 0) {
        x += dx * t;
        y += dy * t;
      }
    }
    dx = p.x - x;
    dy = p.y - y;
    return dx * dx + dy * dy;
  }

  function simplifyDPStep(pts: Path2DPoint[], first: number, last: number, sqTol: number, simplified: Path2DPoint[]) {
    let maxSqDist = sqTol;
    let index = 0;

    for (let i = first + 1; i < last; i++) {
      const sqDist = getSqSegDist(pts[i], pts[first], pts[last]);
      if (sqDist > maxSqDist) {
        index = i;
        maxSqDist = sqDist;
      }
    }

    if (maxSqDist > sqTol) {
      if (index - first > 1) simplifyDPStep(pts, first, index, sqTol, simplified);
      simplified.push(pts[index]);
      if (last - index > 1) simplifyDPStep(pts, index, last, sqTol, simplified);
    }
  }

  const simplified: Path2DPoint[] = [points[0]];
  simplifyDPStep(points, 0, points.length - 1, sqTolerance, simplified);
  simplified.push(points[points.length - 1]);

  // Collinear point reduction for straight CNC cuts / plotting strokes
  return pruneCollinearPoints(simplified, 2.0);
}

/**
 * Chaikin's corner rounding algorithm to turn jagged polygon steps into flowing, smooth CNC toolpaths (LaserGRBL style)
 */
export function smoothPolylineChaikin(
  points: Path2DPoint[],
  iterations: number = 1,
  isClosed: boolean = false
): Path2DPoint[] {
  if (points.length < 3) return points;

  let current = [...points];

  for (let it = 0; it < iterations; it++) {
    if (current.length < 3) break;
    const next: Path2DPoint[] = [];

    if (!isClosed) {
      next.push(current[0]);
    }

    const count = isClosed ? current.length : current.length - 1;
    for (let i = 0; i < count; i++) {
      const p0 = current[i];
      const p1 = current[(i + 1) % current.length];

      // Q = 0.75 * p0 + 0.25 * p1
      const q: Path2DPoint = {
        x: Number((0.75 * p0.x + 0.25 * p1.x).toFixed(3)),
        y: Number((0.75 * p0.y + 0.25 * p1.y).toFixed(3)),
      };

      // R = 0.25 * p0 + 0.75 * p1
      const r: Path2DPoint = {
        x: Number((0.25 * p0.x + 0.75 * p1.x).toFixed(3)),
        y: Number((0.25 * p0.y + 0.75 * p1.y).toFixed(3)),
      };

      next.push(q, r);
    }

    if (!isClosed) {
      next.push(current[current.length - 1]);
    }

    current = next;
  }

  return current;
}

/**
 * Removes redundant collinear points from a polyline within angle tolerance
 */
export function pruneCollinearPoints(points: Path2DPoint[], angleToleranceDeg: number = 2.0): Path2DPoint[] {
  if (points.length <= 2) return points;
  const result: Path2DPoint[] = [points[0]];
  const cosTol = Math.cos((angleToleranceDeg * Math.PI) / 180);

  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    const next = points[i + 1];

    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;

    const len1 = Math.hypot(dx1, dy1);
    const len2 = Math.hypot(dx2, dy2);

    if (len1 < 1e-4 || len2 < 1e-4) continue;

    const dot = (dx1 * dx2 + dy1 * dy2) / (len1 * len2);
    if (dot >= cosTol) {
      continue; // Skip redundant straight line vertex
    }
    result.push(curr);
  }
  result.push(points[points.length - 1]);
  return result;
}

/**
 * Computes the total Euclidean length of a polyline in mm
 */
export function computePolylineLength(points: Path2DPoint[]): number {
  if (points.length < 2) return 0;
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

/**
 * Fast separable Gaussian/Box Blur filter on a Float32 luminance buffer to remove staircases/dithering
 */
function applyBoxBlur(buffer: Float32Array, width: number, height: number, radius: number): Float32Array {
  if (radius <= 0) return buffer;
  const rad = Math.min(10, Math.max(1, Math.round(radius)));
  const temp = new Float32Array(width * height);
  const result = new Float32Array(width * height);

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let k = -rad; k <= rad; k++) {
        const nx = x + k;
        if (nx >= 0 && nx < width) {
          sum += buffer[rowOffset + nx];
          count++;
        }
      }
      temp[rowOffset + x] = count > 0 ? sum / count : buffer[rowOffset + x];
    }
  }

  // Vertical pass
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let sum = 0;
      let count = 0;
      for (let k = -rad; k <= rad; k++) {
        const ny = y + k;
        if (ny >= 0 && ny < height) {
          sum += temp[ny * width + x];
          count++;
        }
      }
      result[y * width + x] = count > 0 ? sum / count : temp[y * width + x];
    }
  }

  return result;
}

/**
 * High-Pass Unsharp Mask for Boosting Small Details & Fine Lettering
 */
export function applyLocalContrastDetailBoost(
  lum: Float32Array,
  w: number,
  h: number,
  radius: number = 8,
  boostFactor: number = 0.65
): Float32Array {
  const blurred = applyBoxBlur(lum, w, h, radius);
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) {
    const diff = lum[i] - blurred[i];
    const boosted = lum[i] + diff * boostFactor;
    out[i] = Math.max(0, Math.min(1, boosted));
  }
  return out;
}

/**
 * Extracts a filtered binary grid (1 = foreground / dark, 0 = background / light)
 */
export function extractBinaryGrid(
  canvas: HTMLCanvasElement,
  settings: RasterSettings,
  maxDimension: number = 600
): {
  binaryGrid: Uint8Array;
  gridW: number;
  gridH: number;
  scaleX: number;
  scaleY: number;
  targetWidth: number;
  targetHeight: number;
} {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      binaryGrid: new Uint8Array(0),
      gridW: 0,
      gridH: 0,
      scaleX: 1,
      scaleY: 1,
      targetWidth: settings.targetWidth,
      targetHeight: settings.targetHeight,
    };
  }

  const { width: imgW, height: imgH } = canvas;
  
  // Calculate dynamic grid resolution from detailSensitivity (1 = 400px, 5 = 900px, 10 = 2200px)
  const detailSens = settings.detailSensitivity ?? 5;
  const sensDimension = Math.round(350 + detailSens * 185); // 535px @1 to 2200px @10
  const effectiveMaxDim = Math.max(maxDimension, sensDimension);
  
  const sampleStep = Math.max(1, Math.floor(Math.max(imgW, imgH) / effectiveMaxDim));
  const gridW = Math.max(1, Math.floor(imgW / sampleStep));
  const gridH = Math.max(1, Math.floor(imgH / sampleStep));

  const imgData = ctx.getImageData(0, 0, imgW, imgH);
  const data = imgData.data;

  const {
    brightness = 0,
    contrast = 0,
    threshold = 128,
    blackLevel = 0,
    whiteLevel = 255,
    gamma = 1.0,
    mirrorX = false,
    mirrorY = false,
    invert = false,
    blurRadius = 0,
    enhanceSmallText = false,
    targetWidth,
    targetHeight,
  } = settings;

  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const minL = Math.min(blackLevel, whiteLevel - 1);
  const maxL = Math.max(whiteLevel, minL + 1);

  // 1. Extract downsampled luminance buffer
  let lumBuffer = new Float32Array(gridW * gridH);

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const srcPx = gx * sampleStep;
      const srcPy = gy * sampleStep;

      const sampleX = mirrorX ? (imgW - 1 - srcPx) : srcPx;
      const sampleY = mirrorY ? (imgH - 1 - srcPy) : srcPy;

      const idx = (Math.min(imgH - 1, Math.max(0, sampleY)) * imgW + Math.min(imgW - 1, Math.max(0, sampleX))) * 4;
      let r = data[idx] + brightness * 2.55;
      let g = data[idx + 1] + brightness * 2.55;
      let b = data[idx + 2] + brightness * 2.55;

      r = factor * (r - 128) + 128;
      g = factor * (g - 128) + 128;
      b = factor * (b - 128) + 128;

      r = Math.max(0, Math.min(255, r));
      g = Math.max(0, Math.min(255, g));
      b = Math.max(0, Math.min(255, b));

      const rawLum = (0.299 * r + 0.587 * g + 0.114 * b);
      let scaledLum = (rawLum - minL) / (maxL - minL);
      scaledLum = Math.max(0, Math.min(1, scaledLum));

      if (gamma && gamma !== 1.0 && gamma > 0.1) {
        scaledLum = Math.pow(scaledLum, 1 / gamma);
      }

      lumBuffer[gy * gridW + gx] = scaledLum;
    }
  }

  // 2. High-pass detail booster for small typography & airplane markings if detail sensitivity >= 6 or requested
  if (enhanceSmallText || detailSens >= 6) {
    const boost = Math.min(1.2, (detailSens - 4) * 0.2);
    lumBuffer = applyLocalContrastDetailBoost(lumBuffer, gridW, gridH, Math.max(4, Math.round(gridW / 60)), boost);
  }

  // 3. Apply optional Blur
  const blurredBuffer = blurRadius > 0 ? applyBoxBlur(lumBuffer, gridW, gridH, blurRadius) : lumBuffer;

  // 4. Threshold to binary (1 = dark/foreground, 0 = light/background)
  const binaryGrid = new Uint8Array(gridW * gridH);
  const normThreshold = threshold / 255;

  for (let i = 0; i < binaryGrid.length; i++) {
    const lum = blurredBuffer[i];
    const isDark = lum < normThreshold;
    binaryGrid[i] = (invert ? !isDark : isDark) ? 1 : 0;
  }

  // Clear image border pixels if ignoreBorder is requested
  if (settings.ignoreBorder) {
    const borderThickness = Math.max(1, Math.round(Math.min(gridW, gridH) * 0.005));
    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        if (x < borderThickness || x >= gridW - borderThickness || y < borderThickness || y >= gridH - borderThickness) {
          binaryGrid[y * gridW + x] = 0;
        }
      }
    }
  }

  return {
    binaryGrid,
    gridW,
    gridH,
    scaleX: targetWidth / gridW,
    scaleY: targetHeight / gridH,
    targetWidth,
    targetHeight,
  };
}

/**
 * Mode A: Traces external and internal contours of binary image using Marching Squares
 */
export function traceOutlineContours(
  binaryGrid: Uint8Array,
  gridW: number,
  gridH: number,
  scaleX: number,
  scaleY: number,
  targetHeight: number,
  simplificationTolerance: number = 0.25,
  minPathLength: number = 1.0
): VectorPolyline[] {
  type Segment = { p1: Path2DPoint; p2: Path2DPoint };
  const segments: Segment[] = [];

  const getPixel = (x: number, y: number): boolean => {
    if (x < 0 || x >= gridW || y < 0 || y >= gridH) return false;
    return binaryGrid[y * gridW + x] === 1;
  };

  // Marching Squares cell evaluation
  for (let y = 0; y < gridH - 1; y++) {
    for (let x = 0; x < gridW - 1; x++) {
      const tl = getPixel(x, y);
      const tr = getPixel(x + 1, y);
      const br = getPixel(x + 1, y + 1);
      const bl = getPixel(x, y + 1);

      const caseId = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
      if (caseId === 0 || caseId === 15) continue;

      const top: Path2DPoint = { x: x + 0.5, y };
      const right: Path2DPoint = { x: x + 1, y: y + 0.5 };
      const bottom: Path2DPoint = { x: x + 0.5, y: y + 1 };
      const left: Path2DPoint = { x, y: y + 0.5 };

      switch (caseId) {
        case 1:
        case 14:
          segments.push({ p1: left, p2: bottom });
          break;
        case 2:
        case 13:
          segments.push({ p1: bottom, p2: right });
          break;
        case 3:
        case 12:
          segments.push({ p1: left, p2: right });
          break;
        case 4:
        case 11:
          segments.push({ p1: top, p2: right });
          break;
        case 5:
          segments.push({ p1: left, p2: top });
          segments.push({ p1: bottom, p2: right });
          break;
        case 6:
        case 9:
          segments.push({ p1: top, p2: bottom });
          break;
        case 7:
        case 8:
          segments.push({ p1: left, p2: top });
          break;
        case 10:
          segments.push({ p1: top, p2: right });
          segments.push({ p1: left, p2: bottom });
          break;
      }
    }
  }

  if (segments.length === 0) return [];

  // Support up to 120,000 segments for ultra-high-resolution detail tracing & fine typography
  const maxSegCount = Math.min(segments.length, 120000);
  const activeSegments = segments.length > maxSegCount ? segments.slice(0, maxSegCount) : segments;

  // Build O(N) adjacency graph by quantizing coordinates
  const pointKey = (p: Path2DPoint) => `${Math.round(p.x * 2)}_${Math.round(p.y * 2)}`;
  const adjMap = new Map<string, { segIdx: number; isStart: boolean; otherPt: Path2DPoint }[]>();

  for (let i = 0; i < activeSegments.length; i++) {
    const { p1, p2 } = activeSegments[i];
    const k1 = pointKey(p1);
    const k2 = pointKey(p2);

    let list1 = adjMap.get(k1);
    if (!list1) {
      list1 = [];
      adjMap.set(k1, list1);
    }
    list1.push({ segIdx: i, isStart: true, otherPt: p2 });

    let list2 = adjMap.get(k2);
    if (!list2) {
      list2 = [];
      adjMap.set(k2, list2);
    }
    list2.push({ segIdx: i, isStart: false, otherPt: p1 });
  }

  // Link segments into continuous polylines
  const polylines: VectorPolyline[] = [];
  const usedSegs = new Uint8Array(activeSegments.length);
  const ptDistSq = (a: Path2DPoint, b: Path2DPoint) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);

  for (let i = 0; i < activeSegments.length; i++) {
    if (usedSegs[i]) continue;
    usedSegs[i] = 1;

    const currentLine: Path2DPoint[] = [activeSegments[i].p1, activeSegments[i].p2];
    let currentTail = activeSegments[i].p2;

    let steps = 0;
    while (steps++ < 20000) {
      const kTail = pointKey(currentTail);
      const neighbors = adjMap.get(kTail);
      if (!neighbors) break;

      let foundNext = false;
      for (let n = 0; n < neighbors.length; n++) {
        const edge = neighbors[n];
        if (!usedSegs[edge.segIdx]) {
          usedSegs[edge.segIdx] = 1;
          currentLine.push(edge.otherPt);
          currentTail = edge.otherPt;
          foundNext = true;
          break;
        }
      }
      if (!foundNext) break;
    }

    const isClosed = ptDistSq(currentLine[0], currentLine[currentLine.length - 1]) < 0.05;

    // Convert to millimeter coordinates (CNC Cartesian, Y flipped)
    const mmPoints = currentLine.map((pt) => ({
      x: Number((pt.x * scaleX).toFixed(3)),
      y: Number((targetHeight - (pt.y * scaleY)).toFixed(3)),
    }));

    if (mmPoints.length >= 2) {
      const rawLen = computePolylineLength(mmPoints);
      // Adaptive tolerance: tiny letters/details (e.g. <3mm) are preserved crisply without distortion
      const localTolerance = Math.min(simplificationTolerance, Math.max(0.01, rawLen * 0.08));
      let simplified = simplifyPolylineDP(mmPoints, Math.max(0.008, localTolerance));
      
      // LaserGRBL style smooth contour rounding for larger shapes
      if (simplificationTolerance >= 0.12 && rawLen >= 3.0 && simplified.length >= 3) {
        const passes = simplificationTolerance > 1.0 ? 2 : 1;
        simplified = smoothPolylineChaikin(simplified, passes, isClosed);
        simplified = simplifyPolylineDP(simplified, simplificationTolerance * 0.4);
      }

      const pathLength = computePolylineLength(simplified);

      // Filter out tiny speckles/dust islands
      if (simplified.length >= 2 && pathLength >= minPathLength) {
        polylines.push({ points: simplified, closed: isClosed });
      }
    }
  }

  return polylines;
}

/**
 * Mode B: Zhang-Suen Morphological Skeletonization / Thinning Algorithm
 * Transforms solid filled shapes / thick brush strokes into 1-pixel wide centerlines.
 * Optimized with direct typed-array offset indexing.
 */
export function zhangSuenThinning(grid: Uint8Array, width: number, height: number): Uint8Array {
  const binary = new Uint8Array(grid);
  let hasChanged = true;
  let iterations = 0;
  const maxIterations = 80;

  const toDelete: number[] = [];

  while (hasChanged && iterations++ < maxIterations) {
    hasChanged = false;

    // --- Sub-iteration 1 ---
    toDelete.length = 0;
    for (let y = 1; y < height - 1; y++) {
      const up = (y - 1) * width;
      const mid = y * width;
      const down = (y + 1) * width;

      for (let x = 1; x < width - 1; x++) {
        const p1 = binary[mid + x];
        if (p1 === 0) continue;

        // 8 Neighbors (P2..P9):
        // P9 P2 P3
        // P8 P1 P4
        // P7 P6 P5
        const p2 = binary[up + x];
        const p3 = binary[up + x + 1];
        const p4 = binary[mid + x + 1];
        const p5 = binary[down + x + 1];
        const p6 = binary[down + x];
        const p7 = binary[down + x - 1];
        const p8 = binary[mid + x - 1];
        const p9 = binary[up + x - 1];

        const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (b < 2 || b > 6) continue;

        // Count 0 -> 1 transitions in sequence P2..P9, P2
        let a = 0;
        if (p2 === 0 && p3 === 1) a++;
        if (p3 === 0 && p4 === 1) a++;
        if (p4 === 0 && p5 === 1) a++;
        if (p5 === 0 && p6 === 1) a++;
        if (p6 === 0 && p7 === 1) a++;
        if (p7 === 0 && p8 === 1) a++;
        if (p8 === 0 && p9 === 1) a++;
        if (p9 === 0 && p2 === 1) a++;

        if (a !== 1) continue;

        if (p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0) {
          toDelete.push(mid + x);
        }
      }
    }

    if (toDelete.length > 0) {
      hasChanged = true;
      for (let i = 0; i < toDelete.length; i++) {
        binary[toDelete[i]] = 0;
      }
    }

    // --- Sub-iteration 2 ---
    toDelete.length = 0;
    for (let y = 1; y < height - 1; y++) {
      const up = (y - 1) * width;
      const mid = y * width;
      const down = (y + 1) * width;

      for (let x = 1; x < width - 1; x++) {
        const p1 = binary[mid + x];
        if (p1 === 0) continue;

        const p2 = binary[up + x];
        const p3 = binary[up + x + 1];
        const p4 = binary[mid + x + 1];
        const p5 = binary[down + x + 1];
        const p6 = binary[down + x];
        const p7 = binary[down + x - 1];
        const p8 = binary[mid + x - 1];
        const p9 = binary[up + x - 1];

        const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (b < 2 || b > 6) continue;

        let a = 0;
        if (p2 === 0 && p3 === 1) a++;
        if (p3 === 0 && p4 === 1) a++;
        if (p4 === 0 && p5 === 1) a++;
        if (p5 === 0 && p6 === 1) a++;
        if (p6 === 0 && p7 === 1) a++;
        if (p7 === 0 && p8 === 1) a++;
        if (p8 === 0 && p9 === 1) a++;
        if (p9 === 0 && p2 === 1) a++;

        if (a !== 1) continue;

        if (p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0) {
          toDelete.push(mid + x);
        }
      }
    }

    if (toDelete.length > 0) {
      hasChanged = true;
      for (let i = 0; i < toDelete.length; i++) {
        binary[toDelete[i]] = 0;
      }
    }
  }

  return binary;
}

/**
 * Traces a 1-pixel skeleton grid into single-stroke polylines
 */
export function traceSkeletonToPolylines(
  skeleton: Uint8Array,
  width: number,
  height: number,
  scaleX: number,
  scaleY: number,
  targetHeight: number,
  simplificationTolerance: number = 0.3,
  minPathLength: number = 1.5
): VectorPolyline[] {
  const visited = new Uint8Array(width * height);
  const polylines: VectorPolyline[] = [];

  // Neighbor offsets in 8 directions
  const dx = [0, 1, 1, 1, 0, -1, -1, -1];
  const dy = [-1, -1, 0, 1, 1, 1, 0, -1];

  const getNeighbors = (x: number, y: number): { nx: number; ny: number; idx: number }[] => {
    const list: { nx: number; ny: number; idx: number }[] = [];
    for (let k = 0; k < 8; k++) {
      const nx = x + dx[k];
      const ny = y + dy[k];
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nIdx = ny * width + nx;
        if (skeleton[nIdx] === 1) {
          list.push({ nx, ny, idx: nIdx });
        }
      }
    }
    return list;
  };

  // 1. Find all endpoints (pixels with degree 1 or degree > 2) to start strokes cleanly
  const endpoints: { x: number; y: number }[] = [];
  const junctions: { x: number; y: number }[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (skeleton[idx] === 1) {
        const neighbors = getNeighbors(x, y);
        if (neighbors.length === 1) {
          endpoints.push({ x, y });
        } else if (neighbors.length > 2) {
          junctions.push({ x, y });
        }
      }
    }
  }

  // Trace strokes starting from endpoints first
  const traceFromPoint = (startX: number, startY: number) => {
    const startIdx = startY * width + startX;
    if (visited[startIdx]) return;

    const strokePts: Path2DPoint[] = [{ x: startX, y: startY }];
    visited[startIdx] = 1;

    let curX = startX;
    let curY = startY;

    while (true) {
      const neighbors = getNeighbors(curX, curY);
      let nextPt: { nx: number; ny: number; idx: number } | null = null;

      for (const n of neighbors) {
        if (!visited[n.idx]) {
          nextPt = n;
          break;
        }
      }

      if (!nextPt) break;

      visited[nextPt.idx] = 1;
      strokePts.push({ x: nextPt.nx, y: nextPt.ny });
      curX = nextPt.nx;
      curY = nextPt.ny;

      // If we reach a junction, stop stroke to avoid jumping across branches
      const curNeighbors = getNeighbors(curX, curY);
      if (curNeighbors.length > 2) {
        break;
      }
    }

    if (strokePts.length >= 2) {
      // Convert to mm CNC coordinates
      const mmPoints = strokePts.map((p) => ({
        x: Number((p.x * scaleX).toFixed(3)),
        y: Number((targetHeight - (p.y * scaleY)).toFixed(3)),
      }));

      const rawLen = computePolylineLength(mmPoints);
      const localTolerance = Math.min(simplificationTolerance, Math.max(0.01, rawLen * 0.08));
      let simplified = simplifyPolylineDP(mmPoints, Math.max(0.008, localTolerance));
      
      // LaserGRBL style smooth contour rounding for centerline sketches
      if (simplificationTolerance >= 0.15 && rawLen >= 3.0 && simplified.length >= 3) {
        simplified = smoothPolylineChaikin(simplified, 1, false);
        simplified = simplifyPolylineDP(simplified, simplificationTolerance * 0.4);
      }

      const len = computePolylineLength(simplified);

      if (simplified.length >= 2 && len >= minPathLength) {
        polylines.push({ points: simplified, closed: false });
      }
    }
  };

  // Trace from endpoints first
  for (const ep of endpoints) {
    traceFromPoint(ep.x, ep.y);
  }

  // Trace from junctions next
  for (const j of junctions) {
    traceFromPoint(j.x, j.y);
  }

  // Trace any remaining closed loops or unvisited strokes
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (skeleton[idx] === 1 && !visited[idx]) {
        traceFromPoint(x, y);
      }
    }
  }

  return polylines;
}

/**
 * Generates decorative and mechanical pattern fills (lines, crosshatch, concentric, zigzag, dots, wave)
 * strictly clipped inside the traced foreground contours of binaryGrid.
 */
export function generateContourPatternFills(
  binaryGrid: Uint8Array,
  gridW: number,
  gridH: number,
  scaleX: number,
  scaleY: number,
  targetWidth: number,
  targetHeight: number,
  pattern: string,
  fillSpacingMm: number = 2.0,
  fillAngleDeg: number = 45,
  tolerance: number = 0.25
): VectorPolyline[] {
  if (pattern === 'none' || !pattern) return [];

  const polylines: VectorPolyline[] = [];
  const sp = Math.max(0.3, fillSpacingMm);

  // Helper to check if mm coordinate is inside binary mask
  const isInside = (xMm: number, yMm: number): boolean => {
    if (xMm < 0 || xMm > targetWidth || yMm < 0 || yMm > targetHeight) return false;
    const gx = Math.floor(xMm / scaleX);
    const gy = Math.floor((targetHeight - yMm) / scaleY);
    if (gx < 0 || gx >= gridW || gy < 0 || gy >= gridH) return false;
    return binaryGrid[gy * gridW + gx] === 1;
  };

  // 1. Concentric Offset Insets / Contour Offset Rings
  if (pattern === 'concentric') {
    const pxStep = Math.max(1, Math.round(sp / Math.max(scaleX, scaleY)));
    let currentGrid = new Uint8Array(binaryGrid);

    for (let ring = 1; ring <= 20; ring++) {
      const nextGrid = new Uint8Array(gridW * gridH);
      let remainingCount = 0;

      // Morphological erosion by pxStep
      for (let y = pxStep; y < gridH - pxStep; y++) {
        for (let x = pxStep; x < gridW - pxStep; x++) {
          if (currentGrid[y * gridW + x] === 1) {
            let keep = true;
            for (let dy = -pxStep; dy <= pxStep; dy += pxStep) {
              for (let dx = -pxStep; dx <= pxStep; dx += pxStep) {
                if (currentGrid[(y + dy) * gridW + (x + dx)] === 0) {
                  keep = false;
                  break;
                }
              }
              if (!keep) break;
            }
            if (keep) {
              nextGrid[y * gridW + x] = 1;
              remainingCount++;
            }
          }
        }
      }

      if (remainingCount === 0) break;

      const ringPaths = traceOutlineContours(
        nextGrid,
        gridW,
        gridH,
        scaleX,
        scaleY,
        targetHeight,
        tolerance,
        0.8
      );

      for (const p of ringPaths) {
        polylines.push(p);
      }

      currentGrid = nextGrid;
    }

    return polylines;
  }

  // 2. Dots / Stippling Grid
  if (pattern === 'dots') {
    const rad = (fillAngleDeg * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);
    const diag = Math.hypot(targetWidth, targetHeight);
    const cx = targetWidth / 2;
    const cy = targetHeight / 2;

    for (let u = -diag; u <= diag; u += sp) {
      for (let v = -diag; v <= diag; v += sp) {
        const xMm = cx + u * cosA - v * sinA;
        const yMm = cy + u * sinA + v * cosA;

        if (isInside(xMm, yMm)) {
          const dotLen = Math.min(0.2, sp * 0.15);
          polylines.push({
            points: [
              { x: Number((xMm - dotLen).toFixed(3)), y: Number(yMm.toFixed(3)) },
              { x: Number((xMm + dotLen).toFixed(3)), y: Number(yMm.toFixed(3)) },
            ],
            closed: false,
          });
        }
      }
    }

    return polylines;
  }

  // 3. Line-based patterns: Linear Hatch, Crosshatch, Zigzag, and Wave
  const anglesToRun = pattern === 'crosshatch' ? [fillAngleDeg, fillAngleDeg + 90] : [fillAngleDeg];

  for (const curAngle of anglesToRun) {
    const rad = (curAngle * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);
    const nx = -sinA;
    const ny = cosA;

    const diag = Math.hypot(targetWidth, targetHeight);
    const cx = targetWidth / 2;
    const cy = targetHeight / 2;
    const sampleStep = Math.max(0.15, Math.min(scaleX, scaleY) * 0.6);

    let lineIndex = 0;
    for (let d = -diag; d <= diag; d += sp) {
      lineIndex++;
      const p0x = cx + nx * d;
      const p0y = cy + ny * d;

      let inStroke = false;
      let currentStroke: Path2DPoint[] = [];

      for (let t = -diag; t <= diag; t += sampleStep) {
        let xMm = p0x + cosA * t;
        let yMm = p0y + sinA * t;

        if (pattern === 'wave') {
          const waveAmp = sp * 0.35;
          const waveOffset = Math.sin(t * (Math.PI / sp)) * waveAmp;
          xMm += nx * waveOffset;
          yMm += ny * waveOffset;
        }

        if (isInside(xMm, yMm)) {
          if (!inStroke) {
            inStroke = true;
            currentStroke = [{ x: Number(xMm.toFixed(3)), y: Number(yMm.toFixed(3)) }];
          } else {
            currentStroke.push({ x: Number(xMm.toFixed(3)), y: Number(yMm.toFixed(3)) });
          }
        } else {
          if (inStroke) {
            if (currentStroke.length >= 2) {
              const simplified = simplifyPolylineDP(currentStroke, tolerance * 0.4);
              if (simplified.length >= 2) {
                polylines.push({ points: simplified, closed: false });
              }
            }
            inStroke = false;
            currentStroke = [];
          }
        }
      }

      if (inStroke && currentStroke.length >= 2) {
        const simplified = simplifyPolylineDP(currentStroke, tolerance * 0.4);
        if (simplified.length >= 2) {
          polylines.push({ points: simplified, closed: false });
        }
      }
    }
  }

  return polylines;
}

/**
 * Universal Image Vector Tracer
 * Executes either Contour Outline Tracing, Centerline Skeletonization, or Hatching
 */
export function traceImageToUniversalVectors(
  canvas: HTMLCanvasElement,
  settings: RasterSettings,
  maxGridDimension?: number
): VectorPolyline[] {
  const {
    mode,
    simplificationTolerance = 0.25,
    minPathLength = 1.0,
    detailSensitivity = 5,
    optimizeTsp = true,
    fillPattern = 'none',
    fillSpacing = 2.0,
    fillAngle = 45,
    fillIncludeContour = true,
  } = settings;

  // Calculate effective minimum path length based on detail sensitivity
  // Detail sensitivity 10 allows features as small as 0.05 mm (tiny airplane letters/dots)
  const detailFactor = Math.max(0.04, (11 - detailSensitivity) * 0.12);
  const effectiveMinPath = Math.min(minPathLength, detailFactor);

  // 1. Centerline / Skeletonize Mode (Zhang-Suen Thinning)
  if (mode === 'centerline_trace') {
    const dim = maxGridDimension || Math.round(350 + detailSensitivity * 160);
    const { binaryGrid, gridW, gridH, scaleX, scaleY, targetHeight } = extractBinaryGrid(canvas, settings, dim);
    if (binaryGrid.length === 0) return [];

    const skeleton = zhangSuenThinning(binaryGrid, gridW, gridH);
    const polylines = traceSkeletonToPolylines(
      skeleton,
      gridW,
      gridH,
      scaleX,
      scaleY,
      targetHeight,
      simplificationTolerance,
      effectiveMinPath
    );

    return optimizeTsp ? optimizePolylineOrder(polylines) : polylines;
  }

  // 2. Outline Contour Mode (Marching Squares Boundary Tracing + Optional Pattern Fills)
  if (mode === 'contour_trace') {
    const dim = maxGridDimension || Math.round(400 + detailSensitivity * 180);
    const { binaryGrid, gridW, gridH, scaleX, scaleY, targetWidth, targetHeight } = extractBinaryGrid(canvas, settings, dim);
    if (binaryGrid.length === 0) return [];

    const polylines: VectorPolyline[] = [];

    // Outer & inner boundary contours
    if (fillIncludeContour !== false || fillPattern === 'none') {
      const contourPaths = traceOutlineContours(
        binaryGrid,
        gridW,
        gridH,
        scaleX,
        scaleY,
        targetHeight,
        simplificationTolerance,
        effectiveMinPath
      );
      polylines.push(...contourPaths);
    }

    // Interior decorative & mechanical pattern fills
    if (fillPattern && fillPattern !== 'none') {
      const fillPaths = generateContourPatternFills(
        binaryGrid,
        gridW,
        gridH,
        scaleX,
        scaleY,
        targetWidth,
        targetHeight,
        fillPattern,
        fillSpacing,
        fillAngle,
        simplificationTolerance
      );
      polylines.push(...fillPaths);
    }

    return optimizeTsp ? optimizePolylineOrder(polylines) : polylines;
  }

  return [];
}

/**
 * Optimizes cutting/drawing sequence of polylines using Nearest Neighbor (Greedy TSP)
 * and allows flipping direction of open strokes to minimize rapid G0 travel.
 */
export function optimizePolylineOrder(paths: VectorPolyline[]): VectorPolyline[] {
  if (paths.length <= 1) return paths;

  const remaining = [...paths];
  const ordered: VectorPolyline[] = [];
  let currentPos: Path2DPoint = { x: 0, y: 0 };

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let minDistance = Infinity;
    let reversePath = false;

    for (let i = 0; i < remaining.length; i++) {
      const p = remaining[i];
      if (!p.points || p.points.length === 0) continue;

      const startPt = p.points[0];
      const endPt = p.points[p.points.length - 1];

      // Distance to start point
      const dStart = Math.hypot(startPt.x - currentPos.x, startPt.y - currentPos.y);
      if (dStart < minDistance) {
        minDistance = dStart;
        nearestIndex = i;
        reversePath = false;
      }

      // If open path, also check distance to end of path (can reverse stroke direction)
      if (!p.closed) {
        const dEnd = Math.hypot(endPt.x - currentPos.x, endPt.y - currentPos.y);
        if (dEnd < minDistance) {
          minDistance = dEnd;
          nearestIndex = i;
          reversePath = true;
        }
      }
    }

    const nextPath = remaining.splice(nearestIndex, 1)[0];
    if (reversePath && !nextPath.closed) {
      nextPath.points.reverse();
    }
    ordered.push(nextPath);
    currentPos = nextPath.points[nextPath.points.length - 1];
  }

  return ordered;
}
