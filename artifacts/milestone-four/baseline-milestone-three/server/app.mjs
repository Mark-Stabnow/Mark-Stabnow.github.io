import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppError } from './errors.mjs';
import { credentials, itemInput, adjustment, listInput, uuid } from './validation.mjs';
import { verifyPassword, token, digest, hashPassword } from './passwords.mjs';
const cookieName='warehouse_session';
const publicUser=u=>({id:u.id,username:u.username,role:u.role});
function readToken(req) {
  const raw=(req.headers.cookie??'').split(';').map(s=>s.trim()).find(s=>s.startsWith(`${cookieName}=`))?.slice(cookieName.length+1);
  return raw && /^[a-f0-9]{64}$/.test(raw) ? raw : null;
}

export async function createApp(repository, {origin='http://localhost:4173',secureCookie=false,trustProxy=false}={}) {
  const app=express();
  const dummyHash=await hashPassword('not-a-real-account-password');
  app.disable('x-powered-by');
  if (trustProxy) app.set('trust proxy',1);
  app.use(helmet({contentSecurityPolicy:{directives:{'upgrade-insecure-requests':secureCookie?[]:null}}}));
  app.use(express.json({limit:'16kb'}));
  app.use('/api',(_req,res,next)=>{res.set('Cache-Control','no-store');next();});
  app.use('/api',rateLimit({windowMs:60000,limit:600,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Too many requests. Wait a minute and try again.'}}));
  app.use('/api',(req,_res,next)=> {
    if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.origin!==origin)
      return next(new AppError(403,'Request origin was not accepted.'));
    next();
  });
  app.get('/api/health',async(_req,res)=>{await repository.health();res.json({ok:true});});
  app.post('/api/login',rateLimit({windowMs:15*60000,limit:30,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Too many login attempts. Try again later.'}}),async(req,res)=> {
    const {username,password}=credentials(req.body);
    const user=await repository.findUser(username);
    if (user?.locked_until && new Date(user.locked_until).getTime()>Date.now()) throw new AppError(429,'Sign-in is temporarily unavailable. Wait a minute and try again.');
    const valid=await verifyPassword(password,user?.password_hash??dummyHash);
    if (!user || !valid) {
      if (user) await repository.failLogin(user.id);
      throw new AppError(401,'Username or password was not accepted.');
    }
    await repository.clearFailures(user.id);
    const old=readToken(req); if (old) await repository.endSession(digest(old));
    const raw=token(),csrf=token();
    await repository.startSession(digest(raw),user.id,csrf);
    res.cookie(cookieName,raw,{httpOnly:true,secure:secureCookie,sameSite:'strict',path:'/',maxAge:8*60*60*1000});
    res.json({user:publicUser(user),csrf});
  });
  app.use('/api',async(req,_res,next)=> {
    const raw=readToken(req);
    const user=raw ? await repository.session(digest(raw)) : null;
    if (!user) throw new AppError(401,'Sign in to continue.');
    req.auth={...user,tokenHash:digest(raw)};
    if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.get('X-CSRF-Token')!==user.csrf)
      throw new AppError(403,'The session check failed. Sign in again.');
    next();
  });
  const role=(...allowed)=>(req,_res,next)=>allowed.includes(req.auth.role)?next():next(new AppError(403,'Your account cannot make this change.'));
  app.get('/api/me',(req,res)=>res.json({user:publicUser(req.auth),csrf:req.auth.csrf}));
  app.post('/api/logout',async(req,res)=> {
    await repository.endSession(req.auth.tokenHash);
    res.clearCookie(cookieName,{httpOnly:true,secure:secureCookie,sameSite:'strict',path:'/'});
    res.status(204).end();
  });
  app.get('/api/items',async(req,res)=>res.json(await repository.listItems(listInput(req.query))));
  app.get('/api/items/:id/history',async(req,res)=>res.json({history:await repository.history(uuid(req.params.id))}));
  app.post('/api/items',role('manager'),async(req,res)=>res.status(201).json({item:await repository.createItem(itemInput(req.body),req.auth.id)}));
  app.patch('/api/items/:id',role('manager'),async(req,res)=>res.json({item:await repository.editItem(uuid(req.params.id),itemInput(req.body,true),req.auth.id)}));
  app.post('/api/items/:id/archive',role('manager'),async(req,res)=> {
    const version=req.body?.version;
    if (!Number.isSafeInteger(version) || version<1) throw new AppError(400,'A valid item version is required.');
    await repository.archiveItem(uuid(req.params.id),version,req.auth.id);
    res.status(204).end();
  });
  app.post('/api/items/:id/adjustments',role('manager','clerk'),async(req,res)=>res.json(await repository.adjust(uuid(req.params.id),adjustment(req.body),req.auth.id)));
  app.use('/api',(_req,_res,next)=>next(new AppError(404,'That API route was not found.')));
  const dist=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
  app.use(express.static(dist,{setHeaders:(res,file)=>{if (file.endsWith('sw.js')||file.endsWith('index.html'))res.set('Cache-Control','no-cache');}}));
  app.get('/',(_req,res)=>res.sendFile(path.join(dist,'index.html')));
  app.use((error,_req,res,_next)=> {
    let status=error.status??500,message=error.message;
    if (error.code==='23505') {status=409;message='That SKU or record already exists.';}
    if (['23503','23514','22P02'].includes(error.code)) {status=400;message='The database could not accept those values.';}
    if (status===500) {console.error('Request failed:',error.code??error.name);message='The request could not be saved. Try again.';}
    res.status(status).json({error:message});
  });
  return app;
}
