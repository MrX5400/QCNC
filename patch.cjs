const fs = require("fs");
let content = fs.readFileSync("src/components/Workspace.tsx", "utf-8");

const patch = `  // --- HARDWARE ACCELERATION: Path2D Caches for 2D Rendering ---
  const activeOptimizedPath2D = useMemo(() => {
    const p = new Path2D();
    activeOptimizedPolylines.forEach(poly => {
      if (poly.points.length < 2) return;
      p.moveTo(poly.points[0].x, poly.points[0].y);
      for (let i = 1; i < poly.points.length; i++) {
        p.lineTo(poly.points[i].x, poly.points[i].y);
      }
      if (poly.closed) p.closePath();
    });
    return p;
  }, [activeOptimizedPolylines]);

  const draftPath2D = useMemo(() => {
    const p = new Path2D();
    draftPolylines.forEach(poly => {
      if (poly.points.length < 2) return;
      p.moveTo(poly.points[0].x, poly.points[0].y);
      for (let i = 1; i < poly.points.length; i++) {
        p.lineTo(poly.points[i].x, poly.points[i].y);
      }
      if (poly.closed) p.closePath();
    });
    return p;
  }, [draftPolylines]);

  const rapidPath2D = useMemo(() => {
    const p = new Path2D();
    if (activeOptimizedPolylines.length > 0) {
      const firstPt = activeOptimizedPolylines[0].points[0];
      if (firstPt) {
        p.moveTo(0, 0);
        p.lineTo(firstPt.x, firstPt.y);
      }
      for (let i = 0; i < activeOptimizedPolylines.length - 1; i++) {
        const currentPoly = activeOptimizedPolylines[i];
        const nextPoly = activeOptimizedPolylines[i + 1];
        if (currentPoly.points.length === 0 || nextPoly.points.length === 0) continue;
        const endPt = currentPoly.closed ? currentPoly.points[0] : currentPoly.points[currentPoly.points.length - 1];
        const nextStartPt = nextPoly.points[0];
        p.moveTo(endPt.x, endPt.y);
        p.lineTo(nextStartPt.x, nextStartPt.y);
      }
      const lastPoly = activeOptimizedPolylines[activeOptimizedPolylines.length - 1];
      if (lastPoly && lastPoly.points.length > 0) {
        const lastEndPt = lastPoly.closed ? lastPoly.points[0] : lastPoly.points[lastPoly.points.length - 1];
        p.moveTo(lastEndPt.x, lastEndPt.y);
        p.lineTo(0, 0);
      }
    }
    return p;
  }, [activeOptimizedPolylines]);
`;

let norm = content.replace(/\r\n/g, "\n");
const regex = /  \}, \[activeGroups, activePolylines, optimizeOrder, objectOrderMode, pathOrderStrategy\]\);\n/;
if (!regex.test(norm)) {
    console.error("COULD NOT FIND TARGET!");
} else {
    norm = norm.replace(regex, "  }, [activeGroups, activePolylines, optimizeOrder, objectOrderMode, pathOrderStrategy]);\n\n" + patch);
    fs.writeFileSync("src/components/Workspace.tsx", norm);
    console.log("Success!");
}
