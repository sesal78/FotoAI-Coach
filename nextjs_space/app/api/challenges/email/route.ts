import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: 'Email functionality removed' }, { status: 410 });
}
