import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getRepositoryFactory } from '../../../lib/repositoryFactory';
import { getUserFromAccessToken } from '../../../lib/supabaseServerClient';
import { createInstanceSchema } from '../../../lib/schemas';

const factory = getRepositoryFactory();
async function getUser(req: NextRequest) { const auth=req.headers.get('authorization')||''; if(!auth.startsWith('Bearer '))return null; return getUserFromAccessToken(auth.slice(7)); }
export async function GET(req: NextRequest) { try { const user=await getUser(req); if(!user)return NextResponse.json({error:'Not authenticated'},{status:401}); const list=await factory.getInstanceRepo().list(); return NextResponse.json({data:list.filter((i:any)=>i.userId===user.id)}); } catch { return NextResponse.json({error:'Unable to list instances'},{status:500}); } }
export async function POST(req: NextRequest) { try { const user=await getUser(req); const body=await req.json(); const parsed=createInstanceSchema.safeParse(body); if(!parsed.success)return NextResponse.json({error:'Invalid payload',details:parsed.error.errors},{status:400}); const {procedureId,procedureSlug,answers}=parsed.data; const inst=await factory.getInstanceRepo().create(procedureId||procedureSlug,procedureSlug,answers||{},user?.id); return NextResponse.json(inst,{status:201}); } catch { return NextResponse.json({error:'Unable to create instance'},{status:500}); } }
