with open('src/components/Workspace.tsx', 'rb') as f:
    text = f.read()

import re
m = re.search(b'Arbeitsfl.*?che', text)
if m:
    s = m.group(0)
    print("Raw match:", s)
    for b in s:
        print(hex(b))
