import { NextRequest } from "next/server";

import {
  ID_LANGKAH,
  jalankanSelesai,
  keadaanAwal,
  keadaanDariJson,
  type DepsSelesai,
  type HasilPdfSelesai,
  type HasilUnggah,
  type IdLangkah,
  type JenisBerkasSelesai,
  type KeadaanSelesai,
} from "@/lib/aleta-abt-selesai";
import type { AletaDatabase } from "@/server/db/client";
import { susunNaskah } from "@/server/modules/aleta-abt-cetak/naskah";
import { pdfLewatRuteAbt, type JawabanRutePdf } from "@/server/modules/aleta-abt-cetak/rute-pdf";
import { bacaKunci, tulisKunci } from "@/server/modules/tunda-otomatis/layanan";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * SELESAIKAN BERKAS - LAYANAN (5 Nov 2026, Tahap 6)
 * ============================================================================
 *
 * Satu rancangan kode untuk lima langkah (lib/aleta-abt-selesai.ts). Di sini hanya penyimpanan keadaan (aleta_abt_selesai: status dan
 * pesan singkat, TANPA PDF dan TANPA isi naskah), saklar tulis ke luar, dan kabel ke JALUR YANG SUDAH ADA:
 *   - PDF salinan dan garis Z/nomor halaman : rute abt/pdf (LibreOffice, tanda tangan, cap, Z) lewat rute-pdf.ts - tidak menulis ke luar;
 *   - e-Doc SIPP : rute putusan/unggah-sipp  (MENULIS KE SIPP)    - hanya bila saklar "edoc-sipp" menyala;
 *   - e-Court    : rute ecourt-putusan/unggah (MENULIS KE e-COURT) - hanya bila saklar "ecourt" menyala.
 * KEDUA SAKLAR BAWAAN MATI DAN TIDAK DINYALAKAN oleh kode ini. Rute-rute itu menjaga hak dan mencatat jejaknya sendiri; sesi pemanggil
 * diteruskan apa adanya. Hanya Super Admin yang sampai ke sini (rute pemanggil menjaganya di server).
 */

export const KUNCI_SAKLAR_TULIS_SELESAI = "aleta_abt_selesai_tulis";
const BATAS_JALAN_MS = 10 * 60 * 1000;

export type SaklarTulis = { "edoc-sipp": boolean; ecourt: boolean; diubahOleh: string; diubahPada: string };

/** Mati bawaan; ALETA_ABT_SELESAI_TULIS=0 mematikan keduanya apa pun isi saklarnya. */
export async function bacaSaklarTulis(db: AletaDatabase, env: Record<string, string | undefined> = process.env): Promise<SaklarTulis> {
  const t = await bacaKunci<Partial<SaklarTulis>>(db, KUNCI_SAKLAR_TULIS_SELESAI).catch(() => null);
  const mati = env.ALETA_ABT_SELESAI_TULIS === "0";
  return { "edoc-sipp": !mati && t?.["edoc-sipp"] === true, ecourt: !mati && t?.ecourt === true, diubahOleh: String(t?.diubahOleh ?? ""), diubahPada: String(t?.diubahPada ?? "") };
}

/** Mengubah saklar (hanya Super Admin; rute memastikan dan mencatat audit). */
export async function simpanSaklarTulis(db: AletaDatabase, aktor: { id: string; name: string }, badan: Record<string, unknown>): Promise<SaklarTulis> {
  const lama = await bacaSaklarTulis(db, {});
  const baru = {
    "edoc-sipp": typeof badan["edoc-sipp"] === "boolean" ? (badan["edoc-sipp"] as boolean) : lama["edoc-sipp"],
    ecourt: typeof badan.ecourt === "boolean" ? (badan.ecourt as boolean) : lama.ecourt,
    diubahOleh: aktor.name || aktor.id,
    diubahPada: new Date().toISOString(),
  };
  await tulisKunci(db, KUNCI_SAKLAR_TULIS_SELESAI, baru);
  return baru;
}

type BarisSelesai = { id: string; perkara_id: string; berkas_id: string; jenis_berkas: string; langkah: string; status: string; oleh: string; dibuat_at: string; diubah_at: string };

const kunciBaris = (perkaraId: string, berkasId: string) => `${perkaraId}|${berkasId}`;

