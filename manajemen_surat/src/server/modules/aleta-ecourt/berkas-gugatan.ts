import { inflateRawSync } from "node:zlib";

/**
 * Membaca berkas gugatan yang diunggah, dan memetik isian Data Umum darinya.
 *
 * ============================================================================
 * YANG DIPETIK ADALAH USULAN, BUKAN KEBENARAN
 * ============================================================================
 *
 * Gugatan ditulis manusia, dan tidak ada dua yang bentuknya persis sama.
 * Pemetikan di sini mengenali pola yang lazim - "Nama :", "Umur :", "Agama :" -
 * dan yang tidak dikenali dibiarkan kosong.
 *
 * Karena itu hasilnya SELALU ditampilkan untuk diperiksa sebelum masuk formulir,
 * dan tiap kolom menyebutkan potongan kalimat asalnya. Petikan yang muncul
 * tanpa asal-usul hanya bisa dipercaya atau tidak; petikan yang menyebutkan
 * baris asalnya bisa dicocokkan dalam dua detik.
 *
 * ============================================================================
 * TANPA PUSTAKA BARU
 * ============================================================================
 *
 * .docx adalah berkas ZIP berisi XML - dan Node sudah punya inflateRawSync,
 * sehingga pembacaannya cukup ditulis di sini. .rtf teks biasa dengan kode
 * kendali. .pdf memakai pdfjs-dist yang memang sudah dipakai portal.
 *
 * .doc lama (OLE biner) adalah satu-satunya yang tidak dapat dibaca dengan
 * bersih tanpa pustaka besar. Yang dikerjakan untuknya pemetikan teks apa
 * adanya, dan hasilnya ditandai "kasar" supaya yang membaca tahu ia lebih
 * mungkin meleset - bukan disamakan dengan yang lain.
 */

export type JenisBerkas = "docx" | "doc" | "rtf" | "pdf" | "teks";

export type HasilBaca = {
  jenis: JenisBerkas;
  teks: string;
  kasar: boolean;
  alasan: string;
};

/** Batas ukuran berkas yang mau dibaca. */
export const BATAS_UKURAN_BERKAS = 20 * 1024 * 1024;

/** Batas panjang teks yang diproses, supaya berkas aneh tidak menahan server. */
const BATAS_TEKS = 2 * 1024 * 1024;

export function jenisDariNama(nama: string): JenisBerkas | null {
  const akhiran = String(nama || "").toLowerCase().split(".").pop() || "";
  if (akhiran === "docx") return "docx";
  if (akhiran === "doc") return "doc";
  if (akhiran === "rtf") return "rtf";
  if (akhiran === "pdf") return "pdf";
  if (akhiran === "txt") return "teks";
  return null;
}

// ===========================================================================
// DOCX - ZIP berisi XML
// ===========================================================================

/**
 * Mengambil satu berkas dari dalam ZIP.
 *
 * Dibaca dari DIREKTORI PUSAT di ekor berkas, bukan dengan menyapu kepala
 * tiap entri dari depan. Kepala entri boleh menyatakan ukurannya nol dan
 * menaruh ukuran sebenarnya di belakang datanya - itu sah, dipakai program
 * yang menulis ZIP sambil jalan, dan pembaca yang mempercayai kepala akan
 * membaca nol bita lalu menyimpulkan dokumennya kosong.
 */
