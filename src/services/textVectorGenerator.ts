import { Path2DPoint } from './dragKnifeCorrection';
import { VectorPolyline } from './vectorRasterGenerator';
import * as opentype from 'opentype.js';

export const OPENTYPE_FONT_CACHE: Record<string, opentype.Font | null> = {};
const FONT_LOADING: Record<string, boolean> = {};

export async function preloadFont(fontFamily: string) {
  if (OPENTYPE_FONT_CACHE[fontFamily] !== undefined || FONT_LOADING[fontFamily]) return;
  
  let fontId = fontFamily.toLowerCase().replace(/ /g, '-');
  if (fontId === 'arial') fontId = 'arimo';
  if (fontId === 'times-new-roman') fontId = 'tinos';
  if (fontId === 'courier-new') fontId = 'cousine';
  if (fontId === 'impact') fontId = 'anton';
  if (fontId === 'stencil') fontId = 'allerta-stencil';
  
  FONT_LOADING[fontFamily] = true;
  try {
    const url = `https://unpkg.com/@fontsource/${fontId}/files/${fontId}-latin-400-normal.woff`;
    const response = await fetch(url);
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      OPENTYPE_FONT_CACHE[fontFamily] = opentype.parse(buffer);
      window.dispatchEvent(new CustomEvent('fontLoaded'));
    } else {
      OPENTYPE_FONT_CACHE[fontFamily] = null;
    }
  } catch (err) {
    console.warn('Failed to load font', fontId, err);
    OPENTYPE_FONT_CACHE[fontFamily] = null;
  } finally {
    FONT_LOADING[fontFamily] = false;
  }
}

function flattenQuadraticBezier(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, tol: number): Path2DPoint[] {
  const pts: Path2DPoint[] = [{ x: x0, y: y0 }];
  
  function recurse(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, depth: number) {
    if (depth > 8) {
      pts.push({ x: x2, y: y2 });
      return;
    }
    const dx = x2 - x0;
    const dy = y2 - y0;
    const dist = Math.abs((x1 - x0) * dy - (y1 - y0) * dx) / Math.hypot(dx, dy);
    
    if (dist * 0.25 <= tol || isNaN(dist)) {
      pts.push({ x: x2, y: y2 });
      return;
    }
    
    const x01 = (x0 + x1) / 2, y01 = (y0 + y1) / 2;
    const x12 = (x1 + x2) / 2, y12 = (y1 + y2) / 2;
    const x012 = (x01 + x12) / 2, y012 = (y01 + y12) / 2;
    
    recurse(x0, y0, x01, y01, x012, y012, depth + 1);
    recurse(x012, y012, x12, y12, x2, y2, depth + 1);
  }
  
  recurse(x0, y0, x1, y1, x2, y2, 0);
  return pts;
}

function flattenCubicBezier(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, tol: number): Path2DPoint[] {
  const pts: Path2DPoint[] = [{ x: x0, y: y0 }];
  
  function recurse(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, depth: number) {
    if (depth > 8) {
      pts.push({ x: x3, y: y3 });
      return;
    }
    
    const dx = x3 - x0;
    const dy = y3 - y0;
    const len = Math.hypot(dx, dy);
    
    let d1 = 0, d2 = 0;
    if (len > 1e-5) {
      d1 = Math.abs((x1 - x0) * dy - (y1 - y0) * dx) / len;
      d2 = Math.abs((x2 - x0) * dy - (y2 - y0) * dx) / len;
    } else {
      d1 = Math.hypot(x1 - x0, y1 - y0);
      d2 = Math.hypot(x2 - x0, y2 - y0);
    }
    
    if ((d1 + d2) * 0.75 <= tol) { 
      pts.push({ x: x3, y: y3 });
      return;
    }
    
    const x01 = (x0 + x1) / 2, y01 = (y0 + y1) / 2;
    const x12 = (x1 + x2) / 2, y12 = (y1 + y2) / 2;
    const x23 = (x2 + x3) / 2, y23 = (y2 + y3) / 2;
    
    const x012 = (x01 + x12) / 2, y012 = (y01 + y12) / 2;
    const x123 = (x12 + x23) / 2, y123 = (y12 + y23) / 2;
    
    const x0123 = (x012 + x123) / 2, y0123 = (y012 + y123) / 2;
    
    recurse(x0, y0, x01, y01, x012, y012, x0123, y0123, depth + 1);
    recurse(x0123, y0123, x123, y123, x23, y23, x3, y3, depth + 1);
  }
  
  recurse(x0, y0, x1, y1, x2, y2, x3, y3, 0);
  return pts;
}

function flattenOpentypePath(path: opentype.Path, tolerance: number = 0.05): VectorPolyline[] {
  const polylines: VectorPolyline[] = [];
  let currentPoly: Path2DPoint[] = [];
  let startPt = { x: 0, y: 0 };
  let curPt = { x: 0, y: 0 };

  for (const cmd of path.commands) {
    if (cmd.type === 'M') {
      if (currentPoly.length > 1) polylines.push({ points: currentPoly, closed: false });
      currentPoly = [{ x: cmd.x, y: cmd.y }];
      startPt = { x: cmd.x, y: cmd.y };
      curPt = { x: cmd.x, y: cmd.y };
    } else if (cmd.type === 'L') {
      currentPoly.push({ x: cmd.x, y: cmd.y });
      curPt = { x: cmd.x, y: cmd.y };
    } else if (cmd.type === 'Q') {
      const qPts = flattenQuadraticBezier(curPt.x, curPt.y, cmd.x1, cmd.y1, cmd.x, cmd.y, tolerance);
      for (let i = 1; i < qPts.length; i++) currentPoly.push(qPts[i]);
      curPt = { x: cmd.x, y: cmd.y };
    } else if (cmd.type === 'C') {
      const cPts = flattenCubicBezier(curPt.x, curPt.y, cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y, tolerance);
      for (let i = 1; i < cPts.length; i++) currentPoly.push(cPts[i]);
      curPt = { x: cmd.x, y: cmd.y };
    } else if (cmd.type === 'Z') {
      currentPoly.push({ x: startPt.x, y: startPt.y });
      if (currentPoly.length > 1) polylines.push({ points: currentPoly, closed: true });
      currentPoly = [];
      curPt = { ...startPt };
    }
  }
  if (currentPoly.length > 1) polylines.push({ points: currentPoly, closed: false });
  return polylines;
}

export type TextMode = 'single_line' | 'outline';
export type TextInfillPattern = 'none' | 'hatch_linear' | 'cross_hatch' | 'zigzag' | 'concentric' | 'dots';

