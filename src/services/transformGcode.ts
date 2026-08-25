import { GcodeSegment, ParsedGcode, Point3D, MachineProfile } from '../types/cnc';

/**
 * Transforms coordinates around an anchor point (e.g. center of cutting bounding box or origin)
 */
export function transformPoint(
  pt: Point3D,
  dx: number,
  dy: number,
  angleRad: number,
  scaleX: number,
  scaleY: number,
  scaleZ: number,
  anchorX: number,
  anchorY: number
): Point3D {
  // Translate to anchor with separate X and Y scales
  let x = (pt.x - anchorX) * scaleX;
  let y = (pt.y - anchorY) * scaleY;
  let z = (pt.z !== undefined ? pt.z : 0) * scaleZ;

  // Rotate
  if (angleRad !== 0) {
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;
    x = rx;
    y = ry;
  }

  // Translate back + apply delta
  return {
    x: Number((x + anchorX + dx).toFixed(3)),
    y: Number((y + anchorY + dy).toFixed(3)),
    z: Number(z.toFixed(3)),
  };
}

export interface ContinuousCutContour {
  objectName?: string;
  objectIndex?: number;
  segments: {
    from: Point3D;
    to: Point3D;
    type: 'G1' | 'G2' | 'G3' | 'SWIVEL_ARC';
    feedrate?: number;
    knifeAngle?: number;
    raw?: string;
    objectName?: string;
    objectIndex?: number;
  }[];
}

/**
 * Extracts continuous cutting paths/contours from parsed segments
 */
export function extractCuttingContours(segments: GcodeSegment[]): ContinuousCutContour[] {
  const contours: ContinuousCutContour[] = [];
  let currentContour: ContinuousCutContour | null = null;

  for (const seg of segments) {
    const isCut = seg.penState === 'down' && (seg.type === 'G1' || seg.type === 'G2' || seg.type === 'G3' || seg.type === 'SWIVEL_ARC');

    if (isCut) {
      // If object changed while in pen-down, start new contour
      if (currentContour && (currentContour.objectIndex !== seg.objectIndex || currentContour.objectName !== seg.objectName)) {
        if (currentContour.segments.length > 0) {
          contours.push(currentContour);
        }
        currentContour = null;
      }

      if (!currentContour) {
        currentContour = {
          objectName: seg.objectName,
          objectIndex: seg.objectIndex,
          segments: [],
        };
      }
      currentContour.segments.push({
        from: { ...seg.from },
        to: { ...seg.to },
        type: seg.type as 'G1' | 'G2' | 'G3' | 'SWIVEL_ARC',
        feedrate: seg.feedrate,
        knifeAngle: seg.knifeAngle,
        raw: seg.raw,
        objectName: seg.objectName,
        objectIndex: seg.objectIndex,
      });
    } else {
      if (currentContour && currentContour.segments.length > 0) {
        contours.push(currentContour);
        currentContour = null;
      }
    }
  }

  if (currentContour && currentContour.segments.length > 0) {
    contours.push(currentContour);
  }

  return contours;
}

export interface GcodeObjectIsland {
  id: number;
  name: string;
  contourIndex: number;
  contourIndices: number[]; // All contour indices belonging to this grouped object
  segmentCount: number;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  };
  width: number;
  height: number;
  center: {
    x: number;
    y: number;
  };
  cutLength: number;
  visible: boolean;
}

/**
 * Extracts and inspects all individual object islands / cut contours from Gcode segments
 * Groups nearby / intersecting strokes (like letters of words or compound shapes) into single cohesive objects.
 * When explicit [OBJECT_START] markers are present, strictly groups by object markers and disables distance-based clustering.
 */
