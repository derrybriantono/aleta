/**
 * ============================================================================
 * TAUTKAN SEMUA AKUN ALETA KE AKUN SIPP-NYA (14 Okt 2026)
 * ============================================================================
 *
 * Permintaan pengguna 14 Okt: "ganti semua user dan password yang dari SIPP ke
 * ALETA, cek namanya apabila double 1 nama dengan user lain beritahu".
 *
 * Masuk ALETA dengan username + password SIPP SUDAH ada (7 Okt, masuk-sipp.ts):
 * yang dibutuhkan setiap akun hanya TAUTANNYA (external_app_credentials app
 * 'sipp'). Modul ini MURNI - tanpa basis data, tanpa jaringan - dan menyusun
 * PRATINJAU (dry-run) seluruh akun: mana yang sudah bertaut, mana yang cocok
 * pasti, mana yang ganda/ragu, dan mana yang tak berpadanan. Yang menulis
 * hanya server/modules/portal/tautan-semua-sipp.ts, dan hanya untuk baris
 * yang lolos saringPilihanTerapkan di bawah.
 *
 * Password TIDAK PERNAH disalin atau disimpan: login tetap dicocokkan ke sidik
 * sys_users SIPP saat masuk. Daftar SIPP yang masuk ke sini pun tidak memuat
 * sidik password maupun kode aktivasi.
 *
 * ============================================================================
 * PASTI = SATU-SATUNYA, DAN TIDAK DIBANTAH
 * ============================================================================
 *
 * Bukti yang dipakai (sama dengan lib/nama-pegawai-sipp.ts - satu aturan):
 *   - username ALETA = username SIPP (huruf besar-kecil diabaikan);
 *   - NIP akun ALETA = NIP pejabat SIPP (user_hakim/panitera/jurusita);
 *   - kunci nama (gelar, tanda baca, ejaan dilipat) SAMA PERSIS.
 * NIP keduanya ada tetapi berbeda = BUKAN orang yang sama.
 *
 * "Pasti" hanya bila tepat SATU akun SIPP AKTIF yang cocok, akun SIPP itu
 * tidak diklaim akun ALETA lain, dan tidak ada akun ALETA lain yang juga
 * cocok pasti ke akun SIPP yang sama. Selebihnya GANDA atau RAGU - dan itulah
 * yang diminta pengguna untuk diberitahukan.
 *
 * Super Admin tidak pernah diubah. Akun yang tautannya pernah DICABUT admin
 * tidak dihidupkan lagi lewat alat ini.
 */

import {
  kataIntiNama,
  kunciNama,
  kunciNamaSemua,
  nipAkunAleta,
  PANJANG_KUNCI_MINIMUM,
  rapikanNip,
  type PegawaiSipp,
} from "@/lib/nama-pegawai-sipp";
import type { RoleId } from "@/lib/types";
import { normalizeAdditionalRoleIds } from "@/lib/user-additional-roles";

// ============================================================================
// BAHAN
// ============================================================================

/** Satu baris sys_users SIPP - TANPA sidik password / kode aktivasi. */
export type PenggunaSippDaftar = PegawaiSipp & {
  diblokir: boolean;
  kedaluwarsa: boolean;
  /** Nama grup SIPP (sys_groups.name) - satu akun dapat punya beberapa. */
  grup: string[];
};

export type AkunAletaTautan = {
  id: string;
  username: string;
  name: string;
  nip?: string | null;
  roleId: string;
  isActive: boolean;
  dihapus?: boolean;
  /** Sub-peran / tugas (users.additional_role_ids_json) - diisi, tidak pernah dikurangi. */
  subPeran?: string[];
};

/**
 * Keputusan pengguna atas satu nama (mis. 14 Okt 2026: "Munifa, S.H." ->
 * `munifa,SH.`). Menjadikan pasangan itu pasti/tercentang walau namanya
 * ganda di SIPP - hanya bila akun SIPP-nya aktif dan tidak diklaim akun
 * ALETA lain, dan nama itu milik paling banyak SATU akun ALETA aktif.
 */
export type KetetapanPengguna = { nama: string; usernameSipp: string; catatan: string };

export type KredensialTautan = {
  userId: string;
  username: string;
  aktif: boolean;
  keadaan: string;
  /** tautan_sumber: '' manual, 'nama-sipp', 'nip-sipp', 'sesi-sipp', 'admin-massal'. */
  sumber?: string;
};

export type BahanTautan = {
  akun: AkunAletaTautan[];
  kredensial: KredensialTautan[];
  sipp: PenggunaSippDaftar[];
  ketetapan?: KetetapanPengguna[];
};

// ============================================================================
// HASIL
// ============================================================================

export type DasarCocok = "username" | "nip" | "nama";

export type CalonSipp = {
  username: string;
  sippUserId: string;
  namaLengkap: string;
  dasar: DasarCocok[];
  aktif: boolean;
  keadaan: "aktif" | "diblokir" | "kedaluwarsa";
  grup: string[];
  /** Sub-peran/tugas ALETA yang dipetakan dari akun SIPP ini (subPeranDariSipp). */
  subPeran: string[];
};

export type KelompokTautan =
  /** Sudah punya tautan aktif. */
  | "sudah"
  /** Cocok pasti - dicentang di pratinjau. */
  | "pasti"
  /** Lebih dari satu calon, atau calonnya diklaim akun lain. */
  | "ganda"
  /** Hanya mirip, atau pernah dicabut - manusia yang memutuskan. */
  | "ragu"
  /** Cocok hanya ke akun SIPP yang diblokir/kedaluwarsa. */
  | "sipp-nonaktif"
  /** Tidak ada akun SIPP yang cocok. */
  | "tanpa-padanan"
  /** Tautannya pernah dicabut / dinonaktifkan admin. */
  | "dicabut"
  /** Akun ALETA nonaktif. */
  | "nonaktif"
  /** Super Admin tidak diubah. */
  | "super-admin";

