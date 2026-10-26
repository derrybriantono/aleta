/**
 * ============================================================================
 * PEMERIKSA EJAAN DAN NAMA PIHAK DENGAN KAMUS ALIAS (U18 / ide sipp-20, rantai B, 25 Okt 2026)
 * ============================================================================
 *
 * Nama pihak yang sama sering tertulis berbeda di SIPP, blangko ABT, dan BAS ("Muhamad Alwi", "Muhammad Alwi",
 * "Moh. Alwi", "Siti Nur Haliza" / "Siti Nurhaliza"). Berkas ini hanya memuat aturan murni: menormalkan nama,
 * membandingkan beberapa penulisan, dan membaca kamus alias (nama baku + varian ejaan) - SEMUANYA USULAN.
 * Tidak ada fungsi di sini (atau di pemakainya) yang menulis nama ke SIPP, ABT, atau e-Court.
 *
 * Aturan perbandingan (berurutan, dari yang paling pasti):
 *   1. penulisan yang sama setelah huruf besar-kecil, spasi, tanda baca, dan gelar diabaikan = tidak ada masalah;
 *   2. kunci ejaan sama (Muhammad = Muhamad = Mohammad = Moh. = Muh.; oe=u, dj=j, tj=c; huruf rangkap ditunggalkan;
 *      spasi diabaikan) tetapi tulisan berbeda = "beda-ejaan": satu nama, dua ejaan, pilih satu;
 *   3. kunci berbeda tetapi jaraknya kecil (<= 1 untuk 5-9 huruf, <= 2 untuk 10 huruf atau lebih) = "mirip":
 *      mungkin salah ketik atau dua orang berbeda - hanya diperiksa petugas;
 *   4. nama (atau kuncinya) tercatat di kamus sebagai varian nama baku = "alias": usulan memakai ejaan baku.
 */

export type SumberNama = { asal: string; nama: string };
export type EntriKamus = { baku: string; varian: string[] };
export type JenisUsulanEjaan = "beda-ejaan" | "mirip" | "alias";
export type UsulanEjaan = {
  jenis: JenisUsulanEjaan;
  tingkat: "periksa" | "info";
  pesan: string;
  nama: SumberNama[];
  /** Ejaan baku yang diusulkan bila ada (dari kamus, atau penulisan yang paling banyak dipakai). */
  usulanBaku: string;
};

export const BATAS_NAMA_PERIKSA = 40;
export const BATAS_PANJANG_NAMA = 120;
export const BATAS_VARIAN_PER_BAKU = 20;

const GELAR = new Set([
  "dr", "drs", "dra", "prof", "ir", "h", "hj", "kh", "ust", "ustadz", "ustadzah", "alm", "almh", "almarhum", "almarhumah",
  "sh", "se", "spd", "skom", "sag", "ssos", "st", "mh", "mkn", "mpd", "msi", "mag", "mm", "phd", "ssi", "sip", "ssy", "mhi", "shi", "lc",
]);
/** Kata yang menandai ejaan lain dari "Muhammad". */
const MUHAMMAD = new Set(["muhammad", "muhamad", "mohammad", "mohamad", "mohammed", "muhamed", "mochammad", "mochamad", "muh", "moh", "mohd", "muchamad", "m"]);
const ABDUL = new Set(["abdul", "abdoel", "abd", "abdoul"]);
const BINTI = new Set(["binti", "bt", "binte", "bint"]);
const BIN = new Set(["bin", "ibnu", "ibn"]);

