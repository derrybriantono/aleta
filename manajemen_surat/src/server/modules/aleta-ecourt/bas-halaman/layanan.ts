import { PDFDocument } from "pdf-lib";

import { type AletaDatabase } from "@/server/db/client";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";

import type { LaporanZcross } from "../zcross";
import type { BentukMasuk, Mesin } from "../zcross/mesin";
import { paragrafNaskah, pasangNomorAwal } from "./naskah";
import {
  halamanAkhirBas,
  hitungHalamanAwal,
  konteksDariNaskah,
  periksaSesudah,
  pilihSidangDariTanggal,
  urutkanSidangBas,
  type CatatanHalaman,
  type SidangBas,
} from "./runut";

/**
 * NOMOR HALAMAN BAS RUNUT - penyambung ke basis data portal (aleta_bas_halaman, migrasi 0123) dan ke SIPP (jembatan baca bot
 * "berkas.jadwalBas": urutan sidang + halaman PDF e-Doc BAS). Dipakai OTOMATIS, tanpa tombol, oleh:
 *   - api/aleta-ecourt/bas/z-cross   (unduh / cetak RTF, DOCX, DOC dari panel),
 *   - api/aleta-bot/abt/pdf          (cetak PDF dari panel),
 *   - api/aleta-ecourt/bas/word-ke-pdf (unggah BAS Word ke e-Doc SIPP; perkara & sidang dikenali dari naskah).
 *
 * Alur tiap BAS: kenali perkara & sidang -> halaman awal (runut.ts) -> pasang nomor awal (naskah.ts) -> Z cross seperti biasa -> hitung
 * halaman PDF akhir -> catat halaman awal & akhir. Galat apa pun TIDAK menahan cetak/unduh/unggah: naskah dipakai apa adanya + peringatan.
 * Tidak ada tulisan ke SIPP/ABT; yang ditulis hanya tabel portal.
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

export type RencanaRunut = {
  perkaraId: string;
  nomorPerkara: string;
  sidang: SidangBas[];
  sasaran: SidangBas;
  awal: number;
  ke: number;
  peringatan: string[];
  catatan: CatatanHalaman[];
};

export type DepsRunut = {
  /** Jadwal sidang + halaman e-Doc dari SIPP (bawaan: jembatan bot). */
  jadwal?: (p: { perkaraId?: string; nomorPerkara?: string }) => Promise<{ perkaraId: string; nomorPerkara: string; sidang: SidangBas[] } | null>;
  kini?: () => Date;
};

const BATAS_JADWAL_MS = 8000;

async function jadwalLewatBot(p: { perkaraId?: string; nomorPerkara?: string }) {
  const r = await callAletaBotSippBridge<{ ok?: boolean; perkaraId?: string; nomorPerkara?: string; sidang?: SidangBas[] }>(
    "berkas.jadwalBas",
    { perkaraId: p.perkaraId || "", nomorPerkara: p.nomorPerkara || "" },
    { timeoutMs: BATAS_JADWAL_MS }
  );
  if (!r.ok || !r.data || r.data.ok === false || !Array.isArray(r.data.sidang)) return null;
  return { perkaraId: String(r.data.perkaraId || p.perkaraId || ""), nomorPerkara: String(r.data.nomorPerkara || p.nomorPerkara || ""), sidang: r.data.sidang };
}

// ----------------------------------------------------------------------------
// Tabel aleta_bas_halaman
// ----------------------------------------------------------------------------
type BarisDb = { sidang_id: string; tanggal_sidang: string; halaman_awal: number; halaman_akhir: number };

export async function bacaCatatanHalaman(db: AletaDatabase, perkaraId: string): Promise<CatatanHalaman[]> {
  const baris = await db
    .queryAll<BarisDb>("SELECT sidang_id, tanggal_sidang, halaman_awal, halaman_akhir FROM aleta_bas_halaman WHERE perkara_id = ?", [perkaraId])
    .catch(() => [] as BarisDb[]);
  return baris.map((b) => ({ sidangId: String(b.sidang_id || ""), tanggal: String(b.tanggal_sidang || ""), awal: Number(b.halaman_awal) || 1, akhir: Number(b.halaman_akhir) || 1 }));
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
};

