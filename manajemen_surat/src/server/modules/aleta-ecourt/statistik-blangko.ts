import { randomUUID } from "node:crypto";

import {
  AKSI_BLANGKO_DICETAK,
  ENTITAS_BLANGKO,
  bersihkanCetak,
  susunStatistik,
  type CetakTercatat,
  type KatalogBlangko,
} from "@/lib/statistik-blangko";
import type { AletaDatabase } from "@/server/db/client";
import { bot } from "@/server/modules/pengaturan-abt/service";
import { appendAuditLog } from "@/server/shared/audit";

/**
 * Statistik pemakaian blangko (30 Okt 2026, G6 butir 6.4) - penyimpanan & baca.
 * Aturan murni di src/lib/statistik-blangko.ts. Tidak menulis ke SIPP/ABT.
 * Cetakan dicatat di audit_logs (tanpa migrasi): aksi BLANGKO_DICETAK, entitas
 * blangko_derry, entity_id "<folder>/<berkas>", payload tanpa isi naskah.
 */

export type AktorCetak = { id: string };

export async function catatCetak(db: AletaDatabase, aktor: AktorCetak, mentah: unknown) {
  const c = bersihkanCetak(mentah);
  if (!c) return { dicatat: false, sebab: "Laporan cetak tidak lengkap." };
  await appendAuditLog(db, {
    id: `ctk_${randomUUID()}`,
    actorUserId: aktor.id,
    action: AKSI_BLANGKO_DICETAK,
    entityType: ENTITAS_BLANGKO,
    entityId: (c.kelompok ? `${c.kelompok}/${c.berkas}` : c.berkas).slice(0, 400),
    payload: c,
  });
  return { dicatat: true, sebab: "" };
}

const BATAS_BARIS = 200_000;

function urai(json: unknown): Record<string, unknown> {
  try {
    const o = JSON.parse(String(json ?? ""));
    return o && typeof o === "object" ? (o as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Semua cetakan tercatat: audit_logs (lengkap dengan folder) + baris cetak aleta_blangko_lapor sebelum catatan pertama audit. */
export async function bacaCetakan(db: AletaDatabase): Promise<CetakTercatat[]> {
  const audit = await db.queryAll<Record<string, unknown>>(
    `SELECT payload_json, created_at FROM audit_logs WHERE action = ? ORDER BY created_at ASC LIMIT ${BATAS_BARIS}`,
    [AKSI_BLANGKO_DICETAK]
  );
  const hasil: CetakTercatat[] = audit.map((b) => {
    const p = urai(b.payload_json);
    return {
      kelompok: String(p.kelompok ?? ""),
      berkas: String(p.berkas ?? ""),
      jenisPerkara: String(p.jenisPerkara ?? ""),
      perkaraId: String(p.perkaraId ?? ""),
      pada: String(b.created_at ?? ""),
      sumber: "cetak",
    };
  });
  const awalAudit = hasil.length ? hasil[0].pada : "9999";
  let lama: Record<string, unknown>[] = [];
  try {
    lama = await db.queryAll<Record<string, unknown>>(
      `SELECT berkas, jenis_perkara, perkara_id, pada FROM aleta_blangko_lapor WHERE dicetak = 1 AND pada < ? ORDER BY pada ASC LIMIT ${BATAS_BARIS}`,
      [awalAudit]
    );
  } catch {
    lama = [];
  }
  for (const b of lama) {
    hasil.push({
      kelompok: "",
      berkas: String(b.berkas ?? ""),
      jenisPerkara: String(b.jenis_perkara ?? ""),
      perkaraId: String(b.perkara_id ?? ""),
      pada: String(b.pada ?? ""),
      sumber: "lapor",
    });
  }
  return hasil;
}

export async function bacaStatistik(db: AletaDatabase, opsi: { segarkan?: boolean } = {}) {
  const cetak = await bacaCetakan(db);
  let katalog: KatalogBlangko | null = null;
  let galatKatalog = "";
  try {
    katalog = await bot<KatalogBlangko>(`/blangko-katalog${opsi.segarkan ? "?segarkan=1" : ""}`, { timeoutMs: 90_000 });
  } catch (e) {
    galatKatalog = e instanceof Error ? e.message : String(e);
  }
  return { ...susunStatistik(cetak, katalog), galatKatalog };
}