export interface TextGeneratorOptions {
  text: string;
  x: number;
  y: number;
  fontSize: number; // in mm
  fontFamily: string;
  fontWeight?: 'normal' | 'medium' | 'bold' | '900' | number | string;
  fontStyle?: 'normal' | 'italic';
  letterSpacing?: number; // mm
  lineSpacing?: number; // multiplier e.g. 1.2
  textAlign?: 'left' | 'center' | 'right';
  mode: TextMode; // 'single_line' | 'outline'
  
  // Infill Settings for Outline Mode
  infillPattern?: TextInfillPattern;
  infillSpacing?: number; // mm
  infillAngle?: number; // degrees
  includeOutline?: boolean; // default true
  
  // Slant and Bold Simulation for Single Line
  singleLineBold?: boolean;
  italicSlantDeg?: number; // e.g. 15 for italic slant
}

// -------------------------------------------------------------
// 1. EXTENSIVE HERSHEY SINGLE-LINE GLYPH STROKES
// -------------------------------------------------------------
// Coordinate grid is 0-8 width, 0-12 height (baseline at 0, cap-height at 12, descenders down to -3)

export const HERSHEY_SIMPLEX_GLYPHS: Record<string, number[][]> = {
  // Uppercase
  'A': [[0, 0, 4, 12], [4, 12, 8, 0], [1.5, 4, 6.5, 4]],
  'B': [[0, 0, 0, 12], [0, 12, 5, 12, 7, 10, 7, 7, 5, 6, 0, 6], [5, 6, 7, 5, 7, 2, 5, 0, 0, 0]],
  'C': [[8, 10, 6, 12, 2, 12, 0, 10, 0, 2, 2, 0, 6, 0, 8, 2]],
  'D': [[0, 0, 0, 12], [0, 12, 4, 12, 8, 8, 8, 4, 4, 0, 0, 0]],
  'E': [[0, 0, 0, 12], [0, 12, 7, 12], [0, 6, 5, 6], [0, 0, 7, 0]],
  'F': [[0, 0, 0, 12], [0, 12, 7, 12], [0, 6, 5, 6]],
  'G': [[8, 10, 6, 12, 2, 12, 0, 10, 0, 2, 2, 0, 6, 0, 8, 2, 8, 6, 4, 6]],
  'H': [[0, 0, 0, 12], [8, 0, 8, 12], [0, 6, 8, 6]],
  'I': [[2, 12, 6, 12], [4, 12, 4, 0], [2, 0, 6, 0]],
  'J': [[6, 12, 6, 3, 4, 0, 2, 0, 0, 2]],
  'K': [[0, 0, 0, 12], [7, 12, 0, 5], [2, 6.5, 7, 0]],
  'L': [[0, 12, 0, 0, 7, 0]],
  'M': [[0, 0, 0, 12, 4, 5, 8, 12, 8, 0]],
  'N': [[0, 0, 0, 12, 8, 0, 8, 12]],
  'O': [[2, 12, 6, 12, 8, 10, 8, 2, 6, 0, 2, 0, 0, 2, 0, 10, 2, 12]],
  'P': [[0, 0, 0, 12, 5, 12, 7, 10, 7, 7, 5, 5, 0, 5]],
  'Q': [[2, 12, 6, 12, 8, 10, 8, 2, 6, 0, 2, 0, 0, 2, 0, 10, 2, 12], [5, 3, 9, -2]],
  'R': [[0, 0, 0, 12, 5, 12, 7, 10, 7, 7, 5, 5, 0, 5], [3, 5, 8, 0]],
  'S': [[8, 10, 6, 12, 2, 12, 0, 10, 0, 7, 2, 6, 6, 5, 8, 4, 8, 2, 6, 0, 2, 0, 0, 2]],
  'T': [[0, 12, 8, 12], [4, 12, 4, 0]],
  'U': [[0, 12, 0, 3, 2, 0, 6, 0, 8, 3, 8, 12]],
  'V': [[0, 12, 4, 0, 8, 12]],
  'W': [[0, 12, 2, 0, 4, 7, 6, 0, 8, 12]],
  'X': [[0, 12, 8, 0], [0, 0, 8, 12]],
  'Y': [[0, 12, 4, 6, 4, 0], [8, 12, 4, 6]],
  'Z': [[0, 12, 8, 12, 0, 0, 8, 0]],

  // Lowercase
  'a': [[6, 6, 4, 8, 2, 8, 0, 6, 0, 2, 2, 0, 5, 0, 6, 2], [6, 8, 6, 0]],
  'b': [[0, 12, 0, 0], [0, 5, 2, 8, 5, 8, 7, 5, 7, 3, 5, 0, 2, 0, 0, 3]],
  'c': [[6, 6, 4, 8, 2, 8, 0, 6, 0, 2, 2, 0, 5, 0, 7, 2]],
  'd': [[7, 12, 7, 0], [7, 3, 5, 0, 2, 0, 0, 3, 0, 5, 2, 8, 5, 8, 7, 5]],
  'e': [[0, 4, 7, 4, 7, 6, 5, 8, 2, 8, 0, 6, 0, 2, 2, 0, 5, 0, 7, 2]],
  'f': [[2, 0, 2, 10, 4, 12, 6, 12], [0, 7, 5, 7]],
  'g': [[7, 0, 7, 6, 5, 8, 2, 8, 0, 6, 0, 2, 2, 0, 5, 0, 7, 2], [7, 7, 7, -2, 5, -4, 2, -4, 0, -2]],
  'h': [[0, 12, 0, 0], [0, 5, 2, 8, 5, 8, 7, 6, 7, 0]],
  'i': [[3, 7, 3, 0], [3, 10, 3.5, 10]],
  'j': [[4, 7, 4, -2, 2, -4, 0, -3], [4, 10, 4.5, 10]],
  'k': [[0, 12, 0, 0], [6, 8, 0, 3], [2, 4.5, 6, 0]],
  'l': [[2, 12, 2, 0]],
  'm': [[0, 0, 0, 8], [0, 6, 2, 8, 4, 8, 4, 0], [4, 6, 6, 8, 8, 8, 8, 0]],
  'n': [[0, 0, 0, 8], [0, 5, 2, 8, 5, 8, 7, 6, 7, 0]],
  'o': [[2, 8, 5, 8, 7, 6, 7, 2, 5, 0, 2, 0, 0, 2, 0, 6, 2, 8]],
  'p': [[0, 8, 0, -4], [0, 5, 2, 8, 5, 8, 7, 5, 7, 3, 5, 0, 2, 0, 0, 3]],
  'q': [[7, 8, 7, -4], [7, 3, 5, 0, 2, 0, 0, 3, 0, 5, 2, 8, 5, 8, 7, 5]],
  'r': [[0, 0, 0, 8], [0, 5, 2, 8, 5, 8, 7, 7]],
  's': [[6, 7, 4, 8, 1, 8, 0, 6, 2, 5, 5, 4, 7, 3, 6, 0, 2, 0, 0, 1]],
  't': [[2, 11, 2, 1, 4, 0, 6, 0], [0, 8, 5, 8]],
  'u': [[0, 8, 0, 2, 2, 0, 5, 0, 7, 2, 7, 8], [7, 3, 7, 0]],
  'v': [[0, 8, 3.5, 0, 7, 8]],
  'w': [[0, 8, 2, 0, 3.5, 5, 5, 0, 7, 8]],
  'x': [[0, 8, 7, 0], [0, 0, 7, 8]],
  'y': [[0, 8, 3.5, 2, 7, 8], [3.5, 2, 1, -4, -1, -3]],
  'z': [[0, 8, 7, 8, 0, 0, 7, 0]],

  // German Umlauts & Special
  'Ä': [[0, 0, 4, 12], [4, 12, 8, 0], [1.5, 4, 6.5, 4], [2, 14, 2.5, 14], [5.5, 14, 6, 14]],
  'Ö': [[2, 12, 6, 12, 8, 10, 8, 2, 6, 0, 2, 0, 0, 2, 0, 10, 2, 12], [2, 14, 2.5, 14], [5.5, 14, 6, 14]],
  'Ü': [[0, 12, 0, 3, 2, 0, 6, 0, 8, 3, 8, 12], [2, 14, 2.5, 14], [6, 14, 6.5, 14]],
  'ä': [[6, 6, 4, 8, 2, 8, 0, 6, 0, 2, 2, 0, 5, 0, 6, 2], [6, 8, 6, 0], [1.5, 10.5, 2, 10.5], [4.5, 10.5, 5, 10.5]],
  'ö': [[2, 8, 5, 8, 7, 6, 7, 2, 5, 0, 2, 0, 0, 2, 0, 6, 2, 8], [1.5, 10.5, 2, 10.5], [4.5, 10.5, 5, 10.5]],
  'ü': [[0, 8, 0, 2, 2, 0, 5, 0, 7, 2, 7, 8], [7, 3, 7, 0], [1.5, 10.5, 2, 10.5], [5.5, 10.5, 6, 10.5]],
  'ß': [[0, -2, 0, 12], [0, 12, 4, 12, 6, 10, 6, 7, 4, 6, 0, 6], [4, 6, 6, 5, 7, 3, 6, 0, 3, -1, 0, 0]],

  // Numbers
  '0': [[2, 12, 6, 12, 8, 10, 8, 2, 6, 0, 2, 0, 0, 2, 0, 10, 2, 12], [7, 10, 1, 2]],
  '1': [[1, 9, 4, 12, 4, 0], [1, 0, 7, 0]],
  '2': [[0, 10, 2, 12, 6, 12, 8, 10, 8, 7, 0, 0, 8, 0]],
  '3': [[0, 12, 8, 12, 4, 7, 7, 5, 7, 2, 5, 0, 1, 0]],
  '4': [[6, 0, 6, 12, 0, 4, 8, 4]],
  '5': [[8, 12, 0, 12, 0, 7, 6, 7, 8, 5, 8, 2, 6, 0, 1, 0]],
  '6': [[7, 11, 4, 12, 1, 9, 0, 5, 0, 2, 2, 0, 6, 0, 8, 2, 8, 5, 6, 7, 0, 7]],
  '7': [[0, 12, 8, 12, 3, 0]],
  '8': [[4, 6, 2, 6, 0, 8, 0, 10, 2, 12, 6, 12, 8, 10, 8, 8, 6, 6, 4, 6], [4, 6, 2, 6, 0, 4, 0, 2, 2, 0, 6, 0, 8, 2, 8, 4, 6, 6, 4, 6]],
  '9': [[8, 5, 2, 5, 0, 7, 0, 10, 2, 12, 6, 12, 8, 10, 8, 2, 6, 0, 2, 0, 0, 2]],

  // Symbols & Punctuation
  '.': [[3.5, 0, 4.5, 0]],
  ',': [[4, 0, 2, -2]],
  ':': [[4, 3, 4, 3.5], [4, 8, 4, 8.5]],
  ';': [[4, 8, 4, 8.5], [4, 2, 2, -1]],
  '-': [[1, 6, 7, 6]],
  '_': [[0, 0, 8, 0]],
  '+': [[1, 6, 7, 6], [4, 3, 4, 9]],
  '=': [[1, 7.5, 7, 7.5], [1, 4.5, 7, 4.5]],
  '*': [[4, 3, 4, 9], [1.5, 4.5, 6.5, 7.5], [1.5, 7.5, 6.5, 4.5]],
  '/': [[0, 0, 8, 12]],
  '\\': [[0, 12, 8, 0]],
  '|': [[4, 12, 4, 0]],
  '!': [[4, 12, 4, 4], [4, 1, 4, 0]],
  '?': [[1, 9, 3, 12, 6, 12, 7, 10, 7, 7, 4, 5, 4, 3], [4, 1, 4, 0]],
  '#': [[2, 0, 2, 12], [6, 0, 6, 12], [0, 4, 8, 4], [0, 8, 8, 8]],
  '%': [[1, 10, 3, 10, 3, 12, 1, 12, 1, 10], [0, 0, 8, 12], [5, 0, 7, 0, 7, 2, 5, 2, 5, 0]],
  '&': [[8, 0, 3, 7, 3, 10, 5, 12, 6, 10, 5, 8, 0, 3, 0, 1, 2, 0, 6, 0, 8, 3]],
  '@': [[6, 3, 4, 3, 3, 5, 5, 5, 5, 2, 3, 0, 1, 2, 1, 9, 3, 11, 7, 11, 8, 8, 8, 2]],
  '$': [[4, 13, 4, -1], [7, 10, 5, 12, 3, 12, 1, 10, 2, 8, 6, 7, 7, 4, 5, 2, 2, 2, 1, 4]],
  '€': [[7, 10, 5, 12, 2, 12, 0, 10, 0, 2, 2, 0, 5, 0, 7, 2], [0, 7, 6, 7], [0, 4.5, 5, 4.5]],
  '(': [[6, 12, 3, 9, 3, 3, 6, 0]],
  ')': [[2, 12, 5, 9, 5, 3, 2, 0]],
  '[': [[5, 12, 2, 12, 2, 0, 5, 0]],
  ']': [[2, 12, 5, 12, 5, 0, 2, 0]],
  '{': [[6, 12, 4, 11, 4, 8, 2, 6, 4, 4, 4, 1, 6, 0]],
  '}': [[2, 12, 4, 11, 4, 8, 6, 6, 4, 4, 4, 1, 2, 0]],
  '<': [[7, 10, 1, 6, 7, 2]],
  '>': [[1, 10, 7, 6, 1, 2]],
  '~': [[1, 6, 2.5, 8, 4.5, 5, 6, 7]],
  '^': [[1, 7, 4, 12, 7, 7]],
  '"': [[2, 12, 2, 8], [5, 12, 5, 8]],
  "'": [[3.5, 12, 2.5, 8]],
  '`': [[2.5, 12, 3.5, 8]],
  ' ': []
};

