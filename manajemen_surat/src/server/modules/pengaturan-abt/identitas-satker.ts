import { createHash } from "node:crypto";

import {
  GalatIdentitasSatker,
  IDENTITAS_KOSONG,
  KOLOM_IDENTITAS,
  LOGO_MAKS_BYTE,
  LOGO_SISI_MAKS,
  NO_VAR_KODE_SURAT,
  VARIABEL_SATKER,
  bentukSatker,
  bersihkanIdentitas,
  gantiCabangSatker,
  gantiKodeSurat,
  isiCabangSatker,
  kodeSuratDari,
  type IdentitasSatker,
} from "@/lib/identitas-satker";
import { hakPengaturanAbt } from "@/lib/pengaturan-abt";
import { menyebutAleta, pesanTandaAletaSipp } from "@/lib/tanda-aleta";
import type { AletaDatabase } from "@/server/db/client";
import { ApiError } from "@/server/shared/errors";

import { ambilGambarBotPengaturanAbt } from "./gateway";
import { bot, catatPaketLogo, simpanKueriSatker, simpanVariabel, type AktorPengaturan } from "./service";

/**
 * ============================================================================
 * IDENTITAS SATKER - PENGATURAN SIPP & ABT (17 Okt 2026)
 * ============================================================================
 *
 * Tiga langkah yang sengaja TERPISAH:
 *   1. SIMPAN di ALETA (aleta_identitas_satker, 0069) - tidak menyentuh ABT;
 *   2. TERAPKAN ke ABT - isian yang dicentang admin saja: cabang satker kueri
 *      9271-9274 (simpanKueriSatker) dan bawaan nomor surat #1154#
 *      (simpanVariabel), masing-masing dicatat di aleta_abt_suntingan
 *      dengan nilai lama (Kembalikan);
 *   3. LOGO KOP - blangko RTF ada di folder yang terpasang HANYA-BACA untuk
 *      bot, jadi ALETA membangun PAKET (pasang.sh: prasyarat md5, cadangan,
 *      periksa; pulih.sh) yang dipasang petugas server.
 *
 * Nama pengadilan, Pengadilan Tinggi, dan zona waktu di kop diambil ABT dari
 * SIPP (sys_config NamaPN/NamaPT/ZonaWaktu) - di sini disimpan dan
 * DIBANDINGKAN, tidak ditulis ke SIPP (tidak ada keterangan ALETA di SIPP).
 */

type BarisIdentitas = {
  kode_satker: string;
  nama_pengadilan: string;
  pengadilan_tinggi: string;
  alamat: string;
  telepon: string;
  laman: string;
  surel: string;
  kode_surat: string;
  zona_waktu: string;
  logo_jenis: string;
  logo_md5: string;
  logo_lebar: number | string;
  logo_tinggi: number | string;
  diubah_oleh_nama: string;
  diubah_pada: string;
};

export type LogoSatker = { ada: boolean; jenis: string; md5: string; lebar: number; tinggi: number };

export type IdentitasTersimpan = {
  identitas: IdentitasSatker;
  logo: LogoSatker;
  tersimpan: boolean;
  diubahOleh: string;
  diubahPada: string;
};

function wajibHak(aktor: AktorPengaturan) {
  if (!hakPengaturanAbt(aktor.roleId).ubahBawaan) throw new ApiError(403, "Hanya Super Admin dan Admin yang dapat mengubah identitas satker.");
}

const galatIdentitas = (e: unknown) => (e instanceof GalatIdentitasSatker ? new ApiError(400, e.message) : e);

