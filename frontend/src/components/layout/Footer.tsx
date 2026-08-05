"use client";

import { useState, type FormEvent } from "react";

export default function Footer() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/signups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      if (!res.ok) throw new Error("Signup failed");
      setStatus("success");
      setName("");
      setEmail("");
    } catch {
      setStatus("error");
    }
  }

  return (
    <footer id="join" className="bg-[var(--jade-deep)] text-[var(--paper)] px-[6vw] py-20 text-center">
      <div className="font-script text-[var(--purple-light)] text-xl mb-1">
        don&apos;t miss the holiday drop
      </div>
      <h2 className="text-3xl text-[var(--paper)]">Join DeShonda&apos;s List</h2>
      <p className="opacity-85 max-w-[44ch] mx-auto mt-2 text-sm">
        Be the first to know about new baskets, crochet drops, and holiday booking dates.
      </p>

      <form onSubmit={handleSubmit} className="max-w-md mx-auto mt-8 flex gap-2 flex-wrap justify-center">
        <input
          type="text"
          required
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-3 rounded text-[var(--ink)] bg-[var(--sand)] placeholder:text-[#8a7a68]"
        />
        <input
          type="email"
          required
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-3 rounded text-[var(--ink)] bg-[var(--sand)] placeholder:text-[#8a7a68]"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="bg-[var(--purple)] text-[var(--jade-deep)] font-semibold px-6 py-3 rounded"
        >
          {status === "loading" ? "Joining..." : "Join"}
        </button>
      </form>

      {status === "success" && (
        <p className="text-sm mt-3 text-[var(--purple-light)]">Thanks — you&apos;re on the list! 🎉</p>
      )}
      {status === "error" && (
        <p className="text-sm mt-3 text-red-300">
          Something went wrong — please check your connection and try again.
        </p>
      )}

      <div className="flex gap-5 justify-center flex-wrap mt-12 text-sm opacity-70">
        <span>🧶 Crochet</span>
        <span>🧺 Gift Baskets</span>
        <span>📍 Custom Orders Welcome</span>
      </div>

      <div className="mt-8 text-xs opacity-40">
        <a href="/admin.html" className="hover:opacity-100 hover:underline">Admin</a>
      </div>

      <div className="mt-10 text-xs opacity-80 leading-7">
        <div>
          Developed by{" "}
          <a href="https://wizdevtech.com/" target="_blank" rel="noopener" className="underline hover:opacity-100">
            WizDevTech Business Solutions
          </a>
        </div>
        <div>
          ✉️ Support Email:{" "}
          <a href="mailto:support@wizdevtech.com" className="underline hover:opacity-100">
            support@wizdevtech.com
          </a>
        </div>
        <div>
          Email DeShonda:{" "}
          <a href="mailto:designsbydeshonda@gmail.com" className="underline hover:opacity-100">
            designsbydeshonda@gmail.com
          </a>
        </div>
        <div>© 2026 DeShonda Designs · DeShonda Davis. All rights reserved.</div>
      </div>
    </footer>
  );
}