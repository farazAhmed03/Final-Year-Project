import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  FiBell,
  FiBriefcase,
  FiCalendar,
  FiChevronRight,
  FiHome,
  FiLogOut,
  FiMessageCircle,
  FiSearch,
  FiShield,
  FiUser,
  FiUsers
} from "react-icons/fi";
import { useAuth } from "../contexts/AuthContext";
import { useSocket } from "../contexts/SocketContext";
import { Avatar } from "./UI";

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
    common.splice(1, 0, { to: "/lawyers", label: "Find lawyers", icon: FiSearch });
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

export default function AppShell() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();
  const links = linksFor(user.role);

  const signOut = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink className="brand sidebar-brand" to="/app/dashboard">
          <span className="brand-mark">LS</span>
          <span>LegalSphere</span>
        </NavLink>

        <div className="sidebar-user">
          <Avatar user={user} size="lg" />
          <div>
            <strong>{user.name}</strong>
            <span>{user.role}</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Dashboard navigation">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => isActive ? "active" : ""}>
              <Icon />
              <span>{label}</span>
              <FiChevronRight className="nav-chevron" />
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className={`connection-dot ${connected ? "online" : ""}`} />
          <span>{connected ? "Real-time connected" : "Connecting…"}</span>
          <button className="sidebar-logout" onClick={signOut}>
            <FiLogOut /> Sign out
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div>
            <span className="topbar-label">Secure legal workspace</span>
          </div>
          <div className="topbar-user">
            <span>{user.email}</span>
            <Avatar user={user} />
          </div>
        </header>
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
