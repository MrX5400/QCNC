import re

with open('Workspace.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

def find_idx(sub):
    for i, l in enumerate(lines):
        if sub in l: return i
    return -1

def get_block_end(start_idx):
    open_braces = 0
    started = False
    for i in range(start_idx, len(lines)):
        open_braces += lines[i].count('{') - lines[i].count('}')
        if lines[i].count('{') > 0:
            started = True
        if started and open_braces == 0:
            return i
    return -1

# 1. State hooks
idx_opt_grp = find_idx('orderedGroups: activeOptimizedGroups')
idx_opt_grp_end = get_block_end(idx_opt_grp)
idx_localsim = find_idx('const localSimSegments = useMemo(() => {')
idx_localsim_end = get_block_end(idx_localsim)

new_blocks = """
  // --- STATE FOR MANUAL G-CODE GENERATION ---
  const [isGcodeOutdated, setIsGcodeOutdated] = useState(true);
  const [isGeneratingGcode, setIsGeneratingGcode] = useState(false);
  
  const [genData, setGenData] = useState<{
    gcode: string;
    stats: any;
    optimizedGroups: any[];
    optimizedPolylines: VectorPolyline[];
    dragKnifeResult: CompensatedPathResult | null;
  } | null>(null);

  // Mark G-Code as outdated when source paths or settings change
  useEffect(() => {
    setIsGcodeOutdated(true);
  }, [
    activePolylines, targetMode, currentProfile, 
    penOptions, dragKnifeOptions, laserOptions, 
    optimizeOrder, objectOrderMode, pathOrderStrategy
  ]);

  // Derived properties from generation result (fallback to live arrays where needed)
  const activeOptimizedGroups = genData?.optimizedGroups || activeGroups;
  const activeOptimizedPolylines = genData?.optimizedPolylines || activePolylines;
  const dragKnifeResult = genData?.dragKnifeResult || null;
  const generatedGcode = genData?.gcode || '; Bitte Maschinendaten generieren';
  const localSimSegments = useMemo(() => {
    return parseGcode(generatedGcode, currentProfile.penUpZ || 2).segments || [];
  }, [generatedGcode, currentProfile.penUpZ]);

  // --- Compute Live Basic Bounds (always fast) ---
  const stats = useMemo(() => {
    if (genData?.stats && !isGcodeOutdated) return genData.stats;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let pointCount = 0;
    activePolylines.forEach(p => {
      for (let i = 0; i < p.points.length; i++) {
        const pt = p.points[i];
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
        pointCount++;
      }
    });
    const width = maxX === -Infinity ? 0 : Math.max(0, maxX - minX);
    const height = maxY === -Infinity ? 0 : Math.max(0, maxY - minY);
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
      pathsCount: activePolylines.length,
      zRetracts: activePolylines.length,
      pointCount,
      cutLengthMm: 0,
      rapidLengthMm: 0,
      estSeconds: 0,
    };
  }, [activePolylines, genData, isGcodeOutdated, targetMode, dragKnifeOptions, penOptions]);

  // --- Manual Generator Function ---
  const handleGenerateGcode = async () => {
    setIsGeneratingGcode(true);
    await new Promise(r => setTimeout(r, 50));
    try {
      const { orderedGroups: optGroups, orderedPolylines: optPolylines } = getOptimizedPolylinesAndGroups({
        groups: activeGroups,
        polylines: activePolylines,
        optimizeOrder,
        objectOrderMode,
        pathOrderStrategy,
      });

      let dkr: CompensatedPathResult | null = null;
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

      const gcodeStr = generateUniversalGcode({
        groups: optGroups,
        targetMode: actualTargetMode,
        profile: currentProfile,
        penOptions,
        dragKnifeOptions,
        laserOptions: actualLaserOptions,
        optimizeOrder: false,
        objectOrderMode,
        pathOrderStrategy,
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
"""

lines = lines[:idx_opt_grp] + [new_blocks + '\n'] + lines[idx_localsim_end+1:]

# 2. Remove autoSync effect
def remove_autosync(lines):
    idx = find_idx('// Auto-sync generated G-code to main visualizer')
    if idx != -1:
        end = get_block_end(idx+1)
        lines = lines[:idx] + lines[end+1:]
    return lines
lines = remove_autosync(lines)

# 3. Add UI Button under optimization
def add_generate_button(lines):
    # Find the end of optimizeOrder block, maybe around `</div>` before `</button>`
    idx = -1
    for i, l in enumerate(lines):
        if '<div className="pt-2.5 pb-1 border-t border-slate-800 space-y-2">' in l:
            idx = i
            break
    if idx != -1:
        # Let's insert the button right above this section, or at the bottom of the wizard
        # Let's just search for the end of the step 3 block. It's inside the `.space-y-4` container.
        pass
    
    # Or find: {/* Leerfahrtberechnung & Bearbeitungsreihenfolge (Hauptfenster) */}
    idx2 = find_idx('{/* Leerfahrtberechnung & Bearbeitungsreihenfolge (Hauptfenster) */}')
    if idx2 != -1:
        end2 = get_block_end(idx2+1) # This is a div
        
        button_html = """
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
                    <Zap className="w-5 h-5" />
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
"""
        # Insert button_html after end2
        lines = lines[:end2+1] + [button_html] + lines[end2+1:]
    return lines
lines = add_generate_button(lines)

# 4. Modify renderPreview to only show rapid moves if !isGcodeOutdated
for i, l in enumerate(lines):
    if 'if (showRapid) {' in l:
        lines[i] = l.replace('if (showRapid) {', 'if (showRapid && !isGcodeOutdated) {')
    if 'if (showRapid &&' in l and '!isGcodeOutdated' not in l:
        # Just in case
        pass
        
    # Same for draft dragging rapid moves? Not needed.
    
# 5. Fix icons import if Zap/Check are missing (but we know Check is used later, Zap might not be. Let's use Play or Settings if Zap not imported. Wait, Zap is usually imported from lucide-react. We can just use Sparkles or Play.)
# Actually, let's use Settings or Download. "Code" is imported.
for i, l in enumerate(lines):
    if 'Zap className' in l:
        lines[i] = l.replace('<Zap', '<Code')

with open('Workspace.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
