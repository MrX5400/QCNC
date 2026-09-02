import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

sidebar_start = text.find('{/* Canvas / Image Display Area */}')
sidebar_end = text.find('{/* Background Original Image Opacity Slider in Vector Tab */}', sidebar_start)

new_sidebar = """{/* Canvas / Image Display Area */}
                      <div 
                        className="h-32 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 relative cursor-pointer group hover:border-cyan-500/60 transition-colors"
                        onClick={() => setShowImageLightbox(true)}
                        title="Klicken fǬr interaktive Vollbild-Vorschau mit Split-Slider"
                      >
                             {(tracingPreviewTab === 'original' || tracingPreviewTab === 'vectors') && rasterImage && (
                                <img
                                  src={rasterImage.src}
                                  alt="Original"
                                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                                  style={{ opacity: tracingPreviewTab === 'vectors' ? tracerBgOpacity / 100 : 1 }}
                                />
                             )}
                             
                             {tracingPreviewTab === 'threshold' && bwDataUrl && (
                                <img
                                  src={bwDataUrl}
                                  alt="Threshold"
                                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                                />
                             )}

                             {tracingPreviewTab === 'vectors' && rasterPolylines && (
                                  <svg 
                                    className="absolute inset-0 w-full h-full pointer-events-none"
                                    viewBox={`0 0 ${rasterSettings.targetWidth || 100} ${rasterSettings.targetHeight || 100}`}
                                    preserveAspectRatio="xMidYMid meet"
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
                             )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
                          <Search className="w-5 h-5 text-cyan-300 drop-shadow" />
                        </div>
                      </div>
                      
                      """

if sidebar_start != -1 and sidebar_end != -1:
    text = text[:sidebar_start] + new_sidebar + text[sidebar_end:]
    print("REPLACED SIDEBAR")

with open('src/components/Workspace.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
