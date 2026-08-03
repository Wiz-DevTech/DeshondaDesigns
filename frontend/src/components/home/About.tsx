export default function About() {
  return (
    <section id="about" className="px-[6vw] py-24 max-w-[1180px] mx-auto">
      <div className="grid md:grid-cols-[1fr_1.15fr] gap-14 items-center">
        <div className="relative aspect-[4/5] rounded-md overflow-hidden bg-gradient-to-br from-[var(--jade)] to-[var(--jade-deep)] flex items-end p-6">
          <span className="absolute top-5 right-6 text-[var(--purple-light)] text-2xl">✦</span>
          <span className="bg-[var(--paper)] text-[var(--jade-deep)] px-4 py-2 text-sm font-semibold rounded-sm">
            Deshonda Davis · Owner &amp; Maker
          </span>
        </div>

        <div>
          <div className="font-script text-[var(--plum)] text-2xl mb-1">a little about me</div>
          <h3 className="text-3xl mb-4">Rooted in faith, family, and fiber.</h3>
          <p className="text-[#4a382a] mb-3">
            I&apos;m an urban, natural-living woman with a little rasta in my soul — I believe in real
            ingredients, real color, and real love. My hands have been busy with a crochet hook since I
            was a girl, and these days I get to share that gift with my children, my grandchildren, and
            now, with you.
          </p>
          <p className="text-[#4a382a] mb-3">
            Every gift basket and every crochet piece I make is a little offering — beauty, love,
            respect, and honor, wrapped up for someone you care about.
          </p>

          <div className="flex flex-wrap gap-3 mt-6">
            {[
              "🧶 Handmade Crochet",
              "🧺 Gift Baskets, Any Occasion",
              "🙏 God-Fearing & Grateful",
              "👵🏾 Mother & Grandmother",
            ].map((label) => (
              <div
                key={label}
                className="bg-[var(--paper)] border border-black/10 px-4 py-3 rounded text-sm font-semibold text-[var(--jade-deep)]"
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}