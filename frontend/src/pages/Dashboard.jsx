import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiBell,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiStar,
  FiUsers
} from "react-icons/fi";
import api, { apiErrorMessage } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { ErrorState, Loader, PageHeader, StatCard, StatusBadge } from "../components/UI";
import { formatDate, formatMoney, titleCase } from "../utils/format";

function statConfiguration(role, stats = {}) {
  if (role === "client") {
    return [
      ["Appointments", stats.appointments || 0, <FiCalendar />, "All consultation requests"],
      ["Upcoming", stats.upcoming || 0, <FiClock />, "Confirmed future meetings"],
      ["Active cases", stats.activeCases || 0, <FiBriefcase />, "Cases still in progress"],
      ["Closed cases", stats.closedCases || 0, <FiCheckCircle />, "Completed case records"],
      ["Total paid", formatMoney(stats.totalPaid || 0), <FiDollarSign />, "Confirmed consultation payments"],
      ["Unread", stats.unreadNotifications || 0, <FiBell />, "Unread notifications"]
    ];
  }
  if (role === "lawyer") {
    return [
      ["Pending requests", stats.pendingAppointments || 0, <FiCalendar />, "Waiting for your decision"],
      ["Upcoming", stats.upcoming || 0, <FiClock />, "Confirmed future meetings"],
      ["Active cases", stats.activeCases || 0, <FiBriefcase />, "Current legal work"],
      ["Closed cases", stats.closedCases || 0, <FiCheckCircle />, "Completed case records"],
      ["Average rating", stats.averageRating || "0.0", <FiStar />, `${stats.reviewCount || 0} verified reviews`],
      ["Unread", stats.unreadNotifications || 0, <FiBell />, "Unread notifications"]
    ];
  }
  return [
    ["Users", stats.users || 0, <FiUsers />, "Registered platform accounts"],
    ["Pending lawyers", stats.pendingLawyers || 0, <FiClock />, "Professional verification queue"],
    ["Active cases", stats.activeCases || 0, <FiBriefcase />, "Open platform cases"],
    ["Appointments", stats.appointments || 0, <FiCalendar />, "All platform appointments"],
    ["Unread", stats.unreadNotifications || 0, <FiBell />, "Unread notifications"]
  ];
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await api.get("/dashboard/summary");
      setData(response.data.data);
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cards = useMemo(() => statConfiguration(user.role, data?.stats), [user.role, data]);

  return (
    <>
      <PageHeader
        eyebrow={`${titleCase(user.role)} workspace`}
        title={`Welcome, ${user.name.split(" ")[0]}`}
        description="Here is the latest activity across your secure legal workspace."
        actions={user.role === "client" && <Link className="btn btn-brand" to="/lawyers">Find a lawyer</Link>}
      />

      {user.role === "lawyer" && user.lawyerProfile?.verificationStatus !== "approved" && (
        <div className={`verification-banner ${user.lawyerProfile?.verificationStatus || "pending"}`}>
          <div>
            <strong>Professional profile: {titleCase(user.lawyerProfile?.verificationStatus || "pending")}</strong>
            <p>
              {user.lawyerProfile?.verificationStatus === "rejected"
                ? user.lawyerProfile?.verificationNote || "Review your profile details and contact an administrator."
                : "Your profile stays out of public search until an administrator verifies it."}
            </p>
          </div>
          <Link className="btn btn-sm btn-outline-dark" to="/app/profile">Review profile</Link>
        </div>
      )}

      {error && <ErrorState message={error} onRetry={load} />}
      {!data && !error ? <Loader label="Loading dashboard…" /> : data && (
        <>
          <section className="stats-grid">
            {cards.map(([label, value, icon, hint]) => (
              <StatCard key={label} label={label} value={value} icon={icon} hint={hint} />
            ))}
          </section>

          <section className="dashboard-grid">
            <article className="panel">
              <header className="panel-header">
                <div><span className="eyebrow">Recent activity</span><h2>Cases</h2></div>
                <Link to="/app/cases">View all</Link>
              </header>
              <div className="compact-list">
                {data.recentCases.length ? data.recentCases.map((item) => {
                  const counterpart = user.role === "client" ? item.lawyer : item.client;
                  return (
                    <Link className="compact-row" to={`/app/cases/${item._id}`} key={item._id}>
                      <span className="row-icon"><FiBriefcase /></span>
                      <div><strong>{item.title}</strong><small>{counterpart?.name || "Platform case"} · {formatDate(item.updatedAt)}</small></div>
                      <StatusBadge value={item.status} />
                    </Link>
                  );
                }) : <p className="panel-empty">No cases to show yet.</p>}
              </div>
            </article>

            <article className="panel">
              <header className="panel-header">
                <div><span className="eyebrow">Schedule</span><h2>Appointments</h2></div>
                <Link to="/app/appointments">View all</Link>
              </header>
              <div className="compact-list">
                {data.recentAppointments.length ? data.recentAppointments.map((item) => {
                  const counterpart = user.role === "client" ? item.lawyer : item.client;
                  return (
                    <Link className="compact-row" to="/app/appointments" key={item._id}>
                      <span className="row-icon"><FiCalendar /></span>
                      <div><strong>{counterpart?.name || "Appointment"}</strong><small>{formatDate(item.startsAt)} · {titleCase(item.mode)}</small></div>
                      <StatusBadge value={item.status} />
                    </Link>
                  );
                }) : <p className="panel-empty">No appointments to show yet.</p>}
              </div>
            </article>
          </section>
        </>
      )}
    </>
  );
}
