import React, { useCallback, useEffect, useState } from "react";
import { FiCheck, FiSearch, FiShield, FiUserX, FiX } from "react-icons/fi";
import { toast } from "react-toastify";
import api, { apiErrorMessage } from "../api/client";
import { Avatar, EmptyState, ErrorState, Loader, PageHeader, StatusBadge } from "../components/UI";
import { formatDate, titleCase } from "../utils/format";

export function AdminUsers() {
  const [filters, setFilters] = useState({ search: "", role: "", status: "" });
  const [query, setQuery] = useState(filters);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await api.get("/admin/users", {
        params: { ...query, limit: 100 }
      });
      setData(response.data.data);
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (user, status) => {
    setWorking(user._id);
    try {
      await api.patch(`/admin/users/${user._id}/status`, { status });
      toast.success(`${user.name} is now ${status}.`);
      await load();
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setWorking("");
    }
  };

  return (
    <>
      <PageHeader eyebrow="Administration" title="User management" description="Account suspension revokes active sessions immediately." />
      <form className="toolbar admin-filter" onSubmit={(event) => { event.preventDefault(); setQuery(filters); }}>
        <label><FiSearch /><input placeholder="Name, email or city" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label>
        <select aria-label="Role" value={filters.role} onChange={(event) => setFilters({ ...filters, role: event.target.value })}>
          <option value="">All roles</option><option value="client">Clients</option><option value="lawyer">Lawyers</option><option value="admin">Administrators</option>
        </select>
        <select aria-label="Status" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
          <option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option>
        </select>
        <button className="btn btn-brand">Apply</button>
      </form>

      {error && <ErrorState message={error} onRetry={load} />}
      {!data && !error ? <Loader label="Loading users…" /> : data?.items.length ? (
        <div className="table-wrap panel">
          <table className="data-table">
            <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Email</th><th>Joined</th><th>Action</th></tr></thead>
            <tbody>
              {data.items.map((user) => (
                <tr key={user._id}>
                  <td><div className="table-user"><Avatar user={user} /><div><strong>{user.name}</strong><small>{user.city || "No city"}</small></div></div></td>
                  <td>{titleCase(user.role)}</td>
                  <td><StatusBadge value={user.status} /></td>
                  <td>{user.email}</td>
                  <td>{formatDate(user.createdAt, { dateOnly: true })}</td>
                  <td>
                    {user.status === "active" ? (
                      <button className="btn btn-sm btn-outline-danger" disabled={working === user._id} onClick={() => updateStatus(user, "suspended")}><FiUserX /> Suspend</button>
                    ) : (
                      <button className="btn btn-sm btn-success" disabled={working === user._id} onClick={() => updateStatus(user, "active")}><FiCheck /> Activate</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState title="No users matched" description="Change the filters and try again." />}
    </>
  );
}

export function AdminLawyers() {
  const [items, setItems] = useState(null);
  const [notes, setNotes] = useState({});
  const [error, setError] = useState("");
  const [working, setWorking] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await api.get("/admin/lawyers/pending");
      setItems(response.data.data.items);
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (lawyer, status) => {
    setWorking(lawyer._id);
    try {
      await api.patch(`/admin/lawyers/${lawyer._id}/verification`, {
        status,
        note: notes[lawyer._id] || ""
      });
      toast.success(`${lawyer.name} was ${status}.`);
      await load();
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError));
    } finally {
      setWorking("");
    }
  };

  return (
    <>
      <PageHeader eyebrow="Professional verification" title="Lawyer approval" description="Review license and professional profile details before making an account public." />
      <div className="security-callout"><FiShield /><div><strong>Approval is an administrative responsibility</strong><p>Verify licenses using the appropriate issuing authority outside this application before approval.</p></div></div>
      {error && <ErrorState message={error} onRetry={load} />}
      {!items && !error ? <Loader label="Loading verification queue…" /> : items?.length ? (
        <div className="approval-grid">
          {items.map((lawyer) => (
            <article className="panel approval-card" key={lawyer._id}>
              <div className="approval-user"><Avatar user={lawyer} size="lg" /><div><h2>{lawyer.name}</h2><p>{lawyer.email} · {lawyer.city || "No city"}</p></div><StatusBadge value="pending" /></div>
              <dl className="profile-facts">
                <div><dt>License number</dt><dd>{lawyer.lawyerProfile?.licenseNumber || "Not provided"}</dd></div>
                <div><dt>Specialization</dt><dd>{lawyer.lawyerProfile?.specialization || "Not provided"}</dd></div>
                <div><dt>Experience</dt><dd>{lawyer.lawyerProfile?.experienceYears || 0} years</dd></div>
                <div><dt>Submitted</dt><dd>{formatDate(lawyer.createdAt, { dateOnly: true })}</dd></div>
              </dl>
              <label>Decision note<textarea rows="3" maxLength="500" value={notes[lawyer._id] || ""} onChange={(event) => setNotes({ ...notes, [lawyer._id]: event.target.value })} /></label>
              <div className="card-actions">
                <button className="btn btn-success" disabled={working === lawyer._id} onClick={() => decide(lawyer, "approved")}><FiCheck /> Approve</button>
                <button className="btn btn-outline-danger" disabled={working === lawyer._id} onClick={() => decide(lawyer, "rejected")}><FiX /> Reject</button>
              </div>
            </article>
          ))}
        </div>
      ) : <EmptyState title="Verification queue is clear" description="New verified-email lawyer applications will appear here." />}
    </>
  );
}
