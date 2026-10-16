import type { AletaDatabase } from "@/server/db/client";
import {
  kelompokkanIsian,
  kodeLangkahSah,
  nilaiKemajuan,
  ringkasKemajuan,
  type BlangkoPerLangkah,
  type IsianBlangkoLapor,
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
 */

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
  perkaraIds: string[]
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
  for (const pid of daftar) hasil[pid] = nilaiKemajuan(petaTanda.get(pid) ?? {}, petaBlangko.get(pid) ?? null);
  return hasil;
}

export async function bacaRingkasKemajuan(
  db: AletaDatabase,
  perkaraIds: string[]
): Promise<Record<string, RingkasKemajuan>> {
  const lengkap = await bacaKemajuanKonseptor(db, perkaraIds);
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
