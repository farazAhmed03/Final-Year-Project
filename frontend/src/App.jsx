import React from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import { AuthProvider } from "./contexts/AuthContext";
import { SocketProvider } from "./contexts/SocketContext";
import { GuestRoute, ProtectedRoute } from "./components/RouteGuards";
import AppShell from "./components/AppShell";
import { Home, About } from "./pages/Home";
import { Login, Register, VerifyEmail, ForgotPassword, ResetPassword } from "./pages/AuthPages";
import { LawyerDirectory, LawyerProfile } from "./pages/Lawyers";
import Dashboard from "./pages/Dashboard";
import Appointments from "./pages/Appointments";
import { Cases } from "./pages/Cases";
import CaseDetail from "./pages/CaseDetail";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import Notifications from "./pages/Notifications";
import { AdminLawyers, AdminUsers } from "./pages/Admin";
import { PaymentCancel, PaymentSuccess } from "./pages/PaymentResult";
import NotFound from "./pages/NotFound";
import MotionEffects from "./components/MotionEffects";
import {
  LegacyCaseDetail,
  LegacyChat,
  LegacyLawyerProfile,
  LegacyRedirect
} from "./components/LegacyRedirect";

function LegacyAppointment() {
  const { lawyerId } = useParams();
  return <Navigate to={`/lawyers/${lawyerId}`} replace />;
}

function LegacyReview() {
  const { caseId } = useParams();
  return <Navigate to={`/app/cases/${caseId}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <MotionEffects />
          <ToastContainer position="top-right" autoClose={3500} limit={4} newestOnTop />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/lawyers" element={<LawyerDirectory />} />
            <Route path="/lawyers/:id" element={<LawyerProfile />} />

            <Route element={<GuestRoute />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />
            </Route>
            <Route path="/verify-email" element={<VerifyEmail />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route path="/app/dashboard" element={<Dashboard />} />
                <Route path="/app/appointments" element={<Appointments />} />
                <Route path="/app/cases" element={<Cases />} />
                <Route path="/app/cases/:id" element={<CaseDetail />} />
                <Route path="/app/chat" element={<Chat />} />
                <Route path="/app/chat/:conversationId" element={<Chat />} />
                <Route path="/app/profile" element={<Profile />} />
                <Route path="/app/notifications" element={<Notifications />} />

                <Route element={<ProtectedRoute roles={["admin"]} />}>
                  <Route path="/app/admin/users" element={<AdminUsers />} />
                  <Route path="/app/admin/lawyers" element={<AdminLawyers />} />
                </Route>
              </Route>
              <Route path="/payment/success" element={<PaymentSuccess />} />
              <Route path="/payment/cancel" element={<PaymentCancel />} />
            </Route>

            <Route path="/lawyerprofile/:id" element={<LegacyLawyerProfile />} />
            <Route path="/chat/:id" element={<LegacyChat />} />
            <Route path="/lawyerdashboard/case-details/:id" element={<LegacyCaseDetail />} />
            <Route path="/appointment/:lawyerId" element={<LegacyAppointment />} />
            <Route path="/review/:lawyerId/:caseId" element={<LegacyReview />} />
            <Route path="/applycase/:appointmentId" element={<Navigate to="/app/cases" replace />} />

            {[
              "/main",
              "/createaccount",
              "/lawyercreateanaccount",
              "/lawyerlogin",
              "/forgotpassword",
              "/lawyerforgotpasswords",
              "/verification",
              "/sendotp",
              "/aboutus",
              "/dashboard",
              "/dashboard/myappointments",
              "/dashboard/mycase",
              "/dashboard/myprofile",
              "/dashboard/seelawyer",
              "/dashboard/payment",
              "/lawyerdashboard",
              "/lawyerdashboard/myappointments",
              "/lawyerdashboard/lawyercase",
              "/lawyerdashboard/lawyerprofilem",
              "/chat"
            ].map((path) => <Route key={path} path={path} element={<LegacyRedirect />} />)}

            <Route path="*" element={<NotFound />} />
          </Routes>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