// Script / Cursive Single-Line Glyphs Variant
export const HERSHEY_SCRIPT_GLYPHS: Record<string, number[][]> = {
  ...HERSHEY_SIMPLEX_GLYPHS,
  'A': [[0, 0, 2, 8, 5, 12, 7, 8, 7, 0, 8, 1], [2, 4, 7, 4]],
  'B': [[0, 0, 1, 12], [1, 12, 5, 12, 7, 9, 5, 6, 1, 6], [5, 6, 7, 4, 7, 1, 5, 0, 0, 0, 2, 1]],
  'C': [[7, 10, 5, 12, 2, 12, 0, 9, 0, 3, 2, 0, 6, 0, 8, 2]],
  'E': [[7, 11, 5, 12, 2, 12, 0, 9, 1, 6, 4, 6], [1, 6, 0, 3, 2, 0, 6, 0, 8, 2]],
  'L': [[1, 10, 2, 12, 4, 12, 2, 9, 1, 1, 0, 0, 3, 0, 7, 2]],
  'M': [[0, 0, 1, 8, 3, 12, 4, 3, 6, 12, 8, 0, 9, 2]],
  'S': [[0, 2, 2, 0, 6, 2, 7, 5, 4, 7, 1, 9, 3, 12, 6, 11]],
};

