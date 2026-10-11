/**
 * ============================================================================
 * MASUK OTOMATIS DARI SIPP KE ALETA + TAUTAN AKUN LEWAT NAMA (11 Okt 2026)
 * ============================================================================
 *
 * Permintaan pengguna 11 Okt 2026: "perbaiki juga login yang otomatis dari
 * sipp ke aleta, disini aleta belum bisa deteksi akun sipp nya di aleta, coba
 * kamu samakan atau cocokkan dengan nama di sipp".
 *
 * SEBABNYA (ditelusuri 11 Okt, data server 9 Okt):
 *
 *   1. Tidak ada jalan dari SIPP ke ALETA sama sekali. Panel ekstensi di SIPP
 *      yang menerima 401 hanya menampilkan "Masuk ke ALETA" (susunAjakanMasuk)
 *      dan menunggu. Masuk dengan akun SIPP (7 Okt) hanya berjalan dari layar
 *      masuk ALETA, dan isi otomatisnya hanya ke arah ALETA -> SIPP/ABT.
 *   2. Pengenalan akun hanya lewat tautan Manajemen Akun (external_app_
 *      credentials app 'sipp'). Dari 42 akun ALETA aktif hanya 18 yang punya
 *      tautan; sisanya - walau namanya persis nama di SIPP - selalu "bukan
 *      SIPP", dan mengetik username + password SIPP di layar masuk ALETA
 *      gagal "password salah".
 *
 * PERBAIKANNYA - dua bukti identitas, satu aturan pemilih akun:
 *
 *   Bukti (siapa orangnya - TIDAK PERNAH dari nama):
 *     a. sesi SIPP: cookie ci_session yang dikirim peramban ke portal (satu
 *        host dengan SIPP) dibuka bot dengan kunci SIPP - HMAC, sandi,
 *        kedaluwarsa, user_agent, is_logged_in (bot: user.sesiSipp);
 *     b. password SIPP yang cocok dengan sidik sys_users (layar masuk ALETA,
 *        bot: user.verifikasiSandi - sudah ada sejak 7 Okt).
 *
 *   Pemilih akun ALETA (akun yang mana), berurutan:
 *     1. tautan Manajemen Akun (akunSippMilik/tentukanPemilikSipp) - yang
 *        sudah ditetapkan manusia selalu menang;
 *     2. NIP pejabat SIPP = NIP akun ALETA;
 *     3. NAMA SIPP (fullname + nama pejabat) = nama akun ALETA, sesudah
 *        gelar, tanda baca, dan ejaan dilipat (lib/nama-pegawai-sipp.ts).
 *     Yakin hanya bila TUNGGAL. Ganda/ragu = tidak masuk otomatis; panel
 *     menawarkan tautan manual.
 *
 *   Tautan yang dibuat dari nama/NIP DITULIS ke external_app_credentials
 *   (tanpa password, tautan_sumber = 'nama-sipp' | 'nip-sipp', migrasi 0062),
 *   dicatat di aleta_masuk_jejak, dan tampil di Manajemen Akun sebagai
 *   "perlu ditinjau" sampai Admin menyetujui atau mencabutnya. Sesudah itu
 *   seluruh fitur yang memakai tautan (Penetapan kembali, Court Calendar,
 *   checklist, masuk dengan akun SIPP) ikut mengenali pegawai itu.
 *
 * YANG TIDAK PERNAH DIOTOMATISKAN:
 *   - akun ALETA nonaktif/dihapus, akun SIPP diblokir/kedaluwarsa;
 *   - Super Admin lewat nama (hanya lewat tautan yang disetujui manusia);
 *   - akun ALETA yang SUDAH bertaut ke username SIPP lain (orangnya punya dua
 *     akun SIPP atau akun meja bersama - manusia yang memutuskan);
 *   - username SIPP yang sudah diklaim akun ALETA lain tanpa pemilik jelas.
 */

import {
  cocokkanPegawaiSipp,
  type AkunAletaCalon,
  type CocokNama,
  type PegawaiSipp,
} from "@/lib/nama-pegawai-sipp";
import { akunSippMilik } from "@/server/modules/aleta-ecourt/court-calendar-akun";
import { tentukanPemilikSipp, type KredensialSipp } from "@/server/modules/aleta-ecourt/checklist-milestone";

/** Identitas akun SIPP yang SUDAH terbukti (sesi atau password). */
export type IdentitasSippTerbukti = PegawaiSipp & { diblokir: boolean; kedaluwarsa: boolean };

