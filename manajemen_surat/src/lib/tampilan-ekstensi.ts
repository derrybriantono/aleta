import { DAFTAR_FITUR_EKSTENSI, KODE_FITUR_EKSTENSI } from "@/lib/daftar-fitur-ekstensi";

/**
 * ============================================================================
 * TAMPILAN EKSTENSI YANG DITERAPKAN - ATURAN MURNI
 * ============================================================================
 *
 * Tahap 5 rencana "ekstensi dulu". Super Admin mencoba tampilan Lama / Baru /
 * UI Baru dan 120 saklar fitur di PC-nya sendiri (mode coba), lalu dapat
 * MENERAPKAN pilihannya kepada semua pegawai, satu peran, atau satu orang.
 *
 * Berkas ini hanya memuat aturan tanpa basis data - dipakai modul server
 * (src/server/modules/aleta-ecourt/tampilan-ekstensi.ts) dan diuji langsung.
 * Tidak ada SQL di sini.
 *
 * ============================================================================
 * YANG DITERAPKAN BUKAN MODE COBA
 * ============================================================================
 *
 * Mode coba ada karena Super Admin sedang MENCOBA: tulisannya ditahan supaya
 * percobaan tidak meninggalkan jejak di SIPP, ABT, atau portal. Tampilan yang
 * diterapkan sudah diputuskan; pegawai yang menerimanya bekerja sungguhan dan
 * tulisannya tidak boleh ditahan. Karena itu jawaban ke ekstensi membawa
 * `diterapkan: true` - dan ekstensi tidak menyalakan mode coba untuknya.
 */

export const MODE_TAMPILAN = ["lama", "baru", "ui"] as const;
export type ModeTampilan = (typeof MODE_TAMPILAN)[number];

export const LINGKUP_TAMPILAN = ["semua", "peran", "pengguna"] as const;
export type LingkupTampilan = (typeof LINGKUP_TAMPILAN)[number];

/** Nama tampilan di layar - sama dengan tombol di popup ekstensi. */
export const LABEL_MODE_TAMPILAN: Record<ModeTampilan, string> = {
  lama: "Lama",
  baru: "Baru",
  ui: "UI Baru",
};

export function modeTampilanSah(x: unknown): x is ModeTampilan {
  return typeof x === "string" && (MODE_TAMPILAN as readonly string[]).includes(x);
}

export function lingkupTampilanSah(x: unknown): x is LingkupTampilan {
  return typeof x === "string" && (LINGKUP_TAMPILAN as readonly string[]).includes(x);
}

/**
 * Hanya kode yang dikenal, hanya yang MENYALA, dalam urutan daftar.
 *
 * Nilai selain `true` - false, "true", 1 - dianggap mati. Saklar yang mati
 * tidak disimpan: bawaan setiap saklar memang mati, dan menyimpan `false`
 * hanya menambah baris yang tidak mengubah apa pun. Kode yang tidak dikenal
 * dibuang, supaya kode yatim tidak menyala diam-diam bila kelak dipakai lagi
 * untuk ide yang lain.
 */
export function bersihkanFitur(masukan: unknown): Record<string, true> {
  const hasil: Record<string, true> = {};
  if (!masukan || typeof masukan !== "object" || Array.isArray(masukan)) return hasil;
  const peta = masukan as Record<string, unknown>;
  for (const fitur of DAFTAR_FITUR_EKSTENSI) {
    if (peta[fitur.kode] === true) hasil[fitur.kode] = true;
  }
  return hasil;
}

/** Kode dalam masukan yang tidak dikenal - untuk dilaporkan, bukan disimpan. */
export function fiturTakDikenal(masukan: unknown): string[] {
  if (!masukan || typeof masukan !== "object" || Array.isArray(masukan)) return [];
  return Object.keys(masukan as Record<string, unknown>).filter((k) => !KODE_FITUR_EKSTENSI.has(k));
}

export type PenerapanTampilan = {
  lingkup: LingkupTampilan;
  /** '' untuk semua, kunci peran untuk peran, id pengguna untuk pengguna. */
  sasaran: string;
  mode: ModeTampilan;
  fitur: Record<string, true>;
  catatan: string;
  diubahOleh: string;
  diubahPada: string;
};

