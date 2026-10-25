/**
 * Jejak tunda/putus otomatis terstruktur (U19, 25 Okt 2026) - bagian murni.
 *
 * Satu baris jejak = satu sidang pada satu hari sidang yang diputuskan tunda/putus otomatis
 * (atau dilewati beserta sebabnya). Laporan ketepatan dihitung dari baris-baris ini.
 *
 * "KETEPATAN" DI SINI BUKAN KEBENARAN HUKUM. Yang terukur hanya apakah penjaga bot
 * (membaca ulang SIPP sesaat sebelum menulis) menerima atau menolak usulan sebuah aturan.
 * Aturan yang sering ditolak penjaga berarti sering salah sangka - itu bahan koreksi
 * aturan, bukan bukti bahwa yang diterima pasti benar.
 */

export type FiturOtomatis = "tunda" | "putus";

export type BarisJejak = {
  id: string;
  fitur: FiturOtomatis;
  tanggal: string;
  jadwalId: string;
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  /** tunda | gugur | tidak-dapat-diterima | putus | lewati */
  keputusan: string;
  /** Kunci aturan (mis. court-calendar, gugur) atau, untuk "lewati", sebabnya. */
  aturan: string;
  nomorAturan: number;
  tanggalTunda: string;
  /** Status tulis: tertulis, diantrekan, kering-lolos, kering-ditolak, ditolak, gagal, dibatalkan, dilewati; kosong = belum ditulis. */
  hasil: string;
  kering: boolean;
  ditolakPenjaga: boolean;
  dibatalkanPetugas: boolean;
  pesan: string;
  edoc: string;
  pemicu: string;
  jam: string;
};

export const HASIL_LOLOS = new Set(["tertulis", "diantrekan", "kering-lolos"]);
export const HASIL_DITOLAK_PENJAGA = new Set(["ditolak", "kering-ditolak"]);

export type RingkasAturan = {
  fitur: FiturOtomatis;
  aturan: string;
  nomorAturan: number;
  /** Keputusan yang benar-benar dicoba ditulis (bukan usulan, bukan dilewati). */
  dicoba: number;
  lolos: number;
  ditolakPenjaga: number;
  gagal: number;
  dibatalkan: number;
  kering: number;
  nyata: number;
  /** Usulan putusan (gugur / tidak dapat diterima) yang sengaja tidak ditulis. */
  usulan: number;
  /** lolos / (lolos + ditolakPenjaga) x 100, satu desimal; null bila belum ada yang diputuskan penjaga. */
  persenLolos: number | null;
};

export type RingkasSebab = { fitur: FiturOtomatis; sebab: string; jumlah: number; dibatalkanPetugas: boolean };

export type LaporanKetepatan = {
  dari: string;
  sampai: string;
  jumlahBaris: number;
  aturan: RingkasAturan[];
  dilewati: RingkasSebab[];
};

function satuDesimal(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Menghitung laporan dari baris jejak. Murni: tanpa basis data. */
export function ringkasKetepatan(baris: readonly BarisJejak[], dari: string, sampai: string): LaporanKetepatan {
  const peta = new Map<string, RingkasAturan>();
  const sebab = new Map<string, RingkasSebab>();
  for (const b of baris) {
    if (b.keputusan === "lewati") {
      const k = `${b.fitur}|${b.aturan}`;
      const s = sebab.get(k) ?? { fitur: b.fitur, sebab: b.aturan, jumlah: 0, dibatalkanPetugas: b.dibatalkanPetugas };
      s.jumlah += 1;
      sebab.set(k, s);
      continue;
    }
    const k = `${b.fitur}|${b.aturan}`;
    const r =
      peta.get(k) ??
      ({
        fitur: b.fitur,
        aturan: b.aturan,
        nomorAturan: b.nomorAturan,
        dicoba: 0,
        lolos: 0,
        ditolakPenjaga: 0,
        gagal: 0,
        dibatalkan: 0,
        kering: 0,
        nyata: 0,
        usulan: 0,
        persenLolos: null,
      } satisfies RingkasAturan);
    if (b.hasil === "dilewati") {
      r.usulan += 1;
    } else if (b.hasil !== "") {
      r.dicoba += 1;
      if (b.kering) r.kering += 1;
      else r.nyata += 1;
      if (HASIL_LOLOS.has(b.hasil)) r.lolos += 1;
      else if (HASIL_DITOLAK_PENJAGA.has(b.hasil) || b.ditolakPenjaga) r.ditolakPenjaga += 1;
      else if (b.hasil === "gagal") r.gagal += 1;
      else if (b.hasil === "dibatalkan" || b.dibatalkanPetugas) r.dibatalkan += 1;
    }
    peta.set(k, r);
  }
  const aturan = [...peta.values()].map((r) => {
    const diputuskan = r.lolos + r.ditolakPenjaga;
    return { ...r, persenLolos: diputuskan > 0 ? satuDesimal((r.lolos / diputuskan) * 100) : null };
  });
  aturan.sort((a, b) => a.fitur.localeCompare(b.fitur) || b.dicoba + b.usulan - (a.dicoba + a.usulan) || a.aturan.localeCompare(b.aturan));
  const dilewati = [...sebab.values()].sort((a, b) => a.fitur.localeCompare(b.fitur) || b.jumlah - a.jumlah || a.sebab.localeCompare(b.sebab));
  return { dari, sampai, jumlahBaris: baris.length, aturan, dilewati };
}

// ---------------------------------------------------------------------------
// Label untuk layar (bahasa petugas, bukan kode)
// ---------------------------------------------------------------------------

const LABEL_ATURAN: Readonly<Record<string, string>> = {
  gugur: "Gugur",
  "tidak-dapat-diterima": "Tidak dapat diterima",
  "permohonan-7": "Permohonan: tunda 7 hari",
  "pembuktian-elektronik-7": "Pembuktian, panggilan elektronik: 7 hari",
  "pembuktian-14": "Pembuktian: 14 hari",
  "panggil-ulang-14": "Panggil ulang: 14 hari",
  "court-calendar": "Mengikuti Court Calendar",
  "court-calendar-habis-14": "Court Calendar habis: 14 hari",
  "tanpa-court-calendar-14": "Tanpa Court Calendar: 14 hari",
};

export function labelAturan(fitur: FiturOtomatis, aturan: string, nomorAturan: number): string {
  const nama = LABEL_ATURAN[aturan] ?? aturan;
  const awal = fitur === "putus" ? "Putus otomatis" : "Tunda otomatis";
  return `${awal}: ${nama}${nomorAturan > 0 ? ` (aturan ${nomorAturan})` : ""}`;
}

const LABEL_HASIL: Readonly<Record<string, string>> = {
  tertulis: "Tertulis di SIPP",
  diantrekan: "Diantrekan",
  "kering-lolos": "Lolos (mode kering)",
  "kering-ditolak": "Ditolak (mode kering)",
  ditolak: "Ditolak saat dibaca ulang",
  gagal: "Gagal",
  dibatalkan: "Dibatalkan petugas",
  dilewati: "Usulan saja",
  "": "Belum ditulis",
};

export function labelHasil(hasil: string): string {
  return LABEL_HASIL[hasil] ?? hasil;
}
