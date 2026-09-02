const fs = require("fs");
let content = fs.readFileSync("src/components/Workspace.tsx", "utf-8");

// Convert everything to \n just to be safe for matching
let norm = content.replace(/\r\n/g, "\n");

// Replace oldActive
const oldActiveRegex = /      \} else if \(showCutPaths\) \{\n        \/\/ Cut \/ Tool Paths.*?ctx\.fill\(\);\n        \}\);\n      \}/s;
const newActive = `      } else if (showCutPaths) {
        // Cut / Tool Paths (G1) (Unified Bearbeitung / Schnitt: Solid Emerald Green)
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = theme.cutLineColor || '#10b981';

        // Fast Hardware-Accelerated Draw using Path2D
        ctx.translate(pan.x, pan.y);
        ctx.scale(zoom, -zoom);
        ctx.lineWidth = 2 / zoom;
        ctx.stroke(activeOptimizedPath2D);
        ctx.restore();

        // Green Plunge Dots at Start Point (rendered manually to keep screen-space size)
        ctx.fillStyle = theme.cutLineColor || '#22c55e';
        ctx.beginPath();
        activeOptimizedPolylines.forEach((poly) => {
          if (poly.points.length < 2) return;
          const px = toScreenX(poly.points[0].x);
          const py = toScreenY(poly.points[0].y);
          ctx.moveTo(px + 2.5, py);
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        });
        ctx.fill();
      }`;
norm = norm.replace(oldActiveRegex, newActive);

// Replace oldRapid
const oldRapidRegex = /        \} else if \(activeOptimizedPolylines\.length > 0\) \{\n          \/\/ 1\. Rapid from Bed Origin.*?ctx\.stroke\(\);\n          \}\n        \}/s;
const newRapid = `        } else if (activeOptimizedPolylines.length > 0) {
          ctx.save();
          ctx.translate(pan.x, pan.y);
          ctx.scale(zoom, -zoom);
          ctx.lineWidth = 1.2 / zoom;
          ctx.stroke(rapidPath2D);
          ctx.restore();
        }`;
norm = norm.replace(oldRapidRegex, newRapid);

// Replace oldDraft
const oldDraftRegex = /        \} else \{\n          \/\/ Draft Cut Paths in Glowing Cyan.*?ctx\.fill\(\);\n          \}\);\n        \}/s;
const newDraft = `        } else {
          // Draft Cut Paths in Glowing Cyan
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = theme.accentColor || '#06b6d4';
          
          ctx.translate(pan.x, pan.y);
          ctx.scale(zoom, -zoom);
          ctx.lineWidth = 2.2 / zoom;
          ctx.stroke(draftPath2D);
          ctx.restore();

          // Plunge node dots
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          draftPolylines.forEach((poly) => {
            if (poly.points.length < 2) return;
            const px = toScreenX(poly.points[0].x);
            const py = toScreenY(poly.points[0].y);
            ctx.moveTo(px + 2.5, py);
            ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          });
          ctx.fill();
        }`;
norm = norm.replace(oldDraftRegex, newDraft);

fs.writeFileSync("src/components/Workspace.tsx", norm);
console.log("Success with Regex!");
