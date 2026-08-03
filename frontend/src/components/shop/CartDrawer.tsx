"use client";

import { useState } from "react";
import { useShop } from "@/context/ShopContext";
import { formatPrice } from "@/lib/api";

export default function CartDrawer() {
  const {
    cart,
    cartOpen,
    cartTotal,
    setCartOpen,
    removeFromCart,
    startCheckout,
    customer,
    setAccountOpen,
  } = useShop();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!cartOpen) return null;

  async function handleCheckout() {
    setBusy(true);
    setError(null);
    try {
      await startCheckout();
      // on success the page navigates to Stripe; if we return, it failed
    } catch (e) {
      setError(
        (e as Error).message ||
          "Checkout isn't available yet — please try again shortly."
      );
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-label="Shopping cart">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => setCartOpen(false)}
      />
      {/* panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-[var(--paper)] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/10">
          <h3 className="text-lg font-semibold">
            Your Cart{" "}
            <span className="text-sm font-normal opacity-60">
              ({cart.reduce((n, i) => n + i.quantity, 0)} items)
            </span>
          </h3>
          <button
            onClick={() => setCartOpen(false)}
            aria-label="Close cart"
            className="w-8 h-8 rounded-full hover:bg-black/10 text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="grow overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {cart.length === 0 ? (
            <div className="text-center text-sm opacity-60 py-10">
              {customer ? (
                "Your cart is empty."
              ) : (
                <>
                  <p>Your cart is empty.</p>
                  <button
                    onClick={() => {
                      setCartOpen(false);
                      setAccountOpen(true);
                    }}
                    className="mt-3 text-[var(--plum)] underline underline-offset-2"
                  >
                    Sign in to see saved items
                  </button>
                </>
              )}
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product_id} className="flex gap-3 items-center">
                <div className="w-16 h-16 shrink-0 rounded overflow-hidden bg-[var(--sand)] flex items-center justify-center">
                  {item.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>🧺</span>
                  )}
                </div>
                <div className="grow min-w-0">
                  <div className="text-sm font-medium truncate">{item.name}</div>
                  <div className="text-xs opacity-60">
                    {formatPrice(item.price_cents)} × {item.quantity}
                  </div>
                </div>
                <div className="text-sm font-semibold">
                  {formatPrice(item.price_cents * item.quantity)}
                </div>
                <button
                  onClick={() => removeFromCart(item.product_id).catch(() => {})}
                  aria-label={`Remove ${item.name}`}
                  className="w-7 h-7 rounded-full hover:bg-black/10 text-sm opacity-60 hover:opacity-100"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-black/10 px-5 py-4 flex flex-col gap-3">
          <div className="flex justify-between text-sm">
            <span className="opacity-70">Total</span>
            <span className="font-semibold">{cartTotal}</span>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || busy}
            className="w-full bg-[var(--purple)] text-[var(--jade-deep)] font-semibold px-4 py-3 rounded hover:opacity-90 disabled:opacity-50 text-sm"
          >
            {busy ? "Taking you to checkout…" : "Checkout"}
          </button>
          <button
            onClick={() => setCartOpen(false)}
            className="text-xs opacity-60 hover:opacity-100 underline underline-offset-2"
          >
            Keep shopping
          </button>
        </div>
      </div>
    </div>
  );
}
