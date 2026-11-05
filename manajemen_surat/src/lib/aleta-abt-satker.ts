import { createHash } from "node:crypto";

import { GalatIdentitasSatker, bentukSatker, gantiCabangSatker, gantiKodeSurat, kodeSuratDari, NO_VAR_KODE_SURAT } from "@/lib/identitas-satker";

/**
 * ============================================================================
 * PAKET PASANG ALETA ABT UNTUK SATKER LAIN (5 Nov 2026, Tahap 8) - aturan murni, tanpa SQL, tanpa jaringan
 * ============================================================================
 *
 * Pengadilan Agama lain dapat memasang ALETA ABT tanpa ABT Derry. Yang dipasang adalah PUSTAKA INDUK (server "induk"): blangko dan
 * definisi isian Derry yang sudah DINETRALKAN dari isi khas satu satker. Blangko dan isian milik satker itu sendiri tetap terpisah:
 * baris dengan asal "aleta" tidak pernah ditimpa pemasangan atau pembaruan paket induk (aturan sinkron yang sudah ada).
 *
 * Yang dinetralkan dari definisi isian:
 *   - cabang `WHEN '<KodePN>' THEN '...'` pada isian satker (alamat, telepon, laman, surel, provinsi): dibuang, sehingga satker lain jatuh ke
 *     cabang ELSE = data SIPP setempat (sys_config) atau kosong. Cabang yang bukan kode satker (mis. `WHEN ''`) tidak disentuh;
 *   - kode surat pada isian bawaan nomor surat #1154#: diganti KODE_SURAT_KOSONG, yang HARUS diganti satker di Identitas satker.
 * Yang TIDAK ditebak: isian lain yang memuat kata khas satu daerah (mis. media pengumuman setempat) hanya DIDAFTAR (`perluDisesuaikan`)
 * supaya petugas satker meninjaunya; isinya tidak diubah diam-diam.
 */

export const SERVER_INDUK = "induk";
export const FORMAT_PAKET = 1;
/** Kode surat netral yang tampil bila satker belum mengisi Identitas satker; bentuknya sah bagi gantiKodeSurat. */
export const KODE_SURAT_KOSONG = "W00-A00";

