/* Swoop Nebula portfolio, behaviour.
   Three things: weighted scrolling, reveal on enter, and video that only
   plays while you can see it. No dependencies, ~4KB. */
(function () {
  "use strict";

  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var coarse  = matchMedia("(pointer: coarse)").matches;

  /* ---- weighted scrolling ------------------------------------------------
     The browser still owns scrolling. Every input it understands keeps working,
     including the scrollbar, trackpad momentum, keyboard, find-in-page and
     anchors, because nothing is intercepted. What changes is only what you see:
     the painted page eases toward the real scroll position instead of snapping
     to it, and that trailing fraction of a second is the weight.
     Touch gets native momentum, which already feels right and should not be
     re-implemented, so this runs for a mouse or trackpad only. */
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var coarse  = matchMedia("(pointer: coarse)").matches;
  var smooth  = !reduced && !coarse;
  var view    = document.getElementById("scroll");
  var current = 0, raf = null;
  var EASE    = 0.11;      // fraction of the remaining distance per frame

  function sizeBody() {
    if (!view) return;
    document.body.style.height = Math.ceil(view.getBoundingClientRect().height) + "px";
  }


  /* The rail and the masthead are inside the wrapper the scroller moves, so
     position: sticky cannot help them: a transformed box with no scrolling
     ancestor gives sticky nothing to stick to. Instead they are pushed back
     by exactly what the wrapper was pulled, which pins them to the viewport
     and keeps them in step with the eased motion rather than the raw one. */
  var pinned = [].slice.call(document.querySelectorAll("[data-pin]"));
  // The rail is only a sidebar above this width. Below it the rail belongs in
  // the flow, and pinning it would float it over the work.
  var wide = matchMedia("(min-width: 761px)");
  function pins() {
    return pinned.filter(function (el) {
      return el.dataset.pin !== "wide" || wide.matches;
    });
  }
  var active = pins();
  wide.addEventListener("change", function () {
    pinned.forEach(function (el) { el.style.transform = ""; });
    active = pins();
    document.body.classList.toggle("rail-pinned", wide.matches);
    place(current);
  });
  document.body.classList.toggle("rail-pinned", wide.matches);

  function place(y) {
    view.style.transform = "translate3d(0," + -y + "px,0)";
    for (var i = 0; i < active.length; i++) {
      active[i].style.transform = "translate3d(0," + y.toFixed(2) + "px,0)";
    }
  }

  function frame() {
    var target = scrollY;
    var d = target - current;
    if (Math.abs(d) < 0.1) {
      current = target;
      place(current);
      raf = null;
      return;
    }
    current += d * EASE;
    place(current);
    raf = requestAnimationFrame(frame);
  }

  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  if (smooth && view) {
    document.body.classList.add("is-smooth");
    sizeBody();
    if (window.ResizeObserver) new ResizeObserver(sizeBody).observe(view);
    addEventListener("resize", sizeBody);
    addEventListener("scroll", kick, { passive: true });
    kick();
  }

  /* ---- arriving from inside the site, on a phone -------------------------
     The rail sits above the work at phone widths, so following a link lands
     you back on the same list you just used and the work starts a screenful
     down. When the navigation came from a link on this site, start the new
     page at its content instead. A fresh visit, a bookmark or the back button
     sets no flag and is left alone, so the masthead and the name are still the
     first thing a new arrival sees.
     Only on a phone: on a wider screen the rail is a sidebar and the work is
     already at the top. */
  function onPhone() { return !wide.matches; }

  addEventListener("click", function (ev) {
    if (!onPhone() || !ev.target.closest) return;
    var a = ev.target.closest("a[href]");
    if (!a) return;
    var h = a.getAttribute("href");
    // Internal pages only. Off-site links, mail and same-page anchors are not
    // navigations within this site and must not set the flag.
    if (!h || /^(https?:|mailto:|tel:|#|\/\/)/i.test(h)) return;
    try { sessionStorage.setItem("sn-from-link", "1"); } catch (e) {}
  }, true);

  (function jumpToContent() {
    var flagged = false;
    try {
      flagged = sessionStorage.getItem("sn-from-link") === "1";
      if (flagged) sessionStorage.removeItem("sn-from-link");
    } catch (e) { return; }                  // private mode: do nothing
    if (!flagged || !onPhone() || location.hash) return;

    var content = document.querySelector("main .work, main .collage");
    if (!content) return;
    // The page keeps growing while images decode, so a single measurement
    // lands short: the heading is pushed below where it was when we looked.
    // Re-aim until the target stops moving, then stop. Give up after a second
    // so a slow image cannot yank the page under someone already reading.
    var settled = 0, until = Date.now() + 1000, last = -1;
    function go() {
      var y = Math.round(content.getBoundingClientRect().top + pageYOffset - 14);
      if (y > 40 && Math.abs(y - pageYOffset) > 2) scrollTo(0, y);
      settled = y === last ? settled + 1 : 0;
      last = y;
      // Three identical readings, or out of time, means the layout is done.
      if (settled < 3 && Date.now() < until) requestAnimationFrame(go);
    }
    requestAnimationFrame(go);
  })();

  /* ---- opened straight off the disk --------------------------------------
     Links point at folders, "sharing-excess/", which a web server resolves to
     the index.html inside. A file:// URL has no such rule, so macOS hands the
     folder to Finder and the click appears to do nothing useful. Append the
     filename in that case only; the published HTML keeps its clean URLs, which
     is what the redirects and the canonical links depend on. */
  if (location.protocol === "file:") {
    [].forEach.call(document.querySelectorAll('a[href$="/"]'), function (a) {
      var h = a.getAttribute("href");
      // Relative links only. An absolute one, like the Work with me button at
      // swoop.thevisualpharmacy.com/, is a real URL and must be left alone.
      if (/^(https?:|mailto:|\/\/)/i.test(h)) return;
      a.setAttribute("href", h + "index.html");
    });
  }

  /* ---- the gap the rule leaves for the tab -------------------------------
     Measured rather than guessed, so the line stops exactly at the tab's
     edges however the text happens to set. */
  (function tabGap() {
    var tag = document.querySelector(".tag");
    if (!tag) return;
    var set = function () {
      document.documentElement.style.setProperty(
        "--tabhalf", (tag.getBoundingClientRect().height / 2) + "px");
    };
    set();
    addEventListener("resize", set);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(set);
  })();

  /* ---- the rail scrolls with the same weight ------------------------------
     When the rail is taller than the window it scrolls inside itself, and a
     raw native scroll there would feel unrelated to the eased page beside it.
     The wheel is taken over and scrollTop eased toward a target, so both move
     with the same hand. At either end the wheel is handed back to the page,
     which keeps the usual chaining instead of trapping the pointer. */
  (function railScroll() {
    var rail = document.querySelector(".rail");
    if (!rail || reduced || coarse) return;
    var want = 0, loop = null;

    function run() {
      var d = want - rail.scrollTop;
      if (Math.abs(d) < 0.4) { rail.scrollTop = want; loop = null; return; }
      rail.scrollTop += d * 0.14;
      loop = requestAnimationFrame(run);
    }

    rail.addEventListener("wheel", function (e) {
      var max = rail.scrollHeight - rail.clientHeight;
      if (max < 2) return;                       // nothing to scroll, let the page have it
      var atTop = rail.scrollTop <= 0.5, atEnd = rail.scrollTop >= max - 0.5;
      if ((atTop && e.deltaY < 0) || (atEnd && e.deltaY > 0)) return;
      e.preventDefault();
      if (loop === null) want = rail.scrollTop;  // resync after a native nudge
      want = Math.max(0, Math.min(max, want + e.deltaY * (e.deltaMode === 1 ? 18 : 1)));
      if (loop === null) loop = requestAnimationFrame(run);
    }, { passive: false });
  })();

  /* ---- reveal on enter --------------------------------------------------- */
  var risers = [].slice.call(document.querySelectorAll(".rise"));
  if (!reduced && "IntersectionObserver" in window && risers.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("in");
        io.unobserve(en.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    risers.forEach(function (el, i) {
      // A short stagger reads as one movement rather than a dozen.
      el.style.transitionDelay = Math.min(i % 6, 5) * 45 + "ms";
      io.observe(el);
    });
  } else {
    risers.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---- images fade in once decoded -------------------------------------- */
  [].forEach.call(document.querySelectorAll("img.lazy"), function (img) {
    if (img.complete) { img.classList.add("ready"); return; }
    img.addEventListener("load", function () { img.classList.add("ready"); });
    img.addEventListener("error", function () { img.classList.add("ready"); });
  });

  /* ---- video plays only while visible ------------------------------------
     Six autoplaying loops would otherwise decode the whole time, which costs
     battery on a laptop and data on a phone. */
  var vids = [].slice.call(document.querySelectorAll("video[data-inview]"));
  if (vids.length && "IntersectionObserver" in window) {
    var vo = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target;
        if (en.isIntersecting) { v.play().catch(function () {}); }
        else if (!v.paused) { v.pause(); }
      });
    }, { threshold: 0.15 });
    vids.forEach(function (v) { vo.observe(v); });
  }
})();
