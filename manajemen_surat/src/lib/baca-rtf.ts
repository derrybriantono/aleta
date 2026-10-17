/**
 * PEMBACAAN BERKAS RTF - menjadi teks biasa, tanpa satu pun pustaka.
 *
 * ============================================================================
 * KENAPA RTF, BUKAN PDF - PADAHAL KEDUANYA ADA
 * ============================================================================
 *
 * Naskah putusan selalu lahir sebagai RTF dari templat satker, dan PDF-nya
 * dicetak DARI rtf itu. Membaca PDF-nya berarti membaca turunan, dan
 * turunannya kehilangan satu hal yang tidak dapat dipulihkan: batas paragraf.
 *
 * Diukur pada putusan 492/Pdt.G/2026/PA.Dgl, berkas yang sama:
 *
 *   RTF   20.973 aksara   151 baris   nol pustaka
 *   PDF   21.611 aksara   417 baris   pdfjs + 3 rintisan peramban
 *
 * 151 baris RTF adalah 151 PARAGRAF. 417 baris PDF adalah baris CETAK -
 * satu paragraf pertimbangan terpecah menjadi lima atau enam potongan, dan
 * menyambungnya kembali menuntut terkaan. Terkaan yang salah pada putusan
 * berarti satu pertimbangan hukum tersambung ke pertimbangan berikutnya.
 *
 * PDF juga membawa perabot halamannya: 13 kali "1 dari 13 Halaman" dan 13
 * kali "Putusan Nomor ..." yang bukan bagian naskah sama sekali. RTF hanya
 * memuatnya sekali, di kepala berkas.
 *
 * ============================================================================
 * RTF ITU TEKS, DAN ITULAH SEBABNYA TIDAK ADA PUSTAKA DI SINI
 * ============================================================================
 *
 * RTF adalah teks biasa dengan kata kendali berawalan garis miring terbalik.
 * Yang dituntut untuk memetik naskahnya hanya mesin keadaan kecil: melacak
 * kurung kurawal, membuang kelompok yang memang bukan naskah, dan
 * menerjemahkan segelintir kata kendali yang menghasilkan huruf.
 *
 * Menambah kebergantungan untuk pekerjaan sebesar ini berarti menambah satu
 * hal lagi yang harus dibangun ulang di peladen, dipindai keamanannya, dan
 * ditambal tiap tahun - untuk menggantikan dua ratus baris yang tidak pernah
 * berubah sebab bentuk RTF-nya sendiri sudah berhenti berubah sejak 2008.
 */

/**
 * Kelompok yang isinya BUKAN naskah - dibuang seluruhnya beserta anaknya.
 *
 * Tabel fon dan tabel warna memuat nama yang terbaca manusia ("Times New
 * Roman", "SimSun"). Tanpa daftar ini, nama-nama itu ikut masuk ke naskah
 * putusan sebagai kalimat pembuka yang tidak pernah ditulis siapa pun.
 */
const BUKAN_NASKAH = new Set([
  "fonttbl",
  "colortbl",
  "stylesheet",
  "listtable",
  "listoverridetable",
  "rsidtbl",
  "generator",
  "info",
  "pict",
  "object",
  "themedata",
  "colorschememapping",
  "latentstyles",
  "datastore",
  "xmlnstbl",
  "wgrffmtfilter",
  "template",
  "filetbl",
  "revtbl",
  "background",
  "shppict",
  "nonshppict",
  "fchars",
  "lchars",
  "upr",
  "header",
  "headerl",
  "headerr",
  "headerf",
  "footer",
  "footerl",
  "footerr",
  "footerf",
]);

/**
 * cp1252 pada rentang 0x80-0x9F.
 *
 * Hanya rentang inilah yang berbeda dari latin-1; sisanya sama persis. Yang
 * terpenting di sini tanda kutip miring (0x91-0x94): templat putusan memakai
 * "ba'in" dan "syar'i" dengan apostrof miring, dan tanpa peta ini keduanya
 * terbaca sebagai aksara kendali.
 */
