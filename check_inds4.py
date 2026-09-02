import sys
with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

s1 = text.find('// --- Asynchronous & Debounced Vector Trace Preview')
sub = text[s1:]
# Find the end of the useEffect
# It ends with `    rasterSettings.blurRadius,\n    rasterSettings.simplificationTolerance,\n    rasterSettings.minPathLength\n  ]);\n`
import re
match = re.search(r'\s*rasterSettings\.minPathLength\s*\]\);\s*', sub)
if match:
    e1 = s1 + match.end()
    print("Found exact end!")
    print(text[s1:e1])
else:
    print("Could not find end of useEffect")
