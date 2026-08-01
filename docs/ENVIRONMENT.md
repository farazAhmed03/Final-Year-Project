# Environment migration and local port guide

## Original LegalSphere values

The rebuild accepts the original variable names, including:

- `PORT`, `MONGO_URI`, `JWT_SECRET`, `SESSION_SECRET`
- `BASE_URL_PASSWORD_RESET`
- `MAIL_HOST`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM`
- `CLOUDINARY_*`, `LOCAL_UPLOAD_PATH`
- `MERCHANT_*`, `PAYFAST_URL`, `RETURN_URL`, `CANCEL_URL`
- `STRIPE_PUBLIC_KEY`, `STRIPE_SECRET_KEY`
- `SENTRY_DSN`

Paste your **rotated** private values into `.env`, then run:

```bash
node scripts/setup-env.js --frontend-port 8081
node scripts/doctor.js
```

The setup script keeps your integration values and adds the routing/security values
required by the rewritten application.

## Recommended local Docker values

```dotenv
NODE_ENV=production
PORT=3000
FRONTEND_PORT=8081
MAILPIT_PORT=8025

MONGO_URI=mongodb://mongo:27017/legalsphere
APP_ORIGINS=http://localhost:8081,http://127.0.0.1:8081
PUBLIC_APP_URL=http://localhost:8081
BASE_URL_PASSWORD_RESET=http://localhost:8081

JWT_ACCESS_SECRET=generated-by-setup-script
COOKIE_SECURE=false
PRIVATE_UPLOAD_DIR=/data/uploads
```

The backend port is internal to Docker and may remain `3000`. Nginx discovers it through
the Compose environment. Jenkins keeps host port `8080`; LegalSphere uses host port
`8081`.

After changing `.env`, recreate the backend and frontend containers:

```bash
docker compose up -d --build --force-recreate backend frontend
```

## Why “Origin is not allowed” appears

Authentication uses credentialed HttpOnly cookies, so CORS cannot safely use `*`.
The browser origin must exactly match one of the normalized values in `APP_ORIGINS`.

For local access:

```dotenv
APP_ORIGINS=http://localhost:8081,http://127.0.0.1:8081
PUBLIC_APP_URL=http://localhost:8081
```

Do not include URL paths in an origin.

## Gmail

The legacy mail names are supported. For Gmail:

```dotenv
MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_SECURE=true
MAIL_USER=your-address@example.com
MAIL_PASS=your-new-app-password
MAIL_FROM=LegalSphere
```

## Integration status

| Variables | Status |
|---|---|
| `MONGO_URI` | Active |
| `MAIL_*` | Active |
| `JWT_SECRET` | Compatibility alias; setup also creates `JWT_ACCESS_SECRET` |
| `SESSION_SECRET` | Preserved, but rotating database refresh sessions are used |
| `LOCAL_UPLOAD_PATH` | Compatibility alias; Docker uses private `/data/uploads` |
| `CLOUDINARY_*` | Loaded/reserved for profile media; not used for legal documents |
| `MERCHANT_*`, `PAYFAST_*` | Loaded for compatibility; active checkout provider is Stripe |
| `STRIPE_SECRET_KEY` | Active |
| `STRIPE_WEBHOOK_SECRET` | Required for payment confirmation |
| `SENTRY_DSN` | Loaded, but SDK is not bundled |

## Public deployment

For HTTPS:

```dotenv
NODE_ENV=production
APP_ORIGINS=https://app.example.com
PUBLIC_APP_URL=https://app.example.com
BASE_URL_PASSWORD_RESET=https://app.example.com
COOKIE_SECURE=true
COOKIE_DOMAIN=
```

Use a secret manager and never commit `.env`.
