/**
 * ============================================================================
 * RINGKASAN YANG DISALIN - LENGKAP, TETAPI TETAP BARIS YANG BERDIRI SENDIRI
 * ============================================================================
 *
 * Diminta pengguna 27 September 2026: "tambahkan di tombol salin ringkasan
 * itu datanya yang lebih lengkap". Ringkasan lama enam baris - nomor, jenis,
 * keadaan, umur, sidang berikutnya, majelis - dan yang menempelkannya ke
 * WhatsApp masih harus membuka layar lagi untuk menjawab pertanyaan berikutnya
 * dari rekannya: siapa pihaknya, siapa panitera penggantinya, sudah BHT belum.
 *
 * ============================================================================
 * BARIS, BUKAN TABEL
 * ============================================================================
 *
 * Yang menyalin menempelkannya ke WhatsApp atau surel. Tabel yang ditempel ke
 * sana kehilangan seluruh kolomnya, dan spasi penjajar berantakan begitu
 * hurufnya tidak berlebar sama. Karena itu tiap baris BERDIRI SENDIRI
 * ("Panitera Pengganti: Unun"), dikelompokkan di bawah judul pendek berhuruf
 * besar - bukan tanda bintang WhatsApp, yang di surel terbaca apa adanya.
 *
 * ============================================================================
 * RUAS KOSONG TIDAK DITULIS
 * ============================================================================
 *
 * "Minutasi: -" di tengah pesan membuat pembacanya bertanya apakah minutasinya
 * belum dikerjakan atau datanya yang tidak terbaca. Ruas yang kosong dilewati,
 * dan kelompok yang seluruh ruasnya kosong dilewati BESERTA judulnya. Yang
 * memang perlu ditindaklanjuti - minutasi yang belum tercatat, BHT yang belum
 * ada - sudah disebut di kelompok PERLU TINDAKAN, dari daftar yang sama dengan
 * kotak "Perlu tindakan" di layar.
 *
 * ============================================================================
 * TIDAK ADA PEMBACAAN BARU
 * ============================================================================
 *
 * Seluruhnya dari muatan Status Perkara yang SUDAH ada di layar. Menyalin tidak
 * boleh menjadi pekerjaan yang harus ditunggu, dan ringkasan yang membaca
 * sendiri akan menjadi sumber kedua yang menyimpang dari layarnya.
 */

import { sidangBerikutnya, type Ringkasan } from "@/lib/ringkas-status";
import { ALUR_JINAYAT, ALUR_PERMOHONAN, sebutanPihakPerkara } from "@/lib/sebutan-pihak";
import { tanggalHariPanjang } from "@/lib/tanggal-indonesia";

type AngkaMentah = number | string | null | undefined;

/**
 * Bagian muatan Status Perkara yang dipakai ringkasan.
 *
 * Sengaja ditulis ulang di sini, bukan mengimpor tipe `Status` dari komponen
 * layarnya: pustaka tidak boleh bergantung pada berkas komponen. Bentuknya
 * irisan dari `Status`, sehingga muatan layar dapat diberikan apa adanya.
 *
 * Hampir seluruh ruasnya BOLEH tidak ada - bot versi lama mengirim muatan yang
 * separuh kosong, dan ringkasan tidak boleh jatuh karenanya.
 */
