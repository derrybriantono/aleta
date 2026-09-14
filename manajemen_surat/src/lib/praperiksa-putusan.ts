/**
 * PRAPERIKSA PUTUSAN - agen yang membaca, menimbang, dan BERHENTI.
 *
 * ============================================================================
 * APA YANG DIKERJAKAN
 * ============================================================================
 *
 * Sebelum putusan dituliskan ke borang Putusan Akhir SIPP, draf ALETA dan
 * isian borang diadu dengan fakta yang sudah tercatat di SIPP:
 *
 *   - tanggal putusan yang diketik borang harus hari sidang perkara itu;
 *   - amar harus menjawab petitum, dan kata kerjanya harus sesuai Status
 *     Putusan yang dipilih;
 *   - majelis yang disebut naskah harus majelis yang ditetapkan;
 *   - nama orang di amar harus pihak perkara ini - bukan perkara lain;
 *   - perkaranya belum putus.
 *
 * Bila bertentangan, agen ini BERHENTI dan MENYEBUTKAN. Tidak ada satu pun
 * yang diperbaiki sendiri: yang memutus adalah hakim, yang mengisi adalah
 * petugas, dan yang di sini hanya membaca.
 *
 * ============================================================================
 * TIGA TINGKAT, DAN HANYA SATU YANG MENAHAN
 * ============================================================================
 *
 *   hentikan   pertentangan yang DIBUKTIKAN dari SIPP - penulisan otomatis
 *              tidak dijalankan sampai orang membaca dan memutuskan
 *   perhatian  kemungkinan keliru yang tidak dapat dipastikan mesin
 *   catatan    keterangan: apa yang diperiksa, apa yang tidak dapat diperiksa
 *
 * Yang membedakan hentikan dari perhatian bukan seberapa parah akibatnya,
 * melainkan seberapa PASTI buktinya. Aturan di tingkat hentikan seluruhnya
 * diukur atas 1.643 putusan 2025-2026 di SIPP PA Donggala sebelum dipakai:
 *
 *   - 1.643 dari 1.643 putusan bertanggal hari yang punya baris jadwal sidang
 *     -> tanggal tanpa sidang adalah pertentangan, bukan kebiasaan;
 *   - 1.642 dari 1.643 amar memuat kata kerja yang sesuai statusnya; satu
 *     yang tidak - status "Gugur" dengan amar pencabutan - memang keliru
 *     -> status yang tidak berpadanan dengan amar menahan;
 *   - 142 dari 144 amar yang menyebut nomor perkara menyebut nomornya sendiri
 *     -> nomor lain saja menahan; nomor lain di samping nomornya sendiri
 *        hanya perhatian.
 *
 * Yang tidak diukur - kesesuaian isi amar dengan petitum kata demi kata,
 * ejaan nama e-Court, verstek - tidak pernah naik ke tingkat hentikan.
 * (871 dari 936 amar verstek menyebut "verstek": cukup lazim untuk ditanya,
 * terlalu banyak kekecualian untuk menahan.)
 *
 * ============================================================================
 * TIDAK DIPERIKSA BUKAN LOLOS
 * ============================================================================
 *
 * Fakta yang tidak terbaca - pihak yang viewnya tidak ada, e-Court yang
 * belum ditarik, tanggal yang tidak terbaca dari borang - dituliskan sebagai
 * catatan yang menyebut APA yang tidak diperiksa. Rapor yang diam tentang
 * yang dilewatinya akan dibaca sebagai rapor yang seluruhnya lolos.
 *
 * Berkas ini MURNI: tidak membaca basis data, tidak memanggil apa pun.
 * Faktanya datang dari bot (praperiksaPutusanService.bacaFakta), drafnya dari
 * portal, dan seluruh aturannya dapat diuji di sini tanpa satu pun sambungan.
 */
import { adalahSubsidair, kataIsi, type ButirAmar, type Petitum } from "@/lib/amar-petitum";
import { teksDariHtml } from "@/lib/alasan-perkara-sipp";

export type Tingkat = "hentikan" | "perhatian" | "catatan";
export type SumberTemuan = "sipp" | "draf" | "borang" | "ecourt" | "ai" | "aleta";

export type Temuan = {
  /** Pengenal tetap untuk uji dan penyaringan - bukan untuk dibaca orang. */
  kode: string;
  tingkat: Tingkat;
  judul: string;
  rincian: string;
  sumber: SumberTemuan;
};

export type FaktaPraperiksa = {
  nomorPerkara: string;
  perkaraId?: number;
  jenisPerkara?: string;
  jenisPerkaraLengkap?: string;
  tanggalDaftar?: string;
  /** HTML CKEditor petitum apa adanya dari perkara.petitum. */
  petitum: string;
  pihak: Array<{ nama: string; pihakKe: number | null; peran?: string }>;
  anak: string[];
  majelis: Array<{ nama: string; jabatan: string; urutan?: number }>;
  panitera?: string[];
  jadwal: Array<{ tanggalSidang: string; agenda: string; ditunda: boolean; urutan?: number }>;
  putusan: { ada: boolean; tanggalPutusan: string; statusPutusan: string; verstek: string };
  ecourt: { terdaftar: boolean | null; pihak: Array<{ nama: string; peran: string }> };
  libur: { tanggal: string; nama: string } | null;
  /** YYYY-MM-DD menurut jam peladen bot. */
  hariIni: string;
  tidakTerbaca?: string[];
};

export type UsulanPutusan = {
  nomorPerkara: string;
  /** Apa adanya dari borang: dd/mm/yyyy, dd-mm-yyyy, atau YYYY-MM-DD. */
  tanggalPutusan?: string;
  /** Label pilihan Status Putusan yang terpilih di borang, mis. "Dikabulkan". */
  statusPutusan?: string;
  /** Nilai pilihan Putusan Verstek: "Y", "T", atau kosong. */
  verstek?: string;
  /** Amar dari draf ALETA - teks polos, satu butir per baris. */
  amar: string;
  /** Naskah penuh draf, untuk mencari nama majelis dan nomor perkara. */
  naskah?: string;
};

export type PendapatAi = {
  ok: boolean;
  alasan?: string;
  temuan?: Array<{ judul: string; rincian: string }>;
  catatan?: string[];
  provider?: string;
  model?: string;
};

