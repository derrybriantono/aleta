/**
 * ============================================================================
 * P3 (1 Nov 2026) - PENGUKUR DRAF PUTUSAN vs PUTUSAN AKHIR (aturan murni, tanpa basis data, tanpa AI)
 * ============================================================================
 *
 * Setelah putusan diputus, draf A1 yang tersimpan dibandingkan dengan putusan akhir (bandingDrafA1). Di sini:
 *   - skorKecocokan      angka kecocokan per perkara: amar, dasar hukum, bagian, huruf alasan (pembilang & penyebut, supaya
 *                        rata-rata bulanan = jumlah pembilang / jumlah penyebut, bukan rata-rata persen);
 *   - koreksiDariBanding selisih draf vs putusan akhir menjadi daftar KOREKSI hakim yang sudah TERSAMAR (nama pihak, nama anak/
 *                        saksi, angka, tanggal, nominal dibuang dari teksnya);
 *   - ringkasBulanan     tingkat kecocokan per bulan;
 *   - polaBerulang       koreksi yang berulang per hakim (ketua majelis) dan untuk semua hakim;
 *   - usulanMemori       pola -> kalimat USULAN MEMORI PROYEK ALETA Ai (Super Admin yang menyetujui; tanpa nama pihak/data perkara);
 *   - pisahNaskahPutusan teks dokumen putusan (PDF/Word) -> pertimbangan + amar, bila SIPP belum memuat pertimbangannya.
 *
 * Tidak ada yang ditulis ke SIPP/ABT. Hasil HANYA mengusulkan; tidak ada yang berlaku sendiri.
 */

import type { HasilBandingA1, TopikPertimbangan } from "@/lib/banding-draf-a1";

export type JenisKoreksi =
  | "pasal-ditambah"
  | "pasal-dibuang"
  | "bagian-ditambah"
  | "amar-ditambah"
  | "amar-dibuang"
  | "kalimat-diganti"
  | "huruf-ditambah"
  | "huruf-dibuang";

export type Koreksi = {
  jenis: JenisKoreksi;
  /** Kunci stabil (pasal "KODE|pasal", topik, huruf, atau sidik pola kalimat) - dasar penghitungan berulang. */
  kunci: string;
  /** Teks ringkas yang sudah tersamar - aman ditampilkan dan dikirim ke memori proyek. */
  ringkas: string;
};

export type SkorUkur = {
  amarAkhir: number;
  /** Butir amar akhir yang punya padanan di draf (sama + mirip). */
  amarCocok: number;
  /** Yang sama persis menurut ambang "sama". */
  amarPersis: number;
  dasarAkhir: number;
  /** Rujukan pasal akhir yang disebut draf (terverifikasi atau bertanda). */
  dasarCocok: number;
  /** Hanya yang terverifikasi di rak. */
  dasarTerverifikasi: number;
  bagianAkhir: number;
  bagianCocok: number;
  /** 1 = sama, 0 = beda, -1 = putusan akhir tidak menyebut huruf (tidak dihitung). */
  hurufSama: 1 | 0 | -1;
};

export function skorKecocokan(h: HasilBandingA1): SkorUkur {
  return {
    amarAkhir: h.amar.akhir,
    amarCocok: h.amar.sama + h.amar.mirip,
    amarPersis: h.amar.sama,
    dasarAkhir: h.dasar.akhir.length,
    dasarCocok: h.dasar.sama.length + h.dasar.samaBertanda.length,
    dasarTerverifikasi: h.dasar.sama.length,
    bagianAkhir: h.bagian.akhir.length,
    bagianCocok: h.bagian.akhir.length - h.bagian.hilang.length,
    hurufSama: !h.huruf.akhir ? -1 : h.huruf.sama ? 1 : 0,
  };
}

// ============================================================================
// PENYAMARAN POLA KALIMAT
// ============================================================================

const KATA_BAKU = new Set([
  "penggugat", "tergugat", "pemohon", "termohon", "pembanding", "terbanding", "rp", "pasal", "khi", "rbg", "hir", "ayat", "huruf", "angka",
  "undang-undang", "nomor", "tahun", "pengadilan", "agama", "mahkamah", "agung", "kompilasi", "hukum", "islam", "republik", "indonesia",
  "kuh", "perdata", "perma", "sema", "pp", "uu", "dan", "atau", "yang", "kepada", "terhadap", "untuk", "dengan", "dari", "pada", "ini",
  "iddah", "mut'ah", "muth'ah", "mutah", "madliyah", "madhiyah", "nafkah", "hadhanah", "hadanah", "talak", "raj'i", "ba'in", "sughra", "shughra",
  "kubra", "verstek", "akta", "cerai", "nikah", "ikrar", "gugatan", "permohonan", "menghukum", "menetapkan", "membebankan", "mengabulkan", "menolak",
]);