export function getGcodeObjects(segments: GcodeSegment[], clusterProximityMm: number = 4.0): GcodeObjectIsland[] {
  const rawContours = extractCuttingContours(segments);
  if (rawContours.length === 0) return [];

  // Compute bounding boxes for all raw contours
  const contourInfos = rawContours.map((c, idx) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, cutLen = 0;
    c.segments.forEach((s) => {
      minX = Math.min(minX, s.from.x, s.to.x);
      minY = Math.min(minY, s.from.y, s.to.y);
      maxX = Math.max(maxX, s.from.x, s.to.x);
      maxY = Math.max(maxY, s.from.y, s.to.y);
      cutLen += Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y);
    });
    if (minX === Infinity) {
      minX = 0; minY = 0; maxX = 0; maxY = 0;
    }
    return {
      index: idx,
      contour: c,
      objectName: c.objectName,
      objectIndex: c.objectIndex,
      minX, minY, maxX, maxY,
      cutLen,
      segmentCount: c.segments.length,
    };
  });

  const explicitContours = contourInfos.filter(c => c.objectIndex !== undefined);
  const untaggedContours = contourInfos.filter(c => c.objectIndex === undefined);

  const result: GcodeObjectIsland[] = [];
  let islandCounter = 0;

  // 1. Group explicit tagged objects strictly by objectIndex (ignoring distance clustering)
  if (explicitContours.length > 0) {
    const objectMap = new Map<number, typeof contourInfos>();

    explicitContours.forEach((c) => {
      const oIdx = c.objectIndex!;
      let list = objectMap.get(oIdx);
      if (!list) {
        list = [];
        objectMap.set(oIdx, list);
      }
      list.push(c);
    });

    const sortedKeys = Array.from(objectMap.keys()).sort((a, b) => a - b);

    sortedKeys.forEach((key) => {
      const grp = objectMap.get(key)!;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, totalCutLen = 0, totalSegments = 0;
      const indices: number[] = [];
      let groupName = '';

      grp.forEach(item => {
        indices.push(item.index);
        minX = Math.min(minX, item.minX);
        minY = Math.min(minY, item.minY);
        maxX = Math.max(maxX, item.maxX);
        maxY = Math.max(maxY, item.maxY);
        totalCutLen += item.cutLen;
        totalSegments += item.segmentCount;
        if (!groupName && item.objectName) {
          groupName = item.objectName;
        }
      });

      if (minX === Infinity) {
        minX = 0; minY = 0; maxX = 0; maxY = 0;
      }

      const width = Math.round(Math.max(0, maxX - minX) * 10) / 10;
      const height = Math.round(Math.max(0, maxY - minY) * 10) / 10;
      const displayName = groupName || `Objekt ${islandCounter + 1} (${width}×${height} mm)`;

      result.push({
        id: islandCounter++,
        name: displayName,
        contourIndex: indices[0],
        contourIndices: indices,
        segmentCount: totalSegments,
        bounds: { minX, minY, maxX, maxY, width, height },
        width,
        height,
        center: {
          x: Math.round(((minX + maxX) / 2) * 10) / 10,
          y: Math.round(((minY + maxY) / 2) * 10) / 10,
        },
        cutLength: Math.round(totalCutLen * 10) / 10,
        visible: true,
      });
    });
  }

  // 2. Fallback for untagged contours (e.g. imported third-party raw G-code without object comments)
  if (untaggedContours.length > 0) {
    const visited = new Set<number>();
    const untaggedGroups: (typeof contourInfos)[] = [];

    for (let i = 0; i < untaggedContours.length; i++) {
      if (visited.has(i)) continue;
      const group: typeof contourInfos = [];
      const queue = [i];
      visited.add(i);

      while (queue.length > 0) {
        const curIdx = queue.shift()!;
        const cur = untaggedContours[curIdx];
        group.push(cur);

        // Find all unvisited untagged contours that are close to cur
        for (let j = 0; j < untaggedContours.length; j++) {
          if (visited.has(j)) continue;
          const other = untaggedContours[j];

          // Check bounding box proximity
          const xOverlap = Math.max(0, Math.min(cur.maxX, other.maxX) - Math.max(cur.minX, other.minX));
          const yOverlap = Math.max(0, Math.min(cur.maxY, other.maxY) - Math.max(cur.minY, other.minY));
          const xDist = cur.minX > other.maxX ? cur.minX - other.maxX : (other.minX > cur.maxX ? other.minX - cur.maxX : 0);
          const yDist = cur.minY > other.maxY ? cur.minY - other.maxY : (other.minY > cur.maxY ? other.minY - cur.maxY : 0);

          if ((xOverlap > 0 && yDist <= clusterProximityMm) || (yOverlap > 0 && xDist <= clusterProximityMm) || (xDist <= clusterProximityMm && yDist <= clusterProximityMm)) {
            visited.add(j);
            queue.push(j);
          }
        }
      }
      untaggedGroups.push(group);
    }

    untaggedGroups.forEach((grp) => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, totalCutLen = 0, totalSegments = 0;
      const indices: number[] = [];

      grp.forEach(item => {
        indices.push(item.index);
        minX = Math.min(minX, item.minX);
        minY = Math.min(minY, item.minY);
        maxX = Math.max(maxX, item.maxX);
        maxY = Math.max(maxY, item.maxY);
        totalCutLen += item.cutLen;
        totalSegments += item.segmentCount;
      });

      if (minX === Infinity) {
        minX = 0; minY = 0; maxX = 0; maxY = 0;
      }

      const width = Math.round(Math.max(0, maxX - minX) * 10) / 10;
      const height = Math.round(Math.max(0, maxY - minY) * 10) / 10;

      result.push({
        id: islandCounter++,
        name: `Objekt ${islandCounter} (${width}×${height} mm)`,
        contourIndex: indices[0],
        contourIndices: indices,
        segmentCount: totalSegments,
        bounds: { minX, minY, maxX, maxY, width, height },
        width,
        height,
        center: {
          x: Math.round(((minX + maxX) / 2) * 10) / 10,
          y: Math.round(((minY + maxY) / 2) * 10) / 10,
        },
        cutLength: Math.round(totalCutLen * 10) / 10,
        visible: true,
      });
    });
  }

  return result;
}

