import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { 
  Maximize2, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Play, 
  Pause, 
  Eye, 
  EyeOff,
  Grid, 
  Layers, 
  Box, 
  Compass, 
  Activity,
  Move,
  Info,
  RotateCw,
  AlignCenter,
  CornerDownLeft,
  Hand,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Sparkles,
  MousePointerClick,
  Navigation,
  Lock,
  Unlock,
  Scaling,
  Ruler,
  ExternalLink,
  ArrowRight,
  Trash2,
  Check,
  Crosshair,
  Clock,
  X,
  Square,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Copy,
  FlipHorizontal,
  FlipVertical,
  Undo2,
  Redo2,
  FileCode,
  Upload,
  Sliders
} from 'lucide-react';
import { GcodeSegment, GrblState, MachineProfile, ParsedGcode, Point3D } from '../types/cnc';
import { transformParsedGcode, getGcodeObjects, GcodeObjectIsland, deleteGcodeContours, duplicateGcodeContours } from '../services/transformGcode';
import { parseGcode } from '../services/gcodeParser';
import { grbl } from '../services/grblService';
import { useThemeLanguage } from '../contexts/ThemeLanguageContext';
import { ViewCube } from './ViewCube';
import { VisualizerInspector } from './VisualizerInspector';

interface Visualizer2D3DProps {
  parsedGcode: ParsedGcode | null;
  currentProfile: MachineProfile;
  liveState: GrblState;
  activeLineIndex?: number;
  onGcodeUpdate?: (updated: ParsedGcode) => void;
  onOpenGenerator?: () => void;
}

