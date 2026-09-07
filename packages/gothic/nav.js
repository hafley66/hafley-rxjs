/* shared header for every notebook, classic script so file:// works: file tabs (row 1), section anchors (row 2), sticky.
   anchors light on their section's view timeline (Chrome/Safari); IntersectionObserver elsewhere. also imported by src/notebooks/0_nav.ts */
;(function () {
  var LINKS = [
    { id: "eye", href: "eye.html", sections: ["eye"] },
    { id: "slice", href: "slice.html", sections: ["slice"] },
    { id: "icons", href: "icons.html", sections: ["icons", "seal"] },
    { id: "border", href: "border.html", sections: ["border"] },
    { id: "fractal", href: "fractal.html", sections: ["apollonian", "foils", "lsys", "cusping", "hilbert"] },
    { id: "circles", href: "circles.html", legacy: true, sections: ["diagram", "fma", "sacred"] },
    { id: "tiles", href: "tiles.html", legacy: true, sections: ["islamic", "mosaic", "blackwork"] },
    { id: "arches", href: "arches.html", legacy: true, sections: ["families", "spread", "lobes", "anatomy", "rose", "panel", "flamboyant", "pinnacle", "vault", "buttress", "bands", "facade", "noisy", "grammar", "grammar2", "tex"] },
    { id: "index", href: "index.html", legacy: true, sections: ["hero", "sizer"] },
  ]
  if (typeof window === "undefined") return
  window.GOTHIC_LINKS = LINKS
  // module import from the kit: only publish LINKS. classic script in a legacy page: build the header
  if (!document.currentScript) return
  var STYLE = [
    ".gk-top{position:sticky;top:0;z-index:20;display:grid;gap:2px 0;padding:6px 14px;background:#0a0c11;border-bottom:1px solid #262a35;font:12px/1.4 system-ui,sans-serif;color:#8b8f9c}",
    ".gk-top nav{display:flex;flex-wrap:wrap;gap:0 14px}.gk-top a{color:#8b8f9c;text-decoration:none;padding:1px 0;border-bottom:2px solid transparent}",
    ".gk-top a:hover{color:#d9dbe3}.gk-top .gk-files a[aria-current]{color:oklch(84% .1 85);border-bottom-color:oklch(84% .1 85)}",
    ".gk-top .gk-sections a{animation:gk-active linear both;animation-range:entry 0% exit 100%}",
    "@keyframes gk-active{0%,100%{color:#8b8f9c;border-bottom-color:transparent}12%,88%{color:oklch(84% .1 85);border-bottom-color:oklch(84% .1 85)}}",
    ".gk-top .gk-sections a[data-active]{color:oklch(84% .1 85);border-bottom-color:oklch(84% .1 85)}",
  ].join("")
  function build() {
    var id = (location.pathname.split("/").pop() || "index").replace(/\.html$/, "")
    var style = document.createElement("style")
    style.textContent = STYLE
    document.head.appendChild(style)
    var top = document.createElement("header")
    top.className = "gk-top"
    var files = document.createElement("nav")
    files.className = "gk-files"
    LINKS.forEach(function (l) {
      var a = document.createElement("a")
      a.href = l.href
      a.textContent = l.id + (l.legacy ? "*" : "")
      a.title = l.sections.join(" · ")
      if (l.id === id) a.setAttribute("aria-current", "page")
      files.appendChild(a)
    })
    var secs = document.createElement("nav")
    secs.className = "gk-sections"
    top.appendChild(files)
    top.appendChild(secs)
    document.body.insertBefore(top, document.body.firstChild)
    var supports = CSS_supports("animation-timeline: view()")
    var names = []
    var io = supports ? null : new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var a = secs.querySelector('a[href="#' + e.target.id + '"]')
        if (a) e.isIntersecting ? a.setAttribute("data-active", "") : a.removeAttribute("data-active")
      })
    }, { rootMargin: "-10% 0px -10% 0px" })
    var sections = document.querySelectorAll("main > section[id], body > section[id]")
    Array.prototype.forEach.call(sections, function (sec) {
      var a = document.createElement("a")
      a.href = "#" + sec.id
      a.textContent = sec.id.replace(/-s$/, "")
      secs.appendChild(a)
      var name = "--gk-tl-" + sec.id.replace(/[^a-z0-9_-]/gi, "_")
      names.push(name)
      if (supports) {
        sec.style.setProperty("view-timeline-name", name)
        a.style.setProperty("animation-timeline", name)
      } else io.observe(sec)
    })
    if (supports) document.body.style.setProperty("timeline-scope", names.join(", "))
    new ResizeObserver(function () {
      document.documentElement.style.setProperty("--kit-top", top.offsetHeight + "px")
    }).observe(top)
  }
  function CSS_supports(q) { return typeof CSS !== "undefined" && CSS.supports && CSS.supports(q) }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build)
  else build()
})()
