"use strict";

/**
 * ============================================================================
 * PANEL DAFTAR PERKARA SIPP (K11)
 * ============================================================================
 *
 * susunPanelDaftar dan semua yang hanya dipakainya: penetapan massal, BAS/relaas massal, putusan massal.
 * Dimuat hanya di halaman daftar perkara.
 *
 * Potongan UTUH konten.js yang lama (K11, 26 Okt 2026): pernyataannya tidak
 * diubah, hanya dipindahkan. Dimuat modul-malas.js ke dunia terasing yang sama
 * dengan konten.js lewat pekerja latar (chrome.scripting.executeScript), sehingga
 * semua const/let/function tingkat atas tetap satu lingkup bersama konten.js.
 */


/** Andaian dari satu usulan yang lolos uji kering - siapa yang AKAN ditulis. */
function andaianDari(usulan, pilihanManual) {
  const pmh = idUntukTulis("pmh", usulan, pilihanManual) || {};
  const ppp = idUntukTulis("ppp", usulan, pilihanManual) || {};
  const pjs = idUntukTulis("pjs", usulan, pilihanManual) || {};
  const phs = idUntukTulis("phs", usulan, pilihanManual) || {};
  const hasil = {
    perkaraId: Number((usulan.perkara && usulan.perkara.perkaraId) || 0),
    hakimId: Array.isArray(pmh.hakimId) ? pmh.hakimId : [],
    paniteraId: Number(ppp.petugasId) || 0,
    jurusitaId: Number(pjs.petugasId) || 0,
    tanggalSidang: phs.tanggalSidang || "",
  };
  if (hasil.hakimId.length === 0 && !hasil.paniteraId && !hasil.jurusitaId && !hasil.tanggalSidang) {
    return null;
  }
  return hasil;
}

/**
 * Penolakan yang berlaku untuk SELURUH perkara, bukan untuk satu perkara:
 * akun SIPP tidak terbaca, mode coba, akun ALETA tidak terbaca. Pada
 * penetapan massal hanya ini yang menghentikan antrean - mengulangnya pada
 * tiap perkara hanya menulis kalimat yang sama dua puluh kali. Selebihnya
 * (usulan satu perkara gagal, hakim tidak ketemu, tanggal) berlaku untuk
 * perkara itu saja, dan perkara berikutnya tetap dikerjakan.
 */
const ALASAN_MENYELURUH = /^(akun_sipp_belum_terbaca|akun_sipp_tidak_ketemu|akun_sipp_ganda|operator_tidak_disebut|operator_tidak_dikenali|mode_coba|mode_kering|mode_latihan|aleta_belum_masuk|aleta_tanpa_akses|belum_masuk_aleta|tidak_berwenang_aleta)$/;

/**
 * ============================================================================
 * PANEL UNTUK HALAMAN DAFTAR PERKARA
 * ============================================================================
 *
 * Sebelumnya panel HANYA muncul di halaman satu perkara. Di halaman daftar -
 * tempat petugas menghabiskan sebagian besar waktunya, memindai puluhan baris
 * sekaligus - tidak ada apa pun dari ALETA. Yang membukanya menyimpulkan
 * ekstensinya mati, lalu memuat ulang halaman, lalu melapor rusak.
 *
 * Isinya sengaja sedikit dan hanya yang benar-benar menjawab pertanyaan
 * halaman ini: dari sekian perkara di layar, berapa yang perlu diperiksa, dan
 * karena apa. Rincian tiap perkara sudah tertempel pada barisnya masing-masing;
 * mengulanginya di sini hanya menambah tempat kedua yang harus dibaca.
 */
const NAMA_KEADAAN = {
  ghaib: "pihak ghaib",
  izinAtasan: "perlu izin atasan",
  verzet: "verzet",
  prodeo: "prodeo",
  kuasa: "memakai kuasa hukum",
  mafqud: "diduga mafqud",
};

/**
 * ============================================================================
 * PENETAPAN MASSAL DARI HALAMAN DAFTAR PERKARA
 * ============================================================================
 *
 * Pendaftaran satu pagi kerap berisi belasan perkara, dan keempat penetapan
 * tiap perkara menuntut membuka halamannya satu per satu. Panel ini sudah
 * membaca seluruh nomor perkara di halaman daftar - ia hanya belum pernah
 * boleh mengerjakan apa-apa dengannya.
 *
 * ============================================================================
 * TIGA PAGAR YANG MEMBUATNYA TIDAK MENJADI ALAT PERUSAK MASSAL
 * ============================================================================
 *
 *   1. TIDAK ADA yang tercentang sendiri. Menetapkan seluruh halaman hanya
 *      karena tombolnya tertekan adalah kesalahan yang tidak dapat
 *      dibatalkan dengan satu tekanan pula.
 *   2. DUA tekanan, sama seperti satu perkara: yang pertama menjalankan uji
 *      kering atas TIAP perkara terpilih dan memperlihatkan hasilnya baris
 *      demi baris, yang kedua menuliskannya.
 *   3. Berhenti hanya pada kegagalan MENYELURUH (ALASAN_MENYELURUH: akun SIPP
 *      tidak terbaca, mode coba, belum masuk ALETA). Kegagalan satu perkara
 *      dilaporkan pada barisnya dan antrean berjalan terus (7 Okt 2026) -
 *      sebelumnya satu perkara yang gagal menghentikan seluruh halaman.
 *
 * Perkara yang keempat penetapannya SUDAH ada dilewati tanpa berbunyi; itu
 * bukan kegagalan, itu perkara yang memang sudah dikerjakan.
 */
const BATAS_PERKARA_MASSAL = 25;

/** Urutan rantai penetapan - sama dengan urutan rantaiPenetapan itu sendiri. */
const URUTAN_RANTAI = ["pmh", "ppp", "pjs", "phs"];

/**
 * Langkah yang MASIH kurang pada satu perkara.
 *
 * Kosong berarti keempatnya sudah ada. Bila keadaannya tidak diketahui -
 * SIPP tidak terbaca, atau perkaranya tidak ada pada ringkasan - keempatnya
 * dianggap kurang. Menganggapnya lengkap berarti menyembunyikan perkara yang
 * barangkali justru belum ditetapkan sama sekali, dan itu kekeliruan yang
 * tidak terlihat siapa pun.
 */
function langkahKurang(keadaan) {
  if (!keadaan) return [...URUTAN_RANTAI];
  return URUTAN_RANTAI.filter((x) => keadaan[x] !== true);
}

