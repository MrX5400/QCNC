with open('src/components/Workspace.tsx', 'r', encoding='utf-8', errors='ignore') as f:
    for i, line in enumerate(f):
        if "?" in line:
            print(f"Line {i+1}: {line.strip()}")
