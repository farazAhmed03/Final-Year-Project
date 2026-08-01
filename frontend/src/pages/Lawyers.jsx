import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  FiArrowLeft,
  FiBriefcase,
  FiCalendar,
  FiMapPin,
  FiMessageCircle,
  FiSearch,
  FiStar
} from "react-icons/fi";
import { toast } from "react-toastify";
import PublicNav from "../components/PublicNav";
import { useAuth } from "../contexts/AuthContext";
import api, { apiErrorMessage } from "../api/client";
import { Avatar, EmptyState, ErrorState, Loader, Modal } from "../components/UI";
import { formatDate, formatMoney } from "../utils/format";

function LawyerCard({ lawyer }) {
  return (
    <article className="lawyer-card">
      <div className="lawyer-card-top">
        <Avatar user={lawyer} size="xl" />
        <span className="verified-chip">Approved</span>
      </div>
      <div className="lawyer-card-body">
        <h3>{lawyer.name}</h3>
        <strong>{lawyer.lawyerProfile?.specialization || "Legal practitioner"}</strong>
        <div className="lawyer-meta">
          <span><FiMapPin /> {lawyer.city || "Location not set"}</span>
          <span><FiBriefcase /> {lawyer.lawyerProfile?.experienceYears || 0} years</span>
        </div>
        <div className="rating-line">
          <FiStar />
          <strong>{lawyer.averageRating || "New"}</strong>
          <span>({lawyer.reviewCount || 0} reviews)</span>
        </div>
      </div>
      <div className="lawyer-card-footer">
        <div><small>Consultation rate</small><strong>{formatMoney(lawyer.lawyerProfile?.hourlyRate || 0)}/hr</strong></div>
        <Link className="btn btn-brand" to={`/lawyers/${lawyer._id}`}>View profile</Link>
      </div>
    </article>
  );
}

export function LawyerDirectory() {
  const [filters, setFilters] = useState({ search: "", specialization: "", city: "" });
  const [query, setQuery] = useState(filters);
  const [data, setData] = useState(null);
  const [specializations, setSpecializations] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await api.get("/lawyers", { params: { ...query, page: 1, limit: 24 } });
      setData(response.data.data);
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.get("/lawyers/specializations")
      .then((response) => setSpecializations(response.data.data.items))
      .catch(() => setSpecializations([]));
  }, []);

  const search = (event) => {
    event.preventDefault();
    setQuery(filters);
  };

  return (
    <div className="marketing-page directory-page">
      <PublicNav />
      <main>
        <section className="directory-hero">
          <div className="container-xl">
            <span className="eyebrow light">Approved professionals</span>
            <h1>Find the right lawyer for your matter.</h1>
            <p>Every public profile has passed the platform’s administrative approval workflow.</p>
            <form className="lawyer-search" onSubmit={search}>
              <label><FiSearch /><input aria-label="Search lawyers" placeholder="Name, specialty or keyword" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label>
              <select aria-label="Specialization" value={filters.specialization} onChange={(event) => setFilters({ ...filters, specialization: event.target.value })}>
                <option value="">All specialties</option>
                {specializations.map((item) => <option key={item}>{item}</option>)}
              </select>
              <input aria-label="City" placeholder="City" value={filters.city} onChange={(event) => setFilters({ ...filters, city: event.target.value })} />
              <button className="btn btn-gold">Search</button>
            </form>
          </div>
        </section>

        <section className="section container-xl">
          <div className="results-heading">
            <div><span className="eyebrow">Directory</span><h2>{data?.pagination.total || 0} approved lawyers</h2></div>
          </div>
          {error && <ErrorState message={error} onRetry={load} />}
          {!data && !error ? <Loader label="Finding lawyers…" /> : data?.items.length ? (
            <div className="lawyer-grid">{data.items.map((lawyer) => <LawyerCard lawyer={lawyer} key={lawyer._id} />)}</div>
          ) : (
            <EmptyState title="No lawyers matched" description="Try removing a filter or searching another city." />
          )}
        </section>
      </main>
    </div>
  );
}

