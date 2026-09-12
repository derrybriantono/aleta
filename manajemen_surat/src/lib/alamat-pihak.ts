/**
 * MERAPIKAN ALAMAT PARA PIHAK.
 *
 * ============================================================================
 * ALAMAT PIHAK BUKAN KETERANGAN, IA BAGIAN PUTUSAN
 * ============================================================================
 *
 * Alamat yang tersimpan di SIPP tercetak apa adanya pada relaas panggilan,
 * pada identitas para pihak di kepala putusan, dan pada akta cerai. Relaas
 * yang alamatnya tidak lengkap dikembalikan juru sita, dan panggilan yang
 * gagal menunda sidang satu putaran penuh.
 *
 * Yang ditemui pada berkas sungguhan ada tiga bentuk keliru, dan ketiganya
 * berasal dari penyalinan tangan:
 *
 *   1. KETERANGAN ARAH DI DALAM KURUNG
 *      "Desa Pelawa Baru (Sesudah SMA 1 Parigi Tengah), Kecamatan ..."
 *      Itu petunjuk jalan, bukan alamat. Ia tidak punya tempat pada dokumen
 *      resmi, dan pada relaas ia justru membuat barisnya terpotong.
 *
 *   2. SPASI DAN KOMA YANG BERLEBIH
 *      "Desa  Watatu ,Kecamatan Banawa  Selatan,,Kabupaten Donggala"
 *
 *   3. TINGKATAN YANG LUPA DISEBUT NAMANYA
 *      "Pelawa Baru, Parigi Tengah, Kabupaten Parigi Moutong, Sulawesi Tengah"
 *      Empat tingkatannya ada, tetapi dua di antaranya tanpa sebutan. Yang
 *      membacanya di luar daerah itu tidak tahu mana desa dan mana kecamatan.
 *
 * ============================================================================
 * YANG DITAMBAHKAN HANYA SEBUTAN TINGKATAN, BUKAN NAMA TEMPAT
 * ============================================================================
 *
 * Sebutan "Desa", "Kecamatan", "Kabupaten", dan "Provinsi" ditambahkan di
 * depan nama yang SUDAH ADA di alamatnya. Tidak satu pun nama tempat dikarang
 * dari luar - alamat yang memang hanya menyebut tiga tingkatan tetap tiga
 * tingkatan, dan kekurangannya DIKATAKAN, bukan diisi.
 *
 * Itu batas yang tidak boleh dilanggar: alamat yang dilengkapi mesin dengan
 * nama yang tidak pernah ditulis siapa pun adalah alamat yang salah, dan
 * relaas yang dikirim ke sana sampai ke rumah orang lain.
 */

export type HasilRapiAlamat = {
  /** Alamat sesudah dirapikan. */
  alamat: string;
  /** Perubahan yang dikerjakan, dalam bahasa yang terbaca petugas. */
  perubahan: string[];
  /** Tingkatan yang tidak ada di alamatnya - dikatakan, bukan diisi. */
  kurang: string[];
  /** Benar bila ada yang berubah sama sekali. */
  berubah: boolean;
};

/** Urutan tingkatan wilayah, dari yang terkecil. */
const TINGKATAN: Array<{ kunci: string; sebutan: string[]; baku: string }> = [
  { kunci: "desa", sebutan: ["desa", "kelurahan", "kel", "ds"], baku: "Desa" },
  { kunci: "kecamatan", sebutan: ["kecamatan", "kec"], baku: "Kecamatan" },
  {
    kunci: "kabupaten",
    sebutan: ["kabupaten", "kabupaten/kota", "kota", "kab"],
    baku: "Kabupaten",
  },
  { kunci: "provinsi", sebutan: ["provinsi", "propinsi", "prov"], baku: "Provinsi" },
];

/**
 * Kata di dalam kurung yang menandai PETUNJUK ARAH, bukan bagian alamat.
 *
 * Sebagian kurung memang bagian alamat yang sah - "(Komplek BTN Lasoani)"
 * adalah nama tempatnya sendiri, dan "RT 01 (RW 02)" keterangan wilayah.
 * Yang dibuang hanya yang jelas-jelas petunjuk jalan.
 */
