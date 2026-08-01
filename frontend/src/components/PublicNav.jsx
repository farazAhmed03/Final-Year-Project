import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { FiMenu, FiX } from "react-icons/fi";
import { useAuth } from "../contexts/AuthContext";
import { roleHome } from "../utils/roles";

export default function PublicNav() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <header className="public-nav-wrap">
      <nav className="public-nav container-xl" aria-label="Primary navigation">
        <Link className="brand" to="/" aria-label="LegalSphere home">
          <span className="brand-mark">LS</span>
          <span>LegalSphere</span>
        </Link>

        <button
          className="nav-toggle"
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="public-navigation"
          aria-label={open ? "Close navigation" : "Open navigation"}
        >
          {open ? <FiX /> : <FiMenu />}
        </button>

        <div id="public-navigation" className={`public-nav-links ${open ? "is-open" : ""}`}>
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/lawyers">Find lawyers</NavLink>
          <NavLink to="/about">About</NavLink>
          {user ? (
            <Link className="btn btn-brand" to={roleHome(user.role)}>Open dashboard</Link>
          ) : (
            <>
              <Link to="/login">Sign in</Link>
              <Link className="btn btn-brand" to="/register">Create account</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
