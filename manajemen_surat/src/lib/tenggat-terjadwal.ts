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
import { ATURAN_TENGGAT, SEMUA_ATURAN, type Butir, type Rapor } from "@/lib/penjaga-tenggat";
import { namaAdaDi, pecahNamaPetugas } from "@/lib/perkara-sendiri";

export const KUNCI_SETELAN_TENGGAT = "sistem:penjaga-tenggat";
export const JAM_TENGGAT_BAWAAN = "07:30";

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
  diubahOleh: string;
  diubahPada: string;
};

export const SETELAN_TENGGAT_BAWAAN: Readonly<SetelanTenggat> = Object.freeze({
  jadwal: false,
  pengingatWa: false,
  jam: JAM_TENGGAT_BAWAAN,
  aturanPengingat: [...ATURAN_PENGINGAT_BAWAAN],
  diubahOleh: "",
  diubahPada: "",
});

const teks = (x: unknown) => String(x ?? "").trim();

export function jamTenggatSah(jam: unknown): string {
  const j = teks(jam);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(j) ? j : JAM_TENGGAT_BAWAAN;
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

type PetugasButir = Pick<Butir, "majelis" | "panitera" | "jurusita" | "mediator">;

/**
 * Apakah orang bernama `nama` tercantum sebagai petugas perkara pada butir ini? Ketat: nama kosong atau
 * ruas petugas yang kosong tidak pernah cocok. Pencocokan nama memakai namaAdaDi (gelar, tanda baca,
 * dan urutan kata sudah ditangani di sana).
 */
export function pemilikButir(b: PetugasButir, nama: string): boolean {
  const n = teks(nama);
  if (!n) return false;
  for (const ruas of [b.majelis, b.panitera, b.jurusita, b.mediator]) {
    const t = teks(ruas);
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

export type SaringanTenggat = {
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