// Serif / Roman Single-Line Glyphs Variant
export const HERSHEY_SERIF_GLYPHS: Record<string, number[][]> = {
  ...HERSHEY_SIMPLEX_GLYPHS,
  'A': [[0, 0, 4, 12], [4, 12, 8, 0], [1.5, 4, 6.5, 4], [-1, 0, 1.5, 0], [6.5, 0, 9, 0]],
  'I': [[1, 12, 7, 12], [4, 12, 4, 0], [1, 0, 7, 0]],
  'H': [[0, 0, 0, 12], [8, 0, 8, 12], [0, 6, 8, 6], [-1, 12, 1, 12], [7, 12, 9, 12], [-1, 0, 1, 0], [7, 0, 9, 0]],
  'T': [[0, 12, 8, 12], [4, 12, 4, 0], [0, 10, 0, 12], [8, 10, 8, 12], [2, 0, 6, 0]],
  'L': [[0, 12, 0, 0, 7, 0], [-1, 12, 1, 12], [7, 0, 7, 2]],
};

// -------------------------------------------------------------
// 2. SINGLE-LINE STICK FONT GENERATOR (With Slant, Bold & Multiline)
// -------------------------------------------------------------
export function generateSingleLineTextPaths(options: TextGeneratorOptions): VectorPolyline[] {
  const {
    text,
    x,
    y,
    fontSize = 12,
    fontFamily = 'Hershey Simplex',
    letterSpacing = 0,
    lineSpacing = 1.3,
    textAlign = 'left',
    fontStyle = 'normal',
    singleLineBold = false,
    italicSlantDeg = 0,
  } = options;

  let glyphSet = HERSHEY_SIMPLEX_GLYPHS;
  if (fontFamily.toLowerCase().includes('script') || fontFamily.toLowerCase().includes('cursive')) {
    glyphSet = HERSHEY_SCRIPT_GLYPHS;
  } else if (fontFamily.toLowerCase().includes('serif') || fontFamily.toLowerCase().includes('roman')) {
    glyphSet = HERSHEY_SERIF_GLYPHS;
  }

  const scale = fontSize / 12;
  const charWidth = 9 * scale + letterSpacing;
  const lineGap = fontSize * lineSpacing;
  const lines = text.split('\n');

  // Slant angle in radians (standard 14 deg if italic)
  let effectiveSlantDeg = italicSlantDeg;
  if (fontStyle === 'italic' && effectiveSlantDeg === 0) {
    effectiveSlantDeg = 14;
  }
  const slantTan = Math.tan((effectiveSlantDeg * Math.PI) / 180);

  const polylines: VectorPolyline[] = [];

  lines.forEach((lineStr, lineIdx) => {
    const lineY = y - lineIdx * lineGap;
    const lineWidth = lineStr.length * charWidth;

    let startX = x;
    if (textAlign === 'center') {
      startX = x - lineWidth / 2;
    } else if (textAlign === 'right') {
      startX = x - lineWidth;
    }

    for (let i = 0; i < lineStr.length; i++) {
      const char = lineStr[i];
      const glyph = glyphSet[char] || glyphSet[char.toUpperCase()] || glyphSet[' '];
      const charOriginX = startX + i * charWidth;

      if (glyph && glyph.length > 0) {
        for (const stroke of glyph) {
          const makePts = (offsetX: number = 0, offsetY: number = 0): Path2DPoint[] => {
            const pts: Path2DPoint[] = [];
            for (let s = 0; s < stroke.length; s += 2) {
              const gx = stroke[s] * scale;
              const gy = stroke[s + 1] * scale;
              // Apply Italic Slant Shear
              const slantedX = gx + gy * slantTan;
              pts.push({
                x: charOriginX + slantedX + offsetX,
                y: lineY + gy + offsetY,
              });
            }
            return pts;
          };

          const ptsMain = makePts(0, 0);
          if (ptsMain.length > 1) {
            polylines.push({ points: ptsMain, closed: false });
          }

          // Simulate Bold single line with parallel second/third stroke
          if (singleLineBold) {
            const bOffset = Math.max(0.12, scale * 0.4);
            const ptsBold1 = makePts(bOffset, 0);
            if (ptsBold1.length > 1) {
              polylines.push({ points: ptsBold1, closed: false });
            }
            const ptsBold2 = makePts(0, bOffset * 0.7);
            if (ptsBold2.length > 1) {
              polylines.push({ points: ptsBold2, closed: false });
            }
          }
        }
      }
    }
  });

  return polylines;
}

