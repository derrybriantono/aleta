/**
 * ============================================================================
 * KUASA HUKUM DARI SURAT GUGATAN / PERMOHONAN e-COURT (9 Okt 2026)
 * ============================================================================
 *
 * Diminta pengguna (butir 1-4 KUASA HUKUM):
 *   1. #0156# "Kantor Kuasa Penggugat" = NAMA KANTOR di surat kuasa/gugatan
 *      (contoh "Derry & Partners") - bukan alamat. Sampai 1.188.0 ALETA
 *      mengusulkan perkara_pengacara.alamat (alamat advokat) ke variabel ini.
 *   2. #0132# "Tgl. Kuasa Penggugat" = tanggal REGISTER kuasa khusus di
 *      Kepaniteraan PA, bukan tanggal surat kuasanya.
 *   3. tanggal surat kuasa dideteksi otomatis dari surat gugatannya.
 *
 * SIPP tidak menyimpan nama kantor maupun tanggal surat kuasa (diukur 9 Okt
 * 2026 di satker: perkara_pengacara hanya punya nama, alamat, nomor_kuasa,
 * tanggal_kuasa; pihak_pengacara.alamat_kantor kadang memuat nama kantor,
 * kadang hanya alamat). Yang menyimpannya surat gugatan yang diunggah kuasa ke
 * e-Court, dan berkasnya sudah diarsipkan ALETA Bot.
 *
 * ============================================================================
 * BENTUK YANG DIKENALI (diukur atas gugatan ber-kuasa sungguhan, arsip satker)
 * ============================================================================
 *
 *   tanggal   "Surat Kuasa Khusus tanggal 11 April 2026", "... tertanggal
 *             27 Mei 2026", "Surat Kuasa tanggal 18 Mei 2026", "surat kuasa
 *             khusus Tanggal 06 Juni 2026", baris yang terputus di tengahnya.
 *   kantor    "Kantor Hukum “AYATULLAH AND PARTNER’S”", "pada Kantor Advokat/
 *             Pengacara & Konsultan Hukum, NURHIDAYAT & REKAN", "pada PASIGALA
 *             FOR JUSTICE LAW OFFICE", "kantor “LEMBAGA BANTUAN HUKUM SULAWESI
 *             TENGAH”", "kantor hukum POSBAKUMADIN SULTENG", "Kantor Guma Law
 *             Firm", "pada ADV. AMIT SUAIB, S.H. & REKAN".
 *   alamat    sesudah nama kantor: "yang beralamat (kantor) di", "berkedudukan
 *             (hukum) di", "berkantor di", atau langsung "jalan ...".
 *   advokat   nama bergelar (S.H., M.H., S.Sy., ...) di bagian kepala surat.
 *
 * Yang dibaca hanya KEPALA surat - dari awal sampai "MELAWAN"/"dengan ini
 * mengajukan" - supaya "Kantor Urusan Agama" di posita dan alamat kantor
 * Tergugat tidak terbaca sebagai kantor kuasa.
 *
 * Hasilnya USULAN: panel ABT menggambarnya dengan tanda sumber "gugatan
 * e-Court" dan kalimat asalnya; yang tidak terdeteksi tetap kosong dan dapat
 * disunting. Tidak ada yang ditulis ke ABT tanpa petugas.
 */

/** Naikkan bila aturan berubah. */
export const VERSI_KUASA_GUGATAN = 1;

export type Petikan<T> = { nilai: T; kalimat: string };

export type KuasaGugatan = {
  /** Kepala surat menyebut kuasa/advokat. */
  ada: boolean;
  /** Tanggal surat kuasa: nilai "dd/mm/yyyy" (bentuk isian tanggal ABT). */
  tanggalSuratKuasa: (Petikan<string> & { iso: string }) | null;
  /** Nama kantor tanpa kata "Kantor Hukum" di depannya (kecuali bagian dari nama: LBH, POSBAKUM, ...). */
  kantor: Petikan<string> | null;
  alamatKantor: Petikan<string> | null;
  advokat: Petikan<string[]> | null;
};

const BULAN: Record<string, number> = {
  januari: 1, jan: 1, februari: 2, pebruari: 2, feb: 2, peb: 2, maret: 3, mar: 3, april: 4, apr: 4, mei: 5,
  juni: 6, jun: 6, juli: 7, jul: 7, agustus: 8, agust: 8, agt: 8, agu: 8, ags: 8, aug: 8, september: 9, sept: 9, sep: 9,
  oktober: 10, okt: 10, oct: 10, november: 11, nopember: 11, nov: 11, nop: 11, desember: 12, des: 12, dec: 12,
};

