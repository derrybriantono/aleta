import { JAWABAN_SAH, type JawabanBeda } from "@/lib/aleta-abt-berdampingan";
import {
  KELUARGA_PINDAH,
  bersihkanLaporanUkur,
  bersihkanSetelanPindah,
  keluargaSah,
  nilaiKesiapan,
  pesanSyaratBelum,
  type BarisBerdampinganFolder,
  type KesiapanKeluarga,
  type LaporanUkur,
  type SetelanPindah,
} from "@/lib/aleta-abt-pindah";
import type { AletaDatabase } from "@/server/db/client";
import { bacaKunci, tulisKunci } from "@/server/modules/tunda-otomatis/layanan";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * PINDAH KE ALETA ABT PER JENIS PERKARA - LAYANAN (5 Nov 2026, Tahap 8)
 * ============================================================================
 *
 * Saklar tiap keluarga blangko (BAWAAN MATI) dan hasil pengukuran pada salinan uji disimpan di aleta_ekstensi_setelan (tanpa tabel baru,
 * tanpa migrasi). Hanya membaca hasil berdampingan (aleta_abt_berdampingan) dan tidak pernah menulis ke ABT, SIPP, atau e-Court.
 *
 *   - Saklar menolak menyala bila syaratnya belum terpenuhi (naskah sama dengan ABT di salinan uji; 30 cetak berdampingan tanpa beda
 *     merah selama 14 hari). Mematikan selalu boleh.
 *   - ALETA_ABT_PINDAH=0 di pengaturan server mematikan SEMUA saklar apa pun isinya dan menolak menyalakan.
 *   - Yang tersimpan hanya angka, nama keluarga, dan siapa/kapan mengubah. Tidak ada isi naskah dan tidak ada data pihak.
 *   - Panel Blangko ABT by Derry Briantono TIDAK membaca layanan ini: sampai Tahap 7 lulus ia tetap memakai ABT. Keputusan untuk
 *     membuka ALETA ABT dari panel (bukaAletaAbtUntukFolder) hanya akan dipakai sesudah itu, dan selama saklar mati jawabannya "tidak".
 */

export const KUNCI_SETELAN_PINDAH = "aleta_abt_pindah_setelan";
export const KUNCI_LAPORAN_PINDAH = "aleta_abt_pindah_laporan";
const MASA_BERDAMPINGAN_HARI = 120;

type Env = Record<string, string | undefined>;

export const pindahDimatikanEnv = (env: Env = process.env) => env.ALETA_ABT_PINDAH === "0";

export async function bacaSetelanPindah(db: AletaDatabase, env: Env = process.env): Promise<SetelanPindah & { dimatikanServer: boolean }> {
  const t = await bacaKunci<unknown>(db, KUNCI_SETELAN_PINDAH).catch(() => null);
  const dasar = bersihkanSetelanPindah(t);
  const mati = pindahDimatikanEnv(env);
  if (mati) for (const k of Object.keys(dasar.keluarga)) dasar.keluarga[k] = { ...dasar.keluarga[k], aktif: false };
  return { ...dasar, dimatikanServer: mati };
}

export async function bacaLaporanUkur(db: AletaDatabase): Promise<LaporanUkur | null> {
  const t = await bacaKunci<unknown>(db, KUNCI_LAPORAN_PINDAH).catch(() => null);
  return bersihkanLaporanUkur(t);
}

/** Menyimpan hasil pengukuran (angka). Berkas yang bukan hasil pengukur ditolak, tidak diterka. */
export async function simpanLaporanUkur(db: AletaDatabase, aktor: { id: string; name: string }, mentah: unknown): Promise<{ keluarga: number; terukur: number; dibuat: string }> {
  const bersih = bersihkanLaporanUkur(mentah);
  if (!bersih) throw new ApiError(400, "Berkas ini bukan hasil pengukuran semua jenis perkara. Pilih berkas hasil pengukuran yang dibuat di komputer pengembang.");
  await tulisKunci(db, KUNCI_LAPORAN_PINDAH, { ...bersih, dimuatOleh: aktor.name || aktor.id, dimuatPada: new Date().toISOString() });
  return { keluarga: bersih.keluarga.length, terukur: bersih.keluarga.filter((k) => k.naskah > 0).length, dibuat: bersih.dibuat };
}

