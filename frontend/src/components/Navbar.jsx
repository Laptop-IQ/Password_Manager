import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/", label: "Passwords", icon: "ri-key-2-line", end: true },
  { to: "/vault", label: "Cards & secrets", icon: "ri-bank-card-line" },
  { to: "/security", label: "Security", icon: "ri-shield-keyhole-line", end: true },
  { to: "/security/audit", label: "Audit", icon: "ri-radar-line" },
];

const linkClass = ({ isActive }) =>
  `flex items-center gap-2 rounded-md px-3 h-9 text-sm font-medium transition-colors ${
    isActive
      ? "bg-sunken text-ink"
      : "text-muted hover:bg-sunken/70 hover:text-ink"
  }`;

export default function Navbar({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [menuOpen]);

  const handleLogout = () => {
    onLogout();
    navigate("/login");
  };

  const displayName = user?.name || user?.email || "";
  const initial = displayName.trim().charAt(0).toUpperCase();

  return (
    <header
      ref={menuRef}
      className="fixed inset-x-0 top-0 z-50 border-b border-line bg-canvas/95 backdrop-blur-sm print:hidden"
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-6 px-4 sm:px-8">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-md text-[15px] font-semibold tracking-tight text-ink"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-white">
            <i className="ri-lock-2-fill text-[16px]" aria-hidden="true" />
          </span>
          Password Vault
        </Link>

        {user ? (
          <>
            <nav
              aria-label="Main"
              className="hidden items-center gap-1 md:flex"
            >
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={linkClass}
                >
                  <i className={`${item.icon} text-[16px]`} aria-hidden="true" />
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="ml-auto hidden items-center gap-3 md:flex">
              <div className="flex items-center gap-2.5">
                <span
                  className="grid h-8 w-8 place-items-center rounded-full bg-accent-tint text-[13px] font-semibold text-accent"
                  aria-hidden="true"
                >
                  {initial || <i className="ri-user-line" />}
                </span>
                <span className="max-w-[180px] truncate text-sm text-ink-soft">
                  {displayName}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="btn btn-secondary h-9 px-3"
              >
                <i className="ri-logout-box-r-line text-[16px]" aria-hidden="true" />
                Log out
              </button>
            </div>

            <button
              type="button"
              className="icon-btn ml-auto h-10 w-10 text-[22px] md:hidden"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <i
                className={menuOpen ? "ri-close-line" : "ri-menu-line"}
                aria-hidden="true"
              />
            </button>
          </>
        ) : (
          <div className="ml-auto flex items-center gap-2">
            <Link to="/login" className="btn btn-ghost h-9 px-3">
              Log in
            </Link>
            <Link to="/signup" className="btn btn-primary h-9 px-3">
              Create account
            </Link>
          </div>
        )}
      </div>

      {user && menuOpen && (
        <div
          id="mobile-menu"
          className="border-t border-line bg-canvas px-4 pb-4 pt-2 shadow-pop md:hidden"
        >
          <nav aria-label="Mobile" className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={(s) => `${linkClass(s)} h-11`}
              >
                <i className={`${item.icon} text-[18px]`} aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
            <span className="min-w-0 truncate text-sm text-ink-soft">
              {displayName}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="btn btn-secondary h-9 px-3"
            >
              <i className="ri-logout-box-r-line text-[16px]" aria-hidden="true" />
              Log out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
