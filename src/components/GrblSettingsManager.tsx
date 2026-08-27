import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Search, 
  Save, 
  RefreshCw, 
  Download, 
  Upload, 
  HelpCircle, 
  Check, 
  AlertCircle,
  Cpu,
  Layers
} from 'lucide-react';
import { grbl } from '../services/grblService';
import { GrblSetting } from '../types/cnc';
import { DEFAULT_GRBL_SETTINGS } from '../services/grblSettingsData';

export const GrblSettingsManager: React.FC = () => {
  const [settings, setSettings] = useState<GrblSetting[]>(DEFAULT_GRBL_SETTINGS);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});
  const [savedSuccessId, setSavedSuccessId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = grbl.onSettings((newSettings) => {
      setSettings(newSettings);
      const initialMap: Record<string, string> = {};
      newSettings.forEach(s => initialMap[s.id] = s.value);
      setEditingValues(initialMap);
    });

    // Request settings on mount
    grbl.requestAllSettings();

    return () => unsub();
  }, []);

  const categories = ['ALL', 'Steps', 'Speeds & Accel', 'Inversion', 'Limits & Homing', 'Spindle / Laser', 'General'];

  const filteredSettings = settings.filter((s) => {
    const matchesCategory = selectedCategory === 'ALL' || s.category === selectedCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch = s.id.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const handleSaveSetting = async (id: string) => {
    const val = editingValues[id] ?? settings.find(s => s.id === id)?.value;
    if (val !== undefined) {
      await grbl.updateSetting(id, val);
      setSavedSuccessId(id);
      setTimeout(() => setSavedSuccessId(null), 2000);
    }
  };

  const handleReloadFromGrbl = async () => {
    await grbl.requestAllSettings();
  };

  const handleExportBackup = () => {
    const lines = settings.map(s => `${s.id}=${editingValues[s.id] || s.value}`);
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `grbl_settings_backup_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4 shadow-lg text-slate-200">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-indigo-400" />
          <h3 className="font-semibold text-sm text-slate-100">GRBL $$ Konfigurations-Manager</h3>
          <span className="text-[0.6875rem] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
            {settings.length} Parameter
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReloadFromGrbl}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-medium border border-slate-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Aus GRBL neu laden ($$)</span>
          </button>

          <button
            onClick={handleExportBackup}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-medium border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Backup exportieren</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded font-medium transition-colors whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat === 'ALL' ? 'Alle anzeigen' : cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Suchen ($100, steps, accel)..."
            className="w-full bg-slate-950 text-slate-200 rounded-md pl-8 pr-3 py-1.5 border border-slate-800 text-xs focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Settings Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-950 text-slate-400 font-mono text-[0.6875rem] border-b border-slate-800">
            <tr>
              <th className="p-2.5 w-16">ID</th>
              <th className="p-2.5">Name & Beschreibung</th>
              <th className="p-2.5 w-32">Kategorie</th>
              <th className="p-2.5 w-36">Wert</th>
              <th className="p-2.5 w-24 text-right">Aktion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
            {filteredSettings.map((s) => {
              const curVal = editingValues[s.id] ?? s.value;
              const isDirty = curVal !== s.value;
              const isSaved = savedSuccessId === s.id;

              return (
                <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-2.5 font-mono font-bold text-cyan-400">{s.id}</td>
                  <td className="p-2.5">
                    <div className="font-semibold text-slate-200">{s.name}</div>
                    <div className="text-[0.6875rem] text-slate-400 leading-snug">{s.description}</div>
                  </td>
                  <td className="p-2.5">
                    <span className="text-[0.625rem] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                      {s.category}
                    </span>
                  </td>
                  <td className="p-2.5">
                    <div className="flex items-center gap-1.5 font-mono">
                      <input
                        type="text"
                        value={curVal}
                        onChange={(e) => setEditingValues(prev => ({ ...prev, [s.id]: e.target.value }))}
                        className={`w-28 bg-slate-950 px-2 py-1 rounded border text-xs focus:outline-none ${
                          isDirty ? 'border-amber-500 text-amber-300' : 'border-slate-700 text-slate-200'
                        }`}
                      />
                      <span className="text-[0.625rem] text-slate-500">{s.unit}</span>
                    </div>
                  </td>
                  <td className="p-2.5 text-right">
                    <button
                      onClick={() => handleSaveSetting(s.id)}
                      disabled={isSaved}
                      className={`px-2.5 py-1 rounded text-[0.6875rem] font-medium inline-flex items-center gap-1 transition-all ${
                        isSaved
                          ? 'bg-emerald-600 text-white'
                          : isDirty
                          ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-sm'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                    >
                      {isSaved ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Gespeichert</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3 h-3" />
                          <span>Speichern</span>
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
