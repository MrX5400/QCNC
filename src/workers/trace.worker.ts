import { preprocessImage } from '../services/imagePreprocessor';
/// <reference lib="webworker" />

import { VectorizeRequest, VectorizeResponse } from '../services/imageVectorizer';
import { VectorPolyline } from '../types/cnc';
import ImageTracer from 'imagetracerjs';
import * as ClipperLib from 'clipper-lib';

// ─── Entry Point ───────────────────────────────────────────────────────────────

self.onmessage = async (e: MessageEvent<VectorizeRequest>) => {
  const { id, imageData, settings } = e.data;

  try {
    let polylines: VectorPolyline[] = [];

    // 1. Image Preprocessing (Alpha Blending, Brightness, Contrast, Gamma, Threshold)
    const processedData = preprocessImage(imageData, settings);

    // 2. Vectorization based on strategy
    const strategy = settings.traceStrategy ||
      (settings.fillMode === 'stippling' || settings.fillMode === 'laser_m4_scanline' ? 'scanline' :
      (settings.mode === 'centerline' || settings.mode === 'centerline_trace' ? 'centerline' :
      (settings.fillMode === 'hatch_linear' || settings.fillMode === 'crosshatch' ? 'pattern' : 'contour')));

    if (strategy === 'scanline') {
      polylines = generateLaserM4Scanline(processedData, settings);
    } else if (strategy === 'centerline') {
      polylines = traceCenterline(processedData, settings);
    } else if (strategy === 'pattern') {
      // Check for special redirect patterns
      const patternType = settings.fillPattern || settings.fillMode || 'lines';
      if (patternType === 'laser_m4_scanline') {
        polylines = generateLaserM4Scanline(processedData, settings);
      } else {
        polylines = generateFullImagePattern(processedData, settings);
      }
    } else {
      // strategy === 'contour'
      const outlines = traceOutlines(processedData, settings);
      if (settings.contourMode !== 'contour_only' && settings.fillMode !== 'none') {
        polylines = generateContourFill(outlines, processedData, settings);
      } else {
        polylines = outlines;
      }
    }

    // Apply curve smoothing (preserving s-values)
    if (settings.curveSmoothness && settings.curveSmoothness > 50) {
      const iterations = Math.floor((settings.curveSmoothness - 50) / 10);
      if (iterations > 0) {
        polylines = polylines.map(p => ({
          ...p,
          points: chaikinSmooth(p.points, p.closed, iterations)
        }));
      }
    }

    // Apply minPathLength filtering
    if (settings.minPathLength && settings.minPathLength > 0) {
      polylines = polylines.filter(p => computePolylineLength(p.points) >= settings.minPathLength!);
    }

    self.postMessage({ id, polylines } as VectorizeResponse);
  } catch (error: any) {
    self.postMessage({ id, error: error.message } as VectorizeResponse);
  }
};

// ─── Shared Helpers ────────────────────────────────────────────────────────────

function sampleGray(data: Uint8ClampedArray, x: number, y: number, w: number, h: number): number {
  const px = Math.min(w - 1, Math.max(0, Math.round(x)));
  const py = Math.min(h - 1, Math.max(0, Math.round(y)));
  const i = (py * w + px) * 4;
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
}

