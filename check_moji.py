import sys

with open('src/components/Workspace.tsx', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

if "Au??enkontur" in text or "???" in text:
    print("Mojibake found!")
else:
    print("No mojibake found!")