export async function bacaIdentitasAleta(db: AletaDatabase): Promise<IdentitasTersimpan> {
  const b = await db.queryOne<BarisIdentitas>(
    `SELECT kode_satker, nama_pengadilan, pengadilan_tinggi, alamat, telepon, laman, surel, kode_surat, zona_waktu,
            logo_jenis, logo_md5, logo_lebar, logo_tinggi, diubah_oleh_nama, diubah_pada
       FROM aleta_identitas_satker WHERE id = 1`
  );
  if (!b) return { identitas: { ...IDENTITAS_KOSONG }, logo: { ada: false, jenis: "", md5: "", lebar: 0, tinggi: 0 }, tersimpan: false, diubahOleh: "", diubahPada: "" };
  return {
    identitas: {
      kodeSatker: b.kode_satker,
      namaPengadilan: b.nama_pengadilan,
      pengadilanTinggi: b.pengadilan_tinggi,
      alamat: b.alamat,
      telepon: b.telepon,
      laman: b.laman,
      surel: b.surel,
      kodeSurat: b.kode_surat,
      zonaWaktu: b.zona_waktu,
    },
    logo: { ada: Boolean(b.logo_md5), jenis: b.logo_jenis, md5: b.logo_md5, lebar: Number(b.logo_lebar) || 0, tinggi: Number(b.logo_tinggi) || 0 },
    tersimpan: true,
    diubahOleh: b.diubah_oleh_nama,
    diubahPada: b.diubah_pada,
  };
}

export async function bacaLogoAleta(db: AletaDatabase): Promise<{ isi: Buffer; jenis: string } | null> {
  const b = await db.queryOne<{ logo_base64: string; logo_jenis: string }>(`SELECT logo_base64, logo_jenis FROM aleta_identitas_satker WHERE id = 1`);
  if (!b || !b.logo_base64) return null;
  return { isi: Buffer.from(b.logo_base64, "base64"), jenis: b.logo_jenis };
}

/**
 * Logo masuk -> PNG (alfa dipertahankan), sisi terpanjang <= LOGO_SISI_MAKS.
 * Hanya PNG/JPG/WebP yang diterima; isi diperiksa dari kepala berkas.
 */
export async function olahLogo(isi: Buffer): Promise<{ isi: Buffer; jenis: "png"; lebar: number; tinggi: number; md5: string }> {
  if (!isi.length) throw new ApiError(400, "Berkas logo kosong.");
  if (isi.length > LOGO_MAKS_BYTE * 2) throw new ApiError(413, "Logo terlalu besar (lebih dari 4 MB).");
  const png = isi.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const jpg = isi[0] === 0xff && isi[1] === 0xd8 && isi[2] === 0xff;
  const webp = isi.subarray(0, 4).toString("ascii") === "RIFF" && isi.subarray(8, 12).toString("ascii") === "WEBP";
  if (!png && !jpg && !webp) throw new ApiError(400, "Logo harus gambar PNG, JPG, atau WebP.");
  const sharp = (await import("sharp")).default;
  const keluar = await sharp(isi, { failOn: "error" })
    .rotate()
    .resize({ width: LOGO_SISI_MAKS, height: LOGO_SISI_MAKS, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });
  if (keluar.data.length > LOGO_MAKS_BYTE) throw new ApiError(413, "Logo sesudah dikecilkan masih lebih dari 2 MB.");
  return { isi: keluar.data, jenis: "png", lebar: keluar.info.width, tinggi: keluar.info.height, md5: createHash("md5").update(keluar.data).digest("hex") };
}

