import initSqlJs from '../vendor/sql-engine.mjs';

// SQL runs against a project-only SQLite image, never the workspace control DB.
const engine = initSqlJs({ printErr: () => {} });
const MAX_DATABASE = 512 * 1024;
const LIMIT = 500;
const quote = name => '"' + name.replaceAll('"', '""') + '"';
const encode = bytes => { let s=''; for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192)); return btoa(s); };
const decode = text => Uint8Array.from(atob(text), c=>c.charCodeAt(0));
const scalar = value => value instanceof Uint8Array ? {hex:Array.from(value,n=>n.toString(16).padStart(2,'0')).join('')} : value;

export class SqlError extends Error { constructor(message,status=400){super(message);this.status=status;} }

export async function projectSql(control, project, action, input={}) {
 const stored=await control.prepare('SELECT image,revision FROM project_sql WHERE project=?').bind(project).first();
 const SQL=await engine;
 // All engine work is synchronous and the DB is closed before any persistence await.
 // No other request can interleave access to an open project image.
 const db=new SQL.Database(stored?decode(stored.image):undefined);
 let payload, exported;
 try {
  db.run('PRAGMA foreign_keys=ON; PRAGMA max_page_count=128;');
  if(action==='sql-schema'){
   const result=db.exec("SELECT name,sql,type FROM sqlite_schema WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name");
   const tables=(result[0]?.values||[]).map(([name,sql,type])=>({name,sql,type,count:db.exec('SELECT COUNT(*) FROM '+quote(name))[0]?.values[0][0]||0,columns:db.exec('PRAGMA table_info('+quote(name)+')')[0]?.values.map(c=>({name:c[1],type:c[2],primaryKey:!!c[5]}))||[]}));
   payload={tables};
  }else if(action==='sql-rows'){
   if(typeof input.table!=='string')throw new SqlError('Choose a SQL table.');
   const exists=db.exec("SELECT name FROM sqlite_schema WHERE type IN ('table','view') AND name=?",[input.table]);
   if(!exists.length)throw new SqlError('SQL table not found.',404);
   const result=db.exec('SELECT * FROM '+quote(input.table)+' LIMIT '+LIMIT)[0];
   const columns=result?.columns||db.exec('PRAGMA table_info('+quote(input.table)+')')[0]?.values.map(c=>c[1])||[];
   payload={columns,values:(result?.values||[]).map(row=>row.map(scalar)),limit:LIMIT};
  }else if(action==='sql-execute'){
   if(typeof input.query!=='string'||!input.query.trim())throw new SqlError('Enter a SQL query first.');
   if(input.query.length>32000)throw new SqlError('Queries must be under 32,000 characters.');
   const started=Date.now(),results=[];
   db.run('BEGIN');
   let count=0,resultBytes=0;
   for(const stmt of db.iterateStatements(input.query)){
    if(++count>30)throw new SqlError('Run at most 30 statements at a time.');
    const sql=stmt.getSQL();
    const command=sql.replace(/^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/,'').match(/^([a-z]+)/i)?.[1]?.toUpperCase();
    if(!['SELECT','WITH','EXPLAIN','CREATE','ALTER','INSERT','REPLACE','UPDATE','DELETE','DROP'].includes(command))throw new SqlError('Supported statements: CREATE, ALTER, INSERT, SELECT, UPDATE, DELETE, DROP, WITH and EXPLAIN. Scripts are committed automatically.');
    const columns=stmt.getColumnNames(),values=[];let truncated=false;
    while(stmt.step()){
     if(values.length===LIMIT){truncated=true;break;}
     values.push(stmt.get().map(scalar));
     const bytes=JSON.stringify(values[values.length-1]).length;
     if(bytes>64000)throw new SqlError('A result row exceeds the 64 KB display limit.');
     resultBytes+=bytes;if(resultBytes>1024*1024)throw new SqlError('Query results exceed 1 MB. Select fewer rows or columns.');
    }
    results.push({statement:sql,columns,values,truncated,changes:columns.length?0:db.getRowsModified()});
   }
   if(!count)throw new SqlError('Enter at least one SQL statement.');
   db.run('COMMIT');
   exported=db.export();
   if(exported.length>MAX_DATABASE)throw new SqlError('This project SQL database is limited to 512 KB. Changes were not saved.',413);
   payload={results,duration:Date.now()-started,bytes:exported.length,limit:LIMIT};
  }else throw new SqlError('Unknown SQL action.');
 }catch(error){throw error instanceof SqlError?error:new SqlError(error.message||'SQL query failed.');}
 finally{db.close();}
 if(exported){
  const result=stored
   ?await control.prepare('UPDATE project_sql SET image=?,revision=revision+1 WHERE project=? AND revision=?').bind(encode(exported),project,stored.revision).run()
   :await control.prepare('INSERT INTO project_sql(project,image,revision) VALUES(?,?,1) ON CONFLICT(project) DO NOTHING').bind(project,encode(exported)).run();
  if(!result.meta.changes)throw new SqlError('Another query changed this project at the same time. Refresh and run again; your changes were not saved.',409);
 }
 return payload;
}
