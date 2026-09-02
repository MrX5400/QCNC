import sys
with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

s1 = text.find('// --- Asynchronous & Debounced Vector Trace Preview')
e1 = text.find('// --- Update Processed Image Canvas Preview')

sub = text[s1:e1]
if 'setObjOffsetX' in sub:
    print("YES, setObjOffsetX is in the deleted block!")
else:
    print("NO, setObjOffsetX is NOT in the deleted block.")

if 'const [' in sub:
    print("There are state declarations in the deleted block!")
