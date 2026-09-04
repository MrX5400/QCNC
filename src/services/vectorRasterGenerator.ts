import { MachineProfile, Point3D, RasterSettings } from '../types/cnc';
import { applyDragKnifeCompensation, DragKnifeParams, Path2DPoint, CompensatedPathResult } from './dragKnifeCorrection';
export * from './textVectorGenerator';
export * from './imageVectorTracer';
import { generateSingleLineTextPaths, generateUniversalTextPaths } from './textVectorGenerator';
import { traceImageToUniversalVectors } from './imageVectorTracer';

// Built-in Hershey Single-Line Font glyph strokes for ultra-crisp plotter text
export const HERSHEY_SIMPLEX_STROKES: Record<string, number[][]> = {
  'A': [[0, 0, 4, 12], [4, 12, 8, 0], [1.5, 4, 6.5, 4]],
  'B': [[0, 0, 0, 12], [0, 12, 5, 12, 7, 10, 7, 7, 5, 6, 0, 6], [5, 6, 7, 5, 7, 2, 5, 0, 0, 0]],
  'C': [[8, 10, 6, 12, 2, 12, 0, 10, 0, 2, 2, 0, 6, 0, 8, 2]],
  'D': [[0, 0, 0, 12], [0, 12, 4, 12, 8, 8, 8, 4, 4, 0, 0, 0]],
  'E': [[0, 0, 0, 12], [0, 12, 7, 12], [0, 6, 5, 6], [0, 0, 7, 0]],
  'F': [[0, 0, 0, 12], [0, 12, 7, 12], [0, 6, 5, 6]],
  'G': [[8, 10, 6, 12, 2, 12, 0, 10, 0, 2, 2, 0, 6, 0, 8, 2, 8, 6, 4, 6]],
  'H': [[0, 0, 0, 12], [8, 0, 8, 12], [0, 6, 8, 6]],
  'I': [[2, 12, 6, 12], [4, 12, 4, 0], [2, 0, 6, 0]],
  'J': [[6, 12, 6, 3, 4, 0, 2, 0, 0, 2]],
  'K': [[0, 0, 0, 12], [7, 12, 0, 5], [2, 6.5, 7, 0]],
  'L': [[0, 12, 0, 0, 7, 0]],
  'M': [[0, 0, 0, 12, 4, 5, 8, 12, 8, 0]],
  'N': [[0, 0, 0, 12, 8, 0, 8, 12]],
  'O': [[2, 12, 6, 12, 8, 10, 8, 2, 6, 0, 2, 0, 0, 2, 0, 10, 2, 12]],
  'P': [[0, 0, 0, 12, 5, 12, 7, 10, 7, 7, 5, 5, 0, 5]],
  'Q': [[2, 12, 6, 12, 8, 10, 8, 2, 6, 0, 2, 0, 0, 2, 0, 10, 2, 12], [5, 3, 9, -2]],
  'R': [[0, 0, 0, 12, 5, 12, 7, 10, 7, 7, 5, 5, 0, 5], [3, 5, 8, 0]],
  'S': [[8, 10, 6, 12, 2, 12, 0, 10, 0, 7, 2, 6, 6, 5, 8, 4, 8, 2, 6, 0, 2, 0, 0, 2]],
  'T': [[0, 12, 8, 12], [4, 12, 4, 0]],
  'U': [[0, 12, 0, 3, 2, 0, 6, 0, 8, 3, 8, 12]],
  'V': [[0, 12, 4, 0, 8, 12]],
  'W': [[0, 12, 2, 0, 4, 7, 6, 0, 8, 12]],
  'X': [[0, 12, 8, 0], [0, 0, 8, 12]],
  'Y': [[0, 12, 4, 6, 4, 0], [8, 12, 4, 6]],
  'Z': [[0, 12, 8, 12, 0, 0, 8, 0]],
  '0': [[2, 12, 6, 12, 8, 10, 8, 2, 6, 0, 2, 0, 0, 2, 0, 10, 2, 12], [7, 10, 1, 2]],
  '1': [[1, 9, 4, 12, 4, 0], [1, 0, 7, 0]],
  '2': [[0, 10, 2, 12, 6, 12, 8, 10, 8, 7, 0, 0, 8, 0]],
  '3': [[0, 12, 8, 12, 4, 7, 7, 5, 7, 2, 5, 0, 1, 0]],
  '4': [[6, 0, 6, 12, 0, 4, 8, 4]],
  '5': [[8, 12, 0, 12, 0, 7, 6, 7, 8, 5, 8, 2, 6, 0, 1, 0]],
  '6': [[7, 11, 4, 12, 1, 9, 0, 5, 0, 2, 2, 0, 6, 0, 8, 2, 8, 5, 6, 7, 0, 7]],
  '7': [[0, 12, 8, 12, 3, 0]],
  '8': [[4, 6, 2, 6, 0, 8, 0, 10, 2, 12, 6, 12, 8, 10, 8, 8, 6, 6, 4, 6], [4, 6, 2, 6, 0, 4, 0, 2, 2, 0, 6, 0, 8, 2, 8, 4, 6, 6, 4, 6]],
  '9': [[8, 5, 2, 5, 0, 7, 0, 10, 2, 12, 6, 12, 8, 10, 8, 2, 6, 0, 2, 0, 0, 2]],
  '.': [[3.5, 0, 4.5, 0]],
  ',': [[4, 0, 2, -2]],
  ':': [[4, 3, 4, 3.5], [4, 8, 4, 8.5]],
  '-': [[1, 6, 7, 6]],
  '+': [[1, 6, 7, 6], [4, 3, 4, 9]],
  '/': [[0, 0, 8, 12]],
  '!': [[4, 12, 4, 4], [4, 1, 4, 0]],
  '?': [[1, 9, 3, 12, 6, 12, 7, 10, 7, 7, 4, 5, 4, 3], [4, 1, 4, 0]],
  '#': [[2, 0, 2, 12], [6, 0, 6, 12], [0, 4, 8, 4], [0, 8, 8, 8]],
  '%': [[1, 10, 3, 10, 3, 12, 1, 12, 1, 10], [0, 0, 8, 12], [5, 0, 7, 0, 7, 2, 5, 2, 5, 0]],
  '(': [[6, 12, 3, 9, 3, 3, 6, 0]],
  ')': [[2, 12, 5, 9, 5, 3, 2, 0]],
  ' ': []
};

export interface VectorPolyline {
  points: Path2DPoint[];
  closed: boolean;
  color?: string;
  toolPower?: number; // S-value for laser
}