export type BarisTautan = {
  userId: string;
  nama: string;
  usernameAleta: string;
  roleId: string;
  kelompok: KelompokTautan;
  /** Kalimat sebab untuk admin. */
  sebab: string;
  /** Untuk "sudah"/"pasti"/"dicabut": username SIPP yang (akan) ditautkan. */
  usernameSipp: string;
  /** Calon akun SIPP (aktif lebih dulu) - pilihan admin untuk ganda/ragu. */
  calon: CalonSipp[];
  /** Untuk "sudah": masalah pada tautan yang ada (akun SIPP diblokir, dsb.). */
  masalah: string;
  /** tautan_sumber tautan yang ada ('admin-massal' = boleh dibatalkan di sini). */
  sumberTautan: string;
  /** Sub-peran yang SUDAH dimiliki akun ALETA ini. */
  subPeranAda: string[];
  /** Sub-peran dari akun SIPP tujuan yang BELUM dimiliki (pasti / sudah tanpa masalah). Peran utama tidak pernah diubah. */
  subPeranUsulan: string[];
  /** Pasangan ini ditetapkan pengguna sendiri (KetetapanPengguna). */
  ditetapkanPengguna: boolean;
};

export type UsulanPeran = {
  /** Jabatan + peran ALETA PADANAN grup SIPP. */
  jabatanPadanan: string;
  peranPadanan: RoleId;
  /** Padanan itu peran tinggi - TIDAK pernah diberikan otomatis. */
  tinggi: boolean;
  /** Jabatan + peran yang AMAN diberikan tanpa keputusan admin (dipakai saat membuat akun). */
  jabatanAman: string;
  peranAman: RoleId;
  /** Grup SIPP / jabatan pejabat yang dipakai menyimpulkan. */
  dasar: string;
};

/**
 * Petugas SIPP AKTIF yang belum punya akun ALETA:
 *   - "buat"    : akun ALETA baru dapat dibuat (username = username SIPP,
 *                 TANPA password ALETA - masuk hanya dengan password SIPP);
 *   - "ganda"   : nama lengkapnya dipakai lebih dari satu akun SIPP - tidak
 *                 dibuat otomatis, dilaporkan;
 *   - "bentrok" : username SIPP-nya sudah dipakai akun ALETA lain.
 */
export type SippTanpaAkun = {
  username: string;
  sippUserId: string;
  namaLengkap: string;
  /** NIP pejabat SIPP bila tunggal - diisikan ke akun baru. */
  nip: string;
  grup: string[];
  usulan: UsulanPeran;
  /** Sub-peran/tugas yang diisikan ke akun baru (subPeranDariSipp). */
  subPeran: string[];
  kelompok: "buat" | "ganda" | "bentrok";
  sebab: string;
};

/** Akun SIPP aktif tanpa tautan yang namanya/NIP-nya milik akun ALETA yang sudah ada. */
export type SippAkunLain = {
  username: string;
  sippUserId: string;
  namaLengkap: string;
  grup: string[];
  pemilik: Array<{ id: string; name: string; usernameSipp: string }>;
};

export type NamaGanda = {
  nama: string;
  akun: Array<{ username: string; namaLengkap: string; keadaan: CalonSipp["keadaan"] }>;
  jumlahAktif: number;
};

export type NamaGandaAleta = {
  nama: string;
  akun: Array<{ id: string; name: string; username: string }>;
};

export type PratinjauTautan = {
  baris: BarisTautan[];
  sippTanpaAkun: SippTanpaAkun[];
  /** Akun SIPP aktif kedua/ketiga milik pegawai yang sudah punya akun ALETA. */
  sippAkunLain: SippAkunLain[];
  /** Satu nama dipakai lebih dari satu akun SIPP. */
  namaGandaSipp: NamaGanda[];
  /** Satu nama dipakai lebih dari satu akun ALETA aktif. */
  namaGandaAleta: NamaGandaAleta[];
  ringkasan: Record<KelompokTautan, number> & {
    akunAleta: number;
    akunSipp: number;
    akunSippAktif: number;
    sippTanpaAkun: number;
    /** Dari sippTanpaAkun: yang dapat dibuatkan akun (bukan ganda/bentrok). */
    sippBuat: number;
    sippAkunLain: number;
    namaGandaSippAktif: number;
  };
};

// ============================================================================
// PEMETAAN GRUP SIPP -> JABATAN/PERAN ALETA (USULAN)
// ============================================================================
//
// Untuk petugas SIPP yang belum punya akun ALETA. Peran ALETA mengikuti
// JABATAN (core/organization positionRoleMap), jadi yang dipetakan jabatannya.
// Peran tinggi (putusan, penetapan, pengaturan, akun orang lain) tidak pernah
// diberikan otomatis: akun baru memakai jabatan AMAN (Pengadministrasi Umum =
// pelaksana) dan admin yang menaikkannya. Urutan penting - yang pertama cocok
// menang. Tanpa grup yang dikenal, jabatan pejabat SIPP (user_hakim/
// panitera/jurusita) dipakai; tanpa keduanya: pelaksana.

type AturanGrup = { pola: RegExp; jabatan: string; peran: RoleId; tinggi: boolean };

