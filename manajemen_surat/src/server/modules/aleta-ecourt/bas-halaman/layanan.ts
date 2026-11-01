import { createHash } from "node:crypto";

import { PDFDocument } from "pdf-lib";

import { type AletaDatabase } from "@/server/db/client";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";

import type { LaporanZcross } from "../zcross";
import type { BentukMasuk, Mesin } from "../zcross/mesin";
import { bukaDocx } from "../zcross/docx";
import { bacaKataPdf, ekorParagraf, halamanEkor } from "../zcross/pdf-letak";
import { paragrafNaskah, pasangNomorAwal, pasangNomorBagian, type LampiranBagian } from "./naskah";
import {
  halamanAkhirBas,
  hitungHalamanAwal,
  konteksDariNaskah,
  periksaSesudah,
  pilihSidangDariTanggal,
  urutkanSidangBas,
  type CatatanHalaman,
  type SidangBas,
  type TitikNomor,
} from "./runut";

/**
 * NOMOR HALAMAN BAS RUNUT - penyambung ke basis data portal (aleta_bas_halaman, migrasi 0123) dan ke SIPP (jembatan baca bot
 * "berkas.jadwalBas": urutan sidang, halaman PDF e-Doc BAS, halaman berkas e-Court jawaban/replik/duplik/kesimpulan). OTOMATIS, tanpa
 * tombol, di:
 *   - api/aleta-ecourt/bas/z-cross     (unduh / cetak RTF, DOCX, DOC dari panel; catatan halaman ditulis DI LATAR),
 *   - api/aleta-bot/abt/pdf            (cetak PDF dari panel; halaman dihitung dari PDF yang memang dibuat),
 *   - api/aleta-ecourt/bas/word-ke-pdf (unggah BAS Word ke e-Doc SIPP; perkara & sidang dikenali dari naskah; DOC diubah ke DOCX).
 *
 * Alur tiap BAS: kenali perkara & sidang -> halaman awal (runut.ts) -> pasang nomor awal (naskah.ts) -> lompatan sesudah lampiran
 * jawab-menjawab (keputusan 87; ukur letak halaman SATU kali, hasil disinggahkan) -> Z cross seperti biasa -> hitung halaman PDF akhir ->
 * catat. KINERJA (arahan 1 Nov): render tidak diulang bila tidak perlu (PDF ukur dipakai ulang sebagai hitungan akhir bila Z tidak mengubah
 * naskah; BAS yang sama persis dengan catatan tidak dirender lagi; jadwal SIPP disinggahkan 60 detik per perkara).
 * Galat apa pun TIDAK menahan cetak/unduh/unggah: naskah dipakai apa adanya + peringatan. Tidak ada tulisan ke SIPP/ABT.
 */

export type KonteksBas = {
  perkaraId?: string;
  nomorPerkara?: string;
  sidangId?: string;
  /** Tanggal sidang (YYYY-MM-DD). */
  tanggal?: string;
  /** Daftar sidang dari panel - cadangan bila SIPP tidak terbaca. */
  sidang?: SidangBas[];
};

export type HalamanLampiran = Partial<Record<LampiranBagian["jenis"], { halaman: number | null; jumlah: number }>>;

export type RencanaRunut = {
  perkaraId: string;
  nomorPerkara: string;
  sidang: SidangBas[];
  sasaran: SidangBas;
  awal: number;
  ke: number;
  peringatan: string[];
  catatan: CatatanHalaman[];
  lampiran: HalamanLampiran;
  /** Bagian sesudah lampiran yang nomornya melompat (diisi pasangRunut). */
  peta: TitikNomor[];
};

type Jadwal = { perkaraId: string; nomorPerkara: string; sidang: SidangBas[]; lampiran?: HalamanLampiran };

export type DepsRunut = {
  /** Jadwal sidang + halaman e-Doc + halaman lampiran e-Court dari SIPP (bawaan: jembatan bot, disinggahkan 60 detik). */
  jadwal?: (p: { perkaraId?: string; nomorPerkara?: string }) => Promise<Jadwal | null>;
  /** Mesin render (ukur halaman lampiran, DOC -> DOCX, hitung halaman). Bawaan: mesin portal (soffice bot di server). */
  mesin?: Mesin;
};

const BATAS_JADWAL_MS = 8000;
const UMUR_JADWAL_MS = 60_000;
const singgahJadwal = new Map<string, { saat: number; isi: Jadwal }>();

