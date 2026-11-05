/**
 * ============================================================================
 * ALETA ABT DI HP - hak membuka (keputusan pemilik aplikasi, 5 Nov 2026)
 * ============================================================================
 *
 * ALETA ABT boleh dibuka dari HP, diatur on/off per peran dan per pengguna di
 * pengaturan admin. Bawaan: Super Admin menyala, peran lain mati.
 *
 * Urutan: pengaturan PENGGUNA (menyala/mati) -> pengaturan PERAN -> bawaan.
 * Masukan rusak atau tidak terbaca selalu jatuh ke bawaan, tidak pernah ke
 * "menyala" bagi peran selain Super Admin.
 *
 * Aturan murni: tanpa SQL, tanpa jaringan. Penyimpanan ada di
 * server/modules/aleta-abt/hak-hp.ts.
 */

export const ID_APLIKASI_ALETA_ABT = "aleta-abt";
/** Kunci di aleta_ekstensi_setelan (pengguna_id "*sistem*"); tanpa migrasi. */
export const KUNCI_ABT_HP = "sistem:aleta-abt-hp";
export const PERAN_ABT_HP_BAWAAN_MENYALA: readonly string[] = ["super-admin"];

export const BATAS_PERAN_ABT_HP = 100;
export const BATAS_PENGGUNA_ABT_HP = 500;

export type PilihanPengguna = "ikuti" | "aktif" | "mati";
export type SumberHakAbtHp = "pengguna" | "peran" | "bawaan";

export type PengaturanAbtHp = {
  /** id peran -> menyala/mati; tidak ada = bawaan. */
  peran: Record<string, boolean>;
  /** id pengguna -> menyala/mati; tidak ada = ikut peran. */
  pengguna: Record<string, boolean>;
  diubahOleh: string;
  diubahPada: string;
};

export type HakAbtHp = { terbuka: boolean; sumber: SumberHakAbtHp };

const KUNCI_TERLARANG = new Set(["__proto__", "constructor", "prototype"]);
const POLA_ID = /^[\w.:@-]{1,80}$/;
const teks = (x: unknown) => String(x ?? "").trim();

export const pengaturanAbtHpKosong = (): PengaturanAbtHp => ({ peran: {}, pengguna: {}, diubahOleh: "", diubahPada: "" });

function bersihkanPeta(x: unknown, batas: number): Record<string, boolean> {
  const hasil: Record<string, boolean> = {};
  if (!x || typeof x !== "object" || Array.isArray(x)) return hasil;
  let n = 0;
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    const id = teks(k);
    if (typeof v !== "boolean" || KUNCI_TERLARANG.has(id) || !POLA_ID.test(id)) continue;
    if (n >= batas) break;
    hasil[id] = v;
    n += 1;
  }
  return hasil;
}

/** Bentuk tersimpan yang sah. Apa pun yang tidak terbaca menjadi pengaturan kosong (= bawaan). */
export function bersihkanPengaturanAbtHp(mentah: unknown): PengaturanAbtHp {
  let isi = mentah;
  if (typeof isi === "string") {
    try {
      isi = JSON.parse(isi);
    } catch {
      return pengaturanAbtHpKosong();
    }
  }
  if (!isi || typeof isi !== "object" || Array.isArray(isi)) return pengaturanAbtHpKosong();
  const o = isi as Record<string, unknown>;
  return {
    peran: bersihkanPeta(o.peran, BATAS_PERAN_ABT_HP),
    pengguna: bersihkanPeta(o.pengguna, BATAS_PENGGUNA_ABT_HP),
    diubahOleh: teks(o.diubahOleh).slice(0, 200),
    diubahPada: teks(o.diubahPada).slice(0, 40),
  };
}

/** Bawaan satu peran: hanya Super Admin menyala. */
export const bawaanPeranAbtHp = (roleId: unknown): boolean => PERAN_ABT_HP_BAWAAN_MENYALA.includes(teks(roleId));

const punya = (peta: Record<string, boolean>, id: string) => id !== "" && Object.prototype.hasOwnProperty.call(peta, id);

/** Hak peran saja (pengaturan peran, lalu bawaan) - dipakai layar admin untuk baris peran. */
export function hakPeranAbtHp(roleId: unknown, pengaturan: unknown): HakAbtHp {
  const id = teks(roleId);
  const p = bersihkanPengaturanAbtHp(pengaturan);
  if (punya(p.peran, id)) return { terbuka: p.peran[id], sumber: "peran" };
  return { terbuka: bawaanPeranAbtHp(id), sumber: "bawaan" };
}

/**
 * Hak efektif sebuah akun: pengguna -> peran -> bawaan.
 * `pengaturan` boleh berupa objek, teks JSON, atau apa saja (rusak = bawaan).
 */
export function hakAbtHp(akun: { roleId?: unknown; userId?: unknown } | null | undefined, pengaturan: unknown): HakAbtHp {
  const roleId = teks(akun?.roleId);
  const p = bersihkanPengaturanAbtHp(pengaturan);
  const userId = teks(akun?.userId);
  if (punya(p.pengguna, userId)) return { terbuka: p.pengguna[userId], sumber: "pengguna" };
  return hakPeranAbtHp(roleId, p);
}

