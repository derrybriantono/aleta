/**
 * ============================================================================
 * TAUTAN KE BLANGKO ABT BY DERRY (JADWAL-3 tambahan B, 19 Okt 2026)
 * ============================================================================
 *
 * SATU pembentuk tautan untuk tombol "Blangko" di Jadwal Sidang dan tautan
 * blangko di Status Perkara. Panel di ABT membaca hash `#bd=` lalu memilih
 * perkara dan blangkonya sendiri. Tidak ada yang ditulis ke ABT/SIPP.
 *
 * KONTRAK (dibagi dengan agen sisi panel ABT - jangan diubah sepihak):
 *   <alamat ABT>/abt/#bd=<encodeURIComponent(JSON.stringify({
 *     v: 1, nomor, perkaraId, sidangKe, tanggalSidang: "YYYY-MM-DD",
 *     jenis: "putusan" | "bas" | "penetapan", agenda, tunda, keterangan,
 *     amar, verstek: true | false | null, jumlahSaksiP, jumlahSaksiT }))>
 *
 * Alamat ABT diambil dari setelan "APS Badilag" panel (Pengaturan Panel >
 * aplikasi luar). Setelan bawaannya localhost - tidak berguna bagi petugas -
 * sehingga jatuh ke alamat ABT satker.
 */
import { golonganPengguna, type PenggunaGolongan } from "@/lib/matriks-peran";

export type JenisBlangkoDerry = "putusan" | "bas" | "penetapan";

/** Alamat APS Badilag satker bila setelan panel masih bawaan (localhost). */
export const ALAMAT_APS_BADILAG_SATKER = "http://192.168.10.10/aps_badilag";

export type DataTautanBlangko = {
  nomor: string;
  perkaraId?: string | number | null;
  sidangKe?: number | null;
  tanggalSidang?: string | null;
  agenda?: string | null;
  tunda?: string | null;
  keterangan?: string | null;
  amar?: string | null;
  verstek?: boolean | null;
  jumlahSaksiP?: number | null;
  jumlahSaksiT?: number | null;
};

/** Alamat dasar APS Badilag dari setelan panel; localhost/kosong = alamat satker. */
export function alamatApsBadilag(setelan?: string | null): string {
  const teks = String(setelan ?? "").trim().replace(/\/+$/, "").replace(/\/index\.php$/i, "");
  if (!/^https?:\/\//i.test(teks)) return ALAMAT_APS_BADILAG_SATKER;
  try {
    const host = new URL(teks).hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]") return ALAMAT_APS_BADILAG_SATKER;
  } catch {
    return ALAMAT_APS_BADILAG_SATKER;
  }
  return teks;
}

function angkaAtauNull(n: unknown): number | null {
  const x = Number(n);
  return n === null || n === undefined || n === "" || !Number.isFinite(x) ? null : x;
}

/** Badan JSON tautan - urutan ruasnya mengikuti kontrak. */
export function muatanBlangkoDerry(data: DataTautanBlangko, jenis: JenisBlangkoDerry) {
  const id = String(data.perkaraId ?? "").trim();
  return {
    v: 1,
    nomor: String(data.nomor ?? "").trim(),
    perkaraId: id ? (/^\d+$/.test(id) ? Number(id) : id) : null,
    sidangKe: angkaAtauNull(data.sidangKe),
    tanggalSidang: String(data.tanggalSidang ?? "").slice(0, 10),
    jenis,
    agenda: String(data.agenda ?? "").trim(),
    tunda: String(data.tunda ?? "").trim(),
    keterangan: String(data.keterangan ?? "").trim(),
    amar: String(data.amar ?? "").trim(),
    verstek: typeof data.verstek === "boolean" ? data.verstek : null,
    jumlahSaksiP: angkaAtauNull(data.jumlahSaksiP) ?? 0,
    jumlahSaksiT: angkaAtauNull(data.jumlahSaksiT) ?? 0,
  };
}

export function tautanBlangkoDerry(data: DataTautanBlangko, jenis: JenisBlangkoDerry, setelanAps?: string | null): string {
  return `${alamatApsBadilag(setelanAps)}/abt/#bd=${encodeURIComponent(JSON.stringify(muatanBlangkoDerry(data, jenis)))}`;
}

/**
 * Jenis blangko yang relevan menurut keadaan sidang, urut dari yang utama.
 * Ikrar talak -> penetapan (ikrar) + BAS ikrar; diputus atau akan diputus ->
 * putusan + BAS; selain itu (ditunda, pemeriksaan, pembuktian, ...) -> BAS.
 */
export function jenisBlangkoMenurutKeadaan(k: {
  ikrarTalak?: boolean;
  sudahPutus?: boolean;
  /** Agenda pembacaan putusan/musyawarah, atau hasil sidang menyebut putus. */
  akanPutus?: boolean;
}): JenisBlangkoDerry[] {
  if (k.ikrarTalak) return ["penetapan", "bas"];
  if (k.sudahPutus || k.akanPutus) return ["putusan", "bas"];
  return ["bas"];
}

/**
 * Hak per peran: hakim/pimpinan putusan, penetapan, dan BAS; PP/panitera/
 * panmud BAS; super admin/admin semua. Lainnya tidak satu pun.
 */
export function jenisBlangkoBoleh(pengguna: PenggunaGolongan | null | undefined): JenisBlangkoDerry[] {
  const g = golonganPengguna(pengguna);
  if (g.includes("super-admin") || g.includes("admin") || g.includes("hakim") || g.includes("pimpinan")) {
    return ["putusan", "penetapan", "bas"];
  }
  if (g.includes("pp") || g.includes("panitera") || g.includes("panmud")) return ["bas"];
  return [];
}

export function saringJenisBlangko(
  relevan: readonly JenisBlangkoDerry[],
  boleh: readonly JenisBlangkoDerry[]
): JenisBlangkoDerry[] {
  return relevan.filter((j) => boleh.includes(j));
}

export const SEBUTAN_BLANGKO: Record<JenisBlangkoDerry, string> = {
  putusan: "Blangko putusan",
  bas: "Blangko BAS",
  penetapan: "Blangko ikrar",
};
