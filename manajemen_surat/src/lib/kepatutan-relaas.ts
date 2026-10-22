/**
 * ============================================================================
 * KEPATUTAN SATU RELAAS - SATU ATURAN (22 Okt 2026) - PADANAN TS
 * ============================================================================
 *
 * Salinan bertipe dari aleta_bot/services/kepatutanRelaas.js. Jangan
 * menyunting aturannya di sini saja: src/test/relaas-sema-1-2023-22okt.test.ts
 * membandingkan keluaran keduanya atas contoh kalimat nyata.
 * ============================================================================
 *
 * Menjawab untuk satu baris perkara_pelaksanaan_relaas: dengan CARA apa
 * panggilan ditempuh, APA yang terjadi, sah atau tidak, dan DASAR hukumnya.
 * Pasangan TS-nya manajemen_surat/src/lib/kepatutan-relaas.ts - keduanya
 * dijaga sama oleh src/test/relaas-sema-1-2023-22okt.test.ts.
 *
 * Sebab (permintaan hakim pengguna 22 Okt): relaas surat tercatat 609/Pdt.G/
 * 2026 "diterima oleh Pak A/ayah kandung" tampil "Tidak bertemu", padahal
 * penyerahan kepada orang dewasa yang tinggal serumah SAH menurut SEMA 1/2023.
 *
 * ----------------------------------------------------------------------------
 * SURAT TERCATAT - SEMA Nomor 1 Tahun 2023 (5 Juli 2023)
 * ----------------------------------------------------------------------------
 *   angka 3   disampaikan langsung; bila tidak dapat, kepada orang dewasa yang
 *             tinggal serumah.
 *   angka 4   pihak tidak bersedia menerima/menandatangani: petugas mencatat,
 *             surat DIKEMBALIKAN ke pengadilan (retur).
 *   angka 5   apartemen/rusun: resepsionis/petugas keamanan.
 *   angka 6   penerima serumah/resepsionis hanya sah bila (a) BUKAN pihak lawan
 *             dan (b) bersedia difoto beserta kartu identitasnya.
 *   angka 7-8 tidak bersedia difoto / rumah tidak berpenghuni (setelah 2 kali
 *             pengantaran): melalui lurah/kepala desa (termasuk aparatnya).
 *   angka 9   retur karena alamat tidak ditemukan / tidak tinggal di alamat
 *             -> panggilan umum.
 *   angka 10  tidak ditemukan / tidak tinggal / meninggal dunia hanya dapat
 *             dinyatakan dengan keterangan lurah/kepala desa.
 *   angka 11  DIKIRIM paling lambat 6 hari kalender sebelum sidang dan DITERIMA
 *             paling lambat 3 hari kerja sebelum sidang.
 *   angka 12  isi keterangan penyerahan, huruf a-g (lihat KATEGORI).
 *   angka 13  bukti penerimaan elektronik (tanggal, identitas, foto, cap,
 *             titik koordinat).
 *
 * ----------------------------------------------------------------------------
 * PANGGILAN BIASA OLEH JURUSITA - Pasal 718 RBg (Buku II)
 * ----------------------------------------------------------------------------
 *   ayat (1)  disampaikan kepada orangnya di tempat tinggalnya; bila tidak
 *             dijumpai, kepada kepala desa/lurah yang wajib meneruskannya.
 *             Penyerahan kepada keluarga TIDAK diatur - bukan "bertemu".
 *   ayat (3)  tempat tinggal tidak diketahui: panggilan umum.
 *
 * ----------------------------------------------------------------------------
 * PANGGILAN ELEKTRONIK - dianggap bertemu (ketentuan pengguna 21 Okt 2026).
 * ----------------------------------------------------------------------------
 *
 * Teks ket_hasil_relaas ditulis bebas oleh jurusita/petugas pos, sehingga
 * aturan ini membaca KALIMAT, lalu menyatakan dengan jujur bila kalimatnya
 * tidak cukup: kategori "periksa" (kuning), bukan tebakan sah/tidak.
 * Penilaian ini alat bantu; sah tidaknya panggilan ditetapkan majelis.
 */

// --- Salinan returRelaas.js (aturan retur bersama; sqlRetur hanya di bot) ---
export const POLA_RETUR = /retur|failed/i;

