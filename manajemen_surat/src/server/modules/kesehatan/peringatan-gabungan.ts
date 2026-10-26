/**
 * ============================================================================
 * PERINGATAN WHATSAPP GABUNGAN: PUSAT KESEHATAN (E2) + PENJAGA INTEGRITAS (E6)
 * ============================================================================
 *
 * Keputusan Derry 26 Okt 2026: bila Pusat kesehatan dan penjaga integritas sama-sama punya temuan di
 * jendela waktu yang sama, admin menerima SATU pesan, bukan dua. Semua saklar WhatsApp tetap MATI bawaan
 * (WhatsApp belum tersambung): modul ini hanya dipanggil oleh pengirim yang saklarnya sudah menyala.
 *
 * Cara kerja (tanpa migrasi): tiap pengirim "mengajukan" satu bagian pesan.
 *   - Jendela 0 menit (ALETA_PERINGATAN_GABUNG_MENIT=0): dikirim langsung, persis seperti sebelum penggabungan.
 *   - Jendela > 0 (bawaan 5 menit): bagian ditahan di aleta_ekstensi_setelan (*sistem*) sampai pengirim
 *     lain mengajukan bagiannya (keduanya dikirim sekaligus dalam satu pesan) atau jendelanya habis (dikirim
 *     sendirian). Detak kedua pengirim memanggil `lepasPeringatanTertunda` supaya bagian tunggal tetap keluar.
 *   - Penerima tiap bagian dihormati: bagian untuk "super-admin" tidak sampai ke Admin biasa.
 *   - Gagal kirim pada bagian yang ditahan: dicoba lagi pada detak berikutnya, paling banyak 3 kali.
 */
import type { AletaDatabase } from "@/server/db/client";
import { bacaSetelanJson, hapusSetelanSistem, simpanSetelanSistem } from "@/server/modules/kesehatan/setelan";

export const KUNCI_PERINGATAN_TERTUNDA = "sistem:peringatan-wa-tertunda";
export const JENDELA_GABUNG_BAWAAN_MENIT = 5;
const PERCOBAAN_MAKS = 3;

export type SumberPeringatan = "kesehatan" | "integritas";
export type TingkatPenerima = "admin" | "super-admin";
export type Penerima = Array<{ id: string; nama: string; nomor: string }>;
export type KirimPeringatanGabungan = (penerima: Penerima, pesan: string, kunci: string) => Promise<{ terkirim: number; gagal: number }>;
export type PenerimaPeringatan = (db: AletaDatabase, tingkat: TingkatPenerima) => Promise<Penerima>;

export type BagianPeringatan = {
  sumber: SumberPeringatan;
  teks: string;
  penerima: TingkatPenerima;
  /** Kunci pesan bila bagian ini terkirim sendirian. */
  kunci: string;
  pada: string;
  percobaan: number;
};

type Tertunda = { bagian: BagianPeringatan[] };

export type HasilPeringatan = { status: "terkirim" | "ditunda" | "gagal" | "kosong"; terkirim: number; gagal: number; sumber: SumberPeringatan[] };

type Opsi = {
  kini?: Date;
  jendelaMenit?: number;
  kirim?: KirimPeringatanGabungan;
  penerima?: PenerimaPeringatan;
};

export function jendelaGabungMenit(env: Record<string, string | undefined> = process.env): number {
  const mentah = String(env.ALETA_PERINGATAN_GABUNG_MENIT ?? "").trim();
  if (mentah === "") return JENDELA_GABUNG_BAWAAN_MENIT;
  const n = Number(mentah);
  return Number.isFinite(n) && n >= 0 && n <= 60 ? n : JENDELA_GABUNG_BAWAAN_MENIT;
}

// Satu antrean dalam proses: detak kesehatan dan integritas berjalan di proses yang sama.
let rantai: Promise<unknown> = Promise.resolve();
function berurutan<T>(kerja: () => Promise<T>): Promise<T> {
  const hasil = rantai.then(kerja, kerja);
  rantai = hasil.catch(() => undefined);
  return hasil;
}

