import sys

with open('Workspace.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. State
code = code.replace(
    'const [isGcodeOutdated, setIsGcodeOutdated] = useState(true);',
    'const [isGcodeOutdated, setIsGcodeOutdated] = useState(true);\n  const [autoGenerateGcode, setAutoGenerateGcode] = useState(false);'
)

# 2. Await replacements
code = code.replace(
    'const { orderedGroups: optGroups, orderedPolylines: optPolylines } = getOptimizedPolylinesAndGroups({',
    'const { orderedGroups: optGroups, orderedPolylines: optPolylines } = await getOptimizedPolylinesAndGroups({'
)
code = code.replace(
    'const gcodeStr = generateUniversalGcode({',
    'const gcodeStr = await generateUniversalGcode({'
)

# 3. useEffect
handle_end_idx = code.find('setIsGcodeOutdated(false);\n    } finally {\n      setIsGeneratingGcode(false);\n    }\n  };')
if handle_end_idx != -1:
    handle_end_idx = code.find('};', handle_end_idx) + 2
    use_effect = '''

  useEffect(() => {
    if (autoGenerateGcode && isGcodeOutdated && !isGeneratingGcode) {
      handleGenerateGcode();
    }
  }, [autoGenerateGcode, isGcodeOutdated, isGeneratingGcode]);
'''
    code = code[:handle_end_idx] + use_effect + code[handle_end_idx:]

# 4. Toggle UI
target = """              </button>
            </div>
          </div>
        </div>"""

replacement = """              </button>
            </div>
            
            {/* Auto-Generate Toggle */}
            <div className="mt-3 flex items-center justify-between bg-slate-900/50 p-2.5 rounded-lg border border-slate-700/50">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${autoGenerateGcode ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-600'}`}></div>
                <span className="text-sm font-medium text-slate-300">Live-Generierung (Auto)</span>
              </div>
              <button
                onClick={() => setAutoGenerateGcode(!autoGenerateGcode)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                  autoGenerateGcode ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <span className="sr-only">Auto-Generate Toggle</span>
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    autoGenerateGcode ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>"""

code = code.replace(target, replacement)

with open('Workspace.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