/** Spasi apa pun (baris baru, tab, nbsp) menjadi satu spasi; kutip lengkung tetap (dibersihkan per nilai). */
export function rapatkan(teks: string): string {
  return String(teks ?? "")
    .replace(/[   ]/g, " ")
    .replace(/[ \t\r\n\f\v]+/g, " ")
    .trim();
}

/**
 * Isian yang aman ditempel ABT ke dalam literal SQL.
 *
 * ABT mengganti #var# MENTAH ke dalam teks kueri sebelum kueri dijalankan
 * (Abt_model::variabel_var_data). Kalimat kuasa (#8540#) dan identitas
 * (#7047#) memakai literal berkutip GANDA, jadi kutip ganda dan garis miring
 * terbalik di isian mematahkan kuerinya ("ERROR Variabel"); kueri lama yang
 * berkutip TUNGGAL ('#0156#' di #7080#) dipatahkan kutip tunggal - diukur 9 Okt:
 * isian 0156 perkara 7998, 8760, 9081, 9896 berbunyi "...Partner's". Maka kutip
 * tunggal ditulis sebagai U+2019 (bita 0x92 cp1252): bukan pembatas literal
 * SQL, dan cleanHtmlTagSpecial ABT mengubahnya kembali menjadi ' saat dicetak.
 * Kutip ganda (lurus maupun lengkung) dibuang; tanda pisah panjang menjadi "-".
 */