function computePolylineLength(points: { x: number; y: number }[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

/** Extract paths from ClipperLib PolyTree, converting back to mm coordinates with laser power sampling. */
function extractClipperPaths(
  node: ClipperLib.PolyNode,
  scale: number,
  samplePower: (mmX: number, mmY: number) => number,
  result: VectorPolyline[]
): void {
  if (node.Contour() && node.Contour().length > 0) {
    const pts = node.Contour().map(pt => {
      const x = pt.X / scale;
      const y = pt.Y / scale;
      return { x, y, s: samplePower(x, y) };
    });
    result.push({
      points: pts,
      closed: node.IsOpen ? false : true
    });
  }
  for (const child of node.Childs()) extractClipperPaths(child, scale, samplePower, result);
}

// ─── Full Image Pattern Generation (traceStrategy === 'pattern') ───────────────

function generateFullImagePattern(imageData: ImageData, settings: any): VectorPolyline[] {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const polylines: VectorPolyline[] = [];

  const pattern = settings.fillPattern || settings.fillMode || 'lines';
  const spacing = settings.fillSpacing || 2.0;
  const targetHeight = settings.targetHeight || 100;
  const spacingPx = Math.max(1, Math.round(spacing * (height / targetHeight)));
  const angle = (settings.hatchAngle || settings.fillAngle || 45) * Math.PI / 180;

  const pwrMin = settings.laserPowerMin || 0;
  const pwrMax = settings.laserPowerMax || 1000;

  const cx = width / 2;
  const cy = height / 2;
  const diag = Math.hypot(width, height);

  const processLine = (ang: number, isWave: boolean) => {
    const cosA = Math.cos(ang);
    const sinA = Math.sin(ang);
    const nLines = Math.min(10000, Math.ceil(diag / spacingPx) * 2);

    for (let i = -nLines / 2; i <= nLines / 2; i++) {
      const d = i * spacingPx;
      const px = -sinA;
      const py = cosA;
      const midX = cx + px * d;
      const midY = cy + py * d;

      let currentPoly: { x: number; y: number; s?: number }[] = [];
      const segments = Math.min(100000, Math.ceil(diag / 1));

      for (let j = -segments / 2; j <= segments / 2; j++) {
        let x: number, y: number;
        if (isWave) {
          const freq = Math.PI * 2 / (spacingPx * 3);
          const grayBase = sampleGray(data, midX + cosA * j, midY + sinA * j, width, height);
          const lumBase = grayBase / 255;
          const amp = (1 - lumBase) * spacingPx / 2;
          const waveOffset = amp * Math.sin(j * freq);
          x = midX + cosA * j - sinA * waveOffset;
          y = midY + sinA * j + cosA * waveOffset;
        } else {
          x = midX + cosA * j;
          y = midY + sinA * j;
        }

        if (x < 0 || x >= width || y < 0 || y >= height) {
          if (currentPoly.length > 0) {
            polylines.push({ points: currentPoly, closed: false });
            currentPoly = [];
          }
          continue;
        }

        const gray = sampleGray(data, x, y, width, height);
        const luminance = gray / 255;

        if (luminance > 0.95) {
          if (currentPoly.length > 0) {
            polylines.push({ points: currentPoly, closed: false });
            currentPoly = [];
          }
        } else {
          const power = Math.round(pwrMin + (1 - luminance) * (pwrMax - pwrMin));
          currentPoly.push({ x, y, s: power });
        }
      }
      if (currentPoly.length > 0) {
        polylines.push({ points: currentPoly, closed: false });
      }
    }
  };

  if (pattern === 'lines' || pattern === 'hatch_linear') {
    processLine(angle, false);
  } else if (pattern === 'crosshatch') {
    processLine(angle, false);
    processLine(angle + Math.PI / 2, false);
  } else if (pattern === 'wave') {
    processLine(angle, true);
  } else if (pattern === 'spiral') {
    const maxR = Math.hypot(cx, cy);
    const dTheta = 0.1;
    const b = spacingPx / (2 * Math.PI);
    let currentPoly: { x: number; y: number; s?: number }[] = [];
    const maxSteps = 100000;
    let step = 0;

    for (let theta = 0; theta <= maxR / b && step < maxSteps; theta += dTheta, step++) {
      const rBase = b * theta;
      const bx = cx + rBase * Math.cos(theta);
      const by = cy + rBase * Math.sin(theta);

      if (bx < 0 || bx >= width || by < 0 || by >= height) continue;

      const gray = sampleGray(data, bx, by, width, height);
      const luminance = gray / 255;
      const power = Math.round(pwrMin + (1 - luminance) * (pwrMax - pwrMin));

      if (luminance > 0.95) {
        if (currentPoly.length > 0) {
          polylines.push({ points: currentPoly, closed: false });
          currentPoly = [];
        }
      } else {
        const amp = (1 - luminance) * spacingPx * 0.2;
        const tangentA = theta + Math.PI / 2;
        const x = bx + amp * Math.cos(tangentA);
        const y = by + amp * Math.sin(tangentA);
        currentPoly.push({ x, y, s: power });
      }
    }
    if (currentPoly.length > 0) polylines.push({ points: currentPoly, closed: false });

  } else if (pattern === 'dots_grid') {
    for (let y = 0; y < height; y += spacingPx) {
      for (let x = 0; x < width; x += spacingPx) {
        const gray = sampleGray(data, x, y, width, height);
        const luminance = gray / 255;
        if (luminance < 0.9) {
          const power = Math.round(pwrMin + (1 - luminance) * (pwrMax - pwrMin));
          const arms = 0.3;
          polylines.push({ points: [{ x: x - arms, y, s: power }, { x: x + arms, y, s: power }], closed: false });
          polylines.push({ points: [{ x, y: y - arms, s: power }, { x, y: y + arms, s: power }], closed: false });
        }
      }
    }

  } else if (pattern === 'stippling') {
    // Floyd-Steinberg error-diffusion dithering for organic stipple distribution
    const grayBuf = new Float32Array(width * height);
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        grayBuf[py * width + px] = sampleGray(data, px, py, width, height);
      }
    }

    // Error diffusion
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const idx = py * width + px;
        const oldVal = grayBuf[idx];
        const newVal = oldVal < 128 ? 0 : 255;
        grayBuf[idx] = newVal;
        const err = oldVal - newVal;
        if (px + 1 < width) grayBuf[idx + 1] += err * 7 / 16;
        if (py + 1 < height) {
          if (px - 1 >= 0) grayBuf[(py + 1) * width + px - 1] += err * 3 / 16;
          grayBuf[(py + 1) * width + px] += err * 5 / 16;
          if (px + 1 < width) grayBuf[(py + 1) * width + px + 1] += err * 1 / 16;
        }
      }
    }

    // Emit crosses at every black dithered pixel, subsampled by spacing
    const stepPx = Math.max(1, Math.round(spacingPx / 2));
    for (let py = 0; py < height; py += stepPx) {
      for (let px = 0; px < width; px += stepPx) {
        if (grayBuf[py * width + px] < 128) {
          const power = pwrMax;
          const arms = 0.3;
          polylines.push({ points: [{ x: px - arms, y: py, s: power }, { x: px + arms, y: py, s: power }], closed: false });
          polylines.push({ points: [{ x: px, y: py - arms, s: power }, { x: px, y: py + arms, s: power }], closed: false });
        }
      }
    }

  } else if (pattern === 'dithered_hatch') {
    // Jitter hatch: lines with micro-noise whose amplitude scales with darkness
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const nLines = Math.min(10000, Math.ceil(diag / spacingPx) * 2);

    for (let i = -nLines / 2; i <= nLines / 2; i++) {
      const d = i * spacingPx;
      const px = -sinA;
      const py = cosA;
      const midX = cx + px * d;
      const midY = cy + py * d;

      let currentPoly: { x: number; y: number; s?: number }[] = [];
      const step = 2;
      const segments = Math.min(50000, Math.ceil(diag / step));

      for (let j = -segments / 2; j <= segments / 2; j++) {
        const baseX = midX + cosA * j * step;
        const baseY = midY + sinA * j * step;

        if (baseX < 0 || baseX >= width || baseY < 0 || baseY >= height) {
          if (currentPoly.length > 0) {
            polylines.push({ points: currentPoly, closed: false });
            currentPoly = [];
          }
          continue;
        }

        const gray = sampleGray(data, baseX, baseY, width, height);
        const luminance = gray / 255;

        if (luminance > 0.95) {
          if (currentPoly.length > 0) {
            polylines.push({ points: currentPoly, closed: false });
            currentPoly = [];
          }
        } else {
          const darkness = 1 - luminance;
          // Jitter perpendicular to line direction, amplitude proportional to darkness
          const jitterAmp = darkness * spacingPx * 0.3;
          const noise = (Math.sin(j * 7.3 + i * 13.7) * 0.5 + Math.sin(j * 3.1 + i * 5.9) * 0.5);
          const offset = jitterAmp * noise;
          const x = baseX - sinA * offset;
          const y = baseY + cosA * offset;
          const power = Math.round(pwrMin + darkness * (pwrMax - pwrMin));
          currentPoly.push({ x, y, s: power });
        }
      }
      if (currentPoly.length > 0) {
        polylines.push({ points: currentPoly, closed: false });
      }
    }

  } else if (pattern === 'concentric') {
    let currentX = 0, currentY = 0, currentW = width, currentH = height;
    let iterations = 0;
    while (currentW > 0 && currentH > 0 && iterations < 10000) {
      const rectPoly: { x: number; y: number; s?: number }[] = [];
      const addPt = (x: number, y: number) => {
        const gray = sampleGray(data, x, y, width, height);
        const luminance = gray / 255;
        const power = Math.round(pwrMin + (1 - luminance) * (pwrMax - pwrMin));
        rectPoly.push({ x, y, s: power });
      };

      for (let x = currentX; x < currentX + currentW; x += Math.max(1, spacingPx / 2)) addPt(x, currentY);
      for (let y = currentY; y < currentY + currentH; y += Math.max(1, spacingPx / 2)) addPt(currentX + currentW, y);
      for (let x = currentX + currentW; x > currentX; x -= Math.max(1, spacingPx / 2)) addPt(x, currentY + currentH);
      for (let y = currentY + currentH; y > currentY; y -= Math.max(1, spacingPx / 2)) addPt(currentX, y);

      if (rectPoly.length > 0) polylines.push({ points: rectPoly, closed: true });

      currentX += spacingPx;
      currentY += spacingPx;
      currentW -= spacingPx * 2;
      currentH -= spacingPx * 2;
      iterations++;
    }
  }

  return scalePolylines(polylines, settings, width, height);
}

