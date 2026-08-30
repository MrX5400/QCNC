import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  FileCode, 
  Image as ImageIcon, 
  Scissors, 
  Type, 
  Square, 
  Circle, 
  Star, 
  Upload, 
  Sliders, 
  Sparkles, 
  Download, 
  Eye, 
  EyeOff,
  Zap, 
  ArrowRight,
  RefreshCw,
  Plus,
  Trash2,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  CheckCircle2,
  Flame,
  PenTool,
  Move,
  Layers,
  Clock,
  Gauge,
  Code,
  Copy,
  Info,
  Check,
  Box,
  Database,
  SlidersHorizontal,
  Compass,
  FlipHorizontal,
  FlipVertical,
  Crosshair,
  SunMedium,
  Contrast,
  Sliders as SlidersIcon,
  MousePointer,
  Hand,
  Lock,
  Unlock,
  Target,
  Pause,
  Play,
  Ruler,
  Search,
  Scaling,
  Expand,
  Undo2,
  Redo2,
  X,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  PaintBucket,
  Hash,
  Grid as GridIcon,
  CornerDownLeft,
  Wand2,
  Spline,
  Activity,
  GitFork,
  Minimize2,
  Workflow,
  Route,
  Loader2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  FastForward,
  Ratio,
  Crop,
  SquareDashed,
  LayoutGrid
} from 'lucide-react';
import { 
  ActuatorType, 
  MachineProfile, 
  ParsedGcode, 
  RasterSettings,
  GrblState
} from '../types/cnc';
import { 
  generateHersheyText, 
  generateRasterToVectorPaths, 
  generateShapePaths, 
  parseSvgToPolylines, 
  VectorPolyline,
  UniversalGcodeGroup,
  GeneratorTargetMode,
  PenModeOptions,
  DragKnifeModeOptions,
  LaserModeOptions,
  generateUniversalGcode,
  generateUniversalTextPaths,
  getOptimizedPolylinesAndGroups,
  PathOrderStrategy,
  ObjectOrderMode,
  calculateOtsuThreshold,
  computePolylineLength,
  simplifyPolylineDP,
  TextMode,
  TextInfillPattern,
  TextGeneratorOptions
} from '../services/vectorRasterGenerator';
import { applyDragKnifeCompensation, CompensatedPathResult } from '../services/dragKnifeCorrection';
import { parseGcode } from '../services/gcodeParser';

import { grbl } from '../services/grblService';
import { parseDxf } from '../services/dxfParser';
import { LaserDatabaseModal } from './LaserDatabaseModal';
import { LaserMaterialPreset } from '../services/laserDatabaseService';
import { useI18n, useThemeLanguage } from '../contexts/ThemeLanguageContext';
import { ViewCube } from './ViewCube';

interface WorkspaceProps {
  currentProfile: MachineProfile;
  onProfileUpdate: (updated: MachineProfile) => void;
  onGcodeGenerated: (parsed: ParsedGcode) => void;
  onSwitchToVisualizer?: () => void;
  cncControls?: React.ReactNode;
  liveState: GrblState;
  parsedGcode: ParsedGcode | null;
  isLaserDbModalOpen?: boolean;
  onOpenLaserDbModal?: () => void;
  onCloseLaserDbModal?: () => void;
}

type SourceType = 'file' | 'text' | 'shapes' | 'raster';

// --- COMPOSITION ELEMENT INTERFACE (Combine Multiple Texts, Shapes, Files & Images) ---
export interface CompositionElement {
  id: string;
  name: string;
  sourceType: SourceType;
  polylines: VectorPolyline[];
  offsetX: number;
  offsetY: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  flipX: boolean;
  flipY: boolean;
  visible: boolean;
  locked?: boolean;
}

