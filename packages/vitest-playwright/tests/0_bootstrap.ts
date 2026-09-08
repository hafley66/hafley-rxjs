// One page for every receipt, served by pw:page.route: no server, no assets directory.
import type { Page } from "playwright"

export const URL = "http://bootstrap.test/"
export const HTML = `<!doctype html><html><head><title>bootstrap  page</title><style>#far{margin-top:4000px}#p::before{content:"pre"}</style></head><body>
<section id="bool">
  <input id="cb" type="checkbox" checked><input id="cb2" type="checkbox"><input id="dis" disabled><input id="ro" readonly value="r">
  <div id="hidden" hidden>x</div><div id="vis">x</div><div id="empty"></div><button id="focus">f</button>
  <div id="far">viewport</div>
</section>
<section id="text">
  <p id="p" class="a b" data-k="v" title="t">Hello  World</p>
  <ul><li>a</li><li>b</li><li>c</li></ul>
  <input id="val" value="v1">
  <select id="multi" multiple><option value="x" selected>x</option><option value="y" selected>y</option><option value="z">z</option></select>
  <div role="button" aria-label="acc name" aria-description="acc desc" id="acc">r</div>
</section>
<section id="live"><time id="now"></time><pre id="api"></pre><span id="late"></span></section>
<script>
  setInterval(() => { document.getElementById('now').textContent = String(Date.now()) }, 10)
  fetch('/api/thing').then(r => r.json()).then(j => { document.getElementById('api').textContent = JSON.stringify(j) }).catch(e => { document.getElementById('api').textContent = 'ERR ' + e })
  setTimeout(() => { document.getElementById('late').textContent = 'late' }, 300)
  window.setState = (id, v) => { document.getElementById(id).textContent = v }
</script></body></html>`

export async function boot(page: Page, api: unknown = { ok: 1 }): Promise<void> {
  await page.route("**/api/*", r => r.fulfill({ json: api }))
  await page.route(URL, r => r.fulfill({ contentType: "text/html", body: HTML }))
  await page.goto(URL)
}
