import re

with open('src/components/RasterSettingsPanel.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace(
    'className="flex flex-col h-full bg-slate-900 border-l border-slate-800 w-80 shadow-2xl overflow-hidden shrink-0 z-10"',
    'className="flex flex-col h-full bg-slate-900 overflow-hidden w-full"'
)

with open('src/components/RasterSettingsPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
