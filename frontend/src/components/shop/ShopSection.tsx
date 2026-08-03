"use client";

import { useState } from "react";
import { useShop } from "@/context/ShopContext";
import { formatPrice } from "@/lib/api";

export default function ShopSection() {
  const { products, customer, addToCart, setAccountOpen, setCartOpen } = useShop();
  const [adding, setAdding] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(productId: number) {
    setError(null);
    if (!customer) {
      setAccountOpen(true);
      return;
    }
    setAdding(productId);
    try {
      await addToCart(productId);
      setCartOpen(true);
    } catch {
      setError("Couldn't add to cart — please try again.");
    } finally {
      setAdding(null);
    }
  }

  return (
    <section id="shop" className="px-[6vw] py-24 max-w-[1180px] mx-auto">
      <div className="text-center max-w-xl mx-auto mb-12">
        <div className="font-script text-[var(--plum)] text-2xl mb-1">the shop</div>
        <h2 className="text-4xl">Shop the Collection</h2>
        <p className="text-sm opacity-70 mt-3">
          Handmade baskets and crochet, made to order. Create a free account to add
          items to your cart.
        </p>
      </div>

      {error && <p className="text-center text-sm text-red-600 mb-6">{error}</p>}

      {products.length === 0 ? (
        <p className="text-center text-sm opacity-60 py-10">
          New items are being added — check back soon! 🧺
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((p) => (
            <div
              key={p.id}
              className="flex flex-col rounded-md overflow-hidden border border-black/10 bg-[var(--sand-2)]"
            >
              <div className="aspect-square w-full bg-[var(--sand)] flex items-center justify-center overflow-hidden">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image_url}
                    alt={p.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-4xl">🧺</span>
                )}
              </div>
              <div className="p-4 flex flex-col gap-2 grow">
                <div className="text-center">
                  <h3 className="font-medium text-[var(--ink)] leading-snug">{p.name}</h3>
                  <div className="mt-1 text-[var(--plum)] font-semibold">
                    {formatPrice(p.price_cents)}
                  </div>
                </div>
                <button
                  onClick={() => handleAdd(p.id)}
                  disabled={adding === p.id}
                  className="mt-auto w-full bg-[var(--purple)] text-[var(--jade-deep)] font-semibold px-4 py-2.5 rounded hover:opacity-90 disabled:opacity-60 text-sm"
                >
                  {adding === p.id ? "Adding…" : "Add to cart"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
