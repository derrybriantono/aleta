/**
 * ============================================================================
 * ALETA Ai - PROYEK V4.5: menu pemicu, modul, dan pemilihan modul (murni)
 * ============================================================================
 *
 * Proyek "ALETA AI PA V4.5" terdiri dari satu Core Prompt (system prompt tetap)
 * dan modul pengetahuan ALETA_NN_*.md. Modul TIDAK dikirim semuanya: hanya yang
 * terkait pemicu atau kata kunci permintaan, supaya biaya token wajar dan
 * prompt caching efektif.
 *
 * Pemicu dibaca dari ALETA_05 (tabel markdown "| Trigger | Output |" per
 * KELOMPOK). Bila formatnya tak terbaca, pemicu modul = kata kunci judulnya.
 */

import { MODEL_HAIKU } from "@/lib/aleta-ai/biaya";

export type ModulProyek = {
  /** "ALETA_13" */
  kode: string;
  judul: string;
  isi: string;
  /** Kata/frasa pemicu (dari ALETA_05; bila tak terbaca: kata kunci judul). */
  pemicu: string[];
};

export type PemicuMenu = {
  /** Slug stabil yang dikirim klien: "duduk-perkara". */
  kode: string;
  /** Tampilan tombol: "Duduk Perkara". */
  label: string;
  alias: string[];
  /** Judul kelompok menu: "Drafting Utama". */
  grup: string;
  /** Huruf kelompok menu (A..I). */
  grupHuruf: string;
  keluaran: string;
  /** Modul yang disebut kolom keluaran: ["ALETA_13"]. */
  modul: string[];
  /** Kelompok RUTE model (bukan kelompok menu). */
  kelompok: string;
};

export type LampiranProyek = { nama: string; ukuran: number; jenis: string };

const HURUF_GRUP_BAWAAN: Record<string, string> = {
  A: "teliti-sidang",
  B: "teliti-ringkas",
  C: "teliti-sidang",
  D: "teliti-ringkas",
  E: "mendalam-analisa",
  F: "cepat-hitung",
  G: "teliti-sidang",
  H: "teliti-sidang",
  I: "cepat-bantuan",
};

const KELOMPOK_MODUL: Record<string, string> = {
  ALETA_04: "cepat-hitung",
  ALETA_06: "cepat-bantuan",
  ALETA_15: "cepat-hitung",
  ALETA_21: "cepat-hitung",
  ALETA_09: "teliti-ringkas",
  ALETA_20: "teliti-ringkas",
  ALETA_10: "teliti-sidang",
  ALETA_13: "teliti-sidang",
  ALETA_14: "teliti-sidang",
  ALETA_19: "teliti-sidang",
  ALETA_11: "mendalam-analisa",
  ALETA_16: "mendalam-analisa",
  ALETA_18: "mendalam-analisa",
  ALETA_07: "mendalam-putusan",
  ALETA_08: "mendalam-putusan",
};