function ambilDariZip(data: Buffer, namaDicari: string): Buffer | null {
  // Akhir direktori pusat: tanda PK\5\6, dicari dari belakang.
  let akhir = -1;
  const batasCari = Math.max(0, data.length - 66_000);
  for (let i = data.length - 22; i >= batasCari; i -= 1) {
    if (data.readUInt32LE(i) === 0x06054b50) {
      akhir = i;
      break;
    }
  }
  if (akhir < 0) return null;

  const jumlahEntri = data.readUInt16LE(akhir + 10);
  let posisi = data.readUInt32LE(akhir + 16);

  for (let n = 0; n < jumlahEntri; n += 1) {
    if (posisi + 46 > data.length) return null;
    if (data.readUInt32LE(posisi) !== 0x02014b50) return null;

    const metode = data.readUInt16LE(posisi + 10);
    const ukuranPadat = data.readUInt32LE(posisi + 20);
    const panjangNama = data.readUInt16LE(posisi + 28);
    const panjangTambahan = data.readUInt16LE(posisi + 30);
    const panjangKomentar = data.readUInt16LE(posisi + 32);
    const awalKepala = data.readUInt32LE(posisi + 42);
    const nama = data.toString("utf8", posisi + 46, posisi + 46 + panjangNama);

    if (nama === namaDicari) {
      if (awalKepala + 30 > data.length) return null;
      // Panjang nama dan tambahan pada KEPALA LOKAL bisa berbeda dari yang di
      // direktori pusat - keduanya dibaca dari tempatnya masing-masing.
      const namaLokal = data.readUInt16LE(awalKepala + 26);
      const tambahanLokal = data.readUInt16LE(awalKepala + 28);
      const awalData = awalKepala + 30 + namaLokal + tambahanLokal;
      const isi = data.subarray(awalData, awalData + ukuranPadat);

      if (metode === 0) return Buffer.from(isi);
      if (metode === 8) {
        try {
          return inflateRawSync(isi);
        } catch {
          return null;
        }
      }
      return null;
    }

    posisi += 46 + panjangNama + panjangTambahan + panjangKomentar;
  }

  return null;
}

/**
 * XML dokumen Word menjadi teks biasa.
 *
 * Batas paragraf dan baris dipertahankan sebagai baris baru. Tanpa itu seluruh
 * gugatan menjadi satu baris panjang, dan pemetikan yang mengandalkan "satu
 * keterangan satu baris" akan menyerap seluruh dokumen ke dalam kolom pertama.
 */
