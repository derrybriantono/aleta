/**
 * PEMECAH PERATURAN - naskah menjadi pasal dan ayat.
 *
 * ============================================================================
 * NASKAHNYA DARI BERKAS ASLINYA, TIDAK PERNAH DIKETIK ULANG
 * ============================================================================
 *
 * Modul ini MEMOTONG naskah yang sudah dibaca dari berkas resminya - ia tidak
 * menulis, melengkapi, maupun memperbaiki satu huruf pun.
 *
 * Itu bukan kehati-hatian berlebihan. Pustaka hukum yang memuat satu pasal
 * yang diketik dari ingatan tidak salah sekali, melainkan salah di SETIAP
 * putusan yang merujuknya - dengan rapi, meyakinkan, dan tanpa ada yang
 * memeriksanya lagi karena "sudah ada di pustaka".
 *
 * ============================================================================
 * YANG TIDAK DIKENALI TIDAK DIBUANG
 * ============================================================================
 *
 * Baris yang tidak cocok dengan satu pun pola TETAP masuk, sebagai bagian dari
 * pasal terakhir yang dikenali. Naskah peraturan memuat penjelasan, tabel,
 * lampiran, dan catatan kaki yang tidak berbentuk pasal - membuangnya berarti
 * pustaka menyimpan naskah yang lebih pendek daripada aslinya, dan tidak ada
 * yang menyadarinya sampai ada yang mencari bagian yang hilang.
 */

export type JenisBagian = "bab" | "bagian" | "paragraf" | "pasal" | "ayat" | "huruf" | "pembuka" | "penutup";

export type BagianPeraturan = {
  jenis: JenisBagian;
  /** Nomornya sebagaimana tertulis: "39", "IX", "2", "a". */
  nomor: string;
  /** Judul bab atau bagian; pasal biasanya tidak berjudul. */
  judul: string;
  isi: string;
  /** Halaman berkas asal, untuk ditelusuri kembali. */
  halaman: number;
  /** Urutan mutlak di dalam naskah - dipakai menyusun ulang tanpa menebak. */
  urutan: number;
  /** Urutan induknya; -1 bila tidak berinduk. */
  indukUrutan: number;
  /**
   * Bagian ini berada di dalam PENJELASAN, bukan batang tubuh.
   *
   * Penjelasan mengulang seluruh nomor pasal. Tanpa penanda ini, "Pasal 2"
   * ada dua kali dengan alamat yang sama - dan rujukan putusan akan membuka
   * penjelasannya, bukan pasalnya, tanpa ada yang menyadarinya.
   */
  penjelasan: boolean;
};

/**
 * Pola pembuka tiap jenis bagian.
 *
 * Ditulis longgar dengan sengaja: naskah resmi ditata ulang berkali-kali oleh
 * penerbit yang berbeda, dan pola yang menuntut bentuk persis akan gagal pada
 * berkas yang sama isinya tetapi berbeda tata letaknya.
 */
const POLA = {
  // BAB I, BAB IX, BAB XIII - angka Romawi.
  bab: /^BAB\s+([IVXLCDM]+)\b\s*(.*)$/i,
  // Bagian Kesatu, Bagian Kedua - dieja, bukan berangka.
  bagian: /^BAGIAN\s+(\S+)\s*(.*)$/i,
  paragraf: /^PARAGRAF\s+(\S+)\s*(.*)$/i,
  // Pasal 39, Pasal 19 huruf f, Pasal 116.
  pasal: /^PASAL\s+(\d+[A-Za-z]?)\b\s*(.*)$/i,
  // (1), (2) di awal baris - ayat.
  ayat: /^\((\d+[a-z]?)\)\s*(.*)$/,
  // a. b. c. di awal baris - huruf. Dituntut diikuti spasi supaya "a.n."
  // dan singkatan lain tidak ikut terpotong.
  huruf: /^([a-z])\.\s+(.*)$/,
};

