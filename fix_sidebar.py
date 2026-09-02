import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Remove the canvas refs and useEffects
text = re.sub(r'const processedCanvasRef = useRef<HTMLCanvasElement \| null>\(null\);\s*', '', text)
text = re.sub(r'const vectorOverlayCanvasRef = useRef<HTMLCanvasElement \| null>\(null\);\s*', '', text)

# Remove the two drawing useEffects completely
effect1_start = text.find('// --- Small Sidebar Vector Overlay Canvas Render ---')
effect1_end = text.find('// --- High-Resolution Render for Lightbox Modal (Processed B&W Image) ---', effect1_start)
if effect1_start != -1 and effect1_end != -1:
    text = text[:effect1_start] + text[effect1_end:]

effect2_start = text.find('// --- Draw Vector Overlay on Thumbnail Preview in Sidebar ---')
effect2_end = text.find('// --- High-Resolution Transform Computation ---', effect2_start)
if effect2_start != -1 and effect2_end != -1:
    text = text[:effect2_start] + text[effect2_end:]

# 2. Replace the Canvas/Image Display Area HTML
html_start = text.find('{/* Canvas / Image Display Area */}')
html_end = text.find('{/* Background Original Image Opacity Slider in Vector Tab */}', html_start)

if html_start != -1 and html_end != -1:
    new_html = """{/* Canvas / Image Display Area */}
                      <div 
                        className="h-32 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center relative cursor-pointer group hover:border-cyan-500/60 transition-colors"
                        onClick={() => setShowImageLightbox(true)}
                        title="Klicken für interaktive Vollbild-Vorschau mit Split-Slider"
                      >
                        <div className="absolute inset-2 flex items-center justify-center overflow-hidden">
                             {(tracingPreviewTab === 'original' || tracingPreviewTab === 'vectors') && (
                                <img
                                  src={rasterImage.src}
                                  alt="Original"
                                  className="max-h-full max-w-full object-contain"
                                  style={{ opacity: tracingPreviewTab === 'vectors' ? tracerBgOpacity / 100 : 1 }}
                                />
                             )}
                             
                             {tracingPreviewTab === 'threshold' && bwDataUrl && (
                                <img
                                  src={bwDataUrl}
                                  alt="Threshold"
                                  className="max-h-full max-w-full object-contain"
                                />
                             )}

                             {tracingPreviewTab === 'vectors' && rasterPolylines && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <svg 
                                    className="max-h-full max-w-full object-contain pointer-events-none"
                                    style={{ aspectRatio: `${rasterImage.width} / ${rasterImage.height}` }}
                                    viewBox={`0 0 ${rasterSettings.targetWidth || 100} ${rasterSettings.targetHeight || 100}`}
                                    preserveAspectRatio="none"
                                  >
                                    {rasterPolylines.map((poly, i) => (
                                      <path
                                        key={i}
                                        d={`M ${poly.points.map(p => `${p.x},${p.y}`).join(' L ')} ${poly.closed ? 'Z' : ''}`}
                                        fill="none"
                                        stroke="#06b6d4"
                                        strokeWidth="1.5px"
                                        vectorEffect="non-scaling-stroke"
                                        strokeLinejoin="round"
                                        strokeLinecap="round"
                                      />
                                    ))}
                                  </svg>
                                </div>
                             )}
                        </div>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Search className="w-5 h-5 text-cyan-300 drop-shadow" />
                        </div>
                      </div>
                      
                      """
    text = text[:html_start] + new_html + text[html_end:]

with open('src/components/Workspace.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
