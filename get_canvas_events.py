import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

m = re.search(r'const handleMouseDown = .*?const handleWheel', text, re.DOTALL)
if m:
    print(m.group(0)[:1000] + "\n... (truncated)")
