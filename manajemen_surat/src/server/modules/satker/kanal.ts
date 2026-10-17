import { APP_VERSION } from "@/lib/patch-notes";
import { bersihkanIzinPusat, saluranSah, type IzinPusat, type SaluranSatker } from "@/lib/fitur-satker";
import {
  GalatKanalPembaruan,
  KANAL_BAWAAN,
  bersihkanAlamatPusat,
  bersihkanJawabanCek,
  bersihkanPengaturanKanal,
  hitungPembaruan,
  isiBertandatangan,
  susunPermintaanCek,
  type KeadaanPembaruan,
  type KomponenPembaruan,
  type PengaturanKanal,
} from "@/lib/kanal-pembaruan";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { bacaSatkerAktif, pastikanInstalasiId } from "@/server/modules/satker/identitas";
import { bacaSetelanSistem, tulisSetelanSistem } from "@/server/modules/satker/setelan";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";
import { describeNetworkError, outboundFetch } from "@/server/shared/outbound-http";
import { kunciPublikPusat, periksaTandatangan } from "@/server/shared/pusat-tanda-tangan";

/**
 * ============================================================================
 * KANAL PEMBARUAN SATKER (banyak satker, Tahap 0)
 * ============================================================================
 *
 * Menyimpan saluran (stabil/uji-coba) dan alamat ALETA Pusat milik satker ini,
 * serta menjalankan "cek pembaruan ke Pusat" bila alamatnya ada. Kontraknya di
 * lib/kanal-pembaruan.ts. TIDAK mengubah mekanisme pembaruan yang berjalan:
 *   - pembaruan portal  : system-update (manifest + skrip host) tetap;
 *   - pembaruan ekstensi: update_url -> updates.xml -> .crx tetap; rute itu
 *     hanya MEMBACA saluran satker (header X-Aleta-Saluran).
 * Hasil cek hanya DICATAT dan ditampilkan; tidak ada paket yang diunduh atau
 * diterapkan otomatis.
 *
 * Kunci setelan: sistem:kanal-pembaruan (pilihan satker), sistem:izin-pusat
 * (plafon fitur terakhir yang diterima dari Pusat), sistem:pusat-terakhir
 * (hasil cek terakhir, termasuk saluran yang dipaksa Pusat).
 */

export const KUNCI_KANAL = "sistem:kanal-pembaruan";
export const KUNCI_IZIN_PUSAT = "sistem:izin-pusat";
export const KUNCI_PUSAT_TERAKHIR = "sistem:pusat-terakhir";

export async function bacaKanal(db: AletaDatabase): Promise<PengaturanKanal> {
  return bersihkanPengaturanKanal(await bacaSetelanSistem(db, KUNCI_KANAL)) ?? { ...KANAL_BAWAAN };
}

export async function bacaIzinPusat(db: AletaDatabase): Promise<IzinPusat> {
  return bersihkanIzinPusat(await bacaSetelanSistem(db, KUNCI_IZIN_PUSAT));
}

export type PusatTerakhir = {
  diperiksaPada: string;
  saluranDipaksa: SaluranSatker | null;
  pesan: string;
  pembaruan: Array<Pick<KeadaanPembaruan, "komponen" | "terpasang" | "tersedia" | "adaPembaruan" | "langsungDapat">>;
};

export async function bacaPusatTerakhir(db: AletaDatabase): Promise<PusatTerakhir | null> {
  const x = (await bacaSetelanSistem(db, KUNCI_PUSAT_TERAKHIR)) as Record<string, unknown> | null;
  if (!x || typeof x !== "object" || !Array.isArray(x.pembaruan)) return null;
  return {
    diperiksaPada: String(x.diperiksaPada ?? "").slice(0, 40),
    saluranDipaksa: saluranSah(x.saluranDipaksa) ? x.saluranDipaksa : null,
    pesan: String(x.pesan ?? "").slice(0, 500),
    pembaruan: x.pembaruan as PusatTerakhir["pembaruan"],
  };
}