function bersih(baris: string): string {
  return baris.replace(/\s+/g, " ").trim();
}

/**
 * Kepala dan kaki halaman yang berulang - dikenali dari perulangannya sendiri.
 *
 * Naskah resmi mencetak "PRESIDEN REPUBLIK INDONESIA" pada tiap halaman.
 * Membiarkannya masuk berarti bunyi pasal yang melintasi halaman memuat
 * kalimat yang bukan bagian dari pasalnya - dan bunyi itu akan dikutip apa
 * adanya ke dalam putusan.
 *
 * Dikenali dari BERAPA HALAMAN memuatnya, bukan dari daftar nama yang ditulis
 * tangan. Daftar tulisan tangan hanya menangkap penerbit yang sudah dikenal,
 * dan naskah dari penerbit lain akan tercemar dengan cara yang sama.
 */
export function kepalaBerulang(halaman: HalamanNaskah[], batasHalaman = 3): Set<string> {
  const hitungan = new Map<string, number>();

  for (const isi of halaman) {
    // Hanya baris di awal dan akhir halaman yang dianggap calon; kalimat yang
    // kebetulan berulang di tengah naskah adalah isi, bukan hiasan.
    const baris = String(isi.teks ?? "").split("\n").map(bersih).filter(Boolean);
    const calon = [...baris.slice(0, 3), ...baris.slice(-2)];
    for (const teks of new Set(calon)) {
      if (teks.length < 6 || teks.length > 90) continue;
      hitungan.set(teks, (hitungan.get(teks) ?? 0) + 1);
    }
  }

  const ambang = Math.max(batasHalaman, Math.ceil(halaman.length * 0.5));
  return new Set([...hitungan.entries()].filter(([, jumlah]) => jumlah >= ambang).map(([teks]) => teks));
}

/** Baris yang menandai mulainya PENJELASAN atas suatu peraturan. */
const POLA_PENJELASAN = /^PENJELASAN\b/i;

/**
 * Baris yang jelas bukan isi naskah.
 *
 * Nomor halaman berdiri sendiri dan garis pemisah muncul di tiap halaman PDF.
 * Membiarkannya masuk berarti tiap pasal yang melintasi halaman memuat angka
 * yang bukan bagian dari bunyinya - dan bunyi pasal yang tercemar angka
 * halaman akan dikutip apa adanya ke dalam putusan.
 */
function barisHiasan(baris: string): boolean {
  const teks = bersih(baris);
  if (!teks) return false;
  if (/^-?\s*\d{1,4}\s*-?$/.test(teks)) return true;
  if (/^[-–—_.·]{3,}$/.test(teks)) return true;
  return false;
}

/** Angka Romawi menjadi angka biasa, untuk mengurutkan bab. */
export function romawiKeAngka(romawi: string): number {
  const nilai: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  const huruf = romawi.toUpperCase().split("");
  let hasil = 0;
  for (let i = 0; i < huruf.length; i += 1) {
    const sekarang = nilai[huruf[i]] ?? 0;
    const berikut = nilai[huruf[i + 1]] ?? 0;
    hasil += sekarang < berikut ? -sekarang : sekarang;
  }
  return hasil;
}

export type HalamanNaskah = { nomor: number; teks: string };

/**
 * Memecah naskah peraturan menjadi bagian-bagiannya.
 *
 * Masukannya naskah PER HALAMAN - itulah yang dihasilkan pembaca PDF - supaya
 * tiap bagian dapat menyebut halaman asalnya. Pasal yang melintasi dua halaman
 * mencatat halaman tempat ia DIMULAI, karena di situlah orang mencarinya.
 */