const KODE_PN = /^[A-Za-z]{2,4}\.[A-Za-z0-9]{2,6}$/;
/** Kepala CASE isian satker (sama dengan identitas-satker.ts): tanpa satu pun WHEN sesudahnya kueri tidak sah di MariaDB. */
const KEPALA_CASE = /CASE\s*\(\s*SELECT\s+TRIM\(\s*value\s*\)\s+FROM\s+sys_config\s+WHERE\s+name\s*=\s*'KodePN'\s+LIMIT\s+1\s*\)/i;
const CABANG_KODE = /\bWHEN\s+'((?:[^'\\]|''|\\.)*)'\s+THEN\s+'(?:[^'\\]|''|\\.)*'/gi;
const NO_VAR_PROVINSI = "9276";
const PIHAK_SEMUA = "FROM perkara_pihak1 p JOIN pihak b ON b.id = p.pihak_id";
const PIHAK_TERBARU = "FROM (SELECT pihak_id FROM perkara_pihak1 ORDER BY perkara_id DESC LIMIT 1000) p JOIN pihak b ON b.id = p.pihak_id";
/** Kata yang menandakan isi khas satu daerah (sesudah dinetralkan). */
const KATA_DAERAH = /Donggala|PA\.Dgl|Palu\b|Banawa|Sulawesi|Sigi\b|Parigi|Poso|Bungku/i;

export type VariabelInduk = {
  no: string;
  sql_query: string | null;
  default_data: string | null;
};

export type PerubahanNetral = { noVar: string; jenis: "cabang-satker" | "kode-surat" | "provinsi-cepat"; keterangan: string };

/** Menetralkan SATU definisi. Mengembalikan definisi baru dan daftar perubahan (kosong bila tidak ada yang khas satker). */
export function netralkanVariabelInduk<T extends VariabelInduk>(v: T): { variabel: T; perubahan: PerubahanNetral[] } {
  const perubahan: PerubahanNetral[] = [];
  let sql = v.sql_query;
  let bawaan = v.default_data;
  if (sql && bentukSatker(sql)) {
    const kode = new Set<string>();
    for (const m of sql.matchAll(CABANG_KODE)) {
      const k = m[1].replace(/''/g, "'");
      if (KODE_PN.test(k)) kode.add(k);
    }
    for (const k of kode) {
      sql = gantiCabangSatker(sql, k, "");
      perubahan.push({ noVar: v.no, jenis: "cabang-satker", keterangan: `cabang satker ${k} dibuang; satker lain memakai data SIPP setempat atau kosong` });
    }
    // CASE tanpa WHEN sama sekali bukan SQL yang sah: sisakan satu cabang penjaga untuk KodePN kosong (tidak pernah cocok dengan satker nyata),
    // seperti pada isian #11850#. Cabang satker pemasang kelak disisipkan tepat di belakang kepala CASE oleh Identitas satker.
    if (kode.size && !/\bWHEN\b/i.test(sql)) {
      const kepala = KEPALA_CASE.exec(sql);
      if (kepala) sql = `${sql.slice(0, kepala.index + kepala[0].length)} WHEN '' THEN ''${sql.slice(kepala.index + kepala[0].length)}`;
    }
  }
  // Isian provinsi satker (#9276#): cabang ELSE menghitung provinsi terbanyak dari SEMUA pihak di SIPP (di salinan uji 8-17 dtk, melewati batas
  // kueri bawaan bot 10 dtk, sehingga hukum acara #11850# kosong). Cukup 1000 pihak perkara terbaru: provinsi satker tidak berubah karenanya.
  if (sql && v.no.replace(/^0+/, "") === NO_VAR_PROVINSI && sql.includes(PIHAK_SEMUA)) {
    sql = sql.replace(PIHAK_SEMUA, PIHAK_TERBARU);
    perubahan.push({ noVar: v.no, jenis: "provinsi-cepat", keterangan: "provinsi satker dihitung dari 1000 pihak perkara terbaru, bukan seluruh pihak di SIPP, supaya selesai dalam batas waktu kueri" });
  }
  if (v.no.replace(/^0+/, "") === NO_VAR_KODE_SURAT && bawaan) {
    const lama = kodeSuratDari(bawaan);
    if (lama && lama.toUpperCase() !== KODE_SURAT_KOSONG) {
      try {
        bawaan = gantiKodeSurat(bawaan, KODE_SURAT_KOSONG);
        perubahan.push({ noVar: v.no, jenis: "kode-surat", keterangan: `kode surat ${lama} diganti ${KODE_SURAT_KOSONG}; satker mengisinya di Identitas satker` });
      } catch (e) {
        if (!(e instanceof GalatIdentitasSatker)) throw e;
      }
    }
  }
  return { variabel: { ...v, sql_query: sql, default_data: bawaan }, perubahan };
}

/** Isian yang masih memuat kata khas satu daerah SESUDAH dinetralkan: hanya didaftar untuk ditinjau satker pemasang. */
export function perluDisesuaikan(daftar: ReadonlyArray<VariabelInduk>): string[] {
  return daftar.filter((v) => KATA_DAERAH.test(`${v.sql_query ?? ""}\n${v.default_data ?? ""}`)).map((v) => v.no.padStart(4, "0")).sort();
}

/** Penanda isian yang masih tertinggal di naskah jadi (nomor ABT atau kode ALETA ABT): naskah yang baik tidak punya satu pun. */
export function penandaTersisa(rtf: string): string[] {
  const hasil = new Set<string>();
  for (const m of String(rtf).matchAll(/#(\d{3,5}|AA\d{5,6})#/g)) hasil.add(m[1]);
  return [...hasil].sort();
}

/** Kata khas satker pembuat paket yang tidak boleh muncul pada naskah satker lain; `tanda` = potongan yang dicari (tanpa membedakan huruf). */
export function bocoranIdentitas(rtf: string, tanda: readonly string[]): string[] {
  const t = String(rtf).toLowerCase();
  return tanda.filter((x) => x && t.includes(x.toLowerCase()));
}

// ---------------------------------------------------------------------------------------------------------------
// Identitas satker dari SIPP setempat
// ---------------------------------------------------------------------------------------------------------------

export type IdentitasSipp = { kodePN: string; namaPN: string; namaPT: string; alamatPN: string; zonaWaktu: string };

export const KUNCI_SYS_CONFIG = ["KodePN", "NamaPN", "NamaPT", "AlamatPN", "ZonaWaktu"] as const;

export function identitasDariSysConfig(baris: ReadonlyArray<{ name?: unknown; value?: unknown }>): IdentitasSipp {
  const peta = new Map<string, string>();
  for (const b of baris) peta.set(String(b.name ?? ""), String(b.value ?? "").trim());
  return { kodePN: peta.get("KodePN") ?? "", namaPN: peta.get("NamaPN") ?? "", namaPT: peta.get("NamaPT") ?? "", alamatPN: peta.get("AlamatPN") ?? "", zonaWaktu: (peta.get("ZonaWaktu") ?? "").toUpperCase() };
}

export type TemuanIdentitas = { kunci: string; ok: boolean; keterangan: string };

/**
 * Memeriksa identitas yang terbaca dari SIPP setempat sebelum paket dipasang. Telepon, laman, dan surel tidak disimpan SIPP, jadi bukan
 * temuan: bila kosong, barisnya memang tidak dicetak. Kode surat bukan data SIPP; ia diisi satker di Identitas satker.
 */
export function periksaIdentitasSipp(s: IdentitasSipp, kodeSuratSatker = ""): TemuanIdentitas[] {
  const hasil: TemuanIdentitas[] = [];
  const t = (kunci: string, ok: boolean, baik: string, buruk: string) => hasil.push({ kunci, ok, keterangan: ok ? baik : buruk });
  t("kodePN", KODE_PN.test(s.kodePN), `Kode satker di SIPP: ${s.kodePN}.`, "Kode satker di SIPP belum terbaca atau bentuknya tidak dikenal.");
  t("namaPN", s.namaPN.length >= 5, "Nama pengadilan terbaca dari SIPP.", "Nama pengadilan di SIPP kosong.");
  t("namaPT", s.namaPT.length >= 5, "Nama pengadilan tinggi terbaca dari SIPP.", "Nama pengadilan tinggi di SIPP kosong; kop memakai data wilayah SIPP bila ada.");
  t("alamatPN", s.alamatPN.length >= 5, "Alamat kantor terbaca dari SIPP.", "Alamat kantor di SIPP kosong; isi di Identitas satker.");
  t("zonaWaktu", ["WITA", "WIB", "WIT"].includes(s.zonaWaktu), `Zona waktu ${s.zonaWaktu}.`, "Zona waktu di SIPP bukan WIB, WITA, atau WIT.");
  const kode = kodeSuratSatker.trim().toUpperCase();
  t(
    "kodeSurat",
    Boolean(kode) && kode !== KODE_SURAT_KOSONG && /^[A-Z]\d{1,3}-[A-Z]\d{1,3}$/.test(kode),
    `Kode surat ${kode}.`,
    "Kode surat belum diisi di Identitas satker; nomor surat relaas akan memakai kode netral sampai diisi."
  );
  return hasil;
}

// ---------------------------------------------------------------------------------------------------------------
// Manifest paket
// ---------------------------------------------------------------------------------------------------------------

export type BerkasManifest = { jalur: string; folder: string; nama: string; arsip: boolean; md5: string; ukuran: number; waktu: string; penanda: string[] };

/** Fungsi basis data yang dipanggil rumus isian Derry (dibuat di skema ABT). Satker tanpa ABT Derry memasangnya sendiri; ALETA tidak menulis ke basis data SIPP/ABT. */
export type FungsiManifest = { nama: string; md5: string; ukuran: number };

export type ManifestPaket = {
  format: number;
  dibuat: string;
  server: string;
  berkas: BerkasManifest[];
  fungsi?: FungsiManifest[];
  /** Isian induk dalam bentuk potret (sudah dinetralkan). */
  variabel: Array<Record<string, unknown>>;
  takDikenal: string[];
  perubahan: PerubahanNetral[];
  perluDisesuaikan: string[];
  sidik: string;
};

const sha1 = (x: unknown) => createHash("sha1").update(JSON.stringify(x)).digest("hex");

/** Sidik paket: hanya bergantung pada isi (md5 berkas dan definisi isian), bukan urutan atau waktu dibuat. */
export function sidikPaket(
  berkas: ReadonlyArray<Pick<BerkasManifest, "jalur" | "md5">>,
  variabel: ReadonlyArray<Record<string, unknown>>,
  fungsi: ReadonlyArray<Pick<FungsiManifest, "nama" | "md5">> = []
): string {
  const b = [...berkas].map((x) => `${x.jalur}\t${x.md5}`).sort();
  const v = [...variabel].map((x) => JSON.stringify([x.no, x.nama, x.data_type, x.data_tabel, x.data_kolom, x.urutan_data, x.referensi, x.sql_query, x.default_data, x.multi_sidang, x.locked])).sort();
  // Tanpa fungsi (paket lama) sidiknya sama seperti sebelumnya.
  return fungsi.length ? sha1([b, v, [...fungsi].map((f) => `${f.nama}\t${f.md5}`).sort()]) : sha1([b, v]);
}

/** Temuan pada manifest (tanpa membaca berkas): bentuk, jalur aman, sidik cocok. Kosong = baik. */
export function periksaManifest(m: unknown): string[] {
  const masalah: string[] = [];
  const x = m as Partial<ManifestPaket> | null;
  if (!x || typeof x !== "object") return ["Manifest paket tidak terbaca."];
  if (x.format !== FORMAT_PAKET) masalah.push(`Format paket ${String(x.format)} tidak dikenal; yang didukung ${FORMAT_PAKET}.`);
  if (x.server !== SERVER_INDUK) masalah.push(`Paket ini bukan paket induk (server ${String(x.server)}).`);
  if (!Array.isArray(x.berkas) || !x.berkas.length) masalah.push("Paket tidak berisi blangko.");
  if (!Array.isArray(x.variabel) || !x.variabel.length) masalah.push("Paket tidak berisi definisi isian.");
  if (masalah.length) return masalah;
  const lihat = new Set<string>();
  for (const b of x.berkas!) {
    const j = String(b.jalur ?? "");
    if (!j || j.startsWith("/") || /(^|\/)\.\.(\/|$)/.test(j) || j.includes("\\") || j.includes("\0")) masalah.push(`Jalur berkas tidak aman: ${j.slice(0, 80)}.`);
    if (lihat.has(j)) masalah.push(`Berkas dobel di paket: ${j.slice(0, 80)}.`);
    lihat.add(j);
    if (!/^[0-9a-f]{32}$/.test(String(b.md5 ?? ""))) masalah.push(`Sidik berkas tidak sah: ${j.slice(0, 80)}.`);
  }
  if (x.fungsi !== undefined) {
    if (!Array.isArray(x.fungsi)) masalah.push("Daftar fungsi pada paket tidak terbaca.");
    else {
      const namaFungsi = new Set<string>();
      for (const f of x.fungsi) {
        const n = String(f.nama ?? "");
        if (!/^[A-Za-z0-9_]{1,64}$/.test(n)) masalah.push(`Nama fungsi tidak sah: ${n.slice(0, 40)}.`);
        if (namaFungsi.has(n)) masalah.push(`Fungsi dobel di paket: ${n.slice(0, 40)}.`);
        namaFungsi.add(n);
        if (!/^[0-9a-f]{32}$/.test(String(f.md5 ?? ""))) masalah.push(`Sidik fungsi tidak sah: ${n.slice(0, 40)}.`);
      }
    }
  }
  if (masalah.length) return masalah.slice(0, 50);
  if (sidikPaket(x.berkas!, x.variabel!, Array.isArray(x.fungsi) ? x.fungsi : []) !== x.sidik) masalah.push("Sidik paket tidak cocok dengan isinya: paket rusak atau diubah.");
  // Isian satker tidak boleh membawa cabang kode satker mana pun.
  for (const v of x.variabel!) {
    const sql = String((v as { sql_query?: unknown }).sql_query ?? "");
    if (bentukSatker(sql)) {
      for (const mm of sql.matchAll(CABANG_KODE)) if (KODE_PN.test(mm[1].replace(/''/g, "'"))) masalah.push(`Isian ${String((v as { no?: unknown }).no)} masih memuat cabang satker ${mm[1]}.`);
      if (!/\bWHEN\b/i.test(sql)) masalah.push(`Isian ${String((v as { no?: unknown }).no)} berbentuk CASE tanpa satu pun WHEN: kuerinya tidak sah.`);
    }
  }
  return masalah.slice(0, 50);
}
