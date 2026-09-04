import sys
import re

with open('vectorRasterGenerator.ts', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace("export async function optimizePathOrder(\n  paths: VectorPolyline[],\n  strategy: PathOrderStrategy = 'fastest',\n  startPosition: Path2DPoint = { x: 0, y: 0 }\n): VectorPolyline[] {", "export async function optimizePathOrder(\n  paths: VectorPolyline[],\n  strategy: PathOrderStrategy = 'fastest',\n  startPosition: Path2DPoint = { x: 0, y: 0 }\n): Promise<VectorPolyline[]> {")

code = code.replace("export async function getOptimizedPolylinesAndGroups(options: {\n  groups?: UniversalGcodeGroup[];\n  polylines?: VectorPolyline[];\n  optimizeOrder?: boolean;\n  objectOrderMode?: ObjectOrderMode;\n  pathOrderStrategy?: PathOrderStrategy;\n}): {\n  orderedGroups: UniversalGcodeGroup[];\n  orderedPolylines: VectorPolyline[];\n} {", "export async function getOptimizedPolylinesAndGroups(options: {\n  groups?: UniversalGcodeGroup[];\n  polylines?: VectorPolyline[];\n  optimizeOrder?: boolean;\n  objectOrderMode?: ObjectOrderMode;\n  pathOrderStrategy?: PathOrderStrategy;\n}): Promise<{\n  orderedGroups: UniversalGcodeGroup[];\n  orderedPolylines: VectorPolyline[];\n}> {")

code = code.replace("export async function generateUniversalGcode(options: {\n  groups: UniversalGcodeGroup[];\n  targetMode: 'laser' | 'spindle' | 'dragknife' | 'pen';\n  profile: MachineProfile;\n  penOptions?: any;\n  dragKnifeOptions?: any;\n  laserOptions?: any;\n  optimizeOrder?: boolean;\n  objectOrderMode?: ObjectOrderMode;\n  pathOrderStrategy?: PathOrderStrategy;\n}): string {", "export async function generateUniversalGcode(options: {\n  groups: UniversalGcodeGroup[];\n  targetMode: 'laser' | 'spindle' | 'dragknife' | 'pen';\n  profile: MachineProfile;\n  penOptions?: any;\n  dragKnifeOptions?: any;\n  laserOptions?: any;\n  optimizeOrder?: boolean;\n  objectOrderMode?: ObjectOrderMode;\n  pathOrderStrategy?: PathOrderStrategy;\n}): Promise<string> {")

# fix 'i' error
code = code.replace("if (i % 50 === 0) await yieldToMain();\n      for (let i = 0; i < tierSize; i++) {", "let chunkT = 0;\n      for (let i = 0; i < tierSize; i++) {\n        if (++chunkT % 50 === 0) await yieldToMain();")

with open('vectorRasterGenerator.ts', 'w', encoding='utf-8') as f:
    f.write(code)