async function tulisBaris(db: AletaDatabase, aktor: AktorPengaturan, identitas: IdentitasSatker, logo: { base64: string; jenis: string; md5: string; lebar: number; tinggi: number } | null) {
  const sekarang = new Date().toISOString();
  const nilaiIdentitas = [
    identitas.kodeSatker,
    identitas.namaPengadilan,
    identitas.pengadilanTinggi,
    identitas.alamat,
    identitas.telepon,
    identitas.laman,
    identitas.surel,
    identitas.kodeSurat,
    identitas.zonaWaktu,
  ];
  const ada = await db.queryOne<{ id: number }>(`SELECT id FROM aleta_identitas_satker WHERE id = 1`);
  if (!ada) {
    await db.run(
      `INSERT INTO aleta_identitas_satker (id, kode_satker, nama_pengadilan, pengadilan_tinggi, alamat, telepon, laman, surel, kode_surat, zona_waktu,
         logo_base64, logo_jenis, logo_md5, logo_lebar, logo_tinggi, diubah_oleh_id, diubah_oleh_nama, diubah_pada)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...nilaiIdentitas, logo?.base64 ?? "", logo?.jenis ?? "", logo?.md5 ?? "", logo?.lebar ?? 0, logo?.tinggi ?? 0, aktor.id, aktor.name, sekarang]
    );
    return;
  }
  await db.run(
    `UPDATE aleta_identitas_satker SET kode_satker = ?, nama_pengadilan = ?, pengadilan_tinggi = ?, alamat = ?, telepon = ?, laman = ?, surel = ?,
       kode_surat = ?, zona_waktu = ?, diubah_oleh_id = ?, diubah_oleh_nama = ?, diubah_pada = ? WHERE id = 1`,
    [...nilaiIdentitas, aktor.id, aktor.name, sekarang]
  );
  if (logo) {
    await db.run(`UPDATE aleta_identitas_satker SET logo_base64 = ?, logo_jenis = ?, logo_md5 = ?, logo_lebar = ?, logo_tinggi = ? WHERE id = 1`, [
      logo.base64,
      logo.jenis,
      logo.md5,
      logo.lebar,
      logo.tinggi,
    ]);
  }
}

/**
 * Simpan identitas (dan logo bila dikirim) di ALETA. ABT tidak disentuh.
 * badan: {identitas:{...}, logoBase64?: "data:image/png;base64,..." | base64, hapusLogo?: true}
 */
export async function simpanIdentitas(db: AletaDatabase, aktor: AktorPengaturan, badan: Record<string, unknown>) {
  wajibHak(aktor);
  const kini = await bacaIdentitasAleta(db);
  let identitas: IdentitasSatker;
  try {
    identitas = bersihkanIdentitas(badan.identitas, kini.identitas);
  } catch (e) {
    throw galatIdentitas(e);
  }
  let logo: Parameters<typeof tulisBaris>[3] = null;
  if (typeof badan.logoBase64 === "string" && badan.logoBase64.trim()) {
    const mentah = Buffer.from(badan.logoBase64.replace(/^data:[^,]*,/, ""), "base64");
    const o = await olahLogo(mentah);
    logo = { base64: o.isi.toString("base64"), jenis: o.jenis, md5: o.md5, lebar: o.lebar, tinggi: o.tinggi };
  } else if (badan.hapusLogo === true) {
    logo = { base64: "", jenis: "", md5: "", lebar: 0, tinggi: 0 };
  }
  await tulisBaris(db, aktor, identitas, logo);
  return bacaIdentitasAleta(db);
}

// ---------------------------------------------------------------------------
// Keadaan ABT & rencana penerapan
// ---------------------------------------------------------------------------

type VariabelSatkerBot = {
  noVar: string;
  ada: boolean;
  nama: string;
  jenis: string;
  sql_query: string;
  default_data: string;
  dikunci: boolean;
  bentukSatker: boolean;
  nilai: string;
};
export type KeadaanSatkerBot = {
  sipp: { kodePN: string; namaPN: string; namaPT: string; alamatPN: string; zonaWaktu: string };
  variabel: VariabelSatkerBot[];
  perkaraContoh: { perkaraId: number; nomor: string } | null;
};

export type ButirRencana = {
  kunci: "alamat" | "telepon" | "laman" | "surel" | "kodeSurat";
  noVar: string;
  nilaiAbt: string;
  nilaiAleta: string;
  perlu: boolean;
  bisa: boolean;
  sebab: string;
};

/** Apa yang akan berubah di ABT bila identitas ALETA diterapkan (murni - diuji). */
export function susunRencana(identitas: IdentitasSatker, abt: KeadaanSatkerBot): ButirRencana[] {
  const kode = identitas.kodeSatker || abt.sipp.kodePN;
  const hasil: ButirRencana[] = [];
  for (const [kunci, noVar] of Object.entries(VARIABEL_SATKER) as Array<[ButirRencana["kunci"], string]>) {
    const v = abt.variabel.find((x) => x.noVar === noVar);
    const nilaiAleta = identitas[kunci as keyof IdentitasSatker] ?? "";
    if (!v || !v.ada) {
      hasil.push({ kunci, noVar, nilaiAbt: "", nilaiAleta, perlu: false, bisa: false, sebab: `#${noVar}# belum ada di ABT - paket abt-universal-satker-derry belum terpasang.` });
      continue;
    }
    if (!bentukSatker(v.sql_query) || v.dikunci) {
      hasil.push({ kunci, noVar, nilaiAbt: v.nilai, nilaiAleta, perlu: false, bisa: false, sebab: `Kueri #${noVar}# bukan bentuk isian satker - ubah lewat Isian blangko.` });
      continue;
    }
    const cabang = isiCabangSatker(v.sql_query, kode);
    let perlu = false;
    let sebab = "";
    try {
      perlu = gantiCabangSatker(v.sql_query, kode, nilaiAleta) !== v.sql_query;
    } catch (e) {
      sebab = e instanceof Error ? e.message : String(e);
    }
    hasil.push({ kunci, noVar, nilaiAbt: cabang.ada ? cabang.nilai : v.nilai, nilaiAleta, perlu, bisa: !sebab, sebab });
  }
  const ks = abt.variabel.find((x) => x.noVar === NO_VAR_KODE_SURAT);
  if (!ks || !ks.ada) {
    hasil.push({ kunci: "kodeSurat", noVar: NO_VAR_KODE_SURAT, nilaiAbt: "", nilaiAleta: identitas.kodeSurat, perlu: false, bisa: false, sebab: "#1154# tidak ada di ABT." });
  } else {
    const kodeAbt = kodeSuratDari(ks.default_data);
    const bisa = Boolean(kodeAbt) && !ks.dikunci && Boolean(identitas.kodeSurat);
    hasil.push({
      kunci: "kodeSurat",
      noVar: NO_VAR_KODE_SURAT,
      nilaiAbt: ks.default_data,
      nilaiAleta: identitas.kodeSurat,
      perlu: bisa && kodeAbt.toUpperCase() !== identitas.kodeSurat.toUpperCase(),
      bisa,
      sebab: !kodeAbt ? "Isian bawaan #1154# tidak diawali kode surat." : !identitas.kodeSurat ? "Kode surat di ALETA masih kosong." : "",
    });
  }
  // 17 Okt 2026: tidak ada kata ALETA di server SIPP/ABT. Isian yang memuatnya TETAP
  // boleh tersimpan di ALETA, tetapi tidak dapat diterapkan ke ABT - sebabnya disebut
  // dengan kalimat awam yang menunjuk isiannya (bot menolak pula, ini peringatan dini).
  return hasil.map((r) => {
    if (!menyebutAleta(r.nilaiAleta)) return r;
    const label = KOLOM_IDENTITAS.find((k) => k.kunci === r.kunci)?.label ?? (r.kunci === "kodeSurat" ? "Kode surat" : r.kunci);
    return { ...r, perlu: false, bisa: false, sebab: pesanTandaAletaSipp(label) };
  });
}

