import { type NextRequest } from "next/server";

import { buangGrupTersembunyiRtf } from "@/lib/buang-grup-tersembunyi-rtf";
import {
  type BarisDasar,
  type SunganBaris,
  hitungDaftarIsi,
  kodeKertasSah,
  nilaiTimpaDaftarIsi,
  saringNilaiTimpa,
} from "@/lib/berkas-perkara";
import { FITUR_BERKAS_PERKARA } from "@/lib/fitur-satker";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { pastikanBolehBerkas } from "@/server/modules/berkas-perkara/akses";
import { idPerkaraSah } from "@/server/modules/berkas-perkara/layanan";
import { pastikanFiturMenyala } from "@/server/modules/satker/fitur";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATAS_ISI_MS = 90_000;
const BATAS_BARIS = 400;

type HasilIsi = { ok?: boolean; sebab?: string; berkas?: string; jumlahTerisi?: number; kosong?: Array<{ noVar: string }>; mesinGalat?: string; rtfBase64?: string };

const teks = (x: unknown, maks = 200) => String(x ?? "").slice(0, maks);

/** Saring baris kiriman klien menjadi BarisDasar yang aman. */
function bersihkanBaris(mentah: unknown): BarisDasar[] {
  if (!Array.isArray(mentah)) return [];
  const hasil: BarisDasar[] = [];
  for (const m of mentah.slice(0, BATAS_BARIS)) {
    if (!m || typeof m !== "object") continue;
    const r = m as Record<string, unknown>;
    const bundel = r.bundel === "B" ? "B" : r.bundel === "A" ? "A" : null;
    const kunci = teks(r.kunci, 60);
    if (!bundel || !/^[a-z0-9_:.\-]{1,60}$/i.test(kunci)) continue;
    const halaman = Math.max(1, Math.min(999, Math.round(Number(r.halaman) || 1)));
    hasil.push({
      bundel,
      grup: teks(r.grup, 80),
      kunci,
      nama: teks(r.nama, 200),
      ket: teks(r.ket, 100),
      tanggal: teks(r.tanggal, 40),
      halaman,
      sumber: r.sumber === "perkiraan" ? "perkiraan" : "pasti",
      dasar: teks(r.dasar, 120),
    });
  }
  return hasil;
}

function bersihkanSunting(mentah: unknown): Record<string, Partial<SunganBaris>> {
  const hasil: Record<string, Partial<SunganBaris>> = {};
  if (!mentah || typeof mentah !== "object" || Array.isArray(mentah)) return hasil;
  for (const [kunci, v] of Object.entries(mentah as Record<string, unknown>).slice(0, BATAS_BARIS)) {
    if (!v || typeof v !== "object") continue;
    const r = v as Record<string, unknown>;
    hasil[kunci] = {
      tampil: r.tampil === false,
      urutan: 0,
      halamanTeks: teks(r.halamanTeks, 12),
      judulManual: teks(r.judulManual, 200),
      tanggalManual: teks(r.tanggalManual, 40),
      tambahan: r.tambahan === true,
    };
    hasil[kunci].tampil = r.tampil !== false;
  }
  return hasil;
}

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
    const jenis = badan.jenis === "sampul" ? "sampul" : badan.jenis === "daftar-isi" ? "daftar-isi" : null;
    if (!perkaraId || !jenis) throw new ApiError(400, "Perkara dan jenis (sampul | daftar-isi) harus disebutkan.");
    const kertas = kodeKertasSah(badan.kertas) ? badan.kertas : "a4";
    const berkas = await pastikanBolehBerkas(actor, jenis, kertas, teks(badan.sebagaiPeran, 10).toLowerCase());

    let nilai: Record<string, string>;
    let ringkas: Record<string, unknown> = {};
    if (jenis === "sampul") {
      nilai = saringNilaiTimpa(badan.nilai);
    } else {
      const baris = bersihkanBaris(badan.baris);
      const hitung = hitungDaftarIsi(baris, bersihkanSunting(badan.sunting), { bundelB: badan.bundelB === "lanjut" ? "lanjut" : "1" });
      nilai = nilaiTimpaDaftarIsi(hitung.baris);
      ringkas = { dokumen: hitung.total.A.dokumen + hitung.total.B.dokumen, halamanA: hitung.total.A.halaman, halamanB: hitung.total.B.halaman, perkiraan: hitung.total.A.perkiraan + hitung.total.B.perkiraan };
    }

    const hasil = await callAletaBotSippBridge<HasilIsi>(
      "blangko.isi",
      { folder: berkas.folder, berkas: berkas.berkas, perkaraId, sidangKe: 0, nilai, cadangan: {}, tanyaJawabSaksi: {} },
      { timeoutMs: BATAS_ISI_MS }
    );
    const data = hasil.data;
    if (!hasil.ok || !data?.ok || !data.rtfBase64) {
      return Response.json({ ok: false, alasan: data?.sebab ?? hasil.error ?? "Blangko tidak dapat diisi." }, { status: 502 });
    }
    const rtf = Buffer.from(buangGrupTersembunyiRtf(Buffer.from(data.rtfBase64, "base64")));
    return ok(
      {
        berkas: data.berkas ?? berkas.berkas,
        folder: berkas.folder,
        kertas,
        rtfBase64: rtf.toString("base64"),
        byte: rtf.length,
        jumlahTerisi: data.jumlahTerisi ?? 0,
        kosong: (data.kosong ?? []).map((k) => k.noVar),
        mesinGalat: data.mesinGalat ?? "",
        nilaiDikirim: Object.keys(nilai).length,
        ...ringkas,
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
