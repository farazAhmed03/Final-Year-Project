# Using the original LegalSphere environment variable names

This build accepts the original names such as `JWT_SECRET`, `SESSION_SECRET`,
`BASE_URL_PASSWORD_RESET`, `MAIL_HOST`, `MAIL_USER`, `MAIL_PASS`,
`LOCAL_UPLOAD_PATH`, `CLOUDINARY_*`, `MERCHANT_*`, `STRIPE_*`, and `SENTRY_DSN`.

## Safe local migration

1. Copy your original file to `.env`.
2. Replace every credential that has ever been pasted into chat, committed, or shared.
3. Run:

```bash
node scripts/setup-env.js --frontend-port 8081
node scripts/doctor.js
docker compose down --remove-orphans
docker compose up -d --build
```

The setup script preserves your database, mail, Cloudinary, payment, and monitoring
values. It only adds/fixes the modern security and routing values required by the rebuild:

- `APP_ORIGINS`
- `PUBLIC_APP_URL`
- `BASE_URL_PASSWORD_RESET`
- `JWT_ACCESS_SECRET`
- `PRIVATE_UPLOAD_DIR`
- `FRONTEND_PORT`

`PORT=3000` is now supported dynamically inside Docker. Jenkins may remain on host
port `8080`; the web application is served on `http://localhost:8081`.

## Integration status

- Gmail SMTP is active through the legacy `MAIL_*` variables.
- MongoDB Atlas is active through `MONGO_URI`.
- Stripe Checkout is active when `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are configured.
- Cloudinary settings are loaded for compatibility, but private legal documents remain on protected storage.
- PayFast settings are loaded for compatibility, but the active payment implementation is Stripe.
- `SENTRY_DSN` is loaded, but the Sentry SDK is not bundled in this build.

Never commit `.env`. The repository ignores it.
