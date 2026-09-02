import subprocess
import re

out = subprocess.check_output(['git', 'show', 'HEAD:src/components/Workspace.tsx'])
m = re.search(b'Arbeitsfl.*?che', out)
if m:
    s = m.group(0)
    print("HEAD Raw match:", s)
    for b in s:
        print(hex(b))
