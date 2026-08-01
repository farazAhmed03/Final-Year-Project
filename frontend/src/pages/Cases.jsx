import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowRight, FiBriefcase, FiFileText, FiPlus } from "react-icons/fi";
import { toast } from "react-toastify";
import api, { apiErrorMessage } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { EmptyState, ErrorState, Loader, Modal, PageHeader, StatusBadge } from "../components/UI";
import { formatDate, titleCase } from "../utils/format";

const blankCase = {
  lawyerId: "",
  appointmentId: "",
  title: "",
  category: "",
  description: ""
};

export function Cases() {
  const { user } = useAuth();
  const [status, setStatus] = useState("");
  const [data, setData] = useState(null);
  const [lawyers, setLawyers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankCase);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await api.get("/cases", { params: { status: status || undefined, limit: 50 } });
      setData(response.data.data);
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (user.role !== "client") return;
    Promise.all([
      api.get("/lawyers", { params: { limit: 50 } }),
      api.get("/appointments", { params: { status: "confirmed", limit: 50 } })
    ]).then(([lawyerResponse, appointmentResponse]) => {
      setLawyers(lawyerResponse.data.data.items);
      setAppointments(appointmentResponse.data.data.items);
    }).catch(() => {
      setLawyers([]);
      setAppointments([]);
    });
  }, [user.role]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => body.append(key, value));
      Array.from(files).forEach((file) => body.append("documents", file));
      const response = await api.post("/cases", body);
      toast.success("Case submitted securely.");
      setOpen(false);
      setForm(blankCase);
      setFiles([]);
      await load();
      return response;
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Legal work"
        title="Cases"
        description="Status history, participants and documents remain connected to the same case record."
        actions={user.role === "client" && <button className="btn btn-brand" onClick={() => setOpen(true)}><FiPlus /> Submit case</button>}
      />

      <div className="toolbar">
        <label>Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {["submitted", "accepted", "in_progress", "closed", "rejected"].map((item) => <option value={item} key={item}>{titleCase(item)}</option>)}
          </select>
        </label>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!data && !error ? <Loader label="Loading cases…" /> : data?.items.length ? (
        <div className="case-grid">
          {data.items.map((item) => {
            const counterpart = user.role === "client" ? item.lawyer : item.client;
            return (
              <article className="case-card" key={item._id}>
                <div className="case-card-head">
                  <span className="row-icon"><FiBriefcase /></span>
                  <StatusBadge value={item.status} />
                </div>
                <span className="case-category">{item.category}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <div className="case-meta">
                  <span>{user.role === "client" ? "Lawyer" : "Client"}: <strong>{counterpart?.name || "Platform record"}</strong></span>
                  <span><FiFileText /> {item.documents?.length || 0} document(s)</span>
                  <span>Updated {formatDate(item.updatedAt)}</span>
                </div>
                <Link className="text-link" to={`/app/cases/${item._id}`}>Open case <FiArrowRight /></Link>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No cases found" description="Cases matching this status will appear here." />
      )}

      <Modal open={open} title="Submit a new case" onClose={() => setOpen(false)}>
        <form className="form-stack" onSubmit={submit}>
          <label>Lawyer
            <select required value={form.lawyerId} onChange={(event) => setForm({ ...form, lawyerId: event.target.value, appointmentId: "" })}>
              <option value="">Choose an approved lawyer</option>
              {lawyers.map((lawyer) => <option key={lawyer._id} value={lawyer._id}>{lawyer.name} — {lawyer.lawyerProfile?.specialization}</option>)}
            </select>
          </label>
          <label>Related confirmed appointment (optional)
            <select value={form.appointmentId} onChange={(event) => setForm({ ...form, appointmentId: event.target.value })}>
              <option value="">No linked appointment</option>
              {appointments.filter((item) => !form.lawyerId || item.lawyer?._id === form.lawyerId).map((item) => (
                <option key={item._id} value={item._id}>{formatDate(item.startsAt)} — {item.lawyer?.name}</option>
              ))}
            </select>
          </label>
          <div className="form-grid-two">
            <label>Case title<input minLength="3" maxLength="200" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
            <label>Category<input minLength="2" maxLength="100" required placeholder="e.g. Family Law" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
          </div>
          <label>Description<textarea rows="6" minLength="10" maxLength="10000" required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <label>Documents (PDF, JPG or PNG; maximum 5 files)
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" multiple onChange={(event) => setFiles(event.target.files)} />
            <small>Each file may be up to 10 MB. Files are checked again by the server.</small>
          </label>
          <button className="btn btn-brand btn-lg" disabled={busy}>{busy ? <Loader label="Submitting securely…" /> : "Submit case"}</button>
        </form>
      </Modal>
    </>
  );
}
