import * as React from 'react';
import { cn } from '../../lib/utils';

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {}

const Panel = React.forwardRef<HTMLDivElement, PanelProps>(({ className, ...props }, ref) => (
  <section
    ref={ref}
    className={cn(
      'rounded-2xl border border-slate-200/80 bg-white/90 shadow-[0_14px_40px_rgba(15,23,42,0.06)] backdrop-blur-sm',
      className
    )}
    {...props}
  />
));
Panel.displayName = 'Panel';

export interface PanelHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

const PanelHeader = React.forwardRef<HTMLDivElement, PanelHeaderProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('border-b border-slate-200/80 px-5 py-4', className)} {...props} />
));
PanelHeader.displayName = 'PanelHeader';

export interface PanelTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

const PanelTitle = React.forwardRef<HTMLHeadingElement, PanelTitleProps>(({ className, ...props }, ref) => (
  <h2 ref={ref} className={cn('font-heading text-base font-semibold tracking-tight text-slate-900', className)} {...props} />
));
PanelTitle.displayName = 'PanelTitle';

export interface PanelDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

const PanelDescription = React.forwardRef<HTMLParagraphElement, PanelDescriptionProps>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('mt-1 text-sm text-slate-600', className)} {...props} />
));
PanelDescription.displayName = 'PanelDescription';

export interface PanelContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const PanelContent = React.forwardRef<HTMLDivElement, PanelContentProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('px-5 py-4', className)} {...props} />
));
PanelContent.displayName = 'PanelContent';

export { Panel, PanelContent, PanelDescription, PanelHeader, PanelTitle };
