# Deployment guide

## Recommended topology

```text
Internet
  |
TLS load balancer / reverse proxy
  |
Frontend Nginx container
  |-- /              React static assets
  |-- /api/*         Express API
  `-- /socket.io/*   Socket.IO upgrade
          |
       Backend
       |-- MongoDB
       |-- SMTP
       |-- Stripe
       `-- private object storage / protected volume
```

The supplied Nginx container listens internally on port `8080`; Docker Compose maps it to host port `8081` by default so Jenkins can retain `8080`. Terminate TLS at the platform load balancer or at a separately managed edge proxy.

## Required changes from local Compose

1. Use unique secret-manager values; do not deploy the generated local `.env`.
2. Set `COOKIE_SECURE=true`.
3. Set exact HTTPS origins—never use `*` with credentialed CORS.
4. Use managed, authenticated MongoDB with restricted network access.
5. Use durable private storage. A container filesystem is not durable.
6. Configure SMTP and provider-side delivery authentication.
7. Register the public Stripe webhook and signing secret.
8. Run `npm run seed` once with a temporary strong administrator password.
9. Restrict the Mailpit service to local development; do not deploy it publicly.
10. Keep more than one tested backup generation.

## Horizontal scaling

The current Socket.IO setup is intentionally single-backend-instance. Before scaling the backend horizontally, add a shared Socket.IO adapter such as Redis, sticky-session routing where required, and distributed rate limiting.

HTTP API routes can be scaled after uploads move to shared private storage and background jobs become durable.

## Database indexes

The Mongoose models define indexes. In a controlled production release, create and verify indexes as a migration rather than relying on application startup. `autoIndex` is disabled in production.

## Zero-downtime considerations

- Run schema/index migrations before traffic reaches incompatible code.
- Keep access-token verification keys available during rolling deployments.
- Graceful shutdown allows active requests time to finish.
- Readiness fails until MongoDB is connected.
- Stripe webhook handlers are idempotent for already-paid records.
