import { alineaDariRtf, bandingAlinea, kertasDariRtf, type HasilBandingAlinea, type KertasNaskah } from "@/lib/aleta-abt-naskah";
import type { PustakaMesin } from "@/lib/aleta-abt-pustaka";
import { AKSARA_KOTAK, uraiRtf, type Rata } from "@/lib/aleta-abt-rtf";
import { nilaiTahan, type ButirTahan, type KosongMesin, type NilaiIsian } from "@/lib/aleta-abt-tahan";
import type { AletaDatabase } from "@/server/db/client";
import { bitaIsi, muatPustakaMesin } from "@/server/modules/aleta-abt-pustaka/service";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { ApiError } from "@/server/shared/errors";

import { bahanTahan } from "./tahan";

/**
 * ============================================================================
 * NASKAH ALETA ABT UNTUK LAYAR CETAK (5 Nov 2026, Tahap 5)
 * ============================================================================
 *
 * Blangko diambil dari PUSTAKA ALETA (aleta_abt_berkas - isi yang TERBIT; versi draf tidak pernah dipakai), isiannya diisi mesin
 * jalur ALETA di bot (bridge blangko.isiPustaka). ABT PHP tidak dipanggil sama sekali. Ketikan dan tanya jawab wajib yang kosong menahan cetak final
 * (cetakFinal): naskah tidak keluar, hanya daftar yang harus diisi; rumus tanpa data dan isian yang tidak wajib hanya diberitahukan (aleta-abt-tahan.ts,
 * keputusan pemilik 6 Nov 2026). Hanya membaca SIPP/ABT; tidak menulis apa pun.
 * Pemanggil (rute) yang menjaga hak; berkas ini tidak menilai peran.
 */

const BATAS_MS = 90_000;
const BATAS_PARAGRAF = 3000;

type KeteranganIsian = { noVar: string; kode: string; nama: string; asalRumus: string; sumber: string; keyakinan: "pasti" | "periksa" | "kosong"; status: string; sebab: string };

type HasilBot = {
  ok?: boolean;
  sebab?: string;
  berkas?: string;
  jumlahTerisi?: number;
  kosong?: Array<{ noVar: string; nama?: string; sebab?: string; status?: string }>;
  mesinGalat?: string;
  rtfBase64?: string;
  nilaiIsian?: Record<string, NilaiIsian>;
  isian?: KeteranganIsian[];
  lolosCetak?: boolean;
  ditahan?: boolean;
  ringkasanKeyakinan?: Record<string, number>;
  jumlahKueri?: number;
  waktuMs?: number;
};

export type ParagrafPratinjau = { i: number; teks: string; rata: Rata; li: number; fi: number; tabel: boolean; awalan: string };

export type NaskahJadi = {
  ok: true;
  nama: string;
  rtf: Buffer;
  kertas: KertasNaskah;
  jumlahTerisi: number;
  /** Isian yang menahan cetak. */
  kosong: Array<{ nama: string; sebab: string; status: string }>;
  /** Tidak menahan, tetapi perlu dilihat: tercetak titik-titik bila tetap kosong. */
  perluDilihat: ButirTahan[];
  /** Tidak menahan: isian pilihan, tambahan, atau yang tidak berlaku. */
  catatan: ButirTahan[];
  lolosCetak: boolean;
  mesinGalat: string;
  ringkasanKeyakinan: Record<string, number>;
  jumlahKueri: number;
  waktu: { botMs: number; totalMs: number };
};

export type NaskahDitolak = { ok: false; status: number; alasan: string; ditahan?: boolean; kosong?: Array<{ nama: string; sebab: string; status: string }> };

export type PermintaanNaskah = { berkasId: string; perkaraId: string; sidangKe: number; cetakFinal: boolean };

type BerkasPustaka = { id: string; folder: string; nama: string; isi: string; pengkodean: string; arsip: number; status: string };

export async function ambilBlangkoPustaka(db: AletaDatabase, id: string): Promise<{ nama: string; folder: string; rtf: Buffer }> {
  const b = await db.queryOne<BerkasPustaka>("SELECT id, folder, nama, isi, pengkodean, arsip, status FROM aleta_abt_berkas WHERE id = ?", [id]);
  if (!b) throw new ApiError(404, "Blangko tidak ditemukan di pustaka.");
  if (!/\.rtf$/i.test(String(b.nama))) throw new ApiError(422, "Blangko ini bukan RTF, jadi belum dapat disusun di layar ini.");
  if (b.status === "hilang") throw new ApiError(422, "Blangko ini sudah tidak ada di ABT.");
  return { nama: String(b.nama), folder: String(b.folder), rtf: bitaIsi(String(b.isi), String(b.pengkodean)) };
}

