"use strict";

/**
 * ============================================================================
 * PEMERIKSAAN SESI e-COURT RINGAN (13 Okt 2026, butir 13)
 * ============================================================================
 *
 * Cara lama (ecourtLoginService.periksaSesi cepat:false): menyalakan Chrome
 * dengan profil slot, memuat <e-Court>/Login sampai domcontentloaded, membaca
 * alamat akhirnya, lalu menutup Chrome. Terukur dari log jembatan 9-12 Okt
 * (langkah yang sama: "Membuka peramban" -> "Sesi tersimpan masih berlaku"):
 * 2-4 detik per akun, berurutan untuk tiap akun, dan sekitar 150-300 MB memori
 * selama Chrome hidup.
 *
 * Cara ringan: SATU permintaan HTTPS ke <e-Court>/Login membawa cookie sesi
 * akun itu, TANPA mengikuti pengalihan. e-Court mengalihkan /Login ke halaman
 * sesudah masuk (dashboard/pendaftaran) HANYA bila sesinya sah - itulah bukti
 * yang sama yang dibaca cara lama dari page.url().
 *
 * Hanya jawaban POSITIF yang dipercaya. Cookie yang disimpan di sini salinan
 * dari Chrome saat terakhir dipakai; e-Court dapat memutar cookie sesinya,
 * sehingga salinan yang tertolak belum tentu berarti sesi Chrome mati. Karena
 * itu tiap jawaban selain "dialihkan ke halaman sesudah masuk" - halaman login,
 * gerbang penegasan, galat jaringan, cookie belum ada - berstatus RAGU, dan
 * pemanggil kembali ke cara lama (Chrome).
 *
 * ============================================================================
 * COOKIE DISIMPAN TERSANDI, BUKAN SANDI
 * ============================================================================
 *
 * Yang disimpan hanya cookie domain e-Court yang dibaca dari Chrome sesudah
 * pemeriksaan/login yang berhasil - disandi AES-256-GCM dengan kunci yang
 * sama dengan simpanan kredensial (ecourtKredensialService.sandikan), berkas
 * 0600 di folder sesi yang sama dengan profil Chrome (yang memuat cookie yang
 * sama tanpa sandi tambahan). Sandi e-Court tidak pernah menyentuh berkas ini.
 */

const fs = require("fs");
const https = require("https");
const path = require("path");

const sesiEcourt = require("../tools/ecourt-bridge/sesi");
const scraper = require("../tools/ecourt-bridge/scraper");

/** Batas waktu satu permintaan ringan. */
const BATAS_MS = 6000;

const AGEN =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function hostEcourt() {
  return new URL(scraper.BASE_URL).hostname.toLowerCase();
}

function jalurKuki(slot) {
  return path.join(sesiEcourt.sessionRoot(), `kuki-${sesiEcourt.bersihkanSlot(slot)}.json`);
}

function penyandi() {
  // Dimuat malas: modul kredensial membuat berkas kunci saat pertama dipakai.
  return require("./ecourtKredensialService");
}

/** Hanya cookie domain e-Court, bentuk ringkas. */
function saringKuki(cookies) {
  const host = hostEcourt();
  return (Array.isArray(cookies) ? cookies : [])
    .filter((c) => c && c.name && String(c.domain || "").replace(/^\./, "").toLowerCase().endsWith(host))
    .map((c) => ({
      name: String(c.name),
      value: String(c.value || ""),
      domain: String(c.domain || host),
      path: String(c.path || "/"),
      expires: Number(c.expires) > 0 ? Number(c.expires) : -1,
    }));
}

/** Menyimpan cookie sesi satu slot (tersandi). Gagal = diam: ini hanya jalan pintas. */
function simpanKuki(slot, cookies, { sandi = penyandi() } = {}) {
  const kuki = saringKuki(cookies);
  if (kuki.length === 0) return false;
  try {
    const jalur = jalurKuki(slot);
    fs.mkdirSync(path.dirname(jalur), { recursive: true, mode: 0o700 });
    const sementara = `${jalur}.${process.pid}.tmp`;
    fs.writeFileSync(
      sementara,
      JSON.stringify({ versi: 1, disimpanPada: new Date().toISOString(), kuki: sandi.sandikan(JSON.stringify(kuki)) }),
      { mode: 0o600 }
    );
    fs.renameSync(sementara, jalur);
    try {
      fs.chmodSync(jalur, 0o600);
    } catch {
      /* Windows */
    }
    return true;
  } catch {
    return false;
  }
}

/** Cookie tersimpan satu slot yang belum kedaluwarsa - [] bila tidak ada. */
function bacaKuki(slot, { sandi = penyandi(), sekarangMs = Date.now() } = {}) {
  try {
    const isi = JSON.parse(fs.readFileSync(jalurKuki(slot), "utf8"));
    const daftar = JSON.parse(sandi.bukaSandi(isi && isi.kuki) || "[]");
    return (Array.isArray(daftar) ? daftar : []).filter((c) => !(c.expires > 0 && c.expires * 1000 < sekarangMs));
  } catch {
    return [];
  }
}

function hapusKuki(slot) {
  try {
    fs.unlinkSync(jalurKuki(slot));
  } catch {
    // Sudah tidak ada.
  }
}

