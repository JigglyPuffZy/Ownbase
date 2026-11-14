import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {projectSql} from '../lib/sql-store.mjs';

function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const name of readdirSync(new URL('../drizzle/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort())sql.exec(readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));
 for(const id of ['one','two'])sql.prepare('INSERT INTO projects VALUES(?,?,?,?,?)').run(id,'alice',id,'hash','now');
 const db={prepare(query){const stmt=sql.prepare(query);let args=[];return {bind(...v){args=v;return this;},async first(){return stmt.get(...args)||null;},async run(){return {meta:stmt.run(...args)};}};}};
 return {sql,db};
}
test('persistent SQLite scripts, schema, joins, changes, errors and project isolation',async()=>{
 const {sql,db}=setup();
 const run=query=>projectSql(db,'one','sql-execute',{query});
 const created=await run(`-- Start here\nCREATE TABLE todos(id INTEGER PRIMARY KEY, title TEXT NOT NULL); INSERT INTO todos(title) VALUES ('Hello; it''s SQLite'),('Second'); SELECT * FROM todos ORDER BY id;`);
 assert.equal(created.results.length,3);assert.equal(created.results[2].values[0][1],"Hello; it's SQLite");
 const schema=await projectSql(db,'one','sql-schema');assert.equal(schema.tables[0].name,'todos');assert.equal(schema.tables[0].count,2);assert.equal(schema.tables[0].columns[0].primaryKey,true);
 assert.equal((await projectSql(db,'two','sql-schema')).tables.length,0);
 await assert.rejects(projectSql(db,'two','sql-rows',{table:'todos'}),/not found/);
 const loaded=await projectSql(db,'one','sql-rows',{table:'todos'});assert.deepEqual(loaded.columns,['id','title']);assert.equal(loaded.values.length,2);
 await run("ALTER TABLE todos ADD COLUMN done INTEGER DEFAULT 0; UPDATE todos SET done=1 WHERE id=1;");
 assert.equal((await run('SELECT done FROM todos WHERE id=1')).results[0].values[0][0],1);
 const joined=await run('CREATE TABLE labels(todo_id INTEGER,label TEXT); INSERT INTO labels VALUES(1,\'work\'); SELECT t.title,l.label FROM todos t JOIN labels l ON l.todo_id=t.id;');assert.equal(joined.results[2].values[0][1],'work');
 await assert.rejects(run("INSERT INTO todos(title) VALUES('unsaved'); SELECT missing FROM todos;"),/no such column/);
 assert.equal((await run('SELECT COUNT(*) FROM todos')).results[0].values[0][0],2);
 await assert.rejects(run('SELECT * FROM projects'),/no such table/);
 await assert.rejects(run("ATTACH DATABASE '/workspace.db' AS other;"),/Supported statements/);
 await assert.rejects(run('BEGIN; SELECT 1; COMMIT;'),/Supported statements/);
 await assert.rejects(run('PRAGMA writable_schema=ON'),/Supported statements/);
 await assert.rejects(run('SELECT 1;'.repeat(31)),/at most 30/);
 const limited=await run('WITH RECURSIVE numbers(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM numbers WHERE n<600) SELECT n FROM numbers;');assert.equal(limited.results[0].values.length,500);assert.equal(limited.results[0].truncated,true);
 await run('DELETE FROM todos WHERE id=2; DROP TABLE labels;');assert.equal((await projectSql(db,'one','sql-schema')).tables.length,1);
 assert.equal((await projectSql(db,'one','sql-rows',{table:'todos'})).values.length,1);
 sql.close();
});
test('concurrent SQL saves reject stale writes instead of losing data',async()=>{
 const {sql,db}=setup();await projectSql(db,'one','sql-execute',{query:'CREATE TABLE checks(value TEXT);'});
 const results=await Promise.allSettled(['first','second'].map(v=>projectSql(db,'one','sql-execute',{query:`INSERT INTO checks VALUES('${v}');`})));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const failed=results.find(r=>r.status==='rejected');assert.equal(failed.reason.status,409);
 assert.equal((await projectSql(db,'one','sql-rows',{table:'checks'})).values.length,1);sql.close();
});
