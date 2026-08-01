import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FiCheckCircle, FiCreditCard, FiXCircle } from "react-icons/fi";
import api, { apiErrorMessage } from "../api/client";
import { Loader } from "../components/UI";
import { formatMoney, titleCase } from "../utils/format";

export function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionId) {
      setError("Payment session ID is missing.");
      return;
    }
    let cancelled = false;
    let attempts = 0;
    const check = async () => {
      try {
        const response = await api.get(`/payments/session/${encodeURIComponent(sessionId)}`);
        if (cancelled) return;
        const result = response.data.data.payment;
        setPayment(result);
        if (result.status === "pending" && attempts < 5) {
          attempts += 1;
          window.setTimeout(check, 1500);
        }
      } catch (requestError) {
        if (!cancelled) setError(apiErrorMessage(requestError));
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <div className="result-page">
      <section className="result-card">
        {!payment && !error ? <Loader label="Confirming payment with the server…" /> : error ? (
          <><FiXCircle className="result-icon error" /><h1>Unable to confirm payment</h1><p>{error}</p></>
        ) : (
          <>
            <FiCheckCircle className={`result-icon ${payment.status === "paid" ? "success" : ""}`} />
            <span className="eyebrow">Stripe checkout</span>
            <h1>{payment.status === "paid" ? "Payment confirmed" : "Payment is processing"}</h1>
            <p>The browser redirect did not mark this payment paid. Confirmation comes from Stripe’s signed webhook.</p>
            <dl className="profile-facts">
              <div><dt>Amount</dt><dd>{formatMoney(payment.amount, payment.currency)}</dd></div>
              <div><dt>Status</dt><dd>{titleCase(payment.status)}</dd></div>
            </dl>
          </>
        )}
        <Link className="btn btn-brand" to="/app/appointments">Back to appointments</Link>
      </section>
    </div>
  );
}

export function PaymentCancel() {
  return (
    <div className="result-page">
      <section className="result-card">
        <FiCreditCard className="result-icon" />
        <span className="eyebrow">Checkout cancelled</span>
        <h1>No payment was completed</h1>
        <p>Your appointment remains in its previous payment state. You may start checkout again from the appointment page.</p>
        <Link className="btn btn-brand" to="/app/appointments">Back to appointments</Link>
      </section>
    </div>
  );
}