export const PETA_GRUP_SIPP: ReadonlyArray<AturanGrup> = [
  { pola: /^(root|super administrator|administrator)$/i, jabatan: "pos-pranata-komputer", peran: "admin", tinggi: true },
  { pola: /^ketua\s*\/\s*wakil ketua$/i, jabatan: "pos-ketua", peran: "ketua", tinggi: true },
  { pola: /^hakim$/i, jabatan: "pos-hakim", peran: "hakim", tinggi: true },
  { pola: /^panitera\s*\/\s*wakil panitera$/i, jabatan: "pos-panitera", peran: "panitera", tinggi: true },
  { pola: /^panmud permohonan$/i, jabatan: "pos-panitera-muda-permohonan", peran: "panitera-muda", tinggi: true },
  { pola: /^panmud gugatan$/i, jabatan: "pos-panitera-muda-gugatan", peran: "panitera-muda", tinggi: true },
  { pola: /^(panmud|panitera muda)\b/i, jabatan: "pos-panitera-muda-hukum", peran: "panitera-muda", tinggi: true },
  { pola: /^panitera pengganti$/i, jabatan: "pos-panitera-pengganti", peran: "panitera-pengganti", tinggi: false },
  { pola: /^jurusita/i, jabatan: "pos-jurusita", peran: "jurusita", tinggi: false },
  { pola: /^(meja\b|admin pan|staf panitera|koordinator delegasi)/i, jabatan: "pos-analis-perkara", peran: "analis-perkara", tinggi: false },
  { pola: /(keuangan|kasir)/i, jabatan: "pos-analis-keuangan", peran: "analis-keuangan", tinggi: false },
  { pola: /(kepegawaian|umum|informasi)/i, jabatan: "pos-pengadministrasi-umum", peran: "pelaksana", tinggi: false },
];

const PETA_JABATAN_PEJABAT: Record<string, AturanGrup> = {
  hakim: { pola: /hakim/, jabatan: "pos-hakim", peran: "hakim", tinggi: true },
  panitera: { pola: /panitera/, jabatan: "pos-panitera-pengganti", peran: "panitera-pengganti", tinggi: false },
  jurusita: { pola: /jurusita/, jabatan: "pos-jurusita", peran: "jurusita", tinggi: false },
};

export const PERAN_TINGGI: ReadonlySet<string> = new Set([
  "super-admin",
  "admin",
  "ketua",
  "wakil-ketua",
  "hakim",
  "sekretaris",
  "panitera",
  "panitera-muda",
  "kasubag",
  "pejabat-struktural",
]);

export const JABATAN_AMAN = "pos-pengadministrasi-umum";
const PERAN_AMAN: RoleId = "pelaksana";

function usulanDari(aturan: AturanGrup, dasar: string): UsulanPeran {
  const tinggi = aturan.tinggi || PERAN_TINGGI.has(aturan.peran);
  return {
    jabatanPadanan: aturan.jabatan,
    peranPadanan: aturan.peran,
    tinggi,
    // 14 Okt 2026 (keputusan pengguna): peran UTAMA ditentukan pengguna
    // sendiri. Akun baru SELALU memakai peran paling rendah; padanan di atas
    // hanya keterangan. Tugasnya diisi lewat sub-peran (subPeranDariSipp).
    jabatanAman: JABATAN_AMAN,
    peranAman: PERAN_AMAN,
    dasar,
  };
}

/** Usulan jabatan/peran ALETA dari grup SIPP (lalu jabatan pejabat SIPP). */
export function usulanPeranDariGrup(grup: string[], jabatanPejabat: string[] = []): UsulanPeran {
  for (const aturan of PETA_GRUP_SIPP) {
    const kena = grup.find((g) => aturan.pola.test(String(g ?? "").trim()));
    if (kena) return usulanDari(aturan, `grup SIPP "${kena}"`);
  }
  for (const j of ["hakim", "panitera", "jurusita"]) {
    if (jabatanPejabat.includes(j)) return usulanDari(PETA_JABATAN_PEJABAT[j], `pejabat SIPP (${j})`);
  }
  return usulanDari({ pola: /./, jabatan: JABATAN_AMAN, peran: PERAN_AMAN, tinggi: false }, "tanpa grup SIPP");
}

// ============================================================================
// PEMETAAN AKUN SIPP -> SUB-PERAN / TUGAS ALETA (14 Okt 2026)
// ============================================================================
//
// Peran UTAMA akun ditentukan pengguna sendiri dan tidak pernah diubah alat
// ini. Yang dipetakan hanya SUB-PERAN (users.additional_role_ids_json -
// struktur yang sudah ada, lib/user-additional-roles.ts), dari username dan
// grup akun SIPP. Sub-peran hanya DITAMBAHKAN, tidak pernah dikurangi.
//
//   username meja1g / meja2p / ...       -> petugas_meja_1_gugatan / petugas_meja_2_permohonan
//   grup "Meja I Gugatan", "Meja III Permohonan", "Meja II Jinayat", ...
//                                        -> petugas_meja_<1-3>_<jenis>
//   grup "Kasir"                         -> kasir
//   grup "Bagian/Staf Bagian Keuangan"   -> petugas_keuangan_perkara
//   grup "Koordinator Delegasi"          -> operator_delegasi
//   grup "Informasi"                     -> petugas_meja_informasi
//
// Grup yang sama dengan PERAN UTAMA (Hakim, Panitera, Panmud, PP, Jurusita,
// Ketua) tidak dijadikan sub-peran. Menu petugas meja (disetujui pengguna
// 14 Okt): Meja 1 -> golongan PTSP, Meja 2/3 -> staf kepaniteraan
// (analis-perkara) - lihat lib/matriks-peran.ts MEJA-SIPP. Hanya menambah.

const ROMAWI: Record<string, number> = { i: 1, ii: 2, iii: 3 };

export const PETA_SUB_PERAN_GRUP: ReadonlyArray<{ pola: RegExp; subPeran: string }> = [
  { pola: /^kasir$/i, subPeran: "kasir" },
  { pola: /^(staf )?bagian keuangan$/i, subPeran: "petugas_keuangan_perkara" },
  { pola: /^koordinator delegasi$/i, subPeran: "operator_delegasi" },
  { pola: /^informasi$/i, subPeran: "petugas_meja_informasi" },
];

