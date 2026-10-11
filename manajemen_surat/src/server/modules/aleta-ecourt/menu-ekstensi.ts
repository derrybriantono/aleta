import { modules, moduleVisibility } from "@/lib/mock-data";
import { MODUL_MILIK_APLIKASI, modulTampil } from "@/lib/matriks-peran";
import { type RoleId } from "@/lib/types";

/**
 * Pintasan panel ekstensi di halaman ALETA, disusun menurut jabatan.
 *
 * ============================================================================
 * PORTAL YANG MEMUTUSKAN, EKSTENSI YANG MENGGAMBAR
 * ============================================================================
 *
 * Daftarnya ditentukan di sini, bukan di berkas ekstensi. Ekstensi tertanam di
 * peramban orang dan diperbarui belakangan; aturan tentang siapa melihat apa
 * yang tinggal di sana akan berjalan dalam beberapa versi sekaligus. Portal
 * hanya satu.
 *
 * ============================================================================
 * PINTASAN, BUKAN KEWENANGAN
 * ============================================================================
 *
 * Yang dipilih di sini halaman yang PALING SERING dituju jabatan itu dari
 * SIPP - bukan seluruh halaman yang boleh dibukanya. Tiap pintasan tetap
 * disaring terhadap keterlihatan modul perannya, sehingga tidak pernah
 * menunjuk ke halaman yang akan menolaknya.
 */
export type PintasanEkstensi = { href: string; label: string; keterangan: string };

/** Alamat modul yang paling sering dituju tiap jabatan, urut menurut seringnya. */
const PINTASAN_PERAN: Record<string, string[]> = {
  "super-admin": [
    "/admin/aleta-ecourt",
    "/admin/pembaruan-sistem",
    "/aleta-sipp",
    "/perkara",
    "/aleta-ecourt",
    "/aleta-e-audit",
  ],
  admin: ["/admin/aleta-ecourt", "/admin/pembaruan-sistem", "/aleta-ecourt", "/perkara"],
  ketua: ["/aleta-sipp", "/perkara", "/aleta-e-audit", "/statistik"],
  "wakil-ketua": ["/aleta-sipp", "/perkara", "/statistik"],
  hakim: ["/perkara", "/bas", "/judicia/legal-form"],
  panitera: ["/aleta-sipp", "/aleta-ecourt", "/perkara", "/bas"],
  "panitera-muda": ["/aleta-ecourt", "/perkara", "/arsip"],
  "panitera-pengganti": ["/bas", "/perkara", "/aleta-ecourt"],
  // HAK-PERAN 12 Okt: Antrian (belum fix) & Ruang Kerja Perkara bukan untuk
  // juru sita menurut matriks - Jadwal Sidang e-Court (Cetak relaas) di depan.
  jurusita: ["/aleta-ecourt", "/aleta-antrian", "/perkara"],
  // Peran tambahan: hanya menambah papan penetapan, tempat Kerjakan berada.
  operator: ["/aleta-sipp"],
  bawaan: ["/manajemen-surat", "/tugas"],
};

/** Keterangan pendek per alamat - apa yang dikerjakan orang di sana. */
const KETERANGAN: Record<string, string> = {
  "/admin/aleta-ecourt": "kewenangan ekstensi dan pengaturan e-Court",
  "/admin/pembaruan-sistem": "versi, paket pembaruan, dan cadangan",
  "/aleta-sipp": "penetapan dan penunjukan perkara",
  "/perkara": "ruang kerja perkara",
  "/aleta-ecourt": "berkas e-Court dan ekstensi",
  "/aleta-e-audit": "penilaian e-Audit",
  "/statistik": "statistik perkara dan surat",
  "/bas": "berita acara sidang",
  "/judicia/legal-form": "naskah dan pustaka hukum",
  "/arsip": "arsip surat",
  "/aleta-antrian": "antrean dan panggilan",
  "/manajemen-surat": "dasbor surat",
  "/tugas": "tugas dan disposisi",
};

function bolehDilihat(roleId: RoleId, modulId: string, roleIds: RoleId[], href: string, additionalRoleIds: string[] = []) {
  if (roleId === "super-admin") return true;
  /* === HAK-PERAN 12 Okt === */
  // Modul milik aplikasi di matriks peran (ALETA x SIPP, e-Audit, Judicia,
  // Antrian, BAS, Ruang Kerja Perkara, ...) ikut matriks: pintasan ke
  // aplikasi belum fix tidak lagi ditawarkan kepada ketua/hakim/panitera.
  if (modulId in MODUL_MILIK_APLIKASI) return modulTampil({ roleId, additionalRoleIds }, modulId);
  /* === AKHIR HAK-PERAN === */
  // Dasbor dan tugas dimiliki setiap orang yang dapat masuk - termasuk peran
  // yang belum punya peta keterlihatan sama sekali. Menyaringnya berarti
  // panel yang kosong bagi orang yang justru paling perlu petunjuk.
  if (PINTASAN_PERAN.bawaan.includes(href)) return true;
  const terlihat = moduleVisibility.find((v) => v.roleId === roleId)?.modules as
    | Record<string, boolean>
    | undefined;
  if (terlihat && terlihat[modulId] === true) return true;
  return roleIds.includes(roleId);
}

export function susunMenuEkstensi(roleId: string, additionalRoleIds: string[] = []): PintasanEkstensi[] {
  const peran = roleId as RoleId;
  const alamat = [...(PINTASAN_PERAN[roleId] ?? PINTASAN_PERAN.bawaan)];
  for (const tambahan of additionalRoleIds) {
    if (tambahan === roleId) continue;
    for (const a of PINTASAN_PERAN[tambahan] ?? []) alamat.push(a);
  }

  const hasil: PintasanEkstensi[] = [];
  for (const href of alamat) {
    if (hasil.some((h) => h.href === href)) continue;
    const modul = modules.find((m) => m.href === href);
    if (!modul) continue;
    if (!bolehDilihat(peran, modul.id, modul.roleIds, href, additionalRoleIds)) continue;
    hasil.push({ href, label: modul.label, keterangan: KETERANGAN[href] ?? modul.description });
  }
  return hasil;
}

/** Untuk pengujian: seluruh alamat yang pernah disebut di peta pintasan. */
export const SEMUA_ALAMAT_PINTASAN = Array.from(new Set(Object.values(PINTASAN_PERAN).flat()));
