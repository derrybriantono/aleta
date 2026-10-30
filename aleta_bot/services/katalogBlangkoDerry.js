"use strict";

/**
 * ============================================================================
 * KATALOG BLANGKO DERRY + KANDIDAT VARIAN GANDA (30 Okt 2026, G6 butir 6.4)
 * ============================================================================
 *
 * Bahan Statistik pemakaian blangko di Pusat Kendali. HANYA MEMBACA folder
 * blangko (tidak menulis, tidak memindah, tidak menghapus apa pun).
 *
 *   berkas  semua RTF aktif di folder derry_briantono (folder arsip "terhapus",
 *           "ALUR ..." dan "- BAS ... -" dilewati - itu arsip, bukan blangko
 *           yang dipilih petugas), dengan folder, nama, ukuran.
 *   ganda   pasangan blangko SATU FOLDER yang naskahnya hampir sama
 *           (kemiripan Jaccard rangkaian 5 kata >= AMBANG_MIRIP), kandidat
 *           untuk ditinjau manusia - mungkin varian yang sengaja berbeda
 *           sedikit, mungkin salinan yang bisa diarsipkan. Tidak ada tindakan
 *           otomatis apa pun.
 *
 * Disimpan di ingatan UMUR_MS (folder blangko jarang berubah; satu pindai
 * ±1.800 berkas memakan beberapa detik).
 */

const fs = require("fs/promises");
const path = require("path");

const FOLDER_DERRY = "derry_briantono";
const AMBANG_MIRIP = 0.9;
const UMUR_MS = 10 * 60 * 1000;
const BATAS_BYTE = 8 * 1024 * 1024;
const BATAS_GANDA = 400;

/** Folder arsip (bukan pilihan petugas) - aturan yang sama dengan pemindai paket ABT. */
function folderArsip(rel) {
  const bagian = String(rel || "").split("/");
  const atas = bagian[0] || "";
  return /terhapus/i.test(rel) || /^ALUR/.test(atas) || /^- BAS .* -$/.test(atas);
}

