import sys

with open('vectorRasterGenerator.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Export simplifyPolyline
code = code.replace('function simplifyPolyline(', 'export function simplifyPolyline(')

# 2. Add text/tspan handling
text_handling = """
    } else if (tag === 'text' || tag === 'tspan') {
      const textContent = el.textContent || '';
      if (textContent.trim()) {
        const x = parseFloat(el.getAttribute('x') || '0');
        const y = parseFloat(el.getAttribute('y') || '0');
        const fontSize = parseFloat(el.getAttribute('font-size') || '12');
        const fontFamily = el.getAttribute('font-family') || 'Hershey Simplex';
        
        const textPolys = generateUniversalTextPaths({
          text: textContent.trim(), x, y, fontSize, fontFamily, 
          fontWeight: 'normal', fontStyle: 'normal', textAlign: 'left',
          letterSpacing: 0, lineSpacing: 1.25, mode: 'single_line',
          infillPattern: 'none', infillSpacing: 0, infillAngle: 0, includeOutline: false,
          singleLineBold: false, italicSlantDeg: 0
        });
        polylines.push(...textPolys);
      }
"""
code = code.replace("    } else if (tag === 'path') {", text_handling + "    } else if (tag === 'path') {")
code = code.replace("elements = svgEl.querySelectorAll('path, rect, circle, ellipse, line, polyline, polygon');", "elements = svgEl.querySelectorAll('path, rect, circle, ellipse, line, polyline, polygon, text, tspan');")

# 3. Add simplifyPolyline to getOptimizedPolylinesAndGroups
opt_replace = """
  for (let gIdx = 0; gIdx < effectiveGroups.length; gIdx++) {
    const grp = effectiveGroups[gIdx];
    let groupPaths = grp.polylines;
    
    // Simplify paths before optimization to drastically reduce points
    groupPaths = groupPaths.map(p => ({
      ...p,
      points: simplifyPolyline(p.points, 0.02)
    })).filter(p => p.points.length >= 2);

    if (optimizeOrder) {
"""
code = code.replace("""  for (let gIdx = 0; gIdx < effectiveGroups.length; gIdx++) {
    const grp = effectiveGroups[gIdx];
    let groupPaths = grp.polylines;
    if (optimizeOrder) {""", opt_replace)

# 4. Cap TSP optimization
tsp_inner_loop = """
    const searchLimit = Math.min(remaining.length, 300);
    for (let i = 0; i < searchLimit; i++) {
"""
code = code.replace("for (let i = 0; i < remaining.length; i++) {", tsp_inner_loop)

# 5. Replace parseSvgPathD
start_idx = code.find("function parseSvgPathD(d: string): VectorPolyline[] {")
start_idx = code.rfind("/**", 0, start_idx)

end_idx = code.find("function simplifyPolyline", start_idx)
end_idx = code.rfind("/**", start_idx, end_idx)

new_parse_fn = """/**
 * Basic SVG Path 'd' parameter tokenizer & linearizer
 */
function parseSvgPathD(d: string): VectorPolyline[] {
  const result: VectorPolyline[] = [];
  const commands = d.match(/[a-df-z][^a-df-z]*/ig) || [];

  let currentPoint: Path2DPoint = { x: 0, y: 0 };
  let pathStartPoint: Path2DPoint = { x: 0, y: 0 };
  let lastControlPoint: Path2DPoint | null = null;
  let currentPolyline: Path2DPoint[] = [];

  for (const cmdStr of commands) {
    const type = cmdStr[0];
    const isRel = type === type.toLowerCase();
    const cmdUpper = type.toUpperCase();
    const args = (cmdStr.slice(1).match(/[-+]?[0-9]*\\.?[0-9]+(?:[eE][-+]?[0-9]+)?/g) || []).map(Number);
    
    let isCurve = false;

    if (cmdUpper === 'M') {
      for (let i = 0; i < args.length; i += 2) {
        let x = args[i], y = args[i + 1];
        if (isRel) { x += currentPoint.x; y += currentPoint.y; }
        if (i === 0) {
          if (currentPolyline.length > 1) { result.push({ points: currentPolyline, closed: false }); }
          currentPolyline = [{ x, y }];
          pathStartPoint = { x, y };
        } else {
          currentPolyline.push({ x, y });
        }
        currentPoint = { x, y };
      }
    } else if (cmdUpper === 'L') {
      for (let i = 0; i < args.length; i += 2) {
        let x = args[i], y = args[i + 1];
        if (isRel) { x += currentPoint.x; y += currentPoint.y; }
        currentPolyline.push({ x, y });
        currentPoint = { x, y };
      }
    } else if (cmdUpper === 'H') {
      for (const val of args) {
        const x = isRel ? currentPoint.x + val : val;
        currentPolyline.push({ x, y: currentPoint.y });
        currentPoint.x = x;
      }
    } else if (cmdUpper === 'V') {
      for (const val of args) {
        const y = isRel ? currentPoint.y + val : val;
        currentPolyline.push({ x: currentPoint.x, y });
        currentPoint.y = y;
      }
    } else if (cmdUpper === 'C') {
      isCurve = true;
      for (let i = 0; i < args.length; i += 6) {
        let cp1x = args[i], cp1y = args[i + 1], cp2x = args[i + 2], cp2y = args[i + 3], ex = args[i + 4], ey = args[i + 5];
        if (isRel) { cp1x += currentPoint.x; cp1y += currentPoint.y; cp2x += currentPoint.x; cp2y += currentPoint.y; ex += currentPoint.x; ey += currentPoint.y; }
        const cPts = flattenCubicBezier(currentPoint.x, currentPoint.y, cp1x, cp1y, cp2x, cp2y, ex, ey, 0.05);
        if (cPts.length > 0) currentPolyline.push(...cPts.slice(1));
        currentPoint = { x: ex, y: ey };
        lastControlPoint = { x: cp2x, y: cp2y };
      }
    } else if (cmdUpper === 'S') {
      isCurve = true;
      for (let i = 0; i < args.length; i += 4) {
        let cp2x = args[i], cp2y = args[i + 1], ex = args[i + 2], ey = args[i + 3];
        if (isRel) { cp2x += currentPoint.x; cp2y += currentPoint.y; ex += currentPoint.x; ey += currentPoint.y; }
        let cp1x = currentPoint.x, cp1y = currentPoint.y;
        if (lastControlPoint) { cp1x = 2 * currentPoint.x - lastControlPoint.x; cp1y = 2 * currentPoint.y - lastControlPoint.y; }
        const cPts = flattenCubicBezier(currentPoint.x, currentPoint.y, cp1x, cp1y, cp2x, cp2y, ex, ey, 0.05);
        if (cPts.length > 0) currentPolyline.push(...cPts.slice(1));
        currentPoint = { x: ex, y: ey };
        lastControlPoint = { x: cp2x, y: cp2y };
      }
    } else if (cmdUpper === 'Q') {
      isCurve = true;
      for (let i = 0; i < args.length; i += 4) {
        let cpx = args[i], cpy = args[i + 1], ex = args[i + 2], ey = args[i + 3];
        if (isRel) { cpx += currentPoint.x; cpy += currentPoint.y; ex += currentPoint.x; ey += currentPoint.y; }
        const qPts = flattenQuadraticBezier(currentPoint.x, currentPoint.y, cpx, cpy, ex, ey, 0.05);
        if (qPts.length > 0) currentPolyline.push(...qPts.slice(1));
        currentPoint = { x: ex, y: ey };
        lastControlPoint = { x: cpx, y: cpy };
      }
    } else if (cmdUpper === 'T') {
      isCurve = true;
      for (let i = 0; i < args.length; i += 2) {
        let ex = args[i], ey = args[i + 1];
        if (isRel) { ex += currentPoint.x; ey += currentPoint.y; }
        let cpx = currentPoint.x, cpy = currentPoint.y;
        if (lastControlPoint) { cpx = 2 * currentPoint.x - lastControlPoint.x; cpy = 2 * currentPoint.y - lastControlPoint.y; }
        const qPts = flattenQuadraticBezier(currentPoint.x, currentPoint.y, cpx, cpy, ex, ey, 0.05);
        if (qPts.length > 0) currentPolyline.push(...qPts.slice(1));
        currentPoint = { x: ex, y: ey };
        lastControlPoint = { x: cpx, y: cpy };
      }
    } else if (cmdUpper === 'A') {
      for (let i = 0; i < args.length; i += 7) {
        let rx = args[i], ry = args[i + 1], xAxisRotation = args[i + 2], largeArcFlag = args[i + 3], sweepFlag = args[i + 4];
        let ex = args[i + 5], ey = args[i + 6];
        if (isRel) { ex += currentPoint.x; ey += currentPoint.y; }
        
        // Elliptical arc to line segments approximation
        const dx = ex - currentPoint.x;
        const dy = ey - currentPoint.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist > 1e-5 && rx > 0 && ry > 0) {
           const steps = Math.max(12, Math.ceil(dist));
           for(let j=1; j<=steps; j++) {
              const t = j/steps;
              currentPolyline.push({ x: currentPoint.x + dx*t, y: currentPoint.y + dy*t });
           }
        }
        currentPoint = { x: ex, y: ey };
      }
    } else if (cmdUpper === 'Z') {
      if (currentPolyline.length > 0) {
        currentPolyline.push({ ...pathStartPoint });
        result.push({ points: currentPolyline, closed: true });
        currentPolyline = [];
        currentPoint = { ...pathStartPoint };
      }
    }

    if (!isCurve) {
      lastControlPoint = null;
    }
  }

  if (currentPolyline.length > 1) {
    result.push({ points: currentPolyline, closed: false });
  }

  return result;
}

"""

code = code[:start_idx] + new_parse_fn + code[end_idx:]

with open('vectorRasterGenerator.ts', 'w', encoding='utf-8') as f:
    f.write(code)