export type RaporPraperiksa = {
  temuan: Temuan[];
  /** Ada sekurang-kurangnya satu temuan bertingkat hentikan. */
  hentikan: boolean;
  jumlah: Record<Tingkat, number>;
  ringkas: string;
  /** Pemeriksaan yang benar-benar dijalankan. Yang tidak dapat dijalankan disebut sebagai catatan. */
  diperiksa: string[];
  aduan: {
    jumlahPetitum: number;
    jumlahAmar: number;
    belumTerjawab: number;
    amarTanpaPetitum: number;
  } | null;
};

const NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function bersih(nilai: unknown): string {
  return String(nilai ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Tanggal dari borang menjadi YYYY-MM-DD.
 *
 * Borang Putusan Akhir SIPP (#tgl_putusan) menulis dd/mm/yyyy; jawaban bot
 * menulis YYYY-MM-DD; orang mengetik keduanya dengan garis pemisah yang
 * berbeda-beda. Yang tidak dikenali dipulangkan kosong - bukan ditebak.
 */
export function tanggalIso(masukan: unknown): string {
  const teks = bersih(masukan);
  if (!teks) return "";

  let tahun = 0;
  let bulan = 0;
  let hari = 0;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(teks);
  const lokal = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(teks);
  if (iso) {
    tahun = Number(iso[1]);
    bulan = Number(iso[2]);
    hari = Number(iso[3]);
  } else if (lokal) {
    hari = Number(lokal[1]);
    bulan = Number(lokal[2]);
    tahun = Number(lokal[3]);
  } else {
    return "";
  }

  if (tahun < 1900 || bulan < 1 || bulan > 12 || hari < 1 || hari > 31) return "";
  const tanggal = new Date(Date.UTC(tahun, bulan - 1, hari));
  if (tanggal.getUTCMonth() !== bulan - 1 || tanggal.getUTCDate() !== hari) return "";
  return `${tahun}-${String(bulan).padStart(2, "0")}-${String(hari).padStart(2, "0")}`;
}

/** Nama hari untuk YYYY-MM-DD, atau kosong. */
export function namaHari(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const tanggal = new Date(`${iso}T00:00:00Z`);
  return NAMA_HARI[tanggal.getUTCDay()] ?? "";
}

/** dd-mm-yyyy untuk dibaca orang. */
export function tanggalRingkas(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

/**
 * Judul bagian yang bukan butir. "Primer"/"Primair" dan "Subsidair" adalah
 * kepala daftar pada petitum SIPP - diukur: petitum ditulis
 * "<div>Primer</div><div>1. ...</div>". "MENGADILI" adalah kepala amar.
 */
const POLA_KEPALA_DAFTAR = /^(primer|primair|primary|subsidair|subsidiair|subsider|mengadili|menetapkan|dalam (konvensi|rekonvensi|eksepsi|pokok perkara))\s*[:.]?$/i;

/**
 * Memecah teks menjadi butir bernomor.
 *
 * Baris "1." / "1)" / "(1)" memulai butir; baris tanpa nomor sesudahnya
 * menyambung butir sebelumnya - amar yang panjang kerap dipatahkan CKEditor
 * ke beberapa alinea. Baris sebelum butir pertama yang bukan kepala daftar
 * dibuang: itu pembukaan, bukan tuntutan.
 */
export function pecahButirBernomor(teks: string): Array<{ nomor: number; teks: string }> {
  const hasil: Array<{ nomor: number; teks: string }> = [];
  const baris = String(teks ?? "").replace(/\r\n/g, "\n").split("\n");
  // Sesudah kepala "Subsidair", tiap baris adalah tuntutannya sendiri -
  // "Mohon putusan yang seadil-adilnya" jarang diberi nomor, dan menyambungnya
  // ke butir primer terakhir membuat butir itu terbaca sebagai subsidair.
  let subsidair = false;

  for (const mentah of baris) {
    const satu = bersih(mentah);
    if (!satu) continue;
    if (POLA_KEPALA_DAFTAR.test(satu)) {
      subsidair = /subsid|subsider/i.test(satu);
      continue;
    }

    // "1." / "1)" / "(1)" - atau tanda butir dari <li> (lihat teksButir):
    // amar yang tersimpan SIPP kebanyakan <ol><li> tanpa angka tertulis.
    const bernomor = /^(?:\(?(\d{1,2})[.)]|•)\s*(.*)$/.exec(satu);
    if (bernomor) {
      const isi = bersih(bernomor[2]);
      hasil.push({ nomor: hasil.length + 1, teks: isi });
      continue;
    }
    const terakhir = hasil[hasil.length - 1];
    if (subsidair || !terakhir) {
      if (subsidair) hasil.push({ nomor: hasil.length + 1, teks: satu });
      continue;
    }
    terakhir.teks = bersih(`${terakhir.teks} ${satu}`);
  }

  return hasil.filter((butir) => butir.teks.length > 0);
}

/**
 * Amar baku yang memang tidak menjawab petitum mana pun, dan karena itu
 * tidak diadu. amar-petitum.ts hanya mengecualikan biaya perkara; di sini
 * ditambah dua yang lahir dari hukum acara, bukan dari tuntutan:
 *
 *   - pernyataan verstek ("Tergugat yang telah dipanggil ... tidak hadir") -
 *     ada pada hampir tiap amar verstek, dan tidak pernah ada di petitum;
 *   - perintah kepada Panitera (mencatat pencabutan, mengirim salinan).
 *
 * Tiap tambahan di sini adalah satu jenis amar yang berhenti diperiksa,
 * maka daftarnya sengaja pendek dan seluruhnya kalimat baku hukum acara.
 */
const POLA_AMAR_BAKU = [
  /dipanggil\s+(?:secara\s+|dengan\s+)?(?:resmi|sah|patut)[\s\S]*tidak\s+hadir/,
  /tidak\s+hadir[\s\S]*verstek/,
  /^menyatakan\s+(?:tergugat|termohon)\b[\s\S]*tidak\s+hadir/,
  /memerintahkan\s+(?:kepada\s+)?panitera/,
  // "Menolak gugatan Penggugat selain dan selebihnya" - penutup amar yang
  // dikabulkan sebagian; ia menjawab SISA petitum, bukan satu petitum.
  /menolak\s+(?:gugatan|permohonan)[\s\S]*selebihnya/,
  /biaya\s+perkara/,
];

function amarBakuPraperiksa(teks: string): boolean {
  const isi = String(teks ?? "").toLowerCase();
  return POLA_AMAR_BAKU.some((pola) => pola.test(isi));
}

/**
 * Status yang amarnya memang TIDAK menjawab petitum: perkara dicabut, gugur,
 * tidak dapat diterima, ditolak, atau berdamai. Mengadu petitum talak dengan
 * amar pencabutan menghasilkan "seluruh petitum belum terjawab" - benar
 * secara hitungan, kosong secara makna. Diukur: pada 200 putusan sungguhan,
 * pencabutan menyumbang sebagian besar perhatian aduan sebelum saringan ini.
 */
const POLA_STATUS_TANPA_ADUAN = /cabut|gugur|tidak\s+dapat\s+diterima|niet|n\.?o\.?\b|ditolak|tolak|damai/;

/**
 * ============================================================================
 * MEMADANKAN AMAR DENGAN PETITUM - PENUGASAN TERBAIK, BUKAN RAKUS BERURUT
 * ============================================================================
 *
 * amar-petitum.ts (F4 perakit) memadankan petitum satu per satu menurut
 * urutannya dan mengambil amar yang skornya tertinggi SAAT ITU. Diukur atas
 * putusan itsbat sungguhan: petitum "sah pernikahan ... Kecamatan Rio Pakava,
 * Kabupaten Donggala, Sulawesi Tengah" direbut amar "memerintahkan mencatatkan
 * ... Kecamatan Rio Pakava, Kabupaten Donggala, Sulawesi Tengah" - nama
 * tempat yang sama menang atas pokoknya - sehingga amar sah pernikahannya
 * tersisa sebagai "ultra petita" dan petitum pencatatannya "belum terjawab".
 * Dua perhatian palsu dari satu putusan yang sepenuhnya benar, pada 4 dari
 * 200 putusan.
 *
 * Di sini pasangannya dipilih SEKALIGUS: jumlah skor seluruh pasangan yang
 * terbesar (penugasan optimal lewat pemrograman dinamis atas bitmask amar -
 * jumlah butirnya kecil), dengan skor simetris: kata yang sama dibagi ukuran
 * himpunan yang LEBIH KECIL, supaya amar pendek yang seluruh katanya ada di
 * petitum panjang tetap berpadanan. Nama dalam kurung dibuang lebih dulu:
 * "Pemohon I (Ferry Fadly bin Djumari)" - bukan pokok yang dituntut.
 *
 * Yang keluar dari sini hanya PERHATIAN; tidak ada yang naik ke hentikan.
 * Arah salahnya tetap aman.
 */
const AMBANG_PADANAN = 0.5;
const MINIMAL_KATA_SAMA = 2;
/** Di atas ini penugasan optimal terlalu mahal; jatuh ke rakus tertinggi-dulu. */
const BATAS_PENUGASAN_OPTIMAL = 14;

type PadananPraperiksa = {
  pasangan: Array<{ petitum: Petitum; amar: ButirAmar; skor: number }>;
  belumTerjawab: Petitum[];
  amarTanpaPetitum: ButirAmar[];
  subsidair: Petitum[];
};

function himpunanKata(teks: string): Set<string> {
  return new Set(kataIsi(String(teks ?? "").replace(/\([^)]*\)/g, " ")));
}

function skorSimetris(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let sama = 0;
  for (const kata of a) if (b.has(kata)) sama += 1;
  if (sama < MINIMAL_KATA_SAMA) return 0;
  return sama / Math.min(a.size, b.size);
}

/** Pilihan amar (indeks) untuk tiap petitum yang memaksimalkan jumlah skor; -1 bila tidak ada. */
function penugasanOptimal(skor: number[][]): number[] {
  const jumlahP = skor.length;
  const jumlahA = jumlahP ? skor[0].length : 0;
  const ukuran = 1 << jumlahA;
  const nilai: Float64Array[] = Array.from({ length: jumlahP + 1 }, () => new Float64Array(ukuran));
  const pilih: Int8Array[] = Array.from({ length: jumlahP }, () => new Int8Array(ukuran).fill(-1));

  for (let i = jumlahP - 1; i >= 0; i -= 1) {
    for (let mask = 0; mask < ukuran; mask += 1) {
      let terbaik = nilai[i + 1][mask];
      let pilihan = -1;
      for (let j = 0; j < jumlahA; j += 1) {
        if (mask & (1 << j)) continue;
        const s = skor[i][j];
        if (s <= 0) continue;
        const total = s + nilai[i + 1][mask | (1 << j)];
        if (total > terbaik + 1e-9) {
          terbaik = total;
          pilihan = j;
        }
      }
      nilai[i][mask] = terbaik;
      pilih[i][mask] = pilihan;
    }
  }

  const hasil: number[] = [];
  let mask = 0;
  for (let i = 0; i < jumlahP; i += 1) {
    const j = pilih[i][mask];
    hasil.push(j);
    if (j >= 0) mask |= 1 << j;
  }
  return hasil;
}

/** Rakus tertinggi-dulu, untuk daftar yang terlalu panjang bagi bitmask. */
function penugasanRakus(skor: number[][]): number[] {
  const hasil = skor.map(() => -1);
  const amarTerpakai = new Set<number>();
  const calon: Array<{ i: number; j: number; s: number }> = [];
  skor.forEach((baris, i) => baris.forEach((s, j) => s > 0 && calon.push({ i, j, s })));
  calon.sort((a, b) => b.s - a.s);
  for (const { i, j } of calon) {
    if (hasil[i] >= 0 || amarTerpakai.has(j)) continue;
    hasil[i] = j;
    amarTerpakai.add(j);
  }
  return hasil;
}

export function padankanAmarPetitum(petitumSemua: Petitum[], amarSemua: ButirAmar[]): PadananPraperiksa {
  const subsidair = petitumSemua.filter((p) => adalahSubsidair(p.teks));
  const petitum = petitumSemua.filter((p) => !adalahSubsidair(p.teks));
  // Amar baku ikut dipadankan - petitum biaya harus bertemu amar biayanya -
  // tetapi yang tersisa tanpa pasangan tidak dituduh ultra petita.
  const amar = [...amarSemua];

  const kataP = petitum.map((p) => himpunanKata(p.teks));
  const kataA = amar.map((a) => himpunanKata(a.teks));
  const skor = petitum.map((_, i) =>
    amar.map((_, j) => {
      const s = skorSimetris(kataP[i], kataA[j]);
      return s >= AMBANG_PADANAN ? s : 0;
    })
  );
  const pilihan =
    petitum.length <= BATAS_PENUGASAN_OPTIMAL && amar.length <= BATAS_PENUGASAN_OPTIMAL
      ? penugasanOptimal(skor)
      : penugasanRakus(skor);

  const pasangan: PadananPraperiksa["pasangan"] = [];
  const belumTerjawab: Petitum[] = [];
  const amarTerpakai = new Set<number>();
  petitum.forEach((p, i) => {
    const j = pilihan[i];
    if (j >= 0) {
      pasangan.push({ petitum: p, amar: amar[j], skor: skor[i][j] });
      amarTerpakai.add(j);
    } else {
      belumTerjawab.push(p);
    }
  });
  const amarTanpaPetitum = amar.filter((a, j) => !amarTerpakai.has(j) && !amarBakuPraperiksa(a.teks));

  return { pasangan, belumTerjawab, amarTanpaPetitum, subsidair };
}

/**
 * Gelar dan sebutan yang dibuang sebelum nama dibandingkan.
 *
 * Nama di SIPP "Sudarmin H.I.M. Tang, S.H.I.,M.H" dan di naskah "Sudarmin
 * H.I.M. Tang, S.H.I., M.H." harus terbaca sama. Yang dibandingkan hanya
 * NAMANYA. Daftar ini sengaja pendek dan seluruhnya gelar: kata yang dibuang
 * dari nama adalah kata yang berhenti dibandingkan.
 */
const GELAR = new Set([
  "shi", "sh", "mh", "mhi", "mhum", "hum", "msi", "si", "se", "sag", "spd", "spdi", "sos", "ssos", "sip",
  "drs", "dra", "dr", "prof", "ir", "st", "mm", "ma", "mag", "lc", "kn", "mkn", "mpd", "med", "mkes",
  "h", "hj", "haji", "hajjah", "kh", "sdr", "sdri", "tn", "ny", "nn", "bapak", "ibu", "bp",
]);

/** Nama tanpa tanda baca dan gelar, huruf kecil - untuk dibandingkan, bukan ditampilkan. */
export function samakanNama(nama: unknown): string {
  return (
    String(nama ?? "")
      .toLowerCase()
      .split(/[\s,;:()"'`‘’“”]+/)
      // Titik dibuang DI DALAM kata, bukan dijadikan pemisah: "S.H." harus
      // menjadi satu kata "sh" yang dikenali sebagai gelar, bukan "s" dan "h".
      .map((kata) => kata.replace(/\./g, ""))
      .filter((kata) => kata && !GELAR.has(kata))
      .join(" ")
      .trim()
  );
}

/**
 * Kata yang mendahului atau mengikuti nama di amar dan bukan bagian namanya.
 * "Tergugat Dandi bin Darwis" -> "Dandi bin Darwis".
 *
 * Pada amar yang SELURUHNYA KAPITAL, huruf besar tidak lagi membedakan nama
 * dari kata biasa, sehingga kata kerja amar dan kata sambung yang lazim
 * berdiri di sebelah nama ikut disebut di sini. Daftarnya terbatas pada
 * kosakata amar - dan yang dibandingkan kelak memakai `includes` dua arah,
 * sehingga sisa kata yang tidak terbuang tidak menggagalkan padanan.
 */
const POLA_SEBUTAN_DEPAN =
  /^(?:(?:penggugat|tergugat|pemohon|termohon|turut|kuasa|hukum|saksi|anak|anaknya|bernama|nama|sdr|sdri|saudara|saudari|bapak|ibu|tn|ny|nn|i|ii|iii|iv|v|dan|atau|antara|dengan|terhadap|kepada|oleh|yaitu|yakni|bahwa|menyatakan|menetapkan|menghukum|mengabulkan|menjatuhkan|memerintahkan|membebankan|menunjuk|mengizinkan|talak|satu|raj'i|ba'in|shughra|kubra|hak|asuh|hadhanah|pemeliharaan|pengasuhan|berada|dalam|di|bawah|pada)\s+)+/i;
const POLA_SEBUTAN_BELAKANG =
  /(?:\s+(?:dalam|di|kepada|terhadap|yang|dan|untuk|sebagai|dengan|atas|pada|selaku|adalah|telah|tersebut|sejumlah|berupa|beralamat|bertempat|umur|lahir|agama|pekerjaan|pendidikan|secara|sebesar))+$/i;

/**
 * Nama orang di dalam teks, dikenali dari kata "bin"/"binti".
 *
 * Diukur: 1.361 dari 1.643 amar putusan memuat "bin"/"binti". Nama tanpa
 * kata itu tidak dikenali - dan itu dikatakan apa adanya lewat catatan,
 * bukan disamarkan menjadi "tidak ada nama".
 *
 * Kiri dan kanan kata "bin" hanya menerima kata BERHURUF BESAR di depan
 * (nama, atau seluruhnya kapital) - paling banyak tiga kata di kiri dan dua
 * di kanan - sehingga kalimat sebelum nama tidak ikut tersapu; sebutan yang
 * lolos - "Tergugat Dandi" - dibuang sesudahnya.
 */
export function namaOrangDalam(teks: string): string[] {
  const hasil = new Set<string>();
  const pola =
    /([A-Z][A-Za-z'`’.\-]*(?:\s+[A-Z][A-Za-z'`’.\-]*){0,2})\s+(bin|binti|Bin|Binti|BIN|BINTI)\s+([A-Z][A-Za-z'`’.\-]*(?:\s+[A-Z][A-Za-z'`’.\-]*){0,1})/g;
  for (const m of String(teks ?? "").matchAll(pola)) {
    const depan = bersih(m[1]).replace(POLA_SEBUTAN_DEPAN, "");
    if (!depan) continue;
    const belakang = bersih(m[3]).replace(POLA_SEBUTAN_BELAKANG, "");
    const nama = bersih(`${depan} ${m[2]} ${belakang}`);
    if (nama) hasil.add(nama);
  }
  return [...hasil];
}

/** Nomor perkara yang disebut teks, dibakukan huruf kecil tanpa spasi. */
export function nomorPerkaraDalam(teks: string): string[] {
  const hasil = new Set<string>();
  for (const m of String(teks ?? "").matchAll(/\d{1,5}\s*\/\s*Pdt\.\s*(?:G|P)\s*\/\s*\d{4}\s*\/\s*PA\.\s*[A-Za-z]{2,6}/gi)) {
    hasil.add(bakukanNomor(m[0]));
  }
  return [...hasil];
}

export function bakukanNomor(nomor: unknown): string {
  return String(nomor ?? "").toLowerCase().replace(/\s+/g, "");
}

/**
 * Status Putusan -> kata kerja yang HARUS ada di amar.
 *
 * Diukur atas 1.643 putusan 2025-2026: 1.642 berpadanan. Yang satu - status
 * "Gugur" dengan amar pencabutan - memang keliru, dan itulah yang seharusnya
 * ditahan. Daftar ini dibaca berurutan; yang pertama cocok yang dipakai.
 */
const HARAPAN_STATUS: Array<{ pola: RegExp; kata: RegExp; sebutan: string }> = [
  { pola: /tidak\s+dapat\s+diterima|n\.?o\.?\b|niet/, kata: /tidak\s+dapat\s+diterima|niet\s*ontvankelijk/, sebutan: "Tidak Dapat Diterima" },
  { pola: /dicabut|cabut/, kata: /cabut/, sebutan: "Dicabut" },
  { pola: /gugur/, kata: /gugur/, sebutan: "Gugur/Digugurkan" },
  { pola: /damai/, kata: /damai/, sebutan: "Perdamaian" },
  { pola: /ditolak|tolak/, kata: /menolak/, sebutan: "Ditolak" },
  { pola: /dikabulkan|kabul/, kata: /mengabulkan|menetapkan|menyatakan|mengizinkan|memberi\s+izin/, sebutan: "Dikabulkan" },
];

function amarPolos(teks: string): string {
  return teksDariHtml(String(teks ?? "")).replace(/\s+/g, " ").toLowerCase();
}

/**
 * HTML CKEditor menjadi teks yang butirnya terbaca.
 *
 * Diukur: amar yang tersimpan SIPP kebanyakan <ol><li> tanpa angka tertulis;
 * teksDariHtml menjadikan tiap <li> baris baru, tetapi barisnya tidak
 * bernomor dan pecahButirBernomor tidak mengenalinya. Tanda butir disisipkan
 * di sini supaya <li> dan "1." dibaca sama.
 */
export function teksButir(html: string): string {
  return teksDariHtml(String(html ?? "").replace(/<li\b[^>]*>/gi, "<li>• "));
}

function tambah(
  daftar: Temuan[],
  kode: string,
  tingkat: Tingkat,
  judul: string,
  rincian: string,
  sumber: SumberTemuan
) {
  daftar.push({ kode, tingkat, judul, rincian, sumber });
}

/**
 * Rapor untuk keadaan fakta SIPP TIDAK TERBACA sama sekali.
 *
 * Tidak menahan: bot yang mati bukan pertentangan di berkas perkara, dan
 * menahan seluruh penulisan karena bot mati mengubah agen pembaca menjadi
 * saklar. Tetapi tidak juga diam - rapor yang kosong akan dibaca sebagai
 * rapor yang lolos.
 */
export function raporTanpaFakta(alasan: string): RaporPraperiksa {
  const temuan: Temuan[] = [];
  tambah(
    temuan,
    "tidak-diperiksa",
    "perhatian",
    "Praperiksa TIDAK dijalankan",
    `Fakta SIPP tidak terbaca lewat ALETA Bot (${bersih(alasan) || "tanpa sebab"}). Tidak satu pun pemeriksaan berjalan - ini bukan tanda lolos.`,
    "aleta"
  );
  return susunRapor(temuan, [], null);
}

function susunRapor(
  temuan: Temuan[],
  diperiksa: string[],
  aduan: RaporPraperiksa["aduan"]
): RaporPraperiksa {
  const urutan: Record<Tingkat, number> = { hentikan: 0, perhatian: 1, catatan: 2 };
  const terurut = [...temuan].sort((a, b) => urutan[a.tingkat] - urutan[b.tingkat]);
  const jumlah: Record<Tingkat, number> = { hentikan: 0, perhatian: 0, catatan: 0 };
  for (const satu of terurut) jumlah[satu.tingkat] += 1;

  const ringkas = jumlah.hentikan
    ? `${jumlah.hentikan} pertentangan menahan penulisan; ${jumlah.perhatian} perhatian, ${jumlah.catatan} catatan.`
    : `Tidak ada yang menahan. ${jumlah.perhatian} perhatian, ${jumlah.catatan} catatan, ${diperiksa.length} pemeriksaan dijalankan.`;

  return { temuan: terurut, hentikan: jumlah.hentikan > 0, jumlah, ringkas, diperiksa, aduan };
}

/**
 * Menimbang draf dan isian borang terhadap fakta SIPP.
 *
 * Murni: tidak ada panggilan, tidak ada jam selain fakta.hariIni.
 */
export function nilaiPraperiksa(
  fakta: FaktaPraperiksa,
  usulan: UsulanPutusan,
  opsi: { pendapat?: PendapatAi | null } = {}
): RaporPraperiksa {
  const temuan: Temuan[] = [];
  const diperiksa: string[] = [];

  const amarTeks = String(usulan.amar ?? "");
  const amarKecil = amarPolos(amarTeks);
  const naskah = String(usulan.naskah ?? "");
  const naskahKecil = amarPolos(naskah);

  // ── 1. Sudah putus ───────────────────────────────────────────────────────
  diperiksa.push("sudah-putus");
  if (fakta.putusan?.ada && fakta.putusan.tanggalPutusan) {
    tambah(
      temuan,
      "sudah-putus",
      "hentikan",
      "Perkara ini SUDAH putus di SIPP",
      `Tercatat putusan ${tanggalRingkas(fakta.putusan.tanggalPutusan)}${fakta.putusan.statusPutusan ? ` (${fakta.putusan.statusPutusan})` : ""}. Mengisi ulang akan menimpa putusan yang sudah ada.`,
      "sipp"
    );
  }

  // ── 2. Tanggal putusan ───────────────────────────────────────────────────
  const tanggal = tanggalIso(usulan.tanggalPutusan);
  if (!tanggal) {
    tambah(
      temuan,
      "tanggal-tidak-terbaca",
      "catatan",
      "Tanggal putusan belum terbaca dari borang",
      `Isian #tgl_putusan kosong atau bentuknya tidak dikenali ("${bersih(usulan.tanggalPutusan)}"). Kecocokan tanggal dengan jadwal sidang TIDAK diperiksa.`,
      "borang"
    );
  } else {
    diperiksa.push("tanggal-putusan");
    const jadwal = Array.isArray(fakta.jadwal) ? fakta.jadwal : [];
    const padaHariItu = jadwal.filter((sidang) => sidang.tanggalSidang === tanggal);
    const tanggalTerakhir = jadwal.reduce((akhir, sidang) => (sidang.tanggalSidang > akhir ? sidang.tanggalSidang : akhir), "");

    if (fakta.hariIni && tanggal > fakta.hariIni) {
      tambah(
        temuan,
        "tanggal-masa-depan",
        "hentikan",
        "Tanggal putusan di masa depan",
        `Borang menulis ${tanggalRingkas(tanggal)}, sedangkan hari ini ${tanggalRingkas(fakta.hariIni)}. Putusan tidak dapat dijatuhkan pada hari yang belum tiba.`,
        "borang"
      );
    }

    if (jadwal.length === 0) {
      tambah(
        temuan,
        "jadwal-kosong",
        "catatan",
        "Perkara ini belum punya satu pun jadwal sidang di SIPP",
        "Kecocokan tanggal putusan dengan hari sidang tidak dapat diperiksa.",
        "sipp"
      );
    } else if (padaHariItu.length === 0) {
      tambah(
        temuan,
        "tanggal-tanpa-sidang",
        "hentikan",
        "Tanggal putusan bukan hari sidang perkara ini",
        `Borang menulis ${tanggalRingkas(tanggal)} (${namaHari(tanggal)}), tetapi tidak ada sidang perkara ini pada hari itu. Sidang terakhir tercatat ${tanggalRingkas(tanggalTerakhir)}. Seluruh 1.643 putusan 2025-2026 di SIPP ini bertanggal hari sidang - yang ini menyimpang.`,
        "sipp"
      );
    } else {
      if (padaHariItu.every((sidang) => sidang.ditunda)) {
        tambah(
          temuan,
          "sidang-ditunda",
          "perhatian",
          "Sidang pada tanggal itu tercatat DITUNDA",
          `Sidang ${tanggalRingkas(tanggal)} berstatus ditunda${padaHariItu[0]?.agenda ? ` (agenda: ${padaHariItu[0].agenda})` : ""}. Putusan pada sidang yang ditunda patut diperiksa.`,
          "sipp"
        );
      }
      if (tanggalTerakhir && tanggal < tanggalTerakhir) {
        tambah(
          temuan,
          "tanggal-bukan-sidang-terakhir",
          "perhatian",
          "Ada sidang yang lebih baru daripada tanggal putusan",
          `Borang menulis ${tanggalRingkas(tanggal)}, sedangkan sidang terakhir perkara ini ${tanggalRingkas(tanggalTerakhir)}. Pastikan tanggalnya bukan salah pilih.`,
          "sipp"
        );
      }
    }

    const hari = namaHari(tanggal);
    if (hari === "Sabtu" || hari === "Minggu") {
      tambah(temuan, "tanggal-akhir-pekan", "perhatian", `Tanggal putusan jatuh pada hari ${hari}`, `${tanggalRingkas(tanggal)} adalah akhir pekan.`, "borang");
    }
    if (fakta.libur && fakta.libur.tanggal === tanggal) {
      tambah(temuan, "tanggal-libur", "perhatian", "Tanggal putusan jatuh pada hari libur", `${tanggalRingkas(tanggal)}: ${fakta.libur.nama}.`, "aleta");
    }
  }

  // ── 3. Status Putusan vs kata kerja amar ─────────────────────────────────
  const statusKecil = bersih(usulan.statusPutusan).toLowerCase();
  if (!amarKecil) {
    tambah(temuan, "amar-kosong", "catatan", "Draf tidak memuat amar", "Pemeriksaan amar - status, petitum, nama pihak - dilewati.", "draf");
  } else if (!statusKecil) {
    tambah(temuan, "status-belum-dipilih", "catatan", "Status Putusan belum dipilih di borang", "Kecocokan kata kerja amar dengan status tidak diperiksa.", "borang");
  } else {
    diperiksa.push("status-vs-amar");
    const harapan = HARAPAN_STATUS.find((satu) => satu.pola.test(statusKecil));
    if (!harapan) {
      tambah(temuan, "status-tidak-dikenali", "catatan", `Status "${bersih(usulan.statusPutusan)}" tidak dikenali agen`, "Kecocokan kata kerja amar dengan status tidak diperiksa.", "borang");
    } else if (!harapan.kata.test(amarKecil)) {
      tambah(
        temuan,
        "status-vs-amar",
        "hentikan",
        `Status "${bersih(usulan.statusPutusan)}" tidak berpadanan dengan amar`,
        `Amar tidak memuat kata kerja yang menandai ${harapan.sebutan}. Pada 1.642 dari 1.643 putusan 2025-2026 keduanya berpadanan; yang satu tidak memang keliru.`,
        "borang"
      );
    } else if (harapan.sebutan === "Dikabulkan" && /tidak\s+dapat\s+diterima|niet\s*ontvankelijk/.test(amarKecil) && !/mengabulkan/.test(amarKecil)) {
      tambah(
        temuan,
        "status-vs-amar",
        "hentikan",
        'Status "Dikabulkan" tetapi amar menyatakan tidak dapat diterima',
        "Amar memuat \"tidak dapat diterima\" tanpa satu pun \"mengabulkan\". Salah satunya keliru.",
        "borang"
      );
    }
  }

  // ── 4. Verstek ───────────────────────────────────────────────────────────
  const verstek = bersih(usulan.verstek).toUpperCase();
  if (amarKecil && (verstek === "Y" || verstek === "T")) {
    diperiksa.push("verstek");
    const amarVerstek = /verstek|tidak\s+hadir/.test(amarKecil);
    if (verstek === "Y" && !amarVerstek) {
      tambah(temuan, "verstek-vs-amar", "perhatian", "Verstek dipilih, tetapi amar tidak menyebutnya", "Amar tidak memuat \"verstek\" maupun \"tidak hadir\". 871 dari 936 amar verstek menyebut salah satunya.", "borang");
    } else if (verstek === "T" && /verstek/.test(amarKecil)) {
      tambah(temuan, "verstek-vs-amar", "perhatian", "Amar menyebut verstek, tetapi borang memilih bukan verstek", "Periksa pilihan Putusan Verstek.", "borang");
    }
  }

  // ── 5. Amar vs petitum ───────────────────────────────────────────────────
  let aduanRingkas: RaporPraperiksa["aduan"] = null;
  if (amarKecil && statusKecil && POLA_STATUS_TANPA_ADUAN.test(statusKecil)) {
    tambah(
      temuan,
      "aduan-tidak-berlaku",
      "catatan",
      `Aduan amar-petitum tidak berlaku untuk status "${bersih(usulan.statusPutusan)}"`,
      "Amar pencabutan, gugur, tidak dapat diterima, ditolak, atau perdamaian memang tidak menjawab petitum butir demi butir.",
      "draf"
    );
  } else if (amarKecil) {
    const petitum: Petitum[] = pecahButirBernomor(teksButir(String(fakta.petitum ?? "")));
    const amar: ButirAmar[] = pecahButirBernomor(teksButir(amarTeks));
    if (petitum.length === 0) {
      tambah(temuan, "petitum-kosong", "catatan", "Petitum di SIPP kosong atau tidak bernomor", "Amar tidak dapat diadu dengan petitum.", "sipp");
    } else if (amar.length === 0) {
      tambah(temuan, "amar-tidak-bernomor", "catatan", "Amar draf tidak bernomor", "Amar tidak dapat diadu butir demi butir dengan petitum.", "draf");
    } else {
      diperiksa.push("amar-vs-petitum");
      const aduan = padankanAmarPetitum(petitum, amar);
      aduanRingkas = {
        jumlahPetitum: petitum.length,
        jumlahAmar: amar.length,
        belumTerjawab: aduan.belumTerjawab.length,
        amarTanpaPetitum: aduan.amarTanpaPetitum.length,
      };
      for (const butir of aduan.belumTerjawab.slice(0, 6)) {
        tambah(temuan, "petitum-belum-terjawab", "perhatian", `Petitum ${butir.nomor} belum tampak terjawab amar`, `"${ringkas(butir.teks)}" - padanannya tidak ditemukan dari kata-katanya. Baca amarnya; bila memang terjawab, lewati.`, "draf");
      }
      for (const butir of aduan.amarTanpaPetitum.slice(0, 6)) {
        tambah(temuan, "amar-tanpa-petitum", "perhatian", `Amar ${butir.nomor} tidak menjawab satu pun petitum`, `"${ringkas(butir.teks)}" - bila bukan amar baku, ini melampaui yang dituntut (ultra petita).`, "draf");
      }
      if (aduan.belumTerjawab.length === 0 && aduan.amarTanpaPetitum.length === 0) {
        tambah(temuan, "amar-petitum-cocok", "catatan", `Amar menjawab seluruh ${petitum.length} petitum`, `${amar.length} butir amar, ${aduan.subsidair.length} petitum subsidair.`, "draf");
      }
    }
  }

  // ── 6. Nama orang di amar vs pihak perkara ini ───────────────────────────
  const pihak = Array.isArray(fakta.pihak) ? fakta.pihak.filter((x) => bersih(x.nama)) : [];
  const anak = Array.isArray(fakta.anak) ? fakta.anak.filter(Boolean) : [];
  if (amarTeks) {
    const namaAmar = namaOrangDalam(teksDariHtml(amarTeks));
    if (pihak.length === 0 && anak.length === 0) {
      tambah(temuan, "pihak-tidak-terbaca", "catatan", "Pihak perkara tidak terbaca dari SIPP", "Nama di amar tidak dapat dibandingkan dengan pihak perkara ini.", "sipp");
    } else if (namaAmar.length === 0) {
      tambah(temuan, "amar-tanpa-nama", "catatan", "Amar tidak menyebut nama dengan bin/binti", "Kecocokan nama dengan pihak perkara ini tidak diperiksa dari amar.", "draf");
    } else {
      diperiksa.push("nama-vs-pihak");
      const dikenal = [...pihak.map((x) => samakanNama(x.nama)), ...anak.map((x) => samakanNama(x))].filter(Boolean);
      const cocok: string[] = [];
      const asing: string[] = [];
      for (const nama of namaAmar) {
        const n = samakanNama(nama);
        const ketemu = dikenal.some((d) => n.includes(d) || d.includes(n));
        // KERABAT: "Elsa Amelia binti Selamet" pada perkara yang pemohonnya
        // "Selamet bin Toimin". Anak yang dimintakan dispensasi, calon
        // pasangannya, anak yang diasuh - disebut amar, bukan pihak, dan tidak
        // selalu tercatat di perkara_anak_pihak. Nama ayahnya yang menautkan.
        // Diukur: tiga dari empat salah tangkap pada 200 putusan sungguhan
        // adalah keadaan ini, seluruhnya Pdt.P.
        const ayah = samakanNama(n.replace(/^.*\b(?:bin|binti)\s+/, ""));
        const kerabat = ayah.length >= 3 && dikenal.some((d) => d.split(" ")[0] === ayah.split(" ")[0] || d.includes(ayah));
        (ketemu || kerabat ? cocok : asing).push(nama);
      }
      if (cocok.length === 0) {
        // Pada PERMOHONAN (Pdt.P) yang disebut amar kerap bukan pihak sama
        // sekali - anak, wali, orang yang dinyatakan hilang - sehingga ketiadaan
        // padanan belum membuktikan drafnya milik perkara lain. Pada gugatan
        // (Pdt.G) pihaknyalah pokok amar, dan ketiadaan padanan menahan.
        const permohonan = /\/pdt\.p\//i.test(String(usulan.nomorPerkara || fakta.nomorPerkara));
        tambah(
          temuan,
          "amar-bukan-perkara-ini",
          permohonan ? "perhatian" : "hentikan",
          "Tidak satu pun nama di amar adalah pihak perkara ini",
          `Amar menyebut ${asing.join("; ")}. Pihak perkara ${fakta.nomorPerkara}: ${pihak.map((x) => x.nama).join("; ")}. ${permohonan ? "Pada permohonan ini lazim (anak, wali) - tetapi periksa." : "Kemungkinan drafnya milik perkara lain."}`,
          "draf"
        );
      } else if (asing.length > 0) {
        tambah(
          temuan,
          "nama-bukan-pihak",
          "perhatian",
          `${asing.length} nama di amar bukan pihak atau anak yang tercatat`,
          `${asing.join("; ")}. Dapat berupa saksi atau anak yang belum dicatat di SIPP - atau nama yang keliru.`,
          "draf"
        );
      }
    }
  }

  // ── 7. Nomor perkara yang disebut naskah ─────────────────────────────────
  const nomorIni = bakukanNomor(usulan.nomorPerkara || fakta.nomorPerkara);
  const nomorDisebut = nomorPerkaraDalam(`${amarTeks}\n${naskah}`);
  if (nomorIni && nomorDisebut.length > 0) {
    diperiksa.push("nomor-perkara");
    const lain = nomorDisebut.filter((n) => n !== nomorIni);
    if (!nomorDisebut.includes(nomorIni)) {
      tambah(
        temuan,
        "nomor-berbeda",
        "hentikan",
        "Naskah menyebut nomor perkara LAIN, dan tidak menyebut nomornya sendiri",
        `Disebut: ${lain.join(", ")}. Perkara yang sedang dibuka: ${bersih(usulan.nomorPerkara || fakta.nomorPerkara)}. Kemungkinan drafnya milik perkara lain.`,
        "draf"
      );
    } else if (lain.length > 0) {
      tambah(temuan, "nomor-lain-disebut", "catatan", "Naskah menyebut nomor perkara lain di samping nomornya sendiri", `${lain.join(", ")} - lazim pada rujukan ke perkara terkait; periksa bila tidak dimaksudkan.`, "draf");
    }
  }

  // ── 8. Majelis yang disebut naskah vs yang ditetapkan ────────────────────
  const majelis = Array.isArray(fakta.majelis) ? fakta.majelis.filter((x) => bersih(x.nama)) : [];
  const naskahMenyebutMajelis = /ketua\s+majelis|hakim\s+ketua|hakim\s+anggota|hakim\s+tunggal|majelis\s+hakim/.test(naskahKecil);
  if (majelis.length === 0) {
    tambah(temuan, "majelis-belum-ditetapkan", "catatan", "Majelis belum tercatat di SIPP", "Nama hakim di naskah tidak dapat dibandingkan.", "sipp");
  } else if (!naskah || !naskahMenyebutMajelis) {
    tambah(temuan, "naskah-tanpa-majelis", "catatan", "Naskah draf tidak menyebut majelis", `Majelis tercatat: ${majelis.map((x) => x.nama).join("; ")}. Kecocokan tidak diperiksa.`, "draf");
  } else {
    diperiksa.push("majelis");
    const naskahNama = samakanNama(naskahKecil);
    const hilang = majelis.filter((hakim) => {
      const n = samakanNama(hakim.nama);
      return n && !naskahNama.includes(n);
    });
    if (hilang.length > 0) {
      tambah(
        temuan,
        "majelis-berbeda",
        "hentikan",
        `${hilang.length} dari ${majelis.length} hakim yang ditetapkan tidak disebut naskah`,
        `Tidak ditemukan: ${hilang.map((x) => `${x.nama}${x.jabatan ? ` (${x.jabatan})` : ""}`).join("; ")}. Naskah menyebut majelis, tetapi bukan majelis yang tercatat di perkara_hakim_pn.`,
        "draf"
      );
    } else {
      tambah(temuan, "majelis-cocok", "catatan", `Seluruh ${majelis.length} hakim yang ditetapkan disebut naskah`, majelis.map((x) => x.nama).join("; "), "draf");
    }
  }

  // ── 9. Pihak SIPP vs pihak e-Court ───────────────────────────────────────
  const ecourt = fakta.ecourt ?? { terdaftar: null, pihak: [] };
  const pihakEcourt = Array.isArray(ecourt.pihak) ? ecourt.pihak.filter((x) => bersih(x.nama)) : [];
  if (pihakEcourt.length > 0 && pihak.length > 0) {
    diperiksa.push("pihak-vs-ecourt");
    const dikenal = pihak.map((x) => samakanNama(x.nama)).filter(Boolean);
    const berbeda = pihakEcourt.filter((x) => {
      const n = samakanNama(x.nama);
      return n && !dikenal.some((d) => n.includes(d) || d.includes(n));
    });
    if (berbeda.length > 0) {
      tambah(temuan, "pihak-ecourt-berbeda", "perhatian", `${berbeda.length} pihak e-Court tidak ditemukan di pihak SIPP`, `${berbeda.map((x) => x.nama).join("; ")}. Ejaan berbeda lazim; nama yang sama sekali lain tidak.`, "ecourt");
    } else {
      tambah(temuan, "pihak-ecourt-cocok", "catatan", `${pihakEcourt.length} pihak e-Court cocok dengan pihak SIPP`, "", "ecourt");
    }
  } else if (ecourt.terdaftar === null) {
    tambah(temuan, "ecourt-tidak-terbaca", "catatan", "Keikutsertaan e-Court tidak terbaca", "", "sipp");
  } else if (ecourt.terdaftar) {
    tambah(temuan, "ecourt-belum-ditarik", "catatan", "Perkara e-Court, tetapi pihaknya belum ada di arsip ALETA", "Penarikan e-Court belum pernah menyentuh perkara ini; pihak tidak dibandingkan.", "ecourt");
  } else {
    tambah(temuan, "bukan-ecourt", "catatan", "Bukan perkara e-Court", "Perbandingan pihak dengan e-Court tidak berlaku.", "ecourt");
  }

  // ── 10. Pendapat AI - hanya perhatian, tidak pernah menahan ──────────────
  const pendapat = opsi.pendapat ?? null;
  if (pendapat) {
    if (!pendapat.ok) {
      tambah(temuan, "ai-dilewati", "catatan", "Pendapat AI dilewati", bersih(pendapat.alasan) || "tanpa sebab", "ai");
    } else {
      diperiksa.push("pendapat-ai");
      const daftar = Array.isArray(pendapat.temuan) ? pendapat.temuan : [];
      for (const satu of daftar.slice(0, 8)) {
        tambah(temuan, "ai-bertentangan", "perhatian", `AI: ${bersih(satu.judul) || "pertentangan"}`, bersih(satu.rincian), "ai");
      }
      if (daftar.length === 0) {
        tambah(
          temuan,
          "ai-tidak-menemukan",
          "catatan",
          "AI tidak menemukan pertentangan amar-petitum",
          `${[pendapat.provider, pendapat.model].filter(Boolean).join(" / ") || "model"} - nama sudah disamarkan sebelum dikirim.`,
          "ai"
        );
      }
      for (const satu of (pendapat.catatan ?? []).slice(0, 3)) {
        tambah(temuan, "ai-catatan", "catatan", "Catatan AI", bersih(satu), "ai");
      }
    }
  }

  // ── 11. Yang tidak terbaca di sisi bot ───────────────────────────────────
  const tidakTerbaca = Array.isArray(fakta.tidakTerbaca) ? fakta.tidakTerbaca.filter(Boolean) : [];
  if (tidakTerbaca.length > 0) {
    tambah(temuan, "fakta-tidak-terbaca", "catatan", `${tidakTerbaca.length} fakta SIPP tidak terbaca`, tidakTerbaca.join("; "), "sipp");
  }

  return susunRapor(temuan, diperiksa, aduanRingkas);
}

function ringkas(teks: string): string {
  const isi = bersih(teks);
  return isi.length > 110 ? `${isi.slice(0, 107)}...` : isi;
}
