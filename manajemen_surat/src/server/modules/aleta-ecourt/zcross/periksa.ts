import type { GarisPdf } from "./pdf-garis";
import type { HasilBacaPdf, Kata } from "./pdf-letak";

/**
 * PEMERIKSA SILANG Z (3 Nov 2026) - garis Z dan tulisan "SC Z 1x / tanggal" TIDAK BOLEH bersilang dengan tulisan atau tabel apa pun.
 *
 * Murni geometri atas hasil baca PDF (kata berletak dari pdf-letak, ruas garis dari pdf-garis), koordinat poin dari kiri-atas:
 *   - KOTAK BADAN kata = dari +-62% tinggi huruf di atas garis dasar sampai sedikit di atas garis dasar, disusutkan 0,5 pt di kiri-kanan.
 *     Garis bawah (underline) dan garis tabel di antara baris tidak masuk kotak ini; garis yang MENCORET tulisan masuk.
 *   - garis-tulisan  : ruas garis memotong kotak badan sebuah kata;
 *   - tulisan-tulisan: dua kata di halaman yang sama saling menimpa (luas irisan > 25% kotak yang lebih kecil) - mis. "SC Z 1x" di atas
 *     kalimat. Dua kata dalam satu baris tidak pernah beririsan (letaknya berurutan), jadi pada naskah normal daftar ini kosong.
 *   - garis-garis    : ruas Z memotong garis tabel (hanya bila pemanggil menandai ruas mana yang Z).
 * Dipakai: (1) sesuaikanZcross menolak rencana Z yang bersilang dengan tulisan hasil ukur; (2) PDF akhir diperiksa sekali lagi;
 * (3) uji regresi (Word dan LibreOffice) atas BAS sungguhan.
 */
export type Kotak = { x1: number; y1: number; x2: number; y2: number };

export type Pelanggaran =
  | { jenis: "garis-tulisan"; halaman: number; garis: GarisPdf; kata: string; kotak: Kotak }
  | { jenis: "tulisan-tulisan"; halaman: number; kata: string; lawan: string; kotak: Kotak; kotakLawan?: Kotak }
  | { jenis: "garis-garis"; halaman: number; garis: GarisPdf; lawan: GarisPdf };

export const NAIK_BADAN = 0.62;
export const TURUN_BADAN = 0.08;

export function kotakKata(k: Pick<Kata, "x1" | "x2" | "yDasar" | "ukuran">, susut = 0.5): Kotak {
  const u = k.ukuran > 0 ? k.ukuran : 10;
  return { x1: k.x1 + susut, x2: Math.max(k.x1 + susut, k.x2 - susut), y1: k.yDasar - NAIK_BADAN * u, y2: k.yDasar - TURUN_BADAN * u };
}

/** Ruas (x1,y1)-(x2,y2) memotong / berada di dalam kotak? (Liang-Barsky) */
export function ruasMemotongKotak(g: Pick<GarisPdf, "x1" | "y1" | "x2" | "y2">, k: Kotak): boolean {
  if (k.x2 <= k.x1 || k.y2 <= k.y1) return false;
  const dx = g.x2 - g.x1;
  const dy = g.y2 - g.y1;
  let t0 = 0;
  let t1 = 1;
  const uji = (p: number, q: number): boolean => {
    if (Math.abs(p) < 1e-9) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  return uji(-dx, g.x1 - k.x1) && uji(dx, k.x2 - g.x1) && uji(-dy, g.y1 - k.y1) && uji(dy, k.y2 - g.y1) && t0 <= t1;
}

/** Dua ruas berpotongan (bukan sekadar bersentuhan di ujung)? */
export function ruasBerpotongan(a: Pick<GarisPdf, "x1" | "y1" | "x2" | "y2">, b: Pick<GarisPdf, "x1" | "y1" | "x2" | "y2">): boolean {
  const arah = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
  const d1 = arah(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1);
  const d2 = arah(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2);
  const d3 = arah(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1);
  const d4 = arah(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2);
  const e = 1e-6;
  return ((d1 > e && d2 < -e) || (d1 < -e && d2 > e)) && ((d3 > e && d4 < -e) || (d3 < -e && d4 > e));
}

const luas = (k: Kotak) => Math.max(0, k.x2 - k.x1) * Math.max(0, k.y2 - k.y1);
function irisan(a: Kotak, b: Kotak): number {
  return Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)) * Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
}

