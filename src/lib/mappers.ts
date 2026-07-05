import type { Post, Overlay } from '@/types';
import type { PlanetKey } from '@/constants/planets';
import type { FeedRow } from '@/lib/supabase';

export function toPost(row: FeedRow): Post {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_display_name || 'Anonymous',
    authorPlanet: (row.author_planet ?? 'moon') as PlanetKey,
    bgColor: row.bg_color ?? undefined,
    media: row.media_url ?? undefined,
    mediaType: row.media_type ?? undefined,
    overlays: (row.overlays as Overlay[] | null | undefined) ?? undefined,
    systemId: row.system_id,
    systemSlug: row.system_slug ?? undefined,
    systemName: row.system_name ?? undefined,
    createdAt: row.created_at,
  };
}