export function pecahPeraturan(halaman: HalamanNaskah[]): BagianPeraturan[] {
  const hasil: BagianPeraturan[] = [];
  let urutan = 0;

  // Kepala halaman yang berulang dibuang, dan sekali naskah masuk PENJELASAN
  // seluruh sisanya ditandai penjelasan.
  const hiasanBerulang = kepalaBerulang(halaman);
  let diPenjelasan = false;

  /**
   * Nomor pasal tertinggi yang sudah dilewati, per bagian naskah.
   *
   * Dihitung terpisah untuk batang tubuh dan penjelasan: penjelasan memulai
   * penomorannya dari Pasal 1 lagi, dan menyatukan keduanya akan membuat
   * seluruh penjelasan terbaca sebagai rujukan silang.
   */
  const pasalTertinggi = { batangTubuh: { angka: 0, akhiran: "" }, penjelasan: { angka: 0, akhiran: "" } };

  /** Nomor pasal maju dari yang terakhir - "19a" dianggap maju dari "19". */
  function majuDariPasalTerakhir(nomor: string): boolean {
    const cocok = String(nomor).match(/^(\d+)([A-Za-z]?)$/);
    if (!cocok) return true;

    const angka = Number(cocok[1]);
    const akhiran = (cocok[2] ?? "").toLowerCase();
    const catatan = diPenjelasan ? pasalTertinggi.penjelasan : pasalTertinggi.batangTubuh;

    const maju = angka > catatan.angka || (angka === catatan.angka && akhiran > catatan.akhiran);
    if (maju) {
      catatan.angka = angka;
      catatan.akhiran = akhiran;
    }
    return maju;
  }

  // Induk berjenjang: bab memuat bagian, bagian memuat pasal, pasal memuat
  // ayat, ayat memuat huruf. Yang disimpan urutan induknya, bukan objeknya -
  // sehingga bagian dapat dikirim sebagai daftar datar tanpa kehilangan
  // susunannya.
  const induk: Partial<Record<JenisBagian, number>> = {};

  const JENJANG: Record<JenisBagian, JenisBagian | null> = {
    bab: null,
    bagian: "bab",
    paragraf: "bagian",
    pasal: "paragraf",
    ayat: "pasal",
    huruf: "ayat",
    pembuka: null,
    penutup: null,
  };

  function cariInduk(jenis: JenisBagian): number {
    let calon = JENJANG[jenis];
    while (calon) {
      const ada = induk[calon];
      if (ada !== undefined) return ada;
      calon = JENJANG[calon];
    }
    return -1;
  }

  function mulai(jenis: JenisBagian, nomor: string, judul: string, isi: string, nomorHalaman: number) {
    const bagian: BagianPeraturan = {
      jenis,
      nomor,
      judul: bersih(judul),
      isi: bersih(isi),
      halaman: nomorHalaman,
      urutan,
      indukUrutan: cariInduk(jenis),
      penjelasan: diPenjelasan,
    };
    hasil.push(bagian);
    induk[jenis] = urutan;

    // Jenjang di bawahnya dilupakan: pasal baru berarti ayat sebelumnya bukan
    // lagi induk yang berlaku. Tanpa ini, ayat pasal 40 akan berinduk pada
    // ayat terakhir pasal 39.
    const bawahan: JenisBagian[] = Object.keys(JENJANG).filter(
      (kunci) => JENJANG[kunci as JenisBagian] === jenis
    ) as JenisBagian[];
    for (const anak of bawahan) {
      delete induk[anak];
      for (const cucu of Object.keys(JENJANG).filter((k) => JENJANG[k as JenisBagian] === anak)) {
        delete induk[cucu as JenisBagian];
      }
    }

    urutan += 1;
  }

  let terakhir: BagianPeraturan | null = null;

  for (const isiHalaman of halaman) {
    // Baris dibersihkan lebih dulu supaya baris TERAKHIR halaman diketahui -
    // di situlah kata tangkap berada.
    const barisHalaman = String(isiHalaman.teks ?? "")
      .split("\n")
      .map(bersih)
      .filter((teks) => teks && !barisHiasan(teks) && !hiasanBerulang.has(teks));

    for (let nomorBaris = 0; nomorBaris < barisHalaman.length; nomorBaris += 1) {
      const baris = barisHalaman[nomorBaris];

      // KATA TANGKAP: judul halaman berikutnya yang dicetak di kaki halaman ini,
      // biasanya "Pasal 2 …". Naskah resmi memakainya supaya pembaca tahu apa
      // yang menyusul.
      //
      // Membacanya sebagai pasal menghasilkan pasal kembar yang isinya kosong -
      // dan karena alamatnya sama dengan pasal yang sesungguhnya, rujukan
      // putusan dapat membuka yang kosong. Pada UU 1/1974 saja ia menambah dua
      // belas pasal yang tidak ada.
      const kataTangkap =
        nomorBaris === barisHalaman.length - 1 &&
        /^(PASAL|BAB|BAGIAN|PARAGRAF)\s+\S+\s*[….\s]*$/i.test(baris);
      if (kataTangkap) continue;

      // RUJUKAN SILANG: kalimat yang KEBETULAN dimulai "Pasal 3 ayat (2)
      // Undang-undang ini…" ketika Pasal 8 sudah lewat.
      //
      // Peraturan menomori pasalnya menaik. Nomor yang mundur atau berulang
      // bukan pasal baru melainkan penyebutan pasal lain di dalam kalimat -
      // dan membacanya sebagai pasal menghasilkan alamat kembar yang dapat
      // membajak rujukan putusan.
      const calonPasal = baris.match(POLA.pasal);
      if (calonPasal && !majuDariPasalTerakhir(calonPasal[1])) {
        const sebelumnya = hasil[hasil.length - 1];
        if (sebelumnya) {
          sebelumnya.isi = sebelumnya.isi ? `${sebelumnya.isi} ${baris}` : baris;
          continue;
        }
      }

      // Sekali naskah masuk PENJELASAN, seluruh sisanya penjelasan. Penjelasan
      // mengulang seluruh nomor pasal; tanpa penanda ini "Pasal 2" ada dua kali
      // dengan alamat yang sama, dan rujukan putusan akan membuka penjelasannya
      // - bukan pasalnya - tanpa ada yang menyadarinya.
      if (!diPenjelasan && POLA_PENJELASAN.test(baris)) {
        diPenjelasan = true;
        for (const kunci of Object.keys(induk)) delete induk[kunci as JenisBagian];
      }

      let cocok: RegExpMatchArray | null;

      if ((cocok = baris.match(POLA.bab))) {
        mulai("bab", cocok[1], cocok[2], "", isiHalaman.nomor);
      } else if ((cocok = baris.match(POLA.bagian))) {
        mulai("bagian", cocok[1], cocok[2], "", isiHalaman.nomor);
      } else if ((cocok = baris.match(POLA.paragraf))) {
        mulai("paragraf", cocok[1], cocok[2], "", isiHalaman.nomor);
      } else if ((cocok = baris.match(POLA.pasal))) {
        mulai("pasal", cocok[1], "", cocok[2], isiHalaman.nomor);
      } else if ((cocok = baris.match(POLA.ayat))) {
        mulai("ayat", cocok[1], "", cocok[2], isiHalaman.nomor);
      } else if ((cocok = baris.match(POLA.huruf)) && induk.ayat !== undefined) {
        // Huruf hanya dikenali di dalam ayat. Di luar itu, "a." di awal baris
        // jauh lebih sering awal kalimat biasa daripada penomoran.
        mulai("huruf", cocok[1], "", cocok[2], isiHalaman.nomor);
      } else {
        // Baris yang tidak dikenali menyambung bagian terakhir. Naskah memuat
        // penjelasan, tabel, dan lampiran yang tidak berbentuk pasal;
        // membuangnya berarti pustaka lebih pendek daripada aslinya.
        terakhir = hasil[hasil.length - 1] ?? null;
        if (terakhir) {
          terakhir.isi = terakhir.isi ? `${terakhir.isi} ${baris}` : baris;
        } else {
          mulai("pembuka", "", "", baris, isiHalaman.nomor);
        }
        continue;
      }

      terakhir = hasil[hasil.length - 1] ?? null;
    }
  }

  return hasil;
}

