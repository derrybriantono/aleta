import type { Dalil, MatriksDalil, PembuktianDalil, SumberDalil } from "@/lib/matriks-dalil";

/**
 * ============================================================================
 * A2 (1 Nov 2026, keputusan Derry 90-A2) - PENILAI PEMBUKTIAN, LAPIS ATURAN (tanpa AI, murni)
 * ============================================================================
 *
 * Tabel setiap dalil (matriks dalil P2) x alat bukti (surat & elektronik) x keterangan saksi, dengan status:
 *   terbukti | belum-terbukti | bertentangan | tidak-perlu-dibuktikan  -> bahan musyawarah majelis, BUKAN putusan.
 *
 * Aturan (urut, pertama yang kena menang):
 *   1. dalil diakui tegas pihak lawan (tanggapan "diakui", tidak ragu)          -> tidak perlu dibuktikan (Pasal 311 RBg / 174 HIR);
 *      dalil alasan perceraian tetap diberi catatan: majelis tetap mendengar keluarga/orang dekat (Pasal 22 ayat (2) PP 9/1975).
 *   2. tuduhan selingkuh/zina (keputusan 53, 57, 60, 70): putusan pengadilan pidana zina -> terbukti; 2 saksi bersesuaian atau
 *      1 saksi + bukti lain -> terbukti; bukti surat/elektronik saja atau 1 saksi saja -> belum terbukti.
 *   3. ada keterangan sebaliknya (saksi mana pun) -> bertentangan (majelis menimbang).
 *   4. akta otentik yang relevan (akta nikah - perkawinan, akta kelahiran/KK - anak, KTP/KK - tempat tinggal, putusan pidana)
 *      -> terbukti (Pasal 285 RBg / 165 HIR).
 *   5. >= 2 saksi langsung bersesuaian -> terbukti (Pasal 309 RBg / 170 HIR); 1 saksi langsung + bukti lain -> terbukti.
 *   6. 1 saksi langsung saja -> belum terbukti (unus testis nullus testis, Pasal 306 RBg / 169 HIR).
 *   7. hanya de auditu (cerita orang lain) -> belum terbukti, kekuatan lemah; hanya bukti permulaan -> belum terbukti.
 *
 * Pencocokan dalil - saksi - bukti (aturan, tanpa AI): TOPIK (perkawinan, anak, tempat tinggal, perselisihan, pisah rumah,
 * nafkah, selingkuh, kekerasan, judi/mabuk/narkoba, tanpa kabar, penjara, murtad, penyakit, upaya damai) beserta ARAH-nya
 * (dalil "belum dikaruniai anak" vs saksi "dikaruniai dua orang anak" = sebaliknya), huruf alasan 5227 dari matriks, kata isi
 * bersama, dan nomor dalil yang disebut pada keterangan bukti ("untuk membuktikan dalil angka 3").
 *
 * Kinerja: satu lintasan dalil x baris saksi (paling banyak 400 x ±80), pola diolah sekali per modul; tanpa I/O.
 * Tidak ada yang ditulis ke SIPP/ABT/e-Court. Teks dalil dan jawaban saksi hanya dikutip, tidak diubah.
 */

export const VERSI_PENILAI = 1;

export type StatusPembuktian = "terbukti" | "belum-terbukti" | "bertentangan" | "tidak-perlu-dibuktikan";
export type Kekuatan = "sempurna" | "cukup" | "lemah" | "";

export type SaksiMasuk = {
  /** Kunci saksi (mis. "P1", "T2", atau id SIPP). */
  id: string;
  pihak: "P" | "T" | "";
  /** Urutan saksi pihak itu (1, 2, ...). */
  ke?: number;
  /** Hubungan dengan pihak (SIPP perkara_pihak5.keterangan), mis. "Ibu Kandung Penggugat". */
  hubungan?: string;
  baris: Array<{ tanya?: string; jawab: string }>;
};

export type BuktiMasuk = {
  /** Tanda bukti "P.1" / "T.2" (kosong bila belum bertanda). */
  kode: string;
  pihak: "P" | "T" | "";
  jenis: "surat" | "elektronik";
  /** Nama/uraian bukti (nama surat, objek & keterangan bukti elektronik). */
  teks: string;
};

export type DasarSaksi = {
  saksi: string;
  label: string;
  pihak: "P" | "T" | "";
  sikap: "mendukung" | "sebaliknya";
  langsung: boolean;
  tanya: string;
  kutipan: string;
};

export type DasarBukti = { kode: string; label: string; jenis: "surat" | "elektronik"; otentik: boolean; kelas: string };

export type BarisPenilaian = {
  id: string;
  sumber: SumberDalil;
  nomor: string;
  ringkas: string;
  huruf: string[];
  topik: string[];
  status: StatusPembuktian;
  kekuatan: Kekuatan;
  /** Satu kalimat dasar status (untuk lencana/title). */
  alasan: string;
  saksi: DasarSaksi[];
  bukti: DasarBukti[];
  /** Saksi yang ditanya tentang hal ini tetapi tidak mengetahuinya. */
  tidakTahu: string[];
  catatan: string[];
};

export type HasilPenilaian = {
  versi: number;
  sidik: string;
  baris: BarisPenilaian[];
  /** Dalil yang bukan fakta (kesimpulan, kesanggupan membayar biaya, kewenangan) - tidak dinilai. */
  dilewati: number;
  ringkas: Record<StatusPembuktian, number>;
  jumlahSaksi: { P: number; T: number };
  jumlahBukti: { surat: number; elektronik: number };
  /**
   * Bahan musyawarah tingkat perkara (bukan arah putusan): apakah ada alasan perceraian pokok yang terbukti, dan berapa lama
   * pisah tempat tinggal menurut saksi yang menerangkannya (bulan; null bila tidak disebut).
   */
  kesimpulan: { alasanTerbukti: string[]; alasanBelum: string[]; bulanPisah: number | null; catatan: string[] };
  ms: number;
};

export type OpsiPenilai = {
  sebutan?: { P: string; T: string };
  /** Sumber dalil yang dinilai (bawaan: gugatan + rekonvensi). */
  sumber?: SumberDalil[];
  /** Perkara perceraian (bawaan: ada huruf alasan pada matriks). */
  cerai?: boolean;
};

// ─── Teks ────────────────────────────────────────────────────────────────────

