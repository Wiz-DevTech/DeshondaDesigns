"use client";

import { useState } from "react";
import Image from "next/image";

const GALLERY_IMAGES = [
  { src: "/images/gallery/gift-1.jpeg", caption: "Handcrafted gift basket" },
  { src: "/images/gallery/gift-2.jpeg", caption: "Handcrafted gift basket" },
  { src: "/images/gallery/gift-3.jpeg", caption: "Handcrafted gift basket" },
  { src: "/images/gallery/gift-4.jpeg", caption: "Handcrafted gift basket" },
];

export default function Gallery() {
  const [active, setActive] = useState(0);

  return (
    <section id="gallery" className="px-[6vw] py-24 max-w-[1180px] mx-auto">
      <div className="text-center max-w-xl mx-auto mb-12">
        <div className="font-script text-[var(--plum)] text-2xl mb-1">the gallery</div>
        <h2 className="text-4xl">See What I&apos;ve Been Making</h2>
      </div>

      <div className="relative rounded-md overflow-hidden aspect-square md:aspect-video bg-[var(--sand-2)] border border-black/10">
        <Image
          src={GALLERY_IMAGES[active].src}
          alt={GALLERY_IMAGES[active].caption}
          fill
          className="object-contain"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent text-white text-sm px-4 py-3">
          {GALLERY_IMAGES[active].caption}
        </div>

        <button
          onClick={() => setActive((active - 1 + GALLERY_IMAGES.length) % GALLERY_IMAGES.length)}
          className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full w-9 h-9 flex items-center justify-center text-lg"
        >
          ‹
        </button>
        <button
          onClick={() => setActive((active + 1) % GALLERY_IMAGES.length)}
          className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full w-9 h-9 flex items-center justify-center text-lg"
        >
          ›
        </button>
      </div>

      <div className="flex justify-center gap-2 mt-4">
        {GALLERY_IMAGES.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`w-2.5 h-2.5 rounded-full ${i === active ? "bg-[var(--jade-deep)]" : "bg-black/20"}`}
          />
        ))}
      </div>
    </section>
  );
}