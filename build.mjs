import { readFile, writeFile, mkdir, rm, readdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import sharp from "sharp";
import { createHash } from "crypto";
import { fileURLToPath } from "url";

// Everything resolves from the script, so a clone rebuilds anywhere.
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const IMG  = path.join(ROOT, "images");
const SITE = "https://portfolio.swoopnebula.com";
const live = JSON.parse(await readFile(path.join(ROOT, "data-live.json"), "utf8"));
const blocks = JSON.parse(await readFile(path.join(ROOT, "data-blocks.json"), "utf8"));
const ORDER = Object.keys(live);               // the order the live rail uses
const VER = Date.now().toString(36);
// Meta descriptions are cut to length on a word boundary, never mid-word.
const trim = (s, n) => {
  const t = String(s).replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n - 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), 0)).replace(/[,;:.]$/, "") + "\u2026";
};
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

const SOCIAL = {
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/></svg>',
  youtube: '<svg viewBox="0 0 24 24"><path d="M23 12s0-3.3-.4-4.9a2.6 2.6 0 00-1.8-1.8C19.2 5 12 5 12 5s-7.2 0-8.8.4a2.6 2.6 0 00-1.8 1.8C1 8.7 1 12 1 12s0 3.3.4 4.9c.2.9.9 1.6 1.8 1.8C4.8 19 12 19 12 19s7.2 0 8.8-.4a2.6 2.6 0 001.8-1.8c.4-1.6.4-4.8.4-4.8zM9.7 15.1V8.9l6 3.1-6 3.1z"/></svg>',
};

