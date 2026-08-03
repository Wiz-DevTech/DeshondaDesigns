// Client-side API client for the DeShonda worker API.
// Same origin by default (NEXT_PUBLIC_API_URL="" at build) — the worker
// serves both the static site and /api/*.
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export interface Product {
  id: number;
  name: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  category: string | null;
  active: number;
  created_at: string;
}

export interface CartItem {
  product_id: number;
  quantity: number;
  name: string;
  price_cents: number;
  image_url: string | null;
}

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string | null;
}

const TOKEN_KEY = "deshonda_customer_token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

async function request(path: string, opts: RequestInit & { token?: boolean } = {}) {
  const headers: Record<string, string> = {
    ...((opts.headers as Record<string, string>) || {}),
  };
  if (opts.body && !(opts.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (opts.token) {
    const t = getToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    (err as any).status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  getProducts: () => request("/api/products"),
  signup: (name: string, email: string) =>
    request("/api/signups", { method: "POST", body: JSON.stringify({ name, email }) }),

  customerRegister: (name: string, email: string, password: string, phone?: string) =>
    request("/api/customers/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password, phone }),
    }),
  customerLogin: (email: string, password: string) =>
    request("/api/customers/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  getMe: () => request("/api/customers/me", { token: true }),

  getCart: () => request("/api/cart", { token: true }),
  addToCart: (product_id: number, quantity = 1) =>
    request("/api/cart", { method: "POST", token: true, body: JSON.stringify({ product_id, quantity }) }),
  removeFromCart: (productId: number) =>
    request(`/api/cart/${productId}`, { method: "DELETE", token: true }),
  checkout: () => request("/api/checkout", { method: "POST", token: true }),
};

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