/**
 * Alamat tetap sebuah bagian - jangkar kutipan (C3).
 *
 * ============================================================================
 * HARUS SAMA SETIAP KALI NASKAH YANG SAMA DIURAI ULANG
 * ============================================================================
 *
 * Jangkar dipakai putusan untuk merujuk balik. Bila ia berubah saat naskah
 * yang sama dibaca ulang - karena memakai nomor urut, misalnya - maka seluruh
 * rujukan pada putusan lama menunjuk ke tempat yang keliru, atau ke tempat
 * yang tidak ada.
 *
 * Karena itu jangkar disusun dari JATI DIRI bagian - jenis dan nomornya
 * beserta induknya - bukan dari posisinya.
 */
export function jangkarBagian(peraturanSlug: string, bagian: BagianPeraturan, semua: BagianPeraturan[]): string {
  const jalur: string[] = [];

  let sekarang: BagianPeraturan | undefined = bagian;
  const dilalui = new Set<number>();

  while (sekarang && !dilalui.has(sekarang.urutan)) {
    dilalui.add(sekarang.urutan);
    // Bab dan bagian sengaja TIDAK masuk jangkar. Penataan ulang naskah sering
    // menggeser pasal ke bab lain tanpa mengubah nomor maupun bunyinya, dan
    // jangkar yang memuat babnya akan berubah padahal pasalnya sama.
    if (sekarang.jenis === "pasal" || sekarang.jenis === "ayat" || sekarang.jenis === "huruf") {
      jalur.unshift(`${sekarang.jenis}-${sekarang.nomor.toLowerCase()}`);
    }
    sekarang = sekarang.indukUrutan >= 0 ? semua.find((item) => item.urutan === sekarang!.indukUrutan) : undefined;
  }

  // Penjelasan mendapat ruang alamatnya sendiri. Tanpa ini, Pasal 2 dan
  // penjelasan Pasal 2 beralamat sama - rujukan putusan akan membuka salah
  // satunya tanpa cara memilih, dan yang terbuka adalah yang kebetulan
  // tersimpan lebih dulu.
  return [peraturanSlug, bagian.penjelasan ? "penjelasan" : "", ...jalur].filter(Boolean).join("/");
}