const polos = (t: unknown) =>
  String(t == null ? "" : t)
    .replace(/<[^>]*>/g, " ")
    .replace(/\\n/g, " ")
    .replace(/[‘’`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
const kecil = (t: unknown) => polos(t).toLowerCase().replace(/\bisteri\b/g, "istri").replace(/\bdikarunia(?=\s)/g, "dikaruniai");

function kutipPendek(t: string, n = 180): string {
  const p = polos(t).replace(/;\s*$/, "");
  if (p.length <= n) return p;
  const potong = p.slice(0, n);
  const sela = potong.lastIndexOf(" ");
  return `${potong.slice(0, sela > n * 0.6 ? sela : n)} ...`;
}

// ─── Topik & arah ────────────────────────────────────────────────────────────

type Topik = {
  id: string;
  label: string;
  /** Kata yang menandai topik dibicarakan (tanpa arah). */
  ada: RegExp;
  /** Kalimat yang MENIADAKAN hal itu (diperiksa lebih dulu). */
  tidak?: RegExp;
  /** Kalimat yang MENEGASKAN hal itu (bila tidak ada, `ada` dianggap menegaskan). Diperiksa sesudah `tidak`. */
  ya?: RegExp;
  /** Peniadaan lemah, diperiksa SESUDAH `ya` ("awalnya rukun, namun sejak 2020 sering bertengkar" = menegaskan pertengkaran). */
  tidakLemah?: RegExp;
  /** Topik alasan perceraian (catatan Pasal 22 ayat (2) PP 9/1975 pada pengakuan). */
  alasanCerai?: boolean;
};

const K = "(?:\\S+\\s+){0,3}";
const TOPIK: readonly Topik[] = [
  {
    id: "nikah",
    label: "perkawinan",
    ada: /\b(?:menikah|pernikahan|perkawinan|akad nikah|kawin|suami istri|suami-istri|sebagai (?:suami|istri)|pasangan suami|akta nikah|buku nikah)\b/,
    tidak: new RegExp(`\\b(?:tidak|belum) (?:pernah )?${K}(?:menikah|kawin)\\b|\\bbukan (?:suami|istri)\\b`),
  },
  {
    id: "anak",
    label: "anak",
    ada: /\b(?:anak|keturunan|dikaruniai|dikarunia)\b/,
    tidak: new RegExp(`\\b(?:belum|tidak) ${K}(?:dikaruniai|mempunyai|memiliki|punya|ada|mendapat(?:kan)?)\\s+(?:\\S+\\s+){0,2}(?:anak|keturunan)\\b|\\bbelum (?:ada )?(?:anak|keturunan)\\b|\\btidak (?:ada|punya) anak\\b`),
    ya: /\b(?:dikaruniai|mempunyai|memiliki|punya|lahir|melahirkan|telah lahir)\b|\banak (?:kandung|pertama|kedua|bernama|tersebut|perempuan|laki)|\borang anak\b/,
  },
  {
    id: "tinggal",
    label: "tempat tinggal bersama",
    // "meninggalkan tempat tinggal bersama" adalah pisah rumah, bukan tempat tinggal bersama.
    ada: /(?<!tempat |kediaman )\b(?:tinggal bersama|hidup bersama|tinggal di rumah|bertempat tinggal di rumah|membina rumah tangga di|tinggal di desa|tinggal di kelurahan)\b/,
  },
  {
    id: "domisili",
    label: "tempat kediaman pihak",
    ada: /\b(?:bertempat tinggal di|beralamat di|berdomisili|alamat (?:penggugat|tergugat|pemohon|termohon)|wilayah hukum)\b/,
  },
  {
    id: "selisih",
    label: "perselisihan dan pertengkaran",
    alasanCerai: true,
    ada: /\b(?:bertengkar|pertengkaran|perselisihan|berselisih|percekcokan|cekcok|keributan|ribut|harmonis|rukun|ketidakharmonisan|keretakan|sering marah|memarahi)\b/,
    tidak: /\b(?:tidak pernah|belum pernah|tidak ada|jarang) (?:\S+\s+){0,3}(?:bertengkar|pertengkaran|perselisihan|cekcok|ribut|masalah)\b/,
    // "Rukun dan harmonis" saja biasanya menerangkan keadaan awal perkawinan ("telah hidup rukun layaknya suami istri"); yang
    // membantah perselisihan hanya bila keadaannya SEKARANG ("sampai sekarang masih rukun").
    tidakLemah:
      /\b(?:masih|tetap|sampai sekarang|hingga (?:sekarang|kini|saat ini)|saat ini|sekarang|kini) (?:\S+ ){0,4}(?<!tidak |kurang |belum )(?:rukun|harmonis|baik-baik saja)\b|\b(?<!tidak |kurang |belum )(?:rukun|harmonis|baik-baik saja) (?:\S+ ){0,2}(?:sampai|hingga) (?:sekarang|kini|saat ini)\b/,
    ya: /\b(?:bertengkar|pertengkaran|perselisihan|berselisih|percekcokan|cekcok|keributan|ribut|ketidakharmonisan|keretakan|tidak (?:lagi )?(?:harmonis|rukun)|sering marah|memarahi)\b/,
  },
  {
    id: "pisah",
    label: "pisah tempat tinggal",
    alasanCerai: true,
    ada: /\b(?:pisah|berpisah|perpisahan|meninggalkan (?:rumah|tempat|kediaman)|pergi meninggalkan|pulang ke rumah|kembali ke rumah orang ?tua|tidak (?:lagi )?tinggal (?:bersama|serumah|satu rumah)|masih tinggal (?:bersama|serumah|satu rumah)|tidak pernah (?:kembali|pulang))\b/,
    tidak: /\b(?:masih|tetap) (?:tinggal )?(?:bersama|serumah|satu rumah)\b|\b(?:belum|tidak) (?:pernah )?(?:pisah|berpisah)\b/,
  },
  {
    id: "nafkah",
    label: "nafkah",
    alasanCerai: true,
    ada: /\b(?:nafkah|menafkahi|uang belanja|biaya hidup|kebutuhan rumah tangga|malas bekerja|tidak bekerja|pekerjaan tetap)\b/,
    tidak: /\b(?:masih|selalu|tetap|rutin|cukup) (?:\S+\s+){0,3}(?:memberi|memberikan|menafkahi|mengirim(?:kan)?|menanggung)\b|\bnafkah (?:\S+\s+){0,2}(?:cukup|terpenuhi)\b/,
    ya: /\b(?:tidak|tidak pernah|tidak lagi|sudah tidak|jarang|kurang|tidak cukup|lalai|enggan|menolak) (?:\S+\s+){0,3}(?:memberi|memberikan|menafkahi|nafkah|biaya|uang|mencukupi|bertanggung jawab)\b|\bmalas bekerja\b|\btidak (?:punya|memiliki|mempunyai) pekerjaan\b|\bnafkah (?:\S+\s+){0,2}(?:kurang|tidak)\b/,
  },
  {
    id: "selingkuh",
    label: "pihak ketiga / selingkuh",
    alasanCerai: true,
    ada: /\b(?:selingkuh|berselingkuh|perselingkuhan|wanita idaman lain|pria idaman lain|wil|pil|perempuan lain|wanita lain|laki-laki lain|lelaki lain|pria lain|orang ketiga|berzina|zina|perzinahan|perzinaan|menikah lagi|menikah siri|kawin lagi)\b/,
    tidak: /\btidak (?:pernah )?(?:selingkuh|berselingkuh|berzina)\b|\btidak ada (?:orang ketiga|(?:wanita|perempuan|laki-laki|pria) lain)\b/,
  },
  {
    id: "kekerasan",
    label: "kekerasan / perlakuan kasar",
    alasanCerai: true,
    ada: /\b(?:memukul|dipukul|pukul|menampar|ditampar|menendang|ditendang|kekerasan|menganiaya|penganiayaan|kdrt|mencekik|melukai|mengancam|ancaman|senjata tajam|kasar|memaki|mencaci|menghina)\b/,
    tidak: /\btidak (?:pernah )?(?:\S+\s+){0,2}(?:memukul|kekerasan|kasar|mengancam|menganiaya)\b/,
  },
  {
    id: "candu",
    label: "judi / mabuk / narkoba",
    alasanCerai: true,
    ada: /\b(?:judi|berjudi|penjudi|mabuk|mabuk-mabukan|minuman keras|miras|narkoba|sabu|sabu-sabu|narkotika|obat terlarang|pemadat)\b/,
    tidak: /\btidak (?:pernah )?(?:berjudi|mabuk|minum|memakai|mengonsumsi)\b/,
  },
  {
    id: "kabar",
    label: "pergi tanpa kabar",
    alasanCerai: true,
    ada: /\b(?:tidak diketahui (?:lagi )?(?:alamat|keberadaan|tempat|rimba)|tanpa kabar|tidak ada kabar|tidak (?:pernah )?(?:memberi|ada) kabar|putus komunikasi|tidak ada komunikasi|tidak pernah berkomunikasi|ghaib|gaib|masih (?:ada )?komunikasi|masih berkomunikasi)\b/,
    tidak: /\b(?:masih|tetap) (?:ada )?(?:komunikasi|berkomunikasi|memberi kabar|berhubungan)\b|\bdiketahui alamatnya\b/,
  },
  { id: "penjara", label: "hukuman penjara", alasanCerai: true, ada: /\b(?:penjara|dipenjara|dipidana|narapidana|lembaga pemasyarakatan|lapas|rutan)\b/ },
  { id: "murtad", label: "berpindah agama", alasanCerai: true, ada: /\b(?:murtad|pindah agama|berpindah agama|keluar dari (?:agama )?islam)\b/ },
  { id: "penyakit", label: "cacat / penyakit", alasanCerai: true, ada: /\b(?:penyakit|cacat|sakit (?:keras|jiwa|menahun)|impoten|lumpuh)\b/ },
  {
    id: "damai",
    label: "upaya damai keluarga",
    ada: /\b(?:didamaikan|mendamaikan|merukunkan|dirukunkan|dinasihati|dinasehati|menasihati|menasehati|upaya damai|diupayakan|memusyawarahkan|musyawarah)\b/,
    tidak: /\bbelum (?:pernah )?(?:ada )?(?:\S+\s+){0,2}(?:diupayakan|didamaikan|dirukunkan|dinasihati|dinasehati|upaya)\b/,
  },
];
const TOPIK_ID = new Map(TOPIK.map((t) => [t.id, t]));

/** Huruf alasan 5227 (Pasal 19 PP 9/1975 / 116 KHI) -> topik pembuktiannya. */
const TOPIK_HURUF: Record<string, string[]> = {
  A: ["candu", "selingkuh"],
  B: ["kabar", "pisah"],
  C: ["penjara"],
  D: ["kekerasan"],
  E: ["penyakit"],
  F: ["selisih"],
  H: ["murtad"],
};

const RE_TIDAK_TAHU =
  /\b(?:tidak|belum|kurang) (?:pernah )?(?:tahu|mengetahui|mengetahi|megetahui|melihat|mendengar|menyaksikan|mengerti)\b|\btidak tahu pasti\b|\bkurang jelas\b|\btidak ingat\b/;
const RE_DE_AUDITU =
  /\b(?:dengar|mendengar|diceritakan|bercerita|cerita|diberitahu|diberi tahu|informasi|kabar|katanya|menurut)\s+(?:\S+\s+){0,3}(?:dari|oleh)\s+(?:\S+\s+){0,2}(?:penggugat|tergugat|pemohon|termohon|orang|keluarga|tetangga|ibu|ayah|bapak|kakak|adik|anak|istri|suami|saudara|teman)|\b(?:hanya|cuma) (?:\S+\s+){0,2}(?:dengar|mendengar|cerita|diceritakan|diberitahu)\b|\btahu dari cerita\b|\bberdasarkan cerita\b/;
const RE_LANGSUNG = /\b(?:melihat sendiri|melihat langsung|menyaksikan|mendengar sendiri|mendengar langsung|saya lihat|saksi lihat|pernah melihat)\b/;
const RE_IYA = /^(?:ya|iya|benar|betul|pernah|sering|sudah|ada)\b/;
const RE_BUKAN = /^(?:tidak|belum|bukan|tidak pernah|tidak ada)\b/;

const RE_DULU = /\b(?:awalnya|pada awalnya|semula|mula-mula|mulanya|pada mulanya|awal (?:pernikahan|menikah|perkawinan|berumah tangga)|dahulu|dulu|sebelumnya|setelah menikah)\b/;

function arahTopik(t: Topik, s: string): -1 | 0 | 1 {
  if (!t.ada.test(s)) return 0;
  if (t.tidak && t.tidak.test(s)) return -1;
  if (t.ya && t.ya.test(s)) return 1;
  // "Awalnya rukun dan harmonis" menerangkan keadaan DULU, bukan membantah perselisihan sekarang.
  if (t.tidakLemah && t.tidakLemah.test(s)) return RE_DULU.test(s) ? 0 : -1;
  return t.ya ? 0 : 1;
}

/** Topik yang dibicarakan sebuah kalimat beserta arahnya. */
export function topikKalimat(teks: string): Map<string, -1 | 0 | 1> {
  const s = kecil(teks);
  const h = new Map<string, -1 | 0 | 1>();
  for (const t of TOPIK) if (t.ada.test(s)) h.set(t.id, arahTopik(t, s));
  return h;
}

// ─── Kata isi ────────────────────────────────────────────────────────────────

const KATA_UMUM = new Set(
  (
    "bahwa yang dengan tersebut adalah karena telah tidak akan untuk dalam pada dari oleh sebagai atau juga sudah belum bukan hanya kepada terhadap antara serta " +
    "para pihak penggugat tergugat pemohon termohon saksi tahu mengetahui melihat mendengar sendiri sering selalu kemudian sejak sampai sekarang hingga lagi " +
    "rumah tangga tahun bulan tanggal pernah masih saat waktu setelah sebelum ketika maka namun tetapi bahkan apakah saudara kenal mengapa kenapa bagaimana " +
    "siapa dimana kapan berapa memang benar betul itu ini ada yaitu yakni kurang lebih sekitar mereka kami saya beliau keduanya selama terjadi menjadi mulai"
  ).split(" ")
);
function kataIsi(t: string): Set<string> {
  const h = new Set<string>();
  for (const w of kecil(t).replace(/['`]/g, "").replace(/[^a-z0-9]+/g, " ").split(" ")) if (w.length >= 4 && !KATA_UMUM.has(w) && !/^\d+$/.test(w)) h.add(w);
  return h;
}
function tumpang(a: Set<string>, b: Set<string>): { sama: number; skor: number } {
  let sama = 0;
  for (const w of a) if (b.has(w)) sama += 1;
  return { sama, skor: sama / Math.max(1, Math.min(a.size, b.size)) };
}

