/**
 * ============================================================================
 * KAPASITAS PENYIMPANAN - LAYANAN PORTAL (30 Oktober 2026)
 * ============================================================================
 *
 * Setelan tersimpan di aleta_ekstensi_setelan (*sistem*, kunci
 * "kapasitas:setelan") - TANPA migrasi - lalu dicerminkan ke
 * setelan-host.json agar cron di server induk membacanya. Angka ruang dibaca
 * dari laporan.json yang ditulis cron itu; bila belum ada, dipakai partisi
 * yang sudah diukur ALETA Bot (Sumber daya server) sebagai cadangan.
 *
 * Pembersihan otomatis: MATI bawaan. Yang menjalankannya adalah cron host,
 * bukan portal; portal hanya mencatat setiap pembersihan ke jejak audit
 * (sekali per kejadian) supaya Super Admin dapat melihat siapa yang
 * mengizinkannya (setelan) dan kapan ia berjalan.
 */
import type { AletaDatabase } from "@/server/db/client";
import { bacaSetelanJson, bacaSetelanSistem, simpanSetelanSistem } from "@/server/modules/kesehatan/setelan";
import {
  bacaLaporanHost,
  bacaRiwayatPembersihan,
  mintaPeriksaHost,
  tulisSetelanHost,
} from "@/server/modules/kapasitas/penyimpanan";
import {
  SETELAN_BAWAAN,
  bolehBersihkanOtomatis,
  periksaSetelan,
  perintahPembersihan,
  setelanDariTersimpan,
  susunKapasitas,
  type HasilKapasitas,
  type PartisiBot,
  type RiwayatPembersihan,
  type SetelanKapasitas,
  type Warna,
} from "@/server/modules/kapasitas/hitung";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

export const KUNCI_SETELAN_KAPASITAS = "kapasitas:setelan";
export const KUNCI_JEJAK_KAPASITAS = "kapasitas:jejak-terakhir";

export async function bacaSetelanKapasitas(db: AletaDatabase): Promise<SetelanKapasitas> {
  const mentah = await bacaSetelanJson<SetelanKapasitas>(db, KUNCI_SETELAN_KAPASITAS);
  return mentah ? setelanDariTersimpan(mentah) : { ...SETELAN_BAWAAN };
}

export type PerubahanSetelan = { sebelum: SetelanKapasitas; sesudah: SetelanKapasitas };

/**
 * Menyimpan perubahan (sebagian). Menolak nilai buruk dengan 400. Menulis
 * cerminan untuk cron; kegagalan menulis cerminan TIDAK membatalkan simpanan
 * (dilaporkan di `cerminanTertulis`) supaya setelan tidak hilang karena folder
 * bersama sementara tidak dapat ditulis.
 */
export async function simpanSetelanKapasitas(
  db: AletaDatabase,
  masukan: unknown,
  sekarang = new Date().toISOString()
): Promise<PerubahanSetelan & { cerminanTertulis: boolean }> {
  const sebelum = await bacaSetelanKapasitas(db);
  const h = periksaSetelan(masukan, sebelum);
  if (!h.ok) throw new ApiError(400, h.pesan);
  await simpanSetelanSistem(db, KUNCI_SETELAN_KAPASITAS, JSON.stringify(h.setelan), sekarang);
  let cerminanTertulis = true;
  try {
    await tulisSetelanHost(h.setelan, sekarang);
  } catch {
    cerminanTertulis = false;
  }
  return { sebelum, sesudah: h.setelan, cerminanTertulis };
}

export type DataKapasitas = {
  setelan: SetelanKapasitas;
  kapasitas: HasilKapasitas;
  riwayat: RiwayatPembersihan[];
  /** Pembersihan otomatis akan berjalan pada pemeriksaan cron berikutnya. */
  akanDibersihkan: boolean;
  perintahPembersihan: string;
};

type Opsi = {
  /** Partisi dari ALETA Bot (cadangan). Dipanggil hanya bila laporan host tidak ada. */
  partisiBot?: () => Promise<PartisiBot[] | null>;
  kini?: Date;
};

/** Persen partisi data Docker dari hasil susunan (baris "partisi-docker"). */
export function persenPartisiDocker(k: HasilKapasitas): number | null {
  return k.baris.find((b) => b.kunci === "partisi-docker")?.persen ?? null;
}

