import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  FiBell,
  FiBriefcase,
  FiCalendar,
  FiChevronRight,
  FiHome,
  FiLogOut,
  FiMenu,
  FiMessageCircle,
  FiSearch,
  FiShield,
  FiUser,
  FiUsers,
  FiX
} from "react-icons/fi";
import { useAuth } from "../contexts/AuthContext";
import { useSocket } from "../contexts/SocketContext";
import { Avatar } from "./UI";

const COLLAPSED_KEY = "legalsphere:sidebar-collapsed";

function linksFor(role) {
  const common = [
    { to: "/app/dashboard", label: "Overview", icon: FiHome },
    { to: "/app/appointments", label: "Appointments", icon: FiCalendar },
    { to: "/app/cases", label: "Cases", icon: FiBriefcase },
    { to: "/app/chat", label: "Messages", icon: FiMessageCircle },
    { to: "/app/notifications", label: "Notifications", icon: FiBell },
    { to: "/app/profile", label: "Profile", icon: FiUser }
  ];

  if (role === "client") {
    common.splice(1, 0, {
      to: "/lawyers",
      label: "Find lawyers",
      icon: FiSearch
    });
  }

  if (role === "admin") {
    return [
      { to: "/app/dashboard", label: "Overview", icon: FiHome },
      { to: "/app/admin/users", label: "Users", icon: FiUsers },
      { to: "/app/admin/lawyers", label: "Lawyer approval", icon: FiShield },
      { to: "/app/cases", label: "Cases", icon: FiBriefcase },
      { to: "/app/appointments", label: "Appointments", icon: FiCalendar },
      { to: "/app/notifications", label: "Notifications", icon: FiBell },
      { to: "/app/profile", label: "Profile", icon: FiUser }
    ];
  }

  return common;
}

function isCompactViewport() {
  return window.matchMedia("(max-width: 900px)").matches;
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const links = linksFor(user.role);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    if (!sidebarOpen || !isCompactViewport()) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [sidebarOpen]);

  const toggleSidebar = () => {
    if (isCompactViewport()) {
      setSidebarOpen((current) => !current);
      return;
    }

    setSidebarCollapsed((current) => {
      const next = !current;

      try {
        window.localStorage.setItem(COLLAPSED_KEY, String(next));
      } catch {
        // The UI still works if browser storage is unavailable.
      }

      return next;
    });
  };

  const signOut = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const openProfile = () => {
    setSidebarOpen(false);
    navigate("/app/profile");
  };

  return (
    <div
      className={[
        "app-shell",
        sidebarCollapsed ? "sidebar-collapsed" : "",
        sidebarOpen ? "sidebar-open" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        className="sidebar-backdrop"
        aria-label="Close navigation"
        onClick={() => setSidebarOpen(false)}
      />

      <aside className="sidebar" aria-label="Application sidebar">
        <div className="sidebar-heading">
          <NavLink className="brand sidebar-brand" to="/app/dashboard">
            <span className="brand-mark">LS</span>
            <span className="sidebar-brand-name">LegalSphere</span>
          </NavLink>

          <button
            type="button"
            className="sidebar-menu-button"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? "Close navigation" : "Toggle navigation"}
            aria-expanded={sidebarOpen}
          >
            <FiMenu className="sidebar-menu-desktop-icon" />
            <FiX className="sidebar-menu-mobile-icon" />
          </button>
        </div>

        <button type="button" className="sidebar-user" onClick={openProfile}>
          <Avatar user={user} size="lg" />
          <span className="sidebar-user-copy">
            <strong>{user.name}</strong>
            <span>{user.role}</span>
          </span>
        </button>

        <nav className="sidebar-nav" aria-label="Dashboard navigation">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={sidebarCollapsed ? label : undefined}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <Icon />
              <span>{label}</span>
              <FiChevronRight className="nav-chevron" />
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className={`connection-dot ${connected ? "online" : ""}`} />
          <span>{connected ? "Real-time connected" : "Connecting…"}</span>
          <button type="button" className="sidebar-logout" onClick={signOut}>
            <FiLogOut />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="topbar-start">
            <button
              type="button"
              className="topbar-menu-button"
              onClick={toggleSidebar}
              aria-label="Toggle sidebar"
              aria-expanded={sidebarOpen}
            >
              <FiMenu />
            </button>
            <span className="topbar-label">Secure legal workspace</span>
          </div>

          <button type="button" className="topbar-user" onClick={openProfile}>
            <span>{user.email}</span>
            <Avatar user={user} />
          </button>
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