export type SumberTampilan = "pengguna" | "peran" | "semua" | "bawaan";

export type TampilanBerlaku = {
  mode: ModeTampilan;
  /** Kode yang menyala. Selalu kosong untuk mode "lama" - Lama berarti semua mati. */
  fitur: Record<string, true>;
  sumber: SumberTampilan;
  /** '' untuk semua/bawaan, kunci peran, atau id pengguna. */
  sasaranSumber: string;
  /** true bila berasal dari penerapan admin - ekstensi TIDAK menyalakan mode coba. */
  diterapkan: boolean;
  diubahPada: string | null;
};

export const TAMPILAN_BAWAAN: TampilanBerlaku = Object.freeze({
  mode: "lama",
  fitur: {},
  sumber: "bawaan",
  sasaranSumber: "",
  diterapkan: false,
  diubahPada: null,
}) as TampilanBerlaku;

function jadiBerlaku(p: PenerapanTampilan, sumber: SumberTampilan): TampilanBerlaku {
  return {
    mode: p.mode,
    fitur: p.mode === "lama" ? {} : bersihkanFitur(p.fitur),
    sumber,
    sasaranSumber: p.sasaran,
    diterapkan: true,
    diubahPada: p.diubahPada,
  };
}

/**
 * ============================================================================
 * TAMPILAN YANG BERLAKU BAGI SATU ORANG
 * ============================================================================
 *
 *   1. penerapan untuk ORANG itu sendiri;
 *   2. penerapan untuk PERANNYA;
 *   3. penerapan untuk SEMUA;
 *   4. bawaan: "lama", tidak diterapkan.
 *
 * Yang lebih sempit selalu menang, tanpa melihat mana yang lebih baru: admin
 * yang memberi satu orang tampilan tersendiri bermaksud orang itu berbeda
 * dari rekan-rekannya, dan penerapan "semua" yang menyusul kemudian tidak
 * boleh menghapus maksud itu diam-diam.
 *
 * ============================================================================
 * BILA SESEORANG PUNYA BEBERAPA PERAN
 * ============================================================================
 *
 * Peran UTAMA (jabatan, roleId) lebih dulu. Bila peran utama tidak punya
 * penerapan, peran tambahan diperiksa menurut URUTAN TERCATAT pada akunnya,
 * dan yang pertama punya penerapan yang dipakai.
 *
 * Satu paket utuh, TIDAK digabung. Kewenangan (akses.ts) digabung karena
 * kewenangan dapat dijumlahkan; tampilan tidak: mode milik satu peran dengan
 * saklar milik peran lain adalah tampilan yang tidak pernah dilihat, apalagi
 * disetujui, oleh admin yang menerapkannya. Peran utama menang karena jabatan
 * adalah pekerjaan sehari-harinya; peran tambahan (operator, penjaga sidang)
 * adalah tugas di sampingnya.
 *
 * Peran yang ditulis dua kali atau sama dengan peran utama diabaikan.
 */
export function pecahkanTampilan(
  daftar: readonly PenerapanTampilan[],
  pengguna: { id: string; roleId: string; additionalRoleIds?: readonly string[] | null }
): TampilanBerlaku {
  const cari = (lingkup: LingkupTampilan, sasaran: string) =>
    daftar.find((p) => p.lingkup === lingkup && p.sasaran === sasaran && modeTampilanSah(p.mode)) ?? null;

  const milikOrang = pengguna.id ? cari("pengguna", String(pengguna.id)) : null;
  if (milikOrang) return jadiBerlaku(milikOrang, "pengguna");

  const urutanPeran: string[] = [];
  for (const peran of [pengguna.roleId, ...(pengguna.additionalRoleIds ?? [])]) {
    const bersih = String(peran || "").trim();
    if (bersih && !urutanPeran.includes(bersih)) urutanPeran.push(bersih);
  }
  for (const peran of urutanPeran) {
    const milikPeran = cari("peran", peran);
    if (milikPeran) return jadiBerlaku(milikPeran, "peran");
  }

  const milikSemua = cari("semua", "");
  if (milikSemua) return jadiBerlaku(milikSemua, "semua");

  return { ...TAMPILAN_BAWAAN, fitur: {} };
}

