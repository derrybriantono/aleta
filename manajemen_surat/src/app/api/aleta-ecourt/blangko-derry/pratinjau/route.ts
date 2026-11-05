import { type NextRequest } from "next/server";

import { buangGrupTersembunyiRtf } from "@/lib/buang-grup-tersembunyi-rtf";
import { golonganPengguna } from "@/lib/matriks-peran";
import { getEffectiveRoleId, isPrivilegedAdmin } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { isiJalurAleta } from "@/server/modules/aleta-abt-pustaka/jalur";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { bacaHakBlangko } from "@/server/modules/pengaturan-abt/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { ApiError } from "@/server/shared/errors";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

import { jenisDokumenAkun, jenisFolderDariJalur, type JenisDokumenDerry, type PeranTiruan } from "../susun";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AKAR_DERRY = "derry_briantono";
const PERAN_TIRUAN = new Set(["hakim", "pp", "js", "ptsp"]);
const teks = (x: unknown) => String(x ?? "").trim();

/** Jenis dokumen yang boleh dibuka sesi ini - aturan SAMA dengan GET blangko-derry (../route.ts), termasuk saklar hak dan "Lihat sebagai akun". */
async function jenisBolehSesi(actor: Parameters<typeof golonganPengguna>[0], sebagaiMinta: string): Promise<JenisDokumenDerry[]> {
  const admin = isPrivilegedAdmin(actor as Parameters<typeof isPrivilegedAdmin>[0]);
  const sebagaiPeran = admin && PERAN_TIRUAN.has(sebagaiMinta) ? (sebagaiMinta as PeranTiruan) : null;
  const golongan = golonganPengguna(actor);
  const dasar = { admin, golongan, sebagaiPeran };
  if (admin && !sebagaiPeran) return jenisDokumenAkun(dasar);
  let saklar: { hakimBas?: boolean; ppPutusan?: boolean } = {};
  if (jenisDokumenAkun(dasar).some((j) => j === "put" || j === "bas")) {
    try {
      const hak = await bacaHakBlangko();
      if (hak && hak.saklar) saklar = hak.saklar;
    } catch {
      /* hak menu tak terbaca: saklar dianggap mati */
    }
  }
  return jenisDokumenAkun({ ...dasar, saklar });
}

type HasilIsiPratinjau = {
  ok?: boolean;
  sebab?: string;
  berkas?: string;
  jumlahTerisi?: number;
  kosong?: Array<{ noVar: string; nama?: string; sebab?: string; status?: string }>;
  mesinGalat?: string;
  rtfBase64?: string;
};

/** Pratinjau memakai mesin variabel di bot (puluhan kueri dengan ingatan per naskah, ±0,5 dtk); lebih dari ini diserahkan ke ABT. */
const BATAS_PRATINJAU_MS = 60_000;

