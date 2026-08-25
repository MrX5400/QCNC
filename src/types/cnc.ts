export type GrblStatusState = 
  | 'Idle' 
  | 'Run' 
  | 'Hold' 
  | 'Jog' 
  | 'Alarm' 
  | 'Door' 
  | 'Check' 
  | 'Home' 
  | 'Sleep' 
  | 'Disconnected';

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface GrblState {
  status: GrblStatusState;
  mpos: Point3D;
  wpos: Point3D;
  wco: Point3D;
  feedrate: number;
  spindleSpeed: number;
  bufferPlanner: number;
  bufferRx: number;
  lineExecuting: number;
  overrides: {
    feed: number;
    rapid: number;
    spindle: number;
  };
  pins: string;
  accessoryState?: string;
}

export type ActuatorType = 'servo_pwm' | 'z_stepper' | 'solenoid' | 'laser';

export interface MachineProfile {
  id: string;
  name: string;
  bedWidth: number; // mm (X max)
  bedHeight: number; // mm (Y max)
  bedDepth: number; // mm (Z travel)
  origin: 'bottom_left' | 'top_left' | 'center';
  description?: string;
  // Optional parameters / fallbacks
  actuatorType?: ActuatorType;
  penUpCommand?: string;
  penDownCommand?: string;
  penUpDelayMs?: number;
  penDownDelayMs?: number;
  penUpZ?: number;
  penDownZ?: number;
  travelFeedrate?: number;
  drawingFeedrate?: number;
  plungeFeedrate?: number;
  spindlePwmMax?: number;
  spindlePwmMin?: number;
  laserMode?: 'M3' | 'M4';
  laserPowerMax?: number;
  cuttingFeedrate?: number;
  airAssistEnabled?: boolean;
  dragKnife?: {
    enabled?: boolean;
    bladeOffset?: number;
    swivelAngleThreshold?: number;
    swivelRadius?: number;
    overcut?: number;
    feedrateSwivel?: number;
    liftOnSwivel?: boolean;
    liftAmount?: number;
    liftOnRapid?: boolean;
    rapidLiftZ?: number;
  };
}

export interface GcodeSegment {
  type: 'G0' | 'G1' | 'G2' | 'G3' | 'SWIVEL_ARC' | 'PEN_UP' | 'PEN_DOWN' | 'OTHER';
  from: Point3D;
  to: Point3D;
  center?: Point3D;
  clockwise?: boolean;
  penState: 'up' | 'down';
  feedrate?: number;
  lineIndex: number;
  raw: string;
  knifeAngle?: number; // Heading angle in radians
  isCompensated?: boolean;
  objectName?: string;
  objectIndex?: number;
}

export interface ParsedGcode {
  raw: string;
  lines: string[];
  segments: GcodeSegment[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
  cutBounds?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  stats: {
    totalLength: number; // mm
    cutLength: number; // mm
    travelLength: number; // mm
    estimatedTimeSec: number;
    penLifts: number;
    lineCount: number;
  };
}

export interface GrblSetting {
  id: string; // e.g. "$100"
  code: number; // 100
  name: string;
  description: string;
  unit: string;
  category: 'Steps' | 'Speeds & Accel' | 'Inversion' | 'Limits & Homing' | 'Spindle / Laser' | 'General';
  value: string;
  defaultValue?: string;
  options?: { value: string; label: string }[];
}

export interface VectorPath {
  id: string;
  points: { x: number; y: number }[];
  closed: boolean;
  color?: string;
}

export interface VectorEntity {
  id: string;
  type: 'path' | 'rect' | 'circle' | 'text' | 'star' | 'polygon';
  name: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  rotation?: number;
  points?: { x: number; y: number }[];
  closed?: boolean;
  selected?: boolean;
}

export type RasterMode = 
  | 'contour_trace'
  | 'centerline_trace'
  | 'hatch_linear' 
  | 'cross_hatch' 
  | 'stipple_dither' 
  | 'spiral_wave';

export type ContourFillPattern = 
  | 'none' 
  | 'lines' 
  | 'crosshatch' 
  | 'concentric' 
  | 'zigzag' 
  | 'dots' 
  | 'wave';

export interface RasterSettings {
  mode: RasterMode;
  resolution: number; // lines per mm or dots per mm (e.g. 2 - 5)
  angle: number; // degrees for hatching
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  threshold: number; // 0 to 255
  blackLevel?: number; // 0 to 255 (clip blacks)
  whiteLevel?: number; // 0 to 255 (clip whites)
  gamma?: number; // 0.2 to 3.0
  mirrorX?: boolean; // Horizontal mirror / flip
  mirrorY?: boolean; // Vertical mirror / flip
  invert: boolean;
  scaleX: number;
  scaleY: number;
  targetWidth: number; // mm
  targetHeight: number; // mm
  stippleDotDurationMs: number;
  spiralTightness: number;
  // Vector Tracing specific settings
  blurRadius?: number; // 0 to 10 px smoothing before threshold
  simplificationTolerance?: number; // Douglas-Peucker tolerance in mm (e.g. 0.1 to 1.5mm)
  minPathLength?: number; // Filter speckles / noise shorter than this length in mm
  detailSensitivity?: number; // 1 to 10 (1 = coarse/clean, 5 = balanced, 10 = maximum fine details & tiny text)
  enhanceSmallText?: boolean; // Local contrast high-pass boost for small typography and lines
  optimizeTsp?: boolean; // Reorder paths with TSP to minimize rapid moves
  // Contour Pattern Fill
  fillPattern?: ContourFillPattern;
  fillSpacing?: number; // Line / dot spacing in mm (e.g. 0.5 - 10 mm)
  fillAngle?: number; // Pattern rotation angle in degrees (0 - 180)
  fillIncludeContour?: boolean; // Retain outer/inner contour boundary path
  ignoreBorder?: boolean; // Ignore / suppress outer image border frame from being traced
}
