import { NavLink } from "react-router-dom";

const items = [
  { to: "/", label: "Головна" },
  { to: "/stock", label: "Склад" },
  { to: "/add", label: "Додати" },
  { to: "/history", label: "Історія" },
  { to: "/income", label: "Прибуток" },
];

export default function SideMenu({ variant = "drawer", open, onClose }) {
  const isDrawer = variant === "drawer";

  return (
    <>
      {isDrawer && (
        <div className={`overlay ${open ? "show" : ""}`} onClick={onClose} />
      )}

      <aside className={`sidemenu ${variant} ${open ? "open" : ""}`}>
        <div className="sidemenuHeader">
          <div className="sidemenuTitle">Меню</div>
          {isDrawer && (
            <button className="iconBtn" onClick={onClose} aria-label="Close menu">
              ✕
            </button>
          )}
        </div>

        <nav className="nav">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              className={({ isActive }) => `navItem ${isActive ? "active" : ""}`}
              onClick={isDrawer ? onClose : undefined}
            >
              {it.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}