function shell({ title, desc, slug, main, abs, noindex }) {
  // 404.html is served from any depth, so its links have to be absolute.
  const up = abs ? "/" : slug ? "../" : "";
  const nav = ORDER.map(s => {
    const cur = s === slug ? ' aria-current="page"' : "";
    return `      <a href="${up}${s}/"${cur}>${esc(live[s].label)}</a>`;
  }).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${SITE}/${slug ? slug + "/" : ""}">`}
<meta property="og:type" content="${slug ? "article" : "website"}">
<meta property="og:site_name" content="Swoop Nebula">
<meta property="og:url" content="${SITE}/${slug ? slug + "/" : ""}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${SITE}/images/_covers/${slug || "sharing-excess"}.webp">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${SITE}/images/_covers/${slug || "sharing-excess"}.webp">
<meta name="theme-color" content="#0b0b0b">
<link rel="icon" href="${up}favicon.ico" sizes="any">
<link rel="icon" href="${up}assets/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="${up}assets/apple-touch-icon.png">
<link rel="stylesheet" href="${up}assets/site.css?v=${VER}">
</head>
<body>
<div id="scroll">

  <header class="mast" data-pin>
    <a class="brand" href="${up || "./"}"><span>Swoop Nebula</span></a>
    <nav class="links">
      <a href="https://thevisualpharmacy.com">Shop</a>
      <a href="https://www.instagram.com/swoopnebula/" aria-label="Instagram">${SOCIAL.instagram}</a>
      <a href="https://www.youtube.com/@swoopnebula" aria-label="YouTube">${SOCIAL.youtube}</a>
    </nav>
  </header>

  <div class="frame">
    <aside class="rail" data-pin="wide">
      <a class="polaroid" href="${up || "./"}" aria-label="All work">
        <img src="${up}images/_covers/_avatar.webp" alt="Swoop Nebula" width="420" height="454">
      </a>
      <h1>Swoop Nebula</h1>
      <a class="cta" href="https://swoop.thevisualpharmacy.com/">Work with me</a>
      <nav class="railnav">
${nav}
      </nav>
    </aside>

    <main>
${main}
    </main>
  </div>
</div>
<div class="gutter" aria-hidden="true"></div>
<a class="tag" href="https://swoop.thevisualpharmacy.com/">Work with me</a>
<script src="${up}assets/site.js?v=${VER}"></script>
</body>
</html>
`;
}

// index --------------------------------------------------------------------
const tiles = ORDER.map((s, i) => `      <a class="rise" href="${s}/">
        <img class="lazy" src="images/_covers/${s}.webp" alt="${esc(live[s].title)}"
          loading="${i < 6 ? "eager" : "lazy"}" decoding="async">
        <span class="cap">${esc(live[s].label)}</span>
      </a>`).join("\n");

await writeFile(path.join(ROOT, "index.html"), shell({
  title: "Swoop Nebula — Portfolio",
  desc: "Design work by Swoop Nebula: posters, merchandise, campaigns and social design.",
  slug: "",
  main: `      <div class="collage" id="work">\n${tiles}\n      </div>`,
}));

// projects -----------------------------------------------------------------
for (let i = 0; i < ORDER.length; i++) {
  const slug = ORDER[i];
  const p = live[slug];
  const next = live[ORDER[(i + 1) % ORDER.length]];
  /* The live pages alternate: a paragraph or two, then the work it describes,
     then the next paragraph. Runs of each are grouped, so consecutive text
     reads as one two-column block and consecutive images sit in one grid. */
  const runs = [];
  for (const b of (blocks[slug] || [])) {
    const kind = b.t === "p" ? "text" : "media";
    if (!runs.length || runs[runs.length - 1].kind !== kind) runs.push({ kind, items: [] });
    runs[runs.length - 1].items.push(b);
  }

  const body = (await Promise.all(runs.map(async (run) => {
    if (run.kind === "text") {
      return '      <div class="copy rise">\n' +
        run.items.map((b) => "        <p>" + esc(b.v) + "</p>").join("\n") +
        "\n      </div>";
    }
    const plates = (await Promise.all(run.items.map(async (b) => {
      // The box takes its shape from the piece it holds, so the artwork is
      // flush on all four sides inside the padding. A video is measured from
      // its poster frame, which is the same footage.
      const base0 = b.out.replace(/\.(mp4|webp)$/, "");
      const probe = b.kind === "video"
        ? path.join(IMG, slug, base0 + ".poster.webp")
        : path.join(IMG, slug, b.out);
      let wide = "", ar = "";
      if (existsSync(probe)) {
        const m = await sharp(probe).metadata();
        const r = m.width / m.height;
        if (r > 1.45) wide = " is-wide";
        ar = ' style="--ar: ' + (Math.round(r * 1000) / 1000) + '"';
      }

      if (b.kind === "video") {
        const base = b.out.replace(/\.mp4$/, "");
        const poster = existsSync(path.join(IMG, slug, base + ".poster.webp"))
          ? ' poster="../images/' + slug + "/" + base + '.poster.webp"' : "";
        return '        <figure class="plate rise' + wide + '"' + ar + '><video data-inview muted loop playsinline preload="none"' +
          poster + '>\n          <source src="../images/' + slug + "/" + b.out +
          '" type="video/mp4"></video></figure>';
      }
      // Landscape work earns the full width. Measured from the file that is
      // actually being placed, not from data carried alongside it, because
      // that is what drifted last time.
      return '        <figure class="plate rise' + wide + '"' + ar + '><img class="lazy" src="../images/' +
        slug + "/" + b.out + '"\n          alt="' + esc(p.title) +
        '" loading="lazy" decoding="async"></figure>';
    }))).join("\n");
    // A run of one gets the whole width; two or more sit two across.
    const only = run.items.length === 1 ? " is-single" : "";
    return '      <div class="plates' + only + '">\n' + plates + "\n      </div>";
  }))).join("\n");

  await mkdir(path.join(ROOT, slug), { recursive: true });
  await writeFile(path.join(ROOT, slug, "index.html"), shell({
    title: `${p.title} — Swoop Nebula`,
    desc: p.paras[0] ? trim(p.paras[0], 155) : `${p.title}, design work by Swoop Nebula.`,
    slug,
    main: `      <section class="work" id="work">
        <h2 class="rise">${esc(p.title)}</h2>
      </section>
${body}
      <nav class="pager">
        <a href="../">All work</a>
        <a class="next" href="../${ORDER[(i + 1) % ORDER.length]}/">Next<b>${esc(next.title)}</b></a>
      </nav>`,
  }));
}
/* Everything below used to be a separate pass run by hand, which meant every
   rebuild quietly undid it. Three bugs came from that. It lives here now. */

await writeFile(path.join(ROOT, "404.html"), shell({
  title: "Not here \u2014 Swoop Nebula",
  desc: "That page moved. The portfolio was rebuilt and a few addresses changed.",
  abs: true,
  noindex: true,
  main: `      <section class="work" id="work">
        <h2 class="rise">That page moved.</h2>
        <div class="copy rise">
          <p>The portfolio was rebuilt and a few addresses changed. Everything is
          one click away, either from the list on the left or the contact sheet.</p>
        </div>
      </section>
      <nav class="pager">
        <a href="/">All work</a>
      </nav>`,
}));

// Content-hashed asset URLs, so a changed stylesheet can never be served stale.
const hash = async (f) =>
  createHash("md5").update(await readFile(f)).digest("hex").slice(0, 8);
const vc = await hash(path.join(ROOT, "assets/site.css"));
const vj = await hash(path.join(ROOT, "assets/site.js"));
for (const rel of [...ORDER.map((s) => s + "/index.html"), "index.html", "404.html"]) {
  const f = path.join(ROOT, rel);
  if (!existsSync(f)) continue;
  let h = await readFile(f, "utf8");
  h = h.replace(/(assets\/site\.css)(\?v=[0-9a-z]+)?/g, "$1?v=" + vc)
       .replace(/(assets\/site\.js)(\?v=[0-9a-z]+)?/g,  "$1?v=" + vj);
  await writeFile(f, h);
}
const today = new Date().toISOString().slice(0, 10);
const urls = ["", ...ORDER.map((s) => s + "/")];
await writeFile(path.join(ROOT, "sitemap.xml"),
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((u) =>
    "  <url><loc>" + SITE + "/" + u + "</loc><lastmod>" + today +
    "</lastmod><priority>" + (u ? "0.8" : "1.0") + "</priority></url>").join("\n") +
  "\n</urlset>\n");
await writeFile(path.join(ROOT, "robots.txt"),
  "User-agent: *\nAllow: /\n\nSitemap: " + SITE + "/sitemap.xml\n");

console.log("rebuilt index + " + ORDER.length + " projects | css " + vc + " js " + vj);