const PETUNJUK_ARAH =
  /\b(?:sesudah|setelah|sebelum|depan|belakang|samping|dekat|arah|masuk|lorong|seberang|di\s*atas|di\s*bawah|jalan\s+masuk|menuju|rumah\s+sebelum|rumah\s+sesudah|dari\s+arah)\b/i;

function bersih(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

/**
 * Membuang kurung yang isinya petunjuk arah.
 *
 * Yang dibuang dilaporkan apa adanya - petugas harus dapat melihat apa yang
 * hilang dari alamat yang akan tercetak pada relaas.
 */
function buangPetunjukArah(teks: string): { hasil: string; dibuang: string[] } {
  const dibuang: string[] = [];
  const hasil = teks.replace(/\(([^()]*)\)/g, (utuh, isi: string) => {
    if (!PETUNJUK_ARAH.test(isi)) return utuh;
    dibuang.push(bersih(isi));
    return "";
  });
  return { hasil, dibuang };
}

/** Spasi ganda, spasi sebelum koma, koma beruntun, dan koma menggantung. */
function rapikanTandaBaca(teks: string): string {
  return teks
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/(?:,\s*){2,}/g, ", ")
    .replace(/\s*\.\s*$/, "")
    .replace(/^[\s,]+/, "")
    .replace(/[\s,]+$/, "")
    .trim();
}

/** Tingkatan yang sudah disebut namanya pada satu potongan alamat. */
function tingkatanPada(potong: string): string | "" {
  const rendah = potong.toLowerCase().trim();
  for (const tingkat of TINGKATAN) {
    for (const sebutan of tingkat.sebutan) {
      if (new RegExp(`^${sebutan}\\b\\.?\\s`, "i").test(rendah)) return tingkat.kunci;
    }
  }
  return "";
}

/**
 * Merapikan satu alamat.
 *
 * Tidak ada satu pun nama tempat yang ditambahkan dari luar - lihat catatan
 * kepala berkas ini.
 */
export function rapikanAlamat(masukan: string): HasilRapiAlamat {
  const asli = bersih(masukan);
  if (!asli) {
    return { alamat: "", perubahan: [], kurang: TINGKATAN.map((x) => x.baku), berubah: false };
  }

  const perubahan: string[] = [];

  const { hasil: tanpaArah, dibuang } = buangPetunjukArah(asli);
  for (const satu of dibuang) perubahan.push(`Keterangan arah dibuang: "(${satu})"`);

  const rapi = rapikanTandaBaca(tanpaArah);
  if (rapi !== rapikanTandaBaca(asli)) {
    // Sudah tercatat sebagai pembuangan kurung di atas.
  } else if (rapi !== asli) {
    perubahan.push("Spasi dan koma dirapikan");
  }

  const potongan = rapi
    .split(",")
    .map((x) => bersih(x))
    .filter(Boolean);

  // ── Sebutan tingkatan yang lupa ditulis ─────────────────────────────────
  //
  // Dikerjakan dari BELAKANG: provinsi selalu potongan terakhir, kabupaten
  // sebelum itu, dan seterusnya. Mencocokkannya dari depan menuntut menebak
  // berapa potongan yang bukan wilayah - dan alamat sungguhan memuat RT, RW,
  // dusun, serta nomor rumah di depannya.
  const sudahAda = new Set(potongan.map((x) => tingkatanPada(x)).filter(Boolean));
  const hasilPotong = [...potongan];

  for (let i = TINGKATAN.length - 1, dari = hasilPotong.length - 1; i >= 0 && dari >= 0; i -= 1) {
    const tingkat = TINGKATAN[i];
    if (sudahAda.has(tingkat.kunci)) {
      // Sudah disebut namanya - cari letaknya, lalu lanjutkan dari sebelumnya.
      const di = hasilPotong.findIndex((x) => tingkatanPada(x) === tingkat.kunci);
      if (di >= 0) dari = di - 1;
      continue;
    }
    const calon = hasilPotong[dari];
    // Yang sudah bersebutan tingkatan LAIN tidak boleh diberi sebutan kedua.
    if (!calon || tingkatanPada(calon)) continue;
    hasilPotong[dari] = `${tingkat.baku} ${calon}`;
    perubahan.push(`"${calon}" dilengkapi menjadi "${tingkat.baku} ${calon}"`);
    sudahAda.add(tingkat.kunci);
    dari -= 1;
  }

  const alamat = rapikanTandaBaca(hasilPotong.join(", "));
  const kurang = TINGKATAN.filter((x) => !sudahAda.has(x.kunci)).map((x) => x.baku);

  return { alamat, perubahan, kurang, berubah: alamat !== asli };
}