/** Usulan isian awal dari SIPP + ABT (untuk satker yang belum mengisi di ALETA). */
export function saranIdentitas(abt: KeadaanSatkerBot): IdentitasSatker {
  const kode = abt.sipp.kodePN;
  const cabang = (no: string) => {
    const v = abt.variabel.find((x) => x.noVar === no);
    if (!v || !v.ada) return "";
    const c = isiCabangSatker(v.sql_query, kode);
    return c.ada ? c.nilai : v.nilai;
  };
  const ks = abt.variabel.find((x) => x.noVar === NO_VAR_KODE_SURAT);
  const zona = abt.sipp.zonaWaktu.toUpperCase();
  return {
    kodeSatker: kode,
    namaPengadilan: abt.sipp.namaPN,
    pengadilanTinggi: abt.sipp.namaPT,
    alamat: cabang(VARIABEL_SATKER.alamat) || abt.sipp.alamatPN,
    telepon: cabang(VARIABEL_SATKER.telepon),
    laman: cabang(VARIABEL_SATKER.laman),
    surel: cabang(VARIABEL_SATKER.surel),
    kodeSurat: ks ? kodeSuratDari(ks.default_data) : "",
    zonaWaktu: ["WITA", "WIB", "WIT"].includes(zona) ? zona : "",
  };
}

