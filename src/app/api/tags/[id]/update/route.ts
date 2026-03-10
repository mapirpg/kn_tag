import { NextResponse } from 'next/server';
import { tagService } from '@/lib/tag.service';

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now();
  try {
    const { id } = await props.params;
    console.log(`[tags.update] start tagId=${id}`);
    const locations = await tagService.updateTagLocations(id);
    console.log(
      `[tags.update] success tagId=${id} createdLocations=${locations.length} durationMs=${Date.now() - startedAt}`,
    );
    return NextResponse.json(locations);
  } catch (error: any) {
    console.error(
      `[tags.update] error durationMs=${Date.now() - startedAt} message=${error?.message || 'unknown'}`,
    );
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
