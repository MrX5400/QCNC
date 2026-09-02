import sys

def replace_block():
    with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    with open('new_raster_ui.txt', 'r', encoding='utf-8') as f:
        new_ui = f.read()
        
    start_line = 5317 - 1
    end_line = 6109 - 1
    
    lines_before = lines[:start_line]
    lines_after = lines[end_line + 1:]
    
    new_content = ''.join(lines_before) + new_ui + '\n' + ''.join(lines_after)
    
    with open('src/components/Workspace.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
        
    print("Replaced!")

replace_block()