export async function susunNaskah(
  db: AletaDatabase,
  p: PermintaanNaskah,
  deps: { pustaka?: PustakaMesin; panggil?: typeof callAletaBotSippBridge } = {}
): Promise<NaskahJadi | NaskahDitolak> {
  const mulai = Date.now();
  const blangko = await ambilBlangkoPustaka(db, p.berkasId);
  const pustaka = deps.pustaka ?? (await muatPustakaMesin(db));
  const panggil = deps.panggil ?? callAletaBotSippBridge;
  const bahan = await bahanTahan(panggil, { rtfLatin1: blangko.rtf.toString("latin1"), folder: blangko.folder, pustaka });
  const hasil = await panggil<HasilBot>(
    "blangko.isiPustaka",
    {
      nama: blangko.nama,
      rtfBase64: blangko.rtf.toString("base64"),
      perkaraId: p.perkaraId,
      sidangKe: p.sidangKe,
      jalurAleta: { sidik: pustaka.sidik, pustaka: pustaka.pustaka, alias: pustaka.alias },
      ...(bahan ? { nilaiIsian: bahan.kodeNilai } : {}),
      // Naskah akhir tanpa sorotan kuning; penahannya diputuskan di sini, bukan di bot.
      ...(p.cetakFinal ? { tanpaSorotKosong: true } : {}),
    },
    { timeoutMs: BATAS_MS }
  );
  const data = hasil.data;
  if (!hasil.ok || !data?.ok) return { ok: false, status: 502, alasan: String(data?.sebab ?? hasil.error ?? "Naskah tidak dapat disusun.") };
  const kosongMesin: KosongMesin[] = (data.kosong ?? []).map((k) => ({ noVar: String(k.noVar ?? ""), nama: String(k.nama ?? ""), sebab: String(k.sebab ?? ""), status: String(k.status ?? "") }));
  // Katalog atau nilai tidak terbaca: tidak ada dasar untuk melonggarkan, jadi semua isian kosong tetap menahan.
  const tahan =
    bahan && data.nilaiIsian
      ? nilaiTahan({ susunan: bahan.susunan, nilai: data.nilaiIsian, kosong: kosongMesin, jenisCerai: bahan.jenisCerai, jenisKatalog: (kode) => bahan.katalog.get(kode)?.jenis ?? "" })
      : { menahan: kosongMesin.map((k) => ({ kode: k.noVar, nama: k.nama || `Isian ${k.noVar}`, sebab: k.sebab })), perluDilihat: [] as ButirTahan[], catatan: [] as ButirTahan[] };
  const statusKode = new Map(kosongMesin.map((k) => [k.noVar, k.status]));
  const kosong = tahan.menahan.map((k) => ({ nama: k.nama, sebab: k.sebab, status: statusKode.get(k.kode) ?? "kosong" }));
  const lolosCetak = kosong.length === 0 && !data.mesinGalat;
  if (p.cetakFinal && (!lolosCetak || !data.rtfBase64)) {
    return { ok: false, status: 409, ditahan: true, kosong, alasan: `Cetak final ditahan: ${kosong.length} isian masih kosong${data.mesinGalat ? " dan mesin ragu" : ""}.` };
  }
  const rtf = Buffer.from(String(data.rtfBase64 ?? ""), "base64");
  return {
    ok: true,
    nama: blangko.nama,
    rtf,
    kertas: kertasDariRtf(rtf.toString("latin1")),
    jumlahTerisi: data.jumlahTerisi ?? 0,
    kosong,
    perluDilihat: tahan.perluDilihat,
    catatan: tahan.catatan,
    lolosCetak,
    mesinGalat: String(data.mesinGalat ?? ""),
    ringkasanKeyakinan: data.ringkasanKeyakinan ?? {},
    jumlahKueri: data.jumlahKueri ?? 0,
    waktu: { botMs: data.waktuMs ?? 0, totalMs: Date.now() - mulai },
  };
}

/** Paragraf untuk pratinjau layar: teks polos dengan rata dan lekuk dari RTF. Kotak/gambar tidak ditampilkan. */
export function paragrafPratinjau(rtf: Buffer): { paragraf: ParagrafPratinjau[]; terpotong: boolean; jumlah: number } {
  const doc = uraiRtf(rtf.toString("latin1"));
  const semua = doc.paragraf.map((p) => ({
    i: p.indeks,
    teks: p.teks.split(AKSARA_KOTAK).join("").replace(/\s+/g, " ").trim(),
    rata: p.rata,
    li: p.li,
    fi: p.fi,
    tabel: p.tabel,
    awalan: p.awalan,
  }));
  return { paragraf: semua.slice(0, BATAS_PARAGRAF), terpotong: semua.length > BATAS_PARAGRAF, jumlah: semua.length };
}

export type HasilBandingRtf = {
  alinea: HasilBandingAlinea;
  kertas: { abt: KertasNaskah; aleta: KertasNaskah };
};

/** Banding naskah ALETA (sudah disusun) dengan RTF dari ABT yang diunggah petugas. */
export function bandingkanRtf(rtfAleta: Buffer, rtfAbt: Buffer): HasilBandingRtf {
  const a = rtfAbt.toString("latin1");
  const b = rtfAleta.toString("latin1");
  return { alinea: bandingAlinea(alineaDariRtf(a), alineaDariRtf(b)), kertas: { abt: kertasDariRtf(a), aleta: kertasDariRtf(b) } };
}