/**
 * ============================================================================
 * PRATINJAU NASKAH PANEL BLANGKO DERRY - MESIN ALETA, HITUNG SAJA (keputusan pengguna 4 Nov 2026, audit A1-01/A1-02)
 * ============================================================================
 *
 *   POST { perkaraId, sidangKe?, folder, berkas, sebagaiPeran? }
 *
 * Blangko dibaca dari server dan semua penandanya diisi mesin variabel di bot dari data perkara dan isian yang SUDAH tersimpan di
 * ABT (tanpa ketikan lepas, tanpa menyimpan apa pun) - bentuk yang sama dengan abt/preview tetapi tanpa menghitung ulang tiap
 * kemunculan penanda dan tanpa memanggil prosedur penataan jadwal sidang yang MENULIS ke SIPP. Hanya untuk PRATINJAU: cetak resmi
 * tetap lewat ABT. Hak dokumen sama dengan GET di atas (jenis folder dinilai dari sesi) ditambah kemampuan "blangko-abt" karena
 * naskah memuat data perkara. Jawaban memuat `galat` bila mesin ragu (variabel galat / tidak ada di katalog / mesin tak terbaca):
 * ekstensi lalu memakai pratinjau ABT lama.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");
    const badan = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!badan || typeof badan !== "object") return Response.json({ ok: false, alasan: "Badan permintaan harus JSON." }, { status: 400 });

    const perkaraId = teks(badan.perkaraId);
    const folder = teks(badan.folder).replace(/^\/+|\/+$/g, "");
    const berkas = teks(badan.berkas);
    const sidangKe = Math.max(0, Math.min(99, Math.trunc(Number(badan.sidangKe) || 0)));
    if (!/^\d+$/.test(perkaraId) || !folder || !berkas) {
      return Response.json({ ok: false, alasan: "Perkara, folder, dan berkas harus disebutkan." }, { status: 400 });
    }
    if (folder.includes("..") || folder.includes("\\") || berkas.includes("/") || berkas.includes("\\") || berkas.includes("..")) {
      return Response.json({ ok: false, alasan: "Nama folder atau berkas tidak sah." }, { status: 400 });
    }
    const jenisBoleh = await jenisBolehSesi(actor, teks(badan.sebagaiPeran).toLowerCase());
    const jenisFolder = jenisFolderDariJalur(folder);
    if (!jenisFolder || !jenisBoleh.includes(jenisFolder)) {
      throw new ApiError(403, "Folder blangko ini bukan untuk peran akun Anda.");
    }
    await pastikanKapabilitas(db, actorUserId, "blangko-abt");

    // Tombol Lihat di naskah (keputusan 202): fitur ALETA ABT yang baru, sementara hanya Super Admin. Permintaan akun lain diabaikan.
    const tandaLihat = badan.tandaLihat === true && getEffectiveRoleId(actor as Parameters<typeof getEffectiveRoleId>[0]) === "super-admin";

    const namaBerkas = /\.(rtf|docx?|odt)$/i.test(berkas) ? berkas : `${berkas}.rtf`;
    const jalurFolder = folder.startsWith(`${AKAR_DERRY}/`) || folder === AKAR_DERRY ? folder : `${AKAR_DERRY}/${folder}`;

    // Jalur ALETA ABT (Tahap 4): HANYA bila diminta eksplisit (`jalurAleta: true`) dan hanya Super Admin (dijaga di jalur.ts, 403 untuk lainnya).
    // Tanpa opsi ini seluruh alur di bawah tidak berubah.
    if (badan.jalurAleta === true) {
      const j = await isiJalurAleta(actor as Parameters<typeof isiJalurAleta>[0], { folder: jalurFolder, berkas: namaBerkas, perkaraId, sidangKe, cetakFinal: badan.cetakFinal === true });
      return Response.json(j.ok ? { ok: true, data: j.badan } : j.badan, { status: j.ok ? 200 : j.status, headers: { "Cache-Control": "no-store" } });
    }

    const hasil = await callAletaBotSippBridge<HasilIsiPratinjau>(
      "blangko.isi",
      { folder: jalurFolder, berkas: namaBerkas, perkaraId, sidangKe, nilai: {}, cadangan: {}, tanyaJawabSaksi: {}, segar: true, ...(tandaLihat ? { tandaLihat: true } : {}) },
      { timeoutMs: BATAS_PRATINJAU_MS }
    );
    const data = hasil.data;
    if (!hasil.ok || !data?.ok || !data.rtfBase64) {
      return Response.json({ ok: false, alasan: data?.sebab ?? hasil.error ?? "Blangko tidak dapat diisi." }, { status: 502 });
    }
    const kosong = (data.kosong ?? []).map((k) => ({ noVar: teks(k.noVar), nama: teks(k.nama), sebab: teks(k.sebab), status: teks(k.status) }));
    // Variabel yang GALAT (kueri gagal, lingkaran, tidak ada di katalog) berbeda dari yang sekadar kosong: ABT yang berwenang menjawabnya.
    const galat = kosong.filter((k) => k.status === "galat" || k.status === "takada" || /^mesin ABT tidak terbaca/i.test(k.sebab));
    const rtf = Buffer.from(buangGrupTersembunyiRtf(Buffer.from(data.rtfBase64, "base64")));
    return ok(
      {
        berkas: data.berkas ?? namaBerkas,
        rtfBase64: rtf.toString("base64"),
        byte: rtf.length,
        jumlahTerisi: data.jumlahTerisi ?? 0,
        kosong: kosong.length,
        galat: galat.map((k) => ({ nama: k.nama, sebab: k.sebab })).slice(0, 12),
        jumlahGalat: galat.length,
        mesinGalat: data.mesinGalat ?? "",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BLANGKO_DERRY_PRATINJAU_FAILED",
      feature: "aleta_ecourt",
      entityId: "blangko-derry-pratinjau",
    });
  }
}
