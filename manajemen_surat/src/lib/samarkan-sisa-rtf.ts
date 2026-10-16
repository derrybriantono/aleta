/**
 * ============================================================================
 * SISA NAMA PIHAK DI ANONIMISASI RTF DISAMARKAN (16 Okt 2026, F1.2)
 * ============================================================================
 *
 * Cermin sisi server dari a30SamarkanSisaRtf (ekstensi-sipp/konten.js, 7 Okt
 * 2026 butir 4 dan 12 Okt butir I) untuk nama pihak dan NIK. Aturannya SATU:
 * uji samarkan-sisa-rtf-16okt mengadu keduanya atas masukan yang sama.
 *
 * Mengapa ada di server: alur "Putusan otomatis" di halaman SIPP menyamarkan
 * sisa itu di peramban sebelum mengunggah, tetapi alur putusan massal di ABT
 * mengunggah anonimisasi ABT apa adanya. ABT hanya menyamarkan nama SIPP
 * utuh, persis hurufnya, sehingga nasab anak ("Rasya bin MELKI"), keterangan
 * saksi ("bernama Haeruddin"), dan bukti ("atas nama Tini") lolos. Diukur atas
 * 251 pasangan putusan+anonimisasi yang sudah diunggah petugas (2025-2026):
 * penjaga unggah-sipp menolak 54% - 45% karena sisa sebagian, 9% karena tidak
 * ada yang tersamar sama sekali. Sisa sebagian inilah yang dapat disamarkan
 * dengan aman; yang tidak tersamar sama sekali tetap ditolak.
 *
 * Yang disamarkan HANYA salinan anonimisasi; putusan asli tidak disentuh.
 * Bentuk samarannya mengikuti anonimisasi satker: "( xxx )" bila nama itu
 * satu-satunya isi kurung, selebihnya "xxx"; NIK 16 angka menjadi 16 "x".
 * Nama yang terbelah ganti paragraf tidak ditebak - dibiarkan untuk penjaga.
 */
import { bentukNamaPihak, nilaiPenyamaran } from "@/lib/anonim-nama-pihak";
import { bacaRtfDariBita } from "@/lib/baca-rtf";

/** Pembacaan RTF: teks datar beserta asal tiap aksara di sumbernya. */
export type PetaRtf = {
  teks: string;
  /** Awal dan akhir (eksklusif) tiap aksara teks di dalam sumber RTF. */
  awal: number[];
  akhir: number[];
  /** Aksara yang lahir dari kata kendali (\par, \tab) - bukan huruf naskah. */
  kendali: boolean[];
};

const LEWATI =
  /^(fonttbl|colortbl|stylesheet|info|pict|object|header|headerl|headerr|headerf|footer|footerl|footerr|footerf|listtable|listoverridetable|rsidtbl|generator|xmlnstbl|themedata|colorschememapping|latentstyles|datastore|pgdsctbl|filetbl|revtbl|fldinst)$/;

export function petaRtf(rtf: string): PetaRtf {
  const s = String(rtf ?? "");
  const teks: string[] = [];
  const awal: number[] = [];
  const akhir: number[] = [];
  const kendali: boolean[] = [];
  const tambah = (aksara: string, dari: number, sampai: number, olehKendali: boolean) => {
    teks.push(aksara);
    awal.push(dari);
    akhir.push(sampai);
    kendali.push(olehKendali);
  };
  let aras = 0;
  let lewatiAras = -1;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "{") {
      aras += 1;
      i += 1;
      continue;
    }
    if (c === "}") {
      if (lewatiAras === aras) lewatiAras = -1;
      aras -= 1;
      i += 1;
      continue;
    }
    const lewati = lewatiAras !== -1;
    if (c === "\\") {
      const n = s[i + 1];
      if (n === "\\" || n === "{" || n === "}") {
        if (!lewati) tambah(n, i, i + 2, false);
        i += 2;
        continue;
      }
      if (n === "'") {
        const kode = parseInt(s.slice(i + 2, i + 4), 16);
        if (!lewati && Number.isFinite(kode)) tambah(String.fromCharCode(kode), i, i + 4, false);
        i += 4;
        continue;
      }
      if (n === "*") {
        if (!lewati) lewatiAras = aras;
        i += 2;
        continue;
      }
      const m = /^([a-zA-Z]+)(-?\d+)? ?/.exec(s.slice(i + 1, i + 48));
      if (!m) {
        i += 2;
        continue;
      }
      const mulai = i;
      i += 1 + m[0].length;
      if (lewati) continue;
      const kata = m[1];
      if (LEWATI.test(kata)) {
        lewatiAras = aras;
        continue;
      }
      if (kata === "par" || kata === "line" || kata === "sect" || kata === "page" || kata === "row") tambah("\n", mulai, i, true);
      else if (kata === "tab" || kata === "cell") tambah(" ", mulai, i, true);
      else if (kata === "u" && m[2] !== undefined) {
        let kode = Number(m[2]);
        if (kode < 0) kode += 65536;
        // Pengganti ASCII sesudah \uN dilewati - dan ikut menjadi asal aksaranya.
        if (s[i] === "\\" && s[i + 1] === "'") i += 4;
        else if (s[i] && s[i] !== "\\" && s[i] !== "{" && s[i] !== "}") i += 1;
        tambah(String.fromCharCode(kode), mulai, i, false);
      }
      continue;
    }
    if (c !== "\r" && c !== "\n" && !lewati) tambah(c, i, i + 1, false);
    i += 1;
  }
  return { teks: teks.join(""), awal, akhir, kendali };
}

