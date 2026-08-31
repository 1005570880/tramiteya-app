import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getRepositoryFactory } from '../../../../lib/repositoryFactory';
import { getUserFromAccessToken, getSupabaseServer } from '../../../../lib/supabaseServerClient';
import { getGuestAccessToken, hashGuestAccessToken } from '../../../../lib/guestAccess';
import { patchInstanceSchema } from '../../../../lib/schemas';

const factory=getRepositoryFactory();
async function getUser(req:NextRequest){const auth=req.headers.get('authorization')||'';const token=auth.replace(/^Bearer\s+/i,'');return token?getUserFromAccessToken(token):null;}

export async function GET(req:NextRequest,{params}:{params:{id:string}}){
  try{
    const user=await getUser(req);
    const inst=await factory.getInstanceRepo().get(params.id);
    if(!inst)return NextResponse.json({error:'Instance not found'},{status:404});

    if(user){
      if(inst.userId!==user.id)return NextResponse.json({error:'Forbidden'},{status:403});
      return NextResponse.json(inst);
    }

    const guestToken=getGuestAccessToken(req);
    if(!guestToken)return NextResponse.json({error:'Token de acceso requerido.',code:'ACCESS_TOKEN_REQUIRED'},{status:401});
    const supabase=getSupabaseServer();
    const {data:row,error}=await supabase.from('procedure_instances').select('id,guest_access_token_hash').eq('id',params.id).maybeSingle();
    if(error)return NextResponse.json({error:error.message},{status:500});
    if(!row || !row.guest_access_token_hash || row.guest_access_token_hash!==hashGuestAccessToken(guestToken))return NextResponse.json({error:'Acceso no autorizado.'},{status:403});
    return NextResponse.json(inst);
  }catch{return NextResponse.json({error:'Unable to fetch instance'},{status:500});}
}

export async function PATCH(req:NextRequest,{params}:{params:{id:string}}){try{const user=await getUser(req);if(!user)return NextResponse.json({error:'Not authenticated'},{status:401});const body=await req.json();const parsed=patchInstanceSchema.safeParse(body);if(!parsed.success)return NextResponse.json({error:'Invalid payload',details:parsed.error.errors},{status:400});const repo=factory.getInstanceRepo();const existing=await repo.get(params.id);if(!existing)return NextResponse.json({error:'Instance not found'},{status:404});if(existing.userId!==user.id)return NextResponse.json({error:'Forbidden'},{status:403});const payload:any=parsed.data;const updated=await repo.update(params.id,payload);if(!updated)return NextResponse.json({error:'Update failed'},{status:500});const docRepo=factory.getDocumentRepo();if(payload.document&&docRepo){try{const previous=docRepo.listByInstance?await docRepo.listByInstance(params.id):[];const requested=Number(payload.document.version)||0;const nextVersion=Math.max(previous.reduce((max:any,d:any)=>Math.max(max,Number(d.version)||0),0)+1,requested||1);const doc={...payload.document,instanceId:params.id,version:nextVersion,sourceVersion:`v${nextVersion}`,meta:{...(payload.document.meta||{}),version:nextVersion,generatedAt:payload.document.generatedAt||new Date().toISOString()}};await docRepo.create(doc);}catch(error){console.error('Document persistence failed',error);return NextResponse.json({error:'Instance updated but document persistence failed'},{status:500});}}return NextResponse.json(updated);}catch{return NextResponse.json({error:'Unable to update instance'} ,{status:500});}}
export async function DELETE(req:NextRequest,{params}:{params:{id:string}}){try{const user=await getUser(req);if(!user)return NextResponse.json({error:'Not authenticated'},{status:401});const repo=factory.getInstanceRepo();const existing=await repo.get(params.id);if(!existing)return NextResponse.json({error:'Instance not found'},{status:404});if(existing.userId!==user.id)return NextResponse.json({error:'Forbidden'},{status:403});const ok=await repo.remove(params.id);return ok?NextResponse.json({data:true}):NextResponse.json({error:'Delete failed'},{status:500});}catch{return NextResponse.json({error:'Unable to remove instance'} ,{status:500});}}
