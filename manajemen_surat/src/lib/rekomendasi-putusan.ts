import { calonDasarHuruf } from "@/lib/draf-putusan-a1";
import { topikKalimat, type BuktiMasuk, type HasilPenilaian, type SaksiMasuk } from "@/lib/penilai-bukti";
import { kunciJenisPerkara } from "@/lib/pemetaan-blangko";
import { rekomendasiPutusan as rekomendasiBlangkoPutusan, type Rekomendasi } from "@/lib/rekomendasi-blangko";

/**
 * ============================================================================
 * R (2 Nov 2026, keputusan Derry 124-125) - REKOMENDASI PUTUSAN MENURUT ALAT BUKTI TERTULIS DAN KETERANGAN SAKSI
 * ============================================================================
 *
 * USULAN UNTUK HAKIM, BUKAN KEPUTUSAN. Satu fungsi murni (tanpa jaringan/basis data) yang membaca:
 *   - keterangan saksi (SaksiMasuk: tanya-jawab + hubungan dari SIPP perkara_pihak5) dan alat bukti tertulis (BuktiMasuk P.1 dst.);
 *   - hasil penilai pembuktian A2 (lib/penilai-bukti.ts) bila ada - untuk cerai, dalil x saksi x bukti per dalil (aturan selingkuh
 *     57/60/70, pengakuan 105 sudah di sana); tanpa matriks dalil, alasan perceraian dibaca langsung dari keterangan saksi dengan
 *     pengenal topik yang SAMA (topikKalimat);
 *   - kehadiran (Tergugat/Termohon pernah hadir) dan penanda formil yang sudah dideteksi.
 * Keluaran: hasil yang direkomendasikan (dikabulkan / ditolak / tidak dapat diterima, verstek), keyakinan (cukup/ragu), alasan per
 * UNSUR (bukti mana membuktikan apa, saksi mana menerangkan apa - keluarga/orang dekat, melihat sendiri atau dari cerita), unsur yang
 * belum terbukti, dasar hukum per unsur, dan blangko putusan yang cocok (peta blangko yang SAMA dengan saran blangko:
 * lib/rekomendasi-blangko.ts).
 *
 * Jenis: cerai gugat & cerai talak, itsbat nikah (permohonan & kontensius), dispensasi kawin. Jenis lain -> null.
 *
 * DASAR HUKUM hanya yang ada di referensi resmi (D:/aleta-dev/kerja/referensi: KHI, UU 1/1974, UU 16/2019 + penjelasan, PP 9/1975,
 * PERMA 5/2019, Kompilasi Rumusan Hukum Kamar Agama edisi 6 2026) atau yang sudah dikutip blangko Derry (diperiksa 2 Nov). Tidak ada
 * kaidah fikih yang dikarang (keputusan 104).
 *
 * Tidak ada yang dicetak, disimpan, atau ditulis ke SIPP/ABT. Kinerja: satu lintasan saksi x baris (paling banyak 20 x 80), pola
 * diolah sekali per modul; < 5 ms untuk perkara biasa.
 */

export const VERSI_REKOMENDASI = 1;

export type JenisRekomendasiPutusan = "cerai-gugat" | "cerai-talak" | "itsbat" | "itsbat-kontensius" | "dk";
export type HasilRekomendasiPutusan = "dikabulkan" | "ditolak" | "tidak-dapat-diterima" | "";
export type StatusUnsur = "terbukti" | "belum" | "tidak-terbukti" | "catatan";

export type BuktiUnsur = { kode: string; kelas: string; membuktikan: string };
export type SaksiUnsur = {
  label: string;
  /** Hubungan dengan pihak (SIPP atau ucapan saksi), mis. "Ayah Kandung", "Tetangga"; kosong = tidak disebut. */
  hubungan: string;
  golongan: "keluarga" | "dekat" | "lain" | "";
  /** true = melihat/mendengar/hadir sendiri; false = dari cerita orang lain (de auditu). */
  langsung: boolean;
  sebaliknya: boolean;
  tanya: string;
  kutipan: string;
};
export type UnsurRekomendasi = {
  id: string;
  judul: string;
  status: StatusUnsur;
  /** Satu kalimat: apa yang terbukti/belum dan dari mana. */
  ringkas: string;
  bukti: BuktiUnsur[];
  saksi: SaksiUnsur[];
  dasar: string[];
  catatan: string[];
};

export type MasukanRekomendasiPutusan = {
  jenisPerkara: string;
  nomorPerkara: string;
  jenisPerkaraId?: number | null;
  sebutan?: { P: string; T: string };
  saksi: SaksiMasuk[];
  bukti: BuktiMasuk[];
  /** Hasil penilai pembuktian A2 (cerai, perkara bermatriks dalil); null = belum ada, alasan dibaca dari keterangan saksi. */
  penilaian?: HasilPenilaian | null;
  /** Kehadiran: Tergugat/Termohon pernah hadir di sidang mana pun (null = tidak diketahui); verstekSipp = penanda SIPP. */
  kehadiran?: { tPernahHadir?: boolean | null; verstekSipp?: boolean | null; pTidakHadirLagi?: boolean | null } | null;
  /** Huruf alasan (#8503# / matriks dalil), mis. "F" atau "AF". */
  huruf?: string;
  /** Tanggal acuan (YYYY-MM-DD) menghitung "sejak bulan Mei 2023": tanggal putusan / sidang terakhir; kosong = hari ini. */
  acuan?: string;
  /** Penanda formil yang sudah dideteksi di tempat lain (bukan ditebak di sini). */
  formil?: { cacatFormil?: boolean; kurangPihak?: boolean; kuasaTidakSah?: boolean; eksepsi?: "absolut" | "relatif" | "" } | null;
  /** Itsbat: tanggal nikah menurut SIPP (perkara_data_itsbat.tgl_menikah), YYYY-MM-DD. */
  tanggalNikah?: string;
};

export type PilihanLain = { hasil: Exclude<HasilRekomendasiPutusan, "">; label: string; keyakinan: "ragu"; alasan: string; blangko: string };

export type RekomendasiPutusan = {
  versi: number;
  jenis: JenisRekomendasiPutusan;
  hasil: HasilRekomendasiPutusan;
  verstek: boolean;
  /** "Dikabulkan (verstek)", "Ditolak", "Tidak Dapat Diterima", "Belum dapat direkomendasikan". */
  label: string;
  /** Nama status SIPP (peta blangko): "Dikabulkan" | "Ditolak" | "Tidak Dapat Diterima" | "". */
  statusSipp: string;
  keyakinan: "cukup" | "ragu";
  sebabRagu: string[];
  unsur: UnsurRekomendasi[];
  /** Judul unsur yang belum terbukti / tidak terbukti. */
  belum: string[];
  /** Blangko putusan yang cocok (pertama = utama), bentuk saran blangko portal. */
  blangko: Rekomendasi[];
  /**
   * Keputusan 133 (R1): pilihan kedua yang ditampilkan TEGAS di kotak bila hasil bergantung penilaian hakim (DK tanpa kehamilan /
   * hubungan badan: utama Ditolak - ragu, pilihan lain Dikabulkan - ragu). Blangkonya tepat di bawah blangko utama. null = tidak ada.
   */
  pilihanLain: PilihanLain | null;
  /** Kalimat ringkas untuk kepala kotak. */
  ringkas: string;
  jumlahSaksi: { P: number; T: number };
  jumlahBukti: number;
  ms: number;
};

// ─── Dasar hukum (hanya dari referensi resmi / blangko Derry) ────────────────

export const DASAR = {
  aktaNikah: "Pasal 7 ayat (1) Kompilasi Hukum Islam",
  aktaOtentik: "Pasal 285 RBg",
  kewenanganCg: "Pasal 73 Undang-Undang Nomor 7 Tahun 1989 sebagaimana telah diubah dengan Undang-Undang Nomor 3 Tahun 2006 dan Undang-Undang Nomor 50 Tahun 2009",
  pecah: "Pasal 39 ayat (2) Undang-Undang Nomor 1 Tahun 1974",
  keluarga: "Pasal 22 ayat (2) Peraturan Pemerintah Nomor 9 Tahun 1975",
  syiqaq: "Pasal 76 ayat (1) Undang-Undang Nomor 7 Tahun 1989",
  saksiFormil: "Pasal 172 ayat (1) RBg",
  saksiMateril: "Pasal 308 dan Pasal 309 RBg",
  unus: "Pasal 306 RBg",
  pisah: "SEMA Nomor 1 Tahun 2022 Kamar Agama angka 1 huruf b jo. SEMA Nomor 3 Tahun 2023 Kamar Agama angka 1",
  nafkah: "SEMA Nomor 1 Tahun 2022 Kamar Agama angka 1 huruf b",
  verstek: "Pasal 149 ayat (1) RBg",
  verstekCerai: "SEMA Nomor 3 Tahun 2015 Kamar Agama angka 3",
  pTidakHadir: "SEMA Nomor 1 Tahun 2022 Kamar Agama angka 5 huruf a",
  pengakuan: "Pasal 311 RBg",
  // Itsbat
  kewenanganIn: "Pasal 49 huruf a Undang-Undang Nomor 3 Tahun 2006 beserta penjelasannya angka 22 jo. Pasal 7 ayat (2), ayat (3), dan ayat (4) Kompilasi Hukum Islam",
  legalIn: "Pasal 7 ayat (4) Kompilasi Hukum Islam",
  alasanIn: "Pasal 7 ayat (3) Kompilasi Hukum Islam",
  sahAgama: "Pasal 2 ayat (1) Undang-Undang Nomor 1 Tahun 1974 jo. Pasal 4 Kompilasi Hukum Islam",
  rukun: "Pasal 14 Kompilasi Hukum Islam",
  saksiNikah: "Pasal 24 dan Pasal 25 Kompilasi Hukum Islam",
  mahar: "Pasal 30 Kompilasi Hukum Islam",
  halangan: "Pasal 8 sampai dengan Pasal 10 Undang-Undang Nomor 1 Tahun 1974 jo. Pasal 39 sampai dengan Pasal 44 Kompilasi Hukum Islam",
  umur: "Pasal 7 ayat (1) Undang-Undang Nomor 1 Tahun 1974 sebagaimana telah diubah dengan Undang-Undang Nomor 16 Tahun 2019",
  poligamiSirri: "SEMA Nomor 3 Tahun 2018 Kamar Agama huruf A angka 8",
  monogami: "Pasal 3 ayat (2) dan Pasal 4 Undang-Undang Nomor 1 Tahun 1974",
  istifadhah: "SEMA Nomor 10 Tahun 2020 Kamar Agama huruf C angka 1 huruf a",
  sirri: "SEMA Nomor 7 Tahun 2012 Kamar Agama angka 13",
  saksiFormilP: "Pasal 171, Pasal 172 ayat (2), dan Pasal 175 RBg",
  saksiMaterilP: "Pasal 307 dan Pasal 308 RBg",
  // Dispensasi kawin
  kewenanganDk: "Pasal 49 ayat (1) huruf a dan ayat (2) beserta Penjelasan Pasal 49 ayat (2) angka 3 Undang-Undang Nomor 7 Tahun 1989",
  legalDk: "Pasal 6 ayat (1) Peraturan Mahkamah Agung Nomor 5 Tahun 2019",
  mendesak: "Pasal 7 ayat (2) Undang-Undang Nomor 1 Tahun 1974 sebagaimana telah diubah dengan Undang-Undang Nomor 16 Tahun 2019 beserta Penjelasannya",
  dengarCalon: "Pasal 7 ayat (3) Undang-Undang Nomor 1 Tahun 1974 sebagaimana telah diubah dengan Undang-Undang Nomor 16 Tahun 2019",
  dengarPerma: "Pasal 13 Peraturan Mahkamah Agung Nomor 5 Tahun 2019",
  nasihatDk: "Pasal 12 Peraturan Mahkamah Agung Nomor 5 Tahun 2019",
  halanganDk: "Pasal 16 huruf d Peraturan Mahkamah Agung Nomor 5 Tahun 2019",
  paksaanDk: "Pasal 14 dan Pasal 16 huruf i Peraturan Mahkamah Agung Nomor 5 Tahun 2019",
  ahliDk: "Pasal 15 huruf d dan Pasal 16 huruf h Peraturan Mahkamah Agung Nomor 5 Tahun 2019",
  terbaikAnak: "Pasal 2 huruf a dan Pasal 17 huruf a Peraturan Mahkamah Agung Nomor 5 Tahun 2019",
} as const;

// ─── Teks ────────────────────────────────────────────────────────────────────

