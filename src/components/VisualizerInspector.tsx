import React, { useState } from 'react';
import {
  Layers,
  Scaling,
  RotateCw,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Copy,
  AlignCenter,
  CornerDownLeft,
  Ruler,
  FlipHorizontal,
  FlipVertical,
  X,
  Sparkles,
  ChevronRight,
  Sliders,
  Check,
  Crosshair
} from 'lucide-react';
import { GcodeObjectIsland } from '../services/transformGcode';

export interface VisualizerInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  selectedObjectIds: number[];
  setSelectedObjectIds: React.Dispatch<React.SetStateAction<number[]>>;
  gcodeObjects: GcodeObjectIsland[];
  customObjectNames: Record<number, string>;
  setCustomObjectNames: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  hiddenObjectIds: number[];
  setHiddenObjectIds: React.Dispatch<React.SetStateAction<number[]>>;
  lockedObjectIds: number[];
  setLockedObjectIds: React.Dispatch<React.SetStateAction<number[]>>;
  hoveredObjectId: number | null;
  setHoveredObjectId: (id: number | null) => void;
  handleCenterOnBed: (targetIds?: number[]) => void;
  handleMoveToOrigin: (targetIds?: number[]) => void;
  handleApplyTransform: (dx: number, dy: number, rotDeg: number, scale: number, targetIds?: number[]) => void;
  handleDuplicateObjects: (targetIds?: number[]) => void;
  handleDeleteObject: (id: number) => void;
  handleDeleteSelected: () => void;
  actualBounds: { width: number; height: number; minX: number; maxX: number; minY: number; maxY: number };
  sollX: number;
  sollY: number;
  sollZ: number;
  setSollZ: (val: number) => void;
  handleSollXChange: (val: number) => void;
  handleSollYChange: (val: number) => void;
  handleApplySollDimensions: () => void;
  handleFitToBed: () => void;
  lockAspect: boolean;
  setLockAspect: (val: boolean) => void;
  onOpenGenerator?: () => void;
}

