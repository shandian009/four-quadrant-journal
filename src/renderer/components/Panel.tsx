import type { PropsWithChildren } from 'react';

export function Panel({
  title,
  ariaLabel,
  testId,
  action,
  className = '',
  children
}: PropsWithChildren<{
  title: string;
  ariaLabel: string;
  testId: string;
  action?: React.ReactNode;
  className?: string;
}>) {
  return (
    <section className={`panel ${className}`} role="region" aria-label={ariaLabel} data-testid={testId}>
      <header className="panel__header">
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}