// ─── Contour Fill Generation (traceStrategy === 'contour' with fill) ───────────

function generateContourFill(outlines: VectorPolyline[], imageData: ImageData, settings: any): VectorPolyline[] {
  const pattern = settings.fillPattern || settings.fillMode || 'lines';
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  const targetWidth = settings.targetWidth || 100;
  const targetHeight = settings.targetHeight || 100;
  const scaleX = targetWidth / width;
  const scaleY = targetHeight / height;

  const clipScale = 1000;
  const paths: Array<Array<{ X: number; Y: number }>> = [];

  for (const poly of outlines) {
    const p = poly.points.map(pt => ({ X: Math.round(pt.x * clipScale), Y: Math.round(pt.y * clipScale) }));
    if (p.length > 0) paths.push(p);
  }

  const resultPolys: VectorPolyline[] = [];

  // Handle contour inclusion based on contourMode
  const contourMode = settings.contourMode || 'contour_fill';
  if (contourMode !== 'fill_only' && settings.fillIncludeContour !== false) {
    resultPolys.push(...outlines);
  }

  if (paths.length === 0 || pattern === 'none') return resultPolys;

  const spacing = Math.max(0.1, (settings.fillSpacing || 2.0)) * clipScale;
  const angle = (settings.hatchAngle || settings.fillAngle || 45) * Math.PI / 180;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of paths) {
    for (const pt of p) {
      if (pt.X < minX) minX = pt.X;
      if (pt.Y < minY) minY = pt.Y;
      if (pt.X > maxX) maxX = pt.X;
      if (pt.Y > maxY) maxY = pt.Y;
    }
  }

  const diag = Math.hypot(maxX - minX, maxY - minY);
  const cxClip = (minX + maxX) / 2;
  const cyClip = (minY + maxY) / 2;
  const pwrMin = settings.laserPowerMin || 0;
  const pwrMax = settings.laserPowerMax || 1000;

  const samplePower = (mmX: number, mmY: number): number => {
    const px = mmX / scaleX;
    const py = mmY / scaleY;
    const gray = sampleGray(data, px, py, width, height);
    const luminance = gray / 255;
    return Math.round(pwrMin + (1 - luminance) * (pwrMax - pwrMin));
  };

  const linePaths: Array<Array<{ X: number; Y: number }>> = [];

  const addLines = (ang: number, isWave: boolean = false) => {
    const cosA = Math.cos(ang);
    const sinA = Math.sin(ang);
    let nLines = Math.ceil(diag / spacing) * 2;
    if (nLines > 10000) nLines = 10000;

    for (let i = -nLines / 2; i <= nLines / 2; i++) {
      const d = i * spacing;
      const px = -sinA;
      const py = cosA;
      const midX = cxClip + px * d;
      const midY = cyClip + py * d;

      if (isWave) {
        const wavePath: { X: number; Y: number }[] = [];
        const segments = Math.min(100000, Math.ceil(diag / (spacing / 2)));
        for (let j = -segments / 2; j <= segments / 2; j++) {
          const l = j * (spacing / 2);
          const waveOffset = Math.sin(j) * (spacing * 0.4);
          const wx = midX + cosA * l - sinA * waveOffset;
          const wy = midY + sinA * l + cosA * waveOffset;
          wavePath.push({ X: Math.round(wx), Y: Math.round(wy) });
        }
        linePaths.push(wavePath);
      } else {
        const lx1 = midX + cosA * diag;
        const ly1 = midY + sinA * diag;
        const lx2 = midX - cosA * diag;
        const ly2 = midY - sinA * diag;
        linePaths.push([{ X: Math.round(lx1), Y: Math.round(ly1) }, { X: Math.round(lx2), Y: Math.round(ly2) }]);
      }
    }
  };

  if (['lines', 'zigzag', 'wave', 'crosshatch', 'hatch_linear'].includes(pattern)) {
    addLines(angle, pattern === 'wave');
    if (pattern === 'crosshatch') addLines(angle + Math.PI / 2);

    const clipper = new ClipperLib.Clipper();
    clipper.AddPaths(paths, ClipperLib.PolyType.ptClip, true);
    clipper.AddPaths(linePaths, ClipperLib.PolyType.ptSubject, false);

    const solution = new ClipperLib.PolyTree();
    clipper.Execute(ClipperLib.ClipType.ctIntersection, solution, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);
    extractClipperPaths(solution, clipScale, samplePower, resultPolys);

  } else if (pattern === 'spiral') {
    const spiralPaths: Array<Array<{ X: number; Y: number }>> = [];
    const maxR = diag / 2;
    const b = spacing / (2 * Math.PI);
    const dTheta = 0.1;
    const currentPath: { X: number; Y: number }[] = [];
    for (let theta = 0; theta <= maxR / b && theta < 100000; theta += dTheta) {
      const r = b * theta;
      const sx = cxClip + r * Math.cos(theta);
      const sy = cyClip + r * Math.sin(theta);
      currentPath.push({ X: Math.round(sx), Y: Math.round(sy) });
    }
    if (currentPath.length > 0) spiralPaths.push(currentPath);

    const clipper = new ClipperLib.Clipper();
    clipper.AddPaths(paths, ClipperLib.PolyType.ptClip, true);
    clipper.AddPaths(spiralPaths, ClipperLib.PolyType.ptSubject, false);

    const solution = new ClipperLib.PolyTree();
    clipper.Execute(ClipperLib.ClipType.ctIntersection, solution, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);
    extractClipperPaths(solution, clipScale, samplePower, resultPolys);

  } else if (pattern === 'concentric') {
    // FIX: Generate concentric offset rings, then clip with EvenOdd to respect holes
    const co = new ClipperLib.ClipperOffset();
    co.AddPaths(paths, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);

    // Collect all offset rings as open polylines for clipping
    const allOffsetPaths: Array<Array<{ X: number; Y: number }>> = [];
    let currentOffset = -spacing;
    let iterations = 0;
    while (iterations < 10000) {
      const offsetSolution: Array<Array<{ X: number; Y: number }>> = [];
      co.Execute(offsetSolution, currentOffset);
      if (offsetSolution.length === 0) break;
      allOffsetPaths.push(...offsetSolution);
      currentOffset -= spacing;
      iterations++;
    }

    // Now clip all offset rings against original paths with EvenOdd to cut out holes
    if (allOffsetPaths.length > 0) {
      const clipper = new ClipperLib.Clipper();
      clipper.AddPaths(paths, ClipperLib.PolyType.ptClip, true);
      // Add offset paths as closed subject polygons, clip as intersection
      for (const op of allOffsetPaths) {
        clipper.AddPath(op, ClipperLib.PolyType.ptSubject, true);
      }

      const solution: Array<Array<{ X: number; Y: number }>> = [];
      clipper.Execute(
        ClipperLib.ClipType.ctIntersection, solution,
        ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd
      );

      for (const sol of solution) {
        resultPolys.push({
          points: sol.map(pt => {
            const x = pt.X / clipScale;
            const y = pt.Y / clipScale;
            return { x, y, s: samplePower(x, y) };
          }),
          closed: true
        });
      }
    }

  } else if (pattern === 'dots_grid' || pattern === 'stippling') {
    // FIX: EvenOdd winding test to correctly exclude holes
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const step = spacing;

    for (let dy = -diag / 2; dy <= diag / 2; dy += step) {
      for (let dx = -diag / 2; dx <= diag / 2; dx += step) {
        const x = cxClip + dx * cosA - dy * sinA;
        const y = cyClip + dx * sinA + dy * cosA;

        const pt = { X: Math.round(x), Y: Math.round(y) };

        // EvenOdd point-in-polygon: count how many contours contain this point
        let windingCount = 0;
        for (const path of paths) {
          const pip = ClipperLib.Clipper.PointInPolygon(pt, path);
          if (pip !== 0) windingCount++;
        }
        // EvenOdd rule: odd count = inside fill region, even = outside or inside hole
        const inside = (windingCount % 2) === 1;

        if (inside) {
          const arms = 0.2;
          const rx = x / clipScale;
          const ry = y / clipScale;
          const power = samplePower(rx, ry);
          resultPolys.push({ points: [{ x: rx - arms, y: ry, s: power }, { x: rx + arms, y: ry, s: power }], closed: false });
          resultPolys.push({ points: [{ x: rx, y: ry - arms, s: power }, { x: rx, y: ry + arms, s: power }], closed: false });
        }
      }
    }

  } else if (pattern === 'dithered_hatch') {
    // Jitter hatch inside contours – generate jittered lines then clip
    const jitterLinePaths: Array<Array<{ X: number; Y: number }>> = [];
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    let nLines = Math.ceil(diag / spacing) * 2;
    if (nLines > 10000) nLines = 10000;
    const lineStep = spacing / 4;

    for (let i = -nLines / 2; i <= nLines / 2; i++) {
      const d = i * spacing;
      const midX = cxClip + (-sinA) * d;
      const midY = cyClip + cosA * d;
      const jitterPath: { X: number; Y: number }[] = [];
      const segments = Math.min(50000, Math.ceil(diag / lineStep));

      for (let j = -segments / 2; j <= segments / 2; j++) {
        const l = j * lineStep;
        // Deterministic noise based on position
        const noise = Math.sin(j * 7.3 + i * 13.7) * 0.5 + Math.sin(j * 3.1 + i * 5.9) * 0.5;
        const jitterAmp = spacing * 0.25 * noise;
        const wx = midX + cosA * l - sinA * jitterAmp;
        const wy = midY + sinA * l + cosA * jitterAmp;
        jitterPath.push({ X: Math.round(wx), Y: Math.round(wy) });
      }
      if (jitterPath.length > 1) jitterLinePaths.push(jitterPath);
    }

    const clipper = new ClipperLib.Clipper();
    clipper.AddPaths(paths, ClipperLib.PolyType.ptClip, true);
    clipper.AddPaths(jitterLinePaths, ClipperLib.PolyType.ptSubject, false);

    const solution = new ClipperLib.PolyTree();
    clipper.Execute(ClipperLib.ClipType.ctIntersection, solution, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);
    extractClipperPaths(solution, clipScale, samplePower, resultPolys);
  }

  return resultPolys;
}

