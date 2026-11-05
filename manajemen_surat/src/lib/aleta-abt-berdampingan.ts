import { bedaDaftar } from "@/lib/aleta-abt-beda";
import { KELAS_DIJELASKAN, golonganBeda, type KelasBeda } from "@/lib/aleta-abt-naskah";

/**
 * ============================================================================
 * BERDAMPINGAN DENGAN ABT (5 Nov 2026, Tahap 7) - aturan murni, tanpa SQL, tanpa jaringan
 * ============================================================================
 *
 * Petugas tetap mencetak dari ABT. Saat cetak ABT terdeteksi, ALETA ABT menyusun naskah yang sama di belakang dan membandingkannya dengan
 * RINGKASAN cetakan yang sudah dikirim jalur cetak-terakhir (sidik tiap paragraf + 160 huruf pertama; bukan dokumen). Di sini hanya
 * membandingkan dan menghitung. Yang boleh disimpan: angka, nama blangko, kelompok jenis perkara, dan kelas beda. TIDAK ADA kalimat
 * naskah, nama pihak, atau isian yang keluar dari berkas ini ke penyimpanan.
 *
 *   hijau  - semua paragraf sama;
 *   kuning - ada beda, tetapi semuanya sudah dijelaskan sebabnya (KELAS_DIJELASKAN: hanya spasi karena ABT menempelkan kata,
 *            titik-titik isian kosong yang tetap dicetak di BAS, tanggal nol, \par menempel);
 *   merah  - ada beda yang belum dijelaskan.
 * Beda spasi yang disebabkan ABT dicatat sebagai beda yang dijelaskan: tidak dihitung gagal, tetapi tetap terlihat.
 * Titik-titik isian kosong di BAS tetap dicetak ALETA ABT (kebijakan cetak, tidak diubah).
 */

export type Bagian = { h: string; t: string };

export const BATAS_BAGIAN = 600;
export const BATAS_TEKS_BAGIAN = 160;
export const SYARAT_CETAK = 30;
export const SYARAT_HARI_TANPA_MERAH = 14;
const BATAS_RINCI = 50;

const lipat = (x: unknown) => String(x ?? "").replace(/\s+/g, " ").trim();

