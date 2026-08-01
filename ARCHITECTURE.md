# Architecture

LegalSphere is split into an Express/MongoDB API and a React single-page application.

## Trust boundaries

The browser never receives authentication tokens in JSON. Access tokens and opaque refresh tokens are stored in HttpOnly cookies. Every unsafe request also requires a CSRF token. The API performs both role checks and resource ownership checks.

Legal documents are stored outside the public web root. A download request is authorized against the case before the file is streamed.

Socket.IO authenticates the access cookie during the handshake. A user may join only conversations in which they are a participant.

Payment completion is accepted only from a Stripe webhook whose signature is verified against the raw request body.

## Core workflows

1. Registration → email verification → active account
2. Lawyer registration → email verification → administrator approval
3. Client appointment request → lawyer confirmation → optional checkout
4. Client case submission → lawyer acceptance → in progress → closure
5. Closed case → one review per client/case
6. Conversation membership → real-time messages and notifications
