export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand-lockup">
      <img src="/images/app-icon.png" alt="" aria-hidden="true" />
      <span>
        <b>Adventure Time TCG</b>
        {compact ? null : <small>Every card opens a story</small>}
      </span>
    </span>
  );
}
