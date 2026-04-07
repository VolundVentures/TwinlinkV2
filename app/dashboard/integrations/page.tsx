"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plug,
  Unplug,
  Instagram,
  Linkedin,
  Check,
} from "lucide-react";
import type { Platform } from "@/lib/integrations/types";
import { ALL_PLATFORMS, PLATFORM_META } from "@/lib/integrations/types";
import { spring, staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Connection = {
  id: string;
  platform: string;
  account_name: string | null;
  account_id: string | null;
  account_avatar_url: string | null;
  created_at: string;
};

function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  switch (platform) {
    case "instagram": return <Instagram className={className} />;
    case "linkedin": return <Linkedin className={className} />;
    case "tiktok": return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.42a8.16 8.16 0 004.76 1.52V7.5a4.85 4.85 0 01-1-.81z" />
      </svg>
    );
    case "x": return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }
}

const PLATFORM_DESCRIPTIONS: Record<Platform, string> = {
  instagram: "Share photos, reels, and stories directly to your Instagram Business profile.",
  tiktok: "Publish short-form videos to your TikTok Business or Creator account.",
  linkedin: "Post professional content to your LinkedIn company page or profile.",
  x: "Share posts and threads to your X (formerly Twitter) account.",
};

const PLATFORM_COLORS: Record<Platform, string> = {
  instagram: "#E4405F",
  tiktok: "#00F2EA",
  linkedin: "#0A66C2",
  x: "#1A1A1A",
};

export default function IntegrationsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchConnections() {
      try {
        const res = await fetch("/api/integrations/connections");
        if (res.ok) { const data = await res.json(); setConnections(data.connections ?? []); }
      } catch {} finally { setLoading(false); }
    }
    fetchConnections();
  }, []);

  const connectionsByPlatform = new Map<string, Connection>();
  for (const conn of connections) connectionsByPlatform.set(conn.platform, conn);

  return (
    <div className="px-8 py-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[#1A1A1A]">Integrations</h1>
        <p className="text-[15px] text-[#6B7280] mt-1">
          Connect your social media accounts to publish directly from TwinLink.
        </p>
      </div>

      {/* Platform cards */}
      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid gap-4 sm:grid-cols-2">
        {ALL_PLATFORMS.map((platform) => {
          const meta = PLATFORM_META[platform];
          const connection = connectionsByPlatform.get(platform);
          const isConnected = !!connection;
          const color = PLATFORM_COLORS[platform];

          return (
            <motion.div key={platform} variants={staggerItem}>
              <div className="relative overflow-hidden rounded-2xl bg-white p-6 border border-[#E5E7EB] transition-all hover:shadow-md hover:-translate-y-0.5">

                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}12` }}>
                      <PlatformIcon platform={platform} className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-[16px] font-bold text-[#1A1A1A]">{meta.name}</h3>
                      {isConnected ? (
                        <span className="inline-flex items-center gap-1 text-[12px] text-[#4D5D4B] font-semibold mt-0.5">
                          <Check className="h-3 w-3" /> Connected
                        </span>
                      ) : (
                        <span className="text-[12px] text-[#9CA3AF] mt-0.5">Not connected</span>
                      )}
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-10 w-full rounded-xl" />
                  </div>
                ) : isConnected ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 bg-[#F3F4F6] rounded-xl p-3">
                      {connection.account_avatar_url ? (
                        <img src={connection.account_avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-[#1A1A1A] flex items-center justify-center text-white text-[11px] font-bold">
                          {(connection.account_name || "?")[0].toUpperCase()}
                        </div>
                      )}
                      <span className="text-[14px] font-semibold text-[#1A1A1A] truncate">
                        {connection.account_name || connection.account_id}
                      </span>
                    </div>
                    <button className="flex items-center justify-center gap-2 w-full py-2.5 border border-[#E5E7EB] rounded-full text-[13px] font-medium text-[#6B7280] hover:text-[#EF4444] hover:border-[#EF4444]/30 transition-colors">
                      <Unplug className="h-3.5 w-3.5" /> Disconnect
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-[14px] text-[#6B7280] leading-relaxed">
                      {PLATFORM_DESCRIPTIONS[platform]}
                    </p>
                    <button
                      onClick={() => window.open(`/api/integrations/${platform}/connect`, "_blank")}
                      className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#1A1A1A] text-white rounded-full text-[13px] font-semibold hover:bg-[#333] transition-colors"
                    >
                      <Plug className="h-3.5 w-3.5" /> Connect {meta.name}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Coming soon */}
      <div className="rounded-2xl border border-[#F0F0F0] p-8 text-center">
        <p className="text-[16px] font-semibold text-[#1A1A1A] mb-1">More integrations coming soon</p>
        <p className="text-[14px] text-[#6B7280]">YouTube, Pinterest, Snapchat, and custom webhooks</p>
      </div>
    </div>
  );
}
