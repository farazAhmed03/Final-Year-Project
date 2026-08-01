const nodemailer = require("nodemailer");
const env = require("../config/env");

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  if (!env.smtp.host) return null;

  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined
  });
  return transporter;
}

async function sendMail({ to, subject, text, html }) {
  const transport = getTransporter();

  if (!transport) {
    if (env.nodeEnv !== "production") {
      console.log(JSON.stringify({ level: "info", event: "mail_preview", to, subject, text }));
      return;
    }
    throw new Error("SMTP is not configured");
  }

  await transport.sendMail({
    from: env.smtp.from,
    to,
    subject,
    text,
    html
  });
}

async function sendVerificationEmail(user, token) {
  const verifyUrl = `${env.publicAppUrl}/verify-email?token=${encodeURIComponent(token)}`;
  await sendMail({
    to: user.email,
    subject: "Verify your LegalSphere email",
    text: `Verify your email by opening: ${verifyUrl}`,
    html: `<p>Hello ${user.name},</p><p>Verify your email:</p><p><a href="${verifyUrl}">Verify email</a></p><p>This link expires in 30 minutes.</p>`
  });
}

async function sendPasswordResetEmail(user, token) {
  const resetUrl = `${env.publicAppUrl}/reset-password/${encodeURIComponent(token)}`;
  await sendMail({
    to: user.email,
    subject: "Reset your LegalSphere password",
    text: `Reset your password by opening: ${resetUrl}`,
    html: `<p>Hello ${user.name},</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in 20 minutes.</p>`
  });
}

module.exports = { sendMail, sendVerificationEmail, sendPasswordResetEmail };
