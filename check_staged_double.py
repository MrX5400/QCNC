import subprocess
import re

for file in ['src/components/ImageTracerLightbox.tsx', 'src/workers/trace.worker.ts', 'src/services/imageVectorizer.ts']:
    out = subprocess.check_output(['git', 'show', ':' + file])
    if b'\xc3\x83' in out:
        print(file, "has double encoding (C3 83)!")
    else:
        print(file, "is clean.")
