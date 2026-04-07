"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  Loader2,
  CheckCircle2,
  Palette,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Package,
  ImageIcon,
  Trash2,
  Plus,
  Link2,
  PenLine,
  Check,
  Camera,
  Upload,
  X,
} from "lucide-react";

/* ============================================
   Types
   ============================================ */

type BrandData = {
  name: string;
  description: string;
  industry: string;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  brand_voice: string;
  target_audience: string;
  products: Array<{
    name: string;
    description: string;
    type: string;
    price?: string;
    image_url?: string;
  }>;
  tagline: string | null;
  key_messages: string[];
};

type ScrapedAssets = {
  screenshot?: string;
  images?: string[];
  logo?: string;
  favicon?: string;
  ogImage?: string;
  colors?: string[];
};

type Props = { orgId: string; userId: string };

/* ============================================
   Animated loading dots
   ============================================ */

function BouncingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-black/40 animate-[bounce_1.4s_ease-in-out_infinite]" />
      <span className="h-1.5 w-1.5 rounded-full bg-black/40 animate-[bounce_1.4s_ease-in-out_0.2s_infinite]" />
      <span className="h-1.5 w-1.5 rounded-full bg-black/40 animate-[bounce_1.4s_ease-in-out_0.4s_infinite]" />
    </span>
  );
}

/* ============================================
   Analysis progress messages
   ============================================ */

