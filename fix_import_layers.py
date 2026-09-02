import re

with open('src/components/RasterSettingsPanel.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace("import { Settings2, Zap, Lock, Unlock, ChevronDown, ChevronRight, Calculator, Hash, Ruler } from 'lucide-react';", "import { Settings2, Zap, Lock, Unlock, ChevronDown, ChevronRight, Calculator, Hash, Ruler, Layers } from 'lucide-react';")

with open('src/components/RasterSettingsPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
