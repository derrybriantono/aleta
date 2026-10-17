/**
 * ============================================================================
 * SUPER ADMIN GLOBAL - ATURAN MURNI (banyak satker, Tahap 0)
 * ============================================================================
 *
 * Keputusan pengguna:
 *   - Super admin GLOBAL hanya Derry (pengembang). Tidak ada super admin lokal
 *     di satker lain yang setara.
 *   - Ia dapat masuk ke ALETA satker mana pun sebagai super admin dan mengubah
 *     data tanpa persetujuan admin satker itu.
 *   - Setiap akses WAJIB tercatat (jejak audit) dan DIBERITAHUKAN ke admin
 *     satker (pemberitahuan portal). Tidak ada pintu belakang tersembunyi.
 *
 * ============================================================================
 * PENANDA = KONFIGURASI SERVER, BUKAN DATA YANG BISA DIUBAH LEWAT PORTAL
 * ============================================================================
 *
 * Akun global ditandai di env ALETA_SUPER_ADMIN_GLOBAL (daftar username atau id
 * akun, dipisah koma) milik operator server. Sengaja BUKAN kolom/pengaturan yang
 * dapat disunting dari layar admin: admin satker yang dapat menandai dirinya
 * sendiri "global" akan mengubah jejak ini menjadi hiasan. Mengubahnya butuh
 * akses server - yang di satker mana pun memang di luar kendali portal.
 *
 * Penanda saja tidak memberi kekuasaan baru: akun tetap memakai peran
 * super-admin miliknya. Yang diberikan penanda adalah KEWAJIBAN JEJAK: sesi
 * pertama yang terlihat dari akun itu langsung dicatat dan diberitahukan
 * (server/modules/satker/akses-global.ts), dan bila jejaknya gagal ditulis,
 * sesinya DITOLAK (gagal ke sisi tertutup - lawan dari fitur, yang gagal ke
 * sisi menyala).
 */

export const AKSI_AKSES_GLOBAL = "AKSES_SUPER_ADMIN_GLOBAL";
export const JENIS_ENTITAS_AKSES_GLOBAL = "super_admin_global";
export const PERAN_SUPER_ADMIN = "super-admin";

export type CaraAksesGlobal = "sesi-langsung" | "tiket-pusat";

/** Daftar penanda dari nilai env (huruf kecil, unik, paling banyak 20). */
export function daftarPenandaGlobal(nilaiEnv: string | undefined | null): string[] {
  const unik = new Set(
    String(nilaiEnv ?? "")
      .split(/[,;\s]+/)
      .map((x) => x.trim().toLowerCase())
      .filter((x) => /^[\w.:@-]{1,80}$/.test(x))
  );
  return [...unik].slice(0, 20);
}

export type AkunUntukPenanda = { id?: unknown; username?: unknown; roleId?: unknown; isActive?: unknown };

/** Akun ini ditandai global DAN berperan super-admin dan aktif? */
export function adalahSuperAdminGlobal(penanda: readonly string[], akun: AkunUntukPenanda | null | undefined): boolean {
  if (!akun || !penanda.length) return false;
  if (String(akun.roleId ?? "") !== PERAN_SUPER_ADMIN) return false;
  if (akun.isActive !== undefined && Number(akun.isActive) === 0) return false;
  const id = String(akun.id ?? "").toLowerCase();
  const nama = String(akun.username ?? "").toLowerCase();
  return penanda.includes(id) || (nama !== "" && penanda.includes(nama));
}

export type CatatanAksesGlobal = {
  sesiId: string;
  akunId: string;
  username: string;
  nama: string;
  kodeSatker: string;
  cara: CaraAksesGlobal;
  alamatIp: string;
  agenPengguna: string;
  waktu: string;
};

/** Isi payload jejak audit - tanpa sandi/token apa pun (sesiId dicatat sebagai entityId, bukan token sesi). */
export function bentukPayloadAkses(c: CatatanAksesGlobal) {
  return {
    username: c.username,
    nama: c.nama,
    kodeSatker: c.kodeSatker,
    cara: c.cara,
    alamatIp: c.alamatIp,
    agenPengguna: c.agenPengguna.slice(0, 200),
    waktu: c.waktu,
    pemberitahuan: "admin-satker",
  };
}

/** Kalimat pemberitahuan untuk admin satker. */
export function kalimatPemberitahuan(c: { nama: string; username: string; alamatIp: string; cara: CaraAksesGlobal }): { judul: string; uraian: string } {
  const lewat = c.cara === "tiket-pusat" ? "melalui tiket ALETA Pusat" : "dengan akunnya";
  return {
    judul: "Super admin global masuk ke ALETA satker ini",
    uraian: `${c.nama || c.username} (super admin global) masuk ${lewat}${c.alamatIp ? ` dari ${c.alamatIp}` : ""}. Akses ini tercatat di Jejak Audit.`,
  };
}

/** Berapa hari pemberitahuan akses masih ditampilkan di daftar tugas admin. */
export const HARI_TAMPIL_PEMBERITAHUAN = 30;
export const BATAS_PEMBERITAHUAN_AKSES = 10;
