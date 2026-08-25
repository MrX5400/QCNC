import React, { useState, useEffect } from 'react';
import { 
  X, 
  Flame, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  Copy, 
  Download, 
  Upload, 
  Check, 
  CheckCircle2, 
  Wind, 
  Zap, 
  Layers, 
  Clock, 
  Gauge, 
  Sliders, 
  RotateCcw,
  Sparkles,
  Info,
  ChevronRight,
  Filter
} from 'lucide-react';
import { 
  LaserMaterialPreset, 
  LaserCategory, 
  LaserOperation, 
  loadLaserPresets, 
  saveLaserPresets, 
  addOrUpdateLaserPreset, 
  deleteLaserPreset, 
  resetLaserPresetsToDefault 
} from '../services/laserDatabaseService';

interface LaserDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset?: (preset: LaserMaterialPreset) => void;
}

const CATEGORIES: { id: LaserCategory | 'All'; label: string }[] = [
  { id: 'All', label: 'Alle Materialien' },
  { id: 'Wood', label: 'Holz & MDF' },
  { id: 'Acrylic', label: 'Acryl / Plexiglas' },
  { id: 'Paper & Cardboard', label: 'Papier & Pappe' },
  { id: 'Leather & Fabric', label: 'Leder & Stoff' },
  { id: 'Stone & Coated Metal', label: 'Stein & Metall' },
  { id: 'Foam & Plastics', label: 'Schaumstoff' },
  { id: 'Custom', label: 'Eigene' },
];