export async function bacaKapasitas(db: AletaDatabase, opsi: Opsi = {}): Promise<DataKapasitas> {
  const [setelan, laporan, riwayat] = await Promise.all([bacaSetelanKapasitas(db), bacaLaporanHost(), bacaRiwayatPembersihan(20)]);
  let partisiBot: PartisiBot[] | null = null;
  if (!laporan && opsi.partisiBot) {
    try {
      partisiBot = await opsi.partisiBot();
    } catch {
      partisiBot = null;
    }
  }
  const kapasitas = susunKapasitas({ laporan, partisiBot, setelan, kini: opsi.kini ?? new Date() });
  return {
    setelan,
    kapasitas,
    riwayat,
    akanDibersihkan: kapasitas.sumber === "host" && !kapasitas.basi && bolehBersihkanOtomatis(setelan, persenPartisiDocker(kapasitas)),
    perintahPembersihan: perintahPembersihan(setelan.umurCacheJam),
  };
}

/** Tombol "Periksa sekarang": cron host mengukur ulang dalam ±1 menit. */
export async function mintaPeriksaSekarang(): Promise<{ diminta: true; pada: string }> {
  const pada = new Date().toISOString();
  try {
    await mintaPeriksaHost(pada);
  } catch {
    throw new ApiError(503, "Folder pertukaran dengan pemantau server tidak dapat ditulis. Periksa volume reports.");
  }
  return { diminta: true, pada };
}

/**
 * Pembersihan otomatis yang dicatat cron -> jejak audit, SEKALI per kejadian.
 * Penanda kejadian terakhir yang sudah dicatat disimpan di setelan sistem.
 */
export async function catatPembersihanBaru(db: AletaDatabase, riwayat: RiwayatPembersihan[]): Promise<number> {
  if (!riwayat.length) return 0;
  const terakhirDicatat = (await bacaSetelanSistem(db, KUNCI_JEJAK_KAPASITAS)) ?? "";
  const baru = riwayat.filter((r) => r.pada > terakhirDicatat).sort((a, b) => (a.pada < b.pada ? -1 : 1));
  for (const r of baru) {
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: null,
      action: "KAPASITAS_BERSIHKAN_CACHE_OTOMATIS",
      entityType: "aleta_ekstensi_setelan",
      entityId: `*sistem*:${KUNCI_SETELAN_KAPASITAS}`,
      payload: {
        pada: r.pada,
        perintah: r.perintah,
        sebabPersen: r.sebabPersen,
        ambangMerah: r.ambangMerah,
        umurJam: r.umurJam,
        dibebaskanByte: r.dibebaskanByte,
        kode: r.kode,
      },
      createdAt: r.pada,
    });
  }
  if (baru.length) await simpanSetelanSistem(db, KUNCI_JEJAK_KAPASITAS, baru[baru.length - 1].pada);
  return baru.length;
}

// ---------------------------------------------------------------------------
// Pusat kesehatan
// ---------------------------------------------------------------------------

export type RingkasKapasitasKesehatan = {
  warna: Warna;
  ringkas: string;
  rincian: Array<{ label: string; nilai: string }>;
};

/** Bentuk yang dimakan Pusat kesehatan sistem (komponen "kapasitas"). */
export function ringkasUntukKesehatan(d: DataKapasitas): RingkasKapasitasKesehatan {
  const k = d.kapasitas;
  const rincian: Array<{ label: string; nilai: string }> = [];
  for (const b of k.baris.filter((x) => x.jenis === "partisi")) {
    rincian.push({ label: b.nama, nilai: b.persen === null ? "belum terukur" : `${b.persen.toLocaleString("id-ID")}%${b.titik ? ` (${b.titik})` : ""}` });
  }
  rincian.push({ label: "Batas kuning / merah", nilai: `${d.setelan.ambangKuning}% / ${d.setelan.ambangMerah}%` });
  rincian.push({ label: "Pembersihan otomatis", nilai: d.setelan.pembersihanOtomatis ? "menyala" : "mati" });
  return { warna: k.ringkasan.warna, ringkas: k.ringkasan.pesan, rincian };
}
