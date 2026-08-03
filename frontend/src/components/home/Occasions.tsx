"use client";

import { useState } from "react";

const OCCASIONS = [
  { emoji: "🎄", title: "Holiday", desc: "Christmas & New Year gifting, custom themed" },
  { emoji: "🎂", title: "Birthday", desc: "Sweet, cozy, and personal" },
  { emoji: "👶🏾", title: "Baby & Shower", desc: "Soft crochet sets & keepsakes" },
  { emoji: "💐", title: "Sympathy", desc: "Comfort baskets, gently made" },
  { emoji: "💍", title: "Wedding", desc: "Elegant baskets for the new couple" },
  { emoji: "🙏🏾", title: "Just Because", desc: "A blessing for no reason at all" },
];

export default function Occasions() {
  const [openOccasion, setOpenOccasion] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);

  return (
    <section id="baskets" className="px-[6vw] py-24 max-w-[1180px] mx-auto">
      <div className="text-center max-w-xl mx-auto mb-12">
        <div className="font-script text-[var(--plum)] text-2xl mb-1">
          gift baskets for every season
        </div>
        <h2 className="text-4xl">A Basket for Every Occasion</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {OCCASIONS.map((o) => (
          <button
            key={o.title}
            onClick={() => { setOpenOccasion(o.title); setSlide(0); }}
            className="bg-[var(--paper)] border border-black/10 rounded-md p-5 text-center hover:-translate-y-1 hover:border-[var(--purple)] transition"
          >
            <div className="text-3xl mb-2">{o.emoji}</div>
            <h4 className="font-semibold text-[var(--jade-deep)]" style={{ fontFamily: "var(--font-cinzel)" }}>
              {o.title}
            </h4>
            <p className="text-sm text-[#6b5a49] mt-1">{o.desc}</p>
          </button>
        ))}
      </div>

      {openOccasion && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center px-4"
          onClick={() => setOpenOccasion(null)}
        >
          <div
            className="bg-[var(--paper)] rounded-lg max-w-lg w-full p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpenOccasion(null)}
              className="absolute top-3 right-3 text-2xl text-[var(--jade-deep)] leading-none"
            >
              ×
            </button>
            <h3 className="text-2xl mb-4 text-center">{openOccasion} Examples</h3>

            <div className="relative aspect-square rounded-md overflow-hidden bg-[var(--sand-2)] border border-black/10 flex items-center justify-center">
              <span className="text-[#8a7a68] text-sm px-6 text-center">
                Example photo {slide + 1} of 2 — placeholder, swap for a real {openOccasion} basket photo later
              </span>
            </div>

            <div className="flex justify-center gap-2 mt-4">
              {[0, 1].map((i) => (
                <button
                  key={i}
                  onClick={() => setSlide(i)}
                  className={`w-2.5 h-2.5 rounded-full ${i === slide ? "bg-[var(--jade-deep)]" : "bg-black/20"}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}