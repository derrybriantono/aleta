/**
 * POHON BLANGKO - memilih berjenjang seperti panitera berpikir.
 *
 * ============================================================================
 * URUTANNYA URUTAN RUANG SIDANG
 * ============================================================================
 *
 * ABT terasa wajar karena alurnya sama dengan alur berpikir panitera:
 *
 *   Cerai Gugat -> Verstek -> BAS 2 -> P Hadir & T Tidak Hadir -> Putusan Verstek
 *   jenis perkara  jalannya   sidang       siapa yang hadir         apa hasilnya
 *
 * Daftar datar berisi dua belas nama berkas menuntut panitera membaca semuanya
 * lalu menyaring sendiri. Jenjang menuntutnya menjawab satu pertanyaan pada
 * satu waktu - dan tiap pertanyaannya memang pertanyaan yang sudah ada
 * jawabannya di kepalanya sebelum ia membuka ALETA.
 *
 * ============================================================================
 * JENJANGNYA DIBACA DARI NAMA BERKAS
 * ============================================================================
 *
 * Nomor sidang, keadaan kehadiran, dan tindakan diuraikan bot dari nama berkas
 * blangko - bukan dari daftar yang ditulis tangan di sini. Daftar tulisan
 * tangan harus dijaga tetap cocok dengan folder yang isinya berubah tanpa
 * sepengetahuan ALETA, dan begitu keduanya berselisih yang muncul di layar
 * adalah blangko yang tidak ada, atau blangko yang ada tetapi tidak terlihat.
 *
 * Yang memang ditulis di sini hanyalah SET mana untuk jenis perkara apa - itu
 * penilaian, bukan data, dan tidak dapat dibaca dari nama folder.
 */

export type BlangkoItem = {
  berkas: string;
  kode: string;
  kategori: string;
  eCourt: boolean;
  judul: string;
  basKe: number;
  basVarian: string;
  keadaan: string;
  tindakan: string;
};

export type SetBlangko = {
  id: string;
  nama: string;
  folder: string;
  /** BAS dijenjangkan menurut nomor sidang; putusan menurut skenario akhirnya. */
  jenis: "bas" | "putusan";
  /** Kata kunci jenis perkara SIPP yang cocok dengan set ini. */
  untuk: string[];
};

const AKAR = "derry_briantono";

/**
 * Set yang dipakai di pengadilan ini.
 *
 * Folder induk APS Badilag memuat 812 blangko dalam puluhan set warisan; yang
 * dipakai sehari-hari hanya sebagian. Menampilkan semuanya berarti panitera
 * menyaring sendiri tiap kali - dan daftar yang terlalu panjang berhenti
 * dibaca.
 */