export async function bacaSatker(db: AletaDatabase) {
  const aleta = await bacaIdentitasAleta(db);
  let abt: KeadaanSatkerBot | null = null;
  let galatAbt = "";
  try {
    abt = await bot<KeadaanSatkerBot>("/satker", { timeoutMs: 45000 });
  } catch (e) {
    galatAbt = e instanceof Error ? e.message : String(e);
  }
  const identitas = aleta.tersimpan ? aleta.identitas : abt ? saranIdentitas(abt) : aleta.identitas;
  return {
    ...aleta,
    identitas,
    saran: abt ? saranIdentitas(abt) : null,
    sipp: abt?.sipp ?? null,
    abt: abt ? abt.variabel.map((v) => ({ noVar: v.noVar, ada: v.ada, nama: v.nama, nilai: v.nilai, bentukSatker: v.bentukSatker })) : [],
    rencana: abt && aleta.tersimpan ? susunRencana(aleta.identitas, abt) : [],
    galatAbt,
  };
}

/**
 * Menerapkan identitas ALETA ke ABT untuk isian yang dipilih admin.
 * badan: {kunci: ["alamat","telepon","laman","surel","kodeSurat"]}
 * Tiap isian satu suntingan (satu transaksi, nilai lama tercatat); yang gagal
 * tidak menghentikan yang lain dan disebut sebabnya.
 */
export async function terapkanKeAbt(db: AletaDatabase, aktor: AktorPengaturan, ip: string, badan: Record<string, unknown>) {
  wajibHak(aktor);
  const aleta = await bacaIdentitasAleta(db);
  if (!aleta.tersimpan) throw new ApiError(400, "Simpan identitas satker di ALETA dulu.");
  const dipilih = new Set((Array.isArray(badan.kunci) ? badan.kunci : []).map(String));
  if (!dipilih.size) throw new ApiError(400, "Pilih isian yang diterapkan ke ABT.");
  const abt = await bot<KeadaanSatkerBot>("/satker", { timeoutMs: 45000 });
  const kode = aleta.identitas.kodeSatker || abt.sipp.kodePN;
  if (aleta.identitas.kodeSatker && abt.sipp.kodePN && aleta.identitas.kodeSatker !== abt.sipp.kodePN) {
    throw new ApiError(409, `Kode satker di ALETA (${aleta.identitas.kodeSatker}) berbeda dengan SIPP (${abt.sipp.kodePN}) - periksa dulu.`);
  }
  const rencana = susunRencana(aleta.identitas, abt);
  const hasil: Array<{ kunci: string; noVar: string; ok: boolean; dilewati?: boolean; pesan: string; suntinganId?: string }> = [];
  for (const r of rencana) {
    if (!dipilih.has(r.kunci)) continue;
    if (!r.bisa) {
      hasil.push({ kunci: r.kunci, noVar: r.noVar, ok: false, pesan: r.sebab });
      continue;
    }
    if (!r.perlu) {
      hasil.push({ kunci: r.kunci, noVar: r.noVar, ok: true, dilewati: true, pesan: "Sudah sama - tidak diubah." });
      continue;
    }
    try {
      const v = abt.variabel.find((x) => x.noVar === r.noVar)!;
      if (r.kunci === "kodeSurat") {
        const baru = gantiKodeSurat(v.default_data, aleta.identitas.kodeSurat);
        const h = await simpanVariabel(db, aktor, ip, {
          noVar: r.noVar,
          lama: { default_data: v.default_data },
          baru: { default_data: baru },
          ringkas: `identitas satker: kode surat ${kodeSuratDari(v.default_data)} -> ${aleta.identitas.kodeSurat} (#${r.noVar}#)`,
        });
        hasil.push({ kunci: r.kunci, noVar: r.noVar, ok: true, pesan: "Tersimpan di ABT.", suntinganId: h.suntinganId });
      } else {
        const baru = gantiCabangSatker(v.sql_query, kode, r.nilaiAleta);
        const label = { alamat: "alamat kantor", telepon: "telepon/WA", laman: "laman", surel: "surel" }[r.kunci];
        const h = await simpanKueriSatker(db, aktor, ip, {
          noVar: r.noVar,
          lama: v.sql_query,
          baru,
          ringkas: `identitas satker: ${label} ${r.nilaiAleta ? `"${r.nilaiAleta}"` : "(dikosongkan - kembali ke data SIPP)"} (#${r.noVar}#, ${kode})`.slice(0, 480),
        });
        hasil.push({ kunci: r.kunci, noVar: r.noVar, ok: true, pesan: "Tersimpan di ABT.", suntinganId: h.suntinganId });
      }
    } catch (e) {
      hasil.push({ kunci: r.kunci, noVar: r.noVar, ok: false, pesan: e instanceof Error ? e.message : String(e) });
    }
  }
  return { hasil };
}