export type BahanRingkasanSalin = {
  identitas: {
    nomorPerkara: string;
    jenisPerkara?: string;
    jenisPerkaraLengkap?: string;
    tanggalDaftar?: string;
    /**
     * Dikirim bot sejak lama (identitasPerkara di sippStatusPerkaraService),
     * walau tipe `Status` di layar belum menyebutnya.
     */
    alurPerkaraId?: AngkaMentah;
    /**
     * Dikirim bot sejak 2.39.0 (identitasPerkara). Bot versi lama tidak
     * mengirimnya - sebutannya lalu jatuh ke bentuk ganda, tidak ditebak.
     */
    jenisPerkaraId?: AngkaMentah;
  };
  lewatEcourt?: boolean;
  umur?: {
    hariBersih?: number | null;
    hariBerjalan?: number | null;
    hariMediasi?: number;
    sudahPutus?: boolean;
    sebabSelesai?: string;
  } | null;
  majelis?: Array<{ nama: string; jabatan?: string; keteranganTahapan?: string }>;
  panitera?: Array<{ nama: string; keteranganTahapan?: string }>;
  jurusita?: Array<{ nama: string; keteranganTahapan?: string }>;
  /**
   * Majelis ikrar talak, tersendiri dari majelis perkara. Dikirim bot sejak
   * perbaikan majelis ikrar (27 September 2026); null = tidak ada ikrar.
   */
  ikrar?: {
    majelis?: Array<{ nama: string; jabatan?: string }>;
    panitera?: Array<{ nama: string }>;
    jurusita?: Array<{ nama: string }>;
  } | null;
  /**
   * "pemeriksa" bila majelis/panitera/jurusita di atas majelis PEMERIKSA.
   * Bot lama tidak mengirimnya - dan isinya penunjukan aktif, yang pada
   * perkara yang sudah ikrar justru majelis ikrar - jadi judulnya tidak
   * menyebut "pemeriksa".
   */
  sumberMajelis?: string;
  pihak?: Array<{ nama: string; pihakKe: number | null; jenis: string }>;
  identitasPihak?: { adaKuasa?: boolean; adaKumulasi?: boolean; kumulasi?: string[] } | null;
  jadwal?: Array<{ tanggalSidang: string; jamSidang?: string; agenda?: string; ditunda?: boolean }>;
  penundaan?: unknown[];
  putusan?: {
    sudahPutus: boolean;
    tanggalPutusan?: string;
    statusPutusan?: string;
    verstek?: boolean;
    tanggalMinutasi?: string;
    tanggalBht?: string;
    aktaCerai?: {
      nomor?: string;
      tanggal?: string;
      diserahkanPihak1?: string;
      diserahkanPihak2?: string;
    } | null;
    upayaHukum?: Array<{ jenis: string; tanggal?: string }>;
  } | null;
  putusanLengkap?: { ada?: boolean; amar?: string } | null;
  ikrarTalak?: { ada?: boolean; tanggalIkrar?: string; status?: string } | null;
  upayaHukum?: Array<{
    jenis?: string;
    sebutan?: string;
    tanggalPermohonan?: string;
    nomorPerkara?: string;
    dicabut?: boolean;
    gugur?: boolean;
  }>;
  mediasi?: {
    terbaca?: boolean;
    baris?: Array<{ mediator?: string; hasil?: string; lamaHari?: number | null }>;
    mediator?: Array<{ nama: string; masihAktif?: boolean }>;
  } | null;
  biaya?: { panjar?: number; terpakai?: number; sisa?: number } | null;
  penilaian?: { skor: number; keadaan: string } | null;
  penanda?: {
    ghaib?: boolean | null;
    mafqud?: boolean | null;
    instansi?: Array<{ label: string }>;
  } | null;
};

export type PilihanRingkasan = {
  /**
   * "YYYY-MM-DD" - acuan yang SAMA dengan kartu ringkas di layar, disuntikkan
   * supaya perilakunya dapat diuji tanpa bergantung pada hari uji dijalankan.
   */
  hariIni: string;
  /** Alamat halaman perkara di SIPP. Kosong bila belum atau tidak tersedia. */
  alamatSipp?: string;
};

