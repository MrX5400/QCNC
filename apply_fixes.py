with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('...pan', '...viewportRef.current.pan')
text = text.replace("'viewportRef.current.pan'", "'pan'")

with open('src/components/Workspace.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
