with open('src/workers/trace.worker.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(len(lines)):
    if "id: pt_," in lines[i]:
        lines[i] = lines[i].replace("id: pt_,", "")
    if "id: cl_," in lines[i]:
        lines[i] = lines[i].replace("id: cl_,", "")

with open('src/workers/trace.worker.ts', 'w', encoding='utf-8') as f:
    f.writelines(lines)
