/**
 * ============================================================================
 * LIHAT SEBAGAI PENGGUNA/PERAN - PENJELASAN MENU (E4, admin 1 - 25 Okt 2026)
 * ============================================================================
 *
 * Fungsi murni (tanpa basis data) yang menjawab: "kenapa menu ini tidak tampil
 * bagi orang/peran ini?" Jawabannya datang dari DUA sumber yang sama dengan
 * yang menentukan tampilan sesungguhnya (aplikasiTampil di matriks-peran.ts):
 *
 *   1. Akses Menu per peran (module_visibility_settings: buka:/tutup:<id>);
 *   2. matriks hak bawaan per golongan (ATURAN_APLIKASI).
 *
 * Tidak ada aturan baru di sini. Uji menjaga bahwa `tampil` selalu sama dengan
 * aplikasiTampil - penjelasan tidak boleh berbeda dari kenyataan.
 */
import { getAccessiblePortalApps } from "@/lib/permissions";
import {
  LABEL_GOLONGAN,
  PETA_ATURAN_APLIKASI,
  golonganPengguna,
  timpaanAplikasi,
  type AksesMenuPeran,
  type GolonganPeran,
  type PenggunaGolongan,
} from "@/lib/matriks-peran";

/** Batas sesi Lihat sebagai, dan panjang alasan yang diminta. */
export const MASA_LIHAT_SEBAGAI_MENIT = 30;
export const ALASAN_LIHAT_MIN = 10;
export const ALASAN_LIHAT_MAKS = 300;

export type SebabMenu =
  | "super-admin"
  | "akses-menu-tutup"
  | "akses-menu-buka"
  | "belum-matang"
  | "hanya-super-admin"
  | "golongan-berhak"
  | "golongan-tidak-berhak"
  | "tidak-diatur-matriks"
  | "aturan-lama";

export type PenjelasanMenu = {
  appId: string;
  nama: string;
  tampil: boolean;
  sebab: SebabMenu;
  penjelasan: string;
  /** Golongan yang diberi hak oleh matriks (kosong bila tidak relevan). */
  golonganBerhak: string[];
};

type AplikasiRingkas = { id: string; label: string };

function namaGolongan(g: readonly GolonganPeran[]): string {
  return g.length ? g.map((x) => LABEL_GOLONGAN[x] ?? x).join(", ") : "tidak ada";
}

/**
 * Menjelaskan satu aplikasi bagi satu pengguna (atau satu peran tiruan).
 * `tampil` = hasil SESUNGGUHNYA (getAccessiblePortalApps) - penjelasan hanya
 * menyebut sebabnya dan tidak pernah menghitung ulang keputusannya.
 */
export function jelaskanAplikasi(pengguna: PenggunaGolongan, app: AplikasiRingkas, aksesMenu: AksesMenuPeran, tampil: boolean): PenjelasanMenu {
  const golongan = golonganPengguna(pengguna);
  const aturan = PETA_ATURAN_APLIKASI.get(app.id);
  const dasar = { appId: app.id, nama: app.label, tampil };
  const berhak = aturan ? (Object.keys(aturan.hak) as GolonganPeran[]) : [];
  const golonganBerhak = berhak.map((g) => LABEL_GOLONGAN[g] ?? g);

  if (golongan.includes("super-admin")) {
    return { ...dasar, sebab: "super-admin", penjelasan: "Super Admin selalu melihat semua aplikasi.", golonganBerhak };
  }
  if (!aturan) {
    return {
      ...dasar,
      sebab: "aturan-lama",
      penjelasan: tampil
        ? "Aplikasi ini memakai aturan lama: peran ini termasuk yang diizinkan dan Akses Menu membukanya."
        : "Aplikasi ini memakai aturan lama: tampil hanya bila peran termasuk yang diizinkan DAN Akses Menu per peran membukanya. Salah satunya tidak terpenuhi.",
      golonganBerhak: [],
    };
  }
  const timpaan = timpaanAplikasi(aksesMenu, app.id);
  if (timpaan === "tutup") {
    return { ...dasar, sebab: "akses-menu-tutup", penjelasan: "Ditutup oleh Super Admin di Akses Menu (Kontrol Akses) untuk peran ini, menimpa matriks bawaan.", golonganBerhak };
  }
  if (timpaan === "buka") {
    return { ...dasar, sebab: "akses-menu-buka", penjelasan: "Dibuka oleh Super Admin di Akses Menu untuk peran ini, menimpa matriks bawaan.", golonganBerhak };
  }
  if (aturan.status === "belum-fix") {
    return { ...dasar, sebab: "belum-matang", penjelasan: `Aplikasi belum matang, tertutup bagi semua peran kecuali Super Admin. ${aturan.alasan}`, golonganBerhak };
  }
  if (aturan.hanyaSuperAdmin) {
    return { ...dasar, sebab: "hanya-super-admin", penjelasan: `Hanya Super Admin (Admin pun tidak). ${aturan.alasan}`, golonganBerhak };
  }
  if (golongan.includes("admin")) {
    return { ...dasar, sebab: "golongan-berhak", penjelasan: "Admin melihat semua aplikasi yang sudah matang.", golonganBerhak };
  }
  if (tampil) {
    const cocok = golongan.filter((g) => aturan.hak[g]);
    return { ...dasar, sebab: "golongan-berhak", penjelasan: `Matriks hak memberi akses kepada golongan ${namaGolongan(cocok)}. ${aturan.alasan}`, golonganBerhak };
  }
  return {
    ...dasar,
    sebab: "golongan-tidak-berhak",
    penjelasan: `Golongan orang ini (${namaGolongan(golongan)}) tidak diberi hak oleh matriks. Yang diberi: ${namaGolongan(berhak)}. Untuk membukanya hanya bagi peran ini, gunakan Akses Menu. ${aturan.alasan}`,
    golonganBerhak,
  };
}

/**
 * Semua aplikasi sekaligus - dasar halaman "Kenapa menu ini tersembunyi?".
 * `tampil` tiap aplikasi diambil dari getAccessiblePortalApps, fungsi yang
 * sama dengan yang menggambar kisi aplikasi di portal.
 */
export function jelaskanSemuaAplikasi(
  pengguna: Parameters<typeof getAccessiblePortalApps>[0] & PenggunaGolongan,
  aplikasi: readonly AplikasiRingkas[],
  aksesMenu: { roleId: string; modules: Partial<Record<string, boolean>> } | null
): PenjelasanMenu[] {
  const terlihat = new Set<string>(
    getAccessiblePortalApps(pengguna, aksesMenu ? [{ roleId: aksesMenu.roleId, modules: aksesMenu.modules } as never] : []).map((a) => a.id)
  );
  return aplikasi.map((a) => jelaskanAplikasi(pengguna, a, aksesMenu, terlihat.has(a.id)));
}
