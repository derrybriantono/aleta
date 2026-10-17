import { hakPengaturanAbt } from "@/lib/pengaturan-abt";
import {
  DAFTAR_NOMOR_SK,
  GalatNomorSk,
  PESAN_NOMOR_SK_BELUM_TERPASANG,
  bersihkanPengaturanNomorSk,
  nilaiLiteral,
  nilaiLiteralTanggal,
  type PengaturanNomorSk,
} from "@/lib/nomor-sk";
import { menyebutAleta, pesanTandaAletaSipp } from "@/lib/tanda-aleta";
import { withTransaction, type AletaDatabase } from "@/server/db/client";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

import { KUNCI_NOMOR_SK, PENGGUNA_SISTEM, bacaNomorSkAleta } from "./nomor-sk-sumber";
import { bot, simpanNomorSkAbt, type AktorPengaturan } from "./service";

export { KUNCI_NOMOR_SK, bacaNomorSkAleta };

/**
 * ============================================================================
 * NOMOR DAN TANGGAL SK PENUNJUKAN - Integrasi e-Court (17 Okt 2026)
 * ============================================================================
 *
 * SATU sumber data (nomor-sk-sumber.ts, tanpa migrasi) untuk kartu ini, panel
 * penunjukan majelis, dan kartu SK majelis.
 *
 * Dua langkah yang sengaja TERPISAH (seperti identitas satker):
 *   1. SIMPAN di ALETA - tidak menyentuh ABT;
 *   2. TERAPKAN ke ABT - menulis teks literal ke variabel nomor (#9550#, nomor SK)
 *      dan variabel tanggal (#9551#, "27 Agustus 2026") lewat jalur pengaturan ABT
 *      yang sama (simpanNomorSkAbt: satu transaksi per variabel, nilai lama dicatat
 *      untuk Kembalikan, bot menyusun kueri baku dan menjaga prasyarat; tidak
 *      pernah INSERT).
 *
 * Variabel yang belum ada di ABT (paket blangko belum terpasang) tidak menggagalkan
 * penyimpanan: nilainya tetap di ALETA dan layar menyebutnya dengan kalimat awam.
 */

function wajibHak(aktor: AktorPengaturan) {
  if (!hakPengaturanAbt(aktor.roleId).ubahBawaan) throw new ApiError(403, "Hanya Super Admin dan Admin yang dapat mengubah nomor SK.");
}

const galatNomorSk = (e: unknown) => (e instanceof GalatNomorSk ? new ApiError(400, e.message) : e);

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

/** nomor = isi di kueri baku `SELECT '<isi>' AS data`; null bila kueri di ABT berbentuk lain. */
type VariabelNomorSkBot = { noVar: string; ada: boolean; nama: string; jenis: string; nomor: string | null; dikunci: boolean };
export type KeadaanNomorSkBot = { variabel: VariabelNomorSkBot[] };