export const Workspace: React.FC<WorkspaceProps> = ({
  currentProfile,
  onProfileUpdate,
  onGcodeGenerated,
  onSwitchToVisualizer,
  cncControls,
  liveState,
  parsedGcode,
  isLaserDbModalOpen = false,
  onOpenLaserDbModal,
  onCloseLaserDbModal,
}) => {
  const { t } = useI18n();
  const { uiScale, theme } = useThemeLanguage();
  const [activeSidebarTab, setActiveSidebarTab] = useState<'design' | 'steuerung'>('design');

  // --- Multi-Element Composition Workspace State (Multi-Selection Support) ---
  const [compositionElements, setCompositionElements] = useState<CompositionElement[]>([]);
  const [mousePos, setMousePos] = useState<{x: number, y: number}>({ x: 0, y: 0 });
  const [streamProgress, setStreamProgress] = useState({
    currentLine: 0,
    totalLines: 0,
    percent: 0,
    isStreaming: false,
    isPaused: false,
  });

  useEffect(() => {
    const unsub = grbl.onStreamProgress((prog) => {
      setStreamProgress(prog);
    });
    return () => unsub();
  }, []);

  const [simIndex, setSimIndex] = useState<number>(0);
  const [isSimPlaying, setIsSimPlaying] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [showSimSlider, setShowSimSlider] = useState<boolean>(false);
  const [showStatsPanel, setShowStatsPanel] = useState<boolean>(false);
  const [showCoordsPanel, setShowCoordsPanel] = useState<boolean>(true);
  const [showLegendPanel, setShowLegendPanel] = useState<boolean>(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [showMiniJog, setShowMiniJog] = useState<boolean>(false);
  const [jogStep, setJogStep] = useState<number>(10);
  const [jogToast, setJogToast] = useState<{x: number, y: number} | null>(null);
  const [doubleClickTarget, setDoubleClickTarget] = useState<{x: number, y: number, time: number} | null>(null);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const selectedElementId = selectedElementIds.length === 1 ? selectedElementIds[0] : (selectedElementIds.length > 0 ? selectedElementIds[0] : null);
  const setSelectedElementId = (id: string | null) => {
    setSelectedElementIds(id ? [id] : []);
  };

  // --- Undo / Redo Snapshot State ---
  interface GeneratorSnapshot {
    compositionElements: CompositionElement[];
    selectedElementIds: string[];
    objOffsetX: number;
    objOffsetY: number;
    objRotation: number;
    scaleX: number;
    scaleY: number;
    objFlipX: boolean;
    objFlipY: boolean;
  }
  const [undoStack, setUndoStack] = useState<GeneratorSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<GeneratorSnapshot[]>([]);

  // --- Dedicated Menus & Navigation / Selection Modes ---
  const [activeGenMenu, setActiveGenMenu] = useState<'none' | 'pos_size' | 'rotation' | 'obj_browser'>('none');
  const [isMeasureActive, setIsMeasureActive] = useState<boolean>(false);
  const [genMeasureStart, setGenMeasureStart] = useState<{ x: number; y: number } | null>(null);
  const [genMeasureEnd, setGenMeasureEnd] = useState<{ x: number; y: number } | null>(null);

  // Drag interaction state
  const [dragMode, setDragMode] = useState<'none' | 'pan' | 'orbit' | 'select_rect' | 'transform_drag' | 'measure'>('none');
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [dragOriginPan, setDragOriginPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragOriginOrbit, setDragOriginOrbit] = useState<{ yaw: number; pitch: number }>({ yaw: 35, pitch: 45 });

  // Marquee Rect selection interactive states
  const [selectionRect, setSelectionRect] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const [liveDragOffsets, setLiveDragOffsets] = useState<{ [id: string]: { x: number; y: number } }>({});

  // --- 1. Step 1: Input Source State ---
  const [sourceType, setSourceType] = useState<SourceType>('text');
  
  // File Upload State
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [fileFileType, setFileFileType] = useState<'dxf' | 'svg' | ''>('');
  const [rawFilePolylines, setRawFilePolylines] = useState<VectorPolyline[]>([]);

  // Text State
  const [textValue, setTextValue] = useState<string>('CNC PLOTTER 2026');
  const [textFontSize, setTextFontSize] = useState<number>(18);
  const [textPosX, setTextPosX] = useState<number>(20);
  const [textPosY, setTextPosY] = useState<number>(50);
  const [textMode, setTextMode] = useState<TextMode>('single_line');
  const [textFontFamily, setTextFontFamily] = useState<string>('Hershey Simplex');
  const [customFontFamily, setCustomFontFamily] = useState<string>('');
  const [textFontWeight, setTextFontWeight] = useState<'normal' | 'medium' | 'bold' | '900'>('bold');
  const [textFontStyle, setTextFontStyle] = useState<'normal' | 'italic'>('normal');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');
  const [textLetterSpacing, setTextLetterSpacing] = useState<number>(0);
  const [textLineSpacing, setTextLineSpacing] = useState<number>(1.25);
  const [textSingleLineBold, setTextSingleLineBold] = useState<boolean>(false);
  const [textItalicSlantDeg, setTextItalicSlantDeg] = useState<number>(0);

  // Text Infill Pattern State (for Outline mode)
  const [textInfillPattern, setTextInfillPattern] = useState<TextInfillPattern>('none');
  const [textInfillSpacing, setTextInfillSpacing] = useState<number>(0.8);
  const [textInfillAngle, setTextInfillAngle] = useState<number>(45);
  const [textIncludeOutline, setTextIncludeOutline] = useState<boolean>(true);

  // Shapes State
  const [shapeType, setShapeType] = useState<'rect' | 'circle' | 'star' | 'polygon' | 'grid' | 'spiral'>('star');
  const [shapeX, setShapeX] = useState<number>(50);
  const [shapeY, setShapeY] = useState<number>(50);
  const [shapeWidth, setShapeWidth] = useState<number>(60);
  const [shapeHeight, setShapeHeight] = useState<number>(50);
  const [shapeRadius, setShapeRadius] = useState<number>(30);
  const [shapeSides, setShapeSides] = useState<number>(6);

  // Raster to Vector State
  const [rasterImage, setRasterImage] = useState<HTMLImageElement | null>(null);
  const originalRasterImageRef = useRef<HTMLImageElement | null>(null);
  const [rasterImageName, setRasterImageName] = useState<string>('');
  const [showImageCropModal, setShowImageCropModal] = useState<boolean>(false);
  const [cropMargins, setCropMargins] = useState<{ top: number; bottom: number; left: number; right: number }>({ top: 0, bottom: 0, left: 0, right: 0 });
  const [rasterSettings, setRasterSettings] = useState<RasterSettings>({
    mode: 'contour_trace',
    resolution: 3.5,
    angle: 45,
    brightness: 0,
    contrast: 25,
    threshold: 135,
    blackLevel: 0,
    whiteLevel: 255,
    gamma: 1.0,
    mirrorX: false,
    mirrorY: false,
    invert: false,
    scaleX: 1,
    scaleY: 1,
    targetWidth: Math.min(120, currentProfile.bedWidth * 0.75),
    targetHeight: Math.min(120, currentProfile.bedHeight * 0.75),
    stippleDotDurationMs: 50,
    spiralTightness: 1.0,
    blurRadius: 1,
    simplificationTolerance: 0.25,
    minPathLength: 0.6,
    detailSensitivity: 5,
    enhanceSmallText: true,
    optimizeTsp: true,
    ignoreBorder: true,
    fillPattern: 'none',
    fillSpacing: 2.0,
    fillAngle: 45,
    fillIncludeContour: true,
  });
  const rasterCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const vectorOverlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tracingPreviewTab, setTracingPreviewTab] = useState<'vectors' | 'threshold' | 'original'>('vectors');
  const [rasterPolylines, setRasterPolylines] = useState<VectorPolyline[]>([]);
  const [isTracing, setIsTracing] = useState<boolean>(false);
  const [showAdvancedRasterSettings, setShowAdvancedRasterSettings] = useState<boolean>(false);
  const [showLightboxAdvanced, setShowLightboxAdvanced] = useState<boolean>(false);
  const [rasterLockAspect, setRasterLockAspect] = useState<boolean>(true);
  const [tracerBgOpacity, setTracerBgOpacity] = useState<number>(35);

  // Handle Width and Height change with Aspect Ratio preservation
  const handleRasterWidthChange = (newWidth: number) => {
    const validWidth = Math.max(1, newWidth);
    setRasterSettings(s => {
      if (rasterLockAspect && rasterImage && rasterImage.width > 0 && rasterImage.height > 0) {
        const aspect = rasterImage.height / rasterImage.width;
        const newHeight = Number((validWidth * aspect).toFixed(1));
        return { ...s, targetWidth: validWidth, targetHeight: newHeight };
      }
      return { ...s, targetWidth: validWidth };
    });
  };

  const handleRasterHeightChange = (newHeight: number) => {
    const validHeight = Math.max(1, newHeight);
    setRasterSettings(s => {
      if (rasterLockAspect && rasterImage && rasterImage.width > 0 && rasterImage.height > 0) {
        const aspect = rasterImage.width / rasterImage.height;
        const newWidth = Number((validHeight * aspect).toFixed(1));
        return { ...s, targetWidth: newWidth, targetHeight: validHeight };
      }
      return { ...s, targetHeight: validHeight };
    });
  };

  // --- Asynchronous & Debounced Vector Trace Preview for 60 FPS UI Smoothness ---
  useEffect(() => {
    if (!rasterImage || sourceType !== 'raster') {
      setRasterPolylines([]);
      setIsTracing(false);
      return;
    }

    setIsTracing(true);

    const timer = setTimeout(() => {
      // Dynamic grid sampling based on detailSensitivity (level 1 = 400px, level 5 = 800px, level 10 = 1800px)
      const detailSens = rasterSettings.detailSensitivity ?? 5;
      const targetDim = Math.round(350 + detailSens * 150);
      const offscreen = document.createElement('canvas');
      const scale = Math.min(1, targetDim / Math.max(rasterImage.width, rasterImage.height));
      const w = Math.max(10, Math.round(rasterImage.width * scale));
      const h = Math.max(10, Math.round(rasterImage.height * scale));
      offscreen.width = w;
      offscreen.height = h;

      const ctx = offscreen.getContext('2d');
      if (ctx) {
        ctx.drawImage(rasterImage, 0, 0, w, h);
        const paths = generateRasterToVectorPaths(offscreen, rasterSettings, targetDim);
        setRasterPolylines(paths);
      }
      setIsTracing(false);
    }, 120);

    return () => clearTimeout(timer);
  }, [
    sourceType,
    rasterImage,
    rasterSettings.mode,
    rasterSettings.threshold,
    rasterSettings.brightness,
    rasterSettings.contrast,
    rasterSettings.gamma,
    rasterSettings.blackLevel,
    rasterSettings.whiteLevel,
    rasterSettings.blurRadius,
    rasterSettings.simplificationTolerance,
    rasterSettings.minPathLength,
    rasterSettings.detailSensitivity,
    rasterSettings.enhanceSmallText,
    rasterSettings.optimizeTsp,
    rasterSettings.ignoreBorder,
    rasterSettings.invert,
    rasterSettings.mirrorX,
    rasterSettings.mirrorY,
    rasterSettings.targetWidth,
    rasterSettings.targetHeight,
    rasterSettings.resolution,
    rasterSettings.angle,
    rasterSettings.fillPattern,
    rasterSettings.fillSpacing,
    rasterSettings.fillAngle,
    rasterSettings.fillIncludeContour,
    rasterSettings.stippleDotDurationMs,
    rasterSettings.spiralTightness,
  ]);

  // --- UNIVERSAL OBJECT TRANSFORMATION (USER REQUEST: Move & Rotate in Preview with Custom Inputs) ---
  const [objOffsetX, setObjOffsetX] = useState<number>(0);
  const [objOffsetY, setObjOffsetY] = useState<number>(0);
  const [objRotation, setObjRotation] = useState<number>(0);
  const [objScale, setObjScale] = useState<number>(100);
  const [scaleX, setScaleX] = useState<number>(100);
  const [scaleY, setScaleY] = useState<number>(100);
  const [sollWidth, setSollWidth] = useState<number | ''>('');
  const [sollHeight, setSollHeight] = useState<number | ''>('');
  const [sollDepthZ, setSollDepthZ] = useState<number>(0);
  const [lockAspectDimensions, setLockAspectDimensions] = useState<boolean>(true);
  const [objFlipX, setObjFlipX] = useState<boolean>(false);
  const [objFlipY, setObjFlipY] = useState<boolean>(false);
  const [genShiftStep, setGenShiftStep] = useState<number>(10);
  const [canvasInteractionMode, setCanvasInteractionMode] = useState<'moveObject' | 'viewPan'>('moveObject');

  const handleNudgeObject = (dx: number, dy: number) => {
    pushUndoSnapshot();
    if (selectedElementId) {
      setCompositionElements(prev => prev.map(el => el.id === selectedElementId ? {
        ...el,
        offsetX: Number((el.offsetX + dx).toFixed(1)),
        offsetY: Number((el.offsetY + dy).toFixed(1)),
      } : el));
    } else {
      setObjOffsetX(prev => Number((prev + dx).toFixed(1)));
      setObjOffsetY(prev => Number((prev + dy).toFixed(1)));
    }
  };

  // Image Trace Lightbox / Großansicht Modal State
  const [showImageLightbox, setShowImageLightbox] = useState<boolean>(false);
  const [lightboxZoom, setLightboxZoom] = useState<number>(1);
  const [lightboxView, setLightboxView] = useState<'vectors' | 'split' | 'processed' | 'original'>('vectors');
  const [lightboxSplitPos, setLightboxSplitPos] = useState<number>(50);
  const lightboxCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lightboxVectorCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // --- 2. Step 2: Target Operation Mode ---
  const [targetMode, setTargetMode] = useState<GeneratorTargetMode>(() => {
    if (currentProfile.dragKnife?.enabled) return 'dragknife';
    if (currentProfile.actuatorType === 'laser') return 'laser';
    return 'pen';
  });

  // --- 3. Step 3: Tool Specific Settings ---
  // Pen Options
  const [penOptions, setPenOptions] = useState<PenModeOptions>(() => {
    const isZ = currentProfile.actuatorType === 'z_stepper' || !currentProfile.actuatorType;
    return {
      actuatorType: isZ ? 'z_stepper' : (currentProfile.actuatorType === 'laser' ? 'custom' : 'servo_pwm'),
      drawingFeedrate: currentProfile.drawingFeedrate || 1500,
      travelFeedrate: currentProfile.travelFeedrate || 4000,
      penUpCommand: currentProfile.penUpCommand || (isZ ? `G0 Z${(currentProfile.penUpZ ?? 5.0).toFixed(2)}` : 'M3 S30'),
      penDownCommand: currentProfile.penDownCommand || (isZ ? `G1 Z${(currentProfile.penDownZ ?? 0.0).toFixed(2)} F${currentProfile.plungeFeedrate || 600}` : 'M3 S80'),
      penUpZ: currentProfile.penUpZ ?? 5.0,
      penDownZ: currentProfile.penDownZ ?? 0.0,
      plungeFeedrate: currentProfile.plungeFeedrate || 600,
      servoUpValue: 30,
      servoDownValue: 80,
      servoDelayMs: 100,
      penUpDelayMs: currentProfile.penUpDelayMs || 50,
      penDownDelayMs: currentProfile.penDownDelayMs || 100,
      passes: 1,
    };
  });

  // Drag Knife Options
  const [dragKnifeOptions, setDragKnifeOptions] = useState<DragKnifeModeOptions>(() => {
    const isZ = currentProfile.actuatorType === 'z_stepper' || !currentProfile.actuatorType;
    return {
      actuatorType: isZ ? 'z_stepper' : (currentProfile.actuatorType === 'laser' ? 'custom' : 'servo'),
      bladeOffset: currentProfile.dragKnife?.bladeOffset || 0.45,
      swivelAngleThreshold: currentProfile.dragKnife?.swivelAngleThreshold || 20,
      swivelFeedrate: currentProfile.dragKnife?.swivelFeedrate || 800,
      cuttingFeedrate: currentProfile.dragKnife?.cuttingFeedrate || 1500,
      travelFeedrate: currentProfile.travelFeedrate || 4000,
      overcut: currentProfile.dragKnife?.overcut || 1.0,
      liftOnSwivel: currentProfile.dragKnife?.liftOnSwivel || false,
      liftAmount: currentProfile.dragKnife?.liftAmount || 0.5,
      liftOnRapid: currentProfile.dragKnife?.liftOnRapid ?? true,
      rapidLiftZ: currentProfile.dragKnife?.rapidLiftZ || 2.0,
      penUpZ: currentProfile.dragKnife?.rapidLiftZ || 2.0,
      penDownZ: 0.0,
      plungeFeedrate: 600,
      penUpCommand: currentProfile.penUpCommand || (isZ ? `G0 Z${(currentProfile.dragKnife?.rapidLiftZ || 2.0).toFixed(2)}` : 'M3 S30'),
      penDownCommand: currentProfile.penDownCommand || (isZ ? `G1 Z0.00 F600` : 'M3 S80'),
      servoUpValue: 30,
      servoDownValue: 80,
      servoDelayMs: 80,
    };
  });

  // Laser Options
  const [laserOptions, setLaserOptions] = useState<LaserModeOptions>({
    laserMode: currentProfile.laserMode || 'M4',
    powerMin: 0,
    powerMax: currentProfile.laserPowerMax || 1000,
    feedrate: currentProfile.cuttingFeedrate || 1200,
    passes: 1,
    airAssist: currentProfile.airAssistEnabled || false,
    kerfOffset: 0,
    zStepdown: 0,
  });

  // Optimize path order (travel reduction) & processing sequence
  const [optimizeOrder, setOptimizeOrder] = useState<boolean>(true);
  const [objectOrderMode, setObjectOrderMode] = useState<ObjectOrderMode>('object_by_object');
  const [pathOrderStrategy, setPathOrderStrategy] = useState<PathOrderStrategy>('fastest');

  // --- Interactive Preview & Viewport State ---
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(480);
  
  const handleResizeLeftPanelStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const startX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const startWidth = leftPanelWidth;

    const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : (moveEvent as MouseEvent).clientX;
      const delta = currentX - startX; 
      const newWidth = Math.max(300, Math.min(800, startWidth - delta));
      setLeftPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('touchend', handleMouseUp);
      document.body.style.cursor = '';
    };

    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleMouseMove, { passive: false });
    document.addEventListener('touchend', handleMouseUp);
  };

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [orbitYaw, setOrbitYaw] = useState<number>(35); // degrees
  const [orbitPitch, setOrbitPitch] = useState<number>(45); // degrees
  const [zoom, setZoom] = useState<number>(1.2);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showCutPaths, setShowCutPaths] = useState<boolean>(true);
  const [showRapid, setShowRapid] = useState<boolean>(true);
  const [showSwivelArcs, setShowSwivelArcs] = useState<boolean>(true);
  const [showOriginMarker, setShowOriginMarker] = useState<boolean>(true);
  const [showLiveDraftPreview, setShowLiveDraftPreview] = useState<boolean>(true);
  const initialFitDoneRef = useRef<boolean>(false);

  const fitToView = useCallback((targetMode?: '2d' | '3d') => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const mode = targetMode || viewMode;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || canvas.width || 600;
    const height = rect.height || canvas.height || 450;
    const padding = 50;
    const availW = Math.max(100, width - padding * 2);
    const availH = Math.max(100, height - padding * 2);

    const bedW = currentProfile.bedWidth || 200;
    const bedH = currentProfile.bedHeight || 200;

    if (mode === '2d') {
      const scaleX = availW / bedW;
      const scaleY = availH / bedH;
      const newZoom = Math.min(scaleX, scaleY, 4.0);
      const centerX = bedW / 2;
      const centerY = bedH / 2;

      setZoom(Math.max(0.2, newZoom));
      setPan({
        x: width / 2 - centerX * newZoom,
        y: height / 2 + centerY * newZoom,
      });
    } else {
      const bedDiag = Math.hypot(bedW, bedH);
      const scale3D = Math.min(availW / (bedDiag * 0.9), availH / (bedDiag * 0.75), 2.5);
      setZoom(Math.max(0.2, scale3D));
      setPan({
        x: width / 2,
        y: height / 2 + 25,
      });
    }
  }, [viewMode, currentProfile.bedWidth, currentProfile.bedHeight]);

  const resetView = useCallback(() => {
    fitToView();
    setOrbitYaw(35);
    setOrbitPitch(45);
  }, [fitToView]);

  useEffect(() => {
    if (!initialFitDoneRef.current && previewCanvasRef.current) {
      const rect = previewCanvasRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        fitToView();
        initialFitDoneRef.current = true;
      }
    }
  }, [fitToView]);

  // Laser Database Modal State
  const [activeMaterialName, setActiveMaterialName] = useState<string | null>(null);

  // G-Code View / Code Modal State
  const [showGcodeModal, setShowGcodeModal] = useState<boolean>(false);
  const [copiedGcode, setCopiedGcode] = useState<boolean>(false);
  const [loadedSuccess, setLoadedSuccess] = useState<boolean>(false);

  // Otsu Auto-Threshold Calculation Helper
  const handleAutoOtsuThreshold = useCallback(() => {
    if (!rasterImage) return;
    const tempCanvas = document.createElement('canvas');
    const maxDim = 300;
    const scale = Math.min(1, maxDim / Math.max(rasterImage.width, rasterImage.height));
    const w = Math.max(10, Math.round(rasterImage.width * scale));
    const h = Math.max(10, Math.round(rasterImage.height * scale));
    tempCanvas.width = w;
    tempCanvas.height = h;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(rasterImage, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    const otsuVal = calculateOtsuThreshold(
      imgData.data,
      w,
      h,
      rasterSettings.brightness,
      rasterSettings.contrast,
      rasterSettings.gamma ?? 1.0
    );
    setRasterSettings(prev => ({ ...prev, threshold: otsuVal }));
  }, [rasterImage, rasterSettings.brightness, rasterSettings.contrast, rasterSettings.gamma]);

  // --- Helper to Render Traced Polylines with LaserGRBL Precision onto Canvas ---
  const renderTracedPolylinesToCanvas = useCallback((
    canvas: HTMLCanvasElement,
    polylines: VectorPolyline[],
    bgImg?: HTMLImageElement | null,
    bgOpacity: number = 0
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Dark blueprint background
    ctx.fillStyle = '#060913';
    ctx.fillRect(0, 0, w, h);

    // Calculate dimensions matching work area
    const targetW = rasterSettings.targetWidth || (bgImg ? bgImg.width : 100);
    const targetH = rasterSettings.targetHeight || (bgImg ? bgImg.height : 100);

    const padding = 6;
    const scale = Math.min((w - padding * 2) / targetW, (h - padding * 2) / targetH);
    const offX = (w - targetW * scale) / 2;
    const offY = (h - targetH * scale) / 2;

    const imgX = offX;
    const imgY = offY;
    const imgW = targetW * scale;
    const imgH = targetH * scale;

    // Draw background original image with user-adjustable opacity
    if (bgImg && bgOpacity > 0) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, bgOpacity / 100));
      const { mirrorX, mirrorY } = rasterSettings;
      if (mirrorX || mirrorY) {
        ctx.translate(imgX + imgW / 2, imgY + imgH / 2);
        ctx.scale(mirrorX ? -1 : 1, mirrorY ? -1 : 1);
        ctx.drawImage(bgImg, -imgW / 2, -imgH / 2, imgW, imgH);
      } else {
        ctx.drawImage(bgImg, imgX, imgY, imgW, imgH);
      }
      ctx.restore();
    }

    // Subtle coordinate grid lines
    ctx.strokeStyle = bgOpacity > 40 ? 'rgba(255, 255, 255, 0.12)' : 'rgba(30, 41, 59, 0.5)';
    ctx.lineWidth = 1;
    const gridStep = Math.max(24, Math.min(w, h) / 10);
    for (let gx = 0; gx < w; gx += gridStep) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    for (let gy = 0; gy < h; gy += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    if (!polylines || polylines.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = `${Math.round(12 * (uiScale || 100) / 100)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('Keine Vektoren gefunden / Schwellenwert anpassen', w / 2, h / 2);
      return;
    }

    // Draw rapid G0 travel moves between strokes (dashed subtle pink/rose)
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    for (let i = 0; i < polylines.length - 1; i++) {
      const endPt = polylines[i].points[polylines[i].points.length - 1];
      const nextStart = polylines[i + 1].points[0];
      if (endPt && nextStart) {
        const sx = endPt.x * scale + offX;
        const sy = h - (endPt.y * scale + offY);
        const ex = nextStart.x * scale + offX;
        const ey = h - (nextStart.y * scale + offY);
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw vibrant cutting / drawing vector contours
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = Math.max(1.5, Math.min(2.5, w / 350));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0, 240, 255, 0.55)';
    ctx.shadowBlur = 3;

    for (const poly of polylines) {
      if (!poly.points || poly.points.length < 2) continue;
      ctx.beginPath();
      for (let i = 0; i < poly.points.length; i++) {
        const pt = poly.points[i];
        const px = pt.x * scale + offX;
        const py = h - (pt.y * scale + offY);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      if (poly.closed) {
        ctx.closePath();
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Draw starting point markers (emerald dots)
    ctx.fillStyle = '#10b981';
    for (const poly of polylines) {
      if (poly.points && poly.points.length > 0) {
        const p0 = poly.points[0];
        const px = p0.x * scale + offX;
        const py = h - (p0.y * scale + offY);
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [rasterSettings.targetWidth, rasterSettings.targetHeight, rasterSettings.mirrorX, rasterSettings.mirrorY]);

  // --- Update Processed Image Canvas Preview for Vectorization Menu ---
  useEffect(() => {
    if (!rasterImage || !processedCanvasRef.current) return;
    const canvas = processedCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = Math.min(260, rasterImage.width);
    const h = Math.round(w * (rasterImage.height / rasterImage.width));
    canvas.width = w;
    canvas.height = h;

    // Draw base image
    ctx.drawImage(rasterImage, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const { brightness, contrast, threshold, blackLevel = 0, whiteLevel = 255, gamma = 1.0, mirrorX, mirrorY, invert, blurRadius = 0 } = rasterSettings;

    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const minL = Math.min(blackLevel, whiteLevel - 1);
    const maxL = Math.max(whiteLevel, minL + 1);

    // Create temporary buffer for mirroring & luminance
    const lumMap = new Float32Array(w * h);
    const origData = new Uint8ClampedArray(data);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const srcX = mirrorX ? (w - 1 - x) : x;
        const srcY = mirrorY ? (h - 1 - y) : y;
        const srcIdx = (srcY * w + srcX) * 4;
        const dstIdx = y * w + x;

        let r = origData[srcIdx] + brightness * 2.55;
        let g = origData[srcIdx + 1] + brightness * 2.55;
        let b = origData[srcIdx + 2] + brightness * 2.55;

        r = factor * (r - 128) + 128;
        g = factor * (g - 128) + 128;
        b = factor * (b - 128) + 128;

        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));

        let lum = (0.299 * r + 0.587 * g + 0.114 * b);
        let scaledLum = (lum - minL) / (maxL - minL);
        scaledLum = Math.max(0, Math.min(1, scaledLum));

        if (gamma && gamma !== 1.0 && gamma > 0.1) {
          scaledLum = Math.pow(scaledLum, 1 / gamma);
        }

        lumMap[dstIdx] = scaledLum;
      }
    }

    // Apply optional blur
    const rad = Math.min(8, Math.max(0, Math.round(blurRadius)));
    const filteredLum = new Float32Array(w * h);
    if (rad > 0) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let sum = 0, count = 0;
          for (let dy = -rad; dy <= rad; dy++) {
            const ny = y + dy;
            if (ny < 0 || ny >= h) continue;
            for (let dx = -rad; dx <= rad; dx++) {
              const nx = x + dx;
              if (nx >= 0 && nx < w) {
                sum += lumMap[ny * w + nx];
                count++;
              }
            }
          }
          filteredLum[y * w + x] = count > 0 ? sum / count : lumMap[y * w + x];
        }
      }
    } else {
      filteredLum.set(lumMap);
    }

    const normThreshold = threshold / 255;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dstIdx = (y * w + x) * 4;
        let sLum = filteredLum[y * w + x];
        if (invert) sLum = 1 - sLum;

        const isDark = sLum < normThreshold;
        const finalColor = isDark ? 20 : 240;

        data[dstIdx] = finalColor;
        data[dstIdx + 1] = finalColor;
        data[dstIdx + 2] = finalColor;
        data[dstIdx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }, [rasterImage, rasterSettings]);

  // --- Small Sidebar Vector Overlay Canvas Render ---
  useEffect(() => {
    if (tracingPreviewTab !== 'vectors' || !vectorOverlayCanvasRef.current) return;
    const canvas = vectorOverlayCanvasRef.current;
    canvas.width = 260;
    canvas.height = rasterImage ? Math.round(260 * (rasterImage.height / rasterImage.width)) : 160;
    renderTracedPolylinesToCanvas(canvas, rasterPolylines, rasterImage, tracerBgOpacity);
  }, [tracingPreviewTab, rasterPolylines, rasterImage, tracerBgOpacity, renderTracedPolylinesToCanvas]);

  // --- High-Resolution Render for Lightbox Modal (Processed B&W Image) ---
  useEffect(() => {
    if (!showImageLightbox || (lightboxView !== 'processed' && lightboxView !== 'split') || !rasterImage) return;
    
    const renderLightboxProcessed = () => {
      if (!lightboxCanvasRef.current) return;
      const canvas = lightboxCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const maxDimension = 1200;
      const scale = Math.min(1, maxDimension / Math.max(rasterImage.width, rasterImage.height));
      const w = Math.round(rasterImage.width * scale);
      const h = Math.round(rasterImage.height * scale);
      canvas.width = w;
      canvas.height = h;

      ctx.drawImage(rasterImage, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      const { brightness, contrast, threshold, blackLevel = 0, whiteLevel = 255, gamma = 1.0, mirrorX, mirrorY, invert, blurRadius = 0 } = rasterSettings;

      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
      const minL = Math.min(blackLevel, whiteLevel - 1);
      const maxL = Math.max(whiteLevel, minL + 1);
      const origData = new Uint8ClampedArray(data);
      const lumMap = new Float32Array(w * h);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const srcX = mirrorX ? (w - 1 - x) : x;
          const srcY = mirrorY ? (h - 1 - y) : y;
          const srcIdx = (srcY * w + srcX) * 4;
          const dstIdx = y * w + x;

          let r = origData[srcIdx] + brightness * 2.55;
          let g = origData[srcIdx + 1] + brightness * 2.55;
          let b = origData[srcIdx + 2] + brightness * 2.55;

          r = factor * (r - 128) + 128;
          g = factor * (g - 128) + 128;
          b = factor * (b - 128) + 128;

          r = Math.max(0, Math.min(255, r));
          g = Math.max(0, Math.min(255, g));
          b = Math.max(0, Math.min(255, b));

          let lum = (0.299 * r + 0.587 * g + 0.114 * b);
          let scaledLum = (lum - minL) / (maxL - minL);
          scaledLum = Math.max(0, Math.min(1, scaledLum));

          if (gamma && gamma !== 1.0 && gamma > 0.1) {
            scaledLum = Math.pow(scaledLum, 1 / gamma);
          }

          lumMap[dstIdx] = scaledLum;
        }
      }

      const rad = Math.min(8, Math.max(0, Math.round(blurRadius)));
      const filteredLum = new Float32Array(w * h);
      if (rad > 0) {
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            let sum = 0, count = 0;
            for (let dy = -rad; dy <= rad; dy++) {
              const ny = y + dy;
              if (ny < 0 || ny >= h) continue;
              for (let dx = -rad; dx <= rad; dx++) {
                const nx = x + dx;
                if (nx >= 0 && nx < w) {
                  sum += lumMap[ny * w + nx];
                  count++;
                }
              }
            }
            filteredLum[y * w + x] = count > 0 ? sum / count : lumMap[y * w + x];
          }
        }
      } else {
        filteredLum.set(lumMap);
      }

      const normThreshold = threshold / 255;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dstIdx = (y * w + x) * 4;
          let sLum = filteredLum[y * w + x];
          if (invert) sLum = 1 - sLum;

          const isDark = sLum < normThreshold;
          const finalColor = isDark ? 15 : 245;

          data[dstIdx] = finalColor;
          data[dstIdx + 1] = finalColor;
          data[dstIdx + 2] = finalColor;
          data[dstIdx + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    };

    // Use requestAnimationFrame so DOM has mounted the canvas
    const rafId = requestAnimationFrame(renderLightboxProcessed);
    return () => cancelAnimationFrame(rafId);
  }, [showImageLightbox, lightboxView, rasterImage, rasterSettings]);

  // --- High-Resolution Render for Lightbox Modal (Vector Overlay) ---
  useEffect(() => {
    if (!showImageLightbox || lightboxView !== 'vectors') return;

    const renderLightboxVectors = () => {
      if (!lightboxVectorCanvasRef.current) return;
      const canvas = lightboxVectorCanvasRef.current;
      const targetW = rasterSettings.targetWidth || (rasterImage ? rasterImage.width : 100);
      const targetH = rasterSettings.targetHeight || (rasterImage ? rasterImage.height : 100);
      const aspect = Math.max(0.01, targetW) / Math.max(0.01, targetH);
      
      const maxDim = 1400;
      let w = maxDim;
      let h = Math.round(maxDim / aspect);
      if (h > maxDim) {
        h = maxDim;
        w = Math.round(maxDim * aspect);
      }
      canvas.width = Math.max(300, Math.round(w));
      canvas.height = Math.max(200, Math.round(h));
      renderTracedPolylinesToCanvas(canvas, rasterPolylines, rasterImage, tracerBgOpacity);
    };

    const rafId = requestAnimationFrame(renderLightboxVectors);
    return () => cancelAnimationFrame(rafId);
  }, [showImageLightbox, lightboxView, rasterPolylines, rasterImage, tracerBgOpacity, renderTracedPolylinesToCanvas]);

  // --- Compute Raw Polylines from Source (before universal transform) ---
  const rawPolylines = useMemo<VectorPolyline[]>(() => {
    if (sourceType === 'file') {
      return rawFilePolylines;
    }

    if (sourceType === 'text') {
      const effectiveFont = textFontFamily === 'custom' && customFontFamily.trim() 
        ? customFontFamily.trim() 
        : textFontFamily;

      return generateUniversalTextPaths({
        text: textValue || ' ',
        x: textPosX,
        y: textPosY,
        fontSize: textFontSize,
        fontFamily: effectiveFont,
        fontWeight: textFontWeight,
        fontStyle: textFontStyle,
        textAlign,
        letterSpacing: textLetterSpacing,
        lineSpacing: textLineSpacing,
        mode: textMode,
        infillPattern: textInfillPattern,
        infillSpacing: textInfillSpacing,
        infillAngle: textInfillAngle,
        includeOutline: textIncludeOutline,
        singleLineBold: textSingleLineBold,
        italicSlantDeg: textItalicSlantDeg,
      });
    }

    if (sourceType === 'shapes') {
      return generateShapePaths({
        type: shapeType,
        x: shapeX,
        y: shapeY,
        width: shapeWidth,
        height: shapeHeight,
        radius: shapeRadius,
        sides: shapeSides,
      });
    }

    if (sourceType === 'raster') {
      return rasterPolylines;
    }

    return [];
  }, [
    sourceType,
    rawFilePolylines,
    textValue,
    textFontSize,
    textPosX,
    textPosY,
    textMode,
    textFontFamily,
    customFontFamily,
    textFontWeight,
    textFontStyle,
    textAlign,
    textLetterSpacing,
    textLineSpacing,
    textSingleLineBold,
    textItalicSlantDeg,
    textInfillPattern,
    textInfillSpacing,
    textInfillAngle,
    textIncludeOutline,
    shapeType,
    shapeX,
    shapeY,
    shapeWidth,
    shapeHeight,
    shapeRadius,
    shapeSides,
    rasterPolylines
  ]);

  // --- Draw Vector Overlay on Thumbnail Preview in Sidebar ---
  useEffect(() => {
    if (!rasterImage || !vectorOverlayCanvasRef.current || sourceType !== 'raster') return;
    const canvas = vectorOverlayCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = Math.min(260, rasterImage.width);
    const h = Math.round(w * (rasterImage.height / rasterImage.width));
    canvas.width = w;
    canvas.height = h;

    // Dark background + faint image
    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.25;
    ctx.drawImage(rasterImage, 0, 0, w, h);
    ctx.globalAlpha = 1.0;

    if (rawPolylines.length > 0) {
      const scaleX = w / (rasterSettings.targetWidth || 1);
      const scaleY = h / (rasterSettings.targetHeight || 1);

      ctx.lineWidth = 1.4;
      ctx.strokeStyle = theme.accentColor || '#06b6d4'; // Cyan
      ctx.shadowColor = 'rgba(6, 182, 212, 0.7)';
      ctx.shadowBlur = 3;

      for (const poly of rawPolylines) {
        if (!poly.points || poly.points.length < 2) continue;
        ctx.beginPath();
        const p0 = poly.points[0];
        const sx0 = p0.x * scaleX;
        const sy0 = h - (p0.y * scaleY);
        ctx.moveTo(sx0, sy0);

        for (let i = 1; i < poly.points.length; i++) {
          const pt = poly.points[i];
          ctx.lineTo(pt.x * scaleX, h - (pt.y * scaleY));
        }
        if (poly.closed) ctx.closePath();
        ctx.stroke();

        // Start point indicator
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(sx0, sy0, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [rasterImage, rawPolylines, rasterSettings, sourceType]);

  // --- Draw Vector Overlay on Lightbox Modal ---
  useEffect(() => {
    if (!showImageLightbox || !rasterImage || !lightboxVectorCanvasRef.current || sourceType !== 'raster') return;
    const canvas = lightboxVectorCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const maxDimension = 1200;
    const scale = Math.min(1, maxDimension / Math.max(rasterImage.width, rasterImage.height));
    const w = Math.round(rasterImage.width * scale);
    const h = Math.round(rasterImage.height * scale);
    canvas.width = w;
    canvas.height = h;

    ctx.fillStyle = '#050811';
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.35;
    ctx.drawImage(rasterImage, 0, 0, w, h);
    ctx.globalAlpha = 1.0;

    if (rawPolylines.length > 0) {
      const scaleX = w / (rasterSettings.targetWidth || 1);
      const scaleY = h / (rasterSettings.targetHeight || 1);

      ctx.lineWidth = 1.6;
      ctx.strokeStyle = '#22d3ee';
      ctx.shadowColor = 'rgba(34, 211, 238, 0.8)';
      ctx.shadowBlur = 4;

      for (const poly of rawPolylines) {
        if (!poly.points || poly.points.length < 2) continue;
        ctx.beginPath();
        const p0 = poly.points[0];
        const sx0 = p0.x * scaleX;
        const sy0 = h - (p0.y * scaleY);
        ctx.moveTo(sx0, sy0);

        for (let i = 1; i < poly.points.length; i++) {
          const pt = poly.points[i];
          ctx.lineTo(pt.x * scaleX, h - (pt.y * scaleY));
        }
        if (poly.closed) ctx.closePath();
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(sx0, sy0, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [showImageLightbox, lightboxView, rasterImage, rawPolylines, rasterSettings, sourceType]);

  // --- Compute Raw Geometry Bounds before Transform ---
  const rawBounds = useMemo(() => {
    if (rawPolylines.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0, centerX: 0, centerY: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const poly of rawPolylines) {
      for (const pt of poly.points) {
        if (pt.x < minX) minX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y > maxY) maxY = pt.y;
      }
    }
    if (minX === Infinity) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0, centerX: 0, centerY: 0 };
    const width = Math.max(0.01, Number((maxX - minX).toFixed(2)));
    const height = Math.max(0.01, Number((maxY - minY).toFixed(2)));
    return {
      minX, minY, maxX, maxY, width, height,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2
    };
  }, [rawPolylines]);

  // Keep Soll X and Soll Y in sync with scale and raw bounds
  useEffect(() => {
    if (rawBounds.width > 0 && rawBounds.height > 0) {
      setSollWidth(Number((rawBounds.width * (scaleX / 100)).toFixed(1)));
      setSollHeight(Number((rawBounds.height * (scaleY / 100)).toFixed(1)));
    }
  }, [rawBounds.width, rawBounds.height, scaleX, scaleY]);

  // --- Helper: Add Current Object into Canvas Composition ---
  const handleAddCurrentToComposition = () => {
    let polylinesToAdd = rawPolylines;

    // For raster source, generate high-resolution vectors from full-scale image for clean CNC curves
    if (sourceType === 'raster' && rasterImage) {
      const highResCanvas = document.createElement('canvas');
      const maxDim = 1200;
      const scale = Math.min(1, maxDim / Math.max(rasterImage.width, rasterImage.height));
      const w = Math.max(10, Math.round(rasterImage.width * scale));
      const h = Math.max(10, Math.round(rasterImage.height * scale));
      highResCanvas.width = w;
      highResCanvas.height = h;
      const ctx = highResCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(rasterImage, 0, 0, w, h);
        const hiResPaths = generateRasterToVectorPaths(highResCanvas, rasterSettings, 1000);
        if (hiResPaths && hiResPaths.length > 0) {
          polylinesToAdd = hiResPaths;
        }
      }
    }

    if (polylinesToAdd.length === 0) return;

    let elName = 'Objekt';
    if (sourceType === 'text') elName = `Text: "${textValue.slice(0, 15)}"`;
    else if (sourceType === 'shapes') elName = `Form: ${shapeType.toUpperCase()}`;
    else if (sourceType === 'file') elName = `Datei: ${uploadedFileName || 'Vektor'}`;
    else if (sourceType === 'raster') elName = `Trace: ${rasterImageName || 'Bild'}`;

    pushUndoSnapshot();
    const newElement: CompositionElement = {
      id: 'el_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: elName,
      sourceType,
      polylines: JSON.parse(JSON.stringify(polylinesToAdd)),
      offsetX: objOffsetX,
      offsetY: objOffsetY,
      rotation: objRotation,
      scaleX: scaleX,
      scaleY: scaleY,
      flipX: objFlipX,
      flipY: objFlipY,
      visible: true,
    };

    setCompositionElements(prev => [...prev, newElement]);
    setSelectedElementId(newElement.id);
  };

  // Push Undo Snapshot
  const pushUndoSnapshot = useCallback(() => {
    const snapshot: GeneratorSnapshot = {
      compositionElements: JSON.parse(JSON.stringify(compositionElements)),
      selectedElementIds: [...selectedElementIds],
      objOffsetX,
      objOffsetY,
      objRotation,
      scaleX,
      scaleY,
      objFlipX,
      objFlipY,
    };
    setUndoStack(prev => [...prev.slice(-30), snapshot]);
    setRedoStack([]);
  }, [compositionElements, selectedElementIds, objOffsetX, objOffsetY, objRotation, scaleX, scaleY, objFlipX, objFlipY]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const currentSnapshot: GeneratorSnapshot = {
      compositionElements: JSON.parse(JSON.stringify(compositionElements)),
      selectedElementIds: [...selectedElementIds],
      objOffsetX,
      objOffsetY,
      objRotation,
      scaleX,
      scaleY,
      objFlipX,
      objFlipY,
    };
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(r => [...r, currentSnapshot]);
    setUndoStack(u => u.slice(0, -1));

    setCompositionElements(prev.compositionElements);
    setSelectedElementIds(prev.selectedElementIds);
    setObjOffsetX(prev.objOffsetX);
    setObjOffsetY(prev.objOffsetY);
    setObjRotation(prev.objRotation);
    setScaleX(prev.scaleX);
    setScaleY(prev.scaleY);
    setObjFlipX(prev.objFlipX);
    setObjFlipY(prev.objFlipY);
  }, [undoStack, compositionElements, selectedElementIds, objOffsetX, objOffsetY, objRotation, scaleX, scaleY, objFlipX, objFlipY]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const currentSnapshot: GeneratorSnapshot = {
      compositionElements: JSON.parse(JSON.stringify(compositionElements)),
      selectedElementIds: [...selectedElementIds],
      objOffsetX,
      objOffsetY,
      objRotation,
      scaleX,
      scaleY,
      objFlipX,
      objFlipY,
    };
    const next = redoStack[redoStack.length - 1];
    setUndoStack(u => [...u, currentSnapshot]);
    setRedoStack(r => r.slice(0, -1));

    setCompositionElements(next.compositionElements);
    setSelectedElementIds(next.selectedElementIds);
    setObjOffsetX(next.objOffsetX);
    setObjOffsetY(next.objOffsetY);
    setObjRotation(next.objRotation);
    setScaleX(next.scaleX);
    setScaleY(next.scaleY);
    setObjFlipX(next.objFlipX);
    setObjFlipY(next.objFlipY);
  }, [redoStack, compositionElements, selectedElementIds, objOffsetX, objOffsetY, objRotation, scaleX, scaleY, objFlipX, objFlipY]);

  const handleDeleteElement = (id: string) => {
    pushUndoSnapshot();
    setCompositionElements(prev => prev.filter(el => el.id !== id));
    if (selectedElementId === id) setSelectedElementId(null);
  };

  const handleDeleteSelected = useCallback(() => {
    if (selectedElementIds.length === 0 && !selectedElementId) return;
    pushUndoSnapshot();
    if (selectedElementIds.length > 0) {
      setCompositionElements(prev => prev.filter(el => !selectedElementIds.includes(el.id)));
      setSelectedElementIds([]);
    } else if (selectedElementId) {
      setCompositionElements(prev => prev.filter(el => el.id !== selectedElementId));
      setSelectedElementIds([]);
    }
  }, [selectedElementIds, selectedElementId, pushUndoSnapshot]);

  const handleDuplicateSelected = useCallback(() => {
    const idsToDuplicate = selectedElementIds.length > 0 ? selectedElementIds : (selectedElementId ? [selectedElementId] : []);
    if (idsToDuplicate.length === 0) return;
    pushUndoSnapshot();
    const newElements: CompositionElement[] = [];
    const newSelectedIds: string[] = [];

    compositionElements.forEach(el => {
      if (idsToDuplicate.includes(el.id)) {
        const dup: CompositionElement = {
          ...el,
          id: 'el_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          name: el.name + ' (Kopie)',
          offsetX: el.offsetX + 10,
          offsetY: el.offsetY + 10,
        };
        newElements.push(dup);
        newSelectedIds.push(dup.id);
      }
    });

    if (newElements.length > 0) {
      setCompositionElements(prev => [...prev, ...newElements]);
      setSelectedElementIds(newSelectedIds);
    }
  }, [selectedElementIds, selectedElementId, compositionElements, pushUndoSnapshot]);

  // Global Keyboard Shortcuts (Delete / Backspace, Undo / Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElementIds.length > 0 || selectedElementId) {
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
  }, [selectedElementIds, selectedElementId, handleDeleteSelected, handleUndo, handleRedo]);

  const handleToggleElementLock = (id: string) => {
    setCompositionElements(prev => prev.map(el => el.id === id ? { ...el, locked: !el.locked } : el));
  };

  const handleMoveElementUp = (index: number) => {
    if (index <= 0) return;
    setCompositionElements(prev => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleMoveElementDown = (index: number) => {
    setCompositionElements(prev => {
      if (index >= prev.length - 1) return prev;
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleRenameElement = (id: string, newName: string) => {
    setCompositionElements(prev => prev.map(el => el.id === id ? { ...el, name: newName } : el));
  };

  const handleSetAllElementsVisibility = (visible: boolean) => {
    setCompositionElements(prev => prev.map(el => ({ ...el, visible })));
  };

  const handleDuplicateElement = (id: string) => {
    pushUndoSnapshot();
    const el = compositionElements.find(e => e.id === id);
    if (!el) return;
    const dup: CompositionElement = {
      ...el,
      id: 'el_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: el.name + ' (Kopie)',
      offsetX: el.offsetX + 10,
      offsetY: el.offsetY + 10,
    };
    setCompositionElements(prev => [...prev, dup]);
    setSelectedElementId(dup.id);
  };

  const handleToggleElementVisibility = (id: string) => {
    setCompositionElements(prev => prev.map(el => el.id === id ? { ...el, visible: !el.visible } : el));
  };

  const handleClearComposition = () => {
    pushUndoSnapshot();
    setCompositionElements([]);
    setSelectedElementId(null);
  };

  // --- Compute Live Draft Polylines (Current parameters preview before adding) ---
  const draftPolylines = useMemo<VectorPolyline[]>(() => {
    if (rawPolylines.length === 0) return [];
    if (rawBounds.width === 0) return rawPolylines;

    const { centerX, centerY } = rawBounds;
    const sx = scaleX / 100;
    const sy = scaleY / 100;
    const rad = (objRotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    return rawPolylines.map(poly => ({
      ...poly,
      points: poly.points.map(p => {
        let x = (p.x - centerX) * sx * (objFlipX ? -1 : 1);
        let y = (p.y - centerY) * sy * (objFlipY ? -1 : 1);

        if (objRotation !== 0) {
          const rx = x * cos - y * sin;
          const ry = x * sin + y * cos;
          x = rx;
          y = ry;
        }

        return {
          x: Number((x + centerX + objOffsetX).toFixed(3)),
          y: Number((y + centerY + objOffsetY).toFixed(3)),
        };
      }),
    }));
  }, [
    rawPolylines,
    rawBounds,
    objOffsetX,
    objOffsetY,
    objRotation,
    scaleX,
    scaleY,
    objFlipX,
    objFlipY
  ]);

  // --- Compute Draft Bounding Box & Stats for Live Preview ---
  const draftStats = useMemo(() => {
    if (draftPolylines.length === 0) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let pointCount = 0;
    let totalCutLength = 0;

    draftPolylines.forEach(p => {
      for (let i = 0; i < p.points.length; i++) {
        const pt = p.points[i];
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
        pointCount++;
        if (i > 0) {
          const prev = p.points[i - 1];
          totalCutLength += Math.hypot(pt.x - prev.x, pt.y - prev.y);
        }
      }
    });

    if (minX === Infinity) return null;
    const width = Math.max(0, maxX - minX);
    const height = Math.max(0, maxY - minY);

    return {
      minX: Number(minX.toFixed(2)),
      maxX: Number(maxX.toFixed(2)),
      minY: Number(minY.toFixed(2)),
      maxY: Number(maxY.toFixed(2)),
      centerX: Number(((minX + maxX) / 2).toFixed(1)),
      centerY: Number(((minY + maxY) / 2).toFixed(1)),
      width: Number(width.toFixed(1)),
      height: Number(height.toFixed(1)),
      pathsCount: draftPolylines.length,
      pointCount,
      cutLengthMm: Math.round(totalCutLength),
    };
  }, [draftPolylines]);

  // --- Compute Descriptive Title for the Live Draft ---
  const draftTitle = useMemo(() => {
    if (sourceType === 'text') return `Text: "${textValue.slice(0, 16)}${textValue.length > 16 ? '...' : ''}"`;
    if (sourceType === 'shapes') return `Form: ${shapeType.toUpperCase()}`;
    if (sourceType === 'file') return `Datei: ${uploadedFileName || 'Vektor'}`;
    if (sourceType === 'raster') {
      const modeLabel = rasterSettings.mode === 'contour_trace' ? 'Kontur' :
        rasterSettings.mode === 'centerline_trace' ? 'Centerline' :
        rasterSettings.mode === 'stippling' ? 'Stippling' :
        rasterSettings.mode === 'wave' ? 'Wellen' :
        rasterSettings.mode === 'crosshatch' ? 'Kreuzschraffur' : 'Schraffur';
      return `Trace (${modeLabel}): ${rasterImageName || 'Bild'}`;
    }
    return 'Entwurf';
  }, [sourceType, textValue, shapeType, uploadedFileName, rasterSettings.mode, rasterImageName]);

  // --- Compute Drag Knife Compensated Result for Live Draft (if in dragknife mode) ---
  const draftDragKnifeResult = useMemo<CompensatedPathResult | null>(() => {
    if (targetMode !== 'dragknife' || draftPolylines.length === 0) return null;
    return applyDragKnifeCompensation(
      draftPolylines.map(p => ({ points: p.points, closed: p.closed })),
      {
        bladeOffset: dragKnifeOptions.bladeOffset,
        swivelAngleThreshold: dragKnifeOptions.swivelAngleThreshold,
        swivelFeedrate: dragKnifeOptions.swivelFeedrate,
        cuttingFeedrate: dragKnifeOptions.cuttingFeedrate,
        overcut: dragKnifeOptions.overcut,
        liftOnSwivel: dragKnifeOptions.liftOnSwivel,
        liftAmount: dragKnifeOptions.liftAmount,
        liftOnRapid: dragKnifeOptions.liftOnRapid,
        rapidLiftZ: dragKnifeOptions.rapidLiftZ,
        penUpCommand: dragKnifeOptions.penUpCommand,
        penDownCommand: dragKnifeOptions.penDownCommand,
      }
    );
  }, [targetMode, draftPolylines, dragKnifeOptions]);

  // --- Compute Transformed Composition Polylines (Committed Objects) ---
  const compositionPolylines = useMemo<VectorPolyline[]>(() => {
    if (compositionElements.length === 0) return [];
    const combined: VectorPolyline[] = [];

    compositionElements.forEach(el => {
      if (!el.visible || el.polylines.length === 0) return;

      // Compute local bounds for center calculation
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      el.polylines.forEach(p => {
        p.points.forEach(pt => {
          if (pt.x < minX) minX = pt.x;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.y > maxY) maxY = pt.y;
        });
      });
      const cX = minX === Infinity ? 0 : (minX + maxX) / 2;
      const cY = minY === Infinity ? 0 : (minY + maxY) / 2;

      const sx = el.scaleX / 100;
      const sy = el.scaleY / 100;
      const rad = (el.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      el.polylines.forEach(poly => {
        combined.push({
          ...poly,
          points: poly.points.map(p => {
            let x = (p.x - cX) * sx * (el.flipX ? -1 : 1);
            let y = (p.y - cY) * sy * (el.flipY ? -1 : 1);

            if (el.rotation !== 0) {
              const rx = x * cos - y * sin;
              const ry = x * sin + y * cos;
              x = rx;
              y = ry;
            }

            return {
              x: Number((x + cX + el.offsetX).toFixed(3)),
              y: Number((y + cY + el.offsetY).toFixed(3)),
            };
          }),
        });
      });
    });

    return combined;
  }, [compositionElements]);

  // --- Compute Active Polylines (Composition items, or Draft if composition is empty) ---
  const activePolylines = useMemo<VectorPolyline[]>(() => {
    if (compositionElements.length > 0) {
      return compositionPolylines;
    }
    return draftPolylines;
  }, [compositionElements.length, compositionPolylines, draftPolylines]);

  // --- Compute Object Groups for Object-Aware G-Code Generation ---
  const activeGroups = useMemo<UniversalGcodeGroup[]>(() => {
    if (compositionElements.length > 0) {
      const groups: UniversalGcodeGroup[] = [];

      compositionElements.forEach((el, elIdx) => {
        if (!el.visible || el.polylines.length === 0) return;

        // Compute local bounds for center calculation
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        el.polylines.forEach(p => {
          p.points.forEach(pt => {
            if (pt.x < minX) minX = pt.x;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.y > maxY) maxY = pt.y;
          });
        });
        const cX = minX === Infinity ? 0 : (minX + maxX) / 2;
        const cY = minY === Infinity ? 0 : (minY + maxY) / 2;

        const sx = el.scaleX / 100;
        const sy = el.scaleY / 100;
        const rad = (el.rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const elPolys: VectorPolyline[] = el.polylines.map(poly => ({
          ...poly,
          points: poly.points.map(p => {
            let x = (p.x - cX) * sx * (el.flipX ? -1 : 1);
            let y = (p.y - cY) * sy * (el.flipY ? -1 : 1);

            if (el.rotation !== 0) {
              const rx = x * cos - y * sin;
              const ry = x * sin + y * cos;
              x = rx;
              y = ry;
            }

            return {
              x: Number((x + cX + el.offsetX).toFixed(3)),
              y: Number((y + cY + el.offsetY).toFixed(3)),
            };
          }),
        }));

        groups.push({
          name: el.name || `Objekt ${elIdx + 1}`,
          polylines: elPolys,
        });
      });

      return groups;
    }

    if (activePolylines.length === 0) return [];
    let singleName = 'Objekt';
    if (sourceType === 'text') singleName = `Text: "${textValue.slice(0, 15)}"`;
    else if (sourceType === 'shapes') singleName = `Form: ${shapeType.toUpperCase()}`;
    else if (sourceType === 'file') singleName = `Datei: ${uploadedFileName || 'Vektor'}`;
    else if (sourceType === 'raster') singleName = `Trace: ${rasterImageName || 'Bild'}`;

    return [{
      name: singleName,
      polylines: activePolylines,
    }];
  }, [
    compositionElements,
    activePolylines,
    sourceType,
    textValue,
    shapeType,
    uploadedFileName,
    rasterImageName,
  ]);

  // --- Compute Optimized Execution Order for Groups and Polylines ---
  const { orderedGroups: activeOptimizedGroups, orderedPolylines: activeOptimizedPolylines } = useMemo(() => {
    return getOptimizedPolylinesAndGroups({
      groups: activeGroups,
      polylines: activePolylines,
      optimizeOrder,
      objectOrderMode,
      pathOrderStrategy,
    });
  }, [activeGroups, activePolylines, optimizeOrder, objectOrderMode, pathOrderStrategy]);

  // --- Compute Drag Knife Compensated Result if in dragknife mode ---
  const dragKnifeResult = useMemo<CompensatedPathResult | null>(() => {
    if (targetMode !== 'dragknife' || activeOptimizedPolylines.length === 0) return null;
    return applyDragKnifeCompensation(
      activeOptimizedPolylines.map(p => ({ points: p.points, closed: p.closed })),
      {
        bladeOffset: dragKnifeOptions.bladeOffset,
        swivelAngleThreshold: dragKnifeOptions.swivelAngleThreshold,
        swivelFeedrate: dragKnifeOptions.swivelFeedrate,
        cuttingFeedrate: dragKnifeOptions.cuttingFeedrate,
        travelFeedrate: dragKnifeOptions.travelFeedrate || currentProfile.travelFeedrate || 3000,
        overcut: dragKnifeOptions.overcut,
        liftOnSwivel: dragKnifeOptions.liftOnSwivel,
        liftAmount: dragKnifeOptions.liftAmount,
        liftOnRapid: dragKnifeOptions.liftOnRapid,
        rapidLiftZ: dragKnifeOptions.rapidLiftZ,
        penUpCommand: dragKnifeOptions.penUpCommand,
        penDownCommand: dragKnifeOptions.penDownCommand,
      },
      activeOptimizedGroups.map(g => ({
        name: g.name,
        paths: g.polylines.map(p => ({ points: p.points, closed: p.closed })),
      }))
    );
  }, [targetMode, activeOptimizedPolylines, activeOptimizedGroups, dragKnifeOptions, currentProfile.travelFeedrate]);

  // --- Generate Live Universal G-Code ---
  const generatedGcode = useMemo<string>(() => {
    if (activePolylines.length === 0) return '; Kein Motiv geladen';

    return generateUniversalGcode({
      groups: activeOptimizedGroups,
      targetMode,
      profile: currentProfile,
      penOptions,
      dragKnifeOptions,
      laserOptions,
      optimizeOrder: false, // Already pre-optimized in activeOptimizedGroups
      objectOrderMode,
      pathOrderStrategy,
    });
  }, [
    activeOptimizedGroups,
    activePolylines.length,
    targetMode,
    currentProfile,
    penOptions,
    dragKnifeOptions,
    laserOptions,
    objectOrderMode,
    pathOrderStrategy
  ]);

  // --- Compute Geometry & Bounds Stats (Including Live Rapid Moves / Leerfahrten) ---
  const stats = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let totalCutLength = 0;
    let pointCount = 0;

    activePolylines.forEach(p => {
      for (let i = 0; i < p.points.length; i++) {
        const pt = p.points[i];
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
        pointCount++;
        if (i > 0) {
          const prev = p.points[i - 1];
          totalCutLength += Math.hypot(pt.x - prev.x, pt.y - prev.y);
        }
      }
    });

    // Compute exact rapid travel length (G0 Leerfahrt) in real-time
    let totalRapidLength = 0;
    if (targetMode === 'dragknife' && dragKnifeResult && dragKnifeResult.compensatedSegments.length > 0) {
      dragKnifeResult.compensatedSegments.forEach(seg => {
        if (seg.type === 'G0' || (seg as any).type === 'rapid') {
          totalRapidLength += Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y);
        }
      });
    } else if (activeOptimizedPolylines.length > 0) {
      // 1. From (0,0) to start of first polyline
      const firstPt = activeOptimizedPolylines[0].points[0];
      if (firstPt) {
        totalRapidLength += Math.hypot(firstPt.x - 0, firstPt.y - 0);
      }
      // 2. Rapid between consecutive polylines
      for (let i = 0; i < activeOptimizedPolylines.length - 1; i++) {
        const curr = activeOptimizedPolylines[i];
        const next = activeOptimizedPolylines[i + 1];
        if (curr.points.length > 0 && next.points.length > 0) {
          const endPt = curr.closed ? curr.points[0] : curr.points[curr.points.length - 1];
          const nextStartPt = next.points[0];
          totalRapidLength += Math.hypot(nextStartPt.x - endPt.x, nextStartPt.y - endPt.y);
        }
      }
      // 3. Rapid back from last polyline to origin (0,0)
      const lastPoly = activeOptimizedPolylines[activeOptimizedPolylines.length - 1];
      if (lastPoly && lastPoly.points.length > 0) {
        const lastEndPt = lastPoly.closed ? lastPoly.points[0] : lastPoly.points[lastPoly.points.length - 1];
        totalRapidLength += Math.hypot(lastEndPt.x - 0, lastEndPt.y - 0);
      }
    }

    const width = maxX === -Infinity ? 0 : Math.max(0, maxX - minX);
    const height = maxY === -Infinity ? 0 : Math.max(0, maxY - minY);
    const pathsCount = activePolylines.length;

    // Approximate time including feedrates for cutting and rapid travel
    const feed = targetMode === 'dragknife' 
      ? dragKnifeOptions.cuttingFeedrate 
      : (targetMode === 'laser' ? laserOptions.feedrate : penOptions.drawingFeedrate);
    const travelFeed = targetMode === 'dragknife'
      ? (dragKnifeOptions.travelFeedrate || currentProfile.travelFeedrate || 3000)
      : (targetMode === 'pen' ? (penOptions.travelFeedrate || currentProfile.travelFeedrate || 3000) : (currentProfile.travelFeedrate || 3000));

    const cutTimeSec = (totalCutLength / Math.max(100, feed)) * 60;
    const travelTimeSec = (totalRapidLength / Math.max(100, travelFeed)) * 60;
    const estSec = Math.round(cutTimeSec + travelTimeSec + pathsCount * 0.3);

    return {
      minX: minX === Infinity ? 0 : minX,
      maxX: maxX === -Infinity ? 0 : maxX,
      minY: minY === Infinity ? 0 : minY,
      maxY: maxY === -Infinity ? 0 : maxY,
      centerX: minX === Infinity ? 0 : Math.round((minX + maxX) / 2 * 10) / 10,
      centerY: minY === Infinity ? 0 : Math.round((minY + maxY) / 2 * 10) / 10,
      width: Math.round(width * 10) / 10,
      height: Math.round(height * 10) / 10,
      depth: Math.abs((targetMode === 'dragknife' ? dragKnifeOptions.depth : (targetMode === 'pen' ? (penOptions.penDownZ || 0) : 0)) || 0),
      pathsCount,
      zRetracts: activeOptimizedPolylines.length > 0 ? activeOptimizedPolylines.length : pathsCount,
      pointCount,
      cutLengthMm: Math.round(totalCutLength),
      rapidLengthMm: Math.round(totalRapidLength),
      estSeconds: estSec,
    };
  }, [
    activePolylines,
    activeOptimizedPolylines,
    dragKnifeResult,
    targetMode,
    penOptions,
    dragKnifeOptions,
    laserOptions,
    currentProfile
  ]);

  const localSimSegments = useMemo(() => {
    const parsed = parseGcode(generatedGcode, currentProfile.penUpZ || 2);
    return parsed.segments || [];
  }, [generatedGcode, currentProfile.penUpZ]);

  // --- Draw Live Preview Canvas (2D & 3D Interactive Modes) ---
  const renderPreview = useCallback(() => {
    const isJobStreaming = streamProgress.isStreaming || streamProgress.isPaused;
    
    let effectiveSimIndex = 0;
    if (isJobStreaming) {
      for (let i = localSimSegments.length - 1; i >= 0; i--) {
        if (localSimSegments[i].lineIndex <= streamProgress.currentLine) {
          effectiveSimIndex = i;
          break;
        }
      }
    } else {
      effectiveSimIndex = simIndex;
    }

    const isSimulationActive = (showSimSlider && (isSimPlaying || simIndex > 0)) || isJobStreaming;

    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const cw = rect.width;
    const ch = rect.height;
    if (cw === 0 || ch === 0) return;

    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = theme.bgTone || '#090d16';
    ctx.fillRect(0, 0, cw, ch);

    // Coordinate system: CNC 0,0 is bottom-left
    const bedW = currentProfile.bedWidth || 200;
    const bedH = currentProfile.bedHeight || 200;

    if (viewMode === '3d') {
      // 3D ISOMETRIC / ORBIT RENDERING
      const radYaw = (orbitYaw * Math.PI) / 180;
      const radPitch = (orbitPitch * Math.PI) / 180;
      const cosYaw = Math.cos(radYaw);
      const sinYaw = Math.sin(radYaw);
      const cosPitch = Math.cos(radPitch);
      const sinPitch = Math.sin(radPitch);

      const project3D = (x: number, y: number, z: number = 0) => {
        const cx = bedW / 2;
        const cy = bedH / 2;
        const rx = x - cx;
        const ry = y - cy;

        const x1 = rx * cosYaw - ry * sinYaw;
        const y1 = rx * sinYaw + ry * cosYaw;

        const sx = pan.x + x1 * zoom;
        // Z+ subtracts from sy so it strictly points UP on the screen
        const sy = pan.y - (y1 * sinPitch + z * cosPitch * 2.0) * zoom;
        return { sx, sy };
      };

      // Bed Floor
      ctx.save();
      const p00 = project3D(0, 0, 0);
      const pW0 = project3D(bedW, 0, 0);
      const pWH = project3D(bedW, bedH, 0);
      const p0H = project3D(0, bedH, 0);

      ctx.fillStyle = theme.isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(240, 240, 240, 0.7)';
      ctx.beginPath();
      ctx.moveTo(p00.sx, p00.sy);
      ctx.lineTo(pW0.sx, pW0.sy);
      ctx.lineTo(pWH.sx, pWH.sy);
      ctx.lineTo(p0H.sx, p0H.sy);
      ctx.closePath();
      ctx.fill();

      // Grid
      ctx.strokeStyle = theme.gridColor || 'rgba(51, 65, 85, 0.35)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= bedW; x += 20) {
        const p1 = project3D(x, 0, 0);
        const p2 = project3D(x, bedH, 0);
        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.stroke();
      }
      for (let y = 0; y <= bedH; y += 20) {
        const p1 = project3D(0, y, 0);
        const p2 = project3D(bedW, y, 0);
        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.stroke();
      }

      // Outer Bed border
      ctx.strokeStyle = theme.borderTone || (theme.isDark ? '#64748b' : '#94a3b8');
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p00.sx, p00.sy);
      ctx.lineTo(pW0.sx, pW0.sy);
      ctx.lineTo(pWH.sx, pWH.sy);
      ctx.lineTo(p0H.sx, p0H.sy);
      ctx.closePath();
      ctx.stroke();

      // 3D Bauraumhöhe (Build Volume wireframe box extending UPWARDS from Z=0)
      const zHeight = currentProfile.bedDepth > 0 ? currentProfile.bedDepth : 50;
      const d00 = project3D(0, 0, zHeight);
      const dW0 = project3D(bedW, 0, zHeight);
      const dWH = project3D(bedW, bedH, zHeight);
      const d0H = project3D(0, bedH, zHeight);

      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      // Vertical corner pillars
      ctx.moveTo(p00.sx, p00.sy); ctx.lineTo(d00.sx, d00.sy);
      ctx.moveTo(pW0.sx, pW0.sy); ctx.lineTo(dW0.sx, dW0.sy);
      ctx.moveTo(pWH.sx, pWH.sy); ctx.lineTo(dWH.sx, dWH.sy);
      ctx.moveTo(p0H.sx, p0H.sy); ctx.lineTo(d0H.sx, d0H.sy);
      // Top ceiling frame
      ctx.moveTo(d00.sx, d00.sy);
      ctx.lineTo(dW0.sx, dW0.sy);
      ctx.lineTo(dWH.sx, dWH.sy);
      ctx.lineTo(d0H.sx, d0H.sy);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = `${Math.round(10 * (uiScale || 100) / 100)}px monospace`;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.fillText(`Z max: ${zHeight}mm`, d00.sx + 4, d00.sy - 4);
      ctx.restore();

      // 3D Origin (0,0,0) Triad with Z-Up arrow
      if (showOriginMarker) {
        const orig3d = project3D(0, 0, 0);
        const xAx3d = project3D(30, 0, 0);
        const yAx3d = project3D(0, 30, 0);
        const zAx3d = project3D(0, 0, 30);

        // X-Axis (Red)
        ctx.strokeStyle = '#ef4444';
        ctx.fillStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(orig3d.sx, orig3d.sy);
        ctx.lineTo(xAx3d.sx, xAx3d.sy);
        ctx.stroke();
        ctx.font = `bold ${Math.round(11 * (uiScale || 100) / 100)}px monospace`;
        ctx.fillText('X+', xAx3d.sx + 3, xAx3d.sy + 3);

        // Y-Axis (Green)
        ctx.strokeStyle = '#22c55e';
        ctx.fillStyle = '#22c55e';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(orig3d.sx, orig3d.sy);
        ctx.lineTo(yAx3d.sx, yAx3d.sy);
        ctx.stroke();
        ctx.fillText('Y+', yAx3d.sx + 3, yAx3d.sy + 3);

        // Z-Axis in 3D (Blue) - Z+ strictly pointing UP
        ctx.strokeStyle = '#3b82f6';
        ctx.fillStyle = '#60a5fa';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(orig3d.sx, orig3d.sy);
        ctx.lineTo(zAx3d.sx, zAx3d.sy);
        ctx.stroke();

        // Z+ Arrowhead
        ctx.beginPath();
        ctx.moveTo(zAx3d.sx, zAx3d.sy);
        ctx.lineTo(zAx3d.sx - 4, zAx3d.sy + 7);
        ctx.lineTo(zAx3d.sx + 4, zAx3d.sy + 7);
        ctx.closePath();
        ctx.fill();
        ctx.fillText('Z+', zAx3d.sx + 5, zAx3d.sy - 2);
      }
      // Z-Hop calculation for clear 3D plunge/retract visualization
      let penUpZVal = 5;
      if (targetMode === 'dragknife') {
        penUpZVal = dragKnifeOptions.penUpZ ?? currentProfile.penUpZ ?? 5;
      } else {
      penUpZVal = penOptions.penUpZ ?? currentProfile.penUpZ ?? 5;
      }
      const penUpZ = penUpZVal;
      const penDownZ = 0;

      // Draw Main Active Toolpaths (Composition Elements or Primary Active Object) in 3D
      ctx.save();
      ctx.globalAlpha = isSimulationActive ? 0.15 : 1.0;
      if (targetMode === 'dragknife' && dragKnifeResult && dragKnifeResult.compensatedSegments.length > 0) {
        dragKnifeResult.compensatedSegments.forEach(seg => {
          if ((seg.type === 'SWIVEL_ARC' || (seg as any).type === 'swivel') && showSwivelArcs) {
            ctx.save();
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            
            // Draw an actual arc if seg has center and sweep, else just a line (simplified fallback)
            if (seg.center) {
              const cX = seg.center.x, cY = seg.center.y;
              const r1 = Math.hypot(seg.from.x - cX, seg.from.y - cY);
              const r2 = Math.hypot(seg.to.x - cX, seg.to.y - cY);
              const radius = (r1 + r2) / 2 || r1;
              
              if (radius > 0.001) {
                const a1 = Math.atan2(seg.from.y - cY, seg.from.x - cX);
                const a2 = Math.atan2(seg.to.y - cY, seg.to.x - cX);
                const isCW = seg.clockwise ?? true;
                let sweep = a2 - a1;
                if (isCW && sweep > 0) sweep -= 2 * Math.PI;
                if (!isCW && sweep < 0) sweep += 2 * Math.PI;
                
                // For 3D, arcs are complex, so we fallback to line if not perfectly on Z=0
                const p1 = project3D(seg.from.x, seg.from.y, penDownZ);
                const p2 = project3D(seg.to.x, seg.to.y, penDownZ);
                ctx.moveTo(p1.sx, p1.sy);
                ctx.lineTo(p2.sx, p2.sy);
              } else {
                const p1 = project3D(seg.from.x, seg.from.y, penDownZ);
                const p2 = project3D(seg.to.x, seg.to.y, penDownZ);
                ctx.moveTo(p1.sx, p1.sy);
                ctx.lineTo(p2.sx, p2.sy);
              }
            } else {
              const p1 = project3D(seg.from.x, seg.from.y, penDownZ);
              const p2 = project3D(seg.to.x, seg.to.y, penDownZ);
              ctx.moveTo(p1.sx, p1.sy);
              ctx.lineTo(p2.sx, p2.sy);
            }
            
            ctx.stroke();

            // Swivel Pivot Node on bed
            const pTo = project3D(seg.to.x, seg.to.y, penDownZ);
            ctx.fillStyle = theme.accentColor || '#fbbf24';
            ctx.beginPath();
            ctx.arc(pTo.sx, pTo.sy, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          } else if ((seg.type === 'G1' || (seg as any).type === 'cut') && showCutPaths) {
            ctx.save();
            ctx.strokeStyle = theme.cutLineColor || '#10b981';
            ctx.lineWidth = 2;
            ctx.beginPath();
            const p1 = project3D(seg.from.x, seg.from.y, penDownZ);
            const p2 = project3D(seg.to.x, seg.to.y, penDownZ);
            ctx.moveTo(p1.sx, p1.sy);
            ctx.lineTo(p2.sx, p2.sy);
            ctx.stroke();
            ctx.restore();
          }
        });
      } else if (showCutPaths) {
        activeOptimizedPolylines.forEach((poly) => {
          if (poly.points.length < 2) return;
          const startPt = poly.points[0];

          // Cut Path at Z=0 (Solid Emerald Green on the bed)
          ctx.save();
          ctx.strokeStyle = theme.cutLineColor || '#10b981';
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          const first = project3D(startPt.x, startPt.y, penDownZ);
          ctx.moveTo(first.sx, first.sy);
          for (let i = 1; i < poly.points.length; i++) {
            const pt = project3D(poly.points[i].x, poly.points[i].y, penDownZ);
            ctx.lineTo(pt.sx, pt.sy);
          }
          if (poly.closed) ctx.closePath();
          ctx.stroke();
          ctx.restore();
        });
      }

      // Render Rapid / Travel Moves (G0 Leerfahrten / Eilgang with Z-Hop) in 3D
      if (showRapid) {
        ctx.save();
        if (targetMode === 'dragknife' && dragKnifeResult && dragKnifeResult.compensatedSegments.length > 0) {
          dragKnifeResult.compensatedSegments.forEach(seg => {
            if (seg.type === 'G0' || (seg as any).type === 'rapid') {
              const pUpFrom = project3D(seg.from.x, seg.from.y, penUpZ);
              const pUpTo = project3D(seg.to.x, seg.to.y, penUpZ);
              const pDownFrom = project3D(seg.from.x, seg.from.y, penDownZ);
              const pDownTo = project3D(seg.to.x, seg.to.y, penDownZ);

              // Retract lift
              ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
              ctx.lineWidth = 1;
              ctx.setLineDash([2, 3]);
              ctx.beginPath();
              ctx.moveTo(pDownFrom.sx, pDownFrom.sy);
              ctx.lineTo(pUpFrom.sx, pUpFrom.sy);
              ctx.stroke();

              // Air travel
              ctx.strokeStyle = theme.rapidLineColor || '#f43f5e';
              ctx.lineWidth = 1.3;
              ctx.setLineDash([4, 4]);
              ctx.beginPath();
              ctx.moveTo(pUpFrom.sx, pUpFrom.sy);
              ctx.lineTo(pUpTo.sx, pUpTo.sy);
              ctx.stroke();

              // Plunge drop
              ctx.strokeStyle = 'rgba(34, 197, 94, 0.65)';
              ctx.lineWidth = 1;
              ctx.setLineDash([2, 3]);
              ctx.beginPath();
              ctx.moveTo(pUpTo.sx, pUpTo.sy);
              ctx.lineTo(pDownTo.sx, pDownTo.sy);
              ctx.stroke();
            }
          });
        } else if (activeOptimizedPolylines.length > 0) {
          // 1. Rapid from origin (0,0) to first polyline start
          const firstPt = activeOptimizedPolylines[0].points[0];
          if (firstPt) {
            const p0Up = project3D(0, 0, penUpZ);
            const p1Up = project3D(firstPt.x, firstPt.y, penUpZ);
            const p1Down = project3D(firstPt.x, firstPt.y, penDownZ);

            ctx.strokeStyle = theme.rapidLineColor || '#f43f5e';
            ctx.lineWidth = 1.3;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(p0Up.sx, p0Up.sy);
            ctx.lineTo(p1Up.sx, p1Up.sy);
            ctx.stroke();

            // Plunge
            ctx.strokeStyle = 'rgba(34, 197, 94, 0.65)';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 3]);
            ctx.beginPath();
            ctx.moveTo(p1Up.sx, p1Up.sy);
            ctx.lineTo(p1Down.sx, p1Down.sy);
            ctx.stroke();
          }

          // 2. Rapid between consecutive polylines
          for (let i = 0; i < activeOptimizedPolylines.length - 1; i++) {
            const currentPoly = activeOptimizedPolylines[i];
            const nextPoly = activeOptimizedPolylines[i + 1];
            if (currentPoly.points.length === 0 || nextPoly.points.length === 0) continue;

            const endPt = currentPoly.closed
              ? currentPoly.points[0]
              : currentPoly.points[currentPoly.points.length - 1];
            const nextStartPt = nextPoly.points[0];

            const pEndDown = project3D(endPt.x, endPt.y, penDownZ);
            const pEndUp = project3D(endPt.x, endPt.y, penUpZ);
            const pNextUp = project3D(nextStartPt.x, nextStartPt.y, penUpZ);
            const pNextDown = project3D(nextStartPt.x, nextStartPt.y, penDownZ);

            // Retract lift
            ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 3]);
            ctx.beginPath();
            ctx.moveTo(pEndDown.sx, pEndDown.sy);
            ctx.lineTo(pEndUp.sx, pEndUp.sy);
            ctx.stroke();

            // Air travel
            ctx.strokeStyle = theme.rapidLineColor || '#f43f5e';
            ctx.lineWidth = 1.3;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(pEndUp.sx, pEndUp.sy);
            ctx.lineTo(pNextUp.sx, pNextUp.sy);
            ctx.stroke();

            // Plunge drop
            ctx.strokeStyle = 'rgba(34, 197, 94, 0.65)';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 3]);
            ctx.beginPath();
            ctx.moveTo(pNextUp.sx, pNextUp.sy);
            ctx.lineTo(pNextDown.sx, pNextDown.sy);
            ctx.stroke();
          }

          // 3. Rapid back to origin (0,0)
          const lastPoly = activeOptimizedPolylines[activeOptimizedPolylines.length - 1];
          if (lastPoly && lastPoly.points.length > 0) {
            const lastEndPt = lastPoly.closed
              ? lastPoly.points[0]
              : lastPoly.points[lastPoly.points.length - 1];
            const pLastDown = project3D(lastEndPt.x, lastEndPt.y, penDownZ);
            const pLastUp = project3D(lastEndPt.x, lastEndPt.y, penUpZ);
            const p0Up = project3D(0, 0, penUpZ);

            // Retract
            ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 3]);
            ctx.beginPath();
            ctx.moveTo(pLastDown.sx, pLastDown.sy);
            ctx.lineTo(pLastUp.sx, pLastUp.sy);
            ctx.stroke();

            // Air travel
            ctx.strokeStyle = theme.rapidLineColor || '#f43f5e';
            ctx.lineWidth = 1.3;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(pLastUp.sx, pLastUp.sy);
            ctx.lineTo(p0Up.sx, p0Up.sy);
            ctx.stroke();
          }
        }
        ctx.setLineDash([]);
        ctx.restore();
      }
      ctx.restore(); // Restore globalAlpha

      // 3D LIVE DRAFT OVERLAY (Render draft on canvas before clicking "Zur Arbeitsfläche hinzufügen")
      if (compositionElements.length > 0 && showLiveDraftPreview && draftPolylines.length > 0) {
        if (targetMode === 'dragknife' && draftDragKnifeResult && draftDragKnifeResult.compensatedSegments.length > 0) {
          draftDragKnifeResult.compensatedSegments.forEach(seg => {
            if (seg.type === 'SWIVEL_ARC' || (seg as any).type === 'swivel') {
              ctx.save();
              ctx.strokeStyle = '#f59e0b';
              ctx.lineWidth = 2.5;
              ctx.beginPath();
              const p1 = project3D(seg.from.x, seg.from.y, penDownZ);
              const p2 = project3D(seg.to.x, seg.to.y, penDownZ);
              ctx.moveTo(p1.sx, p1.sy);
              ctx.lineTo(p2.sx, p2.sy);
              ctx.stroke();
              ctx.fillStyle = '#fbbf24';
              ctx.beginPath();
              ctx.arc(p2.sx, p2.sy, 2.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            } else if (seg.type === 'G1' || (seg as any).type === 'cut') {
              ctx.save();
              ctx.strokeStyle = theme.accentColor || '#06b6d4';
              ctx.lineWidth = 2.2;
              ctx.beginPath();
              const p1 = project3D(seg.from.x, seg.from.y, penDownZ);
              const p2 = project3D(seg.to.x, seg.to.y, penDownZ);
              ctx.moveTo(p1.sx, p1.sy);
              ctx.lineTo(p2.sx, p2.sy);
              ctx.stroke();
              ctx.restore();
            }
          });
        } else {
          draftPolylines.forEach(poly => {
            if (poly.points.length < 2) return;
            const startPt = poly.points[0];

            // Cut in Cyan
            ctx.save();
            ctx.strokeStyle = theme.accentColor || '#06b6d4';
            ctx.lineWidth = 2.2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            const first = project3D(startPt.x, startPt.y, penDownZ);
            ctx.moveTo(first.sx, first.sy);
            for (let i = 1; i < poly.points.length; i++) {
              const pt = project3D(poly.points[i].x, poly.points[i].y, penDownZ);
              ctx.lineTo(pt.sx, pt.sy);
            }
            if (poly.closed) ctx.closePath();
            ctx.stroke();
            ctx.restore();
          });
        }

        // 3D Draft Bounding Box on Bed Floor
        if (draftStats && draftStats.width > 0) {
          ctx.save();
          const p1 = project3D(draftStats.minX, draftStats.minY, 0);
          const p2 = project3D(draftStats.maxX, draftStats.minY, 0);
          const p3 = project3D(draftStats.maxX, draftStats.maxY, 0);
          const p4 = project3D(draftStats.minX, draftStats.maxY, 0);

          ctx.strokeStyle = theme.accentColor || '#06b6d4';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(p1.sx, p1.sy);
          ctx.lineTo(p2.sx, p2.sy);
          ctx.lineTo(p3.sx, p3.sy);
          ctx.lineTo(p4.sx, p4.sy);
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        }
      }

      // 3D Overlays: Selection Bounding Boxes, Marquee & Measurement on Bed Plane
      if (selectedElementIds.length > 0) {
        ctx.save();
        compositionElements.forEach(el => {
          if (!el.visible || !selectedElementIds.includes(el.id)) return;
          const rad = ((el.rotation || 0) * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const sX = (el.scaleX ?? 100) / 100 * (el.flipX ? -1 : 1);
          const sY = (el.scaleY ?? 100) / 100 * (el.flipY ? -1 : 1);

          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          el.polylines.forEach(p => {
            p.points.forEach(pt => {
              const scaledX = pt.x * sX;
              const scaledY = pt.y * sY;
              const rx = scaledX * cos - scaledY * sin;
              const ry = scaledX * sin + scaledY * cos;
              const x = rx + el.offsetX;
              const y = ry + el.offsetY;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            });
          });

          if (minX !== Infinity) {
            const p1 = project3D(minX, minY, 0);
            const p2 = project3D(maxX, minY, 0);
            const p3 = project3D(maxX, maxY, 0);
            const p4 = project3D(minX, maxY, 0);

            ctx.strokeStyle = '#c084fc';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            ctx.moveTo(p1.sx, p1.sy);
            ctx.lineTo(p2.sx, p2.sy);
            ctx.lineTo(p3.sx, p3.sy);
            ctx.lineTo(p4.sx, p4.sy);
            ctx.closePath();
            ctx.stroke();
            ctx.setLineDash([]);
          }
        });
        ctx.restore();
      }

      // 3D Marquee Selection Overlay
      if (selectionRect) {
        ctx.save();
        const minX = Math.min(selectionRect.startX, selectionRect.currentX);
        const maxX = Math.max(selectionRect.startX, selectionRect.currentX);
        const minY = Math.min(selectionRect.startY, selectionRect.currentY);
        const maxY = Math.max(selectionRect.startY, selectionRect.currentY);

        const p1 = project3D(minX, minY, 0);
        const p2 = project3D(maxX, minY, 0);
        const p3 = project3D(maxX, maxY, 0);
        const p4 = project3D(minX, maxY, 0);

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
        ctx.restore();
      }

      // 3D Measurement Overlay
      if (genMeasureStart && genMeasureEnd) {
        ctx.save();
        const p1 = project3D(genMeasureStart.x, genMeasureStart.y, 0);
        const p2 = project3D(genMeasureEnd.x, genMeasureEnd.y, 0);
        ctx.strokeStyle = theme.accentColor || '#06b6d4';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.stroke();
        ctx.restore();
      }

      // Simulation Path 3D (G-Code Preview up to simIndex)
      if (localSimSegments.length > 0 && isSimulationActive) {
        ctx.save();
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        let simToolX = 0, simToolY = 0, simToolZ = 0;
        let drawnPath = false;

        for (let i = 0; i < localSimSegments.length; i++) {
          const seg = localSimSegments[i];
          const type = (seg as any).type || seg.type;
          const pFrom = project3D(seg.from.x, seg.from.y, seg.from.z ?? 0);
          let targetX = seg.to.x;
          let targetY = seg.to.y;
          let targetZ = seg.to.z ?? 0;
          if (isJobStreaming && i === effectiveSimIndex) {
            targetX = liveState.wpos.x;
            targetY = liveState.wpos.y;
            targetZ = liveState.wpos.z;
          }
          const pTo = project3D(targetX, targetY, targetZ);
          
          if (i <= effectiveSimIndex) {
            simToolX = targetX; simToolY = targetY; simToolZ = targetZ;
            ctx.globalAlpha = 1.0;
            drawnPath = true;
          } else {
            ctx.globalAlpha = 0.15;
          }
          
          ctx.beginPath();
          ctx.moveTo(pFrom.sx, pFrom.sy);
          if (type === 'G0' || type === 'rapid') {
            ctx.strokeStyle = theme.rapidLineColor || '#f43f5e';
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1.5;
            ctx.lineTo(pTo.sx, pTo.sy);
          } else if (type === 'G1' || type === 'cut') {
            ctx.strokeStyle = theme.cutLineColor || '#10b981';
            ctx.setLineDash([]);
            ctx.lineWidth = 2.5;
            ctx.lineTo(pTo.sx, pTo.sy);
          } else if (type === 'G2' || type === 'G3' || type === 'SWIVEL_ARC' || type === 'swivel') {
             ctx.strokeStyle = '#f59e0b';
             ctx.setLineDash([]);
             ctx.lineWidth = 2.5;
             if (seg.center) {
               const cX = seg.center.x, cY = seg.center.y;
               const r1 = Math.hypot(seg.from.x - cX, seg.from.y - cY);
               const r2 = Math.hypot(targetX - cX, targetY - cY);
               const radius = (r1 + r2) / 2 || r1;
               if (radius > 0.001) {
                 const a1 = Math.atan2(seg.from.y - cY, seg.from.x - cX);
                 const a2 = Math.atan2(targetY - cY, targetX - cX);
                 const isCW = seg.clockwise ?? (type === 'G2');
                 let sweep = a2 - a1;
                 if (isCW && sweep > 0) sweep -= 2 * Math.PI;
                 if (!isCW && sweep < 0) sweep += 2 * Math.PI;
                 const steps = Math.max(5, Math.ceil(Math.abs(sweep) * 12 / Math.PI));
                 for (let s = 1; s <= steps; s++) {
                   const t = s / steps;
                   const angle = a1 + sweep * t;
                   const px = cX + radius * Math.cos(angle);
                   const py = cY + radius * Math.sin(angle);
                   // In 3D, we also linearly interpolate Z
                   const pz = (seg.from.z ?? 0) + (targetZ - (seg.from.z ?? 0)) * t;
                   const pInterp = project3D(px, py, pz);
                   ctx.lineTo(pInterp.sx, pInterp.sy);
                 }
               } else {
                 ctx.lineTo(pTo.sx, pTo.sy);
               }
             } else {
               ctx.lineTo(pTo.sx, pTo.sy);
             }
          } else {
             ctx.lineTo(pTo.sx, pTo.sy);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1.0;

        if (drawnPath) {
          const tP = project3D(simToolX, simToolY, simToolZ);
          ctx.fillStyle = '#eab308';
          ctx.beginPath();
          ctx.arc(tP.sx, tP.sy, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.restore();
      }

      // Live Machine Position Crosshair 3D
      if (liveState && (liveState.status === 'Run' || liveState.status === 'Hold' || liveState.status === 'Idle')) {
        const mx = liveState.wpos.x;
        const my = liveState.wpos.y;
        const mz = liveState.wpos.z;
        const mp = project3D(mx, my, mz);
        
        ctx.save();
        ctx.strokeStyle = '#ef4444'; // Red crosshair
        ctx.lineWidth = 1.5;
        
        // Draw 3D Crosshair
        ctx.beginPath();
        ctx.moveTo(mp.sx - 10, mp.sy);
        ctx.lineTo(mp.sx + 10, mp.sy);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(mp.sx, mp.sy - 10);
        ctx.lineTo(mp.sx, mp.sy + 10);
        ctx.stroke();

        if (liveState.spindleSpeed > 0) {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(mp.sx, mp.sy, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Z-axis indicator line down to bed
        const bedP = project3D(mx, my, 0);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(mp.sx, mp.sy);
        ctx.lineTo(bedP.sx, bedP.sy);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(mp.sx, mp.sy, 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.fill();
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
    } else {
      // ==========================================
      // 2D TOP-DOWN CNC BED WITH OBJECT SELECTION
      // ==========================================
      ctx.save();
      const toScreenX = (x: number) => pan.x + x * zoom;
      const toScreenY = (y: number) => pan.y - y * zoom;

      // Bed Background
      ctx.fillStyle = theme.bgTone || (theme.isDark ? '#0f172a' : '#f8fafc');
      ctx.fillRect(toScreenX(0), toScreenY(bedH), bedW * zoom, bedH * zoom);

      // Bed Grid
      ctx.strokeStyle = theme.gridColor || 'rgba(51, 65, 85, 0.4)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= bedW; x += 10) {
        ctx.beginPath();
        ctx.moveTo(toScreenX(x), toScreenY(0));
        ctx.lineTo(toScreenX(x), toScreenY(bedH));
        ctx.stroke();
      }
      for (let y = 0; y <= bedH; y += 10) {
        ctx.beginPath();
        ctx.moveTo(toScreenX(0), toScreenY(y));
        ctx.lineTo(toScreenX(bedW), toScreenY(y));
        ctx.stroke();
      }

      // Bed Border
      ctx.strokeStyle = theme.borderTone || (theme.isDark ? '#64748b' : '#94a3b8');
      ctx.lineWidth = 2;
      ctx.strokeRect(toScreenX(0), toScreenY(bedH), bedW * zoom, bedH * zoom);

      // Render Committed Objects / Main Active Toolpaths
      ctx.save();
      ctx.globalAlpha = isSimulationActive ? 0.15 : 1.0;
      if (targetMode === 'dragknife' && dragKnifeResult && dragKnifeResult.compensatedSegments.length > 0) {
        // Draw underlying original path in faint dashed cyan
        ctx.strokeStyle = theme.isDark ? 'rgba(6, 182, 212, 0.35)' : 'rgba(6, 182, 212, 0.6)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        activePolylines.forEach((poly) => {
          if (poly.points.length < 2) return;
          ctx.beginPath();
          ctx.moveTo(toScreenX(poly.points[0].x), toScreenY(poly.points[0].y));
          for (let i = 1; i < poly.points.length; i++) {
            ctx.lineTo(toScreenX(poly.points[i].x), toScreenY(poly.points[i].y));
          }
          if (poly.closed) ctx.closePath();
          ctx.stroke();
        });
        ctx.setLineDash([]);

        // Render Compensated Cut and Swivel Segments
        dragKnifeResult.compensatedSegments.forEach((seg) => {
          if (seg.type === 'G0' || (seg as any).type === 'rapid') {
            ctx.strokeStyle = theme.rapidLineColor || '#ef4444';
            ctx.lineWidth = 1.2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(toScreenX(seg.from.x), toScreenY(seg.from.y));
            ctx.lineTo(toScreenX(seg.to.x), toScreenY(seg.to.y));
            ctx.stroke();
            ctx.setLineDash([]);
          } else if ((seg.type === 'SWIVEL_ARC' || (seg as any).type === 'swivel') && showSwivelArcs) {
            // Bright Amber Arc with Blade Pivot Indicator (Rendered as circular curve if center exists)
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 3;
            ctx.beginPath();
            if (seg.center) {
              const fromX = seg.from.x, fromY = seg.from.y;
              const toX = seg.to.x, toY = seg.to.y;
              const cX = seg.center.x, cY = seg.center.y;
              const r1 = Math.hypot(fromX - cX, fromY - cY);
              const r2 = Math.hypot(toX - cX, toY - cY);
              const radius = (r1 + r2) / 2 || r1;
              if (radius > 0.001) {
                const a1 = Math.atan2(fromY - cY, fromX - cX);
                const a2 = Math.atan2(toY - cY, toX - cX);
                const isCW = (seg as any).clockwise ?? false;
                let sweep = a2 - a1;
                if (isCW) {
                  if (sweep > 0) sweep -= 2 * Math.PI;
                } else {
                  if (sweep < 0) sweep += 2 * Math.PI;
                }
                const steps = Math.max(10, Math.ceil(Math.abs(sweep) * 18 / Math.PI));
                ctx.moveTo(toScreenX(fromX), toScreenY(fromY));
                for (let s = 1; s <= steps; s++) {
                  const t = s / steps;
                  const angle = a1 + sweep * t;
                  const px = cX + radius * Math.cos(angle);
                  const py = cY + radius * Math.sin(angle);
                  ctx.lineTo(toScreenX(px), toScreenY(py));
                }
              } else {
                ctx.moveTo(toScreenX(seg.from.x), toScreenY(seg.from.y));
                ctx.lineTo(toScreenX(seg.to.x), toScreenY(seg.to.y));
              }
            } else {
              ctx.moveTo(toScreenX(seg.from.x), toScreenY(seg.from.y));
              ctx.lineTo(toScreenX(seg.to.x), toScreenY(seg.to.y));
            }
            ctx.stroke();

            // Swivel Pivot Node
            ctx.fillStyle = theme.accentColor || '#fbbf24';
            ctx.beginPath();
            ctx.arc(toScreenX(seg.to.x), toScreenY(seg.to.y), 2.5, 0, Math.PI * 2);
            ctx.fill();
          } else if ((seg.type === 'G1' || (seg as any).type === 'cut') && showCutPaths) {
            ctx.strokeStyle = theme.cutLineColor || '#10b981';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(toScreenX(seg.from.x), toScreenY(seg.from.y));
            ctx.lineTo(toScreenX(seg.to.x), toScreenY(seg.to.y));
            ctx.stroke();
          }
        });
      } else if (showCutPaths) {
        // Cut / Tool Paths (G1) (Unified Bearbeitung / Schnitt: Solid Emerald Green)
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = theme.cutLineColor || '#10b981';

        activeOptimizedPolylines.forEach((poly) => {
          if (poly.points.length < 2) return;
          ctx.beginPath();
          ctx.moveTo(toScreenX(poly.points[0].x), toScreenY(poly.points[0].y));
          for (let i = 1; i < poly.points.length; i++) {
            ctx.lineTo(toScreenX(poly.points[i].x), toScreenY(poly.points[i].y));
          }
          if (poly.closed) ctx.closePath();
          ctx.stroke();

          // Green Plunge Dot at Start Point
          ctx.fillStyle = theme.cutLineColor || '#22c55e';
          ctx.beginPath();
          ctx.arc(toScreenX(poly.points[0].x), toScreenY(poly.points[0].y), 2.5, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Render Rapid / Travel Moves (G0 Leerfahrten / Eilgang) in 2D
      if (showRapid) {
        ctx.save();
        ctx.strokeStyle = theme.rapidLineColor || '#f43f5e';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);

        if (targetMode === 'dragknife' && dragKnifeResult && dragKnifeResult.compensatedSegments.length > 0) {
          dragKnifeResult.compensatedSegments.forEach(seg => {
            if (seg.type === 'G0' || (seg as any).type === 'rapid') {
              ctx.beginPath();
              ctx.moveTo(toScreenX(seg.from.x), toScreenY(seg.from.y));
              ctx.lineTo(toScreenX(seg.to.x), toScreenY(seg.to.y));
              ctx.stroke();
            }
          });
        } else if (activeOptimizedPolylines.length > 0) {
          // 1. Rapid from Bed Origin (0,0) to first path start
          const firstPt = activeOptimizedPolylines[0].points[0];
          if (firstPt) {
            ctx.beginPath();
            ctx.moveTo(toScreenX(0), toScreenY(0));
            ctx.lineTo(toScreenX(firstPt.x), toScreenY(firstPt.y));
            ctx.stroke();
          }

          // 2. Rapid between consecutive polylines
          for (let i = 0; i < activeOptimizedPolylines.length - 1; i++) {
            const currentPoly = activeOptimizedPolylines[i];
            const nextPoly = activeOptimizedPolylines[i + 1];
            if (currentPoly.points.length === 0 || nextPoly.points.length === 0) continue;

            const endPt = currentPoly.closed
              ? currentPoly.points[0]
              : currentPoly.points[currentPoly.points.length - 1];
            const nextStartPt = nextPoly.points[0];

            ctx.beginPath();
            ctx.moveTo(toScreenX(endPt.x), toScreenY(endPt.y));
            ctx.lineTo(toScreenX(nextStartPt.x), toScreenY(nextStartPt.y));
            ctx.stroke();
          }

          // 3. Rapid from last path back to origin (0,0)
          const lastPoly = activeOptimizedPolylines[activeOptimizedPolylines.length - 1];
          if (lastPoly && lastPoly.points.length > 0) {
            const lastEndPt = lastPoly.closed
              ? lastPoly.points[0]
              : lastPoly.points[lastPoly.points.length - 1];
            ctx.beginPath();
            ctx.moveTo(toScreenX(lastEndPt.x), toScreenY(lastEndPt.y));
            ctx.lineTo(toScreenX(0), toScreenY(0));
            ctx.stroke();
          }
        }

        ctx.setLineDash([]);
        ctx.restore();
      }
      ctx.restore(); // Restore globalAlpha

      // 2D LIVE DRAFT OVERLAY (Render draft live on canvas without cluttering rapid lines or badges)
      if (compositionElements.length > 0 && showLiveDraftPreview && draftPolylines.length > 0) {
        if (targetMode === 'dragknife' && draftDragKnifeResult && draftDragKnifeResult.compensatedSegments.length > 0) {
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([3, 3]);
          draftPolylines.forEach((poly) => {
            if (poly.points.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(toScreenX(poly.points[0].x), toScreenY(poly.points[0].y));
            for (let i = 1; i < poly.points.length; i++) {
              ctx.lineTo(toScreenX(poly.points[i].x), toScreenY(poly.points[i].y));
            }
            if (poly.closed) ctx.closePath();
            ctx.stroke();
          });
          ctx.setLineDash([]);

          draftDragKnifeResult.compensatedSegments.forEach(seg => {
            if (seg.type === 'SWIVEL_ARC' || (seg as any).type === 'swivel') {
              ctx.strokeStyle = '#f59e0b';
              ctx.lineWidth = 2.8;
              ctx.beginPath();
              ctx.moveTo(toScreenX(seg.from.x), toScreenY(seg.from.y));
              ctx.lineTo(toScreenX(seg.to.x), toScreenY(seg.to.y));
              ctx.stroke();

              ctx.fillStyle = '#fbbf24';
              ctx.beginPath();
              ctx.arc(toScreenX(seg.to.x), toScreenY(seg.to.y), 2.5, 0, Math.PI * 2);
              ctx.fill();
            } else if (seg.type === 'G1' || (seg as any).type === 'cut') {
              ctx.strokeStyle = theme.accentColor || '#06b6d4';
              ctx.lineWidth = 2.2;
              ctx.beginPath();
              ctx.moveTo(toScreenX(seg.from.x), toScreenY(seg.from.y));
              ctx.lineTo(toScreenX(seg.to.x), toScreenY(seg.to.y));
              ctx.stroke();
            }
          });
        } else {
          // Draft Cut Paths in Glowing Cyan
          ctx.lineWidth = 2.2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = theme.accentColor || '#06b6d4';

          draftPolylines.forEach((poly) => {
            if (poly.points.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(toScreenX(poly.points[0].x), toScreenY(poly.points[0].y));
            for (let i = 1; i < poly.points.length; i++) {
              ctx.lineTo(toScreenX(poly.points[i].x), toScreenY(poly.points[i].y));
            }
            if (poly.closed) ctx.closePath();
            ctx.stroke();

            // Plunge node dot
            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            ctx.arc(toScreenX(poly.points[0].x), toScreenY(poly.points[0].y), 2.5, 0, Math.PI * 2);
            ctx.fill();
          });
        }

        // Live Draft Bounding Box without text badge
        if (draftStats && draftStats.width > 0) {
          const dbx = toScreenX(draftStats.minX);
          const dby = toScreenY(draftStats.maxY);
          const dbw = draftStats.width * zoom;
          const dbh = draftStats.height * zoom;

          ctx.strokeStyle = theme.accentColor || '#06b6d4';
          ctx.lineWidth = 1.4;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(dbx, dby, dbw, dbh);
          ctx.setLineDash([]);

          // Draft Center Crosshair
          const dcx = toScreenX(draftStats.centerX);
          const dcy = toScreenY(draftStats.centerY);
          ctx.strokeStyle = '#38bdf8';
          ctx.beginPath();
          ctx.moveTo(dcx - 5, dcy);
          ctx.lineTo(dcx + 5, dcy);
          ctx.moveTo(dcx, dcy - 5);
          ctx.lineTo(dcx, dcy + 5);
          ctx.stroke();
        }
      }

      // Hover Outline for unselected element or active draft
      if (hoveredElementId && !selectedElementIds.includes(hoveredElementId)) {
        if (hoveredElementId === 'active_draft' && draftStats && draftStats.width > 0) {
          const hbx = toScreenX(draftStats.minX) - 3;
          const hby = toScreenY(draftStats.maxY) - 3;
          const hbw = draftStats.width * zoom + 6;
          const hbh = draftStats.height * zoom + 6;

          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(hbx, hby, hbw, hbh);
          ctx.fillStyle = 'rgba(56, 189, 248, 0.05)';
          ctx.fillRect(hbx, hby, hbw, hbh);
        } else if (hoveredElementId === 'active_single' && stats.width > 0) {
          const hbx = toScreenX(stats.minX) - 3;
          const hby = toScreenY(stats.maxY) - 3;
          const hbw = stats.width * zoom + 6;
          const hbh = stats.height * zoom + 6;

          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(hbx, hby, hbw, hbh);
          ctx.fillStyle = 'rgba(56, 189, 248, 0.05)';
          ctx.fillRect(hbx, hby, hbw, hbh);
        } else {
          const hoveredEl = compositionElements.find(e => e.id === hoveredElementId);
          if (hoveredEl && hoveredEl.polylines.length > 0) {
            let hMinX = Infinity, hMaxX = -Infinity, hMinY = Infinity, hMaxY = -Infinity;
            hoveredEl.polylines.forEach(p => {
              p.points.forEach(pt => {
                const x = pt.x + hoveredEl.offsetX;
                const y = pt.y + hoveredEl.offsetY;
                if (x < hMinX) hMinX = x;
                if (x > hMaxX) hMaxX = x;
                if (y < hMinY) hMinY = y;
                if (y > hMaxY) hMaxY = y;
              });
            });
            if (hMinX !== Infinity) {
              const hbx = toScreenX(hMinX) - 3;
              const hby = toScreenY(hMaxY) - 3;
              const hbw = (hMaxX - hMinX) * zoom + 6;
              const hbh = (hMaxY - hMinY) * zoom + 6;

              ctx.strokeStyle = '#38bdf8';
              ctx.lineWidth = 1.5;
              ctx.strokeRect(hbx, hby, hbw, hbh);
              ctx.fillStyle = 'rgba(56, 189, 248, 0.05)';
              ctx.fillRect(hbx, hby, hbw, hbh);
            }
          }
        }
      }

      // Multi-Selected Composition Elements Highlight Box & Master Boundary
      if (selectedElementIds.length > 0) {
        let masterMinX = Infinity, masterMaxX = -Infinity, masterMinY = Infinity, masterMaxY = -Infinity;

        selectedElementIds.forEach(id => {
          const el = compositionElements.find(e => e.id === id);
          if (el && el.polylines.length > 0) {
            let sMinX = Infinity, sMaxX = -Infinity, sMinY = Infinity, sMaxY = -Infinity;
            el.polylines.forEach(p => {
              p.points.forEach(pt => {
                const x = pt.x + el.offsetX;
                const y = pt.y + el.offsetY;
                if (x < sMinX) sMinX = x;
                if (x > sMaxX) sMaxX = x;
                if (y < sMinY) sMinY = y;
                if (y > sMaxY) sMaxY = y;
              });
            });

            if (sMinX !== Infinity) {
              if (sMinX < masterMinX) masterMinX = sMinX;
              if (sMaxX > masterMaxX) masterMaxX = sMaxX;
              if (sMinY < masterMinY) masterMinY = sMinY;
              if (sMaxY > masterMaxY) masterMaxY = sMaxY;

              const sbx = toScreenX(sMinX) - 3;
              const sby = toScreenY(sMaxY) - 3;
              const sbw = (sMaxX - sMinX) * zoom + 6;
              const sbh = (sMaxY - sMinY) * zoom + 6;

              ctx.strokeStyle = '#a855f7';
              ctx.lineWidth = 1.2;
              ctx.setLineDash([4, 3]);
              ctx.strokeRect(sbx, sby, sbw, sbh);
              ctx.setLineDash([]);

              ctx.fillStyle = '#c084fc';
              ctx.font = `${Math.round(10 * (uiScale || 100) / 100)}px sans-serif`;
              ctx.fillText(el.name, sbx, sby - 4);
            }
          }
        });

        // If multiple items selected, draw composite master bounding box with glow
        if (selectedElementIds.length > 1 && masterMinX !== Infinity) {
          const mbx = toScreenX(masterMinX) - 6;
          const mby = toScreenY(masterMaxY) - 6;
          const mbw = (masterMaxX - masterMinX) * zoom + 12;
          const mbh = (masterMaxY - masterMinY) * zoom + 12;

          ctx.strokeStyle = '#6366f1';
          ctx.lineWidth = 1.8;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(mbx, mby, mbw, mbh);
          ctx.setLineDash([]);

          ctx.fillStyle = 'rgba(99, 102, 241, 0.06)';
          ctx.fillRect(mbx, mby, mbw, mbh);

          ctx.fillStyle = '#818cf8';
          ctx.font = `bold ${Math.round(10 * (uiScale || 100) / 100)}px monospace`;
          ctx.fillText(`Gruppe (${selectedElementIds.length} Objekte)`, mbx, mby - 6);
        }
      }

      // Live Marquee Selection Rectangle Overlay
      if (selectionRect) {
        const sx = toScreenX(Math.min(selectionRect.startX, selectionRect.currentX));
        const sy = toScreenY(Math.max(selectionRect.startY, selectionRect.currentY));
        const sw = Math.abs(selectionRect.currentX - selectionRect.startX) * zoom;
        const sh = Math.abs(selectionRect.currentY - selectionRect.startY) * zoom;

        ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.fillRect(sx, sy, sw, sh);

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(sx, sy, sw, sh);
        ctx.setLineDash([]);
      }

      // Total Object Bounding Box Indicator & Anchor Box (when no composition elements, or overall)
      if (stats.width > 0 && stats.height > 0) {
        const boxX = toScreenX(stats.minX);
        const boxY = toScreenY(stats.maxY);
        const boxW = stats.width * zoom;
        const boxH = stats.height * zoom;

        ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(boxX, boxY, boxW, boxH);
        ctx.setLineDash([]);

        // Center Crosshair
        const centerScX = toScreenX(stats.centerX);
        const centerScY = toScreenY(stats.centerY);
        ctx.strokeStyle = '#a5b4fc';
        ctx.beginPath();
        ctx.moveTo(centerScX - 6, centerScY);
        ctx.lineTo(centerScX + 6, centerScY);
        ctx.moveTo(centerScX, centerScY - 6);
        ctx.lineTo(centerScX, centerScY + 6);
        ctx.stroke();

        if (compositionElements.length === 0) {
          const singleLabel = `⚡ Live-Vorschau: ${draftTitle} (${stats.width} × ${stats.height} mm)`;
          ctx.font = `bold ${Math.round(11 * (uiScale || 100) / 100)}px monospace`;
          const bTextW = ctx.measureText(singleLabel).width;
          const bW = bTextW + 16;
          const bH = 22;
          const bX = boxX + (boxW - bW) / 2;
          const bY = boxY - bH - 6;

          ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
          ctx.fillRect(bX, bY, bW, bH);
          ctx.strokeStyle = '#6366f1';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(bX, bY, bW, bH);

          ctx.fillStyle = '#818cf8';
          ctx.textAlign = 'center';
          ctx.fillText(singleLabel, bX + bW / 2, bY + 15);
          ctx.textAlign = 'start';
        }
      }

      // Measurement line when active (Unified Precision Measurement Tool)
      if (genMeasureStart && genMeasureEnd) {
        const sx1 = toScreenX(genMeasureStart.x);
        const sy1 = toScreenY(genMeasureStart.y);
        const sx2 = toScreenX(genMeasureEnd.x);
        const sy2 = toScreenY(genMeasureEnd.y);

        const dxMm = genMeasureEnd.x - genMeasureStart.x;
        const dyMm = genMeasureEnd.y - genMeasureStart.y;
        const distMm = Math.hypot(dxMm, dyMm);
        const angleDeg = (Math.atan2(dyMm, dxMm) * 180) / Math.PI;

        ctx.strokeStyle = theme.accentColor || '#06b6d4';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Crosshair end caps
        [{ sx: sx1, sy: sy1 }, { sx: sx2, sy: sy2 }].forEach((p, idx) => {
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

        const midX = (sx1 + sx2) / 2;
        const midY = (sy1 + sy2) / 2;
        const label1 = `Länge: ${distMm.toFixed(2)} mm`;
        const label2 = `ΔX: ${dxMm.toFixed(2)} mm | ΔY: ${dyMm.toFixed(2)} mm (${angleDeg.toFixed(1)}°)`;

        ctx.font = `bold ${Math.round(12 * (uiScale || 100) / 100)}px monospace`;
        const w1 = ctx.measureText(label1).width;
        ctx.font = `${Math.round(10 * (uiScale || 100) / 100)}px monospace`;
        const w2 = ctx.measureText(label2).width;
        const badgeW = Math.max(w1, w2) + 20;
        const badgeH = 34;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.fillRect(midX - badgeW / 2, midY - badgeH / 2, badgeW, badgeH);
        ctx.strokeStyle = theme.accentColor || '#06b6d4';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(midX - badgeW / 2, midY - badgeH / 2, badgeW, badgeH);

        ctx.fillStyle = '#38bdf8';
        ctx.font = `bold ${Math.round(12 * (uiScale || 100) / 100)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(label1, midX, midY - 3);

        ctx.fillStyle = '#94a3b8';
        ctx.font = `${Math.round(10 * (uiScale || 100) / 100)}px monospace`;
        ctx.fillText(label2, midX, midY + 11);
        ctx.textAlign = 'start';
      }

      // Coordinate Origin Indicator (0,0)
      if (showOriginMarker) {
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(toScreenX(0), toScreenY(0), 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Simulation Path 2D (G-Code Preview up to simIndex)
      if (localSimSegments.length > 0 && isSimulationActive) {
        ctx.save();
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        let simToolX = 0, simToolY = 0;
        let drawnPath = false;

        for (let i = 0; i < localSimSegments.length; i++) {
          const seg = localSimSegments[i];
          const type = (seg as any).type || seg.type;
          
          let targetX = seg.to.x;
          let targetY = seg.to.y;
          if (isJobStreaming && i === effectiveSimIndex) {
            targetX = liveState.wpos.x;
            targetY = liveState.wpos.y;
          }

          if (i <= effectiveSimIndex) {
            simToolX = targetX; simToolY = targetY;
            ctx.globalAlpha = 1.0;
            drawnPath = true;
          } else {
            ctx.globalAlpha = 0.15;
          }
          
          ctx.beginPath();
          ctx.moveTo(toScreenX(seg.from.x), toScreenY(seg.from.y));
          if (type === 'G0' || type === 'rapid') {
            ctx.strokeStyle = theme.rapidLineColor || '#f43f5e';
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1.5;
            ctx.lineTo(toScreenX(targetX), toScreenY(targetY));
          } else if (type === 'G1' || type === 'cut') {
            ctx.strokeStyle = theme.cutLineColor || '#10b981';
            ctx.setLineDash([]);
            ctx.lineWidth = 2.5;
            ctx.lineTo(toScreenX(targetX), toScreenY(targetY));
          } else if (type === 'G2' || type === 'G3' || type === 'SWIVEL_ARC' || type === 'swivel') {
             ctx.strokeStyle = '#f59e0b';
             ctx.setLineDash([]);
             ctx.lineWidth = 2.5;
             if (seg.center) {
               const cX = seg.center.x, cY = seg.center.y;
               const r1 = Math.hypot(seg.from.x - cX, seg.from.y - cY);
               const r2 = Math.hypot(targetX - cX, targetY - cY);
               const radius = (r1 + r2) / 2 || r1;
               if (radius > 0.001) {
                 const a1 = Math.atan2(seg.from.y - cY, seg.from.x - cX);
                 const a2 = Math.atan2(targetY - cY, targetX - cX);
                 const isCW = seg.clockwise ?? (type === 'G2');
                 let sweep = a2 - a1;
                 if (isCW && sweep > 0) sweep -= 2 * Math.PI;
                 if (!isCW && sweep < 0) sweep += 2 * Math.PI;
                 const steps = Math.max(5, Math.ceil(Math.abs(sweep) * 12 / Math.PI));
                 for (let s = 1; s <= steps; s++) {
                   const t = s / steps;
                   const angle = a1 + sweep * t;
                   const px = cX + radius * Math.cos(angle);
                   const py = cY + radius * Math.sin(angle);
                   ctx.lineTo(toScreenX(px), toScreenY(py));
                 }
               } else {
                 ctx.lineTo(toScreenX(targetX), toScreenY(targetY));
               }
             } else {
               ctx.lineTo(toScreenX(targetX), toScreenY(targetY));
             }
          } else {
             ctx.lineTo(toScreenX(targetX), toScreenY(targetY));
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1.0;

        if (drawnPath) {
          ctx.fillStyle = '#eab308';
          ctx.beginPath();
          ctx.arc(toScreenX(simToolX), toScreenY(simToolY), 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.restore();
      }

      // Live Machine Position Crosshair
      if (liveState && (liveState.status === 'Run' || liveState.status === 'Hold' || liveState.status === 'Idle')) {
        const mx = liveState.wpos.x;
        const my = liveState.wpos.y;
        
        ctx.strokeStyle = '#ef4444'; // Red crosshair
        ctx.lineWidth = 1.5;
        
        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(toScreenX(mx) - 10, toScreenY(my));
        ctx.lineTo(toScreenX(mx) + 10, toScreenY(my));
        ctx.stroke();
        
        // Vertical line
        ctx.beginPath();
        ctx.moveTo(toScreenX(mx), toScreenY(my) - 10);
        ctx.lineTo(toScreenX(mx), toScreenY(my) + 10);
        ctx.stroke();

        if (liveState.spindleSpeed > 0) {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(toScreenX(mx), toScreenY(my), 4, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Center circle
        ctx.beginPath();
        ctx.arc(toScreenX(mx), toScreenY(my), 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.fill();
        ctx.stroke();
      }

      // Double Click Jog Target Animation
      if (doubleClickTarget) {
        const timeSince = Date.now() - doubleClickTarget.time;
        if (timeSince < 600) {
          const progress = timeSince / 600;
          const radius = 15 - progress * 10;
          const alpha = 1 - progress;
          
          ctx.beginPath();
          ctx.arc(toScreenX(doubleClickTarget.x), toScreenY(doubleClickTarget.y), radius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
          ctx.lineWidth = 2;
          ctx.stroke();
          
          ctx.beginPath();
          ctx.arc(toScreenX(doubleClickTarget.x), toScreenY(doubleClickTarget.y), 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
          ctx.fill();

          // Request animation frame to keep drawing this
          requestAnimationFrame(renderPreview);
        }
      }

      ctx.restore();
    }
  }, [
    activePolylines,
    activeOptimizedPolylines,
    activeOptimizedGroups,
    simIndex,
    showSimSlider,
    isSimPlaying,
    streamProgress,
    liveState,
    localSimSegments,
    theme,
    draftPolylines,
    draftStats,
    draftTitle,
    draftDragKnifeResult,
    showLiveDraftPreview,
    currentProfile,
    viewMode,
    orbitYaw,
    orbitPitch,
    zoom,
    pan,
    targetMode,
    stats,
    dragKnifeResult,
    selectedElementId,
    selectedElementIds,
    hoveredElementId,
    selectionRect,
    compositionElements,
    genMeasureStart,
    genMeasureEnd,
    showCutPaths,
    showRapid,
    showSwivelArcs,
    showOriginMarker,
    optimizeOrder,
    objectOrderMode,
    pathOrderStrategy,
    liveState,
    doubleClickTarget
  ]);

  useEffect(() => {
    if (!isSimPlaying || localSimSegments.length === 0) return;
    
    let animationFrameId: number;
    
    // If we start playing and we are already at the very end, reset to 0 automatically.
    if (simIndex >= localSimSegments.length - 1) {
      setSimIndex(0);
      // We don't return here so the loop can start from 0
    }

    let currentFraction = simIndex >= localSimSegments.length - 1 ? 0 : simIndex;
    let lastTime = performance.now();
    
    const loop = (time: number) => {
      const dt = time - lastTime;
      lastTime = time;
      
      // Base speed: 20 segments per second. simSpeed scales this.
      const segmentsPerSec = 20 * simSpeed;
      currentFraction += (segmentsPerSec * dt) / 1000;
      
      if (currentFraction >= localSimSegments.length - 1) {
        setSimIndex(0); // "sobald der slider am ende angekommen ist er wieder in den Startzusatnd zurückfallen"
        setIsSimPlaying(false);
        return;
      }
      
      setSimIndex(Math.floor(currentFraction));
      animationFrameId = requestAnimationFrame(loop);
    };
    
    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isSimPlaying, simSpeed, localSimSegments]);

  useEffect(() => {
    setSimIndex(0);
    setIsSimPlaying(false);
  }, [localSimSegments]);

  // Keep preview rendered on state changes and resize
  useEffect(() => {
    renderPreview();
  }, [renderPreview]);

  // Handle Resize of Canvas
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      renderPreview();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [renderPreview]);

  // --- Handlers for File Input ---
  const handleVectorFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    setSourceType('file');
    setObjRotation(0);
    setObjFlipX(false);
    setObjFlipY(false);
    setObjOffsetX(0);
    setObjOffsetY(0);

    const isDxf = file.name.toLowerCase().endsWith('.dxf');
    setFileFileType(isDxf ? 'dxf' : 'svg');

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      if (isDxf) {
        const { polylines, bounds } = parseDxf(text);
        setRawFilePolylines(polylines);
        
        const dxfWidth = bounds.maxX - bounds.minX;
        const dxfHeight = bounds.maxY - bounds.minY;
        const bedW = currentProfile.bedWidth || 200;
        const bedH = currentProfile.bedHeight || 200;

        if (dxfWidth > bedW || dxfHeight > bedH) {
          const autoScale = Math.min((bedW * 0.75) / dxfWidth, (bedH * 0.75) / dxfHeight) * 100;
          setObjScale(Math.max(10, Math.round(autoScale)));
        }

        const bedCenterX = bedW / 2;
        const bedCenterY = bedH / 2;
        const dxfCenterX = (bounds.minX + bounds.maxX) / 2;
        const dxfCenterY = (bounds.minY + bounds.maxY) / 2;
        setObjOffsetX(Number((bedCenterX - dxfCenterX).toFixed(1)));
        setObjOffsetY(Number((bedCenterY - dxfCenterY).toFixed(1)));
      } else {
        const polylines = parseSvgToPolylines(
          text,
          currentProfile.bedWidth || 200,
          currentProfile.bedHeight || 200
        );
        setRawFilePolylines(polylines);
      }
    };
    reader.readAsText(file);
  };

  const handleCenterObjectOnBed = () => {
    const bedW = currentProfile.bedWidth || 200;
    const bedH = currentProfile.bedHeight || 200;
    
    if (selectedElementIds.length > 0) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      compositionElements.forEach(el => {
        if (!selectedElementIds.includes(el.id)) return;
        const rad = ((el.rotation || 0) * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const sX = ((el.scaleX ?? 100) / 100) * (el.flipX ? -1 : 1);
        const sY = ((el.scaleY ?? 100) / 100) * (el.flipY ? -1 : 1);

        el.polylines.forEach(p => {
          p.points.forEach(pt => {
            const scaledX = pt.x * sX;
            const scaledY = pt.y * sY;
            const rx = scaledX * cos - scaledY * sin;
            const ry = scaledX * sin + scaledY * cos;
            const x = rx + el.offsetX;
            const y = ry + el.offsetY;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          });
        });
      });
      if (minX !== Infinity && maxX !== -Infinity) {
        const curCenterX = (minX + maxX) / 2;
        const curCenterY = (minY + maxY) / 2;
        const shiftX = (bedW / 2) - curCenterX;
        const shiftY = (bedH / 2) - curCenterY;
        setCompositionElements(prev => prev.map(el => {
          if (selectedElementIds.includes(el.id)) {
            return {
              ...el,
              offsetX: Number((el.offsetX + shiftX).toFixed(2)),
              offsetY: Number((el.offsetY + shiftY).toFixed(2)),
            };
          }
          return el;
        }));
      }
    } else {
      const shiftX = (bedW / 2) - stats.centerX;
      const shiftY = (bedH / 2) - stats.centerY;
      setObjOffsetX(prev => Number((prev + shiftX).toFixed(2)));
      setObjOffsetY(prev => Number((prev + shiftY).toFixed(2)));
    }
  };

  const handleMoveObjectToOrigin = () => {
    pushUndoSnapshot();
    if (selectedElementIds.length > 0) {
      let minX = Infinity, minY = Infinity;
      compositionElements.forEach(el => {
        if (!selectedElementIds.includes(el.id)) return;
        const rad = ((el.rotation || 0) * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const sX = ((el.scaleX ?? 100) / 100) * (el.flipX ? -1 : 1);
        const sY = ((el.scaleY ?? 100) / 100) * (el.flipY ? -1 : 1);

        el.polylines.forEach(p => {
          p.points.forEach(pt => {
            const scaledX = pt.x * sX;
            const scaledY = pt.y * sY;
            const rx = scaledX * cos - scaledY * sin;
            const ry = scaledX * sin + scaledY * cos;
            const x = rx + el.offsetX;
            const y = ry + el.offsetY;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
          });
        });
      });
      if (minX !== Infinity && minY !== Infinity) {
        setCompositionElements(prev => prev.map(el => {
          if (selectedElementIds.includes(el.id)) {
            return {
              ...el,
              offsetX: Number((el.offsetX - minX).toFixed(2)),
              offsetY: Number((el.offsetY - minY).toFixed(2)),
            };
          }
          return el;
        }));
      }
    } else {
      if (stats.minX !== Infinity && stats.minY !== Infinity) {
        setObjOffsetX(prev => Number((prev - stats.minX).toFixed(2)));
        setObjOffsetY(prev => Number((prev - stats.minY).toFixed(2)));
      } else {
        setObjOffsetX(0);
        setObjOffsetY(0);
      }
    }
  };

  const handleSollXChange = (val: number) => {
    setSollWidth(val);
    if (rawBounds.width > 0 && val > 0) {
      const factor = (val / rawBounds.width) * 100;
      setScaleX(Number(factor.toFixed(2)));
      setObjScale(Number(factor.toFixed(1)));
      if (lockAspectDimensions) {
        setScaleY(Number(factor.toFixed(2)));
        setSollHeight(Number((rawBounds.height * (factor / 100)).toFixed(1)));
      }
      if (selectedElementId) {
        setCompositionElements(prev => prev.map(el => el.id === selectedElementId ? {
          ...el,
          scaleX: Number(factor.toFixed(2)),
          scaleY: lockAspectDimensions ? Number(factor.toFixed(2)) : el.scaleY
        } : el));
      }
    }
  };

  const handleSollYChange = (val: number) => {
    setSollHeight(val);
    if (rawBounds.height > 0 && val > 0) {
      const factor = (val / rawBounds.height) * 100;
      setScaleY(Number(factor.toFixed(2)));
      setObjScale(Number(factor.toFixed(1)));
      if (lockAspectDimensions) {
        setScaleX(Number(factor.toFixed(2)));
        setSollWidth(Number((rawBounds.width * (factor / 100)).toFixed(1)));
      }
      if (selectedElementId) {
        setCompositionElements(prev => prev.map(el => el.id === selectedElementId ? {
          ...el,
          scaleY: Number(factor.toFixed(2)),
          scaleX: lockAspectDimensions ? Number(factor.toFixed(2)) : el.scaleX
        } : el));
      }
    }
  };

  const handleScaleUniformChange = (scalePct: number) => {
    setObjScale(scalePct);
    setScaleX(scalePct);
    setScaleY(scalePct);
    if (rawBounds.width > 0 && rawBounds.height > 0) {
      setSollWidth(Number((rawBounds.width * (scalePct / 100)).toFixed(1)));
      setSollHeight(Number((rawBounds.height * (scalePct / 100)).toFixed(1)));
    }
    if (selectedElementId) {
      setCompositionElements(prev => prev.map(el => el.id === selectedElementId ? {
        ...el,
        scaleX: scalePct,
        scaleY: scalePct
      } : el));
    }
  };

  const handleFitGeneratorToBed = () => {
    const bedW = currentProfile.bedWidth || 200;
    const bedH = currentProfile.bedHeight || 200;

    if (selectedElementIds.length > 0) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      compositionElements.forEach(el => {
        if (!selectedElementIds.includes(el.id)) return;
        const rad = ((el.rotation || 0) * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const sX = ((el.scaleX ?? 100) / 100) * (el.flipX ? -1 : 1);
        const sY = ((el.scaleY ?? 100) / 100) * (el.flipY ? -1 : 1);

        el.polylines.forEach(p => {
          p.points.forEach(pt => {
            const scaledX = pt.x * sX;
            const scaledY = pt.y * sY;
            const rx = scaledX * cos - scaledY * sin;
            const ry = scaledX * sin + scaledY * cos;
            const x = rx + el.offsetX;
            const y = ry + el.offsetY;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          });
        });
      });
      const curW = maxX - minX;
      const curH = maxY - minY;
      if (curW > 0 && curH > 0) {
        const scaleFactor = Math.min(bedW / curW, bedH / curH);
        setCompositionElements(prev => prev.map(el => {
          if (selectedElementIds.includes(el.id)) {
            return {
              ...el,
              scaleX: Number(((el.scaleX ?? 100) * scaleFactor).toFixed(2)),
              scaleY: Number(((el.scaleY ?? 100) * scaleFactor).toFixed(2)),
            };
          }
          return el;
        }));
        setTimeout(() => handleCenterObjectOnBed(), 10);
      }
    } else {
      if (rawBounds.width <= 0 || rawBounds.height <= 0) return;
      const scale = Math.min(bedW / rawBounds.width, bedH / rawBounds.height) * 100;
      handleScaleUniformChange(Number(scale.toFixed(2)));
      setTimeout(() => handleCenterObjectOnBed(), 10);
    }
  };

  const handleResetObjectTransform = () => {
    if (selectedElementId) {
      setCompositionElements(prev => prev.map(el => el.id === selectedElementId ? {
        ...el,
        offsetX: 0,
        offsetY: 0,
        rotation: 0,
        scaleX: 100,
        scaleY: 100,
        flipX: false,
        flipY: false,
      } : el));
    } else {
      setObjOffsetX(0);
      setObjOffsetY(0);
      setObjRotation(0);
      setObjScale(100);
      setScaleX(100);
      setScaleY(100);
      setObjFlipX(false);
      setObjFlipY(false);
      if (rawBounds.width > 0 && rawBounds.height > 0) {
        setSollWidth(rawBounds.width);
        setSollHeight(rawBounds.height);
      }
    }
  };

  // --- Point-in-Polygon & Bounding Box Overlap Helper for Selection Tools ---
  const isPointInPolygon = (pt: { x: number; y: number }, poly: { x: number; y: number }[]) => {
    if (poly.length < 3) return false;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      const intersect = ((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // Helper to convert screen coordinates to bed mm in 2D and 3D
  const screenToBedMm = (clientX: number, clientY: number) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const bedW = currentProfile.bedWidth || 200;
    const bedH = currentProfile.bedHeight || 200;

    const sx = clientX - rect.left;
    const sy = clientY - rect.top;

    if (viewMode === '2d') {
      const mmX = (sx - pan.x) / zoom;
      const mmY = (pan.y - sy) / zoom;
      return { x: mmX, y: mmY };
    } else {
      const cosYaw = Math.cos((orbitYaw * Math.PI) / 180);
      const sinYaw = Math.sin((orbitYaw * Math.PI) / 180);
      const sinPitch = Math.sin((orbitPitch * Math.PI) / 180);

      const cx = bedW / 2;
      const cy = bedH / 2;

      const screenDx = (sx - pan.x) / zoom;
      const screenDy = -(sy - pan.y) / (zoom * Math.max(0.15, sinPitch));

      const rx = screenDx * cosYaw + screenDy * sinYaw;
      const ry = -screenDx * sinYaw + screenDy * cosYaw;

      return { x: cx + rx, y: cy + ry };
    }
  };

  // --- Double Click to Jog ---
  const handleDoubleClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Only travel if we are in CNC Steuerung, or maybe always if connected? 
    // Wait, let's just make it always work if they want.
    const mm = screenToBedMm(e.clientX, e.clientY);
    const targetX = Math.max(0, Math.min(currentProfile.bedWidth, Number(mm.x.toFixed(2))));
    const targetY = Math.max(0, Math.min(currentProfile.bedHeight, Number(mm.y.toFixed(2))));

    setDoubleClickTarget({ x: targetX, y: targetY, time: Date.now() });
    setJogToast({ x: targetX, y: targetY });
    setTimeout(() => setJogToast(null), 3000);

    const feed = currentProfile.travelFeedrate || 2000;
    const cmd = `G0 X${targetX.toFixed(2)} Y${targetY.toFixed(2)} F${feed}`;
    try {
      if (liveState?.status === 'Run' || liveState?.status === 'Hold') {
        // Can't jog while running
      } else {
        await grbl.send(cmd);
      }
    } catch (error) {
      console.error('Jog error:', error);
    }
  };

  // --- Mouse Orbit, Pan, Zoom, Multi-Object Dragging & Box Marquee Handlers ---
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // 1. Right Click (button === 2)
    if (e.button === 2) {
      if (viewMode === '3d') {
        if (e.shiftKey) {
          // Pan in 3D: Shift + Right Click
          setDragMode('pan');
          setDragStart({ x: e.clientX, y: e.clientY });
          setDragOriginPan({ ...pan });
        } else {
          // Orbit in 3D: Right Click
          setDragMode('orbit');
          setDragStart({ x: e.clientX, y: e.clientY });
          setDragOriginOrbit({ yaw: orbitYaw, pitch: orbitPitch });
        }
      } else {
        // Pan in 2D: Right Click
        setDragMode('pan');
        setDragStart({ x: e.clientX, y: e.clientY });
        setDragOriginPan({ ...pan });
      }
      return;
    }

    // 2. Middle Click (button === 1) -> Always Pan in both 2D and 3D
    if (e.button === 1) {
      setDragMode('pan');
      setDragStart({ x: e.clientX, y: e.clientY });
      setDragOriginPan({ ...pan });
      return;
    }

    // 3. Left Click (button === 0)
    if (e.button === 0) {
      // Measurement Mode
      if (isMeasureActive) {
        const mm = screenToBedMm(e.clientX, e.clientY);
        setGenMeasureStart(mm);
        setGenMeasureEnd(mm);
        setDragMode('measure');
        setDragStart({ x: e.clientX, y: e.clientY });
        return;
      }

      const mm = screenToBedMm(e.clientX, e.clientY);
      const isModifier = e.shiftKey || e.ctrlKey || e.metaKey;

      // Check hit-detection on composition elements or active draft generator object
      let clickedElId: string | null = null;
      if (compositionElements.length > 0) {
        for (let i = compositionElements.length - 1; i >= 0; i--) {
          const el = compositionElements[i];
          if (!el.visible || el.locked) continue;
          const rad = ((el.rotation || 0) * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const sX = (el.scaleX ?? 100) / 100 * (el.flipX ? -1 : 1);
          const sY = (el.scaleY ?? 100) / 100 * (el.flipY ? -1 : 1);

          for (const poly of el.polylines) {
            for (const pt of poly.points) {
              const scaledX = pt.x * sX;
              const scaledY = pt.y * sY;
              const rx = scaledX * cos - scaledY * sin;
              const ry = scaledX * sin + scaledY * cos;
              const elX = rx + el.offsetX;
              const elY = ry + el.offsetY;
              if (Math.hypot(elX - mm.x, elY - mm.y) < 12) {
                clickedElId = el.id;
                break;
              }
            }
            if (clickedElId) break;
          }
          if (clickedElId) break;
        }

        // If no composition element was hit, check if live draft preview is active and was clicked
        if (!clickedElId && showLiveDraftPreview && draftStats && draftStats.width > 0) {
          if (
            mm.x >= draftStats.minX - 6 &&
            mm.x <= draftStats.maxX + 6 &&
            mm.y >= draftStats.minY - 6 &&
            mm.y <= draftStats.maxY + 6
          ) {
            clickedElId = 'active_draft';
          }
        }
      } else if (rawPolylines.length > 0 && stats.width > 0) {
        if (
          mm.x >= stats.minX - 6 &&
          mm.x <= stats.maxX + 6 &&
          mm.y >= stats.minY - 6 &&
          mm.y <= stats.maxY + 6
        ) {
          clickedElId = 'active_single';
        }
      }

      if (clickedElId) {
        pushUndoSnapshot();
        if (clickedElId === 'active_draft' || clickedElId === 'active_single') {
          // Preview-only object selected
          setSelectedElementIds([]);
          setSelectedElementId(null);
        } else if (isModifier) {
          // Toggle selection
          setSelectedElementIds(prev => 
            prev.includes(clickedElId!) ? prev.filter(id => id !== clickedElId) : [...prev, clickedElId!]
          );
        } else {
          // Single select if not already part of selected group
          if (!selectedElementIds.includes(clickedElId)) {
            setSelectedElementIds([clickedElId]);
          }
        }

        const activeIds = isModifier
          ? (selectedElementIds.includes(clickedElId) ? selectedElementIds : [...selectedElementIds, clickedElId])
          : (selectedElementIds.includes(clickedElId) ? selectedElementIds : [clickedElId]);

        const offsets: { [id: string]: { x: number; y: number } } = {};
        if (clickedElId === 'active_draft' || clickedElId === 'active_single') {
          offsets['active_draft'] = { x: objOffsetX, y: objOffsetY };
          offsets['active_single'] = { x: objOffsetX, y: objOffsetY };
        } else if (compositionElements.length > 0) {
          compositionElements.forEach(el => {
            if (activeIds.includes(el.id)) {
              offsets[el.id] = { x: el.offsetX, y: el.offsetY };
            }
          });
        } else {
          offsets['active_single'] = { x: objOffsetX, y: objOffsetY };
        }
        setLiveDragOffsets(offsets);
        setDragMode('transform_drag');
        setDragStart({ x: e.clientX, y: e.clientY });
      } else {
        // Clicked empty space
        if (!isModifier) {
          setSelectedElementIds([]);
        }
        // Start marquee selection rectangle
        setSelectionRect({ startX: mm.x, startY: mm.y, currentX: mm.x, currentY: mm.y });
        setDragMode('select_rect');
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const mm = screenToBedMm(e.clientX, e.clientY);
    setMousePos({ x: mm.x, y: mm.y });

    if (dragMode === 'orbit') {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setOrbitYaw(dragOriginOrbit.yaw + dx * 0.5);
      setOrbitPitch(Math.max(10, Math.min(85, dragOriginOrbit.pitch + dy * 0.5)));
    } else if (dragMode === 'pan') {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setPan({
        x: dragOriginPan.x + dx,
        y: dragOriginPan.y + dy,
      });
    } else if (dragMode === 'measure' && genMeasureStart) {
      const mm = screenToBedMm(e.clientX, e.clientY);
      setGenMeasureEnd(mm);
    } else if (dragMode === 'select_rect') {
      const mm = screenToBedMm(e.clientX, e.clientY);
      setSelectionRect(prev => prev ? { ...prev, currentX: mm.x, currentY: mm.y } : null);

      if (selectionRect) {
        const minX = Math.min(selectionRect.startX, mm.x);
        const maxX = Math.max(selectionRect.startX, mm.x);
        const minY = Math.min(selectionRect.startY, mm.y);
        const maxY = Math.max(selectionRect.startY, mm.y);

        // Find all composition elements (whole objects) whose bounding boxes intersect the selection rectangle
        const selectedIds: string[] = [];
        if (compositionElements.length > 0) {
          compositionElements.forEach(el => {
            if (!el.visible) return;
            const rad = ((el.rotation || 0) * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const sX = (el.scaleX ?? 100) / 100 * (el.flipX ? -1 : 1);
            const sY = (el.scaleY ?? 100) / 100 * (el.flipY ? -1 : 1);

            let elMinX = Infinity, elMaxX = -Infinity, elMinY = Infinity, elMaxY = -Infinity;
            el.polylines.forEach(p => {
              p.points.forEach(pt => {
                const scaledX = pt.x * sX;
                const scaledY = pt.y * sY;
                const rx = scaledX * cos - scaledY * sin;
                const ry = scaledX * sin + scaledY * cos;
                const x = rx + el.offsetX;
                const y = ry + el.offsetY;
                if (x < elMinX) elMinX = x;
                if (x > elMaxX) elMaxX = x;
                if (y < elMinY) elMinY = y;
                if (y > elMaxY) elMaxY = y;
              });
            });

            // Check overlap
            if (elMinX <= maxX && elMaxX >= minX && elMinY <= maxY && elMaxY >= minY) {
              selectedIds.push(el.id);
            }
          });
        } else if (rawPolylines.length > 0 && stats.width > 0) {
          if (stats.minX <= maxX && stats.maxX >= minX && stats.minY <= maxY && stats.maxY >= minY) {
            selectedIds.push('active_single');
          }
        }
        setSelectedElementIds(selectedIds);
      }
    } else if (dragMode === 'transform_drag') {
      const canvas = previewCanvasRef.current;
      if (!canvas) return;
      
      const dxScreen = e.clientX - dragStart.x;
      const dyScreen = e.clientY - dragStart.y;
      
      let dxMm = 0;
      let dyMm = 0;

      if (viewMode === '2d') {
        dxMm = dxScreen / zoom;
        dyMm = -dyScreen / zoom;
      } else {
        const cosYaw = Math.cos((orbitYaw * Math.PI) / 180);
        const sinYaw = Math.sin((orbitYaw * Math.PI) / 180);
        const sinPitch = Math.sin((orbitPitch * Math.PI) / 180);

        const sx = dxScreen / zoom;
        const sy = -dyScreen / (zoom * Math.max(0.15, sinPitch));
        dxMm = sx * cosYaw + sy * sinYaw;
        dyMm = -sx * sinYaw + sy * cosYaw;
      }

      if (liveDragOffsets['active_draft'] || liveDragOffsets['active_single']) {
        const startOff = liveDragOffsets['active_draft'] || liveDragOffsets['active_single'];
        setObjOffsetX(Number((startOff.x + dxMm).toFixed(1)));
        setObjOffsetY(Number((startOff.y + dyMm).toFixed(1)));
      } else if (compositionElements.length > 0 && Object.keys(liveDragOffsets).length > 0) {
        // Multi-Element Live Dragging
        setCompositionElements(prev => prev.map(el => {
          const startOff = liveDragOffsets[el.id];
          if (startOff && !el.locked) {
            return {
              ...el,
              offsetX: Number((startOff.x + dxMm).toFixed(1)),
              offsetY: Number((startOff.y + dyMm).toFixed(1)),
            };
          }
          return el;
        }));
      }
    } else if (dragMode === 'none') {
      // Hover detection on elements (works in both 2D and 3D)
      const mm = screenToBedMm(e.clientX, e.clientY);
      let foundHover: string | null = null;
      if (compositionElements.length > 0) {
        for (let i = compositionElements.length - 1; i >= 0; i--) {
          const el = compositionElements[i];
          if (!el.visible || el.locked) continue;
          const rad = ((el.rotation || 0) * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const sX = (el.scaleX ?? 100) / 100 * (el.flipX ? -1 : 1);
          const sY = (el.scaleY ?? 100) / 100 * (el.flipY ? -1 : 1);

          for (const poly of el.polylines) {
            for (const pt of poly.points) {
              const scaledX = pt.x * sX;
              const scaledY = pt.y * sY;
              const rx = scaledX * cos - scaledY * sin;
              const ry = scaledX * sin + scaledY * cos;
              const elX = rx + el.offsetX;
              const elY = ry + el.offsetY;
              if (Math.hypot(elX - mm.x, elY - mm.y) < 12) {
                foundHover = el.id;
                break;
              }
            }
            if (foundHover) break;
          }
          if (foundHover) break;
        }

        if (!foundHover && showLiveDraftPreview && draftStats && draftStats.width > 0) {
          if (
            mm.x >= draftStats.minX - 6 &&
            mm.x <= draftStats.maxX + 6 &&
            mm.y >= draftStats.minY - 6 &&
            mm.y <= draftStats.maxY + 6
          ) {
            foundHover = 'active_draft';
          }
        }
      } else if (rawPolylines.length > 0 && stats.width > 0) {
        if (
          mm.x >= stats.minX - 6 &&
          mm.x <= stats.maxX + 6 &&
          mm.y >= stats.minY - 6 &&
          mm.y <= stats.maxY + 6
        ) {
          foundHover = 'active_single';
        }
      }
      setHoveredElementId(foundHover);
    }
  };

  const handleMouseUp = () => {
    if (dragMode === 'select_rect') {
      setSelectionRect(null);
    } else if (dragMode === 'transform_drag') {
      setLiveDragOffsets({});
    }
    setDragMode('none');
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.14 : 0.88;
    const newZoom = Math.min(25.0, Math.max(0.12, zoom * zoomFactor));

    // Focal point zoom: keep point under cursor invariant
    const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const handleRasterImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRasterImageName(file.name);
    setCropMargins({ top: 0, bottom: 0, left: 0, right: 0 });
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        originalRasterImageRef.current = img;
        setRasterImage(img);
        setSourceType('raster');
        // Automatically set proportional target dimensions fitting comfortably in bed
        if (img.width > 0 && img.height > 0) {
          const maxBedW = currentProfile.bedWidth * 0.75;
          const maxBedH = currentProfile.bedHeight * 0.75;
          const imgAspect = img.width / img.height;
          let targetW = Math.min(120, maxBedW);
          let targetH = targetW / imgAspect;
          if (targetH > maxBedH) {
            targetH = maxBedH;
            targetW = targetH * imgAspect;
          }
          setRasterSettings(s => ({
            ...s,
            targetWidth: Number(targetW.toFixed(1)),
            targetHeight: Number(targetH.toFixed(1)),
          }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleApplyImageCrop = () => {
    const baseImg = originalRasterImageRef.current || rasterImage;
    if (!baseImg || baseImg.width <= 0 || baseImg.height <= 0) return;

    const leftPx = Math.round(baseImg.width * (cropMargins.left / 100));
    const rightPx = Math.round(baseImg.width * (cropMargins.right / 100));
    const topPx = Math.round(baseImg.height * (cropMargins.top / 100));
    const bottomPx = Math.round(baseImg.height * (cropMargins.bottom / 100));

    const cropW = Math.max(1, baseImg.width - leftPx - rightPx);
    const cropH = Math.max(1, baseImg.height - topPx - bottomPx);

    const canvas = document.createElement('canvas');
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(baseImg, leftPx, topPx, cropW, cropH, 0, 0, cropW, cropH);

    const croppedImg = new Image();
    croppedImg.onload = () => {
      setRasterImage(croppedImg);
      if (rasterLockAspect) {
        const aspect = cropH / cropW;
        setRasterSettings(s => ({
          ...s,
          targetHeight: Number((s.targetWidth * aspect).toFixed(1)),
        }));
      }
      setShowImageCropModal(false);
    };
    croppedImg.src = canvas.toDataURL('image/png');
  };

  const handleResetImageCrop = () => {
    if (originalRasterImageRef.current) {
      setRasterImage(originalRasterImageRef.current);
      setCropMargins({ top: 0, bottom: 0, left: 0, right: 0 });
      if (rasterLockAspect) {
        const aspect = originalRasterImageRef.current.height / originalRasterImageRef.current.width;
        setRasterSettings(s => ({
          ...s,
          targetHeight: Number((s.targetWidth * aspect).toFixed(1)),
        }));
      }
    }
  };

  const handleDownloadGcode = (ext: string = 'gcode') => {
    const blob = new Blob([generatedGcode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plotter_${targetMode}_${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyGcode = () => {
    navigator.clipboard.writeText(generatedGcode);
  };

  // Auto-sync generated G-code to main visualizer
  useEffect(() => {
    const timer = setTimeout(() => {
      const parsed = parseGcode(generatedGcode, currentProfile.penUpZ || 2);
      onGcodeGenerated(parsed);
    }, 500); // 500ms debounce
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedGcode, currentProfile.penUpZ]);

  const handleApplyMaterialPreset = (preset: any) => {
    if (preset.feedrate) {
      if (targetMode === 'dragknife') {
        setDragKnifeOptions(prev => ({ ...prev, cuttingFeedrate: preset.feedrate }));
      } else if (targetMode === 'laser') {
        setLaserOptions(prev => ({ ...prev, feedrate: preset.feedrate }));
      } else {
        setPenOptions(prev => ({ ...prev, drawingFeedrate: preset.feedrate }));
      }
    }
    if (preset.power && targetMode === 'laser') {
      setLaserOptions(prev => ({ ...prev, powerPercent: preset.power }));
    }
    if (preset.passes && targetMode === 'laser') {
      setLaserOptions(prev => ({ ...prev, passes: preset.passes }));
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row-reverse h-full overflow-hidden gap-3 text-slate-200 select-none">
      {/* Hidden off-screen canvas for raster image processing */}
      <canvas ref={rasterCanvasRef} className="hidden" />

      {/* ========================================================================= */}
      {/* LEFT COLUMN: 3-Step Wizard & Configuration Panel (Live-Reacting)           */}
      {/* ========================================================================= */}
      <div 
        className={`flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex-shrink-0 transition-all duration-300 ${isSidebarCollapsed ? 'w-0 opacity-0 border-none ml-0 hidden' : 'w-full lg:w-auto'}`}
        style={{ width: isSidebarCollapsed ? 0 : (window.innerWidth >= 1024 ? leftPanelWidth : '100%') }}
      >
        {/* Panel Header & Tabs */}
        <div className="flex flex-col border-b border-slate-800 bg-slate-950/80">
          <div className="p-2 flex items-center justify-between">
            <div className="flex bg-slate-900 border border-slate-700 rounded-lg p-0.5 shadow-inner">
              <button
                onClick={() => setActiveSidebarTab('design')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
                  activeSidebarTab === 'design'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Design & Generator</span>
              </button>
              {cncControls && (
                <button
                  onClick={() => setActiveSidebarTab('steuerung')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
                    activeSidebarTab === 'steuerung'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>CNC Steuerung</span>
                </button>
              )}
            </div>
            {activeSidebarTab === 'design' && (
              <button
                onClick={resetView}
                className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-md text-[0.6875rem] flex items-center gap-1 transition-colors"
                title="Ansicht zurücksetzen"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* CNC Controls Container */}
        <div className={`flex-1 h-full overflow-y-auto ${activeSidebarTab === 'steuerung' ? 'block' : 'hidden'}`}>
          {cncControls}
        </div>

        {/* Scrollable Wizard Steps */}
        <div className={`flex-1 overflow-y-auto p-3.5 space-y-4 text-xs ${activeSidebarTab === 'design' ? 'block' : 'hidden'}`}>
          {/* ------------------------------------------------------------- */}
          {/* SCHRITT 1: QUELLE / MOTIV WÄHLEN                              */}
          {/* ------------------------------------------------------------- */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[0.6875rem] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[0.625rem]">1</span>
                Motiv & Eingabequelle
              </span>
            </div>

            {/* Source Type Selector Grid */}
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800">
              <button
                onClick={() => setSourceType('text')}
                className={`py-1.5 rounded-md font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  sourceType === 'text'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                <span>Text</span>
              </button>

              <button
                onClick={() => setSourceType('file')}
                className={`py-1.5 rounded-md font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  sourceType === 'file'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>DXF / SVG</span>
              </button>

              <button
                onClick={() => setSourceType('shapes')}
                className={`py-1.5 rounded-md font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  sourceType === 'shapes'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Square className="w-3.5 h-3.5" />
                <span>Formen</span>
              </button>

              <button
                onClick={() => setSourceType('raster')}
                className={`py-1.5 rounded-md font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  sourceType === 'raster'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Bild Trace</span>
              </button>
            </div>

            {/* 1A: Comprehensive Text Generator Options (Single-Line, Outlines, Fonts, Styles & Infill) */}
            {sourceType === 'text' && (
              <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800/80 space-y-3">
                {/* Mode Selector: Single-Line vs Outline Contour */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-400 text-[0.625rem] font-semibold">Linienführung / Modus:</label>
                    <span className="text-[0.625rem] text-indigo-400 font-mono">
                      {textMode === 'single_line' ? 'Echte 1-Linien Plotter-Schrift' : 'Vektorisierte Außenkontur'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-900 rounded border border-slate-800">
                    <button
                      onClick={() => {
                        setTextMode('single_line');
                        if (!textFontFamily.startsWith('Hershey')) {
                          setTextFontFamily('Hershey Simplex');
                        }
                      }}
                      className={`py-1.5 px-2 rounded text-[0.6875rem] font-semibold flex items-center justify-center gap-1.5 transition-all ${
                        textMode === 'single_line'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      <span>Einzellinie (Single-Line)</span>
                    </button>
                    <button
                      onClick={() => {
                        setTextMode('outline');
                        if (textFontFamily.startsWith('Hershey')) {
                          setTextFontFamily('Arial');
                        }
                      }}
                      className={`py-1.5 px-2 rounded text-[0.6875rem] font-semibold flex items-center justify-center gap-1.5 transition-all ${
                        textMode === 'outline'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Type className="w-3.5 h-3.5" />
                      <span>Außenkontur (Outline)</span>
                    </button>
                  </div>
                </div>

                {/* Text Content Input (Multi-line supported) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-400 text-[0.625rem] font-semibold">Textinhalt (auch mehrzeilig):</label>
                    <span className="text-[0.625rem] text-slate-500">{textValue.length} Zeichen</span>
                  </div>
                  <textarea
                    rows={2}
                    value={textValue}
                    onChange={(e) => setTextValue(e.target.value)}
                    className="w-full bg-slate-900 px-3 py-1.5 rounded border border-slate-700 text-slate-100 font-mono text-xs focus:outline-none focus:border-indigo-500 resize-y"
                    placeholder="Text hier eingeben (Enter für neue Zeile)..."
                  />
                </div>

                {/* Font Family Selection */}
                <div className="space-y-1">
                  <label className="text-slate-400 text-[0.625rem] font-semibold">Schriftart (Font Family):</label>
                  <select
                    value={textFontFamily}
                    onChange={(e) => setTextFontFamily(e.target.value)}
                    className="w-full bg-slate-900 px-2.5 py-1.5 rounded border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    {textMode === 'single_line' ? (
                      <>
                        <optgroup label="Single-Line Plotterschriften">
                          <option value="Hershey Simplex">Hershey Simplex (Standard 1-Linie)</option>
                          <option value="Hershey Sans">Hershey Sans-Serif (Modern Schlicht)</option>
                          <option value="Hershey Serif">Hershey Serif (Römisch / Elegant)</option>
                          <option value="Hershey Script">Hershey Script (Handschrift / Kursiv)</option>
                        </optgroup>
                      </>
                    ) : (
                      <>
                        <optgroup label="Sans-Serif (Moderne Schriften)">
                          <option value="Arial">Arial (Standard)</option>
                          <option value="Inter">Inter (Präzise)</option>
                          <option value="Roboto">Roboto (Klar)</option>
                          <option value="Helvetica">Helvetica</option>
                          <option value="Segoe UI">Segoe UI</option>
                          <option value="Trebuchet MS">Trebuchet MS</option>
                          <option value="Verdana">Verdana</option>
                          <option value="Montserrat">Montserrat</option>
                          <option value="Impact">Impact (Kräftig / Bold)</option>
                        </optgroup>
                        <optgroup label="Serif (Klassische Schriften)">
                          <option value="Times New Roman">Times New Roman</option>
                          <option value="Georgia">Georgia</option>
                          <option value="Garamond">Garamond</option>
                          <option value="Playfair Display">Playfair Display</option>
                          <option value="Palatino Linotype">Palatino Linotype</option>
                        </optgroup>
                        <optgroup label="Monospace (Festbreite)">
                          <option value="Courier New">Courier New (Schreibmaschine)</option>
                          <option value="Consolas">Consolas (Code)</option>
                          <option value="Fira Code">Fira Code</option>
                          <option value="Monaco">Monaco</option>
                        </optgroup>
                        <optgroup label="Handschrift & Display">
                          <option value="Pacifico">Pacifico (Kalligraphie)</option>
                          <option value="Dancing Script">Dancing Script (Schwungvoll)</option>
                          <option value="Brush Script MT">Brush Script MT (Pinsel)</option>
                          <option value="Comic Sans MS">Comic Sans MS</option>
                          <option value="Oswald">Oswald (Kompakt)</option>
                          <option value="Anton">Anton (Plakat)</option>
                        </optgroup>
                        <optgroup label="Benutzerdefiniert">
                          <option value="custom">Eigene Systemschriftart eingeben...</option>
                        </optgroup>
                      </>
                    )}
                  </select>
                </div>

                {/* Custom Font Name Input (if selected) */}
                {textFontFamily === 'custom' && textMode === 'outline' && (
                  <div className="space-y-1 bg-slate-900/80 p-2 rounded border border-indigo-500/40">
                    <label className="text-indigo-300 text-[0.625rem] font-semibold">Installierter Schriftart-Name (z.B. "Bahnschrift", "Futura", "Caveat"):</label>
                    <input
                      type="text"
                      value={customFontFamily}
                      onChange={(e) => setCustomFontFamily(e.target.value)}
                      placeholder="z.B. Bahnschrift, Century Gothic..."
                      className="w-full bg-slate-950 px-2.5 py-1 rounded border border-slate-700 text-slate-100 text-xs font-mono"
                    />
                  </div>
                )}

                {/* Style Bar: Bold, Italic, Alignment & Weight */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800">
                  {/* Style Toggles: Bold & Italic */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        if (textMode === 'single_line') {
                          setTextSingleLineBold(!textSingleLineBold);
                        } else {
                          setTextFontWeight(textFontWeight === 'bold' || textFontWeight === '900' ? 'normal' : 'bold');
                        }
                      }}
                      className={`w-7 h-7 rounded flex items-center justify-center font-bold text-xs transition-colors ${
                        (textMode === 'single_line' ? textSingleLineBold : (textFontWeight === 'bold' || textFontWeight === '900'))
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                      title={textMode === 'single_line' ? 'Fett simulieren (Doppelstrich)' : 'Fett (Bold)'}
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        const nextStyle = textFontStyle === 'italic' ? 'normal' : 'italic';
                        setTextFontStyle(nextStyle);
                        if (textMode === 'single_line') {
                          setTextItalicSlantDeg(nextStyle === 'italic' ? 14 : 0);
                        }
                      }}
                      className={`w-7 h-7 rounded flex items-center justify-center italic text-xs transition-colors ${
                        textFontStyle === 'italic' || textItalicSlantDeg !== 0
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                      title="Kursiv (Italic / Neigung)"
                    >
                      <Italic className="w-3.5 h-3.5" />
                    </button>

                    {/* Outline Weight Selector */}
                    {textMode === 'outline' && (
                      <select
                        value={textFontWeight}
                        onChange={(e) => setTextFontWeight(e.target.value as any)}
                        className="bg-slate-900 px-2 py-1 rounded border border-slate-700 text-slate-200 text-[0.6875rem] focus:outline-none"
                        title="Schriftstärke (Font Weight)"
                      >
                        <option value="normal">Normal (400)</option>
                        <option value="medium">Mittel (500)</option>
                        <option value="600">Halbfett (600)</option>
                        <option value="bold">Fett (700)</option>
                        <option value="900">Extrafett (900)</option>
                      </select>
                    )}
                  </div>

                  {/* Alignment Buttons */}
                  <div className="flex items-center gap-0.5 bg-slate-900 p-0.5 rounded border border-slate-700">
                    <button
                      onClick={() => setTextAlign('left')}
                      className={`p-1 rounded ${textAlign === 'left' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                      title="Linksbündig"
                    >
                      <AlignLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setTextAlign('center')}
                      className={`p-1 rounded ${textAlign === 'center' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                      title="Zentriert"
                    >
                      <AlignCenter className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setTextAlign('right')}
                      className={`p-1 rounded ${textAlign === 'right' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                      title="Rechtsbündig"
                    >
                      <AlignRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Geometry & Spacing Grid */}
                <div className="grid grid-cols-3 gap-2 font-mono text-[0.6875rem]">
                  <div className="space-y-1">
                    <span className="text-slate-400 text-[0.625rem]">Größe (mm):</span>
                    <input
                      type="number"
                      min="3"
                      max="300"
                      value={textFontSize}
                      onChange={(e) => setTextFontSize(Math.max(3, Number(e.target.value)))}
                      className="w-full bg-slate-900 px-2 py-1 rounded border border-slate-700 text-slate-100 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 text-[0.625rem]">Zeichenabst. (mm):</span>
                    <input
                      type="number"
                      step="0.5"
                      min="-2"
                      max="15"
                      value={textLetterSpacing}
                      onChange={(e) => setTextLetterSpacing(Number(e.target.value))}
                      className="w-full bg-slate-900 px-2 py-1 rounded border border-slate-700 text-slate-100 text-xs"
                      title="Buchstabenabstand / Tracking"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 text-[0.625rem]">Zeilenabst. (x):</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0.8"
                      max="3.0"
                      value={textLineSpacing}
                      onChange={(e) => setTextLineSpacing(Number(e.target.value))}
                      className="w-full bg-slate-900 px-2 py-1 rounded border border-slate-700 text-slate-100 text-xs"
                      title="Zeilenabstand für Mehrzeiler"
                    />
                  </div>
                </div>

                {/* Slant / Oblique Degrees Slider */}
                <div className="space-y-1 bg-slate-900/50 p-2 rounded border border-slate-800/80">
                  <div className="flex items-center justify-between text-[0.625rem]">
                    <span className="text-slate-400">Kursiv-Neigung (Slant):</span>
                    <span className="text-indigo-300 font-mono">{textItalicSlantDeg}°</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="-30"
                      max="30"
                      step="1"
                      value={textItalicSlantDeg}
                      onChange={(e) => setTextItalicSlantDeg(Number(e.target.value))}
                      className="flex-1 accent-indigo-500 h-1.5 bg-slate-800 rounded"
                    />
                    <button
                      onClick={() => setTextItalicSlantDeg(0)}
                      className="text-[0.625rem] px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded"
                      title="Neigung auf 0° zurücksetzen"
                    >
                      0°
                    </button>
                  </div>
                </div>

                {/* Position X / Y */}
                <div className="grid grid-cols-2 gap-2 font-mono text-[0.6875rem]">
                  <div className="space-y-1">
                    <span className="text-slate-400 text-[0.625rem]">Position X (mm):</span>
                    <input
                      type="number"
                      value={textPosX}
                      onChange={(e) => setTextPosX(Number(e.target.value))}
                      className="w-full bg-slate-900 px-2 py-1 rounded border border-slate-700 text-slate-100 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 text-[0.625rem]">Position Y (mm):</span>
                    <input
                      type="number"
                      value={textPosY}
                      onChange={(e) => setTextPosY(Number(e.target.value))}
                      className="w-full bg-slate-900 px-2 py-1 rounded border border-slate-700 text-slate-100 text-xs"
                    />
                  </div>
                </div>

                {/* ============================================================== */}
                {/* 3. MUSTERFÜLLUNG / INFILL (Bei Außenkontur-Modus)              */}
                {/* ============================================================== */}
                {textMode === 'outline' && (
                  <div className="p-2.5 bg-slate-900/90 rounded-lg border border-indigo-500/30 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[0.6875rem] font-bold text-indigo-300 flex items-center gap-1.5">
                        <PaintBucket className="w-3.5 h-3.5 text-indigo-400" />
                        Buchstaben-Musterfüllung (Infill)
                      </span>
                      <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 font-mono">
                        {textInfillPattern === 'none' ? 'Keine Füllung' : textInfillPattern.toUpperCase()}
                      </span>
                    </div>

                    {/* Pattern Type Buttons */}
                    <div className="grid grid-cols-3 gap-1 text-[0.625rem]">
                      {[
                        { id: 'none', label: 'Nur Kontur', icon: Type },
                        { id: 'hatch_linear', label: 'Schraffur', icon: Sliders },
                        { id: 'cross_hatch', label: 'Kreuzgitter', icon: Hash },
                        { id: 'zigzag', label: 'Zick-Zack', icon: SlidersHorizontal },
                        { id: 'concentric', label: 'Konzentrisch', icon: Circle },
                        { id: 'dots', label: 'Punktraster', icon: GridIcon },
                      ].map((p) => {
                        const Icon = p.icon;
                        const isSel = textInfillPattern === p.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => setTextInfillPattern(p.id as TextInfillPattern)}
                            className={`p-1.5 rounded border flex flex-col items-center justify-center gap-1 transition-all ${
                              isSel
                                ? 'bg-indigo-600 border-indigo-400 text-white shadow-sm font-semibold'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{p.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Pattern Parameters (if pattern selected) */}
                    {textInfillPattern !== 'none' && (
                      <div className="space-y-2 pt-2 border-t border-slate-800 font-mono text-[0.6875rem]">
                        {/* Infill Line Spacing */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[0.625rem]">
                            <span className="text-slate-400">Linienabstand / Dichte:</span>
                            <span className="text-indigo-300 font-bold">{textInfillSpacing} mm</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.2"
                              max="4.0"
                              step="0.1"
                              value={textInfillSpacing}
                              onChange={(e) => setTextInfillSpacing(Number(e.target.value))}
                              className="flex-1 accent-indigo-500 h-1.5 bg-slate-800 rounded"
                            />
                            <input
                              type="number"
                              min="0.2"
                              max="10.0"
                              step="0.1"
                              value={textInfillSpacing}
                              onChange={(e) => setTextInfillSpacing(Math.max(0.2, Number(e.target.value)))}
                              className="w-14 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-700 text-slate-100 text-[0.625rem]"
                            />
                          </div>
                        </div>

                        {/* Infill Angle (for linear, cross-hatch, zigzag) */}
                        {(textInfillPattern === 'hatch_linear' || textInfillPattern === 'cross_hatch' || textInfillPattern === 'zigzag') && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[0.625rem]">
                              <span className="text-slate-400">Schraffur-Winkel:</span>
                              <span className="text-indigo-300 font-bold">{textInfillAngle}°</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min="0"
                                max="180"
                                step="5"
                                value={textInfillAngle}
                                onChange={(e) => setTextInfillAngle(Number(e.target.value))}
                                className="flex-1 accent-indigo-500 h-1.5 bg-slate-800 rounded"
                              />
                              <div className="flex gap-1">
                                {[0, 45, 90, 135].map((deg) => (
                                  <button
                                    key={deg}
                                    onClick={() => setTextInfillAngle(deg)}
                                    className={`px-1.5 py-0.5 rounded text-[0.5625rem] ${
                                      textInfillAngle === deg
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                                    }`}
                                  >
                                    {deg}°
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Include Outline Checkbox */}
                        <label className="flex items-center gap-2 cursor-pointer pt-1 text-slate-300 text-[0.6875rem]">
                          <input
                            type="checkbox"
                            checked={textIncludeOutline}
                            onChange={(e) => setTextIncludeOutline(e.target.checked)}
                            className="rounded border-slate-700 text-indigo-600 focus:ring-0 w-3.5 h-3.5 bg-slate-900"
                          />
                          <span>Außenkontur zusätzlich zum Muster abfahren</span>
                        </label>
                      </div>
                    )}
                  </div>
                )}

                {/* Add to Canvas Button */}
                <button
                  onClick={handleAddCurrentToComposition}
                  className="w-full py-2 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white rounded-lg border border-indigo-500/50 text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Text zur Arbeitsfläche hinzufügen</span>
                </button>
              </div>
            )}

            {/* 1B: Vector File Import (DXF / SVG) */}
            {sourceType === 'file' && (
              <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800/80 space-y-3">
                <label className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer transition-colors text-center bg-slate-900/40">
                  <FileCode className="w-5 h-5 text-indigo-400 mb-1" />
                  <span className="font-semibold text-slate-200 text-xs">DXF oder SVG Datei wählen</span>
                  <span className="text-[0.625rem] text-slate-500 mt-0.5">Unterstützt CAD-DXF (R12-2018) & Standard-SVG</span>
                  <input
                    type="file"
                    accept=".dxf,.svg"
                    onChange={handleVectorFileUpload}
                    className="hidden"
                  />
                </label>

                {uploadedFileName && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800 text-[0.6875rem]">
                      <span className="text-indigo-300 font-mono truncate max-w-[240px]">{uploadedFileName}</span>
                      <span className="text-[0.625rem] uppercase font-bold px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300">
                        {fileFileType}
                      </span>
                    </div>
                    <button
                      onClick={handleAddCurrentToComposition}
                      className="w-full py-2 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white rounded-lg border border-indigo-500/50 text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Vektordatei zur Arbeitsfläche hinzufügen</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 1C: Geometric Shapes */}
            {sourceType === 'shapes' && (
              <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800/80 space-y-3">
                <div className="grid grid-cols-3 gap-1 text-[0.6875rem]">
                  {(['star', 'circle', 'rect', 'polygon', 'grid', 'spiral'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setShapeType(st)}
                      className={`p-1.5 rounded border capitalize transition-all ${
                        shapeType === st
                          ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200 font-semibold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {st === 'rect' ? 'Rechteck' : st === 'circle' ? 'Kreis' : st === 'star' ? 'Stern' : st === 'polygon' ? 'Polygon' : st === 'grid' ? 'Gitter' : 'Spirale'}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono">
                  <div className="space-y-1">
                    <span className="text-slate-400 text-[0.625rem]">Position X / Y:</span>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        value={shapeX}
                        onChange={(e) => setShapeX(Number(e.target.value))}
                        className="w-1/2 bg-slate-900 px-2 py-1 rounded border border-slate-700 text-slate-100 text-xs"
                      />
                      <input
                        type="number"
                        value={shapeY}
                        onChange={(e) => setShapeY(Number(e.target.value))}
                        className="w-1/2 bg-slate-900 px-2 py-1 rounded border border-slate-700 text-slate-100 text-xs"
                      />
                    </div>
                  </div>

                  {(shapeType === 'rect' || shapeType === 'grid') ? (
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[0.625rem]">Breite / Höhe (mm):</span>
                      <div className="flex gap-1">
                        <input
                          type="number"
                          value={shapeWidth}
                          onChange={(e) => setShapeWidth(Number(e.target.value))}
                          className="w-1/2 bg-slate-900 px-2 py-1 rounded border border-slate-700 text-slate-100 text-xs"
                        />
                        <input
                          type="number"
                          value={shapeHeight}
                          onChange={(e) => setShapeHeight(Number(e.target.value))}
                          className="w-1/2 bg-slate-900 px-2 py-1 rounded border border-slate-700 text-slate-100 text-xs"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[0.625rem]">Radius (mm):</span>
                      <input
                        type="number"
                        value={shapeRadius}
                        onChange={(e) => setShapeRadius(Number(e.target.value))}
                        className="w-full bg-slate-900 px-2 py-1 rounded border border-slate-700 text-slate-100 text-xs"
                      />
                    </div>
                  )}
                </div>

                <button
                  onClick={handleAddCurrentToComposition}
                  className="w-full py-2 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white rounded-lg border border-indigo-500/50 text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Form zur Arbeitsfläche hinzufügen</span>
                </button>
              </div>
            )}

            {/* ========================================================================= */}
            {/* 1D: OVERHAULED RASTER / VEKTORISIEREN MENU (OUTLINE & CENTERLINE TRACING)  */}
            {/* ========================================================================= */}
            {sourceType === 'raster' && (
              <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800/80 space-y-3.5">
                {/* Upload Button */}
                <label className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-lg p-2.5 flex flex-col items-center justify-center cursor-pointer transition-colors text-center bg-slate-900/40">
                  <ImageIcon className="w-5 h-5 text-indigo-400 mb-1" />
                  <span className="font-semibold text-slate-200 text-xs">Bitmap-Grafik hochladen (PNG, JPG, WebP, BMP)</span>
                  <span className="text-[0.625rem] text-slate-500 mt-0.5">Vektorisiert Grafiken, Logos, Skizzen &amp; Handschriften</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleRasterImageUpload}
                    className="hidden"
                  />
                </label>

                {/* LIVE INTERACTIVE IMAGE & VECTOR PREVIEW PANEL */}
                {rasterImage && (
                  <div className="space-y-2 bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between text-[0.6875rem]">
                      <span className="font-bold text-slate-200 flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-cyan-400" />
                        Live Vektor- &amp; Filter-Vorschau
                      </span>
                      <button
                        onClick={() => setShowImageLightbox(true)}
                        className="px-2 py-0.5 bg-indigo-600/30 hover:bg-indigo-600 border border-indigo-500/50 text-indigo-200 rounded text-[0.625rem] font-medium flex items-center gap-1 transition-colors"
                        title="Echtbildvorschau vergrößern & im Detail ansehen"
                      >
                        <Expand className="w-3 h-3 text-indigo-300" />
                        <span>Großansicht / Lupe</span>
                      </button>
                    </div>

                    {/* Preview Mode Tabs */}
                    <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[0.625rem]">
                      <button
                        onClick={() => setTracingPreviewTab('vectors')}
                        className={`flex-1 py-1 rounded font-medium transition-colors ${
                          tracingPreviewTab === 'vectors' ? 'bg-cyan-600 text-white font-bold shadow' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        ✨ Vektor-Overlay
                      </button>
                      <button
                        onClick={() => setTracingPreviewTab('threshold')}
                        className={`flex-1 py-1 rounded font-medium transition-colors ${
                          tracingPreviewTab === 'threshold' ? 'bg-indigo-600 text-white font-bold shadow' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        ⬛ SW-Schwelle
                      </button>
                      <button
                        onClick={() => setTracingPreviewTab('original')}
                        className={`flex-1 py-1 rounded font-medium transition-colors ${
                          tracingPreviewTab === 'original' ? 'bg-slate-700 text-white font-bold shadow' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        🖼️ Original
                      </button>
                    </div>

                    {/* Canvas / Image Display Area */}
                    <div 
                      className="h-32 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center relative cursor-pointer group hover:border-cyan-500/60 transition-colors"
                      onClick={() => setShowImageLightbox(true)}
                      title="Klicken für interaktive Vollbild-Vorschau mit Split-Slider"
                    >
                      {tracingPreviewTab === 'vectors' && (
                        <canvas
                          ref={vectorOverlayCanvasRef}
                          className="max-h-full max-w-full object-contain"
                        />
                      )}
                      {tracingPreviewTab === 'threshold' && (
                        <canvas
                          ref={processedCanvasRef}
                          className="max-h-full max-w-full object-contain"
                        />
                      )}
                      {tracingPreviewTab === 'original' && (
                        <img
                          src={rasterImage.src}
                          alt="Original"
                          className="max-h-full max-w-full object-contain"
                        />
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Search className="w-5 h-5 text-cyan-300 drop-shadow" />
                      </div>
                    </div>

                    {/* Background Original Image Opacity Slider in Vector Tab */}
                    {tracingPreviewTab === 'vectors' && (
                      <div className="flex items-center justify-between text-[0.5625rem] font-mono text-slate-400 bg-slate-950/80 px-2 py-1 rounded-lg border border-slate-800">
                        <span className="flex items-center gap-1 text-slate-300">
                          <Layers className="w-3 h-3 text-cyan-400" />
                          <span>Hintergrundbild:</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={tracerBgOpacity}
                            onChange={(e) => setTracerBgOpacity(Number(e.target.value))}
                            className="w-20 accent-cyan-400 cursor-pointer"
                            title="Deckkraft des Originalbildes im Hintergrund der Pfadansicht"
                          />
                          <span className="text-cyan-300 w-7 text-right font-bold">{tracerBgOpacity}%</span>
                        </div>
                      </div>
                    )}

                    {/* Vector Trace Metrics Badges & Live Status */}
                    <div className="flex items-center justify-between pt-1">
                      {isTracing ? (
                        <div className="w-full bg-cyan-950/60 border border-cyan-500/50 text-cyan-200 px-2 py-1 rounded text-[0.625rem] font-bold flex items-center justify-center gap-1.5 animate-pulse shadow-sm">
                          <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                          <span>Vektorisiere Konturen...</span>
                        </div>
                      ) : rawPolylines.length > 0 ? (
                        <div className="w-full grid grid-cols-3 gap-1 font-mono text-[0.5625rem] text-center">
                          <div className="bg-slate-950 px-1.5 py-1 rounded border border-slate-800">
                            <span className="text-slate-500 block">Pfade:</span>
                            <span className="text-cyan-300 font-bold">{rawPolylines.length}</span>
                          </div>
                          <div className="bg-slate-950 px-1.5 py-1 rounded border border-slate-800">
                            <span className="text-slate-500 block">Punkte:</span>
                            <span className="text-indigo-300 font-bold">{rawPolylines.reduce((acc, p) => acc + p.points.length, 0)}</span>
                          </div>
                          <div className="bg-slate-950 px-1.5 py-1 rounded border border-slate-800">
                            <span className="text-slate-500 block">Länge:</span>
                            <span className="text-emerald-300 font-bold">{rawPolylines.reduce((acc, p) => acc + computePolylineLength(p.points), 0).toFixed(0)} mm</span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}

                {/* 1. ZIELGRÖSSE & SEITENVERHÄLTNIS-SPERRE (GANZ NACH OBEN VERSCHOBEN) */}
                <div className="space-y-2 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 font-mono text-[0.625rem]">
                  <div className="flex items-center justify-between text-slate-300 font-semibold border-b border-slate-800 pb-1">
                    <span className="flex items-center gap-1.5 font-bold text-slate-200">
                      <Ruler className="w-3.5 h-3.5 text-cyan-400" />
                      Zielabmessungen &amp; Skalierung
                    </span>
                    <button
                      onClick={() => setRasterLockAspect(!rasterLockAspect)}
                      className={`px-2 py-0.5 rounded flex items-center gap-1 text-[0.625rem] font-semibold border transition-all ${
                        rasterLockAspect
                          ? 'bg-cyan-600/30 text-cyan-200 border-cyan-500/50'
                          : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                      }`}
                      title={rasterLockAspect ? 'Seitenverhältnis gesperrt (proportional)' : 'Seitenverhältnis frei (verzerrbar)'}
                    >
                      {rasterLockAspect ? <Lock className="w-3 h-3 text-cyan-400" /> : <Unlock className="w-3 h-3 text-slate-400" />}
                      <span>{rasterLockAspect ? 'Proportional' : 'Frei'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <div className="space-y-1">
                      <span className="text-slate-400">Breite (mm):</span>
                      <input
                        type="number"
                        min={1}
                        max={2000}
                        value={rasterSettings.targetWidth}
                        onChange={(e) => handleRasterWidthChange(Number(e.target.value))}
                        className="w-full bg-slate-950 px-2 py-1 rounded border border-slate-700 text-cyan-200 font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-400">Höhe (mm):</span>
                      <input
                        type="number"
                        min={1}
                        max={2000}
                        value={rasterSettings.targetHeight || Math.round(rasterSettings.targetWidth * ((rasterImage?.height || 1) / (rasterImage?.width || 1)))}
                        onChange={(e) => handleRasterHeightChange(Number(e.target.value))}
                        className="w-full bg-slate-950 px-2 py-1 rounded border border-slate-700 text-cyan-200 font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. VEKTORISIERUNGS- & SCHRAFFUR-MODUS */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 text-[0.6875rem] font-bold flex items-center gap-1.5">
                      <Workflow className="w-3.5 h-3.5 text-cyan-400" />
                      Vektorisierungs-Modus:
                    </span>
                    <span className="text-[0.625rem] text-cyan-400/90 font-mono">
                      {rasterSettings.mode === 'contour_trace' ? 'Außen/Innen' : rasterSettings.mode === 'centerline_trace' ? 'Mittellinie' : 'Schraffur'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { 
                        id: 'contour_trace', 
                        label: '🔍 Outline-Kontur', 
                        desc: 'Edge-Detection für Logos, Silhouetten & Schriften (Außen & Innen)',
                        accent: 'border-cyan-500 text-cyan-200 bg-cyan-950/40' 
                      },
                      { 
                        id: 'centerline_trace', 
                        label: '🖋️ Mittellinie (Centerline)', 
                        desc: 'Zhang-Suen Skelettierung für Handschrift, Skizzen & 1-Strich Linien',
                        accent: 'border-amber-500 text-amber-200 bg-amber-950/40' 
                      },
                      { 
                        id: 'hatch_linear', 
                        label: 'Linien-Schraffur', 
                        desc: 'Gleichmäßige parallele Linien',
                        accent: 'border-indigo-500 text-indigo-200 bg-indigo-950/40' 
                      },
                      { 
                        id: 'cross_hatch', 
                        label: 'Kreuz-Schraffur', 
                        desc: 'Zwei überlagerte Schraffurlagen',
                        accent: 'border-indigo-500 text-indigo-200 bg-indigo-950/40' 
                      },
                      { 
                        id: 'stipple_dither', 
                        label: 'Dithering / Punkte', 
                        desc: 'Stippling-Punkte für Farbverläufe',
                        accent: 'border-purple-500 text-purple-200 bg-purple-950/40' 
                      },
                      { 
                        id: 'spiral_wave', 
                        label: 'Wellen-Kurven', 
                        desc: 'Sinusförmige Wellenlinien',
                        accent: 'border-purple-500 text-purple-200 bg-purple-950/40' 
                      },
                    ].map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setRasterSettings(s => ({ ...s, mode: m.id as any }))}
                        className={`p-2 rounded-lg border text-left text-[0.625rem] transition-all flex flex-col justify-between ${
                          rasterSettings.mode === m.id
                            ? `${m.accent} ring-1 font-semibold shadow-sm`
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                        }`}
                        title={m.desc}
                      >
                        <span className="font-semibold text-slate-100">{m.label}</span>
                        <span className="text-[0.5625rem] text-slate-500 line-clamp-1 mt-0.5">{m.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2b. MUSTERFÜLLUNG / PATTERN FILL (Wenn Outline-Kontur aktiv) */}
                {rasterSettings.mode === 'contour_trace' && (
                  <div className="space-y-2 bg-gradient-to-br from-cyan-950/40 to-slate-900/90 p-2.5 rounded-lg border border-cyan-500/30 font-mono text-[0.625rem]">
                    <div className="flex items-center justify-between border-b border-cyan-500/20 pb-1">
                      <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                        <GridIcon className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Musterfüllung (Infill):</span>
                      </span>
                      <span className="text-[0.5625rem] text-cyan-400/80 font-bold">
                        {rasterSettings.fillPattern && rasterSettings.fillPattern !== 'none' ? 'Aktiv' : 'Keine'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1 pt-0.5">
                      {[
                        { id: 'none', label: '🚫 Nur Kontur' },
                        { id: 'lines', label: '📐 Linien' },
                        { id: 'crosshatch', label: '✖️ Kreuzschraffur' },
                        { id: 'concentric', label: '⭕ Konzentrisch' },
                        { id: 'zigzag', label: '⚡ Zickzack' },
                        { id: 'dots', label: '░ Punkte / Dither' },
                        { id: 'wave', label: '〰️ Wellenmuster' },
                      ].map((pat) => (
                        <button
                          key={pat.id}
                          onClick={() => setRasterSettings(s => ({ ...s, fillPattern: pat.id as any }))}
                          className={`px-2 py-1 rounded text-[0.5625rem] font-semibold border transition-all text-left truncate ${
                            (rasterSettings.fillPattern || 'none') === pat.id
                              ? 'bg-cyan-600 text-white border-cyan-400 shadow-sm'
                              : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {pat.label}
                        </button>
                      ))}
                    </div>

                    {rasterSettings.fillPattern && rasterSettings.fillPattern !== 'none' && (
                      <div className="space-y-2 pt-1 border-t border-cyan-500/20">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300">Linienabstand:</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="range"
                              min={0.5}
                              max={8.0}
                              step={0.25}
                              value={rasterSettings.fillSpacing ?? 2.0}
                              onChange={(e) => setRasterSettings(s => ({ ...s, fillSpacing: Number(e.target.value) }))}
                              className="w-20 accent-cyan-400"
                            />
                            <span className="text-cyan-300 w-10 text-right font-bold">{(rasterSettings.fillSpacing ?? 2.0).toFixed(1)} mm</span>
                          </div>
                        </div>

                        {rasterSettings.fillPattern !== 'concentric' && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-300">Schraffur-Winkel:</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="range"
                                min={0}
                                max={180}
                                step={5}
                                value={rasterSettings.fillAngle ?? 45}
                                onChange={(e) => setRasterSettings(s => ({ ...s, fillAngle: Number(e.target.value) }))}
                                className="w-20 accent-cyan-400"
                              />
                              <span className="text-cyan-300 w-10 text-right font-bold">{rasterSettings.fillAngle ?? 45}°</span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-cyan-500/20">
                          <span className="text-slate-300">Außenkontur behalten:</span>
                          <button
                            onClick={() => setRasterSettings(s => ({ ...s, fillIncludeContour: !(s.fillIncludeContour ?? true) }))}
                            className={`px-2 py-0.5 rounded text-[0.5625rem] font-semibold border transition-all ${
                              (rasterSettings.fillIncludeContour ?? true)
                                ? 'bg-cyan-600 text-white border-cyan-400 shadow-sm'
                                : 'bg-slate-900 border-slate-700 text-slate-400'
                            }`}
                          >
                            {(rasterSettings.fillIncludeContour ?? true) ? 'Ja (Kontur + Füllung)' : 'Nur Füllmuster'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2c. SPEZIFISCHE PARAMETER FÜR SCHRAFFUR / DITHER / WELLEN */}
                {(rasterSettings.mode === 'hatch_linear' || rasterSettings.mode === 'cross_hatch') && (
                  <div className="space-y-2 bg-slate-900/80 p-2.5 rounded-lg border border-indigo-500/30 font-mono text-[0.625rem]">
                    <div className="flex items-center justify-between border-b border-indigo-500/20 pb-1">
                      <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                        <SlidersIcon className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Schraffur-Parameter:</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Linienabstand / Dichte:</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="range"
                          min={0.5}
                          max={8}
                          step={0.5}
                          value={rasterSettings.resolution}
                          onChange={(e) => setRasterSettings(s => ({ ...s, resolution: Number(e.target.value) }))}
                          className="w-20 accent-indigo-400"
                        />
                        <span className="text-indigo-300 w-10 text-right font-bold">{rasterSettings.resolution} L/mm</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Schraffur-Winkel:</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="range"
                          min={0}
                          max={180}
                          step={5}
                          value={rasterSettings.angle}
                          onChange={(e) => setRasterSettings(s => ({ ...s, angle: Number(e.target.value) }))}
                          className="w-20 accent-indigo-400"
                        />
                        <span className="text-indigo-300 w-10 text-right font-bold">{rasterSettings.angle}°</span>
                      </div>
                    </div>
                  </div>
                )}

                {rasterSettings.mode === 'stipple_dither' && (
                  <div className="space-y-2 bg-slate-900/80 p-2.5 rounded-lg border border-purple-500/30 font-mono text-[0.625rem]">
                    <div className="flex items-center justify-between border-b border-purple-500/20 pb-1">
                      <span className="font-bold text-purple-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        <span>Stippling / Dither Parameter:</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Punkt-Dichte:</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="range"
                          min={1}
                          max={8}
                          step={0.5}
                          value={rasterSettings.resolution}
                          onChange={(e) => setRasterSettings(s => ({ ...s, resolution: Number(e.target.value) }))}
                          className="w-20 accent-purple-400"
                        />
                        <span className="text-purple-300 w-10 text-right font-bold">{rasterSettings.resolution} P/mm</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Punkt-Brenndauer:</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="range"
                          min={10}
                          max={200}
                          step={10}
                          value={rasterSettings.stippleDotDurationMs}
                          onChange={(e) => setRasterSettings(s => ({ ...s, stippleDotDurationMs: Number(e.target.value) }))}
                          className="w-20 accent-purple-400"
                        />
                        <span className="text-purple-300 w-10 text-right font-bold">{rasterSettings.stippleDotDurationMs} ms</span>
                      </div>
                    </div>
                  </div>
                )}

                {rasterSettings.mode === 'spiral_wave' && (
                  <div className="space-y-2 bg-slate-900/80 p-2.5 rounded-lg border border-purple-500/30 font-mono text-[0.625rem]">
                    <div className="flex items-center justify-between border-b border-purple-500/20 pb-1">
                      <span className="font-bold text-purple-300 flex items-center gap-1.5">
                        <Spline className="w-3.5 h-3.5 text-purple-400" />
                        <span>Wellen-Parameter:</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Wellen-Dichte:</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="range"
                          min={1}
                          max={8}
                          step={0.5}
                          value={rasterSettings.resolution}
                          onChange={(e) => setRasterSettings(s => ({ ...s, resolution: Number(e.target.value) }))}
                          className="w-20 accent-purple-400"
                        />
                        <span className="text-purple-300 w-10 text-right font-bold">{rasterSettings.resolution} L/mm</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Wellen-Intensität:</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="range"
                          min={0.2}
                          max={3.0}
                          step={0.1}
                          value={rasterSettings.spiralTightness}
                          onChange={(e) => setRasterSettings(s => ({ ...s, spiralTightness: Number(e.target.value) }))}
                          className="w-20 accent-purple-400"
                        />
                        <span className="text-purple-300 w-10 text-right font-bold">{rasterSettings.spiralTightness.toFixed(1)}x</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. KERN-PARAMETER: SCHWELLENWERT & KANTENGLÄTTUNG */}
                <div className="space-y-2.5 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 font-mono text-[0.625rem]">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                      <SlidersIcon className="w-3.5 h-3.5 text-cyan-400" />
                      Echtzeit-Parameter
                    </span>
                    <button
                      onClick={handleAutoOtsuThreshold}
                      className="px-2 py-0.5 bg-cyan-600/30 hover:bg-cyan-600 border border-cyan-500/50 text-cyan-200 rounded text-[0.625rem] font-medium flex items-center gap-1 transition-colors shadow-sm"
                      title="Berechnet automatisch die optimale Schwarz/Weiß-Trennung mittels Otsu-Algorithmus"
                    >
                      <Wand2 className="w-3 h-3 text-cyan-300" />
                      <span>⚡ Auto-Otsu</span>
                    </button>
                  </div>

                  {/* 1. Threshold Slider */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-semibold">Schwellenwert:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={10}
                        max={250}
                        value={rasterSettings.threshold}
                        onChange={(e) => setRasterSettings(s => ({ ...s, threshold: Number(e.target.value) }))}
                        className="w-24 accent-cyan-400"
                      />
                      <span className="text-cyan-300 w-8 text-right font-bold">{rasterSettings.threshold}</span>
                    </div>
                  </div>

                  {/* 2. Detailgrad / Feinschrift & Kleindetails (Airplane Text / Fine Details Slider) */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                    <div className="flex flex-col">
                      <span className="text-amber-300 font-semibold flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>Detailgrad (Feinschrift):</span>
                      </span>
                      <span className="text-[0.5625rem] text-slate-500">1: Filter | 10: Max Details</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={1}
                        max={10}
                        step={1}
                        value={rasterSettings.detailSensitivity ?? 5}
                        onChange={(e) => setRasterSettings(s => ({ ...s, detailSensitivity: Number(e.target.value) }))}
                        className="w-24 accent-amber-400"
                        title="Erhöht die Auflösung und Empfindlichkeit für kleine Beschriftungen, Logos und feine Details"
                      />
                      <span className="text-amber-300 w-12 text-right font-bold">Stufe {rasterSettings.detailSensitivity ?? 5}</span>
                    </div>
                  </div>

                  {/* 3. Prominent Edge Smoothing (Kantenglättung / Douglas-Peucker) */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                    <div className="flex flex-col">
                      <span className="text-emerald-300 font-semibold flex items-center gap-1">
                        <Spline className="w-3 h-3 text-emerald-400" />
                        <span>Kantenglättung:</span>
                      </span>
                      <span className="text-[0.5625rem] text-slate-500">Douglas-Peucker</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0.05}
                        max={3.0}
                        step={0.05}
                        value={rasterSettings.simplificationTolerance ?? 0.25}
                        onChange={(e) => setRasterSettings(s => ({ ...s, simplificationTolerance: Number(e.target.value) }))}
                        className="w-24 accent-emerald-400"
                      />
                      <span className="text-emerald-300 w-12 text-right font-bold">{(rasterSettings.simplificationTolerance ?? 0.25).toFixed(2)} mm</span>
                    </div>
                  </div>
                </div>

                {/* 4. PROGRESSIVE DISCLOSURE ACCORDION: ⚙️ Erweiterte Einstellungen */}
                <div className="border border-slate-800 rounded-lg overflow-hidden font-mono text-[0.625rem] bg-slate-950/40">
                  <button
                    onClick={() => setShowAdvancedRasterSettings(!showAdvancedRasterSettings)}
                    className="w-full px-3 py-2 bg-slate-900/90 hover:bg-slate-800/90 flex items-center justify-between text-slate-300 font-medium transition-colors"
                  >
                    <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                      <span>⚙️ Erweiterte Einstellungen</span>
                    </span>
                    {showAdvancedRasterSettings ? <ChevronUp className="w-4 h-4 text-cyan-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>

                  {showAdvancedRasterSettings && (
                    <div className="p-2.5 space-y-3 bg-slate-900/40 border-t border-slate-800/80">
                      {/* Weichzeichner (Blur Pre-Filter) */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400" title="Glättet Pixelstufen und Rauschen vor dem Vektorisieren">Weichzeichner (Blur):</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={0}
                            max={6}
                            step={1}
                            value={rasterSettings.blurRadius ?? 1}
                            onChange={(e) => setRasterSettings(s => ({ ...s, blurRadius: Number(e.target.value) }))}
                            className="w-24 accent-indigo-500"
                          />
                          <span className="text-indigo-300 w-8 text-right font-mono">{(rasterSettings.blurRadius ?? 1)} px</span>
                        </div>
                      </div>

                      {/* Kontrast & Helligkeit */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Kontrast:</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={-100}
                            max={100}
                            value={rasterSettings.contrast}
                            onChange={(e) => setRasterSettings(s => ({ ...s, contrast: Number(e.target.value) }))}
                            className="w-24 accent-indigo-500"
                          />
                          <span className="text-indigo-300 w-8 text-right font-mono">{rasterSettings.contrast > 0 ? `+${rasterSettings.contrast}` : rasterSettings.contrast}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Helligkeit:</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={-100}
                            max={100}
                            value={rasterSettings.brightness}
                            onChange={(e) => setRasterSettings(s => ({ ...s, brightness: Number(e.target.value) }))}
                            className="w-24 accent-indigo-500"
                          />
                          <span className="text-indigo-300 w-8 text-right font-mono">{rasterSettings.brightness > 0 ? `+${rasterSettings.brightness}` : rasterSettings.brightness}</span>
                        </div>
                      </div>

                      {/* Gamma Curve */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Gamma:</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={0.3}
                            max={2.5}
                            step={0.1}
                            value={rasterSettings.gamma ?? 1.0}
                            onChange={(e) => setRasterSettings(s => ({ ...s, gamma: Number(e.target.value) }))}
                            className="w-24 accent-indigo-500"
                          />
                          <span className="text-indigo-300 w-8 text-right font-mono">{(rasterSettings.gamma ?? 1.0).toFixed(1)}</span>
                        </div>
                      </div>

                      {/* Black & White levels */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                        <div className="space-y-1">
                          <span className="text-slate-500 text-[0.5625rem]">Schwarzwerte: {rasterSettings.blackLevel || 0}</span>
                          <input
                            type="range"
                            min={0}
                            max={150}
                            value={rasterSettings.blackLevel || 0}
                            onChange={(e) => setRasterSettings(s => ({ ...s, blackLevel: Number(e.target.value) }))}
                            className="w-full accent-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-slate-500 text-[0.5625rem]">Weißwert: {rasterSettings.whiteLevel ?? 255}</span>
                          <input
                            type="range"
                            min={100}
                            max={255}
                            value={rasterSettings.whiteLevel ?? 255}
                            onChange={(e) => setRasterSettings(s => ({ ...s, whiteLevel: Number(e.target.value) }))}
                            className="w-full accent-indigo-500"
                          />
                        </div>
                      </div>

                      {/* Min Path Length Filter */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                        <span className="text-slate-400" title="Ignoriert winzige Rausch-Punkte und Artefakte unterhalb dieser Länge">Min. Pfadlänge:</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={0.0}
                            max={15.0}
                            step={0.2}
                            value={rasterSettings.minPathLength ?? 0.6}
                            onChange={(e) => setRasterSettings(s => ({ ...s, minPathLength: Number(e.target.value) }))}
                            className="w-24 accent-emerald-500"
                          />
                          <span className="text-emerald-300 w-12 text-right font-mono">{(rasterSettings.minPathLength ?? 0.6).toFixed(1)} mm</span>
                        </div>
                      </div>

                      {/* Small Text / Markings High-Pass Detail Booster */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1" title="Verstärkt schwache Schriftzüge, Flugzeugkennungen und feine Linien per High-Pass Filter">
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          <span>Schrift-Boost (High-Pass):</span>
                        </span>
                        <button
                          onClick={() => setRasterSettings(s => ({ ...s, enhanceSmallText: !(s.enhanceSmallText ?? true) }))}
                          className={`px-2 py-0.5 rounded text-[0.625rem] font-semibold border transition-all ${
                            (rasterSettings.enhanceSmallText ?? true)
                              ? 'bg-amber-600 text-white border-amber-400 shadow-sm'
                              : 'bg-slate-900 border-slate-700 text-slate-400'
                          }`}
                        >
                          {(rasterSettings.enhanceSmallText ?? true) ? 'Aktiv' : 'Aus'}
                        </button>
                      </div>

                      {/* Invert Button */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Farben invertieren:</span>
                        <button
                          onClick={() => setRasterSettings(s => ({ ...s, invert: !s.invert }))}
                          className={`px-2.5 py-0.5 rounded text-[0.625rem] font-semibold border transition-all ${
                            rasterSettings.invert
                              ? 'bg-rose-600 text-white border-rose-400 shadow-sm'
                              : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          {rasterSettings.invert ? 'Invertiert' : 'Normal'}
                        </button>
                      </div>

                      {/* Spiegeln X / Y */}
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                        <button
                          onClick={() => setRasterSettings(s => ({ ...s, mirrorX: !s.mirrorX }))}
                          className={`flex-1 py-1 rounded flex items-center justify-center gap-1 border transition-all ${
                            rasterSettings.mirrorX
                              ? 'bg-indigo-600 text-white border-indigo-400 font-bold'
                              : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                          }`}
                          title="Bild horizontal spiegeln"
                        >
                          <FlipHorizontal className="w-3 h-3" />
                          <span>Spiegeln X</span>
                        </button>

                        <button
                          onClick={() => setRasterSettings(s => ({ ...s, mirrorY: !s.mirrorY }))}
                          className={`flex-1 py-1 rounded flex items-center justify-center gap-1 border transition-all ${
                            rasterSettings.mirrorY
                              ? 'bg-indigo-600 text-white border-indigo-400 font-bold'
                              : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                          }`}
                          title="Bild vertikal spiegeln"
                        >
                          <FlipVertical className="w-3 h-3" />
                          <span>Spiegeln Y</span>
                        </button>
                      </div>

                      {/* Hatch Liniendichte für Raster Füllungen */}
                      {rasterSettings.mode !== 'contour_trace' && rasterSettings.mode !== 'centerline_trace' && (
                        <div className="space-y-1 pt-1 border-t border-slate-800/80">
                          <span className="text-slate-400">Liniendichte (Hatch):</span>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            step={0.5}
                            value={rasterSettings.resolution}
                            onChange={(e) => setRasterSettings(s => ({ ...s, resolution: Number(e.target.value) }))}
                            className="w-full bg-slate-900 px-2 py-1 rounded border border-slate-700 text-slate-100 font-mono"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ADD VECTORIZED GRAPHIC TO CANVAS BUTTON */}
                <button
                  onClick={handleAddCurrentToComposition}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-lg border border-cyan-400/50 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-cyan-500/20 active:scale-[0.99]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Vektorisierte Konturen zur Arbeitsfläche hinzufügen</span>
                </button>
              </div>
            )}
          </div>

          {/* ------------------------------------------------------------- */}
          {/* SCHRITT 2: WERKZEUG / ZIEL-MODUS WÄHLEN                       */}
          {/* ------------------------------------------------------------- */}
          <div className="space-y-2.5 pt-2 border-t border-slate-800">
            <span className="text-[0.6875rem] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[0.625rem]">2</span>
              Werkzeug & Betriebsmodus
            </span>

            <div className="grid grid-cols-3 gap-2">
              {/* Mode: Pen Plotter */}
              <button
                onClick={() => setTargetMode('pen')}
                className={`p-2.5 rounded-lg border text-left transition-all flex flex-col gap-1.5 ${
                  targetMode === 'pen'
                    ? 'bg-cyan-950/40 border-cyan-500 text-cyan-200 shadow-sm ring-1 ring-cyan-500/50'
                    : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <PenTool className="w-4 h-4 text-cyan-400" />
                  <span className="font-semibold text-xs text-slate-200">Stift</span>
                </div>
                <p className="text-[0.625rem] text-slate-400 leading-tight">Zeichnen mit Stift & Servo / Z-Achse</p>
              </button>

              {/* Mode: Drag Knife */}
              <button
                onClick={() => setTargetMode('dragknife')}
                className={`p-2.5 rounded-lg border text-left transition-all flex flex-col gap-1.5 ${
                  targetMode === 'dragknife'
                    ? 'bg-amber-950/40 border-amber-500 text-amber-200 shadow-sm ring-1 ring-amber-500/50'
                    : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Scissors className="w-4 h-4 text-amber-400" />
                  <span className="font-semibold text-xs text-slate-200">Messer</span>
                </div>
                <p className="text-[0.625rem] text-slate-400 leading-tight">Schleppmesser mit Klingen-Offset</p>
              </button>

              {/* Mode: Laser Diode */}
              <button
                onClick={() => setTargetMode('laser')}
                className={`p-2.5 rounded-lg border text-left transition-all flex flex-col gap-1.5 ${
                  targetMode === 'laser'
                    ? 'bg-rose-950/40 border-rose-500 text-rose-200 shadow-sm ring-1 ring-rose-500/50'
                    : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-rose-400" />
                  <span className="font-semibold text-xs text-slate-200">Laser</span>
                </div>
                <p className="text-[0.625rem] text-slate-400 leading-tight">Gravieren & Schneiden mit M3/M4</p>
              </button>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* SCHRITT 3: AUSFÜHRLICHE EINSTELLUNGEN ZUM MODUS               */}
          {/* ------------------------------------------------------------- */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[0.6875rem] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[0.625rem]">3</span>
                Parameter ({targetMode === 'pen' ? 'Stift' : targetMode === 'dragknife' ? 'Schleppmesser' : 'Laser'})
              </span>
            </div>

            {/* STIFT PLOTTER OPTIONEN */}
            {targetMode === 'pen' && (
              <div className="p-3.5 bg-slate-950/80 rounded-lg border border-cyan-800/40 space-y-3">
                {/* Actuator Type Switch */}
                <div className="space-y-1.5">
                  <span className="text-[0.625rem] font-bold text-slate-400 uppercase tracking-wider">Aktor-Typ / Stift-Ansteuerung:</span>
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800 text-[0.6875rem]">
                    <button
                      type="button"
                      onClick={() => {
                        setPenOptions(p => ({
                          ...p,
                          actuatorType: 'z_stepper',
                          penUpCommand: 'G0 Z5.00',
                          penDownCommand: 'G1 Z0.00 F600',
                          penUpZ: 5.0,
                          penDownZ: 0.0,
                          plungeFeedrate: 600,
                        }));
                      }}
                      className={`py-1.5 px-2 rounded-md font-medium text-center transition-all ${
                        penOptions.actuatorType === 'z_stepper' || !penOptions.actuatorType
                          ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Z-Achse (G0/G1)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPenOptions(p => ({
                          ...p,
                          actuatorType: 'servo',
                          penUpCommand: 'M3 S30',
                          penDownCommand: 'M3 S80',
                          servoUpValue: 30,
                          servoDownValue: 80,
                          servoDelayMs: 100,
                        }));
                      }}
                      className={`py-1.5 px-2 rounded-md font-medium text-center transition-all ${
                        penOptions.actuatorType === 'servo'
                          ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Servo (M3 PWM)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPenOptions(p => ({
                          ...p,
                          actuatorType: 'custom',
                        }));
                      }}
                      className={`py-1.5 px-2 rounded-md font-medium text-center transition-all ${
                        penOptions.actuatorType === 'custom'
                          ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Benutzerdefiniert
                    </button>
                  </div>
                </div>

                {/* Specific Actuator Settings */}
                {penOptions.actuatorType === 'servo' ? (
                  <div className="grid grid-cols-3 gap-2 font-mono bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[0.625rem]">Stift HOCH (S):</span>
                      <input
                        type="number"
                        value={penOptions.servoUpValue ?? 30}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setPenOptions(p => ({
                            ...p,
                            servoUpValue: val,
                            penUpCommand: `M3 S${val}`,
                          }));
                        }}
                        className="w-full bg-slate-950 px-2 py-1 rounded border border-slate-700 text-cyan-300 text-xs text-center"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[0.625rem]">Stift RUNTER (S):</span>
                      <input
                        type="number"
                        value={penOptions.servoDownValue ?? 80}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setPenOptions(p => ({
                            ...p,
                            servoDownValue: val,
                            penDownCommand: `M3 S${val}`,
                          }));
                        }}
                        className="w-full bg-slate-950 px-2 py-1 rounded border border-slate-700 text-cyan-300 text-xs text-center"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[0.625rem]">Pause (ms):</span>
                      <input
                        type="number"
                        value={penOptions.servoDelayMs ?? 100}
                        onChange={(e) => setPenOptions(p => ({ ...p, servoDelayMs: Number(e.target.value) }))}
                        className="w-full bg-slate-950 px-2 py-1 rounded border border-slate-700 text-slate-200 text-xs text-center"
                      />
                    </div>
                  </div>
                ) : penOptions.actuatorType === 'custom' ? (
                  <div className="grid grid-cols-2 gap-3 font-mono bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[0.625rem]">Befehl HOCH (z.B. M3 S30):</span>
                      <input
                        type="text"
                        value={penOptions.penUpCommand}
                        onChange={(e) => setPenOptions(p => ({ ...p, penUpCommand: e.target.value }))}
                        className="w-full bg-slate-950 px-2.5 py-1.5 rounded border border-slate-700 text-cyan-300 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[0.625rem]">Befehl RUNTER (z.B. M3 S80):</span>
                      <input
                        type="text"
                        value={penOptions.penDownCommand}
                        onChange={(e) => setPenOptions(p => ({ ...p, penDownCommand: e.target.value }))}
                        className="w-full bg-slate-950 px-2.5 py-1.5 rounded border border-slate-700 text-cyan-300 text-xs"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 font-mono bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[0.625rem]">Z-Hop Höhe (mm):</span>
                      <input
                        type="number"
                        step={0.5}
                        value={penOptions.penUpZ ?? 5.0}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setPenOptions(p => ({
                            ...p,
                            penUpZ: val,
                            penUpCommand: `G0 Z${val.toFixed(2)}`,
                          }));
                        }}
                        className="w-full bg-slate-950 px-2 py-1 rounded border border-slate-700 text-cyan-300 text-xs text-center"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[0.625rem]">Z-Zeichentiefe (mm):</span>
                      <input
                        type="number"
                        step={0.1}
                        value={penOptions.penDownZ ?? 0.0}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const plungeF = penOptions.plungeFeedrate || 600;
                          setPenOptions(p => ({
                            ...p,
                            penDownZ: val,
                            penDownCommand: `G1 Z${val.toFixed(2)} F${plungeF}`,
                          }));
                        }}
                        className="w-full bg-slate-950 px-2 py-1 rounded border border-slate-700 text-cyan-300 text-xs text-center"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[0.625rem]">Eintauch-F (mm/min):</span>
                      <input
                        type="number"
                        step={50}
                        value={penOptions.plungeFeedrate ?? 600}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const downZ = penOptions.penDownZ ?? 0.0;
                          setPenOptions(p => ({
                            ...p,
                            plungeFeedrate: val,
                            penDownCommand: `G1 Z${downZ.toFixed(2)} F${val}`,
                          }));
                        }}
                        className="w-full bg-slate-950 px-2 py-1 rounded border border-slate-700 text-slate-200 text-xs text-center"
                      />
                    </div>
                  </div>
                )}

                {/* Feedrates */}
                <div className="grid grid-cols-2 gap-3 font-mono">
                  <div className="space-y-1">
                    <span className="text-slate-400 text-[0.625rem]">Zeichen-Vorschub:</span>
                    <div className="flex items-center gap-1 bg-slate-900 px-2 py-1.5 rounded border border-slate-700">
                      <input
                        type="number"
                        value={penOptions.drawingFeedrate}
                        onChange={(e) => setPenOptions(p => ({ ...p, drawingFeedrate: Number(e.target.value) }))}
                        className="w-full bg-transparent text-slate-100 text-xs focus:outline-none"
                      />
                      <span className="text-[0.625rem] text-slate-500">mm/min</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 text-[0.625rem]">Eilgang (G0):</span>
                    <div className="flex items-center gap-1 bg-slate-900 px-2 py-1.5 rounded border border-slate-700">
                      <input
                        type="number"
                        value={penOptions.travelFeedrate}
                        onChange={(e) => setPenOptions(p => ({ ...p, travelFeedrate: Number(e.target.value) }))}
                        className="w-full bg-transparent text-slate-100 text-xs focus:outline-none"
                      />
                      <span className="text-[0.625rem] text-slate-500">mm/min</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* DRAG KNIFE OPTIONEN (USER REQUEST: Aktor-Typ Auswahl & G2/G3 Kreisbögen & Schwenk-Vorschub) */}
            {targetMode === 'dragknife' && (
              <div className="p-3.5 bg-slate-950/80 rounded-lg border border-amber-800/40 space-y-3">
                {/* Actuator Type Switch (same as Pen) */}
                <div className="space-y-1.5">
                  <span className="text-[0.625rem] font-bold text-amber-400 uppercase tracking-wider">Aktor-Typ / Messer-Zustellung:</span>
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800 text-[0.6875rem]">
                    <button
                      type="button"
                      onClick={() => {
                        setDragKnifeOptions(p => ({
                          ...p,
                          actuatorType: 'z_stepper',
                          penUpCommand: 'G0 Z5.00',
                          penDownCommand: 'G1 Z0.00 F600',
                          penUpZ: 5.0,
                          penDownZ: 0.0,
                          plungeFeedrate: 600,
                          rapidLiftZ: 5.0,
                        }));
                      }}
                      className={`py-1.5 px-2 rounded-md font-medium text-center transition-all ${
                        dragKnifeOptions.actuatorType === 'z_stepper' || !dragKnifeOptions.actuatorType
                          ? 'bg-amber-600 text-white shadow-sm font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Z-Achse (G0/G1)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDragKnifeOptions(p => ({
                          ...p,
                          actuatorType: 'servo',
                          penUpCommand: 'M3 S30',
                          penDownCommand: 'M3 S80',
                          servoUpValue: 30,
                          servoDownValue: 80,
                          servoDelayMs: 80,
                        }));
                      }}
                      className={`py-1.5 px-2 rounded-md font-medium text-center transition-all ${
                        dragKnifeOptions.actuatorType === 'servo'
                          ? 'bg-amber-600 text-white shadow-sm font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Servo (M3 PWM)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDragKnifeOptions(p => ({
                          ...p,
                          actuatorType: 'custom',
                        }));
                      }}
                      className={`py-1.5 px-2 rounded-md font-medium text-center transition-all ${
                        dragKnifeOptions.actuatorType === 'custom'
                          ? 'bg-amber-600 text-white shadow-sm font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Benutzerdefiniert
                    </button>
                  </div>
                </div>

                {/* Specific Actuator Settings for Drag Knife */}
                {dragKnifeOptions.actuatorType === 'servo' ? (
                  <div className="grid grid-cols-3 gap-2 font-mono bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[0.625rem]">Messer HOCH (S):</span>
                      <input
                        type="number"
                        value={dragKnifeOptions.servoUpValue ?? 30}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setDragKnifeOptions(p => ({
                            ...p,
                            servoUpValue: val,
                            penUpCommand: `M3 S${val}`,
                          }));
                        }}
                        className="w-full bg-slate-950 px-2 py-1 rounded border border-slate-700 text-amber-300 text-xs text-center"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[0.625rem]">Messer RUNTER (S):</span>
                      <input
                        type="number"
                        value={dragKnifeOptions.servoDownValue ?? 80}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setDragKnifeOptions(p => ({
                            ...p,
                            servoDownValue: val,
                            penDownCommand: `M3 S${val}`,
                          }));
                        }}
                        className="w-full bg-slate-950 px-2 py-1 rounded border border-slate-700 text-amber-300 text-xs text-center"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[0.625rem]">Pause (ms):</span>
                      <input
                        type="number"
                        value={dragKnifeOptions.servoDelayMs ?? 80}
                        onChange={(e) => setDragKnifeOptions(p => ({ ...p, servoDelayMs: Number(e.target.value) }))}
                        className="w-full bg-slate-950 px-2 py-1 rounded border border-slate-700 text-slate-200 text-xs text-center"
                      />
                    </div>
                  </div>
                ) : dragKnifeOptions.actuatorType === 'custom' ? (
                  <div className="grid grid-cols-2 gap-3 font-mono bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[0.625rem]">Befehl HOCH (z.B. M3 S30):</span>
                      <input
                        type="text"
                        value={dragKnifeOptions.penUpCommand}
                        onChange={(e) => setDragKnifeOptions(p => ({ ...p, penUpCommand: e.target.value }))}
                        className="w-full bg-slate-950 px-2.5 py-1.5 rounded border border-slate-700 text-amber-300 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[0.625rem]">Befehl RUNTER (z.B. M3 S80):</span>
                      <input
                        type="text"
                        value={dragKnifeOptions.penDownCommand}
                        onChange={(e) => setDragKnifeOptions(p => ({ ...p, penDownCommand: e.target.value }))}
                        className="w-full bg-slate-950 px-2.5 py-1.5 rounded border border-slate-700 text-amber-300 text-xs"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 font-mono bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[0.625rem]">Z-Hop Höhe (mm):</span>
                      <input
                        type="number"
                        step={0.5}
                        value={dragKnifeOptions.rapidLiftZ ?? 5.0}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setDragKnifeOptions(p => ({
                            ...p,
                            rapidLiftZ: val,
                            penUpZ: val,
                            penUpCommand: `G0 Z${val.toFixed(2)}`,
                          }));
                        }}
                        className="w-full bg-slate-950 px-2 py-1 rounded border border-slate-700 text-amber-300 text-xs text-center"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[0.625rem]">Z-Schneidtiefe (mm):</span>
                      <input
                        type="number"
                        step={0.1}
                        value={dragKnifeOptions.penDownZ ?? 0.0}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const plungeF = dragKnifeOptions.plungeFeedrate || 600;
                          setDragKnifeOptions(p => ({
                            ...p,
                            penDownZ: val,
                            penDownCommand: `G1 Z${val.toFixed(2)} F${plungeF}`,
                          }));
                        }}
                        className="w-full bg-slate-950 px-2 py-1 rounded border border-slate-700 text-amber-300 text-xs text-center"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[0.625rem]">Eintauch-F (mm/min):</span>
                      <input
                        type="number"
                        step={50}
                        value={dragKnifeOptions.plungeFeedrate ?? 600}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const downZ = dragKnifeOptions.penDownZ ?? 0.0;
                          setDragKnifeOptions(p => ({
                            ...p,
                            plungeFeedrate: val,
                            penDownCommand: `G1 Z${downZ.toFixed(2)} F${val}`,
                          }));
                        }}
                        className="w-full bg-slate-950 px-2 py-1 rounded border border-slate-700 text-slate-200 text-xs text-center"
                      />
                    </div>
                  </div>
                )}

                {/* Arc Mode Switch: G2/G3 vs G1 Linear */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[0.625rem] font-bold text-amber-300 uppercase tracking-wider">Schwenkbogen-Modus:</span>
                    <span className="text-[0.625rem] text-slate-400 font-mono">
                      {dragKnifeOptions.arcMode === 'linear_g1' ? 'Lineare G1 Segmente' : 'Echte G2/G3 Kreisbögen'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800 text-[0.6875rem]">
                    <button
                      type="button"
                      onClick={() => setDragKnifeOptions(p => ({ ...p, arcMode: 'g2_g3' }))}
                      className={`py-1.5 px-2 rounded-md font-medium text-center transition-all ${
                        dragKnifeOptions.arcMode === 'g2_g3' || !dragKnifeOptions.arcMode
                          ? 'bg-amber-600 text-white shadow-sm font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Echte G2/G3 Bögen (I/J)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDragKnifeOptions(p => ({ ...p, arcMode: 'linear_g1' }))}
                      className={`py-1.5 px-2 rounded-md font-medium text-center transition-all ${
                        dragKnifeOptions.arcMode === 'linear_g1'
                          ? 'bg-amber-600 text-white shadow-sm font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Lineare G1 Polygone
                    </button>
                  </div>
                </div>

                {/* Blade Geometry */}
                <div className="grid grid-cols-3 gap-2 font-mono">
                  <div className="space-y-1">
                    <span className="text-slate-400 text-[0.625rem]">Klingen-Offset:</span>
                    <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-700">
                      <input
                        type="number"
                        step={0.05}
                        value={dragKnifeOptions.bladeOffset}
                        onChange={(e) => setDragKnifeOptions(p => ({ ...p, bladeOffset: Number(e.target.value) }))}
                        className="w-full bg-transparent text-amber-300 text-xs focus:outline-none"
                      />
                      <span className="text-[0.625rem] text-slate-500">mm</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 text-[0.625rem]">Überchnitt:</span>
                    <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-700">
                      <input
                        type="number"
                        step={0.1}
                        value={dragKnifeOptions.overcut}
                        onChange={(e) => setDragKnifeOptions(p => ({ ...p, overcut: Number(e.target.value) }))}
                        className="w-full bg-transparent text-slate-100 text-xs focus:outline-none"
                      />
                      <span className="text-[0.625rem] text-slate-500">mm</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 text-[0.625rem]">Schwenkwinkel:</span>
                    <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-700">
                      <input
                        type="number"
                        value={dragKnifeOptions.swivelAngleThreshold}
                        onChange={(e) => setDragKnifeOptions(p => ({ ...p, swivelAngleThreshold: Number(e.target.value) }))}
                        className="w-full bg-transparent text-slate-100 text-xs focus:outline-none"
                      />
                      <span className="text-[0.625rem] text-slate-500">°</span>
                    </div>
                  </div>
                </div>

                {/* Feedrates: Swivel, Cut, Travel */}
                <div className="grid grid-cols-3 gap-2 font-mono">
                  <div className="space-y-1">
                    <span className="text-amber-300 text-[0.625rem] font-semibold">Schwenk-F:</span>
                    <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-amber-700/60">
                      <input
                        type="number"
                        step={50}
                        value={dragKnifeOptions.swivelFeedrate ?? 600}
                        onChange={(e) => setDragKnifeOptions(p => ({ ...p, swivelFeedrate: Number(e.target.value) }))}
                        className="w-full bg-transparent text-amber-200 text-xs focus:outline-none"
                        title="Vorschub bei G2/G3 Messerschwenk-Bögen in mm/min"
                      />
                      <span className="text-[0.5625rem] text-slate-500">mm/min</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 text-[0.625rem]">Schnitt-F:</span>
                    <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-700">
                      <input
                        type="number"
                        step={100}
                        value={dragKnifeOptions.cuttingFeedrate}
                        onChange={(e) => setDragKnifeOptions(p => ({ ...p, cuttingFeedrate: Number(e.target.value) }))}
                        className="w-full bg-transparent text-slate-100 text-xs focus:outline-none"
                      />
                      <span className="text-[0.5625rem] text-slate-500">mm/min</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 text-[0.625rem]">Eilgang-F:</span>
                    <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-700">
                      <input
                        type="number"
                        step={200}
                        value={dragKnifeOptions.travelFeedrate}
                        onChange={(e) => setDragKnifeOptions(p => ({ ...p, travelFeedrate: Number(e.target.value) }))}
                        className="w-full bg-transparent text-slate-100 text-xs focus:outline-none"
                      />
                      <span className="text-[0.5625rem] text-slate-500">mm/min</span>
                    </div>
                  </div>
                </div>

                {/* Swivel Lift Options */}
                <div className="grid grid-cols-2 gap-2 font-mono bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer col-span-2">
                    <input
                      type="checkbox"
                      checked={dragKnifeOptions.liftOnSwivel}
                      onChange={(e) => setDragKnifeOptions(p => ({ ...p, liftOnSwivel: e.target.checked }))}
                      className="rounded border-slate-700 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-[0.6875rem] text-slate-300">Klinge bei Schwenkung leicht anheben (reduziert Reibung)</span>
                  </label>

                  {dragKnifeOptions.liftOnSwivel && (
                    <div className="space-y-1 col-span-2 flex items-center justify-between text-[0.6875rem]">
                      <span className="text-slate-400">Schwenk-Hub (Z):</span>
                      <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-700">
                        <input
                          type="number"
                          step={0.1}
                          value={dragKnifeOptions.swivelLiftZ ?? 0.5}
                          onChange={(e) => setDragKnifeOptions(p => ({ ...p, swivelLiftZ: Number(e.target.value) }))}
                          className="w-14 bg-transparent text-amber-300 text-xs focus:outline-none text-right"
                        />
                        <span className="text-[0.625rem] text-slate-500">mm</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* LASER OPTIONEN (USER REQUEST: Alle G-Code Einstellungen aus den Profilen) */}
            {targetMode === 'laser' && (
              <div className="p-3.5 bg-slate-950/80 rounded-lg border border-rose-800/40 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-rose-400" />
                    <span className="font-semibold text-[0.6875rem] text-slate-200">Material-Vorgaben &amp; G-Code Setup:</span>
                  </div>
                  <button
                    onClick={() => { if (onOpenLaserDbModal) onOpenLaserDbModal(); }}
                    className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 rounded text-[0.625rem] font-medium flex items-center gap-1 transition-colors"
                  >
                    <SlidersHorizontal className="w-3 h-3" />
                    <span>Material-Datenbank</span>
                  </button>
                </div>

                {activeMaterialName && (
                  <div className="flex items-center justify-between bg-rose-950/30 px-2.5 py-1 rounded border border-rose-800/30 text-[0.625rem] text-rose-300">
                    <span>Aktiv: <strong>{activeMaterialName}</strong></span>
                    <button
                      onClick={() => setActiveMaterialName(null)}
                      className="text-slate-400 hover:text-rose-200"
                      title="Zurücksetzen"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Laser Mode Switch: M4 Dynamic vs M3 Constant */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[0.625rem] font-bold text-rose-400 uppercase tracking-wider">Laser-Modus (G-Code):</span>
                    <span className="text-[0.625rem] text-slate-400 font-mono">
                      {laserOptions.laserMode === 'M4' ? 'M4 (Dynamische Leistung)' : 'M3 (Konstante Leistung)'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800 text-[0.6875rem]">
                    <button
                      type="button"
                      onClick={() => setLaserOptions(p => ({ ...p, laserMode: 'M4', laserOnCommand: 'M4 S{S}' }))}
                      className={`py-1.5 px-2 rounded-md font-medium text-center transition-all ${
                        laserOptions.laserMode === 'M4' || !laserOptions.laserMode
                          ? 'bg-rose-600 text-white shadow-sm font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      M4 Dynamisch (GRBL Laser)
                    </button>
                    <button
                      type="button"
                      onClick={() => setLaserOptions(p => ({ ...p, laserMode: 'M3', laserOnCommand: 'M3 S{S}' }))}
                      className={`py-1.5 px-2 rounded-md font-medium text-center transition-all ${
                        laserOptions.laserMode === 'M3'
                          ? 'bg-rose-600 text-white shadow-sm font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      M3 Konstant (Standard)
                    </button>
                  </div>
                </div>

                {/* Power Min / Max (S-Value) & Feedrates */}
                <div className="grid grid-cols-3 gap-2 font-mono">
                  <div className="space-y-1">
                    <span className="text-slate-400 text-[0.625rem]">Min. Power (S):</span>
                    <input
                      type="number"
                      min={0}
                      max={10000}
                      value={laserOptions.powerMin ?? 0}
                      onChange={(e) => setLaserOptions(p => ({ ...p, powerMin: Number(e.target.value) }))}
                      className="w-full bg-slate-900 px-2 py-1 rounded border border-slate-700 text-rose-300 text-xs text-center"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-rose-300 text-[0.625rem] font-semibold">Max. Power (S):</span>
                    <input
                      type="number"
                      min={0}
                      max={10000}
                      value={laserOptions.powerMax}
                      onChange={(e) => setLaserOptions(p => ({ ...p, powerMax: Number(e.target.value) }))}
                      className="w-full bg-slate-900 px-2 py-1 rounded border border-rose-700/60 text-rose-200 text-xs text-center"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 text-[0.625rem]">Schnitt-F:</span>
                    <input
                      type="number"
                      step={50}
                      value={laserOptions.feedrate}
                      onChange={(e) => setLaserOptions(p => ({ ...p, feedrate: Number(e.target.value) }))}
                      className="w-full bg-slate-900 px-2 py-1 rounded border border-slate-700 text-slate-100 text-xs text-center"
                    />
                  </div>
                </div>

                {/* Passes & Z-Stepdown */}
                <div className="grid grid-cols-3 gap-2 font-mono bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <div className="space-y-1">
                    <span className="text-slate-400 text-[0.625rem]">Durchgänge:</span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={laserOptions.passes || 1}
                      onChange={(e) => setLaserOptions(p => ({ ...p, passes: Math.max(1, Number(e.target.value)) }))}
                      className="w-full bg-slate-950 px-2 py-1 rounded border border-slate-700 text-slate-200 text-xs text-center"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 text-[0.625rem]">Z-Zustellung:</span>
                    <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-700">
                      <input
                        type="number"
                        step={0.1}
                        min={0}
                        value={laserOptions.zStepdown || 0}
                        onChange={(e) => setLaserOptions(p => ({ ...p, zStepdown: Number(e.target.value) }))}
                        className="w-full bg-transparent text-rose-300 text-xs focus:outline-none text-right"
                      />
                      <span className="text-[0.5625rem] text-slate-500">mm</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 text-[0.625rem]">Eilgang-F:</span>
                    <input
                      type="number"
                      step={200}
                      value={laserOptions.travelFeedrate || 4000}
                      onChange={(e) => setLaserOptions(p => ({ ...p, travelFeedrate: Number(e.target.value) }))}
                      className="w-full bg-slate-950 px-2 py-1 rounded border border-slate-700 text-slate-200 text-xs text-center"
                    />
                  </div>
                </div>

                {/* Air Assist & Custom Commands */}
                <div className="space-y-2 font-mono bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 text-[0.6875rem]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={laserOptions.airAssist || false}
                      onChange={(e) => setLaserOptions(p => ({ ...p, airAssist: e.target.checked }))}
                      className="rounded border-slate-700 text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-slate-300 font-sans">Air Assist aktivieren (M8 vor Start / M9 bei Ende)</span>
                  </label>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[0.625rem]">Laser EIN Befehl:</span>
                      <input
                        type="text"
                        value={laserOptions.laserOnCommand || `${laserOptions.laserMode} S{S}`}
                        onChange={(e) => setLaserOptions(p => ({ ...p, laserOnCommand: e.target.value }))}
                        className="w-full bg-slate-950 px-2 py-1 rounded border border-slate-700 text-rose-300 text-xs"
                        placeholder="M4 S{S}"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[0.625rem]">Laser AUS Befehl:</span>
                      <input
                        type="text"
                        value={laserOptions.laserOffCommand || 'M5'}
                        onChange={(e) => setLaserOptions(p => ({ ...p, laserOffCommand: e.target.value }))}
                        className="w-full bg-slate-950 px-2 py-1 rounded border border-slate-700 text-slate-200 text-xs"
                        placeholder="M5"
                      />
                    </div>
                  </div>

                  {/* Start & End G-Code */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[0.625rem]">Start-G-Code:</span>
                      <input
                        type="text"
                        value={laserOptions.startGcode || ''}
                        onChange={(e) => setLaserOptions(p => ({ ...p, startGcode: e.target.value }))}
                        className="w-full bg-slate-950 px-2 py-1 rounded border border-slate-700 text-slate-200 text-xs"
                        placeholder="G90 G21"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[0.625rem]">End-G-Code:</span>
                      <input
                        type="text"
                        value={laserOptions.endGcode || ''}
                        onChange={(e) => setLaserOptions(p => ({ ...p, endGcode: e.target.value }))}
                        className="w-full bg-slate-950 px-2 py-1 rounded border border-slate-700 text-slate-200 text-xs"
                        placeholder="M5 G0 X0 Y0 M2"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Leerfahrtberechnung & Bearbeitungsreihenfolge (Hauptfenster) */}
            <div className="pt-2.5 pb-1 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Route className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Leerfahrt & Bearbeitungsreihenfolge</span>
                </span>
                <label className="flex items-center gap-1.5 text-[0.6875rem] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={optimizeOrder}
                    onChange={(e) => setOptimizeOrder(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-indigo-500"
                  />
                  <span>Aktiv</span>
                </label>
              </div>

              {optimizeOrder && (
                <div className="space-y-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 text-xs">
                  {/* Übergeordnete Objekt-Reihenfolge */}
                  <div className="space-y-1">
                    <div className="text-[0.6875rem] text-slate-400 font-medium">Übergeordnete Reihenfolge:</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setObjectOrderMode('object_by_object')}
                        className={`py-1 px-2 rounded text-[0.6875rem] font-semibold border transition-all ${
                          objectOrderMode === 'object_by_object'
                            ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Objekt für Objekt
                      </button>
                      <button
                        type="button"
                        onClick={() => setObjectOrderMode('fastest_global')}
                        className={`py-1 px-2 rounded text-[0.6875rem] font-semibold border transition-all ${
                          objectOrderMode === 'fastest_global'
                            ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Global schnellste
                      </button>
                    </div>
                  </div>

                  {/* Kontur-/Leerfahrt-Strategie */}
                  <div className="space-y-1 pt-1 border-t border-slate-800/70">
                    <div className="text-[0.6875rem] text-slate-400 font-medium">Leerfahrt- & Konturstrategie:</div>
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        onClick={() => setPathOrderStrategy('fastest')}
                        className={`py-1 px-1 rounded text-[0.625rem] font-semibold border text-center transition-all ${
                          pathOrderStrategy === 'fastest'
                            ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Schnellste
                      </button>
                      <button
                        type="button"
                        onClick={() => setPathOrderStrategy('inside_to_outside')}
                        className={`py-1 px-1 rounded text-[0.625rem] font-semibold border text-center transition-all ${
                          pathOrderStrategy === 'inside_to_outside'
                            ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Innen n. Außen
                      </button>
                      <button
                        type="button"
                        onClick={() => setPathOrderStrategy('outside_to_inside')}
                        className={`py-1 px-1 rounded text-[0.625rem] font-semibold border text-center transition-all ${
                          pathOrderStrategy === 'outside_to_inside'
                            ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Außen n. Innen
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-3.5 border-t border-slate-800 bg-slate-950/90 flex items-center gap-2">
          <button
            onClick={() => setShowGcodeModal(true)}
            className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            title="G-Code ansehen & kopieren"
          >
            <Code className="w-3.5 h-3.5" />
            <span>G-Code ansehen</span>
          </button>

          <button
            onClick={() => handleDownloadGcode('nc')}
            className="flex-1 px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors"
            title="G-Code Datei herunterladen (.nc)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Als .NC Speichern</span>
          </button>
        </div>
      </div>

      {/* Resizer */}
      {!isSidebarCollapsed && (
        <div 
          className="hidden lg:flex w-2 -mx-1.5 hover:bg-indigo-500/50 cursor-col-resize justify-center items-center rounded transition-colors group z-10 shrink-0"
          onMouseDown={handleResizeLeftPanelStart}
          onTouchStart={handleResizeLeftPanelStart}
        >
          <div className="w-0.5 h-12 bg-slate-700 group-hover:bg-indigo-400 rounded-full transition-colors" />
        </div>
      )}

      {/* ========================================================================= */}
      {/* CANVAS AREA: Only the unified Generator Preview is used here              */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col h-full overflow-hidden shadow-2xl relative min-w-[300px]">
        
        {/* Toggle Sidebar Button */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute top-1/2 -translate-y-1/2 right-0 z-50 p-2 w-8 h-16 bg-indigo-600 hover:bg-indigo-500 text-white rounded-l-md shadow-lg border-y border-l border-indigo-400 flex items-center justify-center transition-colors"
          title={isSidebarCollapsed ? "Seitenleiste einblenden" : "Seitenleiste ausblenden"}
        >
          {isSidebarCollapsed ? <ChevronLeft className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
        </button>

        <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden relative">
          {/* Top Preview Bar: Statistics, 2D/3D Switches, 3 Menus & Object Browser */}
          <div className="absolute top-0 left-0 right-0 z-10 px-4 py-2 flex items-center justify-between flex-wrap gap-2 text-xs pointer-events-none">
          <div className="flex items-center flex-wrap gap-2 sm:gap-2.5 pointer-events-auto">


            {/* 3 MENUS / SWITCHES (USER REQUEST) */}
            {/* Menu 1: Position / Größe */}
            <button
              onClick={() => setActiveGenMenu(curr => curr === 'pos_size' ? 'none' : 'pos_size')}
              className={`px-2.5 py-1 rounded-lg text-[0.6875rem] font-semibold flex items-center gap-1.5 border transition-all ${
                activeGenMenu === 'pos_size'
                  ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-900/40'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-purple-300'
              }`}
              title="Menü: Position, Soll-Maße & Skalierung"
            >
              <Scaling className="w-3.5 h-3.5" />
              <span>Position / Größe</span>
            </button>

            {/* Menu 2: Drehung */}
            <button
              onClick={() => setActiveGenMenu(curr => curr === 'rotation' ? 'none' : 'rotation')}
              className={`px-2.5 py-1 rounded-lg text-[0.6875rem] font-semibold flex items-center gap-1.5 border transition-all ${
                activeGenMenu === 'rotation'
                  ? 'bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-900/40'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-amber-300'
              }`}
              title="Menü: Drehung & Spiegeln"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Drehung</span>
            </button>

            {/* Undo / Redo Arrow Buttons */}
            <div className="flex items-center p-0.5 bg-slate-900 border border-slate-800 rounded-lg">
              <button
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                className="p-1 rounded text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
                title="Rückgängig (Strg+Z)"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className="p-1 rounded text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
                title="Wiederholen (Strg+Y / Strg+Shift+Z)"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Messen Button */}
            <button
              onClick={() => {
                setIsMeasureActive(prev => !prev);
                setGenMeasureStart(null);
                setGenMeasureEnd(null);
              }}
              className={`px-2.5 py-1 rounded-lg text-[0.6875rem] font-semibold flex items-center gap-1.5 border transition-all ${
                isMeasureActive
                  ? 'bg-cyan-600 text-white border-cyan-400 shadow-md shadow-cyan-900/40'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-cyan-300'
              }`}
              title="Abstand auf der Arbeitsfläche messen"
            >
              <Ruler className="w-3.5 h-3.5 text-cyan-400" />
              <span>Messen</span>
            </button>

            {/* OBJECT BROWSER BUTTON (USER REQUEST) */}
            <button
              onClick={() => setActiveGenMenu(curr => curr === 'obj_browser' ? 'none' : 'obj_browser')}
              className={`px-2.5 py-1 rounded-lg text-[0.6875rem] font-semibold flex items-center gap-1.5 border transition-all ${
                activeGenMenu === 'obj_browser'
                  ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-900/40'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-indigo-300'
              }`}
              title="Objektbrowser: Alle Elemente ein-/ausblenden, auswählen und verwalten"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Objektbrowser</span>
              {compositionElements.length > 0 && (
                <span className="px-1.5 py-0.2 bg-indigo-500/40 text-indigo-200 rounded-full text-[0.625rem] font-bold">
                  {compositionElements.length}
                </span>
              )}
            </button>

            {/* LIVE-ENTWURF VORSCHAU TOGGLE */}
            {compositionElements.length > 0 && (
              <button
                onClick={() => setShowLiveDraftPreview(prev => !prev)}
                className={`px-2.5 py-1 rounded-lg text-[0.6875rem] font-semibold flex items-center gap-1.5 border transition-all ${
                  showLiveDraftPreview
                    ? 'bg-cyan-950/80 border-cyan-500/80 text-cyan-300 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="Live-Vorschau des aktuellen Entwurfs vor dem Hinzufügen auf der Arbeitsfläche ein-/ausblenden"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Live-Entwurf</span>
              </button>
            )}
          </div>

          {/* Quick Zoom Controls */}
          <div className="flex items-center gap-3 font-mono text-[0.6875rem] text-slate-400 pointer-events-auto">
            {/* Zoom Controls */}
            <div className="flex items-center gap-0.5 border-l border-slate-800 pl-2">
              <button
                onClick={() => {
                  const canvas = previewCanvasRef.current;
                  const rect = canvas?.getBoundingClientRect();
                  const mouseX = rect ? rect.width / 2 : 250;
                  const mouseY = rect ? rect.height / 2 : 200;
                  const newZoom = Math.min(25.0, Math.max(0.12, zoom * 0.85));
                  const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
                  const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);
                  setZoom(newZoom);
                  setPan({ x: newPanX, y: newPanY });
                }}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded"
                title="Verkleinern"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[0.625rem] font-mono text-slate-400 w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => {
                  const canvas = previewCanvasRef.current;
                  const rect = canvas?.getBoundingClientRect();
                  const mouseX = rect ? rect.width / 2 : 250;
                  const mouseY = rect ? rect.height / 2 : 200;
                  const newZoom = Math.min(25.0, Math.max(0.12, zoom * 1.15));
                  const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
                  const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);
                  setZoom(newZoom);
                  setPan({ x: newPanX, y: newPanY });
                }}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded"
                title="Vergrößern"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={resetView}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded ml-0.5"
                title="Ansicht zentrieren"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* EXPANDABLE PANEL 1: POSITION / GRÖßE                                      */}
        {/* ========================================================================= */}
        {activeGenMenu === 'pos_size' && (
          <div className="px-4 py-3 bg-slate-950/95 border-b border-purple-900/50 flex flex-col gap-3 text-xs animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-purple-300 flex items-center gap-1.5 text-sm">
                  <Scaling className="w-4 h-4 text-purple-400" />
                  <span>Position &amp; Größe überarbeiten</span>
                </span>
                <span className="bg-slate-900 px-2 py-0.5 rounded text-[0.6875rem] font-mono text-slate-300 border border-slate-800">
                  {selectedElementId ? `Ausgewähltes Element` : `Gesamtes Motiv (Alle Elemente)`}
                </span>
              </div>
              <button
                onClick={() => setActiveGenMenu('none')}
                className="text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-xs border border-slate-800"
              >
                ✕ Schließen
              </button>
            </div>

            {/* Row 1: Position Verschieben (Nudge, Direct Inputs & Alignment) */}
            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              {/* Nudge step selector & buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-300 text-[0.6875rem]">Position (Nudge):</span>
                <div className="flex items-center gap-0.5 bg-slate-950 p-0.5 rounded border border-slate-800">
                  {[0.5, 1, 5, 10, 25, 50].map(s => (
                    <button
                      key={s}
                      onClick={() => setGenShiftStep(s)}
                      className={`px-1.5 py-0.5 rounded text-[0.625rem] font-mono ${
                        genShiftStep === s ? 'bg-purple-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 font-mono text-xs">
                  {/* X Nudge */}
                  <div className="flex items-center gap-0.5 bg-slate-950 px-1 py-0.5 rounded border border-slate-800">
                    <button
                      onClick={() => handleNudgeObject(-genShiftStep, 0)}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-rose-900/60 text-rose-400 rounded font-bold transition-colors"
                      title={`${genShiftStep}mm nach links`}
                    >
                      X-
                    </button>
                    <span className="px-1 text-[0.625rem] text-slate-400">X</span>
                    <button
                      onClick={() => handleNudgeObject(genShiftStep, 0)}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-rose-900/60 text-rose-400 rounded font-bold transition-colors"
                      title={`${genShiftStep}mm nach rechts`}
                    >
                      X+
                    </button>
                  </div>

                  {/* Y Nudge */}
                  <div className="flex items-center gap-0.5 bg-slate-950 px-1 py-0.5 rounded border border-slate-800">
                    <button
                      onClick={() => handleNudgeObject(0, -genShiftStep)}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-cyan-900/60 text-cyan-400 rounded font-bold transition-colors"
                      title={`${genShiftStep}mm nach unten`}
                    >
                      Y-
                    </button>
                    <span className="px-1 text-[0.625rem] text-slate-400">Y</span>
                    <button
                      onClick={() => handleNudgeObject(0, genShiftStep)}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-cyan-900/60 text-cyan-400 rounded font-bold transition-colors"
                      title={`${genShiftStep}mm nach oben`}
                    >
                      Y+
                    </button>
                  </div>
                </div>
              </div>

              {/* Direct Offset X & Y Inputs */}
              <div className="flex items-center gap-2 font-mono text-[0.6875rem]">
                <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                  <span className="text-rose-400 font-bold">X-Offset:</span>
                  <input
                    type="number"
                    step="1"
                    value={objOffsetX}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setObjOffsetX(val);
                      if (selectedElementId) {
                        setCompositionElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, offsetX: val } : el));
                      }
                    }}
                    className="w-12 bg-transparent text-slate-100 text-right focus:outline-none"
                    title="X-Verschiebung in mm"
                  />
                  <span className="text-slate-500 text-[0.625rem]">mm</span>
                </div>

                <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                  <span className="text-cyan-400 font-bold">Y-Offset:</span>
                  <input
                    type="number"
                    step="1"
                    value={objOffsetY}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setObjOffsetY(val);
                      if (selectedElementId) {
                        setCompositionElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, offsetY: val } : el));
                      }
                    }}
                    className="w-12 bg-transparent text-slate-100 text-right focus:outline-none"
                    title="Y-Verschiebung in mm"
                  />
                  <span className="text-slate-500 text-[0.625rem]">mm</span>
                </div>
              </div>

              {/* Alignment Shortcuts */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCenterObjectOnBed}
                  className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white rounded border border-indigo-500/40 font-medium text-[0.6875rem] flex items-center gap-1 transition-colors"
                  title="Objekt mittig auf der Arbeitsfläche platzieren"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Zentrieren</span>
                </button>
                <button
                  onClick={handleMoveObjectToOrigin}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 font-medium text-[0.6875rem] flex items-center gap-1 transition-colors"
                  title="Verschiebt nach unten links"
                >
                  <CornerDownLeft className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Zu Nullpunkt</span>
                </button>
              </div>
            </div>

            {/* Row 2: Größe & Soll-Maße (Soll-XYZ, Presets, Fine Adjust, Einpassen) */}
            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-purple-500/30 flex flex-wrap items-center justify-between gap-3 font-mono text-[0.6875rem]">
              {/* Ist-Maße Info */}
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-[0.625rem]">Aktuelle Maße:</span>
                <span className="text-slate-200 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  {stats.width.toFixed(1)} × {stats.height.toFixed(1)} mm
                </span>
              </div>

              {/* Soll-X, Soll-Y, Z */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-purple-500/40">
                  <span className="text-purple-300 font-bold">Soll-X:</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0.1"
                    value={sollWidth}
                    placeholder={String(rawBounds.width || '')}
                    onChange={(e) => handleSollXChange(parseFloat(e.target.value) || 0)}
                    className="w-14 bg-transparent text-slate-100 text-right focus:outline-none focus:text-purple-200"
                    title="Soll-Breite (X) in mm"
                  />
                  <span className="text-slate-500 text-[0.625rem]">mm</span>
                </div>

                <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-purple-500/40">
                  <span className="text-purple-300 font-bold">Soll-Y:</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0.1"
                    value={sollHeight}
                    placeholder={String(rawBounds.height || '')}
                    onChange={(e) => handleSollYChange(parseFloat(e.target.value) || 0)}
                    className="w-14 bg-transparent text-slate-100 text-right focus:outline-none focus:text-purple-200"
                    title="Soll-Höhe (Y) in mm"
                  />
                  <span className="text-slate-500 text-[0.625rem]">mm</span>
                </div>

                <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-700">
                  <span className="text-cyan-400 font-bold">Z:</span>
                  <input
                    type="number"
                    step="0.1"
                    value={sollDepthZ}
                    onChange={(e) => setSollDepthZ(parseFloat(e.target.value) || 0)}
                    className="w-12 bg-transparent text-slate-100 text-right focus:outline-none focus:text-cyan-200"
                    title="Soll-Tiefe / Z-Eintauchtiefe in mm"
                  />
                  <span className="text-slate-500 text-[0.625rem]">mm</span>
                </div>

                {/* Aspect Lock */}
                <button
                  onClick={() => setLockAspectDimensions(!lockAspectDimensions)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[0.6875rem] font-medium border transition-colors ${
                    lockAspectDimensions
                      ? 'bg-purple-950/70 border-purple-500/60 text-purple-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                  title={lockAspectDimensions ? 'Proportionales Skalieren aktiv' : 'Freie X/Y Skalierung'}
                >
                  {lockAspectDimensions ? <Lock className="w-3 h-3 text-purple-400" /> : <Unlock className="w-3 h-3" />}
                  <span>{lockAspectDimensions ? 'Proportional' : 'Frei'}</span>
                </button>
              </div>

              {/* Scaling Presets */}
              <div className="flex items-center gap-1">
                {[50, 75, 100, 125, 150, 200].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => handleScaleUniformChange(pct)}
                    className="px-1.5 py-1 bg-slate-950 hover:bg-slate-800 text-purple-300 rounded border border-slate-800 text-[0.625rem] font-semibold"
                    title={`Auf ${pct}% skalieren`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              {/* Fine Adjust & Fit to Bed */}
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => handleScaleUniformChange(Math.max(5, Number((scaleX * 0.9).toFixed(1))))}
                    className="px-1.5 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 text-[0.625rem]"
                    title="-10% verkleinern"
                  >
                    -10%
                  </button>
                  <button
                    onClick={() => handleScaleUniformChange(Math.max(5, Number((scaleX * 0.95).toFixed(1))))}
                    className="px-1.5 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 text-[0.625rem]"
                    title="-5% verkleinern"
                  >
                    -5%
                  </button>
                  <button
                    onClick={() => handleScaleUniformChange(Number((scaleX * 1.05).toFixed(1)))}
                    className="px-1.5 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 text-[0.625rem]"
                    title="+5% vergrößern"
                  >
                    +5%
                  </button>
                  <button
                    onClick={() => handleScaleUniformChange(Number((scaleX * 1.1).toFixed(1)))}
                    className="px-1.5 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 text-[0.625rem]"
                    title="+10% vergrößern"
                  >
                    +10%
                  </button>
                </div>

                <button
                  onClick={handleFitGeneratorToBed}
                  className="flex items-center gap-1 px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded font-medium text-[0.6875rem] transition-colors shadow"
                  title="Skaliert und zentriert das Motiv passend auf die Bauplatte"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>Auf Bett einpassen</span>
                </button>

                <button
                  onClick={handleResetObjectTransform}
                  className="px-2 py-1 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded border border-slate-800 text-[0.6875rem] transition-colors"
                  title="Transformation zurücksetzen"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* EXPANDABLE PANEL 2: DREHUNG & SPIEGELN                                    */}
        {/* ========================================================================= */}
        {activeGenMenu === 'rotation' && (
          <div className="px-4 py-2.5 bg-slate-950/95 border-b border-amber-900/50 flex flex-col gap-2 text-xs animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-300 flex items-center gap-1.5">
                <RotateCw className="w-3.5 h-3.5" />
                <span>Drehwinkel & Spiegeln</span>
              </span>
              <button
                onClick={() => setActiveGenMenu('none')}
                className="text-slate-500 hover:text-slate-300 text-xs"
              >
                ✕ Schließen
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[0.6875rem]">
              {/* Rotation Slider & Input */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-700">
                  <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                  <input
                    type="number"
                    step="5"
                    value={objRotation}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setObjRotation(val);
                      if (selectedElementId) {
                        setCompositionElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, rotation: val } : el));
                      }
                    }}
                    className="w-12 bg-transparent text-slate-100 text-right focus:outline-none"
                    title="Drehwinkel in Grad"
                  />
                  <span className="text-slate-500 text-[0.625rem]">°</span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="360"
                  step="1"
                  value={objRotation}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setObjRotation(val);
                    if (selectedElementId) {
                      setCompositionElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, rotation: val } : el));
                    }
                  }}
                  className="w-32 accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Quick Rotation Buttons */}
              <div className="flex items-center gap-1">
                {[-90, -45, 0, 45, 90, 180].map((deg) => (
                  <button
                    key={deg}
                    onClick={() => {
                      const val = deg === 0 ? 0 : (objRotation + deg + 360) % 360;
                      setObjRotation(val);
                      if (selectedElementId) {
                        setCompositionElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, rotation: val } : el));
                      }
                    }}
                    className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 text-[0.6875rem] font-semibold"
                  >
                    {deg > 0 ? `+${deg}°` : `${deg}°`}
                  </button>
                ))}
              </div>

              {/* Flip / Mirror buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    const val = !objFlipX;
                    setObjFlipX(val);
                    if (selectedElementId) {
                      setCompositionElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, flipX: val } : el));
                    }
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded border text-[0.6875rem] font-medium transition-all ${
                    objFlipX
                      ? 'bg-amber-600 text-white border-amber-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                  title="Horizontal spiegeln (Flip X)"
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                  <span>Flip X</span>
                </button>

                <button
                  onClick={() => {
                    const val = !objFlipY;
                    setObjFlipY(val);
                    if (selectedElementId) {
                      setCompositionElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, flipY: val } : el));
                    }
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded border text-[0.6875rem] font-medium transition-all ${
                    objFlipY
                      ? 'bg-amber-600 text-white border-amber-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                  title="Vertikal spiegeln (Flip Y)"
                >
                  <FlipVertical className="w-3.5 h-3.5" />
                  <span>Flip Y</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* EXPANDABLE PANEL 3: OBJECT BROWSER (USER REQUEST: Dedicated Manager)     */}
        {/* ========================================================================= */}
        {activeGenMenu === 'obj_browser' && (
          <div className="px-4 py-3 bg-slate-950/98 border-b border-indigo-900/60 flex flex-col gap-3 text-xs animate-in slide-in-from-top-2 duration-150 max-h-80 overflow-y-auto">
            <div className="flex items-center justify-between pb-1 border-b border-slate-800 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-indigo-200 text-sm">Objekt-Browser &amp; Legende</span>
                <span className="text-slate-500 font-mono text-[0.6875rem]">({compositionElements.length} Objekte, {selectedElementIds.length} ausgewählt)</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setSelectedElementIds(compositionElements.map(e => e.id))}
                  className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-amber-300 rounded text-[0.6875rem] font-medium"
                  title="Alle Objekte in der Arbeitsfläche markieren"
                >
                  Alle auswählen
                </button>
                <button
                  onClick={() => setSelectedElementIds([])}
                  className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded text-[0.6875rem]"
                  title="Auswahl aufheben"
                >
                  Auswahl leeren
                </button>
                <span className="text-slate-700">|</span>
                <button
                  onClick={() => handleSetAllElementsVisibility(true)}
                  className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-emerald-400 rounded text-[0.6875rem]"
                  title="Alle Objekte einblenden"
                >
                  Alle an
                </button>
                <button
                  onClick={() => handleSetAllElementsVisibility(false)}
                  className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded text-[0.6875rem]"
                  title="Alle Objekte ausblenden"
                >
                  Alle aus
                </button>
                <button
                  onClick={() => setActiveGenMenu('none')}
                  className="text-slate-500 hover:text-slate-300 text-xs ml-2"
                >
                  ✕ Schließen
                </button>
              </div>
            </div>

            {compositionElements.length === 0 ? (
              <div className="p-4 bg-slate-900/50 rounded-lg border border-dashed border-slate-800 text-center text-slate-400 space-y-2">
                <p className="text-xs">Aktuell befindet sich nur das Einzelelement im Editor auf der Fläche.</p>
                <button
                  onClick={handleAddCurrentToComposition}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold inline-flex items-center gap-1.5 shadow"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Aktuelles Motiv als Objekt hinzufügen</span>
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {compositionElements.map((el, index) => {
                  const isSelected = selectedElementIds.includes(el.id) || selectedElementId === el.id;
                  return (
                    <div
                      key={el.id}
                      className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                        isSelected
                          ? 'bg-indigo-950/80 border-indigo-500 shadow-sm ring-1 ring-indigo-500/40'
                          : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800/80'
                      }`}
                    >
                      {/* Left: Checkbox, Visibility & Name */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* Multi-Select Checkbox */}
                        <input
                          type="checkbox"
                          checked={selectedElementIds.includes(el.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedElementIds(prev => [...prev, el.id]);
                            } else {
                              setSelectedElementIds(prev => prev.filter(id => id !== el.id));
                            }
                          }}
                          className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          title="Zur Mehrfachauswahl hinzufügen/entfernen"
                        />

                        {/* Visibility Toggle */}
                        <button
                          onClick={() => handleToggleElementVisibility(el.id)}
                          className={`p-1 rounded hover:bg-slate-800 transition-colors ${
                            el.visible ? 'text-emerald-400' : 'text-slate-600'
                          }`}
                          title={el.visible ? 'Objekt ausblenden' : 'Objekt einblenden'}
                        >
                          {el.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>

                        {/* Lock Toggle */}
                        <button
                          onClick={() => handleToggleElementLock(el.id)}
                          className={`p-1 rounded hover:bg-slate-800 transition-colors ${
                            el.locked ? 'text-rose-400' : 'text-slate-500 hover:text-slate-300'
                          }`}
                          title={el.locked ? 'Objekt gesperrt (kann nicht verschoben werden)' : 'Objekt entsperrt'}
                        >
                          {el.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                        </button>

                        {/* Name input */}
                        <input
                          type="text"
                          value={el.name}
                          onChange={(e) => handleRenameElement(el.id, e.target.value)}
                          onClick={() => {
                            setSelectedElementId(el.id);
                            if (!selectedElementIds.includes(el.id)) {
                              setSelectedElementIds([el.id]);
                            }
                          }}
                          className={`bg-transparent text-xs font-semibold focus:outline-none focus:bg-slate-950 px-1 py-0.5 rounded flex-1 truncate ${
                            isSelected ? 'text-indigo-200' : 'text-slate-300'
                          }`}
                          title="Klicken zum Auswählen, doppelklicken zum Umbenennen"
                        />

                        {/* Details badge */}
                        <span className="font-mono text-[0.625rem] text-slate-500 hidden sm:inline">
                          X:{el.offsetX} Y:{el.offsetY} mm ({el.polylines.length} Pfade)
                        </span>
                      </div>

                      {/* Right: Actions (Order, Duplicate, Delete) */}
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          onClick={() => {
                            setSelectedElementId(el.id);
                            setSelectedElementIds([el.id]);
                          }}
                          className={`px-2 py-0.5 rounded text-[0.6875rem] font-medium transition-colors ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {isSelected ? 'Aktiv' : 'Wählen'}
                        </button>

                        {/* Order Up */}
                        <button
                          onClick={() => handleMoveElementUp(index)}
                          disabled={index === 0}
                          className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30 rounded hover:bg-slate-800"
                          title="In Schnitt-Reihenfolge nach oben"
                        >
                          ▲
                        </button>

                        {/* Order Down */}
                        <button
                          onClick={() => handleMoveElementDown(index)}
                          disabled={index === compositionElements.length - 1}
                          className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30 rounded hover:bg-slate-800"
                          title="In Schnitt-Reihenfolge nach unten"
                        >
                          ▼
                        </button>

                        {/* Duplicate */}
                        <button
                          onClick={() => handleDuplicateElement(el.id)}
                          className="p-1 text-slate-400 hover:text-indigo-300 rounded hover:bg-slate-800"
                          title="Duplizieren"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDeleteElement(el.id)}
                          className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800"
                          title="Löschen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Footer Action */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={handleAddCurrentToComposition}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[0.6875rem] font-medium flex items-center gap-1 shadow transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Weiteres Element hinzufügen</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {selectedElementIds.length > 1 && (
                      <button
                        onClick={() => {
                          setCompositionElements(prev => prev.filter(e => !selectedElementIds.includes(e.id)));
                          setSelectedElementIds([]);
                        }}
                        className="px-2.5 py-1 bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700/60 rounded text-[0.6875rem] font-medium flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>{selectedElementIds.length} Ausgewählte löschen</span>
                      </button>
                    )}
                    <button
                      onClick={handleClearComposition}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-rose-950 hover:text-rose-300 text-slate-400 rounded text-[0.6875rem] border border-slate-800 transition-colors"
                    >
                      Komposition leeren
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live Canvas Viewport */}
        <div 
          className="flex-1 w-full h-full relative overflow-hidden bg-[#090d16]"
          onContextMenu={(e) => e.preventDefault()}
        >
          <canvas
            ref={previewCanvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            onWheel={handleWheel}
            className={`w-full h-full block ${
              viewMode === '3d'
                ? 'cursor-grab active:cursor-grabbing'
                : isMeasureActive
                ? 'cursor-crosshair'
                : dragMode === 'transform_drag'
                ? 'cursor-move'
                : hoveredElementId
                ? 'cursor-pointer'
                : 'cursor-default'
            }`}
          />

          {/* Live Tool & Mouse Coordinates Overlay */}
          <div className="absolute top-14 left-4 flex flex-col gap-1 z-10 pointer-events-none">
            {showCoordsPanel && (
              <>
                <div className="bg-slate-950/80 backdrop-blur-md border border-slate-700/50 px-2.5 py-1.5 rounded-lg shadow-xl flex items-center gap-2">
                  <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="font-mono text-xs text-slate-300">
                    Maus: <span className="text-white font-semibold">X:{mousePos.x.toFixed(1)} Y:{mousePos.y.toFixed(1)}</span>
                  </span>
                </div>
                {liveState && (
                  <div className="bg-slate-950/80 backdrop-blur-md border border-slate-700/50 px-2.5 py-1.5 rounded-lg shadow-xl flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                    <span className="font-mono text-xs text-slate-300">
                      CNC: <span className="text-white font-semibold">X:{liveState.wpos.x.toFixed(1)} Y:{liveState.wpos.y.toFixed(1)} Z:{liveState.wpos.z.toFixed(1)}</span>
                    </span>
                  </div>
                )}
              </>
            )}
            {jogToast && (
              <div className="bg-indigo-600/90 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] text-white font-bold animate-in fade-in slide-in-from-left-2 mt-1 shadow-lg border border-indigo-400/50">
                G0 X{jogToast.x.toFixed(1)} Y{jogToast.y.toFixed(1)} 
              </div>
            )}
          </div>

          {/* Simulation Controls Overlay (Only visible if showSimSlider is true) */}
          {showSimSlider && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1.5 md:gap-2 z-50 pointer-events-auto min-w-[320px] md:min-w-[500px]">
              
              {/* Previous Step */}
              <button
                onClick={() => {
                  setIsSimPlaying(false);
                  setSimIndex(Math.max(0, simIndex - 1));
                }}
                className="p-1.5 md:p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Einen Schritt zurück"
              >
                <ChevronLeft className="w-4 h-4 md:w-4 md:h-4" />
              </button>

              {/* Play/Pause Button */}
              <button 
                className={`p-1.5 md:p-2 rounded-lg transition-all shadow-md ${
                  isSimPlaying 
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
                onClick={() => setIsSimPlaying(!isSimPlaying)}
                title={isSimPlaying ? 'Simulation anhalten' : 'Simulation abspielen'}
              >
                {isSimPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>

              {/* Next Step */}
              <button
                onClick={() => {
                  setIsSimPlaying(false);
                  setSimIndex(Math.min((localSimSegments.length || 1) - 1, simIndex + 1));
                }}
                className="p-1.5 md:p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Einen Schritt vor"
              >
                <ChevronRight className="w-4 h-4 md:w-4 md:h-4" />
              </button>

              {/* Stop / Reset Button */}
              <button
                onClick={() => {
                  setIsSimPlaying(false);
                  setSimIndex(0);
                }}
                className="p-1.5 md:p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Simulation zurücksetzen"
              >
                <Square className="w-4 h-4" />
              </button>

              {/* Timeline Slider */}
              <div className="flex-1 flex items-center gap-2 md:gap-3 px-1 md:px-2">
                <span className="text-slate-400 font-mono text-[0.6rem] md:text-[0.65rem] min-w-[50px] md:min-w-[70px]">
                  Seg {simIndex}
                </span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, (localSimSegments.length || 1) - 1)}
                  value={simIndex}
                  onChange={(e) => {
                    setIsSimPlaying(false);
                    setSimIndex(Number(e.target.value));
                  }}
                  className="flex-1 accent-indigo-500 h-1.5 md:h-2 bg-slate-800 rounded-full cursor-pointer transition-all hover:h-2.5"
                />
                <span className="text-indigo-300 font-mono font-semibold text-[0.6rem] md:text-xs min-w-[30px] md:min-w-[35px] text-right drop-shadow-[0_0_3px_rgba(99,102,241,0.8)]">
                  {Math.round((simIndex / Math.max(1, (localSimSegments.length || 1) - 1)) * 100)}%
                </span>
              </div>

              {/* Speed Toggle */}
              <button
                onClick={() => {
                  setSimSpeed(prev => {
                    if (prev === 0.1) return 0.5;
                    if (prev === 0.5) return 1;
                    if (prev === 1) return 2;
                    if (prev === 2) return 5;
                    if (prev === 5) return 10;
                    if (prev === 10) return 0.1;
                    return 1;
                  });
                }}
                className="flex items-center gap-1 px-1.5 md:px-2 py-1 md:py-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors font-mono text-[0.65rem] md:text-xs font-semibold"
                title="Simulationsgeschwindigkeit"
              >
                <FastForward className="w-3 h-3 md:w-3.5 md:h-3.5 text-cyan-400" />
                <span>{simSpeed}x</span>
              </button>
            </div>
          )}

          {/* Floating Action Bar for Selected Objects */}
          {selectedElementIds.length > 0 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/10 backdrop-blur-md px-3.5 py-1.5 rounded-full drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)] flex items-center gap-2 z-30 animate-in fade-in slide-in-from-top-2 text-slate-100 pointer-events-auto">
              <span className="text-xs font-semibold text-indigo-300 drop-shadow-[0_0_6px_rgba(99,102,241,0.8)] pl-1 pr-2 border-r border-white/20">
                {selectedElementIds.length} {selectedElementIds.length === 1 ? 'Objekt' : 'Objekte'} markiert
              </span>
              <button
                onClick={handleCenterObjectOnBed}
                className="px-2 py-1 hover:bg-white/10 text-slate-200 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
                title="Markierte Objekte auf dem Bett zentrieren"
              >
                <AlignCenter className="w-3.5 h-3.5 text-indigo-400" />
                <span>Zentrieren</span>
              </button>
              <button
                onClick={handleMoveObjectToOrigin}
                className="px-2 py-1 hover:bg-white/10 text-slate-200 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
                title="Markierte Objekte auf Nullpunkt (0,0) setzen"
              >
                <CornerDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                <span>Nullpunkt</span>
              </button>
              <button
                onClick={handleDuplicateSelected}
                className="px-2 py-1 hover:bg-white/10 text-amber-200 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
                title="Markierte Objekte duplizieren"
              >
                <Copy className="w-3.5 h-3.5 text-amber-400" />
                <span>Duplizieren</span>
              </button>
              <button
                onClick={handleDeleteSelected}
                className="px-2 py-1 hover:bg-white/10 text-rose-300 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
                title="Markierte Objekte löschen (Entf / Backspace)"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Löschen</span>
              </button>
              <button
                onClick={() => setSelectedElementIds([])}
                className="p-1 hover:bg-white/10 text-slate-300 hover:text-slate-100 rounded-full transition-colors ml-1"
                title="Auswahl aufheben"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Floating Measurement Mode Active Banner */}
          {isMeasureActive && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/10 backdrop-blur-md px-4 py-2 rounded-full drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)] text-xs text-slate-100 font-mono flex items-center gap-3 z-30 animate-in fade-in pointer-events-auto">
              <div className="flex items-center gap-1.5 font-semibold text-cyan-300 drop-shadow-[0_0_6px_rgba(34,211,238,0.8)]">
                <Ruler className="w-4 h-4 text-cyan-400 animate-pulse shrink-0" />
                <span>Messwerkzeug:</span>
              </div>
              
              <span className="text-slate-300 drop-shadow-md">
                {genMeasureStart && genMeasureEnd 
                  ? <span className="font-bold text-cyan-200 bg-cyan-950/40 px-2 py-0.5 rounded-md">Länge: {Math.hypot(genMeasureEnd.x - genMeasureStart.x, genMeasureEnd.y - genMeasureStart.y).toFixed(2)} mm</span>
                  : 'Klicken & Ziehen um Distanz zu messen'}
              </span>
              
              {genMeasureStart && genMeasureEnd && (
                <span className="text-[0.6875rem] text-slate-300 drop-shadow-md">
                   (ΔX: {(genMeasureEnd.x - genMeasureStart.x).toFixed(2)}, ΔY: {(genMeasureEnd.y - genMeasureStart.y).toFixed(2)})
                </span>
              )}

              <div className="flex items-center gap-1.5 ml-1 border-l border-white/20 pl-2">
                {genMeasureStart && (
                  <button
                    onClick={() => {
                      setGenMeasureStart(null);
                      setGenMeasureEnd(null);
                    }}
                    className="px-2 py-0.5 bg-cyan-900/30 hover:bg-cyan-900/50 text-cyan-200 rounded-md text-[0.625rem] transition-colors"
                  >
                    Messung löschen
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsMeasureActive(false);
                    setGenMeasureStart(null);
                    setGenMeasureEnd(null);
                  }}
                  className="px-2 py-0.5 bg-black/20 hover:bg-black/40 text-slate-300 rounded-md text-[0.625rem] transition-colors"
                  title="Messmodus beenden"
                >
                  Beenden
                </button>
              </div>
            </div>
          )}

          {/* 3D Orientation ViewCube */}
          <ViewCube
            yaw={orbitYaw}
            pitch={orbitPitch}
            viewMode={viewMode}
            onOrientationChange={(newYaw, newPitch, mode) => {
              setOrbitYaw(newYaw);
              setOrbitPitch(newPitch);
              if (mode && mode !== viewMode) {
                setViewMode(mode);
                fitToView(mode);
              }
            }}
            onResetHome={resetView}
            className="absolute top-14 right-4"
          />

          {/* Interactive Live Legend Overlay with Standardized Color Scheme */}
          {showLegendPanel && (
            <div className="absolute bottom-4 left-3 bg-black/10 backdrop-blur-md px-3 py-1.5 rounded-full drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)] text-[0.625rem] text-slate-100 flex items-center gap-2 z-20 pointer-events-auto transition-opacity opacity-50 hover:opacity-100">
              <span className="text-slate-300 font-semibold mr-1 hidden sm:inline drop-shadow-[0_0_6px_rgba(255,255,255,0.2)]">Legende:</span>
              
              {/* Bearbeitung / Cut Paths */}
              <button
                onClick={() => setShowCutPaths(prev => !prev)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                  showCutPaths 
                    ? 'drop-shadow-[0_0_6px_rgba(52,211,153,0.8)] font-medium hover:bg-white/10' 
                    : 'text-slate-400 line-through opacity-80 hover:opacity-100 hover:bg-white/5'
                }`}
                style={showCutPaths ? { color: theme.cutLineColor || '#10b981' } : undefined}
                title="Bearbeitungslinien (Schnitt / Stift / Laser) ein-/ausblenden"
              >
                <span 
                  className="w-2.5 h-1 rounded-full shadow-sm" 
                  style={{ backgroundColor: showCutPaths ? (theme.cutLineColor || '#10b981') : '#64748b' }}
                />
                <span>Bearbeitung</span>
              </button>

              {/* Leerfahrt / Eilgang (G0) */}
              <button
                onClick={() => setShowRapid(prev => !prev)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                  showRapid 
                    ? 'drop-shadow-[0_0_6px_rgba(251,113,133,0.8)] font-medium hover:bg-white/10' 
                    : 'text-slate-400 line-through opacity-80 hover:opacity-100 hover:bg-white/5'
                }`}
                style={showRapid ? { color: theme.rapidLineColor || '#ef4444' } : undefined}
                title="Leerfahrten / Eilgang (G0) ein-/ausblenden"
              >
                <span 
                  className="w-2.5 border-b-2 border-dashed" 
                  style={{ borderColor: showRapid ? (theme.rapidLineColor || '#ef4444') : '#64748b' }}
                />
                <span>Leerfahrt (G0)</span>
              </button>

              {/* Messer-Schwenkbögen (Swivel Arcs) */}
              {targetMode === 'dragknife' && (
                <button
                  onClick={() => setShowSwivelArcs(prev => !prev)}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                    showSwivelArcs 
                      ? 'text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)] font-medium hover:bg-white/10' 
                      : 'text-slate-400 line-through opacity-80 hover:opacity-100 hover:bg-white/5'
                  }`}
                  title="Messer-Schwenkbögen ein-/ausblenden"
                >
                  <span 
                    className="w-2.5 h-1 rounded-full" 
                    style={{ backgroundColor: showSwivelArcs ? '#f59e0b' : '#64748b' }}
                  />
                  <span>Schwenkbögen</span>
                </button>
              )}

              {/* Nullpunkt / Start */}
              <button
                onClick={() => setShowOriginMarker(prev => !prev)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                  showOriginMarker 
                    ? 'text-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,0.8)] font-medium hover:bg-white/10' 
                    : 'text-slate-400 line-through opacity-80 hover:opacity-100 hover:bg-white/5'
                }`}
                title="Nullpunkt-Achsen & Startpunkt-Markierung ein-/ausblenden"
              >
                <span 
                  className="w-1.5 h-1.5 rounded-full" 
                  style={{ backgroundColor: showOriginMarker ? '#10b981' : '#64748b' }}
                />
                <span>Nullpunkt (0,0)</span>
              </button>
            </div>
          )}

          {/* OVERLAY TOGGLES (Bottom Right) */}
          <div className="absolute bottom-4 right-3 flex gap-2 z-20 pointer-events-auto">
            <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 p-1 rounded-xl shadow-lg flex flex-row gap-1 overflow-x-auto max-w-[calc(100vw-2rem)]">
              <button 
                onClick={() => setShowCoordsPanel(!showCoordsPanel)}
                className={`p-1.5 rounded-lg transition-colors ${!showCoordsPanel ? 'bg-slate-800 text-slate-400 hover:text-white' : 'text-white'}`}
                style={showCoordsPanel ? { backgroundColor: theme.accentColor || '#4f46e5' } : undefined}
                title="Koordinaten ein-/ausblenden"
              >
                <Crosshair className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setShowStatsPanel(!showStatsPanel)}
                className={`p-1.5 rounded-lg transition-colors ${!showStatsPanel ? 'bg-slate-800 text-slate-400 hover:text-white' : 'text-white'}`}
                style={showStatsPanel ? { backgroundColor: theme.accentColor || '#4f46e5' } : undefined}
                title="Statistik ein-/ausblenden"
              >
                <Activity className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setShowLegendPanel(!showLegendPanel)}
                className={`p-1.5 rounded-lg transition-colors ${!showLegendPanel ? 'bg-slate-800 text-slate-400 hover:text-white' : 'text-white'}`}
                style={showLegendPanel ? { backgroundColor: theme.accentColor || '#4f46e5' } : undefined}
                title="Legende ein-/ausblenden"
              >
                <Layers className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setShowSimSlider(!showSimSlider)}
                className={`p-1.5 rounded-lg transition-colors ${!showSimSlider ? 'bg-slate-800 text-slate-400 hover:text-white' : 'text-white'}`}
                style={showSimSlider ? { backgroundColor: theme.accentColor || '#4f46e5' } : undefined}
                title="Simulation Slider ein-/ausblenden"
              >
                <Sliders className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setShowMiniJog(!showMiniJog)}
                className={`p-1.5 rounded-lg transition-colors ${!showMiniJog ? 'bg-slate-800 text-slate-400 hover:text-white' : 'text-white'}`}
                style={showMiniJog ? { backgroundColor: theme.accentColor || '#4f46e5' } : undefined}
                title="Mini-Jog ein-/ausblenden"
              >
                <Move className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* STATS PANEL */}
          {showStatsPanel && (
            <div className="absolute bottom-20 right-3 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 p-3 rounded-xl shadow-xl z-20 pointer-events-auto min-w-[200px] text-xs font-mono text-slate-300">
              <h4 className="font-bold text-white mb-2 pb-1 border-b border-slate-700">Statistik</h4>
              {(() => {
                const timeSecs = parseInt(stats.estSeconds) || 0;
                const hrs = Math.floor(timeSecs / 3600);
                const mins = Math.floor((timeSecs % 3600) / 60);
                const secs = Math.floor(timeSecs % 60);
                const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m ${secs}s`;

                return (
                  <>
                    <div className="flex justify-between py-0.5"><span>Breite x Höhe:</span> <span className="text-emerald-400 font-semibold">{stats.width} x {stats.height}</span></div>
                    <div className="flex justify-between py-0.5"><span>Tiefe (Z):</span> <span className="text-emerald-400 font-semibold">{stats.depth} mm</span></div>
                    <div className="flex justify-between py-0.5"><span>Schnittlänge:</span> <span className="text-cyan-400 font-semibold">{stats.cutLengthMm} mm</span></div>
                    <div className="flex justify-between py-0.5"><span>Eilgang/Leerfahrt:</span> <span className="text-amber-400 font-semibold">{stats.rapidLengthMm} mm</span></div>
                    <div className="flex justify-between py-0.5"><span>Werkzeuganhebungen:</span> <span className="text-rose-400 font-semibold">{stats.zRetracts}</span></div>
                    <div className="flex justify-between py-0.5 pt-2 mt-1 border-t border-slate-700"><span>Geschätzte Zeit:</span> <span className="text-white font-bold">{timeStr}</span></div>
                  </>
                );
              })()}
            </div>
          )}
          
          {/* MINI JOG CONTROLLER */}
          {showMiniJog && (
            <div className="absolute bottom-20 left-4 bg-slate-900/90 backdrop-blur-md border border-slate-700/50 p-3 rounded-2xl shadow-2xl z-40 pointer-events-auto flex flex-col gap-2">
               <div className="flex justify-between items-center mb-1 border-b border-slate-800 pb-2">
                 <h4 className="font-bold text-white text-xs">Mini-Jog</h4>
                 <button onClick={() => setShowMiniJog(false)} className="text-slate-400 hover:text-white"><X className="w-3 h-3" /></button>
               </div>
               
               {/* Step Size Selector */}
               <div className="flex justify-center gap-1 mb-1">
                 {[0.1, 1, 10].map(step => (
                   <button
                     key={step}
                     onClick={() => setJogStep(step)}
                     className={`px-2 py-0.5 rounded text-[0.6rem] font-bold transition-colors border ${
                       jogStep === step 
                         ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm' 
                         : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                     }`}
                   >
                     {step}mm
                   </button>
                 ))}
               </div>

               <div className="grid grid-cols-3 gap-1 place-items-center">
                 <div />
                 <button onClick={() => grbl.jog('Y', jogStep, currentProfile.travelFeedrate)} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-white active:bg-indigo-600 transition-colors"><ChevronUp className="w-5 h-5" /></button>
                 <div />
                 <button onClick={() => grbl.jog('X', -jogStep, currentProfile.travelFeedrate)} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-white active:bg-indigo-600 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                 <button onClick={() => grbl.send('G90 G0 X0 Y0')} className="p-3 bg-indigo-900/50 hover:bg-indigo-700 rounded-xl text-indigo-200 active:bg-indigo-500 transition-colors"><Target className="w-5 h-5" /></button>
                 <button onClick={() => grbl.jog('X', jogStep, currentProfile.travelFeedrate)} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-white active:bg-indigo-600 transition-colors"><ChevronRight className="w-5 h-5" /></button>
                 <div />
                 <button onClick={() => grbl.jog('Y', -jogStep, currentProfile.travelFeedrate)} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-white active:bg-indigo-600 transition-colors"><ChevronDown className="w-5 h-5" /></button>
                 <div />
               </div>
               <div className="flex gap-2 justify-center mt-2 border-t border-slate-800 pt-2">
                 <button onClick={() => grbl.jog('Z', jogStep, currentProfile.travelFeedrate)} className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-white font-bold text-xs flex justify-center items-center gap-1 active:bg-indigo-600 transition-colors"><ChevronUp className="w-3 h-3"/> Z+</button>
                 <button onClick={() => grbl.jog('Z', -jogStep, currentProfile.travelFeedrate)} className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-white font-bold text-xs flex justify-center items-center gap-1 active:bg-indigo-600 transition-colors"><ChevronDown className="w-3 h-3"/> Z-</button>
               </div>
            </div>
          )}

        </div>
      </div>
      </div>
      {/* ========================================================================= */}
      {/* MODAL: Full G-Code Viewer & Code Inspector                                */}
      {/* ========================================================================= */}
      {showGcodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col text-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-slate-100 text-sm">Generierter G-Code Quelltext ({targetMode})</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyGcode}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs flex items-center gap-1 transition-colors"
                >
                  {copiedGcode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedGcode ? 'Kopiert!' : 'Kopieren'}</span>
                </button>
                <button
                  onClick={() => setShowGcodeModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-950 font-mono text-xs text-slate-300 select-text leading-relaxed">
              <pre>{generatedGcode}</pre>
            </div>

            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
              <span>{generatedGcode.split('\n').length} Zeilen generiert</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Image Trace Lightbox & High-Resolution Inspection (USER REQUEST)   */}
      {/* ========================================================================= */}
      {showImageLightbox && rasterImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                    <span>Echtbildvorschau & Filter-Vergleich</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-700 text-cyan-300 font-mono font-normal">
                      {rasterImage.width} × {rasterImage.height} px
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono truncate max-w-md">
                    {rasterImageName}
                  </p>
                </div>
              </div>

              {/* View Selector & Zoom Controls */}
              <div className="flex items-center gap-3">
                {/* View Mode Buttons */}
                <div className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
                  <button
                    onClick={() => setLightboxView('vectors')}
                    className={`px-3 py-1 rounded-md font-medium transition-colors ${
                      lightboxView === 'vectors' ? 'bg-cyan-600 text-white shadow font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ✨ Vektor-Pfade
                  </button>
                  <button
                    onClick={() => setLightboxView('split')}
                    className={`px-3 py-1 rounded-md font-medium transition-colors ${
                      lightboxView === 'split' ? 'bg-indigo-600 text-white shadow font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Vergleich (Split)
                  </button>
                  <button
                    onClick={() => setLightboxView('processed')}
                    className={`px-3 py-1 rounded-md font-medium transition-colors ${
                      lightboxView === 'processed' ? 'bg-indigo-600 text-white shadow font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    SW-Schwelle
                  </button>
                  <button
                    onClick={() => setLightboxView('original')}
                    className={`px-3 py-1 rounded-md font-medium transition-colors ${
                      lightboxView === 'original' ? 'bg-slate-700 text-white shadow font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Original
                  </button>
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800 text-xs font-mono">
                  <button
                    onClick={() => setLightboxZoom(z => Math.max(0.25, Number((z - 0.2).toFixed(2))))}
                    className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 rounded font-bold"
                    title="Herauszoomen"
                  >
                    -
                  </button>
                  <span className="w-12 text-center text-cyan-300 font-bold">{Math.round(lightboxZoom * 100)}%</span>
                  <button
                    onClick={() => setLightboxZoom(z => Math.min(4, Number((z + 0.2).toFixed(2))))}
                    className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 rounded font-bold"
                    title="Heranzoomen"
                  >
                    +
                  </button>
                  <button
                    onClick={() => setLightboxZoom(1)}
                    className={`px-2 py-0.5 text-[0.625rem] rounded ml-1 transition-colors ${
                      lightboxZoom === 1 ? 'bg-cyan-600/40 text-cyan-200 border border-cyan-500/50' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                    title="Zoom auf 100% Einpassen zurücksetzen"
                  >
                    Einpassen
                  </button>
                </div>

                {/* Close Button */}
                <button
                  onClick={() => setShowImageLightbox(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                  title="Schließen"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Main Stage: Image Viewport + Live Filter Sidepanel */}
            <div className="flex-1 flex overflow-hidden">
              {/* Image Viewport Canvas Container: Perfectly centered and sized to fill the available space */}
              <div className="flex-1 relative bg-slate-950/90 overflow-hidden flex items-center justify-center p-3 sm:p-4 select-none">
                <div 
                  className="w-full h-full flex items-center justify-center transition-transform duration-100 ease-out"
                  style={{ transform: `scale(${lightboxZoom})`, transformOrigin: 'center center' }}
                >
                  {lightboxView === 'vectors' && (
                    <canvas
                      ref={lightboxVectorCanvasRef}
                      className="rounded-lg shadow-2xl border border-cyan-500/60 object-contain block max-w-full max-h-full"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        width: 'auto',
                        height: 'auto',
                      }}
                    />
                  )}

                  {lightboxView === 'original' && (
                    <img
                      src={rasterImage.src}
                      alt="Original Groß"
                      className="rounded-lg shadow-2xl border border-slate-800 object-contain block max-w-full max-h-full"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        width: 'auto',
                        height: 'auto',
                      }}
                    />
                  )}

                  {lightboxView === 'processed' && (
                    <canvas
                      ref={lightboxCanvasRef}
                      className="rounded-lg shadow-2xl border border-cyan-800/80 object-contain block max-w-full max-h-full"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        width: 'auto',
                        height: 'auto',
                      }}
                    />
                  )}

                  {lightboxView === 'split' && (
                    <div 
                      className="relative rounded-lg overflow-hidden shadow-2xl border border-slate-700 flex items-center justify-center max-w-full max-h-full"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                      }}
                    >
                      {/* Processed in background */}
                      <canvas
                        ref={lightboxCanvasRef}
                        className="block rounded-lg object-contain max-w-full max-h-full"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          width: 'auto',
                          height: 'auto',
                        }}
                      />
                      {/* Original on top, clipped by split position */}
                      <div 
                        className="absolute inset-0 overflow-hidden pointer-events-none"
                        style={{ clipPath: `inset(0 ${100 - lightboxSplitPos}% 0 0)` }}
                      >
                        <img
                          src={rasterImage.src}
                          alt="Original"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      {/* Split Divider line */}
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.8)] pointer-events-none"
                        style={{ left: `${lightboxSplitPos}%` }}
                      >
                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-cyan-500 text-black flex items-center justify-center font-bold text-[0.625rem] shadow-lg">
                          ↔
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Split slider overlay when in split mode */}
                {lightboxView === 'split' && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/20 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-3 z-10 font-mono text-xs opacity-50 hover:opacity-100 transition-opacity pointer-events-auto shadow-md border border-white/5">
                    <span className="text-slate-200 font-semibold drop-shadow-sm">Original</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={lightboxSplitPos}
                      onChange={(e) => setLightboxSplitPos(Number(e.target.value))}
                      className="w-48 accent-cyan-400 h-1.5 bg-black/40 rounded-full cursor-ew-resize hover:h-2 transition-all"
                    />
                    <span className="text-cyan-300 font-semibold drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]">SW-Schwelle</span>
                  </div>
                )}

                {/* Transparency slider overlay when in vector mode */}
                {lightboxView === 'vectors' && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/20 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-3 z-10 font-mono text-xs opacity-50 hover:opacity-100 transition-opacity pointer-events-auto shadow-md border border-white/5">
                    <span className="text-slate-200 font-semibold flex items-center gap-1.5 drop-shadow-sm">
                      <Layers className="w-3.5 h-3.5 text-cyan-400 drop-shadow-[0_0_3px_rgba(34,211,238,0.8)]" />
                      <span>Originalbild-Transparenz:</span>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={tracerBgOpacity}
                      onChange={(e) => setTracerBgOpacity(Number(e.target.value))}
                      className="w-36 sm:w-48 accent-cyan-400 h-1.5 bg-black/40 rounded-full cursor-pointer hover:h-2 transition-all"
                      title="Deckkraft des Originalbildes im Hintergrund der Pfadansicht"
                    />
                    <span className="text-cyan-300 font-bold w-10 text-right drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]">{tracerBgOpacity}%</span>
                  </div>
                )}
              </div>

              {/* Sidepanel with all live filter dials and complete feature set */}
              <div className="w-80 sm:w-88 bg-slate-950 border-l border-slate-800 p-4 overflow-y-auto space-y-3.5 text-xs">
                {/* 1. Header with Auto-Otsu */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2 text-slate-200 font-bold">
                    <SlidersIcon className="w-4 h-4 text-cyan-400" />
                    <span>Echtzeit-Parameter</span>
                  </div>
                  <button
                    onClick={handleAutoOtsuThreshold}
                    className="px-2 py-1 bg-cyan-600/30 hover:bg-cyan-600 border border-cyan-500/50 text-cyan-200 rounded text-[0.625rem] font-medium flex items-center gap-1 transition-colors shadow-sm"
                    title="Optimalen Schwellenwert automatisch ermitteln"
                  >
                    <Wand2 className="w-3 h-3 text-cyan-300" />
                    <span>⚡ Auto-Otsu</span>
                  </button>
                </div>

                {/* 2. Zielabmessungen & Skalierung (Ganz oben) */}
                <div className="space-y-2 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 font-mono text-[0.625rem]">
                  <div className="flex items-center justify-between text-slate-300 font-semibold border-b border-slate-800 pb-1">
                    <span className="flex items-center gap-1.5 font-bold text-slate-200">
                      <Ruler className="w-3.5 h-3.5 text-cyan-400" />
                      Zielabmessungen
                    </span>
                    <button
                      onClick={() => setRasterLockAspect(!rasterLockAspect)}
                      className={`px-2 py-0.5 rounded flex items-center gap-1 text-[0.625rem] font-semibold border transition-all ${
                        rasterLockAspect
                          ? 'bg-cyan-600/30 text-cyan-200 border-cyan-500/50'
                          : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                      }`}
                      title={rasterLockAspect ? 'Seitenverhältnis gesperrt (proportional)' : 'Seitenverhältnis frei (verzerrbar)'}
                    >
                      {rasterLockAspect ? <Lock className="w-3 h-3 text-cyan-400" /> : <Unlock className="w-3 h-3 text-slate-400" />}
                      <span>{rasterLockAspect ? 'Proportional' : 'Frei'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <div className="space-y-1">
                      <span className="text-slate-400">Breite (mm):</span>
                      <input
                        type="number"
                        min={1}
                        max={2000}
                        value={rasterSettings.targetWidth}
                        onChange={(e) => handleRasterWidthChange(Number(e.target.value))}
                        className="w-full bg-slate-950 px-2 py-1 rounded border border-slate-700 text-cyan-200 font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-400">Höhe (mm):</span>
                      <input
                        type="number"
                        min={1}
                        max={2000}
                        value={rasterSettings.targetHeight || Math.round(rasterSettings.targetWidth * ((rasterImage?.height || 1) / (rasterImage?.width || 1)))}
                        onChange={(e) => handleRasterHeightChange(Number(e.target.value))}
                        className="w-full bg-slate-950 px-2 py-1 rounded border border-slate-700 text-cyan-200 font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Hintergrundbild-Transparenz */}
                <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 font-mono text-[0.6875rem]">
                  <div className="flex justify-between text-slate-300 font-medium">
                    <span className="flex items-center gap-1.5 text-cyan-300 font-semibold">
                      <Layers className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Originalbild im Hintergrund:</span>
                    </span>
                    <span className="font-mono text-cyan-400 font-bold">{tracerBgOpacity}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={tracerBgOpacity}
                    onChange={(e) => setTracerBgOpacity(Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                    title="Deckkraft des Originalbildes im Hintergrund der Pfadansicht"
                  />
                  <div className="flex justify-between text-[0.5625rem] text-slate-500">
                    <span>0% (Nur Vektoren)</span>
                    <span>100% (Voll überlagert)</span>
                  </div>
                </div>

                {/* 4. Vektorisierungs- & Schraffur-Modi (Alle 6 Modi) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 text-[0.6875rem] font-bold flex items-center gap-1.5">
                      <Workflow className="w-3.5 h-3.5 text-cyan-400" />
                      Vektorisierungs-Verfahren:
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { 
                        id: 'contour_trace', 
                        label: '🔍 Outline-Kontur', 
                        desc: 'Edge-Detection für Logos, Silhouetten & Schriften',
                        accent: 'border-cyan-500 text-cyan-200 bg-cyan-950/40' 
                      },
                      { 
                        id: 'centerline_trace', 
                        label: '🖋️ Mittellinie', 
                        desc: 'Zhang-Suen Skelettierung für Handschrift & 1-Strich Linien',
                        accent: 'border-amber-500 text-amber-200 bg-amber-950/40' 
                      },
                      { 
                        id: 'hatch_linear', 
                        label: 'Linien-Schraffur', 
                        desc: 'Gleichmäßige parallele Linien',
                        accent: 'border-indigo-500 text-indigo-200 bg-indigo-950/40' 
                      },
                      { 
                        id: 'cross_hatch', 
                        label: 'Kreuz-Schraffur', 
                        desc: '2 überlagerte Schraffurlagen',
                        accent: 'border-indigo-500 text-indigo-200 bg-indigo-950/40' 
                      },
                      { 
                        id: 'stipple_dither', 
                        label: 'Dithering / Punkte', 
                        desc: 'Stippling-Punkte für Farbverläufe',
                        accent: 'border-purple-500 text-purple-200 bg-purple-950/40' 
                      },
                      { 
                        id: 'spiral_wave', 
                        label: 'Wellen-Kurven', 
                        desc: 'Sinusförmige Wellenlinien',
                        accent: 'border-purple-500 text-purple-200 bg-purple-950/40' 
                      },
                    ].map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setRasterSettings(s => ({ ...s, mode: m.id as any }))}
                        className={`p-2 rounded-lg border text-left text-[0.625rem] transition-all flex flex-col justify-between ${
                          rasterSettings.mode === m.id
                            ? `${m.accent} ring-1 font-semibold shadow-sm`
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                        }`}
                        title={m.desc}
                      >
                        <span className="font-semibold text-slate-100">{m.label}</span>
                        <span className="text-[0.5625rem] text-slate-500 line-clamp-1 mt-0.5">{m.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. MUSTERFÜLLUNG (Infill) wenn Outline-Kontur aktiv */}
                {rasterSettings.mode === 'contour_trace' && (
                  <div className="space-y-2 bg-gradient-to-br from-cyan-950/40 to-slate-900/90 p-2.5 rounded-lg border border-cyan-500/30 font-mono text-[0.625rem]">
                    <div className="flex items-center justify-between border-b border-cyan-500/20 pb-1">
                      <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                        <GridIcon className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Musterfüllung (Infill):</span>
                      </span>
                      <span className="text-[0.5625rem] text-cyan-400/80 font-bold">
                        {rasterSettings.fillPattern && rasterSettings.fillPattern !== 'none' ? 'Aktiv' : 'Keine'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1 pt-0.5">
                      {[
                        { id: 'none', label: '🚫 Nur Kontur' },
                        { id: 'lines', label: '📐 Linien' },
                        { id: 'crosshatch', label: '✖️ Kreuzschraffur' },
                        { id: 'concentric', label: '⭕ Konzentrisch' },
                        { id: 'zigzag', label: '⚡ Zickzack' },
                        { id: 'dots', label: '░ Punkte / Dither' },
                        { id: 'wave', label: '〰️ Wellenmuster' },
                      ].map((pat) => (
                        <button
                          key={pat.id}
                          onClick={() => setRasterSettings(s => ({ ...s, fillPattern: pat.id as any }))}
                          className={`px-2 py-1 rounded text-[0.5625rem] font-semibold border transition-all text-left truncate ${
                            (rasterSettings.fillPattern || 'none') === pat.id
                              ? 'bg-cyan-600 text-white border-cyan-400 shadow-sm'
                              : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {pat.label}
                        </button>
                      ))}
                    </div>

                    {rasterSettings.fillPattern && rasterSettings.fillPattern !== 'none' && (
                      <div className="space-y-2 pt-1 border-t border-cyan-500/20">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300">Linienabstand:</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="range"
                              min={0.5}
                              max={8.0}
                              step={0.25}
                              value={rasterSettings.fillSpacing ?? 2.0}
                              onChange={(e) => setRasterSettings(s => ({ ...s, fillSpacing: Number(e.target.value) }))}
                              className="w-20 accent-cyan-400"
                            />
                            <span className="text-cyan-300 w-10 text-right font-bold">{(rasterSettings.fillSpacing ?? 2.0).toFixed(1)} mm</span>
                          </div>
                        </div>

                        {rasterSettings.fillPattern !== 'concentric' && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-300">Schraffur-Winkel:</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="range"
                                min={0}
                                max={180}
                                step={5}
                                value={rasterSettings.fillAngle ?? 45}
                                onChange={(e) => setRasterSettings(s => ({ ...s, fillAngle: Number(e.target.value) }))}
                                className="w-20 accent-cyan-400"
                              />
                              <span className="text-cyan-300 w-10 text-right font-bold">{rasterSettings.fillAngle ?? 45}°</span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-cyan-500/20">
                          <span className="text-slate-300">Außenkontur behalten:</span>
                          <button
                            onClick={() => setRasterSettings(s => ({ ...s, fillIncludeContour: !(s.fillIncludeContour ?? true) }))}
                            className={`px-2 py-0.5 rounded text-[0.5625rem] font-semibold border transition-all ${
                              (rasterSettings.fillIncludeContour ?? true)
                                ? 'bg-cyan-600 text-white border-cyan-400 shadow-sm'
                                : 'bg-slate-900 border-slate-700 text-slate-400'
                            }`}
                          >
                            {(rasterSettings.fillIncludeContour ?? true) ? 'Ja (Kontur + Füllung)' : 'Nur Füllmuster'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 6. SPEZIFISCHE PARAMETER FÜR SCHRAFFUR / DITHER / WELLEN */}
                {(rasterSettings.mode === 'hatch_linear' || rasterSettings.mode === 'cross_hatch') && (
                  <div className="space-y-2 bg-slate-900/80 p-2.5 rounded-lg border border-indigo-500/30 font-mono text-[0.625rem]">
                    <div className="flex items-center justify-between border-b border-indigo-500/20 pb-1">
                      <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                        <SlidersIcon className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Schraffur-Parameter:</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Linienabstand / Dichte:</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="range"
                          min={0.5}
                          max={8}
                          step={0.5}
                          value={rasterSettings.resolution}
                          onChange={(e) => setRasterSettings(s => ({ ...s, resolution: Number(e.target.value) }))}
                          className="w-20 accent-indigo-400"
                        />
                        <span className="text-indigo-300 w-10 text-right font-bold">{rasterSettings.resolution} L/mm</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Schraffur-Winkel:</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="range"
                          min={0}
                          max={180}
                          step={5}
                          value={rasterSettings.angle}
                          onChange={(e) => setRasterSettings(s => ({ ...s, angle: Number(e.target.value) }))}
                          className="w-20 accent-indigo-400"
                        />
                        <span className="text-indigo-300 w-10 text-right font-bold">{rasterSettings.angle}°</span>
                      </div>
                    </div>
                  </div>
                )}

                {rasterSettings.mode === 'stipple_dither' && (
                  <div className="space-y-2 bg-slate-900/80 p-2.5 rounded-lg border border-purple-500/30 font-mono text-[0.625rem]">
                    <div className="flex items-center justify-between border-b border-purple-500/20 pb-1">
                      <span className="font-bold text-purple-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        <span>Stippling / Dither Parameter:</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Punkt-Dichte:</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="range"
                          min={1}
                          max={8}
                          step={0.5}
                          value={rasterSettings.resolution}
                          onChange={(e) => setRasterSettings(s => ({ ...s, resolution: Number(e.target.value) }))}
                          className="w-20 accent-purple-400"
                        />
                        <span className="text-purple-300 w-10 text-right font-bold">{rasterSettings.resolution} P/mm</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Punkt-Brenndauer:</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="range"
                          min={10}
                          max={200}
                          step={10}
                          value={rasterSettings.stippleDotDurationMs}
                          onChange={(e) => setRasterSettings(s => ({ ...s, stippleDotDurationMs: Number(e.target.value) }))}
                          className="w-20 accent-purple-400"
                        />
                        <span className="text-purple-300 w-10 text-right font-bold">{rasterSettings.stippleDotDurationMs} ms</span>
                      </div>
                    </div>
                  </div>
                )}

                {rasterSettings.mode === 'spiral_wave' && (
                  <div className="space-y-2 bg-slate-900/80 p-2.5 rounded-lg border border-purple-500/30 font-mono text-[0.625rem]">
                    <div className="flex items-center justify-between border-b border-purple-500/20 pb-1">
                      <span className="font-bold text-purple-300 flex items-center gap-1.5">
                        <Spline className="w-3.5 h-3.5 text-purple-400" />
                        <span>Wellen-Parameter:</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Wellen-Dichte:</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="range"
                          min={1}
                          max={8}
                          step={0.5}
                          value={rasterSettings.resolution}
                          onChange={(e) => setRasterSettings(s => ({ ...s, resolution: Number(e.target.value) }))}
                          className="w-20 accent-purple-400"
                        />
                        <span className="text-purple-300 w-10 text-right font-bold">{rasterSettings.resolution} L/mm</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Wellen-Intensität:</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="range"
                          min={0.2}
                          max={3.0}
                          step={0.1}
                          value={rasterSettings.spiralTightness}
                          onChange={(e) => setRasterSettings(s => ({ ...s, spiralTightness: Number(e.target.value) }))}
                          className="w-20 accent-purple-400"
                        />
                        <span className="text-purple-300 w-10 text-right font-bold">{rasterSettings.spiralTightness.toFixed(1)}x</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 7. Kern-Parameter: Schwellenwert, Detailgrad, Kantenglättung */}
                <div className="space-y-2.5 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 font-mono text-[0.625rem]">
                  {/* Threshold */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-semibold">SW-Schwellenwert:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={1}
                        max={254}
                        value={rasterSettings.threshold}
                        onChange={(e) => setRasterSettings(s => ({ ...s, threshold: Number(e.target.value) }))}
                        className="w-24 accent-cyan-400"
                      />
                      <span className="text-cyan-300 w-8 text-right font-bold">{rasterSettings.threshold}</span>
                    </div>
                  </div>

                  {/* Detailgrad / Feinschrift & Kleindetails Slider */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                    <div className="flex flex-col">
                      <span className="text-amber-300 font-semibold flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>Detailgrad (Feinschrift):</span>
                      </span>
                      <span className="text-[0.5625rem] text-slate-500">1: Filter | 10: Max Details</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={1}
                        max={10}
                        step={1}
                        value={rasterSettings.detailSensitivity ?? 5}
                        onChange={(e) => setRasterSettings(s => ({ ...s, detailSensitivity: Number(e.target.value) }))}
                        className="w-24 accent-amber-400"
                        title="Erhöht die Auflösung und Erkennungsgenauigkeit für winzige Texte, Zahlen und Feinheiten"
                      />
                      <span className="text-amber-300 w-12 text-right font-bold">Stufe {rasterSettings.detailSensitivity ?? 5}</span>
                    </div>
                  </div>

                  {/* Douglas Peucker Smoothing Prominent */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                    <div className="flex flex-col">
                      <span className="text-emerald-300 font-semibold flex items-center gap-1">
                        <Spline className="w-3 h-3 text-emerald-400" />
                        <span>Kantenglättung:</span>
                      </span>
                      <span className="text-[0.5625rem] text-slate-500">Douglas-Peucker</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0.05}
                        max={3.0}
                        step={0.05}
                        value={rasterSettings.simplificationTolerance ?? 0.25}
                        onChange={(e) => setRasterSettings(s => ({ ...s, simplificationTolerance: Number(e.target.value) }))}
                        className="w-24 accent-emerald-400"
                      />
                      <span className="text-emerald-300 w-12 text-right font-bold">{(rasterSettings.simplificationTolerance ?? 0.25).toFixed(2)} mm</span>
                    </div>
                  </div>
                </div>

                {/* 8. Progressive Disclosure Accordion: ⚙️ Erweiterte Einstellungen */}
                <div className="border border-slate-800 rounded-lg overflow-hidden font-mono text-[0.625rem] bg-slate-950/40">
                  <button
                    onClick={() => setShowLightboxAdvanced(!showLightboxAdvanced)}
                    className="w-full px-3 py-2 bg-slate-900/90 hover:bg-slate-800/90 flex items-center justify-between text-slate-300 font-medium transition-colors"
                  >
                    <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                      <span>⚙️ Erweiterte Einstellungen</span>
                    </span>
                    {showLightboxAdvanced ? <ChevronUp className="w-4 h-4 text-cyan-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>

                  {showLightboxAdvanced && (
                    <div className="p-2.5 space-y-3 bg-slate-900/40 border-t border-slate-800/80">
                      {/* Blur Pre-Filter */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400" title="Glättet Pixelstufen und Rauschen vor dem Vektorisieren">Weichzeichner (Blur):</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={0}
                            max={6}
                            step={1}
                            value={rasterSettings.blurRadius ?? 1}
                            onChange={(e) => setRasterSettings(s => ({ ...s, blurRadius: Number(e.target.value) }))}
                            className="w-24 accent-indigo-400"
                          />
                          <span className="text-indigo-300 w-10 text-right font-bold">{rasterSettings.blurRadius ?? 1} px</span>
                        </div>
                      </div>

                      {/* Min Path Length Filter */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400" title="Filtert winzige Staub-Artefakte und Flecken unterhalb dieser Länge heraus">Min. Pfadlänge:</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={0.0}
                            max={15.0}
                            step={0.2}
                            value={rasterSettings.minPathLength ?? 0.6}
                            onChange={(e) => setRasterSettings(s => ({ ...s, minPathLength: Number(e.target.value) }))}
                            className="w-24 accent-emerald-400"
                          />
                          <span className="text-emerald-300 w-10 text-right font-bold">{(rasterSettings.minPathLength ?? 0.6).toFixed(1)} mm</span>
                        </div>
                      </div>

                      {/* Small Text / Markings High-Pass Detail Booster */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                        <span className="text-slate-400 flex items-center gap-1" title="Verstärkt schwache Schriftzüge, Flugzeugkennungen und feine Linien per High-Pass Filter">
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          <span>Schrift-Boost (High-Pass):</span>
                        </span>
                        <button
                          onClick={() => setRasterSettings(s => ({ ...s, enhanceSmallText: !(s.enhanceSmallText ?? true) }))}
                          className={`px-2 py-0.5 rounded text-[0.625rem] font-semibold border transition-all ${
                            (rasterSettings.enhanceSmallText ?? true)
                              ? 'bg-amber-600 text-white border-amber-400 shadow-sm'
                              : 'bg-slate-900 border-slate-700 text-slate-400'
                          }`}
                        >
                          {(rasterSettings.enhanceSmallText ?? true) ? 'Aktiv' : 'Aus'}
                        </button>
                      </div>

                      {/* Contrast */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Kontrast:</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="-100"
                            max="100"
                            value={rasterSettings.contrast}
                            onChange={(e) => setRasterSettings(s => ({ ...s, contrast: Number(e.target.value) }))}
                            className="w-24 accent-indigo-400"
                          />
                          <span className="text-indigo-300 w-10 text-right">{rasterSettings.contrast}</span>
                        </div>
                      </div>

                      {/* Brightness */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Helligkeit:</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="-100"
                            max="100"
                            value={rasterSettings.brightness}
                            onChange={(e) => setRasterSettings(s => ({ ...s, brightness: Number(e.target.value) }))}
                            className="w-24 accent-amber-400"
                          />
                          <span className="text-amber-300 w-10 text-right">{rasterSettings.brightness}</span>
                        </div>
                      </div>

                      {/* Gamma */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Gamma:</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="0.2"
                            max="3.0"
                            step="0.05"
                            value={rasterSettings.gamma || 1.0}
                            onChange={(e) => setRasterSettings(s => ({ ...s, gamma: Number(e.target.value) }))}
                            className="w-24 accent-emerald-400"
                          />
                          <span className="text-emerald-300 w-10 text-right">{(rasterSettings.gamma || 1.0).toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Mirroring */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                        <span className="text-slate-400">Spiegeln:</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setRasterSettings(s => ({ ...s, mirrorX: !s.mirrorX }))}
                            className={`px-2 py-0.5 rounded text-[0.625rem] font-semibold border transition-all ${
                              rasterSettings.mirrorX
                                ? 'bg-cyan-600 text-white border-cyan-400'
                                : 'bg-slate-900 border-slate-700 text-slate-400'
                            }`}
                          >
                            ↔ X
                          </button>
                          <button
                            onClick={() => setRasterSettings(s => ({ ...s, mirrorY: !s.mirrorY }))}
                            className={`px-2 py-0.5 rounded text-[0.625rem] font-semibold border transition-all ${
                              rasterSettings.mirrorY
                                ? 'bg-cyan-600 text-white border-cyan-400'
                                : 'bg-slate-900 border-slate-700 text-slate-400'
                            }`}
                          >
                            ↕ Y
                          </button>
                        </div>
                      </div>

                      {/* Invert */}
                      <div className="pt-2 border-t border-slate-800">
                        <label className="flex items-center justify-between cursor-pointer py-1">
                          <span className="text-slate-300 font-medium">Farben invertieren</span>
                          <input
                            type="checkbox"
                            checked={rasterSettings.invert}
                            onChange={(e) => setRasterSettings(s => ({ ...s, invert: e.target.checked }))}
                            className="accent-indigo-500 rounded"
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Metrics in Lightbox */}
                {rawPolylines.length > 0 && (
                  <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 font-mono text-[0.625rem] space-y-1">
                    <div className="text-slate-400 font-bold flex items-center justify-between">
                      <span>Vektor-Statistik:</span>
                      <span className="text-cyan-400">{rawPolylines.length} Pfade</span>
                    </div>
                    <div className="text-slate-500 flex justify-between">
                      <span>Stützpunkte:</span>
                      <span className="text-indigo-300">{rawPolylines.reduce((acc, p) => acc + p.points.length, 0)}</span>
                    </div>
                    <div className="text-slate-500 flex justify-between">
                      <span>Gesamtlänge:</span>
                      <span className="text-emerald-300">{rawPolylines.reduce((acc, p) => acc + computePolylineLength(p.points), 0).toFixed(1)} mm</span>
                    </div>
                  </div>
                )}

                <div className="pt-2 space-y-2">
                  <button
                    onClick={() => {
                      setShowImageLightbox(false);
                      handleAddCurrentToComposition();
                    }}
                    className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>In Arbeitsfläche übernehmen</span>
                  </button>

                  <button
                    onClick={() => setShowImageLightbox(false)}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-colors"
                  >
                    Dialog schließen
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Laser Material Database                                            */}
      {/* ========================================================================= */}
      <LaserDatabaseModal
        isOpen={isLaserDbModalOpen}
        onClose={() => { if (onCloseLaserDbModal) onCloseLaserDbModal(); }}
        onApplyPreset={handleApplyMaterialPreset}
      />
    </div>
  );
};
