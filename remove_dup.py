import sys

def remove_dup():
    with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    start_idx = 1871 - 1
    # Find the end of this useMemo
    end_idx = start_idx
    depth = 0
    for i in range(start_idx, len(lines)):
        depth += lines[i].count('{')
        depth -= lines[i].count('}')
        if depth == 0 and lines[i].strip() == '}, [activeOptimizedPolylines]);':
            end_idx = i
            break
            
    # Also delete the activeOptimizedPolylines if it's duplicated? Wait, the error said ctiveOptimizedPolylines used before its declaration.
    # Let's just delete lines start_idx to end_idx.
    
    new_lines = lines[:start_idx] + lines[end_idx+1:]
    
    with open('src/components/Workspace.tsx', 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
        
    print(f"Removed lines {start_idx+1} to {end_idx+1}")

remove_dup()
