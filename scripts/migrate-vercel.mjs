import {createClient} from '@libsql/client/web';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
if(!process.env.TURSO_DATABASE_URL||!process.env.TURSO_AUTH_TOKEN)throw new Error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before migration.');
const db=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
try{
 await db.execute('CREATE TABLE IF NOT EXISTS ownbase_migrations(name TEXT PRIMARY KEY,sha TEXT NOT NULL)');
 for(const name of readdirSync(new URL('../drizzle/',import.meta.url)).filter(s=>s.endsWith('.sql')).sort()){
  const sql=readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'),sha=createHash('sha256').update(sql.replaceAll('\r\n','\n')).digest('hex');
  const previous=await db.execute({sql:'SELECT sha FROM ownbase_migrations WHERE name=?',args:[name]});
  if(previous.rows.length){if(previous.rows[0].sha!==sha)throw new Error('Previously applied migration changed: '+name);continue;}
  const statements=sql.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean).map(sql=>({sql,args:[]}));
  await db.batch([...statements,{sql:'INSERT INTO ownbase_migrations(name,sha) VALUES(?,?)',args:[name,sha]}],'write');
  console.log('Applied '+name);
 }
}finally{db.close();}
