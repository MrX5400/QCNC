import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { VectorPolyline, generateUniversalTextPaths, TextMode } from './vectorRasterGenerator';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface PdfImportOptions {
  textMode: 'outline' | 'single_line' | 'ignore';
  importShapes: boolean;
  importText: boolean;
  singleLineFont: string;
  outlineFontMode: 'original' | 'replace';
  outlineFontReplace: string;
  pageNumber: number;
  scale: number;
  scaleToFit?: boolean;
  alignCenter?: boolean;
  minPathLength?: number;
  removeDuplicates?: boolean;
  ignoreImagesAndFills?: boolean;
}

class Matrix {
  constructor(public a=1, public b=0, public c=0, public d=1, public e=0, public f=0) {}
  multiply(m: Matrix) {
    return new Matrix(
      this.a * m.a + this.c * m.b,
      this.b * m.a + this.d * m.b,
      this.a * m.c + this.c * m.d,
      this.b * m.c + this.d * m.d,
      this.a * m.e + this.c * m.f + this.e,
      this.b * m.e + this.d * m.f + this.f
    );
  }
  transformPoint(x: number, y: number) {
    return {
      x: x * this.a + y * this.c + this.e,
      y: x * this.b + y * this.d + this.f
    };
  }
}

export async function parsePdfToVectors(
  file: File,
  options: PdfImportOptions,
  bedWidth: number,
  bedHeight: number
): Promise<{ polylines: VectorPolyline[]; totalPages: number; dimensions: { width: number; height: number }; previewDataUrl: string }> {
  
  if (!file || file.size === 0) {
    throw new Error('Datei ist leer oder ungültig.');
  }

  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    throw new Error('Fehler beim Lesen der Datei (leerer Puffer).');
  }

  const uint8Array = new Uint8Array(arrayBuffer);
  const loadingTask = pdfjsLib.getDocument({
    data: uint8Array,
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@legacy/cmaps/',
    cMapPacked: true,
  });
  const pdfDocument = await loadingTask.promise;
  const totalPages = pdfDocument.numPages;

  const pageNum = Math.min(Math.max(1, options.pageNumber), totalPages);
  const page = await pdfDocument.getPage(pageNum);
  
  const mmScale = 25.4 / 72.0; 
  // PDF uses points. 1 pt = 1/72 inch. We want coordinates in mm.
  // PDF Y-axis points upward (0,0 = bottom-left). We keep this orientation here,
  // because the CNC canvas renderer already flips Y via `h - (pt.y * scale)`.
  
  const baseViewport = page.getViewport({ scale: 1 });

  let polylines: VectorPolyline[] = [];

  // --- 2-WEGE EXTRAKTION: A (Echte Vektoren aus OperatorList) ---
  const ops = await page.getOperatorList();
  
  let ctmStack: Matrix[] = [];
  // Base CTM: scale PDF points to mm. No Y-flip here (CNC canvas does that).
  let currentCtm = new Matrix(
    mmScale * options.scale, 0, 
    0, mmScale * options.scale, 
    0, 0
  );

  let allPaths: VectorPolyline[] = [];

  // Internal sub-op codes used inside constructPath (NOT the same as pdfjsLib.OPS.*)
  const PATH_MOVE_TO = 0;
  const PATH_LINE_TO = 1;
  const PATH_CURVE_TO = 2;     // cubic bézier (6 coords)
  const PATH_CURVE_TO2 = 3;    // cubic bézier variant (4 coords, cp1 = current)
  const PATH_CLOSE = 4;

  /**
   * Parse a single sub-path object from constructPath args[1].
   * The object has numeric keys: a flat sequence of [opCode, coords...] interleaved.
   */
  function parseSubPath(pathObj: Record<number, number>, ctm: Matrix): VectorPolyline[] {
    const result: VectorPolyline[] = [];
    const len = Object.keys(pathObj).length;
    // Read values into plain array
    const vals: number[] = [];
    for (let k = 0; k < len; k++) {
      vals.push(pathObj[k]);
    }

    let polyline: { x: number; y: number }[] = [];
    let cur = { x: 0, y: 0 };
    let start: { x: number; y: number } | null = null;
    let idx = 0;

    while (idx < vals.length) {
      const op = vals[idx++];

      if (op === PATH_MOVE_TO) {
        // Flush previous segment
        if (polyline.length > 1) {
          result.push({ points: [...polyline], closed: false });
        }
        polyline = [];
        const pt = ctm.transformPoint(vals[idx++], vals[idx++]);
        cur = pt;
        start = pt;
        polyline.push(pt);

      } else if (op === PATH_LINE_TO) {
        const pt = ctm.transformPoint(vals[idx++], vals[idx++]);
        cur = pt;
        polyline.push(pt);

      } else if (op === PATH_CURVE_TO) {
        // 6 values: cp1x cp1y cp2x cp2y endx endy
        const cp1 = ctm.transformPoint(vals[idx++], vals[idx++]);
        const cp2 = ctm.transformPoint(vals[idx++], vals[idx++]);
        const pt  = ctm.transformPoint(vals[idx++], vals[idx++]);
        // Discretize cubic bézier
        const steps = 10;
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          const u = 1 - t;
          polyline.push({
            x: u*u*u*cur.x + 3*u*u*t*cp1.x + 3*u*t*t*cp2.x + t*t*t*pt.x,
            y: u*u*u*cur.y + 3*u*u*t*cp1.y + 3*u*t*t*cp2.y + t*t*t*pt.y,
          });
        }
        cur = pt;

      } else if (op === PATH_CURVE_TO2) {
        // 4 values: cp2x cp2y endx endy (cp1 = current point)
        const cp1 = cur;
        const cp2 = ctm.transformPoint(vals[idx++], vals[idx++]);
        const pt  = ctm.transformPoint(vals[idx++], vals[idx++]);
        const steps = 10;
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          const u = 1 - t;
          polyline.push({
            x: u*u*u*cp1.x + 3*u*u*t*cp1.x + 3*u*t*t*cp2.x + t*t*t*pt.x,
            y: u*u*u*cp1.y + 3*u*u*t*cp1.y + 3*u*t*t*cp2.y + t*t*t*pt.y,
          });
        }
        cur = pt;

      } else if (op === PATH_CLOSE) {
        if (start) {
          polyline.push({ ...start });
        }
        if (polyline.length > 1) {
          result.push({ points: [...polyline], closed: true });
        }
        polyline = [];
        if (start) cur = start;

      } else {
        // Unknown op, skip (shouldn't happen)
        break;
      }
    }

    // Flush remaining open path
    if (polyline.length > 1) {
      result.push({ points: [...polyline], closed: false });
    }
    return result;
  }

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];

    if (fn === pdfjsLib.OPS.save) {
      ctmStack.push(new Matrix(currentCtm.a, currentCtm.b, currentCtm.c, currentCtm.d, currentCtm.e, currentCtm.f));
    } else if (fn === pdfjsLib.OPS.restore) {
      if (ctmStack.length > 0) {
        currentCtm = ctmStack.pop()!;
      }
    } else if (fn === pdfjsLib.OPS.transform) {
      const m = new Matrix(args[0], args[1], args[2], args[3], args[4], args[5]);
      currentCtm = currentCtm.multiply(m);
    } else if (fn === pdfjsLib.OPS.constructPath && options.importShapes !== false) {
      // args[0] = paint type (stroke/fill/etc.), args[1] = sub-path objects, args[2] = minMax (Float32Array)
      const paintType = args[0] as number;

      // Skip fill-only paths (background rects, clip boxes, text field fills)
      // when ignoreImagesAndFills is enabled. Only keep stroked or stroke+fill paths.
      if (options.ignoreImagesAndFills &&
          (paintType === pdfjsLib.OPS.fill || paintType === pdfjsLib.OPS.eoFill)) {
        continue;
      }

      // Skip near-full-page rectangles (page borders / crop marks / media box outlines)
      const minMax = args[2]; // Float32Array [minX, minY, maxX, maxY] in PDF points
      if (minMax) {
        const pw = baseViewport.width;
        const ph = baseViewport.height;
        const rw = minMax[2] - minMax[0];
        const rh = minMax[3] - minMax[1];
        // If this single path covers >90% of page width AND height, skip it
        if (rw > pw * 0.9 && rh > ph * 0.9) {
          continue;
        }
      }

      const subPaths = args[1];
      if (Array.isArray(subPaths)) {
        for (const subPath of subPaths) {
          const extracted = parseSubPath(subPath, currentCtm);
          allPaths.push(...extracted);
        }
      }
    }
  }

  polylines = allPaths;

  // --- 2-WEGE EXTRAKTION: B (Text & Glyphen) ---
  if (options.importText !== false && options.textMode !== 'ignore') {
    const textContent = await page.getTextContent();
    for (const item of textContent.items) {
      if ('str' in item && item.str.trim() !== '') {
        const tx = item.transform; // [a, b, c, d, tx, ty]
        
        // Compute position in mm, scaling
        // No Y-flip, because PDF and CNC Canvas share bottom-left origin!
        const textX = tx[4] * mmScale * options.scale;
        const textY = tx[5] * mmScale * options.scale;
        
        const fontSize = Math.sqrt(tx[0]*tx[0] + tx[1]*tx[1]) * mmScale * options.scale;

        let fontFamily = item.fontName || 'sans-serif';
        if (options.textMode === 'single_line') {
          fontFamily = options.singleLineFont || 'hershey_simplex';
        } else if (options.textMode === 'outline') {
          if (options.outlineFontMode === 'replace') {
            fontFamily = options.outlineFontReplace || 'sans-serif';
          }
        }

        const textPolys = generateUniversalTextPaths({
          text: item.str,
          x: textX,
          y: textY,
          fontSize: fontSize,
          fontFamily: fontFamily,
          mode: options.textMode === 'single_line' ? 'single_line' : 'outline',
          textAlign: 'left'
        });

        polylines.push(...textPolys);
      }
    }
  }

  // --- 2-WEGE EXTRAKTION: C (Visuelle Bildvorschau) ---
  // Wir rendern die PDF zusätzlich auf ein Offscreen-Canvas, 
  // um eine schnelle Vorschau für die Arbeitsfläche / das UI zu liefern.
  const previewScale = 2.0; 
  const previewViewport = page.getViewport({ scale: previewScale });
  const canvas = document.createElement('canvas');
  canvas.width = previewViewport.width;
  canvas.height = previewViewport.height;
  const ctx = canvas.getContext('2d');
  
  if (ctx) {
    await page.render({
      canvasContext: ctx,
      viewport: previewViewport
    }).promise;
  }
  const previewDataUrl = canvas.toDataURL('image/png');

  // --- Filter & Deduplikation ---
  if (options.minPathLength && options.minPathLength > 0) {
    polylines = polylines.filter(p => {
      let len = 0;
      for (let i = 1; i < p.points.length; i++) {
        const dx = p.points[i].x - p.points[i-1].x;
        const dy = p.points[i].y - p.points[i-1].y;
        len += Math.sqrt(dx*dx + dy*dy);
      }
      return len >= options.minPathLength!;
    });
  }

  if (options.removeDuplicates) {
    const seen = new Set<string>();
    const deduped: VectorPolyline[] = [];
    for (const p of polylines) {
      const sig = p.points.map(pt => `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`).join('|');
      if (!seen.has(sig)) {
        seen.add(sig);
        deduped.push(p);
      }
    }
    polylines = deduped;
  }

  // --- Skalierung & Bounding Box ---
  if ((options.scaleToFit || options.alignCenter) && polylines.length > 0) {
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
      if (options.scaleToFit) {
        // Scale to fit + center
        const fitScale = Math.min((bedWidth * 0.9) / w, (bedHeight * 0.9) / h, 1.0);
        const offsetX = (bedWidth - w * fitScale) / 2 - minX * fitScale;
        const offsetY = (bedHeight - h * fitScale) / 2 - minY * fitScale;
        polylines.forEach(p => {
          p.points.forEach(pt => {
            pt.x = pt.x * fitScale + offsetX;
            pt.y = pt.y * fitScale + offsetY; 
          });
        });
      } else {
        // Center only (no scaling)
        const offsetX = (bedWidth - w) / 2 - minX;
        const offsetY = (bedHeight - h) / 2 - minY;
        polylines.forEach(p => {
          p.points.forEach(pt => {
            pt.x = pt.x + offsetX;
            pt.y = pt.y + offsetY; 
          });
        });
      }
    }
  }

  const dimWidth = baseViewport.width * mmScale * options.scale;
  const dimHeight = baseViewport.height * mmScale * options.scale;

  return {
    polylines,
    totalPages,
    dimensions: { width: dimWidth, height: dimHeight },
    previewDataUrl
  };
}
