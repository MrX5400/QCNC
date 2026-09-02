import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Completely nuke the flip block in handleAddCurrentToComposition
match = re.search(r'// Convert Image Coordinates.*?// CNC-Y-Transformation\s*\}\)\)\s*\}\)\);\s*\}', text, flags=re.DOTALL)
if match:
    text = text[:match.start()] + text[match.end():]
    print("REMOVED FLIP BLOCK SUCCESSFULLY")
else:
    print("COULD NOT FIND FLIP BLOCK!")

with open('src/components/Workspace.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