export function isianAmanAbt(nilai: string): string {
  return rapatkan(
    String(nilai ?? "")
      .replace(/[“”„‟″"]/g, "")
      .replace(/[\u2018\u2019\u201a\u201b\u2032`']/g, "\u2019")
      .replace(/[–—−]/g, "-")
      .replace(/…/g, "...")
      .replace(/\\/g, "/")
  );
}

/** "A", "A dan B", "A, B dan C". */
export function gabungNama(nama: string[]): string {
  const d = nama.map((x) => rapatkan(x)).filter(Boolean);
  if (d.length <= 1) return d[0] || "";
  return `${d.slice(0, -1).join(", ")} dan ${d[d.length - 1]}`;
}

function duaAngka(n: number) {
  return String(n).padStart(2, "0");
}

/** "11 April 2026" / "06-07-2026" -> {iso, tampil dd/mm/yyyy}; null bila bukan tanggal yang masuk akal. */
export function uraiTanggal(hari: string, bulan: string, tahun: string): { iso: string; nilai: string } | null {
  const h = Number(hari);
  const t = Number(tahun);
  const b = /^\d+$/.test(bulan) ? Number(bulan) : BULAN[bulan.toLowerCase().replace(/\.$/, "")] || 0;
  if (!h || !b || !t || h > 31 || b > 12 || t < 2000 || t > 2100) return null;
  const d = new Date(Date.UTC(t, b - 1, h));
  if (d.getUTCMonth() !== b - 1) return null;
  return { iso: `${t}-${duaAngka(b)}-${duaAngka(h)}`, nilai: `${duaAngka(h)}/${duaAngka(b)}/${t}` };
}

/** Kepala surat: awal teks sampai pihak lawan disebut. */
export function kepalaSurat(teks: string): string {
  const t = rapatkan(teks).slice(0, 12000);
  const akhir = /\bM\s?E\s?L\s?A\s?W\s?A\s?N\b|\bdengan\s+ini\s+(?:\S+\s+){0,3}?(?:mengajukan|hendak\s+mengajukan|memohon)\b/i.exec(t);
  // Kuasa kadang ditulis SESUDAH identitas pemberi kuasa (273, 388): batas
  // "melawan" yang terlalu dini tidak mungkin, karena identitas pihak pertama
  // selalu mendahuluinya.
  return akhir && akhir.index > 200 ? t.slice(0, akhir.index) : t.slice(0, 6000);
}

const POLA_ADA_KUASA =
  /surat\s+kuasa|kuasa\s*(?:hukum)?\s*nya|kuasa\s+hukum|memberi(?:kan)?\s+kuasa|pemberi\s+kuasa|selaku\s+kuasa|\badvo[ck]at\b|penasi?hat\s+hukum|\bpengacara\b/i;

const POLA_TANGGAL_SK =
  /surat\s+kuasa(?:\s+(?:khusus|insidentil|isidentil|insidentiil))?(?:\s+(?:nomor|no\.?)\s*:?\s*[^,;]{1,60}?)?\s*,?\s*(?:yang\s+)?(?:ter)?(?:tanggal|tgl\.?)\s*:?\s*(\d{1,2})\s*(?:-|\/|\.|\s)\s*([A-Za-z]{3,9}\.?|\d{1,2})\s*(?:-|\/|\.|\s)\s*(\d{4})/gi;

function potongKalimat(t: string, i: number, j: number, lebar = 90): string {
  const a = Math.max(0, i - lebar);
  const b = Math.min(t.length, j + lebar);
  return `${a > 0 ? "…" : ""}${t.slice(a, b).trim()}${b < t.length ? "…" : ""}`;
}

/** Tanggal surat kuasa dari teks (kepala surat lebih dulu, lalu seluruh teks). */
export function tanggalSuratKuasa(teks: string): KuasaGugatan["tanggalSuratKuasa"] {
  for (const t of [kepalaSurat(teks), rapatkan(teks).slice(0, 30000)]) {
    POLA_TANGGAL_SK.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = POLA_TANGGAL_SK.exec(t))) {
      const d = uraiTanggal(m[1], m[2], m[3]);
      if (d) return { nilai: d.nilai, iso: d.iso, kalimat: potongKalimat(t, m.index, m.index + m[0].length, 60) };
    }
  }
  return null;
}

// ─── Nama kantor ──────────────────────────────────────────────────────────────

/** Sesudah nama kantor: kata yang memulai alamat atau keterangan lain. */
const POLA_UJUNG_NAMA =
  /(?:^|\s*[,;.]\s*|\s+)(?:yang\b|beralamat|berkedudukan|berkantor|berdomisili|bertempat|alamat\b|di\s+(?:jalan|jl|jln)\b|jalan\b|jl\.|jl\b|jln\.?|dengan\s+(?:alamat|domisili)|domisili|dalam\s+hal|bertindak|berdasarkan|sebagaimana|selaku|untuk\s+dan|e-?mail|telp|tlp|hp\b|no\.?\s*hp|kantor\s+perwakilan|unit\s+kerja|badan\s+hukum|masing|baik\s+sendiri|advokat\s*(?:\/|dan|&)|pengacara\s*(?:\/|dan|&)|keduanya|ketiganya|kesemuanya|atau\s+yang\s+disebut|kepada\s+yth|perihal|palu,|donggala,)|[;:]|\s-{2,}|_{2,}|$/i;

/** Kata sesudah "kantor" yang menandakan kantor lain (KUA, dinas, desa, ...). */
const POLA_BUKAN_KANTOR_KUASA =
  /^(?:urusan\s+agama|kua\b|dinas|desa|kelurahan|lurah|camat|kecamatan|kepala|pln|polisi|polsek|polres|bupati|gubernur|walikota|pengadilan|pajak|pos\b(?!\s*bantuan)|cabang|pusat\s+(?!bantuan)|perwakilan|bpn|pertanahan|sekolah|bank|koperasi)/i;

/** Penanda nama kantor advokat. */
const POLA_PENANDA_KANTOR =
  /\b(?:law\s*(?:office|firm)|lawyers?|partners?|parter'?s?|rekan|associates?|asscociates?|assciates|advocates?|bantuan\s+hukum|lbh|posbakum\w*|konsultan\s+(?:hukum|syariah))\b|&/i;

/** Anchor nama kantor: kelompok 1 = awalan yang TIDAK ikut nama. */
const ANCHOR_KANTOR: Array<{ pola: RegExp; ikutAwalan: boolean; perluPenanda: boolean; bobot: number }> = [
  // "Kantor Hukum X", "Kantor Advokat/Pengacara & Konsultan Hukum, X", "kantor Pengacara di X"
  {
    pola: /\bkantor\s+(?:hukum|advokat|pengacara|konsultan\s+hukum|penasi?hat\s+hukum)(?:\s*(?:\/|dan|&|,)\s*(?:pengacara|konsultan\s+hukum|advokat|penasi?hat\s+hukum))*\s*[,:]?\s*(?:di\s+)?/gi,
    ikutAwalan: false,
    perluPenanda: false,
    bobot: 3,
  },
  // LBH / POSBAKUM / organisasi bantuan hukum - awalan bagian dari nama
  {
    pola: /\b(?:yayasan\s+)?(?:lembaga\s+bantuan\s+hukum|lbh\b|pos\s+bantuan\s+hukum|posbakum\w*|organisasi\s+bantuan\s+hukum|perkumpulan\s+(?:\S+\s+){0,4}?bantuan\s+hukum|biro\s+(?:bantuan\s+)?hukum|rumah\s+hukum)/gi,
    ikutAwalan: true,
    perluPenanda: false,
    bobot: 2,
  },
  // "pada X LAW OFFICE", "pada X & REKAN", "Kantor X Law Firm"
  { pola: /\b(?:pada|di)\s+(?:kantor\s+)?/gi, ikutAwalan: false, perluPenanda: true, bobot: 1 },
  { pola: /\bkantor\s+/gi, ikutAwalan: false, perluPenanda: true, bobot: 1 },
];

/** Bersihkan calon nama kantor. */
function rapikanNama(n: string): string {
  let s = isianAmanAbt(n);
  s = s.replace(/^(?:di|pada)\s+/i, "");
  s = s.replace(/[\s,.;:\-–]+$/g, "").replace(/^[\s,.;:\-–]+/g, "");
  // "... , atau" sisa "atau yang disebut"
  s = s.replace(/[\s,]+atau$/i, "");
  return s.trim();
}

function namaLayak(n: string, perluPenanda: boolean): boolean {
  if (n.length < 3 || n.length > 110) return false;
  if (POLA_BUKAN_KANTOR_KUASA.test(n)) return false;
  if (/^(?:jalan|jl\.?|jln\.?|desa|kel\.?|kelurahan|kec\.?|kecamatan|kota|kabupaten|rt\b|btn|perum|komp)/i.test(n)) return false;
  if (/^(?:advokat|pengacara|konsultan\s+hukum|penasi?hat\s+hukum|hukum|alamat)$/i.test(n)) return false;
  if (/^(?:alamat|email|e-mail|telp|hp)\b/i.test(n)) return false;
  if (!/[A-Za-z]{3}/.test(n)) return false;
  if (perluPenanda && !POLA_PENANDA_KANTOR.test(n)) return false;
  return true;
}

type CalonKantor = { nama: string; mulai: number; akhir: number; skor: number };

/** Satu calon dari teks sesudah anchor. */
function ambilNama(t: string, dari: number): { nama: string; akhir: number } | null {
  const sisa = t.slice(dari, dari + 220);
  const kutip = /^\s*[“"‘']/.exec(sisa);
  if (kutip) {
    const isi = sisa.slice(kutip[0].length);
    const tutup = /[”"’'](?![sS]\b)/.exec(isi);
    const ujung = POLA_UJUNG_NAMA.exec(isi);
    const batas = tutup && (!ujung || tutup.index <= ujung.index + 1) ? tutup.index : ujung ? ujung.index : isi.length;
    return { nama: isi.slice(0, batas), akhir: dari + kutip[0].length + batas + (tutup && tutup.index === batas ? 1 : 0) };
  }
  const u = POLA_UJUNG_NAMA.exec(sisa);
  const batas = u ? u.index : sisa.length;
  return { nama: sisa.slice(0, batas), akhir: dari + batas };
}

function calonKantor(kepala: string): CalonKantor[] {
  const t = kepala;
  const hasil: CalonKantor[] = [];
  // Kop surat (nama kantor besar-besar di atas "Kepada Yth") kerap terpotong
  // tata letaknya; kalimat di badan surat ("Advokat pada Kantor Hukum ...")
  // lebih utuh, jadi didahulukan.
  const kop = /kepada\s*yth|dengan\s+hormat|assalamu|perihal\s*:|\bhal\s*:|yang\s+bertanda\s*tangan|kami\s+yang\s+bertanda/i.exec(t);
  const akhirKop = kop ? kop.index : -1;
  for (const a of ANCHOR_KANTOR) {
    a.pola.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = a.pola.exec(t))) {
      const awal = a.ikutAwalan ? m.index : m.index + m[0].length;
      const ambil = ambilNama(t, a.ikutAwalan ? m.index + m[0].length : awal);
      if (!ambil) continue;
      let nama = a.ikutAwalan ? `${m[0]}${ambil.nama}` : ambil.nama;
      nama = rapikanNama(nama);
      // "... Sigi Biromaru, atau yang disebut POSBAKUMADIN SIGI BIROMARU" - sebutan pendeknya.
      const sebut = /^\s*,?\s*atau\s+(?:yang\s+)?disebut\s+(?:sebagai\s+)?([A-Z][A-Z0-9 .&'-]{3,60}?)(?=\s*[,;.]|\s+(?:yang|beralamat|unit)\b)/.exec(t.slice(ambil.akhir, ambil.akhir + 120));
      if (sebut) nama = rapikanNama(sebut[1]);
      if (!namaLayak(nama, a.perluPenanda)) continue;
      let skor = a.bobot;
      if (POLA_PENANDA_KANTOR.test(nama)) skor += 2;
      if (/^\s*[“"‘']/.test(t.slice(a.ikutAwalan ? m.index + m[0].length : awal, awal + 3))) skor += 1;
      if (akhirKop >= 0 && m.index > akhirKop) skor += 2;
      hasil.push({ nama, mulai: m.index, akhir: sebut ? ambil.akhir + sebut.index + sebut[0].length : ambil.akhir, skor });
    }
  }
  return hasil;
}

/**
 * Nama kantor dari sepotong teks bebas (kepala gugatan, atau
 * pihak_pengacara.alamat_kantor SIPP yang kadang berbunyi "Kantor Hukum GUMA
 * Law Firm, Alamat: ..."). Kosong bila tidak ada yang meyakinkan.
 */
export function namaKantor(teks: string): { nama: string; mulai: number; akhir: number } | null {
  const t = rapatkan(teks);
  const calon = calonKantor(t);
  if (!calon.length) return null;
  calon.sort((a, b) => b.skor - a.skor || a.mulai - b.mulai);
  return calon[0];
}

// ─── Alamat kantor ────────────────────────────────────────────────────────────

/** Langsung sesudah nama kantor: "jalan ..." / "di Jl. ..." tanpa kata kerja. */
const POLA_ALAMAT_LANGSUNG = /^\s*[,;.]?\s*(?:di\s+)?(?=(?:jalan|jl\.?|jln\.?)\s)/i;
/** Kata kerja alamat - boleh agak jauh sesudah nama ("..., Unit Kerja ..., yang beralamat kantor di"). */
const POLA_KATA_ALAMAT =
  /\b(?:yang\s+)?(?:beralamat|berkedudukan|berkantor|berdomisili|bertempat|alamat)(?:\s+(?:kantor|hukum|kedudukan))?(?:\s+(?:di|pada))?\s*:?\s*/i;

const POLA_UJUNG_ALAMAT =
  /\s*[,.]?\s*(?:dengan\s+)?(?:alamat\s+)?(?:domisili\s+)?(?:elektronik|elektornik|e-?mail|email|e-?court)\b|\s*[,.]?\s*dengan\s+alamat\b|\s*[,.]?\s*(?:hp|no\.?\s*hp|telp|tlp|cp|nomor\s+hp|no\.?\s*telp|contact\s+person)\b|\s*[,.]\s*(?:berdasarkan|baik\s+bertindak|bertindak|dalam\s+hal|untuk\s+dan|selanjutnya|sebagaimana|keduanya|masing)|\s+(?:berdasarkan|selanjutnya|sebagaimana)\b|;|\s-{2,}|_{2,}|\s*:\s*_|\(\s*vide/i;

export function alamatSesudah(t: string, dari: number): { nilai: string; mulai: number; akhir: number } | null {
  const sisa = t.slice(dari, dari + 450);
  let mulaiIsi = -1;
  const langsung = POLA_ALAMAT_LANGSUNG.exec(sisa);
  if (langsung) mulaiIsi = langsung[0].length;
  else {
    const k = POLA_KATA_ALAMAT.exec(sisa.slice(0, 320));
    if (k) mulaiIsi = k.index + k[0].length;
  }
  if (mulaiIsi < 0) return null;
  const isi = sisa.slice(mulaiIsi).replace(/^di\s+/i, "");
  const u = POLA_UJUNG_ALAMAT.exec(isi);
  const nilai = isianAmanAbt(isi.slice(0, u ? u.index : Math.min(isi.length, 250))).replace(/[\s,.;:]+$/g, "");
  if (nilai.length < 8 || !/[A-Za-z]{3}/.test(nilai)) return null;
  return { nilai, mulai: dari + mulaiIsi, akhir: dari + mulaiIsi + (u ? u.index : nilai.length) };
}

// ─── Nama advokat ─────────────────────────────────────────────────────────────

const GELAR = String.raw`(?:S\.?\s?H\.?\s?I\.?|S\.?\s?H\.?|S\.?\s?Sy\.?|M\.?\s?H\.?|S\.?\s?Ag\.?|M\.?\s?Kn\.?|LL\.?\s?M\.?|C\.?\s?L\.?\s?A\.?|M\.?\s?Si\.?|S\.?\s?Sos\.?|S\.?\s?E\.?|M\.?\s?M\.?|C\.?\s?Me\.?|C\.?\s?P\.?\s?L\.?)`;
const POLA_ADVOKAT = new RegExp(
  String.raw`((?:(?:Adv|Hj|H|Dr|Drs|Ir)\.?\s+)*[A-Z][A-Za-z'’\-]+(?:\.?\s+(?:[A-Z]\.?(?=[\s,])|[A-Z][A-Za-z'’\-]+)){0,5})\s*\.?\s*,?\s*(` +
    GELAR +
    String.raw`(?:\s*[.,]?\s*` +
    GELAR +
    String.raw`)*)(?=[\s.,;:\-]|$)`,
  "g"
);

/** Kata yang bukan nama orang walau diikuti gelar. */
const BUKAN_NAMA = /^(?:dan|kami|nama|kantor|hukum|advokat|yang|bahwa|adalah|oleh|kepada|bernama|kuasa|pada)$/i;

export function namaAdvokat(kepala: string): string[] {
  const t = rapatkan(kepala);
  const hasil: string[] = [];
  const kunci = new Set<string>();
  POLA_ADVOKAT.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = POLA_ADVOKAT.exec(t))) {
    let nama = m[1].replace(/^(?:adv\.?\s+)/i, "").trim();
    // Kata pembuka yang terbawa: "bernama X", "Kuasanya X".
    nama = nama.replace(/^(?:(?:dan|kami|nama|bernama|kepada|oleh|kuasa(?:nya)?|hukumnya|adalah)\s+)+/i, "").trim();
    const kata = nama.split(/\s+/);
    if (!nama || kata.length > 6 || BUKAN_NAMA.test(kata[0])) continue;
    const gelar = m[2].replace(/\s+/g, "").replace(/,/g, ", ").replace(/\.(?=[A-Za-z])/g, ".");
    const k = nama.toLowerCase().replace(/[^a-z]/g, "");
    if (k.length < 3 || kunci.has(k)) continue;
    kunci.add(k);
    hasil.push(isianAmanAbt(`${nama}, ${gelar}`.replace(/,\s*,/g, ",")).replace(/[,\s]+$/, ""));
  }
  return hasil.slice(0, 8);
}

// ─── Semua ────────────────────────────────────────────────────────────────────

export function uraiKuasaGugatan(teks: string): KuasaGugatan {
  const kepala = kepalaSurat(teks);
  const ada = POLA_ADA_KUASA.test(kepala);
  const kosong: KuasaGugatan = { ada: false, tanggalSuratKuasa: null, kantor: null, alamatKantor: null, advokat: null };
  if (!ada) return kosong;
  const tgl = tanggalSuratKuasa(teks);
  const kt = namaKantor(kepala);
  let alamat: KuasaGugatan["alamatKantor"] = null;
  if (kt) {
    const a = alamatSesudah(kepala, kt.akhir);
    if (a) alamat = { nilai: a.nilai, kalimat: potongKalimat(kepala, a.mulai, a.akhir, 40) };
  }
  if (!alamat) {
    // "Pekerjaan : Advokat ... Alamat : Jl. ..." (kuasa tunggal tanpa nama kantor)
    const p = /pekerjaan\s*:?\s*advo[ck]at[^:]{0,60}?\balamat\s*(?:kantor)?\s*:\s*/i.exec(kepala);
    if (p) {
      const a = alamatSesudah(kepala, p.index + p[0].length - 0);
      const isi = a || alamatSesudah(`alamat ${kepala.slice(p.index + p[0].length)}`, 0);
      if (isi) alamat = { nilai: isi.nilai, kalimat: potongKalimat(kepala, p.index, p.index + p[0].length + isi.nilai.length, 20) };
    }
  }
  const adv = namaAdvokat(kepala);
  return {
    ada: true,
    tanggalSuratKuasa: tgl,
    kantor: kt ? { nilai: kt.nama, kalimat: potongKalimat(kepala, kt.mulai, kt.akhir, 50) } : null,
    alamatKantor: alamat,
    advokat: adv.length ? { nilai: adv, kalimat: "" } : null,
  };
}
