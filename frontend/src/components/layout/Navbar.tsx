import Image from "next/image";
import Link from "next/link";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-[5vw] py-4 bg-[var(--sand)]/90 backdrop-blur-md border-b border-black/[0.08]">
      <Link href="/" className="flex items-center gap-2">
        <Image
          src="/images/branding/logo.png"
          alt="Designs by Deshonda"
          width={160}
          height={60}
          className="h-auto w-32"
          priority
        />
      </Link>

      <nav className="hidden md:flex gap-7 text-sm font-medium">
        <a href="#about" className="hover:text-[var(--plum)]">About</a>
        <a href="#gallery" className="hover:text-[var(--plum)]">Gallery</a>
        <a href="#baskets" className="hover:text-[var(--plum)]">Occasions</a>
        <a href="#share" className="hover:text-[var(--plum)]">Share</a>
        <a href="#join" className="hover:text-[var(--plum)]">Join the List</a>
      </nav>
    </header>
  );
}