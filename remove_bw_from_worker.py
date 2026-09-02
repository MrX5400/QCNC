import re

with open('src/workers/trace.worker.ts', 'r', encoding='utf-8') as f:
    text = f.read()

# Delete bwDataUrl block
match = re.search(r'// Create BW Data URL for preview.*?// 2\. Vectorization based on mode', text, flags=re.DOTALL)
if match:
    text = text[:match.start()] + '// 2. Vectorization based on mode' + text[match.end():]
    
    # Remove bwDataUrl variable declaration
    text = text.replace("let bwDataUrl: string | undefined;", "")
    
    # Remove bwDataUrl from postMessage
    text = text.replace("{ id, polylines, bwDataUrl } as VectorizeResponse", "{ id, polylines } as VectorizeResponse")

    with open('src/workers/trace.worker.ts', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Removed bwDataUrl from worker")

