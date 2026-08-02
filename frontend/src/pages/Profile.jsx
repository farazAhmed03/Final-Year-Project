import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiCamera, FiEye, FiLock, FiSave, FiUpload, FiUser } from "react-icons/fi";
import { toast } from "react-toastify";
import api, { apiErrorMessage } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import {
  Avatar,
  Loader,
  Modal,
  PageHeader,
  StatusBadge,
  resolveMediaUrl
} from "../components/UI";
import "./Profile.css";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png"];

function profileFromUser(user) {
  return {
    name: user.name || "",
    phone: user.phone || "",
    city: user.city || "",
    avatarUrl: user.avatarUrl || "",
    bio: user.lawyerProfile?.bio || "",
    specialization: user.lawyerProfile?.specialization || "",
    experienceYears: user.lawyerProfile?.experienceYears || 0,
    hourlyRate: user.lawyerProfile?.hourlyRate || 0
  };
}

export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const avatarInputRef = useRef(null);

  const [profile, setProfile] = useState(() => profileFromUser(user));
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirm: ""
  });
  const [busy, setBusy] = useState("");
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const [avatarAvailable, setAvatarAvailable] = useState(Boolean(user.avatarUrl));

  useEffect(() => {
    setProfile(profileFromUser(user));
    setAvatarAvailable(Boolean(user.avatarUrl));
  }, [user]);

  const chooseAvatar = () => {
    if (busy !== "avatar") avatarInputRef.current?.click();
  };

  const handleAvatarClick = () => {
    if (profile.avatarUrl && avatarAvailable) {
      setAvatarPreviewOpen(true);
      return;
    }

    chooseAvatar();
  };

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      toast.error("Please select a JPG or PNG image.");
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Profile image must be 2 MB or smaller.");
      return;
    }

    const previousAvatarUrl = profile.avatarUrl;
    const previousAvatarAvailable = avatarAvailable;
    const temporaryPreviewUrl = URL.createObjectURL(file);

    setBusy("avatar");
    setAvatarAvailable(true);
    setProfile((current) => ({
      ...current,
      avatarUrl: temporaryPreviewUrl
    }));

    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const response = await api.post("/auth/profile/avatar", formData);
      const updatedUser = response.data.data.user;

      updateUser(updatedUser);
      setProfile(profileFromUser(updatedUser));
      setAvatarAvailable(Boolean(updatedUser.avatarUrl));
      toast.success("Profile picture updated.");
    } catch (error) {
      setProfile((current) => ({
        ...current,
        avatarUrl: previousAvatarUrl
      }));
      setAvatarAvailable(previousAvatarAvailable);
      toast.error(apiErrorMessage(error));
    } finally {
      URL.revokeObjectURL(temporaryPreviewUrl);
      setBusy("");
    }
  };

  const updateProfile = async (event) => {
    event.preventDefault();
    setBusy("profile");

    try {
      const payload = {
        name: profile.name,
        phone: profile.phone,
        city: profile.city
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
      const updatedUser = response.data.data.user;

      updateUser(updatedUser);
      setProfile(profileFromUser(updatedUser));
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
      <PageHeader
        eyebrow="Account settings"
        title="Profile"
        description="Keep contact and professional details current."
      />

      <section className="profile-settings-grid">
        <article className="panel profile-summary">
          <div className="profile-avatar-stage">
            <button
              type="button"
              className="profile-avatar-preview-button"
              onClick={handleAvatarClick}
              disabled={busy === "avatar"}
              aria-label={
                avatarAvailable
                  ? "Open full profile picture"
                  : "Choose a profile picture"
              }
            >
              <Avatar
                user={{
                  ...user,
                  avatarUrl: profile.avatarUrl,
                  name: profile.name
                }}
                size="xxl"
                onLoad={() => setAvatarAvailable(true)}
                onError={() => setAvatarAvailable(false)}
              />

              <span className="profile-avatar-view-hint" aria-hidden="true">
                <FiEye />
                <span>{avatarAvailable ? "View photo" : "Add photo"}</span>
              </span>
            </button>

            <button
              type="button"
              className="profile-avatar-upload-button"
              onClick={chooseAvatar}
              disabled={busy === "avatar"}
              aria-label="Upload a new profile picture"
              title="Upload a new profile picture"
            >
              {busy === "avatar" ? <Loader label="" /> : <FiCamera />}
            </button>
          </div>

          <input
            ref={avatarInputRef}
            className="profile-avatar-input"
            type="file"
            accept="image/jpeg,image/png"
            onChange={uploadAvatar}
          />

          <button
            type="button"
            className="profile-avatar-upload-text"
            onClick={chooseAvatar}
            disabled={busy === "avatar"}
          >
            <FiUpload />
            {busy === "avatar" ? "Uploading…" : "Upload profile picture"}
          </button>

          <small className="profile-avatar-help">JPG or PNG, maximum 2 MB.</small>

          <h2>{profile.name}</h2>
          <p>{user.email}</p>

          <div className="profile-badges">
            <StatusBadge value={user.status} />
            <StatusBadge value={user.emailVerified ? "verified" : "unverified"} />
            {user.role === "lawyer" && (
              <StatusBadge
                value={user.lawyerProfile?.verificationStatus || "pending"}
              />
            )}
          </div>

          <small className="profile-account-note">
            Your email address and account role can only be changed through an
            administrator-controlled process.
          </small>
        </article>

        <article className="panel profile-details-panel">
          <header className="panel-header">
            <div>
              <span className="eyebrow">Personal details</span>
              <h2>Edit profile</h2>
            </div>
            <FiUser />
          </header>

          <form className="form-stack" onSubmit={updateProfile}>
            <div className="form-grid-two">
              <label>
                Full name
                <input
                  required
                  minLength="2"
                  value={profile.name}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      name: event.target.value
                    }))
                  }
                />
              </label>

              <label>
                City
                <input
                  value={profile.city}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      city: event.target.value
                    }))
                  }
                />
              </label>
            </div>

            <label>
              Phone
              <input
                value={profile.phone}
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    phone: event.target.value
                  }))
                }
              />
            </label>

            {user.role === "lawyer" && (
              <>
                <div className="form-grid-two">
                  <label>
                    Specialization
                    <input
                      value={profile.specialization}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          specialization: event.target.value
                        }))
                      }
                    />
                  </label>

                  <label>
                    Experience (years)
                    <input
                      type="number"
                      min="0"
                      max="80"
                      value={profile.experienceYears}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          experienceYears: event.target.value
                        }))
                      }
                    />
                  </label>
                </div>

                <label>
                  Hourly rate (USD)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={profile.hourlyRate}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        hourlyRate: event.target.value
                      }))
                    }
                  />
                </label>

                <label>
                  Professional biography
                  <textarea
                    rows="6"
                    maxLength="3000"
                    value={profile.bio}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        bio: event.target.value
                      }))
                    }
                  />
                </label>
              </>
            )}

            <button
              className="btn btn-brand"
              disabled={busy === "profile" || busy === "avatar"}
            >
              <FiSave />
              {busy === "profile" ? <Loader label="Saving…" /> : "Save profile"}
            </button>
          </form>
        </article>

        {user.authProvider === "local" && (
          <article className="panel password-panel">
            <header className="panel-header">
              <div>
                <span className="eyebrow">Security</span>
                <h2>Change password</h2>
              </div>
              <FiLock />
            </header>

            <p>Every active refresh session is revoked after a password change.</p>

            <form className="form-stack" onSubmit={changePassword}>
              <label>
                Current password
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={passwords.currentPassword}
                  onChange={(event) =>
                    setPasswords((current) => ({
                      ...current,
                      currentPassword: event.target.value
                    }))
                  }
                />
              </label>

              <div className="form-grid-two">
                <label>
                  New password
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength="10"
                    required
                    value={passwords.newPassword}
                    onChange={(event) =>
                      setPasswords((current) => ({
                        ...current,
                        newPassword: event.target.value
                      }))
                    }
                  />
                </label>

                <label>
                  Confirm new password
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    value={passwords.confirm}
                    onChange={(event) =>
                      setPasswords((current) => ({
                        ...current,
                        confirm: event.target.value
                      }))
                    }
                  />
                </label>
              </div>

              <button
                className="btn btn-outline-dark"
                disabled={busy === "password" || busy === "avatar"}
              >
                {busy === "password" ? (
                  <Loader label="Updating…" />
                ) : (
                  "Change password"
                )}
              </button>
            </form>
          </article>
        )}
      </section>

      <Modal
        open={avatarPreviewOpen}
        title={`${profile.name || "User"}'s profile picture`}
        onClose={() => setAvatarPreviewOpen(false)}
        className="avatar-preview-modal"
      >
        <div className="avatar-preview-content">
          {avatarAvailable && profile.avatarUrl ? (
            <img
              src={resolveMediaUrl(profile.avatarUrl)}
              alt={`${profile.name || "User"} full profile`}
              onError={() => {
                setAvatarAvailable(false);
                setAvatarPreviewOpen(false);
              }}
            />
          ) : (
            <Avatar user={{ ...user, name: profile.name, avatarUrl: "" }} size="xxl" />
          )}
        </div>
      </Modal>
    </>
  );
}