function xmlWordKeTeks(xml: string): string {
  return xml
    .replace(/<w:br\s*\/?>/g, "\n")
    .replace(/<w:tab\s*\/?>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// ===========================================================================
// RTF
// ===========================================================================

/**
 * RTF menjadi teks biasa.
 *
 * Kelompok yang memang bukan isi - font, warna, info dokumen - dibuang beserta
 * seluruh isinya; sisanya dilucuti kode kendalinya. Tanpa membuang kelompok
 * itu, nama seluruh fon ikut terbaca sebagai isi dokumen.
 */
const KELOMPOK_BUKAN_ISI = [
  "fonttbl",
  "colortbl",
  "stylesheet",
  "info",
  "pict",
  "listtable",
  "rsidtbl",
  "generator",
  "themedata",
];

/**
 * Membuang kelompok RTF yang bukan isi dokumen, beserta seluruh sarangnya.
 *
 * Dikerjakan dengan menghitung kedalaman kurung, bukan dengan pola. Tabel fon
 * memuat kelompok di dalam kelompok - satu kurung untuk tiap fon - dan pola
 * yang mencoba menirukan sarang selalu meleset pada tingkat berikutnya.
 *
 * Melesetnya tidak gagal dengan jelas: nama seluruh fon ikut terbaca sebagai
 * isi dokumen, lalu "Times New Roman" dipetik sebagai nama pihak berperkara.
 */
function buangKelompokBukanIsi(mentah: string): string {
  let hasil = "";
  let i = 0;

  while (i < mentah.length) {
    if (mentah[i] !== "{") {
      hasil += mentah[i];
      i += 1;
      continue;
    }

    // Kata kendali tepat sesudah kurung buka, dengan \* pilihan di depannya.
    const cocok = mentah.slice(i + 1, i + 40).match(/^\\(?:\*\\)?([a-zA-Z]+)/);
    if (!cocok || !KELOMPOK_BUKAN_ISI.includes(cocok[1])) {
      hasil += mentah[i];
      i += 1;
      continue;
    }

    // Lompati seluruh kelompok ini, sedalam apa pun sarangnya.
    let dalam = 0;
    while (i < mentah.length) {
      const huruf = mentah[i];
      // Kurung yang dilarikan backslash bukan batas kelompok.
      if (huruf === "\\") {
        i += 2;
        continue;
      }
      if (huruf === "{") {
        dalam += 1;
      } else if (huruf === "}") {
        dalam -= 1;
        if (dalam === 0) {
          i += 1;
          break;
        }
      }
      i += 1;
    }
  }

  return hasil;
}

function rtfKeTeks(mentah: string): string {
  const teks = buangKelompokBukanIsi(mentah);

  return teks
    .replace(/\\par[d]?\b/g, "\n")
    .replace(/\\line\b/g, "\n")
    .replace(/\\tab\b/g, "\t")
    // \'e9 dan sejenisnya - huruf beraksen dalam RTF.
    .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\u(-?\d+)\??/g, (_, kode) => String.fromCharCode(Number(kode) & 0xffff))
    .replace(/\\[a-zA-Z]+-?\d*\s?/g, "")
    .replace(/[{}]/g, "");
}

// ===========================================================================
// DOC lama - OLE biner
// ===========================================================================

/**
 * Memetik teks yang terbaca dari .doc lama.
 *
 * Ini SUNGGUH kasar, dan disebut begitu. Berkas .doc menyimpan teksnya di
 * dalam struktur OLE dengan tabel potongan yang membutuhkan pustaka tersendiri
 * untuk dibaca benar. Yang dikerjakan di sini memungut deretan huruf yang
 * masuk akal dan membuang sisanya.
 *
 * Cukup untuk mengenali nama dan alamat pada gugatan yang sederhana; tidak
 * cukup untuk dipercaya tanpa diperiksa. Karena itu hasilnya ditandai kasar,
 * dan papan menampilkannya dengan peringatan.
 */
function docKeTeks(data: Buffer): string {
  const potongan: string[] = [];

  // UTF-16LE lebih dulu: Word menyimpan teksnya begitu sejak Word 97, dan
  // membacanya sebagai satu-bita akan menyelipkan pemisah di antara tiap huruf.
  let jalanUtf16 = "";
  for (let i = 0; i + 1 < data.length; i += 2) {
    const kode = data.readUInt16LE(i);
    if (kode === 13 || kode === 10) {
      if (jalanUtf16.trim().length >= 4) potongan.push(jalanUtf16.trim());
      jalanUtf16 = "";
    } else if (kode >= 32 && kode < 0x2e80) {
      jalanUtf16 += String.fromCharCode(kode);
    } else {
      if (jalanUtf16.trim().length >= 4) potongan.push(jalanUtf16.trim());
      jalanUtf16 = "";
    }
    if (potongan.length > 20000) break;
  }

  return potongan.join("\n");
}

// ===========================================================================
// PEMBACA
// ===========================================================================

export async function bacaBerkas(nama: string, data: Buffer): Promise<HasilBaca> {
  const jenis = jenisDariNama(nama);
  if (!jenis) {
    return { jenis: "teks", teks: "", kasar: false, alasan: "jenis_berkas_tidak_didukung" };
  }
  if (data.length === 0) {
    return { jenis, teks: "", kasar: false, alasan: "berkas_kosong" };
  }
  if (data.length > BATAS_UKURAN_BERKAS) {
    return { jenis, teks: "", kasar: false, alasan: "berkas_terlalu_besar" };
  }

  if (jenis === "teks") {
    return { jenis, teks: data.toString("utf8").slice(0, BATAS_TEKS), kasar: false, alasan: "" };
  }

  if (jenis === "rtf") {
    return {
      jenis,
      teks: rtfKeTeks(data.toString("latin1")).slice(0, BATAS_TEKS),
      kasar: false,
      alasan: "",
    };
  }

  if (jenis === "docx") {
    const isi = ambilDariZip(data, "word/document.xml");
    if (!isi) {
      return { jenis, teks: "", kasar: false, alasan: "docx_tidak_terbaca" };
    }
    return {
      jenis,
      teks: xmlWordKeTeks(isi.toString("utf8")).slice(0, BATAS_TEKS),
      kasar: false,
      alasan: "",
    };
  }

  if (jenis === "doc") {
    // .docx yang tertulis .doc bukan hal aneh - dicoba dulu sebagai ZIP,
    // sebab hasilnya jauh lebih bersih daripada pemetikan kasar.
    const mungkinDocx = ambilDariZip(data, "word/document.xml");
    if (mungkinDocx) {
      return {
        jenis: "docx",
        teks: xmlWordKeTeks(mungkinDocx.toString("utf8")).slice(0, BATAS_TEKS),
        kasar: false,
        alasan: "",
      };
    }
    return { jenis, teks: docKeTeks(data).slice(0, BATAS_TEKS), kasar: true, alasan: "" };
  }

  // --- PDF -----------------------------------------------------------------
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const dokumen = await pdfjs.getDocument({
      data: new Uint8Array(data),
      useSystemFonts: true,
      isEvalSupported: false,
    }).promise;

    const baris: string[] = [];
    const batasHalaman = Math.min(dokumen.numPages, 60);
    for (let n = 1; n <= batasHalaman; n += 1) {
      const halaman = await dokumen.getPage(n);
      const isi = await halaman.getTextContent();
      let jalan = "";
      let yTerakhir: number | null = null;
      for (const bagian of isi.items as Array<{ str?: string; transform?: number[] }>) {
        const y = Array.isArray(bagian.transform) ? Math.round(bagian.transform[5]) : null;
        // Perubahan tinggi berarti baris baru. PDF tidak menyimpan baris sama
        // sekali - tanpa ini seluruh halaman menjadi satu baris.
        if (yTerakhir !== null && y !== null && Math.abs(y - yTerakhir) > 2) {
          baris.push(jalan);
          jalan = "";
        }
        jalan += String(bagian.str || "");
        if (y !== null) yTerakhir = y;
      }
      if (jalan) baris.push(jalan);
    }

    const teks = baris.join("\n").trim();
    if (!teks) {
      // PDF hasil pindaian tidak punya teks sama sekali. Itu bukan kegagalan
      // membaca - itu memang tidak ada yang bisa dibaca, dan disebut begitu.
      return { jenis, teks: "", kasar: false, alasan: "pdf_tanpa_teks_kemungkinan_hasil_pindai" };
    }
    return { jenis, teks: teks.slice(0, BATAS_TEKS), kasar: false, alasan: "" };
  } catch (galat) {
    return {
      jenis,
      teks: "",
      kasar: false,
      alasan: `pdf_tidak_terbaca: ${String((galat as Error).message || galat).slice(0, 120)}`,
    };
  }
}