export type GeneratorTargetMode = 'pen' | 'dragknife' | 'laser';

export interface PenModeOptions {
  actuatorType?: 'z_stepper' | 'servo_pwm' | 'custom';
  drawingFeedrate: number;
  travelFeedrate: number;
  penUpCommand: string;
  penDownCommand: string;
  penUpDelayMs: number;
  penDownDelayMs: number;
  passes: number;
  zLiftHeight?: number;
  zCutDepth?: number;
  penUpZ?: number;
  penDownZ?: number;
  plungeFeedrate?: number;
  servoUpValue?: number;
  servoDownValue?: number;
  servoDelayMs?: number;
}

export interface DragKnifeModeOptions {
  actuatorType?: 'z_stepper' | 'servo' | 'custom';
  bladeOffset: number;
  swivelAngleThreshold: number;
  swivelFeedrate: number;
  cuttingFeedrate: number;
  travelFeedrate: number;
  overcut: number;
  liftOnSwivel: boolean;
  liftAmount: number;
  liftOnRapid: boolean;
  rapidLiftZ: number;
  swivelLiftZ?: number;
  arcMode?: 'g2_g3' | 'linear_g1';
  penUpCommand: string;
  penDownCommand: string;
  servoUpValue?: number;
  servoDownValue?: number;
  servoDelayMs?: number;
  penUpZ?: number;
  penDownZ?: number;
  plungeFeedrate?: number;
}

export interface LaserModeOptions {
  laserMode: 'M3' | 'M4';
  powerMin: number;
  powerMax: number;
  feedrate: number;
  travelFeedrate: number;
  passes: number;
  zStepdown: number;
  airAssist: boolean;
  kerfOffset: number;
  startGcode?: string;
  endGcode?: string;
  laserOnCommand?: string;
  laserOffCommand?: string;
}

/**
 * Generates single-line Hershey stroke paths for text
 */
export function generateHersheyText(text: string, x: number, y: number, fontSize: number = 10): VectorPolyline[] {
  const polylines: VectorPolyline[] = [];
  const scale = fontSize / 12;
  const charSpacing = 10 * scale;
  let cursorX = x;

  for (let i = 0; i < text.length; i++) {
    const char = text[i].toUpperCase();
    const strokes = HERSHEY_SIMPLEX_STROKES[char] || HERSHEY_SIMPLEX_STROKES[' '];

    if (strokes && strokes.length > 0) {
      for (const stroke of strokes) {
        const pts: Path2DPoint[] = [];
        for (let s = 0; s < stroke.length; s += 2) {
          pts.push({
            x: cursorX + stroke[s] * scale,
            y: y + stroke[s + 1] * scale,
          });
        }
        if (pts.length > 1) {
          polylines.push({ points: pts, closed: false });
        }
      }
    }
    cursorX += charSpacing;
  }

  return polylines;
}

export type PathOrderStrategy = 'fastest' | 'inside_to_outside' | 'outside_to_inside';
export type ObjectOrderMode = 'object_by_object' | 'fastest_global';

// Polygon area calculation (Shoelace formula) for contour nesting analysis
function getPolylineArea(p: VectorPolyline): number {
  if (!p.points || p.points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < p.points.length; i++) {
    const j = (i + 1) % p.points.length;
    area += p.points[i].x * p.points[j].y;
    area -= p.points[j].x * p.points[i].y;
  }
  return Math.abs(area) / 2;
}

function getPolylineBounds(p: VectorPolyline) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  if (!p.points || p.points.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0, area: 0, polyArea: 0 };
  p.points.forEach(pt => {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  });
  const width = Math.max(0, maxX - minX);
  const height = Math.max(0, maxY - minY);
  const bboxArea = width * height;
  const polyArea = p.closed ? getPolylineArea(p) : bboxArea * 0.5;
  return { minX, maxX, minY, maxY, width, height, bboxArea, polyArea };
}

/**
 * Optimizes order of polylines using:
 * - 'fastest': Nearest Neighbor (Greedy TSP) to minimize pen-up travel
 * - 'inside_to_outside': Inner enclosed contours/holes cut first, then outer boundaries
 * - 'outside_to_inside': Outer boundary contours cut first, then inner contours
 */
