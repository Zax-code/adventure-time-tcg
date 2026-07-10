import type { PropsWithChildren, ReactNode } from "react";
import { Link } from "react-router-dom";

import { ErrorState, LoadingState } from "../../components/ui";

export function AdminPageHeader({
  actions,
  eyebrow,
  lede,
  title,
}: {
  actions?: ReactNode;
  eyebrow: string;
  lede: string;
  title: string;
}) {
  return (
    <header className="page-header admin-page-header">
      <div className="page-heading">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{lede}</p>
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function AdminMetric({
  label,
  note,
  tone = "primary",
  value,
}: {
  label: string;
  note: string;
  tone?: "primary" | "secondary" | "accent" | "success" | "info" | "danger";
  value: ReactNode;
}) {
  return (
    <article className={`admin-metric tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

export function AdminSection({
  action,
  children,
  description,
  title,
}: PropsWithChildren<{
  action?: ReactNode;
  description?: string;
  title: string;
}>) {
  return (
    <section className="panel admin-section">
      <header className="admin-section-header">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function AdminDataState({
  error,
  loading,
  onRetry,
}: {
  error: unknown;
  loading: boolean;
  onRetry: () => void;
}) {
  if (loading) {
    return <LoadingState label="Opening the operations workspace…" />;
  }
  if (error) {
    return <ErrorState error={error} onRetry={onRetry} />;
  }
  return null;
}

export function AdminBackLink({ to, children }: PropsWithChildren<{ to: string }>) {
  return (
    <Link className="admin-back-link" to={to}>
      <span aria-hidden="true">←</span> {children}
    </Link>
  );
}

export function AdminStatus({
  children,
  tone,
}: PropsWithChildren<{
  tone: "active" | "inactive" | "featured" | "pending" | "approved" | "rejected";
}>) {
  return <span className={`admin-status admin-status-${tone}`}>{children}</span>;
}