export type SumberTautan = "nama-sipp" | "nip-sipp";

export type PilihanAkunAleta =
  | { jenis: "tautan"; userId: string }
  | { jenis: "baru"; userId: string; sumber: SumberTautan; namaSipp: string; namaAleta: string }
  | {
      jenis: "ragu";
      sebab:
        | "tidak_cocok"
        | "nama_ganda"
        | "username_diklaim_lain"
        | "sudah_bertaut_lain"
        | "super_admin_manual"
        | "tautan_dinonaktifkan";
      jumlahCalon: number;
    };

export type BahanPilih = {
  kredensial: KredensialSipp[];
  /** Seluruh akun ALETA yang belum dihapus (aktif maupun tidak). */
  akun: AkunAletaCalon[];
};

/**
 * Akun ALETA milik identitas SIPP ini. Murni - pemanggil yang membaca basis
 * data dan yang menulis tautan bila jawabannya "baru".
 */
export function pilihAkunAletaUntukSipp(identitas: PegawaiSipp, bahan: BahanPilih): PilihanAkunAleta {
  const kunci = identitas.username.trim().toLowerCase();
  const pemilik = tentukanPemilikSipp(bahan.kredensial);

  // 1. Tautan yang ditetapkan manusia.
  const klaim = pemilik.get(kunci);
  if (klaim) {
    if (klaim.pemilik) {
      const milik = akunSippMilik(bahan.kredensial, klaim.pemilik);
      if (milik.some((x) => x.trim().toLowerCase() === kunci)) return { jenis: "tautan", userId: klaim.pemilik };
    }
    return { jenis: "ragu", sebab: "username_diklaim_lain", jumlahCalon: klaim.pengklaim.length };
  }
  // Disimpan tetapi DINONAKTIFKAN (oleh Admin): jangan dihidupkan lagi lewat nama.
  if (bahan.kredensial.some((k) => k.username.trim().toLowerCase() === kunci && !k.aktif)) {
    return { jenis: "ragu", sebab: "tautan_dinonaktifkan", jumlahCalon: 0 };
  }

  // 2-3. NIP / nama.
  const hasil: CocokNama = cocokkanPegawaiSipp(identitas, bahan.akun);
  if (hasil.jenis === "tidak-cocok") return { jenis: "ragu", sebab: "tidak_cocok", jumlahCalon: 0 };
  if (hasil.jenis === "ganda") return { jenis: "ragu", sebab: "nama_ganda", jumlahCalon: hasil.calon.length };

  const akun = bahan.akun.find((a) => a.id === hasil.userId);
  if (!akun) return { jenis: "ragu", sebab: "tidak_cocok", jumlahCalon: 0 };
  if (akun.roleId === "super-admin") return { jenis: "ragu", sebab: "super_admin_manual", jumlahCalon: 1 };
  // Akun ALETA ini sudah menyimpan username SIPP LAIN (aktif atau tidak):
  // satu baris per pengguna per aplikasi, dan manusialah yang memilih.
  if (bahan.kredensial.some((k) => k.userId === akun.id && k.username.trim())) {
    return { jenis: "ragu", sebab: "sudah_bertaut_lain", jumlahCalon: 1 };
  }
  return {
    jenis: "baru",
    userId: akun.id,
    sumber: hasil.dasar === "nip" ? "nip-sipp" : "nama-sipp",
    namaSipp: hasil.namaSipp,
    namaAleta: hasil.namaAleta,
  };
}

/** Kalimat untuk petugas - tanpa menyebut nama akun orang lain. */
export function kalimatRagu(sebab: Extract<PilihanAkunAleta, { jenis: "ragu" }>["sebab"], jumlahCalon: number): string {
  switch (sebab) {
    case "nama_ganda":
      return `Nama Anda di SIPP sama dengan ${jumlahCalon} akun ALETA, sehingga ALETA tidak memilihkannya. Masuk ALETA dengan akun Anda sekali, lalu tautkan akun SIPP ini - atau minta Admin menautkannya di Manajemen Akun.`;
    case "username_diklaim_lain":
      return "Akun SIPP ini tersimpan di lebih dari satu akun ALETA tanpa pemilik yang jelas. Admin perlu merapikannya di Manajemen Akun.";
    case "sudah_bertaut_lain":
      return "Akun ALETA yang namanya sama sudah tertaut ke akun SIPP lain. Masuk ALETA dengan akun Anda, lalu tautkan akun SIPP ini bila memang milik Anda.";
    case "super_admin_manual":
      return "Akun Super Admin tidak ditautkan otomatis lewat nama. Masuk ALETA dengan password Anda, lalu tautkan akun SIPP ini.";
    case "tautan_dinonaktifkan":
      return "Tautan akun SIPP ini dinonaktifkan di Manajemen Akun. Hubungi Admin ALETA.";
    default:
      return "ALETA belum menemukan akun ALETA yang namanya sama dengan nama Anda di SIPP. Masuk ALETA dengan akun Anda sekali, lalu tautkan akun SIPP ini - atau minta Admin menautkannya.";
  }
}