type BarisDb = { waktu: string; folder: string; hasil: string; jawaban: string };
const HASIL_SAH = ["hijau", "kuning", "merah", "belum-diukur"] as const;

export async function bacaBerdampinganFolder(db: AletaDatabase, kini: Date = new Date()): Promise<BarisBerdampinganFolder[]> {
  const sejak = new Date(kini.getTime() - MASA_BERDAMPINGAN_HARI * 86_400_000).toISOString();
  const baris = await db
    .queryAll<BarisDb>("SELECT waktu, folder, hasil, jawaban FROM aleta_abt_berdampingan WHERE waktu >= ? ORDER BY waktu DESC LIMIT 20000", [sejak])
    .catch(() => [] as BarisDb[]);
  return baris.map((b) => ({
    waktu: String(b.waktu),
    folder: String(b.folder ?? ""),
    hasil: (HASIL_SAH as readonly string[]).includes(b.hasil) ? (b.hasil as BarisBerdampinganFolder["hasil"]) : "belum-diukur",
    jawaban: (JAWABAN_SAH as readonly string[]).includes(b.jawaban) ? (b.jawaban as JawabanBeda) : "",
  }));
}

export type KeadaanPindah = {
  keluarga: KesiapanKeluarga[];
  laporan: { ada: boolean; dibuat: string; keterangan: string; dimuatOleh: string; dimuatPada: string };
  dimatikanServer: boolean;
  menyala: number;
  siap: number;
  terukur: number;
};

export async function bacaKeadaanPindah(db: AletaDatabase, kini: Date = new Date(), env: Env = process.env): Promise<KeadaanPindah> {
  const [setelan, laporan, baris, meta] = await Promise.all([
    bacaSetelanPindah(db, env),
    bacaLaporanUkur(db),
    bacaBerdampinganFolder(db, kini),
    bacaKunci<{ dimuatOleh?: string; dimuatPada?: string }>(db, KUNCI_LAPORAN_PINDAH).catch(() => null),
  ]);
  const keluarga = KELUARGA_PINDAH.map((k) =>
    nilaiKesiapan(k, { ukur: laporan?.keluarga.find((u) => u.kunci === k.kunci) ?? null, berdampingan: baris, aktif: setelan.keluarga[k.kunci]?.aktif === true }, kini)
  );
  return {
    keluarga,
    laporan: { ada: Boolean(laporan), dibuat: laporan?.dibuat ?? "", keterangan: laporan?.keterangan ?? "", dimuatOleh: String(meta?.dimuatOleh ?? ""), dimuatPada: String(meta?.dimuatPada ?? "") },
    dimatikanServer: setelan.dimatikanServer,
    menyala: keluarga.filter((k) => k.aktif).length,
    siap: keluarga.filter((k) => k.siap).length,
    terukur: keluarga.filter((k) => k.ukur && k.ukur.naskah > 0).length,
  };
}

export type HasilSaklar = { keluarga: string; aktif: boolean; diubahOleh: string; diubahPada: string };

/**
 * Menyalakan hanya bila semua syarat keluarga itu terpenuhi (409 dengan alasan yang dapat dibaca bila belum). Mematikan selalu boleh.
 * Bagian lain setelan tidak berubah.
 */
export async function ubahSaklarPindah(db: AletaDatabase, aktor: { id: string; name: string }, kunci: unknown, aktif: boolean, kini: Date = new Date(), env: Env = process.env): Promise<HasilSaklar> {
  if (!keluargaSah(kunci)) throw new ApiError(400, "Jenis perkara tidak dikenal.");
  if (aktif) {
    if (pindahDimatikanEnv(env)) throw new ApiError(409, "Pindah ke ALETA ABT dimatikan lewat pengaturan server, jadi belum dapat dinyalakan.");
    const keadaan = await bacaKeadaanPindah(db, kini, env);
    const k = keadaan.keluarga.find((x) => x.kunci === kunci)!;
    if (!k.siap) throw new ApiError(409, pesanSyaratBelum(k));
  }
  const kini2 = await bacaSetelanPindah(db, {});
  const baru: SetelanPindah = { keluarga: { ...kini2.keluarga, [kunci]: { aktif, diubahOleh: aktor.name || aktor.id, diubahPada: kini.toISOString() } } };
  await tulisKunci(db, KUNCI_SETELAN_PINDAH, baru);
  return { keluarga: kunci, ...baru.keluarga[kunci] };
}