// -------------------------------------------------------------
// 3. TRUE VECTOR OUTLINE CONTOUR & INFILL GENERATOR (SMOOTH CNC CURVES & STRAIGHT LINES)
// -------------------------------------------------------------
/**
 * Renders any system/web font onto a high-res offscreen canvas,
 * extracts exact sub-pixel vector contours with smooth curves and straight edges,
 * eliminating raster staircasing so the CNC tool maintains continuous acceleration!
 */
export function generateOutlineTextPaths(options: TextGeneratorOptions): VectorPolyline[] {
  const {
    text,
    x,
    y,
    fontSize = 18,
    fontFamily = 'Arial',
    fontWeight = 'normal',
    fontStyle = 'normal',
    letterSpacing = 0,
    lineSpacing = 1.3,
    textAlign = 'left',
    infillPattern = 'none',
    infillSpacing = 0.8, // mm
    infillAngle = 45, // degrees
    includeOutline = true,
  } = options;

  if (!text || text.trim().length === 0) return [];
  
  const font = OPENTYPE_FONT_CACHE[fontFamily];
  if (font && (infillPattern === 'none' || includeOutline)) {
    const lines = text.split('\n');
    const polylines: VectorPolyline[] = [];
    let currentYOffset = 0;
    
    lines.forEach((lineStr) => {
      const advanceWidth = font.getAdvanceWidth(lineStr, fontSize);
      let lineXOffset = 0;
      if (textAlign === 'center') lineXOffset = -advanceWidth / 2;
      else if (textAlign === 'right') lineXOffset = -advanceWidth;
      
      const path = font.getPath(lineStr, lineXOffset, currentYOffset, fontSize);
      const linePolys = flattenOpentypePath(path, 0.05); // CNC scale tolerance 0.05mm
      
      for (const poly of linePolys) {
        for (const pt of poly.points) {
          const finalX = x + pt.x;
          const finalY = y - pt.y; // invert Y for CNC Cartesian coordinates
          pt.x = Number(finalX.toFixed(3));
          pt.y = Number(finalY.toFixed(3));
        }
      }
      
      polylines.push(...linePolys);
      currentYOffset += fontSize * lineSpacing;
    });
    
    if (infillPattern === 'none') {
      return polylines;
    }
    // If infill is needed, we let it fall through to canvas logic for infill!
  }

  // Resolution in pixels per mm - 28 px/mm provides ultra-fine ~0.035 mm sub-pixel grid baseline
  const ppmm = 28;
  const fontPx = Math.max(20, Math.round(fontSize * ppmm));

  // Measure and setup off-screen canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  const weightStr = typeof fontWeight === 'number' ? String(fontWeight) : fontWeight;
  const styleStr = fontStyle === 'italic' ? 'italic' : 'normal';
  const cleanFontFamily = fontFamily.replace(/['"]/g, '');
  ctx.font = `${styleStr} ${weightStr} ${fontPx}px "${cleanFontFamily}", sans-serif`;

  const lines = text.split('\n');
  const lineSpacingPx = fontPx * lineSpacing;
  
  // Calculate canvas dimensions
  let maxLineWidthPx = 0;
  lines.forEach(l => {
    const w = ctx.measureText(l).width + (l.length * letterSpacing * ppmm);
    if (w > maxLineWidthPx) maxLineWidthPx = w;
  });

  const padPx = Math.round(fontPx * 0.5);
  const canvasW = Math.max(60, Math.ceil(maxLineWidthPx + padPx * 2));
  const canvasH = Math.max(60, Math.ceil(lines.length * lineSpacingPx + padPx * 2));

  canvas.width = canvasW;
  canvas.height = canvasH;

  // Render on white background with crisp anti-aliasing
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasW, canvasH);

  ctx.fillStyle = '#000000';
  ctx.font = `${styleStr} ${weightStr} ${fontPx}px "${cleanFontFamily}", sans-serif`;
  ctx.textBaseline = 'alphabetic';

  // Draw lines
  const textLeftPx = padPx;
  const baseAscent = fontPx * 0.85;

  lines.forEach((lineStr, lineIdx) => {
    const curLineY = padPx + lineIdx * lineSpacingPx + baseAscent;
    const curLineWidth = ctx.measureText(lineStr).width + (lineStr.length * letterSpacing * ppmm);

    let startLineXPx = textLeftPx;
    if (textAlign === 'center') {
      startLineXPx = (canvasW - curLineWidth) / 2;
    } else if (textAlign === 'right') {
      startLineXPx = canvasW - padPx - curLineWidth;
    }

    if (letterSpacing === 0) {
      ctx.fillText(lineStr, startLineXPx, curLineY);
    } else {
      let curX = startLineXPx;
      for (let c = 0; c < lineStr.length; c++) {
        const ch = lineStr[c];
        ctx.fillText(ch, curX, curLineY);
        curX += ctx.measureText(ch).width + (letterSpacing * ppmm);
      }
    }
  });

  const imgData = ctx.getImageData(0, 0, canvasW, canvasH);
  const data = imgData.data;

  // Build high-resolution scalar field (0 = background, 255 = black letter core)
  const scalarGrid: number[][] = [];
  const binaryGrid: boolean[][] = [];
  for (let gy = 0; gy < canvasH; gy++) {
    const sRow: number[] = [];
    const bRow: boolean[] = [];
    for (let gx = 0; gx < canvasW; gx++) {
      const idx = (gy * canvasW + gx) * 4;
      const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      const intensity = 255 - gray; // 0 = white bg, 255 = black text
      sRow.push(intensity);
      bRow.push(intensity >= 128);
    }
    scalarGrid.push(sRow);
    binaryGrid.push(bRow);
  }

  const polylines: VectorPolyline[] = [];

  // Coordinate mapper from canvas px to CNC Bed mm
  const toMmPt = (px: number, py: number): Path2DPoint => {
    const relX = (px - padPx) / ppmm;
    const relY = (py - (padPx + baseAscent)) / ppmm;
    return {
      x: Number((x + relX).toFixed(3)),
      y: Number((y - relY).toFixed(3)), // Invert Y for standard Cartesian CNC coordinates
    };
  };

  // --- A. TRACE SUB-PIXEL SMOOTH OUTLINES ---
  if (includeOutline || infillPattern === 'none') {
    const outlinePaths = traceSubpixelIsoContours(scalarGrid, canvasW, canvasH, toMmPt);
    polylines.push(...outlinePaths);
  }

  // --- B. GENERATE INFILL PATTERNS INSIDE LETTERS ---
  if (infillPattern && infillPattern !== 'none') {
    const infillPaths = generateLetterMaskInfill({
      grid: binaryGrid,
      width: canvasW,
      height: canvasH,
      ppmm,
      toMmPt,
      pattern: infillPattern,
      spacingMm: Math.max(0.2, infillSpacing),
      angleDeg: infillAngle,
    });
    polylines.push(...infillPaths);
  }

  return polylines;
}

// -------------------------------------------------------------
// 4. SUB-PIXEL ISO-CONTOUR TRACER & CNC SMOOTHING ENGINE
// -------------------------------------------------------------
/**
 * Traces exact subpixel isoline contours using marching squares with linear interpolation,
 * then applies corner-preserving curve smoothing and straight-line collinear decimation.
 */
function traceSubpixelIsoContours(
  grid: number[][],
  w: number,
  h: number,
  toMm: (px: number, py: number) => Path2DPoint,
  isoThreshold: number = 128
): VectorPolyline[] {
  interface EdgeSegment {
    p1: Path2DPoint;
    p2: Path2DPoint;
  }

  const segments: EdgeSegment[] = [];

  // Helper for linear interpolation along grid edge
  const lerpEdge = (valA: number, valB: number, posA: number, posB: number): number => {
    if (Math.abs(valB - valA) < 1e-5) return (posA + posB) / 2;
    const t = (isoThreshold - valA) / (valB - valA);
    const clampedT = Math.max(0, Math.min(1, t));
    return posA + clampedT * (posB - posA);
  };

  for (let gy = 0; gy < h - 1; gy++) {
    for (let gx = 0; gx < w - 1; gx++) {
      const tl = grid[gy][gx];
      const tr = grid[gy][gx + 1];
      const br = grid[gy + 1][gx + 1];
      const bl = grid[gy + 1][gx];

      const btl = tl >= isoThreshold ? 1 : 0;
      const btr = tr >= isoThreshold ? 1 : 0;
      const bbr = br >= isoThreshold ? 1 : 0;
      const bbl = bl >= isoThreshold ? 1 : 0;

      const caseId = (btl << 3) | (btr << 2) | (bbr << 1) | bbl;
      if (caseId === 0 || caseId === 15) continue;

      // Subpixel edge intersections
      const topPt: Path2DPoint = { x: lerpEdge(tl, tr, gx, gx + 1), y: gy };
      const rightPt: Path2DPoint = { x: gx + 1, y: lerpEdge(tr, br, gy, gy + 1) };
      const bottomPt: Path2DPoint = { x: lerpEdge(bl, br, gx, gx + 1), y: gy + 1 };
      const leftPt: Path2DPoint = { x: gx, y: lerpEdge(tl, bl, gy, gy + 1) };

      switch (caseId) {
        case 1:  segments.push({ p1: leftPt, p2: bottomPt }); break;
        case 2:  segments.push({ p1: bottomPt, p2: rightPt }); break;
        case 3:  segments.push({ p1: leftPt, p2: rightPt }); break;
        case 4:  segments.push({ p1: topPt, p2: rightPt }); break;
        case 5: {
          const centerVal = (tl + tr + br + bl) / 4;
          if (centerVal >= isoThreshold) {
            segments.push({ p1: leftPt, p2: topPt }, { p1: bottomPt, p2: rightPt });
          } else {
            segments.push({ p1: leftPt, p2: bottomPt }, { p1: topPt, p2: rightPt });
          }
          break;
        }
        case 6:  segments.push({ p1: topPt, p2: bottomPt }); break;
        case 7:  segments.push({ p1: leftPt, p2: topPt }); break;
        case 8:  segments.push({ p1: topPt, p2: leftPt }); break;
        case 9:  segments.push({ p1: topPt, p2: bottomPt }); break;
        case 10: {
          const centerVal = (tl + tr + br + bl) / 4;
          if (centerVal >= isoThreshold) {
            segments.push({ p1: topPt, p2: rightPt }, { p1: leftPt, p2: bottomPt });
          } else {
            segments.push({ p1: topPt, p2: leftPt }, { p1: bottomPt, p2: rightPt });
          }
          break;
        }
        case 11: segments.push({ p1: topPt, p2: rightPt }); break;
        case 12: segments.push({ p1: rightPt, p2: leftPt }); break;
        case 13: segments.push({ p1: bottomPt, p2: rightPt }); break;
        case 14: segments.push({ p1: leftPt, p2: bottomPt }); break;
      }
    }
  }

  // Connect edge segments into continuous loops
  interface AdjEdge {
    otherPt: Path2DPoint;
    segIdx: number;
  }

  const pointKey = (p: Path2DPoint) => `${Math.round(p.x * 50)},${Math.round(p.y * 50)}`;
  const adjMap = new Map<string, AdjEdge[]>();

  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const k1 = pointKey(s.p1);
    const k2 = pointKey(s.p2);

    if (!adjMap.has(k1)) adjMap.set(k1, []);
    if (!adjMap.has(k2)) adjMap.set(k2, []);

    adjMap.get(k1)!.push({ otherPt: s.p2, segIdx: i });
    adjMap.get(k2)!.push({ otherPt: s.p1, segIdx: i });
  }

  const usedSegs = new Uint8Array(segments.length);
  const polylines: VectorPolyline[] = [];

  for (let i = 0; i < segments.length; i++) {
    if (usedSegs[i]) continue;
    usedSegs[i] = 1;

    const startSeg = segments[i];
    const currentLine: Path2DPoint[] = [startSeg.p1, startSeg.p2];
    let currentTail = startSeg.p2;

    let steps = 0;
    while (steps++ < 16000) {
      const kTail = pointKey(currentTail);
      const neighbors = adjMap.get(kTail);
      if (!neighbors) break;

      let foundNext = false;
      for (let n = 0; n < neighbors.length; n++) {
        const edge = neighbors[n];
        if (!usedSegs[edge.segIdx]) {
          usedSegs[edge.segIdx] = 1;
          currentLine.push(edge.otherPt);
          currentTail = edge.otherPt;
          foundNext = true;
          break;
        }
      }
      if (!foundNext) break;
    }

    if (currentLine.length >= 3) {
      const isClosed = Math.hypot(currentLine[0].x - currentLine[currentLine.length - 1].x, currentLine[0].y - currentLine[currentLine.length - 1].y) < 1.5;
      const mmPoints = currentLine.map(pt => toMm(pt.x, pt.y));
      
      // Apply CNC Curve Smoothing & Collinear Line Decimation
      const optimizedPoints = smoothAndDecimateContour(mmPoints, isClosed);
      if (optimizedPoints.length >= 2) {
        polylines.push({ points: optimizedPoints, closed: isClosed });
      }
    }
  }

  return polylines;
}

