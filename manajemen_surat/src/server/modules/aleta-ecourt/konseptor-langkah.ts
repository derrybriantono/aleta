import type { AletaDatabase } from "@/server/db/client";
import { getGatewayKonseptorKeadaan, type KeadaanKonseptorBot } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { golonganPengguna } from "@/lib/matriks-peran";
import { isPrivilegedAdmin } from "@/lib/permissions";
import {
  bolehKoreksiMajelis,
  kelompokkanIsian,
  kodeLangkahSah,
  nilaiKemajuan,
  ringkasKemajuan,
  type BlangkoPerLangkah,
  type IsianBlangkoLapor,
  type KeadaanPerkara,
  type KemajuanKonseptor,
  type LaporBlangko,
  type RingkasKemajuan,
  type TandaLangkah,
} from "@/lib/konseptor-langkah";

/**
 * ============================================================================
 * CHECKLIST KONSEPTOR SEMENTARA - PENYIMPANAN (F1.6, 0067)
 * ============================================================================
 *
 * Aturan penilaiannya di @/lib/konseptor-langkah. Modul ini hanya membaca
 * dan menulis dua tabel ALETA; tidak ada yang ditulis ke SIPP maupun ABT.
 * Keadaan perkara (eksepsi, rekonvensi, putusan sela, majelis, konseptor
 * tercatat SIPP) DIBACA dari bot (konseptorKeadaanService, SELECT saja).
 */

export type OpsiKemajuan = {
  /** Keadaan per perkara - memunculkan langkah bersyarat (butir 35). */
  keadaan?: Record<string, KeadaanPerkara>;
  /** Hak akun mencentang "Dikoreksi majelis" per perkara (butir 36). */
  hakKoreksi?: Record<string, boolean>;
};

export type KeadaanTerbaca = { terbaca: boolean; peta: Record<string, KeadaanKonseptorBot> };

/** Keadaan perkara dari bot. Gagal = { terbaca:false } - langkah bersyarat hanya yang sudah dicentang. */
export async function bacaKeadaanKonseptor(perkaraIds: string[]): Promise<KeadaanTerbaca> {
  const daftar = [...new Set(perkaraIds.map(teks).filter((x) => /^\d{1,12}$/.test(x)))].slice(0, BATAS_PERKARA);
  if (daftar.length === 0) return { terbaca: true, peta: {} };
  try {
    const jawab = await getGatewayKonseptorKeadaan(daftar);
    if (!jawab.ok || !jawab.data || !jawab.data.perkara) return { terbaca: false, peta: {} };
    return { terbaca: true, peta: jawab.data.perkara };
  } catch {
    return { terbaca: false, peta: {} };
  }
}

/** Keadaan bot -> keadaan langkah bersyarat. */
export function keadaanDariBot(peta: Record<string, KeadaanKonseptorBot>): Record<string, KeadaanPerkara> {
  return Object.fromEntries(
    Object.entries(peta).map(([pid, k]) => [pid, { eksepsi: Boolean(k?.eksepsi), rekonvensi: Boolean(k?.rekonvensi), sela: Boolean(k?.sela) }])
  );
}

type AktorKoreksi = Parameters<typeof golonganPengguna>[0] & { name?: string | null };

/** Hak "Dikoreksi majelis" akun ini untuk tiap perkara (majelis dari bot; tak terbaca = menurut peran saja). */
export function hakKoreksiUntuk(aktor: AktorKoreksi | null | undefined, perkaraIds: string[], peta: Record<string, KeadaanKonseptorBot>) {
  const admin = Boolean(aktor) && isPrivilegedAdmin(aktor as Parameters<typeof isPrivilegedAdmin>[0]);
  const golongan = golonganPengguna(aktor ?? null);
  const hakim = golongan.includes("hakim") || golongan.includes("pimpinan");
  const hasil: Record<string, { boleh: boolean; alasan: string }> = {};
  for (const pid of perkaraIds) {
    const majelis = peta[pid] ? peta[pid].majelis.map((m) => m.nama) : null;
    hasil[pid] = bolehKoreksiMajelis({ admin, hakim, namaAkun: String(aktor?.name ?? ""), majelis });
  }
  return hasil;
}

