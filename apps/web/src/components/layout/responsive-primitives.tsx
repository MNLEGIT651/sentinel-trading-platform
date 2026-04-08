import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  density?: 'default' | 'compact';
  'aria-label'?: string;
}

export function PageContainer({
  children,
  className,
  contentClassName,
  density = 'default',
  'aria-label': ariaLabel,
}: PageContainerProps) {
  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        'page-container',
        density === 'compact' ? 'page-container--compact' : '',
        className,
      )}
    >
      <div className={cn('page-container__content', contentClassName)}>{children}</div>
    </div>
  );
}

export function SectionStack({
  children,
  className,
  spacing = 'default',
}: {
  children: React.ReactNode;
  className?: string;
  spacing?: 'tight' | 'default' | 'relaxed';
}) {
  return (
    <div
      className={cn(
        'section-stack',
        spacing === 'tight' && 'section-stack--tight',
        spacing === 'relaxed' && 'section-stack--relaxed',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ResponsivePaneLayout({
  primary,
  secondary,
  support,
  className,
}: {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  support?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('responsive-pane-layout', className)}>
      <div className="responsive-pane-layout__primary">{primary}</div>
      {secondary ? <aside className="responsive-pane-layout__secondary">{secondary}</aside> : null}
      {support ? <aside className="responsive-pane-layout__support">{support}</aside> : null}
    </section>
  );
}

export function MetricGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={cn('metric-group', className)}>{children}</section>;
}

export function AlertStack({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={cn('alert-stack', className)}>{children}</section>;
}
