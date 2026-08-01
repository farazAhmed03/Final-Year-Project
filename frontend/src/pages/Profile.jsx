import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiLock, FiSave, FiUser } from "react-icons/fi";
import { toast } from "react-toastify";
import api, { apiErrorMessage } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { Avatar, Loader, PageHeader, StatusBadge } from "../components/UI";

export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    name: user.name || "",
    phone: user.phone || "",
    city: user.city || "",
    avatarUrl: user.avatarUrl || "",
    bio: user.lawyerProfile?.bio || "",
    specialization: user.lawyerProfile?.specialization || "",
    experienceYears: user.lawyerProfile?.experienceYears || 0,
    hourlyRate: user.lawyerProfile?.hourlyRate || 0
  });
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [busy, setBusy] = useState("");

  const updateProfile = async (event) => {
    event.preventDefault();
    setBusy("profile");
    try {
      const payload = {
        name: profile.name,
        phone: profile.phone,
        city: profile.city,
        avatarUrl: profile.avatarUrl
      };
      if (user.role === "lawyer") {
        Object.assign(payload, {
          bio: profile.bio,
          specialization: profile.specialization,
          experienceYears: Number(profile.experienceYears),
          hourlyRate: Number(profile.hourlyRate)
        });
      }
      const response = await api.patch("/auth/profile", payload);
      updateUser(response.data.data.user);
      toast.success("Profile updated.");
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setBusy("");
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    if (passwords.newPassword !== passwords.confirm) {
      toast.error("New passwords do not match.");
      return;
    }
    setBusy("password");
    try {
      await api.post("/auth/change-password", {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword
      });
      toast.success("Password changed. Sign in again.");
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <PageHeader eyebrow="Account settings" title="Profile" description="Keep contact and professional details current." />

      <section className="profile-settings-grid">
        <article className="panel profile-summary">
          <Avatar user={{ ...user, avatarUrl: profile.avatarUrl, name: profile.name }} size="xxl" />
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <div className="profile-badges">
            <StatusBadge value={user.status} />
            <StatusBadge value={user.emailVerified ? "verified" : "unverified"} />
            {user.role === "lawyer" && <StatusBadge value={user.lawyerProfile?.verificationStatus || "pending"} />}
          </div>
          <small>Your email address and account role can only be changed through an administrator-controlled process.</small>
        </article>

        <article className="panel">
          <header className="panel-header"><div><span className="eyebrow">Personal details</span><h2>Edit profile</h2></div><FiUser /></header>
          <form className="form-stack" onSubmit={updateProfile}>
            <div className="form-grid-two">
              <label>Full name<input required minLength="2" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label>
              <label>City<input value={profile.city} onChange={(event) => setProfile({ ...profile, city: event.target.value })} /></label>
            </div>
            <label>Phone<input value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></label>
            <label>Avatar URL<input type="url" value={profile.avatarUrl} onChange={(event) => setProfile({ ...profile, avatarUrl: event.target.value })} /></label>
            {user.role === "lawyer" && (
              <>
                <div className="form-grid-two">
                  <label>Specialization<input value={profile.specialization} onChange={(event) => setProfile({ ...profile, specialization: event.target.value })} /></label>
                  <label>Experience (years)<input type="number" min="0" max="80" value={profile.experienceYears} onChange={(event) => setProfile({ ...profile, experienceYears: event.target.value })} /></label>
                </div>
                <label>Hourly rate (USD)<input type="number" min="0" step="0.01" value={profile.hourlyRate} onChange={(event) => setProfile({ ...profile, hourlyRate: event.target.value })} /></label>
                <label>Professional biography<textarea rows="6" maxLength="3000" value={profile.bio} onChange={(event) => setProfile({ ...profile, bio: event.target.value })} /></label>
              </>
            )}
            <button className="btn btn-brand" disabled={busy === "profile"}><FiSave /> {busy === "profile" ? <Loader label="Saving…" /> : "Save profile"}</button>
          </form>
        </article>

        {user.authProvider === "local" && (
          <article className="panel password-panel">
            <header className="panel-header"><div><span className="eyebrow">Security</span><h2>Change password</h2></div><FiLock /></header>
            <p>Every active refresh session is revoked after a password change.</p>
            <form className="form-stack" onSubmit={changePassword}>
              <label>Current password<input type="password" autoComplete="current-password" required value={passwords.currentPassword} onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })} /></label>
              <div className="form-grid-two">
                <label>New password<input type="password" autoComplete="new-password" minLength="10" required value={passwords.newPassword} onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })} /></label>
                <label>Confirm new password<input type="password" autoComplete="new-password" required value={passwords.confirm} onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })} /></label>
              </div>
              <button className="btn btn-outline-dark" disabled={busy === "password"}>{busy === "password" ? <Loader label="Updating…" /> : "Change password"}</button>
            </form>
          </article>
        )}
      </section>
    </>
  );
}
