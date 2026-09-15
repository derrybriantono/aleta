/**
 * ============================================================================
 * AGEN PENYUSUN PERTIMBANGAN - DRAF, TIDAK PERNAH DISIMPAN SENDIRI (TAHAP 4)
 * ============================================================================
 *
 * ============================================================================
 * APA YANG SEBENARNYA PERLU DISUSUN - DIUKUR, BUKAN DIDUGA
 * ============================================================================
 *
 * Rencana pertama saya: menyusun seluruh pertimbangan hukum. Pengukuran
 * membatalkannya sebelum satu baris pun ditulis.
 *
 * Blangko ABT "[01] [Kabul Verstek] Cerai (Format Lengkap)" SUDAH memuat 15
 * paragraf "Menimbang". Kerangkanya berdiri; yang kosong hanya variabel
 * bernomor. Dan variabel pertimbangan yang tampak menunggu - 8523 (kuasa),
 * 8524 (PNS/TNI/Polri), 8526 (ghaib/biasa) - bertipe data_sql: ABT
 * MENGHITUNGNYA SENDIRI dari data perkara. Menyusunnya lagi berarti menimpa
 * pekerjaan yang sudah benar.
 *
 * Yang sungguh dikerjakan tangan, diurutkan menurut berapa kali diisi:
 *
 *   1214  Alat-alat bukti CG/CT          2.025 pengisian  <- terbanyak, jauh
 *   5105  Alamat tempat menikah            721
 *   1002  Status pihak sebelum nikah       708
 *   1214 dua setengah kali lipat yang kedua.
 *
 * Jadi inilah sasarannya: DAFTAR ALAT BUKTI. Bukan karena ia bagian
 * pertimbangan yang paling penting, melainkan karena ia bagian yang paling
 * banyak menghabiskan waktu orang - dan bentuknya paling berpola.
 *
 * ============================================================================
 * YANG ADA DI SIPP, DAN YANG TIDAK
 * ============================================================================
 *
 * Diukur atas 548 perkara cerai 2026:
 *
 *   nomor identitas pihak         548 / 548
 *   nomor kutipan akta nikah      548 / 548
 *   tanggal kutipan akta nikah    548 / 548
 *   KUA tempat nikah              543 / 548
 *
 *   TANGGAL TERBIT KTP              tidak ada kolomnya sama sekali
 *   alat bukti lain (P.3 dst)       perkara_barang_bukti_perdata = 0 baris
 *
 * Dua yang terakhir itu yang menentukan seluruh watak agen ini: ia TIDAK
 * DAPAT menyusun daftar bukti yang lengkap, dan tidak boleh berpura-pura
 * dapat. Tanggal terbit KTP ditulis sebagai LUBANG yang harus diisi orang,
 * bukan ditebak dari tanggal lain yang kebetulan ada.
 *
 * ============================================================================
 * KENAPA IA TIDAK PERNAH MENYIMPAN SENDIRI
 * ============================================================================
 *
 * Daftar alat bukti adalah pernyataan bahwa selembar surat SUDAH dicocokkan
 * dengan aslinya, SUDAH bermeterai, SUDAH di-nazegelen, dan SUDAH diparaf
 * Ketua Majelis. Itu bukan fakta yang tersimpan di basis data mana pun - itu
 * kesaksian tentang apa yang terjadi di ruang sidang.
 *
 * Mesin dapat menyusun kalimatnya. Mesin tidak dapat menyaksikannya. Karena
 * itu berkas ini tidak punya satu pun fungsi yang menulis, layanannya tidak
 * punya satu pun INSERT, dan rutenya hanya GET - dan ada penjaga yang menuntut
 * ketiganya tetap begitu.
 */

/** Nama bulan Indonesia untuk penanggalan naskah putusan. */
const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/**
 * Penanda lubang yang harus diisi orang.
 *
 * Sengaja mencolok dan sengaja TIDAK berupa tanggal atau angka yang masuk
 * akal: lubang yang menyamar sebagai isi adalah lubang yang lolos ke putusan.
 */
export const LUBANG = "[…]";

export type Pihak = {
  nama: string;
  nomorIdentitas: string;
  /** "Penggugat" / "Pemohon" - dipakai memberi tanda P atau T. */
  peran: string;
};

export type DataNikah = {
  nomorKutipan: string;
  tanggalKutipan: string | null;
  kuaTempatNikah: string;
};

export type FaktaBukti = {
  nomorPerkara: string;
  jenisPerkara: string;
  penggugat: Pihak | null;
  nikah: DataNikah | null;
  /** Wilayah penerbit KTP, mis. "Kabupaten Donggala, Provinsi Sulawesi Tengah". */
  wilayahKtp?: string;
};

export type ButirBukti = {
  /** "P.1", "P.2", ... */
  tanda: string;
  kalimat: string;
  /** Medan yang tidak terbaca dari SIPP dan harus diisi orang. */
  lubang: string[];
  sumber: string;
};

export type DrafBukti = {
  nomorPerkara: string;
  butir: ButirBukti[];
  /** Benar hanya bila tidak ada satu pun lubang pada seluruh butir. */
  lengkap: boolean;
  /** Seluruh lubang, digabung - dipakai layar untuk memberi tahu apa yang kurang. */
  lubang: string[];
  teks: string;
  /** Selalu benar. Ada penjaganya; lihat catatan kepala berkas. */
  hanyaDraf: true;
};

/** "21 Juni 2016" dari ISO. Kosong bila tidak terbaca. */
export function tanggalNaskah(iso: string | null | undefined): string {
  if (!iso) return "";
  const cocok = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!cocok) return "";
  const bulan = BULAN[Number(cocok[2]) - 1];
  if (!bulan) return "";
  return `${Number(cocok[3])} ${bulan} ${cocok[1]}`;
}