/** Kata-kata naskah RTF (kasar, cukup untuk membandingkan dua blangko). */
function kataRtf(rtf) {
  const abaikan = /^(fonttbl|colortbl|stylesheet|info|pict|themedata|colorschememapping|latentstyles|datastore|generator|xmlnstbl|rsidtbl|listtable|listoverridetable|fldinst|bkmkstart|bkmkend|nonshppict|shppict|objdata|header|footer|headerl|headerr|footerl|footerr)$/i;
  let teks = "";
  let dalam = 0;
  let lewati = 0;
  for (let i = 0; i < rtf.length; ) {
    const h = rtf[i];
    if (h === "{") {
      dalam += 1;
      i += 1;
      continue;
    }
    if (h === "}") {
      dalam -= 1;
      if (lewati && dalam < lewati) lewati = 0;
      i += 1;
      continue;
    }
    if (h === "\\") {
      const m = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(rtf.slice(i, i + 40));
      if (m) {
        if (!lewati && abaikan.test(m[1])) lewati = dalam;
        if (!lewati && (m[1] === "par" || m[1] === "line" || m[1] === "tab")) teks += " ";
        i += m[0].length;
        continue;
      }
      const x = /^\\'([0-9a-fA-F]{2})/.exec(rtf.slice(i, i + 4));
      if (x) {
        if (!lewati) teks += Buffer.from(x[1], "hex").toString("latin1");
        i += 4;
        continue;
      }
      if (rtf[i + 1] === "*") {
        if (!lewati) lewati = dalam;
        i += 2;
        continue;
      }
      i += 2;
      continue;
    }
    if (!lewati && h !== "\r" && h !== "\n") teks += h;
    i += 1;
  }
  return teks.toLowerCase().match(/#\d{3,5}#|[a-z0-9]+/g) || [];
}

/** Himpunan rangkaian 5 kata. */
function sidik(kata) {
  const s = new Set();
  for (let i = 0; i + 5 <= kata.length; i += 1) s.add(kata.slice(i, i + 5).join(" "));
  if (!s.size && kata.length) s.add(kata.join(" "));
  return s;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  const [kecil, besar] = a.size <= b.size ? [a, b] : [b, a];
  let sama = 0;
  for (const x of kecil) if (besar.has(x)) sama += 1;
  return sama / (a.size + b.size - sama);
}

/**
 * Pasangan mirip per folder. Masukan: [{rel, folder, sidik:Set}]. Pasangan yang ukuran sidiknya
 * berselisih jauh dilewati tanpa dihitung (Jaccard tidak mungkin mencapai ambang).
 */
function cariGanda(daftar, ambang = AMBANG_MIRIP) {
  const perFolder = new Map();
  for (const b of daftar) {
    if (!perFolder.has(b.folder)) perFolder.set(b.folder, []);
    perFolder.get(b.folder).push(b);
  }
  const hasil = [];
  for (const [folder, isi] of perFolder) {
    for (let i = 0; i < isi.length; i += 1) {
      for (let j = i + 1; j < isi.length; j += 1) {
        const a = isi[i].sidik.size;
        const c = isi[j].sidik.size;
        if (!a || !c || Math.min(a, c) / Math.max(a, c) < ambang) continue;
        const m = jaccard(isi[i].sidik, isi[j].sidik);
        if (m >= ambang) hasil.push({ folder, a: isi[i].rel, b: isi[j].rel, mirip: Math.round(m * 1000) / 1000 });
      }
    }
  }
  hasil.sort((x, y) => y.mirip - x.mirip || x.a.localeCompare(y.a));
  return hasil.slice(0, BATAS_GANDA);
}

function buatKatalog({ akarBlangko, sekarang = () => Date.now() } = {}) {
  let simpan = null;
  let saat = 0;
  async function jelajah(akar) {
    const keluar = [];
    async function masuk(dir, kedalaman) {
      if (kedalaman > 4) return;
      let isi = [];
      try {
        isi = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of isi) {
        const jalur = path.join(dir, e.name);
        if (e.isDirectory()) await masuk(jalur, kedalaman + 1);
        else if (/\.rtf$/i.test(e.name)) keluar.push(jalur);
      }
    }
    await masuk(akar, 0);
    return keluar;
  }
  async function bangun() {
    const akar = path.resolve(akarBlangko || process.env.ALETA_BOT_BLANGKO_DIR || "/usr/src/app/blangko_abt", FOLDER_DERRY);
    const semua = await jelajah(akar);
    const berkas = [];
    for (const jalur of semua) {
      const rel = path.relative(akar, jalur).split(path.sep).join("/");
      if (folderArsip(rel)) continue;
      const bag = rel.split("/");
      const folder = bag.length > 1 ? bag.slice(0, -1).join("/") : "";
      let ukuran = 0;
      let sd = new Set();
      try {
        const st = await fs.stat(jalur);
        ukuran = st.size;
        if (st.size <= BATAS_BYTE) sd = sidik(kataRtf(await fs.readFile(jalur, "latin1")));
      } catch {
        /* berkas tak terbaca: tetap terdaftar tanpa sidik */
      }
      berkas.push({ rel, folder, nama: bag[bag.length - 1].replace(/\.rtf$/i, ""), ukuran, sidik: sd });
    }
    berkas.sort((a, b) => a.rel.localeCompare(b.rel));
    const ganda = cariGanda(berkas);
    return {
      dipindai: new Date(sekarang()).toISOString(),
      jumlah: berkas.length,
      berkas: berkas.map(({ rel, folder, nama, ukuran }) => ({ rel, folder, nama, ukuran })),
      ganda,
      ambangMirip: AMBANG_MIRIP,
    };
  }
  return {
    async katalog({ segarkan = false } = {}) {
      if (!segarkan && simpan && sekarang() - saat < UMUR_MS) return simpan;
      saat = sekarang();
      simpan = bangun().catch((g) => {
        simpan = null;
        throw g;
      });
      return simpan;
    },
  };
}

module.exports = { buatKatalog, cariGanda, folderArsip, jaccard, kataRtf, sidik, AMBANG_MIRIP, FOLDER_DERRY };