// ─── Chaikin Smoothing (with s-value preservation) ────────────────────────────

function chaikinSmooth(
  points: { x: number; y: number; s?: number }[],
  closed: boolean,
  iterations: number
): { x: number; y: number; s?: number }[] {
  if (iterations === 0 || points.length < 3) return points;
  let pts = points;
  for (let iter = 0; iter < iterations; iter++) {
    const newPts: { x: number; y: number; s?: number }[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const hasPower = p0.s !== undefined || p1.s !== undefined;
      newPts.push({
        x: 0.75 * p0.x + 0.25 * p1.x,
        y: 0.75 * p0.y + 0.25 * p1.y,
        ...(hasPower ? { s: Math.round(0.75 * (p0.s ?? p1.s!) + 0.25 * (p1.s ?? p0.s!)) } : {})
      });
      newPts.push({
        x: 0.25 * p0.x + 0.75 * p1.x,
        y: 0.25 * p0.y + 0.75 * p1.y,
        ...(hasPower ? { s: Math.round(0.25 * (p0.s ?? p1.s!) + 0.75 * (p1.s ?? p0.s!)) } : {})
      });
    }
    if (closed) {
      const p0 = pts[pts.length - 1];
      const p1 = pts[0];
      const hasPower = p0.s !== undefined || p1.s !== undefined;
      newPts.push({
        x: 0.75 * p0.x + 0.25 * p1.x,
        y: 0.75 * p0.y + 0.25 * p1.y,
        ...(hasPower ? { s: Math.round(0.75 * (p0.s ?? p1.s!) + 0.25 * (p1.s ?? p0.s!)) } : {})
      });
      newPts.push({
        x: 0.25 * p0.x + 0.75 * p1.x,
        y: 0.25 * p0.y + 0.75 * p1.y,
        ...(hasPower ? { s: Math.round(0.25 * (p0.s ?? p1.s!) + 0.75 * (p1.s ?? p0.s!)) } : {})
      });
    } else {
      newPts.unshift(pts[0]);
      newPts.push(pts[pts.length - 1]);
    }
    pts = newPts;
  }
  return pts;
}