/** Sidik FNV-1a 32-bit (8 huruf heksa) atas bentuk baku paragraf. SAMA PERSIS dengan ekstensi (blangko-derry-beda-cetak.js). */
export function sidikParagraf(paragraf: string): string {
  const baku = lipat(paragraf).toLowerCase().replace(/[’‘`"“”]/g, "'");
  let h = 0x811c9dc5;
  for (let i = 0; i < baku.length; i += 1) {
    h ^= baku.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Alinea naskah -> ringkasan {h, t}; aturan penyaringan sama dengan ekstensi (pendek dan tanpa huruf/angka dilewati). */
export function ringkasAlinea(alinea: readonly string[]): Bagian[] {
  const hasil: Bagian[] = [];
  for (const baris of alinea) {
    const t = lipat(baris);
    if (t.length < 2 || !/[\p{L}\p{N}]/u.test(t)) continue;
    hasil.push({ h: sidikParagraf(t), t: t.slice(0, BATAS_TEKS_BAGIAN) });
    if (hasil.length >= BATAS_BAGIAN) break;
  }
  return hasil;
}

const tanpaSpasi = (s: string) => s.replace(/\s+/g, "");

/**
 * Menggolongkan dua potongan yang sidiknya berbeda. Potongan dipotong 160 huruf; bila salah satunya terpotong, letak beda dapat berada di luar
 * bagian yang terlihat. Beda yang tidak terlihat digolongkan "isi" (tidak dianggap sudah dijelaskan).
 */
export function golonganBedaPotongan(abt: string, aleta: string): KelasBeda {
  const a = lipat(abt);
  const b = lipat(aleta);
  // Potongan 160 huruf yang berakhir pada spasi menjadi 159 setelah dirapikan, jadi batasnya 159.
  const terpotong = a.length >= BATAS_TEKS_BAGIAN - 1 || b.length >= BATAS_TEKS_BAGIAN - 1;
  // Sidik berbeda padahal bagian yang terlihat sama persis: bedanya ada di luar potongan, tidak dapat dijelaskan.
  if (a && a === b) return "isi";
  if (!terpotong) return golonganBeda(a, b);
  if (!a) return "hanya-aleta";
  if (!b) return "hanya-abt";
  const n = Math.min(a.length, b.length);
  if (a.slice(0, n) === b.slice(0, n)) return "isi";
  const sa = tanpaSpasi(a);
  const sb = tanpaSpasi(b);
  const m = Math.min(sa.length, sb.length);
  if (sa.slice(0, m) === sb.slice(0, m)) return "tata-letak";
  return golonganBeda(a, b);
}

export type HasilBerdampingan = {
  total: number;
  identik: number;
  dijelaskan: number;
  belumDijelaskan: number;
  perKelas: Record<KelasBeda, number>;
  /** Hanya angka: kelas dan nomor alinea (mulai 1; 0 = tidak ada di sisi itu). Paling banyak 50. */
  nomor: Array<{ kelas: KelasBeda; abt: number; aleta: number }>;
  hasil: "hijau" | "kuning" | "merah";
};

const KELAS_KOSONG = (): Record<KelasBeda, number> => ({ "tata-letak": 0, "tanda-baca": 0, "tanda-kosong": 0, "tanggal-nol": 0, "par-menempel": 0, isi: 0, "hanya-abt": 0, "hanya-aleta": 0 });

/** Membandingkan ringkasan cetakan ABT dengan ringkasan naskah ALETA ABT. */
export function bandingRingkasan(abt: readonly Bagian[], aleta: readonly Bagian[]): HasilBerdampingan {
  const ops = bedaDaftar(
    abt.map((x) => x.h),
    aleta.map((x) => x.h)
  );
  const perKelas = KELAS_KOSONG();
  const nomor: HasilBerdampingan["nomor"] = [];
  let identik = 0;
  let total = 0;
  const catat = (kelas: KelasBeda, na: number, nb: number) => {
    total += 1;
    perKelas[kelas] += 1;
    if (nomor.length < BATAS_RINCI) nomor.push({ kelas, abt: na, aleta: nb });
  };
  for (let k = 0; k < ops.length; k += 1) {
    const op = ops[k];
    if (op.t === "=") {
      identik += op.n;
      total += op.n;
      continue;
    }
    if (op.t === "+") {
      for (let i = 0; i < op.n; i += 1) catat("hanya-aleta", 0, op.b + i + 1);
      continue;
    }
    const lanjut = ops[k + 1];
    const pasang = lanjut && lanjut.t === "+" ? Math.min(op.n, lanjut.n) : 0;
    for (let i = 0; i < op.n; i += 1) {
      if (i < pasang) catat(golonganBedaPotongan(abt[op.a + i].t, aleta[lanjut!.b + i].t), op.a + i + 1, lanjut!.b + i + 1);
      else catat("hanya-abt", op.a + i + 1, 0);
    }
    if (lanjut && lanjut.t === "+") {
      for (let i = pasang; i < lanjut.n; i += 1) catat("hanya-aleta", 0, lanjut.b + i + 1);
      k += 1;
    }
  }
  let dijelaskan = 0;
  let belum = 0;
  for (const kelas of Object.keys(perKelas) as KelasBeda[]) {
    if (KELAS_DIJELASKAN[kelas]) dijelaskan += perKelas[kelas];
    else belum += perKelas[kelas];
  }
  return { total, identik, dijelaskan, belumDijelaskan: belum, perKelas, nomor, hasil: belum > 0 ? "merah" : dijelaskan > 0 ? "kuning" : "hijau" };
}

// ---------------------------------------------------------------------------------------------------------------
// Pengelompokan: jenis perkara dan jenis naskah dari nama folder
// ---------------------------------------------------------------------------------------------------------------

export type JenisPerkaraBanding = "cerai-gugat" | "cerai-talak" | "lain" | "tidak-diketahui";
export type JenisNaskahBanding = "putusan" | "bas" | "relaas" | "lain";

export const NAMA_JENIS_BANDING: Record<JenisPerkaraBanding, string> = {
  "cerai-gugat": "Cerai gugat",
  "cerai-talak": "Cerai talak",
  lain: "Jenis lain",
  "tidak-diketahui": "Jenis belum diketahui",
};

/** Dari nama jenis perkara SIPP ("Cerai Gugat", "Cerai Talak"). Kosong atau lain = null (tanya sumber lain). */
export function jenisDariNama(nama: unknown): JenisPerkaraBanding | null {
  const s = lipat(nama).toLowerCase();
  if (!s) return null;
  if (s.includes("cerai gugat")) return "cerai-gugat";
  if (s.includes("cerai talak")) return "cerai-talak";
  return "lain";
}

/** Dari nama folder blangko; folder alur (ALUR 04 dst.) dipakai gugat maupun talak, jadi tidak diketahui. */
export function jenisDariFolder(folder: unknown): JenisPerkaraBanding {
  const s = lipat(folder);
  if (/^ALUR\s+\d+/i.test(s) || /^-\s*BAS\s/i.test(s)) return "tidak-diketahui";
  if (/\bCG\b|cerai\s*gugat/i.test(s)) return "cerai-gugat";
  if (/\bCT\b|cerai\s*talak/i.test(s)) return "cerai-talak";
  return "tidak-diketahui";
}

export function naskahDariFolder(folder: unknown): JenisNaskahBanding {
  const s = lipat(folder);
  if (/relaas/i.test(s)) return "relaas";
  if (/\bBAS\b|^ALUR\s+\d+/i.test(s)) return "bas";
  if (/ptsp|sita|eksekusi|verzet|berkas perkara|court calendar/i.test(s)) return "lain";
  return "putusan";
}

// ---------------------------------------------------------------------------------------------------------------
// Ringkasan untuk pemilik
// ---------------------------------------------------------------------------------------------------------------

export type JawabanBeda = "" | "dijelaskan" | "sudah-dibetulkan" | "salah-pembanding";
export const JAWABAN_SAH: readonly JawabanBeda[] = ["dijelaskan", "sudah-dibetulkan", "salah-pembanding"];

export type BarisBerdampingan = {
  id: string;
  waktu: string;
  pemicu: string;
  berkasNama: string;
  jenisPerkara: JenisPerkaraBanding;
  jenisNaskah: JenisNaskahBanding;
  perkaraId: string;
  hasil: "hijau" | "kuning" | "merah" | "belum-diukur";
  sebabBelum: string;
  totalAlinea: number;
  identik: number;
  dijelaskanN: number;
  belumDijelaskanN: number;
  jawaban: JawabanBeda;
};

/** Hasil yang dihitung: merah yang sudah dijawab pemilik menjadi kuning (dijelaskan atau dibetulkan). */
export function hasilBerlaku(b: Pick<BarisBerdampingan, "hasil" | "jawaban">): BarisBerdampingan["hasil"] {
  return b.hasil === "merah" && b.jawaban ? "kuning" : b.hasil;
}

export type KemajuanJenis = {
  jenis: JenisPerkaraBanding;
  nama: string;
  cetak: number;
  target: number;
  hijau: number;
  kuning: number;
  merah: number;
  belumDiukur: number;
  /** Hari penuh sejak beda merah terakhir (atau sejak pengukuran pertama bila belum pernah merah). */
  hariTanpaMerah: number;
  memenuhiSyarat: boolean;
};

export type RingkasanMingguan = { mulai: string; total: number; hijau: number; kuning: number; merah: number; belumDiukur: number };

export type RingkasanBerdampingan = {
  perJenis: KemajuanJenis[];
  mingguan: RingkasanMingguan[];
  merahBelumDijawab: number;
  total: number;
  syaratCetak: number;
  syaratHari: number;
};

const HARI = 86_400_000;

const awalPekan = (d: Date) => {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const hari = (x.getUTCDay() + 6) % 7;
  x.setUTCDate(x.getUTCDate() - hari);
  return x.toISOString().slice(0, 10);
};

/** Ringkasan syarat 30 cetak per jenis (gugat dan talak), dua pekan tanpa beda merah, dan hitungan mingguan. Tidak memutuskan pindah. */
export function ringkasBerdampingan(baris: readonly BarisBerdampingan[], kini: Date = new Date(), jumlahPekan = 6): RingkasanBerdampingan {
  const jenisTarget: JenisPerkaraBanding[] = ["cerai-gugat", "cerai-talak"];
  const perJenis: KemajuanJenis[] = jenisTarget.map((jenis) => {
    const milik = baris.filter((b) => b.jenisPerkara === jenis);
    let hijau = 0;
    let kuning = 0;
    let merah = 0;
    let belum = 0;
    let merahTerakhir = 0;
    let pertama = Infinity;
    for (const b of milik) {
      const h = hasilBerlaku(b);
      const t = Date.parse(b.waktu);
      if (h === "belum-diukur") {
        belum += 1;
        continue;
      }
      if (Number.isFinite(t) && t < pertama) pertama = t;
      if (h === "hijau") hijau += 1;
      else if (h === "kuning") kuning += 1;
      else {
        merah += 1;
        if (Number.isFinite(t) && t > merahTerakhir) merahTerakhir = t;
      }
    }
    const cetak = hijau + kuning + merah;
    const patokan = merahTerakhir || (Number.isFinite(pertama) ? pertama : 0);
    const hariTanpaMerah = patokan ? Math.max(0, Math.floor((kini.getTime() - patokan) / HARI)) : 0;
    return {
      jenis,
      nama: NAMA_JENIS_BANDING[jenis],
      cetak,
      target: SYARAT_CETAK,
      hijau,
      kuning,
      merah,
      belumDiukur: belum,
      hariTanpaMerah,
      memenuhiSyarat: cetak >= SYARAT_CETAK && merah === 0 && hariTanpaMerah >= SYARAT_HARI_TANPA_MERAH,
    };
  });
  const pekan = new Map<string, RingkasanMingguan>();
  const sekarang = awalPekan(kini);
  for (let i = 0; i < jumlahPekan; i += 1) {
    const d = new Date(`${sekarang}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 7 * i);
    const k = d.toISOString().slice(0, 10);
    pekan.set(k, { mulai: k, total: 0, hijau: 0, kuning: 0, merah: 0, belumDiukur: 0 });
  }
  for (const b of baris) {
    const t = new Date(b.waktu);
    if (Number.isNaN(t.getTime())) continue;
    const p = pekan.get(awalPekan(t));
    if (!p) continue;
    const h = hasilBerlaku(b);
    p.total += 1;
    if (h === "hijau") p.hijau += 1;
    else if (h === "kuning") p.kuning += 1;
    else if (h === "merah") p.merah += 1;
    else p.belumDiukur += 1;
  }
  return {
    perJenis,
    mingguan: [...pekan.values()].sort((a, b) => b.mulai.localeCompare(a.mulai)),
    merahBelumDijawab: baris.filter((b) => hasilBerlaku(b) === "merah").length,
    total: baris.length,
    syaratCetak: SYARAT_CETAK,
    syaratHari: SYARAT_HARI_TANPA_MERAH,
  };
}
