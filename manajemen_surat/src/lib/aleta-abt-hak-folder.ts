import { GOLONGAN_PERAN, LABEL_GOLONGAN, type GolonganPeran } from "@/lib/matriks-peran";

/**
 * ============================================================================
 * HAK PER FOLDER BLANGKO ALETA ABT (5 Nov 2026, Tahap 6) - aturan murni, tanpa SQL, tanpa jaringan
 * ============================================================================
 *
 * Hak meniru logika ABT (Abt.php, Abt_model.php; baris abt_menu), satu acuan per FOLDER, ditambah peran ALETA:
 *   - tahapan   : perkara.proses_terakhir_id harus berada di proses_id_min..proses_id_max;
 *   - jenis     : jenis_perkara_id ATAU alur_perkara_id (perkara_id_referensi) harus berada di perkara_id_min..perkara_id_max;
 *   - peran     : user_grup_id (grup SIPP/ABT yang membuka folder), user_top_id (selalu boleh), user_validator (validasi BAS);
 *   - penunjukan: user_cek 1 atau 3 = grup DAN ditunjuk di perkara; 2 = grup ATAU ditunjuk; 0 = grup saja.
 *   - grup 1 (Super Administrator) melewati cek tahapan di ABT.
 * Grup SIPP/ABT dipetakan ke golongan peran ALETA (matriks-peran). Pemetaan yang tidak pasti ditandai ragu.
 *
 * MATRIKS BELUM BERLAKU sebelum disetujui pemilik (saklar persetujuan bawaan mati, terikat pada sidik isi matriks).
 * Tidak ada yang berubah bagi petugas: Blangko ABT by Derry Briantono tetap memakai hak ABT sendiri.
 * Berkas ini tidak menulis apa pun dan tidak membaca data pihak.
 */

export type TingkatHak = "bebas" | "ditunjuk" | "validasi" | "tidak";

/** Urutan kekuatan: bebas > ditunjuk > validasi > tidak. */
const KUAT: Record<TingkatHak, number> = { bebas: 3, ditunjuk: 2, validasi: 1, tidak: 0 };

/** Nama grup SIPP/ABT yang muncul di abt_menu (sys_groups). Hanya acuan nama; bukan data pegawai. */
export const NAMA_GRUP_ABT: Record<number, string> = {
  [-1]: "Tidak ada (dikosongkan)",
  1: "Super Administrator",
  2: "Administrator",
  10: "Ketua/Wakil Ketua",
  20: "Hakim",
  30: "Panitera/Wakil Panitera",
  410: "Panmud Perdata",
  411: "Admin Panitera Perdata Umum",
  412: "Meja I Perdata",
  413: "Meja II Perdata",
  414: "Meja III Perdata",
  420: "Panmud Pidana",
  421: "Admin Panitera Pidana Umum",
  422: "Meja I Pidana",
  423: "Meja II Pidana",
  430: "Panmud Hukum",
  431: "Staf Panitera Hukum",
  440: "Panitera Muda PHI",
  500: "Panitera Pengganti",
  600: "Jurusita",
  650: "Koordinator Delegasi",
  700: "Bagian Keuangan",
  701: "Staf Bagian Keuangan",
  702: "Kasir",
  800: "Bagian Umum",
  801: "Staf Bagian Umum",
  802: "Meja Informasi",
  900: "Bagian Kepegawaian",
  901: "Staf Bagian Kepegawaian",
  1000: "Panmud Gugatan",
  1001: "Meja I Gugatan",
  1002: "Meja II Gugatan",
  1003: "Meja III Gugatan",
  1010: "Panmud Permohonan",
  1011: "Meja I Permohonan",
  1012: "Meja II Permohonan",
  1013: "Meja III Permohonan",
  1020: "Panmud Jinayat",
  1030: "Panmud Perkara",
  1031: "Admin Panitera Perkara",
  1032: "Meja I Perkara",
  1033: "Meja II Perkara",
  1034: "Meja III Perkara",
};

