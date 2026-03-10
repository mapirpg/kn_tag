import { NextResponse } from 'next/server';
import { tagService } from '@/lib/tag.service';

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const locations = await tagService.updateTagLocations(id);
    return NextResponse.json(locations);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
