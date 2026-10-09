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
 *   4. EKOR WILAYAH DOBEL (perbaikan 5 Okt 2026 butir 26)
 *      "Desa Oti, Kecamatan Sindue Tobata, Kabupaten Donggala, Provinsi
 *      Sulawesi Tengah, Oti, Sindue Tobata, Kabupaten Donggala, Sulawesi
 *      Tengah" - formulir e-Court menambahkan desa/kecamatan/kabupaten/
 *      provinsi TANPA sebutan di ujung alamat yang sudah lengkap, juga
 *      sesudah "Domisili elektronik : surel". Deretan di ujung yang SELURUH
 *      namanya sudah ada di bagian depan dibuang; yang memuat satu nama baru
 *      saja dibiarkan utuh.
 *
 *   5. KETERANGAN RUMAH DI DALAM KURUNG
 *      "Desa Oti (rumah depan kantor Desa Oti)" - petunjuk menemukan rumah,
 *      bukan alamat. Diperlakukan sama dengan petunjuk arah (1).
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
  /^\s*rumah\b|\b(?:sesudah|setelah|sebelum|depan|belakang|samping|dekat|arah|masuk|lorong|seberang|di\s*atas|di\s*bawah|jalan\s+masuk|menuju|rumah\s+sebelum|rumah\s+sesudah|dari\s+arah)\b/i;

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
  // Domisili elektronik dipisah dulu: bagian alamatnya dirapikan sendiri,
  // surelnya dibiarkan apa adanya, dan ekor wilayah yang ditempelkan e-Court
  // SESUDAH surel dibuang bila seluruh namanya sudah ada di alamat pokok.
  const domisili = /^([\s\S]*?)([.,;]?)\s*Domisili\s+elektronik\s*:?\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})([\s\S]*)$/i.exec(asli);
  if (!domisili || !bersih(domisili[1])) return rapikanPokok(asli);
  const pokok = rapikanPokok(domisili[1]);
  const perubahan = [...pokok.perubahan];
  const namaPokok = new Set(pokok.alamat.split(",").map(namaTempat).filter(Boolean));
  const ekor = domisili[4]
    .split(",")
    .map((x) => bersih(x))
    .filter(Boolean);
  let sisa = ekor.join(", ");
  if (ekor.length && ekor.every((x) => namaPokok.has(namaTempat(x)))) {
    perubahan.push(`Ekor wilayah dobel sesudah domisili elektronik dibuang: "${sisa}"`);
    sisa = "";
  }
  const alamat = `${pokok.alamat}${domisili[2] === "." ? "." : ","} Domisili elektronik : ${domisili[3]}${sisa ? `, ${sisa}` : ""}`;
  return { alamat, perubahan, kurang: pokok.kurang, berubah: alamat !== asli };
}

