import Image from "next/image";

export default function Hero() {
  return (
    <section className="relative w-full overflow-hidden bg-[var(--sand)]">
      {/* Mobile: square hero-main at natural ratio — full image, no crop */}
      <div className="w-full sm:hidden">
        <Image
          src="/images/hero/hero-main.png"
          alt=""
          width={1254}
          height={1254}
          priority
          sizes="100vw"
          className="w-full h-auto"
        />
      </div>
      {/* Tablet/desktop: wide banner at natural ratio — full width, no side crop */}
      <div className="hidden w-full sm:block">
        <Image
          src="/images/hero/hero-secondary.png"
          alt=""
          width={1942}
          height={809}
          priority
          sizes="100vw"
          className="w-full h-auto"
        />
      </div>
    </section>
  );
}