/** Kata umum dan jabatan yang tidak pernah disamarkan walau terbaca sebagai "nama". */
const BUKAN_SAMARAN = /^(?:pengadilan|majelis|hakim|panitera|juru\s*sita|jurusita|mediator|ketua|anggota|penggugat|tergugat|pemohon|termohon|saksi|kuasa)\b/i;

/** Titik singkatan dan spasi antar kata lentur ("Muh. Rizal" = "MUH.RIZAL" = "Muh Rizal"). */
function amanKata(teks: string, spasiLentur: boolean): string {
  return String(teks)
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\.\s+/g, "\\.?\\s*")
    .replace(/\s+/g, spasiLentur ? "\\s*" : "\\s+")
    .replace(/\\\.(?!\?)/g, "\\.?");
}

type Sasaran = { jenis: string; teks: string; depan: boolean; lanjut: string };

function polaSasaran(x: Sasaran): RegExp {
  if (!x.depan) {
    return new RegExp(`(^|[^\\p{L}\\p{N}])(${amanKata(x.teks, true)})(?=[^\\p{L}\\p{N}]|$)`, "iu");
  }
  return new RegExp(`((?:^|[^\\p{L}\\p{N}])(?:bernama|nama)\\s*:?\\s*)(${amanKata(x.teks, true)})(?=[^\\p{L}\\p{N}]|$)`, "iu");
}

/**
 * Potongan DEPAN nama diri yang bermakna: "Musdiman Lahauwa" -> "Musdiman".
 * Potongan belakang tidak dipakai (hampir selalu nama orang lain atau kata biasa).
 */
function potonganDepan(diri: string): Array<{ teks: string; lanjut: string }> {
  const bukanNama = /^(?:andi|siti|sitti|moh|muh|mohd|muhammad|mohammad|mohamad|muhamad|muhammat|abd|abdul|haji|hajjah|hajah|daeng|dg|nur|sri|ni|la|wa|h|hj|ir|dr|drs|i)\.?$/i;
  const kata = String(diri || "").replace(/\s+/g, " ").trim().split(" ");
  const hasil: Array<{ teks: string; lanjut: string }> = [];
  for (let k = 1; k < kata.length; k += 1) {
    const depan = kata.slice(0, k);
    if (depan.every((x) => bukanNama.test(x))) continue;
    if (depan.join("").replace(/[^\p{L}]/gu, "").length < 4) continue;
    hasil.push({ teks: depan.join(" "), lanjut: kata[k] });
  }
  return hasil;
}

