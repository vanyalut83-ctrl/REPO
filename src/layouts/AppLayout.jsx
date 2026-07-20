import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import TopBar from "../components/navigation/TopBar";
import SideMenu from "../components/navigation/SideMenu";
import { useMediaQuery } from "../shared/useMediaQuery";

const titles = {
  "/": "Головна",
  "/stock": "Склад",
  "/add": "Додати",
  "/history": "Історія",
  "/income": "Прибуток",
};

export default function AppLayout() {
  const isDesktop = useMediaQuery("(min-width: 960px)");
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    // на ПК drawer не потрібен
    if (isDesktop) setMenuOpen(false);
  }, [isDesktop]);

  const title = titles[pathname] ?? "Сторінка";

  return (
    <div className="layout">
      <SideMenu
        variant={isDesktop ? "sidebar" : "drawer"}
        open={isDesktop ? true : menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      <div className="layoutMain">
        <TopBar
          title={title}
          showMenuButton={!isDesktop}
          onOpenMenu={() => setMenuOpen(true)}
        />

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}