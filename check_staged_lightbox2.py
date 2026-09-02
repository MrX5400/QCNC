import subprocess
import re

out = subprocess.check_output(['git', 'show', ':src/components/ImageTracerLightbox.tsx'])
m = re.search(b'Gro.*?ansicht', out)
if m:
    s = m.group(0)
    print("STAGED Lightbox match:", s)
    for b in s:
        print(hex(b))