// ===========================================================================
// PEMETIKAN DATA UMUM
// ===========================================================================

export type Petikan = {
  nilai: string;
  asal: string;
};

/**
 * ============================================================================
 * ISIAN INI MENGIKUTI FORMULIR DATA UMUM DI SIPP, BUKAN KARANGAN SENDIRI
 * ============================================================================
 *
 * Tiap isian di bawah punya kolom yang benar-benar ada di basis data SIPP:
 *
 *   perkara                    tanggal_surat, nomor_surat, posita, petitum,
 *                              nilai_sengketa, pihak_dipublikasikan
 *   perkara_data_pernikahan    tgl_nikah, tgl_kutipan_akta_nikah,
 *                              no_kutipan_akta_nikah, kua_tempat_nikah
 *   perkara_obyek_sengketa     obyek_gugatan
 *   perkara_pihak1 dan kawan   identitas para pihak
 *
 * Sebelumnya yang dipetik hanya identitas penggugat dan petitum - tidak cukup
 * untuk mengisi formulirnya, sehingga petugas tetap harus mengetik sendiri
 * tanggal menikah, nomor kutipan akta nikah, KUA, dan posita. Justru bagian
 * itulah yang paling panjang dan paling sering salah ketik.
 */
export type DataUmum = {
  // --- para pihak -----------------------------------------------------
  penggugat: Petikan | null;
  tergugat: Petikan | null;
  umurPenggugat: Petikan | null;
  agamaPenggugat: Petikan | null;
  pekerjaanPenggugat: Petikan | null;
  pendidikanPenggugat: Petikan | null;
  alamatPenggugat: Petikan | null;
  alamatTergugat: Petikan | null;

  // --- data pernikahan, untuk perkara perkawinan ------------------------
  tanggalMenikah: Petikan | null;
  nomorAktaNikah: Petikan | null;
  tanggalAktaNikah: Petikan | null;
  kuaTempatMenikah: Petikan | null;

  // --- isi gugatan ------------------------------------------------------
  obyekSengketa: Petikan | null;
  posita: Petikan | null;
  petitum: Petikan | null;
  nilaiSengketa: Petikan | null;

  // --- surat gugatan ----------------------------------------------------
  tanggalSurat: Petikan | null;
  nomorSurat: Petikan | null;
};

