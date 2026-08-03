"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export default function Share() {
  const [url, setUrl] = useState("");

  return (
    <section id="share" className="px-[6vw] py-24 max-w-[1180px] mx-auto">
      <div className="text-center max-w-xl mx-auto mb-12">
        <div className="font-script text-[var(--plum)] text-2xl mb-1">share the page</div>
        <h2 className="text-4xl">Scan &amp; Share</h2>
      </div>

      <div className="grid md:grid-cols-2 gap-12 items-center bg-[var(--paper)] border border-black/10 rounded-2xl p-10">
        <div>
          <h3 className="text-xl mb-2">Turn this page into a QR code</h3>
          <p className="text-[#5a4633] text-sm mb-4">
            Paste your published site link and a QR code will appear — print it on a business
            card, basket tag, or flyer.
          </p>
          <label className="block text-xs font-semibold uppercase text-[var(--jade-deep)] mb-1">
            Your page link
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://designsbydeshonda.com"
            className="w-full px-3 py-3 border border-black/20 rounded bg-[var(--sand)]"
          />
        </div>

        <div className="flex items-center justify-center bg-[var(--sand)] rounded-lg min-h-[220px] p-6">
          {url ? (
            <QRCodeSVG value={url} size={180} fgColor="#0E2A20" bgColor="#F3E9D6" />
          ) : (
            <span className="text-[#8a7a68] text-sm">Your QR code will appear here</span>
          )}
        </div>
      </div>
    </section>
  );
}