// ─── Laser M4 Scanline Generator ──────────────────────────────────────────────

function generateLaserM4Scanline(imageData: ImageData, settings: any): VectorPolyline[] {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const polylines: VectorPolyline[] = [];
  const spacing = settings.fillSpacing || 0.2;
  const pwrMin = settings.laserPowerMin || 0;
  const pwrMax = settings.laserPowerMax || 1000;
  const stepY = Math.max(1, Math.round(spacing * (height / (settings.targetHeight || 100))));

  let movingRight = true;
  for (let y = 0; y < height; y += stepY) {
    const currentPoly: { x: number; y: number; s?: number }[] = [];
    let lastPower = -1;

    const startX = movingRight ? 0 : width - 1;
    const endX = movingRight ? width : -1;
    const stepX = movingRight ? 1 : -1;

    for (let x = startX; x !== endX; x += stepX) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      const sVal = Math.round(pwrMin + ((255 - gray) / 255) * (pwrMax - pwrMin));

      if (Math.abs(sVal - lastPower) > 5 || x === startX || x === endX - stepX) {
        currentPoly.push({ x, y, s: sVal });
        lastPower = sVal;
      }
    }

    if (currentPoly.length > 0) {
      polylines.push({ points: currentPoly, closed: false });
    }

    movingRight = !movingRight;
  }
  return scalePolylines(polylines, settings, width, height);
}