function rapikan(teks: string): string {
  return String(teks || "")
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Nilai sesudah satu label, pada baris yang sama.
 *
 * Sengaja TIDAK melompat ke baris berikutnya bila barisnya kosong sesudah
 * titik dua. Label yang nilainya di baris lain memang ada, tetapi menebaknya
 * berarti kadang menyerap label BERIKUTNYA sebagai nilai - dan kolom yang
 * terisi salah lebih buruk daripada kolom yang dibiarkan kosong untuk diisi
 * orang.
 */
function nilaiSetelahLabel(baris: string[], pola: RegExp): Petikan | null {
  for (const satuBaris of baris) {
    const cocok = satuBaris.match(pola);
    if (!cocok) continue;
    const nilai = String(cocok[1] || "")
      .replace(/^[\s:.\-—]+/, "")
      .replace(/[;,.]+$/, "")
      .trim();
    if (nilai.length < 2) continue;
    return { nilai: nilai.slice(0, 250), asal: satuBaris.trim().slice(0, 160) };
  }
  return null;
}

/**
 * Nilai sengketa dari kalimat berrupiah.
 *
 * Yang diambil angka TERBESAR yang disebut, bukan yang pertama. Gugatan kerap
 * memerinci beberapa jumlah - kerugian, biaya, bunga - lalu menyebut totalnya;
 * yang pertama disebut hampir tidak pernah nilai sengketanya.
 *
 * Tetap sebuah tebakan, dan karena itu disertai kalimat asalnya.
 */
function petikNilaiSengketa(teks: string): Petikan | null {
  const pola = /Rp\.?\s*([\d.,]{4,})/gi;
  let terbesar = 0;
  let asal = "";

  for (const cocok of teks.matchAll(pola)) {
    const mentah = String(cocok[1] || "");
    // Titik pemisah ribuan Indonesia; koma memisahkan sen dan dibuang.
    const angka = Number(mentah.replace(/\./g, "").replace(/,\d{1,2}$/, "").replace(/,/g, ""));
    if (!Number.isFinite(angka) || angka <= terbesar) continue;
    terbesar = angka;
    const awal = Math.max(0, (cocok.index || 0) - 60);
    asal = teks.slice(awal, (cocok.index || 0) + mentah.length + 20).replace(/\n/g, " ").trim();
  }

  if (terbesar <= 0) return null;
  return { nilai: String(terbesar), asal: asal.slice(0, 160) };
}

/**
 * Memetik isian Data Umum dari teks gugatan.
 *
 * Polanya dibuat longgar pada spasi dan tanda baca, tetapi KETAT pada kata
 * kuncinya: "Nama" harus benar-benar berdiri sebagai label, bukan sebagai
 * bagian kata lain. Pola yang terlalu longgar memetik potongan kalimat dari
 * mana saja, dan hasilnya tampak terisi padahal isinya keliru.
 */
/**
 * ============================================================================
 * DATA PERNIKAHAN DIPETIK DARI KALIMATNYA, BUKAN DARI LABEL
 * ============================================================================
 *
 * Berbeda dari identitas pihak yang ditulis berlabel ("Umur :", "Agama :"),
 * data pernikahan tertulis di dalam kalimat posita nomor satu - dan bentuk
 * kalimatnya cukup baku di seluruh gugatan perceraian:
 *
 *   "Bahwa pada tanggal 06 November 2017, Penggugat dan Tergugat telah
 *    melangsungkan pernikahan yang dicatat oleh Pegawai Pencatat Nikah pada
 *    Kantor Urusan Agama (KUA) Kecamatan Sirenja, Kabupaten Donggala,
 *    Provinsi Sulawesi Tengah, sebagaimana sesuai dengan Kutipan Akta Nikah
 *    Nomor : 287/04/XI/2017, tertanggal 06 November 2017"
 *
 * Satu kalimat itu memuat empat isian yang selama ini diketik ulang tangan:
 * tanggal menikah, KUA tempat menikah, nomor kutipan akta nikah, dan tanggal
 * kutipannya.
 */
const NAMA_BULAN: Record<string, string> = {
  januari: "01",
  februari: "02",
  pebruari: "02",
  maret: "03",
  april: "04",
  mei: "05",
  juni: "06",
  juli: "07",
  agustus: "08",
  september: "09",
  oktober: "10",
  november: "11",
  nopember: "11",
  desember: "12",
};

/**
 * Tanggal Indonesia menjadi bentuk yang dimengerti SIPP.
 *
 * SIPP memakai hari/bulan/tahun pada isian tanggalnya. Mengembalikan bentuk
 * lain berarti isian tanggal menolak diisi tanpa memberi tahu kenapa - dan
 * yang mengisi menyangka nama bulannya yang salah eja.
 *
 * "Nopember" dan "Pebruari" ikut dikenali: keduanya ejaan lama yang masih
 * lazim dipakai dalam berkas pengadilan.
 */
export function tanggalIndonesia(teks: string): string {
  const cocok = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(String(teks || ""));
  if (!cocok) return "";
  const bulan = NAMA_BULAN[cocok[2].toLowerCase()];
  if (!bulan) return "";
  return `${cocok[1].padStart(2, "0")}/${bulan}/${cocok[3]}`;
}

/** Satu petikan beserta potongan kalimat asalnya. */
function petikanDari(nilai: string, asal: string): Petikan | null {
  const bersih = String(nilai || "").trim();
  if (bersih.length < 2) return null;
  return { nilai: bersih.slice(0, 300), asal: String(asal || "").replace(/\n/g, " ").trim().slice(0, 180) };
}

/**
 * Data pernikahan dari kalimat pertama posita.
 *
 * Dicari pada SELURUH teks, bukan per baris: kalimatnya kerap terpotong
 * beberapa baris pada dokumen yang paragrafnya panjang, dan pencarian per
 * baris akan kehilangan separuhnya.
 */
function petikPernikahan(teks: string) {
  const satuBaris = teks.replace(/\s+/g, " ");

  // --- tanggal menikah ---------------------------------------------------
  //
  // Yang dicari tanggal yang MENDAHULUI kata "menikah" atau "pernikahan",
  // bukan tanggal pertama di dokumen - tanggal pertama biasanya tanggal
  // surat gugatannya sendiri.
  let tanggalMenikah: Petikan | null = null;
  const nikah = /(?:pada\s+)?tanggal\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})[^.]{0,160}?(?:melangsungkan\s+pernikahan|menikah|melangsungkan\s+perkawinan)/i.exec(
    satuBaris
  );
  if (nikah) {
    const iso = tanggalIndonesia(nikah[1]);
    tanggalMenikah = petikanDari(iso || nikah[1], nikah[0]);
  }

  // --- nomor dan tanggal kutipan akta nikah ------------------------------
  let nomorAktaNikah: Petikan | null = null;
  let tanggalAktaNikah: Petikan | null = null;
  const akta = /Kutipan\s+Akta\s+Nikah\s*(?:Nomor|No\.?)?\s*[:.]?\s*([0-9A-Za-z/.\-]{4,40})([^.]{0,80})/i.exec(
    satuBaris
  );
  if (akta) {
    nomorAktaNikah = petikanDari(akta[1].replace(/[.,;]+$/, ""), akta[0]);
    const tertanggal = /tertanggal\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i.exec(akta[2] || "");
    if (tertanggal) {
      const iso = tanggalIndonesia(tertanggal[1]);
      tanggalAktaNikah = petikanDari(iso || tertanggal[1], tertanggal[0]);
    }
  }

  // --- KUA tempat menikah ------------------------------------------------
  //
  // Diambil sampai koma ketiga: bentuk bakunya "Kecamatan X, Kabupaten Y,
  // Provinsi Z". Mengambil sampai titik akan menyeret sisa kalimatnya, dan
  // isian KUA di SIPP adalah daftar tertutup yang tidak menerima kalimat.
  let kuaTempatMenikah: Petikan | null = null;
  const kua = /Kantor\s+Urusan\s+Agama\s*(?:\(KUA\))?\s*((?:Kecamatan|Kec\.?)\s+[^,]{2,60},\s*[^,]{2,60},\s*[^,.;]{2,60})/i.exec(
    satuBaris
  );
  if (kua) {
    kuaTempatMenikah = petikanDari(`KUA ${kua[1].trim()}`, kua[0]);
  }

  return { tanggalMenikah, nomorAktaNikah, tanggalAktaNikah, kuaTempatMenikah };
}

