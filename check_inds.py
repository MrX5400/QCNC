import sys
with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

s1 = text.find('// --- Asynchronous & Debounced Vector Trace Preview')
e1 = text.find('// --- Update Processed Image Canvas Preview')

print(f"s1={s1}, e1={e1}")
