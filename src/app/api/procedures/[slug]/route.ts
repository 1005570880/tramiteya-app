import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { procedures } from '../../../../data/procedures';
export async function GET(req:NextRequest,{params}:{params:{slug:string}}){const proc=procedures.find(p=>p.slug===params.slug);if(!proc)return NextResponse.json({error:'Procedure not found'},{status:404});return NextResponse.json({data:proc});}
