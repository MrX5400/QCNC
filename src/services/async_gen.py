import sys
import re

with open('vectorRasterGenerator.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Add yield helper
yield_helper = """
const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));
"""
code = code.replace("export function optimizePathOrder(", yield_helper + "export async function optimizePathOrder(")

# 2. Make optimizePathOrder async and yield every 50 iterations
code = code.replace("for (let i = 0; i < tierSize; i++) {", "if (i % 50 === 0) await yieldToMain();\n      for (let i = 0; i < tierSize; i++) {")
code = code.replace("while (remaining.length > 0) {", "let chunkCounter = 0;\n  while (remaining.length > 0) {\n    if (++chunkCounter % 50 === 0) await yieldToMain();")

# 3. Make getOptimizedPolylinesAndGroups async
code = code.replace("export function getOptimizedPolylinesAndGroups(", "export async function getOptimizedPolylinesAndGroups(")
code = code.replace("groupPaths = optimizePathOrder(groupPaths, pathOrderStrategy, runningPos);", "groupPaths = await optimizePathOrder(groupPaths, pathOrderStrategy, runningPos);")

# 4. Make generateUniversalGcode async
code = code.replace("export function generateUniversalGcode(", "export async function generateUniversalGcode(")
code = code.replace("const { orderedGroups: effectiveGroups } = getOptimizedPolylinesAndGroups({", "const { orderedGroups: effectiveGroups } = await getOptimizedPolylinesAndGroups({")

# Yield in generateUniversalGcode groups loop
code = code.replace("for (let gIdx = 0; gIdx < effectiveGroups.length; gIdx++) {", "for (let gIdx = 0; gIdx < effectiveGroups.length; gIdx++) {\n    await yieldToMain();")

with open('vectorRasterGenerator.ts', 'w', encoding='utf-8') as f:
    f.write(code)
