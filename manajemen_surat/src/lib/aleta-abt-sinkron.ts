import { bedaLarik } from "@/lib/aleta-abt-beda";

/**
 * ============================================================================
 * TETAP SINKRON DENGAN ABT - ATURAN MURNI (5 Nov 2026, Tahap 9)
 * ============================================================================
 *
 * Tanpa basis data dan tanpa kripto, supaya dapat diuji dan dipakai layar:
 *   - setelan sinkron terjadwal (bawaan MATI) dan kapan sebuah detak boleh menjalankannya;
 *   - tambalan: beda dua isi berkas sebagai potongan (offset, teks lama, teks baru) untuk paket ABT, berikut
 *     penerapannya kembali (dipakai uji untuk membuktikan paket menghasilkan isi yang benar);
 *   - bentuk data layar "Beda dengan ABT".
 *
 * Tidak ada yang menulis ke ABT/SIPP di sini.
 */

// ---------------------------------------------------------------------------------------------------------------
// Jadwal
// ---------------------------------------------------------------------------------------------------------------

export const KUNCI_SETELAN_SINKRON_ABT = "sistem:aleta-abt-sinkron";
export const KUNCI_CATATAN_SINKRON_ABT = "sistem:aleta-abt-sinkron:catatan";

/** Jam kerja sidang (WITA). Di dalamnya sinkron terjadwal tidak berjalan kecuali Super Admin mengizinkan. */
export const JAM_KERJA_MULAI = "07:00";
export const JAM_KERJA_SELESAI = "17:00";

export type SetelanSinkronAbt = {
  /** Bawaan MATI: tidak ada pembacaan ABT sama sekali. */
  jadwal: boolean;
  /** HH:MM WITA; sinkron berjalan SEKALI per tanggal sesudah jam ini. */
  jam: string;
  /** Izinkan berjalan pada jam kerja sidang (07.00-17.00 WITA). Bawaan tidak. */
  izinJamKerja: boolean;
  diubahOleh: string;
  diubahPada: string;
};

export const SETELAN_SINKRON_ABT_BAWAAN: SetelanSinkronAbt = { jadwal: false, jam: "23:00", izinJamKerja: false, diubahOleh: "", diubahPada: "" };

const teks = (x: unknown) => String(x ?? "").trim();