/** FNV-1a 32 bit -> 8 digit heksa. Cukup untuk kunci pengelompokan (bukan keamanan). */
export function sidikPendek(t: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

const lepas = (t: string) => String(t ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Teks butir/kalimat -> POLA tanpa data perkara: isi tanda kurung dibuang, "bin/binti ..." dibuang, nama para pihak yang
 * diketahui (namaSamaran) dibuang utuh dan per potongan, nominal -> "Rp N", angka -> "N", kata berhuruf besar di tengah
 * kalimat yang bukan istilah baku (calon nama anak/saksi/tempat) -> "<nama>". Berlebihan menyamarkan itu AMAN.
 */
export function polaTersamar(teksMasuk: string, namaSamaran: readonly string[] = [], batas = 200): string {
  let t = String(teksMasuk ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\([^()]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Nama pihak yang diketahui (utuh, lalu per potongan 4+ huruf).
  const potongan = new Set<string>();
  for (const n of namaSamaran) {
    const nama = String(n ?? "").trim();
    if (nama.length < 3) continue;
    t = t.split(new RegExp(nama.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")).join(" <nama> ");
    for (const k of lepas(nama).split(/[^a-z0-9]+/)) if (k.length >= 4 && !KATA_BAKU.has(k)) potongan.add(k);
  }
  t = t
    .replace(/\b(?:bin|binti|bn|bt)\b\.?\s+[^;,.:]*/gi, " <nama> ")
    .replace(/Rp\s*[\d.,]+|Rp\s*\.{3,}[\d.,]*/gi, "Rp N")
    .replace(/\b\d{1,2}\s+(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+\d{4}\b/gi, "<tanggal>")
    .replace(/\d+(?:[.,]\d+)*/g, "N");
  const kata = t.split(/\s+/).filter(Boolean);
  const keluar: string[] = [];
  kata.forEach((k, i) => {
    const polos = k.replace(/^[^\p{L}<]+|[^\p{L}>]+$/gu, "");
    const kecil = lepas(polos);
    const nama = potongan.has(kecil) || (i > 0 && /^\p{Lu}/u.test(polos) && polos.length > 1 && !KATA_BAKU.has(kecil) && !/^<|^N$/.test(polos) && !/^\p{Lu}{2,}$/u.test(polos));
    if (nama) {
      if (keluar[keluar.length - 1] !== "<nama>") keluar.push("<nama>");
    } else keluar.push(k);
  });
  let hasil = keluar.join(" ").replace(/(<nama>\s*){2,}/g, "<nama> ").replace(/\s+/g, " ").trim();
  if (hasil.length > batas) hasil = `${hasil.slice(0, batas).replace(/\s+\S*$/, "")} ...`;
  return hasil;
}

/** Kunci pola kalimat: delapan kata pertama pola (angka dan nama sudah ditiadakan). */
export function kunciPola(pola: string): string {
  return sidikPendek(
    lepas(pola)
      .replace(/[^a-z0-9<>' ]+/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 8)
      .join(" ")
  );
}

// ============================================================================
// LABEL
// ============================================================================

const LABEL_TOPIK: Record<TopikPertimbangan, string> = {
  pokok: "pokok perkara (maksud dan tujuan gugatan)",
  kehadiran: "kehadiran dan pemanggilan para pihak",
  damai: "upaya perdamaian oleh hakim",
  mediasi: "mediasi",
  pns: "izin atasan bagi pegawai negeri",
  alasan: "alasan perceraian",
  jawaban: "jawaban, replik, dan duplik",
  beban: "beban pembuktian",
  bukti: "penilaian bukti surat",
  saksi: "keterangan saksi dan kesimpulan",
  kesimpulan: "kesimpulan para pihak",
  fakta: "fakta hukum",
  penilaian: "penilaian dan kesimpulan hukum",
  sema: "rujukan SEMA",
  kaidah: "kaidah fikih, dalil Al-Qur'an, atau hadis",
  biaya: "biaya perkara",
  elektronik: "persidangan elektronik",
  rekonvensi: "rekonvensi",
  "akibat-cerai": "akibat perceraian (nafkah iddah, mut'ah, nafkah madliyah, hadhanah)",
};

export function labelTopik(t: string): string {
  return LABEL_TOPIK[t as TopikPertimbangan] ?? t;
}

const LABEL_HURUF: Record<string, string> = {
  A: "zina, pemabuk, pemadat, penjudi, dan sejenisnya",
  B: "meninggalkan pihak lain dua tahun berturut-turut tanpa izin",
  C: "dihukum penjara lima tahun atau lebih",
  D: "kekejaman atau penganiayaan berat",
  E: "cacat badan atau penyakit yang menghalangi kewajiban",
  F: "perselisihan dan pertengkaran terus-menerus",
  G: "pelanggaran taklik talak",
  H: "peralihan agama (murtad) yang menimbulkan ketidakrukunan",
};

export function labelHuruf(h: string): string {
  return `huruf ${h.toUpperCase()} (${LABEL_HURUF[h.toUpperCase()] ?? "alasan perceraian"})`;
}

export function labelRujukan(kunci: string): string {
  const [kode, pasal] = kunci.split("|");
  const k = kode ?? "";
  const nomor = (m: RegExpMatchArray | null, jenis: string) => (m ? `${jenis} Nomor ${m[1]} Tahun ${m[2]}` : "");
  let nama = "";
  if (k === "KHI") nama = "Kompilasi Hukum Islam";
  else if (k === "RBG") nama = "RBg";
  else if (k === "HIR") nama = "HIR";
  else if (k === "KUHPERDATA") nama = "KUH Perdata";
  else nama = nomor(k.match(/^UU-(\d+)-(\d{4})$/), "Undang-Undang") || nomor(k.match(/^PP-(\d+)-(\d{4})$/), "Peraturan Pemerintah") || nomor(k.match(/^PERMA-(\d+)-(\d{4})$/), "PERMA") || nomor(k.match(/^SEMA-(\d+)-(\d{4})$/), "SEMA") || k;
  return `Pasal ${pasal ?? "?"} ${nama}`.trim();
}

// ============================================================================
// KOREKSI DARI SATU PERBANDINGAN
// ============================================================================

export const BATAS_KOREKSI_PER_PERKARA = 40;

/** Rujukan yang sama beda sebutan: Pasal n lampiran Inpres 1/1991 = Pasal n KHI. */
export function kunciPasalBaku(k: string): string {
  return k.replace(/^INPRES-1-1991\|/, "KHI|");
}

export function koreksiDariBanding(h: HasilBandingA1, namaSamaran: readonly string[] = []): Koreksi[] {
  const hasil: Koreksi[] = [];
  const tambah = (k: Koreksi) => {
    if (!hasil.some((x) => x.jenis === k.jenis && x.kunci === k.kunci)) hasil.push(k);
  };
  // Sebutan lain untuk pasal yang sama disatukan; pasal yang muncul di kedua sisi (hanya beda sebutan) bukan koreksi.
  const ditambah = new Set(h.dasar.hilang.map(kunciPasalBaku));
  const dibuang = new Set(h.dasar.lebih.map(kunciPasalBaku));
  for (const k of ditambah) if (!dibuang.has(k) && !h.dasar.sama.map(kunciPasalBaku).includes(k)) tambah({ jenis: "pasal-ditambah", kunci: k, ringkas: labelRujukan(k) });
  for (const k of dibuang) if (!ditambah.has(k) && !h.dasar.akhir.map(kunciPasalBaku).includes(k)) tambah({ jenis: "pasal-dibuang", kunci: k, ringkas: labelRujukan(k) });
  for (const t of h.bagian.hilang) tambah({ jenis: "bagian-ditambah", kunci: t, ringkas: labelTopik(t) });
  for (const a of h.amar.hilang) {
    const pola = polaTersamar(a, namaSamaran);
    if (pola.length >= 12) tambah({ jenis: "amar-ditambah", kunci: kunciPola(pola), ringkas: pola });
  }
  for (const a of h.amar.lebih) {
    const pola = polaTersamar(a, namaSamaran);
    if (pola.length >= 12) tambah({ jenis: "amar-dibuang", kunci: kunciPola(pola), ringkas: pola });
  }
  for (const p of h.amar.pasangan ?? []) {
    const dari = polaTersamar(p.draf, namaSamaran, 140);
    const ke = polaTersamar(p.akhir, namaSamaran, 140);
    if (dari && ke && lepas(dari) !== lepas(ke)) tambah({ jenis: "kalimat-diganti", kunci: sidikPendek(`${kunciPola(dari)}>${kunciPola(ke)}`), ringkas: `${dari}  =>  ${ke}` });
  }
  const d = new Set(h.huruf.draf.split(""));
  const a = new Set(h.huruf.akhir.split(""));
  if (h.huruf.akhir) {
    for (const x of a) if (!d.has(x)) tambah({ jenis: "huruf-ditambah", kunci: x, ringkas: labelHuruf(x) });
    for (const x of d) if (!a.has(x)) tambah({ jenis: "huruf-dibuang", kunci: x, ringkas: labelHuruf(x) });
  }
  return hasil.slice(0, BATAS_KOREKSI_PER_PERKARA);
}

// ============================================================================
// RINGKASAN BULANAN & POLA BERULANG
// ============================================================================

export type BarisUkur = {
  perkaraId: string;
  hakim: string;
  bulan: string;
  skor: SkorUkur;
  koreksi: Koreksi[];
};

const persenDari = (a: number, b: number): number | null => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);

export type RingkasBulan = {
  bulan: string;
  perkara: number;
  amar: number | null;
  amarPersis: number | null;
  dasar: number | null;
  dasarTerverifikasi: number | null;
  bagian: number | null;
  huruf: number | null;
};

export function ringkasBulanan(baris: readonly BarisUkur[]): RingkasBulan[] {
  const per = new Map<string, BarisUkur[]>();
  for (const b of baris) {
    if (!per.has(b.bulan)) per.set(b.bulan, []);
    per.get(b.bulan)!.push(b);
  }
  const jum = (rows: BarisUkur[], f: (s: SkorUkur) => number) => rows.reduce((n, r) => n + f(r.skor), 0);
  return [...per.entries()]
    .sort((x, y) => (x[0] < y[0] ? 1 : -1))
    .map(([bulan, rows]) => {
      const ber = rows.filter((r) => r.skor.hurufSama >= 0);
      return {
        bulan,
        perkara: rows.length,
        amar: persenDari(jum(rows, (s) => s.amarCocok), jum(rows, (s) => s.amarAkhir)),
        amarPersis: persenDari(jum(rows, (s) => s.amarPersis), jum(rows, (s) => s.amarAkhir)),
        dasar: persenDari(jum(rows, (s) => s.dasarCocok), jum(rows, (s) => s.dasarAkhir)),
        dasarTerverifikasi: persenDari(jum(rows, (s) => s.dasarTerverifikasi), jum(rows, (s) => s.dasarAkhir)),
        bagian: persenDari(jum(rows, (s) => s.bagianCocok), jum(rows, (s) => s.bagianAkhir)),
        huruf: persenDari(ber.filter((r) => r.skor.hurufSama === 1).length, ber.length),
      };
    });
}

export type Lingkup = "hakim" | "semua";

export type PolaKoreksi = {
  lingkup: Lingkup;
  /** Nama hakim (ketua majelis) untuk lingkup "hakim"; kosong untuk "semua". */
  hakim: string;
  jenis: JenisKoreksi;
  kunci: string;
  ringkas: string;
  /** Banyak perkara tempat koreksi ini terjadi, dan banyak perkara terukur kelompok itu. */
  perkara: number;
  dari: number;
  persen: number;
};

/**
 * Berulang = terjadi pada paling sedikit 3 perkara DAN paling sedikit 40% perkara terukur kelompok itu; paling banyak
 * `teratas` pola per kelompok (yang tersering) supaya Super Admin tidak dibanjiri usulan.
 */
export const AMBANG_POLA = { minPerkara: 3, minPersen: 40, teratas: 6 };

export function polaBerulang(baris: readonly BarisUkur[], ambang: { minPerkara: number; minPersen: number; teratas: number } = AMBANG_POLA): PolaKoreksi[] {
  const hasil: PolaKoreksi[] = [];
  const kelompok = (rows: readonly BarisUkur[], lingkup: Lingkup, hakim: string) => {
    if (rows.length < ambang.minPerkara) return;
    const hitung = new Map<string, { jenis: JenisKoreksi; kunci: string; ringkas: string; perkara: Set<string> }>();
    for (const r of rows) {
      for (const k of r.koreksi) {
        const id = `${k.jenis}|${k.kunci}`;
        let e = hitung.get(id);
        if (!e) hitung.set(id, (e = { jenis: k.jenis, kunci: k.kunci, ringkas: k.ringkas, perkara: new Set() }));
        e.perkara.add(r.perkaraId);
      }
    }
    const calon: PolaKoreksi[] = [];
    for (const e of hitung.values()) {
      const n = e.perkara.size;
      const persen = Math.round((n / rows.length) * 1000) / 10;
      if (n >= ambang.minPerkara && persen >= ambang.minPersen) calon.push({ lingkup, hakim, jenis: e.jenis, kunci: e.kunci, ringkas: e.ringkas, perkara: n, dari: rows.length, persen });
    }
    calon.sort((a, b) => b.perkara - a.perkara || a.jenis.localeCompare(b.jenis) || a.kunci.localeCompare(b.kunci));
    hasil.push(...calon.slice(0, ambang.teratas));
  };
  kelompok(baris, "semua", "");
  const perHakim = new Map<string, BarisUkur[]>();
  for (const b of baris) {
    if (!b.hakim) continue;
    if (!perHakim.has(b.hakim)) perHakim.set(b.hakim, []);
    perHakim.get(b.hakim)!.push(b);
  }
  for (const [h, rows] of [...perHakim.entries()].sort((a, b) => a[0].localeCompare(b[0]))) kelompok(rows, "hakim", h);
  return hasil.sort((a, b) => (a.lingkup === b.lingkup ? 0 : a.lingkup === "semua" ? -1 : 1) || a.hakim.localeCompare(b.hakim) || b.persen - a.persen || b.perkara - a.perkara || a.kunci.localeCompare(b.kunci));
}

/** Koreksi tersering (tanpa ambang) - bahan daftar "koreksi tersering" di laporan. */
export function koreksiTersering(baris: readonly BarisUkur[], batas = 10): Array<{ jenis: JenisKoreksi; kunci: string; ringkas: string; perkara: number; dari: number; persen: number }> {
  const hitung = new Map<string, { jenis: JenisKoreksi; kunci: string; ringkas: string; perkara: Set<string> }>();
  for (const r of baris) {
    for (const k of r.koreksi) {
      const id = `${k.jenis}|${k.kunci}`;
      let e = hitung.get(id);
      if (!e) hitung.set(id, (e = { jenis: k.jenis, kunci: k.kunci, ringkas: k.ringkas, perkara: new Set() }));
      e.perkara.add(r.perkaraId);
    }
  }
  return [...hitung.values()]
    .map((e) => ({ jenis: e.jenis, kunci: e.kunci, ringkas: e.ringkas, perkara: e.perkara.size, dari: baris.length, persen: persenDari(e.perkara.size, baris.length) ?? 0 }))
    .filter((e) => e.perkara >= 2)
    .sort((a, b) => b.perkara - a.perkara || a.kunci.localeCompare(b.kunci))
    .slice(0, batas);
}

export const LABEL_JENIS_KOREKSI: Record<JenisKoreksi, string> = {
  "pasal-ditambah": "Dasar hukum ditambah hakim",
  "pasal-dibuang": "Dasar hukum dibuang hakim",
  "bagian-ditambah": "Bagian pertimbangan ditambah hakim",
  "amar-ditambah": "Butir amar ditambah hakim",
  "amar-dibuang": "Butir amar draf dibuang hakim",
  "kalimat-diganti": "Kalimat amar diganti hakim",
  "huruf-ditambah": "Alasan perceraian ditambah hakim",
  "huruf-dibuang": "Alasan perceraian dibuang hakim",
};

// ============================================================================
// USULAN MEMORI PROYEK ALETA Ai
// ============================================================================

export type UsulanMemori = {
  id: string;
  lingkup: Lingkup;
  hakim: string;
  jenis: JenisKoreksi;
  kunci: string;
  teks: string;
  perkara: number;
  dari: number;
};

/** Batas panjang satu memori proyek (sama dengan BATAS_MEMORI_KARAKTER modul proyek). */
export const BATAS_TEKS_MEMORI = 1_000;

export function teksMemori(p: PolaKoreksi): string {
  const siapa = p.lingkup === "hakim" ? `majelis yang diketuai ${p.hakim}` : "para hakim";
  const seberapa = `(${p.perkara} dari ${p.dari} putusan cerai yang diukur)`;
  const tutup = "Susun draf dengan memperhatikan kebiasaan ini; tetap hanya usulan, keputusan ada pada hakim.";
  let t: string;
  switch (p.jenis) {
    case "pasal-ditambah":
      t = `Pada pertimbangan perkara cerai, ${siapa} cenderung menambahkan dasar hukum ${p.ringkas} yang belum ada di draf ${seberapa}. Pertimbangkan mencantumkannya bila relevan dan terverifikasi di rak peraturan. ${tutup}`;
      break;
    case "pasal-dibuang":
      t = `Pada pertimbangan perkara cerai, ${siapa} cenderung membuang dasar hukum ${p.ringkas} yang disarankan draf ${seberapa}. Jangan menyarankannya kecuali jelas diperlukan. ${tutup}`;
      break;
    case "bagian-ditambah":
      t = `Pada pertimbangan perkara cerai, ${siapa} cenderung menambahkan bagian ${p.ringkas} yang belum ada di draf ${seberapa}. Siapkan bagian ini bila bahannya ada. ${tutup}`;
      break;
    case "amar-ditambah":
      t = `Pada amar perkara cerai, ${siapa} cenderung menambahkan butir dengan pola: "${p.ringkas}" ${seberapa}. Pertimbangkan butir serupa bila sesuai petitum. ${tutup}`;
      break;
    case "amar-dibuang":
      t = `Pada amar perkara cerai, ${siapa} cenderung membuang butir dengan pola: "${p.ringkas}" ${seberapa}. Jangan menyusun butir serupa kecuali dituntut petitum. ${tutup}`;
      break;
    case "kalimat-diganti":
      t = `Pada amar perkara cerai, ${siapa} cenderung mengganti rumusan kalimat (dari  =>  menjadi): ${p.ringkas} ${seberapa}. Pakai rumusan hasil penggantian. ${tutup}`;
      break;
    case "huruf-ditambah":
      t = `Pada pertimbangan alasan perceraian, ${siapa} cenderung menambahkan alasan ${p.ringkas} selain yang disarankan draf ${seberapa}. Pertimbangkan alasan ini bila fakta mendukung. ${tutup}`;
      break;
    case "huruf-dibuang":
      t = `Pada pertimbangan alasan perceraian, ${siapa} cenderung tidak memakai alasan ${p.ringkas} yang disarankan draf ${seberapa}. Sarankan alasan ini hanya bila fakta jelas mendukung. ${tutup}`;
      break;
  }
  return t.replace(/\s+/g, " ").trim().slice(0, BATAS_TEKS_MEMORI);
}

export function usulanMemori(pola: readonly PolaKoreksi[]): UsulanMemori[] {
  return pola.map((p) => ({
    id: `pm-${sidikPendek(`${p.lingkup}|${p.hakim}|${p.jenis}|${p.kunci}`)}`,
    lingkup: p.lingkup,
    hakim: p.hakim,
    jenis: p.jenis,
    kunci: p.kunci,
    teks: teksMemori(p),
    perkara: p.perkara,
    dari: p.dari,
  }));
}

// ============================================================================
// DOKUMEN PUTUSAN -> PERTIMBANGAN + AMAR (cadangan bila SIPP belum memuat pertimbangan)
// ============================================================================

/**
 * Teks dokumen putusan: pertimbangan = sesudah "Menimbang" pertama, sebelum "MENGADILI"; amar = sesudah "MENGADILI"
 * sampai "Demikian diputuskan". Dua keluaran dalam bentuk HTML sederhana (satu <p> per baris) agar dibaca pembanding yang sama.
 */
export function pisahNaskahPutusan(teksDokumen: string): { pertimbanganHtml: string; amarHtml: string } | null {
  const baris = String(teksDokumen ?? "")
    .replace(/\r/g, "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  const iMengadili = baris.findIndex((b) => /^m\s*e\s*n\s*g\s*a\s*d\s*i\s*l\s*i\s*:?$/i.test(b));
  if (iMengadili < 0) return null;
  const iMenimbang = baris.findIndex((b) => /^menimbang\b/i.test(b));
  if (iMenimbang < 0 || iMenimbang >= iMengadili) return null;
  let iAkhir = baris.findIndex((b, i) => i > iMengadili && /^demikian\s+(?:diputuskan|putusan)/i.test(b));
  if (iAkhir < 0) iAkhir = baris.length;
  const p = (x: string[]) => x.map((b) => `<p>${b.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`).join("\n");
  const amar = baris.slice(iMengadili + 1, iAkhir);
  if (!amar.length) return null;
  return { pertimbanganHtml: p(baris.slice(iMenimbang, iMengadili)), amarHtml: p(amar) };
}