export type ButirRencanaNomorSk = {
  kunci: string;
  bagian: "nomor" | "tanggal";
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

/** Apa yang akan berubah di ABT bila nomor dan tanggal SK ALETA diterapkan (murni - diuji). */
export function susunRencanaNomorSk(nilai: PengaturanNomorSk, abt: KeadaanNomorSkBot): ButirRencanaNomorSk[] {
  const hasil: ButirRencanaNomorSk[] = [];
  for (const b of DAFTAR_NOMOR_SK) {
    const n = nilai[b.kunci] ?? { nomor: b.bawaanNomor, tanggal: b.bawaanTanggal };
    const bagian: Array<{ bagian: "nomor" | "tanggal"; noVar: string; literal: string }> = [
      { bagian: "nomor", noVar: b.noVar, literal: nilaiLiteral(b, n) },
      { bagian: "tanggal", noVar: b.noVarTanggal, literal: nilaiLiteralTanggal(n) },
    ];
    for (const p of bagian) {
      const dasar = { kunci: b.kunci, bagian: p.bagian, noVar: p.noVar, label: b.label, keterangan: b.keterangan, literal: p.literal };
      const v = abt.variabel.find((x) => x.noVar === p.noVar);
      if (!v || !v.ada) {
        hasil.push({ ...dasar, ada: false, nilaiAbt: "", perlu: false, bisa: false, sebab: PESAN_NOMOR_SK_BELUM_TERPASANG });
        continue;
      }
      const nilaiAbt = v.nomor ?? "";
      const tolak = (sebab: string) => hasil.push({ ...dasar, ada: true, nilaiAbt, perlu: false, bisa: false, sebab });
      if (v.dikunci) tolak("Variabel nomor SK dikunci di ABT dan tidak dapat diubah.");
      else if (v.jenis !== "data_sql" || v.nomor === null) tolak("Isian nomor SK di ABT berbentuk lain - pasang ulang paket blangko terbaru.");
      else if (!p.literal) tolak(p.bagian === "nomor" ? "Nomor SK belum diisi." : "Tanggal SK belum diisi.");
      // 17 Okt 2026: tidak ada kata ALETA di server SIPP/ABT. Boleh tersimpan di ALETA, tidak dapat diterapkan.
      else if (menyebutAleta(p.literal)) tolak(pesanTandaAletaSipp(p.bagian === "nomor" ? "Nomor SK" : "Tanggal SK"));
      else hasil.push({ ...dasar, ada: true, nilaiAbt, perlu: nilaiAbt !== p.literal, bisa: true, sebab: "" });
    }
  }
  return hasil;
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
    butir: DAFTAR_NOMOR_SK.map((b) => ({ kunci: b.kunci, noVar: b.noVar, noVarTanggal: b.noVarTanggal, label: b.label, keterangan: b.keterangan })),
    rencana: abt ? susunRencanaNomorSk(aleta.nilai, abt) : [],
    galatAbt,
  };
}

/**
 * Menerapkan nomor dan tanggal SK ALETA ke ABT. badan: {kunci?: ["majelis"]} (kosong = semua).
 * Tiap variabel satu suntingan; yang gagal tidak menghentikan yang lain dan disebut sebabnya.
 */
export async function terapkanNomorSkKeAbt(db: AletaDatabase, aktor: AktorPengaturan, ip: string, badan: Record<string, unknown>) {
  wajibHak(aktor);
  const aleta = await bacaNomorSkAleta(db);
  const diminta = Array.isArray(badan.kunci) ? badan.kunci.map(String) : [];
  const dipilih = new Set(diminta.length ? diminta : DAFTAR_NOMOR_SK.map((b) => b.kunci));
  const abt = await bot<KeadaanNomorSkBot>("/nomor-sk", { timeoutMs: 30000 });
  const hasil: Array<{ kunci: string; bagian: string; noVar: string; ok: boolean; dilewati?: boolean; pesan: string; suntinganId?: string }> = [];
  for (const r of susunRencanaNomorSk(aleta.nilai, abt)) {
    if (!dipilih.has(r.kunci)) continue;
    const dasar = { kunci: r.kunci, bagian: r.bagian, noVar: r.noVar };
    if (!r.bisa) {
      hasil.push({ ...dasar, ok: false, pesan: r.sebab });
      continue;
    }
    if (!r.perlu) {
      hasil.push({ ...dasar, ok: true, dilewati: true, pesan: "Sudah sama - tidak diubah." });
      continue;
    }
    try {
      const h = await simpanNomorSkAbt(db, aktor, ip, {
        noVar: r.noVar,
        lama: r.nilaiAbt,
        baru: r.literal,
        ringkas: `${r.bagian === "nomor" ? "nomor" : "tanggal"} SK ${r.label}: "${r.nilaiAbt}" -> "${r.literal}" (#${r.noVar}#)`.slice(0, 480),
      });
      hasil.push({ ...dasar, ok: true, pesan: "Tersimpan di ABT.", suntinganId: h.suntinganId });
    } catch (e) {
      hasil.push({ ...dasar, ok: false, pesan: e instanceof Error ? e.message : String(e) });
    }
  }
  return { hasil };
}
