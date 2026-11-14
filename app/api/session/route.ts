import {env} from 'cloudflare:workers';
import {checkPassword,configured,mintSession,standalone,sameOrigin} from '../../../lib/session.mjs';
import {createHash} from 'node:crypto';
export async function POST(req:Request){
 if(!standalone())return Response.json({error:'Not available on this host.'},{status:404});
 if(!sameOrigin(req))return Response.json({error:'Origin rejected.'},{status:403});
 const data=await req.formData();
 if(data.get('action')==='logout')return new Response(null,{status:303,headers:{Location:'/login','Set-Cookie':'ownbase_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'}});
 if(!configured())return Response.json({error:'Administrator authentication is not configured. See DEPLOYMENT.md.'},{status:503});
 try{
 const key=createHash('sha256').update((req.headers.get('x-forwarded-for')||'unknown').split(',')[0]).digest('hex'),window=Math.floor(Date.now()/900000);
 const attempts=await env.DB!.prepare('INSERT INTO login_attempts(key,window,attempts) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN window=excluded.window THEN attempts+1 ELSE 1 END, window=excluded.window RETURNING attempts').bind(key,window).first<{attempts:number}>();
 if(!attempts||attempts.attempts>10)return Response.json({error:'Too many sign-in attempts. Try again in 15 minutes.'},{status:429});
 if(!checkPassword(data.get('password')))return new Response(null,{status:303,headers:{Location:'/login?error=1'}});
 return new Response(null,{status:303,headers:{Location:'/?view=sql','Set-Cookie':`ownbase_session=${mintSession()}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`}});
 }catch{return Response.json({error:'Sign-in storage is not ready. Configure the database and apply migrations.'},{status:503});}
}