function tanpaDiakritik(s: string) {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

/** Token nama: huruf kecil, tanpa tanda baca dan gelar. "H. Muhammad Alwi, S.H." -> ["muhammad", "alwi"] (gelar dibuang). */
export function tokenNama(nama: string): string[] {
  const dasar = tanpaDiakritik(String(nama ?? "").normalize("NFKC"))
    .toLowerCase()
    .replace(/['’‘`´]/g, "")
    .replace(/[.,;:()\[\]"\/\\_-]+/g, " ");
  const semua = dasar.split(/\s+/).filter(Boolean);
  // Pecahan gelar bergabung ("S.H." -> "s h"): digabung dulu supaya "s" "h" dikenali sebagai "sh".
  const gabung: string[] = [];
  for (let i = 0; i < semua.length; i += 1) {
    const t = semua[i]!;
    const n = semua[i + 1];
    if (t.length <= 2 && n && n.length <= 3 && GELAR.has(t + n)) {
      gabung.push(t + n);
      i += 1;
    } else gabung.push(t);
  }
  return gabung.filter((t) => !GELAR.has(t));
}

/** Penulisan "dasar" untuk membandingkan apa adanya: token tanpa gelar digabung spasi tunggal. */
export function tulisanDasar(nama: string): string {
  return tokenNama(nama).join(" ");
}

function ejaanKata(kata: string, pertama: boolean, adaSesudah: boolean): string {
  if (MUHAMMAD.has(kata) && (kata !== "m" || (pertama && adaSesudah))) return "muhammad";
  if (ABDUL.has(kata)) return "abdul";
  if (BINTI.has(kata)) return "binti";
  if (BIN.has(kata)) return "bin";
  let k = kata
    .replace(/oe/g, "u")
    .replace(/dj/g, "j")
    .replace(/tj/g, "c")
    .replace(/sj/g, "sy")
    .replace(/ch/g, "kh")
    .replace(/ph/g, "f");
  k = k.replace(/([bcdfghjklmnpqrstvwxyz])\1+/g, "$1");
  return k;
}

/** Kunci ejaan (dengan spasi antar kata). */
export function kunciEjaan(nama: string): string {
  const t = tokenNama(nama);
  return t.map((k, i) => ejaanKata(k, i === 0, i < t.length - 1)).join(" ");
}
/** Kunci ejaan tanpa spasi ("Nur Haliza" = "Nurhaliza"). */
export function kunciRapat(nama: string): string {
  return kunciEjaan(nama).replace(/\s+/g, "");
}

export function jarakEdit(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let sebelum = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const kini = [i];
    for (let j = 1; j <= b.length; j += 1) {
      kini[j] = Math.min(sebelum[j]! + 1, kini[j - 1]! + 1, sebelum[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    sebelum = kini;
  }
  return sebelum[b.length]!;
}

/** Batas jarak untuk dianggap "mirip" menurut panjang kunci rapat. */
export function batasMirip(panjang: number): number {
  if (panjang < 5) return 0;
  return panjang >= 10 ? 2 : 1;
}

function sah(s: unknown, maks = BATAS_PANJANG_NAMA): string {
  const t = typeof s === "string" ? s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim() : "";
  return t.length > maks ? t.slice(0, maks).trim() : t;
}

export class GalatEjaan extends Error {}

/** Memeriksa masukan pemeriksa dari ekstensi/portal; entri kosong dibuang, bentuk salah ditolak. */
export function bersihkanSumberNama(x: unknown): SumberNama[] {
  if (!Array.isArray(x)) throw new GalatEjaan("Daftar nama harus berupa larik {asal, nama}.");
  if (x.length > BATAS_NAMA_PERIKSA) throw new GalatEjaan(`Paling banyak ${BATAS_NAMA_PERIKSA} nama sekali periksa.`);
  const hasil: SumberNama[] = [];
  for (const e of x) {
    const o = e && typeof e === "object" && !Array.isArray(e) ? (e as Record<string, unknown>) : null;
    if (!o) throw new GalatEjaan("Setiap nama harus berupa obyek {asal, nama}.");
    const nama = sah(o.nama);
    if (!nama || tokenNama(nama).length === 0) continue;
    hasil.push({ asal: sah(o.asal, 60) || "(tanpa asal)", nama });
  }
  return hasil;
}

export function bersihkanEntriKamus(x: unknown): EntriKamus {
  const o = x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
  if (!o) throw new GalatEjaan("Entri kamus harus berupa obyek {baku, varian}.");
  const baku = sah(o.baku);
  if (tokenNama(baku).length === 0) throw new GalatEjaan("Nama baku kosong atau hanya berisi gelar.");
  const mentah = Array.isArray(o.varian) ? o.varian : typeof o.varian === "string" ? o.varian.split(/\r?\n|;/) : [];
  const unik = new Map<string, string>();
  for (const v of mentah) {
    const t = sah(v);
    if (!t || tokenNama(t).length === 0) continue;
    const k = tulisanDasar(t);
    if (k === tulisanDasar(baku)) continue;
    if (!unik.has(k)) unik.set(k, t);
  }
  if (unik.size === 0) throw new GalatEjaan("Isi paling sedikit satu varian ejaan yang berbeda dari nama baku.");
  if (unik.size > BATAS_VARIAN_PER_BAKU) throw new GalatEjaan(`Paling banyak ${BATAS_VARIAN_PER_BAKU} varian per nama baku.`);
  return { baku, varian: [...unik.values()] };
}

/**
 * Memeriksa penulisan nama dari beberapa sumber. Hanya USULAN; tidak ada yang ditulis ke mana pun.
 * `kamus` boleh kosong (aturan 1-3 tetap berjalan).
 */
export function periksaEjaan(sumber: SumberNama[], kamus: EntriKamus[] = []): UsulanEjaan[] {
  const usulan: UsulanEjaan[] = [];
  const unik: SumberNama[] = [];
  const lihat = new Set<string>();
  for (const s of sumber) {
    const k = `${s.asal}|${tulisanDasar(s.nama)}`;
    if (!lihat.has(k)) {
      lihat.add(k);
      unik.push(s);
    }
  }

  // Peta kamus: kunci rapat varian/baku -> baku
  const peta = new Map<string, string>();
  for (const e of kamus) {
    peta.set(kunciRapat(e.baku), e.baku);
    for (const v of e.varian) peta.set(kunciRapat(v), e.baku);
  }

  // 1-2. kelompokkan menurut kunci rapat
  const kelompok = new Map<string, SumberNama[]>();
  for (const s of unik) {
    const k = kunciRapat(s.nama);
    if (!k) continue;
    const a = kelompok.get(k) ?? [];
    a.push(s);
    kelompok.set(k, a);
  }
  for (const [kunci, daftar] of kelompok) {
    const tulisan = new Map<string, SumberNama[]>();
    for (const s of daftar) {
      const t = tulisanDasar(s.nama);
      const a = tulisan.get(t) ?? [];
      a.push(s);
      tulisan.set(t, a);
    }
    if (tulisan.size > 1) {
      const baku = peta.get(kunci);
      const palingBanyak = [...tulisan.values()].sort((a, b) => b.length - a.length)[0]![0]!.nama;
      usulan.push({
        jenis: "beda-ejaan",
        tingkat: "periksa",
        pesan: `Nama yang tampaknya sama ditulis dengan ejaan berbeda: ${daftar.map((d) => `${d.asal}: "${d.nama}"`).join("; ")}.`,
        nama: daftar,
        usulanBaku: baku ?? palingBanyak,
      });
    }
  }

  // 3. mirip antar kunci berbeda
  const kuncinya = [...kelompok.keys()];
  for (let i = 0; i < kuncinya.length; i += 1) {
    for (let j = i + 1; j < kuncinya.length; j += 1) {
      const a = kuncinya[i]!;
      const b = kuncinya[j]!;
      const batas = Math.min(batasMirip(a.length), batasMirip(b.length));
      if (batas > 0 && Math.abs(a.length - b.length) <= batas && jarakEdit(a, b) <= batas) {
        const na = kelompok.get(a)!;
        const nb = kelompok.get(b)!;
        usulan.push({
          jenis: "mirip",
          tingkat: "periksa",
          pesan: `Dua nama sangat mirip - salah ketik atau dua orang berbeda: ${[...na, ...nb].map((d) => `${d.asal}: "${d.nama}"`).join("; ")}.`,
          nama: [...na, ...nb],
          usulanBaku: peta.get(a) ?? peta.get(b) ?? "",
        });
      }
    }
  }

  // 4. kamus: penulisan yang bukan ejaan baku
  for (const s of unik) {
    const baku = peta.get(kunciRapat(s.nama));
    if (!baku) continue;
    if (tulisanDasar(s.nama) === tulisanDasar(baku)) continue;
    usulan.push({
      jenis: "alias",
      tingkat: "info",
      pesan: `${s.asal}: "${s.nama}" tercatat di kamus sebagai ejaan lain dari "${baku}".`,
      nama: [s],
      usulanBaku: baku,
    });
  }

  const urutan: Record<JenisUsulanEjaan, number> = { "beda-ejaan": 0, mirip: 1, alias: 2 };
  return usulan.sort((a, b) => urutan[a.jenis] - urutan[b.jenis]);
}

/** Memeriksa SATU nama terhadap kamus (mis. nama yang sedang diketik di formulir pihak SIPP). */
export function periksaSatuNama(nama: string, kamus: EntriKamus[] = []): UsulanEjaan[] {
  const r = bersihkanSumberNama([{ asal: "Formulir", nama }]);
  return r.length ? periksaEjaan(r, kamus).filter((u) => u.jenis === "alias") : [];
}
