import Image from "next/image";

export default function Hero() {
  return (
    <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
      <Image
        src="/images/hero/hero-secondary.png"
        alt=""
        width={1920}
        height={1080}
        priority
        className="object-contain -z-10"
      />
      <div className="text-center 70 px-8 py-6 rounded-lg">
        
        <p className="mt-4 text-xl text-gray-600">
        
        </p>
      </div>
    </section>
  );
}