import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

if 'import { vectorizeImageAsync }' not in text:
    text = text.replace("import { RasterSettingsPanel } from './RasterSettingsPanel';", "import { RasterSettingsPanel } from './RasterSettingsPanel';\nimport { vectorizeImageAsync } from '../services/imageVectorizer';")

with open('src/components/Workspace.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
