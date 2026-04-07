"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
  ExternalLink,
  Trash2,
  Palette,
  Quote,
  Package,
  Globe,
  RefreshCw,
  Loader2,
  Copy,
  Check,
  MessageSquareQuote,
  Target,
  FileText,
  Tag,
  Save,
  X,
  Pencil,
  ImageIcon,
  Plus,
} from "lucide-react";
import type { Brand } from "@/lib/database.types";

// ---------------------------------------------------------------------------
// Product type (matches Brand.products from database.types.ts)
type Product = { name: string; description: string; type?: string; price?: string; image_url?: string };

// ---------------------------------------------------------------------------
// Add Product Form with Import from URL
function AddProductForm({
  onAdd,
  onCancel,
  saving,
}: {
  onAdd: (p: Product) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [mode, setMode] = useState<"manual" | "url">("url");
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [type, setType] = useState("product");

  async function handleImport() {
    if (!importUrl.trim()) return;
    setImporting(true);
    try {
      const res = await fetch("/api/brands/scrape-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setName(data.product.name || "");
      setDescription(data.product.description || "");
      setPrice(data.product.price || "");
      setImageUrl(data.product.image_url || "");
      setType(data.product.type || "product");
      setMode("manual"); // Switch to manual to let user review/edit
    } catch (err) {
      alert(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function handleAdd() {
    if (!name.trim()) return;
    await onAdd({
      name,
      description: description || "",
      type: type || "product",
      price: price || undefined,
      image_url: imageUrl || undefined,
    });
  }

  return (
    <Card className="rounded-2xl border border-[#F0F0F0] bg-white shadow-none">
      <CardContent className="p-6 space-y-4">
        {/* Mode toggle */}
        <div className="flex gap-1 p-1 bg-[#F0F0F0] rounded-xl w-fit">
          <button
            onClick={() => setMode("url")}
            className={`px-4 py-2 text-[13px] font-medium rounded-lg transition-colors ${
              mode === "url" ? "bg-white text-[#1A1A1A] shadow-sm" : "text-[#9CA3AF] hover:text-[#6B7280]"
            }`}
          >
            Import from URL
          </button>
          <button
            onClick={() => setMode("manual")}
            className={`px-4 py-2 text-[13px] font-medium rounded-lg transition-colors ${
              mode === "manual" ? "bg-white text-[#1A1A1A] shadow-sm" : "text-[#9CA3AF] hover:text-[#6B7280]"
            }`}
          >
            Add manually
          </button>
        </div>

        {/* Import URL */}
        {mode === "url" && (
          <div className="flex gap-3">
            <Input
              placeholder="https://store.com/products/product-name"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              className="h-12 rounded-xl border-[#E5E7EB] text-[15px] focus:border-[#4D5D4B] flex-1"
              autoFocus
            />
            <Button
              onClick={handleImport}
              disabled={importing || !importUrl.trim()}
              className="h-12 rounded-full bg-[#4D5D4B] text-white hover:bg-[#3E4D3C] px-6"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4 me-2" />}
              {importing ? "" : "Import"}
            </Button>
          </div>
        )}

        {/* Manual form (also shows after import for editing) */}
        {mode === "manual" && (
          <>
            {imageUrl && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#FAFAFA] border border-[#F0F0F0]">
                <img src={imageUrl} alt="" className="h-14 w-14 rounded-xl object-cover border border-[#E5E7EB]" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[#9CA3AF] truncate">{imageUrl}</p>
                </div>
                <button onClick={() => setImageUrl("")} className="p-1.5 text-[#9CA3AF] hover:text-red-500 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Product name *" value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-xl border-[#E5E7EB] text-[15px] focus:border-[#4D5D4B]" autoFocus />
              <Input placeholder="Price (optional)" value={price} onChange={(e) => setPrice(e.target.value)} className="h-12 rounded-xl border-[#E5E7EB] text-[15px] focus:border-[#4D5D4B]" />
            </div>
            <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="h-12 rounded-xl border-[#E5E7EB] text-[15px] focus:border-[#4D5D4B]" />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Image URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="h-12 rounded-xl border-[#E5E7EB] text-[15px] focus:border-[#4D5D4B]" />
              <select value={type} onChange={(e) => setType(e.target.value)} className="h-12 rounded-xl border border-[#E5E7EB] px-4 text-[15px] bg-white text-[#1A1A1A] focus:border-[#4D5D4B] focus:outline-none transition-colors">
                <option value="product">Product</option>
                <option value="service">Service</option>
              </select>
            </div>
          </>
        )}

        <div className="flex gap-3 justify-end">
          <Button
            onClick={onCancel}
            className="rounded-full border-[#E5E7EB] bg-white text-[#1A1A1A] hover:bg-[#F5F5F5] px-5"
            variant="outline"
          >
            Cancel
          </Button>
          {mode === "manual" && (
            <Button
              onClick={handleAdd}
              disabled={!name.trim() || saving}
              className="rounded-full bg-[#4D5D4B] text-white hover:bg-[#3E4D3C] px-5"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Plus className="h-4 w-4 me-2" />}
              Add
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Products Section (CRUD)
function ProductsSection({
  products,
  brandId,
  primaryColor,
  onUpdate,
}: {
  products: Product[];
  brandId: string;
  primaryColor: string;
  onUpdate: (products: Product[]) => void;
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editProduct, setEditProduct] = useState<Product>({ name: "", description: "" });
  const [addingNew, setAddingNew] = useState(false);
  const [newProduct, setNewProduct] = useState<Product>({ name: "", description: "", type: "product", price: "", image_url: "" });
  const [saving, setSaving] = useState(false);

  async function saveProducts(updated: Product[]) {
    setSaving(true);
    try {
      const res = await fetch(`/api/brands/${brandId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: updated }),
      });
      if (res.ok) onUpdate(updated);
    } catch (e) {
      console.error("Failed to save products:", e);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(i: number) {
    setEditingIdx(i);
    setEditProduct({ ...products[i] });
    setAddingNew(false);
  }

  function cancelEdit() {
    setEditingIdx(null);
    setEditProduct({ name: "", description: "" });
  }

  async function saveEdit() {
    if (editingIdx === null || !editProduct.name.trim()) return;
    const updated = [...products];
    updated[editingIdx] = editProduct;
    await saveProducts(updated);
    setEditingIdx(null);
  }

  async function deleteProduct(i: number) {
    const updated = products.filter((_, idx) => idx !== i);
    await saveProducts(updated);
  }

  async function addProduct() {
    if (!newProduct.name.trim()) return;
    const cleaned: Product = {
      name: newProduct.name,
      description: newProduct.description || "",
      type: newProduct.type || "product",
      price: newProduct.price || undefined,
      image_url: newProduct.image_url || undefined,
    };
    await saveProducts([...products, cleaned]);
    setNewProduct({ name: "", description: "", type: "product", price: "", image_url: "" });
    setAddingNew(false);
  }

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Package className="h-5 w-5 text-[#9CA3AF]" />
          <h2 className="text-[18px] font-semibold text-[#1A1A1A]">Products & Services</h2>
          {products.length > 0 && (
            <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[#F0F0F0] text-[#6B7280] text-[11px] font-medium px-2">
              {products.length}
            </span>
          )}
        </div>
        {!addingNew && (
          <Button
            onClick={() => { setAddingNew(true); setEditingIdx(null); }}
            className="rounded-full border-[#E5E7EB] bg-white text-[#1A1A1A] hover:bg-[#F5F5F5] px-4 text-[14px]"
            variant="outline"
          >
            <Plus className="h-4 w-4 me-2" />
            Add Product
          </Button>
        )}
      </div>

      {/* Add new product form */}
      {addingNew && (
        <AddProductForm
          onAdd={async (p) => {
            await saveProducts([...products, p]);
            setAddingNew(false);
          }}
          onCancel={() => setAddingNew(false)}
          saving={saving}
        />
      )}

      {/* Product grid */}
      {products.length === 0 && !addingNew ? (
        <div className="rounded-2xl border border-dashed border-[#E5E7EB] py-12 text-center bg-white">
          <Package className="h-10 w-10 mx-auto text-[#E5E7EB] mb-3" />
          <p className="text-[15px] text-[#9CA3AF]">No products yet</p>
          <Button
            className="mt-4 rounded-full border-[#E5E7EB] bg-white text-[#1A1A1A] hover:bg-[#F5F5F5] px-5 text-[14px]"
            variant="outline"
            onClick={() => setAddingNew(true)}
          >
            <Plus className="h-4 w-4 me-2" />
            Add your first product
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product, i) => {
            const p = product as Product;
            const isEditing = editingIdx === i;

            if (isEditing) {
              return (
                <Card key={i} className="rounded-xl border border-[#F0F0F0] overflow-hidden bg-white shadow-none">
                  <CardContent className="p-5 space-y-3">
                    <Input
                      value={editProduct.name}
                      onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })}
                      placeholder="Name"
                      className="h-12 rounded-xl border-[#E5E7EB] text-[15px] font-semibold text-[#1A1A1A] focus:border-[#4D5D4B]"
                    />
                    <Input
                      value={editProduct.description || ""}
                      onChange={(e) => setEditProduct({ ...editProduct, description: e.target.value })}
                      placeholder="Description"
                      className="h-12 rounded-xl border-[#E5E7EB] text-[15px] text-[#6B7280] focus:border-[#4D5D4B]"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        value={editProduct.price || ""}
                        onChange={(e) => setEditProduct({ ...editProduct, price: e.target.value })}
                        placeholder="Price"
                        className="h-12 rounded-xl border-[#E5E7EB] text-[15px] focus:border-[#4D5D4B]"
                      />
                      <select
                        value={editProduct.type || "product"}
                        onChange={(e) => setEditProduct({ ...editProduct, type: e.target.value })}
                        className="h-12 rounded-xl border border-[#E5E7EB] px-4 text-[15px] bg-white text-[#1A1A1A] focus:border-[#4D5D4B] focus:outline-none transition-colors"
                      >
                        <option value="product">Product</option>
                        <option value="service">Service</option>
                      </select>
                    </div>
                    <Input
                      value={editProduct.image_url || ""}
                      onChange={(e) => setEditProduct({ ...editProduct, image_url: e.target.value })}
                      placeholder="Image URL"
                      className="h-12 rounded-xl border-[#E5E7EB] text-[15px] focus:border-[#4D5D4B]"
                    />
                    <div className="flex gap-3 justify-end pt-2">
                      <Button
                        onClick={cancelEdit}
                        className="rounded-full border-[#E5E7EB] bg-white text-[#1A1A1A] hover:bg-[#F5F5F5] px-4"
                        variant="outline"
                      >
                        <X className="h-3.5 w-3.5 me-1.5" /> Cancel
                      </Button>
                      <Button
                        onClick={saveEdit}
                        disabled={saving}
                        className="rounded-full bg-[#4D5D4B] text-white hover:bg-[#3E4D3C] px-4"
                      >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin me-1.5" /> : <Save className="h-3.5 w-3.5 me-1.5" />}
                        Save
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            return (
              <Card
                key={i}
                className="group rounded-xl border border-[#F0F0F0] transition-all hover:shadow-md overflow-hidden bg-white shadow-none"
              >
                {p.image_url && (
                  <div className="aspect-square bg-[#FAFAFA] border-b border-[#F0F0F0] overflow-hidden">
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="w-full h-full object-cover rounded-xl"
                      onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
                    />
                  </div>
                )}
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-[15px] font-semibold text-[#1A1A1A] leading-snug">{p.name}</h3>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(i)}
                        className="p-1.5 rounded-lg hover:bg-[#F5F5F5] text-[#9CA3AF] hover:text-[#1A1A1A] transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteProduct(i)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-[#9CA3AF] hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {p.price && (
                      <span className="text-[13px] font-medium text-[#1A1A1A]">{p.price}</span>
                    )}
                    {p.type && (
                      <span className="inline-flex items-center rounded-full bg-[#F0F0F0] text-[#6B7280] text-[11px] font-medium px-2.5 py-0.5">
                        {p.type}
                      </span>
                    )}
                  </div>
                  {p.description && (
                    <p className="mt-2 text-[13px] text-[#6B7280] leading-relaxed line-clamp-3">{p.description}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function hexToHSL(hex: string): { h: number; s: number; l: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function lighten(hex: string, amount: number): string {
  const hsl = hexToHSL(hex);
  if (!hsl) return hex;
  const newL = Math.min(95, hsl.l + amount);
  return hslToHex(hsl.h, Math.max(hsl.s * 0.7, 10), newL);
}

function darken(hex: string, amount: number): string {
  const hsl = hexToHSL(hex);
  if (!hsl) return hex;
  const newL = Math.max(10, hsl.l - amount);
  return hslToHex(hsl.h, hsl.s, newL);
}

/** Returns a readable foreground (white or black) for a given background hex */
function contrastText(hex: string): string {
  const hsl = hexToHSL(hex);
  if (!hsl) return "#000000";
  return hsl.l > 55 ? "#000000" : "#ffffff";
}

// ---------------------------------------------------------------------------
// Palette type
// ---------------------------------------------------------------------------

type PaletteSwatch = {
  hex: string;
  label: string;
};

function buildPalette(brand: Brand): PaletteSwatch[] {
  const swatches: PaletteSwatch[] = [];
  const primary = brand.primary_color || "#1a1a1a";
  const secondary = brand.secondary_color || "#666666";
  const accent = brand.accent_color || "#0066ff";

  swatches.push({ hex: primary, label: "Primary" });
  swatches.push({ hex: secondary, label: "Secondary" });
  swatches.push({ hex: accent, label: "Accent" });
  swatches.push({ hex: lighten(primary, 30), label: "Light Tint" });
  swatches.push({ hex: darken(primary, 20), label: "Dark Shade" });

  return swatches;
}

// ---------------------------------------------------------------------------
// Clipboard helper
// ---------------------------------------------------------------------------

function CopyHex({ hex }: { hex: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(hex).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [hex]);

  return (
    <button
      onClick={copy}
      className="mt-1.5 flex items-center gap-1 text-[11px] font-mono text-[#9CA3AF] hover:text-[#1A1A1A] transition-colors"
    >
      {copied ? (
        <Check className="h-2.5 w-2.5" />
      ) : (
        <Copy className="h-2.5 w-2.5" />
      )}
      {hex.toUpperCase()}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function BrandDetailPage() {
  const { brandId } = useParams<{ brandId: string }>();
  const router = useRouter();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);

  // Inline editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrimary, setEditPrimary] = useState("");
  const [editSecondary, setEditSecondary] = useState("");
  const [editAccent, setEditAccent] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const palette = useMemo(() => (brand ? buildPalette(brand) : []), [brand]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/brands/${brandId}`);
        if (!res.ok) {
          router.push("/dashboard/brands");
          return;
        }
        const data = await res.json();
        setBrand(data.brand);
      } catch {
        router.push("/dashboard/brands");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [brandId, router]);

  function startEditing() {
    if (!brand) return;
    setEditName(brand.name);
    setEditDescription(brand.description || "");
    setEditPrimary(brand.primary_color || "#1a1a1a");
    setEditSecondary(brand.secondary_color || "#666666");
    setEditAccent(brand.accent_color || "#0066ff");
    setEditError(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setEditError(null);
  }

  async function handleSave() {
    if (!brand) return;
    setSaving(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/brands/${brandId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          description: editDescription,
          primary_color: editPrimary,
          secondary_color: editSecondary,
          accent_color: editAccent,
        }),
      });

      if (!res.ok) throw new Error("Failed to save changes");

      const { brand: updated } = await res.json();
      setBrand(updated);
      setIsEditing(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this brand?")) return;
    setDeleting(true);
    try {
      await fetch(`/api/brands/${brandId}`, { method: "DELETE" });
      router.push("/dashboard/brands");
    } catch {
      setDeleting(false);
    }
  }

  async function handleReanalyze() {
    if (!brand?.website_url) return;
    setReanalyzing(true);
    try {
      const res = await fetch("/api/brands/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: brand.website_url }),
      });
      if (!res.ok) throw new Error();
      const { brand: fresh, assets } = await res.json();

      // Patch updated fields INCLUDING scraped assets
      const patch = {
        description: fresh.description,
        primary_color: fresh.primary_color,
        secondary_color: fresh.secondary_color,
        accent_color: fresh.accent_color,
        industry: fresh.industry,
        target_audience: fresh.target_audience,
        brand_voice: fresh.brand_voice,
        logo_url: assets?.logo || brand.logo_url || null,
        products: fresh.products || [],
        scraped_data: {
          tagline: fresh.tagline,
          key_messages: fresh.key_messages,
          images: assets?.images || [],
          screenshot: assets?.screenshot || null,
          favicon: assets?.favicon || null,
          ogImage: assets?.ogImage || null,
          colors: assets?.colors || [],
        },
      };

      const patchRes = await fetch(`/api/brands/${brandId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (patchRes.ok) {
        const { brand: updated } = await patchRes.json();
        setBrand(updated);
      }
    } catch (err) {
      console.error("Re-analyze failed", err);
    } finally {
      setReanalyzing(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="px-8 py-8 mx-auto max-w-4xl space-y-8 bg-white min-h-screen">
        <Skeleton className="h-5 w-20 rounded-lg" />
        <div className="flex items-center gap-5">
          <Skeleton className="h-16 w-16 rounded-2xl" />
          <div className="space-y-2.5">
            <Skeleton className="h-9 w-64 rounded-xl" />
            <Skeleton className="h-4 w-40 rounded-lg" />
          </div>
        </div>
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!brand) return null;

  const scrapedData = brand.scraped_data as Record<string, unknown> | null;
  const tagline = scrapedData?.tagline as string | null;
  const keyMessages = (scrapedData?.key_messages as string[] | null) || [];
  const primaryColor = brand.primary_color || "#1a1a1a";

  return (
    <TooltipProvider>
      <div className="px-8 py-8 mx-auto max-w-4xl space-y-10 pb-16 bg-white min-h-screen">

        {/* ================================================================== */}
        {/* Back link                                                          */}
        {/* ================================================================== */}
        <Link
          href="/dashboard/brands"
          className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#6B7280] hover:text-[#1A1A1A] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Brands
        </Link>

        {/* ================================================================== */}
        {/* Header                                                             */}
        {/* ================================================================== */}
        <div className="space-y-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-5">
              {/* Brand logo */}
              {brand.logo_url ? (
                <div className="h-16 w-16 shrink-0 rounded-2xl bg-white p-2 shadow-md border border-[#F0F0F0]">
                  <img
                    src={brand.logo_url}
                    alt={brand.name}
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : (
                <div
                  className="h-16 w-16 shrink-0 rounded-2xl shadow-md border border-[#F0F0F0]"
                  style={{ backgroundColor: primaryColor }}
                />
              )}

              <div className="space-y-1.5">
                {isEditing ? (
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-12 rounded-xl border-[#E5E7EB] text-[32px] font-bold text-[#1A1A1A] focus:border-[#4D5D4B]"
                    placeholder="Brand name"
                  />
                ) : (
                  <h1 className="text-[32px] font-bold text-[#1A1A1A] tracking-tight leading-tight">
                    {brand.name}
                  </h1>
                )}

                {/* Website URL */}
                {brand.website_url && (
                  <a
                    href={brand.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[14px] text-[#6B7280] hover:text-[#1A1A1A] transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {brand.website_url}
                  </a>
                )}

                {/* Industry badge */}
                {brand.industry && (
                  <span className="inline-flex items-center rounded-lg bg-[#F3F4F6] text-[#6B7280] text-[12px] font-medium px-2.5 py-1 mt-1">
                    {brand.industry}
                  </span>
                )}
                {/* Full description */}
                {brand.description && !isEditing && (
                  <p className="text-[14px] text-[#6B7280] leading-relaxed mt-1 max-w-2xl">{brand.description}</p>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 shrink-0">
              {isEditing ? (
                <>
                  <Button
                    onClick={cancelEditing}
                    disabled={saving}
                    className="rounded-full border-[#E5E7EB] bg-white text-[#1A1A1A] hover:bg-[#F5F5F5] px-5 text-[14px]"
                    variant="outline"
                  >
                    <X className="me-2 h-4 w-4" />
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-full bg-[#4D5D4B] text-white hover:bg-[#3E4D3C] px-5 text-[14px]"
                  >
                    {saving ? (
                      <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="me-2 h-4 w-4" />
                    )}
                    Save Changes
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={startEditing}
                    className="rounded-full border-[#E5E7EB] bg-white text-[#1A1A1A] hover:bg-[#F5F5F5] px-5 text-[14px]"
                    variant="outline"
                  >
                    <Pencil className="me-2 h-4 w-4" />
                    Edit
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Edit error */}
        {editError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 text-[14px] text-red-600">
            {editError}
          </div>
        )}

        {/* ================================================================== */}
        {/* Brand Identity Card                                                */}
        {/* ================================================================== */}
        <div className="rounded-2xl border border-[#F0F0F0] bg-white p-6 space-y-6">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A]">Brand Identity</h2>

          {/* Color palette */}
          <div className="space-y-3">
            <label className="text-[14px] font-semibold text-[#1A1A1A]">Color Palette</label>
            {isEditing ? (
              <div className="flex gap-5">
                <div className="flex-1 space-y-2">
                  <label className="text-[14px] font-semibold text-[#1A1A1A]">Primary</label>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-8 w-8 rounded-full shrink-0"
                      style={{ backgroundColor: editPrimary, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
                    />
                    <Input
                      value={editPrimary}
                      onChange={(e) => setEditPrimary(e.target.value)}
                      placeholder="#000000"
                      className="h-12 rounded-xl border-[#E5E7EB] text-[15px] font-mono focus:border-[#4D5D4B]"
                    />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <label className="text-[14px] font-semibold text-[#1A1A1A]">Secondary</label>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-8 w-8 rounded-full shrink-0"
                      style={{ backgroundColor: editSecondary, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
                    />
                    <Input
                      value={editSecondary}
                      onChange={(e) => setEditSecondary(e.target.value)}
                      placeholder="#666666"
                      className="h-12 rounded-xl border-[#E5E7EB] text-[15px] font-mono focus:border-[#4D5D4B]"
                    />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <label className="text-[14px] font-semibold text-[#1A1A1A]">Accent</label>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-8 w-8 rounded-full shrink-0"
                      style={{ backgroundColor: editAccent, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
                    />
                    <Input
                      value={editAccent}
                      onChange={(e) => setEditAccent(e.target.value)}
                      placeholder="#0066ff"
                      className="h-12 rounded-xl border-[#E5E7EB] text-[15px] font-mono focus:border-[#4D5D4B]"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex gap-6">
                {palette.map((swatch, i) => (
                  <Tooltip key={i}>
                    <TooltipTrigger className="flex flex-col items-center">
                      <div
                        className="h-8 w-8 rounded-full transition-transform hover:scale-110 cursor-pointer"
                        style={{ backgroundColor: swatch.hex, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
                      />
                      <span className="mt-2 text-[12px] font-medium text-[#6B7280]">{swatch.label}</span>
                      <CopyHex hex={swatch.hex} />
                    </TooltipTrigger>
                    <TooltipContent>
                      Click hex to copy {swatch.hex.toUpperCase()}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            )}
          </div>

          {/* Brand Voice */}
          {brand.brand_voice && (
            <div className="space-y-2">
              <label className="text-[14px] font-semibold text-[#1A1A1A]">Brand Voice</label>
              <p className="text-[14px] text-[#6B7280] leading-relaxed italic">
                &ldquo;{brand.brand_voice}&rdquo;
              </p>
            </div>
          )}

          {/* Target Audience */}
          {brand.target_audience && (
            <div className="space-y-2">
              <label className="text-[14px] font-semibold text-[#1A1A1A]">Target Audience</label>
              <p className="text-[14px] text-[#6B7280] leading-relaxed">
                {brand.target_audience}
              </p>
            </div>
          )}

          {/* Description (edit mode) */}
          {isEditing && (
            <div className="space-y-2">
              <label className="text-[14px] font-semibold text-[#1A1A1A]">Description</label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="min-h-[80px] rounded-xl border-[#E5E7EB] text-[15px] text-[#6B7280] leading-relaxed focus:border-[#4D5D4B]"
                placeholder="Brand description"
              />
            </div>
          )}

          {/* Description (view mode, full) */}
          {!isEditing && brand.description && (
            <div className="space-y-2">
              <label className="text-[14px] font-semibold text-[#1A1A1A]">Description</label>
              <p className="text-[14px] text-[#6B7280] leading-relaxed">
                {brand.description}
              </p>
            </div>
          )}
        </div>

        {/* ================================================================== */}
        {/* Products Card                                                      */}
        {/* ================================================================== */}
        <div className="rounded-2xl border border-[#F0F0F0] bg-white p-6">
          <ProductsSection
            products={brand.products || []}
            brandId={brand.id}
            primaryColor={primaryColor}
            onUpdate={(products) => setBrand({ ...brand, products })}
          />
        </div>

        {/* ================================================================== */}
        {/* Brand Assets (Scraped)                                             */}
        {/* ================================================================== */}
        {(tagline || keyMessages.length > 0) && (
          <div className="rounded-2xl border border-[#F0F0F0] bg-white p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-semibold text-[#1A1A1A]">Brand Assets</h2>
              {brand.website_url && (
                <Button
                  onClick={handleReanalyze}
                  disabled={reanalyzing}
                  className="rounded-full border-[#E5E7EB] bg-white text-[#1A1A1A] hover:bg-[#F5F5F5] px-5 text-[14px]"
                  variant="outline"
                >
                  {reanalyzing ? (
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="me-2 h-4 w-4" />
                  )}
                  Re-analyze
                </Button>
              )}
            </div>

            {tagline && (
              <div className="space-y-1.5">
                <label className="text-[14px] font-semibold text-[#1A1A1A]">Tagline</label>
                <p className="text-[18px] font-semibold text-[#1A1A1A] tracking-tight">
                  {tagline}
                </p>
              </div>
            )}

            {tagline && keyMessages.length > 0 && <Separator className="bg-[#F0F0F0]" />}

            {keyMessages.length > 0 && (
              <div className="space-y-2">
                <label className="text-[14px] font-semibold text-[#1A1A1A]">Key Messages</label>
                <ul className="space-y-2.5">
                  {keyMessages.map((msg, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 text-[14px] text-[#6B7280]"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4D5D4B]" />
                      {msg}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ================================================================== */}
        {/* Website Assets (Images Gallery)                                    */}
        {/* ================================================================== */}
        {(() => {
          const images = (scrapedData?.images as string[]) || [];
          const screenshot = scrapedData?.screenshot as string | null;
          const logo = brand.logo_url;
          // Debug: log what we have
          if (typeof window !== "undefined") {
            console.log("[brand-detail] scraped_data keys:", Object.keys(scrapedData || {}));
            console.log("[brand-detail] images:", images.length, "| screenshot:", !!screenshot, "| logo:", !!logo);
          }
          if (images.length === 0 && !screenshot && !logo) return null;
          return (
            <div className="rounded-2xl border border-[#F0F0F0] bg-white p-6 space-y-5">
              <div className="flex items-center gap-2.5">
                <ImageIcon className="h-5 w-5 text-[#9CA3AF]" />
                <h2 className="text-[18px] font-semibold text-[#1A1A1A]">Website Assets</h2>
                <span className="text-[13px] text-[#9CA3AF]">
                  {images.length} images found
                </span>
              </div>

              {/* Logo */}
              {logo && (
                <div className="flex items-center gap-4 p-4 rounded-xl border border-[#F0F0F0] bg-[#FAFAFA]">
                  <img
                    src={logo}
                    alt="Logo"
                    className="h-14 w-14 object-contain rounded-xl border border-[#F0F0F0] bg-white p-1.5"
                  />
                  <div>
                    <p className="text-[14px] font-semibold text-[#1A1A1A]">Brand Logo</p>
                    <p className="text-[13px] text-[#9CA3AF] truncate max-w-xs">{logo}</p>
                  </div>
                </div>
              )}

              {/* Screenshot */}
              {screenshot && (
                <div className="rounded-xl border border-[#F0F0F0] overflow-hidden bg-[#FAFAFA]">
                  <p className="text-[13px] text-[#9CA3AF] px-5 pt-4 pb-2">Website Screenshot</p>
                  <img src={screenshot} alt="Website screenshot" className="w-full" />
                </div>
              )}

              {/* Image Grid */}
              {images.length > 0 && (
                <div className="grid grid-cols-4 gap-3">
                  {images.slice(0, 20).map((imgUrl, i) => (
                    <a
                      key={i}
                      href={imgUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl border border-[#F0F0F0] overflow-hidden aspect-square bg-[#FAFAFA] hover:border-[#E5E7EB] transition-colors"
                    >
                      <img
                        src={imgUrl}
                        alt={`Asset ${i + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* ================================================================== */}
        {/* Footer: metadata + delete                                          */}
        {/* ================================================================== */}
        <div className="space-y-6 pt-4">
          <div className="flex items-center justify-between text-[13px] text-[#9CA3AF]">
            <span>
              Created{" "}
              {new Date(brand.created_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
            <span>
              Last updated{" "}
              {new Date(brand.updated_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>

          {/* Delete brand */}
          <div className="flex justify-end">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-[14px] text-[#EF4444] hover:underline transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Delete this brand
            </button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
