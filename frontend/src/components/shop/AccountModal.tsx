"use client";

import { useState, type FormEvent } from "react";
import { useShop } from "@/context/ShopContext";

export default function AccountModal() {
  const { accountOpen, setAccountOpen, customer, login, register, logout } = useShop();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [optIn, setOptIn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!accountOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        await register(name.trim(), email.trim(), password, phone.trim() || undefined);
      }
      setPassword("");
      setAccountOpen(false);
    } catch (err) {
      setError((err as Error).message || "Something went wrong — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-label="Account">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setAccountOpen(false)} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-[var(--paper)] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/10">
          <h3 className="text-lg font-semibold">
            {customer ? "Your Account" : mode === "login" ? "Sign In" : "Create Account"}
          </h3>
          <button
            onClick={() => setAccountOpen(false)}
            aria-label="Close"
            className="w-8 h-8 rounded-full hover:bg-black/10 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {customer ? (
          <div className="grow px-5 py-6 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--sand-2)] border border-black/10 flex items-center justify-center text-2xl">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold">{customer.name}</div>
              <div className="text-sm opacity-60">{customer.email}</div>
            </div>
            <p className="text-sm opacity-70">
              You&apos;re signed in — add items to your cart and check out anytime.
            </p>
            <button
              onClick={() => {
                logout();
                setAccountOpen(false);
              }}
              className="mt-2 text-sm text-red-600 underline underline-offset-2"
            >
              Sign out
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grow px-5 py-6 flex flex-col gap-4 overflow-y-auto">
            <div className="flex gap-2 text-sm">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`flex-1 py-2 rounded font-medium ${
                  mode === "login" ? "bg-[var(--purple)] text-[var(--jade-deep)]" : "bg-black/5 hover:bg-black/10"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode("register")}
                className={`flex-1 py-2 rounded font-medium ${
                  mode === "register" ? "bg-[var(--purple)] text-[var(--jade-deep)]" : "bg-black/5 hover:bg-black/10"
                }`}
              >
                Create Account
              </button>
            </div>

            {mode === "register" && (
              <>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="opacity-70">Name</span>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="px-3 py-2.5 rounded border border-black/15 bg-white text-[var(--ink)]"
                    placeholder="Your name"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="opacity-70">Phone (optional)</span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="px-3 py-2.5 rounded border border-black/15 bg-white text-[var(--ink)]"
                    placeholder="(555) 123-4567"
                  />
                </label>
              </>
            )}

            <label className="flex flex-col gap-1 text-sm">
              <span className="opacity-70">Email</span>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="px-3 py-2.5 rounded border border-black/15 bg-white text-[var(--ink)]"
                placeholder="you@email.com"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="opacity-70">Password</span>
              <input
                required
                type="password"
                minLength={mode === "register" ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="px-3 py-2.5 rounded border border-black/15 bg-white text-[var(--ink)]"
                placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
              />
            </label>

            {mode === "register" && (
              <label className="flex items-start gap-2 text-xs opacity-80">
                <input
                  type="checkbox"
                  checked={optIn}
                  onChange={(e) => setOptIn(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Send me occasional discounts and updates — never sold to third parties.
                </span>
              </label>
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-[var(--purple)] text-[var(--jade-deep)] font-semibold px-4 py-3 rounded hover:opacity-90 disabled:opacity-50 text-sm"
            >
              {busy ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
            </button>

            {mode === "login" && (
              <p className="text-xs opacity-60 text-center">
                Accounts let you keep a cart and check out with card payments.
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
