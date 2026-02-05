import { NextResponse } from 'next/server';
import { generateTagKeys } from '@/lib/utils/generateKeys';

export async function POST() {
  try {
    const keys = generateTagKeys();
    return NextResponse.json(keys);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
