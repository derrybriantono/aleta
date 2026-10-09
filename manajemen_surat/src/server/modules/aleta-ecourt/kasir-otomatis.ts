import { bolehKasir } from "@/lib/kasir-jurnal";
import {
  periodeSah,
  rentangPeriode,
  susunRekap,
  type JawabanPengingat,
  type PeriodeRekap,
  type RekapKasir,
  type RekapMentah,
} from "@/lib/kasir-otomatis";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import { type AletaDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { panggilBotJadwalSidang } from "@/server/modules/aleta-ecourt/jadwal-sidang-gateway";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * KASIR OTOMATIS 1.189.x - BERSAMA UNTUK RUTE kasir/harian, rekap, pengingat
 * ============================================================================
 *
 * Hak sama dengan Kasir 1.186 (rute sidang/kasir): kemampuan "panel" DAN
 * peran kasir/keuangan/panitera/admin/super-admin (bolehKasir). Rute
 * memeriksanya sendiri - ekstensi dan layar hanya kenyamanan.
 */
export async function pastikanHakKasir(db: AletaDatabase, actorUserId: string | null) {
  const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
  if (!bolehKasir(aktor)) {
    throw new ApiError(403, "Kasir hanya dapat dibuka kasir, bendahara, panitera, dan admin.");
  }
  return aktor;
}

/** Tanggal WITA hari ini bila yang diminta tidak sah. */
export function tanggalAtauHariIni(nilai: string | null | undefined): string {
  const t = String(nilai || "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : waktuPengadilan().tanggal;
}

export type HasilRekap = { ok: true; rekap: RekapKasir } | { ok: false; alasan: string };

/** Rekap satu periode yang memuat `tanggal`, dibaca bot lalu disusun lib. */
export async function bacaRekapKasir(periode: string, tanggal: string): Promise<HasilRekap> {
  const p: PeriodeRekap = periodeSah(periode) ? periode : "harian";
  let rentang: ReturnType<typeof rentangPeriode>;
  try {
    rentang = rentangPeriode(p, tanggalAtauHariIni(tanggal));
  } catch (e) {
    return { ok: false, alasan: e instanceof Error ? e.message : "Tanggal rekap tidak sah." };
  }
  const hasil = await panggilBotJadwalSidang<RekapMentah & { alasan?: string }>(
    `/kasir/rekap?${new URLSearchParams({ dari: rentang.dari, sampai: rentang.sampai }).toString()}`,
    { timeoutMs: 30_000 }
  );
  if (!hasil.ok) return { ok: false, alasan: hasil.error };
  if (!hasil.data || hasil.data.ok !== true) return { ok: false, alasan: String(hasil.data?.alasan || "Rekap tidak terbaca.") };
  return { ok: true, rekap: susunRekap(hasil.data, p, rentang.label) };
}

/** Pengingat kasir dari bot, disinggahkan 60 detik (checklist dibaca berulang oleh widget). */
let singgahPengingat: { kapan: number; isi: JawabanPengingat } | null = null;

export async function bacaPengingatKasir(opsi: { segar?: boolean } = {}): Promise<{ ok: true; data: JawabanPengingat } | { ok: false; alasan: string }> {
  const kini = Date.now();
  if (!opsi.segar && singgahPengingat && kini - singgahPengingat.kapan < 60_000) return { ok: true, data: singgahPengingat.isi };
  // 10 detik: checklist milestone menunggunya - bot yang mati tidak boleh
  // menahan checklist peran lain terlalu lama.
  const hasil = await panggilBotJadwalSidang<JawabanPengingat>("/kasir/pengingat", { timeoutMs: 10_000 });
  if (!hasil.ok) return { ok: false, alasan: hasil.error };
  if (!hasil.data || hasil.data.ok !== true) return { ok: false, alasan: "Pengingat kasir tidak terbaca." };
  singgahPengingat = { kapan: kini, isi: hasil.data };
  return { ok: true, data: hasil.data };
}

/** Dibuka untuk uji dan sesudah setoran dicatat. */
export function kosongkanSinggahPengingatKasir() {
  singgahPengingat = null;
}
