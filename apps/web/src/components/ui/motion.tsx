'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import * as React from 'react';

const springTransition = { type: 'spring', stiffness: 400, damping: 30 };
const smoothEase = [0.16, 1, 0.3, 1] as const;

const fadeInUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: smoothEase },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.02,
    },
  },
};

export function FadeIn({
  children,
  className,
  delay = 0,
  ...props
}: HTMLMotionProps<'div'> & { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: smoothEase, delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function StaggerGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={staggerContainer}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={fadeInUp}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function HoverCard({
  children,
  className,
  ...props
}: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      whileHover={{
        y: -3,
        boxShadow: '0 8px 24px -4px rgba(0,0,0,0.08), 0 2px 6px -2px rgba(0,0,0,0.03)',
        borderColor: 'var(--border-hover)',
      }}
      whileTap={{ y: -1 }}
      transition={{ duration: 0.25, ease: smoothEase }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: smoothEase }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function ScaleIn({
  children,
  className,
  ...props
}: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: smoothEase }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function SlideIn({
  children,
  className,
  direction = 'left',
  ...props
}: HTMLMotionProps<'div'> & { direction?: 'left' | 'right' | 'up' | 'down' }) {
  const axis = direction === 'left' || direction === 'right' ? 'x' : 'y';
  const offset = direction === 'left' || direction === 'up' ? -16 : 16;

  return (
    <motion.div
      initial={{ opacity: 0, [axis]: offset }}
      animate={{ opacity: 1, [axis]: 0 }}
      transition={{ duration: 0.35, ease: smoothEase }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export { motion };