/** Saluran yang berlaku: dipaksa Pusat > pilihan satker > stabil. Gagal baca = stabil. */
export async function bacaSaluranEfektif(db: AletaDatabase): Promise<SaluranSatker> {
  try {
    const terakhir = await bacaPusatTerakhir(db);
    if (terakhir?.saluranDipaksa) return terakhir.saluranDipaksa;
    return (await bacaKanal(db)).saluran;
  } catch {
    return "stabil";
  }
}

/** Simpan pilihan saluran dan/atau alamat Pusat (Super Admin - dijaga rute). */
export async function simpanKanal(db: AletaDatabase, aktor: { id: string; name?: string | null }, badan: Record<string, unknown>) {
  const kini = await bacaKanal(db);
  let saluran = kini.saluran;
  let alamatPusat = kini.alamatPusat;
  if (badan.saluran !== undefined) {
    if (!saluranSah(badan.saluran)) throw new ApiError(400, "Saluran harus stabil atau uji-coba.");
    saluran = badan.saluran;
  }
  if (badan.alamatPusat !== undefined) {
    try {
      alamatPusat = bersihkanAlamatPusat(badan.alamatPusat);
    } catch (e) {
      if (e instanceof GalatKanalPembaruan) throw new ApiError(400, e.message);
      throw e;
    }
  }
  const sekarang = new Date().toISOString();
  const baru: PengaturanKanal = { saluran, alamatPusat, diubahOleh: aktor.name || aktor.id, diubahPada: sekarang };
  await withTransaction(db, async (tx) => {
    await tulisSetelanSistem(tx, KUNCI_KANAL, baru, sekarang);
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: aktor.id,
      action: "UPDATE_KANAL_PEMBARUAN",
      entityType: "aleta_ekstensi_setelan",
      entityId: `*sistem*:${KUNCI_KANAL}`,
      payload: { dari: { saluran: kini.saluran, alamatPusat: kini.alamatPusat }, ke: { saluran, alamatPusat } },
      createdAt: sekarang,
    });
  });
  return baru;
}

export type HasilCekPusat =
  | { status: "belum-diatur"; pesan: string }
  | { status: "galat"; pesan: string }
  | { status: "tanda-tangan-ditolak"; pesan: string }
  | { status: "ok"; saluran: SaluranSatker; pesan: string; diperiksaPada: string; pembaruan: KeadaanPembaruan[] };

export type DependensiCek = {
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
  kunciPublik?: string;
  kunciSatker?: string;
  versi?: Partial<Record<KomponenPembaruan, string>>;
  sekarang?: Date;
};

async function versiTerpasang(): Promise<Partial<Record<KomponenPembaruan, string>>> {
  const hasil: Partial<Record<KomponenPembaruan, string>> = { portal: APP_VERSION };
  try {
    // Berkas ini besar (isi ekstensi tertanam) - dimuat hanya saat cek dijalankan.
    hasil.ekstensi = (await import("@/server/shared/ekstensi-berkas")).EKSTENSI_VERSI;
  } catch {
    /* versi ekstensi tidak terbaca: komponen dilewati */
  }
  return hasil;
}

/**
 * Cek pembaruan ke ALETA Pusat. Aman dipanggil kapan saja: alamat kosong =
 * "belum diatur" (bukan galat), jawaban tanpa tanda tangan sah ditolak, dan
 * hasilnya hanya dicatat. Super Admin/Admin memicunya dari layar Fitur satker.
 */