export const FRASA_RETUR_POS = [
  "tidak berhasil diserahkan",
  "dikembalikan",
  "tidak ditemukan",
  "tidak diketemukan",
  "tidak dikenal",
  "tidak ada yang mengenal",
  "alamat tidak jelas",
  "alamat tidak lengkap",
  "alamat salah",
  "tidak tinggal",
  "tidak berdomisili",
  "pindah alamat",
  "pindah domisili",
  "pindah tempat",
  "sudah pindah",
  "telah pindah",
  "meninggal dunia",
  "telah meninggal",
  "wafat",
  "tidak bersedia menerima",
  "tidak bersedia menandatangani",
  "tidak bersedia menanda tangani",
  "ditolak",
  "menolak menerima",
];

function lewatPos(ketTemu: unknown, noResiPos: unknown): boolean {
  return String(ketTemu || "").trim().toUpperCase() === "S" || String(noResiPos || "").trim() !== "";
}

/** Relaas ini retur? Sama dengan relaasRetur di aleta_bot/services/returRelaas.js. */
export function relaasRetur(statusPos: unknown, hasil: unknown, ketTemu?: unknown, noResiPos?: unknown): boolean {
  if (Number(statusPos) === 2 || POLA_RETUR.test(String(hasil || ""))) return true;
  if (!lewatPos(ketTemu, noResiPos)) return false;
  const t = String(hasil || "").toLowerCase();
  return FRASA_RETUR_POS.some((frasa) => t.includes(frasa));
}

export type JalurRelaas = "elektronik" | "pengumuman" | "surat_tercatat" | "jurusita";

export type KunciKepatutan =
  | "elektronik"
  | "pengumuman"
  | "langsung"
  | "serumah"
  | "resepsionis"
  | "kepala_desa"
  | "menolak"
  | "tolak_foto"
  | "tidak_ditemukan"
  | "tidak_tinggal"
  | "meninggal"
  | "ditolak_desa"
  | "retur"
  | "belum_sampai"
  | "diterima_lain"
  | "penerima_lawan"
  | "pos_berhasil"
  | "belum_terbukti"
  | "tidak_bertemu"
  | "keluarga_jurusita"
  | "tidak_dapat"
  | "tak_terbaca";

export type KepatutanRelaas = {
  kunci: KunciKepatutan;
  jalur: string;
  /** true sah, false tidak sah, null perlu diperiksa. */
  sah: boolean | null;
  warna: "hijau" | "kuning" | "merah";
  label: string;
  dasar: string;
  keterangan: string;
  retur: boolean;
  /** Lencana retur beserta sebabnya, mis. "Retur - alamat tidak ditemukan (SEMA 1/2023 angka 12 huruf e)"; "" bila bukan retur. */
  labelRetur: string;
  /** Huruf SEMA 1/2023 angka 12 (a-g) bila surat tercatat. */
  huruf: string;
  penerima: string;
  hubungan: string;
};

export type BahanRelaas = {
  ketTemu?: unknown;
  statusPos?: unknown;
  hasil?: unknown;
  noResiPos?: unknown;
  tanggalKirimPos?: unknown;
  tanggalRelaas?: unknown;
  namaPihak?: unknown;
  pihakKe?: unknown;
  penerimaLawan?: boolean | null;
};

/** Sandi ket_temu SIPP -> cara panggil. */
const SANDI_PENGUMUMAN = new Set(["R", "M", "W", "P"]);

/** Kata pembentuk retur pada surat tercatat (selaras returRelaas.POLA_RETUR, diperluas). */
export const POLA_TANDA_RETUR = /retur|return|failed|tidak berhasil diserahkan|dikembalikan ke pengirim/;
// "meninggalkan alamat" berarti pindah, bukan meninggal dunia.
export const POLA_MENINGGAL = /meninggal(?!kan)|wafat|almarhum|almarhumah/;
export const POLA_TIDAK_TINGGAL =
  /tidak (?:lagi )?(?:tinggal|berdomisili|bertempat tinggal|menetap)|meninggalkan (?:alamat|rumah|tempat)|(?:sudah|telah|ybs|bersangkutan|tergugat|termohon|penerima) pindah|pindah (?:alamat|domisili|rumah|tempat)/;