// ============================================================================
// KEPUTUSAN MASUK DARI SESI SIPP
// ============================================================================

export type JawabanSesiSipp =
  | { ok: false; error?: string }
  | {
      ok: true;
      data?: {
        terbukti?: boolean;
        sebab?: string;
        sippUserId?: string;
        username?: string;
        namaLengkap?: string;
        diblokir?: boolean;
        kedaluwarsa?: boolean;
        pejabat?: Array<{ jabatan?: string; nama?: string; nip?: string }>;
      };
    };

export type BarisJejakSesi = {
  aletaUserId: string | null;
  usernameSipp: string;
  sippUserId: string;
  hasil: "berhasil" | "ditolak" | "dibatasi";
  alasan: string;
};

export type DepsMasukSesi = {
  periksaSesi: () => Promise<JawabanSesiSipp>;
  bacaBahan: () => Promise<BahanPilih>;
  /** Menulis tautan tanpa password; false bila gagal (mis. baris sudah ada). */
  tulisTautan: (p: { userId: string; usernameSipp: string; sumber: SumberTautan }) => Promise<boolean>;
  catatJejak: (baris: BarisJejakSesi) => Promise<void>;
};

export type KeputusanSesi =
  | { jenis: "dimatikan" }
  | { jenis: "tanpa-sesi"; sebab: string }
  | { jenis: "tak-terjangkau"; pesan: string }
  | { jenis: "tolak"; status: 403; kode: string; pesan: string }
  | { jenis: "ragu"; sebab: string; pesan: string; usernameSipp: string }
  | { jenis: "masuk"; userId: string; usernameSipp: string; sippUserId: string; tautanBaru: SumberTautan | null };

export function masukSesiSippDinyalakan(env: Record<string, string | undefined> = process.env) {
  const mati = (nilai: string | undefined) => ["0", "false", "mati", "off"].includes(String(nilai ?? "").trim().toLowerCase());
  return !mati(env.ALETA_MASUK_SIPP) && !mati(env.ALETA_MASUK_SESI_SIPP);
}

/**
 * Nilai cookie ci_session SIPP dari kepala Cookie permintaan ke portal (portal
 * dan SIPP satu host; cookie SIPP ber-path "/" ikut terkirim). Lebih dari satu
 * bila ada beberapa path. Nilainya diteruskan apa adanya ke bot - tidak
 * pernah dicatat atau disimpan.
 */
export function nilaiCookieSesiSipp(kepalaCookie: string, nama = "ci_session"): string[] {
  const hasil: string[] = [];
  for (const potong of String(kepalaCookie ?? "").split(";")) {
    const sama = potong.indexOf("=");
    if (sama < 0 || potong.slice(0, sama).trim() !== nama) continue;
    const isi = potong.slice(sama + 1).trim();
    if (isi && isi.length <= 16384) hasil.push(isi);
  }
  return hasil.slice(0, 4);
}

/** Sebab penolakan sesi yang menandakan cookie palsu/rusak (bukan sekadar belum masuk). */
const SEBAB_MENCURIGAKAN = new Set(["tanda_tidak_sah", "sandi_tidak_terbuka", "isi_sesi_rusak", "cookie_rusak", "peramban_berbeda"]);

export function sebabSesiMencurigakan(sebab: string) {
  return SEBAB_MENCURIGAKAN.has(sebab);
}

