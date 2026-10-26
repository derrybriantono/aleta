/**
 * ============================================================================
 * JEJAK ISIAN DAN BUTIR SAKSI - ATURAN MURNI (25 Okt 2026, rantai C butir C1)
 * ============================================================================
 *
 * U1 + U2 + U6 di docs/rancangan/upgrade-otomatisasi-24okt/README.md. Berkas ini
 * hanya aturan tanpa basis data dan tanpa jaringan: pembersih masukan dari
 * ekstensi, penetapan HASIL (dihitung di sini, tidak dipercaya dari ekstensi),
 * kemiripan teks, dan penyusun angka lapangan. Penyimpanan ada di
 * src/server/modules/aleta-ecourt/jejak-isian.ts.
 *
 * ============================================================================
 * KEPUTUSAN YANG DIPEGANG
 * ============================================================================
 *
 *   - Bawaan MATI. Saklarnya butir katalog Fitur Satker "jejak-isian"; selama
 *     mati ekstensi tidak mengirim apa pun dan server menolak menulis.
 *   - Retensi 2 TAHUN (keputusan Derry 24 Okt) - RETENSI_HARI.
 *   - Teks keterangan saksi dan nama asli HANYA di Postgres kantor.
 *   - Tidak satu kata "Aleta" masuk ke nilai yang DITULIS ke SIPP/ABT - berkas
 *     ini tidak menulis ke sana; yang disimpan di sini adalah catatan ALETA
 *     sendiri tentang apa yang terjadi, sehingga kata itu boleh ada di label.
 *   - Kenaikan status isian TIDAK pernah otomatis (U3 mengusulkan, Super Admin
 *     menyetujui); berkas ini hanya menghitung angka lapangan.
 */

/** Kode butir katalog Fitur Satker (src/lib/fitur-satker.ts). */
export const KODE_FITUR_JEJAK_ISIAN = "jejak-isian";

/** Retensi jejak: 2 tahun. */
export const RETENSI_HARI = 730;

/** Batas panjang satu nilai yang disimpan utuh (nilai SEBELUM dipakai Urungkan, jadi lebih longgar dari jejak koreksi). */
export const BATAS_NILAI = 30000;
/** Batas teks pendek (pertanyaan, usulan butir saksi). */
export const BATAS_BUTIR_TEKS = 4000;
/** Banyak entri sekali kirim. */
export const BATAS_KIRIM = 60;

/**
 * Cara satu penyimpanan isian:
 *   otomatis         ALETA menulis sendiri ke ABT (belum dinilai manusia)
 *   saran-diterima   petugas menyimpan persis saran/usulan
 *   diubah           petugas menyimpan nilai lain daripada SARAN yang tampil
 *   diubah-otomatis  petugas mengubah nilai yang SEBELUMNYA ditulis ALETA sendiri
 *   diketik          tidak ada usulan, petugas mengetik
 *   diurungkan       nilai dikembalikan ke yang lama lewat Urungkan
 *   sunting-panel    suntingan di panel ABT tanpa usulan (jalur lama)
 */
export type CaraIsian = "otomatis" | "saran-diterima" | "diubah" | "diubah-otomatis" | "diketik" | "diurungkan" | "sunting-panel";
export const DAFTAR_CARA_ISIAN: readonly CaraIsian[] = ["otomatis", "saran-diterima", "diubah", "diubah-otomatis", "diketik", "diurungkan", "sunting-panel"];

/**
 * Hasil satu penyimpanan isian:
 *   otomatis    ALETA menulis sendiri (belum dinilai manusia)
 *   diterima    petugas menyimpan persis usulan (saran diterima)
 *   disunting   ada usulan, petugas menyimpan nilai lain (KOREKSI)
 *   diketik     tidak ada usulan, petugas mengetik
 *   diurungkan  nilai dikembalikan ke yang lama lewat Urungkan
 */
export type HasilIsian = "otomatis" | "diterima" | "disunting" | "diketik" | "diurungkan";

export type JalurIsian = "blangko-derry" | "panel-abt" | "urungkan";
export const DAFTAR_JALUR_ISIAN: readonly JalurIsian[] = ["blangko-derry", "panel-abt", "urungkan"];

