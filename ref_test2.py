import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Replace declarations
def replace_decls(text):
    return re.sub(r"const \[orbitYaw, setOrbitYaw\] = useState<number>\(35\); // degrees\s*const \[orbitPitch, setOrbitPitch\] = useState<number>\(45\); // degrees\s*const \[zoom, setZoom\] = useState<number>\(1\.2\);\s*const \[pan, setPan\] = useState<\{ x: number; y: number \}>\(\{ x: 0, y: 0 \}\);", 
                  "const viewportRef = useRef({ zoom: 1.2, pan: { x: 0, y: 0 }, orbitYaw: 35, orbitPitch: 45 });", 
                  text, flags=re.MULTILINE)

code = replace_decls(code)
if "const viewportRef = useRef" in code:
    print("Success replacing decls")
else:
    print("Failed replacing decls")
