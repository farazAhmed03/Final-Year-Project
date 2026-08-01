# LegalSphere v4 validation

## Environment compatibility

Validated with a synthetic copy of the original environment shape:

- `PORT=3000`
- Atlas-style `MONGO_URI`
- legacy `JWT_SECRET` and `SESSION_SECRET`
- `BASE_URL_PASSWORD_RESET`
- Gmail `MAIL_*`
- Cloudinary, PayFast, Stripe, and Sentry variable names

`node scripts/setup-env.js --frontend-port 8081` completed successfully and:

- preserved integration variables
- generated strong JWT/session secrets when legacy values were weak
- set `APP_ORIGINS` for localhost/127.0.0.1 on port 8081
- set `PUBLIC_APP_URL` and password-reset URL to port 8081
- configured Gmail defaults
- set private Docker upload storage

`node scripts/doctor.js` passed against the migrated synthetic environment.

## Static validation

- 63 JavaScript files passed `node --check`
- Docker Compose YAML parsed successfully
- GitHub Actions and Dependabot YAML parsed successfully
- no `.env` file or user credential was packaged
- npm lockfiles do not contain the inaccessible internal registry
- frontend Nginx proxy now receives the backend port dynamically

## Runtime contract

- backend container port: value of `PORT` (default/original: 3000)
- frontend host port: `FRONTEND_PORT` (default: 8081)
- frontend container port: 8080
- Mailpit host port: 8025

The React source was unchanged from v3, whose tests and optimized production build
had already passed. This patch changes environment, Docker, Nginx, setup, and
documentation files.
