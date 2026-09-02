import re

with open('src/components/ImageTracerLightbox.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update Zoom & Auto-Fit (remove Math.min(..., 1) limit and trigger on resize)
old_fit = """  // Initial Fit
  useEffect(() => {
    if (isOpen && containerRef.current && image) {
      const { clientWidth, clientHeight } = containerRef.current;
      const scaleX = (clientWidth - 40) / image.width;
      const scaleY = (clientHeight - 40) / image.height;
      setZoom(Math.min(scaleX, scaleY, 1));
      setPan({ x: 0, y: 0 });
    }
  }, [isOpen, image, isMaximized]);"""

new_fit = """  // Initial Fit & Resize Fit
  useEffect(() => {
    if (!isOpen || !containerRef.current || !image) return;
    
    const applyFit = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      const scaleX = (clientWidth - 60) / image.width;
      const scaleY = (clientHeight - 60) / image.height;
      // Removed Math.min(..., 1) to allow upscaling of small images
      setZoom(Math.min(scaleX, scaleY)); 
      setPan({ x: 0, y: 0 });
    };

    applyFit();

    // Re-fit on resize (e.g. toggling maximize)
    const observer = new ResizeObserver(() => {
      applyFit();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isOpen, image, isMaximized]);"""

text = text.replace(old_fit, new_fit)

# 2. Transparent Backdrop
text = text.replace('bg-slate-950/80 backdrop-blur-sm', 'bg-slate-950/60 backdrop-blur-md')

# 3. Fix SVG Vector Lines (non-scaling-stroke)
old_svg_path = """<path
                        key={i}
                        d={`M ${poly.points.map(p => `${p.x},${p.y}`).join(' L ')} ${poly.closed ? 'Z' : ''}`}
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth={1.5 / zoom}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />"""

new_svg_path = """<path
                        key={i}
                        d={`M ${poly.points.map(p => `${p.x},${p.y}`).join(' L ')} ${poly.closed ? 'Z' : ''}`}
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth="1.5px"
                        vectorEffect="non-scaling-stroke"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />"""

text = text.replace(old_svg_path, new_svg_path)

with open('src/components/ImageTracerLightbox.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
