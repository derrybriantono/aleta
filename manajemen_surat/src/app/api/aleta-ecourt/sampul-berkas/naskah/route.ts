import { type NextRequest } from "next/server";

import { kodeKertasSah } from "@/lib/berkas-perkara";
import { FITUR_BERKAS_PERKARA } from "@/lib/fitur-satker";
import { bersihkanPihak, jumlahDariDaftar, pihakBanyak } from "@/lib/lampiran-pihak";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { pastikanBolehBerkas } from "@/server/modules/berkas-perkara/akses";
import { idPerkaraSah } from "@/server/modules/berkas-perkara/layanan";
import { bacaLogoKopRtf } from "@/server/modules/berkas-perkara/logo-kop";
import { type HasilIsiBlangko, susunNaskahBerkas } from "@/server/modules/berkas-perkara/naskah";
import { pastikanFiturMenyala } from "@/server/modules/satker/fitur";
import { bacaSatkerAktif } from "@/server/modules/satker/identitas";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATAS_ISI_MS = 90_000;
const teks = (x: unknown, maks = 200) => String(x ?? "").slice(0, maks);

/**
 * ============================================================================
 * NASKAH RTF SAMPUL / DAFTAR ISI (isian ALETA menang atas isian ABT; tidak ada yang ditulis)
 * ============================================================================
 *
 *   POST { perkaraId, jenis: "sampul" | "daftar-isi", kertas?: "a4" | "f4" | "legal",
 *          nilai?: {kode: teks}                      // sampul: ciri, fokus, pokok perkara, isian tangan (blok paket saja)
 *          baris?: [...], sunting?: {...}, bundelB?: "1"|"lanjut" }   // daftar isi: baris akhir dan sunting; kolom dihitung DI SINI
 *
 * Blangko dibaca bot dari folder Derry (baca saja), semua penanda diisi mesin variabel ABT di bot dari data perkara, lalu nilai di atas
 * menimpa. Hak: sampul = folder PTSP; daftar isi = folder BAS (Panitera Sidang); Super Admin/Admin keduanya.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanFiturMenyala(db, FITUR_BERKAS_PERKARA);
    const badan = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!badan || typeof badan !== "object") throw new ApiError(400, "Badan permintaan harus JSON.");
    const perkaraId = idPerkaraSah(badan.perkaraId);
    const jenis = badan.jenis === "sampul" ? "sampul" : badan.jenis === "daftar-isi" ? "daftar-isi" : badan.jenis === "ceklist" ? "ceklist" : null;
    if (!perkaraId || !jenis) throw new ApiError(400, "Perkara dan jenis (sampul | daftar-isi) harus disebutkan.");
    const kertas = kodeKertasSah(badan.kertas) ? badan.kertas : "a4";
    // Sampul: bentuk "awal" (cetak awal, bawaan) atau "lengkap"; perkara berlawanan memakai tata letak berlawanan, permohonan tata letak permohonan.
    const bentuk = badan.bentuk === "lengkap" ? "lengkap" : "awal";
    const lawan = badan.lawan !== false;
    // Pihak banyak: varian RTF dua kolom nama bernomor romawi; lebih dari muat sampul = Lampiran Daftar Para Pihak (halaman kedua, hanya bila perlu).
    const pihak = bersihkanPihak(badan.pihak);
    const jumlah = jumlahDariDaftar(pihak);
    const banyak = badan.banyak === true || pihakBanyak(jumlah);
    const berkas = await pastikanBolehBerkas(actor, jenis, kertas, teks(badan.sebagaiPeran, 10).toLowerCase(), { bentuk, lawan, banyak: bentuk === "awal" && banyak });

    const hasil = await susunNaskahBerkas(
      badan,
      { jenis, kertas, bentuk, lawan, banyak: bentuk === "awal" && banyak },
      {
        isi: (nilai) => callAletaBotSippBridge<HasilIsiBlangko>("blangko.isi", { folder: berkas.folder, berkas: berkas.berkas, perkaraId, sidangKe: 0, nilai, cadangan: {}, tanyaJawabSaksi: {} }, { timeoutMs: BATAS_ISI_MS }),
        logoKop: () => bacaLogoKopRtf(db!),
        namaPengadilan: async () => (await bacaSatkerAktif(db!)).namaPengadilan,
        petugas: teks((actor as { name?: string; username?: string } | null)?.name || (actor as { username?: string } | null)?.username, 80),
        hariIni: () => new Date().toISOString().slice(0, 10),
      }
    );
    if (!hasil.ok) {
      if (/harus disertakan/.test(hasil.alasan)) throw new ApiError(400, hasil.alasan);
      return Response.json({ ok: false, alasan: hasil.alasan }, { status: 502 });
    }
    const data = hasil.data;
    return ok(
      {
        berkas: data.berkas ?? berkas.berkas,
        folder: berkas.folder,
        kertas,
        bentuk: jenis === "sampul" ? bentuk : undefined,
        bundelCetak: jenis === "daftar-isi" ? (badan.bundelCetak === "B" ? "B" : "A") : undefined,
        pihakBanyak: jenis === "sampul" ? banyak : undefined,
        lampiran: hasil.lampiran,
        ceklist: hasil.ceklist,
        muatPihak: hasil.muatPihak,
        rtfBase64: hasil.rtf.toString("base64"),
        byte: hasil.rtf.length,
        jumlahTerisi: data.jumlahTerisi ?? 0,
        kosong: (data.kosong ?? []).map((k) => k.noVar),
        mesinGalat: data.mesinGalat ?? "",
        nilaiDikirim: hasil.nilaiDikirim,
        ...hasil.ringkas,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BERKAS_PERKARA_NASKAH_FAILED",
      feature: "aleta_ecourt",
      entityId: "sampul-berkas-naskah",
    });
  }
}
