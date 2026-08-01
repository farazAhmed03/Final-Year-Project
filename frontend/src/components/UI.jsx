import React from "react";
import { FiAlertCircle, FiInbox, FiLoader } from "react-icons/fi";
import { initials, titleCase } from "../utils/format";

export function Loader({ label = "Loading…" }) {
  return (
    <div className="loader-inline" role="status" aria-live="polite">
      <FiLoader className="spin" />
      <span>{label}</span>
    </div>
  );
}

export function FullPageLoader({ label }) {
  return (
    <div className="full-loader">
      <div className="brand-mark">LS</div>
      <Loader label={label} />
    </div>
  );
}

export function Avatar({ user, size = "md" }) {
  return user?.avatarUrl ? (
    <img className={`avatar avatar-${size}`} src={user.avatarUrl} alt="" />
  ) : (
    <span className={`avatar avatar-${size} avatar-fallback`} aria-hidden="true">
      {initials(user?.name)}
    </span>
  );
}

export function StatusBadge({ value }) {
  return <span className={`status-badge status-${value || "unknown"}`}>{titleCase(value || "unknown")}</span>;
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state">
      <FiInbox />
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="error-state" role="alert">
      <FiAlertCircle />
      <div>
        <strong>Unable to load this section</strong>
        <p>{message}</p>
      </div>
      {onRetry && <button className="btn btn-outline-dark btn-sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function StatCard({ label, value, icon, hint }) {
  return (
    <article className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {hint && <small>{hint}</small>}
      </div>
    </article>
  );
}

export function Modal({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop-custom" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="modal-body-custom">{children}</div>
        {footer && <footer>{footer}</footer>}
      </section>
    </div>
  );
}