async function bacaTertunda(db: AletaDatabase): Promise<BagianPeringatan[]> {
  const isi = await bacaSetelanJson<Tertunda>(db, KUNCI_PERINGATAN_TERTUNDA);
  return Array.isArray(isi?.bagian) ? (isi.bagian as BagianPeringatan[]).filter((b) => b && (b.sumber === "kesehatan" || b.sumber === "integritas") && typeof b.teks === "string") : [];
}

async function simpanTertunda(db: AletaDatabase, bagian: BagianPeringatan[], kini: Date) {
  if (bagian.length === 0) await hapusSetelanSistem(db, KUNCI_PERINGATAN_TERTUNDA);
  else await simpanSetelanSistem(db, KUNCI_PERINGATAN_TERTUNDA, JSON.stringify({ bagian }), kini.toISOString());
}

async function penerimaBawaan(db: AletaDatabase, tingkat: TingkatPenerima): Promise<Penerima> {
  const { daftarPenerimaAdmin } = await import("@/server/modules/kesehatan/layanan");
  return daftarPenerimaAdmin(db, tingkat);
}

async function kirimBawaan(penerima: Penerima, pesan: string, kunci: string) {
  const { kirimPeringatanWhatsapp } = await import("@/server/modules/kesehatan/layanan");
  return kirimPeringatanWhatsapp(penerima, pesan, kunci);
}

/** Susun pesan: satu bagian = teksnya apa adanya; beberapa bagian = satu pesan dengan judul bersama. */
export function susunPesanGabungan(bagian: readonly BagianPeringatan[], kini: Date): string {
  if (bagian.length === 1) return bagian[0].teks;
  return `Peringatan sistem ALETA (${kini.toISOString().slice(11, 16)} UTC)\n\n${bagian.map((b) => b.teks).join("\n\n")}`;
}

/** Kirim semua bagian sekarang. Tiap penerima hanya menerima bagian yang memang untuknya; yang menerima bagian sama digabung. */
async function kirimSemua(db: AletaDatabase, bagian: BagianPeringatan[], opsi: Opsi, kini: Date): Promise<{ terkirim: number; gagal: number; tanpaPenerima: boolean }> {
  const ambil = opsi.penerima ?? penerimaBawaan;
  const kirim = opsi.kirim ?? kirimBawaan;
  const tingkat = Array.from(new Set(bagian.map((b) => b.penerima)));
  const daftar = new Map<TingkatPenerima, Penerima>();
  for (const t of tingkat) daftar.set(t, await ambil(db, t));
  const orang = new Map<string, { p: Penerima[number]; bagian: BagianPeringatan[] }>();
  for (const b of bagian) {
    for (const p of daftar.get(b.penerima) ?? []) {
      const ada = orang.get(p.id) ?? { p, bagian: [] };
      ada.bagian.push(b);
      orang.set(p.id, ada);
    }
  }
  if (orang.size === 0) return { terkirim: 0, gagal: 0, tanpaPenerima: true };
  const kelompok = new Map<string, { bagian: BagianPeringatan[]; penerima: Penerima }>();
  for (const { p, bagian: milik } of orang.values()) {
    const kunci = milik.map((b) => b.sumber).sort().join("+");
    const k = kelompok.get(kunci) ?? { bagian: milik, penerima: [] };
    k.penerima.push(p);
    kelompok.set(kunci, k);
  }
  let terkirim = 0;
  let gagal = 0;
  for (const k of kelompok.values()) {
    const pesan = susunPesanGabungan(k.bagian, kini);
    const kunciPesan = k.bagian.length === 1 ? k.bagian[0].kunci : `gabungan-${kini.toISOString().slice(0, 16)}`;
    const h = await kirim(k.penerima, pesan, kunciPesan);
    terkirim += Number(h?.terkirim) || 0;
    gagal += Number(h?.gagal) || 0;
  }
  return { terkirim, gagal, tanpaPenerima: false };
}

