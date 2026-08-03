"use client";

import { QRCodeSVG } from "qrcode.react";

const CASHAPP_HANDLE = "$DeShondaDavis25";
const CASHAPP_URL = "https://cash.app/$DeShondaDavis25";

export function CashAppHandle() {
  return <span className="whitespace-nowrap">{CASHAPP_HANDLE}</span>;
}

/**
 * Cash App payment block — QR code + handle + instructions.
 * Used on the home page (pay section) and inside the cart drawer (compact).
 */
export default function CashAppPay({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center gap-4 rounded-lg border border-black/10 bg-white p-3">
        <div className="shrink-0 rounded-md bg-white p-1">
          <QRCodeSVG value={CASHAPP_URL} size={92} bgColor="#ffffff" fgColor="#1a1a1a" />
        </div>
        <div className="text-sm">
          <div className="font-semibold">
            Pay with <CashAppHandle />
          </div>
          <p className="text-xs opacity-70 mt-1">
            Scan the code with the Cash App on your phone, or send to{" "}
            <CashAppHandle />. Include your order number in the note.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section id="pay" className="px-[6vw] py-20 max-w-[1180px] mx-auto text-center">
      <div className="font-script text-[var(--plum)] text-2xl mb-1">easy payments</div>
      <h2 className="text-4xl">Pay with Cash App</h2>
      <p className="text-sm opacity-70 mt-3 max-w-[48ch] mx-auto">
        The simplest way to pay for your order — scan the code with the Cash App
        on your phone, or send to{" "}
        <span className="font-semibold text-[var(--jade-deep)]">
          <CashAppHandle />
        </span>
        . Please include your name or order number in the note so DeShonda can
        match it up.
      </p>

      <div className="mt-8 inline-block rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <QRCodeSVG
          value={CASHAPP_URL}
          size={200}
          bgColor="#ffffff"
          fgColor="#1a1a1a"
          level="M"
        />
      </div>

      <div className="mt-5 text-sm font-semibold text-[var(--jade-deep)]">
        <CashAppHandle />
      </div>
      <p className="mt-2 text-xs opacity-60">
        Open Cash App → tap the scan icon → scan this code → send your payment.
      </p>
    </section>
  );
}