export function pilihanPenggunaAbtHp(userId: unknown, pengaturan: unknown): PilihanPengguna {
  const p = bersihkanPengaturanAbtHp(pengaturan);
  const id = teks(userId);
  if (!punya(p.pengguna, id)) return "ikuti";
  return p.pengguna[id] ? "aktif" : "mati";
}

export type UbahanAbtHp =
  | { jenis: "peran"; id: string; nilai: boolean | "bawaan" }
  | { jenis: "pengguna"; id: string; nilai: PilihanPengguna };

/** Terapkan satu ubahan; hasilnya salinan baru. Ubahan tak sah dilempar sebagai Error (rute mengubahnya jadi 400). */
export function terapkanUbahanAbtHp(pengaturan: unknown, ubahan: UbahanAbtHp, oleh: string, pada: string): PengaturanAbtHp {
  const p = bersihkanPengaturanAbtHp(pengaturan);
  const id = teks(ubahan.id);
  if (!POLA_ID.test(id) || KUNCI_TERLARANG.has(id)) throw new Error("Peran atau pengguna tidak dikenal.");
  if (ubahan.jenis === "peran") {
    if (ubahan.nilai === "bawaan") delete p.peran[id];
    else if (typeof ubahan.nilai === "boolean") {
      if (!punya(p.peran, id) && Object.keys(p.peran).length >= BATAS_PERAN_ABT_HP) throw new Error("Terlalu banyak peran tersimpan.");
      p.peran[id] = ubahan.nilai;
    } else throw new Error("Pilihan peran tidak sah.");
  } else if (ubahan.jenis === "pengguna") {
    if (ubahan.nilai === "ikuti") delete p.pengguna[id];
    else if (ubahan.nilai === "aktif" || ubahan.nilai === "mati") {
      if (!punya(p.pengguna, id) && Object.keys(p.pengguna).length >= BATAS_PENGGUNA_ABT_HP) throw new Error("Terlalu banyak pengguna tersimpan.");
      p.pengguna[id] = ubahan.nilai === "aktif";
    } else throw new Error("Pilihan pengguna tidak sah.");
  } else throw new Error("Jenis ubahan tidak dikenal.");
  return { ...p, diubahOleh: teks(oleh).slice(0, 200), diubahPada: teks(pada).slice(0, 40) };
}

/**
 * Menu portal "ALETA ABT": `tampil` = aplikasi yang lolos penyaring peran (matriks + Akses Menu),
 * `semua` = seluruh aplikasi portal. Hak server `terbuka` (null = belum diketahui) menentukan:
 *   - belum diketahui: ikut penyaring peran (hanya Super Admin);
 *   - diketahui: menu ada bila terbuka, juga untuk peran lain yang menyalanya; urutan mengikuti `semua`.
 */
export function terapkanMenuAletaAbt<T extends { id: string }>(tampil: readonly T[], semua: readonly T[], terbuka: boolean | null): T[] {
  const ada = new Set(tampil.map((a) => a.id));
  return semua.filter((a) => (a.id === ID_APLIKASI_ALETA_ABT ? (terbuka === null ? ada.has(a.id) : terbuka) : ada.has(a.id)));
}

/** Alamat beranda ABT yang membuka panel Blangko ABT by Derry Briantono (sama dengan alamatAletaAbt() di ekstensi). */
export function alamatPanelAbt(lokasi: { protocol: string; hostname: string; origin: string }): string {
  const lokal = /^(127\.0\.0\.1|localhost)$/.test(String(lokasi.hostname || ""));
  const asal = lokal ? lokasi.origin : `${lokasi.protocol}//${lokasi.hostname}`;
  return `${asal}/aps_badilag/abt/main/beranda#aleta-derry=1`;
}

/** Penanda di alamat halaman /aleta-abt yang dipasang ubin ALETA ABT di menu APS (lihat ekstensi-sipp/aps-beranda.js). */
export const DARI_UBIN_APS = "aps";
/** Jalur kembali yang dikirim ubin ke layar masuk; di dalam portal, lolos tujuanKembaliAman. */
export const KEMBALI_DARI_UBIN_APS = `/${ID_APLIKASI_ALETA_ABT}?dari=${DARI_UBIN_APS}`;

const GOLONGAN_BLANGKO_DERRY = ["admin", "hakim", "ketua", "pp", "panitera", "panmud", "panitera-utama", "analis", "jurusita", "ptsp"];

/**
 * Hak membuka Blangko ABT by Derry Briantono di ABT (bukan hak HP): aturan yang sama dengan ubin APS
 * (aps-beranda.js boleh) dan butir "ABT By Derry" bilah SIPP. `siapa` = jawaban /api/aleta-ecourt/ekstensi/siapa.
 */
export function bolehBlangkoDerry(siapa: unknown): boolean {
  if (!siapa || typeof siapa !== "object") return false;
  const s = siapa as { roleId?: unknown; golonganMenu?: unknown };
  const roleId = String(s.roleId ?? "").toLowerCase();
  if (roleId === "super-admin" || roleId === "admin") return true;
  const golongan = Array.isArray(s.golonganMenu) ? s.golonganMenu.map((g) => String(g ?? "").toLowerCase()) : [];
  return golongan.some((g) => GOLONGAN_BLANGKO_DERRY.includes(g));
}
