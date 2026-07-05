export const queryKeys = {
  feed: (userId: string, systemId?: string | null) => ['feed', userId, systemId ?? null] as const,
  myPosts: (userId: string) => ['myPosts', userId] as const,
  likedIds: (userId: string) => ['likedIds', userId] as const,
  profile: (userId: string) => ['profile', userId] as const,
  mutualConnections: (userId: string) => ['mutualConnections', userId] as const,
  worldGraph: (userId: string) => ['worldGraph', userId] as const,
  resonances: (userId: string) => ['resonances', userId] as const,
  blockedIds: (userId: string) => ['blockedIds', userId] as const,
  systems: () => ['systems'] as const,
  system: (slug: string) => ['system', slug] as const,
} as const;
