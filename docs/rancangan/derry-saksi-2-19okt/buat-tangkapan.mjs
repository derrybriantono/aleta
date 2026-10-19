import { createRequire } from "node:module";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
const require = createRequire("D:/aleta-dev/wt/derry-saksi-2/manajemen_surat/package.json");
const { chromium } = require("playwright-core");
const sumber = "D:/Aplikasi/aleta/tmp/tangkap-saksi";
const tujuan = "D:/aleta-dev/wt/derry-saksi-2/docs/rancangan/derry-saksi-2-19okt";
mkdirSync(tujuan, { recursive: true });
const css = readFileSync("D:/aleta-dev/wt/derry-saksi-2/ekstensi-sipp/blangko-derry.css", "utf8");
const jalur = process.env.CHROMIUM_EXE || undefined;
const browser = await chromium.launch(jalur ? { executablePath: jalur } : {});
for (const berkas of readdirSync(sumber).filter((b) => b.endsWith(".html"))) {
  const nama = berkas.replace(/\.html$/, "");
  const isi = readFileSync(`${sumber}/${berkas}`, "utf8");
  for (const lebar of [1366, 390]) {
    const page = await browser.newPage({ viewport: { width: lebar, height: 900 } });
    await page.setContent(
      `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#0b1d15}${css}\n#aleta-bd-akar{position:static!important;inset:auto!important;width:auto!important;height:auto!important;max-height:none!important;overflow:visible!important;padding:12px}</style></head><body>${isi}</body></html>`
    );
    await page.evaluate(() => {
      document.querySelectorAll("textarea").forEach((t) => {
        t.style.height = "auto";
        t.style.height = t.scrollHeight + 2 + "px";
      });
    });
    if (nama.includes("tukar-pilih")) {
      await page.locator(".bd-sbrow:has(.bd-tujuan)").first().screenshot({ path: tujuan + "/" + nama + "-" + lebar + ".png" });
      console.log("ok", nama, lebar);
      await page.close();
      continue;
    }
    const sel = nama.startsWith("hakim") ? "#bd-tjtombol" : "#bd-tjtombol";
    const a = await page.locator(sel).boundingBox();
    const b = await page.locator("#bd-tjwadah").boundingBox();
    const alat = await page.locator("#bd-alatisi").boundingBox();
    if (!a) {
      console.log("tak ada tombol", nama);
      await page.close();
      continue;
    }
    const x = 0;
    const y = Math.max(0, a.y - 8);
    const bawah = b && b.height > 0 ? b.y + b.height : a.y + a.height;
    const tinggi = Math.min(1500, bawah - y + 12);
    await page.screenshot({ fullPage: true, path: `${tujuan}/${nama}-${lebar}.png`, clip: { x, y, width: lebar, height: tinggi } });
    if (nama === "pp-bas-berdampingan" && alat) {
      await page.screenshot({ fullPage: true, path: `${tujuan}/deret-tombol-isian-${lebar}.png`, clip: { x, y: Math.max(0, alat.y - 8), width: lebar, height: Math.max(40, alat.height + 16) } });
    }
    console.log("ok", nama, lebar, Math.round(tinggi));
    await page.close();
  }
}
await browser.close();
