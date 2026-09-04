import re
import sys

file_path = 'dxfParser.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# I will replace the entire dxfParser.ts because it's small and it's easier to write it cleanly
# than to do targeted replacements for all the new features.

new_content = """import { VectorPolyline } from './vectorRasterGenerator';
import { generateUniversalTextPaths } from './textVectorGenerator';

export interface Point2D {
  x: number;
  y: number;
}

export type Polyline = VectorPolyline;

const MAX_CHORD_ERROR = 0.02;

/**
 * Helper to convert DXF Bulge (arc segment between two vertices) into discrete polyline points
 */
function bulgeToArcPoints(p1: Point2D, p2: Point2D, bulge: number): Point2D[] {
  if (Math.abs(bulge) < 1e-6) {
    return [p1, p2];
  }

  const theta = 4 * Math.atan(bulge);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) return [p1];

  const radius = dist / (2 * Math.sin(theta / 2));
  const chordMidX = (p1.x + p2.x) / 2;
  const chordMidY = (p1.y + p2.y) / 2;
  const chordSagitta = (radius - Math.cos(theta / 2) * radius) * Math.sign(bulge);

  // Normal vector perpendicular to chord
  const nx = -dy / dist;
  const ny = dx / dist;

  // Arc center
  const cx = chordMidX - (radius - chordSagitta) * nx * Math.sign(theta);
  const cy = chordMidY - (radius - chordSagitta) * ny * Math.sign(theta);

  const startAngle = Math.atan2(p1.y - cy, p1.x - cx);
  let endAngle = Math.atan2(p2.y - cy, p2.x - cx);

  if (bulge > 0 && endAngle < startAngle) {
    endAngle += Math.PI * 2;
  } else if (bulge < 0 && endAngle > startAngle) {
    endAngle -= Math.PI * 2;
  }

  const angleSpan = endAngle - startAngle;
  
  // Adaptive segmentation based on max chord error
  // d = R * (1 - cos(theta/(2n))) => cos(theta/(2n)) = 1 - d/R
  let steps = 3;
  if (Math.abs(radius) > 0) {
     const ratio = 1 - MAX_CHORD_ERROR / Math.abs(radius);
     if (ratio >= -1 && ratio <= 1) {
       const stepAngle = 2 * Math.acos(ratio);
       steps = Math.max(3, Math.ceil(Math.abs(angleSpan) / stepAngle));
     } else {
       steps = 64; // fallback for huge radii
     }
  }

  const points: Point2D[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = startAngle + t * angleSpan;
    points.push({
      x: cx + Math.abs(radius) * Math.cos(a),
      y: cy + Math.abs(radius) * Math.sin(a),
    });
  }

  return points;
}

/**
 * Basic cubic B-spline evaluation to convert DXF splines to polylines
 */
function evaluateBSpline(points: Point2D[], degree: number, isClosed: boolean): Point2D[] {
  if (points.length < 2) return points;
  
  // Simple fallback: If degree 1 or less than 3 points, just connect them
  if (degree <= 1 || points.length < 3) {
    return points;
  }

  // Very simplified Bezier / B-Spline interpolation for visual representation.
  // We'll subdivide segments and use a local cubic curve.
  const result: Point2D[] = [];
  const stepsPerSegment = 10;
  
  // Create a clamped knot vector for standard B-spline
  const n = points.length - 1;
  const p = degree;
  const m = n + p + 1;
  const knots: number[] = [];
  for (let i = 0; i <= p; i++) knots.push(0);
  for (let i = 1; i <= n - p; i++) knots.push(i / (n - p + 1));
  for (let i = 0; i <= p; i++) knots.push(1);

  function basis(i: number, p: number, t: number): number {
    if (p === 0) {
      if (knots[i] <= t && t < knots[i + 1]) return 1;
      if (t === knots[knots.length - 1] && knots[i] <= t && t <= knots[i + 1]) return 1;
      return 0;
    }
    const leftDenom = knots[i + p] - knots[i];
    const left = leftDenom === 0 ? 0 : ((t - knots[i]) / leftDenom) * basis(i, p - 1, t);
    
    const rightDenom = knots[i + p + 1] - knots[i + 1];
    const right = rightDenom === 0 ? 0 : ((knots[i + p + 1] - t) / rightDenom) * basis(i + 1, p - 1, t);
    
    return left + right;
  }

  const totalSteps = points.length * stepsPerSegment;
  for (let s = 0; s <= totalSteps; s++) {
    const t = s / totalSteps;
    let x = 0;
    let y = 0;
    for (let i = 0; i <= n; i++) {
      const b = basis(i, p, t);
      x += points[i].x * b;
      y += points[i].y * b;
    }
    result.push({ x, y });
  }

  return result;
}

/**
 * Parses ASCII DXF content into Polylines
 */
export function parseDxf(dxfContent: string): { polylines: Polyline[]; bounds: { minX: number; minY: number; maxX: number; maxY: number } } {
  const lines = dxfContent.split(/\\r\\n|\\r|\\n/);
  const polylines: Polyline[] = [];

  let inEntities = false;
  let currentEntity: string | null = null;
  
  // Entity temporary data structures
  let lineP1: Point2D = { x: 0, y: 0 };
  let lineP2: Point2D = { x: 0, y: 0 };

  let lwVertices: { pt: Point2D; bulge: number }[] = [];
  let lwIsClosed = false;

  let circleCenter: Point2D = { x: 0, y: 0 };
  let circleRadius = 0;

  let arcCenter: Point2D = { x: 0, y: 0 };
  let arcRadius = 0;
  let arcStartDeg = 0;
  let arcEndDeg = 360;

  let ellipseCenter: Point2D = { x: 0, y: 0 };
  let ellipseMajorX = 0;
  let ellipseMajorY = 0;
  let ellipseRatio = 1.0;
  let ellipseStartRad = 0;
  let ellipseEndRad = Math.PI * 2;

  let splinePoints: Point2D[] = [];
  let splineDegree = 3;
  let splineClosed = false;

  let polylineVertices: { pt: Point2D; bulge: number }[] = [];
  let polylineIsClosed = false;
  
  // Text specific
  let textValue = '';
  let textPosX = 0;
  let textPosY = 0;
  let textHeight = 10;
  let textRotDeg = 0;

  let i = 0;

  const flushEntity = () => {
    if (!currentEntity) return;

    if (currentEntity === 'LINE') {
      polylines.push({
        points: [
          { x: Number(lineP1.x.toFixed(4)), y: Number(lineP1.y.toFixed(4)) },
          { x: Number(lineP2.x.toFixed(4)), y: Number(lineP2.y.toFixed(4)) },
        ],
        closed: false,
      });
    } else if (currentEntity === 'LWPOLYLINE') {
      if (lwVertices.length > 0) {
        const expandedPts: Point2D[] = [];
        const count = lwVertices.length;
        for (let j = 0; j < count; j++) {
          const v1 = lwVertices[j];
          const v2 = lwVertices[(j + 1) % count];
          if (j === count - 1 && !lwIsClosed) {
            expandedPts.push(v1.pt);
            break;
          }
          const segmentPts = bulgeToArcPoints(v1.pt, v2.pt, v1.bulge || 0);
          for (let k = 0; k < (j === count - 1 ? segmentPts.length : segmentPts.length - 1); k++) {
            expandedPts.push(segmentPts[k]);
          }
        }
        if (lwIsClosed && expandedPts.length > 0) {
          expandedPts.push({ ...expandedPts[0] });
        }
        if (expandedPts.length >= 2) {
          polylines.push({ points: expandedPts, closed: lwIsClosed });
        }
      }
    } else if (currentEntity === 'CIRCLE') {
      if (circleRadius > 0) {
        let segCount = 64;
        const ratio = 1 - MAX_CHORD_ERROR / circleRadius;
        if (ratio >= -1 && ratio <= 1) {
          segCount = Math.max(12, Math.ceil((Math.PI * 2) / (2 * Math.acos(ratio))));
        }
        const pts: Point2D[] = [];
        for (let j = 0; j <= segCount; j++) {
          const angle = (j / segCount) * Math.PI * 2;
          pts.push({
            x: Number((circleCenter.x + circleRadius * Math.cos(angle)).toFixed(4)),
            y: Number((circleCenter.y + circleRadius * Math.sin(angle)).toFixed(4)),
          });
        }
        polylines.push({ points: pts, closed: true });
      }
    } else if (currentEntity === 'ARC') {
      if (arcRadius > 0) {
        const startRad = (arcStartDeg * Math.PI) / 180;
        let endRad = (arcEndDeg * Math.PI) / 180;
        if (endRad < startRad) endRad += Math.PI * 2;

        const span = endRad - startRad;
        
        let segCount = 32;
        const ratio = 1 - MAX_CHORD_ERROR / arcRadius;
        if (ratio >= -1 && ratio <= 1) {
          segCount = Math.max(4, Math.ceil(span / (2 * Math.acos(ratio))));
        }

        const pts: Point2D[] = [];
        for (let j = 0; j <= segCount; j++) {
          const angle = startRad + (j / segCount) * span;
          pts.push({
            x: Number((arcCenter.x + arcRadius * Math.cos(angle)).toFixed(4)),
            y: Number((arcCenter.y + arcRadius * Math.sin(angle)).toFixed(4)),
          });
        }
        polylines.push({ points: pts, closed: false });
      }
    } else if (currentEntity === 'ELLIPSE') {
       if (ellipseRatio > 0) {
         let end = ellipseEndRad;
         if (end < ellipseStartRad) end += Math.PI * 2;
         const span = end - ellipseStartRad;
         
         const majorLen = Math.hypot(ellipseMajorX, ellipseMajorY);
         const minorLen = majorLen * ellipseRatio;
         const angleOffset = Math.atan2(ellipseMajorY, ellipseMajorX);
         
         let segCount = Math.max(24, Math.ceil((span / (Math.PI*2)) * 64));
         const pts: Point2D[] = [];
         
         for (let j = 0; j <= segCount; j++) {
            const t = ellipseStartRad + (j / segCount) * span;
            const xLocal = majorLen * Math.cos(t);
            const yLocal = minorLen * Math.sin(t);
            // Rotate back
            const x = ellipseCenter.x + xLocal * Math.cos(angleOffset) - yLocal * Math.sin(angleOffset);
            const y = ellipseCenter.y + xLocal * Math.sin(angleOffset) + yLocal * Math.cos(angleOffset);
            pts.push({ x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) });
         }
         polylines.push({ points: pts, closed: Math.abs(span - Math.PI*2) < 0.01 });
       }
    } else if (currentEntity === 'SPLINE') {
      if (splinePoints.length >= 2) {
        const evaluated = evaluateBSpline(splinePoints, splineDegree, splineClosed);
        polylines.push({ points: evaluated, closed: splineClosed });
      }
    } else if (currentEntity === 'POLYLINE') {
      if (polylineVertices.length >= 2) {
        const pts = polylineVertices.map(v => v.pt); // Ignorieren BulkBulge for POLYLINE for now (LWPOLYLINE handles it)
        if (polylineIsClosed) pts.push({ ...pts[0] });
        polylines.push({ points: pts, closed: polylineIsClosed });
      }
    } else if (currentEntity === 'TEXT' || currentEntity === 'MTEXT') {
      if (textValue) {
        // Clean MTEXT formatting tags e.g. \\P, \\A, \\f
        let cleanText = textValue.replace(/\\\\P/g, '\\n').replace(/\\\\[A-Za-z][^;]*;/g, '');
        cleanText = cleanText.replace(/[{}]/g, ''); // Remove curly braces from formatting

        const textPolylines = generateUniversalTextPaths({
          text: cleanText,
          x: 0,
          y: 0,
          fontSize: textHeight,
          fontFamily: 'Hershey Simplex', // Default single line
          fontWeight: 'normal',
          fontStyle: 'normal',
          textAlign: 'left',
          letterSpacing: 0,
          lineSpacing: 1.25,
          mode: 'single_line',
          infillPattern: 'none',
          infillSpacing: 0,
          infillAngle: 0,
          includeOutline: false,
          singleLineBold: false,
          italicSlantDeg: 0
        });

        // Rotate and translate text paths
        const rotRad = (textRotDeg * Math.PI) / 180;
        const cosR = Math.cos(rotRad);
        const sinR = Math.sin(rotRad);

        textPolylines.forEach(poly => {
           const transformedPts = poly.points.map(pt => {
              // Standard rotation around origin, then translate
              const rx = pt.x * cosR - pt.y * sinR;
              const ry = pt.x * sinR + pt.y * cosR;
              return { x: rx + textPosX, y: ry + textPosY };
           });
           polylines.push({ points: transformedPts, closed: poly.closed });
        });
      }
    }
  };

  while (i < lines.length - 1) {
    const codeStr = lines[i].trim();
    const valStr = lines[i + 1].trim();
    i += 2;

    const code = parseInt(codeStr, 10);
    if (isNaN(code)) continue;

    if (code === 0) {
      if (valStr === 'SECTION') {
        continue;
      }
      if (valStr === 'ENDSEC') {
        flushEntity();
        currentEntity = null;
        inEntities = false;
        continue;
      }

      if (inEntities) {
        flushEntity();
        currentEntity = valStr;
        
        // Reset entity variables
        lineP1 = { x: 0, y: 0 };
        lineP2 = { x: 0, y: 0 };
        lwVertices = [];
        lwIsClosed = false;
        circleCenter = { x: 0, y: 0 };
        circleRadius = 0;
        arcCenter = { x: 0, y: 0 };
        arcRadius = 0;
        arcStartDeg = 0;
        arcEndDeg = 360;
        splinePoints = [];
        splineDegree = 3;
        splineClosed = false;
        polylineVertices = [];
        polylineIsClosed = false;
        
        ellipseCenter = { x: 0, y: 0 };
        ellipseMajorX = 0;
        ellipseMajorY = 0;
        ellipseRatio = 1.0;
        ellipseStartRad = 0;
        ellipseEndRad = Math.PI * 2;
        
        textValue = '';
        textPosX = 0;
        textPosY = 0;
        textHeight = 10;
        textRotDeg = 0;
      }
    } else if (code === 2 && valStr === 'ENTITIES') {
      inEntities = true;
    } else if (inEntities && currentEntity) {
      const numVal = parseFloat(valStr);

      if (currentEntity === 'LINE') {
        if (code === 10) lineP1.x = numVal;
        else if (code === 20) lineP1.y = numVal;
        else if (code === 11) lineP2.x = numVal;
        else if (code === 21) lineP2.y = numVal;
      } else if (currentEntity === 'LWPOLYLINE') {
        if (code === 70) {
          lwIsClosed = (parseInt(valStr, 10) & 1) === 1;
        } else if (code === 10) {
          lwVertices.push({ pt: { x: numVal, y: 0 }, bulge: 0 });
        } else if (code === 20) {
          if (lwVertices.length > 0) {
            lwVertices[lwVertices.length - 1].pt.y = numVal;
          }
        } else if (code === 42) {
          if (lwVertices.length > 0) {
            lwVertices[lwVertices.length - 1].bulge = numVal;
          }
        }
      } else if (currentEntity === 'CIRCLE') {
        if (code === 10) circleCenter.x = numVal;
        else if (code === 20) circleCenter.y = numVal;
        else if (code === 40) circleRadius = numVal;
      } else if (currentEntity === 'ARC') {
        if (code === 10) arcCenter.x = numVal;
        else if (code === 20) arcCenter.y = numVal;
        else if (code === 40) arcRadius = numVal;
        else if (code === 50) arcStartDeg = numVal;
        else if (code === 51) arcEndDeg = numVal;
      } else if (currentEntity === 'ELLIPSE') {
        if (code === 10) ellipseCenter.x = numVal;
        else if (code === 20) ellipseCenter.y = numVal;
        else if (code === 11) ellipseMajorX = numVal;
        else if (code === 21) ellipseMajorY = numVal;
        else if (code === 40) ellipseRatio = numVal;
        else if (code === 41) ellipseStartRad = numVal;
        else if (code === 42) ellipseEndRad = numVal;
      } else if (currentEntity === 'SPLINE') {
        if (code === 10) splinePoints.push({ x: numVal, y: 0 });
        else if (code === 20 && splinePoints.length > 0) {
          splinePoints[splinePoints.length - 1].y = numVal;
        } else if (code === 70) {
          splineClosed = (parseInt(valStr, 10) & 1) === 1;
        } else if (code === 71) {
          splineDegree = parseInt(valStr, 10);
        }
      } else if (currentEntity === 'POLYLINE') {
        if (code === 70) {
          polylineIsClosed = (parseInt(valStr, 10) & 1) === 1;
        }
      } else if (currentEntity === 'VERTEX') {
        if (code === 10) polylineVertices.push({ pt: { x: numVal, y: 0 }, bulge: 0 });
        else if (code === 20 && polylineVertices.length > 0) {
          polylineVertices[polylineVertices.length - 1].pt.y = numVal;
        }
      } else if (currentEntity === 'TEXT' || currentEntity === 'MTEXT') {
        if (code === 1) textValue += valStr;
        else if (code === 3) textValue += valStr; // Extended text
        else if (code === 10) textPosX = numVal;
        else if (code === 20) textPosY = numVal;
        else if (code === 40) textHeight = numVal;
        else if (code === 50) textRotDeg = numVal;
      }
    }
  }

  flushEntity();

  // Compute bounding box
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const poly of polylines) {
    for (const pt of poly.points) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
  }

  if (minX === Infinity) {
    minX = 0;
    minY = 0;
    maxX = 100;
    maxY = 100;
  }

  return {
    polylines,
    bounds: { minX, minY, maxX, maxY },
  };
}
"""

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)