// ─── Dalil yang dinilai ──────────────────────────────────────────────────────

/** Dalil kesimpulan/prosedural yang bukan fakta untuk dibuktikan. */
const RE_BUKAN_FAKTA =
  /^(?:\d+[.)]?\s*)?(?:bahwa\s+)?(?:berdasarkan|oleh karena|dengan demikian|atas dasar|sehubungan dengan|untuk itu|maka)\b|\bsanggup (?:membayar|menanggung) (?:seluruh |semua )?biaya\b|\bbiaya (?:yang timbul|perkara)\b|\bberwenang\b|\bkewenangan\b|\bmohon kepada\b|\btelah cukup alasan\b|\bmemenuhi (?:unsur|ketentuan|alasan)\b|\bmenurut hukum\b/;

function dalilDinilai(m: MatriksDalil, sumber: SumberDalil[]) {
  const pilih: Dalil[] = [];
  let lewat = 0;
  for (const d of m.dalil) {
    if (d.jenis !== "posita-fakta" || !sumber.includes(d.sumber) || d.pembuka) continue;
    const s = kecil(d.teks);
    // Butir induk yang hanya pengantar rincian ("... yang disebabkan:") tetap dinilai menurut topik yang disebutnya.
    if (RE_BUKAN_FAKTA.test(s) && topikKalimat(s).size === 0) {
      lewat += 1;
      continue;
    }
    pilih.push(d);
  }
  return { pilih, lewat };
}