/** Sub-peran/tugas ALETA dari username + grup satu akun SIPP. */
export function subPeranDariSipp(s: { username: string; grup: string[] }): string[] {
  const hasil: string[] = [];
  const meja = /^meja\s*([123])\s*([gpj])$/i.exec(String(s.username ?? "").trim());
  if (meja) {
    const jenis = { g: "gugatan", p: "permohonan", j: "jinayat" }[meja[2].toLowerCase() as "g" | "p" | "j"];
    hasil.push(`petugas_meja_${meja[1]}_${jenis}`);
  }
  for (const mentah of s.grup ?? []) {
    const g = String(mentah ?? "").trim();
    const m = /^meja\s+(i{1,3})\s+(\S+)/i.exec(g);
    if (m) {
      hasil.push(`petugas_meja_${ROMAWI[m[1].toLowerCase()]}_${m[2].toLowerCase()}`);
      continue;
    }
    for (const aturan of PETA_SUB_PERAN_GRUP) if (aturan.pola.test(g)) hasil.push(aturan.subPeran);
  }
  return normalizeAdditionalRoleIds(hasil);
}

function kurangi(usulan: string[], ada: string[]): string[] {
  const sudah = new Set(normalizeAdditionalRoleIds(ada));
  return usulan.filter((x) => !sudah.has(x));
}

// ============================================================================
// KEMIRIPAN (HANYA UNTUK MENANDAI "RAGU", TIDAK PERNAH UNTUK "PASTI")
// ============================================================================