async function jadwalLewatBot(p: { perkaraId?: string; nomorPerkara?: string }): Promise<Jadwal | null> {
  const kunci = `${p.perkaraId || ""}|${p.nomorPerkara || ""}`;
  const ada = singgahJadwal.get(kunci);
  if (ada && Date.now() - ada.saat < UMUR_JADWAL_MS) return ada.isi;
  const r = await callAletaBotSippBridge<{ ok?: boolean; perkaraId?: string; nomorPerkara?: string; sidang?: SidangBas[]; lampiran?: HalamanLampiran }>(
    "berkas.jadwalBas",
    { perkaraId: p.perkaraId || "", nomorPerkara: p.nomorPerkara || "" },
    { timeoutMs: BATAS_JADWAL_MS }
  );
  if (!r.ok || !r.data || r.data.ok === false || !Array.isArray(r.data.sidang)) return null;
  const isi: Jadwal = { perkaraId: String(r.data.perkaraId || p.perkaraId || ""), nomorPerkara: String(r.data.nomorPerkara || p.nomorPerkara || ""), sidang: r.data.sidang, lampiran: r.data.lampiran ?? {} };
  if (singgahJadwal.size > 200) singgahJadwal.clear();
  singgahJadwal.set(kunci, { saat: Date.now(), isi });
  return isi;
}

async function mesinBawaan(): Promise<Mesin> {
  const { pilihMesinPortal } = await import("../zcross/pakai");
  return pilihMesinPortal();
}

const sidik = (b: Uint8Array): string => createHash("sha256").update(b).digest("hex");

// ----------------------------------------------------------------------------
// Tabel aleta_bas_halaman
// ----------------------------------------------------------------------------
type BarisDb = { sidang_id: string; tanggal_sidang: string; halaman_awal: number; halaman_akhir: number; halaman_fisik?: number; sidik?: string };

export async function bacaCatatanHalaman(db: AletaDatabase, perkaraId: string): Promise<Array<CatatanHalaman & { fisik: number; sidik: string }>> {
  const baris = await db
    .queryAll<BarisDb>("SELECT sidang_id, tanggal_sidang, halaman_awal, halaman_akhir, halaman_fisik, sidik FROM aleta_bas_halaman WHERE perkara_id = ?", [perkaraId])
    .catch(() => [] as BarisDb[]);
  return baris.map((b) => ({
    sidangId: String(b.sidang_id || ""),
    tanggal: String(b.tanggal_sidang || ""),
    awal: Number(b.halaman_awal) || 1,
    akhir: Number(b.halaman_akhir) || 1,
    fisik: Number(b.halaman_fisik) || 0,
    sidik: String(b.sidik || ""),
  }));
}

export type CatatBaru = {
  perkaraId: string;
  nomorPerkara: string;
  sidang: SidangBas;
  awal: number;
  akhir: number;
  fisik: number;
  lompatBukti: number;
  sumber: "cetak" | "unduh" | "unggah";
  olehId: string;
  sidik?: string;
};

export async function simpanCatatanHalaman(db: AletaDatabase, c: CatatBaru, kini = new Date()): Promise<void> {
  const kunci = c.sidang.id ? c.sidang.id : `t:${c.sidang.tanggal}`;
  const nilai = [c.nomorPerkara, c.sidang.id || "", c.sidang.tanggal || "", c.awal, c.akhir, c.fisik, c.lompatBukti, c.sumber, c.olehId, kini.toISOString(), c.sidik ?? "", c.perkaraId, kunci];
  const ubah = await db.run(
    "UPDATE aleta_bas_halaman SET nomor_perkara = ?, sidang_id = ?, tanggal_sidang = ?, halaman_awal = ?, halaman_akhir = ?, halaman_fisik = ?, lompat_bukti = ?, sumber = ?, dicatat_oleh = ?, dicatat_pada = ?, sidik = ? WHERE perkara_id = ? AND sidang_kunci = ?",
    nilai
  );
  if (!ubah || !ubah.changes) {
    await db.run(
      "INSERT INTO aleta_bas_halaman (nomor_perkara, sidang_id, tanggal_sidang, halaman_awal, halaman_akhir, halaman_fisik, lompat_bukti, sumber, dicatat_oleh, dicatat_pada, sidik, perkara_id, sidang_kunci) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      nilai
    );
  }
}

// ----------------------------------------------------------------------------
// Rencana: perkara, sidang, halaman awal
// ----------------------------------------------------------------------------
/**
 * Mengenali perkara & sidang BAS (konteks dari panel; bila kosong dari naskah: nomor perkara + tanggal sidang pertama yang cocok dengan jadwal)
 * dan menghitung halaman awalnya. null = BAS tidak dapat dikenali (nomor halaman tidak diatur, naskah apa adanya).
 */
