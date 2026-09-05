/**
 * PEMECAH PERTIMBANGAN - naskah putusan menjadi butir yang dapat dipakai ulang.
 *
 * ============================================================================
 * SATUANNYA PARAGRAF, BUKAN PUTUSAN UTUH
 * ============================================================================
 *
 * Yang benar-benar dipakai ulang hakim adalah satu alinea "Menimbang, bahwa
 * …" - bukan putusan lengkapnya. Menyimpan putusan utuh berarti yang mencari
 * harus membaca delapan ribu huruf untuk menemukan satu alinea yang dicarinya,
 * dan pencarian semacam itu lebih lambat daripada mengetik ulang.
 *
 * ============================================================================
 * RUJUKAN DIKENALI DARI NASKAHNYA SENDIRI
 * ============================================================================
 *
 * Hakim pengadilan ini menulis rujukannya di dalam alinea: "Pasal 39 ayat (1)
 * Undang-Undang Nomor 1 tahun 1974". Rujukan itu DIBACA, bukan ditebak - lalu
 * dicocokkan dengan pustaka hukum lewat jangkarnya.
 *
 * Itulah yang membuat "kutipan wajib terbukti" mungkin: butir yang menyebut
 * pasal yang tidak ada di pustaka dapat ditahan sebelum masuk, bukan
 * ditemukan belakangan di dalam putusan yang sudah ditandatangani.
 */

export type ButirPertimbangan = {
  urutan: number;
  /** Bunyi alinea apa adanya, tanpa tanda HTML. */
  teks: string;
  /** Alinea ini dibuka dengan "Menimbang, bahwa" - penanda pertimbangan. */
  menimbang: boolean;
};

export type Rujukan = {
  /** Bunyi rujukan sebagaimana tertulis di dalam alinea. */
  tertulis: string;
  /** Nomor pasal. */
  pasal: string;
  /** Nomor ayat, kosong bila tidak disebut. */
  ayat: string;
  /** Huruf, kosong bila tidak disebut. */
  huruf: string;
  /** Peraturan yang disebut sesudahnya - "Undang-Undang Nomor 1 tahun 1974". */
  peraturan: string;
};

/** Membuang tanda HTML tanpa membuang jeda alineanya. */
function tanpaTandaHtml(html: string): string {
  return String(html ?? "")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Memecah naskah pertimbangan menjadi alinea.
 *
 * Dipecah pada tanda alinea HTML lebih dulu; naskah yang tidak memakai tanda
 * itu dipecah pada baris kosong. Naskah lama ditulis dengan penyunting yang
 * berbeda-beda, dan pemecahan yang menuntut satu bentuk akan mengembalikan
 * seluruh putusan sebagai satu butir raksasa.
 */
export function pecahPertimbangan(naskah: string): ButirPertimbangan[] {
  const isi = String(naskah ?? "");
  if (!isi.trim()) return [];

  const potongan = /<\s*p[\s>]/i.test(isi)
    ? isi.split(/<\s*\/\s*p\s*>/i)
    : isi.split(/\n\s*\n/);

  const hasil: ButirPertimbangan[] = [];
  for (const bagian of potongan) {
    const teks = tanpaTandaHtml(bagian);
    if (!teks) continue;
    hasil.push({
      urutan: hasil.length,
      teks,
      menimbang: /^menimbang\b/i.test(teks),
    });
  }
  return hasil;
}

/**
 * Pola rujukan pasal di dalam alinea pertimbangan.
 *
 * Ditulis longgar dengan sengaja. Hakim menulisnya dengan bentuk yang
 * berbeda-beda - "ayat (1)" dan "Ayat 2", "huruf b" dan "Huruf B" - dan pola
 * yang menuntut satu bentuk akan melewatkan justru rujukan yang paling sering
 * dipakai.
 */
const POLA_RUJUKAN =
  /Pasal\s+(\d+[A-Za-z]?)((?:\s*(?:dan|,)?\s*(?:ayat|Ayat)\s*\(?\s*\d+\s*\)?)*)((?:\s*(?:dan|,)?\s*(?:huruf|Huruf)\s+[a-zA-Z](?![a-zA-Z]))*)/g;

/** Nama peraturan yang lazim disebut sesudah nomor pasalnya. */
const POLA_PERATURAN =
  /^\s*(?:jo\.?\s*)?((?:Undang-Undang|Undang-undang|Peraturan Pemerintah|Peraturan Mahkamah Agung|Surat Edaran Mahkamah Agung|Kompilasi Hukum Islam|Instruksi Presiden)[^,.;)]*|HIR\b|RBg\b|R\.?Bg\b|KHI\b)/;

