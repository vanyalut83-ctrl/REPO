export default function TopBar({ title, showMenuButton, onOpenMenu }) {
  return (
    <header className="topbar">
      {showMenuButton ? (
        <button className="iconBtn" onClick={onOpenMenu} aria-label="Open menu">
          ☰
        </button>
      ) : (
        <div style={{ width: 40 }} />
      )}

      <div className="topbarTitle">{title}</div>
    </header>
  );
}