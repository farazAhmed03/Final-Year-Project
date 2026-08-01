# Validation Report

Validated on **2026-07-12** in the build workspace.

## Passed checks

| Check | Result |
|---|---|
| Backend clean dependency install (`npm ci`) | Passed |
| Backend syntax validation | Passed — 54 backend files |
| Root setup/doctor script syntax | Passed |
| Backend unit tests | Passed — 7 passed, 1 Mongo integration test skipped locally |
| CORS smoke test | Passed — `localhost:8081` allowed and old `localhost:8080` denied |
| Backend Express application construction | Passed |
| Frontend clean dependency install (`npm ci`) | Passed |
| Frontend static JS/JSX parsing | Passed |
| Frontend Jest tests | Passed — 2 passed |
| Frontend optimized production build | Passed |
| Environment setup idempotency | Passed — an existing strong JWT secret is not rotated |
| Environment doctor | Passed for the generated local Docker configuration |
| YAML parsing: Compose, GitHub Actions, Dependabot | Passed |
| Internal npm registry scan | Passed — public npm registry lockfiles only |
| Git merge-conflict marker scan | Passed — none found |
| Runtime `.env` packaging rule | Passed — `.env` excluded; `.env.example` only |
| User-provided credential pattern scan | Passed — no supplied credentials included |

Frontend build output before cleanup:

- Main JavaScript: approximately 147.9 kB gzip
- Main CSS: approximately 44.7 kB gzip

## Environment limitation

The workspace Docker executable returned `Permission denied`, so container images could not be executed here. Dockerfiles and YAML were statically validated. GitHub Actions performs clean backend/frontend image builds and Compose validation on pushes and pull requests.

## Commands to repeat

```bash
node scripts/setup-env.js --frontend-port 8081
node scripts/doctor.js

npm --prefix backend ci
npm --prefix backend run lint
npm --prefix backend test

npm --prefix frontend ci
CI=true npm --prefix frontend test -- --watchAll=false --runInBand
CI=true npm --prefix frontend run build

docker compose config
docker compose up --build
```

For the Mongo-backed authentication integration test:

```bash
RUN_INTEGRATION_TESTS=true npm --prefix backend test
```

A running MongoDB instance and the test values from `.github/workflows/ci.yml` are required.

## Production qualification note

This is a production-oriented engineering baseline, not a penetration-test result, legal compliance certification, or guarantee for handling real confidential legal records. Before public deployment, complete HTTPS, managed secrets, encrypted private object storage, malware scanning, database backup/restore testing, privacy review, accessibility/performance testing, and an independent security assessment.
