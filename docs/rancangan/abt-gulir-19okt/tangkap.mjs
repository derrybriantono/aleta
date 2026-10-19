// Tangkapan sebelum/sesudah atas REPLIKA beranda ABT (bukan Chrome pengguna, bukan server).
// Jalankan: node docs/rancangan/abt-gulir-19okt/buat-replika.mjs && node docs/rancangan/abt-gulir-19okt/tangkap.mjs
// TMP/TEMP harus di D: (D:\Aplikasi\aleta\tmp).
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const folder = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(folder, "../../../manajemen_surat/package.json"));
const { chromium } = require("playwright");
const skripGulir = fs.readFileSync(path.resolve(folder, "../../../ekstensi-sipp/abt-gulir.js"), "utf8");
const halaman = fs.readFileSync(path.join(folder, "replika-beranda-abt.html"), "utf8");
const URL_ABT = "http://192.168.10.10/aps_badilag/index.php/abt/main/beranda";

async function ukur(page) {
  return page.evaluate(() => {
    const n = document.getElementById("navbar");
    const terakhir = Array.from(n.querySelectorAll(".panel a")).filter((a) => a.offsetParent).pop();
    const r = terakhir.getBoundingClientRect();
    const nr = n.getBoundingClientRect();
    return {
      kelas: n.className,
      posisi: getComputedStyle(n).position,
      tinggiLayar: innerHeight,
      menuTinggi: Math.round(nr.height),
      menuBawah: Math.round(nr.bottom),
      itemTerakhirBawah: Math.round(r.bottom),
      itemTerakhirTerjangkau: r.bottom <= innerHeight,
      gulirMenu: n.scrollTop,
      menuBisaDigulir: n.scrollHeight > n.clientHeight + 1,
    };
  });
}

async function skenario(browser, nama, denganEkstensi) {
  const konteks = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await konteks.newPage();
  await page.route(URL_ABT + "*", (rute) => rute.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: halaman }));
  await page.goto(URL_ABT);
  if (denganEkstensi) await page.addScriptTag({ content: skripGulir });
  await page.waitForTimeout(500);
  // Halaman digulir sampai ujung bawah: menu menjadi .stickynav (position: fixed).
  await page.mouse.move(900, 400);
  await page.mouse.wheel(0, 3000);
  await page.waitForTimeout(400);
  const hasil = { nama, setelahGulirHalaman: await ukur(page) };
  await page.screenshot({ path: path.join(folder, `${nama}-1-halaman-digulir.png`) });
  if (denganEkstensi) {
    // Gulir MENU (roda mouse di atas menu) sampai item terakhir.
    await page.mouse.move(150, 300);
    await page.mouse.wheel(0, 5000);
    await page.waitForTimeout(500);
    hasil.setelahGulirMenu = await ukur(page);
    await page.screenshot({ path: path.join(folder, `${nama}-2-menu-digulir-ke-ujung.png`) });
    // Pindah halaman (muat ulang) - posisi gulir menu harus dipulihkan dari sessionStorage.
    await page.goto(URL_ABT);
    await page.addScriptTag({ content: skripGulir });
    await page.waitForTimeout(800);
    hasil.setelahMuatUlang = await ukur(page);
    await page.screenshot({ path: path.join(folder, `${nama}-3-setelah-pindah-halaman.png`) });
  } else {
    // Cobalah menggulir menu: tidak ada yang bergerak.
    await page.mouse.move(150, 300);
    await page.mouse.wheel(0, 5000);
    await page.waitForTimeout(400);
    hasil.setelahCobaGulirMenu = await ukur(page);
    await page.screenshot({ path: path.join(folder, `${nama}-2-coba-gulir-menu.png`) });
  }
  await konteks.close();
  return hasil;
}

const browser = await chromium.launch();
const keluaran = [await skenario(browser, "sebelum", false), await skenario(browser, "sesudah", true)];
await browser.close();
fs.writeFileSync(path.join(folder, "hasil-ukur.json"), JSON.stringify(keluaran, null, 2));
console.log(JSON.stringify(keluaran, null, 2));
