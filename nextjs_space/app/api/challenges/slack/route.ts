import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: 'Slack functionality removed' }, { status: 410 });
}
