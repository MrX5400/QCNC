import re

with open('src/components/RasterSettingsPanel.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

adjustments = """
          {/* Bildanpassungen */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <h3 className="text-[0.7rem] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5" /> Bildanpassungen (Live)
            </h3>
            
            <div className="space-y-1">
              <div className="flex justify-between text-[0.65rem] text-slate-300 font-medium">
                <span>Helligkeit</span>
                <span className="text-amber-400 font-mono">{settings.brightness || 0}</span>
              </div>
              <input type="range" min="-100" max="100" value={settings.brightness || 0} onChange={e => onSettingsChange(s => ({...s, brightness: Number(e.target.value)}))} className="w-full accent-amber-500 h-1.5" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[0.65rem] text-slate-300 font-medium">
                <span>Kontrast</span>
                <span className="text-amber-400 font-mono">{settings.contrast || 0}</span>
              </div>
              <input type="range" min="-100" max="100" value={settings.contrast || 0} onChange={e => onSettingsChange(s => ({...s, contrast: Number(e.target.value)}))} className="w-full accent-amber-500 h-1.5" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[0.65rem] text-slate-300 font-medium">
                <span>Gamma</span>
                <span className="text-amber-400 font-mono">{settings.gamma || 1.0}</span>
              </div>
              <input type="range" min="0.2" max="3.0" step="0.05" value={settings.gamma || 1.0} onChange={e => onSettingsChange(s => ({...s, gamma: Number(e.target.value)}))} className="w-full accent-amber-500 h-1.5" />
            </div>
            
            <label className="flex items-center gap-2 text-[0.65rem] text-slate-300 cursor-pointer pt-1">
              <input type="checkbox" checked={settings.invert || false} onChange={e => onSettingsChange(s => ({...s, invert: e.target.checked}))} className="rounded bg-slate-950 border-slate-700 text-amber-500" />
              Farben umkehren (Invertieren)
            </label>
          </div>
"""

# Insert right after the Binarisierungs-Schwellenwert
target = '<input type="range" min="0" max="255" value={settings.threshold} onChange={e => onSettingsChange(s => ({...s, threshold: Number(e.target.value)}))} className="w-full accent-emerald-500 h-1.5" />\n            </div>'
text = text.replace(target, target + '\n' + adjustments)

if 'Sun,' not in text:
    text = text.replace('import { Settings2', 'import { Settings2, Sun')

with open('src/components/RasterSettingsPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

