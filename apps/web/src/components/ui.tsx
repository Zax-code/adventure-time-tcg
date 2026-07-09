import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  PropsWithChildren,
  ReactNode,
} from "react";
import { useEffect, useId, useRef } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { CheckCircleIcon, XIcon } from "@/components/icons";
import { readErrorMessage } from "@/lib/form-utils";

type ButtonTone = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  busy?: boolean;
  tone?: ButtonTone;
}

export function Button({
  busy = false,
  children,
  className = "",
  disabled,
  tone = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`button button-${tone} ${className}`.trim()}
      disabled={disabled || busy}
      type={type}
      {...props}
    >
      {busy ? <span className="button-spinner" aria-hidden="true" /> : null}
      <span>{busy ? "Working…" : children}</span>
    </button>
  );
}

export function ButtonLink({
  children,
  className = "",
  replace = false,
  state,
  to,
  tone = "primary",
}: PropsWithChildren<{
  className?: string;
  replace?: boolean;
  state?: unknown;
  to: string;
  tone?: ButtonTone;
}>) {
  return (
    <Link
      className={`button button-${tone} ${className}`.trim()}
      replace={replace}
      state={state}
      to={to}
    >
      {children}
    </Link>
  );
}

export function Panel({
  children,
  className = "",
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLElement>>) {
  return (
    <section className={`panel ${className}`.trim()} {...props}>
      {children}
    </section>
  );
}

export function PageHeader({
  actions,
  eyebrow,
  lede,
  title,
}: {
  actions?: ReactNode;
  eyebrow: string;
  lede?: ReactNode;
  title: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-heading">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {lede ? <p>{lede}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function SectionHeader({
  action,
  eyebrow,
  lede,
  title,
}: {
  action?: ReactNode;
  eyebrow?: string;
  lede?: ReactNode;
  title: ReactNode;
}) {
  return (
    <header className="section-header">
      <div>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h2>{title}</h2>
        {lede ? <p>{lede}</p> : null}
      </div>
      {action ? <div className="section-action">{action}</div> : null}
    </header>
  );
}

export function StatCard({
  label,
  note,
  tone = "primary",
  value,
}: {
  label: string;
  note?: string;
  tone?: "primary" | "secondary" | "accent" | "success" | "info" | "danger";
  value: ReactNode;
}) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
    </article>
  );
}

export function ProgressBar({
  label,
  max,
  value,
}: {
  label: string;
  max: number;
  value: number;
}) {
  const percentage = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="progress" aria-label={label}>
      <progress max={100} value={percentage} />
      <small>{Math.round(percentage)}%</small>
    </div>
  );
}

export function Notice({
  children,
  title,
  tone = "info",
}: PropsWithChildren<{
  title: string;
  tone?: "info" | "success" | "danger" | "warning";
}>) {
  return (
    <div className={`notice notice-${tone}`} role={tone === "danger" ? "alert" : "status"}>
      <strong>{title}</strong>
      <div>{children}</div>
    </div>
  );
}

export function LoadingState({ label = "Loading this chapter…" }: { label?: string }) {
  return (
    <div className="state-panel state-loading" role="status">
      <div className="state-icon" aria-hidden="true">
        <span className="loading-ring" />
      </div>
      <h2>{label}</h2>
      <p>Fresh details are on the way.</p>
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  title = "This page hit a snag",
}: {
  error?: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div className="state-panel state-error" role="alert">
      <div className="state-icon" aria-hidden="true">
        !
      </div>
      <h2>{title}</h2>
      <p>{readErrorMessage(error)}</p>
      {onRetry ? <Button onClick={onRetry}>Try again</Button> : null}
    </div>
  );
}

export function EmptyState({
  action,
  copy,
  title,
}: {
  action?: ReactNode;
  copy: string;
  title: string;
}) {
  return (
    <div className="state-panel state-empty">
      <div className="state-icon" aria-hidden="true">
        ○
      </div>
      <h2>{title}</h2>
      <p>{copy}</p>
      {action}
    </div>
  );
}

export function QueryState<T>({
  children,
  empty,
  query,
}: {
  children: (data: T) => ReactNode;
  empty?: (data: T) => boolean;
  query: UseQueryResult<T, Error>;
}) {
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (empty?.(query.data)) {
    return <EmptyState title="Nothing here yet" copy="When something arrives, it will appear here." />;
  }
  return <>{children(query.data)}</>;
}

export function Field({
  children,
  error,
  hint,
  label,
}: PropsWithChildren<{
  error?: string;
  hint?: string;
  label: string;
}>) {
  return (
    <label className={`field ${error ? "field-error" : ""}`.trim()}>
      <span>{label}</span>
      {children}
      {error ? <small role="alert">{error}</small> : hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function SegmentedControl<T extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: T) => void;
  options: Array<{ label: string; value: T }>;
  value: T;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          aria-pressed={value === option.value}
          className={value === option.value ? "active" : ""}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Dialog({
  children,
  description,
  onClose,
  open,
  title,
}: PropsWithChildren<{
  description?: string;
  onClose: () => void;
  open: boolean;
  title: string;
}>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      aria-labelledby={titleId}
      className="dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <div className="dialog-handle" aria-hidden="true" />
      <header>
        <div>
          <h2 id={titleId}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        <button aria-label="Close" className="icon-button" onClick={onClose} type="button">
          <XIcon />
        </button>
      </header>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}

export function FormStatus({ message, success = false }: { message?: string; success?: boolean }) {
  if (!message) return null;
  return (
    <div className={`form-status ${success ? "success" : "error"}`} role={success ? "status" : "alert"}>
      {success ? <CheckCircleIcon /> : null}
      <span>{message}</span>
    </div>
  );
}
