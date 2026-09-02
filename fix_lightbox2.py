import re

with open('src/components/ImageTracerLightbox.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Remove zoom/pan states and mouse handlers
text = re.sub(r'const \[zoom, setZoom\].*?;', '', text)
text = re.sub(r'const \[pan, setPan\].*?;', '', text)
text = re.sub(r'const \[isDragging, setIsDragging\].*?;', '', text)
text = re.sub(r'const \[dragStart, setDragStart\].*?;', '', text)

# Remove the useEffect for applyFit
effect_start = text.find('// Initial Fit & Resize Fit')
effect_end = text.find('const handleWheel', effect_start)
if effect_start != -1 and effect_end != -1:
    text = text[:effect_start] + text[effect_end:]

# Remove mouse handlers
wheel_start = text.find('const handleWheel')
wheel_end = text.find('if (!isOpen) return null;', wheel_start)
if wheel_start != -1 and wheel_end != -1:
    text = text[:wheel_start] + text[wheel_end:]

# 2. Replace the zoom controls in the header
zoom_controls_start = text.find('{/* Zoom Controls */}')
zoom_controls_end = text.find('{/* Maximize & Close */}', zoom_controls_start)
if zoom_controls_start != -1 and zoom_controls_end != -1:
    text = text[:zoom_controls_start] + text[zoom_controls_end:]

# 3. Replace the canvas rendering area
canvas_start = text.find('{/* CANVAS AREA */}')
canvas_end = text.find('{/* FOOTER: Raster Settings */}', canvas_start)

new_canvas = """{/* CANVAS AREA */}
            <div className="flex-1 bg-slate-950/80 relative flex flex-col min-h-0">
              <div 
                ref={containerRef}
                className="flex-1 relative overflow-hidden flex items-center justify-center p-4 sm:p-8"
              >
                <div 
                  className="relative max-w-full max-h-full flex items-center justify-center"
                  style={{ 
                    aspectRatio: image ? `${image.width} / ${image.height}` : '1',
                    width: '100%',
                    height: '100%'
                  }}
                >
                  <div className="relative w-full h-full">
                    {/* 1. Original Image (Background) */}
                    {image && (activeTab === 'original' || activeTab === 'split' || (activeTab === 'vectors' && tracerBgOpacity > 0)) && (
                      <img 
                        src={image.src} 
                        alt="Original" 
                        className="absolute inset-0 w-full h-full object-contain"
                        style={{ opacity: activeTab === 'vectors' ? tracerBgOpacity / 100 : 1 }}
                      />
                    )}

                    {/* 2. Threshold Image */}
                    {(activeTab === 'threshold' || activeTab === 'split') && bwDataUrl && (
                      <img 
                        src={bwDataUrl} 
                        alt="Threshold" 
                        className="absolute inset-0 w-full h-full object-contain"
                        style={{ clipPath: activeTab === 'split' ? `inset(0 0 0 ${splitPos}%)` : 'none' }}
                      />
                    )}

                    {/* 3. Vector Overlay */}
                    {(activeTab === 'vectors' || activeTab === 'split') && polylines && (
                      <svg 
                        className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
                        viewBox={`0 0 ${settings.targetWidth || 100} ${settings.targetHeight || 100}`}
                        preserveAspectRatio="none"
                      >
                        {polylines.map((poly, i) => (
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

                    {/* Split Slider Handle */}
                    {activeTab === 'split' && (
                      <div 
                        className="absolute top-0 bottom-0 w-1 bg-indigo-500 cursor-col-resize z-10 flex items-center justify-center group"
                        style={{ left: `${splitPos}%`, transform: 'translateX(-50%)' }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          const parent = e.currentTarget.parentElement;
                          if (!parent) return;
                          const move = (me: MouseEvent) => {
                            const rect = parent.getBoundingClientRect();
                            const p = ((me.clientX - rect.left) / rect.width) * 100;
                            setSplitPos(Math.max(0, Math.min(100, p)));
                          };
                          const up = () => {
                            window.removeEventListener('mousemove', move);
                            window.removeEventListener('mouseup', up);
                          };
                          window.addEventListener('mousemove', move);
                          window.addEventListener('mouseup', up);
                        }}
                      >
                        <div className="w-6 h-8 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                          <div className="w-1 h-4 border-l border-r border-indigo-200" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            """

if canvas_start != -1 and canvas_end != -1:
    text = text[:canvas_start] + new_canvas + text[canvas_end:]

with open('src/components/ImageTracerLightbox.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