export function optimizePathOrder(
  paths: VectorPolyline[],
  strategy: PathOrderStrategy = 'fastest',
  startPosition: Path2DPoint = { x: 0, y: 0 }
): VectorPolyline[] {
  if (paths.length <= 1) {
    if (paths.length === 1 && paths[0].closed && paths[0].points.length > 2) {
      const p = paths[0];
      const pts = p.points[0].x === p.points[p.points.length - 1].x && p.points[0].y === p.points[p.points.length - 1].y
        ? p.points.slice(0, -1)
        : p.points;
      let bestK = 0;
      let minD = Infinity;
      for (let k = 0; k < pts.length; k++) {
        const d = Math.hypot(pts[k].x - startPosition.x, pts[k].y - startPosition.y);
        if (d < minD) {
          minD = d;
          bestK = k;
        }
      }
      if (bestK > 0) {
        const rotated = [...pts.slice(bestK), ...pts.slice(0, bestK)];
        rotated.push({ ...rotated[0] });
        return [{ ...p, points: rotated }];
      }
    }
    return paths;
  }

  // Helper to rotate closed polygon vertices so it starts at the vertex closest to target
  const optimizeClosedPolyStart = (p: VectorPolyline, target: Path2DPoint): VectorPolyline => {
    if (!p.closed || !p.points || p.points.length <= 2) return p;
    const isFirstEqualsLast = Math.hypot(
      p.points[0].x - p.points[p.points.length - 1].x,
      p.points[0].y - p.points[p.points.length - 1].y
    ) < 0.001;
    const uniquePts = isFirstEqualsLast ? p.points.slice(0, -1) : [...p.points];
    if (uniquePts.length < 3) return p;

    let bestK = 0;
    let minD = Infinity;
    for (let k = 0; k < uniquePts.length; k++) {
      const d = Math.hypot(uniquePts[k].x - target.x, uniquePts[k].y - target.y);
      if (d < minD) {
        minD = d;
        bestK = k;
      }
    }

    if (bestK === 0) {
      if (!isFirstEqualsLast) {
        return { ...p, points: [...uniquePts, { ...uniquePts[0] }] };
      }
      return p;
    }

    const rotated = [...uniquePts.slice(bestK), ...uniquePts.slice(0, bestK)];
    rotated.push({ ...rotated[0] });
    return { ...p, points: rotated };
  };

  // Helper to find min distance to a path (considering reversing and closed polygon vertex rotation)
  const getMinDistanceToPath = (p: VectorPolyline, currentPos: Path2DPoint) => {
    if (!p.points || p.points.length === 0) return { d: Infinity, reverse: false };
    
    if (p.closed) {
      let minD = Infinity;
      const limit = (p.points[0].x === p.points[p.points.length - 1].x && p.points[0].y === p.points[p.points.length - 1].y) ? p.points.length - 1 : p.points.length;
      for (let k = 0; k < limit; k++) {
        const d = Math.hypot(p.points[k].x - currentPos.x, p.points[k].y - currentPos.y);
        if (d < minD) minD = d;
      }
      return { d: minD, reverse: false };
    } else {
      const dStart = Math.hypot(p.points[0].x - currentPos.x, p.points[0].y - currentPos.y);
      const dEnd = Math.hypot(p.points[p.points.length - 1].x - currentPos.x, p.points[p.points.length - 1].y - currentPos.y);
      if (dStart <= dEnd) return { d: dStart, reverse: false };
      else return { d: dEnd, reverse: true };
    }
  };

  if (strategy === 'inside_to_outside' || strategy === 'outside_to_inside') {
    const pathsWithMeta = paths.map((p, idx) => ({
      path: p,
      idx,
      bounds: getPolylineBounds(p),
    }));

    if (strategy === 'inside_to_outside') {
      // Inner contours (smaller area) cut FIRST, outer boundaries cut LAST
      pathsWithMeta.sort((a, b) => a.bounds.polyArea - b.bounds.polyArea);
    } else {
      // Outer boundaries cut FIRST, inner contours cut LAST
      pathsWithMeta.sort((a, b) => b.bounds.polyArea - a.bounds.polyArea);
    }

    const remaining = [...pathsWithMeta];
    const ordered: VectorPolyline[] = [];
    let currentPos: Path2DPoint = { ...startPosition };

    while (remaining.length > 0) {
      // Use a smaller tier size to better respect the area ordering while still allowing TSP for similar areas
      const tierSize = Math.min(remaining.length, Math.max(1, Math.ceil(pathsWithMeta.length * 0.15)));
      let bestIdx = 0;
      let minDistance = Infinity;
      let reversePath = false;

      for (let i = 0; i < tierSize; i++) {
        const p = remaining[i].path;
        const { d, reverse } = getMinDistanceToPath(p, currentPos);
        if (d < minDistance) {
          minDistance = d;
          bestIdx = i;
          reversePath = reverse;
        }
      }

      const nextItem = remaining.splice(bestIdx, 1)[0];
      let nextPath = { ...nextItem.path, points: [...nextItem.path.points] };
      if (reversePath && !nextPath.closed) {
        nextPath.points.reverse();
      } else if (nextPath.closed) {
        nextPath = optimizeClosedPolyStart(nextPath, currentPos);
      }
      ordered.push(nextPath);

      currentPos = nextPath.closed
        ? nextPath.points[0]
        : nextPath.points[nextPath.points.length - 1];
    }

    return ordered;
  }

  // Standard Fastest (Greedy Nearest Neighbor TSP)
  const remaining = paths.map(p => ({ ...p, points: [...p.points] }));
  const ordered: VectorPolyline[] = [];
  let currentPos: Path2DPoint = { ...startPosition };

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let minDistance = Infinity;
    let reversePath = false;

    for (let i = 0; i < remaining.length; i++) {
      const p = remaining[i];
      const { d, reverse } = getMinDistanceToPath(p, currentPos);
      if (d < minDistance) {
        minDistance = d;
        nearestIndex = i;
        reversePath = reverse;
      }
    }

    let nextPath = remaining.splice(nearestIndex, 1)[0];
    if (reversePath && !nextPath.closed) {
      nextPath.points.reverse();
    } else if (nextPath.closed) {
      nextPath = optimizeClosedPolyStart(nextPath, currentPos);
    }

    ordered.push(nextPath);
    currentPos = nextPath.closed
      ? nextPath.points[0]
      : nextPath.points[nextPath.points.length - 1];
  }

  return ordered;
}

/**
 * Computes optimized polylines and object groups in exact execution order
 */
export function getOptimizedPolylinesAndGroups(options: {
  groups?: UniversalGcodeGroup[];
  polylines?: VectorPolyline[];
  optimizeOrder?: boolean;
  objectOrderMode?: ObjectOrderMode;
  pathOrderStrategy?: PathOrderStrategy;
}): {
  orderedGroups: UniversalGcodeGroup[];
  orderedPolylines: VectorPolyline[];
} {
  const {
    groups,
    polylines,
    optimizeOrder = true,
    objectOrderMode = 'object_by_object',
    pathOrderStrategy = 'fastest',
  } = options;

  let effectiveGroups: UniversalGcodeGroup[] = (groups && groups.length > 0)
    ? groups.map(g => ({ ...g, polylines: [...g.polylines] }))
    : (polylines && polylines.length > 0 ? [{ name: 'Objekt 1', polylines: [...polylines] }] : []);

  if (objectOrderMode === 'fastest_global' && effectiveGroups.length > 1) {
    const allPolys = effectiveGroups.flatMap(g => g.polylines);
    effectiveGroups = [{ name: 'Globale Gesamtkontur', polylines: allPolys }];
  }

  const orderedGroups: UniversalGcodeGroup[] = [];
  const orderedPolylines: VectorPolyline[] = [];
  let runningPos: Path2DPoint = { x: 0, y: 0 };

  for (let gIdx = 0; gIdx < effectiveGroups.length; gIdx++) {
    const grp = effectiveGroups[gIdx];
    let groupPaths = grp.polylines;
    if (optimizeOrder) {
      groupPaths = optimizePathOrder(groupPaths, pathOrderStrategy, runningPos);
    }
    orderedGroups.push({
      ...grp,
      polylines: groupPaths,
    });
    groupPaths.forEach(p => {
      orderedPolylines.push(p);
      if (p.points && p.points.length > 0) {
        runningPos = p.closed ? p.points[0] : p.points[p.points.length - 1];
      }
    });
  }

  return { orderedGroups, orderedPolylines };
}

/**
 * Converts standard geometric shapes into polylines
 */
