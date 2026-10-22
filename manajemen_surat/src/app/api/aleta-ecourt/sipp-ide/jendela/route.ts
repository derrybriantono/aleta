import { type NextRequest } from "next/server";

import { bacaBentukKontak } from "@/lib/jadwal-sidang-kontak";
import { nilaiRelaas } from "@/lib/kepatutan-relaas";
import {
  cekTanggalSidang,
  dokumenJawaban,
  jadwalDariRincian,
  pesanGagalJendela,
  pilihSidang,
  ringkasPanggilan,
  susunUsulanTunda,
} from "@/lib/sipp-ide-jendela";
import type { KeadaanTundaMin, RencanaKalender, RiwayatTundaMin } from "@/lib/bawaan-tunda";
import type { AntrianSidangRingkas } from "@/lib/antrian-hasil-sidang";
import { antrianDariRingkas, bahanKehadiranDariKeadaan, kehadiranUntukJendela } from "@/lib/kehadiran-rinci"; /* F3.2 */
import { bacaKehadiranSidang } from "@/server/modules/aleta-ecourt/kehadiran-rinci"; /* F3.2 */
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
    if (!JENDELA.has(jendela)) return ok({ available: true, ok: false, alasan: "Jendela ini belum dibantu ALETA." });
    if (!nomor) return ok({ available: true, ok: false, alasan: "Nomor perkara belum terbaca." });

    // Galat bot (kode, alamat internal, "HTTP 500") TIDAK diteruskan ke layar
    // petugas - hanya kalimat awam dari pesanGagalJendela.
    const rincian = await getGatewayRincianSidang(nomor, "").catch(() => null);
    if (!rincian || !rincian.ok || !rincian.data || rincian.data.ok === false) {
      const g = pesanGagalJendela(rincian && !rincian.ok ? rincian.error : rincian && rincian.data ? rincian.data.alasan : "");
      return ok({ available: g.tersambung, ok: false, alasan: g.pesan });
    }
    const r = rincian.data;

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
        sidangId: String(x.sidangId || ""),
        // W63 22 Okt: hasil panggilan menurut aturan bersama (SEMA 1/2023 untuk
        // surat tercatat, Pasal 718 RBg untuk jurusita) - ekstensi menampilkan
        // label ini apa adanya, tidak menyusun aturannya sendiri.
        kepatutan: (() => {
          const k = nilaiRelaas({
            ketTemu: x.caraRelaas ? x.caraRelaas.sandi : "",
            statusPos: x.statusPos,
            hasil: x.ketHasilRelaas,
            noResiPos: x.noResiPos,
            tanggalKirimPos: x.tanggalKirimPos,
            namaPihak: x.namaPihak,
            pihakKe: x.pihakKe,
          });
          const retur = k.retur || Boolean(x.retur);
          return {
            label: k.label,
            warna: k.warna,
            keterangan: k.keterangan,
            dasar: k.dasar,
            retur,
            labelRetur: retur ? k.labelRetur || "Retur" : "",
          };
        })(),
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
  if (!isi || isi.ok === false || !isi.keadaan) return { usulan: null, kehadiranAntrian: null, kehadiranRinci: null, cek: null, alasan: "Data sidang ini belum dapat dibaca ALETA - usulan tunda belum dapat disusun." };

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

  // F3.2: kehadiran rinci per orang sidang ini -> usulan "Dihadiri oleh" yang
  // menyebut siapa, untuk panel ekstensi. null = tidak ada yang tercatat.
  const keadaanBahan = isi.keadaan as unknown as {
    tanggalSidang?: string;
    alurPerkaraId?: number | null;
    jenisPerkaraId?: number | null;
    jenisPerkara?: string;
    nomorPerkara?: string;
  };
  const rinci = id ? await bacaKehadiranSidang(id, keadaanBahan.tanggalSidang) : null;
  const kehadiranRinci = kehadiranUntukJendela(rinci, antrianDariRingkas(isi.antrian), bahanKehadiranDariKeadaan(keadaanBahan));

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
  return { usulan, kehadiranAntrian, kehadiranRinci, cek, alasan: usulan ? "" : "Riwayat sidang perkara ini belum terbaca - usulan tunda tidak disusun." };
}
