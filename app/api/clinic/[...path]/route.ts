import {ZodError} from 'zod';
import {session,login,logout,forgot,reset,users} from '@/lib/clinic/auth';
import {assertCsrf,assertOrigin} from '@/lib/clinic/security';
import {ClinicError} from '@/lib/clinic/permissions';
import {photos} from '@/lib/clinic/uploads';
import {dispatchClinic} from '@/lib/clinic/service';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
async function handle(request:Request,context:{params:Promise<{path:string[]}>}){try{const {path}=await context.params;const mutation=!['GET','HEAD'].includes(request.method);if(mutation)assertOrigin(request);if(path[0]==='auth'){
 if(path[1]==='login'&&request.method==='POST'){const result=await login(request);return Response.json(result.data,{headers:{...headers,'Set-Cookie':result.cookie}});}
 if(path[1]==='forgot'&&request.method==='POST')return Response.json(await forgot(request),{headers});
 if(path[1]==='reset'&&request.method==='POST')return Response.json(await reset(request),{headers});
 const current=await session(request);if(path[1]==='session'&&request.method==='GET')return Response.json(current,{headers});
 if(path[1]==='logout'&&request.method==='POST'){assertCsrf(request,current.csrfToken);return Response.json({ok:true},{headers:{...headers,'Set-Cookie':await logout(request,current.user)}});}
 throw new ClinicError('Rota não encontrada.',404);
 }
 const current=await session(request);if(mutation)assertCsrf(request,current.csrfToken);
 const data=path[0]==='users'?await users(request,path,current.user):path[0]==='photos'?await photos(request,path,current.user):await dispatchClinic(request,path,current.user);
 if(data instanceof Response)return data;return Response.json(data,{headers});
 }catch(error){if(error instanceof ClinicError)return Response.json({error:error.message,code:error.code},{status:error.status,headers});if(error instanceof ZodError)return Response.json({error:error.issues.map(x=>`${x.path.join('.')}: ${x.message}`).join(';'),code:'VALIDATION'},{status:422,headers});const e=error as {code?:string;status?:number;message?:string};if(e.code==='ER_DUP_ENTRY')return Response.json({error:'Já existe um registro com esses dados.',code:'DUPLICATE'},{status:409,headers});if(e.code?.startsWith('ER_NO_REFERENCED')||e.code?.startsWith('ER_ROW_IS_REFERENCED'))return Response.json({error:'Registro relacionado inexistente ou em uso.',code:'RELATIONSHIP'},{status:409,headers});if(e.status&&e.status>=400&&e.status<500)return Response.json({error:e.message||'Operação inválida.'},{status:e.status,headers});console.error('clinic_request_failed',{code:e.code||'INTERNAL'});return Response.json({error:'Não foi possível concluir a operação.',code:'INTERNAL'},{status:500,headers});}}
export {handle as GET,handle as POST,handle as PATCH,handle as DELETE};
