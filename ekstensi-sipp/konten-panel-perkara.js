"use strict";

/**
 * ============================================================================
 * PANEL PERKARA SIPP (K11)
 * ============================================================================
 *
 * susunPanel dan semua yang hanya dipakainya: kartu penunjukan, putusan, Data Umum, tab t7, Court Calendar,
 * unggah putusan/e-Doc, bagian Alat saya. Dimuat hanya di halaman perkara.
 *
 * Potongan UTUH konten.js yang lama (K11, 26 Okt 2026): pernyataannya tidak
 * diubah, hanya dipindahkan. Dimuat modul-malas.js ke dunia terasing yang sama
 * dengan konten.js lewat pekerja latar (chrome.scripting.executeScript), sehingga
 * semua const/let/function tingkat atas tetap satu lingkup bersama konten.js.
 */

// Namanya "borang", bukan "formulir".
//
// Sempat tertulis "formulir" dan itu membuat SELURUH tombol Kerjakan mati:
// alamatnya menjawab 404, siapkanKerjakan berhenti pada baris pertama, dan
// tombolnya tinggal diam bertuliskan "ALETA menjawab 404." Rutenya sendiri
// tidak pernah berpindah - yang berpindah hanya sebutannya dalam bahasa
// manusia, dan penggantian nama itu ikut terbawa ke alamat yang seharusnya
// tetap.
const ALETA_API_BORANG = "/aleta/api/aleta-bot/penunjukan/borang";
const ALETA_API_CATAT = "/aleta/api/aleta-bot/penunjukan/catat";
const ALETA_API_ANTREAN = "/aleta/api/aleta-bot/penunjukan/antrean";
const ALETA_API_BERKAS_GUGATAN = "/aleta/api/aleta-bot/penunjukan/berkas";
const ALETA_API_BERKAS_ARSIP = "/aleta/api/aleta-bot/penunjukan/berkas-arsip";
const ALETA_API_HAPUS = "/aleta/api/aleta-bot/penunjukan/hapus";
const ALETA_API_HAPUS_SEMUA = "/aleta/api/aleta-bot/penunjukan/hapus-semua";
const ALETA_API_RIWAYAT = "/aleta/api/aleta-bot/penunjukan/riwayat";
const ALETA_API_MASUK_PEJABAT = "/aleta/api/aleta-ecourt/masuk-pejabat";
const ALETA_API_EKSTENSI = "/aleta/api/aleta-ecourt/ekstensi";
const ALETA_API_ALASAN_PERKARA = "/aleta/api/aleta-ecourt/alasan-perkara";

const STATUS_NOMOR = {
  terverifikasi: { teks: "nomor terkonfirmasi", nada: "aman" },
  menunggu: { teks: "menunggu jawaban konfirmasi", nada: "mendesak" },
  ditolak: { teks: "salah alamat — perbaiki di SIPP", nada: "lewat" },
  belum_pernah_ditanya: { teks: "belum dikonfirmasi", nada: "netral" },
};

/**
 * Kotak keputusan verifikasi untuk hakim.
 *
 * ============================================================================
 * DUA LANGKAH, SELALU
 * ============================================================================
 *
 * Tombol pertama tidak menyentuh jaringan sama sekali - ia hanya membuka
 * pertanyaan. Baru tombol kedua yang mengirim, dan hanya tombol kedua yang
 * membawa konfirmasi:true.
 *
 * Ini keputusan hukum yang menentukan apakah dokumen resmi masuk berkas
 * perkara. Satu jempol yang salah pencet di layar sempit tidak boleh
 * menghasilkan keputusan seperti itu.
 */
function kotakVerifikasi(dokumen) {
  const kotak = buatElemen("div", "aleta-verifikasi");

  const tampilkanPilihan = () => {
    kotak.textContent = "";
    kotak.appendChild(buatElemen("span", "aleta-verifikasi-label", "Verifikasi:"));
    kotak.appendChild(tombolPilih(dokumen, "valid", "Valid", kotak));
    kotak.appendChild(tombolPilih(dokumen, "tidak_valid", "Tidak Valid", kotak));
  };

  const tampilkanKonfirmasi = (keputusan, label) => {
    kotak.textContent = "";
    kotak.appendChild(
      buatElemen("div", "aleta-verifikasi-tanya", `Simpan keputusan ${label}? Pastikan dokumennya sudah dibaca.`)
    );

    const ya = buatElemen("button", "aleta-verifikasi-ya", "Ya, simpan");
    ya.addEventListener("click", async () => {
      ya.disabled = true;
      ya.textContent = "Menyimpan…";
      const hasil = await kirimKeputusan(dokumen, keputusan);
      kotak.textContent = "";
      kotak.appendChild(
        buatElemen("div", hasil.ok ? "aleta-verifikasi-hasil" : "aleta-verifikasi-gagal", hasil.pesan)
      );
      if (hasil.ok) {
        // Muat ulang panel supaya statusnya ikut berubah.
        nomorTerakhir = "";
        setTimeout(() => void segarkan(), 1200);
      }
    });

    const batal = buatElemen("button", "aleta-verifikasi-batal", "Batal");
    batal.addEventListener("click", tampilkanPilihan);

    kotak.appendChild(ya);
    kotak.appendChild(batal);
  };

  function tombolPilih(dok, keputusan, label) {
    const tombol = buatElemen("button", "aleta-verifikasi-pilih", label);
    // Tombol pertama TIDAK mengirim apa pun - hanya membuka pertanyaan.
    tombol.addEventListener("click", () => tampilkanKonfirmasi(keputusan, label));
    return tombol;
  }

  tampilkanPilihan();
  return kotak;
}

/** Mengirim keputusan ke ALETA. Konfirmasi selalu true dari sini. */
async function kirimKeputusan(dokumen, keputusan) {
  try {
    const respons = await alatAmbil(
      ALETA_API,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentKey: dokumen.documentKey, keputusan, konfirmasi: true }),
      },
      "Menyimpan keputusan"
    );

    if (respons.status === 401 || respons.status === 403) {
      return { ok: false, pesan: "Sesi ALETA habis. Masuk lagi lalu ulangi." };
    }

    const hasil = await respons.json();
    const isi = hasil?.data ?? hasil;

    if (isi?.ok) {
      return { ok: true, pesan: `Tersimpan: ${keputusan === "valid" ? "VALID" : "TIDAK VALID"}` };
    }

    const alasan = {
      bukan_anggota_majelis: "Anda tidak tercatat sebagai majelis pada perkara ini.",
      bukan_hakim_terdaftar: "Akun Anda tidak terdaftar sebagai hakim.",
      konfirmasi_belum_diberikan: "Konfirmasi belum diberikan.",
      dokumen_tidak_ditemukan: "Dokumen tidak ditemukan lagi.",
    }[isi?.alasan];

    return { ok: false, pesan: alasan || `Tidak tersimpan (${isi?.alasan || "tidak diketahui"}).` };
  } catch (galat) {
    return { ok: false, pesan: String((galat && galat.message) || galat) };
  }
}

async function ambilStatusPerkara(nomor) {
  if (simpananStatus.nomor === nomor) {
    if (simpananStatus.data) return simpananStatus.data;
    if (simpananStatus.sedang) return simpananStatus.sedang;
  }

  const janji = (async () => {
    const respons = await alatAmbil(
      `${ALETA_API_STATUS}?nomor=${encodeURIComponent(nomor)}`,
      { credentials: "include", cache: "no-store" },
      "Membaca keadaan perkara"
    );
    if (!respons.ok) throw new Error(await pesanGalat(respons));
    const hasil = await respons.json();
    const isi = hasil?.data ?? hasil;

    // Sebabnya disebutkan apa adanya. "Tidak terbaca" saja membuat petugas
    // menduga ekstensinya rusak, padahal jawabannya kerap sederhana: botnya
    // sedang mati, atau nomor perkaranya memang tidak ada di SIPP.
    if (isi?.available === false) {
      throw new Error(isi.message || "ALETA Bot belum dapat dihubungi.");
    }
    if (!isi?.status) {
      throw new Error(
        isi?.alasan
          ? `Keadaan perkara tidak terbaca: ${String(isi.alasan).replace(/_/g, " ")}.`
          : "Keadaan perkara tidak terbaca dari ALETA."
      );
    }
    return isi.status;
  })();

  simpananStatus = { nomor, data: null, sedang: janji };
  try {
    const hasil = await janji;
    simpananStatus = { nomor, data: hasil, sedang: null };
    return hasil;
  } catch (galat) {
    // Kegagalan TIDAK disimpan: menu yang gagal sekali karena jaringan harus
    // dapat dicoba lagi hanya dengan menutup dan membukanya.
    simpananStatus = { nomor: "", data: null, sedang: null };
    throw galat;
  }
}

/**
 * Bagian panel yang isinya baru diambil saat dibuka.
 *
 * Terlipat sebagai bawaan - itulah yang membuatnya tidak berongkos. Saat
 * dibuka pertama kali ia menampilkan "Memuat", lalu menggambar sendiri.
 * Kegagalan disebutkan apa adanya, bukan dibiarkan kosong: menu kosong tanpa
 * keterangan terbaca sebagai perkara yang tidak punya data.
 */
function bagianMalas(judul, kunci, nomor, gambar) {
  const kotak = bagian(judul, kunci, true);
  let sudahDimuat = false;

  // Didaftarkan supaya dapat digambar ulang dari luar. Tanpa ini, membatalkan
  // simpanan hanya menolong menu yang BELUM dibuka - yang sudah terbentang
  // tetap memajang gambar lama sampai panelnya ditutup dan dibuka lagi.
  menuMalasHidup.push(kotak);

  // Menu ini sekarang tidak lagi menunggu ditekan untuk menyebutkan isinya:
  // lencananya diisi panggilan latar, dan itu yang membuat panel dapat dibaca
  // tanpa membuka satu pun menu.
  kotak.kunciLencana = kunci;

  const kepala = kotak.querySelector(".aleta-bagian-judul");
  const muatBagian = () => {
    const isi = kotak.isi;
    if (sudahDimuat || isi.style.display === "none") return;
    sudahDimuat = true;

    isi.appendChild(buatElemen("div", "aleta-memuat", "Memuat dari ALETA…"));
    void (async () => {
      try {
        const status = await ambilStatusPerkara(nomor);
        isi.textContent = "";
        gambar(isi, status);
        if (!isi.hasChildNodes()) {
          isi.appendChild(buatElemen("div", "aleta-kosong", "Tidak ada keterangan untuk bagian ini."));
        }
      } catch (galat) {
        isi.textContent = "";
        isi.appendChild(
          buatElemen("div", "aleta-gagal", String(galat.message || galat).slice(0, 200))
        );
        // Boleh dicoba lagi: tutup lalu buka kembali menunya.
        sudahDimuat = false;
      }
    })();
  };

  /**
   * Menggambar ulang dari awal.
   *
   * Yang TERBUKA digambar ulang seketika; yang tertutup cukup ditandai belum
   * dimuat, supaya ia mengambil yang baru saat dibuka. Menggambar ulang menu
   * yang tertutup berarti memanggil ALETA untuk sesuatu yang tidak sedang
   * dilihat siapa pun.
   */
  kotak.gambarUlang = () => {
    sudahDimuat = false;
    const isi = kotak.isi;
    if (!isi || isi.style.display === "none") return;
    isi.textContent = "";
    muatBagian();
  };

  kepala.addEventListener("click", muatBagian);

  // Dimuat juga ketika bagiannya SUDAH terbentang dari sesi sebelumnya.
  //
  // Keadaan lipatan disimpan antar-sesi. Bila tersimpan sebagai TERBUKA,
  // bagian ini tergambar terbentang tetapi kosong - dan baru terisi sesudah
  // ditekan DUA kali: sekali menutup, sekali membuka. Terbaca sebagai menu
  // yang rusak, padahal hanya pemuatnya yang tidak pernah dipanggil.
  if (kotak.isi.style.display !== "none") {
    setTimeout(muatBagian, 0);
  }

  return kotak;
}

/**
 * Nilai yang hendak diisikan untuk satu formulir, disusun dari usulannya.
 *
 * Yang tidak ada nilainya TIDAK dimasukkan sebagai teks kosong. Kolom yang
 * diisi kosong menimpa isian yang mungkin sudah benar di sana; kolom yang
 * dilewati membiarkannya apa adanya.
 */
function nilaiUntukBorang(formulir, usulan, pilihanManual = {}) {
  const nilai = {};
  const tanggal = usulan.tanggalPenetapan || "";
  if (tanggal) nilai.tanggal_penetapan = tanggal;

  if (formulir === "pmh") {
    // ======================================================================
    // KETIGA KURSINYA DAPAT DIPILIH, BUKAN HANYA KETUA
    // ======================================================================
    //
    // Sebelumnya pilihan manual hanya menimpa KETUA majelis - anggota 1 dan 2
    // tetap dari usulan, apa pun yang dipilih petugas. Akibatnya "manual" pada
    // perkara bermajelis tidak pernah benar-benar manual: yang dapat diubah
    // sepertiga susunannya.
    //
    // Sekarang tiap kursi punya pilihannya sendiri, dan pilihan per-majelis
    // mengisi ketiganya sekaligus.
    const anggota = (usulan.pmh && usulan.pmh.anggota) || [];
    const kolam = (usulan.pmh && usulan.pmh.hitungan) || [];
    const susunanDipilih = susunanTerpilih(usulan.pmh, pilihanManual.majelis);

    for (const [urutan, medan] of [
      [0, "hakim_ketua"],
      [1, "hakim_anggota_1"],
      [2, "hakim_anggota_2"],
    ]) {
      // Urutan sumbernya disengaja: susunan majelis yang dipilih menang atas
      // pilihan per-orang, dan keduanya menang atas usulan. Yang memilih satu
      // susunan utuh sedang menyatakan maksud yang lebih besar daripada satu
      // kursi, dan kursi yang tertinggal dari pilihan sebelumnya tidak boleh
      // menyelinap masuk.
      const dariSusunan = susunanDipilih ? susunanDipilih.anggota[urutan] : null;
      const dariOrang = pilihanDari(kolam, (pilihanManual.pmhKursi || [])[urutan]);
      const orang = dariSusunan || dariOrang || anggota[urutan];
      if (orang && orang.nama) nilai[medan] = orang.nama;
    }
  } else if (formulir === "ppp") {
    const pp = pilihanDari(usulan.ppp && usulan.ppp.calon, pilihanManual.ppp)
      || (usulan.ppp && usulan.ppp.usulan);
    if (pp) nilai.panitera = pp.nama;
  } else if (formulir === "pjs") {
    const js = pilihanDari(usulan.pjs && usulan.pjs.calon, pilihanManual.pjs)
      || (usulan.pjs && usulan.pjs.usulan);
    if (js) nilai.jurusita = js.nama;
  } else if (formulir === "phs") {
    // Pilihan petugas SELALU menang atas usulan - lihat tanggalSidangTerpilih.
    const tanggalSidang = tanggalSidangTerpilih(usulan, pilihanManual);
    if (tanggalSidang) nilai.tanggal_sidang = tanggalSidang;
  }

  return nilai;
}

async function tetapkanLewatAleta(tombol, kabar, usulan, data, keadaan, kering, opsi = {}) {
  const nomorKunci = String((usulan && usulan.perkara && usulan.perkara.nomorPerkara) || (usulan && usulan.perkara && usulan.perkara.perkaraId) || "");
  // opsi.kunciDipegang: pemanggil sudah memegang kunci ini untuk SELURUH urutannya
  // (uji kering sampai e-Doc) dan melepasnya sendiri.
  const kunciSendiri = !kering && nomorKunci && !(opsi && opsi.kunciDipegang);
  if (kunciSendiri) {
    if (kunciTulisPenetapan.has(nomorKunci)) {
      const bunyi = "Penetapan perkara ini sedang ditulis dari tempat lain di halaman ini. Tunggu sampai selesai - tidak ditulis dua kali.";
      return { ok: false, dikerjakan: 0, hasil: [{ jenis: URUTAN_TULIS[0], ok: false, alasan: "sedang_ditulis", bunyi }] };
    }
    kunciTulisPenetapan.add(nomorKunci);
  }
  // Sebelum menulis: simpan alamat perkara ini supaya sesudah memuat ulang
  // halaman TETAP di perkara yang sama (muat-ulang-sipp.js).
  if (!kering && globalThis.aletaMuatUlangSipp) {
    try {
      await globalThis.aletaMuatUlangSipp.catatAlamat(String((usulan && usulan.perkara && usulan.perkara.nomorPerkara) || ""));
    } catch {
      /* alamat hanya kemudahan */
    }
  }
  try {
    return await tetapkanLewatAletaInti(tombol, kabar, usulan, data, keadaan, kering, opsi);
  } finally {
    if (kunciSendiri) kunciTulisPenetapan.delete(nomorKunci);
  }
}

async function tetapkanLewatAletaInti(tombol, kabar, usulan, data, keadaan, kering, opsi = {}) {
  const perkaraId = Number((usulan.perkara && usulan.perkara.perkaraId) || 0);
  if (!perkaraId) {
    kabar.textContent = "Perkara tidak dikenali.";
    return { ok: false };
  }

  const hasil = await rantaiPenetapan(usulan, data, kering);

  // Rapor hanya disusun untuk uji kering - pada penulisan sungguhan yang
  // dibaca orang hasilnya, bukan ramalannya.
  gambarHasilTulis(kabar, hasil, kering, kering ? raporPraperiksa(usulan, data, hasil) : null);
  // Perbaikan 6 Okt (butir 17) - UI Baru saja: penetapan yang SUNGGUH
  // tertulis langsung disusul edoc-nya dari blangko ABT (Peta penetapan).
  // Tidak ditunggu: penetapannya sudah tertulis, edoc punya kabarnya sendiri.
  // opsi.tanpaEdocOtomatis: pemanggil (panel "Penetapan Otomatis" di halaman
  // SIPP) mengunggah e-Doc sendiri menurut kotak centang per penetapan.
  let edocJanji = null;
  if (!kering && !opsi.tanpaEdocOtomatis && typeof e6SesudahPenetapanTertulis === "function") {
    try {
      // Janjinya dibawa ke pemanggil: halaman baru dimuat ulang SESUDAH e-Doc
      // otomatisnya selesai, bukan memotongnya di tengah unggah.
      edocJanji = Promise.resolve(e6SesudahPenetapanTertulis(kabar, usulan, hasil)).catch(() => undefined);
      void edocJanji;
    } catch {
      /* edoc tidak pernah menggagalkan penetapan */
    }
  }
  // Langkah yang SUDAH ada di SIPP bukan kegagalan (keluhan 5, 7 Okt 2026).
  // Sebelumnya ok menuntut keempatnya ok, sehingga perkara yang PMH-nya
  // dikerjakan tangan tidak pernah lulus uji kering - tombol "Tuliskan ke
  // SIPP" tidak pernah terbuka, dan PPP, PJS, PHS tidak dapat dikerjakan.
  const dikerjakan = hasil.filter((x) => x.ok).length;
  const ringkas = { ok: hasil.every((x) => x.ok || x.sudahAda === true), dikerjakan, hasil, edocJanji };
  // Kartu Penetapan UI Baru (satu klik) membaca hasil per langkah dari sini -
  // hanya pemberitahuan ke layar, tidak mengubah apa pun yang ditulis.
  try {
    if (tombol && typeof tombol.dispatchEvent === "function" && typeof CustomEvent === "function") {
      tombol.dispatchEvent(new CustomEvent("aleta-hasil-penetapan", { bubbles: true, detail: { kering: Boolean(kering), ...ringkas } }));
    }
  } catch {
    /* layar saja */
  }
  return ringkas;
}

/** Penulisan sungguhan yang gagal tanpa satu langkah pun tertulis (rantai dibatalkan utuh) - aman diulang. */
function rantaiDibatalkanUtuh(hasil) {
  const daftar = (hasil && hasil.hasil) || [];
  return !hasil.ok && daftar.every((x) => !x.ok) && !daftar.some((x) => /pembatalan di server tidak terkonfirmasi/.test(String(x.bunyi || "")));
}

/**
 * ============================================================================
 * MEMBATALKAN PENETAPAN YANG SUDAH TERTULIS
 * ============================================================================
 *
 * Penetapan yang salah tidak dapat diperbaiki dengan menekan ulang: tabelnya
 * menolak baris kedua, dan yang tertinggal perkara yang separuh tertulis.
 * Sebelum ada tombol ini, jalan keluarnya membongkar dengan tangan dari
 * beberapa tabel sekaligus.
 *
 * Yang dibatalkan selalu langkah TERAKHIR yang masih ada, dari PHS ke PMH.
 * Urutannya tidak dapat dibalik - membongkar majelis selagi hari sidangnya
 * masih berdiri meninggalkan sidang bagi majelis yang sudah tidak ada - dan
 * servernya menolak permintaan semacam itu. Yang dikerjakan di sini hanya
 * mencarikan langkah yang memang boleh dibongkar.
 *
 * Dua tekanan, sama seperti menulis: yang pertama memperlihatkan rencananya,
 * yang kedua membongkar.
 */
const URUTAN_BONGKAR = ["phs", "pjs", "ppp", "pmh"];

async function mintaBongkar(perkaraId, jenis, olehUsername, kering) {
  try {
    const respons = await alatAmbil(
      ALETA_API_HAPUS,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        // akunSippMasuk: akun SIPP yang sedang masuk - penekan, dicatat di jejak
        // ALETA. Yang dicatat SIPP: akun pejabat penetapan itu (butir 17).
        // perintahPengguna: tanda bahwa pengguna sendiri menekan Bongkar. Hanya
        // tombol Bongkar yang memanggil fungsi ini; mode otomatis tidak pernah.
        body: JSON.stringify({ jenis, perkaraId, olehUsername, akunSippMasuk: namaPenggunaSipp(), kering, perintahPengguna: kering ? "" : "bongkar" }),
      },
      kering ? "Menyusun rencana pembatalan" : "Membatalkan penetapan"
    );
    const luar = await respons.json();
    return (luar && luar.data ? luar.data : luar) || { ok: false, alasan: "tanpa_jawaban" };
  } catch (galat) {
    return { ok: false, alasan: String((galat && galat.message) || galat) };
  }
}

/**
 * Membongkar SELURUH rantai penetapan satu perkara dalam satu permintaan.
 *
 * Rantainya diurus bot, bukan di sini. Empat permintaan terpisah dari
 * peramban adalah empat kesempatan berhenti di tengah - dan perkara yang
 * separuh terbongkar justru keadaan yang paling sukar dibereskan.
 */
async function mintaBongkarSemua(perkaraId, akunPerJenis, kering) {
  try {
    const respons = await alatAmbil(
      ALETA_API_HAPUS_SEMUA,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perkaraId, akunPerJenis, akunSippMasuk: namaPenggunaSipp(), kering, perintahPengguna: kering ? "" : "bongkar" }),
      },
      kering ? "Menyusun rencana pembatalan menyeluruh" : "Membatalkan seluruh penetapan"
    );
    const luar = await respons.json();
    return (luar && luar.data ? luar.data : luar) || { ok: false, alasan: "tanpa_jawaban" };
  } catch (galat) {
    return { ok: false, alasan: String((galat && galat.message) || galat) };
  }
}

/**
 * Langkah terakhir yang masih ada dan boleh dibongkar.
 *
 * Dicari dengan uji kering, bukan ditebak dari layar: yang tahu langkah mana
 * yang masih berdiri adalah basis data SIPP, dan panel ini mungkin sudah lama
 * terbuka sejak keadaannya berubah.
 */
async function cariLangkahDibongkar(perkaraId, akunPerJenis) {
  for (const jenis of URUTAN_BONGKAR) {
    const oleh = akunPerJenis[jenis] || "";
    if (!oleh) continue;
    const jawab = await mintaBongkar(perkaraId, jenis, oleh, true);
    if (jawab && jawab.ok) return { jenis, oleh, rencana: jawab };
  }
  return null;
}

/** "Nama Pejabat (akun SIPP username)" - akun yang DICATAT di SIPP (butir 17). */
function sebutAtasNama(atasNama, cadangan) {
  const username = String((atasNama && atasNama.username) || cadangan || "");
  const nama = String((atasNama && atasNama.namaLengkap) || "");
  if (!username) return nama;
  return nama ? `${nama} (akun SIPP ${username})` : `akun SIPP ${username}`;
}

function bagianBatalkanPenetapan(usulan, data) {
  const perkaraId = Number((usulan.perkara && usulan.perkara.perkaraId) || 0);
  const kotak = buatElemen("div", "aleta-tetap-kaki");
  if (!perkaraId) return kotak;

  const tombol = buatElemen("button", "aleta-portal-tautan", "Batalkan penetapan terakhir");
  tombol.type = "button";
  const kabar = buatElemen("span", "aleta-tetap-sebab", "");

  // Akun pejabat tiap langkah - sama dengan yang dipakai menuliskannya, supaya
  // pembongkarannya tercatat atas nama yang sama.
  const rencanaLangkah = (data && data.rencana && data.rencana.langkah) || [];
  const akunPerJenis = {};
  for (const langkah of rencanaLangkah) {
    if (langkah && langkah.jenis && langkah.akun && langkah.akun.username) {
      akunPerJenis[langkah.jenis] = langkah.akun.username;
    }
  }
  for (const jenis of URUTAN_BONGKAR) {
    if (!akunPerJenis[jenis] && data && data.pejabatDipilih && data.pejabatDipilih[jenis]) {
      akunPerJenis[jenis] = data.pejabatDipilih[jenis];
    }
  }

  let siapDibongkar = null;

  tombol.addEventListener("click", async () => {
    tombol.disabled = true;

    if (!siapDibongkar) {
      kabar.textContent = "Mencari penetapan yang dapat dibatalkan…";
      const ketemu = await cariLangkahDibongkar(perkaraId, akunPerJenis);
      if (!ketemu) {
        kabar.textContent =
          "Tidak ada penetapan yang dapat dibatalkan dari sini. Langkah yang sudah diikuti langkah " +
          "berikutnya harus dibatalkan dari yang paling akhir lebih dulu.";
        tombol.disabled = false;
        return;
      }
      siapDibongkar = ketemu;
      const jumlah = (ketemu.rencana.rencana || []).length;
      kabar.textContent =
        `${ketemu.jenis.toUpperCase()} akan dibongkar dan dicatat atas nama ${sebutAtasNama(ketemu.rencana.atasNama, ketemu.oleh)} - ${jumlah} pernyataan, ` +
        "termasuk baris Riwayat Perkara. Belum ada yang dihapus. Tekan sekali lagi untuk membatalkan.";
      tombol.textContent = `Batalkan ${ketemu.jenis.toUpperCase()} sekarang`;
      tombol.disabled = false;
      return;
    }

    kabar.textContent = `Membatalkan ${siapDibongkar.jenis.toUpperCase()}…`;
    const hasil = await mintaBongkar(perkaraId, siapDibongkar.jenis, siapDibongkar.oleh, false);
    if (!hasil || !hasil.ok) {
      kabar.textContent = `Gagal: ${(hasil && hasil.alasan) || "tidak diketahui"}`;
      tombol.disabled = false;
      return;
    }
    kabar.textContent = `${siapDibongkar.jenis.toUpperCase()} dibatalkan. Halaman dimuat ulang sebentar lagi.`;
    setTimeout(muatUlangHalamanPerkara, 2000);
  });

  kotak.appendChild(tombol);
  kotak.appendChild(kabar);

  // ==========================================================================
  // DAN SATU LAGI: SELURUHNYA SEKALIGUS
  // ==========================================================================
  //
  // Membatalkan satu per satu menuntut empat kali dua tekanan, berurutan dari
  // PHS mundur ke PMH. Delapan tekanan yang urutannya harus diingat adalah
  // delapan kesempatan berhenti di tengah, dan perkara yang separuh
  // terbongkar justru keadaan yang paling sukar dibereskan.
  //
  // Tetap DUA tekanan, sama seperti yang lain: yang pertama memperlihatkan
  // rencananya langkah demi langkah beserta cacah pernyataannya, yang kedua
  // membongkar. Yang membaca rencana itu tahu persis apa yang akan hilang
  // sebelum satu baris pun hilang.
  kotak.appendChild(tombolBongkarSemua(perkaraId, akunPerJenis));
  return kotak;
}

/** Tombol yang membongkar seluruh rantai penetapan satu perkara. */
function tombolBongkarSemua(perkaraId, akunPerJenis) {
  const baris = buatElemen("div", "aleta-bongkar-semua");
  const tombol = buatElemen("button", "aleta-portal-tautan", "Batalkan SELURUH penetapan perkara ini");
  tombol.type = "button";
  const kabar = buatElemen("span", "aleta-tetap-sebab", "");
  let sudahDiperlihatkan = false;

  tombol.addEventListener("click", async () => {
    tombol.disabled = true;

    if (!sudahDiperlihatkan) {
      kabar.textContent = "Menyusun rencana pembatalan menyeluruh…";
      const rencana = await mintaBongkarSemua(perkaraId, akunPerJenis, true);
      const langkah = (rencana && rencana.langkah) || [];

      if (langkah.length === 0) {
        kabar.textContent =
          (rencana && rencana.berhentiKarena && rencana.berhentiKarena.alasan) ||
          "Tidak ada penetapan yang dapat dibatalkan pada perkara ini.";
        tombol.disabled = false;
        return;
      }

      kabar.textContent = "";
      const daftar = buatElemen("div", "aleta-bongkar-rencana");
      daftar.appendChild(
        buatElemen(
          "div",
          "aleta-tulis-judul",
          "Akan dibongkar berurutan - belum ada yang dihapus:"
        )
      );
      for (const x of langkah) {
        const nama = x.atasNama ? sebutAtasNama(x.atasNama, "") : "";
        daftar.appendChild(
          buatElemen(
            "div",
            "aleta-baris-ket",
            `${String(x.jenis).toUpperCase()} — ${x.jumlahPernyataan} pernyataan pada ${(x.tabel || []).length} tabel` +
              (nama ? ` · atas nama ${nama}` : "")
          )
        );
      }
      if (rencana.berhentiKarena) {
        daftar.appendChild(
          buatElemen(
            "div",
            "aleta-baris-ket aleta-lencana-lewat",
            `Berhenti di ${String(rencana.berhentiKarena.jenis).toUpperCase()}: ${rencana.berhentiKarena.alasan}`
          )
        );
      }
      kabar.appendChild(daftar);

      sudahDiperlihatkan = true;
      tombol.textContent = `Bongkar ${langkah.length} penetapan sekarang`;
      tombol.disabled = false;
      return;
    }

    kabar.textContent = "Membongkar…";
    const hasil = await mintaBongkarSemua(perkaraId, akunPerJenis, false);
    const langkah = (hasil && hasil.langkah) || [];
    const berhasil = langkah.filter((x) => x.ok).length;

    if (!hasil || !hasil.ok) {
      const sebab =
        (hasil && hasil.berhentiKarena && hasil.berhentiKarena.alasan) ||
        (hasil && hasil.alasan) ||
        "tidak diketahui";
      // Yang SUDAH terbongkar disebutkan, bukan ditelan bersama pesan gagal:
      // yang membacanya perlu tahu sampai mana perkaranya terbongkar.
      kabar.textContent = berhasil
        ? `Berhenti sesudah ${berhasil} langkah: ${sebab}`
        : `Gagal: ${sebab}`;
      tombol.disabled = false;
      return;
    }

    kabar.textContent = `${berhasil} penetapan dibatalkan. Halaman dimuat ulang sebentar lagi.`;
    setTimeout(muatUlangHalamanPerkara, 2000);
  });

  baris.appendChild(tombol);
  baris.appendChild(kabar);
  return baris;
}

/** Menggambarkan hasil keempat langkah - kering maupun sungguhan. */
function gambarHasilTulis(kabar, hasil, kering, rapor) {
  kabar.textContent = "";
  const kotak = buatElemen("div", "aleta-tulis-hasil");

  kotak.appendChild(
    buatElemen(
      "div",
      "aleta-tulis-judul",
      kering
        ? "Rencana penetapan - belum ada yang ditulis. Periksa, lalu tekan sekali lagi."
        : "Hasil penetapan"
    )
  );

  // Rapor dalam kalimat lebih dahulu, rincian pernyataannya di bawah. Yang
  // memeriksa sebelum menekan membaca yang pertama; yang menelusuri sesudah
  // ada yang keliru membaca yang kedua.
  if (kering && rapor) kotak.appendChild(gambarRaporPraperiksa(rapor));

  for (const satu of hasil) {
    // Langkah yang sudah ada di SIPP (dikerjakan tangan atau lebih dahulu)
    // tidak ditulis ulang - dan bukan kegagalan, jadi tidak bernada merah.
    if (satu.sudahAda) {
      const sudahBaris = buatElemen("div", "aleta-tulis-baris aleta-tulis-sudah");
      sudahBaris.appendChild(buatElemen("span", "aleta-tulis-jenis", satu.jenis.toUpperCase()));
      sudahBaris.appendChild(
        buatElemen(
          "span",
          "aleta-tulis-ket",
          `sudah ada di SIPP${satu.tanggalPenetapan ? ` (${sebutTanggal(satu.tanggalPenetapan)})` : ""} - dilewati`
        )
      );
      kotak.appendChild(sudahBaris);
      continue;
    }
    const baris = buatElemen("div", satu.ok ? "aleta-tulis-baris" : "aleta-tulis-baris aleta-tulis-gagal");
    const atas = satu.atasNama && (satu.atasNama.namaLengkap || satu.atasNama.username);
    baris.appendChild(
      buatElemen(
        "span",
        "aleta-tulis-jenis",
        `${satu.jenis.toUpperCase()}${atas ? ` — ${atas}` : ""}`
      )
    );
    baris.appendChild(
      buatElemen(
        "span",
        "aleta-tulis-ket",
        satu.ok
          ? kering
            ? `${(satu.langkah || []).length} pernyataan disiapkan`
            : "ditetapkan"
          : // Bunyinya, bukan kodenya - lihat kalimatAlasan. Kodenya tetap
            // dipakai penjaga di tempat lain, tetapi yang DIBACA orang harus
            // menyebutkan jalan keluarnya.
            satu.bunyi || satu.alasan
      )
    );
    kotak.appendChild(baris);

    // ======================================================================
    // TANGGALNYA DIULANG SESUDAH EKSEKUSI
    // ======================================================================
    //
    // Yang sudah tertulis ke SIPP tidak dapat dilihat lagi dari panel tanpa
    // membuka SIPP. Rapor praperiksa menyebut tanggalnya sebelum ditekan,
    // lalu hilang begitu tertulis - sehingga yang ingin memastikan apa yang
    // barusan terjadi harus berpindah aplikasi.
    //
    // Hanya pada penulisan SUNGGUHAN: pada uji kering tanggalnya sudah
    // disebut rapor di atas, dan mengulangnya di tiap baris hanya
    // memanjangkan yang sudah terbaca.
    if (!kering && satu.ok && satu.tanggalPenetapan) {
      kotak.appendChild(
        buatElemen("div", "aleta-tulis-ket", `Bertanggal ${sebutTanggal(satu.tanggalPenetapan)}`)
      );
    }

    for (const catatan of satu.catatanTanggal || []) {
      if (catatan) kotak.appendChild(buatElemen("div", "aleta-tulis-ket", catatan));
    }

    // Andaian yang dipakai menyusun langkah ini - mis. PHS dinilai dengan
    // menganggap PMH sudah ditulis. Disebutkan supaya yang membacanya tahu
    // rencana ini dinilai atas keadaan yang BELUM ada.
    for (const satuAndaian of satu.andaian || []) {
      kotak.appendChild(buatElemen("div", "aleta-tulis-ket", `Andaian: ${satuAndaian}`));
    }
  }

  // Yang tidak sempat dijalankan disebut apa adanya. Diamnya membuat orang
  // menyangka keempatnya sudah dikerjakan padahal berhenti di langkah kedua.
  const sudah = new Set(hasil.map((x) => x.jenis));
  const belum = URUTAN_TULIS.filter((x) => !sudah.has(x));
  if (belum.length > 0) {
    kotak.appendChild(
      buatElemen(
        "div",
        "aleta-tulis-ket",
        `Tidak dilanjutkan: ${belum.map((x) => x.toUpperCase()).join(", ")} - urutannya tidak dapat dibalik.`
      )
    );
  }

  kabar.appendChild(kotak);
}

/** Menggambar rapor praperiksa - lihat raporPraperiksa. */
function gambarRaporPraperiksa(rapor) {
  const kotak = buatElemen("div", "aleta-praperiksa");

  for (const b of rapor.baris) {
    const baris = buatElemen("div", "aleta-praperiksa-baris");
    baris.appendChild(buatElemen("span", "aleta-praperiksa-label", b.label));
    const nilai = buatElemen("span", "aleta-praperiksa-nilai");
    nilai.appendChild(buatElemen("span", "aleta-praperiksa-isi", b.nilai));
    if (b.sebab) nilai.appendChild(buatElemen("span", "aleta-praperiksa-sebab", b.sebab));
    baris.appendChild(nilai);
    kotak.appendChild(baris);
  }

  if (rapor.sudahAda.length > 0) {
    kotak.appendChild(
      buatElemen(
        "div",
        "aleta-praperiksa-catatan",
        `Sudah ada di SIPP dan karena itu dilewati: ${rapor.sudahAda.join(", ")}.`
      )
    );
  }

  for (const g of rapor.ganjalan) {
    kotak.appendChild(buatElemen("div", "aleta-praperiksa-ganjal", g));
  }

  if (rapor.baris.length === 0 && rapor.ganjalan.length === 0) {
    kotak.appendChild(
      buatElemen("div", "aleta-praperiksa-catatan", "Tidak ada usulan yang dapat diperiksa.")
    );
  }

  return kotak;
}

/** Baris catatan untuk satu formulir - apa yang diisikan, dan dari mana asalnya. */
function barisCatatan(formulir, nilai, usulan, pilihanManual = {}) {
  const sebab =
    formulir === "pmh"
      ? (usulan.pmh && usulan.pmh.sebab) || ""
      : formulir === "ppp"
        ? (usulan.ppp && usulan.ppp.sebab) || ""
        : formulir === "pjs"
          ? (usulan.pjs && usulan.pjs.sebab) || ""
          : (usulan.phs && usulan.phs.sebab) || "";

  /**
   * Apakah medan ini benar-benar berasal dari pilihan tangan.
   *
   * Bukan sekadar "cara papan sedang manual": petugas dapat menyalakan manual
   * lalu tidak mengubah apa pun, dan mencatat seluruhnya sebagai pilihan
   * tangan akan menghapus jejak bahwa usulan ALETA-lah yang dipakai. Yang
   * dicatat manual hanya medan yang memang ada pilihannya.
   */
  const dipilihTangan = (medan) => {
    if (formulir === "ppp") return Boolean(pilihanManual.ppp);
    if (formulir === "pjs") return Boolean(pilihanManual.pjs);
    if (formulir === "phs") return medan === "tanggal_sidang" && Boolean(pilihanManual.phs);
    if (formulir === "pmh") {
      if (pilihanManual.majelis) return medan.startsWith("hakim_");
      const kursi = pilihanManual.pmhKursi || [];
      const urutan = { hakim_ketua: 0, hakim_anggota_1: 1, hakim_anggota_2: 2 }[medan];
      return urutan !== undefined && Boolean(kursi[urutan]);
    }
    return false;
  };

  return Object.entries(nilai).map(([medan, isi]) => ({
    jenis: formulir,
    medan,
    nilai: String(isi),
    asal: dipilihTangan(medan) ? "manual" : "otomatis",
    alasan: dipilihTangan(medan)
      ? `${sebab} · diubah tangan${pilihanManual.majelis && formulir === "pmh" ? " lewat pilihan majelis" : ""}`
      : sebab,
  }));
}

/**
 * Sederet pil pilihan yang DAPAT ditekan.
 *
 * ============================================================================
 * DULU HANYA PENANDA - DAN ITU MENYESATKAN
 * ============================================================================
 *
 * Semula pilnya berupa <span> tanpa penangan apa pun: bentuknya persis tombol,
 * warnanya membedakan yang aktif, tetapi menekannya tidak melakukan apa-apa.
 * Yang membacanya wajar menyimpulkan aplikasinya rusak - dan kesimpulan itu
 * jauh lebih merugikan daripada tidak ada saklar sama sekali.
 *
 * Sekarang ia benar-benar tombol. Pemanggil yang TIDAK memberi onPilih
 * mendapat pil yang tampak mati dan menyebutkan dirinya belum dapat diubah -
 * bukan tombol hidup yang diam.
 */
function saklarPapan(nama, pilihan, aktif, onPilih) {
  const baris = buatElemen("div", "aleta-saklar");
  baris.appendChild(buatElemen("span", "aleta-saklar-nama", nama));

  for (const pil of pilihan) {
    const tombol = buatElemen("button", "aleta-saklar-pil", pil.label);
    tombol.type = "button";
    if (pil.nilai === aktif) tombol.classList.add("aleta-saklar-aktif");

    if (typeof onPilih === "function") {
      tombol.addEventListener("click", () => {
        if (pil.nilai === aktif) return;
        onPilih(pil.nilai);
      });
    } else {
      tombol.disabled = true;
      tombol.title = "Keadaan sekarang - belum dapat diubah dari sini.";
    }

    baris.appendChild(tombol);
  }
  return baris;
}

/**
 * Satu baris penetapan: judulnya, usulannya, dan SEBABNYA.
 *
 * Sebabnya selalu ikut ditampilkan, bukan disembunyikan di balik tanda tanya.
 * Usulan yang muncul tanpa alasan hanya bisa dipercaya atau tidak dipercaya;
 * usulan yang menyebutkan dasarnya bisa DIPERIKSA - dan memeriksa itulah
 * seluruh gunanya papan ini ada sebelum tombolnya dinyalakan.
 */
/**
 * Jabatan yang MENETAPKAN tiap penetapan - bukan yang ditunjuk di dalamnya.
 *
 * Dua hal yang mudah tertukar saat membaca papan: PMH berisi nama hakimnya,
 * tetapi yang MENETAPKAN adalah Ketua Pengadilan. PHS berisi tanggal, dan yang
 * menetapkannya ketua majelis perkara itu - bukan pimpinan.
 */
const SEBUTAN_PENETAP = {
  pmh: "Ketua Pengadilan",
  ppp: "Panitera",
  pjs: "Panitera",
  phs: "ketua majelis",
};

/** Keterangan sekali pakai yang menerangkan angka beban di atasnya. */
function keteranganBeban() {
  return buatElemen(
    "div",
    "aleta-tetap-hitung",
    "Beban dihitung berbobot - cerai & itsbat 1, harta bersama/waris/wasiat/ekonomi syariah 2, selain itu 1,5."
  );
}

function penetapUntuk(data, jenis) {
  const jabatan = SEBUTAN_PENETAP[jenis] || "";
  const rencana = data && data.rencana;
  const langkah =
    rencana && Array.isArray(rencana.langkah)
      ? rencana.langkah.find((x) => x.jenis === jenis)
      : null;
  // ==========================================================================
  // YANG DIPILIH PETUGAS MENANG ATAS PILIHAN MESIN
  // ==========================================================================
  //
  // `langkah.akun` adalah calon yang DIPILIH MESIN. Ketika petugas mengganti
  // pejabatnya pada "Pejabat yang menetapkan", yang berubah hanya
  // data.pejabatDipilih - dan baris keterangan ini tetap menyebut nama lama.
  //
  // Selisih itu tidak berbunyi: yang tertulis di SIPP adalah pilihan petugas,
  // yang terbaca di layar pilihan mesin. Keduanya masuk akal, keduanya tampak
  // benar, dan hanya satu yang tercatat.
  const dipilih = data && data.pejabatDipilih && data.pejabatDipilih[jenis];
  const calonDipilih =
    dipilih && langkah && Array.isArray(langkah.calon)
      ? langkah.calon.find((x) => x.username === dipilih)
      : null;
  const akun = calonDipilih || (langkah ? langkah.akun : null);

  if (!akun) return jabatan ? `Ditetapkan ${jabatan}` : "";

  // Sebutan dari server MENANG atas daftar di atas. PMH ditandatangani Ketua -
  // kecuali Ketua sedang berhalangan, dan yang menandatangani Wakil atau
  // seorang Hakim sebagai Plh; PPP/PJS ditandatangani Panitera, kecuali ia
  // berhalangan dan ada Plh Panitera. Daftar di atas tidak dapat mengetahui
  // itu; yang merakit rencana tahu, karena ia membaca penugasan yang berlaku.
  const sebutan = akun.sebutan || jabatan;

  const bagian = [`Ditetapkan ${sebutan}`];
  if (akun.namaLengkap) bagian.push(`— ${akun.namaLengkap}`);
  if (akun.username) bagian.push(`(akun ${akun.username})`);

  let teks = bagian.join(" ");
  // Ketua majelis baru pasti SESUDAH PMH tersimpan; sampai saat itu yang
  // tertulis di sini masih dugaan dari usulan, dan itu disebutkan apa adanya.
  if (akun.tentatif) teks += " · dipastikan ulang setelah penetapan majelis tersimpan";
  if (akun.siap === false && akun.sebab) teks += ` · ${akun.sebab}`;

  // Catatan tentang penetapnya dibaca petugas DI SINI, pada baris yang
  // menyebut namanya - bukan di tempat lain. Di sinilah tertulis SK Plh yang
  // tercatat tetapi tidak dipakai, dan keadaan pejabatnya berhalangan tanpa
  // Plh sama sekali. Sebelum ini keduanya hanya ada di dalam rencana, terkirim
  // sampai ke peramban lalu tidak pernah digambar - sama saja dengan diam.
  const catatan = Array.isArray(langkah.catatanPenetap) ? langkah.catatanPenetap : [];
  for (const c of catatan) {
    if (c) teks += ` · ${c}`;
  }
  return teks;
}

function barisPenetapan(judul, isiTeks, sebab, peringatan, penetap) {
  const baris = buatElemen("div", "aleta-tetap");
  baris.appendChild(buatElemen("span", "aleta-tetap-label", judul));

  const nilai = buatElemen("span", "aleta-tetap-nilai");
  nilai.appendChild(
    buatElemen("span", isiTeks ? "aleta-tetap-isi" : "aleta-tetap-kosong", isiTeks || "belum dapat diusulkan")
  );
  if (sebab) nilai.appendChild(buatElemen("span", "aleta-tetap-sebab", sebab));
  // Siapa yang menetapkan dibedakan dari sebab usulannya: yang satu menjawab
  // "mengapa nama ini", yang lain "akun siapa yang harus mengerjakannya".
  if (penetap) nilai.appendChild(buatElemen("span", "aleta-tetap-penetap", penetap));
  if (peringatan) nilai.appendChild(buatElemen("span", "aleta-tetap-awas", peringatan));

  baris.appendChild(nilai);
  return baris;
}

/**
 * ============================================================================
 * PENETAPAN YANG SUDAH TERCATAT DIGAMBAR SEBAGAI TERCATAT (uji rilis U1, 9 Okt)
 * ============================================================================
 *
 * Penetapan tahap sisa (1.188.0) melewati langkah yang sudah ada di SIPP -
 * tetapi papannya tetap menggambar USULAN mesin untuk langkah itu. Pada
 * perkara 653/Pdt.G/2026/PA.Dgl (SIPP satker, 9 Okt) PMH dikerjakan tangan
 * atas majelis C, sedangkan baris "Penetapan Majelis Hakim" menampilkan
 * usulan majelis lain - di UI Baru berlabel "Usulan ALETA" dan bertombol
 * "Ubah" - padahal yang tidak akan pernah ditulis.
 *
 * Langkah yang sudah bertanggal di perkara_penetapan kini digambar dari
 * yang TERCATAT (nama majelis, panitera, juru sita, sidang pertama) dengan
 * tanggalnya, tanpa pilihan dan tanpa pejabat penetap.
 */
const TERCATAT_PENETAPAN = { pmh: "majelisNama", ppp: "paniteraText", pjs: "jurusitaText" };

function barisPenetapanTercatat(judul, jenis, usulan) {
  const p = (usulan && usulan.penetapan) || {};
  const tanggal = keadaanPenetapanUsulan(usulan)[jenis];
  const teks =
    jenis === "phs"
      ? p.sidangPertama
        ? `sidang pertama ${sebutTanggal(String(p.sidangPertama).slice(0, 10))}`
        : ""
      : bersihkanPemisahBr(p[TERCATAT_PENETAPAN[jenis]]);
  const baris = buatElemen("div", "aleta-tetap aleta-tetap-sudah");
  baris.appendChild(buatElemen("span", "aleta-tetap-label", judul));
  const nilai = buatElemen("span", "aleta-tetap-nilai");
  nilai.appendChild(buatElemen("span", "aleta-tetap-isi aleta-tetap-tercatat", teks || "tercatat di SIPP"));
  nilai.appendChild(
    buatElemen("span", "aleta-tetap-sebab", `sudah ada di SIPP (${tanggal === "ada" ? "tanggal belum terisi" : sebutTanggal(tanggal)}) - tidak ditulis ulang`)
  );
  baris.appendChild(nilai);
  return baris;
}

/** Langkah yang belum ada di SIPP, urut PMH -> PHS. */
function langkahSisaPenetapan(usulan) {
  const sudah = keadaanPenetapanUsulan(usulan);
  return URUTAN_TULIS.filter((jenis) => !sudah[jenis]);
}

async function muatUlangUsulan(isi, data, hakimId) {
  const nomor =
    (data && data.nomorPerkara) ||
    (data && data.usulan && data.usulan.perkara && data.usulan.perkara.nomorPerkara);
  if (!nomor) return;

  isi.textContent = "";
  isi.appendChild(buatElemen("div", "aleta-memuat", "Menghitung ulang untuk majelis itu…"));
  try {
    const baru = await ambilUsulanPenunjukan(nomor, hakimId);
    data.usulan = baru.usulan;
    data.rencana = baru.rencana;
    if (baru.pengaturan) data.pengaturan = baru.pengaturan;
    data.majelisDipilih = Array.isArray(hakimId) && hakimId.length > 0 ? hakimId : null;
    // ======================================================================
    // TANGGAL SIDANG MILIK MAJELIS LAMA DILEPAS
    // ======================================================================
    //
    // Hari sidang tiap majelis berbeda - A Rabu, B Selasa. Tanggal yang
    // dipilih dari daftar hari sidang majelis B tidak ada di daftar majelis
    // A, dan tanpa baris ini ia jatuh ke jalur "tanggal bebas": tetap
    // terpakai, dengan peringatan "di luar hari sidang majelis". Peringatan
    // itu benar, tetapi tanggalnya bukan pilihan orang - ia sisa.
    //
    // Yang DIPERTAHANKAN: tanggal bebas yang sengaja dibuka lewat saklarnya.
    // Itu keputusan yang diketik, bukan sisa dari majelis lain.
    if (data.pilihanManual && !data.pilihanManual.phsBebas) {
      data.pilihanManual.phs = "";
    }
    // Pejabat penetap disusun ulang server untuk majelis baru - pilihan lama
    // menunjuk ketua majelis yang sudah tidak berlaku.
    data.pejabatDipilih = {};
    usulanTerakhir = data;
  } catch (galat) {
    isi.textContent = "";
    isi.appendChild(buatElemen("div", "aleta-gagal", String(galat.message || galat).slice(0, 200)));
    return;
  }
  isi.textContent = "";
  gambarPenunjukan(isi, data);
}

function gambarPenunjukan(isi, data) {
  const usulan = data.usulan;
  if (!usulan || usulan.ok === false) {
    isi.appendChild(
      buatElemen(
        "div",
        "aleta-kosong",
        (usulan && usulan.alasan === "perkara_tidak_ketemu")
          ? "Perkara ini tidak ketemu di SIPP."
          : "Usulan penunjukan belum dapat disusun."
      )
    );
    return;
  }

  // ==========================================================================
  // CARA: OTOMATIS ATAU MANUAL
  // ==========================================================================
  //
  // Otomatis memakai usulan apa adanya. Manual membuka daftar calon untuk tiap
  // penetapan, dan yang dipilih menimpa usulannya - hanya untuk penetapan yang
  // benar-benar diubah. Yang tidak disentuh tetap memakai usulan; manual bukan
  // berarti seluruhnya harus diisi ulang tangan.
  //
  // Pilihannya disimpan pada objek `pilihanManual` yang hidup selama papan ini
  // tergambar, dan dibaca kembali oleh tombol Kerjakan. Ia sengaja TIDAK
  // disimpan ke penyimpanan: penunjukan menyangkut satu perkara pada satu saat,
  // dan pilihan yang tertinggal dari perkara sebelumnya adalah cara paling
  // halus menetapkan orang yang salah.
  const pilihanManual = data.pilihanManual || {};
  data.pilihanManual = pilihanManual;

  const caraAktif = data.caraPapan || (data.bolehOtomatis ? "otomatis" : "manual");
  data.caraPapan = caraAktif;

  isi.appendChild(
    saklarPapan(
      "Cara",
      [
        { nilai: "manual", label: "Manual" },
        { nilai: "otomatis", label: "Otomatis" },
      ],
      caraAktif,
      (nilai) => {
        data.caraPapan = nilai;
        // Berpindah ke otomatis MEMBUANG pilihan manual. Menyimpannya diam-diam
        // berarti menekan "Otomatis" lalu tetap mendapat orang yang dipilih
        // tangan - saklar yang berbohong tentang apa yang akan terjadi.
        if (nilai === "otomatis") data.pilihanManual = {};
        // Majelis yang dipilih di mode lama ikut dilepas, dan usulannya
        // dihitung ulang dari giliran. Menyimpannya diam-diam berarti saklar
        // yang berbohong tentang apa yang akan terjadi.
        if (data.majelisDipilih) {
          void muatUlangUsulan(isi, data, null);
          return;
        }
        isi.textContent = "";
        gambarPenunjukan(isi, data);
      }
    )
  );

  const aturan = (data.pengaturan && data.pengaturan.aturan) || {};

  // ==========================================================================
  // USULAN PMH TIDAK DIGAMBAR DI MODE MANUAL
  // ==========================================================================
  //
  // Ketiga hal ini menerangkan USULAN mesin: saklar kolam hakim tunggal, baris
  // "Penetapan Majelis Hakim" beserta sebabnya, dan hitungan beban tiap hakim
  // yang menjadi dasar usulan itu.
  //
  // Di mode manual tidak ada usulan yang sedang berlaku - majelisnya dipilih
  // sendiri pada dropdown tepat di bawah. Yang terbaca petugas karena itu dua
  // susunan berdampingan: satu yang dipilihnya dan satu lagi yang tidak akan
  // dipakai, tanpa penanda mana yang mana.
  //
  // Saklar "Hakim tunggal" lebih menyesatkan lagi: ia menampilkan PENGATURAN,
  // bukan pilihan - menekannya tidak mengubah apa pun. Di sebelah saklar
  // "Manual/Otomatis" yang memang bekerja, ia terbaca seolah ikut bekerja.
  const manual = caraAktif === "manual";
  const pmh = usulan.pmh || {};
  // Langkah yang sudah tercatat di SIPP - digambar dari yang tercatat, tanpa
  // pilihan (barisPenetapanTercatat; uji rilis U1, 9 Okt 2026).
  const sudahDiSipp = keadaanPenetapanUsulan(usulan);

  // ==========================================================================
  // PEJABAT PENETAP: BAWAANNYA PILIHAN MESIN, PILIHAN PETUGAS TIDAK DITIMPA
  // ==========================================================================
  //
  // Bawaan disimpan sejak awal (tanpa itu yang tidak menyentuh pilihan akan
  // mengirim nama kosong). Dahulu bawaan ini ditulis ULANG tiap papan
  // digambar - termasuk gambar ulang sesudah petugas mengganti pejabatnya -
  // sehingga baris keterangannya menyebut pilihan petugas sementara yang
  // terkirim kembali pilihan mesin. Kini hanya diisi bila belum ada.
  const langkahBercalon = ((data && data.rencana && data.rencana.langkah) || []).filter(
    (x) => Array.isArray(x.calon) && x.calon.length > 1 && !sudahDiSipp[x.jenis]
  );
  if (langkahBercalon.length > 0 && !data.pejabatDipilih) data.pejabatDipilih = {};
  for (const langkah of langkahBercalon) {
    const otomatis = langkah.calon.find((x) => x.otomatis);
    const masihCalon = langkah.calon.some((x) => x.username === data.pejabatDipilih[langkah.jenis]);
    if (otomatis && !masihCalon) data.pejabatDipilih[langkah.jenis] = otomatis.username;
  }

  // UI Baru (19 Okt 2026, butir 2-3): pejabat penetap dipilih dengan mengeklik
  // baris "Ditetapkan ..." pada tiap penetapan; kotak "Pejabat yang
  // menetapkan" hanya di tampilan Lama/Baru.
  const uiBaru = typeof t7Modern === "function" && t7Modern();
  const pasangPenetap = (baris, jenis) => {
    const keterangan = baris.querySelector(".aleta-tetap-penetap");
    if (uiBaru && keterangan && typeof t7TanpaAkun === "function") keterangan.textContent = t7TanpaAkun(keterangan.textContent);
    if (uiBaru && !sudahDiSipp[jenis] && typeof t7PenetapDapatDiklik === "function") {
      t7PenetapDapatDiklik(baris.querySelector(".aleta-tetap-penetap"), data, jenis, () => {
        isi.textContent = "";
        gambarPenunjukan(isi, data);
      });
    }
    return baris;
  };

  // Saklar "Hakim tunggal" hanya di mode otomatis: ia menampilkan PENGATURAN,
  // bukan pilihan - menekannya tidak mengubah apa pun, dan di sebelah saklar
  // Manual/Otomatis yang bekerja ia terbaca seolah ikut bekerja.
  if (!manual && !sudahDiSipp.pmh) {
    isi.appendChild(
      saklarPapan(
        "Hakim tunggal",
        [
          { nilai: "hakim", label: "Hakim" },
          { nilai: "ketua-wakil", label: "Ketua/Wakil" },
        ],
        aturan.kolamHakimTunggal === "ketua-wakil" ? "ketua-wakil" : "hakim"
      )
    );
  }

  // ==========================================================================
  // KEPALA "PENETAPAN MAJELIS HAKIM" ADA DI KEDUA MODE
  // ==========================================================================
  //
  // Kepala ini pernah disembunyikan di mode manual, dan waktu itu alasannya
  // benar: ia menampilkan usulan mesin yang BERBEDA dari majelis yang dipilih
  // di dropdown - dua susunan berdampingan tanpa penanda mana yang mana.
  //
  // Sejak mengganti majelis memuat ulang usulannya, yang tertulis di sini
  // adalah majelis yang dipilih itu sendiri, beserta panitera dan penanda
  // tangan yang mengikutinya - bukan lagi usulan tandingan. Dan tanpa kepala
  // ini, dropdown Majelis berdiri sendiri tanpa penjelasan sementara tiap
  // dropdown lain punya kepalanya; pembaca lalu mengira tiap dropdown milik
  // kepala di BAWAHNYA, dan seluruh susunan terbaca bergeser satu.
  const namaMajelis = (pmh.anggota || []).map((x) => x.nama).join(", ");
  isi.appendChild(pasangPenetap(
    sudahDiSipp.pmh
      ? barisPenetapanTercatat("Penetapan Majelis Hakim", "pmh", usulan)
      : barisPenetapan(
          "Penetapan Majelis Hakim",
          (pmh.majelisKode ? `${pmh.majelisKode} — ` : "") + namaMajelis,
          pmh.sebab,
          pmh.perluNilai ? "Nilai sengketa belum diisi di SIPP - isi dulu di Data Umum." : "",
          penetapUntuk(data, "pmh")
        ),
    "pmh"
  ));

  if (!manual && !sudahDiSipp.pmh) {
    // Hitungan hakim tunggal ditampilkan terbuka: angka inilah yang membuat
    // "paling sedikit" dapat diperiksa, bukan sekadar dipercaya. Di mode
    // manual angkanya sudah ada pada tiap baris dropdown.
    if ((pmh.hitungan || []).length > 1) {
      isi.appendChild(
        buatElemen(
          "div",
          "aleta-tetap-hitung",
          pmh.hitungan.map((x) => `${x.nama} ${Math.round(Number(x.jumlah) || 0)}`).join("  ·  ")
        )
      );
      isi.appendChild(keteranganBeban());
    }
  }

  // ========================================================================
  // PILIHAN HAKIM: PER MAJELIS ATAU PER ORANG
  // ========================================================================
  //
  // Dua cara memilih hakim, dan keduanya memang diperlukan:
  //
  //   per majelis  - satu tekanan mengganti ketiganya sekaligus, memakai
  //                  susunan yang memang dipakai sehari-hari;
  //   per orang    - satu kursi diganti sementara dua lainnya tetap, misalnya
  //                  ketika seorang anggota berhalangan.
  //
  // Susunan yang ditawarkan BUKAN dari SK. Tabel ref_majelis_tetap di
  // pengadilan ini berisi 106 baris dan tidak satu pun aktif, jadi menawarkan
  // susunan menurut SK berarti menawarkan daftar kosong. Yang ditawarkan
  // susunan yang benar-benar dipakai tahun ini - dan itu memang yang diminta:
  // tidak terikat SK.
  const bolehPilihHakim = !sudahDiSipp.pmh && data.caraPapan === "manual" && (pmh.hitungan || []).length > 1;
  const adaSusunan = ((pmh.susunanTerpakai || []).length) > 0;

  if (bolehPilihHakim && adaSusunan) {
    isi.appendChild(
      saklarPapan(
        "Pilih",
        [
          { nilai: "majelis", label: "Per majelis" },
          { nilai: "orang", label: "Per orang" },
        ],
        pilihanManual.caraHakim || "majelis",
        (nilai) => {
          pilihanManual.caraHakim = nilai;
          // Berpindah cara MEMBUANG pilihan cara sebelumnya. Menyimpannya
          // diam-diam membuat susunan yang tidak terlihat lagi tetap mengisi
          // formulir - persis cacat yang sama sudah dihindari pada saklar
          // Otomatis/Manual.
          if (nilai === "majelis") pilihanManual.pmhKursi = [];
          else pilihanManual.majelis = "";
          isi.textContent = "";
          gambarPenunjukan(isi, data);
        }
      )
    );
  }

  const caraHakim = adaSusunan ? pilihanManual.caraHakim || "majelis" : "orang";

  // ==========================================================================
  // DROPDOWN MAJELIS ADA DI MODE OTOMATIS JUGA
  // ==========================================================================
  //
  // Di mode otomatis yang berubah hanya SATU keputusan - majelisnya - dan
  // seluruh turunannya tetap dihitung mesin. Memaksa petugas pindah ke manual
  // untuk itu berarti memaksanya memilih ulang panitera, juru sita, dan hari
  // sidang yang sebenarnya tidak hendak diubahnya.
  //
  // Pilihan per orang tetap milik mode manual: menyusun majelis dari tiga
  // kursi terpisah adalah pekerjaan manual, bukan sekadar mengganti pilihan.
  const bolehPilihMajelis = !sudahDiSipp.pmh && adaSusunan && caraHakim === "majelis" && (pmh.hitungan || []).length > 1;
  if (bolehPilihMajelis) {
    isi.appendChild(
      pilihanOrang(
        "Majelis",
        pmh.susunanTerpakai.map((x) => ({
          id: x.kunci,
          // Nama lengkap ketiganya, bukan kodenya: kode majelis di SIPP tidak
          // tetap - A, B, C1 berpindah orang - dan yang memilih perlu melihat
          // siapa, bukan huruf apa.
          // ==============================================================
          // KODE MAJELIS HANYA UNTUK YANG DITETAPKAN SK
          // ==============================================================
          //
          // Susunan di luar SK tetap dapat dipilih - majelis memang disusun
          // ulang ketika ada yang cuti - tetapi TANPA kode di sebelahnya.
          // Kode majelis milik SK; menempelkannya pada susunan yang tidak
          // ditetapkan siapa pun berarti menulis kode karangan ke berkas
          // perkara, dan laporan yang mengelompokkan menurut majelis akan
          // menghitungnya sebagai majelis itu.
          //
          // Urutannya sudah disusun bot: yang ber-SK di atas.
          label:
            (x.majelisKode ? `${x.majelisKode} — ` : "") +
            `${x.anggota.map((a) => a.nama).join(" · ")} — ${sebutBeban(x.perkara)}` +
            (x.majelisKode ? "" : " · di luar SK"),
        })),
        pilihanManual.majelis ?? (data.majelisDipilih ? kunciSusunan(data.majelisDipilih) : ""),
        (nilai) => {
          pilihanManual.majelis = nilai;
          const terpilih = (pmh.susunanTerpakai || []).find((x) => String(x.kunci) === String(nilai));
          // Id hakimnya dikirim ke server; yang kembali adalah usulan utuh untuk
          // majelis itu - panitera sidang, hari sidang, penanda tangan PHS.
          void muatUlangUsulan(isi, data, terpilih ? terpilih.hakimId : null);
        }
      )
    );
  }

  if (bolehPilihHakim && caraHakim === "orang") {
    // Tiga kursi, tiga dropdown. Yang sudah dipakai kursi lain digugurkan dari
    // pilihan kursi berikutnya - satu orang tidak dapat menjadi ketua sekaligus
    // anggota, dan SIPP akan menolaknya belakangan dengan galat yang tidak
    // menyebut sebabnya.
    const kursi = pilihanManual.pmhKursi || [];
    const jumlahKursi = Math.max((pmh.anggota || []).length, 1);

    for (let urutan = 0; urutan < jumlahKursi; urutan += 1) {
      const dipakaiLain = kursi
        .filter((_, i) => i !== urutan)
        .map((x) => String(x))
        .filter(Boolean);

      isi.appendChild(
        pilihanOrang(
          urutan === 0 ? "Ketua" : `Anggota ${urutan}`,
          pmh.hitungan
            .filter((x) => !dipakaiLain.includes(String(x.hakimId ?? x.id ?? x.nama)))
            .map((x) => ({
              id: x.hakimId ?? x.id ?? x.nama,
              label: `${x.nama} — ${sebutBeban(x.jumlah)}`,
            })),
          kursi[urutan] ?? "",
          (nilai) => {
            const baru = [...(pilihanManual.pmhKursi || [])];
            baru[urutan] = nilai;
            pilihanManual.pmhKursi = baru;
            // Menggambar ulang, sama seperti PPP dan PJS: tombol Kerjakan
            // disiapkan sekali saat papan digambar, jadi pilihan yang tidak
            // menggambar ulang akan tampil berubah tetapi mengisi nilai lama.
            isi.textContent = "";
            gambarPenunjukan(isi, data);
          }
        )
      );
    }
  }

  // --- PPP ---------------------------------------------------------------
  const ppp = usulan.ppp || {};
  const pppTerpilih = pilihanDari(ppp.calon, pilihanManual.ppp) || ppp.usulan;
  isi.appendChild(pasangPenetap(
    sudahDiSipp.ppp
      ? barisPenetapanTercatat("Penunjukan Panitera Pengganti", "ppp", usulan)
      : barisPenetapan(
          "Penunjukan Panitera Pengganti",
          pppTerpilih ? `${pppTerpilih.kode || ""} — ${pppTerpilih.nama}`.replace(/^ — /, "") : "",
          ppp.sebab,
          "",
          penetapUntuk(data, "ppp")
        ),
    "ppp"
  ));
  if (!sudahDiSipp.ppp && data.caraPapan === "manual" && (ppp.calon || []).length > 1) {
    isi.appendChild(
      pilihanOrang(
        "Panitera pengganti",
        ppp.calon.map((x) => ({
          id: x.id ?? x.paniteraId ?? x.nama,
          // Kode panitera sidang menurut SK di depan namanya - dan hanya
          // bagi yang memang disebut SK untuk majelis ini. Yang lain tetap
          // dapat dipilih, di bawahnya, tanpa kode.
          label:
            (x.kodeSk ? `${x.kodeSk} — ` : "") +
            `${x.nama}${x.jumlah !== undefined ? ` — ${sebutBeban(x.jumlah)}` : ""}` +
            (x.dariSk ? " · panitera sidang majelis ini" : ""),
        })),
        pilihanManual.ppp ?? (ppp.usulan ? ppp.usulan.id ?? ppp.usulan.nama : ""),
        (nilai) => {
          pilihanManual.ppp = nilai;
          isi.textContent = "";
          gambarPenunjukan(isi, data);
        }
      )
    );
  }

  // --- PJS ---------------------------------------------------------------
  const pjs = usulan.pjs || {};
  const pjsTerpilih = pilihanDari(pjs.calon, pilihanManual.pjs) || pjs.usulan;
  isi.appendChild(pasangPenetap(
    sudahDiSipp.pjs
      ? barisPenetapanTercatat("Penunjukan Juru Sita", "pjs", usulan)
      : barisPenetapan(
          "Penunjukan Juru Sita",
          pjsTerpilih ? pjsTerpilih.nama : "",
          pjs.sebab,
          pjs.peringatan,
          penetapUntuk(data, "pjs")
        ),
    "pjs"
  ));
  if (!sudahDiSipp.pjs && data.caraPapan === "manual" && (pjs.calon || []).length > 1) {
    isi.appendChild(
      pilihanOrang(
        "Juru sita",
        pjs.calon.map((x) => ({
          id: x.id ?? x.jurusitaId ?? x.nama,
          label: `${x.nama}${x.jumlah !== undefined ? ` — ${sebutBeban(x.jumlah)}` : ""}`,
        })),
        pilihanManual.pjs ?? (pjs.usulan ? pjs.usulan.id ?? pjs.usulan.nama : ""),
        (nilai) => {
          pilihanManual.pjs = nilai;
          isi.textContent = "";
          gambarPenunjukan(isi, data);
        }
      )
    );
  }

  // --- PHS ---------------------------------------------------------------
  const phs = usulan.phs || {};
  const phsDipilih = (phs.calon || []).find((x) => x.tanggal === pilihanManual.phs);
  // Tanggal yang dipilih sendiri dari kalender TIDAK ada di daftar calon.
  // Tanpa cabang ini, barisnya tetap menampilkan tanggal usulan sementara yang
  // akan ditulis tanggal pilihan - selisih yang tidak terlihat sampai
  // penetapannya sudah tersimpan.
  const phsTerbaca = phsDipilih
    ? phsDipilih.sebut
    : pilihanManual.phs
      ? pilihanManual.phs
      : phs.sebut;
  const bebanTerpilih =
    phsDipilih && phsDipilih.jumlahSidang !== null && phsDipilih.jumlahSidang !== undefined
      ? ` · ${phsDipilih.jumlahSidang} sidang pada hari itu`
      : "";
  isi.appendChild(pasangPenetap(
    sudahDiSipp.phs
      ? barisPenetapanTercatat("Penetapan Hari Sidang", "phs", usulan)
      : barisPenetapan(
          "Penetapan Hari Sidang",
          phsTerbaca,
          phs.sebab + (phs.jarakHari ? ` · ${phs.jarakHari} hari sejak daftar` : "") + bebanTerpilih,
          peringatanLiburPhs(pilihanManual.phs || phs.usulan),
          penetapUntuk(data, "phs")
        ),
    "phs"
  ));

  // PHS-lah yang paling sering perlu digeser - majelisnya berhalangan, atau
  // hari itu sudah terlalu penuh - dan sampai sekarang ia satu-satunya
  // penetapan yang tidak dapat dipilih sama sekali.
  //
  // Yang ditawarkan hanya HARI SIDANG MAJELIS ITU, pekan ini dan tiga pekan
  // sesudahnya. Hari sembarang akan menghasilkan penetapan hari sidang pada
  // hari majelis itu tidak bersidang.
  // ==========================================================================
  // SIDANG KELILING TIDAK DAPAT DITETAPKAN DI MODE OTOMATIS - SAMPAI SEKARANG
  // ==========================================================================
  //
  // Pilihan hari sidang dan ruang sidang selama ini hanya digambar di mode
  // MANUAL. Akibatnya penetapan sidang keliling menuntut petugas berpindah ke
  // manual dan memilih ulang majelis, panitera pengganti, dan juru sita -
  // padahal yang hendak diubahnya hanya TEMPATNYA.
  //
  // Yang paling merugikan bukan kerepotannya melainkan yang terjadi kalau ia
  // tidak berpindah: penetapannya tetap berhasil, dengan ruangan dalam gedung
  // dan sidang_keliling nol. Tidak ada yang berbunyi, dan laporan sidang
  // keliling menghitung nol.
  //
  // Karena itu saklarnya ada di kedua mode. Di mode otomatis ia membuka HANYA
  // hari sidang dan ruangannya; siapa yang bersidang tetap ditentukan mesin.
  if (!sudahDiSipp.phs && !manual && (phs.calon || []).length > 0) {
    const saklarKeliling = buatElemen("label", "aleta-pilih-bebas");
    const kotakKeliling = document.createElement("input");
    kotakKeliling.type = "checkbox";
    kotakKeliling.checked = Boolean(pilihanManual.sidkel);
    saklarKeliling.appendChild(kotakKeliling);
    saklarKeliling.appendChild(
      buatElemen("span", "aleta-pilih-bebas-nama", "Sidang keliling - pilih hari dan tempatnya")
    );
    kotakKeliling.addEventListener("change", () => {
      pilihanManual.sidkel = kotakKeliling.checked;
      // Mematikannya MELEPAS kembali hari dan ruangannya. Menyimpannya
      // diam-diam berarti saklar yang mati tetapi penetapannya tetap tertulis
      // di luar gedung - saklar yang berbohong tentang apa yang akan terjadi.
      if (!kotakKeliling.checked) {
        pilihanManual.phs = "";
        pilihanManual.ruangan = "";
        pilihanManual.phsBebas = false;
      }
      isi.textContent = "";
      gambarPenunjukan(isi, data);
    });
    isi.appendChild(saklarKeliling);
  }

  const bukaTempat = !sudahDiSipp.phs && (manual || Boolean(pilihanManual.sidkel));
  if (bukaTempat && (phs.calon || []).length > 1) {
    // ======================================================================
    // BERAPA SIDANG YANG SUDAH ADA PADA TANGGAL ITU
    // ======================================================================
    //
    // Menetapkan hari sidang tanpa mengetahui hari itu sudah seberapa penuh
    // adalah cara paling mudah menumpuk dua puluh perkara pada satu hari
    // sementara hari berikutnya kosong. Kalender SIPP menunjukkan jadwal satu
    // PERKARA, bukan beban satu HARI.
    //
    // Yang tidak terbaca ditulis apa adanya sebagai "beban belum terbaca",
    // bukan sebagai nol. Tanggal yang tampak lengang padahal penuh akan
    // menumpuk sidang justru pada hari yang paling sibuk.
    const sebutBeban = (x) => {
      if (x.jumlahSidang === null || x.jumlahSidang === undefined) return "beban belum terbaca";
      if (x.jumlahSidang === 0) return "belum ada sidang";
      return `${x.jumlahSidang} sidang`;
    };

    // ======================================================================
    // TANGGAL DARI KALENDER IKUT BERDIRI DI DAFTAR INI
    // ======================================================================
    //
    // Daftar ini disusun dari phs.calon - keempat hari sidang majelisnya.
    // Tanggal yang dipilih sendiri dari kalender di bawah TIDAK ada di
    // antaranya, sehingga daftarnya jatuh kembali ke baris pertama sementara
    // yang sungguh akan ditulis adalah tanggal kalender.
    //
    // Yang terbaca dari situ: "sudah saya pilih tanggalnya, tetapi hari
    // sidangnya tidak ikut berubah" - dan dugaan berikutnya, yang wajar,
    // adalah bahwa pilihan kalendernya tidak terpakai.
    //
    // Sekarang tanggal kalender disisipkan sebagai baris tambahan, PALING
    // ATAS dan bertanda asalnya. Ia tidak menggantikan satu pun calon:
    // memilih kembali salah satu calon tetap dapat dilakukan dengan satu
    // gerakan yang sama.
    const calonTampil = phs.calon.map((x) => {
      // Hari libur (nasional, cuti bersama, tambahan Pengaturan) tampil
      // dengan namanya dan tidak dapat dipilih.
      const libur = typeof ccBukanHariKerja === "function" ? ccBukanHariKerja(x.tanggal) : "";
      return {
        id: x.tanggal,
        mati: Boolean(libur),
        label: libur
          ? `${x.sebut} — ${libur.replace(/^libur: /, "libur ")} · tidak dapat dipilih`
          : `${x.sebut} — ${x.usulan ? "usulan" : `mundur ${x.pekan} pekan`}` + ` · ${sebutBeban(x)}`,
      };
    });
    const dariKalender = String(pilihanManual.phs || "");
    if (dariKalender && !calonTampil.some((c) => c.id === dariKalender)) {
      calonTampil.unshift({
        id: dariKalender,
        label: `${sebutTanggal(dariKalender)} — dipilih dari kalender`,
      });
    }

    isi.appendChild(
      pilihanOrang(
        "Hari sidang",
        calonTampil,
        pilihanManual.phs ?? "",
        (nilai) => {
          pilihanManual.phs = nilai;
          // Memilih kembali salah satu hari sidang majelis berarti tidak lagi
          // memakai tanggal kalender - saklarnya ikut ditutup supaya kotak
          // kalender tidak tertinggal terbuka dengan tanggal yang sudah tidak
          // dipakai, yang kemudian terbaca sebagai dua pilihan yang berselisih.
          if ((phs.calon || []).some((x) => x.tanggal === nilai)) {
            pilihanManual.phsBebas = false;
          }
          isi.textContent = "";
          gambarPenunjukan(isi, data);
        }
      )
    );

    // ======================================================================
    // RUANG SIDANG - DAN INILAH TEMPAT SIDANG KELILING DIPILIH
    // ======================================================================
    //
    // Sebelum ini ruangannya dipatok pada mesin tulis: "Ruang Sidang 1 Dalam
    // Gedung", selalu. Penetapan hari sidang untuk sidang keliling karena itu
    // menulis ruangan yang keliru DAN kolom sidang_keliling nol - sedangkan
    // penetapannya berhasil, berkasnya tercetak, dan sidangnya digelar.
    //
    // Gagal yang paling mahal adalah yang tidak berbunyi: yang menyadarinya
    // baru penyusun laporan tahunan, ketika sidang keliling terhitung nol.
    //
    // Diukur di PA Donggala, sidang 2025-2026: 459 sidang digelar di luar
    // gedung - 180 sidang keliling dan 279 pelayanan terpadu.
    //
    // TERPADU DIPISAH DARI KELILING, sebab SIPP sendiri memisahkannya
    // (ruangan_sidang.sidang_keliling = 0 pada keempat ruangan Terpadu).
    // Menyatukannya membuat laporan sidang keliling melebih-lebihkan diri.
    if (ruanganTersimpan === null) {
      // Dibaca di latar; papannya digambar ulang begitu daftarnya tiba.
      void muatRuangan().then((daftar) => {
        if (!daftar) return;
        isi.textContent = "";
        gambarPenunjukan(isi, data);
      });
    } else if (ruanganTersimpan.length > 0) {
      const SEBUT = {
        "dalam-gedung": "Dalam gedung",
        keliling: "Sidang keliling",
        terpadu: "Sidang terpadu",
      };
      // ====================================================================
      // YANG SERING DIPAKAI DI ATAS, DAN SAAT SIDKEL MENYALA KELILING DULU
      // ====================================================================
      //
      // Urutan dasarnya sudah disusun portal menurut pemakaian 24 bulan
      // terakhir. Ketika petugas menyatakan ini sidang keliling, ruangan
      // keliling dan terpadu dinaikkan ke atas daftar - yang dicarinya tidak
      // boleh berada di bawah tiga belas baris ruangan dalam gedung.
      //
      // Yang di dalam gedung TIDAK dibuang: sidang keliling yang batal dan
      // dipindahkan ke kantor terjadi, dan daftar yang menyembunyikannya
      // memaksa petugas mematikan saklarnya lalu kehilangan tanggal yang
      // sudah dipilih.
      const urutTempat = Boolean(pilihanManual.sidkel)
        ? [...ruanganTersimpan].sort((a, b) => {
            const luar = (r) => (r.sifat === "keliling" ? 0 : r.sifat === "terpadu" ? 1 : 2);
            return luar(a) - luar(b);
          })
        : ruanganTersimpan;

      isi.appendChild(
        pilihanOrang(
          "Ruang sidang",
          urutTempat.map((r) => ({
            id: String(r.id),
            // Sifatnya disebut pada tiap barisnya, bukan hanya pada
            // pengelompokan: yang memilih cepat membaca satu baris, bukan
            // judul kelompok tiga baris di atasnya.
            //
            // Seberapa sering dipakai ikut tertulis. "Belum pernah dipakai"
            // adalah keterangan yang paling perlu dibaca sebelum memilih -
            // ruangan yang tidak pernah dipakai biasanya memang sudah tidak
            // dipakai lagi, hanya belum dinonaktifkan di SIPP.
            label:
              `${r.nama} — ${SEBUT[r.sifat] || r.sifat}` +
              (r.dipakai === undefined
                ? ""
                : r.dipakai > 0
                  ? ` · ${r.dipakai} sidang 2 tahun terakhir`
                  : " · belum pernah dipakai"),
          })),
          pilihanManual.ruangan ?? "",
          (nilai) => {
            pilihanManual.ruangan = nilai;
            isi.textContent = "";
            gambarPenunjukan(isi, data);
          }
        )
      );

      // ====================================================================
      // TEMPATNYA SUNGGUHAN - KUA WILAYAH ITU
      // ====================================================================
      //
      // "Sidang Keliling Sigi Biromaru" adalah nama baris di SIPP, bukan
      // alamat. Yang perlu diketahui petugas yang menyiapkan panggilan adalah
      // ke mana para pihak dipanggil - dan untuk sidang keliling di sini
      // tempatnya KUA kecamatan itu.
      //
      // Dicocokkan dari ref_kua di sisi bot menurut ekor nama ruangannya.
      // Yang tidak berpasangan tidak menampilkan apa pun - menebak alamat
      // lebih buruk daripada diam.
      const tempatTerpilih = ruanganTersimpan.find(
        (r) => String(r.id) === String(pilihanManual.ruangan)
      );
      if (tempatTerpilih && tempatTerpilih.kua) {
        isi.appendChild(
          buatElemen(
            "div",
            "aleta-tetap-hitung",
            `Tempat: ${tempatTerpilih.kua}` +
              (tempatTerpilih.kuaAlamat ? ` — ${tempatTerpilih.kuaAlamat}` : "")
          )
        );
      }
    }

    // ======================================================================
    // TANGGAL BEBAS - DI BALIK SAKLAR, BUKAN BERDAMPINGAN
    // ======================================================================
    //
    // Keempat calon di atas adalah hari sidang majelis itu sendiri. Tanggal
    // sembarang menghasilkan penetapan hari sidang pada hari majelis itu TIDAK
    // bersidang - dan itu bukan kelonggaran, itu kekeliruan.
    //
    // Tetapi keadaan yang menuntutnya memang ada: sidang keliling yang harinya
    // menyesuaikan kecamatan, hari libur nasional yang menggeser seluruh
    // jadwal, atau majelis yang harinya sedang diubah dan belum tercatat.
    //
    // Karena itu ia ADA tetapi di balik saklar. Yang membukanya melakukannya
    // dengan sadar, dan peringatannya dibaca pada saat yang sama - bukan
    // sesudah penetapannya terlanjur tersimpan.
    const saklarBebas = buatElemen("label", "aleta-pilih-bebas");
    const kotakBebas = document.createElement("input");
    kotakBebas.type = "checkbox";
    kotakBebas.checked = Boolean(pilihanManual.phsBebas);
    saklarBebas.appendChild(kotakBebas);
    saklarBebas.appendChild(
      buatElemen("span", "aleta-pilih-bebas-nama", "Pilih tanggal sendiri dari kalender")
    );
    isi.appendChild(saklarBebas);

    if (pilihanManual.phsBebas) {
      const barisBebas = buatElemen("div", "aleta-pilih");
      barisBebas.appendChild(buatElemen("span", "aleta-pilih-nama", "Tanggal"));

      const kalender = document.createElement("input");
      kalender.type = "date";
      kalender.className = "aleta-pilih-kotak";
      kalender.value = pilihanManual.phs || phs.usulan || "";
      // ====================================================================
      // BATAS BAWAHNYA HARI INI, BUKAN TANGGAL USULAN
      // ====================================================================
      //
      // Sebelum ini batasnya tanggal usulan, sehingga SELURUH tanggal sebelum
      // usulan - termasuk hari ini dan pekan depan - tampil kelabu dan tidak
      // dapat ditekan. Alasannya jeda minimal menurut SK, dan alasan itu
      // benar; tetapi kalender bukan tempat menegakkannya.
      //
      // Keadaan yang menuntut tanggal lebih awal memang ada dan sah: perkara
      // yang harus disidangkan cepat, sidang keliling yang jadwalnya sudah
      // diumumkan, atau penetapan yang dibuat mundur untuk hari sidang yang
      // sudah berlalu. Kalender yang mengunci semuanya memaksa petugas
      // kembali mengetik di borang SIPP - dan di sana tidak ada peringatan
      // apa pun.
      //
      // Karena itu batasnya HARI INI - tanggal yang sudah lewat memang tidak
      // dapat dijadikan hari sidang pertama - dan jeda minimalnya diberitahu
      // sebagai peringatan yang dibaca, bukan sebagai pintu yang dikunci.
      kalender.min = new Date().toISOString().slice(0, 10);
      kalender.addEventListener("change", () => {
        // Hari libur tidak diterima kalender: pilihan lama dipertahankan dan
        // sebabnya disebut (18 Okt 2026).
        const libur = kalender.value && typeof ccBukanHariKerja === "function" ? ccBukanHariKerja(kalender.value) : "";
        if (libur) {
          data.phsDitolakLibur = `${sebutTanggal(kalender.value)} hari ${libur.replace(/^libur: /, "libur ")} - tidak dapat dipilih.`;
        } else {
          data.phsDitolakLibur = "";
          pilihanManual.phs = kalender.value;
        }
        isi.textContent = "";
        gambarPenunjukan(isi, data);
      });
      barisBebas.appendChild(kalender);
      isi.appendChild(barisBebas);
      if (data.phsDitolakLibur) isi.appendChild(buatElemen("div", "aleta-tetap-awas", data.phsDitolakLibur));

      const dipilihBebas = pilihanManual.phs;

      // Jeda minimalnya tidak lagi dikunci kalender, jadi ia harus BERBUNYI.
      // Yang memilih tanggal lebih awal dari usulan sedang memperpendek jeda
      // panggilan, dan itu keputusan yang boleh diambil - asal disadari.
      if (dipilihBebas && phs.usulan && dipilihBebas < phs.usulan) {
        isi.appendChild(
          buatElemen(
            "div",
            "aleta-tetap-awas",
            `Lebih awal dari usulan ${phs.usulan}. Usulan itu hari sidang terdekat yang masih memenuhi jeda panggilan menurut SK - memajukannya memperpendek jeda tersebut.`
          )
        );
      }

      // Butir 38: tanggal yang akan DITOLAK dikatakan di sini, sebelum
      // tombolnya ditekan - dan ia tidak pernah diganti usulan diam-diam.
      const masalahPilihan = masalahTanggalSidang(usulan, pilihanManual);
      if (masalahPilihan) {
        isi.appendChild(buatElemen("div", "aleta-tetap-awas", masalahPilihan));
      }

      const adaDiCalon = (phs.calon || []).some((x) => x.tanggal === dipilihBebas);
      if (dipilihBebas && !adaDiCalon) {
        isi.appendChild(
          buatElemen(
            "div",
            "aleta-tetap-awas",
            "Tanggal ini di luar hari sidang majelis tersebut. Pastikan majelisnya memang bersidang hari itu."
          )
        );
      }
    }

    kotakBebas.addEventListener("change", () => {
      pilihanManual.phsBebas = kotakBebas.checked;
      // Menutup saklarnya mengembalikan pilihan ke calon - kalau tidak,
      // tanggal bebas yang sudah terpilih tetap terpakai diam-diam sementara
      // kalendernya sudah tidak terlihat lagi.
      if (!kotakBebas.checked && !(phs.calon || []).some((x) => x.tanggal === pilihanManual.phs)) {
        pilihanManual.phs = "";
      }
      isi.textContent = "";
      gambarPenunjukan(isi, data);
    });
  }

  // --- keempatnya setanggal ----------------------------------------------
  const sisaLangkah = langkahSisaPenetapan(usulan);
  if (usulan.tanggalPenetapan && sisaLangkah.length === URUTAN_TULIS.length) {
    isi.appendChild(
      buatElemen(
        "div",
        "aleta-tetap-hitung",
        `Tanggal penetapan keempatnya: ${usulan.tanggalPenetapan}`
      )
    );
  } else if (usulan.tanggalPenetapan && sisaLangkah.length > 0) {
    // Sisa rantai ditanggali sama dengan PMH yang sudah ada (bot:
    // tanggalPenetapan = penetapan.pmh) - dikatakan begitu, bukan "keempatnya".
    isi.appendChild(
      buatElemen(
        "div",
        "aleta-tetap-hitung",
        `Tanggal penetapan ${sisaLangkah.map((x) => x.toUpperCase()).join(", ")}: ${usulan.tanggalPenetapan}` +
          (sudahDiSipp.pmh ? " - setanggal PMH yang sudah ada" : "")
      )
    );
  }

  // ========================================================================
  // ATAS NAMA SIAPA INI AKAN TERCATAT - DIBACA SEBELUM TOMBOLNYA DITEKAN
  // ========================================================================
  //
  // Siapa penetapnya memang sudah tertulis pada tiap baris di atas, tetapi
  // tersebar - satu keterangan kecil di ujung baris PMH, satu lagi di baris
  // PPP, dan seterusnya. Yang menekan tombol tidak sedang membaca empat baris
  // itu; ia sedang melihat tombolnya.
  //
  // Karena penetapan ini akan tercatat di SIPP atas nama PEJABAT - bukan atas
  // nama operator yang menekannya - namanya harus terbaca tepat di sebelah
  // tombolnya, sebagai kalimat terakhir sebelum ditekan. Satu nama yang salah
  // di sini berarti satu berkas perkara yang tercatat atas nama orang yang
  // tidak mengerjakannya, dan itu tidak dapat dibetulkan dengan menekan ulang.
  // ==========================================================================
  // KOTAK RINGKASAN INI DICABUT - IA MENGULANG, DAN ULANGANNYA DAPAT BERBEDA
  // ==========================================================================
  //
  // Dahulu di sini berdiri kotak merah "Akan tercatat di SIPP atas nama",
  // mendaftar keempat penetap sekali lagi. Maksudnya baik: nama penetapnya
  // terbaca tepat di sebelah tombol, bukan tersebar di empat baris di atas.
  //
  // Dua hal membuatnya lebih merugikan daripada menolong.
  //
  // Pertama, ia membaca `langkah.akun` - pilihan BAWAAN mesin - sementara
  // "Pejabat yang menetapkan" tepat di bawahnya membiarkan pilihan itu
  // diganti. Petugas yang mengganti PMH ke Wakil Ketua tetap membaca nama
  // Ketua pada kotak merah. Ringkasan yang berbeda dari yang akan ditulis
  // lebih buruk daripada tidak ada ringkasan sama sekali.
  //
  // Kedua, keterangan penetap sudah ada pada tiap barisnya - dan sejak
  // sekarang keterangan itu IKUT BERUBAH ketika pejabatnya diganti. Kotak ini
  // tinggal salinan ketiga dari keterangan yang sama.

  // ========================================================================
  // PEJABAT PENETAPNYA DAPAT DIPINDAH - BAWAANNYA YANG DIPILIH MESIN
  // ========================================================================
  //
  // Aturannya benar hampir selalu: Ketua bila hadir, Wakil bila Ketua
  // berhalangan, Plh bila keduanya tidak ada. "Hampir" itulah sebabnya
  // pilihan ini ada - cuti yang belum tercatat, rapat mendadak, atau
  // penandatanganan yang memang diserahkan kepada Wakil atas kesepakatan
  // pimpinan. Mesin tidak tahu satu pun dari itu.
  //
  // Yang ditawarkan hanya CALON YANG SAH untuk langkah itu. Membuka seluruh
  // akun akan membuat penetapan dapat tercatat atas nama siapa saja, dan itu
  // bukan kemudahan melainkan lubang.
  //
  // Ketua majelis sengaja tidak punya pilihan: PHS ditandatangani ketua
  // majelis perkara itu sendiri, dan majelisnya sudah ditetapkan pada langkah
  // sebelumnya - jadi tidak ada yang perlu dipilih.
  // Langkah yang sudah ada di SIPP tidak ditulis, jadi tidak dipilihkan
  // pejabatnya (uji rilis U1, 9 Okt 2026).
  if (langkahBercalon.length > 0 && !uiBaru) {
    if (!data.pejabatDipilih) data.pejabatDipilih = {};

    const kotakPejabat = buatElemen("div", "aleta-tetap-pejabat");
    kotakPejabat.appendChild(
      buatElemen("div", "aleta-tetap-atasnama-judul", "Pejabat yang menetapkan")
    );

    for (const langkah of langkahBercalon) {
      const baris = buatElemen("div", "aleta-tetap-pejabat-baris");
      baris.appendChild(buatElemen("span", "aleta-tetap-pejabat-jenis", langkah.jenis.toUpperCase()));

      const pilih = buatElemen("select", "aleta-pilih");
      for (const calon of langkah.calon) {
        const opsi = document.createElement("option");
        opsi.value = calon.username;
        // Sebutan jabatannya ikut, sebab nama saja tidak menyatakan kewenangan -
        // dan yang memilih sedang memutuskan siapa yang menandatangani.
        opsi.textContent =
          `${calon.namaLengkap}${calon.sebutan ? ` — ${calon.sebutan}` : ""}` +
          (calon.otomatis ? " (pilihan ALETA)" : "") +
          (calon.siap === false ? " — akunnya belum siap" : "");
        // Yang terpilih = yang tersimpan (bawaannya pilihan mesin, diisi di
        // awal papan) - bukan selalu pilihan mesin.
        if (calon.username === data.pejabatDipilih[langkah.jenis]) opsi.selected = true;
        pilih.appendChild(opsi);
      }

      pilih.addEventListener("change", () => {
        data.pejabatDipilih[langkah.jenis] = pilih.value;
        // ==================================================================
        // PAPANNYA DIGAMBAR ULANG - KETERANGANNYA IKUT BERUBAH
        // ==================================================================
        //
        // Sebelum ini pilihan tersimpan diam-diam dan tidak satu pun yang
        // terlihat berubah. Baris "Ditetapkan Ketua Pengadilan - Fahri
        // Saifuddin" tetap berbunyi begitu meskipun yang dipilih Wakil Ketua,
        // dan satu-satunya cara mengetahui pilihan itu tersimpan adalah
        // mempercayainya.
        //
        // Nama yang salah di sini berarti berkas perkara tercatat atas nama
        // orang yang tidak mengerjakannya, dan itu tidak dapat dibetulkan
        // dengan menekan ulang. Layar yang tidak berubah pada keputusan
        // seberat itu bukan kehalusan yang hilang - ia kehilangan satu-satunya
        // kesempatan petugas menyadari salah pilih.
        isi.textContent = "";
        gambarPenunjukan(isi, data);
      });

      baris.appendChild(pilih);
      kotakPejabat.appendChild(baris);
    }

    isi.appendChild(kotakPejabat);
  }

  // Panel "Penetapan Otomatis" di halaman SIPP memakai bagian rinci ini hanya
  // untuk PILIHAN (cara, majelis, panitera, juru sita, hari sidang); tombol
  // menulisnya milik panel itu sendiri (penetapan-sipp.js).
  const untukPanelSipp = Boolean(isi.hasAttribute && isi.hasAttribute("data-aleta-tanpa-kaki"));

  // Beban penetapan dan SK (20 Okt 2026, B1): blok yang SAMA dengan kotak
  // "Beban & SK" di panel halaman SIPP - angkanya dari usulan.statistik yang
  // disusun server (penunjukan-statistik.js tidak menghitung apa pun). Panel
  // SIPP menggambarnya sendiri di luar bagian rinci, jadi tidak ditambah dua kali.
  if (!untukPanelSipp && globalThis.aletaPenunjukanStatistik) {
    try {
      globalThis.aletaPenunjukanStatistik.tempelDi(isi, usulan, { terbuka: false });
    } catch {
      /* statistik hanya tambahan - papan tetap jalan */
    }
  }

  if (untukPanelSipp) return;

  // --- tombol Kerjakan ----------------------------------------------------
  // ==========================================================================
  // TOMBOL KERJAKAN PUNYA KEWENANGANNYA SENDIRI
  // ==========================================================================
  //
  // Papan penunjukan MEMBACA dan mengusulkan; tombol ini MENULIS ke SIPP atas
  // nama yang menekannya, dan tulisannya tidak dapat dibedakan dari pengisian
  // tangan. Karena itu keduanya dipisah: banyak jabatan perlu membaca
  // usulannya, jauh lebih sedikit yang boleh menuliskannya.
  //
  // Yang tidak berwenang tetap melihat papannya lengkap - usulan majelis,
  // panitera pengganti, juru sita, hari sidang - lalu mengetiknya sendiri di
  // borang SIPP seperti sebelum ada ekstensi ini.
  if (!boleh("kerjakan")) {
    const catatan = buatElemen(
      "div",
      "aleta-kosong-lembut",
      "Usulan di atas dapat disalin ke formulir SIPP. Peran Anda tidak diberi akses menuliskannya langsung dari panel."
    );
    isi.appendChild(catatan);
    return;
  }

  const kaki = buatElemen("div", "aleta-tetap-kaki");
  const tombol = buatElemen("button", "aleta-tombol aleta-tombol-mati aleta-tombol-tetapkan", "Tetapkan");
  tombol.type = "button";
  tombol.disabled = true;
  const kabar = buatElemen("span", "aleta-tetap-sebab", "Memeriksa formulir di halaman ini…");
  kaki.appendChild(tombol);
  kaki.appendChild(kabar);
  isi.appendChild(kaki);

  // Jalan kembali, bagi penetapan yang salah atau yang berhenti separuh
  // tertulis. Ditaruh di bawah tombol menetapkan, bukan di sebelahnya:
  // membatalkan bukan tindakan yang pantas berdampingan sejajar dengan
  // menetapkan.
  isi.appendChild(bagianBatalkanPenetapan(usulan, data));

  void siapkanKerjakan(tombol, kabar, usulan, data);
}

/** Membandingkan nama tanpa mempersoalkan spasi berlebih dan besar-kecil huruf. */
function namaSama(a, b) {
  const rapikan = (x) => String(x || "").replace(/\s+/g, " ").trim().toLowerCase();
  const kiri = rapikan(a);
  const kanan = rapikan(b);
  return kiri !== "" && kiri === kanan;
}

async function siapkanKerjakan(tombol, kabar, usulan, data) {
  let keadaan;
  try {
    // perkaraId ikut dikirim supaya jawabannya membawa penerusan yang menunggu
    // untuk perkara ini - papan lalu dapat menampilkan "sudah diteruskan"
    // alih-alih menawarkan penerusan kedua atas hal yang sama.
    const alamat = `${ALETA_API_BORANG}?perkaraId=${encodeURIComponent(
      String((usulan.perkara && usulan.perkara.perkaraId) || "")
    )}`;
    const respons = await alatAmbil(alamat, { credentials: "include", cache: "no-store" }, "Memeriksa kewenangan");
    if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Memeriksa kewenangan"));
    const isi = await respons.json();
    keadaan = isi && isi.data ? isi.data : isi;
  } catch (galat) {
    kabar.textContent = String(galat.message || galat).slice(0, 160);
    return;
  }

  if (!keadaan || keadaan.bolehMengisi !== true) {
    kabar.textContent = "Peran Anda tidak diberi kewenangan mengisi formulir.";
    return;
  }

  const terbuka = await borangSedangTerbuka(keadaan.medan || []);
  if (!terbuka.formulir) {
    // ========================================================================
    // BORANG TIDAK TERBUKA BUKAN LAGI JALAN BUNTU
    // ========================================================================
    //
    // Dahulu di sini panel menyerah: "Borang penunjukan tidak terbuka di
    // halaman ini." Padahal halaman detail perkara - tempat panel ini paling
    // sering dibuka - memang tidak punya borang itu, sehingga tombol Kerjakan
    // praktis tidak pernah dapat ditekan, dan keempat penetapan tetap menuntut
    // empat kali buka halaman sambil berganti empat akun.
    //
    // Sekarang ada jalan kedua: ALETA menuliskannya sendiri. Yang ditulis dan
    // ke tabel mana persis sama dengan yang dituliskan SIPP ketika seorang
    // petugas menekan Simpan, sys_audittrail-nya ikut.
    // Uji rilis U1 (9 Okt 2026): yang tersisa dikatakan SEBELUM ditekan.
    // Keempatnya sudah ada -> tidak ada yang ditawarkan (dahulu baru diakui
    // sesudah satu tekanan uji kering); sebagian ada -> disebut sisanya.
    const sisa = langkahSisaPenetapan(usulan);
    if (sisa.length === 0) {
      tombol.textContent = "Keempat penetapan sudah ada";
      tombol.disabled = true;
      kabar.textContent =
        "PMH, PPP, PJS, dan PHS perkara ini sudah tercatat di SIPP - tidak ada yang perlu ditulis. " +
        "Untuk mengubahnya, batalkan penetapannya lebih dulu.";
      return;
    }
    tombol.textContent = "Tetapkan dan tuliskan ke SIPP";
    tombol.classList.remove("aleta-tombol-mati");
    tombol.disabled = false;
    kabar.textContent =
      sisa.length === URUTAN_TULIS.length
        ? "Formulir SIPP tidak terbuka di halaman ini. ALETA dapat menuliskan keempatnya langsung - " +
          "tekan sekali untuk melihat rencananya lebih dulu."
        : `Formulir SIPP tidak terbuka di halaman ini. ${URUTAN_TULIS.filter((x) => !sisa.includes(x))
            .map((x) => x.toUpperCase())
            .join(", ")} sudah ada di SIPP; ALETA dapat menuliskan sisanya (${sisa
            .map((x) => x.toUpperCase())
            .join(", ")}) langsung - tekan sekali untuk melihat rencananya lebih dulu.`;

    let rencanaSudahDibaca = false;
    tombol.addEventListener("click", async () => {
      tombol.disabled = true;
      const semula = tombol.textContent;
      tombol.textContent = rencanaSudahDibaca ? "Menulis…" : "Menyusun…";

      const hasil = await tetapkanLewatAleta(
        tombol,
        kabar,
        usulan,
        data,
        keadaan,
        !rencanaSudahDibaca
      );

      if (!rencanaSudahDibaca && hasil.ok && !hasil.dikerjakan) {
        // Keempatnya sudah ada di SIPP - tidak ada sisa yang dapat ditulis.
        tombol.textContent = "Keempat penetapan sudah ada";
        tombol.disabled = true;
        return;
      }

      if (!rencanaSudahDibaca && hasil.ok) {
        // Rencananya terbaca dan seluruhnya siap - barulah tekanan berikutnya
        // menulis. Rencana yang sebagian gagal TIDAK membuka jalan itu.
        rencanaSudahDibaca = true;
        tombol.textContent = "Tuliskan ke SIPP";
        tombol.disabled = false;
        return;
      }

      if (!rencanaSudahDibaca) {
        // Gagal pada uji kering: tetap dapat dicoba lagi sesudah dibetulkan.
        tombol.textContent = semula;
        tombol.disabled = false;
        return;
      }

      // Uji rilis U1 (9 Okt 2026): sisa penetapan ditulis dalam satu
      // transaksi. Gagal = TIDAK ADA yang tertulis, jadi boleh diperiksa dan
      // ditekan lagi dari awal (uji kering dulu).
      if (!hasil.ok && rantaiDibatalkanUtuh(hasil)) {
        rencanaSudahDibaca = false;
        tombol.textContent = "Tetapkan dan tuliskan ke SIPP";
        tombol.disabled = false;
        return;
      }

      // Sesudah benar-benar menulis, tombolnya TIDAK dihidupkan lagi. Menekan
      // kedua kalinya akan menuliskan penetapan yang sama untuk kedua kalinya,
      // dan membongkarnya menuntut tangan.
      tombol.textContent = hasil.ok ? "Penetapan selesai" : "Berhenti - periksa sebabnya";

      // ====================================================================
      // HALAMAN DIMUAT ULANG SESUDAH PENETAPAN BENAR-BENAR TERTULIS
      // ====================================================================
      //
      // Yang berubah ada di basis data SIPP, bukan di halaman ini. Tanpa
      // memuat ulang, tab Penetapan tetap kosong dan Riwayat Perkara tetap
      // hanya menyebut pendaftaran - petugas menyimpulkan penetapannya gagal
      // padahal keempatnya sudah tersimpan, lalu menekannya sekali lagi.
      //
      // Diberi jeda supaya hasil tiap langkah sempat terbaca lebih dahulu.
      if (hasil.ok) {
        // Sesudah penetapan (dan e-Doc otomatisnya) selesai: ringkasan tampil,
        // lalu halaman dimuat ulang SENDIRI dan tetap di perkara ini
        // (muat-ulang-sipp.js; ada yang gagal = hanya tombol).
        const nomorPerkaraIni = String((usulan.perkara && usulan.perkara.nomorPerkara) || "");
        void (async () => {
          let edocPesan = null;
          if (hasil.edocJanji) {
            const e = await hasil.edocJanji;
            if (e && e.ok === false && e.alasan !== "tidak_ada_jenis" && e.alasan !== "sudah_terunggah") {
              edocPesan = { teks: "e-Doc belum terunggah - periksa di tombol e-Doc.", gagal: true };
            } else if (e && e.ok) edocPesan = { teks: "e-Doc terunggah.", gagal: false };
          }
          const pm = globalThis.aletaMuatUlangSipp;
          if (pm) {
            pm.jadwalkan({ nomor: nomorPerkaraIni, ringkasan: pm.ringkasanDariHasil(hasil, edocPesan), wadah: kabar });
          } else {
            setTimeout(muatUlangHalamanPerkara, 2500);
          }
        })();
      }
    });
    return;
  }

  const formulir = terbuka.formulir;
  const catatanBorang = (keadaan.borang || []).find((x) => x.borang === formulir);
  if (catatanBorang && catatanBorang.siap !== true) {
    kabar.textContent = `Peta kolom formulir ${formulir.toUpperCase()} belum lengkap: ${catatanBorang.alasan}`;
    return;
  }

  // Pilihan manual ikut - kalau tidak, dropdown-nya berubah di layar tetapi
  // yang terisi ke formulir tetap usulan semula, dan itu jauh lebih berbahaya
  // daripada tidak ada pilihan manual sama sekali.
  const nilai = nilaiUntukBorang(formulir, usulan, (data && data.pilihanManual) || {});
  if (Object.keys(nilai).length === 0) {
    kabar.textContent = `Belum ada usulan yang dapat diisikan ke formulir ${formulir.toUpperCase()}.`;
    return;
  }

  // ==========================================================================
  // KEEMPAT PENETAPAN MILIK JABATAN YANG BERBEDA
  // ==========================================================================
  //
  //   PMH  Ketua Pengadilan       PPP  Panitera
  //   PJS  Panitera               PHS  ketua majelis
  //
  // Selama ini satu operator mengerjakan keempatnya dengan masuk-keluar empat
  // akun SIPP. Jejaknya lalu menyebut nama pejabatnya sementara yang menekan
  // tombolnya orang lain - dan tidak ada catatan yang menyebutkan itu.
  //
  // Yang dikerjakan panel ini: bila formulir yang terbuka BUKAN urusan jabatan
  // yang sedang masuk, tombolnya berubah dari Kerjakan menjadi Teruskan.
  // Usulannya disimpan lengkap, lalu muncul di panel pejabatnya begitu ia
  // membuka SIPP dengan akunnya sendiri - tinggal diperiksa dan ditekan.
  //
  // Empat kali masuk-keluar akun berubah jadi empat orang menekan sekali.
  const bolehJenis = keadaan.bolehJenis || {};
  const untukJabatan = keadaan.untukJabatan || {};
  const sudahDititipkan = (keadaan.antrean || []).find((x) => x.jenis === formulir);

  if (sudahDititipkan) {
    // Penerusan yang sama tidak ditawarkan dua kali. Yang berwenang tetap dapat
    // mengerjakannya - tombolnya di bawah - tetapi operator yang sudah
    // meneruskan tidak perlu meneruskan lagi.
    kabar.textContent = `Sudah diteruskan ke ${untukJabatan[formulir] || "pejabat berwenang"}, menunggu dikerjakan.`;
    if (bolehJenis[formulir] !== true) {
      tombol.textContent = "Menunggu";
      return;
    }
  }

  // ==========================================================================
  // PERTANYAAN YANG BENAR: AKUN SIPP MANA YANG SEDANG TERBUKA
  // ==========================================================================
  //
  // Sebelumnya keputusan berganti akun diambil dari KEWENANGAN PERAN ALETA -
  // "bolehkah peran ini menetapkan". Itu pertanyaan yang salah, dan akibatnya
  // dua-duanya buruk:
  //
  //   - Pada mode longgar (bawaan) jawabannya SELALU boleh, dan bagi Super
  //     Admin selalu boleh berapa pun modenya. Tombol berganti akun karena itu
  //     TIDAK PERNAH muncul sama sekali.
  //
  //   - Lebih berat: petugas yang masuk SIPP dengan akun mana pun tetap
  //     ditawari Kerjakan. Menekan Simpan sesudahnya membuat SIPP mencatat
  //     penetapan atas akun yang KEBETULAN sedang terbuka - bukan atas nama
  //     pejabat yang seharusnya.
  //
  // Yang menentukan siapa tercatat bukan izin ALETA, melainkan sesi SIPP.
  // Karena itu yang dibandingkan sekarang: nama pada kepala halaman SIPP
  // dengan nama pejabat pelaksana langkah ini menurut rencana.
  const rencana = data && data.rencana;
  const langkahRencana =
    rencana && Array.isArray(rencana.langkah)
      ? rencana.langkah.find((x) => x.jenis === formulir)
      : null;
  const akunSeharusnya = langkahRencana ? langkahRencana.akun : null;
  const namaSekarang = namaPenggunaSipp();

  // ==========================================================================
  // PHS MENUNGGU PMH, DAN ITU BUKAN KELAMBANAN
  // ==========================================================================
  //
  // PHS dikerjakan ketua majelis perkara ini, dengan akunnya sendiri. Sampai
  // PMH tersimpan, ketuanya belum ada - yang ada baru usulan, dan usulan boleh
  // berubah. Menawarkan tombolnya sekarang berarti menawarkan sesi SIPP atas
  // nama hakim yang belum tentu ketua majelisnya.
  //
  // Servernya menolak permintaan semacam itu; yang dikerjakan di sini hanya
  // mengatakannya lebih awal, supaya petugas tidak menabrak penolakan setelah
  // meninggalkan halaman perkaranya.
  if (akunSeharusnya && akunSeharusnya.tentatif) {
    tombol.textContent = "Menunggu Penetapan Majelis";
    kabar.textContent =
      "Kerjakan Penetapan Majelis Hakim lebih dulu. Ketua majelis yang menetapkan hari sidang baru pasti sesudah penetapan majelis tersimpan, dan ALETA membacanya dari majelis yang tercatat - bukan dari usulan.";
    return;
  }

  // Akun kosong berarti langkah ini memang dikerjakan operator dengan akunnya
  // sendiri - Data Umum. Tidak ada yang perlu ditukar.
  const perluGantiAkun =
    Boolean(akunSeharusnya) &&
    namaSekarang !== "" &&
    !namaSama(namaSekarang, akunSeharusnya.namaLengkap);

  if (perluGantiAkun) {
    // ========================================================================
    // AKUN YANG TERBUKA BUKAN AKUN PELAKSANA - DUA JALAN
    // ========================================================================
    //
    //   Utama   : "Masuk sebagai X" - operator berganti sesi ke akun pejabat
    //             pelaksana langkah ini lewat mesin tahap 4, lalu mengerjakannya
    //             sendiri. Inilah yang menghapus keharusan buka-tutup banyak
    //             akun: sesi lama ditutup, akun pejabat dipasang, pendaratannya
    //             dibuktikan, semuanya di /masuk-pejabat. Yang menulis penetapan
    //             tetap operator - mengisi, memeriksa, menekan Simpan.
    //
    //   Kedua   : "Teruskan" - menitipkan usulannya untuk dikerjakan pejabatnya
    //             sendiri di lain waktu, tanpa berganti akun. Dipertahankan bagi
    //             yang memang menghendaki alur titipan.
    const namaJabatan = untukJabatan[formulir] || "pejabat berwenang";
    // Nama ORANGNYA, bukan sebutan jabatannya. Yang perlu diperiksa petugas
    // sebelum menekan adalah akun siapa yang akan dipakai - "Ketua Pengadilan"
    // tidak menjawab itu, "Fahri Saifuddin" menjawabnya.
    const namaPejabat = String(akunSeharusnya.namaLengkap || namaJabatan);
    const akunSipp = String(akunSeharusnya.username || "");
    const nomorPerkara = String((usulan.perkara && usulan.perkara.nomorPerkara) || "");
    const perkaraId = String((usulan.perkara && usulan.perkara.perkaraId) || "");

    tombol.disabled = false;
    tombol.classList.remove("aleta-tombol-mati");
    tombol.textContent = `Masuk sebagai ${namaPejabat}`;
    kabar.textContent =
      `Anda sedang masuk sebagai ${namaSekarang}. ${formulir.toUpperCase()} dikerjakan ` +
      `${namaJabatan} - ${namaPejabat}${akunSipp ? ` (akun ${akunSipp})` : ""}. ` +
      "Berganti akun dulu supaya penetapannya tercatat atas nama yang benar.";

    // Akun yang belum siap disebutkan sebabnya, dan tombolnya tetap dapat
    // ditekan - penolakan sebenarnya terjadi di sisi server, dan alasannya
    // sampai ke sini apa adanya.
    if (akunSeharusnya.siap === false && akunSeharusnya.sebab) {
      kabar.textContent += ` Catatan: ${akunSeharusnya.sebab}`;
    }

    tombol.addEventListener("click", () => {
      // Berganti sesi mengubah akun SIPP untuk SELURUH peramban, jadi
      // ditegaskan sekali sebelum meninggalkan halaman perkara ini.
      const setuju = window.confirm(
        `Masuk SIPP sebagai ${namaPejabat}${akunSipp ? ` (akun ${akunSipp})` : ""}?\n\n` +
          `Sesi ${namaSekarang} akan ditutup, dan halaman ini berpindah ke SIPP.`
      );
      if (!setuju) return;
      if (!nomorPerkara) {
        kabar.textContent = "Nomor perkara tidak terbaca - tidak dapat berganti akun.";
        return;
      }
      tombol.disabled = true;
      tombol.classList.add("aleta-tombol-mati");
      kabar.textContent = `Menutup sesi dan masuk sebagai ${namaPejabat}…`;
      const alamat =
        `${ALETA_API_MASUK_PEJABAT}?jenis=${encodeURIComponent(formulir)}` +
        `&nomor=${encodeURIComponent(nomorPerkara)}` +
        `&perkaraId=${encodeURIComponent(perkaraId)}`;
      window.location.href = alamat;
    });

    // Pilihan kedua: teruskan tanpa berganti akun.
    const teruskan = buatElemen(
      "button",
      "aleta-tautan",
      `atau teruskan ke ${namaJabatan} tanpa berganti akun`
    );
    teruskan.addEventListener("click", () => {
      teruskan.disabled = true;
      void titipkanBorang({ tombol: teruskan, kabar, formulir, nilai, usulan, untukJabatan });
    });
    tombol.insertAdjacentElement("afterend", teruskan);
    return;
  }

  // Akun SIPP-nya sudah benar - tetapi peran ALETA-nya belum tentu berwenang.
  // Ini hanya terjadi pada mode ketat; pada mode longgar semua peran boleh.
  if (bolehJenis[formulir] !== true) {
    const namaJabatan = untukJabatan[formulir] || "pejabat berwenang";
    tombol.disabled = false;
    tombol.classList.remove("aleta-tombol-mati");
    tombol.textContent = `Teruskan ke ${namaJabatan}`;
    kabar.textContent = `${formulir.toUpperCase()} ditetapkan ${namaJabatan}. Teruskan usulannya - tidak perlu berganti akun.`;
    tombol.addEventListener("click", () => {
      tombol.disabled = true;
      tombol.classList.add("aleta-tombol-mati");
      void titipkanBorang({ tombol, kabar, formulir, nilai, usulan, untukJabatan });
    });
    return;
  }

  const medanBorang = (keadaan.medan || []).filter(
    (x) => x.borang === formulir && x.medan !== "simpan"
  );
  const medanSimpan = (keadaan.medan || []).find(
    (x) => x.borang === formulir && x.medan === "simpan"
  );
  const simpanOtomatis = keadaan.simpanOtomatis === "nyala";

  tombol.disabled = false;
  tombol.classList.remove("aleta-tombol-mati");
  tombol.textContent = `Kerjakan ${formulir.toUpperCase()}`;
  kabar.textContent = simpanOtomatis
    ? `Mengisi dan menyimpan ${Object.keys(nilai).length} kolom.`
    : `Mengisi ${Object.keys(nilai).length} kolom. Simpan tetap Anda yang menekan.`;

  // Akun SIPP yang sedang terbuka tidak terbaca dari kepala halaman. Bukan
  // alasan untuk menahan pengisian - mengisi tidak menulis apa pun - tetapi
  // petugas perlu tahu bahwa pemeriksaan akun TIDAK berjalan, sebab yang
  // menentukan siapa tercatat adalah tekanan Simpan-nya sendiri.
  if (akunSeharusnya && namaSekarang === "") {
    kabar.textContent +=
      ` Akun SIPP yang terbuka tidak terbaca - pastikan sendiri Anda memakai akun ${akunSeharusnya.namaLengkap}.`;
  }

  tombol.addEventListener("click", () => {
    // Dimatikan seketika. Tanpa ini, tekanan kedua saat yang pertama masih
    // berjalan akan mencatat pengisian dua kali untuk satu penetapan.
    tombol.disabled = true;
    tombol.classList.add("aleta-tombol-mati");
    void kerjakanBorang({
      tombol,
      kabar,
      formulir,
      nilai,
      medanBorang,
      medanSimpan,
      simpanOtomatis,
      usulan,
      data,
      // Bila penetapan ini pernah diteruskan operator, penerusannya ditutup
      // sesudah pengisiannya berhasil - supaya ia tidak terus muncul sebagai
      // pekerjaan yang menunggu padahal sudah dikerjakan.
      idTitipan: sudahDititipkan ? sudahDititipkan.id : "",
    });
  });
}

/**
 * Mengerjakan satu formulir: catat, isi, simpan bila diizinkan, lalu periksa.
 *
 * ============================================================================
 * DICATAT SEBELUM DIISI
 * ============================================================================
 *
 * Urutannya begitu karena pengisian yang gagal di tengah adalah yang paling
 * perlu ditelusuri - dan kalau catatannya baru ditulis sesudah berhasil,
 * justru itulah yang tidak meninggalkan jejak sama sekali.
 */
/**
 * Meneruskan usulan untuk dikerjakan pejabat yang berwenang.
 *
 * ============================================================================
 * YANG DITITIPKAN PEKERJAANNYA, BUKAN AKUNNYA
 * ============================================================================
 *
 * Tidak ada kata sandi yang disimpan, tidak ada yang masuk atas nama siapa
 * pun. Yang disimpan usulan yang sudah disiapkan - dan pejabatnya tetap
 * memeriksa lalu menekannya sendiri, dengan akunnya sendiri.
 *
 * Usulannya disimpan BEKU. Giliran juru sita bergeser tiap ada penetapan
 * baru, dan usulan yang berubah diam-diam antara diteruskan dan dikerjakan
 * adalah usulan yang tidak pernah diperiksa siapa pun dalam bentuk yang
 * akhirnya tercatat.
 */
async function titipkanBorang({ tombol, kabar, formulir, nilai, usulan, untukJabatan }) {
  kabar.textContent = "Meneruskan…";

  const ringkasan = Object.entries(nilai)
    .map(([kolom, isi]) => `${kolom}: ${isi}`)
    .join(" · ")
    .slice(0, 280);

  try {
    const respons = await alatAmbil(ALETA_API_ANTREAN, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        perkaraId: String((usulan.perkara && usulan.perkara.perkaraId) || ""),
        nomorPerkara: String((usulan.perkara && usulan.perkara.nomorPerkara) || ""),
        jenis: formulir,
        usulan: nilai,
        ringkasan,
      }),
    }, "Meneruskan usulan");
    const isi = await respons.json();
    const jawab = isi && isi.data ? isi.data : isi;

    if (!jawab || jawab.ok !== true) {
      kabar.textContent = `Tidak dapat diteruskan: ${(jawab && jawab.alasan) || respons.status}`;
      tombol.disabled = false;
      tombol.classList.remove("aleta-tombol-mati");
      return;
    }

    tombol.textContent = "Sudah diteruskan";
    kabar.textContent = `Menunggu ${jawab.untuk || untukJabatan[formulir] || "pejabat berwenang"} membuka perkara ini di SIPP.`;
  } catch (galat) {
    kabar.textContent = String(galat.message || galat).slice(0, 160);
    tombol.disabled = false;
    tombol.classList.remove("aleta-tombol-mati");
  }
}

/**
 * Menutup penerusan sesudah penetapannya benar-benar dikerjakan.
 *
 * Kegagalannya tidak dilaporkan sebagai kegagalan pengisian - formulirnya sudah
 * terisi, dan penerusan yang tertinggal terbuka hanya berarti satu baris yang
 * perlu ditutup tangan. Menyatakan pengisiannya gagal karena itu akan
 * membuat orang mengulangi pengisian yang sudah berhasil.
 */
async function tutupTitipan(id, formulir) {
  if (!id) return;
  try {
    await fetch(ALETA_API_ANTREAN, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, keadaan: "dikerjakan", akunSipp: akunSipp() }),
    });
  } catch (galat) {
    /* penerusannya tetap terbuka - dapat ditutup dari daftar */
  }
}

/**
 * Pagar bersama untuk pengisian borang SIPP (20 Okt 2026, agen P1): sebelum
 * mengisi dan SEBELUM menekan Simpan SIPP, keadaan penetapan perkara dibaca
 * dari sumber yang sama dengan penulis di server, dan kunci perkara dipegang
 * selama pengisian. Langkah yang sudah ada tidak diisi ulang (tidak ada
 * penetapan ganda dari mode otomatis ini); perkara yang sedang dikerjakan
 * pekerjaan lain tidak disentuh.
 */
async function kerjakanBorang(rencana) {
  const { tombol, kabar, formulir, usulan } = rencana;
  const perkaraId = Number((usulan && usulan.perkara && usulan.perkara.perkaraId) || 0);
  const kerja = typeof aletaPenetapanKerja === "object" ? aletaPenetapanKerja : null;
  let token = "";
  if (kerja && perkaraId) {
    const mundur = (pesan) => {
      kabar.textContent = pesan;
      tombol.disabled = false;
      tombol.classList.remove("aleta-tombol-mati");
    };
    const k = await kerja.keadaan({ perkaraId });
    if (k && k.ok !== false && k.langkah && k.langkah[formulir] && k.langkah[formulir].ada) {
      mundur(`${formulir.toUpperCase()} perkara ini sudah ada di SIPP - tidak diisi ulang. Muat ulang halaman.`);
      return;
    }
    if (rencana.simpanOtomatis && (!k || k.ok === false)) {
      mundur(kalimatAlasan("keadaan_tidak_terbaca"));
      return;
    }
    const kunci = await kerja.ambilKunci(perkaraId, `isi-borang-${formulir}`);
    if (!kunci || kunci.ok !== true) {
      mundur(kalimatAlasan(String((kunci && kunci.alasan) || "kunci_tidak_tersedia")));
      return;
    }
    token = String(kunci.token || "");
  }
  try {
    await kerjakanBorangInti(rencana);
  } finally {
    if (kerja && token) await kerja.lepasKunci(perkaraId, token);
  }
}

async function kerjakanBorangInti(rencana) {
  const { tombol, kabar, formulir, nilai, medanBorang, medanSimpan, simpanOtomatis, usulan, data } =
    rencana;
  const idTitipan = rencana.idTitipan || "";

  const kembalikan = (pesan) => {
    kabar.textContent = pesan;
    tombol.disabled = false;
    tombol.classList.remove("aleta-tombol-mati");
  };

  // --- 1. catat -----------------------------------------------------------
  kabar.textContent = "Mencatat…";
  let dicatat = [];
  try {
    const respons = await alatAmbil(ALETA_API_CATAT, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        perkaraId: String((usulan.perkara && usulan.perkara.perkaraId) || ""),
        nomorPerkara: String((usulan.perkara && usulan.perkara.nomorPerkara) || ""),
        akunSipp: akunSipp(),
        baris: barisCatatan(formulir, nilai, usulan, (data && data.pilihanManual) || {}),
      }),
    }, "Mencatat penetapan");
    const isi = await respons.json();
    const jawab = isi && isi.data ? isi.data : isi;
    if (!jawab || jawab.ok !== true) {
      kembalikan(`Tidak dicatat: ${(jawab && jawab.alasan) || respons.status}`);
      return;
    }
    dicatat = jawab.dicatat || [];
    if (jawab.peringatanUrutan) kabar.textContent = jawab.peringatanUrutan;
  } catch (galat) {
    kembalikan(String(galat.message || galat).slice(0, 160));
    return;
  }

  // --- 2. isi -------------------------------------------------------------
  kabar.textContent = "Mengisi formulir…";
  const hasilIsi = await isiBorang(medanBorang, nilai);
  if (!hasilIsi.ok) {
    kembalikan(`Berhenti di ${hasilIsi.alasan}. Formulir terisi sebagian - periksa sebelum menyimpan.`);
    return;
  }

  // --- 3. simpan, hanya bila memang dinyalakan -----------------------------
  if (!simpanOtomatis || !medanSimpan || !medanSimpan.penunjuk) {
    // Penerusannya ditutup di sini, bukan sesudah Simpan: yang menutupnya bukan
    // tersimpannya, melainkan bahwa pejabat berwenang sudah mengerjakannya.
    // Menunggu Simpan berarti penerusan yang formulirnya sudah terisi tetap
    // muncul sebagai pekerjaan yang menunggu.
    await tutupTitipan(idTitipan, formulir);
    kabar.textContent = `${formulir.toUpperCase()} terisi. Periksa, lalu tekan Simpan di SIPP.`;
    tombol.textContent = "Sudah diisi";
    return;
  }

  await tutupTitipan(idTitipan, formulir);
  // Dibaca ULANG tepat sebelum Simpan SIPP ditekan: selama borang diisi, jalan
  // lain (tombol server, tab lain) dapat sudah menulis langkah ini. Ada -> tidak
  // ditekan. Tidak terbaca -> tidak ditekan (gagal tertutup).
  if (typeof aletaPenetapanKerja === "object") {
    const baru = await aletaPenetapanKerja.keadaan({ perkaraId: Number((usulan.perkara && usulan.perkara.perkaraId) || 0) });
    if (!baru || baru.ok === false) {
      kembalikan(`Terisi, tetapi Simpan tidak ditekan: ${kalimatAlasan("keadaan_tidak_terbaca")}`);
      return;
    }
    if (baru.langkah && baru.langkah[formulir] && baru.langkah[formulir].ada) {
      kembalikan(`${formulir.toUpperCase()} ternyata sudah ada di SIPP selagi formulir diisi - Simpan TIDAK ditekan, supaya tidak ganda. Muat ulang halaman.`);
      return;
    }
  }
  kabar.textContent = "Menyimpan…";
  // Penunjuk Simpan hasil pemetaan portal dapat bernama apa saja: pengawal dasbor dipasang eksplisit.
  if (globalThis.aletaMuatUlangSipp) await globalThis.aletaMuatUlangSipp.pasangPengawal("").catch(() => undefined);
  const jawabSimpan = await kirimKeJembatan({ jenis: "tekan", penunjuk: medanSimpan.penunjuk });
  if (!jawabSimpan.ok) {
    kembalikan(`Terisi, tetapi Simpan tidak dapat ditekan: ${jawabSimpan.alasan}. Tekan sendiri.`);
    return;
  }

  // --- 4. periksa balik ----------------------------------------------------
  //
  // Mengisi formulir tidak sama dengan tercatat. Tanpa langkah ini, catatannya
  // hanya membuktikan ALETA mengetik - bukan bahwa pengadilan mencatat.
  kabar.textContent = "Memeriksa ke SIPP…";
  await new Promise((tunggu) => setTimeout(tunggu, 1500));

  try {
    const respons = await alatAmbil(ALETA_API_CATAT, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nomorPerkara: String((usulan.perkara && usulan.perkara.nomorPerkara) || ""),
        idBaris: dicatat,
        harapan: { [formulir]: usulan.tanggalPenetapan || "" },
      }),
    }, "Memeriksa ke SIPP");
    const isi = await respons.json();
    const jawab = isi && isi.data ? isi.data : isi;
    if (jawab && jawab.mendarat === "ya") {
      kabar.textContent = `${formulir.toUpperCase()} tercatat di SIPP.`;
      tombol.textContent = "Selesai";
    } else {
      kabar.textContent = `Belum terbaca di SIPP (${(jawab && jawab.mendarat) || "tidak tahu"}). Periksa halamannya.`;
      tombol.textContent = "Perlu diperiksa";
    }
  } catch (galat) {
    kabar.textContent = `Tersimpan, tetapi pemeriksaannya gagal: ${String(galat.message || galat).slice(0, 90)}`;
  }
}

/**
 * ============================================================================
 * DATA UMUM DARI BERKAS GUGATAN
 * ============================================================================
 *
 * Petugas memilih berkas gugatan yang diunggah - .docx, .doc, .rtf, atau .pdf
 * teks - dan ALETA memetik isian Data Umum darinya.
 *
 * HASILNYA SELALU DITAMPILKAN LEBIH DULU, beserta potongan kalimat asal tiap
 * petikan. Gugatan ditulis manusia dan tidak ada dua yang bentuknya sama;
 * petikan yang muncul tanpa asal-usul hanya bisa dipercaya atau tidak
 * dipercaya, sedangkan yang menyebutkan barisnya bisa dicocokkan dalam dua
 * detik.
 *
 * Berkasnya TIDAK disimpan di mana pun. Ia dibaca, dipetik, lalu dilepas.
 */
/**
 * ============================================================================
 * ENAM RUAS YANG DIPETIK TETAPI TIDAK PERNAH DIGAMBAR
 * ============================================================================
 *
 * Pemetik di server mengembalikan ENAM BELAS ruas, dan daftar ini dulu hanya
 * menyebut sepuluh. Yang hilang justru ruas Data Umum yang paling dicari saat
 * mendaftarkan perkara perkawinan - tanggal menikah, nomor dan tanggal kutipan
 * akta nikah, KUA tempat menikah - beserta obyek sengketa, posita, dan
 * keterangan surat gugatannya.
 *
 * Akibatnya papan ini terbaca seolah ALETA hanya bisa memetik data PIHAK,
 * padahal data pernikahannya sudah terpetik sejak awal dan hanya dibuang di
 * layar. Ruas yang tidak ada di daftar ini lenyap tanpa jejak: tidak ada
 * galat, dan tidak ada yang menyebutkan bahwa ia pernah ada.
 *
 * Urutannya sengaja mengikuti urutan borang Data Umum SIPP, bukan urutan
 * pemetiknya. Yang membaca papan ini sedang mengisi borang itu baris demi
 * baris, dan daftar yang urutannya berbeda memaksanya melompat-lompat.
 */
const NAMA_PETIKAN = {
  // --- keterangan surat ---------------------------------------------------
  tanggalSurat: "Tanggal surat",
  nomorSurat: "Nomor surat",

  // --- data pernikahan ----------------------------------------------------
  tanggalMenikah: "Tanggal menikah",
  tanggalAktaNikah: "Tanggal kutipan akta nikah",
  nomorAktaNikah: "Nomor kutipan akta nikah",
  kuaTempatMenikah: "KUA tempat menikah",

  // --- para pihak ---------------------------------------------------------
  penggugat: "Penggugat / Pemohon",
  umurPenggugat: "Umur",
  agamaPenggugat: "Agama",
  pekerjaanPenggugat: "Pekerjaan",
  pendidikanPenggugat: "Pendidikan",
  alamatPenggugat: "Alamat penggugat",
  // Alamat yang SUDAH dirapikan berdiri di sebelah alamat mentahnya, bukan
  // menggantikannya. Alamat ini tercetak pada relaas panggilan dan pada
  // identitas para pihak di kepala putusan; yang memilihnya harus dapat
  // menyandingkan keduanya lebih dulu. Asalnya menyebutkan apa yang diubah,
  // dan apa yang masih kurang tetapi TIDAK ditambahkan sendiri.
  alamatPenggugatRapi: "Alamat penggugat (dirapikan)",
  tergugat: "Tergugat / Termohon",
  alamatTergugat: "Alamat tergugat",
  alamatTergugatRapi: "Alamat tergugat (dirapikan)",
  // Beberapa sekaligus - lihat catatan pada penggambarnya.
  domisiliElektronik: "Domisili elektronik",
  // Perbaikan 5 Okt (butir 28): identitas lengkap tiap pihak - satu baris
  // ringkas per pihak di sini; UI Baru menggambar pratinjau + "Isi pihak ke
  // SIPP" di bawahnya (p5GambarPihakGugatan).
  pihak: "Identitas pihak",

  // --- isi gugatan --------------------------------------------------------
  obyekSengketa: "Obyek sengketa",
  nilaiSengketa: "Nilai sengketa",
  posita: "Posita",
  petitum: "Petitum",
};

function gambarPetikan(isi, hasil) {
  if (hasil.kasar) {
    isi.appendChild(
      buatElemen(
        "div",
        "aleta-tetap-awas",
        "Berkas .doc lama hanya dapat dibaca kasar - petikannya lebih mungkin meleset. Periksa tiap baris."
      )
    );
  }

  let adaIsi = false;
  for (const [kunci, label] of Object.entries(NAMA_PETIKAN)) {
    const petikan = hasil.petikan ? hasil.petikan[kunci] : null;
    if (!petikan) continue;

    // Sebagian ruas memulangkan BEBERAPA petikan sekaligus - domisili
    // elektronik, misalnya, sebab gugatan dapat memuat surel penggugat dan
    // tergugat berdampingan. Masing-masing digambar barisnya sendiri beserta
    // kalimat asalnya: yang menentukan surel ini milik siapa justru kalimat
    // itu, dan menggabungkannya menjadi satu baris membuang keterangannya.
    if (Array.isArray(petikan)) {
      for (const satu of petikan) {
        if (!satu || !satu.nilai) continue;
        adaIsi = true;
        isi.appendChild(barisPenetapan(label, String(satu.nilai).slice(0, 180), satu.asal, ""));
      }
      continue;
    }

    if (!petikan.nilai) continue;
    adaIsi = true;
    isi.appendChild(barisPenetapan(label, petikan.nilai.slice(0, 180), petikan.asal, ""));
  }

  if (!adaIsi) {
    isi.appendChild(
      buatElemen(
        "div",
        "aleta-kosong",
        `Tidak ada isian yang dikenali dari berkas ini (${hasil.panjangTeks || 0} huruf terbaca).`
      )
    );
  }
}

/**
 * ============================================================================
 * BERKAS GUGATAN YANG SUDAH ADA DI ARSIP ALETA
 * ============================================================================
 *
 * Sampai sekarang berkas gugatan harus DICARI dan DIPILIH petugas dari
 * cakramnya sendiri - padahal berkas yang sama sudah ditarik ALETA dari
 * e-Court sejak hari perkara itu didaftarkan, dan daftarnya sudah tergambar
 * di panel ini juga, beberapa baris di bawah.
 *
 * Yang dikerjakan petugas selama ini: membuka e-Court, mengunduh gugatannya
 * sekali lagi, menyimpannya entah di mana, lalu memilihnya di sini. Tiga
 * langkah untuk berkas yang sudah ada di tangan ALETA.
 *
 * Pemilih berkas manual TIDAK dibuang: perkara yang berkasnya belum pernah
 * ditarik - dan perkara lama memang banyak yang begitu - tetap perlu jalan
 * itu. Yang ditambahkan hanya jalan yang lebih pendek bila memang ada.
 */
const POLA_BERKAS_GUGATAN = /gugatan|permohonan/i;

/** Dokumen e-Court perkara ini yang menyerupai berkas gugatan. */
function dokumenGugatan(konteks) {
  const semua = (konteks && Array.isArray(konteks.dokumen) && konteks.dokumen) || [];
  const cocok = semua.filter((d) => POLA_BERKAS_GUGATAN.test(sebutanDokumen(d)));
  // Kalau tidak ada yang menyerupai gugatan, seluruh dokumennya ditawarkan -
  // judul dokumen e-Court tidak selalu menyebut kata gugatan, dan daftar
  // kosong di sini terbaca sebagai ALETA yang tidak punya berkasnya sama
  // sekali padahal berkasnya ada.
  const dipakai = cocok.length > 0 ? cocok : semua;
  return dipakai.filter((d) => d && d.documentKey).slice(0, 6);
}

/** Membaca satu berkas arsip dan memetik Data Umum darinya. */
async function bacaBerkasArsip(documentKey, format) {
  const respons = await alatAmbil(
    ALETA_API_BERKAS_ARSIP,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentKey, format: format || "pdf" }),
    },
    "Membaca berkas dari arsip ALETA"
  );
  if (respons.status === 403) throw new Error("Peran Anda tidak diberi akses papan penunjukan.");
  if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Membaca berkas dari arsip ALETA"));
  const luar = await respons.json();
  return luar && luar.data ? luar.data : luar;
}

/** Data Umum dari berkas gugatan yang diunggah petugas. */
function bagianDataUmum(konteks) {
  const kotak = bagian("Data Umum dari berkas gugatan", "dataUmum", true);
  const isi = kotak.isi;

  const kaki = buatElemen("div", "aleta-tetap-kaki");
  const pemilih = document.createElement("input");
  pemilih.type = "file";
  pemilih.accept = ".docx,.doc,.rtf,.pdf,.txt";
  pemilih.className = "aleta-berkas";
  kaki.appendChild(pemilih);
  isi.appendChild(kaki);

  const kabar = buatElemen("div", "aleta-tetap-sebab", "Pilih berkas gugatan untuk dibaca.");
  isi.appendChild(kabar);

  const hasilKotak = buatElemen("div", "aleta-petikan");

  // Jalan yang lebih pendek, digambar DI ATAS pemilih berkas: berkas yang
  // sudah ada di arsip dibaca dengan satu tekanan, tanpa mengunduh apa pun.
  const arsip = dokumenGugatan(konteks);
  if (arsip.length > 0) {
    const kotakArsip = buatElemen("div", "aleta-arsip-gugatan");
    kotakArsip.appendChild(
      buatElemen(
        "div",
        "aleta-tetap-sebab",
        "Sudah ada di arsip ALETA - tidak perlu diunduh dari e-Court lebih dahulu:"
      )
    );
    for (const d of arsip) {
      const baris = buatElemen("div", "aleta-arsip-baris");
      baris.appendChild(
        buatElemen("span", "aleta-arsip-judul", d.judulDokumen || d.jenisDokumen || "Dokumen")
      );
      const tombolBaca = buatElemen("button", "aleta-portal-tautan", "Baca berkas ini");
      tombolBaca.type = "button";
      tombolBaca.addEventListener("click", async () => {
        tombolBaca.disabled = true;
        hasilKotak.textContent = "";
        kabar.textContent = `Membaca ${d.judulDokumen || "berkas"} dari arsip…`;
        try {
          const hasil = await bacaBerkasArsip(d.documentKey);
          if (!hasil || hasil.ok !== true) {
            kabar.textContent =
              (hasil && (hasil.pesan || hasil.alasan)) || "Berkas tidak dapat dibaca.";
            tombolBaca.disabled = false;
            return;
          }
          kabar.textContent = `${hasil.nama} terbaca dari arsip ALETA. Periksa tiap baris sebelum dipakai.`;
          gambarPetikan(hasilKotak, hasil);
          gambarKerjakanDataUmum(hasilKotak, hasil, konteks);
          // Perbaikan 5 Okt (butir 28, UI Baru): para pihak -> blangko pihak SIPP.
          if (typeof p5GambarPihakGugatan === "function" && s1Aktif()) p5GambarPihakGugatan(hasilKotak, hasil);
        } catch (galat) {
          kabar.textContent = String(galat.message || galat).slice(0, 180);
        } finally {
          tombolBaca.disabled = false;
        }
      });
      baris.appendChild(tombolBaca);
      kotakArsip.appendChild(baris);
    }
    isi.appendChild(kotakArsip);
  }

  isi.appendChild(hasilKotak);

  pemilih.addEventListener("change", () => {
    const berkas = pemilih.files && pemilih.files[0];
    if (!berkas) return;

    hasilKotak.textContent = "";
    kabar.textContent = `Membaca ${berkas.name}…`;

    void (async () => {
      try {
        const badan = new FormData();
        badan.append("berkas", berkas);
        const respons = await alatAmbil(
          ALETA_API_BERKAS_GUGATAN,
          { method: "POST", credentials: "include", body: badan },
          "Membaca berkas gugatan"
        );
        if (respons.status === 403) throw new Error("Peran Anda tidak diberi akses papan penunjukan.");
        if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Membaca berkas gugatan"));

        const luar = await respons.json();
        const hasil = luar && luar.data ? luar.data : luar;

        if (!hasil || hasil.ok !== true) {
          kabar.textContent =
            (hasil && (hasil.pesan || hasil.alasan)) || "Berkas tidak dapat dibaca.";
          return;
        }

        kabar.textContent = `${hasil.nama} terbaca. Periksa tiap baris sebelum dipakai.`;
        gambarPetikan(hasilKotak, hasil);
        gambarKerjakanDataUmum(hasilKotak, hasil, konteks);
        // Perbaikan 5 Okt (butir 28, UI Baru): para pihak -> blangko pihak SIPP.
        if (typeof p5GambarPihakGugatan === "function" && s1Aktif()) p5GambarPihakGugatan(hasilKotak, hasil);
      } catch (galat) {
        kabar.textContent = String(galat.message || galat).slice(0, 180);
      }
    })();
  });

  return kotak;
}

/**
 * ============================================================================
 * MENGISIKAN DATA UMUM KE SIPP
 * ============================================================================
 *
 * Enam ruas yang dapat diisikan, dan hanya enam. Sisanya - nama pihak, alamat,
 * pekerjaan, obyek sengketa - sengaja TIDAK ikut: para pihak punya tabelnya
 * sendiri beserta aturan kumulasi dan kuasa hukumnya, dan mengisikannya dari
 * petikan mesin menuntut ketelitian yang belum dapat dijamin.
 *
 * ============================================================================
 * KERING LEBIH DAHULU, DAN ITU BUKAN PILIHAN
 * ============================================================================
 *
 * Tekanan pertama SELALU kering: yang muncul daftar pernyataan yang akan
 * dikirim, beserta ruas mana yang dilewati karena sudah terisi di SIPP.
 * Menulis menuntut tekanan KEDUA pada tombol yang berbeda, yang baru muncul
 * sesudah hasil keringnya terbaca.
 *
 * Petikan dari berkas gugatan adalah hasil baca mesin atas dokumen yang
 * ditulis manusia. Menaruh tombol tulis sebagai tekanan pertama berarti
 * mempertaruhkan berkas perkara pada ketepatan pembacaan yang belum sempat
 * dilihat siapa pun.
 */
function gambarKerjakanDataUmum(isi, hasil, konteks) {
  const perkaraId = String((konteks && konteks.identitas && konteks.identitas.perkaraId) || "");
  if (!perkaraId) return;

  const petikan = hasil.petikan || {};
  const ambil = (kunci) => {
    const p = petikan[kunci];
    return p && p.nilai ? String(p.nilai).trim() : "";
  };

  const dataUmum = {
    tanggalSurat: ambil("tanggalSurat"),
    nomorSurat: ambil("nomorSurat"),
    tanggalMenikah: ambil("tanggalMenikah"),
    tanggalAktaNikah: ambil("tanggalAktaNikah"),
    nomorAktaNikah: ambil("nomorAktaNikah"),
    kuaTempatMenikah: ambil("kuaTempatMenikah"),
  };
  if (!Object.values(dataUmum).some(Boolean)) return;

  const kaki = buatElemen("div", "aleta-tetap-kaki");
  const kabar = buatElemen("div", "aleta-tetap-sebab", "");
  const tombol = buatElemen("button", "aleta-tombol", "Periksa dulu - belum ditulis");
  tombol.type = "button";

  let rencanaSiap = null;

  const wadahMuatUlang = buatElemen("div", "aleta-muat-ulang-wadah");
  const kirim = async (kering) => {
    tombol.disabled = true;
    kabar.textContent = kering ? "Menyusun pernyataan…" : "Menuliskan ke SIPP…";
    if (!kering) await catatAlamatSebelumTulis(String((konteks && konteks.nomorPerkara) || ""));
    try {
      const respons = await alatAmbil(ALETA_API_TULIS, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jenis: "dataUmum",
          perkaraId: Number(perkaraId),
          tanggalPenetapan: new Date().toISOString().slice(0, 10),
          dataUmum,
          // Akun pejabat yang akan tercatat sebagai pengisi. Diambil dari
          // halaman SIPP yang sedang terbuka - itulah yang dilihat petugas,
          // dan menebaknya dari tempat lain akan berselisih dengan yang
          // tertulis di kepala panel.
          olehUsername: namaPenggunaSipp(),
          kering,
        }),
      }, "Menulis Data Umum");
      const luar = await respons.json();
      const h = luar && luar.data ? luar.data : luar;

      if (h.ok === false) {
        kabar.textContent =
          h.alasan === "tidak_ada_yang_perlu_diisi"
            ? `Tidak ada yang perlu diisi - seluruhnya sudah terisi di SIPP. ${(h.dilewati || []).join("; ")}`
            : `Ditolak: ${h.alasan || "sebab tidak disebut"}`;
        tombol.disabled = false;
        return;
      }

      if (kering) {
        rencanaSiap = true;
        const baris = (h.rencana || []).map((x) => `${x.tabel} ${x.aksi} — ${x.keterangan}`);
        kabar.textContent =
          `Akan tercatat atas nama ${h.atasNama ? h.atasNama.namaLengkap || h.atasNama.username : "?"}. ` +
          `${baris.length} pernyataan: ${baris.join(" · ")}. ` +
          `${(h.dilewati || []).length > 0 ? `Dilewati: ${(h.dilewati || []).join("; ")}.` : ""}`;
        tombol.textContent = "Tuliskan ke SIPP";
        tombol.disabled = false;
        return;
      }

      // Data Umum menulis ke tabel perkara - keadaan yang dipajang menu
      // Berkas dan Perkara ikut berubah karenanya.
      lupakanStatusPerkara(String((konteks && konteks.nomorPerkara) || ""));
      kabar.textContent = `Tersimpan. ${(h.selesai || []).length} pernyataan dijalankan.`;
      tombol.textContent = "Sudah ditulis";
      // Halaman Data Umum SIPP memperlihatkan data lama sampai dimuat ulang.
      muatUlangSesudahTulis({
        nomor: String((konteks && konteks.nomorPerkara) || ""),
        judulOk: "Data Umum tersimpan di SIPP.",
        baris: [{ jenis: "Data Umum", teks: `${(h.selesai || []).length} pernyataan dijalankan` }],
        wadah: wadahMuatUlang,
      });
    } catch (galat) {
      kabar.textContent = String(galat.message || galat).slice(0, 180);
      tombol.disabled = false;
    }
  };

  tombol.addEventListener("click", () => void kirim(!rencanaSiap));

  kaki.appendChild(tombol);
  isi.appendChild(kaki);
  isi.appendChild(kabar);
  isi.appendChild(wadahMuatUlang);
}

/**
 * ============================================================================
 * BACA BORANG - MENGISI PETA KOLOM DARI KENYATAAN
 * ============================================================================
 *
 * Menyebutkan kolom apa saja yang benar-benar ada di halaman ini, lengkap
 * dengan label dan penunjuknya, untuk disalin ke pengaturan peta kolom.
 *
 * Ini yang membuat penunjuk kolom tidak pernah perlu ditebak. Penunjuk yang
 * salah tidak gagal dengan jelas - ia mengenai kolom LAIN, dan nama juru sita
 * masuk ke kolom panitera tanpa ada yang tahu sampai relaasnya terbit.
 *
 * Nilai kolomnya sengaja TIDAK ikut disebutkan: formulir perkara yang sedang
 * terbuka memuat data pihak berperkara, dan yang dibutuhkan hanya namanya.
 */
/**
 * ============================================================================
 * MENGISI BORANG PUTUSAN AKHIR SIPP DARI DRAF ALETA
 * ============================================================================
 *
 * Borang Putusan Akhir menuntut potongan yang terpisah-pisah, dan tiga di
 * antaranya panjang: Pertimbangan Hukum, Amar, dan Amar Anonim. Ketiganya
 * CKEditor, dan selama ini disalin tangan dari naskah putusan - satu per satu,
 * sambil berpindah jendela, pada hari yang paling sibuk.
 *
 * ============================================================================
 * TIGA HAL YANG SENGAJA TIDAK DIKERJAKAN DI SINI
 * ============================================================================
 *
 * 1. TIDAK MEMUTUSKAN APA PUN. Naskahnya dipecah dan namanya disamarkan di
 *    portal, yang diuji tiap pemeriksaan berkala. Berkas ini hanya menaruh
 *    hasilnya ke kolom yang benar.
 *
 * 2. TIDAK MENEKAN SIMPAN. Yang tersimpan di sini menjadi putusan resmi.
 *    Petugas membaca lalu menyimpan sendiri - dan itu bukan kehati-hatian yang
 *    berlebihan, melainkan satu-satunya tempat manusia masih membacanya.
 *
 * 3. TIDAK MENYENTUH STATUS PUTUSAN, VERSTEK, DAN SUMBER HUKUM. Pilihannya
 *    sudah disaring SIPP menurut jenis dan alur perkara, dan salah pilih di
 *    situ mengubah jenis putusannya - bukan sekadar salah ketik. Yang
 *    dikerjakan ALETA hanya isian teks panjang yang selama ini disalin tangan.
 */
/**
 * ============================================================================
 * ISIAN ALASAN PADA LAYAR INFO PERKARA AGAMA (DATA UMUM)
 * ============================================================================
 *
 * Layar ini menuntut satu medan "alasan" yang berbeda untuk tiap jenis perkara
 * agama, dan hanya satu di antaranya yang tampak pada satu perkara: alasan
 * poligami, alasan pembatalan kawin, alasan penguasaan anak, alasan pengesahan
 * anak, alasan asal usul anak, alasan itsbat nikah, alasan dispensasi kawin.
 * Seluruhnya tersimpan ke satu tabel dengan penanda yang berbeda, dan angka
 * itulah yang kelak menjadi laporan statistik perkara agama.
 *
 * Sama seperti borang putusan, tidak satu pun aturan "medan mana untuk perkara
 * mana" disalin ke sini. Yang dikerjakan: menanyakan kepada HALAMAN medan mana
 * yang sedang tampak, lalu meminta ALETA memilih satu dari daftar pilihan yang
 * halaman itu sendiri berikan.
 *
 * Bedanya dengan borang putusan hanya pada BUKTINYA. Data Umum diisi pada hari
 * perkara didaftarkan - belum ada draf putusan, belum ada pertimbangan hukum -
 * jadi yang dibaca adalah posita dan petitum yang ada di layar yang sama.
 */
function bagianIsiAlasanPerkara(nomorPerkara) {
  const kotak = bagian("Isi formulir Data Umum dari posita", "isiAlasanPerkara", true);
  const isi = kotak.isi;

  isi.appendChild(
    buatElemen(
      "div",
      "aleta-tetap-sebab aleta-remeh",
      "Membaca posita dan petitum yang ada di layar ini, lalu mengisikan dua hal yang " +
        "berbeda sifatnya. Data pernikahan DIPETIK apa adanya - nomor akta dan tanggalnya " +
        "tertulis di positanya, dan tiap petikan dapat Anda sunting sebelum diisikan. " +
        "Medan alasan DIUSULKAN - angka itulah yang kelak menjadi laporan statistik perkara " +
        "agama, jadi periksa tiap usulan. Tombol Simpan tetap Anda yang menekan."
    )
  );

  const tombol = buatElemen("button", "aleta-permintaan-tombol", "Baca posita, susun isian");
  tombol.type = "button";
  const kabar = buatElemen("div", "aleta-abt-kabar");
  const wadah = buatElemen("div", "aleta-isian-putusan");
  isi.appendChild(tombol);
  isi.appendChild(kabar);
  isi.appendChild(wadah);

  // Penunjuknya berbasis NAMA, bukan id, mengikuti pilihan yang sama pada
  // borang putusan: pada borang SIPP ada select yang memakai id milik select
  // lain, dan querySelector("#...") memulangkan yang mana pun yang lebih dulu
  // di dokumen. Nama medan tidak kembar, dan namanya pula yang dikirim ke
  // peladen.
  //
  // Medan berisi BANYAK pilihan sekaligus - objek wakaf dan akad syariah
  // tambahan - sengaja TIDAK ditawarkan. Keduanya digambar oleh alat pilihan
  // ganda milik halaman, yang menyimpan pilihannya di tempat lain dari select
  // aslinya: menyetel nilainya membuat daftar di layar tidak ikut berubah,
  // sehingga petugas melihat satu hal dan yang tersimpan hal lain.
  const CALON_ALASAN = [
    { penunjuk: 'select[name="alasan_poligami"]', label: "Alasan Pengajuan Poligami" },
    { penunjuk: 'select[name="batal_kawin"]', label: "Alasan Pembatalan Kawin" },
    { penunjuk: 'select[name="alasan_kuasa_anak"]', label: "Alasan Pengajuan Penguasaan Anak" },
    { penunjuk: 'select[name="alasan_sah_anak"]', label: "Alasan Pengajuan Pengesahan Anak" },
    { penunjuk: 'select[name="alasan_asalusul"]', label: "Alasan Pengajuan Asal Usul Anak" },
    { penunjuk: 'select[name="alasan_isbat"]', label: "Alasan Pengajuan Isbat Nikah" },
    { penunjuk: 'select[name="alasan_dispen"]', label: "Alasan Pengajuan Dispensasi Kawin" },
    { penunjuk: 'select[name="bidang_ekonomi_syariah"]', label: "Bidang Ekonomi Syariah" },
    { penunjuk: 'select[name="akad_syariah_primer"]', label: "Jenis Akad Syariah" },
  ];

  // ────────────────────────────────────────────────────────────────────────
  // MEDAN YANG DIPETIK, BUKAN DIUSULKAN
  // ────────────────────────────────────────────────────────────────────────
  //
  // Perkara cerai menuntut empat isian bertanda bintang yang seluruhnya
  // tertulis apa adanya pada alinea pertama posita: tanggal menikah, tanggal
  // dan nomor kutipan akta nikah, serta KUA tempat menikah. Permohonan itsbat
  // menuntut tanggal dan tempat pernikahannya.
  //
  // Menyalinnya bukan penilaian melainkan ketelitian - dan ketelitian itulah
  // yang paling cepat luntur pada perkara kesepuluh di hari yang sama. Karena
  // itu tiap petikan diperlihatkan BESERTA kalimat asalnya dan dapat disunting
  // sebelum diisikan.
  //
  // KUA sengaja tidak ada di daftar ini. Medannya daftar yang dicari ke
  // peladen ketika petugas mengetik, dan pilihannya belum ada di halaman
  // sebelum ia mengetik - jadi tidak ada yang dapat diisikan tanpa menebak
  // kodenya. Namanya tetap diperlihatkan, supaya yang harus diketik sudah
  // terbaca tanpa menggulung ke positanya.
  const CALON_PETIKAN = [
    { penunjuk: 'input[name="tgl_nikah"]', label: "Tanggal Menikah", kunciPetik: "tglNikah", jenisMedan: "tanggal" },
    {
      penunjuk: 'input[name="tgl_kutipan_akta_nikah"]',
      label: "Tgl. Kutipan Akta Nikah",
      kunciPetik: "tglKutipanAktaNikah",
      jenisMedan: "tanggal",
    },
    {
      penunjuk: 'input[name="no_kutipan_akta_nikah"]',
      label: "No. Kutipan Akta Nikah",
      kunciPetik: "noKutipanAktaNikah",
      jenisMedan: "teks",
    },
    {
      penunjuk: 'input[name="tgl_menikah_isbat"]',
      label: "Tanggal Menikah (Isbat)",
      kunciPetik: "tglNikah",
      jenisMedan: "tanggal",
    },
    {
      penunjuk: 'input[name="tempat_menikah_isbat"]',
      label: "Tempat Menikah (Isbat)",
      kunciPetik: "tempatNikah",
      jenisMedan: "teks",
    },
  ];

  tombol.addEventListener("click", async () => {
    tombol.disabled = true;
    wadah.textContent = "";
    kabar.className = "aleta-abt-kabar";
    kabar.textContent = "Membaca posita…";

    // ────────────────────────────────────────────────────────────────────
    // BUKTI DIBACA DARI LAYAR, BUKAN DARI BASIS DATA
    // ────────────────────────────────────────────────────────────────────
    //
    // Yang dinilai haruslah yang sedang dilihat petugas. Ia mungkin baru
    // menempelkan positanya dan belum menekan Simpan; membacanya dari basis
    // data di saat itu memulangkan kekosongan, dan usulannya akan mengaku
    // "tidak ditemukan" atas kalimat yang jelas terpampang.
    const bacaPosita = await kirimKeJembatan({
      jenis: "nilai",
      penunjuk: "#posita",
      jenisMedan: "kaya",
    });
    const bacaPetitum = await kirimKeJembatan({
      jenis: "nilai",
      penunjuk: "#petitum",
      jenisMedan: "kaya",
    });
    let posita = (bacaPosita && bacaPosita.ok && bacaPosita.nilai) || "";
    const petitum = (bacaPetitum && bacaPetitum.ok && bacaPetitum.nilai) || "";
    let asalPosita = "posita di layar ini";

    // ────────────────────────────────────────────────────────────────────
    // POSITA KOSONG BUKAN JALAN BUNTU LAGI
    // ────────────────────────────────────────────────────────────────────
    //
    // Perkara e-Court yang baru didaftarkan kerap punya kolom posita yang
    // masih kosong di SIPP - isinya memang masih di berkas gugatannya, dan
    // mengetiknya ke SIPP justru salah satu pekerjaan yang hendak ditolong
    // menu ini. Sampai sekarang menu ini menyerah di situ: tidak ada teks,
    // tidak ada usulan, dan yang membacanya menyimpulkan ALETA tidak bisa
    // apa-apa pada perkara yang paling membutuhkannya.
    //
    // Cadangannya berkas gugatan yang SUDAH ada di arsip ALETA - bukan
    // berkas yang harus dicari petugas. Kalau arsipnya pun kosong, menu ini
    // menyerah seperti dahulu, dan itu jawaban yang jujur.
    //
    // Asalnya SELALU disebutkan. Usulan yang disusun dari berkas, lalu
    // dibaca seolah-olah disusun dari layar, membuat orang mencari kalimat
    // yang memang tidak ada di layarnya.
    if (!posita.trim()) {
      const arsip = dokumenGugatan(konteksTerakhir);
      if (arsip.length > 0) {
        kabar.textContent = "Posita kosong di SIPP - membaca berkas gugatan dari arsip ALETA…";
        try {
          const hasil = await bacaBerkasArsip(arsip[0].documentKey);
          const dari = hasil && hasil.ok === true && hasil.petikan ? hasil.petikan.posita : null;
          if (dari && dari.nilai) {
            posita = dari.nilai;
            asalPosita = `berkas ${hasil.nama} di arsip ALETA`;
          }
        } catch {
          /* arsipnya tidak terbaca - menu ini menyerah seperti dahulu */
        }
      }
    }

    kabar.textContent = "Memeriksa medan alasan yang tampak…";

    const medanTampak = [];
    for (const calon of CALON_ALASAN) {
      const jawabPilihan = await kirimKeJembatan({ jenis: "pilihan", penunjuk: calon.penunjuk });
      if (!jawabPilihan || !jawabPilihan.ok || !jawabPilihan.tampak) continue;
      const pilihan = (jawabPilihan.pilihan || []).map((x) => ({ nilai: x.nilai, label: x.label }));
      if (pilihan.length === 0) continue;
      medanTampak.push({
        kunci: calon.penunjuk,
        label: calon.label,
        pilihan,
        nilaiSekarang: jawabPilihan.nilaiSekarang || "",
      });
    }

    // Medan petikan ditanyakan dengan cara yang sama: yang menentukan ada dan
    // tampaknya adalah HALAMAN, bukan daftar jenis perkara di sini.
    const petikanTampak = [];
    for (const calon of CALON_PETIKAN) {
      const jawabNilai = await kirimKeJembatan({ jenis: "nilai", penunjuk: calon.penunjuk });
      if (!jawabNilai || !jawabNilai.ok || !jawabNilai.tampak) continue;
      petikanTampak.push({ ...calon, nilaiSekarang: jawabNilai.nilai || "" });
    }

    // Obyek Sengketa - satu-satunya kotak di layar ini yang isinya bukan dari
    // posita melainkan kebiasaan satker. Kebiasaannya baru diminta bila
    // kotaknya memang tampak.
    const bacaObyek = await kirimKeJembatan({ jenis: "nilai", penunjuk: 'textarea[name="obyek_gugatan"]' });
    const obyekTampak = Boolean(bacaObyek && bacaObyek.ok && bacaObyek.tampak);
    const obyekSekarang = (obyekTampak && bacaObyek.nilai) || "";

    if (medanTampak.length === 0 && petikanTampak.length === 0 && !obyekTampak) {
      kabar.className = "aleta-abt-kabar";
      kabar.textContent =
        "Layar ini tidak menampilkan satu pun medan yang dapat ALETA isikan untuk jenis perkara ini.";
      tombol.disabled = false;
      return;
    }

    let usulanMedan = [];
    let dataNikah = null;
    let dataObyek = null;
    try {
      const respons = await alatAmbil(
        ALETA_API_ALASAN_PERKARA,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            nomorPerkara: nomorPerkara || "",
            teks: { posita, petitum },
            // Dicatat di sisi server juga: usulan yang disusun dari berkas
            // dan usulan yang disusun dari layar tidak sama nilainya bila
            // kelak diukur ketepatannya.
            asalPosita,
            medan: medanTampak.map((x) => ({ kunci: x.kunci, label: x.label, pilihan: x.pilihan })),
            mintaObyek: obyekTampak,
          }),
        },
        "Menyusun usulan alasan"
      );
      if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Menyusun usulan alasan"));
      const luar = await respons.json();
      const jawab = luar && luar.data ? luar.data : luar;
      if (!jawab || !jawab.ada) {
        kabar.className = "aleta-abt-kabar";
        kabar.textContent = (jawab && jawab.sebab) || "Tidak ada usulan yang dapat disusun.";
        tombol.disabled = false;
        return;
      }
      usulanMedan = jawab.usulan || [];
      dataNikah = jawab.nikah || null;
      dataObyek = jawab.obyekSengketa || null;
      // Asal positanya disebutkan apa adanya. Usulan yang disusun dari berkas
      // gugatan, lalu dibaca seolah-olah disusun dari layar, membuat orang
      // mencari kalimat yang memang tidak ada di layarnya.
      kabar.textContent =
        `${petikanTampak.length} medan dapat dipetik dan ${medanTampak.length} medan alasan tampak, ` +
        `dibaca dari ${jawab.panjangTeks} huruf ${asalPosita} dan petitum.`;
    } catch (galat) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = String((galat && galat.message) || galat);
      tombol.disabled = false;
      return;
    }

    // ────────────────────────────────────────────────────────────────────
    // KARTU PETIKAN - NILAINYA DAPAT DISUNTING SEBELUM DIISIKAN
    // ────────────────────────────────────────────────────────────────────
    //
    // Yang diisikan adalah isi kotak saat Terapkan ditekan, BUKAN petikan
    // semula. Sebagian petugas menambahkan kata "Duplikat" di depan nomor akta
    // pengganti, dan sebagian kabupaten menuliskan kecamatan alih-alih desa -
    // keduanya satu suntingan kecil, dan tanpa kotak ini seluruh petikannya
    // menjadi tidak terpakai.
    const petikanTerap = [];
    for (const petik of petikanTampak) {
      const hasilPetik = (dataNikah && dataNikah[petik.kunciPetik]) || null;
      const kartu = buatElemen("div", "aleta-abt-kartu");

      const kepala = buatElemen("div", "aleta-abt-kartu-kepala");
      const centang = document.createElement("input");
      centang.type = "checkbox";
      centang.className = "aleta-abt-centang";
      centang.checked = Boolean(hasilPetik && hasilPetik.nilai);
      centang.disabled = !(hasilPetik && hasilPetik.nilai);
      kepala.appendChild(centang);
      kepala.appendChild(buatElemen("span", "aleta-abt-nama", petik.label));
      kepala.appendChild(
        buatElemen(
          "span",
          `aleta-tanda ${hasilPetik && hasilPetik.nilai ? "aleta-tanda-hijau" : "aleta-tanda-abu"}`,
          hasilPetik && hasilPetik.nilai ? "terbaca di posita" : "tidak terbaca"
        )
      );
      kartu.appendChild(kepala);

      const sanding = buatElemen("div", "aleta-abt-sanding");
      const kini = buatElemen("div", "aleta-abt-kini");
      kini.appendChild(buatElemen("span", "aleta-abt-label", "sekarang"));
      kini.appendChild(buatElemen("span", "aleta-abt-isi", petik.nilaiSekarang || "(masih kosong)"));
      sanding.appendChild(kini);
      kartu.appendChild(sanding);

      const kotakIsi = document.createElement("input");
      kotakIsi.type = "text";
      kotakIsi.className = "aleta-abt-sunting-kotak";
      kotakIsi.value = (hasilPetik && hasilPetik.nilai) || "";
      kotakIsi.setAttribute("aria-label", petik.label);
      kotakIsi.addEventListener("input", () => {
        centang.disabled = !kotakIsi.value.trim();
        if (centang.disabled) centang.checked = false;
      });
      kartu.appendChild(kotakIsi);

      if (hasilPetik && hasilPetik.kutipan) {
        const kutip = buatElemen("div", "aleta-abt-kutipan");
        kutip.appendChild(buatElemen("span", "aleta-abt-asal", "Posita"));
        kutip.appendChild(buatElemen("span", "aleta-abt-kalimat", hasilPetik.kutipan));
        kartu.appendChild(kutip);
      }

      wadah.appendChild(kartu);
      petikanTerap.push({
        kunci: petik.penunjuk,
        label: petik.label,
        jenisMedan: petik.jenisMedan,
        centang,
        nilai: () => kotakIsi.value.trim(),
      });
    }

    // KUA hanya diberitahukan. Medannya daftar yang dicari ke peladen, dan
    // mengisinya menuntut kode yang tidak ada di halaman - jadi yang berguna
    // adalah menyebutkan namanya, bukan berpura-pura dapat mengisinya.
    if (dataNikah && dataNikah.kua && dataNikah.kua.nilai) {
      const kabarKua = buatElemen(
        "div",
        "aleta-tetap-sebab",
        `KUA tempat menikah menurut posita: ${dataNikah.kua.nilai}. Ketik nama itu pada kotak ` +
          "KUA Tempat Menikah - daftarnya dicari SIPP sendiri, dan ALETA tidak dapat memilihkannya."
      );
      wadah.appendChild(kabarKua);
    }

    // ────────────────────────────────────────────────────────────────────
    // KARTU OBYEK SENGKETA - KEBIASAAN SATKER, BUKAN PEMBACAAN POSITA
    // ────────────────────────────────────────────────────────────────────
    //
    // Tidak ada satu pun kalimat posita yang menyebut "Pernikahan/Perceraian".
    // Yang menentukan isinya adalah apa yang selama ini ditulis satker untuk
    // jenis perkara yang sama, dan angka itu diperlihatkan apa adanya.
    // Dicentang sendiri hanya bila kebiasaannya nyaris bulat; selebihnya
    // ditawarkan, dengan pilihan lainnya disebut.
    if (obyekTampak) {
      const teratas = (dataObyek && dataObyek.usulan && dataObyek.usulan[0]) || null;
      const kartu = buatElemen("div", "aleta-abt-kartu");
      const kepala = buatElemen("div", "aleta-abt-kartu-kepala");
      const centang = document.createElement("input");
      centang.type = "checkbox";
      centang.className = "aleta-abt-centang";
      centang.checked = Boolean(teratas && teratas.nilai && dataObyek.yakin);
      centang.disabled = !(teratas && teratas.nilai);
      kepala.appendChild(centang);
      kepala.appendChild(buatElemen("span", "aleta-abt-nama", "Obyek Sengketa"));
      const nadaObyek = !teratas
        ? { kelas: "aleta-tanda-abu", teks: (dataObyek && dataObyek.sebab) || "belum ada riwayat" }
        : dataObyek.yakin
        ? { kelas: "aleta-tanda-hijau", teks: `kebiasaan satker: ${teratas.jumlah} dari ${dataObyek.total}` }
        : { kelas: "aleta-tanda-kuning", teks: `tidak bulat: ${teratas.jumlah} dari ${dataObyek.total}` };
      kepala.appendChild(buatElemen("span", `aleta-tanda ${nadaObyek.kelas}`, nadaObyek.teks));
      kartu.appendChild(kepala);

      const sandingObyek = buatElemen("div", "aleta-abt-sanding");
      const kiniObyek = buatElemen("div", "aleta-abt-kini");
      kiniObyek.appendChild(buatElemen("span", "aleta-abt-label", "sekarang"));
      kiniObyek.appendChild(buatElemen("span", "aleta-abt-isi", obyekSekarang || "(masih kosong)"));
      sandingObyek.appendChild(kiniObyek);
      kartu.appendChild(sandingObyek);

      const kotakObyek = document.createElement("input");
      kotakObyek.type = "text";
      kotakObyek.className = "aleta-abt-sunting-kotak";
      kotakObyek.value = (teratas && teratas.nilai) || "";
      kotakObyek.setAttribute("aria-label", "Obyek Sengketa");
      kotakObyek.addEventListener("input", () => {
        centang.disabled = !kotakObyek.value.trim();
        if (centang.disabled) centang.checked = false;
      });
      kartu.appendChild(kotakObyek);

      const lainnya = ((dataObyek && dataObyek.usulan) || []).slice(1).filter((x) => x && x.nilai);
      if (lainnya.length > 0) {
        kartu.appendChild(
          buatElemen(
            "div",
            "aleta-abt-catatan",
            `Pernah ditulis juga untuk ${(dataObyek && dataObyek.jenisPerkara) || "jenis perkara ini"}: ` +
              lainnya.map((x) => `${x.nilai} (${x.jumlah})`).join("; ")
          )
        );
      }

      wadah.appendChild(kartu);
      petikanTerap.push({
        kunci: 'textarea[name="obyek_gugatan"]',
        label: "Obyek Sengketa",
        jenisMedan: "teks",
        centang,
        nilai: () => kotakObyek.value.trim(),
      });
    }

    const pilihanTerap = [];
    for (const medan of medanTampak) {
      const usul = usulanMedan.find((x) => x.kunci === medan.kunci) || null;
      const sekarang =
        (medan.pilihan.find((x) => String(x.nilai) === String(medan.nilaiSekarang)) || {}).label || "";
      const kartu = buatElemen("div", "aleta-abt-kartu");

      const kepala = buatElemen("div", "aleta-abt-kartu-kepala");
      const centang = document.createElement("input");
      centang.type = "checkbox";
      centang.className = "aleta-abt-centang";
      // Yang berselisih TIDAK dicentang sendiri: justru itu yang paling perlu
      // dibaca manusia.
      centang.checked = Boolean(usul && usul.nilai) && usul.keyakinan !== "bentrok";
      centang.disabled = !(usul && usul.nilai);
      kepala.appendChild(centang);
      kepala.appendChild(buatElemen("span", "aleta-abt-nama", medan.label));
      const nada =
        !usul || !usul.nilai
          ? { kelas: "aleta-tanda-abu", teks: "tidak ditemukan" }
          : usul.keyakinan === "bentrok"
          ? { kelas: "aleta-tanda-merah", teks: "posita menyebut lebih dari satu" }
          : usul.keyakinan === "pasti"
          ? { kelas: "aleta-tanda-hijau", teks: "disebut posita" }
          : { kelas: "aleta-tanda-kuning", teks: "mendekati" };
      kepala.appendChild(buatElemen("span", `aleta-tanda ${nada.kelas}`, nada.teks));
      kartu.appendChild(kepala);

      const sanding = buatElemen("div", "aleta-abt-sanding");
      const kini = buatElemen("div", "aleta-abt-kini");
      kini.appendChild(buatElemen("span", "aleta-abt-label", "sekarang"));
      kini.appendChild(buatElemen("span", "aleta-abt-isi", sekarang || "(belum dipilih)"));
      sanding.appendChild(kini);
      if (usul && usul.nilai) {
        const usulBaris = buatElemen("div", "aleta-abt-usul");
        usulBaris.appendChild(buatElemen("span", "aleta-abt-label", "usulan"));
        usulBaris.appendChild(buatElemen("span", "aleta-abt-isi", usul.nilaiLabel));
        sanding.appendChild(usulBaris);
      }
      kartu.appendChild(sanding);

      if (usul && usul.kutipan) {
        const kutip = buatElemen("div", "aleta-abt-kutipan");
        kutip.appendChild(buatElemen("span", "aleta-abt-asal", "Posita"));
        kutip.appendChild(buatElemen("span", "aleta-abt-kalimat", usul.kutipan));
        kartu.appendChild(kutip);
      }
      if (usul && usul.alasan) kartu.appendChild(buatElemen("div", "aleta-abt-catatan", usul.alasan));

      wadah.appendChild(kartu);
      if (usul && usul.nilai) {
        pilihanTerap.push({ kunci: medan.kunci, nilai: usul.nilai, label: medan.label, centang });
      }
    }

    const terapAlasan = buatElemen("button", "aleta-permintaan-tombol", "Isikan yang dicentang");
    terapAlasan.type = "button";
    const hasilAlasan = buatElemen("div", "aleta-abt-kabar");
    wadah.appendChild(terapAlasan);
    wadah.appendChild(hasilAlasan);

    terapAlasan.addEventListener("click", async () => {
      const dipilih = pilihanTerap.filter((x) => x.centang.checked);
      // Isi kotak dibaca SEKARANG, bukan petikan semula: tanpa itu suntingan
      // petugas hilang tanpa satu pun tanda, dan yang masuk borang justru yang
      // sudah ia perbaiki.
      const dipetik = petikanTerap.filter((x) => x.centang.checked && x.nilai());
      if (dipilih.length === 0 && dipetik.length === 0) {
        hasilAlasan.textContent = "Tidak ada yang dicentang.";
        return;
      }
      terapAlasan.disabled = true;
      const gagal = [];
      let berhasil = 0;

      for (const satu of dipilih) {
        hasilAlasan.textContent = `Memilih ${satu.label}…`;
        const hasil = await kirimKeJembatan({
          jenis: "isi",
          penunjuk: satu.kunci,
          jenisMedan: "pilih",
          nilai: satu.nilai,
        });
        if (hasil && hasil.ok) berhasil += 1;
        else gagal.push(`${satu.label}: ${(hasil && hasil.alasan) || "tidak terisi"}`);
      }

      for (const satu of dipetik) {
        hasilAlasan.textContent = `Mengisi ${satu.label}…`;
        // "tanggal" - jembatan yang juga menyentuh datepicker jQuery UI.
        // Menyetel value saja membuat tampilannya berubah sementara tanggal
        // yang dipegang datepicker tetap yang lama.
        const hasil = await kirimKeJembatan({
          jenis: "isi",
          penunjuk: satu.kunci,
          jenisMedan: satu.jenisMedan,
          nilai: satu.nilai(),
        });
        if (hasil && hasil.ok) berhasil += 1;
        else gagal.push(`${satu.label}: ${(hasil && hasil.alasan) || "tidak terisi"}`);
      }

      terapAlasan.disabled = false;
      hasilAlasan.className = gagal.length ? "aleta-abt-kabar aleta-abt-gagal" : "aleta-abt-kabar";
      hasilAlasan.textContent = gagal.length
        ? `${berhasil} terisi, ${gagal.length} gagal: ${gagal.join("; ")}`
        : `${berhasil} alasan terisi. Periksa seluruhnya, lalu tekan Simpan sendiri.`;
    });

    tombol.disabled = false;
  });

  return kotak;
}

/**
 * Berkas-berkas dari SATU pemilih menjadi calon putusan dan calon
 * anonimisasi untuk perkara halaman ini.
 *
 * Yang ditolak disebut sebabnya dan tidak dikirim: bentuk selain
 * RTF/DOC/DOCX/PDF, berkas yang namanya menyebut perkara LAIN, dan berkas yang
 * namanya menyebut BAS, PHS/PMH/PPP/PJS, relaas, sampul, akta, atau petitum.
 * Lebih dari satu calon untuk satu slot tidak diputuskan di sini - petugas
 * yang memilih.
 *
 * @returns {{putusan: object[], anonimisasi: object[], ditolak: object[]}}
 */
function pasangkanBerkasUnggah(daftar, nomorHalaman) {
  // Bentuk yang memang tidak dapat dipakai - gambar hasil pindai, misalnya -
  // tetap ditolak di sini, supaya tidak menunggu unggahan yang pasti ditolak.
  const BENTUK_DITERIMA = /\.(rtf|doc|docx|pdf)$/i;
  const hasil = { putusan: [], anonimisasi: [], ditolak: [] };
  const halaman = String(nomorHalaman || "").trim().toLowerCase();
  for (const berkas of Array.from(daftar || [])) {
    const nama = String((berkas && berkas.name) || "");
    const nomor = nomorDariNamaBerkas(nama);
    let sebab = "";
    if (!BENTUK_DITERIMA.test(nama)) sebab = "bukan naskah putusan yang dapat diunggah - yang diterima RTF, DOC, DOCX, atau PDF";
    else if (nomor && halaman && nomor.toLowerCase() !== halaman) sebab = `berkas perkara lain (${nomor})`;
    else sebab = tandaBukanNaskahPutusan(nama);
    if (sebab) hasil.ditolak.push({ berkas, nama, nomor, sebab });
    else (namaBerkasAnonim(nama) ? hasil.anonimisasi : hasil.putusan).push({ berkas, nama, nomor });
  }
  return hasil;
}
/* === AKHIR 12OKT-I === */

/**
 * ============================================================================
 * PUTUSAN LEBIH DAHULU, ANONIMISASI LANGSUNG SESUDAHNYA
 * ============================================================================
 *
 * Dua permintaan BERURUTAN, satu berkas per permintaan. Anonimisasi dikirim
 * begitu jawaban atas putusannya tiba - tanpa jeda di antaranya. Yang
 * diperlukan urutannya, bukan waktunya:
 *   - anonimisasi tanpa putusannya tidak berarti apa-apa. Bila putusannya
 *     GAGAL, anonimisasinya TIDAK dikirim, dan petugas memilihnya ulang
 *     sesudah putusannya masuk;
 *   - satu berkas per permintaan membuat batas 150 detik (K6) berlaku untuk
 *     satu konversi, dan tiap berkas dilaporkan sendiri.
 *
 * @param {{nomorPerkara: string, putusan?: File|null, anonimisasi?: File|null}} pasangan
 * @param {{kirim: Function, laporkan: Function, kabar: HTMLElement}} alat
 * @returns {Promise<{adaYangMasuk: boolean, gagal: string}>}
 */
async function unggahBerpasangan(pasangan, alat) {
  const { kirim, laporkan, kabar } = alat;
  const hasil = { adaYangMasuk: false, gagal: "" };

  // Satu kiriman. Jawaban yang menolak, dan jawaban yang tidak memasukkan satu
  // berkas pun, sama-sama gagal - beserta sebab yang dapat dibaca petugas.
  const kirimSatu = async (jenis, berkas) => {
    let jawab = null;
    let gagal = "";
    try {
      jawab = await kirim(jenis, berkas);
    } catch (galat) {
      gagal = String((galat && galat.message) || galat);
    }
    const masuk = Boolean(jawab && jawab.ok && laporkan(jawab));
    if (!gagal && (!jawab || !jawab.ok)) {
      gagal = (jawab && (jawab.sebab || jawab.pesan || jawab.alasan)) || "Unggahannya tidak dapat dikerjakan.";
    }
    if (!gagal && !masuk) {
      gagal = (jawab.berkas || []).map((b) => pesanGagalUnggah(b)).join("; ") || "berkasnya tidak masuk.";
    }
    return { jawab, masuk, gagal };
  };
  const bunyiAntrean = (jawab) => (jawab && jawab.antrean ? ", dan perkara ini masuk antrean Direktori Putusan" : "");

  let bunyi = "";
  if (pasangan.putusan) {
    kabar.className = "aleta-abt-kabar";
    kabar.textContent = "Mengunggah putusan akhir…";
    const putusan = await kirimSatu("putusan", pasangan.putusan);
    hasil.adaYangMasuk = putusan.masuk;
    if (putusan.gagal) {
      hasil.gagal = putusan.gagal;
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent =
        `Putusan akhir: ${putusan.gagal}` +
        (pasangan.anonimisasi ? " Anonimisasi TIDAK dikirim - pilih ulang sesudah putusannya masuk." : "");
      return hasil;
    }
    bunyi = `Putusan akhir terunggah${bunyiAntrean(putusan.jawab)}.`;
    kabar.textContent = bunyi;
  }
  if (!pasangan.anonimisasi) return hasil;

  kabar.textContent = `${bunyi} Mengunggah anonimisasi…`.trim();
  const anonim = await kirimSatu("anonimisasi", pasangan.anonimisasi);
  hasil.adaYangMasuk = anonim.masuk || hasil.adaYangMasuk;
  if (anonim.gagal) {
    hasil.gagal = anonim.gagal;
    kabar.className = "aleta-abt-kabar aleta-abt-gagal";
    kabar.textContent = `${bunyi} Anonimisasi: ${anonim.gagal}`.trim();
    return hasil;
  }
  kabar.textContent = `${bunyi} Anonimisasi terunggah${bunyi ? "" : bunyiAntrean(anonim.jawab)}.`.trim();
  return hasil;
}

function bagianUnggahPutusanSipp(nomorPerkara) {
  // Tampilan Baru & UI Baru: edoc putusan dan edoc anonimisasi di tempat
  // masing-masing, dikirim sekaligus (bagianUnggahEdocTerpisah). Lama: di bawah ini.
  if (typeof bagianUnggahEdocTerpisah === "function" && unggahEdocTerpisahBerlaku() && !unggahEdocPakaiCaraLama) {
    return bagianUnggahEdocTerpisah(nomorPerkara);
  }
  const kotak = bagian("Unggah putusan ke SIPP", "unggahPutusanSipp", true);
  const isi = kotak.isi;

  isi.appendChild(
    buatElemen(
      "div",
      "aleta-tetap-sebab aleta-remeh",
      "Putusan akhir dan anonimisasinya diunggah sekaligus dari SATU pemilih - dipasangkan menurut " +
        "nomor perkara dan nama berkasnya. Putusan dikirim lebih dahulu; anonimisasi langsung menyusul " +
        "sesudah putusannya masuk, dan tidak dikirim bila putusannya gagal. RTF, DOC, DOCX, atau PDF; " +
        "yang bukan PDF diubah ALETA menjadi PDF untuk Direktori Putusan, dan naskah aslinya tetap " +
        "tersimpan sebagai e-Doc."
    )
  );

  // SATU pemilih untuk keduanya. Keempat bentuk yang sungguh dipakai satker
  // (perkara_putusan.amar_putusan_dok, 9.903 nilai): .rtf 87,7%, .docx 458,
  // .doc 442, .pdf 3,2% - menyaring ke PDF saja menyembunyikan hampir semuanya.
  const pemilih = document.createElement("input");
  pemilih.type = "file";
  pemilih.multiple = true;
  pemilih.accept = ".rtf,.doc,.docx,.pdf";
  pemilih.className = "aleta-berkas";
  isi.appendChild(pemilih);

  const daftarPasangan = buatElemen("div", "aleta-massal-daftar");
  const tombol = buatElemen("button", "aleta-permintaan-tombol", "Unggah ke SIPP");
  tombol.type = "button";
  tombol.disabled = true;
  const kabar = buatElemen("div", "aleta-abt-kabar");
  for (const el of [daftarPasangan, tombol, kabar]) isi.appendChild(el);

  // Satu berkas, satu permintaan. Akun SIPP yang sedang membuka halaman ini
  // yang tercatat di SIPP - bukan akun ALETA.
  const kirim = (jenis, berkas) => {
    const badan = new FormData();
    badan.append("perkaraId", perkaraIdDariHalaman());
    badan.append("nomorPerkara", nomorPerkara || "");
    badan.append("olehUsername", namaPenggunaSipp() || "");
    badan.append(jenis, berkas);
    return kirimBadanUnggahSipp(badan);
  };

  // Tiap berkas dilaporkan sendiri. Satu yang gagal di antara dua bukan
  // "gagal" - yang satunya sudah benar-benar tertulis ke SIPP.
  const laporkan = (jawab) => {
    const rinci = buatElemen("div", "aleta-unggah-rinci");
    for (const b of jawab.berkas || []) {
      const baris = buatElemen("div", "aleta-unggah-baris");
      baris.appendChild(
        buatElemen("span", "aleta-unggah-judul", b.jenis === "anonimisasi" ? "Anonimisasi" : "Putusan akhir")
      );
      baris.appendChild(
        buatElemen("span", b.ok ? "aleta-unggah-jumlah" : "aleta-unggah-kosong", b.ok ? b.jalur : pesanGagalUnggah(b))
      );
      rinci.appendChild(baris);
    }
    for (const peringatan of [].concat(jawab.peringatan || [])) {
      rinci.appendChild(buatElemen("div", "aleta-unggah-kosong", String(peringatan)));
    }
    isi.appendChild(rinci);
    const adaYangMasuk = (jawab.berkas || []).some((b) => b.ok);
    return adaYangMasuk;
  };

  // Halaman perkara dibuka kembali HANYA bila ada yang sungguh masuk, dan
  // sesudah kedua kiriman tuntas - memuat ulang di tengahnya memutus kiriman
  // anonimisasi. Lewat alamat masuk perkara: memuat ulang apa adanya mendarat
  // di dasbor.
  const bukaKembali = () => {
    kabar.textContent += " Halaman perkara dibuka kembali…";
    setTimeout(muatUlangHalamanPerkara, 1500);
  };

  let pasangan = { putusan: [], anonimisasi: [], ditolak: [] };
  const terpilih = { putusan: null, anonimisasi: null };

  const gambarPasangan = () => {
    daftarPasangan.textContent = "";
    for (const [slot, judul] of [
      ["putusan", "Putusan akhir"],
      ["anonimisasi", "Anonimisasi"],
    ]) {
      const calon = pasangan[slot];
      const baris = buatElemen("div", "aleta-massal-baris");
      baris.appendChild(buatElemen("span", "aleta-massal-nomor", judul));
      if (calon.length <= 1) {
        const teks = calon.length === 0
          ? "tidak dipilih"
          : `${calon[0].nama}${calon[0].nomor ? "" : " - nomor perkara tidak terbaca dari namanya"}`;
        const tanda = buatElemen("span", "aleta-massal-keadaan", teks);
        if (calon.length === 1) tanda.classList.add("aleta-lencana-aman");
        baris.appendChild(tanda);
      } else {
        // Lebih dari satu berkas untuk slot yang sama: petugas yang memilih,
        // bukan "yang terakhir menang".
        const pilih = document.createElement("select");
        pilih.className = "aleta-massal-pilih-berkas";
        const kosong = document.createElement("option");
        kosong.value = "";
        kosong.textContent = `${calon.length} berkas - pilih satu`;
        pilih.appendChild(kosong);
        calon.forEach((c, i) => {
          const opsi = document.createElement("option");
          opsi.value = String(i);
          opsi.textContent = c.nama;
          pilih.appendChild(opsi);
        });
        pilih.value = terpilih[slot] ? String(calon.indexOf(terpilih[slot])) : "";
        pilih.addEventListener("change", () => {
          terpilih[slot] = pilih.value === "" ? null : calon[Number(pilih.value)];
          tombol.disabled = !terpilih.putusan && !terpilih.anonimisasi;
        });
        baris.appendChild(pilih);
      }
      daftarPasangan.appendChild(baris);
    }
    for (const t of pasangan.ditolak) {
      const baris = buatElemen("div", "aleta-massal-baris");
      baris.appendChild(buatElemen("span", "aleta-massal-nomor", t.nama));
      baris.appendChild(buatElemen("span", "aleta-massal-keadaan aleta-lencana-mendesak", `${t.sebab} - tidak dikirim`));
      daftarPasangan.appendChild(baris);
    }
    tombol.disabled = !terpilih.putusan && !terpilih.anonimisasi;
  };

  pemilih.addEventListener("change", () => {
    pasangan = pasangkanBerkasUnggah(Array.from(pemilih.files || []), nomorPerkara);
    terpilih.putusan = pasangan.putusan.length === 1 ? pasangan.putusan[0] : null;
    terpilih.anonimisasi = pasangan.anonimisasi.length === 1 ? pasangan.anonimisasi[0] : null;
    kabar.className = "aleta-abt-kabar";
    kabar.textContent = "";
    gambarPasangan();
  });

  tombol.addEventListener("click", async () => {
    if (!terpilih.putusan && !terpilih.anonimisasi) {
      kabar.className = "aleta-abt-kabar";
      kabar.textContent = "Belum ada berkas yang dipilih.";
      return;
    }
    tombol.disabled = true;
    pemilih.disabled = true;
    let hasil = { adaYangMasuk: false, gagal: "" };
    try {
      hasil = await unggahBerpasangan(
        {
          nomorPerkara: nomorPerkara || "",
          putusan: terpilih.putusan ? terpilih.putusan.berkas : null,
          anonimisasi: terpilih.anonimisasi ? terpilih.anonimisasi.berkas : null,
        },
        { kirim, laporkan, kabar }
      );
    } catch (galat) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = String((galat && galat.message) || galat);
    } finally {
      tombol.disabled = false;
      pemilih.disabled = false;
    }
    // Pesan kegagalan dibiarkan terbaca: memuat ulang halaman akan menghapus
    // satu-satunya keterangan kenapa ia gagal.
    if (hasil.adaYangMasuk && !hasil.gagal) bukaKembali();
  });

  if (typeof pasangGantiUnggahEdoc === "function") pasangGantiUnggahEdoc(kotak, nomorPerkara);
  return kotak;
}

/**
 * ============================================================================
 * EDOC PUTUSAN DAN EDOC ANONIMISASI - DUA TEMPAT, SATU KIRIMAN (Baru & UI Baru)
 * ============================================================================
 *
 * Diminta pengguna 30 September 2026: "buatkan upload edoc putusan dan upload
 * edoc anonimisasi secara terpisah (jadi ada tempat tiap upload) sekaligus",
 * dan "buat hanya di ekstensi baru dan ui baru".
 *
 * Cara lama (tetap berlaku dalam tampilan Lama) memakai SATU pemilih dan
 * menebak slot dari NAMA berkas: berkas anonimisasi yang namanya tidak memuat
 * "anonim" terbaca sebagai putusan kedua, dan slot anonimisasinya kosong.
 * Di sini tiap slot punya pemilihnya sendiri - petugas yang menentukan mana
 * putusan dan mana anonimisasi, bukan nama berkasnya.
 *
 * Keduanya dikirim SEKALIGUS dalam satu kiriman ke rute unggah-sipp, yang
 * memang menerima kedua slot bersama (jalur yang sama dipakai putusan massal
 * ABT). Batas waktunya dua kali batas satu berkas, sebab dua naskah diubah
 * menjadi PDF dalam satu kiriman. Boleh salah satu saja.
 *
 * Penjagaan yang sama dengan cara lama: bentuk selain RTF/DOC/DOCX/PDF, berkas
 * yang namanya menyebut perkara LAIN, dan berkas yang namanya menyebut BAS,
 * penetapan, relaas, dan seterusnya tidak dikirim. Berkas yang sama di kedua
 * tempat ditolak. Cara lama tetap dapat dipilih dari tautan di bawahnya.
 */
let unggahEdocPakaiCaraLama = false;

function unggahEdocTerpisahBerlaku() {
  return typeof alatUjiMode === "function" && alatUjiMode() !== "lama";
}

function bagianUnggahEdocTerpisah(nomorPerkara) {
  const kotak = bagian("Unggah putusan ke SIPP", "unggahPutusanSipp", true);
  const isi = kotak.isi;
  isi.appendChild(
    buatElemen(
      "div",
      "aleta-tetap-sebab aleta-remeh",
      "Edoc putusan dan edoc anonimisasi punya tempat masing-masing dan dikirim SEKALIGUS ke SIPP. " +
        "Boleh salah satu saja. RTF, DOC, DOCX, atau PDF; yang bukan PDF diubah ALETA menjadi PDF " +
        "untuk Direktori Putusan, dan naskah aslinya tetap tersimpan sebagai e-Doc."
    )
  );

  const slot = {};
  const halaman = String(nomorPerkara || "").trim().toLowerCase();
  const tombol = buatElemen("button", "aleta-permintaan-tombol", "Unggah edoc ke SIPP");
  tombol.type = "button";
  tombol.disabled = true;
  const kabar = buatElemen("div", "aleta-abt-kabar");

  const berkasSama = () => {
    const a = slot.putusan && slot.putusan.berkas;
    const b = slot.anonimisasi && slot.anonimisasi.berkas;
    return Boolean(a && b && a.name === b.name && a.size === b.size);
  };

  const periksaSlot = (kunci) => {
    const s = slot[kunci];
    const f = s.pemilih.files && s.pemilih.files[0];
    s.berkas = null;
    s.tanda.className = "aleta-edoc-tanda aleta-massal-keadaan";
    if (!f) {
      s.tanda.textContent = "belum dipilih";
    } else {
      const nama = String(f.name || "");
      const nomor = nomorDariNamaBerkas(nama);
      let sebab = "";
      if (!/\.(rtf|doc|docx|pdf)$/i.test(nama)) sebab = "bukan naskah putusan yang dapat diunggah - yang diterima RTF, DOC, DOCX, atau PDF";
      else if (nomor && halaman && nomor.toLowerCase() !== halaman) sebab = `berkas perkara lain (${nomor})`;
      else sebab = tandaBukanNaskahPutusan(nama);
      if (sebab) {
        s.tanda.textContent = `${nama}: ${sebab} - tidak dikirim`;
        s.tanda.classList.add("aleta-lencana-mendesak");
      } else {
        s.berkas = f;
        // Nama hanya menjadi PERINGATAN di sini, bukan penentu slot.
        const curiga = kunci === "putusan" && namaBerkasAnonim(nama) ? " - namanya seperti anonimisasi; pastikan ini putusan" : "";
        s.tanda.textContent = `${nama}${nomor ? "" : " - nomor perkara tidak terbaca dari namanya"}${curiga}`;
        s.tanda.classList.add(curiga ? "aleta-lencana-mendesak" : "aleta-lencana-aman");
      }
    }
    const sama = berkasSama();
    if (sama) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = "Berkas yang sama dipilih di kedua tempat - pilih anonimisasinya sendiri.";
    } else if (kabar.classList.contains("aleta-abt-gagal") && !tombol.dataset.sibuk) {
      kabar.className = "aleta-abt-kabar";
      kabar.textContent = "";
    }
    tombol.disabled = sama || !((slot.putusan && slot.putusan.berkas) || (slot.anonimisasi && slot.anonimisasi.berkas));
  };

  for (const [kunci, judul] of [
    ["putusan", "Edoc putusan"],
    ["anonimisasi", "Edoc anonimisasi"],
  ]) {
    const baris = buatElemen("div", "aleta-edoc-slot");
    baris.setAttribute("data-slot", kunci);
    baris.appendChild(buatElemen("span", "aleta-edoc-judul", judul));
    const pemilih = document.createElement("input");
    pemilih.type = "file";
    pemilih.accept = ".rtf,.doc,.docx,.pdf";
    pemilih.className = "aleta-berkas";
    pemilih.setAttribute("aria-label", judul);
    pemilih.setAttribute("data-slot", kunci);
    baris.appendChild(pemilih);
    const tanda = buatElemen("span", "aleta-edoc-tanda aleta-massal-keadaan", "belum dipilih");
    baris.appendChild(tanda);
    isi.appendChild(baris);
    slot[kunci] = { pemilih, tanda, berkas: null };
    pemilih.addEventListener("change", () => {
      periksaSlot(kunci);
      if (anonOtomatis) anonOtomatis.setel(slot.putusan && slot.putusan.berkas, slot.anonimisasi && slot.anonimisasi.berkas);
    });
  }
  // Butir 11 (perbaikan 30 Sep): hanya edoc putusan yang dipilih -> ALETA
  // membuat anonimisasinya dalam BENTUK YANG SAMA (K1 ke RTF bila perlu ->
  // anonim ABT -> K1 ke bentuk asal -> pemeriksa anonim) lalu mengunggah
  // KEDUA slot sekaligus. Dapat dilepas centangnya: putusan saja.
  const anonOtomatis = typeof a30BarisAnonimOtomatis === "function" ? a30BarisAnonimOtomatis() : null;
  if (anonOtomatis) isi.appendChild(anonOtomatis.baris);
  isi.appendChild(tombol);
  isi.appendChild(kabar);

  const laporkan = (jawab) => {
    const rinci = buatElemen("div", "aleta-unggah-rinci");
    for (const b of jawab.berkas || []) {
      const baris = buatElemen("div", "aleta-unggah-baris");
      baris.appendChild(buatElemen("span", "aleta-unggah-judul", b.jenis === "anonimisasi" ? "Edoc anonimisasi" : "Edoc putusan"));
      baris.appendChild(buatElemen("span", b.ok ? "aleta-unggah-jumlah" : "aleta-unggah-kosong", b.ok ? b.jalur : pesanGagalUnggah(b)));
      rinci.appendChild(baris);
    }
    for (const peringatan of [].concat(jawab.peringatan || [])) {
      rinci.appendChild(buatElemen("div", "aleta-unggah-kosong", String(peringatan)));
    }
    isi.appendChild(rinci);
    const semua = jawab.berkas || [];
    return { adaYangMasuk: semua.some((b) => b.ok), semuaMasuk: semua.length > 0 && semua.every((b) => b.ok) };
  };

  tombol.addEventListener("click", async () => {
    const putusan = slot.putusan.berkas;
    let anonimisasi = slot.anonimisasi.berkas;
    let tetapUnggah = null; // 12OKT-I: nama yang direlakan petugas di dialog pemeriksa
    if ((!putusan && !anonimisasi) || berkasSama()) return;
    tombol.disabled = true;
    tombol.dataset.sibuk = "ya";
    slot.putusan.pemilih.disabled = true;
    slot.anonimisasi.pemilih.disabled = true;
    if (putusan && !anonimisasi && anonOtomatis && anonOtomatis.dipakai()) {
      // Tidak ada yang dikirim ke SIPP sebelum anonimisasinya jadi DAN lolos
      // pemeriksa (atau dikonfirmasi petugas) - dua slot sekaligus, atau tidak sama sekali.
      const buat = await a30SiapkanAnonimisasi({ berkas: putusan, nomorPerkara, kabar, wadahTanya: isi });
      if (!buat.ok) {
        kabar.className = "aleta-abt-kabar aleta-abt-gagal";
        kabar.textContent = buat.pesan;
        delete tombol.dataset.sibuk;
        slot.putusan.pemilih.disabled = false;
        slot.anonimisasi.pemilih.disabled = false;
        tombol.disabled = false;
        return;
      }
      anonimisasi = buat.berkas;
      tetapUnggah = buat.tetapUnggah || null;
    }
    const badan = new FormData();
    badan.append("perkaraId", perkaraIdDariHalaman());
    badan.append("nomorPerkara", nomorPerkara || "");
    badan.append("olehUsername", namaPenggunaSipp() || "");
    if (putusan) badan.append("putusan", putusan);
    if (anonimisasi) badan.append("anonimisasi", anonimisasi);
    kabar.className = "aleta-abt-kabar";
    kabar.textContent =
      putusan && anonimisasi
        ? "Mengunggah edoc putusan dan edoc anonimisasi sekaligus…"
        : putusan
          ? "Mengunggah edoc putusan…"
          : "Mengunggah edoc anonimisasi…";
    let hasil = { adaYangMasuk: false, semuaMasuk: false };
    try {
      // 12OKT-I: penolakan "masih memuat nama" yang membolehkan ditawari "Tetap unggah".
      const batas = putusan && anonimisasi ? BATAS_UNGGAH_SIPP_MS * 2 : BATAS_UNGGAH_SIPP_MS;
      const jawab =
        typeof kirimUnggahSippTetap === "function"
          ? await kirimUnggahSippTetap(badan, batas, { tetapUnggah, wadah: isi, kabar })
          : await kirimBadanUnggahSipp(badan, batas);
      if (!jawab.ok) throw new Error(jawab.sebab || jawab.pesan || jawab.alasan || "Unggahannya tidak dapat dikerjakan.");
      hasil = laporkan(jawab);
      if (hasil.semuaMasuk) {
        kabar.textContent = `${putusan && anonimisasi ? "Edoc putusan dan edoc anonimisasi" : putusan ? "Edoc putusan" : "Edoc anonimisasi"} terunggah${jawab.antrean ? ", dan perkara ini masuk antrean Direktori Putusan" : ""}.`;
      } else {
        kabar.className = "aleta-abt-kabar aleta-abt-gagal";
        kabar.textContent = hasil.adaYangMasuk
          ? "Sebagian terunggah - lihat rinciannya di bawah; pilih ulang yang gagal."
          : "Tidak ada yang masuk - lihat sebabnya di bawah.";
      }
    } catch (galat) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = String((galat && galat.message) || galat);
    } finally {
      delete tombol.dataset.sibuk;
      slot.putusan.pemilih.disabled = false;
      slot.anonimisasi.pemilih.disabled = false;
      tombol.disabled = !(slot.putusan.berkas || slot.anonimisasi.berkas);
    }
    // Sama dengan cara lama: halaman perkara dibuka kembali hanya bila SEMUA
    // yang dikirim masuk - pesan kegagalan dibiarkan terbaca.
    if (hasil.semuaMasuk) {
      kabar.textContent += " Halaman perkara dibuka kembali…";
      setTimeout(muatUlangHalamanPerkara, 1500);
    }
  });

  const lama = buatElemen("button", "aleta-edoc-cara-lama", "Pakai cara lama: satu pemilih untuk keduanya");
  lama.type = "button";
  lama.title = "Satu pemilih; putusan dan anonimisasi dipasangkan menurut nama berkasnya (berlaku sampai halaman dimuat ulang)";
  lama.addEventListener("click", () => {
    if (tombol.dataset.sibuk) return;
    unggahEdocPakaiCaraLama = true;
    kotak.replaceWith(bagianUnggahPutusanSipp(nomorPerkara));
  });
  isi.appendChild(lama);

  pasangGantiUnggahEdoc(kotak, nomorPerkara);
  return kotak;
}

/** Pengalih Lama / Baru / UI Baru berganti: bagian unggah disusun ulang dalam bentuk yang berlaku. */
function pasangGantiUnggahEdoc(kotak, nomorPerkara) {
  const bentuk = unggahEdocTerpisahBerlaku() && !unggahEdocPakaiCaraLama;
  const dengar = () => {
    if (!kotak.isConnected) {
      document.removeEventListener("aleta-uji-berubah", dengar);
      return;
    }
    if ((unggahEdocTerpisahBerlaku() && !unggahEdocPakaiCaraLama) === bentuk) return;
    // Unggahan yang sedang berjalan tidak diputus.
    if (kotak.querySelector("[data-sibuk]")) return;
    document.removeEventListener("aleta-uji-berubah", dengar);
    kotak.replaceWith(bagianUnggahPutusanSipp(nomorPerkara));
  };
  document.addEventListener("aleta-uji-berubah", dengar);
}

/** Kunci perkara bersama penetapan (putusan-edoc-sekaligus.js). Tanpa modul: tanpa kunci. */
async function b2AmbilKunci(nomorPerkara) {
  const mod = globalThis.aletaPutusanEdoc;
  if (!mod || typeof mod.ambilKunci !== "function") return { ok: true, lepas: async () => undefined };
  return mod.ambilKunci(nomorPerkara);
}

/** Dua tempat tetap di bawah kabar hasil: laporan/kotak muat ulang, dan tombol ulang (jadwalkan mengosongkan tempat pertama). */
function b2SiapkanTempat(kabar) {
  const induk = kabar && kabar.parentNode;
  const ambil = (tanda) => {
    let e = induk ? induk.querySelector(`[data-b2-tempat="${tanda}"]`) : null;
    if (!e) {
      e = buatElemen("div", `aleta-b2-tempat aleta-b2-${tanda}`);
      e.setAttribute("data-b2-tempat", tanda);
      if (induk) induk.insertBefore(e, kabar.nextSibling);
    }
    return e;
  };
  const ulang = ambil("ulang");
  const laporan = ambil("laporan");
  // urutan di layar: kabar, laporan, tombol ulang
  if (induk && laporan.nextSibling !== ulang) induk.insertBefore(ulang, laporan.nextSibling);
  return { laporan, ulang };
}

/**
 * Tombol "Ulangi unggah e-Doc saja" sesudah Putusan Akhir tersimpan tetapi e-Doc belum seluruhnya
 * (agen B2). Hanya langkah e-Doc yang diulang; Putusan Akhir tidak disentuh, e-Doc yang sudah ada
 * tidak diganti (cek di putusan-edoc-sekaligus.js).
 */
function b2PasangUlangEdoc(p) {
  const mod = globalThis.aletaPutusanEdoc;
  if (!mod || typeof mod.pasangUlang !== "function" || !p || !p.tempat) return null;
  p.tempat.ulang.textContent = "";
  if (p.perluBerkas) {
    p.tempat.ulang.appendChild(
      buatElemen(
        "div",
        "aleta-tetap-sebab aleta-remeh",
        "Berkas putusan belum tersedia dari ABT. Perbaiki sebabnya (mis. masuk ABT di tab lain) lalu ulangi, atau unggah berkas putusan sendiri lewat bagian “Unggah putusan ke SIPP”."
      )
    );
  }
  return mod.pasangUlang({
    induk: p.tempat.ulang,
    ulangi: async () => {
      const h = await mod.jalankan({
        nomorPerkara: p.nomorPerkara,
        kabar: p.kabar,
        wadah: p.wadah,
        putusan: p.putusan || null,
        putusanRtf: p.putusanRtf || null,
        anonim: p.anonim || null,
      });
      if (!b2LaporkanEdoc(p.nomorPerkara, p.tempat.laporan, h, "Putusan Akhir tersimpan di SIPP.")) {
        mod.gambarLangkah(p.tempat.laporan, "Hasil unggah ulang", h.langkah || []);
      }
      p.kabar.className = h.ok ? "aleta-abt-kabar" : "aleta-abt-kabar aleta-abt-gagal";
      p.kabar.textContent = h.bunyi || (h.ok ? "e-Doc selesai." : "e-Doc belum selesai.");
      return h;
    },
  });
}

/**
 * Menjalankan praperiksa dan menggambarnya ke wadah. Pulang rapornya, atau
 * null bila tidak dapat diminta - dan ketidakdapatan itu ikut digambar.
 */
async function jalankanPraperiksaPanel(nomorPerkara, wadah) {
  const tempat = buatElemen("div", "aleta-praperiksa-tempat");
  tempat.appendChild(buatElemen("div", "aleta-memuat", "Praperiksa: membaca fakta SIPP dan mengadunya dengan draf…"));
  wadah.appendChild(tempat);
  try {
    const usulan = await bacaUsulanBorangPutusan();
    const rapor = await mintaPraperiksaPutusan(nomorPerkara, usulan);
    tempat.textContent = "";
    if (!rapor || !rapor.ada) {
      tempat.appendChild(
        buatElemen(
          "div",
          "aleta-praperiksa-catatan",
          `Praperiksa tidak dijalankan: ${(rapor && rapor.sebab) || "tidak ada jawaban"}.`
        )
      );
      return null;
    }
    // Lama: gambarRaporAgen apa adanya (lihat t7RaporAgen).
    tempat.appendChild(typeof t7RaporAgen === "function" ? t7RaporAgen(rapor) : gambarRaporAgen(rapor));
    alatCatat("praperiksa", `${nomorPerkara}: ${rapor.ringkas}`, ringkasHentikan(rapor));
    return rapor;
  } catch (galat) {
    tempat.textContent = "";
    tempat.appendChild(
      buatElemen(
        "div",
        "aleta-praperiksa-ganjal",
        `Praperiksa tidak dapat diminta: ${String((galat && galat.message) || galat)}. ` +
          "Tidak ada yang diperiksa - ini bukan tanda lolos."
      )
    );
    return null;
  }
}

// ============================================================================
// PUTUSAN YANG SUDAH TERISI DI SIPP (butir 6, 1.189.x)
// ============================================================================
//
// Perkara yang putusannya SUDAH tersimpan di SIPP (perkara_putusan, dibaca
// lewat status-perkara: putusan.sudahPutus) tidak butuh Putusan otomatis lagi.
// Bagian itu DISEMBUNYIKAN selama borang Putusan Akhir tertutup - satu
// keterangan pendek menggantikannya. Bila petugas membuka borang Putusan Akhir
// kembali (edit), menunya muncul lagi dengan peringatan bahwa isinya akan
// MENIMPA yang lama, dan sebelum apa pun dituliskan ALETA meminta konfirmasi.
// Status yang tidak terbaca BUKAN "sudah terisi": bagiannya tetap tampil.
async function b6KeadaanPutusanTerisi(nomorPerkara) {
  if (!nomorPerkara || typeof ambilStatusPerkara !== "function") return null;
  try {
    const status = await ambilStatusPerkara(nomorPerkara);
    const p = (status && status.putusan) || {};
    const lengkap = (status && status.putusanLengkap) || {};
    const tanggal = String(lengkap.tanggalPutusan || p.tanggalPutusan || "");
    if (!p.sudahPutus && !tanggal) return { terisi: false };
    return { terisi: true, tanggal, status: String(lengkap.statusPutusan || "") };
  } catch {
    return null;
  }
}

function b6RincianPutusan(k) {
  const bagianRinci = [];
  if (k && k.tanggal) bagianRinci.push(`tanggal ${k.tanggal}`);
  if (k && k.status) bagianRinci.push(k.status);
  return bagianRinci.length ? ` (${bagianRinci.join(", ")})` : "";
}

/** Blangko tertutup: sembunyikan Putusan otomatis bila putusan sudah terisi. */
function b6SembunyikanBilaTerisi(kotak, nomorPerkara) {
  if (!kotak) return;
  void b6KeadaanPutusanTerisi(nomorPerkara).then((k) => {
    if (!k || !k.terisi || !kotak.isConnected) return;
    kotak.hidden = true;
    kotak.style.display = "none";
    kotak.setAttribute("data-aleta-putusan-terisi", "sembunyi");
    const catatan = buatElemen(
      "div",
      "aleta-tetap-sebab aleta-b6-putusan-terisi",
      `Putusan perkara ini sudah terisi di SIPP${b6RincianPutusan(k)} - Putusan otomatis disembunyikan. ` +
        "Untuk mengisi ulang, buka blangko Putusan Akhir (Edit); menunya muncul kembali dengan peringatan sebelum menimpa isi lama."
    );
    catatan.setAttribute("data-aleta-putusan-terisi", "catatan");
    if (kotak.parentNode) kotak.parentNode.insertBefore(catatan, kotak.nextSibling);
  });
}

/** Blangko terbuka atas putusan yang sudah ada: peringatan di puncak bagian. */
function b6PeringatkanBilaTerisi(kotak, nomorPerkara) {
  if (!kotak || !kotak.isi) return;
  void b6KeadaanPutusanTerisi(nomorPerkara).then((k) => {
    if (!k || !k.terisi || !kotak.isConnected) return;
    kotak.setAttribute("data-aleta-putusan-terisi", "peringatan");
    const awas = buatElemen(
      "div",
      "aleta-tetap-awas aleta-b6-awas-timpa",
      `Putusan perkara ini SUDAH terisi di SIPP${b6RincianPutusan(k)}. Mengisikan dari ALETA akan MENIMPA isi lama ` +
        "(pertimbangan hukum, amar, amar anonim, dan isian yang dicentang). ALETA meminta konfirmasi sebelum menulis."
    );
    kotak.isi.insertBefore(awas, kotak.isi.firstChild);
  });
}

/**
 * Konfirmasi sebelum menulis ke borang putusan yang sudah terisi. true = boleh
 * lanjut (belum terisi, keadaan tidak terbaca, atau petugas menyetujui).
 */
async function b6KonfirmasiTimpaPutusan(nomorPerkara) {
  const k = await b6KeadaanPutusanTerisi(nomorPerkara);
  if (!k || !k.terisi) return true;
  const tanya =
    `Putusan perkara ${nomorPerkara} SUDAH terisi di SIPP${b6RincianPutusan(k)}.\n\n` +
    "Isian dari ALETA akan MENIMPA isi putusan yang lama. Yakin menimpa yang lama?";
  try {
    return window.confirm(tanya) === true;
  } catch {
    return false;
  }
}

function bagianIsiPutusan(nomorPerkara) {
  const kotak = bagian("Putusan otomatis", "isiPutusan", true);
  const isi = kotak.isi;

  const terang = buatElemen(
    "div",
    "aleta-tetap-sebab",
    "Mengambil draf putusan ALETA yang terbaru untuk perkara ini, lalu mengisikan " +
      "Pertimbangan Hukum, Amar, dan Amar Anonim ke formulir di halaman ini. Sesudah " +
      "SELURUH yang dicentang terisi, Simpan ditekan sendiri dan halaman perkara dibuka " +
      "kembali - tetapi hanya setelah SIPP terbukti mencatatnya. Satu isian gagal berarti " +
      "Simpan tidak ditekan sama sekali. Blangko yang memuat medan tambahan satker diisi, " +
      "tetapi Simpan-nya Anda tekan sendiri."
  );
  isi.appendChild(terang);

  const tombol = buatElemen("button", "aleta-permintaan-tombol", "Ambil usulan dari ALETA");
  tombol.type = "button";
  const kabar = buatElemen("div", "aleta-abt-kabar");
  const wadah = buatElemen("div", "aleta-isian-putusan");
  isi.appendChild(tombol);
  isi.appendChild(kabar);

  // ========================================================================
  // NASKAH YANG SUDAH JADI, DITERIMA APA ADANYA
  // ========================================================================
  //
  // Draf ALETA yang dirakit dari fakta adalah jalan yang seharusnya, tetapi
  // hari ini naskah putusan masih ditulis hakim di templat satker. Menyuruh
  // menyalin pertimbangan 8.000 aksara ke CKEditor dengan tangan - lalu
  // amarnya, lalu amar anonimnya - bukan otomisasi apa pun.
  //
  // RTF, BUKAN PDF. Keduanya memuat naskah yang sama, tetapi PDF memecah
  // tiap paragraf menjadi baris cetak dan menyelipkan perabot halamannya
  // ke tengah naskah. Diukur pada satu putusan yang sama: RTF 151 paragraf
  // utuh, PDF 417 potongan baris. Menyambungnya kembali menuntut terkaan,
  // dan terkaan yang salah menyambung satu pertimbangan ke pertimbangan
  // berikutnya. Portal menolak PDF beserta sebabnya, bukan diam-diam.
  const kotakUnggah = buatElemen('div', 'aleta-unggah-naskah');
  // Perbaikan 30 Sep (butir 8, 10, 19) - hanya Baru & UI Baru; Lama persis semula.
  const a30Nyala = typeof a30Aktif === "function" && a30Aktif();
  const ajakanNaskah = buatElemen(
    "div",
    "aleta-tetap-sebab aleta-remeh",
    "Belum ada drafnya? Ambil dari naskah putusan yang sudah Anda tulis - berkas RTF-nya, bukan PDF."
  );
  if (a30Nyala) {
    ajakanNaskah.textContent =
      "Belum ada drafnya? Ambil dari naskah putusan yang sudah Anda tulis - RTF, DOCX, DOC, atau PDF. " +
      "Yang bukan RTF diubah server menjadi RTF lebih dulu; PDF dapat berubah tata letaknya, jadi periksa tiap bagian.";
  }
  kotakUnggah.appendChild(ajakanNaskah);
  const kakiUnggah = buatElemen('div', 'aleta-tetap-kaki');
  const pemilih = document.createElement("input");
  pemilih.type = "file";
  pemilih.accept = ".rtf,.txt";
  // Butir 8: DOCX/DOC/PDF juga diterima - diubah ke RTF lewat K1, lalu jalur yang sama.
  if (a30Nyala) pemilih.accept = A30_TERIMA_NASKAH;
  pemilih.className = "aleta-berkas";
  kakiUnggah.appendChild(pemilih);
  kotakUnggah.appendChild(kakiUnggah);
  // Butir 19: naskah yang dipilih di sini dapat sekaligus menjadi edoc putusan
  // + edoc anonimisasinya sesudah putusan tersimpan (a30BarisSekaligus).
  let naskahEdoc = null;
  const sekaligus = a30Nyala && typeof a30BarisSekaligus === "function" ? a30BarisSekaligus() : null;
  if (sekaligus) kotakUnggah.appendChild(sekaligus.baris);
  // Agen B2 (20 Okt): Putusan otomatis yang berangkat dari DRAF (tanpa berkas yang dipilih) juga
  // mengunggah edoc putusan + anonimisasi sesudah tersimpan - berkasnya dicetak dari Blangko Derry
  // di ABT. Bawaan menyala, dapat dimatikan; baris ini hanya tampak bila tidak ada berkas pilihan.
  const sekaligusAbt =
    a30Nyala && globalThis.aletaPutusanEdoc && typeof globalThis.aletaPutusanEdoc.barisSaklar === "function"
      ? globalThis.aletaPutusanEdoc.barisSaklar()
      : null;
  if (sekaligusAbt) kotakUnggah.appendChild(sekaligusAbt.baris);
  const segarkanBarisAbt = () => {
    if (sekaligusAbt) sekaligusAbt.tampilkan(!(sekaligus && sekaligus.ada()));
  };
  segarkanBarisAbt();
  // Butir 6 (6 Okt): drafnya dari naskah yang dikirim SEBELUMNYA di peramban
  // ini (antrean dari berkas, atau halaman ini sebelum dimuat ulang) - naskah
  // itu tetap menjadi edoc putusan + anonimisasinya. Barisnya tampil dengan
  // nama berkasnya, dan centangnya dapat dilepas seperti biasa.
  if (sekaligus && typeof a30AmbilNaskahEdoc === "function") {
    void a30AmbilNaskahEdoc(nomorPerkara).then((tersimpan) => {
      if (!tersimpan || naskahEdoc) return;
      naskahEdoc = tersimpan;
      sekaligus.setelNaskah(naskahEdoc);
      segarkanBarisAbt();
    });
  }
  // Ringkasan panjang tiap bagian punya wadahnya SENDIRI, bukan wadah usulan.
  // Pembacaan usulan mengosongkan wadahnya lebih dulu, sehingga ringkasan yang
  // ditaruh di sana akan terhapus sepersekian detik sesudah ditulis - tepat
  // ketika yang membacanya sedang memeriksa apakah potongannya masuk akal.
  const wadahUnggah = buatElemen("div", "aleta-unggah-hasil");
  kotakUnggah.appendChild(wadahUnggah);
  isi.appendChild(kotakUnggah);
  // Perbaikan 1 Okt (S, butir 4 - UI Baru saja): edoc anonimisasi yang
  // DIPILIH petugas dipakai apa adanya; tanpa pilihan, ALETA membuatnya.
  let anonimPilihan = null;
  // UI Baru (butir 12): anonimisasi yang disiapkan di latar sejak naskah dibaca.
  let anonimAwal = null;

  // Perbaikan 1 Okt (S, butir 3): pembaca naskah diberi nama supaya UI Baru
  // dapat meneruskan naskah yang dipilih SEBELUM blangko dibuka. Isinya sama
  // dengan pendengar change sebelumnya; Lama dan Baru tetap lewat pemilih.
  // 21 Okt 2026: memulangkan { ok, pesan } (dulu tanpa nilai) supaya tombol "Putusan Otomatis" di halaman
  // SIPP tahu naskahnya gagal dibaca dan tidak menunggu selamanya. `rtfSiap` = RTF yang sudah diubah
  // server dari berkas yang sama (panel halaman SIPP) - tidak diubah dua kali.
  const prosesNaskah = async (dipilih, rtfSiap) => {
    if (!dipilih) return { ok: false, pesan: "Berkas putusan belum dipilih." };
    pemilih.disabled = true;
    tombol.disabled = true;
    wadah.textContent = "";
    wadahUnggah.textContent = "";
    kabar.className = "aleta-abt-kabar";
    kabar.textContent = `Membaca ${dipilih.name}…`;

    // Butir 8 (Baru & UI Baru): DOCX/DOC/PDF diubah menjadi RTF di server
    // (K1, konversi-naskah) lalu lewat jalur unggah-naskah yang SAMA. Lama:
    // berkasnya dikirim apa adanya, seperti semula.
    let berkas = dipilih;
    let peringatanBentuk = [];
    naskahEdoc = null;
    if (a30Nyala && rtfSiap && /\.rtf$/i.test(String(rtfSiap.name || "")) && typeof a30PerluKeRtf === "function" && a30PerluKeRtf(dipilih.name)) {
      berkas = rtfSiap;
      kabar.textContent = `Membaca ${dipilih.name} (sebagai RTF)…`;
    } else if (a30Nyala && typeof a30PerluKeRtf === "function" && a30PerluKeRtf(dipilih.name)) {
      kabar.textContent = `Mengubah ${dipilih.name} menjadi RTF…`;
      const ubah = await a30KonversiNaskah(dipilih, "rtf");
      if (!ubah.ok) {
        kabar.className = "aleta-abt-kabar aleta-abt-gagal";
        kabar.textContent = ubah.pesan;
        pemilih.disabled = false;
        tombol.disabled = false;
        pemilih.value = "";
        return { ok: false, pesan: `${dipilih.name} belum dapat diubah menjadi RTF: ${ubah.pesan || "tanpa keterangan"}` };
      }
      berkas = ubah.berkas;
      peringatanBentuk = ubah.peringatan;
      kabar.textContent = `Membaca ${dipilih.name} (sebagai RTF)…`;
    }
    if (a30Nyala) naskahEdoc = { asli: dipilih, rtf: /\.rtf$/i.test(berkas.name) ? berkas : null };

    let jawab;
    try {
      const badan = new FormData();
      badan.append("berkas", berkas);
      badan.append("nomorPerkara", nomorPerkara || "");
      badan.append("perkaraId", perkaraIdDariHalaman());
      const respons = await alatAmbil(
        ALETA_API_UNGGAH_NASKAH,
        {
          method: "POST",
          body: badan,
          credentials: "include",
          batasMs: BATAS_UNGGAH_NASKAH_MS,
        },
        "Mengirim naskah putusan"
      );
      if (!respons.ok) {
        throw new Error(alatPesanGagal(null, respons.status, "Mengirim naskah putusan"));
      }
      const luar = await respons.json();
      jawab = luar && luar.data ? luar.data : luar;
    } catch (galat) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = String((galat && galat.message) || galat);
      pemilih.disabled = false;
      tombol.disabled = false;
      return { ok: false, pesan: `Naskah ${dipilih.name} belum terkirim ke ALETA: ${kabar.textContent}` };
    }

    pemilih.disabled = false;
    tombol.disabled = false;
    pemilih.value = "";

    if (!jawab || !jawab.ok) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = (jawab && jawab.sebab) || "Naskahnya tidak dapat dibaca.";
      return { ok: false, pesan: `Naskah ${dipilih.name} tidak dapat dibaca: ${kabar.textContent}` };
    }

    // Panjang tiap bagian diperlihatkan SEBELUM apa pun diisikan. Bagian
    // yang terpotong salah hampir selalu kelihatan dari panjangnya - amar
    // 8.000 aksara berarti pertimbangan ikut terbawa ke dalamnya.
    const rinci = buatElemen('div', 'aleta-unggah-rinci');
    for (const b of jawab.bagian || []) {
      const baris = buatElemen('div', 'aleta-unggah-baris');
      baris.appendChild(buatElemen('span', 'aleta-unggah-judul', b.judul));
      baris.appendChild(
        buatElemen(
          'span',
          b.aksara ? 'aleta-unggah-jumlah' : 'aleta-unggah-kosong',
          b.aksara ? `${b.aksara.toLocaleString('id-ID')} aksara` : (b.halangan || 'kosong')
        )
      );
      rinci.appendChild(baris);
    }
    wadahUnggah.textContent = '';
    wadahUnggah.appendChild(rinci);
    // Peringatan konversi (butir 8) - PDF: tata letaknya dapat berubah.
    for (const p of peringatanBentuk) wadahUnggah.appendChild(buatElemen("div", "aleta-tetap-awas", String(p)));
    if (sekaligus) sekaligus.setelNaskah(naskahEdoc);
    segarkanBarisAbt();
    // Butir 6 (6 Okt): naskah yang sama disimpan di peramban ini, supaya
    // "Putusan massal - SIPP" atas draf ini pun dapat mengunggah edocnya
    // (a30OpsiEdocMassal). Tidak ditunggu, dan gagalnya tidak berbunyi.
    if (naskahEdoc && typeof a30SimpanNaskahEdoc === "function") void a30SimpanNaskahEdoc(nomorPerkara, naskahEdoc.asli, naskahEdoc.rtf);
    // Perbaikan 1 Okt (S, butir 12 - UI Baru saja): anonimisasi edoc mulai
    // disiapkan SEKARANG, selagi usulan dibaca dan diperiksa - bukan sesudah
    // Isikan. Tidak ada yang dikirim ke SIPP; pemeriksanya tetap berjalan.
    // Dari tombol "Putusan Otomatis" halaman SIPP: anonimisasinya disiapkan modul e-Doc sesudah Simpan
    // terbukti (putusan-edoc-sekaligus.js) - tidak disiapkan dua kali di sini.
    anonimAwal =
      !otoMenunggu && typeof s1Aktif === "function" && s1Aktif() && typeof s1SiapkanAnonimAwal === "function"
        ? s1SiapkanAnonimAwal({ naskahEdoc, sekaligus, anonimPilihan, nomorPerkara, kotakUnggah })
        : null;

    kabar.className = "aleta-abt-kabar";
    kabar.textContent =
      `Draf v${jawab.versi} tersimpan dari ${dipilih.name}. ` +
      (jawab.perabotDibuang
        ? `${jawab.perabotDibuang} baris perabot halaman dibuang. `
        : "") +
      "Mengambil usulannya…";

    // Langsung disambung ke pembacaan usulan - yang mengunggah naskah
    // memang hendak mengisikannya, bukan hendak berhenti di sini.
    tombol.click();
    return { ok: true };
  };
  pemilih.addEventListener("change", () => void prosesNaskah(pemilih.files && pemilih.files[0]));

  isi.appendChild(wadah);

  /** Satu baris usulan: judul, cuplikan, dan centang. */
  function barisIsian(judul, penunjuk, teks, keterangan) {
    const baris = buatElemen("div", "aleta-abt-kartu");
    const kepala = buatElemen("div", "aleta-abt-kartu-kepala");
    const centang = document.createElement("input");
    centang.type = "checkbox";
    centang.className = "aleta-abt-centang";
    centang.checked = Boolean(teks);
    centang.disabled = !teks;
    kepala.appendChild(centang);
    kepala.appendChild(buatElemen("span", "aleta-abt-nama", judul));
    baris.appendChild(kepala);

    if (keterangan) baris.appendChild(buatElemen("div", "aleta-abt-catatan", keterangan));

    // ======================================================================
    // YANG DIISIKAN ADALAH YANG TERBACA DI SINI, BUKAN YANG DIUSULKAN
    // ======================================================================
    //
    // Sebelumnya usulannya hanya dapat diterima atau ditolak seluruhnya.
    // Satu kata yang keliru pada pertimbangan 8.000 aksara berarti seluruh
    // usulannya dibatalkan, lalu disalin tangan dari naskahnya - pekerjaan
    // yang justru hendak dihapus alat ini.
    //
    // Sekarang teksnya disunting di tempat. Yang dikirim ke borang SIPP
    // adalah isi kotak ini apa adanya, sehingga tidak pernah ada selisih
    // antara yang dibaca petugas dan yang tersimpan.
    const sunting = document.createElement("textarea");
    sunting.className = "aleta-abt-isi aleta-sunting";
    sunting.value = teks || "";
    sunting.rows = teks && teks.length > 400 ? 8 : 4;
    sunting.spellcheck = false;
    if (!teks) {
      sunting.placeholder = "(kosong pada draf - boleh diisi sendiri)";
      sunting.classList.add("aleta-abt-isi-kosong");
    }
    // Menyunting yang tadinya kosong berarti memang hendak memakainya.
    sunting.addEventListener("input", () => {
      const ada = sunting.value.trim().length > 0;
      centang.disabled = !ada;
      if (!ada) centang.checked = false;
    });
    baris.appendChild(sunting);
    // Pratinjau rapi / penyunting teks kaya (sipp-6, D10). Lama: tidak berbuat apa-apa.
    if (typeof t7PasangPenyunting === "function") t7PasangPenyunting(sunting);

    return {
      baris,
      centang,
      penunjuk,
      judul,
      // Dibaca saat ditekan, bukan saat digambar.
      get teks() {
        return sunting.value;
      },
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // MEDAN PILIHAN - BERBEDA MENURUT JENIS PERKARA DAN STATUS PUTUSAN
  // ────────────────────────────────────────────────────────────────────
  //
  // Perkara cerai yang dikabulkan menuntut faktor perceraian, nusyuz, qobla,
  // dan kadang keadaan istri. Dispensasi kawin menuntut alasan pengajuan -
  // hamil, pergaulan bebas, dan seterusnya. Izin poligami, itsbat, dan
  // pembatalan perkawinan masing-masing punya daftarnya sendiri.
  //
  // Tidak satu pun aturan itu disalin ke sini. Yang dikerjakan: menanyakan
  // kepada HALAMAN medan mana yang sedang tampak beserta daftar pilihannya,
  // lalu meminta ALETA memilih satu berdasarkan bunyi putusan. Medan yang
  // disembunyikan SIPP tidak pernah ditawarkan, dan itu sebabnya panel ini
  // tidak perlu tahu satu pun nomor jenis perkara.
  //
  // Penunjuknya berbasis NAMA, bukan id, dan itu bukan selera. Pada borang
  // SIPP yang ini, select "status_reskom" memakai id="faktor_cerai" - id
  // yang sama dengan select faktor perceraian. querySelector("#faktor_cerai")
  // memulangkan yang mana pun yang lebih dulu di dokumen, dan pada hari
  // urutannya berubah, faktor perceraian akan terisi dengan hasil reskom
  // tanpa satu pun tanda. Nama medan tidak kembar, dan namanya pula yang
  // dikirim ke peladen.
  //
  // URUTANNYA BUKAN SELERA. Status Putusan berdiri paling depan sebab ia
  // yang MENENTUKAN medan mana saja yang muncul sesudahnya: sebelum ia
  // dipilih, SIPP menyembunyikan faktor perceraian, nusyuz, qobla, dan
  // keadaan istri seluruhnya. Itu pula sebab bagian ini dulu tampak tidak
  // mengusulkan apa-apa - yang dibaca hanya medan yang kebetulan sudah
  // tampak, dan pada borang yang baru dibuka memang tidak ada satu pun.
  //
  // template_amar SENGAJA TIDAK ADA DI SINI. Ia bukan keterangan perkara
  // melainkan pemilih templat yang MENIMPA isi Amar begitu dipilih -
  // menimpa amar yang baru saja diisikan dari naskah putusan yang
  // sesungguhnya. Yang hendak memakai templat memilihnya sendiri.
  const CALON_MEDAN_PANEL = [
    { penunjuk: 'select[name="status_putusan"]', label: "Status Putusan" },
    { penunjuk: 'select[name="verstek"]', label: "Putusan Verstek" },
    { penunjuk: 'input[name="sumber_hukum[]"]', label: "Sumber Hukum", banyak: true },
    { penunjuk: 'select[name="faktor_cerai"]', label: "Faktor Penyebab Perceraian" },
    { penunjuk: 'select[name="faktor_cerai_sekunder"]', label: "Faktor Penyebab Perceraian (Sekunder)" },
    { penunjuk: 'input[name="status_nusyuz"]', label: "Status Nusyuz" },
    { penunjuk: 'select[name="qobla"]', label: "Qobla/Ba'da Dukhul" },
    { penunjuk: 'select[name="keadaan_istri"]', label: "Keadaan Istri" },
    { penunjuk: 'select[name="alasan_dispen"]', label: "Alasan Pengajuan Dispensasi Kawin" },
    { penunjuk: 'select[name="akad_syariah_primer"]', label: "Jenis Akad Syariah" },
    { penunjuk: 'select[name="status_reskom"]', label: "Hasil Reskom" },
    { penunjuk: 'select[name="pengakhiran_id"]', label: "Jenis Pengakhiran" },
  ];

  /**
   * Berapa medan pilihan yang SEDANG tampak di borang.
   *
   * Dipakai mengenali borang yang berubah bentuk sesudah sebagian isinya
   * dipilih - lihat catatan pada pembacaan ulang di bawah. Yang dihitung
   * hanya jumlahnya; daftar lengkapnya dibaca ulang oleh pembacaan itu
   * sendiri, dan membacanya dua kali di sini hanya menggandakan kerja.
   */
  /**
   * ==========================================================================
   * MEDAN YANG MENGUBAH BENTUK BORANG
   * ==========================================================================
   *
   * Memilih Status Putusan membuat SIPP memunculkan medan yang sebelumnya
   * tidak ada di halaman sama sekali: faktor perceraian, nusyuz, qobla,
   * keadaan isteri. Memilih Qobla menentukan muncul-tidaknya keadaan isteri
   * lagi. Keduanya bukan keterangan biasa - keduanya PINTU.
   *
   * Selama pintunya tertutup, medan di baliknya tidak dapat dibaca, tidak
   * dapat diusulkan, dan tidak dapat dicentang. Panel karena itu membukanya
   * sendiri: usulan pintunya diterapkan lebih dulu, borangnya dibiarkan
   * menggambar ulang, lalu isinya dibaca. Yang di baliknya ikut ditawarkan
   * dalam satu daftar, sekali tekan.
   *
   * Yang diterapkan HANYA pintunya, dan hanya bila ALETA memang
   * mengusulkannya. Sisanya tetap menunggu petugas mencentang - tidak ada
   * satu pun medan lain yang tersentuh sebelum tombol Isikan ditekan.
   */
  const MEDAN_PINTU = ['select[name="status_putusan"]', 'select[name="qobla"]'];

  // ==========================================================================
  // DAFTAR MEDAN DARI PORTAL (putusan.medan-borang), CADANGANNYA TERTANAM
  // ==========================================================================
  //
  // Satker dapat menambah medan borang atau mematikan medan bawaan lewat
  // Pengaturan tipe keluaran. Daftar yang berlaku dibaca lewat
  // alatTipeKeluaran (singgahan, portal, singgahan lama, tertanam) sekali per
  // tekan tombol. Tabel kosong berarti portal menjawab cermin, dan portal
  // mati berarti tertanam - keduanya persis CALON_MEDAN_PANEL, urutan dan isi.
  //
  // Medan yang asalnya 'tambahan' ditandai. Ia tetap dibaca, diusulkan, dan
  // dapat diisikan, tetapi Simpan TIDAK ditekan sendiri selama satu saja di
  // antaranya tampak di borang: penunjuknya disahkan di portal, bukan diuji
  // di SIPP satker ini, jadi yang menilai borangnya sudah utuh adalah petugas.
  let medanBorangBerlaku = null;
  async function muatMedanBorang() {
    if (medanBorangBerlaku) return medanBorangBerlaku;
    const tertanam = () =>
      CALON_MEDAN_PANEL.map((c, urutan) => {
        const data = { penunjuk: c.penunjuk };
        if (c.banyak) data.banyak = true;
        if (MEDAN_PINTU.includes(c.penunjuk)) data.pintu = true;
        return { kunci: "putusan-akhir", nilai: c.label, data, urutan, asal: "bawaan", sidik: "" };
      });
    try {
      const hasil = await alatTipeKeluaran("putusan.medan-borang", { tertanam });
      const daftar = hasil.entri.map((e) => ({
        penunjuk: e.data.penunjuk,
        label: e.nilai,
        banyak: Boolean(e.data.banyak),
        tambahan: e.asal === "tambahan",
      }));
      if (daftar.length === 0) {
        // Daftar kosong bukan borang tanpa medan - lebih mungkin seluruhnya
        // terbuang penyaring. Disebut di konsol, lalu dipakai yang tertanam.
        console.warn(`[ALETA] Medan blangko putusan dari ${hasil.asal} kosong; dipakai daftar tertanam.`);
      } else {
        medanBorangBerlaku = daftar;
        return daftar;
      }
    } catch (galat) {
      console.warn("[ALETA] Medan blangko putusan tidak terbaca; dipakai daftar tertanam:", galat);
    }
    medanBorangBerlaku = CALON_MEDAN_PANEL.map((c) => ({ ...c, banyak: Boolean(c.banyak), tambahan: false }));
    return medanBorangBerlaku;
  }

  /** Membaca seluruh medan yang SEDANG tampak, beserta pilihannya. */
  async function bacaMedanTampak() {
    const hasil = [];
    const semuaCalon = await muatMedanBorang();
    const jawabanCalon = await bacaPilihanCalon(semuaCalon);
    for (let urut = 0; urut < semuaCalon.length; urut += 1) {
      const calon = semuaCalon[urut];
      const jawabPilihan = jawabanCalon[urut];
      if (!jawabPilihan || !jawabPilihan.ok || !jawabPilihan.tampak) continue;
      const pilihan = (jawabPilihan.pilihan || []).map((x) => ({ nilai: x.nilai, label: x.label }));
      if (pilihan.length === 0) continue;
      hasil.push({
        kunci: calon.penunjuk,
        label: calon.label,
        pilihan,
        banyak: Boolean(calon.banyak),
        tambahan: Boolean(calon.tambahan),
        nilaiSekarang: jawabPilihan.nilaiSekarang || "",
        // Yang SUDAH terpilih di halaman ikut dikirim (K9) - lihat nilaiTerpilihMedan;
        // nilai yang dipilih borang SIPP sendiri (NILAI_BAWAAN_BORANG) tidak.
        terpilih: nilaiTerpilihBukanBawaan(calon.penunjuk, nilaiTerpilihMedan(jawabPilihan, Boolean(calon.banyak))),
      });
    }
    return hasil;
  }

  /** Meminta ALETA mengusulkan nilai untuk sekumpulan medan. */
  async function mintaUsulanMedan(daftar, jenisPerkara) {
    if (daftar.length === 0) return [];
    const respons = await alatAmbil(
      ALETA_API_ISIAN_PUTUSAN,
      {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(muatanUsulanMedan(nomorPerkara, jenisPerkara, daftar)),
      },
      "Menyusun usulan pilihan"
    );
    if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Menyusun usulan pilihan"));
    const luar = await respons.json();
    const isiUsulan = luar && luar.data ? luar.data : luar;
    return (isiUsulan && isiUsulan.usulan) || [];
  }

  async function hitungMedanTampak() {
    let jumlah = 0;
    for (const jawab of await bacaPilihanCalon(await muatMedanBorang())) {
      if (jawab && jawab.ok && jawab.tampak && (jawab.pilihan || []).length > 0) jumlah += 1;
    }
    return jumlah;
  }

  /**
   * Jawaban "pilihan" jembatan untuk tiap calon medan, urut seperti daftarnya.
   * Hanya MEMBACA. Baru & UI Baru (butir 10): dikirim berbarengan - urutan
   * pesannya ke jembatan tetap sama, yang hilang hanya tunggu bolak-balik
   * satu per satu. Lama: berurutan seperti semula.
   */
  async function bacaPilihanCalon(daftarCalon) {
    if (a30Nyala) return Promise.all(daftarCalon.map((c) => kirimKeJembatan({ jenis: "pilihan", penunjuk: c.penunjuk })));
    const jawaban = [];
    for (const calon of daftarCalon) jawaban.push(await kirimKeJembatan({ jenis: "pilihan", penunjuk: calon.penunjuk }));
    return jawaban;
  }

  // Rapor praperiksa terakhir untuk perkara ini. Dibaca lagi saat Isikan
  // ditekan: yang menahan MENAHAN sampai orang menyatakan sudah membacanya.
  let raporAgen = null;

  // Agen B2 (20 Okt): tombol "Putusan Otomatis" di halaman perkara SIPP (putusan-sipp.js) menjalankan
  // alur panel ini JUGA - ambil usulan, isikan yang dicentang, Simpan, lalu e-Doc - tanpa salinan kode:
  // kotak.otomatis() hanya menekan tombol yang sama dan menunggu hasilnya.
  let otoMenunggu = null;
  const selesaiOto = (hasil) => {
    if (!otoMenunggu) return;
    const { resolve } = otoMenunggu;
    otoMenunggu = null;
    kotak.removeAttribute("data-oto-jalan");
    resolve(hasil);
  };
  // 21 Okt 2026: pembacaan usulan yang tidak diminta alur otomatis (mis. muat-draf-sendiri UI Baru) selagi
  // Isikan/Simpan alur otomatis masih berjalan tidak boleh menutup alur itu lebih dulu dengan "gagal".
  const selesaiOtoUsulan = (hasil) => {
    if (otoMenunggu && otoMenunggu.terapJalan) return;
    selesaiOto(hasil);
  };

  tombol.addEventListener("click", async () => {
    tombol.disabled = true;
    // Daftar medan dibaca ulang tiap tekan - tanpa permintaan bila versinya
    // sama dengan singgahan - supaya tambahan yang baru disahkan ikut tanpa
    // memuat ulang halaman.
    medanBorangBerlaku = null;
    wadah.textContent = "";
    kabar.className = "aleta-abt-kabar";
    kabar.textContent = "Membaca draf putusan…";

    let jawab;
    try {
      const respons = await alatAmbil(
        `${ALETA_API_ISIAN_PUTUSAN}?nomorPerkara=${encodeURIComponent(nomorPerkara || "")}`,
        { credentials: "include", cache: "no-store" },
        "Membaca draf putusan"
      );
      if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Membaca draf putusan"));
      const luar = await respons.json();
      jawab = luar && luar.data ? luar.data : luar;
    } catch (galat) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = String((galat && galat.message) || galat);
      tombol.disabled = false;
      selesaiOtoUsulan({ ok: false, tahap: "usulan", pesan: kabar.textContent });
      return;
    }

    if (!jawab || !jawab.ada) {
      kabar.className = "aleta-abt-kabar";
      kabar.textContent = (jawab && jawab.sebab) || "Belum ada draf putusan untuk perkara ini.";
      tombol.disabled = false;
      selesaiOtoUsulan({ ok: false, tahap: "usulan", pesan: kabar.textContent });
      return;
    }

    kabar.textContent = `Draf versi ${jawab.versi} (${jawab.keadaan}).`;

    // Perbaikan 1 Okt (S, butir 12 - UI Baru saja): putaran PERTAMA baca medan
    // + usulan ALETA berjalan BERSAMAAN dengan praperiksa. Keduanya hanya
    // membaca blangko (tidak ada yang diisi sebelum praperiksa selesai), jadi
    // praperiksa tetap menilai blangko yang belum disentuh; rapornya tetap
    // digambar di atas dan tetap ditunggu sebelum pintu mana pun diisi.
    const s1Cepat = typeof s1Aktif === "function" && s1Aktif();
    const putaranAwal = s1Cepat
      ? (async () => {
          let terbaca = null;
          try {
            terbaca = await bacaMedanTampak();
            return { terbaca, usulan: await mintaUsulanMedan(terbaca, (jawab && jawab.jenisPerkara) || "") };
          } catch (galat) {
            // Bacaan yang gagal diulang jalur biasa di putaran pertama.
            return terbaca ? { terbaca, galat } : null;
          }
        })()
      : null;

    // Praperiksa lebih dulu daripada usulan isian: yang membaca panel ini
    // harus melihat pertentangannya SEBELUM melihat tombol Isikan.
    raporAgen = await jalankanPraperiksaPanel(nomorPerkara, wadah);

    for (const satu of jawab.catatan || []) {
      wadah.appendChild(buatElemen("div", "aleta-tetap-sebab", satu));
    }
    if ((jawab.belumTerisi || []).length) {
      wadah.appendChild(
        buatElemen(
          "div",
          "aleta-gagal",
          `Belum terisi pada draf: ${jawab.belumTerisi.join(", ")}. Bagian itu tidak akan diisikan.`
        )
      );
    }

    // ======================================================================
    // BORANG PUTUSAN MEMANG BERGANTI BENTUK - TETAPI BUKAN DI BAGIAN INI
    // ======================================================================
    //
    // Versi 1.162.0 menyelidiki lebih dulu apakah #perhum, #amar, dan
    // #amar_anonim ada di halaman, lalu hanya menggambar yang ada. Premisnya
    // SALAH, dan diukur salahnya di dua tempat:
    //
    //   1. Koreksi pengguna, 22 September 2026: pada status selain Dikabulkan
    //      borangnya TETAP punya Pertimbangan Hukum, Tanggal Putusan, Status
    //      Putusan, Sumber Hukum, Amar Putusan, dan Amar Putusan Anonimisasi.
    //      Yang tidak muncul justru medan PILIHAN - verstek, qobla/ba'da
    //      dukhul, faktor perceraian, nusyuz, keadaan istri.
    //
    //   2. Sumber SIPP-nya sendiri (edit_putusan_akhir.php). Medan yang
    //      hilang itu disembunyikan dengan jQuery .hide() - display:none,
    //      elemennya TETAP di DOM. Pada status Dicabut yang disembunyikan
    //      #verstek_tr, #popup_faktor_tr, dan #popup_keadaan_tr; baris sumber
    //      hukum tidak pernah disembunyikan.
    //
    // Jadi penyelidikan itu tidak pernah dapat bekerja: jembatan menjawab
    // "ada" untuk elemen yang disembunyikan sekalipun, sebab yang
    // diperiksanya keberadaan di DOM - bukan kelihatan atau tidak. Ia hanya
    // memberi kalimat yang terdengar pasti atas sesuatu yang tidak diperiksa.
    //
    // Penyaring yang BENAR untuk medan pilihan sudah lama ada dan memang
    // memeriksa yang seharusnya: bacaMedanTampak() membuang medan yang
    // jawabannya tidak `tampak`, dan `tampak` dihitung dari offsetParent -
    // yang justru mengenali .hide() milik SIPP.
    //
    // Karena itu ketiga baris naskah digambar apa adanya, seperti sebelum
    // 1.162.0.
    const daftar = [
      barisIsian("Pertimbangan Hukum", "#perhum", jawab.pertimbangan, ""),
      barisIsian("Amar Putusan", "#amar", jawab.amar, ""),
      barisIsian(
        "Amar Anonim",
        "#amar_anonim",
        jawab.amarAnonim,
        (jawab.namaDisamarkan || []).length
          ? `Nama yang disamarkan: ${jawab.namaDisamarkan
              .map((x) => `${x.nama} → ${x.menjadi}`)
              .join("; ")}`
          : ""
      ),
    ];
    for (const satu of daftar) wadah.appendChild(satu.baris);


    // ======================================================================
    // PINTUNYA DIBUKA LEBIH DULU, BARU ISINYA DIBACA
    // ======================================================================
    //
    // Berputar sampai tidak ada lagi medan baru yang muncul, paling banyak
    // tiga kali - Status Putusan membuka faktor perceraian dan qobla, dan
    // qobla membuka keadaan isteri: dua pintu bersusun, tidak pernah lebih.
    // Batasnya tetap ada supaya borang yang berperilaku tak terduga tidak
    // memutar panel ini tanpa akhir.
    const jenisUntukUsulan = (jawab && jawab.jenisPerkara) || "";
    let medanTampak = [];
    let usulanMedan = [];
    const sudahDibuka = new Set();
    let gagalUsulan = null;
    /**
     * Pintu yang SUDAH dipilih petugas dan usulan ALETA berbeda.
     *
     * Dikumpulkan, bukan diterapkan. Selisih pada Status Putusan adalah
     * perbedaan pendapat tentang bagaimana perkara ini diputus - dan yang
     * berwenang memutuskannya bukan panel ini.
     */
    const bedaPintu = [];

    for (let putaran = 0; putaran < 3; putaran += 1) {
      // UI Baru: putaran pertama sudah dibaca bersamaan dengan praperiksa.
      const awal = putaran === 0 && putaranAwal ? await putaranAwal : null;
      const terbaca = awal ? awal.terbaca : await bacaMedanTampak();
      const baru = terbaca.filter((x) => !medanTampak.some((y) => y.kunci === x.kunci));
      if (baru.length === 0) break;

      let usulanBaru = [];
      try {
        if (awal && awal.galat) throw awal.galat;
        usulanBaru = awal ? awal.usulan : await mintaUsulanMedan(baru, jenisUntukUsulan);
      } catch (galat) {
        gagalUsulan = String((galat && galat.message) || galat);
        medanTampak = terbaca;
        break;
      }
      medanTampak = terbaca;
      usulanMedan = usulanMedan.concat(usulanBaru);

      // ====================================================================
      // PINTU YANG SUDAH DIPILIH PETUGAS TIDAK PERNAH DITIMPA
      // ====================================================================
      //
      // Inilah yang sesungguhnya merusak perkara CABUT, dan ia jauh lebih
      // berbahaya daripada baris naskah yang hilang.
      //
      // Sampai 1.162.0 panel menuliskan Status Putusan usulan ALETA ke borang
      // TANPA melihat apa yang sudah ada di sana. Petugas yang sudah memilih
      // "Dicabut" lalu membuka panel ini mendapati pilihannya berganti
      // sendiri menjadi usulan ALETA - yang pada sebagian besar perkara
      // berbunyi "Dikabulkan", sebab itulah status yang paling sering benar.
      // Borangnya lalu menggambar ulang, medan verstek dan faktor perceraian
      // yang seharusnya tersembunyi ikut muncul, dan satu-satunya keterangan
      // yang tertinggal adalah kalimat "ubah sendiri bila keliru" di bawah
      // daftar - sesudah semuanya terjadi.
      //
      // Akibatnya bukan tampilan: status putusan yang keliru tersimpan ke
      // perkara orang, dan ia mengalir ke laporan serta ke Direktori Putusan.
      //
      // Lebih buruk lagi, praperiksa sudah dijalankan SEBELUM baris ini -
      // atas status yang LAMA. Jadi status baru yang dituliskan panel tidak
      // pernah diadu dengan amar drafnya oleh siapa pun.
      //
      // Sekarang: pintu hanya diisi bila memang BELUM dipilih. Yang sudah
      // berisi dibiarkan apa adanya, dan bila usulan ALETA berbeda, selisih
      // itu DISEBUTKAN - bukan dikerjakan diam-diam.
      let adaYangDibuka = false;
      for (const pintu of MEDAN_PINTU) {
        if (sudahDibuka.has(pintu)) continue;
        const usul = usulanBaru.find((x) => x.kunci === pintu);
        if (!usul || !usul.nilai) continue;

        // Keadaan borang saat ini - dari pembacaan yang barusan, bukan dari
        // tebakan. "-1" dan kosong sama-sama berarti belum dipilih; itulah
        // nilai "Pilih Status Putusan" milik SIPP.
        const sekarang = terbaca.find((x) => x.kunci === pintu);
        const nilaiSekarang = String((sekarang && sekarang.nilaiSekarang) || "").trim();
        const sudahDipilihOrang = nilaiSekarang !== "" && nilaiSekarang !== "-1";

        if (sudahDipilihOrang) {
          sudahDibuka.add(pintu);
          if (String(usul.nilai) !== nilaiSekarang) {
            const namaPintu =
              (CALON_MEDAN_PANEL.find((x) => x.penunjuk === pintu) || {}).label || pintu;
            const labelUsul =
              ((sekarang && sekarang.pilihan) || []).find(
                (x) => String(x.nilai) === String(usul.nilai)
              ) || {};
            const labelKini =
              ((sekarang && sekarang.pilihan) || []).find((x) => String(x.nilai) === nilaiSekarang) ||
              {};
            bedaPintu.push(
              `${namaPintu}: blangko sudah berisi "${labelKini.label || nilaiSekarang}", ` +
                `ALETA mengusulkan "${labelUsul.label || usul.nilai}"`
            );
          }
          continue;
        }

        const hasilIsi = await kirimKeJembatan({
          jenis: "isi",
          penunjuk: pintu,
          jenisMedan: "pilih",
          nilai: usul.nilai,
        });
        sudahDibuka.add(pintu);
        if (hasilIsi && hasilIsi.ok) adaYangDibuka = true;
      }
      if (!adaYangDibuka) break;
      // SIPP menggambar ulang bagian borangnya - diberi waktu sebentar
      // sebelum dibaca lagi. UI Baru (butir 12): berhenti menunggu begitu
      // medan yang tampak bertambah, paling lama tetap 350 ms - putaran
      // berikutnya membaca ulang seluruhnya seperti biasa.
      if (s1Cepat && typeof s1TungguBerubah === "function") {
        await s1TungguBerubah(
          () => hitungMedanTampak(),
          terbaca.length,
          typeof S1_TUNGGU_PINTU_MS === "number" ? S1_TUNGGU_PINTU_MS : 350
        );
      } else {
        await new Promise((selesai) => setTimeout(selesai, 350));
      }
    }

    const pilihanTerap = [];
    if (medanTampak.length > 0) {
      wadah.appendChild(
        buatElemen(
          "div",
          "aleta-tetap-sebab",
          `Formulir ini juga menuntut ${medanTampak.length} pilihan yang berbeda menurut jenis perkara ` +
            "dan status putusannya. Angka inilah yang kelak menjadi laporan faktor penyebab perceraian " +
            "dan statistik dispensasi - jadi periksa tiap usulan sebelum dicentang." +
            (sudahDibuka.size > 0
              ? " Status Putusan yang masih kosong dipilihkan lebih dulu supaya medan di baliknya ikut terbaca; yang sudah Anda pilih TIDAK disentuh."
              : "")
        )
      );
    }

    // Selisih pendapat pada pintu yang sudah dipilih petugas - disebutkan,
    // tidak dikerjakan. Warnanya merah sebab yang dipersoalkan bukan kerapian
    // melainkan bagaimana perkara ini diputus.
    if (bedaPintu.length > 0) {
      wadah.appendChild(
        buatElemen(
          "div",
          "aleta-gagal",
          `Pilihan Anda dibiarkan apa adanya, tetapi ALETA membacanya lain — ${bedaPintu.join("; ")}. ` +
            "Periksa mana yang benar sebelum menyimpan. Praperiksa di atas dijalankan atas pilihan yang SEKARANG ada di blangko."
        )
      );
    }

    // ======================================================================
    // KARTU MEDAN DIGAMBAR SELALU, BUKAN HANYA BILA ADA SELISIH PINTU
    // ======================================================================
    //
    // Sejak 2.32.0 (7019909) blok selisih pintu di atas disisipkan tepat di
    // atas bagian ini, dan kurung penutupnya menelan kartu medan: kartu dan
    // kabar gagal-usulan hanya digambar bila petugas SUDAH memilih pintu yang
    // berbeda dengan usulan ALETA. Pada borang yang baru dibuka tidak ada satu
    // kartu pun - faktor perceraian dan kawan-kawannya dibaca, diusulkan, lalu
    // tidak pernah ditawarkan. Dijaga ekstensi-medan-putusan-tipe.test.ts,
    // yang menjalankan bagian ini.
    {
      // Usulannya sudah tersusun pada putaran buka-pintu di atas; yang
      // gagal disebutkan di sini, satu kali.
      if (gagalUsulan) {
        wadah.appendChild(buatElemen("div", "aleta-gagal", gagalUsulan));
      }

      for (const medan of medanTampak) {
        const usul = usulanMedan.find((x) => x.kunci === medan.kunci) || null;
        const sekarang = (medan.pilihan.find((x) => String(x.nilai) === String(medan.nilaiSekarang)) || {}).label || "";
        const kartu = buatElemen("div", "aleta-abt-kartu");

        const kepala = buatElemen("div", "aleta-abt-kartu-kepala");
        const centang = document.createElement("input");
        centang.type = "checkbox";
        centang.className = "aleta-abt-centang";
        // Status Putusan yang SUDAH dipilih petugas dan berbeda dengan usulan
        // juga tidak dicentang sendiri. Sampai 26 September 2026 kartunya
        // tercentang, dan "Isikan" menimpa status pilihan petugas - padahal
        // pintunya sendiri (di atas) sudah menolak menimpanya. "-1" dan
        // kosong berarti belum dipilih, sama dengan penjaga pintu itu.
        const statusKini = String(medan.nilaiSekarang || "").trim();
        const statusDipilihBeda =
          medan.kunci === 'select[name="status_putusan"]' &&
          Boolean(usul && usul.nilai) &&
          statusKini !== "" &&
          statusKini !== "-1" &&
          String(usul.nilai) !== statusKini;
        // Yang berselisih TIDAK dicentang sendiri: justru itu yang paling
        // perlu dibaca manusia.
        centang.checked = Boolean(usul && usul.nilai) && usul.keyakinan !== "bentrok" && !statusDipilihBeda;
        // Medan tanpa usulan pun boleh diisi sendiri, jadi centangnya hanya
        // mati selama memang belum ada yang terpilih - bukan selama ALETA
        // tidak mengusulkan apa pun.
        centang.disabled = !(usul && usul.nilai);
        kepala.appendChild(centang);
        kepala.appendChild(buatElemen("span", "aleta-abt-nama", medan.label));
        const nada =
          !usul || !usul.nilai
            ? { kelas: "aleta-tanda-abu", teks: "tidak ditemukan" }
            : usul.keyakinan === "bentrok"
            ? { kelas: "aleta-tanda-merah", teks: "naskah menyebut lebih dari satu" }
            : usul.keyakinan === "pasti"
            ? { kelas: "aleta-tanda-hijau", teks: "disebut naskah" }
            : { kelas: "aleta-tanda-kuning", teks: "mendekati" };
        kepala.appendChild(buatElemen("span", `aleta-tanda ${nada.kelas}`, nada.teks));
        if (medan.tambahan) {
          kepala.appendChild(buatElemen("span", "aleta-tanda aleta-tanda-abu", "tambahan satker"));
        }
        kartu.appendChild(kepala);

        const sanding = buatElemen("div", "aleta-abt-sanding");
        const kini = buatElemen("div", "aleta-abt-kini");
        kini.appendChild(buatElemen("span", "aleta-abt-label", "sekarang"));
        kini.appendChild(buatElemen("span", "aleta-abt-isi", sekarang || "(belum dipilih)"));
        sanding.appendChild(kini);
        if (usul && usul.nilai) {
          const usulBaris = buatElemen("div", "aleta-abt-usul");
          usulBaris.appendChild(buatElemen("span", "aleta-abt-label", "usulan"));
          usulBaris.appendChild(buatElemen("span", "aleta-abt-isi", usul.nilaiLabel));
          sanding.appendChild(usulBaris);
        }
        kartu.appendChild(sanding);
        if (statusDipilihBeda) {
          kartu.appendChild(
            buatElemen(
              "div",
              "aleta-abt-catatan aleta-status-dipilih-beda",
              `Status sudah dipilih di halaman: "${sekarang || statusKini}". ALETA mengusulkan "${usul.nilaiLabel || usul.nilai}". ` +
                "Tidak dicentang - centang sendiri bila usulan ALETA yang benar."
            )
          );
        }

        if (usul && usul.kutipan) {
          const kutip = buatElemen("div", "aleta-abt-kutipan");
          kutip.appendChild(buatElemen("span", "aleta-abt-asal", "Putusan"));
          kutip.appendChild(buatElemen("span", "aleta-abt-kalimat", usul.kutipan));
          kartu.appendChild(kutip);
        }
        if (usul && usul.alasan) kartu.appendChild(buatElemen("div", "aleta-abt-catatan", usul.alasan));

        // ====================================================================
        // PILIHANNYA DAPAT DIGANTI DI PANEL, TANPA MENINGGALKANNYA
        // ====================================================================
        //
        // Usulan yang keliru dulu hanya dapat ditolak - lalu petugas mencari
        // medannya sendiri di borang yang panjang, sambil mengingat apa yang
        // tadi dibacanya di panel. Sekarang daftarnya ada di sini, berisi
        // pilihan yang SAMA PERSIS dengan yang ditawarkan borang, dan yang
        // terpilih di sinilah yang diisikan.
        //
        // Medan bernilai banyak memakai kotak centang, sebab memilih satu
        // dari daftar tidak pernah dapat menyatakan tiga sumber hukum.
        let bacaPilihanPanel = null;
        if (medan.banyak) {
          const kotakBanyak = buatElemen("div", "aleta-pilih-banyak");
          const terusul = new Set(
            ((usul && usul.nilaiBanyak) || []).map((x) => String(x.nilai))
          );
          const semua = [];
          for (const pil of medan.pilihan) {
            const label = buatElemen("label", "aleta-pilih-banyak-baris");
            const kotak = document.createElement("input");
            kotak.type = "checkbox";
            kotak.value = String(pil.nilai);
            kotak.checked = terusul.has(String(pil.nilai));
            kotak.className = "aleta-abt-centang";
            label.appendChild(kotak);
            label.appendChild(buatElemen("span", "", pil.label));
            kotakBanyak.appendChild(label);
            semua.push(kotak);
          }
          kartu.appendChild(kotakBanyak);
          bacaPilihanPanel = () => semua.filter((x) => x.checked).map((x) => x.value);
          // Mencentang salah satu sumber hukum berarti medannya memang hendak
          // dipakai - centang induknya menyala sendiri, dan padam lagi ketika
          // seluruhnya dilepas.
          for (const kotak of semua) {
            kotak.addEventListener("change", () => {
              const ada = semua.some((x) => x.checked);
              centang.disabled = !ada;
              centang.checked = ada;
            });
          }
        } else {
          const pilih = document.createElement("select");
          pilih.className = "aleta-pilih-sendiri";
          for (const pil of medan.pilihan) {
            const opsi = document.createElement("option");
            opsi.value = String(pil.nilai);
            opsi.textContent = pil.label;
            pilih.appendChild(opsi);
          }
          // Usulannya yang terpilih lebih dulu; bila tidak ada usulan,
          // nilai yang sudah ada di borang.
          pilih.value = String((usul && usul.nilai) || medan.nilaiSekarang || "");
          pilih.addEventListener("change", () => {
            centang.disabled = !pilih.value;
            if (!pilih.value) centang.checked = false;
            else centang.checked = true;
          });
          kartu.appendChild(pilih);
          bacaPilihanPanel = () => (pilih.value ? [pilih.value] : []);
        }

        wadah.appendChild(kartu);
        // Medan yang tidak punya usulan pun tetap dapat dipilih sendiri -
        // itulah sebab daftarnya digambar di atas, di luar penjaga ini.
        {
          // Kotak centang diisikan satu per satu: mencentang satu kotak tidak
          // pernah membatalkan kotak lain, jadi seluruhnya memang harus
          // disebut. Medan biasa tetap satu nilai.
          pilihanTerap.push({
            kunci: medan.kunci,
            label: medan.label,
            centang,
            // Dibaca saat ditekan - yang berlaku pilihan petugas, bukan
            // usulan yang mungkin sudah digantinya sejak tadi.
            get nilaiSemua() {
              return bacaPilihanPanel();
            },
          });
        }
      }
    }

    const terap = buatElemen("button", "aleta-permintaan-tombol", "Isikan yang dicentang");
    terap.type = "button";
    const hasilTerap = buatElemen("div", "aleta-abt-kabar");

    // ======================================================================
    // YANG MENAHAN MENAHAN - SAMPAI ORANG MENYATAKAN SUDAH MEMBACANYA
    // ======================================================================
    //
    // Tombol Isikan mati selama praperiksa menemukan pertentangan yang
    // dibuktikan dari SIPP. Ia dapat dinyalakan lagi, tetapi lewat kotak
    // centang yang bunyinya jelas - dan bila dipilih, Simpan TIDAK ditekan
    // sendiri: keputusan itu milik petugas, termasuk menekan Simpan.
    if (raporAgen && raporAgen.hentikan) {
      terap.disabled = true;
      const tetap = buatElemen("label", "aleta-praperiksa-tetap");
      const centangTetap = document.createElement("input");
      centangTetap.type = "checkbox";
      centangTetap.className = "aleta-abt-centang";
      tetap.appendChild(centangTetap);
      tetap.appendChild(
        buatElemen(
          "span",
          "",
          "Saya sudah membaca yang menahan di atas - tetap isikan blangkonya. Simpan TIDAK akan ditekan sendiri."
        )
      );
      wadah.appendChild(tetap);
      centangTetap.addEventListener("change", () => {
        terap.disabled = !centangTetap.checked;
      });
    }

    wadah.appendChild(terap);
    wadah.appendChild(hasilTerap);

    // Satu kunci per perkara dipakai bersama penetapan dan tombol "Putusan Otomatis" di halaman SIPP:
    // dua pekerjaan atas perkara yang sama tidak berjalan bersamaan (tidak ganda).
    terap.addEventListener("click", async () => {
      // Alur otomatis: Isikan/Simpan ini sedang berjalan - pembacaan usulan lain tidak menekan Isikan kedua kalinya.
      if (otoMenunggu) otoMenunggu.terapJalan = true;
      const kunci = typeof b2AmbilKunci === "function" ? await b2AmbilKunci(nomorPerkara) : { ok: true, lepas: async () => undefined };
      if (!kunci.ok) {
        hasilTerap.className = "aleta-abt-kabar aleta-abt-gagal";
        hasilTerap.textContent = kunci.pesan;
        selesaiOto({ ok: false, tahap: "kunci", pesan: kunci.pesan });
        return;
      }
      // Kunci sisa pekerjaan terputus milik pengguna ini diambil alih: disebut terang-terangan.
      if (kunci.catatan) {
        hasilTerap.className = "aleta-abt-kabar";
        hasilTerap.textContent = kunci.catatan;
      }
      let h;
      try {
        h = await (async () => {
      const dipilih = daftar.filter((x) => x.centang.checked && x.teks);
      const medanDipilih = pilihanTerap.filter((x) => x.centang.checked);
      if (dipilih.length === 0 && medanDipilih.length === 0) {
        hasilTerap.textContent = "Tidak ada yang dicentang.";
        return;
      }
      terap.disabled = true;
      // Butir 6 (1.189.x): putusan yang sudah terisi di SIPP tidak ditimpa
      // tanpa persetujuan petugas.
      if (!(await b6KonfirmasiTimpaPutusan(nomorPerkara))) {
        terap.disabled = false;
        hasilTerap.textContent = "Dibatalkan - putusan lama di SIPP tidak diubah, blangko tidak diisi.";
        return;
      }
      const gagal = [];
      let berhasil = 0;
      // Butir 10 (Baru & UI Baru): keadaan putusan SEBELUM Simpan dibaca
      // berbarengan dengan pengisian - pengisian blangko tidak menulis apa pun
      // ke basis data SIPP, jadi bacaannya tetap "sebelum". Satu bacaan
      // status-perkara yang berat keluar dari jalur tunggu.
      const sebelumA30 = a30Nyala ? bacaPutusanSegar(nomorPerkara) : null;
      // Perbaikan 1 Okt (S, butir 4 & 12 - UI Baru saja). Edoc yang dipakai:
      // naskah yang diunggah di atas, beserta anonimisasi yang DIPILIH petugas
      // bila ada. Anonimisasi yang harus DIBUAT disiapkan BERSAMAAN dengan
      // pengisian blangko (persiapan itu tidak menulis ke SIPP), bukan sesudah
      // seluruh isian selesai - pemeriksanya tetap berjalan sebelum Simpan.
      const opsiOto = otoMenunggu ? otoMenunggu.opsi || {} : null;
      // 21 Okt 2026: dari tombol "Putusan Otomatis" halaman SIPP (opsi.edoc tertentu) e-Doc SELALU lewat modul
      // e-Doc bersama (edocAbt di bawah) - centang "e-Doc putusan"/"e-Doc anonimisasi" panel itu hanya
      // dihormati di sana. Dulu naskah yang tersimpan di peramban membelokkannya ke jalur sekaligus, yang
      // mengunggah KEDUA e-Doc walau salah satunya tidak dicentang.
      const otoTentukanEdoc = Boolean(opsiOto && opsiOto.edoc != null);
      const edocA30 =
        (opsiOto && opsiOto.edoc === false) || otoTentukanEdoc
          ? null
          : sekaligus && sekaligus.dipakai() && naskahEdoc
          ? s1Cepat && anonimPilihan
            ? { ...naskahEdoc, anonim: anonimPilihan }
            : naskahEdoc
          : null;
      let kabarAnon = null;
      let opsiAwalA30 = null;
      if (s1Cepat && a30Nyala && edocA30 && !edocA30.anonim && typeof a30OpsiSimpanPutusan === "function") {
        kabarAnon = buatElemen("div", "aleta-abt-kabar aleta-s1-kabar-anon");
        if (hasilTerap.parentNode) hasilTerap.parentNode.insertBefore(kabarAnon, hasilTerap.nextSibling);
        const awalIni = anonimAwal && anonimAwal.naskah === naskahEdoc ? anonimAwal : null;
        const anonSiap = awalIni ? awalIni.janji : null;
        // 7 Okt 2026: kabar langkah dan dialog pemeriksa anonimisasi yang
        // disiapkan di latar DIPINDAHKAN ke bawah kabar ini. Di kotak naskah
        // (puncak bagian) dialog itu tidak terlihat dan "Menunggu anonimisasi
        // siap" tampak macet selamanya (532/Pdt.G/2026).
        if (awalIni && kabarAnon.parentNode) {
          const induk = kabarAnon.parentNode;
          if (awalIni.tanya) induk.insertBefore(awalIni.tanya, kabarAnon.nextSibling);
          if (awalIni.kabar) induk.insertBefore(awalIni.kabar, awalIni.tanya && awalIni.tanya.parentNode === induk ? awalIni.tanya : kabarAnon.nextSibling);
        }
        opsiAwalA30 = a30OpsiSimpanPutusan({
          nomorPerkara,
          kabar: kabarAnon,
          wadah,
          sebelum: sebelumA30,
          edoc: edocA30,
          anonSiap,
          kabarLangkah: awalIni ? awalIni.kabar : null,
          masihBerlaku: () => kabarAnon.isConnected,
        });
      }

      // Medan pilihan lebih dulu. Sebagian di antaranya MENGUBAH tampilan
      // borang - memilih qobla menentukan muncul-tidaknya keadaan istri -
      // dan mengisinya sesudah teks panjang berarti perubahan itu terjadi
      // ketika petugas sudah berhenti memperhatikan.
      for (const satu of medanDipilih) {
        hasilTerap.textContent = `Memilih ${satu.label}…`;
        const nilaiDipakai = satu.nilaiSemua || [];
        if (nilaiDipakai.length === 0) {
          gagal.push(`${satu.label}: belum ada yang dipilih`);
          continue;
        }
        for (const nilai of nilaiDipakai) {
          const hasil = await kirimKeJembatan({
            jenis: "isi",
            penunjuk: satu.kunci,
            jenisMedan: "pilih",
            nilai,
          });
          if (hasil && hasil.ok) berhasil += 1;
          else gagal.push(`${satu.label}: ${(hasil && hasil.alasan) || "tidak terisi"}`);
        }
      }

      for (const satu of dipilih) {
        hasilTerap.textContent = `Mengisi ${satu.judul}…`;
        // "kaya" - jembatan yang menyentuh CKEditor. Menyetel value pada
        // textarea aslinya membuat tampilannya berubah tanpa nilainya ikut,
        // dan yang tersimpan kemudian bukan yang terlihat.
        const hasil = await kirimKeJembatan({
          jenis: "isi",
          penunjuk: satu.penunjuk,
          jenisMedan: "kaya",
          nilai: satu.teks,
        });
        if (hasil && hasil.ok) berhasil += 1;
        else gagal.push(`${satu.judul}: ${(hasil && hasil.alasan) || "tidak terisi"}`);
      }
      terap.disabled = false;
      hasilTerap.className = gagal.length ? "aleta-abt-kabar aleta-abt-gagal" : "aleta-abt-kabar";
      hasilTerap.textContent = gagal.length
        ? `${berhasil} terisi, ${gagal.length} gagal: ${gagal.join("; ")}`
        : `${berhasil} isian terisi.`;

      // ====================================================================
      // MEDAN YANG BARU LAHIR SESUDAH STATUS PUTUSAN DIPILIH
      // ====================================================================
      //
      // Memilih "Dikabulkan" pada perkara cerai gugat membuat SIPP
      // memunculkan Faktor Penyebab Perceraian primer dan sekunder,
      // Qobla/Ba'da, Status Nusyuz, dan Keadaan Istri - lima medan yang
      // beberapa detik lalu belum ada di halaman sama sekali, dan karena itu
      // tidak pernah ikut ditanyakan ke ALETA.
      //
      // Membiarkannya berarti otomisasi berhenti tepat di tempat yang paling
      // banyak isiannya, dan petugas mengisi lima pilihan dengan tangan
      // justru sesudah diberi tahu bahwa isiannya sudah terisi.
      //
      // Dijalankan hanya bila jumlah medan yang tampak benar-benar
      // BERTAMBAH. Tanpa syarat itu, tiap pengisian memanggil pembacaan
      // berikutnya tanpa akhir.
      const tampakSesudah = await hitungMedanTampak();
      if (tampakSesudah > medanTampak.length) {
        hasilTerap.textContent =
          `${hasilTerap.textContent} Blangko memunculkan ` +
          `${tampakSesudah - medanTampak.length} pilihan baru - dibacakan ulang…`;
        if (kabarAnon) kabarAnon.remove();
        if (otoMenunggu) otoMenunggu.terapJalan = false;
        tombol.click();
        return "lanjut";
      }
      // UI Baru: Simpan tidak ditekan = anonimisasi yang sedang disiapkan
      // tidak dipakai; kabarnya dilepas supaya tidak terbaca sebagai unggahan.
      const lepasAnon = () => {
        if (kabarAnon) kabarAnon.remove();
      };

      // ====================================================================
      // TERSIMPAN, BUKAN SEKADAR TERISI
      // ====================================================================
      //
      // Sampai 1.123.0 ALETA berhenti di sini dan menyuruh petugas menekan
      // Simpan sendiri. Dibuka atas permintaan, dengan dua pagar yang
      // menggantikannya:
      //
      //   1. HANYA BILA SELURUHNYA TERISI. Satu isian gagal berarti borangnya
      //      belum utuh, dan menyimpan borang yang belum utuh menghasilkan
      //      putusan yang salah di berkas perkara yang sungguhan.
      //   2. TERSIMPANNYA DIBUKTIKAN dari SIPP, bukan dari tombol yang
      //      berhasil ditekan - lihat simpanPutusanLaluBuka.
      //
      // Halaman perkaranya dibuka kembali hanya setelah terbukti tersimpan.
      // Memuat ulang lebih awal membuang isian yang belum diterima SIPP.
      if (gagal.length > 0) {
        hasilTerap.textContent += " Simpan TIDAK ditekan selama masih ada yang gagal.";
        lepasAnon();
        return;
      }
      if (raporAgen && raporAgen.hentikan) {
        lepasAnon();
        hasilTerap.textContent +=
          " Simpan TIDAK ditekan: praperiksa menahan dan Anda memilih mengisi sendiri - " +
          "periksa blangkonya, lalu tekan Simpan SIPP sendiri.";
        alatCatat(
          "praperiksa",
          `${nomorPerkara}: diisi meski ditahan (${ringkasHentikan(raporAgen)}) - Simpan diserahkan ke petugas`,
          ""
        );
        return;
      }
      // Medan tambahan satker yang tampak di borang - dicentang atau tidak -
      // menyerahkan Simpan kepada petugas. Syarat Simpan otomatis untuk medan
      // bawaan di atas tidak berubah.
      const medanTambahan = medanTampak.filter((x) => x.tambahan).map((x) => x.label);
      if (medanTambahan.length > 0) {
        hasilTerap.textContent +=
          ` Simpan TIDAK ditekan: blangko memuat medan tambahan satker (${medanTambahan.join(", ")}) - ` +
          "periksa blangkonya, lalu tekan Simpan SIPP sendiri.";
        alatCatat(
          "isi-putusan",
          `${nomorPerkara}: medan tambahan ${medanTambahan.join(", ")} - Simpan diserahkan ke petugas`,
          ""
        );
        lepasAnon();
        return;
      }
      terap.disabled = true;
      // Butir 10 & 19 (Baru & UI Baru): keadaan SEBELUM yang sudah terbaca,
      // jajak cepat sesudah SIPP menjawab tersimpan, dan - bila dicentang -
      // edoc putusan + anonimisasinya DISIAPKAN sebelum Simpan (konfirmasi
      // pemeriksa anonim terjadi di sini, bukan sesudah putusannya tersimpan)
      // lalu diunggah sesudah Simpan TERBUKTI. Lama: panggilan semula.
      let opsiSimpanA30 = null;
      if (opsiAwalA30) {
        hasilTerap.textContent = `${hasilTerap.textContent} Menunggu anonimisasi siap…`;
        opsiSimpanA30 = await opsiAwalA30;
      } else if (a30Nyala && typeof a30OpsiSimpanPutusan === "function") {
        opsiSimpanA30 = await a30OpsiSimpanPutusan({
          nomorPerkara,
          kabar: hasilTerap,
          wadah,
          sebelum: sebelumA30,
          edoc: edocA30,
        });
      }
      // Agen B2 (20 Okt): tanpa berkas pilihan, edoc putusan + anonimisasi dicetak/dibuat SESUDAH
      // Putusan Akhir terbukti tersimpan (blangko ABT memuat tanggal putusan yang baru tersimpan).
      const edocAbt = Boolean(
        a30Nyala &&
          !edocA30 &&
          (otoTentukanEdoc ? opsiOto.edoc === true : !(sekaligus && sekaligus.ada()) && sekaligusAbt && sekaligusAbt.dipakai())
      );
      // Berkas e-Doc dari tombol halaman SIPP: berkas yang dipilih di panelnya; kalau tidak ada, naskah yang
      // barusan dibaca untuk mengisi blangko ini; kalau tidak ada juga, dicetak dari Blangko Derry di ABT.
      const putusanOto = (opsiOto && (opsiOto.putusan || opsiOto.naskah)) || (otoTentukanEdoc && naskahEdoc ? naskahEdoc.asli : null) || null;
      const putusanRtfOto =
        (opsiOto && (opsiOto.putusanRtf || opsiOto.naskahRtf)) || (otoTentukanEdoc && naskahEdoc ? naskahEdoc.rtf : null) || null;
      const tempatB2 = typeof b2SiapkanTempat === "function" ? b2SiapkanTempat(hasilTerap) : { laporan: null, ulang: null };
      if (opsiOto && opsiOto.wadahLaporan) tempatB2.laporan = opsiOto.wadahLaporan;
      // Dari tombol "Putusan Otomatis" di halaman SIPP: kotak muat ulang melayang di halaman (panel tombol itu
      // dapat tergambar ulang saat SIPP menyegarkan isinya), bukan di dalam panel ekstensi.
      const laporanMelayang = Boolean(opsiOto && opsiOto.melayang);
      if (a30Nyala && (edocAbt || edocA30)) {
        opsiSimpanA30 = { sebelum: sebelumA30, jajakCepat: true, ...(opsiSimpanA30 || {}), wadahLaporan: laporanMelayang ? null : tempatB2.laporan };
        if (edocAbt && globalThis.aletaPutusanEdoc) {
          opsiSimpanA30.sesudahTersimpan = (kabarLangkah) =>
            globalThis.aletaPutusanEdoc.jalankan({
              nomorPerkara,
              kabar: kabarLangkah || hasilTerap,
              wadah,
              anonim: anonimPilihan || null,
              // Berkas yang dipilih di panel "Putusan Otomatis" halaman SIPP (putusan-sipp.js); kosong = dicetak dari ABT.
              putusan: putusanOto,
              putusanRtf: putusanRtfOto,
              denganPutusan: !(opsiOto && opsiOto.denganPutusan === false),
              denganAnonim: !(opsiOto && opsiOto.denganAnonim === false),
            });
        }
      }
      // 26 Okt 2026: niat e-Doc dicatat SEBELUM Simpan. Halaman yang dimuat ulang sesudah Putusan Akhir tersimpan
      // mematikan skrip ini sebelum e-Doc terunggah (perkara 615): catatan yang masih ada saat halaman perkara
      // termuat lagi dilanjutkan oleh modul e-Doc. Jalan yang selesai melapor menghapusnya di bawah.
      const modEdocTunda = edocAbt ? globalThis.aletaPutusanEdoc : null;
      if (modEdocTunda && typeof modEdocTunda.catatTertunda === "function") {
        await modEdocTunda
          .catatTertunda({
            nomorPerkara,
            denganPutusan: !(opsiOto && opsiOto.denganPutusan === false),
            denganAnonim: !(opsiOto && opsiOto.denganAnonim === false),
            putusan: putusanOto,
            putusanRtf: putusanRtfOto,
            anonim: anonimPilihan || null,
          })
          .catch(() => false);
      }
      let hasilSimpan;
      try {
        hasilSimpan = opsiSimpanA30
          ? await simpanPutusanLaluBuka(nomorPerkara, hasilTerap, opsiSimpanA30)
          : await simpanPutusanLaluBuka(nomorPerkara, hasilTerap);
      } finally {
        if (modEdocTunda && typeof modEdocTunda.hapusTertunda === "function") await modEdocTunda.hapusTertunda(nomorPerkara).catch(() => false);
      }
      terap.disabled = false;
      hasilTerap.className = hasilSimpan.ok
        ? "aleta-abt-kabar"
        : "aleta-abt-kabar aleta-abt-gagal";
      hasilTerap.textContent = `${berhasil} isian terisi. ${hasilSimpan.bunyi}`;
      // Putusan Akhir sudah tersimpan tetapi edoc belum seluruhnya: ulangi unggah edoc SAJA, satu klik.
      if (a30Nyala && typeof b2PasangUlangEdoc === "function" && hasilSimpan.ok && hasilSimpan.edoc && hasilSimpan.edoc.ok === false) {
        b2PasangUlangEdoc({
          nomorPerkara,
          kabar: hasilTerap,
          wadah,
          tempat: tempatB2,
          putusan: !otoTentukanEdoc && sekaligus && sekaligus.dipakai() && naskahEdoc ? naskahEdoc.asli : putusanOto,
          putusanRtf: !otoTentukanEdoc && sekaligus && sekaligus.dipakai() && naskahEdoc ? naskahEdoc.rtf : putusanRtfOto,
          anonim: anonimPilihan || null,
          perluBerkas: Boolean(hasilSimpan.edoc.perluBerkas),
        });
      }
      return { ok: Boolean(hasilSimpan.ok), tersimpan: Boolean(hasilSimpan.ok), bunyi: hasilSimpan.bunyi, edoc: hasilSimpan.edoc || null };
        })();
      } catch (galat) {
        h = { ok: false, tahap: "isi", pesan: String((galat && galat.message) || galat) };
      } finally {
        await kunci.lepas();
      }
      if (h === "lanjut") return;
      terap.disabled = false;
      selesaiOto(h && typeof h === "object" ? h : { ok: false, tahap: "isi", pesan: String(hasilTerap.textContent || "Pengisian berhenti sebelum Simpan.") });
    });

    // Tombol "Putusan Otomatis": usulan sudah terbaca -> Isikan ditekan sendiri (yang menahan tetap menahan).
    // Sekali per putaran: bila Isikan alur ini sedang berjalan, pembacaan ini bukan miliknya.
    if (otoMenunggu && !otoMenunggu.terapJalan) {
      if (terap.disabled) {
        selesaiOto({
          ok: false,
          tahap: "praperiksa",
          pesan: `Praperiksa menahan: ${(typeof ringkasHentikan === "function" && ringkasHentikan(raporAgen)) || "ada pertentangan dengan fakta SIPP"}. Periksa di bagian Putusan otomatis panel, lalu tekan Isikan sendiri.`,
        });
      } else {
        setTimeout(() => terap.click(), 0);
      }
    }

    tombol.disabled = false;
  });

  // Pintu untuk putusan-sipp.js: menjalankan alur yang SAMA dengan menekan tombol-tombol di atas.
  kotak.otomatis = async (opsi) => {
    if (otoMenunggu) return { ok: false, tahap: "sibuk", pesan: "Putusan otomatis perkara ini sedang berjalan." };
    // Draf yang dimuat sendiri saat blangko dibuka (s1PasangPutusanOtomatis) selesai dulu.
    const mulai = Date.now();
    while (tombol.disabled && Date.now() - mulai < 20000) await new Promise((r) => setTimeout(r, 100));
    if (tombol.disabled) return { ok: false, tahap: "sibuk", pesan: "Bagian Putusan otomatis masih bekerja - tunggu sampai selesai, lalu ulangi." };
    if (otoMenunggu) return { ok: false, tahap: "sibuk", pesan: "Putusan otomatis perkara ini sedang berjalan." };
    const o = opsi || {};
    return new Promise((resolve) => {
      otoMenunggu = { resolve, opsi: o, terapJalan: false };
      // Penanda bagi muat-draf-sendiri UI Baru (s1PasangPutusanOtomatis): jangan menekan "Ambil usulan" lagi.
      kotak.setAttribute("data-oto-jalan", "1");
      // 21 Okt 2026: berkas putusan yang dipilih di panel halaman SIPP MENJADI sumber isian (sama dengan
      // "Ambil dari naskah putusan" di bagian ini): dibaca portal menjadi draf, lalu usulan -> praperiksa ->
      // Isikan -> Simpan. Dulu berkas itu hanya dipakai untuk e-Doc, sehingga perkara tanpa draf ALETA
      // berhenti di "Belum ada draf" sesudah blangko terbuka dan tidak ada yang terisi.
      if (o.naskah) {
        void prosesNaskah(o.naskah, o.naskahRtf || null)
          .then((h) => {
            if (h && h.ok === false) selesaiOto({ ok: false, tahap: "naskah", pesan: h.pesan });
          })
          .catch((galat) => selesaiOto({ ok: false, tahap: "naskah", pesan: String((galat && galat.message) || galat) }));
        return;
      }
      tombol.click();
    });
  };

  // Perbaikan 1 Okt (S, butir 2/3/4) - UI Baru saja; Lama dan Baru tidak
  // memanggilnya (s1PasangPutusanOtomatis memeriksa tampilannya sendiri).
  if (typeof s1PasangPutusanOtomatis === "function") {
    s1PasangPutusanOtomatis({
      kotak,
      nomorPerkara,
      tombol,
      prosesNaskah,
      kotakUnggah,
      sekaligus,
      setelAnonim: (berkas) => {
        anonimPilihan = berkas || null;
      },
    });
  }
  return kotak;
}

/** Nilai terpilih yang dikirim ke portal: nilai bawaan borang SIPP bukan pilihan. */
function nilaiTerpilihBukanBawaan(penunjuk, terpilih) {
  return terpilih !== undefined && NILAI_BAWAAN_BORANG[penunjuk] === terpilih ? undefined : terpilih;
}

/**
 * ============================================================================
 * RIWAYAT ALETA - APA SAJA YANG PERNAH DIKERJAKAN ALETA PADA PERKARA INI
 * ============================================================================
 *
 * Sampai 1.105.0 pertanyaan itu dijawab dari layar Audit Trail SIPP: tiap
 * baris yang ditulis ALETA diakhiri "[ALETA] diisikan operator <nama>".
 *
 * Tempatnya keliru. sys_audittrail catatan milik SIPP, dibaca petugas SIPP,
 * dan tidak ada satu pun baris SIPP yang menyebut alat yang dipakai
 * mengetiknya - sehingga baris ALETA menonjol sebagai sesuatu yang
 * disisipkan. Sejak 1.106.0 basis data SIPP tidak memuat satu kata pun
 * tentang ALETA.
 *
 * Riwayatnya pindah ke sini, dan justru menjadi lebih lengkap:
 *
 *   - percobaan yang DITOLAK ikut tercatat beserta sebabnya; di sys_audittrail
 *     yang gagal tidak pernah meninggalkan jejak sama sekali,
 *   - tabel apa saja yang disentuh tiap langkah tercatat utuh,
 *   - akun SIPP dan operator ALETA tercatat berdampingan - dua orang yang
 *     belum tentu sama, dan perbedaannya justru yang dicari bila kelak ada
 *     yang bertanya.
 *
 * Dimuat saat dibuka, bukan saat panel digambar: yang membuka panel belum
 * tentu sedang mencari riwayat, dan satu panggilan per perkara yang dilihat
 * sekilas adalah ongkos yang tidak perlu.
 */
function bagianRiwayatAleta(nomorPerkara) {
  const kotak = bagian("Riwayat ALETA", "riwayatAleta", true);
  let sudahDimuat = false;

  const kepala = kotak.querySelector(".aleta-bagian-judul");
  const muatBagian = () => {
    const isi = kotak.isi;
    if (sudahDimuat || isi.style.display === "none") return;
    sudahDimuat = true;

    isi.appendChild(buatElemen("div", "aleta-memuat", "Membaca riwayat ALETA…"));
    void (async () => {
      let hasil = null;
      try {
        const respons = await alatAmbil(
          `${ALETA_API_RIWAYAT}?nomorPerkara=${encodeURIComponent(nomorPerkara)}&batas=30`,
          { credentials: "include", cache: "no-store" },
          "riwayat ALETA"
        );
        if (!respons.ok) {
          isi.textContent = "";
          isi.appendChild(
            buatElemen("div", "aleta-gagal", await pesanGalat(respons))
          );
          sudahDimuat = false;
          return;
        }
        hasil = await respons.json();
      } catch (galat) {
        isi.textContent = "";
        isi.appendChild(buatElemen("div", "aleta-gagal", String(galat.message || galat)));
        sudahDimuat = false;
        return;
      }

      isi.textContent = "";
      const baris = (hasil && Array.isArray(hasil.baris) && hasil.baris) || [];
      if (baris.length === 0) {
        isi.appendChild(
          buatElemen(
            "div",
            "aleta-kosong",
            "ALETA belum pernah menulis apa pun pada perkara ini."
          )
        );
        return;
      }

      const NAMA_JENIS = {
        pmh: "Penetapan Majelis Hakim",
        ppp: "Penunjukan Panitera Pengganti",
        pjs: "Penunjukan Juru Sita",
        phs: "Penetapan Hari Sidang",
        dataUmum: "Isian Data Umum",
      };

      for (const jejak of baris) {
        const kotakBaris = buatElemen("div", "aleta-baris");

        const judul = jejak.aksi === "hapus" ? "Dibatalkan" : "Ditulis";
        kotakBaris.appendChild(
          buatElemen(
            "div",
            "aleta-baris-judul",
            `${judul} — ${NAMA_JENIS[jejak.jenis] || jejak.jenis || "tidak disebut"}`
          )
        );

        // Waktunya menurut jam pembacanya sendiri. Menyebut zona waktu di
        // panel selebar tiga ratus piksel hanya menambah satu hal yang harus
        // dibaca tanpa pernah menjawab pertanyaan siapa pun.
        const waktu = jejak.waktu ? new Date(jejak.waktu) : null;
        const waktuTerbaca =
          waktu && !Number.isNaN(waktu.getTime()) ? waktu.toLocaleString("id-ID") : "";

        const bagianKet = [];
        if (waktuTerbaca) bagianKet.push(waktuTerbaca);
        // Nama pejabatnya lebih dahulu, nama akunnya di dalam kurung: yang
        // membaca riwayat mencari orangnya, bukan akunnya - tetapi akun itu
        // yang tercatat di sys_audittrail, jadi keduanya harus dapat
        // dipertemukan bila kelak ada yang membandingkan.
        const pejabat = jejak.namaPejabat || jejak.akunSipp;
        if (pejabat) {
          bagianKet.push(
            jejak.namaPejabat && jejak.akunSipp
              ? `atas nama ${jejak.namaPejabat} (${jejak.akunSipp})`
              : `atas nama ${pejabat}`
          );
        }
        if (jejak.operator) bagianKet.push(`operator ${jejak.operator}`);
        kotakBaris.appendChild(
          buatElemen("div", "aleta-baris-ket", bagianKet.join(" · "))
        );

        // Yang gagal ditulis TEGAS, bukan diselipkan. Baris yang terbaca
        // seperti baris berhasil padahal gagal justru menyesatkan lebih jauh
        // daripada tidak ada barisnya sama sekali.
        if (!jejak.berhasil) {
          kotakBaris.appendChild(
            buatElemen(
              "div",
              "aleta-baris-ket aleta-lencana-lewat",
              `tidak jadi — ${jejak.alasan || "sebabnya tidak tercatat"}`
            )
          );
        } else if (Array.isArray(jejak.tabel) && jejak.tabel.length) {
          kotakBaris.appendChild(
            buatElemen(
              "div",
              "aleta-baris-ket",
              `${jejak.jumlahLangkah} langkah · ${jejak.tabel.join(", ")}`
            )
          );
        }

        isi.appendChild(kotakBaris);
      }

      isi.appendChild(
        buatElemen(
          "div",
          "aleta-kosong-lembut",
          "Tercatat di basis data ALETA. Basis data SIPP tidak memuat keterangan apa pun tentang ALETA."
        )
      );
    })();
  };

  if (kepala) kepala.addEventListener("click", muatBagian);
  setTimeout(muatBagian, 0);
  return kotak;
}

/**
 * ============================================================================
 * PETA KOLOM YANG MENGUSULKAN DIRINYA SENDIRI
 * ============================================================================
 *
 * Peta kolom formulir diisi tangan, sekali pasang: penunjuk tiap kolom SIPP
 * dibaca dari menu ini lalu disalin ke Pengaturan. Dua hal membuatnya
 * mahal. Pertama, yang menyalin harus tahu kolom mana yang berpadanan
 * dengan medan ALETA yang mana - dan nama kolom SIPP tidak selalu
 * menjelaskan dirinya. Kedua, peta itu usang diam-diam begitu SIPP berganti
 * versi dan penunjuknya bergeser.
 *
 * Yang dikerjakan di sini: mencocokkan ISI kolom di halaman dengan nilai
 * yang memang diusulkan ALETA untuk perkara ini. Kolom yang berisi nama
 * juru sita yang diusulkan ALETA hampir pasti kolom juru sita - dan itu
 * dugaan yang dapat diperiksa, bukan tebakan dari nama kolom.
 *
 * ============================================================================
 * MENGUSULKAN, TIDAK PERNAH MEMASANG
 * ============================================================================
 *
 * Peta yang keliru mengisi kolom yang salah pada formulir yang sungguhan.
 * Karena itu yang dihasilkan menu ini USULAN yang disalin manusia ke
 * Pengaturan - bukan peta yang dipasang sendiri. Perbedaannya kecil di
 * layar dan besar akibatnya: yang menyalin membaca dahulu.
 */
function bakuNilai(nilai) {
  return String(nilai || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    // Gelar dan tanda bacanya dibuang: SIPP menuliskan "Idris, S.H.I., M.H."
    // sedangkan kolomnya kerap hanya berisi "Idris".
    .replace(/[.,]/g, "")
    .trim();
}

/** Tanggal apa pun bentuknya menjadi YYYY-MM-DD, supaya dapat diadu. */
function tanggalBaku(teks) {
  const isi = String(teks || "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(isi);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const lokal = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(isi);
  if (lokal) {
    const dua = (n) => String(n).padStart(2, "0");
    return `${lokal[3]}-${dua(lokal[2])}-${dua(lokal[1])}`;
  }
  return "";
}

/** Nilai yang diketahui ALETA untuk perkara ini, beserta nama medannya. */
function nilaiDikenal(usulan) {
  const dikenal = [];
  if (!usulan) return dikenal;

  const pmh = usulan.pmh || {};
  (pmh.anggota || []).forEach((orang, urutan) => {
    if (orang && orang.nama) {
      dikenal.push({
        medan: urutan === 0 ? "hakim_ketua" : `hakim_anggota${urutan}`,
        nilai: orang.nama,
      });
    }
  });

  const ppp = (usulan.ppp && usulan.ppp.usulan) || null;
  if (ppp && ppp.nama) dikenal.push({ medan: "panitera_pengganti", nilai: ppp.nama });

  const pjs = (usulan.pjs && usulan.pjs.usulan) || null;
  if (pjs && pjs.nama) dikenal.push({ medan: "jurusita", nilai: pjs.nama });

  const sidang = (usulan.phs && usulan.phs.usulan) || "";
  if (sidang) dikenal.push({ medan: "tanggal_sidang", nilai: sidang, tanggal: true });

  if (usulan.tanggalPenetapan) {
    dikenal.push({ medan: "tanggal_penetapan", nilai: usulan.tanggalPenetapan, tanggal: true });
  }

  return dikenal;
}

/**
 * Kolom halaman mana yang isinya berpadanan dengan nilai yang dikenal.
 *
 * Satu medan hanya diusulkan SEKALI - pada padanan pertamanya. Halaman SIPP
 * kerap memuat nama yang sama di dua tempat (kolom isian dan kolom bacaan
 * di sebelahnya), dan mengusulkan keduanya berarti menyerahkan pilihan
 * kepada yang menyalin tanpa memberinya dasar memilih.
 */
function usulkanPetaKolom(usulan, medanHalaman) {
  const dikenal = nilaiDikenal(usulan);
  if (dikenal.length === 0) return [];

  const sudah = new Set();
  const hasil = [];

  for (const kolom of medanHalaman || []) {
    if (!kolom || !kolom.penunjuk) continue;
    const isiKolom = String(kolom.nilai || "").trim();
    if (!isiKolom) continue;

    for (const calon of dikenal) {
      if (sudah.has(calon.medan)) continue;

      const cocok = calon.tanggal
        ? tanggalBaku(isiKolom) !== "" && tanggalBaku(isiKolom) === tanggalBaku(calon.nilai)
        : bakuNilai(isiKolom) === bakuNilai(calon.nilai);
      if (!cocok) continue;

      sudah.add(calon.medan);
      hasil.push({
        medan: calon.medan,
        penunjuk: kolom.penunjuk,
        jenisMedan: kolom.ckeditor ? "kaya" : kolom.select2 || kolom.tag === "select" ? "pilih" : calon.tanggal ? "tanggal" : "teks",
        contoh: isiKolom.slice(0, 60),
        label: kolom.label || kolom.nama || kolom.id || "",
      });
      break;
    }
  }

  return hasil;
}

function bagianBacaBorang() {
  const kotak = bagian("Peta kolom formulir (sekali pasang)", "bacaBorang", true);
  let sudahDimuat = false;

  const kepala = kotak.querySelector(".aleta-bagian-judul");
  const muatBagian = () => {
    const isi = kotak.isi;
    if (sudahDimuat || isi.style.display === "none") return;
    sudahDimuat = true;

    isi.appendChild(buatElemen("div", "aleta-memuat", "Membaca halaman…"));
    void (async () => {
      const jawab = await kirimKeJembatan({ jenis: "baca" });
      isi.textContent = "";

      if (!jawab.ok) {
        isi.appendChild(
          buatElemen("div", "aleta-gagal", jawab.alasan || "Halaman tidak dapat dibaca.")
        );
        sudahDimuat = false;
        return;
      }

      const berpenunjuk = (jawab.medan || []).filter((x) => x.penunjuk);
      if (berpenunjuk.length === 0) {
        isi.appendChild(
          buatElemen("div", "aleta-kosong", "Tidak ada kolom isian di halaman ini.")
        );
        return;
      }

      // ====================================================================
      // ALAT PEMASANGAN, BUKAN PENAMPIL DATA
      // ====================================================================
      //
      // Yang tergambar di sini PENUNJUK kolom - #ijin_cerai_pihak1 dan
      // sejenisnya - bukan isinya. Tanpa keterangan itu, daftarnya terbaca
      // sebagai fitur yang gagal mengambil data, dan yang membacanya
      // menyimpulkan ALETA tidak dapat membaca SIPP.
      //
      // Gunanya sekali pasang: penunjuk ini disalin ke Pengaturan - Peta kolom
      // formulir, dan peta itulah yang kemudian dipakai tombol Kerjakan
      // mengisi formulir sendiri. Sesudah petanya lengkap, menu ini tidak
      // perlu dibuka lagi.
      isi.appendChild(
        buatElemen(
          "div",
          "aleta-tetap-sebab aleta-remeh",
          "Ini alat PEMASANGAN, bukan penampil data. Yang tercantum di bawah adalah " +
            "penunjuk kolom di halaman ini - bukan isinya."
        )
      );
      isi.appendChild(
        buatElemen(
          "div",
          "aleta-tetap-sebab aleta-remeh",
          `${berpenunjuk.length} kolom terbaca. Salin penunjuknya ke Pengaturan - Peta kolom ` +
            "formulir. Sesudah petanya lengkap, tombol Kerjakan dapat mengisi formulir ini " +
            "sendiri, dan menu ini tidak perlu dibuka lagi."
        )
      );

      // Usulan peta lebih dahulu, daftar mentahnya di bawah. Yang sedang
      // memasang membaca yang pertama; yang mencari kolom yang belum
      // terpetakan membaca yang kedua.
      const usulanPeta = usulkanPetaKolom(usulanTerakhir, jawab.medan || []);
      if (usulanPeta.length > 0) {
        const kotakUsulan = buatElemen("div", "aleta-peta-usulan");
        kotakUsulan.appendChild(
          buatElemen(
            "div",
            "aleta-tulis-judul",
            `${usulanPeta.length} kolom berisi nilai yang memang diusulkan ALETA untuk perkara ini`
          )
        );
        kotakUsulan.appendChild(
          buatElemen(
            "div",
            "aleta-tetap-sebab",
            "Dugaan dari ISI kolomnya, bukan dari namanya. Periksa dahulu, lalu salin ke Pengaturan - Peta kolom formulir. ALETA tidak memasangnya sendiri."
          )
        );
        for (const u of usulanPeta) {
          kotakUsulan.appendChild(
            barisPenetapan(
              u.medan,
              u.penunjuk,
              `${u.jenisMedan} · berisi "${u.contoh}"${u.label ? ` · ${u.label}` : ""}`,
              ""
            )
          );
        }
        kotakUsulan.appendChild(
          tombolSalin(
            JSON.stringify(
              usulanPeta.map((u) => ({ medan: u.medan, penunjuk: u.penunjuk, jenisMedan: u.jenisMedan })),
              null,
              2
            ),
            "Salin usulan peta kolom"
          )
        );
        isi.appendChild(kotakUsulan);
      }

      for (const kolom of berpenunjuk.slice(0, 120)) {
        const petunjukJenis = kolom.ckeditor
          ? "kaya"
          : kolom.select2 || kolom.tag === "select"
            ? "pilih"
            : "teks";
        isi.appendChild(
          barisPenetapan(
            petunjukJenis,
            kolom.penunjuk,
            kolom.label || `${kolom.tag} ${kolom.nama || kolom.id}`,
            ""
          )
        );
      }
    })();
  };

  kepala.addEventListener("click", muatBagian);

  // Dimuat juga ketika bagiannya SUDAH terbentang dari sesi sebelumnya.
  //
  // Keadaan lipatan disimpan antar-sesi. Bila tersimpan sebagai TERBUKA,
  // bagian ini tergambar terbentang tetapi kosong - dan baru terisi sesudah
  // ditekan DUA kali: sekali menutup, sekali membuka. Terbaca sebagai menu
  // yang rusak, padahal hanya pemuatnya yang tidak pernah dipanggil.
  if (kotak.isi.style.display !== "none") {
    setTimeout(muatBagian, 0);
  }

  return kotak;
}

/**
 * ============================================================================
 * BAGIAN "PENETAPAN YANG DAPAT ANDA TETAPKAN" DIBUANG
 * ============================================================================
 *
 * Bagian itu mencocokkan nama pengguna SIPP yang sedang masuk dengan pejabat
 * yang berwenang menandatangani tiap penetapan, lalu menyebutkan mana yang
 * "urusan Anda". Dasarnya satu anggapan: tiap pejabat membuka SIPP dengan
 * akunnya sendiri, sehingga yang tercatat sebagai pengisi adalah dia.
 *
 * Anggapan itu sudah tidak berlaku. Sejak ALETA menuliskan penetapan atas nama
 * pejabatnya - keputusan pimpinan pengadilan ini - siapa yang sedang membuka
 * SIPP tidak lagi menentukan apa pun. Operator yang mengerjakan, dan nama
 * pejabatnya tetap yang tercatat.
 *
 * Karena itu pertanyaannya berganti, dan bagiannya ikut berganti:
 *
 *   dulu   "boleh tidak saya mengerjakan ini?"
 *   kini   "kalau saya tekan sekarang, tercatat atas nama siapa?"
 *
 * Pertanyaan kedua dijawab keterangan penetap pada tiap baris penetapan, yang
 * ikut berubah ketika pejabatnya diganti pada "Pejabat yang menetapkan".
 * (Kotak ringkasan "Akan tercatat di SIPP atas..." yang dahulu berdiri di atas
 * tombol Kerjakan sudah dicabut: ia membaca pilihan bawaan mesin, sehingga
 * dapat menyebut nama yang BUKAN yang akan ditulis.)
 * Mempertahankan bagian lamanya berarti menyimpan
 * satu kotak yang menanyakan hal yang tidak lagi menentukan - dan yang paling
 * merugikan, ia terbaca seperti gerbang izin padahal tidak pernah menahan apa
 * pun sekali pun.
 *
 * Antrean PENERUSAN ikut terbawa keluar. Ia menjawab "ada pekerjaan menunggu
 * saya di perkara lain", dan itu berguna - tetapi seluruh alurnya bersandar
 * pada seseorang menekan "teruskan" kepada pejabat, yang justru tidak lagi
 * diperlukan. Rutenya dibiarkan hidup di server; yang dibuang hanya
 * gambarannya di sini.
 */

/** Papan penunjukan, dimuat hanya ketika menunya dibuka. */
function bagianPenunjukan(nomor) {
  const kotak = bagian("Penetapan dan Penunjukan Perkara", "penunjukan", true);
  let sudahDimuat = false;

  const kepala = kotak.querySelector(".aleta-bagian-judul");
  const muatBagian = () => {
    const isi = kotak.isi;
    if (sudahDimuat || isi.style.display === "none") return;
    sudahDimuat = true;

    isi.appendChild(buatElemen("div", "aleta-memuat", "Menyusun usulan…"));
    void (async () => {
      try {
        const data = await ambilUsulanPenunjukan(nomor);
        // Nomor perkaranya ikut disimpan: pemuat ulang usulan (ganti majelis)
        // membutuhkannya, dan bentuk usulan bukan tempat yang aman untuk
        // bergantung.
        data.nomorPerkara = nomor;
        // Disimpan supaya menu Peta kolom formulir dapat mencocokkan isi
        // kolom di halaman dengan nilai yang memang diusulkan ALETA - lihat
        // usulkanPetaKolom. Hanya dibaca; tidak ada yang menulisinya lagi.
        usulanTerakhir = data;
        isi.textContent = "";
        gambarPenunjukan(isi, data);
      } catch (galat) {
        isi.textContent = "";
        isi.appendChild(
          buatElemen("div", "aleta-gagal", String(galat.message || galat).slice(0, 200))
        );
        // Boleh dicoba lagi: tutup lalu buka kembali menunya.
        sudahDimuat = false;
      }
    })();
  };

  kepala.addEventListener("click", muatBagian);

  // Dimuat juga ketika bagiannya SUDAH terbentang dari sesi sebelumnya.
  //
  // Keadaan lipatan disimpan antar-sesi. Bila tersimpan sebagai TERBUKA,
  // bagian ini tergambar terbentang tetapi kosong - dan baru terisi sesudah
  // ditekan DUA kali: sekali menutup, sekali membuka. Terbaca sebagai menu
  // yang rusak, padahal hanya pemuatnya yang tidak pernah dipanggil.
  if (kotak.isi.style.display !== "none") {
    setTimeout(muatBagian, 0);
  }

  return kotak;
}

/**
 * Borang mana yang sedang terbuka di halaman ini.
 *
 * ============================================================================
 * DITENTUKAN DARI KOLOMNYA, BUKAN DARI ALAMAT HALAMAN
 * ============================================================================
 *
 * Nama halaman SIPP berbeda-beda antar jenis perkara dan antar versi - persis
 * seperti detil_perkara_agama dan detil_perkara yang sudah lebih dulu memaksa
 * pengenalan panel memakai isi halaman, bukan alamatnya.
 *
 * Yang dipakai di sini: formulir yang SELURUH kolom wajibnya ada di halaman ini.
 * Kalau tidak ada satu pun yang cocok, tidak ada yang diisi - lebih baik
 * tombol yang diam daripada tombol yang mengisi formulir yang salah.
 */
async function borangSedangTerbuka(petaKolom) {
  const jawab = await kirimKeJembatan({ jenis: "baca" });
  if (!jawab.ok) return { formulir: "", alasan: jawab.alasan || "formulir_tidak_terbaca", medanHalaman: [] };

  const adaDiHalaman = new Set();
  for (const kolom of jawab.medan || []) {
    if (kolom.penunjuk) adaDiHalaman.add(kolom.penunjuk);
  }

  const perBorang = new Map();
  for (const kolom of petaKolom) {
    if (!perBorang.has(kolom.borang)) perBorang.set(kolom.borang, []);
    perBorang.get(kolom.borang).push(kolom);
  }

  for (const [formulir, daftar] of perBorang) {
    const wajib = daftar.filter((x) => x.wajib);
    const diperiksa = wajib.length > 0 ? wajib : daftar;
    if (diperiksa.length === 0) continue;
    if (diperiksa.every((x) => adaDiHalaman.has(x.penunjuk))) {
      return { formulir, alasan: "", medanHalaman: jawab.medan || [] };
    }
  }

  return { formulir: "", alasan: "tidak_ada_formulir_yang_cocok", medanHalaman: jawab.medan || [] };
}

/** Satu baris keterangan: nama di kiri, nilainya di kanan. */
function barisNilai(nama, nilai, nada = "") {
  const baris = buatElemen("div", `aleta-nilai${nada ? ` aleta-${nada}` : ""}`);
  baris.appendChild(buatElemen("span", "aleta-nilai-nama", nama));
  baris.appendChild(buatElemen("span", "aleta-nilai-isi", nilai));
  return baris;
}

/** Tahapan perkara beserta ketepatan waktu penginputannya. */
/**
 * ============================================================================
 * LENCANA TIAP MENU
 * ============================================================================
 *
 * Sebelumnya kedua belas menu berbentuk sama persis, entah di baliknya ada
 * masalah atau tidak ada apa-apa. Membaca panel berarti membukanya satu per
 * satu untuk mencari tahu - dua belas kali, tiap perkara.
 *
 * Lencana ini menjawabnya sebelum dibuka. Sumbernya SATU panggilan yang sama
 * dengan yang dipakai kelima menu itu sendiri, dan hasilnya memang sudah
 * disimpan per nomor perkara - jadi tidak ada kueri tambahan sama sekali.
 *
 * Yang dikembalikan { teks, nada } per kunci menu. nada mengikuti kelas yang
 * sudah ada: lewat (merah), mendesak (kuning), aman (hijau), netral (abu).
 */
/**
 * Memasang lencana pada satu menu.
 *
 * Aman dipanggil pada menu yang tidak ada - panggilan latar boleh selesai
 * sesudah panelnya ditutup atau digambar ulang, dan melempar galat di situ
 * hanya akan mematikan sisa pemasangan lencana yang lain.
 */
function setLencana(kotak, ringkas) {
  if (!kotak || !kotak.lencana || !ringkas || !ringkas.teks) return;
  kotak.lencana.textContent = ringkas.teks;
  kotak.lencana.className = `aleta-bagian-lencana aleta-lencana-${ringkas.nada || "netral"}`;
}
const CC_LIBUR_TAHUN_LENGKAP = ["2026", "2027"];

/** Pendaftaran -> sidang pertama (median terukur, lihat di atas) bila PHS belum ada. */
const CC_HARI_DAFTAR = {
  "cerai-gugat": 13,
  "cerai-talak": 13,
  gugatan: 13,
  itsbat: 21,
  dispensasi: 10,
  permohonan: 12,
  sederhana: 13,
};

/** Jarak (hari kalender) dari sidang sebelumnya - median terukur, kecuali laporanMediasi (aturan tunda 21). */
const CC_HARI = {
  pokok: 14,
  laporanMediasi: 21,
  jawaban: 3,
  replik: 4,
  duplik: 3,
  pembuktianPertama: 5,
  pembuktianKedua: 7,
  kesimpulan: 2,
  putusan: 6,
  verstek: 14,
  damai: 7,
  ikrar: 35,
  langkahPermohonan: 7,
  // PERMA 2/2015 jo. 4/2019: gugatan sederhana selesai paling lama 25 hari
  // kerja sejak sidang pertama - tiga langkah sepekan muat di dalamnya.
  langkahSederhana: 7,
};

const CC_JAM_PAGI = "09:00";
const CC_JAM_SORE = "15:00";
/** Sama dengan TAHAP_SORE di @/lib/bawaan-tunda. */
const CC_TAHAP_SORE = ["jawaban", "replik", "duplik", "kesimpulan"];

/** Urutan tahap acara gugatan - yang lebih jauh tidak direncanakan ulang. */
const CC_URUT = {
  lain: 0,
  pertama: 0,
  mediasi: 1,
  "laporan-mediasi": 2,
  pokok: 2,
  jawaban: 3,
  replik: 4,
  duplik: 5,
  "pembuktian-pertama": 6,
  "pembuktian-kedua": 7,
  kesimpulan: 8,
  putusan: 9,
  ikrar: 10,
};

const CC_NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const CC_NAMA_BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function ccTambahHari(iso, hari) {
  if (!ccIsoSah(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + hari)).toISOString().slice(0, 10);
}

/** Maju ke hari kerja pertama pada atau sesudah iso. */
function ccMajuHariKerja(iso) {
  let t = iso;
  for (let i = 0; i < 30 && t && ccBukanHariKerja(t); i += 1) t = ccTambahHari(t, 1);
  return t;
}

/** "Selasa, 13 Okt 2026". */
function ccTeksTanggal(iso) {
  if (!ccIsoSah(iso)) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  return `${CC_NAMA_HARI[ccHariKe(iso)]}, ${String(d).padStart(2, "0")} ${CC_NAMA_BULAN[m - 1]} ${y}`;
}

/** Bentuk tanggal blangko SIPP: dd/mm/yyyy. */
function ccTanggalSipp(iso) {
  if (!ccIsoSah(iso)) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function ccJamSah(jam) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(jam || ""));
}

/**
 * Golongan perkara. Bentuk nomor (Pdt.G / Pdt.P / Pdt.G.S) menentukan alurnya,
 * jenisnya dari nama jenis perkara SIPP ("Istbat", bukan "itsbat" - lihat
 * @/lib/sebutan-pihak).
 */
function ccGolongan(jenis, nomor) {
  const j = String(jenis || "").toLowerCase();
  const n = String(nomor || "");
  if (/\/Pdt\.G\.S\//i.test(n)) return "sederhana";
  if (/\/Pdt\.P\//i.test(n)) {
    if (/istbat|itsbat|isbat|pengesahan perkawinan/.test(j)) return "itsbat";
    if (/dispensasi/.test(j)) return "dispensasi";
    return "permohonan";
  }
  if (/cerai talak/.test(j)) return "cerai-talak";
  if (/cerai gugat/.test(j)) return "cerai-gugat";
  return "gugatan";
}

/** Sebutan pihak - aturan #0046#/#0047# ABT: alur permohonan, cerai talak (346), izin poligami (341) = Pemohon. */
function ccSebutan(golongan, jenis) {
  if (golongan === "itsbat" || golongan === "dispensasi" || golongan === "permohonan") return { satu: "Pemohon", dua: "" };
  if (golongan === "cerai-talak" || /izin poligami/i.test(String(jenis || ""))) return { satu: "Pemohon", dua: "Termohon" };
  return { satu: "Penggugat", dua: "Tergugat" };
}

/** Tahap acara menurut kalimat agenda - kata kunci, sebab agenda SIPP ditulis bebas. Yang terjauh menang. */
function ccTahap(agenda) {
  const t = String(agenda || "").toLowerCase();
  if (/ikrar/.test(t)) return "ikrar";
  if (/musyawarah|putus|penetapan/.test(t)) return "putusan";
  if (/kesimpulan/.test(t)) return "kesimpulan";
  if (/duplik/.test(t)) return "duplik";
  if (/replik/.test(t)) return "replik";
  if (/jawab/.test(t)) return "jawaban";
  if (/pembuktian|bukti|saksi/.test(t)) return /tergugat|termohon|pihak kedua/.test(t) ? "pembuktian-kedua" : "pembuktian-pertama";
  if (/laporan (hasil )?mediasi|hasil mediasi/.test(t)) return "laporan-mediasi";
  if (/mediasi|damai/.test(t)) return "mediasi";
  if (/pembacaan (surat )?(gugatan|permohonan)|pokok perkara/.test(t)) return "pokok";
  if (/identitas|pertama|panggil|penasihatan|penasehatan/.test(t)) return "pertama";
  return "lain";
}

/** Rantai acara per jalur. hari = jarak dari langkah sebelumnya. */
function ccRantai(jalur, golongan, s) {
  const satu = s.satu;
  const dua = s.dua || "Tergugat";
  const pertama = { tahap: "pertama", agenda: "Sidang Pertama, Pemeriksaan Identitas, Penasihatan", hari: 0 };
  const ikrar = golongan === "cerai-talak" ? [{ tahap: "ikrar", agenda: "Sidang Ikrar Talak", hari: CC_HARI.ikrar }] : [];
  if (jalur === "awal") return [pertama, { tahap: "pokok", agenda: "Pemeriksaan Pokok Perkara", hari: CC_HARI.pokok }];
  if (jalur === "verstek") {
    return [
      pertama,
      { tahap: "putusan", agenda: `Pembacaan Gugatan, Pembuktian ${satu}, Musyawarah Majelis dan Pembacaan Putusan`, hari: CC_HARI.verstek },
      ...ikrar,
    ];
  }
  if (jalur === "damai") {
    return [pertama, { tahap: "putusan", agenda: "Musyawarah Majelis dan Pembacaan Putusan", hari: CC_HARI.damai, ket: "mediasi berhasil" }];
  }
  if (jalur === "litigasi") {
    return [
      pertama,
      { tahap: "laporan-mediasi", agenda: "Mendengar Laporan Hasil Mediasi", hari: CC_HARI.laporanMediasi },
      { tahap: "jawaban", agenda: `Jawaban ${dua}`, hari: CC_HARI.jawaban, elitigasi: true },
      { tahap: "replik", agenda: `Replik ${satu}`, hari: CC_HARI.replik, elitigasi: true },
      { tahap: "duplik", agenda: `Duplik ${dua}`, hari: CC_HARI.duplik, elitigasi: true },
      { tahap: "pembuktian-pertama", agenda: `Pembuktian ${satu}`, hari: CC_HARI.pembuktianPertama },
      { tahap: "pembuktian-kedua", agenda: `Pembuktian ${dua}`, hari: CC_HARI.pembuktianKedua },
      { tahap: "kesimpulan", agenda: `Kesimpulan ${satu} dan ${dua}`, hari: CC_HARI.kesimpulan, elitigasi: true },
      { tahap: "putusan", agenda: "Musyawarah Majelis dan Pembacaan Putusan", hari: CC_HARI.putusan, elitigasi: true },
      ...ikrar,
    ];
  }
  if (jalur === "itsbat-awal") {
    return [{ tahap: "putusan", agenda: "Sidang Pertama, Pemeriksaan Identitas, Pembacaan Permohonan, Pembuktian dan Pembacaan Penetapan", hari: 0 }];
  }
  if (jalur === "itsbat") {
    return [
      { tahap: "pertama", agenda: "Sidang Pertama, Pemeriksaan Identitas dan Pembacaan Permohonan", hari: 0 },
      { tahap: "putusan", agenda: `Pembuktian ${satu}, Kesimpulan dan Pembacaan Penetapan`, hari: CC_HARI.langkahPermohonan },
    ];
  }
  if (jalur === "dispensasi") {
    return [
      { tahap: "pembuktian-pertama", agenda: "Sidang Pertama, Pemeriksaan Identitas, Penasihatan, Pemeriksaan Pokok Perkara dan Pembuktian", hari: 0 },
      { tahap: "putusan", agenda: "Musyawarah Majelis dan Pembacaan Penetapan", hari: CC_HARI.langkahPermohonan },
    ];
  }
  if (jalur === "permohonan") {
    return [
      { tahap: "pertama", agenda: "Sidang Pertama, Pemeriksaan Identitas dan Pembacaan Permohonan", hari: 0 },
      { tahap: "pembuktian-pertama", agenda: `Pembuktian ${satu}`, hari: CC_HARI.langkahPermohonan },
      { tahap: "putusan", agenda: "Musyawarah Majelis dan Pembacaan Penetapan", hari: CC_HARI.langkahPermohonan },
    ];
  }
  // sederhana
  return [
    { tahap: "pertama", agenda: "Sidang Pertama dan Upaya Perdamaian", hari: 0 },
    { tahap: "jawaban", agenda: `Jawaban ${dua}`, hari: CC_HARI.langkahSederhana },
    { tahap: "pembuktian-pertama", agenda: "Pembuktian", hari: CC_HARI.langkahSederhana },
    { tahap: "putusan", agenda: "Pembacaan Putusan", hari: CC_HARI.langkahSederhana },
  ];
}

const CC_PENJELASAN = {
  awal:
    "Belum ada sidang tercatat: sidang pertama, lalu pemeriksaan pokok perkara 14 hari kemudian - pola Court Calendar terbanyak yang disusun di awal (median 2 baris; jarak median 14 hari).",
  verstek:
    "Pihak kedua belum pernah hadir: satu sidang lagi 14 hari sesudahnya untuk pembacaan gugatan, pembuktian, dan putusan verstek (perkara verstek median 2 sidang).",
  damai: "Mediasi berhasil: tinggal musyawarah dan pembacaan putusan/penetapan sepekan kemudian.",
  litigasi:
    "Kedua pihak pernah hadir: laporan mediasi 21 hari (aturan tunda mediasi), lalu jawab-menjawab e-Litigasi 3-4 hari sekali pukul 15.00, pembuktian, kesimpulan, dan putusan (jarak median terukur).",
  "itsbat-awal": "Itsbat (permohonan): median 1 sidang - pemeriksaan, pembuktian, dan penetapan dibacakan pada hari yang sama.",
  itsbat: "Itsbat (permohonan) yang sudah bersidang: pembuktian dan penetapan sepekan kemudian.",
  dispensasi: "Dispensasi kawin: pemeriksaan dan pembuktian pada sidang pertama, penetapan sepekan kemudian (median 7 hari).",
  permohonan: "Permohonan: sidang pertama, pembuktian, lalu penetapan - sepekan sekali (median 7 hari).",
  sederhana:
    "Gugatan sederhana: PERMA 2/2015 jo. 4/2019, selesai paling lama 25 hari kerja - sidang pertama dan perdamaian, jawaban, pembuktian, putusan sepekan sekali. Tidak ada data satker untuk diukur.",
};

/**
 * Menyusun Court Calendar - fungsi murni, tanpa DOM dan tanpa jaringan.
 *
 * m: { nomorPerkara, jenisPerkara, tanggalDaftar, sidangPertama, hariIni,
 *      jadwal: [{tanggal, jam, agenda, dihadiriOleh}],
 *      kalender: [{tanggal, jam, agenda, keterangan}] | null (yang sudah di SIPP),
 *      mediasi: {baris: [{berhasil, tanggalKeputusan, tanggalLaporan}]},
 *      ecourt, sudahPutus, sudahIkrar }
 *
 * Pulang { golongan, jalur, sebutan, baris, sudahAda, catatan, penjelasan }.
 * baris: [{ agenda, tanggal, jam, keterangan, tahap, asal, pilih, catatan }],
 * asal "rencana" (disusun), "terjadwal" (sidang mendatang yang belum ada di
 * Court Calendar), "riwayat" (sidang lampau yang belum ada - tidak dipilih).
 */
function ccSusun(m) {
  const o = m && typeof m === "object" ? m : {};
  const hariIni = ccIsoSah(o.hariIni) ? o.hariIni : new Date().toISOString().slice(0, 10);
  const golongan = ccGolongan(o.jenisPerkara, o.nomorPerkara);
  const sebutan = ccSebutan(golongan, o.jenisPerkara);
  const catatan = [];

  const sidang = (Array.isArray(o.jadwal) ? o.jadwal : [])
    .map((x) => ({
      tanggal: String((x && (x.tanggal || x.tanggalSidang)) || "").slice(0, 10),
      jam: String((x && (x.jam || x.jamSidang)) || "").slice(0, 5),
      agenda: String((x && x.agenda) || "").trim(),
      dihadiri: x && x.dihadiriOleh !== null && x.dihadiriOleh !== undefined && x.dihadiriOleh !== "" ? Number(x.dihadiriOleh) : null,
    }))
    .filter((x) => ccIsoSah(x.tanggal))
    .sort((a, b) => (a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : 0));
  const kalenderTerbaca = Array.isArray(o.kalender);
  const sudahAda = (kalenderTerbaca ? o.kalender : [])
    .map((x) => ({
      tanggal: String((x && x.tanggal) || "").slice(0, 10),
      jam: String((x && x.jam) || "").slice(0, 5),
      agenda: String((x && x.agenda) || "").trim(),
      keterangan: String((x && x.keterangan) || "").trim(),
    }))
    .filter((x) => ccIsoSah(x.tanggal))
    .sort((a, b) => (a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : 0));
  if (!kalenderTerbaca) catatan.push("Court Calendar SIPP belum terbaca - baris yang sudah ada tidak dapat dipastikan.");
  const tanggalAda = new Set(sudahAda.map((x) => x.tanggal));

  const sidangBiasa = sidang.filter((x) => ccTahap(x.agenda) !== "ikrar");
  const kehadiranTercatat = sidangBiasa.some((x) => [1, 2, 3, 4].includes(x.dihadiri));
  const pihakKeduaPernah = sidangBiasa.some((x) => x.dihadiri === 1 || x.dihadiri === 3);
  const med = o.mediasi && Array.isArray(o.mediasi.baris) && o.mediasi.baris.length ? o.mediasi.baris[o.mediasi.baris.length - 1] : null;
  const mediasiBerhasil = Boolean(med && med.berhasil === true);

  let jalur;
  if (golongan === "itsbat") jalur = sidangBiasa.length ? "itsbat" : "itsbat-awal";
  else if (golongan === "dispensasi" || golongan === "permohonan" || golongan === "sederhana") jalur = golongan;
  else if (mediasiBerhasil) jalur = "damai";
  else if (!sidangBiasa.length || !kehadiranTercatat) jalur = "awal";
  else if (pihakKeduaPernah) jalur = "litigasi";
  else jalur = "verstek";

  // Tahap terjauh yang sudah dilalui atau sudah direncanakan.
  let terjauh = -1;
  for (const x of [...sidang, ...sudahAda]) terjauh = Math.max(terjauh, CC_URUT[ccTahap(x.agenda)] ?? 0);
  if (o.sudahPutus === true) terjauh = Math.max(terjauh, CC_URUT.putusan);
  if (o.sudahIkrar === true) terjauh = Math.max(terjauh, CC_URUT.ikrar);

  // Jangkar: tanggal terakhir yang sudah ada (sidang maupun rencana).
  let jangkar = "";
  for (const x of [...sidang, ...sudahAda]) if (x.tanggal > jangkar) jangkar = x.tanggal;

  // Langkah berjarak 0 adalah sidang pertama itu sendiri: bila sudah ada
  // sidang atau rencana apa pun, ia sudah terwakili dan tidak disusun lagi
  // (itsbat yang kalendernya sudah memuat satu baris tidak diberi baris kedua).
  const rantai = ccRantai(jalur, golongan, sebutan);
  const sisa = rantai.filter((x) => (CC_URUT[x.tahap] ?? 0) > terjauh && !(jangkar && x.hari === 0));
  if (terjauh >= CC_URUT.putusan && !sisa.length) {
    catatan.push("Sidang atau rencana perkara ini sudah sampai putusan - tidak ada sidang lagi untuk direncanakan.");
  }

  const baris = [];
  let sebelumnya = jangkar;
  for (let i = 0; i < sisa.length; i += 1) {
    const langkah = sisa[i];
    let tanggal;
    let catatanBaris = "";
    if (!sebelumnya) {
      // Belum ada apa pun: sidang pertama menurut PHS, atau perkiraan dari pendaftaran.
      if (ccIsoSah(o.sidangPertama)) tanggal = o.sidangPertama;
      else if (ccIsoSah(o.tanggalDaftar)) {
        tanggal = ccMajuHariKerja(ccTambahHari(o.tanggalDaftar, CC_HARI_DAFTAR[golongan] || 13));
        catatanBaris = `perkiraan: PHS belum ada, ${CC_HARI_DAFTAR[golongan] || 13} hari sesudah pendaftaran (median)`;
      } else {
        tanggal = ccMajuHariKerja(ccTambahHari(hariIni, 7));
        catatanBaris = "perkiraan: tanggal pendaftaran dan PHS tidak terbaca";
      }
    } else {
      tanggal = ccTambahHari(sebelumnya, langkah.hari || 7);
      // Rencana pertama sesudah sidang yang sudah lewat lama: digeser per
      // PEKAN (hari sidang majelis tetap) sampai paling cepat 3 hari dari
      // hari ini - waktu panggilan elektronik paling singkat.
      if (i === 0 && tanggal < hariIni) {
        const batas = ccTambahHari(hariIni, 3);
        while (tanggal < batas) tanggal = ccTambahHari(tanggal, 7);
        catatanBaris = "digeser ke depan: jarak bakunya sudah lewat";
      }
      tanggal = ccMajuHariKerja(tanggal);
    }
    const ecourtLitigasi = o.ecourt === true && jalur === "litigasi" && langkah.elitigasi === true;
    const ada = tanggalAda.has(tanggal);
    if (tanggal < hariIni) catatanBaris = catatanBaris ? `${catatanBaris}; tanggal sudah lewat` : "tanggal sudah lewat";
    baris.push({
      agenda: langkah.agenda,
      tanggal,
      jam: CC_TAHAP_SORE.includes(langkah.tahap) ? CC_JAM_SORE : CC_JAM_PAGI,
      keterangan: langkah.ket || (ecourtLitigasi ? "Elitigasi" : ""),
      tahap: langkah.tahap,
      asal: "rencana",
      pilih: !ada,
      catatan: ada ? "tanggal ini sudah ada di Court Calendar SIPP" : catatanBaris,
    });
    sebelumnya = tanggal;
  }

  // Sidang di jadwal yang belum tercatat di Court Calendar.
  for (const x of sidang) {
    if (tanggalAda.has(x.tanggal)) continue;
    const mendatang = x.tanggal >= hariIni;
    baris.push({
      agenda: x.agenda || "Sidang",
      tanggal: x.tanggal,
      jam: ccJamSah(x.jam) ? x.jam : CC_JAM_PAGI,
      keterangan: "",
      tahap: ccTahap(x.agenda),
      asal: mendatang ? "terjadwal" : "riwayat",
      pilih: mendatang,
      catatan: mendatang ? "sidang sudah terjadwal, belum ada di Court Calendar" : "sidang lampau - dicentang bila ingin dicatat menyusul",
    });
  }
  baris.sort((a, b) => (a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : 0));

  if (!sisa.length && !baris.length) catatan.push("Court Calendar SIPP sudah memuat seluruh rencana untuk keadaan perkara ini.");
  const tahunTerpakai = new Set(baris.map((x) => x.tanggal.slice(0, 4)));
  for (const th of tahunTerpakai) {
    if (!CC_LIBUR_TAHUN_LENGKAP.includes(th)) {
      catatan.push(`Libur keagamaan ${th} (Hijriah, Imlek, Nyepi, Waisak) belum dimuat - periksa tanggal ${th} terhadap SKB libur nasional.`);
    }
  }
  return { golongan, jalur, sebutan, baris, sudahAda, catatan, penjelasan: CC_PENJELASAN[jalur] || "" };
}

// ─── Membaca dan menulis Court Calendar SIPP ─────────────────────────────────

/** Teks polos dari pesan HTML SIPP. */
function ccTeksPolos(html) {
  const s = String(html === null || html === undefined ? "" : html);
  try {
    const d = new DOMParser().parseFromString(`<div>${s}</div>`, "text/html");
    for (const br of Array.from(d.querySelectorAll("br"))) br.replaceWith(" ");
    return String(d.body.textContent || "").replace(/\s+/g, " ").trim().slice(0, 300);
  } catch {
    return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
  }
}

/**
 * Alamat dasar SIPP dan <enc> perkara ini - dibaca dari pemuat tab Court
 * Calendar di halaman detail itu sendiri ($('#tabs27').load('.../court_calendar/<enc>')),
 * atau dari pemuat Data Umum (open_dataumum/<enc>) yang memakai <enc> yang sama.
 */
function ccAlamatSipp() {
  const isi = document.documentElement ? String(document.documentElement.innerHTML || "") : "";
  const cocok =
    /(https?:\/\/[^'"\s]*?\/)court_calendar\/([^'"\/\s?#)]+)/.exec(isi) ||
    /(https?:\/\/[^'"\s]*?\/)open_dataumum\/([^'"\/\s?#)]+)/.exec(isi);
  return cocok ? { dasar: cocok[1], enc: cocok[2] } : null;
}

/** Normal untuk membandingkan baris: tanggal|jam|agenda huruf kecil berspasi tunggal. */
function ccKunciBaris(x) {
  return `${String((x && x.tanggal) || "")}|${String((x && x.jam) || "").slice(0, 5)}|${String((x && x.agenda) || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()}`;
}

/**
 * Daftar Court Calendar SIPP perkara ini, segar dari list_view SIPP (GET yang
 * sama dengan yang dijalankan tab Court Calendar). Pulang { ok, baris, pesan }.
 */
async function ccBacaDaftarSipp() {
  const alamat = ccAlamatSipp();
  if (!alamat) return { ok: false, baris: [], pesan: "Alamat Court Calendar SIPP tidak terbaca dari halaman ini - buka halaman detail perkara SIPP." };
  let teks = "";
  try {
    const respons = await alatAmbil(`${alamat.dasar}court_calendar/${alamat.enc}`, { credentials: "include", cache: "no-store" }, "Membaca Court Calendar SIPP");
    if (!respons.ok) return { ok: false, baris: [], pesan: `Court Calendar SIPP tidak terbaca (status ${respons.status}).` };
    teks = await respons.text();
  } catch (galat) {
    return { ok: false, baris: [], pesan: String((galat && galat.message) || galat).slice(0, 200) };
  }
  let dok;
  try {
    dok = new DOMParser().parseFromString(teks, "text/html");
  } catch {
    dok = null;
  }
  const tabel =
    (dok && dok.querySelector("#tableinfo")) ||
    (dok && Array.from(dok.querySelectorAll("table")).find((t) => /Agenda\/Acara Sidang/i.test(t.textContent || ""))) ||
    null;
  if (!tabel) return { ok: false, baris: [], pesan: "Daftar Court Calendar SIPP tidak terbaca - sesi SIPP mungkin sudah habis. Muat ulang halaman SIPP." };
  const baris = [];
  for (const tr of Array.from(tabel.querySelectorAll("tr"))) {
    const sel = Array.from(tr.querySelectorAll("td"));
    if (sel.length < 5) continue;
    const tanggal = tanggalDariTeksSipp(sel[1].textContent || "");
    if (!tanggal) continue;
    const jam = (/(\d{1,2}):(\d{2})/.exec(sel[2].textContent || "") || []).slice(1, 3);
    const bersih = (el) => {
      const t = String(el.textContent || "").replace(/\s+/g, " ").trim();
      return t === "-" ? "" : t;
    };
    baris.push({
      tanggal,
      jam: jam.length === 2 ? `${jam[0].padStart(2, "0")}:${jam[1]}` : "",
      agenda: bersih(sel[3]),
      keterangan: bersih(sel[4]),
    });
  }
  return { ok: true, baris, pesan: "" };
}

/**
 * Blangko Tambah Court Calender perkara ini (GET, persis yang dimuat tingkap
 * SIPP): alamat action-nya dan medan tersembunyi nomor_perkara + enc.
 */
async function ccBacaBlangkoSipp() {
  const alamat = ccAlamatSipp();
  if (!alamat) return { ok: false, pesan: "Alamat blangko Court Calendar SIPP tidak terbaca dari halaman ini." };
  let teks = "";
  try {
    const respons = await alatAmbil(
      `${alamat.dasar}tambah_court_calendar/tambah/${alamat.enc}`,
      { credentials: "include", cache: "no-store" },
      "Membuka blangko Tambah Court Calender"
    );
    if (!respons.ok) return { ok: false, pesan: `Blangko Tambah Court Calender tidak terbuka (status ${respons.status}).` };
    teks = await respons.text();
  } catch (galat) {
    return { ok: false, pesan: String((galat && galat.message) || galat).slice(0, 200) };
  }
  const dok = new DOMParser().parseFromString(teks, "text/html");
  const borang = dok.querySelector("#frm_input_cc");
  const nilai = (nama) => {
    const el = borang ? borang.querySelector(`[name="${nama}"]`) : null;
    return el ? String(el.getAttribute("value") || el.value || "") : "";
  };
  const action = borang ? String(borang.getAttribute("action") || "") : "";
  if (!borang || !/manage_court_calendar\/validateInput/.test(action)) {
    return { ok: false, pesan: "Blangko Tambah Court Calender tidak dikenali - akun SIPP ini mungkin tidak berwenang, atau sesinya habis." };
  }
  const enc = nilai("enc");
  const nomor = nilai("nomor_perkara");
  if (!enc || !nomor) return { ok: false, pesan: "Blangko Tambah Court Calender tidak memuat nomor perkara." };
  return { ok: true, action: new URL(action, location.href).href, enc, nomor };
}

/** Satu POST ke validateInput - medan dan urutannya sama dengan serializeArray blangko SIPP. */
async function ccKirimBaris(blangko, baris) {
  const badan = new URLSearchParams();
  badan.append("tgl_sidang", ccTanggalSipp(baris.tanggal));
  badan.append("jamSidang", baris.jam);
  badan.append("agenda_sidang", baris.agenda);
  badan.append("keterangan", baris.keterangan || "");
  badan.append("nomor_perkara", blangko.nomor);
  badan.append("enc", blangko.enc);
  let respons;
  try {
    respons = await alatAmbil(
      blangko.action,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest" },
        body: badan.toString(),
      },
      "Menyimpan Court Calendar ke SIPP"
    );
  } catch (galat) {
    return { keadaan: "gagal", pesan: String((galat && galat.message) || galat).slice(0, 200) };
  }
  let isi = null;
  let teks = "";
  try {
    teks = await respons.text();
    isi = JSON.parse(teks);
  } catch {
    isi = null;
  }
  if (respons.status === 423) {
    const alasan = String((isi && isi.alasan) || "");
    return { keadaan: "ditahan", alasan, pesan: (isi && isi.pesan) || "Ditahan - tidak ada yang disimpan." };
  }
  if (isi && Number(isi.st) === 1) return { keadaan: "tersimpan", pesan: ccTeksPolos(isi.msg) };
  if (isi && Number(isi.st) === 0) return { keadaan: "ditolak", pesan: ccTeksPolos(isi.msg) || "Ditolak SIPP." };
  return { keadaan: "gagal", pesan: `SIPP menjawab status ${respons.status} tanpa keterangan yang dikenali.` };
}

/** Pemeriksaan sebelum dikirim - pengesahan SIPP yang sama, supaya penolakan terbaca lebih dulu. */
function ccPeriksaBaris(b, tanggalDaftar) {
  if (!String(b.agenda || "").trim()) return "agenda wajib diisi";
  if (!ccIsoSah(b.tanggal)) return "tanggal wajib diisi";
  if (!ccJamSah(b.jam)) return "jam wajib diisi (JJ:MM)";
  const h = ccHariKe(b.tanggal);
  if (h === 0 || h === 6) return "SIPP menolak Sabtu dan Minggu";
  // Libur nasional/cuti bersama/tambahan tidak ditolak SIPP - dicegah di sini.
  const libur = ccBukanHariKerja(b.tanggal);
  if (libur) return `${libur} - tanggal libur tidak dikirim`;
  if (ccIsoSah(tanggalDaftar) && b.tanggal < tanggalDaftar) return "sebelum tanggal pendaftaran - SIPP menolak";
  return "";
}

/**
 * Menginput baris terpilih ke SIPP. Tidak pernah melempar.
 * Pulang { ok, pesan, hasil: Map(baris -> {keadaan, pesan}) , daftarSesudah }.
 */
async function ccInputKeSipp(daftar, opsi) {
  const o = opsi || {};
  const hasil = new Map();
  const kabar = typeof o.kabar === "function" ? o.kabar : () => {};
  const dipilih = daftar.filter((b) => b.pilih && b.keadaan !== "tersimpan");
  if (!dipilih.length) return { ok: false, pesan: "Tidak ada baris yang dicentang untuk diinput.", hasil };

  for (const b of dipilih) {
    const salah = ccPeriksaBaris(b, o.tanggalDaftar);
    if (salah) hasil.set(b, { keadaan: "ditolak", pesan: salah });
  }
  const layak = dipilih.filter((b) => !hasil.has(b));
  if (!layak.length) return { ok: false, pesan: "Semua baris terpilih belum lengkap - perbaiki yang ditandai.", hasil };

  kabar("Membuka blangko Tambah Court Calender SIPP…");
  const blangko = await ccBacaBlangkoSipp();
  if (!blangko.ok) return { ok: false, pesan: blangko.pesan, hasil };
  if (o.nomorPerkara && t7KunciNomor(blangko.nomor) !== t7KunciNomor(o.nomorPerkara)) {
    return { ok: false, pesan: `Blangko SIPP milik perkara ${blangko.nomor}, bukan ${o.nomorPerkara} - tidak ada yang dikirim.`, hasil };
  }

  // Dibaca segar tepat sebelum menulis: yang sudah ada tidak dikirim lagi.
  const sebelum = await ccBacaDaftarSipp();
  if (!sebelum.ok) return { ok: false, pesan: `${sebelum.pesan} Tidak ada yang dikirim - tanpa daftar itu baris ganda tidak dapat dicegah.`, hasil };
  const hitungSebelum = new Map();
  for (const x of sebelum.baris) hitungSebelum.set(ccKunciBaris(x), (hitungSebelum.get(ccKunciBaris(x)) || 0) + 1);

  if (typeof alatKeringNyala === "function" && alatKeringNyala()) {
    for (const b of layak) hasil.set(b, { keadaan: "ditahan", pesan: "mode kering: Simpan ditahan, SIPP tidak menyimpan apa pun" });
    if (typeof alatCatat === "function") alatCatat("kering", `DITAHAN Court Calendar ${layak.length} baris`, "mode kering aktif - SIPP tidak menyimpan apa pun");
    return { ok: false, pesan: "Mode kering aktif: tidak ada yang dikirim ke SIPP.", hasil };
  }

  const dikirim = [];
  let nomorKe = 0;
  for (const b of layak) {
    nomorKe += 1;
    if (hitungSebelum.get(ccKunciBaris(b))) {
      hasil.set(b, { keadaan: "sudah-ada", pesan: "baris yang sama persis sudah ada di SIPP - tidak dikirim lagi" });
      continue;
    }
    kabar(`Menyimpan baris ${nomorKe} dari ${layak.length} ke SIPP…`);
    // Jarak antar DUA simpanan beruntun dipertahankan (tiap baris = satu baris
    // audit SIPP atas akun petugas; lima baris dalam sekejap tampak seperti mesin).
    // Baris PERTAMA langsung dikirim - isian blangko sudah ada, tak ada yang ditunggu.
    if (dikirim.length && typeof alatJedaManusia === "function") {
      try {
        await alatJedaManusia("simpan", { alamat: blangko.action });
      } catch {
        /* jeda gagal - simpanan tetap berjalan */
      }
    }
    const jawab = await ccKirimBaris(blangko, b);
    hasil.set(b, jawab);
    if (jawab.keadaan === "tersimpan") dikirim.push(b);
  }

  let daftarSesudah = null;
  if (dikirim.length) {
    kabar("Membaca ulang Court Calendar SIPP…");
    const sesudah = await ccBacaDaftarSipp();
    if (sesudah.ok) {
      daftarSesudah = sesudah.baris;
      const hitungSesudah = new Map();
      for (const x of sesudah.baris) hitungSesudah.set(ccKunciBaris(x), (hitungSesudah.get(ccKunciBaris(x)) || 0) + 1);
      const terpakai = new Map();
      for (const b of dikirim) {
        const k = ccKunciBaris(b);
        const butuh = (hitungSebelum.get(k) || 0) + (terpakai.get(k) || 0) + 1;
        terpakai.set(k, (terpakai.get(k) || 0) + 1);
        if ((hitungSesudah.get(k) || 0) >= butuh) hasil.set(b, { keadaan: "tersimpan", pesan: "tersimpan dan terbaca ulang di SIPP" });
        else hasil.set(b, { keadaan: "belum-terbaca", pesan: "SIPP menjawab tersimpan, tetapi barisnya TIDAK terbaca ulang - periksa tab Court Calendar SIPP" });
      }
    } else {
      for (const b of dikirim) hasil.set(b, { keadaan: "belum-terbaca", pesan: `SIPP menjawab tersimpan; pembacaan ulang gagal (${sesudah.pesan})` });
    }
    for (const b of dikirim) {
      if (typeof alatCatatTindakan === "function") {
        alatCatatTindakan({
          jenis: "simpan-sipp",
          penunjuk: "manage_court_calendar/validateInput",
          label: `Court Calendar ${b.tanggal} ${b.jam} ${b.agenda}`.slice(0, 200),
          nilaiBaru: (hasil.get(b) || {}).pesan || "",
          dapatPulih: false,
        });
      }
    }
    // Simpanan keadaan perkara dibuang (Court Calendar-nya berubah), TANPA
    // lupakanStatusPerkara: itu menggambar ulang bagian yang terbuka -
    // termasuk bagian ini - dan menghapus hasil per baris sebelum terbaca.
    if (simpananStatus.nomor === (o.nomorPerkara || "")) simpananStatus = { nomor: "", data: null, sedang: null };
  }

  const jumlah = (k) => Array.from(hasil.values()).filter((x) => x.keadaan === k).length;
  const ditahan = Array.from(hasil.values()).find((x) => x.keadaan === "ditahan");
  const bagianPesan = [];
  if (jumlah("tersimpan")) bagianPesan.push(`${jumlah("tersimpan")} baris tersimpan dan terbaca ulang di SIPP`);
  if (jumlah("belum-terbaca")) bagianPesan.push(`${jumlah("belum-terbaca")} baris belum terbaca ulang`);
  if (jumlah("sudah-ada")) bagianPesan.push(`${jumlah("sudah-ada")} sudah ada, tidak dikirim lagi`);
  if (jumlah("ditolak")) bagianPesan.push(`${jumlah("ditolak")} ditolak`);
  if (jumlah("gagal")) bagianPesan.push(`${jumlah("gagal")} gagal`);
  if (ditahan) {
    bagianPesan.push(
      ditahan.alasan === "mode_latihan"
        ? "LATIHAN: tidak ada yang disimpan ke SIPP - lihat catatan latihan"
        : ditahan.alasan === "mode_coba"
          ? "mode coba aktif: tidak ada yang disimpan ke SIPP"
          : `${jumlah("ditahan")} ditahan`
    );
  }
  return { ok: jumlah("tersimpan") > 0 && !jumlah("ditolak") && !jumlah("gagal") && !jumlah("belum-terbaca"), pesan: `${bagianPesan.join("; ")}.`, hasil, daftarSesudah };
}

// ─── Bagian panel ────────────────────────────────────────────────────────────

function ccBolehTampil() {
  try {
    if (typeof a30Aktif !== "function" || !a30Aktif()) return false;
    const g = typeof s1Golongan === "function" ? s1Golongan() : "lain";
    if (g !== "admin" && g !== "panitera") return false;
    return boleh("data-umum");
  } catch {
    return false;
  }
}

/** Bagian "Court Calendar otomatis" - null bila tidak berlaku untuk tampilan/peran ini. */
function ccBagian(konteks) {
  if (!konteks || !konteks.nomorPerkara || !ccBolehTampil()) return null;
  void ccMuatLiburTambahan();
  const kotak = bagianMalas("Court Calendar otomatis", "courtCalendarOtomatis", konteks.nomorPerkara, (isi, status) =>
    ccGambar(isi, status, konteks)
  );
  kotak.classList.add("aleta-cc-bagian");
  // Penanda fitur Baru/UI Baru tanpa saklar - sama dengan Juru Sita; penjaga
  // "Baru tanpa saklar = Lama" (ekstensi-sipp-tahap7) membuang yang bertanda ini.
  kotak.setAttribute("data-a30-fitur", "court-calendar");
  return kotak;
}

/** Bahan ccSusun dari keadaan perkara (bot) + Court Calendar SIPP yang terbaca. */
function ccMasukan(status, konteks, kalender) {
  const s = status || {};
  const tahap = s.tahapan && Array.isArray(s.tahapan.tahap) ? s.tahapan.tahap : [];
  const daftar = (tahap.find((x) => x && x.kunci === "pendaftaran") || {}).tanggal || "";
  const identitas = (konteks && konteks.identitas) || s.identitasPihak || {};
  return {
    nomorPerkara: (konteks && konteks.nomorPerkara) || "",
    jenisPerkara: String(identitas.jenisPerkara || identitas.jenisPerkaraLengkap || ""),
    tanggalDaftar: String(daftar).slice(0, 10),
    sidangPertama: String((s.tahapan && s.tahapan.sidangPertama) || "").slice(0, 10),
    jadwal: (Array.isArray(s.jadwal) ? s.jadwal : []).map((j) => ({
      tanggal: j.tanggalSidang || j.tanggal,
      jam: j.jamSidang || j.jam,
      agenda: j.agenda,
      dihadiriOleh: j.dihadiriOleh,
    })),
    kalender,
    mediasi: s.mediasi || null,
    ecourt: s.lewatEcourt === true,
    sudahPutus: Boolean(s.putusan && s.putusan.sudahPutus),
    sudahIkrar: Boolean(s.ikrarTalak && s.ikrarTalak.ada),
    hariIni: typeof alatTanggalIso === "function" ? alatTanggalIso(new Date()) : new Date().toISOString().slice(0, 10),
  };
}

const CC_SEBUTAN_ASAL = { rencana: "rencana", terjadwal: "terjadwal", riwayat: "riwayat" };
const CC_SEBUTAN_KEADAAN = {
  tersimpan: "tersimpan",
  "belum-terbaca": "belum terbaca ulang",
  "sudah-ada": "sudah ada",
  ditolak: "ditolak",
  gagal: "gagal",
  ditahan: "ditahan",
};

function ccGambar(isi, status, konteks) {
  const nomor = String((konteks && konteks.nomorPerkara) || "");
  const wadah = buatElemen("div", "aleta-cc");
  isi.appendChild(wadah);
  const ringkas = buatElemen("div", "aleta-cc-pola");
  const kabar = buatElemen("div", "aleta-abt-kabar aleta-cc-kabar", "Membaca Court Calendar SIPP perkara ini…");
  const tabel = buatElemen("div", "aleta-cc-tabel");
  const aksi = buatElemen("div", "aleta-cc-aksi");
  const ada = buatElemen("div", "aleta-cc-ada");
  wadah.append(ringkas, kabar, tabel, aksi, ada);

  const keadaan = { baris: [], masukan: null, sedang: false, siap: false, kalenderSipp: null };

  const tambah = buatElemen("button", "aleta-permintaan-tombol aleta-cc-tambah", "+ Tambah baris");
  tambah.type = "button";
  const susunUlang = buatElemen("button", "aleta-permintaan-tombol aleta-cc-susun", "Susun ulang");
  susunUlang.type = "button";
  const input = buatElemen("button", "aleta-permintaan-tombol aleta-cc-input", "Input semua ke SIPP");
  input.type = "button";
  aksi.append(tambah, susunUlang, input);

  let tungguYakin = 0;
  const lepasYakin = () => {
    if (tungguYakin) clearTimeout(tungguYakin);
    tungguYakin = 0;
    input.classList.remove("aleta-cc-yakin");
    perbaruiTombol();
  };

  function terpilih() {
    return keadaan.baris.filter((b) => b.pilih && b.keadaan !== "tersimpan");
  }

  function perbaruiTombol() {
    const n = terpilih().length;
    input.disabled = keadaan.sedang || !keadaan.siap || n === 0;
    if (!tungguYakin) input.textContent = n ? `Input semua ke SIPP (${n} baris)` : "Input semua ke SIPP";
    tambah.disabled = keadaan.sedang || !keadaan.siap;
    susunUlang.disabled = keadaan.sedang;
  }

  function gambarAda() {
    ada.textContent = "";
    const daftar = keadaan.kalenderSipp;
    if (!Array.isArray(daftar)) return;
    ada.appendChild(buatElemen("div", "aleta-sub-judul", `Sudah di Court Calendar SIPP (${daftar.length})`));
    if (!daftar.length) {
      ada.appendChild(buatElemen("div", "aleta-kosong-lembut", "Belum ada rencana sidang di SIPP untuk perkara ini."));
      return;
    }
    for (const x of daftar) {
      const b = buatElemen("div", "aleta-cc-ada-baris");
      b.appendChild(buatElemen("span", "aleta-cc-ada-tgl", `${ccTeksTanggal(x.tanggal)}${x.jam ? ` ${x.jam}` : ""}`));
      b.appendChild(buatElemen("span", "aleta-cc-ada-agenda", x.agenda || "-"));
      if (x.keterangan) b.appendChild(buatElemen("span", "aleta-cc-ada-ket", x.keterangan));
      ada.appendChild(b);
    }
  }

  function gambarBaris() {
    tabel.textContent = "";
    if (!keadaan.baris.length) {
      tabel.appendChild(buatElemen("div", "aleta-kosong-lembut", "Tidak ada baris untuk diinput. Tekan + Tambah baris bila perlu."));
      perbaruiTombol();
      return;
    }
    const tanggalSipp = new Set((keadaan.kalenderSipp || []).map((x) => x.tanggal));
    keadaan.baris.forEach((b, i) => {
      const el = buatElemen("div", `aleta-cc-baris aleta-cc-asal-${b.asal}${b.keadaan ? ` aleta-cc-${b.keadaan}` : ""}`);
      el.setAttribute("data-cc-ke", String(i));
      const kunci = b.keadaan === "tersimpan" || keadaan.sedang;

      const kepala = buatElemen("div", "aleta-cc-kepala");
      const centang = document.createElement("input");
      centang.type = "checkbox";
      centang.className = "aleta-cc-pilih";
      centang.checked = Boolean(b.pilih);
      centang.disabled = kunci;
      centang.title = "Ikut diinput ke SIPP";
      centang.addEventListener("change", () => {
        b.pilih = centang.checked;
        perbaruiTombol();
      });
      kepala.appendChild(centang);
      kepala.appendChild(buatElemen("span", "aleta-cc-nomor", String(i + 1)));
      kepala.appendChild(buatElemen("span", "aleta-cc-asal", CC_SEBUTAN_ASAL[b.asal] || b.asal || ""));
      if (b.keadaan) kepala.appendChild(buatElemen("span", `aleta-cc-keadaan aleta-cc-keadaan-${b.keadaan}`, CC_SEBUTAN_KEADAAN[b.keadaan] || b.keadaan));
      const geser = (arah) => {
        const j = i + arah;
        if (j < 0 || j >= keadaan.baris.length) return;
        const t = keadaan.baris[i];
        keadaan.baris[i] = keadaan.baris[j];
        keadaan.baris[j] = t;
        gambarBaris();
      };
      const naik = buatElemen("button", "aleta-cc-kecil aleta-cc-naik", "↑");
      naik.type = "button";
      naik.title = "Geser ke atas";
      naik.disabled = kunci || i === 0;
      naik.addEventListener("click", () => geser(-1));
      const turun = buatElemen("button", "aleta-cc-kecil aleta-cc-turun", "↓");
      turun.type = "button";
      turun.title = "Geser ke bawah";
      turun.disabled = kunci || i === keadaan.baris.length - 1;
      turun.addEventListener("click", () => geser(1));
      const hapus = buatElemen("button", "aleta-cc-kecil aleta-cc-hapus", "✕");
      hapus.type = "button";
      hapus.title = "Hapus baris ini dari susunan (tidak menyentuh SIPP)";
      hapus.disabled = kunci;
      hapus.addEventListener("click", () => {
        keadaan.baris.splice(i, 1);
        gambarBaris();
      });
      kepala.append(naik, turun, hapus);
      el.appendChild(kepala);

      const medan = buatElemen("div", "aleta-cc-medan");
      const agenda = document.createElement("textarea");
      agenda.className = "aleta-cc-agenda";
      agenda.rows = 2;
      agenda.value = b.agenda;
      agenda.placeholder = "Jadwal/Agenda Sidang";
      agenda.disabled = kunci;
      agenda.addEventListener("input", () => {
        b.agenda = agenda.value;
      });
      const tgl = document.createElement("input");
      tgl.type = "date";
      tgl.className = "aleta-cc-tanggal";
      tgl.value = b.tanggal;
      tgl.disabled = kunci;
      const jam = document.createElement("input");
      jam.type = "time";
      jam.className = "aleta-cc-jam";
      jam.value = b.jam;
      jam.disabled = kunci;
      const ket = document.createElement("input");
      ket.type = "text";
      ket.className = "aleta-cc-ket";
      ket.value = b.keterangan || "";
      ket.placeholder = "Keterangan";
      ket.disabled = kunci;
      ket.addEventListener("input", () => {
        b.keterangan = ket.value;
      });
      const peringatan = buatElemen("div", "aleta-cc-catatan");
      const segarkanPeringatan = () => {
        const bagianCatatan = [];
        const sebab = ccIsoSah(b.tanggal) ? ccBukanHariKerja(b.tanggal) : "";
        if (sebab) bagianCatatan.push(`${ccTeksTanggal(b.tanggal)}: ${sebab}`);
        else if (ccIsoSah(b.tanggal)) bagianCatatan.push(ccTeksTanggal(b.tanggal));
        if (tanggalSipp.has(b.tanggal) && b.keadaan !== "tersimpan") bagianCatatan.push("tanggal ini sudah ada di Court Calendar SIPP");
        else if (b.catatan) bagianCatatan.push(b.catatan);
        if (b.pesan) bagianCatatan.push(b.pesan);
        peringatan.textContent = bagianCatatan.join(" · ");
        el.classList.toggle("aleta-cc-libur", Boolean(sebab));
      };
      tgl.addEventListener("change", () => {
        // Hari libur tidak dapat dipilih (18 Okt 2026): tanggal lama kembali,
        // sebabnya disebut di baris itu.
        const libur = ccIsoSah(tgl.value) ? ccBukanHariKerja(tgl.value) : "";
        if (libur) {
          b.pesan = `${ccTeksTanggal(tgl.value)} ${libur} - tidak dapat dipilih`;
          tgl.value = b.tanggal;
        } else {
          b.pesan = "";
          b.tanggal = tgl.value;
        }
        segarkanPeringatan();
      });
      jam.addEventListener("change", () => {
        b.jam = jam.value;
      });
      segarkanPeringatan();
      const baris2 = buatElemen("div", "aleta-cc-waktu");
      baris2.append(tgl, jam);
      medan.append(agenda, baris2, ket);
      el.append(medan, peringatan);
      tabel.appendChild(el);
    });
    perbaruiTombol();
  }

  async function susun() {
    keadaan.siap = false;
    lepasYakin();
    kabar.textContent = "Membaca Court Calendar SIPP perkara ini…";
    const sipp = await ccBacaDaftarSipp();
    let kalender = null;
    if (sipp.ok) kalender = sipp.baris;
    else if (status && status.courtCalendar && status.courtCalendar.terbaca === true) kalender = status.courtCalendar.baris || [];
    keadaan.kalenderSipp = kalender;
    keadaan.masukan = ccMasukan(status, konteks, kalender);
    const hasil = ccSusun(keadaan.masukan);
    keadaan.baris = hasil.baris.map((b) => ({ ...b, keadaan: "", pesan: "" }));
    ringkas.textContent = "";
    ringkas.appendChild(buatElemen("div", "aleta-cc-penjelasan", hasil.penjelasan));
    for (const c of hasil.catatan) ringkas.appendChild(buatElemen("div", "aleta-cc-peringatan", c));
    keadaan.siap = sipp.ok;
    kabar.textContent = sipp.ok
      ? "Periksa dan sunting tiap baris. Yang dicentang diinput ke SIPP atas nama akun SIPP yang sedang masuk."
      : `${sipp.pesan} Susunan tetap dapat dilihat; input ke SIPP menunggu daftar SIPP terbaca.`;
    gambarAda();
    gambarBaris();
  }

  tambah.addEventListener("click", () => {
    const terakhir = keadaan.baris.length ? keadaan.baris[keadaan.baris.length - 1].tanggal : "";
    const dasar = ccIsoSah(terakhir) ? terakhir : (keadaan.masukan && keadaan.masukan.hariIni) || "";
    keadaan.baris.push({
      agenda: "",
      tanggal: ccIsoSah(dasar) ? ccMajuHariKerja(ccTambahHari(dasar, 7)) : "",
      jam: CC_JAM_PAGI,
      keterangan: "",
      tahap: "lain",
      asal: "rencana",
      pilih: true,
      catatan: "baris tambahan",
      keadaan: "",
      pesan: "",
    });
    gambarBaris();
  });

  susunUlang.addEventListener("click", () => {
    void susun();
  });

  input.addEventListener("click", () => {
    if (keadaan.sedang) return;
    const n = terpilih().length;
    if (!n) return;
    if (!tungguYakin) {
      // Dua tekanan, seperti Tetapkan: yang pertama hanya menyebutkan apa yang akan terjadi.
      input.classList.add("aleta-cc-yakin");
      input.textContent = `Tekan sekali lagi: simpan ${n} baris ke SIPP`;
      tungguYakin = setTimeout(lepasYakin, 8000);
      return;
    }
    lepasYakin();
    keadaan.sedang = true;
    gambarBaris();
    void (async () => {
      let hasil;
      await catatAlamatSebelumTulis(nomor);
      try {
        hasil = await ccInputKeSipp(keadaan.baris, {
          nomorPerkara: nomor,
          tanggalDaftar: keadaan.masukan ? keadaan.masukan.tanggalDaftar : "",
          kabar: (t) => {
            kabar.textContent = t;
          },
        });
      } catch (galat) {
        hasil = { ok: false, pesan: String((galat && galat.message) || galat).slice(0, 200), hasil: new Map() };
      }
      for (const [b, r] of hasil.hasil) {
        b.keadaan = r.keadaan;
        b.pesan = r.pesan;
        if (r.keadaan === "tersimpan" || r.keadaan === "sudah-ada") b.pilih = false;
      }
      if (Array.isArray(hasil.daftarSesudah)) keadaan.kalenderSipp = hasil.daftarSesudah;
      keadaan.sedang = false;
      kabar.textContent = hasil.ok ? `${hasil.pesan} Halaman SIPP dimuat ulang supaya tab Court Calendar menampilkannya.` : hasil.pesan;
      kabar.classList.toggle("aleta-cc-kabar-gagal", !hasil.ok);
      gambarAda();
      gambarBaris();
      // Court Calendar ditulis langsung ke SIPP: tab Court Calendar di halaman ini basi sampai dimuat ulang.
      const tersimpanCc = Array.from(hasil.hasil.values()).filter((r) => r.keadaan === "tersimpan").length;
      if (tersimpanCc > 0) {
        muatUlangSesudahTulis({
          nomor,
          judulOk: "Court Calendar tersimpan di SIPP.",
          judulGagal: "Court Calendar belum tersimpan seluruhnya.",
          baris: Array.from(hasil.hasil.entries()).map(([b, r]) => ({
            jenis: String(b.tanggal || "baris"),
            teks: `${String(b.agenda || "").slice(0, 40)} - ${r.keadaan}${r.pesan && r.keadaan !== "tersimpan" ? ` (${String(r.pesan).slice(0, 80)})` : ""}`,
            ok: r.keadaan === "tersimpan" || r.keadaan === "sudah-ada",
          })),
        });
      }
    })();
  });

  void susun();
}

/**
 * ============================================================================
 * KELOMPOK MENU
 * ============================================================================
 *
 * Dua belas menu datar menjadi empat kelompok. Yang berubah susunannya, bukan
 * isinya - tiap menu tetap ada, tetap dapat dibuka, dan tidak satu keterangan
 * pun hilang.
 *
 * Urutannya mengikuti perjalanan perkara: berkas masuk, perkara berjalan,
 * perkara putus, lalu yang dikerjakan. Bukan urutan kapan menunya dibuat -
 * yang selama ini menentukan.
 *
 * Kelompok yang tertutup menyebutkan ringkasannya di kepalanya sendiri,
 * sehingga menutupnya tidak menyembunyikan apa pun yang perlu diketahui
 * sebelum memutuskan membukanya.
 */
function kelompok(judul, kunci, bawaanTerlipat = false) {
  const kotak = buatElemen("div", "aleta-kelompok");
  // Sasaran tetap bagi pintasan papan tik dan bagi uji - lihat
  // pintasanPapanTik. Judulnya berubah sewaktu-waktu, kuncinya tidak.
  kotak.dataset.kunci = kunci;

  const kepala = buatElemen("button", "aleta-kelompok-judul");
  kepala.type = "button";
  kepala.appendChild(buatElemen("span", "aleta-bagian-panah", "▾"));
  kepala.appendChild(buatElemen("span", "aleta-kelompok-teks", judul));
  const ringkas = buatElemen("span", "aleta-kelompok-ringkas");
  kepala.appendChild(ringkas);

  const isi = buatElemen("div", "aleta-kelompok-isi");

  const tersimpan = lipatanTersimpan ? lipatanTersimpan[`kel:${kunci}`] : undefined;
  const terlipatAwal = typeof tersimpan === "boolean" ? tersimpan : bawaanTerlipat;
  terapkanLipatan(kepala, isi, terlipatAwal);

  kepala.addEventListener("click", () => {
    const sedangTerlipat = isi.style.display === "none";
    terapkanLipatan(kepala, isi, !sedangTerlipat);
    simpanLipatan(`kel:${kunci}`, !sedangTerlipat);
  });

  kotak.appendChild(kepala);
  kotak.appendChild(isi);
  kotak.isi = isi;
  kotak.ringkas = ringkas;

  /**
   * Ringkasan kepala kelompok, disusun dari lencana anak-anaknya.
   *
   * Yang disebut hanya yang paling genting - satu kelompok berisi empat menu
   * tidak dapat memuat empat lencana di kepalanya tanpa jadi sesak, dan yang
   * ditanya orang memang "ada yang perlu dikerjakan di dalam sini?".
   */
  kotak.perbaruiRingkas = () => {
    const urutanNada = { lewat: 3, mendesak: 2, aman: 1, netral: 0 };
    let terburuk = null;
    for (const lencana of isi.querySelectorAll(".aleta-bagian-lencana")) {
      const teks = String(lencana.textContent || "").trim();
      if (!teks) continue;
      const nada = (lencana.className.match(/aleta-lencana-(\w+)/) || [])[1] || "netral";
      if (!terburuk || urutanNada[nada] > urutanNada[terburuk.nada]) {
        terburuk = { teks, nada };
      }
    }
    if (!terburuk) return;
    ringkas.textContent = terburuk.teks;
    ringkas.className = `aleta-kelompok-ringkas aleta-lencana-${terburuk.nada}`;
  };

  return kotak;
}

function ringkasanBagian(status) {
  const hasil = {};

  // --- Tahapan: berapa tahap yang sudah bertanggal ------------------------
  const tahapan = status.tahapan;
  if (!tahapan || !tahapan.terbaca) {
    hasil.tahapan = { teks: "tidak terbaca", nada: "netral" };
  } else {
    const tahap = tahapan.tahap || [];
    const berTanggal = tahap.filter((x) => x.terbaca && x.tanggal).length;
    // Yang terlambat diinput lebih penting daripada yang belum ada - yang
    // pertama sudah terjadi dan tidak dapat diperbaiki, yang kedua memang
    // belum waktunya.
    const terlambat = tahap.filter(
      (x) => x.hariSampaiInput !== null && x.hariSampaiInput !== undefined && Number(x.hariSampaiInput) > 3
    ).length;
    hasil.tahapan = terlambat > 0
      ? { teks: `${terlambat} terlambat diinput`, nada: "lewat" }
      : { teks: `${berTanggal}/${tahap.length}`, nada: "netral" };
  }

  // --- Kelengkapan berkas SIPP: yang paling buruk di antara ketiganya -----
  {
    const relaas = Array.isArray(status.relaas) ? status.relaas : [];
    const jadwal = Array.isArray(status.jadwal) ? status.jadwal : [];
    const berdokumen = relaas.filter((x) => x.adaDokumen).length;
    const berBas = jadwal.filter((x) => x.adaBas).length;
    const adaPetitum = Boolean(status.petitum && status.petitum.ada);

    if (!adaPetitum) {
      hasil.berkasSipp = { teks: "gugatan belum diunggah", nada: "lewat" };
    } else if (relaas.length > 0 && berdokumen < relaas.length) {
      hasil.berkasSipp = { teks: `relaas ${berdokumen}/${relaas.length}`, nada: "mendesak" };
    } else if (jadwal.length > 0 && berBas < jadwal.length) {
      hasil.berkasSipp = { teks: `BAS ${berBas}/${jadwal.length}`, nada: "mendesak" };
    } else {
      hasil.berkasSipp = { teks: "lengkap", nada: "aman" };
    }
  }

  // --- Putusan dan upaya hukum --------------------------------------------
  {
    const putus = status.putusan || {};
    if (!putus.sudahPutus) {
      // Belum putus BUKAN kekurangan - perkaranya memang masih berjalan.
      hasil.putusan = { teks: "belum putus", nada: "netral" };
    } else if (!putus.tanggalMinutasi) {
      hasil.putusan = { teks: "belum diminutasi", nada: "mendesak" };
    } else if (!putus.tanggalBht) {
      hasil.putusan = { teks: "belum BHT", nada: "netral" };
    } else {
      const upaya = Array.isArray(status.upayaHukum) ? status.upayaHukum.length : 0;
      hasil.putusan = upaya > 0
        ? { teks: `${upaya} upaya hukum`, nada: "netral" }
        : { teks: "sudah BHT", nada: "aman" };
    }
  }

  // --- Putusan di e-Court --------------------------------------------------
  {
    const pe = status.putusanEcourt;
    if (!pe) {
      hasil.putusanEcourt = { teks: "belum putus", nada: "netral" };
    } else if (pe.keadaan === "putusan_ecourt_error") {
      hasil.putusanEcourt = { teks: "tidak terbit di e-Court", nada: "lewat" };
    } else if (pe.perluTindakan) {
      hasil.putusanEcourt = { teks: pe.sebutan || "perlu tindakan", nada: "mendesak" };
    } else {
      hasil.putusanEcourt = { teks: pe.sebutan || "beres", nada: "aman" };
    }
  }

  // --- Penilaian SK 048/2024 ----------------------------------------------
  {
    const sk = status.penilaianSk;
    const rinci = sk && Array.isArray(sk.rinci) ? sk.rinci : [];
    if (rinci.length === 0) {
      hasil.penilaianSk = { teks: "belum dapat dihitung", nada: "netral" };
    } else {
      const penuh = rinci.filter((x) => x.terbaca && x.poin === 5).length;
      const kurang = rinci.filter((x) => x.terbaca && x.poin !== null && x.poin < 5).length;
      hasil.penilaianSk = {
        teks: `${penuh}/${rinci.length} penuh`,
        nada: kurang > 0 ? "mendesak" : "aman",
      };
    }
  }

  return hasil;
}

/**
 * Ringkasan yang dapat dihitung TANPA menunggu panggilan apa pun.
 *
 * Sumbernya konteks yang sudah di tangan saat panel digambar. Karena itu
 * lencana ini sudah terpasang sejak baris pertama tergambar, tidak menunggu
 * apa-apa - dan menu yang paling sering menuntut tindakan justru ada di sini.
 */
function ringkasanSeketika(konteks) {
  const hasil = {};
  const r = konteks.ringkasan || {};

  if (konteks.dokumen && konteks.dokumen.length > 0) {
    hasil.dokumen = { teks: String(konteks.dokumen.length), nada: "netral" };
  }

  if (konteks.selisih && konteks.selisih.length > 0) {
    const tinggi = konteks.selisih.filter((x) => x.kegentingan === "tinggi").length;
    hasil.selisih = {
      teks: `${konteks.selisih.length} tidak cocok`,
      nada: tinggi > 0 ? "lewat" : "mendesak",
    };
  }

  const berTenggat = (konteks.dokumen || []).filter(
    (d) => d.batasUnggahTeks || d.sisaHari !== null
  );
  if (berTenggat.length > 0) {
    // Yang paling mepet yang disebut - itulah yang menentukan mendesak
    // tidaknya, bukan rata-ratanya.
    const sisa = berTenggat
      .map((d) => d.sisaHari)
      .filter((x) => x !== null && x !== undefined);
    const paling = sisa.length > 0 ? Math.min(...sisa) : null;
    hasil.tenggat =
      paling === null
        ? { teks: `${berTenggat.length} dokumen`, nada: "netral" }
        : paling < 0
          ? { teks: `lewat ${Math.abs(paling)} hari`, nada: "lewat" }
          : {
              teks: paling === 0 ? "habis hari ini" : `${paling} hari lagi`,
              nada: paling <= (konteks.ambangMendesakHari || 3) ? "mendesak" : "netral",
            };
  }

  const nomor = konteks.nomorPihak || [];
  if (nomor.length > 0) {
    // Nilainya salah satu dari empat yang ditetapkan nomorVerificationService:
    // terverifikasi, menunggu, ditolak, belum_pernah_ditanya. TIDAK ada nilai
    // bernama "terkonfirmasi" - membandingkannya dengan itu membuat setiap
    // pihak terbaca bermasalah, termasuk yang nomornya justru sudah beres.
    const tanpaNomor = nomor.filter((x) => !x.adaNomor).length;
    const ditolak = nomor.filter((x) => x.adaNomor && x.statusVerifikasi === "ditolak").length;
    const belum = nomor.filter(
      (x) => x.adaNomor && x.statusVerifikasi !== "terverifikasi" && x.statusVerifikasi !== "ditolak"
    ).length;

    // Diurut menurut kegentingan: yang tidak punya nomor sama sekali tidak
    // dapat dihubungi; yang ditolak berarti salah alamat dan harus dibetulkan
    // di SIPP; yang belum dikonfirmasi masih menunggu jawaban.
    hasil.nomorPihak =
      tanpaNomor > 0
        ? { teks: `${tanpaNomor} tanpa nomor`, nada: "lewat" }
        : ditolak > 0
          ? { teks: `${ditolak} salah alamat`, nada: "lewat" }
          : belum > 0
            ? { teks: `${belum} belum dikonfirmasi`, nada: "mendesak" }
            : { teks: `${nomor.length} terverifikasi`, nada: "aman" };
  }

  if (r.dokumen === 0 && nomor.length === 0) {
    hasil.dokumen = { teks: "tidak ada", nada: "netral" };
  }

  return hasil;
}

function gambarTahapan(isi, status) {
  const tahapan = status.tahapan;
  if (!tahapan || !tahapan.terbaca) {
    isi.appendChild(
      buatElemen("div", "aleta-kosong", (tahapan && tahapan.alasan) || "Tahapan tidak terbaca dari SIPP.")
    );
    return;
  }

  for (const tahap of tahapan.tahap || []) {
    const baris = buatElemen("div", "aleta-baris");
    baris.appendChild(buatElemen("div", "aleta-baris-judul", tahap.label || tahap.kunci));

    if (!tahap.terbaca) {
      baris.appendChild(buatElemen("div", "aleta-baris-ket", tahap.alasan || "tidak terbaca"));
      isi.appendChild(baris);
      continue;
    }

    const ket = buatElemen("div", "aleta-baris-ket", tahap.tanggal || "belum ada tanggal");

    // Jeda penginputan: inilah yang dinilai SK, dan yang tidak dapat dilihat
    // di SIPP tanpa menghitung sendiri dua tanggal di dua halaman berbeda.
    if (tahap.hariSampaiInput !== null && tahap.hariSampaiInput !== undefined) {
      const hari = Number(tahap.hariSampaiInput);
      const nada = hari <= 1 ? "aman" : hari <= 3 ? "mendesak" : "lewat";
      const tanda = buatElemen(
        "span",
        `aleta-tanda-panel aleta-tanda-${nada}`,
        hari <= 0 ? "diinput hari itu juga" : `diinput ${hari} hari kemudian`
      );
      ket.appendChild(document.createTextNode(" "));
      ket.appendChild(tanda);
    }
    baris.appendChild(ket);

    if (tahap.diinputOleh) {
      baris.appendChild(buatElemen("div", "aleta-baris-ket", `diinput ${tahap.diinputOleh}`));
    }
    isi.appendChild(baris);
  }
}

/** Kelengkapan berkas pokok: gugatan, relaas, dan berita acara sidang. */
function gambarBerkasSipp(isi, status) {
  const relaas = Array.isArray(status.relaas) ? status.relaas : [];
  const jadwal = Array.isArray(status.jadwal) ? status.jadwal : [];
  const berdokumen = relaas.filter((x) => x.adaDokumen).length;
  const berBas = jadwal.filter((x) => x.adaBas).length;

  isi.appendChild(
    barisNilai(
      "Gugatan / permohonan",
      status.petitum && status.petitum.ada ? "sudah diunggah" : "belum diunggah",
      status.petitum && status.petitum.ada ? "aman" : "lewat"
    )
  );
  isi.appendChild(
    barisNilai(
      "Relaas berdokumen",
      relaas.length === 0 ? "belum ada relaas" : `${berdokumen} dari ${relaas.length}`,
      relaas.length > 0 && berdokumen === relaas.length ? "aman" : "mendesak"
    )
  );
  isi.appendChild(
    barisNilai(
      "Berita acara sidang",
      jadwal.length === 0 ? "belum ada sidang" : `${berBas} dari ${jadwal.length} sidang`,
      jadwal.length > 0 && berBas === jadwal.length ? "aman" : "mendesak"
    )
  );

  const arsip = status.arsipKeterangan;
  if (arsip && arsip.terbaca) {
    isi.appendChild(
      barisNilai(
        "Arsip berkas",
        arsip.sudahDiarsipkan ? "sudah diarsipkan" : "belum diarsipkan",
        arsip.sudahDiarsipkan ? "aman" : "netral"
      )
    );
  }
}

/** Putusan dan upaya hukum sesudahnya. */
function gambarPutusan(isi, status) {
  const p = status.putusan || {};
  const lengkap = status.putusanLengkap || {};

  if (!p.sudahPutus) {
    isi.appendChild(buatElemen("div", "aleta-kosong", "Perkara ini belum diputus."));
    return;
  }

  isi.appendChild(barisNilai("Tanggal putusan", lengkap.tanggalPutusan || p.tanggalPutusan || "—"));
  if (lengkap.statusPutusan) isi.appendChild(barisNilai("Status putusan", lengkap.statusPutusan));
  if (lengkap.sumberHukum) isi.appendChild(barisNilai("Sumber hukum", lengkap.sumberHukum));
  isi.appendChild(barisNilai("Minutasi", p.tanggalMinutasi || "belum", p.tanggalMinutasi ? "aman" : "mendesak"));
  isi.appendChild(
    barisNilai("Berkekuatan hukum tetap", p.tanggalBht || "belum", p.tanggalBht ? "aman" : "netral")
  );

  const upaya = Array.isArray(status.upayaHukum) ? status.upayaHukum : [];
  if (upaya.length === 0) {
    isi.appendChild(barisNilai("Upaya hukum", "tidak ada yang tercatat", "netral"));
    return;
  }
  for (const u of upaya) {
    const sudah = (u.tahapan || []).filter((t) => t.tanggal).length;
    const dapat = (u.tahapan || []).filter((t) => t.adaKolom).length;
    isi.appendChild(
      barisNilai(
        u.jenis,
        [
          u.nomorPerkara || "tanpa nomor",
          u.dicabut ? "dicabut" : u.tanggalPutusan ? `diputus ${u.tanggalPutusan}` : "belum diputus",
          dapat > 0 ? `${sudah}/${dapat} tahap` : "",
        ]
          .filter(Boolean)
          .join(" · "),
        u.tanggalPutusan || u.dicabut ? "aman" : "mendesak"
      )
    );
  }
}

/**
 * Apakah putusannya benar-benar terbit di e-Court.
 *
 * Tiga hal dapat gagal berturut-turut tanpa satu pun peringatan: barisnya
 * tidak terbentuk di e-Court, salinannya belum diunggah, atau Panitera belum
 * menandatanganinya. Ketiganya baru ketahuan saat para pihak menanyakan
 * salinan putusannya.
 *
 * Panel ini melayang tepat di atas halaman SIPP yang sedang dibuka petugas -
 * tempat paling masuk akal untuk menyebutkannya.
 */
function gambarPutusanEcourt(isi, status) {
  const p = status.putusanEcourt;
  if (!p) {
    isi.appendChild(
      buatElemen("div", "aleta-kosong", "Perkara ini belum diputus, jadi belum ada yang diperiksa.")
    );
    return;
  }

  const nada =
    p.keadaan === "putusan_ecourt_error" ? "lewat" : p.perluTindakan ? "mendesak" : "aman";

  const kepala = buatElemen("div", `aleta-baris aleta-${nada}`);
  kepala.appendChild(buatElemen("div", "aleta-baris-judul", p.sebutan));
  if (p.keterangan) kepala.appendChild(buatElemen("div", "aleta-baris-ket", p.keterangan));
  isi.appendChild(kepala);

  const e = p.ecourt;
  if (!e) {
    isi.appendChild(
      buatElemen(
        "div",
        "aleta-baris-ket",
        "Keadaan e-Court perkara ini belum pernah dibaca ALETA."
      )
    );
    return;
  }

  if (e.nomorPutusan) isi.appendChild(barisNilai("Nomor putusan e-Court", e.nomorPutusan));
  if (e.tanggalPutusanTeks) isi.appendChild(barisNilai("Tanggal putusan", e.tanggalPutusanTeks));
  if (e.tanggalBhtTeks) isi.appendChild(barisNilai("Tanggal BHT", e.tanggalBhtTeks));

  isi.appendChild(
    barisNilai(
      "Dokumen salinan putusan",
      e.dokumenAda ? "sudah diunggah" : "belum diunggah",
      e.dokumenAda ? "aman" : "mendesak"
    )
  );
  isi.appendChild(barisNilai("Diupload oleh", e.diunggahOleh || "\u2014"));
  isi.appendChild(barisNilai("Tanggal upload", e.tanggalUnggahTeks || "\u2014"));
  isi.appendChild(barisNilai("Panitera", e.paniteraNama || "\u2014"));
  isi.appendChild(
    barisNilai(
      "Tanda tangan elektronik",
      e.paniteraTte
        ? `sudah di-TTE${e.paniteraTanggalTte ? ` \u00b7 ${e.paniteraTanggalTte}` : ""}`
        : "belum di-TTE oleh Panitera",
      e.paniteraTte ? "aman" : "mendesak"
    )
  );
}

/** Penilaian SK Dirjen Badilag 048/2024 untuk perkara ini. */
function gambarPenilaian(isi, status) {
  const sk = status.penilaianSk;
  const rinci = sk && Array.isArray(sk.rinci) ? sk.rinci : [];
  if (rinci.length === 0) {
    isi.appendChild(buatElemen("div", "aleta-kosong", "Penilaian SK belum dapat dihitung."));
    return;
  }

  // Yang ditampilkan hanya unsur yang BELUM sempurna. Panel selebar 340 piksel
  // tidak dapat memuat dua puluh sembilan unsur, dan yang sudah bernilai penuh
  // tidak menuntut tindakan apa pun.
  const perluPerhatian = rinci.filter((x) => x.terbaca && x.poin !== null && x.poin < 5);
  const takTerbaca = rinci.filter((x) => !x.terbaca);

  isi.appendChild(
    barisNilai(
      "Unsur bernilai penuh",
      `${rinci.filter((x) => x.terbaca && x.poin === 5).length} dari ${rinci.length}`
    )
  );

  for (const unsur of perluPerhatian.slice(0, 12)) {
    const nada = unsur.poin === 0 ? "lewat" : unsur.poin <= 2 ? "mendesak" : "netral";
    isi.appendChild(barisNilai(unsur.label, `${unsur.poin} poin · ${unsur.keterangan || ""}`.trim(), nada));
  }
  if (perluPerhatian.length > 12) {
    isi.appendChild(
      buatElemen("div", "aleta-baris-ket", `dan ${perluPerhatian.length - 12} unsur lain di portal`)
    );
  }
  if (takTerbaca.length > 0) {
    isi.appendChild(barisNilai("Belum tersambung", `${takTerbaca.length} unsur`, "netral"));
  }
}

/**
 * Mengingat ukuran sesudah petugas selesai menarik sudutnya.
 *
 * Ditunda sejenak: menarik sudut memicu puluhan peristiwa per detik, dan
 * menulis penyimpanan sebanyak itu membuat tarikannya sendiri tersendat.
 */
function pasangPengingatUkuran(panel) {
  if (typeof ResizeObserver !== "function") return;
  let tunda = null;
  let pertama = true;

  const pengamat = new ResizeObserver(() => {
    // Pengukuran pertama datang dari penggambaran, bukan dari tarikan orang.
    if (pertama) {
      pertama = false;
      return;
    }
    if (tunda) clearTimeout(tunda);
    tunda = setTimeout(() => {
      const kotak = panel.getBoundingClientRect();
      simpanUkuran(Math.round(kotak.width), Math.round(kotak.height));
      panel.style.maxHeight = "none";
    }, 400);
  });

  pengamat.observe(panel);
}

/**
 * Menyalin teks ke papan klip.
 *
 * SIPP berjalan di HTTP, dan navigator.clipboard hanya tersedia pada konteks
 * aman. Jadi jalur cadangan di bawah bukan kemewahan - itulah yang biasanya
 * dipakai.
 *
 * Cadangannya memakai pemilihan teks pada elemen buatan sendiri, BUKAN
 * textarea yang diisi lewat .value. Mengisi .value adalah satu-satunya cara
 * ekstensi ini dapat menulis ke kolom formulir, dan kemampuan itu sengaja
 * tidak dimilikinya sama sekali - halaman SIPP memuat kolom yang mengubah
 * data perkara, dan larangan yang tidak punya pengecualian jauh lebih mudah
 * dijaga daripada larangan yang punya satu.
 */
async function salinTeks(teks) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(teks);
      return true;
    }
  } catch {
    /* jatuh ke cara cadangan */
  }

  try {
    const wadah = buatElemen("span", "aleta-salinan-sementara", teks);
    wadah.setAttribute(TANDA, "1");
    document.body.appendChild(wadah);

    const jangkauan = document.createRange();
    jangkauan.selectNodeContents(wadah);
    const pilihan = window.getSelection();
    pilihan.removeAllRanges();
    pilihan.addRange(jangkauan);

    const berhasil = document.execCommand("copy");

    pilihan.removeAllRanges();
    wadah.remove();
    return berhasil;
  } catch {
    return false;
  }
}

/** Baris nomor register e-Court beserta tombol salinnya. */
/**
 * Nilai yang disalin dengan menekannya.
 *
 * Tanpa tombol "Salin" tersendiri di sebelahnya - tombol itu memakan lebar
 * yang setara dengan nomor perkaranya sendiri, pada panel selebar 340 piksel.
 * Yang menggantikannya: nilainya sendiri dapat ditekan, dan berubah sebentar
 * jadi "Tersalin" supaya penekanannya terasa berhasil.
 */
function tombolSalin(nilai, judul) {
  const tombol = buatElemen("button", "aleta-salin-nilai", nilai);
  tombol.type = "button";
  tombol.title = judul || "Salin";
  tombol.addEventListener("click", async (peristiwa) => {
    peristiwa.stopPropagation();
    const semula = tombol.textContent;
    const berhasil = await salinTeks(nilai);
    tombol.textContent = berhasil ? "Tersalin" : "Gagal salin";
    tombol.classList.add("aleta-salin-berhasil");
    setTimeout(() => {
      tombol.textContent = semula;
      tombol.classList.remove("aleta-salin-berhasil");
    }, 1200);
  });
  return tombol;
}

function barisNomorRegister(nomorRegister) {
  const baris = buatElemen("div", "aleta-register");
  baris.appendChild(buatElemen("span", "aleta-register-label", "Register e-Court"));
  baris.appendChild(buatElemen("code", "aleta-register-nilai", nomorRegister));

  const tombol = buatElemen("button", "aleta-salin", "Salin");
  tombol.type = "button";
  // SIPP tidak menampilkan nomor register di mana pun, padahal itulah yang
  // dipakai untuk mencari perkara di e-Court. Selama ini petugas mengambilnya
  // lewat database.
  tombol.title = "Salin nomor register untuk dicari di e-Court";
  tombol.addEventListener("click", async () => {
    const berhasil = await salinTeks(nomorRegister);
    tombol.textContent = berhasil ? "Tersalin" : "Gagal salin";
    setTimeout(() => {
      tombol.textContent = "Salin";
    }, 1500);
  });

  baris.appendChild(tombol);
  return baris;
}

/** Keterangan verifikasi satu dokumen e-Court (butir 32). */
function ktnKetVerifikasi(d, nomor) {
  if (!d) return "";
  // Lama dan Baru-tanpa-saklar identik dengan fd9aad7 (syarat mutlak Tahap 7): bunyi lama; aturan baru di UI Baru.
  if (typeof alatUjiMode === "function" && alatUjiMode() !== "ui") {
    if (d.statusVerifikasi === "tidak_perlu") return "berkas pendaftaran";
    if (d.statusVerifikasi === "valid") return "sudah diverifikasi";
    if (d.statusVerifikasi === "tidak_valid") return "dinyatakan tidak valid";
    return "menunggu majelis";
  }
  if (d.statusVerifikasi === "tidak_perlu") return "berkas pendaftaran";
  if (d.statusVerifikasi === "valid") return "sudah diverifikasi";
  if (d.statusVerifikasi === "tidak_valid") return "dinyatakan tidak valid";
  if (ktnDokumenMenungguMajelis(d, nomor)) return "menunggu majelis";
  if (!d.diunggahPada && KTN_POLA_BERKAS_PENDAFTARAN.test(String(d.judulDokumen || "").trim())) return "berkas pendaftaran";
  return "";
}

/**
 * Penanda identitas perkara: jenis perkara, kumulasi, dan kuasa hukum.
 *
 * ============================================================================
 * TIDAK ADA PENANDA LEBIH BAIK DARIPADA PENANDA YANG KELIRU
 * ============================================================================
 *
 * Bila SIPP tidak terbaca, bot mengirim identitas bernilai null. Dalam keadaan
 * itu baris ini TIDAK muncul sama sekali. Menampilkan "tanpa kuasa" ketika yang
 * sebenarnya terjadi adalah "tidak terbaca" akan membuat petugas menyurati
 * pihak secara langsung padahal pihaknya berkuasa hukum - keliru yang tidak
 * kelihatan sampai suratnya sudah terkirim.
 */
function barisIdentitas(identitas) {
  if (!identitas || !identitas.ditemukan) return null;

  const baris = buatElemen("div", "aleta-identitas");

  if (identitas.jenisPerkara) {
    const chip = buatElemen("span", `aleta-tanda-jenis ${kelasJenis(identitas.jenisPerkara)}`, identitas.jenisPerkara);
    if (identitas.jenisPerkaraLengkap && identitas.jenisPerkaraLengkap !== identitas.jenisPerkara) {
      chip.title = identitas.jenisPerkaraLengkap;
    }
    baris.appendChild(chip);
  }

  if (identitas.adaKumulasi) {
    const chip = buatElemen("span", "aleta-tanda-kumulasi", `Kumulasi: ${identitas.kumulasi.join(", ")}`);
    chip.title = `Perkara ini dikumulasikan dengan ${identitas.kumulasi.length} jenis perkara lain.`;
    baris.appendChild(chip);
  }

  if (identitas.adaKuasa) {
    // Sisi mana yang berkuasa hukum menentukan kepada siapa pemberitahuan
    // dialamatkan - "pakai kuasa" saja tidak cukup untuk memutuskan itu.
    const sisi = [];
    if (identitas.kuasaPenggugat) sisi.push("penggugat/pemohon");
    if (identitas.kuasaTergugat) sisi.push("tergugat/termohon");

    const chip = buatElemen(
      "span",
      "aleta-tanda-kuasa",
      sisi.length > 0 ? `Kuasa: ${sisi.join(" & ")}` : "Pakai kuasa hukum"
    );
    chip.title = identitas.kuasa
      .map((k) => (k.pihak ? `${k.nama} (${k.pihak})` : k.nama))
      .join("\n");
    baris.appendChild(chip);
  }
  // Yang TIDAK berkuasa hukum tidak diberi chip. "Tanpa kuasa hukum" adalah
  // keadaan sebagian besar perkara, dan chip yang ada di hampir setiap
  // perkara berhenti dibaca - lalu chip kuasa yang sungguhan, yang jarang
  // dan justru menentukan kepada siapa surat dialamatkan, ikut tidak dibaca.

  return baris.childNodes.length > 0 ? baris : null;
}

/**
 * Membandingkan versi yang TERPASANG dengan versi yang disajikan portal.
 *
 * ============================================================================
 * MENGAPA INI ADA
 * ============================================================================
 *
 * Ekstensi yang dimuat unpacked - dan begitulah cara ekstensi ini dipasang -
 * TIDAK PERNAH diperbarui sendiri. Chrome memang tidak menyediakannya. Yang
 * terjadi kemudian: petugas berhari-hari menjalankan versi lama tanpa satu pun
 * tanda, dan gejalanya menyerupai kerusakan portal.
 *
 * Itu bukan dugaan. Pada 3 September 2026 tombol Kerjakan tidak muncul, dan
 * waktu terbuang mencari sebabnya di portal - padahal ekstensinya memang belum
 * diperbarui.
 *
 * ============================================================================
 * MENYERAH DIAM-DIAM
 * ============================================================================
 *
 * Bila alamatnya tidak terjangkau, jawabannya tidak dikenali, atau versinya
 * sama - TIDAK ada yang digambar. Pemberitahuan versi bukan hal yang layak
 * merusak panel bila pemeriksaannya sendiri gagal.
 */
function bandingVersi(a, b) {
  const pecah = (x) => String(x || "").split(".").map((n) => Number(n) || 0);
  const kiri = pecah(a);
  const kanan = pecah(b);
  for (let i = 0; i < Math.max(kiri.length, kanan.length); i += 1) {
    const selisih = (kiri[i] || 0) - (kanan[i] || 0);
    if (selisih !== 0) return selisih;
  }
  return 0;
}

async function periksaVersiEkstensi(isi) {
  let terpasang = "";
  try {
    terpasang = String(chrome.runtime.getManifest().version || "");
  } catch {
    return; // di luar konteks ekstensi
  }
  if (!terpasang) return;

  try {
    const respons = await fetch(`${ALETA_API_EKSTENSI}?info=versi`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!respons.ok) return;
    const luar = await respons.json();
    const data = luar && luar.data ? luar.data : luar;
    const disajikan = String((data && data.versi) || "");
    if (!disajikan) return;

    // Hanya bila portal LEBIH BARU. Versi pengembangan yang lebih maju daripada
    // portal tidak perlu ditegur.
    if (bandingVersi(disajikan, terpasang) <= 0) return;

    const kabar = buatElemen("div", "aleta-versi-baru");
    kabar.appendChild(
      buatElemen(
        "div",
        "aleta-versi-judul",
        `Versi baru tersedia: ${disajikan} — terpasang ${terpasang}`
      )
    );
    kabar.appendChild(
      buatElemen(
        "div",
        "aleta-versi-sebab",
        "Ekstensi tidak memperbarui dirinya sendiri. Unduh dari portal ALETA, lalu tekan Muat Ulang di halaman Ekstensi Chrome."
      )
    );
    isi.insertBefore(kabar, isi.firstChild);
  } catch {
    /* portal tidak terjangkau - panel tetap utuh tanpa pemberitahuan */
  }
}

/** Jati diri perkara yang dibawa pita, dari konteks panel perkara. */
/**
 * Kelas warna chip menurut KELUARGA jenis perkara.
 *
 * Cerai gugat dan cerai talak tampil sama persis selama ini, padahal
 * keduanya berbeda alur, berbeda pihak yang berperkara, dan berbeda medan
 * yang muncul pada borang putusan. Warnanya kini menyebut keluarganya, dan
 * dipakai pada chip pita DAN chip identitas di badan panel - dua chip untuk
 * satu jenis harus berwarna sama, atau keduanya berhenti dipercaya.
 *
 * Urutan pemeriksaannya penting: ekonomi syariah adalah gugatan, dan cerai
 * talak memuat kata "talak" yang tidak ada pada cerai gugat - jadi keduanya
 * diperiksa SEBELUM pola gugat yang lebih umum.
 */
function kelasJenis(jenis) {
  const j = String(jenis || "").toLowerCase();
  if (!j) return "aleta-jenis-lain";
  if (/syariah|ekonomi/.test(j)) return "aleta-jenis-syariah";
  if (/talak/.test(j)) return "aleta-jenis-talak";
  if (/gugat/.test(j)) return "aleta-jenis-gugat";
  if (
    /dispensasi|itsbat|isbat|wali|permohonan|penetapan|pdt\.?\s*p\b|poligami|perwalian|pengangkatan|asal.usul|ahli\s*waris/.test(
      j
    )
  ) {
    return "aleta-jenis-permohonan";
  }
  return "aleta-jenis-lain";
}

/**
 * ============================================================================
 * NOMOR PERKARA: KLIK MENUKAR, KLIK GANDA MENYALIN
 * ============================================================================
 *
 * Nomor perkara dipakai di SIPP; nomor register dipakai di e-Court. Petugas
 * yang berpindah antara keduanya membutuhkan yang satu lalu yang lain, dan
 * menyalinnya adalah pekerjaan yang paling sering dikerjakan di baris ini.
 *
 * Klik tunggal ditunda sekejap dan dibatalkan oleh klik ganda - tanpa
 * penundaan itu, tiap klik ganda menukar nomornya dua kali lalu menyalin
 * yang tampil sesudahnya, yakni yang semula. Yang disalin selalu yang sedang
 * TAMPIL, sebab itulah yang dilihat orang ketika menekannya.
 *
 * Menggantikan dua tombol salin yang dulu terpisah - nomor perkara di baris
 * kedua, nomor register di baris ketiga. Satu tempat untuk keduanya.
 */
function tombolNomorTukar(nomorPerkara, nomorRegister) {
  const nomor = String(nomorPerkara || "");
  const register = String(nomorRegister || "");
  const kotakNomor = buatElemen("span", "aleta-nomor-tukar", nomor);
  kotakNomor.setAttribute("role", "button");
  kotakNomor.tabIndex = 0;
  let tampilRegister = false;
  const judul = () =>
    register
      ? `${tampilRegister ? "Nomor register e-Court" : "Nomor perkara"}. Klik: tukar ke ${
          tampilRegister ? "nomor perkara" : "nomor register e-Court"
        }. Klik ganda: salin.`
      : "Nomor perkara yang sedang dibuka. Klik ganda: salin.";
  const gambar = () => {
    kotakNomor.textContent = tampilRegister ? register : nomor;
    kotakNomor.classList.toggle("aleta-nomor-tukar-register", tampilRegister);
    // Petunjuk dua detik memindahkan title ke data-aleta-tip pada sentuhan
    // pertama; keduanya diperbarui supaya penjelasannya mengikuti keadaan.
    kotakNomor.title = judul();
    if (kotakNomor.hasAttribute("data-aleta-tip")) kotakNomor.setAttribute("data-aleta-tip", judul());
  };
  gambar();
  let jamKlik = null;
  kotakNomor.addEventListener("click", () => {
    if (!register) return;
    if (jamKlik) clearTimeout(jamKlik);
    jamKlik = setTimeout(() => {
      jamKlik = null;
      tampilRegister = !tampilRegister;
      gambar();
    }, 250);
  });
  kotakNomor.addEventListener("dblclick", async () => {
    if (jamKlik) {
      clearTimeout(jamKlik);
      jamKlik = null;
    }
    const berhasil = await salinTeks(tampilRegister ? register : nomor);
    if (!berhasil) return;
    kotakNomor.classList.add("aleta-nomor-tukar-tersalin");
    setTimeout(() => kotakNomor.classList.remove("aleta-nomor-tukar-tersalin"), 700);
  });
  return kotakNomor;
}

function jatiPita(konteks) {
  const identitas = (konteks && konteks.identitas) || {};
  return {
    nomorPerkara: (konteks && konteks.nomorPerkara) || "",
    // Nomor register e-Court - yang dicari petugas di aplikasi e-Court, dan
    // yang selama ini harus dibuka lewat bagian tersendiri. Di pita ia
    // ditukar dengan satu klik.
    nomorRegister: (konteks && konteks.nomorRegister) || "",
    jenisPerkara: identitas.jenisPerkara || "",
    jenisPerkaraLengkap: identitas.jenisPerkaraLengkap || "",
  };
}

function susunPanel(konteks) {
  const panel = buatElemen("div", "aleta-panel");
  panel.id = PENANDA;

  // --- Kepala ---
  const kepala = buatElemen("div", "aleta-kepala");

  // Logo lembaga di kepala panel.
  //
  // Panel ini melayang di atas halaman SIPP dan tampilannya menyerupai bagian
  // SIPP sendiri. Logo membuat asalnya terbaca sekilas - siapa yang berbicara
  // di sini - tanpa perlu membaca tulisan apa pun.
  //
  // Berkasnya diambil lewat chrome.runtime.getURL: alamat chrome-extension://
  // yang benar hanya diketahui peramban. Bila gagal - berkas belum diumumkan
  // sebagai sumber terjangkau - logonya dilepas, dan kepalanya tetap utuh.
  try {
    const logo = document.createElement("img");
    logo.className = "aleta-logo";
    logo.alt = "";
    logo.src = chrome.runtime.getURL("ikon/aleta-32.png");
    logo.addEventListener("error", () => logo.remove());
    kepala.appendChild(logo);
  } catch {
    /* di luar konteks ekstensi: kepala tetap tampil tanpa logo */
  }

  kepala.appendChild(buatElemen("span", "aleta-merek", "ALETA"));

  // ==========================================================================
  // AKUN SIPP YANG SEDANG MASUK - DAN EMPAT KETERANGAN LAINNYA
  // ==========================================================================
  //
  // Satu keterangan yang menjawab pertanyaan paling menentukan sebelum menekan
  // apa pun: SIPP ini sedang dibuka dengan akun siapa. Selama ini jawabannya
  // hanya ada di sudut kanan atas halaman SIPP - tertutup panel ini sendiri
  // pada layar sempit, dan tidak terlihat sama sekali ketika panel dilebarkan.
  //
  // Dibaca dari halaman, bukan dari server: SIPP tidak menyediakan cara lain,
  // dan yang tertulis di halaman itulah yang menentukan siapa yang tercatat
  // ketika tombol Simpan SIPP ditekan.
  //
  // Bila tidak terbaca, TIDAK ditulis apa-apa. Menuliskan "tidak diketahui" di
  // kepala panel hanya menambah satu kata yang harus dibaca tiap kali tanpa
  // pernah menjawab apa pun.
  // Digambar oleh pitaIdentitas - bentuk yang sama persis dengan kaki panel.
  kepala.appendChild(pitaIdentitas(jatiPita(konteks)));

  pasangTombolKepala(panel, kepala, keadaanPanel);

  panel.appendChild(kepala);
  // 13 Okt butir 2: gembok tepat di bawah kepala - bawaan terbuka = panel
  // meringkas ke kepalanya saat menutupi tabel; terkunci = selalu penuh.
  if (typeof alatPasangGembok === "function") alatPasangGembok(panel, kepala, "sipp");
  pasangGeser(panel, kepala);
  pasangUbahUkuran(panel);
  pasangPengingatUkuran(panel);

  const isi = buatElemen("div", "aleta-isi");
  panel.appendChild(isi);

  // Pemberitahuan versi ditaruh PALING ATAS, sebelum keterangan perkara.
  //
  // Ekstensi yang dimuat unpacked tidak pernah memperbarui dirinya sendiri.
  // Bila yang terpasang tertinggal dari portal, gejalanya menyerupai kerusakan
  // portal - tombol yang tidak muncul, jawaban yang tidak dikenali - dan yang
  // dicari orang adalah kesalahan di tempat yang salah.
  void periksaVersiEkstensi(isi);

  // ==========================================================================
  // KEPALA PANEL: DUA BARIS, BUKAN ENAM
  // ==========================================================================
  //
  // Sebelumnya enam baris berdiri sendiri-sendiri sebelum menu pertama: umur
  // data, pengguna, klasifikasi, kuasa hukum, nomor register, dan ringkasan.
  // Keenamnya keterangan pendukung, dan keenamnya memakan tinggi yang sama
  // dengan enam baris menu - padahal yang dicari orang menunya.
  //
  // Sekarang dua: baris pertama tentang PERKARANYA, baris kedua tentang SIAPA
  // yang membaca dan sejauh mana datanya. Tidak ada yang dibuang.
  const usia = usiaData(konteks.diperiksaPada);

  // ------------------------------------------------------------------------
  // BARIS PERTAMA BADAN: NOMOR YANG DAPAT DITUKAR DAN CHIP IDENTITAS
  // ------------------------------------------------------------------------
  //
  // Nomor perkara dan nomor register e-Court berdiri di satu tempat ini:
  // klik menukar, klik ganda menyalin yang sedang tampil. Dulu keduanya dua
  // tombol salin terpisah di dua baris, dan pita di kepala mengulang
  // nomornya sekali lagi - tiga tempat untuk satu nomor.
  const barisPerkara = buatElemen("div", "aleta-kepala-perkara");
  if (konteks.nomorPerkara) {
    barisPerkara.appendChild(tombolNomorTukar(konteks.nomorPerkara, konteks.nomorRegister || ""));
  }

  // Chip identitas dipindahkan ke baris ini apa adanya - jenis perkara,
  // kumulasi, dan kuasa hukum tetap lengkap dengan judul dan warnanya.
  const identitas = barisIdentitas(konteks.identitas);
  if (identitas) {
    while (identitas.firstChild) barisPerkara.appendChild(identitas.firstChild);
  }
  if (barisPerkara.childNodes.length > 0) isi.appendChild(barisPerkara);

  // --- Baris 2: siapa membaca, dan sejauh mana datanya ---------------------
  const barisSiapa = buatElemen("div", "aleta-kepala-siapa");
  // Nama pengguna TIDAK diulang di sini - ia sudah berdiri di pita, satu
  // baris di atasnya. Chip perannya pindah ke kepala, berdampingan dengan
  // tombol tema: di sana ia terbaca sekilas tanpa menuntut baris tersendiri.
  // Nomor register tidak lagi punya tombolnya sendiri di sini - ia dapat
  // ditukar dari nomor perkara di baris pertama badan (tombolNomorTukar).

  // Umur data TIDAK ikut dipadatkan ketika ia bermasalah. Yang basi tetap
  // mendapat barisnya sendiri dan warnanya sendiri - itu satu-satunya
  // keterangan di kepala yang dapat membatalkan seluruh isi panel di bawahnya.
  if (usia.basi) {
    if (barisSiapa.childNodes.length > 0) isi.appendChild(barisSiapa);
    const tanda = buatElemen(
      "div",
      "aleta-usia aleta-usia-basi",
      `Data ALETA diperiksa ${usia.teks}`
    );
    tanda.title = "Data mungkin tertinggal dari e-Court.";
    isi.appendChild(tanda);
  } else {
    barisSiapa.appendChild(buatElemen("span", "aleta-kepala-usia", `diperiksa ${usia.teks}`));
    isi.appendChild(barisSiapa);
  }
  const r = konteks.ringkasan;
  const seketika = ringkasanSeketika(konteks);

  // Menu yang lencananya diisi panggilan latar. Dikumpulkan supaya dapat
  // diisi belakangan tanpa mencari-cari elemennya lagi di DOM.
  const menuMalas = {};

  // Daftar menu hidup dikosongkan tiap panel digambar ulang. Dibiarkan
  // bertambah, ia akan menyimpan menu dari perkara-perkara sebelumnya yang
  // elemennya sudah dibuang dari halaman - dan menggambar ulang menu yang
  // sudah tidak ada memanggil ALETA untuk sesuatu yang tidak ada yang melihat.
  menuMalasHidup = [];
  const kelompokSemua = [];

  /** Membuat menu malas sekaligus mendaftarkannya untuk diberi lencana. */
  const malas = (judul, kunci, gambar) => {
    const kotak = bagianMalas(judul, kunci, konteks.nomorPerkara, gambar);
    menuMalas[kunci] = kotak;
    return kotak;
  };

  // ==========================================================================
  // KERJAKAN DI PALING ATAS, DAN SATU-SATUNYA YANG TERBUKA
  // ==========================================================================
  //
  // Panel ini dibuka orang yang sedang MENGERJAKAN perkara, bukan yang sedang
  // membacanya. Sebelumnya Kerjakan duduk paling bawah di balik tiga kelompok
  // keterangan, sehingga menetapkan satu perkara menuntut menggulung melewati
  // berkas, tahapan, dan putusan lebih dahulu - tiap kali, untuk tiap perkara.
  //
  // Ketiga kelompok lain kini terlipat seluruhnya. Kepalanya tetap menyebutkan
  // yang paling genting di dalamnya, jadi yang hanya ingin membaca tidak
  // kehilangan apa pun - ia menekan sekali, dan itu memang niatnya.
  //
  // Digambar hanya bila perannya memang berwenang. Sebelumnya ketiganya tetap
  // muncul untuk semua orang dan baru menolak sesudah ditekan.
  // Kelompok ini digambar bila SALAH SATU isinya boleh dipakai. Menuntut
  // keduanya akan menyembunyikan Data Umum dari operator penjaga sidang, yang
  // justru dibuat untuk itu; menuntut salah satunya lalu menggambar keduanya
  // akan menawarkan papan penunjukan kepada yang tidak berwenang.
  // Perbaikan 5 Okt (butir 11) - UI Baru saja: Data Umum dari berkas gugatan
  // dan "Isi formulir Data Umum dari posita" PINDAH ke tab PTSP (kelompok
  // ptspKel di bawah). Penetapan menyisakan tautan ke sana. Lama dan Baru
  // tetap seperti sebelumnya.
  const pakaiPtsp = typeof s1Aktif === "function" && s1Aktif();
  if (boleh("penunjukan") || (boleh("data-umum") && !pakaiPtsp)) {
    const kelKerja = kelompok("Penetapan", "kerjakan", false);

    if (boleh("penunjukan")) kelKerja.isi.appendChild(bagianPenunjukan(konteks.nomorPerkara));
    // Perbaikan 2 Okt (S, butir 17 - UI Baru saja): upload edoc penetapan
    // PMH/PPP/PJS/PHS, otomatis dari ABT + manual. Menulis ke SIPP, jadi
    // kewenangannya sama dengan menuliskan penetapan.
    // 19 Okt 2026 (butir 7-8): unggah otomatis pindah ke tombol "e-Doc" di
    // tiap baris kartu Penetapan; yang tersisa di sini unggah MANUAL per
    // penetapan, sebagai bagian tersendiri.
    if (boleh("penunjukan") && typeof s2BagianEdocPenetapanManual === "function" && s1Aktif()) {
      kelKerja.isi.appendChild(s2BagianEdocPenetapanManual(konteks.nomorPerkara));
    }
    if (boleh("data-umum") && !pakaiPtsp) kelKerja.isi.appendChild(bagianDataUmum(konteks));
    if (boleh("data-umum") && pakaiPtsp) kelKerja.isi.appendChild(p5TautanPtsp());


    // Dan hanya di layar Info Perkara Agama (Data Umum). Dikenali dari borangnya
    // sendiri (#frm_data_umum) dengan alasan yang sama: alamat SIPP berubah
    // bentuk antar versi, id borangnya tidak.
    if (boleh("data-umum") && !pakaiPtsp && document.querySelector("#frm_data_umum")) {
      kelKerja.isi.appendChild(bagianIsiAlasanPerkara(konteks.nomorPerkara));
    }

    // Alat pemasangan, bukan keterangan perkara - jawabannya sama pada perkara
    // mana pun. Dibatasi ke Super Admin dan Admin, yang memang satu-satunya
    // yang dapat menyunting peta kolomnya.
    if (boleh("penunjukan-otomatis") && penggunaTerakhir && /admin/i.test(penggunaTerakhir.peran || "")) {
      kelKerja.isi.appendChild(bagianBacaBorang());
    }

    // Riwayat perbuatan ALETA pada perkara ini - termasuk yang gagal.
    // Ditaruh di kelompok yang sama dengan yang mengerjakannya: yang
    // bertanya "tadi jadi tidak?" sedang menatap tombol Tetapkan, bukan
    // sedang mencari menu lain.
    if (boleh("penunjukan")) kelKerja.isi.appendChild(bagianRiwayatAleta(konteks.nomorPerkara));

    isi.appendChild(kelKerja);
    kelompokSemua.push(kelKerja);
  }

  // ==========================================================================
  // PTSP (perbaikan 5 Okt butir 11 - UI Baru saja)
  // ==========================================================================
  //
  // Yang dikerjakan petugas PTSP/operator: Data Umum dari berkas gugatan,
  // isi formulir Data Umum dari posita (layar Data Umum), dan data
  // saksi/pihak dari foto KTP (saksiscan.js, golongan peran lain/admin).
  if (pakaiPtsp) {
    const kelPtsp = p5KelompokPtsp(konteks);
    if (kelPtsp) {
      isi.appendChild(kelPtsp);
      kelompokSemua.push(kelPtsp);
    }
  }

  // ==========================================================================
  // KELOMPOK BERKAS
  // ==========================================================================
  //
  // Dokumen yang masuk, tenggat yang berjalan, dan berkas yang belum lengkap.
  const kelBerkas = kelompok("Berkas", "berkas", true);

  // Selisih dengan e-Court paling atas: ia satu-satunya yang menyatakan ada
  // yang KELIRU, bukan sekadar belum selesai.
  if (konteks.selisih.length > 0) {
    const kotak = bagian("Tidak cocok dengan e-Court", "selisih");
    setLencana(kotak, seketika.selisih);
    for (const item of konteks.selisih) {
      const baris = buatElemen(
        "div",
        `aleta-baris aleta-${item.kegentingan === "tinggi" ? "lewat" : "mendesak"}`
      );
      baris.appendChild(buatElemen("div", "aleta-baris-judul", item.judulDokumen || "Dokumen"));
      baris.appendChild(buatElemen("div", "aleta-baris-ket", item.penjelasan));
      kotak.isi.appendChild(baris);
    }
    kelBerkas.isi.appendChild(kotak);
  }

  const berTenggat = konteks.dokumen.filter((d) => d.batasUnggahTeks || d.sisaHari !== null);
  if (berTenggat.length > 0) {
    const kotak = bagian("Batas waktu unggah e-Court", "tenggat");
    setLencana(kotak, seketika.tenggat);
    for (const d of berTenggat) {
      const sisa = keteranganSisa(d.sisaHari, konteks.ambangMendesakHari);
      const baris = buatElemen("div", `aleta-baris${sisa ? ` aleta-${sisa.nada}` : ""}`);
      baris.appendChild(
        buatElemen("div", "aleta-baris-judul", d.judulDokumen || d.agenda || "Dokumen")
      );
      const ket = buatElemen("div", "aleta-baris-ket");
      ket.textContent = d.batasUnggahTeks || "";
      if (sisa) {
        const tanda = buatElemen("span", `aleta-tanda-panel aleta-tanda-${sisa.nada}`, sisa.teks);
        ket.appendChild(document.createTextNode(" "));
        ket.appendChild(tanda);
      }
      baris.appendChild(ket);
      kotak.isi.appendChild(baris);
    }
    kelBerkas.isi.appendChild(kotak);
  }

  if (konteks.dokumen.length > 0) {
    const kotak = bagian("Dokumen e-Court", "dokumen");
    setLencana(kotak, seketika.dokumen);

    // ========================================================================
    // DIPISAH: BERKAS PENDAFTARAN DAN BERKAS JAWAB-MENJAWAB
    // ========================================================================
    //
    // Diminta pengguna 22 September 2026 - ia menyebutkan jawaban, replik,
    // duplik, duplik rekonvensi, kesimpulan, dan fotokopi alat bukti, dan
    // mengira berkas itu belum ditarik ALETA. Sudah ditarik sejak lama; yang
    // membuatnya tidak terlihat adalah tombol unduhnya yang disembunyikan
    // (lihat sippKonteksService.dokumenPerkara) dan daftar yang tercampur.
    //
    // Pemisahnya statusVerifikasi "tidak_perlu" - itulah tanda yang SIPP dan
    // e-Court sendiri pakai untuk berkas pendaftaran, yang memang tidak
    // diverifikasi majelis. Bukan tebakan dari judulnya.
    //
    // Yang dicari hakim hampir selalu berkas jawab-menjawab, jadi kelompok itu
    // digambar LEBIH DULU. Berkas pendaftaran dibaca sekali di awal perkara.
    const pendaftaran = (konteks.dokumen || []).filter((d) => d.statusVerifikasi === "tidak_perlu");
    const persidangan = (konteks.dokumen || []).filter((d) => d.statusVerifikasi !== "tidak_perlu");
    const berurut = [
      { judul: "Berkas jawab-menjawab", isi: persidangan },
      { judul: "Berkas pendaftaran", isi: pendaftaran },
    ];

    for (const kelompok of berurut) {
      if (kelompok.isi.length === 0) continue;
      // Kepala kelompok hanya digambar bila KEDUANYA ada. Satu judul di atas
      // satu-satunya kelompok tidak menerangkan apa pun, hanya memakan baris.
      if (pendaftaran.length > 0 && persidangan.length > 0) {
        kotak.isi.appendChild(
          buatElemen(
            "div",
            "aleta-sub-judul",
            `${kelompok.judul} (${kelompok.isi.length})`
          )
        );
      }
      for (const d of kelompok.isi) gambarBarisDokumen(d, kotak);
    }

    // ========================================================================
    // SAKLAR YANG MATI SEJAK AWAL HARUS DISEBUTKAN, BUKAN DITUNGGU
    // ========================================================================
    //
    // ALETA sudah lama dapat menempelkan berkas jawab-menjawab langsung ke
    // baris Jadwal Sidang SIPP, di samping tombol Unggah BAS - dicocokkan
    // menurut agendanya. Tetapi saklarnya MATI sejak awal, dan tidak ada satu
    // pun tempat di panel ini yang menyebutkan bahwa saklar itu ada.
    //
    // Akibatnya kemampuan itu tidak pernah dipakai siapa pun, dan pengguna
    // memintanya sebagai hal baru pada 22 September 2026. Fitur yang tidak
    // diketahui sama dengan fitur yang tidak ada.
    //
    // Hanya disebut bila memang ADA yang dapat ditempelkan - kalimat yang
    // muncul pada perkara tanpa berkas persidangan hanya menambah satu baris
    // yang tidak menawarkan apa pun.
    if (persidangan.length > 0 && !saklar.sisipJadwal) {
      kotak.isi.appendChild(
        buatElemen(
          "div",
          "aleta-tetap-sebab aleta-remeh",
          `${persidangan.length} berkas jawab-menjawab ini dapat ditempelkan langsung ke baris ` +
            "Jadwal Sidang SIPP, di samping tombol Unggah BAS, dicocokkan menurut agendanya. " +
            'Nyalakan "Sisipkan berkas ke Jadwal Sidang" di tingkap ALETA (ikon ekstensi).'
        )
      );
    }

    // Badan penggambar satu baris - dipisah supaya kedua kelompok memakai
    // penggambar yang SAMA. Dua salinan yang lambat laun berbeda adalah cara
    // tercepat membuat satu kelompok kehilangan tombol yang dimiliki kelompok
    // lain tanpa ada yang menyadarinya.
    // eslint-disable-next-line no-inner-declarations
    function gambarBarisDokumen(d, kotakDok) {
      const baris = buatElemen("div", "aleta-baris");
      baris.appendChild(buatElemen("div", "aleta-baris-judul", d.judulDokumen || "Dokumen"));

      const bagianKet = [];
      if (d.peranPengunggah) bagianKet.push(`dari ${d.peranPengunggah}`);
      // Butir 32: satu definisi dengan bot - lihat ktnKetVerifikasi.
      const ketVerifikasi = ktnKetVerifikasi(d, typeof cariNomorPerkara === "function" ? cariNomorPerkara() : "");
      if (ketVerifikasi) bagianKet.push(ketVerifikasi);
      if (d.sudahDiberitahukan) bagianKet.push("pihak sudah diberi tahu");
      else if (d.alasanTidakDiberitahukan) {
        bagianKet.push(d.alasanTidakDiberitahukan.replace(/_/g, " "));
      }
      baris.appendChild(buatElemen("div", "aleta-baris-ket", bagianKet.join(" · ")));

      const tombolBerkas = buatElemen("div", "aleta-berkas");
      if (d.adaPdf) tombolBerkas.appendChild(tombolUnduh(d, "pdf", "PDF"));
      if (d.adaWord) tombolBerkas.appendChild(tombolUnduh(d, "word", "Word"));
      if (!d.adaPdf && !d.adaWord) {
        // Tercatat pernah diunduh tetapi berkasnya hilang dari cakram
        // DIBEDAKAN dari tidak pernah ada. Tindakannya berbeda: yang satu
        // menyuruh memeriksa arsipnya, yang lain menyuruh pihak mengunggah.
        // Arsip e-Court pernah lenyap seluruhnya di sini karena volume Docker
        // belum di-mount, dan lenyapnya tidak berbunyi apa pun.
        // Sejak 25 September 2026 ada keadaan KETIGA, dan ia yang paling
        // menyesatkan bila disamakan: catatan berkasnya TIDAK TERBACA.
        //
        // Dahulu kegagalan kueri catatan berkas ditelan `.catch(() => [])`,
        // sehingga adaPdf/adaWord jatuh ke salah dan ekstensi menulis "berkas
        // belum tersimpan" - kalimat yang menyuruh panitera menagih pihak atas
        // berkas yang mungkin sudah lama ada. Sekarang bot menandainya
        // berkasTidakTerbaca, dan yang tidak diketahui disebut tidak diketahui.
        tombolBerkas.appendChild(
          buatElemen(
            "span",
            "aleta-berkas-kosong",
            d.berkasTidakTerbaca
              ? "catatan berkasnya tidak terbaca - bukan berarti tidak ada"
              : d.berkasHilang
                ? "tercatat ada, berkasnya hilang dari arsip"
                : "berkas belum tersimpan"
          )
        );
      }
      baris.appendChild(tombolBerkas);

      // Tombol verifikasi hanya untuk hakim pada majelis perkara ini, dan
      // hanya untuk dokumen yang belum diverifikasi. Jawaban "boleh atau
      // tidak" datang dari server - ekstensi tidak menebaknya sendiri.
      // Berkas pendaftaran tidak dapat diverifikasi di e-Court, jadi
      // tombolnya tidak boleh muncul: menampilkannya berarti mengundang hakim
      // mengambil keputusan hukum atas dokumen yang tidak menunggu keputusan
      // apa pun.
      if (
        konteks.hakim &&
        konteks.hakim.bolehVerifikasi &&
        d.statusVerifikasi !== "valid" &&
        d.statusVerifikasi !== "tidak_perlu"
      ) {
        baris.appendChild(kotakVerifikasi(d));
      }
      kotakDok.isi.appendChild(baris);
    }

    kelBerkas.isi.appendChild(kotak);
  }

  kelBerkas.isi.appendChild(malas("Kelengkapan berkas SIPP", "berkasSipp", gambarBerkasSipp));
  isi.appendChild(kelBerkas);
  kelompokSemua.push(kelBerkas);

  // ==========================================================================
  // KELOMPOK 2 - PERKARA
  // ==========================================================================
  //
  // Bagaimana perkara ini berjalan: tahapannya sampai mana, nomor pihaknya
  // sudah dikonfirmasi belum, dan bagaimana penilaiannya menurut SK.
  //
  // Tertutup sebagai bawaan - pertanyaannya penting tetapi tidak mendesak,
  // dan kepalanya sudah menyebutkan yang paling genting di dalamnya.
  const kelPerkara = kelompok("Perkara", "perkara", true);
  kelPerkara.isi.appendChild(malas("Tahapan dan ketepatan input", "tahapan", gambarTahapan));
  // Butir 29 (Baru & UI Baru, panitera/admin): Court Calendar otomatis. Lama: null.
  const bagianCc = ccBagian(konteks);
  if (bagianCc) kelPerkara.isi.appendChild(bagianCc);

  // Menu Nomor pihak ikut dimatikan bersama penandanya - lihat
  // TANDAI_NOMOR_PIHAK. Menyisakan menunya di panel sementara penandanya
  // hilang dari halaman menghasilkan dua keterangan yang berselisih tentang
  // hal yang sama.
  if (TANDAI_NOMOR_PIHAK && konteks.nomorPihak.length > 0) {
    // Nomor pihak terlipat sendiri di dalam kelompoknya: keadaan nomor jarang
    // jadi alasan orang membuka panel ini, dan daftar nomor yang selalu
    // terbuka memajang data pribadi lebih lama daripada perlu.
    const kotak = bagian("Nomor pihak", "nomorPihak", true);
    setLencana(kotak, seketika.nomorPihak);
    for (const orang of konteks.nomorPihak) {
      const keadaan = orang.adaNomor
        ? STATUS_NOMOR[orang.statusVerifikasi] || STATUS_NOMOR.belum_pernah_ditanya
        : { teks: "tidak ada nomor di SIPP", nada: "lewat" };

      const baris = buatElemen("div", `aleta-baris aleta-${keadaan.nada}`);
      baris.appendChild(buatElemen("div", "aleta-baris-judul", orang.nama));
      baris.appendChild(
        buatElemen(
          "div",
          "aleta-baris-ket",
          `${orang.nomorSamar ? `${orang.nomorSamar} · ` : ""}${keadaan.teks}`
        )
      );
      kotak.isi.appendChild(baris);
    }
    kelPerkara.isi.appendChild(kotak);
  }

  // t7GambarPenilaian memanggil gambarPenilaian apa adanya dalam tampilan Lama.
  kelPerkara.isi.appendChild(malas("Penilaian SK 048/2024", "penilaianSk", typeof t7GambarPenilaian === "function" ? t7GambarPenilaian : gambarPenilaian));
  isi.appendChild(kelPerkara);
  kelompokSemua.push(kelPerkara);

  // ==========================================================================
  // KELOMPOK 3 - PUTUSAN
  // ==========================================================================
  //
  // Pada perkara yang belum putus, kedua menu di dalamnya memang kosong - dan
  // kepalanya menyebutkan "belum putus" tanpa perlu dibuka. Itulah yang dulu
  // menuntut membuka dua menu untuk menemukan dua keterangan kosong.
  // ==========================================================================
  // PUTUSAN OTOMATIS DUDUK DI KELOMPOK PUTUSAN, BUKAN PENETAPAN
  // ==========================================================================
  //
  // Sebelumnya ia duduk di kelompok Penetapan, bersama papan penunjukan
  // majelis dan Data Umum. Itu keliru dua kali: yang mencarinya orang yang
  // sedang membuka borang Putusan Akhir, dan yang dikerjakannya putusan -
  // bukan penetapan. Yang mencari fitur ini membuka kelompok Putusan lebih
  // dahulu, tidak menemukannya, lalu menyimpulkan fiturnya tidak ada.
  //
  // Kelompoknya juga DIBENTANGKAN ketika borang putusan sedang terbuka.
  // Yang sedang berdiri di layar Putusan Akhir tidak sedang menunggu
  // diminta menekan satu lipatan lagi.
  const adaBorangPutusan = Boolean(document.querySelector("#frm_putusan"));
  const kelPutusan = kelompok("Putusan", "putusanKel", !adaBorangPutusan);
  // ==========================================================================
  // HAK UNGGAH PUTUSAN = PERAN (keputusan 9 Okt 2026)
  // ==========================================================================
  //
  // Putusan otomatis (isian borang + simpan), unggah e-Doc putusan, upload ke
  // e-Court, dan antrean putusan massal HANYA untuk Hakim (termasuk
  // Ketua/Wakil), Admin, dan Super Admin - alatBolehUnggahPutusan. Peran lain
  // melihat kotak terkunci beralasan di tempatnya; menu baca ("Putusan dan
  // upaya hukum", "Putusan di e-Court") tetap. null = peran belum terbaca:
  // digambar seperti biasa, peladen yang menolak 403.
  const hakPutusan = typeof alatBolehUnggahPutusan === "function" ? alatBolehUnggahPutusan(penggunaTerakhir) : null;
  const bolehPutusan = hakPutusan !== false;
  if (!bolehPutusan && typeof alatKotakTerkunciPutusan === "function") {
    kelPutusan.isi.appendChild(alatKotakTerkunciPutusan("Putusan otomatis, unggah e-Doc putusan, dan upload ke e-Court"));
  }
  if (bolehPutusan && boleh("data-umum") && adaBorangPutusan) {
    const kotakIsiPutusan = bagianIsiPutusan(konteks.nomorPerkara);
    kelPutusan.isi.appendChild(kotakIsiPutusan);
    // Butir 6 (1.189.x): borang dibuka lagi atas putusan yang sudah ada.
    b6PeringatkanBilaTerisi(kotakIsiPutusan, konteks.nomorPerkara);
  } else if (bolehPutusan && boleh("data-umum") && typeof s1BagianPutusanTanpaBlangko === "function" && s1Aktif()) {
    // Perbaikan 1 Okt (S, butir 3 - UI Baru saja): Putusan otomatis juga
    // tersedia sebelum blangko dibuka; ALETA membuka blangkonya sendiri.
    const kotakTanpaBlangko = s1BagianPutusanTanpaBlangko(konteks.nomorPerkara);
    kelPutusan.isi.appendChild(kotakTanpaBlangko);
    // Butir 6 (1.189.x): putusan sudah terisi di SIPP = disembunyikan.
    b6SembunyikanBilaTerisi(kotakTanpaBlangko, konteks.nomorPerkara);
  }
  // Unggahan MENULIS ke SIPP - berkas ke cakram, empat baris ke basis
  // datanya. Dahulu menumpang kemampuan "penunjukan" (gerbang PENETAPAN);
  // sejak 9 Okt 2026 hak PERAN tersendiri (bolehPutusan). Tidak digantungkan
  // pada borang putusan yang terbuka: berkas putusan kerap diunggah
  // belakangan, pada hari yang lain.
  if (bolehPutusan) {
    kelPutusan.isi.appendChild(bagianUnggahPutusanSipp(konteks.nomorPerkara));
  }
  // Perbaikan 1 Okt (S, butir 16b - UI Baru saja): Upload putusan ke e-Court,
  // tepat di bawah unggah edoc ke SIPP. Aturan haknya sama (9 Okt 2026).
  if (bolehPutusan && typeof s1BagianUnggahEcourt === "function" && s1Aktif()) {
    kelPutusan.isi.appendChild(s1BagianUnggahEcourt(konteks.nomorPerkara));
  }
  // Antrean putusan massal - bila ada, disisipkan di puncak isi supaya
  // langkah yang sedang ditunggu terbaca lebih dulu daripada perkaranya.
  if (bolehPutusan && boleh("data-umum")) {
    void bagianAntreanSipp(konteks.nomorPerkara).then((k) => {
      if (k && isi.isConnected) isi.insertBefore(k, isi.firstChild);
    });
  }
  kelPutusan.isi.appendChild(malas("Putusan dan upaya hukum", "putusan", gambarPutusan));
  kelPutusan.isi.appendChild(malas("Putusan di e-Court", "putusanEcourt", gambarPutusanEcourt));
  isi.appendChild(kelPutusan);
  kelompokSemua.push(kelPutusan);

  // --- Tidak ada apa-apa untuk perkara ini ---
  if (r.dokumen === 0 && konteks.nomorPihak.length === 0) {
    isi.appendChild(
      buatElemen("div", "aleta-kosong", "Belum ada data e-Court untuk perkara ini di ALETA.")
    );
  }

  for (const kel of kelompokSemua) kel.perbaruiRingkas();

  // ==========================================================================
  // LENCANA YANG MENYUSUL
  // ==========================================================================
  //
  // Lima menu di atas berbagi SATU panggilan, dan hasilnya memang sudah
  // disimpan per nomor perkara - membuka salah satunya sudah menarik data
  // kelimanya. Yang dikerjakan di sini hanya memajukan panggilan itu supaya
  // lencananya terisi tanpa ada yang perlu membuka apa pun.
  //
  // DITUNDA dan di latar, bukan sebelum panel digambar. Panelnya tetap muncul
  // seketika seperti sebelumnya; lencananya menyusul sedetik kemudian. Kalau
  // dijalankan lebih dulu, seluruh panel menunggu satu panggilan yang bahkan
  // belum tentu ada yang membutuhkannya.
  //
  // Kegagalannya DIABAIKAN diam-diam: lencana adalah kenyamanan, dan menu yang
  // gagal memuat sudah menyebutkan sebabnya sendiri saat dibuka.
  const tundaLencana = setTimeout(() => {
    void (async () => {
      try {
        const status = await ambilStatusPerkara(konteks.nomorPerkara);
        const ringkas = ringkasanBagian(status);
        for (const [kunci, nilai] of Object.entries(ringkas)) {
          setLencana(menuMalas[kunci], nilai);
        }
        for (const kel of kelompokSemua) kel.perbaruiRingkas();
      } catch (galat) {
        /* lencana tidak terisi - menunya tetap dapat dibuka seperti biasa */
      }
    })();
  }, 900);

  // Dibatalkan bila panelnya digambar ulang sebelum panggilannya berangkat -
  // berpindah perkara dengan cepat tidak boleh meninggalkan antrean panggilan
  // untuk perkara yang sudah tidak dilihat siapa pun.
  panel.batalLencana = () => clearTimeout(tundaLencana);

  // Kaki = kepala. Satu fungsi menggambar keduanya; lihat pitaIdentitas.
  panel.appendChild(kakiPanel(jatiPita(konteks)));

  // Tampilan Baru / UI Baru (Tahap 7) menata panel yang sudah jadi ini. Dalam
  // tampilan Lama ia hanya mencatat tanda tampilannya dan pulang.
  if (typeof t7Tata === "function") t7Tata(panel, konteks);

  return panel;
}
const T7_KUNCI_LEBAR = "lebarLabuhPanelSipp";
const T7_KUNCI_CATATAN = "catatanPerkaraSipp";
/** Milik checklist.js dan berkas ini (riwayatPerkaraSipp) - hanya DIBACA di sini. */
const T7_KUNCI_TAUTAN_SIPP = "tautanPerkaraSipp";
const T7_KUNCI_PERAN_CHECKLIST = "peranChecklistMilestone";
const T7_API_TEMPLAT = "/aleta/api/aleta-ecourt/templat-hukum";
const T7_API_KOMENTAR_BAS = "/aleta/api/aleta-ecourt/bas-komentar";
const T7_API_CHECKLIST = "/aleta/api/aleta-ecourt/checklist";
const T7_API_MASUKAN = "/aleta/api/feedback";
const T7_TAB = [
  ["kerjakan", "Penetapan"],
  // Perbaikan 5 Okt (butir 11): tab PTSP - Data Umum dari berkas gugatan
  // (pindahan dari Penetapan) dan data saksi/pihak dari foto KTP. Hanya
  // lahir di UI Baru (lihat a30/kelompok "ptspKel" di tampilkan()).
  ["ptspKel", "PTSP"],
  ["berkas", "Berkas"],
  ["perkara", "Perkara"],
  ["putusanKel", "Putusan"],
  // Perbaikan 30 Sep (butir 15): tab Juru Sita - kelompoknya hanya lahir di
  // UI Baru, untuk peran yang boleh, dan bila jurusita.js termuat (a30JuruSita).
  ["juruSitaKel", "Juru Sita"],
  // 1.189.x (butir 3): tab Kasir - kasir/keuangan/panitera/admin (a30Kasir).
  ["kasirKel", "Kasir"],
];
const T7_LEBAR_MIN = 360;
const T7_CATATAN_MAKS = 100;
/**
 * Ambang SK 048/2024 yang DIPAKAI PENILAIAN SK (keputusan pengguna untuk
 * sipp-14): tangga minutasi dan publikasi, serta batas waktu putus bernilai
 * penuh. Sumbernya aleta_bot/services/penilaianSippService.js - DISALIN,
 * sebab ekstensi tidak memuat berkas bot. Uji tahap 7 membaca kedua berkas
 * dan menuntut angkanya sama, supaya pengingat ini tidak pernah menjanjikan
 * nilai yang berbeda dengan Penilaian SK di menu sebelahnya.
 */
const T7_SK = {
  tanggaSesudahPutus: [
    [2, 5],
    [5, 3],
    [9, 2],
    [14, 1],
  ],
  putusHariPenuh: 90,
};
let t7CtrlKTerpasang = false;

/** Ide sipp-N yang juga menjadi perbaikan desain: dalam UI Baru selalu, di Baru bila saklarnya menyala. */
function t7Pakai(kode, jugaDesainUi) {
  return (jugaDesainUi && t7Modern()) || t7Nyala(kode);
}

function t7AdaIde() {
  for (let i = 1; i <= 30; i += 1) if (t7Nyala(`sipp-${i}`)) return true;
  return false;
}

// ─── Perkakas kecil ──────────────────────────────────────────────────────────

function t7Tombol(teks, judul, kelas) {
  const t = buatElemen("button", `aleta-t7-tombol${kelas ? ` ${kelas}` : ""}`, teks);
  t.type = "button";
  if (judul) t.title = judul;
  return t;
}

function t7Kartu(judul, kode) {
  const kartu = buatElemen("section", "aleta-t7-kartu");
  if (kode) kartu.setAttribute("data-t7-fitur", kode);
  if (judul) kartu.appendChild(buatElemen("div", "aleta-t7-kartu-judul", judul));
  return kartu;
}

function t7Ket(teks, kelas) {
  return buatElemen("div", `aleta-t7-ket${kelas ? ` ${kelas}` : ""}`, teks);
}

/** Kabar jujur untuk rute yang belum ada di server. */
function t7BelumTersedia(teks) {
  return buatElemen("div", "aleta-t7-belum", teks);
}

function t7KunciNomor(nomor) {
  return String(nomor || "").replace(/\s+/g, "").toUpperCase();
}

/** Tanggal dari teks SIPP/ALETA: "2026-09-20", "20-09-2026", "20/09/2026", "20 September 2026". */
function t7Tanggal(teks) {
  const s = String(teks || "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const dariSipp = typeof tanggalDariTeksSipp === "function" ? tanggalDariTeksSipp(s) : "";
  if (dariSipp) {
    const t = dariSipp instanceof Date ? dariSipp : new Date(String(dariSipp));
    if (!Number.isNaN(t.getTime())) return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }
  return null;
}

/** Selisih hari kalender a -> b (tanpa jam). */
function t7SelisihHari(a, b) {
  const x = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const y = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((y - x) / 86400000);
}

function t7Tangga(ukuran, daftar, sisa) {
  for (const [batas, poin] of daftar) if (ukuran <= batas) return poin;
  return sisa;
}

function t7TanggalTampil(t) {
  const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${t.getDate()} ${bulan[t.getMonth()]} ${t.getFullYear()}`;
}

// ─── Titik sambung di jalur lama ─────────────────────────────────────────────

/**
 * Ujung susunPanel. Dalam Lama: catat tandanya, pulang. Kegagalan di dalam
 * penataan TIDAK boleh menjatuhkan panelnya - panel lama tetap tampil utuh.
 */
function t7Tata(panel, konteks) {
  t7TandaPanel.set(panel, t7TandaTampilan());
  if (!t7Aktif()) return;
  const ui = t7Modern();
  // Perbaikan 30 September 2026 (butir 6, 15, 26): berlaku di Baru DAN UI
  // Baru tanpa saklar - penjelasan panjang dilipat di balik ⓘ, bagian/tab
  // Juru Sita. Dijalankan SEBELUM penataan Tahap 7 supaya tab Juru Sita ikut
  // tersusun. Lama tidak pernah sampai ke sini.
  try {
    if (typeof a30Tata === "function") a30Tata(panel, konteks || {}, ui);
  } catch (galat) {
    try {
      alatCatat("a30", "perbaikan 30 Sep pada panel SIPP gagal", String((galat && galat.message) || galat));
    } catch {
      /* kotak hitam tidak tersedia */
    }
  }
  // Baru tanpa satu pun saklar sipp-N: selain perbaikan 30 Sep di atas, tidak
  // ada yang ditambahkan - panelnya sama dengan Lama.
  if (!ui && !t7AdaIde()) return;
  try {
    t7TataSungguh(panel, konteks || {}, ui);
    // Menu per peran (30 Sep sore) sekali lagi: chip daftar isi sipp-2 dan
    // tab lahir di t7TataSungguh. Idempoten.
    if (typeof mpsTerapkan === "function") mpsTerapkan(panel);
    // Perbaikan 1 Okt (S, butir 1 & 16) - UI Baru saja: lipat seragam dan
    // bagian di dalam tab menurut peran.
    if (ui && typeof s1Tata === "function") s1Tata(panel, konteks || {});
  } catch (galat) {
    try {
      alatCatat("t7", "penataan panel SIPP gagal", String((galat && galat.message) || galat));
    } catch {
      /* kotak hitam tidak tersedia */
    }
  }
}

/** Menu Penilaian SK: Lama menggambar apa adanya; D12 / sipp-8 tabel skor ringkas. */
function t7GambarPenilaian(isi, status) {
  if (!t7Pakai("sipp-8", true)) return gambarPenilaian(isi, status);
  return t7GambarPenilaianRingkas(isi, status);
}

/** Rapor praperiksa: Lama apa adanya; D11 / sipp-7 kartu bertingkat dengan tindakan. */
function t7RaporAgen(rapor) {
  if (!t7Pakai("sipp-7", true)) return gambarRaporAgen(rapor);
  return t7RaporBertingkat(rapor);
}

/**
 * Kotak teks putusan otomatis. Lama: tidak berbuat apa-apa. sipp-6: pratinjau
 * rapi di atas kotak kodenya. UI Baru (D10): penyunting teks kaya, kodenya di
 * balik "‹/› Lihat kode" - kotak aslinya TETAP yang dibaca "Isikan".
 */
function t7PasangPenyunting(sunting) {
  if (!sunting || !t7Pakai("sipp-6", true)) return;
  try {
    t7Penyunting(sunting, t7Modern());
  } catch {
    /* kotak kodenya tetap ada dan tetap dipakai */
  }
}

// ─── Penataan ────────────────────────────────────────────────────────────────

function t7Kelompok(isi, kunci) {
  const el = isi.querySelector(`:scope > .aleta-kelompok[data-kunci="${kunci}"]`);
  return el ? { kotak: el, isi: el.isi || el.querySelector(".aleta-kelompok-isi") } : null;
}

function t7TataSungguh(panel, konteks, ui) {
  const isi = panel.querySelector(":scope > .aleta-isi");
  if (!isi) return;
  panel.setAttribute("data-t7", ui ? "ui" : "baru");

  // Pengamat milik panel sebelumnya dilepas - panelnya sudah dibuang.
  if (t7Keadaan) for (const p of t7Keadaan.pengamat) p.disconnect();
  const k = {
    panel,
    konteks,
    isi,
    ui,
    nomor: String(konteks.nomorPerkara || ""),
    pengamat: [],
    menu: null,
  };
  t7Keadaan = k;

  // ── Baris atas: di atas kelompok pertama, di bawah nomor dan umur data ──
  const atas = buatElemen("div", "aleta-t7-atas");
  const kelPertama = isi.querySelector(":scope > .aleta-kelompok");
  isi.insertBefore(atas, kelPertama || null);

  if (!ui && t7Nyala("sipp-2")) isi.insertBefore(t7DaftarIsi(k), isi.firstChild);
  if (t7Nyala("sipp-23") && !ui) atas.appendChild(t7Lampu(k, false));
  if (t7Nyala("sipp-16") || t7Nyala("sipp-17")) atas.appendChild(t7BarisCepat(k));
  if (t7Pakai("sipp-11", true) && !ui) atas.appendChild(t7KotakCari(k));
  // Perbaikan 1 Okt (S, butir 5 dan 6) - UI Baru saja: Langkah berikutnya
  // mengenali sidang yang sudah putus tetapi putusannya belum diinput, dan
  // "Perkara berikutnya" (antrean checklist) hanya bagi Super Admin & Admin.
  const s1Ui = ui && typeof s1KartuLangkah === "function";
  if (t7Pakai("sipp-1", true)) atas.appendChild(s1Ui ? s1KartuLangkah(k) : t7KartuLangkah(k));
  if (t7Nyala("sipp-21") && (!s1Ui || s1BolehKartuAdmin())) atas.appendChild(t7KartuBerikutnya(k));
  // Perbaikan 2 Okt (S, butir 15) - UI Baru saja: "Perkara berikutnya"
  // menurut kepentingan peran (hakim: putusan, PP: BAS, juru sita: relaas/PBT).
  // Kartu checklist lengkap - termasuk antrean Direktori Putusan gagal - tetap
  // milik Super Admin & Admin (baris di atas).
  else if (t7Nyala("sipp-21") && s1Ui && typeof s2KartuBerikutnya === "function") {
    const kartuPeran = s2KartuBerikutnya(k);
    if (kartuPeran) atas.appendChild(kartuPeran);
  }
  if (!atas.childElementCount) atas.remove();

  // ── Isi kelompok ────────────────────────────────────────────────────────
  const kelPerkara = t7Kelompok(isi, "perkara");
  if (kelPerkara) {
    if (t7Nyala("sipp-14")) kelPerkara.isi.insertBefore(t7KartuTenggat(k), kelPerkara.isi.firstChild);
    if (t7Nyala("sipp-13")) kelPerkara.isi.appendChild(t7KartuCatatan(k));
  }
  const kelBerkas = t7Kelompok(isi, "berkas");
  if (kelBerkas && t7Nyala("sipp-29")) kelBerkas.isi.appendChild(t7KartuKomentarBas(k));
  const kelPutusan = t7Kelompok(isi, "putusanKel");
  if (kelPutusan && t7Nyala("sipp-27")) kelPutusan.isi.appendChild(t7KartuTemplat(k));

  t7TataPenetapan(k);

  if (t7Nyala("sipp-30") && !ui) isi.appendChild(t7KartuLapor(k));

  if (ui) {
    t7PasangTab(k);
    t7SusunKepala(k);
  }
  if (t7Pakai("sipp-22", true)) t7PasangBantuan(k);
  if (t7Pakai("sipp-11", true)) t7PasangCtrlK();
  if (ui) {
    t7PasangTuas(k);
    // Sesudah tampilkan() menempelkannya ke halaman - lihat t7TerapkanLabuh.
    setTimeout(() => t7TerapkanLabuh(), 0);
  }
}

// ─── D3: tab dengan lencana keadaan ──────────────────────────────────────────

function t7PasangTab(k) {
  const ada = T7_TAB.filter(([kunci]) => t7Kelompok(k.isi, kunci));
  if (ada.length < 2) return;
  const bilah = buatElemen("div", "aleta-t7-tabbar");
  bilah.setAttribute("role", "tablist");
  for (const [kunci, judul] of ada) {
    const tab = buatElemen("button", "aleta-t7-tab");
    tab.type = "button";
    tab.setAttribute("role", "tab");
    tab.setAttribute("data-t7-ke", kunci);
    tab.appendChild(buatElemen("span", "aleta-t7-tab-judul", judul));
    tab.appendChild(buatElemen("span", "aleta-t7-tab-lencana"));
    tab.addEventListener("click", () => t7PilihTab(k.panel, kunci, true));
    bilah.appendChild(tab);
  }
  k.panel.insertBefore(bilah, k.isi);
  t7PasangPintasanTab();

  if (k.panel.mps && typeof mpsTerapkan === "function") {
    // Perbaikan 30 Sep sore: urutan tab dan tab bawaan mengikuti menu peran
    // (menu pertama terbuka; Putusan bila blangko Putusan Akhir terbuka). Tab
    // tersimpan tidak dipulihkan - pengguna meminta menu pertama sebagai
    // bawaan; memilih tab tetap tercatat seperti biasa.
    mpsTerapkan(k.panel);
  } else {
    // Bawaan: Putusan bila borang Putusan Akhir sedang terbuka, selain itu
    // Penetapan. Pilihan terakhir petugas menang, bila tabnya ada.
    const bawaan = document.querySelector("#frm_putusan") && ada.some(([x]) => x === "putusanKel") ? "putusanKel" : ada[0][0];
    t7PilihTab(k.panel, bawaan, false);
    void t7Baca([T7_KUNCI_TAB]).then((s) => {
      const tersimpan = String(s[T7_KUNCI_TAB] || "");
      if (tersimpan && tersimpan !== bawaan && !document.querySelector("#frm_putusan")) t7PilihTab(k.panel, tersimpan, false);
    });
  }

  // Kepala kelompok dan bagian yang ditekan - oleh pintasan Alt+P, Alt+R,
  // oleh menu ⋯, atau oleh cari - memindahkan tabnya ke kelompok tempat
  // bagian itu tinggal. Tanpa ini Alt+R membuka Riwayat ALETA di tab yang
  // sedang tersembunyi.
  k.panel.addEventListener("click", (e) => {
    const judul = e.target && e.target.closest ? e.target.closest(".aleta-kelompok-judul, .aleta-bagian-judul") : null;
    if (!judul) return;
    const kel = judul.closest(".aleta-kelompok");
    if (kel && kel.dataset.kunci && k.panel.getAttribute("data-t7-tab") !== kel.dataset.kunci) {
      t7PilihTab(k.panel, kel.dataset.kunci, false);
    }
  });

  // Lencana tab = ringkasan kepala kelompoknya. perbaruiRingkas dibungkus
  // (hanya di panel ini, hanya dalam UI Baru): lencana yang menyusul dari
  // panggilan latar ikut sampai ke tabnya.
  for (const [kunci] of ada) {
    const kel = t7Kelompok(k.isi, kunci).kotak;
    const asli = kel.perbaruiRingkas;
    if (typeof asli === "function") {
      kel.perbaruiRingkas = () => {
        asli();
        t7LencanaTab(k);
      };
    }
  }
  t7LencanaTab(k);
}

function t7LencanaTab(k) {
  for (const tab of Array.from(k.panel.querySelectorAll(".aleta-t7-tab"))) {
    const kel = t7Kelompok(k.isi, tab.getAttribute("data-t7-ke"));
    const ringkas = kel ? kel.kotak.querySelector(":scope > .aleta-kelompok-judul .aleta-kelompok-ringkas") : null;
    const tempat = tab.querySelector(".aleta-t7-tab-lencana");
    const teks = ringkas ? String(ringkas.textContent || "").trim() : "";
    tempat.textContent = teks;
    tempat.className = `aleta-t7-tab-lencana${ringkas && teks ? ` ${(ringkas.className.match(/aleta-lencana-\w+/) || [""])[0]}` : ""}`;
  }
}

/**
 * Pintasan lama (Alt+P, Alt+R, Alt+Enter) dikerjakan pintasanPapanTik seperti
 * biasa; pendengar ini hanya memindahkan TAB-nya sesudahnya, supaya bagian
 * yang dibuka pintasan tidak tinggal di tab yang tersembunyi.
 */
let t7PintasanTabTerpasang = false;
function t7PasangPintasanTab() {
  if (t7PintasanTabTerpasang) return;
  t7PintasanTabTerpasang = true;
  document.addEventListener(
    "keydown",
    (e) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const tombol = String(e.key || "").toLowerCase();
      if (tombol !== "p" && tombol !== "r" && e.key !== "Enter") return;
      if (typeof sedangMengetik === "function" && sedangMengetik(e.target)) return;
      const panel = document.getElementById(PENANDA);
      if (!panel || !panel.hasAttribute("data-t7-tab")) return;
      t7PilihTab(panel, "kerjakan", false);
      // Alt+Enter menekan Tetapkan; rencananya ditulis di sebelah tombol asli,
      // jadi pilihan yang tersembunyi (D6) dibuka supaya rencana itu terbaca.
      if (e.key === "Enter") {
        const penunjukan = panel.querySelector('.aleta-bagian[data-kunci="penunjukan"]');
        if (penunjukan && penunjukan.querySelector(".aleta-tombol-tetapkan")) t7SetelTinjau(penunjukan, true);
      }
    },
    true
  );
}

// ─── sipp-2: daftar isi lengket (Baru) ───────────────────────────────────────

function t7DaftarIsi(k) {
  const baris = buatElemen("nav", "aleta-t7-daftar-isi");
  baris.setAttribute("data-t7-fitur", "sipp-2");
  for (const [kunci, judul] of T7_TAB) {
    const kel = t7Kelompok(k.isi, kunci);
    if (!kel) continue;
    const t = t7Tombol(judul, `Buka ${judul}`, "aleta-t7-chip");
    // Kunci kelompoknya - dipakai menu per peran (mpsTerapkan) untuk mengurutkan/menyembunyikan.
    t.setAttribute("data-t7-ke", kunci);
    const lencana = buatElemen("span", "aleta-t7-chip-lencana");
    t.appendChild(lencana);
    const segarkanLencana = () => {
      const r = kel.kotak.querySelector(":scope > .aleta-kelompok-judul .aleta-kelompok-ringkas");
      lencana.textContent = r ? String(r.textContent || "").trim() : "";
    };
    segarkanLencana();
    const asli = kel.kotak.perbaruiRingkas;
    if (typeof asli === "function") {
      kel.kotak.perbaruiRingkas = () => {
        asli();
        segarkanLencana();
      };
    }
    t.addEventListener("click", () => bukaBagianPanel(k.panel, kunci));
    baris.appendChild(t);
  }
  return baris;
}

// ─── sipp-23 / D2: lampu sambungan ───────────────────────────────────────────

/**
 * Tiga lampu tanpa satu permintaan tambahan: SIPP (halaman ini terbaca),
 * ALETA (konteks segar atau simpanan luring), e-Court (umur penarikan
 * terakhir - lebih dari sehari berarti kuning).
 */
/**
 * Lampu "e-Court" (30 Okt 2026): bila akun utama e-Court TIDAK tersambung
 * (perlu masuk ulang / tidak tersambung), warna & kalimatnya dari status akun
 * satu sumber (server, src/lib/ecourt-status-akun.ts) - sama dengan semua
 * penanda lain. Selama tersambung, lampu tetap menyebut umur data perkara.
 */
function t7LampuEcourt(k, usia) {
  const st = k && k.konteks && k.konteks.statusEcourt && k.konteks.statusEcourt.lampu ? k.konteks.statusEcourt : null;
  if (st && st.keadaan !== "aktif") return ["e-Court", st.lampu, `${st.judul} - ${st.teks}`];
  return ["e-Court", usia.basi ? "awas" : "baik", `${st ? "tersambung · " : ""}diperiksa ${usia.teks}`];
}

function t7Lampu(k, ringkas) {
  const wadah = buatElemen(ringkas ? "span" : "div", `aleta-t7-lampu${ringkas ? " aleta-t7-lampu-ringkas" : ""}`);
  if (!ringkas) wadah.setAttribute("data-t7-fitur", "sipp-23");
  const usia = typeof usiaData === "function" ? usiaData(k.konteks.diperiksaPada) : { teks: "", basi: false };
  const daftar = [
    ["SIPP", "baik", "halaman SIPP terbaca"],
    ["ALETA", typeof sedangLuring !== "undefined" && sedangLuring ? "awas" : "baik", typeof sedangLuring !== "undefined" && sedangLuring ? "server tidak menjawab - data simpanan" : "tersambung"],
    t7LampuEcourt(k, usia),
  ];
  for (const [nama, keadaan, ket] of daftar) {
    const l = buatElemen("span", `aleta-t7-lampu-satu aleta-t7-lampu-${keadaan}`);
    l.appendChild(buatElemen("span", "aleta-t7-titik", "●"));
    l.appendChild(buatElemen("span", "aleta-t7-lampu-nama", nama));
    if (!ringkas) l.appendChild(buatElemen("span", "aleta-t7-lampu-ket", ket));
    l.title = `${nama}: ${ket}`;
    wadah.appendChild(l);
  }
  return wadah;
}

function t7BarisCepat(k) {
  const baris = buatElemen("div", "aleta-t7-cepat");
  if (t7Nyala("sipp-17")) {
    baris.setAttribute("data-t7-fitur", "sipp-17");
    const identitas = (k.konteks && k.konteks.identitas) || {};
    const calon = [
      ["Nomor perkara", k.nomor],
      ["Nomor register e-Court", String(k.konteks.nomorRegister || "")],
      ["Jenis perkara", String(identitas.jenisPerkara || "")],
    ];
    baris.appendChild(buatElemen("span", "aleta-t7-label", "Salin"));
    for (const [nama, nilai] of calon) {
      if (!nilai) continue;
      const t = t7Tombol(nilai, `Salin ${nama.toLowerCase()} - sekali klik`, "aleta-t7-chip aleta-t7-salin");
      t.addEventListener("click", async () => {
        const ok = await salinTeks(nilai);
        t.classList.toggle("aleta-t7-tersalin", ok);
        t.title = ok ? `${nama} tersalin` : `Papan klip ditolak peramban - salin sendiri: ${nilai}`;
        setTimeout(() => t.classList.remove("aleta-t7-tersalin"), 900);
      });
      baris.appendChild(t);
    }
  }
  if (t7Nyala("sipp-16") && k.nomor) {
    const a = buatElemen("a", "aleta-t7-tautan", "Buka di ALETA ↗");
    a.href = t7AlamatAleta(k.nomor);
    a.target = "_blank";
    a.rel = "noopener";
    a.title = "Buka perkara ini di portal ALETA (tab baru)";
    a.setAttribute("data-t7-fitur", "sipp-16");
    baris.appendChild(a);
  }
  return baris;
}

// ─── sipp-1 / D4: langkah berikutnya ─────────────────────────────────────────

/**
 * Paling banyak tiga langkah, dari yang sudah di tangan: selisih e-Court dan
 * tenggat unggah seketika dari konteks; minutasi, BHT, dan tahap yang belum
 * bertanggal sesudah keadaan perkara terbaca (panggilan yang sama dengan
 * lencana menu - disimpan per nomor, tidak berangkat dua kali).
 */
function t7KartuLangkah(k) {
  const kartu = t7Kartu("Langkah berikutnya", "sipp-1");
  kartu.classList.add("aleta-t7-langkah");
  const daftar = buatElemen("ol", "aleta-t7-langkah-daftar");
  kartu.appendChild(daftar);

  const gambar = (langkah) => {
    daftar.textContent = "";
    const pilih = langkah.slice(0, 3);
    if (pilih.length === 0) {
      daftar.appendChild(buatElemen("li", "aleta-t7-langkah-beres", "Tidak ada yang mendesak untuk perkara ini."));
      return;
    }
    for (const l of pilih) {
      const li = buatElemen("li", `aleta-t7-langkah-butir aleta-t7-nada-${l.nada}`);
      li.appendChild(buatElemen("span", "aleta-t7-langkah-teks", l.teks));
      if (l.kunci) {
        const buka = t7Tombol("Buka", `Buka ${l.teks}`, "aleta-t7-kecil");
        buka.addEventListener("click", () => t7Buka(k, l.kunci));
        li.appendChild(buka);
      }
      daftar.appendChild(li);
    }
  };

  const dariKonteks = [];
  const konteks = k.konteks || {};
  const selisih = Array.isArray(konteks.selisih) ? konteks.selisih : [];
  if (selisih.length > 0) {
    dariKonteks.push({ teks: `Periksa ${selisih.length} data yang tidak cocok dengan e-Court`, nada: "lewat", kunci: "selisih" });
  }
  const tenggat = (Array.isArray(konteks.dokumen) ? konteks.dokumen : []).filter((d) => d.sisaHari !== null && d.sisaHari !== undefined);
  const mepet = tenggat.sort((a, b) => Number(a.sisaHari) - Number(b.sisaHari))[0];
  if (mepet && Number(mepet.sisaHari) <= Number(konteks.ambangMendesakHari || 3)) {
    const sisa = Number(mepet.sisaHari);
    dariKonteks.push({
      teks: `Unggah ${mepet.judulDokumen || mepet.agenda || "dokumen"} ke e-Court - ${sisa < 0 ? `lewat ${Math.abs(sisa)} hari` : sisa === 0 ? "habis hari ini" : `${sisa} hari lagi`}`,
      nada: sisa < 0 ? "lewat" : "mendesak",
      kunci: "tenggat",
    });
  }
  gambar(dariKonteks);

  if (k.nomor && typeof ambilStatusPerkara === "function") {
    void ambilStatusPerkara(k.nomor)
      .then((status) => {
        const lagi = [...dariKonteks];
        const p = (status && status.putusan) || {};
        if (p.sudahPutus && !p.tanggalMinutasi) lagi.push({ teks: "Minutasi berkas perkara", nada: "mendesak", kunci: "putusan" });
        else if (p.sudahPutus && !p.tanggalBht) lagi.push({ teks: "Catat tanggal berkekuatan hukum tetap", nada: "netral", kunci: "putusan" });
        const tahap = status && status.tahapan && status.tahapan.terbaca ? status.tahapan.tahap || [] : [];
        const berikut = tahap.find((x) => x.terbaca && !x.tanggal);
        if (!p.sudahPutus && berikut) lagi.push({ teks: `Tahap berikutnya: ${berikut.label || berikut.kunci}`, nada: "netral", kunci: "tahapan" });
        gambar(lagi);
      })
      .catch(() => {
        /* langkah dari konteks tetap tampil */
      });
  }
  return kartu;
}

// ─── sipp-21: perkara berikutnya dari checklist milestone ────────────────────

function t7KartuBerikutnya(k) {
  const kartu = t7Kartu("Perkara berikutnya", "sipp-21");
  const isi = buatElemen("div", "aleta-t7-kartu-isi", "Membaca checklist…");
  kartu.appendChild(isi);
  void (async () => {
    const s = await t7Baca([T7_KUNCI_PERAN_CHECKLIST, T7_KUNCI_TAUTAN_SIPP, "riwayatPerkaraSipp"]);
    const peran = String(s[T7_KUNCI_PERAN_CHECKLIST] || "");
    const jawab = await t7AmbilJson(peran ? `${T7_API_CHECKLIST}?peran=${encodeURIComponent(peran)}` : T7_API_CHECKLIST, "Checklist milestone");
    isi.textContent = "";
    if (!jawab.ok) {
      isi.appendChild(t7BelumTersedia(jawab.pesan));
      return;
    }
    const butir = (jawab.data && Array.isArray(jawab.data.butir) ? jawab.data.butir : []).filter((b) => {
      const tujuan = String((b && b.kerjakan && b.kerjakan.tujuan) || "").toLowerCase();
      const nomor = t7KunciNomor(b && b.perkara && b.perkara.nomor);
      return tujuan === "sipp" && nomor && nomor !== t7KunciNomor(k.nomor);
    });
    if (butir.length === 0) {
      isi.appendChild(t7Ket("Tidak ada perkara lain di checklist Anda yang dikerjakan di SIPP."));
      return;
    }
    const peta = new Map();
    const tautan = s[T7_KUNCI_TAUTAN_SIPP] && typeof s[T7_KUNCI_TAUTAN_SIPP] === "object" ? s[T7_KUNCI_TAUTAN_SIPP] : {};
    for (const [nomor, x] of Object.entries(tautan)) if (x && x.url) peta.set(t7KunciNomor(nomor), String(x.url));
    for (const r of Array.isArray(s.riwayatPerkaraSipp) ? s.riwayatPerkaraSipp : []) if (r && r.url) peta.set(t7KunciNomor(r.nomor), String(r.url));
    const daftar = buatElemen("ul", "aleta-t7-daftar");
    for (const b of butir.slice(0, 3)) {
      const nomor = String(b.perkara.nomor);
      const li = buatElemen("li", `aleta-t7-baris${b.kelompok === "lewat" ? " aleta-t7-nada-lewat" : ""}`);
      const teks = buatElemen("span", "aleta-t7-baris-teks");
      teks.appendChild(buatElemen("span", "aleta-t7-nomor", nomor));
      teks.appendChild(buatElemen("span", "aleta-t7-lembut", String(b.judul || "")));
      li.appendChild(teks);
      const href = peta.get(t7KunciNomor(nomor)) || "";
      // Hanya alamat SIPP halaman ini - alamat dari penyimpanan tidak dipercaya buta.
      if (href && href.startsWith(`${location.origin}/`)) {
        const a = buatElemen("a", "aleta-t7-tautan", "Buka");
        a.href = href;
        a.title = `Buka perkara ${nomor} di SIPP`;
        li.appendChild(a);
      } else {
        const salin = t7Tombol("Salin nomor", `Alamat SIPP perkara ${nomor} belum diketahui peramban ini - salin nomornya untuk dicari`, "aleta-t7-kecil");
        salin.addEventListener("click", () => void salinTeks(nomor));
        li.appendChild(salin);
      }
      daftar.appendChild(li);
    }
    isi.appendChild(daftar);
    isi.appendChild(t7Ket(`Dari checklist milestone ${peran ? `peran ${peran}` : "peran Anda"}; ${butir.length} perkara menunggu di SIPP.`, "aleta-t7-lembut"));
  })();
  return kartu;
}

// ─── sipp-14: pengingat tenggat menurut Penilaian SK ─────────────────────────

/**
 * Hitungan hari ke batas nilai PENUH menurut ambang yang sama dengan Penilaian
 * SK (T7_SK). Tidak ada aturan baru: minutasi dan publikasi bernilai 5 bila
 * dikerjakan paling lambat hari ke-2 sesudah putus; waktu putus bernilai 5
 * sampai 90 hari bersih - angka bersihnya dibaca dari catatan Penilaian SK
 * sendiri, sebab potongan mediasi dan perkara khusus hanya diketahui server.
 */
function t7KartuTenggat(k) {
  const kartu = t7Kartu("Pengingat tenggat (ambang Penilaian SK)", "sipp-14");
  const isi = buatElemen("div", "aleta-t7-kartu-isi", "Membaca keadaan perkara…");
  kartu.appendChild(isi);
  if (!k.nomor || typeof ambilStatusPerkara !== "function") {
    isi.textContent = "Nomor perkara tidak terbaca.";
    return kartu;
  }
  void ambilStatusPerkara(k.nomor)
    .then((status) => {
      isi.textContent = "";
      const baris = t7HitungTenggat(status, new Date());
      if (baris.length === 0) {
        isi.appendChild(t7Ket("Tidak ada tenggat Penilaian SK yang sedang berjalan untuk perkara ini."));
        return;
      }
      for (const b of baris) {
        const el = buatElemen("div", `aleta-t7-tenggat aleta-t7-nada-${b.nada}`);
        el.appendChild(buatElemen("span", "aleta-t7-tenggat-judul", b.judul));
        el.appendChild(buatElemen("span", "aleta-t7-tenggat-sisa", b.sisa));
        if (b.ket) el.appendChild(buatElemen("span", "aleta-t7-lembut", b.ket));
        isi.appendChild(el);
      }
    })
    .catch((galat) => {
      isi.textContent = "";
      isi.appendChild(t7BelumTersedia(sambungSebab("Keadaan perkara tidak terbaca", galat)));
    });
  return kartu;
}

/** Hitungan murni - dipisah supaya dapat diuji tanpa panel. */
function t7HitungTenggat(status, hariIni) {
  const hasil = [];
  const p = (status && status.putusan) || {};
  const lengkap = (status && status.putusanLengkap) || {};
  const rinci = status && status.penilaianSk && Array.isArray(status.penilaianSk.rinci) ? status.penilaianSk.rinci : [];
  const unsur = (kunci) => rinci.find((x) => x && x.kunci === kunci) || null;
  const tangga = T7_SK.tanggaSesudahPutus;
  const hariPenuh = tangga[0][0];

  const sesudahPutus = (judul, sudah, catatanBelum) => {
    const tglPutus = t7Tanggal(lengkap.tanggalPutusan || p.tanggalPutusan);
    if (!p.sudahPutus || !tglPutus || sudah) return;
    const berjalan = t7SelisihHari(tglPutus, hariIni);
    const batas = new Date(tglPutus.getFullYear(), tglPutus.getMonth(), tglPutus.getDate() + hariPenuh);
    const sisa = hariPenuh - berjalan;
    const poinKini = t7Tangga(Math.max(berjalan, 0), tangga, 0);
    hasil.push({
      judul,
      sisa:
        sisa > 0
          ? `${sisa} hari lagi (paling lambat ${t7TanggalTampil(batas)})`
          : sisa === 0
            ? `hari ini batasnya (${t7TanggalTampil(batas)})`
            : `lewat ${Math.abs(sisa)} hari`,
      ket: sisa >= 0 ? "nilai penuh 5 bila selesai sebelum batas" : `bila selesai hari ini nilainya ${poinKini}${catatanBelum ? ` · ${catatanBelum}` : ""}`,
      nada: sisa < 0 ? "lewat" : sisa <= 1 ? "mendesak" : "netral",
    });
  };
  sesudahPutus("Minutasi berkas", Boolean(p.tanggalMinutasi), "");
  const publikasi = unsur("waktuPublikasi");
  const belumUnggah = publikasi && /belum diunggah/i.test(String(publikasi.catatan || ""));
  if (belumUnggah) sesudahPutus("Publikasi putusan", false, "");

  if (!p.sudahPutus) {
    const putus = unsur("waktuPutus");
    const m = putus ? String(putus.catatan || "").match(/=\s*(\d+)\s*hari/) : null;
    if (m) {
      const bersih = Number(m[1]);
      const sisa = T7_SK.putusHariPenuh - bersih;
      hasil.push({
        judul: "Waktu putus perkara",
        sisa: sisa >= 0 ? `${sisa} hari lagi menuju ${T7_SK.putusHariPenuh} hari` : `lewat ${Math.abs(sisa)} hari dari ${T7_SK.putusHariPenuh} hari`,
        ket: `${bersih} hari bersih menurut Penilaian SK`,
        nada: sisa < 0 ? "lewat" : sisa <= 14 ? "mendesak" : "netral",
      });
    }
  }
  return hasil;
}

// ─── sipp-13: catatan internal perkara (PC ini saja) ─────────────────────────

function t7KartuCatatan(k) {
  const kartu = t7Kartu("Catatan internal", "sipp-13");
  kartu.appendChild(t7Ket("Hanya tersimpan di peramban PC ini - tidak dikirim ke mana pun, tidak masuk SIPP.", "aleta-t7-lembut"));
  const kotak = document.createElement("textarea");
  kotak.className = "aleta-t7-catatan";
  kotak.rows = 3;
  kotak.maxLength = 2000;
  kotak.placeholder = "Catatan untuk diri sendiri tentang perkara ini…";
  kotak.disabled = true;
  const kabar = buatElemen("span", "aleta-t7-lembut");
  kartu.appendChild(kotak);
  kartu.appendChild(kabar);
  const kunci = t7KunciNomor(k.nomor);
  void t7Baca([T7_KUNCI_CATATAN]).then((s) => {
    const semua = s[T7_KUNCI_CATATAN] && typeof s[T7_KUNCI_CATATAN] === "object" ? s[T7_KUNCI_CATATAN] : {};
    kotak.value = semua[kunci] && typeof semua[kunci].teks === "string" ? semua[kunci].teks : "";
    kotak.disabled = !kunci;
  });
  let jam = 0;
  kotak.addEventListener("input", () => {
    clearTimeout(jam);
    jam = setTimeout(async () => {
      const s = await t7Baca([T7_KUNCI_CATATAN]);
      const semua = s[T7_KUNCI_CATATAN] && typeof s[T7_KUNCI_CATATAN] === "object" ? { ...s[T7_KUNCI_CATATAN] } : {};
      const teks = kotak.value.trim() ? kotak.value : "";
      if (teks) semua[kunci] = { teks, diubah: Date.now() };
      else delete semua[kunci];
      // Yang tertua dibuang lebih dulu - catatan ini kemudahan, bukan arsip.
      const urut = Object.entries(semua).sort((a, b) => Number(b[1].diubah || 0) - Number(a[1].diubah || 0));
      t7Tulis({ [T7_KUNCI_CATATAN]: Object.fromEntries(urut.slice(0, T7_CATATAN_MAKS)) });
      kabar.textContent = teks ? "tersimpan di PC ini" : "catatan dihapus";
    }, 600);
  });
  return kartu;
}

// ─── sipp-29: komentar hakim atas BAS (baca saja) ────────────────────────────

/**
 * Keputusan pengguna: TIDAK ada acc hakim. Hakim mengomentari BAS di portal;
 * di sini komentarnya hanya dibaca - BAS tetap dapat dikerjakan tanpa
 * menunggu, dan menandai selesai dikerjakan di portal.
 */
function t7KartuKomentarBas(k) {
  const kartu = t7Kartu("Komentar hakim atas BAS", "sipp-29");
  const isi = buatElemen("div", "aleta-t7-kartu-isi", "Membaca komentar…");
  kartu.appendChild(isi);
  if (!k.nomor) {
    isi.textContent = "Nomor perkara tidak terbaca.";
    return kartu;
  }
  void t7AmbilJson(`${T7_API_KOMENTAR_BAS}?nomor=${encodeURIComponent(k.nomor)}`, "Komentar hakim atas BAS").then((j) => {
    isi.textContent = "";
    if (!j.ok) {
      isi.appendChild(t7BelumTersedia(j.pesan));
      return;
    }
    const komentar = j.data && Array.isArray(j.data.komentar) ? j.data.komentar : [];
    if (komentar.length === 0) {
      isi.appendChild(t7Ket("Belum ada komentar hakim atas BAS perkara ini."));
      return;
    }
    const terbuka = komentar.filter((x) => !x.selesai).length;
    isi.appendChild(t7Ket(`${terbuka} belum selesai dari ${komentar.length} komentar. Menandai selesai dikerjakan di portal.`, "aleta-t7-lembut"));
    const daftar = buatElemen("ul", "aleta-t7-daftar");
    for (const x of komentar.slice(0, 20)) {
      const li = buatElemen("li", `aleta-t7-baris aleta-t7-komentar${x.selesai ? " aleta-t7-selesai" : ""}`);
      const teks = buatElemen("span", "aleta-t7-baris-teks");
      const tempat = [x.sidangKe ? `sidang ke-${x.sidangKe}` : "", String(x.bagian || "")].filter(Boolean).join(" · ");
      teks.appendChild(buatElemen("span", "aleta-t7-baris-judul", `${(x.penulis && x.penulis.nama) || "Hakim"}${tempat ? ` · ${tempat}` : ""}`));
      if (x.kutipan) teks.appendChild(buatElemen("q", "aleta-t7-kutipan", String(x.kutipan)));
      teks.appendChild(buatElemen("span", "aleta-t7-komentar-isi", String(x.isi || "")));
      if (x.selesai) teks.appendChild(buatElemen("span", "aleta-t7-lembut", `selesai${x.diselesaikanOleh && x.diselesaikanOleh.nama ? ` · ${x.diselesaikanOleh.nama}` : ""}`));
      li.appendChild(teks);
      daftar.appendChild(li);
    }
    isi.appendChild(daftar);
  });
  return kartu;
}

// ─── sipp-27: templat pertimbangan per status putusan ────────────────────────

/**
 * Dari templat-hukum jenis "pertimbangan" (kunci = status putusan: gugur,
 * dicabut, verstek, tidak-diterima). Keputusan pengguna: yang DRAF tampil
 * bertanda "DRAF - belum disahkan" dan TIDAK dapat disisipkan - tombolnya
 * mati, dan penyisipnya menolak sekali lagi walau tombolnya dihidupkan
 * dari luar.
 */
function t7KartuTemplat(k) {
  const kartu = t7Kartu("Templat pertimbangan per status putusan", "sipp-27");
  const isi = buatElemen("div", "aleta-t7-kartu-isi", "Membaca templat…");
  kartu.appendChild(isi);
  const kabar = buatElemen("div", "aleta-t7-kabar");
  kabar.setAttribute("role", "status");
  kartu.appendChild(kabar);
  void t7AmbilJson(`${T7_API_TEMPLAT}?jenis=pertimbangan`, "Templat pertimbangan").then((j) => {
    isi.textContent = "";
    if (!j.ok) {
      isi.appendChild(t7BelumTersedia(j.pesan));
      return;
    }
    const butir = (j.data && Array.isArray(j.data.butir) ? j.data.butir : []).filter((x) => x && x.jenis !== "pasal");
    if (butir.length === 0) {
      isi.appendChild(t7Ket("Belum ada templat pertimbangan di server."));
      return;
    }
    const daftar = buatElemen("ul", "aleta-t7-daftar");
    for (const x of butir) daftar.appendChild(t7BarisTemplat(x, kabar));
    isi.appendChild(daftar);
    isi.appendChild(
      t7Ket(
        "Disisipkan ke kotak Pertimbangan Hukum di Putusan otomatis (ambil usulan dulu). Baru sampai ke SIPP lewat “Isikan yang dicentang”.",
        "aleta-t7-lembut"
      )
    );
  });
  return kartu;
}

function t7BarisTemplat(x, kabar) {
  const sah = x.disahkan === true;
  const li = buatElemen("li", `aleta-t7-baris aleta-t7-templat${sah ? "" : " aleta-t7-draf"}`);
  li.setAttribute("data-t7-kunci", String(x.kunci || ""));
  const teks = buatElemen("span", "aleta-t7-baris-teks");
  const kepala = buatElemen("span", "aleta-t7-baris-judul", String(x.judul || x.kunci || "Templat"));
  teks.appendChild(kepala);
  teks.appendChild(buatElemen("span", "aleta-t7-chip-kecil", String(x.kunci || "")));
  if (!sah) teks.appendChild(buatElemen("span", "aleta-t7-tanda-draf", "DRAF - belum disahkan"));
  const cuplikan = t7TeksPolos(x.isi);
  teks.appendChild(buatElemen("span", "aleta-t7-lembut", cuplikan.length > 140 ? `${cuplikan.slice(0, 140)}…` : cuplikan));
  li.appendChild(teks);
  const sisip = t7Tombol("Sisipkan", sah ? "Sisipkan ke Pertimbangan Hukum di panel" : "DRAF - belum disahkan Super Admin, tidak dapat disisipkan", "aleta-t7-kecil");
  sisip.disabled = !sah;
  sisip.addEventListener("click", () => {
    kabar.textContent = t7SisipTemplat(x);
  });
  li.appendChild(sisip);
  return li;
}

/**
 * Menyisip satu templat ke kotak teks Pertimbangan Hukum PANEL. Pulang
 * kalimat hasilnya. Yang belum disahkan ditolak DI SINI juga - tombol mati
 * saja bukan penjaga.
 */
function t7SisipTemplat(x) {
  if (!x || x.disahkan !== true) return "Templat ini masih DRAF - belum disahkan, jadi tidak disisipkan.";
  const kartu = Array.from(document.querySelectorAll(`#${PENANDA} .aleta-abt-kartu`)).find((c) => {
    const nama = c.querySelector(".aleta-abt-nama");
    return nama && /pertimbangan/i.test(String(nama.textContent || ""));
  });
  const kotak = kartu ? kartu.querySelector("textarea.aleta-sunting") : null;
  if (!kotak) return "Kotak Pertimbangan Hukum belum ada - tekan “Ambil usulan dari ALETA” di Putusan otomatis lebih dulu.";
  const tambahan = String(x.isi || "");
  kotak.value = kotak.value.trim() ? `${kotak.value}\n${tambahan}` : tambahan;
  kotak.dispatchEvent(new Event("input", { bubbles: true }));
  kotak.dispatchEvent(new CustomEvent("aleta-t7-disisip", { bubbles: false }));
  return `“${x.judul || x.kunci}” disisipkan ke Pertimbangan Hukum di panel. Periksa, lalu Isikan seperti biasa.`;
}

// ─── sipp-30: laporkan masalah ke Masukan portal ─────────────────────────────

/**
 * Masuk ke Pusat Masukan portal yang SUDAH ADA (POST /api/feedback - satu
 * baris feedback_requests, dibaca admin di menu Masukan Pengguna). Konteks
 * disertakan otomatis: seri ekstensi, halaman SIPP tanpa kueri, nomor
 * perkara, tampilan, dan lima kejadian terakhir kotak hitam.
 */
function t7KartuLapor(k) {
  const kartu = t7Kartu("Laporkan masalah", "sipp-30");
  const kategori = document.createElement("select");
  kategori.className = "aleta-t7-pilih";
  for (const nama of ["Tombol tidak berfungsi", "Data tidak muncul", "Tampilan/UI rusak"]) {
    const o = document.createElement("option");
    o.value = nama;
    o.textContent = nama;
    kategori.appendChild(o);
  }
  const judul = document.createElement("input");
  judul.type = "text";
  judul.maxLength = 150;
  judul.className = "aleta-t7-masukan";
  judul.placeholder = "Judul singkat";
  const uraian = document.createElement("textarea");
  uraian.className = "aleta-t7-catatan";
  uraian.rows = 3;
  uraian.maxLength = 4000;
  uraian.placeholder = "Apa yang terjadi, dan apa yang Anda harapkan?";
  const kirim = t7Tombol("Kirim ke Masukan ALETA", "Dikirim ke Pusat Masukan portal ALETA - bukan ke SIPP", "aleta-t7-utama-kecil");
  const kabar = buatElemen("div", "aleta-t7-kabar");
  kabar.setAttribute("role", "status");
  kartu.append(kategori, judul, uraian, kirim, kabar);
  kirim.addEventListener("click", async () => {
    if (!judul.value.trim() || !uraian.value.trim()) {
      kabar.textContent = "Judul dan uraian wajib diisi.";
      return;
    }
    kirim.disabled = true;
    kabar.textContent = "Mengirim…";
    let jawab = null;
    try {
      const respons = await alatAmbil(
        T7_API_MASUKAN,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "bug",
            appArea: "sipp",
            category: kategori.value,
            priority: "medium",
            title: judul.value.trim(),
            description: uraian.value.trim(),
            reproductionSteps: t7KonteksLaporan(k),
          }),
        },
        "Mengirim laporan masalah"
      );
      let badan = null;
      try {
        badan = await respons.json();
      } catch {
        badan = null;
      }
      jawab = { ok: respons.ok, status: respons.status, badan };
    } catch (galat) {
      jawab = { ok: false, status: 0, badan: { pesan: String((galat && galat.message) || galat) } };
    }
    kirim.disabled = false;
    const b = jawab.badan || {};
    if (jawab.ok) {
      const item = (b.data && b.data.item) || b.item || {};
      kabar.textContent = `Terkirim${item.id ? ` (${item.id})` : ""}. Admin membacanya di menu Masukan Pengguna.`;
      judul.value = "";
      uraian.value = "";
      return;
    }
    kabar.textContent = String(b.pesan || (b.error && b.error.message) || `Gagal mengirim (status ${jawab.status}).`);
  });
  return kartu;
}

function t7KonteksLaporan(k) {
  let seri = "";
  try {
    seri = chrome.runtime.getManifest().version;
  } catch {
    seri = "";
  }
  const kejadian = typeof alatKotakHitam === "function" ? alatKotakHitam().slice(-5) : [];
  return [
    `Ekstensi: ${seri || "-"} · tampilan ${t7Mode()}`,
    `Halaman SIPP: ${location.pathname}`,
    `Perkara: ${k.nomor || "-"}`,
    ...kejadian.map((x) => `- ${x.jenis || ""}: ${String(x.ringkas || "").slice(0, 160)}`),
  ].join("\n");
}

// ─── Penetapan: D5-D8, sipp-5, D9/sipp-10 ────────────────────────────────────

function t7TataPenetapan(k) {
  const kel = t7Kelompok(k.isi, "kerjakan");
  if (!kel) return;
  const penunjukan = kel.isi.querySelector(':scope > .aleta-bagian[data-kunci="penunjukan"]');

  // D9 / sipp-10: peta kolom formulir PINDAH, tidak dihapus. UI Baru: menu ⋯ ›
  // Super Admin (lihat t7SusunKepala). Baru: laci "Alat pemasangan" di ujung
  // kelompok Penetapan.
  const peta = kel.isi.querySelector(':scope > .aleta-bagian[data-kunci="bacaBorang"]');
  if (peta && !k.ui && t7Nyala("sipp-10")) {
    const laci = buatElemen("details", "aleta-t7-laci");
    laci.setAttribute("data-t7-fitur", "sipp-10");
    laci.appendChild(buatElemen("summary", "", "Alat pemasangan (Super Admin / Admin): peta kolom formulir"));
    laci.appendChild(peta);
    kel.isi.appendChild(laci);
  }

  if (!penunjukan) return;
  const pakaiRingkas = k.ui;
  // 19 Okt 2026: di UI Baru cukup SATU "Tetapkan semua" - tombol besar di kartu.
  // Pita bawah (sipp-5) tetap untuk tampilan Baru; "Lihat perubahan"-nya sama
  // dengan "Ubah semua pilihan" di bawah tombol besar kartu.
  const pakaiBilah = !k.ui && t7Nyala("sipp-5");
  if (!pakaiRingkas && !pakaiBilah) return;

  let ringkas = null;
  if (pakaiRingkas) {
    ringkas = t7KartuKeputusan(k, penunjukan);
    kel.isi.insertBefore(ringkas.kartu, penunjukan);
  }
  const bilah = pakaiBilah ? t7PasangBilah(k, penunjukan) : null;

  // Satu pengamat untuk isi penunjukan yang dimuat, dimuat ulang (ganti
  // majelis), dan tombolnya yang berganti bunyi. Hanya di luar Lama.
  let jam = 0;
  const segarkan = () => {
    jam = 0;
    if (ringkas) ringkas.segarkan();
    if (bilah) bilah.segarkan();
    if (k.ui) t7PindahkanZona(k);
  };
  const p = new MutationObserver(() => {
    if (!jam) jam = setTimeout(segarkan, 60);
  });
  p.observe(penunjukan, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["disabled", "class", "data-t7-tinjau"] });
  k.pengamat.push(p);
  segarkan();
}

/**
 * ============================================================================
 * PENETAPAN SATU KLIK (18 Okt 2026) - rancangan docs/rancangan/penetapan-satu-klik.html
 * ============================================================================
 *
 * Kartu "Penetapan" di UI Baru: ringkasan perkara, empat baris PMH/PPP/PJS/PHS
 * dengan statusnya, dan SATU tombol "Tetapkan semua".
 *
 * TIDAK ADA JALAN TULIS BARU. "Tetapkan semua" MENEKAN tombol Tetapkan asli
 * yang sama, dua kali seperti alur lama: tekanan pertama menjalankan
 * pemeriksaan (uji kering rantaiPenetapan), dan HANYA bila seluruhnya lulus
 * tekanan kedua menulis (kirimRantaiUtuh - satu transaksi, utuh atau batal).
 * Gagal di pemeriksaan = berhenti, tidak ada yang ditulis. Urutan, akun
 * pejabat, aturan setanggal, hakim tunggal, isian manual, mode latihan, dan
 * pemeriksaan hari libur seluruhnya milik alur lama itu.
 *
 * Hasil per langkah dibaca dari peristiwa "aleta-hasil-penetapan" yang dikirim
 * tetapkanLewatAleta; rincian teknisnya (rapor pemeriksaan) tetap di bagian
 * rinci yang dibuka lewat "Ubah semua pilihan".
 */
const T7_KODE_PENETAPAN = {
  "Penetapan Majelis Hakim": "pmh",
  "Penunjukan Panitera Pengganti": "ppp",
  "Penunjukan Juru Sita": "pjs",
  "Penetapan Hari Sidang": "phs",
};
const T7_TOMBOL_ALETA = ["Tetapkan dan tuliskan ke SIPP", "Tuliskan ke SIPP"];
/** Keadaan satu-klik per bagian penunjukan: {tahap, kering, tulis}. */
const t7SatuKlik = new WeakMap();

function t7KeadaanSatuKlik(penunjukan) {
  let s = t7SatuKlik.get(penunjukan);
  if (!s) {
    s = { tahap: "siap", kering: null, tulis: null, pendengar: new Set() };
    t7SatuKlik.set(penunjukan, s);
    // Hasil per langkah dari tetapkanLewatAleta (tombol asli ada di dalam bagian ini).
    penunjukan.addEventListener("aleta-hasil-penetapan", (e) => {
      const d = (e && e.detail) || {};
      if (d.kering) s.kering = d;
      else s.tulis = d;
      s.pendengar.forEach((f) => f());
    });
  }
  return s;
}

/** Kalimat untuk orang - kode mesin tidak pernah tampil. */
function t7KalimatAwam(teks) {
  const t = String(teks || "").trim();
  if (!t || /^[a-z0-9_:.-]+$/i.test(t)) return "Belum dapat ditetapkan - buka Ubah semua pilihan untuk melihat sebabnya.";
  // Pesan basis data/peladen dalam kurung (mis. "(ER_LOCK_WAIT_TIMEOUT: ...)")
  // tetap ada di rincian pemeriksaan, tidak di kartu.
  return t.replace(/\s*\([A-Z][A-Z0-9_]{3,}[^)]*\)/g, "");
}

function t7SebutJenis(daftar) {
  const k = daftar.map((x) => String(x).toUpperCase());
  if (k.length <= 1) return k.join("");
  return `${k.slice(0, -1).join(", ")}, dan ${k[k.length - 1]}`;
}

/** Menunggu tombol asli selesai bekerja (bunyinya tidak lagi "…"). */
async function t7TungguTombol(asli, batasMs) {
  const mulai = Date.now();
  await new Promise((r) => setTimeout(r, 0));
  while (Date.now() - mulai < batasMs) {
    const teks = String(asli.textContent || "");
    if (!/…$/.test(teks)) return teks;
    await new Promise((r) => setTimeout(r, 40));
  }
  return String(asli.textContent || "");
}

/**
 * SATU KLIK. Menekan tombol asli: pemeriksaan dulu, lalu - hanya bila lulus -
 * penulisan. Jalur formulir SIPP yang terbuka (Kerjakan/Teruskan) tetap satu
 * tekanan seperti semula.
 */
async function t7TetapkanSemua(penunjukan) {
  const s = t7KeadaanSatuKlik(penunjukan);
  if (s.tahap === "periksa" || s.tahap === "tulis") return;
  const asli = penunjukan.querySelector(".aleta-tombol-tetapkan");
  if (!asli) {
    t7BukaPenunjukan(penunjukan);
    return;
  }
  if (asli.disabled) return;
  const lapor = (tahap) => {
    s.tahap = tahap;
    s.pendengar.forEach((f) => f());
  };
  const teks = String(asli.textContent || "");
  if (!T7_TOMBOL_ALETA.includes(teks)) {
    asli.click();
    return;
  }
  s.kering = null;
  s.tulis = null;
  if (teks === "Tetapkan dan tuliskan ke SIPP") {
    lapor("periksa");
    asli.click();
    const sesudah = await t7TungguTombol(asli, 180000);
    if (sesudah !== "Tuliskan ke SIPP") {
      lapor(sesudah === "Keempat penetapan sudah ada" ? "semua-ada" : "berhenti");
      return;
    }
  }
  lapor("tulis");
  asli.click();
  const akhir = await t7TungguTombol(asli, 240000);
  lapor(akhir === "Penetapan selesai" ? "selesai" : "gagal");
}

/** Status satu baris menurut keadaan satu-klik. null = tanpa status. */
function t7StatusBaris(s, jenis, tercatat) {
  if (!jenis) return null;
  const cari = (d) => (d && Array.isArray(d.hasil) ? d.hasil.find((x) => x && x.jenis === jenis) : null);
  if (s.tahap === "periksa") return tercatat ? { nada: "ok", teks: "Dilewati" } : { nada: "jalan", teks: "Memeriksa…" };
  if (s.tahap === "tulis") {
    const r = cari(s.kering);
    if (tercatat || (r && r.sudahAda)) return { nada: "ok", teks: "Dilewati" };
    return { nada: "jalan", teks: "Menulis…" };
  }
  const sumber = s.tahap === "berhenti" ? s.kering : s.tahap === "selesai" || s.tahap === "gagal" ? s.tulis || s.kering : null;
  if (!sumber) return null;
  const r = cari(sumber);
  if (r && r.sudahAda) return { nada: "ok", teks: "Dilewati", sebab: tercatat ? "" : "Sudah ada di SIPP." };
  if (r && r.ok) return { nada: "ok", teks: s.tahap === "berhenti" ? "✓ Siap" : "✓ Ditetapkan" };
  if (r && r.alasan === "dibatalkan_rantai") return { nada: "ditahan", teks: "Ditahan", sebab: t7KalimatAwam(r.bunyi) };
  if (r) return { nada: "gagal", teks: "✗ Gagal", sebab: t7KalimatAwam(r.bunyi || r.alasan) };
  if (tercatat) return null;
  const gagal = (sumber.hasil || []).find((x) => x && !x.ok && !x.sudahAda);
  return gagal ? { nada: "ditahan", teks: "Ditahan", sebab: `Menunggu ${String(gagal.jenis || "").toUpperCase()} berhasil lebih dulu.` } : null;
}

/** Baris PHS yang membawa peringatan hari libur - tombol utama ditahan sampai diubah. */
function t7AwasLiburPhs(daftar) {
  const phs = daftar.querySelector('.aleta-t7-keputusan-baris[data-jenis="phs"] .aleta-t7-awas');
  return phs && /hari libur|hari Sabtu|hari Minggu/.test(String(phs.textContent || "")) ? String(phs.textContent) : "";
}

/**
 * ============================================================================
 * PENETAPAN MULUS 2 (19 Okt 2026) - rancangan docs/rancangan/penetapan-mulus-2.html
 * ============================================================================
 *
 * Kartu "Penetapan" = "Penetapan dan Penunjukan Perkara" versi mulus. Tiap
 * baris punya "Ubah" yang langsung membuka menu pilihan (majelis menurut SK
 * dan tanpa kode, PP, JS, PHS tanggal/jam/ruang - masing-masing dengan
 * bebannya), baris "Ditetapkan ..." yang diklik untuk memilih pejabat penetap
 * (PPP dan PJS terpisah), dan tombol "e-Doc" untuk mengambil penetapan itu
 * dari ABT lalu mengunggahnya.
 *
 * TIDAK ADA JALAN TULIS BARU. Semua pilihan ditulis ke objek data papan yang
 * SAMA (usulanTerakhir: pilihanManual, pejabatDipilih) yang dibaca tombol
 * Tetapkan asli, lalu bagian rinci digambar ulang (gambarPenunjukan) - persis
 * seperti memilih di dropdown bagian rinci. Mengganti majelis memakai
 * muatUlangUsulan yang sama; PP terpaut majelis itu ikut berganti karena
 * pilihan PP tangan dilepas sebelum usulan dihitung ulang.
 *
 * Rinci dan mulus tidak pernah tampil bersamaan: kartu disembunyikan selama
 * bagian rinci terbuka (data-t7-tinjau), dan "Selesai mengubah" kembali.
 */
/** Data papan penunjukan yang sedang tergambar - objek yang SAMA dengan yang dibaca tombol Tetapkan. */
function t7DataPenunjukan() {
  const d = typeof usulanTerakhir !== "undefined" ? usulanTerakhir : null;
  return d && d.usulan && d.usulan.ok !== false ? d : null;
}

/** Menggambar ulang bagian rinci atas data yang sama (seperti dropdown-nya sendiri). */
function t7GambarUlangPenunjukan(penunjukan, data) {
  const isi = penunjukan && penunjukan.querySelector(":scope > .aleta-bagian-isi");
  if (!isi || !data) return;
  isi.textContent = "";
  gambarPenunjukan(isi, data);
}

/** Calon pejabat penetap satu langkah (rencana bot) dan yang sedang dipilih. */
function t7CalonPejabat(data, jenis) {
  const langkah = ((data && data.rencana && data.rencana.langkah) || []).find((x) => x && x.jenis === jenis);
  const calon = langkah && Array.isArray(langkah.calon) ? langkah.calon.filter((x) => x && x.username) : [];
  const dipilih = (data && data.pejabatDipilih && data.pejabatDipilih[jenis]) || (langkah && langkah.akun ? langkah.akun.username : "") || "";
  return { calon, dipilih };
}

/** Satu pilihan di menu: teks, beban di kanan, keterangan di bawah. */
function t7OpsiPilih(teks, beban, terpilih, mati, ket) {
  const b = t7Tombol("", "", "aleta-t7-pilih-opsi");
  b.setAttribute("role", "menuitemradio");
  b.setAttribute("aria-checked", terpilih ? "true" : "false");
  if (mati) b.disabled = true;
  b.appendChild(buatElemen("span", "aleta-t7-pilih-teks", teks));
  b.appendChild(buatElemen("span", "aleta-t7-pilih-beban", beban || ""));
  if (ket) b.appendChild(buatElemen("span", "aleta-t7-pilih-ket", ket));
  return b;
}

function t7MenuKosong(judul) {
  const m = buatElemen("div", "aleta-t7-pilih");
  m.setAttribute("role", "menu");
  if (judul) m.appendChild(buatElemen("div", "aleta-t7-pilih-judul", judul));
  return m;
}

/** Kaki menu: tautan kiri (boleh kosong) dan "Tutup". */
function t7KakiPilih(tutup, kiriTeks, kiriKerja) {
  const kaki = buatElemen("div", "aleta-t7-pilih-kaki");
  if (kiriTeks) {
    const kiri = t7Tombol(kiriTeks, "", "aleta-t7-tautan");
    kiri.addEventListener("click", kiriKerja);
    kaki.appendChild(kiri);
  } else kaki.appendChild(buatElemen("span"));
  const t = t7Tombol("Tutup", "", "aleta-t7-tautan aleta-t7-pilih-tutup");
  t.addEventListener("click", tutup);
  kaki.appendChild(t);
  return kaki;
}

/** Menu pejabat penetap - dipakai kartu mulus DAN tampilan rinci. */
function t7MenuPejabat(data, jenis, onPilih, tutup) {
  const { calon, dipilih } = t7CalonPejabat(data, jenis);
  const menu = t7MenuKosong(`Yang menetapkan ${String(jenis).toUpperCase()}`);
  menu.classList.add("aleta-t7-pilih-pejabat");
  for (const c of calon) {
    const o = t7OpsiPilih(
      `${c.namaLengkap || c.username}${c.sebutan ? ` — ${c.sebutan}` : ""}`,
      c.otomatis ? "usulan ALETA" : "",
      c.username === dipilih,
      false,
      c.siap === false ? "akunnya belum siap" : ""
    );
    o.setAttribute("data-t7-pejabat", c.username);
    o.addEventListener("click", () => onPilih(c.username));
    menu.appendChild(o);
  }
  menu.appendChild(t7KakiPilih(tutup));
  return menu;
}

/**
 * UI Baru: keterangan penetap menyebut nama + jabatan saja. Nama akun SIPP
 * ("(akun fahri)") bersifat teknis dan tidak ditampilkan; akun yang belum
 * siap tetap disebut dengan kalimat biasa oleh penetapUntuk.
 */
function t7TanpaAkun(teks) {
  return String(teks || "").replace(/ \(akun [^)]*\)/g, "");
}

/** Baris "Ditetapkan ..." yang dapat diklik. */
function t7TombolPenetap(teks) {
  const t = t7Tombol("", "Klik untuk memilih pejabat yang menetapkan", "aleta-t7-penetap");
  t.appendChild(buatElemen("span", "aleta-t7-penetap-teks", teks));
  t.appendChild(buatElemen("span", "aleta-t7-penetap-panah", "▾"));
  t.setAttribute("aria-haspopup", "menu");
  t.setAttribute("aria-expanded", "false");
  return t;
}

/**
 * Tampilan rinci UI Baru: keterangan penetap pada baris penetapan menjadi
 * tombol yang membuka pilihan pejabatnya (menggantikan kotak "Pejabat yang
 * menetapkan"). Yang calonnya satu tetap teks biasa.
 */
function t7PenetapDapatDiklik(span, data, jenis, gambarUlang) {
  if (!span || !data) return;
  if (t7CalonPejabat(data, jenis).calon.length <= 1) return;
  const tombol = t7TombolPenetap(String(span.textContent || ""));
  tombol.classList.add("aleta-tetap-penetap");
  tombol.setAttribute("data-jenis", jenis);
  span.replaceWith(tombol);
  let menu = null;
  const tutup = () => {
    if (menu) menu.remove();
    menu = null;
    tombol.setAttribute("aria-expanded", "false");
  };
  tombol.addEventListener("click", () => {
    if (menu) return tutup();
    menu = t7MenuPejabat(
      data,
      jenis,
      (username) => {
        if (!data.pejabatDipilih) data.pejabatDipilih = {};
        data.pejabatDipilih[jenis] = username;
        gambarUlang();
      },
      tutup
    );
    tombol.after(menu);
    tombol.setAttribute("aria-expanded", "true");
  });
}

/** Nama ruang sidang terpilih; kosong = bawaan mesin tulis (ruang 1 dalam gedung). */
function t7NamaRuang(id) {
  const daftar = typeof ruanganTersimpan !== "undefined" && Array.isArray(ruanganTersimpan) ? ruanganTersimpan : [];
  const cari = (x) => daftar.find((r) => String(r.id) === String(x));
  const r = id ? cari(id) : cari(1);
  return r ? String(r.nama || "") : id ? "" : "Ruang Sidang 1 Dalam Gedung";
}

/** Jam sidang terpilih untuk ditampilkan ("09.00"). */
function t7JamTampil(jam) {
  return String(jam || "09:00").slice(0, 5).replace(":", ".");
}

/** Kartu Penetapan mulus (UI Baru). Kelas dan label lama dipertahankan. */
function t7KartuKeputusan(k, penunjukan) {
  const kartu = buatElemen("section", "aleta-t7-kartu aleta-t7-keputusan aleta-t7-penetapan");
  const kepala = buatElemen("div", "aleta-t7-penetapan-kepala");
  const tag = buatElemen("span", "aleta-lipat-peran aleta-t7-penetapan-peran", "Ketua");
  tag.title = "Bagian ini untuk: Ketua";
  kepala.appendChild(tag);
  kepala.appendChild(buatElemen("span", "aleta-t7-penetapan-judul", "Penetapan"));
  const ringkasKepala = buatElemen("span", "aleta-t7-penetapan-ringkas");
  kepala.appendChild(ringkasKepala);
  const perkara = buatElemen("div", "aleta-t7-perkara");
  const daftar = buatElemen("div", "aleta-t7-keputusan-daftar");
  const mode = buatElemen("div", "aleta-t7-mode");
  const kaki = buatElemen("div", "aleta-t7-penetapan-kaki aleta-t7-keputusan-kaki");
  const hasilKotak = buatElemen("div", "aleta-t7-hasil");
  const utama = t7Tombol("Tetapkan semua", "", "aleta-t7-tetapkan-semua");
  const tinjau = t7Tombol(
    "Ubah semua pilihan",
    "Buka tampilan rinci: cara, majelis per orang, panitera, juru sita, hari sidang, sidang keliling - beserta beban tiap pilihan",
    "aleta-t7-kecil aleta-t7-ubah-semua"
  );
  const petunjuk = buatElemen("div", "aleta-t7-tetapkan-petunjuk");
  const muat = t7Tombol("Muat usulan penetapan", "Menyusun usulan majelis, panitera, juru sita, dan hari sidang", "aleta-t7-kecil");
  // Butir 10 (19 Okt 2026): passphrase TTE tidak ada di panel. Tanda tangan
  // diatur di halaman Tanda tangan pejabat portal.
  const ttd = buatElemen("div", "aleta-t7-ttd-ket", "Tanda tangan memakai gambar tanda tangan pejabat yang disahkan — atur di ");
  const ttdTautan = buatElemen("a", "aleta-t7-tautan", "Tanda tangan pejabat");
  ttdTautan.href = `${location.origin}/aleta/admin/aleta-ecourt#ttd`;
  ttdTautan.target = "_blank";
  ttdTautan.rel = "noopener";
  ttd.appendChild(ttdTautan);
  kaki.append(hasilKotak, utama, tinjau, muat, petunjuk, ttd);
  kartu.append(kepala, perkara, daftar, mode, kaki);

  const s = t7KeadaanSatuKlik(penunjukan);
  /** Menu yang sedang terbuka: { jenis, macam: "ubah" | "pejabat" } atau null. */
  let buka = null;
  /** Peta e-Doc penetapan (sudah terupload); dibaca sekali bila ada yang tercatat. */
  let edocPeta = null;
  let edocDimuat = false;
  /** Wadah konfirmasi + kabar e-Doc per jenis - elemen tetap, dipindah ke baris yang digambar ulang. */
  const wadahEdoc = new Map();
  const edocJalan = new Set();
  let tolakLibur = "";
  let ruangDiminta = false;

  const bukaRinci = () => {
    buka = null;
    const data = t7DataPenunjukan();
    // Tampilan rinci dibuka dalam cara Manual supaya SEMUA pilihan beserta
    // bebannya tampil. Nilai yang belum diubah tetap usulan - manual hanya
    // membuka dropdown-nya.
    if (data && data.caraPapan !== "manual") {
      data.caraPapan = "manual";
      t7GambarUlangPenunjukan(penunjukan, data);
    }
    t7SetelTinjau(penunjukan, true);
    kartu.hidden = true;
    if (typeof penunjukan.scrollIntoView === "function") penunjukan.scrollIntoView({ block: "start" });
  };

  /** Menulis satu pilihan ke data papan lalu menggambar ulang bagian rinci. */
  const terapkan = (ubah, tetapBuka) => {
    const data = t7DataPenunjukan();
    if (!data) return;
    if (!data.pilihanManual) data.pilihanManual = {};
    ubah(data.pilihanManual, data);
    // Pilihan tangan = cara Manual (bagian rinci menyebutnya apa adanya).
    data.caraPapan = "manual";
    if (!tetapBuka) buka = null;
    t7GambarUlangPenunjukan(penunjukan, data);
    segarkan();
  };

  const menuUbah = (data, jenis) => {
    const usulan = data.usulan || {};
    const pm = data.pilihanManual || {};
    const tutup = () => {
      buka = null;
      segarkan();
    };
    if (jenis === "pmh") {
      const pmh = usulan.pmh || {};
      const susunan = Array.isArray(pmh.susunanTerpakai) ? pmh.susunanTerpakai : [];
      const sekarang =
        pm.majelis ||
        (data.majelisDipilih ? kunciSusunan(data.majelisDipilih) : kunciSusunan((pmh.anggota || []).map((a) => a.hakimId ?? a.id)));
      const menu = t7MenuKosong("");
      const kelompok = [
        ["Menurut SK", susunan.filter((x) => x && x.majelisKode)],
        ["Tanpa kode", susunan.filter((x) => x && !x.majelisKode)],
      ];
      for (const [judul, isi] of kelompok) {
        if (!isi.length) continue;
        menu.appendChild(buatElemen("div", "aleta-t7-pilih-judul", judul));
        for (const x of isi) {
          const o = t7OpsiPilih(
            `${x.majelisKode ? `${x.majelisKode} — ` : ""}${(x.anggota || []).map((a) => a.nama).join(" · ")}`,
            sebutBeban(x.perkara),
            String(x.kunci) === String(sekarang),
            false,
            x.majelisKode ? "" : "di luar SK"
          );
          o.setAttribute("data-t7-majelis", String(x.kunci));
          o.addEventListener("click", () => {
            const isiRinci = penunjukan.querySelector(":scope > .aleta-bagian-isi");
            if (!isiRinci) return;
            if (!data.pilihanManual) data.pilihanManual = {};
            const p = data.pilihanManual;
            p.majelis = String(x.kunci);
            p.caraHakim = "majelis";
            p.pmhKursi = [];
            // PP mengikuti majelis yang dipilih (panitera sidang menurut SK):
            // pilihan PP tangan dilepas, usulan PP dihitung ulang untuk majelis itu.
            delete p.ppp;
            data.caraPapan = "manual";
            buka = null;
            void muatUlangUsulan(isiRinci, data, x.hakimId);
          });
          menu.appendChild(o);
        }
      }
      if (!susunan.length) menu.appendChild(buatElemen("div", "aleta-t7-pilih-ket", "Belum ada susunan majelis yang dapat dipilih di sini."));
      menu.appendChild(t7KakiPilih(tutup, "Per orang, hakim tunggal, sidang keliling: Ubah semua pilihan", bukaRinci));
      return menu;
    }
    if (jenis === "ppp" || jenis === "pjs") {
      const u = usulan[jenis] || {};
      const idDari = (x) => String(x.id ?? (jenis === "ppp" ? x.paniteraId : x.jurusitaId) ?? x.nama);
      const calon = Array.isArray(u.calon) && u.calon.length ? u.calon : u.usulan ? [u.usulan] : [];
      const sekarang = String(pm[jenis] ?? (u.usulan ? idDari(u.usulan) : ""));
      const menu = t7MenuKosong("");
      const kelompok =
        jenis === "ppp"
          ? [
              ["Panitera sidang majelis ini", calon.filter((x) => x && x.dariSk)],
              [calon.some((x) => x && x.dariSk) ? "Panitera pengganti lain" : "Panitera pengganti", calon.filter((x) => x && !x.dariSk)],
            ]
          : [["Juru sita", calon]];
      for (const [judul, isi] of kelompok) {
        if (!isi.length) continue;
        menu.appendChild(buatElemen("div", "aleta-t7-pilih-judul", judul));
        for (const x of isi) {
          const kode = jenis === "ppp" ? x.kodeSk || x.kode || "" : "";
          const o = t7OpsiPilih(
            `${kode ? `${kode} — ` : ""}${x.nama}`,
            x.jumlah !== undefined ? sebutBeban(x.jumlah) : "",
            idDari(x) === sekarang,
            false,
            jenis === "ppp" && x.dariSk ? "terpaut ke majelis ini menurut SK" : ""
          );
          o.setAttribute("data-t7-orang", idDari(x));
          o.addEventListener("click", () =>
            terapkan((p) => {
              p[jenis] = idDari(x);
            })
          );
          menu.appendChild(o);
        }
      }
      if (calon.length <= 1) menu.appendChild(buatElemen("div", "aleta-t7-pilih-ket", "Tidak ada pilihan lain saat ini."));
      menu.appendChild(t7KakiPilih(tutup));
      return menu;
    }
    // PHS: tanggal (hari sidang majelis; hari libur tidak dapat dipilih), jam, ruang.
    const phs = usulan.phs || {};
    const terpilih = String(pm.phs || phs.usulan || "");
    const menu = t7MenuKosong(phs.calon && phs.calon.length ? "Hari sidang majelis" : "");
    for (const x of phs.calon || []) {
      const libur = x.libur || (typeof ccBukanHariKerja === "function" ? String(ccBukanHariKerja(x.tanggal) || "").replace(/^libur: /, "") : "");
      const beban =
        x.jumlahSidang === null || x.jumlahSidang === undefined
          ? ""
          : x.jumlahSidang === 0
            ? "belum ada sidang"
            : `${x.jumlahSidang} sidang`;
      const o = t7OpsiPilih(
        x.sebut || sebutTanggal(x.tanggal),
        libur ? "libur" : [x.usulan ? "usulan" : `mundur ${x.pekan} pekan`, beban].filter(Boolean).join(" · "),
        x.tanggal === terpilih,
        Boolean(libur),
        libur ? `${libur} · tidak dapat dipilih` : ""
      );
      o.setAttribute("data-t7-tanggal", x.tanggal);
      o.addEventListener("click", () => {
        tolakLibur = "";
        terapkan((p) => {
          p.phs = x.tanggal;
          p.phsBebas = false;
        }, true);
      });
      menu.appendChild(o);
    }
    const medan = (label, el) => {
      const m = buatElemen("label", "aleta-t7-pilih-medan");
      m.appendChild(buatElemen("span", "", label));
      m.appendChild(el);
      menu.appendChild(m);
    };
    const tanggal = document.createElement("input");
    tanggal.type = "date";
    tanggal.className = "aleta-t7-phs-tanggal";
    tanggal.min = new Date().toISOString().slice(0, 10);
    tanggal.value = pm.phsBebas ? String(pm.phs || "") : "";
    tanggal.addEventListener("change", () => {
      const v = tanggal.value;
      if (!v) return;
      const libur = typeof ccBukanHariKerja === "function" ? ccBukanHariKerja(v) : "";
      if (libur || hariAkhirPekan(v)) {
        tolakLibur = `${sebutTanggal(v)} hari ${String(libur || hariAkhirPekan(v)).replace(/^libur: /, "libur ")} - tidak dapat dipilih.`;
        segarkan();
        return;
      }
      tolakLibur = "";
      terapkan((p) => {
        p.phs = v;
        p.phsBebas = !(phs.calon || []).some((x) => x.tanggal === v);
      }, true);
    });
    medan("Tanggal lain", tanggal);
    if (tolakLibur) menu.appendChild(buatElemen("div", "aleta-t7-awas", tolakLibur));
    const jam = document.createElement("input");
    jam.type = "time";
    jam.className = "aleta-t7-phs-jam";
    jam.value = String(pm.jam || "09:00").slice(0, 5);
    jam.addEventListener("change", () => {
      const v = String(jam.value || "").slice(0, 5);
      terapkan((p) => {
        if (!/^\d{2}:\d{2}$/.test(v) || v === "09:00") delete p.jam;
        else p.jam = v;
      }, true);
    });
    medan("Jam", jam);
    const ruang = document.createElement("select");
    ruang.className = "aleta-t7-phs-ruang";
    const daftarRuang = typeof ruanganTersimpan !== "undefined" && Array.isArray(ruanganTersimpan) ? ruanganTersimpan : [];
    // Daftar ruang dibaca SEKALI per kartu - gagal dibaca tidak diulang terus.
    if (!ruangDiminta && typeof ruanganTersimpan !== "undefined" && ruanganTersimpan === null && typeof muatRuangan === "function") {
      ruangDiminta = true;
      void muatRuangan().then(() => segarkan());
    }
    const adaSatu = daftarRuang.some((r) => String(r.id) === "1");
    if (!adaSatu) {
      const o = document.createElement("option");
      o.value = "";
      o.textContent = "Ruang Sidang 1 Dalam Gedung";
      ruang.appendChild(o);
    }
    for (const r of daftarRuang) {
      const o = document.createElement("option");
      o.value = String(r.id);
      o.textContent = String(r.nama || "");
      ruang.appendChild(o);
    }
    ruang.value = String(pm.ruangan || (adaSatu ? "1" : ""));
    ruang.addEventListener("change", () =>
      terapkan((p) => {
        p.ruangan = ruang.value;
      }, true)
    );
    medan("Ruang", ruang);
    menu.appendChild(t7KakiPilih(tutup));
    return menu;
  };

  /** Butir 7: ambil penetapan ini dari ABT lalu unggah ke e-Doc SIPP (mesin e6 yang sama). */
  const jalankanEdoc = async (jenis) => {
    if (edocJalan.has(jenis)) return;
    let wadah = wadahEdoc.get(jenis);
    if (!wadah) {
      wadah = buatElemen("div", "aleta-t7-edoc-wadah");
      wadah.setAttribute("data-jenis", jenis);
      wadahEdoc.set(jenis, wadah);
    }
    wadah.textContent = "";
    const wadahTanya = buatElemen("div", "aleta-t7-edoc-tanya");
    const kabar = buatElemen("div", "aleta-t7-edoc-kabar");
    wadah.append(wadahTanya, kabar);
    edocJalan.add(jenis);
    segarkan();
    try {
      const data = t7DataPenunjukan();
      const pk = (data && data.usulan && data.usulan.perkara) || {};
      const nomor = String(k.nomor || pk.nomorPerkara || "");
      const kode = jenis.toUpperCase();
      const nama = (typeof S2_NAMA_PENETAPAN !== "undefined" && S2_NAMA_PENETAPAN[kode]) || kode;
      const sudah = edocPeta ? b7SudahDariPeta(edocPeta, [kode]) : (await b7BacaSudahTerunggah(nomor, [kode])) || [];
      const baris = [
        `${nomor}: blangko ${nama} diambil dari ABT, ditandatangani dengan gambar tanda tangan pejabat yang disahkan${jenis === "pmh" ? ", diberi cap" : ""}, lalu diunggah ke e-Doc SIPP.`,
        "Ini menulis ke SIPP atas nama akun Anda.",
      ];
      if (sudah.length) baris.unshift(`${b7KalimatSudah(sudah)}. Mengunggah lagi akan MENIMPA e-Doc yang lama - yakin menimpa yang lama?`);
      const o = { judul: `Unggah e-Doc ${nama}`, baris, centang: "Sudah saya periksa", ya: sudah.length ? "Ya, timpa yang lama" : "Unggah", tidak: "Batal" };
      const ya = typeof a30Tanya === "function" ? await a30Tanya(wadahTanya, o) : window.confirm(`${baris.join("\n")}\n\nLanjutkan?`) === true;
      if (!ya) {
        kabar.textContent = "Dibatalkan - tidak ada yang dikirim.";
        return;
      }
      const hasil = await e6UnggahEdocPenetapan({
        nomorPerkara: nomor,
        perkaraId: String(pk.perkaraId || ""),
        jenis: [jenis],
        otomatis: false,
        kering: false,
        timpaDisetujui: true,
        kabar,
      });
      if (hasil && hasil.alasan === "tidak_ada_jenis") {
        kabar.textContent = `${nama} belum dinyalakan di Peta penetapan. `;
        const a = buatElemen("a", "aleta-t7-tautan", "Buka Peta penetapan ↗");
        a.href = `${location.origin}/aleta/admin/aleta-ecourt#peta-penetapan`;
        a.target = "_blank";
        a.rel = "noopener";
        kabar.appendChild(a);
      }
      if (hasil && hasil.ok) edocDimuat = false;
    } finally {
      edocJalan.delete(jenis);
      segarkan();
    }
  };

  muat.addEventListener("click", () => t7BukaPenunjukan(penunjukan));
  tinjau.addEventListener("click", bukaRinci);
  utama.addEventListener("click", () => {
    buka = null;
    void t7TetapkanSemua(penunjukan);
  });

  const segarkan = () => {
    // Rinci dan mulus tidak pernah tampil bersamaan.
    kartu.hidden = penunjukan.hasAttribute("data-t7-tinjau");
    daftar.textContent = "";
    const data = t7DataPenunjukan();
    const usulan = (data && data.usulan) || {};
    const pk = usulan.perkara || {};
    const pm = (data && data.pilihanManual) || {};
    const identitas = (k.konteks && k.konteks.identitas) || {};
    const baris = Array.from(penunjukan.querySelectorAll(".aleta-tetap")).filter((b) => !b.closest(".aleta-tetap-pejabat-baris"));
    const asli = penunjukan.querySelector(".aleta-tombol-tetapkan");
    const memuat = penunjukan.querySelector(".aleta-memuat") !== null;
    muat.hidden = baris.length > 0 || memuat;
    tinjau.hidden = baris.length === 0;

    // Ringkasan perkara
    perkara.textContent = "";
    const judulPerkara = [k.nomor || pk.nomorPerkara || "", identitas.jenisPerkara || pk.jenisPerkara || ""].filter(Boolean).join(" · ");
    perkara.appendChild(buatElemen("strong", "", judulPerkara));
    const sisa = data ? langkahSisaPenetapan(usulan) : [];
    const bagianKet = [];
    if (pk.tanggalDaftar) bagianKet.push(`Didaftarkan ${sebutTanggal(String(pk.tanggalDaftar).slice(0, 10))}`);
    if (usulan.tanggalPenetapan && sisa.length) {
      const tp = sebutTanggal(String(usulan.tanggalPenetapan).slice(0, 10));
      bagianKet.push(sisa.length === URUTAN_TULIS.length ? `keempatnya ditetapkan ${tp}` : `ditetapkan setanggal PMH yang sudah ada (${tp})`);
    }
    if (bagianKet.length) perkara.appendChild(document.createTextNode(bagianKet.join(" · ")));
    perkara.hidden = !judulPerkara && !bagianKet.length;

    if (baris.length === 0) {
      daftar.appendChild(t7Ket(memuat ? "Menyusun usulan…" : "Usulan belum dimuat. Tekan “Muat usulan penetapan”.", "aleta-t7-lembut"));
    }
    let tercatatJumlah = 0;
    const sibuk = s.tahap === "periksa" || s.tahap === "tulis";
    if (sibuk) buka = null;
    for (const b of baris) {
      const label = b.querySelector(".aleta-tetap-label");
      const nilai = b.querySelector(".aleta-tetap-isi, .aleta-tetap-kosong");
      const sebab = b.querySelector(".aleta-tetap-sebab");
      const awas = b.querySelector(".aleta-tetap-awas");
      const teksLabel = label ? String(label.textContent || "") : "";
      const jenis = T7_KODE_PENETAPAN[teksLabel] || "";
      const tercatatSipp = Boolean(nilai && nilai.classList.contains("aleta-tetap-tercatat"));
      if (jenis && tercatatSipp) tercatatJumlah += 1;
      const st = t7StatusBaris(s, jenis, tercatatSipp);
      // Sesudah ditulis (sebelum halaman dimuat ulang) barisnya sudah di SIPP.
      const tercatat = tercatatSipp || (s.tahap === "selesai" && Boolean(st) && st.nada === "ok");
      const r = buatElemen("div", `aleta-t7-keputusan-baris${awas ? " aleta-t7-nada-mendesak" : ""}`);
      if (jenis) r.setAttribute("data-jenis", jenis);
      r.appendChild(buatElemen("span", "aleta-t7-kode", jenis ? jenis.toUpperCase() : "•"));
      r.appendChild(buatElemen("span", "aleta-t7-keputusan-label", teksLabel));
      const kanan = buatElemen("span", "aleta-t7-keputusan-nilai");
      let teksNilai = nilai ? String(nilai.textContent || "") : "belum dapat diusulkan";
      // PHS: jam dan ruangnya ikut disebut (bawaan 09.00, ruang 1 dalam gedung).
      if (jenis === "phs" && !tercatat && nilai && nilai.classList.contains("aleta-tetap-isi")) {
        teksNilai = [teksNilai, t7JamTampil(pm.jam), t7NamaRuang(pm.ruangan)].filter(Boolean).join(" · ");
      }
      kanan.appendChild(buatElemen("strong", "", teksNilai));
      // Yang sudah tercatat di SIPP bukan usulan dan tidak dapat diubah dari
      // sini (barisPenetapanTercatat; uji rilis U1, 9 Okt 2026).
      if (tercatat) kanan.appendChild(buatElemen("span", "aleta-t7-chip-kecil aleta-t7-chip-sudah", "Sudah di SIPP"));
      else if (nilai && nilai.classList.contains("aleta-tetap-isi")) kanan.appendChild(buatElemen("span", "aleta-t7-chip-kecil", "Usulan ALETA"));
      const sudahEdoc = tercatat && edocPeta ? b7SudahDariPeta(edocPeta, [jenis.toUpperCase()]) : [];
      if (sudahEdoc.length) {
        const chip = buatElemen("span", "aleta-t7-chip-kecil aleta-t7-chip-edoc", "e-Doc sudah ada");
        if (sudahEdoc[0].terakhir) chip.title = `Terakhir diunggah ${b7TanggalSingkat(sudahEdoc[0].terakhir)} - mengunggah lagi menimpa yang lama.`;
        kanan.appendChild(chip);
      }
      if (sebab && sebab.textContent && !tercatat) {
        const info = buatElemen("span", "aleta-t7-info", "ⓘ");
        info.title = String(sebab.textContent);
        info.setAttribute("aria-label", `Sebab: ${sebab.textContent}`);
        kanan.appendChild(info);
      }
      r.appendChild(kanan);

      const aksi = buatElemen("span", "aleta-t7-baris-aksi");
      const terbukaUbah = Boolean(buka && buka.jenis === jenis && buka.macam === "ubah");
      if (jenis && !tercatat && !sibuk && data) {
        const ubah = t7Tombol("Ubah", "Pilih yang lain untuk penetapan ini", "aleta-t7-tautan aleta-t7-ubah");
        ubah.setAttribute("aria-haspopup", "menu");
        ubah.setAttribute("aria-expanded", terbukaUbah ? "true" : "false");
        ubah.addEventListener("click", () => {
          buka = terbukaUbah ? null : { jenis, macam: "ubah" };
          segarkan();
        });
        aksi.appendChild(ubah);
      }
      if (jenis) {
        const edoc = t7Tombol(
          "e-Doc",
          tercatat ? "Ambil penetapan ini dari ABT lalu unggah ke e-Doc SIPP" : "Tersedia sesudah penetapan ini tercatat di SIPP",
          "aleta-t7-edoc"
        );
        edoc.disabled = !tercatat || sibuk || edocJalan.has(jenis);
        edoc.addEventListener("click", () => void jalankanEdoc(jenis));
        aksi.appendChild(edoc);
      }
      if (aksi.childElementCount) r.appendChild(aksi);

      // Butir 2: pejabat penetap dipilih dengan mengeklik baris "Ditetapkan ...".
      if (jenis && !tercatat && data) {
        const teksPenetap = t7TanpaAkun(penetapUntuk(data, jenis));
        if (teksPenetap) {
          const terbukaPejabat = Boolean(buka && buka.jenis === jenis && buka.macam === "pejabat");
          if (t7CalonPejabat(data, jenis).calon.length > 1 && !sibuk) {
            const tp = t7TombolPenetap(teksPenetap);
            tp.setAttribute("aria-expanded", terbukaPejabat ? "true" : "false");
            tp.addEventListener("click", () => {
              buka = terbukaPejabat ? null : { jenis, macam: "pejabat" };
              segarkan();
            });
            r.appendChild(tp);
          } else {
            r.appendChild(buatElemen("span", "aleta-t7-penetap", teksPenetap));
          }
        }
      }
      if (awas) r.appendChild(buatElemen("span", "aleta-t7-awas", awas.textContent));
      if (st) {
        const tanda = buatElemen("span", `aleta-t7-langkah-status aleta-t7-langkah-${st.nada}`);
        if (st.nada === "jalan") tanda.appendChild(buatElemen("span", "aleta-t7-putar"));
        tanda.appendChild(document.createTextNode(st.teks));
        r.appendChild(tanda);
        if (st.sebab) r.appendChild(buatElemen("span", `aleta-t7-langkah-sebab${st.nada === "ditahan" ? " aleta-t7-langkah-sebab-ditahan" : ""}`, st.sebab));
      }
      if (buka && buka.jenis === jenis && !tercatat && !sibuk && data) {
        r.appendChild(
          buka.macam === "pejabat"
            ? t7MenuPejabat(
                data,
                jenis,
                (username) => {
                  if (!data.pejabatDipilih) data.pejabatDipilih = {};
                  data.pejabatDipilih[jenis] = username;
                  buka = null;
                  t7GambarUlangPenunjukan(penunjukan, data);
                  segarkan();
                },
                () => {
                  buka = null;
                  segarkan();
                }
              )
            : menuUbah(data, jenis)
        );
      }
      if (wadahEdoc.has(jenis)) r.appendChild(wadahEdoc.get(jenis));
      daftar.appendChild(r);
    }

    // e-Doc yang sudah terupload - dibaca sekali begitu ada penetapan yang tercatat.
    if (tercatatJumlah > 0 && !edocDimuat && (k.nomor || pk.nomorPerkara) && typeof S2_API_EDOC_PETA !== "undefined") {
      edocDimuat = true;
      void t7AmbilJson(`${S2_API_EDOC_PETA}?nomor=${encodeURIComponent(String(k.nomor || pk.nomorPerkara))}`, "Membaca e-Doc penetapan").then((j) => {
        if (j && j.ok) {
          edocPeta = s2BacaPetaEdoc(j.data);
          segarkan();
        }
      });
    }

    // Mode latihan / uji: tidak ada yang tersimpan - dikatakan sebelum ditekan.
    const latihan = typeof alatLatihanNyala === "function" && alatLatihanNyala();
    const uji = typeof alatKeringNyala === "function" && alatKeringNyala();
    mode.textContent = latihan ? "Mode latihan menyala - tidak ada yang tersimpan ke SIPP." : uji ? "Mode uji menyala - tidak ada yang tersimpan ke SIPP." : "";
    mode.hidden = !mode.textContent;

    // Ringkasan kepala
    const adaBaris = daftar.querySelectorAll(".aleta-t7-keputusan-baris[data-jenis]").length > 0;
    const semuaAda = adaBaris && tercatatJumlah === 4;
    ringkasKepala.classList.toggle("aleta-t7-ringkas-aman", s.tahap === "selesai" || semuaAda);
    ringkasKepala.textContent = sibuk
      ? "Sedang menetapkan…"
      : s.tahap === "selesai" || semuaAda
        ? "Semua sudah ditetapkan"
        : !adaBaris
          ? ""
          : tercatatJumlah
            ? `${tercatatJumlah} sudah di SIPP · ${4 - tercatatJumlah} belum`
            : "4 belum ditetapkan";
    ringkasKepala.hidden = !ringkasKepala.textContent;

    // Hasil
    const sisaKode = sisa.length ? t7SebutJenis(sisa) : "";
    hasilKotak.className = "aleta-t7-hasil";
    hasilKotak.textContent = "";
    if (s.tahap === "periksa") {
      hasilKotak.classList.add("aleta-t7-hasil-jalan");
      hasilKotak.textContent = "Memeriksa usulan…";
    } else if (s.tahap === "tulis") {
      hasilKotak.classList.add("aleta-t7-hasil-jalan");
      hasilKotak.textContent = `Pemeriksaan lulus. Menuliskan ${sisaKode || "penetapan"} ke SIPP…`;
    } else if (s.tahap === "selesai") {
      hasilKotak.classList.add("aleta-t7-hasil-ok");
      const ditulis = ((s.tulis && s.tulis.hasil) || []).filter((x) => x && x.ok).map((x) => x.jenis);
      hasilKotak.textContent = `${ditulis.length === 4 ? "Keempat penetapan" : t7SebutJenis(ditulis) || "Penetapan"} tersimpan di SIPP. Halaman dimuat ulang sebentar lagi.`;
    } else if (s.tahap === "berhenti") {
      hasilKotak.classList.add("aleta-t7-hasil-gagal");
      const g = ((s.kering && s.kering.hasil) || []).find((x) => x && !x.ok && !x.sudahAda);
      hasilKotak.textContent = g
        ? `Belum ada yang ditulis ke SIPP. Perbaiki ${String(g.jenis || "").toUpperCase()}, lalu tekan Tetapkan semua lagi.`
        : "Belum ada yang ditulis ke SIPP. Periksa sebabnya di atas, lalu tekan Tetapkan semua lagi.";
    } else if (s.tahap === "gagal") {
      hasilKotak.classList.add("aleta-t7-hasil-gagal");
      const hasilTulis = s.tulis || { ok: false, hasil: [] };
      hasilKotak.textContent =
        typeof rantaiDibatalkanUtuh === "function" && rantaiDibatalkanUtuh(hasilTulis)
          ? "Tidak ada yang tertulis ke SIPP. Perbaiki sebabnya di atas, lalu tekan Tetapkan semua lagi."
          : "Belum pasti tertulis atau tidak - periksa tab Penetapan SIPP sebelum mencoba lagi.";
    } else if (s.tahap === "semua-ada") {
      hasilKotak.classList.add("aleta-t7-hasil-ok");
      hasilKotak.textContent = "Keempat penetapan sudah ada di SIPP.";
    }
    hasilKotak.hidden = !hasilKotak.textContent;

    // Tombol utama
    const teksAsli = asli ? String(asli.textContent || "") : "";
    const jalurAleta = T7_TOMBOL_ALETA.includes(teksAsli) || /…$/.test(teksAsli);
    const libur = t7AwasLiburPhs(daftar);
    utama.hidden = !asli;
    if (asli) {
      if (sibuk) {
        utama.textContent = "Menetapkan…";
        utama.disabled = true;
      } else if (jalurAleta) {
        utama.textContent = s.tahap === "selesai" ? "Penetapan selesai" : "Tetapkan semua";
        utama.disabled = asli.disabled || s.tahap === "selesai" || Boolean(libur);
      } else {
        // Formulir SIPP terbuka (Kerjakan/Teruskan) atau keempatnya sudah ada.
        utama.textContent = teksAsli || "Tetapkan";
        utama.disabled = asli.disabled;
      }
    }
    petunjuk.textContent = !asli || sibuk || s.tahap === "selesai"
      ? ""
      : libur
        ? "Tanggal sidang jatuh pada hari libur. Ubah hari sidangnya dulu."
        : jalurAleta && sisa.length
          ? sisa.length === URUTAN_TULIS.length
            ? "Satu kali tekan: ALETA memeriksa lalu menuliskan PMH, PPP, PJS, dan PHS sesuai urutannya."
            : `Satu kali tekan: ALETA memeriksa lalu menuliskan ${sisaKode}. ${t7SebutJenis(URUTAN_TULIS.filter((x) => !sisa.includes(x)))} sudah ada di SIPP.`
          : "";
    petunjuk.hidden = !petunjuk.textContent;
  };
  s.pendengar.add(() => segarkan());
  return { kartu, segarkan };
}

/** Membuka bagian penunjukan (memuat usulannya) - sama dengan menekan kepalanya. */
function t7BukaPenunjukan(penunjukan) {
  const kepala = penunjukan.querySelector(":scope > .aleta-bagian-judul");
  const isi = penunjukan.querySelector(":scope > .aleta-bagian-isi");
  if (kepala && isi && isi.style.display === "none") kepala.click();
}

/** D6: seluruh pilihan disembunyikan di balik "Ubah" dalam UI Baru; atributnya hanya di sana. */
function t7SetelTinjau(penunjukan, buka) {
  if (buka) {
    penunjukan.setAttribute("data-t7-tinjau", "ya");
    t7BukaPenunjukan(penunjukan);
    // "Selesai mengubah" di kepala bagian rinci - menutupnya kembali.
    const kepala = penunjukan.querySelector(":scope > .aleta-bagian-judul");
    if (kepala && !kepala.querySelector(".aleta-t7-selesai-ubah")) {
      const selesai = t7Tombol("Selesai mengubah", "Tutup pilihan; usulan yang diubah tetap dipakai", "aleta-t7-tautan aleta-t7-selesai-ubah");
      selesai.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        t7SetelTinjau(penunjukan, false);
      });
      kepala.appendChild(selesai);
    }
  } else {
    penunjukan.removeAttribute("data-t7-tinjau");
  }
}

/**
 * D7 / sipp-5: bilah bawah lengket. Ringkasan yang akan ditulis + tombol
 * utama yang menjalankan SATU KLIK yang sama dengan kartu Penetapan (lewat
 * tombol Tetapkan asli). Pada jalur formulir SIPP bunyinya ikut tombol asli
 * ("Kerjakan PMH", ...), matinya ikut matinya.
 */
function t7PasangBilah(k, penunjukan) {
  const bilah = buatElemen("div", "aleta-t7-bilah");
  bilah.setAttribute("data-t7-fitur", "sipp-5");
  const ringkas = buatElemen("span", "aleta-t7-bilah-ringkas");
  const lihat = t7Tombol("Lihat perubahan", "Tampilkan seluruh pilihan dan rencana yang akan ditulis", "aleta-t7-tautan");
  const utama = t7Tombol("Tetapkan semua", "", "aleta-t7-utama");
  bilah.append(ringkas, lihat, utama);
  const kaki = k.panel.querySelector(":scope > .aleta-kaki");
  k.panel.insertBefore(bilah, kaki || null);
  const s = t7KeadaanSatuKlik(penunjukan);

  const lihatKe = () => {
    t7SetelTinjau(penunjukan, true);
    const tujuan = penunjukan.querySelector(".aleta-tetap-kaki") || penunjukan;
    if (typeof tujuan.scrollIntoView === "function") tujuan.scrollIntoView({ block: "center" });
  };
  lihat.addEventListener("click", lihatKe);
  utama.addEventListener("click", () => {
    if (!penunjukan.querySelector(".aleta-tombol-tetapkan")) {
      t7BukaPenunjukan(penunjukan);
      return;
    }
    void t7TetapkanSemua(penunjukan);
  });

  const segarkan = () => {
    const asli = penunjukan.querySelector(".aleta-tombol-tetapkan");
    const baris = penunjukan.querySelectorAll(".aleta-tetap .aleta-tetap-isi").length;
    const pejabat = Array.from(penunjukan.querySelectorAll(".aleta-tetap-pejabat-jenis")).map((x) => String(x.textContent || "").trim());
    if (!asli) {
      utama.textContent = "Muat usulan";
      utama.disabled = false;
      utama.title = "Usulan penetapan belum dimuat - tekan untuk menyusunnya.";
      ringkas.textContent = "Penetapan belum dimuat";
      return;
    }
    const teksAsli = String(asli.textContent || "Tetapkan");
    const jalurAleta = T7_TOMBOL_ALETA.includes(teksAsli) || /…$/.test(teksAsli);
    if (s.tahap === "periksa" || s.tahap === "tulis") {
      utama.textContent = "Menetapkan…";
      utama.disabled = true;
    } else if (jalurAleta) {
      utama.textContent = s.tahap === "selesai" ? "Penetapan selesai" : "Tetapkan semua";
      utama.disabled = asli.disabled || s.tahap === "selesai";
    } else {
      utama.textContent = teksAsli;
      utama.disabled = asli.disabled;
    }
    utama.title = asli.disabled ? "Tombol Tetapkan sedang mati - lihat sebabnya di kartu Penetapan." : "Satu kali tekan: memeriksa lalu menuliskan penetapan yang tersisa.";
    // UI Baru (19 Okt 2026): kotak "Pejabat yang menetapkan" tidak ada lagi -
    // yang tersisa dibaca dari langkah yang belum ada di SIPP.
    const dataUi = k.ui ? t7DataPenunjukan() : null;
    const sisaUi = dataUi ? langkahSisaPenetapan(dataUi.usulan).map((x) => x.toUpperCase()) : [];
    ringkas.textContent = dataUi
      ? sisaUi.length
        ? `${sisaUi.length} penetapan siap ditulis: ${sisaUi.join(" · ")}`
        : "Keempat penetapan sudah di SIPP"
      : pejabat.length
        ? `${pejabat.length} penetapan siap ditulis: ${pejabat.join(" · ")}`
        : `${baris} keputusan diusulkan`;
  };
  s.pendengar.add(() => segarkan());
  return { bilah, segarkan };
}

/**
 * D8: "Batalkan SELURUH penetapan" PINDAH ke menu ⋯ › Zona berbahaya. Tombol
 * dan pendengarnya yang SAMA dipindahkan - fungsinya tidak berubah, masih
 * dua tekanan (rencana lalu bongkar). Yang ditambah hanya gerbang: nomor
 * perkara harus diketik utuh lebih dulu. Gerbangnya pendengar fase TANGKAP
 * pada pembungkus, jadi tombol yang dihidupkan kembali oleh alurnya sendiri
 * tetap tertahan selama nomornya belum cocok.
 */
function t7PindahkanZona(k) {
  const slot = k.menu && k.menu.querySelector(".aleta-t7-zona-slot");
  if (!slot) return;
  const bongkar = k.panel.querySelector(".aleta-bongkar-semua:not([data-t7-zona])");
  if (!bongkar) return;
  slot.textContent = "";
  bongkar.setAttribute("data-t7-zona", "ya");
  const gerbang = buatElemen("label", "aleta-t7-gerbang");
  gerbang.appendChild(buatElemen("span", "", `Ketik nomor perkara (${k.nomor}) untuk membuka tombolnya`));
  const ketik = document.createElement("input");
  ketik.type = "text";
  ketik.className = "aleta-t7-masukan";
  ketik.autocomplete = "off";
  ketik.spellcheck = false;
  gerbang.appendChild(ketik);
  const cocok = () => Boolean(k.nomor) && t7KunciNomor(ketik.value) === t7KunciNomor(k.nomor);
  const perbarui = () => {
    if (cocok()) bongkar.removeAttribute("data-t7-terkunci");
    else bongkar.setAttribute("data-t7-terkunci", "ya");
  };
  ketik.addEventListener("input", perbarui);
  bongkar.addEventListener(
    "click",
    (e) => {
      if (cocok()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      ketik.focus();
    },
    true
  );
  perbarui();
  slot.append(gerbang, bongkar);
}

// ─── D2: kepala satu baris + menu ⋯ ──────────────────────────────────────────

/**
 * Yang dipindah ke menu tetap elemen yang SAMA beserta pendengarnya - tidak
 * ada tombol yang dibuat ulang. Peta fungsinya (sandingan lengkap):
 *
 *   pita akun ALETA/SIPP, chip peran, lencana server  -> ⋯ › Akun
 *   tema, ciutkan, layar penuh, ukuran asal            -> ⋯ › Panel
 *   warna gelap, perkakas ⚙, peta kolom formulir       -> ⋯ › Super Admin
 *   Batalkan SELURUH penetapan                          -> ⋯ › Zona berbahaya
 *   Riwayat ALETA, Data umum, batal terakhir, segarkan  -> ⋯ › Perkara ini
 *                                                          (lompatan; bagiannya
 *                                                          tetap di tab Penetapan)
 *
 * × tetap di kepala: dalam UI Baru ia hanya menutup menjadi lencana.
 */
function t7SusunKepala(k) {
  const kepala = k.panel.querySelector(":scope > .aleta-kepala");
  const alatKepala = kepala ? kepala.querySelector(".aleta-alat-kepala") : null;
  if (!kepala || !alatKepala) return;

  const judul = buatElemen("span", "aleta-t7-judul");
  judul.appendChild(buatElemen("span", "aleta-t7-nomor", k.nomor.split("/").slice(0, 3).join("/")));
  const identitas = (k.konteks && k.konteks.identitas) || {};
  const ket = [identitas.jenisPerkara, identitas.adaKumulasi ? "kumulasi" : ""].filter(Boolean).join(" · ");
  if (ket) judul.appendChild(buatElemen("span", "aleta-t7-judul-ket", ket));
  judul.title = k.nomor;
  const merek = kepala.querySelector(".aleta-merek");
  kepala.insertBefore(judul, merek ? merek.nextSibling : kepala.firstChild);
  kepala.insertBefore(t7Lampu(k, true), alatKepala);

  const menu = buatElemen("div", "aleta-t7-menu");
  menu.hidden = true;
  menu.setAttribute("role", "menu");
  k.menu = menu;
  const seksi = (nama, kelas) => {
    const s = buatElemen("div", `aleta-t7-menu-seksi${kelas ? ` ${kelas}` : ""}`);
    s.appendChild(buatElemen("div", "aleta-t7-menu-judul", nama));
    menu.appendChild(s);
    return s;
  };
  const akun = seksi("Akun");
  const panelSeksi = seksi("Panel");
  const perkara = seksi("Perkara ini");
  const superSeksi = seksi("Super Admin", "aleta-t7-menu-super");
  const zona = seksi("Zona berbahaya", "aleta-t7-menu-zona");
  zona.appendChild(buatElemen("div", "aleta-t7-zona-slot"));

  // Akun
  for (const pemilih of [":scope > .aleta-identitas-panel", ".aleta-kepala-peran", ".aleta-lingkungan"]) {
    const el = pemilih.startsWith(":scope") ? kepala.querySelector(pemilih) : alatKepala.querySelector(pemilih);
    if (el) akun.appendChild(el);
  }
  // Panel - ☀ – ⛶ ↺ TETAP di kepala (butir 7, 30 Sep 2026: "buat seperti
  // ekstensi lainnya posisi tombol" - panel ABT dan portal menaruhnya di
  // kepala). Menu memuat WAKILnya yang berlabel: menekannya menekan tombol
  // kepala yang sama, jadi perilakunya tidak mungkin berbeda.
  const label = [
    [".aleta-tema", "Tema terang / gelap"],
    [".aleta-lipat", "Ciutkan menjadi lencana"],
    [".aleta-penuh", "Layar penuh"],
    [".aleta-bawaan", "Kembalikan ukuran dan posisi"],
  ];
  for (const [pemilih, nama] of label) {
    const el = alatKepala.querySelector(pemilih);
    if (!el) continue;
    const baris = t7Tombol("", nama, "aleta-t7-menu-item aleta-t7-menu-baris aleta-t7-menu-wakil");
    baris.setAttribute("role", "menuitem");
    baris.setAttribute("data-a30-wakil", pemilih.slice(1));
    baris.appendChild(buatElemen("span", "aleta-t7-menu-ikon", String(el.textContent || "")));
    baris.appendChild(buatElemen("span", "aleta-t7-menu-label", nama));
    baris.addEventListener("click", () => {
      menu.hidden = true;
      el.click();
    });
    panelSeksi.appendChild(baris);
  }
  // Perkara ini - lompatan ke tempatnya.
  const lompat = (nama, kerja) => {
    const t = t7Tombol(nama, "", "aleta-t7-menu-item");
    t.setAttribute("role", "menuitem");
    t.addEventListener("click", () => {
      menu.hidden = true;
      kerja();
    });
    perkara.appendChild(t);
  };
  if (k.panel.querySelector('[data-kunci="riwayatAleta"]')) lompat("Riwayat ALETA (Alt+R)", () => t7Buka(k, "riwayatAleta"));
  if (k.panel.querySelector('[data-kunci="dataUmum"]')) lompat("Data umum dari gugatan", () => t7Buka(k, "dataUmum"));
  const penunjukan = k.panel.querySelector('[data-kunci="penunjukan"]');
  if (penunjukan) {
    lompat("Batalkan penetapan terakhir…", () => {
      t7PilihTab(k.panel, "kerjakan", false);
      t7SetelTinjau(penunjukan, true);
      const t = penunjukan.querySelector(".aleta-tetap-kaki .aleta-portal-tautan") || penunjukan;
      if (typeof t.scrollIntoView === "function") t.scrollIntoView({ block: "center" });
    });
  }
  lompat("Muat ulang data perkara", () => {
    const segar = k.panel.querySelector(".aleta-kaki-segar");
    if (segar) segar.click();
  });
  if (t7Nyala("sipp-30")) perkara.appendChild(t7KartuLapor(k));
  // Super Admin: peta kolom formulir sekarang; warna dan perkakas menyusul
  // (dipasang sesudah warna tersimpan terbaca - lihat pasangTombolKepala).
  const peta = k.panel.querySelector('.aleta-bagian[data-kunci="bacaBorang"]');
  if (peta) superSeksi.appendChild(peta);
  const pindahSuper = () => {
    for (const pemilih of [".aleta-warna-tombol", ".aleta-warna-pilih", ".aleta-perkakas-tombol"]) {
      for (const el of Array.from(alatKepala.querySelectorAll(pemilih))) superSeksi.appendChild(el);
    }
    superSeksi.hidden = superSeksi.childElementCount <= 1;
  };
  pindahSuper();
  const p = new MutationObserver(pindahSuper);
  p.observe(alatKepala, { childList: true });
  k.pengamat.push(p);
  zona.hidden = true;
  const pz = new MutationObserver(() => {
    zona.hidden = !zona.querySelector(".aleta-bongkar-semua");
  });
  pz.observe(zona, { childList: true, subtree: true });
  k.pengamat.push(pz);

  // Versi di kaki menu.
  const versi = k.panel.querySelector(".aleta-kaki-versi");
  if (versi) menu.appendChild(buatElemen("div", "aleta-t7-menu-versi", `ALETA ${versi.textContent}`));

  // Tombol ⌕ dan ⋯, sebelum ×.
  const tutup = alatKepala.querySelector(".aleta-matikan");
  const cari = t7Tombol("⌕", "Cari di panel (Ctrl+K)", "aleta-t7-ikon");
  cari.setAttribute("aria-label", "Cari di panel");
  const barisCari = t7KotakCari(k);
  barisCari.hidden = true;
  k.panel.insertBefore(barisCari, k.isi);
  cari.addEventListener("click", () => {
    barisCari.hidden = !barisCari.hidden;
    const masukan = barisCari.querySelector("input");
    if (!barisCari.hidden && masukan) masukan.focus();
  });
  const titik = t7Tombol("⋯", "Menu: akun, panel, perkara ini, Super Admin, zona berbahaya", "aleta-t7-ikon");
  titik.setAttribute("aria-haspopup", "menu");
  titik.setAttribute("aria-label", "Menu panel");
  titik.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
    titik.setAttribute("aria-expanded", menu.hidden ? "false" : "true");
    // Ikon wakil mengikuti tombol kepalanya (☀/☾, ⛶/⤢, –/▢).
    for (const w of Array.from(menu.querySelectorAll("[data-a30-wakil]"))) {
      const asli = alatKepala.querySelector(`.${w.getAttribute("data-a30-wakil")}`);
      const ikon = w.querySelector(".aleta-t7-menu-ikon");
      if (asli && ikon) ikon.textContent = String(asli.textContent || "");
    }
  });
  alatKepala.insertBefore(cari, tutup || null);
  alatKepala.insertBefore(titik, tutup || null);
  k.panel.appendChild(menu);
  // Klik di luar menu menutupnya. Terdaftar pada panel, bukan dokumen -
  // tidak ada pendengar yang tertinggal sesudah panelnya dibuang.
  k.panel.addEventListener("click", (e) => {
    if (menu.hidden) return;
    if (menu.contains(e.target) || titik.contains(e.target)) return;
    menu.hidden = true;
  });
}

// ─── D13 / sipp-11: cari di panel ────────────────────────────────────────────

function t7KotakCari(k) {
  const baris = buatElemen("div", "aleta-t7-cari");
  baris.setAttribute("data-t7-fitur", "sipp-11");
  const masukan = document.createElement("input");
  masukan.type = "search";
  masukan.className = "aleta-t7-masukan";
  masukan.placeholder = "Cari menu, bagian, atau baris… (Ctrl+K)";
  masukan.setAttribute("aria-label", "Cari di panel");
  const hasil = buatElemen("ul", "aleta-t7-cari-hasil");
  baris.append(masukan, hasil);
  masukan.addEventListener("input", () => {
    hasil.textContent = "";
    const kata = masukan.value.trim().toLowerCase();
    if (kata.length < 2) return;
    const calon = Array.from(
      k.panel.querySelectorAll(".aleta-kelompok-teks, .aleta-bagian-teks, .aleta-baris-judul, .aleta-nilai-nama, .aleta-t7-kartu-judul")
    ).filter((el) => String(el.textContent || "").toLowerCase().includes(kata));
    for (const el of calon.slice(0, 8)) {
      const li = buatElemen("li");
      const t = t7Tombol(String(el.textContent || "").trim().slice(0, 80), "", "aleta-t7-menu-item");
      t.addEventListener("click", () => t7TujuCari(k, el));
      li.appendChild(t);
      hasil.appendChild(li);
    }
    if (!calon.length) hasil.appendChild(buatElemen("li", "aleta-t7-lembut", "Tidak ada yang cocok."));
  });
  masukan.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const pertama = hasil.querySelector("button");
      if (pertama) pertama.click();
    }
  });
  return baris;
}

/** Membuka kelompok dan bagian tempat hasil cari tinggal, lalu menggulirnya. */
function t7TujuCari(k, el) {
  const kel = el.closest(".aleta-kelompok");
  if (kel && kel.dataset.kunci) {
    if (k.panel.hasAttribute("data-t7-tab")) t7PilihTab(k.panel, kel.dataset.kunci, false);
    else bukaBagianPanel(k.panel, kel.dataset.kunci);
  }
  const bag = el.closest(".aleta-bagian");
  if (bag && bag.dataset.kunci) bukaBagianPanel(k.panel, bag.dataset.kunci);
  if (typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "center" });
  el.classList.add("aleta-t7-sorot");
  setTimeout(() => el.classList.remove("aleta-t7-sorot"), 1600);
}

/** Ctrl+K: sekali per halaman, dan hanya bila panelnya memang punya kotak cari. */
function t7PasangCtrlK() {
  if (t7CtrlKTerpasang) return;
  t7CtrlKTerpasang = true;
  document.addEventListener(
    "keydown",
    (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || String(e.key || "").toLowerCase() !== "k") return;
      const panel = document.getElementById(PENANDA);
      const baris = panel ? panel.querySelector(".aleta-t7-cari") : null;
      if (!baris) return;
      e.preventDefault();
      if (typeof ciutkanKeLencana === "function") ciutkanKeLencana(panel, false);
      baris.hidden = false;
      const masukan = baris.querySelector("input");
      if (masukan) masukan.focus();
    },
    true
  );
}

// ─── D14 / sipp-22: kartu bantuan pintasan ───────────────────────────────────

function t7PasangBantuan(k) {
  const kiri = k.panel.querySelector(".aleta-kaki .aleta-kaki-kiri");
  if (!kiri) return;
  const tombol = t7Tombol("?", "Pintasan papan tik dan artinya", "aleta-t7-ikon aleta-t7-tanya");
  tombol.setAttribute("aria-label", "Bantuan pintasan");
  tombol.setAttribute("data-t7-fitur", "sipp-22");
  const kartu = buatElemen("div", "aleta-t7-bantuan");
  kartu.hidden = true;
  kartu.appendChild(buatElemen("div", "aleta-t7-kartu-judul", "Pintasan papan tik"));
  const daftar = buatElemen("dl", "aleta-t7-pintasan");
  const semua = [...PINTASAN_PANEL];
  if (t7Pakai("sipp-11", true)) semua.push({ tombol: "Ctrl+K", nama: "cari di panel" });
  for (const x of semua) {
    daftar.appendChild(buatElemen("dt", "", x.tombol));
    daftar.appendChild(buatElemen("dd", "", x.nama));
  }
  kartu.appendChild(daftar);
  kartu.appendChild(t7Ket("Tidak berlaku selagi mengetik di kolom isian.", "aleta-t7-lembut"));
  tombol.addEventListener("click", () => {
    kartu.hidden = !kartu.hidden;
  });
  kiri.appendChild(tombol);
  const kaki = k.panel.querySelector(":scope > .aleta-kaki");
  k.panel.insertBefore(kartu, kaki || null);
}

/** Tuas lebar di tepi kiri panel berlabuh. Lebarnya diingat PC ini. */
function t7PasangTuas(k) {
  const tuas = buatElemen("div", "aleta-t7-tuas");
  tuas.title = "Geser untuk mengatur lebar panel";
  tuas.setAttribute("aria-hidden", "true");
  k.panel.appendChild(tuas);
  void t7Baca([T7_KUNCI_LEBAR]).then((s) => {
    const n = Number(s[T7_KUNCI_LEBAR]);
    if (Number.isFinite(n) && n >= T7_LEBAR_MIN) {
      t7LebarTersimpan = n;
      t7TerapkanLabuh();
    }
  });
  tuas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const gerak = (ev) => {
      const maks = Math.max(T7_LEBAR_MIN, Math.round(window.innerWidth * 0.6));
      const lebar = Math.min(maks, Math.max(T7_LEBAR_MIN, Math.round(window.innerWidth - ev.clientX)));
      t7LebarTersimpan = lebar;
      document.documentElement.style.setProperty("--aleta-t7-lebar", `${lebar}px`);
      t7SetelSembul();
    };
    const lepas = () => {
      document.removeEventListener("pointermove", gerak);
      document.removeEventListener("pointerup", lepas);
      if (t7LebarTersimpan) t7Tulis({ [T7_KUNCI_LEBAR]: t7LebarTersimpan });
    };
    document.addEventListener("pointermove", gerak);
    document.addEventListener("pointerup", lepas);
  });
}

// ─── D10 / sipp-6: penyunting teks kaya dengan "Lihat kode" ──────────────────

const T7_TAG_BOLEH = new Set(["P", "B", "STRONG", "I", "EM", "U"]);

/**
 * HTML yang aman dan cocok dengan cetak putusan SIPP: hanya paragraf dan
 * tebal/miring/garis bawah. <br> dan <div> menjadi batas paragraf, daftar
 * bernomor menjadi paragraf berawalan "1." - sebab cetak SIPP menyapu <br>
 * dan hanya "<p>1." yang melekukkan blok (cleanHtmlTagSpecial). Tidak satu
 * atribut pun ikut, jadi tidak ada gaya atau skrip yang lolos.
 */
function t7RapikanHtml(html) {
  const s = String(html || "");
  if (!s.trim()) return "";
  const polos = !/<[a-z!/]/i.test(s);
  let dok;
  try {
    dok = new DOMParser().parseFromString(
      polos
        ? s
            .split(/\n/)
            .map((x) => `<p>${x.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`)
            .join("")
        : s,
      "text/html"
    );
  } catch {
    return s;
  }
  const paragraf = [];
  let kini = null;
  const mulai = () => {
    kini = document.createElement("p");
    paragraf.push(kini);
    return kini;
  };
  const tutup = () => {
    kini = null;
  };
  const jalan = (simpul, induk, awalan) => {
    for (const anak of Array.from(simpul.childNodes)) {
      if (anak.nodeType === 3) {
        const tempat = induk || kini || mulai();
        tempat.appendChild(document.createTextNode(anak.nodeValue));
        continue;
      }
      if (anak.nodeType !== 1) continue;
      const tag = anak.tagName;
      if (tag === "SCRIPT" || tag === "STYLE") continue;
      if (tag === "BR") {
        tutup();
        continue;
      }
      if (tag === "P" || tag === "DIV" || /^H[1-6]$/.test(tag)) {
        tutup();
        mulai();
        jalan(anak, null, "");
        tutup();
        continue;
      }
      if (tag === "OL" || tag === "UL") {
        tutup();
        let nomor = 0;
        for (const li of Array.from(anak.children)) {
          nomor += 1;
          const p = mulai();
          p.appendChild(document.createTextNode(tag === "OL" ? `${nomor}. ` : "- "));
          jalan(li, null, "");
          tutup();
        }
        continue;
      }
      if (T7_TAG_BOLEH.has(tag) && tag !== "P") {
        const tempat = induk || kini || mulai();
        const el = document.createElement(tag === "STRONG" ? "b" : tag === "EM" ? "i" : tag.toLowerCase());
        tempat.appendChild(el);
        jalan(anak, el, awalan);
        continue;
      }
      jalan(anak, induk, awalan);
    }
  };
  jalan(dok.body, null, "");
  return paragraf
    .filter((p) => p.textContent.trim() !== "" || p.childNodes.length > 0)
    .map((p) => p.outerHTML)
    .join("");
}

/** Mengisi wadah dengan HTML yang sudah dirapikan - lewat DOMParser, bukan innerHTML mentah. */
function t7IsiRapi(wadah, html) {
  wadah.textContent = "";
  try {
    const dok = new DOMParser().parseFromString(t7RapikanHtml(html), "text/html");
    for (const anak of Array.from(dok.body.childNodes)) wadah.appendChild(document.importNode(anak, true));
  } catch {
    wadah.textContent = t7TeksPolos(html);
  }
}

function t7Penyunting(sunting, ui) {
  const wadah = buatElemen("div", `aleta-t7-penyunting${ui ? " aleta-t7-penyunting-ui" : ""}`);
  wadah.setAttribute("data-t7-fitur", "sipp-6");
  const rapi = buatElemen("div", "aleta-t7-rapi");
  rapi.setAttribute("role", "textbox");
  rapi.setAttribute("aria-multiline", "true");
  t7IsiRapi(rapi, sunting.value);
  sunting.parentNode.insertBefore(wadah, sunting);

  if (!ui) {
    // Baru (sipp-6): pratinjau rapi, baca saja - kotak kodenya tetap di bawahnya.
    wadah.appendChild(buatElemen("div", "aleta-t7-label", "Tampil rapi"));
    wadah.appendChild(rapi);
    sunting.addEventListener("input", () => t7IsiRapi(rapi, sunting.value));
    return;
  }

  rapi.contentEditable = "true";
  rapi.spellcheck = true;
  const bilah = buatElemen("div", "aleta-t7-alat-teks");
  for (const [teks, perintah, judul] of [
    ["B", "bold", "Tebal"],
    ["I", "italic", "Miring"],
    ["U", "underline", "Garis bawah"],
  ]) {
    const t = t7Tombol(teks, judul, "aleta-t7-ikon");
    t.addEventListener("mousedown", (e) => e.preventDefault());
    t.addEventListener("click", () => {
      rapi.focus();
      try {
        document.execCommand(perintah);
      } catch {
        /* peramban tanpa execCommand */
      }
      tulisBalik();
    });
    bilah.appendChild(t);
  }
  const kode = t7Tombol("‹/› Lihat kode", "Tampilkan HTML yang akan diisikan ke SIPP", "aleta-t7-tautan");
  bilah.appendChild(kode);
  wadah.append(bilah, rapi);
  sunting.classList.add("aleta-t7-kode-sembunyi");

  // Yang diisikan ke SIPP tetap KOTAK ASLINYA - penyunting ini hanya menulis
  // ke sana, dan hanya ketika petugas menyunting di sini.
  let menulis = false;
  function tulisBalik() {
    menulis = true;
    sunting.value = t7RapikanHtml(rapi.innerHTML);
    sunting.dispatchEvent(new Event("input", { bubbles: true }));
    menulis = false;
  }
  rapi.addEventListener("focus", () => {
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {
      /* bawaan peramban dipakai; t7RapikanHtml membereskannya */
    }
  });
  rapi.addEventListener("input", tulisBalik);
  sunting.addEventListener("input", () => {
    if (!menulis) t7IsiRapi(rapi, sunting.value);
  });
  kode.addEventListener("click", () => {
    const tampak = sunting.classList.toggle("aleta-t7-kode-sembunyi") === false;
    kode.textContent = tampak ? "‹/› Sembunyikan kode" : "‹/› Lihat kode";
  });
}

// ─── D11 / sipp-7: praperiksa sebagai kartu bertingkat ───────────────────────

function t7RaporBertingkat(rapor) {
  const kotak = buatElemen("div", "aleta-praperiksa aleta-praperiksa-agen aleta-t7-rapor");
  kotak.setAttribute("data-t7-fitur", "sipp-7");
  const kepala = buatElemen("div", "aleta-praperiksa-kepala");
  kepala.appendChild(buatElemen("span", "aleta-praperiksa-judul-agen", "Praperiksa ALETA"));
  kepala.appendChild(
    buatElemen("span", `aleta-praperiksa-ringkas${rapor.hentikan ? " aleta-praperiksa-ringkas-henti" : ""}`, rapor.ringkas || "")
  );
  kotak.appendChild(kepala);
  const temuan = Array.isArray(rapor.temuan) ? rapor.temuan : [];
  const tingkat = [
    ["hentikan", "Menahan", "aleta-praperiksa-henti"],
    ["perhatian", "Perlu perhatian", "aleta-praperiksa-ganjal"],
    ["catatan", "Catatan", "aleta-praperiksa-catatan"],
  ];
  for (const [kunci, nama, kelas] of tingkat) {
    const isi = temuan.filter((t) => (kunci === "catatan" ? t.tingkat !== "hentikan" && t.tingkat !== "perhatian" : t.tingkat === kunci));
    if (!isi.length) continue;
    const kelompok = buatElemen(kunci === "catatan" ? "details" : "div", `aleta-t7-temuan-kelompok aleta-t7-temuan-${kunci}`);
    const judul = buatElemen(kunci === "catatan" ? "summary" : "div", "aleta-t7-temuan-judul", `${nama} (${isi.length})`);
    kelompok.appendChild(judul);
    for (const t of isi) {
      const kartu = buatElemen("div", `aleta-t7-temuan ${kelas}`);
      kartu.appendChild(buatElemen("span", "aleta-praperiksa-judul", t.judul || ""));
      if (t.rincian) kartu.appendChild(buatElemen("span", "aleta-praperiksa-rincian", t.rincian));
      const aksi = buatElemen("div", "aleta-t7-temuan-aksi");
      if (kunci === "hentikan") {
        const batal = t7Tombol("Batalkan pengisian", "Lepas semua centang isian putusan - tidak ada yang diisikan ke SIPP", "aleta-t7-kecil");
        batal.addEventListener("click", () => {
          const bag = kotak.closest(".aleta-bagian") || document;
          for (const c of Array.from(bag.querySelectorAll("input.aleta-abt-centang"))) c.checked = false;
          batal.textContent = "Centang dilepas";
          batal.disabled = true;
        });
        aksi.appendChild(batal);
      }
      const salin = t7Tombol("Salin", "Salin temuan ini", "aleta-t7-kecil");
      salin.addEventListener("click", () => void salinTeks(`${t.judul || ""}${t.rincian ? ` - ${t.rincian}` : ""}`));
      aksi.appendChild(salin);
      kartu.appendChild(aksi);
      kelompok.appendChild(kartu);
    }
    kotak.appendChild(kelompok);
  }
  if (!temuan.length) kotak.appendChild(buatElemen("div", "aleta-praperiksa-catatan", "Tidak ada temuan."));
  return kotak;
}

// ─── D12 / sipp-8: Penilaian SK ringkas ──────────────────────────────────────

function t7GambarPenilaianRingkas(isi, status) {
  const sk = status && status.penilaianSk;
  const rinci = sk && Array.isArray(sk.rinci) ? sk.rinci : [];
  if (rinci.length === 0) {
    isi.appendChild(buatElemen("div", "aleta-kosong", "Penilaian SK belum dapat dihitung."));
    return;
  }
  const terbaca = rinci.filter((x) => x.terbaca && x.poin !== null && x.poin !== undefined);
  const penuh = terbaca.filter((x) => x.poin >= (x.poinMaksimal === 0 ? 0 : 5)).length;
  const ringkas = buatElemen("div", "aleta-t7-skor-ringkas");
  ringkas.setAttribute("data-t7-fitur", "sipp-8");
  ringkas.appendChild(buatElemen("strong", "", `${penuh} dari ${rinci.length} unsur bernilai penuh`));
  const bilah = buatElemen("span", "aleta-t7-bilah-skor");
  const isiBilah = buatElemen("span", "aleta-t7-bilah-skor-isi");
  isiBilah.style.width = `${Math.round((penuh / Math.max(rinci.length, 1)) * 100)}%`;
  bilah.appendChild(isiBilah);
  ringkas.appendChild(bilah);
  isi.appendChild(ringkas);

  const kurang = terbaca.filter((x) => x.poin < (x.poinMaksimal === 0 ? 0 : 5));
  const bisa = kurang.filter((x) => /belum/i.test(String(x.catatan || "")));
  const lewat = kurang.filter((x) => !bisa.includes(x));
  const tabel = (judul, daftar, buka) => {
    if (!daftar.length) return;
    const wadah = buatElemen(buka ? "div" : "details", "aleta-t7-skor-kelompok");
    wadah.appendChild(buatElemen(buka ? "div" : "summary", "aleta-t7-temuan-judul", `${judul} (${daftar.length})`));
    const t = buatElemen("table", "aleta-t7-skor");
    for (const x of daftar.sort((a, b) => a.poin - b.poin)) {
      const tr = buatElemen("tr");
      const nama = buatElemen("td", "aleta-t7-skor-nama", x.label || x.kunci);
      if (x.catatan) nama.title = String(x.catatan);
      const min = Number(x.poinMinimal || 0);
      const maks = Number(x.poinMaksimal === 0 ? 0 : 5);
      const lebar = maks === min ? 0 : Math.round(((x.poin - min) / (maks - min)) * 100);
      const sel = buatElemen("td", "aleta-t7-skor-bilah");
      const b = buatElemen("span", "aleta-t7-bilah-skor");
      const bi = buatElemen("span", `aleta-t7-bilah-skor-isi aleta-t7-nada-${x.poin <= 0 ? "lewat" : x.poin <= 2 ? "mendesak" : "netral"}`);
      bi.style.width = `${Math.max(0, Math.min(100, lebar))}%`;
      b.appendChild(bi);
      sel.appendChild(b);
      tr.append(nama, sel, buatElemen("td", "aleta-t7-skor-poin", String(x.poin)));
      t.appendChild(tr);
      if (x.catatan) {
        const ket = buatElemen("tr", "aleta-t7-skor-ket");
        const td = buatElemen("td", "aleta-t7-lembut", String(x.catatan));
        td.colSpan = 3;
        ket.appendChild(td);
        t.appendChild(ket);
      }
    }
    wadah.appendChild(t);
    isi.appendChild(wadah);
  };
  tabel("Dapat diperbaiki sekarang", bisa, true);
  tabel("Sudah lewat", lewat, bisa.length === 0);
  const tak = rinci.filter((x) => !x.terbaca);
  if (tak.length) isi.appendChild(barisNilai("Belum tersambung", `${tak.length} unsur`, "netral"));
}
/** Penjelasan sepanjang ini atau lebih dilipat di balik ⓘ. */
const A30_PANJANG_LIPAT = 110;
const A30_PENJELASAN = ".aleta-tetap-sebab, .aleta-remeh, .aleta-abt-catatan, .aleta-t7-ket";
const A30_PERAN_JURU_SITA = /super|admin|panitera|juru\s*sita|jurusita/i;

// ─── Titik sambung dari t7Tata ───────────────────────────────────────────────

function a30Tata(panel, konteks, ui) {
  if (!a30Aktif() || !panel) return;
  panel.setAttribute("data-t7-a30", ui ? "ui" : "baru");
  // Perbaikan 30 Sep sore (agen S): menu per peran. Disiapkan SEBELUM Juru
  // Sita supaya matriks yang memutuskan tabnya; diterapkan sesudahnya.
  if (typeof mpsSiapkan === "function") mpsSiapkan(panel, konteks || {});
  a30JuruSita(panel, konteks || {}, ui);
  a30Kasir(panel, konteks || {}, ui);
  if (typeof mpsTerapkan === "function") mpsTerapkan(panel);
  a30PasangLipat(panel);
  if (typeof mpsSegarkanDariStatus === "function") mpsSegarkanDariStatus(panel, konteks || {});
}

// ─── Butir 6 / 26: ⓘ untuk penjelasan panjang ────────────────────────────────

function a30Ringkas(teks) {
  const kalimat = String(teks || "").split(/(?<=[.:;?!])\s/)[0] || "";
  if (kalimat.length <= 64) return kalimat;
  return `${kalimat.slice(0, 60).replace(/\s+\S*$/, "")}…`;
}

function a30LipatSatu(el) {
  if (!el || el.hasAttribute("data-a30-lipat") || !el.parentNode) return;
  const teks = String(el.textContent || "").replace(/\s+/g, " ").trim();
  if (teks.length < A30_PANJANG_LIPAT) return;
  if (el.closest(A30_BUKAN_PENJELASAN)) return;
  // Yang berisi tombol atau isian bukan penjelasan - tidak disembunyikan.
  if (el.querySelector("button, input, select, textarea, a")) return;
  const tombol = document.createElement("button");
  tombol.type = "button";
  tombol.className = "aleta-a30-info";
  tombol.setAttribute("data-a30-info", "");
  tombol.setAttribute("aria-expanded", "false");
  tombol.title = "Penjelasan - klik untuk membuka atau menutup";
  tombol.appendChild(buatElemen("span", "aleta-a30-info-ikon", "ⓘ"));
  tombol.appendChild(buatElemen("span", "aleta-a30-info-ringkas", a30Ringkas(teks)));
  // Penjelasan teknis (butir 3 sore): ⓘ-nya ikut tersembunyi bersamanya.
  if (el.classList.contains("aleta-teknis")) tombol.classList.add("aleta-teknis");
  el.setAttribute("data-a30-lipat", "tutup");
  el.parentNode.insertBefore(tombol, el);
  tombol.addEventListener("click", (peristiwa) => {
    peristiwa.stopPropagation();
    const buka = el.getAttribute("data-a30-lipat") !== "buka";
    el.setAttribute("data-a30-lipat", buka ? "buka" : "tutup");
    tombol.setAttribute("aria-expanded", buka ? "true" : "false");
  });
}

/**
 * Menyapu panel sekarang dan tiap kali isinya bertambah (bagian malas lahir
 * belakangan). Pengamatnya milik panel - panel yang dibuang membawanya pergi.
 */
function a30PasangLipat(panel) {
  const sapu = () => {
    // Penanda teknis lebih dulu, supaya ⓘ yang lahir sesudahnya ikut tertanda.
    if (typeof mpsTandaiTeknis === "function") mpsTandaiTeknis(panel);
    for (const el of Array.from(panel.querySelectorAll(A30_PENJELASAN))) a30LipatSatu(el);
  };
  sapu();
  let jadwal = 0;
  const pengamat = new MutationObserver(() => {
    if (jadwal) return;
    jadwal = setTimeout(() => {
      jadwal = 0;
      if (panel.isConnected && a30Aktif()) sapu();
    }, 0);
  });
  pengamat.observe(panel, { childList: true, subtree: true });
}

// ─── Butir 15: bagian / tab Juru Sita (jurusita.js milik agen E) ─────────────

/**
 * Penentunya jurusita.js sendiri (aletaJurusitaBoleh) - bila berkas itu tidak
 * termuat, tidak ada bagian Juru Sita sama sekali. A30_PERAN_JURU_SITA hanya
 * penyaring awal yang sama dengan alatKelasPeran (juru sita, panitera, admin,
 * super admin), supaya peran lain tidak pernah menanyakannya.
 */
function a30BolehJuruSita() {
  const peran = typeof penggunaTerakhir !== "undefined" && penggunaTerakhir && penggunaTerakhir.peran ? String(penggunaTerakhir.peran) : "";
  if (!peran || !A30_PERAN_JURU_SITA.test(peran)) return false;
  if (typeof globalThis.aletaJurusitaBoleh !== "function") return false;
  try {
    return globalThis.aletaJurusitaBoleh(peran) === true;
  } catch {
    return false;
  }
}

/**
 * Baru: bagian "Juru Sita" di kelompok Perkara. UI Baru: kelompok sendiri,
 * yang menjadi tab (T7_TAB). Isinya digambar jurusita.js saat PERTAMA dibuka -
 * membuka halaman perkara tidak membaca jadwal apa pun.
 */
function a30JuruSita(panel, konteks, ui) {
  if (typeof globalThis.aletaJurusitaPasang !== "function") return;
  // Perbaikan 30 Sep sore: bila matriks menu peran berlaku (panel.mps), menu
  // "jurusita" di sana yang memutuskan - Super Admin & Admin SELALU mendapat
  // tabnya. Peran lain yang lolos penyaring lama tetap dibuatkan, lalu
  // disembunyikan mpsTerapkan bila tidak ada di menunya (tidak dibuang).
  const menu = panel.mps && Array.isArray(panel.mps.menu) ? panel.mps.menu : null;
  const lewatMenu = Boolean(menu && menu.includes("jurusita"));
  if (!lewatMenu && !a30BolehJuruSita()) return;
  const isi = panel.querySelector(":scope > .aleta-isi");
  if (!isi || isi.querySelector('[data-a30-fitur="jurusita"]')) return;
  const nomor = String(konteks.nomorPerkara || "");
  // Dengan matriks, Juru Sita di Baru juga kelompok sendiri (bukan bagian di
  // dalam Perkara) supaya dapat diurutkan dan menjadi menu pertama juru sita.
  const sendiri = ui || Boolean(menu);
  const wadahan = sendiri ? kelompok("Juru Sita", "juruSitaKel", !ui) : bagian("Juru Sita", "juruSita", true);
  wadahan.setAttribute("data-a30-fitur", "jurusita");
  let dipasang = false;
  const pasang = () => {
    if (dipasang) return;
    dipasang = true;
    const memuat = buatElemen("div", "aleta-memuat", "Memuat Juru Sita…");
    wadahan.isi.appendChild(memuat);
    Promise.resolve()
      .then(() => globalThis.aletaJurusitaPasang(wadahan.isi, { situs: "sipp", nomorPerkara: nomor, perkaraId: perkaraIdDariHalaman() }))
      .then((ok) => {
        memuat.remove();
        // jurusita.js menolak (peran/tampilan): bagian atau tabnya disembunyikan.
        if (!ok) a30LepasJuruSita(panel, wadahan);
      })
      .catch((galat) => {
        memuat.remove();
        wadahan.isi.appendChild(buatElemen("div", "aleta-gagal", `Juru Sita tidak dapat dimuat: ${String((galat && galat.message) || galat)}`));
      });
  };
  const terbuka = () => wadahan.isi.style.display !== "none" && !wadahan.hasAttribute("data-mps-sembunyi");
  if (sendiri && !ui) {
    // Baru dengan matriks: kelompok berlipat. Dipasang saat pertama kali
    // terbuka - oleh petugas, atau oleh mpsTerapkan (menu pertama juru sita).
    isi.appendChild(wadahan);
    new MutationObserver(() => {
      if (terbuka()) pasang();
    }).observe(wadahan.isi, { attributes: true, attributeFilter: ["style"] });
    setTimeout(() => {
      if (terbuka()) pasang();
    }, 0);
  } else if (ui) {
    // Dalam tab, kepala kelompok disembunyikan dan isinya selalu tampak
    // (CSS Tahap 7) - yang menentukan hanya tab yang dipilih.
    isi.appendChild(wadahan);
    const cek = () => {
      if (panel.getAttribute("data-t7-tab") === "juruSitaKel") pasang();
    };
    new MutationObserver(cek).observe(panel, { attributes: true, attributeFilter: ["data-t7-tab"] });
    const judulKel = wadahan.querySelector(":scope > .aleta-kelompok-judul");
    if (judulKel) judulKel.addEventListener("click", () => terbuka() && pasang());
  } else {
    const judul = wadahan.querySelector(":scope > .aleta-bagian-judul");
    if (judul) judul.addEventListener("click", () => terbuka() && pasang());
    const kel = typeof t7Kelompok === "function" ? t7Kelompok(isi, "perkara") : null;
    (kel && kel.isi ? kel.isi : isi).appendChild(wadahan);
    if (terbuka()) pasang();
  }
}

/** Bagian/tab Juru Sita dilepas; tab yang sedang terpilih pindah ke tab pertama. */
function a30LepasJuruSita(panel, wadahan) {
  wadahan.remove();
  const tab = panel.querySelector('.aleta-t7-tab[data-t7-ke="juruSitaKel"]');
  if (tab) tab.remove();
  if (panel.getAttribute("data-t7-tab") === "juruSitaKel") {
    const pertama = panel.querySelector(".aleta-t7-tab:not([data-mps-sembunyi])");
    if (pertama && typeof t7PilihTab === "function") t7PilihTab(panel, pertama.getAttribute("data-t7-ke"), false);
  }
}

/** Halaman dibuka menuju tab Biaya Perkara SIPP (segmen ketiga /11 atau #aleta-tab=11)? */
function a30MenujuJurnal() {
  const alamat = `${location.pathname || ""}${location.hash || ""}`;
  return /\/11\/?(?:$|[?#])|#aleta-tab=11$/.test(alamat);
}

/**
 * Tab "Kasir" (UI Baru) / kelompok Kasir (Baru). Isinya: Kasir per perkara -
 * usulan jurnal menurut KEADAAN perkara langsung tersusun saat dibuka - lalu
 * pengingat tugas kasir, massal satu hari, dan rekap (berlipat). Dibuka
 * sendiri bila petugas menekan tab "Biaya Perkara" SIPP (jurnal keuangan
 * perkara) atau halamannya dibuka menuju tab itu.
 */
function a30Kasir(panel, konteks, ui) {
  if (!a30BolehKasir()) return;
  const isi = panel.querySelector(":scope > .aleta-isi");
  if (!isi || isi.querySelector('[data-a30-fitur="kasir"]')) return;
  const menu = panel.mps && Array.isArray(panel.mps.menu) ? panel.mps.menu : null;
  const sendiri = ui || Boolean(menu);
  const wadahan = sendiri ? kelompok("Kasir", "kasirKel", !ui) : bagian("Kasir", "kasir", true);
  wadahan.setAttribute("data-a30-fitur", "kasir");
  // R 13 Okt (butir 3): di UI Baru isi tab Kasir menjadi SATU bagian berkepala
  // seperti tab hakim/panitera ("Hakim | Putusan otomatis") - kepalanya diberi
  // tag peran bulat "Kasir" oleh s2TandaiPeranSemua (S2_PERAN_BAGIAN).
  const bagianKasir = ui ? bagian("Jurnal keuangan perkara", "kasirPerkara", false) : null;
  if (bagianKasir) wadahan.isi.appendChild(bagianKasir);
  const tempatKasir = bagianKasir ? bagianKasir.isi : wadahan.isi;
  const perkaraId = String((konteks.identitas && konteks.identitas.perkaraId) || perkaraIdDariHalaman() || "");
  let dipasang = false;
  const pasang = () => {
    if (dipasang) return;
    dipasang = true;
    const memuat = buatElemen("div", "aleta-memuat", "Memuat Kasir…");
    tempatKasir.appendChild(memuat);
    // R 11 Okt: halaman jurnal per perkara (detil_biaya) tidak memuat perkara_id
    // polos - dicari dari nomor perkara lewat rute Kasir yang sudah ada (?cari=).
    Promise.resolve()
      .then(() => perkaraId || r11CariPerkaraId(String(konteks.nomorPerkara || "")))
      .then((id) => globalThis.aletaKasirPasang(tempatKasir, { perkaraId: id || "", nomorPerkara: String(konteks.nomorPerkara || "") }))
      .then((ok) => {
        memuat.remove();
        if (!ok) return a30LepasKasir(panel, wadahan);
        // R 11 Okt (butir 4): Kasir massal/pengingat/rekap TIDAK lagi di tab per
        // perkara - pindah ke halaman daftar jurnal keuangan (susunPanelDaftar).
        r11SegarkanLencanaKasir(panel, wadahan, { perkaraId, nomorPerkara: String(konteks.nomorPerkara || "") }, false);
        return true;
      })
      .catch((galat) => {
        memuat.remove();
        tempatKasir.appendChild(buatElemen("div", "aleta-gagal", `Kasir tidak dapat dimuat: ${String((galat && galat.message) || galat)}`));
      });
  };
  const terbuka = () => wadahan.isi.style.display !== "none" && !wadahan.hasAttribute("data-mps-sembunyi");
  const bukaKasir = () => {
    if (ui && typeof t7PilihTab === "function") t7PilihTab(panel, "kasirKel", false);
    else if (typeof bukaBagianPanel === "function") bukaBagianPanel(panel, sendiri ? "kasirKel" : "kasir");
    pasang();
  };
  if (ui) {
    isi.appendChild(wadahan);
    new MutationObserver(() => {
      if (panel.getAttribute("data-t7-tab") === "kasirKel") pasang();
    }).observe(panel, { attributes: true, attributeFilter: ["data-t7-tab"] });
    const judulKel = wadahan.querySelector(":scope > .aleta-kelompok-judul");
    if (judulKel) judulKel.addEventListener("click", () => terbuka() && pasang());
  } else if (sendiri) {
    isi.appendChild(wadahan);
    new MutationObserver(() => {
      if (terbuka()) pasang();
    }).observe(wadahan.isi, { attributes: true, attributeFilter: ["style"] });
  } else {
    const judul = wadahan.querySelector(":scope > .aleta-bagian-judul");
    if (judul) judul.addEventListener("click", () => terbuka() && pasang());
    const kel = typeof t7Kelompok === "function" ? t7Kelompok(isi, "perkara") : null;
    (kel && kel.isi ? kel.isi : isi).appendChild(wadahan);
  }
  // Butir 1: membuka jurnal keuangan perkara SIPP = usulan Kasir tersusun.
  // Satu pendengar per halaman (panel digambar ulang berkali-kali).
  if (!document.documentElement.hasAttribute("data-aleta-kasir-tab11")) {
    document.documentElement.setAttribute("data-aleta-kasir-tab11", "");
    document.addEventListener(
      "click",
      (e) => {
        const a = e.target && e.target.closest ? e.target.closest('a[href$="#tabs11"]') : null;
        if (!a) return;
        const p = document.getElementById(PENANDA);
        if (p && p.a30BukaKasir) setTimeout(() => p.a30BukaKasir(), 0);
      },
      true
    );
  }
  panel.a30BukaKasir = bukaKasir;
  // R 11 Okt (butir 1 & 3): halaman jurnal per perkara = Kasir saja; lencana
  // bulat di samping tab Kasir seperti tab lain.
  r11TandaiHalamanKasir(panel);
  r11PasangLencanaKasir(panel, wadahan, { perkaraId, nomorPerkara: String(konteks.nomorPerkara || "") });
  if (a30MenujuJurnal() || r11HalamanJurnalPerkara()) setTimeout(bukaKasir, 0);
}

function a30LepasKasir(panel, wadahan) {
  wadahan.remove();
  const tab = panel.querySelector('.aleta-t7-tab[data-t7-ke="kasirKel"]');
  if (tab) tab.remove();
  if (panel.getAttribute("data-t7-tab") === "kasirKel") {
    const pertama = panel.querySelector(".aleta-t7-tab:not([data-mps-sembunyi])");
    if (pertama && typeof t7PilihTab === "function") t7PilihTab(panel, pertama.getAttribute("data-t7-ke"), false);
  }
  // R 11 Okt: Kasir ditolak di halaman jurnal per perkara -> panel kembali ke
  // menu perannya (bukan panel kosong).
  r11LepasKonteksKasir(panel);
}
const R11_UMUR_SINGGAH_MS = 120000;
const R11_JEDA_LENCANA_MS = 700;
/** perkaraId -> { waktu, janji } ringkasan cadangan dari rute kasir. */
const r11SinggahKasir = new Map();
const r11Keadaan = { pendengarBerubah: false };

/** Halaman jurnal keuangan PER PERKARA SIPP ("BUKU JURNAL KEUANGAN PERKARA ..."). */
function r11HalamanJurnalPerkara() {
  return /\/detil_biaya(?:_ht|_teguran)?(?:\/|$)/i.test(String(location.pathname || ""));
}

/**
 * Menu perkara sesudah matriks: (a) PTSP mendapat Penetapan bila kemampuan
 * "penunjukan" diberikan Admin (fitur lama tidak dikurangi), (b) Kasir bagi
 * yang boleh, (c) halaman jurnal per perkara = Kasir saja.
 */
function r11SesuaikanMenu(menu, panel) {
  let m = Array.isArray(menu) ? menu.slice() : [];
  const golongan = typeof alatGolonganMenuSemua === "function" ? alatGolonganMenuSemua(r11PenggunaMenu()) : [];
  if (golongan.includes("ptsp") && !m.includes("penetapan") && typeof boleh === "function" && boleh("penunjukan")) m.unshift("penetapan");
  const bolehKasir = a30BolehKasir();
  if (bolehKasir && !m.includes("kasir")) m.push("kasir");
  if (bolehKasir && r11HalamanJurnalPerkara() && !(panel && panel.r11TanpaKasir)) m = ["kasir"];
  return m;
}

/** Panel di halaman jurnal per perkara ditandai - CSS menyembunyikan baris atas & daftar isi. */
function r11TandaiHalamanKasir(panel) {
  if (!panel || panel.r11TanpaKasir) return;
  if (r11HalamanJurnalPerkara()) panel.setAttribute("data-r11-halaman", "jurnal-perkara");
}

function r11LepasKonteksKasir(panel) {
  if (!panel || !panel.hasAttribute("data-r11-halaman")) return;
  panel.r11TanpaKasir = true;
  panel.removeAttribute("data-r11-halaman");
  const s = panel.mps;
  if (s && typeof mpsMenuPerkara === "function") {
    const menu = mpsMenuPerkara({ ditangani: s.ditangani, penunjukanLengkap: s.penunjukanLengkap });
    if (menu) {
      s.menu = r11SesuaikanMenu(menu, panel).filter((k) => k !== "kasir");
      if (typeof mpsTerapkan === "function") mpsTerapkan(panel);
    }
  }
}

/** Jawaban ringkas (agen K atau cadangan) -> { teks, nada } | null. */
function r11NormalRingkas(x) {
  if (x === null || x === undefined || x === false) return null;
  const o = typeof x === "number" ? { terbuka: x } : x;
  if (typeof o !== "object") return null;
  // Agen K (5d751d7): { usulan, kejadian, keadaan, saldo } - usulan = baris tercentang.
  const mentah = o.terbuka !== undefined ? o.terbuka : typeof o.usulan === "number" ? o.usulan : o.jumlah;
  const terbuka = mentah === undefined || mentah === null || mentah === "" ? NaN : Number(mentah);
  const lengkap = o.lengkap === true || terbuka === 0;
  let teks = typeof o.teks === "string" ? o.teks.trim() : "";
  if (!teks) teks = lengkap ? "lengkap" : Number.isFinite(terbuka) && terbuka > 0 ? `${terbuka} usulan` : "";
  if (!teks) return null;
  const nada = ["lewat", "mendesak", "aman", "netral"].includes(o.nada) ? o.nada : lengkap ? "aman" : "mendesak";
  return { teks, nada };
}

/** Ringkasan Kasir satu perkara: aletaKasirRingkas (agen K) bila ada, selain itu rute kasir. */
async function r11RingkasKasir(o, segar) {
  const id = String(o.perkaraId || (await r11CariPerkaraId(o.nomorPerkara)) || "");
  if (typeof globalThis.aletaKasirRingkas === "function") {
    try {
      return r11NormalRingkas(await globalThis.aletaKasirRingkas({ perkaraId: id, nomorPerkara: o.nomorPerkara, segar: Boolean(segar) }));
    } catch {
      return null;
    }
  }
  if (!/^\d+$/.test(id)) return null;
  const ada = r11SinggahKasir.get(id);
  if (!segar && ada && Date.now() - ada.waktu < R11_UMUR_SINGGAH_MS) return ada.janji;
  const janji = (async () => {
    const r = await alatAmbil(`${R11_API_KASIR}?perkaraId=${encodeURIComponent(id)}`, { credentials: "include", cache: "no-store" }, "Ringkasan Kasir");
    if (!r || !r.ok) return null;
    const luar = await r.json().catch(() => null);
    const isi = luar && luar.data ? luar.data : luar;
    if (!isi || isi.available === false || isi.ok === false || !Array.isArray(isi.usulan)) return null;
    // Yang dihitung = baris yang ALETA usulkan untuk ditulis (tercentang
    // bawaan); sisa otomatis bernilai nol bukan pekerjaan.
    const terbuka = isi.usulan.filter((u) => u && u.pilih && (!u.sisaOtomatis || Number(u.jumlah) > 0)).length;
    if (!terbuka && isi.usulan.length) return { teks: "periksa", nada: "netral" };
    return r11NormalRingkas({ terbuka });
  })().catch(() => null);
  r11SinggahKasir.set(id, { waktu: Date.now(), janji });
  return janji;
}

/** Lencana ke kepala kelompok Kasir (UI Baru: ikut ke tabnya) atau ke bagian Kasir (Baru tanpa matriks). */
function r11TerapkanLencanaKasir(panel, wadahan, r) {
  if (!wadahan) return;
  if (wadahan.ringkas) {
    wadahan.ringkas.textContent = r ? r.teks : "";
    wadahan.ringkas.className = `aleta-kelompok-ringkas${r ? ` aleta-lencana-${r.nada}` : ""}`;
    wadahan.setAttribute("data-r11-lencana", r ? r.teks : "");
    if (typeof t7Keadaan !== "undefined" && t7Keadaan && t7Keadaan.panel === panel && typeof t7LencanaTab === "function") t7LencanaTab(t7Keadaan);
  } else if (r && typeof setLencana === "function") {
    setLencana(wadahan, r);
  }
}

function r11SegarkanLencanaKasir(panel, wadahan, o, segar) {
  return Promise.resolve()
    .then(() => r11RingkasKasir(o, segar))
    .then((r) => {
      if (panel.isConnected) r11TerapkanLencanaKasir(panel, wadahan, r);
      return r;
    })
    .catch(() => null);
}

function r11PasangLencanaKasir(panel, wadahan, o) {
  if (!r11Keadaan.pendengarBerubah) {
    r11Keadaan.pendengarBerubah = true;
    document.addEventListener("aleta-kasir-berubah", () => {
      const p = document.getElementById(PENANDA);
      if (p && typeof p.r11SegarkanLencanaKasir === "function") p.r11SegarkanLencanaKasir(true);
    });
  }
  panel.r11SegarkanLencanaKasir = (segar) => r11SegarkanLencanaKasir(panel, wadahan, o, segar);
  // Sesudah panel menempel ke halaman; panel yang digambar ulang sebelum
  // jedanya habis tidak bertanya apa pun (singgahan dipakai panel penggantinya).
  setTimeout(() => {
    if (panel.isConnected) void r11SegarkanLencanaKasir(panel, wadahan, o, false);
  }, R11_JEDA_LENCANA_MS);
}

/** Butir 11: baris "buat anonimisasi otomatis" di bagian unggah edoc (Baru & UI Baru). */
function a30BarisAnonimOtomatis() {
  const baris = buatElemen("label", "aleta-a30-pilihan aleta-a30-anon-otomatis");
  baris.setAttribute("data-a30-fitur", "anonim-otomatis");
  baris.style.display = "none";
  const cek = document.createElement("input");
  cek.type = "checkbox";
  cek.checked = true;
  cek.className = "aleta-abt-centang";
  const teks = buatElemen("span", "aleta-a30-pilihan-teks", "");
  baris.append(cek, teks);
  let aktif = false;
  return {
    baris,
    centang: cek,
    setel(putusan, anonimisasi) {
      aktif = Boolean(putusan) && !anonimisasi;
      baris.style.display = aktif ? "" : "none";
      if (aktif) {
        teks.textContent =
          `Buat edoc anonimisasi otomatis dari edoc putusan (bentuk .${a30Bentuk(putusan.name) || "sama"}, lewat anonimisasi ABT) ` +
          "lalu unggah keduanya sekaligus. Perlu sesi ABT di peramban ini; lepas centang untuk mengunggah putusan saja.";
      }
    },
    dipakai: () => aktif && cek.checked,
  };
}

/** Butir 19: baris "unggah juga edoc putusan + anonimisasi" di Putusan otomatis (Baru & UI Baru). */
function a30BarisSekaligus() {
  const baris = buatElemen("label", "aleta-a30-pilihan aleta-a30-sekaligus");
  baris.setAttribute("data-a30-fitur", "sekaligus");
  baris.style.display = "none";
  const cek = document.createElement("input");
  cek.type = "checkbox";
  cek.checked = true;
  cek.className = "aleta-abt-centang";
  const teks = buatElemen("span", "aleta-a30-pilihan-teks", "");
  baris.append(cek, teks);
  let naskah = null;
  return {
    baris,
    centang: cek,
    setelNaskah(n) {
      naskah = n && n.asli && ["rtf", "docx", "doc", "pdf"].includes(a30Bentuk(n.asli.name)) ? n : null;
      baris.style.display = naskah ? "" : "none";
      if (naskah) {
        teks.textContent =
          `Sekali jalan: sesudah putusan TERBUKTI tersimpan, ${naskah.asli.name} diunggah sebagai edoc putusan beserta ` +
          `edoc anonimisasinya (dibuat otomatis, bentuk .${a30Bentuk(naskah.asli.name)}). Anonimisasi disiapkan dan diperiksa sebelum Simpan.`;
      }
    },
    dipakai: () => Boolean(naskah) && cek.checked,
    /** Ada naskah yang dapat diunggah sebagai edoc (baris ini tampak) - lawannya: putusan dicetak dari ABT (B2). */
    ada: () => Boolean(naskah),
  };
}

/*
 * ============================================================================
 * PERBAIKAN 30 SEPTEMBER 2026 SORE - MENU PER PERAN DI PANEL SIPP (agen S)
 * ============================================================================
 *
 * Pengguna menetapkan susunan menu per peran (DAFTAR "30 Sep sore" butir 1).
 * Matriksnya SATU, di panel-alat.js (alatMenuPeran / alatGolonganPeran);
 * berkas ini hanya menerapkannya pada panel SIPP:
 *
 *   di dalam perkara  kelompok Baru / tab UI Baru diurutkan kiri ke kanan
 *                     menurut matriks, dan yang tidak ada di menu peran itu
 *                     DISEMBUNYIKAN (atribut data-mps-sembunyi) - tidak
 *                     dibuang: Admin dan Super Admin tetap melihat semuanya,
 *                     dan kodenya tetap berjalan seperti biasa. Menu pertama
 *                     menjadi bawaan yang terbuka.
 *   daftar perkara    menu massal (penetapan, BAS, relaas & PBT, putusan)
 *   / dashboard       mengikuti matriks halaman "daftar". Gerbang izin lama
 *                     (boleh(...)) tetap berlaku DI ATAS matriks: matriks hanya
 *                     mengurangi yang tampak, tidak menambah kewenangan.
 *
 * "Ditangani" (KONTRAK K2) dibaca dari keadaan perkara yang SUDAH diambil
 * panel (status-perkara: majelis, panitera, juru sita pemeriksa + ikrar) dan
 * dari jawaban sipp-konteks (hakim.bolehVerifikasi). Tidak pasti = undefined =
 * tidak mengurangi. penunjukanLengkap dibaca dari tahapan (PMH/PPP/PJS/PHS
 * bertanggal di perkara_penetapan) - bacaan yang sama.
 *
 * Peran "lain" (operator, analis, staf, ...) : alatMenuPeran memulangkan null
 * dan panelnya persis susunan sebelum perbaikan ini.
 *
 * Tampilan Lama tidak pernah sampai ke sini (a30Tata dan cabang daftar
 * dijaga a30Aktif) - DOM, permintaan, dan jembatannya tetap identik.
 * Tidak ada jalur tulis baru; satu-satunya permintaan tambahan adalah GET
 * status-perkara yang memang sudah diambil panel untuk lencananya - hanya
 * dimajukan, dan disimpan bersama (ambilStatusPerkara).
 */
const MPS_KELOMPOK = {
  penetapan: "kerjakan",
  // Perbaikan 5 Okt (butir 11): tab PTSP.
  ptsp: "ptspKel",
  putusan: "putusanKel",
  jurusita: "juruSitaKel",
  berkas: "berkas",
  perkara: "perkara",
  // 1.189.x: Kasir tidak ada di matriks golongan (golongan "panitera" memuat
  // PP); mpsSiapkan menambahkannya bila alatBolehKasir.
  kasir: "kasirKel",
};
/** Golongan yang menu perkaranya dapat berubah karena "ditangani" / penunjukan lengkap. */
const MPS_GOLONGAN_BERSTATUS = ["ketua", "hakim", "jurusita"];

/**
 * Apakah pengguna ini majelis/PP/JS perkara ini? true | false | undefined.
 * undefined bila tidak dapat dipastikan: nama tidak terbaca, petugas perkara
 * tidak terbaca, atau belum ada satu pun petugas tercatat.
 */
function mpsDitangani(status, konteks) {
  if (konteks && konteks.hakim && konteks.hakim.bolehVerifikasi === true) return true;
  const saya = [
    typeof penggunaTerakhir !== "undefined" && penggunaTerakhir ? penggunaTerakhir.nama : "",
    typeof namaPenggunaSipp === "function" ? namaPenggunaSipp() : "",
  ]
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  if (!saya.length || !status || typeof status !== "object") return undefined;
  if (status.sumberMajelis === "tidakTerbaca") return undefined;
  const orang = [];
  const tambah = (daftar) => {
    for (const x of Array.isArray(daftar) ? daftar : []) if (x && x.nama) orang.push(String(x.nama));
  };
  tambah(status.majelis);
  tambah(status.panitera);
  tambah(status.jurusita);
  if (status.ikrar && typeof status.ikrar === "object") {
    tambah(status.ikrar.majelis);
    tambah(status.ikrar.panitera);
    tambah(status.ikrar.jurusita);
  }
  if (!orang.length) return undefined;
  return orang.some((o) => saya.some((s) => mpsNamaCocok(s, o)));
}

/** PMH, PPP, PJS, dan PHS sudah bertanggal? true | false | undefined (tidak terbaca). */
function mpsPenunjukanLengkap(status) {
  const t = status && status.tahapan;
  if (!t || t.terbaca !== true || !Array.isArray(t.tahap)) return undefined;
  let lengkap = true;
  for (const kunci of ["pmh", "ppp", "pjs", "phs"]) {
    const x = t.tahap.find((y) => y && y.kunci === kunci);
    if (!x || x.terbaca === false) return undefined;
    if (!x.tanggal) lengkap = false;
  }
  return lengkap;
}

// ─── Menu ────────────────────────────────────────────────────────────────────

/**
 * Menu SIPP di dalam perkara untuk peran yang sedang masuk, atau null (Lama,
 * peran "lain", matriks tidak termuat). Ketua/Wakil dianggap menangani SEMUA
 * perkara untuk Penetapan (KONTRAK K2): yang bukan majelisnya tetap melihat
 * Penetapan selama penunjukannya belum lengkap.
 */
function mpsMenuPerkara(o) {
  if (!mpsSiapMatriks()) return null;
  const peran = mpsPeran();
  const opsi = o || {};
  let menu;
  try {
    menu = alatMenuPeran("sipp", "perkara", r11PenggunaMenu(), { ditangani: opsi.ditangani, penunjukanLengkap: opsi.penunjukanLengkap });
  } catch {
    return null;
  }
  if (!Array.isArray(menu)) return null;
  menu = menu.slice();
  if (opsi.ditangani === false && alatGolonganPeran(peran) === "ketua" && !menu.includes("penetapan")) {
    let penuh = null;
    try {
      penuh = alatMenuPeran("sipp", "perkara", peran, { penunjukanLengkap: opsi.penunjukanLengkap });
    } catch {
      penuh = null;
    }
    if (Array.isArray(penuh) && penuh.includes("penetapan")) menu.unshift("penetapan");
  }
  return menu;
}

// ─── Panel perkara ───────────────────────────────────────────────────────────

/** Menyiapkan keadaan menu panel (sebelum Juru Sita dipasang). panel.mps = null bila tidak berlaku. */
function mpsSiapkan(panel, konteks) {
  panel.mps = null;
  const ditanganiAwal = konteks && konteks.hakim && konteks.hakim.bolehVerifikasi === true ? true : undefined;
  const menuMatriks = mpsMenuPerkara({ ditangani: ditanganiAwal });
  if (!menuMatriks) return null;
  const golongan = typeof alatGolonganMenu === "function" ? alatGolonganMenu(r11PenggunaMenu()) : alatGolonganPeran(mpsPeran());
  // R 11 Okt: Kasir ditambahkan bila boleh, PTSP + Penetapan bila berwenang,
  // dan halaman jurnal per perkara = Kasir saja (r11SesuaikanMenu).
  const menu = r11SesuaikanMenu(menuMatriks, panel);
  panel.mps = {
    golongan,
    ditangani: ditanganiAwal,
    penunjukanLengkap: undefined,
    menu,
    nomor: String((konteks && konteks.nomorPerkara) || ""),
  };
  panel.setAttribute("data-mps-peran", golongan);
  return panel.mps;
}

function mpsSetelSembunyi(el, sembunyi) {
  if (!el) return;
  if (sembunyi) {
    if (!el.hasAttribute("data-mps-sembunyi")) el.setAttribute("data-mps-sembunyi", "");
  } else if (el.hasAttribute("data-mps-sembunyi")) {
    el.removeAttribute("data-mps-sembunyi");
  }
}

/** Mengurutkan anak-anak `wadah` yang terpilih menurut `urut` (kunci), tanpa menyentuh yang lain. */
function mpsUrutkan(wadah, anak, kunciDari, urut) {
  if (!anak.length) return;
  const pos = (el) => {
    const i = urut.indexOf(kunciDari(el));
    return i === -1 ? urut.length : i;
  };
  const baru = anak.slice().sort((a, b) => pos(a) - pos(b));
  if (baru.every((el, i) => el === anak[i])) return;
  const penanda = document.createTextNode("");
  wadah.insertBefore(penanda, anak[0]);
  for (const el of baru) wadah.insertBefore(el, penanda);
  penanda.remove();
}

/** Tab bawaan: Putusan bila blangko Putusan Akhir terbuka dan tabnya tampak, selain itu menu pertama. */
function mpsTabBawaan(panel, urut) {
  const ada = (kunci) => Boolean(panel.querySelector(`.aleta-t7-tab[data-t7-ke="${kunci}"]:not([data-mps-sembunyi])`));
  if (document.querySelector("#frm_putusan") && urut.includes("putusanKel") && ada("putusanKel")) return "putusanKel";
  return urut.find((k) => ada(k)) || "";
}

/**
 * Menerapkan panel.mps ke panel: sembunyi/tampak, urutan kelompok, tab UI
 * Baru, chip daftar isi (sipp-2), dan kelompok pertama terbuka (Baru).
 * Boleh dipanggil berulang (menu menyusut sesudah status perkara tiba).
 */
function mpsTerapkan(panel) {
  const s = panel && panel.mps;
  if (!s) return;
  const isi = panel.querySelector(":scope > .aleta-isi");
  if (!isi) return;
  const urut = s.menu.map((k) => MPS_KELOMPOK[k]).filter(Boolean);
  const tampak = new Set(urut);
  panel.setAttribute("data-mps-menu", s.menu.join(" "));
  // Antrean putusan massal di puncak panel ikut menu Putusan.
  if (s.menu.includes("putusan")) panel.removeAttribute("data-mps-tanpa-putusan");
  else panel.setAttribute("data-mps-tanpa-putusan", "");

  const kelompokSemua = Array.from(isi.querySelectorAll(":scope > .aleta-kelompok"));
  for (const kel of kelompokSemua) mpsSetelSembunyi(kel, !tampak.has(kel.dataset.kunci));
  mpsUrutkan(isi, kelompokSemua, (el) => el.dataset.kunci, urut);

  const bilah = panel.querySelector(":scope > .aleta-t7-tabbar");
  if (bilah) {
    const tab = Array.from(bilah.querySelectorAll(":scope > .aleta-t7-tab"));
    for (const t of tab) mpsSetelSembunyi(t, !tampak.has(t.getAttribute("data-t7-ke")));
    mpsUrutkan(bilah, tab, (el) => el.getAttribute("data-t7-ke"), urut);
    const pilihan = panel.getAttribute("data-t7-tab") || "";
    if (!pilihan || !tampak.has(pilihan) || !panel.querySelector(`.aleta-t7-tab[data-t7-ke="${pilihan}"]`)) {
      const bawaan = mpsTabBawaan(panel, urut);
      if (bawaan && typeof t7PilihTab === "function") t7PilihTab(panel, bawaan, false);
    }
  }

  const chip = panel.querySelector(".aleta-t7-daftar-isi");
  if (chip) {
    const semuaChip = Array.from(chip.querySelectorAll(":scope > [data-t7-ke]"));
    for (const c of semuaChip) mpsSetelSembunyi(c, !tampak.has(c.getAttribute("data-t7-ke")));
    mpsUrutkan(chip, semuaChip, (el) => el.getAttribute("data-t7-ke"), urut);
  }
  // R 11 Okt: urutan tab berubah -> tab utama (pemilik "Langkah berikutnya") ikut.
  r11SetelTabUtama(panel);

  // Baru (kelompok berlipat): menu pertama terbuka sebagai bawaan - kecuali
  // petugas pernah melipatnya sendiri (lipatan tersimpan menang).
  const uiBaru = typeof t7Modern === "function" && t7Modern();
  if (!uiBaru && !bilah) {
    const pertama = urut.map((k) => isi.querySelector(`:scope > .aleta-kelompok[data-kunci="${k}"]`)).find(Boolean);
    if (pertama) {
      const kunci = pertama.dataset.kunci;
      const tersimpan = typeof lipatanTersimpan !== "undefined" && lipatanTersimpan ? lipatanTersimpan[`kel:${kunci}`] : undefined;
      const kepala = pertama.querySelector(":scope > .aleta-kelompok-judul");
      const isiKel = pertama.querySelector(":scope > .aleta-kelompok-isi");
      if (typeof tersimpan !== "boolean" && kepala && isiKel && isiKel.style.display === "none") {
        terapkanLipatan(kepala, isiKel, false);
      }
    }
  }
}

/**
 * Menu menyusut sesudah keadaan perkara tiba: bukan majelis/PP/JS perkara ini
 * = hanya membaca; penunjukan lengkap = Penetapan Ketua/Wakil hilang. Admin
 * dan Panitera tidak menunggu apa pun (menunya tidak bergantung pada itu).
 */
function mpsSegarkanDariStatus(panel, konteks) {
  const s = panel && panel.mps;
  if (!s || !s.nomor || !MPS_GOLONGAN_BERSTATUS.includes(s.golongan)) return;
  if (typeof ambilStatusPerkara !== "function") return;
  void Promise.resolve()
    .then(() => ambilStatusPerkara(s.nomor))
    .then((status) => {
      if (panel.mps !== s) return;
      const ditangani = s.ditangani === true ? true : mpsDitangani(status, konteks);
      const penunjukanLengkap = mpsPenunjukanLengkap(status);
      const menu = mpsMenuPerkara({ ditangani, penunjukanLengkap });
      if (!menu) return;
      s.ditangani = ditangani;
      s.penunjukanLengkap = penunjukanLengkap;
      // R 11 Okt: Kasir tidak hilang saat menu menyusut; konteks halaman tetap menang.
      s.menu = r11SesuaikanMenu(menu, panel);
      panel.setAttribute("data-mps-ditangani", ditangani === undefined ? "?" : ditangani ? "ya" : "tidak");
      mpsTerapkan(panel);
    })
    .catch(() => {
      /* keadaan perkara tidak terbaca: menu tetap penuh untuk perannya (tidak mengurangi) */
    });
}

/*
 * ============================================================================
 * PERBAIKAN 1 OKTOBER 2026 - PANEL SIPP, UI BARU SAJA (agen S)
 * ============================================================================
 *
 * Pesan pengguna sesudah memakai 1.176.0 (DAFTAR "1 Okt", gerbang K1: "perbaiki
 * fitur yang sekarang di UI BARU saja"). Seluruh blok ini hanya berjalan bila
 * s1Aktif() - tampilan UI Baru (t7Modern). Lama dan Baru tidak memanggilnya;
 * titik sambungnya di jalur lama selalu bertanya typeof dulu.
 *
 *   butir 1   lipat seragam: tiap bagian, kartu, dan kelompok panel SIPP serta
 *             panel daftar perkara diberi bentuk lipat yang sama
 *             (alatJadikanLipat / alatLipat milik W). Ringkasan "DAFTAR
 *             PERKARA" yang dulu tidak dapat dilipat kini dapat dilipat.
 *   butir 2   "Ambil usulan dari ALETA" disembunyikan. Fungsinya tidak hilang:
 *             memilih naskah sudah menyambung ke pembacaan usulan, dan draf
 *             ALETA yang sudah ada dimuat SENDIRI sekali ketika blangko
 *             Putusan Akhir terbuka (s1PasangPutusanOtomatis). Tombolnya tetap
 *             di DOM (tersembunyi) sebagai pemicu alur yang sama.
 *   butir 3   Putusan otomatis tanpa membuka blangko lebih dulu: naskah
 *             dipilih, "Jalankan" -> ALETA membuka tab Putusan Akhir dan
 *             menekan "Edit Putusan Akhir" SIPP (membuka tingkap, bukan
 *             menulis), panel digambar ulang, dan pekerjaannya dilanjutkan.
 *   butir 4   satu alur: isi -> Simpan terbukti -> edoc putusan + edoc
 *             anonimisasi. Anonimisasi yang dipilih petugas dipakai apa
 *             adanya; tanpa pilihan ALETA membuatnya (jalur a30 yang ada).
 *   butir 5   Langkah berikutnya: sidang yang PUTUS (atau ditunda untuk
 *             putusan) sementara putusan belum diinput -> "Buat putusan".
 *             Selama keadaan perkara dibaca kartunya berkata "memeriksa",
 *             dan gagal baca disebut - bukan "tidak ada yang mendesak".
 *   butir 6   "Perkara berikutnya" (antrean checklist) hanya Super Admin & Admin.
 *   butir 12  pengisian lebih cepat tanpa membuang bukti: praperiksa dan
 *             putaran pertama usulan medan berjalan bersamaan (keduanya hanya
 *             membaca), jeda gambar-ulang SIPP berhenti begitu medan baru
 *             tampak (paling lama tetap 350 ms), bacaan praperiksa serentak,
 *             dan anonimisasi disiapkan bersamaan dengan pengisian.
 *   butir 13  putusan massal SIPP: hanya sidang yang putus / ditunda untuk
 *             putusan atau musyawarah (aletaMassalAlasanPutusan milik M).
 *   butir 14  Admin: per hakim (ketua majelis), centang per kelompok
 *             (aletaMassalGambarKelompok milik M). Hakim/Ketua: miliknya di
 *             atas, perkara majelis lain terlipat - tidak dibuang.
 *   butir 16  bagian di dalam tab menurut peran (S1_BAGIAN_PERAN), dan
 *             lompatan menu ⋯ yang tujuannya ada di tab yang bukan untuk
 *             perannya ikut disembunyikan.
 *   butir 16b "Upload putusan ke e-Court" (K6): akun e-Court yang dipakai
 *             disebut SEBELUM tombol dan di konfirmasi; tulis hanya atas klik
 *             + konfirmasi; rute belum ada = "belum tersedia di server".
 *
 * TIDAK ADA JALUR TULIS SIPP BARU. Membuka blangko = menekan tautan yang
 * membuka tingkap. Simpan tetap simpanPutusanLaluBuka (bukti dari SIPP), edoc
 * tetap rute unggah-sipp. Permintaan baru: GET /aleta-ecourt/sidang?nomor=
 * (sudah dipakai a30), GET/POST /aleta-ecourt/ecourt-putusan/* (rute E, menulis
 * ke e-COURT - bukan SIPP - dan TIDAK masuk ALETA_COBA_BOLEH).
 */
const S1_TUGAS_UMUR_MS = 120000;
/** Batas panel berpindah ke blangko yang baru dibuka (tugas Putusan otomatis diambil). */
const S1_BATAS_PINDAH_BLANGKO_MS = 6000;
const S1_API_ECOURT_AKUN = "/aleta/api/aleta-ecourt/ecourt-putusan/akun";
const S1_API_ECOURT_UNGGAH = "/aleta/api/aleta-ecourt/ecourt-putusan/unggah";
const S1_BATAS_UNGGAH_ECOURT_MS = 120000;
/**
 * Bagian di dalam tab menurut golongan peran (alatGolonganPeran). Yang tidak
 * disebut di sini mengikuti tabnya (matriks alatMenuPeran). Disembunyikan
 * lewat atribut, tidak dibuang - Admin dan Super Admin tetap melihatnya.
 */
const S1_BAGIAN_PERAN = [
  // Butir 6: antrean checklist "Perkara berikutnya" - Super Admin & Admin saja.
  // Perbaikan 2 Okt (butir 15): kartu menurut peran (data-s2-berikutnya) tidak
  // ikut aturan ini - isinya sudah disaring untuk perannya sendiri.
  { pilih: '.aleta-t7-kartu[data-t7-fitur="sipp-21"]:not([data-s2-berikutnya])', untuk: ["admin"] },
  // Komentar hakim atas BAS: yang menulis BAS (panitera) dan yang menilainya
  // (majelis). Juru sita tidak menulis maupun menilai BAS.
  { pilih: '.aleta-t7-kartu[data-t7-fitur="sipp-29"]', untuk: ["admin", "ketua", "hakim", "panitera", "lain"] },
];
/** Lompatan di menu ⋯ › Perkara ini, dengan bagian tujuannya. */
const S1_LOMPAT_MENU = [
  ["Riwayat ALETA (Alt+R)", "riwayatAleta"],
  ["Data umum dari gugatan", "dataUmum"],
  ["Batalkan penetapan terakhir…", "penunjukan"],
];

/** Pekerjaan Putusan otomatis yang menunggu blangko terbuka (butir 3). */
let s1Tugas = null;
/** Blangko Putusan Akhir yang usulannya sudah dimuat sendiri (butir 2). */
const s1BorangDimuat = new WeakSet();
/** Jadwal sidang per nomor perkara - satu bacaan per halaman (butir 5). */
const s1JadwalPerkara = new Map();

/** Butir 6: kartu khusus admin di dalam tab (K3). */
function s1BolehKartuAdmin() {
  return s1Golongan() === "admin";
}

function s1SetelSembunyi(el, sembunyi) {
  if (!el) return;
  if (sembunyi) {
    if (!el.hasAttribute("data-s1-sembunyi")) el.setAttribute("data-s1-sembunyi", "");
  } else if (el.hasAttribute("data-s1-sembunyi")) {
    el.removeAttribute("data-s1-sembunyi");
  }
}

// ─── Butir 16: bagian di dalam tab menurut peran ─────────────────────────────

/** Bagian `kunci` berada di kelompok (tab) yang disembunyikan menu peran? */
function s1TujuanTersembunyi(panel, kunci) {
  const el = panel.querySelector(`.aleta-isi [data-kunci="${kunci}"]`);
  if (!el) return false;
  const kel = el.closest(".aleta-kelompok");
  return Boolean(kel && kel.hasAttribute("data-mps-sembunyi"));
}

function s1TerapkanPeran(panel) {
  if (!panel) return;
  const golongan = s1Golongan();
  panel.setAttribute("data-s1-peran", golongan);
  for (const aturan of S1_BAGIAN_PERAN) {
    for (const el of Array.from(panel.querySelectorAll(aturan.pilih))) s1SetelSembunyi(el, !aturan.untuk.includes(golongan));
  }
  const menu = panel.querySelector(".aleta-t7-menu");
  if (!menu) return;
  const item = Array.from(menu.querySelectorAll(".aleta-t7-menu-item"));
  for (const [teks, kunci] of S1_LOMPAT_MENU) {
    const tombol = item.find((b) => String(b.textContent || "").trim() === teks);
    if (tombol) s1SetelSembunyi(tombol, s1TujuanTersembunyi(panel, kunci));
  }
  // Zona berbahaya memuat tombol pembongkar penetapan - ikut tab Penetapan.
  const zona = menu.querySelector(".aleta-t7-menu-zona");
  if (zona) s1SetelSembunyi(zona, s1TujuanTersembunyi(panel, "penunjukan"));
}

/** Titik sambung dari t7Tata (UI Baru). */
function s1Tata(panel) {
  if (!s1Aktif() || !panel) return;
  panel.setAttribute("data-s1", "ui");
  s1TerapkanPeran(panel);
  try {
    // Menu peran menyusut sesudah keadaan perkara tiba (mpsSegarkanDariStatus).
    new MutationObserver(() => {
      if (panel.isConnected) s1TerapkanPeran(panel);
    }).observe(panel, { attributes: true, attributeFilter: ["data-mps-menu", "data-mps-ditangani"] });
  } catch {
    /* tanpa pengamat: keadaan saat panel tersusun yang berlaku */
  }
  s1PasangLipat(panel);
  // Perbaikan 2 Okt (S, butir 7 & 19): tag peran di kepala bagian dan bawaan
  // buka/tutup per tab - bagian utama terbuka, sekunder tertutup.
  if (typeof s2Tata === "function") s2Tata(panel);
}

// ─── Butir 5: Langkah berikutnya ─────────────────────────────────────────────

/** Jadwal sidang satu perkara (GET rute sidang yang sudah dipakai a30). Tidak pernah melempar. */
function s1BacaJadwalPerkara(nomor) {
  const kunci = t7KunciNomor(nomor);
  if (s1JadwalPerkara.has(kunci)) return s1JadwalPerkara.get(kunci);
  const janji = t7AmbilJson(`${S1_API_SIDANG}?nomor=${encodeURIComponent(String(nomor || ""))}`, "Membaca jadwal sidang perkara").then((j) => {
    if (!j.ok) return { ok: false, pesan: j.pesan, jadwal: [] };
    const sipp = j.data && j.data.sipp;
    return { ok: Boolean(sipp), pesan: sipp ? "" : String((j.data && j.data.pesanSipp) || "Jadwal sidang tidak terbaca."), jadwal: (sipp && sipp.jadwalPerkara) || [] };
  });
  s1JadwalPerkara.set(kunci, janji);
  return janji;
}

/**
 * Sidang TERAKHIR yang sudah berlangsung (tanggal <= hari ini) memuat putusan?
 * Murni. Pulang { jenis: "putus"|"tunda-putusan"|"agenda-putusan", sebab,
 * tanggal } atau null.
 */
function s1NilaiSidangPutus(jadwal, hariIniIso) {
  const lewat = (Array.isArray(jadwal) ? jadwal : [])
    .filter((s) => s && /^\d{4}-\d{2}-\d{2}/.test(String(s.tanggalSidang || "")) && String(s.tanggalSidang).slice(0, 10) <= hariIniIso)
    .sort((a, b) => {
      const t = String(a.tanggalSidang).localeCompare(String(b.tanggalSidang));
      return t || (Number(a.urutanSidang) || 0) - (Number(b.urutanSidang) || 0);
    });
  const terakhir = lewat[lewat.length - 1];
  if (!terakhir) return null;
  let nilai;
  try {
    nilai =
      typeof aletaMassalAlasanPutusan === "function"
        ? aletaMassalAlasanPutusan({ ...terakhir, sudahPutus: false })
        : s1AlasanPutusanCadangan(terakhir);
  } catch {
    nilai = null;
  }
  if (!nilai || !nilai.layak) return null;
  return { jenis: nilai.jenis, sebab: String(nilai.sebab || ""), tanggal: String(terakhir.tanggalSidang).slice(0, 10) };
}

function s1HariIniIso() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

/** "Buat putusan": ke tab Putusan, buka Putusan otomatis, dan arahkan ke tombolnya. */
function s1KePutusanOtomatis(k) {
  const panel = k && k.panel;
  if (!panel) return false;
  const bagianIsi = panel.querySelector('.aleta-bagian[data-kunci="isiPutusan"]');
  if (!bagianIsi) return false;
  t7Buka(k, "isiPutusan");
  const sasaran =
    bagianIsi.querySelector("[data-s1-jalankan]") || bagianIsi.querySelector('input[type="file"]') || bagianIsi;
  if (typeof sasaran.scrollIntoView === "function") sasaran.scrollIntoView({ block: "center" });
  if (typeof sasaran.focus === "function") {
    try {
      sasaran.focus();
    } catch {
      /* fokus hanya kenyamanan */
    }
  }
  return true;
}

function s1KartuLangkah(k) {
  const kartu = t7Kartu("Langkah berikutnya", "sipp-1");
  kartu.classList.add("aleta-t7-langkah");
  kartu.setAttribute("data-s1", "langkah");
  const daftar = buatElemen("ol", "aleta-t7-langkah-daftar");
  const kabar = t7Ket("Memeriksa keadaan perkara…", "aleta-t7-lembut aleta-s1-langkah-kabar");
  kartu.append(daftar, kabar);

  const tujuanTampak = (kunci) => !s1TujuanTersembunyi(k.panel, kunci) && Boolean(k.panel.querySelector(`[data-kunci="${kunci}"]`));
  const gambar = (langkah, selesai) => {
    daftar.textContent = "";
    const pilih = langkah.slice(0, 3);
    if (pilih.length === 0) {
      if (selesai) daftar.appendChild(buatElemen("li", "aleta-t7-langkah-beres", "Tidak ada yang mendesak untuk perkara ini."));
      return;
    }
    for (const l of pilih) {
      const li = buatElemen("li", `aleta-t7-langkah-butir aleta-t7-nada-${l.nada}`);
      if (l.aksi) li.setAttribute("data-s1-langkah", l.aksi);
      li.appendChild(buatElemen("span", "aleta-t7-langkah-teks", l.teks));
      if (l.aksi === "buat-putusan") {
        // Hanya bagi yang memang melihat Putusan otomatis (tab Putusan).
        if (tujuanTampak("isiPutusan")) {
          const t = t7Tombol("Buat putusan", "Buka Putusan otomatis untuk perkara ini", "aleta-t7-kecil aleta-s1-buat-putusan");
          t.addEventListener("click", () => s1KePutusanOtomatis(k));
          li.appendChild(t);
        }
      } else if (l.kunci && tujuanTampak(l.kunci)) {
        const buka = t7Tombol("Buka", `Buka ${l.teks}`, "aleta-t7-kecil");
        buka.addEventListener("click", () => t7Buka(k, l.kunci));
        li.appendChild(buka);
      }
      daftar.appendChild(li);
    }
  };

  const dariKonteks = [];
  const konteks = k.konteks || {};
  const selisih = Array.isArray(konteks.selisih) ? konteks.selisih : [];
  if (selisih.length > 0) {
    dariKonteks.push({ teks: `Periksa ${selisih.length} data yang tidak cocok dengan e-Court`, nada: "lewat", kunci: "selisih" });
  }
  const tenggat = (Array.isArray(konteks.dokumen) ? konteks.dokumen : []).filter((d) => d.sisaHari !== null && d.sisaHari !== undefined);
  const mepet = tenggat.sort((a, b) => Number(a.sisaHari) - Number(b.sisaHari))[0];
  if (mepet && Number(mepet.sisaHari) <= Number(konteks.ambangMendesakHari || 3)) {
    const sisa = Number(mepet.sisaHari);
    dariKonteks.push({
      teks: `Unggah ${mepet.judulDokumen || mepet.agenda || "dokumen"} ke e-Court - ${sisa < 0 ? `lewat ${Math.abs(sisa)} hari` : sisa === 0 ? "habis hari ini" : `${sisa} hari lagi`}`,
      nada: sisa < 0 ? "lewat" : "mendesak",
      kunci: "tenggat",
    });
  }
  gambar(dariKonteks, false);

  if (!k.nomor || typeof ambilStatusPerkara !== "function") {
    kabar.textContent = k.nomor ? "" : "Nomor perkara tidak terbaca.";
    gambar(dariKonteks, true);
    return kartu;
  }
  void (async () => {
    let status = null;
    try {
      status = await ambilStatusPerkara(k.nomor);
    } catch (galat) {
      kabar.textContent = sambungSebab("Keadaan perkara tidak terbaca", galat);
      kabar.classList.add("aleta-s1-gagal");
      gambar(dariKonteks, false);
      return;
    }
    const lagi = [...dariKonteks];
    const p = (status && status.putusan) || {};
    const lengkap = (status && status.putusanLengkap) || {};
    const sudahPutus = Boolean(p.sudahPutus || lengkap.tanggalPutusan);
    if (sudahPutus && !p.tanggalMinutasi) lagi.push({ teks: "Minutasi berkas perkara", nada: "mendesak", kunci: "putusan" });
    else if (sudahPutus && !p.tanggalBht) lagi.push({ teks: "Catat tanggal berkekuatan hukum tetap", nada: "netral", kunci: "putusan" });
    const tahapan = status && status.tahapan && status.tahapan.terbaca ? status.tahapan.tahap || [] : null;
    const phs = tahapan ? tahapan.find((x) => x && x.kunci === "phs") : null;
    // Jadwal sidang hanya dibaca bila berguna: putusan belum diinput, peran
    // ini memang membuat putusan (menu Putusan), dan sidang sudah dimulai
    // (PHS bertanggal; tidak terbaca = dibaca saja). Satu bacaan per halaman.
    const menuPeran = k.panel && k.panel.mps && Array.isArray(k.panel.mps.menu) ? k.panel.mps.menu : null;
    const bacaSidang = !sudahPutus && (!menuPeran || menuPeran.includes("putusan")) && (!tahapan || !phs || Boolean(phs.tanggal));
    if (!sudahPutus) {
      kabar.textContent = bacaSidang ? "Membaca hasil sidang…" : "";
      const j = bacaSidang ? await s1BacaJadwalPerkara(k.nomor) : { ok: true, jadwal: [], pesan: "" };
      const putus = j.ok ? s1NilaiSidangPutus(j.jadwal, s1HariIniIso()) : null;
      if (putus && putus.jenis === "putus") {
        lagi.unshift({
          teks: `Buat putusan - sidang ${putus.tanggal} sudah putus (${putus.sebab}), tetapi putusan belum diinput di SIPP`,
          nada: "lewat",
          aksi: "buat-putusan",
        });
      } else if (putus) {
        lagi.unshift({
          teks: `Siapkan putusan - ${putus.sebab} (sidang ${putus.tanggal}); putusan belum diinput di SIPP`,
          nada: "mendesak",
          aksi: "buat-putusan",
        });
      }
      if (!j.ok && j.pesan) kabar.textContent = sambungSebab("Hasil sidang tidak terbaca", j.pesan);
      else kabar.textContent = "";
      const tahap = status && status.tahapan && status.tahapan.terbaca ? status.tahapan.tahap || [] : [];
      const berikut = tahap.find((x) => x.terbaca && !x.tanggal);
      if (berikut) lagi.push({ teks: `Tahap berikutnya: ${berikut.label || berikut.kunci}`, nada: "netral", kunci: "tahapan" });
    } else {
      kabar.textContent = "";
    }
    if (!kabar.textContent) kabar.remove();
    gambar(lagi, true);
  })();
  return kartu;
}

// ─── Butir 2, 3, 4: Putusan otomatis ─────────────────────────────────────────

function s1AmbilTugas(nomor) {
  const t = s1Tugas;
  if (!t) return null;
  if (Date.now() - t.waktu > S1_TUGAS_UMUR_MS) {
    s1Tugas = null;
    return null;
  }
  if (t7KunciNomor(t.nomor) !== t7KunciNomor(nomor)) return null;
  s1Tugas = null;
  return t;
}

/** Antrean putusan massal SIPP sedang menunggu perkara ini? Pengisian otomatisnya yang berlaku. */
async function s1AntreanMenunggu(nomor) {
  if (typeof antreanSippBerjalan !== "undefined" && antreanSippBerjalan) return true;
  try {
    const a = typeof alatMuatAntrean === "function" ? await alatMuatAntrean() : null;
    return Boolean(
      a &&
        a.tahap === "sipp" &&
        (a.butir || []).some((b) => t7KunciNomor(b.nomor) === t7KunciNomor(nomor) && (b.keadaan === "menunggu" || b.keadaan === "jalan"))
    );
  } catch {
    return false;
  }
}

/**
 * Butir 12: anonimisasi edoc disiapkan di latar begitu naskah dibaca (UI
 * Baru). Pulang { naskah, janji } atau null. Tidak mengirim apa pun ke SIPP;
 * dialog pemeriksanya (bila ada temuan) tampil di kotak naskah sendiri -
 * bukan di wadah usulan yang dikosongkan tiap pembacaan ulang.
 */
function s1SiapkanAnonimAwal(p) {
  if (!p || !p.naskahEdoc || !p.naskahEdoc.asli || !p.sekaligus || !p.sekaligus.dipakai() || p.anonimPilihan) return null;
  if (typeof a30SiapkanAnonimisasi !== "function") return null;
  const tempat = p.kotakUnggah || null;
  let kabar = null;
  let tanya = null;
  if (tempat) {
    for (const lama of Array.from(tempat.querySelectorAll(":scope > .aleta-s1-anon-awal"))) lama.remove();
    kabar = buatElemen("div", "aleta-abt-kabar aleta-s1-anon-awal", "Anonimisasi edoc disiapkan di latar (belum ada yang dikirim ke SIPP)…");
    tanya = buatElemen("div", "aleta-s1-anon-awal aleta-s1-anon-tanya");
    tempat.append(kabar, tanya);
  }
  const janji = Promise.resolve()
    .then(() =>
      a30SiapkanAnonimisasi({ berkas: p.naskahEdoc.asli, rtf: p.naskahEdoc.rtf, nomorPerkara: p.nomorPerkara, kabar, wadahTanya: tanya })
    )
    .catch((galat) => ({ ok: false, pesan: sambungSebab("Anonimisasi tidak dibuat", galat) }));
  // kabar & tanya dipulangkan supaya Isikan dapat MEMINDAHKANNYA ke dekat
  // kabar penantiannya (7 Okt 2026): dialog pemeriksa di puncak bagian tidak
  // terlihat dari tombol Isikan, dan penantiannya tampak macet.
  return { naskah: p.naskahEdoc, janji, kabar, tanya };
}

/** Slot berkas kecil: label, pemilih, tanda. */
function s1SlotBerkas(judul, terima, kelas) {
  const baris = buatElemen("div", `aleta-edoc-slot aleta-s1-slot${kelas ? ` ${kelas}` : ""}`);
  baris.appendChild(buatElemen("span", "aleta-edoc-judul", judul));
  const pemilih = document.createElement("input");
  pemilih.type = "file";
  pemilih.accept = terima;
  pemilih.className = "aleta-berkas";
  pemilih.setAttribute("aria-label", judul);
  const tanda = buatElemen("span", "aleta-edoc-tanda aleta-massal-keadaan", "belum dipilih");
  baris.append(pemilih, tanda);
  pemilih.addEventListener("change", () => {
    const f = pemilih.files && pemilih.files[0];
    tanda.textContent = f ? f.name : "belum dipilih";
  });
  return { baris, pemilih, tanda, berkas: () => (pemilih.files && pemilih.files[0]) || null };
}

/**
 * Butir 3: Putusan otomatis SEBELUM blangko dibuka (UI Baru). Kuncinya sama
 * dengan bagian aslinya (isiPutusan) - lipatannya diingat bersama.
 */
function s1BagianPutusanTanpaBlangko(nomorPerkara) {
  const kotak = bagian("Putusan otomatis", "isiPutusan", true);
  kotak.setAttribute("data-s1-fitur", "putusan-tanpa-blangko");
  const isi = kotak.isi;
  isi.appendChild(
    buatElemen(
      "div",
      "aleta-tetap-sebab",
      "Blangko Putusan Akhir SIPP tidak perlu dibuka lebih dulu. Pilih naskah putusan bila ada, lalu Jalankan: ALETA membuka " +
        "blangko Putusan Akhir sendiri, membaca naskah (atau draf ALETA yang sudah ada), menjalankan praperiksa, lalu menampilkan " +
        "isiannya untuk diperiksa. Simpan baru ditekan sesudah Anda menekan Isikan dan SELURUH isian masuk; edoc putusan dan " +
        "anonimisasinya diunggah sesudah Simpan terbukti."
    )
  );
  const naskah = s1SlotBerkas("Naskah putusan", typeof A30_TERIMA_NASKAH === "string" ? A30_TERIMA_NASKAH : ".rtf,.docx,.doc,.pdf", "aleta-s1-slot-naskah");
  const anonim = s1SlotBerkas("Edoc anonimisasi (opsional)", ".rtf,.doc,.docx,.pdf", "aleta-s1-slot-anonim");
  anonim.baris.title = "Kosongkan: ALETA membuat anonimisasinya dari naskah putusan (lewat anonimisasi ABT) lalu memeriksanya.";
  const barisSekaligus = buatElemen("label", "aleta-a30-pilihan aleta-s1-sekaligus");
  const cek = document.createElement("input");
  cek.type = "checkbox";
  cek.checked = true;
  cek.className = "aleta-abt-centang";
  barisSekaligus.append(
    cek,
    buatElemen(
      "span",
      "aleta-a30-pilihan-teks",
      "Sekali jalan: sesudah putusan TERBUKTI tersimpan, naskah ini diunggah sebagai edoc putusan beserta edoc anonimisasinya " +
        "(yang dipilih di atas, atau dibuat ALETA bila kosong)."
    )
  );
  const tombol = buatElemen("button", "aleta-permintaan-tombol aleta-s1-jalankan", "Jalankan putusan otomatis");
  tombol.type = "button";
  tombol.setAttribute("data-s1-jalankan", "");
  const kabar = buatElemen("div", "aleta-abt-kabar");
  isi.append(naskah.baris, anonim.baris, barisSekaligus, tombol, kabar);

  tombol.addEventListener("click", async () => {
    if (tombol.disabled) return;
    tombol.disabled = true;
    kabar.className = "aleta-abt-kabar";
    const berkas = naskah.berkas();
    s1Tugas = { nomor: nomorPerkara, berkas, anonim: anonim.berkas(), sekaligus: cek.checked, waktu: Date.now() };
    kabar.textContent = "Membuka blangko Putusan Akhir SIPP…";
    const hasil = await s1BukaBlangkoPutusan();
    if (!hasil.ok) {
      s1Tugas = null;
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = hasil.pesan;
      tombol.disabled = false;
      return;
    }
    // Panel digambar ulang SEKARANG untuk blangkonya dan pekerjaannya
    // dilanjutkan di sana (s1PasangPutusanOtomatis) - kotak ini ikut
    // terbuang. Sampai 5 Oktober 2026 penggambaran ulang ditunggu dari
    // pengamat DOM; pengamat itu membeku begitu panel memuat nomor perkara
    // lain (lihat cariNomorPerkara), dan alurnya diam di sini tanpa sebab.
    const tugasIni = s1Tugas;
    kabar.textContent = berkas
      ? `Blangko terbuka - ${berkas.name} dibaca di Putusan otomatis…`
      : "Blangko terbuka - draf ALETA dimuat di Putusan otomatis…";
    let digambar = false;
    let galatGambar = "";
    try {
      digambar = await gambarUlangSesudahBlangko(nomorPerkara);
    } catch (galat) {
      galatGambar = String((galat && galat.message) || galat);
    }
    // Penjaga: tugasnya harus diambil panel yang baru dalam batas waktu.
    // Bila tidak, sebabnya disebut dan tombolnya hidup lagi - bukan diam.
    const diambil = await s1Tunggu(() => s1Tugas !== tugasIni || !kotak.isConnected, S1_BATAS_PINDAH_BLANGKO_MS, 50);
    if (diambil || !kotak.isConnected) return;
    if (s1Tugas === tugasIni) s1Tugas = null;
    tombol.disabled = false;
    kabar.className = "aleta-abt-kabar aleta-abt-gagal";
    kabar.textContent =
      "Blangko Putusan Akhir sudah terbuka, tetapi panel ALETA tidak berpindah ke blangko itu dalam " +
      `${Math.round(S1_BATAS_PINDAH_BLANGKO_MS / 1000)} detik, jadi ${berkas ? "naskah belum dibaca" : "draf belum dimuat"} dan ` +
      "tidak ada yang diisikan. Sebab: " +
      (galatGambar
        ? `panel gagal digambar ulang (${galatGambar}).`
        : !document.querySelector("#frm_putusan")
          ? "blangkonya sudah tertutup lagi."
          : !digambar
            ? "data perkara di panel belum terbaca atau milik perkara lain."
            : "bagian Putusan otomatis tidak termuat (mode tampilan atau kewenangan peran).") +
      " Tekan Jalankan sekali lagi - blangko yang sudah terbuka dipakai - atau muat ulang data perkara dari menu ⋯.";
  });
  return kotak;
}

/**
 * Titik sambung di ujung bagianIsiPutusan (blangko terbuka). UI Baru saja.
 * p = { kotak, nomorPerkara, tombol, prosesNaskah, kotakUnggah, sekaligus, setelAnonim }
 */
function s1PasangPutusanOtomatis(p) {
  if (!s1Aktif() || !p || !p.kotak || !p.tombol) return;
  p.kotak.setAttribute("data-s1-putusan", "ui");
  // Butir 2: tombolnya disembunyikan; ia tetap pemicu alur yang sama.
  s1SetelSembunyi(p.tombol, true);
  p.tombol.setAttribute("data-s1-tombol-usulan", "");

  // Butir 4: anonimisasi pilihan petugas (opsional).
  let slotAnonim = null;
  if (p.kotakUnggah && p.sekaligus && typeof p.setelAnonim === "function") {
    slotAnonim = s1SlotBerkas("Edoc anonimisasi (opsional)", ".rtf,.doc,.docx,.pdf", "aleta-s1-slot-anonim");
    slotAnonim.baris.title = "Kosongkan: ALETA membuat anonimisasinya dari naskah putusan lalu memeriksanya.";
    slotAnonim.pemilih.addEventListener("change", () => {
      const dipilih = slotAnonim.berkas();
      p.setelAnonim(dipilih);
      // Anonimisasi buatan ALETA yang disiapkan di latar tidak dipakai lagi.
      for (const k of Array.from(p.kotakUnggah.querySelectorAll(".aleta-s1-anon-awal.aleta-abt-kabar"))) {
        if (dipilih) k.textContent = `Edoc anonimisasi pilihan Anda (${dipilih.name}) yang diunggah; anonimisasi buatan ALETA tidak dipakai.`;
      }
    });
    p.kotakUnggah.insertBefore(slotAnonim.baris, p.sekaligus.baris.nextSibling);
  }

  const bukaBagian = () => {
    const panel = p.kotak.closest(".aleta-panel");
    if (panel && typeof bukaBagianPanel === "function") bukaBagianPanel(panel, "isiPutusan");
  };

  // Butir 3: pekerjaan yang dimulai sebelum blangko terbuka dilanjutkan.
  const tugas = s1AmbilTugas(p.nomorPerkara);
  if (tugas) {
    // Blangko ini sudah dikerjakan tugasnya - gambar ulang berikutnya tidak
    // memuat draf sendiri lagi di atasnya.
    const borangTugas = document.querySelector("#frm_putusan");
    if (borangTugas) s1BorangDimuat.add(borangTugas);
    if (tugas.anonim && slotAnonim) {
      p.setelAnonim(tugas.anonim);
      slotAnonim.tanda.textContent = tugas.anonim.name;
    }
    if (tugas.sekaligus === false && p.sekaligus && p.sekaligus.centang) p.sekaligus.centang.checked = false;
    setTimeout(() => {
      if (!p.kotak.isConnected) {
        // Panel digambar ulang lagi sebelum sempat mulai: serahkan ke gambar berikutnya.
        s1Tugas = { ...tugas, waktu: Date.now() };
        return;
      }
      bukaBagian();
      if (tugas.berkas && typeof p.prosesNaskah === "function") void p.prosesNaskah(tugas.berkas);
      else if (!p.tombol.disabled) p.tombol.click();
    }, 0);
    return;
  }

  // Butir 2: tanpa tombol, draf ALETA dimuat SENDIRI sekali per blangko.
  const borang = document.querySelector("#frm_putusan");
  if (!borang || s1BorangDimuat.has(borang)) return;
  s1BorangDimuat.add(borang);
  setTimeout(async () => {
    if (!p.kotak.isConnected) {
      s1BorangDimuat.delete(borang);
      return;
    }
    // Antrean putusan massal SIPP yang menunggu perkara ini mengisinya sendiri.
    if (await s1AntreanMenunggu(p.nomorPerkara)) return;
    // 21 Okt 2026: tombol "Putusan Otomatis" halaman SIPP sudah menjalankan alurnya atas blangko ini.
    if (!p.kotak.isConnected || p.tombol.disabled || p.kotak.hasAttribute("data-oto-jalan")) return;
    p.tombol.click();
  }, 700);
}
/* === AKHIR IKRAR-OTOMATIS === */

// ─── Butir 16b: Upload putusan ke e-Court (K6) ───────────────────────────────

function s1AlamatIntegrasi(jawab) {
  const dari = jawab && typeof jawab.tautanSambung === "string" ? jawab.tautanSambung : "";
  if (dari && dari.startsWith("/aleta/")) return `${location.origin}${dari}`;
  return `${location.origin}/aleta/admin/aleta-ecourt#sesi-ecourt-saya`;
}

function s1BagianUnggahEcourt(nomorPerkara) {
  const kotak = bagian("Upload putusan ke e-Court", "s1UnggahEcourt", true);
  kotak.setAttribute("data-s1-fitur", "unggah-ecourt");
  const isi = kotak.isi;
  const akunBaris = buatElemen("div", "aleta-s1-ecourt-akun", "Memeriksa akun e-Court yang akan dipakai…");
  const salinanBaris = buatElemen("div", "aleta-s1-ecourt-salinan");
  const slot = s1SlotBerkas("Salinan putusan (PDF)", ".pdf,application/pdf", "aleta-s1-slot-ecourt");
  const tombol = buatElemen("button", "aleta-permintaan-tombol aleta-s1-ecourt-tombol", "Upload ke e-Court");
  tombol.type = "button";
  tombol.disabled = true;
  const kabar = buatElemen("div", "aleta-abt-kabar");
  const wadahTanya = buatElemen("div", "aleta-s1-ecourt-tanya");
  isi.append(
    buatElemen(
      "div",
      "aleta-tetap-sebab aleta-remeh",
      'Setara tombol "Upload Dokumen Salinan Putusan" di e-Court (tab Putusan › Salinan Putusan). Diunggah dengan sesi e-Court akun yang disebut di bawah.'
    ),
    akunBaris,
    salinanBaris,
    slot.baris,
    tombol,
    wadahTanya,
    kabar
  );

  let akun = null;
  let sudahMuat = false;
  const segarkanTombol = () => {
    tombol.disabled = !(akun && akun.tersambung !== false && slot.berkas());
  };
  const gambarSalinan = (s) => {
    salinanBaris.textContent = "";
    if (!s) return;
    if (s.sudahDiunggah) {
      salinanBaris.textContent = `Salinan putusan SUDAH diunggah ke e-Court${s.tanggal ? ` pada ${s.tanggal}` : ""}${s.olehNama ? ` oleh ${s.olehNama}` : ""}. Mengunggah lagi menggantinya.`;
      salinanBaris.className = "aleta-s1-ecourt-salinan aleta-lencana-aman";
    } else {
      salinanBaris.textContent = "Salinan putusan BELUM diunggah ke e-Court.";
      salinanBaris.className = "aleta-s1-ecourt-salinan aleta-lencana-mendesak";
    }
  };
  const gambarBelumTersambung = (jawab, nama) => {
    akunBaris.textContent = "";
    akunBaris.className = "aleta-s1-ecourt-akun aleta-s1-ecourt-putus";
    akunBaris.appendChild(
      buatElemen(
        "span",
        "",
        nama
          ? `Sesi e-Court akun ${nama} sudah habis atau terputus - masuk lagi lewat Integrasi e-Court › sambungkan sesi. `
          : jawab && jawab.pesan
            ? `${jawab.pesan} `
            : `Belum ada sesi e-Court untuk akun ALETA Anda${jawab && jawab.alasan ? ` (${jawab.alasan})` : ""}. Sambungkan dulu lewat Integrasi e-Court › sambungkan sesi. `
      )
    );
    const a = buatElemen("a", "aleta-t7-tautan", "Buka Integrasi e-Court ↗");
    a.href = s1AlamatIntegrasi(jawab);
    a.target = "_blank";
    a.rel = "noopener";
    akunBaris.appendChild(a);
  };

  const muat = async () => {
    sudahMuat = true;
    akunBaris.className = "aleta-s1-ecourt-akun";
    akunBaris.textContent = "Memeriksa akun e-Court yang akan dipakai…";
    // Butir 20: akun SIPP yang terbuka ikut dikirim supaya server dapat
    // menolak bila ALETA di peramban ini masuk sebagai orang lain.
    const sippTerbuka = typeof namaPenggunaSipp === "function" ? namaPenggunaSipp() || "" : "";
    const j = await t7AmbilJson(
      `${S1_API_ECOURT_AKUN}?nomor=${encodeURIComponent(String(nomorPerkara || ""))}&olehUsername=${encodeURIComponent(sippTerbuka)}`,
      "Membaca akun e-Court"
    );
    if (!j.ok) {
      akunBaris.textContent = "";
      if (j.status === 404) {
        akunBaris.appendChild(t7BelumTersedia("Upload putusan ke e-Court belum tersedia di server."));
      } else {
        akunBaris.className = "aleta-s1-ecourt-akun aleta-abt-gagal";
        akunBaris.textContent = j.pesan;
        sudahMuat = false;
      }
      return;
    }
    const d = j.data || {};
    akun = d.akun || null;
    gambarSalinan(d.salinan || null);
    if (!akun || akun.tersambung === false) {
      gambarBelumTersambung(d, akun && akun.nama);
      akun = null;
    } else {
      akunBaris.className = "aleta-s1-ecourt-akun aleta-s1-ecourt-siap";
      akunBaris.textContent = `Akan diunggah atas nama: ${akun.nama || "(nama tidak terbaca)"}${akun.peran ? ` (${akun.peran})` : ""} di e-Court`;
      if (akun.sumber === "bersama") akunBaris.textContent += " - sesi BERSAMA, bukan sesi pribadi Anda";
      akunBaris.textContent += ".";
    }
    segarkanTombol();
  };
  slot.pemilih.addEventListener("change", () => {
    const f = slot.berkas();
    if (f && !/\.pdf$/i.test(String(f.name || ""))) {
      slot.tanda.textContent = `${f.name}: bukan PDF - salinan putusan di e-Court berbentuk PDF`;
      slot.pemilih.value = "";
    }
    segarkanTombol();
  });

  tombol.addEventListener("click", async () => {
    const berkas = slot.berkas();
    if (!akun || !berkas || tombol.disabled) return;
    tombol.disabled = true;
    const nama = `${akun.nama || "(nama tidak terbaca)"}${akun.peran ? ` (${akun.peran})` : ""}`;
    const pertanyaan = {
      judul: "Upload salinan putusan ke e-Court",
      baris: [`${nomorPerkara}: ${berkas.name} akan diunggah ke e-Court ATAS NAMA ${nama}.`, "Ini menulis ke e-Court dan tercatat atas nama akun itu."],
      centang: `Benar, unggah atas nama ${akun.nama || "akun ini"}`,
      ya: "Upload ke e-Court",
      tidak: "Batal",
    };
    const ya =
      typeof a30Tanya === "function"
        ? await a30Tanya(wadahTanya, pertanyaan)
        : window.confirm(`${pertanyaan.baris.join("\n")}\n\nLanjutkan?`);
    if (!ya) {
      kabar.className = "aleta-abt-kabar";
      kabar.textContent = "Dibatalkan - tidak ada yang dikirim ke e-Court.";
      segarkanTombol();
      return;
    }
    kabar.className = "aleta-abt-kabar";
    kabar.textContent = `Mengunggah ke e-Court atas nama ${nama}…`;
    const badan = new FormData();
    badan.append("nomor", String(nomorPerkara || ""));
    badan.append("berkas", berkas, berkas.name);
    badan.append("olehUsername", typeof namaPenggunaSipp === "function" ? namaPenggunaSipp() || "" : "");
    let respons = null;
    let luar = null;
    try {
      respons = await alatAmbil(
        S1_API_ECOURT_UNGGAH,
        { method: "POST", body: badan, credentials: "include", batasMs: S1_BATAS_UNGGAH_ECOURT_MS },
        "Mengunggah putusan ke e-Court"
      );
      try {
        luar = await respons.json();
      } catch {
        luar = null;
      }
    } catch (galat) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = String((galat && galat.message) || galat);
      segarkanTombol();
      return;
    }
    const d = luar && typeof luar === "object" && "data" in luar ? luar.data : luar;
    if (respons.status === 404) {
      kabar.className = "aleta-abt-kabar";
      kabar.textContent = "Upload putusan ke e-Court belum tersedia di server - tidak ada yang dikirim.";
    } else if (respons.status === 423) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent =
        typeof a30PesanDitahan === "function" ? a30PesanDitahan(luar, "Upload ke e-Court") : "Upload ke e-Court ditahan mode uji - tidak ada yang dikirim.";
    } else if (!respons.ok || !d || d.ok === false) {
      const kalimat =
        (d && (d.sebab || d.pesan || d.alasan)) ||
        (luar && luar.error && luar.error.message) ||
        (typeof alatPesanGagal === "function" ? alatPesanGagal(null, respons.status, "Mengunggah putusan ke e-Court") : `Gagal (${respons.status}).`);
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = `Tidak terunggah ke e-Court: ${kalimat}`;
    } else {
      const oleh = d.akun && d.akun.nama ? `${d.akun.nama}${d.akun.peran ? ` (${d.akun.peran})` : ""}` : nama;
      kabar.className = "aleta-abt-kabar";
      kabar.textContent = `Terunggah ke e-Court atas nama ${oleh}.`;
      gambarSalinan(d.salinan || { sudahDiunggah: true });
      slot.pemilih.value = "";
      slot.tanda.textContent = "belum dipilih";
    }
    segarkanTombol();
  });

  // Dimuat saat dibuka, seperti bagian malas lainnya.
  const kepala = kotak.querySelector(".aleta-bagian-judul");
  if (kepala) kepala.addEventListener("click", () => {
    if (!sudahMuat && kotak.isi.style.display !== "none") void muat();
  });
  if (kotak.isi.style.display !== "none") setTimeout(() => void muat(), 0);
  kotak.muat = () => {
    if (!sudahMuat) void muat();
  };
  return kotak;
}
/** "Penetapan Majelis Hakim, Penunjukan Juru Sita" dari kode. */
const s2SebutPenetapan = (daftar) => daftar.map((j) => S2_NAMA_PENETAPAN[j] || j).join(", ");
/**
 * Butir 19: bagian UTAMA tiap tab (kelompok) - yang pertama ADA dari daftarnya
 * yang terbuka; selebihnya tertutup. Tab tanpa satu pun = bagian pertamanya.
 */
const S2_UTAMA_KELOMPOK = {
  kerjakan: ["penunjukan", "dataUmum"],
  ptspKel: ["dataUmum", "saksiKtp", "rapikanPihak"],
  putusanKel: ["isiPutusan", "unggahPutusanSipp"],
  berkas: ["selisih", "tenggat", "dokumen"],
  perkara: ["tahapan", "nomorPihak"],
  juruSitaKel: ["juruSita"],
};
/** Butir 15: kartu "Perkara berikutnya" menurut golongan peran. */
const S2_BERIKUTNYA = {
  hakim: {
    peran: "hakim",
    sebutan: "hakim",
    judul: "Perkara berikutnya · perlu putusan",
    pola: /^(hakim|ketua)\./,
    utama: /konsep-putusan|putusan-belum-unggah|phs-menunggu|penetapan-tunggal/,
    kosong: "Tidak ada perkara lain di checklist Anda yang perlu putusan.",
  },
  ketua: {
    peran: "hakim",
    sebutan: "hakim",
    judul: "Perkara berikutnya · perlu putusan",
    pola: /^(hakim|ketua)\./,
    utama: /konsep-putusan|putusan-belum-unggah|phs-menunggu|penetapan-tunggal|pmh-hari-ini/,
    kosong: "Tidak ada perkara lain di checklist Anda yang perlu putusan.",
  },
  panitera: {
    peran: "panitera-pengganti",
    sebutan: "panitera pengganti",
    judul: "Perkara berikutnya · BAS",
    pola: /^panitera-pengganti\./,
    utama: /bas/,
    kosong: "Tidak ada perkara lain di checklist Anda yang menunggu BAS.",
  },
  jurusita: {
    peran: "jurusita",
    sebutan: "juru sita",
    judul: "Perkara berikutnya · relaas & PBT",
    pola: /^jurusita\./,
    utama: /relaas|pbt|panggilan|retur/,
    kosong: "Tidak ada perkara lain di checklist Anda yang menunggu relaas atau PBT.",
  },
};
/** Butir 15: jenis checklist yang HANYA untuk Super Admin & Admin. */
const S2_KHUSUS_ADMIN = /direktori|^operator\.|penetapan-gagal|versi-peladen|cadangan|sesi-ecourt|wa-pagi/;

function s2KunciUtama(kunciKelompok, bagianSemua) {
  const ada = bagianSemua.map((b) => String(b.dataset.kunci || ""));
  const utama = [];
  const pertama = (S2_UTAMA_KELOMPOK[kunciKelompok] || []).find((k) => ada.includes(k));
  if (pertama) utama.push(pertama);
  // Di layar Data Umum SIPP, pengisi formulirnya yang sedang dicari.
  if (kunciKelompok === "kerjakan" && ada.includes("isiAlasanPerkara") && document.querySelector("#frm_data_umum")) {
    utama.push("isiAlasanPerkara");
  }
  if (!utama.length && ada[0]) utama.push(ada[0]);
  return utama;
}

/** Membuka/menutup satu bagian TANPA mencatatnya sebagai pilihan petugas. */
function s2SetelBagian(kotak, buka) {
  const kepala = kotak.querySelector(":scope > .aleta-bagian-judul");
  const isi = kotak.querySelector(":scope > .aleta-bagian-isi");
  if (!kepala || !isi || typeof terapkanLipatan !== "function") return;
  const terbuka = isi.style.display !== "none";
  if (terbuka === Boolean(buka)) return;
  terapkanLipatan(kepala, isi, !buka);
  if (!buka) return;
  // Bagian malas memuat isinya sendiri saat dibuka - di sini tidak ada klik.
  try {
    if (typeof kotak.gambarUlang === "function") kotak.gambarUlang();
    else if (typeof kotak.muat === "function") kotak.muat();
  } catch {
    /* isinya dimuat ketika kepalanya ditekan */
  }
}

function s2TerapkanBawaan(panel) {
  if (!panel || panel.__s2Bawaan) return;
  panel.__s2Bawaan = true;
  const tersimpan = typeof lipatanTersimpan !== "undefined" && lipatanTersimpan ? lipatanTersimpan : {};
  for (const kel of Array.from(panel.querySelectorAll(".aleta-isi > .aleta-kelompok"))) {
    const isiKel = kel.querySelector(":scope > .aleta-kelompok-isi");
    if (!isiKel) continue;
    const bagianSemua = Array.from(isiKel.querySelectorAll(":scope > .aleta-bagian"));
    if (!bagianSemua.length) continue;
    const utama = s2KunciUtama(String(kel.dataset.kunci || ""), bagianSemua);
    kel.setAttribute("data-s2-utama", utama.join(" "));
    for (const b of bagianSemua) {
      const kunci = String(b.dataset.kunci || "");
      // Pilihan petugas yang tersimpan menang - bawaan hanya untuk yang belum pernah disentuh.
      if (typeof tersimpan[kunci] === "boolean") continue;
      s2SetelBagian(b, utama.includes(kunci));
    }
  }
}

/** Titik sambung dari s1Tata (UI Baru). */
function s2Tata(panel) {
  if (!s2Aktif() || !panel) return;
  panel.setAttribute("data-s2", "ui");
  s2TerapkanBawaan(panel);
  s2PasangPeran(panel);
}

// ─── Butir 15: Perkara berikutnya menurut peran ──────────────────────────────

/** Murni: butir checklist yang relevan bagi golongan ini, kepentingan utama di depan, satu per perkara. */
function s2SaringBerikutnya(butir, golongan, nomorKini) {
  const aturan = S2_BERIKUTNYA[golongan];
  if (!aturan) return [];
  const kini = t7KunciNomor(nomorKini);
  const cocok = (Array.isArray(butir) ? butir : []).filter((b) => {
    const jenis = String((b && b.jenis) || "");
    const nomor = t7KunciNomor(b && b.perkara && b.perkara.nomor);
    return Boolean(nomor) && nomor !== kini && !S2_KHUSUS_ADMIN.test(jenis) && aturan.pola.test(jenis);
  });
  const urut = [...cocok.filter((b) => aturan.utama.test(String(b.jenis))), ...cocok.filter((b) => !aturan.utama.test(String(b.jenis)))];
  const terlihat = new Set();
  return urut.filter((b) => {
    const nomor = t7KunciNomor(b.perkara.nomor);
    if (terlihat.has(nomor)) return false;
    terlihat.add(nomor);
    return true;
  });
}

/** Kartu "Perkara berikutnya" untuk hakim/ketua/PP/juru sita; null untuk golongan lain. */
function s2KartuBerikutnya(k) {
  const golongan = s1Golongan();
  const aturan = S2_BERIKUTNYA[golongan];
  if (!aturan) return null;
  const kartu = t7Kartu(aturan.judul, "sipp-21");
  kartu.setAttribute("data-s2-berikutnya", golongan);
  const isi = buatElemen("div", "aleta-t7-kartu-isi", "Membaca checklist…");
  kartu.appendChild(isi);
  void (async () => {
    const s = await t7Baca([T7_KUNCI_TAUTAN_SIPP, "riwayatPerkaraSipp"]);
    const jawab = await t7AmbilJson(`${T7_API_CHECKLIST}?peran=${encodeURIComponent(aturan.peran)}`, "Checklist milestone");
    isi.textContent = "";
    if (!jawab.ok) {
      isi.appendChild(t7BelumTersedia(jawab.pesan));
      return;
    }
    const semua = jawab.data && Array.isArray(jawab.data.butir) ? jawab.data.butir : [];
    const butir = s2SaringBerikutnya(semua, golongan, k.nomor);
    if (butir.length === 0) {
      isi.appendChild(t7Ket(aturan.kosong));
      return;
    }
    const peta = new Map();
    const tautan = s[T7_KUNCI_TAUTAN_SIPP] && typeof s[T7_KUNCI_TAUTAN_SIPP] === "object" ? s[T7_KUNCI_TAUTAN_SIPP] : {};
    for (const [nomor, x] of Object.entries(tautan)) if (x && x.url) peta.set(t7KunciNomor(nomor), String(x.url));
    for (const r of Array.isArray(s.riwayatPerkaraSipp) ? s.riwayatPerkaraSipp : []) if (r && r.url) peta.set(t7KunciNomor(r.nomor), String(r.url));
    const daftar = buatElemen("ul", "aleta-t7-daftar");
    for (const b of butir.slice(0, 3)) {
      const nomor = String(b.perkara.nomor);
      const li = buatElemen("li", `aleta-t7-baris${b.kelompok === "lewat" ? " aleta-t7-nada-lewat" : ""}`);
      li.setAttribute("data-s2-jenis", String(b.jenis || ""));
      const teks = buatElemen("span", "aleta-t7-baris-teks");
      teks.appendChild(buatElemen("span", "aleta-t7-nomor", nomor));
      teks.appendChild(buatElemen("span", "aleta-t7-lembut", String(b.judul || "")));
      li.appendChild(teks);
      const href = peta.get(t7KunciNomor(nomor)) || "";
      // Hanya alamat SIPP halaman ini - alamat dari penyimpanan tidak dipercaya buta.
      if (href && href.startsWith(`${location.origin}/`)) {
        const a = buatElemen("a", "aleta-t7-tautan", "Buka");
        a.href = href;
        a.title = `Buka perkara ${nomor} di SIPP`;
        li.appendChild(a);
      } else {
        const salin = t7Tombol("Salin nomor", `Alamat SIPP perkara ${nomor} belum diketahui peramban ini - salin nomornya untuk dicari`, "aleta-t7-kecil");
        salin.addEventListener("click", () => void salinTeks(nomor));
        li.appendChild(salin);
      }
      daftar.appendChild(li);
    }
    isi.appendChild(daftar);
    isi.appendChild(t7Ket(`Dari checklist milestone peran ${aturan.sebutan}; ${butir.length} perkara menunggu.`, "aleta-t7-lembut"));
  })();
  return kartu;
}

/** Hasil unggah per jenis dari jawaban rute E. Murni. */
function s2BacaHasilEdoc(d) {
  const mentah = (d && (d.berkas || d.hasil || d.jenis)) || [];
  return (Array.isArray(mentah) ? mentah : [])
    .filter((x) => x && typeof x === "object")
    .map((x) => ({ jenis: s2JenisPenetapan(x.jenis || x.kode) || String(x.jenis || ""), ok: x.ok === true, sebab: String(x.sebab || x.alasan || x.pesan || "") }));
}

function s2RingkasHasil(hasil, cadangan) {
  const per = s2BacaHasilEdoc(hasil.d);
  if (!per.length) return cadangan;
  return per.map((x) => `${S2_NAMA_PENETAPAN[x.jenis] || x.jenis}: ${x.ok ? "terunggah" : `gagal${x.sebab ? ` (${x.sebab})` : ""}`}`).join(" · ");
}

/**
 * Butir 8 (19 Okt 2026): bagian "Edoc penetapan (PMH/PPP/PJS/PHS) manual" -
 * pindahan lipatan "Upload manual edoc penetapan" dari bagian "Upload edoc
 * penetapan" yang dihapus. Unggah OTOMATIS dari ABT pindah ke tombol "e-Doc"
 * di tiap baris kartu Penetapan (t7KartuKeputusan -> e6UnggahEdocPenetapan).
 *
 * Butir 10: passphrase TTE tidak ada lagi di panel dan TIDAK dikirim; tanda
 * tangan memakai gambar tanda tangan pejabat yang disahkan (halaman Tanda
 * tangan pejabat portal). Rute unggah tetap menerima passphrase dari jalan
 * lain - panel saja yang tidak mengirimnya.
 */
function s2BagianEdocPenetapanManual(nomorPerkara) {
  const nomor = String(nomorPerkara || "");
  const kotak = bagian("Edoc penetapan (PMH/PPP/PJS/PHS) manual", "s2EdocPenetapanManual", true);
  kotak.setAttribute("data-s2-fitur", "edoc-penetapan-manual-bagian");
  const isi = kotak.isi;
  isi.appendChild(
    buatElemen(
      "div",
      "aleta-tetap-sebab aleta-remeh",
      "Berkas penetapan yang sudah ada di komputer (PDF/DOC/DOCX/RTF), satu per penetapan. Tanda tangan dan cap dibubuhkan sebelum diunggah ke e-Doc SIPP."
    )
  );
  const slot = {};
  for (const j of S2_JENIS_PENETAPAN) {
    slot[j] = s1SlotBerkas(`${S2_NAMA_PENETAPAN[j]} (${j})`, ".pdf,.doc,.docx,.rtf,application/pdf", `aleta-s2-slot-${j.toLowerCase()}`);
    slot[j].baris.setAttribute("data-s2-slot", j);
    isi.appendChild(slot[j].baris);
  }
  const ttd = buatElemen("div", "aleta-t7-ttd-ket", "Tanda tangan memakai gambar tanda tangan pejabat yang disahkan — atur di ");
  const ttdTautan = buatElemen("a", "aleta-t7-tautan", "Tanda tangan pejabat");
  ttdTautan.href = `${location.origin}/aleta/admin/aleta-ecourt#ttd`;
  ttdTautan.target = "_blank";
  ttdTautan.rel = "noopener";
  ttd.appendChild(ttdTautan);
  const tombol = buatElemen("button", "aleta-permintaan-tombol aleta-s2-edoc-tombol", "Upload manual");
  tombol.type = "button";
  tombol.disabled = true;
  tombol.setAttribute("data-s2-edoc", "manual");
  const wadahTanya = buatElemen("div", "aleta-s2-edoc-tanya");
  const kabar = buatElemen("div", "aleta-abt-kabar");
  isi.append(ttd, tombol, wadahTanya, kabar);

  const berkasManual = () => S2_JENIS_PENETAPAN.filter((j) => slot[j].berkas());
  const segarkan = () => {
    tombol.disabled = !berkasManual().length;
  };
  for (const j of S2_JENIS_PENETAPAN) slot[j].pemilih.addEventListener("change", segarkan);

  tombol.addEventListener("click", async () => {
    const jenis = berkasManual();
    if (tombol.disabled || !jenis.length) return;
    tombol.disabled = true;
    // Yang sudah terupload disebut, dan pertanyaannya "yakin menimpa yang lama?".
    const sudah = (await b7BacaSudahTerunggah(nomor, jenis)) || [];
    const baris = [
      `${nomor}: ${s2SebutPenetapan(jenis)} dari berkas yang dipilih, ditandatangani dengan gambar tanda tangan pejabat yang disahkan, diberi cap di atas tanda tangan, lalu diunggah ke e-Doc SIPP.`,
      "Ini menulis ke SIPP atas nama akun Anda.",
    ];
    if (sudah.length) baris.unshift(`${b7KalimatSudah(sudah)}. Mengunggah lagi akan MENIMPA e-Doc yang lama - yakin menimpa yang lama?`);
    const o = {
      judul: sudah.length ? "e-Doc penetapan sudah terupload - timpa?" : "Upload edoc penetapan ke SIPP",
      baris,
      centang: "Sudah saya periksa",
      ya: sudah.length ? "Ya, timpa yang lama" : "Upload",
      tidak: "Batal",
    };
    const ya = typeof a30Tanya === "function" ? await a30Tanya(wadahTanya, o) : window.confirm(`${baris.join("\n")}\n\nLanjutkan?`) === true;
    kabar.className = "aleta-abt-kabar";
    if (!ya) {
      kabar.textContent = "Dibatalkan - tidak ada yang dikirim.";
      segarkan();
      return;
    }
    const ditahan = s2ModeMenahan(S2_API_EDOC_UNGGAH);
    if (ditahan) {
      kabar.textContent = `Upload manual edoc penetapan ditahan ${ditahan} - tidak ada yang dikirim.`;
      segarkan();
      return;
    }
    kabar.textContent = `Mengunggah ${s2SebutPenetapan(jenis)}…`;
    await s2JedaTulis("unggah", S2_API_EDOC_UNGGAH);
    const badan = new FormData();
    badan.append("nomorPerkara", nomor);
    badan.append("sumber", "manual");
    badan.append("konfirmasi", "true");
    // olehUsername: akun SIPP yang login - pelaku yang dicatat bot di SIPP (butir 14).
    badan.append("olehUsername", namaPenggunaSipp() || "");
    for (const j of jenis) {
      const f = slot[j].berkas();
      if (!f) continue;
      badan.append("jenis", j);
      badan.append(`berkas_${j}`, f, f.name);
    }
    await catatAlamatSebelumTulis(nomor);
    const hasil = await s2KirimEdoc(badan, "Upload manual edoc penetapan");
    if (hasil.ok) {
      kabar.textContent = s2RingkasHasil(hasil, `${s2SebutPenetapan(jenis)} terunggah ke e-Doc SIPP.`);
      muatUlangSesudahTulis({
        nomor,
        judulOk: "e-Doc penetapan terunggah ke SIPP.",
        baris: (s2BacaHasilEdoc(hasil.d).length ? s2BacaHasilEdoc(hasil.d) : [{ jenis: "e-Doc", ok: true }]).map((x) => ({ jenis: x.jenis || "e-Doc", teks: x.ok ? "e-Doc terunggah" : `gagal${x.sebab ? ` (${x.sebab})` : ""}`, ok: x.ok })),
      });
    } else {
      kabar.className = hasil.status === 404 ? "aleta-abt-kabar" : "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = hasil.pesan;
    }
    segarkan();
  });
  return kotak;
}

/*
 * ============================================================================
 * PERBAIKAN 5 OKTOBER 2026 - TAB PTSP DI PANEL SIPP (butir 11, 12, 26)
 * ============================================================================
 *
 * UI Baru saja (s1Aktif). Tab "PTSP" (kelompok ptspKel) berisi:
 *
 *   dataUmum          Data Umum dari berkas gugatan - PINDAHAN dari tab
 *                     Penetapan (di sana tinggal tautan "Buka tab PTSP").
 *   isiAlasanPerkara  Isi formulir Data Umum dari posita (layar Data Umum) -
 *                     pindahan dari Penetapan juga.
 *   saksiKtp          Data saksi / pihak - isi dari foto KTP: membuka kartu
 *                     saksiscan.js di KIRI (zona seret-lepas besar). Golongan
 *                     peran lain (PTSP/operator) dan admin - gerbang saksiscan.
 *   rapikanPihak      Rapikan identitas para pihak (butir 26): alamat tabel
 *                     pihak SIPP vs usulan rapi (rapikanAlamat portal), dan
 *                     pengisian lewat blangko EDIT pihak SIPP sendiri.
 *
 * Tidak ada jalur tulis baru ke SIPP: ALETA membuka blangko dan mengisi
 * medannya; Simpan selalu ditekan petugas. Tidak ada tanda ALETA di SIPP.
 */
const P5_API_RAPIKAN = "/aleta/api/aleta-ecourt/rapikan-alamat";

/** Di tab Penetapan: Data Umum sudah pindah - satu tautan, bukan bagian. */
function p5TautanPtsp() {
  const kotak = buatElemen("div", "aleta-baris aleta-p5-tautan-ptsp");
  kotak.appendChild(
    buatElemen("div", "aleta-baris-ket", "Data Umum dari berkas gugatan kini di tab PTSP (bersama isi data saksi dari foto KTP).")
  );
  const tombol = buatElemen("button", "aleta-tombol aleta-tombol-kecil", "Buka tab PTSP");
  tombol.type = "button";
  tombol.addEventListener("click", () => {
    const panel = tombol.closest(`#${PENANDA}`) || document.getElementById(PENANDA);
    if (panel && typeof t7PilihTab === "function") t7PilihTab(panel, "ptspKel", true);
  });
  kotak.appendChild(tombol);
  return kotak;
}

/** Apakah peran ini boleh memakai isi dari foto KTP (gerbang saksiscan.js). */
function p5BolehKtp() {
  const peran = typeof penggunaTerakhir !== "undefined" && penggunaTerakhir && penggunaTerakhir.peran ? String(penggunaTerakhir.peran) : "";
  try {
    return typeof saksiscanPeranBoleh === "function" && typeof saksiscanBuka === "function" && saksiscanPeranBoleh(peran);
  } catch {
    return false;
  }
}

function p5KelompokPtsp(konteks) {
  const bolehUmum = boleh("data-umum");
  const bolehKtp = p5BolehKtp();
  if (!bolehUmum && !bolehKtp) return null;
  const kel = kelompok("PTSP", "ptspKel", false);
  if (bolehUmum) kel.isi.appendChild(bagianDataUmum(konteks));
  if (bolehUmum && document.querySelector("#frm_data_umum")) kel.isi.appendChild(bagianIsiAlasanPerkara(konteks.nomorPerkara));
  if (bolehKtp) kel.isi.appendChild(p5BagianSaksiKtp());
  if (bolehUmum || bolehKtp) kel.isi.appendChild(p5BagianRapikanPihak());
  // Perbaikan 6 Okt (butir 17): edoc penetapan dari blangko ABT - menulis ke
  // SIPP, jadi kewenangannya sama dengan menuliskan penetapan.
  if (boleh("penunjukan") && typeof e6BagianEdocPenetapan === "function") kel.isi.appendChild(e6BagianEdocPenetapan(konteks));
  return kel;
}

/**
 * Butir 10 & 12: kartu KTP dibuka dari sini kapan saja - tanpa harus membuka
 * blangko saksi lebih dulu. Menekan kepala bagian juga membuka kartunya.
 */
function p5BagianSaksiKtp() {
  const kotak = bagian("Data saksi / pihak - isi dari foto KTP", "saksiKtp", true);
  kotak.isi.appendChild(
    buatElemen(
      "div",
      "aleta-baris-ket",
      "Baca foto atau PDF KTP kapan saja - hasilnya tinggal di kartu kiri sampai ditutup. Tombol isi di kartu membuka blangko SIPP yang tepat (Tambah pihak, atau Cari → Tambah pada blangko saksi) lalu mengisinya; Simpan tetap Anda yang menekan."
    )
  );
  const tombol = buatElemen("button", "aleta-tombol aleta-p5-ktp-buka", "📷 Buka kartu isi dari foto KTP");
  tombol.type = "button";
  tombol.addEventListener("click", () => {
    if (typeof saksiscanBuka === "function") saksiscanBuka();
  });
  kotak.isi.appendChild(tombol);
  kotak.addEventListener("click", (e) => {
    const kepala = e.target && e.target.closest ? e.target.closest(".aleta-bagian-judul, .aleta-lipat-kepala") : null;
    if (kepala && kotak.contains(kepala) && typeof saksiscanBuka === "function") saksiscanBuka();
  });
  return kotak;
}

// ─── Butir 28: para pihak dari berkas gugatan -> blangko pihak SIPP ──────────

const P5_LABEL_PIHAK = [
  ["nama", "Nama"],
  ["nik", "NIK"],
  ["tempatLahir", "Tempat lahir"],
  ["tanggalLahir", "Tanggal lahir"],
  ["umur", "Umur"],
  ["jenisKelamin", "Jenis kelamin"],
  ["agama", "Agama"],
  ["pendidikan", "Pendidikan"],
  ["pekerjaan", "Pekerjaan"],
  ["alamatLengkap", "Alamat"],
  ["surel", "Domisili elektronik"],
  ["telepon", "Telepon"],
];

/** Tautan "Tambah <pihak>" di layar Data Umum SIPP (data_umum.php) - jalan SIPP membuka blangko pihak. */
function p5PenunjukTambahPihak(peran) {
  const kedua = /tergugat|termohon/i.test(String(peran || ""));
  return kedua ? 'a[onclick*="add_pihak_kedua/"][onclick*="/add"]' : 'a[onclick*="add_pihak_pertama/"][onclick*="/add"]';
}

/**
 * Pratinjau per pihak (terbaca vs kosong) dan tombol "Isi pihak ke SIPP".
 * Tombol: bila belum ada blangko pihak/saksi SIPP yang terbuka, tautan
 * "Tambah Penggugat/Tergugat" SIPP ditekan lebih dulu; lalu kartu KTP
 * (saksiscan.js, saksiscanIsiLangsung) memuat datanya dan menjalankan Cari ->
 * Tambah -> isi "Tambah Referensi Data Pihak". Simpan tetap oleh petugas.
 */
function p5GambarPihakGugatan(wadah, hasil) {
  const pihak = hasil && hasil.petikan && Array.isArray(hasil.petikan.pihak) ? hasil.petikan.pihak : [];
  if (!pihak.length) return;
  const kotak = buatElemen("div", "aleta-p5-pihak-gugatan");
  kotak.appendChild(buatElemen("div", "aleta-baris-judul", "Para pihak dari berkas gugatan"));
  kotak.appendChild(
    buatElemen("div", "aleta-baris-ket aleta-remeh", "Periksa yang terbaca dan yang kosong; tombol mengisi blangko Tambah Referensi Data Pihak SIPP - Simpan tetap Anda yang menekan.")
  );
  for (const p of pihak) {
    const m = p.medan || {};
    const k = buatElemen("div", "aleta-baris aleta-p5-pg");
    k.setAttribute("data-p5-peran", String(p.sebutan || p.peran || ""));
    k.appendChild(buatElemen("div", "aleta-baris-judul", `${p.sebutan || p.peran}: ${m.nama || "(nama tidak terbaca)"}`));
    const dl = buatElemen("dl", "aleta-p5-pg-data");
    for (const [kunci, label] of P5_LABEL_PIHAK) {
      if (!m[kunci]) continue;
      dl.appendChild(buatElemen("dt", "", label));
      const nilai = kunci === "jenisKelamin" ? (m[kunci] === "P" ? "Perempuan" : "Laki-laki") : String(m[kunci]);
      dl.appendChild(buatElemen("dd", "", nilai));
    }
    k.appendChild(dl);
    const wil = ["kelurahan", "kecamatan", "kabupaten", "provinsi"].map((x) => m[x]).filter(Boolean);
    if (wil.length) k.appendChild(buatElemen("div", "aleta-baris-ket", `Wilayah: ${wil.join(" › ")}`));
    if (Array.isArray(p.kosong) && p.kosong.length) {
      k.appendChild(buatElemen("div", "aleta-baris-ket aleta-p5-pg-kosong", `Kosong (isi sendiri di blangko): ${p.kosong.join(", ")}`));
    }
    for (const c of p.catatan || []) k.appendChild(buatElemen("div", "aleta-baris-ket aleta-mendesak", String(c)));
    const tombol = buatElemen("button", "aleta-tombol aleta-p5-isi-pihak", "Isi pihak ke SIPP");
    tombol.type = "button";
    const hasilEl = buatElemen("div", "aleta-baris-ket aleta-p5-hasil", "");
    tombol.addEventListener("click", async () => {
      if (typeof saksiscanIsiLangsung !== "function") {
        hasilEl.textContent = "Kartu isi pihak (saksiscan.js) tidak termuat - muat ulang halaman SIPP.";
        return;
      }
      tombol.disabled = true;
      try {
        const adaBlangko = typeof saksiscanKeadaanBlangko === "function" && saksiscanKeadaanBlangko();
        if (!adaBlangko) {
          const penunjuk = p5PenunjukTambahPihak(p.peran);
          if (!document.querySelector(penunjuk)) {
            hasilEl.textContent = "Tautan Tambah pihak SIPP tidak ada di layar ini - buka layar Data Umum perkara, atau buka blangko pihak sendiri lalu tekan lagi.";
            return;
          }
          hasilEl.textContent = "Membuka blangko Tambah pihak SIPP…";
          const buka = await kirimKeJembatanLangsung({ jenis: "tekan", penunjuk });
          if (!buka || buka.ok !== true) {
            hasilEl.textContent = `Tautan Tambah pihak tidak dapat ditekan (${String((buka && buka.alasan) || "tidak menjawab")}).`;
            return;
          }
          const ada = await p5Tunggu(() => typeof saksiscanKeadaanBlangko === "function" && saksiscanKeadaanBlangko(), 10000);
          if (!ada) {
            hasilEl.textContent = "Blangko pihak SIPP tidak terbuka.";
            return;
          }
        }
        hasilEl.textContent = "Dimuat ke kartu kiri - hasil pengisian tampil di sana.";
        await saksiscanIsiLangsung({ medan: m, nik: p.nik || null, catatan: p.catatan || [], sebutan: p.sebutan || p.peran });
      } finally {
        tombol.disabled = false;
      }
    });
    k.appendChild(tombol);
    k.appendChild(hasilEl);
    kotak.appendChild(k);
  }
  wadah.appendChild(kotak);
}

// ─── Butir 26: rapikan identitas para pihak ──────────────────────────────────

/**
 * Baris tabel pihak di layar Data Umum SIPP (perkara_tab/data_umum.php):
 * table.table_pihak1 / table.table_pihak2, kolom "Nama" dan "Alamat", tautan
 * [Edit] = popup_form(add_pihak_pertama|kedua/.../edit/...).
 */
function p5BacaPihakSipp() {
  const hasil = [];
  const teks = (el) => String((el && el.textContent) || "").replace(/\s+/g, " ").trim();
  for (const [kelas, sebut] of [
    ["table_pihak1", "Pihak pertama"],
    ["table_pihak2", "Pihak kedua"],
  ]) {
    const tabel = document.querySelector(`table.${kelas}`);
    if (!tabel) continue;
    const baris = Array.from(tabel.querySelectorAll(":scope > tbody > tr"));
    if (baris.length < 2) continue;
    const kepala = Array.from(baris[0].children).map((td) => teks(td).toLowerCase());
    const iNama = kepala.indexOf("nama");
    const iAlamat = kepala.indexOf("alamat");
    if (iNama < 0 || iAlamat < 0) continue;
    baris.slice(1).forEach((tr, j) => {
      const sel = tr.children;
      if (!sel || sel.length <= iAlamat) return;
      const edit = tr.querySelector('a[onclick*="/edit/"]');
      hasil.push({
        kunci: `${kelas}-${j + 1}`,
        sebutan: `${sebut} ${j + 1}`,
        nama: teks(sel[iNama]),
        alamat: teks(sel[iAlamat]),
        penunjukEdit: edit ? `table.${kelas} > tbody > tr:nth-child(${j + 2}) a[onclick*="/edit/"]` : "",
      });
    });
  }
  return hasil;
}

async function p5MintaRapi(daftarAlamat) {
  const opsi = {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alamat: daftarAlamat }),
  };
  const r = await alatAmbil(P5_API_RAPIKAN, opsi, "Merapikan alamat para pihak");
  let luar = null;
  try {
    luar = await r.json();
  } catch {
    luar = null;
  }
  if (!r.ok) {
    const galat = luar && (luar.error || luar.message);
    const pesan = galat && typeof galat === "object" ? galat.message : galat;
    throw new Error(String(pesan || `Server ALETA menjawab ${r.status}.`));
  }
  const isi = luar && luar.data ? luar.data : luar;
  return Array.isArray(isi && isi.hasil) ? isi.hasil : [];
}

function p5Tunggu(periksa, batasMs) {
  return new Promise((selesai) => {
    const mulai = Date.now();
    const coba = () => {
      let h = null;
      try {
        h = periksa();
      } catch {
        h = null;
      }
      if (h) return selesai(h);
      if (Date.now() - mulai > batasMs) return selesai(null);
      setTimeout(coba, 100);
    };
    coba();
  });
}

function p5Tampak(el) {
  if (!el) return false;
  for (let s = el; s && s.nodeType === 1; s = s.parentElement) {
    let gaya = null;
    try {
      gaya = window.getComputedStyle(s);
    } catch {
      gaya = null;
    }
    if (gaya && (gaya.display === "none" || gaya.visibility === "hidden")) return false;
  }
  return true;
}

/**
 * Menuliskan satu alamat rapi lewat JALAN SIPP SENDIRI: [Edit] pihak itu
 * (popup add_pihak_pertama/kedua .../edit) -> blangko #frm_user -> kolom
 * Alamat (readonly di layar; SIPP sendiri mengisinya lewat skrip saat
 * memilih referensi, dan nilainya ikut terkirim saat Simpan). Simpan TIDAK
 * ditekan - petugas yang memeriksa lalu menyimpan.
 */
async function p5IsiAlamatSipp(pihak, alamatRapi) {
  if (!pihak.penunjukEdit) return { ok: false, pesan: "Tautan [Edit] pihak ini tidak ada (Anda tidak berhak menyunting di SIPP?)." };
  const buka = await kirimKeJembatanLangsung({ jenis: "tekan", penunjuk: pihak.penunjukEdit });
  if (!buka || buka.ok !== true) return { ok: false, pesan: `[Edit] tidak dapat ditekan (${String((buka && buka.alasan) || "tidak menjawab")}).` };
  const medan = await p5Tunggu(() => {
    const el = document.querySelector("form#frm_user #alamat");
    return el && p5Tampak(el) ? el : null;
  }, 10000);
  if (!medan) return { ok: false, pesan: "Blangko edit pihak SIPP tidak terbuka." };
  const isi = await kirimKeJembatan({ jenis: "isi", penunjuk: "form#frm_user #alamat", jenisMedan: "teks", nilai: alamatRapi });
  if (!isi || isi.ok !== true) return { ok: false, pesan: `Kolom Alamat tidak terisi (${String((isi && isi.alasan) || "tidak menjawab")}).` };
  return { ok: true };
}

function p5BagianRapikanPihak() {
  const kotak = bagian("Rapikan identitas para pihak", "rapikanPihak", true);
  const isi = kotak.isi;
  isi.appendChild(
    buatElemen(
      "div",
      "aleta-baris-ket",
      "Alamat para pihak di SIPP dibandingkan dengan usulan rapi: keterangan rumah/arah dalam kurung dan ekor wilayah dobel (bentuk e-Court) dibuang, sebutan tingkatan dilengkapi - tidak ada nama tempat yang dikarang."
    )
  );
  const kabar = buatElemen("div", "aleta-tetap-sebab", "");
  const daftar = buatElemen("div", "aleta-p5-pihak");
  const baca = buatElemen("button", "aleta-tombol aleta-tombol-kecil", "Baca alamat para pihak");
  baca.type = "button";
  const tulis = buatElemen("button", "aleta-tombol aleta-p5-tulis", "Isi alamat rapi ke SIPP (pihak tercentang berikutnya)");
  tulis.type = "button";
  tulis.hidden = true;
  isi.appendChild(baca);
  isi.appendChild(kabar);
  isi.appendChild(daftar);
  isi.appendChild(tulis);
  isi.appendChild(
    buatElemen("div", "aleta-baris-ket aleta-remeh", "Tiap pihak dibuka di blangko Edit pihak SIPP dan kolom Alamatnya diisi - Anda yang memeriksa lalu menekan Simpan, satu pihak tiap kali.")
  );

  let baris = [];
  const segarkanTulis = () => {
    const sisa = baris.filter((b) => b.centang.checked && !b.selesai);
    tulis.hidden = !baris.length;
    tulis.disabled = !sisa.length;
  };

  baca.addEventListener("click", async () => {
    daftar.textContent = "";
    baris = [];
    const pihak = p5BacaPihakSipp();
    if (!pihak.length) {
      kabar.textContent = "Tabel para pihak tidak ditemukan. Buka tab Data Umum perkara ini di SIPP, lalu tekan Baca lagi.";
      segarkanTulis();
      return;
    }
    baca.disabled = true;
    kabar.textContent = "Merapikan…";
    try {
      const hasil = await p5MintaRapi(pihak.map((p) => p.alamat));
      let berubah = 0;
      pihak.forEach((p, i) => {
        const h = hasil[i] || { alamat: p.alamat, perubahan: [], berubah: false };
        const kartu = buatElemen("div", `aleta-baris aleta-p5-satu${h.berubah ? " aleta-mendesak" : ""}`);
        kartu.setAttribute("data-p5-pihak", p.kunci);
        kartu.appendChild(buatElemen("div", "aleta-baris-judul", `${p.sebutan}: ${p.nama}`));
        kartu.appendChild(buatElemen("div", "aleta-baris-ket aleta-p5-sekarang", `Sekarang: ${p.alamat || "(kosong)"}`));
        const centang = document.createElement("input");
        centang.type = "checkbox";
        if (h.berubah) {
          berubah += 1;
          kartu.appendChild(buatElemen("div", "aleta-baris-ket aleta-p5-usulan", `Usulan: ${h.alamat}`));
          const ul = buatElemen("ul", "aleta-p5-perubahan");
          for (const x of h.perubahan || []) ul.appendChild(buatElemen("li", "", String(x)));
          kartu.appendChild(ul);
          const label = buatElemen("label", "aleta-p5-centang");
          centang.checked = Boolean(p.penunjukEdit);
          centang.disabled = !p.penunjukEdit;
          label.appendChild(centang);
          label.appendChild(document.createTextNode(p.penunjukEdit ? " tuliskan alamat rapi ini" : " (tidak ada tautan [Edit] - tulis sendiri)"));
          kartu.appendChild(label);
        } else {
          kartu.appendChild(buatElemen("div", "aleta-baris-ket aleta-p5-rapi", "Sudah rapi - tidak ada yang diubah."));
        }
        const hasilEl = buatElemen("div", "aleta-baris-ket aleta-p5-hasil", "");
        kartu.appendChild(hasilEl);
        centang.addEventListener("change", segarkanTulis);
        daftar.appendChild(kartu);
        if (h.berubah) baris.push({ pihak: p, rapi: h.alamat, centang, hasilEl, selesai: false });
      });
      kabar.textContent = berubah ? `${berubah} dari ${pihak.length} alamat perlu dirapikan.` : "Semua alamat para pihak sudah rapi.";
    } catch (galat) {
      kabar.textContent = `Gagal merapikan: ${String((galat && galat.message) || galat)}`;
    } finally {
      baca.disabled = false;
      segarkanTulis();
    }
  });

  tulis.addEventListener("click", async () => {
    const satu = baris.find((b) => b.centang.checked && !b.selesai);
    if (!satu) return;
    tulis.disabled = true;
    satu.hasilEl.textContent = "Membuka blangko Edit pihak SIPP…";
    const h = await p5IsiAlamatSipp(satu.pihak, satu.rapi);
    if (h.ok) {
      satu.selesai = true;
      satu.hasilEl.textContent = "✓ Kolom Alamat terisi. BELUM TERSIMPAN: periksa blangko lalu tekan Simpan sendiri.";
    } else {
      satu.hasilEl.textContent = `✗ ${h.pesan}`;
    }
    segarkanTulis();
  });
  return kotak;
}

/**
 * Dipanggil tetapkanLewatAleta sesudah rantai penetapan TERTULIS sungguhan
 * (bukan kering). Hanya UI Baru, hanya jenis yang baru tertulis.
 */
function e6SesudahPenetapanTertulis(kabar, usulan, hasil) {
  if (typeof s1Aktif !== "function" || !s1Aktif()) return null;
  const tertulis = (hasil || []).filter((x) => x && x.ok === true).map((x) => String(x.jenis));
  if (!tertulis.some((j) => j === "pmh" || j === "phs" || j === "ppp" || j === "pjs")) return null;
  const wadah = buatElemen("div", "aleta-abt-kabar", "Menyiapkan edoc penetapan…");
  wadah.setAttribute("data-e6-edoc", "otomatis");
  if (kabar && kabar.parentNode) kabar.parentNode.insertBefore(wadah, kabar.nextSibling);
  const perkara = (usulan && usulan.perkara) || {};
  return e6UnggahEdocPenetapan({
    nomorPerkara: String(perkara.nomorPerkara || ""),
    perkaraId: String(perkara.perkaraId || ""),
    jenis: tertulis,
    otomatis: true,
    kering: false,
    tanpaMuatUlang: true,
    kabar: wadah,
  });
}

/** Bagian tombol di tab PTSP: periksa dulu (kering), lalu unggah. */
function e6BagianEdocPenetapan(konteks) {
  const nomor = String((konteks && konteks.nomorPerkara) || "");
  const idHalaman = String((konteks && konteks.identitas && konteks.identitas.perkaraId) || "");
  const kotak = bagian("Edoc penetapan dari blangko ABT (PMH/PHS)", "e6EdocPenetapan", true);
  kotak.setAttribute("data-e6-fitur", "edoc-penetapan");
  kotak.isi.appendChild(
    buatElemen(
      "div",
      "aleta-tetap-sebab aleta-remeh",
      "Blangko dari Peta penetapan (Integrasi e-Court) dicetak dari ABT untuk perkara ini, ditandatangani sesuai nama penanda tangannya " +
        "(PMH: ditambah cap kantor di atas tanda tangan), lalu diunggah ke e-Doc tab Penetapan SIPP. Periksa dulu - belum ada yang ditulis."
    )
  );
  const pilihan = {};
  for (const [j, sebutan] of [
    ["pmh", "Penetapan Majelis Hakim (PMH)"],
    ["phs", "Penetapan Hari Sidang (PHS)"],
  ]) {
    const baris = buatElemen("label", "aleta-massal-baris");
    const c = document.createElement("input");
    c.type = "checkbox";
    c.className = "aleta-massal-centang";
    c.checked = true;
    c.setAttribute("data-e6-jenis", j);
    pilihan[j] = c;
    baris.append(c, buatElemen("span", "aleta-massal-nomor", sebutan));
    kotak.isi.appendChild(baris);
  }
  // I9 17 Okt: perkara bersita (petitum memohon sita) - pilihan PHS: ditangguhkan (bawaan @ 2) / dikabulkan (@ 2a) / ditolak (@ 2b).
  // Tampil hanya bila portal menyatakan perkaranya bersita; tidak terbaca = tidak tampil (bawaan @ 2 yang dipakai).
  const barisSita = buatElemen("label", "aleta-massal-baris");
  barisSita.hidden = true;
  barisSita.setAttribute("data-e6-sita", "baris");
  const pilihSita = document.createElement("select");
  pilihSita.className = "aleta-massal-ketik";
  pilihSita.setAttribute("data-e6-sita", "pilihan");
  for (const [nilai, teks] of [
    ["", "Sita: ditangguhkan (bawaan) - didengar kedua pihak lebih dulu"],
    ["dikabulkan", "Sita: dikabulkan"],
    ["ditolak", "Sita: ditolak"],
  ]) {
    const o = document.createElement("option");
    o.value = nilai;
    o.textContent = teks;
    pilihSita.appendChild(o);
  }
  barisSita.append(buatElemen("span", "aleta-massal-nomor", "Penetapan Hari Sidang perkara bersita"), pilihSita);
  kotak.isi.appendChild(barisSita);
  if (nomor) {
    void (async () => {
      const j = await t7AmbilJson(`${S2_API_EDOC_PETA}?nomor=${encodeURIComponent(nomor)}`, "Membaca keadaan sita perkara");
      const bersita = j.ok && j.data && j.data.perkara ? j.data.perkara.bersita : null;
      if (bersita === true) barisSita.hidden = false;
    })();
  }
  const tombol = buatElemen("button", "aleta-tombol", "Periksa dulu - belum ditulis");
  tombol.type = "button";
  tombol.setAttribute("data-e6-edoc", "tombol");
  const kabar = buatElemen("div", "aleta-abt-kabar", "");
  kotak.isi.append(tombol, kabar);
  let siapTulis = false;
  for (const c of [...Object.values(pilihan), pilihSita]) {
    c.addEventListener("change", () => {
      siapTulis = false;
      tombol.textContent = "Periksa dulu - belum ditulis";
    });
  }
  tombol.addEventListener("click", async () => {
    const jenis = Object.keys(pilihan).filter((j) => pilihan[j].checked);
    if (!jenis.length) {
      kabar.textContent = "Pilih minimal satu jenis.";
      return;
    }
    tombol.disabled = true;
    const tulis = siapTulis;
    const h = await e6UnggahEdocPenetapan({ nomorPerkara: nomor, perkaraId: idHalaman, jenis, otomatis: false, kering: !tulis, kabar, sita: pilihSita.value });
    tombol.disabled = false;
    if (!tulis && h && h.ok) {
      siapTulis = true;
      tombol.textContent = "Unggah ke e-Doc SIPP";
    } else {
      siapTulis = false;
      tombol.textContent = tulis && h && h.ok ? "Sudah diunggah - periksa lagi" : "Periksa dulu - belum ditulis";
    }
  });
  return kotak;
}

(globalThis.__aletaModulSelesai || (globalThis.__aletaModulSelesai = new Set())).add("konten-panel-perkara.js"); // K11-SELESAI