function bagianPenetapanMassal(ringkasan) {
  const kotak = bagian("Penetapan massal", "penetapanMassal", true);

  const baris = barisPerkaraDiHalaman();
  if (baris.length < 2) {
    kotak.isi.appendChild(
      buatElemen("div", "aleta-kosong", "Halaman ini bukan daftar perkara.")
    );
    return kotak;
  }

  // ==========================================================================
  // YANG SUDAH LENGKAP TIDAK DITAWARKAN SAMA SEKALI
  // ==========================================================================
  //
  // Sebelumnya seluruh perkara di halaman ditawarkan, termasuk yang keempat
  // penetapannya sudah lengkap sejak berbulan-bulan lalu. Petugas
  // mencentangnya, menunggu, lalu diberi tahu "sudah ditetapkan" satu per
  // satu - dan daftar yang sebagian besar isinya tidak dapat dikerjakan
  // mengajari orang untuk berhenti membacanya.
  //
  // Yang TANGGUNG justru ditawarkan, dan inilah tambahannya: perkara yang
  // PMH-nya sudah ada tetapi PPP, PJS, dan PHS-nya belum dapat dilanjutkan
  // dari tempat ia berhenti. Rantai penetapan memang sudah melewati langkah
  // yang ada; yang kurang hanya menawarkannya.
  const keadaanPer = (ringkasan && ringkasan.penetapan) || {};
  const seluruhNomor = [...new Set(baris.map((x) => x.nomor))];
  const kurangPer = new Map();
  for (const nomor of seluruhNomor) {
    const kurang = langkahKurang(keadaanPer[nomor]);
    if (kurang.length > 0) kurangPer.set(nomor, kurang);
  }
  const sudahLengkap = seluruhNomor.length - kurangPer.size;

  if (kurangPer.size === 0) {
    kotak.isi.appendChild(
      buatElemen(
        "div",
        "aleta-kosong",
        `Keempat penetapan sudah lengkap pada ${seluruhNomor.length} perkara di halaman ini. Tidak ada yang perlu dikerjakan.`
      )
    );
    return kotak;
  }

  const nomorSemua = [...kurangPer.keys()].slice(0, BATAS_PERKARA_MASSAL);
  const terpilih = new Set();

  // Disebut apa adanya bila halamannya memuat lebih banyak daripada yang
  // ditawarkan. "25 perkara terbaca" pada halaman berisi lima puluh perkara
  // adalah kalimat yang keliru, dan yang membacanya akan menyangka
  // setengah halamannya tidak terbaca ALETA.
  kotak.isi.appendChild(
    buatElemen(
      "div",
      "aleta-tetap-sebab",
      `${nomorSemua.length} perkara masih ada penetapan yang belum dikerjakan` +
        (kurangPer.size > nomorSemua.length
          ? ` (dari ${kurangPer.size}; yang ditawarkan ${nomorSemua.length} pertama)`
          : "") +
        (sudahLengkap
          ? `. ${sudahLengkap} perkara lain di halaman ini sudah lengkap dan tidak ditawarkan`
          : "") +
        ". Centang yang hendak ditetapkan — tidak ada yang tercentang sendiri."
    )
  );

  // Tiap perkara satu BUTIR: baris centangnya, lalu rinciannya di bawah -
  // lihat gambarRincianMassal. Belangnya per butir, bukan per baris.
  const daftar = buatElemen("div", "aleta-massal-daftar aleta-massal-daftar-penetapan");
  const kotakCentang = new Map();
  for (const nomor of nomorSemua) {
    const label = buatElemen("label", "aleta-massal-baris");
    const centang = document.createElement("input");
    centang.type = "checkbox";
    centang.className = "aleta-massal-centang";
    centang.addEventListener("change", () => {
      if (centang.checked) terpilih.add(nomor);
      else terpilih.delete(nomor);
      perbaruiTombol();
    });
    kotakCentang.set(nomor, centang);
    label.appendChild(centang);
    label.appendChild(buatElemen("span", "aleta-massal-nomor", nomor));
    // Apa yang kurang disebutkan sejak awal, bukan sesudah diperiksa. Yang
    // memilih perlu tahu ia sedang melanjutkan rantai yang tanggung, bukan
    // memulai dari nol.
    const kurang = kurangPer.get(nomor) || [];
    const awalnya =
      kurang.length === URUTAN_RANTAI.length
        ? "belum ditetapkan"
        : `kurang ${kurang.map((x) => x.toUpperCase()).join(", ")}`;
    const keadaan = buatElemen("span", "aleta-massal-keadaan", awalnya);
    label.appendChild(keadaan);
    const butir = buatElemen("div", "aleta-massal-butir");
    butir.appendChild(label);
    daftar.appendChild(butir);
  }
  kotak.isi.appendChild(daftar);

  // ==========================================================================
  // SIDANG KELILING PADA PENETAPAN MASSAL
  // ==========================================================================
  //
  // Penetapan massal memang dipakai justru untuk sidang keliling: satu hari
  // keliling menghasilkan belasan perkara yang seluruhnya ditetapkan ke tempat
  // yang sama. Sampai sekarang panel ini tidak punya pilihan tempat sama
  // sekali, jadi seluruhnya tertulis "Ruang Sidang 1 Dalam Gedung" dengan
  // sidang_keliling nol.
  //
  // Gagalnya diam - penetapannya berhasil, berkasnya tercetak, sidangnya
  // digelar - dan yang menyadarinya baru penyusun laporan tahunan.
  //
  // HANYA TEMPATNYA yang disamakan, bukan tanggalnya. Tiap majelis punya hari
  // sidangnya sendiri, dan menyamakan tanggal seluruh perkara terpilih akan
  // menetapkan sidang pada hari majelisnya tidak bersidang - belasan perkara
  // sekaligus, dalam satu tekanan.
  const tempatMassal = { ruangan: "" };
  const saklarMassal = buatElemen("label", "aleta-pilih-bebas");
  const kotakMassal = document.createElement("input");
  kotakMassal.type = "checkbox";
  saklarMassal.appendChild(kotakMassal);
  saklarMassal.appendChild(
    buatElemen("span", "aleta-pilih-bebas-nama", "Sidang keliling - satu tempat untuk semuanya")
  );
  kotak.isi.appendChild(saklarMassal);

  const barisTempat = buatElemen("div", "aleta-massal-tempat");
  barisTempat.hidden = true;
  kotak.isi.appendChild(barisTempat);

  function gambarTempatMassal() {
    barisTempat.textContent = "";
    if (!kotakMassal.checked) {
      barisTempat.hidden = true;
      tempatMassal.ruangan = "";
      return;
    }
    barisTempat.hidden = false;

    if (ruanganTersimpan === null) {
      barisTempat.appendChild(buatElemen("div", "aleta-tetap-sebab", "Membaca daftar ruangan…"));
      void muatRuangan().then(() => gambarTempatMassal());
      return;
    }
    if (!ruanganTersimpan.length) {
      barisTempat.appendChild(
        buatElemen("div", "aleta-tetap-sebab", "Daftar ruangan tidak terbaca - tempatnya tidak dapat dipilih.")
      );
      return;
    }

    const SEBUT_MASSAL = {
      "dalam-gedung": "Dalam gedung",
      keliling: "Sidang keliling",
      terpadu: "Sidang terpadu",
    };
    // Keliling dan terpadu di atas: yang menyalakan saklar ini sedang mencari
    // salah satunya, bukan ruangan dalam gedung.
    const urut = [...ruanganTersimpan].sort((a, b) => {
      const luar = (r) => (r.sifat === "keliling" ? 0 : r.sifat === "terpadu" ? 1 : 2);
      return luar(a) - luar(b);
    });
    barisTempat.appendChild(
      pilihanOrang(
        "Ruang sidang",
        urut.map((r) => ({
          id: String(r.id),
          label:
            `${r.nama} — ${SEBUT_MASSAL[r.sifat] || r.sifat}` +
            (r.dipakai === undefined
              ? ""
              : r.dipakai > 0
                ? ` · ${r.dipakai} sidang 2 tahun terakhir`
                : " · belum pernah dipakai"),
        })),
        tempatMassal.ruangan,
        (nilai) => {
          tempatMassal.ruangan = nilai;
          gambarTempatMassal();
        }
      )
    );

    const dipilih = ruanganTersimpan.find((r) => String(r.id) === String(tempatMassal.ruangan));
    if (dipilih && dipilih.kua) {
      barisTempat.appendChild(
        buatElemen(
          "div",
          "aleta-tetap-hitung",
          `Tempat: ${dipilih.kua}${dipilih.kuaAlamat ? ` — ${dipilih.kuaAlamat}` : ""}`
        )
      );
    }
    barisTempat.appendChild(
      buatElemen(
        "div",
        "aleta-tetap-sebab",
        "Hanya TEMPATNYA yang disamakan. Hari sidang tiap perkara tetap mengikuti hari majelisnya."
      )
    );
  }

  kotakMassal.addEventListener("change", gambarTempatMassal);

  const pilihSemua = buatElemen("button", "aleta-portal-tautan", "Centang semua");
  pilihSemua.type = "button";
  pilihSemua.addEventListener("click", () => {
    const semuanyaTercentang = terpilih.size === nomorSemua.length;
    for (const [nomor, centang] of kotakCentang) {
      centang.checked = !semuanyaTercentang;
      if (centang.checked) terpilih.add(nomor);
      else terpilih.delete(nomor);
    }
    pilihSemua.textContent = semuanyaTercentang ? "Centang semua" : "Kosongkan centang";
    perbaruiTombol();
  });
  kotak.isi.appendChild(pilihSemua);

  const kaki = buatElemen("div", "aleta-tetap-kaki");
  const tombol = buatElemen("button", "aleta-tombol aleta-tombol-mati", "Periksa perkara terpilih");
  tombol.type = "button";
  tombol.disabled = true;
  const kabar = buatElemen("span", "aleta-tetap-sebab", "");
  kaki.appendChild(tombol);
  kaki.appendChild(kabar);
  kotak.isi.appendChild(kaki);

  let sudahDiperiksa = false;

  function perbaruiTombol() {
    // Mengubah centang SESUDAH diperiksa mengembalikan tombol ke tahap
    // memeriksa. Tanpa itu, tekanan kedua akan menuliskan perkara yang
    // rencananya tidak pernah diperlihatkan.
    sudahDiperiksa = false;
    tombol.textContent = terpilih.size ? `Periksa ${terpilih.size} perkara terpilih` : "Periksa perkara terpilih";
    tombol.disabled = terpilih.size === 0;
    tombol.classList.toggle("aleta-tombol-mati", terpilih.size === 0);
  }

  /** Menandai satu baris pada daftar - dipakai selagi berjalan. */
  function tandaiBaris(nomor, teks, nada) {
    const centang = kotakCentang.get(nomor);
    const induk = centang && centang.parentElement;
    const tempat = induk && induk.querySelector(".aleta-massal-keadaan");
    if (!tempat) return;
    tempat.textContent = teks;
    tempat.className = `aleta-massal-keadaan${nada ? ` aleta-lencana-${nada}` : ""}`;
  }

  /**
   * ==========================================================================
   * RINCIAN DI BAWAH TIAP PERKARA - YANG SELAMA INI HANYA DILIHAT PAPAN SATU
   * ==========================================================================
   *
   * Papan satu perkara menggambar rapor uji kering: majelis, panitera
   * pengganti, juru sita, hari sidang, dan ganjalannya (akhir pekan, kurang
   * dari tujuh hari, nilai sengketa kosong, pejabat berhalangan). Penetapan
   * massal hanya menulis "siap ditetapkan" - lalu menulis belasan penetapan
   * yang majelis dan hari sidangnya tidak pernah diperlihatkan.
   *
   * Rapornya rapor yang SAMA (raporPraperiksa), digambar ringkas di bawah
   * baris centangnya; andaian dari bot ("PHS dinilai seolah PMH sudah
   * tertulis") ikut tertera.
   */
  function gambarRincianMassal(nomor, rapor, hasil) {
    const centang = kotakCentang.get(nomor);
    const butir = centang && centang.parentElement && centang.parentElement.parentElement;
    if (!butir) return;
    let wadah = butir.querySelector(".aleta-massal-rincian");
    if (!wadah) {
      wadah = buatElemen("div", "aleta-massal-rincian");
      butir.appendChild(wadah);
    }
    wadah.textContent = "";
    const isiBaris = (rapor.baris || []).map((b) => `${b.label}: ${b.nilai}`).join(" · ");
    if (isiBaris) wadah.appendChild(buatElemen("div", "aleta-massal-rincian-isi", isiBaris));
    for (const ganjalan of rapor.ganjalan || []) {
      wadah.appendChild(buatElemen("div", "aleta-massal-ganjalan", ganjalan));
    }
    for (const satu of hasil || []) {
      for (const andaianBot of satu.andaian || []) {
        wadah.appendChild(
          buatElemen("div", "aleta-massal-rincian-isi", `Andaian ${String(satu.jenis).toUpperCase()}: ${andaianBot}`)
        );
      }
    }
    if (rapor.sudahAda && rapor.sudahAda.length > 0) {
      wadah.appendChild(
        buatElemen("div", "aleta-massal-rincian-isi", `Sudah ada di SIPP: ${rapor.sudahAda.join(", ")}.`)
      );
    }
  }

  /**
   * ==========================================================================
   * SATU PERKARA GAGAL TIDAK MENGHENTIKAN ANTREAN (7 Okt 2026, keluhan 4)
   * ==========================================================================
   *
   * Sebelumnya antrean BERHENTI pada kegagalan pertama ("Berhenti di ...") -
   * satu perkara yang usulannya tidak tersusun, atau satu langkah yang
   * ditolak, membuat seluruh perkara terpilih sesudahnya tidak pernah
   * diperiksa maupun ditetapkan, dan yang terbaca petugas hanya "error".
   *
   * Sekarang tiap perkara dilaporkan sendiri - dikerjakan (langkah sisanya),
   * dilewati (keempatnya sudah ada), atau gagal beserta sebabnya - dan
   * antrean berjalan terus. Yang MENGHENTIKAN hanya penolakan yang berlaku
   * untuk seluruh perkara (ALASAN_MENYELURUH: akun SIPP tidak terbaca, mode
   * coba, belum masuk ALETA) - mengulangnya dua puluh kali tidak menolong.
   *
   * Penulisan sungguhan hanya mengerjakan perkara yang LULUS pemeriksaan
   * (siapDitulis) - yang gagal saat diperiksa tidak ikut ditulis.
   */
  let siapDitulis = new Set();

  function sebutLangkah(daftar) {
    return daftar.map((x) => String(x.jenis || x).toUpperCase()).join(", ");
  }

  // 9 Okt 2026: antrean dilaporkan ke latar.js selama berjalan - tombol
  // "Perbarui ekstensi" ditahan sampai selesai (alatAntreanKerja). Dilepas
  // pada SETIAP jalan keluar: selesai, berhenti, maupun lemparan.
  async function jalankan(kering) {
    const lapor =
      typeof alatAntreanKerja === "function"
        ? alatAntreanKerja("penetapan-massal", kering ? "pemeriksaan penetapan massal" : "penetapan massal", 0)
        : null;
    try {
      return await jalankanIsi(kering, lapor);
    } finally {
      if (lapor) lapor.selesai();
    }
  }

  async function jalankanIsi(kering, lapor) {
    const urut = nomorSemua.filter((x) => terpilih.has(x) && (kering || siapDitulis.has(x)));
    let ke = 0;
    let berhasil = 0;
    let dilewati = 0;
    const gagalPer = [];
    const lulus = new Set();
    // Perkara yang sudah lolos uji kering di antrean ini - dikirim sebagai
    // andaian bagi perkara berikutnya, supaya gilirannya dihitung berurutan.
    // Pada penulisan sungguhan tidak diperlukan: yang sudah tertulis memang
    // sudah ada di basis data ketika perkara berikutnya diminta usulannya.
    const andaian = [];

    const catatGagal = (nomor, sebab, ringkas) => {
      gagalPer.push({ nomor, sebab });
      tandaiBaris(nomor, `gagal - ${ringkas || sebab}`.slice(0, 80), "lewat");
    };

    for (const nomor of urut) {
      if (lapor) lapor.maju(ke, urut.length);
      ke += 1;
      tandaiBaris(nomor, kering ? "memeriksa…" : "menetapkan…", "");
      kabar.textContent = `${nomor} — ${kering ? "diperiksa" : "ditetapkan"}…`;

      let data;
      try {
        data = await ambilUsulanPenunjukan(nomor, null, kering ? andaian : []);
      } catch (galat) {
        const pesan = String((galat && galat.message) || galat).slice(0, 160);
        // Belum masuk ALETA / peran tanpa akses berlaku untuk seluruh antrean.
        if (/Belum masuk ALETA|tidak diberi akses/i.test(pesan)) {
          catatGagal(nomor, pesan);
          return { berhasil, dilewati, gagalPer, lulus, berhentiDi: nomor, sebabBerhenti: pesan };
        }
        catatGagal(nomor, `usulan tidak dapat disusun: ${pesan}`, "usulan tidak dapat disusun");
        continue;
      }

      const usulan = data && data.usulan;
      if (!usulan || usulan.ok === false) {
        const sebab = String((usulan && (usulan.alasan || usulan.message)) || (data && data.alasan) || "");
        catatGagal(nomor, `usulan tidak dapat disusun${sebab ? ` (${sebab})` : ""}`, "usulan tidak dapat disusun");
        continue;
      }

      // Tempat yang dipilih disisipkan ke tiap perkara - rantaiPenetapan
      // membacanya dari data.pilihanManual, tempat yang sama yang dipakai
      // papan satu perkara. Tanpa baris ini saklarnya tergambar tetapi tidak
      // mengubah apa pun.
      if (tempatMassal.ruangan) {
        data.pilihanManual = { ...(data.pilihanManual || {}), ruangan: tempatMassal.ruangan };
      }

      let hasil;
      try {
        hasil = await rantaiPenetapan(usulan, data, kering);
      } catch (galat) {
        catatGagal(nomor, String((galat && galat.message) || galat).slice(0, 160));
        continue;
      }

      // Yang SUDAH ada bukan kegagalan - perkara itu memang sudah
      // dikerjakan (tangan atau sebelumnya), dan menyebutnya gagal membuat
      // orang mencari kerusakan yang tidak ada.
      const sudahAda = hasil.filter((x) => !x.ok && (x.sudahAda === true || /_sudah_ada$/.test(String(x.alasan || ""))));
      const gagalSungguhan = hasil.filter((x) => !x.ok && !sudahAda.includes(x));
      const dikerjakan = hasil.filter((x) => x.ok);

      // Rincian yang akan (atau sudah) ditulis - dan, pada uji kering,
      // andaian bagi perkara berikutnya di antrean.
      try {
        gambarRincianMassal(nomor, raporPraperiksa(usulan, data, hasil), hasil);
      } catch {
        /* rincian tidak pernah menghentikan antrean */
      }

      if (gagalSungguhan.length > 0) {
        // Langkah yang hanya ikut dibatalkan bersama rantainya bukan sebabnya
        // (uji rilis U1, 9 Okt 2026 - lihat kirimRantaiUtuh).
        const pertama = gagalSungguhan.find((x) => x.alasan !== "dibatalkan_rantai") || gagalSungguhan[0];
        const bunyi = pertama.bunyi || pertama.alasan;
        if (ALASAN_MENYELURUH.test(String(pertama.alasan || ""))) {
          catatGagal(nomor, `${String(pertama.jenis).toUpperCase()}: ${bunyi}`);
          return { berhasil, dilewati, gagalPer, lulus, berhentiDi: nomor, sebabBerhenti: bunyi };
        }
        // Langkah yang SEMPAT tertulis sebelum gagal disebut - petugas perlu
        // tahu perkara ini kini separuh tertulis.
        const tertulis = !kering && dikerjakan.length ? ` (sudah tertulis: ${sebutLangkah(dikerjakan)})` : "";
        catatGagal(nomor, `${String(pertama.jenis).toUpperCase()}: ${bunyi}${tertulis}`, `${String(pertama.jenis).toUpperCase()}: ${pertama.alasan}`);
        continue;
      }

      if (dikerjakan.length === 0) {
        dilewati += 1;
        tandaiBaris(nomor, "sudah lengkap di SIPP - dilewati", "aman");
        continue;
      }

      berhasil += 1;
      lulus.add(nomor);
      if (kering) {
        const satuAndaian = andaianDari(usulan, data.pilihanManual || {});
        if (satuAndaian) andaian.push(satuAndaian);
      }
      // Yang tanggung disebut apa adanya: langkah sisa yang dikerjakan, dan
      // langkah yang sudah ada sebelumnya.
      tandaiBaris(
        nomor,
        `${kering ? "siap" : "ditetapkan"} — ${sebutLangkah(dikerjakan)}` +
          (sudahAda.length ? ` (${sebutLangkah(sudahAda)} sudah ada)` : ""),
        "aman"
      );
    }

    return { berhasil, dilewati, gagalPer, lulus, berhentiDi: null, sebabBerhenti: "" };
  }

  /** Kalimat ringkas hasil antrean - dikerjakan, dilewati, gagal. */
  function ringkasAntrean(hasil, kering) {
    const bagianKalimat = [
      kering ? `${hasil.berhasil} perkara siap ditetapkan` : `${hasil.berhasil} perkara ditetapkan`,
    ];
    if (hasil.dilewati) bagianKalimat.push(`${hasil.dilewati} perkara dilewati karena keempat penetapannya sudah ada`);
    if (hasil.gagalPer.length) {
      bagianKalimat.push(
        `${hasil.gagalPer.length} perkara gagal: ` +
          hasil.gagalPer.map((x) => `${x.nomor} - ${x.sebab}`).join("; ")
      );
    }
    return bagianKalimat.join(", ");
  }

  tombol.addEventListener("click", async () => {
    tombol.disabled = true;

    if (!sudahDiperiksa) {
      let hasil;
      try {
        hasil = await jalankan(true);
      } catch (galat) {
        kabar.textContent = `Pemeriksaan terhenti: ${String((galat && galat.message) || galat).slice(0, 160)}`;
        tombol.disabled = false;
        return;
      }
      if (hasil.berhentiDi) {
        kabar.textContent = `Dihentikan di ${hasil.berhentiDi}: ${hasil.sebabBerhenti} Belum ada yang ditulis.`;
        tombol.disabled = false;
        return;
      }
      siapDitulis = hasil.lulus;
      sudahDiperiksa = hasil.berhasil > 0;
      kabar.textContent =
        ringkasAntrean(hasil, true) +
        (hasil.berhasil > 0
          ? ". Belum ada yang ditulis - rinciannya tertera di bawah tiap perkara, dihitung berurutan. Tekan sekali lagi untuk menetapkan; yang gagal tidak ikut ditulis."
          : ". Tidak ada yang dapat ditetapkan.");
      tombol.textContent = hasil.berhasil > 0 ? `Tetapkan ${hasil.berhasil} perkara sekarang` : "Periksa ulang";
      tombol.disabled = false;
      return;
    }

    let hasil;
    try {
      hasil = await jalankan(false);
    } catch (galat) {
      kabar.textContent = `Penetapan terhenti: ${String((galat && galat.message) || galat).slice(0, 160)}. Muat ulang halaman daftar untuk melihat keadaannya.`;
      return;
    }
    sudahDiperiksa = false;
    siapDitulis = new Set();
    if (hasil.berhentiDi) {
      // Yang SUDAH tertulis disebutkan. Tanpa itu, yang membacanya tidak
      // tahu sampai mana halaman ini terkerjakan, dan menekan lagi dari awal.
      kabar.textContent =
        `Dihentikan di ${hasil.berhentiDi}: ${hasil.sebabBerhenti} — ${hasil.berhasil} perkara sudah tertulis sebelum berhenti.`;
      tombol.textContent = "Periksa ulang";
      tombol.disabled = false;
      return;
    }
    kabar.textContent = `Selesai: ${ringkasAntrean(hasil, false)}. Halaman daftar dimuat ulang SEKALI supaya keadaannya yang baru tampil.`;
    tombol.textContent = "Selesai";
    // Antrean massal: tidak memuat ulang di tengah; sekali di akhir, kembali ke halaman daftar ini.
    if (hasil.berhasil > 0) {
      muatUlangSesudahTulis({
        judulOk: "Penetapan massal selesai.",
        judulGagal: "Penetapan massal belum selesai seluruhnya.",
        baris: [
          { jenis: "ditetapkan", teks: `${hasil.berhasil} perkara`, ok: true },
          ...(hasil.dilewati ? [{ jenis: "dilewati", teks: `${hasil.dilewati} perkara (sudah lengkap)`, ok: true }] : []),
          ...hasil.gagalPer.map((x) => ({ jenis: "gagal", teks: `${x.nomor} - ${x.sebab}`, ok: false })),
        ],
      });
    }
  });

  return kotak;
}

