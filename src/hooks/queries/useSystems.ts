import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { listSystems, getSystemBySlug, createSystem } from '@/lib/supabase';
import type { SystemRow } from '@/lib/supabase';
import type { System } from '@/types';

function toSystem(row: SystemRow): System {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    palette: row.palette,
    creatorId: row.creator_id,
    isDefault: row.is_default,
    createdAt: row.created_at,
  };
}

/** 모든 항성계 목록 (오비트 스트립·생성 모달·배지 해석용 캐시) */
export function useSystems() {
  return useQuery({
    queryKey: queryKeys.systems(),
    queryFn: async () => (await listSystems()).map(toSystem),
  });
}

/** slug → 항성계 (SystemRoute /s/:slug 용) */
export function useSystemBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.system(slug ?? ''),
    queryFn: async () => {
      const row = await getSystemBySlug(slug!);
      return row ? toSystem(row) : null;
    },
    enabled: !!slug,
  });
}

/** 항성계 생성 (open-UGC). 성공 시 systems 목록 무효화. */
export function useCreateSystem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (opts: {
      slug: string;
      name: string;
      description?: string;
      palette: string[];
      creatorId: string;
    }) => {
      const row = await createSystem({
        slug: opts.slug,
        name: opts.name,
        description: opts.description,
        palette: opts.palette,
        creator_id: opts.creatorId,
      });
      return toSystem(row);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.systems() });
    },
  });
}
