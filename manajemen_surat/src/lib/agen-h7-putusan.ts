/**
 * ============================================================================
 * AGEN H-7 DRAF PUTUSAN (F4.2, 17 Okt 2026) - ATURAN MURNI
 * ============================================================================
 *
 * Tiap pagi agen memeriksa perkara yang Hari Putusan-nya (agenda musyawarah,
 * pembacaan putusan/penetapan, atau kesimpulan) jatuh dalam tujuh hari ke
 * depan - yang tepat tujuh hari lagi DIBUAT, yang lebih dekat DIPERBARUI - lalu
 * MENYIAPKAN draf putusan:
 *
 *   1. memilih blangko putusan Blangko ABT by Derry Briantono menurut keadaan
 *      perkara (rekomendasi Tahap E, lib/rekomendasi-blangko.ts) - status
 *      putusan belum ada, jadi diperkirakan "dikabulkan", verstek diperkirakan
 *      dari kehadiran Tergugat/Termohon pada sidang-sidang sebelumnya;
 *   2. menggolongkan tiap isian tangan blangko itu:
 *        terisi   sudah ada di ABT (diisi petugas sebelumnya),
 *        pasti    diisi agen dari deteksi yang terukur pasti (aturan sama
 *                 dengan "Input semua yang pasti" di ABT),
 *        usulan   agen punya usulan tetapi belum pasti - manusia memeriksa,
 *        manusia  tidak ada sumbernya - manusia mengisi;
 *      isian HUKUM (pertimbangan, amar, alasan perceraian) TIDAK PERNAH
 *      "pasti": paling jauh usulan (kelas C - selalu satu ketukan manusia);
 *   3. merangkum duduk perkara, jawab-menjawab, bukti, saksi, kesimpulan dari
 *      data yang sudah ada (SIPP, ABT, e-Court) - tiap bagian berlabel
 *      sumbernya, tanpa AI;
 *   4. menilai kesiapan untuk dilaporkan ke majelis dan konseptor (Jadwal
 *      Sidang, checklist konseptor F1.6, Alat saya di ABT).
 *
 * Tidak ada yang ditulis ke SIPP atau ABT. Draf hanya disimpan di basis data
 * ALETA (0068); isian "pasti" dipasang sebagai SARAN di Blangko Derry dan baru
 * tersimpan ke ABT ketika petugas menekannya sendiri.
 *
 * ============================================================================
 * DIUKUR ATAS PUTUSAN SUNGGUHAN (server PA Donggala, baca saja, 17 Okt 2026)
 * ============================================================================
 *
 * Sidang yang memutus 1 Agustus - 16 Oktober 2026: 249. Aturan sidang di bawah
 * menjangkau 219 (88%) - tanpa perkiraan verstek hanya 65 (26%), sebab 176
 * putusan dijatuhkan pada sidang ke-2 beragenda "panggil Tergugat". Atas 204
 * yang dikabulkan/ditolak, draf disusun seperti H-7 (status & kehadiran sidang
 * putusan belum ada, isian tangan teks/tanggal dianggap belum diisi) lalu
 * dibandingkan dengan isian AKHIR putusan di ABT:
 *
 *   blangko H-7 = blangko menurut status akhir   201/204 (98,5%)
 *   isian tangan yang berakhir terisi            1.005
 *     disiapkan "pasti"                          65 - sama persis 51 (78%),
 *                                                sama makna 62 (95%; beda
 *                                                "bulan Agustus 2025" vs
 *                                                "Agustus 2025")
 *     usulan (perlu diperiksa)                   691 - sama 415 (60%)
 *     tanpa usulan (manusia)                     249 (25%)
 *   seluruhnya sama dengan putusan akhir         466/1.005 (46%)
 *
 * Perkiraan verstek: 199 sidang memenuhi syaratnya, 154 (77%) memang diputus
 * hari itu. Rincian: D:/aleta-dev/kerja/f42-ukur/ukur-h7-*.json (skrip ukur
 * zz-ukur-h7.test.ts + proksi.js di folder yang sama).
 */

import { kelompokkanIsian, langkahUntukIsian, type BlangkoPerLangkah, type KodeLangkah } from "@/lib/konseptor-langkah";
import { agendaMusyawarah, sidangIkrar } from "@/lib/keadaan-sidang";
import { masukanRekomendasiDariBaris, rekomendasiBlangko, type Rekomendasi } from "@/lib/rekomendasi-blangko";
import type { ButirIsian, Keadaan, Susunan } from "@/app/api/aleta-ecourt/blangko-derry/susun";

/** Jarak hari antara pagi pemeriksaan dan Hari Putusan yang drafnya DIBUAT. */
export const HARI_H7 = 7;

const teks = (x: unknown) => String(x ?? "").trim();

/** "2026-10-17" + 7 -> "2026-10-24" (kalender, tanpa zona). */
export function tambahHari(tanggal: string, hari: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(teks(tanggal));
  if (!m) return "";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + hari));
  return d.toISOString().slice(0, 10);
}

