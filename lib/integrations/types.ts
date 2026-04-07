export type Platform = "instagram" | "tiktok" | "linkedin" | "x";

export type PlatformConnection = {
  id: string;
  platform: Platform;
  accountName: string;
  accountId: string;
  accountAvatarUrl?: string;
};

export type PlatformMeta = {
  name: string;
  color: string;
  icon: string;
};

export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  instagram: { name: "Instagram", color: "#E4405F", icon: "instagram" },
  tiktok: { name: "TikTok", color: "#00F2EA", icon: "tiktok" },
  linkedin: { name: "LinkedIn", color: "#0A66C2", icon: "linkedin" },
  x: { name: "X", color: "#000000", icon: "x" },
};

export const ALL_PLATFORMS: Platform[] = ["instagram", "tiktok", "linkedin", "x"];