// ─── Bukti ───────────────────────────────────────────────────────────────────

type KelasBukti = { kelas: string; otentik: boolean; topik: string[] };
const KELAS_BUKTI: Array<{ re: RegExp; kelas: string; otentik: boolean; topik: string[] }> = [
  { re: /\bputusan\b.*\b(?:zina|perzinahan|perzinaan|284)\b|\b(?:zina|perzinahan|perzinaan)\b.*\bputusan\b/, kelas: "putusan pidana zina", otentik: true, topik: ["selingkuh"] },
  { re: /\bputusan\b.*\b(?:penganiayaan|kekerasan|kdrt)\b/, kelas: "putusan pidana kekerasan", otentik: true, topik: ["kekerasan"] },
  { re: /\bputusan\b.*\b(?:pidana|penjara|pengadilan negeri)\b|\bpetikan putusan\b/, kelas: "putusan pidana", otentik: true, topik: ["penjara"] },
  { re: /\bakta nikah\b|\bbuku nikah\b|\bkutipan akta (?:nikah|perkawinan)\b|\bduplikat (?:kutipan )?akta nikah\b|\bakta perkawinan\b/, kelas: "akta nikah", otentik: true, topik: ["nikah"] },
  { re: /\bakta kelahiran\b|\bakte kelahiran\b|\bkutipan akta kelahiran\b/, kelas: "akta kelahiran", otentik: true, topik: ["anak"] },
  { re: /\bkartu keluarga\b|\bkk\b/, kelas: "kartu keluarga", otentik: true, topik: ["domisili", "anak"] },
  { re: /\bkartu tanda penduduk\b|\bktp\b|\bktp-el\b/, kelas: "KTP", otentik: true, topik: ["domisili"] },
  { re: /\bakta cerai\b/, kelas: "akta cerai", otentik: true, topik: [] },
  { re: /\bvisum\b/, kelas: "visum", otentik: false, topik: ["kekerasan"] },
  { re: /\bsurat keterangan\b.*\b(?:ghaib|gaib|tidak diketahui|tidak berada)\b/, kelas: "surat keterangan ghaib", otentik: false, topik: ["kabar", "pisah"] },
  { re: /\bsurat keterangan\b.*\b(?:penghasilan|gaji|tidak mampu)\b|\bslip gaji\b/, kelas: "keterangan penghasilan", otentik: false, topik: ["nafkah"] },
  { re: /\bsurat keterangan\b.*\b(?:domisili|bertempat tinggal|tempat tinggal)\b/, kelas: "keterangan domisili", otentik: false, topik: ["domisili"] },
];

function kelasBukti(b: BuktiMasuk): KelasBukti {
  const s = kecil(b.teks);
  for (const k of KELAS_BUKTI) if (k.re.test(s)) return { kelas: k.kelas, otentik: k.otentik && b.jenis === "surat", topik: k.topik };
  // Selainnya: topik dari isinya (foto/tangkapan layar percakapan, surat pernyataan, dst.) - bukti lain, bukan akta otentik.
  return { kelas: b.jenis === "elektronik" ? "bukti elektronik" : "bukti surat", otentik: false, topik: [...topikKalimat(s).keys()] };
}

const RE_RUJUK_DALIL = /\bdalil\s+(?:\S+\s+){0,3}(?:angka|nomor|butir|poin|point)\s+([0-9]+(?:\.[a-z0-9]+)?)/g;

// ─── Saksi ───────────────────────────────────────────────────────────────────

type BarisSaksi = {
  saksi: SaksiMasuk;
  label: string;
  tanya: string;
  jawab: string;
  s: string;
  topik: Map<string, -1 | 0 | 1>;
  kata: Set<string>;
  tidakTahu: boolean;
  deAuditu: boolean;
  langsung: boolean;
  /** Lama pisah tempat tinggal yang disebut baris ini (bulan), atau null. */
  bulanPisah: number | null;
};

/** "tidak pernah melihat dan mendengar langsung" bukan pengetahuan langsung. */
const RE_TIDAK_LANGSUNG = /\b(?:tidak|belum) (?:pernah )?(?:melihat|mendengar|menyaksikan)\b/;
const ANGKA_KATA: Record<string, number> = {
  satu: 1, se: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10, sebelas: 11, "dua belas": 12,
};
const RE_LAMA = /\b(\d{1,2}|satu|dua belas|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas)\s*(?:\(\s*[a-z ]+\s*\)\s*)?(bulan|tahun)\b|\bse(bulan|tahun)\b/g;
/**
 * Lama pisah (bulan) dari jawaban saksi yang membicarakan pisah tempat tinggal: "sudah sekitar 5 (lima) bulan", "kurang lebih 2 tahun
 * lamanya", "setahun lebih". Angka di luar kalimat pisah (umur, lama tinggal bersama) tidak dipakai: hanya bagian sesudah kata pisah.
 */
function bulanPisah(s: string, topik: Map<string, -1 | 0 | 1>): number | null {
  if (!topik.has("pisah") || topik.get("pisah") === -1) return null;
  const i = s.search(/\b(?:pisah|berpisah|meninggalkan)\b/);
  if (i < 0) return null;
  const sisa = s.slice(i, i + 220);
  let besar: number | null = null;
  for (const m of sisa.matchAll(RE_LAMA)) {
    const n = m[3] ? 1 : /^\d+$/.test(m[1]) ? Number(m[1]) : ANGKA_KATA[m[1]] || 0;
    const satuan = m[3] || m[2];
    const b = satuan === "tahun" ? n * 12 : n;
    if (b > 0 && b < 600) besar = Math.max(besar || 0, b);
  }
  return besar;
}

