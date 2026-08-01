# Security policy

Report vulnerabilities privately to the project owner. Do not open public issues containing secrets, personal data, legal documents, or exploit details.

## Security controls included

- HttpOnly access and refresh cookies
- Rotating, server-side refresh sessions
- Double-submit CSRF protection
- Role-based and resource-level authorization
- Email verification and hashed one-time tokens
- Rate limits on authentication and sensitive routes
- Private file storage with permission-checked downloads
- Strict upload type/size limits and randomized storage names
- Input validation, HTML stripping, and NoSQL-key rejection
- Verified Stripe webhooks; browser redirects never mark payments paid
- Authenticated Socket.IO handshakes
- Security headers, explicit CORS origins, request IDs, and safe errors
- Account suspension and lawyer approval controls

## Deployment requirements

Use HTTPS, set `COOKIE_SECURE=true`, use a managed MongoDB cluster with backups, rotate every generated secret, configure SMTP, and store uploaded documents in private object storage with malware scanning for high-risk deployments.

## Credential exposure response

Treat a credential as compromised as soon as it appears in chat, a screenshot, a commit, a ticket, or terminal history shared with others. Removing the text later is not sufficient. Revoke or rotate the provider credential, update the secret store, recreate affected containers, invalidate application sessions when JWT material changes, and review provider access logs.
