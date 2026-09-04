import sys

with open('vectorRasterGenerator.ts', 'r', encoding='utf-8') as f:
    code = f.read()

old_import = "import { generateSingleLineTextPaths, generateUniversalTextPaths } from './textVectorGenerator';"
new_import = "import { generateSingleLineTextPaths, generateUniversalTextPaths, flattenCubicBezier, flattenQuadraticBezier } from './textVectorGenerator';"
code = code.replace(old_import, new_import)

with open('vectorRasterGenerator.ts', 'w', encoding='utf-8') as f:
    f.write(code)