export async function rencanakanRunut(
  db: AletaDatabase,
  bita: Uint8Array,
  bentuk: BentukMasuk,
  konteks: KonteksBas,
  deps: DepsRunut = {}
): Promise<{ rencana: RencanaRunut | null; alasan: string }> {
  let { perkaraId = "", nomorPerkara = "" } = konteks;
  let tanggalCalon: string[] = konteks.tanggal ? [konteks.tanggal.slice(0, 10)] : [];
  if (!perkaraId && !nomorPerkara) {
    const k = konteksDariNaskah(paragrafNaskah(bita, bentuk));
    nomorPerkara = k.nomorPerkara;
    tanggalCalon = k.tanggal;
    if (!nomorPerkara) return { rencana: null, alasan: "Nomor perkara tidak terbaca di naskah BAS: nomor halaman tidak diatur otomatis." };
  } else if (!konteks.sidangId && !konteks.tanggal) {
    tanggalCalon = konteksDariNaskah(paragrafNaskah(bita, bentuk)).tanggal;
  }
  const ambil = deps.jadwal ?? jadwalLewatBot;
  let j: Jadwal | null = null;
  try {
    j = await ambil({ perkaraId, nomorPerkara });
  } catch {
    j = null;
  }
  let sidang: SidangBas[] = j?.sidang ?? [];
  const peringatanAwal: string[] = [];
  if (!j) {
    if (!konteks.sidang?.length || !perkaraId) return { rencana: null, alasan: "Jadwal sidang SIPP belum dapat dibaca: nomor halaman BAS tidak diatur otomatis." };
    sidang = konteks.sidang;
    peringatanAwal.push("Jadwal sidang SIPP belum dapat dibaca; urutan BAS memakai daftar sidang di panel dan halaman e-Doc tidak dihitung.");
  } else {
    perkaraId = j.perkaraId || perkaraId;
    nomorPerkara = j.nomorPerkara || nomorPerkara;
  }
  if (!perkaraId) return { rencana: null, alasan: "Perkara tidak ditemukan di SIPP: nomor halaman BAS tidak diatur otomatis." };
  const urut = urutkanSidangBas(sidang);
  const sasaran = (konteks.sidangId && urut.find((s) => s.id === String(konteks.sidangId))) || pilihSidangDariTanggal(urut, tanggalCalon);
  if (!sasaran) return { rencana: null, alasan: "Sidang BAS ini tidak ditemukan di jadwal sidang perkara: nomor halaman tidak diatur otomatis." };
  const catatan = await bacaCatatanHalaman(db, perkaraId);
  const h = hitungHalamanAwal({ sidang: urut, sasaran: { sidangId: sasaran.id, tanggal: sasaran.tanggal }, catatan });
  return {
    rencana: { perkaraId, nomorPerkara, sidang: urut, sasaran, awal: h.awal, ke: h.ke, peringatan: [...peringatanAwal, ...h.peringatan], catatan, lampiran: j?.lampiran ?? {}, peta: [] },
    alasan: "",
  };
}

// ----------------------------------------------------------------------------
// Lompatan sesudah lampiran jawab-menjawab (keputusan 87)
// ----------------------------------------------------------------------------
const NAMA_LAMPIRAN: Record<LampiranBagian["jenis"], string> = { jawaban: "jawaban", replik: "replik", duplik: "duplik", kesimpulan: "kesimpulan" };
const singgahUkur = new Map<string, { nomor: Array<[number, number]>; peta: TitikNomor[]; pdf: Uint8Array }>();

/** Halaman tiap lampiran: PDF berkas e-Court (jumlah semua berkas jenis itu); tidak terbaca = 1 per berkas + peringatan. */
function halamanLampiran(lampiran: LampiranBagian[], r: RencanaRunut): { halaman: number[]; peringatan: string[] } {
  const peringatan: string[] = [];
  const halaman = lampiran.map((l) => {
    const info = r.lampiran[l.jenis];
    if (info && info.halaman && info.halaman > 0) return info.halaman;
    const n = Math.max(1, info?.jumlah || 1);
    peringatan.push(
      `Halaman ${NAMA_LAMPIRAN[l.jenis]} tertulis belum terbaca dari berkas e-Court: nomor halaman sesudahnya melompat ${n} halaman (bawaan 1 per ${NAMA_LAMPIRAN[l.jenis]}). Periksa bila berbeda.`
    );
    return n;
  });
  return { halaman, peringatan };
}