/**
 * Rangkaian pasal yang menumpang satu nama peraturan.
 *
 * Hakim menulis "Pasal 65 dan Pasal 82 ayat (1) dan ayat (4) Undang-Undang
 * Nomor 7 tahun 1989" - dan undang-undang itu menaungi KEDUA pasalnya. Bagi
 * yang membaca, itu jelas; bagi pencocok yang hanya melihat kata berikutnya,
 * Pasal 65 tampak tanpa peraturan.
 *
 * Yang dilewati hanya rangkaian pasal, ayat, huruf, dan kata penghubungnya.
 * Begitu ada kata lain di antaranya, pencarian berhenti - karena pada saat itu
 * kalimatnya sudah berpindah pokok, dan meneruskan berarti menautkan pasal ke
 * peraturan yang tidak menyebutnya.
 */
const RANGKAIAN_PASAL = /^(?:\s*(?:dan|serta|,|jo\.?)\s*|\s*Pasal\s+\d+[A-Za-z]?\s*|\s*(?:ayat|Ayat)\s*\(?\s*\d+\s*\)?\s*|\s*(?:huruf|Huruf)\s+[a-zA-Z]\s*)+/;

function cariPeraturan(sesudah: string): string {
  const langsung = sesudah.match(POLA_PERATURAN)?.[1];
  if (langsung) return langsung;

  const rangkaian = sesudah.match(RANGKAIAN_PASAL)?.[0];
  if (!rangkaian) return "";

  return sesudah.slice(rangkaian.length).match(POLA_PERATURAN)?.[1] ?? "";
}

/**
 * Membaca rujukan pasal dari satu alinea.
 *
 * Yang dikembalikan APA YANG TERTULIS, bukan tafsirnya. Alinea yang menyebut
 * "Pasal 39 ayat (1) dan ayat (4)" menghasilkan satu rujukan dengan dua ayat
 * sebagaimana ditulis - memecahnya menjadi dua rujukan berarti menyatakan
 * hakim menulis sesuatu yang tidak ditulisnya.
 */
export function kenaliRujukan(teks: string): Rujukan[] {
  const isi = String(teks ?? "");
  if (!isi.trim()) return [];

  const hasil: Rujukan[] = [];
  for (const cocok of isi.matchAll(POLA_RUJUKAN)) {
    const seluruh = cocok[0];
    const posisiAkhir = (cocok.index ?? 0) + seluruh.length;

    const ayat = [...(cocok[2] ?? "").matchAll(/\d+/g)].map((x) => x[0]).join(", ");
    const huruf = [...(cocok[3] ?? "").matchAll(/(?:huruf|Huruf)\s+([a-zA-Z])/g)]
      .map((x) => x[1].toLowerCase())
      .join(", ");

    const peraturan = cariPeraturan(isi.slice(posisiAkhir));

    hasil.push({
      tertulis: (seluruh + (peraturan ? ` ${peraturan}` : "")).replace(/\s+/g, " ").trim(),
      pasal: cocok[1],
      ayat,
      huruf,
      peraturan: peraturan.replace(/\s+/g, " ").trim(),
    });
  }
  return hasil;
}

/**
 * Nama pendek peraturan yang disebut, untuk mencocokkan dengan pustaka hukum.
 *
 * Mengembalikan bentuk seperti "uu-1-1974" - sama dengan yang dipakai jangkar
 * pustaka hukum, sehingga rujukan dapat ditelusuri langsung ke naskah
 * pasalnya. Yang tidak dikenali mengembalikan KOSONG, bukan tebakan: rujukan
 * yang mengarah ke peraturan yang keliru lebih berbahaya daripada rujukan yang
 * belum tersambung.
 */
export function slugDariSebutan(sebutan: string): string {
  const teks = String(sebutan ?? "").toLowerCase();
  if (!teks.trim()) return "";

  const nomor = teks.match(/nomor\s+(\d+)/)?.[1] ?? "";
  const tahun = teks.match(/tahun\s+(\d{4})/)?.[1] ?? "";

  if (/undang-undang/.test(teks) && nomor && tahun) return `uu-${nomor}-${tahun}`;
  if (/peraturan pemerintah/.test(teks) && nomor && tahun) return `pp-${nomor}-${tahun}`;
  if (/peraturan mahkamah agung/.test(teks) && nomor && tahun) return `perma-${nomor}-${tahun}`;
  if (/surat edaran mahkamah agung/.test(teks) && nomor && tahun) return `sema-${nomor}-${tahun}`;
  if (/instruksi presiden/.test(teks) && nomor && tahun) return `inpres-${nomor}-${tahun}`;
  if (/kompilasi hukum islam|^khi$/.test(teks)) return "khi";
  if (/^hir$/.test(teks)) return "hir";
  if (/^r\.?bg$/.test(teks)) return "rbg";

  return "";
}

