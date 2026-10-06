/**
 * ============================================================================
 * PANGGIL PETUGAS SIDANG DAN PARA PIHAK - SISI PERADEN PORTAL (BUTIR 33-36)
 * ============================================================================
 *
 * Tiga keputusan diambil di sini, bukan di layar:
 *
 *   1. NOMOR PETUGAS. SIPP tidak menyimpan telepon hakim, panitera, juru sita,
 *      maupun mediator. Satu-satunya nomor ada di akun ALETA
 *      (users.whatsapp_number) - sumber yang sama dengan daftar penerima
 *      pegawai bot. Dicari dua jalan, yang pasti didahulukan:
 *
 *        a. tautan akun SIPP: pejabat SIPP (hakim_id/panitera_id/jurusita_id)
 *           -> akun SIPP (user_hakim/user_panitera/user_jurusita) -> kredensial
 *           SIPP tersimpan di ALETA -> pemiliknya (bacaPemetaanJabatan).
 *           Disebut "terverifikasi".
 *        b. kecocokan NAMA tanpa gelar dengan akun ALETA yang aktif - pola
 *           kelengkapanDataService.cocokkanPegawai di bot. Hanya bila TEPAT
 *           SATU akun cocok, dan disebut "belum terverifikasi" (dicocokkan
 *           lewat nama) - pengirim harus menekan "kirim tetap".
 *
 *   2. NOMOR PIHAK dibaca bot dari SIPP beserta verifikasi nomornya
 *      (aleta_bot_nomor_terverifikasi). Nomor yang pemiliknya menjawab BUKAN
 *      tidak pernah dikirimi. Yang belum terverifikasi hanya dikirimi bila
 *      pengirim menyetujuinya dengan tegas (setujuBelumTerverifikasi).
 *
 *   3. KEADAAN BOT. Bot WhatsApp ALETA nonaktif sejak 7 September 2026 (dry
 *      run). Panggilan saat bot nonaktif / dry-run / tidak tersambung TIDAK
 *      diantre dan TIDAK disebut terkirim: hasilnya "tidak_dikirim" beserta
 *      sebabnya, dan riwayatnya tetap tercatat.
 *
 * Nomor utuh tidak pernah keluar dari peladen - jawaban ke peramban hanya
 * memuat nomor tersamar.
 */

