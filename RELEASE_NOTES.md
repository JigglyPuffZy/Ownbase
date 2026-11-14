# Ownbase 1.0.0

Personal backend workspace with project management, persistent JSON records, isolated SQLite editing, private files, server API keys, and a responsive interface.

- SQL: create/alter/drop tables, insert/select/update/delete, joins, templates, result export and table browsing.
- Security: owner-scoped resources, hashed project keys, key rotation, atomic SQL image saves and conflicting-write detection.
- Hosting: retained Sites runtime plus a Next.js Vercel runtime with Turso and private Vercel Blob adapters, administrator login, signed sessions and durable login attempt limits.
- Release tooling: automated tests, type checks, tracked migrations, environment template and Vercel deployment instructions.

## Limits

SQL uses SQLite, not PostgreSQL. SQL images are capped at 512 KB per project; results show up to 500 rows. Vercel requires its own configured database, private Blob store and administrator secrets. Sites data is not automatically copied to Vercel. This release does not implement application-user signup, row-level policies, realtime subscriptions, edge functions, managed backups or a browser SDK.

Removing the beta badge denotes this versioned feature set; it does not certify parity with Supabase or production suitability for every workload.
