import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  CheckCircle2, 
  Maximize2,
  Info,
  Compass
} from 'lucide-react';
import { MachineProfile } from '../types/cnc';
import { 
  DEFAULT_PROFILES, 
  loadSavedProfiles, 
  saveOrUpdateProfile 
} from '../services/machineProfiles';

interface MachineProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: MachineProfile;
  onSaveProfile: (profile: MachineProfile) => void;
}

export const MachineProfileModal: React.FC<MachineProfileModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
  onSaveProfile,
}) => {
  const [profile, setProfile] = useState<MachineProfile>({ ...currentProfile });
  const [allProfiles, setAllProfiles] = useState<MachineProfile[]>([]);
  const [showSavedToast, setShowSavedToast] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setProfile({ ...currentProfile });
      setAllProfiles(loadSavedProfiles());
    }
  }, [isOpen, currentProfile]);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: MachineProfile) => {
    setProfile({ ...preset });
  };

  const handleSave = () => {
    const updatedProfiles = saveOrUpdateProfile(profile);
    setAllProfiles(updatedProfiles);
    onSaveProfile(profile);
    setShowSavedToast(true);
    setTimeout(() => {
      setShowSavedToast(false);
      onClose();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col text-slate-200 overflow-hidden relative">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <Maximize2 className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="font-bold text-slate-100 text-base">Maschinenprofile & Bauraumgröße</h2>
              <p className="text-xs text-slate-400">Physikalische Arbeitsfläche & Dimensionen (X, Y, Z)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {/* Preset Buttons */}
          <div className="space-y-2">
            <label className="text-[0.6875rem] font-semibold text-slate-400 uppercase tracking-wider">Bauraum-Vorlagen</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(allProfiles.length > 0 ? allProfiles : DEFAULT_PROFILES).map((p) => {
                const isSelected = profile.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPreset(p)}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600/25 border-indigo-500 text-indigo-200 shadow-sm ring-1 ring-indigo-500/50'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-semibold text-slate-200 truncate">{p.name.split('(')[0].trim()}</div>
                    <div className="text-[0.625rem] text-indigo-400 font-mono mt-0.5">{p.bedWidth} × {p.bedHeight} mm</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Profile Name */}
          <div className="space-y-1.5">
            <label className="text-[0.6875rem] font-semibold text-slate-300">Profilname</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile(p => ({ ...p, name: e.target.value }))}
              className="w-full bg-slate-950 px-3 py-2 rounded-md border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500 font-medium"
            />
          </div>

          {/* Bed Dimensions */}
          <div className="space-y-2">
            <label className="text-[0.6875rem] font-semibold text-slate-400 uppercase tracking-wider">Arbeitsbereich / Bauraum (mm)</label>
            <div className="grid grid-cols-3 gap-3 font-mono">
              <div className="space-y-1">
                <span className="text-slate-400 text-[0.6875rem]">X Max (Breite):</span>
                <div className="flex items-center gap-1 bg-slate-950 px-3 py-2 rounded-md border border-slate-800 focus-within:border-indigo-500">
                  <input
                    type="number"
                    value={profile.bedWidth}
                    onChange={(e) => setProfile(p => ({ ...p, bedWidth: Math.max(10, Number(e.target.value) || 0) }))}
                    className="w-full bg-transparent text-slate-100 focus:outline-none font-bold text-sm"
                  />
                  <span className="text-slate-500 text-xs">mm</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 text-[0.6875rem]">Y Max (Höhe):</span>
                <div className="flex items-center gap-1 bg-slate-950 px-3 py-2 rounded-md border border-slate-800 focus-within:border-indigo-500">
                  <input
                    type="number"
                    value={profile.bedHeight}
                    onChange={(e) => setProfile(p => ({ ...p, bedHeight: Math.max(10, Number(e.target.value) || 0) }))}
                    className="w-full bg-transparent text-slate-100 focus:outline-none font-bold text-sm"
                  />
                  <span className="text-slate-500 text-xs">mm</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 text-[0.6875rem]">Z Hub (Tiefe):</span>
                <div className="flex items-center gap-1 bg-slate-950 px-3 py-2 rounded-md border border-slate-800 focus-within:border-indigo-500">
                  <input
                    type="number"
                    value={profile.bedDepth}
                    onChange={(e) => setProfile(p => ({ ...p, bedDepth: Math.max(0, Number(e.target.value) || 0) }))}
                    className="w-full bg-transparent text-slate-100 focus:outline-none font-bold text-sm"
                  />
                  <span className="text-slate-500 text-xs">mm</span>
                </div>
              </div>
            </div>
          </div>

          {/* Machine Origin (Nullpunkt) */}
          <div className="space-y-1.5">
            <label className="text-[0.6875rem] font-semibold text-slate-300 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-indigo-400" />
              <span>Maschinen-Nullpunkt (Ursprung X0 Y0)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'bottom_left', label: 'Unten Links (Standard)', desc: 'X+ Rechts, Y+ Oben' },
                { id: 'top_left', label: 'Oben Links', desc: 'X+ Rechts, Y+ Unten' },
                { id: 'center', label: 'Mitte (Zentrum)', desc: 'Arbeitsbereich-Mitte' },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setProfile(p => ({ ...p, origin: opt.id as any }))}
                  className={`p-2 rounded-md border text-left cursor-pointer transition-all ${
                    profile.origin === opt.id
                      ? 'bg-indigo-600/20 border-indigo-500 text-slate-100 ring-1 ring-indigo-500/40'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-semibold text-xs text-slate-200">{opt.label}</div>
                  <div className="text-[0.625rem] text-slate-500 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Architectural Clarification Info Box */}
          <div className="p-3.5 bg-indigo-950/30 rounded-lg border border-indigo-900/40 flex items-start gap-3">
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-[0.6875rem] text-slate-300 leading-relaxed">
              <strong className="text-indigo-200">Reine Bauraumverwaltung:</strong> Maschinenprofile steuern ausschließlich die Dimensionen und Grenzwerte Ihrer Arbeitsfläche. 
              Alle Werkzeugbefehle (wie <em>Stift Z-Achse vs. Servo/M3</em>, <em>Schleppmesser G2/G3 Kreisbögen</em>, <em>Laser M3/M4</em>) werden flexibel und auftragsspezifisch direkt in den <strong>Generator-Einstellungen</strong> festgelegt.
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-950/80">
          <div className="text-slate-400 font-mono text-[0.6875rem]">
            {profile.bedWidth} × {profile.bedHeight} mm
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md transition-colors text-xs font-semibold cursor-pointer"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors text-xs font-semibold shadow-sm cursor-pointer"
            >
              {showSavedToast ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Save className="w-4 h-4" />}
              <span>{showSavedToast ? 'Gespeichert!' : 'Profil anwenden'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
