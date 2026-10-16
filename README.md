# Swoop Nebula portfolio

A static site. The published pages need no build step, no dependencies and no
framework: GitHub Pages serves the HTML in this repository exactly as it sits.

| | |
|---|---|
| Projects | **12**, the ones visible on the live site |
| Media | 100 WebP images, 6 MP4 loops, 17 covers, about 29 MB |
| Design | Black, fixed left rail, collage index, weighted scrolling |
| Hosting | GitHub Pages, custom domain in `CNAME` |

## Structure

```
index.html            the contact sheet
<slug>/index.html     one page per project
404.html              a soft landing for the old URLs
images/<slug>/        that project's media
assets/site.css       the whole stylesheet
assets/site.js        weighted scrolling, reveals, in-view video
assets/favicon.svg    registration-mark icon
robots.txt            generated
sitemap.xml           generated
CNAME                 portfolio.swoopnebula.com
build.mjs             regenerates every page from the two data files
data-live.json        project order, titles, rail labels
data-blocks.json      the text and image blocks of each project
```

## Publishing it the first time

The HTML is already committed, so this is only a push and two settings.

**1. Make the repository on GitHub.** Go to <https://github.com/new>, name it
`swoopnebula-portfolio`, choose **Public**, and add nothing else: no README, no
`.gitignore`, no licence. An initialised repository has a commit this one does
not share and the push is rejected.

**2. Push this folder.** From the project folder:

```bash
cd path/to/swoopnebula-portfolio
git remote add origin https://github.com/<your-username>/swoopnebula-portfolio.git
git push -u origin main
```

About 44 MB goes up, so give it a minute. If GitHub asks for a password, it
wants a personal access token, not the account password: make one at Settings,
Developer settings, Personal access tokens, Fine-grained, with **Contents:
Read and write** on this repository. The `gh` CLI (`gh auth login`, then
`gh repo create swoopnebula-portfolio --public --source=. --push`) does both
steps at once and handles the login for you.

**3. Turn on Pages.** In the repository: **Settings, Pages**. Under *Build and
deployment* set **Source: Deploy from a branch**, **Branch: `main`**, folder
**`/ (root)`**, then Save. The first build takes two or three minutes. The site
appears at `https://<your-username>.github.io/swoopnebula-portfolio/`.

**4. Point the domain at it.** `CNAME` already names
`portfolio.swoopnebula.com`, so Pages will ask the registrar for it. At the DNS
host for `swoopnebula.com`, add one record:

| Type | Name | Value |
|---|---|---|
| CNAME | `portfolio` | `<your-username>.github.io.` |

Back in Settings, Pages, the Custom domain box should already read
`portfolio.swoopnebula.com`; wait for the check to go green, then tick
**Enforce HTTPS**. DNS can take anywhere from a few minutes to a few hours, and
the HTTPS tickbox stays greyed out until the certificate is issued.

## Publishing a change afterwards

```bash
git add -A
git commit -m "what changed"
git push
```

Pages redeploys on every push to `main`, usually within a minute. The
stylesheet and script are linked with a content hash (`site.css?v=456e22a9`),
so a changed file can never be served from a stale cache.

## Rebuilding the pages

Only needed when the copy, the project order or the images change. Everything
else is hand-editable in `assets/site.css`.

```bash
npm install          # sharp, to measure images
npm run build
```

`build.mjs` rewrites all 14 HTML files from `data-live.json` and
`data-blocks.json`, measures every image to set its aspect ratio and width
class, regenerates `robots.txt` and `sitemap.xml`, and re-hashes the asset
URLs. It resolves every path from its own location, so the folder can live
anywhere.

## Previewing locally

```bash
npm run serve        # then open http://localhost:7490
```

Double-clicking `index.html` also works. Links point at folders, which a web
server resolves to the `index.html` inside and a `file://` URL does not, so a
small fallback in `site.js` appends the filename when the page is opened from
disk. The published HTML keeps its clean URLs, which the redirects depend on.

## A note on the repository being public

Public means the source is readable and the artwork is downloadable, which it
already is from any portfolio site. The repository holds no keys, no analytics
and no contact data. The client work in `images/` stays the property of its
respective owners: it is shown here as portfolio work, not offered for reuse.