/** Potongan depan yang disusul kata ber-huruf-besar LAIN, atau bin/binti, adalah nama orang lain. */
function depanMilikPihak(teks: string, akhir: number, lanjut: string): boolean {
  const m = /^[ \t]+([\p{L}][\p{L}.'-]*)/u.exec(String(teks || "").slice(akhir, akhir + 60));
  if (!m) return true;
  if (/^(?:bin|binti)$/i.test(m[1])) return false;
  if (/^\p{Lu}/u.test(m[1]) && m[1].toLowerCase() !== String(lanjut || "").toLowerCase()) return false;
  return true;
}

/** Sasaran dari daftar nama pihak SIPP - sama dengan a30DataPribadiHalaman.tambahNama. */
export function sasaranNamaPihak(namaPihak: string[]): Sasaran[] {
  const nama = new Map<string, Sasaran>();
  const tambah = (teks: string) => {
    const t = String(teks ?? "").replace(/\s+/g, " ").trim();
    if (t.length < 4 || t.length > 80 || /\d/.test(t) || /^(penggugat|tergugat|pemohon|termohon|nama|tidak ada)$/i.test(t)) return;
    nama.set(t.toLowerCase(), { jenis: "nama pihak", teks: t, depan: false, lanjut: "" });
    const bentuk = bentukNamaPihak(t);
    for (const x of bentuk.ruas.concat(bentuk.diri)) {
      if (x && x.length >= 4 && !nama.has(x.toLowerCase())) nama.set(x.toLowerCase(), { jenis: "nama pihak", teks: x, depan: false, lanjut: "" });
    }
    for (const d of bentuk.diri) {
      for (const p of potonganDepan(d)) {
        const kunci = `depan:${p.teks.toLowerCase()}`;
        if (!nama.has(p.teks.toLowerCase()) && !nama.has(kunci)) nama.set(kunci, { jenis: "nama pihak", teks: p.teks, depan: true, lanjut: p.lanjut });
      }
    }
  };
  for (const n of namaPihak) tambah(n);
  return Array.from(nama.values());
}

export type PenggantiSamaran = { jenis: string; kata: string; menjadi: string };

/**
 * Menyamarkan sisa nama pihak (dan NIK 16 angka) pada RTF. Tidak peka
 * besar-kecil huruf, titik dan spasi lentur, menembus kode format RTF.
 * @param rtf RTF sebagai teks satu-aksara-per-bita (latin1)
 */
export function samarkanSisaRtf(
  rtf: string,
  namaPihak: string[],
  opsi: { nik?: boolean } = {}
): { rtf: string; diganti: PenggantiSamaran[] } {
  const asal = String(rtf ?? "");
  const peta = petaRtf(asal);
  const t = peta.teks;
  const sasaran = sasaranNamaPihak(namaPihak)
    .filter((x) => x.teks.trim().length >= 4 && !BUKAN_SAMARAN.test(x.teks.trim()))
    // Yang panjang lebih dulu: "Sulfiani binti H. Abd Hamid" sebelum "Sulfiani".
    .sort((a, b) => b.teks.length - a.teks.length);
  const terpakai = new Uint8Array(t.length);
  const ganti: Array<{ mulai: number; akhir: number; menjadi: string; jenis: string; kata: string }> = [];
  const bebas = (dari: number, sampai: number) => {
    for (let k = dari; k < sampai; k += 1) if (terpakai[k]) return false;
    return true;
  };
  if (opsi.nik !== false) {
    for (const m of t.matchAll(/(^|[^\d])(\d{16})(?=[^\d]|$)/g)) {
      const mulai = (m.index ?? 0) + m[1].length;
      const akhir = mulai + 16;
      if (!bebas(mulai, akhir)) continue;
      for (let k = mulai; k < akhir; k += 1) terpakai[k] = 1;
      ganti.push({ mulai, akhir, menjadi: "x".repeat(16), jenis: "NIK", kata: m[2] });
    }
  }
  for (const satu of sasaran) {
    const pola = new RegExp(polaSasaran(satu).source, "giu");
    for (const m of t.matchAll(pola)) {
      let mulai = (m.index ?? 0) + m[1].length;
      let akhir = mulai + m[2].length;
      // Nama yang terbelah ganti paragraf bukan satu nama di naskah - dibiarkan untuk penjaga.
      if (t.slice(mulai, akhir).includes("\n")) continue;
      if (!bebas(mulai, akhir)) continue;
      if (satu.depan && !depanMilikPihak(t, akhir, satu.lanjut)) continue;
      let menjadi = "xxx";
      const kiri = /\(\s*$/.exec(t.slice(Math.max(0, mulai - 3), mulai));
      const kanan = /^\s*\)/.exec(t.slice(akhir, akhir + 3));
      if (kiri && kanan && bebas(mulai - kiri[0].length, akhir + kanan[0].length)) {
        mulai -= kiri[0].length;
        akhir += kanan[0].length;
        menjadi = "( xxx )";
      }
      for (let k = mulai; k < akhir; k += 1) terpakai[k] = 1;
      ganti.push({ mulai, akhir, menjadi, jenis: satu.jenis, kata: m[2] });
    }
  }
  if (!ganti.length) return { rtf: asal, diganti: [] };
  // Tiap aksara yang disamarkan dibuang dari sumbernya; samarannya ditulis di
  // tempat aksara pertama. Kata kendali di tengahnya (format, \tab) tetap.
  const sunting: Array<{ dari: number; sampai: number; isi: string }> = [];
  for (const g of ganti) {
    let pertama = true;
    for (let k = g.mulai; k < g.akhir; k += 1) {
      if (peta.kendali[k]) continue;
      sunting.push({ dari: peta.awal[k], sampai: peta.akhir[k], isi: pertama ? g.menjadi : "" });
      pertama = false;
    }
  }
  sunting.sort((a, b) => a.dari - b.dari);
  let keluar = "";
  let pos = 0;
  for (const s of sunting) {
    if (s.dari < pos) continue;
    keluar += asal.slice(pos, s.dari) + s.isi;
    pos = s.sampai;
  }
  keluar += asal.slice(pos);
  return { rtf: keluar, diganti: ganti.map((g) => ({ jenis: g.jenis, kata: g.kata, menjadi: g.menjadi })) };
}

/** RTF (byte) -> teks satu-aksara-per-bita -> disamarkan -> byte. Aksara di atas 255 tidak lahir dari sumber latin1. */
export function samarkanSisaRtfBita(
  bita: Uint8Array,
  namaPihak: string[],
  opsi: { nik?: boolean } = {}
): { bita: Uint8Array; diganti: PenggantiSamaran[] } {
  let teks = "";
  const potong = 0x8000;
  for (let i = 0; i < bita.length; i += potong) teks += String.fromCharCode(...bita.subarray(i, i + potong));
  const hasil = samarkanSisaRtf(teks, namaPihak, opsi);
  if (!hasil.diganti.length) return { bita, diganti: [] };
  const baru = new Uint8Array(hasil.rtf.length);
  for (let i = 0; i < hasil.rtf.length; i += 1) {
    const k = hasil.rtf.charCodeAt(i);
    baru[i] = k > 255 ? 63 : k;
  }
  return { bita: baru, diganti: hasil.diganti };
}

/**
 * Untuk rute unggah-sipp: sisa nama disamarkan HANYA bila anonimisasi itu
 * sungguh pernah disamarkan (nilaiPenyamaran.ada - ABT menyamarkan sebagian).
 * Berkas yang tidak tersamar sama sekali tampaknya putusan asli yang salah
 * tempat; menyamarkannya diam-diam akan menutupi salah slot itu, jadi ia
 * dibiarkan ditolak penjaga ("tampaknya putusan asli").
 */
export function samarkanSisaBilaTersamar(masukan: {
  anonim: Uint8Array;
  putusan?: Uint8Array | null;
  namaPihak: string[];
}): { bita: Uint8Array; diganti: PenggantiSamaran[]; dilewati: "" | "belum_tersamar" | "bukan_rtf" } {
  const adalahRtf = (b: Uint8Array) => String.fromCharCode(...b.subarray(0, 8)).startsWith("{\\rtf");
  if (!adalahRtf(masukan.anonim)) return { bita: masukan.anonim, diganti: [], dilewati: "bukan_rtf" };
  const teksAnonim = bacaRtfDariBita(masukan.anonim);
  const teksPutusan = masukan.putusan && adalahRtf(masukan.putusan) ? bacaRtfDariBita(masukan.putusan) : null;
  const nilai = nilaiPenyamaran({ teksAnonim, teksPutusan, namaPihak: masukan.namaPihak });
  if (!nilai.ada) return { bita: masukan.anonim, diganti: [], dilewati: "belum_tersamar" };
  const hasil = samarkanSisaRtfBita(masukan.anonim, masukan.namaPihak, { nik: true });
  return { bita: hasil.bita, diganti: hasil.diganti, dilewati: "" };
}
