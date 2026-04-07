"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Loader2,
  Trash2,
  AlertCircle,
  Plus,
} from "lucide-react";
import { spring, staggerContainer, staggerItem } from "@/lib/motion";
import type { Brand } from "@/lib/database.types";

export default function BrandsPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [addUrl, setAddUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadBrands() {
    try {
      const res = await fetch("/api/brands");
      if (res.ok) { const data = await res.json(); setBrands(data.brands || []); }
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { loadBrands(); }, []);

  async function handleAddBrand(e: React.FormEvent) {
    e.preventDefault();
    if (!addUrl) return;
    setAnalyzing(true); setError(null);
    try {
      const analyzeRes = await fetch("/api/brands/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: addUrl }) });
      if (!analyzeRes.ok) throw new Error("Analysis failed");
      const { brand: brandData, assets } = await analyzeRes.json();
      const saveRes = await fetch("/api/brands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        name: brandData.name, website_url: addUrl, logo_url: assets?.logo || null, description: brandData.description,
        primary_color: brandData.primary_color, secondary_color: brandData.secondary_color, accent_color: brandData.accent_color,
        industry: brandData.industry, target_audience: brandData.target_audience, brand_voice: brandData.brand_voice,
        products: brandData.products || [],
        scraped_data: { tagline: brandData.tagline, key_messages: brandData.key_messages, images: assets?.images || [], screenshot: assets?.screenshot || null, favicon: assets?.favicon || null, ogImage: assets?.ogImage || null, colors: assets?.colors || [] },
        is_default: brands.length === 0,
      }) });
      if (!saveRes.ok) throw new Error("Failed to save brand");
      setAddUrl("");
      loadBrands();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); } finally { setAnalyzing(false); }
  }

  async function handleDeleteBrand(brandId: string) {
    try { await fetch(`/api/brands/${brandId}`, { method: "DELETE" }); setBrands((p) => p.filter((b) => b.id !== brandId)); } catch {}
  }

  function getBrandColors(brand: Brand): string[] {
    const colors: string[] = [];
    if (brand.primary_color) colors.push(brand.primary_color);
    if (brand.secondary_color) colors.push(brand.secondary_color);
    if (brand.accent_color) colors.push(brand.accent_color);
    const scraped = (brand.scraped_data as Record<string, unknown>)?.colors;
    if (Array.isArray(scraped)) scraped.forEach((c) => { if (typeof c === "string" && !colors.includes(c)) colors.push(c); });
    return colors;
  }

  if (loading) {
    return (
      <div className="px-4 sm:px-6 md:px-8 py-6 space-y-8">
        <div className="space-y-2">
          <div className="h-9 w-48 bg-[#F3F4F6] rounded-lg animate-pulse" />
          <div className="h-5 w-36 bg-[#F3F4F6] rounded-lg animate-pulse" />
        </div>
        <div className="h-12 w-full max-w-lg bg-[#F3F4F6] rounded-full animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden border border-[#F0F0F0]">
              <div className="aspect-[16/9] bg-[#F3F4F6] animate-pulse" />
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-[#F3F4F6] animate-pulse" />
                  <div className="h-5 w-32 bg-[#F3F4F6] rounded-lg animate-pulse" />
                </div>
                <div className="h-4 w-24 bg-[#F3F4F6] rounded-lg animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-[32px] font-bold text-[#1A1A1A] tracking-tight">Brands</h1>
        <p className="text-[15px] text-[#6B7280] mt-1">
          {brands.length} brand{brands.length !== 1 ? "s" : ""} configured
        </p>
      </div>

      {/* Add brand form */}
      <form onSubmit={handleAddBrand} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <input
          type="url"
          placeholder="https://your-brand.com"
          value={addUrl}
          onChange={(e) => setAddUrl(e.target.value)}
          required
          disabled={analyzing}
          className="h-12 rounded-full border border-[#E5E7EB] text-[15px] px-5 max-w-lg flex-1 outline-none focus:border-[#4D5D4B] focus:ring-1 focus:ring-[#4D5D4B] transition-colors text-[#1A1A1A] placeholder:text-[#9CA3AF] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={analyzing || !addUrl}
          className="rounded-full bg-[#4D5D4B] text-white text-[14px] font-semibold h-12 px-6 flex items-center gap-2 hover:bg-[#3E4D3C] transition-colors disabled:opacity-50 shrink-0"
        >
          {analyzing ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing...</>
          ) : (
            <><Plus className="h-4 w-4" /> Add Brand</>
          )}
        </button>
      </form>

      {error && (
        <div className="flex items-center gap-2 text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-full px-5 py-3 max-w-lg">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Brand grid */}
      {brands.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-16 w-16 rounded-2xl bg-[#F3F4F6] mb-5 flex items-center justify-center">
            <span className="text-[28px] font-bold text-[#9CA3AF]">?</span>
          </div>
          <h3 className="text-[20px] font-bold text-[#1A1A1A]">No brands yet</h3>
          <p className="mt-2 text-[14px] text-[#6B7280] max-w-sm">
            Add your first brand to start creating ads. We&apos;ll analyze your website automatically.
          </p>
        </div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 gap-5"
        >
          {brands.map((brand) => {
            const colors = getBrandColors(brand);
            const productCount = brand.products?.length || 0;
            const screenshot = (brand.scraped_data as Record<string, unknown>)?.screenshot as string | undefined;
            const ogImage = (brand.scraped_data as Record<string, unknown>)?.ogImage as string | undefined;
            const thumbnail = screenshot || ogImage || null;

            return (
              <motion.div key={brand.id} variants={staggerItem}>
                <div className="relative rounded-2xl overflow-hidden border border-[#F0F0F0] bg-white transition-all duration-200 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 group">
                  {/* Delete button - hover only */}
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteBrand(brand.id); }}
                    className="absolute top-3 right-3 z-10 h-8 w-8 flex items-center justify-center rounded-full bg-white/90 shadow-sm text-[#9CA3AF] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all duration-200"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>

                  {/* Hero image */}
                  <Link href={`/dashboard/brands/${brand.id}`}>
                    <div className="relative aspect-[16/9] overflow-hidden">
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt={brand.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#F3F4F6] to-[#E5E7EB] flex items-center justify-center">
                          <span className="text-[40px] font-bold text-[#D1D5DB]">{brand.name[0]}</span>
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Card body */}
                  <div className="p-5">
                    {/* Brand logo + name + default badge */}
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-10 w-10 rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] bg-[#F3F4F6] p-1 flex items-center justify-center shrink-0 border border-[#F0F0F0]">
                        {brand.logo_url ? (
                          <img src={brand.logo_url} alt="" className="h-full w-full object-contain" />
                        ) : (
                          <span className="text-[14px] font-bold text-[#1A1A1A]">{brand.name[0]}</span>
                        )}
                      </div>
                      <Link href={`/dashboard/brands/${brand.id}`}>
                        <h3 className="text-[18px] font-bold text-[#1A1A1A] hover:underline">{brand.name}</h3>
                      </Link>
                      {brand.is_default && (
                        <span className="text-[10px] font-bold rounded-full bg-[#4D5D4B]/10 text-[#4D5D4B] px-2 py-0.5 shrink-0">
                          Default
                        </span>
                      )}
                    </div>

                    {/* Industry */}
                    {brand.industry && (
                      <p className="text-[14px] text-[#6B7280] mb-3">{brand.industry}</p>
                    )}

                    {/* Stats row */}
                    <div className="flex items-center justify-between pt-3 border-t border-[#F0F0F0]">
                      <span className="text-[13px] text-[#6B7280]">
                        {productCount} product{productCount !== 1 ? "s" : ""}
                      </span>
                      <Link
                        href={`/dashboard/brands/${brand.id}`}
                        className="text-[13px] font-semibold text-[#4D5D4B] hover:text-[#3E4D3C] transition-colors"
                      >
                        Open &rarr;
                      </Link>
                    </div>

                    {/* Brand colors */}
                    {colors.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-[#F0F0F0]">
                        {colors.map((c, i) => (
                          <div
                            key={i}
                            className="h-5 w-5 rounded-full border border-white shadow-[0_0_0_1px_rgba(0,0,0,0.06)]"
                            style={{ backgroundColor: c }}
                            title={c}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
