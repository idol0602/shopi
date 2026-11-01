"use client";

import React, { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductGalleryProps {
  images: string[];
  title: string;
}

export function ProductGallery({ images, title }: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const validImages =
    images && images.length > 0
      ? images
      : [
          "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=1200&q=80",
        ];

  const currentImage = validImages[selectedIndex] || validImages[0];

  const handlePrev = () => {
    setSelectedIndex((prev) => (prev === 0 ? validImages.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setSelectedIndex((prev) => (prev === validImages.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Primary Display Frame */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/80 shadow-2xl group">
        <Image
          src={currentImage}
          alt={`${title} - ảnh ${selectedIndex + 1}`}
          fill
          priority
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
          className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
        />

        {/* Subtle Gradient Vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/60 via-transparent to-transparent pointer-events-none" />

        {/* Counter Badge */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-md border border-zinc-700/80 bg-zinc-900/90 px-2.5 py-1 text-xs font-mono text-zinc-300 backdrop-blur-md">
          <Eye className="h-3.5 w-3.5 text-zinc-400" />
          <span>
            {selectedIndex + 1} / {validImages.length}
          </span>
        </div>

        {/* Prev / Next controls if multiple images */}
        {validImages.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Ảnh trước"
              className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700/70 bg-zinc-900/80 text-zinc-200 opacity-0 backdrop-blur-md transition-opacity duration-200 hover:bg-zinc-800 hover:text-white group-hover:opacity-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Ảnh kế tiếp"
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700/70 bg-zinc-900/80 text-zinc-200 opacity-0 backdrop-blur-md transition-opacity duration-200 hover:bg-zinc-800 hover:text-white group-hover:opacity-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnail Strip */}
      {validImages.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin">
          {validImages.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedIndex(idx)}
              className={cn(
                "relative h-18 w-24 shrink-0 overflow-hidden rounded-lg border bg-zinc-900 transition-all",
                selectedIndex === idx
                  ? "border-zinc-200 ring-2 ring-zinc-400/30 ring-offset-2 ring-offset-zinc-950"
                  : "border-zinc-800/80 opacity-60 hover:opacity-100 hover:border-zinc-700"
              )}
            >
              <Image
                src={img}
                alt={`${title} thumbnail ${idx + 1}`}
                fill
                sizes="96px"
                className="object-cover object-center"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
