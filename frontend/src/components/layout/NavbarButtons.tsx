"use client";

import { useShop } from "@/context/ShopContext";

export default function NavbarButtons() {
  const { cartCount, setCartOpen, setAccountOpen, customer } = useShop();

  return (
    <div className="flex items-center gap-2">
      {/* Account */}
      <button
        onClick={() => setAccountOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium hover:bg-black/5"
        title={customer ? "Your account" : "Sign in"}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span className="hidden sm:inline max-w-[8rem] truncate">
          {customer ? customer.name.split(" ")[0] : "Sign in"}
        </span>
      </button>

      {/* Cart */}
      <button
        onClick={() => setCartOpen(true)}
        className="relative flex items-center gap-2 px-3 py-2 rounded text-sm font-medium hover:bg-black/5"
        title="Cart"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        <span className="hidden sm:inline">Cart</span>
        {cartCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--plum)] text-white text-[11px] font-semibold flex items-center justify-center">
            {cartCount > 99 ? "99+" : cartCount}
          </span>
        )}
      </button>
    </div>
  );
}
