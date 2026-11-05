import { bedaDaftar } from "@/lib/aleta-abt-beda";
import { bacaRtf } from "@/lib/baca-rtf";

/**
 * ============================================================================
 * PEMBANDING NASKAH ALETA ABT lawan ABT (5 Nov 2026, Tahap 5) - aturan murni, tanpa SQL, tanpa jaringan
 * ============================================================================
 *
 * Ukuran "sama dengan ABT" (saran di rancangan Tahap 5, dipakai apa adanya):
 *   1. teks per alinea     - dibandingkan di sini, dari RTF kedua sisi dengan pembaca yang SAMA (bacaRtf);
 *   2. jumlah halaman      - dari PDF kedua sisi (bandingRingkasPdf; pembacaan PDF ada di server/modules/aleta-abt-cetak);
 *   3. letak tanda tangan  - halaman dan ketinggian baris jabatan terakhir di PDF.
 * Dua ukuran terakhir hanya dapat diukur bila PDF dari LibreOffice ada; tanpa PDF mereka berstatus "belum diukur", bukan "sama".
 *
 * Pembanding alinea tidak membulatkan: dua alinea hanya identik bila teksnya sama setelah spasi berulang dilipat. Alinea
 * yang tidak identik digolongkan (tata letak, tanda baca, isi) supaya laporan dapat memisahkan beda tampilan dari beda isi.
 * Tidak ada data perkara yang disimpan di sini; pemanggil yang memutuskan apa yang ditampilkan.
 */

export type KelasBeda = "tata-letak" | "tanda-baca" | "isi" | "hanya-abt" | "hanya-aleta";

export type BedaAlinea = {
  kelas: KelasBeda;
  /** Nomor alinea (mulai 1) di sisi ABT / sisi ALETA; 0 bila tidak ada di sisi itu. */
  nomorAbt: number;
  nomorAleta: number;
  abt: string;
  aleta: string;
};

export type HasilBandingAlinea = {
  /** Gabungan: identik + berubah + hanya di satu sisi (pasangan berubah dihitung satu). */
  total: number;
  identik: number;
  persen: number;
  jumlahAbt: number;
  jumlahAleta: number;
  /** Banyaknya beda per kelas. */
  perKelas: Record<KelasBeda, number>;
  beda: BedaAlinea[];
  /** Pembanding berhenti memerinci karena bedanya terlalu banyak (hitungan tetap benar). */
  terpotong: boolean;
};

const lipat = (s: string) => s.replace(/\s+/g, " ").trim();
const tanpaSpasi = (s: string) => s.replace(/\s+/g, "");
const tanpaTanda = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, "").toLowerCase();

/** Alinea naskah RTF: satu butir per paragraf, spasi dilipat, alinea kosong dibuang. */
export function alineaDariRtf(rtf: string): string[] {
  return bacaRtf(rtf)
    .split("\n")
    .map(lipat)
    .filter((x) => x.length > 0);
}

const BATAS_RINCI = 400;

export function bandingAlinea(abt: string[], aleta: string[]): HasilBandingAlinea {
  const ops = bedaDaftar(abt, aleta);
  const perKelas: Record<KelasBeda, number> = { "tata-letak": 0, "tanda-baca": 0, isi: 0, "hanya-abt": 0, "hanya-aleta": 0 };
  const beda: BedaAlinea[] = [];
  let identik = 0;
  let total = 0;
  let terpotong = false;
  const catat = (b: BedaAlinea) => {
    perKelas[b.kelas] += 1;
    if (beda.length < BATAS_RINCI) beda.push(b);
    else terpotong = true;
  };
  for (let k = 0; k < ops.length; k += 1) {
    const op = ops[k];
    if (op.t === "=") {
      identik += op.n;
      total += op.n;
      continue;
    }
    if (op.t === "-") {
      const lanjut = ops[k + 1];
      const pasang = lanjut && lanjut.t === "+" ? Math.min(op.n, lanjut.n) : 0;
      for (let i = 0; i < op.n; i += 1) {
        total += 1;
        if (i < pasang) {
          const a = abt[op.a + i];
          const b = aleta[lanjut!.b + i];
          const kelas: KelasBeda = tanpaSpasi(a) === tanpaSpasi(b) ? "tata-letak" : tanpaTanda(a) === tanpaTanda(b) ? "tanda-baca" : "isi";
          catat({ kelas, nomorAbt: op.a + i + 1, nomorAleta: lanjut!.b + i + 1, abt: a, aleta: b });
        } else catat({ kelas: "hanya-abt", nomorAbt: op.a + i + 1, nomorAleta: 0, abt: abt[op.a + i], aleta: "" });
      }
      if (lanjut && lanjut.t === "+") {
        for (let i = pasang; i < lanjut.n; i += 1) {
          total += 1;
          catat({ kelas: "hanya-aleta", nomorAbt: 0, nomorAleta: lanjut.b + i + 1, abt: "", aleta: aleta[lanjut.b + i] });
        }
        k += 1;
      }
      continue;
    }
    for (let i = 0; i < op.n; i += 1) {
      total += 1;
      catat({ kelas: "hanya-aleta", nomorAbt: 0, nomorAleta: op.b + i + 1, abt: "", aleta: aleta[op.b + i] });
    }
  }
  return { total, identik, persen: total ? (identik / total) * 100 : 100, jumlahAbt: abt.length, jumlahAleta: aleta.length, perKelas, beda, terpotong };
}

