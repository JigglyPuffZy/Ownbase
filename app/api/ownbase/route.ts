import { env } from 'cloudflare:workers';
import { projectSql, SqlError } from '../../../lib/sql-store.mjs';
export const dynamic = 'force-dynamic';
const json = (v: unknown, status = 200) => Response.json(v, { status, headers: { 'Cache-Control': 'no-store' } });
const hash = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))).map(n => n.toString(16).padStart(2, '0')).join('');
const key = () => 'ob_secret_' + crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
const valid = (v: unknown) => typeof v === 'string' && /^[a-zA-Z][a-zA-Z0-9_ -]{0,62}$/.test(v);
async function handle(req: Request) {
    try {
        const db = env.DB!;
        if (!db || !env.BUCKET)
            return json({ error: 'Storage bindings unavailable.' }, 503);
        const url = new URL(req.url), user = req.headers.get('oai-authenticated-user-id'), bearer = req.headers.get('Authorization')?.replace(/^Bearer /, '');
        if (req.method !== 'GET' && req.headers.get('Origin') && req.headers.get('Origin') !== url.origin)
            return json({ error: 'Cross-origin console writes are not allowed.' }, 403);
        const body: any = req.method === 'POST' && req.headers.get('content-type')?.includes('application/json') ? await req.json() : {};
        if (!body || typeof body !== 'object' || Array.isArray(body))
            return json({ error: 'Expected a JSON object.' }, 400);
        const action = url.searchParams.get('action') || body.action || 'state';
        if (action === 'state') {
            if (!user)
                return json({ error: 'Sign in to open your workspace.' }, 401);
            const p = await db.prepare('SELECT id,name,created FROM projects WHERE owner=? ORDER BY created DESC').bind(user).all();
            return json({ projects: p.results, user: req.headers.get('oai-authenticated-user-email') || 'Your workspace' });
        }
        if (action === 'create-project' && req.method === 'POST') {
            if (!user)
                return json({ error: 'Sign in required.' }, 401);
            if (!valid(body.name))
                return json({ error: 'Use 1–63 letters, numbers, spaces, underscores or hyphens; start with a letter.' }, 400);
            const id = crypto.randomUUID(), secret = key();
            await db.prepare('INSERT INTO projects(id,owner,name,key_hash,created) VALUES(?,?,?,?,?)').bind(id, user, body.name, await hash(secret), new Date().toISOString()).run();
            return json({ id, key: secret }, 201);
        }
        const pid = url.searchParams.get('project') || body.project;
        const p = await db.prepare('SELECT * FROM projects WHERE id=?').bind(pid || '').first<any>();
        if (!p)
            return json({ error: 'Project not found.' }, 404);
        const owner = user === p.owner;
        if (!owner && (!bearer || await hash(bearer) !== p.key_hash))
            return json({ error: 'Project access denied.' }, 403);
        if (['sql-execute','sql-schema','sql-rows'].includes(action)) {
            if(!owner)return json({error:'SQL editor requires the project owner to sign in.'},403);
            if(action==='sql-execute'&&req.method!=='POST')return json({error:'Use POST to execute SQL.'},405);
            return json(await projectSql(db,pid,action,{...body,table:url.searchParams.get('table')||body.table}));
        }
        if (action === 'rotate-key' && req.method === 'POST') {
            if (!owner)
                return json({ error: 'Owner access required.' }, 403);
            const secret = key();
            await db.prepare('UPDATE projects SET key_hash=? WHERE id=?').bind(await hash(secret), pid).run();
            return json({ key: secret });
        }
        if (action === 'project' && req.method === 'GET') {
            const t = await db.prepare('SELECT c.id,c.name,c.created,COUNT(r.id) AS count FROM collections c LEFT JOIN records r ON r.collection=c.id WHERE c.project=? GROUP BY c.id ORDER BY c.created').bind(pid).all();
            const f = await db.prepare('SELECT id,name,size,type,created FROM files WHERE project=? ORDER BY created DESC').bind(pid).all();
            return json({ tables: t.results, files: f.results });
        }
        if (action === 'create-table' && req.method === 'POST') {
            if (!valid(body.name))
                return json({ error: 'Use a valid table name, starting with a letter (1–63 characters).' }, 400);
            const duplicate = await db.prepare('SELECT id FROM collections WHERE project=? AND name=?').bind(pid, body.name).first();
            if (duplicate)
                return json({ error: 'This table already exists.' }, 409);
            const id = crypto.randomUUID();
            await db.prepare('INSERT INTO collections(id,project,name,created) VALUES(?,?,?,?)').bind(id, pid, body.name, new Date().toISOString()).run();
            return json({ id }, 201);
        }
        if (action === 'upload' && req.method === 'POST') {
            const form = await req.formData(), f = form.get('file');
            if (!(f instanceof File))
                return json({ error: 'Choose a file.' }, 400);
            if (f.size > 10 * 1024 * 1024)
                return json({ error: 'Maximum file size is 10 MB.' }, 413);
            const id = crypto.randomUUID();
            await env.BUCKET.put(pid + '/' + id, f.stream(), { httpMetadata: { contentType: f.type || 'application/octet-stream' } });
            try {
                await db.prepare('INSERT INTO files(id,project,name,size,type,created) VALUES(?,?,?,?,?,?)').bind(id, pid, f.name, f.size, f.type, new Date().toISOString()).run();
            }
            catch (e) {
                await env.BUCKET.delete(pid + '/' + id);
                throw e;
            }
            return json({ id }, 201);
        }
        if (action === 'download' || action === 'delete-file') {
            const id = url.searchParams.get('id') || body.id, f = await db.prepare('SELECT * FROM files WHERE id=? AND project=?').bind(id, pid).first<any>();
            if (!f)
                return json({ error: 'File not found.' }, 404);
            if (action === 'delete-file' && req.method === 'POST') {
                await env.BUCKET.delete(pid + '/' + id);
                await db.prepare('DELETE FROM files WHERE id=?').bind(id).run();
                return json({ ok: true });
            }
            if (action === 'download' && req.method === 'GET') {
                const o = await env.BUCKET.get(pid + '/' + id);
                if (!o)
                    return json({ error: 'File unavailable.' }, 404);
                return new Response(o.body, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' } });
            }
        }
        if (['rows', 'insert', 'update', 'delete'].includes(action)) {
            const name = url.searchParams.get('table') || body.table, c = await db.prepare('SELECT id FROM collections WHERE project=? AND (id=? OR name=?)').bind(pid, name || '', name || '').first<any>();
            if (!c)
                return json({ error: 'Table not found.' }, 404);
            if (action === 'rows' && req.method === 'GET') {
                const r = await db.prepare('SELECT * FROM records WHERE collection=? ORDER BY created DESC LIMIT 500').bind(c.id).all<any>();
                return json({ rows: r.results.map(x => ({ id: x.id, data: JSON.parse(x.data), created: x.created, updated: x.updated })), limit: 500 });
            }
            if (req.method !== 'POST')
                return json({ error: 'Use POST for writes.' }, 405);
            if (action === 'delete') {
                await db.prepare('DELETE FROM records WHERE id=? AND collection=?').bind(body.id, c.id).run();
                return json({ ok: true });
            }
            if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data))
                return json({ error: 'Row must be a JSON object.' }, 400);
            const data = JSON.stringify(body.data);
            if (data.length > 64000)
                return json({ error: 'Maximum row size is 64 KB.' }, 413);
            const now = new Date().toISOString();
            if (action === 'insert') {
                const id = crypto.randomUUID();
                await db.prepare('INSERT INTO records(id,collection,data,created,updated) VALUES(?,?,?,?,?)').bind(id, c.id, data, now, now).run();
                return json({ id }, 201);
            }
            const result = await db.prepare('UPDATE records SET data=?,updated=? WHERE id=? AND collection=?').bind(data, now, body.id, c.id).run();
            return result.meta.changes ? json({ ok: true }) : json({ error: 'Row not found.' }, 404);
        }
        return json({ error: 'Unknown operation or method.' }, 400);
    }
    catch (e) {
        if(e instanceof SqlError)return json({error:e.message},e.status);
        console.error(e);
        return json({ error: e instanceof SyntaxError ? 'Invalid JSON.' : 'Request failed. Please try again.' }, 400);
    }
}
export const GET = handle;
export const POST = handle;
