import { preprocessImage } from '../services/imagePreprocessor';
﻿/// <reference lib="webworker" />

import { VectorizeRequest, VectorizeResponse } from '../services/imageVectorizer';
import { VectorPolyline } from '../types/cnc';
import ImageTracer from 'imagetracerjs';
import * as ClipperLib from 'clipper-lib';

self.onmessage = async (e: MessageEvent<VectorizeRequest>) => {
  const { id, imageData, settings, width, height } = e.data;
  
  try {
    let polylines: VectorPolyline[] = [];
    

    // 1. Image Preprocessing (Alpha Blending, Brightness, Contrast, Threshold)
    const processedData = preprocessImage(imageData, settings);
    
    // 2. Vectorization based on mode
    if (settings.mode === 'potrace' || settings.mode === 'contour_trace') {
      polylines = traceOutlines(processedData, settings);
    } else if (settings.mode === 'centerline' || settings.mode === 'centerline_trace') {
      polylines = traceCenterline(processedData, settings);
    } else if (settings.mode === 'hatch' || settings.mode === 'cross_hatch' || settings.mode === 'hatch_linear') {
      const outlines = traceOutlines(processedData, settings);
      polylines = generateHatching(outlines, settings);
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

function computePolylineLength(points: {x: number, y: number}[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i-1].x, points[i].y - points[i-1].y);
  }
  return len;
}



function adaptiveQuadraticBezier(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, toleranceSq: number, points: {x: number, y: number}[], depth: number = 0) {
  if (depth > 12) {
    points.push({x: x2, y: y2});
    return;
  }
  
  // Calculate midpoints of the quadratic bezier
  const q0x = (x0 + x1) / 2;
  const q0y = (y0 + y1) / 2;
  const q1x = (x1 + x2) / 2;
  const q1y = (y1 + y2) / 2;
  const qmx = (q0x + q1x) / 2;
  const qmy = (q0y + q1y) / 2;
  
  // Calculate midpoint of the straight line
  const lx = (x0 + x2) / 2;
  const ly = (y0 + y2) / 2;
  
  const distSq = (qmx - lx)**2 + (qmy - ly)**2;
  
  if (distSq <= toleranceSq) {
    points.push({x: x2, y: y2});
  } else {
    adaptiveQuadraticBezier(x0, y0, q0x, q0y, qmx, qmy, toleranceSq, points, depth + 1);
    adaptiveQuadraticBezier(qmx, qmy, q1x, q1y, x2, y2, toleranceSq, points, depth + 1);
  }
}

function traceOutlines(imageData: ImageData, settings: any): VectorPolyline[] {
  // Map Native Potrace parameters if provided, else fall back to previous defaults
  const turdsize = settings.turdsize ?? settings.despeckleSize ?? 8;
  const alphamax = settings.alphamax ?? 1.0;
  const opttolerance = settings.opttolerance ?? settings.simplificationTolerance ?? 0.2;
  const turnpolicy = settings.turnpolicy ?? 'minority';
  
  // imagetracerjs mapping
  const ltres = opttolerance * 5; // roughly map curve error
  const qtres = opttolerance * 5;
  const rightangleenhance = alphamax < 0.5; // if user wants sharp corners (alphamax -> 0)
  
  const options = {
    ltres: ltres, 
    qtres: qtres, 
    pathomit: turdsize, 
    rightangleenhance: rightangleenhance,
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
  
  // Tolerance for bezier bisection (squared pixels)
  // Smaller opttolerance means tighter curves
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
        // Use Adaptive Bisection for perfectly smooth curves!
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

function traceCenterline(imageData: ImageData, settings: any): VectorPolyline[] {
  // Implement Zhang-Suen Thinning + Graph walking
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
            [-1,-1], [0,-1], [1,-1],
            [-1, 0],         [1, 0],
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
  const p2 = grid[(y-1)*w + x];
  const p3 = grid[(y-1)*w + x+1];
  const p4 = grid[y*w + x+1];
  const p5 = grid[(y+1)*w + x+1];
  const p6 = grid[(y+1)*w + x];
  const p7 = grid[(y+1)*w + x-1];
  const p8 = grid[y*w + x-1];
  const p9 = grid[(y-1)*w + x-1];
  
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
  const p2 = grid[(y-1)*w + x];
  const p3 = grid[(y-1)*w + x+1];
  const p4 = grid[y*w + x+1];
  const p5 = grid[(y+1)*w + x+1];
  const p6 = grid[(y+1)*w + x];
  const p7 = grid[(y+1)*w + x-1];
  const p8 = grid[y*w + x-1];
  const p9 = grid[(y-1)*w + x-1];
  
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

function generateHatching(outlines: VectorPolyline[], settings: any): VectorPolyline[] {
  if (!settings.fillPattern || settings.fillPattern === 'none') return outlines;
  const scale = 1000; 
  const paths: Array<Array<{X: number, Y: number}>> = [];
  
  for (const poly of outlines) {
    const p = poly.points.map(pt => ({ X: Math.round(pt.x * scale), Y: Math.round(pt.y * scale) }));
    if (p.length > 0) paths.push(p);
  }

  const resultPolys: VectorPolyline[] = [];
  if (settings.fillIncludeContour ?? true) {
    resultPolys.push(...outlines);
  }

  const spacing = (settings.fillSpacing || 2.0) * scale;
  const angle = (settings.fillAngle || 45) * Math.PI / 180;
  
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of paths) {
    for (const pt of p) {
      if (pt.X < minX) minX = pt.X;
      if (pt.Y < minY) minY = pt.Y;
      if (pt.X > maxX) maxX = pt.X;
      if (pt.Y > maxY) maxY = pt.Y;
    }
  }

  if (minX === Infinity) return resultPolys;

  const diag = Math.hypot(maxX - minX, maxY - minY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const linePaths: Array<Array<{X: number, Y: number}>> = [];

  const addLines = (ang: number) => {
    const cosA = Math.cos(ang);
    const sinA = Math.sin(ang);
    const nLines = Math.ceil(diag / spacing) * 2;
    for (let i = -nLines / 2; i <= nLines / 2; i++) {
      const d = i * spacing;
      const px = -sinA;
      const py = cosA;
      const midX = cx + px * d;
      const midY = cy + py * d;
      const lx1 = midX + cosA * diag;
      const ly1 = midY + sinA * diag;
      const lx2 = midX - cosA * diag;
      const ly2 = midY - sinA * diag;
      linePaths.push([{X: Math.round(lx1), Y: Math.round(ly1)}, {X: Math.round(lx2), Y: Math.round(ly2)}]);
    }
  };

  if (['lines', 'zigzag', 'wave', 'crosshatch'].includes(settings.fillPattern)) {
    addLines(angle);
    if (settings.fillPattern === 'crosshatch') addLines(angle + Math.PI / 2);
    
    const clipper = new ClipperLib.Clipper();
    clipper.AddPaths(paths, ClipperLib.PolyType.ptClip, true);
    clipper.AddPaths(linePaths, ClipperLib.PolyType.ptSubject, false);
    
    const solution = new ClipperLib.PolyTree();
    clipper.Execute(ClipperLib.ClipType.ctIntersection, solution, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);
    
    const extractPaths = (node: ClipperLib.PolyNode) => {
      if (node.Contour() && node.Contour().length > 0) {
        resultPolys.push({
          points: node.Contour().map(pt => ({ x: pt.X / scale, y: pt.Y / scale })),
          closed: node.IsOpen ? false : true
        });
      }
      for (const child of node.Childs()) extractPaths(child);
    };
    extractPaths(solution);
  } else if (['concentric', 'spiral'].includes(settings.fillPattern)) {
    const co = new ClipperLib.ClipperOffset();
    co.AddPaths(paths, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
    let currentOffset = -spacing;
    while (true) {
      const solution: Array<Array<{X: number, Y: number}>> = [];
      co.Execute(solution, currentOffset);
      if (solution.length === 0) break;
      for (const sol of solution) {
        resultPolys.push({
          points: sol.map(pt => ({ x: pt.X / scale, y: pt.Y / scale })),
          closed: true
        });
      }
      currentOffset -= spacing;
    }
  }

  return resultPolys;
}

function scalePolylines(polylines: VectorPolyline[], settings: any, imgW: number, imgH: number): VectorPolyline[] {
  const targetW = settings.targetWidth || 100;
  const targetH = settings.targetHeight || 100;
  const scaleX = targetW / imgW;
  const scaleY = targetH / imgH;
  
  return polylines.map(poly => ({
    ...poly,
    points: poly.points.map(pt => ({ x: pt.x * scaleX, y: pt.y * scaleY }))
  }));
}
