import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { VectorPolyline, generateUniversalTextPaths, TextMode, generateRasterToVectorPaths } from './vectorRasterGenerator';
import { RasterSettings } from '../types/cnc';

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
  ignoreImagesAndFills?: boolean; // legacy
  filterInvisibleRects?: boolean;
  filterPageBorders?: boolean;
  ignoreFills?: boolean;
  importMode?: 'auto' | 'vector' | 'raster_tracer';
  tracerMode?: 'contour_trace' | 'centerline_trace';
  tracerThreshold?: number; // 0-255
  tracerSmoothing?: number; // 0-1
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

  let allPaths: VectorPolyline[] = [];
  let ctmStack: Matrix[] = [];
  let currentCtm = new Matrix(mmScale * options.scale, 0, 0, mmScale * options.scale, 0, 0);

  const PATH_MOVE_TO = 0;
  const PATH_LINE_TO = 1;
  const PATH_CURVE_TO = 2;
  const PATH_CURVE_TO2 = 3;
  const PATH_CLOSE = 4;

  function parseSubPath(pathObj: Record<number, number>, ctm: Matrix): VectorPolyline[] {
    const result: VectorPolyline[] = [];
    const vals: number[] = Object.values(pathObj);
    let polyline: { x: number; y: number }[] = [];
    let cur = { x: 0, y: 0 };
    let start: { x: number; y: number } | null = null;
    let idx = 0;

    while (idx < vals.length) {
      const op = vals[idx++];
      if (op === PATH_MOVE_TO) {
        if (polyline.length > 1) result.push({ points: [...polyline], closed: false });
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
        const cp1 = ctm.transformPoint(vals[idx++], vals[idx++]);
        const cp2 = ctm.transformPoint(vals[idx++], vals[idx++]);
        const pt = ctm.transformPoint(vals[idx++], vals[idx++]);
        for (let s = 1; s <= 10; s++) {
          const t = s / 10, u = 1 - t;
          polyline.push({
            x: u*u*u*cur.x + 3*u*u*t*cp1.x + 3*u*t*t*cp2.x + t*t*t*pt.x,
            y: u*u*u*cur.y + 3*u*u*t*cp1.y + 3*u*t*t*cp2.y + t*t*t*pt.y,
          });
        }
        cur = pt;
      } else if (op === PATH_CURVE_TO2) {
        const cp1 = cur;
        const cp2 = ctm.transformPoint(vals[idx++], vals[idx++]);
        const pt = ctm.transformPoint(vals[idx++], vals[idx++]);
        for (let s = 1; s <= 10; s++) {
          const t = s / 10, u = 1 - t;
          polyline.push({
            x: u*u*u*cp1.x + 3*u*u*t*cp1.x + 3*u*t*t*cp2.x + t*t*t*pt.x,
            y: u*u*u*cp1.y + 3*u*u*t*cp1.y + 3*u*t*t*cp2.y + t*t*t*pt.y,
          });
        }
        cur = pt;
      } else if (op === PATH_CLOSE) {
        if (start) polyline.push({ ...start });
        if (polyline.length > 1) result.push({ points: [...polyline], closed: true });
        polyline = [];
        if (start) cur = start;
      } else {
        break;
      }
    }
    if (polyline.length > 1) result.push({ points: [...polyline], closed: false });
    return result;
  }

  // --- 2-WEGE EXTRAKTION: A (Echte Vektoren aus OperatorList) ---
  try {
    if (options.importMode !== 'raster_tracer') {
      const ops = await page.getOperatorList();
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
        } else if (fn === pdfjsLib.OPS.paintFormXObjectBegin) {
          ctmStack.push(new Matrix(currentCtm.a, currentCtm.b, currentCtm.c, currentCtm.d, currentCtm.e, currentCtm.f));
          if (args[0] && args[0].length === 6) {
            const m = new Matrix(args[0][0], args[0][1], args[0][2], args[0][3], args[0][4], args[0][5]);
            currentCtm = currentCtm.multiply(m);
          }
        } else if (fn === pdfjsLib.OPS.paintFormXObjectEnd) {
          if (ctmStack.length > 0) {
            currentCtm = ctmStack.pop()!;
          }
        } else if (fn === pdfjsLib.OPS.constructPath && options.importShapes !== false) {
          const paintType = args[0] as number;
          const isStroke = paintType === pdfjsLib.OPS.stroke || paintType === pdfjsLib.OPS.fillStroke || paintType === pdfjsLib.OPS.eoFillStroke;
          const isFill = paintType === pdfjsLib.OPS.fill || paintType === pdfjsLib.OPS.eoFill;

          // Verwerfe unsichtbare Masken & reine Clipping-Pfade
          if (!isStroke && !isFill) continue;

          // Filtere weiße Seitenhintergründe & Formatierungsrechtecke (wenn aktiviert)
          let skipPath = false;
          if (options.filterInvisibleRects !== false) {
            const minMax = args[2];
            if (minMax) {
              const pw = baseViewport.width;
              const ph = baseViewport.height;
              const rw = minMax[2] - minMax[0];
              const rh = minMax[3] - minMax[1];
              // Ein Rechteck, das >98% der Seite füllt UND keine Strichkontur hat, ist ein Seitenhintergrund
              if (!isStroke && rw > pw * 0.98 && rh > ph * 0.98) {
                skipPath = true;
              }
              // Filtere kleine, unsichtbare Formatierungsboxen / Textrahmen (reine Füllung, exakt rechteckig)
              // Da wir Farbwerte hier nicht direkt sehen, verwerfen wir einfache, ungestrokte Füll-Rechtecke, 
              // die keine komplexe Form sind.
              else if (!isStroke) {
                // Heuristik: args[1] enthält die Subpaths. Wenn es genau 1 Subpath mit 5 Operationen ist 
                // (moveTo, lineTo, lineTo, lineTo, closePath), ist es ein Rechteck.
                const subPaths = args[1];
                if (Array.isArray(subPaths) && subPaths.length === 1) {
                  const sp = subPaths[0];
                  // object keys count divided by 2 is roughly the number of values
                  // moveTo(1+2), 3x lineTo(3x3), close(1) = 13 values in the array
                  if (Object.keys(sp).length === 13) {
                     skipPath = true;
                  }
                }
              }
            }
          }
          if (skipPath) continue;

          const subPaths = args[1];
          if (Array.isArray(subPaths)) {
            for (const subPath of subPaths) {
              const extracted = parseSubPath(subPath, currentCtm);
              allPaths.push(...extracted);
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("PDF Vector Extraction failed, will use raster tracer fallback.", err);
    allPaths = []; // Clear broken paths to force fallback
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
    } as any).promise;
  }
  const previewDataUrl = canvas.toDataURL('image/png');

  // --- AUTOMATISCHER HIGH-RES FALLBACK (BILD-VEKTORISIERUNG) ---
  // Wenn der Benutzer den Modus explizit gewählt hat ODER die PDF null Vektoren lieferte
  if (options.importMode === 'raster_tracer' || (options.importMode !== 'vector' && polylines.length === 0)) {
    if (ctx) {
      // Create high-res canvas for tracing
      const traceScale = 4.0; 
      const traceViewport = page.getViewport({ scale: traceScale });
      const traceCanvas = document.createElement('canvas');
      traceCanvas.width = traceViewport.width;
      traceCanvas.height = traceViewport.height;
      const traceCtx = traceCanvas.getContext('2d');
      if (traceCtx) {
        await page.render({
          canvasContext: traceCtx,
          viewport: traceViewport,
          background: 'rgba(255,255,255,1)'
        } as any).promise;
        
        // Calculate physical target size in mm
        const targetWidth = traceViewport.width * mmScale / traceScale * options.scale;
        const targetHeight = traceViewport.height * mmScale / traceScale * options.scale;
        
        const settings = {
          mode: options.tracerMode || 'contour_trace',
          resolution: 5,
          angle: 0,
          brightness: 0,
          contrast: 0,
          threshold: options.tracerThreshold ?? 128,
          invert: false,
          scaleX: 1.0, 
          scaleY: 1.0, 
          targetWidth: targetWidth,
          targetHeight: targetHeight,
        } as RasterSettings;

        const tracePolys = generateRasterToVectorPaths(traceCanvas, settings);
        
        // Raster tracer returns Y from top-to-bottom.
        // We leave it as is, removing the double Y-inversion to ensure it lands upright.
        polylines = tracePolys;
      }
    }
  }

  // --- Filter & Deduplikation ---
  if (options.minPathLength && options.minPathLength > 0) {
    polylines = polylines.filter(p => {
      let len = 0;
      for (let i = 1; i < p.points.length; i++) {
        const dx = p.points[i].x - p.points[i-1].x;
        const dy = p.points[i].y - p.points[i-1].y;
        len += Math.sqrt(dx*dx + dy*dy);
      }
      if (p.closed && p.points.length > 2) {
        const dx = p.points[0].x - p.points[p.points.length-1].x;
        const dy = p.points[0].y - p.points[p.points.length-1].y;
        len += Math.sqrt(dx*dx + dy*dy);
      }
      return len >= options.minPathLength!;
    });
  }

  if (options.removeDuplicates !== false) {
    const seen = new Set<string>();
    const deduped: VectorPolyline[] = [];
    for (const p of polylines) {
      const pts = p.points.map(pt => `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`);
      const sig1 = pts.join('|');
      const sig2 = [...pts].reverse().join('|'); // Check if it was drawn backwards
      if (!seen.has(sig1) && !seen.has(sig2)) {
        seen.add(sig1);
        seen.add(sig2);
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