export function identitasDariJawaban(data: NonNullable<Extract<JawabanSesiSipp, { ok: true }>["data"]>): IdentitasSippTerbukti {
  return {
    sippUserId: String(data.sippUserId ?? ""),
    username: String(data.username ?? "").trim(),
    namaLengkap: String(data.namaLengkap ?? ""),
    pejabat: (Array.isArray(data.pejabat) ? data.pejabat : []).map((p) => ({
      jabatan: String(p?.jabatan ?? ""),
      nama: String(p?.nama ?? ""),
      nip: String(p?.nip ?? ""),
    })),
    diblokir: data.diblokir === true,
    kedaluwarsa: data.kedaluwarsa === true,
  };
}

/**
 * Akun ALETA untuk identitas SIPP yang sudah terbukti, termasuk menulis
 * tautan baru bila dipilih lewat NIP/nama. Dipakai jalur sesi (panel SIPP)
 * DAN jalur password SIPP di layar masuk ALETA.
 */
export async function akunAletaUntukIdentitas(
  deps: Pick<DepsMasukSesi, "bacaBahan" | "tulisTautan">,
  identitas: IdentitasSippTerbukti
): Promise<
  | { ok: true; userId: string; tautanBaru: SumberTautan | null }
  | { ok: false; sebab: string; pesan: string }
> {
  const bahan = await deps.bacaBahan();
  const pilihan = pilihAkunAletaUntukSipp(identitas, bahan);
  if (pilihan.jenis === "ragu") return { ok: false, sebab: pilihan.sebab, pesan: kalimatRagu(pilihan.sebab, pilihan.jumlahCalon) };

  const akun = bahan.akun.find((a) => a.id === pilihan.userId);
  if (!akun || !akun.isActive) {
    return { ok: false, sebab: "akun_aleta_nonaktif", pesan: "Akun ALETA Anda sedang dinonaktifkan. Hubungi Admin ALETA." };
  }
  if (pilihan.jenis === "baru") {
    const tertulis = await deps.tulisTautan({ userId: akun.id, usernameSipp: identitas.username, sumber: pilihan.sumber });
    if (!tertulis) {
      return { ok: false, sebab: "tautan_gagal_ditulis", pesan: "Tautan akun SIPP belum dapat disimpan. Coba lagi sebentar lagi." };
    }
    return { ok: true, userId: akun.id, tautanBaru: pilihan.sumber };
  }
  return { ok: true, userId: akun.id, tautanBaru: null };
}

export async function putuskanMasukDariSesiSipp(
  deps: DepsMasukSesi,
  env: Record<string, string | undefined> = process.env
): Promise<KeputusanSesi> {
  if (!masukSesiSippDinyalakan(env)) return { jenis: "dimatikan" };

  const jawaban = await deps.periksaSesi();
  if (!jawaban.ok) {
    return { jenis: "tak-terjangkau", pesan: "SIPP belum dapat dihubungi untuk memastikan sesi Anda. Masuk ALETA seperti biasa." };
  }
  const data = jawaban.data ?? {};
  if (!data.terbukti) {
    const sebab = String(data.sebab ?? "tanpa_sesi");
    if (sebabSesiMencurigakan(sebab)) {
      await deps.catatJejak({ aletaUserId: null, usernameSipp: "", sippUserId: "", hasil: "ditolak", alasan: `sesi_sipp_${sebab}` });
    }
    return { jenis: "tanpa-sesi", sebab };
  }

  const identitas = identitasDariJawaban(data);
  if (!identitas.username || !identitas.sippUserId) return { jenis: "tanpa-sesi", sebab: "akun_sipp_tidak_ada" };

  if (identitas.diblokir || identitas.kedaluwarsa) {
    const sebab = identitas.diblokir ? "sipp_diblokir" : "sipp_kedaluwarsa";
    await deps.catatJejak({
      aletaUserId: null,
      usernameSipp: identitas.username,
      sippUserId: identitas.sippUserId,
      hasil: "ditolak",
      alasan: `sesi_${sebab}`,
    });
    return {
      jenis: "tolak",
      status: 403,
      kode: "SIPP_NONAKTIF",
      pesan: identitas.diblokir
        ? "Akun SIPP Anda sedang diblokir, sehingga ALETA tidak membukakan akses. Hubungi admin SIPP."
        : "Masa berlaku akun SIPP Anda sudah habis, sehingga ALETA tidak membukakan akses. Hubungi admin SIPP.",
    };
  }

  const akun = await akunAletaUntukIdentitas(deps, identitas);
  if (!akun.ok) {
    await deps.catatJejak({
      aletaUserId: null,
      usernameSipp: identitas.username,
      sippUserId: identitas.sippUserId,
      hasil: "ditolak",
      alasan: `sesi_${akun.sebab}`,
    });
    return { jenis: "ragu", sebab: akun.sebab, pesan: akun.pesan, usernameSipp: identitas.username };
  }

  await deps.catatJejak({
    aletaUserId: akun.userId,
    usernameSipp: identitas.username,
    sippUserId: identitas.sippUserId,
    hasil: "berhasil",
    alasan: akun.tautanBaru ? `sesi_sipp_tautan_${akun.tautanBaru === "nip-sipp" ? "nip" : "nama"}` : "sesi_sipp",
  });
  return {
    jenis: "masuk",
    userId: akun.userId,
    usernameSipp: identitas.username,
    sippUserId: identitas.sippUserId,
    tautanBaru: akun.tautanBaru,
  };
}

