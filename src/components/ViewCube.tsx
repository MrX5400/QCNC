import React, { useState, useRef, useEffect } from 'react';
import { Home, Compass, RotateCcw } from 'lucide-react';

interface ViewCubeProps {
  yaw: number;
  pitch: number;
  viewMode?: '2d' | '3d';
  onOrientationChange: (yaw: number, pitch: number, mode?: '2d' | '3d') => void;
  onResetHome: () => void;
  className?: string;
}

export const ViewCube: React.FC<ViewCubeProps> = ({
  yaw,
  pitch,
  viewMode = '3d',
  onOrientationChange,
  onResetHome,
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; yaw: number; pitch: number }>({
    x: 0,
    y: 0,
    yaw: 45,
    pitch: 55,
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      yaw,
      pitch,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      const newYaw = (dragStartRef.current.yaw + dx * 0.8) % 360;
      const newPitch = Math.max(5, Math.min(85, dragStartRef.current.pitch + dy * 0.8));
      onOrientationChange(newYaw, newPitch, '3d');
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onOrientationChange]);

  const handleFaceClick = (targetYaw: number, targetPitch: number, mode?: '2d' | '3d', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onOrientationChange(targetYaw, targetPitch, mode);
  };

  // Convert orbitYaw & orbitPitch to CSS 3D Cube rotation
  // Camera looks with pitch from top (90 = directly top, 0 = horizontal)
  // yaw rotates around Z axis
  const cubeRotX = viewMode === '2d' ? -90 : -(90 - pitch);
  const cubeRotY = 0;
  const cubeRotZ = viewMode === '2d' ? 0 : yaw;

  return (
    <div
      className={`select-none pointer-events-none flex flex-col items-end gap-1.5 z-20 ${className}`}
    >
      {/* Floating Reset Home Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onResetHome();
        }}
        className="pointer-events-auto p-1.5 text-slate-400 hover:text-white bg-black/10 hover:bg-black/30 backdrop-blur-sm rounded-full transition-all drop-shadow-md"
        title="Startansicht (Isometrisch)"
      >
        <Home className="w-4 h-4" />
      </button>

      {/* 3D Perspective Cube Container */}
      <div
        className="w-18 h-18 relative cursor-grab active:cursor-grabbing flex items-center justify-center my-1 pointer-events-auto"
        style={{ perspective: '300px' }}
        onMouseDown={handleMouseDown}
        title="Klicken für Ausrichtung, Ziehen zum freien Drehen"
      >
        <div
          className="w-12 h-12 relative transition-transform duration-75"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateX(${cubeRotX}deg) rotateY(${cubeRotY}deg) rotateZ(${cubeRotZ}deg)`,
          }}
        >
          {/* TOP Face (Oben) */}
          <div
            onClick={(e) => handleFaceClick(0, 90, '2d', e)}
            className="absolute inset-0 bg-slate-800/90 border border-indigo-500/70 hover:bg-indigo-600 hover:text-white text-slate-200 font-bold text-[9px] flex items-center justify-center transition-colors cursor-pointer shadow-sm"
            style={{ transform: 'rotateX(90deg) translateZ(24px)' }}
          >
            OBEN
          </div>

          {/* BOTTOM Face (Unten) */}
          <div
            onClick={(e) => handleFaceClick(0, 10, '3d', e)}
            className="absolute inset-0 bg-slate-900/90 border border-slate-700 hover:bg-slate-700 text-slate-400 font-bold text-[9px] flex items-center justify-center transition-colors cursor-pointer"
            style={{ transform: 'rotateX(-90deg) translateZ(24px)' }}
          >
            UNTEN
          </div>

          {/* FRONT Face (Vorne) */}
          <div
            onClick={(e) => handleFaceClick(0, 15, '3d', e)}
            className="absolute inset-0 bg-slate-800/90 border border-emerald-500/60 hover:bg-emerald-600 hover:text-white text-slate-200 font-bold text-[9px] flex items-center justify-center transition-colors cursor-pointer shadow-sm"
            style={{ transform: 'translateZ(24px)' }}
          >
            VORNE
          </div>

          {/* BACK Face (Hinten) */}
          <div
            onClick={(e) => handleFaceClick(180, 15, '3d', e)}
            className="absolute inset-0 bg-slate-800/90 border border-amber-500/60 hover:bg-amber-600 hover:text-white text-slate-200 font-bold text-[9px] flex items-center justify-center transition-colors cursor-pointer shadow-sm"
            style={{ transform: 'rotateY(180deg) translateZ(24px)' }}
          >
            HINTEN
          </div>

          {/* RIGHT Face (Rechts) */}
          <div
            onClick={(e) => handleFaceClick(90, 15, '3d', e)}
            className="absolute inset-0 bg-slate-800/90 border border-cyan-500/60 hover:bg-cyan-600 hover:text-white text-slate-200 font-bold text-[9px] flex items-center justify-center transition-colors cursor-pointer shadow-sm"
            style={{ transform: 'rotateY(90deg) translateZ(24px)' }}
          >
            RECHTS
          </div>

          {/* LEFT Face (Links) */}
          <div
            onClick={(e) => handleFaceClick(270, 15, '3d', e)}
            className="absolute inset-0 bg-slate-800/90 border border-purple-500/60 hover:bg-purple-600 hover:text-white text-slate-200 font-bold text-[9px] flex items-center justify-center transition-colors cursor-pointer shadow-sm"
            style={{ transform: 'rotateY(-90deg) translateZ(24px)' }}
          >
            LINKS
          </div>
        </div>
      </div>

      {/* Quick View Switch Buttons below Cube */}
      <div className="grid grid-cols-2 gap-1 w-full pt-1 border-t border-slate-800/80">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOrientationChange(0, 90, '2d');
          }}
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
            viewMode === '2d'
              ? 'bg-indigo-600 text-white font-semibold shadow-sm'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="2D Draufsicht"
        >
          2D Oben
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onOrientationChange(45, 55, '3d');
          }}
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
            viewMode === '3d'
              ? 'bg-indigo-600 text-white font-semibold shadow-sm'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="3D Isometrisch"
        >
          3D Iso
        </button>
      </div>
    </div>
  );
};