/**
 * Advanced CNC Contour Smoothing & Collinear Decimation:
 * - Straight edges (stems of letters) are collapsed into single exact straight lines.
 * - Sharp corners (> 35° turn) are preserved as fixed sharp anchor points.
 * - Smooth curves (circles, arcs in 'O', 'S', 'B', etc.) are smoothed to eliminate
 *   quantization jitter and sampled with uniform tangent continuity so CNC motors never stutter.
 */
function smoothAndDecimateContour(points: Path2DPoint[], isClosed: boolean): Path2DPoint[] {
  if (points.length <= 3) return points;

  let pts = [...points];
  if (isClosed && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 0.05) {
    pts.pop(); // Remove duplicate closing vertex during processing
  }
  const n = pts.length;
  if (n < 3) return pts;

  // Step 1: Detect Sharp Corners vs Smooth Curvature
  // Turn angle between vector (p[i-1] -> p[i]) and (p[i] -> p[i+1])
  const isCorner = new Uint8Array(n);
  const cornerThresholdDeg = 38; // Angles sharper than 38 deg are sharp corners
  const cosThreshold = Math.cos((cornerThresholdDeg * Math.PI) / 180);

  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];

    const v1x = curr.x - prev.x;
    const v1y = curr.y - prev.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;

    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);

    if (len1 > 1e-4 && len2 > 1e-4) {
      const dot = (v1x * v2x + v1y * v2y) / (len1 * len2);
      if (dot < cosThreshold) {
        isCorner[i] = 1; // Sharp corner
      }
    }
  }

  // Step 2: Smooth non-corner curve segments using a 5-point Gaussian kernel [0.06, 0.24, 0.40, 0.24, 0.06]
  const smoothed: Path2DPoint[] = [];
  for (let i = 0; i < n; i++) {
    if (isCorner[i] || (!isClosed && (i === 0 || i === n - 1))) {
      smoothed.push({ ...pts[i] });
    } else {
      const p_2 = pts[(i - 2 + n) % n];
      const p_1 = pts[(i - 1 + n) % n];
      const p_0 = pts[i];
      const p1 = pts[(i + 1) % n];
      const p2 = pts[(i + 2) % n];

      // If nearby vertices don't cross a sharp corner, apply smoothing
      if (!isCorner[(i - 1 + n) % n] && !isCorner[(i + 1) % n]) {
        smoothed.push({
          x: Number((0.06 * p_2.x + 0.24 * p_1.x + 0.40 * p_0.x + 0.24 * p1.x + 0.06 * p2.x).toFixed(3)),
          y: Number((0.06 * p_2.y + 0.24 * p_1.y + 0.40 * p_0.y + 0.24 * p1.y + 0.06 * p2.y).toFixed(3)),
        });
      } else {
        smoothed.push({
          x: Number((0.25 * p_1.x + 0.50 * p_0.x + 0.25 * p1.x).toFixed(3)),
          y: Number((0.25 * p_1.y + 0.50 * p_0.y + 0.25 * p1.y).toFixed(3)),
        });
      }
    }
  }

  // Step 3: Collinear Run Consolidation (Merge straight line segments into single continuous vectors)
  // We identify straight sections and collapse intermediate points within 0.035 mm tolerance.
  const cornerIndices: number[] = [];
  for (let i = 0; i < smoothed.length; i++) {
    if (isCorner[i]) cornerIndices.push(i);
  }

  // Segment the contour between corner points into spans
  const resultPoints: Path2DPoint[] = [];
  if (cornerIndices.length >= 2) {
    for (let c = 0; c < cornerIndices.length; c++) {
      const idxA = cornerIndices[c];
      const idxB = cornerIndices[(c + 1) % cornerIndices.length];
      
      const spanPts: Path2DPoint[] = [];
      let cur = idxA;
      while (true) {
        spanPts.push(smoothed[cur]);
        if (cur === idxB) break;
        cur = (cur + 1) % smoothed.length;
      }

      // Check if this entire span is a single straight line
      const ptA = spanPts[0];
      const ptB = spanPts[spanPts.length - 1];
      const dx = ptB.x - ptA.x;
      const dy = ptB.y - ptA.y;
      const spanLenSq = dx * dx + dy * dy;

      let isEntirelyStraight = true;
      if (spanPts.length > 2 && spanLenSq > 1e-4) {
        const spanLen = Math.sqrt(spanLenSq);
        for (let k = 1; k < spanPts.length - 1; k++) {
          const cross = Math.abs((spanPts[k].x - ptA.x) * dy - (spanPts[k].y - ptA.y) * dx);
          const dist = cross / spanLen;
          if (dist > 0.04) {
            isEntirelyStraight = false;
            break;
          }
        }
      } else {
        isEntirelyStraight = spanPts.length <= 2;
      }

      if (isEntirelyStraight) {
        // Pure straight line: only start point (end point added by next span)
        resultPoints.push(ptA);
      } else {
        // Curved span: simplify with fine chordal tolerance for uniform tangential speed
        const simplifiedSpan = simplifyPolylinePoints(spanPts, 0.032);
        for (let k = 0; k < simplifiedSpan.length - 1; k++) {
          resultPoints.push(simplifiedSpan[k]);
        }
      }
    }
  } else {
    // Continuous closed curve (e.g. 'O', circle, ellipse) without sharp corners
    const simplified = simplifyPolylinePoints(smoothed, 0.030);
    resultPoints.push(...simplified);
  }

  if (isClosed && resultPoints.length > 2) {
    resultPoints.push({ ...resultPoints[0] });
  }

  return resultPoints;
}

