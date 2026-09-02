import sys

try:
    with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
        content = f.read()
    print("Valid UTF-8. Found ä:", 'ä' in content)
except Exception as e:
    print("Error:", e)
