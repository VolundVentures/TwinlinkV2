"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Search,
  Tag,
  ImageIcon,
  Package,
  ExternalLink,
  Film,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { spring, staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Product = {
  name: string;
  description?: string;
  image_url?: string;
  type?: string;
  price?: string;
};

type Brand = {
  id: string;
  name: string;
  logo_url?: string | null;
  products: Product[];
  website_url?: string;
};

export default function BrandProductsPage() {
  const params = useParams();
  const router = useRouter();
  const brandId = params.brandId as string;

  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/brands");
        if (res.ok) {
          const data = await res.json();
          const found = (data.brands || []).find((b: Brand) => b.id === brandId);
          setBrand(found || null);
        }
      } catch {} finally { setLoading(false); }
    }
    load();
  }, [brandId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (<Skeleton key={i} className="aspect-square rounded-xl" />))}
        </div>
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="text-center py-20">
        <p className="text-[#737373]">Brand not found.</p>
        <Link href="/dashboard/products" className="text-[#4D5D4B] underline mt-2 inline-block">Back to products</Link>
      </div>
    );
  }

  const products = brand.products || [];
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex gap-8">
      {/* Main grid */}
      <div className="flex-1 space-y-6">
        {/* Header */}
        <div>
          <Link href="/dashboard/products" className="flex items-center gap-1.5 text-[12px] text-[#a3a3a3] hover:text-[#161514] transition-colors mb-3">
            <ArrowLeft className="h-3 w-3" /> All Products
          </Link>
          <div className="flex items-center gap-3">
            {brand.logo_url && <img src={brand.logo_url} alt="" className="h-8 w-8 rounded-lg object-contain bg-white border border-[rgba(22,21,20,0.06)]" />}
            <div>
              <h1 className="text-headline-sm text-[#161514]">{brand.name}</h1>
              <p className="text-[12px] text-[#a3a3a3]">{products.length} product{products.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#a3a3a3]" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="w-full h-10 pl-10 pr-4 bg-white border border-[rgba(22,21,20,0.08)] rounded-xl text-[13px] outline-none focus:border-[#161514]"
          />
        </div>

        {/* Product grid */}
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map((product, i) => (
            <motion.button
              key={`${product.name}-${i}`}
              variants={staggerItem}
              onClick={() => setSelectedProduct(product)}
              whileHover={{ y: -3, boxShadow: "0 8px 24px rgba(22,21,20,0.08)" }}
              transition={spring.snappy}
              className={cn(
                "text-left bg-white rounded-2xl overflow-hidden border transition-all",
                selectedProduct?.name === product.name ? "border-[#161514] ring-1 ring-[#161514]" : "border-[rgba(22,21,20,0.05)]"
              )}
            >
              <div className="aspect-square bg-[#F3F0EB] overflow-hidden">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex items-center justify-center h-full"><ImageIcon className="h-8 w-8 text-[#d4d4d4]" /></div>
                )}
              </div>
              <div className="p-3">
                <p className="text-[13px] font-medium text-[#161514] line-clamp-2">{product.name}</p>
                {product.type && (
                  <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 bg-[#F3F0EB] rounded-full text-[10px] text-[#737373]">
                    <Tag className="h-2.5 w-2.5" /> {product.type}
                  </span>
                )}
              </div>
            </motion.button>
          ))}
        </motion.div>
      </div>

      {/* Right detail panel */}
      {selectedProduct && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={spring.smooth}
          className="w-80 shrink-0 sticky top-0"
        >
          <div className="bg-white rounded-2xl border border-[rgba(22,21,20,0.06)] overflow-hidden">
            {selectedProduct.image_url && (
              <div className="aspect-square bg-[#F3F0EB]">
                <img src={selectedProduct.image_url} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-5 space-y-4">
              <h2 className="text-[18px] font-semibold text-[#161514]">{selectedProduct.name}</h2>

              {selectedProduct.type && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F3F0EB] rounded-full text-[11px] text-[#737373]">
                  <Tag className="h-3 w-3" /> {selectedProduct.type}
                </span>
              )}

              {selectedProduct.description && (
                <p className="text-[13px] text-[#737373] leading-relaxed">{selectedProduct.description}</p>
              )}

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => router.push(`/dashboard/generate?type=static_ad&brandId=${brandId}&prompt=Create an ad for ${encodeURIComponent(selectedProduct.name)}`)}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-[#161514] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2928] transition-colors"
                >
                  <ImageIcon className="h-4 w-4" /> Create Static Ad
                </button>
                <button
                  onClick={() => router.push(`/dashboard/generate?type=ugc_video&brandId=${brandId}&prompt=Create a video ad for ${encodeURIComponent(selectedProduct.name)}`)}
                  className="flex items-center justify-center gap-2 w-full py-3 border border-[rgba(22,21,20,0.10)] rounded-xl text-[13px] text-[#161514] font-medium hover:bg-[#F3F0EB] transition-colors"
                >
                  <Film className="h-4 w-4" /> Create Video Ad
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