export const POLA_TIDAK_DITEMUKAN =
  /alamat\s.{0,40}tidak\s(?:di)?temukan|tidak ditemukan|tidak diketemukan|tidak dikenal|tidak ada yang mengenal|alamat (?:tidak (?:jelas|lengkap|sesuai)|salah|kurang)|address not found|unknown/;
const POLA_DITOLAK_DESA = /ditolak (?:oleh )?(?:aparat|kepala desa|lurah|kelurahan|pemerintah desa|sekdes)/;
export const POLA_MENOLAK = /tidak bersedia (?:menerima|menandatangani|menanda tangani|tanda tangan)|menolak|ditolak|refused/;
const POLA_RUMAH_KOSONG = /rumah kosong|tidak berpenghuni/;
const POLA_DESA =
  /kepala desa|kades\b|\blurah\b|kelurahan|sekdes|sekretaris desa|aparat|perangkat desa|kantor desa|pemerintah desa|pemdes|kepala dusun|kadus\b|staf desa|kaur\b|kasi (?:pemerintahan|pelayanan)/;
const POLA_DUA_KALI = /2 ?\(?dua\)? ?kali|dua kali|2 kali|kedua kali/;
const POLA_RESEPSIONIS = /resepsionis|receptionist|satpam|security|petugas keamanan/;
const POLA_RT = /\b(?:ketua |pak |bapak )?r[tw]\b\.? ?\d*/;
const POLA_KANTOR = /rekan kerja|teman kerja|kantor (?!desa|kelurahan)/;
const POLA_SERUMAH = /serumah|orang rumah|tinggal bersama/;
// Hubungan keluarga. "ibu"/"bapak"/"pak" saja adalah sapaan, bukan hubungan -
// hanya dihitung bila disertai kandung/tiri/mertua atau ditulis sesudah garis miring.
const POLA_HUBUNGAN =
  /\b(istri(?:nya)?|isteri(?:nya)?|suami(?:nya)?|ayah(?: kandung| tiri)?|bapak (?:kandung|tiri|mertua)|ibu (?:kandung|tiri|mertua)|ibunya|bapaknya|mama|papa|anak(?: kandung| tiri)?|anaknya|kakak(?: kandung)?|kakaknya|adik(?: kandung)?|adiknya|kakek|nenek|mertua|ipar|paman|om|tante|bibi|keponakan|ponakan|sepupu|cucu|menantu|orang ?tua|ortu|keluarga|saudara(?: kandung| sepupu)?|saudaranya|saudari)\b/;
const POLA_HUBUNGAN_MIRING = /\/\s*(ibu|bapak|pak|bu)\b/;
const POLA_LANGSUNG =
  /(?:d?i)?te?rima langsung|bertemu langsung|yang bersangkutan|\bybs\b|(?:d?i)?te?rima sendiri|pihak sendiri|pihak langsung|(?:d?i)?te?rima (?:oleh )?(?:si )?pihak penerima|pihak penerima(?! *(?:tidak|di alamat))|delivered to addressee|^\s*bertemu\b/;
