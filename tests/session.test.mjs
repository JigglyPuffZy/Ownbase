import {test} from 'node:test';
import assert from 'node:assert/strict';
import {identity,mintSession,checkPassword,configured} from '../lib/session.mjs';
test('Vercel session rejects forged identity, tampered cookies, and missing secrets',()=>{
 const old={...process.env};try{
 process.env.OWNBASE_RUNTIME='vercel';delete process.env.OWNBASE_ADMIN_PASSWORD;delete process.env.OWNBASE_SESSION_SECRET;
 assert.equal(configured(),false);assert.equal(identity(new Request('https://test',{headers:{'oai-authenticated-user-id':'owner'}})),null);
 process.env.OWNBASE_ADMIN_PASSWORD='test-only-password-at-least-16';process.env.OWNBASE_SESSION_SECRET='test-only-secret-at-least-32-characters';
 assert.equal(checkPassword('wrong'),false);assert.equal(checkPassword(process.env.OWNBASE_ADMIN_PASSWORD),true);
 const token=mintSession();const req=t=>new Request('https://test',{headers:{cookie:'ownbase_session='+t}});
 assert.equal(identity(req(token)),'ownbase-owner');assert.equal(identity(req(token+'bad')),null);assert.equal(identity(req('broken')),null);
 process.env.OWNBASE_SESSION_SECRET='rotated-test-secret-at-least-32-characters';assert.equal(identity(req(token)),null);
 }finally{for(const k of ['OWNBASE_RUNTIME','OWNBASE_ADMIN_PASSWORD','OWNBASE_SESSION_SECRET']){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
});
