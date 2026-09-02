import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Replace declarations
code = re.sub(r"const \[orbitYaw, setOrbitYaw\] = useState<number>\(35\); // degrees\s*const \[orbitPitch, setOrbitPitch\] = useState<number>\(45\); // degrees\s*const \[zoom, setZoom\] = useState<number>\(1\.2\);\s*const \[pan, setPan\] = useState<\{ x: number; y: number \}>\(\{ x: 0, y: 0 \}\);", 
              "const viewportRef = useRef({ zoom: 1.2, pan: { x: 0, y: 0 }, orbitYaw: 35, orbitPitch: 45 });", 
              code, flags=re.MULTILINE)

# 2. Replace deps
code = re.sub(r"zoom,\s*pan,\s*orbitYaw,\s*orbitPitch,", "", code)
code = re.sub(r"orbitYaw,\s*orbitPitch,\s*zoom,\s*pan,", "", code)

# 3. Replace setters manually

code = re.sub(r'setZoom\((.*?)\);', r'viewportRef.current.zoom = \1; requestAnimationFrame(renderPreview);', code)

code = re.sub(r'setOrbitYaw\((.*?)\);', r'viewportRef.current.orbitYaw = \1; requestAnimationFrame(renderPreview);', code)

code = re.sub(r'setOrbitPitch\((.*?)\);', r'viewportRef.current.orbitPitch = \1; requestAnimationFrame(renderPreview);', code)

# setPan is multiline sometimes, like:
# setPan({
#   x: dragOriginPan.x + dx,
#   y: dragOriginPan.y + dy,
# });
# We can use regex with DOTALL or just handle it if it's one line, but wait, there are multiline setPans.
code = re.sub(r'setPan\(\{\s*x:\s*(.*?),\s*y:\s*(.*?)\s*\}\);', r'viewportRef.current.pan = { x: \1, y: \2 }; requestAnimationFrame(renderPreview);', code, flags=re.DOTALL)
code = re.sub(r'setPan\(\{ x: (.*?), y: (.*?) \}\);', r'viewportRef.current.pan = { x: \1, y: \2 }; requestAnimationFrame(renderPreview);', code)

# 4. Replace getters. We only want to replace standalone words.
# We must avoid replacing inside object keys like pan: {x...} or zoom: 1. 
# Wait, we already replaced all setters. Are there any other object keys? 
# The string replacement might match lightboxZoom if we are not careful (but we use \b).
code = re.sub(r'(?<!\.)\bzoom\b(?!:)', 'viewportRef.current.zoom', code)
code = re.sub(r'(?<!\.)\bpan\b(?!:)', 'viewportRef.current.pan', code)
code = re.sub(r'(?<!\.)\borbitYaw\b(?!:)', 'viewportRef.current.orbitYaw', code)
code = re.sub(r'(?<!\.)\borbitPitch\b(?!:)', 'viewportRef.current.orbitPitch', code)

with open('src/components/Workspace.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Applied!")
