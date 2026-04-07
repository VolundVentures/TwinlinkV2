"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { spring } from "@/lib/motion";

type MasonryItem = {
  id: string;
  height: number; // estimated or measured height
  element: ReactNode;
};

type MasonryGridProps = {
  items: MasonryItem[];
  columnCount?: number;
  gap?: number;
  className?: string;
};

/**
 * Pinterest-style masonry grid.
 * - Fixed column count by breakpoint
 * - 16px gutter (configurable)
 * - Variable item height
 * - Column-packing algorithm (shortest column first)
 * - framer-motion layout animation for smooth reflows
 */
export function MasonryGrid({ items, columnCount: colCountProp, gap = 16, className }: MasonryGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(colCountProp || 4);
  const [containerWidth, setContainerWidth] = useState(0);

  // Responsive column count
  useEffect(() => {
    if (colCountProp) {
      setColumns(colCountProp);
      return;
    }

    function updateColumns() {
      const w = containerRef.current?.offsetWidth || window.innerWidth;
      setContainerWidth(w);
      if (w < 640) setColumns(2);
      else if (w < 1024) setColumns(3);
      else if (w < 1440) setColumns(4);
      else setColumns(5);
    }

    updateColumns();
    const observer = new ResizeObserver(updateColumns);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [colCountProp]);

  // Column-packing layout
  const columnWidth = containerWidth > 0
    ? (containerWidth - gap * (columns - 1)) / columns
    : 300;

  const columnHeights = new Array(columns).fill(0);
  const positions: { x: number; y: number; width: number }[] = [];

  for (const item of items) {
    // Find shortest column
    const shortestCol = columnHeights.indexOf(Math.min(...columnHeights));
    const x = shortestCol * (columnWidth + gap);
    const y = columnHeights[shortestCol];

    positions.push({ x, y, width: columnWidth });
    columnHeights[shortestCol] += item.height + gap;
  }

  const totalHeight = Math.max(...columnHeights, 0);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", height: totalHeight }}
    >
      {items.map((item, i) => {
        const pos = positions[i];
        if (!pos) return null;

        return (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...spring.gentle, delay: Math.min(i * 0.03, 0.3) }}
            style={{
              position: "absolute",
              left: pos.x,
              top: pos.y,
              width: pos.width,
            }}
          >
            {item.element}
          </motion.div>
        );
      })}
    </div>
  );
}
