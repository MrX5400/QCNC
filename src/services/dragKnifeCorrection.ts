import { GcodeSegment, Point3D } from '../types/cnc';

export interface DragKnifeParams {
  bladeOffset: number; // mm (distance from pivot axis to knife tip)
  swivelAngleThreshold: number; // degrees, minimum corner angle to insert swivel arc (e.g. 15-25°)
  swivelFeedrate: number; // mm/min during swivel
  cuttingFeedrate: number; // mm/min normal cut
  travelFeedrate?: number; // mm/min rapid positioning
  overcut: number; // mm to extend at end of path (e.g. 0.5 - 2.0 mm)
  liftOnSwivel: boolean; // whether to lift slightly during sharp swivel to prevent tearing
  liftAmount: number; // mm to lift during swivel (e.g. 0.3 - 1.0 mm)
  liftOnRapid?: boolean; // whether to lift Z on rapid travels
  rapidLiftZ?: number; // mm height for rapid travel Z-hop
  penUpCommand: string;
  penDownCommand: string;
  arcMode?: 'g2_g3' | 'linear_g1'; // Whether to output true G2/G3 arcs or linearized G1 moves
  initialOrient?: boolean; // Pre-align blade before first cut
}

export interface DragKnifeGroup {
  name?: string;
  paths: { points: Path2DPoint[]; closed: boolean }[];
}

export interface Path2DPoint {
  x: number;
  y: number;
  z?: number;
}

export interface CompensatedPathResult {
  compensatedSegments: {
    type: 'G0' | 'G1' | 'SWIVEL_ARC' | 'PEN_UP' | 'PEN_DOWN';
    from: Point3D;
    to: Point3D;
    center?: Point3D;
    clockwise?: boolean;
    feedrate?: number;
    description: string;
    bladeTipFrom?: Point3D;
    bladeTipTo?: Point3D;
    objectName?: string;
  }[];
  originalPoints: Path2DPoint[][];
  compensatedPoints: Path2DPoint[][];
  gcode: string[];
}

/**
 * Normalizes an angle into [-PI, PI]
 */
