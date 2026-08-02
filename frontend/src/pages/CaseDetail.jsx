import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  FiArrowLeft,
  FiCheckCircle,
  FiDownload,
  FiFileText,
  FiMessageCircle,
  FiPlus,
  FiStar
} from "react-icons/fi";
import { toast } from "react-toastify";
import api, { apiErrorMessage } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { Avatar, ErrorState, Loader, Modal, PageHeader, StatusBadge } from "../components/UI";
import { formatDate, titleCase } from "../utils/format";

export default function CaseDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [review, setReview] = useState(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState("");
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await api.get(`/cases/${id}`);
      setItem(response.data.data.case);
      if (response.data.data.case.status === "closed") {
        try {
          const reviewResponse = await api.get(`/reviews/cases/${id}`);
          setReview(reviewResponse.data.data.review);
        } catch (reviewError) {
          if (reviewError.response?.status !== 404) throw reviewError;
          setReview(null);
        }
      }
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (status) => {
    setWorking(status);
    try {
      await api.patch(`/cases/${id}/status`, { status });
      toast.success(`Case changed to ${titleCase(status)}.`);
      await load();
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError));
    } finally {
      setWorking("");
    }
  };

  const addDocuments = async (event) => {
    event.preventDefault();
    setWorking("documents");
    try {
      const body = new FormData();
      Array.from(files).forEach((file) => body.append("documents", file));
      await api.post(`/cases/${id}/documents`, body);
      toast.success("Documents added securely.");
      setDocumentsOpen(false);
      setFiles([]);
      await load();
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError));
    } finally {
      setWorking("");
    }
  };

  const download = async (document) => {
    setWorking(document._id);
    try {
      const response = await api.get(`/cases/${id}/documents/${document._id}`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = document.originalName;
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, "Document could not be downloaded."));
    } finally {
      setWorking("");
    }
  };

  const openConversation = async () => {
    const counterpart = user.role === "client" ? item.lawyer : item.client;
    try {
      const response = await api.post("/conversations", { userId: counterpart._id });
      navigate(`/app/chat/${response.data.data.conversation._id}`);
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError));
    }
  };

  const submitReview = async (event) => {
    event.preventDefault();
    setWorking("review");
    try {
      const response = await api.post("/reviews", {
        caseId: item._id,
        rating: Number(reviewForm.rating),
        comment: reviewForm.comment
      });
      setReview(response.data.data.review);
      setReviewOpen(false);
      toast.success("Review submitted.");
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError));
    } finally {
      setWorking("");
    }
  };

  const statusActions = () => {
    if (user.role !== "lawyer") return null;
    if (item.status === "submitted") {
      return (
        <>
          <button className="btn btn-success" disabled={working} onClick={() => updateStatus("accepted")}>Accept case</button>
          <button className="btn btn-outline-danger" disabled={working} onClick={() => updateStatus("rejected")}>Reject case</button>
        </>
      );
    }
    if (item.status === "accepted") {
      return (
        <>
          <button className="btn btn-brand" disabled={working} onClick={() => updateStatus("in_progress")}>Start work</button>
          <button className="btn btn-outline-dark" disabled={working} onClick={() => updateStatus("closed")}>Close case</button>
        </>
      );
    }
    if (item.status === "in_progress") {
      return <button className="btn btn-brand" disabled={working} onClick={() => updateStatus("closed")}><FiCheckCircle /> Close case</button>;
    }
    return null;
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!item) return <Loader label="Loading case…" />;

  const counterpart = user.role === "client" ? item.lawyer : item.client;
  const locked = ["closed", "rejected"].includes(item.status);

  return (
    <>
      <Link className="back-link" to="/app/cases"><FiArrowLeft /> Back to cases</Link>
      <PageHeader
        eyebrow={item.category}
        title={item.title}
        description={`Created ${formatDate(item.createdAt)} · Last updated ${formatDate(item.updatedAt)}`}
        actions={<StatusBadge value={item.status} />}
      />

      <div className="case-detail-actions">
        {statusActions()}
        {user.role !== "admin" && item.chatAvailable && <button className="btn btn-outline-dark" onClick={openConversation}><FiMessageCircle /> Open shared conversation</button>}
        {!locked && <button className="btn btn-outline-dark" onClick={() => setDocumentsOpen(true)}><FiPlus /> Add documents</button>}
        {user.role === "client" && item.status === "closed" && !review && (
          <button className="btn btn-gold" onClick={() => setReviewOpen(true)}><FiStar /> Review lawyer</button>
        )}
      </div>

      <section className="case-detail-grid">
        <div className="case-main-column">
          <article className="panel prose-panel">
            <span className="eyebrow">Case brief</span>
            <h2>Description</h2>
            <p>{item.description}</p>
          </article>

          <article className="panel">
            <header className="panel-header">
              <div><span className="eyebrow">Protected files</span><h2>Documents</h2></div>
              <span>{item.documents.length} file(s)</span>
            </header>
            <div className="document-list">
              {item.documents.length ? item.documents.map((document) => (
                <div className="document-row" key={document._id}>
                  <span className="row-icon"><FiFileText /></span>
                  <div><strong>{document.originalName}</strong><small>{(document.size / 1024 / 1024).toFixed(2)} MB · {formatDate(document.createdAt)}</small></div>
                  <button className="btn btn-sm btn-outline-dark" disabled={working === document._id} onClick={() => download(document)}><FiDownload /> Download</button>
                </div>
              )) : <p className="panel-empty">No documents have been uploaded.</p>}
            </div>
          </article>

          {review && (
            <article className="panel">
              <span className="eyebrow">Verified review</span>
              <h2>Your case review</h2>
              <div className="submitted-review"><span><FiStar /> {review.rating}/5</span><p>{review.comment || "No written comment."}</p></div>
            </article>
          )}
        </div>

        <aside className="case-side-column">
          <article className="panel participant-card">
            <span className="eyebrow">{user.role === "client" ? "Your lawyer" : "Client"}</span>
            <Avatar user={counterpart} size="xl" />
            <h3>{counterpart?.name}</h3>
            <p>{counterpart?.lawyerProfile?.specialization || counterpart?.email}</p>
            {item.chatAvailable ? (
              <button className="btn btn-outline-dark w-100" onClick={openConversation}><FiMessageCircle /> Open shared conversation</button>
            ) : (
              <p className="panel-empty">Messaging unlocks after the lawyer confirms an appointment.</p>
            )}
          </article>

          <article className="panel">
            <span className="eyebrow">Status history</span>
            <h2>Timeline</h2>
            <ol className="timeline">
              {[...item.timeline].reverse().map((entry) => (
                <li key={entry._id}>
                  <span />
                  <div><strong>{titleCase(entry.status)}</strong><small>{entry.actor?.name || "System"} · {formatDate(entry.at)}</small>{entry.note && <p>{entry.note}</p>}</div>
                </li>
              ))}
            </ol>
          </article>
        </aside>
      </section>

      <Modal open={documentsOpen} title="Add protected documents" onClose={() => setDocumentsOpen(false)}>
        <form className="form-stack" onSubmit={addDocuments}>
          <label>Select files
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" multiple required onChange={(event) => setFiles(event.target.files)} />
            <small>PDF, JPG or PNG. Up to five files, 10 MB each.</small>
          </label>
          <button className="btn btn-brand" disabled={working === "documents"}>{working === "documents" ? <Loader label="Uploading…" /> : "Upload documents"}</button>
        </form>
      </Modal>

      <Modal open={reviewOpen} title={`Review ${item.lawyer?.name}`} onClose={() => setReviewOpen(false)}>
        <form className="form-stack" onSubmit={submitReview}>
          <label>Rating
            <select value={reviewForm.rating} onChange={(event) => setReviewForm({ ...reviewForm, rating: event.target.value })}>
              {[5, 4, 3, 2, 1].map((rating) => <option value={rating} key={rating}>{rating} star{rating === 1 ? "" : "s"}</option>)}
            </select>
          </label>
          <label>Comment<textarea maxLength="2000" rows="5" value={reviewForm.comment} onChange={(event) => setReviewForm({ ...reviewForm, comment: event.target.value })} /></label>
          <button className="btn btn-gold" disabled={working === "review"}>{working === "review" ? <Loader label="Submitting…" /> : "Submit verified review"}</button>
        </form>
      </Modal>
    </>
  );
}