/** Selisih hari kalender b - a. */
export function selisihHari(a: string, b: string): number {
  const ta = Date.parse(`${teks(a).slice(0, 10)}T00:00:00Z`);
  const tb = Date.parse(`${teks(b).slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return Number.NaN;
  return Math.round((tb - ta) / 86400000);
}

// ============================================================================
// 1. SIDANG MANA YANG DISIAPKAN
// ============================================================================

/** Ruas baris jadwal sidang bot (SidangBaris) yang dipakai agen; selebihnya diteruskan apa adanya. */
export type BarisSidangH7 = {
  perkaraId?: unknown;
  nomorPerkara?: unknown;
  jenisPerkara?: unknown;
  tanggalSidang?: unknown;
  agenda?: unknown;
  alasanDitunda?: unknown;
  ditunda?: unknown;
  sudahPutus?: unknown;
  sidangIkrarTalak?: unknown;
  urutanSidang?: unknown;
  dihadiriOleh?: unknown;
  majelisNama?: unknown;
  paniteraNama?: unknown;
  lewatEcourt?: unknown;
  penandaPerkara?: { ghaib?: unknown; prodeo?: unknown } | null;
  panggilan?: { hadirSebelumnya?: unknown; tergugatPernahHadir?: unknown; penggugatPernahHadir?: unknown } | null;
  saksiNamaPihak1?: unknown;
  saksiNamaPihak2?: unknown;
  [ruas: string]: unknown;
};

export type AlasanH7 = "putusan" | "kesimpulan" | "verstek";

export const ALASAN_H7_TEKS: Record<AlasanH7, string> = {
  putusan: "agenda musyawarah/pembacaan putusan",
  kesimpulan: "agenda kesimpulan",
  verstek: "perkiraan putusan verstek (Tergugat/Termohon belum pernah hadir)",
};

/**
 * Sidang yang menjadi Hari Putusan:
 *   putusan     musyawarah majelis, pembacaan putusan/penetapan, putusan sela
 *               (agendaMusyawarah - aturan yang sama dengan penanda kuning
 *               "Hari Putusan" di Jadwal Sidang);
 *   kesimpulan  agenda kesimpulan - tahap terakhir sebelum musyawarah; di
 *               perkara e-Court sering dibacakan pada hari yang sama;
 *   verstek     PERKIRAAN: sidang ke-2 atau sesudahnya, Tergugat/Termohon
 *               belum pernah hadir, agenda lain (biasanya "panggil Tergugat").
 *               Diukur PA Donggala 1 Agu - 16 Okt 2026: hanya 65 dari 249
 *               putusan jatuh pada agenda musyawarah/putusan/kesimpulan; 199
 *               sidang memenuhi syarat verstek ini dan 154 (77%) memang
 *               diputus hari itu. Dimatikan dengan opsi verstek: false
 *               (env ALETA_AGEN_H7_VERSTEK=0).
 * Sidang ikrar talak dan sidang yang sudah memutus tidak disiapkan.
 */
export function alasanH7(baris: BarisSidangH7, opsi: { verstek?: boolean } = {}): AlasanH7 | "" {
  const agenda = teks(baris.agenda);
  if (sidangIkrar({ agenda, sidangIkrarTalak: baris.sidangIkrarTalak === true })) return "";
  if (baris.sudahPutus === true) return "";
  if (agendaMusyawarah(agenda)) return "putusan";
  if (/kesimpulan/i.test(agenda)) return "kesimpulan";
  if (opsi.verstek !== false && Number(baris.urutanSidang) >= 2 && baris.panggilan?.tergugatPernahHadir === false) return "verstek";
  return "";
}

/** "dibuat" (tepat H-7), "diperbarui" (H-6..H-1, H0), atau "" (di luar jendela). */
export function jendelaH7(hariIni: string, tanggalSidang: string): "dibuat" | "diperbarui" | "" {
  const jarak = selisihHari(hariIni, tanggalSidang);
  if (!Number.isFinite(jarak)) return "";
  if (jarak === HARI_H7) return "dibuat";
  if (jarak >= 0 && jarak < HARI_H7) return "diperbarui";
  return "";
}

// ============================================================================
// 2. BLANGKO
// ============================================================================

export type PilihanBlangkoH7 = {
  utama: Rekomendasi | null;
  alternatif: Rekomendasi[];
  /** Verstek diperkirakan dari kehadiran sebelumnya (Tergugat/Termohon tidak pernah hadir). */
  perkiraanVerstek: boolean;
  alasan: string;
};

/**
 * Blangko putusan Derry untuk Hari Putusan yang belum terjadi.
 *
 * Status putusan belum ada - rekomendasi Tahap E memperkirakannya "Dikabulkan"
 * bila teks dasarnya menyebut musyawarah/putusan; sidang berageda kesimpulan
 * diberi teks dasar musyawarah supaya diperlakukan sama. Kehadiran sidang
 * putusan juga belum ada: dipakai kehadiran sidang sebelumnya, dan verstek
 * diperkirakan bila Tergugat/Termohon tidak pernah hadir.
 */
export function pilihBlangkoH7(baris: BarisSidangH7, alasan: AlasanH7 | ""): PilihanBlangkoH7 {
  const m = masukanRekomendasiDariBaris(baris as Record<string, unknown>);
  const panggilan = (baris.panggilan ?? {}) as Record<string, unknown>;
  const perkiraanVerstek = panggilan.tergugatPernahHadir === false;
  // Teks dasar selalu "musyawarah": rekomendasi Tahap E hanya memberi blangko putusan pada sidang yang memutus, dan
  // agenda "Penetapan"/"Putusan Sela" tidak tertangkap polanya walau agendaMusyawarah menangkapnya.
  const agenda = `Musyawarah majelis${alasan === "kesimpulan" ? " sesudah kesimpulan" : ""} (${teks(baris.agenda)})`;
  const hasil = rekomendasiBlangko({
    ...m,
    agenda,
    alasanDitunda: "",
    keterangan: "",
    ditunda: false,
    sudahPutus: false,
    statusPutusan: "",
    verstekPutusan: perkiraanVerstek,
    dihadiriOleh: m.dihadiriOleh ?? (m.hadirSebelumnya ?? null),
  });
  const daftar = hasil.putusan.map((r) => ({ ...r, perkiraan: true }));
  const utama = daftar.find((r) => r.utama) ?? daftar[0] ?? null;
  return {
    utama,
    alternatif: daftar.filter((r) => r !== utama),
    perkiraanVerstek,
    alasan: utama
      ? `${utama.alasan.replace(/\.$/, "")}${perkiraanVerstek ? "; Tergugat/Termohon belum pernah hadir sehingga diperkirakan verstek" : ""}.`
      : "Belum ada blangko putusan Derry untuk jenis perkara ini.",
  };
}

// ============================================================================
// 3. ISIAN
// ============================================================================

/** Satu usulan deteksi ALETA (bot /abt/usulan: sipp, saksi, itsbat, posita-lain). */
export type UsulanDeteksi = {
  kode?: unknown;
  nama?: unknown;
  nilai?: unknown;
  keyakinan?: unknown;
  tingkat?: unknown;
  bentrok?: unknown;
  catatan?: unknown;
  sumber?: unknown;
};

/**
 * CERMIN s5UsulanPasti (ekstensi-sipp/abt.js, "Input semua yang pasti"):
 *   - bertingkat (0222/0246/9944/5227 dari saksi): hanya tingkat "pasti";
 *   - lainnya: keyakinan "pasti" yang BUKAN dari keterangan saksi, posita,
 *     atau berkas KTP e-Court.
 */
export function usulanPasti(u: UsulanDeteksi | null | undefined): boolean {
  if (!u || !teks(u.nilai)) return false;
  if (typeof u.tingkat === "string" && u.tingkat) return u.tingkat === "pasti";
  if (u.keyakinan !== "pasti") return false;
  const sumber = Array.isArray(u.sumber) ? (u.sumber as Array<Record<string, unknown>>) : [];
  return !sumber.some((x) => x && (x.saksi || x.asal === "posita" || x.asal === "ktp-ecourt"));
}

/** CERMIN s5Sama (abt.js): sama bila hanya berbeda spasi, besar-kecil huruf, jenis petik, dan tag. */
export function samaIsi(a: unknown, b: unknown): boolean {
  const baku = (x: unknown) =>
    String(x == null ? "" : x)
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/[’‘`"“”]/g, "'")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      .replace(/[.;,]+$/, "");
  return baku(a) === baku(b);
}

/** Kode isian HUKUM: tidak pernah diisi agen sebagai "pasti" (kelas C). */
const KODE_HUKUM = new Set(["8503", "8729", "8901", "8902", "4001", "8719"]);
const LANGKAH_HUKUM = new Set<KodeLangkah>(["pertimbangan", "amar"]);

export function isianHukum(b: Pick<ButirIsian, "kode" | "nama" | "jenis" | "khusus">): boolean {
  return KODE_HUKUM.has(b.kode) || LANGKAH_HUKUM.has(langkahUntukIsian(b));
}

export type NilaiPenanda = Record<string, { status?: string; teks?: string; nama?: string; sebab?: string }>;

export type KeadaanPerkaraH7 = { prodeo?: boolean; ghaib?: boolean; lewatEcourt?: boolean | null };

/**
 * CERMIN keadaanBerlakuMurni (ekstensi-sipp/blangko-derry-isian.js): isian
 * berpemicu/berkeadaan hanya berlaku bila keadaannya ada pada perkara ini.
 */
export function isianBerlaku(
  b: Pick<ButirIsian, "pemicu" | "keadaan" | "langsung">,
  ctx: { perkara: KeadaanPerkaraH7 | null; menyala: (kode: string) => boolean; terisi: boolean }
): boolean {
  const k: Keadaan = b.keadaan || "";
  const p = ctx.perkara;
  if (b.pemicu && ctx.menyala(b.pemicu)) return true;
  if (k === "prodeo" && p && p.prodeo === true) return true;
  if (b.pemicu) return false;
  if (!k) return true;
  if (k === "ghaib") return Boolean(p && p.ghaib === true);
  if (k === "ecourt") return !p || p.lewatEcourt !== false;
  if (k === "insidentil") return Boolean(b.langsung) || ctx.terisi;
  if (k === "kuasaP" || k === "kuasaT" || k === "prodeo" || k === "alasanC" || k === "alasanH") return ctx.terisi;
  return true;
}

export type GolonganIsian = "terisi" | "pasti" | "usulan" | "manusia";

export const GOLONGAN_TEKS: Record<GolonganIsian, string> = {
  terisi: "Sudah terisi di ABT",
  pasti: "Disiapkan agen (pasti)",
  usulan: "Usulan agen - perlu diperiksa",
  manusia: "Perlu diisi manusia",
};

export type IsianDraf = {
  kode: string;
  nama: string;
  langkah: KodeLangkah;
  jenis: ButirIsian["jenis"];
  khusus: ButirIsian["khusus"];
  golongan: GolonganIsian;
  /** Nilai ABT (terisi) atau nilai yang disiapkan/diusulkan agen. */
  nilai: string;
  /** Asal nilai dalam bahasa awam. */
  sumber: string;
  catatan: string;
  penting: boolean;
  hukum: boolean;
};

/** Pihak KTP e-Court yang sudah dibaca ALETA (bot aleta_bot_ktp_pihak) - bentuk KtpPihakPerkara.pihak. */
export type KtpPihak = { cabang?: unknown; urutan?: unknown; tanggalKtp?: unknown; yakin?: unknown; cocok?: unknown };

/**
 * Tanggal KTP tiap pihak -> usulan variabel tanggal KTP ABT (cermin KTP_KODE_PIHAK ekstensi-sipp/abt.js):
 * 0364 & 2222 Penggugat/Pemohon, 0365 Tergugat/Termohon, 0366 Pemohon II. Bacaan "pasti" (keputusan 12 Okt:
 * bacaan pasti menimpa) = pasti; "cukup" = usulan; "ragu" tidak dipakai.
 */
export function usulanDariKtp(pihak: KtpPihak[]): UsulanDeteksi[] {
  const peta: Array<[string, number, number]> = [
    ["0364", 1, 1],
    ["2222", 1, 1],
    ["0365", 2, 1],
    ["0366", 1, 2],
  ];
  const out: UsulanDeteksi[] = [];
  for (const [kode, cabang, urutan] of peta) {
    const p = pihak.find((x) => Number(x.cabang) === cabang && Number(x.urutan) === urutan);
    const tanggal = teks(p?.tanggalKtp);
    if (!p || !/^\d{2}\/\d{2}\/\d{4}$/.test(tanggal) || (p.yakin !== "pasti" && p.yakin !== "cukup")) continue;
    out.push({ kode, nilai: tanggal, keyakinan: p.yakin, sumber: [{ asal: "ktp-pihak" }], catatan: teks(p.cocok) ? `KTP dicocokkan: ${teks(p.cocok)}` : "" });
  }
  return out;
}

const ASAL_USULAN: Record<string, string> = {
  ktp: "berkas KTP e-Court",
  sipp: "data SIPP",
  saksi: "keterangan saksi di ABT",
  itsbat: "posita permohonan",
  "posita-lain": "posita",
  posita: "posita",
};

function asalUsulan(u: UsulanDeteksi, jalur: string): string {
  const sumber = Array.isArray(u.sumber) ? (u.sumber as Array<Record<string, unknown>>) : [];
  if (sumber.some((x) => x && x.saksi)) return "keterangan saksi di ABT";
  if (sumber.some((x) => x && x.asal === "posita")) return "posita";
  return ASAL_USULAN[jalur] || "deteksi ALETA";
}

export type MasukanGolongkan = {
  susunan: Pick<Susunan, "isian">;
  nilai: NilaiPenanda;
  /** Usulan per kode beserta jalurnya (sipp/saksi/itsbat/posita-lain). Yang pertama per kode dipakai. */
  usulan: Array<{ jalur: string; usulan: UsulanDeteksi }>;
  perkara: KeadaanPerkaraH7 | null;
};

/** Memotong nilai panjang untuk disimpan/ditampilkan (draf bukan naskah). */
const potong = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function golongkanIsian(m: MasukanGolongkan): IsianDraf[] {
  const usulanPerKode = new Map<string, { jalur: string; usulan: UsulanDeteksi }>();
  for (const x of m.usulan) {
    const kode = teks(x.usulan?.kode);
    if (!kode || !teks(x.usulan?.nilai)) continue;
    const lama = usulanPerKode.get(kode);
    // Usulan pasti mengalahkan yang ragu; selebihnya yang pertama.
    if (!lama || (!usulanPasti(lama.usulan) && usulanPasti(x.usulan))) usulanPerKode.set(kode, x);
  }
  const terisiAbt = (kode: string) => {
    const v = m.nilai[kode];
    return Boolean(v && v.status === "terisi" && teks(v.teks));
  };
  const hurufAlasan = () => {
    const isi = teks(m.nilai["8503"]?.teks) || teks(usulanPerKode.get("8503")?.usulan.nilai);
    return isi.split("·")[0].toUpperCase().replace(/[^A-H]/g, "");
  };
  const menyala = (kode: string) => {
    if (kode === "11116" && hurufAlasan().includes("C")) return true;
    if (kode === "11117" && hurufAlasan().includes("H")) return true;
    return Boolean(teks(m.nilai[kode]?.teks));
  };

  const hasil: IsianDraf[] = [];
  for (const b of m.susunan.isian) {
    if (!b.wajib) continue;
    const terisi = terisiAbt(b.kode);
    if (!isianBerlaku(b, { perkara: m.perkara, menyala, terisi })) continue;
    const hukum = isianHukum(b);
    const dasar = {
      kode: b.kode,
      nama: b.nama,
      langkah: langkahUntukIsian(b),
      jenis: b.jenis,
      khusus: b.khusus,
      penting: b.tingkat !== "tambahan",
      hukum,
    };
    if (terisi) {
      hasil.push({ ...dasar, golongan: "terisi", nilai: potong(teks(m.nilai[b.kode]?.teks), 600), sumber: "ABT", catatan: "" });
      continue;
    }
    const u = b.jenis === "tj" ? undefined : usulanPerKode.get(b.kode);
    if (u) {
      const pasti = usulanPasti(u.usulan) && !hukum;
      hasil.push({
        ...dasar,
        golongan: pasti ? "pasti" : "usulan",
        nilai: potong(teks(u.usulan.nilai), 600),
        sumber: asalUsulan(u.usulan, u.jalur),
        catatan: hukum
          ? "Isian hukum - agen hanya mengusulkan, majelis yang menentukan."
          : teks(u.usulan.bentrok)
            ? `Sumber berbeda: ${potong(teks(u.usulan.bentrok), 160)}`
            : potong(teks(u.usulan.catatan), 200),
      });
      continue;
    }
    hasil.push({
      ...dasar,
      golongan: "manusia",
      nilai: "",
      sumber: "",
      catatan:
        b.jenis === "tj"
          ? "Tanya jawab belum diisi di ABT."
          : b.khusus === "bukti"
            ? "Daftar bukti surat belum diisi di ABT."
            : hukum
              ? "Isian hukum - diisi majelis/konseptor."
              : teks(m.nilai[b.kode]?.sebab)
                ? potong(teks(m.nilai[b.kode]?.sebab), 160)
                : "",
    });
  }
  return hasil;
}

export type OtomatisDraf = { jumlah: number; terisi: number; kosong: Array<{ kode: string; nama: string; sebab: string }> };

/**
 * Variabel otomatis (dari SIPP lewat mesin variabel ABT) yang TERTULIS
 * LANGSUNG di naskah: yang kosong berarti data SIPP-nya belum ada - manusia
 * melengkapi SIPP, bukan blangko.
 */
export function ringkasOtomatis(susunan: Pick<Susunan, "otomatis">, nilai: NilaiPenanda): OtomatisDraf {
  const langsung = susunan.otomatis.filter((o) => o.langsung);
  const kosong: OtomatisDraf["kosong"] = [];
  let terisi = 0;
  for (const o of langsung) {
    const v = nilai[o.kode];
    if (!v) continue;
    if (v.status === "terisi") terisi += 1;
    else if (v.status === "kosong") kosong.push({ kode: o.kode, nama: o.nama, sebab: potong(teks(v.sebab), 140) });
  }
  const dinilai = langsung.filter((o) => nilai[o.kode]).length;
  return { jumlah: dinilai, terisi, kosong: kosong.slice(0, 20) };
}

// ============================================================================
// 4. RINGKASAN DARI DATA YANG ADA
// ============================================================================

export type RiwayatSidang = {
  urutan?: unknown;
  sidangKe?: unknown;
  tanggalSidang?: unknown;
  agenda?: unknown;
  dihadiriOleh?: unknown;
  alasanDitunda?: unknown;
};

export type SaksiDiperiksa = { pihak?: unknown; saksiKePihak?: unknown; saksiKe?: unknown; tanyaJawab?: unknown };

export type DokumenEcourt = { jenis?: unknown; judul?: unknown; tanggalSidang?: unknown; statusVerifikasi?: unknown; peranPengunggah?: unknown };

export type BagianRingkasan = {
  kode: "duduk" | "jawab" | "bukti" | "saksi" | "kesimpulan";
  judul: string;
  isi: string[];
  sumber: string;
  /** Bahan bagian ini sudah ada (bukan "belum ada"). */
  ada: boolean;
};

const HADIR_TEKS: Record<number, string> = {
  1: "semua pihak hadir",
  2: "hanya pihak pertama hadir",
  3: "hanya pihak kedua hadir",
  4: "para pihak tidak hadir",
};

const BLN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** "2026-10-24" -> "24 Oktober 2026". */
export function tanggalPanjang(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(teks(iso));
  if (!m) return teks(iso);
  return `${Number(m[3])} ${BLN[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

function polos(html: string): string {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|div)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/** Butir "Bahwa ..." pada posita (atau kalimat bila tidak berbutir). */
export function butirPosita(posita: string): string[] {
  const t = polos(posita).replace(/\n/g, " ");
  if (!t) return [];
  const pecah = t.split(/(?=\b(?:\d+\.\s*)?[Bb]ahwa\b)/).map((s) => s.trim()).filter((s) => s.length > 12);
  return pecah.length > 1 ? pecah : t.split(/(?<=[.;])\s+/).map((s) => s.trim()).filter((s) => s.length > 12);
}

const POLA_JAWAB = /jawab|replik|duplik|pembuktian|bukti|saksi|kesimpulan|mediasi|rekonvensi|eksepsi/i;

export function susunRingkasan(m: {
  nilai: NilaiPenanda;
  riwayat: RiwayatSidang[];
  saksi: SaksiDiperiksa[];
  dokumen: DokumenEcourt[];
  namaSaksi: { P: string[]; T: string[] };
  sebutan: { P: string; T: string };
}): BagianRingkasan[] {
  const v = (kode: string) => (m.nilai[kode]?.status === "terisi" ? polos(teks(m.nilai[kode]?.teks)) : "");

  // Duduk perkara: posita gugatan/permohonan (5125, SIPP).
  const butir = butirPosita(teks(m.nilai["5125"]?.teks));
  const duduk: BagianRingkasan = {
    kode: "duduk",
    judul: "Duduk perkara",
    sumber: "Posita gugatan/permohonan di SIPP",
    ada: butir.length > 0,
    isi: butir.length
      ? [`Posita memuat ${butir.length} butir.`, ...butir.slice(0, 3).map((b) => potong(b, 260)), ...(butir.length > 3 ? [`… ${butir.length - 3} butir lainnya.`] : [])]
      : ["Posita belum terbaca dari SIPP."],
  };

  // Jawab-menjawab: riwayat sidang beragenda jawaban s.d. kesimpulan + dokumen e-Court.
  const sidang = m.riwayat
    .filter((r) => POLA_JAWAB.test(teks(r.agenda)))
    .map((r) => {
      const ke = Number(r.urutan ?? r.sidangKe) || 0;
      const hadir = HADIR_TEKS[Number(r.dihadiriOleh) || 0] || "";
      return `Sidang${ke ? ` ke-${ke}` : ""} ${tanggalPanjang(teks(r.tanggalSidang))}: ${teks(r.agenda)}${hadir ? ` (${hadir})` : ""}.`;
    });
  const dok = m.dokumen
    .filter((d) => /jawab|replik|duplik|kesimpulan|eksepsi|rekonvensi/i.test(`${teks(d.jenis)} ${teks(d.judul)}`))
    .map(
      (d) =>
        `e-Court: ${teks(d.judul) || teks(d.jenis)}${teks(d.peranPengunggah) ? ` dari ${teks(d.peranPengunggah)}` : ""}${
          teks(d.tanggalSidang) ? `, sidang ${tanggalPanjang(teks(d.tanggalSidang))}` : ""
        }${teks(d.statusVerifikasi) ? ` - ${teks(d.statusVerifikasi).toLowerCase()}` : ""}.`
    );
  const pernahHadirT = m.riwayat.some((r) => [1, 3].includes(Number(r.dihadiriOleh)));
  const jawab: BagianRingkasan = {
    kode: "jawab",
    judul: "Jawab-menjawab dan jalannya sidang",
    sumber: "Jadwal sidang SIPP dan dokumen e-Court",
    ada: sidang.length + dok.length > 0,
    isi:
      sidang.length + dok.length
        ? [...sidang.slice(-8), ...dok.slice(0, 6)]
        : [
            pernahHadirT
              ? "Belum ada sidang jawab-menjawab yang tercatat."
              : `${m.sebutan.T} belum pernah hadir - tidak ada jawab-menjawab (kemungkinan verstek).`,
          ],
  };

  // Bukti surat: isian bukti di ABT (1214 pihak pertama, 9911 pihak kedua).
  const buktiP = v("1214");
  const buktiT = v("9911");
  const barisBukti = (t: string) => t.split("\n").map((s) => s.trim()).filter(Boolean);
  const bukti: BagianRingkasan = {
    kode: "bukti",
    judul: "Bukti surat",
    sumber: "Isian bukti di ABT",
    ada: Boolean(buktiP || buktiT),
    isi: [
      buktiP ? `${m.sebutan.P}: ${barisBukti(buktiP).length} baris bukti.` : `${m.sebutan.P}: bukti surat belum diisi di ABT.`,
      ...barisBukti(buktiP).slice(0, 5).map((s) => potong(s, 200)),
      ...(buktiT ? [`${m.sebutan.T}: ${barisBukti(buktiT).length} baris bukti.`, ...barisBukti(buktiT).slice(0, 3).map((s) => potong(s, 200))] : []),
    ],
  };

  // Saksi: yang diajukan (SIPP), yang sudah diperiksa (ABT), dan inti keterangannya (2021/2022).
  const diperiksa = { P: 0, T: 0 };
  for (const s of m.saksi) {
    const pihak = teks(s.pihak) === "T" ? "T" : "P";
    const tj = Array.isArray(s.tanyaJawab) ? s.tanyaJawab.length : 0;
    if (tj > 0) diperiksa[pihak] += 1;
  }
  const ket1 = v("2021");
  const ket2 = v("2022");
  const saksi: BagianRingkasan = {
    kode: "saksi",
    judul: "Keterangan saksi",
    sumber: "Pemeriksaan saksi di ABT, nama saksi di SIPP",
    ada: diperiksa.P + diperiksa.T > 0 || Boolean(ket1 || ket2),
    isi: [
      `Saksi ${m.sebutan.P}: ${m.namaSaksi.P.length} diajukan${m.namaSaksi.P.length ? ` (${m.namaSaksi.P.slice(0, 4).join(", ")})` : ""}, ${diperiksa.P} sudah diperiksa.`,
      `Saksi ${m.sebutan.T}: ${m.namaSaksi.T.length} diajukan${m.namaSaksi.T.length ? ` (${m.namaSaksi.T.slice(0, 4).join(", ")})` : ""}, ${diperiksa.T} sudah diperiksa.`,
      ...(ket1 ? [`Saksi pertama: ${potong(ket1.replace(/\n/g, " "), 300)}`] : []),
      ...(ket2 ? [`Saksi kedua: ${potong(ket2.replace(/\n/g, " "), 300)}`] : []),
    ],
  };

  // Kesimpulan: isian kesimpulan di ABT (8436/8437) atau agenda kesimpulan.
  const kesP = v("8436");
  const kesT = v("8437");
  const sidangKesimpulan = m.riwayat.filter((r) => /kesimpulan/i.test(teks(r.agenda)));
  const kesimpulan: BagianRingkasan = {
    kode: "kesimpulan",
    judul: "Kesimpulan para pihak",
    sumber: "Isian kesimpulan di ABT, jadwal sidang SIPP",
    ada: Boolean(kesP || kesT),
    isi: [
      kesP ? `${m.sebutan.P}: ${potong(kesP.replace(/\n/g, " "), 240)}` : `${m.sebutan.P}: kesimpulan belum diisi di ABT.`,
      ...(kesT ? [`${m.sebutan.T}: ${potong(kesT.replace(/\n/g, " "), 240)}`] : []),
      ...(sidangKesimpulan.length ? [`Agenda kesimpulan: ${sidangKesimpulan.map((r) => tanggalPanjang(teks(r.tanggalSidang))).join(", ")}.`] : []),
    ],
  };

  return [duduk, jawab, bukti, saksi, kesimpulan];
}

// ============================================================================
// 5. KESIAPAN & LAPORAN
// ============================================================================

export type KesiapanH7 = {
  /** siap = tidak ada yang perlu manusia; hampir = paling banyak 3 isian; belum = selebihnya / tanpa blangko. */
  tingkat: "siap" | "hampir" | "belum";
  jumlah: number;
  terisi: number;
  pasti: number;
  usulan: number;
  manusia: number;
  /** (terisi + pasti) / jumlah, dibulatkan. */
  persen: number;
  /** Nama isian yang perlu manusia (usulan dulu, lalu manusia), paling banyak 12. */
  perlu: string[];
  /** Variabel otomatis yang kosong karena data SIPP belum ada. */
  dataSippKosong: number;
  /** Per langkah checklist konseptor (F1.6): isian terisi/pasti dianggap terisi. */
  perLangkah: BlangkoPerLangkah;
};

export function nilaiKesiapanH7(isian: IsianDraf[], otomatis: OtomatisDraf | null, adaBlangko: boolean): KesiapanH7 {
  const hitung = (g: GolonganIsian) => isian.filter((i) => i.golongan === g).length;
  const terisi = hitung("terisi");
  const pasti = hitung("pasti");
  const usulan = hitung("usulan");
  const manusia = hitung("manusia");
  const jumlah = isian.length;
  const perlu = [...isian.filter((i) => i.golongan === "usulan"), ...isian.filter((i) => i.golongan === "manusia")].map((i) => i.nama);
  const dataSippKosong = otomatis ? otomatis.kosong.length : 0;
  const sisa = usulan + manusia + dataSippKosong;
  return {
    tingkat: !adaBlangko ? "belum" : sisa === 0 ? "siap" : sisa <= 3 ? "hampir" : "belum",
    jumlah,
    terisi,
    pasti,
    usulan,
    manusia,
    persen: jumlah ? Math.round(((terisi + pasti) / jumlah) * 100) : adaBlangko ? 100 : 0,
    perlu: perlu.slice(0, 12),
    dataSippKosong,
    perLangkah: kelompokkanIsian(
      isian.map((i) => ({ kode: i.kode, nama: i.nama, jenis: i.jenis, khusus: i.khusus, terisi: i.golongan === "terisi" || i.golongan === "pasti" }))
    ),
  };
}

export type DrafH7 = {
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  tanggalSidang: string;
  agenda: string;
  alasan: AlasanH7;
  majelis: string;
  panitera: string;
  blangko: PilihanBlangkoH7;
  isian: IsianDraf[];
  otomatis: OtomatisDraf | null;
  ringkasan: BagianRingkasan[];
  kesiapan: KesiapanH7;
  /** Bahan yang gagal dibaca (bot tidak menjawab, blangko tidak terbaca) - disebut jujur. */
  kendala: string[];
  dibuatPada: string;
};

/** Ringkas untuk Jadwal Sidang, checklist konseptor, dan widget. */
export type RingkasDrafH7 = {
  tanggalSidang: string;
  blangko: string;
  tingkat: KesiapanH7["tingkat"];
  persen: number;
  perlu: string[];
  jumlahPerlu: number;
  dibuatPada: string;
};

export function ringkasDrafH7(d: Pick<DrafH7, "tanggalSidang" | "blangko" | "kesiapan" | "dibuatPada">): RingkasDrafH7 {
  return {
    tanggalSidang: d.tanggalSidang,
    blangko: d.blangko.utama ? d.blangko.utama.label : "",
    tingkat: d.kesiapan.tingkat,
    persen: d.kesiapan.persen,
    perlu: d.kesiapan.perlu.slice(0, 6),
    jumlahPerlu: d.kesiapan.usulan + d.kesiapan.manusia + d.kesiapan.dataSippKosong,
    dibuatPada: d.dibuatPada,
  };
}

/**
 * Bahan kartu checklist konseptor (portal & Blangko Derry di ABT): ringkas,
 * blangko yang dibuka, dan SARAN per kode - "pasti" dan "usulan" - yang
 * dipasang sebagai saran Blangko Derry (tidak tersimpan ke ABT sebelum
 * petugas memakainya).
 */
export type DrafH7Checklist = {
  ringkas: RingkasDrafH7;
  blangko: Pick<Rekomendasi, "folder" | "berkas" | "menu" | "alias" | "label"> | null;
  alasanBlangko: string;
  saran: Record<string, { nilai: string; golongan: "pasti" | "usulan"; sumber: string }>;
  perlu: Array<{ nama: string; golongan: GolonganIsian; catatan: string }>;
  laporan: string[];
};

export function untukChecklistH7(d: DrafH7): DrafH7Checklist {
  const u = d.blangko.utama;
  const saran: DrafH7Checklist["saran"] = {};
  for (const i of d.isian) {
    if ((i.golongan === "pasti" || i.golongan === "usulan") && i.nilai && !i.nilai.endsWith("…")) {
      saran[i.kode] = { nilai: i.nilai, golongan: i.golongan, sumber: i.sumber };
    }
  }
  return {
    ringkas: ringkasDrafH7(d),
    blangko: u ? { folder: u.folder, berkas: u.berkas, menu: u.menu, alias: u.alias, label: u.label } : null,
    alasanBlangko: d.blangko.alasan,
    saran,
    perlu: d.isian
      .filter((i) => i.golongan === "usulan" || i.golongan === "manusia")
      .map((i) => ({ nama: i.nama, golongan: i.golongan, catatan: i.catatan }))
      .slice(0, 30),
    laporan: teksLaporanH7(d),
  };
}

/** Lencana singkat: "Draf H-7 siap" / "Draf H-7 85% - 3 perlu diisi". */
export function teksLencanaH7(r: RingkasDrafH7 | null | undefined): string {
  if (!r) return "";
  if (!r.blangko) return "Draf H-7: blangko belum ada";
  if (r.tingkat === "siap") return "Draf H-7 siap";
  return `Draf H-7 ${r.persen}% - ${r.jumlahPerlu} perlu diisi`;
}

/** Laporan dalam kalimat untuk majelis dan konseptor. */
export function teksLaporanH7(d: DrafH7): string[] {
  const k = d.kesiapan;
  const baris: string[] = [
    d.alasan === "verstek"
      ? `Perkiraan Hari Putusan ${tanggalPanjang(d.tanggalSidang)} - ${ALASAN_H7_TEKS.verstek}; agenda: ${d.agenda || "belum ditulis"}.`
      : `Hari Putusan ${tanggalPanjang(d.tanggalSidang)} (${d.agenda || "agenda belum ditulis"}).`,
    d.blangko.utama ? `Blangko yang disiapkan: ${d.blangko.utama.label} - ${d.blangko.alasan}` : d.blangko.alasan,
  ];
  if (d.blangko.utama) {
    baris.push(
      `${k.terisi + k.pasti} dari ${k.jumlah} isian siap (${k.terisi} sudah di ABT, ${k.pasti} disiapkan agen); ${k.usulan} usulan perlu diperiksa, ${k.manusia} perlu diisi manusia.`
    );
    if (k.dataSippKosong) baris.push(`${k.dataSippKosong} data SIPP yang dipakai naskah masih kosong - lengkapi di SIPP.`);
    if (k.perlu.length) baris.push(`Perlu perhatian: ${k.perlu.join(", ")}.`);
  }
  if (d.kendala.length) baris.push(`Belum terbaca: ${d.kendala.join("; ")}.`);
  baris.push("Draf ini belum disimpan ke ABT maupun SIPP - isian dipakai lewat Blangko ABT by Derry Briantono oleh petugas.");
  return baris;
}

// ============================================================================
// 6. UKUR - DRAF H-7 DIBANDINGKAN DENGAN ISIAN AKHIR PUTUSAN
// ============================================================================

/** "03/05/2021", "3 Mei 2021", "Senin, 3 Mei 2021", "2021-05-03" -> "2021-05-03"; selain tanggal utuh -> "". */
export function tanggalIso(s: string): string {
  const t = teks(s).replace(/^[A-Za-z']+,\s*/, "");
  let m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return t;
  m = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(t);
  if (m) {
    const b = BLN.findIndex((x) => x.toLowerCase().startsWith(m![2].toLowerCase().slice(0, 3)));
    if (b >= 0) return `${m[3]}-${String(b + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return "";
}

export type HasilBanding = {
  /** Isian draf (pasti/usulan) yang punya isian akhir di ABT. */
  dibandingkan: number;
  sama: number;
  pastiDibandingkan: number;
  pastiSama: number;
  beda: Array<{ kode: string; golongan: GolonganIsian; draf: string; akhir: string }>;
};

/**
 * Isian draf yang disiapkan/diusulkan agen dibandingkan dengan isian AKHIR
 * putusan di ABT (abt_data_teks sesudah putus). Isian yang sudah terisi saat
 * draf dibuat tidak dihitung (itu bukan kerja agen).
 */
export function bandingkanDenganAkhir(isian: IsianDraf[], akhir: Record<string, string>): HasilBanding {
  const h: HasilBanding = { dibandingkan: 0, sama: 0, pastiDibandingkan: 0, pastiSama: 0, beda: [] };
  for (const i of isian) {
    if (i.golongan !== "pasti" && i.golongan !== "usulan") continue;
    const a = teks(akhir[i.kode]);
    if (!a) continue;
    const ta = tanggalIso(a);
    const sama =
      samaIsi(i.nilai.replace(/…$/, ""), a) ||
      (i.nilai.endsWith("…") && samaIsi(a.slice(0, i.nilai.length - 1), i.nilai.slice(0, -1))) ||
      // Isian tanggal: ABT menampilkan "3 Mei 2021", usulan menulis "03/05/2021" - sama bila harinya sama.
      (Boolean(ta) && ta === tanggalIso(i.nilai));
    h.dibandingkan += 1;
    if (sama) h.sama += 1;
    if (i.golongan === "pasti") {
      h.pastiDibandingkan += 1;
      if (sama) h.pastiSama += 1;
    }
    if (!sama && h.beda.length < 30) h.beda.push({ kode: i.kode, golongan: i.golongan, draf: potong(i.nilai, 120), akhir: potong(a, 120) });
  }
  return h;
}