export async function bacaKeadaanSelesai(db: AletaDatabase, perkaraId: string, berkasId: string): Promise<{ keadaan: KeadaanSelesai; ada: boolean; jenis: string; diubahAt: string }> {
  const b = await db.queryOne<BarisSelesai>("SELECT * FROM aleta_abt_selesai WHERE perkara_id = ? AND berkas_id = ?", [perkaraId, berkasId]);
  if (!b) return { keadaan: keadaanAwal(), ada: false, jenis: "", diubahAt: "" };
  return { keadaan: keadaanDariJson(b.langkah), ada: true, jenis: String(b.jenis_berkas), diubahAt: String(b.diubah_at) };
}

async function simpanKeadaan(db: AletaDatabase, p: { perkaraId: string; berkasId: string; jenis: JenisBerkasSelesai; oleh: string }, k: KeadaanSelesai) {
  const sekarang = new Date().toISOString();
  await db.run(
    `INSERT INTO aleta_abt_selesai (id, perkara_id, berkas_id, jenis_berkas, langkah, status, oleh, dibuat_at, diubah_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET jenis_berkas = excluded.jenis_berkas, langkah = excluded.langkah, status = excluded.status, oleh = excluded.oleh, diubah_at = excluded.diubah_at`,
    [kunciBaris(p.perkaraId, p.berkasId), p.perkaraId, p.berkasId, p.jenis, JSON.stringify(k), k.status, p.oleh.slice(0, 120), sekarang, sekarang]
  );
}

/** Langkah yang tampak "jalan" lebih dari batas dianggap macet (proses terputus), bukan sedang berjalan. */
function sedangJalan(k: KeadaanSelesai, sekarang: number): boolean {
  return ID_LANGKAH.some((i) => {
    const l = k.langkah[i];
    return l.status === "jalan" && sekarang - (Date.parse(l.mulai) || 0) < BATAS_JALAN_MS;
  });
}

export type PermintaanSelesai = {
  perkaraId: string;
  berkasId: string;
  jenis: JenisBerkasSelesai;
  nomorPerkara: string;
  sidangKe: number;
  ulangi: IdLangkah[];
};

export type KabelSelesai = {
  /** Mesin yang menyusun naskah dan membuat PDF. Bawaan: jalur yang sudah ada. */
  bangunPdf?: (p: PermintaanSelesai) => Promise<HasilPdfSelesai>;
  unggahEdoc?: (p: PermintaanSelesai, pdf: HasilPdfSelesai) => Promise<HasilUnggah>;
  unggahEcourt?: (p: PermintaanSelesai, pdf: HasilPdfSelesai) => Promise<HasilUnggah>;
  saklar?: (langkah: "edoc-sipp" | "ecourt") => Promise<boolean>;
  kini?: () => string;
};

// ---------------------------------------------------------------------------------------------------------------
// Kabel ke jalur yang sudah ada
// ---------------------------------------------------------------------------------------------------------------

export async function pdfSalinanDariNaskah(db: AletaDatabase, request: NextRequest, p: PermintaanSelesai): Promise<HasilPdfSelesai> {
  const n = await susunNaskah(db, { berkasId: p.berkasId, perkaraId: p.perkaraId, sidangKe: p.sidangKe, cetakFinal: true });
  if (!n.ok) throw new ApiError(n.status >= 400 && n.status < 600 ? n.status : 502, n.alasan);
  const pdf: JawabanRutePdf = await pdfLewatRuteAbt(request, n.rtf, true);
  if (pdf.available !== true || !pdf.pdfBase64) throw new ApiError(502, pdf.message || "PDF salinan belum dapat dibuat.");
  return { pdfBase64: pdf.pdfBase64, ...(pdf.zcross ? { zcross: pdf.zcross } : {}), ...(pdf.runut ? { runut: pdf.runut } : {}) };
}

/** Memanggil rute multipart yang sudah ada di dalam proses dengan sesi yang sama. */
async function panggilRuteForm(request: NextRequest, path: string, rute: (r: NextRequest) => Promise<Response>, form: FormData): Promise<Record<string, unknown>> {
  const kepala = new Headers(request.headers);
  kepala.delete("content-type");
  kepala.delete("content-length");
  const dalam = new NextRequest(new URL(path, request.url), { method: "POST", headers: kepala, body: form });
  const res = await rute(dalam);
  const isi = (await res.json().catch(() => null)) as { data?: Record<string, unknown> } & Record<string, unknown>;
  if (!res.ok || !isi) throw new ApiError(res.status || 502, "Unggahan tidak dapat diselesaikan.");
  return (isi.data ?? isi) as Record<string, unknown>;
}