export const CP1252: Record<number, string> = {
  0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…",
  0x86: "†", 0x87: "‡", 0x88: "ˆ", 0x89: "‰", 0x8a: "Š",
  0x8b: "‹", 0x8c: "Œ", 0x8e: "Ž", 0x91: "‘", 0x92: "’",
  0x93: "“", 0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—",
  0x98: "˜", 0x99: "™", 0x9a: "š", 0x9b: "›", 0x9c: "œ",
  0x9e: "ž", 0x9f: "Ÿ",
};

type Keadaan = {
  /** Jumlah aksara cadangan yang mengikuti tiap \u dan harus dilewati. */
  uc: number;
  /** Kelompok ini bukan naskah - apa pun di dalamnya tidak ditulis. */
  buang: boolean;
};

/** Apakah bita-bita ini benar-benar RTF? Diperiksa sebelum diurai. */
export function tampakRtf(isi: string): boolean {
  return /^\s*\{\s*\\rtf\d/.test(isi.slice(0, 200));
}

/**
 * Mengubah bita berkas RTF menjadi teks biasa.
 *
 * Masukannya string yang SUDAH didekode sebagai latin-1 (satu bita satu
 * aksara). Itu disengaja: penguraian RTF bekerja pada bita, dan mendekodenya
 * lebih dulu sebagai UTF-8 akan merusak larian \'xx sebelum sempat dibaca.
 * Lihat bacaRtfDariBita di bawah untuk jalur yang menerima bita apa adanya.
 */
export function bacaRtf(isi: string): string {
  const keluar: string[] = [];
  const tumpuk: Keadaan[] = [{ uc: 1, buang: false }];
  let keadaan = tumpuk[0];
  let lewati = 0;
  let i = 0;

  const tulis = (teks: string) => {
    if (keadaan.buang || !teks) return;
    if (lewati > 0) {
      // Aksara cadangan \u dihitung PER AKSARA, bukan per potongan - satu
      // potongan teks dapat memuat cadangannya sekaligus kata berikutnya.
      const pakai = Math.min(lewati, teks.length);
      lewati -= pakai;
      const sisa = teks.slice(pakai);
      if (!sisa) return;
      keluar.push(sisa);
      return;
    }
    keluar.push(teks);
  };

  while (i < isi.length) {
    const h = isi[i];

    if (h === "{") {
      keadaan = { uc: keadaan.uc, buang: keadaan.buang };
      tumpuk.push(keadaan);
      i += 1;
      continue;
    }

    if (h === "}") {
      tumpuk.pop();
      keadaan = tumpuk[tumpuk.length - 1] ?? { uc: 1, buang: false };
      lewati = 0;
      i += 1;
      continue;
    }

    if (h === "\\") {
      const sesudah = isi[i + 1];

      // Aksara yang dilarikan.
      if (sesudah === "\\" || sesudah === "{" || sesudah === "}") {
        tulis(sesudah);
        i += 2;
        continue;
      }

      // \'xx - satu bita dalam laman kodenya.
      //
      // ====================================================================
      // BITA KENDALI BUKAN AKSARA - DAN POSTGRES MENOLAK SALAH SATUNYA
      // ====================================================================
      //
      // Word menulis definisi daftarnya dengan bita mentah: {\leveltext
      // \'02\'00.;} berarti "dua aksara, yang pertama nomor tingkat 0". Bita
      // \'00 itu penunjuk, bukan huruf - dan pada dua penetapan itsbat nikah
      // (204/Pdt.P/2026) dan dispensasi kawin (180/Pdt.P/2026) ia ikut
      // tertulis 49 dan 32 kali, tepat di belakang tiap tanda butir "-".
      //
      // Akibatnya jauh di hilir: kolom naskah bertipe text, dan Postgres
      // menolak U+0000 dengan 'invalid byte sequence for encoding "UTF8":
      // 0x00'. Rute menjawab 500, dan panel menerjemahkannya sebagai "server
      // ALETA tidak terjangkau" - kalimat yang mengirim orang memeriksa
      // jaringan, padahal jaringannya sehat.
      //
      // Bita di bawah 0x20 selain tab karena itu tidak pernah ditulis. Tidak
      // satu pun di antaranya pernah menjadi bagian naskah putusan.
      if (sesudah === "'") {
        const kode = Number.parseInt(isi.slice(i + 2, i + 4), 16);
        if (!Number.isNaN(kode) && (kode >= 0x20 || kode === 0x09)) {
          tulis(CP1252[kode] ?? String.fromCharCode(kode));
        }
        i += 4;
        continue;
      }

      if (sesudah === "~") {
        tulis(" ");
        i += 2;
        continue;
      }
      // Tanda hubung pilihan dan tanda hubung tetap: tidak menghasilkan
      // aksara yang perlu dibaca.
      if (sesudah === "-" || sesudah === "_") {
        i += 2;
        continue;
      }
      if (sesudah === "*") {
        // {\*\xxx} - kelompok yang boleh diabaikan pembaca yang tidak
        // mengenalinya. Seluruhnya memang bukan naskah.
        keadaan.buang = true;
        i += 2;
        continue;
      }
      if (sesudah === "\n" || sesudah === "\r") {
        tulis("\n");
        i += 2;
        continue;
      }

      // Kata kendali: huruf, boleh diikuti angka bertanda, lalu SATU spasi
      // yang ikut termakan - spasi itu pembatas, bukan isi.
      const cocok = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(isi.slice(i, i + 64));
      if (!cocok) {
        i += 1;
        continue;
      }
      const kata = cocok[1];
      const angka = cocok[2] === undefined ? null : Number(cocok[2]);
      i += cocok[0].length;

      if (BUKAN_NASKAH.has(kata)) {
        keadaan.buang = true;
        continue;
      }

      switch (kata) {
        case "par":
        case "sect":
        case "line":
        case "cell":
        case "row":
          tulis("\n");
          break;
        case "tab":
          tulis("\t");
          break;
        // Apostrof miring: Word menulis nama berapostrof ("Nur'aini") dengan \rquote.
        case "rquote":
          tulis("’");
          break;
        case "lquote":
          tulis("‘");
          break;
        case "uc":
          if (angka !== null) keadaan.uc = angka;
          break;
        case "u": {
          if (angka === null) break;
          tulis(String.fromCharCode(angka < 0 ? angka + 65536 : angka));
          lewati = keadaan.uc;
          break;
        }
        case "bin":
          // Data biner mentah - dilompati apa adanya, sebab isinya bukan teks
          // dan menguraikannya sebagai kata kendali menghasilkan sampah.
          if (angka && angka > 0) i += angka;
          break;
        default:
          break;
      }
      continue;
    }

    if (h === "\r" || h === "\n") {
      // Baris baru MENTAH di dalam RTF bukan paragraf - ia hanya membungkus
      // berkasnya supaya barisnya tidak terlalu panjang. Yang menandai
      // paragraf hanya \par.
      i += 1;
      continue;
    }

    let j = i;
    while (
      j < isi.length &&
      isi[j] !== "\\" &&
      isi[j] !== "{" &&
      isi[j] !== "}" &&
      isi[j] !== "\r" &&
      isi[j] !== "\n"
    ) {
      j += 1;
    }
    tulis(isi.slice(i, j));
    i = j;
  }

  return rapikan(keluar.join(""));
}

/** Jalur yang menerima bita berkas apa adanya. */
export function bacaRtfDariBita(bita: Uint8Array): string {
  let latin = "";
  // Dipotong supaya String.fromCharCode tidak menerima ratusan ribu argumen
  // sekaligus - berkas putusan 195 KB akan melampaui batas tumpukan.
  const POTONG = 8192;
  for (let i = 0; i < bita.length; i += POTONG) {
    latin += String.fromCharCode(...bita.subarray(i, i + POTONG));
  }
  return bacaRtf(latin);
}

/**
 * Merapikan hasil penguraian.
 *
 * Spasi tak terputus dijadikan spasi biasa: ia tampak sama di layar tetapi
 * tidak pernah cocok dengan pola pencarian mana pun, dan judul bagian yang
 * memuatnya akan luput dikenali pemecah naskah.
 */
function rapikan(teks: string): string {
  return teks
    // Aksara kendali yang lolos lewat jalan lain - \u0, misalnya - dibuang di
    // sini juga. Satu pun tidak pernah menjadi naskah, dan U+0000 di antaranya
    // ditolak Postgres. Baris baru dan tab bukan kendali di sini; keduanya
    // justru batas yang dijaga pembaca ini.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
