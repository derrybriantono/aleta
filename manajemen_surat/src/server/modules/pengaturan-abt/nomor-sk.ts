import { hakPengaturanAbt } from "@/lib/pengaturan-abt";
import {
  DAFTAR_NOMOR_SK,
  GalatNomorSk,
  PESAN_NOMOR_SK_BELUM_TERPASANG,
  bersihkanPengaturanNomorSk,
  nilaiLiteral,
  nomorSkBawaan,
  type ButirNomorSk,
  type PengaturanNomorSk,
} from "@/lib/nomor-sk";
import { menyebutAleta, pesanTandaAletaSipp } from "@/lib/tanda-aleta";
import { withTransaction, type AletaDatabase } from "@/server/db/client";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

import { bot, simpanNomorSkAbt, type AktorPengaturan } from "./service";

/**
 * ============================================================================
 * NOMOR SK PENUNJUKAN - Integrasi e-Court (17 Okt 2026)
 * ============================================================================
 *
 * Satu sumber data: aleta_ekstensi_setelan (tanpa migrasi), pengguna_id
 * PENGGUNA_SISTEM, kunci KUNCI_NOMOR_SK. Belum pernah disimpan = nilai bawaan
 * (SK yang berlaku sekarang, lib/nomor-sk.ts).
 *
 * Dua langkah yang sengaja TERPISAH (seperti identitas satker):
 *   1. SIMPAN di ALETA - tidak menyentuh ABT;
 *   2. TERAPKAN ke ABT - menulis teks literal ke variabel #9550# (bot menyusun kueri baku)
 *      lewat jalur pengaturan ABT yang sama (simpanNomorSkAbt: satu transaksi,
 *      nilai lama dicatat untuk Kembalikan, bot menjaga prasyarat).
 *
 * Variabel yang belum ada di ABT (paket blangko belum terpasang) tidak menggagalkan
 * penyimpanan: nilainya tetap di ALETA dan layar menyebutnya dengan kalimat awam.
 */

export const KUNCI_NOMOR_SK = "sistem:nomor-sk";
/** Sama dengan PENGGUNA_SISTEM modul setelan lain (tidak diimpor: modul itu menarik penyapu KTP). */
const PENGGUNA_SISTEM = "*sistem*";

type SimpananNomorSk = { nilai: PengaturanNomorSk; diubahOleh: string; diubahPada: string };

function wajibHak(aktor: AktorPengaturan) {
  if (!hakPengaturanAbt(aktor.roleId).ubahBawaan) throw new ApiError(403, "Hanya Super Admin dan Admin yang dapat mengubah nomor SK.");
}

const galatNomorSk = (e: unknown) => (e instanceof GalatNomorSk ? new ApiError(400, e.message) : e);

async function bacaSimpanan(db: AletaDatabase): Promise<SimpananNomorSk | null> {
  try {
    const b = await db.queryOne<{ nilai: string }>("SELECT nilai FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND kunci = ?", [PENGGUNA_SISTEM, KUNCI_NOMOR_SK]);
    if (!b) return null;
    const mentah = JSON.parse(String(b.nilai)) as { nilai?: unknown; diubahOleh?: unknown; diubahPada?: unknown };
    return {
      nilai: bersihkanPengaturanNomorSk(mentah.nilai, nomorSkBawaan()),
      diubahOleh: String(mentah.diubahOleh ?? ""),
      diubahPada: String(mentah.diubahPada ?? ""),
    };
  } catch {
    return null;
  }
}

export async function bacaNomorSkAleta(db: AletaDatabase) {
  const s = await bacaSimpanan(db);
  return { nilai: s?.nilai ?? nomorSkBawaan(), tersimpan: Boolean(s), diubahOleh: s?.diubahOleh ?? "", diubahPada: s?.diubahPada ?? "" };
}

/** Simpan di ALETA. ABT tidak disentuh. badan: {nilai: {majelis: {nomor, tanggal}}} */
export async function simpanNomorSk(db: AletaDatabase, aktor: AktorPengaturan, badan: Record<string, unknown>) {
  wajibHak(aktor);
  const kini = await bacaNomorSkAleta(db);
  let nilai: PengaturanNomorSk;
  try {
    nilai = bersihkanPengaturanNomorSk(badan.nilai, kini.nilai);
  } catch (e) {
    throw galatNomorSk(e);
  }
  const sekarang = new Date().toISOString();
  const isi = { nilai, diubahOleh: aktor.name || aktor.id, diubahPada: sekarang };
  await withTransaction(db, async (tx) => {
    await tx
      .prepare(
        "INSERT INTO aleta_ekstensi_setelan (pengguna_id, kunci, nilai, diubah_pada) VALUES (?, ?, ?, ?) " +
          "ON CONFLICT (pengguna_id, kunci) DO UPDATE SET nilai = excluded.nilai, diubah_pada = excluded.diubah_pada"
      )
      .run(PENGGUNA_SISTEM, KUNCI_NOMOR_SK, JSON.stringify(isi), sekarang);
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: aktor.id,
      action: "UPDATE_NOMOR_SK",
      entityType: "aleta_ekstensi_setelan",
      entityId: `${PENGGUNA_SISTEM}:${KUNCI_NOMOR_SK}`,
      payload: { nilai },
      createdAt: sekarang,
    });
  });
  return bacaNomorSkAleta(db);
}

// ---------------------------------------------------------------------------
// Keadaan ABT & rencana penerapan
// ---------------------------------------------------------------------------