export function jamSinkronSah(jam: unknown): string {
  const m = teks(jam).match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m) return SETELAN_SINKRON_ABT_BAWAAN.jam;
  const j = Number(m[1]);
  const mm = Number(m[2]);
  if (j > 23 || mm > 59) return SETELAN_SINKRON_ABT_BAWAAN.jam;
  return `${String(j).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** "HH:MM" atau "HH:MM:SS" berada di jam kerja sidang. */
export function dalamJamKerja(jam: string): boolean {
  const j = jam.slice(0, 5);
  return j >= JAM_KERJA_MULAI && j < JAM_KERJA_SELESAI;
}

export function bersihkanSetelanSinkron(masukan: unknown): SetelanSinkronAbt {
  const m = (masukan && typeof masukan === "object" ? masukan : {}) as Record<string, unknown>;
  return {
    jadwal: m.jadwal === true,
    jam: jamSinkronSah(m.jam),
    izinJamKerja: m.izinJamKerja === true,
    diubahOleh: teks(m.diubahOleh).slice(0, 120),
    diubahPada: teks(m.diubahPada).slice(0, 40),
  };
}

/** Sebab setelan ditolak (kosong bila sah): jam pemicu di jam kerja sidang tanpa izin. */
export function sebabSetelanDitolak(s: SetelanSinkronAbt): string {
  if (s.jadwal && !s.izinJamKerja && dalamJamKerja(s.jam)) {
    return `Jam ${s.jam} jatuh di jam kerja sidang (${JAM_KERJA_MULAI}-${JAM_KERJA_SELESAI} WITA). Pilih jam malam, atau centang izin berjalan pada jam kerja.`;
  }
  return "";
}

export type CatatanSinkronAbt = { tanggal: string; pada: string };

/**
 * Keputusan satu detak. `jam` = "HH:MM:SS" WITA saat ini. Sekali per tanggal: tanggal yang sudah dicatat tidak diulang
 * (juga bila putarannya gagal), supaya ABT tidak dibaca berulang-ulang.
 */
export function keputusanDetak(s: SetelanSinkronAbt, tanggal: string, jam: string, catatan: CatatanSinkronAbt | null): "jalan" | "mati" | "belum" | "jam-kerja" | "sudah" {
  if (!s.jadwal) return "mati";
  if (jam.slice(0, 5) < s.jam) return "belum";
  if (!s.izinJamKerja && dalamJamKerja(jam)) return "jam-kerja";
  if (catatan && catatan.tanggal === tanggal) return "sudah";
  return "jalan";
}

// ---------------------------------------------------------------------------------------------------------------
// Tambalan
// ---------------------------------------------------------------------------------------------------------------

export type Tambalan = { offset: number; lama: Buffer; baru: Buffer };

/** Konteks tiap sisi potongan: ikut diperiksa saat paket dipasang, jadi potongan yang meleset tertolak. */
const KONTEKS = 8;
/** Potongan yang berjarak sekian bita digabung (lebih sedikit potongan, isi tetap benar). */
const JARAK_GABUNG = 24;
const BATAS_D = 1200;

/** Terapkan potongan (offset atas berkas LAMA) dari belakang; null bila ada potongan yang tidak tepat. */
export function terapkanTambalan(isi: Buffer, potongan: Tambalan[]): Buffer | null {
  let hasil = isi;
  for (const p of [...potongan].sort((a, b) => b.offset - a.offset)) {
    if (p.offset < 0 || p.offset + p.lama.length > hasil.length) return null;
    if (!hasil.subarray(p.offset, p.offset + p.lama.length).equals(p.lama)) return null;
    hasil = Buffer.concat([hasil.subarray(0, p.offset), p.baru, hasil.subarray(p.offset + p.lama.length)]);
  }
  return hasil;
}

type Rentang = { aAwal: number; aAkhir: number; bAwal: number; bAkhir: number };

function rentangBeda(a: Buffer, b: Buffer): Rentang[] {
  const ops = bedaLarik(a, b, BATAS_D);
  const hasil: Rentang[] = [];
  let kini: Rentang | null = null;
  for (const op of ops) {
    if (op.t === "=") {
      if (kini) hasil.push(kini);
      kini = null;
      continue;
    }
    if (!kini) kini = { aAwal: op.a, aAkhir: op.a, bAwal: op.b, bAkhir: op.b };
    kini.aAkhir = Math.max(kini.aAkhir, op.a + (op.t === "-" ? op.n : 0));
    kini.bAkhir = Math.max(kini.bAkhir, op.b + (op.t === "+" ? op.n : 0));
  }
  if (kini) hasil.push(kini);
  return hasil;
}

/**
 * Beda `lama` -> `baru` sebagai potongan. Hasil SELALU diperiksa dengan menerapkannya kembali; bila tidak persis `baru`,
 * dipakai satu potongan utuh (lebih kasar tetapi benar). Sama persis -> daftar kosong.
 */
export function hitungTambalan(lama: Buffer, baru: Buffer): Tambalan[] {
  if (lama.equals(baru)) return [];
  const bentuk = (r: Rentang): Rentang => {
    const kiri = Math.min(KONTEKS, r.aAwal, r.bAwal);
    const kanan = Math.min(KONTEKS, lama.length - r.aAkhir, baru.length - r.bAkhir);
    return { aAwal: r.aAwal - kiri, aAkhir: r.aAkhir + kanan, bAwal: r.bAwal - kiri, bAkhir: r.bAkhir + kanan };
  };
  let rentang: Rentang[] = [];
  try {
    rentang = rentangBeda(lama, baru).map(bentuk);
  } catch {
    rentang = [];
  }
  const gabung: Rentang[] = [];
  for (const r of rentang) {
    const akhir = gabung[gabung.length - 1];
    if (akhir && r.aAwal - akhir.aAkhir <= JARAK_GABUNG) {
      akhir.aAkhir = r.aAkhir;
      akhir.bAkhir = r.bAkhir;
    } else gabung.push({ ...r });
  }
  const jadi = (r: Rentang): Tambalan => ({ offset: r.aAwal, lama: lama.subarray(r.aAwal, r.aAkhir), baru: baru.subarray(r.bAwal, r.bAkhir) });
  const potongan = gabung.map(jadi);
  const periksa = potongan.length ? terapkanTambalan(lama, potongan) : null;
  if (periksa && periksa.equals(baru)) return potongan;
  // Cadangan: satu potongan antara awal dan akhir yang sama.
  let awal = 0;
  while (awal < lama.length && awal < baru.length && lama[awal] === baru[awal]) awal += 1;
  let ujungA = lama.length;
  let ujungB = baru.length;
  while (ujungA > awal && ujungB > awal && lama[ujungA - 1] === baru[ujungB - 1]) {
    ujungA -= 1;
    ujungB -= 1;
  }
  return [{ offset: awal, lama: lama.subarray(awal, ujungA), baru: baru.subarray(awal, ujungB) }];
}

/** Jumlah kemunculan nama aplikasi (tanpa peduli huruf) - isi yang masuk ke ABT tidak boleh menambahnya. */
export function hitungNamaAplikasi(isi: Buffer | string): number {
  const t = typeof isi === "string" ? isi : isi.toString("latin1");
  return (t.match(/aleta/gi) ?? []).length;
}

// ---------------------------------------------------------------------------------------------------------------
// Bentuk data layar
// ---------------------------------------------------------------------------------------------------------------

/** Batas isi ABT pembanding per blangko (yang berbeda saja). */
export const BATAS_BANDING = 3;

export type ButirBeda = {
  id: string;
  nama: string;
  folder: string;
  folderLabel: string;
  ukuranAleta: number;
  ukuranAbt: number;
  /** Sejak kapan bedanya tercatat (ISO). */
  sejak: string;
  /** Berapa hari bedanya menunggu. */
  hari: number;
};

export type ButirHilang = { id: string; nama: string; folder: string; folderLabel: string; sejak: string };

export type RingkasBeda = {
  menunggu: number;
  tertuaHari: number;
  hilang: number;
  /** Blangko ubahan ALETA ABT yang bedanya dengan ABT sudah selesai ditinjau (calon isi paket). */
  ubahan: number;
  setelan: SetelanSinkronAbt;
  putaranTerakhir: { status: "berhasil" | "gagal" | "jalan"; pada: string; galat: string } | null;
  sedangJalan: boolean;
  daftar: ButirBeda[];
  daftarHilang: ButirHilang[];
};

export type ButirEkspor = { id: string; nama: string; folder: string; potongan: number; ukuranBaru: number };
export type ButirTidakSiap = { id: string; nama: string; folder: string; sebab: string };

export type DaftarEkspor = { siap: ButirEkspor[]; tidakSiap: ButirTidakSiap[] };
