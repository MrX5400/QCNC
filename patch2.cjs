const fs = require("fs");
let content = fs.readFileSync("src/components/Workspace.tsx", "utf-8");

const oldActive = `      } else if (showCutPaths) {
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
      }`;

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

const oldRapid = `        } else if (activeOptimizedPolylines.length > 0) {
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
        }`;

const newRapid = `        } else if (activeOptimizedPolylines.length > 0) {
          ctx.save();
          ctx.translate(pan.x, pan.y);
          ctx.scale(zoom, -zoom);
          ctx.lineWidth = 1.2 / zoom;
          ctx.stroke(rapidPath2D);
          ctx.restore();
        }`;

const oldDraft = `        } else {
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
        }`;

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

if (!content.includes(oldActive)) console.error("oldActive missing!");
if (!content.includes(oldRapid)) console.error("oldRapid missing!");
if (!content.includes(oldDraft)) console.error("oldDraft missing!");

content = content.replace(oldActive, newActive);
content = content.replace(oldRapid, newRapid);
content = content.replace(oldDraft, newDraft);

fs.writeFileSync("src/components/Workspace.tsx", content);
console.log("Success!");