export type OpsiPeriksa = {
  /** Hanya halaman ini (bawaan semua). */
  halaman?: ReadonlyArray<number>;
  /** Ruas yang diperiksa terhadap tulisan (bawaan: semua ruas). */
  ruas?: (g: GarisPdf) => boolean;
  /** Kata yang diperiksa (bawaan: semua); indeks = urutan di baca.kata. */
  kata?: (k: Kata, indeks: number) => boolean;
  /** Ruas Z yang juga diperiksa terhadap ruas lain (garis tabel). */
  ruasZ?: (g: GarisPdf) => boolean;
  /** Ambang irisan dua kata (bagian dari kotak yang lebih kecil); bawaan 0,25. */
  ambangTumpang?: number;
};

/** Semua pelanggaran silang pada PDF yang sudah dibaca. Kosong = bersih. */
export function periksaTumpang(baca: Pick<HasilBacaPdf, "kata" | "jumlahHalaman">, garis: ReadonlyArray<GarisPdf>, opsi: OpsiPeriksa = {}): Pelanggaran[] {
  const hasil: Pelanggaran[] = [];
  const halaman = opsi.halaman ?? Array.from({ length: baca.jumlahHalaman }, (_, i) => i + 1);
  const ambang = opsi.ambangTumpang ?? 0.25;
  for (const h of halaman) {
    const kata = baca.kata
      .map((k, i) => ({ k, i }))
      .filter(({ k, i }) => k.halaman === h && (!opsi.kata || opsi.kata(k, i)) && k.t.trim())
      .map(({ k }) => ({ k, kotak: kotakKata(k) }));
    const ruasHal = garis.filter((g) => g.halaman === h);
    for (const g of ruasHal) {
      if (opsi.ruas && !opsi.ruas(g)) continue;
      for (const { k, kotak } of kata) if (ruasMemotongKotak(g, kotak)) hasil.push({ jenis: "garis-tulisan", halaman: h, garis: g, kata: k.t, kotak });
    }
    for (let a = 0; a < kata.length; a += 1) {
      for (let b = a + 1; b < kata.length; b += 1) {
        const ka = kata[a].kotak;
        const kb = kata[b].kotak;
        const iri = irisan(ka, kb);
        if (iri <= 0) continue;
        if (iri > ambang * Math.min(luas(ka), luas(kb))) hasil.push({ jenis: "tulisan-tulisan", halaman: h, kata: kata[a].k.t, lawan: kata[b].k.t, kotak: ka, kotakLawan: kb });
      }
    }
    if (opsi.ruasZ) {
      const z = ruasHal.filter(opsi.ruasZ);
      const lain = ruasHal.filter((g) => !opsi.ruasZ!(g));
      for (const a of z) for (const b of lain) if (ruasBerpotongan(a, b)) hasil.push({ jenis: "garis-garis", halaman: h, garis: a, lawan: b });
    }
  }
  return hasil;
}

/** Ringkas pelanggaran untuk pesan (tanpa istilah teknis, paling banyak `n`). */
export function ringkasPelanggaran(p: ReadonlyArray<Pelanggaran>, n = 3): string {
  return p
    .slice(0, n)
    .map((x) =>
      x.jenis === "garis-tulisan"
        ? `hal ${x.halaman}: garis melintasi "${x.kata}"`
        : x.jenis === "tulisan-tulisan"
          ? `hal ${x.halaman}: "${x.kata}" menimpa "${x.lawan}"`
          : `hal ${x.halaman}: garis Z memotong garis tabel`
    )
    .join("; ");
}
