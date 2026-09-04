import sys
import re

def find_idx(lines, text):
    for i, l in enumerate(lines):
        if text in l:
            return i
    return -1

def get_block_end(lines, start_idx):
    depth = 0
    for i in range(start_idx, len(lines)):
        depth += lines[i].count('{') - lines[i].count('}')
        if depth == 0 and lines[i].count('}') > 0:
            return i
    return start_idx

with open('Workspace.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 1. State changes
idx_state = find_idx(lines, "const [isGcodeOutdated, setIsGcodeOutdated]")
if idx_state == -1: # It doesn't exist, we need to create it!
    # Let's add the state around line 250
    idx_state = find_idx(lines, "const [liveDragOffsets, setLiveDragOffsets]")
    if idx_state != -1:
        state_block = """  // --- STATE FOR MANUAL G-CODE GENERATION ---
  const [isGcodeOutdated, setIsGcodeOutdated] = useState(true);
  const [autoGenerateGcode, setAutoGenerateGcode] = useState(false);
  const [isGeneratingGcode, setIsGeneratingGcode] = useState(false);
  
  const [genData, setGenData] = useState<{
    gcode: string;
    stats: any;
    optimizedGroups: any[];
    optimizedPolylines: any[];
    dragKnifeResult: any;
  } | null>(null);
"""
        lines.insert(idx_state + 1, state_block)

# 2. Add handleGenerateGcode
idx_gen = find_idx(lines, "const handleDownloadGcode")
if idx_gen != -1:
    handle_fn = """
  // --- Manual Generator Function ---
  const handleGenerateGcode = async () => {
    setIsGeneratingGcode(true);
    await new Promise(r => setTimeout(r, 50));
    try {
      const { orderedGroups: optGroups, orderedPolylines: optPolylines } = await getOptimizedPolylinesAndGroups({
        groups: activeGroups,
        polylines: activePolylines,
        optimizeOrder,
        objectOrderMode,
        pathOrderStrategy,
      });

      let dkr = null;
      if (targetMode === 'dragknife' && optPolylines.length > 0) {
        dkr = applyDragKnifeCompensation(
          optPolylines.map(p => ({ points: p.points, closed: p.closed })),
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
          optGroups.map(g => ({
            name: g.name,
            paths: g.polylines.map(p => ({ points: p.points, closed: p.closed })),
          }))
        );
      }

      let actualTargetMode = targetMode;
      let actualLaserOptions = { ...laserOptions };
      const hasDynamicPower = activePolylines.some(p => p.toolPower !== undefined || p.points.some((pt: any) => pt.s !== undefined));
      if (hasDynamicPower) {
        actualTargetMode = 'laser';
        actualLaserOptions.laserMode = 'M4';
      }

      const gcodeStr = await generateUniversalGcode({
        groups: optGroups,
        targetMode: actualTargetMode,
        profile: currentProfile,
        penOptions,
        dragKnifeOptions,
        laserOptions: actualLaserOptions,
        optimizeOrder: false,
      });

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

      let totalRapidLength = 0;
      if (targetMode === 'dragknife' && dkr && dkr.compensatedSegments.length > 0) {
        dkr.compensatedSegments.forEach(seg => {
          if (seg.type === 'G0' || (seg as any).type === 'rapid') {
            totalRapidLength += Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y);
          }
        });
      } else if (optPolylines.length > 0) {
        const firstPt = optPolylines[0].points[0];
        if (firstPt) totalRapidLength += Math.hypot(firstPt.x - 0, firstPt.y - 0);
        for (let i = 0; i < optPolylines.length - 1; i++) {
          const curr = optPolylines[i];
          const next = optPolylines[i + 1];
          if (curr.points.length > 0 && next.points.length > 0) {
            const endPt = curr.closed ? curr.points[0] : curr.points[curr.points.length - 1];
            const nextStartPt = next.points[0];
            totalRapidLength += Math.hypot(nextStartPt.x - endPt.x, nextStartPt.y - endPt.y);
          }
        }
        const lastPoly = optPolylines[optPolylines.length - 1];
        if (lastPoly && lastPoly.points.length > 0) {
          const lastEndPt = lastPoly.closed ? lastPoly.points[0] : lastPoly.points[lastPoly.points.length - 1];
          totalRapidLength += Math.hypot(lastEndPt.x - 0, lastEndPt.y - 0);
        }
      }

      const width = maxX === -Infinity ? 0 : Math.max(0, maxX - minX);
      const height = maxY === -Infinity ? 0 : Math.max(0, maxY - minY);
      const pathsCount = activePolylines.length;

      const feed = targetMode === 'dragknife' ? dragKnifeOptions.cuttingFeedrate : (targetMode === 'laser' ? laserOptions.feedrate : penOptions.drawingFeedrate);
      const travelFeed = targetMode === 'dragknife' ? (dragKnifeOptions.travelFeedrate || currentProfile.travelFeedrate || 3000) : (targetMode === 'pen' ? (penOptions.travelFeedrate || currentProfile.travelFeedrate || 3000) : (currentProfile.travelFeedrate || 3000));
      const cutTimeSec = (totalCutLength / Math.max(100, feed)) * 60;
      const travelTimeSec = (totalRapidLength / Math.max(100, travelFeed)) * 60;
      const estSec = Math.round(cutTimeSec + travelTimeSec + pathsCount * 0.3);

      const computedStats = {
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
        zRetracts: optPolylines.length > 0 ? optPolylines.length : pathsCount,
        pointCount,
        cutLengthMm: Math.round(totalCutLength),
        rapidLengthMm: Math.round(totalRapidLength),
        estSeconds: estSec,
      };

      setGenData({
        gcode: gcodeStr,
        stats: computedStats,
        optimizedGroups: optGroups,
        optimizedPolylines: optPolylines,
        dragKnifeResult: dkr,
      });
      setIsGcodeOutdated(false);
      
      const parsed = parseGcode(gcodeStr, currentProfile.penUpZ || 2);
      onGcodeGenerated(parsed);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingGcode(false);
    }
  };

  useEffect(() => {
    if (autoGenerateGcode && isGcodeOutdated && !isGeneratingGcode) {
      handleGenerateGcode();
    }
  }, [autoGenerateGcode, isGcodeOutdated, isGeneratingGcode]);
"""
    lines.insert(idx_gen, handle_fn)

# 3. Replace useMemo hooks that were removed
full_text = "".join(lines)
# Remove useMemo for activeOptimizedGroups, activeOptimizedPolylines, dragKnifeResult, generatedGcode, computedStats
memoregs = [
    r"const activeOptimizedGroups = useMemo.*?;\n  }, \[.*?\]\);",
    r"const activeOptimizedPolylines = useMemo.*?;\n  }, \[.*?\]\);",
    r"const dragKnifeResult = useMemo.*?;\n  }, \[.*?\]\);",
    r"const generatedGcode = useMemo.*?;\n  }, \[.*?\]\);",
    r"const computedStats = useMemo.*?;\n  }, \[.*?\]\);"
]
for reg in memoregs:
    full_text = re.sub(reg, "", full_text, flags=re.DOTALL)

# Insert fallback variable declarations instead of the useMemos
fallback_vars = """
  const activeOptimizedGroups = (!isGcodeOutdated && genData?.optimizedGroups) ? genData.optimizedGroups : activeGroups;
  const activeOptimizedPolylines = (!isGcodeOutdated && genData?.optimizedPolylines) ? genData.optimizedPolylines : activePolylines;
  const dragKnifeResult = (!isGcodeOutdated && genData?.dragKnifeResult) ? genData.dragKnifeResult : null;
  const generatedGcode = (!isGcodeOutdated && genData?.gcode) ? genData.gcode : '; Bitte Maschinendaten generieren';
  const computedStats = (!isGcodeOutdated && genData?.stats) ? genData.stats : { minX:0, maxX:0, minY:0, maxY:0, width:0, height:0, pathsCount:0, pointCount:0, cutLengthMm:0, rapidLengthMm:0, estSeconds:0 };
"""
idx_fallback = full_text.find("const handleDownloadGcode")
full_text = full_text[:idx_fallback] + fallback_vars + full_text[idx_fallback:]

# 4. Remove auto-sync effect
full_text = re.sub(r"// Auto-sync generated G-code to main visualizer.*?useEffect\(\(\) => \{.*?onGcodeGenerated\(parsed\);\n  \}, \[generatedGcode, currentProfile\.penUpZ, onGcodeGenerated\]\);", "", full_text, flags=re.DOTALL)

# 5. Make showRapid respect isGcodeOutdated
full_text = full_text.replace("if (showRapid) {", "if (showRapid && !isGcodeOutdated) {")

# 6. Add button UI
# The settings block ends with "</div>\n            </div>\n\n          </div>\n        </div>" inside the sidebar.
ui_target = """              </div>
            </div>

          </div>
        </div>"""

ui_replacement = """              </div>
            </div>

            {/* MANUELLE G-CODE GENERIERUNG */}
            <div className="pt-4 pb-2 border-t border-slate-800">
              <button
                onClick={handleGenerateGcode}
                disabled={isGeneratingGcode || activePolylines.length === 0}
                className={`w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
                  isGeneratingGcode
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : isGcodeOutdated
                    ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse shadow-amber-900/50'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/50'
                }`}
              >
                {isGeneratingGcode ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Generiere Maschinendaten...</span>
                  </>
                ) : isGcodeOutdated ? (
                  <>
                    <Code className="w-5 h-5" />
                    <span>Maschinendaten / G-Code generieren</span>
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    <span>G-Code ist aktuell</span>
                  </>
                )}
              </button>
            </div>
            {/* Auto-Generate Toggle */}
            <div className="mt-3 flex items-center justify-between bg-slate-900/50 p-2.5 rounded-lg border border-slate-700/50">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${autoGenerateGcode ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-600'}`}></div>
                <span className="text-sm font-medium text-slate-300">Live-Generierung (Auto)</span>
              </div>
              <button
                onClick={() => setAutoGenerateGcode(!autoGenerateGcode)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                  autoGenerateGcode ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <span className="sr-only">Auto-Generate Toggle</span>
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    autoGenerateGcode ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

          </div>
        </div>"""

full_text = full_text.replace(ui_target, ui_replacement)

# Finally, setting isGcodeOutdated to true on changes
full_text = full_text.replace("const handleMoveObject", "const handleMoveObject = (id, dx, dy) => { setIsGcodeOutdated(true); ")
full_text = full_text.replace("const handleDeleteObject", "const handleDeleteObject = (id) => { setIsGcodeOutdated(true); ")
# It's easier to just use useEffect to set isGcodeOutdated when deps change:
dep_effect = """
  // Trigger outdated state when parameters change
  useEffect(() => {
    setIsGcodeOutdated(true);
  }, [activeGroups, activePolylines, optimizeOrder, objectOrderMode, pathOrderStrategy, targetMode, dragKnifeOptions, penOptions, laserOptions, currentProfile]);
"""
full_text = full_text.replace("const handleDownloadGcode", dep_effect + "const handleDownloadGcode")


with open('Workspace.tsx', 'w', encoding='utf-8') as f:
    f.write(full_text)