function susunPanelDaftar(ringkasan) {
  const panel = buatElemen("div", "aleta-panel");
  panel.id = PENANDA;

  const kepala = buatElemen("div", "aleta-kepala");

  // Logo dipasang di SINI juga, bukan hanya di panel perkara: dalam bentuk
  // logo melayang, logo inilah SATU-SATUNYA yang terlihat. Tanpa ia, yang
  // tersisa lingkaran kosong yang tidak dapat dikenali sebagai apa pun.
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
  // Pita yang sama dengan panel perkara - tanpa nomor, sebab halaman ini
  // memuat banyak perkara sekaligus.
  kepala.appendChild(pitaIdentitas({}));

  // Deret tombol yang SAMA dengan panel perkara - lihat pasangTombolKepala.
  // Sebelumnya hanya tema dan tutup, sehingga di dashboard dan daftar perkara
  // panelnya tidak dapat diciutkan maupun dilayarpenuhkan sama sekali.
  pasangTombolKepala(panel, kepala, null);
  panel.appendChild(kepala);
  // 13 Okt butir 2: gembok kepala ringkas, sama dengan panel perkara.
  if (typeof alatPasangGembok === "function") alatPasangGembok(panel, kepala, "sipp");
  pasangGeser(panel, kepala);
  pasangUbahUkuran(panel);

  const isi = buatElemen("div", "aleta-isi");
  isi.appendChild(
    buatElemen("div", "aleta-bagian-judul", `DAFTAR PERKARA — ${ringkasan.jumlah} di halaman ini`)
  );

  if (!ringkasan.ditandai) {
    // Disebut apa adanya, beserta jalan keluarnya. Panel yang hanya berkata
    // "tidak ada penanda" membuat orang mengira tidak ada yang perlu diperiksa.
    isi.appendChild(
      buatElemen(
        "div",
        "aleta-kosong",
        'Penandaan baris sedang dimatikan. Nyalakan "Tandai halaman SIPP" pada ikon ALETA di pojok peramban.'
      )
    );
  } else if (ringkasan.r11Cadangan) {
    // R 11 Okt: daftar jurnal yang barisnya tidak terbaca sebagai daftar perkara.
    isi.appendChild(buatElemen("div", "aleta-kosong-lembut", "Penanda baris tidak dipasang di halaman jurnal ini."));
  } else if (ringkasan.bertanda === 0) {
    isi.appendChild(
      buatElemen("div", "aleta-kosong", "Tidak ada perkara di halaman ini yang berkeadaan khusus.")
    );
  } else {
    isi.appendChild(
      buatElemen("div", "aleta-baris-ket", `${ringkasan.bertanda} perkara perlu diperiksa:`)
    );
    const daftar = buatElemen("div", "aleta-identitas");
    for (const [kunci, jumlah] of Object.entries(ringkasan.sebab).sort((a, b) => b[1] - a[1])) {
      daftar.appendChild(
        buatElemen("span", "aleta-tanda-panel", `${jumlah} ${NAMA_KEADAAN[kunci] || kunci}`)
      );
    }
    isi.appendChild(daftar);
    isi.appendChild(
      buatElemen(
        "div",
        "aleta-baris-ket",
        "Penandanya tertempel di bawah nomor perkara pada barisnya masing-masing."
      )
    );
  }

  // Perbaikan 30 Sep sore (Baru & UI Baru): menu massal mengikuti matriks
  // peran - lihat mpsSusunDaftar. null (Lama, peran lain) = susunan di bawah.
  // R 11 Okt (butir 4 & 5): di halaman daftar JURNAL KEUANGAN, yang boleh
  // Kasir hanya melihat Kasir massal/pengingat/rekap - konteks halaman
  // mengalahkan "semua" (juga Super Admin). Menu massal lain tetap di
  // dashboard dan daftar perkara biasa.
  const r11HanyaKasir = r11DaftarHanyaKasir();
  const menuMassalPeran = r11HanyaKasir ? [] : typeof mpsMenuDaftar === "function" ? mpsMenuDaftar() : null;
  if (r11HanyaKasir) panel.setAttribute("data-r11-halaman", "jurnal-daftar");
  if (menuMassalPeran) {
    mpsSusunDaftar(panel, isi, ringkasan, menuMassalPeran);
  }
  // Penetapan massal hanya bagi yang memang boleh menulis penetapan - dan
  // hanya di halaman yang benar-benar daftar perkara. Menggambarnya bagi
  // yang tidak berwenang berarti menawarkan tombol yang akan menolak.
  // Dengan matriks peran (menuMassalPeran) keduanya sudah disusun di atas.
  if (!menuMassalPeran) if (boleh("penunjukan") && boleh("kerjakan")) {
    isi.appendChild(bagianPenetapanMassal(ringkasan));
  }
  // Hak unggah putusan (9 Okt 2026): putusan massal hanya Hakim (termasuk
  // Ketua/Wakil), Admin, Super Admin. Peran lain - termasuk peran "lain" yang
  // memakai susunan lama - melihat kotak terkunci beralasan.
  const bolehPutusanMassal =
    typeof alatBolehUnggahPutusan !== "function" || alatBolehUnggahPutusan(penggunaTerakhir) !== false;
  if (!menuMassalPeran && boleh("data-umum") && !bolehPutusanMassal && typeof alatKotakTerkunciPutusan === "function") {
    isi.appendChild(alatKotakTerkunciPutusan("Putusan massal"));
  }
  if (!menuMassalPeran && boleh("data-umum") && bolehPutusanMassal) {
    // Fitur 2: antrean SIPP disusun dari tanggal sidang, tanpa lewat ABT.
    // Antrean yang baru disusun langsung tampil di panel ini - tanpa memuat
    // ulang halaman (tampilkanAntreanSipp).
    isi.appendChild(bagianMassalSipp(() => void tampilkanAntreanSipp(isi)));
    // Fitur 3: antrean yang sama, tetapi bermula dari BERKAS. Diletakkan
    // sesudah yang dari tanggal sidang, bukan sebelumnya: yang dari tanggal
    // sidang dipakai tiap hari, yang dari berkas hanya ketika naskahnya sudah
    // terkumpul di satu folder.
    bagianMassalBerkas(isi, () => void tampilkanAntreanSipp(isi));
    void bagianAntreanSipp("").then((k) => {
      if (k && isi.isConnected) isi.appendChild(k);
    });
  }
  // 1.189.x (butir 2, 4, 5): Kasir harian - massal satu hari, rekap, pengingat.
  // Baru & UI Baru saja, bagi kasir/keuangan/panitera/admin (basmassal.js).
  // R 11 Okt (butir 4): HANYA di halaman daftar jurnal keuangan perkara
  // (jurnal_perkara_list, all_jurnal_perkara) - bukan dashboard/daftar lain.
  if (r11HanyaKasir && typeof globalThis.aletaKasirPasangHarian === "function") {
    const wadahKasir = buatElemen("div", "aleta-mps-massal");
    wadahKasir.setAttribute("data-mps-massal", "kasir-harian");
    isi.appendChild(wadahKasir);
    Promise.resolve()
      .then(() => globalThis.aletaKasirPasangHarian(wadahKasir, { situs: "sipp" }))
      .then((ok) => {
        if (ok === false) wadahKasir.remove();
      })
      .catch(() => wadahKasir.remove());
  }

  panel.appendChild(isi);

  panel.appendChild(kakiPanel({}));

  // Digeser dan diubah ukurannya seperti panel perkara. Panel yang satu bisa
  // dipindahkan dan yang lain tidak terbaca sebagai kerusakan, bukan sebagai
  // dua panel yang berbeda.
  pasangGeser(panel, kepala);
  pasangUbahUkuran(panel);
  // Penjelasan teknis (butir 3 sore) - Baru & UI Baru saja; Lama tanpa jejak.
  if (typeof a30Aktif === "function" && a30Aktif() && typeof mpsPasangTeknis === "function") mpsPasangTeknis(panel);
  // Perbaikan 1 Okt (S, butir 1) - UI Baru saja: lipat seragam panel daftar.
  if (typeof s1TataDaftar === "function" && typeof s1Aktif === "function" && s1Aktif()) s1TataDaftar(panel);
  return panel;
}

