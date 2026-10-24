import { randomUUID } from "node:crypto";

import { adaKataAleta, buangRujukanBelumTerverifikasi, DEFINISI_TUGAS, LABEL_TUJUAN, tanpaKataAleta, TANDA_DRAF, type JenisTugas, type TujuanKiriman } from "@/lib/aleta-ai/tugas";
import { bolehKemampuanAi } from "@/lib/matriks-peran";
import type { AletaDatabase } from "@/server/db/client";
import { golonganPelakuAi, type PelakuAi } from "@/server/modules/aleta-ai/akses";
import { bacaTimpaanKemampuan } from "@/server/modules/aleta-ai/kemampuan";
import { bukaIsi, sandiIsi } from "@/server/modules/aleta-ai/percakapan";
import { catatJejak } from "@/server/modules/aleta-ai/pengaturan";
import { proyekAktif } from "@/server/modules/aleta-ai/proyek";
import { cekHakTugas } from "@/server/modules/aleta-ai/tugas";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * ALETA Ai TAHAP 3 - KIRIM KE ALUR ALETA (Blangko ABT by Derry, Draf H-7, BAS)
 * ============================================================================
 *
 * DUA LANGKAH, keduanya oleh PETUGAS (tombol), tidak pernah oleh model:
 *   1. usulkanKiriman   - petugas menekan "Kirim ke ..."; server menyusun NILAI
 *                         yang akan dikirim dan menampilkannya (pratinjau);
 *                         status "menunggu-konfirmasi".
 *   2. konfirmasiKiriman - petugas menekan "Ya, kirim" atas pratinjau itu;
 *                         status "dikonfirmasi". Alur tujuan (Blangko Derry /
 *                         Draf H-7 / BAS) membacanya lewat kirimanUntukAlur(),
 *                         dan PETUGAS yang menyimpan di sana.
 * ALETA Ai tidak pernah menulis ke SIPP/ABT/e-Court: tabel ini milik ALETA.
 *
 * NILAI YANG DIKIRIM (dijaga di server, bukan di tombol):
 *   - data ASLI (kode samaran sudah dikembalikan di hasil tugas);
 *   - TANPA satu kata pun "ALETA" (tanpaKataAleta + pemeriksaan ulang);
 *   - rujukan pasal belum terverifikasi TIDAK dicetak (berkas resmi);
 *   - tanda "Draf AI" tidak ikut (bukan bagian naskah resmi).
 */

const teks = (n: unknown) => String(n ?? "").trim();
const BATAS_ISIAN = 100;
const BATAS_NILAI = 200_000;

export const TUJUAN_KIRIMAN: readonly TujuanKiriman[] = ["blangko-derry", "draf-h7", "bas"];

export type NilaiKiriman = { teks?: string; isian?: Record<string, string> };
export type KirimanTampil = { id: string; tugasId: string; tujuan: TujuanKiriman; label: string; nomorPerkara: string; status: string; nilai: NilaiKiriman; dibuat: string; dikonfirmasi: string };

type BarisKiriman = { id: string; tugas_id: string; pemilik_id: string; tujuan: string; nomor_perkara: string; nilai: string; status: string; dikonfirmasi_at: string; dibuat_at: string };

function tampil(b: BarisKiriman): KirimanTampil {
  let nilai: NilaiKiriman = {};
  try {
    nilai = JSON.parse(bukaIsi(b.nilai)) as NilaiKiriman;
  } catch {
    nilai = {};
  }
  return { id: b.id, tugasId: b.tugas_id, tujuan: b.tujuan as TujuanKiriman, label: LABEL_TUJUAN[b.tujuan as TujuanKiriman] ?? b.tujuan, nomorPerkara: b.nomor_perkara, status: b.status, nilai, dibuat: b.dibuat_at, dikonfirmasi: b.dikonfirmasi_at };
}

