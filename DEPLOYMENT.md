# Ownbase deployment

## Existing hosted deployment

The Sites version uses its existing owner-only ChatGPT authentication, D1 and R2. This deployment stays separate from Vercel and is not automatically migrated. Existing Sites data will not appear in a new Turso database.

## Vercel

1. Import `JigglyPuffZy/Ownbase` into your Vercel account. The repository root is the app root. Keep the Next.js framework preset and the build command in `vercel.json`.
2. Provision a **Turso libSQL database** and set `TURSO_DATABASE_URL` and secret `TURSO_AUTH_TOKEN` in Vercel.
3. Provision a **private Vercel Blob store**. Set its secret `BLOB_READ_WRITE_TOKEN` in Vercel. Do not use a public store: application files are private.
4. Set a unique random `OWNBASE_ADMIN_PASSWORD` (minimum 16 characters) and independent random `OWNBASE_SESSION_SECRET` (minimum 32 characters). Configure secrets in Vercel, never in GitHub source or browser code. Set `OWNBASE_RUNTIME=vercel` when running outside Vercel.
5. Deploy. The build first applies the tracked migrations to Turso, then builds Next.js. Missing database credentials intentionally fail deployment instead of publishing a nonworking backend.
6. Open `/login`, sign in, create a project, and use `/?view=sql` or the SQL Editor button. Verify SQL persistence, file upload/download and key rotation on the deployed URL before accepting the deployment.

Administrator sessions are signed, expire after eight hours and use HttpOnly/Secure/SameSite cookies. The login route rate-limits attempts through durable database records. Changing the session secret revokes all sessions. Vercel ignores incoming Sites identity headers; they cannot authenticate a caller.

On Vercel, server integrations use only the project bearer key. They do not require a Sites token. SQL administration still requires an owner session. Files on Vercel are limited to 4 MB to stay below the function request limit. Sites file uploads retain the 10 MB limit.

This is a personal backend workspace, not a hosted multi-tenant Supabase platform. See README for feature limits. Do not configure the same Turso database for unrelated users or expose any of its credentials as `NEXT_PUBLIC_` values. Keep backups through your database provider.

## Local verification

```
npm ci
npm test
npm run typecheck
npm run build:vercel
```

To exercise Vercel's real storage locally, configure the environment variables above, run `npm run db:migrate:vercel`, set `OWNBASE_RUNTIME=vercel`, and run `npm run dev:vercel`. Use HTTPS when testing Secure session cookies outside localhost.

## Release checks

Automated tests exercise JSON CRUD, authorization, key rotation, file handling, isolated SQL images, SQL persistence, concurrent write conflicts, and signed administrator sessions. A successful build checks compilation; it does not prove remote credentials, billing or storage provisioning are correct. A Vercel production URL is only considered released after deployment and remote smoke checks succeed.
