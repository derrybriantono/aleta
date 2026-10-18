/**
 * ============================================================================
 * HARI LIBUR - SATU SUMBER UNTUK PORTAL, BOT, DAN EKSTENSI (18 Okt 2026)
 * ============================================================================
 *
 * Tanggal sidang yang jatuh pada hari libur tidak boleh dipilih di mana pun:
 * Jadwal Sidang (tunda, sidang lanjutan, putusan), Jadwal Mediasi, rencana
 * Court Calendar, penetapan kembali, dan penetapan hari sidang di ekstensi.
 *
 * Hari libur = Sabtu, Minggu, libur nasional, cuti bersama, dan libur yang
 * ditambahkan Super Admin/Admin di Pengaturan (libur daerah, cuti bersama
 * tambahan dari SKB perubahan).
 *
 * DAFTAR SKB DI BAWAH INI ADALAH DASARNYA. Salinannya ada di dua tempat yang
 * tidak dapat mengimpor berkas ini, dan uji hari-libur-satu-sumber menuntut
 * isinya SAMA PERSIS:
 *
 *   aleta_bot/services/hariLiburService.js   TAHUN (bot: konteks build lain)
 *   ekstensi-sipp/konten.js                  CC_LIBUR (ekstensi: tanpa impor)
 *   court-calendar-susun.ts                  CC_LIBUR diturunkan dari sini
 *
 * Tambahan dari Pengaturan disimpan portal (aleta_ekstensi_setelan, kunci
 * sistem:hari-libur), dibaca ekstensi lewat /api/hari-libur, dan dikirim ke bot
 * setiap kali disimpan.
 *
 * Tanggal TIDAK pernah ditebak: tahun tanpa SKB hanya mengecualikan Sabtu,
 * Minggu, dan tambahan dari Pengaturan, dan layar menyebutnya.
 */

export type JenisLibur = "nasional" | "cuti-bersama" | "daerah" | "lain";

export type ButirLibur = {
  tanggal: string;
  /** Nama menurut SKB (atau isian Pengaturan). */
  nama: string;
  /** Sebutan pendek untuk layar sempit ("Idul Fitri"). */
  singkat: string;
  jenis: JenisLibur;
  asal: "skb" | "pengaturan";
};

export type TahunSkb = {
  skb: string;
  ditetapkan?: string;
  sumber: string;
  /** [tanggal, nama SKB, sebutan pendek, jenis] */
  libur: ReadonlyArray<readonly [string, string, string, "nasional" | "cuti-bersama"]>;
};

const N = "nasional" as const;
const C = "cuti-bersama" as const;