/** Jangkar pustaka hukum untuk satu rujukan - kosong bila peraturannya tidak dikenali. */
export function jangkarRujukan(rujukan: Rujukan): string {
  const slug = slugDariSebutan(rujukan.peraturan);
  if (!slug || !rujukan.pasal) return "";

  const jalur = [`pasal-${rujukan.pasal.toLowerCase()}`];
  // Hanya ayat PERTAMA yang masuk jangkar. Rujukan "ayat (1) dan ayat (4)"
  // menunjuk dua tempat, dan satu alamat tidak dapat mewakili keduanya -
  // memaksakannya berarti menyatakan rujukan itu menunjuk tempat yang tidak
  // sepenuhnya benar.
  const ayatPertama = rujukan.ayat.split(",")[0]?.trim();
  if (ayatPertama) jalur.push(`ayat-${ayatPertama}`);
  const hurufPertama = rujukan.huruf.split(",")[0]?.trim();
  if (hurufPertama) jalur.push(`huruf-${hurufPertama}`);

  return [slug, ...jalur].join("/");
}

/**
 * Tempat kosong yang perlu diisi dari berkas perkara.
 *
 * Nama pihak, tanggal, dan nomor bukti berbeda tiap perkara - kalau ikut
 * tersimpan, butir pustaka membawa nama orang dari perkara lain ke dalam
 * putusan yang memakainya.
 *
 * Yang dikenali di sini SEBUTAN PERANNYA - "Penggugat", "Tergugat" - bukan
 * nama orangnya. Sebutan itu memang bagian dari bunyi pertimbangan dan tidak
 * perlu diganti; yang perlu ditandai justru bila nama orang muncul, karena itu
 * tanda alineanya belum siap dipakai ulang.
 */
export type TempatKosong = {
  jenis: "nama" | "tanggal" | "nomor";
  nilai: string;
};

const SEBUTAN_PERAN = /^(Penggugat|Tergugat|Pemohon|Termohon|Para\s+\w+|Majelis\s+Hakim|Hakim|Penggugat\/Pemohon)$/i;

export function kenaliTempatKosong(teks: string): TempatKosong[] {
  const isi = String(teks ?? "");
  if (!isi.trim()) return [];

  const hasil: TempatKosong[] = [];

  // Nama orang: dua kata berhuruf besar berturut-turut yang BUKAN sebutan
  // peran maupun nama peraturan. Dikenali longgar dan sengaja - yang dicari
  // bukan seluruh nama, melainkan tanda bahwa alinea ini masih memuat nama.
  for (const cocok of isi.matchAll(/\b([A-Z][a-z]+(?:\s+(?:bin|binti|alias))?\s+[A-Z][a-z]+)\b/g)) {
    const nama = cocok[1];
    if (SEBUTAN_PERAN.test(nama)) continue;
    if (/^(Undang|Peraturan|Mahkamah|Pengadilan|Republik|Indonesia|Nomor|Pasal|Tahun|Menimbang|Kompilasi|Hukum|Islam|Surat|Edaran|Instruksi|Presiden|Berita|Acara|Sidang)\b/.test(nama)) continue;
    if (!hasil.some((item) => item.jenis === "nama" && item.nilai === nama)) {
      hasil.push({ jenis: "nama", nilai: nama });
    }
  }

  for (const cocok of isi.matchAll(/\b(\d{1,2}\s+(?:Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+\d{4})\b/g)) {
    if (!hasil.some((item) => item.jenis === "tanggal" && item.nilai === cocok[1])) {
      hasil.push({ jenis: "tanggal", nilai: cocok[1] });
    }
  }

  for (const cocok of isi.matchAll(/\b(\d+\/Pdt\.[GP]\/\d{4}\/PA\.\w+)\b/g)) {
    if (!hasil.some((item) => item.jenis === "nomor" && item.nilai === cocok[1])) {
      hasil.push({ jenis: "nomor", nilai: cocok[1] });
    }
  }

  return hasil;
}

/**
 * Sidik butir untuk mengenali alinea yang sama muncul di banyak putusan.
 *
 * Nama, tanggal, dan nomor perkara DIBUANG sebelum disidik. Tanpa itu, alinea
 * yang bunyinya persis sama pada dua ratus putusan akan menghasilkan dua ratus
 * butir berbeda hanya karena nama pihaknya berbeda - dan pustaka menjadi
 * salinan putusan, bukan kumpulan pertimbangan.
 */
export function sidikButir(teks: string): string {
  return String(teks ?? "")
    .toLowerCase()
    .replace(/\b\d{1,2}\s+(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+\d{4}\b/g, " ")
    .replace(/\b\d+\/pdt\.[gp]\/\d{4}\/pa\.\w+\b/g, " ")
    // Nama lengkap beserta kata di sekitarnya: "reka febrianti binti rajab".
    // Yang dibuang bukan hanya kata sesudah "binti" melainkan juga nama depan
    // sebelumnya - membuang separuh nama menyisakan "reka" pada sidik, dan
    // alinea yang sama pada dua putusan tetap bersidik berbeda.
    .replace(/\b(?:[a-z']+\s+){0,2}(?:bin|binti|alias)\s+(?:[a-z']+\s*){1,3}/g, " ")
    .replace(/[^a-z]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
