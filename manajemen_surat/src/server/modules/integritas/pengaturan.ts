import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { AletaDatabase } from "@/server/db/client";
import { bacaSetelanJson, simpanSetelanSistem } from "@/server/modules/kesehatan/setelan";
import { FOLDER_UNGGAHAN_BAWAAN } from "@/server/modules/integritas/aturan";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * PENGATURAN PENJAGA INTEGRITAS BERKAS (E6, 25 Okt 2026)
 * ============================================================================
 *
 * MATI bawaan: tanpa pengaturan tidak ada folder yang dibaca dan tidak ada
 * pesan yang dikirim. Folder yang didaftarkan Super Admin HANYA DIBACA.
 * Folder harus tampak dari server ALETA (di Docker: mount baca-saja, mis.
 * "/mnt/website:ro"); ALETA tidak menyentuh server lain.
 *
 * Tersimpan di aleta_ekstensi_setelan (*sistem*, tanpa migrasi).
 */
export const KUNCI_INTEGRITAS = "integritas:pengaturan";
export const MAKS_FOLDER = 10;
export const MAKS_HALAMAN = 20;
export const SELANG_MIN_MENIT = 15;
export const SELANG_MAKS_MENIT = 1440;
export const SELANG_BAWAAN_MENIT = 360;

export type JenisFolder = "website" | "sipp" | "abt" | "lain";
export const JENIS_FOLDER: readonly JenisFolder[] = ["website", "sipp", "abt", "lain"];

export type FolderIntegritas = {
  id: string;
  nama: string;
  jalur: string;
  jenis: JenisFolder;
  /** Nama folder unggahan (relatif terhadap akar folder) tempat berkas PHP tidak boleh ada. */
  unggahan: string[];
};

export type PengaturanIntegritas = {
  aktif: boolean;
  folder: FolderIntegritas[];
  /** Alamat halaman publik website yang diperiksa kata judolnya (http/https saja). */
  halamanPublik: string[];
  selangMenit: number;
  peringatanWa: boolean;
  /** Nama folder yang dilewati di mana pun (mis. .git). */
  lewati: string[];
  diubahOleh: string;
  diubahPada: string;
};

export const LEWATI_BAWAAN: readonly string[] = [".git", "node_modules", ".svn"];

export const PENGATURAN_INTEGRITAS_BAWAAN: PengaturanIntegritas = {
  aktif: false,
  folder: [],
  halamanPublik: [],
  selangMenit: SELANG_BAWAAN_MENIT,
  peringatanWa: true,
  lewati: [...LEWATI_BAWAAN],
  diubahOleh: "",
  diubahPada: "",
};

/** Akar yang tidak pernah boleh didaftarkan: terlalu luas atau milik sistem. */
const AKAR_DILARANG = ["/", "/bin", "/boot", "/dev", "/etc", "/lib", "/lib64", "/proc", "/root", "/run", "/sbin", "/sys", "/usr", "/var", "/home", "/mnt", "/opt", "/tmp"];

export function normalisasiJalur(j: string): string {
  const t = String(j ?? "").trim().replace(/\\/g, "/");
  return t.length > 1 ? t.replace(/\/+$/, "") : t;
}

/** Jalur absolut yang masuk akal: bukan akar disk/sistem, tanpa ".." dan karakter kontrol. */
export function jalurFolderSah(j: string): boolean {
  const t = normalisasiJalur(j);
  if (!t || t.length > 300 || /[\0-\x1f]/.test(t)) return false;
  if (t.split("/").includes("..")) return false;
  const mutlak = t.startsWith("/") || /^[a-zA-Z]:\//.test(t);
  if (!mutlak) return false;
  if (/^[a-zA-Z]:$/.test(t) || /^[a-zA-Z]:\/$/.test(t)) return false;
  if (AKAR_DILARANG.includes(t.toLowerCase())) return false;
  return true;
}