import type { AletaDatabase } from "@/server/db/client";
import { bacaPemetaanJabatan, type AkunSiapPakai } from "@/server/modules/aleta-ecourt/pemetaan-jabatan";
import {
  getGatewayWhatsappStatus,
  getWhatsappRuntimeMode,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { getAletaBotSettingsSummary } from "@/server/modules/judicia/legal-form/jlf-aleta-bot-status-reader";
import { sendPortalWhatsappMessage } from "@/server/modules/whatsapp/portal-whatsapp-sender";
import { appendAuditLog } from "@/server/shared/audit";
import { nextPrefixedId } from "@/server/shared/ids";
import {
  kalimatPengumuman,
  kalimatPesanPetugas,
  kalimatPesanPihak,
  samarkanNomor,
  type GolonganSasaran,
  type KeadaanWhatsApp,
  type OrangSasaran,
  type StatusNomor,
} from "@/lib/panggil-petugas";
import { sebutanSatuPihak } from "@/lib/sebutan-pihak";

import { panggilBotPanggil } from "./gateway";

// ============================================================================
// BENTUK JAWABAN BOT
// ============================================================================

type BotPetugas = {
  kunci: string;
  golongan: "majelis" | "pp" | "js" | "mediator";
  pejabatId: string;
  hakimId?: string;
  nama: string;
  peran: string;
};

type BotPihak = {
  kunci: string;
  golongan: "pihak1" | "pihak2" | "pihak3" | "pihak4";
  jenis: "pihak" | "kuasa";
  nama: string;
  nomor: string;
  statusNomor: StatusNomor;
  keteranganNomor: string;
};

export type BotSasaran = {
  ok: boolean;
  alasan?: string;
  perkara: {
    perkaraId: string;
    nomorPerkara: string;
    alurPerkaraId: number | string | null;
    jenisPerkaraId: number | string | null;
    jenisPerkaraNama: string;
    ruang: string;
    agenda: string;
  };
  petugas: { majelis: BotPetugas[]; pp: BotPetugas[]; js: BotPetugas[]; mediator: BotPetugas[] };
  pihak: BotPihak[];
  tidakTerbaca: string[];
};

/** Satu orang lengkap DI PELADEN - `nomor` utuh tidak pernah dikirim ke peramban. */
export type OrangLengkap = OrangSasaran & { golongan: GolonganSasaran; nomor: string };

// ============================================================================
// NOMOR
// ============================================================================

/** 62812... atau "" bila bukan nomor WhatsApp Indonesia yang sah. */
export function nomorSah(nilai: string | null | undefined): string {
  let angka = String(nilai ?? "").replace(/\D/g, "");
  if (angka.startsWith("0")) angka = `62${angka.slice(1)}`;
  else if (angka.startsWith("8")) angka = `62${angka}`;
  return /^628\d{7,12}$/.test(angka) ? angka : "";
}

/**
 * Kunci nama tanpa gelar dan tanda baca - SAMA dengan namaKunci di
 * aleta_bot/services/kelengkapanDataService.js (diuji berdampingan).
 */
export function kunciNamaPegawai(nama: string | null | undefined): string {
  let teks = String(nama ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(",")[0]
    .toLowerCase();
  const gelarDepan = /^(?:prof|dr|drs|dra|ir|h|hj|kh|ust|ustadz)\.?\s+/;
  while (gelarDepan.test(teks)) teks = teks.replace(gelarDepan, "");
  return teks
    .replace(/\b(?:s\.?h\.?i?|m\.?h\.?i?|s\.?ag|s\.?sy|s\.?e|m\.?e|m\.?si|s\.?kom|s\.?sos|lc|ma|m\.?a)\b\.?/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type PenggunaAleta = { id: string; name: string; whatsapp_number: string };

const JABATAN_GOLONGAN: Record<BotPetugas["golongan"], "hakim" | "panitera" | "jurusita"> = {
  majelis: "hakim",
  mediator: "hakim",
  pp: "panitera",
  js: "jurusita",
};

/**
 * Nomor WhatsApp seorang petugas dari akun ALETA - lihat kepala berkas.
 * Fungsi murni: diuji tanpa basis data.
 */
export function cariNomorPetugas(
  orang: Pick<BotPetugas, "golongan" | "pejabatId" | "hakimId" | "nama">,
  pengguna: PenggunaAleta[],
  akun: Pick<AkunSiapPakai, "jabatan" | "pejabatId" | "pemilikUserId" | "diblokir">[]
): { nomor: string; statusNomor: StatusNomor; keteranganNomor: string } {
  const perId = new Map(pengguna.map((p) => [p.id, p]));

  // a. Tautan akun SIPP. Mediator non-hakim tidak punya akun SIPP pejabat.
  const pejabatId = orang.golongan === "mediator" ? String(orang.hakimId ?? "") : String(orang.pejabatId ?? "");
  if (pejabatId && pejabatId !== "0" && !(orang.golongan === "mediator" && !orang.hakimId)) {
    const jabatan = JABATAN_GOLONGAN[orang.golongan];
    const kandidat = akun
      .filter((a) => a.jabatan === jabatan && String(a.pejabatId) === pejabatId && a.pemilikUserId)
      .sort((x, y) => Number(x.diblokir) - Number(y.diblokir));
    for (const a of kandidat) {
      const p = perId.get(String(a.pemilikUserId));
      const nomor = nomorSah(p?.whatsapp_number);
      if (p && nomor) {
        return {
          nomor,
          statusNomor: "terverifikasi",
          keteranganNomor: `nomor akun ALETA ${p.name} (tertaut lewat akun SIPP)`,
        };
      }
    }
  }

  // b. Nama tanpa gelar - hanya bila tepat satu akun cocok.
  const kunci = kunciNamaPegawai(orang.nama);
  if (kunci) {
    const bernomor = pengguna.filter((p) => nomorSah(p.whatsapp_number));
    let cocok = bernomor.filter((p) => kunciNamaPegawai(p.name) === kunci);
    if (cocok.length === 0 && kunci.length >= 8) {
      cocok = bernomor.filter((p) => {
        const k = kunciNamaPegawai(p.name);
        return k.length >= 8 && (k.includes(kunci) || kunci.includes(k));
      });
    }
    if (cocok.length === 1) {
      return {
        nomor: nomorSah(cocok[0].whatsapp_number),
        statusNomor: "belum-terverifikasi",
        keteranganNomor: `dicocokkan lewat NAMA dengan akun ALETA ${cocok[0].name} - belum tertaut akun SIPP`,
      };
    }
    if (cocok.length > 1) {
      return {
        nomor: "",
        statusNomor: "tidak-ada",
        keteranganNomor: `${cocok.length} akun ALETA bernama mirip - tidak ditebak; tautkan akun SIPP-nya di Manajemen Akun`,
      };
    }
  }
  return {
    nomor: "",
    statusNomor: "tidak-ada",
    keteranganNomor: "tidak ada akun ALETA bernomor WhatsApp untuk petugas ini",
  };
}

// ============================================================================
// KEADAAN BOT WHATSAPP
// ============================================================================

export async function keadaanWhatsApp(db: AletaDatabase): Promise<KeadaanWhatsApp> {
  const mode = getWhatsappRuntimeMode();
  if (mode === "disabled") {
    return {
      dapatKirim: false,
      alasan: "Pengiriman WhatsApp ALETA dimatikan di server (WHATSAPP_RUNTIME_MODE=disabled). Panggilan tidak terkirim; riwayatnya tetap dicatat.",
    };
  }
  let setelan: Awaited<ReturnType<typeof getAletaBotSettingsSummary>>;
  try {
    setelan = await getAletaBotSettingsSummary(db);
  } catch {
    return { dapatKirim: false, alasan: "Setelan bot WhatsApp ALETA tidak terbaca - panggilan tidak dikirim." };
  }
  if (!setelan.botEnabled) {
    return {
      dapatKirim: false,
      alasan: "Bot WhatsApp ALETA sedang NONAKTIF (Pengaturan ALETA Bot). Panggilan TIDAK terkirim; yang tercatat hanya riwayatnya.",
    };
  }
  if (setelan.dryRunEnabled) {
    return {
      dapatKirim: false,
      alasan: "Bot WhatsApp ALETA dalam mode uji coba (dry-run): pesan tidak sungguh dikirim. Panggilan TIDAK terkirim; riwayatnya tetap dicatat.",
    };
  }
  if (mode === "aleta_bot") {
    const status = await getGatewayWhatsappStatus().catch(() => null);
    if (!status || !status.ok) {
      return { dapatKirim: false, alasan: "ALETA Bot tidak dapat dihubungi - panggilan tidak dikirim." };
    }
    if (status.data.status !== "connected") {
      return {
        dapatKirim: false,
        alasan: `WhatsApp bot belum tersambung (keadaan: ${status.data.status}). Pesan yang diantre baru terkirim saat tersambung, jadi panggilan tidak dikirim.`,
      };
    }
  }
  return { dapatKirim: true, alasan: "" };
}

// ============================================================================
// SASARAN
// ============================================================================

async function bacaPengguna(db: AletaDatabase): Promise<PenggunaAleta[]> {
  try {
    return await db
      .prepare(
        `SELECT id, name, whatsapp_number FROM users
          WHERE deleted_at IS NULL AND is_active = 1 AND whatsapp_number IS NOT NULL AND whatsapp_number <> ''`
      )
      .all<PenggunaAleta>();
  } catch {
    return [];
  }
}

export async function bacaSasaran(
  db: AletaDatabase,
  opsi: { perkaraId: string; tanggal?: string }
): Promise<
  | { ok: true; perkara: BotSasaran["perkara"]; orang: OrangLengkap[]; tidakTerbaca: string[] }
  | { ok: false; alasan: string }
> {
  const jawaban = await panggilBotPanggil<BotSasaran>(
    `/sasaran?perkaraId=${encodeURIComponent(opsi.perkaraId)}&tanggal=${encodeURIComponent(opsi.tanggal ?? "")}`
  );
  if (!jawaban.ok) return { ok: false, alasan: jawaban.error };
  const data = jawaban.data;
  if (!data.ok) return { ok: false, alasan: String(data.alasan || "Sasaran panggilan tidak terbaca.") };

  const [pengguna, pemetaan] = await Promise.all([
    bacaPengguna(db),
    bacaPemetaanJabatan(db).catch(() => ({ ok: false, galat: "", akun: [] as AkunSiapPakai[] })),
  ]);

  const orang: OrangLengkap[] = [];
  const petugas = [
    ...(data.petugas?.majelis ?? []),
    ...(data.petugas?.pp ?? []),
    ...(data.petugas?.js ?? []),
    ...(data.petugas?.mediator ?? []),
  ];
  for (const p of petugas) {
    const nomor = cariNomorPetugas(p, pengguna, pemetaan.akun);
    orang.push({
      kunci: p.kunci,
      golongan: p.golongan,
      nama: p.nama,
      peran: p.peran,
      jenis: "petugas",
      nomor: nomor.nomor,
      nomorTersamar: samarkanNomor(nomor.nomor),
      statusNomor: nomor.statusNomor,
      keteranganNomor: nomor.keteranganNomor,
    });
  }
  const bahan = {
    alurPerkaraId: data.perkara?.alurPerkaraId,
    jenisPerkaraId: data.perkara?.jenisPerkaraId,
    jenisPerkaraNama: data.perkara?.jenisPerkaraNama,
    nomorPerkara: data.perkara?.nomorPerkara,
  };
  for (const p of data.pihak ?? []) {
    const nomor = nomorSah(p.nomor);
    orang.push({
      kunci: p.kunci,
      golongan: p.golongan,
      nama: p.nama,
      peran: peranPihak(p.golongan, bahan, p.jenis),
      jenis: "pihak",
      nomor,
      nomorTersamar: samarkanNomor(nomor),
      statusNomor: nomor ? p.statusNomor : p.statusNomor === "bermasalah" ? "bermasalah" : "tidak-ada",
      keteranganNomor: p.keteranganNomor,
    });
  }
  return { ok: true, perkara: data.perkara, orang, tidakTerbaca: data.tidakTerbaca ?? [] };
}

/** Yang aman dikirim ke peramban: nomor utuh dibuang. */
/**
 * Sebutan pihak menurut golongannya. pihak3 = intervensi, pihak4 = turut
 * tergugat (butir 23, 6 Okt 2026) - sebelumnya keduanya tidak pernah menjadi
 * sasaran, dan selain pihak2 seluruhnya disebut pihak pertama.
 */
function peranPihak(golongan: BotPihak["golongan"], bahan: Parameters<typeof sebutanSatuPihak>[1], jenis: string) {
  const kuasa = String(jenis || "").toLowerCase() === "kuasa" ? "Kuasa " : "";
  if (golongan === "pihak4") return `${kuasa}Turut ${sebutanSatuPihak(2, bahan)}`;
  if (golongan === "pihak3") return `${kuasa}Intervensi`;
  return sebutanSatuPihak(golongan === "pihak2" ? 2 : 1, bahan, jenis);
}

export function untukPeramban(orang: OrangLengkap): OrangSasaran & { golongan: GolonganSasaran } {
  const { nomor: _nomor, ...sisa } = orang;
  void _nomor;
  return sisa;
}

// ============================================================================
// PANGGILAN
// ============================================================================

export type MasukanPanggil = {
  perkaraId: string;
  tanggal?: string;
  mediasiId?: string;
  konteks: "sidang" | "mediasi";
  kunci: string;
  saluran: "whatsapp" | "audio";
  ruang?: string;
  agenda?: string;
  nomorPerkara?: string;
  setujuBelumTerverifikasi?: boolean;
};

export type HasilPanggil = {
  ok: boolean;
  hasil:
    | "diantre"
    | "diumumkan"
    | "tidak_dikirim"
    | "nomor_tidak_ada"
    | "nomor_bermasalah"
    | "perlu_persetujuan"
    | "baru_saja_dipanggil"
    | "ditolak"
    | "gagal";
  pesan: string;
  teks?: string;
  riwayatId?: number;
};

type Pelaku = { id: string | null; nama: string; ip: string };

async function catatAudit(db: AletaDatabase, pelaku: Pelaku, masukan: MasukanPanggil, orang: OrangLengkap | null, hasil: HasilPanggil) {
  try {
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: pelaku.id,
      action: masukan.saluran === "audio" ? "PANGGIL_PETUGAS_AUDIO" : "PANGGIL_WHATSAPP",
      entityType: "perkara",
      entityId: String(masukan.perkaraId),
      payload: {
        konteks: masukan.konteks,
        mediasiId: masukan.mediasiId || undefined,
        sasaran: orang ? { kunci: orang.kunci, nama: orang.nama, peran: orang.peran, nomor: orang.nomorTersamar } : masukan.kunci,
        saluran: masukan.saluran,
        hasil: hasil.hasil,
        pesan: hasil.pesan,
        riwayatId: hasil.riwayatId,
        ip: pelaku.ip,
      },
    });
  } catch {
    /* audit portal cadangan; riwayat utama di aleta_bot_panggil_riwayat */
  }
}

export async function lakukanPanggilan(db: AletaDatabase, pelaku: Pelaku, masukan: MasukanPanggil): Promise<HasilPanggil> {
  const selesai = async (orang: OrangLengkap | null, hasil: HasilPanggil) => {
    await catatAudit(db, pelaku, masukan, orang, hasil);
    return hasil;
  };

  if (!/^\d{1,20}$/.test(String(masukan.perkaraId))) {
    return { ok: false, hasil: "ditolak", pesan: "Perkara tidak sah." };
  }
  if (masukan.saluran !== "whatsapp" && masukan.saluran !== "audio") {
    return { ok: false, hasil: "ditolak", pesan: "Saluran panggilan tidak dikenal." };
  }

  const sasaran = await bacaSasaran(db, { perkaraId: masukan.perkaraId, tanggal: masukan.tanggal });
  if (!sasaran.ok) {
    return selesai(null, { ok: false, hasil: "gagal", pesan: `Data petugas dan pihak tidak terbaca: ${sasaran.alasan}` });
  }
  const orang = sasaran.orang.find((o) => o.kunci === masukan.kunci) ?? null;
  if (!orang) {
    return selesai(null, {
      ok: false,
      hasil: "ditolak",
      pesan: "Orang ini tidak (lagi) tercatat pada perkara ini di SIPP - muat ulang jadwalnya.",
    });
  }
  // Saksi tidak pernah ada di daftar sasaran; pihak tidak pernah diumumkan
  // lewat pengeras suara (nama pihak sengaja tidak tampil di layar umum).
  if (masukan.saluran === "audio" && orang.jenis !== "petugas") {
    return selesai(orang, { ok: false, hasil: "ditolak", pesan: "Pengumuman suara hanya untuk petugas sidang." });
  }

  const nomorPerkara = sasaran.perkara.nomorPerkara || String(masukan.nomorPerkara ?? "").slice(0, 64);
  const ruang = String(masukan.ruang ?? "").trim().slice(0, 128) || sasaran.perkara.ruang;
  const agenda = String(masukan.agenda ?? "").trim().slice(0, 160) || sasaran.perkara.agenda;
  const dasarCatat = {
    perkaraId: masukan.perkaraId,
    mediasiId: masukan.mediasiId ?? "",
    konteks: masukan.konteks,
    nomorPerkara,
    sasaranKunci: orang.kunci,
    sasaranNama: orang.nama,
    sasaranPeran: orang.peran,
    sasaranJenis: orang.jenis,
    saluran: masukan.saluran,
    nomorTersamar: orang.nomorTersamar,
    ruang,
    oleh: pelaku.nama,
    olehUserId: pelaku.id ?? "",
    ip: pelaku.ip,
  };

  // --- Pengumuman suara ------------------------------------------------------
  if (masukan.saluran === "audio") {
    const teks = kalimatPengumuman({ peran: orang.peran, nama: orang.nama, ruang, nomorPerkara, konteks: masukan.konteks });
    const catat = await panggilBotPanggil<{ ok: boolean; id?: number; alasan?: string; pesan?: string }>("/catat", {
      method: "POST",
      body: { ...dasarCatat, teks, hasil: "diumumkan", keterangan: "diputar layar antrian / papan panggil yang suaranya menyala" },
    });
    if (!catat.ok) return selesai(orang, { ok: false, hasil: "gagal", pesan: `Pengumuman tidak tercatat: ${catat.error}`, teks });
    if (!catat.data.ok) {
      return selesai(orang, {
        ok: false,
        hasil: catat.data.alasan === "baru_saja_dipanggil" ? "baru_saja_dipanggil" : "gagal",
        pesan: String(catat.data.pesan || catat.data.alasan || "Pengumuman tidak tercatat."),
        teks,
      });
    }
    return selesai(orang, {
      ok: true,
      hasil: "diumumkan",
      pesan: "Pengumuman dikirim ke layar antrian dan papan panggil yang suaranya menyala (diputar dalam ±10 detik).",
      teks,
      riwayatId: catat.data.id,
    });
  }

  // --- Chat WhatsApp ----------------------------------------------------------
  const teks =
    orang.jenis === "petugas"
      ? kalimatPesanPetugas({ ruang, nomorPerkara, agenda, pemanggil: pelaku.nama, konteks: masukan.konteks })
      : kalimatPesanPihak({ ruang, nomorPerkara, agenda, pemanggil: pelaku.nama, konteks: masukan.konteks, sebutan: orang.peran });

  const catatTanpaKirim = async (hasil: HasilPanggil["hasil"], pesan: string) => {
    const catat = await panggilBotPanggil<{ ok: boolean; id?: number }>("/catat", {
      method: "POST",
      body: { ...dasarCatat, teks, hasil, keterangan: pesan, jedaDetik: 0 },
    });
    return selesai(orang, { ok: false, hasil, pesan, teks, riwayatId: catat.ok ? catat.data.id : undefined });
  };

  if (!orang.nomor) {
    return catatTanpaKirim("nomor_tidak_ada", `Tidak terkirim: ${orang.keteranganNomor}.`);
  }
  if (orang.statusNomor === "bermasalah") {
    return catatTanpaKirim("nomor_bermasalah", `Tidak terkirim: ${orang.keteranganNomor}.`);
  }
  if (orang.statusNomor !== "terverifikasi" && masukan.setujuBelumTerverifikasi !== true) {
    return {
      ok: false,
      hasil: "perlu_persetujuan",
      pesan: `Nomor ${orang.nomorTersamar} belum terverifikasi (${orang.keteranganNomor}). Tekan "Kirim tetap" bila yakin.`,
      teks,
    };
  }

  const wa = await keadaanWhatsApp(db);
  const catat = await panggilBotPanggil<{ ok: boolean; id?: number; alasan?: string; pesan?: string }>("/catat", {
    method: "POST",
    body: { ...dasarCatat, teks, hasil: "diproses" },
  });
  if (!catat.ok) return selesai(orang, { ok: false, hasil: "gagal", pesan: `Panggilan tidak tercatat: ${catat.error}`, teks });
  if (!catat.data.ok) {
    return selesai(orang, {
      ok: false,
      hasil: catat.data.alasan === "baru_saja_dipanggil" ? "baru_saja_dipanggil" : "gagal",
      pesan: String(catat.data.pesan || catat.data.alasan || "Panggilan tidak tercatat."),
      teks,
    });
  }
  const riwayatId = catat.data.id;
  const perbarui = (hasil: string, keterangan: string, antreanId = "") =>
    panggilBotPanggil("/perbarui", { method: "POST", body: { id: riwayatId, hasil, keterangan, antreanId } });

  if (!wa.dapatKirim) {
    await perbarui("tidak_dikirim", wa.alasan);
    return selesai(orang, { ok: false, hasil: "tidak_dikirim", pesan: wa.alasan, teks, riwayatId });
  }

  const kirim = await sendPortalWhatsappMessage({
    sourceFeature: "panggil_petugas",
    entityType: "perkara",
    entityId: `${masukan.perkaraId}-${riwayatId ?? Date.now()}`,
    eventType: masukan.saluran,
    recipientNumber: orang.nomor,
    recipientName: orang.nama,
    message: teks,
    category: orang.jenis === "petugas" ? "employee" : "party",
    priority: 1,
    dryRun: false,
    metadata: { nomorPerkara, recipientRole: orang.peran, konteks: masukan.konteks },
  });
  if (kirim.ok && (kirim.status === "enqueued" || kirim.status === "sent")) {
    await perbarui("diantre", kirim.message, String(kirim.queueId ?? ""));
    return selesai(orang, {
      ok: true,
      hasil: "diantre",
      pesan: `Pesan untuk ${orang.nama} (${orang.nomorTersamar}) masuk antrean bot WhatsApp ALETA.`,
      teks,
      riwayatId,
    });
  }
  if (kirim.status === "skipped") {
    await perbarui("tidak_dikirim", kirim.message);
    return selesai(orang, { ok: false, hasil: "tidak_dikirim", pesan: kirim.message, teks, riwayatId });
  }
  await perbarui("gagal", kirim.message);
  return selesai(orang, { ok: false, hasil: "gagal", pesan: kirim.message, teks, riwayatId });
}
