'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';

// A dot grid that lights up around the pointer. Canvas-based; renders as a
// background layer (absolute inset-0, pointer-events none) and listens on its
// parent so the content above stays interactive. Idles as a faint grid, so it
// degrades gracefully on touch devices and under reduced motion.
export function DotGridSpotlight({
  dotColor = 'rgba(255, 255, 255, 0.06)',
  activeDotColor = 'rgba(255, 255, 255, 0.12)',
  gap = 14,
  dotRadius = 1.25,
  spotlightRadius = 110,
  className,
}: {
  dotColor?: string;
  activeDotColor?: string;
  gap?: number;
  dotRadius?: number;
  spotlightRadius?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let width = 0;
    let height = 0;
    const pointer = { x: -1e4, y: -1e4 };

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (let x = gap / 2; x < width; x += gap) {
        for (let y = gap / 2; y < height; y += gap) {
          const dx = x - pointer.x;
          const dy = y - pointer.y;
          const dist = Math.hypot(dx, dy);
          const t = Math.max(0, 1 - dist / spotlightRadius); // 0..1 falloff
          ctx.beginPath();
          ctx.arc(x, y, dotRadius + t * 0.9, 0, Math.PI * 2);
          ctx.fillStyle = t > 0 ? activeDotColor : dotColor;
          ctx.globalAlpha = t > 0 ? 0.55 + t * 0.45 : 1;
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };

    const onMove = (e: PointerEvent) => {
      const rect = parent.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      schedule();
    };
    const onLeave = () => {
      pointer.x = -1e4;
      pointer.y = -1e4;
      schedule();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    parent.addEventListener('pointermove', onMove);
    parent.addEventListener('pointerleave', onLeave);
    resize();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      parent.removeEventListener('pointermove', onMove);
      parent.removeEventListener('pointerleave', onLeave);
    };
  }, [dotColor, activeDotColor, gap, dotRadius, spotlightRadius]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 size-full', className)}
    />
  );
}