/** Perkara yang sudah punya centang atau laporan Blangko Derry - checklistnya tetap tampil walau tanpa tunjukan. */
export async function perkaraBerchecklist(db: AletaDatabase, perkaraIds: string[]): Promise<Set<string>> {
  const daftar = [...new Set(perkaraIds.map(teks).filter(Boolean))].slice(0, BATAS_PERKARA);
  if (daftar.length === 0) return new Set();
  const tanya = daftar.map(() => "?").join(", ");
  const a = await db.queryAll<Record<string, unknown>>(`SELECT DISTINCT perkara_id FROM aleta_konseptor_langkah WHERE perkara_id IN (${tanya})`, daftar);
  const b = await db.queryAll<Record<string, unknown>>(`SELECT DISTINCT perkara_id FROM aleta_konseptor_blangko WHERE perkara_id IN (${tanya})`, daftar);
  return new Set([...a, ...b].map((x) => teks(x.perkara_id)).filter(Boolean));
}

const teks = (x: unknown) => String(x ?? "").trim();
const BATAS_PERKARA = 500;
const BATAS_ISIAN = 400;

function pecahPerLangkah(json: unknown): BlangkoPerLangkah {
  try {
    const isi = JSON.parse(String(json ?? "{}")) as Record<string, { jumlah?: unknown; terisi?: unknown; kosong?: unknown }>;
    const hasil: BlangkoPerLangkah = {};
    for (const [kode, v] of Object.entries(isi || {})) {
      if (!kodeLangkahSah(kode) || !v) continue;
      hasil[kode] = {
        jumlah: Number(v.jumlah) || 0,
        terisi: Number(v.terisi) || 0,
        kosong: Array.isArray(v.kosong) ? v.kosong.map(teks).filter(Boolean).slice(0, 8) : [],
      };
    }
    return hasil;
  } catch {
    return {};
  }
}

/** Kemajuan lengkap per perkara (perkara tanpa tanda maupun laporan tetap diberi kemajuan kosong). */
export async function bacaKemajuanKonseptor(
  db: AletaDatabase,
  perkaraIds: string[],
  opsi: OpsiKemajuan = {}
): Promise<Record<string, KemajuanKonseptor>> {
  const daftar = [...new Set(perkaraIds.map(teks).filter(Boolean))].slice(0, BATAS_PERKARA);
  if (daftar.length === 0) return {};
  const tanya = daftar.map(() => "?").join(", ");

  const tanda = await db.queryAll<Record<string, unknown>>(
    `SELECT perkara_id, langkah, selesai, catatan, oleh, pada
       FROM aleta_konseptor_langkah
      WHERE perkara_id IN (${tanya})`,
    daftar
  );
  const laporan = await db.queryAll<Record<string, unknown>>(
    `SELECT perkara_id, berkas, terisi, jumlah, per_langkah, oleh, pada
       FROM aleta_konseptor_blangko
      WHERE perkara_id IN (${tanya})`,
    daftar
  );

  const petaTanda = new Map<string, Record<string, TandaLangkah>>();
  for (const b of tanda) {
    const pid = teks(b.perkara_id);
    const kode = teks(b.langkah);
    if (!pid || !kodeLangkahSah(kode)) continue;
    const satu = petaTanda.get(pid) ?? {};
    satu[kode] = {
      selesai: Number(b.selesai) === 1 || b.selesai === true,
      catatan: teks(b.catatan),
      oleh: teks(b.oleh),
      pada: teks(b.pada),
    };
    petaTanda.set(pid, satu);
  }
  const petaBlangko = new Map<string, LaporBlangko>();
  for (const b of laporan) {
    const pid = teks(b.perkara_id);
    if (!pid) continue;
    petaBlangko.set(pid, {
      berkas: teks(b.berkas),
      terisi: Number(b.terisi) || 0,
      jumlah: Number(b.jumlah) || 0,
      perLangkah: pecahPerLangkah(b.per_langkah),
      oleh: teks(b.oleh),
      pada: teks(b.pada),
    });
  }

  const hasil: Record<string, KemajuanKonseptor> = {};
  for (const pid of daftar) {
    hasil[pid] = nilaiKemajuan(
      petaTanda.get(pid) ?? {},
      petaBlangko.get(pid) ?? null,
      opsi.keadaan?.[pid] ?? null,
      opsi.hakKoreksi && pid in opsi.hakKoreksi ? opsi.hakKoreksi[pid] : null
    );
  }
  return hasil;
}