export const SKB_LIBUR: Readonly<Record<string, TahunSkb>> = {
  "2024": {
    skb: "Nomor 855 Tahun 2023, Nomor 3 Tahun 2023, dan Nomor 4 Tahun 2023",
    sumber: "Daftar resmi Kemenko PMK dan Indonesia Baik (dicocokkan 7 Sep 2026).",
    libur: [
      ["2024-01-01", "Tahun Baru 2024 Masehi", "Tahun Baru Masehi", N],
      ["2024-02-08", "Isra Mikraj Nabi Muhammad SAW", "Isra Mikraj", N],
      ["2024-02-09", "Cuti Bersama Tahun Baru Imlek", "cuti bersama Tahun Baru Imlek", C],
      ["2024-02-10", "Tahun Baru Imlek 2575 Kongzili", "Tahun Baru Imlek", N],
      ["2024-03-11", "Hari Suci Nyepi Tahun Baru Saka 1946", "Hari Suci Nyepi", N],
      ["2024-03-12", "Cuti Bersama Hari Suci Nyepi", "cuti bersama Nyepi", C],
      ["2024-03-29", "Wafat Isa Almasih", "Wafat Isa Almasih", N],
      ["2024-03-31", "Hari Paskah", "Paskah", N],
      ["2024-04-08", "Cuti Bersama Idulfitri 1445 H", "cuti bersama Idul Fitri", C],
      ["2024-04-09", "Cuti Bersama Idulfitri 1445 H", "cuti bersama Idul Fitri", C],
      ["2024-04-10", "Idulfitri 1445 H", "Idul Fitri", N],
      ["2024-04-11", "Idulfitri 1445 H", "Idul Fitri", N],
      ["2024-04-12", "Cuti Bersama Idulfitri 1445 H", "cuti bersama Idul Fitri", C],
      ["2024-04-15", "Cuti Bersama Idulfitri 1445 H", "cuti bersama Idul Fitri", C],
      ["2024-05-01", "Hari Buruh Internasional", "Hari Buruh", N],
      ["2024-05-09", "Kenaikan Isa Almasih", "Kenaikan Isa Almasih", N],
      ["2024-05-10", "Cuti Bersama Kenaikan Isa Almasih", "cuti bersama Kenaikan Isa Almasih", C],
      ["2024-05-23", "Hari Raya Waisak 2568 BE", "Waisak", N],
      ["2024-05-24", "Cuti Bersama Hari Raya Waisak", "cuti bersama Waisak", C],
      ["2024-06-01", "Hari Lahir Pancasila", "Hari Lahir Pancasila", N],
      ["2024-06-17", "Iduladha 1445 H", "Idul Adha", N],
      ["2024-06-18", "Cuti Bersama Iduladha 1445 H", "cuti bersama Idul Adha", C],
      ["2024-07-07", "Tahun Baru Islam 1446 H", "Tahun Baru Islam", N],
      ["2024-08-17", "Proklamasi Kemerdekaan", "Hari Kemerdekaan", N],
      ["2024-09-16", "Maulid Nabi Muhammad SAW", "Maulid Nabi", N],
      ["2024-12-25", "Kelahiran Yesus Kristus", "Natal", N],
      ["2024-12-26", "Cuti Bersama Kelahiran Yesus Kristus", "cuti bersama Natal", C],
    ],
  },
  "2025": {
    skb: "Nomor 1017 Tahun 2024, Nomor 2 Tahun 2024, dan Nomor 2 Tahun 2024 (beserta SKB perubahan 7 Agustus 2025)",
    sumber: "Daftar resmi SKB 3 Menteri sebagaimana dimuat sumber publik, beserta SKB perubahannya.",
    libur: [
      ["2025-01-01", "Tahun Baru 2025 Masehi", "Tahun Baru Masehi", N],
      ["2025-01-27", "Isra Mikraj Nabi Muhammad SAW", "Isra Mikraj", N],
      ["2025-01-28", "Cuti Bersama Tahun Baru Imlek", "cuti bersama Tahun Baru Imlek", C],
      ["2025-01-29", "Tahun Baru Imlek 2576 Kongzili", "Tahun Baru Imlek", N],
      ["2025-03-28", "Cuti Bersama Hari Suci Nyepi", "cuti bersama Nyepi", C],
      ["2025-03-29", "Hari Suci Nyepi Tahun Baru Saka 1947", "Hari Suci Nyepi", N],
      ["2025-03-31", "Idulfitri 1446 H", "Idul Fitri", N],
      ["2025-04-01", "Idulfitri 1446 H", "Idul Fitri", N],
      ["2025-04-02", "Cuti Bersama Idulfitri 1446 H", "cuti bersama Idul Fitri", C],
      ["2025-04-03", "Cuti Bersama Idulfitri 1446 H", "cuti bersama Idul Fitri", C],
      ["2025-04-04", "Cuti Bersama Idulfitri 1446 H", "cuti bersama Idul Fitri", C],
      ["2025-04-07", "Cuti Bersama Idulfitri 1446 H", "cuti bersama Idul Fitri", C],
      ["2025-04-18", "Wafat Yesus Kristus", "Wafat Isa Almasih", N],
      ["2025-04-20", "Kebangkitan Yesus Kristus (Paskah)", "Paskah", N],
      ["2025-05-01", "Hari Buruh Internasional", "Hari Buruh", N],
      ["2025-05-12", "Hari Raya Waisak 2569 BE", "Waisak", N],
      ["2025-05-13", "Cuti Bersama Hari Raya Waisak", "cuti bersama Waisak", C],
      ["2025-05-29", "Kenaikan Yesus Kristus", "Kenaikan Isa Almasih", N],
      ["2025-05-30", "Cuti Bersama Kenaikan Yesus Kristus", "cuti bersama Kenaikan Isa Almasih", C],
      ["2025-06-01", "Hari Lahir Pancasila", "Hari Lahir Pancasila", N],
      ["2025-06-06", "Iduladha 1446 H", "Idul Adha", N],
      ["2025-06-09", "Cuti Bersama Iduladha 1446 H", "cuti bersama Idul Adha", C],
      ["2025-06-27", "1 Muharam Tahun Baru Islam 1447 H", "Tahun Baru Islam", N],
      ["2025-08-17", "Proklamasi Kemerdekaan", "Hari Kemerdekaan", N],
      ["2025-08-18", "Cuti Bersama HUT ke-80 Kemerdekaan RI", "cuti bersama HUT Kemerdekaan", C],
      ["2025-09-05", "Maulid Nabi Muhammad SAW", "Maulid Nabi", N],
      ["2025-12-25", "Kelahiran Yesus Kristus", "Natal", N],
      ["2025-12-26", "Cuti Bersama Kelahiran Yesus Kristus", "cuti bersama Natal", C],
    ],
  },
  "2026": {
    skb: "Nomor 1497 Tahun 2025, Nomor 2 Tahun 2025, dan Nomor 5 Tahun 2025",
    ditetapkan: "2025-09-19",
    sumber:
      "SKB Menteri Agama, Menteri Ketenagakerjaan, dan Menteri PANRB (pindaian asli, dicocokkan 7 Sep 2026); setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2026.",
    libur: [
      ["2026-01-01", "Tahun Baru 2026 Masehi", "Tahun Baru Masehi", N],
      ["2026-01-16", "Isra Mikraj Nabi Muhammad SAW", "Isra Mikraj", N],
      ["2026-02-16", "Cuti Bersama Tahun Baru Imlek 2577 Kongzili", "cuti bersama Tahun Baru Imlek", C],
      ["2026-02-17", "Tahun Baru Imlek 2577 Kongzili", "Tahun Baru Imlek", N],
      ["2026-03-18", "Cuti Bersama Hari Suci Nyepi", "cuti bersama Nyepi", C],
      ["2026-03-19", "Hari Suci Nyepi (Tahun Baru Saka 1948)", "Hari Suci Nyepi", N],
      ["2026-03-20", "Cuti Bersama Idul Fitri 1447 Hijriah", "cuti bersama Idul Fitri", C],
      ["2026-03-21", "Idul Fitri 1447 Hijriah", "Idul Fitri", N],
      ["2026-03-22", "Idul Fitri 1447 Hijriah", "Idul Fitri", N],
      ["2026-03-23", "Cuti Bersama Idul Fitri 1447 Hijriah", "cuti bersama Idul Fitri", C],
      ["2026-03-24", "Cuti Bersama Idul Fitri 1447 Hijriah", "cuti bersama Idul Fitri", C],
      ["2026-04-03", "Wafat Yesus Kristus", "Wafat Isa Almasih", N],
      ["2026-04-05", "Kebangkitan Yesus Kristus (Paskah)", "Paskah", N],
      ["2026-05-01", "Hari Buruh Internasional", "Hari Buruh", N],
      ["2026-05-14", "Kenaikan Yesus Kristus", "Kenaikan Isa Almasih", N],
      ["2026-05-15", "Cuti Bersama Kenaikan Yesus Kristus", "cuti bersama Kenaikan Isa Almasih", C],
      ["2026-05-27", "Idul Adha 1447 Hijriah", "Idul Adha", N],
      ["2026-05-28", "Cuti Bersama Idul Adha 1447 Hijriah", "cuti bersama Idul Adha", C],
      ["2026-05-31", "Hari Raya Waisak 2570 BE", "Waisak", N],
      ["2026-06-01", "Hari Lahir Pancasila", "Hari Lahir Pancasila", N],
      ["2026-06-16", "1 Muharam Tahun Baru Islam 1448 Hijriah", "Tahun Baru Islam", N],
      ["2026-08-17", "Proklamasi Kemerdekaan", "Hari Kemerdekaan", N],
      ["2026-08-25", "Maulid Nabi Muhammad SAW", "Maulid Nabi", N],
      ["2026-12-24", "Cuti Bersama Kelahiran Yesus Kristus", "cuti bersama Natal", C],
      ["2026-12-25", "Kelahiran Yesus Kristus", "Natal", N],
    ],
  },
  "2027": {
    // Ditetapkan 15 Sep 2026. Dicocokkan 18 Okt 2026 terhadap tiga salinan
    // resmi yang isinya sama: setneg.go.id, kemenkopmk.go.id/node/6444, dan
    // hukumonline. Tiap tanggal diperiksa harinya terhadap kalender. Berkas
    // SKB yang ditandatangani belum dibaca langsung; Hukumonline sekali
    // menulis nomor Menteri Agama "1025" - Setneg dan Kemenko PMK "1205".
    skb: "Nomor 1205 Tahun 2026, Nomor 3 Tahun 2026, dan Nomor 2 Tahun 2026",
    ditetapkan: "2026-09-15",
    sumber:
      "setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2027 dan kemenkopmk.go.id/node/6444 (18 libur nasional, 8 cuti bersama).",
    libur: [
      ["2027-01-01", "Tahun Baru 2027 Masehi", "Tahun Baru Masehi", N],
      ["2027-01-05", "Isra Mikraj Nabi Muhammad SAW 1448 Hijriah", "Isra Mikraj", N],
      ["2027-02-05", "Cuti Bersama Tahun Baru Imlek 2578 Kongzili", "cuti bersama Tahun Baru Imlek", C],
      ["2027-02-06", "Tahun Baru Imlek 2578 Kongzili", "Tahun Baru Imlek", N],
      ["2027-03-08", "Hari Suci Nyepi (Tahun Baru Saka 1949)", "Hari Suci Nyepi", N],
      ["2027-03-09", "Cuti Bersama Idulfitri 1448 Hijriah", "cuti bersama Idul Fitri", C],
      ["2027-03-10", "Idulfitri 1448 Hijriah", "Idul Fitri", N],
      ["2027-03-11", "Idulfitri 1448 Hijriah", "Idul Fitri", N],
      ["2027-03-12", "Cuti Bersama Idulfitri 1448 Hijriah", "cuti bersama Idul Fitri", C],
      ["2027-03-15", "Cuti Bersama Idulfitri 1448 Hijriah", "cuti bersama Idul Fitri", C],
      ["2027-03-25", "Cuti Bersama Wafat Yesus Kristus", "cuti bersama Wafat Isa Almasih", C],
      ["2027-03-26", "Wafat Yesus Kristus", "Wafat Isa Almasih", N],
      ["2027-03-28", "Kebangkitan Yesus Kristus (Paskah)", "Paskah", N],
      ["2027-05-01", "Hari Buruh Internasional", "Hari Buruh", N],
      ["2027-05-06", "Kenaikan Yesus Kristus", "Kenaikan Isa Almasih", N],
      ["2027-05-17", "Iduladha 1448 Hijriah", "Idul Adha", N],
      ["2027-05-18", "Cuti Bersama Iduladha 1448 Hijriah", "cuti bersama Idul Adha", C],
      ["2027-05-19", "Cuti Bersama Hari Raya Waisak 2571 BE", "cuti bersama Waisak", C],
      ["2027-05-20", "Hari Raya Waisak 2571 BE", "Waisak", N],
      ["2027-06-01", "Hari Lahir Pancasila", "Hari Lahir Pancasila", N],
      ["2027-06-06", "1 Muharam Tahun Baru Islam 1449 Hijriah", "Tahun Baru Islam", N],
      ["2027-08-15", "Maulid Nabi Muhammad SAW", "Maulid Nabi", N],
      ["2027-08-17", "Proklamasi Kemerdekaan", "Hari Kemerdekaan", N],
      ["2027-12-24", "Cuti Bersama Kelahiran Yesus Kristus", "cuti bersama Natal", C],
      ["2027-12-25", "Kelahiran Yesus Kristus", "Natal", N],
      ["2027-12-26", "Isra Mikraj Nabi Muhammad SAW 1449 Hijriah", "Isra Mikraj", N],
    ],
  },
};