export async function cekPembaruanPusat(db: AletaDatabase, aktor: { id: string; name?: string | null } | null, dep: DependensiCek = {}): Promise<HasilCekPusat> {
  const kanal = await bacaKanal(db);
  if (!kanal.alamatPusat) {
    return { status: "belum-diatur", pesan: "Alamat ALETA Pusat belum diatur - satker ini berjalan mandiri." };
  }
  const kunciPublik = dep.kunciPublik ?? kunciPublikPusat();
  if (!kunciPublik) {
    return { status: "galat", pesan: "Kunci publik ALETA Pusat belum dipasang di server (ALETA_PUSAT_KUNCI_PUBLIK) - jawaban Pusat belum dapat dipercaya." };
  }

  const satker = await bacaSatkerAktif(db);
  const instalasiId = await pastikanInstalasiId(db);
  const versi = dep.versi ?? (await versiTerpasang());
  const permintaan = susunPermintaanCek({ kode: satker.kodeSatker, nama: satker.namaPengadilan, instalasiId }, kanal.saluran, versi, dep.sekarang);

  let mentah: unknown;
  try {
    const kepala: Record<string, string> = { "content-type": "application/json" };
    const kunciSatker = dep.kunciSatker ?? String(process.env.ALETA_PUSAT_KUNCI ?? "").trim();
    if (kunciSatker) kepala["x-aleta-satker-kunci"] = kunciSatker;
    const url = `${kanal.alamatPusat}/api/pusat/v1/cek`;
    const init: RequestInit = { method: "POST", headers: kepala, body: JSON.stringify(permintaan), cache: "no-store" };
    const jawab = dep.fetch ? await dep.fetch(url, init) : await outboundFetch(url, init, 10_000);
    if (!jawab.ok) return { status: "galat", pesan: `ALETA Pusat menjawab HTTP ${jawab.status}.` };
    mentah = await jawab.json();
  } catch (e) {
    return { status: "galat", pesan: `ALETA Pusat belum dapat dihubungi: ${describeNetworkError(e) || (e instanceof Error ? e.message : "tidak diketahui")}` };
  }

  const dibungkus = (mentah && typeof mentah === "object" ? mentah : {}) as Record<string, unknown>;
  const tandatangan = String(dibungkus.tandatangan ?? "");
  if (!periksaTandatangan(isiBertandatangan(dibungkus), tandatangan, kunciPublik)) {
    return { status: "tanda-tangan-ditolak", pesan: "Jawaban ALETA Pusat ditolak: tanda tangannya tidak cocok dengan kunci Pusat yang terpasang." };
  }
  const jawaban = bersihkanJawabanCek(mentah);
  if (!jawaban) return { status: "galat", pesan: "Jawaban ALETA Pusat tidak berbentuk manifest yang dikenal." };

  const sekarang = (dep.sekarang ?? new Date()).toISOString();
  const saluran = jawaban.saluranDipaksa ?? kanal.saluran;
  const pembaruan = hitungPembaruan(jawaban.manifest, saluran, versi);
  await withTransaction(db, async (tx) => {
    if (jawaban.izin) await tulisSetelanSistem(tx, KUNCI_IZIN_PUSAT, { ...jawaban.izin, diterimaPada: sekarang }, sekarang);
    await tulisSetelanSistem(
      tx,
      KUNCI_PUSAT_TERAKHIR,
      {
        diperiksaPada: sekarang,
        saluranDipaksa: jawaban.saluranDipaksa,
        pesan: jawaban.pesan,
        pembaruan: pembaruan.map((p) => ({ komponen: p.komponen, terpasang: p.terpasang, tersedia: p.tersedia, adaPembaruan: p.adaPembaruan, langsungDapat: p.langsungDapat })),
      },
      sekarang
    );
    if (aktor) {
      await appendAuditLog(tx, {
        id: await nextPrefixedId(tx, "audit_logs", "adt"),
        actorUserId: aktor.id,
        action: "CEK_PEMBARUAN_PUSAT",
        entityType: "aleta_ekstensi_setelan",
        entityId: `*sistem*:${KUNCI_PUSAT_TERAKHIR}`,
        payload: { saluran, adaPembaruan: pembaruan.filter((p) => p.adaPembaruan).map((p) => p.komponen), izinDiterima: Boolean(jawaban.izin) },
        createdAt: sekarang,
      });
    }
  });
  return { status: "ok", saluran, pesan: jawaban.pesan, diperiksaPada: sekarang, pembaruan };
}
