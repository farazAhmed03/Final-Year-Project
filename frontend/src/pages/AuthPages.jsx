import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FiArrowLeft, FiCheckCircle, FiLock, FiMail, FiUser } from "react-icons/fi";
import { toast } from "react-toastify";
import PublicNav from "../components/PublicNav";
import api, { apiErrorMessage } from "../api/client";
import { getGoogleIdToken, googleEnabled } from "../api/firebase";
import { useAuth } from "../contexts/AuthContext";
import { roleHome } from "../utils/roles";
import { Loader } from "../components/UI";

function AuthFrame({ title, subtitle, children, sideTitle, sideText }) {
  return (
    <div className="auth-page">
      <PublicNav />
      <main className="auth-main container-xl">
        <section className="auth-side">
          <span className="eyebrow light">LegalSphere secure access</span>
          <h1>{sideTitle || "Your legal workspace, protected."}</h1>
          <p>{sideText || "Manage appointments, cases, documents and communication from one account."}</p>
          <ul>
            <li><FiCheckCircle /> HttpOnly session cookies</li>
            <li><FiCheckCircle /> Role and ownership checks</li>
            <li><FiCheckCircle /> Private document downloads</li>
          </ul>
        </section>
        <section className="auth-card">
          <Link className="back-link" to="/"><FiArrowLeft /> Back home</Link>
          <h2>{title}</h2>
          <p className="auth-subtitle">{subtitle}</p>
          {children}
        </section>
      </main>
    </div>
  );
}

export function Login() {
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const role = params.get("role") === "lawyer" ? "lawyer" : "client";

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const user = await login(form);
      toast.success(`Welcome back, ${user.name}.`);
      navigate(location.state?.from || roleHome(user.role), { replace: true });
    } catch (error) {
      toast.error(apiErrorMessage(error, "Unable to sign in."));
    } finally {
      setBusy(false);
    }
  };

  const signInGoogle = async () => {
    setBusy(true);
    try {
      const token = await getGoogleIdToken();
      const user = await googleLogin(token, role);
      toast.success(`Welcome, ${user.name}.`);
      navigate(roleHome(user.role), { replace: true });
    } catch (error) {
      toast.error(apiErrorMessage(error, error.message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame title="Welcome back" subtitle="Sign in with your verified LegalSphere account.">
      <form className="form-stack" onSubmit={submit}>
        <label>
          Email address
          <span className="input-wrap"><FiMail /><input type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></span>
        </label>
        <label>
          Password
          <span className="input-wrap"><FiLock /><input type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></span>
        </label>
        <div className="form-row-between">
          <span />
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        <button className="btn btn-brand btn-lg w-100" disabled={busy}>
          {busy ? <Loader label="Signing in…" /> : "Sign in"}
        </button>
      </form>
      {googleEnabled && (
        <>
          <div className="divider"><span>or</span></div>
          <button className="btn btn-google w-100" onClick={signInGoogle} disabled={busy}>Continue with Google</button>
        </>
      )}
      <p className="auth-switch">New to LegalSphere? <Link to="/register">Create an account</Link></p>
    </AuthFrame>
  );
}

export function Register() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const initialRole = params.get("role") === "lawyer" ? "lawyer" : "client";
  const [form, setForm] = useState({
    role: initialRole,
    name: "",
    email: "",
    password: "",
    phone: "",
    city: "",
    licenseNumber: "",
    specialization: "",
    experienceYears: 0
  });
  const [busy, setBusy] = useState(false);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, experienceYears: Number(form.experienceYears || 0) };
      if (form.role === "client") {
        delete payload.licenseNumber;
        delete payload.specialization;
        delete payload.experienceYears;
      }
      const response = await api.post("/auth/register", payload);
      toast.success(response.data.data.message);
      navigate(`/verify-email?email=${encodeURIComponent(form.email)}`);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Unable to create account."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame
      title="Create your account"
      subtitle="Choose the correct account type. Administrator accounts cannot be created publicly."
      sideTitle={form.role === "lawyer" ? "Build a trusted professional profile." : "Keep every legal step in one place."}
    >
      <div className="role-toggle" role="group" aria-label="Account type">
        <button type="button" className={form.role === "client" ? "active" : ""} onClick={() => setForm({ ...form, role: "client" })}>Client</button>
        <button type="button" className={form.role === "lawyer" ? "active" : ""} onClick={() => setForm({ ...form, role: "lawyer" })}>Lawyer</button>
      </div>
      <form className="form-stack" onSubmit={submit}>
        <div className="form-grid-two">
          <label>Full name<span className="input-wrap"><FiUser /><input required minLength="2" value={form.name} onChange={set("name")} /></span></label>
          <label>City<span className="input-wrap"><input value={form.city} onChange={set("city")} /></span></label>
        </div>
        <label>Email address<span className="input-wrap"><FiMail /><input type="email" autoComplete="email" required value={form.email} onChange={set("email")} /></span></label>
        <label>Strong password<span className="input-wrap"><FiLock /><input type="password" autoComplete="new-password" required minLength="10" value={form.password} onChange={set("password")} /></span><small>At least 10 characters with uppercase, lowercase and a number.</small></label>
        <label>Phone<span className="input-wrap"><input value={form.phone} onChange={set("phone")} /></span></label>
        {form.role === "lawyer" && (
          <div className="lawyer-fields">
            <label>License number<span className="input-wrap"><input required value={form.licenseNumber} onChange={set("licenseNumber")} /></span></label>
            <div className="form-grid-two">
              <label>Specialization<span className="input-wrap"><input required value={form.specialization} onChange={set("specialization")} /></span></label>
              <label>Years of experience<span className="input-wrap"><input type="number" min="0" max="80" value={form.experienceYears} onChange={set("experienceYears")} /></span></label>
            </div>
            <p className="form-note">Your public listing remains hidden until an administrator approves the professional details.</p>
          </div>
        )}
        <button className="btn btn-brand btn-lg w-100" disabled={busy}>{busy ? <Loader label="Creating account…" /> : "Create account"}</button>
      </form>
      <p className="auth-switch">Already registered? <Link to="/login">Sign in</Link></p>
    </AuthFrame>
  );
}

