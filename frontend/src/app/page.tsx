import Navbar from "@/components/layout/Navbar";
import Hero from "@/components/home/Hero";
import About from "@/components/home/About";
import Blessing from "@/components/home/Blessing";
import Gallery from "@/components/home/Gallery";
import Occasions from "@/components/home/Occasions";
import ShopSection from "@/components/shop/ShopSection";
import CashAppPay from "@/components/shop/CashAppPay";
import Share from "@/components/home/Share";
import Footer from "@/components/layout/Footer";

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <About />
      <Blessing />
      <Gallery />
      <Occasions />
      <ShopSection />
      <CashAppPay />
      <Share />
      <Footer />
    </main>
  );
}