/**
 * ============================================================================
 * SEBUTAN PARA PIHAK: PASTI ATAU GANDA, TIDAK PERNAH DITEBAK
 * ============================================================================
 *
 * Sumbernya satu - sebutanPihakPerkara di sebutan-pihak.ts - dan aturannya
 * memakai NOMOR (alur_perkara_id, jenis_perkara_id), bukan kata.
 *
 * Muatan Status Perkara membawa alur_perkara_id, dan jenis_perkara_id sejak
 * 2.39.0 (bot versi lama belum). Tanpa nomor jenis, alur gugatan (15) tidak cukup: cerai
 * talak (346) dan izin poligami (341) beralur gugatan tetapi bersebutan
 * Pemohon/Termohon - 1.178 perkara di satker ini. Menulis "Penggugat" di sana
 * berarti menyebut perkaranya salah jenis, di pesan yang diteruskan orang.
 *
 * Karena itu hanya tiga keadaan yang boleh menyebut SATU sebutan:
 *
 *   alur DAN jenis diketahui   aturan ABT utuh (#0046#/#0047#)
 *   alur permohonan (16)       Pemohon/Termohon - tanpa pengecualian
 *   alur jinayat (122, 123)    Penuntut Umum/Terdakwa
 *
 * Selebihnya memakai sebutan GANDA yang sama dengan judul kelompok Para pihak
 * di layar - "Penggugat/Pemohon", "Tergugat/Termohon" - yang tidak pernah
 * salah.
 *
 * Kedudukannya dibaca dari pihak_ke SIPP (1 penggugat/pemohon, 2 tergugat/
 * termohon), BUKAN dari ruas ABT `pelaku`/`lawan`: nama kedua ruas itu justru
 * terbalik dari isinya (`pelaku` = Tergugat/Termohon) dan sudah dua kali
 * menukar pihak di proyek ini.
 */
export const SEBUTAN_GANDA = { satu: "Penggugat/Pemohon", dua: "Tergugat/Termohon" } as const;

function angkaPositif(nilai: AngkaMentah): number | null {
  if (nilai === null || nilai === undefined || nilai === "") return null;
  const n = Number(nilai);
  // Bot menulis alur yang tidak terbaca sebagai 0 (Number(x) || 0). Nol bukan
  // alur - memperlakukannya sebagai "alur selain permohonan" akan menyebut
  // seluruh perkara yang alurnya gelap sebagai gugatan.
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function sebutanRingkasan(
  identitas: BahanRingkasanSalin["identitas"] | null | undefined
): { satu: string; dua: string; pasti: boolean } {
  const alur = angkaPositif(identitas?.alurPerkaraId);
  const jenis = angkaPositif(identitas?.jenisPerkaraId);

  if (alur !== null && jenis !== null) {
    const s = sebutanPihakPerkara({ alurPerkaraId: alur, jenisPerkaraId: jenis });
    return { satu: s.satu, dua: s.dua, pasti: true };
  }
  if (alur !== null && (alur === ALUR_PERMOHONAN || (ALUR_JINAYAT as readonly number[]).includes(alur))) {
    const s = sebutanPihakPerkara({ alurPerkaraId: alur });
    return { satu: s.satu, dua: s.dua, pasti: true };
  }
  return { ...SEBUTAN_GANDA, pasti: false };
}

// ---------------------------------------------------------------------------
// Pembantu bentuk
// ---------------------------------------------------------------------------

/** Spasi dirapatkan - nama dari SIPP kerap membawa ganti baris dan spasi ganda. */
function bersih(teks: unknown): string {
  return String(teks ?? "").replace(/\s+/g, " ").trim();
}

/** "Rabu, 07-10-2026" - bentuk yang diminta pengguna untuk seluruh layar e-Court. */
function tanggal(nilai: unknown): string {
  return tanggalHariPanjang(nilai, "");
}

/** "09:00:00" menjadi "09:00"; yang tidak berbentuk jam dilewati. */
function jam(nilai: unknown): string {
  const cocok = /^(\d{1,2})[:.](\d{2})/.exec(bersih(nilai));
  return cocok ? `${cocok[1].padStart(2, "0")}:${cocok[2]}` : "";
}

function angka(n: number): string {
  return n.toLocaleString("id-ID");
}

/**
 * Rupiah dengan spasi biasa. Intl menaruh spasi tak-terputus (U+00A0) di
 * antara "Rp" dan angkanya - sebagian aplikasi surel menampilkannya sebagai
 * kotak atau "Â", dan pencarian teks tidak menemukannya.
 */
function rupiah(nilai: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })
    .format(nilai || 0)
    .replace(/ /g, " ");
}