export function generateShapePaths(shape: {
  type: 'rect' | 'circle' | 'star' | 'polygon' | 'grid' | 'spiral';
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  sides?: number;
}): VectorPolyline[] {
  const { type, x, y, width = 40, height = 30, radius = 20, sides = 5 } = shape;

  if (type === 'rect') {
    return [{
      points: [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
        { x, y }
      ],
      closed: true,
    }];
  }

  if (type === 'circle') {
    const pts: Path2DPoint[] = [];
    const segments = 48;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * 2 * Math.PI;
      pts.push({
        x: x + radius * Math.cos(angle),
        y: y + radius * Math.sin(angle),
      });
    }
    return [{ points: pts, closed: true }];
  }

  if (type === 'star') {
    const pts: Path2DPoint[] = [];
    const pointsCount = 5;
    const innerRadius = radius * 0.4;
    for (let i = 0; i <= pointsCount * 2; i++) {
      const angle = (i / (pointsCount * 2)) * 2 * Math.PI - Math.PI / 2;
      const r = i % 2 === 0 ? radius : innerRadius;
      pts.push({
        x: x + r * Math.cos(angle),
        y: y + r * Math.sin(angle),
      });
    }
    return [{ points: pts, closed: true }];
  }

  if (type === 'polygon') {
    const pts: Path2DPoint[] = [];
    const n = Math.max(3, sides);
    for (let i = 0; i <= n; i++) {
      const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
      pts.push({
        x: x + radius * Math.cos(angle),
        y: y + radius * Math.sin(angle),
      });
    }
    return [{ points: pts, closed: true }];
  }

  if (type === 'grid') {
    const polylines: VectorPolyline[] = [];
    const step = 10;
    const w = width || 60;
    const h = height || 60;

    // Horizontal lines
    for (let curY = y; curY <= y + h; curY += step) {
      polylines.push({
        points: [{ x, y: curY }, { x: x + w, y: curY }],
        closed: false,
      });
    }
    // Vertical lines
    for (let curX = x; curX <= x + w; curX += step) {
      polylines.push({
        points: [{ x: curX, y }, { x: curX, y: y + h }],
        closed: false,
      });
    }
    return polylines;
  }

  if (type === 'spiral') {
    const pts: Path2DPoint[] = [];
    const maxTheta = 6 * Math.PI; // 3 turns
    const b = (radius || 25) / maxTheta;
    const steps = 120;
    for (let i = 0; i <= steps; i++) {
      const theta = (i / steps) * maxTheta;
      const r = b * theta;
      pts.push({
        x: x + r * Math.cos(theta),
        y: y + r * Math.sin(theta),
      });
    }
    return [{ points: pts, closed: false }];
  }

  return [];
}

/**
 * Parses SVG string into vector polylines
 */
export function parseSvgToPolylines(svgString: string, targetBedWidth: number = 200, targetBedHeight: number = 200): VectorPolyline[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgEl = doc.querySelector('svg');
  if (!svgEl) return [];

  const polylines: VectorPolyline[] = [];

  // Parse SVG paths, rects, circles, lines, polylines
  const elements = svgEl.querySelectorAll('path, rect, circle, ellipse, line, polyline, polygon');

  elements.forEach((el) => {
    const tag = el.tagName.toLowerCase();

    if (tag === 'rect') {
      const rx = parseFloat(el.getAttribute('x') || '0');
      const ry = parseFloat(el.getAttribute('y') || '0');
      const rw = parseFloat(el.getAttribute('width') || '0');
      const rh = parseFloat(el.getAttribute('height') || '0');
      if (rw > 0 && rh > 0) {
        polylines.push({
          points: [
            { x: rx, y: ry },
            { x: rx + rw, y: ry },
            { x: rx + rw, y: ry + rh },
            { x: rx, y: ry + rh },
            { x: rx, y: ry },
          ],
          closed: true,
        });
      }
    } else if (tag === 'circle') {
      const cx = parseFloat(el.getAttribute('cx') || '0');
      const cy = parseFloat(el.getAttribute('cy') || '0');
      const r = parseFloat(el.getAttribute('r') || '0');
      if (r > 0) {
        const pts: Path2DPoint[] = [];
        for (let a = 0; a <= 36; a++) {
          const rad = (a / 36) * Math.PI * 2;
          pts.push({ x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) });
        }
        polylines.push({ points: pts, closed: true });
      }
    } else if (tag === 'line') {
      const x1 = parseFloat(el.getAttribute('x1') || '0');
      const y1 = parseFloat(el.getAttribute('y1') || '0');
      const x2 = parseFloat(el.getAttribute('x2') || '0');
      const y2 = parseFloat(el.getAttribute('y2') || '0');
      polylines.push({ points: [{ x: x1, y: y1 }, { x: x2, y: y2 }], closed: false });
    } else if (tag === 'polyline' || tag === 'polygon') {
      const pointsAttr = el.getAttribute('points') || '';
      const rawPairs = pointsAttr.trim().split(/[\s,]+/);
      const pts: Path2DPoint[] = [];
      for (let p = 0; p < rawPairs.length - 1; p += 2) {
        const px = parseFloat(rawPairs[p]);
        const py = parseFloat(rawPairs[p + 1]);
        if (!isNaN(px) && !isNaN(py)) {
          pts.push({ x: px, y: py });
        }
      }
      if (pts.length > 1) {
        if (tag === 'polygon') {
          pts.push({ ...pts[0] });
          polylines.push({ points: pts, closed: true });
        } else {
          polylines.push({ points: pts, closed: false });
        }
      }
    } else if (tag === 'path') {
      const d = el.getAttribute('d') || '';
      const parsedPath = parseSvgPathD(d);
      polylines.push(...parsedPath);
    }
  });

  // Calculate bounding box and scale to fit nicely on the plotter bed
  if (polylines.length > 0) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    polylines.forEach(p => {
      p.points.forEach(pt => {
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
      });
    });

    const w = maxX - minX;
    const h = maxY - minY;
    if (w > 0 && h > 0) {
      const scale = Math.min((targetBedWidth * 0.75) / w, (targetBedHeight * 0.75) / h, 1.0);
      const offsetX = (targetBedWidth - w * scale) / 2 - minX * scale;
      const offsetY = (targetBedHeight - h * scale) / 2 - minY * scale;

      polylines.forEach(p => {
        p.points.forEach(pt => {
          pt.x = pt.x * scale + offsetX;
          pt.y = targetBedHeight - (pt.y * scale + offsetY); // Flip Y to standard CNC cartesian
        });
      });
    }
  }

  return polylines;
}

/**
 * Basic SVG Path 'd' parameter tokenizer & linearizer
 */