export const VisualizerInspector: React.FC<VisualizerInspectorProps> = ({
  isOpen,
  onClose,
  selectedObjectIds,
  setSelectedObjectIds,
  gcodeObjects,
  customObjectNames,
  setCustomObjectNames,
  hiddenObjectIds,
  setHiddenObjectIds,
  lockedObjectIds,
  setLockedObjectIds,
  hoveredObjectId,
  setHoveredObjectId,
  handleCenterOnBed,
  handleMoveToOrigin,
  handleApplyTransform,
  handleDuplicateObjects,
  handleDeleteObject,
  handleDeleteSelected,
  actualBounds,
  sollX,
  sollY,
  sollZ,
  setSollZ,
  handleSollXChange,
  handleSollYChange,
  handleApplySollDimensions,
  handleFitToBed,
  lockAspect,
  setLockAspect,
  onOpenGenerator,
}) => {
  const [activeTab, setActiveTab] = useState<'objects'>('objects');
  const [shiftStep, setShiftStep] = useState<number>(10);
  const [customOffsetX, setCustomOffsetX] = useState<number>(0);
  const [customOffsetY, setCustomOffsetY] = useState<number>(0);
  const [customRotDeg, setCustomRotDeg] = useState<number>(0);

  if (!isOpen) return null;

  const selectedObject = gcodeObjects.find(o => selectedObjectIds.includes(o.id));

  return (
    <div className="w-84 sm:w-92 h-full bg-slate-900/98 backdrop-blur-md border-l border-slate-800 flex flex-col z-30 shadow-2xl text-slate-200 animate-in slide-in-from-right-4 duration-200 select-none">
      {/* Panel Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-indigo-400" />
          <span className="font-bold text-sm text-slate-100">Werkzeug-Inspektor</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[0.6875rem] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
            {gcodeObjects.length} {gcodeObjects.length === 1 ? 'Objekt' : 'Objekte'}
          </span>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
            title="Inspektor schließen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950/40 p-1 gap-1 shrink-0 text-xs font-medium">
        <button
          onClick={() => setActiveTab('objects')}
          className={`flex-1 py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'objects'
              ? 'bg-indigo-600 text-white font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Ebenen ({gcodeObjects.length})</span>
        </button>
      </div>

      {/* Target Indicator Sub-bar */}
      <div className="px-4 py-1.5 bg-indigo-950/40 border-b border-indigo-900/30 flex items-center justify-between text-[0.6875rem] shrink-0">
        <span className="text-slate-400">Aktives Ziel:</span>
        <span className="font-semibold text-indigo-300 truncate max-w-[200px]">
          {selectedObjectIds.length === 0
            ? 'Gesamtes Motiv (Alle)'
            : selectedObjectIds.length === 1
            ? (selectedObject?.name || '1 Objekt')
            : `${selectedObjectIds.length} Objekte ausgewählt`}
        </span>
      </div>

      {/* Tab Body Contents */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 custom-scrollbar">
        {/* ========================================================================= */}
        {/* TAB 1: OBJECTS & LAYERS                                                   */}
        {/* ========================================================================= */}
        {activeTab === 'objects' && (
          <div className="space-y-3">
            {/* Quick Multi-Select / Visibility bar */}
            <div className="flex items-center justify-between gap-1 text-[0.6875rem] pb-1 border-b border-slate-800">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSelectedObjectIds(gcodeObjects.map(o => o.id))}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[0.6875rem]"
                >
                  Alle wählen
                </button>
                <button
                  onClick={() => setSelectedObjectIds([])}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded text-[0.6875rem]"
                >
                  Leeren
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setHiddenObjectIds([])}
                  className="p-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded"
                  title="Alle einblenden"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setHiddenObjectIds(gcodeObjects.map(o => o.id))}
                  className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded"
                  title="Alle ausblenden"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Object List */}
            <div className="space-y-2">
              {gcodeObjects.map((obj) => {
                const isSelected = selectedObjectIds.includes(obj.id);
                const isHidden = hiddenObjectIds.includes(obj.id);
                const isLocked = lockedObjectIds.includes(obj.id);
                const isHovered = hoveredObjectId === obj.id;
                const w = obj.bounds.width;
                const h = obj.bounds.height;

                return (
                  <div
                    key={obj.id}
                    onMouseEnter={() => setHoveredObjectId(obj.id)}
                    onMouseLeave={() => setHoveredObjectId(null)}
                    className={`p-2.5 rounded-lg border transition-all text-xs space-y-1.5 ${
                      isSelected
                        ? 'bg-indigo-950/60 border-indigo-500 shadow-md ring-1 ring-indigo-500/30'
                        : isHovered
                        ? 'bg-slate-800/80 border-slate-700'
                        : 'bg-slate-950/60 border-slate-800'
                    } ${isHidden ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedObjectIds(prev => [...prev, obj.id]);
                            } else {
                              setSelectedObjectIds(prev => prev.filter(id => id !== obj.id));
                            }
                          }}
                          className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={customObjectNames[obj.id] ?? obj.name}
                          onChange={(e) => {
                            const newName = e.target.value;
                            setCustomObjectNames(prev => ({ ...prev, [obj.id]: newName }));
                          }}
                          className="bg-transparent hover:bg-slate-900 focus:bg-slate-900 px-1 py-0.5 rounded text-xs font-semibold text-slate-200 focus:text-white border border-transparent focus:border-slate-700 truncate w-full outline-hidden"
                        />
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setHiddenObjectIds(prev =>
                              prev.includes(obj.id) ? prev.filter(id => id !== obj.id) : [...prev, obj.id]
                            );
                          }}
                          className={`p-1 rounded transition-colors ${
                            isHidden ? 'text-slate-600 hover:text-slate-400' : 'text-emerald-400 hover:text-emerald-300'
                          }`}
                          title={isHidden ? 'Einblenden' : 'Ausblenden'}
                        >
                          {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => {
                            setLockedObjectIds(prev =>
                              prev.includes(obj.id) ? prev.filter(id => id !== obj.id) : [...prev, obj.id]
                            );
                          }}
                          className={`p-1 rounded transition-colors ${
                            isLocked ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
                          }`}
                          title={isLocked ? 'Position fixiert (Gesperrt)' : 'Frei beweglich'}
                        >
                          {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[0.625rem] text-slate-400 font-mono px-0.5">
                      <span className="text-indigo-300 font-semibold">{w.toFixed(1)} × {h.toFixed(1)} mm</span>
                      <span>{obj.segmentCount} Segmente</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-800/80 text-[0.625rem]">
                      <button
                        onClick={() => handleCenterOnBed([obj.id])}
                        className="py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded font-medium transition-colors"
                        title="Auf Bettmitte zentrieren"
                      >
                        Zentrieren
                      </button>
                      <button
                        onClick={() => handleDuplicateObjects([obj.id])}
                        className="py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded font-medium transition-colors"
                        title="Objekt duplizieren"
                      >
                        Kopieren
                      </button>
                      <button
                        onClick={() => handleDeleteObject(obj.id)}
                        className="py-1 bg-rose-950/50 hover:bg-rose-900 text-rose-300 rounded font-medium transition-colors border border-rose-800/40"
                        title="Objekt löschen"
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Batch actions footer */}
            {selectedObjectIds.length > 1 && (
              <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-lg flex items-center justify-between gap-2">
                <span className="text-xs text-indigo-300 font-medium">{selectedObjectIds.length} gewählt</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleDeleteSelected}
                    className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900 text-rose-200 border border-rose-800/50 rounded text-xs font-medium flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Löschen</span>
                  </button>
                  <button
                    onClick={() => handleDuplicateObjects()}
                    className="px-2.5 py-1 bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 border border-indigo-700/60 rounded text-xs font-medium flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Duplizieren</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Panel Footer */}
      {onOpenGenerator && (
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 shrink-0">
          <button
            onClick={onOpenGenerator}
            className="w-full py-2 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Im Generator bearbeiten / nachladen</span>
          </button>
        </div>
      )}
    </div>
  );
};