/**
 * Posita: seluruh dalil bernomor, dari "Bahwa" pertama sampai sebelum petitum.
 *
 * Inilah bagian terpanjang formulir Data Umum, dan yang paling melelahkan
 * diketik ulang. Batas bawahnya kata "PETITUM", "Primer", atau "Mengadili" -
 * tanpa batas itu seluruh petitum ikut terserap ke dalam posita, dan
 * keduanya isian yang berbeda di SIPP.
 */
function petikPosita(teks: string): Petikan | null {
  const mulai = teks.search(/^\s*(?:1[.)]\s*)?Bahwa\b/im);
  if (mulai < 0) return null;

  const sisa = teks.slice(mulai);
  const batas = sisa.search(/\n\s*(?:PETITUM|Primer\b|Maka\b|Mengadili\b|Berdasarkan\s+hal)/i);
  const potong = (batas > 0 ? sisa.slice(0, batas) : sisa).trim();
  if (potong.length < 20) return null;

  return {
    // Posita boleh panjang - ia memang isian panjang di SIPP. Dibatasi jauh
    // lebih longgar daripada isian lain.
    nilai: potong.slice(0, 12000),
    asal: potong.replace(/\n/g, " ").slice(0, 180),
  };
}

/**
 * Obyek sengketa gugatan.
 *
 * Untuk perkara perkawinan isinya baku - "Pernikahan / perceraian" - dan itu
 * disimpulkan dari jenis dalilnya, bukan dicari sebagai label yang memang
 * hampir tidak pernah ditulis dalam gugatan.
 *
 * Yang tidak dikenali dibiarkan kosong. Menebak obyek sengketa pada perkara
 * harta bersama atau ekonomi syariah akan mengisi kolom yang menentukan
 * dengan tebakan.
 */
