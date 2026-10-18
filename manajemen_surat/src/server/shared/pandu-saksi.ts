import { sebutanPihakPerkara } from "@/lib/sebutan-pihak";
import type {
  PanduanBagianPihak,
  PanduanIsianKeadaan,
  PanduanKeterangan,
  PanduanPokok,
  PanduanSaksi,
  PanduanTanya,
  PihakSaksi,
} from "@/lib/pandu-saksi";
import { PESAN_BELUM_ADA_PANDUAN } from "@/lib/pandu-saksi";
import { EKSTENSI_BERKAS } from "@/server/shared/ekstensi-berkas";

/**
 * ============================================================================
 * PANDUAN PERTANYAAN SAKSI - SUMBER SATU DENGAN EKSTENSI
 * ============================================================================
 *
 * Katalog pertanyaan per jenis perkara dan mesinnya milik ekstensi
 * (ekstensi-sipp/saksi-katalog/*.json, saksi-katalog.js, saksi-katalog-data.js,
 * saksi-susun.js). Portal TIDAK menyalinnya dengan tangan: ia membaca berkas
 * ekstensi yang sama, yang sudah ditanam ke EKSTENSI_BERKAS oleh
 * scripts/susun-ekstensi.mjs (folder ekstensi-sipp tidak ikut ke container
 * portal; berkas tertanam inilah yang ikut). Satu uji menjaga kesamaannya
 * dengan folder ekstensi (ekstensi-versi-tanam.test.ts).
 *
 * Mesin dan data dijalankan di SISI SERVER saja, lalu hanya PERTANYAAN yang
 * dikirim ke layar: katalog utuh (±2,6 MB) tidak pernah ikut ke peramban, dan
 * pemilihan butir menurut keadaan dikerjakan mesin yang sama dengan penyusun
 * berita acara di ekstensi.
 *
 * YANG TIDAK PERNAH KELUAR DARI SINI
 *   - contoh jawaban saksi (jawaban, jawabanUmum, saksi1/saksi2): panduan
 *     hanya memuat PERTANYAAN dan unsur, supaya tidak mengarahkan saksi;
 *   - dasar hukum berstatus "perlu-verifikasi";
 *   - kode variabel ABT (#nnnn#) dan tempat isian ({nama}): diganti kata biasa.
 */

type Katalog = Record<string, unknown> & {
  kunci: string;
  judul: string;
  pertanyaan?: Array<Record<string, unknown>>;
  pokokPembuktian?: Array<Record<string, unknown>>;
  dasarHukum?: Array<Record<string, unknown>>;
  keadaan?: Record<string, Record<string, unknown>>;
  peranKeterangan?: Array<Record<string, unknown>>;
  syarat?: { jenisPerkaraId?: string[] };
};

type Mesin = {
  kenaliKatalog(daftar: Katalog[], perkara: Record<string, unknown>): Katalog | null;
  gabungKatalog(utama: Katalog, daftar: Katalog[]): Katalog;
  kenaliKeterangan(daftar: Katalog[], utama: Katalog): Katalog | null;
  keadaanBawaan(kat: Katalog, turunan?: Record<string, unknown>): Record<string, unknown>;
  keadaanUntukBorang(kat: Katalog): Array<{ kunci: string; label: string; nilai: string[]; jamak: boolean; bawaan: unknown; sumber: string }>;
  pertanyaanAktif(kat: Katalog, keadaan: Record<string, unknown>, pihak: string | null, opsi?: Record<string, unknown>): Array<Record<string, unknown>>;
  cocokKeadaan(syarat: unknown, keadaan: Record<string, unknown>): boolean;
  peranTerurut(kat: Katalog): Array<Record<string, unknown>>;
  isiPenanda(teks: string, ctx: Record<string, unknown>): { teks: string; kosong: string[] };
  rumusWali?(teks: string): string;
  POKOK_PERLU_KONFIRMASI: readonly string[];
  LABEL_NILAI_BAKU: Readonly<Record<string, string>>;
  KEADAAN_TURUNAN: readonly string[];
};

