# Security control map

| Threat | Implemented control |
|---|---|
| Public administrator creation | Registration schema allows only client or lawyer |
| Stolen browser token through XSS | Access and refresh values are HttpOnly cookies |
| Cross-site unsafe requests | SameSite cookies plus double-submit CSRF token |
| Long-lived stolen refresh token | Opaque hashed server session with rotation |
| Suspended user retaining access | Token version check and session deletion |
| Password reset database leak | One-time reset token stored only as SHA-256 hash |
| Password double hashing | Password hashes only when the field is modified |
| NoSQL operator injection | Recursive rejection of `$` and dotted keys |
| Invalid workflow changes | Explicit appointment and case transition maps |
| Insecure direct object reference | Participant/owner/admin checks per record |
| Public legal documents | Files outside web root; authorized streaming route |
| Fake file extension | Allowed MIME list plus PDF/JPEG/PNG magic bytes |
| Forged payment return URL | Stripe signed webhook with amount/currency match |
| Chat user impersonation | JWT-authenticated Socket.IO handshake |
| Socket room guessing | Conversation membership check before join |
| Brute-force auth attempts | Route-specific rate limits |
| Secret leakage in repository | `.env` ignored and excluded from Docker contexts |