function tertuaMenit(bagian: readonly BagianPeringatan[], kini: Date): number {
  const pertama = Math.min(...bagian.map((b) => Date.parse(b.pada) || kini.getTime()));
  return (kini.getTime() - pertama) / 60_000;
}

/**
 * Pengirim mengajukan satu bagian. Dikirim sekarang bila jendela 0, bila pengirim lain sudah menahan
 * bagiannya (digabung), atau bila bagian tertua sudah melewati jendela. Selain itu ditahan ("ditunda").
 */
export function ajukanPeringatan(
  db: AletaDatabase,
  bagian: { sumber: SumberPeringatan; teks: string; penerima: TingkatPenerima; kunci: string },
  opsi: Opsi = {}
): Promise<HasilPeringatan> {
  return berurutan(async () => {
    const kini = opsi.kini ?? new Date();
    const jendela = opsi.jendelaMenit ?? jendelaGabungMenit();
    const tertunda = await bacaTertunda(db);
    const lama = tertunda.find((b) => b.sumber === bagian.sumber);
    const baru: BagianPeringatan = { ...bagian, pada: lama?.pada ?? kini.toISOString(), percobaan: lama?.percobaan ?? 0, teks: lama ? `${lama.teks}\n${bagian.teks}` : bagian.teks };
    const semua = [...tertunda.filter((b) => b.sumber !== bagian.sumber), baru];
    const adaPasangan = semua.length > 1;
    if (jendela > 0 && !adaPasangan && tertuaMenit(semua, kini) < jendela) {
      await simpanTertunda(db, semua, kini);
      return { status: "ditunda" as const, terkirim: 0, gagal: 0, sumber: [bagian.sumber] };
    }
    return kirimDanBereskan(db, semua, bagian.sumber, opsi, kini);
  });
}

async function kirimDanBereskan(db: AletaDatabase, semua: BagianPeringatan[], pemanggil: SumberPeringatan | null, opsi: Opsi, kini: Date): Promise<HasilPeringatan> {
  const sumber = semua.map((b) => b.sumber);
  const h = await kirimSemua(db, semua, opsi, kini);
  const berhasil = h.terkirim > 0 || h.tanpaPenerima;
  if (berhasil) {
    await simpanTertunda(db, [], kini);
    return { status: "terkirim", terkirim: h.terkirim, gagal: h.gagal, sumber };
  }
  // Gagal ke semua orang. Bagian pemanggil dikembalikan ke pemanggilnya (ia yang mengulang, seperti dulu);
  // bagian pengirim lain tetap ditahan untuk dicoba lagi pada detak berikutnya (paling banyak 3 kali).
  const sisa = semua
    .filter((b) => b.sumber !== pemanggil)
    .map((b) => ({ ...b, percobaan: b.percobaan + 1 }))
    .filter((b) => b.percobaan < PERCOBAAN_MAKS);
  await simpanTertunda(db, sisa, kini);
  return { status: "gagal", terkirim: 0, gagal: h.gagal, sumber };
}

/**
 * Dipanggil tiap detak kedua pengirim: melepas bagian yang sudah melewati jendela (atau semuanya bila jendela 0).
 * Mengembalikan null bila tidak ada yang perlu dikirim.
 */
export function lepasPeringatanTertunda(db: AletaDatabase, opsi: Opsi = {}): Promise<HasilPeringatan | null> {
  return berurutan(async () => {
    const kini = opsi.kini ?? new Date();
    const jendela = opsi.jendelaMenit ?? jendelaGabungMenit();
    const tertunda = await bacaTertunda(db);
    if (tertunda.length === 0) return null;
    if (tertunda.length < 2 && tertuaMenit(tertunda, kini) < jendela) return null;
    const hasil = await kirimDanBereskan(db, tertunda, null, opsi, kini);
    return hasil;
  });
}
