with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = re.findall(r'.{0,5}Ã.{0,5}', text)
print("Matches:", set(matches))
