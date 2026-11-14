import {createHmac,createHash,timingSafeEqual} from 'node:crypto';
export const standalone=()=>process.env.VERCEL==='1'||process.env.OWNBASE_RUNTIME==='vercel';
export function sameOrigin(request){try{const origin=request.headers.get('origin');return !!origin&&new URL(origin).host===(request.headers.get('host')||new URL(request.url).host);}catch{return false;}}
const signature=body=>createHmac('sha256',process.env.OWNBASE_SESSION_SECRET||'').update(body).digest('base64url');
const equal=(a,b)=>{const x=createHash('sha256').update(a).digest(),y=createHash('sha256').update(b).digest();return timingSafeEqual(x,y);};
export function configured(){return !!(process.env.OWNBASE_SESSION_SECRET?.length>=32&&process.env.OWNBASE_ADMIN_PASSWORD?.length>=16);}
export function checkPassword(value){return configured()&&typeof value==='string'&&value.length<1024&&equal(value,process.env.OWNBASE_ADMIN_PASSWORD);}
export function mintSession(){if(!configured())throw new Error('Configure administrator authentication first.');const body=Buffer.from(JSON.stringify({sub:'ownbase-owner',exp:Date.now()+8*3600000})).toString('base64url');return body+'.'+signature(body);}
export function identity(request){
 if(!standalone())return request.headers.get('oai-authenticated-user-id');
 if(!configured())return null;
 try{const token=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('ownbase_session='))?.slice(16);if(!token)return null;const [body,sig,...rest]=token.split('.');if(rest.length||!sig||!equal(signature(body),sig))return null;const data=JSON.parse(Buffer.from(body,'base64url').toString());return data.sub==='ownbase-owner'&&data.exp>Date.now()?data.sub:null;}catch{return null;}
}