/**
 * Ekor baku yang menutup tiap butir alat bukti surat.
 *
 * Disalin apa adanya dari 2.025 pengisian sungguhnya di ABT - termasuk
 * "di-nazegelen" dengan tanda hubungnya. Menulis ulang dengan kata-kata
 * sendiri akan membuat putusan satker ini tidak lagi seragam dengan putusan
 * yang sudah terbit, dan keseragaman itu bukan selera - ia yang membuat
 * salinan lama dan baru dapat dibandingkan.
 */
export const EKOR_BUKTI_SURAT =
  "bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah " +
  "dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda %TANDA% " +
  "serta diberi tanggal dan paraf oleh Ketua Majelis;";

function ekor(tanda: string): string {
  return EKOR_BUKTI_SURAT.replace("%TANDA%", tanda);
}

/**
 * P.1 - Kartu Tanda Penduduk.
 *
 * TANGGAL TERBIT KTP TIDAK ADA DI SIPP, dan itu bukan kelalaian pengisian -
 * kolomnya memang tidak pernah dibuat. Ia ditulis sebagai lubang.
 *
 * Godaan yang harus ditolak: memakai tanggal pendaftaran perkara, atau
 * tanggal lahir, atau tanggal apa pun yang kebetulan tersedia. Tanggal yang
 * salah pada daftar alat bukti lebih buruk daripada lubang yang jelas -
 * lubang dibaca dan diisi; tanggal yang salah dibaca dan dipercaya.
 */
export function butirKtp(fakta: FaktaBukti): ButirBukti | null {
  const p = fakta.penggugat;
  if (!p || !p.nama.trim()) return null;

  const lubang: string[] = [];
  const nik = p.nomorIdentitas.trim();
  if (!nik) lubang.push("NIK");
  const tanggal = LUBANG;
  lubang.push("tanggal terbit KTP");
  const wilayah = (fakta.wilayahKtp || "").trim() || LUBANG;
  if (wilayah === LUBANG) lubang.push("wilayah penerbit KTP");

  const kalimat =
    `Fotokopi Kartu Tanda Penduduk Elektronik (KTP-el) atas nama ${p.nama.trim()}, ` +
    `NIK ${nik || LUBANG} tanggal ${tanggal} yang dikeluarkan oleh Pemerintah ` +
    `${wilayah}, ${ekor("P.1")}`;

  return { tanda: "P.1", kalimat, lubang, sumber: "SIPP: pihak (nama, nomor identitas)" };
}

/**
 * P.2 - Kutipan Akta Nikah.
 *
 * Satu-satunya butir yang dapat disusun UTUH dari SIPP: nomor, tanggal, dan
 * KUA-nya lengkap pada 548 dari 548 perkara cerai 2026 (KUA pada 543).
 */
export function butirAktaNikah(fakta: FaktaBukti): ButirBukti | null {
  const n = fakta.nikah;
  if (!n) return null;

  const lubang: string[] = [];
  const nomor = n.nomorKutipan.trim();
  if (!nomor) lubang.push("nomor kutipan akta nikah");
  const tanggal = tanggalNaskah(n.tanggalKutipan);
  if (!tanggal) lubang.push("tanggal kutipan akta nikah");
  const kua = n.kuaTempatNikah.trim();
  if (!kua) lubang.push("KUA tempat nikah");

  const kalimat =
    `Fotokopi Kutipan Akta Nikah, Nomor ${nomor || LUBANG} tanggal ${tanggal || LUBANG}, ` +
    `yang dikeluarkan oleh ${kua || LUBANG}, ${ekor("P.2")}`;

  return {
    tanda: "P.2",
    kalimat,
    lubang,
    sumber: "SIPP: perkara_data_pernikahan",
  };
}

/**
 * Menyusun draf daftar alat bukti surat.
 *
 * Hanya bukti yang SIPP benar-benar tahu. Perkara dengan bukti tambahan -
 * P.3 dan seterusnya - tetap harus dilanjutkan orang; perkara_barang_bukti
 * dan perkara_barang_bukti_perdata nol baris pada satker ini, jadi tidak ada
 * yang dapat dibaca dari sana.
 */
export function susunDrafBukti(fakta: FaktaBukti): DrafBukti {
  const butir = [butirKtp(fakta), butirAktaNikah(fakta)].filter(
    (x): x is ButirBukti => x !== null
  );
  const lubang = [...new Set(butir.flatMap((b) => b.lubang))];

  const teks = butir.map((b) => b.kalimat).join("\n");

  return {
    nomorPerkara: fakta.nomorPerkara,
    butir,
    lengkap: lubang.length === 0,
    lubang,
    teks,
    hanyaDraf: true,
  };
}

/**
 * Keterangan yang mendampingi draf di layar.
 *
 * Ditulis sebagai kalimat, bukan sebagai kode keadaan, sebab yang membacanya
 * harus tahu APA yang kurang - bukan hanya bahwa ada yang kurang.
 */
export function keteranganDraf(draf: DrafBukti): string {
  if (draf.butir.length === 0) {
    return "Tidak ada alat bukti yang dapat disusun dari SIPP untuk perkara ini.";
  }
  const pokok =
    `${draf.butir.length} alat bukti surat disusun dari data SIPP ` +
    `(${draf.butir.map((b) => b.tanda).join(", ")}).`;
  if (draf.lengkap) {
    return `${pokok} Periksa dan lengkapi bukti lain sebelum diterapkan.`;
  }
  return (
    `${pokok} Yang BELUM terbaca dari SIPP dan harus Anda isi: ` +
    `${draf.lubang.join(", ")}. Tandanya ${LUBANG} pada teks.`
  );
}
