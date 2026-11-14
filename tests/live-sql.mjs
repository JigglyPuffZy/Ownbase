// Run against the portable development server only. Uses local mock sign-in.
import assert from 'node:assert/strict';
const base='http://127.0.0.1:5175';
const signin=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const cookie=signin.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
const state=await (await fetch(base+'/api/ownbase?action=state',{headers:{Cookie:cookie}})).json();
const project=state.projects.find(p=>p.name==='SQL verification')?.id;
assert.ok(project,'Create the local SQL verification project first.');
const call=async(action,fields={})=>{
 const r=await fetch(base+'/api/ownbase',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({action,project,...fields})});
 const d=await r.json();assert.ok(r.ok,JSON.stringify(d));return d;
};
const query="CREATE TABLE IF NOT EXISTS todos(id INTEGER PRIMARY KEY,title TEXT); INSERT OR REPLACE INTO todos VALUES(1,'SQL works'); SELECT * FROM todos;";
const data=await call('sql-execute',{query});assert.equal(data.results[2].values[0][1],'SQL works');
const schema=await call('sql-schema');assert.equal(schema.tables[0].name,'todos');
const rows=await call('sql-rows',{table:'todos'});assert.equal(rows.values.length,1);
console.log('Live Worker SQL passed: CREATE TABLE, INSERT, SELECT, persistence and schema browsing.');