type Padanan = { golongan: GolonganPeran; ragu?: string };

/** Grup ABT -> golongan ALETA. Padanan yang bukan jabatan yang sama persis membawa alasan ragu. */
export const GRUP_KE_GOLONGAN: Record<number, Padanan> = {
  1: { golongan: "super-admin" },
  2: { golongan: "admin" },
  10: { golongan: "pimpinan" },
  20: { golongan: "hakim" },
  30: { golongan: "panitera" },
  410: { golongan: "panmud" },
  420: { golongan: "panmud" },
  430: { golongan: "panmud" },
  431: { golongan: "panmud", ragu: "Staf Panitera Hukum disamakan dengan Panitera Muda" },
  440: { golongan: "panmud" },
  1000: { golongan: "panmud" },
  1010: { golongan: "panmud" },
  1020: { golongan: "panmud" },
  1030: { golongan: "panmud" },
  500: { golongan: "pp" },
  600: { golongan: "jurusita" },
  650: { golongan: "jurusita", ragu: "Koordinator Delegasi disamakan dengan Jurusita" },
  702: { golongan: "kasir" },
  700: { golongan: "sekretariat", ragu: "Bagian Keuangan disamakan dengan Kesekretariatan" },
  701: { golongan: "sekretariat", ragu: "Staf Bagian Keuangan disamakan dengan Kesekretariatan" },
  800: { golongan: "sekretariat" },
  801: { golongan: "sekretariat" },
  900: { golongan: "sekretariat" },
  901: { golongan: "sekretariat" },
  802: { golongan: "ptsp" },
  412: { golongan: "ptsp", ragu: "Meja I disamakan dengan PTSP" },
  422: { golongan: "ptsp", ragu: "Meja I disamakan dengan PTSP" },
  1001: { golongan: "ptsp", ragu: "Meja I disamakan dengan PTSP" },
  1011: { golongan: "ptsp", ragu: "Meja I disamakan dengan PTSP" },
  1032: { golongan: "ptsp", ragu: "Meja I disamakan dengan PTSP" },
  411: { golongan: "analis-perkara", ragu: "Admin Panitera disamakan dengan Analis Perkara" },
  421: { golongan: "analis-perkara", ragu: "Admin Panitera disamakan dengan Analis Perkara" },
  1031: { golongan: "analis-perkara", ragu: "Admin Panitera disamakan dengan Analis Perkara" },
  413: { golongan: "analis-perkara", ragu: "Meja II/III disamakan dengan Analis Perkara" },
  414: { golongan: "analis-perkara", ragu: "Meja II/III disamakan dengan Analis Perkara" },
  423: { golongan: "analis-perkara", ragu: "Meja II/III disamakan dengan Analis Perkara" },
  1002: { golongan: "analis-perkara", ragu: "Meja II/III disamakan dengan Analis Perkara" },
  1003: { golongan: "analis-perkara", ragu: "Meja II/III disamakan dengan Analis Perkara" },
  1012: { golongan: "analis-perkara", ragu: "Meja II/III disamakan dengan Analis Perkara" },
  1013: { golongan: "analis-perkara", ragu: "Meja II/III disamakan dengan Analis Perkara" },
  1033: { golongan: "analis-perkara", ragu: "Meja II/III disamakan dengan Analis Perkara" },
  1034: { golongan: "analis-perkara", ragu: "Meja II/III disamakan dengan Analis Perkara" },
};

/** Golongan ALETA yang tidak punya padanan grup di ABT: haknya "tidak diberi" sampai pemilik memutuskan lain. */
export const GOLONGAN_TANPA_GRUP_ABT: readonly GolonganPeran[] = GOLONGAN_PERAN.filter(
  (g) => !Object.values(GRUP_KE_GOLONGAN).some((p) => p.golongan === g)
);

