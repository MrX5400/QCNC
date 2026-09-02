import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Replace declarations
decl_pattern = r"const \[zoom, setZoom\] = useState<number>\(1\.2\);\s*const \[pan, setPan\] = useState<\{ x: number; y: number \}>\(\{ x: 0, y: 0 \}\);\s*const \[orbitYaw, setOrbitYaw\] = useState<number>\(-45\);\s*const \[orbitPitch, setOrbitPitch\] = useState<number>\(35\);"
replacement = "const viewportRef = useRef({ zoom: 1.2, pan: { x: 0, y: 0 }, orbitYaw: -45, orbitPitch: 35 });"

code = re.sub(decl_pattern, replacement, code)

# 2. Replace usages in renderPreview dependencies
deps_pattern = r"orbitYaw,\s*orbitPitch,\s*zoom,\s*pan,"
code = re.sub(deps_pattern, "", code)

# Let's verify
if "viewportRef = useRef" in code:
    print("Success replacing decls")
else:
    print("Failed replacing decls")
    