export const LaserDatabaseModal: React.FC<LaserDatabaseModalProps> = ({
  isOpen,
  onClose,
  onSelectPreset,
}) => {
  const [presets, setPresets] = useState<LaserMaterialPreset[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<LaserCategory | 'All'>('All');
  const [selectedOperation, setSelectedOperation] = useState<LaserOperation | 'all'>('all');
  
  // Editor Form state
  const [editingPreset, setEditingPreset] = useState<LaserMaterialPreset | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPresets(loadLaserPresets());
      setEditingPreset(null);
      setIsCreatingNew(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const filteredPresets = presets.filter((p) => {
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesOperation = selectedOperation === 'all' || p.operation === selectedOperation;
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      p.name.toLowerCase().includes(q) ||
      (p.notes && p.notes.toLowerCase().includes(q)) ||
      (p.recommendedLaserWattage && p.recommendedLaserWattage.toLowerCase().includes(q));

    return matchesCategory && matchesOperation && matchesSearch;
  });

  const handleStartNew = () => {
    const newPreset: LaserMaterialPreset = {
      id: `custom-laser-${Date.now()}`,
      name: 'Neues Material',
      category: selectedCategory === 'All' ? 'Custom' : selectedCategory,
      operation: 'cut',
      thicknessMm: 3.0,
      feedrate: 400,
      powerPercent: 80,
      powerSValue: 800,
      passes: 1,
      zStepPerPass: 0,
      airAssist: true,
      laserMode: 'M4',
      recommendedLaserWattage: '10W Diode',
      notes: '',
      isBuiltIn: false,
    };
    setEditingPreset(newPreset);
    setIsCreatingNew(true);
  };

  const handleEdit = (p: LaserMaterialPreset) => {
    setEditingPreset({ ...p });
    setIsCreatingNew(false);
  };

  const handleDuplicate = (p: LaserMaterialPreset) => {
    const duplicated: LaserMaterialPreset = {
      ...p,
      id: `custom-laser-${Date.now()}`,
      name: `${p.name} (Kopie)`,
      isBuiltIn: false,
    };
    const updated = addOrUpdateLaserPreset(duplicated);
    setPresets(updated);
    setEditingPreset(duplicated);
    setIsCreatingNew(false);
    showToast('Material dupliziert!');
  };

  const handleDelete = (id: string) => {
    if (confirm('Dieses Material wirklich aus der Datenbank entfernen?')) {
      const updated = deleteLaserPreset(id);
      setPresets(updated);
      if (editingPreset?.id === id) {
        setEditingPreset(null);
      }
      showToast('Material gelöscht.');
    }
  };

  const handleSaveEditor = () => {
    if (!editingPreset) return;
    if (!editingPreset.name.trim()) {
      alert('Bitte einen Namen für das Material eingeben.');
      return;
    }
    const updated = addOrUpdateLaserPreset({
      ...editingPreset,
      powerSValue: Math.round((editingPreset.powerPercent / 100) * 1000),
    });
    setPresets(updated);
    setEditingPreset(null);
    setIsCreatingNew(false);
    showToast('Material gespeichert!');
  };

  const handleApplyPreset = (p: LaserMaterialPreset) => {
    if (onSelectPreset) {
      onSelectPreset(p);
    }
    showToast(`Parameter für "${p.name}" angewendet!`);
    setTimeout(() => {
      onClose();
    }, 400);
  };

  const handleExportJson = () => {
    const dataStr = JSON.stringify(presets, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laser_material_database_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Datenbank als JSON exportiert!');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          saveLaserPresets(imported);
          setPresets(imported);
          showToast(`${imported.length} Materialien erfolgreich importiert!`);
        }
      } catch (err) {
        alert('Fehler beim Lesen der JSON-Datei.');
      }
    };
    reader.readAsText(file);
  };

  const handleResetDefaults = () => {
    if (confirm('Standard-Materialdatenbank wiederherstellen? Eigene Einträge werden überschrieben.')) {
      const defs = resetLaserPresetsToDefault();
      setPresets(defs);
      setEditingPreset(null);
      showToast('Standard-Datenbank wiederhergestellt.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in duration-150 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col text-slate-200 overflow-hidden relative">
        {/* Modal Top Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center">
              <Flame className="w-4 h-4 text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-100 text-sm sm:text-base">Laser Material & Schnitt-Datenbank</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800/50 font-mono">
                  {presets.length} Profile
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Schnitt- und Gravurparameter für Holz, Acryl, Papier, Leder, Stein & Metalle
              </p>
            </div>
          </div>

          {/* Quick Actions & Close */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJson}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
              title="Datenbank als JSON Datei sichern"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>

            <label className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs cursor-pointer transition-colors" title="Materialdatenbank importieren">
              <Upload className="w-3.5 h-3.5" />
              <span>Import</span>
              <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
            </label>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Body: 2 Columns when editing, or Full Table */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* LEFT: Material Browser & Filter List */}
          <div className={`flex-1 flex flex-col border-r border-slate-800 overflow-hidden ${editingPreset ? 'hidden md:flex md:w-1/2' : 'w-full'}`}>
            {/* Search & Filter Toolbar */}
            <div className="p-3 bg-slate-950/60 border-b border-slate-800 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Material suchen (z. B. Sperrholz, Acryl, Gravur)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 pl-8 pr-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <button
                  onClick={handleStartNew}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-rose-900/30 transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Neues Material</span>
                </button>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                      selectedCategory === cat.id
                        ? 'bg-rose-600 text-white font-semibold shadow-sm'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Operation Filter */}
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/80">
                <span className="text-slate-400">Verfahren:</span>
                <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800 font-medium">
                  <button
                    onClick={() => setSelectedOperation('all')}
                    className={`px-2 py-0.5 rounded ${selectedOperation === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
                  >
                    Alle
                  </button>
                  <button
                    onClick={() => setSelectedOperation('cut')}
                    className={`px-2 py-0.5 rounded ${selectedOperation === 'cut' ? 'bg-rose-950 text-rose-300 font-bold' : 'text-slate-400'}`}
                  >
                    ✂️ Schneiden
                  </button>
                  <button
                    onClick={() => setSelectedOperation('engrave')}
                    className={`px-2 py-0.5 rounded ${selectedOperation === 'engrave' ? 'bg-amber-950 text-amber-300 font-bold' : 'text-slate-400'}`}
                  >
                    ✨ Gravieren
                  </button>
                  <button
                    onClick={() => setSelectedOperation('score')}
                    className={`px-2 py-0.5 rounded ${selectedOperation === 'score' ? 'bg-purple-950 text-purple-300 font-bold' : 'text-slate-400'}`}
                  >
                    〰️ Anritzen
                  </button>
                </div>
              </div>
            </div>

            {/* Material Presets List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredPresets.length === 0 ? (
                <div className="text-center py-12 text-slate-500 space-y-2">
                  <Flame className="w-8 h-8 text-slate-600 mx-auto opacity-40" />
                  <p className="text-xs">Keine Materialien mit diesen Filtern gefunden.</p>
                </div>
              ) : (
                filteredPresets.map((p) => {
                  const isSelected = editingPreset?.id === p.id;
                  const isCut = p.operation === 'cut';
                  const isEngrave = p.operation === 'engrave';

                  return (
                    <div
                      key={p.id}
                      className={`group p-3 rounded-lg border transition-all ${
                        isSelected
                          ? 'bg-rose-950/40 border-rose-500 shadow-md'
                          : 'bg-slate-950/60 hover:bg-slate-800/80 border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-100 text-xs sm:text-sm">
                              {p.name}
                            </span>
                            {/* Operation Badge */}
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isCut 
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : isEngrave
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            }`}>
                              {isCut ? 'Schnitt' : isEngrave ? 'Gravur' : 'Anritzen'}
                            </span>
                            {p.thicknessMm > 0 && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                {p.thicknessMm} mm
                              </span>
                            )}
                          </div>

                          {/* Quick Parameters Badges */}
                          <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400 flex-wrap pt-0.5">
                            <span className="flex items-center gap-1 text-rose-300">
                              <Zap className="w-3 h-3 text-rose-400" />
                              <span>{p.powerPercent}% ({p.powerSValue || Math.round(p.powerPercent * 10)}S)</span>
                            </span>
                            <span className="flex items-center gap-1 text-cyan-300">
                              <Gauge className="w-3 h-3 text-cyan-400" />
                              <span>{p.feedrate} mm/min</span>
                            </span>
                            <span className="flex items-center gap-1 text-slate-300">
                              <Layers className="w-3 h-3 text-slate-400" />
                              <span>{p.passes} {p.passes > 1 ? 'Durchgänge' : 'Durchgang'}</span>
                            </span>
                            {p.airAssist && (
                              <span className="flex items-center gap-0.5 text-blue-300 text-[10px] bg-blue-950/60 px-1 py-0.5 rounded border border-blue-800/40">
                                <Wind className="w-2.5 h-2.5" />
                                <span>Air Assist</span>
                              </span>
                            )}
                          </div>

                          {p.notes && (
                            <p className="text-[10px] text-slate-400 italic line-clamp-1">
                              {p.notes}
                            </p>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {onSelectPreset && (
                            <button
                              onClick={() => handleApplyPreset(p)}
                              className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-md text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
                              title="Diese Einstellungen in Generator / Job übernehmen"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Übernehmen</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleEdit(p)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors"
                            title="Parameter bearbeiten"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDuplicate(p)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors"
                            title="Duplizieren"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {!p.isBuiltIn && (
                            <button
                              onClick={() => handleDelete(p.id)}
                              className="p-1.5 bg-slate-800 hover:bg-rose-900 text-rose-400 rounded transition-colors"
                              title="Löschen"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Database Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>{filteredPresets.length} von {presets.length} Materialien</span>
              <button
                onClick={handleResetDefaults}
                className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Standard-Preset zurücksetzen</span>
              </button>
            </div>
          </div>

          {/* RIGHT: Detail & Live Preset Editor (When active) */}
          {editingPreset ? (
            <div className="flex-1 flex flex-col bg-slate-900/90 overflow-y-auto p-4 space-y-4 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-rose-400" />
                  <h4 className="font-bold text-slate-100 text-sm">
                    {isCreatingNew ? 'Neues Material erstellen' : 'Material-Parameter bearbeiten'}
                  </h4>
                </div>
                <button
                  onClick={() => setEditingPreset(null)}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Fields */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <span className="text-slate-400 text-[11px]">Material Name:</span>
                  <input
                    type="text"
                    value={editingPreset.name}
                    onChange={(e) => setEditingPreset({ ...editingPreset, name: e.target.value })}
                    className="w-full bg-slate-950 px-3 py-2 rounded-lg border border-slate-700 text-slate-100 font-semibold focus:outline-none focus:border-rose-500"
                    placeholder="z. B. Birkensperrholz 3mm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-slate-400 text-[11px]">Kategorie:</span>
                    <select
                      value={editingPreset.category}
                      onChange={(e) => setEditingPreset({ ...editingPreset, category: e.target.value as LaserCategory })}
                      className="w-full bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-200 focus:outline-none"
                    >
                      <option value="Wood">Holz & MDF</option>
                      <option value="Acrylic">Acryl / Plexiglas</option>
                      <option value="Paper & Cardboard">Papier & Pappe</option>
                      <option value="Leather & Fabric">Leder & Stoff</option>
                      <option value="Stone & Coated Metal">Stein & Metall</option>
                      <option value="Foam & Plastics">Schaumstoff</option>
                      <option value="Custom">Benutzerdefiniert</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 text-[11px]">Verfahren:</span>
                    <select
                      value={editingPreset.operation}
                      onChange={(e) => setEditingPreset({ ...editingPreset, operation: e.target.value as LaserOperation })}
                      className="w-full bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-700 text-rose-300 font-bold focus:outline-none"
                    >
                      <option value="cut">✂️ Schneiden (Cut)</option>
                      <option value="engrave">✨ Gravieren (Engrave)</option>
                      <option value="score">〰️ Anritzen (Score / Markieren)</option>
                    </select>
                  </div>
                </div>

                {/* Laser Speed & Power */}
                <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-3 font-mono">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[11px]">Laserleistung:</span>
                      <div className="flex items-center gap-1 bg-slate-900 px-2.5 py-1.5 rounded border border-slate-700">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={editingPreset.powerPercent}
                          onChange={(e) => setEditingPreset({ ...editingPreset, powerPercent: Number(e.target.value) })}
                          className="w-full bg-transparent text-rose-300 font-bold focus:outline-none"
                        />
                        <span className="text-slate-400">%</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-400 text-[11px]">Vorschub (Speed):</span>
                      <div className="flex items-center gap-1 bg-slate-900 px-2.5 py-1.5 rounded border border-slate-700">
                        <input
                          type="number"
                          value={editingPreset.feedrate}
                          onChange={(e) => setEditingPreset({ ...editingPreset, feedrate: Number(e.target.value) })}
                          className="w-full bg-transparent text-cyan-300 font-bold focus:outline-none"
                        />
                        <span className="text-slate-500 text-[10px]">mm/min</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[10px]">Materialstärke:</span>
                      <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-700">
                        <input
                          type="number"
                          step={0.1}
                          value={editingPreset.thicknessMm}
                          onChange={(e) => setEditingPreset({ ...editingPreset, thicknessMm: Number(e.target.value) })}
                          className="w-full bg-transparent text-slate-200 text-xs focus:outline-none"
                        />
                        <span className="text-slate-500 text-[10px]">mm</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-400 text-[10px]">Durchgänge (Passes):</span>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={editingPreset.passes}
                        onChange={(e) => setEditingPreset({ ...editingPreset, passes: Number(e.target.value) })}
                        className="w-full bg-slate-900 px-2 py-1 rounded border border-slate-700 text-slate-200 text-xs text-center"
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-400 text-[10px]">Z-Zustellung/Pass:</span>
                      <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-700">
                        <input
                          type="number"
                          step={0.1}
                          value={editingPreset.zStepPerPass || 0}
                          onChange={(e) => setEditingPreset({ ...editingPreset, zStepPerPass: Number(e.target.value) })}
                          className="w-full bg-transparent text-slate-200 text-xs focus:outline-none"
                        />
                        <span className="text-slate-500 text-[10px]">mm</span>
                      </div>
                    </div>
                  </div>

                  {/* Mode & Air Assist */}
                  <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800">
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[10px]">Laser G-Code Modus:</span>
                      <select
                        value={editingPreset.laserMode}
                        onChange={(e) => setEditingPreset({ ...editingPreset, laserMode: e.target.value as 'M3' | 'M4' })}
                        className="w-full bg-slate-900 px-2 py-1 rounded border border-slate-700 text-xs text-rose-300 font-semibold"
                      >
                        <option value="M4">M4 (Dynamischer Laser)</option>
                        <option value="M3">M3 (Konstante Leistung)</option>
                      </select>
                    </div>

                    <div className="flex items-center pt-4">
                      <label className="flex items-center gap-2 cursor-pointer text-slate-300 font-sans text-xs">
                        <input
                          type="checkbox"
                          checked={editingPreset.airAssist}
                          onChange={(e) => setEditingPreset({ ...editingPreset, airAssist: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-rose-500"
                        />
                        <span>Air Assist aktiv (M8/M9)</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Laser Wattage & Notes */}
                <div className="space-y-1">
                  <span className="text-slate-400 text-[11px]">Empfohlene Laserleistung / Gerät:</span>
                  <input
                    type="text"
                    value={editingPreset.recommendedLaserWattage || ''}
                    onChange={(e) => setEditingPreset({ ...editingPreset, recommendedLaserWattage: e.target.value })}
                    className="w-full bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-200 text-xs"
                    placeholder="z. B. 10W - 20W Diodenlaser"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-slate-400 text-[11px]">Hinweise & Tipps:</span>
                  <textarea
                    rows={2}
                    value={editingPreset.notes || ''}
                    onChange={(e) => setEditingPreset({ ...editingPreset, notes: e.target.value })}
                    className="w-full bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-200 text-xs"
                    placeholder="z. B. Wabenunterlage verwenden, Schutzbrille tragen, Fokus auf Materialoberfläche"
                  />
                </div>
              </div>

              {/* Editor Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <button
                  onClick={() => setEditingPreset(null)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                >
                  Abbrechen
                </button>

                <div className="flex items-center gap-2">
                  {onSelectPreset && (
                    <button
                      onClick={() => handleApplyPreset(editingPreset)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Speichern & Anwenden</span>
                    </button>
                  )}

                  <button
                    onClick={handleSaveEditor}
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-md shadow-rose-900/30 transition-colors"
                  >
                    <span>Speichern</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="hidden md:flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-3 w-1/2 bg-slate-950/30">
              <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                <Flame className="w-6 h-6 text-rose-500/50" />
              </div>
              <div className="max-w-xs space-y-1">
                <h4 className="font-semibold text-slate-300 text-sm">Material auswählen oder erstellen</h4>
                <p className="text-xs text-slate-400">
                  Wähle ein Material aus der Liste links, um dessen Schnitt- und Gravurparameter einzusehen oder mit 1-Klick in deinen Job zu laden.
                </p>
              </div>
              <button
                onClick={handleStartNew}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-300 rounded-lg text-xs font-semibold flex items-center gap-1 border border-slate-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Neues Material anlegen</span>
              </button>
            </div>
          )}
        </div>

        {/* Live Toast */}
        {toastMessage && (
          <div className="absolute bottom-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