/**
 * Bagian antrean di panel daftar, digambar (atau diganti di tempat) SEKETIKA
 * sesudah antreannya disusun. Sebelumnya bagian itu baru muncul sesudah
 * halamannya dimuat ulang, sehingga yang baru menyusun antrean tidak melihat
 * apa pun yang menuntunnya.
 */
async function tampilkanAntreanSipp(wadah) {
  const k = await bagianAntreanSipp("");
  if (!k || !wadah || !wadah.isConnected) return;
  const lama = wadah.querySelector(".aleta-antrean-sipp");
  if (lama) lama.replaceWith(k);
  else wadah.appendChild(k);
}

/**
 * Memilah berkas putusan massal: yang dapat dikirim, yang ditandai beserta
 * sebabnya, dan nomor yang punya lebih dari satu naskah (ganda = jumlahnya).
 *
 * Yang dibaca rute unggah-naskah hanya RTF dan TXT. PDF/DOC/DOCX dahulu
 * diterima pemilih, dikirim utuh, lalu ditolak rutenya - 1.243 nama yang
 * nomornya terbaca di folder unduhan petugas berbentuk itu (diukur 26
 * September 2026). Sekarang ditandai sebelum dikirim.
 */
function pilahBerkasMassal(daftar, bacaNomor, terimaBentukLain) {
  const hasil = Array.from(daftar || []).map((berkas) => {
    const nama = String((berkas && berkas.name) || "");
    const nomor = bacaNomor(nama);
    let tolak = "";
    // terimaBentukLain (Baru & UI Baru, butir 8 perbaikan 30 Sep): DOCX/DOC/PDF
    // diubah menjadi RTF di server sebelum dikirim - lihat bagianMassalBerkas.
    if (!/\.(rtf|txt)$/i.test(nama) && !(terimaBentukLain === true && /\.(docx?|pdf)$/i.test(nama))) {
      const akhiran = (/\.([A-Za-z0-9]{1,5})$/.exec(nama) || [])[1];
      tolak = `${akhiran ? `.${akhiran.toLowerCase()}` : "berkas tanpa akhiran"} tidak dibaca unggah naskah - hanya RTF atau TXT`;
    } else if (namaBerkasAnonim(nama)) {
      tolak = "anonimisasi - yang dikirim naskah putusan aslinya";
    } else {
      tolak = tandaBukanNaskahPutusan(nama);
    }
    return { berkas, nama, nomor, tolak, ganda: 0 };
  });
  const perNomor = new Map();
  for (const p of hasil) if (p.nomor && !p.tolak) perNomor.set(p.nomor, (perNomor.get(p.nomor) || 0) + 1);
  for (const p of hasil) if (p.nomor && !p.tolak && perNomor.get(p.nomor) > 1) p.ganda = perNomor.get(p.nomor);
  return hasil;
}

function bagianMassalBerkas(isi, sesudahSusun) {
  const kotak = buatElemen("div", "aleta-tetap-bagian");
  kotak.appendChild(buatElemen("div", "aleta-tetap-judul", "Putusan massal - dari berkas"));
  kotak.appendChild(
    buatElemen(
      "div",
      "aleta-tetap-sebab aleta-remeh",
      "Pilih beberapa naskah putusan RTF sekaligus. Nomor perkaranya dibaca dari NAMA berkas, " +
        "diperlihatkan untuk diperiksa, lalu tiap naskah disimpan sebagai draf dan masuk antrean. " +
        "Anonimisasi, BAS, PHS/PMH/PPP/PJS, relaas, sampul, dan akta ditandai dan tidak dikirim."
    )
  );
  // ==========================================================================
  // ANTREAN INI MENEKAN SIMPAN SIPP - DAN KINI MENYEBUTNYA
  // ==========================================================================
  //
  // Sejak 2.31.0 antrean dari berkas disusun dengan modus "draf", nilai yang
  // tidak dikenal alatBuatAntrean - dan yang tidak dikenal dahulu menjadi
  // "otomatis". Antrean yang disebut layar sebagai "disimpan sebagai draf"
  // karena itu mengisi borang dan menekan Simpan SIPP sendiri, tanpa satu
  // kalimat pun yang menyebutnya. Modusnya kini dipilih di sini, dan
  // akibatnya tertulis.
  kotak.appendChild(
    buatElemen(
      "div",
      "aleta-tetap-sebab aleta-massal-simpan",
      "Sesudah itu antrean dijalankan di halaman tiap perkara. Otomatis: begitu blangko Putusan Akhir " +
        "perkaranya dibuka, ALETA mengisinya lalu MENEKAN SIMPAN SIPP SENDIRI, satu kali per perkara. " +
        "Manual: ALETA berhenti di tiap perkara, dan tombol “Isi putusan & simpan” yang Anda tekan " +
        "mengisi blangko lalu menekan Simpan SIPP."
    )
  );

  const pemilih = document.createElement("input");
  pemilih.type = "file";
  pemilih.multiple = true;
  // Selaras dengan rute unggah-naskah, yang hanya membaca RTF dan TXT.
  pemilih.accept = ".rtf,.txt";
  // Baru & UI Baru (butir 8): DOCX/DOC/PDF juga - diubah ke RTF lewat K1 dulu.
  const bentukLainA30 = typeof a30Aktif === "function" && a30Aktif();
  if (bentukLainA30) pemilih.accept = A30_TERIMA_NASKAH;
  pemilih.className = "aleta-berkas";
  kotak.appendChild(pemilih);

  const pilihModus = document.createElement("select");
  pilihModus.className = "aleta-massal-pilih-berkas";
  for (const [nilai, label] of [
    ["otomatis", "Otomatis — ALETA mengisi dan MENEKAN SIMPAN SIPP begitu blangkonya terbuka"],
    ["manual", "Manual — berhenti di tiap perkara; tombol ALETA mengisi lalu menekan Simpan SIPP"],
  ]) {
    const o = document.createElement("option");
    o.value = nilai;
    o.textContent = label;
    pilihModus.appendChild(o);
  }
  kotak.appendChild(pilihModus);

  const daftar = buatElemen("div", "aleta-massal-daftar");
  kotak.appendChild(daftar);

  const tombol = buatElemen("button", "aleta-permintaan-tombol", "Kirim naskah lalu susun antrean");
  tombol.type = "button";
  tombol.disabled = true;
  kotak.appendChild(tombol);

  const kabar = buatElemen("div", "aleta-abt-kabar");
  kotak.appendChild(kabar);

  /** Berkas beserta nomor perkara yang terbaca dari namanya (pilahBerkasMassal). */
  let pasangan = [];
  /** Nomor yang punya lebih dari satu naskah -> naskah yang DIPILIH petugas. */
  const pilihanGanda = new Map();

  /**
   * Nomor perkara dari nama berkas (empat bentuk nyata - nomorDariNamaBerkas),
   * lalu diperiksa sekali lagi dengan POLA_PERKARA, pola nomor perkara yang
   * dipakai seluruh ekstensi: nomor susunan ulang yang tidak berbentuk nomor
   * SIPP lebih baik dilewati daripada dikirim.
   *
   * POLA_PERKARA berbendera /g, dan RegExp berbendera g MENGINGAT posisinya di
   * antara pemanggilan. Tanpa menyetel lastIndex, berkas kedua dicari mulai
   * dari tempat berkas pertama berhenti - dan nomor yang ada tidak ketemu.
   */
  function nomorDariNama(nama) {
    const nomor = nomorDariNamaBerkas(nama);
    if (!nomor) return "";
    POLA_PERKARA.lastIndex = 0;
    const cocok = POLA_PERKARA.exec(nomor);
    return cocok && cocok[1] === nomor ? nomor : "";
  }

  const dikirim = (p) => Boolean(p.nomor) && !p.tolak && (!p.ganda || pilihanGanda.get(p.nomor) === p);

  function gambarDaftar() {
    daftar.textContent = "";
    let cocok = 0;
    for (const p of pasangan) {
      const baris = buatElemen(p.ganda ? "label" : "div", "aleta-massal-baris");
      // Lebih dari satu naskah untuk satu nomor: petugas yang memilih - bukan
      // "yang terakhir menurut abjad", yang benar 2 dari 8 kali.
      if (p.ganda) {
        const pilih = document.createElement("input");
        pilih.type = "radio";
        pilih.name = `aleta-massal-ganda-${p.nomor}`;
        pilih.checked = pilihanGanda.get(p.nomor) === p;
        pilih.addEventListener("change", () => {
          pilihanGanda.set(p.nomor, p);
          gambarDaftar();
        });
        baris.appendChild(pilih);
      }
      baris.appendChild(buatElemen("span", "aleta-massal-nomor", p.berkas.name));
      const teks = !p.nomor
        ? `${p.tolak ? `${p.tolak}; ` : ""}nomor perkara tidak terbaca dari namanya - dilewati`
        : p.tolak
          ? `${p.nomor} · ${p.tolak} - tidak dikirim`
          : p.ganda && !dikirim(p)
            ? `${p.nomor} · ${p.ganda} naskah untuk nomor ini - pilih satu`
            : p.nomor;
      const tanda = buatElemen("span", "aleta-massal-keadaan", teks);
      tanda.classList.add(dikirim(p) ? "aleta-lencana-aman" : "aleta-lencana-mendesak");
      baris.appendChild(tanda);
      daftar.appendChild(baris);
      if (dikirim(p)) cocok += 1;
    }
    tombol.disabled = cocok === 0;
    kabar.className = "aleta-abt-kabar";
    kabar.textContent = `${pasangan.length} berkas dipilih; ${cocok} akan dikirim.`;
  }

  pemilih.addEventListener("change", () => {
    pilihanGanda.clear();
    pasangan = bentukLainA30
      ? pilahBerkasMassal(pemilih.files || [], nomorDariNama, true)
      : pilahBerkasMassal(pemilih.files || [], nomorDariNama);
    gambarDaftar();
  });

  tombol.addEventListener("click", async () => {
    const dikerjakan = pasangan.filter((p) => p.nomor).filter(dikirim);
    if (dikerjakan.length === 0) return;
    tombol.disabled = true;
    pemilih.disabled = true;

    const berhasil = [];
    let gagal = 0;
    let naskahEdocTersimpan = 0;
    // BERURUTAN, dan itu disengaja. Tiap berkas dikirim utuh ke peladen lalu
    // diurai di sana; mengirim dua puluh sekaligus berarti dua puluh naskah
    // berada di memori peladen pada saat yang sama. Yang ditunggu orang di
    // sini pengunggahan sekali seumur hari, bukan tiap kali layar dibuka.
    // 9 Okt 2026: dilaporkan ke latar.js - tombol Perbarui ditahan selama
    // naskah masih dikirim (alatAntreanKerja). Tiap butir bertangkap sendiri,
    // jadi tidak ada yang lolos melewati selesai() di bawah perulangan.
    const laporBerkas =
      typeof alatAntreanKerja === "function"
        ? alatAntreanKerja("unggah-naskah-massal", "unggah naskah putusan massal", dikerjakan.length)
        : null;
    for (let i = 0; i < dikerjakan.length; i += 1) {
      const p = dikerjakan[i];
      if (laporBerkas) laporBerkas.maju(i, dikerjakan.length);
      kabar.textContent = `Mengirim ${i + 1} dari ${dikerjakan.length}: ${p.berkas.name}…`;
      try {
        let naskahKirim = p.berkas;
        if (bentukLainA30 && a30PerluKeRtf(p.berkas.name)) {
          kabar.textContent = `Mengubah ${i + 1} dari ${dikerjakan.length} menjadi RTF: ${p.berkas.name}…`;
          const ubah = await a30KonversiNaskah(p.berkas, "rtf");
          if (!ubah.ok) throw new Error(ubah.pesan);
          naskahKirim = ubah.berkas;
        }
        const badan = new FormData();
        badan.append("berkas", naskahKirim);
        badan.append("nomorPerkara", p.nomor);
        // perkaraId TIDAK dikirim - ia tidak diketahui dari berkas, dan rute
        // naskah memang membolehkannya kosong. Menebaknya berarti menautkan
        // draf ke perkara yang salah.
        const respons = await alatAmbil(
          ALETA_API_UNGGAH_NASKAH,
          { method: "POST", body: badan, credentials: "include", batasMs: BATAS_UNGGAH_NASKAH_MS },
          "Mengirim naskah putusan"
        );
        if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Mengirim naskah putusan"));
        const luar = await respons.json();
        const jawab = luar && luar.data ? luar.data : luar;
        if (!jawab || !jawab.ok) throw new Error((jawab && jawab.sebab) || "naskahnya tidak dapat dibaca");
        berhasil.push({ nomor: p.nomor, perkaraId: "", jenis: "" });
        // Butir 6 (6 Okt, Baru & UI Baru): naskah aslinya disimpan di peramban
        // ini supaya antrean dapat mengunggah edoc putusan + anonimisasinya di
        // halaman perkara (a30OpsiEdocMassal). Gagal menyimpan tidak menggagalkan draf.
        if (bentukLainA30 && typeof a30SimpanNaskahEdoc === "function") {
          if (await a30SimpanNaskahEdoc(p.nomor, p.berkas, naskahKirim)) naskahEdocTersimpan += 1;
        }
      } catch (galat) {
        gagal += 1;
        alatCatat("massal-galat", `${p.nomor}: ${String((galat && galat.message) || galat)}`, "");
      }
    }
    if (laporBerkas) laporBerkas.selesai();

    pemilih.disabled = false;
    tombol.disabled = false;

    if (berhasil.length === 0) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = `Tidak satu pun naskah tersimpan. ${gagal} gagal - lihat catatan.`;
      return;
    }

    const modus = pilihModus.value === "manual" ? "manual" : "otomatis";
    // Antrean lama yang belum selesai tidak diganti diam-diam (alatBolehGantiAntrean).
    if (!(await alatBolehGantiAntrean("berkas putusan"))) {
      kabar.className = "aleta-abt-kabar";
      kabar.textContent =
        `${berhasil.length} draf tersimpan` +
        (gagal ? `, ${gagal} gagal` : "") +
        ". Antrean lama dipertahankan - antrean baru tidak disusun.";
      return;
    }
    const antrean = alatBuatAntrean({
      tanggalSidang: "",
      tahap: "sipp",
      asal: "berkas",
      modus,
      butir: berhasil,
    });
    await alatSimpanAntrean(antrean);
    alatCatat("massal", `antrean SIPP disusun dari ${berhasil.length} berkas (${modus})`, "");
    kabar.className = "aleta-abt-kabar";
    kabar.textContent =
      `${berhasil.length} draf tersimpan dan masuk antrean` +
      (gagal ? `, ${gagal} gagal` : "") +
      `. Mode ${modus}: ` +
      (modus === "otomatis"
        ? "ALETA menekan Simpan SIPP sendiri begitu blangko Putusan Akhir tiap perkara dibuka. "
        : "tombol ALETA di tiap perkara mengisi blangko lalu menekan Simpan SIPP. ") +
      (bentukLainA30
        ? `Sesudah tiap putusan tersimpan, edoc putusan dan edoc anonimisasinya ikut diunggah (${naskahEdocTersimpan} dari ${berhasil.length} naskah siap untuk edoc). `
        : "") +
      `Buka perkara pertamanya - ${berhasil[0].nomor} - di SIPP; panel antrean akan menuntun sisanya.`;
    if (typeof sesudahSusun === "function") sesudahSusun();
  });

  isi.appendChild(kotak);
  return kotak;
}

