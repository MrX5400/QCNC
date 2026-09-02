import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    ws = f.read()

ws = ws.replace("import { JobPreview } from './JobPreview';", "import { JobPreview } from './JobPreview';\nimport { ImageTracerLightbox } from './ImageTracerLightbox';")

with open('src/components/Workspace.tsx', 'w', encoding='utf-8') as f:
    f.write(ws)