function parseSvgPathD(d: string): VectorPolyline[] {
  const result: VectorPolyline[] = [];
  const commands = d.match(/[a-df-z][^a-df-z]*/ig) || [];

  let currentPoint: Path2DPoint = { x: 0, y: 0 };
  let pathStartPoint: Path2DPoint = { x: 0, y: 0 };
  let currentPolyline: Path2DPoint[] = [];

  for (const cmdStr of commands) {
    const type = cmdStr[0];
    const isRel = type === type.toLowerCase();
    const cmdUpper = type.toUpperCase();
    const args = (cmdStr.slice(1).match(/[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/g) || []).map(Number);

    if (cmdUpper === 'M') {
      for (let i = 0; i < args.length; i += 2) {
        let x = args[i];
        let y = args[i + 1];
        if (isRel) {
          x += currentPoint.x;
          y += currentPoint.y;
        }
        if (i === 0) {
          if (currentPolyline.length > 1) {
            result.push({ points: currentPolyline, closed: false });
          }
          currentPolyline = [{ x, y }];
          pathStartPoint = { x, y };
        } else {
          currentPolyline.push({ x, y });
        }
        currentPoint = { x, y };
      }
    } else if (cmdUpper === 'L') {
      for (let i = 0; i < args.length; i += 2) {
        let x = args[i];
        let y = args[i + 1];
        if (isRel) {
          x += currentPoint.x;
          y += currentPoint.y;
        }
        currentPolyline.push({ x, y });
        currentPoint = { x, y };
      }
    } else if (cmdUpper === 'H') {
      for (const val of args) {
        const x = isRel ? currentPoint.x + val : val;
        currentPolyline.push({ x, y: currentPoint.y });
        currentPoint.x = x;
      }
    } else if (cmdUpper === 'V') {
      for (const val of args) {
        const y = isRel ? currentPoint.y + val : val;
        currentPolyline.push({ x: currentPoint.x, y });
        currentPoint.y = y;
      }
    } else if (cmdUpper === 'C') {
      for (let i = 0; i < args.length; i += 6) {
        let cp1x = args[i], cp1y = args[i + 1];
        let cp2x = args[i + 2], cp2y = args[i + 3];
        let ex = args[i + 4], ey = args[i + 5];

        if (isRel) {
          cp1x += currentPoint.x; cp1y += currentPoint.y;
          cp2x += currentPoint.x; cp2y += currentPoint.y;
          ex += currentPoint.x; ey += currentPoint.y;
        }

        const steps = 10;
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          const u = 1 - t;
          const px = u*u*u*currentPoint.x + 3*u*u*t*cp1x + 3*u*t*t*cp2x + t*t*t*ex;
          const py = u*u*u*currentPoint.y + 3*u*u*t*cp1y + 3*u*t*t*cp2y + t*t*t*ey;
          currentPolyline.push({ x: px, y: py });
        }
        currentPoint = { x: ex, y: ey };
      }
    } else if (cmdUpper === 'Q') {
      for (let i = 0; i < args.length; i += 4) {
        let cpx = args[i], cpy = args[i + 1];
        let ex = args[i + 2], ey = args[i + 3];
        if (isRel) {
          cpx += currentPoint.x; cpy += currentPoint.y;
          ex += currentPoint.x; ey += currentPoint.y;
        }
        const steps = 8;
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          const u = 1 - t;
          const px = u*u*currentPoint.x + 2*u*t*cpx + t*t*ex;
          const py = u*u*currentPoint.y + 2*u*t*cpy + t*t*ey;
          currentPolyline.push({ x: px, y: py });
        }
        currentPoint = { x: ex, y: ey };
      }
    } else if (cmdUpper === 'Z') {
      if (currentPolyline.length > 0) {
        currentPolyline.push({ ...pathStartPoint });
        result.push({ points: currentPolyline, closed: true });
        currentPolyline = [];
        currentPoint = { ...pathStartPoint };
      }
    }
  }

  if (currentPolyline.length > 1) {
    result.push({ points: currentPolyline, closed: false });
  }

  return result;
}

/**
 * Douglas-Peucker Polyline Simplification Algorithm
 */
function simplifyPolyline(points: Path2DPoint[], tolerance: number): Path2DPoint[] {
  if (points.length <= 2) return points;

  const sqTolerance = tolerance * tolerance;

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
  return simplified;
}

/**
 * Traces contours of black & white image using Marching Squares with ultra-fast O(N) adjacency map
 */
function traceImageContours(
  grid: boolean[][],
  gridW: number,
  gridH: number,
  scaleX: number,
  scaleY: number,
  targetHeight: number,
  simplificationTolerance: number = 0.5
): VectorPolyline[] {
  type Segment = { p1: Path2DPoint; p2: Path2DPoint };
  const segments: Segment[] = [];

  // Marching squares cell edge segments
  for (let y = 0; y < gridH - 1; y++) {
    for (let x = 0; x < gridW - 1; x++) {
      const tl = grid[y][x];
      const tr = grid[y][x + 1];
      const br = grid[y + 1][x + 1];
      const bl = grid[y + 1][x];

      const caseId = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
      if (caseId === 0 || caseId === 15) continue;

      // Midpoints of cell edges
      const top: Path2DPoint = { x: x + 0.5, y: y };
      const right: Path2DPoint = { x: x + 1, y: y + 0.5 };
      const bottom: Path2DPoint = { x: x + 0.5, y: y + 1 };
      const left: Path2DPoint = { x: x, y: y + 0.5 };

      switch (caseId) {
        case 1:  // bottom-left
        case 14:
          segments.push({ p1: left, p2: bottom });
          break;
        case 2:  // bottom-right
        case 13:
          segments.push({ p1: bottom, p2: right });
          break;
        case 3:  // bottom edge
        case 12:
          segments.push({ p1: left, p2: right });
          break;
        case 4:  // top-right
        case 11:
          segments.push({ p1: top, p2: right });
          break;
        case 5:  // saddle (diag bl & tr)
          segments.push({ p1: left, p2: top });
          segments.push({ p1: bottom, p2: right });
          break;
        case 6:  // right edge
        case 9:
          segments.push({ p1: top, p2: bottom });
          break;
        case 7:  // all except tl
        case 8:
          segments.push({ p1: left, p2: top });
          break;
        case 10: // saddle (diag tl & br)
          segments.push({ p1: top, p2: right });
          segments.push({ p1: left, p2: bottom });
          break;
      }
    }
  }

  if (segments.length === 0) return [];

  // Limit max segments to avoid extreme memory / freeze on very noisy images
  const maxSegments = Math.min(segments.length, 16000);
  const activeSegments = segments.length > maxSegments ? segments.slice(0, maxSegments) : segments;

  // Build O(N) adjacency graph by quantizing half-integer grid coordinates (multiply by 2)
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

  // Link segments into continuous polylines in O(N) time
  const polylines: VectorPolyline[] = [];
  const usedSegs = new Uint8Array(activeSegments.length);
  const ptDistSq = (a: Path2DPoint, b: Path2DPoint) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);

  for (let i = 0; i < activeSegments.length; i++) {
    if (usedSegs[i]) continue;
    usedSegs[i] = 1;

    const currentLine: Path2DPoint[] = [activeSegments[i].p1, activeSegments[i].p2];
    let currentTail = activeSegments[i].p2;

    // Follow forward path with safety step limiter
    let steps = 0;
    while (steps++ < 10000) {
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

    // Check if closed
    const isClosed = ptDistSq(currentLine[0], currentLine[currentLine.length - 1]) < 0.01;

    // Convert to millimeter coordinates (CNC Cartesian, Y flipped)
    const mmPoints = currentLine.map((pt) => ({
      x: pt.x * scaleX,
      y: targetHeight - (pt.y * scaleY),
    }));

    if (mmPoints.length >= 2) {
      const simplified = simplifyPolyline(mmPoints, simplificationTolerance);
      if (simplified.length >= 2) {
        polylines.push({ points: simplified, closed: isClosed });
      }
    }
  }

  return polylines;
}