/*
 * ============================================================================
 * FITUR 2 - ANTREAN PUTUSAN SIPP DARI TANGGAL SIDANG, TANPA LEWAT ABT
 * ============================================================================
 *
 * Draf putusan tiap perkara sudah ada di ALETA - dari naskah yang diunggah
 * lewat panel perkara, atau dari tahap ABT sebelumnya. Yang belum ada hanya
 * cara mengerjakannya BERURUTAN untuk seluruh perkara yang bersidang pada
 * satu tanggal, tanpa membuka jadwal, mencatat nomornya, lalu mengetik satu
 * per satu.
 *
 * Bagian ini menyusun antreannya; yang menjalankannya bagianAntreanSipp yang
 * sama dengan lanjutan dari ABT - satu mesin, dua pintu masuk. Sebelum masuk
 * antrean, draf tiap perkara diperiksa: yang belum punya draf tidak dijanjikan
 * akan diisi, melainkan disebut apa adanya dan dilewati.
 */
function bagianMassalSipp(sesudahSusun) {
  const kotak = bagian("Putusan massal · SIPP", "putusanMassalSipp", true);
  const isi = kotak.isi;
  const keadaan = { tanggal: alatTanggalIso(new Date()), sidang: [], draf: new Map() };

  isi.appendChild(
    buatElemen(
      "div",
      "aleta-tetap-sebab aleta-remeh",
      "Perkara yang bersidang pada tanggal ini dan sudah punya draf putusan di ALETA disusun menjadi antrean. " +
        "Tidak ada yang tercentang sendiri; yang sudah putus tidak ditawarkan."
    )
  );
  isi.appendChild(alatPemilihTanggal((t) => {
    keadaan.tanggal = t;
    void muat();
  }));

  const kabar = buatElemen("div", "aleta-abt-kabar");
  isi.appendChild(kabar);
  const daftar = buatElemen("div", "aleta-massal-daftar");
  isi.appendChild(daftar);

  const barisModus = buatElemen("div", "aleta-massal-pilihan");
  const pilihModus = document.createElement("select");
  pilihModus.className = "aleta-massal-pilih-berkas";
  for (const [nilai, label] of [
    ["manual", "Manual — berhenti di tiap perkara; tombol ALETA mengisi lalu menekan Simpan SIPP"],
    ["otomatis", "Otomatis — ALETA mengisi dan MENEKAN SIMPAN SIPP begitu blangkonya terbuka"],
  ]) {
    const o = document.createElement("option");
    o.value = nilai;
    o.textContent = label;
    pilihModus.appendChild(o);
  }
  barisModus.appendChild(pilihModus);
  isi.appendChild(barisModus);

  const aksi = buatElemen("div", "aleta-abt-aksi");
  const tombolSusun = buatElemen("button", "aleta-permintaan-tombol", "Susun antrean");
  tombolSusun.type = "button";
  tombolSusun.disabled = true;
  aksi.appendChild(tombolSusun);
  isi.appendChild(aksi);

  const centangPer = new Map();
  // Perbaikan 2 Okt (S, butir 3) - UI Baru saja: blangko utama di atas daftar
  // dan pengecualian per perkara (s2BlangkoMassal). Lahir pada muat pertama.
  let s2Blangko = null;

  async function adaDraf(nomor) {
    if (keadaan.draf.has(nomor)) return keadaan.draf.get(nomor);
    let hasil = { ada: false, sebab: "belum diperiksa" };
    try {
      const respons = await alatAmbil(
        `${ALETA_API_ISIAN_PUTUSAN}?nomorPerkara=${encodeURIComponent(nomor)}`,
        { credentials: "include", cache: "no-store" },
        "Memeriksa draf putusan"
      );
      if (respons.ok) {
        const luar = await respons.json();
        const d = luar && luar.data ? luar.data : luar;
        // ==================================================================
        // JAWABANNYA DISIMPAN UTUH, BUKAN DIBUANG
        // ==================================================================
        //
        // Rute ini memulangkan SELURUH draf - bukan jawaban ya/tidak.
        // Sebelumnya isinya dibuang dan hanya { ada, sebab } yang disimpan,
        // lalu pengisian borang menariknya LAGI utuh. Dua tarikan untuk satu
        // draf yang sama, dan tarikan keduanya justru yang ditunggu petugas.
        hasil = { ada: Boolean(d && d.ada), sebab: (d && d.sebab) || "", isi: d || null };
      } else {
        hasil = { ada: false, sebab: alatPesanGagal(null, respons.status, "Memeriksa draf putusan") };
      }
    } catch (galat) {
      hasil = { ada: false, sebab: String((galat && galat.message) || galat) };
    }
    keadaan.draf.set(nomor, hasil);
    return hasil;
  }

  /**
   * Menjalankan kerja atas banyak butir, BERBARENGAN tetapi terbatas.
   *
   * Enam sekaligus, bukan seluruhnya. Dua puluh permintaan serentak ke SIPP
   * lewat satu gerbang menukar menunggu dengan menumpuk - dan yang menumpuk
   * membuat permintaan lain di layar yang sama ikut tertahan, termasuk yang
   * sedang ditunggu orang lain.
   *
   * Urutan pemanggilannya tidak dijamin; yang menuntut urutan harus
   * menuliskan hasilnya ke tempatnya sendiri, bukan menumpuknya berurutan.
   */
  async function berbarenganTerbatas(daftar, sekaligus, kerja) {
    const butir = Array.from(daftar);
    let berikut = 0;
    async function pekerja() {
      for (;;) {
        const i = berikut;
        berikut += 1;
        if (i >= butir.length) return;
        await kerja(butir[i], i);
      }
    }
    const jumlah = Math.max(1, Math.min(sekaligus, butir.length));
    await Promise.all(Array.from({ length: jumlah }, () => pekerja()));
  }

  async function muat() {
    daftar.textContent = "";
    centangPer.clear();
    tombolSusun.disabled = true;
    kabar.className = "aleta-abt-kabar";
    kabar.textContent = `Membaca sidang ${keadaan.tanggal}…`;
    // Perbaikan 1 Okt (S, butir 13 & 14) - UI Baru saja: jadwal dibaca utuh
    // (alasan tunda, majelis), hanya sidang yang PUTUS atau DITUNDA UNTUK
    // putusan/musyawarah yang ditawarkan, dan Admin melihatnya per hakim.
    const s1Massal = typeof s1Aktif === "function" && s1Aktif() && typeof s1SidangPadaTanggal === "function";
    let s1Lain = [];
    try {
      keadaan.sidang = s1Massal ? await s1SidangPadaTanggal(keadaan.tanggal) : await alatSidangPadaTanggal(keadaan.tanggal);
    } catch (galat) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = String((galat && galat.message) || galat);
      return;
    }
    if (keadaan.sidang.length === 0) {
      kabar.textContent = `Tidak ada sidang pada ${keadaan.tanggal}.`;
      return;
    }
    if (s1Massal) {
      const saring = s1SaringPutusanMassal(keadaan.sidang);
      keadaan.sidang = saring.layak;
      s1Lain = saring.lain;
      if (keadaan.sidang.length === 0) {
        kabar.textContent = `${s1Lain.length} perkara bersidang pada ${keadaan.tanggal}; tidak satu pun yang putus atau ditunda untuk putusan / musyawarah majelis.`;
        daftar.appendChild(s1RingkasTidakIkut(s1Lain));
        return;
      }
    }
    const belum = keadaan.sidang.filter((s) => !s.sudahPutus);
    kabar.textContent = `${keadaan.sidang.length} perkara bersidang; ${belum.length} belum putus. Memeriksa draf…`;
    if (s1Massal && typeof s2BlangkoMassal === "function") {
      if (!s2Blangko) {
        s2Blangko = s2BlangkoMassal();
        isi.insertBefore(s2Blangko.akar, daftar);
      }
      await s2Blangko.siap();
      s2Blangko.mulai();
    }
    if (s1Massal) {
      kabar.textContent =
        `${keadaan.sidang.length} perkara putus / ditunda untuk putusan (dari ${keadaan.sidang.length + s1Lain.length} yang bersidang); ` +
        `${belum.length} belum putus. Memeriksa draf…`;
    }

    const gambarBaris = (s, wadahBaris) => {
      const label = buatElemen("label", "aleta-massal-baris");
      const centang = document.createElement("input");
      centang.type = "checkbox";
      centang.className = "aleta-massal-centang";
      centang.disabled = true;
      label.appendChild(centang);
      label.appendChild(buatElemen("span", "aleta-massal-nomor", s.nomor));
      label.appendChild(buatElemen("span", "aleta-massal-keadaan", [s.jenis || "jenis tidak terbaca", s.agenda].filter(Boolean).join(" · ")));
      const tanda = buatElemen("span", "aleta-massal-keadaan", s.sudahPutus ? "sudah putus" : "memeriksa draf…");
      if (s.sudahPutus) tanda.classList.add("aleta-lencana-aman");
      label.appendChild(tanda);
      // UI Baru: sebab perkara ini ikut (putus / ditunda untuk putusan).
      if (s1Massal && s.s1Sebab) label.appendChild(buatElemen("span", "aleta-massal-keadaan aleta-s1-sebab", s.s1Sebab));
      (wadahBaris || daftar).appendChild(label);
      // UI Baru (butir 3): blangko perkara ini + tombol "Blangko berbeda…".
      if (s2Blangko && !s.sudahPutus) s2Blangko.pasangBaris(s, wadahBaris || daftar);
      centangPer.set(s.nomor, { centang, sidang: s, tanda });
      return centang;
    };
    let s1Pengendali = null;
    if (s1Massal) {
      s1Pengendali = s1GambarDaftarMassal(daftar, keadaan.sidang, gambarBaris, s1Lain);
    } else {
      for (const s of keadaan.sidang) gambarBaris(s, daftar);
    }

    // ========================================================================
    // DIPERIKSA BERBARENGAN, ENAM SEKALIGUS
    // ========================================================================
    //
    // Dahulu berurutan, dengan komentar yang menyebutnya "satu permintaan
    // ringan per perkara". Ringan ia tidak: rutenya memulangkan SELURUH draf.
    // Pada dua puluh perkara yang masing-masing memakan setengah detik, itu
    // sepuluh detik menunggu sebelum satu baris pun dapat dicentang.
    //
    // Hasilnya tetap dituliskan ke barisnya masing-masing begitu tiba,
    // sehingga daftarnya terisi berangsur seperti sediakala - yang berubah
    // hanya kecepatannya, bukan cara membacanya.
    let siap = 0;
    await berbarenganTerbatas(belum, 6, async (s) => {
      const d = await adaDraf(s.nomor);
      const t = centangPer.get(s.nomor);
      if (!t) return;
      if (d.ada) {
        t.centang.disabled = false;
        t.tanda.textContent = "draf ada";
        siap += 1;
      } else {
        t.tanda.textContent = d.sebab ? `tanpa draf: ${d.sebab}` : "belum ada draf";
        t.tanda.classList.add("aleta-lencana-mendesak");
        t.centang.title = "Unggah naskah putusannya dahulu di panel perkara, atau kerjakan lewat tahap ABT.";
      }
    });
    kabar.textContent = `${keadaan.sidang.length} perkara bersidang; ${belum.length} belum putus; ${siap} punya draf dan dapat dicentang.`;
    if (s1Pengendali && typeof s1Pengendali.segarkan === "function") s1Pengendali.segarkan();
    tombolSusun.disabled = siap === 0;
  }

  tombolSusun.addEventListener("click", async () => {
    const dipilih = [...centangPer.values()]
      .filter((x) => x.centang.checked && !x.centang.disabled)
      .map((x) => x.sidang);
    if (dipilih.length === 0) {
      kabar.textContent = "Tidak ada yang dicentang.";
      return;
    }
    // Antrean lama yang belum selesai tidak diganti diam-diam (alatBolehGantiAntrean).
    if (!(await alatBolehGantiAntrean(`jadwal sidang ${keadaan.tanggal}`))) {
      kabar.textContent = "Antrean lama dipertahankan - antrean baru tidak disusun.";
      return;
    }
    const antrean = alatBuatAntrean({
      tanggalSidang: keadaan.tanggal,
      tahap: "sipp",
      asal: "sidang",
      modus: pilihModus.value,
      kering: false,
      butir: dipilih.map((s) => ({ nomor: s.nomor, perkaraId: s.perkaraId, jenis: s.jenis })),
    });
    // UI Baru (butir 3): blangko tiap butir (utama atau pengecualiannya) ikut antrean.
    if (s2Blangko) await s2Blangko.terapkan(antrean);
    await alatSimpanAntrean(antrean);
    alatCatat("massal", `antrean SIPP disusun dari sidang ${keadaan.tanggal}: ${dipilih.length} perkara (${pilihModus.value})`, "");
    kabar.textContent =
      `Antrean ${dipilih.length} perkara disusun (${pilihModus.value}). Buka perkara pertama - ${dipilih[0].nomor} - lalu tab Putusan; ` +
      "bagian “Putusan massal · lanjutan SIPP” akan memandu tiap langkahnya.";
    tombolSusun.disabled = true;
    if (typeof sesudahSusun === "function") sesudahSusun();
  });

  // Dimuat saat dibuka, bukan saat panel digambar - sama seperti menu malas
  // lainnya: yang membuka panel daftar belum tentu hendak memutus massal.
  const kepala = kotak.querySelector(".aleta-bagian-judul");
  let sudah = false;
  if (kepala) {
    kepala.addEventListener("click", () => {
      if (sudah) return;
      sudah = true;
      void muat();
    });
  }
  // Dipanggil menu per peran (Baru & UI Baru, mpsBukaBagian) bila bagian ini
  // terbuka sebagai bawaan - tanpa ini ia terbentang tetapi kosong. Lama tidak
  // pernah memanggilnya; hanya properti, DOM-nya tidak berubah.
  kotak.muat = () => {
    if (sudah) return;
    sudah = true;
    void muat();
  };
  return kotak;
}