/** Aturan per pemicu, diperiksa berurutan terhadap tiap alias (tanpa kurung siku). */
const ATURAN_PEMICU: ReadonlyArray<[RegExp, string]> = [
  [/^(debat|diskusi|uji posisi)/i, "mendalam-putusan"],
  [/^(pertimbangan|pt(\s|$)|amar|am$|putusan lengkap|pl$|berkas lengkap|asisten hakim|perluas|tambah dalil)/i, "mendalam-putusan"],
  [/^(duduk perkara|analisis putusan|ap(\s|$)|koreksi|kajian|komparasi|bandingkan arah|bank(\s|$)|audit|ultra petita|up$|coherence|ct$|devil|da(\s|$)|musyawarah|mm$|simulasi|alternatif strategi|checklist qa|perbaiki putusan|tanya jawab|lembar soal|tetap|ikuti da|tanpa da)/i, "mendalam-analisa"],
  [/^(help|bantuan|\?|cetak hasil|lanjutkan|lj$)/i, "cepat-bantuan"],
  [/^(kalkulator|kf$|kn$|kb$|terbilang|hijriah|penutup|cek blangko|cek angka|cek bukti|sema(\s|$)|buku ii|anonim|perkara(\s|$)|uji ulang)/i, "cepat-hitung"],
  [/^(buat dokumen|buat rtf|buat docx|buat pdf|download|cetak ke word|mediasi|penetapan|verstek|vs$|ghaib|gh$|relaas|bas(\s|$)|berita acara|ba$|ks dari bas|ekstrak bas|ringkas putusan|aanmaning|eksekusi|blangko|surat kuasa|jawaban|replik|duplik|kesimpulan|daftar bukti|daftar saksi)/i, "teliti-ringkas"],
  [/^(sidang|panduan sidang|persiapan sidang|papan|peta|blueprint|bp(\s|$)|posita|petitum|gugatan|permohonan|template|ubah bab|mode e-court|court calendar|jadwal sidang|yurisprudensi|yt$|kaidah fikih|kfq|dalil naqli|fatwa|fd$|matriks isu)/i, "teliti-sidang"],
];

