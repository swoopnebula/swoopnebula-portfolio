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
     down. Point those links at #work and the browser opens the page already
     scrolled, before the first paint.
     An earlier version scrolled after load instead, which showed the top of
     the page and then jumped: the flash was the whole problem. Letting the
     browser do it costs nothing and is never late, because every image
     carries width and height so the layout is final at parse time.
     Only on a phone: wider, the rail is a sidebar and the work already
     starts at the top. The hash is added at click time, so what is linked,
     shared and indexed stays the clean URL. */
  (function jumpToWork() {
    if (!view) return;
    addEventListener("click", function (ev) {
      if (wide.matches || !ev.target.closest) return;
      var a = ev.target.closest("a[href]");
      if (!a) return;
      var h = a.getAttribute("href");
      // Internal pages only, and never one that already carries a hash.
      if (!h || h.indexOf("#") > -1) return;
      if (/^(https?:|mailto:|tel:|\/\/)/i.test(h)) return;
      a.setAttribute("href", h + "#work");
    }, true);

    // Safety net. While the weighted scroller is running the page sits in a
    // transformed wrapper, so the target never leaves the viewport and the
    // browser sees no reason to move: a #work link would quietly do nothing.
    // That is the case for a shared link opened on a desktop. Place it once,
    // before the first frame is painted, so there is still nothing to see.
    if (smooth && location.hash === "#work") {
      var target = document.getElementById("work");
      if (target) {
        var y = target.getBoundingClientRect().top + pageYOffset - 14;
        if (y > 40) { scrollTo(0, y); current = y; place(y); }
      }
    }
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

  /* ---- hooks that have to survive a swap ---------------------------------
     These used to run once over the whole document. The soft navigation
     below replaces the contents of <main>, so they are a function now and
     run again over whatever just arrived. */
  function bindContent(root) {
    root = root || document;

    /* reveal on enter */
    var risers = [].slice.call(root.querySelectorAll(".rise"));
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

    /* images fade in once decoded */
    [].forEach.call(root.querySelectorAll("img.lazy"), function (img) {
      if (img.complete) { img.classList.add("ready"); return; }
      img.addEventListener("load", function () { img.classList.add("ready"); });
      img.addEventListener("error", function () { img.classList.add("ready"); });
    });

    /* video plays only while visible. Six autoplaying loops would otherwise
       decode the whole time, which costs battery on a laptop and data on a
       phone. */
    var vids = [].slice.call(root.querySelectorAll("video[data-inview]"));
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
  }

  bindContent(document);

  /* ---- soft navigation on a phone ----------------------------------------
     On a phone the list sits above the work on every page, so an ordinary
     link reloads the whole document only to rebuild the same masthead, the
     same portrait and the same list, then drops you at the top of it again.
     Instead the new page is fetched, only <main> is exchanged, and the view
     moves to the work: the furniture never flickers because it never leaves.
     A failure of any kind falls back to a normal navigation, so the links
     keep working with no JavaScript, on an old browser, or offline. */
  (function softNav() {
    var main = document.querySelector("main");
    if (!main || !window.fetch || !window.DOMParser || !history.pushState) return;
    if (location.protocol === "file:") return;   // fetch cannot read the disk
    var busy = false;

    /* The rail and the masthead are never swapped, so their links keep
       resolving against whatever the address bar says. Once a swap changes
       that, "adobe/" would mean "/bna-social-media-design/adobe/" and the
       second tap would 404. Pinning them to the URLs they mean right now,
       while the address bar is still the page they were written for, costs
       one pass and removes the whole class of bug. Reading .href gives the
       resolved absolute URL, so this works from any subfolder. */
    [].forEach.call(
      document.querySelectorAll(".rail a[href], .mast .brand[href]"),
      function (a) { a.setAttribute("href", a.href); }
    );

    function clean(href) { return href.replace(/#work$/, ""); }

    function workTop() {
      var w = document.getElementById("work");
      return w ? Math.round(w.getBoundingClientRect().top + pageYOffset - 14) : 0;
    }

    /* Put the work under the top edge. When it is already there, nothing
       would move and the tap would feel ignored, so the content gives a
       small nod instead: enough to say "this is the new thing". */
    function settle() {
      var y = workTop();
      if (Math.abs(y - pageYOffset) < 8 || y < 40) {
        main.classList.remove("nudge");
        void main.offsetWidth;                   // restart the animation
        main.classList.add("nudge");
        return;
      }
      scrollTo(0, Math.max(0, y));
    }

    function markCurrent(url) {
      var path = new URL(url, location.href).pathname;
      [].forEach.call(document.querySelectorAll(".railnav a"), function (a) {
        if (new URL(a.href, location.href).pathname === path) {
          a.setAttribute("aria-current", "page");
        } else {
          a.removeAttribute("aria-current");
        }
      });
    }

    function swap(url, push) {
      if (busy) return;
      busy = true;
      document.body.classList.add("swapping");

      // The fade and the fetch run together, so the wait is spent rather
      // than added. 220ms matches the CSS, and the whole thing waits for
      // whichever finishes last.
      var got = fetch(url, { credentials: "same-origin" })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); });
      var faded = new Promise(function (go) { setTimeout(go, 220); });

      Promise.all([got, faded]).then(function (out) {
        var doc = new DOMParser().parseFromString(out[0], "text/html");
        var fresh = doc.querySelector("main");
        if (!fresh) throw new Error("no main");

        main.innerHTML = fresh.innerHTML;
        document.title = doc.title;
        if (push) history.pushState({ soft: 1 }, "", clean(url));
        markCurrent(url);
        bindContent(main);
        settle();

        // Paint the new content in place before fading it up, or the first
        // frame shows it at the old scroll position.
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            document.body.classList.remove("swapping");
            busy = false;
          });
        });
      }).catch(function () {
        location.href = url;                     // anything at all: do it properly
      });
    }

    addEventListener("click", function (ev) {
      if (wide.matches || busy) return;
      if (ev.defaultPrevented || ev.button !== 0) return;
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      if (!ev.target.closest) return;
      var a = ev.target.closest("a[href]");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;

      var url;
      try { url = new URL(a.href, location.href); } catch (e) { return; }
      if (url.origin !== location.origin) return;             // off site
      // Already here: the portrait and All work both point at the page you
      // are on. Reloading it would flash the whole screen to show the same
      // thing, so move to the work instead, or nod if it is already there.
      if (url.pathname === location.pathname) {
        ev.preventDefault();
        settle();
        return;
      }
      if (!/\/$|\/index\.html$/.test(url.pathname)) return;   // only our pages

      ev.preventDefault();
      swap(url.pathname + url.search, true);
    });

    // Back and forward move between swapped pages the same way.
    addEventListener("popstate", function () {
      if (wide.matches) { location.reload(); return; }
      swap(location.pathname + location.search, false);
    });
  })();

})();