// ---------------------------------------------------------------------------------------------------------------
// Kertas
// ---------------------------------------------------------------------------------------------------------------

export type KertasNaskah = { nama: "A4" | "F4" | "Legal" | "Lainnya" | "Tak terbaca"; lebarMm: number; tinggiMm: number };

const TWIP_MM = 25.4 / 1440;
const dekat = (x: number, y: number, t = 3) => Math.abs(x - y) <= t;

/** Ukuran kertas dari kata kendali \paperw/\paperh di kepala RTF (mm, dibulatkan). F4 = 215 x 330, Legal = 216 x 356. */
export function kertasDariRtf(rtf: string): KertasNaskah {
  const kepala = rtf.slice(0, 4000);
  const w = /\\paperw(\d+)/.exec(kepala);
  const h = /\\paperh(\d+)/.exec(kepala);
  if (!w || !h) return { nama: "Tak terbaca", lebarMm: 0, tinggiMm: 0 };
  const lebarMm = Math.round(Number(w[1]) * TWIP_MM);
  const tinggiMm = Math.round(Number(h[1]) * TWIP_MM);
  const nama = dekat(lebarMm, 210) && dekat(tinggiMm, 297) ? "A4" : dekat(lebarMm, 215) && dekat(tinggiMm, 330) ? "F4" : dekat(lebarMm, 216) && dekat(tinggiMm, 356) ? "Legal" : "Lainnya";
  return { nama, lebarMm, tinggiMm };
}

// ---------------------------------------------------------------------------------------------------------------
// Halaman dan letak tanda tangan (hanya bila ada PDF)
// ---------------------------------------------------------------------------------------------------------------

export type RingkasPdf = {
  jumlahHalaman: number;
  /** Letak baris jabatan terakhir (Hakim/Ketua/Panitera/Juru Sita): halaman (mulai 1) dan jarak dari tepi atas dalam mm; null bila tidak ditemukan. */
  letakTandaTangan: { halaman: number; dariAtasMm: number } | null;
};

export type BandingPdf = {
  jumlahHalaman: { abt: number; aleta: number; sama: boolean };
  letakTandaTangan: { abt: RingkasPdf["letakTandaTangan"]; aleta: RingkasPdf["letakTandaTangan"]; sama: boolean | null };
};

/** Toleransi letak: 6 mm (kira-kira satu baris). Halaman harus sama persis. */
export const TOLERANSI_LETAK_MM = 6;

export function bandingRingkasPdf(abt: RingkasPdf, aleta: RingkasPdf): BandingPdf {
  const a = abt.letakTandaTangan;
  const b = aleta.letakTandaTangan;
  return {
    jumlahHalaman: { abt: abt.jumlahHalaman, aleta: aleta.jumlahHalaman, sama: abt.jumlahHalaman === aleta.jumlahHalaman },
    letakTandaTangan: { abt: a, aleta: b, sama: a && b ? a.halaman === b.halaman && Math.abs(a.dariAtasMm - b.dariAtasMm) <= TOLERANSI_LETAK_MM : null },
  };
}