type Penyusun = {
  turunkanKeadaan(kat: Katalog, konteks: { teks?: string; peta?: unknown }): Record<string, unknown>;
};

type Dasar = { mesin: Mesin; penyusun: Penyusun; katalog: Katalog[] };

let dasar: Dasar | null = null;

/**
 * Menjalankan tiga skrip ekstensi (mesin, data, penyusun) dalam satu "dunia"
 * kosong. `globalThis` dan `self` ditutup oleh dunia itu sehingga tidak ada
 * yang bocor ke proses server; skripnya sendiri murni (tanpa DOM, tanpa
 * chrome.*) pada saat dimuat.
 */
function muatDasar(): Dasar {
  if (dasar) return dasar;
  const dunia: Record<string, unknown> = {};
  const jalankan = (nama: string) => {
    const kode = EKSTENSI_BERKAS[nama];
    if (typeof kode !== "string") throw new Error(`Berkas ekstensi ${nama} tidak tertanam di portal`);
    const modul: { exports: unknown } = { exports: {} };
    // eslint-disable-next-line no-new-func -- skrip ekstensi tertanam milik repo ini, bukan masukan pengguna
    new Function("module", "globalThis", "self", kode)(modul, dunia, dunia);
  };
  jalankan("saksi-katalog.js");
  jalankan("saksi-katalog-data.js");
  jalankan("saksi-susun.js");
  const mesin = dunia.AletaSaksiKatalog as Mesin | undefined;
  const penyusun = dunia.AletaSaksiSusun as Penyusun | undefined;
  const katalog = dunia.ALETA_SAKSI_KATALOG_DATA as Katalog[] | undefined;
  if (!mesin || !penyusun || !Array.isArray(katalog)) throw new Error("Mesin katalog saksi ekstensi tidak termuat");
  dasar = { mesin, penyusun, katalog };
  return dasar;
}

// ─── Kata pengganti kode variabel ────────────────────────────────────────────

/**
 * Pengganti kode variabel ABT di teks pertanyaan. Panduan tidak memegang nama
 * orang, jadi kodenya menjadi sebutan: yang ada di sini adalah SELURUH kode
 * non-pihak yang dipakai katalog (dijaga uji).
 */
const KATA_KODE: Readonly<Record<string, string>> = {
  "1025": "pewaris",
  "1029": "calon suami",
  "2026": "almarhum/almarhumah",
  "7036": "anak yang dimaksud",
  "8602": "anak yang dimaksud",
  "8723": "calon istri kedua",
  "9302": "anak",
  "9340": "yang diperjanjikan",
  "0600": "calon pasangannya",
  "0606": "anak",
};

/** Pengecualian per katalog: kode yang artinya lain pada jenis perkara tertentu. */
const KATA_KODE_KHUSUS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "itsbat-nikah": { "1025": "pasangannya" },
  "dispensasi-kawin": { "7036": "anak yang dimohonkan dispensasi" },
  perwalian: { "7036": "anak yang dimohonkan perwaliannya" },
  "pengangkatan-anak": { "7036": "anak yang akan diangkat" },
  "penetapan-ahli-waris": { "7036": "ahli waris yang dimohonkan" },
  "permohonan-umum": { "7036": "pihak yang dimohonkan" },
};

const KATA_CADANGAN = "yang bersangkutan";