export async function bacaRingkasKemajuan(
  db: AletaDatabase,
  perkaraIds: string[],
  opsi: OpsiKemajuan = {}
): Promise<Record<string, RingkasKemajuan>> {
  const lengkap = await bacaKemajuanKonseptor(db, perkaraIds, opsi);
  return Object.fromEntries(Object.entries(lengkap).map(([pid, k]) => [pid, ringkasKemajuan(k)]));
}

export type IsianTanda = { perkaraId: string; langkah: string; selesai: boolean; catatan?: string; oleh: string };

/** Mencentang atau mencabut centang satu langkah. Siapa & kapan selalu yang terakhir. */
export async function simpanTandaLangkah(db: AletaDatabase, isian: IsianTanda): Promise<{ ok: boolean; alasan: string }> {
  const perkaraId = teks(isian.perkaraId);
  const langkah = teks(isian.langkah);
  if (!perkaraId) return { ok: false, alasan: "Perkara wajib disebut." };
  if (!kodeLangkahSah(langkah)) return { ok: false, alasan: "Langkah tidak dikenal." };
  const nilai = [isian.selesai ? 1 : 0, teks(isian.catatan).slice(0, 500), teks(isian.oleh).slice(0, 200), new Date().toISOString()];

  const lama = await db.queryOne<Record<string, unknown>>(
    `SELECT perkara_id FROM aleta_konseptor_langkah WHERE perkara_id = ? AND langkah = ?`,
    [perkaraId, langkah]
  );
  if (lama) {
    await db.run(
      `UPDATE aleta_konseptor_langkah SET selesai = ?, catatan = ?, oleh = ?, pada = ? WHERE perkara_id = ? AND langkah = ?`,
      [...nilai, perkaraId, langkah]
    );
  } else {
    await db.run(
      `INSERT INTO aleta_konseptor_langkah (perkara_id, langkah, selesai, catatan, oleh, pada) VALUES (?, ?, ?, ?, ?, ?)`,
      [perkaraId, langkah, ...nilai]
    );
  }
  return { ok: true, alasan: "" };
}

export type IsianLaporBlangko = {
  perkaraId: string;
  nomorPerkara?: string;
  berkas?: string;
  isian: IsianBlangkoLapor[];
  oleh: string;
};

/**
 * Laporan Blangko Derry untuk blangko PUTUSAN satu perkara - menimpa laporan
 * sebelumnya (yang berlaku keadaan blangko terakhir yang dibuka).
 */
export async function simpanLaporBlangko(db: AletaDatabase, isian: IsianLaporBlangko): Promise<{ ok: boolean; alasan: string }> {
  const perkaraId = teks(isian.perkaraId);
  if (!perkaraId) return { ok: false, alasan: "Perkara wajib disebut." };
  const daftar = (Array.isArray(isian.isian) ? isian.isian : []).slice(0, BATAS_ISIAN).map((b) => ({
    kode: teks(b?.kode).slice(0, 10),
    nama: teks(b?.nama).slice(0, 160),
    jenis: teks(b?.jenis).slice(0, 10),
    khusus: teks(b?.khusus).slice(0, 10),
    terisi: Boolean(b?.terisi),
  }));
  if (daftar.length === 0) return { ok: false, alasan: "Laporan isian kosong." };
  const perLangkah = kelompokkanIsian(daftar);
  const terisi = daftar.filter((b) => b.terisi).length;
  const nilai = [
    teks(isian.nomorPerkara).slice(0, 100),
    teks(isian.berkas).slice(0, 200),
    terisi,
    daftar.length,
    JSON.stringify(perLangkah),
    teks(isian.oleh).slice(0, 200),
    new Date().toISOString(),
  ];
  const lama = await db.queryOne<Record<string, unknown>>(`SELECT perkara_id FROM aleta_konseptor_blangko WHERE perkara_id = ?`, [perkaraId]);
  if (lama) {
    await db.run(
      `UPDATE aleta_konseptor_blangko SET nomor_perkara = ?, berkas = ?, terisi = ?, jumlah = ?, per_langkah = ?, oleh = ?, pada = ? WHERE perkara_id = ?`,
      [...nilai, perkaraId]
    );
  } else {
    await db.run(
      `INSERT INTO aleta_konseptor_blangko (nomor_perkara, berkas, terisi, jumlah, per_langkah, oleh, pada, perkara_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [...nilai, perkaraId]
    );
  }
  return { ok: true, alasan: "" };
}