const polos = (t: unknown) =>
  String(t == null ? "" : t)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/\\n/g, "\n")
    .replace(/[‘’`]/g, "'")
    .replace(/[ \t]+/g, " ")
    .trim();
const kecil = (t: unknown) => polos(t).replace(/\s+/g, " ").toLowerCase().replace(/\bisteri\b/g, "istri");
function kutip(t: string, n = 170): string {
  const p = polos(t).replace(/\s+/g, " ").replace(/;\s*$/, "");
  if (p.length <= n) return p;
  const potong = p.slice(0, n);
  const sela = potong.lastIndexOf(" ");
  return `${potong.slice(0, sela > n * 0.6 ? sela : n)} ...`;
}

/** Jenis rekomendasi dari nama jenis SIPP + nomor perkara; null = di luar cakupan (jenis lain). */
export function jenisRekomendasi(jenisPerkara: unknown, nomorPerkara: unknown, jenisPerkaraId?: number | null): JenisRekomendasiPutusan | null {
  const j = kunciJenisPerkara(jenisPerkara);
  const id = Number(jenisPerkaraId) || 0;
  if (id === 347 || /cerai gugat/.test(j)) return "cerai-gugat";
  if (id === 346 || /cerai talak/.test(j)) return "cerai-talak";
  if (id === 362 || /dispensasi kawin|dispensasi nikah/.test(j)) return "dk";
  if (id === 360 || /itsbat|isbat|istbat|pengesahan perkawinan|pengesahan nikah/.test(j)) return /\/pdt\.g\//i.test(String(nomorPerkara ?? "")) ? "itsbat-kontensius" : "itsbat";
  return null;
}

// ─── Saksi ───────────────────────────────────────────────────────────────────

type BarisS = { tanya: string; jawab: string; s: string; q: string; deAuditu: boolean; langsung: boolean; tidakLangsung: boolean; tj: Map<string, -1 | 0 | 1>; tq: Map<string, -1 | 0 | 1> };
type SaksiSiap = {
  id: string;
  pihak: "P" | "T" | "";
  ke: number;
  label: string;
  hubungan: string;
  golongan: SaksiUnsur["golongan"];
  baris: BarisS[];
  sisa: number;
};

const RE_KELUARGA =
  /\b(?:ayah|bapak|ibu|mama|papa|kakak|adik|abang|paman|om|bibi|tante|kakek|nenek|sepupu|keponakan|kemenakan|ipar|mertua|menantu|cucu|saudara|anak (?:kandung|tiri)|ponakan|keluarga|kelurga|memantu|sepupu|besan|ayah tiri|ibu tiri)\b/;
const RE_DEKAT = /\b(?:tetangga|tetnagga|tetanga|teman|sahabat|rekan|kenalan|imam|kepala desa|kepala dusun|ketua rt|ketua rw|tokoh|guru|atasan|majikan|sekampung|rumah saya|kediaman saya)\b/;
const RE_BUKAN_KELUARGA = /\b(?:tidak (?:ada |mempunyai |memiliki )?hubungan (?:keluarga|darah|saudara)|bukan (?:keluarga|saudara))\b/;
const RE_DE_AUDITU =
  /\b(?:dengar|mendengar|diceritakan|bercerita|cerita|diberitahu|diberi tahu|informasi|kabar|katanya|menurut)\s+(?:\S+\s+){0,3}(?:dari|oleh)\s+(?:\S+\s+){0,2}(?:penggugat|tergugat|pemohon|termohon|orang|keluarga|tetangga|ibu|ayah|bapak|kakak|adik|anak|istri|suami|saudara|teman|para)|\b(?:hanya|cuma) (?:\S+\s+){0,2}(?:dengar|mendengar|cerita|diceritakan|diberitahu)\b|\btahu dari cerita\b|\bberdasarkan cerita\b|\bmendapat informasi\b/;
const RE_LANGSUNG = /\b(?:melihat sendiri|melihat langsung|menyaksikan|mendengar sendiri|mendengar langsung|saya lihat|saksi lihat|pernah melihat|saya hadir|hadir (?:sewaktu|saat|pada|ketika)|sebagai saksi (?:nikah|pernikahan))\b/;
const RE_TIDAK_LANGSUNG = /\b(?:tidak|belum) (?:pernah )?(?:melihat|mendengar|menyaksikan|hadir)\b/;
const RE_SISA = /\.{4,}|_{3,}|…{2,}/;
const RE_IYA = /^(?:ya|iya|benar|betul|pernah|sering|sudah|ada|tahu)\b/;
/** Saksi tidak mengetahui hal yang ditanyakan - bukan keterangan mendukung atau sebaliknya. */
const RE_TIDAK_TAHU = /\b(?:tidak|belum|kurang) (?:\S+\s+){0,1}(?:tahu|mengetahui|mengetahi|megetahui|mengerti|ingat)\b|\bkurang jelas\b/;
const RE_PENYAKIT_TAMBAH = /\b(?:gangguan jiwa|gangguan kejiwaan|sakit jiwa|odgj|lumpuh total)\b/;
/** Pertanyaan maksud/alasan mengajukan perkara: saksi mengulang alasan pihak, bukan fakta yang diketahuinya. */
const RE_TANYA_MAKSUD = /\b(?:kenapa|mengapa|apa (?:alasan|sebab)|maksud|tujuan)\b.*\b(?:mengajukan|bercerai|menggugat|menghadap|memohon)\b/;
const RE_BUKAN = /^(?:tidak|belum|bukan|tidak pernah|tidak ada)\b/;

/** Baris perkenalan (kenal / hubungan keluarga) - menurut pertanyaan, atau jawabannya bila kolom pertanyaan kosong. */
const RE_KENAL = /\b(?:kenal|mengenal|hubungan|keluarga)\b/;
const barisKenal = (baris: BarisS[]) => baris.slice(0, 6).filter((r) => RE_KENAL.test(r.q) || (!r.q && RE_KENAL.test(r.s)));

function hubunganDariJawaban(baris: BarisS[]): string {
  for (const r of barisKenal(baris)) {
    const m = /\b(?:saya (?:adalah|sebagai|merupakan)|sebagai|selaku|karena saya)\s+((?:\S+\s+){0,3}?(?:ayah|bapak|ibu|kakak|adik|abang|paman|om|bibi|tante|kakek|nenek|sepupu|keponakan|kemenakan|ipar|mertua|menantu|cucu|saudara|tetangga|teman|sahabat|rekan|imam|kepala desa|kepala dusun)(?:\s+(?:kandung|tiri|sepupu|ipar|kerja|dekat))?)/.exec(r.s);
    if (m) return m[1].trim();
    if (/\btetangga\b/.test(r.s)) return "tetangga";
    // "karena Penggugat sepupu 2 kali saya", "Pemohon adalah keponakan saya"
    const b = /\b((?:ayah|bapak|ibu|kakak|adik|paman|om|bibi|tante|kakek|nenek|sepupu|keponakan|kemenakan|ipar|mertua|menantu|cucu|saudara|anak)(?:\s+(?:kandung|tiri|sepupu|ipar|\d+ kali))?)\s+saya\b/.exec(r.s);
    if (b && !RE_BUKAN_KELUARGA.test(r.s)) return b[1].trim();
  }
  return "";
}
function golonganDari(hubungan: string, baris: BarisS[]): SaksiUnsur["golongan"] {
  const h = hubungan.toLowerCase();
  if (h && RE_KELUARGA.test(h) && !RE_BUKAN_KELUARGA.test(h)) return "keluarga";
  if (h && RE_DEKAT.test(h)) return "dekat";
  const awal = barisKenal(baris);
  for (const r of awal) {
    if (RE_DEKAT.test(r.s)) return "dekat";
    if (RE_KELUARGA.test(r.s) && !RE_BUKAN_KELUARGA.test(r.s)) return "keluarga";
  }
  if (awal.some((r) => RE_BUKAN_KELUARGA.test(r.s))) return "lain";
  return h ? "lain" : "";
}

/** Jawaban yang masih memuat dua pilihan blangko sekaligus ("Ya, saya hadir ...<br>Tidak, saya tidak hadir ...") atau titik isian. */
function barisSisa(jawabMentah: string): boolean {
  const t = polos(jawabMentah);
  if (RE_SISA.test(t)) return true;
  const pecah = t.split(/\n+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (pecah.length >= 2 && pecah.some((x) => /^(?:ya|iya|pernah|benar)\b/.test(x)) && pecah.some((x) => /^(?:tidak|belum)\b/.test(x))) return true;
  // Bot merapatkan <br>: "Ya, saya hadir ...; Tidak, saya tidak hadir ..." dalam satu baris.
  return /^(?:ya|iya|pernah|benar)\b.*[;.]\s*(?:tidak|belum)\b,?\s+saya\s+(?:tidak|belum)\b/i.test(t.replace(/\s+/g, " "));
}

function siapkanSaksi(daftar: SaksiMasuk[], sb: { P: string; T: string }): SaksiSiap[] {
  const out: SaksiSiap[] = [];
  const urut = { P: 0, T: 0, "": 0 } as Record<string, number>;
  for (const x of Array.isArray(daftar) ? daftar : []) {
    if (!x || !Array.isArray(x.baris)) continue;
    let sisa = 0;
    const baris: BarisS[] = [];
    for (const r of x.baris) {
      const jawab = String((r && r.jawab) || "");
      if (!polos(jawab)) continue;
      if (barisSisa(jawab)) {
        sisa += 1;
        continue;
      }
      const s = kecil(jawab);
      const q = kecil(r && r.tanya);
      // Topik dihitung SEKALI per baris (dipakai berulang untuk tiap alasan).
      baris.push({ tanya: String((r && r.tanya) || ""), jawab, s, q, deAuditu: RE_DE_AUDITU.test(s), langsung: RE_LANGSUNG.test(s) && !RE_TIDAK_LANGSUNG.test(s), tidakLangsung: RE_TIDAK_LANGSUNG.test(s), tj: topikKalimat(s), tq: topikKalimat(q) });
    }
    if (!baris.length && !sisa) continue;
    const pihak = x.pihak === "P" || x.pihak === "T" ? x.pihak : "";
    urut[pihak] += 1;
    const ke = Number(x.ke) > 0 ? Number(x.ke) : urut[pihak];
    const hubungan = polos(x.hubungan) || hubunganDariJawaban(baris);
    out.push({
      id: String(x.id || `${pihak}${ke}`),
      pihak,
      ke,
      label: `Saksi ${ke}${pihak ? ` ${pihak === "P" ? sb.P : sb.T}` : ""}`,
      hubungan,
      golongan: golonganDari(hubungan, baris),
      baris,
      sisa,
    });
  }
  return out;
}

/** Arah satu baris atas satu topik: jawaban pendek "Ya"/"Tidak" memakai topik pertanyaannya. */
function arahBaris(r: BarisS, topik: string): -1 | 0 | 1 | null {
  if (RE_TANYA_MAKSUD.test(r.q)) return null;
  // "Saya tidak tahu penyebab perselisihan" / "tidak mengetahui ... sering bertengkar": tidak menegaskan apa pun.
  if (RE_TIDAK_TAHU.test(r.s) && !/\b(?:hanya|namun|tetapi|tapi|yang saya) (?:\S+\s+){0,3}(?:tahu|ketahui|mengetahui|melihat)\b/.test(r.s)) return null;
  // Pelengkap topik penyakit (huruf E): "gangguan jiwa" belum dikenali pengenal topik bersama.
  if (topik === "penyakit" && RE_PENYAKIT_TAMBAH.test(r.s) && !/\btidak (?:\S+\s+){0,2}(?:mengalami|menderita)\b/.test(r.s)) return 1;
  const tj = r.tj;
  if (tj.has(topik)) {
    const a = tj.get(topik)!;
    return a === 0 ? 1 : a;
  }
  const tq = r.tq;
  if (!tq.has(topik)) return null;
  if (RE_IYA.test(r.s)) return tq.get(topik) === -1 ? -1 : 1;
  if (RE_BUKAN.test(r.s)) return tq.get(topik) === -1 ? 1 : -1;
  return null;
}

type Sikap = { saksi: SaksiSiap; arah: -1 | 1; langsung: boolean; r: BarisS };
/** Sikap tiap saksi atas satu topik (baris pertama yang menyatakan; sebaliknya menang bila ada keduanya tanpa "dulu"). */
function sikapTopik(saksi: SaksiSiap[], topik: string): Sikap[] {
  const out: Sikap[] = [];
  for (const x of saksi) {
    let ya: BarisS | null = null;
    let tidak: BarisS | null = null;
    let tidakLangsungTopik = false;
    let langsungTopik = false;
    for (const r of x.baris) {
      const a = arahBaris(r, topik);
      if (a === null) continue;
      if (r.tidakLangsung && !r.langsung) tidakLangsungTopik = true;
      if (r.langsung && !r.tidakLangsung) langsungTopik = true;
      if (a === 1 && !ya) ya = r;
      if (a === -1 && !tidak) tidak = r;
    }
    const r = ya || tidak;
    if (!r) continue;
    const deAuditu = (r.deAuditu || tidakLangsungTopik) && !langsungTopik;
    out.push({ saksi: x, arah: ya ? 1 : -1, langsung: !deAuditu, r });
  }
  return out;
}

const dasarSaksi = (s: Sikap): SaksiUnsur => ({
  label: s.saksi.label,
  hubungan: s.saksi.hubungan,
  golongan: s.saksi.golongan,
  langsung: s.langsung,
  sebaliknya: s.arah === -1,
  tanya: kutip(s.r.tanya, 120),
  kutipan: kutip(s.r.jawab),
});

/** Baris pertama yang pertanyaan atau jawabannya cocok pola (untuk unsur itsbat / DK yang tidak punya topik umum). */
/**
 * Baris pertama yang PERTANYAANNYA cocok; bila tidak ada (BAS tanpa kolom pertanyaan, atau pertanyaan berbeda susunan), baris pertama
 * yang JAWABANNYA cocok pola cadangan.
 */
function barisCocok(x: SaksiSiap, tanya: RegExp, cadangan?: RegExp): BarisS | null {
  for (const r of x.baris) if (tanya.test(r.q)) return r;
  if (cadangan) for (const r of x.baris) if (cadangan.test(r.s)) return r;
  return null;
}
const saksiDari = (x: SaksiSiap, r: BarisS, sebaliknya = false): SaksiUnsur => ({
  label: x.label,
  hubungan: x.hubungan,
  golongan: x.golongan,
  langsung: !(r.deAuditu || (r.tidakLangsung && !r.langsung)),
  sebaliknya,
  tanya: kutip(r.tanya, 120),
  kutipan: kutip(r.jawab),
});

// ─── Lama waktu ("6 bulan", "sejak Mei 2023") ────────────────────────────────

const BULAN: Record<string, number> = { januari: 1, februari: 2, pebruari: 2, maret: 3, april: 4, mei: 5, juni: 6, juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, nopember: 11, desember: 12 };
const ANGKA: Record<string, number> = { satu: 1, se: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10, sebelas: 11, "dua belas": 12 };

/** Lama (bulan) yang disebut satu kalimat, relatif terhadap tanggal acuan; null bila tidak disebut. Ambil terlama. */
export function lamaBulan(teks: string, acuan: string): number | null {
  const s = kecil(teks);
  const [ay, am] = /^(\d{4})-(\d{2})/.test(acuan) ? [Number(acuan.slice(0, 4)), Number(acuan.slice(5, 7))] : [new Date().getFullYear(), new Date().getMonth() + 1];
  const hasil: number[] = [];
  for (const m of s.matchAll(/\b(\d{1,2}|satu|dua belas|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas)\s*(?:\(\s*[a-z ]+\s*\)\s*)?(bulan|tahun)\b/g)) {
    const n = /^\d+$/.test(m[1]) ? Number(m[1]) : ANGKA[m[1]] || 0;
    if (n > 0) hasil.push(m[2] === "tahun" ? n * 12 : n);
  }
  for (const m of s.matchAll(/\bse(bulan|tahun)\b/g)) hasil.push(m[1] === "tahun" ? 12 : 1);
  for (const m of s.matchAll(/\b(?:sejak|semenjak|mulai|dari)\s+(?:(?:awal|akhir|pertengahan|tengah)\s+)?(?:bulan\s+)?(januari|februari|pebruari|maret|april|mei|juni|juli|agustus|september|oktober|november|nopember|desember)\s+(?:tahun\s+)?(\d{4})\b/g)) {
    const d = (ay - Number(m[2])) * 12 + (am - BULAN[m[1]]);
    if (d >= 0 && d < 600) hasil.push(d);
  }
  for (const m of s.matchAll(/\b(?:sejak|semenjak|mulai|dari)\s+(?:(awal|akhir|pertengahan|tengah)\s+)?tahun\s+(\d{4})\b/g)) {
    const bln = m[1] === "awal" ? 1 : m[1] === "pertengahan" || m[1] === "tengah" ? 6 : 12; // tanpa keterangan: anggap akhir tahun (lama terpendek)
    const d = (ay - Number(m[2])) * 12 + (am - bln);
    if (d >= 0 && d < 600) hasil.push(d);
  }
  return hasil.length ? Math.max(...hasil) : null;
}

/**
 * Masa berlaku rumusan Kamar Agama untuk perceraian (Kompilasi Rumusan Hukum edisi 2026): SEMA 1/2022 tanggal 15 Desember 2022
 * (nafkah 12 bulan; perselisihan terus-menerus ATAU pisah 6 bulan), SEMA 3/2023 tanggal 29 Desember 2023 (perselisihan DIIKUTI pisah
 * paling singkat 6 bulan kecuali KDRT). Acuan = tanggal putusan/sidang; kosong = hari ini.
 */
export function masaSema(acuan: string): "sebelum" | "sema-2022" | "sema-2023" {
  const a = /^\d{4}-\d{2}-\d{2}/.test(String(acuan || "")) ? acuan.slice(0, 10) : new Date().toISOString().slice(0, 10);
  return a >= "2023-12-29" ? "sema-2023" : a >= "2022-12-15" ? "sema-2022" : "sebelum";
}

// ─── Bukti ───────────────────────────────────────────────────────────────────

type KelasB = { kelas: string; membuktikan: string; tanda: string[] };
const KELAS_BUKTI: Array<{ re: RegExp } & KelasB> = [
  { re: /\bputusan\b.*\b(?:zina|perzinahan|perzinaan|284)\b/, kelas: "putusan pidana zina", membuktikan: "perzinaan pihak itu (putusan pengadilan)", tanda: ["zina", "otentik"] },
  { re: /\bputusan\b.*\b(?:pidana|penjara|pengadilan negeri)\b|\bpetikan putusan\b/, kelas: "putusan pidana", membuktikan: "pihak itu dijatuhi pidana", tanda: ["penjara", "otentik"] },
  { re: /\b(?:akta|akte) cerai\b|\bputusan\b.*\b(?:cerai|perceraian)\b/, kelas: "akta cerai", membuktikan: "perkawinan sebelumnya telah putus karena perceraian", tanda: ["cerai-dulu", "otentik"] },
  { re: /\b(?:akta|akte|surat keterangan) kematian\b|\bsurat (?:keterangan )?meninggal\b/, kelas: "akta/surat kematian", membuktikan: "pasangan/pihak telah meninggal dunia", tanda: ["mati", "otentik"] },
  { re: /\bduplikat (?:kutipan )?akta nikah\b|\bakta nikah\b|\bbuku nikah\b|\bkutipan akta (?:nikah|perkawinan)\b|\bakta perkawinan\b/, kelas: "akta nikah", membuktikan: "hubungan hukum perkawinan (suami istri yang sah)", tanda: ["nikah", "otentik"] },
  { re: /\b(?:penolakan|menolak|ditolak)\b.*\b(?:kua|kantor urusan agama|pencatat|nikah|perkawinan)\b|\b(?:n-?9|model n9|pemberitahuan (?:adanya )?(?:halangan|kekurangan|penolakan))\b/, kelas: "surat penolakan KUA", membuktikan: "kehendak nikah ditolak KUA karena belum cukup umur", tanda: ["tolak-kua"] },
  { re: /\bsurat keterangan\b.*\b(?:tidak tercatat|belum tercatat|tidak terdaftar)\b|\b(?:tidak tercatat|tidak terdaftar)\b.*\b(?:kua|kantor urusan agama)\b/, kelas: "keterangan perkawinan tidak tercatat", membuktikan: "perkawinan tidak tercatat di KUA", tanda: ["tak-tercatat"] },
  { re: /\bsurat keterangan\b.*\b(?:hamil|kehamilan|usg)\b|\b(?:hasil )?(?:pemeriksaan|tes) (?:kehamilan|urine|usg)\b|\b(?:dokter|bidan|puskesmas|rumah sakit|tenaga kesehatan)\b/, kelas: "keterangan tenaga kesehatan", membuktikan: "keadaan kesehatan/kehamilan menurut tenaga kesehatan", tanda: ["kesehatan"] },
  { re: /\b(?:psikolog|pekerja sosial|p2tp2a|kpai|kpad|dp3a|uptd ppa)\b/, kelas: "rekomendasi psikolog/pekerja sosial", membuktikan: "rekomendasi tenaga ahli atas kesiapan anak", tanda: ["ahli"] },
  { re: /\b(?:akta|akte|kutipan akta) kelahiran\b|\bkartu identitas anak\b|\bkia\b/, kelas: "akta kelahiran", membuktikan: "tanggal lahir/umur dan asal usul anak", tanda: ["umur", "anak", "otentik"] },
  { re: /\bijazah\b|\bsurat keterangan (?:masih )?sekolah\b|\bsurat keterangan lulus\b/, kelas: "ijazah/keterangan sekolah", membuktikan: "pendidikan dan tanggal lahir anak", tanda: ["umur", "sekolah"] },
  { re: /\bkartu keluarga\b|\bkk\b/, kelas: "kartu keluarga", membuktikan: "susunan keluarga dan tempat kediaman", tanda: ["domisili", "keluarga", "otentik"] },
  { re: /\bkartu tanda penduduk\b|\bktp\b|\bktp-el\b/, kelas: "KTP", membuktikan: "identitas dan tempat kediaman", tanda: ["domisili", "otentik"] },
  { re: /\bsurat keterangan\b.*\b(?:domisili|bertempat tinggal|tempat tinggal)\b/, kelas: "keterangan domisili", membuktikan: "tempat kediaman", tanda: ["domisili"] },
  { re: /\bsurat keterangan\b.*\b(?:ghaib|gaib|tidak diketahui)\b/, kelas: "keterangan ghaib", membuktikan: "tempat tinggal pihak tidak diketahui", tanda: ["kabar"] },
  { re: /\bvisum\b/, kelas: "visum", membuktikan: "luka akibat kekerasan", tanda: ["kekerasan"] },
  { re: /\bsurat (?:keterangan )?(?:perpindahan|pindah) agama\b|\bmurtad\b/, kelas: "keterangan perpindahan agama", membuktikan: "pihak itu berpindah agama", tanda: ["murtad"] },
  { re: /\bsurat (?:keterangan )?(?:kawin|nikah) (?:siri|sirri|dibawah tangan|di bawah tangan)\b|\bsurat keterangan (?:telah )?menikah\b/, kelas: "keterangan nikah (desa/imam)", membuktikan: "peristiwa pernikahan menurut keterangan desa/imam", tanda: ["nikah-desa"] },
];

type BuktiSiap = BuktiUnsur & { tanda: Set<string>; teks: string; topik: Map<string, -1 | 0 | 1> };
function siapkanBukti(daftar: BuktiMasuk[]): BuktiSiap[] {
  const out: BuktiSiap[] = [];
  for (const b of Array.isArray(daftar) ? daftar : []) {
    const s = kecil(b && b.teks);
    if (!s || s.length < 5) continue;
    const k = KELAS_BUKTI.find((x) => x.re.test(s));
    const tanda = new Set(k ? k.tanda : []);
    if (k && tanda.has("otentik") && b.jenis !== "surat") tanda.delete("otentik");
    const topik = topikKalimat(s);
    out.push({ kode: String(b.kode || ""), kelas: k ? k.kelas : b.jenis === "elektronik" ? "bukti elektronik" : "bukti surat", membuktikan: k ? k.membuktikan : "isi surat/bukti elektronik itu", tanda, teks: s, topik });
  }
  return out;
}
const buktiUnsur = (b: BuktiSiap, membuktikan?: string): BuktiUnsur => ({ kode: b.kode, kelas: b.kelas, membuktikan: membuktikan || b.membuktikan });
const sebutBukti = (d: BuktiSiap[]) => d.map((b) => (b.kode ? `${b.kode} (${b.kelas})` : b.kelas)).join(", ");
const sebutSaksi = (d: Array<{ label: string }>) => d.map((x) => x.label).join(" dan ");

// ─── Unsur umum ──────────────────────────────────────────────────────────────

function unsur(id: string, judul: string, status: StatusUnsur, ringkas: string, o: Partial<UnsurRekomendasi> = {}): UnsurRekomendasi {
  return { id, judul, status, ringkas, bukti: o.bukti || [], saksi: o.saksi || [], dasar: o.dasar || [], catatan: o.catatan || [] };
}

function unsurSaksiFormil(saksi: SaksiSiap[], pihak: "P" | "T", sb: { P: string; T: string }, dasar: string[]): UnsurRekomendasi {
  const milik = saksi.filter((x) => x.pihak === pihak || !x.pihak);
  const sisa = saksi.filter((x) => x.sisa > 0);
  const catatan = sisa.length ? [`Keterangan ${sebutSaksi(sisa)} masih memuat isian blangko yang belum dipilih (dua pilihan sekaligus atau titik-titik); baris itu tidak dinilai.`] : [];
  if (!milik.length) return unsur("saksi", `Saksi ${sb[pihak]}`, "belum", `Belum ada keterangan saksi ${sb[pihak]} yang tercatat.`, { dasar, catatan });
  const ring = milik.map((x) => `${x.label}${x.hubungan ? ` (${x.hubungan})` : x.golongan === "lain" ? " (bukan keluarga)" : ""}`).join("; ");
  return unsur("saksi", `Saksi ${sb[pihak]}`, milik.length >= 2 ? "terbukti" : "belum", `${milik.length} saksi didengar di bawah sumpah: ${ring}.${milik.length < 2 ? " Satu saksi saja belum mencapai batas minimal (unus testis nullus testis)." : ""}`, {
    dasar: milik.length < 2 ? [...dasar, DASAR.unus] : dasar,
    catatan,
  });
}

function unsurIdentitas(bukti: BuktiSiap[], sb: { P: string; T: string }, dasar: string[], judul = "Identitas dan tempat kediaman (kewenangan relatif)"): UnsurRekomendasi {
  const d = bukti.filter((b) => b.tanda.has("domisili"));
  if (d.length) return unsur("identitas", judul, "terbukti", `${sebutBukti(d)} membuktikan identitas dan tempat kediaman ${sb.P}.`, { bukti: d.map((b) => buktiUnsur(b)), dasar: [DASAR.aktaOtentik, ...dasar] });
  return unsur("identitas", judul, "catatan", bukti.length ? "Bukti identitas (KTP/KK) tidak ditemukan di daftar bukti; kewenangan dibaca dari alamat dalam surat gugatan/permohonan." : "Bukti surat belum tercatat; kewenangan dibaca dari alamat dalam surat gugatan/permohonan.", { dasar });
}

// ─── CERAI ───────────────────────────────────────────────────────────────────

const LABEL_TOPIK_ALASAN: Record<string, { huruf: string; judul: string }> = {
  selisih: { huruf: "F", judul: "perselisihan dan pertengkaran terus-menerus" },
  selingkuh: { huruf: "A", judul: "zina / pihak ketiga" },
  candu: { huruf: "A", judul: "pemabuk, pemadat, penjudi" },
  kabar: { huruf: "B", judul: "meninggalkan 2 tahun berturut-turut tanpa izin" },
  penjara: { huruf: "C", judul: "hukuman penjara 5 tahun atau lebih" },
  kekerasan: { huruf: "D", judul: "kekejaman / penganiayaan berat" },
  penyakit: { huruf: "E", judul: "cacat badan / penyakit" },
  murtad: { huruf: "H", judul: "peralihan agama (murtad)" },
};

function rekomendasiCerai(m: MasukanRekomendasiPutusan, jenis: "cerai-gugat" | "cerai-talak", sb: { P: string; T: string }, saksi: SaksiSiap[], bukti: BuktiSiap[]) {
  const acuan = String(m.acuan || "");
  const ragu: string[] = [];
  const unsurL: UnsurRekomendasi[] = [];
  const sp = saksi.filter((x) => x.pihak !== "T");
  const verstek = m.kehadiran?.verstekSipp === true || m.kehadiran?.tPernahHadir === false;

  const masa = masaSema(acuan);
  // 1. Hubungan hukum perkawinan (legal standing): akta nikah (Pasal 7 ayat (1) KHI).
  const akta = bukti.filter((b) => b.tanda.has("nikah"));
  let tanpaAkta = false;
  // Cerai kumulasi itsbat nikah: saksi ditanya wali / ijab kabul / saksi nikah - perkawinan dibuktikan lewat itsbat, bukan akta.
  const itsbatKumulasi = !akta.length && saksi.some((x) => x.baris.some((r) => RE_Q_WALI.test(r.q) || RE_Q_IJAB.test(r.q) || RE_Q_SAKSI_NIKAH.test(r.q)));
  if (akta.length) unsurL.push(unsur("nikah", "Hubungan hukum perkawinan", "terbukti", `${sebutBukti(akta)} membuktikan ${sb.P} dan ${sb.T} suami istri yang sah; akta otentik berkekuatan sempurna dan mengikat.`, { bukti: akta.map((b) => buktiUnsur(b)), dasar: [DASAR.aktaNikah, DASAR.aktaOtentik] }));
  else if (itsbatKumulasi) {
    unsurL.push(unsur("nikah", "Hubungan hukum perkawinan", "catatan", `Tanpa akta nikah; saksi menerangkan peristiwa nikah (wali, saksi nikah, ijab kabul): perkawinan dibuktikan dengan itsbat nikah yang dikumulasikan.`, { dasar: [DASAR.aktaNikah, DASAR.alasanIn] }));
    ragu.push("perkara tampak kumulasi itsbat nikah - nilai rukun nikah lebih dulu");
  } else {
    tanpaAkta = bukti.length > 0;
    unsurL.push(
      unsur("nikah", "Hubungan hukum perkawinan", bukti.length ? "tidak-terbukti" : "belum", bukti.length ? "Tidak ada akta nikah/buku nikah di daftar bukti: perkawinan hanya dapat dibuktikan dengan akta nikah (bila tidak ada, itsbat nikah dikumulasikan)." : "Bukti surat belum tercatat; hubungan perkawinan dibuktikan dengan akta nikah.", { dasar: [DASAR.aktaNikah] })
    );
    if (!bukti.length) ragu.push("bukti surat belum tercatat");
  }
  // 2. Identitas & kewenangan relatif.
  unsurL.push(unsurIdentitas(bukti, sb, jenis === "cerai-gugat" ? [DASAR.kewenanganCg] : []));
  // 3. Saksi (formil) & keluarga/orang dekat (Pasal 22 ayat (2) PP 9/1975, Pasal 76 UU 7/1989).
  const formil = unsurSaksiFormil(saksi, "P", sb, [DASAR.saksiFormil, DASAR.saksiMateril]);
  unsurL.push(formil);
  const dekat = sp.filter((x) => x.golongan === "keluarga" || x.golongan === "dekat");
  const kelUnsur = dekat.length
    ? unsur("keluarga", "Keluarga / orang dekat didengar", "terbukti", `${sebutSaksi(dekat)} adalah keluarga/orang dekat ${sb.P} dan ${sb.T}.`, { dasar: [DASAR.keluarga, DASAR.syiqaq], saksi: dekat.map((x) => ({ label: x.label, hubungan: x.hubungan, golongan: x.golongan, langsung: true, sebaliknya: false, tanya: "", kutipan: x.hubungan })) })
    : unsur("keluarga", "Keluarga / orang dekat didengar", sp.length ? (sp.every((x) => x.golongan === "lain") ? "belum" : "catatan") : "belum", sp.length ? (sp.every((x) => x.golongan === "lain") ? "Saksi yang didengar bukan keluarga atau orang dekat suami istri." : "Hubungan saksi dengan para pihak tidak disebut.") : "Keluarga/orang dekat belum didengar.", { dasar: [DASAR.keluarga, DASAR.syiqaq] });
  unsurL.push(kelUnsur);
  if (kelUnsur.status !== "terbukti" && sp.length) ragu.push("hubungan saksi dengan para pihak tidak jelas");

  // 4. Alasan perceraian.
  const hurufM = String(m.huruf || "").toUpperCase().replace(/[^A-H]/g, "");
  const pn = m.penilaian && m.penilaian.baris && m.penilaian.baris.length ? m.penilaian : null;
  const alasanTerbukti: string[] = [];
  const alasanBelum: string[] = [];
  const topikAlasan = ["selisih", "selingkuh", "candu", "kabar", "penjara", "kekerasan", "penyakit", "murtad"];
  const hasilTopik = new Map<string, { status: StatusUnsur; ringkas: string; saksi: SaksiUnsur[]; bukti: BuktiUnsur[]; catatan: string[] }>();
  for (const t of topikAlasan) {
    const sk = sikapTopik(saksi, t);
    const dukung = sk.filter((x) => x.arah === 1);
    const lawan = sk.filter((x) => x.arah === -1);
    const langsung = dukung.filter((x) => x.langsung);
    const bk = bukti.filter((b) => b.tanda.has(t) || (b.topik.has(t) && b.topik.get(t) !== -1 && !b.tanda.has("domisili") && !b.tanda.has("nikah")));
    if (!dukung.length && !bk.length) continue;
    const catatan: string[] = [];
    let status: StatusUnsur;
    let ringkas: string;
    if (t === "selingkuh") {
      // Keputusan 57/60/70: putusan pidana zina cukup; dua saksi bersesuaian atau satu saksi + bukti lain; bukti/1 saksi saja belum.
      const putusanZina = bk.filter((b) => b.tanda.has("zina"));
      if (putusanZina.length) [status, ringkas] = ["terbukti", `${sebutBukti(putusanZina)} (putusan pengadilan) membuktikan perzinaan.`];
      else if (langsung.length >= 2) [status, ringkas] = ["terbukti", `${sebutSaksi(langsung.map((x) => x.saksi))} bersesuaian menerangkan adanya pihak ketiga.`];
      else if (langsung.length === 1 && bk.length) [status, ringkas] = ["terbukti", `${langsung[0].saksi.label} dikuatkan ${sebutBukti(bk)}.`];
      else [status, ringkas] = ["belum", bk.length ? "Bukti surat/elektronik saja tanpa saksi yang menerangkan belum cukup." : "Baru satu saksi (atau hanya dari cerita) yang menerangkan pihak ketiga."];
    } else if (langsung.length >= 2) [status, ringkas] = ["terbukti", `${sebutSaksi(langsung.map((x) => x.saksi))} bersesuaian menerangkan ${LABEL_TOPIK_ALASAN[t].judul}${langsung.every((x) => x.langsung) ? " (melihat/mendengar sendiri)" : ""}.`];
    else if (langsung.length === 1 && bk.length) [status, ringkas] = ["terbukti", `${langsung[0].saksi.label} dikuatkan ${sebutBukti(bk)}.`];
    else if ((t === "penjara" || t === "murtad") && bk.some((b) => b.tanda.has(t))) [status, ringkas] = ["terbukti", `${sebutBukti(bk.filter((b) => b.tanda.has(t)))} membuktikan ${LABEL_TOPIK_ALASAN[t].judul}.`];
    else if (dukung.length >= 2) {
      [status, ringkas] = ["belum", `${sebutSaksi(dukung.map((x) => x.saksi))} menerangkan ${LABEL_TOPIK_ALASAN[t].judul} hanya dari cerita orang lain (de auditu).`];
      catatan.push("Keterangan de auditu tidak berdiri sendiri; dapat menjadi persangkaan bila didukung fakta lain (pisah tempat tinggal yang diketahui sendiri).");
    } else [status, ringkas] = ["belum", `Baru ${dukung.length ? `${dukung[0].saksi.label}` : "bukti surat"} yang menerangkan ${LABEL_TOPIK_ALASAN[t].judul}.`];
    // Huruf B (Pasal 19 huruf b PP 9/1975, Pasal 116 huruf b KHI): meninggalkan 2 tahun berturut-turut. "Tidak ada komunikasi" selama
    // pisah yang belum 2 tahun hanya keadaan rumah tangga (penyebab/indikator perselisihan), bukan alasan tersendiri.
    if (t === "kabar" && status === "terbukti") {
      const lama = dukung.map((x) => Math.max(...x.saksi.baris.filter((r) => arahBaris(r, "kabar") === 1 || arahBaris(r, "pisah") === 1).map((r) => lamaBulan(r.jawab, acuan) ?? 0), 0));
      const bulan = lama.length ? Math.max(...lama) : 0;
      if (bulan < 24) {
        status = "belum";
        ringkas = `${sebutSaksi(dukung.map((x) => x.saksi))} menerangkan tidak ada kabar/komunikasi${bulan ? ` (±${bulan} bulan)` : ""}; meninggalkan 2 tahun berturut-turut belum terbukti.`;
      }
    }
    if (lawan.length) {
      catatan.push(`${sebutSaksi(lawan.map((x) => x.saksi))} menerangkan sebaliknya.`);
      if (status === "terbukti") ragu.push(`ada keterangan saksi yang bertentangan (${LABEL_TOPIK_ALASAN[t].judul})`);
    }
    hasilTopik.set(t, { status, ringkas, saksi: [...dukung, ...lawan].map(dasarSaksi), bukti: bk.map((b) => buktiUnsur(b)), catatan });
  }
  // Fakta pisah tempat tinggal (dipakai untuk rumah tangga pecah dan syarat 6 bulan).
  const skPisah = sikapTopik(saksi, "pisah");
  const lamaPisah: Array<{ x: Sikap; bulan: number }> = [];
  for (const x of skPisah.filter((y) => y.arah === 1)) {
    let b: number | null = null;
    for (const r of x.saksi.baris) {
      if (arahBaris(r, "pisah") === 1 || /\bpisah|berpisah|meninggalkan\b/.test(r.q)) {
        const l = lamaBulan(r.jawab, acuan);
        if (l !== null) b = Math.max(b ?? 0, l);
      }
    }
    if (b !== null) lamaPisah.push({ x, bulan: b });
  }
  const masihSerumah = skPisah.filter((y) => y.arah === -1);
  const kdrt = hasilTopik.get("kekerasan")?.status === "terbukti" || sikapTopik(saksi, "kekerasan").some((x) => x.arah === 1 && x.langsung);
  const bulanPisah = lamaPisah.length ? Math.max(...lamaPisah.map((x) => x.bulan)) : null;

  // Rumah tangga pecah (broken marriage): pertengkaran hanya diketahui dari cerita, tetapi >= 2 saksi mengetahui SENDIRI pisah tempat
  // tinggal (paling singkat 6 bulan sesudah SEMA 3/2023), tanpa komunikasi / upaya damai keluarga gagal - de auditu menjadi persangkaan
  // yang dikuatkan fakta yang diketahui langsung. Tetap ditandai ragu (penilaian hakim).
  const hSel = hasilTopik.get("selisih");
  if (hSel && hSel.status === "belum") {
    const tahuPisah = lamaPisah.filter((x) => x.x.langsung && (masa !== "sema-2023" || x.bulan >= 6));
    const pendukung = tahuPisah.filter(({ x }) =>
      x.saksi.baris.some((r) => (arahBaris(r, "kabar") === 1 && /\b(?:tidak|tanpa) (?:\S+\s+){0,2}(?:komunikasi|berkomunikasi|kabar)\b/.test(r.s)) || (arahBaris(r, "damai") !== null && /\b(?:tidak berhasil|gagal|tidak mau|tidak bisa)\b/.test(r.s)))
    );
    const dariCerita = sikapTopik(saksi, "selisih").filter((x) => x.arah === 1);
    if (pendukung.length >= 2 && dariCerita.length >= 1) {
      hSel.status = "terbukti";
      hSel.ringkas = `Pertengkaran diketahui ${sebutSaksi(dariCerita.map((x) => x.saksi))} dari cerita, tetapi ${sebutSaksi(pendukung.map((x) => x.x.saksi))} mengetahui sendiri ${sb.P} dan ${sb.T} telah pisah tempat tinggal ±${Math.max(...pendukung.map((x) => x.bulan))} bulan tanpa komunikasi dan upaya damai keluarga tidak berhasil: rumah tangga telah pecah.`;
      hSel.catatan.push("Keterangan tentang pertengkaran bersifat de auditu; dipakai sebagai persangkaan yang dikuatkan fakta pisah tempat tinggal yang diketahui sendiri.");
      for (const p of pendukung) if (!hSel.saksi.some((s) => s.label === p.x.saksi.label && s.kutipan === kutip(p.x.r.jawab))) hSel.saksi.push(dasarSaksi(p.x));
      ragu.push("pertengkaran hanya diketahui dari cerita - terbukti dari fakta pisah tempat tinggal (persangkaan)");
    }
  }
  // Penilai A2 (dalil x saksi x bukti) menang atas bacaan langsung bila ada: alasan yang dinilai terbukti/diakui pada dalil.
  if (pn) {
    const lbl = new Map<string, string>([["perselisihan dan pertengkaran", "selisih"], ["pihak ketiga / selingkuh", "selingkuh"], ["kekerasan / perlakuan kasar", "kekerasan"], ["judi / mabuk / narkoba", "candu"], ["pergi tanpa kabar", "kabar"], ["hukuman penjara", "penjara"], ["berpindah agama", "murtad"], ["cacat / penyakit", "penyakit"]]);
    for (const l of pn.kesimpulan.alasanTerbukti) {
      const t = lbl.get(l);
      if (!t) continue;
      const ada = hasilTopik.get(t);
      const baris = pn.baris.filter((b) => b.topik.includes(l) && (b.status === "terbukti" || b.status === "tidak-perlu-dibuktikan"));
      const dalil = baris.map((b) => b.nomor).filter(Boolean);
      hasilTopik.set(t, {
        status: "terbukti",
        ringkas: `Dalil ${dalil.length ? `angka ${dalil.join(", ")}` : ""} ${baris[0] ? baris[0].alasan : "dinilai terbukti"}`.replace(/\s+/g, " ").trim(),
        saksi: ada ? ada.saksi : [],
        bukti: ada ? ada.bukti : [],
        catatan: ada ? ada.catatan : [],
      });
    }
    for (const l of pn.kesimpulan.alasanBelum) {
      const t = lbl.get(l);
      if (!t || hasilTopik.get(t)?.status === "terbukti") continue;
      const ada = hasilTopik.get(t);
      const baris = pn.baris.find((b) => b.topik.includes(l));
      hasilTopik.set(t, { status: "belum", ringkas: baris ? baris.alasan : "Dalil belum terbukti.", saksi: ada ? ada.saksi : [], bukti: ada ? ada.bukti : [], catatan: ada ? ada.catatan : [] });
    }
  }
  // Huruf yang didalilkan (8503/matriks): pastikan unsurnya tampil walau belum ada saksi yang menerangkan.
  const topikHuruf: Record<string, string[]> = { A: ["selingkuh", "candu"], B: ["kabar"], C: ["penjara"], D: ["kekerasan"], E: ["penyakit"], F: ["selisih"], H: ["murtad"] };
  for (const h of hurufM.split("")) for (const t of topikHuruf[h] || []) if (!hasilTopik.has(t) && (h !== "A" || t === "selingkuh")) hasilTopik.set(t, { status: "belum", ringkas: `Belum ada saksi atau bukti yang menerangkan ${LABEL_TOPIK_ALASAN[t].judul}.`, saksi: [], bukti: [], catatan: [] });
  if (!hasilTopik.size) hasilTopik.set("selisih", { status: "belum", ringkas: sp.length ? "Saksi tidak menerangkan alasan perceraian (perselisihan, pihak ketiga, kekerasan, dst.)." : "Belum ada keterangan saksi yang tercatat.", saksi: [], bukti: [], catatan: [] });
  // Alasan selain perselisihan yang TIDAK didalilkan dengan hurufnya dan belum terbukti hanya penyebab yang disebut saksi: dicatat pada
  // unsur perselisihan, bukan unsur tersendiri (tidak menambah "belum terbukti" palsu).
  const didalilkan = (t: string) => hurufM.includes(LABEL_TOPIK_ALASAN[t].huruf) || Boolean(pn && pn.kesimpulan.alasanBelum.some((l) => l.includes(t === "kekerasan" ? "kekerasan" : t)));
  const penyebab: string[] = [];
  for (const [t, h] of hasilTopik) {
    if (t !== "selisih" && h.status !== "terbukti" && !didalilkan(t) && hasilTopik.has("selisih")) {
      penyebab.push(`${LABEL_TOPIK_ALASAN[t].judul}: ${h.ringkas}`);
      continue;
    }
    const info = LABEL_TOPIK_ALASAN[t];
    const dasar = [DASAR.pecah, ...calonDasarHuruf(info.huruf)];
    if (t === "selisih") dasar.push(DASAR.keluarga, DASAR.syiqaq);
    unsurL.push(unsur(`alasan-${t}`, `Alasan: ${info.judul} (huruf ${info.huruf})`, h.status, h.ringkas, { saksi: h.saksi, bukti: h.bukti, dasar, catatan: h.catatan }));
    (h.status === "terbukti" ? alasanTerbukti : alasanBelum).push(t);
  }
  const uSelisih = unsurL.find((u) => u.id === "alasan-selisih");
  if (uSelisih && penyebab.length) uSelisih.catatan.push(...penyebab.map((p) => `Penyebab yang juga disebut (belum berdiri sendiri sebagai alasan): ${p}`));

  // 5. Pisah tempat tinggal >= 6 bulan (SEMA 1/2022 jo. 3/2023), kecuali KDRT (fakta pisah dihitung di atas).
  let kurangPisah = false;
  if (masa !== "sema-2023" && hasilTopik.has("selisih")) {
    // Sebelum SEMA 3/2023 (29 Des 2023): pisah 6 bulan bukan syarat kumulatif (SEMA 1/2022: perselisihan terus-menerus ATAU pisah 6 bulan).
    if (skPisah.length || bulanPisah !== null)
      unsurL.push(unsur("pisah", "Pisah tempat tinggal", "catatan", `${bulanPisah !== null ? `Menurut ${sebutSaksi(lamaPisah.map((x) => x.x.saksi))}, pisah tempat tinggal ±${bulanPisah} bulan` : "Saksi menerangkan pisah tempat tinggal"}; ${masa === "sema-2022" ? "menurut SEMA 1/2022 pisah 6 bulan adalah alternatif dari perselisihan terus-menerus" : "putusan sebelum SEMA 1/2022"}.`, { saksi: (lamaPisah.length ? lamaPisah.map((x) => x.x) : skPisah).map(dasarSaksi), dasar: masa === "sema-2022" ? ["SEMA Nomor 1 Tahun 2022 Kamar Agama angka 1 huruf b"] : [] }));
  } else if (hasilTopik.has("selisih")) {
    if (bulanPisah !== null && bulanPisah >= 6)
      unsurL.push(unsur("pisah", "Pisah tempat tinggal paling singkat 6 bulan", "terbukti", `Menurut ${sebutSaksi(lamaPisah.map((x) => x.x.saksi))}, pisah tempat tinggal ±${bulanPisah} bulan.`, { saksi: lamaPisah.map((x) => dasarSaksi(x.x)), dasar: [DASAR.pisah] }));
    else if (bulanPisah !== null) {
      kurangPisah = !kdrt;
      unsurL.push(unsur("pisah", "Pisah tempat tinggal paling singkat 6 bulan", kdrt ? "catatan" : "tidak-terbukti", `Menurut ${sebutSaksi(lamaPisah.map((x) => x.x.saksi))}, pisah tempat tinggal baru ±${bulanPisah} bulan${kdrt ? "; terdapat kekerasan dalam rumah tangga sehingga syarat 6 bulan dikecualikan" : ""}.`, { saksi: lamaPisah.map((x) => dasarSaksi(x.x)), dasar: [DASAR.pisah] }));
    } else if (masihSerumah.length && !skPisah.some((y) => y.arah === 1)) {
      kurangPisah = !kdrt;
      unsurL.push(unsur("pisah", "Pisah tempat tinggal paling singkat 6 bulan", kdrt ? "catatan" : "tidak-terbukti", `${sebutSaksi(masihSerumah.map((x) => x.saksi))} menerangkan ${sb.P} dan ${sb.T} masih tinggal bersama.`, { saksi: masihSerumah.map(dasarSaksi), dasar: [DASAR.pisah] }));
    } else {
      unsurL.push(unsur("pisah", "Pisah tempat tinggal paling singkat 6 bulan", "catatan", skPisah.length ? "Saksi menerangkan pisah tempat tinggal tetapi tidak menyebut lamanya." : "Lama pisah tempat tinggal belum diterangkan saksi.", { saksi: skPisah.map(dasarSaksi), dasar: [DASAR.pisah] }));
      ragu.push("lama pisah tempat tinggal belum diterangkan");
    }
  }
  // 6. Nafkah (SEMA 1/2022: alasan tidak dinafkahi minimal 12 bulan).
  const skNafkah = sikapTopik(saksi, "nafkah").filter((x) => x.arah === 1);
  let nafkahKurang = false;
  let nafkahAlasan = false;
  if (skNafkah.length && masa !== "sebelum") {
    // Lama hanya dari baris yang memang tentang nafkah ("sejak tahun 2024" pada kalimat perselisihan adalah lama perselisihan).
    const bln = skNafkah
      .flatMap((x) => x.saksi.baris.filter((r) => /\bnafkah|menafkahi|dinafkahi|uang belanja\b/.test(r.q) || /^(?:\S+\s+){0,4}(?:tidak|sudah tidak|tidak pernah)\s+(?:\S+\s+){0,2}(?:memberi|memberikan|menafkahi)/.test(r.s)))
      .map((r) => lamaBulan(r.jawab, acuan))
      .filter((v): v is number => v !== null);
    const lama = bln.length ? Math.max(...bln) : null;
    const langsungN = skNafkah.filter((x) => x.langsung);
    // Nafkah sebagai alasan (bukan sekadar penyebab perselisihan): hanya bila tidak ada alasan lain yang terbukti.
    const pokok = !alasanTerbukti.length;
    const stat: StatusUnsur = !pokok ? "catatan" : lama !== null && lama >= 12 ? (langsungN.length >= 2 ? "terbukti" : "belum") : lama !== null ? "tidak-terbukti" : "catatan";
    nafkahKurang = stat === "tidak-terbukti";
    nafkahAlasan = pokok && stat === "terbukti";
    unsurL.push(
      unsur("nafkah", "Tidak dinafkahi paling singkat 12 bulan (bila nafkah jadi alasan)", stat, `${sebutSaksi(skNafkah.map((x) => x.saksi))} menerangkan ${sb.T} tidak/kurang memberi nafkah${lama !== null ? ` (±${lama} bulan)` : ", lamanya tidak disebut"}.`, {
        saksi: skNafkah.map(dasarSaksi),
        dasar: [DASAR.nafkah],
        catatan: stat === "catatan" ? ["Syarat 12 bulan berlaku bila tidak dinafkahi menjadi alasan perceraian; pada perselisihan, nafkah adalah penyebab yang dicatat."] : [],
      })
    );
  }
  if (verstek) unsurL.push(unsur("verstek", `${sb.T} tidak hadir`, "catatan", `${sb.T} tidak pernah hadir walau dipanggil resmi dan patut: diperiksa tanpa hadirnya ${sb.T}, alasan perceraian tetap harus dibuktikan.`, { dasar: [DASAR.verstek, DASAR.verstekCerai] }));

  // ── Keputusan ──
  let hasil: HasilRekomendasiPutusan;
  const keadaan: { varian?: string } = {};
  const fm = m.formil || {};
  if (!sp.length && !bukti.length) {
    hasil = "";
  } else if (fm.cacatFormil || fm.kurangPihak || fm.kuasaTidakSah || fm.eksepsi) {
    hasil = "tidak-dapat-diterima";
    unsurL.unshift(unsur("formil", "Syarat formil", "tidak-terbukti", fm.kuasaTidakSah ? "Kuasa tidak sah." : fm.eksepsi ? `Eksepsi kewenangan ${fm.eksepsi} dikabulkan.` : fm.kurangPihak ? "Kurang pihak." : "Gugatan/permohonan kabur (obscuur libel).", {}));
    if (fm.kuasaTidakSah) keadaan.varian = "[98] [NO] 4b. Cerai P Diwakili Kuasa Insidentil Tidak Sah & T Tidak Hadir";
  } else if (tanpaAkta) {
    hasil = "tidak-dapat-diterima";
    ragu.push("periksa apakah itsbat nikah dikumulasikan atau akta nikah belum tercatat sebagai bukti");
  } else if (!alasanTerbukti.length && !nafkahAlasan) {
    hasil = "ditolak";
    if (nafkahKurang) ragu.push("tidak dinafkahi kurang dari 12 bulan");
    const n = sp.length;
    if (verstek) keadaan.varian = n === 0 ? "[01ab] [Tolak Verstek] Cerai - Tidak ada bukti" : n === 1 && jenis === "cerai-gugat" ? "[01ab] [Tolak Verstek] Cerai - Unus Testis Nullus Testis" : "[01ab] [Tolak Verstek] Cerai - Tidak ada bukti";
    if (sp.some((x) => x.baris.length) && [...hasilTopik.values()].some((h) => /de auditu/.test(h.ringkas))) ragu.push("alasan hanya diterangkan dari cerita orang lain");
  } else if (kurangPisah && alasanTerbukti.every((t) => t === "selisih")) {
    hasil = "ditolak";
    if (verstek) keadaan.varian = "[01ab] [Tolak Verstek] Cerai - Kurang 6 Bulan SEMA 1 Tahun 2022";
  } else hasil = "dikabulkan";
  if (sp.length === 1 && hasil === "dikabulkan") ragu.push("hanya satu saksi");
  return { hasil, verstek, unsur: unsurL, ragu, varian: keadaan.varian || "" };
}

// ─── ITSBAT NIKAH ────────────────────────────────────────────────────────────

const RE_Q_WALI = /^(?!.*\b(?:ijab|kabul|qabul)\b).*\bwali\b/;
const RE_Q_MENIKAHKAN = /\b(?:menikahkan|yang menikahkan|mengakadkan|penghulu)\b/;
const RE_Q_SAKSI_NIKAH = /\bsaksi (?:nikah|pernikahan|akad)\b|\byang (?:menjadi|bertindak sebagai) saksi\b/;
const RE_Q_IJAB = /\bijab\b|\bkabul\b|\bqabul\b/;
const RE_Q_MAHAR = /\bmahar\b|\bmas ?kawin\b/;
const RE_Q_HALANGAN = /\bhubungan (?:darah|nasab|semenda|sesusuan|susuan)\b|\bterhalang\b|\bhalangan\b|\bmahram\b/;
const RE_Q_STATUS = /\bstatus\b/;
const RE_Q_UMUR = /\bumur\b|\busia\b|\bberapa tahun\b/;
const RE_Q_KEBERATAN = /\bkeberatan\b|\bmempermasalahkan\b|\bmenggugat\b/;
const RE_Q_HADIR = /\bhadir\b.*\bmenikah|\bmenyaksikan\b.*\b(?:nikah|pernikahan|akad)\b|\bmengetahui pernikahan\b/;
const RE_Q_BUKU = /\bbuku nikah\b|\bakta nikah\b|\btidak (?:tercatat|terdaftar)\b|\bmencatatkan\b/;
const RE_Q_ISLAM = /\bagama\b|\bmurtad\b/;
const RE_J_HADIR = /\b(?:saya|saksi) (?:\S+\s+){0,2}hadir\b|\btidak hadir (?:sewaktu|saat|ketika|pada)\b/;
const RE_J_WALI = /\bwali (?:nikah|nikahnya|pada pernikahan)\b|\bwali(?:nya)? (?:adalah|ialah)\b|\bbertindak sebagai wali\b/;
const RE_J_MENIKAHKAN = /\byang menikahkan\b|\bdinikahkan oleh\b/;
const RE_J_SAKSI_NIKAH = /\bsaksi (?:nikah|pernikahan|akad)\b|\byang (?:menjadi|bertindak sebagai) saksi\b/;
const RE_J_IJAB = /\bijab\b/;
const RE_J_MAHAR = /\bmahar\b|\bmas ?kawin\b/;
const RE_J_HALANGAN = /\b(?:hubungan|pertalian) (?:darah|nasab|sedarah|semenda|kerabat|sesusuan|susuan)\b|\bsesusuan\b|\bmahram\b/;
const RE_J_STATUS = /\bberstatus\b/;
const RE_J_KEBERATAN = /\bkeberatan\b|\bmengganggu gugat\b|\bmempermasalahkan\b/;
const RE_J_BUKU = /\btidak (?:memiliki|mempunyai|punya) (?:buku|akta)\b|\btidak (?:tercatat|terdaftar|dicatat|dicatatkan|melaporkan)\b/;

const RE_WALI_SAH =
  /\b(?:ayah|bapak|bapa)(?: kandung)?\b|\bkakek\b|\bsaudara (?:laki-laki )?(?:kandung|seayah|sebapak)\b|\bkakak (?:laki-laki )?(?:kandung|seayah)\b|\badik (?:laki-laki )?(?:kandung|seayah)\b|\bpaman\b|\bom\b|\bsaudara (?:laki-laki )?(?:ayah|bapak)\b|\banak (?:laki-laki )?(?:dari )?(?:paman|saudara laki-laki)\b|\bsepupu (?:laki-laki )?(?:dari )?(?:pihak )?ayah\b|\bwali hakim\b|\bkepala kua\b|\bpenghulu\b|\bkantor urusan agama\b|\bpegawai pencatat\b|\bp3n\b|\bppn\b|\bimam\b|\bwali nasab\b|\bkeponakan (?:laki-laki )?(?:dari )?(?:pihak )?(?:ayah|bapak|saudara laki)/;
const RE_WALI_TIDAK_SAH = /\b(?:paman|om|saudara (?:laki-laki )?(?:kandung )?)[^.;]{0,40}\b(?:dari|pihak) (?:pihak )?ibu\b|\b(?:tidak ada|tanpa) wali\b|\bwali(?:nya)? (?:adalah )?(?:ibu|ibunya|nenek)\b|\b(?:paman|saudara|om) (?:dari )?(?:pihak )?ibu\b|\bsaudara (?:laki-laki )?seibu\b|\bkakak (?:laki-laki )?seibu\b|\bayah tiri\b|\bkakak ipar\b|\bwali (?:yang )?tidak (?:sah|berhak)\b|\btidak (?:mendapat|ada) (?:izin|persetujuan|taukil|tauliyah)\b.*\bwali\b/;
const RE_DUA_SAKSI = /\bdua (?:orang )?saksi\b|\b2 (?:\(dua\) )?(?:orang )?saksi\b|\bsaksi (?:kedua|ke-2|satu)\b|\b(?:saya sendiri|saksi) .* (?:dan|dengan|serta) .+|\b(?:dan|dengan|serta)\b/;
const RE_TANPA_SAKSI = /\b(?:tidak ada|tanpa) saksi\b|\bhanya (?:satu|seorang) saksi\b/;
const RE_IJAB_YA = /\b(?:mengucapkan|diucapkan|melafalkan|menjawab) (?:ijab|kabul|qabul)\b|\bijab (?:dan|lalu|kemudian) (?:kabul|qabul)\b|\bkabul\b/;
const RE_TIDAK_HALANGAN = /\btidak (?:ada|mempunyai|memiliki|terdapat) (?:\S+\s+){0,3}(?:hubungan|pertalian|halangan|larangan)\b|\bbukan (?:mahram|saudara)\b|\btidak (?:ada |pula )?(?:hubungan |pertalian )?(?:darah|sedarah|nasab|semenda|sesusuan)\b/;
const RE_ADA_HALANGAN = /\b(?:ada|terdapat|mempunyai) hubungan (?:darah|nasab|semenda|sesusuan|susuan)\b|\bsaudara (?:kandung|sesusuan|sepersusuan)\b.*\b(?:pemohon|calon)\b|\bmasih (?:mahram|bersaudara)\b/;
const RE_TERIKAT =
  /\bmasih (?:terikat|bersuami|beristri|berstatus (?:istri|suami))\b|\bbelum (?:bercerai|cerai|resmi bercerai) (?:dengan|dari) (?:istri|suami)\b|\bmasih (?:dalam ikatan|menjadi (?:istri|suami)) (?:\S+\s+){0,3}(?:orang lain|lain|pertama)\b|\bistri (?:pertama|tua)\b|\bberistri (?:dua|lebih)\b|\b(?:ber)?poligami\b/;
const RE_JANDA_DUDA = /\b(?:janda|duda)\b/;
// 3 Nov 2026 (blangko [01f] "IN Kabul (Hadir Tapi Lupa Prosesi Nikah)"): saksi hanya menghadiri pesta/walimah dan tidak mengikuti akad.
const RE_PESTA = /\b(?:pesta|walimah|walimahan|resepsi)\b/;
const RE_TANPA_AKAD = /\btidak (?:\S+\s+){0,3}?(?:mengikuti|menyaksikan|ikut|berada di tempat)\b[^.;]{0,40}?\bakad\b|\bakad(?: nikah)?(?:nya)? (?:tidak|tak) saya (?:ikuti|saksikan|hadiri|lihat)\b/;
/** Jawaban "tidak tahu" (bukan keterangan tentang unsur itu). */
const RE_TIDAK_TAHU_UNSUR = /\btidak (?:tahu|mengetahui|ingat|dapat menerangkan)\b|\btidak saya ketahui\b/;
/**
 * Keberatan pihak lain menurut satu jawaban saksi (3 Nov 2026, keputusan pengguna). Pola lama tidak pernah cocok: sesudah "ada|pernah"
 * tidak ada \s+ sehingga "Ada keluarga yang keberatan" terbaca TIDAK ada keberatan. Sekarang per anak kalimat (koma, titik koma,
 * "namun", "tetapi", "akan tetapi", "sedangkan"): anak kalimat yang memuat kata keberatan ADA keberatan, kecuali dinegasikan -
 * "tidak/tak/belum/bukan/tanpa/tiada" sebelumnya ("tidak ada yang keberatan", "tidak pernah mendengar ada pihak lain yang keberatan",
 * "tidak seorang pun keberatan") atau "keberatan ... tidak ada/tidak pernah ada" sesudahnya. Negasi menang atas kata "ada".
 * Jawaban pendek tanpa kata keberatan ("Ada, yaitu orang tua Pemohon II") = ada; "Tidak ada" = tidak.
 */
const RE_KATA_KEBERATAN = /\b(?:keberatan|berkeberatan|mempermasalahkan|mempersoalkan|menggugat|menentang|menolak|melarang)\b/;
const RE_NEGASI_SEBELUM = /\b(?:tidak|tak|belum|bukan|tanpa|tiada)\b[^]{0,80}?\b(?:keberatan|berkeberatan|mempermasalahkan|mempersoalkan|menggugat|menentang|menolak|melarang)\b/;
const RE_NEGASI_SESUDAH = /\b(?:keberatan|berkeberatan)\b[^]{0,40}?\b(?:tidak|tak) (?:pernah )?ada\b/;
/** "ada tidaknya keberatan ..." hanya menyebut pokok yang ditanya (jawaban umum tidak tahu/ragu/sebagian/mendengar), bukan pernyataan. */
// Juga anak kalimat yang hanya menyebut pokoknya ("mengenai keberatan ...", "pembicaraan ... yang menyinggung keberatan") atau tidak
// yakin ("tidak saya ketahui", "ragu", "mungkin benar"): bukan keterangan bahwa ada yang keberatan.
const RE_POKOK_SAJA =
  /\bada(?:-|\s+)tidak(?:nya)?\b|\bada atau tidak(?:nya)?\b|\b(?:mengenai|tentang|perihal|soal|menyinggung|membicarakan|pembicaraan)\b|\btidak (?:tahu|mengetahui|ingat)\b|\btidak (?:saya|pernah saya) ketahui\b|\bragu\b|\bkurang (?:yakin|jelas|pasti)\b|\blupa\b|\bmengira\b|\bmungkin\b/;
export function keberatanDiterangkan(jawaban: string): boolean {
  const s = kecil(jawaban);
  const anak = s.split(/[,;.!?]|\b(?:namun|tetapi|akan tetapi|sedangkan|melainkan)\b/).map((x) => x.trim()).filter(Boolean);
  const berkata = anak.filter((a) => RE_KATA_KEBERATAN.test(a) && !RE_POKOK_SAJA.test(a));
  if (!berkata.length && anak.some((a) => RE_POKOK_SAJA.test(a))) return false;
  if (berkata.length) return berkata.some((a) => !RE_NEGASI_SEBELUM.test(a) && !RE_NEGASI_SESUDAH.test(a));
  return /^(?:ya\s*,?\s*|benar\s*,?\s*)?(?:ada|pernah ada|pernah)\b/.test(s) && !/^(?:ya\s*,?\s*)?(?:ada|pernah)\s+(?:tidak|tak)\b/.test(s);
}

/** Umur yang disebut untuk Pemohon I / Pemohon II (atau calon suami / calon istri) dalam satu jawaban. */
function umurDisebut(s: string): Array<{ siapa: string; umur: number }> {
  const out: Array<{ siapa: string; umur: number }> = [];
  for (const m of s.matchAll(/\b(pemohon i{1,2}|pemohon 1|pemohon 2|termohon|penggugat|tergugat|suami|istri|calon suami|calon istri|anak pemohon|anak)\b[^.;]{0,60}?\b(?:berumur|berusia|umur|usia)\s+(?:sekitar\s+|kurang lebih\s+|±\s*)?(\d{1,2})\s*(?:\([a-z ]+\)\s*)?tahun/g)) out.push({ siapa: m[1], umur: Number(m[2]) });
  return out;
}

/** Tanggal nikah yang disebut saksi ("menikah pada tanggal 08 Maret 1984") bila SIPP tidak menyimpannya; "" = tidak disebut. */
function tanggalNikahDariSaksi(sp: SaksiSiap[]): string {
  for (const x of sp)
    for (const r of x.baris) {
      if (!/\b(?:menikah|pernikahan|akad|melangsungkan)\b/.test(`${r.q} ${r.s}`)) continue;
      const m = /\btanggal\s+(\d{1,2})\s+(januari|februari|pebruari|maret|april|mei|juni|juli|agustus|september|oktober|november|nopember|desember)\s+(\d{4})\b/.exec(r.s);
      if (m) return `${m[3]}-${String(BULAN[m[2]]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      const y = /\btahun\s+(19\d{2}|20\d{2})\b/.exec(r.s);
      if (y && /\bmenikah\b/.test(r.s)) return `${y[1]}-06-30`;
    }
  return "";
}

function rekomendasiItsbat(m: MasukanRekomendasiPutusan, jenis: "itsbat" | "itsbat-kontensius", sb: { P: string; T: string }, saksi: SaksiSiap[], bukti: BuktiSiap[]) {
  const ragu: string[] = [];
  const unsurL: UnsurRekomendasi[] = [];
  const sp = saksi.filter((x) => x.pihak !== "T");
  const verstek = jenis === "itsbat-kontensius" && (m.kehadiran?.verstekSipp === true || m.kehadiran?.tPernahHadir === false);
  unsurL.push(unsurIdentitas(bukti, sb, [DASAR.kewenanganIn], "Identitas, kewenangan, dan kedudukan hukum"));
  unsurL[0].dasar.push(DASAR.legalIn);
  unsurL.push(unsurSaksiFormil(saksi, "P", sb, [DASAR.saksiFormilP, DASAR.saksiMaterilP]));

  // Saksi yang hanya menghadiri pesta pernikahan dan tidak mengikuti akad (blangko [01f]): bukan saksi peristiwa akad.
  const pestaSaksi = sp.filter((x) => x.baris.some((r) => RE_PESTA.test(r.s)) && x.baris.some((r) => RE_TANPA_AKAD.test(r.s)));
  const diPesta = new Set(pestaSaksi.map((x) => x.id));
  // Hadir / mengetahui sendiri peristiwa nikah: istifadhah bila semua dari cerita.
  const hadir = sp.map((x) => ({ x, r: barisCocok(x, RE_Q_HADIR, RE_J_HADIR) })).filter((y) => y.r);
  const hadirLangsung = hadir.filter((y) => y.r && !diPesta.has(y.x.id) && (RE_IYA.test(y.r.s) || /\b(?:saya|saksi) (?:\S+\s+){0,2}hadir\b|\bmenyaksikan\b/.test(y.r.s)) && !/\btidak (?:\S+\s+){0,2}hadir\b/.test(y.r.s) && !y.r.deAuditu);
  const hadirCerita = hadir.filter((y) => y.r && (y.r.deAuditu || (y.r.tidakLangsung && !y.r.langsung)));
  let istifadhah = false;
  if (pestaSaksi.length && !hadirLangsung.length)
    unsurL.push(unsur("hadir", "Saksi mengetahui sendiri peristiwa nikah", "catatan", `${sebutSaksi(pestaSaksi)} hanya menghadiri pesta pernikahan, tidak mengikuti akad nikah, sehingga tidak mengetahui wali, lafaz akad, mahar, dan saksi nikah.`, { saksi: pestaSaksi.map((x) => saksiDari(x, x.baris.find((r) => RE_PESTA.test(r.s))!)), dasar: [DASAR.saksiMaterilP] }));
  else if (hadir.length) {
    if (hadirLangsung.length >= 2) unsurL.push(unsur("hadir", "Saksi mengetahui sendiri peristiwa nikah", "terbukti", `${sebutSaksi(hadirLangsung.map((y) => y.x))} hadir/menyaksikan akad nikah.`, { saksi: hadirLangsung.map((y) => saksiDari(y.x, y.r!)), dasar: [DASAR.saksiMaterilP] }));
    else if (hadirCerita.length && !hadirLangsung.length) {
      istifadhah = true;
      unsurL.push(unsur("hadir", "Saksi mengetahui sendiri peristiwa nikah", "catatan", `${sebutSaksi(hadirCerita.map((y) => y.x))} tidak hadir saat akad, mengetahui dari orang banyak (syahadah al-istifadhah) - dapat dibenarkan untuk pernikahan yang sudah lama terjadi.`, { saksi: hadirCerita.map((y) => saksiDari(y.x, y.r!)), dasar: [DASAR.istifadhah] }));
      ragu.push("saksi tidak hadir saat akad (istifadhah)");
    } else unsurL.push(unsur("hadir", "Saksi mengetahui sendiri peristiwa nikah", hadirLangsung.length ? "catatan" : "belum", `${hadirLangsung.length ? `${sebutSaksi(hadirLangsung.map((y) => y.x))} hadir saat akad` : "Belum ada saksi yang hadir saat akad"}${hadirCerita.length ? `; ${sebutSaksi(hadirCerita.map((y) => y.x))} mengetahui dari cerita` : ""}.`, { saksi: hadir.map((y) => saksiDari(y.x, y.r!)), dasar: [DASAR.saksiMaterilP] }));
  }

  // Rukun nikah (Pasal 14 KHI): wali, dua saksi, ijab kabul (calon suami & istri = para pihak).
  const wali = sp.map((x) => ({ x, r: barisCocok(x, RE_Q_WALI, RE_J_WALI) })).filter((y) => y.r);
  const menikahkan = sp.map((x) => ({ x, r: barisCocok(x, RE_Q_MENIKAHKAN, RE_J_MENIKAHKAN) })).filter((y) => y.r);
  const waliTakSah = wali.filter((y) => RE_WALI_TIDAK_SAH.test(y.r!.s));
  const waliSah = wali.filter((y) => !RE_WALI_TIDAK_SAH.test(y.r!.s) && RE_WALI_SAH.test(y.r!.s));
  let rukunGagal = false;
  if (waliTakSah.length) {
    rukunGagal = true;
    unsurL.push(unsur("wali", "Rukun: wali nikah", "tidak-terbukti", `${sebutSaksi(waliTakSah.map((y) => y.x))} menerangkan wali nikah bukan wali yang berhak (wali tidak sah).`, { saksi: waliTakSah.map((y) => saksiDari(y.x, y.r!)), dasar: [DASAR.rukun] }));
  } else if (waliSah.length >= 2 || (waliSah.length === 1 && sp.length === 1)) {
    const imam = menikahkan.filter((y) => /\bimam\b|\bpegawai\b|\bpenghulu\b|\bp3n\b|\bppn\b/.test(y.r!.s));
    unsurL.push(
      unsur("wali", "Rukun: wali nikah", "terbukti", `${sebutSaksi(waliSah.map((y) => y.x))} bersesuaian: wali nikah ${kutip(waliSah[0].r!.jawab, 90)}${imam.length ? `; yang menikahkan ${kutip(imam[0].r!.jawab, 70)} (atas taukil wali)` : ""}.`, {
        saksi: [...waliSah, ...imam].map((y) => saksiDari(y.x, y.r!)),
        dasar: [DASAR.rukun],
        catatan: imam.length ? ["Pastikan wali nasab mewakilkan (taukil) kepada yang menikahkan."] : [],
      })
    );
  } else unsurL.push(unsur("wali", "Rukun: wali nikah", "belum", wali.length ? "Saksi menyebut wali nikah, tetapi belum jelas wali nasab/wali hakim yang berhak." : "Belum ada saksi yang menerangkan wali nikah.", { saksi: wali.map((y) => saksiDari(y.x, y.r!)), dasar: [DASAR.rukun] }));

  const sn = sp.map((x) => ({ x, r: barisCocok(x, RE_Q_SAKSI_NIKAH, RE_J_SAKSI_NIKAH) })).filter((y) => y.r);
  const snTanpa = sn.filter((y) => RE_TANPA_SAKSI.test(y.r!.s));
  const snAda = sn.filter((y) => !RE_TANPA_SAKSI.test(y.r!.s) && !/\btidak (?:tahu|ingat|mengetahui)\b/.test(y.r!.s) && RE_DUA_SAKSI.test(y.r!.s));
  if (snTanpa.length) {
    rukunGagal = true;
    unsurL.push(unsur("saksi-nikah", "Rukun: dua orang saksi nikah", "tidak-terbukti", `${sebutSaksi(snTanpa.map((y) => y.x))} menerangkan akad tanpa dua orang saksi.`, { saksi: snTanpa.map((y) => saksiDari(y.x, y.r!)), dasar: [DASAR.rukun, DASAR.saksiNikah] }));
  } else if (snAda.length) unsurL.push(unsur("saksi-nikah", "Rukun: dua orang saksi nikah", "terbukti", `${sebutSaksi(snAda.map((y) => y.x))}: ${kutip(snAda[0].r!.jawab, 110)}.`, { saksi: snAda.map((y) => saksiDari(y.x, y.r!)), dasar: [DASAR.rukun, DASAR.saksiNikah] }));
  else unsurL.push(unsur("saksi-nikah", "Rukun: dua orang saksi nikah", "belum", "Belum ada saksi yang menyebut dua orang saksi nikah.", { saksi: sn.map((y) => saksiDari(y.x, y.r!)), dasar: [DASAR.rukun, DASAR.saksiNikah] }));

  const ij = sp.map((x) => ({ x, r: barisCocok(x, RE_Q_IJAB, RE_J_IJAB) })).filter((y) => y.r && RE_IJAB_YA.test(y.r.s) && !RE_BUKAN.test(y.r.s) && !RE_TIDAK_TAHU_UNSUR.test(y.r.s));
  // Tersirat: saksi hadir dan menyebut saksi nikah "pada saat terjadinya ijab kabul" atau pernikahan "sesuai syariat Islam".
  const ijTersirat = sp
    .map((x) => ({ x, r: x.baris.find((r) => /\bijab\b/.test(`${r.q} ${r.s}`) || /\bsesuai (?:dengan )?(?:syari'?at|syariat|hukum) islam\b/.test(r.s)) || null }))
    .filter((y) => y.r);
  unsurL.push(
    ij.length
      ? unsur("ijab", "Rukun: ijab dan kabul", "terbukti", `${sebutSaksi(ij.map((y) => y.x))}: ${kutip(ij[0].r!.jawab, 110)}.`, { saksi: ij.map((y) => saksiDari(y.x, y.r!)), dasar: [DASAR.rukun] })
      : ijTersirat.length && hadirLangsung.length
        ? unsur("ijab", "Rukun: ijab dan kabul", "catatan", `Tidak ditanyakan tersendiri; ${sebutSaksi(ijTersirat.map((y) => y.x))} yang hadir menyebut akad/ijab kabul berlangsung (${kutip(ijTersirat[0].r!.jawab, 90)}).`, { saksi: ijTersirat.map((y) => saksiDari(y.x, y.r!)), dasar: [DASAR.rukun] })
        : unsur("ijab", "Rukun: ijab dan kabul", "belum", "Belum ada saksi yang menerangkan ijab dan kabul.", { dasar: [DASAR.rukun] })
  );
  const mh = sp.map((x) => ({ x, r: barisCocok(x, RE_Q_MAHAR, RE_J_MAHAR) })).filter((y) => y.r && !RE_BUKAN.test(y.r.s) && !RE_TIDAK_TAHU_UNSUR.test(y.r.s));
  if (mh.length) unsurL.push(unsur("mahar", "Mahar", "terbukti", `${kutip(mh[0].r!.jawab, 110)} (${sebutSaksi(mh.map((y) => y.x))}).`, { saksi: mh.map((y) => saksiDari(y.x, y.r!)), dasar: [DASAR.mahar] }));

  // Halangan perkawinan & status saat menikah.
  const hl = sp.map((x) => ({ x, r: barisCocok(x, RE_Q_HALANGAN, RE_J_HALANGAN) })).filter((y) => y.r);
  const hlAda = hl.filter((y) => RE_ADA_HALANGAN.test(y.r!.s) && !RE_TIDAK_HALANGAN.test(y.r!.s));
  const hlTidak = hl.filter((y) => RE_TIDAK_HALANGAN.test(y.r!.s));
  const st = sp.map((x) => ({ x, r: barisCocok(x, RE_Q_STATUS, RE_J_STATUS) })).filter((y) => y.r);
  // Pertanyaan "apakah Pemohon I dan Pemohon II pernah bercerai" bukan tentang perkawinan lain.
  const terikat = sp
    .map((x) => ({ x, r: x.baris.find((r) => !/\bbercerai\b/.test(r.q) && RE_TERIKAT.test(r.s) && !/\b(?:tidak|bukan|belum pernah) (?:\S+\s+){0,3}(?:terikat|bersuami|beristri|poligami|berpoligami|menikah)\b/.test(r.s)) || null }))
    .filter((y) => y.r);
  const jandaDuda = st.filter((y) => RE_JANDA_DUDA.test(y.r!.s));
  let halangan = false;
  let masihTerikat = false;
  if (hlAda.length) {
    halangan = true;
    unsurL.push(unsur("halangan", "Tidak ada halangan perkawinan", "tidak-terbukti", `${sebutSaksi(hlAda.map((y) => y.x))} menerangkan ada hubungan darah/semenda/sesusuan.`, { saksi: hlAda.map((y) => saksiDari(y.x, y.r!)), dasar: [DASAR.halangan] }));
  } else if (terikat.length) {
    masihTerikat = true;
    unsurL.push(unsur("halangan", "Tidak ada halangan perkawinan", "tidak-terbukti", `${sebutSaksi(terikat.map((y) => y.x))} menerangkan salah satu pihak masih terikat perkawinan lain saat menikah.`, { saksi: terikat.map((y) => saksiDari(y.x, y.r!)), dasar: [DASAR.halangan, DASAR.monogami, DASAR.poligamiSirri] }));
  } else if (hlTidak.length) {
    const cat: string[] = [];
    const bkCerai = bukti.filter((b) => b.tanda.has("cerai-dulu") || b.tanda.has("mati"));
    if (jandaDuda.length && !bkCerai.length) {
      cat.push("Pihak berstatus janda/duda saat menikah: perlu akta cerai atau surat kematian pasangan sebelumnya.");
      ragu.push("status janda/duda tanpa bukti putusnya perkawinan sebelumnya");
    }
    unsurL.push(unsur("halangan", "Tidak ada halangan perkawinan", "terbukti", `${sebutSaksi(hlTidak.map((y) => y.x))} menerangkan tidak ada hubungan darah, semenda, atau sesusuan${st.length ? `; status saat menikah: ${kutip(st[0].r!.jawab, 80)}` : ""}.`, { saksi: [...hlTidak, ...st].map((y) => saksiDari(y.x, y.r!)), bukti: bkCerai.map((b) => buktiUnsur(b)), dasar: [DASAR.halangan], catatan: cat }));
  } else unsurL.push(unsur("halangan", "Tidak ada halangan perkawinan", "belum", "Belum ada saksi yang menerangkan tidak adanya halangan perkawinan.", { dasar: [DASAR.halangan] }));

  // Umur saat menikah (UU 16/2019: 19 tahun bagi pria dan wanita; sebelum 14 Oktober 2019: pria 19, wanita 16).
  // Hanya umur para pihak (Pemohon I/II, suami/istri) - umur anak yang lahir dari perkawinan itu tidak dipakai.
  const umurPihak = (s: string) => umurDisebut(s).filter((d) => !/^anak/.test(d.siapa));
  const um = sp.map((x) => ({ x, r: x.baris.find((r) => umurPihak(r.s).length > 0) || null })).filter((y) => y.r);
  let bawahUmur = false;
  if (um.length) {
    const tglNikah = /^\d{4}-\d{2}-\d{2}/.test(String(m.tanggalNikah || "")) ? String(m.tanggalNikah) : tanggalNikahDariSaksi(sp);
    const sesudahUu16 = /^\d{4}-\d{2}-\d{2}/.test(tglNikah) ? tglNikah >= "2019-10-14" : null;
    const daftar = umurPihak(um[0].r!.s);
    const batas = (siapa: string) => (/\bii\b|\b2\b|istri|termohon/.test(siapa) && sesudahUu16 === false ? 16 : 19);
    const kurang = daftar.filter((d) => d.umur < batas(d.siapa) && d.umur > 0);
    if (kurang.length && sesudahUu16 === false) {
      // Sebelum UU 16/2019 (batas pria 19, wanita 16): dicatat, hakim menimbang (tanpa NO otomatis).
      unsurL.push(unsur("umur", "Umur para pihak saat menikah", "catatan", `Saat menikah ${kurang.map((d) => `${d.siapa.replace(/\b\w/g, (c) => c.toUpperCase())} berumur ${d.umur} tahun`).join(", ")} (perkawinan ${tglNikah.slice(0, 4)}, sebelum UU 16/2019).`, { saksi: um.map((y) => saksiDari(y.x, y.r!)), dasar: [DASAR.umur] }));
      ragu.push("umur salah satu pihak di bawah batas saat menikah (sebelum UU 16/2019)");
    } else if (kurang.length && sesudahUu16 === true) {
      bawahUmur = true;
      ragu.push("umur menurut saksi di bawah 19 tahun - periksa ada tidaknya dispensasi kawin");
      unsurL.push(unsur("umur", "Umur para pihak saat menikah", "tidak-terbukti", `Saat menikah ${kurang.map((d) => `${d.siapa.replace(/\b\w/g, (c) => c.toUpperCase())} berumur ${d.umur} tahun`).join(", ")} - di bawah batas umur perkawinan dan tanpa dispensasi kawin.`, { saksi: um.map((y) => saksiDari(y.x, y.r!)), dasar: [DASAR.umur] }));
    } else
      unsurL.push(unsur("umur", "Umur para pihak saat menikah", kurang.length ? "catatan" : "terbukti", `${kutip(um[0].r!.jawab, 100)}${kurang.length ? " (tanggal nikah tidak diketahui, batas umur belum dapat dibandingkan)" : ""}.`, { saksi: um.map((y) => saksiDari(y.x, y.r!)), dasar: [DASAR.umur] }));
  }
  // Keberatan pihak lain.
  const kb = sp.map((x) => ({ x, r: barisCocok(x, RE_Q_KEBERATAN, RE_J_KEBERATAN) })).filter((y) => y.r);
  const kbAda = kb.filter((y) => keberatanDiterangkan(y.r!.s));
  if (kb.length) unsurL.push(unsur("keberatan", "Tidak ada keberatan pihak lain", kbAda.length ? "tidak-terbukti" : "terbukti", kbAda.length ? `${sebutSaksi(kbAda.map((y) => y.x))} menerangkan ada pihak yang keberatan.` : `${sebutSaksi(kb.map((y) => y.x))} tidak pernah mendengar ada pihak lain yang keberatan.`, { saksi: kb.map((y) => saksiDari(y.x, y.r!)), dasar: [DASAR.sahAgama] }));
  if (kbAda.length) ragu.push("ada pihak lain yang keberatan");
  // Alasan itsbat (Pasal 7 ayat (3) KHI) - catatan.
  const bk = sp.map((x) => ({ x, r: barisCocok(x, RE_Q_BUKU, RE_J_BUKU) })).filter((y) => y.r);
  const bkTak = bukti.filter((b) => b.tanda.has("tak-tercatat"));
  if (bk.length || bkTak.length) unsurL.push(unsur("alasan-itsbat", "Alasan itsbat nikah", "terbukti", `${bk.length ? kutip(bk[0].r!.jawab, 120) : ""}${bkTak.length ? `${bk.length ? "; " : ""}${sebutBukti(bkTak)}` : ""}.`, { saksi: bk.map((y) => saksiDari(y.x, y.r!)), bukti: bkTak.map((b) => buktiUnsur(b)), dasar: [DASAR.alasanIn, DASAR.sirri] }));
  const isl = sp.map((x) => ({ x, r: barisCocok(x, RE_Q_ISLAM, /\b(?:murtad|keluar dari (?:agama )?islam|pindah agama)\b/) })).filter((y) => y.r && !/\btidak (?:pernah )?(?:\S+\s+){0,2}(?:murtad|keluar|pindah)\b/.test(y.r.s) && /\b(?:murtad|keluar dari|pindah agama)\b/.test(y.r.s));
  if (isl.length) ragu.push("ada keterangan salah satu pihak keluar dari agama Islam");

  let hasil: HasilRekomendasiPutusan;
  let varian = "";
  if (!sp.length && !bukti.length) hasil = "";
  else if (masihTerikat) {
    hasil = "tidak-dapat-diterima";
    varian = "[99] [NO] IN - Masih Terikat Nikah Sebelumnya (Belum Cerai)";
  } else if (bawahUmur) {
    hasil = "tidak-dapat-diterima";
    varian = "[99] [NO] IN - Dibawah Umur";
  } else if (rukunGagal) {
    hasil = "ditolak";
    varian = waliTakSah.length ? "[03] [Tolak] IN - Rukun Tidak Terpenuhi (Wali Tidak Sah)" : "[03a] [Tolak] IN - Rukun dan Syarat Nikah Tidak Terbukti";
  } else if (halangan) {
    hasil = "ditolak";
    varian = "[03b] [Tolak] IN - Terdapat Halangan Perkawinan";
  } else {
    const rukun = unsurL.filter((u) => ["wali", "saksi-nikah", "ijab", "halangan"].includes(u.id));
    const belum = rukun.filter((u) => u.status === "belum" || u.status === "tidak-terbukti");
    // [01f]: dua saksi atau lebih hanya hadir di pesta (tidak tahu wali, lafaz akad, mahar, saksi nikah), tidak ada halangan dan tidak ada
    // yang keberatan -> dikabulkan menurut indikasi (hidup rukun, tidak ada keberatan masyarakat), ragu: penilaian hakim.
    // Keberatan yang diterangkan ("Ada keluarga yang keberatan") menahan [01f]: pertimbangannya bertumpu pada tidak adanya keberatan.
    const pestaKabul = jenis === "itsbat" && sp.length >= 2 && pestaSaksi.length >= 2 && !kbAda.length &&!belum.some((u) => u.id === "halangan" && u.status === "tidak-terbukti");
    if (pestaKabul) {
      hasil = "dikabulkan";
      varian = "[01f] [Kabul] IN Kabul (Hadir Tapi Lupa Prosesi Nikah)";
      ragu.push("saksi hanya menghadiri pesta pernikahan, tidak mengikuti akad nikah (wali, lafaz akad, mahar, dan saksi nikah tidak diketahui)");
    } else if (sp.length < 2 && !bukti.some((b) => b.tanda.has("nikah-desa"))) {
      hasil = belum.length ? "ditolak" : "dikabulkan";
      ragu.push("saksi kurang dari dua orang");
    } else if (belum.length >= 2) {
      hasil = "ditolak";
      varian = "[03a] [Tolak] IN - Rukun dan Syarat Nikah Tidak Terbukti";
      ragu.push(`unsur belum diterangkan: ${belum.map((u) => u.judul.replace(/^Rukun: /, "")).join(", ")}`);
    } else {
      hasil = "dikabulkan";
      if (belum.length) ragu.push(`unsur belum diterangkan: ${belum.map((u) => u.judul.replace(/^Rukun: /, "")).join(", ")}`);
      if (istifadhah && jenis === "itsbat") varian = "[01a] [Kabul] IN - Syahadah Al Istifadhah";
    }
  }
  if (verstek) unsurL.push(unsur("verstek", `${sb.T} tidak hadir`, "catatan", `${sb.T} tidak hadir walau dipanggil patut: diperiksa tanpa hadirnya, dalil tetap harus beralasan dan tidak melawan hukum.`, { dasar: [DASAR.verstek] }));
  return { hasil, verstek, unsur: unsurL, ragu, varian };
}

// ─── DISPENSASI KAWIN ────────────────────────────────────────────────────────

const RE_HAMIL = /\b(?:hamil|mengandung|kehamilan|sedang mengandung|telah mengandung|sudah mengandung|berbadan dua)\b/;
const RE_TIDAK_HAMIL = /\b(?:belum|tidak|bukan) (?:\S+\s+){0,2}(?:hamil|mengandung)\b/;
const RE_BERHUBUNGAN = /\b(?:berhubungan (?:badan|suami istri|intim|layaknya suami)|hubungan (?:badan|intim|suami istri)|bersetubuh|bersenggama|tidur bersama|kumpul kebo|melakukan hubungan)\b/;
const RE_TIDAK_BERHUBUNGAN = /\b(?:belum|tidak) (?:pernah )?(?:\S+\s+){0,2}(?:berhubungan (?:badan|suami istri|intim)|melakukan hubungan|bersetubuh)\b/;
const RE_PACARAN = /\b(?:pacaran|berpacaran|menjalin (?:hubungan|asmara|cinta)|hubungan (?:cinta|asmara|sangat erat|erat|dekat)|saling (?:mencintai|menyayangi|suka)|khawatir|dikhawatirkan|takut (?:terjerumus|berbuat)|zina|lamaran|dilamar|melamar|tunangan|bertunangan|sudah lama (?:kenal|dekat))\b/;
const RE_SETUJU_ANAK = /\b(?:suka sama suka|atas kemauan sendiri|tidak (?:ada )?(?:\S+\s+){0,2}(?:paksaan|dipaksa)|tanpa paksaan|bersedia|siap|setuju|menyetujui|merestui|sepakat)\b/;
const RE_PAKSA = /\b(?:dipaksa|paksaan|terpaksa)\b/;
const RE_KERJA = /\b(?:bekerja|pekerjaan|penghasilan|berpenghasilan|petani|nelayan|buruh|wiraswasta|pedagang|karyawan)\b/;

function rekomendasiDk(m: MasukanRekomendasiPutusan, sb: { P: string; T: string }, saksi: SaksiSiap[], bukti: BuktiSiap[]) {
  const ragu: string[] = [];
  const unsurL: UnsurRekomendasi[] = [];
  const sp = saksi;
  unsurL.push(unsurIdentitas(bukti, sb, [DASAR.kewenanganDk], "Identitas, kewenangan, dan kedudukan hukum Pemohon"));
  unsurL[0].dasar.push(DASAR.legalDk);
  unsurL.push(unsurSaksiFormil(saksi, "P", sb, [DASAR.saksiFormilP, DASAR.saksiMaterilP]));
  const semuaTeks = sp.flatMap((x) => x.baris);

  // Anak perempuan / laki-laki (calon suami disebut = anak perempuan).
  const calonSuami = semuaTeks.some((r) => /\bcalon suami\b/.test(r.s) || /\bcalon suami\b/.test(r.q));
  const calonIstri = semuaTeks.some((r) => /\bcalon istri\b/.test(r.s) || /\bcalon istri\b/.test(r.q));
  const anak: "perempuan" | "laki-laki" | "" = calonSuami && !calonIstri ? "perempuan" : calonIstri && !calonSuami ? "laki-laki" : "";

  // Umur anak < 19 tahun (bukti akta kelahiran/KK/ijazah; saksi).
  const bUmur = bukti.filter((b) => b.tanda.has("umur") || b.kelas === "kartu keluarga");
  const sUmur = sp
    .map((x) => ({ x, r: x.baris.find((r) => /\banak\b/.test(r.q) && !/\bcalon\b/.test(r.q) && RE_Q_UMUR.test(r.q) && /\d{1,2}\s*(?:\([a-z ]+\)\s*)?tahun/.test(r.s)) || null }))
    .filter((y) => y.r);
  let umurAnak: number | null = null;
  for (const y of sUmur) {
    const mm = /(\d{1,2})\s*(?:\([a-z ]+\)\s*)?tahun/.exec(y.r!.s);
    if (mm) umurAnak = Math.max(umurAnak ?? 0, Number(mm[1]));
  }
  const bTolak = bukti.filter((b) => b.tanda.has("tolak-kua"));
  const sTolak = sp.map((x) => ({ x, r: x.baris.find((r) => /\b(?:ditolak|menolak|penolakan)\b/.test(r.s) && /\b(?:kua|kantor urusan agama|umur|usia)\b/.test(r.s)) || null })).filter((y) => y.r);
  let sudahCukupUmur = false;
  if (umurAnak !== null && umurAnak >= 19) {
    sudahCukupUmur = true;
    unsurL.push(unsur("umur", "Anak belum berumur 19 tahun", "tidak-terbukti", `Menurut ${sebutSaksi(sUmur.map((y) => y.x))}, anak sudah berumur ${umurAnak} tahun: tidak memerlukan dispensasi kawin.`, { saksi: sUmur.map((y) => saksiDari(y.x, y.r!)), bukti: bUmur.map((b) => buktiUnsur(b)), dasar: [DASAR.umur] }));
  } else if (bUmur.length || sUmur.length || bTolak.length)
    unsurL.push(
      unsur("umur", "Anak belum berumur 19 tahun", bUmur.length || bTolak.length ? "terbukti" : "catatan", `${bUmur.length ? `${sebutBukti(bUmur)} membuktikan tanggal lahir/umur anak` : ""}${sUmur.length ? `${bUmur.length ? "; " : ""}${sebutSaksi(sUmur.map((y) => y.x))}: anak berumur ${umurAnak} tahun` : ""}${bTolak.length ? `; ${sebutBukti(bTolak)} membuktikan penolakan KUA` : sTolak.length ? `; menurut saksi, kehendak nikah ditolak KUA karena belum cukup umur` : ""}.`.replace(/^; /, ""), {
        saksi: [...sUmur, ...sTolak].map((y) => saksiDari(y.x, y.r!)),
        bukti: [...bUmur, ...bTolak].map((b) => buktiUnsur(b)),
        dasar: [DASAR.umur, DASAR.aktaOtentik],
      })
    );
  else unsurL.push(unsur("umur", "Anak belum berumur 19 tahun", "belum", "Belum ada bukti akta kelahiran/KK/ijazah atau keterangan umur anak.", { dasar: [DASAR.umur] }));

  // Alasan sangat mendesak + bukti pendukung (Pasal 7 ayat (2) UU 16/2019 & Penjelasannya).
  const hamil = sp.map((x) => ({ x, r: x.baris.find((r) => RE_HAMIL.test(r.s) && !RE_TIDAK_HAMIL.test(r.s)) || null })).filter((y) => y.r);
  const tidakHamil = sp.map((x) => ({ x, r: x.baris.find((r) => RE_TIDAK_HAMIL.test(r.s)) || null })).filter((y) => y.r);
  const hubungan = sp.map((x) => ({ x, r: x.baris.find((r) => RE_BERHUBUNGAN.test(r.s) && !RE_TIDAK_BERHUBUNGAN.test(r.s)) || null })).filter((y) => y.r);
  const pacaran = sp.map((x) => ({ x, r: x.baris.find((r) => RE_PACARAN.test(r.s)) || null })).filter((y) => y.r);
  const bKes = bukti.filter((b) => b.tanda.has("kesehatan"));
  const bKesHamil = bKes.filter((b) => /\bhamil|kehamilan|usg|mengandung\b/.test(b.teks));
  let mendesak: "hamil" | "berhubungan" | "pacaran" | "" = "";
  if (hamil.length || bKesHamil.length) mendesak = "hamil";
  else if (hubungan.length) mendesak = "berhubungan";
  else if (pacaran.length) mendesak = "pacaran";
  const tSaksi = (d: Array<{ x: SaksiSiap; r: BarisS | null }>) => d.map((y) => saksiDari(y.x, y.r!));
  if (mendesak === "hamil") {
    const cukup = hamil.length >= 2 || (hamil.length >= 1 && bKesHamil.length) || bKesHamil.length > 0;
    unsurL.push(
      unsur("mendesak", "Alasan sangat mendesak", cukup ? "terbukti" : "belum", `${anak === "laki-laki" ? "Calon istri" : "Anak"} telah hamil${hamil.length ? ` menurut ${sebutSaksi(hamil.map((y) => y.x))}` : ""}${bKesHamil.length ? `${hamil.length ? ", dikuatkan" : ""} ${sebutBukti(bKesHamil)}` : ""}.`, {
        saksi: tSaksi(hamil),
        bukti: bKesHamil.map((b) => buktiUnsur(b)),
        dasar: [DASAR.mendesak],
        catatan: tidakHamil.length ? [`${sebutSaksi(tidakHamil.map((y) => y.x))} menerangkan belum hamil.`] : [],
      })
    );
    if (!cukup) ragu.push("kehamilan baru diterangkan satu saksi tanpa keterangan tenaga kesehatan");
  } else if (mendesak === "berhubungan")
    unsurL.push(unsur("mendesak", "Alasan sangat mendesak", hubungan.length >= 2 ? "terbukti" : "belum", `${sebutSaksi(hubungan.map((y) => y.x))} menerangkan anak dan calonnya telah berhubungan layaknya suami istri.`, { saksi: tSaksi(hubungan), dasar: [DASAR.mendesak] }));
  else if (mendesak === "pacaran") {
    unsurL.push(
      unsur("mendesak", "Alasan sangat mendesak", "belum", `${sebutSaksi(pacaran.map((y) => y.x))} hanya menerangkan hubungan dekat/pacaran atau kekhawatiran berbuat zina; "alasan sangat mendesak" = tidak ada pilihan lain dan sangat terpaksa harus dilangsungkan perkawinan.`, {
        saksi: tSaksi(pacaran),
        dasar: [DASAR.mendesak, DASAR.terbaikAnak],
      })
    );
    ragu.push("alasan hanya hubungan dekat/pacaran - nilai keadaan mendesak oleh hakim");
  } else unsurL.push(unsur("mendesak", "Alasan sangat mendesak", "belum", "Belum ada keterangan saksi tentang alasan sangat mendesak.", { dasar: [DASAR.mendesak] }));
  unsurL.push(
    bKes.length
      ? unsur("pendukung", "Bukti pendukung tenaga kesehatan", "terbukti", `${sebutBukti(bKes)}.`, { bukti: bKes.map((b) => buktiUnsur(b)), dasar: [DASAR.mendesak, DASAR.ahliDk] })
      : unsur("pendukung", "Bukti pendukung tenaga kesehatan", "catatan", "Belum ada surat keterangan tenaga kesehatan (Penjelasan Pasal 7 ayat (2): bukti pendukung yang cukup); rekomendasi dokter/bidan/psikolog dapat diminta.", { dasar: [DASAR.mendesak, DASAR.ahliDk] })
  );

  // Halangan perkawinan & status.
  const hl = sp.map((x) => ({ x, r: barisCocok(x, RE_Q_HALANGAN, RE_J_HALANGAN) })).filter((y) => y.r);
  const hlAda = hl.filter((y) => RE_ADA_HALANGAN.test(y.r!.s) && !RE_TIDAK_HALANGAN.test(y.r!.s));
  const hlTidak = hl.filter((y) => RE_TIDAK_HALANGAN.test(y.r!.s));
  if (hlAda.length) unsurL.push(unsur("halangan", "Tidak ada halangan perkawinan", "tidak-terbukti", `${sebutSaksi(hlAda.map((y) => y.x))} menerangkan ada hubungan darah/semenda/sesusuan.`, { saksi: tSaksi(hlAda), dasar: [DASAR.halanganDk, DASAR.halangan] }));
  else unsurL.push(hlTidak.length ? unsur("halangan", "Tidak ada halangan perkawinan", "terbukti", `${sebutSaksi(hlTidak.map((y) => y.x))} menerangkan tidak ada hubungan darah, semenda, atau sesusuan.`, { saksi: tSaksi(hlTidak), dasar: [DASAR.halanganDk, DASAR.halangan] }) : unsur("halangan", "Tidak ada halangan perkawinan", "belum", "Belum ada saksi yang menerangkan tidak adanya halangan perkawinan.", { dasar: [DASAR.halanganDk, DASAR.halangan] }));

  // Kesiapan, persetujuan, tanpa paksaan, restu keluarga.
  const paksa = sp.map((x) => ({ x, r: x.baris.find((r) => RE_PAKSA.test(r.s) && !/\btidak (?:ada )?(?:\S+\s+){0,2}(?:paksaan|dipaksa|terpaksa)\b|\btanpa paksaan\b/.test(r.s)) || null })).filter((y) => y.r);
  const setuju = sp.map((x) => ({ x, r: x.baris.find((r) => RE_SETUJU_ANAK.test(r.s) && /\b(?:anak|calon|keluarga|kedua)\b/.test(`${r.q} ${r.s}`)) || null })).filter((y) => y.r);
  const kerja = sp.map((x) => ({ x, r: x.baris.find((r) => /\bcalon\b/.test(`${r.q} ${r.s}`) && RE_KERJA.test(r.s)) || null })).filter((y) => y.r);
  if (paksa.length) unsurL.push(unsur("paksaan", "Persetujuan anak dan tanpa paksaan", "tidak-terbukti", `${sebutSaksi(paksa.map((y) => y.x))} menerangkan ada paksaan.`, { saksi: tSaksi(paksa), dasar: [DASAR.paksaanDk] }));
  else
    unsurL.push(
      setuju.length
        ? unsur("paksaan", "Persetujuan anak, restu keluarga, dan kesiapan", "terbukti", `${sebutSaksi(setuju.map((y) => y.x))}: ${kutip(setuju[0].r!.jawab, 100)}${kerja.length ? `; calon telah bekerja (${kutip(kerja[0].r!.jawab, 70)})` : ""}.`, { saksi: tSaksi([...setuju, ...kerja]), dasar: [DASAR.paksaanDk, DASAR.terbaikAnak] })
        : unsur("paksaan", "Persetujuan anak, restu keluarga, dan kesiapan", "catatan", "Persetujuan anak dan tidak adanya paksaan diidentifikasi dari keterangan anak di persidangan.", { dasar: [DASAR.paksaanDk] })
    );
  unsurL.push(unsur("didengar", "Keterangan anak, calon, dan orang tua kedua pihak", "catatan", "Pastikan berita acara memuat keterangan anak, calon suami/istri, orang tua/wali anak, dan orang tua/wali calon, serta nasihat hakim (tidak dilaksanakan = penetapan batal demi hukum).", { dasar: [DASAR.dengarCalon, DASAR.dengarPerma, DASAR.nasihatDk] }));

  let hasil: HasilRekomendasiPutusan;
  let varian = "";
  const anakKata = anak === "laki-laki" ? "Cowok" : "Cewek";
  if (!sp.length && !bukti.length) hasil = "";
  else if (sudahCukupUmur) {
    hasil = "tidak-dapat-diterima";
    ragu.push("anak sudah berumur 19 tahun - periksa kembali umur pada akta kelahiran");
  } else if (hlAda.length || paksa.length) hasil = "ditolak";
  else if (mendesak === "hamil" || mendesak === "berhubungan") {
    hasil = "dikabulkan";
    varian = mendesak === "hamil" ? (anak === "laki-laki" ? "[01] [Kabul] DK - (Anak P Cowok) Calon Istri Hamil" : "[01] [Kabul] DK - (Anak P Cewek) Hamil") : `[02] [Kabul] DK - (Anak P ${anakKata}) sudah berhubungan badan`;
  } else {
    hasil = "ditolak";
    varian = anak === "laki-laki" ? "[03a] [Tolak] DK - (Anak P Cowok) Calon Istri Belum Hamil, Hanya Berpacaran" : "[03] [Tolak] DK - (Anak P Cewek) Belum Hamil";
    if (mendesak === "") ragu.push("alasan sangat mendesak belum diterangkan");
  }
  // Keputusan 133 (R1): tanpa kehamilan/hubungan badan tetap Ditolak (ragu), dengan pilihan kedua Dikabulkan (ragu) yang tegas.
  let pilihanLain: PilihanLain | null = null;
  if (hasil === "ditolak" && (mendesak === "pacaran" || mendesak === "") && !hlAda.length && !paksa.length) {
    const ada = [
      mendesak === "pacaran" ? "hubungan anak dan calonnya sudah sangat erat" : "",
      setuju.length ? "keluarga kedua pihak merestui" : "",
      kerja.length ? "calon telah bekerja" : "",
      hlTidak.length ? "tidak ada halangan perkawinan" : "",
      bTolak.length || sTolak.length ? "kehendak nikah sudah ditolak KUA karena umur" : "",
    ].filter(Boolean);
    pilihanLain = {
      hasil: "dikabulkan",
      label: "Dikabulkan",
      keyakinan: "ragu",
      alasan:
        `Majelis kerap mengabulkan bila hubungan sudah sangat erat sehingga dikhawatirkan terjadi perzinaan, keluarga kedua pihak merestui, calon sanggup menafkahi, dan tidak ada halangan perkawinan` +
        `${ada.length ? `; di perkara ini ${ada.join(", ")}` : ""}${mendesak === "" ? "; alasan mendesak belum diterangkan saksi" : ""}. Blangko kabul yang tersedia bertema kehamilan - sesuaikan pertimbangannya.`,
      blangko: anak === "laki-laki" ? "[01] [Kabul] DK - (Anak P Cowok) Calon Istri Hamil" : "[01] [Kabul] DK - (Anak P Cewek) Hamil",
    };
  }
  return { hasil, verstek: false, unsur: unsurL, ragu, varian, anak, mendesak, pilihanLain };
}

// ─── Blangko ─────────────────────────────────────────────────────────────────

const VARIAN_P_TIDAK_HADIR: Record<JenisRekomendasiPutusan, string> = {
  "cerai-gugat": "[98] [NO] 4a. Cerai P Hadir Sidang Pertama Lalu 2x Tidak Hadir (SEMA 1 2022)",
  "cerai-talak": "[98] [NO] 4a. Cerai P Hadir Sidang Pertama Lalu 2x Tidak Hadir (SEMA 1 2022)",
  itsbat: "[99a] [NO] IN - Pemohon Tidak Hadir Lagi (SEMA 1 2022)",
  "itsbat-kontensius": "[99] [NO] IN Kontensius - P Hadir Sidang Pertama Lalu 2x Tidak Hadir (SEMA 1 2022)",
  dk: "[99] [NO] DK - Pemohon Tidak Hadir Lagi (SEMA 1 2022)",
};

/**
 * Pihak pertama pernah hadir lalu DUA sidang terakhir tidak hadir (sandi SIPP dihadiri_oleh: 1 semua, 2 pihak pertama saja,
 * 3 pihak kedua saja, 4 tidak ada). Daftar diurutkan menurut tanggal sidang; kosong/tidak diketahui dilewati.
 */
export function pTidakHadirLagi(hadir: Array<number | null | undefined>): boolean {
  const h = hadir.map((x) => Number(x) || 0).filter((x) => x >= 1 && x <= 4);
  if (h.length < 3) return false;
  const akhir = h.slice(-2);
  return akhir.every((x) => x === 3 || x === 4) && h.slice(0, -2).some((x) => x === 1 || x === 2);
}

const STATUS_SIPP: Record<Exclude<HasilRekomendasiPutusan, "">, string> = { dikabulkan: "Dikabulkan", ditolak: "Ditolak", "tidak-dapat-diterima": "Tidak Dapat Diterima" };

/** Blangko putusan dari peta saran blangko (sama dengan saran sidang) + varian yang dipilih aturan ini di depan. */
export function blangkoUntuk(
  m: MasukanRekomendasiPutusan,
  hasil: HasilRekomendasiPutusan,
  verstek: boolean,
  varian: string,
  ekstra: { anak?: string; mendesak?: string; jumlahSaksi?: number; alternatif?: HasilRekomendasiPutusan; varianAlternatif?: string } = {}
): Rekomendasi[] {
  if (!hasil) return [];
  const status = STATUS_SIPP[hasil];
  let dasar: Rekomendasi[] = [];
  try {
    dasar = rekomendasiBlangkoPutusan(
      {
        jenisPerkara: m.jenisPerkara,
        nomorPerkara: m.nomorPerkara,
        statusPutusan: status,
        verstekPutusan: verstek,
        sudahPutus: true,
        jumlahSaksi: ekstra.jumlahSaksi ?? null,
        ...(ekstra.anak && hasil === "ditolak" ? { anakDispensasi: ekstra.anak, alasanTolakDispensasi: ekstra.mendesak === "pacaran" ? "pacaran" : "lain" } : {}),
      },
      "putus"
    );
  } catch {
    dasar = [];
  }
  if (!dasar.length) return [];
  const utama = dasar[0];
  const alasan = `Rekomendasi menurut alat bukti dan keterangan saksi: ${status.toLowerCase()}${verstek ? " (verstek)" : ""}.`;
  const out: Rekomendasi[] = [];
  if (varian && varian.replace(/\.rtf$/i, "") !== utama.berkas.replace(/\.rtf$/i, "")) out.push({ ...utama, berkas: `${varian}.rtf`, label: varian, alasan, utama: true, perkiraan: false });
  out.push({ ...utama, alasan, utama: !out.length, perkiraan: false });
  for (const r of dasar.slice(1)) if (!out.some((x) => x.berkas === r.berkas)) out.push({ ...r, utama: false });
  // Hasil yang bergantung penilaian hakim (mis. DK tanpa kehamilan): blangko pilihan lain TEPAT di bawah blangko utama (keputusan 133),
  // alternatif lain arah itu di belakang.
  if (ekstra.alternatif && ekstra.alternatif !== hasil) {
    const lain = blangkoUntuk(m, ekstra.alternatif, verstek, ekstra.varianAlternatif || "", { jumlahSaksi: ekstra.jumlahSaksi }).filter((r) => !out.some((x) => x.berkas === r.berkas));
    const ket = `Pilihan lain bila majelis menilai lain: ${STATUS_SIPP[ekstra.alternatif].toLowerCase()} (ragu).`;
    if (lain.length) out.splice(1, 0, { ...lain[0], utama: false, alasan: ket });
    for (const r of lain.slice(1)) out.push({ ...r, utama: false, alasan: ket });
  }
  return out;
}

// ─── Pintu utama ─────────────────────────────────────────────────────────────

export function rekomendasiPutusanDariBukti(m: MasukanRekomendasiPutusan): RekomendasiPutusan | null {
  const mulai = Date.now();
  const jenis = jenisRekomendasi(m.jenisPerkara, m.nomorPerkara, m.jenisPerkaraId);
  if (!jenis) return null;
  const permohonan = jenis === "itsbat" || jenis === "dk";
  const sb = m.sebutan && m.sebutan.P ? m.sebutan : jenis === "cerai-talak" ? { P: "Pemohon", T: "Termohon" } : permohonan ? { P: "Pemohon", T: "Termohon" } : { P: "Penggugat", T: "Tergugat" };
  const saksi = siapkanSaksi(m.saksi, sb);
  const bukti = siapkanBukti(m.bukti);
  const r =
    jenis === "cerai-gugat" || jenis === "cerai-talak"
      ? rekomendasiCerai(m, jenis, sb, saksi, bukti)
      : jenis === "dk"
        ? rekomendasiDk(m, sb, saksi, bukti)
        : rekomendasiItsbat(m, jenis, sb, saksi, bukti);
  if (m.kehadiran?.pTidakHadirLagi === true) {
    // Pihak pertama pernah hadir lalu dua kali tidak hadir: tidak dapat diterima (formil), bukti tidak dinilai lebih jauh.
    r.unsur.unshift(unsur("formil", "Syarat formil: kehadiran " + sb.P, "tidak-terbukti", `${sb.P} pernah hadir, lalu dua kali berturut-turut tidak hadir walau dipanggil resmi dan patut.`, { dasar: [DASAR.pTidakHadir] }));
    r.hasil = "tidak-dapat-diterima";
    r.varian = VARIAN_P_TIDAK_HADIR[jenis];
  }
  const sebabRagu = [...new Set(r.ragu)];
  const belum = r.unsur.filter((u) => u.status === "belum" || u.status === "tidak-terbukti").map((u) => u.judul);
  const hasil = r.hasil;
  const statusSipp = hasil ? STATUS_SIPP[hasil] : "";
  const label = !hasil ? "Belum dapat direkomendasikan" : `${statusSipp}${r.verstek && hasil !== "tidak-dapat-diterima" ? " (verstek)" : ""}`;
  const jp = saksi.filter((x) => x.pihak !== "T").length;
  const dk = "anak" in r ? (r as unknown as { anak: string; mendesak: string; pilihanLain: PilihanLain | null }) : null;
  const pilihanLain = dk && hasil === "ditolak" ? dk.pilihanLain : null;
  const ekstra = dk ? { anak: dk.anak, mendesak: dk.mendesak, alternatif: pilihanLain ? pilihanLain.hasil : undefined, varianAlternatif: pilihanLain ? pilihanLain.blangko : undefined } : {};
  const blangko = blangkoUntuk(m, hasil, r.verstek, r.varian, { ...ekstra, jumlahSaksi: jp });
  const terbukti = r.unsur.filter((u) => u.status === "terbukti").length;
  const ringkas = !hasil
    ? "Keterangan saksi dan bukti surat belum tercatat."
    : `${terbukti} unsur terbukti${belum.length ? `, ${belum.length} belum/tidak terbukti` : ""}${sebabRagu.length ? ` · ragu: ${sebabRagu[0]}` : ""}`;
  return {
    versi: VERSI_REKOMENDASI,
    jenis,
    hasil,
    verstek: r.verstek,
    label,
    statusSipp,
    keyakinan: hasil && !sebabRagu.length ? "cukup" : "ragu",
    sebabRagu,
    unsur: r.unsur,
    belum,
    blangko,
    pilihanLain,
    ringkas,
    jumlahSaksi: { P: jp, T: saksi.filter((x) => x.pihak === "T").length },
    jumlahBukti: bukti.length,
    ms: Date.now() - mulai,
  };
}
