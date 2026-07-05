import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import {
  getProfile,
  updateDisplayName,
  updatePlanetSeed,
  updateStatusMessage,
} from '@/lib/supabase';

export interface ProfileData {
  id: string;
  displayName: string;
  /** 결정적 uint32 시드. 모든 행성은 시드 → 트레잇 → 픽셀 사양. */
  planetSeed: number;
  statusMessage: string | null;
}

export function useProfileQuery(userId: string) {
  return useQuery({
    queryKey: queryKeys.profile(userId),
    queryFn: async (): Promise<ProfileData> => {
      const data = await getProfile(userId);
      return {
        id: data.id,
        displayName: data.display_name,
        planetSeed: (data.planet_seed ?? 0) >>> 0,
        statusMessage: data.status_message ?? null,
      };
    },
    enabled: !!userId,
  });
}

export function useUpdateProfile(userId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.profile(userId);

  return useMutation({
    mutationFn: async (displayName: string) => {
      await updateDisplayName(userId, displayName);
    },
    onMutate: async (displayName) => {
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<ProfileData>(key);
      queryClient.setQueryData<ProfileData>(key, (old) =>
        old ? { ...old, displayName } : old,
      );
      return { prev: prev ?? null };
    },
    onError: (_err, _name, context: { prev: ProfileData | null } | undefined) => {
      if (context?.prev) queryClient.setQueryData(key, context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

/**
 * 행성 시드 갱신 (RerollModal 의 "적용하기" 가 호출).
 * - 낙관적 업데이트: 캐시의 planetSeed 를 새 시드로 즉시 반영.
 * - 실패 시 롤백: onError 가 prev 로 복원.
 * - settle 후 refetch: DB 진실과 캐시 일치 보장.
 *
 * 동일 mutation 을 RerollModal 이 재사용한다 (AGENTS.md 의 cache 일관성 규약).
 */
export function useUpdatePlanetSeed(userId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.profile(userId);

  return useMutation({
    mutationFn: async (planetSeed: number) => {
      const { error } = await updatePlanetSeed(userId, planetSeed);
      if (error) throw error;
    },
    onMutate: async (planetSeed) => {
      const next = (planetSeed >>> 0);
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<ProfileData>(key);
      queryClient.setQueryData<ProfileData>(key, (old) =>
        old ? { ...old, planetSeed: next } : old,
      );
      return { prev: prev ?? null };
    },
    onError: (_err, _seed, context: { prev: ProfileData | null } | undefined) => {
      if (context?.prev) queryClient.setQueryData(key, context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useUpdateStatusMessage(userId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.profile(userId);

  return useMutation({
    mutationFn: async (statusMessage: string) => {
      const { error } = await updateStatusMessage(userId, statusMessage);
      if (error) throw error;
    },
    onMutate: async (raw) => {
      const trimmed = raw.trim();
      const next = trimmed.length === 0 ? null : trimmed;
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<ProfileData>(key);
      queryClient.setQueryData<ProfileData>(key, (old) =>
        old ? { ...old, statusMessage: next } : old,
      );
      return { prev: prev ?? null };
    },
    onError: (_err, _raw, context: { prev: ProfileData | null } | undefined) => {
      if (context?.prev) queryClient.setQueryData(key, context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
