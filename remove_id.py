import re

with open('src/workers/trace.worker.ts', 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(r"id:\s*[^{]*\$\{Date\.now\(\)\}-\$\{Math\.random\(\)\},\s*", "", text)

with open('src/workers/trace.worker.ts', 'w', encoding='utf-8') as f:
    f.write(text)
    print("Removed id")
