"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/use-translations";
import {
  Video,
  Mic,
  Camera,
  Smartphone,
  Monitor,
  Sparkles,
  Clock,
  Play,
  AlertCircle,
  Loader2,
} from "lucide-react";

const categories = [
  { label: "All", value: "all" },
  { label: "AI UGC", value: "ugc" },
  { label: "Hooks", value: "hooks" },
  { label: "Product", value: "product" },
  { label: "Testimonial", value: "testimonial" },
];

const templates = [
  {
    id: "1", name: "Speaking Character", category: "ugc",
    description: "Character speaks directly to camera delivering a scripted message, ideal for UGC-style ads.",
    icon: Mic, duration: "15-60s", aspect: "9:16", is_premium: false,
    gradient: "from-black/[0.04] to-black/[0.02]",
  },
  {
    id: "2", name: "Talking Head", category: "ugc",
    description: "Character delivers your script with a transparent background. Perfect for overlay on product footage.",
    icon: Video, duration: "15-45s", aspect: "9:16", is_premium: false,
    gradient: "from-black/[0.06] to-black/[0.02]",
  },
  {
    id: "3", name: "POV Hook Video", category: "hooks",
    description: "First-person POV style video delivering a hook directly to camera. Captures attention instantly.",
    icon: Camera, duration: "5-15s", aspect: "9:16", is_premium: false,
    gradient: "from-black/[0.03] to-black/[0.01]",
  },
  {
    id: "4", name: "Spoken Hook Mobile", category: "hooks",
    description: "Character delivers a clear opening hook for mobile app ads. Designed for instant attention capture.",
    icon: Smartphone, duration: "5-10s", aspect: "9:16", is_premium: false,
    gradient: "from-black/[0.05] to-black/[0.02]",
  },
  {
    id: "5", name: "Product Showcase", category: "product",
    description: "AI generates cinematic product showcase with voiceover. Perfect for e-commerce and DTC brands.",
    icon: Monitor, duration: "15-30s", aspect: "1:1", is_premium: true,
    gradient: "from-black/[0.04] to-black/[0.01]",
  },
  {
    id: "6", name: "Testimonial Story", category: "testimonial",
    description: "AI avatar delivers a customer testimonial story. Authentic feel with professional production quality.",
    icon: Sparkles, duration: "30-60s", aspect: "9:16", is_premium: true,
    gradient: "from-black/[0.06] to-black/[0.03]",
  },
];

type Brand = {
  id: string;
  name: string;
  is_default?: boolean;
};

export default function TemplatesPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState("all");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);

  useEffect(() => {
    async function fetchBrands() {
      try {
        const res = await fetch("/api/brands");
        if (!res.ok) throw new Error("Failed to fetch brands");
        const data = await res.json();
        setBrands(data.brands || []);
      } catch (err) {
        console.error("Error fetching brands:", err);
        setBrands([]);
      } finally {
        setBrandsLoading(false);
      }
    }
    fetchBrands();
  }, []);

  const defaultBrandId =
    brands.find((b) => b.is_default)?.id || brands[0]?.id || "";

  function handleUseTemplate(template: (typeof templates)[number]) {
    if (!defaultBrandId) {
      router.push("/dashboard/brands");
      return;
    }

    const prompt = `Create a ${template.name.toLowerCase()} video ad. ${template.description}`;

    const params = new URLSearchParams({
      type: "ugc_video",
      brandId: defaultBrandId,
      prompt,
    });

    router.push(`/dashboard/generate?${params.toString()}`);
  }

  const filtered = activeCategory === "all"
    ? templates
    : templates.filter((t) => t.category === activeCategory);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.nav.templates}</h1>
        <p className="mt-1 text-sm text-black/40">
          Pre-built video ad formats. Select a template, choose a character, and generate.
        </p>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setActiveCategory(cat.value)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-xs font-medium transition-all border",
              activeCategory === cat.value
                ? "bg-[#0a0a0a] text-white border-[#0a0a0a]"
                : "bg-[#f5f5f5] text-[#0a0a0a] border-[#e5e5e5] hover:bg-[#e5e5e5]"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* No brands warning */}
      {!brandsLoading && brands.length === 0 && (
        <div className="rounded-xl border border-black/10 bg-black/[0.02] p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-black/40 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">No brand found</p>
            <p className="text-xs text-black/40 mt-0.5">
              You need to add a brand before using templates.{" "}
              <Link href="/dashboard/brands" className="underline text-black/60 hover:text-black">
                Add a brand
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* Template grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((template) => {
          const Icon = template.icon;
          return (
            <div
              key={template.id}
              className="group relative rounded-xl border border-black/[0.06] bg-white overflow-hidden"
            >
              {/* Visual preview area */}
              <div className={cn(
                "relative aspect-video flex items-center justify-center bg-gradient-to-br",
                template.gradient
              )}>
                <Icon className="h-10 w-10 text-black/20" />

                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm">
                    <Play className="h-5 w-5 text-black ms-0.5" />
                  </div>
                </div>

                {/* Aspect ratio badge */}
                <div className="absolute top-3 start-3">
                  <Badge className="bg-white/80 backdrop-blur-sm text-black text-[10px] border border-black/10">
                    {template.aspect}
                  </Badge>
                </div>

                {template.is_premium && (
                  <div className="absolute top-3 end-3">
                    <Badge className="bg-black text-white text-[10px] border-0">
                      PRO
                    </Badge>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{template.name}</h3>
                  <span className="flex items-center gap-1 text-[10px] text-black/30">
                    <Clock className="h-3 w-3" />
                    {template.duration}
                  </span>
                </div>
                <p className="text-xs text-black/40 leading-relaxed line-clamp-2">
                  {template.description}
                </p>

                <Button
                  size="sm"
                  className="w-full mt-2 bg-black/[0.03] hover:bg-black/[0.06] text-black/70 border border-black/10 text-xs"
                  disabled={brandsLoading}
                  onClick={() => handleUseTemplate(template)}
                >
                  {brandsLoading ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      Loading...
                    </>
                  ) : (
                    "Use Template"
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
