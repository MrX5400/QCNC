import codecs

with open('src/services/imageVectorizer.ts', 'r', encoding='utf-8-sig') as f:
    content = f.read()

with open('src/services/imageVectorizer.ts', 'w', encoding='utf-8') as f:
    f.write(content)