function normalizeAngle(angle: number): number {
  let a = angle % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * Calculates vector angle from p1 to p2
 */
function vectorAngle(p1: Path2DPoint, p2: Path2DPoint): number {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

/**
 * Euclidean distance between two 2D points
 */
function distance2D(p1: Path2DPoint, p2: Path2DPoint): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Applies professional drag knife blade offset compensation to 2D vector polylines.
 *
 * Drag Knife Kinematics:
 * The knife tip trails behind the tool holder center (pivot axis) by distance `bladeOffset`.
 * When moving along direction `theta`:
 * Spindle Center = Knife Tip + (bladeOffset * cos(theta), bladeOffset * sin(theta))
 *
 * At a sharp corner at point `P` where direction turns from `theta_1` to `theta_2`:
 * The knife tip remains stationary at point `P`, while the spindle center drives
 * an arc of radius `bladeOffset` centered at `P` from `theta_1` to `theta_2`.
 */
export function applyDragKnifeCompensation(
  paths: { points: Path2DPoint[]; closed: boolean }[],
  params: DragKnifeParams,
  groups?: DragKnifeGroup[]
): CompensatedPathResult {
  const {
    bladeOffset,
    swivelAngleThreshold = 20,
    swivelFeedrate = 600,
    cuttingFeedrate = 1200,
    travelFeedrate = 3000,
    overcut = 1.0,
    liftOnSwivel = false,
    liftAmount = 0.3,
    penUpCommand = 'M3 S30',
    penDownCommand = 'M3 S80',
    arcMode = 'g2_g3',
  } = params;

  const thresholdRad = (Math.max(5, swivelAngleThreshold) * Math.PI) / 180;
  const gcode: string[] = [];
  const compensatedSegments: CompensatedPathResult['compensatedSegments'] = [];
  const compensatedPointsOut: Path2DPoint[][] = [];
  const originalPointsOut: Path2DPoint[][] = [];

  let currentBladeHeading = 0; // current direction knife is pointing
  let currentSpindlePos: Point3D = { x: 0, y: 0, z: 0 };
  let isBladeOriented = false;

  gcode.push(`; =========================================================================`);
  gcode.push(`; Schleppmesser Bahnkorrektur (Drag Knife Compensation)`);
  gcode.push(`; Klingen-Offset: ${bladeOffset.toFixed(3)} mm | Schwenk-Schwelle: ${swivelAngleThreshold}°`);
  gcode.push(`; Vorschub Schnitt: ${cuttingFeedrate} mm/min | Schwenk-Vorschub: ${swivelFeedrate} mm/min`);
  gcode.push(`; Überlauf (Overcut): ${overcut.toFixed(3)} mm | Modus: ${arcMode === 'linear_g1' ? 'G1 Polygone' : 'G2/G3 Kreisbögen'}`);
  gcode.push(`; =========================================================================`);
  gcode.push(`G90 ; Absolute Koordinaten`);
  gcode.push(`G21 ; Millimeter`);
  gcode.push(penUpCommand);

  // Normalize into group-based processing
  const effectiveGroups: DragKnifeGroup[] = (groups && groups.length > 0)
    ? groups
    : [{ name: 'Objekt', paths }];

  let globalPathCounter = 0;

  for (let gIdx = 0; gIdx < effectiveGroups.length; gIdx++) {
    const grp = effectiveGroups[gIdx];
    if (!grp.paths || grp.paths.length === 0) continue;

    const groupName = grp.name || `Objekt ${gIdx + 1}`;
    gcode.push(`; [OBJECT_START] ${groupName}`);

    for (let pathIdx = 0; pathIdx < grp.paths.length; pathIdx++) {
      const pathObj = grp.paths[pathIdx];
      let pts = [...pathObj.points];
      if (pts.length < 2) continue;

      // Filter out redundant points closer than 0.02 mm
      pts = pts.filter((p, i) => {
        if (i === 0) return true;
        return distance2D(p, pts[i - 1]) > 0.02;
      });
      if (pts.length < 2) continue;

      globalPathCounter++;
      originalPointsOut.push(pts.map(p => ({ x: p.x, y: p.y, z: p.z || 0 })));
      const currentCompPathPts: Path2DPoint[] = [];

      // Apply closed loop overcut or open path extension
      const isClosed = pathObj.closed || distance2D(pts[0], pts[pts.length - 1]) < 0.05;
      if (isClosed) {
        // Ensure closed contour endpoint equals startpoint
        if (distance2D(pts[0], pts[pts.length - 1]) > 0.01) {
          pts.push({ ...pts[0] });
        }
        // Add overcut past start point to ensure clean separation of cut piece
        if (overcut > 0 && pts.length >= 2) {
          let remainingOvercut = overcut;
          let segIdx = 0;
          while (remainingOvercut > 0 && segIdx < pts.length - 1) {
            const pA = pts[segIdx];
            const pB = pts[segIdx + 1];
            const segDist = distance2D(pA, pB);
            if (segDist > 0.001) {
              const addDist = Math.min(remainingOvercut, segDist);
              const ratio = addDist / segDist;
              pts.push({
                x: pA.x + (pB.x - pA.x) * ratio,
                y: pA.y + (pB.y - pA.y) * ratio,
              });
              remainingOvercut -= addDist;
            }
            segIdx++;
          }
        }
      } else if (overcut > 0 && pts.length >= 2) {
        // Open path overcut: extend straight along the tangent of the final segment
        const last = pts[pts.length - 1];
        const prev = pts[pts.length - 2];
        const d = distance2D(prev, last);
        if (d > 0.001) {
          const ux = (last.x - prev.x) / d;
          const uy = (last.y - prev.y) / d;
          pts.push({
            x: last.x + ux * overcut,
            y: last.y + uy * overcut,
          });
        }
      }

      gcode.push(`; --- Pfad ${globalPathCounter} (${isClosed ? 'Geschlossen' : 'Offen'}, ${pts.length} Punkte) ---`);

      // First segment direction
      const firstAngle = vectorAngle(pts[0], pts[1]);

      // Compute entry spindle position:
      // To position the knife tip exactly at pts[0], the spindle pivot must be at:
      const startSpindleX = pts[0].x + bladeOffset * Math.cos(firstAngle);
      const startSpindleY = pts[0].y + bladeOffset * Math.sin(firstAngle);

      // 1. Rapid move tool above start position with tool lifted
      gcode.push(`G0 X${startSpindleX.toFixed(3)} Y${startSpindleY.toFixed(3)} F${travelFeedrate}`);
      compensatedSegments.push({
        type: 'G0',
        from: { ...currentSpindlePos },
        to: { x: startSpindleX, y: startSpindleY, z: currentSpindlePos.z },
        description: 'Eilgang zum Pfadanfang',
        bladeTipFrom: { ...pts[0], z: 0 },
        bladeTipTo: { ...pts[0], z: 0 },
        objectName: groupName,
      });
      currentSpindlePos = { x: startSpindleX, y: startSpindleY, z: currentSpindlePos.z };
      currentCompPathPts.push({ x: startSpindleX, y: startSpindleY });

      // 2. Plunge knife into material
      gcode.push(penDownCommand);
      compensatedSegments.push({
        type: 'PEN_DOWN',
        from: { ...currentSpindlePos },
        to: { ...currentSpindlePos },
        description: 'Messer Eintauchen',
        bladeTipFrom: { ...pts[0], z: 0 },
        bladeTipTo: { ...pts[0], z: 0 },
        objectName: groupName,
      });

      currentBladeHeading = firstAngle;
      isBladeOriented = true;

      // 3. Traverse path segments and insert swivel arcs at corners
      for (let i = 0; i < pts.length - 1; i++) {
        const pCurrent = pts[i];
        const pNext = pts[i + 1];
        const targetAngle = vectorAngle(pCurrent, pNext);
        const angleDiff = normalizeAngle(targetAngle - currentBladeHeading);

        // Check if a corner swivel is needed
        if (Math.abs(angleDiff) > thresholdRad) {
          const isCW = angleDiff < 0;
          const arcCommand = isCW ? 'G2' : 'G3';
          const useG2G3 = arcMode !== 'linear_g1';

          gcode.push(`; Schleppbogen: ${(angleDiff * 180 / Math.PI).toFixed(1)}° (${isCW ? 'CW' : 'CCW'})`);

          // Optional corner lift to protect delicate foils/materials
          if (liftOnSwivel && liftAmount > 0) {
            gcode.push(`G1 Z${liftAmount.toFixed(2)} F800 ; Eck-Anhebung`);
          }

          // Swivel arc around stationary knife tip at pCurrent
          if (useG2G3) {
            if (Math.abs(angleDiff) <= Math.PI * 0.95) {
              // Single G2/G3 Arc
              const targetSpindleX = pCurrent.x + bladeOffset * Math.cos(targetAngle);
              const targetSpindleY = pCurrent.y + bladeOffset * Math.sin(targetAngle);
              const I = pCurrent.x - currentSpindlePos.x;
              const J = pCurrent.y - currentSpindlePos.y;

              gcode.push(`${arcCommand} X${targetSpindleX.toFixed(3)} Y${targetSpindleY.toFixed(3)} I${I.toFixed(3)} J${J.toFixed(3)} F${swivelFeedrate} ; Schwenkbogen`);

              compensatedSegments.push({
                type: 'SWIVEL_ARC',
                from: { ...currentSpindlePos },
                to: { x: targetSpindleX, y: targetSpindleY, z: currentSpindlePos.z },
                center: { x: pCurrent.x, y: pCurrent.y, z: currentSpindlePos.z },
                clockwise: isCW,
                feedrate: swivelFeedrate,
                description: `Eck-Schleppbogen (${arcCommand})`,
                bladeTipFrom: { x: pCurrent.x, y: pCurrent.y, z: 0 },
                bladeTipTo: { x: pCurrent.x, y: pCurrent.y, z: 0 },
                objectName: groupName,
              });

              currentSpindlePos = { x: targetSpindleX, y: targetSpindleY, z: currentSpindlePos.z };
              currentCompPathPts.push({ x: targetSpindleX, y: targetSpindleY });
            } else {
              // Split into two G2/G3 arcs
              const midAngle = currentBladeHeading + angleDiff / 2;
              const midSpindleX = pCurrent.x + bladeOffset * Math.cos(midAngle);
              const midSpindleY = pCurrent.y + bladeOffset * Math.sin(midAngle);
              const targetSpindleX = pCurrent.x + bladeOffset * Math.cos(targetAngle);
              const targetSpindleY = pCurrent.y + bladeOffset * Math.sin(targetAngle);

              // Arc 1: to mid
              const I1 = pCurrent.x - currentSpindlePos.x;
              const J1 = pCurrent.y - currentSpindlePos.y;
              gcode.push(`${arcCommand} X${midSpindleX.toFixed(3)} Y${midSpindleY.toFixed(3)} I${I1.toFixed(3)} J${J1.toFixed(3)} F${swivelFeedrate} ; Schwenkbogen Teil 1`);
              compensatedSegments.push({
                type: 'SWIVEL_ARC',
                from: { ...currentSpindlePos },
                to: { x: midSpindleX, y: midSpindleY, z: currentSpindlePos.z },
                center: { x: pCurrent.x, y: pCurrent.y, z: currentSpindlePos.z },
                clockwise: isCW,
                feedrate: swivelFeedrate,
                description: `Eck-Schleppbogen 1/2 (${arcCommand})`,
                bladeTipFrom: { x: pCurrent.x, y: pCurrent.y, z: 0 },
                bladeTipTo: { x: pCurrent.x, y: pCurrent.y, z: 0 },
                objectName: groupName,
              });

              // Arc 2: mid to target
              const I2 = pCurrent.x - midSpindleX;
              const J2 = pCurrent.y - midSpindleY;
              gcode.push(`${arcCommand} X${targetSpindleX.toFixed(3)} Y${targetSpindleY.toFixed(3)} I${I2.toFixed(3)} J${J2.toFixed(3)} F${swivelFeedrate} ; Schwenkbogen Teil 2`);
              compensatedSegments.push({
                type: 'SWIVEL_ARC',
                from: { x: midSpindleX, y: midSpindleY, z: currentSpindlePos.z },
                to: { x: targetSpindleX, y: targetSpindleY, z: currentSpindlePos.z },
                center: { x: pCurrent.x, y: pCurrent.y, z: currentSpindlePos.z },
                clockwise: isCW,
                feedrate: swivelFeedrate,
                description: `Eck-Schleppbogen 2/2 (${arcCommand})`,
                bladeTipFrom: { x: pCurrent.x, y: pCurrent.y, z: 0 },
                bladeTipTo: { x: pCurrent.x, y: pCurrent.y, z: 0 },
                objectName: groupName,
              });

              currentSpindlePos = { x: targetSpindleX, y: targetSpindleY, z: currentSpindlePos.z };
              currentCompPathPts.push({ x: targetSpindleX, y: targetSpindleY });
            }
          } else {
            // Linear polygon approximation
            const totalAngleDeg = Math.abs((angleDiff * 180) / Math.PI);
            const steps = Math.max(4, Math.ceil(totalAngleDeg / 15)); // step every ~15 degrees
            const angleStep = angleDiff / steps;

            for (let s = 1; s <= steps; s++) {
              const currentAngle = currentBladeHeading + angleStep * s;
              const arcX = pCurrent.x + bladeOffset * Math.cos(currentAngle);
              const arcY = pCurrent.y + bladeOffset * Math.sin(currentAngle);

              gcode.push(`G1 X${arcX.toFixed(3)} Y${arcY.toFixed(3)} F${swivelFeedrate} ; Schlepp-Segment`);
              compensatedSegments.push({
                type: 'SWIVEL_ARC',
                from: { ...currentSpindlePos },
                to: { x: arcX, y: arcY, z: currentSpindlePos.z },
                center: { x: pCurrent.x, y: pCurrent.y, z: currentSpindlePos.z },
                feedrate: swivelFeedrate,
                description: `Eck-Schwenk ${s}/${steps}`,
                bladeTipFrom: { x: pCurrent.x, y: pCurrent.y, z: 0 },
                bladeTipTo: { x: pCurrent.x, y: pCurrent.y, z: 0 },
                objectName: groupName,
              });
              currentSpindlePos = { x: arcX, y: arcY, z: currentSpindlePos.z };
              currentCompPathPts.push({ x: arcX, y: arcY });
            }
          }

          // Restore plunge depth after corner swivel
          if (liftOnSwivel && liftAmount > 0) {
            gcode.push(`G1 Z0.00 F800 ; Absenken auf Schnitttiefe`);
          }

          currentBladeHeading = targetAngle;
        }

        // Linear cut move to the end of this segment
        const endSpindleX = pNext.x + bladeOffset * Math.cos(targetAngle);
        const endSpindleY = pNext.y + bladeOffset * Math.sin(targetAngle);

        gcode.push(`G1 X${endSpindleX.toFixed(3)} Y${endSpindleY.toFixed(3)} F${cuttingFeedrate}`);
        compensatedSegments.push({
          type: 'G1',
          from: { ...currentSpindlePos },
          to: { x: endSpindleX, y: endSpindleY, z: currentSpindlePos.z },
          feedrate: cuttingFeedrate,
          description: `Schnitt nach (${pNext.x.toFixed(1)}, ${pNext.y.toFixed(1)})`,
          bladeTipFrom: { x: pCurrent.x, y: pCurrent.y, z: 0 },
          bladeTipTo: { x: pNext.x, y: pNext.y, z: 0 },
          objectName: groupName,
        });

        currentSpindlePos = { x: endSpindleX, y: endSpindleY, z: currentSpindlePos.z };
        currentCompPathPts.push({ x: endSpindleX, y: endSpindleY });
        currentBladeHeading = targetAngle;
      }

      // 4. Retract tool at end of path
      gcode.push(penUpCommand);
      compensatedSegments.push({
        type: 'PEN_UP',
        from: { ...currentSpindlePos },
        to: { ...currentSpindlePos },
        description: 'Messer Anheben',
        bladeTipFrom: { ...pts[pts.length - 1], z: 0 },
        bladeTipTo: { ...pts[pts.length - 1], z: 0 },
        objectName: groupName,
      });

      compensatedPointsOut.push(currentCompPathPts);
    }

    gcode.push(`; [OBJECT_END]`);
  }

  gcode.push(`; =========================================================================`);
  gcode.push(`; Ende des Schleppmesser-Programms`);
  gcode.push(`G0 X0.000 Y0.000 F${travelFeedrate} ; Parkposition`);
  gcode.push(`M2 ; Programmende`);

  return {
    compensatedSegments,
    originalPoints: originalPointsOut,
    compensatedPoints: compensatedPointsOut,
    gcode,
  };
}