export function VerifyEmail() {
  const { verifyEmail } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const initialToken = params.get("token") || "";
  const email = params.get("email") || "";
  const [token, setToken] = useState(initialToken);
  const [state, setState] = useState(initialToken ? "verifying" : "idle");
  const attempted = useRef(false);

  const verify = useCallback(async (value) => {
    if (!value) return;
    setState("verifying");
    try {
      const user = await verifyEmail(value);
      setState("success");
      toast.success("Email verified.");
      navigate(roleHome(user.role), { replace: true });
    } catch (error) {
      setState("error");
      toast.error(apiErrorMessage(error, "Verification failed."));
    }
  }, [navigate, verifyEmail]);

  useEffect(() => {
    if (initialToken && !attempted.current) {
      attempted.current = true;
      verify(initialToken);
    }
  }, [initialToken, verify]);

  const resend = async () => {
    if (!email) return toast.error("Enter your email by returning to registration.");
    try {
      await api.post("/auth/resend-verification", { email });
      toast.success("A new verification email has been sent.");
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  };

  return (
    <AuthFrame title="Verify your email" subtitle="Open the link in your email, or paste the verification token below.">
      {state === "success" ? (
        <div className="success-panel"><FiCheckCircle /><h3>Email verified</h3></div>
      ) : (
        <form className="form-stack" onSubmit={(event) => { event.preventDefault(); verify(token); }}>
          <label>Verification token<span className="input-wrap"><FiMail /><input value={token} onChange={(e) => setToken(e.target.value)} required /></span></label>
          <button className="btn btn-brand btn-lg w-100" disabled={state === "verifying"}>
            {state === "verifying" ? <Loader label="Verifying…" /> : "Verify email"}
          </button>
          <button className="btn btn-link" type="button" onClick={resend}>Resend verification email</button>
        </form>
      )}
    </AuthFrame>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame title="Reset your password" subtitle="For privacy, the response is identical whether or not an account exists.">
      {sent ? (
        <div className="success-panel"><FiCheckCircle /><h3>Check your inbox</h3><p>Use the password reset link if an account matches this email.</p></div>
      ) : (
        <form className="form-stack" onSubmit={submit}>
          <label>Email address<span className="input-wrap"><FiMail /><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></span></label>
          <button className="btn btn-brand btn-lg w-100" disabled={busy}>{busy ? <Loader label="Sending…" /> : "Send reset link"}</button>
        </form>
      )}
    </AuthFrame>
  );
}

export function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const mismatch = useMemo(() => form.confirm && form.password !== form.confirm, [form]);

  const submit = async (event) => {
    event.preventDefault();
    if (mismatch) return;
    setBusy(true);
    try {
      await api.post("/auth/reset-password", { token, password: form.password });
      toast.success("Password changed. Sign in with the new password.");
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame title="Choose a new password" subtitle="Changing your password signs out every existing session.">
      <form className="form-stack" onSubmit={submit}>
        <label>New password<span className="input-wrap"><FiLock /><input type="password" required minLength="10" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></span></label>
        <label>Confirm password<span className="input-wrap"><FiLock /><input type="password" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} /></span></label>
        {mismatch && <p className="field-error">Passwords do not match.</p>}
        <button className="btn btn-brand btn-lg w-100" disabled={busy || mismatch}>{busy ? <Loader label="Updating…" /> : "Update password"}</button>
      </form>
    </AuthFrame>
  );
}
