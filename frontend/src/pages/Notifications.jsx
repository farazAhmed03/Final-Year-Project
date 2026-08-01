import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiBell, FiCheck } from "react-icons/fi";
import { toast } from "react-toastify";
import api, { apiErrorMessage } from "../api/client";
import { EmptyState, ErrorState, Loader, PageHeader } from "../components/UI";
import { formatDate, titleCase } from "../utils/format";

export default function Notifications() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await api.get("/notifications", { params: { limit: 50 } });
      setData(response.data.data);
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    }
  }, []);

  useEffect(() => {
    load();
    const update = () => load();
    window.addEventListener("legalsphere:notification", update);
    return () => window.removeEventListener("legalsphere:notification", update);
  }, [load]);

  const markAll = async () => {
    try {
      await api.patch("/notifications/read-all");
      await load();
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  };

  const open = async (item) => {
    try {
      if (!item.readAt) await api.patch(`/notifications/${item._id}/read`);
      if (item.link) navigate(item.link);
      else await load();
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Activity"
        title="Notifications"
        description="System events, messages and workflow decisions appear here."
        actions={data?.unreadCount > 0 && <button className="btn btn-outline-dark" onClick={markAll}><FiCheck /> Mark all read</button>}
      />

      {error && <ErrorState message={error} onRetry={load} />}
      {!data && !error ? <Loader label="Loading notifications…" /> : data?.items.length ? (
        <div className="notification-list">
          {data.items.map((item) => (
            <button className={`notification-row ${item.readAt ? "" : "unread"}`} onClick={() => open(item)} key={item._id}>
              <span className="notification-icon"><FiBell /></span>
              <div>
                <span className="notification-type">{titleCase(item.type)}</span>
                <strong>{item.title}</strong>
                <p>{item.message}</p>
                <small>{formatDate(item.createdAt)}</small>
              </div>
              {!item.readAt && <span className="unread-dot" />}
            </button>
          ))}
        </div>
      ) : (
        <EmptyState title="No notifications" description="Important account and case updates will appear here." />
      )}
    </>
  );
}