function labelSaksi(x: SaksiMasuk, sb: { P: string; T: string }, urutLain: number): string {
  // Saksi tanpa data pihak/urutan (baris SIPP sudah diganti) tetap dapat dibedakan: "Saksi lain 1".
  if (x.pihak !== "P" && x.pihak !== "T") return `Saksi lain ${urutLain}`;
  return `Saksi ${x.ke || ""} ${x.pihak === "T" ? sb.T : sb.P}`.replace(/\s+/g, " ").trim();
}

/** Pertanyaan pembuka/penutup yang bukan keterangan atas dalil. */
const RE_TANYA_UMUM = /\b(?:kenal dengan|hubungan (?:saudara|saksi)|maksud .* (?:menghadap|datang)|masih ada (?:yang|keterangan|hal)|sudah cukup)\b/;
const RE_MAKSUD = /\b(?:mengajukan (?:gugatan |permohonan )?(?:cerai|perceraian|gugatan|talak|permohonan)|ingin bercerai|hendak bercerai|menghadap di persidangan|datang ke pengadilan)\b/;
const RE_TANYA_MAKSUD = /\b(?:kenapa|mengapa|apa (?:alasan|sebab)) .*\b(?:mengajukan|bercerai|menggugat)\b/;

/**
 * Jawaban yang masih memuat isian blangko ("sebanyak .... kali, di ........") atau dua pilihan sekaligus ("Saya pernah melihat ...;
 * Saya tidak pernah melihat ...") belum menjadi keterangan saksi: tidak dihitung, saksinya dicatat.
 */
const RE_SISA_ISIAN = /\.{4,}|_{3,}|…{2,}|\bpernah (?:melihat|mendengar)\b.*;\s*saya tidak pernah (?:melihat|mendengar)\b/;

function siapkanSaksi(daftar: SaksiMasuk[], sb: { P: string; T: string }): { baris: BarisSaksi[]; sisa: string[] } {
  const h: BarisSaksi[] = [];
  const sisa = new Set<string>();
  let lain = 0;
  for (const x of daftar) {
    const label = labelSaksi(x, sb, x.pihak === "P" || x.pihak === "T" ? 0 : ++lain);
    for (const r of x.baris || []) {
      const jawab = polos(r.jawab);
      if (!jawab || /^(?:sudah )?cukup\b|^tidak ada lagi\b/i.test(jawab)) continue;
      if (RE_SISA_ISIAN.test(kecil(jawab))) {
        sisa.add(label);
        continue;
      }
      const tanya = polos(r.tanya);
      if (tanya && RE_TANYA_UMUM.test(kecil(tanya)) && !topikKalimat(jawab).size) continue;
      const sj = kecil(jawab);
      // "Penggugat mengajukan cerai karena sudah tidak rukun" = saksi mengulang alasan gugatan (yang disampaikan pihak), bukan fakta
      // yang ia ketahui - tidak dihitung sebagai penguat.
      if (RE_MAKSUD.test(sj) || (tanya && RE_TANYA_MAKSUD.test(kecil(tanya)))) continue;
      let topik = topikKalimat(sj);
      // Jawaban ringkas ("Ya, sering", "Tidak pernah") memakai topik pertanyaannya; arahnya mengikuti iya/tidak.
      if (!topik.size && tanya) {
        const tt = topikKalimat(tanya);
        const iya = RE_IYA.test(sj) ? 1 : RE_BUKAN.test(sj) ? -1 : 0;
        topik = new Map([...tt].map(([k, a]) => [k, (iya === 0 ? 0 : ((a || 1) * iya) as -1 | 1)]));
      }
      h.push({ saksi: x, label, tanya, jawab, s: sj, topik, kata: kataIsi(sj), tidakTahu: RE_TIDAK_TAHU.test(sj), deAuditu: RE_DE_AUDITU.test(sj), langsung: RE_LANGSUNG.test(sj) && !RE_TIDAK_LANGSUNG.test(sj), bulanPisah: bulanPisah(sj, topik) });
    }
  }
  return { baris: h, sisa: [...sisa] };
}

// ─── Penilaian ───────────────────────────────────────────────────────────────

type SikapSaksi = { id: string; label: string; pihak: "P" | "T" | ""; mendukung: BarisSaksi[]; sebaliknya: BarisSaksi[]; tidakTahu: boolean; deAuditu: boolean; langsung: boolean };

/** Kalimat inti perkawinan (bukan sekadar menyebut "suami istri"). */
const RE_NIKAH_INTI =
  /\b(?:melangsungkan (?:akad )?(?:pernikahan|perkawinan)|telah menikah|menikah (?:pada|secara|di)|akad nikah|dicatat(?:kan)? (?:oleh|di|pada)|kutipan akta nikah|buku nikah|akta nikah|(?:pernikahan|perkawinan) (?:tersebut|penggugat|pemohon|antara))\b/;

/**
 * Topik INTI yang dibuktikan dalil. Topik yang hanya tersebut sambil lalu dibuang supaya akta nikah tidak "membuktikan" puncak
 * pertengkaran yang kebetulan menyebut "suami istri": perkawinan hanya bila kalimatnya tentang akad/pencatatan (atau tidak ada
 * topik lain); tempat tinggal bersama tidak dihitung pada dalil pisah rumah.
 */
function topikDalil(d: Dalil, induk: Dalil | null): Map<string, -1 | 0 | 1> {
  const s = kecil(d.teks);
  let t = topikKalimat(s);
  if (t.size > 1 && t.has("nikah") && !RE_NIKAH_INTI.test(s)) t.delete("nikah");
  if (t.has("pisah") && t.has("tinggal")) t.delete("tinggal");
  if (!t.size && induk) {
    // Butir rincian tanpa topik sendiri ("a. Saharlin bin Sukri, usia 32 tahun") mewarisi topik anak/perkawinan induknya. Rincian sebab
    // di bawah "... perselisihan yang disebabkan:" TIDAK mewarisi perselisihan: saksi yang hanya menerangkan pertengkaran tidak
    // membuktikan sebab konkretnya - ia dinilai dari kata isinya sendiri.
    const ti = topikKalimat(induk.teks);
    t = new Map([...ti].filter(([k]) => k === "anak" || k === "nikah"));
  }
  // Huruf alasan dari matriks menambah topik hanya bila kalimatnya belum menyebut topik apa pun.
  if (!t.size) for (const h of d.huruf || []) for (const id of TOPIK_HURUF[h] || []) t.set(id, 0);
  // Arah 0 pada dalil = menegaskan (dalil pernyataan positif kecuali kalimatnya meniadakan).
  for (const [k, a] of t) if (a === 0) t.set(k, 1);
  return t;
}