export const SET_BLANGKO: SetBlangko[] = [
  {
    id: "bas-verstek",
    nama: "BAS Verstek Perceraian",
    folder: `${AKAR}/- BAS VERSTEK PERCERAIAN -`,
    jenis: "bas",
    untuk: ["cerai gugat", "cerai talak"],
  },
  {
    id: "bas-contra",
    nama: "BAS Contra Perceraian",
    folder: `${AKAR}/- BAS CONTRA PERCERAIAN -`,
    jenis: "bas",
    untuk: ["cerai gugat", "cerai talak"],
  },
  {
    id: "bas-itsbat",
    nama: "BAS Itsbat Nikah",
    folder: `${AKAR}/- BAS ITSTBAT NIKAH -`,
    jenis: "bas",
    untuk: ["istbat nikah", "itsbat nikah", "pengesahan perkawinan"],
  },
  {
    id: "bas-anak",
    nama: "BAS Asal Usul Anak",
    folder: `${AKAR}/- BAS ASAL USUL ANAK -`,
    jenis: "bas",
    untuk: ["asal usul anak"],
  },
  {
    id: "putusan-cg",
    nama: "Putusan Cerai Gugat",
    folder: `${AKAR}/1 Perceraian CG`,
    jenis: "putusan",
    untuk: ["cerai gugat"],
  },
  {
    id: "putusan-ct",
    nama: "Putusan Cerai Talak",
    folder: `${AKAR}/1a Perceraian CT`,
    jenis: "putusan",
    untuk: ["cerai talak"],
  },
  {
    id: "putusan-kumulasi",
    nama: "Putusan Perceraian Kumulasi Itsbat",
    folder: `${AKAR}/1c Perceraian Kumulasi Itsbat Nikah`,
    jenis: "putusan",
    untuk: ["cerai gugat", "cerai talak", "istbat nikah", "itsbat nikah"],
  },
  {
    id: "putusan-itsbat",
    nama: "Penetapan Itsbat Nikah",
    folder: `${AKAR}/2 Itsbat Nikah`,
    jenis: "putusan",
    untuk: ["istbat nikah", "itsbat nikah", "pengesahan perkawinan"],
  },
  {
    id: "putusan-dispensasi",
    nama: "Penetapan Dispensasi Kawin",
    folder: `${AKAR}/3 Dispensasi Kawin`,
    jenis: "putusan",
    untuk: ["dispensasi kawin"],
  },
  {
    id: "putusan-kebendaan",
    nama: "Putusan Kebendaan",
    folder: `${AKAR}/4 Kebendaan`,
    jenis: "putusan",
    untuk: ["harta bersama", "kewarisan", "waris", "p3hp", "ahli waris", "wasiat"],
  },
  {
    id: "putusan-perwalian",
    nama: "Penetapan Perwalian",
    folder: `${AKAR}/6 Perwalian`,
    jenis: "putusan",
    untuk: ["perwalian", "wali"],
  },
];

/**
 * Set yang sesuai jenis perkara, diurutkan yang paling cocok lebih dulu.
 *
 * Yang tidak cocok TIDAK dibuang, hanya turun. Perkara kadang menuntut blangko
 * yang tidak lazim, dan set yang disembunyikan berarti panitera harus keluar
 * dari ALETA untuk mengambilnya - lalu tidak kembali.
 */
export function setUntukPerkara(jenisPerkara: string): Array<SetBlangko & { cocok: boolean }> {
  const jenis = String(jenisPerkara || "").toLowerCase();

  const dinilai = SET_BLANGKO.map((set) => ({
    ...set,
    cocok: Boolean(jenis) && set.untuk.some((kata) => jenis.includes(kata)),
  }));

  // BAS lebih dulu dalam kelompok yang cocok: halaman ini alat bantu tulis BAS,
  // dan yang paling sering dibuka memang BAS sidang hari ini.
  return dinilai.sort((a, b) => {
    if (a.cocok !== b.cocok) return a.cocok ? -1 : 1;
    if (a.jenis !== b.jenis) return a.jenis === "bas" ? -1 : 1;
    return 0;
  });
}

export type Jenjang = {
  kunci: string;
  label: string;
  /** Keterangan singkat di bawah label - kosong bila tidak menambah apa pun. */
  keterangan: string;
  blangko: BlangkoItem[];
};

function urutkanAlami(a: string, b: string): number {
  return a.localeCompare(b, "id", { numeric: true });
}

/**
 * Menyusun katalog satu set menjadi jenjang kedua.
 *
 * BAS dijenjangkan menurut NOMOR SIDANG - itulah yang pertama diketahui
 * panitera saat sidang dimulai. Putusan dijenjangkan menurut SKENARIO AKHIR,
 * karena putusan baru disusun setelah hasilnya diketahui.
 */