function petikObyekSengketa(teks: string): Petikan | null {
  const cocok = /\b(?:cerai\s+gugat|cerai\s+talak|perceraian|talak\s+satu|ba.?in\s+sughra)\b/i.exec(teks);
  if (cocok) return { nilai: "Pernikahan / perceraian", asal: cocok[0] };

  const harta = /\bharta\s+bersama\b/i.exec(teks);
  if (harta) return { nilai: "Harta bersama", asal: harta[0] };

  return null;
}

export function petikDataUmum(teksMentah: string): DataUmum {
  const teks = rapikan(teksMentah);
  const baris = teks.split("\n").filter((x) => x.trim().length > 0);

  const label = (kata: string) => new RegExp(`^\\s*${kata}\\s*[:：]\\s*(.+)$`, "i");

  // Penggugat dan tergugat dicari dari sebutannya sendiri lebih dulu, sebab
  // gugatan menyebut keduanya dengan nama peran, bukan dengan label "Nama".
  const penggugat =
    nilaiSetelahLabel(baris, label("(?:nama\\s+)?(?:penggugat|pemohon)(?:\\s+I+)?")) ||
    nilaiSetelahLabel(baris, label("nama"));

  const tergugat = nilaiSetelahLabel(
    baris,
    label("(?:nama\\s+)?(?:tergugat|termohon)(?:\\s+I+)?")
  );

  return {
    penggugat,
    tergugat,
    umurPenggugat: nilaiSetelahLabel(baris, label("(?:umur|usia)")),
    agamaPenggugat: nilaiSetelahLabel(baris, label("agama")),
    pekerjaanPenggugat: nilaiSetelahLabel(baris, label("pekerjaan")),
    pendidikanPenggugat: nilaiSetelahLabel(baris, label("pendidikan")),
    alamatPenggugat: nilaiSetelahLabel(baris, label("(?:alamat|tempat\\s+tinggal|bertempat\\s+tinggal)")),
    // Alamat kedua: yang muncul sesudah alamat pertama, bila ada.
    alamatTergugat: (() => {
      let sudah = false;
      for (const satuBaris of baris) {
        const cocok = satuBaris.match(label("(?:alamat|tempat\\s+tinggal)"));
        if (!cocok) continue;
        if (!sudah) {
          sudah = true;
          continue;
        }
        const nilai = String(cocok[1] || "").replace(/[;,.]+$/, "").trim();
        if (nilai.length < 2) continue;
        return { nilai: nilai.slice(0, 250), asal: satuBaris.trim().slice(0, 160) };
      }
      return null;
    })(),
    nilaiSengketa: petikNilaiSengketa(teks),

    // --- data pernikahan, dari kalimat pertama posita ---------------------
    ...petikPernikahan(teks),

    // --- isi gugatan -------------------------------------------------------
    obyekSengketa: petikObyekSengketa(teks),
    posita: petikPosita(teks),
    petitum: (() => {
      const mulai = teks.search(/\b(?:petitum|primer|mengadili|memohon\s+kepada)\b/i);
      if (mulai < 0) return null;
      const potong = teks.slice(mulai, mulai + 4000).trim();
      return { nilai: potong.slice(0, 4000), asal: potong.replace(/\n/g, " ").slice(0, 180) };
    })(),

    // --- surat gugatan -----------------------------------------------------
    //
    // Tanggal surat kerap tertulis di kepala gugatan: "Donggala, 28 Juli 2026".
    // Dicari pada dua puluh baris pertama saja - tanggal di tengah dokumen
    // hampir selalu tanggal peristiwa, bukan tanggal suratnya.
    tanggalSurat: (() => {
      const kepala = baris.slice(0, 20).join("\n");
      const cocok = /(?:^|\n)\s*[A-Za-z .]{3,30},\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/.exec(kepala);
      if (!cocok) return null;
      const iso = tanggalIndonesia(cocok[1]);
      return petikanDari(iso || cocok[1], cocok[0]);
    })(),
    nomorSurat: nilaiSetelahLabel(baris, label("(?:nomor|no\\.?)\\s*(?:surat)?")),
  };
}
