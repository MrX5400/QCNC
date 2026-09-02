import sys
import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

matches = re.findall(r'Arbeitsfl.*?che', content)
print("Matches:", set(matches))