/**
 * Sebutan bagian dalam bahasa yang dipakai naskah putusan.
 *
 * "Pasal 39 ayat (2) huruf f" - bukan "pasal-39/ayat-2/huruf-f". Yang pertama
 * dapat disalin langsung ke dalam pertimbangan; yang kedua harus diterjemahkan
 * dulu oleh yang menulisnya, dan terjemahan yang dikerjakan berkali-kali
 * akhirnya keliru sekali.
 */
export function sebutanBagian(bagian: BagianPeraturan, semua: BagianPeraturan[]): string {
  const bagianJalur: BagianPeraturan[] = [];

  let sekarang: BagianPeraturan | undefined = bagian;
  const dilalui = new Set<number>();
  while (sekarang && !dilalui.has(sekarang.urutan)) {
    dilalui.add(sekarang.urutan);
    bagianJalur.unshift(sekarang);
    sekarang = sekarang.indukUrutan >= 0 ? semua.find((item) => item.urutan === sekarang!.indukUrutan) : undefined;
  }

  const sebutan: string[] = [];
  for (const item of bagianJalur) {
    if (item.jenis === "pasal") sebutan.push(`Pasal ${item.nomor}`);
    else if (item.jenis === "ayat") sebutan.push(`ayat (${item.nomor})`);
    else if (item.jenis === "huruf") sebutan.push(`huruf ${item.nomor}`);
  }

  // Penjelasan disebut apa adanya. Kutipan "Pasal 39 ayat (2)" yang ternyata
  // dari penjelasannya, bukan dari pasalnya, adalah kekeliruan yang tidak
  // terlihat pada naskah putusan.
  const teksSebutan = sebutan.join(" ");
  return bagian.penjelasan && teksSebutan ? `Penjelasan ${teksSebutan}` : teksSebutan;
}