export function bersihkanAlias(alias: string): string {
  return String(alias ?? "")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function kelompokDariPemicu(alias: readonly string[], grupHuruf: string, modul: readonly string[]): string {
  for (const [pola, kelompok] of ATURAN_PEMICU) {
    if (alias.some((a) => pola.test(bersihkanAlias(a)))) return kelompok;
  }
  for (const m of modul) {
    const dariModul = KELOMPOK_MODUL[m];
    if (dariModul) return dariModul;
  }
  return HURUF_GRUP_BAWAAN[grupHuruf] ?? "cepat-bantuan";
}

export function buatSlug(teks: string): string {
  return String(teks ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function bagiSel(baris: string): string[] {
  const potong = baris.trim().replace(/^\|/, "").replace(/\|\s*$/, "");
  return potong.split("|").map((s) => s.trim());
}

const REF_MODUL = /ALETA_(\d{2})/g;

/**
 * Membaca ALETA_05 menjadi daftar pemicu. Mengembalikan [] bila tak ada satu pun
 * baris tabel terbaca (pemanggil lalu memakai kata kunci judul modul).
 */
export function bacaMenuPemicu(markdown: string): PemicuMenu[] {
  const hasil: PemicuMenu[] = [];
  const dipakai = new Set<string>();
  let grup = "";
  let huruf = "";
  for (const mentah of String(markdown ?? "").split(/\r?\n/)) {
    const baris = mentah.trim();
    const kepala = /^##\s+(.*)$/.exec(baris);
    if (kepala) {
      const judul = (kepala[1] ?? "").trim();
      const k = /^KELOMPOK\s+([A-Z])\s*[—–-]\s*(.*)$/i.exec(judul);
      if (k) {
        huruf = (k[1] ?? "").toUpperCase();
        const nama = (k[2] ?? "").trim().toLowerCase();
        grup = nama.replace(/(^|[\s&-])([a-z])/g, (_m, a: string, b: string) => `${a}${b.toUpperCase()}`);
      } else {
        grup = "";
        huruf = "";
      }
      continue;
    }
    if (!baris.startsWith("|") || !huruf) continue;
    const sel = bagiSel(baris);
    if (sel.length < 2) continue;
    const pemicuMentah = sel[0] ?? "";
    const keluaran = sel.slice(1).join(" | ");
    if (!pemicuMentah || /^trigger$/i.test(pemicuMentah) || /^[-: ]+$/.test(pemicuMentah)) continue;
    const alias = pemicuMentah
      .split(/\s+·\s+|\s+\/\s+/)
      .map((a) => a.trim())
      .filter(Boolean);
    if (!alias.length) continue;
    const label = bersihkanAlias(alias[0] ?? "") || bersihkanAlias(pemicuMentah);
    if (!label) continue;
    let kode = buatSlug(label) || "pemicu";
    for (let n = 2; dipakai.has(kode); n += 1) kode = `${buatSlug(label) || "pemicu"}-${n}`;
    dipakai.add(kode);
    const modul = [...new Set([...keluaran.matchAll(REF_MODUL)].map((m) => `ALETA_${m[1]}`))];
    hasil.push({
      kode,
      label,
      alias,
      grup,
      grupHuruf: huruf,
      keluaran,
      modul,
      kelompok: kelompokDariPemicu(alias, huruf, modul),
    });
  }

  // Mode debat (ALETA_07) dipicu DEBAT di Core Prompt, bukan sebagai baris tabel.
  if (hasil.length > 0 && !hasil.some((p) => p.alias.some((a) => /^debat$/i.test(bersihkanAlias(a))))) {
    hasil.push({
      kode: "debat",
      label: "Debat",
      alias: ["DEBAT", "DISKUSI", "UJI POSISI"],
      grup: "Analisis & QA",
      grupHuruf: "E",
      keluaran: "Mode debat hukum: ALETA menjadi lawan berpikir (ALETA_07)",
      modul: ["ALETA_07"],
      kelompok: "mendalam-putusan",
    });
  }
  return hasil;
}

const KATA_BERHENTI = new Set(["dari", "dan", "yang", "untuk", "atau", "dengan", "contoh", "template", "modul", "ke", "di", "pada"]);

export function judulModulDari(isi: string, namaBerkas: string): string {
  const kepala = /^#\s+(.+)$/m.exec(String(isi ?? ""));
  const mentah = (kepala?.[1] ?? "").trim();
  const bersih = mentah.replace(/^ALETA[_ ]?\d{2}\s*[—–:-]\s*/i, "").trim();
  if (bersih) return bersih;
  return namaBerkas
    .replace(/\.md$/i, "")
    .replace(/^ALETA_\d{2}_?/i, "")
    .replace(/_/g, " ")
    .trim();
}

function kataKunciJudul(judul: string): string[] {
  return judul
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter((k) => k.length >= 4 && !KATA_BERHENTI.has(k));
}

/** Pemicu modul = alias baris menu yang menyebut modulnya; bila tak ada, kata kunci judul. */
export function isiPemicuModul(modul: Array<Omit<ModulProyek, "pemicu">>, menu: readonly PemicuMenu[]): ModulProyek[] {
  return modul.map((m) => {
    const alias = new Set<string>();
    for (const p of menu) {
      if (!p.modul.includes(m.kode)) continue;
      for (const a of p.alias) {
        const b = bersihkanAlias(a);
        if (b) alias.add(b);
      }
    }
    const pemicu = alias.size > 0 ? [...alias] : kataKunciJudul(m.judul);
    return { ...m, pemicu };
  });
}

// ----------------------------------------------------------------------------
// Mencocokkan teks pengguna dengan pemicu
// ----------------------------------------------------------------------------

const lepasHuruf = (t: string) => String(t ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

function adaKata(teks: string, kata: string): boolean {
  const k = lepasHuruf(kata).trim();
  if (!k) return false;
  const aman = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${aman}($|[^a-z0-9])`, "i").test(teks);
}

/**
 * Bila teks DIAWALI alias sebuah pemicu ("PT keuangan", "KN nafkah ..."), itulah
 * pemicunya - trigger adalah jalan pintas atas bahasa alami. Alias terpanjang menang.
 */
export function cariPemicuDiAwalTeks(menu: readonly PemicuMenu[], teks: string): PemicuMenu | null {
  const t = lepasHuruf(teks).trim();
  let terbaik: { p: PemicuMenu; panjang: number } | null = null;
  for (const p of menu) {
    for (const a of p.alias) {
      const alias = lepasHuruf(bersihkanAlias(a)).trim();
      if (!alias || alias === "?") continue;
      if (t === alias || t.startsWith(`${alias} `) || t.startsWith(`${alias}\n`)) {
        if (!terbaik || alias.length > terbaik.panjang) terbaik = { p, panjang: alias.length };
      }
    }
  }
  return terbaik?.p ?? null;
}

// ----------------------------------------------------------------------------
// Memilih modul untuk satu permintaan
// ----------------------------------------------------------------------------

/** Modul yang selalu menyertai kelompok rute (selain yang terpicu). */
export const MODUL_BAWAAN_KELOMPOK: Readonly<Record<string, readonly string[]>> = {
  "cepat-bantuan": ["ALETA_06"],
  "cepat-hitung": ["ALETA_04"],
  "teliti-ringkas": ["ALETA_09"],
  "teliti-sidang": ["ALETA_13"],
  "mendalam-analisa": ["ALETA_11", "ALETA_12"],
  "mendalam-putusan": ["ALETA_08", "ALETA_01", "ALETA_02", "ALETA_12"],
  "mendalam-rumit": ["ALETA_01", "ALETA_02", "ALETA_03", "ALETA_12"],
};

/** Anggaran karakter modul per label (kira-kira 1 token per 3-4 karakter). */
export const ANGGARAN_MODUL_KARAKTER: Readonly<Record<string, number>> = {
  Cepat: 30_000,
  Teliti: 90_000,
  Mendalam: 150_000,
};
export const ANGGARAN_MODUL_BAWAAN = 60_000;
/** Satu modul prioritas utama selalu dimuat utuh sampai sebesar ini (mis. ALETA_17 Buku II). */
export const BATAS_MODUL_UTAMA_KARAKTER = 250_000;

export type PilihanModul = {
  terpilih: ModulProyek[];
  /** Kode modul yang tak muat anggaran (untuk jejak, bukan untuk pengguna). */
  dilewati: string[];
};

export function pilihModul(opsi: {
  modul: readonly ModulProyek[];
  teks: string;
  pemicu: PemicuMenu | null;
  kelompok: string;
  labelMode: string;
}): PilihanModul {
  const urut: string[] = [];
  const tambah = (kode: string) => {
    if (!urut.includes(kode)) urut.push(kode);
  };
  const ada = new Map(opsi.modul.map((m) => [m.kode, m]));

  // 1. Modul yang disebut baris menu pemicu.
  for (const k of opsi.pemicu?.modul ?? []) tambah(k);

  // 2. Modul yang pemicunya muncul di teks (alias pendek hanya bila di awal teks).
  const t = lepasHuruf(opsi.teks);
  for (const m of opsi.modul) {
    const kena = m.pemicu.some((p) => {
      const b = lepasHuruf(bersihkanAlias(p));
      return b.length >= 4 && adaKata(t, b);
    });
    if (kena) tambah(m.kode);
  }

  // 3. Bawaan kelompok.
  for (const k of MODUL_BAWAAN_KELOMPOK[opsi.kelompok] ?? []) tambah(k);

  const anggaran = ANGGARAN_MODUL_KARAKTER[opsi.labelMode] ?? ANGGARAN_MODUL_BAWAAN;
  const terpilih: ModulProyek[] = [];
  const dilewati: string[] = [];
  let terpakai = 0;
  let pertama = true;
  for (const kode of urut) {
    const m = ada.get(kode);
    if (!m) continue;
    const ukuran = m.isi.length;
    const muat = terpakai + ukuran <= anggaran || (pertama && ukuran <= BATAS_MODUL_UTAMA_KARAKTER);
    pertama = false;
    if (muat) {
      terpilih.push(m);
      terpakai += ukuran;
    } else {
      dilewati.push(kode);
    }
  }
  // Urutan tetap menurut nomor modul agar awalan cache stabil untuk himpunan yang sama.
  terpilih.sort((a, b) => a.kode.localeCompare(b.kode));
  return { terpilih, dilewati };
}

export const MODEL_PENGKLASIFIKASI = MODEL_HAIKU;
