const express = require("express");
const Joi = require("joi");
const Stripe = require("stripe");
const Appointment = require("../models/Appointment");
const Payment = require("../models/Payment");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const validate = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const { requireRole, requireVerifiedEmail } = require("../middleware/authorize");
const { createNotification } = require("../services/notificationService");
const env = require("../config/env");
const { ROLES } = require("../constants");

const router = express.Router();

function stripeClient() {
  if (!env.stripeSecretKey) {
    throw new ApiError(503, "Stripe payments are not configured", "PAYMENTS_NOT_CONFIGURED");
  }
  return new Stripe(env.stripeSecretKey);
}

router.use(authenticate, requireVerifiedEmail);

router.post(
  "/checkout",
  requireRole(ROLES.CLIENT),
  validate(Joi.object({ appointmentId: Joi.string().hex().length(24).required() })),
  asyncHandler(async (req, res) => {
    const appointment = await Appointment.findOne({
      _id: req.body.appointmentId,
      client: req.user._id,
      status: "confirmed"
    }).populate("lawyer", "name");

    if (!appointment) {
      throw new ApiError(404, "Confirmed appointment not found", "APPOINTMENT_NOT_FOUND");
    }
    if (appointment.paymentStatus === "paid") {
      throw new ApiError(409, "This appointment is already paid", "ALREADY_PAID");
    }
    if (!appointment.fee || appointment.fee <= 0) {
      throw new ApiError(400, "This appointment does not require payment", "PAYMENT_NOT_REQUIRED");
    }

    const stripe = stripeClient();
    const payment = await Payment.create({
      user: req.user._id,
      appointment: appointment._id,
      amount: appointment.fee,
      currency: env.stripeCurrency,
      status: "created"
    });

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        client_reference_id: String(req.user._id),
        customer_email: req.user.email,
        line_items: [{
          quantity: 1,
          price_data: {
            currency: env.stripeCurrency,
            unit_amount: Math.round(appointment.fee * 100),
            product_data: {
              name: `Consultation with ${appointment.lawyer.name}`,
              description: `${appointment.durationMinutes}-minute ${appointment.mode} appointment`
            }
          }
        }],
        success_url: `${env.publicAppUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.publicAppUrl}/payment/cancel`,
        metadata: {
          paymentId: String(payment._id),
          appointmentId: String(appointment._id),
          userId: String(req.user._id)
        }
      });
    } catch (error) {
      payment.status = "failed";
      await payment.save();
      throw error;
    }

    payment.providerSessionId = session.id;
    payment.status = "pending";
    await payment.save();

    res.status(201).json({
      success: true,
      data: { checkoutUrl: session.url, paymentId: payment.id }
    });
  })
);

router.get(
  "/session/:sessionId",
  asyncHandler(async (req, res) => {
    const payment = await Payment.findOne({
      providerSessionId: req.params.sessionId,
      user: req.user._id
    }).populate("appointment");
    if (!payment) throw new ApiError(404, "Payment not found", "PAYMENT_NOT_FOUND");
    res.json({ success: true, data: { payment } });
  })
);

async function stripeWebhook(req, res, next) {
  try {
    if (!env.stripeSecretKey || !env.stripeWebhookSecret) {
      throw new ApiError(503, "Stripe webhook is not configured", "PAYMENTS_NOT_CONFIGURED");
    }

    const stripe = stripeClient();
    const signature = req.get("stripe-signature");
    if (!signature) throw new ApiError(400, "Stripe signature is missing", "SIGNATURE_MISSING");

    const event = stripe.webhooks.constructEvent(req.body, signature, env.stripeWebhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const payment = await Payment.findOne({
        _id: session.metadata?.paymentId,
        providerSessionId: session.id
      });

      if (payment && payment.status !== "paid") {
        const expectedAmount = Math.round(payment.amount * 100);
        if (
          session.payment_status !== "paid"
          || session.amount_total !== expectedAmount
          || session.currency !== payment.currency
        ) {
          throw new ApiError(400, "Stripe payment details do not match", "PAYMENT_MISMATCH");
        }

        payment.status = "paid";
        payment.providerPaymentIntentId = String(session.payment_intent || "");
        payment.paidAt = new Date();
        await payment.save();

        const appointment = await Appointment.findById(payment.appointment);
        if (appointment) {
          appointment.paymentStatus = "paid";
          await appointment.save();
        }

        await createNotification(req.app.get("io"), {
          user: payment.user,
          type: "payment",
          title: "Payment received",
          message: `Your payment of ${payment.amount} ${payment.currency.toUpperCase()} was confirmed.`,
          link: "/app/appointments"
        });
      }
    } else if (event.type === "checkout.session.expired") {
      await Payment.findOneAndUpdate(
        { providerSessionId: event.data.object.id, status: "pending" },
        { status: "failed" }
      );
    }

    res.json({ received: true });
  } catch (error) {
    next(error);
  }
}

module.exports = { paymentRouter: router, stripeWebhook };