function jarakSunting(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let sebelum = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const kini = [i];
    for (let j = 1; j <= b.length; j += 1) {
      kini[j] = Math.min(sebelum[j] + 1, kini[j - 1] + 1, sebelum[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    sebelum = kini;
  }
  return sebelum[b.length];
}

/**
 * Dua nama MIRIP (bukan sama): beda ejaan sedikit ("Munifah" / "Munifa"), atau
 * kata-kata yang satu seluruhnya termuat di yang lain ("Idris" / "Muh. Idris").
 */
export function namaSama(a: unknown, b: unknown): boolean {
  const kb = kunciNamaSemua(b);
  return [...kunciNamaSemua(a)].some((k) => kb.has(k));
}

export function namaMirip(a: unknown, b: unknown): boolean {
  const ka = kunciNama(a);
  const kb = kunciNama(b);
  if (ka.length < PANJANG_KUNCI_MINIMUM || kb.length < PANJANG_KUNCI_MINIMUM) return false;
  if (namaSama(a, b)) return false;
  const panjang = Math.min(ka.length, kb.length);
  if (panjang >= 6 && jarakSunting(ka, kb) <= (panjang >= 12 ? 2 : 1)) return true;
  const kataA = kataIntiNama(a).filter((k) => k.length >= 3);
  const kataB = kataIntiNama(b).filter((k) => k.length >= 3);
  if (kataA.length === 0 || kataB.length === 0) return false;
  const [kecil, besar] = kataA.length <= kataB.length ? [kataA, new Set(kataB)] : [kataB, new Set(kataA)];
  const termuat = kecil.every((k) => besar.has(k));
  // Satu kata pendek saja ("Ali") terlalu umum untuk disebut mirip.
  return termuat && kecil.join("").length >= 5;
}

// ============================================================================
// PENYUSUN PRATINJAU
// ============================================================================

function kunciUser(u: string) {
  return String(u ?? "").trim().toLowerCase();
}

function keadaanSipp(s: Pick<PenggunaSippDaftar, "diblokir" | "kedaluwarsa">): CalonSipp["keadaan"] {
  return s.diblokir ? "diblokir" : s.kedaluwarsa ? "kedaluwarsa" : "aktif";
}

function namaSippSemua(s: PegawaiSipp): string[] {
  return [s.namaLengkap, ...s.pejabat.map((p) => p.nama)].filter((x) => String(x ?? "").trim());
}

function calonDari(s: PenggunaSippDaftar, dasar: DasarCocok[]): CalonSipp {
  const keadaan = keadaanSipp(s);
  return {
    username: s.username,
    sippUserId: s.sippUserId,
    namaLengkap: s.namaLengkap,
    dasar,
    aktif: keadaan === "aktif",
    keadaan,
    grup: s.grup,
    subPeran: subPeranDariSipp(s),
  };
}

/** Akun SIPP yang cocok dengan satu akun ALETA (username / NIP / nama), dengan NIP sebagai pembantah. */
export function calonSippUntukAkun(akun: AkunAletaTautan, sipp: PenggunaSippDaftar[]): CalonSipp[] {
  const unameAleta = kunciUser(akun.username);
  const nipAleta = nipAkunAleta({ id: akun.id, nip: akun.nip ?? null });
  const hasil: CalonSipp[] = [];
  for (const s of sipp) {
    if (!s.username.trim()) continue;
    const nipSipp = new Set(s.pejabat.map((p) => rapikanNip(p.nip)).filter(Boolean));
    const nipSama = Boolean(nipAleta) && nipSipp.has(nipAleta);
    const nipBeda = Boolean(nipAleta) && nipSipp.size > 0 && !nipSama;
    if (nipBeda) continue;
    const dasar: DasarCocok[] = [];
    if (unameAleta.length >= 3 && unameAleta === kunciUser(s.username)) dasar.push("username");
    if (nipSama) dasar.push("nip");
    if (namaSippSemua(s).some((n) => namaSama(akun.name, n))) dasar.push("nama");
    if (dasar.length > 0) hasil.push(calonDari(s, dasar));
  }
  return urutkanCalon(hasil);
}

function urutkanCalon(calon: CalonSipp[]): CalonSipp[] {
  return [...calon].sort(
    (a, b) => Number(b.aktif) - Number(a.aktif) || b.dasar.length - a.dasar.length || a.username.localeCompare(b.username)
  );
}

function calonMirip(akun: AkunAletaTautan, sipp: PenggunaSippDaftar[]): CalonSipp[] {
  const hasil: CalonSipp[] = [];
  for (const s of sipp) {
    if (!s.username.trim()) continue;
    if (namaSippSemua(s).some((n) => namaMirip(akun.name, n))) hasil.push(calonDari(s, []));
  }
  return urutkanCalon(hasil);
}

const KELOMPOK: KelompokTautan[] = [
  "sudah",
  "pasti",
  "ganda",
  "ragu",
  "sipp-nonaktif",
  "tanpa-padanan",
  "dicabut",
  "nonaktif",
  "super-admin",
];

export function susunPratinjauTautanSipp(bahan: BahanTautan): PratinjauTautan {
  const sippPerUsername = new Map(bahan.sipp.map((s) => [kunciUser(s.username), s]));
  const akunHidup = bahan.akun.filter((a) => !a.dihapus);

  // Klaim AKTIF tiap username SIPP (akun ALETA mana saja yang menyimpannya).
  const klaimAktif = new Map<string, Set<string>>();
  // Username SIPP yang tautannya pernah dicabut/dinonaktifkan.
  const pernahDicabut = new Set<string>();
  for (const k of bahan.kredensial) {
    const kunci = kunciUser(k.username);
    if (!kunci || !k.userId) continue;
    if (k.aktif) {
      const set = klaimAktif.get(kunci) ?? new Set<string>();
      set.add(k.userId);
      klaimAktif.set(kunci, set);
    } else {
      pernahDicabut.add(kunci);
    }
  }

  // Ketetapan pengguna: nama -> username SIPP. Berlaku hanya bila akun SIPP-nya
  // ada & aktif dan nama itu milik paling banyak satu akun ALETA aktif.
  const akunAktifSemua = akunHidup.filter((a) => a.isActive);
  const ketetapanSah = (bahan.ketetapan ?? []).filter((k) => {
    const s = sippPerUsername.get(kunciUser(k.usernameSipp));
    return Boolean(s && !s.diblokir && !s.kedaluwarsa) && akunAktifSemua.filter((a) => namaSama(a.name, k.nama)).length <= 1;
  });
  const ketetapanUntuk = (akun: AkunAletaTautan) => ketetapanSah.find((k) => namaSama(akun.name, k.nama));

  const baris: BarisTautan[] = [];
  for (const akun of akunHidup) {
    const kred = bahan.kredensial.find((k) => k.userId === akun.id && k.username.trim());
    const subPeranAda = normalizeAdditionalRoleIds(akun.subPeran ?? []);
    const dasarBaris = {
      userId: akun.id,
      nama: akun.name,
      usernameAleta: akun.username,
      roleId: akun.roleId,
      usernameSipp: kred?.username.trim() ?? "",
      masalah: "",
      sumberTautan: kred?.sumber ?? "",
      subPeranAda,
      subPeranUsulan: [] as string[],
      ditetapkanPengguna: false,
    };
    const tetap = akun.isActive && akun.roleId !== "super-admin" ? ketetapanUntuk(akun) : undefined;

    if (akun.roleId === "super-admin") {
      baris.push({ ...dasarBaris, kelompok: "super-admin", sebab: "Super Admin tidak diubah oleh alat ini.", calon: [] });
      continue;
    }
    if (!akun.isActive) {
      baris.push({ ...dasarBaris, kelompok: "nonaktif", sebab: "Akun ALETA nonaktif - tidak ditautkan.", calon: [] });
      continue;
    }
    if (kred && kred.aktif) {
      const kunci = kunciUser(kred.username);
      const s = sippPerUsername.get(kunci);
      const pengklaim = klaimAktif.get(kunci)?.size ?? 0;
      const masalah = !s
        ? "Username SIPP tertaut tidak ditemukan di SIPP."
        : s.diblokir
          ? "Akun SIPP tertaut DIBLOKIR - akses ALETA ikut tertutup."
          : s.kedaluwarsa
            ? "Akun SIPP tertaut KEDALUWARSA - akses ALETA ikut tertutup."
            : pengklaim > 1
              ? `Username SIPP ini juga tersimpan di ${pengklaim - 1} akun ALETA lain.`
              : calonSippUntukAkun(akun, [s]).length > 0
                ? ""
                : namaSippSemua(s).some((n) => namaSama(akun.name, n))
                  ? "NIP pejabat pada akun SIPP tertaut BERBEDA dari NIP akun ALETA ini - periksa data pejabat di SIPP."
                  : `Nama akun SIPP tertaut (${s.namaLengkap || "-"}) tidak sama dengan nama akun ALETA ini - periksa apakah tautannya benar.`;
      const dikonfirmasi = Boolean(tetap && s && kunciUser(tetap.usernameSipp) === kunci && pengklaim <= 1);
      const calonTaut = s ? [calonDari(s, ["username"])] : [];
      const bersih = dikonfirmasi || !masalah;
      baris.push({
        ...dasarBaris,
        kelompok: "sudah",
        sebab: dikonfirmasi ? `Sudah bertaut - dikonfirmasi pengguna (${tetap?.catatan}).` : "Sudah bertaut.",
        masalah: dikonfirmasi ? "" : masalah,
        ditetapkanPengguna: dikonfirmasi,
        subPeranUsulan: bersih && calonTaut[0]?.aktif ? kurangi(calonTaut[0].subPeran, subPeranAda) : [],
        calon: calonTaut,
      });
      continue;
    }
    if (kred && !kred.aktif) {
      baris.push({
        ...dasarBaris,
        kelompok: "dicabut",
        sebab: "Tautan SIPP akun ini pernah dicabut/dinonaktifkan - ubah lewat Manajemen Akun bila memang perlu.",
        calon: [],
      });
      continue;
    }

    const calon = calonSippUntukAkun(akun, bahan.sipp);
    if (tetap) {
      const kunciTetap = kunciUser(tetap.usernameSipp);
      const diklaimLain = [...(klaimAktif.get(kunciTetap) ?? [])].some((id) => id !== akun.id);
      if (!diklaimLain) {
        const s = sippPerUsername.get(kunciTetap)!;
        const c = calon.find((x) => kunciUser(x.username) === kunciTetap) ?? calonDari(s, []);
        baris.push({
          ...dasarBaris,
          kelompok: "pasti",
          usernameSipp: s.username,
          sebab: `Ditetapkan pengguna (${tetap.catatan}).`,
          ditetapkanPengguna: true,
          subPeranUsulan: kurangi(c.subPeran, subPeranAda),
          calon: [c, ...calon.filter((x) => x !== c)],
        });
        continue;
      }
    }
    const aktif = calon.filter((c) => c.aktif);
    if (aktif.length === 0) {
      if (calon.length > 0) {
        baris.push({
          ...dasarBaris,
          kelompok: "sipp-nonaktif",
          sebab: `Cocok hanya ke ${calon.length} akun SIPP yang diblokir/kedaluwarsa.`,
          calon,
        });
        continue;
      }
      const mirip = calonMirip(akun, bahan.sipp);
      const miripAktif = mirip.filter((c) => c.aktif);
      if (miripAktif.length > 0) {
        baris.push({
          ...dasarBaris,
          kelompok: "ragu",
          sebab: `Tidak ada yang sama persis; ${miripAktif.length} akun SIPP aktif bernama MIRIP - periksa sebelum memilih.`,
          calon: mirip,
        });
      } else {
        baris.push({ ...dasarBaris, kelompok: "tanpa-padanan", sebab: "Tidak ada akun SIPP yang cocok.", calon: mirip });
      }
      continue;
    }

    let pilihan: CalonSipp | null = null;
    if (aktif.length === 1) pilihan = aktif[0];
    else {
      // Lebih dari satu akun SIPP aktif. Yang dikuatkan username/NIP menang
      // HANYA bila tunggal; selebihnya ganda.
      const kuat = aktif.filter((c) => c.dasar.includes("username") || c.dasar.includes("nip"));
      if (kuat.length === 1) pilihan = kuat[0];
    }
    if (!pilihan) {
      baris.push({
        ...dasarBaris,
        kelompok: "ganda",
        sebab: `Nama ini dipakai ${aktif.length} akun SIPP aktif (${aktif.map((c) => c.username).join(", ")}).`,
        calon,
      });
      continue;
    }

    const kunci = kunciUser(pilihan.username);
    const pengklaim = [...(klaimAktif.get(kunci) ?? [])].filter((id) => id !== akun.id);
    if (pengklaim.length > 0) {
      baris.push({
        ...dasarBaris,
        kelompok: "ganda",
        sebab: `Akun SIPP ${pilihan.username} sudah tertaut ke akun ALETA lain.`,
        calon,
      });
      continue;
    }
    if (pernahDicabut.has(kunci)) {
      baris.push({
        ...dasarBaris,
        kelompok: "ragu",
        sebab: `Tautan ke akun SIPP ${pilihan.username} pernah dicabut admin - tidak dihidupkan otomatis.`,
        calon,
      });
      continue;
    }
    baris.push({
      ...dasarBaris,
      kelompok: "pasti",
      usernameSipp: pilihan.username,
      sebab: `Cocok pasti lewat ${pilihan.dasar.join(" + ")}.`,
      subPeranUsulan: kurangi(pilihan.subPeran, subPeranAda),
      calon,
    });
  }

  // Satu akun SIPP AKTIF cocok (username/NIP/nama sama) ke lebih dari satu
  // akun ALETA yang belum bertaut -> baris pasti yang memakainya jadi ganda.
  const pemakai = new Map<string, BarisTautan[]>();
  for (const b of baris) {
    if (b.kelompok !== "pasti" && b.kelompok !== "ganda") continue;
    for (const c of b.calon) {
      if (!c.aktif || c.dasar.length === 0) continue;
      const k = kunciUser(c.username);
      pemakai.set(k, [...(pemakai.get(k) ?? []), b]);
    }
  }
  for (const b of baris) {
    if (b.kelompok !== "pasti" || b.ditetapkanPengguna) continue;
    const daftar = pemakai.get(kunciUser(b.usernameSipp)) ?? [];
    if (daftar.length < 2) continue;
    b.kelompok = "ganda";
    b.sebab = `Akun SIPP ${b.usernameSipp} cocok ke ${daftar.length} akun ALETA (${daftar.map((x) => x.nama).join(" / ")}).`;
    b.usernameSipp = "";
    b.subPeranUsulan = [];
  }

  // Petugas SIPP aktif yang belum punya akun ALETA.
  const tersentuh = new Set<string>();
  for (const k of klaimAktif.keys()) tersentuh.add(k);
  for (const b of baris) {
    if (b.usernameSipp) tersentuh.add(kunciUser(b.usernameSipp));
    if (b.kelompok === "ganda" || b.kelompok === "ragu") for (const c of b.calon) tersentuh.add(kunciUser(c.username));
  }
  const sippTanpaAkun: SippTanpaAkun[] = [];
  const sippAkunLain: SippAkunLain[] = [];
  const akunAktif = akunHidup.filter((a) => a.isActive);
  for (const s of bahan.sipp) {
    if (!s.username.trim() || s.diblokir || s.kedaluwarsa || tersentuh.has(kunciUser(s.username))) continue;
    // Orangnya SUDAH punya akun ALETA (nama/NIP sama) - ini akun SIPP
    // keduanya (mis. meja permohonan + meja gugatan), bukan pegawai baru.
    const pemilik = akunAktif.filter((a) => calonSippUntukAkun(a, [s]).length > 0);
    if (pemilik.length > 0) {
      sippAkunLain.push({
        username: s.username,
        sippUserId: s.sippUserId,
        namaLengkap: s.namaLengkap,
        grup: s.grup,
        pemilik: pemilik.map((a) => {
          const kred = bahan.kredensial.find((k) => k.userId === a.id && k.aktif && k.username.trim());
          return { id: a.id, name: a.name, usernameSipp: kred?.username.trim() ?? "" };
        }),
      });
      continue;
    }
    const kembar = bahan.sipp.filter(
      (x) => x.sippUserId !== s.sippUserId && x.username.trim() && namaSippSemua(x).some((n) => namaSama(n, s.namaLengkap))
    );
    const usernameDipakai = bahan.akun.filter((a) => kunciUser(a.username) === kunciUser(s.username));
    const nipTunggal = [...new Set(s.pejabat.map((p) => rapikanNip(p.nip)).filter(Boolean))];
    const dasar = {
      username: s.username,
      sippUserId: s.sippUserId,
      namaLengkap: s.namaLengkap,
      nip: nipTunggal.length === 1 ? nipTunggal[0] : "",
      grup: s.grup,
      usulan: usulanPeranDariGrup(s.grup, s.pejabat.map((p) => p.jabatan)),
      subPeran: subPeranDariSipp(s),
    };
    const tetapBaru = ketetapanSah.find((k) => kunciUser(k.usernameSipp) === kunciUser(s.username));
    if (usernameDipakai.length > 0) {
      sippTanpaAkun.push({
        ...dasar,
        kelompok: "bentrok",
        sebab: `Username "${s.username}" sudah dipakai akun ALETA lain (${usernameDipakai.map((a) => a.name).join(", ")}${usernameDipakai.some((a) => a.dihapus) ? ", termasuk yang dihapus" : ""}).`,
      });
    } else if (tetapBaru) {
      sippTanpaAkun.push({ ...dasar, kelompok: "buat", sebab: `Ditetapkan pengguna (${tetapBaru.catatan}) - dibuatkan akun bertautan.` });
    } else if (kembar.length > 0) {
      sippTanpaAkun.push({
        ...dasar,
        kelompok: "ganda",
        sebab: `Nama ini juga dipakai ${kembar.length} akun SIPP lain: ${kembar.map((x) => `${x.username} (${keadaanSipp(x)})`).join(", ")}.`,
      });
    } else if (!kunciNamaSemua(s.namaLengkap).size) {
      sippTanpaAkun.push({ ...dasar, kelompok: "ganda", sebab: "Nama lengkap SIPP terlalu pendek/kosong untuk dipastikan." });
    } else {
      sippTanpaAkun.push({ ...dasar, kelompok: "buat", sebab: "Belum punya akun ALETA - dapat dibuatkan akun bertautan." });
    }
  }
  sippTanpaAkun.sort((a, b) => a.namaLengkap.localeCompare(b.namaLengkap));
  sippAkunLain.sort((a, b) => a.namaLengkap.localeCompare(b.namaLengkap));

  // Nama ganda di SIPP (kunci nama lengkap yang sama).
  const perNamaSipp = new Map<string, PenggunaSippDaftar[]>();
  for (const s of bahan.sipp) {
    const k = kunciNama(s.namaLengkap);
    if (k.length < PANJANG_KUNCI_MINIMUM) continue;
    perNamaSipp.set(k, [...(perNamaSipp.get(k) ?? []), s]);
  }
  const namaGandaSipp: NamaGanda[] = [...perNamaSipp.values()]
    .filter((d) => d.length > 1)
    .map((d) => ({
      nama: d[0].namaLengkap,
      akun: d.map((s) => ({ username: s.username, namaLengkap: s.namaLengkap, keadaan: keadaanSipp(s) })),
      jumlahAktif: d.filter((s) => !s.diblokir && !s.kedaluwarsa).length,
    }))
    .sort((a, b) => b.jumlahAktif - a.jumlahAktif || a.nama.localeCompare(b.nama));

  const perNamaAleta = new Map<string, AkunAletaTautan[]>();
  for (const a of akunHidup.filter((x) => x.isActive)) {
    const k = kunciNama(a.name);
    if (k.length < PANJANG_KUNCI_MINIMUM) continue;
    perNamaAleta.set(k, [...(perNamaAleta.get(k) ?? []), a]);
  }
  const namaGandaAleta: NamaGandaAleta[] = [...perNamaAleta.values()]
    .filter((d) => d.length > 1)
    .map((d) => ({ nama: d[0].name, akun: d.map((a) => ({ id: a.id, name: a.name, username: a.username })) }));

  const hitung = Object.fromEntries(KELOMPOK.map((k) => [k, 0])) as Record<KelompokTautan, number>;
  for (const b of baris) hitung[b.kelompok] += 1;
  const urutan = new Map(KELOMPOK.map((k, i) => [k, i]));
  baris.sort((a, b) => (urutan.get(a.kelompok) ?? 0) - (urutan.get(b.kelompok) ?? 0) || a.nama.localeCompare(b.nama));

  return {
    baris,
    sippTanpaAkun,
    sippAkunLain,
    namaGandaSipp,
    namaGandaAleta,
    ringkasan: {
      ...hitung,
      akunAleta: akunHidup.length,
      akunSipp: bahan.sipp.length,
      akunSippAktif: bahan.sipp.filter((s) => !s.diblokir && !s.kedaluwarsa).length,
      sippTanpaAkun: sippTanpaAkun.length,
      sippBuat: sippTanpaAkun.filter((s) => s.kelompok === "buat").length,
      sippAkunLain: sippAkunLain.length,
      namaGandaSippAktif: namaGandaSipp.filter((n) => n.jumlahAktif > 1).length,
    },
  };
}

// ============================================================================
// PENYARING PILIHAN ADMIN (DIPAKAI ULANG SAAT MENERAPKAN)
// ============================================================================

export type PilihanTautan = { userId: string; usernameSipp: string };
export type PilihanDitolak = PilihanTautan & { sebab: string };

/**
 * Pilihan admin yang BOLEH diterapkan, diperiksa ulang atas pratinjau yang
 * disusun SAAT MENERAPKAN (bukan pratinjau yang dibawa peramban):
 *   - baris "pasti": hanya ke username SIPP pasti-nya;
 *   - baris "ganda"/"ragu": hanya ke salah satu calon AKTIF-nya, dan calon itu
 *     tidak tertaut ke akun ALETA lain;
 *   - selain itu (sudah, dicabut, nonaktif, super-admin, sipp-nonaktif,
 *     tanpa-padanan) ditolak;
 *   - satu username SIPP tidak boleh dipilih untuk dua akun sekaligus.
 */
export function saringPilihanTerapkan(
  pratinjau: PratinjauTautan,
  pilihan: PilihanTautan[],
  kredensial: KredensialTautan[]
): { diterima: PilihanTautan[]; ditolak: PilihanDitolak[] } {
  const perAkun = new Map(pratinjau.baris.map((b) => [b.userId, b]));
  const diterima: PilihanTautan[] = [];
  const ditolak: PilihanDitolak[] = [];
  const dipakai = new Map<string, number>();
  for (const p of pilihan) {
    const k = kunciUser(p.usernameSipp);
    if (k) dipakai.set(k, (dipakai.get(k) ?? 0) + 1);
  }
  const akunSudahPilih = new Set<string>();

  for (const p of pilihan) {
    const userId = String(p.userId ?? "");
    const usernameSipp = String(p.usernameSipp ?? "").trim();
    const kunci = kunciUser(usernameSipp);
    const b = perAkun.get(userId);
    const tolak = (sebab: string) => ditolak.push({ userId, usernameSipp, sebab });
    if (!b) {
      tolak("Akun ALETA tidak ada di pratinjau.");
      continue;
    }
    if (!kunci) {
      tolak("Username SIPP kosong.");
      continue;
    }
    if (akunSudahPilih.has(userId)) {
      tolak("Akun ALETA ini dipilih lebih dari sekali.");
      continue;
    }
    if ((dipakai.get(kunci) ?? 0) > 1) {
      tolak(`Akun SIPP ${usernameSipp} dipilih untuk lebih dari satu akun ALETA.`);
      continue;
    }
    if (b.kelompok === "pasti") {
      if (kunciUser(b.usernameSipp) !== kunci) {
        tolak("Username SIPP berbeda dari padanan pastinya.");
        continue;
      }
    } else if (b.kelompok === "ganda" || b.kelompok === "ragu") {
      const c = b.calon.find((x) => kunciUser(x.username) === kunci);
      if (!c) {
        tolak("Username SIPP bukan salah satu calon akun ini.");
        continue;
      }
      if (!c.aktif) {
        tolak(`Akun SIPP ${usernameSipp} ${c.keadaan}.`);
        continue;
      }
      if (kredensial.some((x) => x.aktif && x.userId !== userId && kunciUser(x.username) === kunci)) {
        tolak(`Akun SIPP ${usernameSipp} sudah tertaut ke akun ALETA lain.`);
        continue;
      }
    } else {
      tolak(`Baris berkelompok "${b.kelompok}" tidak ditautkan lewat alat ini.`);
      continue;
    }
    akunSudahPilih.add(userId);
    const resmi = b.kelompok === "pasti" ? b.usernameSipp : b.calon.find((x) => kunciUser(x.username) === kunci)?.username;
    diterima.push({ userId, usernameSipp: resmi ?? usernameSipp });
  }
  return { diterima, ditolak };
}

/**
 * Akun SIPP yang BOLEH dibuatkan akun ALETA baru, diperiksa ulang atas
 * pratinjau saat menerapkan: kelompok "buat", atau "ganda" yang dipilih admin
 * sendiri - dan dari satu nama hanya SATU akun per penerapan (satu orang,
 * satu akun ALETA). "bentrok" (username terpakai) selalu ditolak.
 */
export function saringBuatAkun(
  pratinjau: PratinjauTautan,
  usernameSipp: string[]
): { diterima: SippTanpaAkun[]; ditolak: Array<{ usernameSipp: string; sebab: string }> } {
  const perUsername = new Map(pratinjau.sippTanpaAkun.map((s) => [kunciUser(s.username), s]));
  const diterima: SippTanpaAkun[] = [];
  const ditolak: Array<{ usernameSipp: string; sebab: string }> = [];
  const sudah = new Set<string>();
  for (const mentah of usernameSipp) {
    const u = String(mentah ?? "").trim();
    const s = perUsername.get(kunciUser(u));
    if (!s) {
      ditolak.push({ usernameSipp: u, sebab: "Bukan petugas SIPP aktif tanpa akun ALETA di pratinjau." });
      continue;
    }
    if (sudah.has(kunciUser(u))) {
      ditolak.push({ usernameSipp: u, sebab: "Dipilih lebih dari sekali." });
      continue;
    }
    if (s.kelompok === "bentrok") {
      ditolak.push({ usernameSipp: u, sebab: s.sebab });
      continue;
    }
    if (diterima.some((d) => namaSama(d.namaLengkap, s.namaLengkap))) {
      ditolak.push({ usernameSipp: u, sebab: `Nama "${s.namaLengkap}" sudah dipilih untuk akun SIPP lain - satu orang satu akun ALETA.` });
      continue;
    }
    sudah.add(kunciUser(u));
    diterima.push(s);
  }
  return { diterima, ditolak };
}
