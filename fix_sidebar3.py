import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Find the useEffect block that contains vectorOverlayCanvasRef and remove it
match = re.search(r'// --- Draw Vector Overlay.*?useEffect\(\(\) => \{[^}]*?vectorOverlayCanvasRef.*?\}, \[.*?\]\);', text, flags=re.DOTALL)
if match:
    text = text[:match.start()] + text[match.end():]
else:
    print("WARNING: Could not find vectorOverlayCanvasRef useEffect")
    
with open('src/components/Workspace.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
