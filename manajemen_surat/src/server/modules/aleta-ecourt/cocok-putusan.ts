/**
 * Putusan SIPP vs dokumen putusan yang diunggah - sisi server (G4 4.3, 30 Okt 2026). HANYA MEMBACA SIPP.
 *
 *   1. bahan dari bot (/jadwal-sidang/putusan-dokumen): tanggal + amar UTUH + nama berkas;
 *   2. isi dokumen lewat jalur berkas SIPP yang sudah ada (jenis "putusan", id = perkara_id);
 *   3. RTF/DOCX/PDF dibaca pembaca yang sama dengan deteksi sisa blangko (PDF lewat pdfjs, baca-pdf.ts);
 *   4. aturan murni lib/cocok-putusan.ts; hasil terakhir disimpan di aleta_cocok_putusan (0117) - sidik
 *      bahan sama = tidak dibaca ulang dalam 6 jam.
 */

import { createHash } from "node:crypto";

import { bacaParagrafBerkas, teksDariParagraf } from "@/lib/berkas-ke-paragraf";
import { cocokkanPutusan, type HasilCocok } from "@/lib/cocok-putusan";
import { paragrafDariTeks } from "@/lib/deteksi-sisa-blangko";
import type { AletaDatabase } from "@/server/db/client";

export const UMUR_SINGGAH_MS = 6 * 60 * 60 * 1000;
const BATAS_BITA = 20 * 1024 * 1024;

export type BahanPutusanBot = {
  ok: boolean;
  alasan?: string;
  perkaraId?: number;
  nomorPerkara?: string;
  tanggalPutusan?: string;
  amarPutusan?: string;
  namaBerkas?: string;
  adaBerkas?: boolean;
};

export type DepsCocokPutusan = {
  bahan: (perkaraId: string) => Promise<{ ok: true; data: BahanPutusanBot } | { ok: false; error: string }>;
  /** Bita dokumen putusan (null = tidak ada / tidak terbaca). */
  berkas: (perkaraId: string) => Promise<Uint8Array | null>;
  kini?: () => Date;
};

export type HasilCocokPutusan = HasilCocok & { perkaraId: string; nomorPerkara: string; tanggalPutusan: string; dariSinggah: boolean; diperiksaPada: string };

async function teksDokumen(bita: Uint8Array, nama: string): Promise<string | null> {
  const { bacaPdfDariBita } = await import("@/server/modules/aleta-ecourt/baca-pdf");
  const r = await bacaParagrafBerkas(bita, nama || "putusan", async (b) => {
    const isi = await bacaPdfDariBita(b, nama || "putusan.pdf", 200);
    return paragrafDariTeks(isi.halaman.map((h) => h.teks).join("\n"));
  });
  if (!r.ok) return null;
  const t = teksDariParagraf(r.paragraf);
  return t.trim() ? t : "";
}

function ringkasHasil(h: HasilCocok) {
  if (h.keadaan === "beda") return h.beda.map((b) => b.ringkas).join("; ");
  return h.catatan || "";
}

