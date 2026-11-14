# Ownbase

A personal, cloud-backed developer workspace inspired by Supabase. Built with React, Vinext, Cloudflare D1 (SQLite) and R2.

## Implemented

- Owner-scoped projects protected by hosted ChatGPT sign-in.
- Named JSON document tables; insert, edit, delete, filter and export records.
- Durable file uploads, downloads and deletion, capped at 10 MB per file.
- Project secret keys generated with cryptographic randomness, stored only as SHA-256 hashes; rotation revokes the previous key.
- Server-side JSON HTTP API with project authorization and parameterized queries.
- Responsive dashboard, real project metrics, API examples and error states.

This is an initial backend, not a complete Supabase replacement. It does not provide PostgreSQL, arbitrary SQL, end-user signup/password authentication, row-level policies, realtime, edge functions, backups or a browser SDK. Tables contain JSON documents rather than typed relational columns. Reads return at most 500 records, newest first. UI filtering and export operate on those loaded records.

## Run locally

Use Node 22.13+ (Node 24 recommended).

```powershell
npm run install:ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_narrow_impossible_man.sql
npm run dev
```

The generated initial migration filename may differ; use the SQL file in `drizzle/`. Local migrations and hosted migrations are separate. Local sign-in: `/signin-with-chatgpt?return_to=/`. The portable starter simulates sign-in only in local development. Production identity is supplied by Sites dispatch. Never expose the development server publicly as an authenticated service.

## API

Endpoint: `/api/ownbase`. Owner browser sessions authenticate automatically. Server integrations use `Authorization: Bearer <project-secret>`. The hosted Site is owner-private, so callers outside a signed-in browser additionally require `OAI-Sites-Authorization: Bearer <Sites-service-token>`. A project key alone cannot cross the hosting sign-in boundary. Obtain the Site's service-access credential through its supported Sites connection; never put either secret in browser code. Cross-origin console writes are rejected; this version supports server integrations rather than direct browser SDK calls.

GET query parameters: `action`, `project`, and optionally `table` or `id`.

| Action | Method | Required fields |
| --- | --- | --- |
| state | GET | Owner session; lists owned projects |
| create-project | POST | Owner session, name |
| project | GET | project; lists tables and files |
| create-table | POST | project, name |
| rows | GET | project, table (name or ID) |
| insert | POST | project, table, data (JSON object) |
| update | POST | project, table, id, data (replaces document) |
| delete | POST | project, table, id |
| rotate-key | POST | Owner session, project |
| upload | POST multipart | project in query, file form field |
| download | GET | project, id |
| delete-file | POST | project, id |

JSON writes carry action and fields in the request body. Secret keys permit all data and file operations within their project, but cannot create projects, list workspace projects or rotate secrets. Treat them as administrator credentials. Keys appear once on creation or rotation and remain only in dashboard memory until reloading (hidden when another project is selected).

## Deployment

`.openai/hosting.json` declares the Sites project and provisioned DB and BUCKET bindings. The retained Sites Vite integration packages the Worker and schema migrations. Build with the Sites build helper, push matching source, then save and deploy the artifact with Sites. The dashboard remains owner-private.

## Verification

`node --test tests/api.test.mjs` exercises the actual transpiled route against in-memory SQLite and an R2 stand-in, including owner isolation, bearer authorization, key rotation, JSON CRUD, file roundtrips and input validation. It does not replace a hosted integration test.