// ─── Contour Tracing (ImageTracer.js) ────────────────────────────────────────

function adaptiveQuadraticBezier(
  x0: number, y0: number, x1: number, y1: number, x2: number, y2: number,
  toleranceSq: number, points: { x: number; y: number }[], depth: number = 0
) {
  if (depth > 12) {
    points.push({ x: x2, y: y2 });
    return;
  }

  const q0x = (x0 + x1) / 2;
  const q0y = (y0 + y1) / 2;
  const q1x = (x1 + x2) / 2;
  const q1y = (y1 + y2) / 2;
  const qmx = (q0x + q1x) / 2;
  const qmy = (q0y + q1y) / 2;

  const lx = (x0 + x2) / 2;
  const ly = (y0 + y2) / 2;

  const distSq = (qmx - lx) ** 2 + (qmy - ly) ** 2;

  if (distSq <= toleranceSq) {
    points.push({ x: x2, y: y2 });
  } else {
    adaptiveQuadraticBezier(x0, y0, q0x, q0y, qmx, qmy, toleranceSq, points, depth + 1);
    adaptiveQuadraticBezier(qmx, qmy, q1x, q1y, x2, y2, toleranceSq, points, depth + 1);
  }
}

function traceOutlines(imageData: ImageData, settings: any): VectorPolyline[] {
  const turdsize = settings.turdsize ?? settings.despeckleSize ?? 8;
  const alphamax = settings.alphamax ?? 1.0;
  const opttolerance = settings.opttolerance ?? settings.simplificationTolerance ?? 0.2;

  const ltres = opttolerance * 5;
  const qtres = opttolerance * 5;
  const rightangleenhance = alphamax < 0.5;

  const options = {
    ltres, qtres,
    pathomit: turdsize,
    rightangleenhance,
    colorsampling: 0,
    numberofcolors: 2,
    mincolorratio: 0,
    colorquantcycles: 1,
    layering: 0,
    strokewidth: 1,
    linefilter: false,
    scale: 1,
    roundcoords: 3,
    viewbox: false,
    desc: false,
    lcpr: 0,
    qcpr: 0
  };

  const tracedata = ImageTracer.imagedataToTracedata(imageData, options);
  const polylines: VectorPolyline[] = [];

  if (!tracedata.layers || !tracedata.layers[0]) return [];
  const blackLayer = tracedata.layers[0];

  const bisectionToleranceSq = Math.max(0.01, opttolerance * opttolerance * 4);

  blackLayer.forEach((path: any) => {
    if (!path.segments || path.segments.length === 0) return;

    const poly: VectorPolyline = { points: [], closed: true };
    let currentX = path.segments[0].x1;
    let currentY = path.segments[0].y1;
    poly.points.push({ x: currentX, y: currentY });

    path.segments.forEach((seg: any) => {
      if (seg.type === 'L') {
        poly.points.push({ x: seg.x2, y: seg.y2 });
        currentX = seg.x2;
        currentY = seg.y2;
      } else if (seg.type === 'Q') {
        adaptiveQuadraticBezier(currentX, currentY, seg.x2, seg.y2, seg.x3, seg.y3, bisectionToleranceSq, poly.points);
        currentX = seg.x3;
        currentY = seg.y3;
      }
    });

    if (poly.points.length > 2) {
      polylines.push(poly);
    }
  });

  return scalePolylines(polylines, settings, imageData.width, imageData.height);
}

