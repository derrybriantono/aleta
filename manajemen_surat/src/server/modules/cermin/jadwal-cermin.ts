/**
 * ============================================================================
 * JADWAL SIDANG DARI CERMIN (A4, 25 Okt 2026)
 * ============================================================================
 *
 * Layar Jadwal Sidang, tautan /jadwal, layar publik, dan antrean membaca
 * daftar sidang dari cermin (satu baca Postgres) alih-alih ±40 kueri SIPP per
 * muat. Aturannya:
 *
 *   * SAKLAR `jadwal` MATI bawaan. Mati = jalur lama persis seperti sekarang.
 *   * HANYA bila: tanpa pencarian (nama pihak ada di SIPP), seluruh rentang
 *     tanggal ada di JENDELA PANAS (yang dihitung ulang tiap beberapa menit),
 *     dan cermin SEGAR (kesegaran.ts). Selain itu -> null = jalur lama.
 *   * BARIS sidang = baris_json yang disusun bot (daftarSidang) apa adanya,
 *     diurutkan dengan aturan SQL yang sama (tanggal, jam, urutan alur, nomor
 *     numerik, nomor teks) dan dibatasi `batas` seperti jalur lama - sehingga
 *     isi layar dari cermin = isi dari jalur lama untuk data yang sama.
 *   * KETERANGAN LANGSUNG yang tidak boleh basi (peta antrian, waktu antrian
 *     berdetik, kehadiran rinci) TETAP dibaca langsung dari bot lewat
 *     /cermin/pelengkap-jadwal, bukan dari cermin. Gagalnya ditelan seperti
 *     jalur lama (antrian terbaca:false); bot lama tanpa rute itu = jalur lama.
 *   * `cermin: { diperbaruiPada }` ditambahkan di jawaban, supaya layar
 *     menampilkan "Cermin · diperbarui hh:mm".
 *
 * Tidak ada yang ditulis ke SIPP. Tidak melempar: kegagalan apa pun = null.
 */
import { cerminMenyusulTulisan, tanggalPanas } from "@/server/modules/cermin/pembaruan";
import type { PengaturanCermin } from "@/lib/cermin";
import { getDatabase, type AletaDatabase } from "@/server/db/client";
import { kesegaranCermin, type Kesegaran } from "@/server/modules/cermin/kesegaran";
import { pengaturanCerminBerlaku } from "@/server/modules/cermin/pengaturan";
import { panggilBotCermin } from "@/server/modules/cermin/bot";

const TANGGAL_ISO = /^\d{4}-\d{2}-\d{2}$/;

export type BarisPelengkap = { perkaraId: string; tanggalSidang: string };
export type PelengkapJadwal =
  | { ok: true; data: { antrian: Record<string, unknown>; waktuAntrian?: unknown } }
  | { ok: false; error: string; status?: number };

export type MasukanJadwalCermin = { dari?: string; sampai?: string; cari?: string; batas?: number; waktu?: boolean };

export type DepsJadwalCermin = {
  db: () => Promise<AletaDatabase>;
  pengaturan: () => Promise<PengaturanCermin>;
  sekarang: () => Date;
  pelengkap: (baris: BarisPelengkap[], waktu: boolean) => Promise<PelengkapJadwal>;
};

export const depsJadwalCerminAsli: DepsJadwalCermin = {
  db: getDatabase,
  pengaturan: () => pengaturanCerminBerlaku(),
  sekarang: () => new Date(),
  pelengkap: async (baris, waktu) => {
    const parameter = baris.map((b) => `${String(b.perkaraId).replace(/[^0-9A-Za-z_-]/g, "")}~${b.tanggalSidang}`).join(",");
    const r = await panggilBotCermin<{ antrian: Record<string, unknown>; waktuAntrian?: unknown }>(
      `/pelengkap-jadwal?waktu=${waktu ? "1" : "0"}&baris=${parameter}`,
      15_000
    );
    return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error, status: r.status };
  },
};

function rankAlur(alur: unknown) {
  const a = Number(alur);
  return a === 15 ? 1 : a === 16 ? 2 : a === 17 ? 3 : a === 122 ? 4 : 5;
}