// ============================================================================
// TAUTKAN MANUAL: AKUN ALETA YANG SEDANG MASUK + SESI SIPP YANG TERBUKTI
// ============================================================================

export type KeputusanTautkan =
  | { jenis: "tertaut"; usernameSipp: string }
  | { jenis: "sudah"; usernameSipp: string }
  | { jenis: "tolak"; sebab: string; pesan: string };

/**
 * Pegawai yang sedang masuk ALETA (akun X) DAN sedang masuk SIPP (akun U,
 * terbukti lewat cookie) menautkan U ke X dengan satu tekanan. Dua sesi yang
 * terbukti bersamaan di satu peramban = orang yang sama memegang keduanya.
 * Tidak menimpa tautan siapa pun.
 */
export async function putuskanTautkanSesiSipp(
  deps: Pick<DepsMasukSesi, "periksaSesi" | "bacaBahan" | "catatJejak"> & {
    tulisTautanManual: (p: { userId: string; usernameSipp: string }) => Promise<boolean>;
  },
  aktor: { id: string }
): Promise<KeputusanTautkan> {
  const jawaban = await deps.periksaSesi();
  if (!jawaban.ok) return { jenis: "tolak", sebab: "tak_terjangkau", pesan: "SIPP belum dapat dihubungi. Coba lagi sebentar lagi." };
  const data = jawaban.data ?? {};
  if (!data.terbukti) {
    return { jenis: "tolak", sebab: String(data.sebab ?? "tanpa_sesi"), pesan: "Sesi SIPP di peramban ini tidak terbaca. Masuk SIPP lebih dulu di peramban ini." };
  }
  const identitas = identitasDariJawaban(data);
  if (identitas.diblokir || identitas.kedaluwarsa) {
    return { jenis: "tolak", sebab: "sipp_nonaktif", pesan: "Akun SIPP ini diblokir atau sudah habis masa berlakunya." };
  }
  const kunci = identitas.username.toLowerCase();
  const bahan = await deps.bacaBahan();
  const milikSaya = akunSippMilik(bahan.kredensial, aktor.id);
  if (milikSaya.some((x) => x.toLowerCase() === kunci)) return { jenis: "sudah", usernameSipp: identitas.username };

  const klaimLain = bahan.kredensial.filter((k) => k.username.trim().toLowerCase() === kunci && k.userId !== aktor.id && k.aktif);
  if (klaimLain.length > 0) {
    return { jenis: "tolak", sebab: "username_diklaim_lain", pesan: "Akun SIPP ini sudah tertaut ke akun ALETA lain. Admin perlu memeriksanya di Manajemen Akun." };
  }
  if (bahan.kredensial.some((k) => k.userId === aktor.id && k.username.trim() && k.username.trim().toLowerCase() !== kunci)) {
    return { jenis: "tolak", sebab: "sudah_bertaut_lain", pesan: "Akun ALETA Anda sudah tertaut ke akun SIPP lain. Ubah di Manajemen Akun bila memang perlu diganti." };
  }
  const tertulis = await deps.tulisTautanManual({ userId: aktor.id, usernameSipp: identitas.username });
  if (!tertulis) return { jenis: "tolak", sebab: "tautan_gagal_ditulis", pesan: "Tautan belum dapat disimpan. Coba lagi." };
  await deps.catatJejak({
    aletaUserId: aktor.id,
    usernameSipp: identitas.username,
    sippUserId: identitas.sippUserId,
    hasil: "berhasil",
    alasan: "tautan_manual_sesi_sipp",
  });
  return { jenis: "tertaut", usernameSipp: identitas.username };
}
