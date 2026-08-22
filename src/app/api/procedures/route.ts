import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { procedures } from '../../../data/procedures';
export async function GET(){try{return NextResponse.json({data:procedures})}catch{return NextResponse.json({error:'Unable to list procedures'},{status:500})}}
