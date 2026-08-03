"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  formatPrice,
  getToken,
  setToken,
  type CartItem,
  type Customer,
  type Product,
} from "@/lib/api";

interface ShopState {
  products: Product[];
  cart: CartItem[];
  customer: Customer | null;
  cartCount: number;
  cartTotal: string;
  cartOpen: boolean;
  accountOpen: boolean;
  setCartOpen: (v: boolean) => void;
  setAccountOpen: (v: boolean) => void;
  refreshCart: () => Promise<void>;
  addToCart: (productId: number) => Promise<void>;
  removeFromCart: (productId: number) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, phone?: string) => Promise<void>;
  logout: () => void;
  startCheckout: () => Promise<void>;
}

const ShopContext = createContext<ShopState | null>(null);

export function useShop(): ShopState {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop must be used within ShopProvider");
  return ctx;
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const refreshCart = useCallback(async () => {
    if (!getToken()) {
      setCart([]);
      return;
    }
    try {
      setCart(await api.getCart());
    } catch {
      setCart([]);
    }
  }, []);

  // restore session on load
  useEffect(() => {
    if (!getToken()) return;
    api
      .getMe()
      .then((c) => setCustomer(c))
      .catch(() => setToken(null));
    refreshCart().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // load the catalog
  useEffect(() => {
    api
      .getProducts()
      .then((rows) => setProducts(rows || []))
      .catch(() => setProducts([]));
  }, []);

  const cartCount = useMemo(() => cart.reduce((n, i) => n + i.quantity, 0), [cart]);
  const cartTotal = useMemo(
    () => formatPrice(cart.reduce((sum, i) => sum + i.price_cents * i.quantity, 0)),
    [cart]
  );

  const addToCart = useCallback(
    async (productId: number) => {
      await api.addToCart(productId, 1);
      await refreshCart();
    },
    [refreshCart]
  );

  const removeFromCart = useCallback(
    async (productId: number) => {
      await api.removeFromCart(productId);
      await refreshCart();
    },
    [refreshCart]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await api.customerLogin(email, password);
      setToken(data.token);
      setCustomer(data.customer);
      await refreshCart();
    },
    [refreshCart]
  );

  const register = useCallback(
    async (name: string, email: string, password: string, phone?: string) => {
      const data = await api.customerRegister(name, email, password, phone);
      setToken(data.token);
      setCustomer(data.customer);
      await refreshCart();
    },
    [refreshCart]
  );

  const logout = useCallback(() => {
    setToken(null);
    setCustomer(null);
    setCart([]);
  }, []);

  const startCheckout = useCallback(async () => {
    const data = await api.checkout();
    if (data?.checkout_url) {
      window.location.href = data.checkout_url;
    }
  }, []);

  const value: ShopState = {
    products,
    cart,
    customer,
    cartCount,
    cartTotal,
    cartOpen,
    accountOpen,
    setCartOpen,
    setAccountOpen,
    refreshCart,
    addToCart,
    removeFromCart,
    login,
    register,
    logout,
    startCheckout,
  };

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}