/** Naskah memuat tanda Z blangko / Z otomatis (kotak "SC Z", bentuk bebas FreeForm, zcross-*)? */
function adaBentukZ(bita: Uint8Array, bentuk: "rtf" | "docx"): boolean {
  const teks = bentuk === "rtf" ? Buffer.from(bita).toString("latin1") : paragrafNaskahMentah(bita);
  return /SC\s*Z|zcross-|\{\\sv\s*FreeForm|(?:name|id)="FreeForm/.test(teks);
}
function paragrafNaskahMentah(bita: Uint8Array): string {
  try {
    return bukaDocx(bita).xml;
  } catch {
    return "";
  }
}

/**
 * Halaman tampil tiap jangkar lampiran diukur dari SATU render PDF; bagian sesudahnya bernomor halaman jangkar + halaman lampiran + 1
 * (halaman lampiran dari PDF berkas e-Court; tidak ada = 1 per lampiran + peringatan). Hasil disinggahkan per isi naskah.
 */
async function lompatLampiran(
  bita: Uint8Array,
  bentuk: "rtf" | "docx",
  lampiran: LampiranBagian[],
  r: RencanaRunut,
  mesin: Mesin
): Promise<{ bita: Uint8Array; peta: TitikNomor[]; pdf: Uint8Array | null; peringatan: string[] }> {
  const { halaman, peringatan } = halamanLampiran(lampiran, r);
  const kunci = `${sidik(bita)}|${r.awal}|${halaman.join(",")}`;
  const ada = singgahUkur.get(kunci);
  if (ada) return { bita: pasangNomorBagian(bita, bentuk, new Map(ada.nomor)), peta: ada.peta, pdf: ada.pdf, peringatan };
  const pdf = await mesin.ubah(bita, bentuk, "pdf");
  const baca = await bacaKataPdf(pdf);
  const teks = paragrafNaskah(bita, bentuk);
  const peta: TitikNomor[] = [];
  const nomor: Array<[number, number]> = [];
  lampiran.forEach((l, i) => {
    const ekor = ekorParagraf(l.teksJangkar);
    let ordinal = 0;
    for (let q = 0; q < l.paragrafIndeks; q += 1) {
      const e = ekorParagraf(teks[q] || "");
      if (e.length === ekor.length && e.every((k, z) => k === ekor[z])) ordinal += 1;
    }
    const fisik = halamanEkor(baca, ekor, ordinal);
    if (!fisik) {
      peringatan.push(`Letak ${NAMA_LAMPIRAN[l.jenis]} tertulis tidak ditemukan di hasil cetak: nomor halaman sesudahnya dilanjutkan tanpa lompatan.`);
      return;
    }
    const titik = [{ fisik: 1, nomor: r.awal }, ...peta].filter((t) => t.fisik <= fisik).pop()!;
    const tampil = titik.nomor + (fisik - titik.fisik);
    const n = tampil + halaman[i] + 1;
    peta.push({ fisik: fisik + 1, nomor: n });
    nomor.push([l.seksiKe, n]);
  });
  if (singgahUkur.size > 50) singgahUkur.clear();
  singgahUkur.set(kunci, { nomor, peta, pdf });
  return { bita: pasangNomorBagian(bita, bentuk, new Map(nomor)), peta, pdf, peringatan };
}

// ----------------------------------------------------------------------------
// Penerapan: sebelum Z (nomor awal) dan sesudah PDF (catat halaman)
// ----------------------------------------------------------------------------
export type HasilPasangRunut = {
  bita: Uint8Array;
  /** Bentuk naskah sesudahnya (DOC lama -> "docx"). */
  bentuk: BentukMasuk;
  rencana: RencanaRunut | null;
  peringatan: string[];
  /** Opsi Z cross pengganti hitungan bukti bila Z blangko menutup LAMPIRAN jawab-menjawab (keputusan 87): halaman lampiran per berkas. */
  opsiZ?: { jumlahBukti: number; halamanBukti: number[] };
  /** PDF yang sudah dirender untuk mengukur (tata letak = naskah sesudah nomor dipasang); dipakai ulang sebagai hitungan akhir bila Z tidak mengubah naskah. */
  pdfUkur?: Uint8Array | null;
};

/** Nomor halaman awal (dan lompatan sesudah lampiran) dipasang di naskah. Gagal = naskah apa adanya + peringatan. */
export async function pasangRunut(db: AletaDatabase, bita: Uint8Array, bentuk: BentukMasuk, konteks: KonteksBas, deps: DepsRunut = {}): Promise<HasilPasangRunut> {
  // Mati: ALETA_BAS_RUNUT=0 (naskah apa adanya, tanpa catatan).
  if (/^(0|mati|off|false)$/i.test(String(process.env.ALETA_BAS_RUNUT ?? "").trim())) return { bita, bentuk, rencana: null, peringatan: [] };
  let kerja = bita;
  let bentukKerja: BentukMasuk = bentuk;
  try {
    let mesin: Mesin | null = deps.mesin ?? null;
    if (bentuk === "doc") {
      // keputusan 87: DOC lama diubah otomatis ke DOCX (Word di laptop / soffice di server) supaya nomor awal dapat dipasang
      mesin = mesin ?? (await mesinBawaan());
      try {
        kerja = await mesin.ubah(bita, "doc", "docx");
        bentukKerja = "docx";
      } catch (e) {
        return { bita, bentuk, rencana: null, peringatan: [`Berkas DOC tidak dapat diubah ke DOCX, nomor halaman tidak diatur: ${e instanceof Error ? e.message.slice(0, 160) : "galat"}`] };
      }
    }
    const { rencana, alasan } = await rencanakanRunut(db, kerja, bentukKerja, konteks, deps);
    if (!rencana) return { bita: kerja, bentuk: bentukKerja, rencana: null, peringatan: alasan ? [alasan] : [] };
    const n = pasangNomorAwal(kerja, bentukKerja, rencana.awal);
    if (!n.dipasang) return { bita: kerja, bentuk: bentukKerja, rencana: null, peringatan: [...rencana.peringatan, n.alasan] };
    const peringatan = [...rencana.peringatan];
    let hasil = n.bita;
    let pdfUkur: Uint8Array | null = null;
    let opsiZ: HasilPasangRunut["opsiZ"];
    if (n.lampiran.length && bentukKerja !== "doc" && adaBentukZ(hasil, bentukKerja)) {
      // Lampiran yang ditutup tanda Z blangko: Z cross yang menggambar Z dan melompatkan nomor sebanyak halaman lampiran (tanpa render ukur
      // tambahan); daftar "bukti" di Z diganti halaman lampiran.
      const h = halamanLampiran(n.lampiran, rencana);
      opsiZ = { jumlahBukti: h.halaman.length, halamanBukti: h.halaman };
      peringatan.push(...h.peringatan);
    } else if (n.lampiran.length && bentukKerja !== "doc") {
      try {
        mesin = mesin ?? (await mesinBawaan());
        const l = await lompatLampiran(hasil, bentukKerja, n.lampiran, rencana, mesin);
        hasil = l.bita;
        rencana.peta = l.peta;
        pdfUkur = l.pdf;
        peringatan.push(...l.peringatan);
      } catch (e) {
        peringatan.push(`Halaman lampiran jawab-menjawab belum dapat diukur, nomor sesudahnya dilanjutkan tanpa lompatan: ${e instanceof Error ? e.message.slice(0, 160) : "galat"}`);
      }
    }
    return { bita: hasil, bentuk: bentukKerja, rencana, peringatan, pdfUkur, ...(opsiZ ? { opsiZ } : {}) };
  } catch (e) {
    return { bita: kerja, bentuk: bentukKerja, rencana: null, peringatan: [`Nomor halaman BAS tidak diatur otomatis: ${e instanceof Error ? e.message.slice(0, 200) : "galat"}`] };
  }
}

export async function jumlahHalamanPdf(pdf: Uint8Array): Promise<number> {
  const d = await PDFDocument.load(pdf, { ignoreEncryption: true, updateMetadata: false });
  return d.getPageCount();
}

export type HasilCatatRunut = { awal: number; akhir: number; fisik: number; peringatan: string[]; dariSinggah?: boolean };

/**
 * Halaman terakhir BAS dihitung (lompatan bukti Z & lampiran ikut) dan dicatat. Sumber jumlah halaman, berurutan dari yang termurah:
 * PDF akhir yang memang dibuat -> PDF ukur bila Z tidak mengubah naskah -> catatan BAS yang sama persis (sidik naskah) -> render baru.
 */
export async function catatRunut(
  db: AletaDatabase,
  r: RencanaRunut,
  p: {
    pdf?: Uint8Array | null;
    pdfUkur?: Uint8Array | null;
    naskah?: { bita: Uint8Array; bentuk: "rtf" | "docx" | "doc"; mesin: Mesin };
    z?: LaporanZcross | null;
    sumber: CatatBaru["sumber"];
    olehId: string;
    kini?: Date;
  }
): Promise<HasilCatatRunut | null> {
  try {
    const z = p.z && p.z.diubah ? p.z : null;
    const sid = p.naskah ? sidik(p.naskah.bita) : p.pdf ? sidik(p.pdf) : "";
    let fisik = 0;
    let dariSinggah = false;
    if (p.pdf) fisik = await jumlahHalamanPdf(p.pdf);
    else if (p.pdfUkur && !z) fisik = await jumlahHalamanPdf(p.pdfUkur);
    else {
      const lama = r.catatan.find((c) => (c.sidangId ? c.sidangId === r.sasaran.id : c.tanggal === r.sasaran.tanggal)) as (CatatanHalaman & { fisik?: number; sidik?: string }) | undefined;
      if (lama && sid && lama.sidik === sid && lama.awal === r.awal && lama.fisik) {
        fisik = lama.fisik;
        dariSinggah = true;
      } else if (p.naskah) fisik = await jumlahHalamanPdf(await p.naskah.mesin.ubah(p.naskah.bita, p.naskah.bentuk, "pdf"));
    }
    if (!fisik) return null;
    const akhir = halamanAkhirBas({
      awal: r.awal,
      fisik,
      peta: r.peta,
      z: z ? { diubah: true, seksi: z.seksi, halamanFisikZ: z.halamanFisikZ, nomorBagianBerikut: z.nomorBagianBerikut, halamanBuktiSampai: z.halamanBuktiSampai } : null,
    });
    // halaman yang dilompati (bukti + lampiran) = nomor terakhir - (awal + fisik - 1)
    const lompat = Math.max(0, akhir - (r.awal + fisik - 1));
    await simpanCatatanHalaman(db, { perkaraId: r.perkaraId, nomorPerkara: r.nomorPerkara, sidang: r.sasaran, awal: r.awal, akhir, fisik, lompatBukti: lompat, sumber: p.sumber, olehId: p.olehId, sidik: sid }, p.kini);
    const lain = r.catatan.filter((c) => !(c.sidangId ? c.sidangId === r.sasaran.id : c.tanggal === r.sasaran.tanggal));
    return { awal: r.awal, akhir, fisik, dariSinggah, peringatan: periksaSesudah({ sidang: r.sidang, sasaran: { sidangId: r.sasaran.id }, akhir, catatan: lain }) };
  } catch (e) {
    return { awal: r.awal, akhir: 0, fisik: 0, peringatan: [`Halaman BAS ini belum tercatat (BAS berikutnya mungkin tidak runut): ${e instanceof Error ? e.message.slice(0, 160) : "galat"}`] };
  }
}

/** Konteks dari masukan formulir / JSON (nilai tidak sah diabaikan). */
export function bacaKonteksBas(o: { perkaraId?: unknown; nomorPerkara?: unknown; sidangId?: unknown; tanggalSidang?: unknown; sidang?: unknown }): KonteksBas | null {
  const bersih = (v: unknown, re: RegExp, n = 60) => {
    const s = String(v ?? "").trim().slice(0, n);
    return re.test(s) ? s : "";
  };
  const perkaraId = bersih(o.perkaraId, /^\d{1,12}$/);
  const nomorPerkara = bersih(o.nomorPerkara, /^[\w./ -]{5,60}$/);
  const sidangId = bersih(o.sidangId, /^\d{1,14}$/);
  const tanggal = bersih(o.tanggalSidang, /^\d{4}-\d{2}-\d{2}$/, 10);
  let sidang: SidangBas[] | undefined;
  let mentah: unknown = o.sidang;
  if (typeof mentah === "string") {
    try {
      mentah = JSON.parse(mentah);
    } catch {
      mentah = null;
    }
  }
  if (Array.isArray(mentah)) {
    sidang = mentah
      .slice(0, 200)
      .map((x) => {
        const r = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
        return { id: bersih(r.sidangId ?? r.id, /^\d{1,14}$/), tanggal: bersih(r.tanggal, /^\d{4}-\d{2}-\d{2}$/, 10), urutan: Number(r.urutan) || 0, ikrar: r.ikrar === true };
      })
      .filter((s) => s.tanggal);
  }
  if (!perkaraId && !nomorPerkara) return null;
  return { perkaraId, nomorPerkara, sidangId, tanggal, ...(sidang?.length ? { sidang } : {}) };
}