/**
 * Generates plotter vector paths from an Image Canvas (Raster to Vector)
 */
export function generateRasterToVectorPaths(
  canvas: HTMLCanvasElement,
  settings: RasterSettings,
  maxGridDimension?: number
): VectorPolyline[] {
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  const { width: imgW, height: imgH } = canvas;
  const imgData = ctx.getImageData(0, 0, imgW, imgH);
  const data = imgData.data;

  const {
    mode,
    resolution,
    angle,
    brightness,
    contrast,
    threshold,
    blackLevel = 0,
    whiteLevel = 255,
    gamma = 1.0,
    mirrorX = false,
    mirrorY = false,
    invert,
    targetWidth,
    targetHeight,
  } = settings;

  const polylines: VectorPolyline[] = [];

  const getLuminance = (px: number, py: number): number => {
    // Handle mirroring / flips
    let sampleX = mirrorX ? (imgW - 1 - px) : px;
    let sampleY = mirrorY ? (imgH - 1 - py) : py;

    if (sampleX < 0 || sampleX >= imgW || sampleY < 0 || sampleY >= imgH) return 1.0;
    const idx = (Math.floor(sampleY) * imgW + Math.floor(sampleX)) * 4;
    let r = data[idx];
    let g = data[idx + 1];
    let b = data[idx + 2];

    // Apply brightness
    r += brightness * 2.55;
    g += brightness * 2.55;
    b += brightness * 2.55;

    // Apply contrast
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    r = factor * (r - 128) + 128;
    g = factor * (g - 128) + 128;
    b = factor * (b - 128) + 128;

    // Clamp RGB 0-255
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));

    let rawLum = (0.299 * r + 0.587 * g + 0.114 * b);

    // Apply Black & White Level scaling
    const minL = Math.min(blackLevel, whiteLevel - 1);
    const maxL = Math.max(whiteLevel, minL + 1);
    let scaledLum = (rawLum - minL) / (maxL - minL);
    scaledLum = Math.max(0, Math.min(1, scaledLum));

    // Apply Gamma Correction
    if (gamma && gamma !== 1.0 && gamma > 0.1) {
      scaledLum = Math.pow(scaledLum, 1 / gamma);
    }

    return invert ? 1 - scaledLum : scaledLum;
  };

  const scaleX = targetWidth / imgW;
  const scaleY = targetHeight / imgH;

  // --- VECTOR TRACING (CONTOUR OUTLINES & CENTERLINE SKELETONIZATION) ---
  if (mode === 'contour_trace' || mode === 'centerline_trace') {
    return traceImageToUniversalVectors(canvas, settings, maxGridDimension);
  }

  if (mode === 'hatch_linear' || mode === 'cross_hatch') {
    const lineSpacing = Math.max(0.3, 5 / Math.max(0.5, resolution)); // mm
    const anglesToProcess = mode === 'cross_hatch' ? [angle, angle + 90] : [angle];
    const diag = Math.hypot(targetWidth, targetHeight);
    const cx = targetWidth / 2;
    const cy = targetHeight / 2;
    const sampleStep = 0.4; // mm

    for (const curAngle of anglesToProcess) {
      const rad = (curAngle * Math.PI) / 180;
      const cosA = Math.cos(rad);
      const sinA = Math.sin(rad);
      const nx = -sinA;
      const ny = cosA;

      for (let d = -diag; d <= diag; d += lineSpacing) {
        const p0x = cx + nx * d;
        const p0y = cy + ny * d;
        let inStroke = false;
        let currentStroke: Path2DPoint[] = [];

        for (let t = -diag; t <= diag; t += sampleStep) {
          const xPos = p0x + cosA * t;
          const yPos = p0y + sinA * t;

          if (xPos >= 0 && xPos <= targetWidth && yPos >= 0 && yPos <= targetHeight) {
            const imgPx = xPos / scaleX;
            const imgPy = (targetHeight - yPos) / scaleY;

            const lum = getLuminance(imgPx, imgPy);
            const isDark = lum < (threshold / 255);

            if (isDark) {
              if (!inStroke) {
                inStroke = true;
                currentStroke = [{ x: Number(xPos.toFixed(3)), y: Number(yPos.toFixed(3)) }];
              } else {
                currentStroke.push({ x: Number(xPos.toFixed(3)), y: Number(yPos.toFixed(3)) });
              }
            } else {
              if (inStroke) {
                if (currentStroke.length > 1) {
                  polylines.push({ points: currentStroke, closed: false });
                }
                inStroke = false;
                currentStroke = [];
              }
            }
          } else {
            if (inStroke) {
              if (currentStroke.length > 1) {
                polylines.push({ points: currentStroke, closed: false });
              }
              inStroke = false;
              currentStroke = [];
            }
          }
        }

        if (inStroke && currentStroke.length > 1) {
          polylines.push({ points: currentStroke, closed: false });
        }
      }
    }
  } else if (mode === 'stipple_dither') {
    const dotSpacing = Math.max(0.6, 3.5 / resolution); // mm
    for (let y = 0; y < targetHeight; y += dotSpacing) {
      for (let x = 0; x < targetWidth; x += dotSpacing) {
        const imgPx = x / scaleX;
        const imgPy = (targetHeight - y) / scaleY;
        const lum = getLuminance(imgPx, imgPy);

        if (lum < (threshold / 255) && Math.random() > lum * 0.75) {
          polylines.push({
            points: [
              { x: x - 0.1, y },
              { x: x + 0.1, y },
            ],
            closed: false,
          });
        }
      }
    }
  } else if (mode === 'spiral_wave') {
    const numRows = Math.floor(targetHeight / (3 / resolution));
    const pts: Path2DPoint[] = [];

    for (let r = 0; r < numRows; r++) {
      const yBase = r * (targetHeight / numRows);
      const isReverse = r % 2 === 1;
      const numSamples = 220;

      for (let s = 0; s <= numSamples; s++) {
        const progress = isReverse ? (1 - s / numSamples) : (s / numSamples);
        const xPos = progress * targetWidth;

        const imgPx = xPos / scaleX;
        const imgPy = (targetHeight - yBase) / scaleY;
        const lum = getLuminance(imgPx, imgPy);

        const darkness = 1 - lum;
        const waveAmp = darkness * (targetHeight / numRows) * 0.95;
        const waveFreq = 20 + darkness * 40;
        const waveY = yBase + Math.sin(progress * waveFreq) * waveAmp;

        pts.push({ x: xPos, y: waveY });
      }
    }

    if (pts.length > 1) {
      polylines.push({ points: pts, closed: false });
    }
  }

  return polylines;
}