// ============================================================================
// SETELAN PRIBADI EKSTENSI - DAFTAR PUTIH
// ============================================================================

/**
 * Kunci chrome.storage.local ekstensi yang boleh ikut ke PC lain lewat
 * "pengaturan.ekstensi" (ide portal-30, sinkron pengaturan antar PC).
 *
 * Hanya SELERA tampilan dan saklar kenyamanan. Yang sengaja TIDAK ada:
 *   - posisi panel dan widget (posisi*): layar tiap PC berbeda ukurannya;
 *   - modeKering, ujiTampilan, ujiFitur, ujiIzinkanNyata: keadaan
 *     pengamanan dan percobaan milik satu PC, bukan selera;
 *   - asalPortal, token, riwayat, simpanan konteks: alamat, kredensial, dan
 *     isi perkara - tidak pernah menjadi setelan.
 */
export const KUNCI_PENGATURAN_SINKRON = [
  "aktif",
  "tandaiHalaman",
  "checklistMilestone",
  "suntingLangsungAbt",
  "cetakTigaBerkas",
  "sisipJadwal",
  "temaPanel",
  "temaPopup",
  "warnaGelap",
  "warnaMandiri",
  "warnaSendiri",
  "skalaHuruf",
  "panelRingkas",
  "lipatanBagian",
  "lipatanChecklistMilestone",
  "peranChecklistMilestone",
] as const;

const PENGATURAN_SINKRON = new Set<string>(KUNCI_PENGATURAN_SINKRON);

export const KUNCI_SETELAN = ["checklist.tanda", "pintasan.portal", "pengaturan.ekstensi"] as const;
export type KunciSetelan = (typeof KUNCI_SETELAN)[number];

export function kunciSetelanSah(x: unknown): x is KunciSetelan {
  return typeof x === "string" && (KUNCI_SETELAN as readonly string[]).includes(x);
}

/** Batas ukuran JSON yang tersimpan, per kunci, dalam bita UTF-8. */
export const BATAS_BITA_SETELAN: Record<KunciSetelan, number> = {
  "checklist.tanda": 65536,
  "pintasan.portal": 8192,
  "pengaturan.ekstensi": 16384,
};

export const BATAS_TANDA_CHECKLIST = 500;
export const BATAS_PINTASAN = 60;

export class GalatSetelan extends Error {}