const DASAR = {
  akui: "diakui pihak lawan (Pasal 311 RBg / Pasal 174 HIR)",
  otentik: "akta otentik (Pasal 285 RBg / Pasal 165 HIR)",
  dua: "dua saksi atau lebih saling bersesuaian (Pasal 309 RBg / Pasal 170 HIR)",
  satuPlus: "satu saksi ditambah alat bukti lain (Pasal 306 RBg / Pasal 169 HIR)",
  unus: "baru satu saksi tanpa alat bukti lain (Pasal 306 RBg / Pasal 169 HIR)",
};

const ringkasSaksi = (daftar: Array<{ label: string }>) => daftar.map((x) => x.label).join(" dan ");

type BuktiSiap = KelasBukti & { b: BuktiMasuk; kata: Set<string>; rujuk: Set<string> };
type HasilSatuan = {
  status: StatusPembuktian;
  kekuatan: Kekuatan;
  alasan: string;
  catatan: string[];
  per: SikapSaksi[];
  relevan: BuktiSiap[];
  tidakTahu: string[];
};

const PERINGKAT: Record<StatusPembuktian, number> = { bertentangan: 3, "belum-terbukti": 2, terbukti: 1, "tidak-perlu-dibuktikan": 0 };
/** Topik alasan yang di dalil gabungan hanya mengiringi (sebab/keadaan), bukan penentu status. */
const TOPIK_PENGIRING = new Set(["nafkah"]);

/**
 * Satu satuan pembuktian: satu topik dalil (atau "isi" = kata isi dalil bila tanpa topik). Mengembalikan status + dasar.
 */
function nilaiSatuan(
  u: string,
  arahDalil: -1 | 0 | 1,
  d: Dalil,
  kd: Set<string>,
  baris: BarisSaksi[],
  bk: BuktiSiap[]
): HasilSatuan {
  const per = new Map<string, SikapSaksi>();
  for (const r of baris) {
    let sikap: 0 | 1 | -1 = 0;
    if (u === "isi") {
      const tp = tumpang(kd, r.kata);
      if (!(tp.sama >= 3 && tp.skor >= 0.5)) continue;
      sikap = /\btidak benar\b|\bbukan\b|\btidak pernah\b/.test(r.s) ? -1 : 1;
    } else {
      if (!r.topik.has(u)) continue;
      const a = r.topik.get(u) || 0;
      sikap = a === 0 ? 0 : a === arahDalil ? 1 : -1;
    }
    const x = per.get(r.saksi.id) || { id: r.saksi.id, label: r.label, pihak: r.saksi.pihak, mendukung: [], sebaliknya: [], tidakTahu: false, deAuditu: false, langsung: false };
    per.set(r.saksi.id, x);
    if (r.langsung) x.langsung = true;
    if (r.deAuditu) x.deAuditu = true;
    if (r.tidakTahu && !r.deAuditu) {
      x.tidakTahu = true;
      continue;
    }
    if (sikap === 1) x.mendukung.push(r);
    else if (sikap === -1) x.sebaliknya.push(r);
  }
  const semua = [...per.values()];
  const dukung = semua.filter((x) => x.mendukung.length && !x.sebaliknya.length);
  const langsung = dukung.filter((x) => !(x.deAuditu && !x.langsung));
  const lemah = dukung.filter((x) => x.deAuditu && !x.langsung);
  const lawan = semua.filter((x) => x.sebaliknya.length && !x.mendukung.length);
  const ganda = semua.filter((x) => x.sebaliknya.length && x.mendukung.length);
  const tidakTahu = semua.filter((x) => !x.mendukung.length && !x.sebaliknya.length && x.tidakTahu).map((x) => x.label);

  const nomor = String(d.nomor || "");
  const relevan = bk.filter((x) => (nomor && x.rujuk.has(nomor)) || (u === "isi" ? tumpang(kd, x.kata).sama >= 3 && tumpang(kd, x.kata).skor >= 0.6 : x.topik.includes(u)));
  const otentik = relevan.filter((x) => x.otentik);
  const tandaBukti = (xs: BuktiSiap[]) => xs.map((x) => (x.b.kode ? `${x.b.kode} (${x.kelas})` : x.kelas)).join(", ");
  const catatan: string[] = [];
  const h = (status: StatusPembuktian, kekuatan: Kekuatan, alasan: string): HasilSatuan => ({ status, kekuatan, alasan, catatan, per: semua, relevan, tidakTahu });

  if (ganda.length) catatan.push(`${ringkasSaksi(ganda)} memberi keterangan yang saling berlawanan.`);
  if (u === "selingkuh") {
    // Keputusan 53/57/60/70: putusan pidana zina cukup; selainnya dua saksi bersesuaian atau satu saksi + bukti lain.
    const zina = otentik.find((x) => x.kelas === "putusan pidana zina");
    if (zina) return h("terbukti", "sempurna", `Putusan pengadilan tentang perzinahan (${zina.b.kode || "bukti surat"}) - tidak perlu saksi (keputusan 70).`);
    if (lawan.length + ganda.length && (langsung.length || relevan.length))
      return h("bertentangan", "", `${langsung.length ? ringkasSaksi(langsung) : tandaBukti(relevan)} mendukung tuduhan, tetapi ${ringkasSaksi([...lawan, ...ganda])} menerangkan sebaliknya - majelis menimbang.`);
    if (lawan.length + ganda.length) return h("bertentangan", "", `${ringkasSaksi([...lawan, ...ganda])} menerangkan sebaliknya; tuduhan tidak dikuatkan saksi atau bukti lain.`);
    if (langsung.length >= 2) return h("terbukti", "cukup", `${ringkasSaksi(langsung)}: ${DASAR.dua}.`);
    if (langsung.length === 1 && relevan.length) return h("terbukti", "cukup", `${langsung[0].label} ditambah ${tandaBukti(relevan)}: ${DASAR.satuPlus}.`);
    if (langsung.length === 1) return h("belum-terbukti", "lemah", `Tuduhan selingkuh: ${DASAR.unus}.`);
    if (relevan.length) return h("belum-terbukti", "lemah", `Tuduhan selingkuh baru didukung ${tandaBukti(relevan)} tanpa saksi yang menerangkannya (keputusan 70).`);
    if (lemah.length) return h("belum-terbukti", "lemah", `Hanya ${ringkasSaksi(lemah)} yang mendengar dari cerita orang lain (de auditu).`);
    return h("belum-terbukti", "", tidakTahu.length ? `${tidakTahu.join(" dan ")} tidak mengetahui tuduhan ini.` : "Belum ada saksi atau bukti yang menerangkan tuduhan ini.");
  }
  if (lawan.length + ganda.length && (langsung.length || otentik.length || lemah.length)) {
    const pro = langsung.length || lemah.length ? ringkasSaksi([...langsung, ...lemah]) : tandaBukti(otentik);
    return h("bertentangan", "", `${pro} sesuai dalil, tetapi ${ringkasSaksi([...lawan, ...ganda])} menerangkan sebaliknya - majelis menimbang.`);
  }
  if (lawan.length + ganda.length) return h("bertentangan", "", `${ringkasSaksi([...lawan, ...ganda])} menerangkan sebaliknya; tidak ada saksi atau bukti yang menguatkan dalil.`);
  if (otentik.length) {
    if (langsung.length) catatan.push(`Juga diterangkan ${ringkasSaksi(langsung)}.`);
    return h("terbukti", "sempurna", `${tandaBukti(otentik)}: ${DASAR.otentik}.`);
  }
  if (langsung.length >= 2) return h("terbukti", "cukup", `${ringkasSaksi(langsung)}: ${DASAR.dua}.`);
  if (langsung.length === 1 && relevan.length) return h("terbukti", "cukup", `${langsung[0].label} ditambah ${tandaBukti(relevan)}: ${DASAR.satuPlus}.`);
  if (langsung.length === 1)
    return h("belum-terbukti", "lemah", `${langsung[0].label} saja: ${DASAR.unus}.${lemah.length ? ` ${ringkasSaksi(lemah)} hanya mendengar dari cerita orang lain (de auditu).` : ""}`);
  if (lemah.length) return h("belum-terbukti", "lemah", `${ringkasSaksi(lemah)} hanya mendengar dari cerita orang lain (testimonium de auditu).`);
  if (relevan.length) return h("belum-terbukti", "lemah", `Baru ${tandaBukti(relevan)} (bukti permulaan) tanpa saksi yang menerangkannya.`);
  return h("belum-terbukti", "", tidakTahu.length ? `${tidakTahu.join(" dan ")} tidak mengetahui hal ini.` : "Belum ada saksi atau bukti yang menerangkan dalil ini.");
}