export interface UniversalGcodeGroup {
  name?: string;
  polylines: VectorPolyline[];
}

/**
 * Universal Comprehensive G-Code Generator supporting Pen Plotter, Drag Knife, and Laser Diode
 */
export function generateUniversalGcode(options: {
  polylines?: VectorPolyline[];
  groups?: UniversalGcodeGroup[];
  targetMode: GeneratorTargetMode;
  profile: MachineProfile;
  penOptions: PenModeOptions;
  dragKnifeOptions: DragKnifeModeOptions;
  laserOptions: LaserModeOptions;
  optimizeOrder?: boolean;
  objectOrderMode?: ObjectOrderMode;
  pathOrderStrategy?: PathOrderStrategy;
}): string {
  const {
    polylines,
    groups,
    targetMode,
    profile,
    penOptions,
    dragKnifeOptions,
    laserOptions,
    optimizeOrder = true,
    objectOrderMode = 'object_by_object',
    pathOrderStrategy = 'fastest'
  } = options;

  const { orderedGroups: effectiveGroups } = getOptimizedPolylinesAndGroups({
    groups,
    polylines,
    optimizeOrder,
    objectOrderMode,
    pathOrderStrategy,
  });

  const lines: string[] = [];
  lines.push(`; =========================================`);
  lines.push(`; PlotterCNC Studio - Universal G-Code`);
  lines.push(`; Mode: ${targetMode.toUpperCase()} | Profile: ${profile.name}`);
  lines.push(`; Date: ${new Date().toISOString()}`);
  lines.push(`; =========================================`);
  lines.push(`G90 ; Absolute Coordinates`);
  lines.push(`G21 ; Millimeters`);
  lines.push(`G17 ; XY Plane Selection`);

  // --- 1. DRAG KNIFE MODE ---
  if (targetMode === 'dragknife') {
    const dkGroups = effectiveGroups.map((g, gIdx) => ({
      name: g.name || `Objekt ${gIdx + 1}`,
      paths: g.polylines.map(p => ({ points: p.points, closed: p.closed })),
    }));

    const flatPaths = dkGroups.flatMap(g => g.paths);

    const compResult = applyDragKnifeCompensation(
      flatPaths,
      {
        bladeOffset: dragKnifeOptions.bladeOffset,
        swivelAngleThreshold: dragKnifeOptions.swivelAngleThreshold,
        swivelFeedrate: dragKnifeOptions.swivelFeedrate,
        cuttingFeedrate: dragKnifeOptions.cuttingFeedrate,
        travelFeedrate: dragKnifeOptions.travelFeedrate || profile.travelFeedrate || 3000,
        overcut: dragKnifeOptions.overcut,
        liftOnSwivel: dragKnifeOptions.liftOnSwivel,
        liftAmount: dragKnifeOptions.liftAmount,
        liftOnRapid: dragKnifeOptions.liftOnRapid,
        rapidLiftZ: dragKnifeOptions.rapidLiftZ,
        arcMode: dragKnifeOptions.arcMode || 'g2_g3',
        penUpCommand: dragKnifeOptions.penUpCommand,
        penDownCommand: dragKnifeOptions.penDownCommand,
      },
      dkGroups
    );
    return compResult.gcode.join('\n');
  }

  // --- 2. LASER MODE ---
  if (targetMode === 'laser') {
    if (laserOptions.startGcode && laserOptions.startGcode.trim()) {
      lines.push(laserOptions.startGcode.trim());
    }
    if (laserOptions.airAssist) {
      lines.push(`M8 ; Air Assist ON`);
    }
    const offCmd = laserOptions.laserOffCommand && laserOptions.laserOffCommand.trim() ? laserOptions.laserOffCommand.trim() : 'M5';
    lines.push(`${offCmd} ; Ensure Laser is OFF`);

    for (let gIdx = 0; gIdx < effectiveGroups.length; gIdx++) {
      const grp = effectiveGroups[gIdx];
      if (!grp.polylines || grp.polylines.length === 0) continue;

      const groupPaths = grp.polylines;
      const groupName = grp.name || `Objekt ${gIdx + 1}`;
      lines.push(`; [OBJECT_START] ${groupName}`);

      const passes = Math.max(1, laserOptions.passes || 1);
      for (let pass = 1; pass <= passes; pass++) {
        if (passes > 1) {
          lines.push(`; --- Pass ${pass} of ${passes} ---`);
          if (laserOptions.zStepdown > 0) {
            const zDepth = -(pass - 1) * laserOptions.zStepdown;
            lines.push(`G0 Z${zDepth.toFixed(3)} ; Step down`);
          }
        }

        for (const path of groupPaths) {
          if (!path.points || path.points.length < 2) continue;
          const startPt = path.points[0] as any;

          // Rapid to start (S0 ensures laser is off during rapid)
          lines.push(`G0 X${startPt.x.toFixed(3)} Y${startPt.y.toFixed(3)} S0 F${laserOptions.travelFeedrate}`);

          // Laser ON – use first point's s-value if available, else path.toolPower, else powerMax
          const initialPwr = startPt.s !== undefined ? startPt.s
            : (path.toolPower !== undefined ? path.toolPower : laserOptions.powerMax);
          const roundedPwr = Math.round(initialPwr);
          const onCmd = laserOptions.laserOnCommand && laserOptions.laserOnCommand.trim()
            ? laserOptions.laserOnCommand.replace(/\{S\}/gi, String(roundedPwr)).replace(/\{POWER\}/gi, String(roundedPwr))
            : `${laserOptions.laserMode} S${roundedPwr}`;
          lines.push(`${onCmd} ; Laser ON`);

          // Laser Cut Moves – pt.s is already in final [powerMin, powerMax] range from the worker
          for (let i = 1; i < path.points.length; i++) {
            const pt = path.points[i] as any;
            let moveCmd = `G1 X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)}`;
            if (pt.s !== undefined) {
              moveCmd += ` S${Math.round(pt.s)}`;
            }
            moveCmd += ` F${laserOptions.feedrate}`;
            lines.push(moveCmd);
          }

          // Close loop if closed path and not already at start
          if (path.closed) {
            const lastPt = path.points[path.points.length - 1];
            if (Math.hypot(lastPt.x - startPt.x, lastPt.y - startPt.y) > 0.001) {
              const closePwr = startPt.s !== undefined ? ` S${Math.round(startPt.s)}` : '';
              lines.push(`G1 X${startPt.x.toFixed(3)} Y${startPt.y.toFixed(3)}${closePwr} F${laserOptions.feedrate}`);
            }
          }

          // Laser OFF
          lines.push(`${offCmd} ; Laser OFF`);
        }
      }

      lines.push(`; [OBJECT_END]`);
    }

    if (laserOptions.airAssist) {
      lines.push(`M9 ; Air Assist OFF`);
    }
    if (laserOptions.endGcode && laserOptions.endGcode.trim()) {
      lines.push(laserOptions.endGcode.trim());
    } else {
      lines.push(`G0 X0.000 Y0.000 F${laserOptions.travelFeedrate} ; Return Home`);
      lines.push(`M2 ; End of Program`);
    }
    return lines.join('\n');
  }

  // --- 3. PEN PLOTTER MODE ---
  lines.push(penOptions.penUpCommand);
  if (penOptions.penUpDelayMs > 0) {
    lines.push(`G4 P${(penOptions.penUpDelayMs / 1000).toFixed(3)} ; Delay after Lift`);
  }

  for (let gIdx = 0; gIdx < effectiveGroups.length; gIdx++) {
    const grp = effectiveGroups[gIdx];
    if (!grp.polylines || grp.polylines.length === 0) continue;

    const groupPaths = grp.polylines;
    const groupName = grp.name || `Objekt ${gIdx + 1}`;
    lines.push(`; [OBJECT_START] ${groupName}`);

    const passes = Math.max(1, penOptions.passes || 1);
    for (let pass = 1; pass <= passes; pass++) {
      if (passes > 1) {
        lines.push(`; --- Pen Pass ${pass} of ${passes} ---`);
      }

      for (const path of groupPaths) {
        if (!path.points || path.points.length < 2) continue;
        const startPt = path.points[0];

        // Rapid to start
        lines.push(`G0 X${startPt.x.toFixed(3)} Y${startPt.y.toFixed(3)} F${penOptions.travelFeedrate}`);

        // Pen DOWN
        lines.push(penOptions.penDownCommand);
        if (penOptions.penDownDelayMs > 0) {
          lines.push(`G4 P${(penOptions.penDownDelayMs / 1000).toFixed(3)} ; Delay after Down`);
        }

        // Draw path lines
        for (let i = 1; i < path.points.length; i++) {
          const pt = path.points[i];
          lines.push(`G1 X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)} F${penOptions.drawingFeedrate}`);
        }

        // Close loop if closed path and not already at start
        if (path.closed) {
          const lastPt = path.points[path.points.length - 1];
          if (Math.hypot(lastPt.x - startPt.x, lastPt.y - startPt.y) > 0.001) {
            lines.push(`G1 X${startPt.x.toFixed(3)} Y${startPt.y.toFixed(3)} F${penOptions.drawingFeedrate}`);
          }
        }

        // Pen UP
        lines.push(penOptions.penUpCommand);
        if (penOptions.penUpDelayMs > 0) {
          lines.push(`G4 P${(penOptions.penUpDelayMs / 1000).toFixed(3)} ; Delay after Lift`);
        }
      }
    }

    lines.push(`; [OBJECT_END]`);
  }

  lines.push(`G0 X0.000 Y0.000 F${penOptions.travelFeedrate} ; Return Home`);
  lines.push(`M2 ; End of Program`);
  return lines.join('\n');
}

