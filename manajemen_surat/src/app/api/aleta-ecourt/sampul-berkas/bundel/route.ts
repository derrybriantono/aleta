import { type NextRequest } from "next/server";

import { susunBundel, type BarisBundel } from "@/lib/bundel-berkas";
import { FITUR_BERKAS_PERKARA } from "@/lib/fitur-satker";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { idPerkaraSah } from "@/server/modules/berkas-perkara/layanan";
import { pastikanFiturMenyala } from "@/server/modules/satker/fitur";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATAS_BOT_MS = 90_000;
const BATAS_BARIS = 300;
const BATAS_PDF_MASUK_BASE64 = 12 * 1024 * 1024;
const BATAS_TOTAL_BYTE = 160 * 1024 * 1024;
const KUNCI_SAH = /^[A-Za-z0-9_:.\-]{1,60}$/;

type Dokumen = { kunci: string; berkas: number; pdf: number; bukanPdf: number; halaman: number | null; ragu: boolean };
type Isi = { berkas?: Array<{ kunci: string; base64: string }>; bukanPdf?: Record<string, number> };

/**
 * ============================================================================
 * BUNDEL SATU PDF PER PERKARA (5.1, 30 Okt 2026)
 * ============================================================================
 *
 *   POST { perkaraId, aksi: "periksa", kunci: [..] }
 *       jumlah halaman ASLI PDF tiap baris daftar isi (dibaca bot dari SIPP dan arsip e-Court; baca saja).
 *   POST { perkaraId, aksi: "susun", nomor?, sampulPdfBase64?, daftarIsiPdfBase64?, baris: [{ kunci, nama, awal, akhir }] }
 *       menggabung sampul, daftar isi, dan PDF tiap baris (urut seperti `baris`) menjadi satu PDF bernomor halaman sesuai daftar isi.
 *
 * Tidak ada yang disimpan (isinya memuat nama dan alamat para pihak) dan tidak ada yang ditulis ke SIPP maupun ABT.
 * Bersaklar sama dengan layar Sampul/Daftar Isi (Fitur Satker "berkas-perkara-khusus").
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanFiturMenyala(db, FITUR_BERKAS_PERKARA);
    const badan = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!badan || typeof badan !== "object") throw new ApiError(400, "Badan permintaan harus JSON.");
    const perkaraId = idPerkaraSah(badan.perkaraId);
    if (!perkaraId) throw new ApiError(400, "perkaraId harus angka.");

    if (badan.aksi === "periksa") {
      const kunci = (Array.isArray(badan.kunci) ? badan.kunci : []).map((k) => String(k)).filter((k) => KUNCI_SAH.test(k)).slice(0, BATAS_BARIS);
      const r = await callAletaBotSippBridge<{ ok?: boolean; sebab?: string; dokumen?: Dokumen[] }>("berkas.bundel", { perkaraId, kunci, mode: "periksa" }, { timeoutMs: BATAS_BOT_MS });
      const d = r.ok ? r.data : undefined;
      if (!r.ok || !d || d.ok === false) throw new ApiError(502, d?.sebab || "Bot ALETA tidak dapat membaca berkas perkara ini.");
      return ok({ dokumen: d.dokumen ?? [] }, { headers: { "Cache-Control": "no-store" } });
    }

    if (badan.aksi !== "susun") throw new ApiError(400, "aksi harus periksa atau susun.");
    const masuk = (Array.isArray(badan.baris) ? badan.baris : []).slice(0, BATAS_BARIS) as Array<Record<string, unknown>>;
    const baris: Array<{ kunci: string; nama: string; awal: number; akhir: number }> = [];
    for (const m of masuk) {
      const kunci = String(m.kunci ?? "");
      const awal = Math.round(Number(m.awal));
      const akhir = Math.round(Number(m.akhir));
      if (!KUNCI_SAH.test(kunci) || !Number.isFinite(awal) || !Number.isFinite(akhir) || awal < 1 || akhir < awal || akhir - awal > 2000) continue;
      baris.push({ kunci, nama: String(m.nama ?? "").slice(0, 200), awal, akhir });
    }
    if (!baris.length) throw new ApiError(400, "Tidak ada baris daftar isi yang dapat digabung.");
    const dekode = (x: unknown): Uint8Array | null => {
      const t = typeof x === "string" ? x : "";
      if (!t) return null;
      if (t.length > BATAS_PDF_MASUK_BASE64) throw new ApiError(413, "Sampul atau daftar isi terlalu besar.");
      return new Uint8Array(Buffer.from(t, "base64"));
    };
    const sampul = dekode(badan.sampulPdfBase64);
    const daftarIsi = dekode(badan.daftarIsiPdfBase64);

    // Satu baris sekali ambil: berkas satu perkara bisa puluhan megabita dan jembatan bot membawanya sebagai teks.
    const bahan: BarisBundel[] = [];
    let total = 0;
    for (const b of baris) {
      const r = await callAletaBotSippBridge<{ ok?: boolean; sebab?: string } & Isi>("berkas.bundel", { perkaraId, kunci: [b.kunci], mode: "isi" }, { timeoutMs: BATAS_BOT_MS });
      const d = r.ok ? r.data : undefined;
      if (!r.ok || !d || d.ok === false) throw new ApiError(502, `${b.nama || b.kunci}: ${d?.sebab || "berkas tidak terbaca dari bot."}`);
      const berkas = (d.berkas ?? []).filter((x) => x.kunci === b.kunci).map((x) => new Uint8Array(Buffer.from(x.base64, "base64")));
      total += berkas.reduce((n, x) => n + x.length, 0);
      if (total > BATAS_TOTAL_BYTE) throw new ApiError(413, "Seluruh berkas perkara terlalu besar untuk satu bundel PDF.");
      bahan.push({ ...b, berkas, bukanPdf: d.bukanPdf?.[b.kunci] ?? 0 });
    }
    const nomor = typeof badan.nomor === "string" ? badan.nomor.slice(0, 80) : "";
    const hasil = await susunBundel({ sampul, daftarIsi, baris: bahan, judul: nomor ? `Berkas Perkara ${nomor}` : "Berkas Perkara" });
    return ok(
      { pdfBase64: Buffer.from(hasil.pdf).toString("base64"), halaman: hasil.halaman, halamanSampul: hasil.halamanSampul, halamanDaftarIsi: hasil.halamanDaftarIsi, peringatan: hasil.peringatan, baris: hasil.baris },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BERKAS_PERKARA_BUNDEL_FAILED",
      feature: "aleta_ecourt",
      entityId: "sampul-berkas-bundel",
    });
  }
}