// ---------------------------------------------------------------------------------------------------------------
// Baris menu
// ---------------------------------------------------------------------------------------------------------------

export type BarisMenu = {
  /** abt_menu.direktori: nama folder. */
  id: string;
  nama: string;
  namaAlias: string;
  parent: string;
  grup: number[];
  top: number[];
  validator: number[];
  /** Isi mentah user_grup_id ada tetapi tidak terbaca sebagai angka (tidak dihitung). */
  grupTakTerbaca: string[];
  cek: number;
  prosesMin: number | null;
  prosesMax: number | null;
  perkaraMin: number | null;
  perkaraMax: number | null;
  referensi: "jenis_perkara_id" | "alur_perkara_id" | "";
  aktif: boolean;
};

const angkaAtauNull = (x: unknown): number | null => {
  if (x === null || x === undefined || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};

/** "1|10|20" -> [1, 10, 20]; kosong/NULL -> []. Bagian yang bukan angka dikembalikan di `taksah`. */
export function daftarAngka(x: unknown): { angka: number[]; taksah: string[] } {
  const angka: number[] = [];
  const taksah: string[] = [];
  for (const b of String(x ?? "").split("|")) {
    const t = b.trim();
    if (!t || t.toUpperCase() === "NULL") continue;
    if (/^-?\d+$/.test(t)) angka.push(Number(t));
    else taksah.push(t);
  }
  return { angka, taksah };
}

export function barisMenuDari(m: Record<string, unknown>): BarisMenu {
  const g = daftarAngka(m.user_grup_id ?? m.userGrupId);
  const ref = String(m.perkara_id_referensi ?? m.perkaraIdReferensi ?? "").trim();
  return {
    id: String(m.direktori ?? m.id ?? "").trim(),
    nama: String(m.nama ?? "").trim(),
    namaAlias: String(m.nama_alias ?? m.namaAlias ?? "").trim(),
    parent: String(m.parent_direktori ?? m.parent ?? "").trim(),
    grup: g.angka,
    top: daftarAngka(m.user_top_id ?? m.userTopId).angka,
    validator: daftarAngka(m.user_validator ?? m.userValidator).angka,
    grupTakTerbaca: g.taksah,
    cek: Number(m.user_cek ?? m.userCek) || 0,
    prosesMin: angkaAtauNull(m.proses_id_min ?? m.prosesIdMin),
    prosesMax: angkaAtauNull(m.proses_id_max ?? m.prosesIdMax),
    perkaraMin: angkaAtauNull(m.perkara_id_min ?? m.perkaraIdMin),
    perkaraMax: angkaAtauNull(m.perkara_id_max ?? m.perkaraIdMax),
    referensi: ref === "jenis_perkara_id" || ref === "alur_perkara_id" ? ref : "",
    aktif: String(m.status ?? "aktif") !== "hilang",
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Hak satu golongan atas satu folder
// ---------------------------------------------------------------------------------------------------------------

function grupDariGolongan(golongan: GolonganPeran): number[] {
  return Object.entries(GRUP_KE_GOLONGAN)
    .filter(([, p]) => p.golongan === golongan)
    .map(([g]) => Number(g));
}

/**
 * Tingkat hak sebuah golongan atas baris menu:
 *   bebas    - grupnya terdaftar (atau di user_top_id) dan tidak perlu ditunjuk di perkara;
 *   ditunjuk - boleh hanya bila ditunjuk di perkara itu (user_cek 1/3, atau 2 untuk grup di luar daftar);
 *   validasi - hanya untuk memvalidasi BAS (user_validator), belum tentu boleh membuka isinya;
 *   tidak    - tidak diberi.
 * Super Admin: bebas, melewati cek tahapan (seperti grup 1 di ABT).
 */
export function tingkatHak(baris: BarisMenu, golongan: GolonganPeran): TingkatHak {
  if (golongan === "super-admin") return "bebas";
  const grupnya = grupDariGolongan(golongan);
  const pegang = (daftar: number[]) => grupnya.some((g) => daftar.includes(g));
  if (pegang(baris.top)) return "bebas";
  if (pegang(baris.grup)) return baris.cek === 1 || baris.cek === 3 ? "ditunjuk" : "bebas";
  if (baris.cek === 2 && grupnya.length > 0) return "ditunjuk";
  if (pegang(baris.validator)) return "validasi";
  return "tidak";
}

export const NAMA_TINGKAT: Record<TingkatHak, string> = {
  bebas: "boleh",
  ditunjuk: "boleh bila ditunjuk di perkara",
  validasi: "hanya memvalidasi BAS",
  tidak: "tidak diberi",
};

/** Gabungan golongan satu orang: tingkat tertinggi. */
export function tingkatHakGabungan(baris: BarisMenu, golongan: readonly GolonganPeran[]): TingkatHak {
  let terbaik: TingkatHak = "tidak";
  for (const g of golongan) {
    const t = tingkatHak(baris, g);
    if (KUAT[t] > KUAT[terbaik]) terbaik = t;
  }
  return terbaik;
}

// ---------------------------------------------------------------------------------------------------------------
// Tahapan dan jenis
// ---------------------------------------------------------------------------------------------------------------

/** Titik proses SIPP yang dikenal (untuk menulis rentang tahapan dengan kata sehari-hari). */
const TITIK_PROSES: Array<[number, string]> = [
  [10, "pendaftaran"],
  [20, "penetapan majelis"],
  [30, "penunjukan panitera pengganti"],
  [40, "penunjukan jurusita"],
  [80, "penetapan hari sidang"],
  [120, "mediasi"],
  [200, "persidangan"],
  [210, "putusan"],
  [220, "minutasi"],
  [240, "verzet dan keberatan"],
  [290, "ikrar talak"],
  [296, "akta cerai"],
  [300, "banding"],
  [410, "kasasi"],
  [510, "peninjauan kembali"],
  [600, "eksekusi"],
];

function namaProses(n: number): string {
  let hasil = "";
  for (const [batas, nama] of TITIK_PROSES) if (n >= batas) hasil = nama;
  return hasil || `proses ${n}`;
}

export function labelTahapan(b: Pick<BarisMenu, "prosesMin" | "prosesMax">): string {
  const { prosesMin: a, prosesMax: z } = b;
  if (a === null || z === null) return "tahapan tidak dibatasi";
  if (a <= 0 && z >= 1000) return "semua tahapan";
  const dari = namaProses(a);
  const sampai = namaProses(z);
  return dari === sampai ? `${dari} (proses ${a}-${z})` : `${dari} sampai ${sampai} (proses ${a}-${z})`;
}

const NAMA_JENIS: Record<number, string> = {
  341: "izin poligami",
  342: "pencegahan perkawinan",
  343: "penolakan perkawinan",
  344: "pembatalan perkawinan",
  345: "kelalaian kewajiban suami istri",
  346: "cerai talak",
  347: "cerai gugat",
  348: "harta bersama",
  349: "penguasaan anak",
  350: "nafkah anak oleh ibu",
  351: "hak bekas istri",
  352: "pengesahan anak",
  353: "pencabutan kekuasaan orang tua",
  354: "perwalian",
  355: "pencabutan kekuasaan wali",
  356: "penunjukan wali",
  357: "ganti rugi terhadap wali",
  358: "asal usul anak",
  359: "perkawinan campuran",
  360: "itsbat nikah",
  361: "izin kawin",
  362: "dispensasi kawin",
  363: "wali adhal",
  364: "kewarisan",
  365: "wasiat",
  366: "hibah",
  367: "wakaf",
  369: "lain-lain",
  370: "ekonomi syariah",
  371: "penetapan ahli waris",
  743: "nafkah anak",
};
const NAMA_ALUR: Record<number, string> = { 15: "gugatan", 16: "permohonan", 17: "gugatan sederhana" };

export function labelJenis(b: Pick<BarisMenu, "perkaraMin" | "perkaraMax" | "referensi">): string {
  const { perkaraMin: a, perkaraMax: z, referensi } = b;
  if (!referensi || a === null || z === null) return "semua jenis perkara";
  const kamus = referensi === "jenis_perkara_id" ? NAMA_JENIS : NAMA_ALUR;
  const sebut = (n: number) => kamus[n] ?? (referensi === "jenis_perkara_id" ? `jenis ${n}` : `alur ${n}`);
  return a === z ? sebut(a) : `${sebut(a)} sampai ${sebut(z)}`;
}

export type KeadaanPerkara = { prosesId?: number | null; jenisPerkaraId?: number | null; alurPerkaraId?: number | null };

export type HasilTahapan = { sesuai: boolean | null; alasan: string };

/** Apakah perkara berada di tahapan dan jenis yang dibuka folder ini. null = keadaan perkara belum diketahui (tidak ditebak). */
export function periksaTahapan(baris: BarisMenu, p: KeadaanPerkara): HasilTahapan {
  if (baris.prosesMin !== null && baris.prosesMax !== null && !(baris.prosesMin <= 0 && baris.prosesMax >= 1000)) {
    if (p.prosesId === null || p.prosesId === undefined) return { sesuai: null, alasan: "Tahapan perkara belum diketahui." };
    if (p.prosesId < baris.prosesMin || p.prosesId > baris.prosesMax) {
      return { sesuai: false, alasan: `Folder ini dibuka ABT pada tahapan ${labelTahapan(baris)}; perkara berada di proses ${p.prosesId}.` };
    }
  }
  if (baris.referensi && baris.perkaraMin !== null && baris.perkaraMax !== null) {
    const nilai = baris.referensi === "jenis_perkara_id" ? p.jenisPerkaraId : p.alurPerkaraId;
    if (nilai === null || nilai === undefined) return { sesuai: null, alasan: "Jenis perkara belum diketahui." };
    if (nilai < baris.perkaraMin || nilai > baris.perkaraMax) return { sesuai: false, alasan: `Folder ini untuk ${labelJenis(baris)}, bukan jenis perkara ini.` };
  }
  return { sesuai: true, alasan: "" };
}

export type HasilHakFolder = { boleh: boolean | null; tingkat: TingkatHak | null; perluDitunjuk: boolean; alasan: string };

/**
 * Putusan hak runtime atas satu folder untuk orang bergolongan tertentu.
 * `baris` null = folder tanpa baris menu (hak tidak diketahui: tidak ditebak). `ditunjuk` null = belum diketahui.
 * Hanya dipakai bila matriks sudah disetujui; pemanggil yang memeriksa persetujuan.
 */
export function periksaHakFolder(baris: BarisMenu | null, golongan: readonly GolonganPeran[], opsi: { ditunjuk?: boolean | null } = {}): HasilHakFolder {
  if (!baris) return { boleh: null, tingkat: null, perluDitunjuk: false, alasan: "Folder ini belum punya aturan hak." };
  const t = tingkatHakGabungan(baris, golongan);
  if (t === "tidak") return { boleh: false, tingkat: t, perluDitunjuk: false, alasan: "Peran ini tidak diberi hak atas folder ini." };
  if (t === "validasi") return { boleh: false, tingkat: t, perluDitunjuk: false, alasan: "Peran ini hanya memvalidasi BAS, tidak membuka folder." };
  if (t === "ditunjuk") {
    if (opsi.ditunjuk === true) return { boleh: true, tingkat: t, perluDitunjuk: true, alasan: "" };
    if (opsi.ditunjuk === false) return { boleh: false, tingkat: t, perluDitunjuk: true, alasan: "Folder ini hanya untuk yang ditunjuk di perkara itu." };
    return { boleh: null, tingkat: t, perluDitunjuk: true, alasan: "Penunjukan di perkara belum diketahui." };
  }
  return { boleh: true, tingkat: t, perluDitunjuk: false, alasan: "" };
}

// ---------------------------------------------------------------------------------------------------------------
// Matriks
// ---------------------------------------------------------------------------------------------------------------

export const INDUK_FOLDER_DERRY = ["derry_briantono", "_arsip_derry_briantono"] as const;

export type FolderPustaka = { folder: string; arsip: boolean };

export type BarisMatriks = {
  folder: string;
  nama: string;
  /** true bila ada baris menu untuk folder ini. */
  adaMenu: boolean;
  arsip: boolean;
  tahapan: string;
  jenis: string;
  penunjukan: string;
  hak: Record<GolonganPeran, TingkatHak>;
  /** Grup ABT yang membuka folder ini, dengan namanya (untuk ditelusuri pemilik). */
  grup: string[];
  /** Alasan folder ini ragu; kosong = tidak ragu. */
  ragu: string[];
};

export type Matriks = {
  baris: BarisMatriks[];
  golongan: GolonganPeran[];
  jumlahFolder: number;
  jumlahRagu: number;
  /** Golongan yang tidak punya padanan grup ABT (semuanya "tidak diberi"). */
  tanpaPadananAbt: GolonganPeran[];
  sidik: string;
};

const PENUNJUKAN: Record<number, string> = {
  0: "tanpa penunjukan",
  1: "harus ditunjuk di perkara",
  2: "ditunjuk atau berperan",
  3: "harus ditunjuk di perkara",
};

/** Sidik FNV-1a 32-bit atas teks; dipakai mengikat persetujuan pada isi matriks yang dilihat pemilik. */
export function sidikTeks(teks: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < teks.length; i += 1) {
    h ^= teks.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function alasanRagu(b: BarisMenu | null, folder: FolderPustaka | null, menuGanda: boolean): string[] {
  const r: string[] = [];
  if (!b) {
    r.push("Tidak ada baris menu di ABT untuk folder ini, jadi siapa yang berhak tidak diketahui.");
    return r;
  }
  if (!b.aktif) r.push("Baris menu sudah hilang dari ABT.");
  if (menuGanda) r.push("Nama folder ini dipakai lebih dari satu baris menu.");
  if (!INDUK_FOLDER_DERRY.includes(b.parent as (typeof INDUK_FOLDER_DERRY)[number])) r.push(`Folder berada di bawah "${b.parent || "tanpa induk"}", bukan di bawah blangko Derry.`);
  if (b.parent === "_arsip_derry_briantono" || folder?.arsip) r.push("Folder arsip: hak masih tertulis di ABT, padahal blangkonya sudah tidak dipakai.");
  if (b.grup.length === 0 || (b.grup.length === 1 && b.grup[0] === -1)) r.push("Daftar peran yang berhak kosong atau -1.");
  if (b.grupTakTerbaca.length) r.push(`Ada peran yang tidak terbaca: ${b.grupTakTerbaca.join(", ")}.`);
  const tak = [...b.grup, ...b.top, ...b.validator].filter((g) => g >= 0 && !(g in GRUP_KE_GOLONGAN));
  if (tak.length) r.push(`Peran ABT tanpa padanan di ALETA: ${[...new Set(tak)].map((g) => NAMA_GRUP_ABT[g] ?? `grup ${g}`).join(", ")}.`);
  const ragus = [...new Set([...b.grup, ...b.top].map((g) => GRUP_KE_GOLONGAN[g]?.ragu).filter(Boolean))] as string[];
  if (ragus.length) r.push(`Padanan peran dikira-kira: ${ragus.join("; ")}.`);
  if (b.prosesMin !== null && b.prosesMax !== null && b.prosesMin > b.prosesMax) r.push("Rentang tahapan terbalik (awal lebih besar dari akhir).");
  if (b.referensi && b.perkaraMin !== null && b.perkaraMax !== null && b.perkaraMin > b.perkaraMax) r.push("Rentang jenis perkara terbalik.");
  if (!b.referensi && b.perkaraMin !== null) r.push("Rentang jenis perkara ada tetapi acuannya (jenis atau alur) kosong.");
  return r;
}

/**
 * Menyusun matriks hak. `folderPustaka` = folder blangko Derry yang ada di pustaka ALETA; baris menu Derry yang tidak punya
 * folder tetap ikut (folder kosong). Folder tanpa baris menu ikut dan ditandai ragu.
 */
export function susunMatriks(menu: readonly BarisMenu[], folderPustaka: readonly FolderPustaka[]): Matriks {
  const kunci = (s: string) => s.trim().toLowerCase();
  const menuDerry = menu.filter((m) => INDUK_FOLDER_DERRY.includes(m.parent as (typeof INDUK_FOLDER_DERRY)[number]));
  const hitung = new Map<string, number>();
  for (const m of menuDerry) hitung.set(kunci(m.id), (hitung.get(kunci(m.id)) ?? 0) + 1);
  const menuPer = new Map<string, BarisMenu>();
  for (const m of menuDerry) if (!menuPer.has(kunci(m.id))) menuPer.set(kunci(m.id), m);
  const folderPer = new Map<string, FolderPustaka>();
  for (const f of folderPustaka) if (f.folder.trim() && !folderPer.has(kunci(f.folder))) folderPer.set(kunci(f.folder), f);

  const semua = new Set<string>([...menuPer.keys(), ...folderPer.keys()]);
  const golongan: GolonganPeran[] = [...GOLONGAN_PERAN];
  const baris: BarisMatriks[] = [];
  for (const k of [...semua].sort((a, b) => a.localeCompare(b, "id", { numeric: true }))) {
    const m = menuPer.get(k) ?? null;
    const f = folderPer.get(k) ?? null;
    const hak = Object.fromEntries(golongan.map((g) => [g, m ? tingkatHak(m, g) : ("tidak" as TingkatHak)])) as Record<GolonganPeran, TingkatHak>;
    const gr = m ? [...new Set([...m.grup, ...m.top])].filter((g) => g >= 0).map((g) => NAMA_GRUP_ABT[g] ?? `grup ${g}`) : [];
    baris.push({
      folder: m?.id ?? f?.folder ?? k,
      nama: m?.nama ?? "",
      adaMenu: Boolean(m),
      arsip: Boolean(f?.arsip) || m?.parent === "_arsip_derry_briantono",
      tahapan: m ? labelTahapan(m) : "tidak diketahui",
      jenis: m ? labelJenis(m) : "tidak diketahui",
      penunjukan: m ? (PENUNJUKAN[m.cek] ?? `kode ${m.cek}`) : "tidak diketahui",
      hak,
      grup: gr,
      ragu: alasanRagu(m, f, (hitung.get(k) ?? 0) > 1),
    });
  }
  const sidik = sidikTeks(JSON.stringify(baris.map((b) => [b.folder, b.hak, b.tahapan, b.jenis, b.penunjukan, b.ragu.length > 0])));
  return {
    baris,
    golongan,
    jumlahFolder: baris.length,
    jumlahRagu: baris.filter((b) => b.ragu.length > 0).length,
    tanpaPadananAbt: [...GOLONGAN_TANPA_GRUP_ABT],
    sidik,
  };
}

export const labelGolongan = (g: GolonganPeran) => LABEL_GOLONGAN[g];

/** Golongan yang punya hak (selain "tidak") atas sedikitnya satu folder - kolom yang layak ditampilkan. */
export function golonganBerhak(m: Matriks): GolonganPeran[] {
  return m.golongan.filter((g) => m.baris.some((b) => b.hak[g] !== "tidak"));
}
