import sys

with open('src/components/Workspace.tsx', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

import re
matches = re.findall(r'Arbeitsfl.{1}che', content)
print("Matches:", set(matches))