/** Akun yang boleh Kasir, di Baru/UI Baru, sedang di daftar jurnal? */
function r11DaftarHanyaKasir() {
  return r11HalamanJurnalDaftar() && typeof a30Aktif === "function" && a30Aktif() && a30BolehKasir();
}

/** Menu massal halaman daftar perkara / dashboard SIPP, atau null. */
function mpsMenuDaftar() {
  if (!mpsSiapMatriks()) return null;
  try {
    const menu = alatMenuPeran("sipp", "daftar", r11PenggunaMenu());
    return Array.isArray(menu) ? menu.slice() : null;
  } catch {
    return null;
  }
}

/** Panel daftar tidak lewat a30Tata: penandanya disapu sendiri, juga isi yang lahir belakangan. */
function mpsPasangTeknis(panel) {
  mpsTandaiTeknis(panel);
  let jadwal = 0;
  new MutationObserver(() => {
    if (jadwal) return;
    jadwal = setTimeout(() => {
      jadwal = 0;
      if (panel.isConnected && a30Aktif()) mpsTandaiTeknis(panel);
    }, 0);
  }).observe(panel, { childList: true, subtree: true });
}

// ─── Halaman daftar perkara / dashboard ──────────────────────────────────────

/** Bagian pertama terbuka sebagai bawaan (lipatan tersimpan menang); memuat isinya bila perlu. */
function mpsBukaBagian(kotak) {
  if (!kotak || !kotak.dataset) return;
  const kunci = kotak.dataset.kunci || "";
  const kepala = kotak.querySelector(":scope > .aleta-bagian-judul");
  const isi = kotak.querySelector(":scope > .aleta-bagian-isi");
  if (!kepala || !isi) return;
  const tersimpan = typeof lipatanTersimpan !== "undefined" && lipatanTersimpan ? lipatanTersimpan[kunci] : undefined;
  if (typeof tersimpan !== "boolean" && isi.style.display === "none") terapkanLipatan(kepala, isi, false);
  if (isi.style.display !== "none" && typeof kotak.muat === "function") kotak.muat();
}

/**
 * Menu massal menurut matriks, urut kiri->kanan = atas->bawah. BAS massal (M)
 * dan Relaas & PBT massal (J) digambar berkasnya masing-masing ke wadah yang
 * disiapkan di sini; bila berkasnya belum termuat, dilewati tanpa error.
 */
function mpsSusunDaftar(panel, isi, ringkasan, menu) {
  panel.setAttribute("data-mps-peran", typeof alatGolonganMenu === "function" ? alatGolonganMenu(r11PenggunaMenu()) : alatGolonganPeran(mpsPeran()));
  panel.setAttribute("data-mps-menu", menu.join(" "));
  let sudahBuka = false;
  const bukaPertama = (kotak) => {
    if (sudahBuka) return;
    sudahBuka = true;
    mpsBukaBagian(kotak);
  };
  for (const kunci of menu) {
    if (kunci === "penetapan-massal") {
      if (!(boleh("penunjukan") && boleh("kerjakan"))) continue;
      const kotak = bagianPenetapanMassal(ringkasan);
      kotak.setAttribute("data-mps-massal", kunci);
      isi.appendChild(kotak);
      bukaPertama(kotak);
    } else if (kunci === "putusan-massal") {
      if (!boleh("data-umum")) continue;
      // Hak unggah putusan (9 Okt 2026) - lapis kedua di atas matriks peran.
      if (typeof alatBolehUnggahPutusan === "function" && alatBolehUnggahPutusan(penggunaTerakhir) === false) continue;
      const wadah = buatElemen("div", "aleta-mps-massal");
      wadah.setAttribute("data-mps-massal", kunci);
      isi.appendChild(wadah);
      const kotak = bagianMassalSipp(() => void tampilkanAntreanSipp(wadah));
      wadah.appendChild(kotak);
      bagianMassalBerkas(wadah, () => void tampilkanAntreanSipp(wadah));
      void bagianAntreanSipp("").then((k) => {
        if (k && wadah.isConnected) wadah.appendChild(k);
      });
      bukaPertama(kotak);
    } else if (kunci === "bas-massal" || kunci === "relaas-pbt-massal") {
      const pasang = kunci === "bas-massal" ? globalThis.aletaBasMassalPasang : globalThis.aletaJurusitaPasangMassal;
      if (typeof pasang !== "function") continue;
      const nama = kunci === "bas-massal" ? "BAS massal" : "Relaas & PBT massal";
      const wadah = buatElemen("div", "aleta-mps-massal");
      wadah.setAttribute("data-mps-massal", kunci);
      isi.appendChild(wadah);
      // Bawaan terbukanya ditentukan berkas pemiliknya (M / J).
      sudahBuka = true;
      Promise.resolve()
        .then(() => pasang(wadah, { situs: "sipp" }))
        .then((ok) => {
          if (ok === false) wadah.remove();
        })
        .catch((galat) => {
          wadah.textContent = "";
          wadah.appendChild(buatElemen("div", "aleta-gagal", `${nama} tidak dapat dimuat: ${String((galat && galat.message) || galat)}`));
        });
    }
  }
}

// ─── Butir 1: lipat seragam ──────────────────────────────────────────────────