// -------------------------------------------------------------
// 5. INFILL & HATCHING PATTERN GENERATOR FOR LETTERS
// -------------------------------------------------------------
function generateLetterMaskInfill(params: {
  grid: boolean[][];
  width: number;
  height: number;
  ppmm: number;
  toMmPt: (px: number, py: number) => Path2DPoint;
  pattern: TextInfillPattern;
  spacingMm: number;
  angleDeg: number;
}): VectorPolyline[] {
  const { grid, width, height, ppmm, toMmPt, pattern, spacingMm, angleDeg } = params;
  const polylines: VectorPolyline[] = [];

  const spacingPx = Math.max(2, spacingMm * ppmm);

  // --- A. LINEAR HATCH, CROSS HATCH & ZIGZAG ---
  if (pattern === 'hatch_linear' || pattern === 'cross_hatch' || pattern === 'zigzag') {
    const angles = pattern === 'cross_hatch' ? [angleDeg, (angleDeg + 90) % 180] : [angleDeg];

    for (const curAngle of angles) {
      const rad = (curAngle * Math.PI) / 180;
      const cosA = Math.cos(rad);
      const sinA = Math.sin(rad);

      // Bounding box in rotated space
      const diag = Math.hypot(width, height);
      const cx = width / 2;
      const cy = height / 2;

      const numLines = Math.ceil((diag * 2) / spacingPx);
      const startOffset = -diag;

      let lineDirectionForward = true;

      for (let l = 0; l <= numLines; l++) {
        const offset = startOffset + l * spacingPx;

        // Line in rotated space: u along line from -diag to +diag, v = offset
        const sampleStep = 1.5; // px sampling
        const numSamples = Math.ceil((diag * 2) / sampleStep);

        let inSpan = false;
        let spanPoints: Path2DPoint[] = [];
        const lineSegments: Path2DPoint[][] = [];

        for (let s = 0; s <= numSamples; s++) {
          const u = -diag + s * sampleStep;
          const v = offset;

          // Rotate back to canvas coordinates
          const px = cx + u * cosA - v * sinA;
          const py = cy + u * sinA + v * cosA;

          const ix = Math.floor(px);
          const iy = Math.floor(py);

          const isInside = ix >= 0 && ix < width && iy >= 0 && iy < height && grid[iy][ix];

          if (isInside) {
            const mmPt = toMmPt(px, py);
            if (!inSpan) {
              inSpan = true;
              spanPoints = [mmPt];
            } else {
              spanPoints.push(mmPt);
            }
          } else {
            if (inSpan) {
              if (spanPoints.length > 1) {
                lineSegments.push(spanPoints);
              }
              inSpan = false;
              spanPoints = [];
            }
          }
        }

        if (inSpan && spanPoints.length > 1) {
          lineSegments.push(spanPoints);
        }

        // For zigzag mode, connect segments alternating directions to make continuous snake
        if (pattern === 'zigzag') {
          for (const seg of lineSegments) {
            if (!lineDirectionForward) {
              seg.reverse();
            }
            if (seg.length > 1) {
              polylines.push({ points: seg, closed: false });
            }
          }
          lineDirectionForward = !lineDirectionForward;
        } else {
          for (const seg of lineSegments) {
            if (seg.length > 1) {
              polylines.push({ points: seg, closed: false });
            }
          }
        }
      }
    }
  }

  // --- B. DOTS / STIPPLING INFILL ---
  else if (pattern === 'dots') {
    const dotSpacingPx = Math.max(3, spacingMm * ppmm);
    for (let gy = dotSpacingPx / 2; gy < height; gy += dotSpacingPx) {
      for (let gx = dotSpacingPx / 2; gx < width; gx += dotSpacingPx) {
        const ix = Math.floor(gx);
        const iy = Math.floor(gy);
        if (ix >= 0 && ix < width && iy >= 0 && iy < height && grid[iy][ix]) {
          const pt = toMmPt(gx, gy);
          // Tiny 0.1mm micro-stroke for the plotter pen to touch down
          polylines.push({
            points: [
              { x: pt.x - 0.08, y: pt.y },
              { x: pt.x + 0.08, y: pt.y },
            ],
            closed: false,
          });
        }
      }
    }
  }

  // --- C. CONCENTRIC INWARD RINGS INFILL (Erosion Rings) ---
  else if (pattern === 'concentric') {
    let currentGrid = grid.map(r => [...r]);
    const erosionSteps = Math.min(8, Math.max(1, Math.floor(5 / spacingMm)));
    const erosionPx = Math.max(1, Math.round(spacingMm * ppmm * 0.7));

    for (let step = 1; step <= erosionSteps; step++) {
      // Morphological erosion
      const erodedGrid: boolean[][] = [];
      let remainingPixels = 0;

      for (let y = 0; y < height; y++) {
        const row: boolean[] = [];
        for (let x = 0; x < width; x++) {
          if (!currentGrid[y][x]) {
            row.push(false);
            continue;
          }
          // Check neighbors within erosion radius
          let keep = true;
          for (let dy = -erosionPx; dy <= erosionPx && keep; dy++) {
            for (let dx = -erosionPx; dx <= erosionPx; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || nx >= width || ny < 0 || ny >= height || !currentGrid[ny][nx]) {
                keep = false;
                break;
              }
            }
          }
          row.push(keep);
          if (keep) remainingPixels++;
        }
        erodedGrid.push(row);
      }

      if (remainingPixels < 20) break;
      currentGrid = erodedGrid;

      const floatGrid: number[][] = currentGrid.map(row => row.map(v => (v ? 255 : 0)));
      const ringPaths = traceSubpixelIsoContours(floatGrid, width, height, toMmPt, 128);
      polylines.push(...ringPaths);
    }
  }

  return polylines;
}

