with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

import re
m = re.search(r'Arbeitsfl.{1,5}che', text)
if m:
    s = m.group(0)
    print("Match:", repr(s))
    for c in s:
        print(c, hex(ord(c)))