/** Ringkasan untuk ditampilkan setelah penguraian, sebelum disahkan. */
export type RingkasanPecahan = {
  jumlahBagian: number;
  /** Pasal pada batang tubuh - penjelasan dihitung terpisah. */
  jumlahPasal: number;
  /** Pasal di bagian PENJELASAN, yang mengulang seluruh nomor batang tubuh. */
  jumlahPasalPenjelasan: number;
  /**
   * Alamat yang muncul lebih dari sekali.
   *
   * Rujukan putusan tidak dapat memilih mana yang dimaksud, dan yang terbuka
   * adalah yang kebetulan tersimpan lebih dulu. Naskah resmi memang
   * menghasilkannya: judul pasal yang terpotong pergantian halaman tercetak
   * dua kali, dan keduanya terbaca sebagai pasal.
   */
  jangkarGanda: string[];
  jumlahAyat: number;
  /** Nomor pasal yang melompat - petunjuk naskah yang tidak terbaca utuh. */
  pasalHilang: string[];
  /** Bagian tanpa isi sama sekali - petunjuk halaman yang gagal terurai. */
  bagianKosong: number;
};

/**
 * Memeriksa hasil pemecahan sebelum disahkan.
 *
 * Nomor pasal yang melompat hampir selalu berarti halaman yang gagal terurai -
 * dan pustaka yang kehilangan Pasal 40 tanpa ada yang tahu jauh lebih
 * berbahaya daripada pustaka yang kosong.
 */
export function periksaPecahan(bagian: BagianPeraturan[]): RingkasanPecahan {
  // Penjelasan mengulang seluruh nomor pasal; ikut menghitungnya membuat
  // pemeriksaan "pasal hilang" selalu bersih meski batang tubuhnya bolong.
  const pasal = bagian.filter((item) => item.jenis === "pasal" && !item.penjelasan);
  const nomorPasal = pasal.map((item) => Number(item.nomor.replace(/[^0-9]/g, ""))).filter((n) => n > 0);

  const hilang: string[] = [];
  if (nomorPasal.length > 1) {
    const tertinggi = Math.max(...nomorPasal);
    const ada = new Set(nomorPasal);
    for (let nomor = Math.min(...nomorPasal); nomor < tertinggi; nomor += 1) {
      if (!ada.has(nomor)) hilang.push(String(nomor));
    }
  }

  // Alamat ganda berarti rujukan putusan tidak dapat memilih mana yang
  // dimaksud - dan yang terbuka adalah yang kebetulan tersimpan lebih dulu.
  // Naskah resmi memang menghasilkannya: judul pasal yang terpotong pergantian
  // halaman tercetak dua kali, dan keduanya terbaca sebagai pasal.
  const hitungJangkar = new Map<string, number>();
  for (const item of bagian) {
    if (item.jenis !== "pasal" && item.jenis !== "ayat" && item.jenis !== "huruf") continue;
    const alamat = jangkarBagian("x", item, bagian);
    hitungJangkar.set(alamat, (hitungJangkar.get(alamat) ?? 0) + 1);
  }

  return {
    jumlahBagian: bagian.length,
    jumlahPasal: pasal.length,
    jumlahPasalPenjelasan: bagian.filter((item) => item.jenis === "pasal" && item.penjelasan).length,
    jangkarGanda: [...hitungJangkar.entries()]
      .filter(([, jumlah]) => jumlah > 1)
      .map(([alamat]) => alamat)
      .slice(0, 30),
    jumlahAyat: bagian.filter((item) => item.jenis === "ayat").length,
    pasalHilang: hilang.slice(0, 30),
    bagianKosong: bagian.filter((item) => item.jenis !== "bab" && item.jenis !== "bagian" && !item.isi).length,
  };
}