export async function simpanCatatanHalaman(db: AletaDatabase, c: CatatBaru, kini = new Date()): Promise<void> {
  const kunci = c.sidang.id ? c.sidang.id : `t:${c.sidang.tanggal}`;
  const nilai = [c.nomorPerkara, c.sidang.id || "", c.sidang.tanggal || "", c.awal, c.akhir, c.fisik, c.lompatBukti, c.sumber, c.olehId, kini.toISOString(), c.perkaraId, kunci];
  const ubah = await db.run(
    "UPDATE aleta_bas_halaman SET nomor_perkara = ?, sidang_id = ?, tanggal_sidang = ?, halaman_awal = ?, halaman_akhir = ?, halaman_fisik = ?, lompat_bukti = ?, sumber = ?, dicatat_oleh = ?, dicatat_pada = ? WHERE perkara_id = ? AND sidang_kunci = ?",
    nilai
  );
  if (!ubah || !ubah.changes) {
    await db.run(
      "INSERT INTO aleta_bas_halaman (nomor_perkara, sidang_id, tanggal_sidang, halaman_awal, halaman_akhir, halaman_fisik, lompat_bukti, sumber, dicatat_oleh, dicatat_pada, perkara_id, sidang_kunci) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
  let j: Awaited<ReturnType<typeof jadwalLewatBot>> = null;
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
    rencana: { perkaraId, nomorPerkara, sidang: urut, sasaran, awal: h.awal, ke: h.ke, peringatan: [...peringatanAwal, ...h.peringatan], catatan },
    alasan: "",
  };
}

// ----------------------------------------------------------------------------
// Penerapan: sebelum Z (nomor awal) dan sesudah PDF (catat halaman)
// ----------------------------------------------------------------------------
export type HasilPasangRunut = { bita: Uint8Array; rencana: RencanaRunut | null; peringatan: string[] };

/** Nomor halaman awal dipasang di naskah. Gagal = naskah apa adanya + peringatan. */
export async function pasangRunut(db: AletaDatabase, bita: Uint8Array, bentuk: BentukMasuk, konteks: KonteksBas, deps: DepsRunut = {}): Promise<HasilPasangRunut> {
  // Mati: ALETA_BAS_RUNUT=0 (naskah apa adanya, tanpa catatan).
  if (/^(0|mati|off|false)$/i.test(String(process.env.ALETA_BAS_RUNUT ?? "").trim())) return { bita, rencana: null, peringatan: [] };
  try {
    const { rencana, alasan } = await rencanakanRunut(db, bita, bentuk, konteks, deps);
    if (!rencana) return { bita, rencana: null, peringatan: alasan ? [alasan] : [] };
    const n = pasangNomorAwal(bita, bentuk, rencana.awal);
    if (!n.dipasang) return { bita, rencana: null, peringatan: [...rencana.peringatan, n.alasan] };
    return { bita: n.bita, rencana, peringatan: rencana.peringatan };
  } catch (e) {
    return { bita, rencana: null, peringatan: [`Nomor halaman BAS tidak diatur otomatis: ${e instanceof Error ? e.message.slice(0, 200) : "galat"}`] };
  }
}

export async function jumlahHalamanPdf(pdf: Uint8Array): Promise<number> {
  const d = await PDFDocument.load(pdf, { ignoreEncryption: true, updateMetadata: false });
  return d.getPageCount();
}

export type HasilCatatRunut = { awal: number; akhir: number; fisik: number; peringatan: string[] };

/**
 * Sesudah PDF akhir ada (atau dibuat dari naskah akhir lewat `mesin`): halaman terakhir BAS dihitung (lompatan bukti Z ikut) dan dicatat.
 */
export async function catatRunut(
  db: AletaDatabase,
  r: RencanaRunut,
  p: { pdf?: Uint8Array | null; naskah?: { bita: Uint8Array; bentuk: "rtf" | "docx" | "doc"; mesin: Mesin }; z?: LaporanZcross | null; sumber: CatatBaru["sumber"]; olehId: string; kini?: Date }
): Promise<HasilCatatRunut | null> {
  try {
    let pdf = p.pdf ?? null;
    if (!pdf && p.naskah) pdf = await p.naskah.mesin.ubah(p.naskah.bita, p.naskah.bentuk, "pdf");
    if (!pdf) return null;
    const fisik = await jumlahHalamanPdf(pdf);
    const z = p.z && p.z.diubah ? p.z : null;
    const akhir = halamanAkhirBas({ awal: r.awal, fisik, z: z ? { diubah: true, seksi: z.seksi, halamanFisikZ: z.halamanFisikZ, nomorBagianBerikut: z.nomorBagianBerikut, halamanBuktiSampai: z.halamanBuktiSampai } : null });
    const lompat = z && z.jumlahHalamanBukti ? z.jumlahHalamanBukti : 0;
    await simpanCatatanHalaman(db, { perkaraId: r.perkaraId, nomorPerkara: r.nomorPerkara, sidang: r.sasaran, awal: r.awal, akhir, fisik, lompatBukti: lompat, sumber: p.sumber, olehId: p.olehId }, p.kini);
    const lain = r.catatan.filter((c) => !(c.sidangId ? c.sidangId === r.sasaran.id : c.tanggal === r.sasaran.tanggal));
    return { awal: r.awal, akhir, fisik, peringatan: periksaSesudah({ sidang: r.sidang, sasaran: { sidangId: r.sasaran.id }, akhir, catatan: lain }) };
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