export async function periksaCocokPutusan(db: AletaDatabase, perkaraId: string, deps: DepsCocokPutusan): Promise<HasilCocokPutusan> {
  const kini = (deps.kini ?? (() => new Date()))();
  const id = String(perkaraId ?? "").trim();
  const dasar = { perkaraId: id, nomorPerkara: "", tanggalPutusan: "", dariSinggah: false, diperiksaPada: kini.toISOString() };
  const bahan = await deps.bahan(id);
  if (!bahan.ok || !bahan.data.ok) {
    return { ...dasar, keadaan: "tidak-terbaca", beda: [], liputan: -1, catatan: "Data putusan SIPP belum terbaca." };
  }
  const b = bahan.data;
  const umum = { ...dasar, nomorPerkara: String(b.nomorPerkara ?? ""), tanggalPutusan: String(b.tanggalPutusan ?? "") };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(umum.tanggalPutusan)) return { ...umum, keadaan: "belum-putus", beda: [], liputan: -1, catatan: "" };

  let bita: Uint8Array | null = null;
  if (b.adaBerkas) {
    bita = await deps.berkas(id).catch(() => null);
    if (bita && bita.length > BATAS_BITA) bita = null;
  }
  const sidik = createHash("sha256")
    .update(`${umum.tanggalPutusan}\n${String(b.amarPutusan ?? "")}\n`)
    .update(bita ?? new Uint8Array())
    .digest("hex");

  const lama = await db
    .queryOne<{ keadaan: string; rincian: string; sidik: string; diperiksa_pada: string; ringkas: string }>(
      "SELECT keadaan, rincian, sidik, diperiksa_pada, ringkas FROM aleta_cocok_putusan WHERE perkara_id = ?",
      [id]
    )
    .catch(() => null);
  if (lama && lama.sidik === sidik && kini.getTime() - Date.parse(lama.diperiksa_pada) < UMUR_SINGGAH_MS) {
    let beda: HasilCocok["beda"] = [];
    try {
      beda = JSON.parse(lama.rincian || "[]");
    } catch {
      beda = [];
    }
    return { ...umum, keadaan: lama.keadaan as HasilCocok["keadaan"], beda, liputan: -1, catatan: lama.ringkas, dariSinggah: true, diperiksaPada: lama.diperiksa_pada };
  }

  const teks = bita ? await teksDokumen(bita, String(b.namaBerkas ?? "")) : null;
  const hasil: HasilCocok =
    b.adaBerkas && !bita
      ? { keadaan: "tidak-terbaca", beda: [], liputan: -1, catatan: "Dokumen putusan tercatat tetapi belum dapat dibaca dari server SIPP." }
      : teks === ""
        ? { keadaan: "tidak-terbaca", beda: [], liputan: -1, catatan: "Dokumen putusan tanpa teks (kemungkinan pindaian)." }
        : cocokkanPutusan({ tanggalPutusanSipp: umum.tanggalPutusan, amarSippHtml: String(b.amarPutusan ?? ""), teksDokumen: teks });

  const nilai = [umum.nomorPerkara, hasil.keadaan, ringkasHasil(hasil).slice(0, 500), JSON.stringify(hasil.beda).slice(0, 8000), sidik, umum.tanggalPutusan, kini.toISOString(), id];
  const ubah = await db
    .run(
      "UPDATE aleta_cocok_putusan SET nomor_perkara = ?, keadaan = ?, ringkas = ?, rincian = ?, sidik = ?, tanggal_putusan = ?, diperiksa_pada = ? WHERE perkara_id = ?",
      nilai
    )
    .catch(() => null);
  if (!ubah || !ubah.changes) {
    await db
      .run(
        "INSERT INTO aleta_cocok_putusan (nomor_perkara, keadaan, ringkas, rincian, sidik, tanggal_putusan, diperiksa_pada, perkara_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        nilai
      )
      .catch(() => null);
  }
  return { ...umum, ...hasil };
}

/** Untuk Pusat Kesehatan: perkara yang putusan SIPP-nya berbeda dengan dokumennya (90 hari terakhir pemeriksaan). */
export async function daftarBedaPutusan(db: AletaDatabase, kini = new Date(), batas = 20) {
  const sejak = new Date(kini.getTime() - 90 * 86_400_000).toISOString();
  return db
    .queryAll<{ perkara_id: string; nomor_perkara: string; ringkas: string; tanggal_putusan: string; diperiksa_pada: string }>(
      `SELECT perkara_id, nomor_perkara, ringkas, tanggal_putusan, diperiksa_pada FROM aleta_cocok_putusan
        WHERE keadaan = 'beda' AND diperiksa_pada >= ? ORDER BY diperiksa_pada DESC LIMIT ${Math.max(1, Math.min(200, Math.round(batas)))}`,
      [sejak]
    )
    .catch(() => []);
}