/**
 * Backward compatibility wrapper
 */
export function generateGcodeFromPolylines(
  polylines: VectorPolyline[],
  profile: MachineProfile,
  optimizeOrder: boolean = true
): string {
  return generateUniversalGcode({
    polylines,
    targetMode: profile.dragKnife?.enabled ? 'dragknife' : (profile.actuatorType === 'laser' ? 'laser' : 'pen'),
    profile,
    penOptions: {
      drawingFeedrate: profile.drawingFeedrate,
      travelFeedrate: profile.travelFeedrate,
      penUpCommand: profile.penUpCommand,
      penDownCommand: profile.penDownCommand,
      penUpDelayMs: profile.penUpDelayMs || 0,
      penDownDelayMs: profile.penDownDelayMs || 0,
      passes: 1,
    },
    dragKnifeOptions: {
      bladeOffset: profile.dragKnife?.bladeOffset || 0.45,
      swivelAngleThreshold: profile.dragKnife?.swivelAngleThreshold || 20,
      swivelFeedrate: profile.dragKnife?.feedrateSwivel || 600,
      cuttingFeedrate: profile.drawingFeedrate || 1200,
      travelFeedrate: profile.travelFeedrate || 3000,
      overcut: profile.dragKnife?.overcut || 1.0,
      liftOnSwivel: profile.dragKnife?.liftOnSwivel || false,
      liftAmount: profile.dragKnife?.liftAmount || 0.3,
      liftOnRapid: profile.dragKnife?.liftOnRapid ?? true,
      rapidLiftZ: profile.dragKnife?.rapidLiftZ ?? 3.0,
      penUpCommand: profile.penUpCommand,
      penDownCommand: profile.penDownCommand,
    },
    laserOptions: {
      laserMode: 'M4',
      powerMin: 0,
      powerMax: 1000,
      feedrate: profile.drawingFeedrate,
      travelFeedrate: profile.travelFeedrate,
      passes: 1,
      zStepdown: 0,
      airAssist: false,
      kerfOffset: 0.1,
    },
    optimizeOrder,
  });
}