function AnalysisProgress() {
  const stages = [
    "Scanning website...",
    "Extracting brand identity...",
    "Finding products...",
    "Downloading assets...",
  ];
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStage((prev) => (prev < stages.length - 1 ? prev + 1 : prev));
    }, 3000);
    return () => clearInterval(interval);
  }, [stages.length]);

  return (
    <div className="w-full max-w-md space-y-3 pt-6">
      {stages.map((stage, i) => (
        <div
          key={stage}
          className={`flex items-center gap-3 text-sm transition-all duration-500 ${
            i < activeStage
              ? "text-black/60"
              : i === activeStage
                ? "text-black"
                : "text-black/20"
          }`}
        >
          {i < activeStage ? (
            <CheckCircle2 className="h-4 w-4 text-black/40 shrink-0" />
          ) : i === activeStage ? (
            <BouncingDots />
          ) : (
            <div className="h-4 w-4 rounded-full border border-black/10 shrink-0" />
          )}
          <span
            className={
              i === activeStage ? "font-medium" : ""
            }
          >
            {stage}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ============================================
   Live Preview Card (Brand Identity)
   ============================================ */

function BrandPreviewCard({
  name,
  description,
  logo,
  primaryColor,
  secondaryColor,
}: {
  name: string;
  description: string;
  logo?: string;
  primaryColor: string;
  secondaryColor: string;
}) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-black/[0.02] p-6 space-y-5">
      <p className="text-[10px] uppercase tracking-widest text-black/30 font-medium">
        Live Preview
      </p>

      {/* Mini ad mock */}
      <div
        className="rounded-xl overflow-hidden shadow-sm"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="p-5 text-white space-y-2">
          <div className="flex items-center gap-2">
            {logo ? (
              <img
                src={logo}
                alt=""
                className="h-6 w-6 rounded object-contain bg-white/20 p-0.5"
              />
            ) : (
              <div className="h-6 w-6 rounded bg-white/20 flex items-center justify-center">
                <Globe className="h-3 w-3 text-white/80" />
              </div>
            )}
            <span className="text-xs font-semibold opacity-90">
              {name || "Your Brand"}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed opacity-70 line-clamp-2">
            {description || "Your brand description will appear here"}
          </p>
        </div>
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{ backgroundColor: secondaryColor || "rgba(0,0,0,0.15)" }}
        >
          <span className="text-[10px] font-medium text-white/80">
            Ad Preview
          </span>
          <div className="h-5 px-3 rounded-full bg-white/20 flex items-center">
            <span className="text-[9px] font-semibold text-white">
              Learn More
            </span>
          </div>
        </div>
      </div>

      {/* Color strip */}
      <div className="flex gap-2">
        {[primaryColor, secondaryColor].filter(Boolean).map((c, i) => (
          <div
            key={i}
            className="flex-1 h-2 rounded-full"
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );
}

/* ============================================
   AddProductInline (restyled)
   ============================================ */

function AddProductInline({
  onAdd,
}: {
  onAdd: (p: BrandData["products"][0]) => void;
}) {
  const [mode, setMode] = useState<"closed" | "manual" | "url">("closed");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [type, setType] = useState("product");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setDesc("");
    setType("product");
    setPrice("");
    setImageUrl("");
    setImportUrl("");
    setImportError(null);
    setMode("closed");
  };

  async function handleImportFromUrl() {
    if (!importUrl.trim()) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch("/api/brands/scrape-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to import");
      onAdd({
        name: data.product.name,
        description: data.product.description || "",
        type: data.product.type || "product",
        price: data.product.price || undefined,
        image_url: data.product.image_url || undefined,
      });
      reset();
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "Failed to import product"
      );
    } finally {
      setImporting(false);
    }
  }

  if (mode === "closed") {
    return (
      <div className="flex gap-3">
        <button
          onClick={() => setMode("url")}
          className="flex-1 flex items-center justify-center gap-2.5 rounded-2xl border border-dashed border-black/[0.08] p-4 text-sm text-black/40 hover:text-black/70 hover:border-black/20 hover:bg-black/[0.01] transition-all duration-200"
        >
          <Link2 className="h-4 w-4" />
          Import from URL
        </button>
        <button
          onClick={() => setMode("manual")}
          className="flex-1 flex items-center justify-center gap-2.5 rounded-2xl border border-dashed border-black/[0.08] p-4 text-sm text-black/40 hover:text-black/70 hover:border-black/20 hover:bg-black/[0.01] transition-all duration-200"
        >
          <PenLine className="h-4 w-4" />
          Add manually
        </button>
      </div>
    );
  }

  if (mode === "url") {
    return (
      <div className="rounded-2xl border border-black/[0.06] bg-black/[0.02] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-black/40" />
            <span className="text-sm font-medium">Import from URL</span>
          </div>
          <button
            onClick={reset}
            className="p-1 rounded-lg hover:bg-black/5 text-black/30 hover:text-black/60 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="https://example.com/product-page"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            className="h-11 rounded-xl border-black/[0.08] flex-1"
            autoFocus
          />
          <Button
            onClick={handleImportFromUrl}
            disabled={importing || !importUrl.trim()}
            className="h-11 px-5 rounded-xl bg-black text-white hover:bg-black/90"
          >
            {importing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Import"
            )}
          </Button>
        </div>
        {importError && (
          <p className="text-xs text-red-500 flex items-center gap-1.5">
            <AlertCircle className="h-3 w-3" />
            {importError}
          </p>
        )}
        {importing && (
          <div className="flex items-center gap-2 text-xs text-black/40">
            <BouncingDots />
            <span>Scraping product page...</span>
          </div>
        )}
      </div>
    );
  }

  // manual mode
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-black/[0.02] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PenLine className="h-4 w-4 text-black/40" />
          <span className="text-sm font-medium">Add product manually</span>
        </div>
        <button
          onClick={reset}
          className="p-1 rounded-lg hover:bg-black/5 text-black/30 hover:text-black/60 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Image upload area */}
      <div className="rounded-xl border-2 border-dashed border-black/[0.08] p-6 text-center hover:border-black/15 transition-colors cursor-pointer">
        {imageUrl ? (
          <div className="flex items-center justify-center gap-3">
            <img
              src={imageUrl}
              alt=""
              className="h-16 w-16 rounded-xl object-cover"
            />
            <button
              onClick={() => setImageUrl("")}
              className="text-xs text-black/40 hover:text-black/60"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Upload className="h-5 w-5 mx-auto text-black/20" />
            <p className="text-xs text-black/30">
              Drop image here or click to upload
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-black/50">Product name</Label>
          <Input
            placeholder="e.g. Premium Plan"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 rounded-xl border-black/[0.08]"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-black/50">Description</Label>
          <Input
            placeholder="Short description"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="h-11 rounded-xl border-black/[0.08]"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-black/50">Type</Label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-11 w-full rounded-xl border border-black/[0.08] px-3 text-sm bg-white focus:border-black/20 focus:ring-1 focus:ring-black/10 outline-none transition-all"
            >
              <option value="product">Product</option>
              <option value="service">Service</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-black/50">Price (optional)</Label>
            <Input
              placeholder="$29/mo"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="h-11 rounded-xl border-black/[0.08]"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-black/50">Image URL (optional)</Label>
          <Input
            placeholder="https://..."
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="h-11 rounded-xl border-black/[0.08]"
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <Button
          variant="outline"
          onClick={reset}
          className="h-10 rounded-xl px-4"
        >
          Cancel
        </Button>
        <Button
          disabled={!name.trim()}
          onClick={() => {
            onAdd({
              name,
              description: desc || "",
              type,
              price: price || undefined,
              image_url: imageUrl || undefined,
            });
            reset();
          }}
          className="h-10 rounded-xl px-5 bg-black text-white hover:bg-black/90"
        >
          <Plus className="h-4 w-4 me-1.5" />
          Add Product
        </Button>
      </div>
    </div>
  );
}

/* ============================================
   Confetti dots (success step)
   ============================================ */

function ConfettiDots() {
  return (
    <div className="relative h-32 w-32 mx-auto">
      {/* Central checkmark */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-20 w-20 rounded-full bg-black flex items-center justify-center">
          <Check className="h-10 w-10 text-white" strokeWidth={2.5} />
        </div>
      </div>
      {/* Dots around the checkmark */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i * 30 * Math.PI) / 180;
        const radius = 52 + (i % 3) * 6;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const size = 3 + (i % 3) * 2;
        const opacity = 0.15 + (i % 4) * 0.08;
        return (
          <div
            key={i}
            className="absolute rounded-full bg-black animate-pulse"
            style={{
              width: size,
              height: size,
              left: `calc(50% + ${x}px - ${size / 2}px)`,
              top: `calc(50% + ${y}px - ${size / 2}px)`,
              opacity,
              animationDelay: `${i * 0.15}s`,
              animationDuration: "2s",
            }}
          />
        );
      })}
    </div>
  );
}