const berkasPdf = (pdfBase64: string, nama: string) => new File([new Uint8Array(Buffer.from(pdfBase64, "base64"))], nama, { type: "application/pdf" });

/** e-Doc SIPP: rute unggah putusan yang sudah ada (menulis ke SIPP). HANYA dipanggil mesin bila saklar menyala. */
export async function unggahEdocLewatRute(request: NextRequest, p: PermintaanSelesai, pdf: HasilPdfSelesai): Promise<HasilUnggah> {
  if (!p.nomorPerkara) throw new ApiError(400, "Nomor perkara belum disebut untuk unggahan ke e-Doc SIPP.");
  const { POST } = await import("@/app/api/aleta-ecourt/putusan/unggah-sipp/route");
  const f = new FormData();
  f.set("perkaraId", p.perkaraId);
  f.set("nomorPerkara", p.nomorPerkara);
  f.set("putusan", berkasPdf(pdf.pdfBase64, "putusan.pdf"));
  const h = await panggilRuteForm(request, "/api/aleta-ecourt/putusan/unggah-sipp", POST, f);
  const ok = h.ok === true || h.berhasil === true;
  return { ok, pesan: ok ? "Terunggah ke e-Doc SIPP." : String(h.sebab ?? h.alasan ?? h.pesan ?? "e-Doc SIPP menolak berkas.").slice(0, 200) };
}

/** e-Court: rute unggah salinan putusan yang sudah ada (menulis ke e-Court). HANYA dipanggil mesin bila saklar menyala. */
export async function unggahEcourtLewatRute(request: NextRequest, p: PermintaanSelesai, pdf: HasilPdfSelesai): Promise<HasilUnggah> {
  if (!p.nomorPerkara) throw new ApiError(400, "Nomor perkara belum disebut untuk unggahan ke e-Court.");
  const { POST } = await import("@/app/api/aleta-ecourt/ecourt-putusan/unggah/route");
  const f = new FormData();
  f.set("nomor", p.nomorPerkara);
  f.set("berkas", berkasPdf(pdf.pdfBase64, "salinan.pdf"));
  f.set("konfirmasi", "1");
  const h = await panggilRuteForm(request, "/api/aleta-ecourt/ecourt-putusan/unggah", POST, f);
  const ok = h.ok === true;
  return { ok, pesan: ok ? "Terunggah ke e-Court." : String(h.pesan ?? h.alasan ?? "e-Court menolak berkas.").slice(0, 200) };
}

// ---------------------------------------------------------------------------------------------------------------
// Menjalankan
// ---------------------------------------------------------------------------------------------------------------

export async function jalankanSelesaikanBerkas(db: AletaDatabase, request: NextRequest, p: PermintaanSelesai, oleh: string, kabel: KabelSelesai = {}): Promise<{ keadaan: KeadaanSelesai; saklar: SaklarTulis }> {
  const kini = kabel.kini ?? (() => new Date().toISOString());
  const awal = await bacaKeadaanSelesai(db, p.perkaraId, p.berkasId);
  if (sedangJalan(awal.keadaan, Date.parse(kini()))) throw new ApiError(409, "Berkas ini sedang diselesaikan. Tunggu sebentar lalu muat ulang.");
  const deps: DepsSelesai = {
    jenis: p.jenis,
    bangunPdf: () => (kabel.bangunPdf ? kabel.bangunPdf(p) : pdfSalinanDariNaskah(db, request, p)),
    unggahEdoc: (pdf) => (kabel.unggahEdoc ? kabel.unggahEdoc(p, pdf) : unggahEdocLewatRute(request, p, pdf)),
    unggahEcourt: (pdf) => (kabel.unggahEcourt ? kabel.unggahEcourt(p, pdf) : unggahEcourtLewatRute(request, p, pdf)),
    catatStatus: async () => ({ ok: true, pesan: "Dicatat di ALETA. Belum ditampilkan di layar Status Perkara." }),
    saklar: kabel.saklar ?? (async (l) => (await bacaSaklarTulis(db))[l]),
    simpan: (k) => simpanKeadaan(db, { perkaraId: p.perkaraId, berkasId: p.berkasId, jenis: p.jenis, oleh }, k),
    kini,
  };
  const keadaan = await jalankanSelesai(awal.keadaan, deps, { ulangi: p.ulangi });
  return { keadaan, saklar: await bacaSaklarTulis(db) };
}