export function LawyerProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lawyer, setLawyer] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState("");
  const [bookingOpen, setBookingOpen] = useState(false);
  const [booking, setBooking] = useState({
    startsAt: "",
    durationMinutes: 60,
    mode: "online",
    reason: ""
  });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [profileResponse, reviewResponse] = await Promise.all([
        api.get(`/lawyers/${id}`),
        api.get(`/reviews/lawyers/${id}`, { params: { limit: 10 } })
      ]);
      setLawyer(profileResponse.data.data.lawyer);
      setReviews(reviewResponse.data.data.items);
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const book = async (event) => {
    event.preventDefault();
    if (!user) {
      navigate("/login", { state: { from: `/lawyers/${id}` } });
      return;
    }
    setBusy(true);
    try {
      await api.post("/appointments", {
        lawyerId: id,
        startsAt: new Date(booking.startsAt).toISOString(),
        durationMinutes: Number(booking.durationMinutes),
        mode: booking.mode,
        reason: booking.reason
      });
      toast.success("Appointment request sent.");
      setBookingOpen(false);
      navigate("/app/appointments");
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const message = async () => {
    if (!user) return navigate("/login", { state: { from: `/lawyers/${id}` } });
    try {
      const response = await api.post("/conversations", { userId: id });
      navigate(`/app/chat/${response.data.data.conversation._id}`);
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError));
    }
  };

  return (
    <div className="marketing-page profile-public">
      <PublicNav />
      <main className="section container-xl">
        <Link className="back-link" to="/lawyers"><FiArrowLeft /> Back to lawyers</Link>
        {error && <ErrorState message={error} onRetry={load} />}
        {!lawyer && !error ? <Loader label="Loading profile…" /> : lawyer && (
          <>
            <section className="profile-hero-card">
              <div className="profile-primary">
                <Avatar user={lawyer} size="xxl" />
                <div>
                  <span className="verified-chip">Approved lawyer</span>
                  <h1>{lawyer.name}</h1>
                  <strong>{lawyer.lawyerProfile?.specialization}</strong>
                  <div className="lawyer-meta">
                    <span><FiMapPin /> {lawyer.city || "Location not provided"}</span>
                    <span><FiBriefcase /> {lawyer.lawyerProfile?.experienceYears || 0} years of experience</span>
                    <span><FiStar /> {lawyer.averageRating || "New"} ({lawyer.reviewCount || 0} reviews)</span>
                  </div>
                </div>
              </div>
              <div className="profile-actions-card">
                <small>Consultation rate</small>
                <strong>{formatMoney(lawyer.lawyerProfile?.hourlyRate || 0)}/hour</strong>
                {(!user || user.role === "client") && (
                  <>
                    <button className="btn btn-brand btn-lg" onClick={() => setBookingOpen(true)}><FiCalendar /> Request appointment</button>
                    <button className="btn btn-outline-dark" onClick={message}><FiMessageCircle /> Send message</button>
                  </>
                )}
              </div>
            </section>

            <section className="profile-content-grid">
              <article className="panel prose-panel">
                <span className="eyebrow">Professional profile</span>
                <h2>About</h2>
                <p>{lawyer.lawyerProfile?.bio || "This lawyer has not added a professional biography yet."}</p>
                <dl className="profile-facts">
                  <div><dt>License</dt><dd>{lawyer.lawyerProfile?.licenseNumber || "Verified privately"}</dd></div>
                  <div><dt>Specialization</dt><dd>{lawyer.lawyerProfile?.specialization || "General practice"}</dd></div>
                  <div><dt>Member since</dt><dd>{formatDate(lawyer.createdAt, { dateOnly: true })}</dd></div>
                </dl>
              </article>
              <article className="panel">
                <span className="eyebrow">Verified feedback</span>
                <h2>Client reviews</h2>
                <div className="review-list">
                  {reviews.length ? reviews.map((review) => (
                    <div className="review-card" key={review._id}>
                      <div><Avatar user={review.client} /><div><strong>{review.client?.name}</strong><small>{formatDate(review.createdAt, { dateOnly: true })}</small></div><span className="rating-chip"><FiStar /> {review.rating}</span></div>
                      <p>{review.comment || "No written comment."}</p>
                    </div>
                  )) : <p className="panel-empty">No reviews yet.</p>}
                </div>
              </article>
            </section>
          </>
        )}
      </main>

      <Modal open={bookingOpen} title={`Request appointment with ${lawyer?.name || "lawyer"}`} onClose={() => setBookingOpen(false)}>
        <form className="form-stack" onSubmit={book}>
          <label>Date and time<input type="datetime-local" required value={booking.startsAt} onChange={(event) => setBooking({ ...booking, startsAt: event.target.value })} /></label>
          <div className="form-grid-two">
            <label>Duration<select value={booking.durationMinutes} onChange={(event) => setBooking({ ...booking, durationMinutes: event.target.value })}><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option><option value="90">90 minutes</option></select></label>
            <label>Mode<select value={booking.mode} onChange={(event) => setBooking({ ...booking, mode: event.target.value })}><option value="online">Online</option><option value="office">Office</option><option value="phone">Phone</option></select></label>
          </div>
          <label>Reason<textarea minLength="10" maxLength="2000" required rows="5" value={booking.reason} onChange={(event) => setBooking({ ...booking, reason: event.target.value })} /></label>
          <button className="btn btn-brand btn-lg" disabled={busy}>{busy ? <Loader label="Sending request…" /> : "Send request"}</button>
        </form>
      </Modal>
    </div>
  );
}