/** Satu bagian lipat baru: alatLipat (W) bila ada, <details> bila belum. */
function s1Lipat(judul, opsi) {
  const o = opsi || {};
  if (typeof alatLipat === "function") {
    try {
      const l = alatLipat(judul, { kunci: o.kunci, terbuka: o.terbuka, kelas: o.kelas });
      if (l && l.akar && l.isi) return l;
    } catch {
      /* jatuh ke details */
    }
  }
  const akar = buatElemen("details", `aleta-s1-lipat${o.kelas ? ` ${o.kelas}` : ""}`);
  if (o.kunci) akar.setAttribute("data-kunci", o.kunci);
  akar.open = o.terbuka !== false;
  const kepala = buatElemen("summary", "aleta-s1-lipat-kepala", judul);
  const isi = buatElemen("div", "aleta-s1-lipat-isi");
  akar.append(kepala, isi);
  return { akar, kepala, isi, buka: (v) => (akar.open = v === undefined ? !akar.open : Boolean(v)), terbuka: () => akar.open };
}

/** Titik sambung dari susunPanelDaftar (UI Baru): ringkasan daftar dapat dilipat. */
function s1TataDaftar(panel) {
  if (!s1Aktif() || !panel) return;
  panel.setAttribute("data-s1", "ui");
  const isi = panel.querySelector(":scope > .aleta-isi");
  const judul = isi ? isi.querySelector(":scope > .aleta-bagian-judul") : null;
  if (judul && typeof alatLipat === "function") {
    const ringkas = [];
    for (let el = judul.nextElementSibling; el; el = el.nextElementSibling) {
      if (el.hasAttribute("data-kunci") || el.hasAttribute("data-mps-massal") || el.classList.contains("aleta-bagian")) break;
      ringkas.push(el);
    }
    const l = s1Lipat(String(judul.textContent || "").trim(), { kunci: "sipp-daftar-ringkas", terbuka: true });
    l.akar.setAttribute("data-s1-fitur", "daftar-ringkas");
    isi.insertBefore(l.akar, judul);
    for (const el of ringkas) l.isi.appendChild(el);
    judul.remove();
  }
  s1PasangLipat(panel);
  // Perbaikan 2 Okt (S, butir 7): tag peran di kepala menu massal.
  if (typeof s2TataDaftar === "function") s2TataDaftar(panel);
}

// ─── Butir 13 & 14: putusan massal SIPP ──────────────────────────────────────