export const KELAS_BEDA_NAMA: Record<KelasBeda, string> = {
  "tata-letak": "hanya spasi",
  "tanda-baca": "hanya tanda baca atau huruf besar",
  isi: "isi berbeda",
  "hanya-abt": "hanya di ABT",
  "hanya-aleta": "hanya di ALETA",
};

// ---------------------------------------------------------------------------------------------------------------
// Laporan pembanding dari skrip (scripts/ukur-banding-abt/naskah.ts) - dibaca layar /aleta-abt/pembanding
// ---------------------------------------------------------------------------------------------------------------

export type RingkasJenis = { jenis: string; naskah: number; alinea: number; identik: number; persen: number; naskahIdentik: number };

export type BedaLaporan = {
  jenis: string;
  blangko: string;
  /** Penanda perkara dari sampel (bukan data pihak). */
  perkara: string;
  kelas: KelasBeda;
  nomorAbt: number;
  nomorAleta: number;
  /** Nama isian pada alinea itu menurut blangko (tanpa nilai). */
  isian: string[];
};

export type LaporanBanding = {
  dibuat: string;
  keterangan: string;
  ringkas: RingkasJenis[];
  perKelas: Record<KelasBeda, number>;
  beda: BedaLaporan[];
  /** Ukuran yang belum diukur beserta sebabnya. */
  belumTerukur: string[];
  /** Waktu menyusun (ms) naskah ALETA pada mesin pengukur; bukan angka peladen. */
  waktu: { jumlah: number; rata: number; tengah: number; terlama: number; tempat: string };
};

const angkaAman = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : 0);
const teksAman = (x: unknown, maks = 300) => String(x ?? "").slice(0, maks);
const KELAS: KelasBeda[] = ["tata-letak", "tanda-baca", "isi", "hanya-abt", "hanya-aleta"];

/** Membaca laporan hasil skrip dengan ketat: apa pun yang tidak dikenal dibuang, bentuk rusak -> null. */
export function bacaLaporanBanding(mentah: unknown): LaporanBanding | null {
  if (!mentah || typeof mentah !== "object" || Array.isArray(mentah)) return null;
  const o = mentah as Record<string, unknown>;
  if (!Array.isArray(o.ringkas)) return null;
  const perKelas = Object.fromEntries(KELAS.map((k) => [k, angkaAman((o.perKelas as Record<string, unknown> | undefined)?.[k])])) as Record<KelasBeda, number>;
  const w = (o.waktu && typeof o.waktu === "object" ? o.waktu : {}) as Record<string, unknown>;
  return {
    dibuat: teksAman(o.dibuat, 40),
    keterangan: teksAman(o.keterangan, 600),
    ringkas: o.ringkas.slice(0, 40).map((r) => {
      const x = (r ?? {}) as Record<string, unknown>;
      return { jenis: teksAman(x.jenis, 80), naskah: angkaAman(x.naskah), alinea: angkaAman(x.alinea), identik: angkaAman(x.identik), persen: angkaAman(x.persen), naskahIdentik: angkaAman(x.naskahIdentik) };
    }),
    perKelas,
    beda: (Array.isArray(o.beda) ? o.beda : []).slice(0, 500).map((r) => {
      const x = (r ?? {}) as Record<string, unknown>;
      const kelas = KELAS.includes(x.kelas as KelasBeda) ? (x.kelas as KelasBeda) : "isi";
      return {
        jenis: teksAman(x.jenis, 80),
        blangko: teksAman(x.blangko, 200),
        perkara: teksAman(x.perkara, 40),
        kelas,
        nomorAbt: angkaAman(x.nomorAbt),
        nomorAleta: angkaAman(x.nomorAleta),
        isian: (Array.isArray(x.isian) ? x.isian : []).slice(0, 12).map((n) => teksAman(n, 80)),
      };
    }),
    belumTerukur: (Array.isArray(o.belumTerukur) ? o.belumTerukur : []).slice(0, 20).map((t) => teksAman(t, 300)),
    waktu: { jumlah: angkaAman(w.jumlah), rata: angkaAman(w.rata), tengah: angkaAman(w.tengah), terlama: angkaAman(w.terlama), tempat: teksAman(w.tempat, 120) },
  };
}
