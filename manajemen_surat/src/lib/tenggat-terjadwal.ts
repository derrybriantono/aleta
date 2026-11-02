/**
 * ============================================================================
 * PENJAGA TENGGAT TERJADWAL (G1, 25 Okt 2026) - ATURAN MURNI
 * ============================================================================
 *
 * Menambah tiga hal di atas mesin aturan penjaga-tenggat.ts (yang tidak diubah perilakunya):
 *
 *   1. SETELAN: saklar jadwal harian dan saklar pengingat WhatsApp. KEDUANYA MATI bawaan. Pengingat
 *      WhatsApp hanya jalan bila jadwal juga menyala, dan hanya untuk aturan yang tercantum di
 *      `aturanPengingat` (bawaan: tujuh aturan lama; tiga aturan baru, dasar hukumnya sudah diperiksa Derry
 *      26 Okt 2026, harus dimasukkan Super Admin sendiri bila pengingatnya mau dinyalakan).
 *   2. PENERIMA PRIBADI: satu orang hanya menerima perkara yang NAMANYA tercantum sebagai majelis,
 *      panitera pengganti, jurusita (atau mediator). Tidak ada "gagal-terbuka" seperti layar: bila namanya
 *      tidak tercantum di perkara mana pun, ia tidak menerima apa-apa. Pesan WhatsApp ke orang yang salah
 *      menyebut perkara orang lain, dan itu tidak dapat ditarik.
 *   3. JAM PEMICU: 07.30 WITA pada hari kerja (bukan Sabtu/Minggu/libur), sekali per tanggal.
 *
 * Berkas ini tidak menyentuh basis data atau jaringan.
 */
import { AMBANG_MAKS_HARI, ATURAN_TENGGAT, PETA_SEMUA_ATURAN, SEMUA_ATURAN, type Butir, type Rapor } from "@/lib/penjaga-tenggat";
import { namaAdaDi, pecahNamaPetugas } from "@/lib/perkara-sendiri";

export const KUNCI_SETELAN_TENGGAT = "sistem:penjaga-tenggat";
export const JAM_TENGGAT_BAWAAN = "07:30";
/** Pengingat WhatsApp hanya dikirim dalam jam kerja (WITA), hari kerja: dari jam pemicu sampai batas ini. */
export const JAM_KERJA_AKHIR = "17:00";
/** Kabar menjelang tenggat: H-3 dan H-1 (hari sebelum batas). Dapat diatur Super Admin (0-14 hari). */
export const TAHAP_HARI_BAWAAN: readonly number[] = Object.freeze([3, 1]);

/** Aturan yang boleh masuk pengingat WhatsApp sejak awal: tujuh aturan lama yang sudah terukur. */
export const ATURAN_PENGINGAT_BAWAAN: readonly string[] = ATURAN_TENGGAT.map((a) => a.kode);

export type SetelanTenggat = {
  /** Jalankan penjaga tiap pagi hari kerja: menyimpan hasil harian (layar Tenggat, lonceng). Bawaan MATI. */
  jadwal: boolean;
  /** Kirim pengingat WhatsApp pribadi. Bawaan MATI; tidak berarti apa-apa bila `jadwal` mati. */
  pengingatWa: boolean;
  jam: string;
  /** Kode aturan yang boleh masuk pengingat WhatsApp. */
  aturanPengingat: string[];
  /** Hari sebelum batas ketika kabar "menjelang" dikirim, mis. [3, 1] = H-3 dan H-1. Tiap tahap sekali per perkara per tenggat. */
  tahapHari: number[];
  /** Batas hari pengganti untuk aturan kebiasaan satker (minutasi, kasir): kode aturan -> hari. Kosong = angka bawaan aturan. */
  ambangHari: Record<string, number>;
  diubahOleh: string;
  diubahPada: string;
};

export const SETELAN_TENGGAT_BAWAAN: Readonly<SetelanTenggat> = Object.freeze({
  jadwal: false,
  pengingatWa: false,
  jam: JAM_TENGGAT_BAWAAN,
  aturanPengingat: [...ATURAN_PENGINGAT_BAWAAN],
  tahapHari: [...TAHAP_HARI_BAWAAN],
  ambangHari: {},
  diubahOleh: "",
  diubahPada: "",
});

const teks = (x: unknown) => String(x ?? "").trim();

export function jamTenggatSah(jam: unknown): string {
  const j = teks(jam);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(j) ? j : JAM_TENGGAT_BAWAAN;
}

