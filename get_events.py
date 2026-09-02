import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

m = re.search(r'const handleWheel = .*?};', text, re.DOTALL)
if m:
    print(m.group(0))
else:
    print("Not found")

print("\n---")
m2 = re.search(r'const handleMouseMove = .*?};', text, re.DOTALL)
if m2:
    print(m2.group(0))