/** nomor = nomor di kueri baku `SELECT '<nomor>' AS data`; null bila kueri di ABT berbentuk lain. */
type VariabelNomorSkBot = { noVar: string; ada: boolean; nama: string; jenis: string; nomor: string | null; dikunci: boolean };
export type KeadaanNomorSkBot = { variabel: VariabelNomorSkBot[] };

export type ButirRencanaNomorSk = {
  kunci: string;
  noVar: string;
  label: string;
  keterangan: string;
  /** Teks yang akan ditulis ke ABT. */
  literal: string;
  ada: boolean;
  nilaiAbt: string;
  perlu: boolean;
  bisa: boolean;
  sebab: string;
};

/** Apa yang akan berubah di ABT bila nomor SK ALETA diterapkan (murni - diuji). */
export function susunRencanaNomorSk(nilai: PengaturanNomorSk, abt: KeadaanNomorSkBot): ButirRencanaNomorSk[] {
  return DAFTAR_NOMOR_SK.map((b: ButirNomorSk) => {
    const literal = nilaiLiteral(b, nilai[b.kunci] ?? { nomor: b.bawaanNomor, tanggal: b.bawaanTanggal });
    const dasar = { kunci: b.kunci, noVar: b.noVar, label: b.label, keterangan: b.keterangan, literal };
    const v = abt.variabel.find((x) => x.noVar === b.noVar);
    if (!v || !v.ada) return { ...dasar, ada: false, nilaiAbt: "", perlu: false, bisa: false, sebab: PESAN_NOMOR_SK_BELUM_TERPASANG };
    const nilaiAbt = v.nomor ?? "";
    if (v.dikunci) return { ...dasar, ada: true, nilaiAbt, perlu: false, bisa: false, sebab: "Variabel nomor SK dikunci di ABT dan tidak dapat diubah." };
    if (v.jenis !== "data_sql" || v.nomor === null) return { ...dasar, ada: true, nilaiAbt, perlu: false, bisa: false, sebab: "Isian nomor SK di ABT berbentuk lain - pasang ulang paket blangko terbaru." };
    // 17 Okt 2026: tidak ada kata ALETA di server SIPP/ABT. Boleh tersimpan di ALETA, tidak dapat diterapkan.
    if (menyebutAleta(literal)) return { ...dasar, ada: true, nilaiAbt, perlu: false, bisa: false, sebab: pesanTandaAletaSipp("Nomor SK") };
    return { ...dasar, ada: true, nilaiAbt, perlu: nilaiAbt !== literal, bisa: true, sebab: "" };
  });
}

export async function bacaLayarNomorSk(db: AletaDatabase) {
  const aleta = await bacaNomorSkAleta(db);
  let abt: KeadaanNomorSkBot | null = null;
  let galatAbt = "";
  try {
    abt = await bot<KeadaanNomorSkBot>("/nomor-sk", { timeoutMs: 30000 });
  } catch (e) {
    galatAbt = e instanceof Error ? e.message : String(e);
  }
  return {
    ...aleta,
    butir: DAFTAR_NOMOR_SK.map((b) => ({ kunci: b.kunci, noVar: b.noVar, label: b.label, keterangan: b.keterangan, sertakanTanggal: b.sertakanTanggal })),
    rencana: abt ? susunRencanaNomorSk(aleta.nilai, abt) : [],
    galatAbt,
  };
}

/**
 * Menerapkan nomor SK ALETA ke ABT. badan: {kunci?: ["majelis"]} (kosong = semua).
 * Tiap butir satu suntingan; yang gagal tidak menghentikan yang lain dan disebut sebabnya.
 */
export async function terapkanNomorSkKeAbt(db: AletaDatabase, aktor: AktorPengaturan, ip: string, badan: Record<string, unknown>) {
  wajibHak(aktor);
  const aleta = await bacaNomorSkAleta(db);
  const diminta = Array.isArray(badan.kunci) ? badan.kunci.map(String) : [];
  const dipilih = new Set(diminta.length ? diminta : DAFTAR_NOMOR_SK.map((b) => b.kunci));
  const abt = await bot<KeadaanNomorSkBot>("/nomor-sk", { timeoutMs: 30000 });
  const hasil: Array<{ kunci: string; noVar: string; ok: boolean; dilewati?: boolean; pesan: string; suntinganId?: string }> = [];
  for (const r of susunRencanaNomorSk(aleta.nilai, abt)) {
    if (!dipilih.has(r.kunci)) continue;
    if (!r.bisa) {
      hasil.push({ kunci: r.kunci, noVar: r.noVar, ok: false, pesan: r.sebab });
      continue;
    }
    if (!r.perlu) {
      hasil.push({ kunci: r.kunci, noVar: r.noVar, ok: true, dilewati: true, pesan: "Sudah sama - tidak diubah." });
      continue;
    }
    try {
      const h = await simpanNomorSkAbt(db, aktor, ip, {
        noVar: r.noVar,
        lama: r.nilaiAbt,
        baru: r.literal,
        ringkas: `nomor SK ${r.label}: "${r.nilaiAbt}" -> "${r.literal}" (#${r.noVar}#)`.slice(0, 480),
      });
      hasil.push({ kunci: r.kunci, noVar: r.noVar, ok: true, pesan: "Tersimpan di ABT.", suntinganId: h.suntinganId });
    } catch (e) {
      hasil.push({ kunci: r.kunci, noVar: r.noVar, ok: false, pesan: e instanceof Error ? e.message : String(e) });
    }
  }
  return { hasil };
}