/**
 * Penilaian pembuktian satu matriks dalil.
 * @param m       matriks dalil (P2)
 * @param saksi   keterangan saksi tersimpan/tersusun (per saksi, baris tanya-jawab)
 * @param bukti   alat bukti surat & elektronik kedua pihak
 */
export function nilaiPembuktian(m: MatriksDalil, saksi: SaksiMasuk[], bukti: BuktiMasuk[], opsi: OpsiPenilai = {}): HasilPenilaian {
  const mulai = Date.now();
  const sb = opsi.sebutan || { P: "Penggugat", T: "Tergugat" };
  const sumber = opsi.sumber || ["gugatan", "rekonvensi"];
  const cerai = opsi.cerai ?? m.dalil.some((d) => (d.huruf || []).length > 0);
  const { pilih, lewat } = dalilDinilai(m, sumber);
  const perId = new Map(m.dalil.map((d) => [d.id, d]));
  const { baris, sisa: saksiSisa } = siapkanSaksi(Array.isArray(saksi) ? saksi : [], sb);
  const bk: BuktiSiap[] = (Array.isArray(bukti) ? bukti : [])
    .filter((b) => b && polos(b.teks))
    .map((b) => {
      const s = kecil(b.teks);
      const rujuk = new Set<string>();
      for (const x of s.matchAll(RE_RUJUK_DALIL)) rujuk.add(x[1]);
      return { b, ...kelasBukti(b), kata: kataIsi(s), rujuk };
    });

  const hasil: BarisPenilaian[] = [];
  for (const d of pilih) {
    const td = topikDalil(d, d.induk ? perId.get(d.induk) || null : null);
    const kd = kataIsi(d.teks);
    const pembukti: "P" | "T" = d.pihak === "0047" ? "T" : "P";
    const satuan = td.size ? [...td].map(([u, a]) => ({ u, h: nilaiSatuan(u, a, d, kd, baris, bk) })) : [{ u: "isi", h: nilaiSatuan("isi", 1, d, kd, baris, bk) }];
    // Dalil yang menyatakan beberapa hal sekaligus: status terlemah (bertentangan > belum terbukti > terbukti) di antara topik POKOK-nya.
    // Bila dalil menyebut alasan perceraian (perselisihan, pisah, selingkuh, kekerasan, ...), topik pengiring (anak, nafkah, tempat
    // tinggal, perkawinan, upaya damai) hanya dicatat - "pergi bekerja ke luar daerah karena nafkah kurang" dinilai dari pisahnya.
    const pokok = satuan.filter((x) => TOPIK_ID.get(x.u)?.alasanCerai && !TOPIK_PENGIRING.has(x.u));
    const penentu = pokok.length ? pokok : satuan;
    const terlemah = penentu.reduce((a, b) => (PERINGKAT[b.h.status] > PERINGKAT[a.h.status] ? b : a));
    let { status, kekuatan, alasan } = terlemah.h;
    const catatan = [...new Set(satuan.flatMap((x) => x.h.catatan))];
    if (satuan.length > 1) {
      const lain = satuan.filter((x) => x !== terlemah && x.h.status !== terlemah.h.status);
      for (const x of lain) catatan.push(`${TOPIK_ID.get(x.u)?.label || "isi dalil"}: ${LABEL_STATUS[x.h.status]} - ${x.h.alasan}`);
      if (terlemah.u !== "isi") alasan = `${TOPIK_ID.get(terlemah.u)?.label || ""}: ${alasan}`;
    }

    // Pengakuan tegas pihak lawan mengalahkan semuanya (Pasal 311 RBg / 174 HIR).
    const t = d.tanggapan;
    if (t && t.status === "diakui" && !t.ragu) {
      const r = (t.rincian || [])[0];
      const lawanSebut = pembukti === "P" ? sb.T : sb.P;
      const dulu = { status, alasan };
      status = "tidak-perlu-dibuktikan";
      kekuatan = "sempurna";
      alasan = `${r && r.nomor ? `Diakui ${lawanSebut} (${r.sumber} angka ${r.nomor})` : `Diakui ${lawanSebut}`}; ${DASAR.akui}.`;
      if (cerai && [...td.keys()].some((k) => TOPIK_ID.get(k)?.alasanCerai))
        catatan.unshift(
          dulu.status === "terbukti"
            ? `Alasan perceraian ini juga terbukti dari keterangan saksi/bukti: ${dulu.alasan}`
            : "Alasan perceraian: pengakuan saja tidak cukup; majelis tetap mendengar keterangan keluarga/orang dekat (Pasal 22 ayat (2) PP 9/1975)."
        );
    }

    // Dasar: saksi & bukti dari semua satuan (satu baris per saksi/bukti).
    const dasarSaksi = new Map<string, DasarSaksi>();
    const tidakTahu = new Set<string>();
    for (const x of satuan) {
      for (const s of x.h.per) {
        const pakai = s.mendukung.length ? s.mendukung : s.sebaliknya;
        if (!pakai.length) continue;
        const sikap = s.mendukung.length && !s.sebaliknya.length ? "mendukung" : "sebaliknya";
        const ada = dasarSaksi.get(s.id);
        if (ada && (ada.sikap === "sebaliknya" || sikap === "mendukung")) continue;
        const r = pakai[0];
        dasarSaksi.set(s.id, { saksi: s.id, label: s.label, pihak: s.pihak, sikap, langsung: !(s.deAuditu && !s.langsung), tanya: kutipPendek(r.tanya, 140), kutipan: kutipPendek(r.jawab) });
      }
      for (const l of x.h.tidakTahu) tidakTahu.add(l);
    }
    for (const s of dasarSaksi.values()) tidakTahu.delete(s.label);
    const buktiDasar = new Map<string, DasarBukti>();
    for (const x of satuan)
      for (const b of x.h.relevan) {
        const label = b.b.kode ? `${b.b.kode} ${b.kelas}` : b.kelas;
        buktiDasar.set(label, { kode: b.b.kode, label, jenis: b.b.jenis, otentik: b.otentik, kelas: b.kelas });
      }
    if (tidakTahu.size && !/tidak mengetahui/.test(alasan)) catatan.push(`${[...tidakTahu].join(" dan ")} tidak mengetahui hal ini.`);
    const saksiLawan = [...dasarSaksi.values()].filter((x) => x.sikap === "mendukung" && x.pihak && x.pihak !== pembukti);
    if (saksiLawan.length && status === "terbukti") catatan.push(`${ringkasSaksi(saksiLawan)} (saksi pihak lawan) ikut menerangkan sesuai dalil.`);

    hasil.push({
      id: d.id,
      sumber: d.sumber,
      nomor: d.nomor,
      ringkas: polos(d.ringkas) || kutipPendek(d.teks, 160),
      huruf: d.huruf || [],
      topik: [...td.keys()].map((k) => TOPIK_ID.get(k)?.label || k),
      status,
      kekuatan,
      alasan,
      saksi: [...dasarSaksi.values()],
      bukti: [...buktiDasar.values()],
      tidakTahu: [...tidakTahu],
      catatan,
    });
  }

  const ringkas: Record<StatusPembuktian, number> = { terbukti: 0, "belum-terbukti": 0, bertentangan: 0, "tidak-perlu-dibuktikan": 0 };
  for (const r of hasil) ringkas[r.status] += 1;
  const sx = Array.isArray(saksi) ? saksi : [];

  // Bahan musyawarah tingkat perkara. Alasan POKOK = topik alasan perceraian selain pisah rumah dan nafkah (keduanya penguat/sebab
  // perselisihan, bukan alasan tersendiri kecuali didalilkan dengan huruf B/G).
  const alasanTerbukti = new Set<string>();
  const alasanBelum = new Set<string>();
  if (cerai)
    for (const r of hasil)
      for (const t of r.topik) {
        const tp = TOPIK.find((x) => x.label === t);
        if (!tp || !tp.alasanCerai || tp.id === "pisah" || tp.id === "nafkah") continue;
        if (r.status === "terbukti" || r.status === "tidak-perlu-dibuktikan") alasanTerbukti.add(t);
        else alasanBelum.add(t);
      }
  for (const t of alasanTerbukti) alasanBelum.delete(t);
  // Lama pisah menurut saksi yang menerangkan pisah (tidak dihitung dari saksi yang tidak tahu).
  const lama = baris.filter((r) => r.bulanPisah !== null && !r.tidakTahu).map((r) => r.bulanPisah as number);
  const bulan = lama.length ? Math.max(...lama) : null;
  const catatanPerkara: string[] = [];
  if (cerai && bulan !== null && bulan < 6 && alasanTerbukti.has(TOPIK_ID.get("selisih")!.label))
    catatanPerkara.push(`Menurut saksi, pisah tempat tinggal baru ±${bulan} bulan; periksa syarat lama pisah (sedikitnya 6 bulan) pada rumusan kamar agama SEMA yang berlaku.`);
  if (cerai && !alasanTerbukti.size && alasanBelum.size) catatanPerkara.push(`Alasan perceraian belum terbukti: ${[...alasanBelum].join(", ")}.`);
  if (saksiSisa.length)
    catatanPerkara.push(`Keterangan ${saksiSisa.join(" dan ")} masih memuat isian blangko yang belum diisi/dipilih ("...." atau dua pilihan sekaligus); baris itu tidak dinilai.`);
  return {
    versi: VERSI_PENILAI,
    sidik: sidikBahan(sx, Array.isArray(bukti) ? bukti : []),
    baris: hasil,
    dilewati: lewat,
    ringkas,
    jumlahSaksi: { P: sx.filter((x) => x.pihak === "P").length, T: sx.filter((x) => x.pihak === "T").length },
    jumlahBukti: { surat: bk.filter((x) => x.b.jenis === "surat").length, elektronik: bk.filter((x) => x.b.jenis === "elektronik").length },
    kesimpulan: { alasanTerbukti: [...alasanTerbukti], alasanBelum: [...alasanBelum], bulanPisah: bulan, catatan: catatanPerkara },
    ms: Date.now() - mulai,
  };
}