// ---------------------------------------------------------------------------
// Logo kop
// ---------------------------------------------------------------------------

export type GambarBlangko = {
  md5: string;
  blip: string;
  jenis: string;
  ukuranByte: number;
  lebar: number;
  tinggi: number;
  jumlah: number;
  jumlahBerkas: number;
  berkas: string[];
  nama: string[];
  peran: string[];
  kotakElektronik: boolean;
  logo: boolean;
  alasanLogo: string;
};

export async function pindaiLogo() {
  return bot<{ jumlahBerkas: number; gambar: GambarBlangko[] }>("/logo/pindai", { timeoutMs: 90000 });
}

export async function gambarBlangko(md5: string) {
  if (!/^[0-9a-f]{32}$/.test(md5)) throw new ApiError(400, "Kode gambar tidak sah.");
  const h = await ambilGambarBotPengaturanAbt(`/logo/gambar?md5=${md5}`);
  if (!h.ok) throw new ApiError(h.status && h.status < 500 ? h.status : 502, h.error);
  return h;
}

/** Logo ALETA diambil dari gambar yang sudah ada di blangko (mis. logo PA Donggala di kop lama). */
export async function logoDariBlangko(db: AletaDatabase, aktor: AktorPengaturan, md5: string) {
  wajibHak(aktor);
  const g = await gambarBlangko(String(md5 || "").toLowerCase());
  const o = await olahLogo(g.isi);
  const kini = await bacaIdentitasAleta(db);
  await tulisBaris(db, aktor, kini.identitas, { base64: o.isi.toString("base64"), jenis: o.jenis, md5: o.md5, lebar: o.lebar, tinggi: o.tinggi });
  return bacaIdentitasAleta(db);
}

/**
 * Membangun paket ganti logo kop di server (folder runtime bot). Blangko
 * TIDAK diubah sampai petugas server menjalankan pasang.sh.
 * badan: {md5: [gambar blangko yang diganti]}
 */
export async function paketLogoKop(db: AletaDatabase, aktor: AktorPengaturan, ip: string, badan: Record<string, unknown>) {
  wajibHak(aktor);
  const logo = await bacaLogoAleta(db);
  if (!logo) throw new ApiError(400, "Unggah atau pilih logo satker dulu, lalu simpan.");
  const md5 = (Array.isArray(badan.md5) ? badan.md5 : []).map((x) => String(x).toLowerCase()).filter((x) => /^[0-9a-f]{32}$/.test(x));
  if (!md5.length) throw new ApiError(400, "Pilih gambar di blangko yang diganti logo satker.");
  const h = await bot<{ paket: { nama: string; folder: string; folderServer: string; jumlahBerkas: number; jumlahGambar: number; berkas: Array<{ rel: string; lama: string; baru: string; gambar: number }> } }>(
    "/logo/paket",
    { method: "POST", timeoutMs: 120000, body: { md5, logoBase64: logo.isi.toString("base64"), oleh: aktor.name } }
  );
  await catatPaketLogo(db, aktor, ip, {
    ringkas: `paket logo kop dibangun: ${h.paket.jumlahBerkas} blangko, ${h.paket.jumlahGambar} gambar - menunggu dipasang di server (${h.paket.folderServer}/pasang.sh)`,
    lama: { md5 },
    baru: { paket: h.paket.nama, folder: h.paket.folderServer, berkas: h.paket.berkas },
  });
  return h;
}
