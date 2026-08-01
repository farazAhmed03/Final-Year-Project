const ROLES = Object.freeze({
  CLIENT: "client",
  LAWYER: "lawyer",
  ADMIN: "admin"
});

const USER_STATUS = Object.freeze({
  ACTIVE: "active",
  SUSPENDED: "suspended"
});

const LAWYER_VERIFICATION = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected"
});

const APPOINTMENT_STATUS = Object.freeze({
  REQUESTED: "requested",
  CONFIRMED: "confirmed",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
  COMPLETED: "completed"
});

const CASE_STATUS = Object.freeze({
  SUBMITTED: "submitted",
  ACCEPTED: "accepted",
  IN_PROGRESS: "in_progress",
  CLOSED: "closed",
  REJECTED: "rejected"
});

module.exports = {
  ROLES,
  USER_STATUS,
  LAWYER_VERIFICATION,
  APPOINTMENT_STATUS,
  CASE_STATUS
};