function nomorUrut(nomor: unknown) {
  const n = parseInt(String(nomor ?? "").split("/")[0], 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Urutan yang SAMA dengan ORDER BY daftarSidang: tanggal, jam, urutan alur
 * (15,16,17,122,lainnya), nomor perkara sebagai ANGKA, lalu nomor sebagai teks.
 */
export function urutanSidang(a: Record<string, unknown>, b: Record<string, unknown>): number {
  const teks = (x: unknown) => String(x ?? "");
  const t = teks(a.tanggalSidang).localeCompare(teks(b.tanggalSidang));
  if (t) return t;
  const j = teks(a.jamSidang).localeCompare(teks(b.jamSidang));
  if (j) return j;
  const r = rankAlur(a.alurPerkaraId) - rankAlur(b.alurPerkaraId);
  if (r) return r;
  const n = nomorUrut(a.nomorPerkara) - nomorUrut(b.nomorPerkara);
  if (n) return n;
  return teks(a.nomorPerkara) < teks(b.nomorPerkara) ? -1 : teks(a.nomorPerkara) > teks(b.nomorPerkara) ? 1 : 0;
}

export type AlasanTidakDariCermin =
  | "saklar-mati"
  | "ada-pencarian"
  | "rentang-tidak-sah"
  | "di-luar-jendela-panas"
  | "cermin-tertinggal"
  | "pelengkap-tidak-tersedia"
  | "galat";

/** Memutuskan dari jauh apakah permintaan ini boleh dilayani cermin (murni, tanpa basis data). */
export function bolehDariCermin(
  p: MasukanJadwalCermin,
  pengaturan: PengaturanCermin,
  sekarang: Date
): { boleh: true; dari: string; sampai: string } | { boleh: false; alasan: AlasanTidakDariCermin } {
  if (pengaturan.layar.jadwal !== true) return { boleh: false, alasan: "saklar-mati" };
  if (String(p.cari ?? "").trim() !== "") return { boleh: false, alasan: "ada-pencarian" };
  const dari = String(p.dari ?? "").trim();
  const sampai = String(p.sampai ?? "").trim() || dari;
  if (!TANGGAL_ISO.test(dari) || !TANGGAL_ISO.test(sampai) || sampai < dari) return { boleh: false, alasan: "rentang-tidak-sah" };
  const panas = tanggalPanas(sekarang, pengaturan);
  if (dari < panas.dari || sampai > panas.sampai) return { boleh: false, alasan: "di-luar-jendela-panas" };
  return { boleh: true, dari, sampai };
}

export type HasilJadwalCermin = {
  ok: true;
  data: {
    ok: true;
    dari: string;
    sampai: string;
    diperiksaPada: string;
    sidang: Array<Record<string, unknown>>;
    antrian?: Record<string, unknown>;
    waktuAntrian?: unknown;
    cermin: { diperbaruiPada: string | null };
  };
};

/**
 * Daftar sidang dari cermin, atau null (pakai jalur lama) dengan `alasan`
 * dicatat lewat `catat`. Tidak pernah melempar.
 */
export async function bacaJadwalDariCermin(
  p: MasukanJadwalCermin,
  deps: DepsJadwalCermin = depsJadwalCerminAsli,
  catat?: (alasan: AlasanTidakDariCermin, rincian?: string) => void
): Promise<HasilJadwalCermin | null> {
  try {
    const pengaturan = await deps.pengaturan();
    const sekarang = deps.sekarang();
    const putusan = bolehDariCermin(p, pengaturan, sekarang);
    if (!putusan.boleh) {
      catat?.(putusan.alasan);
      return null;
    }
    const db = await deps.db();
    const segar: Kesegaran = await kesegaranCermin(db, pengaturan, sekarang);
    if (!segar.segar) {
      catat?.("cermin-tertinggal", segar.alasan);
      return null;
    }
    if (!cerminMenyusulTulisan()) {
      // Baca tulisan sendiri: simpanan terakhir lewat ALETA belum masuk cermin.
      catat?.("cermin-tertinggal", "menunggu tulisan terakhir masuk cermin");
      return null;
    }
    const rows = await db.queryAll<{ baris_json: string }>(
      "SELECT baris_json FROM aleta_cermin_sidang WHERE tanggal_sidang >= ? AND tanggal_sidang <= ?",
      [putusan.dari, putusan.sampai]
    );
    const semua: Array<Record<string, unknown>> = [];
    for (const r of rows) {
      try {
        const b = JSON.parse(r.baris_json) as Record<string, unknown>;
        if (b && typeof b === "object") semua.push(b);
      } catch {
        // Baris cermin rusak dilewati; pencocokan mingguan memperbaikinya.
      }
    }
    semua.sort(urutanSidang);
    const batas = Math.min(Math.max(Number(p.batas) || 200, 1), 500);
    const sidang = semua.slice(0, batas);

    const pel = await deps.pelengkap(
      sidang.map((b) => ({ perkaraId: String(b.perkaraId ?? ""), tanggalSidang: String(b.tanggalSidang ?? "") })),
      p.waktu === true
    );
    let antrian: Record<string, unknown> | undefined;
    let waktuAntrian: unknown;
    if (pel.ok) {
      antrian = pel.data.antrian;
      waktuAntrian = pel.data.waktuAntrian;
    } else if (pel.status === 404) {
      // Bot lama tanpa rute pelengkap: jalur lama (jadwal + antrian dari satu sumber).
      catat?.("pelengkap-tidak-tersedia", pel.error);
      return null;
    } else {
      // Antrian tidak terbaca: jadwal tetap tampil, seperti jalur lama.
      antrian = { terbaca: false, alasan: String(pel.error).slice(0, 200), peta: {}, tanggal: [] };
    }
    return {
      ok: true,
      data: {
        ok: true,
        dari: putusan.dari,
        sampai: putusan.sampai,
        diperiksaPada: segar.diperbaruiPada ?? sekarang.toISOString(),
        sidang,
        antrian,
        ...(waktuAntrian !== undefined ? { waktuAntrian } : {}),
        cermin: { diperbaruiPada: segar.diperbaruiPada },
      },
    };
  } catch (galat) {
    catat?.("galat", galat instanceof Error ? galat.message : "galat");
    return null;
  }
}