/**
 * Duplicates specific contours/islands in G-code with an offset and regenerates clean paths
 */
export function duplicateGcodeContours(
  parsed: ParsedGcode,
  contourIndicesToDuplicate: number[],
  offsetX: number = 10,
  offsetY: number = 10,
  profile?: MachineProfile
): ParsedGcode {
  const contours = extractCuttingContours(parsed.segments);
  let maxObjIndex = -1;
  contours.forEach(c => {
    if (c.objectIndex !== undefined && c.objectIndex > maxObjIndex) {
      maxObjIndex = c.objectIndex;
    }
  });

  const dupSet = new Set(contourIndicesToDuplicate);
  const duplicated: ContinuousCutContour[] = [];
  const origObjToNewIdx = new Map<number, number>();

  contours.forEach((c, idx) => {
    if (dupSet.has(idx)) {
      let newObjIdx: number | undefined = undefined;
      let newObjName: string | undefined = undefined;
      if (c.objectIndex !== undefined) {
        if (!origObjToNewIdx.has(c.objectIndex)) {
          maxObjIndex++;
          origObjToNewIdx.set(c.objectIndex, maxObjIndex);
        }
        newObjIdx = origObjToNewIdx.get(c.objectIndex);
        newObjName = c.objectName ? `${c.objectName} (Kopie)` : `Objekt ${newObjIdx! + 1}`;
      } else {
        newObjName = `Objekt (Kopie)`;
      }

      duplicated.push({
        objectName: newObjName,
        objectIndex: newObjIdx,
        segments: c.segments.map((s) => ({
          ...s,
          from: { ...s.from, x: Number((s.from.x + offsetX).toFixed(3)), y: Number((s.from.y + offsetY).toFixed(3)) },
          to: { ...s.to, x: Number((s.to.x + offsetX).toFixed(3)), y: Number((s.to.y + offsetY).toFixed(3)) },
          objectName: newObjName,
          objectIndex: newObjIdx,
        })),
      });
    }
  });

  const allContours = [...contours, ...duplicated];

  const isZStepper = profile?.actuatorType === 'z_stepper';
  const penUpZ = Math.max(0, profile?.penUpZ ?? 5);
  const penDownZ = Math.max(0, profile?.penDownZ ?? 0);
  const penUpCmd = profile?.penUpCommand || (isZStepper ? `G0 Z${penUpZ.toFixed(2)}` : 'M5');
  const penDownCmd = profile?.penDownCommand || (isZStepper ? `G1 Z${penDownZ.toFixed(2)} F${profile?.plungeFeedrate || 600}` : 'M3 S1000');
  const travelFeed = profile?.travelFeedrate || 2000;
  const drawFeed = profile?.drawingFeedrate || 1200;

  const rawLines: string[] = [
    `; Updated Toolpaths with Duplicated Objects (PlotterCNC Studio)`,
    `G90`,
    `G21`,
    penUpCmd,
  ];

  const rebuiltSegments: GcodeSegment[] = [];
  let currentPos: Point3D = { x: 0, y: 0, z: penUpZ };
  let lineIdx = rawLines.length;
  let totalCut = 0;
  let totalTravel = 0;
  let penLifts = 0;
  let newCutMinX = Infinity;
  let newCutMinY = Infinity;
  let newCutMaxX = -Infinity;
  let newCutMaxY = -Infinity;

  let activeObjIndex: number | undefined = undefined;

  for (const contour of allContours) {
    if (contour.segments.length === 0) continue;

    // Handle object markers
    if (contour.objectIndex !== activeObjIndex) {
      if (activeObjIndex !== undefined) {
        rawLines.push(`; [OBJECT_END]`);
      }
      activeObjIndex = contour.objectIndex;
      if (activeObjIndex !== undefined) {
        rawLines.push(`; [OBJECT_START] ${contour.objectName || `Objekt ${activeObjIndex + 1}`}`);
      }
    }

    const startPt = contour.segments[0].from;

    const travelDist = Math.hypot(startPt.x - currentPos.x, startPt.y - currentPos.y);
    if (travelDist > 0.05) {
      rawLines.push(`G0 X${startPt.x.toFixed(3)} Y${startPt.y.toFixed(3)} F${travelFeed}`);
      rebuiltSegments.push({
        type: 'G0',
        from: { x: currentPos.x, y: currentPos.y, z: penUpZ },
        to: { x: startPt.x, y: startPt.y, z: penUpZ },
        penState: 'up',
        feedrate: travelFeed,
        lineIndex: lineIdx++,
        raw: rawLines[rawLines.length - 1],
        objectName: contour.objectName,
        objectIndex: contour.objectIndex,
      });
      totalTravel += travelDist;
      currentPos = { x: startPt.x, y: startPt.y, z: penUpZ };
    }

    rawLines.push(penDownCmd);
    rebuiltSegments.push({
      type: 'PEN_DOWN',
      from: { x: currentPos.x, y: currentPos.y, z: penUpZ },
      to: { x: currentPos.x, y: currentPos.y, z: penDownZ },
      penState: 'down',
      lineIndex: lineIdx++,
      raw: penDownCmd,
      objectName: contour.objectName,
      objectIndex: contour.objectIndex,
    });
    currentPos.z = penDownZ;

    for (const seg of contour.segments) {
      const cutDist = Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y);
      const feed = seg.feedrate || drawFeed;

      newCutMinX = Math.min(newCutMinX, seg.from.x, seg.to.x);
      newCutMinY = Math.min(newCutMinY, seg.from.y, seg.to.y);
      newCutMaxX = Math.max(newCutMaxX, seg.from.x, seg.to.x);
      newCutMaxY = Math.max(newCutMaxY, seg.from.y, seg.to.y);

      if (seg.type === 'SWIVEL_ARC') {
        rawLines.push(`G1 X${seg.to.x.toFixed(3)} Y${seg.to.y.toFixed(3)} F${feed} ; Swivel`);
      } else {
        rawLines.push(`G1 X${seg.to.x.toFixed(3)} Y${seg.to.y.toFixed(3)} F${feed}`);
      }

      rebuiltSegments.push({
        type: seg.type,
        from: { x: seg.from.x, y: seg.from.y, z: penDownZ },
        to: { x: seg.to.x, y: seg.to.y, z: penDownZ },
        penState: 'down',
        feedrate: feed,
        lineIndex: lineIdx++,
        raw: rawLines[rawLines.length - 1],
        knifeAngle: seg.knifeAngle,
        objectName: contour.objectName,
        objectIndex: contour.objectIndex,
      });

      totalCut += cutDist;
      currentPos = { x: seg.to.x, y: seg.to.y, z: penDownZ };
    }

    rawLines.push(penUpCmd);
    penLifts++;
    rebuiltSegments.push({
      type: 'PEN_UP',
      from: { x: currentPos.x, y: currentPos.y, z: penDownZ },
      to: { x: currentPos.x, y: currentPos.y, z: penUpZ },
      penState: 'up',
      lineIndex: lineIdx++,
      raw: penUpCmd,
      objectName: contour.objectName,
      objectIndex: contour.objectIndex,
    });
    currentPos.z = penUpZ;
  }

  if (activeObjIndex !== undefined) {
    rawLines.push(`; [OBJECT_END]`);
  }

  const returnDist = Math.hypot(currentPos.x, currentPos.y);
  if (returnDist > 0.1) {
    rawLines.push(`G0 X0.000 Y0.000 F${travelFeed}`);
    rebuiltSegments.push({
      type: 'G0',
      from: { ...currentPos },
      to: { x: 0, y: 0, z: penUpZ },
      penState: 'up',
      feedrate: travelFeed,
      lineIndex: lineIdx++,
      raw: rawLines[rawLines.length - 1],
    });
    totalTravel += returnDist;
  }

  if (newCutMinX === Infinity) {
    newCutMinX = 0; newCutMaxX = 0;
    newCutMinY = 0; newCutMaxY = 0;
  }

  const estimatedTimeSec = Math.round((totalCut / (drawFeed || 1200)) * 60 + (totalTravel / (travelFeed || 2000)) * 60 + penLifts * 0.3);

  return {
    raw: rawLines.join('\n'),
    lines: rawLines,
    segments: rebuiltSegments,
    bounds: {
      minX: Math.min(0, newCutMinX),
      maxX: Math.max(0, newCutMaxX),
      minY: Math.min(0, newCutMinY),
      maxY: Math.max(0, newCutMaxY),
      minZ: 0,
      maxZ: 5,
    },
    cutBounds: {
      minX: newCutMinX,
      minY: newCutMinY,
      maxX: newCutMaxX,
      maxY: newCutMaxY,
    },
    stats: {
      totalLength: Math.round(totalCut + totalTravel),
      cutLength: Math.round(totalCut),
      travelLength: Math.round(totalTravel),
      penLifts,
      estimatedTimeSec,
      lineCount: rawLines.length,
    },
  };
}

