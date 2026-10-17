import { randomUUID } from "node:crypto";

import type { AletaDatabase } from "@/server/db/client";

/**
 * ============================================================================
 * IDENTITAS SATKER AKTIF - SATU SUMBER KODE SATKER (banyak satker, Tahap 0)
 * ============================================================================
 *
 * Kode satker dan nama pengadilan yang dipakai SELURUH fitur banyak-satker
 * (jejak akses super admin global, kanal pembaruan, saklar fitur, kontrak
 * Pusat) dibaca dari sini - bukan dari konstanta atau env yang tersebar.
 *
 * Sumbernya identitas satker yang sudah ada: tabel aleta_identitas_satker
 * (migrasi 0069; diisi Super Admin/Admin di Pengaturan SIPP & ABT >
 * Identitas satker, kodenya = KodePN SIPP, mis. "PA.Dgl"). Penyunting dan
 * penerapannya ke ABT tetap di server/modules/pengaturan-abt/identitas-satker.ts;
 * modul ini hanya MEMBACA, dengan satu kueri ringan, sehingga dapat dimuat dari
 * lapisan masuk (shared/auth) tanpa menarik modul pengaturan ABT yang berat.
 *
 * Urutan: identitas tersimpan > env ALETA_KODE_SATKER (pemasangan yang belum
 * mengisi identitas) > kosong. Kosong bukan galat - hanya "belum diatur".
 *
 * ID INSTALASI: UUID acak yang dibuat sekali per pemasangan dan disimpan di
 * aleta_ekstensi_setelan (pengguna *sistem*, tanpa migrasi). Dipakai Pusat
 * untuk membedakan dua pemasangan yang mengaku satker yang sama (salinan
 * cadangan, server uji). Bukan rahasia, bukan kredensial.
 */

const PENGGUNA_SISTEM = "*sistem*";
export const KUNCI_INSTALASI = "sistem:instalasi-id";

export type SatkerAktif = {
  kodeSatker: string;
  namaPengadilan: string;
  pengadilanTinggi: string;
  zonaWaktu: string;
  sumber: "identitas-tersimpan" | "env" | "belum-diatur";
};

const teks = (x: unknown) => String(x ?? "").trim();

export async function bacaSatkerAktif(db: AletaDatabase): Promise<SatkerAktif> {
  let baris: Record<string, unknown> | null = null;
  try {
    baris = await db.queryOne<Record<string, unknown>>(
      "SELECT kode_satker, nama_pengadilan, pengadilan_tinggi, zona_waktu FROM aleta_identitas_satker WHERE id = 1"
    );
  } catch {
    baris = null;
  }
  const dariBasis = {
    kodeSatker: teks(baris?.kode_satker),
    namaPengadilan: teks(baris?.nama_pengadilan),
    pengadilanTinggi: teks(baris?.pengadilan_tinggi),
    zonaWaktu: teks(baris?.zona_waktu),
  };
  if (dariBasis.kodeSatker) return { ...dariBasis, sumber: "identitas-tersimpan" };
  const dariEnv = teks(process.env.ALETA_KODE_SATKER).slice(0, 40);
  if (dariEnv) return { ...dariBasis, kodeSatker: dariEnv, sumber: "env" };
  return { ...dariBasis, sumber: "belum-diatur" };
}

/** Kode satker saja ("" bila belum diatur). */
export async function bacaKodeSatker(db: AletaDatabase): Promise<string> {
  return (await bacaSatkerAktif(db)).kodeSatker;
}

/** ID instalasi; dibuat sekali bila belum ada. Gagal membaca/menulis = "" (bukan galat). */
export async function pastikanInstalasiId(db: AletaDatabase): Promise<string> {
  try {
    const ada = await db.queryOne<{ nilai: string }>("SELECT nilai FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND kunci = ?", [
      PENGGUNA_SISTEM,
      KUNCI_INSTALASI,
    ]);
    if (ada && /^[\w-]{8,80}$/.test(teks(ada.nilai))) return teks(ada.nilai);
    const baru = randomUUID();
    await db
      .prepare(
        "INSERT INTO aleta_ekstensi_setelan (pengguna_id, kunci, nilai, diubah_pada) VALUES (?, ?, ?, ?) " +
          "ON CONFLICT (pengguna_id, kunci) DO NOTHING"
      )
      .run(PENGGUNA_SISTEM, KUNCI_INSTALASI, baru, new Date().toISOString());
    const sesudah = await db.queryOne<{ nilai: string }>("SELECT nilai FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND kunci = ?", [
      PENGGUNA_SISTEM,
      KUNCI_INSTALASI,
    ]);
    return teks(sesudah?.nilai);
  } catch {
    return "";
  }
}