/** Tahap hari sah: bilangan bulat 0-14, tanpa kembar, besar ke kecil. Tidak sah/kosong = bawaan (H-3, H-1). */
export function tahapHariSah(mentah: unknown): number[] {
  if (!Array.isArray(mentah)) return [...TAHAP_HARI_BAWAAN];
  const daftar = [...new Set(mentah.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 14))];
  return daftar.length ? daftar.sort((a, b) => b - a).slice(0, 4) : [...TAHAP_HARI_BAWAAN];
}

/** Ambang sah: hanya aturan bertanda bisaDiatur, bilangan bulat 0-AMBANG_MAKS_HARI. Selebihnya dibuang. */
export function ambangHariSah(mentah: unknown): Record<string, number> {
  const hasil: Record<string, number> = {};
  if (!mentah || typeof mentah !== "object" || Array.isArray(mentah)) return hasil;
  for (const [kode, nilai] of Object.entries(mentah as Record<string, unknown>)) {
    const n = Number(nilai);
    if (PETA_SEMUA_ATURAN.get(kode)?.bisaDiatur && nilai !== "" && nilai !== null && Number.isInteger(n) && n >= 0 && n <= AMBANG_MAKS_HARI) hasil[kode] = n;
  }
  return hasil;
}

/** Setelan dari nilai mentah tersimpan. Apa pun yang tidak dikenal jatuh ke bawaan (mati). */
export function bersihkanSetelanTenggat(mentah: unknown): SetelanTenggat {
  const m = (mentah && typeof mentah === "object" ? mentah : {}) as Record<string, unknown>;
  const dikenal = new Set(SEMUA_ATURAN.map((a) => a.kode));
  const daftar = Array.isArray(m.aturanPengingat)
    ? [...new Set(m.aturanPengingat.map(teks).filter((k) => dikenal.has(k)))]
    : [...ATURAN_PENGINGAT_BAWAAN];
  return {
    jadwal: m.jadwal === true,
    pengingatWa: m.pengingatWa === true,
    jam: jamTenggatSah(m.jam),
    aturanPengingat: daftar,
    tahapHari: tahapHariSah(m.tahapHari),
    ambangHari: ambangHariSah(m.ambangHari),
    diubahOleh: teks(m.diubahOleh).slice(0, 120),
    diubahPada: teks(m.diubahPada).slice(0, 40),
  };
}

/** Pengingat WhatsApp benar-benar boleh jalan hanya bila KEDUA saklar menyala. */
export function pengingatWaAktif(s: Pick<SetelanTenggat, "jadwal" | "pengingatWa">): boolean {
  return s.jadwal === true && s.pengingatWa === true;
}

/** Sudah jam pemicu (WITA) dan belum jalan terjadwal hari ini? */
export function jatuhTempoTenggat(jamPemicu: string, jamSekarang: string, sudahJalan: boolean): boolean {
  if (sudahJalan) return false;
  return teks(jamSekarang).slice(0, 5) >= jamTenggatSah(jamPemicu);
}

// ============================================================================
// PENERIMA PRIBADI
// ============================================================================

type PetugasButir = Pick<Butir, "majelis" | "panitera" | "jurusita" | "mediator"> & Partial<Pick<Butir, "ruas" | "kasir">>;
const SEMUA_RUAS = ["majelis", "panitera", "jurusita", "mediator", "kasir"] as const;

/**
 * Apakah orang bernama `nama` tercantum sebagai petugas perkara pada butir ini? Ketat: nama kosong atau
 * ruas petugas yang kosong tidak pernah cocok. Pencocokan nama memakai namaAdaDi (gelar, tanda baca,
 * dan urutan kata sudah ditangani di sana).
 */
export function pemilikButir(b: PetugasButir, nama: string): boolean {
  const n = teks(nama);
  if (!n) return false;
  // Aturan yang menyebut ruas penanggung jawab (mis. relaas = jurusita + PP) hanya membunyikan telepon mereka;
  // aturan tanpa ruas membunyikan semua petugas yang tercantum (perilaku aturan lama).
  for (const ruas of b.ruas?.length ? b.ruas : SEMUA_RUAS) {
    const t = teks(b[ruas]);
    if (t && namaAdaDi(n, t)) return true;
  }
  return false;
}

/**
 * Butir yang boleh dikirim ke satu orang: miliknya sendiri, aturannya diizinkan, dan bukan hitung mundur
 * ("berjalan" bukan kelalaian dan tidak layak membunyikan telepon siapa pun).
 */
export function butirUntukPenerima(butir: readonly Butir[], nama: string, aturanDiizinkan: readonly string[]): Butir[] {
  const izin = new Set(aturanDiizinkan);
  return butir.filter((b) => b.tingkat !== "berjalan" && izin.has(b.aturan) && pemilikButir(b, nama));
}

