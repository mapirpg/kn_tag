import { existsSync } from 'fs';
import { join } from 'path';
import { NextResponse } from 'next/server';

export async function GET() {
  const sessionPath = join(process.cwd(), 'apple_session.json');

  return NextResponse.json({
    hasSavedSession: existsSync(sessionPath),
  });
}