// ─── Centerline Tracing (Zhang-Suen Thinning) ────────────────────────────────

function traceCenterline(imageData: ImageData, settings: any): VectorPolyline[] {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  let grid = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      grid[y * width + x] = data[idx] === 0 ? 1 : 0;
    }
  }

  let hasChanged = true;
  while (hasChanged) {
    hasChanged = false;
    let marker = new Uint8Array(width * height);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        if (grid[i] === 1 && zsStep1(grid, x, y, width)) {
          marker[i] = 1;
          hasChanged = true;
        }
      }
    }
    for (let i = 0; i < grid.length; i++) {
      if (marker[i] === 1) grid[i] = 0;
    }

    marker = new Uint8Array(width * height);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        if (grid[i] === 1 && zsStep2(grid, x, y, width)) {
          marker[i] = 1;
          hasChanged = true;
        }
      }
    }
    for (let i = 0; i < grid.length; i++) {
      if (marker[i] === 1) grid[i] = 0;
    }
  }

  const polylines: VectorPolyline[] = [];
  const visited = new Uint8Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (grid[i] === 1 && !visited[i]) {
        const poly: VectorPolyline = { points: [], closed: false };
        let cx = x, cy = y;

        while (true) {
          visited[cy * width + cx] = 1;
          poly.points.push({ x: cx, y: cy });

          let found = false;
          const neighbors = [
            [-1, -1], [0, -1], [1, -1],
            [-1, 0], [1, 0],
            [-1, 1], [0, 1], [1, 1]
          ];

          for (const [dx, dy] of neighbors) {
            const nx = cx + dx;
            const ny = cy + dy;
            const ni = ny * width + nx;
            if (grid[ni] === 1 && !visited[ni]) {
              cx = nx;
              cy = ny;
              found = true;
              break;
            }
          }
          if (!found) break;
        }

        if (poly.points.length > 2) {
          polylines.push(poly);
        }
      }
    }
  }

  return scalePolylines(polylines, settings, width, height);
}

