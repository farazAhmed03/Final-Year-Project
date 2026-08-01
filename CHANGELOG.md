# Changelog

## 2.1.0

- Moved the default host frontend port to `8081` for Jenkins compatibility.
- Normalized configured CORS origins and included localhost/127.0.0.1 defaults.
- Added safe legacy environment aliases and an environment migration guide.
- Added `scripts/doctor.js` and idempotent secret generation.
- Added accessible hero, scroll-reveal, workflow and route-enter animations.
- Improved mobile navigation behavior and dense-view responsiveness.
- Expanded CI with environment, Compose and build-artifact validation.
- Ensured npm lockfiles use the public npm registry.

## 2.0.1 - Portable npm registry fix

- Replaced six environment-specific backend lockfile tarball URLs with the public npm registry.
- Added a backend `.npmrc` and copied it into the Docker dependency stage so container builds use `https://registry.npmjs.org/`.

## 2.0.0

- Rebuilt backend data model, API, authorization and state workflows
- Rebuilt responsive React experience and route model
- Replaced public uploads with private authorized downloads
- Added rotating refresh sessions, CSRF and one-time token workflows
- Added authenticated Socket.IO chat and persistent notifications
- Added verified Stripe Checkout webhook integration
- Added administrator moderation screens
- Added Docker, Nginx, Compose, CI, CodeQL and Dependabot
- Added unit tests, optional Mongo integration test and production build checks