/** Tahun yang daftar SKB-nya lengkap. */
export const TAHUN_SKB_LENGKAP: readonly string[] = Object.keys(SKB_LIBUR).sort();

// ─── Tambahan dari Pengaturan ────────────────────────────────────────────────

export type TambahanLibur = {
  tanggal: string;
  nama: string;
  jenis: JenisLibur;
  /** "tambah" = hari libur baru; "hapus" = tanggal SKB yang dibatalkan (SKB perubahan). */
  aksi: "tambah" | "hapus";
};

export const BATAS_TAMBAHAN = 200;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function tanggalSah(iso: unknown): iso is string {
  if (typeof iso !== "string" || !ISO.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export class GalatHariLibur extends Error {}

/** Membersihkan isian Pengaturan. Melempar GalatHariLibur dengan kalimat awam. */
export function bersihkanTambahan(mentah: unknown): TambahanLibur[] {
  if (!Array.isArray(mentah)) throw new GalatHariLibur("Daftar hari libur tidak terbaca.");
  if (mentah.length > BATAS_TAMBAHAN) throw new GalatHariLibur(`Paling banyak ${BATAS_TAMBAHAN} baris.`);
  const hasil: TambahanLibur[] = [];
  const dipakai = new Set<string>();
  for (const x of mentah) {
    const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    const tanggal = String(o.tanggal ?? "").trim();
    if (!tanggalSah(tanggal)) throw new GalatHariLibur(`Tanggal "${tanggal || "kosong"}" tidak sah.`);
    if (dipakai.has(tanggal)) throw new GalatHariLibur(`Tanggal ${tanggal} tertulis dua kali.`);
    dipakai.add(tanggal);
    const aksi = o.aksi === "hapus" ? "hapus" : "tambah";
    const nama = String(o.nama ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
    if (aksi === "tambah" && !nama) throw new GalatHariLibur(`Nama hari libur ${tanggal} belum diisi.`);
    const jenis: JenisLibur =
      o.jenis === "nasional" || o.jenis === "cuti-bersama" || o.jenis === "daerah" ? o.jenis : "lain";
    hasil.push({ tanggal, nama, jenis, aksi });
  }
  return hasil.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
}

// ─── Peta gabungan ───────────────────────────────────────────────────────────

export type PetaLibur = ReadonlyMap<string, ButirLibur>;

/** Seluruh libur SKB (semua tahun) sebagai butir. */
export function daftarSkb(): ButirLibur[] {
  const hasil: ButirLibur[] = [];
  for (const th of TAHUN_SKB_LENGKAP) {
    for (const [tanggal, nama, singkat, jenis] of SKB_LIBUR[th].libur) {
      hasil.push({ tanggal, nama, singkat, jenis, asal: "skb" });
    }
  }
  return hasil;
}

/** SKB + tambahan Pengaturan. Tambahan "hapus" membatalkan tanggal SKB. */
export function gabungLibur(tambahan: readonly TambahanLibur[] = []): Map<string, ButirLibur> {
  const peta = new Map<string, ButirLibur>();
  for (const b of daftarSkb()) peta.set(b.tanggal, b);
  for (const t of tambahan) {
    if (!tanggalSah(t.tanggal)) continue;
    if (t.aksi === "hapus") {
      peta.delete(t.tanggal);
      continue;
    }
    peta.set(t.tanggal, { tanggal: t.tanggal, nama: t.nama, singkat: t.nama, jenis: t.jenis, asal: "pengaturan" });
  }
  return peta;
}

/** Peta tanggal -> sebutan pendek, bentuk CC_LIBUR (court-calendar-susun, konten.js) - 2026 ke atas. */
export function petaSingkat(dariTahun = 2026): Record<string, string> {
  const hasil: Record<string, string> = {};
  for (const b of daftarSkb()) if (Number(b.tanggal.slice(0, 4)) >= dariTahun) hasil[b.tanggal] = b.singkat;
  return hasil;
}

// Peta yang berlaku di proses ini. Di peramban diisi useHariLibur sesudah
// /api/hari-libur terbaca; di server diisi pembaca simpanan sebelum memeriksa.
let petaBerlaku: Map<string, ButirLibur> = gabungLibur();

export function pasangTambahanLibur(tambahan: readonly TambahanLibur[]) {
  petaBerlaku = gabungLibur(tambahan);
}

export function petaLiburBerlaku(): PetaLibur {
  return petaBerlaku;
}

// ─── Pemeriksaan ─────────────────────────────────────────────────────────────

const NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export function hariKe(iso: string): number {
  if (!tanggalSah(iso)) return -1;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function geserHari(iso: string, hari: number): string {
  if (!tanggalSah(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + hari)).toISOString().slice(0, 10);
}

/** "Senin, 23 Maret 2026". */
export function sebutTanggalPanjang(iso: string): string {
  if (!tanggalSah(iso)) return iso;
  const [y, m, d] = iso.split("-").map(Number);
  return `${NAMA_HARI[hariKe(iso)]}, ${d} ${NAMA_BULAN[m - 1]} ${y}`;
}

export type SebabLibur = { tanggal: string; jenis: "sabtu" | "minggu" | JenisLibur; nama: string; teks: string };

/** Sebab tanggal ini bukan hari sidang, atau null bila hari kerja. */
export function sebabLibur(iso: string, peta: PetaLibur = petaBerlaku): SebabLibur | null {
  if (!tanggalSah(iso)) return null;
  const libur = peta.get(iso);
  const h = hariKe(iso);
  if (libur) {
    const awal = h === 0 || h === 6 ? `${NAMA_HARI[h]}, ` : "";
    return { tanggal: iso, jenis: libur.jenis, nama: libur.nama, teks: `${awal}${libur.nama}` };
  }
  if (h === 6) return { tanggal: iso, jenis: "sabtu", nama: "Sabtu", teks: "hari Sabtu" };
  if (h === 0) return { tanggal: iso, jenis: "minggu", nama: "Minggu", teks: "hari Minggu" };
  return null;
}

export function hariLibur(iso: string, peta: PetaLibur = petaBerlaku): boolean {
  return sebabLibur(iso, peta) !== null;
}

/** Hari kerja pertama pada atau sesudah iso (maks. 60 hari). */
export function majuKeHariKerja(iso: string, peta: PetaLibur = petaBerlaku): string {
  let t = iso;
  for (let i = 0; i < 60 && tanggalSah(t) && hariLibur(t, peta); i += 1) t = geserHari(t, 1);
  return t;
}

export type GeserLibur = { tanggal: string; bergeser: boolean; dari: string; sebab: SebabLibur | null; pemberitahuan: string };

/**
 * Usulan otomatis yang jatuh di hari libur bergeser ke hari kerja berikutnya -
 * dan mengatakannya. Tanggal pilihan tangan TIDAK pernah digeser diam-diam:
 * pemanggilnya menolak, bukan menggeser.
 */
export function geserUsulanKeHariKerja(iso: string, peta: PetaLibur = petaBerlaku): GeserLibur {
  const sebab = sebabLibur(iso, peta);
  if (!sebab) return { tanggal: iso, bergeser: false, dari: iso, sebab: null, pemberitahuan: "" };
  const baru = majuKeHariKerja(iso, peta);
  return {
    tanggal: baru,
    bergeser: baru !== iso,
    dari: iso,
    sebab,
    pemberitahuan: `${sebutTanggalPanjang(iso)} hari libur (${sebab.nama}) - usulan digeser ke ${sebutTanggalPanjang(baru)}.`,
  };
}

/** Kalimat penolakan untuk tanggal pilihan tangan. "" bila boleh. */
export function tolakTanggalLibur(iso: string, peta: PetaLibur = petaBerlaku, sebutan = "Tanggal sidang"): string {
  const sebab = sebabLibur(iso, peta);
  if (!sebab) return "";
  return `${sebutan} ${sebutTanggalPanjang(iso)} jatuh pada hari libur (${sebab.nama}). Pilih hari kerja lain.`;
}

/** Tahun yang belum punya daftar SKB - layar menyebutnya, tidak menebak. */
export function tahunTanpaSkb(iso: string): boolean {
  return tanggalSah(iso) && !TAHUN_SKB_LENGKAP.includes(iso.slice(0, 4));
}

/** Bentuk yang dikirim /api/hari-libur ke ekstensi dan layar portal. */
export type DataHariLibur = {
  libur: ButirLibur[];
  tambahan: TambahanLibur[];
  tahunLengkap: string[];
  sumber: Array<{ tahun: string; skb: string; sumber: string; ditetapkan?: string }>;
  diubahOleh: string;
  diubahPada: string;
};

export function susunDataHariLibur(tambahan: readonly TambahanLibur[], diubahOleh = "", diubahPada = ""): DataHariLibur {
  const peta = gabungLibur(tambahan);
  return {
    libur: [...peta.values()].sort((a, b) => a.tanggal.localeCompare(b.tanggal)),
    tambahan: [...tambahan],
    tahunLengkap: [...TAHUN_SKB_LENGKAP],
    sumber: TAHUN_SKB_LENGKAP.map((tahun) => ({
      tahun,
      skb: SKB_LIBUR[tahun].skb,
      sumber: SKB_LIBUR[tahun].sumber,
      ditetapkan: SKB_LIBUR[tahun].ditetapkan,
    })),
    diubahOleh,
    diubahPada,
  };
}
