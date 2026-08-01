import React, { useCallback, useEffect, useState } from "react";
import { FiCalendar, FiCheck, FiCreditCard, FiPhone, FiVideo, FiX } from "react-icons/fi";
import { toast } from "react-toastify";
import api, { apiErrorMessage } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { EmptyState, ErrorState, Loader, PageHeader, StatusBadge } from "../components/UI";
import { formatDate, formatMoney, titleCase } from "../utils/format";

const statuses = ["", "requested", "confirmed", "completed", "rejected", "cancelled"];

export default function Appointments() {
  const { user } = useAuth();
  const [status, setStatus] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await api.get("/appointments", { params: { status: status || undefined, limit: 50 } });
      setData(response.data.data);
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (id, nextStatus) => {
    setWorking(`${id}:${nextStatus}`);
    try {
      await api.patch(`/appointments/${id}/status`, { status: nextStatus });
      toast.success(`Appointment ${nextStatus}.`);
      await load();
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError));
    } finally {
      setWorking("");
    }
  };

  const checkout = async (appointmentId) => {
    setWorking(`${appointmentId}:payment`);
    try {
      const response = await api.post("/payments/checkout", { appointmentId });
      window.location.assign(response.data.data.checkoutUrl);
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError));
      setWorking("");
    }
  };

  const actionButtons = (item) => {
    if (user.role === "lawyer" && item.status === "requested") {
      return (
        <>
          <button className="btn btn-sm btn-success" disabled={working} onClick={() => update(item._id, "confirmed")}><FiCheck /> Confirm</button>
          <button className="btn btn-sm btn-outline-danger" disabled={working} onClick={() => update(item._id, "rejected")}><FiX /> Reject</button>
        </>
      );
    }
    if (user.role === "lawyer" && item.status === "confirmed" && new Date(item.startsAt) <= new Date()) {
      return <button className="btn btn-sm btn-brand" disabled={working} onClick={() => update(item._id, "completed")}>Mark completed</button>;
    }
    if (user.role === "client" && ["requested", "confirmed"].includes(item.status)) {
      return (
        <>
          {item.status === "confirmed" && item.paymentStatus === "pending" && item.fee > 0 && (
            <button className="btn btn-sm btn-brand" disabled={working} onClick={() => checkout(item._id)}><FiCreditCard /> Pay securely</button>
          )}
          <button className="btn btn-sm btn-outline-danger" disabled={working} onClick={() => update(item._id, "cancelled")}>Cancel</button>
        </>
      );
    }
    return null;
  };

  return (
    <>
      <PageHeader
        eyebrow="Schedule"
        title="Appointments"
        description="Requests follow controlled status changes so both sides always see the same outcome."
      />

      <div className="toolbar">
        <label>Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {statuses.map((item) => <option value={item} key={item || "all"}>{item ? titleCase(item) : "All statuses"}</option>)}
          </select>
        </label>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!data && !error ? <Loader label="Loading appointments…" /> : data?.items.length ? (
        <div className="appointment-grid">
          {data.items.map((item) => {
            const counterpart = user.role === "client" ? item.lawyer : item.client;
            const ModeIcon = item.mode === "phone" ? FiPhone : item.mode === "online" ? FiVideo : FiCalendar;
            return (
              <article className="appointment-card" key={item._id}>
                <div className="appointment-date">
                  <span>{new Date(item.startsAt).toLocaleString(undefined, { month: "short" })}</span>
                  <strong>{new Date(item.startsAt).getDate()}</strong>
                  <small>{new Date(item.startsAt).toLocaleString(undefined, { weekday: "short" })}</small>
                </div>
                <div className="appointment-body">
                  <div className="appointment-title">
                    <div><small>{user.role === "client" ? "Lawyer" : user.role === "lawyer" ? "Client" : "Participants"}</small><h3>{counterpart?.name || `${item.client?.name} / ${item.lawyer?.name}`}</h3></div>
                    <StatusBadge value={item.status} />
                  </div>
                  <div className="appointment-meta">
                    <span><FiCalendar /> {formatDate(item.startsAt)}</span>
                    <span><ModeIcon /> {titleCase(item.mode)} · {item.durationMinutes} min</span>
                    <span><FiCreditCard /> {formatMoney(item.fee)} · {titleCase(item.paymentStatus)}</span>
                  </div>
                  <p>{item.reason}</p>
                  {item.decisionNote && <div className="decision-note"><strong>Note:</strong> {item.decisionNote}</div>}
                  <div className="card-actions">{actionButtons(item)}</div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No appointments found" description={user.role === "client" ? "Browse approved lawyers to request a consultation." : "New client requests will appear here."} />
      )}
    </>
  );
}