/** Sidik ringan bahan (saksi + bukti) - sama = tidak perlu dihitung ulang. FNV-1a 32 bit, tanpa pustaka. */
export function sidikBahan(saksi: SaksiMasuk[], bukti: BuktiMasuk[]): string {
  const t = JSON.stringify([
    saksi.map((x) => [x.id, x.pihak, (x.baris || []).map((r) => [polos(r.tanya), polos(r.jawab)])]),
    bukti.map((b) => [b.kode, b.pihak, b.jenis, polos(b.teks)]),
  ]);
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * Status untuk disimpan ke matriks (aturPembuktian). Status yang ditetapkan PETUGAS (oleh selain "aturan") tidak pernah ditimpa;
 * status aturan untuk dalil yang tidak lagi dinilai dihapus.
 */
export function ubahanPembuktian(h: HasilPenilaian, tersimpan: Record<string, PembuktianDalil | null | undefined>, kini = new Date()): Record<string, PembuktianDalil | null> {
  const ubah: Record<string, PembuktianDalil | null> = {};
  const ada = new Set<string>();
  for (const r of h.baris) {
    ada.add(r.id);
    const lama = tersimpan[r.id];
    if (lama && lama.oleh && lama.oleh !== "aturan") continue;
    const baru: PembuktianDalil = {
      status: r.status,
      catatan: r.alasan,
      oleh: "aturan",
      pada: kini.toISOString(),
      kekuatan: r.kekuatan,
      dasar: { saksi: r.saksi.map((x) => `${x.label}${x.sikap === "sebaliknya" ? " (sebaliknya)" : x.langsung ? "" : " (de auditu)"}`), bukti: r.bukti.map((x) => x.label) },
      sidik: h.sidik,
    };
    if (lama && lama.status === baru.status && lama.catatan === baru.catatan && lama.sidik === baru.sidik) continue;
    ubah[r.id] = baru;
  }
  for (const [id, v] of Object.entries(tersimpan)) if (v && v.oleh === "aturan" && !ada.has(id)) ubah[id] = null;
  return ubah;
}

export const LABEL_STATUS: Record<StatusPembuktian, string> = {
  terbukti: "terbukti",
  "belum-terbukti": "belum terbukti",
  bertentangan: "bertentangan",
  "tidak-perlu-dibuktikan": "tidak perlu dibuktikan",
};