export function jenjangkan(jenis: "bas" | "putusan", blangko: BlangkoItem[]): Jenjang[] {
  const kelompok = new Map<string, Jenjang>();

  for (const item of blangko) {
    const kunci =
      jenis === "bas"
        ? item.basKe > 0
          ? `sidang-${item.basKe}`
          : "lainnya"
        : item.kategori
          ? item.kategori.toLowerCase()
          : "lainnya";

    const label =
      jenis === "bas"
        ? item.basKe > 0
          ? `Sidang ke-${item.basKe}`
          : "Lainnya"
        : item.kategori || "Lainnya";

    if (!kelompok.has(kunci)) kelompok.set(kunci, { kunci, label, keterangan: "", blangko: [] });
    kelompok.get(kunci)!.blangko.push(item);
  }

  const hasil = [...kelompok.values()];
  for (const tingkat of hasil) {
    tingkat.blangko.sort((a, b) => urutkanAlami(a.berkas, b.berkas));
    tingkat.keterangan = `${tingkat.blangko.length} blangko`;
  }

  // "Lainnya" selalu terakhir. Ia bukan tingkat sesungguhnya melainkan tempat
  // singgah bagi nama berkas yang tidak mengikuti pola - dan menaruhnya di awal
  // berarti hal yang paling jarang dipakai berdiri paling depan.
  return hasil.sort((a, b) => {
    if ((a.kunci === "lainnya") !== (b.kunci === "lainnya")) return a.kunci === "lainnya" ? 1 : -1;
    return urutkanAlami(a.label, b.label);
  });
}

/**
 * Nama yang terbaca untuk satu blangko di dalam jenjangnya.
 *
 * Nomor sidang tidak diulang - ia sudah menjadi nama tingkatnya. Yang tersisa
 * justru yang membedakan satu blangko dari tetangganya: siapa yang hadir, dan
 * apa yang terjadi.
 */
export function labelBlangko(jenis: "bas" | "putusan", item: BlangkoItem): string {
  const bagian = jenis === "bas" ? [item.keadaan, item.tindakan] : [item.keadaan, item.tindakan];
  const gabung = bagian.filter(Boolean).join(" — ");
  return gabung || item.judul || item.berkas;
}

/**
 * Set PUTUSAN yang cocok dengan jenis perkara - untuk pemetaan blangko
 * ekstensi, yang memilih satu berkas per jenis. BAS sengaja tidak ikut:
 * ia dijenjangkan per sidang, bukan per skenario akhir, dan bukan yang
 * dicetak sebagai putusan.
 */
export function setPutusanUntukPerkara(jenisPerkara: string): SetBlangko[] {
  return setUntukPerkara(jenisPerkara).filter((set) => set.cocok && set.jenis === "putusan");
}

export type UsulanBerkas = {
  berkas: string;
  kategori: string;
  kunciJenjang: string;
};

/**
 * Satu berkas yang layak menjadi BAWAAN pemetaan dari jenjang putusan.
 *
 * Pilihannya SKENARIO KABUL - "Kabul", "Kabul Verstek", "Kabul Contra" -
 * sebab itulah yang paling sering dicetak, dan yang salah pilih paling
 * murah diganti: pemetaan hanya bawaan, tiap perkara masih dapat memilih
 * blangkonya sendiri. Di dalam skenario itu diambil yang PERTAMA menurut
 * urutan alami nama berkas, sehingga "[01] ..." mendahului "[01ab] ...".
 * Bila tidak ada satu pun jenjang kabul, jatuh ke berkas pertama pada
 * jenjang pertama yang bukan "lainnya" - dan bila hanya "lainnya" yang ada,
 * dijawab null: menebak dari nama yang tidak berpola bukan bawaan, melainkan
 * tebakan.
 */
export function usulanPutusanDariJenjang(jenjang: Jenjang[]): UsulanBerkas | null {
  const bukanLainnya = jenjang.filter((j) => j.kunci !== "lainnya" && j.blangko.length > 0);
  const kabul = bukanLainnya.find((j) => /^kabul(?: |$)/.test(j.kunci));
  const dipilih = kabul ?? bukanLainnya[0];
  if (!dipilih) return null;
  // "[01]" mendahului "[01b]" dan "[01ab]": kode yang lebih pendek adalah
  // induknya, varian berhuruf adalah turunannya. Kolasi lokal tidak
  // dipercaya untuk membedakan "]" dari "b"; panjang kodenya yang dipercaya.
  const item = [...dipilih.blangko].sort((a, b) => {
    const ka = String(a.kode || "").length;
    const kb = String(b.kode || "").length;
    if (ka !== kb && ka > 0 && kb > 0) return ka - kb;
    return urutkanAlami(a.berkas, b.berkas);
  })[0];
  return { berkas: item.berkas, kategori: item.kategori, kunciJenjang: dipilih.kunci };
}
