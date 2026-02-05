import { NextResponse } from 'next/server';
import { tagService } from '@/lib/tag.service';

export async function GET() {
  try {
    const tags = await tagService.getTags();
    return NextResponse.json(tags);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, publicKey, privateKey } = body;
    const tag = await tagService.createTag(name, publicKey, privateKey);
    return NextResponse.json(tag);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