/**
 * Applies Translation (dx, dy), Rotation (deg), and Scaling to cutting geometry
 * and recalculates ALL rapid travel geometry cleanly.
 */
export function transformParsedGcode(
  parsed: ParsedGcode,
  options: {
    deltaX?: number; // mm
    deltaY?: number; // mm
    deltaZ?: number; // mm
    rotationDeg?: number; // degrees
    scaleFactor?: number; // 1.0 = 100%
    scaleX?: number;
    scaleY?: number;
    scaleZ?: number;
    targetWidth?: number; // Target dimension mm
    targetHeight?: number; // Target dimension mm
    targetDepthZ?: number; // Target dimension mm
    anchorMode?: 'center' | 'origin';
    targetContourIndices?: number[]; // If provided, transforms ONLY these specific objects/contours
    profile?: MachineProfile;
  }
): ParsedGcode {
  const { 
    deltaX = 0, 
    deltaY = 0, 
    deltaZ = 0, 
    rotationDeg = 0, 
    scaleFactor = 1.0, 
    anchorMode = 'center', 
    targetContourIndices,
    profile 
  } = options;
  const angleRad = (rotationDeg * Math.PI) / 180;

  // Extract cutting contours only
  const contours = extractCuttingContours(parsed.segments);
  const isTargeted = targetContourIndices && targetContourIndices.length > 0;
  const targetSet = new Set(targetContourIndices || []);

  // Compute bounding box of ONLY the targeted cutting geometry
  let cutMinX = Infinity;
  let cutMinY = Infinity;
  let cutMaxX = -Infinity;
  let cutMaxY = -Infinity;

  if (contours.length > 0) {
    contours.forEach((c, idx) => {
      if (isTargeted && !targetSet.has(idx)) return;
      for (const s of c.segments) {
        if (s.from.x < cutMinX) cutMinX = s.from.x;
        if (s.from.y < cutMinY) cutMinY = s.from.y;
        if (s.from.x > cutMaxX) cutMaxX = s.from.x;
        if (s.from.y > cutMaxY) cutMaxY = s.from.y;

        if (s.to.x < cutMinX) cutMinX = s.to.x;
        if (s.to.y < cutMinY) cutMinY = s.to.y;
        if (s.to.x > cutMaxX) cutMaxX = s.to.x;
        if (s.to.y > cutMaxY) cutMaxY = s.to.y;
      }
    });
  }

  if (cutMinX === Infinity) {
    cutMinX = parsed.bounds.minX;
    cutMinY = parsed.bounds.minY;
    cutMaxX = parsed.bounds.maxX;
    cutMaxY = parsed.bounds.maxY;
  }

  const currentW = Math.max(0.001, cutMaxX - cutMinX);
  const currentH = Math.max(0.001, cutMaxY - cutMinY);

  // Compute effective scale factors
  let effScaleX = options.scaleX ?? scaleFactor;
  let effScaleY = options.scaleY ?? scaleFactor;
  let effScaleZ = options.scaleZ ?? scaleFactor;

  if (options.targetWidth !== undefined && options.targetWidth > 0) {
    effScaleX = options.targetWidth / currentW;
  }
  if (options.targetHeight !== undefined && options.targetHeight > 0) {
    effScaleY = options.targetHeight / currentH;
  }

  // Anchor point calculation
  let anchorX = 0;
  let anchorY = 0;
  if (anchorMode === 'center') {
    anchorX = (cutMinX + cutMaxX) / 2;
    anchorY = (cutMinY + cutMaxY) / 2;
  }

  // Transform contours (only transform targeted contours if specified)
  const transformedContours: ContinuousCutContour[] = contours.map((contour, idx) => {
    if (isTargeted && !targetSet.has(idx)) {
      return contour;
    }

    const transformedSegs = contour.segments.map((seg) => {
      const newFrom = transformPoint(seg.from, deltaX, deltaY, angleRad, effScaleX, effScaleY, effScaleZ, anchorX, anchorY);
      const newTo = transformPoint(seg.to, deltaX, deltaY, angleRad, effScaleX, effScaleY, effScaleZ, anchorX, anchorY);

      let newAngle = seg.knifeAngle;
      if (newAngle !== undefined) {
        newAngle = Number(((newAngle + angleRad) % (Math.PI * 2)).toFixed(4));
      }

      return {
        ...seg,
        from: newFrom,
        to: newTo,
        knifeAngle: newAngle,
        objectName: seg.objectName ?? contour.objectName,
        objectIndex: seg.objectIndex ?? contour.objectIndex,
      };
    });

    return {
      objectName: contour.objectName,
      objectIndex: contour.objectIndex,
      segments: transformedSegs,
    };
  });

  // Re-generate fresh clean G-Code lines and re-calculate entire travel geometry
  const penUpZ = Math.max(0, profile?.penUpZ ?? 5);
  const penDownZ = Math.max(0, profile?.penDownZ ?? 0);
  const isZStepper = profile?.actuatorType === 'z_stepper';

  const penUpCmd = profile?.penUpCommand || (isZStepper ? `G0 Z${penUpZ.toFixed(2)}` : 'M5');
  const penDownCmd = profile?.penDownCommand || (isZStepper ? `G1 Z${penDownZ.toFixed(2)} F${profile?.plungeFeedrate || 600}` : 'M3 S1000');
  const travelFeed = profile?.travelFeedrate || 2000;
  const drawFeed = profile?.drawingFeedrate || 1200;

  const rawLines: string[] = [
    `; Transformed & Recalculated Toolpaths (PlotterCNC Studio)`,
    `; Cut Geometry Offset: X+${deltaX.toFixed(2)} Y+${deltaY.toFixed(2)} | Rot: ${rotationDeg.toFixed(1)}° | Scale: ${(scaleFactor * 100).toFixed(0)}%`,
    `G90`,
    `G21`,
    penUpCmd,
  ];

  const rebuiltSegments: GcodeSegment[] = [];
  let currentPos: Point3D = { x: 0, y: 0, z: penUpZ };
  let lineIdx = rawLines.length;

  let totalCut = 0;
  let totalTravel = 0;
  let penLifts = 0;

  let newCutMinX = Infinity;
  let newCutMinY = Infinity;
  let newCutMaxX = -Infinity;
  let newCutMaxY = -Infinity;

  let currentObjIndex: number | undefined = undefined;

  for (const contour of transformedContours) {
    if (contour.segments.length === 0) continue;

    // Handle [OBJECT_START] and [OBJECT_END] comments
    if (contour.objectIndex !== currentObjIndex) {
      if (currentObjIndex !== undefined) {
        rawLines.push(`; [OBJECT_END]`);
      }
      currentObjIndex = contour.objectIndex;
      if (currentObjIndex !== undefined) {
        rawLines.push(`; [OBJECT_START] ${contour.objectName || `Objekt ${currentObjIndex + 1}`}`);
      }
    }

    const startPt = contour.segments[0].from;

    // 1. Recalculated Travel Move (G0 Rapid) with tool lifted to penUpZ
    const travelDist = Math.hypot(startPt.x - currentPos.x, startPt.y - currentPos.y);
    if (travelDist > 0.05) {
      rawLines.push(`G0 X${startPt.x.toFixed(3)} Y${startPt.y.toFixed(3)} F${travelFeed}`);
      rebuiltSegments.push({
        type: 'G0',
        from: { x: currentPos.x, y: currentPos.y, z: penUpZ },
        to: { x: startPt.x, y: startPt.y, z: penUpZ },
        penState: 'up',
        feedrate: travelFeed,
        lineIndex: lineIdx++,
        raw: rawLines[rawLines.length - 1],
        objectName: contour.objectName,
        objectIndex: contour.objectIndex,
      });
      totalTravel += travelDist;
      currentPos = { x: startPt.x, y: startPt.y, z: penUpZ };
    }

    // 2. Lower Tool / Pen Down
    rawLines.push(penDownCmd);
    rebuiltSegments.push({
      type: 'PEN_DOWN',
      from: { x: currentPos.x, y: currentPos.y, z: penUpZ },
      to: { x: currentPos.x, y: currentPos.y, z: penDownZ },
      penState: 'down',
      lineIndex: lineIdx++,
      raw: penDownCmd,
      objectName: contour.objectName,
      objectIndex: contour.objectIndex,
    });
    currentPos.z = penDownZ;

    // 3. Cut Segments of this contour
    for (const seg of contour.segments) {
      const cutDist = Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y);
      const feed = seg.feedrate || drawFeed;

      newCutMinX = Math.min(newCutMinX, seg.from.x, seg.to.x);
      newCutMinY = Math.min(newCutMinY, seg.from.y, seg.to.y);
      newCutMaxX = Math.max(newCutMaxX, seg.from.x, seg.to.x);
      newCutMaxY = Math.max(newCutMaxY, seg.from.y, seg.to.y);

      if (seg.type === 'SWIVEL_ARC') {
        rawLines.push(`G1 X${seg.to.x.toFixed(3)} Y${seg.to.y.toFixed(3)} F${feed} ; Swivel`);
      } else {
        rawLines.push(`G1 X${seg.to.x.toFixed(3)} Y${seg.to.y.toFixed(3)} F${feed}`);
      }

      rebuiltSegments.push({
        type: seg.type,
        from: { x: seg.from.x, y: seg.from.y, z: penDownZ },
        to: { x: seg.to.x, y: seg.to.y, z: penDownZ },
        penState: 'down',
        feedrate: feed,
        lineIndex: lineIdx++,
        raw: rawLines[rawLines.length - 1],
        knifeAngle: seg.knifeAngle,
        objectName: contour.objectName,
        objectIndex: contour.objectIndex,
      });

      totalCut += cutDist;
      currentPos = { x: seg.to.x, y: seg.to.y, z: penDownZ };
    }

    // 4. Raise Tool / Pen Up
    rawLines.push(penUpCmd);
    penLifts++;
    rebuiltSegments.push({
      type: 'PEN_UP',
      from: { x: currentPos.x, y: currentPos.y, z: penDownZ },
      to: { x: currentPos.x, y: currentPos.y, z: penUpZ },
      penState: 'up',
      lineIndex: lineIdx++,
      raw: penUpCmd,
      objectName: contour.objectName,
      objectIndex: contour.objectIndex,
    });
    currentPos.z = penUpZ;
  }

  if (currentObjIndex !== undefined) {
    rawLines.push(`; [OBJECT_END]`);
  }

  // 5. Final park travel back to 0,0
  const returnDist = Math.hypot(currentPos.x, currentPos.y);
  if (returnDist > 0.1) {
    rawLines.push(`G0 X0.000 Y0.000 F${travelFeed}`);
    rebuiltSegments.push({
      type: 'G0',
      from: { ...currentPos },
      to: { x: 0, y: 0, z: penUpZ },
      penState: 'up',
      feedrate: travelFeed,
      lineIndex: lineIdx++,
      raw: rawLines[rawLines.length - 1],
    });
    totalTravel += returnDist;
  }

  if (newCutMinX === Infinity) {
    newCutMinX = 0; newCutMaxX = 100;
    newCutMinY = 0; newCutMaxY = 100;
  }

  const estimatedTimeSec = Math.round((totalCut / (drawFeed || 1200)) * 60 + (totalTravel / (travelFeed || 2000)) * 60 + penLifts * 0.3);

  return {
    raw: rawLines.join('\n'),
    lines: rawLines,
    segments: rebuiltSegments,
    bounds: {
      minX: Math.min(0, newCutMinX),
      maxX: Math.max(0, newCutMaxX),
      minY: Math.min(0, newCutMinY),
      maxY: Math.max(0, newCutMaxY),
      minZ: 0,
      maxZ: 5,
    },
    cutBounds: {
      minX: newCutMinX,
      minY: newCutMinY,
      maxX: newCutMaxX,
      maxY: newCutMaxY,
    },
    stats: {
      totalLength: Math.round(totalCut + totalTravel),
      cutLength: Math.round(totalCut),
      travelLength: Math.round(totalTravel),
      penLifts,
      estimatedTimeSec,
      lineCount: rawLines.length,
    },
  };
}