function zsStep1(grid: Uint8Array, x: number, y: number, w: number): boolean {
  const p2 = grid[(y - 1) * w + x];
  const p3 = grid[(y - 1) * w + x + 1];
  const p4 = grid[y * w + x + 1];
  const p5 = grid[(y + 1) * w + x + 1];
  const p6 = grid[(y + 1) * w + x];
  const p7 = grid[(y + 1) * w + x - 1];
  const p8 = grid[y * w + x - 1];
  const p9 = grid[(y - 1) * w + x - 1];

  let a = 0;
  if (p2 == 0 && p3 == 1) a++;
  if (p3 == 0 && p4 == 1) a++;
  if (p4 == 0 && p5 == 1) a++;
  if (p5 == 0 && p6 == 1) a++;
  if (p6 == 0 && p7 == 1) a++;
  if (p7 == 0 && p8 == 1) a++;
  if (p8 == 0 && p9 == 1) a++;
  if (p9 == 0 && p2 == 1) a++;

  const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
  return (b >= 2 && b <= 6 && a === 1 && (p2 * p4 * p6 === 0) && (p4 * p6 * p8 === 0));
}

function zsStep2(grid: Uint8Array, x: number, y: number, w: number): boolean {
  const p2 = grid[(y - 1) * w + x];
  const p3 = grid[(y - 1) * w + x + 1];
  const p4 = grid[y * w + x + 1];
  const p5 = grid[(y + 1) * w + x + 1];
  const p6 = grid[(y + 1) * w + x];
  const p7 = grid[(y + 1) * w + x - 1];
  const p8 = grid[y * w + x - 1];
  const p9 = grid[(y - 1) * w + x - 1];

  let a = 0;
  if (p2 == 0 && p3 == 1) a++;
  if (p3 == 0 && p4 == 1) a++;
  if (p4 == 0 && p5 == 1) a++;
  if (p5 == 0 && p6 == 1) a++;
  if (p6 == 0 && p7 == 1) a++;
  if (p7 == 0 && p8 == 1) a++;
  if (p8 == 0 && p9 == 1) a++;
  if (p9 == 0 && p2 == 1) a++;

  const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
  return (b >= 2 && b <= 6 && a === 1 && (p2 * p4 * p8 === 0) && (p2 * p6 * p8 === 0));
}

// ─── Coordinate Scaling ───────────────────────────────────────────────────────

function scalePolylines(polylines: VectorPolyline[], settings: any, imgW: number, imgH: number): VectorPolyline[] {
  const targetW = settings.targetWidth || 100;
  const targetH = settings.targetHeight || 100;
  const scaleX = targetW / imgW;
  const scaleY = targetH / imgH;

  return polylines.map(poly => ({
    ...poly,
    points: poly.points.map(pt => ({ ...pt, x: pt.x * scaleX, y: pt.y * scaleY }))
  }));
}
