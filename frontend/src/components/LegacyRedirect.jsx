import React from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";

const exact = {
  "/main": "/",
  "/createaccount": "/register",
  "/lawyercreateanaccount": "/register?role=lawyer",
  "/lawyerlogin": "/login?role=lawyer",
  "/forgotpassword": "/forgot-password",
  "/lawyerforgotpasswords": "/forgot-password",
  "/verification": "/verify-email",
  "/sendotp": "/verify-email",
  "/aboutus": "/about",
  "/dashboard": "/app/dashboard",
  "/dashboard/myappointments": "/app/appointments",
  "/dashboard/mycase": "/app/cases",
  "/dashboard/myprofile": "/app/profile",
  "/dashboard/seelawyer": "/lawyers",
  "/dashboard/payment": "/app/appointments",
  "/lawyerdashboard": "/app/dashboard",
  "/lawyerdashboard/myappointments": "/app/appointments",
  "/lawyerdashboard/lawyercase": "/app/cases",
  "/lawyerdashboard/lawyerprofilem": "/app/profile",
  "/chat": "/app/chat"
};

export function LegacyRedirect() {
  const location = useLocation();
  return <Navigate to={exact[location.pathname] || "/"} replace />;
}

export function LegacyLawyerProfile() {
  const { id } = useParams();
  return <Navigate to={`/lawyers/${id}`} replace />;
}

export function LegacyChat() {
  const { id } = useParams();
  return <Navigate to={`/app/chat/${id}`} replace />;
}

export function LegacyCaseDetail() {
  const { id } = useParams();
  return <Navigate to={`/app/cases/${id}`} replace />;
}