/** Satu sidang: "Selasa, 10-03-2026 09:00 — Pembacaan putusan". */
function kalimatSidang(sidang: { tanggalSidang: string; jamSidang?: string; agenda?: string }): string {
  const waktu = [tanggal(sidang.tanggalSidang), jam(sidang.jamSidang)].filter(Boolean).join(" ");
  return `${waktu} — ${bersih(sidang.agenda) || "agenda belum tercatat"}`;
}

/**
 * Amar putusan dalam satu baris pendek.
 *
 * SIPP menyimpan amar sebagai teks bertanda HTML. Tandanya dibuang - bukan
 * dirender - dan butir daftarnya dirangkai dengan titik koma, sebab ganti
 * baris di tengah satu ruas memecah "baris yang berdiri sendiri". Dipotong
 * pada batas kata supaya potongannya tidak berakhir di tengah nama orang.
 */
export function amarSingkat(amar: unknown, batas = 300): string {
  const teks = String(amar ?? "")
    .replace(/<\/(li|p|div)>/gi, "; ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .replace(/\s*;(\s*;)+/g, ";")
    .replace(/\s+;/g, ";")
    .replace(/^[\s;]+|[\s;]+$/g, "")
    .trim();
  if (teks.length <= batas) return teks;
  const potong = teks.slice(0, batas);
  const spasi = potong.lastIndexOf(" ");
  return `${(spasi > batas * 0.6 ? potong.slice(0, spasi) : potong).replace(/[\s;,]+$/, "")}…`;
}

/** Hanya alamat http/https mutlak yang boleh ikut ke pesan. */
function alamatSah(alamat: unknown): string {
  const teks = bersih(alamat);
  if (!/^https?:\/\//i.test(teks)) return "";
  try {
    new URL(teks);
    return teks;
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Penyusun
// ---------------------------------------------------------------------------

type Kelompok = { judul: string; baris: string[] };

/**
 * Menyusun ringkasan lengkap satu perkara untuk disalin.
 *
 * @param ringkas ringkasan layar (ringkasStatus) - keadaan dan daftar "Perlu
 *   tindakan" diambil dari SANA, bukan dihitung ulang, supaya pesan yang
 *   disalin tidak pernah berselisih dengan kotak yang sedang dibaca.
 */
export function susunRingkasanSalin(
  bahan: BahanRingkasanSalin,
  ringkas: Pick<Ringkasan, "keadaan" | "peringatan">,
  pilihan: PilihanRingkasan
): string {
  const { hariIni } = pilihan;
  const identitas = bahan.identitas ?? { nomorPerkara: "" };
  const umur = bahan.umur ?? {};
  const putusan = bahan.putusan ?? null;
  const sudahPutus = Boolean(putusan?.sudahPutus || umur.sudahPutus);
  const pihak = Array.isArray(bahan.pihak) ? bahan.pihak : [];
  const sebutan = sebutanRingkasan(identitas);

  const kelompok: Kelompok[] = [];

  // ---- identitas -----------------------------------------------------------
  {
    const baris: string[] = [];
    const nomor = bersih(identitas.nomorPerkara);
    if (nomor) baris.push(`Perkara ${nomor}`);
    const jenis = bersih(identitas.jenisPerkaraLengkap) || bersih(identitas.jenisPerkara);
    if (jenis) baris.push(`Jenis perkara: ${jenis}`);
    const daftar = tanggal(identitas.tanggalDaftar);
    if (daftar) baris.push(`Tanggal daftar: ${daftar}`);
    if (typeof bahan.lewatEcourt === "boolean") {
      baris.push(`Jalur: ${bahan.lewatEcourt ? "e-Court" : "bukan e-Court"}`);
    }

    // Ada tidaknya kuasa dari identitasPihak - sumber penanda "dengan kuasa"
    // di layar. Bila bot tidak mengirimnya, daftar pihak yang BERISI kuasa
    // masih membuktikan "ada"; daftar tanpa kuasa tidak membuktikan "tidak
    // ada", jadi barisnya dilewati.
    const adaKuasaDiPihak = pihak.some((x) => bersih(x.jenis).toLowerCase() === "kuasa");
    if (typeof bahan.identitasPihak?.adaKuasa === "boolean") {
      baris.push(`Kuasa hukum: ${bahan.identitasPihak.adaKuasa || adaKuasaDiPihak ? "ada" : "tidak ada"}`);
    } else if (adaKuasaDiPihak) {
      baris.push("Kuasa hukum: ada");
    }

    if (putusan?.verstek === true) baris.push("Verstek: ya");

    const penanda: string[] = [];
    if (bahan.penanda?.ghaib === true) penanda.push("ghaib");
    if (bahan.penanda?.mafqud === true) penanda.push("mafqud (terindikasi)");
    for (const x of bahan.penanda?.instansi ?? []) {
      const label = bersih(x?.label);
      if (label) penanda.push(label);
    }
    if (bahan.identitasPihak?.adaKumulasi) {
      const isi = (bahan.identitasPihak.kumulasi ?? []).map(bersih).filter(Boolean);
      penanda.push(isi.length > 0 ? `kumulasi (${isi.join(", ")})` : "kumulasi");
    }
    if (penanda.length > 0) baris.push(`Penanda: ${penanda.join(", ")}`);

    kelompok.push({ judul: "", baris });
  }

  // ---- para pihak ----------------------------------------------------------
  {
    const baris: string[] = [];
    const kuasa = (x: { jenis: string }) => bersih(x.jenis).toLowerCase() === "kuasa";
    for (const sisi of [1, 2] as const) {
      const nama = sisi === 1 ? sebutan.satu : sebutan.dua;
      for (const orang of pihak.filter((x) => !kuasa(x) && Number(x.pihakKe) === sisi)) {
        const n = bersih(orang.nama);
        if (n) baris.push(`${nama}: ${n}`);
      }
      for (const orang of pihak.filter((x) => kuasa(x) && Number(x.pihakKe) === sisi)) {
        const n = bersih(orang.nama);
        if (n) baris.push(`Kuasa ${nama}: ${n}`);
      }
    }
    // Kuasa yang pihak_ke-nya tidak tercatat disebut tanpa sisi - bukan
    // ditaruh pada salah satu sisi supaya daftarnya terlihat rapi.
    for (const orang of pihak.filter((x) => kuasa(x) && Number(x.pihakKe) !== 1 && Number(x.pihakKe) !== 2)) {
      const n = bersih(orang.nama);
      if (n) baris.push(`Kuasa: ${n}`);
    }
    kelompok.push({ judul: "PARA PIHAK", baris });
  }

  // ---- majelis dan petugas -------------------------------------------------
  //
  // Majelis PEMERIKSA dulu, lalu - bila ada - majelis ikrar talak sebagai
  // kelompok tersendiri. Pesan yang diteruskan tanpa pemisah itu mengulang
  // kekeliruan layar lama: ketua ikrar terbaca ketua majelis perkaranya.
  {
    const akhiran = (x: { keteranganTahapan?: string } | null | undefined) =>
      bersih(x?.keteranganTahapan) ? ` (${bersih(x?.keteranganTahapan)})` : "";
    const barisPetugas = (
      majelis: Array<{ nama: string; jabatan?: string; keteranganTahapan?: string }>,
      panitera: Array<{ nama: string; keteranganTahapan?: string }>,
      jurusita: Array<{ nama: string; keteranganTahapan?: string }>,
      sebutanPanitera: string
    ) => {
      const baris: string[] = [];
      for (const hakim of majelis) {
        const n = bersih(hakim?.nama);
        if (n) baris.push(`${bersih(hakim.jabatan) || "Hakim"}: ${n}${akhiran(hakim)}`);
      }
      for (const orang of panitera) {
        const n = bersih(orang?.nama);
        if (n) baris.push(`${sebutanPanitera}: ${n}${akhiran(orang)}`);
      }
      for (const orang of jurusita) {
        const n = bersih(orang?.nama);
        if (n) baris.push(`Jurusita: ${n}${akhiran(orang)}`);
      }
      return baris;
    };
    kelompok.push({
      judul: bahan.sumberMajelis === "pemeriksa" ? "MAJELIS PEMERIKSA DAN PETUGAS" : "MAJELIS DAN PETUGAS",
      baris: barisPetugas(bahan.majelis ?? [], bahan.panitera ?? [], bahan.jurusita ?? [], "Panitera Pengganti"),
    });
    if (bahan.ikrar) {
      kelompok.push({
        judul: "MAJELIS IKRAR TALAK",
        baris: barisPetugas(
          bahan.ikrar.majelis ?? [],
          bahan.ikrar.panitera ?? [],
          bahan.ikrar.jurusita ?? [],
          "Panitera Sidang"
        ),
      });
    }
  }

  // ---- keadaan -------------------------------------------------------------
  {
    const baris: string[] = [];
    const keadaan = bersih(ringkas.keadaan);
    if (keadaan) baris.push(`Keadaan: ${keadaan}`);

    // Kalimatnya sama dengan kartu "Lama perkara" di layar: yang besar lama
    // BERSIH (yang dinilai), yang dalam kurung selisih mentahnya - itulah yang
    // dapat dicocokkan dengan tanggal pada berkas.
    if (typeof umur.hariBersih === "number" && Number.isFinite(umur.hariBersih)) {
      const mediasi = Number(umur.hariMediasi) || 0;
      const rinci =
        typeof umur.hariBerjalan === "number" && Number.isFinite(umur.hariBerjalan)
          ? ` (${angka(umur.hariBerjalan)} hari daftar sampai ${
              sudahPutus ? bersih(umur.sebabSelesai) || "putus" : "hari ini"
            }${mediasi > 0 ? `, mediasi ${angka(mediasi)} hari` : ""})`
          : "";
      baris.push(`Lama perkara: ${angka(umur.hariBersih)} hari${rinci}`);
    }

    if (bahan.penilaian && Number.isFinite(Number(bahan.penilaian.skor))) {
      const keadaanNilai = bersih(bahan.penilaian.keadaan);
      baris.push(
        `Nilai kelengkapan: ${Number(bahan.penilaian.skor)} dari 100${keadaanNilai ? ` (${keadaanNilai})` : ""}`
      );
    }
    kelompok.push({ judul: "KEADAAN", baris });
  }

  // ---- sidang --------------------------------------------------------------
  {
    const baris: string[] = [];
    const jadwal = (Array.isArray(bahan.jadwal) ? bahan.jadwal : []).map((j) => ({
      tanggalSidang: String(j?.tanggalSidang ?? ""),
      jamSidang: String(j?.jamSidang ?? ""),
      agenda: String(j?.agenda ?? ""),
      ditunda: Boolean(j?.ditunda),
    }));
    if (jadwal.length > 0) {
      const tunda = Array.isArray(bahan.penundaan) ? bahan.penundaan.length : 0;
      baris.push(
        `Jumlah sidang: ${angka(jadwal.length)} kali, ${tunda > 0 ? `${angka(tunda)} kali ditunda` : "tanpa penundaan"}`
      );

      // Terakhir = yang tanggalnya SUDAH lewat. Sidang hari ini masih
      // "berikutnya" - sama dengan kartu di layar, yang menghitungnya begitu
      // supaya perkara yang sedang disidangkan pagi itu tidak terbaca tanpa
      // jadwal.
      const lewat = jadwal
        .filter((j) => /^\d{4}-\d{2}-\d{2}/.test(j.tanggalSidang) && j.tanggalSidang.slice(0, 10) < hariIni)
        .sort((a, b) => a.tanggalSidang.localeCompare(b.tanggalSidang));
      const terakhir = lewat[lewat.length - 1];
      if (terakhir) baris.push(`Sidang terakhir: ${kalimatSidang(terakhir)}`);

      const berikut = sidangBerikutnya(jadwal, hariIni);
      if (berikut) baris.push(`Sidang berikutnya: ${kalimatSidang(berikut)}`);
      else if (!sudahPutus) baris.push("Sidang berikutnya: belum terjadwal");
    }
    kelompok.push({ judul: "SIDANG", baris });
  }

  // ---- mediasi -------------------------------------------------------------
  {
    const baris: string[] = [];
    // Tidak terbaca BUKAN tidak ada. Yang tidak terbaca dilewati seluruhnya -
    // "tanpa mediasi" di pesan yang diteruskan adalah pernyataan yang tidak
    // dibuat siapa pun.
    if (bahan.mediasi && bahan.mediasi.terbaca !== false) {
      const catatan = Array.isArray(bahan.mediasi.baris) ? bahan.mediasi.baris : [];
      for (const satu of catatan) {
        const mediator = bersih(satu?.mediator);
        if (mediator) baris.push(`Mediator: ${mediator}`);
        const lama = typeof satu?.lamaHari === "number" && Number.isFinite(satu.lamaHari) ? satu.lamaHari : null;
        baris.push(
          `Hasil mediasi: ${bersih(satu?.hasil) || "belum dicatat"}${lama !== null ? ` (${angka(lama)} hari)` : ""}`
        );
      }
      if (catatan.length === 0) {
        for (const orang of bahan.mediasi.mediator ?? []) {
          const n = bersih(orang?.nama);
          if (n) baris.push(`Mediator: ${n}`);
        }
      }
    }
    kelompok.push({ judul: "MEDIASI", baris });
  }

  // ---- putusan dan tindak lanjutnya ---------------------------------------
  {
    const baris: string[] = [];
    if (putusan?.sudahPutus) {
      const tgl = tanggal(putusan.tanggalPutusan);
      if (tgl) baris.push(`Tanggal putusan: ${tgl}`);
      const statusPutusan = bersih(putusan.statusPutusan);
      if (statusPutusan) baris.push(`Status putusan: ${statusPutusan}`);
      const amar = amarSingkat(bahan.putusanLengkap?.amar);
      if (amar) baris.push(`Amar (ringkas): ${amar}`);
      const minutasi = tanggal(putusan.tanggalMinutasi);
      if (minutasi) baris.push(`Minutasi: ${minutasi}`);
      const bht = tanggal(putusan.tanggalBht);
      if (bht) baris.push(`Berkekuatan hukum tetap: ${bht}`);

      const akta = putusan.aktaCerai;
      const nomorAkta = bersih(akta?.nomor);
      if (nomorAkta) {
        const tglAkta = tanggal(akta?.tanggal);
        baris.push(`Akta cerai: ${nomorAkta}${tglAkta ? `, ${tglAkta}` : ""}`);
      }
      // Pihak1/pihak2 pada tabel akta cerai SIPP = perkara_pihak1/2, jadi
      // sebutannya mengikuti kedudukan yang sama dengan daftar pihak.
      const serah1 = tanggal(akta?.diserahkanPihak1);
      if (serah1) baris.push(`Akta cerai diserahkan kepada ${sebutan.satu}: ${serah1}`);
      const serah2 = tanggal(akta?.diserahkanPihak2);
      if (serah2) baris.push(`Akta cerai diserahkan kepada ${sebutan.dua}: ${serah2}`);
    }

    if (bahan.ikrarTalak?.ada) {
      const isi = [tanggal(bahan.ikrarTalak.tanggalIkrar), bersih(bahan.ikrarTalak.status)].filter(Boolean);
      if (isi.length > 0) baris.push(`Ikrar talak: ${isi.join(" — ")}`);
    }

    // Upaya hukum yang terinci (sebutan, tanggal permohonan, nomor tingkat
    // atas) lebih dahulu; yang ringkas di dalam putusan hanya cadangan untuk
    // bot yang belum mengirim rinciannya.
    const rinci = Array.isArray(bahan.upayaHukum) ? bahan.upayaHukum : [];
    if (rinci.length > 0) {
      for (const satu of rinci) {
        const nama = bersih(satu?.sebutan) || bersih(satu?.jenis);
        if (!nama) continue;
        const tgl = tanggal(satu.tanggalPermohonan);
        const nomor = bersih(satu.nomorPerkara);
        const akhir = satu.dicabut ? " (dicabut)" : satu.gugur ? " (gugur)" : "";
        baris.push(`Upaya hukum: ${nama}${tgl ? `, diajukan ${tgl}` : ""}${nomor ? `, nomor ${nomor}` : ""}${akhir}`);
      }
    } else {
      for (const satu of putusan?.upayaHukum ?? []) {
        const nama = bersih(satu?.jenis);
        if (!nama) continue;
        const tgl = tanggal(satu.tanggal);
        baris.push(`Upaya hukum: ${nama}${tgl ? `, ${tgl}` : ""}`);
      }
    }
    kelompok.push({ judul: "PUTUSAN", baris });
  }

  // ---- biaya ---------------------------------------------------------------
  {
    const baris: string[] = [];
    const panjar = Number(bahan.biaya?.panjar) || 0;
    const terpakai = Number(bahan.biaya?.terpakai) || 0;
    const sisa = Number(bahan.biaya?.sisa) || 0;
    // Ketiganya nol berarti belum ada catatan panjar - bukan "Rp 0" yang
    // terbaca seperti prodeo.
    if (panjar !== 0 || terpakai !== 0 || sisa !== 0) {
      baris.push(`Panjar: ${rupiah(panjar)}`);
      if (terpakai !== 0) baris.push(`Terpakai: ${rupiah(terpakai)}`);
      baris.push(`Sisa panjar: ${rupiah(sisa)}${sisa < 0 ? " (kurang)" : ""}`);
    }
    kelompok.push({ judul: "BIAYA", baris });
  }

  // ---- perlu tindakan ------------------------------------------------------
  {
    const peringatan = Array.isArray(ringkas.peringatan) ? ringkas.peringatan : [];
    const baris = peringatan.map((p) => bersih(p?.pesan)).filter(Boolean).map((p) => `- ${p}`);
    kelompok.push({ judul: `PERLU TINDAKAN (${baris.length})`, baris });
  }

  // ---- tautan dan waktu salin ---------------------------------------------
  {
    const baris: string[] = [];
    const alamat = alamatSah(pilihan.alamatSipp);
    if (alamat) baris.push(`Halaman perkara di SIPP: ${alamat}`);
    // Pesan yang diteruskan dibaca hari-hari berikutnya. Tanpa tanggal ini
    // "Sidang berikutnya" dan "belum BHT" terbaca sebagai keadaan hari ini.
    const hari = tanggal(hariIni);
    if (hari) baris.push(`Disalin dari ALETA, ${hari}.`);
    kelompok.push({ judul: "", baris });
  }

  return kelompok
    .filter((k) => k.baris.length > 0)
    .map((k) => (k.judul ? [k.judul, ...k.baris] : k.baris).join("\n"))
    .join("\n\n");
}

/**
 * "YYYY-MM-DD" menurut jam PERAMBAN - acuan yang sama dengan kartu ringkas di
 * layar (IsiStatus), supaya "sidang berikutnya" di pesan dan di kartu tidak
 * pernah menunjuk sidang yang berbeda.
 */
export function hariIniPeramban(kini: Date = new Date()): string {
  const p = (x: number) => String(x).padStart(2, "0");
  return `${kini.getFullYear()}-${p(kini.getMonth() + 1)}-${p(kini.getDate())}`;
}
