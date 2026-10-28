/**
 * Akun PTSP untuk pemilih "Lihat sebagai" di Blangko ABT by Derry Briantono (28 Okt 2026).
 *
 * Daftar hakim / panitera pengganti / juru sita diambil dari nama petugas di jadwal sidang; petugas PTSP (meja pendaftaran)
 * tidak pernah tertulis di jadwal, jadi daftarnya diambil dari akun ALETA yang golongannya PTSP (jabatan PTSP, Operator, sub-peran
 * Petugas PTSP, atau Petugas Meja 1 - aturan golonganPengguna di matriks-peran). Murni: tanpa jaringan dan tanpa basis data.
 *
 * Yang tidak ditawarkan: akun nonaktif/terhapus, dan Super Admin/Admin (mereka sudah bisa memilih "Semua akun"; menirukan dirinya
 * sendiri tak berguna). Satu orang satu entri (ejaan gelar berbeda disatukan seperti pemilih lain).
 */
import { satukanOrang } from "@/lib/orang-unik";
import { golonganPengguna, type PenggunaGolongan } from "@/lib/matriks-peran";

export type PenggunaAkunPtsp = PenggunaGolongan & { name?: string | null; isActive?: unknown; deletedAt?: unknown };

const aktif = (v: unknown): boolean => v === undefined || v === null || v === true || v === 1 || v === "1" || v === "true" || v === "Y";

export function namaAkunPtsp(pengguna: readonly PenggunaAkunPtsp[]): string[] {
  const nama: string[] = [];
  for (const p of Array.isArray(pengguna) ? pengguna : []) {
    if (!p || !String(p.name ?? "").trim()) continue;
    if (!aktif(p.isActive) || (p.deletedAt !== undefined && p.deletedAt !== null && String(p.deletedAt) !== "")) continue;
    const golongan = golonganPengguna(p);
    if (!golongan.includes("ptsp")) continue;
    if (golongan.includes("super-admin") || golongan.includes("admin")) continue;
    nama.push(String(p.name));
  }
  return satukanOrang(nama).map((o) => o.nama);
}
