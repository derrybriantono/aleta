/**
 * ============================================================================
 * MENCARI HAKIM DARI SEBAGIAN NAMA ATAU DARI KODENYA
 * ============================================================================
 *
 * Dipakai kotak isian konseptor sementara. Yang mengetiknya sedang menunjuk
 * siapa yang menyusun naskah putusan, dan hampir selalu yang ditunjuk salah
 * satu dari lima hakim yang sedang aktif.
 *
 * ============================================================================
 * MENGENALI, BUKAN MEMAKSA - DAN ITU YANG MENENTUKAN BENTUKNYA
 * ============================================================================
 *
 * Konseptor TIDAK selalu hakim. Panitera pengganti pun menyusun naskah, dan
 * pada perkara tertentu naskahnya disusun orang yang tidak ada di daftar mana
 * pun. Karena itu daftar ini hanya MENAWARKAN: yang mengetik nama di luar
 * daftar tetap boleh menyimpannya apa adanya, tanpa memilih apa pun.
 *
 * Kotak pilihan yang memaksa akan menolak nama yang benar - dan yang
 * memakainya lalu menyerah, atau menulis nama yang salah demi lolos.
 *
 * ============================================================================
 * KODE DICOCOKKAN PERSIS, NAMA DICOCOKKAN SEBAGIAN
 * ============================================================================
 *
 * Kode hakim di SIPP satu atau dua huruf: A, B, C1, C2, C3. Mencocokkannya
 * "mengandung" akan membuat huruf "a" mana pun pada nama yang diketik
 * memanggil hakim berkode A - dan itu terjadi pada hampir tiap ketikan.
 *
 * Nama sebaliknya: yang mengetik menulis "derry" atau "brian", bukan nama
 * lengkap bergelar. Karena itu namanya dicocokkan sebagai potongan kata.
 */

export type Hakim = {
  id: number;
  kode: string;
  nama: string;
};

/** Sama seperti di tempat lain: huruf kecil, tanpa tanda baca, spasi tunggal. */
function bakukan(teks: string): string {
  return String(teks || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Hakim yang cocok dengan ketikan, urut dari yang paling mungkin dimaksud.
 *
 * Urutannya BUKAN abjad, melainkan seberapa dekat cocoknya:
 *
 *   1. kodenya persis        "c3"  -> Derry Briantono
 *   2. namanya diawali       "der" -> Derry Briantono
 *   3. salah satu katanya diawali  "brian" -> Derry Briantono
 *   4. mengandung di mana pun
 *
 * Tanpa penjenjangan itu, mengetik "idris" pada daftar yang memuat "Idris"
 * dan "Sudarmin H.I.M. Tang" dapat menaruh keduanya berdampingan tanpa
 * petunjuk mana yang dimaksud - dan yang pertama ditekan orang biasanya yang
 * teratas.
 */
export function cariHakim(daftar: Hakim[], ketikan: string, batas = 6): Hakim[] {
  const cari = bakukan(ketikan);
  if (!cari) return [];

  const bernilai: Array<{ hakim: Hakim; nilai: number }> = [];

  for (const hakim of daftar) {
    const kode = bakukan(hakim.kode);
    const nama = bakukan(hakim.nama);
    // ========================================================================
    // KATA SEHURUF DIBUANG - GELAR MELEBUR MENJADI KATA SESUDAH TANDA BACANYA
    // ========================================================================
    //
    // "Derry Briantono, S.H." dibakukan menjadi "derry briantono s h". Huruf
    // gelar itu menjadi KATA tersendiri, sehingga mengetik "s" dicocokkan
    // sebagai awal kata pada hampir tiap nama - keempat hakim bergelar S.H.
    // atau S.H.I.
    //
    // Terukur: tanpa pembuangan ini, "s" mengembalikan kelima-limanya.
    //
    // Jebakan yang sama pernah menggigit bandingkanKonseptor, dan sebabnya
    // sama persis - lihat bakukan() di konseptor-sementara.
    const kata = nama.split(" ").filter((k) => k.length > 1);

    let nilai = -1;
    // Kode dicocokkan PERSIS - lihat catatan di atas berkas.
    if (kode && kode === cari) nilai = 0;
    else if (nama.startsWith(cari)) nilai = 1;
    else if (kata.some((k) => k.startsWith(cari))) nilai = 2;
    // "Mengandung di mana pun" hanya berlaku sejak TIGA huruf.
    //
    // Terukur pada daftar satker: mengetik "A" - kode hakim yang sah - juga
    // mencocokkan empat nama lain, sebab huruf a mengandung pada gelar
    // hampir semua orang ("S.H.I.", "M.H.", "Tatura", "Wijaya"). Yang
    // mengetik satu huruf sedang menyebut KODE, dan menawarinya empat nama
    // yang tidak ada hubungannya membuat tawaran itu terbaca sebagai
    // tebakan.
    //
    // Dua huruf pun sama: "ta" mengandung pada Tatura dan pada Briantono.
    // Sejak tiga huruf, potongan yang mengandung hampir selalu memang
    // potongan nama yang dimaksud.
    else if (cari.length >= 3 && nama.includes(cari)) nilai = 3;

    if (nilai >= 0) bernilai.push({ hakim, nilai });
  }

  bernilai.sort((a, b) => {
    if (a.nilai !== b.nilai) return a.nilai - b.nilai;
    // Seri diputus abjad, bukan urutan daftar: urutan daftar datang dari SIPP
    // dan dapat berubah tanpa sebab yang terlihat di layar.
    return a.hakim.nama.localeCompare(b.hakim.nama);
  });

  return bernilai.slice(0, batas).map((x) => x.hakim);
}

/**
 * Hakim yang namanya PERSIS seperti yang tersimpan - untuk lencana "hakim
 * terdeteksi" pada nama yang sudah tersimpan sebelumnya.
 *
 * Dicocokkan atas nama yang dibakukan, bukan huruf demi huruf: gelar ditulis
 * berbeda-beda di SIPP ("S.H.I.,M.H" dan "S.H.I., M.H.") dan perbandingan
 * mentah akan menyatakan orang yang sama sebagai dua orang.
 */
export function hakimPersis(daftar: Hakim[], nama: string): Hakim | null {
  const cari = bakukan(nama);
  if (!cari) return null;
  return daftar.find((x) => bakukan(x.nama) === cari) ?? null;
}
