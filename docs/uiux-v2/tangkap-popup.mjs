// Ukur popup ikon ekstensi di Chromium headless pada zoom 100/125/150%.
// Popup Chrome dibatasi 800x600 (DIP): pada zoom Z, halaman melihat jendela (800/Z) x (600/Z) px CSS.
// Dijalankan dari manajemen_surat/: node ../docs/uiux-v2/tangkap-popup.mjs
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const AKAR_MS = process.cwd();
const require = createRequire(path.join(AKAR_MS, "package.json"));
const { chromium } = require("playwright-core");
const POPUP = path.resolve(AKAR_MS, "../ekstensi-sipp/popup.html");
const KELUAR = process.env.KELUAR || path.resolve(AKAR_MS, "../docs/uiux-v2");
mkdirSync(KELUAR, { recursive: true });

const browser = await chromium.launch();
const laporan = [];
for (const [zoom, kulit] of [[100, ""], [125, ""], [150, ""], [100, "modern"], [150, "modern"]]) {
  const lebarKonten = kulit ? 340 : 300;
  const tinggiJendela = Math.round(600 / (zoom / 100));
  const ctx = await browser.newContext({ viewport: { width: lebarKonten, height: tinggiJendela }, deviceScaleFactor: zoom / 100 });
  const page = await ctx.newPage();
  await page.route("**/*", (r) => (r.request().url().startsWith("file:") ? r.continue() : r.abort()));
  await page.goto(pathToFileURL(POPUP).href, { waitUntil: "load" });
  if (kulit) await page.evaluate(() => document.documentElement.setAttribute("data-kulit", "modern"));
  const r = await page.evaluate(() => {
    const d = document.documentElement;
    const lebar = [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > d.clientWidth + 1 && getComputedStyle(e).position !== "fixed").slice(0, 8).map((e) => (e.className || e.tagName).toString().slice(0, 40));
    return { scrollW: d.scrollWidth, clientW: d.clientWidth, scrollH: d.scrollHeight, clientH: d.clientHeight, bodyW: document.body.getBoundingClientRect().width, meluapKanan: lebar };
  });
  laporan.push({ zoom, kulit: kulit || "klasik", jendela: `${lebarKonten}x${tinggiJendela}`, ...r });
  await page.screenshot({ path: path.join(KELUAR, `popup-${kulit || "klasik"}-${zoom}.png`) });
  await ctx.close();
}
await browser.close();
writeFileSync(path.join(KELUAR, "laporan-popup.json"), JSON.stringify(laporan, null, 1));
console.log(JSON.stringify(laporan, null, 1));
process.exit(0);
