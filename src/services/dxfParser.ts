import { VectorPolyline } from './vectorRasterGenerator';

export interface Point2D {
  x: number;
  y: number;
}

export type Polyline = VectorPolyline;

/**
 * Helper to convert DXF Bulge (arc segment between two vertices) into discrete polyline points
 */
function bulgeToArcPoints(p1: Point2D, p2: Point2D, bulge: number, segmentsPerCircle: number = 24): Point2D[] {
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
  const steps = Math.max(3, Math.ceil(Math.abs(angleSpan) / ((Math.PI * 2) / segmentsPerCircle)));
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
 * Parses ASCII DXF content into Polylines
 */
export function parseDxf(dxfContent: string): { polylines: Polyline[]; bounds: { minX: number; minY: number; maxX: number; maxY: number } } {
  const lines = dxfContent.split(/\r\n|\r|\n/);
  const polylines: Polyline[] = [];

  let inEntities = false;
  let currentEntity: string | null = null;
  let currentGroupCode: number = -1;

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

  let splinePoints: Point2D[] = [];
  let polylineVertices: { pt: Point2D; bulge: number }[] = [];
  let polylineIsClosed = false;

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
        const segCount = Math.max(24, Math.ceil(circleRadius * 2));
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
        const segCount = Math.max(12, Math.ceil((span / (Math.PI * 2)) * 32));
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
    } else if (currentEntity === 'SPLINE') {
      if (splinePoints.length >= 2) {
        polylines.push({ points: splinePoints, closed: false });
      }
    } else if (currentEntity === 'POLYLINE') {
      if (polylineVertices.length >= 2) {
        const pts = polylineVertices.map(v => v.pt);
        if (polylineIsClosed) pts.push({ ...pts[0] });
        polylines.push({ points: pts, closed: polylineIsClosed });
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
        // Next group 2 might be ENTITIES
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
        polylineVertices = [];
        polylineIsClosed = false;
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
      } else if (currentEntity === 'SPLINE') {
        if (code === 10) splinePoints.push({ x: numVal, y: 0 });
        else if (code === 20 && splinePoints.length > 0) {
          splinePoints[splinePoints.length - 1].y = numVal;
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
