/* Static checks over the built site. Run with: node tests/check.mjs
   Everything here is a defect that shipped once, or could ship silently:
   a missing asset, a dead link, a duplicate id, a page missing its meta. */
import { readFile, readdir, stat } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let pass = 0, fail = 0;
const ok  = (m) => { pass++; };
const bad = (m) => { fail++; console.log("  FAIL  " + m); };
const is  = (cond, m) => (cond ? ok(m) : bad(m));

const pages = [];
for (const e of await readdir(ROOT, { withFileTypes: true })) {
  if (e.name.startsWith("._")) continue;            // filesystem sidecar, not a page
  if (e.isFile() && e.name.endsWith(".html")) pages.push(e.name);
  else if (e.isDirectory() && !e.name.startsWith(".") &&
           !["assets", "images", "tests", "node_modules", "_backups"].includes(e.name) &&
           existsSync(path.join(ROOT, e.name, "index.html"))) pages.push(e.name + "/index.html");
}

console.log(`checking ${pages.length} pages\n`);

const html = {};
for (const p of pages) html[p] = await readFile(path.join(ROOT, p), "utf8");

/* 1. every local asset a page references actually exists */
for (const [p, h] of Object.entries(html)) {
  const dir = path.dirname(path.join(ROOT, p));
  const refs = [...h.matchAll(/(?:src|href)="([^"#][^"]*)"/g)].map((m) => m[1]);
  for (const r of refs) {
    if (/^(https?:|mailto:|tel:|data:|\/\/)/i.test(r)) continue;
    const clean = r.split("?")[0].split("#")[0];
    if (!clean) continue;
    const target = clean.startsWith("/")
      ? path.join(ROOT, clean)
      : path.resolve(dir, clean);
    const file = clean.endsWith("/") ? path.join(target, "index.html") : target;
    is(existsSync(file) || existsSync(path.join(target, "index.html")),
       `${p} references missing ${r}`);
  }
}

/* 2. one id="work" per page, or the anchor and the swap both misbehave */
for (const [p, h] of Object.entries(html)) {
  const n = (h.match(/id="work"/g) || []).length;
  is(n === 1, `${p} has ${n} id="work" (expected exactly 1)`);
}

/* 3. the head every page needs */
for (const [p, h] of Object.entries(html)) {
  is(/<title>[^<]+<\/title>/.test(h), `${p} has no title`);
  is(/name="description" content="[^"]+"/.test(h), `${p} has no description`);
  is(/<html lang="en">/.test(h), `${p} has no lang`);
  is(/favicon\.ico/.test(h), `${p} has no favicon`);
  const canonical = /rel="canonical"/.test(h), noindex = /name="robots"/.test(h);
  is(canonical || noindex, `${p} has neither canonical nor noindex`);
}

/* 4. every image carries width and height, or the layout shifts as it loads
      and the scroll lands in the wrong place */
for (const [p, h] of Object.entries(html)) {
  const imgs = h.match(/<img[^>]*>/g) || [];
  const bare = imgs.filter((t) => !/width="\d+"/.test(t) || !/height="\d+"/.test(t));
  is(bare.length === 0, `${p} has ${bare.length} img without width/height`);
  const noalt = imgs.filter((t) => !/alt="/.test(t));
  is(noalt.length === 0, `${p} has ${noalt.length} img without alt`);
}

/* 5. asset URLs are versioned, so a changed file cannot be served stale */
for (const [p, h] of Object.entries(html)) {
  for (const a of ["site.css", "site.js", "favicon.ico"]) {
    const m = h.match(new RegExp(a.replace(".", "\\.") + "\\?v=([0-9a-z]+)"));
    is(!!m, `${p} does not version ${a}`);
  }
}

/* 6. the same version everywhere, or two pages disagree about which CSS is current */
for (const a of ["site.css", "site.js", "favicon.ico"]) {
  const seen = new Set();
  for (const h of Object.values(html)) {
    const m = h.match(new RegExp(a.replace(".", "\\.") + "\\?v=([0-9a-z]+)"));
    if (m) seen.add(m[1]);
  }
  is(seen.size <= 1, `${a} has ${seen.size} different versions across pages`);
}

/* 7. no image sits in the repo unreferenced, and none is zero bytes */
const allHtml = Object.values(html).join("");
async function walk(d) {
  const out = [];
  for (const e of await readdir(d, { withFileTypes: true })) {
    if (e.name.startsWith("._")) continue;
    const f = path.join(d, e.name);
    if (e.isDirectory()) out.push(...await walk(f));
    else out.push(f);
  }
  return out;
}
const media = await walk(path.join(ROOT, "images"));
let orphans = 0;
for (const f of media) {
  const rel = path.relative(ROOT, f);
  const s = await stat(f);
  is(s.size > 0, `${rel} is zero bytes`);
  if (!allHtml.includes(path.basename(f))) orphans++;
}
is(orphans === 0, `${orphans} image(s) in the repo are referenced by no page`);

/* 8. sitemap lists exactly the pages that exist, and no noindex page */
if (existsSync(path.join(ROOT, "sitemap.xml"))) {
  const sm = await readFile(path.join(ROOT, "sitemap.xml"), "utf8");
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const indexable = pages.filter((p) => !/name="robots"/.test(html[p]));
  is(locs.length === indexable.length,
     `sitemap lists ${locs.length} URLs for ${indexable.length} indexable pages`);
  is(!locs.some((l) => l.includes("404")), `sitemap lists the 404 page`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