/** Nama tempat tanpa sebutan tingkatan, huruf kecil - untuk dibandingkan. */
function namaTempat(potong: string): string {
  return bersih(potong)
    .toLowerCase()
    .replace(/^(?:desa|kelurahan|kel\.?|ds\.?|kecamatan|kec\.?|kabupaten\/kota|kabupaten|kab\.?|kota|provinsi|propinsi|prov\.?)\s+/, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Awal EKOR WILAYAH DOBEL - deretan potongan di ujung (paling sedikit dua,
 * paling sedikit satu tanpa sebutan tingkatan) yang SELURUH namanya sudah
 * disebut di bagian depan. -1 bila tidak ada. Satu nama baru saja di ekor
 * membatalkannya: itu mungkin keterangan sungguhan.
 */
function awalEkorDobel(potongan: string[]): number {
  for (let j = 1; j <= potongan.length - 2; j += 1) {
    const depan = new Set(potongan.slice(0, j).map(namaTempat).filter(Boolean));
    const ekor = potongan.slice(j);
    if (!ekor.every((x) => depan.has(namaTempat(x)))) continue;
    if (!ekor.some((x) => !tingkatanPada(x))) continue;
    if (!potongan.slice(0, j).some((x) => tingkatanPada(x))) continue;
    return j;
  }
  return -1;
}

function rapikanPokok(masukan: string): HasilRapiAlamat {
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

  // ── Ekor wilayah dobel (bentuk e-Court) ────────────────────────────────
  const ekorDi = awalEkorDobel(potongan);
  if (ekorDi > 0) {
    perubahan.push(`Ekor wilayah dobel dibuang: "${potongan.slice(ekorDi).join(", ")}"`);
    potongan.splice(ekorDi);
  }

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
/**
 * ============================================================================
 * ALAMAT UNTUK PUTUSAN (butir 9, 1.189.x)
 * ============================================================================
 *
 * Alamat di identitas para pihak pada PUTUSAN dirapikan (rapikanAlamat) dan
 * diberi ", Domisili Elektronik: <surel>" bila pihaknya punya surel. Alamat di
 * SIPP TIDAK diubah: juru sita memakainya apa adanya untuk relaas/PBT. Yang
 * dihasilkan di sini hanya untuk variabel ABT "Alamat Putusan" (8548/8549,
 * kosong = dari SIPP).
 *
 *   - surel tertulis tanpa label ("..., Provinsi Sulawesi Tengah, x@y.com,
 *     Oti, ...") -> diberi label "Domisili Elektronik: ";
 *   - label lama "Domisili elektronik : x" / ". Domisili ..." -> dibakukan
 *     menjadi ", Domisili Elektronik: x";
 *   - surel dari e-Court/SIPP yang belum tertulis -> ditambahkan di ujung;
 *   - petik tunggal/ganda -> ’ (kueri data_sql ABT tidak patah).
 */
export type AlamatPutusan = {
  alamat: string;
  /** Benar bila berbeda dari alamat SIPP (perlu ditulis ke variabel putusan). */
  berubah: boolean;
  perubahan: string[];
  surel: string;
};

const POLA_SUREL_SATU = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

export function alamatPutusan(alamatSipp: string, surelLain = ""): AlamatPutusan {
  const asli = bersih(alamatSipp);
  const perubahan: string[] = [];
  if (!asli) return { alamat: "", berubah: false, perubahan, surel: "" };

  // 1. Surel yang tertulis tanpa label diberi label lama dulu, supaya
  //    rapikanAlamat memperlakukannya sebagai domisili (dan membuang ekor
  //    wilayah dobel e-Court di belakangnya).
  // Titik dua berulang ("Domisili Elektronik : : x") dibakukan lebih dulu -
  // tanpa itu domisilinya tidak dikenali dan surelnya ikut "dirapikan".
  let teks = asli.replace(/Domisili\s+elektronik\s*(?::\s*)+/gi, "Domisili elektronik : ");
  const tertulis = POLA_SUREL_SATU.exec(teks);
  if (tertulis && !/domisili\s+elektronik/i.test(teks)) {
    teks = `${teks.slice(0, tertulis.index).replace(/[\s,.;]+$/, "")}, Domisili elektronik : ${teks.slice(tertulis.index)}`;
    perubahan.push(`Label "Domisili Elektronik" ditambahkan sebelum ${tertulis[0]}`);
  }

  // 2. Perapi alamat yang SAMA dengan PTSP.
  const rapi = rapikanAlamat(teks);
  perubahan.push(...rapi.perubahan);
  let hasil = rapi.alamat;

  // 3. Label dibakukan: ", Domisili Elektronik: surel".
  const baku = hasil.replace(/\s*[.,;]?\s*Domisili\s+elektronik\s*:?\s*/i, ", Domisili Elektronik: ");
  hasil = baku;

  // 4. Surel dari e-Court/SIPP yang belum tertulis.
  const surel = bersih(surelLain).toLowerCase();
  const adaSurel = POLA_SUREL_SATU.exec(hasil);
  if (!adaSurel && surel && POLA_SUREL_SATU.test(surel) && !SUREL_BUKAN_PIHAK.test(surel)) {
    hasil = `${hasil.replace(/[\s,.;]+$/, "")}, Domisili Elektronik: ${surel}`;
    perubahan.push(`Domisili Elektronik ditambahkan: ${surel}`);
  }

  // 5. Kebal petik: ABT menempelkan isian mentah ke literal SQL.
  const tanpaPetik = hasil.replace(/\\/g, "/").replace(/["']/g, "’");
  if (tanpaPetik !== hasil) perubahan.push("Petik diganti ’ (kueri ABT tidak patah)");
  hasil = tanpaPetik;

  const akhirSurel = POLA_SUREL_SATU.exec(hasil);
  return { alamat: hasil, berubah: hasil !== asli, perubahan, surel: akhirSurel ? akhirSurel[0] : "" };
}

/** Variabel ABT alamat putusan (paket abt-alamat-putusan): kosong = alamat SIPP. */
export const VAR_ALAMAT_PUTUSAN = Object.freeze({ 1: "8548", 2: "8549" } as const);

export type AlamatPihakSipp = {
  pihakKe: number;
  urutan: number;
  nama?: string;
  alamat: string;
  emailSipp?: string;
  emailEcourt?: string;
};

/**
 * Usulan ABT dari alamat SIPP pihak PERTAMA tiap sisi (urutan 1). Alamat yang
 * sudah rapi (tidak berubah) TIDAK diusulkan: variabel yang kosong memang
 * berarti "dari SIPP". Bentuknya sama dengan usulan bot (kode, nama, nilai,
 * keyakinan, sumber, catatan).
 */
export function usulanAlamatPutusan(daftar: AlamatPihakSipp[] | null | undefined) {
  const hasil: Array<{
    kode: string;
    nama: string;
    nilai: string;
    keyakinan: "pasti";
    bentrok: string;
    dihitung: boolean;
    sumber: Array<{ asal: string; keterangan: string }>;
    catatan: string;
  }> = [];
  for (const sisi of [1, 2] as const) {
    const p = (daftar || []).find((x) => Number(x.pihakKe) === sisi && Number(x.urutan || 1) === 1);
    if (!p || !bersih(p.alamat)) continue;
    const surel = bersih(p.emailEcourt) || bersih(p.emailSipp);
    const a = alamatPutusan(p.alamat, surel);
    if (!a.berubah) continue;
    const asalSurel = a.surel
      ? bersih(p.emailEcourt) && a.surel.toLowerCase() === bersih(p.emailEcourt).toLowerCase()
        ? "e-Court"
        : bersih(p.emailSipp) && a.surel.toLowerCase() === bersih(p.emailSipp).toLowerCase()
          ? "SIPP"
          : "alamat SIPP"
      : "";
    hasil.push({
      kode: VAR_ALAMAT_PUTUSAN[sisi],
      nama: `Alamat Putusan pihak ${sisi === 1 ? "pertama" : "kedua"}`,
      nilai: a.alamat,
      keyakinan: "pasti",
      bentrok: "",
      dihitung: true,
      sumber: [
        { asal: "sipp", keterangan: "alamat SIPP dirapikan (perapi alamat PTSP) - alamat di SIPP TIDAK diubah" },
        ...(asalSurel ? [{ asal: asalSurel === "e-Court" ? "ecourt" : "sipp", keterangan: `domisili elektronik dari ${asalSurel}` }] : []),
      ],
      catatan: `${a.perubahan.join("; ")}. Hanya untuk putusan; relaas/PBT tetap memakai alamat SIPP.`,
    });
  }
  return hasil;
}

/**
 * Butir 9 (1.189.x): usulan alamat putusan ditambahkan ke usulan SIPP bot.
 * Perapinya SATU (rapikanAlamat PTSP lewat alamatPutusan); bot hanya membaca
 * alamat + surel (SIPP, e-Court) - lihat bacaAlamatPihak di abtUsulanService.
 * Usulan bot bernomor sama (bila kelak ada) didahulukan.
 */
export function tambahUsulanAlamat(sipp: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!sipp || typeof sipp !== "object") return sipp;
  const daftar = Array.isArray(sipp.alamatPihak) ? (sipp.alamatPihak as AlamatPihakSipp[]) : [];
  if (!daftar.length) return sipp;
  const lama = Array.isArray(sipp.usulan) ? (sipp.usulan as Array<{ kode?: unknown }>) : [];
  const ada = new Set(lama.map((u) => String(u && u.kode)));
  const baru = usulanAlamatPutusan(daftar).filter((u) => !ada.has(u.kode));
  return baru.length ? { ...sipp, usulan: [...lama, ...baru] } : sipp;
}

export function alamatDenganDomisili(alamat: string, surel: string): string {
  const pokok = bersih(alamat);
  const email = bersih(surel);
  if (!pokok) return "";
  if (!email) return pokok;
  // Yang sudah memuat domisilinya tidak ditambahi untuk kedua kalinya.
  if (/domisili\s+elektronik/i.test(pokok)) return pokok;
  return `${pokok}, Domisili elektronik : ${email}`;
}
