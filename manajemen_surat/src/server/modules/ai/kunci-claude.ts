import { createHash } from "node:crypto";

import type { AletaDatabase } from "@/server/db/client";
import { PESAN_KUNCI_TAK_TERBACA, bacaKunciApiAman, bungkusUlangKunciPolos } from "@/server/modules/ai/kunci-tersimpan";

/**
 * ============================================================================
 * KUNCI CLAUDE UNTUK MODUL "ALETA Ai"
 * ============================================================================
 *
 * ALETA Ai (`aleta-ai/klien.ts`) hanya berbicara dengan Claude. Kuncinya
 * diambil dari koneksi AI tersimpan di Pengaturan AI global, dengan urutan:
 *
 *   1. koneksi Claude yang DIPILIH khusus untuk modul "aleta_ai";
 *   2. bila belum dipilih: koneksi Claude tersimpan pertama (aktif/terhubung
 *      didahulukan, yang gagal diuji paling akhir);
 *   3. bila tidak ada: env ANTHROPIC_API_KEY (perilaku lama);
 *   4. bila tidak ada pula: "belum ada" -> seluruh fitur menjawab belum aktif.
 *
 * Koneksi GLOBAL tidak pernah dipakai bila bukan Claude: modul ini tidak
 * mewarisi global. Model (Cepat/Teliti/Mendalam) tetap ditentukan tabel rute
 * ALETA Ai; dari koneksi hanya diambil KUNCI.
 *
 * Berkas ini hanya memuat pemilihan + pembacaan; kunci tidak pernah ditulis ke
 * log, galat, atau respons. Pemanggil harus memperlakukan `kunci` sebagai rahasia.
 */

export const MODUL_ALETA_AI = "aleta_ai";
export const PROVIDER_ALETA_AI = "claude";

export type KoneksiKandidat = {
  id: string;
  name: string;
  providerId: string;
  /** Ada tidaknya kunci tersimpan (bukan isinya). */
  punyaKunci: boolean;
  isActive: boolean;
  connectionStatus: string;
};

function peringkat(k: KoneksiKandidat) {
  // Aktif global / terhubung didahulukan, lalu belum diuji, gagal terakhir.
  if (k.connectionStatus === "failed") return 3;
  if (k.isActive) return 0;
  if (k.connectionStatus === "connected") return 1;
  return 2;
}

/**
 * Pilih koneksi Claude untuk ALETA Ai. `pilihanModulId` = koneksi yang dipilih
 * khusus (null = otomatis). Koneksi non-Claude, tanpa kunci, atau terhapus
 * (tak ada di daftar) tidak pernah terpilih.
 */
export function pilihKoneksiClaudeAletaAi(input: {
  pilihanModulId?: string | null;
  koneksi: KoneksiKandidat[];
}): { koneksi: KoneksiKandidat | null; dipilihKhusus: boolean } {
  const layak = input.koneksi.filter((k) => k.providerId === PROVIDER_ALETA_AI && k.punyaKunci);
  const khusus = input.pilihanModulId ? layak.find((k) => k.id === input.pilihanModulId) ?? null : null;
  if (khusus) return { koneksi: khusus, dipilihKhusus: true };
  const urut = layak
    .map((k, i) => ({ k, i }))
    .sort((a, b) => peringkat(a.k) - peringkat(b.k) || a.i - b.i)
    .map((x) => x.k);
  return { koneksi: urut[0] ?? null, dipilihKhusus: false };
}

export type SumberKunciAi =
  | { sumber: "pengaturan-ai"; kunci: string; koneksiId: string; namaKoneksi: string; dipilihKhusus: boolean }
  | { sumber: "env"; kunci: string }
  | { sumber: "belum"; alasan?: string };

/** Sidik pendek untuk membandingkan kunci tanpa menyimpannya di tempat lain. */
export function sidikKunci(kunci: string): string {
  return createHash("sha256").update(kunci).digest("hex").slice(0, 16);
}

type BarisKoneksi = {
  id: string;
  name: string | null;
  provider_id: string | null;
  api_key: string | null;
  is_active: number | boolean | null;
  connection_status: string | null;
};

/**
 * Baca sumber kunci dari basis data lalu env. Galat basis data (tabel belum
 * ada, dsb.) tidak melempar: jatuh ke env, agar ALETA Ai tidak mati karena
 * Pengaturan AI belum pernah dibuka.
 */
export async function tentukanSumberKunciAletaAi(db: AletaDatabase | null | undefined): Promise<SumberKunciAi> {
  let tidakTerbacaSemua = false;
  if (db) {
    try {
      const baris = await db
        .prepare(
          `SELECT id, name, provider_id, api_key, is_active, connection_status
           FROM ai_providers
           WHERE deleted_at IS NULL AND provider_id = ?`
        )
        .all<BarisKoneksi>(PROVIDER_ALETA_AI);
      let pilihanModulId: string | null = null;
      try {
        const modul = await db
          .prepare(`SELECT inherit_global, active_connection_id FROM ai_module_settings WHERE module_key = ?`)
          .get<{ inherit_global: number | boolean | null; active_connection_id: string | null }>(MODUL_ALETA_AI);
        if (modul && Number(modul.inherit_global ?? 1) === 0 && modul.active_connection_id) {
          pilihanModulId = modul.active_connection_id;
        }
      } catch {
        // Tabel pengaturan modul belum ada: berarti belum ada pilihan.
      }
      await bungkusUlangKunciPolos(db, baris);
      const kunciPerId = new Map<string, string>();
      const kandidat: KoneksiKandidat[] = [];
      let adaTakTerbaca = false;
      for (const b of baris) {
        // Kunci tersimpan terenkripsi; yang tak terbuka dihitung "tanpa kunci" tetapi diingat
        // agar alasannya jelas bila akhirnya tidak ada kunci sama sekali.
        const terbuka = bacaKunciApiAman(b.api_key);
        if (terbuka.tidakTerbaca) adaTakTerbaca = true;
        const kunci = terbuka.kunci.trim();
        if (kunci) kunciPerId.set(b.id, kunci);
        kandidat.push({
          id: b.id,
          name: String(b.name ?? "").trim() || b.id,
          providerId: String(b.provider_id ?? ""),
          punyaKunci: Boolean(kunci),
          isActive: Boolean(Number(b.is_active ?? 0)),
          connectionStatus: String(b.connection_status ?? "idle"),
        });
      }
      const { koneksi, dipilihKhusus } = pilihKoneksiClaudeAletaAi({ pilihanModulId, koneksi: kandidat });
      const kunci = koneksi ? kunciPerId.get(koneksi.id) : undefined;
      if (koneksi && kunci) {
        return { sumber: "pengaturan-ai", kunci, koneksiId: koneksi.id, namaKoneksi: koneksi.name, dipilihKhusus };
      }
      tidakTerbacaSemua = adaTakTerbaca;
    } catch {
      // Jatuh ke env.
    }
  }
  const env = String(process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (env) return { sumber: "env", kunci: env };
  return tidakTerbacaSemua ? { sumber: "belum", alasan: PESAN_KUNCI_TAK_TERBACA } : { sumber: "belum" };
}
