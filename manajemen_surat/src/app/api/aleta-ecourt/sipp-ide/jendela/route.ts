import { type NextRequest } from "next/server";

import { bacaBentukKontak } from "@/lib/jadwal-sidang-kontak";
import {
  cekTanggalSidang,
  dokumenJawaban,
  jadwalDariRincian,
  pilihSidang,
  ringkasPanggilan,
  susunUsulanTunda,
} from "@/lib/sipp-ide-jendela";
import type { KeadaanTundaMin, RencanaKalender, RiwayatTundaMin } from "@/lib/bawaan-tunda";
import type { AntrianSidangRingkas } from "@/lib/antrian-hasil-sidang";
import { getDatabase } from "@/server/db/client";
import {
  getGatewayArsipRincian,
  getGatewayKalenderSidang,
  getGatewayKeadaanSidang,
  getGatewayKesiapanSatu,
  getGatewayRincianSidang,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { panggilBotJadwalSidang } from "@/server/modules/aleta-ecourt/jadwal-sidang-gateway";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JENDELA = new Set(["tunda", "edit", "relaas", "sela", "rekonvensi", "saksi", "arsip"]);

/**
 * Bahan usulan jendela SIPP - Tahap M1 (SIPP dengan Ide ALETA gelombang 2).
 *
 *   GET ?jendela=tunda|edit|relaas|sela|rekonvensi|saksi|arsip&nomor=<nomor perkara>[&tanggal=YYYY-MM-DD]
 *
 * HANYA MEMBACA. Dipanggil ekstensi (sipp-ide-m1.js) dari jendela SIPP yang
 * sedang dibuka petugas; isiannya diisikan ke borang SIPP di peramban, dan
 * Simpan tetap ditekan petugas sendiri. Tidak ada yang ditulis ke SIPP dari
 * sini, dan tidak ada tanda ALETA yang ikut ke SIPP.
 *
 * Kewenangannya "panel", sama dengan sipp-konteks dan rincian sidang yang
 * sudah dibaca panel ALETA di halaman yang sama. Bagian yang mahal (keadaan
 * sidang, kesiapan, arsip e-Court) hanya dibaca untuk jendela yang memakainya.
 * Satu bagian gagal = bagian itu null, bagian lain tetap terkirim.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const q = request.nextUrl.searchParams;
    const jendela = String(q.get("jendela") || "").trim();
    const nomor = String(q.get("nomor") || "").trim().slice(0, 60);
    const tanggal = String(q.get("tanggal") || "").trim().slice(0, 10);
    if (!JENDELA.has(jendela)) return ok({ available: true, ok: false, alasan: "Jendela tidak dikenal." });
    if (!nomor) return ok({ available: true, ok: false, alasan: "Nomor perkara belum terbaca." });

    const rincian = await getGatewayRincianSidang(nomor, "");
    if (!rincian.ok) {
      return ok({ available: false, ok: false, alasan: rincian.error || "ALETA Bot belum dapat dihubungi." });
    }
    if (!rincian.data) return ok({ available: false, ok: false, alasan: "ALETA Bot belum dapat dihubungi." });
    const r = rincian.data;
    if (r.ok === false) return ok({ available: true, ok: false, alasan: r.alasan || "Perkara tidak ditemukan di SIPP." });

    const jadwal = jadwalDariRincian(r);
    const sidang = pilihSidang(jadwal, tanggal);
    const perkaraId = String(r.perkaraId || "");

    const hasil: Record<string, unknown> = {
      available: true,
      ok: true,
      jendela,
      nomorPerkara: r.nomorPerkara || nomor,
      perkaraId,
      jenisPerkara: r.jenisPerkara || "",
      jadwal,
      sidang,
      putusan: r.putusan
        ? {
            sudahPutus: Boolean(r.putusan.sudahPutus),
            tanggalPutusan: String(r.putusan.tanggalPutusan || "").slice(0, 10),
            tanggalMinutasi: String(r.putusan.tanggalMinutasi || "").slice(0, 10),
            tanggalBht: String(r.putusan.tanggalBht || "").slice(0, 10),
          }
        : null,
      panitera: (r.panitera || []).map((p) => ({ nama: p.nama })),
      jurusita: (r.jurusita || []).map((p) => ({ nama: p.nama })),
      relaas: (r.relaas || []).map((x) => ({
        namaPihak: x.namaPihak,
        peran: x.peran,
        tanggalRelaas: String(x.tanggalRelaas || "").slice(0, 10),
        bertemu: Boolean(x.bertemu),
        cara: x.caraRelaas ? x.caraRelaas.cara : "",
        sandi: x.caraRelaas ? x.caraRelaas.sandi : "",
        jurusitaNama: x.jurusitaNama,
      })),
    };

    if ((jendela === "tunda" || jendela === "edit") && sidang) {
      hasil.tunda = await bahanTunda(sidang.sidangId, perkaraId, jadwal);
    }
    if (jendela === "relaas" && sidang) {
      const k = await getGatewayKesiapanSatu({ nomor, sidangId: sidang.sidangId, tanggalSidang: sidang.tanggal, agenda: sidang.agenda }).catch(
        () => null
      );
      hasil.panggilan = k && k.ok && k.data && k.data.kesiapan ? ringkasPanggilan(k.data.kesiapan) : null;
    }
    if (jendela === "rekonvensi") {
      const a = await getGatewayArsipRincian(nomor).catch(() => null);
      hasil.jawabanEcourt = a && a.ok && a.data ? dokumenJawaban(a.data.dokumen) : null;
    }
    return ok(hasil);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_IDE_JENDELA_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

/** Keadaan + riwayat + Court Calendar + kontak e-Court -> usulanTundaSidang, lalu pemeriksaan tanggalnya. */
async function bahanTunda(sidangId: string, perkaraId: string, jadwal: ReturnType<typeof jadwalDariRincian>) {
  const keadaan = await getGatewayKeadaanSidang(sidangId).catch(() => null);
  const isi = (keadaan && keadaan.ok ? keadaan.data : null) as {
    ok?: boolean;
    keadaan?: KeadaanTundaMin;
    riwayat?: Omit<RiwayatTundaMin, "kalender" | "kontak">;
    antrian?: AntrianSidangRingkas;
  } | null;
  if (!isi || isi.ok === false || !isi.keadaan) return { usulan: null, kehadiranAntrian: null, cek: null, alasan: "Keadaan sidang belum dapat dibaca." };

  const id = /^\d{1,20}$/.test(perkaraId) ? perkaraId : String((isi.keadaan as { perkaraId?: unknown }).perkaraId || "");
  const [kal, kon] = isi.riwayat && id
    ? await Promise.all([
        panggilBotJadwalSidang<{ kalender?: unknown }>(`/kalender?${new URLSearchParams({ perkaraId: id }).toString()}`).catch(() => null),
        panggilBotJadwalSidang<{ kontak?: unknown }>(`/pihak-elektronik?${new URLSearchParams({ perkaraId: id }).toString()}`).catch(() => null),
      ])
    : [null, null];
  const kalender =
    kal && kal.ok && kal.data && Array.isArray(kal.data.kalender)
      ? (kal.data.kalender as RencanaKalender[]).filter((x) => x && typeof x.tanggal === "string")
      : null;
  const kontak = kon && kon.ok && kon.data ? bacaBentukKontak(kon.data.kontak) : null;

  const { usulan, kehadiranAntrian } = susunUsulanTunda({
    keadaan: isi.keadaan,
    riwayat: isi.riwayat,
    antrian: isi.antrian,
    kalender,
    kontak,
  });
  let cek = null;
  if (usulan) {
    const rekap = await getGatewayKalenderSidang(usulan.tanggal.slice(0, 7)).catch(() => null);
    const hari = rekap && rekap.ok && rekap.data && Array.isArray(rekap.data.hari) ? rekap.data.hari : null;
    cek = cekTanggalSidang(usulan.tanggal, { jadwal, kecualiSidangId: sidangId, rekapHari: hari });
  }
  return { usulan, kehadiranAntrian, cek, alasan: usulan ? "" : "Riwayat sidang perkara ini belum terbaca - usulan tunda tidak disusun." };
}