export function urlHalamanSah(u: string): boolean {
  try {
    const x = new URL(String(u ?? "").trim());
    if (x.protocol !== "http:" && x.protocol !== "https:") return false;
    if (x.username || x.password) return false;
    // Bukan alamat metadata awan/tautan-lokal.
    if (/^169\.254\./.test(x.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

function bersihkanUnggahan(x: unknown): string[] {
  const daftar = Array.isArray(x) ? x : [...FOLDER_UNGGAHAN_BAWAAN];
  const hasil = daftar
    .map((u) => String(u ?? "").trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, ""))
    .filter((u) => u && u.length <= 80 && !u.split("/").includes("..") && !/[\0-\x1f]/.test(u));
  return Array.from(new Set(hasil)).slice(0, 40);
}

function bersihkanFolder(x: unknown): FolderIntegritas | null {
  if (!x || typeof x !== "object") return null;
  const f = x as Record<string, unknown>;
  const jalur = normalisasiJalur(String(f.jalur ?? ""));
  if (!jalurFolderSah(jalur)) return null;
  const id = String(f.id ?? "").trim();
  return {
    id: /^[a-z0-9-]{3,40}$/.test(id) ? id : `f-${crypto.randomBytes(4).toString("hex")}`,
    nama: String(f.nama ?? "").replace(/[<>]/g, "").trim().slice(0, 80) || jalur.split("/").pop() || "Folder",
    jalur,
    jenis: (JENIS_FOLDER as readonly unknown[]).includes(f.jenis) ? (f.jenis as JenisFolder) : "website",
    unggahan: bersihkanUnggahan(f.unggahan),
  };
}

export function bersihkanPengaturanIntegritas(masukan: unknown): PengaturanIntegritas {
  const x = masukan && typeof masukan === "object" ? (masukan as Record<string, unknown>) : {};
  const folder: FolderIntegritas[] = [];
  const dipakai = new Set<string>();
  for (const mentah of Array.isArray(x.folder) ? x.folder : []) {
    const f = bersihkanFolder(mentah);
    if (!f || dipakai.has(f.id)) continue;
    dipakai.add(f.id);
    folder.push(f);
    if (folder.length >= MAKS_FOLDER) break;
  }
  const selang = Number(x.selangMenit);
  return {
    aktif: x.aktif === true,
    folder,
    halamanPublik: Array.from(new Set((Array.isArray(x.halamanPublik) ? x.halamanPublik : []).map((u) => String(u ?? "").trim()).filter(urlHalamanSah))).slice(0, MAKS_HALAMAN),
    selangMenit: Number.isInteger(selang) && selang >= SELANG_MIN_MENIT && selang <= SELANG_MAKS_MENIT ? selang : SELANG_BAWAAN_MENIT,
    peringatanWa: x.peringatanWa !== false,
    lewati: Array.from(new Set((Array.isArray(x.lewati) ? x.lewati : [...LEWATI_BAWAAN]).map((s) => String(s ?? "").trim()).filter((s) => s && !s.includes("/") && s.length <= 60))).slice(0, 30),
    diubahOleh: String(x.diubahOleh ?? "").slice(0, 120),
    diubahPada: String(x.diubahPada ?? "").slice(0, 40),
  };
}

/** Penolakan tegas (bukan membuang diam-diam) atas masukan Super Admin, termasuk folder yang tak terbaca dari server ini. */
export async function periksaMasukanIntegritas(masukan: unknown, { cekFolder = true }: { cekFolder?: boolean } = {}) {
  const x = masukan && typeof masukan === "object" ? (masukan as Record<string, unknown>) : null;
  if (!x) throw new ApiError(400, "Pengaturan penjaga integritas tidak sah.");
  if (x.folder !== undefined) {
    if (!Array.isArray(x.folder)) throw new ApiError(400, "Daftar folder harus berupa daftar.");
    if (x.folder.length > MAKS_FOLDER) throw new ApiError(400, `Paling banyak ${MAKS_FOLDER} folder.`);
    for (const mentah of x.folder as unknown[]) {
      const jalur = normalisasiJalur(String((mentah as Record<string, unknown>)?.jalur ?? ""));
      if (!jalurFolderSah(jalur)) throw new ApiError(400, `Jalur folder tidak sah: ${jalur.slice(0, 80) || "(kosong)"}. Gunakan jalur absolut yang spesifik, bukan akar disk atau folder sistem.`);
      if (cekFolder) {
        try {
          const st = await fs.stat(path.normalize(jalur));
          if (!st.isDirectory()) throw new Error("bukan folder");
          await fs.access(path.normalize(jalur));
        } catch {
          throw new ApiError(400, `Folder ${jalur} tidak ditemukan atau tidak terbaca dari server ALETA. Pastikan sudah dipasang (mount) baca-saja ke server ALETA.`);
        }
      }
    }
  }
  if (x.halamanPublik !== undefined) {
    if (!Array.isArray(x.halamanPublik)) throw new ApiError(400, "Daftar halaman publik harus berupa daftar.");
    const salah = (x.halamanPublik as unknown[]).map((u) => String(u ?? "").trim()).filter((u) => u && !urlHalamanSah(u));
    if (salah.length) throw new ApiError(400, `Alamat halaman tidak sah (harus http/https): ${salah.slice(0, 2).join(", ")}`);
  }
  if (x.selangMenit !== undefined) {
    const s = Number(x.selangMenit);
    if (!Number.isInteger(s) || s < SELANG_MIN_MENIT || s > SELANG_MAKS_MENIT) throw new ApiError(400, `Selang pemindaian ${SELANG_MIN_MENIT} sampai ${SELANG_MAKS_MENIT} menit.`);
  }
}

const singgah: { pada: number; nilai: PengaturanIntegritas | null } = { pada: 0, nilai: null };
const SINGGAH_MS = 5000;

export function kosongkanSinggahIntegritas() {
  singgah.pada = 0;
  singgah.nilai = null;
}

export async function bacaPengaturanIntegritas(db: AletaDatabase, { tanpaSinggah = false } = {}): Promise<PengaturanIntegritas> {
  if (!tanpaSinggah && singgah.nilai && Date.now() - singgah.pada < SINGGAH_MS) return singgah.nilai;
  const tersimpan = await bacaSetelanJson<PengaturanIntegritas>(db, KUNCI_INTEGRITAS);
  const nilai = bersihkanPengaturanIntegritas({ ...PENGATURAN_INTEGRITAS_BAWAAN, ...(tersimpan ?? {}) });
  singgah.nilai = nilai;
  singgah.pada = Date.now();
  return nilai;
}

export async function simpanPengaturanIntegritas(
  db: AletaDatabase,
  masukan: unknown,
  oleh: { id: string; nama: string },
  opsi: { kini?: Date; cekFolder?: boolean } = {}
): Promise<{ sebelum: PengaturanIntegritas; sesudah: PengaturanIntegritas }> {
  await periksaMasukanIntegritas(masukan, { cekFolder: opsi.cekFolder });
  const kini = opsi.kini ?? new Date();
  const sebelum = await bacaPengaturanIntegritas(db, { tanpaSinggah: true });
  const sesudah = bersihkanPengaturanIntegritas({
    ...sebelum,
    ...(masukan as Record<string, unknown>),
    diubahOleh: oleh.nama || oleh.id,
    diubahPada: kini.toISOString(),
  });
  await simpanSetelanSistem(db, KUNCI_INTEGRITAS, JSON.stringify(sesudah), kini.toISOString());
  kosongkanSinggahIntegritas();
  return { sebelum, sesudah };
}