/** Rapor yang hanya memuat butir tertentu (hitungan disusun ulang). */
export function raporDariButir(asal: Pick<Rapor, "acuan">, butir: Butir[]): Rapor {
  return {
    acuan: asal.acuan,
    butir,
    hitung: {
      lewat: butir.filter((b) => b.tingkat === "lewat").length,
      menjelang: butir.filter((b) => b.tingkat === "menjelang").length,
      catatan: butir.filter((b) => b.tingkat === "catatan").length,
    },
    tumpukanLama: {},
    berjalan: 0,
  };
}

/** Batas panjang satu pesan pengingat. WhatsApp menerima lebih; yang dibaca di layar telepon tidak. */
export const BATAS_PESAN_PENGINGAT = 3200;

export function potongPesan(pesan: string, batas = BATAS_PESAN_PENGINGAT): string {
  if (pesan.length <= batas) return pesan;
  const potong = pesan.slice(0, batas - 60);
  const akhirBaris = potong.lastIndexOf("\n");
  return `${potong.slice(0, akhirBaris > 0 ? akhirBaris : potong.length)}\n…selengkapnya di layar Tenggat portal.`;
}

// ============================================================================
// KABAR BERTAHAP - SATU PESAN PER PERKARA PER TENGGAT PER TAHAP
// ============================================================================

export type TahapKabar = "lewat" | "catatan" | `H-${number}`;

/**
 * Tahap kabar sebuah butir, atau null bila belum saatnya / tidak perlu dikabarkan.
 *
 *   menjelang  H-t untuk t terkecil dalam `tahapHari` yang >= sisa hari (sisa 2 dengan [3,1] = H-3 bila belum terkirim,
 *              sisa 1 atau 0 = H-1). Sisa lebih besar dari tahap terbesar: belum dikabarkan.
 *   lewat      "lewat", sekali.
 *   catatan    "catatan" (termasuk hitungan belum berjalan), sekali.
 *   berjalan   tidak pernah dikabarkan.
 *
 * Tiap tahap hanya sekali per (penerima, perkara, aturan, pihak, tanggal acuan): lihat kunciKabar().
 */
export function tahapKabar(b: Pick<Butir, "tingkat" | "selisihHari">, tahapHari: readonly number[] = TAHAP_HARI_BAWAAN): TahapKabar | null {
  if (b.tingkat === "lewat") return "lewat";
  if (b.tingkat === "catatan") return "catatan";
  if (b.tingkat !== "menjelang") return null;
  const sisa = Math.max(0, -b.selisihHari);
  const naik = [...tahapHari].sort((x, y) => x - y);
  const t = naik.find((x) => x >= sisa);
  return t === undefined ? null : `H-${t}`;
}

/** Kunci satu kabar (juga kunci utama aleta_tenggat_kabar). Berubahnya tanggal acuan (mis. mediator baru) membuka kabar baru. */
export function kunciKabar(penerimaId: string, b: Pick<Butir, "perkaraId" | "aturan" | "pihak" | "tanggalAcuan">, tahap: string): string {
  return [penerimaId, b.perkaraId, b.aturan, b.pihak || "-", b.tanggalAcuan || "-", tahap].join("|");
}

/** Pagar jam kerja: hari kerja (bukan libur), sejak jam pemicu sampai JAM_KERJA_AKHIR WITA. */
export function dalamJamKerja(jamSekarang: string, jamPemicu: string, hariLibur: boolean): boolean {
  if (hariLibur) return false;
  const j = teks(jamSekarang).slice(0, 5);
  return j >= jamTenggatSah(jamPemicu) && j <= JAM_KERJA_AKHIR;
}

// ============================================================================
// LONCENG
// ============================================================================

export type RingkasanLonceng = { id: string; judul: string; uraian: string; penting: boolean };

/**
 * Satu butir lonceng per hari untuk satu akun. `butir` sudah disaring pemanggil (milik orang itu, atau semua
 * untuk admin). Tidak ada butir lewat/menjelang/catatan = tidak ada lonceng (hari bersih tidak membunyikan lonceng).
 */
export function ringkasLonceng(butir: readonly Butir[], tanggal: string, semua = false): RingkasanLonceng | null {
  const aktif = butir.filter((b) => b.tingkat !== "berjalan");
  if (aktif.length === 0) return null;
  const lewat = aktif.filter((b) => b.tingkat === "lewat").length;
  const menjelang = aktif.filter((b) => b.tingkat === "menjelang").length;
  const catatan = aktif.filter((b) => b.tingkat === "catatan").length;
  const bagian: string[] = [];
  if (lewat) bagian.push(`${lewat} lewat tenggat`);
  if (menjelang) bagian.push(`${menjelang} menjelang`);
  if (catatan) bagian.push(`${catatan} catatan`);
  const contoh = [...new Set(aktif.map((b) => b.nomorPerkara))].slice(0, 3).join(", ");
  return {
    id: `tenggat:${tanggal}:${semua ? "semua" : "saya"}`,
    judul: `Tenggat ${semua ? "satker" : "perkara Anda"}: ${bagian.join(", ")}`,
    uraian: `${contoh}${new Set(aktif.map((b) => b.nomorPerkara)).size > 3 ? ", dan lainnya" : ""}. Rincian di layar Tenggat.`,
    penting: lewat > 0,
  };
}

