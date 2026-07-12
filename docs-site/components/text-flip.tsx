'use client';

import { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn';

// Cycles its children with a vertical flip. Pauses when scrolled out of view
// or when the tab is hidden; with reduced motion the words still rotate but
// cut instead of animating.
export function TextFlip({
  children,
  className,
  interval = 2400,
}: {
  children: ReactNode;
  className?: string;
  /** Milliseconds each word stays up. */
  interval?: number;
}) {
  const items = Children.toArray(children);
  const [index, setIndex] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { amount: 0.6 });
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!inView || items.length < 2) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setIndex((v) => (v + 1) % items.length);
      }
    }, interval);
    return () => clearInterval(id);
  }, [inView, items.length, interval]);

  return (
    <span ref={ref} className={cn('relative inline-grid overflow-hidden align-bottom', className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={index}
          className="col-start-1 row-start-1 whitespace-nowrap"
          initial={reduced ? { opacity: 0 } : { y: '105%', opacity: 0 }}
          animate={reduced ? { opacity: 1 } : { y: 0, opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { y: '-105%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        >
          {items[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