/** Majelis "A, S.H., M.H., B, S.Ag." -> ["A, S.H., M.H.", "B, S.Ag."]: gelar sesudah koma tetap milik orangnya. */
function s1PecahMajelis(nama) {
  const potong = String(nama || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const orang = [];
  const gelar = (t) =>
    /^(?:[A-Z][A-Za-z]{0,4}\.){1,4}[A-Za-z]{0,4}\.?$/.test(t) || /^(?:S\.?H\.?I?|M\.?H\.?I?|S\.?Ag|M\.?Ag|Lc|MA|M\.?A|S\.?Sy|M\.?Si|S\.?Pd|MH|SH|SHI|MHI)\.?$/i.test(t);
  for (const t of potong) {
    if (orang.length && gelar(t)) orang[orang.length - 1] += `, ${t}`;
    else orang.push(t);
  }
  return orang;
}

function s1KetuaMajelis(nama) {
  return s1PecahMajelis(nama)[0] || "";
}

/** Jadwal sidang satu tanggal, UTUH (alasan tunda, tanggal putusan, majelis) - satu baris per perkara. */
async function s1SidangPadaTanggal(tanggalIso) {
  const q = new URLSearchParams({ dari: tanggalIso, sampai: tanggalIso, batas: "300" });
  const respons = await alatAmbil(`${S1_API_SIDANG}?${q.toString()}`, { credentials: "include", cache: "no-store" }, "Membaca jadwal sidang");
  if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Membaca jadwal sidang"));
  const luar = await respons.json();
  const isi = luar && luar.data ? luar.data : luar;
  if (!isi || isi.available === false) throw new Error((isi && isi.message) || "ALETA belum dapat membaca jadwal sidang.");
  const per = new Map();
  for (const s of Array.isArray(isi.sidang) ? isi.sidang : []) {
    const nomor = String(s.nomorPerkara || "");
    if (!nomor) continue;
    const ketua = s1KetuaMajelis(s.majelisNama);
    const baris = {
      nomor,
      perkaraId: String(s.perkaraId || ""),
      jenis: String(s.jenisPerkara || ""),
      agenda: String(s.agenda || ""),
      sudahPutus: Boolean(s.sudahPutus),
      statusPutusan: String(s.statusPutusan || ""),
      verstek: Boolean(s.verstekPutusan),
      ditunda: Boolean(s.ditunda),
      ikrar: Boolean(s.sidangIkrarTalak),
      jam: String(s.jamSidang || ""),
      alasanDitunda: String(s.alasanDitunda || ""),
      tanggalSidang: String(s.tanggalSidang || tanggalIso).slice(0, 10),
      tanggalPutusan: String(s.tanggalPutusan || "").slice(0, 10),
      majelisNama: String(s.majelisNama || ""),
      // Q3 16 Okt: keadaan putusan (portal lib/keadaan-putusan.ts) untuk pemilihan blangko putusan per keadaan.
      keadaan: Array.isArray(s.keadaanPutusan) ? s.keadaanPutusan.map(String).slice(0, 8) : [],
      pengguna: { id: "", nama: ketua },
    };
    // Dua baris sidang perkara yang sama di satu hari (ditunda lalu
    // dijadwalkan ulang): yang memuat putusan yang mewakili perkaranya.
    const lama = per.get(nomor);
    if (!lama || (!s1Layak(lama).layak && s1Layak(baris).layak)) per.set(nomor, baris);
  }
  return [...per.values()];
}

function s1Layak(s) {
  try {
    if (typeof aletaMassalAlasanPutusan === "function") return aletaMassalAlasanPutusan(s);
    if (typeof aletaMassalPutusanLayak === "function") return { layak: aletaMassalPutusanLayak(s), jenis: "", sebab: "" };
  } catch {
    /* cadangan */
  }
  return s1AlasanPutusanCadangan(s);
}

/** Butir 13: { layak: [...ber-s1Sebab], lain: [...] }. */
function s1SaringPutusanMassal(daftar) {
  const layak = [];
  const lain = [];
  for (const s of Array.isArray(daftar) ? daftar : []) {
    const n = s1Layak(s);
    if (n && n.layak) layak.push({ ...s, s1Jenis: n.jenis || "", s1Sebab: n.sebab || "" });
    else lain.push(s);
  }
  return { layak, lain };
}

/** Yang tidak ditawarkan disebut, terlipat - bukan didiamkan. */
function s1RingkasTidakIkut(lain) {
  const l = s1Lipat(`${lain.length} perkara bersidang lain tidak ditawarkan`, { kunci: "putusan-massal-sipp-tidak-ikut", terbuka: false });
  l.akar.setAttribute("data-s1-fitur", "massal-tidak-ikut");
  l.isi.appendChild(
    buatElemen(
      "div",
      "aleta-tetap-sebab aleta-remeh",
      "Sidangnya tidak putus dan tidak ditunda untuk putusan / musyawarah majelis (menurut hasil sidang di SIPP)."
    )
  );
  const ul = buatElemen("ul", "aleta-s1-tidak-ikut");
  for (const s of lain) {
    ul.appendChild(buatElemen("li", "", [s.nomor, s.agenda, s.alasanDitunda ? `ditunda: ${s.alasanDitunda}` : ""].filter(Boolean).join(" · ")));
  }
  l.isi.appendChild(ul);
  return l.akar;
}

/**
 * Butir 14: baris antrean digambar per user untuk Admin (M), datar untuk
 * yang lain; Hakim/Ketua melihat perkara majelisnya di atas dan perkara
 * majelis lain terlipat (tetap dapat dicentang). Pulang pengendali M atau null.
 */
function s1GambarDaftarMassal(daftar, sidang, gambarBaris, lain) {
  const golongan = s1Golongan();
  let tampil = sidang;
  let lainMajelis = [];
  if (golongan === "hakim" || golongan === "ketua") {
    const saya = [
      typeof penggunaTerakhir !== "undefined" && penggunaTerakhir ? penggunaTerakhir.nama : "",
      typeof namaPenggunaSipp === "function" ? namaPenggunaSipp() : "",
    ]
      .map((x) => String(x || "").trim())
      .filter(Boolean);
    const milik = (s) => s1PecahMajelis(s.majelisNama).some((o) => saya.some((n) => mpsNamaCocok(n, o)));
    const punyaSaya = saya.length ? sidang.filter(milik) : [];
    if (punyaSaya.length) {
      tampil = punyaSaya;
      lainMajelis = sidang.filter((s) => !punyaSaya.includes(s));
    }
  }
  let pengendali = null;
  // Per user hanya bagi Super Admin & Admin (K4); peran lain tetap urutan jadwal.
  if (golongan === "admin" && typeof aletaMassalKelompokkan === "function" && typeof aletaMassalGambarKelompok === "function") {
    try {
      const kelompok = aletaMassalKelompokkan(tampil, (s) => s.pengguna);
      pengendali = aletaMassalGambarKelompok(daftar, kelompok, {
        peran: mpsPeran(),
        kunciLipat: "putusan-massal-sipp",
        gambarBaris: (s, wadahIsi) => gambarBaris(s, wadahIsi),
        labelPerkara: (s) => s.nomor,
        judul: (pengguna, perkara) => `${pengguna.nama || "Majelis belum tercatat"} · ${perkara.length} perkara`,
        // Perbaikan 2 Okt (S, butir 19 & 7 - opsi K3 milik R): kelompok milik
        // akun yang masuk terbuka, kelompok lain tertutup; kepala bertag peran.
        // Opsi yang tidak dikenal basmassal.js lama diabaikan (perilaku 1 Okt).
        ...(typeof s2Aktif === "function" && s2Aktif()
          ? {
              namaSaya: [
                typeof penggunaTerakhir !== "undefined" && penggunaTerakhir ? penggunaTerakhir.nama : "",
                typeof namaPenggunaSipp === "function" ? namaPenggunaSipp() : "",
              ].filter(Boolean),
              peranLipat: "Hakim",
            }
          : {}),
      });
    } catch {
      pengendali = null;
      daftar.textContent = "";
      for (const s of tampil) gambarBaris(s, daftar);
    }
  } else {
    for (const s of tampil) gambarBaris(s, daftar);
  }
  if (lainMajelis.length) {
    const l = s1Lipat(`Perkara majelis lain (${lainMajelis.length})`, { kunci: "putusan-massal-sipp-majelis-lain", terbuka: false });
    l.akar.setAttribute("data-s1-fitur", "massal-majelis-lain");
    daftar.appendChild(l.akar);
    for (const s of lainMajelis) gambarBaris(s, l.isi);
  }
  if (lain && lain.length) daftar.appendChild(s1RingkasTidakIkut(lain));
  return pengendali;
}
const S2_KUNCI_BLANGKO_MASSAL = "blangkoPutusanMassal";
const S2_BLANGKO_MAKS = 300;

/** Titik sambung dari s1TataDaftar (UI Baru). Bawaan buka menu massal sudah milik mpsSusunDaftar. */
function s2TataDaftar(panel) {
  if (!s2Aktif() || !panel) return;
  panel.setAttribute("data-s2", "ui");
  s2PasangPeran(panel);
}

// ─── Butir 3: blangko utama + pengecualian per perkara (putusan massal SIPP) ──

function s2KunciBerkas(berkas) {
  try {
    if (typeof alatKunciBerkas === "function") return alatKunciBerkas(berkas);
  } catch {
    /* cadangan di bawah */
  }
  return String(berkas || "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Blangko yang dikenal dari pemetaan (petaBlangkoPutusan) - satu per berkas, urut nama. */
function s2BlangkoDikenal(peta) {
  const per = new Map();
  for (const [jenis, b] of Object.entries(peta && typeof peta === "object" ? peta : {})) {
    if (!b || typeof b !== "object" || !b.berkas) continue;
    const kunci = s2KunciBerkas(b.berkas);
    if (!kunci) continue;
    if (!per.has(kunci)) {
      per.set(kunci, {
        kunci,
        blangko: String(b.blangko || ""),
        berkas: String(b.berkas),
        a: String(b.a || ""),
        b: String(b.b || ""),
        d: String(b.d || ""),
        jenis: [],
      });
    }
    per.get(kunci).jenis.push(jenis);
  }
  return [...per.values()].sort((x, y) => x.berkas.localeCompare(y.berkas));
}

function s2SebutBlangko(e) {
  return e ? `${e.blangko ? `${e.blangko} — ` : ""}${e.berkas}` : "";
}

/** Entri yang dibawa antrean / disimpan: tanpa daftar jenis. */
function s2EntriBlangko(e) {
  return e ? { kunci: e.kunci, blangko: e.blangko, berkas: e.berkas, a: e.a, b: e.b, d: e.d } : null;
}

/**
 * Kepala "Blangko utama" + kendali baris. Pulang { akar, siap(), mulai(),
 * untuk(s), pasangBaris(s, wadah), terapkan(antrean) }.
 *
 * Kendali baris = aletaMassalBarisBlangko milik R (K3) bila termuat; belum
 * ada = baris sederhana di sini. Pengecualian berlaku untuk daftar yang
 * sedang tampil (mulai() mengosongkannya tiap daftar digambar ulang) - yang
 * diingat lintas muat hanya blangko utama. Pilihan terakhir disimpan di
 * chrome.storage.local "blangkoPutusanMassal" untuk tahap ABT.
 */
function s2BlangkoMassal() {
  // Perbaikan 2 Okt sore (P, butir 3): status putusan tiap perkara yang tampil
  // (dari jadwal sidang SIPP) - ikut disimpan untuk tahap ABT.
  const k = { peta: {}, dikenal: [], utama: "", per: {}, status: {}, baris: new Map() };
  const akar = buatElemen("div", "aleta-s2-blangko-utama");
  akar.setAttribute("data-s2-fitur", "blangko-utama");
  const barisPilih = buatElemen("label", "aleta-s2-blangko-label");
  barisPilih.appendChild(buatElemen("span", "aleta-s2-blangko-judul", "Blangko utama"));
  const pilih = document.createElement("select");
  pilih.className = "aleta-massal-pilih-berkas aleta-s2-blangko-pilih";
  pilih.disabled = true;
  barisPilih.appendChild(pilih);
  akar.appendChild(barisPilih);
  const ket = buatElemen(
    "div",
    "aleta-tetap-sebab aleta-remeh",
    "Dipakai semua perkara di bawah. Perkara yang putusannya berbeda: tekan “Blangko berbeda…” di barisnya. " +
      "Blangko menentukan draf yang disusun di ABT; draf yang sudah ada di ALETA tidak diubah."
  );
  akar.appendChild(ket);

  /**
   * Blangko utama untuk perkara ini: baris pemetaan KHUSUS status putusannya
   * (Pemetaan blangko > Putusan > per status - perbaikan 2 Okt sore, butir 3),
   * lalu pilihan kepala, lalu pemetaan jenisnya.
   */
  const petaPerkara = (s) => {
    const nomor = String((s && s.nomor) || "");
    const st = k.status[nomor] || {};
    const status = String((s && s.statusPutusan) || st.statusPutusan || "");
    const verstek = Boolean(s && s.verstek) || Boolean(st.verstek);
    // T 13 Okt: kumulasi perkara (SIPP + petitum) ikut menentukan blangko putusan. Q3 16 Okt: keadaan putusan juga.
    if (typeof alatPetaUntukPerkara === "function") return alatPetaUntukPerkara(k.peta, s && s.jenis, status, verstek, s && s.kumulasi, (s && s.keadaan && s.keadaan.length ? s.keadaan : st.keadaan) || []);
    const jenis = typeof alatKunciJenis === "function" ? alatKunciJenis(s && s.jenis) : String((s && s.jenis) || "").toLowerCase();
    return k.peta[jenis] ? { baris: k.peta[jenis], kunci: jenis, tingkat: "jenis" } : null;
  };
  const entriDari = (b) => (b && b.berkas ? k.dikenal.find((e) => e.kunci === s2KunciBerkas(b.berkas)) || null : null);
  const utamaUntuk = (s) => {
    const h = petaPerkara(s);
    if (h && h.tingkat !== "jenis" && entriDari(h.baris)) return entriDari(h.baris);
    if (k.utama) return k.dikenal.find((e) => e.kunci === k.utama) || null;
    return h ? entriDari(h.baris) : null;
  };
  const efektif = (s) => k.per[String((s && s.nomor) || "")] || utamaUntuk(s);
  /** Bentuk yang dikenal aletaMassalBarisBlangko: nilai + label; sisanya milik ALETA. */
  const objek = (e) => (e ? { ...s2EntriBlangko(e), nilai: e.kunci, label: s2SebutBlangko(e) } : null);
  const simpan = () => {
    const per = {};
    for (const [nomor, e] of Object.entries(k.per).slice(-S2_BLANGKO_MAKS)) per[nomor] = s2EntriBlangko(e);
    const status = {};
    for (const [nomor, x] of Object.entries(k.status).slice(-S2_BLANGKO_MAKS)) status[nomor] = x;
    t7Tulis({ [S2_KUNCI_BLANGKO_MASSAL]: { utama: k.utama, perkara: per, status, diubah: new Date().toISOString() } });
  };
  const segarkanSemua = () => {
    for (const f of k.baris.values()) f();
  };

  const siap = (async () => {
    try {
      k.peta = typeof alatMuatPetaBlangko === "function" ? (await alatMuatPetaBlangko()) || {} : {};
    } catch {
      k.peta = {};
    }
    // Perbaikan 2 Okt sore (P, butir 1 & 3): pemetaan PUTUSAN server (per jenis
    // dan per status) diterapkan di atas peta peramban - di memori saja; tahap
    // ABT menerapkannya lagi saat memuat peta lengkapnya (token diambil di sana).
    if (typeof alatPemetaanBlangko === "function" && typeof alatTerapkanPemetaanServer === "function") {
      try {
        alatTerapkanPemetaanServer(k.peta, await alatPemetaanBlangko("putusan"), null);
      } catch {
        /* server dan simpanan tak terbaca: peta peramban apa adanya */
      }
    }
    k.dikenal = s2BlangkoDikenal(k.peta);
    const s = await t7Baca([S2_KUNCI_BLANGKO_MASSAL]);
    const lama = s[S2_KUNCI_BLANGKO_MASSAL] && typeof s[S2_KUNCI_BLANGKO_MASSAL] === "object" ? s[S2_KUNCI_BLANGKO_MASSAL] : {};
    k.utama = k.dikenal.some((e) => e.kunci === lama.utama) ? String(lama.utama) : "";
    pilih.textContent = "";
    const bawaan = document.createElement("option");
    bawaan.value = "";
    bawaan.textContent = "menurut jenis perkara (pemetaan blangko)";
    pilih.appendChild(bawaan);
    for (const e of k.dikenal) {
      const o = document.createElement("option");
      o.value = e.kunci;
      o.textContent = s2SebutBlangko(e);
      pilih.appendChild(o);
    }
    pilih.value = k.utama;
    pilih.disabled = k.dikenal.length === 0;
    if (k.dikenal.length === 0) {
      ket.textContent = "Belum ada pemetaan blangko di peramban ini - petakan dulu di panel ABT (Putusan massal › pemetaan blangko).";
    }
  })();
  pilih.addEventListener("change", () => {
    k.utama = pilih.value;
    simpan();
    segarkanSemua();
  });

  /** Kendali baris sederhana bila aletaMassalBarisBlangko (R) tidak termuat. */
  const barisSendiri = (s) => {
    const baris = buatElemen("div", "aleta-s2-blangko-baris");
    const tanda = buatElemen("span", "aleta-massal-keadaan aleta-s2-blangko-tanda");
    const tombol = buatElemen("button", "aleta-t7-tombol aleta-t7-kecil aleta-s2-blangko-beda", "Blangko berbeda…");
    tombol.type = "button";
    tombol.title = "Pilih blangko lain khusus untuk perkara ini";
    const pilihBaris = document.createElement("select");
    pilihBaris.className = "aleta-massal-pilih-berkas aleta-s2-blangko-perkara";
    pilihBaris.hidden = true;
    const kembali = document.createElement("option");
    kembali.value = "";
    kembali.textContent = "ikuti blangko utama";
    pilihBaris.appendChild(kembali);
    for (const e of k.dikenal) {
      const o = document.createElement("option");
      o.value = e.kunci;
      o.textContent = s2SebutBlangko(e);
      pilihBaris.appendChild(o);
    }
    tombol.disabled = k.dikenal.length === 0;
    const gambar = () => {
      const pengecualian = k.per[s.nomor] || null;
      const e = efektif(s);
      pilihBaris.value = pengecualian ? pengecualian.kunci : "";
      if (pengecualian) {
        tanda.textContent = `Blangko berbeda: ${s2SebutBlangko(pengecualian)}`;
        baris.setAttribute("data-keadaan", "beda");
      } else {
        tanda.textContent = e ? `Blangko utama: ${s2SebutBlangko(e)}` : "Blangko belum dipetakan";
        baris.setAttribute("data-keadaan", "utama");
      }
    };
    tombol.addEventListener("click", (ev) => {
      ev.preventDefault();
      pilihBaris.hidden = !pilihBaris.hidden;
      if (!pilihBaris.hidden && typeof pilihBaris.focus === "function") pilihBaris.focus();
    });
    pilihBaris.addEventListener("change", () => {
      const e = k.dikenal.find((x) => x.kunci === pilihBaris.value) || null;
      // Memilih blangko utamanya sendiri = kembali mengikuti utama.
      const u = utamaUntuk(s);
      if (e && !(u && u.kunci === e.kunci)) k.per[s.nomor] = e;
      else delete k.per[s.nomor];
      pilihBaris.hidden = true;
      simpan();
      gambar();
    });
    baris.append(tanda, tombol, pilihBaris);
    return { baris, gambar };
  };

  const pasangBaris = (s, wadah) => {
    if (!s || !s.nomor || !wadah) return null;
    if (s.statusPutusan) k.status[s.nomor] = { statusPutusan: String(s.statusPutusan), verstek: Boolean(s.verstek), ...(Array.isArray(s.keadaan) && s.keadaan.length ? { keadaan: s.keadaan.slice(0, 8) } : {}) };
    let el = null;
    let gambar = () => {};
    const pembantu = globalThis.aletaMassalBarisBlangko;
    if (typeof pembantu === "function") {
      try {
        el = pembantu(s, {
          blangkoUtama: objek(utamaUntuk(s)),
          daftarBlangko: () => k.dikenal.map(objek),
          label: s.nomor,
          onPilih: (x) => {
            const b = x && x.blangko;
            const e = b && !x.bawaan ? k.dikenal.find((y) => y.kunci === String(b.kunci || b.nilai || s2KunciBerkas(b.berkas))) || null : null;
            if (e) k.per[s.nomor] = e;
            else delete k.per[s.nomor];
            simpan();
          },
        });
      } catch {
        el = null;
      }
      if (el && el.nodeType === 1) {
        const kendali = el.aletaBlangko;
        gambar = () => {
          if (!kendali || typeof kendali.setelUtama !== "function") return;
          kendali.setelUtama(objek(utamaUntuk(s)));
          // Pengecualian yang kini sama dengan utama dilepas pembantu tanpa onPilih.
          const p = typeof kendali.pilihan === "function" ? kendali.pilihan() : null;
          if (p && p.bawaan && k.per[s.nomor]) {
            delete k.per[s.nomor];
            simpan();
          }
        };
      }
    }
    if (!el || el.nodeType !== 1) {
      const sendiri = barisSendiri(s);
      el = sendiri.baris;
      gambar = sendiri.gambar;
      gambar();
    }
    el.setAttribute("data-s2-blangko-nomor", s.nomor);
    wadah.appendChild(el);
    k.baris.set(s.nomor, () => gambar());
    return el;
  };

  /** Daftar baru digambar: pengecualian dan baris lama dilupakan. */
  const mulai = () => {
    k.per = {};
    k.baris.clear();
  };

  /** Blangko tiap butir antrean (pengecualian atau utama) - ikut antrean, pilihan disimpan. */
  const terapkan = async (antrean) => {
    await siap;
    for (const butir of (antrean && antrean.butir) || []) {
      butir.blangko = s2EntriBlangko(efektif(butir));
      butir.blangkoPengecualian = Boolean(k.per[butir.nomor]);
    }
    simpan();
  };

  return { akar, siap: () => siap, mulai, untuk: efektif, pasangBaris, terapkan };
}

(globalThis.__aletaModulSelesai || (globalThis.__aletaModulSelesai = new Set())).add("konten-panel-daftar.js"); // K11-SELESAI
