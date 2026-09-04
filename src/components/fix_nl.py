import sys

with open('Workspace.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace(r'\n', '\n')

with open('Workspace.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