/** Cookie dari halaman Chrome yang sedang terbuka (termasuk httpOnly). */
async function kukiDariHalaman(page) {
  try {
    const klien = await page.target().createCDPSession();
    const { cookies } = await klien.send("Network.getAllCookies");
    return saringKuki(cookies);
  } catch {
    return [];
  }
}

/** Membaca cookie dari halaman yang SUDAH terbukti masuk, lalu menyimpannya. */
async function simpanDariHalaman(slot, page) {
  const kuki = await kukiDariHalaman(page);
  return kuki.length ? simpanKuki(slot, kuki) : false;
}

function kepalaCookie(kuki) {
  return kuki.map((c) => `${c.name}=${c.value}`).join("; ");
}

/** Permintaan HTTPS tanpa mengikuti pengalihan - hanya status, Location dan Set-Cookie. */
function mintaHttps(alamat, kepala, batasMs) {
  return new Promise((selesai, gagal) => {
    // http hanya untuk tiruan e-Court lokal (scraper.BASE_URL loopback, simulasi).
    const modul = String(alamat).startsWith("http://") ? require("http") : https;
    const req = modul.request(alamat, { method: "GET", headers: kepala, timeout: batasMs }, (res) => {
      // Badan halaman tidak dibaca: yang ditanya hanya ke mana kita dialihkan.
      res.resume();
      selesai({
        status: res.statusCode || 0,
        location: String(res.headers.location || ""),
        setCookie: Array.isArray(res.headers["set-cookie"]) ? res.headers["set-cookie"] : [],
      });
    });
    req.on("timeout", () => req.destroy(new Error("habis_waktu")));
    req.on("error", gagal);
    req.end();
  });
}

/** Set-Cookie dari jawaban diterapkan ke salinan cookie (e-Court dapat memutar sesinya). */
function terapkanSetCookie(kuki, setCookie) {
  const hasil = kuki.map((c) => ({ ...c }));
  for (const baris of Array.isArray(setCookie) ? setCookie : []) {
    const pertama = String(baris || "").split(";")[0];
    const i = pertama.indexOf("=");
    if (i <= 0) continue;
    const name = pertama.slice(0, i).trim();
    const value = pertama.slice(i + 1).trim();
    const ada = hasil.find((c) => c.name === name);
    if (ada) ada.value = value;
    else hasil.push({ name, value, domain: hostEcourt(), path: "/", expires: -1 });
  }
  return hasil;
}

/**
 * Pemeriksaan ringan satu slot.
 *
 * @returns {Promise<{pasti: boolean, berlaku: boolean|null, alasan: string, ms: number}>}
 *   pasti:true hanya bila e-Court mengalihkan /Login ke halaman sesudah masuk.
 */
async function periksaRingan(slot, { minta = mintaHttps, batasMs = BATAS_MS, sandi } = {}) {
  const mulai = Date.now();
  const selesai = (x) => ({ ...x, ms: Date.now() - mulai });
  const opsiSandi = sandi ? { sandi } : {};
  const kuki = bacaKuki(slot, opsiSandi);
  if (kuki.length === 0) return selesai({ pasti: false, berlaku: null, alasan: "kuki_belum_ada" });

  let jawab;
  try {
    jawab = await minta(
      `${scraper.BASE_URL}/Login`,
      {
        Cookie: kepalaCookie(kuki),
        "User-Agent": AGEN,
        Accept: "text/html",
        // Kerangka CodeIgniter 3 TIDAK memutar ID sesi untuk permintaan AJAX
        // (sess_time_to_update dilewati). Tanpa penanda ini, pemeriksaan ringan
        // dapat memutar ID sesi dan meninggalkan cookie di profil Chrome basi -
        // persis sesi yang hendak dijaga.
        "X-Requested-With": "XMLHttpRequest",
      },
      batasMs
    );
  } catch (galat) {
    return selesai({ pasti: false, berlaku: null, alasan: `galat_jaringan: ${String((galat && galat.message) || galat).slice(0, 80)}` });
  }

  if (jawab.status >= 300 && jawab.status < 400 && jawab.location) {
    let tujuan = "";
    try {
      tujuan = new URL(jawab.location, scraper.BASE_URL).href;
    } catch {
      tujuan = "";
    }
    if (tujuan && scraper.isLoggedInUrl(tujuan)) {
      if (jawab.setCookie.length) simpanKuki(slot, terapkanSetCookie(kuki, jawab.setCookie), opsiSandi);
      return selesai({ pasti: true, berlaku: true, alasan: "" });
    }
    if (tujuan && scraper.isGateUrl(tujuan)) return selesai({ pasti: false, berlaku: null, alasan: "gerbang" });
    return selesai({ pasti: false, berlaku: null, alasan: "dialihkan_bukan_ke_dalam" });
  }
  // 200 = halaman login dilayani. Belum tentu sesi Chrome mati (salinan cookie
  // bisa basi) - RAGU, pemanggil memeriksa dengan Chrome.
  return selesai({ pasti: false, berlaku: null, alasan: jawab.status === 200 ? "halaman_login" : `status_${jawab.status}` });
}

module.exports = {
  BATAS_MS,
  bacaKuki,
  hapusKuki,
  jalurKuki,
  kukiDariHalaman,
  periksaRingan,
  saringKuki,
  simpanDariHalaman,
  simpanKuki,
  terapkanSetCookie,
};
