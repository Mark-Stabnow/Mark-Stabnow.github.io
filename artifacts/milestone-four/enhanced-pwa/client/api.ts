import type {User} from './types';
let csrf='';
export class ApiError extends Error {
  constructor(public status:number,message:string){super(message);}
}
export async function request<T>(url:string,options:RequestInit={}):Promise<T>{
  let response:Response;
  try {response=await fetch(url,{...options,credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf,...options.headers}});}
  catch {throw new ApiError(0,'Could not reach the server. Your pending changes are still on this device.');}
  if(response.status===204)return undefined as T;
  const body=await response.json().catch(()=>({error:'The server returned an unreadable response.'}));
  if(!response.ok)throw new ApiError(response.status,body.error??'The request failed.');
  return body as T;
}
export async function signIn(username:string,password:string){
  const result=await request<{user:User;csrf:string}>('/api/login',{method:'POST',body:JSON.stringify({username,password})});
  csrf=result.csrf;return result.user;
}
export async function session(){
  const result=await request<{user:User;csrf:string}>('/api/me');
  csrf=result.csrf;return result.user;
}
export function forgetSession(){csrf='';}
