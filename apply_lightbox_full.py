import re

with open('src/components/ImageTracerLightbox.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace the complex invisible anchor setup with a simple w-full h-full object-contain setup
lightbox_start = text.find('{/* CANVAS AREA */}')
lightbox_end = text.find('{/* Bottom Overlay Controls (Opacity Slider for Vector Tab) */}', lightbox_start)

new_lightbox = """{/* CANVAS AREA */}
          <div className="flex-1 bg-slate-950/80 relative flex flex-col min-h-0">
            <div 
              ref={containerRef}
              className="flex-1 relative overflow-hidden"
            >
              {/* 1. Original Image (Background) */}
              {image && (activeTab === 'original' || activeTab === 'split' || (activeTab === 'vectors' && tracerBgOpacity > 0)) && (
                <img 
                  src={image.src} 
                  alt="Original" 
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  style={{ opacity: activeTab === 'vectors' ? tracerBgOpacity / 100 : 1 }}
                />
              )}

              {/* 2. Threshold Image */}
              {(activeTab === 'threshold' || activeTab === 'split') && bwDataUrl && (
                <img 
                  src={bwDataUrl} 
                  alt="Threshold" 
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  style={{ clipPath: activeTab === 'split' ? `inset(0 0 0 ${splitPos}%)` : 'none' }}
                />
              )}

              {/* 3. Vector Overlay */}
              {(activeTab === 'vectors' || activeTab === 'split') && polylines && (
                <svg 
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox={`0 0 ${settings.targetWidth || 100} ${settings.targetHeight || 100}`}
                  preserveAspectRatio="xMidYMid meet"
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

            """

if lightbox_start != -1 and lightbox_end != -1:
    text = text[:lightbox_start] + new_lightbox + text[lightbox_end:]
    print("REPLACED LIGHTBOX")

with open('src/components/ImageTracerLightbox.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
