"use client";

import { useEffect, useState } from "react";
import { StudioProvider, useStudio } from "@/components/studio/studio-context";
import { StudioShell } from "@/components/studio/studio-shell";

function StudioInner() {
  const { dispatch } = useStudio();
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([]);

  // Load brands and set default
  useEffect(() => {
    async function loadBrands() {
      try {
        const res = await fetch("/api/brands");
        if (res.ok) {
          const data = await res.json();
          const brandList = data.brands || [];
          setBrands(brandList);
          if (brandList.length > 0) {
            const defaultBrand = brandList.find((b: { is_default?: boolean }) => b.is_default) || brandList[0];
            dispatch({ type: "SET_BRAND", brandId: defaultBrand.id });
          }
        }
      } catch {
        // Silently fail — user can still use studio without brand
      }
    }
    loadBrands();
  }, [dispatch]);

  return <StudioShell />;
}

export default function StudioPage() {
  return (
    <StudioProvider>
      <StudioInner />
    </StudioProvider>
  );
}
