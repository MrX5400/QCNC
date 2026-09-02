const fs = require("fs");
let content = fs.readFileSync("src/components/Workspace.tsx", "utf-8");

const patch = `  const activePath2D = useMemo(() => {
    const p = new Path2D();
    activePolylines.forEach(poly => {
      if (poly.points.length < 2) return;
      p.moveTo(poly.points[0].x, poly.points[0].y);
      for (let i = 1; i < poly.points.length; i++) {
        p.lineTo(poly.points[i].x, poly.points[i].y);
      }
      if (poly.closed) p.closePath();
    });
    return p;
  }, [activePolylines]);

`;

let norm = content.replace(/\r\n/g, "\n");
const regex = /  const draftPath2D = useMemo/s;
if (!regex.test(norm)) console.error("MISSING");
norm = norm.replace(regex, patch + "  const draftPath2D = useMemo");

const oldActiveKnifeRegex = /        \/\/ Draw underlying original path in faint dashed cyan.*?\n        \}\);\n        ctx\.setLineDash\(\[\]\);/s;
const newActiveKnife = `        // Draw underlying original path in faint dashed cyan
        ctx.save();
        ctx.strokeStyle = theme.isDark ? 'rgba(6, 182, 212, 0.35)' : 'rgba(6, 182, 212, 0.6)';
        ctx.translate(pan.x, pan.y);
        ctx.scale(zoom, -zoom);
        ctx.lineWidth = 1.2 / zoom;
        // setLineDash scales with canvas scale, so adjust dash pattern by inverse zoom
        ctx.setLineDash([3 / zoom, 3 / zoom]);
        ctx.stroke(activePath2D);
        ctx.restore();`;

if (!oldActiveKnifeRegex.test(norm)) console.error("MISSING OLD ACTIVE KNIFE");
norm = norm.replace(oldActiveKnifeRegex, newActiveKnife);

const oldDraftKnifeRegex = /          ctx\.strokeStyle = 'rgba\(6, 182, 212, 0\.35\)';\n          ctx\.lineWidth = 1\.2;\n          ctx\.setLineDash\(\[3, 3\]\);\n          draftPolylines\.forEach.*?ctx\.fill\(\);\n            \} else if /s;
// We only want to replace the first loop: draftPolylines.forEach()
const newDraftKnifeRegex = /          ctx\.strokeStyle = 'rgba\(6, 182, 212, 0\.35\)';\n          ctx\.lineWidth = 1\.2;\n          ctx\.setLineDash\(\[3, 3\]\);\n          draftPolylines\.forEach\(\(poly\) => \{\n            if \(poly\.points\.length < 2\) return;\n            ctx\.beginPath\(\);\n            ctx\.moveTo\(toScreenX\(poly\.points\[0\]\.x\), toScreenY\(poly\.points\[0\]\.y\)\);\n            for \(let i = 1; i < poly\.points\.length; i\+\+\) \{\n              ctx\.lineTo\(toScreenX\(poly\.points\[i\]\.x\), toScreenY\(poly\.points\[i\]\.y\)\);\n            \}\n            if \(poly\.closed\) ctx\.closePath\(\);\n            ctx\.stroke\(\);\n          \}\);\n          ctx\.setLineDash\(\[\]\);/s;

const newDraftKnife = `          ctx.save();
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
          ctx.translate(pan.x, pan.y);
          ctx.scale(zoom, -zoom);
          ctx.lineWidth = 1.2 / zoom;
          ctx.setLineDash([3 / zoom, 3 / zoom]);
          ctx.stroke(draftPath2D);
          ctx.restore();`;

if (!newDraftKnifeRegex.test(norm)) console.error("MISSING DRAFT KNIFE");
norm = norm.replace(newDraftKnifeRegex, newDraftKnife);

fs.writeFileSync("src/components/Workspace.tsx", norm);
console.log("Success with Patch 4!");
