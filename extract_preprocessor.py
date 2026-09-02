import re

with open('src/workers/trace.worker.ts', 'r', encoding='utf-8') as f:
    text = f.read()

# Extract preprocessImage
match = re.search(r'function preprocessImage\(imageData: ImageData, settings: any\): ImageData \{.*?(?=\n\nfunction|\Z)', text, flags=re.DOTALL)
if match:
    preprocess_code = match.group(0)
    
    # Write to new file
    with open('src/services/imagePreprocessor.ts', 'w', encoding='utf-8') as pf:
        pf.write("export " + preprocess_code + "\n")
    
    print("Created imagePreprocessor.ts")
    
    # Remove from trace.worker.ts
    text = text[:match.start()] + text[match.end():]
    
    # Add import
    text = "import { preprocessImage } from '../services/imagePreprocessor';\n" + text
    
    with open('src/workers/trace.worker.ts', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Updated trace.worker.ts")
else:
    print("Could not find preprocessImage")