/* ============================================
   Main Wizard
   ============================================ */

export function OnboardingWizard({ orgId }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [brandData, setBrandData] = useState<BrandData | null>(null);
  const [assets, setAssets] = useState<ScrapedAssets | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedBrandId, setSavedBrandId] = useState<string | null>(null);

  // Editable fields
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editProducts, setEditProducts] = useState<BrandData["products"]>([]);
  const [editIndustry, setEditIndustry] = useState("");
  const [editVoice, setEditVoice] = useState("");
  const [editPrimaryColor, setEditPrimaryColor] = useState("#000000");
  const [editSecondaryColor, setEditSecondaryColor] = useState("#333333");
  const [editAccentColor, setEditAccentColor] = useState("#666666");

  const colorInputPrimaryRef = useRef<HTMLInputElement>(null);
  const colorInputSecondaryRef = useRef<HTMLInputElement>(null);
  const colorInputAccentRef = useRef<HTMLInputElement>(null);

  const totalSteps = 5; // 0-4
  const progressPercent = (step / (totalSteps - 1)) * 100;

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!url) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/brands/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");

      setBrandData(data.brand);
      setAssets(data.assets || null);
      setEditName(data.brand.name || "");
      setEditDescription(data.brand.description || "");
      setEditProducts(data.brand.products || []);
      setEditIndustry(data.brand.industry || "");
      setEditVoice(data.brand.brand_voice || "");
      setEditPrimaryColor(data.brand.primary_color || "#000000");
      setEditSecondaryColor(data.brand.secondary_color || "#333333");
      setEditAccentColor(data.brand.accent_color || "#666666");
      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!brandData) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName || brandData.name,
          website_url: url,
          logo_url: assets?.logo || null,
          description: editDescription || brandData.description,
          primary_color: editPrimaryColor,
          secondary_color: editSecondaryColor,
          accent_color: editAccentColor,
          industry: editIndustry || brandData.industry,
          target_audience: brandData.target_audience,
          brand_voice: editVoice || brandData.brand_voice,
          products: editProducts,
          scraped_data: {
            tagline: brandData.tagline,
            key_messages: brandData.key_messages,
            images: assets?.images || [],
            screenshot: assets?.screenshot || null,
            favicon: assets?.favicon || null,
            colors: assets?.colors || [],
          },
          is_default: true,
        }),
      });

      if (!res.ok) throw new Error("Failed to save brand");
      const { brand: saved } = await res.json();
      setSavedBrandId(saved.id);
      setStep(4); // Go to success step
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* ---- Progress bar (thin top bar) ---- */}
      <div className="w-full h-1 bg-black/[0.04] rounded-full mb-8 overflow-hidden">
        <div
          className="h-full bg-black rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* ===================================================
          Step 0: Website URL Entry
          =================================================== */}
      {step === 0 && (
        <div className="flex flex-col items-center text-center py-16 space-y-10">
          {/* TwinLink logo area */}
          <div className="space-y-1">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black mx-auto">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight">
              Let&apos;s set up your brand
            </h1>
            <p className="text-base text-black/50 max-w-lg leading-relaxed">
              We&apos;ll analyze your website to extract everything
              automatically — brand identity, colors, products, and assets.
            </p>
          </div>

          <form
            onSubmit={handleAnalyze}
            className="w-full max-w-md space-y-4"
          >
            <div className="relative">
              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-black/30" />
              <Input
                type="url"
                placeholder="https://your-brand.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                autoFocus
                className="h-14 text-base pl-12 rounded-2xl border-black/[0.08] focus:border-black/20 focus:ring-1 focus:ring-black/10"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 rounded-xl text-base bg-black text-white hover:bg-black/90 transition-all duration-200"
              disabled={loading || !url}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <BouncingDots />
                  <span>Analyzing...</span>
                </span>
              ) : (
                <>
                  Analyze
                  <ArrowRight className="ms-2 h-4 w-4" />
                </>
              )}
            </Button>

            <button
              type="button"
              className="text-xs text-black/30 hover:text-black/60 transition-colors duration-200"
              onClick={() => router.push("/dashboard")}
            >
              Skip for now
            </button>
          </form>

          {loading && <AnalysisProgress />}
        </div>
      )}

      {/* ===================================================
          Step 1: Brand Identity Review
          =================================================== */}
      {step === 1 && brandData && (
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Brand Identity
              </h2>
              <p className="text-sm text-black/50 mt-1">
                Review and refine your brand details
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setStep(0);
                setBrandData(null);
              }}
              className="rounded-xl h-10 px-4"
            >
              <ArrowLeft className="h-3.5 w-3.5 me-1.5" />
              Re-analyze
            </Button>
          </div>

          {/* Split layout */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* LEFT: 60% — Editable fields */}
            <div className="lg:col-span-3 space-y-6">
              {/* Logo + Name */}
              <div className="flex items-start gap-5">
                {/* Logo */}
                <div className="relative group shrink-0">
                  {assets?.logo ? (
                    <img
                      src={assets.logo}
                      alt="Logo"
                      className="h-20 w-20 rounded-2xl object-contain border border-black/[0.06] bg-white p-2"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-2xl bg-black/[0.03] border border-black/[0.06] flex items-center justify-center">
                      <Globe className="h-8 w-8 text-black/15" />
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center cursor-pointer">
                    <Camera className="h-5 w-5 text-white" />
                  </div>
                </div>

                {/* Brand name */}
                <div className="flex-1 space-y-2 pt-1">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="text-2xl font-semibold h-12 border-0 border-b border-black/[0.06] rounded-none px-0 focus:ring-0 focus:border-black/20 tracking-tight bg-transparent"
                    placeholder="Brand name"
                  />
                  {/* Industry + Voice badges */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {editIndustry && (
                      <Badge
                        variant="secondary"
                        className="text-[11px] px-3 py-1 rounded-lg cursor-pointer hover:bg-black/10 transition-colors"
                      >
                        {editIndustry}
                      </Badge>
                    )}
                    {editVoice && (
                      <Badge
                        variant="outline"
                        className="text-[11px] px-3 py-1 rounded-lg cursor-pointer hover:bg-black/5 transition-colors"
                      >
                        {editVoice}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Description with character count */}
              <div className="space-y-2">
                <Label className="text-xs text-black/40 uppercase tracking-wider font-medium">
                  Description
                </Label>
                <div className="relative">
                  <Textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="min-h-[100px] text-sm leading-relaxed rounded-xl border-black/[0.08] focus:border-black/20 focus:ring-1 focus:ring-black/10 resize-none"
                  />
                  <span className="absolute bottom-2 right-3 text-[10px] text-black/25">
                    {editDescription.length}/500
                  </span>
                </div>
              </div>

              {/* Colors */}
              <div className="space-y-3">
                <Label className="text-xs text-black/40 uppercase tracking-wider font-medium flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5" /> Brand Colors
                </Label>
                <div className="flex gap-4">
                  {[
                    {
                      label: "Primary",
                      color: editPrimaryColor,
                      setter: setEditPrimaryColor,
                      ref: colorInputPrimaryRef,
                    },
                    {
                      label: "Secondary",
                      color: editSecondaryColor,
                      setter: setEditSecondaryColor,
                      ref: colorInputSecondaryRef,
                    },
                    {
                      label: "Accent",
                      color: editAccentColor,
                      setter: setEditAccentColor,
                      ref: colorInputAccentRef,
                    },
                  ].map((c) => (
                    <div
                      key={c.label}
                      className="flex flex-col items-center gap-2 cursor-pointer group"
                      onClick={() => c.ref.current?.click()}
                    >
                      <div
                        className="h-14 w-14 rounded-full border-2 border-black/[0.06] shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-200"
                        style={{ backgroundColor: c.color }}
                      />
                      <input
                        ref={c.ref}
                        type="color"
                        value={c.color}
                        onChange={(e) => c.setter(e.target.value)}
                        className="sr-only"
                      />
                      <div className="text-center">
                        <p className="text-[10px] text-black/40">{c.label}</p>
                        <p className="text-[10px] font-mono text-black/60">
                          {c.color}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Target Audience */}
              {brandData.target_audience && (
                <div className="rounded-2xl border border-black/[0.06] bg-black/[0.02] p-5">
                  <Label className="text-xs text-black/40 uppercase tracking-wider font-medium">
                    Target Audience
                  </Label>
                  <p className="text-sm mt-2 text-black/70 leading-relaxed">
                    {brandData.target_audience}
                  </p>
                </div>
              )}
            </div>

            {/* RIGHT: 40% — Preview */}
            <div className="lg:col-span-2">
              <div className="sticky top-8">
                <BrandPreviewCard
                  name={editName}
                  description={editDescription}
                  logo={assets?.logo}
                  primaryColor={editPrimaryColor}
                  secondaryColor={editSecondaryColor}
                />
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => setStep(2)}
              className="flex-1 h-12 rounded-xl bg-black text-white hover:bg-black/90 text-base transition-all duration-200"
            >
              Next: Products
              <ArrowRight className="ms-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ===================================================
          Step 2: Products
          =================================================== */}
      {step === 2 && brandData && (
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold tracking-tight">
                Products & Services
              </h2>
              {editProducts.length > 0 && (
                <span className="inline-flex items-center justify-center h-6 min-w-[24px] px-2 rounded-full bg-black text-white text-xs font-medium">
                  {editProducts.length}
                </span>
              )}
            </div>
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              className="rounded-xl h-10 px-4"
            >
              <ArrowLeft className="h-3.5 w-3.5 me-1.5" />
              Back
            </Button>
          </div>

          <p className="text-sm text-black/50 -mt-4">
            Review extracted products or add new ones manually or by URL.
          </p>

          {/* Product list */}
          {editProducts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-black/[0.08] py-16 text-center">
              <Package className="h-12 w-12 mx-auto text-black/10 mb-4" />
              <p className="text-sm text-black/40 mb-1">
                No products found on your website
              </p>
              <p className="text-xs text-black/25">
                Add them manually or import from a URL below
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {editProducts.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 rounded-2xl border border-black/[0.06] p-4 group hover:shadow-sm hover:border-black/[0.1] transition-all duration-200"
                >
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="h-16 w-16 rounded-xl object-cover border border-black/[0.06]"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-xl bg-black/[0.03] border border-black/[0.06] flex items-center justify-center shrink-0">
                      <Package className="h-6 w-6 text-black/15" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-black/40 truncate mt-0.5">
                      {p.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {p.price && (
                        <span className="text-xs font-medium text-black/70 bg-black/[0.04] px-2 py-0.5 rounded-md">
                          {p.price}
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className="text-[10px] rounded-md"
                      >
                        {p.type}
                      </Badge>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setEditProducts(
                        editProducts.filter((_, idx) => idx !== i)
                      )
                    }
                    className="p-2 rounded-xl hover:bg-red-50 text-black/15 hover:text-red-500 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add product */}
          <AddProductInline
            onAdd={(p) => setEditProducts([...editProducts, p])}
          />

          {/* Navigation */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => setStep(3)}
              className="flex-1 h-12 rounded-xl bg-black text-white hover:bg-black/90 text-base transition-all duration-200"
            >
              Next: Review Assets
              <ArrowRight className="ms-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ===================================================
          Step 3: Assets Review
          =================================================== */}
      {step === 3 && brandData && (
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Website Assets
              </h2>
              <p className="text-sm text-black/50 mt-1">
                {(assets?.images || []).length} images scraped from your website
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setStep(2)}
              className="rounded-xl h-10 px-4"
            >
              <ArrowLeft className="h-3.5 w-3.5 me-1.5" />
              Back
            </Button>
          </div>

          {/* Screenshot with browser frame */}
          {assets?.screenshot && (
            <div className="rounded-2xl border border-black/[0.06] overflow-hidden shadow-sm">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3 bg-black/[0.03] border-b border-black/[0.06]">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-black/10" />
                  <div className="h-2.5 w-2.5 rounded-full bg-black/10" />
                  <div className="h-2.5 w-2.5 rounded-full bg-black/10" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="h-6 rounded-md bg-black/[0.04] flex items-center px-3">
                    <span className="text-[10px] text-black/30 truncate">
                      {url}
                    </span>
                  </div>
                </div>
              </div>
              <img
                src={assets.screenshot}
                alt="Website screenshot"
                className="w-full"
              />
            </div>
          )}

          {/* Image grid */}
          {(assets?.images || []).length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {(assets?.images || []).slice(0, 20).map((img, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-black/[0.06] overflow-hidden aspect-square bg-black/[0.02] group cursor-pointer"
                >
                  <img
                    src={img}
                    alt={`Asset ${i + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Summary banner */}
          <div className="rounded-2xl border border-black/[0.06] bg-black/[0.02] p-6 flex items-center gap-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black shrink-0">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Ready to go</p>
              <p className="text-xs text-black/50 mt-0.5">
                {editName} &mdash; {editProducts.length} product
                {editProducts.length !== 1 ? "s" : ""} &mdash;{" "}
                {(assets?.images || []).length} asset
                {(assets?.images || []).length !== 1 ? "s" : ""}
              </p>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-12 px-8 rounded-xl bg-black text-white hover:bg-black/90 text-sm font-medium transition-all duration-200 shrink-0"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Save & Start Creating
                </span>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ===================================================
          Step 4: Success / Complete
          =================================================== */}
      {step === 4 && (
        <div className="flex flex-col items-center text-center py-16 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <ConfettiDots />

          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200">
              Your brand is ready!
            </h1>
            <p className="text-base text-black/50 max-w-md leading-relaxed animate-in fade-in duration-500 delay-500">
              We&apos;ve saved everything. You can start creating content right
              away.
            </p>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-4 w-full max-w-md">
            {[
              {
                label: "Products",
                value: editProducts.length,
                icon: Package,
              },
              {
                label: "Assets",
                value: (assets?.images || []).length,
                icon: ImageIcon,
              },
              {
                label: "Colors",
                value: [editPrimaryColor, editSecondaryColor, editAccentColor]
                  .filter(Boolean).length,
                icon: Palette,
              },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-black/[0.06] bg-black/[0.02] p-5 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500"
                style={{ animationDelay: `${600 + i * 150}ms` }}
              >
                <stat.icon className="h-5 w-5 text-black/30 mx-auto" />
                <p className="text-2xl font-semibold tracking-tight">
                  {stat.value}
                </p>
                <p className="text-xs text-black/40">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-3 animate-in fade-in duration-500" style={{ animationDelay: "1000ms" }}>
            <Button
              onClick={() => router.push("/dashboard")}
              className="h-12 px-8 rounded-xl bg-black text-white hover:bg-black/90 text-base font-medium transition-all duration-200"
            >
              Go to Dashboard
              <ArrowRight className="ms-2 h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard/generate")}
              className="h-12 px-6 rounded-xl border-black/10 text-black/70 hover:bg-black/5 text-base font-medium transition-all duration-200"
            >
              <Sparkles className="me-2 h-4 w-4" />
              Start Creating
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
