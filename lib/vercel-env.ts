import {createClient, type InValue} from '@libsql/client/web';
import {put,get,del} from '@vercel/blob';
let client:ReturnType<typeof createClient>|undefined;
function database(){
 if(!process.env.TURSO_DATABASE_URL||!process.env.TURSO_AUTH_TOKEN)throw new Error('Configure TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.');
 return client??=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
}
export const env={
 DB:{prepare(sql:string){let args:InValue[]=[];return {
  bind(...values:InValue[]){args=values;return this;},
  async all<T>(){const r=await database().execute({sql,args});return {results:r.rows as unknown as T[]};},
  async first<T>(){const r=await database().execute({sql,args});return r.rows[0] as unknown as T|null;},
  async run(){const r=await database().execute({sql,args});return {meta:{changes:r.rowsAffected}};}
 };}},
 BUCKET:{
  async put(path:string,body:ReadableStream,options?:{httpMetadata?:{contentType?:string}}){return put('ownbase/'+path,body,{access:'private',addRandomSuffix:false,contentType:options?.httpMetadata?.contentType});},
  async get(path:string){const r=await get('ownbase/'+path,{access:'private',useCache:false});return r&&r.statusCode===200?{body:r.stream}:null;},
  async delete(path:string){await del('ownbase/'+path);}
 }
};