/**
 * Deletes specific contours/islands from G-code and regenerates clean paths
 */
export function deleteGcodeContours(
  parsed: ParsedGcode,
  contourIndicesToDelete: number[],
  profile?: MachineProfile
): ParsedGcode {
  const contours = extractCuttingContours(parsed.segments);
  const deleteSet = new Set(contourIndicesToDelete);
  const remainingContours = contours.filter((_, idx) => !deleteSet.has(idx));

  const isZStepper = profile?.actuatorType === 'z_stepper';
  const penUpZ = Math.max(0, profile?.penUpZ ?? 5);
  const penDownZ = Math.max(0, profile?.penDownZ ?? 0);
  const penUpCmd = profile?.penUpCommand || (isZStepper ? `G0 Z${penUpZ.toFixed(2)}` : 'M5');
  const penDownCmd = profile?.penDownCommand || (isZStepper ? `G1 Z${penDownZ.toFixed(2)} F${profile?.plungeFeedrate || 600}` : 'M3 S1000');
  const travelFeed = profile?.travelFeedrate || 2000;
  const drawFeed = profile?.drawingFeedrate || 1200;

  const rawLines: string[] = [
    `; Updated Toolpaths (PlotterCNC Studio)`,
    `G90`,
    `G21`,
    penUpCmd,
  ];

  const rebuiltSegments: GcodeSegment[] = [];
  let currentPos: Point3D = { x: 0, y: 0, z: penUpZ };
  let lineIdx = rawLines.length;
  let totalCut = 0;
  let totalTravel = 0;
  let penLifts = 0;
  let newCutMinX = Infinity;
  let newCutMinY = Infinity;
  let newCutMaxX = -Infinity;
  let newCutMaxY = -Infinity;

  let activeObjIndex: number | undefined = undefined;

  for (const contour of remainingContours) {
    if (contour.segments.length === 0) continue;

    // Handle object markers
    if (contour.objectIndex !== activeObjIndex) {
      if (activeObjIndex !== undefined) {
        rawLines.push(`; [OBJECT_END]`);
      }
      activeObjIndex = contour.objectIndex;
      if (activeObjIndex !== undefined) {
        rawLines.push(`; [OBJECT_START] ${contour.objectName || `Objekt ${activeObjIndex + 1}`}`);
      }
    }

    const startPt = contour.segments[0].from;

    const travelDist = Math.hypot(startPt.x - currentPos.x, startPt.y - currentPos.y);
    if (travelDist > 0.05) {
      rawLines.push(`G0 X${startPt.x.toFixed(3)} Y${startPt.y.toFixed(3)} F${travelFeed}`);
      rebuiltSegments.push({
        type: 'G0',
        from: { x: currentPos.x, y: currentPos.y, z: penUpZ },
        to: { x: startPt.x, y: startPt.y, z: penUpZ },
        penState: 'up',
        feedrate: travelFeed,
        lineIndex: lineIdx++,
        raw: rawLines[rawLines.length - 1],
        objectName: contour.objectName,
        objectIndex: contour.objectIndex,
      });
      totalTravel += travelDist;
      currentPos = { x: startPt.x, y: startPt.y, z: penUpZ };
    }

    rawLines.push(penDownCmd);
    rebuiltSegments.push({
      type: 'PEN_DOWN',
      from: { x: currentPos.x, y: currentPos.y, z: penUpZ },
      to: { x: currentPos.x, y: currentPos.y, z: penDownZ },
      penState: 'down',
      lineIndex: lineIdx++,
      raw: penDownCmd,
      objectName: contour.objectName,
      objectIndex: contour.objectIndex,
    });
    currentPos.z = penDownZ;

    for (const seg of contour.segments) {
      const cutDist = Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y);
      const feed = seg.feedrate || drawFeed;

      newCutMinX = Math.min(newCutMinX, seg.from.x, seg.to.x);
      newCutMinY = Math.min(newCutMinY, seg.from.y, seg.to.y);
      newCutMaxX = Math.max(newCutMaxX, seg.from.x, seg.to.x);
      newCutMaxY = Math.max(newCutMaxY, seg.from.y, seg.to.y);

      if (seg.type === 'SWIVEL_ARC') {
        rawLines.push(`G1 X${seg.to.x.toFixed(3)} Y${seg.to.y.toFixed(3)} F${feed} ; Swivel`);
      } else {
        rawLines.push(`G1 X${seg.to.x.toFixed(3)} Y${seg.to.y.toFixed(3)} F${feed}`);
      }

      rebuiltSegments.push({
        type: seg.type,
        from: { x: seg.from.x, y: seg.from.y, z: penDownZ },
        to: { x: seg.to.x, y: seg.to.y, z: penDownZ },
        penState: 'down',
        feedrate: feed,
        lineIndex: lineIdx++,
        raw: rawLines[rawLines.length - 1],
        knifeAngle: seg.knifeAngle,
        objectName: contour.objectName,
        objectIndex: contour.objectIndex,
      });

      totalCut += cutDist;
      currentPos = { x: seg.to.x, y: seg.to.y, z: penDownZ };
    }

    rawLines.push(penUpCmd);
    penLifts++;
    rebuiltSegments.push({
      type: 'PEN_UP',
      from: { x: currentPos.x, y: currentPos.y, z: penDownZ },
      to: { x: currentPos.x, y: currentPos.y, z: penUpZ },
      penState: 'up',
      lineIndex: lineIdx++,
      raw: penUpCmd,
      objectName: contour.objectName,
      objectIndex: contour.objectIndex,
    });
    currentPos.z = penUpZ;
  }

  if (activeObjIndex !== undefined) {
    rawLines.push(`; [OBJECT_END]`);
  }

  const returnDist = Math.hypot(currentPos.x, currentPos.y);
  if (returnDist > 0.1) {
    rawLines.push(`G0 X0.000 Y0.000 F${travelFeed}`);
    rebuiltSegments.push({
      type: 'G0',
      from: { ...currentPos },
      to: { x: 0, y: 0, z: penUpZ },
      penState: 'up',
      feedrate: travelFeed,
      lineIndex: lineIdx++,
      raw: rawLines[rawLines.length - 1],
    });
    totalTravel += returnDist;
  }

  if (newCutMinX === Infinity) {
    newCutMinX = 0; newCutMaxX = 0;
    newCutMinY = 0; newCutMaxY = 0;
  }

  const estimatedTimeSec = Math.round((totalCut / (drawFeed || 1200)) * 60 + (totalTravel / (travelFeed || 2000)) * 60 + penLifts * 0.3);

  return {
    raw: rawLines.join('\n'),
    lines: rawLines,
    segments: rebuiltSegments,
    bounds: {
      minX: Math.min(0, newCutMinX),
      maxX: Math.max(0, newCutMaxX),
      minY: Math.min(0, newCutMinY),
      maxY: Math.max(0, newCutMaxY),
      minZ: 0,
      maxZ: 5,
    },
    cutBounds: {
      minX: newCutMinX,
      minY: newCutMinY,
      maxX: newCutMaxX,
      maxY: newCutMaxY,
    },
    stats: {
      totalLength: Math.round(totalCut + totalTravel),
      cutLength: Math.round(totalCut),
      travelLength: Math.round(totalTravel),
      penLifts,
      estimatedTimeSec,
      lineCount: rawLines.length,
    },
  };
}