function tanggalSah(x: unknown): string | null {
  if (typeof x !== "string" || !x.trim()) return null;
  const t = new Date(x);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

/** Teks satu baris tanpa karakter kendali, 1..maks huruf. */
function teksPendek(x: unknown, maks: number): string | null {
  if (typeof x !== "string") return null;
  const s = x.trim();
  if (!s || s.length > maks) return null;
  if (/[\u0000-\u001f\u007f]/.test(s)) return null;
  return s;
}

export type TandaChecklist = { keadaan: "selesai" | "tunda"; sampai: string | null; pada: string };

function normalkanTandaChecklist(nilai: unknown, sekarang: Date) {
  if (!nilai || typeof nilai !== "object" || Array.isArray(nilai)) {
    throw new GalatSetelan("checklist.tanda harus berupa obyek {idButir: tanda}.");
  }
  const masuk = Object.entries(nilai as Record<string, unknown>);
  if (masuk.length > BATAS_TANDA_CHECKLIST) {
    throw new GalatSetelan(
      `checklist.tanda paling banyak ${BATAS_TANDA_CHECKLIST} butir - buang tanda yang sudah lama lebih dulu.`
    );
  }
  const hasil: Record<string, TandaChecklist> = {};
  for (const [id, tanda] of masuk) {
    const idBersih = teksPendek(id, 160);
    if (!idBersih) throw new GalatSetelan("Id butir checklist kosong atau terlalu panjang.");
    if (!tanda || typeof tanda !== "object" || Array.isArray(tanda)) {
      throw new GalatSetelan(`Tanda butir ${idBersih} harus berupa obyek.`);
    }
    const t = tanda as Record<string, unknown>;
    if (t.keadaan !== "selesai" && t.keadaan !== "tunda") {
      throw new GalatSetelan(`Keadaan butir ${idBersih} harus "selesai" atau "tunda".`);
    }
    const sampai = t.keadaan === "tunda" ? tanggalSah(t.sampai) : null;
    if (t.keadaan === "tunda" && !sampai) {
      throw new GalatSetelan(`Butir ${idBersih} ditunda tanpa tanggal "sampai" yang dapat dibaca.`);
    }
    hasil[idBersih] = { keadaan: t.keadaan, sampai, pada: tanggalSah(t.pada) ?? sekarang.toISOString() };
  }
  return { nilai: hasil, dibuang: [] as string[] };
}

function daftarTeks(x: unknown, nama: string): string[] {
  if (x === undefined || x === null) return [];
  if (!Array.isArray(x)) throw new GalatSetelan(`pintasan.portal.${nama} harus berupa larik.`);
  if (x.length > BATAS_PINTASAN) {
    throw new GalatSetelan(`pintasan.portal.${nama} paling banyak ${BATAS_PINTASAN} butir.`);
  }
  const hasil: string[] = [];
  for (const butir of x) {
    const s = teksPendek(butir, 200);
    if (!s) throw new GalatSetelan(`Butir pintasan.portal.${nama} kosong atau terlalu panjang.`);
    if (!hasil.includes(s)) hasil.push(s);
  }
  return hasil;
}

function normalkanPintasan(nilai: unknown) {
  if (!nilai || typeof nilai !== "object" || Array.isArray(nilai)) {
    throw new GalatSetelan("pintasan.portal harus berupa obyek {urutan, sembunyi}.");
  }
  const n = nilai as Record<string, unknown>;
  const dibuang = Object.keys(n).filter((k) => k !== "urutan" && k !== "sembunyi");
  return { nilai: { urutan: daftarTeks(n.urutan, "urutan"), sembunyi: daftarTeks(n.sembunyi, "sembunyi") }, dibuang };
}

function normalkanPengaturan(nilai: unknown) {
  if (!nilai || typeof nilai !== "object" || Array.isArray(nilai)) {
    throw new GalatSetelan("pengaturan.ekstensi harus berupa obyek {kunciPenyimpanan: nilai}.");
  }
  const hasil: Record<string, unknown> = {};
  const dibuang: string[] = [];
  for (const [k, v] of Object.entries(nilai as Record<string, unknown>)) {
    if (!PENGATURAN_SINKRON.has(k) || v === undefined) {
      dibuang.push(k);
      continue;
    }
    hasil[k] = v;
  }
  return { nilai: hasil, dibuang };
}

/**
 * Memeriksa dan menormalkan satu setelan sebelum disimpan.
 *
 * Melempar GalatSetelan (pesan untuk petugas) bila kunci tidak diizinkan,
 * bentuknya salah, atau ukurannya melewati batas. Ruas yang tidak dikenal di
 * dalam nilai dibuang dan disebut di `dibuang`, bukan ditolak - ekstensi yang
 * lebih baru boleh mengirim lebih banyak daripada yang dikenal portal lama.
 */
export function normalkanSetelan(
  kunci: unknown,
  nilai: unknown,
  sekarang: Date = new Date()
): { kunci: KunciSetelan; nilai: unknown; json: string; dibuang: string[] } {
  if (!kunciSetelanSah(kunci)) {
    throw new GalatSetelan(`Kunci setelan tidak diizinkan. Yang diizinkan: ${KUNCI_SETELAN.join(", ")}.`);
  }
  const hasil =
    kunci === "checklist.tanda"
      ? normalkanTandaChecklist(nilai, sekarang)
      : kunci === "pintasan.portal"
        ? normalkanPintasan(nilai)
        : normalkanPengaturan(nilai);

  let json: string;
  try {
    json = JSON.stringify(hasil.nilai);
  } catch {
    throw new GalatSetelan("Nilai setelan tidak dapat disimpan sebagai JSON.");
  }
  const bita = new TextEncoder().encode(json).length;
  if (bita > BATAS_BITA_SETELAN[kunci]) {
    throw new GalatSetelan(`Setelan ${kunci} terlalu besar (${bita} bita; batas ${BATAS_BITA_SETELAN[kunci]}).`);
  }
  return { kunci, nilai: hasil.nilai, json, dibuang: hasil.dibuang };
}
