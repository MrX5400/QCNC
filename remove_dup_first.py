import sys
def remove_dup_first():
    with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    start_idx = 1629 - 1
    end_idx = start_idx
    depth = 0
    for i in range(start_idx, len(lines)):
        depth += lines[i].count('{')
        depth -= lines[i].count('}')
        if depth == 0 and lines[i].strip() == '}, [activeOptimizedPolylines]);':
            end_idx = i
            break
            
    new_lines = lines[:start_idx] + lines[end_idx+1:]
    with open('src/components/Workspace.tsx', 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print(f"Removed first dup: lines {start_idx+1} to {end_idx+1}")
remove_dup_first()
