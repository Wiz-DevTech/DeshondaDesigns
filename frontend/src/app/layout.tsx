import type { Metadata } from "next";
import { Cinzel, Work_Sans, Caveat } from "next/font/google";
import "./globals.css";
import { ShopProvider } from "@/context/ShopContext";
import CartDrawer from "@/components/shop/CartDrawer";
import AccountModal from "@/components/shop/AccountModal";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "Designs by DeShonda",
  description: "Handmade crochet & gift baskets, made with love.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${workSans.variable} ${caveat.variable}`}
    >
      <body className="min-h-full flex flex-col">
        <ShopProvider>
          {children}
          <CartDrawer />
          <AccountModal />
        </ShopProvider>
      </body>
    </html>
  );
}
