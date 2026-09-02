import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

m = re.search(r'const renderPreview = useCallback\(\(\) => \{.*?\n  \}, \[.*?\]\);', text, re.DOTALL)
if m:
    print(m.group(0)[:150] + "...")
else:
    print("Not found")