// -------------------------------------------------------------
// 6. HELPER: POLYLINE SIMPLIFICATION (DOUGLAS-PEUCKER)
// -------------------------------------------------------------
function simplifyPolylinePoints(points: Path2DPoint[], tolerance: number): Path2DPoint[] {
  if (points.length <= 2) return points;
  const sqTolerance = tolerance * tolerance;

  function getSqDist(p: Path2DPoint, p1: Path2DPoint, p2: Path2DPoint): number {
    let x = p1.x, y = p1.y, dx = p2.x - x, dy = p2.y - y;
    if (dx !== 0 || dy !== 0) {
      const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) {
        x = p2.x; y = p2.y;
      } else if (t > 0) {
        x += dx * t; y += dy * t;
      }
    }
    dx = p.x - x; dy = p.y - y;
    return dx * dx + dy * dy;
  }

  function simplifyDP(pts: Path2DPoint[], first: number, last: number, res: Path2DPoint[]) {
    let maxDist = sqTolerance;
    let index = 0;
    for (let i = first + 1; i < last; i++) {
      const d = getSqDist(pts[i], pts[first], pts[last]);
      if (d > maxDist) {
        index = i;
        maxDist = d;
      }
    }
    if (maxDist > sqTolerance) {
      if (index - first > 1) simplifyDP(pts, first, index, res);
      res.push(pts[index]);
      if (last - index > 1) simplifyDP(pts, index, last, res);
    }
  }

  const res: Path2DPoint[] = [points[0]];
  simplifyDP(points, 0, points.length - 1, res);
  res.push(points[points.length - 1]);
  return res;
}

// -------------------------------------------------------------
// 7. UNIVERSAL TEXT GENERATION DISPATCHER
// -------------------------------------------------------------
export function generateUniversalTextPaths(options: TextGeneratorOptions): VectorPolyline[] {
  if (options.mode === 'single_line') {
    return generateSingleLineTextPaths(options);
  } else {
    return generateOutlineTextPaths(options);
  }
}
