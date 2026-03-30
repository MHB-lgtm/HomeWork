'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import * as React from 'react';
import { cn } from '../../lib/utils';

const fadeInUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const scaleIn = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
};

export function FadeIn({
  children,
  className,
  delay = 0,
  ...props
}: HTMLMotionProps<'div'> & { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1], delay }}
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
      whileHover={{ y: -2, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.06), 0 4px 6px -4px rgba(0,0,0,0.04)' }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
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
      {...scaleIn}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export { motion };
