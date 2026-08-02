import React, {
  useCallback,
  useEffect,
  useState
} from "react";
import { useNavigate } from "react-router-dom";
import {
  FiCalendar,
  FiCheck,
  FiCreditCard,
  FiMessageCircle,
  FiPhone,
  FiVideo,
  FiX
} from "react-icons/fi";
import { toast } from "react-toastify";
import api, {
  apiErrorMessage
} from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import {
  EmptyState,
  ErrorState,
  Loader,
  PageHeader,
  StatusBadge
} from "../components/UI";
import {
  formatDate,
  formatMoney,
  titleCase
} from "../utils/format";

const statuses = [
  "",
  "requested",
  "confirmed",
  "completed",
  "rejected",
  "cancelled"
];

export default function Appointments() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState("");

  const load = useCallback(async () => {
    setError("");

    try {
      const response = await api.get(
        "/appointments",
        {
          params: {
            status: status || undefined,
            limit: 50
          }
        }
      );

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
      await api.patch(
        `/appointments/${id}/status`,
        { status: nextStatus }
      );

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
      const response = await api.post(
        "/payments/checkout",
        { appointmentId }
      );

      window.location.assign(
        response.data.data.checkoutUrl
      );
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError));
      setWorking("");
    }
  };

  const openConversation = async (item) => {
    const counterpart = user.role === "client"
      ? item.lawyer
      : item.client;

    if (!counterpart?._id) {
      toast.error("Conversation participant is unavailable.");
      return;
    }

    setWorking(`${item._id}:chat`);

    try {
      const response = await api.post(
        "/conversations",
        { userId: counterpart._id }
      );

      navigate(
        `/app/chat/${response.data.data.conversation._id}`
      );
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError));
    } finally {
      setWorking("");
    }
  };

  const actionButtons = (item) => {
    const chatAvailable =
      ["client", "lawyer"].includes(user.role) &&
      ["confirmed", "completed"].includes(item.status);

    const canComplete =
      user.role === "lawyer" &&
      item.status === "confirmed" &&
      new Date(item.startsAt) <= new Date();

    const canClientCancel =
      user.role === "client" &&
      ["requested", "confirmed"].includes(item.status);

    return (
      <>
        {user.role === "lawyer" && item.status === "requested" && (
          <>
            <button
              className="btn btn-sm btn-success"
              disabled={Boolean(working)}
              onClick={() =>
                update(item._id, "confirmed")
              }
            >
              <FiCheck /> Confirm
            </button>

            <button
              className="btn btn-sm btn-outline-danger"
              disabled={Boolean(working)}
              onClick={() =>
                update(item._id, "rejected")
              }
            >
              <FiX /> Reject
            </button>
          </>
        )}

        {chatAvailable && (
          <button
            className="btn btn-sm btn-outline-dark"
            disabled={Boolean(working)}
            onClick={() => openConversation(item)}
          >
            <FiMessageCircle /> Open chat
          </button>
        )}

        {canComplete && (
          <button
            className="btn btn-sm btn-brand"
            disabled={Boolean(working)}
            onClick={() =>
              update(item._id, "completed")
            }
          >
            Mark completed
          </button>
        )}

        {canClientCancel && (
          <>
            {item.status === "confirmed" &&
              item.paymentStatus === "pending" &&
              item.fee > 0 && (
                <button
                  className="btn btn-sm btn-brand"
                  disabled={Boolean(working)}
                  onClick={() => checkout(item._id)}
                >
                  <FiCreditCard /> Pay securely
                </button>
              )}

            <button
              className="btn btn-sm btn-outline-danger"
              disabled={Boolean(working)}
              onClick={() =>
                update(item._id, "cancelled")
              }
            >
              Cancel
            </button>
          </>
        )}
      </>
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="Schedule"
        title="Appointments"
        description="Messaging unlocks only after a lawyer confirms an appointment."
      />

      <div className="toolbar">
        <label>
          Status
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value)
            }
          >
            {statuses.map((item) => (
              <option
                value={item}
                key={item || "all"}
              >
                {item
                  ? titleCase(item)
                  : "All statuses"}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <ErrorState
          message={error}
          onRetry={load}
        />
      )}

      {!data && !error ? (
        <Loader label="Loading appointments…" />
      ) : data?.items.length ? (
        <div className="appointment-grid">
          {data.items.map((item) => {
            const counterpart = user.role === "client"
              ? item.lawyer
              : item.client;

            const ModeIcon = item.mode === "phone"
              ? FiPhone
              : item.mode === "online"
                ? FiVideo
                : FiCalendar;

            return (
              <article
                className="appointment-card"
                key={item._id}
              >
                <div className="appointment-date">
                  <span>
                    {new Date(item.startsAt).toLocaleString(
                      undefined,
                      { month: "short" }
                    )}
                  </span>
                  <strong>
                    {new Date(item.startsAt).getDate()}
                  </strong>
                  <small>
                    {new Date(item.startsAt).toLocaleString(
                      undefined,
                      { weekday: "short" }
                    )}
                  </small>
                </div>

                <div className="appointment-body">
                  <div className="appointment-title">
                    <div>
                      <small>
                        {user.role === "client"
                          ? "Lawyer"
                          : user.role === "lawyer"
                            ? "Client"
                            : "Participants"}
                      </small>
                      <h3>
                        {counterpart?.name
                          || `${item.client?.name} / ${item.lawyer?.name}`}
                      </h3>
                    </div>
                    <StatusBadge value={item.status} />
                  </div>

                  <div className="appointment-meta">
                    <span>
                      <FiCalendar />
                      {formatDate(item.startsAt)}
                    </span>
                    <span>
                      <ModeIcon />
                      {titleCase(item.mode)} · {item.durationMinutes} min
                    </span>
                    <span>
                      <FiCreditCard />
                      {formatMoney(item.fee)} · {titleCase(item.paymentStatus)}
                    </span>
                  </div>

                  <p>{item.reason}</p>

                  {item.decisionNote && (
                    <div className="decision-note">
                      <strong>Note:</strong>{" "}
                      {item.decisionNote}
                    </div>
                  )}

                  <div className="card-actions">
                    {actionButtons(item)}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No appointments found"
          description={
            user.role === "client"
              ? "Browse approved lawyers to request a consultation."
              : "New client requests will appear here."
          }
        />
      )}
    </>
  );
}
