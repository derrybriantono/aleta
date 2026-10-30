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
 * RUAS TAMBAHAN OPSIONAL (19 Okt 2026, draf putusan): `draf: "h7"` (buka draf
 * putusan agen ALETA), `varian: "dikabulkan" | "ditolak"`, dan `isian` (nama
 * isian yang ditunjuk, tanpa kode). Hanya ditambahkan bila diisi; pembaca
 * lama mengabaikannya, jadi kontrak v:1 tidak berubah bagi yang sudah ada.
 *
 * Alamat ABT diambil dari setelan "APS Badilag" panel (Pengaturan Panel >
 * aplikasi luar). Setelan bawaannya localhost - tidak berguna bagi petugas -
 * sehingga jatuh ke alamat ABT satker.
 */
import { hariPutusan, sidangIkrar } from "@/lib/keadaan-sidang";
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
  /** Opsional: "h7" = buka draf putusan agen; varian dan isian yang ditunjuk. "h1" (30 Okt) = buka BAS yang disiapkan agen H-1. */
  draf?: "h7" | "h1" | null;
  varian?: "dikabulkan" | "ditolak" | null;
  isian?: string | null;
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
  const tambahan: { draf?: "h7" | "h1"; varian?: "dikabulkan" | "ditolak"; isian?: string } = {};
  if (data.draf === "h7" || data.draf === "h1") tambahan.draf = data.draf;
  if (data.varian === "dikabulkan" || data.varian === "ditolak") tambahan.varian = data.varian;
  if (String(data.isian ?? "").trim()) tambahan.isian = String(data.isian).trim().slice(0, 120);
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
    ...tambahan,
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

type SidangStatus = {
  sidangId: string;
  tanggalSidang: string;
  agenda: string;
  ditunda: boolean;
  alasanDitunda: string;
  urutanSidang: number;
};

/**
 * Tautan blangko untuk Status Perkara (tambahan 19 Okt 2026): BAS per sidang,
 * putusan bila sudah putus atau sidang terakhir beragenda putusan, dan ikrar
 * bila perkara sudah sampai sidang/penetapan ikrar. Disaring hak peran.
 * Status Perkara hanya membawa JUMLAH saksi (tanpa pembagian sisi) - jumlah
 * itu dikirim sebagai jumlahSaksiP, jumlahSaksiT 0.
 */
export function tautanBlangkoStatusPerkara(bahan: {
  nomor: string;
  perkaraId?: string | number | null;
  jadwal: ReadonlyArray<SidangStatus>;
  putusan?: { sudahPutus: boolean; statusPutusan: string; verstek: boolean } | null;
  adaIkrar?: boolean;
  jumlahSaksi?: number | null;
  boleh: readonly JenisBlangkoDerry[];
}): {
  perSidang: Record<string, DataTautanBlangko>;
  putusan: DataTautanBlangko | null;
  ikrar: DataTautanBlangko | null;
} {
  const urut = [...bahan.jadwal].sort((a, b) => (Number(a.urutanSidang) || 0) - (Number(b.urutanSidang) || 0));
  const dasar = (s: SidangStatus | undefined): DataTautanBlangko => ({
    nomor: bahan.nomor,
    perkaraId: bahan.perkaraId,
    sidangKe: s ? Number(s.urutanSidang) || null : null,
    tanggalSidang: s?.tanggalSidang ?? "",
    agenda: s?.agenda ?? "",
    tunda: s?.alasanDitunda ?? "",
    keterangan: "",
    amar: "",
    verstek: null,
    jumlahSaksiP: bahan.jumlahSaksi ?? 0,
    jumlahSaksiT: 0,
  });
  const perSidang: Record<string, DataTautanBlangko> = {};
  if (bahan.boleh.includes("bas")) for (const s of urut) perSidang[s.sidangId] = dasar(s);

  const terakhir = urut[urut.length - 1];
  const sudahPutus = Boolean(bahan.putusan?.sudahPutus);
  const relevanPutusan = sudahPutus || Boolean(terakhir && hariPutusan(terakhir));
  const putusan =
    bahan.boleh.includes("putusan") && relevanPutusan
      ? {
          ...dasar(terakhir),
          amar: sudahPutus ? bahan.putusan?.statusPutusan ?? "" : "",
          verstek: sudahPutus ? Boolean(bahan.putusan?.verstek) : null,
        }
      : null;

  const sidangIkrarTerakhir = [...urut].reverse().find((s) => sidangIkrar(s));
  const ikrar =
    bahan.boleh.includes("penetapan") && (bahan.adaIkrar || sidangIkrarTerakhir)
      ? dasar(sidangIkrarTerakhir ?? terakhir)
      : null;
  return { perSidang, putusan, ikrar };
}

export const SEBUTAN_BLANGKO: Record<JenisBlangkoDerry, string> = {
  putusan: "Blangko putusan",
  bas: "Blangko BAS",
  penetapan: "Blangko ikrar",
};
