import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

m = re.search(r'(<div className="flex items-center gap-2 pt-1 border-t border-slate-800">.*?? Auto\s*</button>\s*</div>\s*</div>)', text, re.DOTALL)
if m:
    print("Found block to replace.")
