import { hariLibur, petaLiburBerlaku } from "@/lib/hari-libur";
import { isPrivilegedAdmin } from "@/lib/permissions";
import { type AletaDatabase } from "@/server/db/client";
import {
  type GatewayResult,
  gatewayUnggahBasSipp,
  getGatewayKeadaanSidang,
  getGatewayUnggahMassalCek,
  postGatewayTundaSidang,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { akunSippPengguna } from "@/server/modules/aleta-ecourt/court-calendar-akun";
import { hakUnggahMassal } from "@/server/modules/aleta-ecourt/unggah-massal";
import { bacaHariLibur, tolakBilaHariLibur } from "@/server/modules/hari-libur/sumber";
import { akarPenyimpanan, bacaBerkas, hapusBerkas, simpanBerkas } from "@/server/modules/putusan-terjadwal/berkas";
import { ApiError } from "@/server/shared/errors";

import { type JenisSidang } from "@/lib/sidang-terjadwal";

/**
 * ============================================================================
 * SAMBUNGAN KE LUAR UNTUK UNGGAH BAS & TUNDAAN TERJADWAL (27 Okt 2026)
 * ============================================================================
 *
 * Semua yang menyentuh bot, SIPP, cakram, dan pemeriksaan hak dikumpulkan di sini
 * sebagai `DepsSidang` supaya layanan dan pelaksana dapat diuji dengan tiruan dan
 * pemeriksaannya SATU: penjadwalan dan pelaksana memakai deps yang sama, jadi hak
 * dan isi yang dinilai saat menjadwalkan dinilai lagi dengan aturan yang sama saat
 * dijalankan. Tidak ada tulisan ke SIPP yang tidak lewat `tulisTunda` / `unggahBas`.
 */

export const FOLDER_SIDANG = "sidang-terjadwal";
export const akarSidang = () => akarPenyimpanan(process.env, FOLDER_SIDANG);

export const PESAN_TOLAK_BAS =
  "Unggah BAS ke SIPP hanya untuk Panitera Pengganti, Panitera, Panitera Muda, Admin, dan Super Admin. Peran Anda tidak diberi hak ini.";

export type Aktor = { id: string; name?: string | null; email?: string | null; roleId?: string };

export type HakSidang = {
  aktor: Aktor;
  /** Tunda: peran tertulis. BAS: golongan yang diteruskan ke bot sebagai peranPenekan. */
  peran: string;
  /** BAS: boleh mengawasi semua perkara (tanpa harus PP-nya). */
  pengawas: boolean;
};

/** Jawaban bot yang sudah dipilah: galat SEMENTARA (bot mati, SIPP terputus, perkara dipegang) dibedakan dari penolakan tetap. */
export type HasilBot<T> =
  | { ok: true; data: T }
  | { ok: false; sebab: string; kode: string; sementara: boolean; dipulihkan?: boolean };

const KODE_SEMENTARA = new Set([
  "server_sipp_tidak_terhubung",
  "perkara_sedang_dikerjakan",
  "berkas_tidak_dapat_ditulis",
  "akar_tidak_dapat_ditulis",
  "antrean_jam_kerja_gagal",
  "kunci_tidak_tersedia",
]);
const KODE_TULIS_GAGAL = new Set(["gagal_menulis", "gagal_menyimpan"]);

/**
 * Bot tidak terjangkau (tanpa status), galat peladen bot (5xx), atau kode yang memang sementara = SEMENTARA.
 * Penulisan yang gagal di tengah (gagal_menulis) hanya diulang bila bot menyatakan semuanya sudah dipulihkan.
 */
export function dariGateway<T>(r: GatewayResult<T>): HasilBot<T> {
  if (r.ok) return { ok: true, data: r.data };
  const kode = String(r.kode ?? "");
  const dipulihkan = (r.badan as { dipulihkan?: unknown } | undefined)?.dipulihkan;
  const sementara =
    r.status === undefined ||
    r.status >= 500 ||
    KODE_SEMENTARA.has(kode) ||
    (KODE_TULIS_GAGAL.has(kode) && dipulihkan !== false);
  return { ok: false, sebab: String(r.error || "ALETA Bot belum dapat dihubungi."), kode, sementara, ...(dipulihkan === false ? { dipulihkan: false } : {}) };
}

export type KeadaanSidang = {
  perkaraId: string;
  nomorPerkara: string;
  tanggalSidang: string;
  ditunda: boolean;
  alasanDitunda: string;
  tanggalPutusan: string;
};

export type CekBas = {
  adaBas: boolean;
  jalur: string;
  tanggalSidang: string;
  urutan: number;
  /** PP aktif perkara; null = tidak terbaca. */
  panitera: string[] | null;
};

export type MuatanUnggahBas = {
  perkaraId: string;
  sidangId: string;
  nomorPerkara: string;
  basBase64: string;
  olehUsername: string;
  operator: string;
  ip: string;
  peranPenekan: string;
  milikPerkara: boolean;
  ganti: boolean;
};

export type DepsSidang = {
  sekarang: () => Date;
  acak: () => number;
  muatLibur: (db: AletaDatabase) => Promise<(iso: string) => boolean>;
  /** Hak menulis menurut jenis (kapabilitas "panel" + hak jenisnya). Melempar ApiError 401/403. */
  hak: (db: AletaDatabase, jenis: JenisSidang, userId: string) => Promise<HakSidang>;
  /** Hak melihat/membatalkan: kapabilitas "panel" saja. */
  aktorPanel: (db: AletaDatabase, userId: string) => Promise<{ aktor: Aktor; pengawas: boolean }>;
  akunSipp: (
    db: AletaDatabase,
    userId: string,
    diminta?: string
  ) => Promise<{ ok: true; username: string; milik: string[] } | { ok: false; pesan: string; kode?: string; milik: string[] }>;
  /** Kalimat bila tanggal itu hari libur; null bila hari kerja. */
  tolakLibur: (db: AletaDatabase, tanggal: string) => Promise<string | null>;
  cekBas: (perkaraId: string, sidangId: string) => Promise<HasilBot<CekBas>>;
  keadaanSidang: (jadwalId: string) => Promise<HasilBot<KeadaanSidang>>;
  /** POST /sidang/tunda; `badan.kering` menentukan rencana saja (true) atau menulis (false). */
  tulisTunda: (badan: Record<string, unknown>) => Promise<HasilBot<Record<string, unknown>>>;
  unggahBas: (m: MuatanUnggahBas) => Promise<HasilBot<Record<string, unknown>>>;
  simpanBerkas: (id: string, bentuk: string, bita: Uint8Array, kini: Date) => Promise<string>;
  bacaBerkas: (jalur: string) => Promise<Uint8Array | null>;
  hapusBerkas: (jalur: string) => Promise<boolean>;
};

const PERAN_KELOLA_SEMUA: ReadonlySet<string> = new Set(["super-admin", "admin"]);

export const bolehKelolaSemua = (aktor: Aktor) => PERAN_KELOLA_SEMUA.has(String(aktor.roleId ?? "")) || isPrivilegedAdmin(aktor as Parameters<typeof isPrivilegedAdmin>[0]);

async function liburAsli(db: AletaDatabase) {
  try {
    await bacaHariLibur(db);
  } catch {
    /* daftar SKB tetap berlaku */
  }
  const peta = petaLiburBerlaku();
  return (iso: string) => hariLibur(iso, peta);
}

const teks = (v: unknown) => String(v ?? "").trim();

export function depsAsli(): DepsSidang {
  return {
    sekarang: () => new Date(),
    acak: Math.random,
    muatLibur: liburAsli,
    hak: async (db, jenis, userId) => {
      // Sama dengan rute langsungnya: sidang-tunda (panel + sidang.tunda-putus) dan bas/unggah-sipp (panel + golongan BAS).
      const aktor = await pastikanKapabilitas(db, userId, "panel");
      if (jenis === "tunda") {
        await pastikanAksi(db, userId, "sidang.tunda-putus");
        return { aktor, peran: String(aktor.roleId ?? ""), pengawas: false };
      }
      const hak = hakUnggahMassal(aktor);
      if (!hak.bas || !hak.peranBas) throw new ApiError(403, PESAN_TOLAK_BAS);
      return { aktor, peran: hak.peranBas, pengawas: hak.semua.bas };
    },
    aktorPanel: async (db, userId) => {
      const aktor = await pastikanKapabilitas(db, userId, "panel");
      return { aktor, pengawas: bolehKelolaSemua(aktor) };
    },
    akunSipp: async (db, userId, diminta) => {
      const r = await akunSippPengguna(db, userId, diminta);
      return r.ok ? { ok: true, username: r.username, milik: r.milik } : { ok: false, pesan: r.pesan, kode: r.alasan, milik: r.milik };
    },
    tolakLibur: async (db, tanggal) => {
      try {
        await tolakBilaHariLibur(db, tanggal, "Tanggal sidang berikutnya");
        return null;
      } catch (galat) {
        if (galat instanceof ApiError) return galat.message;
        throw galat;
      }
    },
    cekBas: async (perkaraId, sidangId) => {
      const r = dariGateway(await getGatewayUnggahMassalCek({ jenis: "bas", perkaraId, sidangId }));
      if (!r.ok) return r;
      const d = r.data as Record<string, unknown>;
      const pet = d.panitera;
      return {
        ok: true,
        data: {
          adaBas: d.adaBas === true,
          jalur: teks(d.jalur),
          tanggalSidang: teks(d.tanggalSidang).slice(0, 10),
          urutan: Number(d.urutan) || 0,
          panitera: Array.isArray(pet) ? pet.map((n) => teks(n)).filter(Boolean) : null,
        },
      };
    },
    keadaanSidang: async (jadwalId) => {
      const r = dariGateway(await getGatewayKeadaanSidang(jadwalId));
      if (!r.ok) return r;
      const k = (r.data as { keadaan?: Record<string, unknown> }).keadaan;
      if (!k) return { ok: false, sebab: "Sidang ini tidak ditemukan di SIPP.", kode: "jadwal_tidak_ketemu", sementara: false };
      return {
        ok: true,
        data: {
          perkaraId: teks(k.perkaraId),
          nomorPerkara: teks(k.nomorPerkara),
          tanggalSidang: teks(k.tanggalSidang).slice(0, 10),
          ditunda: teks(k.ditunda) === "Y",
          alasanDitunda: teks(k.alasanDitunda),
          tanggalPutusan: teks(k.tanggalPutusan).slice(0, 10),
        },
      };
    },
    tulisTunda: async (badan) => dariGateway(await postGatewayTundaSidang(badan, badan.kering === false ? { timeoutMs: 60_000 } : {})),
    unggahBas: async (m) => dariGateway(await gatewayUnggahBasSipp(m)),
    simpanBerkas: (id, bentuk, bita, kini) => simpanBerkas(id, bentuk, bita, { akar: akarSidang(), kini }),
    bacaBerkas: (jalur) => bacaBerkas(jalur, akarSidang()),
    hapusBerkas: (jalur) => hapusBerkas(jalur, akarSidang()),
  };
}