function rapikanTeks(teks: string): string {
  return teks
    .replace(/\s+([?.,;:!])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Satu pertanyaan siap tampil: tanpa kode variabel, tanpa tempat isian. */
export function teksPanduan(
  teks: string,
  konteks: { katalogKunci: string; satu: string; dua: string; pihak: PihakSaksi | "*" }
): string {
  const khusus = KATA_KODE_KHUSUS[konteks.katalogKunci] ?? {};
  const wajar = String(teks).replace(/\b(?:yang\s+)?bernama\s+#\d{4}#/gi, "yang dimaksud");
  const { mesin } = muatDasar();
  const dihadirkan = konteks.pihak === "T" ? konteks.dua : konteks.satu;
  const lawan = konteks.pihak === "T" ? konteks.satu : konteks.dua;
  const hasil = mesin.isiPenanda(wajar, {
    variabel: (kode: string) => {
      if (kode === "0046") return konteks.satu;
      if (kode === "0047") return konteks.dua;
      return khusus[kode] ?? KATA_KODE[kode] ?? KATA_CADANGAN;
    },
    slot: {
      pengaju: konteks.satu,
      lawan: konteks.dua,
      pihakSaksi: dihadirkan,
      lawanSaksi: lawan,
      pelaku: "pihak yang dimaksud",
      korban: "pasangannya",
      hal: "hal tersebut",
      sumber: dihadirkan,
      hubungan: "keluarga",
    },
  });
  // Sisa tempat isian yang tak dikenal tidak boleh sampai ke layar.
  return rapikanTeks(hasil.teks.replace(/\{[^{}]*\}/g, KATA_CADANGAN).replace(/#\d{4}#/g, KATA_CADANGAN));
}

// ─── Susunan panduan ─────────────────────────────────────────────────────────

export type MasukanPanduan = {
  jenisPerkaraId?: number | string | null;
  alurPerkaraId?: number | string | null;
  jenisPerkara?: string | null;
  /** Keadaan yang sudah diketahui/dipilih: kehadiran, kumulasi, alasan, dan seterusnya. */
  keadaan?: Record<string, unknown> | null;
  /** Tampilkan butir sensitif keterangan anak/calon (kehamilan dan hubungan badan). */
  butirSensitif?: boolean;
};

const daftar = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
const adaObjek = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === "object" && !Array.isArray(x);

function labelNilai(mesin: Mesin, kat: Katalog, kunci: string, nilai: string): string {
  const dek = kat.keadaan?.[kunci];
  const labelKat = adaObjek(dek) && adaObjek(dek.labelNilai) ? dek.labelNilai[nilai] : undefined;
  return String(labelKat ?? mesin.LABEL_NILAI_BAKU[nilai] ?? nilai.replace(/-/g, " "));
}

/** Rujukan hukum yang BELUM terverifikasi: tidak boleh muncul di mana pun pada keluaran. */
function rujukanBelumPasti(kat: Katalog): string[] {
  return daftar<Record<string, unknown>>(kat.dasarHukum)
    .filter((d) => d.status === "perlu-verifikasi" && typeof d.rujukan === "string" && d.rujukan.trim())
    .map((d) => String(d.rujukan).toLowerCase());
}

function bersihDariRujukan(teks: string, terlarang: string[]): string {
  const rendah = teks.toLowerCase();
  return terlarang.some((r) => rendah.includes(r)) ? "" : teks;
}

function susunPokok(
  mesin: Mesin,
  kat: Katalog,
  butir: Array<Record<string, unknown>>,
  konteks: { katalogKunci: string; satu: string; dua: string; pihak: PihakSaksi | "*" },
  tahan: ReadonlyArray<string> = []
): PanduanPokok[] {
  const terlarang = rujukanBelumPasti(kat);
  const dasarTerverifikasi = new Map<string, { rujukan: string; uraian: string }>();
  for (const d of daftar<Record<string, unknown>>(kat.dasarHukum)) {
    if (d.status === "terverifikasi" && typeof d.id === "string") {
      dasarTerverifikasi.set(d.id, { rujukan: String(d.rujukan ?? ""), uraian: String(d.uraian ?? "") });
    }
  }
  const urutPokok: string[] = [];
  const peta = new Map<string, PanduanTanya[]>();
  for (const q of butir) {
    const pokokId = String(q.pokok ?? "");
    if (tahan.includes(pokokId)) continue;
    const teks = teksPanduan(String(q.teks ?? ""), konteks);
    if (!teks) continue;
    if (!peta.has(pokokId)) {
      peta.set(pokokId, []);
      urutPokok.push(pokokId);
    }
    peta.get(pokokId)!.push({ id: String(q.id), teks, tingkat: String(q.tingkat ?? "inti"), kelompok: String(q.kelompok ?? "pokok") });
  }
  return urutPokok.map((id) => {
    const p = daftar<Record<string, unknown>>(kat.pokokPembuktian).find((x) => x.id === id) ?? {};
    const dasarHukum = daftar<string>(p.dasarHukum)
      .map((d) => dasarTerverifikasi.get(d))
      .filter((d): d is { rujukan: string; uraian: string } => Boolean(d));
    return {
      id,
      judul: bersihDariRujukan(String(p.judul ?? ""), terlarang) || "Pokok pemeriksaan",
      uraian: bersihDariRujukan(String(p.uraian ?? ""), terlarang),
      wajib: p.wajib === true,
      dasarHukum,
      tanya: peta.get(id) ?? [],
    };
  });
}

/** Isian keadaan (untuk dipilih petugas) dari satu katalog; menetapkan juga nilai yang dipakai pada `pakai`. */
function bangunIsian(
  mesin: Mesin,
  kat: Katalog,
  pakai: Record<string, unknown>,
  diminta: Record<string, unknown>,
  untuk: "saksi" | "keterangan",
  lewati: ReadonlyArray<string>,
  sudahTampil: ReadonlySet<string> = new Set()
): PanduanIsianKeadaan[] {
  const hasil: PanduanIsianKeadaan[] = [];
  for (const f of mesin.keadaanUntukBorang(kat)) {
    if (lewati.includes(f.kunci)) continue;
    const sah = new Set(f.nilai);
    const mintaMentah = diminta[f.kunci];
    const minta = (Array.isArray(mintaMentah) ? mintaMentah : mintaMentah === undefined || mintaMentah === null || mintaMentah === "" ? [] : [mintaMentah])
      .map(String)
      .filter((n) => sah.has(n));
    if (minta.length > 0) pakai[f.kunci] = f.jamak ? minta : minta[0];
    const sekarang = pakai[f.kunci];
    const terpilih = (Array.isArray(sekarang) ? sekarang : sekarang === undefined || sekarang === null ? [] : [sekarang]).map(String);
    // Pilihan yang sama dengan keadaan perkara berlaku untuk keduanya, tetapi tidak digambar dua kali.
    if (sudahTampil.has(f.kunci)) continue;
    hasil.push({
      kunci: f.kunci,
      label: f.label,
      jamak: f.jamak,
      nilai: f.nilai.map((n) => ({ nilai: n, label: labelNilai(mesin, kat, f.kunci, n) })),
      terpilih,
      asal: f.sumber === "otomatis" ? "otomatis" : "pilihan",
      untuk,
    });
  }
  return hasil;
}

/**
 * Menyusun panduan pemeriksaan saksi untuk satu perkara. Jenis perkara tanpa
 * katalog TIDAK dijadikan cerai: jawabannya `tersedia: false`.
 */
export function susunPanduan(masukan: MasukanPanduan): PanduanSaksi {
  const { mesin, penyusun, katalog } = muatDasar();
  const jenisId = Number(masukan.jenisPerkaraId);
  const perkara = {
    jenisPerkaraId: Number.isFinite(jenisId) && jenisId > 0 ? jenisId : "",
    alurPerkaraId: masukan.alurPerkaraId ?? "",
    nama: String(masukan.jenisPerkara ?? ""),
  };
  const utama = mesin.kenaliKatalog(katalog, perkara);
  if (!utama) return { tersedia: false, alasan: PESAN_BELUM_ADA_PANDUAN };
  const kat = mesin.gabungKatalog(utama, katalog);
  const sebutan = sebutanPihakPerkara({
    alurPerkaraId: masukan.alurPerkaraId,
    jenisPerkaraId: perkara.jenisPerkaraId === "" ? null : perkara.jenisPerkaraId,
    jenisPerkaraNama: masukan.jenisPerkara,
  });

  // Keadaan: bawaan katalog < turunan dari jenis perkara < yang diberikan pemanggil.
  const turunan = penyusun.turunkanKeadaan(utama, { teks: "", peta: null });
  const diminta = adaObjek(masukan.keadaan) ? masukan.keadaan : {};
  const pakai: Record<string, unknown> = mesin.keadaanBawaan(kat, { ...turunan });
  const isian: PanduanIsianKeadaan[] = bangunIsian(mesin, kat, pakai, diminta, "saksi", []);

  const bagian = (pihak: PihakSaksi): PanduanBagianPihak => {
    const keadaan = { ...pakai, pihakSaksi: pihak, jumlahSaksi: "2" };
    const butir = mesin.pertanyaanAktif(kat, keadaan, pihak, {});
    const pokok = susunPokok(mesin, kat, butir, { katalogKunci: utama.kunci, satu: sebutan.satu, dua: sebutan.dua, pihak });
    return {
      pihak,
      label: pihak === "P" ? `Saksi ${sebutan.satu}` : `Saksi ${sebutan.dua}`,
      pokok,
      jumlahTanya: pokok.reduce((n, p) => n + p.tanya.length, 0),
    };
  };
  const saksiP = bagian("P");
  const saksiT = bagian("T");
  // Katalog yang punya butir khusus saksi Tergugat (harta bersama, kewarisan): bagian Tergugat perlu dibuka sendiri.
  const tergugatBerbeda = daftar<Record<string, unknown>>(kat.pertanyaan).some((q) => {
    const ps = daftar<string>(q.pihakSaksi);
    return ps.length > 0 && ps.every((x) => x === "T");
  });

  // Keterangan pihak (dispensasi kawin: anak, calon, orang tua) - bukan saksi.
  let keterangan: PanduanKeterangan | null = null;
  const katKet = mesin.kenaliKeterangan(katalog, utama);
  if (katKet) {
    const tahan = masukan.butirSensitif === true ? [] : [...mesin.POKOK_PERLU_KONFIRMASI];
    const pakaiKet: Record<string, unknown> = mesin.keadaanBawaan(katKet, {});
    // Kunci yang sama dengan keadaan perkara (mis. tidak ada) tidak digandakan; "peran" ditentukan bagian, bukan petugas.
    const sudah = new Set(isian.map((i) => i.kunci));
    isian.push(...bangunIsian(mesin, katKet, pakaiKet, diminta, "keterangan", ["peran"], sudah));
    const peran = mesin.peranTerurut(katKet).map((d) => {
      const kode = String(d.kode);
      const butir = mesin.pertanyaanAktif(katKet, { ...pakaiKet, peran: kode, pihakSaksi: "P" }, "P", {});
      return {
        kode,
        label: String(d.label ?? kode),
        pokok: susunPokok(mesin, katKet, butir, { katalogKunci: utama.kunci, satu: sebutan.satu, dua: sebutan.dua, pihak: "P" }, tahan),
      };
    });
    keterangan = {
      peran: peran.filter((p) => p.pokok.length > 0),
      adaButirSensitif: mesin.POKOK_PERLU_KONFIRMASI.length > 0,
      butirSensitifTampil: masukan.butirSensitif === true,
    };
  }

  const keadaanDipakai: Record<string, string | string[]> = {};
  for (const i of isian) if (i.terpilih.length > 0) keadaanDipakai[i.kunci] = i.jamak ? i.terpilih : i.terpilih[0];

  return {
    tersedia: true,
    kunci: utama.kunci,
    judul: String(utama.judul),
    sebutan: { satu: sebutan.satu, dua: sebutan.dua },
    keadaan: isian,
    keadaanDipakai,
    saksi: { P: saksiP, T: saksiT },
    keterangan,
    tergugatBerbeda,
  };
}
