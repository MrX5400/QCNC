import sys

with open('src/components/Workspace.tsx', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

if "?" in text:
    print("Found A-tilde!")
else:
    print("No A-tilde!")