/**
 * Asal usulan = PENGISI-nya, sebagai penanda pendek huruf kecil (mis. "isi-sipp", "draf-h7", "bawaan-abt", "bukti", "e-court",
 * "panel"). Bukan daftar tertutup: pengisi baru tidak perlu mengubah migrasi atau berkas ini.
 */
export type AsalUsulan = string;
export function penandaAsal(x: unknown): string {
  return String(x ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export type Terverifikasi = "ya" | "beda" | "tidak-dicek" | "";
export const DAFTAR_TERVERIFIKASI: readonly Terverifikasi[] = ["ya", "beda", "tidak-dicek", ""];

export type JalurSaksi = "katalog" | "cerai-lama" | "blangko-derry";
export const DAFTAR_JALUR_SAKSI: readonly JalurSaksi[] = ["katalog", "cerai-lama", "blangko-derry"];

/**
 * Hasil satu butir saksi:
 *   diterima    teks final = usulan mesin
 *   disunting   teks final berbeda dari usulan
 *   diketik     tanpa usulan mesin (butir tambahan / diketik petugas)
 *   dibuang     ada usulan, tetapi butir tidak disimpan (jawaban dikosongkan)
 */
export type HasilButir = "diterima" | "disunting" | "diketik" | "dibuang";

const teks = (x: unknown): string => String(x ?? "").trim();

/** Memotong tanpa diam: pemanggil mendapat penanda `dipotong`. */
export function potongNilai(x: unknown, batas = BATAS_NILAI): { isi: string; dipotong: boolean } {
  const penuh = String(x ?? "");
  return penuh.length <= batas ? { isi: penuh, dipotong: false } : { isi: penuh.slice(0, batas), dipotong: true };
}

/** Bentuk baku untuk membandingkan dua nilai: spasi dilebur, kutip disamakan, huruf kecil. */
export function bakuBanding(x: unknown): string {
  return String(x ?? "")
    .replace(/[’‘`"“”]/g, "'")
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function samaLonggar(a: unknown, b: unknown): boolean {
  return bakuBanding(a) === bakuBanding(b);
}

/** Kemiripan 0..1 (koefisien Dice atas kata); dua teks kosong = 1, satu kosong = 0. */
export function kemiripan(a: unknown, b: unknown): number {
  const ta = bakuBanding(a);
  const tb = bakuBanding(b);
  if (!ta && !tb) return 1;
  if (!ta || !tb) return 0;
  if (ta === tb) return 1;
  const kata = (t: string) => t.split(/[^a-z0-9À-ɏ]+/i).filter(Boolean);
  const A = new Map<string, number>();
  for (const k of kata(ta)) A.set(k, (A.get(k) ?? 0) + 1);
  let cocok = 0;
  let jumlahB = 0;
  for (const k of kata(tb)) {
    jumlahB += 1;
    const n = A.get(k) ?? 0;
    if (n > 0) {
      cocok += 1;
      A.set(k, n - 1);
    }
  }
  const jumlahA = kata(ta).length;
  if (!jumlahA || !jumlahB) return 0;
  return Math.round(((2 * cocok) / (jumlahA + jumlahB)) * 1000) / 1000;
}

/** Hasil isian ditetapkan DI SINI dari cara, usulan, dan nilai akhir. */
export function tetapkanHasilIsian(cara: CaraIsian, nilaiUsulan: string, nilaiFinal: string): HasilIsian {
  if (cara === "diurungkan") return "diurungkan";
  if (cara === "otomatis") return "otomatis";
  if (!teks(nilaiUsulan)) return "diketik";
  return samaLonggar(nilaiUsulan, nilaiFinal) ? "diterima" : "disunting";
}

/** Hasil butir saksi dari usulan dan teks final. */
export function tetapkanHasilButir(usulan: string, final: string): HasilButir {
  const u = teks(usulan);
  const f = teks(final);
  if (!u) return f ? "diketik" : "dibuang";
  if (!f) return "dibuang";
  return samaLonggar(u, f) ? "diterima" : "disunting";
}

function dalam<T extends string>(x: unknown, daftar: readonly T[], bawaan: T): T {
  const v = teks(x) as T;
  return daftar.includes(v) ? v : bawaan;
}

export type MasukanIsian = {
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  blangko: string;
  jenisBlangko: string;
  kode: string;
  namaVariabel: string;
  nilaiUsulan: string;
  asalUsulan: AsalUsulan;
  keyakinan: string;
  kodePola: string;
  nilaiSebelum: string;
  sebelumDipotong: boolean;
  nilaiFinal: string;
  finalDipotong: boolean;
  cara: CaraIsian;
  terverifikasi: Terverifikasi;
  nilaiTerbaca: string;
  jalur: JalurIsian;
  urungkanDari: string;
  pada: string;
};

/** Kode variabel ABT: 3-5 angka (juga 20 huruf/angka untuk kode panel yang ada); selainnya ditolak. */
export function kodeVariabelSah(x: unknown): string {
  return teks(x).replace(/[^0-9A-Za-z_-]/g, "").slice(0, 20);
}

function waktuSah(x: unknown, cadangan: string): string {
  const t = teks(x);
  if (!t) return cadangan;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? cadangan : d.toISOString();
}

/** Alur dari nomor perkara ("581/Pdt.G/2026/PA.Dgl" -> "Pdt.G"); "" bila tak terbaca. */
export function alurDariNomor(nomor: string): string {
  const m = /\/(Pdt\.[A-Za-z]+|Pdt\.[A-Za-z]\.[A-Za-z]+)\//.exec(teks(nomor));
  return m ? m[1] : "";
}

/** Membersihkan satu entri isian dari ekstensi; null bila tak lengkap. */
export function bersihkanMasukanIsian(mentah: unknown, kini = new Date().toISOString()): MasukanIsian | null {
  if (!mentah || typeof mentah !== "object" || Array.isArray(mentah)) return null;
  const o = mentah as Record<string, unknown>;
  const kode = kodeVariabelSah(o.kode);
  const perkaraId = teks(o.perkaraId).slice(0, 60);
  if (!kode || !perkaraId) return null;
  const cara = dalam<CaraIsian>(o.cara, DAFTAR_CARA_ISIAN, "diketik");
  const sebelum = potongNilai(o.nilaiSebelum ?? o.sebelum);
  const final = potongNilai(o.nilaiFinal ?? o.sesudah);
  const usulan = potongNilai(o.nilaiUsulan, BATAS_NILAI).isi;
  const nomor = teks(o.nomorPerkara).slice(0, 100);
  return {
    perkaraId,
    nomorPerkara: nomor,
    jenisPerkara: teks(o.jenisPerkara).slice(0, 120) || (alurDariNomor(nomor) ? `alur:${alurDariNomor(nomor)}` : ""),
    blangko: teks(o.blangko).slice(0, 300),
    jenisBlangko: teks(o.jenisBlangko).slice(0, 20),
    kode,
    namaVariabel: teks(o.namaVariabel ?? o.nama).slice(0, 300),
    nilaiUsulan: usulan,
    asalUsulan: penandaAsal(o.asalUsulan),
    keyakinan: teks(o.keyakinan).slice(0, 40),
    kodePola: teks(o.kodePola).slice(0, 100),
    nilaiSebelum: sebelum.isi,
    sebelumDipotong: sebelum.dipotong || o.sebelumDipotong === true,
    nilaiFinal: final.isi,
    finalDipotong: final.dipotong,
    cara,
    terverifikasi: dalam<Terverifikasi>(o.terverifikasi, DAFTAR_TERVERIFIKASI, ""),
    nilaiTerbaca: potongNilai(o.nilaiTerbaca, 2000).isi,
    jalur: dalam<JalurIsian>(o.jalur, DAFTAR_JALUR_ISIAN, cara === "diurungkan" ? "urungkan" : "blangko-derry"),
    urungkanDari: teks(o.urungkanDari).slice(0, 80),
    pada: waktuSah(o.pada, kini),
  };
}

export type MasukanButir = {
  perkaraId: string;
  nomorPerkara: string;
  sidang: string;
  saksiKe: number;
  pihak: string;
  jalur: JalurSaksi;
  variabel: string;
  katalog: string;
  versiKatalog: string;
  jenisPerkara: string;
  butir: string;
  varian: string;
  jenisKeterangan: string;
  nomorButir: number;
  pertanyaan: string;
  usulan: string;
  teksFinal: string;
  sumberFakta: string;
  keyakinan: string;
  kodePola: string;
  pada: string;
};

/** Membersihkan satu butir saksi dari ekstensi; null bila tak lengkap. */
export function bersihkanMasukanButir(mentah: unknown, kini = new Date().toISOString()): MasukanButir | null {
  if (!mentah || typeof mentah !== "object" || Array.isArray(mentah)) return null;
  const o = mentah as Record<string, unknown>;
  const perkaraId = teks(o.perkaraId).slice(0, 60);
  if (!perkaraId) return null;
  const pihak = teks(o.pihak).toUpperCase();
  const nomor = teks(o.nomorPerkara).slice(0, 100);
  const potong = (x: unknown) => potongNilai(x, BATAS_BUTIR_TEKS).isi;
  return {
    perkaraId,
    nomorPerkara: nomor,
    sidang: teks(o.sidang).slice(0, 10),
    saksiKe: Math.max(0, Math.min(20, Math.round(Number(o.saksiKe) || 0))),
    pihak: pihak === "P" || pihak === "T" ? pihak : "",
    jalur: dalam<JalurSaksi>(o.jalur, DAFTAR_JALUR_SAKSI, "katalog"),
    variabel: kodeVariabelSah(o.variabel),
    katalog: teks(o.katalog).slice(0, 120),
    versiKatalog: teks(o.versiKatalog).slice(0, 60),
    jenisPerkara: teks(o.jenisPerkara).slice(0, 120) || (alurDariNomor(nomor) ? `alur:${alurDariNomor(nomor)}` : ""),
    butir: teks(o.butir).slice(0, 120),
    varian: teks(o.varian).slice(0, 120),
    jenisKeterangan: teks(o.jenisKeterangan).slice(0, 40),
    nomorButir: Math.max(0, Math.min(500, Math.round(Number(o.nomorButir) || 0))),
    pertanyaan: potong(o.pertanyaan),
    usulan: potong(o.usulan),
    teksFinal: potong(o.teksFinal ?? o.final),
    sumberFakta: teks(o.sumberFakta).slice(0, 300),
    keyakinan: teks(o.keyakinan).slice(0, 40),
    kodePola: teks(o.kodePola).slice(0, 100),
    pada: waktuSah(o.pada, kini),
  };
}

// ─── Angka lapangan ─────────────────────────────────────────────────────────

export type HitungHasil = Record<HasilButir, number> & { jumlah: number };

export type KelompokButir = HitungHasil & {
  kunci: string;
  /** Bagian butir BERUSULAN yang disimpan tanpa diubah, 0..100 (1 desimal). null bila belum ada butir berusulan. */
  persenDiterima: number | null;
  /** Rata-rata kemiripan usulan-final pada butir yang disunting, 0..1. */
  kemiripanSunting: number | null;
};

const kosongButir = (): HitungHasil => ({ diterima: 0, disunting: 0, diketik: 0, dibuang: 0, jumlah: 0 });

/** Persen diterima = diterima / (diterima + disunting + dibuang): butir yang ADA usulannya; yang diketik tanpa usulan tak ikut. */
export function persenDiterimaButir(h: Pick<HitungHasil, "diterima" | "disunting" | "dibuang">): number | null {
  const dasar = h.diterima + h.disunting + h.dibuang;
  return dasar ? Math.round((h.diterima / dasar) * 1000) / 10 : null;
}

export type BarisButirRingkas = { kunci: string; hasil: string; kemiripan: number };

/** Mengelompokkan baris menurut `kunci` (katalog, varian, jenis perkara, ...). */
export function kelompokkanButir(baris: BarisButirRingkas[]): KelompokButir[] {
  const peta = new Map<string, HitungHasil & { sumKem: number; nKem: number }>();
  for (const b of baris) {
    const w = peta.get(b.kunci) ?? { ...kosongButir(), sumKem: 0, nKem: 0 };
    w.jumlah += 1;
    if (b.hasil === "diterima" || b.hasil === "disunting" || b.hasil === "diketik" || b.hasil === "dibuang") w[b.hasil] += 1;
    if (b.hasil === "disunting") {
      w.sumKem += Number(b.kemiripan) || 0;
      w.nKem += 1;
    }
    peta.set(b.kunci, w);
  }
  return Array.from(peta.entries())
    .map(([kunci, w]) => ({
      kunci,
      diterima: w.diterima,
      disunting: w.disunting,
      diketik: w.diketik,
      dibuang: w.dibuang,
      jumlah: w.jumlah,
      persenDiterima: persenDiterimaButir(w),
      kemiripanSunting: w.nKem ? Math.round((w.sumKem / w.nKem) * 1000) / 1000 : null,
    }))
    .sort((a, b) => b.jumlah - a.jumlah || a.kunci.localeCompare(b.kunci));
}

export type KelompokIsian = {
  kunci: string;
  kode: string;
  asalUsulan: string;
  otomatis: number;
  diterima: number;
  disunting: number;
  disuntingDariOtomatis: number;
  diketik: number;
  diurungkan: number;
  /** Banyak usulan yang dinilai: otomatis + saran diterima + saran disunting. */
  usulan: number;
  /** Usulan yang bertahan sampai akhir (otomatis yang kemudian disunting tidak dihitung). */
  bertahan: number;
  /** bertahan / usulan, 0..1 (3 desimal); null bila tak ada usulan. */
  presisi: number | null;
};

export type BarisIsianRingkas = { kode: string; asalUsulan: string; hasil: string; cara?: string };

/**
 * Angka lapangan per kode (dan asal usulan = pengisi). Dasar U3 (Ketepatan isian): usulan
 * ALETA yang menulis sendiri dihitung SEKALI saat ditulis; bila petugas kemudian
 * menyuntingnya, baris suntingan (cara "diubah-otomatis") MENGURANGI yang bertahan.
 */
export function kelompokkanIsian(baris: BarisIsianRingkas[]): KelompokIsian[] {
  const peta = new Map<string, KelompokIsian>();
  for (const b of baris) {
    const kunci = `${b.kode}|${b.asalUsulan}`;
    const w =
      peta.get(kunci) ??
      ({ kunci, kode: b.kode, asalUsulan: b.asalUsulan, otomatis: 0, diterima: 0, disunting: 0, disuntingDariOtomatis: 0, diketik: 0, diurungkan: 0, usulan: 0, bertahan: 0, presisi: null } as KelompokIsian);
    if (b.hasil === "otomatis") w.otomatis += 1;
    else if (b.hasil === "diterima") w.diterima += 1;
    else if (b.hasil === "disunting") {
      w.disunting += 1;
      if (b.cara === "diubah-otomatis") w.disuntingDariOtomatis += 1;
    } else if (b.hasil === "diketik") w.diketik += 1;
    else if (b.hasil === "diurungkan") w.diurungkan += 1;
    peta.set(kunci, w);
  }
  for (const w of peta.values()) {
    const suntingSaran = w.disunting - w.disuntingDariOtomatis;
    w.usulan = w.otomatis + w.diterima + suntingSaran;
    w.bertahan = Math.max(0, w.otomatis + w.diterima - w.disuntingDariOtomatis);
    w.presisi = w.usulan ? Math.round((w.bertahan / w.usulan) * 1000) / 1000 : null;
  }
  return Array.from(peta.values()).sort((a, b) => b.usulan + b.diketik - (a.usulan + a.diketik) || a.kode.localeCompare(b.kode));
}

/** Batas pembersihan: baris lebih tua dari ini dihapus. */
export function batasRetensi(sekarang: Date = new Date(), hari = RETENSI_HARI): string {
  return new Date(sekarang.getTime() - hari * 86_400_000).toISOString();
}