function bersihkan(nilai: string, pengetahuan: string): string {
  // Tanda draf dan penanda baris naskah putusan (#JUDUL, #P, ...) bukan bagian nilai resmi.
  const tanpaTanda = String(nilai ?? "").split(TANDA_DRAF).join("").replace(/^#[A-Z]{1,12}(?:[ \t]+|$)/gm, "");
  const hasil = tanpaKataAleta(buangRujukanBelumTerverifikasi(tanpaTanda, pengetahuan)).slice(0, BATAS_NILAI);
  if (adaKataAleta(hasil)) throw new ApiError(500, "Nilai kiriman masih memuat kata terlarang.");
  return hasil;
}

export async function usulkanKiriman(db: AletaDatabase, pelaku: PelakuAi, tugasId: string, m: { tujuan?: unknown; isian?: unknown }): Promise<KirimanTampil> {
  const tugas = await db.queryOne<{ id: string; pemilik_id: string; jenis: string; status: string; nomor_perkara: string; hasil: string }>(
    `SELECT id, pemilik_id, jenis, status, nomor_perkara, hasil FROM aleta_ai_tugas WHERE id = ?`,
    [teks(tugasId)]
  );
  if (!tugas || tugas.pemilik_id !== pelaku.id) throw new ApiError(404, "Tugas tidak ditemukan.");
  if (tugas.status !== "selesai") throw new ApiError(409, "Tugas belum selesai.");
  const tujuan = teks(m.tujuan) as TujuanKiriman;
  const def = DEFINISI_TUGAS[tugas.jenis as JenisTugas];
  if (!def || !TUJUAN_KIRIMAN.includes(tujuan) || !def.tujuanKirim.includes(tujuan)) throw new ApiError(400, "Tujuan kiriman tidak sah untuk tugas ini.");

  // Hak diperiksa ulang di server pada saat mengirim.
  const timpaan = await bacaTimpaanKemampuan(db);
  const hak = cekHakTugas(pelaku, tugas.jenis as JenisTugas, timpaan);
  if (!hak.boleh) throw new ApiError(403, hak.pesan);
  if (tujuan === "bas" && !bolehKemampuanAi(golonganPelakuAi(pelaku), "draf-bas", timpaan)) throw new ApiError(403, "Peran Anda tidak diberi hak mengirim ke BAS.");

  const proyek = await proyekAktif(db);
  const pengetahuan = proyek ? [proyek.corePrompt, ...proyek.modul.map((x) => x.isi)].join("\n") : "";
  let nilai: NilaiKiriman;
  if (tujuan === "blangko-derry") {
    const mentah = m.isian && typeof m.isian === "object" && !Array.isArray(m.isian) ? (m.isian as Record<string, unknown>) : null;
    const isian: Record<string, string> = {};
    // Tanpa pilihan: seluruh naskah sebagai satu isian; penandanya dipilih petugas di Blangko Derry.
    if (!mentah || !Object.keys(mentah).length) {
      const naskah = bukaIsi(tugas.hasil);
      if (!naskah.trim()) throw new ApiError(409, "Tugas tidak memiliki naskah.");
      isian.naskah = bersihkan(naskah, pengetahuan);
    }
    for (const [kode, v] of Object.entries(mentah ?? {}).slice(0, BATAS_ISIAN)) {
      if (!/^[\w#.\- ]{1,60}$/.test(kode) || typeof v !== "string") throw new ApiError(400, "Isian blangko tidak sah.");
      isian[kode] = bersihkan(v.slice(0, 5000), pengetahuan);
    }
    nilai = { isian };
  } else {
    const naskah = bukaIsi(tugas.hasil);
    if (!naskah.trim()) throw new ApiError(409, "Tugas tidak memiliki naskah.");
    nilai = { teks: bersihkan(naskah, pengetahuan) };
  }

  const id = `aik-${randomUUID()}`;
  await db.run(`INSERT INTO aleta_ai_kiriman (id, tugas_id, pemilik_id, tujuan, nomor_perkara, nilai, status, dibuat_at) VALUES (?, ?, ?, ?, ?, ?, 'menunggu-konfirmasi', ?)`, [
    id,
    tugas.id,
    pelaku.id,
    tujuan,
    tugas.nomor_perkara,
    sandiIsi(JSON.stringify(nilai)),
    new Date().toISOString(),
  ]);
  await catatJejak(db, { penggunaId: pelaku.id, peranId: pelaku.peranId, aksi: "kiriman.usul", percakapanId: tugas.id, hasil: "ok", ringkas: `tujuan=${tujuan}; nomor=${tugas.nomor_perkara}` });
  return tampil((await db.queryOne<BarisKiriman>(`SELECT * FROM aleta_ai_kiriman WHERE id = ?`, [id])) as BarisKiriman);
}

/** Konfirmasi petugas atas pratinjau. setuju=false = dibatalkan. Hanya pembuat usulan. */
export async function konfirmasiKiriman(db: AletaDatabase, pelaku: PelakuAi, id: string, setuju: boolean): Promise<KirimanTampil> {
  const b = await db.queryOne<BarisKiriman>(`SELECT * FROM aleta_ai_kiriman WHERE id = ?`, [teks(id)]);
  if (!b || b.pemilik_id !== pelaku.id) throw new ApiError(404, "Kiriman tidak ditemukan.");
  if (b.status !== "menunggu-konfirmasi") throw new ApiError(409, "Kiriman ini sudah diputuskan.");
  if (setuju && adaKataAleta(bukaIsi(b.nilai))) throw new ApiError(500, "Nilai kiriman masih memuat kata terlarang.");
  const waktu = new Date().toISOString();
  await db.run(`UPDATE aleta_ai_kiriman SET status = ?, dikonfirmasi_oleh = ?, dikonfirmasi_at = ? WHERE id = ? AND status = 'menunggu-konfirmasi'`, [
    setuju ? "dikonfirmasi" : "dibatalkan",
    pelaku.id,
    waktu,
    b.id,
  ]);
  await catatJejak(db, { penggunaId: pelaku.id, peranId: pelaku.peranId, aksi: setuju ? "kiriman.konfirmasi" : "kiriman.batal", percakapanId: b.tugas_id, hasil: "ok", ringkas: `tujuan=${b.tujuan}; nomor=${b.nomor_perkara}` });
  return tampil((await db.queryOne<BarisKiriman>(`SELECT * FROM aleta_ai_kiriman WHERE id = ?`, [b.id])) as BarisKiriman);
}

/** Dibaca alur tujuan: kiriman TERKONFIRMASI milik pengguna ini untuk perkara itu (draf rahasia: hanya pemiliknya). */
export async function kirimanUntukAlur(db: AletaDatabase, pelaku: PelakuAi, tujuan: string, nomorPerkara: string): Promise<KirimanTampil[]> {
  const t = teks(tujuan) as TujuanKiriman;
  if (!TUJUAN_KIRIMAN.includes(t)) throw new ApiError(400, "Tujuan kiriman tidak dikenal.");
  const baris = await db.queryAll<BarisKiriman>(
    `SELECT * FROM aleta_ai_kiriman WHERE pemilik_id = ? AND tujuan = ? AND status = 'dikonfirmasi'${nomorPerkara ? " AND nomor_perkara = ?" : ""} ORDER BY dikonfirmasi_at DESC LIMIT 20`,
    [pelaku.id, t, ...(nomorPerkara ? [teks(nomorPerkara)] : [])]
  );
  return baris.map(tampil);
}