/** Pola surel yang berdiri sendiri - dipakai memetiknya dari naskah gugatan. */
const POLA_SUREL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/**
 * ============================================================================
 * DOMISILI ELEKTRONIK - SUREL YANG MEMANG TERTULIS DI GUGATANNYA
 * ============================================================================
 *
 * e-Court menuntut domisili elektronik pada identitas para pihak, dan surelnya
 * sudah tertulis di surat gugatan yang diunggah. Menyalinnya tangan ke SIPP
 * adalah pekerjaan yang tidak menambah satu keterangan pun.
 *
 * Yang TIDAK dipetik: surel pengadilan sendiri dan surel kuasa hukum. Keduanya
 * kerap berdiri di kop surat atau di tanda tangan, dan keduanya BUKAN domisili
 * elektronik pihaknya - menuliskannya ke SIPP berarti panggilan elektronik
 * dikirim ke alamat orang lain.
 */
const SUREL_BUKAN_PIHAK =
  /@(?:pa-|pta-|mahkamahagung|badilag|.*\.go\.id$)|pengadilan|kepaniteraan/i;

export type SurelGugatan = {
  surel: string;
  /** Kalimat tempat ia ditemukan, apa adanya. */
  asal: string;
};

/**
 * Memetik surel dari naskah gugatan.
 *
 * Dikembalikan SELURUHNYA, tidak dipilih satu - gugatan dapat memuat surel
 * penggugat dan tergugat sekaligus, dan yang tahu mana milik siapa adalah
 * petugas yang membaca kalimat asalnya.
 */
export function surelDariGugatan(naskah: string): SurelGugatan[] {
  const teks = bersih(naskah);
  if (!teks) return [];

  // Dipecah pada titik koma dan baris baru SAJA - bukan pada titik dua.
  //
  // Identitas pihak pada gugatan ditulis sebagai satu kalimat panjang yang di
  // tengahnya berdiri "Domisili elektronik : nama@contoh.com". Memecahnya di
  // titik dua itu membuang nama pemilik surelnya dari kutipan, dan kutipan
  // yang tidak menyebut siapa pemiliknya tidak dapat diperiksa siapa pun -
  // padahal justru itu yang menentukan surelnya ditulis ke pihak yang mana.
  const kalimat = teks.split(/(?<=[.;])\s+|\n+/);
  const ketemu = new Map<string, string>();

  for (const satu of kalimat) {
    const cocok = satu.match(POLA_SUREL);
    if (!cocok) continue;
    for (const surel of cocok) {
      const rendah = surel.toLowerCase();
      if (SUREL_BUKAN_PIHAK.test(rendah)) continue;
      if (!ketemu.has(rendah)) ketemu.set(rendah, bersih(satu).slice(0, 300));
    }
  }

  return [...ketemu].map(([surel, asal]) => ({ surel, asal }));
}

/**
 * Menyusun alamat lengkap beserta domisili elektroniknya, seperti yang
 * dituliskan SIPP:
 *
 *   Dusun I, Desa Watatu, Kecamatan Banawa Selatan, Kabupaten Donggala,
 *   Provinsi Sulawesi Tengah, Domisili elektronik : nama@contoh.com
 */
export function alamatDenganDomisili(alamat: string, surel: string): string {
  const pokok = bersih(alamat);
  const email = bersih(surel);
  if (!pokok) return "";
  if (!email) return pokok;
  // Yang sudah memuat domisilinya tidak ditambahi untuk kedua kalinya.
  if (/domisili\s+elektronik/i.test(pokok)) return pokok;
  return `${pokok}, Domisili elektronik : ${email}`;
}