// ============================================================================
// SARINGAN LAYAR TENGGAT
// ============================================================================

/** Jangka waktu sebuah butir untuk layar Tenggat: sudah lewat, jatuh hari ini, 1-7 hari lagi, atau lebih lama / hanya catatan. */
export type JangkaTenggat = "lewat" | "hari-ini" | "minggu-ini" | "nanti" | "catatan";

export const LABEL_JANGKA: Readonly<Record<JangkaTenggat, string>> = {
  lewat: "Sudah lewat",
  "hari-ini": "Hari ini",
  "minggu-ini": "Minggu ini (7 hari)",
  nanti: "Lebih dari seminggu",
  catatan: "Catatan",
};

/**
 * Jarak butir ke batasnya. Aturan yang acuannya peristiwa di depan (sidang pertama) memakai jarak ke peristiwa itu,
 * bukan jarak ke ambang. Hitungan yang belum berjalan dan butir catatan tidak punya jangka (catatan).
 */
export function jangkaButir(b: Pick<Butir, "aturan" | "selisihHari" | "hariKePeristiwa" | "tingkat" | "menunggu">): JangkaTenggat {
  if (b.menunggu || b.tingkat === "catatan") return "catatan";
  const sisa = PETA_SEMUA_ATURAN.get(b.aturan)?.acuanDiDepan ? b.hariKePeristiwa : -b.selisihHari;
  if (b.tingkat === "lewat" || sisa < 0) return "lewat";
  if (sisa === 0) return "hari-ini";
  return sisa <= 7 ? "minggu-ini" : "nanti";
}

export type SaringanTenggat = {
  jangka?: string;
  tingkat?: string;
  aturan?: string;
  majelis?: string;
  panitera?: string;
  cari?: string;
  /** Hanya perkara yang namanya tercantum (diisi nama akun). Kosong = tidak menyaring. */
  milikSaya?: string;
};

/** Nama-nama petugas (satu per orang, urut abjad) pada ruas majelis atau panitera semua butir. */
export function daftarPetugasTenggat(butir: readonly Butir[], ruas: "majelis" | "panitera"): string[] {
  const nama = new Set<string>();
  for (const b of butir) {
    // Gelar memakai koma juga ("Budi Santoso, S.H."): dipecah dengan pemecah yang sama dengan penyaring "perkara saya".
    for (const satu of pecahNamaPetugas(String(b[ruas] || ""))) nama.add(satu);
  }
  return [...nama].sort((a, b) => a.localeCompare(b, "id"));
}

function mengandungNama(ruas: string, nama: string): boolean {
  return pecahNamaPetugas(String(ruas || "")).includes(nama);
}

/** Menyaring butir untuk layar. Semua kriteria bersifat DAN. */
export function saringButirTenggat(butir: readonly Butir[], s: SaringanTenggat): Butir[] {
  const cari = teks(s.cari).toLowerCase();
  return butir.filter((b) => {
    if (s.jangka && jangkaButir(b) !== s.jangka) return false;
    if (s.tingkat && b.tingkat !== s.tingkat) return false;
    if (s.aturan && b.aturan !== s.aturan) return false;
    if (s.majelis && !mengandungNama(b.majelis, s.majelis)) return false;
    if (s.panitera && !mengandungNama(b.panitera, s.panitera)) return false;
    if (s.milikSaya && !pemilikButir(b, s.milikSaya)) return false;
    if (cari && !`${b.nomorPerkara} ${b.jenisPerkara}`.toLowerCase().includes(cari)) return false;
    return true;
  });
}

/** "tinggal 3 hari", "lewat 2 hari", "jatuh tempo hari ini", atau "hitungan belum berjalan". */
export function kalimatSisa(b: Pick<Butir, "selisihHari" | "menunggu" | "tingkat">): string {
  if (b.menunggu) return "hitungan belum berjalan";
  if (b.selisihHari > 0) return `lewat ${b.selisihHari} hari`;
  if (b.selisihHari === 0) return "jatuh tempo hari ini";
  return `tinggal ${Math.abs(b.selisihHari)} hari`;
}
