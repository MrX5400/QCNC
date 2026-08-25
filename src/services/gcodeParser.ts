import { GcodeSegment, ParsedGcode, Point3D } from '../types/cnc';

/**
 * Parses raw G-Code string into structured segments for visualization and streaming
 */
export function parseGcode(gcodeText: string, defaultPenUpZ: number = 2): ParsedGcode {
  const lines = gcodeText.split(/\r?\n/);
  const segments: GcodeSegment[] = [];

  let currentPos: Point3D = { x: 0, y: 0, z: 0 };
  let currentFeedrate = 1000;
  let penState: 'up' | 'down' = 'up';
  let isAbsolute = true;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  let totalLength = 0;
  let cutLength = 0;
  let travelLength = 0;
  let penLifts = 0;
  let totalTimeSec = 0;

  const updateBounds = (pt: Point3D) => {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
    if (pt.z < minZ) minZ = pt.z;
    if (pt.z > maxZ) maxZ = pt.z;
  };

  updateBounds(currentPos);

  let lastCommentWasSwivel = false;
  let currentObjectName: string | undefined = undefined;
  let currentObjectIndex: number | undefined = undefined;
  let objectCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];

    // Check for object boundary comments [OBJECT_START] Name and [OBJECT_END]
    const objStartMatch = rawLine.match(/;\s*\[OBJECT_START\]\s*(.*)$/i);
    if (objStartMatch) {
      currentObjectName = objStartMatch[1].trim() || `Objekt ${objectCounter + 1}`;
      currentObjectIndex = objectCounter++;
    }
    const objEndMatch = rawLine.match(/;\s*\[OBJECT_END\]/i);
    if (objEndMatch) {
      currentObjectName = undefined;
      currentObjectIndex = undefined;
    }
    
    // Check if comment explicitly denotes a corner Swivel Arc / Schwenkbogen
    if (rawLine.trim().startsWith(';')) {
      if (/;\s*(?:swivel\s*arc|schwenkbogen)/i.test(rawLine)) {
        lastCommentWasSwivel = true;
      }
      continue;
    }

    // Remove comments
    const cleanLine = rawLine.replace(/;.*$|\(.*?\)/g, '').trim();
    if (!cleanLine) continue;

    // A segment is ONLY a swivel arc if explicitly marked as such
    const hasInlineSwivel = /;\s*(?:swivel\s*arc|schwenkbogen)/i.test(rawLine);
    const isSwivelMove = hasInlineSwivel || lastCommentWasSwivel;
    lastCommentWasSwivel = false;

    const words = cleanLine.split(/\s+/);
    const command = words[0]?.toUpperCase() || '';

    // Check positioning mode
    if (cleanLine.includes('G90')) isAbsolute = true;
    if (cleanLine.includes('G91')) isAbsolute = false;

    // Check M3 / M5 for pen up/down servo or spindle or Laser ON/OFF
    if (cleanLine.startsWith('M3') || cleanLine.startsWith('M03') || cleanLine.startsWith('M4') || cleanLine.startsWith('M04')) {
      const sMatch = cleanLine.match(/S(\d+)/i);
      const sVal = sMatch ? parseInt(sMatch[1], 10) : 1000;
      // S0 or M5 is UP / Laser OFF, S>0 is DOWN / Laser ON
      if (sVal > 0) {
        penState = 'down';
      } else {
        penState = 'up';
        penLifts++;
      }
      segments.push({
        type: penState === 'down' ? 'PEN_DOWN' : 'PEN_UP',
        from: { ...currentPos },
        to: { ...currentPos },
        penState,
        lineIndex: i,
        raw: rawLine,
        objectName: currentObjectName,
        objectIndex: currentObjectIndex,
      });
      continue;
    }

    if (cleanLine.startsWith('M5') || cleanLine.startsWith('M05')) {
      penState = 'up';
      penLifts++;
      segments.push({
        type: 'PEN_UP',
        from: { ...currentPos },
        to: { ...currentPos },
        penState,
        lineIndex: i,
        raw: rawLine,
        objectName: currentObjectName,
        objectIndex: currentObjectIndex,
      });
      continue;
    }

    // Parse inline S-value if present on G1 lines (GRBL Laser Mode inline power)
    const sInlineMatch = cleanLine.match(/S(\d+)/i);
    if (sInlineMatch) {
      const sVal = parseInt(sInlineMatch[1], 10);
      if (sVal > 0) {
        penState = 'down';
      } else if (sVal === 0) {
        penState = 'up';
      }
    }

    // Parse F (feedrate)
    const fMatch = cleanLine.match(/F([\d.]+)/i);
    if (fMatch) {
      currentFeedrate = parseFloat(fMatch[1]) || currentFeedrate;
    }

    // Parse Coordinates X, Y, Z
    let targetPos: Point3D = { ...currentPos };
    let hasMove = false;

    const xMatch = cleanLine.match(/X([+-]?[\d.]+)/i);
    if (xMatch) {
      const val = parseFloat(xMatch[1]);
      targetPos.x = isAbsolute ? val : currentPos.x + val;
      hasMove = true;
    }

    const yMatch = cleanLine.match(/Y([+-]?[\d.]+)/i);
    if (yMatch) {
      const val = parseFloat(yMatch[1]);
      targetPos.y = isAbsolute ? val : currentPos.y + val;
      hasMove = true;
    }

    const zMatch = cleanLine.match(/Z([+-]?[\d.]+)/i);
    if (zMatch) {
      const val = parseFloat(zMatch[1]);
      targetPos.z = isAbsolute ? val : currentPos.z + val;
      hasMove = true;

      // In Z-stepper plotters: Z > defaultPenUpZ/2 is up (rapid), Z <= defaultPenUpZ/2 is down (cutting)
      if (targetPos.z > defaultPenUpZ / 2) {
        if (penState === 'down') penLifts++;
        penState = 'up';
      } else {
        penState = 'down';
      }
    }

    // Parse Arc parameters I, J, R (for G2/G3 moves)
    let arcCenter: Point3D | undefined = undefined;
    let isClockwise: boolean | undefined = undefined;

    const isG2 = command === 'G2' || command === 'G02';
    const isG3 = command === 'G3' || command === 'G03';

    if (isG2 || isG3) {
      isClockwise = isG2;
      const iMatch = cleanLine.match(/I([+-]?[\d.]+)/i);
      const jMatch = cleanLine.match(/J([+-]?[\d.]+)/i);
      const rMatch = cleanLine.match(/R([+-]?[\d.]+)/i);

      if (iMatch || jMatch) {
        const iVal = iMatch ? parseFloat(iMatch[1]) : 0;
        const jVal = jMatch ? parseFloat(jMatch[1]) : 0;
        arcCenter = {
          x: currentPos.x + iVal,
          y: currentPos.y + jVal,
          z: currentPos.z
        };
        hasMove = true;
      } else if (rMatch) {
        const radius = parseFloat(rMatch[1]);
        const dx = targetPos.x - currentPos.x;
        const dy = targetPos.y - currentPos.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.001 && Math.abs(radius) >= d / 2) {
          const h = Math.sqrt(Math.max(0, radius * radius - (d / 2) * (d / 2)));
          const midX = (currentPos.x + targetPos.x) / 2;
          const midY = (currentPos.y + targetPos.y) / 2;
          const normX = -dy / d;
          const normY = dx / d;
          const sign = (radius > 0 ? 1 : -1) * (isG2 ? -1 : 1);
          arcCenter = {
            x: midX + normX * h * sign,
            y: midY + normY * h * sign,
            z: currentPos.z
          };
          hasMove = true;
        }
      }
    }

    if (hasMove) {
      const dx = targetPos.x - currentPos.x;
      const dy = targetPos.y - currentPos.y;
      const dz = targetPos.z - currentPos.z;
      let distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      let segType: GcodeSegment['type'] = isSwivelMove ? 'SWIVEL_ARC' : 'G1';
      if (command === 'G0' || command === 'G00') {
        segType = 'G0';
        penState = 'up';
        travelLength += distance;
        lastCommentWasSwivel = false;
      } else if (command === 'G1' || command === 'G01' || isG2 || isG3) {
        if (isSwivelMove) segType = 'SWIVEL_ARC';
        else if (isG2) segType = 'G2';
        else if (isG3) segType = 'G3';
        else segType = 'G1';

        // For G2/G3 arcs with center, compute true circular arc distance
        if (arcCenter) {
          const r1 = Math.hypot(currentPos.x - arcCenter.x, currentPos.y - arcCenter.y);
          const r2 = Math.hypot(targetPos.x - arcCenter.x, targetPos.y - arcCenter.y);
          const avgR = (r1 + r2) / 2;
          const a1 = Math.atan2(currentPos.y - arcCenter.y, currentPos.x - arcCenter.x);
          const a2 = Math.atan2(targetPos.y - arcCenter.y, targetPos.x - arcCenter.x);
          let sweep = a2 - a1;
          if (isClockwise) {
            if (sweep > 0) sweep -= 2 * Math.PI;
          } else {
            if (sweep < 0) sweep += 2 * Math.PI;
          }
          const arcLength = Math.abs(sweep) * avgR;
          if (arcLength > 0.001) {
            distance = Math.sqrt(arcLength * arcLength + dz * dz);
          }
        }

        // G1/G2/G3 are cut moves unless explicitly in Z-lift position
        if (targetPos.z > defaultPenUpZ / 2) {
          penState = 'up';
          travelLength += distance;
        } else {
          penState = 'down';
          cutLength += distance;
        }
      } else {
        // Default linear move
        if (penState === 'down') {
          cutLength += distance;
        } else {
          travelLength += distance;
        }
      }

      totalLength += distance;
      if (currentFeedrate > 0) {
        totalTimeSec += (distance / currentFeedrate) * 60;
      }

      updateBounds(targetPos);

      // Compute heading angle for drag knife / orientation indicator
      const knifeAngle = (dx !== 0 || dy !== 0) ? Math.atan2(dy, dx) : undefined;

      segments.push({
        type: segType,
        from: { ...currentPos },
        to: { ...targetPos },
        center: arcCenter,
        clockwise: isClockwise,
        penState,
        feedrate: currentFeedrate,
        lineIndex: i,
        raw: rawLine,
        knifeAngle,
        objectName: currentObjectName,
        objectIndex: currentObjectIndex,
      });

      currentPos = { ...targetPos };
    }
  }

  // Compute cut-only bounds (excluding G0 rapid moves from origin)
  let cutMinX = Infinity;
  let cutMaxX = -Infinity;
  let cutMinY = Infinity;
  let cutMaxY = -Infinity;

  for (const seg of segments) {
    if (seg.penState === 'down' && seg.type !== 'G0') {
      if (seg.from.x < cutMinX) cutMinX = seg.from.x;
      if (seg.from.x > cutMaxX) cutMaxX = seg.from.x;
      if (seg.from.y < cutMinY) cutMinY = seg.from.y;
      if (seg.from.y > cutMaxY) cutMaxY = seg.from.y;

      if (seg.to.x < cutMinX) cutMinX = seg.to.x;
      if (seg.to.x > cutMaxX) cutMaxX = seg.to.x;
      if (seg.to.y < cutMinY) cutMinY = seg.to.y;
      if (seg.to.y > cutMaxY) cutMaxY = seg.to.y;
    }
  }

  // Fallback for empty/single point bounds
  if (minX === Infinity) {
    minX = 0; maxX = 100;
    minY = 0; maxY = 100;
    minZ = 0; maxZ = 5;
  }

  if (cutMinX === Infinity) {
    cutMinX = minX;
    cutMaxX = maxX;
    cutMinY = minY;
    cutMaxY = maxY;
  }

  return {
    raw: gcodeText,
    lines,
    segments,
    bounds: { minX, maxX, minY, maxY, minZ, maxZ },
    cutBounds: {
      minX: cutMinX,
      maxX: cutMaxX,
      minY: cutMinY,
      maxY: cutMaxY,
    },
    stats: {
      totalLength,
      cutLength,
      travelLength,
      estimatedTimeSec: Math.max(1, Math.round(totalTimeSec)),
      penLifts,
      lineCount: lines.length,
    },
  };
}