const POLA_PERJALANAN = /belum sampai|dalam proses|proses antar|sedang (?:dikirim|diantar)|inlocation|in location|akan diantar|on shipping|paket keluar|dalam pengiriman/;
const POLA_PENGUMUMAN = /pengumuman|papan pengumuman|media massa|radio|website/;
// "diterima" kerap salah ketik ("ditrima", "iterima", "elah diterima").
const POLA_DITERIMA_OLEH =
  /(?:d?i)?te?rimah?\s+(?:oleh|olah|oleg)\s*:?\s*(?:\(\s*)?([a-z][a-z.' ]{1,40}?)(?=\s*(?:[/,(\-)]|yang\b|pihak\b|$|selaku|sebagai|resepsionis|satpam|petugas|aparat|kadus|kepala|sekdes))/;
/** Penerima disebut dengan KEDUDUKANNYA: "diterima tergugat", "diterima oleh X pihak penggugat". */
const POLA_PERAN_PENERIMA = /(?:d?i)?te?rima\b.{0,40}?\b(penggugat|pemohon|tergugat|termohon)\b/;
/** Orang serumah menerima tetapi menolak difoto (SEMA angka 6 huruf b, angka 7). */
const POLA_TOLAK_FOTO = /(?:menolak|tidak bersedia|tidak mau)\s+(?:untuk\s+)?(?:di\s?ambil\s+)?(?:di)?\s?foto/;

const SEMA = "SEMA 1/2023";
const RBG = "Pasal 718 ayat (1) RBg";

/** Teks bersih huruf kecil: tag HTML dan entitas dibuang. */
export function bersih(teks: unknown): string {
  return String(teks || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;?/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function potonganNama(nama: unknown): string[] {
  return bersih(nama)
    .replace(/\b(?:bin|binti)\b.*$/, "")
    .split(/[^a-z]+/)
    .filter((x) => x.length >= 3);
}

/** Nama penerima pada kalimat "diterima oleh X ..." - atau "". */
export function namaPenerima(teks: unknown): string {
  const m = bersih(teks).match(POLA_DITERIMA_OLEH);
  if (!m) return "";
  const nama = m[1].replace(/\b(?:pak|bapak|ibu|bu|sdr|sdri|saudara|saudari|an)\b\.?/g, " ").replace(/\s+/g, " ").trim();
  if (!nama || /^(?:pihak|yang|orang|tergugat|termohon|penggugat|pemohon|resepsionis|satpam|aparat|kepala|lurah|sekdes)\b/.test(nama)) return "";
  return nama;
}

/** Penerima bernama sama dengan pihak yang dipanggil (salah satu potongan nama >= 4 huruf). */
function samaDenganPihak(penerima: string, namaPihak: unknown): boolean {
  const a = potonganNama(penerima);
  const b = new Set(potonganNama(namaPihak));
  return a.length > 0 && a.some((x) => b.has(x));
}

/** Kata hubungan untuk label, mis. "ayah kandung". */
function hubunganDari(teks: unknown): string {
  const t = bersih(teks);
  const m = t.match(POLA_HUBUNGAN);
  if (m) return m[1].replace(/nya$/, "").replace(/^isteri/, "istri").replace(/^ortu$/, "orang tua").replace(/^orangtua$/, "orang tua");
  const miring = t.match(POLA_HUBUNGAN_MIRING);
  if (miring) return miring[1] === "pak" ? "bapak" : miring[1] === "bu" ? "ibu" : miring[1];
  return "";
}

/** Jalur panggilan baris ini. */
export function jalurRelaas({ ketTemu, noResiPos, tanggalKirimPos }: BahanRelaas = {}): JalurRelaas {
  const sandi = String(ketTemu || "").trim().toUpperCase();
  if (sandi === "E") return "elektronik";
  if (SANDI_PENGUMUMAN.has(sandi)) return "pengumuman";
  if (sandi === "S" || String(noResiPos || "").trim() || String(tanggalKirimPos || "").trim()) return "surat_tercatat";
  return "jurusita";
}

function hasil(
  kunci: KunciKepatutan,
  jalur: string,
  sah: boolean | null,
  label: string,
  dasar: string,
  keterangan: string,
  tambahan: Partial<KepatutanRelaas> = {}
): KepatutanRelaas {
  const warna: KepatutanRelaas["warna"] = sah === true ? "hijau" : sah === false ? "merah" : "kuning";
  return { kunci, jalur, sah, warna, label, dasar, keterangan, retur: false, labelRetur: "", huruf: "", penerima: "", hubungan: "", ...tambahan };
}

/** Sebab retur surat tercatat dari kalimatnya (SEMA angka 4, 9, 10, 12 huruf b/e/f/g). */
function sebabReturPos(t: string, jalur: string): KepatutanRelaas | null {
  if (POLA_MENINGGAL.test(t))
    return hasil("meninggal", jalur, false, "Meninggal dunia", `${SEMA} angka 10 & 12 huruf g`, "Pihak telah meninggal dunia - harus dinyatakan dengan keterangan lurah/kepala desa; panggilan selanjutnya kepada ahli waris/panggilan umum.", { huruf: "g", retur: true });
  if (POLA_TIDAK_TINGGAL.test(t))
    return hasil("tidak_tinggal", jalur, false, "Tidak tinggal di alamat", `${SEMA} angka 9, 10 & 12 huruf f`, "Pihak tidak tinggal di alamat yang dituju - surat dikembalikan (retur); bila keberadaannya tidak diketahui lagi, panggilan umum.", { huruf: "f", retur: true });
  if (POLA_TIDAK_DITEMUKAN.test(t))
    return hasil("tidak_ditemukan", jalur, false, "Alamat tidak ditemukan", `${SEMA} angka 9, 10 & 12 huruf e`, "Alamat pihak tidak ditemukan - surat dikembalikan (retur); bila keberadaannya tidak diketahui lagi, panggilan umum.", { huruf: "e", retur: true });
  if (POLA_DITOLAK_DESA.test(t))
    return hasil("ditolak_desa", jalur, false, "Ditolak aparat desa", `${SEMA} angka 7, 8 & 13`, "Surat tidak dapat dititipkan kepada lurah/kepala desa (ditolak aparat desa) dan dikembalikan - panggilan belum sampai.", { retur: true });
  // "menolak difoto" bukan menolak MENERIMA - itu angka 6 huruf b, dinilai terpisah.
  if (POLA_MENOLAK.test(t.replace(new RegExp(POLA_TOLAK_FOTO.source, "g"), " ")))
    return hasil("menolak", jalur, null, "Menolak menerima", `${SEMA} angka 4 & 12 huruf b`, "Pihak tidak bersedia menerima/menandatangani; menurut SEMA surat dikembalikan ke pengadilan (retur). SEMA tidak menyatakan panggilan ini sah - majelis yang menilai.", { huruf: "b", retur: true });
  return null;
}

/**
 * Kepatutan satu relaas.
 *
 */
export function nilaiRelaas(r: BahanRelaas = {}): KepatutanRelaas {
  const k = sesuaikanRetur(nilaiDasar(r), r);
  return { ...k, labelRetur: labelRetur(k, r) };
}

function sesuaikanRetur(k: KepatutanRelaas, r: BahanRelaas): KepatutanRelaas {
  // Retur satu sumber dengan returRelaas.js (dan penggalan SQL-nya), supaya
  // daftar yang menghitung retur dan lencana satu relaas tidak berselisih.
  const retur = relaasRetur(r.statusPos, r.hasil, r.ketTemu, r.noResiPos);
  if (retur === k.retur) return k;
  if (retur && k.sah === true) {
    return { ...k, sah: null, warna: "kuning", retur: true, label: `${k.label} - tertanda retur`, keterangan: `${k.keterangan} Keterangan yang sama juga menyebut surat dikembalikan - periksa.` };
  }
  return { ...k, retur };
}

/**
 * Sebab retur dalam satu kalimat pendek (keputusan pengguna 22 Okt 2026):
 * retur TETAP dihitung retur, tetapi lencananya menyebut sebabnya, mis.
 * "Retur - alamat tidak ditemukan (SEMA 1/2023 angka 12 huruf e)".
 */
const SEBAB_RETUR: Partial<Record<KunciKepatutan, string>> = {
  tidak_ditemukan: `alamat tidak ditemukan (${SEMA} angka 12 huruf e)`,
  tidak_tinggal: `tidak tinggal di alamat (${SEMA} angka 12 huruf f)`,
  meninggal: `meninggal dunia (${SEMA} angka 12 huruf g)`,
  menolak: `menolak menerima (${SEMA} angka 12 huruf b)`,
  ditolak_desa: `ditolak aparat desa (${SEMA} angka 7-8)`,
};

function labelRetur(k: KepatutanRelaas, r: BahanRelaas): string {
  if (!k.retur) return "";
  if (SEBAB_RETUR[k.kunci]) return `Retur - ${SEBAB_RETUR[k.kunci]}`;
  if (k.jalur !== "surat_tercatat") return "Retur";
  const t = bersih(r.hasil);
  if (/failed/.test(t)) return "Retur - FAILED TO DELIVERY";
  if (POLA_RUMAH_KOSONG.test(t)) return "Retur - rumah kosong";
  if (k.kunci !== "retur") return `Retur pos - ${k.label.replace(/ - tertanda retur$/, "").toLowerCase()}`;
  return "Retur pos";
}

function nilaiDasar(r: BahanRelaas = {}): KepatutanRelaas {
  const sandi = String(r.ketTemu || "").trim().toUpperCase();
  const jalur = jalurRelaas(r);
  const t = bersih(r.hasil);
  const statusPos: number | null = r.statusPos === null || r.statusPos === undefined || r.statusPos === "" ? null : Number(r.statusPos);
  const penerima = namaPenerima(t);

  // ---- Elektronik: dianggap bertemu (keputusan pengguna 21 Okt) -----------
  if (jalur === "elektronik") {
    return hasil("elektronik", jalur, true, "Bertemu (elektronik)", "SK KMA 363/KMA/SK/XII/2022 (panggilan elektronik)", "Panggilan elektronik yang dilaksanakan dianggap bertemu.");
  }

  // ---- Panggilan umum (ghaib) ----------------------------------------------
  if (jalur === "pengumuman") {
    return hasil("pengumuman", jalur, true, "Panggilan umum", "Pasal 718 ayat (3) RBg; Pasal 27 PP 9/1975", "Panggilan melalui pengumuman bagi pihak yang tidak diketahui tempat tinggalnya.");
  }

  // ---- Surat tercatat -------------------------------------------------------
  if (jalur === "surat_tercatat") {
    const tandaRetur = statusPos === 2 || POLA_TANDA_RETUR.test(t);
    const sebab = sebabReturPos(t, jalur);
    if (sebab) return sebab;
    if (tandaRetur) {
      return hasil("retur", jalur, false, POLA_RUMAH_KOSONG.test(t) ? "Retur (rumah kosong)" : "Retur", `${SEMA} angka 9`, "Surat dikembalikan ke pengadilan; sebabnya tidak tertulis lengkap pada keterangan relaas.", { retur: true });
    }
    if (POLA_PERJALANAN.test(t) && statusPos !== 1) {
      return hasil("belum_sampai", jalur, null, "Surat masih di perjalanan", `${SEMA} angka 1 & 11`, "Penerimaan belum terbukti - surat tercatat baru sah bila ada tanda terima bertanggal.");
    }
    if (POLA_DESA.test(t)) {
      const dua = POLA_DUA_KALI.test(t);
      return hasil(
        "kepala_desa",
        jalur,
        true,
        "Melalui kepala desa",
        `${SEMA} angka 7, 8 & 12 huruf d`,
        dua
          ? "Diterima lurah/kepala desa (termasuk aparat) setelah 2 kali pengantaran."
          : "Diterima lurah/kepala desa (termasuk aparat). Jumlah pengantaran (2 kali) tidak tertulis pada keterangan relaas - periksa bukti penerimaannya.",
        { huruf: "d", penerima }
      );
    }
    if (POLA_RESEPSIONIS.test(t) && !POLA_KANTOR.test(t)) {
      if (r.penerimaLawan === true) return lawan(jalur, penerima);
      return hasil("resepsionis", jalur, true, "Diterima resepsionis/petugas keamanan", `${SEMA} angka 5, 6 & 12 huruf c`, "Diterima resepsionis/petugas keamanan di tempat tinggal pihak.", { huruf: "c", penerima });
    }
    if (r.penerimaLawan === true && penerima) return lawan(jalur, penerima);
    if (POLA_TOLAK_FOTO.test(t)) {
      return hasil("tolak_foto", jalur, null, "Penerima menolak difoto - periksa", `${SEMA} angka 6 huruf b & 7`, "Surat dititipkan kepada orang yang menolak difoto beserta kartu identitasnya; menurut SEMA surat seharusnya disampaikan melalui lurah/kepala desa.", { huruf: "c", penerima });
    }
    const hubungan = hubunganDari(t);
    const serumah = POLA_SERUMAH.test(t);
    if (hubungan || serumah) {
      const pasangan = /^(?:istri|suami)$/.test(hubungan);
      const label = hubungan ? `Bertemu orang serumah (${hubungan})` : "Bertemu orang serumah";
      return hasil(
        "serumah",
        jalur,
        pasangan ? null : true,
        label,
        `${SEMA} angka 3, 6 & 12 huruf c`,
        pasangan
          ? "Diterima istri/suami pihak. Pada perkara perceraian istri/suami lazimnya pihak lawan, padahal penerima tidak boleh pihak lawan (angka 6 huruf a) - periksa."
          : "Diterima orang dewasa yang tinggal serumah dengan pihak - sah bila penerima bukan pihak lawan dan bersedia difoto beserta kartu identitasnya (angka 6).",
        { huruf: "c", penerima, hubungan: hubungan || "orang serumah" }
      );
    }
    // Penerima disebut dengan kedudukannya. Kedudukan yang BERLAWANAN dengan
    // pihak yang dipanggil = pihak lawan (angka 6 huruf a).
    const peran = t.match(POLA_PERAN_PENERIMA);
    const sisiPeran = peran ? (/penggugat|pemohon/.test(peran[1]) ? 1 : 2) : 0;
    const sisiDipanggil = Number(r.pihakKe) === 1 || Number(r.pihakKe) === 2 ? Number(r.pihakKe) : 0;
    if (sisiPeran && sisiDipanggil && sisiPeran !== sisiDipanggil) return lawan(jalur, penerima || (peran ? peran[1] : ""));
    if (POLA_LANGSUNG.test(t) || (sisiPeran && sisiPeran === sisiDipanggil) || (penerima && r.namaPihak && samaDenganPihak(penerima, r.namaPihak))) {
      return hasil("langsung", jalur, true, "Bertemu langsung", `${SEMA} angka 3 & 12 huruf a`, "Diterima langsung oleh pihak penerima.", { huruf: "a", penerima });
    }
    if (sisiPeran) {
      return hasil("diterima_lain", jalur, null, `Diterima ${peran ? peran[1] : ""} - periksa`, `${SEMA} angka 6 huruf a & 12 huruf a`, "Keterangan menyebut kedudukan penerima, tetapi kedudukan pihak yang dipanggil tidak terbaca - pastikan penerima bukan pihak lawan.", { penerima: penerima || (peran ? peran[1] : "") });
    }
    if (POLA_KANTOR.test(t)) {
      return hasil("diterima_lain", jalur, null, "Diterima rekan kerja - periksa", `${SEMA} angka 3, 5 & 12 huruf c`, "SEMA hanya menyebut orang dewasa serumah atau resepsionis/petugas keamanan tempat tinggal; penyerahan di kantor kepada rekan kerja tidak termasuk.", { penerima });
    }
    if (penerima) {
      const rt = POLA_RT.test(t);
      return hasil(
        "diterima_lain",
        jalur,
        null,
        rt ? "Diterima ketua RT/RW - periksa" : "Diterima orang lain - periksa",
        `${SEMA} angka 6 & 12 huruf c/d`,
        rt
          ? "Diterima ketua RT/RW; SEMA hanya menyebut orang serumah, resepsionis/petugas keamanan, atau lurah/kepala desa (termasuk aparat)."
          : "Nama penerima tertulis tetapi hubungannya dengan pihak tidak - SEMA menuntut keterangan \"yang tinggal serumah dengan pihak penerima\".",
        { penerima }
      );
    }
    if (statusPos === 1) {
      return hasil("pos_berhasil", jalur, true, "Diterima (lacak pos berhasil)", `${SEMA} angka 1 & 13`, "Lacak kiriman menyatakan berhasil; siapa penerimanya tidak tertulis pada keterangan relaas - lihat bukti penerimaan elektroniknya.");
    }
    return hasil("belum_terbukti", jalur, null, "Penerimaan belum terbukti", `${SEMA} angka 1, 12 & 13`, "Surat tercatat tanpa keterangan penerimaan maupun hasil lacak kiriman.");
  }

  // ---- Jurusita (Y/T/N/kosong) ----------------------------------------------
  if (sandi === "Y") {
    return hasil("langsung", jalur, true, "Bertemu langsung", RBG, "Jurusita bertemu langsung dengan pihak yang dipanggil.", { huruf: "" });
  }
  if (sandi === "N") {
    const sebab = POLA_TIDAK_TINGGAL.test(t) ? "pihak tidak tinggal/berdomisili di alamat" : POLA_TIDAK_DITEMUKAN.test(t) ? "pihak/alamat tidak dikenal" : "";
    return hasil("tidak_dapat", jalur, false, "Tidak dapat dilaksanakan", RBG, sebab ? `Relaas tidak dapat dilaksanakan: ${sebab}.` : "Relaas tidak dapat dilaksanakan.");
  }
  if (sandi === "T" || (!sandi && t)) {
    // Pihak tidak tinggal di alamat / tidak dikenal / meninggal: relaas yang
    // diteruskan ke desa tidak menjadikannya patut - Pasal 718 ayat (2)-(3) RBg.
    if (POLA_MENINGGAL.test(t)) {
      return hasil("meninggal", jalur, false, "Meninggal dunia", "Pasal 718 ayat (2) RBg", "Pihak meninggal dunia - panggilan disampaikan kepada ahli warisnya.");
    }
    if (POLA_TIDAK_TINGGAL.test(t) || POLA_TIDAK_DITEMUKAN.test(t)) {
      const tinggal = POLA_TIDAK_TINGGAL.test(t);
      return hasil(tinggal ? "tidak_tinggal" : "tidak_ditemukan", jalur, false, tinggal ? "Tidak tinggal di alamat" : "Alamat tidak ditemukan", "Pasal 718 ayat (3) RBg", "Pihak tidak diketahui berada di alamat itu - bila tempat tinggalnya tidak diketahui, panggilan umum.");
    }
    if (POLA_PENGUMUMAN.test(t) && !POLA_DESA.test(t)) {
      return hasil("pengumuman", "pengumuman", true, "Panggilan umum", "Pasal 718 ayat (3) RBg; Pasal 27 PP 9/1975", "Panggilan melalui pengumuman.");
    }
    if (POLA_DESA.test(t)) {
      return hasil("kepala_desa", jalur, true, "Melalui kepala desa", `${RBG} (Buku II)`, "Jurusita tidak bertemu pihak; relaas disampaikan melalui kepala desa/lurah (termasuk aparat) yang wajib meneruskannya.");
    }
    if (sandi === "T" && (hubunganDari(t) || POLA_SERUMAH.test(t))) {
      return hasil("keluarga_jurusita", jalur, null, "Diterima keluarga - periksa", `${RBG} (Buku II)`, "Pada panggilan jurusita, bila pihak tidak dijumpai relaas disampaikan melalui kepala desa/lurah; penyerahan kepada keluarga tidak diatur RBg dan tidak sama dengan bertemu.", { hubungan: hubunganDari(t) || "orang serumah" });
    }
    if (sandi === "T") {
      return hasil("tidak_bertemu", jalur, null, "Tidak bertemu", `${RBG} (Buku II)`, "Jurusita tidak bertemu pihak dan keterangan relaas tidak menyebut penyampaian melalui kepala desa/lurah - periksa relaasnya.");
    }
    if (/bertemu/.test(t) && !/tidak bertemu/.test(t)) {
      return hasil("langsung", jalur, true, "Bertemu langsung", RBG, "Keterangan relaas menyebut bertemu dengan pihak.");
    }
  }
  return hasil("tak_terbaca", jalur, null, "Belum terbaca", "", sandi ? `Sandi SIPP "${sandi}" tanpa keterangan yang dapat dibaca.` : "Cara dan hasil panggilan tidak tercatat.");
}

function lawan(jalur: string, penerima: string): KepatutanRelaas {
  return hasil("penerima_lawan", jalur, false, "Diterima pihak lawan", `${SEMA} angka 6 huruf a`, "Penerima bernama sama dengan pihak lawan - penyerahan kepada pihak lawan tidak sah.", { huruf: "c", penerima });
}

/** Ambang tenggang menurut jalur (SEMA 1/2023 angka 11; Pasal 146 RBg). */
export const TENGGANG = {
  surat_tercatat: { kirimHari: 6, kirimHariKerja: false, terimaHari: 3, terimaHariKerja: true, dasar: `${SEMA} angka 11` },
  jurusita: { terimaHari: 3, terimaHariKerja: true, dasar: "Pasal 146 RBg" },
};

