# LegalSphere 2.1

## Original environment variables

The rebuild accepts the original LegalSphere variable names. Put your rotated values in
`.env`, then run:

```bash
node scripts/setup-env.js --frontend-port 8081
node scripts/doctor.js
```

`PORT=3000` is supported inside Docker and the browser application uses
`http://localhost:8081`. See `docs/LEGACY_ENV.md`.


A full rewrite of the lawyer management FYP as a production-oriented MERN application.

LegalSphere supports three controlled roles:

- **Client:** discover approved lawyers, request appointments, submit cases, upload private documents, pay consultation fees, chat, and review closed cases.
- **Lawyer:** maintain a professional profile, respond to appointments, manage assigned case states, access authorized documents, and communicate with clients.
- **Administrator:** approve lawyer profiles, manage account status, and oversee platform records.

> This repository provides a secure production baseline, not a legal/compliance certification. Before handling real legal records, complete a penetration test, privacy review, backup/restore test, jurisdiction-specific compliance assessment, and malware-scanning/object-storage integration.

## What was rebuilt

- Clean Express/Mongoose API and React UI
- Correct role-based redirects and legacy-route redirects
- Public admin registration removed
- HttpOnly access token plus rotating opaque refresh sessions
- CSRF protection for every unsafe browser request
- Email verification and password reset with hashed, expiring one-time tokens
- Role-level and resource-ownership authorization
- Approved-lawyer directory with search and review summaries
- Appointment state machine and conflict checks
- Case state machine, status timeline, and exact-case reviews
- Private document storage and permission-checked downloads
- MIME and magic-byte validation for PDF/JPEG/PNG uploads
- Authenticated Socket.IO rooms with consistent event names
- Persistent notifications
- Stripe Checkout with signed webhook confirmation
- Optional Firebase/Google sign-in
- Administrator user suspension and lawyer approval
- Health/readiness endpoints and OpenAPI summary
- Multi-stage Docker images, Docker Compose, CI, CodeQL, and Dependabot

## Quick start with Docker

Requirements: Docker Engine with Compose v2 and Node.js 20+ for generating secrets.

```bash
node scripts/setup-env.js --frontend-port 8081
node scripts/doctor.js
docker compose up --build
```

Open:

- Application: `http://localhost:8081`
- Development email inbox: `http://localhost:8025`

Port `8081` is the default host port so Jenkins can continue using `8080`. When the
frontend port changes, update `FRONTEND_PORT`, `APP_ORIGINS`, and `PUBLIC_APP_URL`
together, then recreate the backend container. See
[docs/ENVIRONMENT.md](docs/ENVIRONMENT.md).

Create the initial administrator:

```bash
docker compose exec backend npm run seed
```

The generated administrator password is stored in `.env` as `SEED_ADMIN_PASSWORD`. Change it after the first login.

Stop the stack:

```bash
docker compose down
```

Delete all local database and uploaded-file volumes:

```bash
docker compose down -v
```

## Local development without Docker

1. Create the root environment file:

   ```bash
   node scripts/setup-env.js
   ```

2. Edit `.env`:

   ```dotenv
   NODE_ENV=development
   PORT=5000
   MONGO_URI=mongodb://127.0.0.1:27017/legalsphere
   APP_ORIGINS=http://localhost:3000
   PUBLIC_APP_URL=http://localhost:3000
   PRIVATE_UPLOAD_DIR=./private_uploads
   SMTP_HOST=
   COOKIE_SECURE=false
   ```

3. Install dependencies:

   ```bash
   npm --prefix backend ci
   npm --prefix frontend ci
   ```

4. Start the API and frontend in separate terminals:

   ```bash
   npm --prefix backend run dev
   npm --prefix frontend start
   ```

The React development proxy forwards API and Socket.IO traffic to `http://localhost:5000`.

## Tests and builds

```bash
npm --prefix backend run lint
npm --prefix backend test
CI=true npm --prefix frontend test -- --watchAll=false --runInBand
CI=true npm --prefix frontend run build
```

The Mongo-backed authentication integration test runs when:

```bash
RUN_INTEGRATION_TESTS=true npm --prefix backend test
```

It expects `MONGO_URI`, a running MongoDB instance, and the other CI environment values shown in `.github/workflows/ci.yml`.

## Environment variables

### Required in production

| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB connection URI |
| `APP_ORIGINS` | Comma-separated exact browser origins |
| `PUBLIC_APP_URL` | Public frontend URL used in emails and checkout |
| `JWT_ACCESS_SECRET` | Random secret of at least 32 characters |
| `COOKIE_SECURE` | Must be `true` behind public HTTPS |
| `PRIVATE_UPLOAD_DIR` | Non-public document storage path |

### Email

| Variable | Purpose |
|---|---|
| `SMTP_HOST`, `SMTP_PORT` | SMTP server |
| `SMTP_SECURE` | TLS connection flag |
| `SMTP_USER`, `SMTP_PASS` | SMTP credentials |
| `MAIL_FROM` | Sender identity |

Docker Compose uses Mailpit for local email previews.

### Stripe

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe server secret |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the webhook endpoint |
| `STRIPE_CURRENCY` | Lowercase ISO currency, default `usd` |

Webhook endpoint:

```text
POST /api/v1/payments/webhook
```

A success-page redirect never marks a payment paid. Only a webhook with a valid Stripe signature and matching amount/currency can do that.

### Google sign-in

Copy `frontend/.env.example` to `frontend/.env` and set the public Firebase web values. Set `FIREBASE_SERVICE_ACCOUNT_JSON` in the backend as a single-line JSON service account value. Google sign-in remains hidden when the frontend values are absent and returns a configuration error when backend verification is absent.

## Main API groups

| Prefix | Responsibility |
|---|---|
| `/api/v1/auth` | CSRF, registration, verification, login, refresh, reset, profile |
| `/api/v1/lawyers` | Approved public lawyer directory |
| `/api/v1/appointments` | Appointment creation, list, and status workflow |
| `/api/v1/cases` | Case records, state workflow, private documents |
| `/api/v1/reviews` | Verified closed-case reviews |
| `/api/v1/conversations` | Conversations, messages, and read state |
| `/api/v1/notifications` | User activity notifications |
| `/api/v1/payments` | Stripe checkout and payment status |
| `/api/v1/dashboard` | Role-specific summary data |
| `/api/v1/admin` | User status and lawyer verification |

Health and API metadata:

```text
GET /api/health/live
GET /api/health/ready
GET /api/openapi.json
```

## Real-time event contract

Client to server:

```text
conversation:join
conversation:leave
message:send
message:read
typing:start
typing:stop
```

Server to client:

```text
message:new
message:read
typing:update
notification:new
account:updated
```

Socket handshakes verify the same access session used by the API. A socket can join only conversations containing its authenticated user.

## Legacy route compatibility

Old bookmarks are redirected to the new route model, including:

```text
/dashboard                       → /app/dashboard
/dashboard/myappointments        → /app/appointments
/lawyerdashboard                 → /app/dashboard
/lawyerdashboard/lawyercase      → /app/cases
/lawyerprofile/:id               → /lawyers/:id
/chat/:id                        → /app/chat/:id
```

## CI/CD

`.github/workflows/ci.yml` runs:

1. Backend lock install, syntax validation, unit tests, and Mongo integration test
2. Frontend lock install, Jest tests, ESLint checks through a CI production build
3. Backend and frontend Docker image builds
4. GitHub CodeQL analysis

Dependabot is configured for npm, Docker, and GitHub Actions updates.

The pipeline builds images but deliberately does not push or deploy them. Add registry login and environment-specific deployment only after selecting your hosting provider and secret store.

## Production deployment checklist

- Put the frontend container behind a TLS load balancer or reverse proxy.
- Set `COOKIE_SECURE=true` and exact HTTPS values in `APP_ORIGINS` and `PUBLIC_APP_URL`.
- Replace local MongoDB with an authenticated managed deployment, point-in-time backups, and restore drills.
- Store secrets in the hosting platform’s secret manager; never commit `.env`.
- Replace the local private volume with encrypted private object storage and short-lived signed downloads where appropriate.
- Add malware scanning/quarantine for uploaded legal documents.
- Configure SMTP SPF, DKIM, and DMARC.
- Configure and test Stripe webhook retries and alerting.
- Add central logs, metrics, uptime checks, and privacy-safe error monitoring.
- Add retention/deletion policies, audit logging, and jurisdiction-specific consent/privacy notices.
- Run accessibility, performance, penetration, and disaster-recovery tests.

See [SECURITY.md](SECURITY.md), [ARCHITECTURE.md](ARCHITECTURE.md), and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).


## Motion and responsive UI

The public experience includes staggered hero entrance, scroll-triggered section reveals, animated workflow indicators, responsive navigation, mobile dashboard navigation, and reduced-motion support. Motion is automatically disabled when the operating system requests reduced motion.