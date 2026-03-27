import * as React from 'react';
import { cn } from '../../lib/utils';

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {}

const Panel = React.forwardRef<HTMLDivElement, PanelProps>(({ className, ...props }, ref) => (
  <section
    ref={ref}
    className={cn(
      'rounded-xl border border-(--border) bg-(--surface) shadow-(--shadow-xs)',
      className
    )}
    {...props}
  />
));
Panel.displayName = 'Panel';

export interface PanelHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

const PanelHeader = React.forwardRef<HTMLDivElement, PanelHeaderProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('border-b border-(--border) px-5 py-4', className)} {...props} />
));
PanelHeader.displayName = 'PanelHeader';

export interface PanelTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

const PanelTitle = React.forwardRef<HTMLHeadingElement, PanelTitleProps>(({ className, ...props }, ref) => (
  <h2 ref={ref} className={cn('text-base font-semibold tracking-tight text-(--text-primary)', className)} {...props} />
));
PanelTitle.displayName = 'PanelTitle';

export interface PanelDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

const PanelDescription = React.forwardRef<HTMLParagraphElement, PanelDescriptionProps>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('mt-1 text-sm text-(--text-tertiary)', className)} {...props} />
));
PanelDescription.displayName = 'PanelDescription';

export interface PanelContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const PanelContent = React.forwardRef<HTMLDivElement, PanelContentProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('px-5 py-4', className)} {...props} />
));
PanelContent.displayName = 'PanelContent';

export { Panel, PanelContent, PanelDescription, PanelHeader, PanelTitle };
