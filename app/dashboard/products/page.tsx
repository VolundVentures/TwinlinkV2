"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  Search,
  X,
  ExternalLink,
  ImageIcon,
  Tag,
  ArrowRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
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
  is_default?: boolean;
};

export default function ProductsPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/brands");
        if (res.ok) {
          const data = await res.json();
          const brandList = data.brands || [];
          setBrands(brandList);
          if (brandList.length > 0) {
            const defaultBrand = brandList.find((b: Brand) => b.is_default) || brandList[0];
            setSelectedBrand(defaultBrand.id);
          }
        }
      } catch (err) {
        console.error("Failed to load brands:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const activeBrand = brands.find((b) => b.id === selectedBrand);
  const products = activeBrand?.products || [];
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="px-4 sm:px-6 md:px-8 py-6 space-y-8">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-[#F0F0F0] overflow-hidden">
              <Skeleton className="aspect-square" />
              <div className="p-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2 mt-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-[#1A1A1A]">Products</h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""} from your brand website
          </p>
        </div>
      </div>

      {/* Brand selector + Search */}
      <div className="flex items-center gap-4">
        {brands.length > 1 && (
          <div className="flex gap-2">
            {brands.map((brand) => (
              <button
                key={brand.id}
                onClick={() => setSelectedBrand(brand.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium transition-all",
                  selectedBrand === brand.id
                    ? "bg-[#1A1A1A] text-white"
                    : "bg-white border border-[#E5E7EB] text-[#6B7280] hover:border-[#9CA3AF]"
                )}
              >
                {brand.logo_url ? (
                  <img src={brand.logo_url} alt="" className="h-5 w-5 rounded-full object-contain" />
                ) : (
                  <span className="h-5 w-5 rounded-full bg-[#F0F0F0] flex items-center justify-center text-[9px] font-bold text-[#1A1A1A]">
                    {brand.name[0]}
                  </span>
                )}
                {brand.name}
                <span className="text-[11px] opacity-60">({brand.products?.length || 0})</span>
              </button>
            ))}
          </div>
        )}

        {/* View all products for this brand link */}
        {selectedBrand && (
          <Link
            href={`/dashboard/products/${selectedBrand}`}
            className="text-[13px] text-[#4D5D4B] hover:text-[#1A1A1A] font-medium transition-colors flex items-center gap-1"
          >
            Full view <ArrowRight className="h-3 w-3" />
          </Link>
        )}

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="w-full h-12 pl-10 pr-4 bg-white border border-[#E5E7EB] rounded-xl text-[15px] text-[#1A1A1A] placeholder:text-[#9CA3AF] outline-none focus:border-[#1A1A1A] transition-colors"
          />
        </div>
      </div>

      {/* Product grid */}
      {filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Package className="h-10 w-10 text-[#9CA3AF] mb-4" />
          <h3 className="text-[16px] font-medium text-[#1A1A1A]">
            {products.length === 0 ? "No products found" : "No matching products"}
          </h3>
          <p className="text-[13px] text-[#9CA3AF] mt-1 max-w-sm">
            {products.length === 0
              ? "Products are extracted when you add a brand. Try re-analyzing your brand website."
              : "Try adjusting your search query."
            }
          </p>
        </div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5"
        >
          {filteredProducts.map((product, i) => (
            <motion.button
              key={`${product.name}-${i}`}
              variants={staggerItem}
              onClick={() => setSelectedProduct(product)}
              whileHover={{ y: -4, boxShadow: "0 12px 32px rgba(0,0,0,0.08)" }}
              transition={spring.snappy}
              className="text-left bg-white rounded-2xl overflow-hidden border border-[#F0F0F0] transition-all"
            >
              {/* Image — edge-to-edge */}
              <div className="aspect-square bg-[#FAFAFA] overflow-hidden">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <ImageIcon className="h-8 w-8 text-[#9CA3AF]" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <p className="text-[14px] font-medium text-[#1A1A1A] line-clamp-2 leading-snug">
                  {product.name}
                </p>
                {product.type && (
                  <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-0.5 bg-[#F5F5F5] rounded-full text-[11px] text-[#6B7280]">
                    <Tag className="h-2.5 w-2.5" />
                    {product.type}
                  </span>
                )}
              </div>
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* Product detail drawer */}
      <AnimatePresence>
        {selectedProduct && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={spring.smooth}
              className="fixed right-0 top-0 bottom-0 w-[420px] bg-white shadow-2xl z-50 overflow-y-auto rounded-l-2xl"
            >
              <div className="p-6">
                {/* Close */}
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="flex items-center justify-center h-9 w-9 rounded-full border border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#1A1A1A] hover:border-[#1A1A1A] transition-colors mb-5"
                >
                  <X className="h-4 w-4" />
                </button>

                {/* Image */}
                {selectedProduct.image_url && (
                  <div className="aspect-square rounded-2xl overflow-hidden bg-[#FAFAFA] mb-6">
                    <img
                      src={selectedProduct.image_url}
                      alt={selectedProduct.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Details */}
                <h2 className="text-[22px] font-semibold text-[#1A1A1A] mb-2">
                  {selectedProduct.name}
                </h2>

                {selectedProduct.type && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F5F5F5] rounded-full text-[12px] text-[#6B7280] mb-4">
                    <Tag className="h-3 w-3" />
                    {selectedProduct.type}
                  </span>
                )}

                {selectedProduct.description && (
                  <p className="text-[14px] text-[#6B7280] leading-relaxed mt-4">
                    {selectedProduct.description}
                  </p>
                )}

                {/* Actions */}
                <div className="mt-8 space-y-3">
                  <button
                    onClick={() => {
                      setSelectedProduct(null);
                      router.push(`/dashboard/generate?type=static_ad&brandId=${selectedBrand}&prompt=Create an ad for ${encodeURIComponent(selectedProduct.name)}`);
                    }}
                    className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#4D5D4B] text-white rounded-full text-[14px] font-medium hover:bg-[#3f4d3d] transition-colors"
                  >
                    Create Ad for This Product
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedProduct(null);
                      router.push(`/dashboard/studio`);
                    }}
                    className="flex items-center justify-center gap-2 w-full py-3.5 border border-[#E5E7EB] rounded-full text-[14px] text-[#6B7280] hover:text-[#1A1A1A] hover:border-[#1A1A1A] transition-colors"
                  >
                    Open in Studio
                    <ExternalLink className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