export const Visualizer2D3D: React.FC<Visualizer2D3DProps> = ({
  parsedGcode,
  currentProfile,
  liveState,
  activeLineIndex,
  onGcodeUpdate,
  onOpenGenerator,
}) => {
  const { theme } = useThemeLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Multi-Touch & Touchpad gesture tracking refs (Pinch-to-Zoom, 2-Finger Pan/Orbit, 1-Finger Select/Drag)
  const initialPinchDistanceRef = useRef<number | null>(null);
  const lastTouchCenterRef = useRef<{ x: number; y: number } | null>(null);
  const touchModeRef = useRef<'none' | 'single' | 'pinch_pan' | 'pinch_orbit'>('none');

  // Viewport transformation state
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [zoom, setZoom] = useState<number>(1.5);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 60, y: 60 });
  
  // 3D Orbit angles
  const [orbitYaw, setOrbitYaw] = useState<number>(45); // degrees
  const [orbitPitch, setOrbitPitch] = useState<number>(55); // degrees

  // Interaction dragging modes:
  // - 'none': idle / hovering
  // - 'pan': dragging viewport pan (Right-click in 2D or Middle-click or Shift+Right in 3D)
  // - 'orbit': dragging 3D rotation (Right-click in 3D)
  // - 'select_rect': marquee box selection in empty space
  // - 'transform_drag': moving selected objects live at 60fps
  // - 'measure': interactive distance measurement
  const [dragMode, setDragMode] = useState<'none' | 'pan' | 'orbit' | 'select_rect' | 'transform_drag' | 'measure'>('none');
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragOriginPan, setDragOriginPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragOriginOrbit, setDragOriginOrbit] = useState<{ yaw: number; pitch: number }>({ yaw: 45, pitch: 55 });

  // Measurement Tool State
  const [isMeasureActive, setIsMeasureActive] = useState<boolean>(false);
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);
  const [measureEnd, setMeasureEnd] = useState<{ x: number; y: number } | null>(null);

  // Undo / Redo History Stacks
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  // Toggles
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showCutPaths, setShowCutPaths] = useState<boolean>(true);
  const [showRapid, setShowRapid] = useState<boolean>(true);
  const [showSwivelArcs, setShowSwivelArcs] = useState<boolean>(true);
  const [showOriginMarker, setShowOriginMarker] = useState<boolean>(true);
  const [showBladeTrail, setShowBladeTrail] = useState<boolean>(true);

  // Element Transformation Toolbar & Inspector State
  const [activeMenu, setActiveMenu] = useState<'none' | 'pos_size' | 'rotation' | 'obj_browser'>('none');
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false);
  const [inspectorTab, setInspectorTab] = useState<'objects' | 'transform' | 'stats'>('objects');
  const [shiftStep, setShiftStep] = useState<number>(10);
  const [customRotDeg, setCustomRotDeg] = useState<number>(0);

  // Multi-Object Selection, Visibility, Lock & Browser State
  const [selectedObjectIds, setSelectedObjectIds] = useState<number[]>([]);
  const [hoveredObjectId, setHoveredObjectId] = useState<number | null>(null);
  const [hiddenObjectIds, setHiddenObjectIds] = useState<number[]>([]);
  const [lockedObjectIds, setLockedObjectIds] = useState<number[]>([]);
  const [customObjectNames, setCustomObjectNames] = useState<{ [id: number]: string }>({});
  const [selectionRect, setSelectionRect] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);

  // Backward-compatible single selectedObjectId
  const selectedObjectId = selectedObjectIds.length === 1 ? selectedObjectIds[0] : null;

  // Extract separate object islands / contours from G-Code segments (clustering multi-stroke text/compound elements into single objects)
  const gcodeObjects: GcodeObjectIsland[] = useMemo(() => {
    if (!parsedGcode || parsedGcode.segments.length === 0) return [];
    const objs = getGcodeObjects(parsedGcode.segments, 8.0);
    return objs.map(o => ({
      ...o,
      name: customObjectNames[o.id] || o.name,
    }));
  }, [parsedGcode, customObjectNames]);

  // Validate or reset selectedObjectIds if objects change
  useEffect(() => {
    if (selectedObjectIds.length > 0 && gcodeObjects.length > 0) {
      const valid = selectedObjectIds.filter(id => gcodeObjects.some(o => o.id === id));
      if (valid.length !== selectedObjectIds.length) {
        setSelectedObjectIds(valid);
      }
    }
  }, [gcodeObjects, selectedObjectIds]);

  const selectedObject = useMemo(() => {
    if (selectedObjectId === null || !gcodeObjects) return null;
    return gcodeObjects.find(o => o.id === selectedObjectId) || null;
  }, [selectedObjectId, gcodeObjects]);

  // Map each segment to its object id, and map rapid (G0) moves to their connecting object IDs
  const { segmentObjectIdMap, rapidLinksMap } = useMemo(() => {
    const segMap = new Map<number, number>();
    const rapidMap = new Map<number, { fromObjId: number | null; toObjId: number | null }>();
    if (!parsedGcode || !gcodeObjects || gcodeObjects.length === 0) {
      return { segmentObjectIdMap: segMap, rapidLinksMap: rapidMap };
    }

    // Map each raw contour index to its GcodeObjectIsland id
    const contourToObjId = new Map<number, number>();
    gcodeObjects.forEach(obj => {
      (obj.contourIndices || [obj.contourIndex]).forEach(cIdx => {
        contourToObjId.set(cIdx, obj.id);
      });
    });

    let currentContour = 0;
    let inCut = false;

    parsedGcode.segments.forEach((seg, idx) => {
      const isCut = seg.penState === 'down' && (seg.type === 'G1' || seg.type === 'G2' || seg.type === 'G3' || seg.type === 'SWIVEL_ARC');
      if (isCut) {
        const objId = contourToObjId.get(currentContour);
        if (objId !== undefined) {
          segMap.set(idx, objId);
        }
        inCut = true;
      } else {
        if (inCut) {
          currentContour++;
          inCut = false;
        }
      }
    });

    // Rapid link mapping to dynamically stretch rapid travel lines live with moving objects
    for (let i = 0; i < parsedGcode.segments.length; i++) {
      const seg = parsedGcode.segments[i];
      if (seg.type === 'G0' || seg.penState === 'up') {
        let fromObj: number | null = null;
        for (let j = i - 1; j >= 0; j--) {
          if (segMap.has(j)) {
            fromObj = segMap.get(j)!;
            break;
          }
        }
        let toObj: number | null = null;
        for (let j = i + 1; j < parsedGcode.segments.length; j++) {
          if (segMap.has(j)) {
            toObj = segMap.get(j)!;
            break;
          }
        }
        rapidMap.set(i, { fromObjId: fromObj, toObjId: toObj });
      }
    }

    return { segmentObjectIdMap: segMap, rapidLinksMap: rapidMap };
  }, [parsedGcode, gcodeObjects]);

  // Live Drag Preview Offset (for 60fps smooth dragging of objects AND rapid travel lines)
  const [liveDragOffset, setLiveDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Floating Color Legend Toggle (Simple bottom overlay matching generator)
  const [showLegend, setShowLegend] = useState<boolean>(true);

  // Custom Direct Offset Inputs
  const [customOffsetX, setCustomOffsetX] = useState<number>(0);
  const [customOffsetY, setCustomOffsetY] = useState<number>(0);

  // Soll-Maße XYZ State on Build Plate
  const [sollX, setSollX] = useState<number>(100);
  const [sollY, setSollY] = useState<number>(100);
  const [sollZ, setSollZ] = useState<number>(2);
  const [lockAspect, setLockAspect] = useState<boolean>(true);

  // Simulation Timeline & Playback
  const [simIndex, setSimIndex] = useState<number>(0);
  const [isSimPlaying, setIsSimPlaying] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [cursorPosMm, setCursorPosMm] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [doubleClickTarget, setDoubleClickTarget] = useState<{ x: number; y: number; time: number } | null>(null);
  const [jogToast, setJogToast] = useState<{ x: number; y: number } | null>(null);

  // Calculate actual cut bounds
  const actualBounds = useMemo(() => {
    if (!parsedGcode) return { width: 0, height: 0, depthZ: 0 };
    const b = parsedGcode.cutBounds || parsedGcode.bounds;
    const w = Math.max(0, b.maxX - b.minX);
    const h = Math.max(0, b.maxY - b.minY);
    const z = Math.max(0, (parsedGcode.bounds.maxZ || 0) - (parsedGcode.bounds.minZ || 0));
    return {
      width: Math.round(w * 100) / 100,
      height: Math.round(h * 100) / 100,
      depthZ: Math.round(z * 100) / 100,
    };
  }, [parsedGcode]);

  // Sync initial Soll values when a new G-code job is loaded or selected object changes
  useEffect(() => {
    if (selectedObject) {
      setSollX(selectedObject.bounds.width);
      setSollY(selectedObject.bounds.height);
      setSollZ(actualBounds.depthZ || 2);
    } else if (actualBounds.width > 0 && actualBounds.height > 0) {
      setSollX(actualBounds.width);
      setSollY(actualBounds.height);
      setSollZ(actualBounds.depthZ || 2);
    }
  }, [parsedGcode?.raw, selectedObject]);

  // Simulation playback timer
  useEffect(() => {
    if (!isSimPlaying || !parsedGcode || parsedGcode.segments.length === 0) return;
    const interval = setInterval(() => {
      setSimIndex((prev) => {
        if (prev >= parsedGcode.segments.length - 1) {
          setIsSimPlaying(false);
          return 0;
        }
        return Math.min(parsedGcode.segments.length - 1, prev + Math.max(1, Math.round(simSpeed * 2)));
      });
    }, 30);
    return () => clearInterval(interval);
  }, [isSimPlaying, simSpeed, parsedGcode]);

  // Reset simulation index when G-code updates
  useEffect(() => {
    setSimIndex(0);
    setIsSimPlaying(false);
  }, [parsedGcode?.raw]);

  // Fit to view helper (supports both 2D planar and 3D isometric perspectives)
  const fitToView = (targetMode?: '2d' | '3d') => {
    const container = containerRef.current;
    if (!container) return;
    const mode = targetMode || viewMode;
    const { width, height } = container.getBoundingClientRect();
    const padding = 60;
    const availW = Math.max(100, width - padding * 2);
    const availH = Math.max(100, height - padding * 2);

    const b = (parsedGcode && parsedGcode.segments.length > 0)
      ? (parsedGcode.cutBounds || parsedGcode.bounds)
      : { minX: 0, maxX: currentProfile.bedWidth, minY: 0, maxY: currentProfile.bedHeight };

    if (mode === '2d') {
      const jobW = Math.max(20, b.maxX - b.minX, currentProfile.bedWidth * 0.4);
      const jobH = Math.max(20, b.maxY - b.minY, currentProfile.bedHeight * 0.4);

      const scaleX = availW / jobW;
      const scaleY = availH / jobH;
      const newZoom = Math.min(scaleX, scaleY, 4.0);

      const centerX = (b.minX + b.maxX) / 2 || currentProfile.bedWidth / 2;
      const centerY = (b.minY + b.maxY) / 2 || currentProfile.bedHeight / 2;

      setZoom(Math.max(0.2, newZoom));
      setPan({
        x: width / 2 - centerX * newZoom,
        y: height / 2 + centerY * newZoom,
      });
    } else {
      // In 3D isometric mode, the workspace bed center (cx, cy, 0) projects directly to (pan.x, pan.y).
      const bedDiag = Math.hypot(currentProfile.bedWidth, currentProfile.bedHeight);
      const scale3D = Math.min(availW / (bedDiag * 0.9), availH / (bedDiag * 0.75), 2.5);
      setZoom(Math.max(0.2, scale3D));
      setPan({
        x: width / 2,
        y: height / 2 + 25,
      });
    }
  };

  // Tracking initial fit to prevent annoying camera jumping when moving objects
  const initialFitDoneRef = useRef<boolean>(false);
  const prevFilenameRef = useRef<string>('');

  // Run auto-fit ONLY on initial load or when a genuinely new file is loaded (not on moves/transforms)
  useEffect(() => {
    if (parsedGcode && parsedGcode.segments.length > 0) {
      const currentFilename = parsedGcode.filename || '__default__';
      if (!initialFitDoneRef.current || (prevFilenameRef.current && prevFilenameRef.current !== currentFilename)) {
        fitToView();
        initialFitDoneRef.current = true;
        prevFilenameRef.current = currentFilename;
      }
    }
  }, [parsedGcode?.filename]);

  // Undo / Redo Helpers
  const pushUndoSnapshot = useCallback((raw: string) => {
    setUndoStack(prev => [...prev.slice(-30), raw]);
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 || !parsedGcode) return;
    const prevRaw = undoStack[undoStack.length - 1];
    const newUndo = undoStack.slice(0, -1);
    setRedoStack(prev => [...prev, parsedGcode.raw]);
    setUndoStack(newUndo);
    const updated = parseGcode(prevRaw, currentProfile.penUpZ || 2);
    if (onGcodeUpdate) {
      onGcodeUpdate(updated);
    }
  }, [undoStack, parsedGcode, currentProfile.penUpZ, onGcodeUpdate]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0 || !parsedGcode) return;
    const nextRaw = redoStack[redoStack.length - 1];
    const newRedo = redoStack.slice(0, -1);
    setUndoStack(prev => [...prev, parsedGcode.raw]);
    setRedoStack(newRedo);
    const updated = parseGcode(nextRaw, currentProfile.penUpZ || 2);
    if (onGcodeUpdate) {
      onGcodeUpdate(updated);
    }
  }, [redoStack, parsedGcode, currentProfile.penUpZ, onGcodeUpdate]);

  // Coordinate Conversion (Workspace mm <-> Screen Pixels)
  const mmToScreen = (x: number, y: number, z: number = 0) => {
    if (viewMode === '2d') {
      return {
        sx: pan.x + x * zoom,
        sy: pan.y - y * zoom,
      };
    } else {
      // 3D Isometric / Orbit projection (Z-Up standard)
      const radYaw = (orbitYaw * Math.PI) / 180;
      const radPitch = (orbitPitch * Math.PI) / 180;

      const cx = currentProfile.bedWidth / 2;
      const cy = currentProfile.bedHeight / 2;

      const rx = x - cx;
      const ry = y - cy;

      const xRot = rx * Math.cos(radYaw) - ry * Math.sin(radYaw);
      const yRot = rx * Math.sin(radYaw) + ry * Math.cos(radYaw);

      const sx = pan.x + xRot * zoom;
      const sy = pan.y - (yRot * Math.sin(radPitch) + z * Math.cos(radPitch) * 2) * zoom;

      return { sx, sy };
    }
  };

  const screenToMm = (sx: number, sy: number) => {
    if (viewMode === '2d') {
      return {
        x: (sx - pan.x) / zoom,
        y: (pan.y - sy) / zoom,
      };
    } else {
      // Approximate 3D projection onto Z=0 bed plane
      const radYaw = (orbitYaw * Math.PI) / 180;
      const radPitch = (orbitPitch * Math.PI) / 180;
      const cx = currentProfile.bedWidth / 2;
      const cy = currentProfile.bedHeight / 2;

      const screenDx = (sx - pan.x) / zoom;
      const screenDy = -(sy - pan.y) / (zoom * Math.sin(radPitch));

      const xOrig = cx + screenDx * Math.cos(radYaw) + screenDy * Math.sin(radYaw);
      const yOrig = cy - screenDx * Math.sin(radYaw) + screenDy * Math.cos(radYaw);

      return { x: xOrig, y: yOrig };
    }
  };

  // Find object under mouse cursor with hit tolerance
  const findHitObject = (mm: { x: number; y: number }) => {
    if (!gcodeObjects || gcodeObjects.length === 0) return null;
    const hitToleranceMm = Math.max(3.5, 18 / zoom);

    const visibleObjects = gcodeObjects.filter(obj => !hiddenObjectIds.includes(obj.id));
    const candidates = visibleObjects.filter(obj => 
      mm.x >= obj.bounds.minX - hitToleranceMm &&
      mm.x <= obj.bounds.maxX + hitToleranceMm &&
      mm.y >= obj.bounds.minY - hitToleranceMm &&
      mm.y <= obj.bounds.maxY + hitToleranceMm
    );

    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    // Find candidate closest to cursor center
    let bestObj: GcodeObjectIsland | null = null;
    let bestDist = Infinity;

    for (const obj of candidates) {
      const dCenter = Math.hypot(obj.center.x - mm.x, obj.center.y - mm.y);
      if (dCenter < bestDist) {
        bestDist = dCenter;
        bestObj = obj;
      }
    }

    return bestObj || candidates[0];
  };

  // --- Transformation Handlers ---
  const handleApplyTransform = (
    deltaX: number, 
    deltaY: number, 
    rotDeg: number, 
    scale: number, 
    targetObjectIds?: number[]
  ) => {
    if (!parsedGcode || parsedGcode.segments.length === 0) return;
    const activeIds = targetObjectIds !== undefined
      ? targetObjectIds
      : (selectedObjectIds.length > 0 ? selectedObjectIds : (selectedObjectId !== null ? [selectedObjectId] : undefined));

    // Convert object IDs to their raw contour indices
    let targetContours: number[] | undefined = undefined;
    if (activeIds && activeIds.length > 0) {
      targetContours = activeIds.flatMap(id => {
        const obj = gcodeObjects.find(o => o.id === id);
        return obj ? (obj.contourIndices || [obj.contourIndex]) : [id];
      });
    }

    pushUndoSnapshot(parsedGcode.raw);
    const transformed = transformParsedGcode(parsedGcode, {
      deltaX,
      deltaY,
      rotationDeg: rotDeg,
      scaleFactor: scale,
      anchorMode: 'center',
      targetContourIndices: targetContours,
      profile: currentProfile,
    });
    if (onGcodeUpdate) {
      onGcodeUpdate(transformed);
    }
  };

  const handleCenterOnBed = (specificIds?: number[]) => {
    if (!parsedGcode || parsedGcode.segments.length === 0) return;
    const activeIds = specificIds || selectedObjectIds;

    if (activeIds.length > 0) {
      const selectedObjs = gcodeObjects.filter(o => activeIds.includes(o.id));
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      selectedObjs.forEach(o => {
        if (o.bounds.minX < minX) minX = o.bounds.minX;
        if (o.bounds.maxX > maxX) maxX = o.bounds.maxX;
        if (o.bounds.minY < minY) minY = o.bounds.minY;
        if (o.bounds.maxY > maxY) maxY = o.bounds.maxY;
      });
      const groupCenterX = (minX + maxX) / 2;
      const groupCenterY = (minY + maxY) / 2;
      const dx = (currentProfile.bedWidth / 2) - groupCenterX;
      const dy = (currentProfile.bedHeight / 2) - groupCenterY;
      handleApplyTransform(dx, dy, 0, 1.0, activeIds);
    } else {
      const currentCenterX = (parsedGcode.bounds.minX + parsedGcode.bounds.maxX) / 2;
      const currentCenterY = (parsedGcode.bounds.minY + parsedGcode.bounds.maxY) / 2;
      const dx = (currentProfile.bedWidth / 2) - currentCenterX;
      const dy = (currentProfile.bedHeight / 2) - currentCenterY;
      handleApplyTransform(dx, dy, 0, 1.0);
    }
  };

  const handleMoveToOrigin = (specificIds?: number[]) => {
    if (!parsedGcode || parsedGcode.segments.length === 0) return;
    const activeIds = specificIds || selectedObjectIds;

    if (activeIds.length > 0) {
      const selectedObjs = gcodeObjects.filter(o => activeIds.includes(o.id));
      let minX = Infinity, minY = Infinity;
      selectedObjs.forEach(o => {
        if (o.bounds.minX < minX) minX = o.bounds.minX;
        if (o.bounds.minY < minY) minY = o.bounds.minY;
      });
      const dx = -minX;
      const dy = -minY;
      handleApplyTransform(dx, dy, 0, 1.0, activeIds);
    } else {
      const dx = -parsedGcode.bounds.minX;
      const dy = -parsedGcode.bounds.minY;
      handleApplyTransform(dx, dy, 0, 1.0);
    }
  };

  const handleDuplicateObjects = (specificIds?: number[]) => {
    if (!parsedGcode) return;
    const activeIds = specificIds || selectedObjectIds;
    if (activeIds.length === 0) return;

    const targetContours = activeIds.flatMap(id => {
      const obj = gcodeObjects.find(o => o.id === id);
      return obj ? (obj.contourIndices || [obj.contourIndex]) : [id];
    });

    pushUndoSnapshot(parsedGcode.raw);
    const updated = duplicateGcodeContours(parsedGcode, targetContours, 10, 10, currentProfile);
    if (onGcodeUpdate) {
      onGcodeUpdate(updated);
    }
  };

  const handleDeleteObject = (objectId: number) => {
    if (!parsedGcode) return;
    const obj = gcodeObjects.find(o => o.id === objectId);
    const targetContours = obj ? (obj.contourIndices || [obj.contourIndex]) : [objectId];
    pushUndoSnapshot(parsedGcode.raw);
    const updated = deleteGcodeContours(parsedGcode, targetContours, currentProfile);
    setSelectedObjectIds(prev => prev.filter(id => id !== objectId));
    if (onGcodeUpdate) {
      onGcodeUpdate(updated);
    }
  };

  const handleDeleteSelected = () => {
    if (!parsedGcode || selectedObjectIds.length === 0) return;
    const targetContours = selectedObjectIds.flatMap(id => {
      const obj = gcodeObjects.find(o => o.id === id);
      return obj ? (obj.contourIndices || [obj.contourIndex]) : [id];
    });
    pushUndoSnapshot(parsedGcode.raw);
    const updated = deleteGcodeContours(parsedGcode, targetContours, currentProfile);
    setSelectedObjectIds([]);
    if (onGcodeUpdate) {
      onGcodeUpdate(updated);
    }
  };

  const handleSollXChange = (val: number) => {
    setSollX(val);
    const targetW = selectedObject ? selectedObject.bounds.width : actualBounds.width;
    const targetH = selectedObject ? selectedObject.bounds.height : actualBounds.height;
    if (lockAspect && targetW > 0) {
      const ratio = targetH / targetW;
      setSollY(Number((val * ratio).toFixed(2)));
    }
  };

  const handleSollYChange = (val: number) => {
    setSollY(val);
    const targetW = selectedObject ? selectedObject.bounds.width : actualBounds.width;
    const targetH = selectedObject ? selectedObject.bounds.height : actualBounds.height;
    if (lockAspect && targetH > 0) {
      const ratio = targetW / targetH;
      setSollX(Number((val * ratio).toFixed(2)));
    }
  };

  const handleApplySollDimensions = () => {
    if (!parsedGcode || sollX <= 0 || sollY <= 0) return;
    const targetContourIndices = selectedObjectIds.length > 0
      ? selectedObjectIds.flatMap(id => gcodeObjects.find(o => o.id === id)?.contourIndices || [id])
      : undefined;

    pushUndoSnapshot(parsedGcode.raw);
    const transformed = transformParsedGcode(parsedGcode, {
      targetWidth: sollX,
      targetHeight: sollY,
      targetDepthZ: sollZ,
      anchorMode: 'center',
      targetContourIndices,
      profile: currentProfile,
    });
    if (onGcodeUpdate) {
      onGcodeUpdate(transformed);
    }
  };

  const handleFitToBed = () => {
    if (!parsedGcode || actualBounds.width <= 0) return;
    const maxBedW = currentProfile.bedWidth;
    const maxBedH = currentProfile.bedHeight;
    const targetW = selectedObject ? selectedObject.bounds.width : actualBounds.width;
    const targetH = selectedObject ? selectedObject.bounds.height : actualBounds.height;
    const scaleFactor = Math.min(maxBedW / targetW, maxBedH / targetH);
    const targetContourIndices = selectedObjectIds.length > 0
      ? selectedObjectIds.flatMap(id => gcodeObjects.find(o => o.id === id)?.contourIndices || [id])
      : undefined;
    pushUndoSnapshot(parsedGcode.raw);
    const transformed = transformParsedGcode(parsedGcode, {
      scaleFactor,
      anchorMode: 'center',
      targetContourIndices,
      profile: currentProfile,
    });
    if (onGcodeUpdate) {
      onGcodeUpdate(transformed);
    }
  };

  // Keyboard Shortcuts: Delete/Backspace to delete, Ctrl+Z/Y for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedObjectIds.length > 0) {
          e.preventDefault();
          handleDeleteSelected();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObjectIds, handleDeleteSelected, handleUndo, handleRedo]);

  // --- Mouse & Navigation Event Handlers ---
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // 0. MEASURE: Left-click when isMeasureActive
    if (e.button === 0 && isMeasureActive) {
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const mm = screenToMm(mouseX, mouseY);
      setMeasureStart(mm);
      setMeasureEnd(mm);
      setDragMode('measure');
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // 1. PAN: Middle-click (button 1) OR Right-click (button 2) in 2D OR Shift+Right-click in 3D
    const isPan = e.button === 1 || (e.button === 2 && (viewMode === '2d' || e.shiftKey));
    if (isPan) {
      setDragMode('pan');
      setDragStart({ x: e.clientX, y: e.clientY });
      setDragOriginPan({ ...pan });
      return;
    }

    // 2. ORBIT: Right-click (button 2) without Shift in 3D
    if (e.button === 2 && viewMode === '3d') {
      setDragMode('orbit');
      setDragStart({ x: e.clientX, y: e.clientY });
      setDragOriginOrbit({ yaw: orbitYaw, pitch: orbitPitch });
      return;
    }

    // 3. OBJECT SELECTION & TRANSFORM DRAGGING: Left-click (button 0)
    if (e.button === 0) {
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const mm = screenToMm(mouseX, mouseY);
      const isModifier = e.shiftKey || e.ctrlKey || e.metaKey;

      const hitObj = findHitObject(mm);

      if (hitObj) {
        const isLocked = lockedObjectIds.includes(hitObj.id);

        if (isModifier) {
          // Toggle selection
          setSelectedObjectIds(prev => 
            prev.includes(hitObj.id) ? prev.filter(id => id !== hitObj.id) : [...prev, hitObj.id]
          );
        } else {
          // If clicked object is not already part of the active selection, select only this one
          if (!selectedObjectIds.includes(hitObj.id)) {
            setSelectedObjectIds([hitObj.id]);
          }
        }

        // If not locked, start live dragging
        if (!isLocked) {
          setDragMode('transform_drag');
          setDragStart({ x: e.clientX, y: e.clientY });
          setLiveDragOffset({ x: 0, y: 0 });
        }
      } else {
        // Clicked in empty canvas workspace
        if (!isModifier) {
          // Deselect all
          setSelectedObjectIds([]);
        }
        // Start Marquee Selection Box
        setSelectionRect({ startX: mm.x, startY: mm.y, currentX: mm.x, currentY: mm.y });
        setDragMode('select_rect');
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const mm = screenToMm(mouseX, mouseY);
    setCursorPosMm(mm);

    // Hover detection when not actively dragging
    if (dragMode === 'none') {
      const hit = findHitObject(mm);
      setHoveredObjectId(hit ? hit.id : null);
    }

    if (dragMode === 'measure' && measureStart) {
      setMeasureEnd(mm);
    } else if (dragMode === 'pan') {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setPan({
        x: dragOriginPan.x + dx,
        y: dragOriginPan.y + dy,
      });
    } else if (dragMode === 'orbit') {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setOrbitYaw(dragOriginOrbit.yaw + dx * 0.5);
      setOrbitPitch(Math.min(85, Math.max(10, dragOriginOrbit.pitch + dy * 0.5)));
    } else if (dragMode === 'select_rect' && selectionRect) {
      setSelectionRect(prev => prev ? { ...prev, currentX: mm.x, currentY: mm.y } : null);
      const minX = Math.min(selectionRect.startX, mm.x);
      const maxX = Math.max(selectionRect.startX, mm.x);
      const minY = Math.min(selectionRect.startY, mm.y);
      const maxY = Math.max(selectionRect.startY, mm.y);

      const matched = gcodeObjects.filter(obj => 
        !hiddenObjectIds.includes(obj.id) &&
        obj.bounds.minX <= maxX && obj.bounds.maxX >= minX &&
        obj.bounds.minY <= maxY && obj.bounds.maxY >= minY
      ).map(o => o.id);

      setSelectedObjectIds(matched);
    } else if (dragMode === 'transform_drag') {
      const dxPx = e.clientX - dragStart.x;
      const dyPx = e.clientY - dragStart.y;
      let dxMm = 0;
      let dyMm = 0;

      if (viewMode === '2d') {
        dxMm = dxPx / zoom;
        dyMm = -dyPx / zoom;
      } else {
        const radYaw = (orbitYaw * Math.PI) / 180;
        const radPitch = (orbitPitch * Math.PI) / 180;
        const sx = dxPx / zoom;
        const sy = -dyPx / (zoom * Math.sin(radPitch));
        dxMm = sx * Math.cos(radYaw) + sy * Math.sin(radYaw);
        dyMm = -sx * Math.sin(radYaw) + sy * Math.cos(radYaw);
      }

      setLiveDragOffset({ x: dxMm, y: dyMm });
    }
  };

  const handleMouseUp = () => {
    if (dragMode === 'select_rect') {
      setSelectionRect(null);
    } else if (dragMode === 'transform_drag') {
      if (Math.hypot(liveDragOffset.x, liveDragOffset.y) >= 0.1) {
        handleApplyTransform(
          Number(liveDragOffset.x.toFixed(2)),
          Number(liveDragOffset.y.toFixed(2)),
          0,
          1.0,
          selectedObjectIds.length > 0 ? selectedObjectIds : undefined
        );
      }
      setLiveDragOffset({ x: 0, y: 0 });
    }
    setDragMode('none');
  };

  const handleDoubleClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const mm = screenToMm(mouseX, mouseY);

    const targetX = Math.max(0, Math.min(currentProfile.bedWidth, Number(mm.x.toFixed(2))));
    const targetY = Math.max(0, Math.min(currentProfile.bedHeight, Number(mm.y.toFixed(2))));

    setDoubleClickTarget({ x: targetX, y: targetY, time: Date.now() });
    setJogToast({ x: targetX, y: targetY });
    setTimeout(() => setJogToast(null), 3000);

    const feed = currentProfile.travelFeedrate || 2000;
    const cmd = `$J=G90 G21 X${targetX.toFixed(3)} Y${targetY.toFixed(3)} F${feed}`;
    try {
      await grbl.send(cmd);
    } catch (err) {
      console.warn('Fehler beim Senden des Jog-Befehls:', err);
    }
  };

  // Cursor-centered focal point zoom & Touchpad Precision Handling
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Drastically reduced speeds for smooth OrbitControls-like touchpad usage
    // Native trackpad momentum acts as our "enableDamping = true" physics engine
    const PAN_SPEED = 0.4;
    const ROTATE_SPEED = 0.15;
    const ZOOM_SPEED = 0.003;

    const applyZoom = (deltaY: number) => {
      const zoomDelta = -deltaY * ZOOM_SPEED;
      const zoomFactor = Math.exp(zoomDelta);
      const newZoom = Math.min(25.0, Math.max(0.12, zoom * zoomFactor));

      const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
      const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    };

    // 1. ZOOM: Ctrl/Cmd + Pinch/Scroll
    if (e.ctrlKey || e.metaKey) {
      applyZoom(e.deltaY);
      return;
    }

    // 2. PAN: Shift + 2-Finger Swipe / Scroll
    if (e.shiftKey) {
      // Standard mouse: shift+scroll = horizontal pan. Trackpad = 2D pan.
      const dx = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      const dy = e.deltaX !== 0 ? e.deltaY : 0;
      setPan(prev => ({ x: prev.x - dx * PAN_SPEED, y: prev.y - dy * PAN_SPEED }));
      return;
    }

    // 3. DEFAULT (No modifiers)
    // Detect standard mouse wheel (large vertical steps) vs touchpad (smooth 2D swiping)
    const isMouseWheel = Math.abs(e.deltaX) === 0 && Math.abs(e.deltaY) >= 20 && e.deltaY % 1 === 0;

    if (viewMode === '2d') {
      if (isMouseWheel) {
        // Standard mouse wheel zooms in 2D
        applyZoom(e.deltaY);
      } else {
        // Touchpad swipe pans in 2D
        setPan(prev => ({ x: prev.x - e.deltaX * PAN_SPEED, y: prev.y - e.deltaY * PAN_SPEED }));
      }
    } else {
      // 3D Isometric Mode
      if (isMouseWheel) {
        // Standard mouse wheel zooms in 3D
        applyZoom(e.deltaY);
      } else {
        // Touchpad swipe rotates in 3D
        setOrbitYaw(prev => prev + e.deltaX * ROTATE_SPEED);
        setOrbitPitch(prev => Math.min(85, Math.max(10, prev - e.deltaY * ROTATE_SPEED)));
      }
    }
  };

  // --- Multi-Touch Native Gesture Handlers (Tablets & Smartphones) ---
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.cancelable) {
      e.preventDefault();
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (e.touches.length === 1) {
      // 1-Finger Gesture: Behaves exactly like Left Mouse Click
      touchModeRef.current = 'single';
      const touch = e.touches[0];
      const touchX = touch.clientX - rect.left;
      const touchY = touch.clientY - rect.top;
      const mm = screenToMm(touchX, touchY);
      setCursorPosMm(mm);
      lastTouchCenterRef.current = { x: touch.clientX, y: touch.clientY };

      if (isMeasureActive) {
        setMeasureStart(mm);
        setMeasureEnd(mm);
        setDragMode('measure');
        setDragStart({ x: touch.clientX, y: touch.clientY });
        return;
      }

      const hitObj = findHitObject(mm);
      if (hitObj) {
        const isLocked = lockedObjectIds.includes(hitObj.id);
        if (!selectedObjectIds.includes(hitObj.id)) {
          setSelectedObjectIds([hitObj.id]);
        }
        if (!isLocked) {
          setDragMode('transform_drag');
          setDragStart({ x: touch.clientX, y: touch.clientY });
          setLiveDragOffset({ x: 0, y: 0 });
        }
      } else {
        setSelectedObjectIds([]);
        setSelectionRect({ startX: mm.x, startY: mm.y, currentX: mm.x, currentY: mm.y });
        setDragMode('select_rect');
        setDragStart({ x: touch.clientX, y: touch.clientY });
      }
    } else if (e.touches.length === 2) {
      // 2-Finger Gesture: Cancel any single-finger marquee or drag without accidental displacement
      setSelectionRect(null);
      setLiveDragOffset({ x: 0, y: 0 });
      setDragMode('none');

      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const centerX = (t0.clientX + t1.clientX) / 2;
      const centerY = (t0.clientY + t1.clientY) / 2;

      initialPinchDistanceRef.current = dist;
      lastTouchCenterRef.current = { x: centerX, y: centerY };
      touchModeRef.current = viewMode === '2d' ? 'pinch_pan' : 'pinch_orbit';
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.cancelable) {
      e.preventDefault();
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (e.touches.length === 1 && touchModeRef.current === 'single') {
      const touch = e.touches[0];
      const touchX = touch.clientX - rect.left;
      const touchY = touch.clientY - rect.top;
      const mm = screenToMm(touchX, touchY);
      setCursorPosMm(mm);

      if (dragMode === 'measure' && measureStart) {
        setMeasureEnd(mm);
      } else if (dragMode === 'select_rect' && selectionRect) {
        setSelectionRect(prev => prev ? { ...prev, currentX: mm.x, currentY: mm.y } : null);
        const minX = Math.min(selectionRect.startX, mm.x);
        const maxX = Math.max(selectionRect.startX, mm.x);
        const minY = Math.min(selectionRect.startY, mm.y);
        const maxY = Math.max(selectionRect.startY, mm.y);

        const matched = gcodeObjects.filter(obj => 
          !hiddenObjectIds.includes(obj.id) &&
          obj.bounds.minX <= maxX && obj.bounds.maxX >= minX &&
          obj.bounds.minY <= maxY && obj.bounds.maxY >= minY
        ).map(o => o.id);

        setSelectedObjectIds(matched);
      } else if (dragMode === 'transform_drag') {
        const dxPx = touch.clientX - dragStart.x;
        const dyPx = touch.clientY - dragStart.y;
        let dxMm = 0;
        let dyMm = 0;

        if (viewMode === '2d') {
          dxMm = dxPx / zoom;
          dyMm = -dyPx / zoom;
        } else {
          const radYaw = (orbitYaw * Math.PI) / 180;
          const radPitch = (orbitPitch * Math.PI) / 180;
          const sx = dxPx / zoom;
          const sy = -dyPx / (zoom * Math.sin(radPitch));
          dxMm = sx * Math.cos(radYaw) + sy * Math.sin(radYaw);
          dyMm = -sx * Math.sin(radYaw) + sy * Math.cos(radYaw);
        }

        setLiveDragOffset({ x: dxMm, y: dyMm });
      }
    } else if (e.touches.length === 2) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const curDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const curCenterX = (t0.clientX + t1.clientX) / 2;
      const curCenterY = (t0.clientY + t1.clientY) / 2;

      const prevDist = initialPinchDistanceRef.current || curDist;
      const prevCenter = lastTouchCenterRef.current || { x: curCenterX, y: curCenterY };

      const deltaX = curCenterX - prevCenter.x;
      const deltaY = curCenterY - prevCenter.y;
      const scaleRatio = prevDist > 0 ? curDist / prevDist : 1.0;

      // 1. Pinch-to-Zoom centered directly between the two touch points
      const focalScreenX = curCenterX - rect.left;
      const focalScreenY = curCenterY - rect.top;

      let newZoom = zoom;
      if (Math.abs(scaleRatio - 1.0) > 0.003) {
        newZoom = Math.min(25.0, Math.max(0.12, zoom * scaleRatio));
      }

      if (viewMode === '2d') {
        // 2D: Zoom centered at touch focal point + 2-Finger Pan translation
        const newPanX = focalScreenX - (focalScreenX - pan.x) * (newZoom / zoom) + deltaX;
        const newPanY = focalScreenY - (focalScreenY - pan.y) * (newZoom / zoom) + deltaY;

        setZoom(newZoom);
        setPan({ x: newPanX, y: newPanY });
      } else {
        // 3D: Zoom + 2-Finger Orbit rotation
        setZoom(newZoom);
        setOrbitYaw(prev => prev + deltaX * 0.5);
        setOrbitPitch(prev => Math.min(85, Math.max(10, prev + deltaY * 0.5)));
      }

      // Record state to avoid jumping when adjusting fingers
      initialPinchDistanceRef.current = curDist;
      lastTouchCenterRef.current = { x: curCenterX, y: curCenterY };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 0) {
      if (dragMode === 'select_rect') {
        setSelectionRect(null);
      } else if (dragMode === 'transform_drag') {
        if (Math.hypot(liveDragOffset.x, liveDragOffset.y) >= 0.1) {
          handleApplyTransform(
            Number(liveDragOffset.x.toFixed(2)),
            Number(liveDragOffset.y.toFixed(2)),
            0,
            1.0,
            selectedObjectIds.length > 0 ? selectedObjectIds : undefined
          );
        }
        setLiveDragOffset({ x: 0, y: 0 });
      }
      setDragMode('none');
      touchModeRef.current = 'none';
      initialPinchDistanceRef.current = null;
      lastTouchCenterRef.current = null;
    } else if (e.touches.length === 1) {
      // Smooth handoff from 2 fingers to 1 finger
      touchModeRef.current = 'none';
      setDragMode('none');
      initialPinchDistanceRef.current = null;
      lastTouchCenterRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  // Passive wheel prevention on viewport container
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const preventWheel = (e: WheelEvent) => {
      e.preventDefault();
    };
    el.addEventListener('wheel', preventWheel, { passive: false });
    return () => el.removeEventListener('wheel', preventWheel);
  }, []);

  // Canvas Rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // 1. Background
    ctx.fillStyle = theme.bgTone || '#090d16';
    ctx.fillRect(0, 0, width, height);

    const { bedWidth, bedHeight } = currentProfile;

    // 2. Draw Machine Bed Boundaries & Millimeter Grid
    if (showGrid) {
      ctx.lineWidth = 1;

      // Minor grid (10mm)
      ctx.strokeStyle = theme.gridColor || 'rgba(30, 41, 59, 0.4)';
      for (let x = 0; x <= bedWidth; x += 10) {
        if (x % 50 === 0) continue;
        const p1 = mmToScreen(x, 0);
        const p2 = mmToScreen(x, bedHeight);
        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.stroke();
      }
      for (let y = 0; y <= bedHeight; y += 10) {
        if (y % 50 === 0) continue;
        const p1 = mmToScreen(0, y);
        const p2 = mmToScreen(bedWidth, y);
        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.stroke();
      }

      // Major grid (50mm) with coordinates labels
      ctx.strokeStyle = theme.gridColor ? theme.gridColor.replace(/0\.\d+\)/, '0.8)') : 'rgba(51, 65, 85, 0.75)';
      ctx.fillStyle = theme.textMuted || '#64748b';
      ctx.font = '10px monospace';

      for (let x = 0; x <= bedWidth; x += 50) {
        const p1 = mmToScreen(x, 0);
        const p2 = mmToScreen(x, bedHeight);
        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.stroke();

        if (viewMode === '2d') {
          ctx.fillText(`${x}`, p1.sx - 8, p1.sy + 14);
        }
      }
      for (let y = 0; y <= bedHeight; y += 50) {
        const p1 = mmToScreen(0, y);
        const p2 = mmToScreen(bedWidth, y);
        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.stroke();

        if (viewMode === '2d') {
          ctx.fillText(`${y}`, p1.sx - 24, p1.sy + 3);
        }
      }
    }

    // Bed Outer Border
    const b00 = mmToScreen(0, 0);
    const b10 = mmToScreen(bedWidth, 0);
    const b11 = mmToScreen(bedWidth, bedHeight);
    const b01 = mmToScreen(0, bedHeight);

    ctx.strokeStyle = theme.accentColor || '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(b00.sx, b00.sy);
    ctx.lineTo(b10.sx, b10.sy);
    ctx.lineTo(b11.sx, b11.sy);
    ctx.lineTo(b01.sx, b01.sy);
    ctx.closePath();
    ctx.stroke();

    // Bed Tint
    ctx.fillStyle = theme.isDark ? 'rgba(15, 23, 42, 0.45)' : 'rgba(255, 255, 255, 0.45)';
    ctx.fill();

    // In 3D, draw bed depth volume (Bauraumhöhe) box extending UPWARDS from Z=0
    const zHeight = currentProfile.bedDepth > 0 ? currentProfile.bedDepth : 50;
    if (viewMode === '3d' && zHeight > 0) {
      const d00 = mmToScreen(0, 0, zHeight);
      const d10 = mmToScreen(bedWidth, 0, zHeight);
      const d11 = mmToScreen(bedWidth, bedHeight, zHeight);
      const d01 = mmToScreen(0, bedHeight, zHeight);

      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      // Vertical corner pillars
      ctx.moveTo(b00.sx, b00.sy); ctx.lineTo(d00.sx, d00.sy);
      ctx.moveTo(b10.sx, b10.sy); ctx.lineTo(d10.sx, d10.sy);
      ctx.moveTo(b11.sx, b11.sy); ctx.lineTo(d11.sx, d11.sy);
      ctx.moveTo(b01.sx, b01.sy); ctx.lineTo(d01.sx, d01.sy);
      // Top ceiling frame
      ctx.moveTo(d00.sx, d00.sy);
      ctx.lineTo(d10.sx, d10.sy);
      ctx.lineTo(d11.sx, d11.sy);
      ctx.lineTo(d01.sx, d01.sy);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = '10px monospace';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.fillText(`Z max: ${zHeight}mm`, d00.sx + 4, d00.sy - 4);
      ctx.restore();
    }

    // 3. Origin (0,0,0) Coordinate Triad with Z-Up Orientation
    if (showOriginMarker) {
      const orig = mmToScreen(0, 0, 0);
      const xAx = mmToScreen(35, 0, 0);
      const yAx = mmToScreen(0, 35, 0);
      const zAx = mmToScreen(0, 0, 35);

      // X-Axis (Red)
      ctx.strokeStyle = '#ef4444';
      ctx.fillStyle = '#ef4444';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(orig.sx, orig.sy);
      ctx.lineTo(xAx.sx, xAx.sy);
      ctx.stroke();
      ctx.font = 'bold 11px monospace';
      ctx.fillText('X+', xAx.sx + 4, xAx.sy + 3);

      // Y-Axis (Green)
      ctx.strokeStyle = '#22c55e';
      ctx.fillStyle = '#22c55e';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(orig.sx, orig.sy);
      ctx.lineTo(yAx.sx, yAx.sy);
      ctx.stroke();
      ctx.fillText('Y+', yAx.sx + 4, yAx.sy + 3);

      // Z-Axis in 3D (Blue)
      if (viewMode === '3d') {
        ctx.strokeStyle = '#3b82f6';
        ctx.fillStyle = '#60a5fa';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(orig.sx, orig.sy);
        ctx.lineTo(zAx.sx, zAx.sy);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(zAx.sx, zAx.sy);
        ctx.lineTo(zAx.sx - 4, zAx.sy + 8);
        ctx.lineTo(zAx.sx + 4, zAx.sy + 8);
        ctx.closePath();
        ctx.fill();

        ctx.fillText('Z+', zAx.sx + 6, zAx.sy - 2);
      }
    }

    // 4. Render Toolpaths with LIVE Drag & Rotation Preview
    if (parsedGcode && parsedGcode.segments.length > 0) {
      const segments = parsedGcode.segments;
      const maxRenderIndex = isSimPlaying || simIndex > 0 ? Math.min(simIndex, segments.length - 1) : segments.length - 1;

      // Real-time live transformation offsets (Center-based rotation + live mouse drag)
      const cX = selectedObject ? selectedObject.center.x : (parsedGcode.bounds.minX + parsedGcode.bounds.maxX) / 2;
      const cY = selectedObject ? selectedObject.center.y : (parsedGcode.bounds.minY + parsedGcode.bounds.maxY) / 2;
      const offX = dragMode === 'transform_drag' ? liveDragOffset.x : 0;
      const offY = dragMode === 'transform_drag' ? liveDragOffset.y : 0;
      const rotRad = (customRotDeg * Math.PI) / 180;

      // Endpoint offset calculation accounting for rapid links
      const getLivePoint = (px: number, py: number, pz: number = 0, segIdx?: number, isFrom?: boolean) => {
        let isTargeted = false;

        if (segIdx !== undefined) {
          const segObjId = segmentObjectIdMap.get(segIdx);
          if (segObjId !== undefined) {
            // Cut segment: targeted if its object is selected (or no specific object selected)
            isTargeted = selectedObjectIds.length === 0 || selectedObjectIds.includes(segObjId);
          } else {
            // Rapid G0 segment: check which endpoint is connected to a moving object
            const link = rapidLinksMap.get(segIdx);
            if (link) {
              const relevantObjId = isFrom ? link.fromObjId : link.toObjId;
              isTargeted = relevantObjId !== null && selectedObjectIds.includes(relevantObjId);
            }
          }
        } else {
          isTargeted = selectedObjectIds.length > 0;
        }

        if (!isTargeted) {
          return { x: px, y: py, z: pz };
        }

        let tx = px;
        let ty = py;
        if (customRotDeg !== 0) {
          const rx = px - cX;
          const ry = py - cY;
          tx = cX + rx * Math.cos(rotRad) - ry * Math.sin(rotRad);
          ty = cY + rx * Math.sin(rotRad) + ry * Math.cos(rotRad);
        }
        return { x: tx + offX, y: ty + offY, z: pz };
      };

      const penUpZ = Math.max(8, currentProfile.penUpZ || 10);
      const penDownZ = Math.max(0, currentProfile.penDownZ || 0);

      // Helper function to render linear or circular arc segment paths accurately
      const renderSegmentPath = (seg: GcodeSegment, segIndex: number, strokeColor: string, lineWidth: number, isDashed: number[] = []) => {
        const isUp = seg.type === 'G0' || seg.penState === 'up';
        const zFrom = viewMode === '3d' ? (isUp ? penUpZ : (seg.from.z || penDownZ)) : 0;
        const zTo = viewMode === '3d' ? (isUp ? penUpZ : (seg.to.z || penDownZ)) : 0;

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        if (isDashed.length > 0) ctx.setLineDash(isDashed);
        else ctx.setLineDash([]);

        ctx.beginPath();
        if ((seg.type === 'G2' || seg.type === 'G3' || seg.type === 'SWIVEL_ARC') && seg.center) {
          const fromX = seg.from.x, fromY = seg.from.y;
          const toX = seg.to.x, toY = seg.to.y;
          const cX = seg.center.x, cY = seg.center.y;
          const r1 = Math.hypot(fromX - cX, fromY - cY);
          const r2 = Math.hypot(toX - cX, toY - cY);
          const radius = (r1 + r2) / 2 || r1;

          if (radius > 0.001) {
            const a1 = Math.atan2(fromY - cY, fromX - cX);
            const a2 = Math.atan2(toY - cY, toX - cX);
            const isCW = seg.clockwise ?? (seg.type === 'G2');
            let sweep = a2 - a1;
            if (isCW) {
              if (sweep > 0) sweep -= 2 * Math.PI;
            } else {
              if (sweep < 0) sweep += 2 * Math.PI;
            }

            const steps = Math.max(12, Math.min(60, Math.ceil(Math.abs(sweep) * 24 / Math.PI)));
            const pt0 = getLivePoint(fromX, fromY, zFrom, segIndex, true);
            const sc0 = mmToScreen(pt0.x, pt0.y, pt0.z);
            ctx.moveTo(sc0.sx, sc0.sy);

            for (let s = 1; s <= steps; s++) {
              const t = s / steps;
              const angle = a1 + sweep * t;
              const zVal = zFrom + (zTo - zFrom) * t;
              const px = cX + radius * Math.cos(angle);
              const py = cY + radius * Math.sin(angle);
              const pt = getLivePoint(px, py, zVal, segIndex, t > 0.5);
              const sc = mmToScreen(pt.x, pt.y, pt.z);
              ctx.lineTo(sc.sx, sc.sy);
            }
          } else {
            const ptFrom = getLivePoint(fromX, fromY, zFrom, segIndex, true);
            const ptTo = getLivePoint(toX, toY, zTo, segIndex, false);
            const pFrom = mmToScreen(ptFrom.x, ptFrom.y, ptFrom.z);
            const pTo = mmToScreen(ptTo.x, ptTo.y, ptTo.z);
            ctx.moveTo(pFrom.sx, pFrom.sy);
            ctx.lineTo(pTo.sx, pTo.sy);
          }
        } else {
          const ptFrom = getLivePoint(seg.from.x, seg.from.y, zFrom, segIndex, true);
          const ptTo = getLivePoint(seg.to.x, seg.to.y, zTo, segIndex, false);
          const pFrom = mmToScreen(ptFrom.x, ptFrom.y, ptFrom.z);
          const pTo = mmToScreen(ptTo.x, ptTo.y, ptTo.z);
          ctx.moveTo(pFrom.sx, pFrom.sy);
          ctx.lineTo(pTo.sx, pTo.sy);
        }
        ctx.stroke();
        if (isDashed.length > 0) ctx.setLineDash([]);
      };

      // Draw all paths up to current simulation position
      for (let i = 0; i <= maxRenderIndex; i++) {
        const seg = segments[i];
        const segObjId = segmentObjectIdMap.get(i);

        // Skip hidden objects
        if (segObjId !== undefined && hiddenObjectIds.includes(segObjId)) {
          continue;
        }

        const isSelected = segObjId !== undefined && selectedObjectIds.includes(segObjId);
        const isHovered = segObjId !== undefined && hoveredObjectId === segObjId && !isSelected;
        const isUp = seg.type === 'G0' || seg.penState === 'up';

        const zFrom = viewMode === '3d' ? (isUp ? penUpZ : (seg.from.z || penDownZ)) : 0;
        const ptFrom = getLivePoint(seg.from.x, seg.from.y, zFrom, i, true);

        if (seg.type === 'PEN_DOWN' && viewMode === '3d') {
          if (showRapid) {
            const pTop = mmToScreen(ptFrom.x, ptFrom.y, penUpZ);
            const pBot = mmToScreen(ptFrom.x, ptFrom.y, penDownZ);
            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 1.8;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(pTop.sx, pTop.sy);
            ctx.lineTo(pBot.sx, pBot.sy);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        } else if (seg.type === 'PEN_UP' && viewMode === '3d') {
          if (showRapid) {
            const pBot = mmToScreen(ptFrom.x, ptFrom.y, penDownZ);
            const pTop = mmToScreen(ptFrom.x, ptFrom.y, penUpZ);
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 1.8;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(pBot.sx, pBot.sy);
            ctx.lineTo(pTop.sx, pTop.sy);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        } else if (isUp) {
          // Rapid travel move (Unified Eilgang / Leerfahrt: Muted / Dashed in air)
          if (showRapid) {
            renderSegmentPath(seg, i, theme.rapidLineColor || '#ef4444', 1.2, [4, 4]);

            if (viewMode === '3d') {
              // Retract lift at start of rapid if previous move was on bed
              if (i === 0 || (segments[i - 1].type !== 'G0' && segments[i - 1].type !== 'PEN_UP' && segments[i - 1].type !== 'PEN_DOWN')) {
                const ptRetractDown = getLivePoint(seg.from.x, seg.from.y, penDownZ, i, true);
                const ptRetractUp = getLivePoint(seg.from.x, seg.from.y, penUpZ, i, true);
                const pBot = mmToScreen(ptRetractDown.x, ptRetractDown.y, ptRetractDown.z);
                const pTop = mmToScreen(ptRetractUp.x, ptRetractUp.y, ptRetractUp.z);
                ctx.strokeStyle = 'rgba(244, 63, 94, 0.5)';
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 3]);
                ctx.beginPath();
                ctx.moveTo(pBot.sx, pBot.sy);
                ctx.lineTo(pTop.sx, pTop.sy);
                ctx.stroke();
                ctx.setLineDash([]);
              }

              // Plunge drop at end of rapid if next move is on bed
              if (i === segments.length - 1 || (segments[i + 1].type !== 'G0' && segments[i + 1].type !== 'PEN_UP' && segments[i + 1].type !== 'PEN_DOWN')) {
                const ptPlungeUp = getLivePoint(seg.to.x, seg.to.y, penUpZ, i, false);
                const ptPlungeDown = getLivePoint(seg.to.x, seg.to.y, penDownZ, i, false);
                const pTop = mmToScreen(ptPlungeUp.x, ptPlungeUp.y, ptPlungeUp.z);
                const pBot = mmToScreen(ptPlungeDown.x, ptPlungeDown.y, ptPlungeDown.z);
                ctx.strokeStyle = 'rgba(34, 197, 94, 0.65)';
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 3]);
                ctx.beginPath();
                ctx.moveTo(pTop.sx, pTop.sy);
                ctx.lineTo(pBot.sx, pBot.sy);
                ctx.stroke();
                ctx.setLineDash([]);
              }
            }
          }
        } else if (seg.type === 'SWIVEL_ARC') {
          // Drag knife swivel compensation arc (matching GeneratorSuite amber/yellow)
          if (showSwivelArcs) {
            const arcColor = isSelected ? '#c084fc' : (isHovered ? '#38bdf8' : (theme.accentColor || '#f59e0b'));
            renderSegmentPath(seg, i, arcColor, isSelected || isHovered ? 3.0 : 2.5);

            // Swivel Pivot Node
            const ptTo = getLivePoint(seg.to.x, seg.to.y, zFrom, i, false);
            const pTo = mmToScreen(ptTo.x, ptTo.y, ptTo.z);
            ctx.fillStyle = isSelected ? '#e9d5ff' : (isHovered ? '#38bdf8' : (theme.accentColor || '#fbbf24'));
            ctx.beginPath();
            ctx.arc(pTo.sx, pTo.sy, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          // Normal cutting / laser / drawing move
          if (showCutPaths) {
            let cutColor = theme.cutLineColor || '#10b981';
            let cutWidth = 2.0;

            if (isSelected) {
              cutColor = '#c084fc'; // Purple selected
              cutWidth = 2.8;
            } else if (isHovered) {
              cutColor = '#38bdf8'; // Glowing Cyan hover
              cutWidth = 2.6;
            }

            renderSegmentPath(seg, i, cutColor, cutWidth);
          }
        }
      }

      // Draw ghost remaining paths when scrubbing simulation
      if (maxRenderIndex < segments.length - 1 && showCutPaths) {
        for (let i = maxRenderIndex + 1; i < segments.length; i++) {
          const seg = segments[i];
          const segObjId = segmentObjectIdMap.get(i);
          if (segObjId !== undefined && hiddenObjectIds.includes(segObjId)) continue;
          const isUp = seg.type === 'G0' || seg.penState === 'up';
          if (!isUp && seg.penState === 'down') {
            renderSegmentPath(seg, i, theme.isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(100, 116, 139, 0.25)', 1);
          }
        }
      }

      // Draw Selection Marquee Box if active
      if (selectionRect && viewMode === '2d') {
        const minX = Math.min(selectionRect.startX, selectionRect.currentX);
        const maxX = Math.max(selectionRect.startX, selectionRect.currentX);
        const minY = Math.min(selectionRect.startY, selectionRect.currentY);
        const maxY = Math.max(selectionRect.startY, selectionRect.currentY);

        const p1 = mmToScreen(minX, minY);
        const p2 = mmToScreen(maxX, maxY);

        ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
        ctx.fillRect(p1.sx, p2.sy, p2.sx - p1.sx, p1.sy - p2.sy);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(p1.sx, p2.sy, p2.sx - p1.sx, p1.sy - p2.sy);
        ctx.setLineDash([]);
      }

      // Draw Individual Objects & Bounding Boxes in 2D
      if (viewMode === '2d') {
        // Draw subtle outline around non-selected objects when hovering or when multiple objects exist
        if (gcodeObjects.length > 1) {
          gcodeObjects.forEach(obj => {
            if (hiddenObjectIds.includes(obj.id) || selectedObjectIds.includes(obj.id)) return;
            const isHover = hoveredObjectId === obj.id;

            const bP1 = mmToScreen(obj.bounds.minX, obj.bounds.minY);
            const bP2 = mmToScreen(obj.bounds.maxX, obj.bounds.minY);
            const bP3 = mmToScreen(obj.bounds.maxX, obj.bounds.maxY);
            const bP4 = mmToScreen(obj.bounds.minX, obj.bounds.maxY);

            ctx.strokeStyle = isHover ? 'rgba(56, 189, 248, 0.8)' : 'rgba(148, 163, 184, 0.35)';
            ctx.lineWidth = isHover ? 1.5 : 1;
            ctx.setLineDash(isHover ? [4, 4] : [3, 3]);
            ctx.beginPath();
            ctx.moveTo(bP1.sx, bP1.sy);
            ctx.lineTo(bP2.sx, bP2.sy);
            ctx.lineTo(bP3.sx, bP3.sy);
            ctx.lineTo(bP4.sx, bP4.sy);
            ctx.closePath();
            ctx.stroke();
            ctx.setLineDash([]);

            // Label tag on top left
            ctx.fillStyle = isHover ? 'rgba(8, 47, 73, 0.85)' : 'rgba(15, 23, 42, 0.75)';
            ctx.fillRect(bP1.sx, bP1.sy - 16, 54, 14);
            ctx.fillStyle = isHover ? '#38bdf8' : '#94a3b8';
            ctx.font = '9px monospace';
            ctx.fillText(obj.name || `Obj ${obj.id + 1}`, bP1.sx + 4, bP1.sy - 5);
          });
        }

        // Draw Active Bounding Box for selection
        if (selectedObjectIds.length > 0 || customRotDeg !== 0 || dragMode === 'transform_drag') {
          let activeBoundsBox = parsedGcode.bounds;
          if (selectedObjectIds.length > 0) {
            const selectedObjs = gcodeObjects.filter(o => selectedObjectIds.includes(o.id));
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            selectedObjs.forEach(o => {
              if (o.bounds.minX < minX) minX = o.bounds.minX;
              if (o.bounds.maxX > maxX) maxX = o.bounds.maxX;
              if (o.bounds.minY < minY) minY = o.bounds.minY;
              if (o.bounds.maxY > maxY) maxY = o.bounds.maxY;
            });
            activeBoundsBox = { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
          } else if (selectedObject) {
            activeBoundsBox = selectedObject.bounds;
          }
          const { minX, minY, maxX, maxY } = activeBoundsBox;

          const pt1 = getLivePoint(minX, minY);
          const pt2 = getLivePoint(maxX, minY);
          const pt3 = getLivePoint(maxX, maxY);
          const pt4 = getLivePoint(minX, maxY);

          const p1 = mmToScreen(pt1.x, pt1.y);
          const p2 = mmToScreen(pt2.x, pt2.y);
          const p3 = mmToScreen(pt3.x, pt3.y);
          const p4 = mmToScreen(pt4.x, pt4.y);

          ctx.strokeStyle = dragMode === 'transform_drag' ? '#38bdf8' : (customRotDeg !== 0 ? '#f59e0b' : '#c084fc');
          ctx.lineWidth = dragMode === 'transform_drag' ? 2 : 1.5;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(p1.sx, p1.sy);
          ctx.lineTo(p2.sx, p2.sy);
          ctx.lineTo(p3.sx, p3.sy);
          ctx.lineTo(p4.sx, p4.sy);
          ctx.closePath();
          ctx.stroke();
          ctx.setLineDash([]);

          // Center crosshair marker
          const centerPt = mmToScreen(cX + offX, cY + offY);
          ctx.fillStyle = dragMode === 'transform_drag' ? '#38bdf8' : (customRotDeg !== 0 ? '#f59e0b' : '#c084fc');
          ctx.beginPath();
          ctx.arc(centerPt.sx, centerPt.sy, 4, 0, Math.PI * 2);
          ctx.fill();

          // Active object / selection name badge
          let objTitle = `Gesamtes Motiv (${actualBounds.width}×${actualBounds.height} mm)`;
          if (selectedObjectIds.length > 1) {
            objTitle = `${selectedObjectIds.length} Objekte ausgewählt (${activeBoundsBox.width.toFixed(1)}×${activeBoundsBox.height.toFixed(1)} mm)`;
          } else if (selectedObject) {
            objTitle = `${selectedObject.name} (${selectedObject.bounds.width.toFixed(1)}×${selectedObject.bounds.height.toFixed(1)} mm)`;
          }

          ctx.font = 'bold 10px monospace';
          const titleW = ctx.measureText(objTitle).width;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          ctx.fillRect(p1.sx, p1.sy - 20, titleW + 12, 18);
          ctx.strokeStyle = selectedObjectIds.length > 0 ? '#c084fc' : '#a855f7';
          ctx.strokeRect(p1.sx, p1.sy - 20, titleW + 12, 18);
          ctx.fillStyle = selectedObjectIds.length > 0 ? '#e9d5ff' : '#d8b4fe';
          ctx.fillText(objTitle, p1.sx + 6, p1.sy - 7);

          // Drag offset or rotation live tooltip tag
          if (dragMode === 'transform_drag' && (offX !== 0 || offY !== 0)) {
            const tag = `ΔX: ${offX > 0 ? '+' : ''}${offX.toFixed(1)} mm | ΔY: ${offY > 0 ? '+' : ''}${offY.toFixed(1)} mm`;
            ctx.font = 'bold 11px monospace';
            const tagW = ctx.measureText(tag).width;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            ctx.fillRect(centerPt.sx - tagW / 2 - 6, centerPt.sy - 28, tagW + 12, 20);
            ctx.strokeStyle = '#38bdf8';
            ctx.strokeRect(centerPt.sx - tagW / 2 - 6, centerPt.sy - 28, tagW + 12, 20);
            ctx.fillStyle = '#38bdf8';
            ctx.fillText(tag, centerPt.sx - tagW / 2, centerPt.sy - 14);
          } else if (customRotDeg !== 0) {
            const tag = `Drehwinkel: ${customRotDeg > 0 ? '+' : ''}${customRotDeg}°`;
            ctx.font = 'bold 11px monospace';
            const tagW = ctx.measureText(tag).width;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            ctx.fillRect(centerPt.sx - tagW / 2 - 6, centerPt.sy - 28, tagW + 12, 20);
            ctx.strokeStyle = '#f59e0b';
            ctx.strokeRect(centerPt.sx - tagW / 2 - 6, centerPt.sy - 28, tagW + 12, 20);
            ctx.fillStyle = '#fbbf24';
            ctx.fillText(tag, centerPt.sx - tagW / 2, centerPt.sy - 14);
          }
        }
      }
    }

    // 4. Render Active Toolhead / Pen & Drag Knife Marker
    let toolheadPos: Point3D = {
      x: liveState?.wpos?.x ?? 0,
      y: liveState?.wpos?.y ?? 0,
      z: liveState?.wpos?.z ?? 0,
    };
    let toolAngle: number | undefined = undefined;

    if (isSimPlaying && parsedGcode && parsedGcode.segments.length > 0) {
      const curSeg = parsedGcode.segments[simIndex];
      if (curSeg) {
        toolheadPos = curSeg.to;
        toolAngle = curSeg.knifeAngle;
      }
    }

    const toolScr = mmToScreen(toolheadPos.x, toolheadPos.y, toolheadPos.z);

    // Outer Target Rings
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(toolScr.sx, toolScr.sy, 8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.arc(toolScr.sx, toolScr.sy, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // 5. Render Double-Click Target Reticle (if recently clicked)
    if (doubleClickTarget && Date.now() - doubleClickTarget.time < 3000) {
      const tgtScr = mmToScreen(doubleClickTarget.x, doubleClickTarget.y, 0);
      const ageMs = Date.now() - doubleClickTarget.time;
      const pulse = 1 + (ageMs % 800) / 800;

      ctx.strokeStyle = `rgba(16, 185, 129, ${Math.max(0, 1 - ageMs / 3000)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tgtScr.sx, tgtScr.sy, 12 * pulse, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(16, 185, 129, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(tgtScr.sx, tgtScr.sy, 6, 0, Math.PI * 2);
      ctx.moveTo(tgtScr.sx - 10, tgtScr.sy);
      ctx.lineTo(tgtScr.sx + 10, tgtScr.sy);
      ctx.moveTo(tgtScr.sx, tgtScr.sy - 10);
      ctx.lineTo(tgtScr.sx, tgtScr.sy + 10);
      ctx.stroke();
    }

    // In 3D mode, draw vertical tool stalk
    if (viewMode === '3d') {
      const topStalk = mmToScreen(toolheadPos.x, toolheadPos.y, toolheadPos.z + 15);
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(toolScr.sx, toolScr.sy);
      ctx.lineTo(topStalk.sx, topStalk.sy);
      ctx.stroke();
    }

    // Drag Knife Swivel Heading Blade Needle
    if (currentProfile.dragKnife?.enabled && toolAngle !== undefined && showBladeTrail) {
      const bladeLen = (currentProfile.dragKnife.bladeOffset || 0.45) * zoom * 6;
      const bx = toolScr.sx - Math.cos(toolAngle) * Math.max(12, bladeLen);
      const by = toolScr.sy + Math.sin(toolAngle) * Math.max(12, bladeLen);

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(toolScr.sx, toolScr.sy);
      ctx.lineTo(bx, by);
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(bx, by, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Render Active Measurement Line & Dimensions Badge (Unified Precision Measurement Tool)
    if (isMeasureActive && measureStart && measureEnd) {
      const p1Scr = mmToScreen(measureStart.x, measureStart.y, 0);
      const p2Scr = mmToScreen(measureEnd.x, measureEnd.y, 0);
      const dxMm = measureEnd.x - measureStart.x;
      const dyMm = measureEnd.y - measureStart.y;
      const distMm = Math.hypot(dxMm, dyMm);
      const angleDeg = (Math.atan2(dyMm, dxMm) * 180) / Math.PI;

      ctx.save();
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(p1Scr.sx, p1Scr.sy);
      ctx.lineTo(p2Scr.sx, p2Scr.sy);
      ctx.stroke();
      ctx.setLineDash([]);

      // Crosshair end caps (Start: Emerald Green #10b981, End: Cyan #06b6d4)
      [p1Scr, p2Scr].forEach((p, idx) => {
        ctx.fillStyle = idx === 0 ? '#10b981' : '#06b6d4';
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = idx === 0 ? '#10b981' : '#06b6d4';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.sx - 8, p.sy); ctx.lineTo(p.sx + 8, p.sy);
        ctx.moveTo(p.sx, p.sy - 8); ctx.lineTo(p.sx, p.sy + 8);
        ctx.stroke();
      });

      // Dual-line floating badge at midpoint
      const midX = (p1Scr.sx + p2Scr.sx) / 2;
      const midY = (p1Scr.sy + p2Scr.sy) / 2;
      const label1 = `Länge: ${distMm.toFixed(2)} mm`;
      const label2 = `ΔX: ${dxMm.toFixed(2)} mm | ΔY: ${dyMm.toFixed(2)} mm (${angleDeg.toFixed(1)}°)`;

      ctx.font = 'bold 12px monospace';
      const w1 = ctx.measureText(label1).width;
      ctx.font = '10px monospace';
      const w2 = ctx.measureText(label2).width;
      const badgeW = Math.max(w1, w2) + 20;
      const badgeH = 34;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.fillRect(midX - badgeW / 2, midY - badgeH / 2, badgeW, badgeH);
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(midX - badgeW / 2, midY - badgeH / 2, badgeW, badgeH);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label1, midX, midY - 3);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label2, midX, midY + 11);
      ctx.restore();
    }

    // 7. Render Active Marquee Selection Box
    if (selectionRect) {
      ctx.save();
      const minX = Math.min(selectionRect.startX, selectionRect.currentX);
      const maxX = Math.max(selectionRect.startX, selectionRect.currentX);
      const minY = Math.min(selectionRect.startY, selectionRect.currentY);
      const maxY = Math.max(selectionRect.startY, selectionRect.currentY);

      if (viewMode === '2d') {
        const pTopLeft = mmToScreen(minX, maxY);
        const pBotRight = mmToScreen(maxX, minY);
        const w = pBotRight.sx - pTopLeft.sx;
        const h = pBotRight.sy - pTopLeft.sy;

        ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
        ctx.fillRect(pTopLeft.sx, pTopLeft.sy, w, h);

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(pTopLeft.sx, pTopLeft.sy, w, h);
      } else {
        const p1 = mmToScreen(minX, minY, 0);
        const p2 = mmToScreen(maxX, minY, 0);
        const p3 = mmToScreen(maxX, maxY, 0);
        const p4 = mmToScreen(minX, maxY, 0);

        ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.lineTo(p3.sx, p3.sy);
        ctx.lineTo(p4.sx, p4.sy);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.lineTo(p3.sx, p3.sy);
        ctx.lineTo(p4.sx, p4.sy);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    }
  }, [
    parsedGcode,
    currentProfile,
    liveState,
    viewMode,
    zoom,
    pan,
    orbitYaw,
    orbitPitch,
    showGrid,
    showCutPaths,
    showRapid,
    showSwivelArcs,
    showOriginMarker,
    showBladeTrail,
    simIndex,
    isSimPlaying,
    activeMenu,
    liveDragOffset,
    customRotDeg,
    dragMode,
    doubleClickTarget,
    selectedObjectIds,
    hoveredObjectId,
    hiddenObjectIds,
    selectionRect,
    isMeasureActive,
    measureStart,
    measureEnd,
    theme
  ]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full flex flex-col bg-slate-950 relative overflow-hidden select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Top Floating Control Bar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
        {/* Left: 2D/3D Mode, Undo/Redo, Layer Toggles, Measurement */}
        <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-lg border border-slate-800 pointer-events-auto shadow-lg text-xs">
          {/* 2D / 3D Mode */}
          <div className="flex items-center bg-slate-950 rounded-md p-0.5 border border-slate-800">
            <button
              onClick={() => {
                setViewMode('2d');
                fitToView('2d');
              }}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                viewMode === '2d' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              2D Plan
            </button>
            <button
              onClick={() => {
                setViewMode('3d');
                fitToView('3d');
              }}
              className={`px-3 py-1 rounded font-medium flex items-center gap-1 transition-colors ${
                viewMode === '3d' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Box className="w-3 h-3" />
              <span>3D Iso</span>
            </button>
          </div>

          {/* Undo / Redo Arrow Buttons (User Request) */}
          <div className="flex items-center bg-slate-950 rounded-md p-0.5 border border-slate-800">
            <button
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Rückgängig (Strg+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Wiederholen (Strg+Y / Strg+Shift+Z)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          {/* Quick 3D Reset in 3D Mode */}
          {viewMode === '3d' && (
            <button
              onClick={() => {
                setOrbitYaw(45);
                setOrbitPitch(55);
                fitToView('3d');
              }}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] transition-colors"
              title="3D Ansicht zurücksetzen"
            >
              3D Reset
            </button>
          )}

          {/* Messen (Measure) Toggle Button (User Request: must remain in both windows) */}
          <button
            onClick={() => {
              setIsMeasureActive(!isMeasureActive);
              setMeasureStart(null);
              setMeasureEnd(null);
            }}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
              isMeasureActive
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/40'
                : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800'
            }`}
            title="Abstand auf der Arbeitsfläche messen"
          >
            <Ruler className="w-3.5 h-3.5 text-cyan-400" />
            <span>Messen</span>
          </button>

          {/* Layer toggles */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-1.5 rounded transition-colors ${
              showGrid ? 'bg-slate-800 text-cyan-400' : 'text-slate-500 hover:text-slate-300'
            }`}
            title="Gitter anzeigen / verbergen"
          >
            <Grid className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowRapid(!showRapid)}
            className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
              showRapid ? 'bg-slate-800 text-cyan-400' : 'text-slate-500'
            }`}
            title="Leerfahrten (G0 Rapid) anzeigen"
          >
            Eilgang (G0)
          </button>

          {currentProfile.dragKnife?.enabled && (
            <button
              onClick={() => setShowSwivelArcs(!showSwivelArcs)}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                showSwivelArcs ? 'bg-amber-950/60 text-amber-400 border border-amber-800/40' : 'text-slate-500'
              }`}
              title="Schleppmesser-Drehbögen (Swivel Arcs) hervorheben"
            >
              Messerbögen
            </button>
          )}

          {/* Farb-Legende Toggle Button (User Request) */}
          <button
            onClick={() => setShowLegend(prev => !prev)}
            className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-all ${
              showLegend
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="Farb-Legende anzeigen / ausblenden"
          >
            <Info className="w-3.5 h-3.5 text-indigo-400" />
            <span>Legende</span>
          </button>
        </div>

        {/* Center/Right: Inspector Toggle Button */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {parsedGcode && parsedGcode.segments.length > 0 && (
            <button
              onClick={() => setIsInspectorOpen(!isInspectorOpen)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all shadow-md text-xs border ${
                isInspectorOpen
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-indigo-950/60'
                  : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-indigo-300 hover:text-white'
              }`}
              title="Inspektor-Panel mit Ebenen, Position, Skalierung & Drehung öffnen/schließen"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Inspektor &amp; Ebenen</span>
              <span className="bg-indigo-950/80 border border-indigo-800/60 px-1.5 py-0.2 rounded text-[10px] text-indigo-300 font-mono">
                {gcodeObjects.length}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Multi-Selection Active Floating Action Bar */}
      {selectedObjectIds.length > 0 && !isInspectorOpen && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-slate-900/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-indigo-500/50 shadow-2xl text-xs text-slate-200 pointer-events-auto animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-1.5 font-semibold text-indigo-300 pr-2 border-r border-slate-700">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>{selectedObjectIds.length} gewählt</span>
          </div>

          <button
            onClick={() => handleCenterOnBed()}
            className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors"
            title="Auf Bettmitte zentrieren"
          >
            <AlignCenter className="w-3 h-3 text-indigo-400" />
            <span>Zentrieren</span>
          </button>

          <button
            onClick={() => handleMoveToOrigin()}
            className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors"
            title="Zu Nullpunkt (0,0)"
          >
            <CornerDownLeft className="w-3 h-3 text-cyan-400" />
            <span>Nullpunkt</span>
          </button>

          <button
            onClick={() => handleDuplicateObjects()}
            className="flex items-center gap-1 px-2 py-1 bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-800/50 rounded transition-colors"
            title="Duplizieren"
          >
            <Copy className="w-3 h-3 text-indigo-400" />
            <span>Duplizieren</span>
          </button>

          <button
            onClick={handleDeleteSelected}
            className="flex items-center gap-1 px-2 py-1 bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/50 rounded transition-colors"
            title="Löschen"
          >
            <Trash2 className="w-3 h-3 text-red-400" />
            <span>Löschen</span>
          </button>

          <button
            onClick={() => setIsInspectorOpen(true)}
            className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium transition-colors ml-1"
          >
            <Sliders className="w-3 h-3" />
            <span>Inspektor</span>
          </button>

          <button
            onClick={() => setSelectedObjectIds([])}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors ml-1"
            title="Auswahl aufheben"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Measurement Active Floating Banner (Matching Generator Window) */}
      {isMeasureActive && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-slate-900/95 backdrop-blur-md px-4 py-2 rounded-xl border border-cyan-500/50 shadow-2xl text-xs text-slate-200 pointer-events-auto animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-1.5 font-semibold text-cyan-300">
            <Ruler className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>Messwerkzeug:</span>
          </div>

          {measureStart && measureEnd ? (
            <div className="flex items-center gap-3 font-mono">
              <span className="text-cyan-200 font-bold bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60">
                {Math.hypot(measureEnd.x - measureStart.x, measureEnd.y - measureStart.y).toFixed(2)} mm
              </span>
              <span className="text-slate-400 text-[11px]">
                ΔX: {(measureEnd.x - measureStart.x).toFixed(2)} mm | ΔY: {(measureEnd.y - measureStart.y).toFixed(2)} mm ({(Math.atan2(measureEnd.y - measureStart.y, measureEnd.x - measureStart.x) * 180 / Math.PI).toFixed(1)}°)
              </span>
            </div>
          ) : (
            <span className="text-slate-400">Klicke &amp; ziehe mit der Maus, um Distanzen und Abstände zu messen</span>
          )}

          <div className="flex items-center gap-1.5 ml-2 border-l border-slate-700 pl-2">
            {measureStart && (
              <button
                onClick={() => { setMeasureStart(null); setMeasureEnd(null); }}
                className="px-2 py-0.5 bg-cyan-900/80 hover:bg-cyan-800 text-cyan-200 rounded border border-cyan-700/60 text-[11px] font-medium"
              >
                Messung löschen
              </button>
            )}
            <button
              onClick={() => { setIsMeasureActive(false); setMeasureStart(null); setMeasureEnd(null); }}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 text-[11px]"
              title="Messmodus beenden"
            >
              Beenden
            </button>
          </div>
        </div>
      )}



      {/* Workspace container with Canvas and Collapsible Inspector Panel */}
      <div className="flex-1 w-full min-h-0 flex overflow-hidden relative">
        {/* Main Canvas Viewport with Touch/Pinch, Right-Click Orbit, Middle-Click Pan, Left-Click Marquee Box */}
        <div 
          ref={viewportRef}
          className={`flex-1 h-full min-w-0 relative touch-none select-none ${
            dragMode === 'transform_drag' ? 'cursor-grabbing' : (dragMode === 'pan' || dragMode === 'orbit') ? 'cursor-grabbing' : 'cursor-default'
          }`}
          onContextMenu={(e) => e.preventDefault()}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          <canvas ref={canvasRef} className="w-full h-full block" />

          {/* Empty State Banner with Direct Generator Link */}
          {(!parsedGcode || parsedGcode.segments.length === 0) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-6 text-center z-10">
              <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 p-6 rounded-2xl max-w-sm shadow-2xl space-y-4 pointer-events-auto animate-in fade-in zoom-in-95">
                <div className="w-12 h-12 rounded-xl bg-indigo-950/80 border border-indigo-700/50 flex items-center justify-center mx-auto text-indigo-400 shadow-inner">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-slate-100 text-sm">Kein G-Code geladen</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Erstelle ein Motiv mit der Generator-Suite oder importiere eine G-Code / SVG Datei.
                  </p>
                </div>
                {onOpenGenerator && (
                  <button
                    onClick={onOpenGenerator}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/50 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Generator Suite öffnen</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 3D Orientation ViewCube in Screen Corner (Positioned down to not obstruct top controls) */}
          <ViewCube
            yaw={orbitYaw}
            pitch={orbitPitch}
            viewMode={viewMode}
            onOrientationChange={(newYaw, newPitch, mode) => {
              setOrbitYaw(newYaw);
              setOrbitPitch(newPitch);
              if (mode) setViewMode(mode);
            }}
            onResetHome={() => {
              setOrbitYaw(45);
              setOrbitPitch(55);
              fitToView('3d');
            }}
            className="absolute top-24 right-3 z-10 pointer-events-auto"
          />

        {/* Floating Double-Click Jog Confirmation Toast */}
        {jogToast && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-emerald-950/90 border border-emerald-500/60 backdrop-blur-md px-4 py-2 rounded-xl text-xs text-emerald-200 font-mono flex items-center gap-2 shadow-2xl animate-in fade-in zoom-in-95 pointer-events-none z-20">
            <Navigation className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>Fahre Kopf zu: <strong>X: {jogToast.x.toFixed(1)} mm, Y: {jogToast.y.toFixed(1)} mm</strong></span>
          </div>
        )}

        {/* Interactive Live Color Legend Overlay */}
        {showLegend && (
          <div className="absolute bottom-11 left-3 bg-slate-950/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-800 text-[11px] text-slate-300 flex items-center gap-2 shadow-xl pointer-events-auto z-10 animate-in fade-in select-none">
            <button
              onClick={() => setShowCutPaths(prev => !prev)}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-all cursor-pointer ${
                showCutPaths
                  ? 'bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 font-semibold'
                  : 'bg-slate-900/60 border border-slate-800 text-slate-500 line-through opacity-60 hover:opacity-100'
              }`}
              title="Klicken: Bearbeitungs- und Schnittlinien ein-/ausblenden"
            >
              <span className={`w-3 h-1 rounded-full ${showCutPaths ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-slate-600'}`} />
              <span>Bearbeitung (Schnitt / Stift / Laser)</span>
            </button>

            <button
              onClick={() => setShowRapid(prev => !prev)}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-all cursor-pointer ${
                showRapid
                  ? 'bg-rose-950/70 border border-rose-500/50 text-rose-300 font-semibold'
                  : 'bg-slate-900/60 border border-slate-800 text-slate-500 line-through opacity-60 hover:opacity-100'
              }`}
              title="Klicken: Leerfahrten / Eilgang (G0) ein-/ausblenden"
            >
              <span className={`w-3 border-b-2 border-dashed ${showRapid ? 'border-rose-500' : 'border-slate-600'}`} />
              <span>Leerfahrt / Eilgang (G0)</span>
            </button>

            {currentProfile.dragKnife?.enabled && (
              <button
                onClick={() => setShowSwivelArcs(prev => !prev)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-all cursor-pointer ${
                  showSwivelArcs
                    ? 'bg-amber-950/70 border border-amber-500/50 text-amber-300 font-semibold'
                    : 'bg-slate-900/60 border border-slate-800 text-slate-500 line-through opacity-60 hover:opacity-100'
                }`}
                title="Klicken: Messer-Schwenkbögen ein-/ausblenden"
              >
                <span className={`w-3 h-1 rounded-full ${showSwivelArcs ? 'bg-amber-500' : 'bg-slate-600'}`} />
                <span>Messer-Schwenkbögen</span>
              </button>
            )}

            <button
              onClick={() => setShowOriginMarker(prev => !prev)}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-all cursor-pointer ${
                showOriginMarker
                  ? 'bg-cyan-950/70 border border-cyan-500/50 text-cyan-300 font-semibold'
                  : 'bg-slate-900/60 border border-slate-800 text-slate-500 line-through opacity-60 hover:opacity-100'
              }`}
              title="Klicken: Nullpunkt / Start-Achsen ein-/ausblenden"
            >
              <span className={`w-2 h-2 rounded-full ${showOriginMarker ? 'bg-cyan-400' : 'bg-slate-600'}`} />
              <span>Nullpunkt / Start</span>
            </button>

            <button
              onClick={() => setShowLegend(false)}
              className="text-slate-500 hover:text-slate-300 text-[10px] pl-1 border-l border-slate-800 cursor-pointer"
              title="Legende minimieren"
            >
              ✕
            </button>
          </div>
        )}

        {/* Bottom Left Coordinate & Nav HUD */}
        <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-md border border-slate-800 text-[11px] font-mono text-slate-300 flex items-center gap-3 pointer-events-none shadow-md z-10">
          <div className="flex items-center gap-1">
            <span className="text-slate-500">Maus:</span>
            <span className="text-slate-200">{cursorPosMm.x.toFixed(1)}mm, {cursorPosMm.y.toFixed(1)}mm</span>
          </div>
          <div className="h-3 w-px bg-slate-800" />
          <div className="flex items-center gap-1">
            <span className="text-slate-500">Kopf:</span>
            <span className="text-cyan-400 font-semibold">{(liveState?.wpos?.x ?? 0).toFixed(1)}, {(liveState?.wpos?.y ?? 0).toFixed(1)}</span>
          </div>
          <div className="h-3 w-px bg-slate-800" />
          <div className="hidden sm:flex items-center gap-1 text-[10px] text-emerald-400/90">
            <MousePointerClick className="w-3 h-3 text-emerald-400" />
            <span>Doppelklick = Kopf fahren</span>
          </div>
        </div>

        {/* Job Stats Badge (Placed in Bottom-Right Corner to completely avoid ViewCube collision) */}
        {parsedGcode && parsedGcode.segments.length > 0 && (
          <div className="absolute bottom-3 right-3 bg-slate-900/95 backdrop-blur-md p-2.5 rounded-lg border border-slate-800 text-xs text-slate-300 pointer-events-none shadow-xl space-y-1 max-w-[220px] z-10">
            <div className="font-semibold text-slate-100 flex items-center justify-between pb-1 border-b border-slate-800">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                Statistik
              </span>
              <span className="text-[10px] text-indigo-300 font-mono bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-800/50">{parsedGcode.stats.lineCount} Zeilen</span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-slate-400">Schnitt/Zeichnen:</span>
              <span className="text-emerald-400 font-mono font-semibold">{(parsedGcode.stats.cutLength / 10).toFixed(1)} cm</span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-slate-400">Leerfahrt:</span>
              <span className="text-rose-400 font-mono font-semibold">{(parsedGcode.stats.travelLength / 10).toFixed(1)} cm</span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-slate-400">Stift-Hebungen:</span>
              <span className="text-amber-400 font-mono font-semibold">{parsedGcode.stats.penLifts}x</span>
            </div>
            <div className="flex justify-between items-center text-[10px] pt-1 border-t border-slate-800/80">
              <span className="text-slate-300 flex items-center gap-1">
                <Clock className="w-3 h-3 text-indigo-400" />
                Zeit:
              </span>
              <span className="text-indigo-300 font-mono font-semibold">
                {Math.floor(parsedGcode.stats.estimatedTimeSec / 60)}m {parsedGcode.stats.estimatedTimeSec % 60}s
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Unified Collapsible Inspector Sidebar */}
      <VisualizerInspector
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        selectedObjectIds={selectedObjectIds}
        setSelectedObjectIds={setSelectedObjectIds}
        gcodeObjects={gcodeObjects}
        customObjectNames={customObjectNames}
        setCustomObjectNames={setCustomObjectNames}
        hiddenObjectIds={hiddenObjectIds}
        setHiddenObjectIds={setHiddenObjectIds}
        lockedObjectIds={lockedObjectIds}
        setLockedObjectIds={setLockedObjectIds}
        hoveredObjectId={hoveredObjectId}
        setHoveredObjectId={setHoveredObjectId}
        handleCenterOnBed={handleCenterOnBed}
        handleMoveToOrigin={handleMoveToOrigin}
        handleApplyTransform={handleApplyTransform}
        handleDuplicateObjects={handleDuplicateObjects}
        handleDeleteObject={handleDeleteObject}
        handleDeleteSelected={handleDeleteSelected}
        actualBounds={actualBounds}
        sollX={sollX}
        sollY={sollY}
        sollZ={sollZ}
        setSollZ={setSollZ}
        handleSollXChange={handleSollXChange}
        handleSollYChange={handleSollYChange}
        handleApplySollDimensions={handleApplySollDimensions}
        handleFitToBed={handleFitToBed}
        lockAspect={lockAspect}
        setLockAspect={setLockAspect}
        onOpenGenerator={onOpenGenerator}
      />
    </div>

      {/* Bottom Interactive G-Code Simulation Scrubber & Playback Bar */}
      {parsedGcode && parsedGcode.segments.length > 0 && (
        <div className="bg-slate-900 border-t border-slate-800 px-4 py-2.5 flex items-center gap-3 text-xs z-20 shadow-lg shrink-0">
          {/* Play / Pause */}
          <button
            onClick={() => setIsSimPlaying(!isSimPlaying)}
            className={`p-2 rounded-lg text-white font-medium transition-all shadow-sm flex items-center justify-center ${
              isSimPlaying
                ? 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700'
                : 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700'
            }`}
            title={isSimPlaying ? 'Simulation anhalten' : 'Simulation abspielen'}
          >
            {isSimPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          {/* Rewind */}
          <button
            onClick={() => {
              setIsSimPlaying(false);
              setSimIndex(0);
            }}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
            title="Zum Anfang (Segment 0)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Step Back 1 */}
          <button
            onClick={() => {
              setIsSimPlaying(false);
              setSimIndex(prev => Math.max(0, prev - 1));
            }}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
            title="Ein Segment zurück"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Step Forward 1 */}
          <button
            onClick={() => {
              setIsSimPlaying(false);
              setSimIndex(prev => Math.min(parsedGcode.segments.length - 1, prev + 1));
            }}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
            title="Ein Segment vorwärts"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Timeline Slider with Live Scrubbing */}
          <div className="flex-1 flex items-center gap-3">
            <span className="text-slate-400 font-mono text-[11px] min-w-[90px]">
              Seg {simIndex} / {parsedGcode.segments.length - 1}
            </span>
            <input
              type="range"
              min={0}
              max={parsedGcode.segments.length - 1}
              value={simIndex}
              onChange={(e) => {
                setIsSimPlaying(false);
                setSimIndex(Number(e.target.value));
              }}
              className="flex-1 accent-indigo-500 h-2 bg-slate-800 rounded-lg cursor-pointer transition-all"
            />
            <span className="text-indigo-400 font-mono font-semibold text-[11px] min-w-[40px] text-right">
              {Math.round((simIndex / Math.max(1, parsedGcode.segments.length - 1)) * 100)}%
            </span>
          </div>

          {/* Current Segment Coordinate Details */}
          {parsedGcode.segments[simIndex] && (
            <div className="hidden lg:flex items-center gap-2 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800 font-mono text-[11px] text-slate-300">
              <span className="text-slate-500">{parsedGcode.segments[simIndex].type}:</span>
              <span>X{parsedGcode.segments[simIndex].to.x.toFixed(1)}</span>
              <span>Y{parsedGcode.segments[simIndex].to.y.toFixed(1)}</span>
              <span className="text-indigo-400">Z{parsedGcode.segments[simIndex].to.z.toFixed(1)}</span>
            </div>
          )}

          {/* Speed Selector */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-md border border-slate-800">
            {[0.5, 1, 2, 5, 10].map((s) => (
              <button
                key={s}
                onClick={() => setSimSpeed(s)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                  simSpeed === s ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
