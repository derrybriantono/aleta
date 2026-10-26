"use strict";

/**
 * ============================================================================
 * PANEL BERANDA ABT (K11)
 * ============================================================================
 *
 * susunPanelMassalAbt (putusan massal, BAS massal) dan semua yang hanya dipakainya di beranda ABT.
 *
 * Potongan UTUH abt.js yang lama (K11, 26 Okt 2026): pernyataannya tidak diubah, hanya dipindahkan. Dimuat
 * modul-malas.js ke dunia terasing yang sama dengan abt.js lewat pekerja latar (chrome.scripting.executeScript),
 * sehingga semua const/let/function tingkat atas tetap satu lingkup bersama abt.js.
 */

const KUNCI_POSISI_MASSAL_ABT = "posisiPanelAbtMassal";

async function susunPanelMassalAbt() {
  const panel = buatElemen("div", "aleta-panel aleta-panel-abt aleta-panel-massal");
  panel.id = PENANDA_MASSAL_ABT;
  panel.setAttribute("data-tema", "gelap");
  const kepala = buatElemen("div", "aleta-kepala");
  // ==========================================================================
  // LOGO DI KEPALA - SAMA DENGAN PANEL SIPP DAN ALETA
  // ==========================================================================
  //
  // Panel ini melayang di atas halaman milik aplikasi lain dan tampilannya
  // menyerupai bagian aplikasi itu sendiri. Logo membuat asalnya terbaca
  // sekilas - siapa yang berbicara di sini - tanpa perlu membaca tulisan apa
  // pun. Panel SIPP dan ALETA sudah memasangnya sejak lama; ABT satu-satunya
  // yang tidak, dan itulah yang membuat ketiganya terasa tiga aplikasi.
  //
  // Diukur pada berkasnya: konten.js 2 pemakaian aleta-logo, aleta.js 1,
  // abt.js NOL.
  //
  // Dibungkus try: di luar konteks ekstensi chrome.runtime tidak ada, dan
  // kepala tanpa logo masih kepala - kepala yang gagal dibangun tidak.
  try {
    const logo = document.createElement("img");
    logo.className = "aleta-logo";
    logo.alt = "";
    logo.src = chrome.runtime.getURL("ikon/aleta-32.png");
    logo.addEventListener("error", () => logo.remove());
    kepala.appendChild(logo);
  } catch {
    /* tanpa logo, kepala tetap utuh */
  }
  kepala.appendChild(buatElemen("span", "aleta-merek", "ALETA"));
  kepala.appendChild(buatElemen("span", "aleta-kepala-nama", "Putusan massal · ABT"));
  alatTandaiPeranPanel(panel, penggunaAletaAbt && penggunaAletaAbt.peran);
  panel.appendChild(kepala);
  void alatPasangPanel(panel, kepala, KUNCI_POSISI_MASSAL_ABT, {
    kunciTema: KUNCI_TEMA_PANEL,
    temaHalaman: true,
    peran: penggunaAletaAbt && penggunaAletaAbt.peran,
    // Panel halaman depan ABT. × di sini cukup membuangnya untuk kunjungan
    // ini - tanpa menyentuh saklar induk yang mengatur ketiga halaman -
    // sebab ia lahir kembali sendiri begitu halaman depan ABT dibuka lagi.
    judulTutup: "Tutup panel putusan massal - muncul lagi saat halaman depan ABT dibuka",
    saatTutup: () => {
      panel.remove();
      sudahDipasangMassalAbt = false;
    },
  });

  const isi = buatElemen("div", "aleta-isi");
  panel.appendChild(isi);

  const peta = await alatMuatPetaBlangkoLengkap();
  const keadaan = { peta, sidang: [], tanggal: alatTanggalIso(new Date()), berhenti: false, sedangJalan: false };

  isi.appendChild(bagianPetaBlangkoAbt(keadaan));
  // Keputusan 9 Okt 2026: putusan massal (unggah ke SIPP) hanya Hakim
  // (termasuk Ketua/Wakil), Admin, Super Admin - penggunaAletaAbt sudah
  // terbaca (pasangMassalAbt menunggunya). Pemetaan blangko tetap.
  if (abtTolakUnggahPutusan()) {
    abtPasangKotakTerkunci(isi);
  } else {
    isi.appendChild(bagianMassalAbt(keadaan));
  }

  // ==========================================================================
  // KAKI YANG SAMA DENGAN PANEL SIPP, ALETA, DAN PERKARA ABT
  // ==========================================================================
  //
  // Panel ini satu-satunya yang tidak punya kaki: tanpa baris pintasan, tanpa
  // ikon segarkan, tanpa nomor seri. Yang bekerja berpindah antara tiga panel
  // dalam satu jam, dan bagian bawah yang berbeda-beda membuat tiap panel
  // terasa aplikasi yang lain.
  //
  // Nomor seri di kaki bukan hiasan: ketika ada yang melapor, pertanyaan
  // pertama selalu "seri berapa yang terpasang" - dan di panel inilah
  // pemetaan blangko dikerjakan, tempat laporan paling sering datang.
  //
  // Pintasannya HANYA yang benar-benar bersasaran di panel ini. Menyebut
  // pintasan yang tidak berbuat apa-apa lebih buruk daripada tidak
  // menyebutkannya.
  const kaki = buatElemen("div", "aleta-kaki");
  const barisKaki = buatElemen("div", "aleta-kaki-baris");
  const tekanYangBertulis = (p, pola) => {
    for (const t of Array.from(p.querySelectorAll(".aleta-permintaan-tombol, .aleta-perkakas-aksi"))) {
      if (pola.test(t.textContent || "") && !t.disabled && !t.hidden) {
        t.scrollIntoView({ block: "nearest" });
        t.click();
        return;
      }
    }
  };
  const PINTASAN_MASSAL = [
    {
      tombol: "Alt+A",
      kunci: "a",
      nama: "ciutkan / bentangkan panel",
      jalankan: (p) => alatCiutkan(p, PENANDA_MASSAL_ABT),
    },
    {
      tombol: "Alt+P",
      kunci: "p",
      nama: "periksa dulu - belum dijalankan",
      jalankan: (p) => tekanYangBertulis(p, /periksa dulu/i),
    },
    {
      tombol: "Alt+R",
      kunci: "r",
      nama: "ambil token dari ABT",
      jalankan: (p) => tekanYangBertulis(p, /ambil token dari abt|pemetaan ulang/i),
    },
    {
      tombol: "Alt+Enter",
      kunci: "Enter",
      nama: "jalankan putusan massal",
      jalankan: (p) => tekanYangBertulis(p, /^jalankan$/i),
    },
  ];
  barisKaki.appendChild(alatBarisPintasan(PINTASAN_MASSAL));
  alatPasangPintasan(PENANDA_MASSAL_ABT, PINTASAN_MASSAL);

  const segar = buatElemen("button", "aleta-kaki-segar", "↻");
  segar.type = "button";
  segar.setAttribute("aria-label", "Segarkan");
  segar.title = "Segarkan - menyusun ulang panel dan membaca ulang pemetaan. Halaman ABT tidak dimuat ulang.";
  segar.addEventListener("click", () => {
    segar.disabled = true;
    segar.classList.add("aleta-kaki-segar-jalan");
    const lama = document.getElementById(PENANDA_MASSAL_ABT);
    if (lama) lama.remove();
    void pasangMassalAbt();
  });
  barisKaki.appendChild(segar);

  try {
    const seri = chrome.runtime.getManifest().version;
    if (seri) {
      const versi = buatElemen("span", "aleta-kaki-versi", `v${seri}`);
      versi.title = "Seri ekstensi ALETA yang terpasang.";
      barisKaki.appendChild(versi);
    }
  } catch {
    /* di luar konteks ekstensi */
  }
  kaki.appendChild(barisKaki);
  panel.appendChild(kaki);

  // Pemetaan yang baru bernama - dari popup, atau bawaan cerai - tokennya
  // diambil di latar dari halaman kelompok ABT, lalu daftarnya digambar ulang.
  // Tidak menahan panel: yang membuka panel belum tentu hendak memutus massal.
  // AUDIT-GALAT 18 Okt: ABT yang tidak terjangkau / menjawab bukan-200 membuat
  // pencarian ini menolak. Tanpa .catch, tiap pembukaan beranda ABT menambah satu
  // "Uncaught (in promise)" di chrome://extensions. Baris yang belum bertoken
  // tetap bernama saja; tombol "Ambil token dari ABT" mengulanginya.
  void lengkapiTokenPeta(keadaan.peta, () => {})
    .then((terisi) => {
      if (terisi > 0 && keadaan.gambarPeta) keadaan.gambarPeta();
      if (terisi > 0 && keadaan.muatDaftar) void keadaan.muatDaftar();
    })
    .catch((galat) => {
      alatCatat("massal-galat", `token blangko belum terambil: ${String((galat && galat.message) || galat)}`, "");
    });
  return panel;
}

/* ─── Editor pemetaan blangko ──────────────────────────────────────────── */
function bagianPetaBlangkoAbt(keadaan) {
  const kotak = buatElemen("div", "aleta-bagian");
  const judul = buatElemen("div", "aleta-bagian-judul-statis", "Pemetaan blangko putusan");
  kotak.appendChild(judul);
  const sebab = buatElemen(
    "div",
    "aleta-tetap-sebab aleta-remeh",
    "Jenis perkara → blangko ABT mana yang dipakai. Buka kelompok blangkonya di halaman ini, " +
      "lalu pilih berkasnya dari daftar di bawah; tokennya dibaca dari tautan yang ABT sendiri buat."
  );
  kotak.appendChild(sebab);

  // ==========================================================================
  // YANG SUDAH SELESAI TIDAK PERLU DIPANDANGI SETIAP HARI
  // ==========================================================================
  //
  // Pemetaan adalah pekerjaan sekali jadi: sesudah satu jenis punya berkas dan
  // token, tidak ada lagi yang perlu diputuskan tentangnya. Tetapi barisnya
  // tetap berdiri di paling atas panel, dan pada satker dengan belasan jenis
  // perkara ia mendorong PUTUSAN MASSAL - pekerjaan hariannya - jauh ke bawah
  // layar.
  //
  // Karena itu baris yang lengkap disembunyikan, dan bila SELURUHNYA lengkap
  // bagian ini menyingkir sama sekali, menyisakan satu tombol untuk
  // membukanya kembali. Disembunyikan, bukan dibuang: yang tersimpan tetap
  // utuh dan satu tekanan mengembalikannya.
  const ringkas = buatElemen("div", "aleta-tetap-sebab");
  ringkas.hidden = true;
  kotak.appendChild(ringkas);

  const buka = buatElemen("button", "aleta-perkakas-aksi", "Pemetaan ulang");
  buka.type = "button";
  buka.hidden = true;
  buka.title = "Menampilkan kembali seluruh baris pemetaan, termasuk yang sudah selesai.";
  buka.addEventListener("click", () => {
    keadaan.petaTampilSemua = true;
    gambar();
  });
  kotak.appendChild(buka);

  const tabel = buatElemen("div", "aleta-massal-peta");
  kotak.appendChild(tabel);
  let barisAksiRef = null;

  const berkasDiSini = berkasBlangkoDiHalaman();

  const gambar = () => {
    tabel.textContent = "";
    const jenisSemua = new Set(ALAT_JENIS_LAZIM.map(alatKunciJenis));
    for (const k of Object.keys(keadaan.peta)) jenisSemua.add(k);
    for (const s of keadaan.sidang) if (s.jenis) jenisSemua.add(alatKunciJenis(s.jenis));

    let jumlahLengkap = 0;
    let jumlahSemua = 0;
    for (const kunci of [...jenisSemua].sort()) {
      jumlahSemua += 1;
      // Dihitung dua kali - sekali di sini untuk memutuskan tampil atau tidak,
      // sekali lagi di bawah untuk menyusun tulisannya. Menghitungnya sekali
      // lalu menyimpannya justru membuat keduanya dapat berselisih.
      const sudah = keadaan.peta[kunci] && alatBlangkoLengkap(keadaan.peta[kunci]);
      if (sudah) jumlahLengkap += 1;
      if (sudah && !keadaan.petaTampilSemua) continue;
      const baris = buatElemen("div", "aleta-perkakas-baris");
      const label = kunci.includes("|") && typeof alatSebutKunciPeta === "function"
        ? alatSebutKunciPeta(kunci, keadaan.peta[kunci])
        : ALAT_JENIS_LAZIM.find((x) => alatKunciJenis(x) === kunci) || (keadaan.peta[kunci] && keadaan.peta[kunci].jenisAsli) || kunci;
      const namaJenis = buatElemen("span", "aleta-perkakas-nama", label);
      // Nama lain yang menunjuk baris ini disebut pada judulnya. Tanpa itu,
      // yang mencari "Pengesahan Perkawinan/Istbat Nikah" - nama yang dipakai
      // SIPP pada 403 perkara - tidak menemukan barisnya dan menyimpulkan
      // jenisnya belum didukung.
      const lain = alatNamaLainJenis(kunci);
      if (lain.length > 0) namaJenis.title = `Termasuk nama SIPP: ${lain.join("; ")}`;
      baris.appendChild(namaJenis);
      const ada = keadaan.peta[kunci];
      // Tiga keadaan, disebut apa adanya: lengkap (token ada), bernama saja
      // (token belum diambil - dicari sendiri saat kelompoknya terbaca), belum.
      const lengkap = ada && alatBlangkoLengkap(ada);
      const bernama = ada && alatBlangkoTerpetakan(ada);
      const nilai = buatElemen(
        "span",
        `aleta-perkakas-nilai${lengkap ? "" : " aleta-massal-belum"}`,
        lengkap
          ? `${ada.blangko ? `${ada.blangko} — ` : ""}${ada.berkas}`
          : bernama
            ? `${ada.berkas} — token belum diambil${ada.catatan ? ` (${ada.catatan})` : ""}`
            : "belum dipetakan"
      );
      baris.appendChild(nilai);

      // Nama berkas dapat diketik langsung - untuk blangko yang ada di ABT
      // peladen tetapi belum terbuka di halaman ini.
      const ketik = buatElemen("button", "aleta-perkakas-pulih", "Ketik");
      ketik.type = "button";
      ketik.title = "Ketik nama berkas blangko; tokennya dicari sendiri dari halaman kelompok ABT.";
      ketik.addEventListener("click", () => bukaKetikNama(kunci, label, ada));
      baris.appendChild(ketik);

      const pilih = buatElemen("button", "aleta-perkakas-pulih", "Pilih");
      pilih.type = "button";
      pilih.title = berkasDiSini.length
        ? "Pilih berkas blangko dari halaman ini untuk jenis perkara ini."
        : "Buka kelompok blangkonya lebih dulu (klik salah satu blangko di kiri), lalu tekan Pilih.";
      pilih.disabled = berkasDiSini.length === 0;
      pilih.addEventListener("click", () => bukaPemilihBerkas(kunci, label));
      baris.appendChild(pilih);

      if (ada) {
        const hapus = buatElemen("button", "aleta-perkakas-pulih", "Hapus");
        hapus.type = "button";
        hapus.addEventListener("click", async () => {
          delete keadaan.peta[kunci];
          await alatSimpanPetaBlangko(keadaan.peta);
          alatCatat("massal", `pemetaan blangko dihapus: ${label}`, "");
          gambar();
        });
        baris.appendChild(hapus);
      }
      tabel.appendChild(baris);
    }

    // Jenis yang belum ada di daftar dapat ditambah sendiri.
    const tambah = buatElemen("div", "aleta-massal-tambah");
    const masukan = document.createElement("input");
    masukan.type = "text";
    masukan.className = "aleta-abt-ketik";
    masukan.placeholder = "Jenis perkara lain…";
    const tombol = buatElemen("button", "aleta-perkakas-aksi", "Tambah baris");
    tombol.type = "button";
    tombol.addEventListener("click", () => {
      const k = alatKunciJenis(masukan.value);
      if (!k) return;
      if (!keadaan.peta[k]) keadaan.peta[k] = { jenisAsli: masukan.value.trim() };
      masukan.value = "";
      gambar();
    });
    tambah.appendChild(masukan);
    tambah.appendChild(tombol);
    tabel.appendChild(tambah);

    // ========================================================================
    // TIGA KEADAAN BAGIAN INI, DISEBUT APA ADANYA
    // ========================================================================
    //
    //   tuntas  - seluruh jenis punya token; bagiannya menyingkir, sisa tombol
    //   sebagian- yang selesai disembunyikan, sisanya tetap dikerjakan
    //   terbuka - pengguna menekan "Pemetaan ulang", semuanya tergambar
    //
    // Angkanya SELALU disebut. Bagian yang hilang tanpa keterangan terbaca
    // sebagai kerusakan, bukan sebagai pekerjaan yang sudah selesai.
    const tuntas = jumlahSemua > 0 && jumlahLengkap === jumlahSemua;
    const semua = Boolean(keadaan.petaTampilSemua);

    judul.hidden = tuntas && !semua;
    sebab.hidden = tuntas && !semua;
    tabel.hidden = tuntas && !semua;
    if (barisAksiRef) barisAksiRef.hidden = tuntas && !semua;

    buka.hidden = semua || !tuntas;
    ringkas.hidden = semua || jumlahLengkap === 0;
    if (!ringkas.hidden) {
      ringkas.textContent = tuntas
        ? `Pemetaan blangko putusan selesai - ${jumlahLengkap} jenis perkara sudah bertoken.`
        : `${jumlahLengkap} dari ${jumlahSemua} jenis sudah selesai dan disembunyikan; ` +
          `${jumlahSemua - jumlahLengkap} lagi menunggu.`;
    }

    // Saat semuanya tergambar atas permintaan, jalan kembalinya harus ada -
    // kalau tidak, satu tekanan "Pemetaan ulang" mengunci panel dalam keadaan
    // penuh sampai halaman dimuat ulang.
    if (semua) {
      const tutup = buatElemen("button", "aleta-perkakas-pulih", "Sembunyikan yang selesai");
      tutup.type = "button";
      tutup.addEventListener("click", () => {
        keadaan.petaTampilSemua = false;
        gambar();
      });
      tabel.appendChild(tutup);
    }
  };

  const pemilih = buatElemen("div", "aleta-massal-pemilih");
  pemilih.hidden = true;
  kotak.appendChild(pemilih);

  // Ambil token untuk seluruh baris yang baru bernama - menyusuri kelompok
  // blangko ABT satu per satu; kemajuannya disebut, hasilnya digambar ulang.
  const barisAksi = buatElemen("div", "aleta-abt-aksi");
  const ambil = buatElemen("button", "aleta-perkakas-aksi", "Ambil token dari ABT");
  ambil.type = "button";
  ambil.title = "Mencari tiap berkas yang baru bernama di seluruh kelompok blangko halaman ABT ini.";
  const kabarAmbil = buatElemen("span", "aleta-abt-kabar", "");
  ambil.addEventListener("click", async () => {
    ambil.disabled = true;
    kabarAmbil.textContent = "mencari…";
    try {
      const terisi = await lengkapiTokenPeta(keadaan.peta, (t) => {
        kabarAmbil.textContent = t;
      });
      const belum = Object.values(keadaan.peta).filter((b) => alatBlangkoTerpetakan(b) && !alatBlangkoLengkap(b)).length;
      kabarAmbil.textContent = `${terisi} token terisi${belum ? `, ${belum} berkas tidak ditemukan di ABT ini` : ""}.`;
    } catch (galat) {
      kabarAmbil.textContent = String((galat && galat.message) || galat);
    }
    ambil.disabled = false;
    gambar();
    if (keadaan.muatDaftar) void keadaan.muatDaftar();
  });
  barisAksi.appendChild(ambil);

  // Isi dari pohon blangko portal: set mana untuk jenis apa sudah diputuskan
  // di portal, isi foldernya dibaca bot di peladen. Sesudah nama terisi,
  // tokennya langsung dicari di ABT ini - satu tekanan, dua pekerjaan.
  const dariPohon = buatElemen("button", "aleta-perkakas-aksi", "Isi dari pohon blangko");
  dariPohon.type = "button";
  dariPohon.title =
    "Mengisi baris yang kosong atau bawaan dengan berkas skenario kabul dari set pohon blangko portal. " +
    "Baris yang pernah Anda sunting tidak disentuh.";
  dariPohon.addEventListener("click", async () => {
    dariPohon.disabled = true;
    kabarAmbil.textContent = "membaca pohon blangko dari portal…";
    try {
      const set = await alatAmbilPohonBlangko("");
      keadaan.pohon = set;
      const terisi = alatIsiPetaDariPohon(keadaan.peta, set, {});
      await alatSimpanPetaBlangko(keadaan.peta);
      alatCatat("massal", `pemetaan diisi dari pohon blangko: ${terisi.length} jenis`, terisi.map((x) => `${x.jenis} → ${x.berkas}`).join("; "));
      gambar();
      kabarAmbil.textContent = terisi.length
        ? `${terisi.length} jenis terisi dari pohon - mencari tokennya di ABT…`
        : "Tidak ada baris yang perlu diisi - semua sudah bernama atau pohonnya kosong.";
      if (terisi.length) {
        const token = await lengkapiTokenPeta(keadaan.peta, (t) => {
          kabarAmbil.textContent = t;
        });
        kabarAmbil.textContent = `${terisi.length} jenis terisi dari pohon, ${token} token terisi dari ABT.`;
        gambar();
        if (keadaan.muatDaftar) void keadaan.muatDaftar();
      }
    } catch (galat) {
      kabarAmbil.textContent = String((galat && galat.message) || galat);
    }
    dariPohon.disabled = false;
  });
  barisAksi.appendChild(dariPohon);
  barisAksi.appendChild(kabarAmbil);
  kotak.insertBefore(barisAksi, tabel);
  barisAksiRef = barisAksi;

  function bukaKetikNama(kunci, label, ada) {
    pemilih.textContent = "";
    pemilih.hidden = false;
    pemilih.appendChild(buatElemen("div", "aleta-tetap-sebab", `Nama berkas blangko untuk ${label}:`));
    const masukan = document.createElement("input");
    masukan.type = "text";
    masukan.className = "aleta-abt-ketik aleta-massal-ketik";
    masukan.placeholder = "mis. [01] [Kabul Verstek] Cerai (Format Lengkap)";
    masukan.value = (ada && ada.berkas) || "";
    pemilih.appendChild(masukan);
    if (keadaan.pohon) {
      const daftarNama = document.createElement("datalist");
      daftarNama.id = `aleta-pohon-${kunci.replace(/[^a-z0-9]+/g, "-")}`;
      for (const b of alatBerkasPohonUntukJenis(keadaan.pohon, label)) {
        const o = document.createElement("option");
        o.value = b.berkas;
        o.label = `${b.blangko}${b.kategori ? ` · ${b.kategori}` : ""}`;
        daftarNama.appendChild(o);
      }
      masukan.setAttribute("list", daftarNama.id);
      pemilih.appendChild(daftarNama);
    }
    const simpan = buatElemen("button", "aleta-perkakas-aksi", "Simpan nama");
    simpan.type = "button";
    simpan.addEventListener("click", async () => {
      const nama = masukan.value.replace(/\s+/g, " ").trim();
      if (!nama) return;
      // Nama yang berganti melepas token lama - ia milik berkas yang lain.
      keadaan.peta[kunci] = { jenisAsli: label, berkas: nama, bawaan: false };
      await alatSimpanPetaBlangko(keadaan.peta);
      alatCatat("massal", `pemetaan blangko diketik: ${label} → ${nama}`, "");
      pemilih.hidden = true;
      gambar();
      // AUDIT-GALAT 18 Okt: ABT tak terjangkau -> cariTokenBlangko menolak. Dulu
      // galatnya lepas tanpa kabar dan baris kabar membeku di "mencari…".
      let hasil = null;
      try {
        hasil = await cariTokenBlangko(nama, (t) => {
          kabarAmbil.textContent = t;
        });
      } catch (galat) {
        kabarAmbil.textContent = `Token "${nama}" belum terambil: ${String((galat && galat.message) || galat)} - namanya tetap tersimpan.`;
        gambar();
        return;
      }
      if (hasil) {
        keadaan.peta[kunci] = { ...alatRapikanBlangko(hasil), jenisAsli: label, bawaan: false };
        await alatSimpanPetaBlangko(keadaan.peta);
        kabarAmbil.textContent = `token ${label} terisi dari ${hasil.blangko}.`;
      } else {
        keadaan.peta[kunci].catatan = "berkas tidak ditemukan di ABT ini";
        kabarAmbil.textContent = `"${nama}" tidak ditemukan di ABT ini - namanya tetap tersimpan.`;
      }
      gambar();
      if (keadaan.muatDaftar) void keadaan.muatDaftar();
    });
    pemilih.appendChild(simpan);
    const batal = buatElemen("button", "aleta-perkakas-aksi", "Batal");
    batal.type = "button";
    batal.addEventListener("click", () => {
      pemilih.hidden = true;
    });
    pemilih.appendChild(batal);
    masukan.focus();
  }

  function bukaPemilihBerkas(kunci, label) {
    pemilih.textContent = "";
    pemilih.hidden = false;
    pemilih.appendChild(buatElemen("div", "aleta-tetap-sebab", `Berkas untuk ${label} — pilih satu:`));
    for (const b of berkasDiSini) {
      const tombol = buatElemen("button", "aleta-massal-berkas", `${b.blangko} — ${b.berkas}`);
      tombol.type = "button";
      tombol.addEventListener("click", async () => {
        keadaan.peta[kunci] = alatRapikanBlangko({ ...b, jenisAsli: label });
        keadaan.peta[kunci].jenisAsli = label;
        await alatSimpanPetaBlangko(keadaan.peta);
        alatCatat("massal", `pemetaan blangko: ${label} → ${b.blangko} / ${b.berkas}`, "");
        pemilih.hidden = true;
        gambar();
      });
      pemilih.appendChild(tombol);
    }
    const batal = buatElemen("button", "aleta-perkakas-aksi", "Batal");
    batal.type = "button";
    batal.addEventListener("click", () => {
      pemilih.hidden = true;
    });
    pemilih.appendChild(batal);
  }

  keadaan.gambarPeta = gambar;
  gambar();
  return kotak;
}

/* ─── Massal ────────────────────────────────────────────────────────────── */
function bagianMassalAbt(keadaan) {
  const kotak = buatElemen("div", "aleta-bagian");
  kotak.appendChild(buatElemen("div", "aleta-bagian-judul-statis", "Putusan massal"));

  const pemilihTanggal = alatPemilihTanggal((t) => {
    keadaan.tanggal = t;
    void muat();
  });
  kotak.appendChild(pemilihTanggal);

  const kabar = buatElemen("div", "aleta-abt-kabar");
  kotak.appendChild(kabar);

  // ==========================================================================
  // CARI, SARING, URUTKAN
  // ==========================================================================
  //
  // Dua puluh perkara sehari sudah melewati satu layar panel, dan yang dicari
  // hampir selalu sebagian kecilnya: yang agendanya pembacaan putusan, yang
  // blangkonya belum siap, atau satu nomor yang diingat sepotong. Tanpa
  // ketiganya, yang mencari menggulung daftar sambil membaca satu per satu -
  // dan pada gulungan kedua ia berhenti membaca.
  //
  // Yang TERCENTANG tidak pernah hilang karena disaring. Saringan mengubah
  // yang TERLIHAT, bukan yang terpilih; centang yang lenyap diam-diam ketika
  // saringan diganti adalah cara paling halus untuk menjalankan perkara yang
  // tidak dimaksudkan - atau melewatkan yang dimaksudkan.
  const bilah = buatElemen("div", "aleta-massal-bilah");
  const cari = document.createElement("input");
  cari.type = "search";
  cari.className = "aleta-massal-cari";
  cari.placeholder = "Cari nomor, jenis, atau agenda…";
  cari.title = "Menyaring daftar di bawah. Yang sudah dicentang tetap terpilih meski tersembunyi.";
  bilah.appendChild(cari);

  const saring = document.createElement("select");
  saring.className = "aleta-massal-saring";
  saring.title = "Tampilkan hanya sebagian perkara.";
  for (const [nilai, teks] of [
    ["semua", "Semua perkara"],
    ["belum", "Belum putus"],
    ["sudah", "Sudah putus"],
    ["siap", "Blangko siap"],
    ["belumBlangko", "Blangko belum dipetakan"],
    ["dicentang", "Yang dicentang saja"],
  ]) {
    const o = document.createElement("option");
    o.value = nilai;
    o.textContent = teks;
    saring.appendChild(o);
  }
  // Perbaikan 1 Okt butir 13-14 (UI Baru saja): saringan "putus / tunda untuk
  // putusan" menjadi bawaan, dan "Hanya majelis saya" / kelompok per hakim.
  const a1Massal = t6Modern() ? a1PasangMassal(keadaan, saring, bilah) : null;
  bilah.appendChild(saring);

  const urut = document.createElement("select");
  urut.className = "aleta-massal-urut";
  urut.title = "Urutan baris pada daftar.";
  for (const [nilai, teks] of [
    ["putus", "Agenda putusan dahulu"],
    ["nomor", "Nomor perkara"],
    ["jenis", "Jenis perkara"],
    ["keadaan", "Belum putus dahulu"],
  ]) {
    const o = document.createElement("option");
    o.value = nilai;
    o.textContent = teks;
    urut.appendChild(o);
  }
  bilah.appendChild(urut);
  kotak.appendChild(bilah);

  const daftar = buatElemen("div", "aleta-massal-daftar");
  kotak.appendChild(daftar);
  // Perbaikan 2 Okt butir 3 (UI Baru): blangko UTAMA di atas daftar.
  const a2Utama = a1Massal
    ? a2PasangBlangkoUtama(kotak, daftar, keadaan, () => {
        lupakanPemeriksaan("Blangko utama diganti");
        gambarDaftar();
      })
    : null;

  // Pilihan pekerjaan. Unggah ke SIPP MENULIS ke berkas perkara sungguhan dan
  // karena itu diminta secara sadar; unduh menaruh berkas di komputer ini dan
  // juga dinyalakan sendiri. PDF dan anonimisasi hanya DIBUAT bila ada yang
  // memakainya - diunduh atau diunggah - dan yang tidak dibuat disebut apa
  // adanya di ringkasan, bukan dilaporkan "ok".
  const pilihan = buatElemen("div", "aleta-massal-pilihan");
  const saklar = (label, kunci, bawaan, judul) => {
    const l = buatElemen("label", "aleta-massal-baris");
    const c = document.createElement("input");
    c.type = "checkbox";
    c.className = "aleta-massal-centang";
    c.checked = bawaan;
    c.dataset.kunci = kunci;
    l.appendChild(c);
    l.appendChild(buatElemen("span", "aleta-massal-nomor", label));
    if (judul) l.title = judul;
    // Rencananya menyebut rantai pekerjaannya - "RTF → draf → PDF → anonim".
    // Mematikan salah satunya sesudah diperiksa membuat rencana itu berbohong.
    c.addEventListener("change", () => lupakanPemeriksaan("Pilihan pekerjaan berubah"));
    pilihan.appendChild(l);
    return c;
  };
  const cDraf = saklar("Simpan draf ke ALETA", "draf", true, "Amar dan pertimbangan dipotong dari RTF, menjadi draf yang diisikan panel SIPP.");
  const cAnonim = saklar(
    "Anonimisasi",
    "anonim",
    true,
    "ABT menyamarkan nama pihak (RTF). Dibuat hanya bila diunggah ke SIPP atau diunduh."
  );
  const cUnduh = saklar(
    "Unduh berkas ke komputer",
    "unduh",
    false,
    "RTF putusan, PDF-nya, dan anonimisasinya diunduh ke folder unduhan. Dinyalakan sendiri."
  );
  const cPdf = saklar(
    "PDF ikut diunduh",
    "pdf",
    true,
    "Lewat bot ALETA (soffice), hanya untuk unduhan - SIPP menerima RTF apa adanya."
  );
  const cUnggah = saklar("Unggah dokumen ke SIPP", "unggah", false, "RTF putusan dan anonimisasinya ditulis ke berkas perkara SIPP dalam satu kiriman. Dinyalakan sendiri.");
  /** Pilihan yang berlaku SEKARANG - dibaca saat diperiksa dan saat dijalankan. */
  const opsiMassal = () => ({
    draf: cDraf.checked,
    pdf: cPdf.checked,
    anonim: cAnonim.checked,
    unduh: cUnduh.checked,
    unggah: cUnggah.checked,
  });
  kotak.appendChild(pilihan);

  const aksi = buatElemen("div", "aleta-abt-aksi");
  // "kering" istilah pemrogram; yang menekannya panitera. Yang perlu dijawab
  // tombol ini satu: apakah menekannya mengubah sesuatu atau tidak.
  const tombolRencana = buatElemen("button", "aleta-permintaan-tombol", "Periksa dulu - belum dijalankan");
  tombolRencana.type = "button";
  const tombolJalan = buatElemen("button", "aleta-permintaan-tombol", "Jalankan");
  tombolJalan.type = "button";
  tombolJalan.disabled = true;
  tombolJalan.title = "Menyala sesudah hasil pemeriksaan di atas dibaca.";
  const tombolHenti = buatElemen("button", "aleta-perkakas-aksi", "Hentikan");
  tombolHenti.type = "button";
  tombolHenti.hidden = true;
  aksi.appendChild(tombolRencana);
  aksi.appendChild(tombolJalan);
  aksi.appendChild(tombolHenti);
  kotak.appendChild(aksi);

  const neraca = buatElemen("div", "aleta-massal-neraca");
  kotak.appendChild(neraca);

  /**
   * ==========================================================================
   * SUDAH DIPERIKSA - DAN APA SAJA YANG MEMBATALKANNYA
   * ==========================================================================
   *
   * Dua tekanan: Periksa menyusun rencananya tanpa menulis apa pun, Jalankan
   * mengerjakannya. Yang menghubungkan keduanya keadaan ini.
   *
   * Sebelum ada penanda ini, rencana yang sudah tergambar TIDAK pernah
   * kedaluwarsa. Petugas memeriksa empat perkara, lalu mencentang tiga lagi,
   * lalu menekan Jalankan - dan ketujuhnya dikerjakan, sementara yang
   * diperlihatkan kepadanya hanya empat. Hal yang sama terjadi bila blangko
   * satu perkara diganti, atau saklar PDF/anonimisasi dimatikan: rencananya
   * menyebut satu hal, yang dikerjakan hal lain. Penetapan massal di panel
   * SIPP sudah lama menjaga ini; panel ABT belum.
   *
   * Yang TIDAK membatalkan: mencari, menyaring, dan mengurutkan. Ketiganya
   * mengubah yang terlihat, bukan yang terpilih - dan yang dijalankan dibaca
   * dari ingatan, bukan dari baris yang tergambar.
   */
  let sudahDiperiksa = false;

  function lupakanPemeriksaan(sebab) {
    // Selagi berjalan, neraca memuat kemajuan tiap perkara. Mengosongkannya
    // di tengah jalan menghapus satu-satunya keterangan tentang apa yang
    // sudah terjadi pada berkas perkara.
    if (keadaan.sedangJalan) return;
    const perluDikatakan = sudahDiperiksa && Boolean(sebab);
    sudahDiperiksa = false;
    tombolJalan.disabled = true;
    tombolJalan.textContent = "Jalankan";
    tombolJalan.title = "Menyala sesudah hasil pemeriksaan di atas dibaca.";
    tombolRencana.textContent = "Periksa dulu - belum dijalankan";
    neraca.textContent = "";
    if (perluDikatakan) {
      neraca.appendChild(
        buatElemen(
          "div",
          "aleta-tetap-sebab",
          `${sebab} - hasil pemeriksaan tadi tidak berlaku lagi. Tekan "Periksa dulu" sekali lagi.`
        )
      );
    }
  }

  const centangPer = new Map();
  /** Nomor perkara yang dicentang - bertahan meski barisnya tersaring keluar. */
  const dicentang = new Set();
  const ringkasTampil = buatElemen("div", "aleta-massal-ringkas", "");
  bilah.appendChild(ringkasTampil);
  for (const medan of [cari, saring, urut]) {
    medan.addEventListener(medan === cari ? "input" : "change", () => gambarDaftar());
    medan.addEventListener("click", (e) => e.stopPropagation());
  }

  // Blangko KHUSUS per perkara - verstek dan contra adalah dua berkas berbeda
  // untuk satu jenis perkara yang sama. Yang dipilih di baris menang atas
  // pemetaan jenisnya; yang tidak dipilih memakai pemetaan jenis.
  const pilihanPer = new Map();
  // Perbaikan 2 Okt sore (P, butir 3): baris pemetaan KHUSUS status putusan menang atas blangko utama.
  const petaUntuk = (s) =>
    pilihanPer.get(s.nomor) || p3PetaStatus(keadaan, s) || (a2Utama && a2Utama.peta()) || p3PetaJenis(keadaan, s);

  async function muat() {
    daftar.textContent = "";
    neraca.textContent = "";
    centangPer.clear();
    lupakanPemeriksaan("");
    kabar.className = "aleta-abt-kabar";
    kabar.textContent = `Membaca sidang ${keadaan.tanggal}…`;
    try {
      keadaan.sidang = a1Massal ? await a1SidangPadaTanggal(keadaan.tanggal) : await alatSidangPadaTanggal(keadaan.tanggal);
    } catch (galat) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = String((galat && galat.message) || galat);
      return;
    }
    if (keadaan.gambarPeta) keadaan.gambarPeta();
    if (keadaan.sidang.length === 0) {
      kabar.textContent = `Tidak ada sidang pada ${keadaan.tanggal}.`;
      return;
    }
    // Status putusan tiap perkara diingat untuk penamaan berkas - lihat
    // sebutStatusPutusan. Dibaca dari jadwal sidang yang baru saja dimuat,
    // jadi tidak ada permintaan tambahan ke peladen.
    for (const s of keadaan.sidang) {
      statusPutusanPerkara.set(s.nomor, {
        // Jenis perkaranya ikut disimpan sejak 2.20.4: ia bagian tengah nama
        // berkas, dan daftar sidang ini memang sudah memulangkannya. Sebelum
        // ini ia dibuang, lalu tempatnya diisi potongan kepala halaman blangko
        // - yang bukan jenis perkara dan berubah-ubah menurut halamannya.
        jenisPerkara: s.jenis || "",
        statusPutusan: s.statusPutusan || "",
        verstek: Boolean(s.verstek),
      });
    }

    const belumPutus = keadaan.sidang.filter((s) => !s.sudahPutus);
    kabar.textContent =
      `${keadaan.sidang.length} perkara bersidang; ${belumPutus.length} belum putus dan ditawarkan. ` +
      "Tidak ada yang tercentang sendiri.";
    if (a1Massal) a1Massal.saatDimuat(kabar);
    // Perbaikan 2 Okt sore (P, butir 3): status putusan yang dibaca panel SIPP.
    keadaan.statusSipp = await p3BacaStatusSipp();
    // Perbaikan 2 Okt butir 3 (UI Baru): blangko yang dipilih di panel SIPP
    // (agen S, storage blangkoPutusanMassal) dipakai di sini juga.
    if (a2Utama) await a2PakaiBlangkoSipp(keadaan, pilihanPer, a2Utama, kabar);
    gambarDaftar();
    tombolRencana.disabled = false;
  }

  /**
   * ==========================================================================
   * AGENDA YANG MENYEBUT PUTUS BERDIRI DI DEPAN
   * ==========================================================================
   *
   * Pada tanggal sidang mana pun, yang hendak diputus hari itu hanya
   * sebagian - sisanya mediasi, jawaban, pembuktian. Agenda SIPP menyebutnya
   * sendiri ("Pembacaan Putusan", "Musyawarah Majelis - Putusan"), dan itulah
   * satu-satunya petunjuk yang ada sebelum berkasnya dibuka.
   *
   * Ia URUTAN, bukan saringan: agenda tidak dapat dipercaya sebagai penentu -
   * perkara diputus pada agenda yang tertulis "pembuktian" bukan hal aneh -
   * jadi yang lain tetap tergambar, hanya di bawah. Yang memutuskan tetap
   * orang; yang dikerjakan di sini menaruh yang paling mungkin di tempat
   * yang paling dahulu dibaca.
   */
  function agendaPutusan(s) {
    return /putus/i.test(String((s && s.agenda) || ""));
  }

  /** Baris yang TERLIHAT sekarang - hasil pencarian, saringan, dan urutan. */
  function sidangTampil() {
    const kata = String(cari.value || "").trim().toLowerCase();
    const pilihSaring = saring.value || "semua";
    let hasil = keadaan.sidang.slice();

    if (kata) {
      hasil = hasil.filter((s) =>
        [s.nomor, s.jenis, s.agenda].some((x) => String(x || "").toLowerCase().includes(kata))
      );
    }
    if (pilihSaring === "belum") hasil = hasil.filter((s) => !s.sudahPutus);
    else if (pilihSaring === "sudah") hasil = hasil.filter((s) => s.sudahPutus);
    else if (pilihSaring === "siap") hasil = hasil.filter((s) => !s.sudahPutus && alatBlangkoLengkap(petaUntuk(s)));
    else if (pilihSaring === "belumBlangko") hasil = hasil.filter((s) => !s.sudahPutus && !alatBlangkoLengkap(petaUntuk(s)));
    else if (pilihSaring === "dicentang") hasil = hasil.filter((s) => dicentang.has(s.nomor));
    if (a1Massal) hasil = a1Massal.saring(hasil, pilihSaring);

    const nomorUrut = (a, b) => String(a.nomor || "").localeCompare(String(b.nomor || ""), "id", { numeric: true });
    const pilihUrut = urut.value || "putus";
    if (pilihUrut === "nomor") hasil.sort(nomorUrut);
    else if (pilihUrut === "jenis") hasil.sort((a, b) => String(a.jenis || "").localeCompare(String(b.jenis || ""), "id") || nomorUrut(a, b));
    else if (pilihUrut === "keadaan") hasil.sort((a, b) => Number(a.sudahPutus) - Number(b.sudahPutus) || nomorUrut(a, b));
    else hasil.sort((a, b) => Number(agendaPutusan(b)) - Number(agendaPutusan(a)) || Number(a.sudahPutus) - Number(b.sudahPutus) || nomorUrut(a, b));

    return hasil;
  }

  function gambarDaftar() {
    daftar.textContent = "";
    centangPer.clear();
    if (a2Utama) a2Utama.segarkan();
    const tampil = sidangTampil();

    // Yang terpilih tetapi TIDAK terlihat disebut - kalau tidak, menekan
    // Jalankan sesudah menyaring akan mengerjakan perkara yang tidak ada di
    // layar, dan itu persis kejutan yang paling mahal di sini.
    const tersembunyi = [...dicentang].filter((n) => !tampil.some((s) => s.nomor === n)).length;
    ringkasTampil.textContent = tersembunyi
      ? `${tampil.length} dari ${keadaan.sidang.length} tampil · ${dicentang.size} dicentang (${tersembunyi} tidak terlihat)`
      : `${tampil.length} dari ${keadaan.sidang.length} tampil · ${dicentang.size} dicentang`;

    if (tampil.length === 0) {
      daftar.appendChild(buatElemen("div", "aleta-tetap-sebab", "Tidak ada perkara yang cocok dengan pencarian atau saringan ini."));
      return;
    }

    // Perbaikan 1 Okt butir 14 (UI Baru, Admin/Super Admin): baris disusun
    // per hakim ketua majelis - lihat a1Massal.kelompok. null = datar.
    const a1Wadah = a1Massal
      ? a1Massal.kelompok(daftar, tampil, {
          dicentang,
          ubah: (sebab) => {
            lupakanPemeriksaan(sebab);
            gambarDaftar();
          },
        })
      : null;

    for (const s of tampil) {
      const label = buatElemen("label", "aleta-massal-baris");
      const centang = document.createElement("input");
      centang.type = "checkbox";
      centang.className = "aleta-massal-centang";
      centang.disabled = s.sudahPutus;
      // Dipulihkan dari ingatan, bukan dari DOM: barisnya digambar ulang tiap
      // kali saringan berubah, dan tanpa ini tiap pengetikan di kotak cari
      // akan membatalkan seluruh centang.
      centang.checked = dicentang.has(s.nomor);
      centang.addEventListener("change", () => {
        if (centang.checked) dicentang.add(s.nomor);
        else dicentang.delete(s.nomor);
        lupakanPemeriksaan("Centang berubah");
        gambarDaftar();
      });
      label.appendChild(centang);
      label.appendChild(buatElemen("span", "aleta-massal-nomor", s.nomor));
      const peta = petaUntuk(s);
      const ket = [];
      ket.push(s.jenis || "jenis tidak terbaca");
      if (s.agenda) ket.push(s.agenda);
      if (s.ikrar) ket.push("sidang ikrar");
      if (s.ditunda) ket.push("ditunda");
      const keterangan = buatElemen("span", "aleta-massal-keadaan", ket.join(" · "));
      label.appendChild(keterangan);
      const tanda = buatElemen(
        "span",
        `aleta-massal-keadaan ${s.sudahPutus ? "aleta-lencana-aman" : alatBlangkoLengkap(peta) ? "" : "aleta-lencana-mendesak"}`,
        s.sudahPutus ? "sudah putus" : alatBlangkoLengkap(peta) ? `blangko: ${peta.berkas}` : "blangko belum dipetakan"
      );
      label.appendChild(tanda);

      // Pilihan blangko khusus untuk perkara ini.
      if (!s.sudahPutus) {
        const pilih = document.createElement("select");
        pilih.className = "aleta-massal-pilih-berkas";
        pilih.title = "Blangko khusus untuk perkara ini - kosongkan untuk memakai pemetaan jenisnya.";
        const bawaan = document.createElement("option");
        bawaan.value = "";
        bawaan.textContent = "blangko menurut jenis";
        pilih.appendChild(bawaan);
        for (const b of berkasDikenal(keadaan.peta)) {
          const o = document.createElement("option");
          o.value = alatKunciBerkas(b.berkas);
          o.textContent = `${b.blangko ? `${b.blangko} — ` : ""}${b.berkas}${b.a && b.b ? "" : " (token belum)"}`;
          o.dataset.a = b.a || "";
          o.dataset.b = b.b || "";
          o.dataset.d = b.d || "";
          o.dataset.blangko = b.blangko || "";
          o.dataset.berkas = b.berkas;
          pilih.appendChild(o);
        }
        pilih.addEventListener("click", (e) => e.stopPropagation());
        pilih.addEventListener("change", () => {
          const o = pilih.selectedOptions[0];
          if (!o || !o.value) {
            pilihanPer.delete(s.nomor);
          } else {
            pilihanPer.set(
              s.nomor,
              alatRapikanBlangko({ blangko: o.dataset.blangko, berkas: o.dataset.berkas, a: o.dataset.a, b: o.dataset.b, d: o.dataset.d })
            );
          }
          const p = petaUntuk(s);
          tanda.textContent = alatBlangkoLengkap(p) ? `blangko: ${p.berkas}` : "blangko belum siap";
          tanda.className = `aleta-massal-keadaan ${alatBlangkoLengkap(p) ? "" : "aleta-lencana-mendesak"}`;
          lupakanPemeriksaan(`Blangko ${s.nomor} diganti`);
        });
        label.appendChild(pilih);
        // Perbaikan 2 Okt butir 3 (UI Baru): pilihan ini di balik "Blangko berbeda…".
        if (a2Utama) {
          if (pilihanPer.has(s.nomor)) pilih.value = alatKunciBerkas(pilihanPer.get(s.nomor).berkas);
          a2BarisBlangko(label, pilih, s, {
            utama: a2Utama,
            berbeda: pilihanPer.has(s.nomor),
            utamaPerkara: p3PetaStatus(keadaan, s) || (a2Utama && a2Utama.peta()) || p3PetaJenis(keadaan, s),
          });
        }
      }
      label.title = s.sudahPutus
        ? "Sudah ada putusan di SIPP - tidak ditawarkan, supaya tidak ganda."
        : alatBlangkoLengkap(peta)
          ? "Boleh dicentang."
          : "Petakan blangko untuk jenis ini dahulu di atas, atau perkara ini dilewati saat dijalankan.";
      ((a1Wadah && a1Wadah.get(s.nomor)) || daftar).appendChild(label);
      centangPer.set(s.nomor, { centang, sidang: s, tanda });
    }
  }

  /**
   * Yang akan dikerjakan - dibaca dari INGATAN, bukan dari baris yang sedang
   * tergambar. Perkara yang dicentang lalu tersembunyi oleh saringan tetap
   * ikut; jumlahnya disebut pada ringkasan di atas daftar, dan pada hasil
   * pemeriksaan sebelum apa pun dijalankan.
   */
  function yangDicentang() {
    return keadaan.sidang.filter((s) => dicentang.has(s.nomor) && !s.sudahPutus);
  }

  tombolRencana.addEventListener("click", () => {
    const dipilih = yangDicentang();
    neraca.textContent = "";
    if (dipilih.length === 0) {
      neraca.appendChild(buatElemen("div", "aleta-tetap-sebab", "Tidak ada yang dicentang."));
      return;
    }
    neraca.appendChild(buatElemen("div", "aleta-tetap-sebab", `HASIL PEMERIKSAAN - belum ada yang dikerjakan. ${dipilih.length} perkara:`));
    let siap = 0;
    for (const s of dipilih) {
      const peta = petaUntuk(s);
      const baris = buatElemen("div", `aleta-perkakas-baris ${alatBlangkoLengkap(peta) ? "aleta-perkakas-baik" : "aleta-perkakas-buruk"}`);
      baris.appendChild(buatElemen("span", "aleta-perkakas-nama", s.nomor));
      baris.appendChild(
        buatElemen(
          "span",
          "aleta-perkakas-nilai",
          alatBlangkoLengkap(peta)
            ? `${peta.berkas} → ${rantaiMassalAbt(opsiMassal())}`
            : `DILEWATI: blangko untuk "${s.jenis}" belum dipetakan`
        )
      );
      neraca.appendChild(baris);
      if (alatBlangkoLengkap(peta)) siap += 1;
    }
    // ========================================================================
    // KALIMAT YANG MENYURUH MENEKAN JALANKAN
    // ========================================================================
    //
    // Sebelum ini, sesudah diperiksa seluruh yang terlihat berbunyi "belum":
    // tombolnya "Periksa dulu - belum dijalankan", judul hasilnya "belum ada
    // yang dikerjakan". Tidak satu pun menyebut bahwa langkah berikutnya
    // menekan Jalankan - dan satu-satunya petunjuk ada di tooltip tombol itu,
    // yang hanya muncul bila kursor didiamkan di atasnya. Panel ini karena
    // itu terbaca seperti buntu, dan dilaporkan sebagai "tidak bisa dipakai".
    sudahDiperiksa = siap > 0;
    tombolJalan.disabled = siap === 0;
    tombolJalan.textContent = siap ? `Jalankan ${siap} perkara sekarang` : "Jalankan";
    tombolJalan.title = siap ? `Mengerjakan ${siap} perkara berurutan.` : "Tidak ada yang dapat dikerjakan.";
    tombolRencana.textContent = siap ? "Periksa ulang" : "Periksa dulu - belum dijalankan";
    neraca.appendChild(
      buatElemen(
        "div",
        "aleta-tetap-sebab",
        siap
          ? `Belum ada yang ditulis. Tekan "Jalankan ${siap} perkara sekarang" untuk mengerjakannya` +
            (dipilih.length > siap ? `; ${dipilih.length - siap} dilewati karena blangkonya belum dipetakan.` : ".")
          : "Tidak ada yang dapat dikerjakan - blangko perkara yang dicentang belum dipetakan."
      )
    );
  });

  tombolHenti.addEventListener("click", () => {
    // Perkara yang sedang dikerjakan diselesaikan, lalu tidak ada perkara
    // berikutnya - lihat jalankanMassalAbt. Sinyal inilah satu-satunya
    // penanda berhenti; bendera keadaan.berhenti yang dahulu dibaca
    // lingkarannya sudah tidak dibaca siapa pun.
    if (keadaan.pembatal) keadaan.pembatal.abort();
    tombolHenti.textContent = "Menghentikan sesudah perkara ini…";
  });

  tombolJalan.addEventListener("click", async () => {
    // Penjagaan kedua. Tombolnya memang dimatikan tiap kali rencananya basi,
    // tetapi yang menulis ke berkas perkara tidak pantas bergantung pada satu
    // penjagaan saja.
    if (!sudahDiperiksa) return;
    const dipilih = yangDicentang().filter((s) => alatBlangkoLengkap(petaUntuk(s)));
    if (dipilih.length === 0) return;
    // Antrean lama yang belum selesai tidak diganti diam-diam (alatBolehGantiAntrean).
    if (!(await alatBolehGantiAntrean(`tahap ABT sidang ${keadaan.tanggal}`))) {
      neraca.textContent = "Antrean lama dipertahankan - putusan massal ABT tidak dijalankan.";
      return;
    }
    keadaan.sedangJalan = true;
    keadaan.pembatal = new AbortController();
    tombolJalan.disabled = true;
    tombolRencana.disabled = true;
    tombolHenti.hidden = false;
    tombolHenti.textContent = "Hentikan";
    neraca.textContent = "";

    const antrean = alatBuatAntrean({
      tanggalSidang: keadaan.tanggal,
      tahap: "abt",
      asal: "abt",
      kering: false,
      butir: dipilih.map((s) => ({ nomor: s.nomor, perkaraId: s.perkaraId, jenis: s.jenis })),
    });
    await alatSimpanAntrean(antrean);
    alatCatat("massal", `putusan massal ABT dimulai: ${dipilih.length} perkara, sidang ${keadaan.tanggal}`, "");
    // 9 Okt 2026: dilaporkan ke latar.js - tombol "Perbarui ekstensi" ditahan
    // sampai antrean ini berhenti (alatAntreanKerja). Dilepas sesudah
    // perulangan, juga bila ia terhenti oleh lemparan.
    const laporAbt =
      typeof alatAntreanKerja === "function"
        ? alatAntreanKerja("putusan-massal-abt", "putusan massal ABT", antrean.butir.length)
        : null;

    const opsi = opsiMassal();
    const olehUsername = namaPenggunaAbt();

    // Satu baris neraca per perkara, dibuat saat perkara itu mulai disentuh -
    // persiapannya dapat berjalan di dalam jeda sesudah perkara sebelumnya.
    const barisNeraca = new Map();
    const barisUntuk = (butir) => {
      let b = barisNeraca.get(butir.nomor);
      if (!b) {
        const el = buatElemen("div", "aleta-perkakas-baris");
        el.appendChild(buatElemen("span", "aleta-perkakas-nama", butir.nomor));
        const nilai = buatElemen("span", "aleta-perkakas-nilai", "menunggu…");
        el.appendChild(nilai);
        neraca.appendChild(el);
        b = { el, nilai };
        barisNeraca.set(butir.nomor, b);
      }
      return b;
    };

    try {
      await jalankanMassalAbt(antrean.butir, {
        opsi,
        olehUsername,
        petaUntuk,
        sinyalBatal: keadaan.pembatal.signal,
        laporButir: (butir, teks) => {
          barisUntuk(butir).nilai.textContent = teks;
        },
        // Antrean disimpan tiap langkah: keadaannya tetap terbaca walau
        // panelnya dimuat ulang di tengah jalan.
        sesudahLangkah: () => alatSimpanAntrean(antrean),
        sesudahButir: async (butir) => {
          const b = barisUntuk(butir);
          b.el.classList.add(butir.keadaan === "selesai" ? "aleta-perkakas-baik" : "aleta-perkakas-buruk");
          b.nilai.textContent = butir.catatan;
          const tanda = centangPer.get(butir.nomor);
          if (tanda) tanda.tanda.textContent = butir.keadaan === "selesai" ? "selesai" : butir.keadaan === "gagal" ? "gagal" : "dilewati";
          if (laporAbt) {
            const tuntas = antrean.butir.filter((x) => x.keadaan === "selesai" || x.keadaan === "gagal" || x.keadaan === "dilewati").length;
            laporAbt.maju(tuntas, antrean.butir.length);
          }
          await alatSimpanAntrean(antrean);
        },
      });
    } catch (galat) {
      // Tidak ditelan: yang terhenti di tengah disebut di neraca dan di kotak hitam.
      const pesan = String((galat && galat.message) || galat);
      neraca.appendChild(buatElemen("div", "aleta-tetap-sebab aleta-lencana-mendesak", `Putusan massal terhenti: ${pesan}`));
      alatCatat("massal-galat", `putusan massal ABT terhenti: ${pesan}`, "");
    } finally {
      if (laporAbt) laporAbt.selesai();
    }
    await alatSimpanAntrean(antrean);

    const h = alatAntreanRingkas(antrean);
    neraca.appendChild(
      buatElemen(
        "div",
        "aleta-tetap-sebab",
        `Selesai: ${h.selesai} berhasil, ${h.gagal} gagal, ${h.dilewati} dilewati. Rinciannya di kotak hitam (⚙).`
      )
    );
    alatCatat("massal", `putusan massal ABT selesai: ${h.selesai} berhasil, ${h.gagal} gagal, ${h.dilewati} dilewati`, "");

    // Serah terima ke SIPP: drafnya sudah ada, tinggal isian data di borang
    // SIPP. Panel SIPP membaca antrean ini dan menawarkan melanjutkannya.
    if (h.selesai > 0) {
      const serah = buatElemen("div", "aleta-massal-serah");
      serah.appendChild(
        buatElemen(
          "div",
          "aleta-tetap-sebab",
          "Lanjutkan ke SIPP: isian putusan (amar, pertimbangan, status) diisikan ke blangko tiap perkara. " +
            "Otomatis = ALETA menekan Isikan dan Simpan sendiri; Manual = berhenti di tiap perkara supaya Anda periksa dahulu."
        )
      );
      const otomatis = buatElemen("button", "aleta-permintaan-tombol", "Lanjutkan ke SIPP · otomatis");
      otomatis.type = "button";
      const manual = buatElemen("button", "aleta-permintaan-tombol", "Lanjutkan ke SIPP · manual");
      manual.type = "button";
      const serahkan = async (modus) => {
        antrean.tahap = "sipp";
        antrean.modus = modus;
        for (const b of antrean.butir) {
          if (b.keadaan === "selesai") {
            b.keadaan = "menunggu";
            b.catatan = "";
          } else {
            b.keadaan = "dilewati";
          }
        }
        antrean.posisi = 0;
        await alatSimpanAntrean(antrean);
        alatCatat("massal", `antrean diserahkan ke SIPP (${modus})`, "");
        // Antrean SIPP hidup sejak diserahkan - penahan tombol Perbarui ikut.
        if (typeof alatLaporAntreanPutusanSipp === "function") alatLaporAntreanPutusanSipp(antrean);
        window.open(alamatSippDariAbt(), "_blank");
        serah.appendChild(
          buatElemen("div", "aleta-tetap-sebab", "Tab SIPP dibuka. Buka daftar perkara Perdata di sana - panel ALETA akan menawarkan melanjutkan antrean.")
        );
      };
      otomatis.addEventListener("click", () => void serahkan("otomatis"));
      manual.addEventListener("click", () => void serahkan("manual"));
      serah.appendChild(otomatis);
      serah.appendChild(manual);
      neraca.appendChild(serah);
    }

    keadaan.sedangJalan = false;
    keadaan.pembatal = null;
    tombolHenti.hidden = true;
    tombolRencana.disabled = false;
    // Rencananya habis terpakai: menekan Jalankan sekali lagi akan mengulang
    // perkara yang sama - dan yang kedua kalinya menimpa draf serta dokumen
    // yang baru saja dibuat. Hasilnya dibiarkan tampil, jadi keadaannya
    // dikembalikan di sini, bukan lewat lupakanPemeriksaan yang mengosongkan
    // neraca.
    sudahDiperiksa = false;
    tombolJalan.disabled = true;
    tombolJalan.textContent = "Jalankan";
    tombolJalan.title = "Menyala sesudah hasil pemeriksaan di atas dibaca.";
    tombolRencana.textContent = "Periksa dulu - belum dijalankan";
  });

  keadaan.muatDaftar = muat;
  void muat();
  return kotak;
}

/**
 * ============================================================================
 * RANTAI PEKERJAAN SATU PERKARA - DISEBUT SEPERTI YANG SUNGGUH DIKERJAKAN
 * ============================================================================
 *
 * PDF dan anonimisasi hanya dibuat bila ada yang memakainya. Rencana yang
 * menyebut "→ PDF → anonim" padahal hasilnya dibuang adalah rencana yang
 * berbohong - dan itulah yang terjadi sampai 1.167 pada setelan bawaan.
 */

/**
 * Alamat SIPP yang dibuka tombol "Lanjutkan ke SIPP" pada putusan massal ABT.
 *
 * Sampai 26 September 2026 tombolnya membuka `${location.origin}/index.php/dashboard`.
 * Itu SIPP hanya di mesin setempat, tempat SIPP duduk di akar
 * (127.0.0.1/index.php). Di peladen satker SIPP berada di bawah /SIPP/ -
 * lihat manifest.json, yang memasang konten.js hanya pada
 * http://192.168.10.10/SIPP/* dan http://127.0.0.1/index.php/* - jadi
 * tab yang dibuka di kantor adalah alamat di luar SIPP: tanpa panel ALETA,
 * tanpa antrean yang dilanjutkan. Alamat /SIPP/ yang sama dipakai tautan
 * "Buka SIPP" di aleta.js.
 */
function alamatSippDariAbt() {
  if (location.hostname === "127.0.0.1") return `${location.origin}/index.php/dashboard`;
  return `${location.origin}/SIPP/`;
}

function rantaiMassalAbt(opsi) {
  const o = opsi || {};
  const pakaiAnonim = anonimDipakaiAbt(o);
  const rantai = ["RTF"];
  if (o.draf) rantai.push("draf");
  if (pakaiAnonim) rantai.push("anonim");
  if (o.unduh) rantai.push(`unduh (RTF${o.pdf ? ", PDF" : ""}${pakaiAnonim ? ", anonim" : ""})`);
  if (o.unggah) rantai.push(pakaiAnonim ? "SIPP (putusan + anonimisasi)" : "SIPP (putusan)");
  return rantai.join(" → ");
}

/**
 * ============================================================================
 * MENJALANKAN PUTUSAN MASSAL ABT - PERSIAPAN DI DALAM JEDA YANG SUDAH ADA
 * ============================================================================
 *
 * Perkara dikerjakan satu per satu, dan di antara dua perkara tetap ada jeda
 * ALAT_JEDA_MASSAL_MS - gunanya memberi napas peladen di antara dua tulisan
 * ke SIPP. Yang berubah: jeda itu tidak lagi menjadi tunggu yang sia-sia.
 *
 *   dahulu    RTF(i) → … → SIPP(i) → jeda → RTF(i+1) → … → SIPP(n) → jeda
 *   sekarang  RTF(i) → … → SIPP(i) → [jeda ∥ persiapan(i+1)] → SIPP(i+1) → …
 *
 * Persiapan perkara berikutnya (pratinjau ABT, draf, anonim ABT - tidak satu
 * pun menulis ke SIPP) berjalan BERSAMAAN dengan jeda itu. Dua tulisan ke SIPP
 * tetap berselang sekurang-kurangnya ALAT_JEDA_MASSAL_MS, permintaan ke ABT
 * tetap satu per satu (persiapan i+1 baru dimulai sesudah tulisan i rampung),
 * dan tidak ada jeda sesudah perkara terakhir.
 *
 * Hentikan berarti "sesudah perkara ini": persiapan yang sudah berjalan di
 * dalam jeda ditunggu dan DISEBUT - drafnya mungkin sudah tersimpan - tetapi
 * tidak diunggah; sisanya dilewati.
 *
 * @param daftar  butir antrean (dimutasi: keadaan, catatan, dokumen)
 * @param alat    {opsi, olehUsername, petaUntuk, sinyalBatal, laporButir,
 *                 sesudahLangkah, sesudahButir}
 */
async function jalankanMassalAbt(daftar, alat) {
  const a = alat || {};
  const opsi = a.opsi || {};
  const { petaUntuk } = a;
  const laporButir = typeof a.laporButir === "function" ? a.laporButir : () => {};
  const sesudahLangkah = typeof a.sesudahLangkah === "function" ? a.sesudahLangkah : async () => {};
  const sesudahButir = typeof a.sesudahButir === "function" ? a.sesudahButir : async () => {};
  const berhenti = () => Boolean(a.sinyalBatal && a.sinyalBatal.aborted);
  /** Persiapan perkara berikutnya yang sudah berjalan di dalam jeda: {butir, janji}. */
  let berikut = null;

  // Tidak pernah menolak: persiapan yang berjalan di dalam jeda baru ditunggu
  // belakangan, dan penolakan yang belum ditunggu terbaca sebagai galat liar.
  // Galatnya tidak ditelan - ia menjadi kegagalan perkara itu, tersebut di
  // ringkasannya dan di kotak hitam.
  const siapkan = async (butir) => {
    try {
      // Blangko khusus perkara ini bila dipilih, bukan pemetaan jenisnya.
      const peta = petaUntuk(butir);
      return await siapkanPerkaraAbt(butir, peta, opsi, (teks) => laporButir(butir, teks));
    } catch (galat) {
      const pesan = String((galat && galat.message) || galat);
      alatCatat("massal-galat", `${butir.nomor}: persiapan terhenti: ${pesan}`, "");
      return {
        butir,
        dokumen: { rtf: `gagal: ${pesan}` },
        ringkas: [`persiapan gagal: ${pesan}`],
        namaDasar: "",
        isiRtf: null,
        isiAnonim: null,
        ok: false,
      };
    }
  };

  for (let i = 0; i < daftar.length; i += 1) {
    const butir = daftar[i];

    if (berhenti()) {
      if (berikut && berikut.butir === butir) {
        // Persiapannya sudah berjalan di dalam jeda: ditunggu, lalu DISEBUT.
        // Tanpa unggah, persiapan itulah seluruh pekerjaannya - perkara ini
        // memang sudah selesai dikerjakan.
        const siapSisa = await berikut.janji;
        berikut = null;
        const hasilSisa = hasilPerkaraAbt(siapSisa);
        if (opsi.unggah) {
          butir.keadaan = "dilewati";
          butir.catatan = `dihentikan sesudah persiapan, belum diunggah: ${hasilSisa.ringkas}`;
        } else {
          butir.keadaan = hasilSisa.ok ? "selesai" : "gagal";
          butir.catatan = hasilSisa.ringkas;
        }
        butir.dokumen = hasilSisa.dokumen;
        await sesudahButir(butir, siapSisa);
        i += 1;
      }
      for (const lewat of daftar.slice(i)) {
        lewat.keadaan = "dilewati";
        lewat.catatan = "dihentikan";
      }
      await sesudahLangkah(butir);
      break;
    }

    butir.keadaan = "jalan";
    await sesudahLangkah(butir);
    let siap;
    if (berikut && berikut.butir === butir) {
      siap = await berikut.janji;
      berikut = null;
    } else {
      siap = await siapkan(butir);
    }
    if (opsi.unggah && siap.ok) await unggahBerkasAbt(siap, a.olehUsername, (teks) => laporButir(butir, teks));

    const hasil = hasilPerkaraAbt(siap);
    butir.keadaan = hasil.ok ? "selesai" : "gagal";
    butir.catatan = hasil.ringkas;
    butir.dokumen = hasil.dokumen;
    await sesudahButir(butir, siap);

    // Tidak ada jeda sesudah perkara terakhir, dan tidak ada sesudah Hentikan.
    if (i >= daftar.length - 1 || berhenti()) continue;
    // Jeda yang sudah ada - napas peladen di antara dua tulisan ke SIPP - dan
    // persiapan perkara berikutnya berjalan BERSAMAAN di dalamnya.
    const lanjut = daftar[i + 1];
    berikut = { butir: lanjut, janji: siapkan(lanjut) };
    await alatJeda(ALAT_JEDA_MASSAL_MS);
  }
}

/** Semua nama berkas yang dikenal di halaman ini: dari pemetaan dan dari kartu yang tergambar. */
function berkasDikenal(peta) {
  const hasil = new Map();
  for (const b of berkasBlangkoDiHalaman()) hasil.set(alatKunciBerkas(b.berkas), { ...b });
  for (const baris of Object.values(peta)) {
    if (!alatBlangkoTerpetakan(baris)) continue;
    const k = alatKunciBerkas(baris.berkas);
    if (!hasil.has(k) || !hasil.get(k).a) hasil.set(k, { blangko: baris.blangko || "", berkas: baris.berkas, a: baris.a || "", b: baris.b || "", d: baris.d || "" });
  }
  return [...hasil.values()];
}
const SORE_LABEL_MASSAL = Object.freeze({
  "putusan-massal": "Putusan massal",
  "bas-massal": "BAS massal",
  "relaas-pbt-massal": "Relaas & PBT massal",
});

// ─── Beranda ABT: menu massal per peran ─────────────────────────────────────

function soreTataBerandaAman(panel) {
  if (!soreAktif() || !panel) return;
  try {
    soreTataBeranda(panel);
  } catch (galat) {
    t6CatatGalat(galat, "Penataan beranda ABT perbaikan 30 Sep sore gagal");
  }
}

/**
 * Butir 1 (beranda) dan U1-U4. Putusan massal (pemetaan blangko + putusan
 * massal) hanya untuk peran yang menunya memuat "putusan-massal"; BAS massal
 * (globalThis.aletaBasMassalPasang, basmassal.js) dan Relaas & PBT massal
 * (globalThis.aletaJurusitaPasangMassal, jurusita.js) dipasang saat tabnya
 * dibuka pertama kali. Yang fungsinya belum ada dilewati tanpa error. Peran
 * "lain" = susunan lama.
 */
function soreTataBeranda(panel) {
  const isi = t6Anak(panel, "aleta-isi");
  if (!isi) return;
  panel.setAttribute("data-sore", "ya");
  soreTandaiTeknis(panel);
  const peran = sorePeranAktif();
  const menu = soreMenuPeran("daftar", peran, {});
  if (menu === null) return;
  panel.setAttribute("data-sore-golongan", soreGolongan(peran));
  const putusan = Array.from(isi.children).filter((c) => c.classList.contains("aleta-bagian"));
  const fungsi = {
    "bas-massal": globalThis.aletaBasMassalPasang,
    "relaas-pbt-massal": globalThis.aletaJurusitaPasangMassal,
  };
  const tersedia = menu.filter((kunci) => kunci === "putusan-massal" || typeof fungsi[kunci] === "function");
  const nama = t6Anak(t6Anak(panel, "aleta-kepala"), "aleta-kepala-nama");
  if (nama) nama.textContent = tersedia.length === 1 ? `${SORE_LABEL_MASSAL[tersedia[0]]} · ABT` : tersedia.length ? "Kerja massal · ABT" : "Beranda · ABT";

  const wadah = new Map([["putusan-massal", putusan]]);
  for (const el of putusan) el.setAttribute("data-sore-menu", "putusan-massal");
  for (const kunci of tersedia) {
    if (kunci === "putusan-massal") continue;
    const w = soreEl("div", "aleta-sore-massal");
    w.setAttribute("data-sore-menu", kunci);
    isi.appendChild(w);
    wadah.set(kunci, [w]);
  }
  if (!tersedia.length) {
    for (const el of putusan) soreTampakkan(el, false);
    isi.insertBefore(soreEl("div", "aleta-t6-lembut aleta-sore-massal-kosong", "Belum ada menu massal untuk peran Anda di beranda ABT."), isi.firstChild);
    return;
  }
  const terpasang = new Set();
  const tab = new Map();
  const pilih = (kunci) => {
    for (const [kk, daftar] of wadah) for (const el of daftar) soreTampakkan(el, kk === kunci);
    for (const [kk, b] of tab) b.setAttribute("aria-selected", kk === kunci ? "true" : "false");
    if (kunci === "putusan-massal" || terpasang.has(kunci)) return;
    terpasang.add(kunci);
    const w = wadah.get(kunci)[0];
    const gagal = (galat) => w.appendChild(soreEl("div", "aleta-t6-gagal", `${SORE_LABEL_MASSAL[kunci]} gagal dimuat: ${sorePesan(galat)}`));
    try {
      Promise.resolve(fungsi[kunci](w, { situs: "abt" }))
        .then((ok) => {
          if (ok === false && !w.childElementCount) w.appendChild(soreEl("div", "aleta-t6-lembut", `${SORE_LABEL_MASSAL[kunci]} tidak tersedia untuk peran ini.`));
        })
        .catch(gagal);
    } catch (galat) {
      gagal(galat);
    }
  };
  if (t6Modern()) a1JadikanLipatSemua(putusan);
  if (tersedia.length > 1) {
    const bilah = soreEl("div", "aleta-sore-tab");
    bilah.setAttribute("role", "tablist");
    for (const kunci of tersedia) {
      const b = t6Tombol(SORE_LABEL_MASSAL[kunci], "", "aleta-t6-kecil aleta-sore-tab-tombol");
      b.setAttribute("role", "tab");
      b.setAttribute("data-sore-menu", kunci);
      b.addEventListener("click", () => pilih(kunci));
      bilah.appendChild(b);
      tab.set(kunci, b);
    }
    isi.insertBefore(bilah, isi.firstChild);
  }
  pilih(tersedia[0]);
}
const A1_API_SIDANG = "/aleta/api/aleta-ecourt/sidang";

/** Beranda ABT: bagian Pemetaan blangko dan Putusan massal (milik abt.js). */
function a1JadikanLipatSemua(daftar) {
  for (const el of daftar || []) {
    const judul = el.querySelector(".aleta-bagian-judul-statis");
    const nama = t6Baku((judul && judul.textContent) || "bagian").replace(/[^a-z]+/g, "-");
    // Perbaikan 2 Okt butir 19: Putusan massal = utama (terbuka); pemetaan blangko sekunder.
    a1JadikanLipat(el, `abt-beranda:${nama}`, { terbuka: !/^pemetaan/.test(nama) });
  }
}

// ─── Butir 13 dan 14: putusan massal ABT ────────────────────────────────────

/** Nama hakim ketua dari "Ketua, S.H., Anggota, M.H." - gelar tidak dipisah dari namanya. */
function a1KetuaMajelis(majelisNama) {
  const potong = String(majelisNama || "")
    .split(/\s*,\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
  const gelar = (x) => !/\s/.test(x) && x.length <= 8 && (/\./.test(x) || /^(MA|MH|SH|SHI|Lc|MAg|SAg|MSi|MHI)$/i.test(x));
  const orang = [];
  for (const x of potong) {
    if (orang.length && gelar(x)) orang[orang.length - 1] += `, ${x}`;
    else orang.push(x);
  }
  return orang[0] || "";
}

/** Sama dengan alatSidangPadaTanggal (permintaan yang SAMA), ditambah ruas yang dibuangnya. */
async function a1SidangPadaTanggal(tanggalIso) {
  const q = new URLSearchParams({ dari: tanggalIso, sampai: tanggalIso, batas: "300" });
  const respons = await alatAmbil(`${A1_API_SIDANG}?${q.toString()}`, { credentials: "include", cache: "no-store" }, "Membaca jadwal sidang");
  if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Membaca jadwal sidang"));
  const luar = await respons.json();
  const isi = luar && luar.data ? luar.data : luar;
  if (!isi || isi.available === false) throw new Error((isi && isi.message) || "ALETA belum dapat membaca jadwal sidang.");
  const per = new Map();
  for (const s of Array.isArray(isi.sidang) ? isi.sidang : []) {
    const nomor = String(s.nomorPerkara || "");
    if (!nomor || per.has(nomor)) continue;
    const ketua = a1KetuaMajelis(s.majelisNama);
    per.set(nomor, {
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
      tanggalPutusan: String(s.tanggalPutusan || ""),
      majelisNama: String(s.majelisNama || ""),
      // T 13 Okt: kode kumulasi (SIPP + petitum) untuk blangko putusan kumulasi.
      kumulasi: typeof alatKodeKumulasi === "function" ? alatKodeKumulasi(s.kumulasi) : [],
      // Q3 16 Okt: keadaan putusan (portal lib/keadaan-putusan.ts) untuk pemilihan blangko per keadaan.
      keadaan: typeof alatKodeKeadaan === "function" ? alatKodeKeadaan(s.keadaanPutusan) : [],
      pengguna: { id: soreBakuNamaAkun(ketua) || "-", nama: ketua || "Majelis belum tercatat" },
      mentah: s,
    });
  }
  return [...per.values()];
}

/**
 * Butir 13: perkara yang hari itu PUTUS, atau DITUNDA untuk putusan /
 * musyawarah majelis. Keterangan (alasan ditunda) yang menentukan; agenda
 * hanya bila keterangannya belum ada. Fungsi agen M (K4) didahulukan.
 */
function a1PutusanLayak(s, tanggal) {
  if (typeof aletaMassalPutusanLayak === "function") {
    try {
      return Boolean(aletaMassalPutusanLayak({ ...(s.mentah || {}), ...s, keterangan: s.alasanDitunda, tanggalSidang: tanggal }));
    } catch {
      /* fungsi agen M menolak bentuk ini - aturan di bawah yang dipakai */
    }
  }
  if (s.sudahPutus && String(s.tanggalPutusan || "").slice(0, 10) === String(tanggal || "")) return true;
  const ket = String(s.alasanDitunda || "").trim().toLowerCase();
  if (/putus|musyawarah/.test(ket)) return !/belum\s+putus|tidak\s+putus/.test(ket);
  if (!ket || ket === "0") return /putus|musyawarah/i.test(String(s.agenda || ""));
  return false;
}

/** [{pengguna, perkara}] - fungsi agen M bila ada (K4), selain itu per hakim ketua. */
function a1Kelompokkan(daftar) {
  if (typeof aletaMassalKelompokkan === "function") {
    try {
      const h = aletaMassalKelompokkan(daftar, "pengguna");
      if (Array.isArray(h) && h.every((g) => g && g.pengguna && Array.isArray(g.perkara))) {
        return h.map((g) => ({
          pengguna: { id: String(g.pengguna.id || g.pengguna.nama || "-"), nama: String(g.pengguna.nama || "Majelis belum tercatat") },
          perkara: g.perkara,
        }));
      }
    } catch {
      /* bentuk lain - dikelompokkan di sini */
    }
  }
  const peta = new Map();
  for (const s of daftar) {
    const p = s.pengguna || { id: "-", nama: "Majelis belum tercatat" };
    if (!peta.has(p.id)) peta.set(p.id, { pengguna: p, perkara: [] });
    peta.get(p.id).perkara.push(s);
  }
  return [...peta.values()].sort((a, b) => (a.pengguna.id === "-") - (b.pengguna.id === "-") || a.pengguna.nama.localeCompare(b.pengguna.nama, "id"));
}

/** Kelompok per hakim (Admin/Super Admin) - pulang nomor → wadah barisnya. */
function a1GambarKelompok(daftar, tampil, opsi) {
  const peta = new Map();
  // Perbaikan 2 Okt butir 19 + 7: kelompok milik akun yang masuk terbuka
  // (tanpa itu: kelompok pertama), yang lain tertutup; tag peran "Hakim".
  const kelompok = a1Kelompokkan(tampil);
  const namaSaya = soreBakuNamaAkun((penggunaAletaAbt && penggunaAletaAbt.nama) || "");
  const adaMilikSaya = kelompok.some((g) => g.pengguna.id === namaSaya);
  for (const [ke, g] of kelompok.entries()) {
    const layak = g.perkara.filter((s) => !s.sudahPutus);
    const nCentang = layak.filter((s) => opsi.dicentang.has(s.nomor)).length;
    let akar = null;
    let isi = null;
    if (typeof alatLipat === "function") {
      try {
        const terbuka = adaMilikSaya ? g.pengguna.id === namaSaya : ke === 0;
        const l = alatLipat(g.pengguna.nama, { kunci: `abt-massal-hakim:${g.pengguna.id}`, terbuka, lencana: String(g.perkara.length), peran: "Hakim" });
        akar = l && l.akar;
        isi = l && l.isi;
      } catch {
        akar = null;
      }
    }
    if (!akar || !isi) {
      akar = buatElemen("div", "aleta-a1-kelompok");
      akar.appendChild(buatElemen("div", "aleta-a1-kelompok-kepala", `${g.pengguna.nama} · ${g.perkara.length} perkara`));
      isi = buatElemen("div", "aleta-a1-kelompok-isi");
      akar.appendChild(isi);
    }
    akar.classList.add("aleta-a1-kelompok");
    akar.setAttribute("data-a1-pengguna", g.pengguna.id);
    const semua = buatElemen("label", "aleta-massal-baris aleta-a1-kelompok-semua");
    const c = document.createElement("input");
    c.type = "checkbox";
    c.className = "aleta-massal-centang";
    c.checked = layak.length > 0 && nCentang === layak.length;
    c.indeterminate = nCentang > 0 && nCentang < layak.length;
    c.disabled = layak.length === 0;
    semua.appendChild(c);
    semua.appendChild(buatElemen("span", "aleta-massal-nomor", `Kerjakan semua milik ${g.pengguna.nama}`));
    semua.appendChild(buatElemen("span", "aleta-massal-keadaan", `${nCentang} dari ${layak.length} dicentang`));
    c.addEventListener("change", () => {
      for (const s of layak) {
        if (c.checked) opsi.dicentang.add(s.nomor);
        else opsi.dicentang.delete(s.nomor);
      }
      opsi.ubah(`Centang milik ${g.pengguna.nama} berubah`);
    });
    isi.appendChild(semua);
    daftar.appendChild(akar);
    for (const s of g.perkara) peta.set(s.nomor, isi);
  }
  return peta;
}

/**
 * Pemasang butir 13-14 di bagian Putusan massal (UI Baru). Pulang kait yang
 * dipanggil bagianMassalAbt: saatDimuat, saring, kelompok.
 */
function a1PasangMassal(keadaan, saring, bilah) {
  const golongan = soreGolongan(sorePeranAktif());
  const admin = golongan === "admin";
  const namaAkun = soreBakuNamaAkun((penggunaAletaAbt && penggunaAletaAbt.nama) || "");
  const opsi = document.createElement("option");
  opsi.value = "layak";
  opsi.textContent = "Putus / tunda untuk putusan";
  saring.insertBefore(opsi, saring.firstChild);
  saring.value = "layak";
  let milik = null;
  if (!admin && (golongan === "hakim" || golongan === "ketua") && namaAkun.length >= 4) {
    const l = buatElemen("label", "aleta-a1-milik");
    milik = document.createElement("input");
    milik.type = "checkbox";
    milik.className = "aleta-massal-centang";
    milik.checked = true;
    l.appendChild(milik);
    l.appendChild(buatElemen("span", "", "Hanya majelis saya"));
    l.title = "Perkara yang majelisnya memuat nama akun Anda. Matikan untuk melihat seluruh majelis.";
    bilah.appendChild(l);
    milik.addEventListener("change", () => saring.dispatchEvent(new Event("change")));
  }
  const punyaSaya = (s) => ` ${soreBakuTeks(s.majelisNama)} `.includes(` ${namaAkun} `);
  return {
    saatDimuat(kabar) {
      const layak = keadaan.sidang.filter((s) => a1PutusanLayak(s, keadaan.tanggal));
      let teks =
        `${keadaan.sidang.length} perkara bersidang; ${layak.length} putus atau ditunda untuk putusan/musyawarah - hanya itu yang ditampilkan ` +
        "(saringan \"Semua perkara\" menampilkan seluruhnya). Tidak ada yang tercentang sendiri.";
      if (milik) {
        const n = keadaan.sidang.filter(punyaSaya).length;
        if (!n && milik.checked) {
          milik.checked = false;
          teks += " Nama Anda tidak terbaca di majelis perkara mana pun pada tanggal ini - seluruh majelis ditampilkan.";
        }
      }
      if (admin) teks += " Dikelompokkan per hakim ketua majelis.";
      kabar.textContent = teks;
    },
    saring(hasil, pilihSaring) {
      let h = hasil;
      if (pilihSaring === "layak") h = h.filter((s) => a1PutusanLayak(s, keadaan.tanggal));
      if (milik && milik.checked) h = h.filter(punyaSaya);
      return h;
    },
    kelompok(daftar, tampil, o) {
      return admin ? a1GambarKelompok(daftar, tampil, o) : null;
    },
  };
}

// ─── Butir 3: blangko utama + "Blangko berbeda…" pada putusan massal ────────

/**
 * Bilah "Blangko utama" di atas daftar putusan massal (UI Baru). Pulang
 * { peta() -> baris blangko | null, segarkan(), nama() }. Kosong = blangko
 * menurut pemetaan jenis (perilaku 1.177.0).
 */
function a2PasangBlangkoUtama(kotak, acuan, keadaan, saatGanti) {
  const bilah = buatElemen("label", "aleta-massal-baris aleta-a2-utama");
  bilah.appendChild(buatElemen("span", "aleta-massal-nomor", "Blangko utama"));
  const pilih = document.createElement("select");
  pilih.className = "aleta-massal-pilih-berkas aleta-a2-utama-pilih";
  pilih.title = "Blangko yang dipakai semua perkara yang dicentang. Perkara yang putusannya berbeda: tombol \"Blangko berbeda…\" di barisnya.";
  bilah.appendChild(pilih);
  kotak.insertBefore(bilah, acuan);
  let terpilih = null;
  const segarkan = () => {
    const nilai = pilih.value;
    pilih.textContent = "";
    const bawaan = document.createElement("option");
    bawaan.value = "";
    bawaan.textContent = "menurut pemetaan jenis perkara";
    pilih.appendChild(bawaan);
    for (const b of berkasDikenal(keadaan.peta || {})) {
      const o = document.createElement("option");
      o.value = alatKunciBerkas(b.berkas);
      o.textContent = `${b.blangko ? `${b.blangko} — ` : ""}${b.berkas}${b.a && b.b ? "" : " (token belum)"}`;
      o.dataset.a = b.a || "";
      o.dataset.b = b.b || "";
      o.dataset.d = b.d || "";
      o.dataset.blangko = b.blangko || "";
      o.dataset.berkas = b.berkas;
      pilih.appendChild(o);
    }
    pilih.value = Array.from(pilih.options).some((o) => o.value === nilai) ? nilai : "";
    if (!pilih.value) terpilih = null;
  };
  pilih.addEventListener("click", (e) => e.stopPropagation());
  pilih.addEventListener("change", () => {
    const o = pilih.selectedOptions[0];
    terpilih = o && o.value ? alatRapikanBlangko({ blangko: o.dataset.blangko, berkas: o.dataset.berkas, a: o.dataset.a, b: o.dataset.b, d: o.dataset.d }) : null;
    saatGanti();
  });
  segarkan();
  return {
    peta: () => terpilih,
    segarkan,
    nama: () => (terpilih ? terpilih.berkas : "blangko menurut jenis"),
    pilih,
    /** Dipilih dari luar (blangko utama panel SIPP) - hanya bila belum dipilih di sini. */
    setelBila: (kunci) => {
      if (terpilih || !kunci) return false;
      segarkan();
      const o = Array.from(pilih.options).find((x) => x.value && x.value === alatKunciBerkas(kunci));
      if (!o) return false;
      pilih.value = o.value;
      terpilih = alatRapikanBlangko({ blangko: o.dataset.blangko, berkas: o.dataset.berkas, a: o.dataset.a, b: o.dataset.b, d: o.dataset.d });
      return true;
    },
  };
}

/** chrome.storage.local "blangkoPutusanMassal" (panel SIPP, agen S): { utama, perkara: {nomor: blangko} }. */
const A2_KUNCI_BLANGKO_SIPP = "blangkoPutusanMassal";

/**
 * Blangko putusan massal yang dipilih di panel SIPP (butir 3, agen S) - utama
 * dan pengecualian per perkara - dipakai putusan massal ABT: pengecualian
 * yang dipilih di baris ABT tetap menang; utama hanya bila di sini belum
 * dipilih. Hanya perkara yang ada di daftar hari itu. Disebut di kabar.
 */
async function a2PakaiBlangkoSipp(keadaan, pilihanPer, utama, kabar) {
  let simpan = null;
  try {
    const x = await chrome.storage.local.get([A2_KUNCI_BLANGKO_SIPP]);
    simpan = x && x[A2_KUNCI_BLANGKO_SIPP];
  } catch {
    return;
  }
  if (!simpan || typeof simpan !== "object") return;
  const per = simpan.perkara && typeof simpan.perkara === "object" ? simpan.perkara : {};
  let n = 0;
  for (const s of keadaan.sidang || []) {
    const e = per[s.nomor];
    if (!e || typeof e !== "object" || !e.berkas || pilihanPer.has(s.nomor)) continue;
    pilihanPer.set(s.nomor, alatRapikanBlangko({ blangko: e.blangko, berkas: e.berkas, a: e.a, b: e.b, d: e.d }));
    n += 1;
  }
  const pakaiUtama = typeof simpan.utama === "string" && utama.setelBila(simpan.utama);
  if ((n || pakaiUtama) && kabar) {
    const bagian = [];
    if (pakaiUtama) bagian.push("blangko utama");
    if (n) bagian.push(`${n} pengecualian per perkara`);
    kabar.appendChild(buatElemen("div", "aleta-tetap-sebab aleta-a2-dari-sipp", `Dari pilihan di panel SIPP: ${bagian.join(" dan ")}. Ubah di sini bila perlu.`));
  }
}

/**
 * Baris perkara (UI Baru): pilihan blangko perkara ini disembunyikan di balik
 * "Blangko berbeda…". Pilihannya TETAP select yang sama (pendengar, ingatan
 * pilihanPer, dan pembatalan pemeriksaan tidak berubah).
 */
function a2BarisBlangko(label, pilih, s, opsi) {
  const o = opsi || {};
  const bawaan = pilih.querySelector('option[value=""]');
  if (bawaan) bawaan.textContent = "sama dengan blangko utama";
  pilih.hidden = !o.berbeda;
  const buka = () => {
    pilih.hidden = false;
    try {
      pilih.focus();
    } catch {
      /* fokus hanya kenyamanan */
    }
  };
  pilih.addEventListener("change", () => {
    if (!pilih.value) pilih.hidden = true;
  });
  // Pembantu agen R (K3, basmassal.js) bila ada: barisnya ("Blangko utama: X ·
  // Blangko berbeda… · Ikuti blangko utama"). Pilihannya diteruskan ke select
  // di atas (tetap tersembunyi) - pendengar, pilihanPer, dan pembatalan
  // pemeriksaan tetap satu jalur.
  if (typeof aletaMassalBarisBlangko === "function") {
    try {
      const daftarBlangko = () =>
        Array.from(pilih.options)
          .filter((x) => x.value)
          .map((x) => ({ nilai: x.value, label: x.textContent, berkas: x.dataset.berkas, blangko: x.dataset.blangko, a: x.dataset.a, b: x.dataset.b, d: x.dataset.d }));
      const u = o.utamaPerkara && o.utamaPerkara.berkas ? o.utamaPerkara : null;
      let memulihkan = false;
      const el = aletaMassalBarisBlangko(
        { nomor: s.nomor, nomorPerkara: s.nomor, jenis: s.jenis, perkaraId: s.perkaraId },
        {
          blangkoUtama: u ? { nilai: alatKunciBerkas(u.berkas), label: u.berkas, berkas: u.berkas } : null,
          daftarBlangko,
          onPilih: ({ blangko, bawaan }) => {
            if (memulihkan) return;
            const v = !bawaan && blangko ? alatKunciBerkas(blangko.berkas || blangko.nilai || "") : "";
            pilih.value = Array.from(pilih.options).some((x) => x.value === v) ? v : "";
            pilih.hidden = true;
            pilih.dispatchEvent(new Event("change"));
          },
        }
      );
      if (el && el.nodeType === 1) {
        el.classList.add("aleta-a2-berbeda-baris");
        // Baris ini duduk di dalam <label> perkara: klik pada tulisannya tidak
        // boleh mencentang/melepas perkara itu.
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          const t = e.target;
          if (!(t && typeof t.closest === "function" && t.closest("button, select, option"))) e.preventDefault();
        });
        pilih.hidden = true;
        label.appendChild(el);
        // Pengecualian yang sudah ada (baris digambar ulang): keadaan "berbeda" dipulihkan.
        if (o.berbeda && pilih.value) {
          const tb = el.querySelector(".aleta-massal-blangko-beda");
          const ps = el.querySelector(".aleta-massal-blangko-pilih");
          const ke = daftarBlangko().findIndex((b) => b.nilai === pilih.value);
          if (tb && ps && ke >= 0) {
            memulihkan = true;
            try {
              tb.click();
              ps.value = String(ke);
              ps.dispatchEvent(new Event("change"));
            } finally {
              memulihkan = false;
            }
          }
        }
        return el;
      }
    } catch {
      /* pembantu R menolak - tombol di bawah */
    }
  }
  const tombol = buatElemen("button", "aleta-perkakas-aksi aleta-a2-berbeda", "Blangko berbeda…");
  tombol.type = "button";
  tombol.title = `Perkara ${s.nomor} memakai blangko lain dari blangko utama - pilih blangkonya`;
  tombol.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (pilih.hidden) buka();
    else if (!pilih.value) pilih.hidden = true;
  });
  label.insertBefore(tombol, pilih);
  return tombol;
}

/*
 * ============================================================================
 * P3 - PUTUSAN PER STATUS DI PUTUSAN MASSAL ABT (BUTIR 3)
 * ============================================================================
 *
 * Status putusan perkara: dari jadwal sidang yang dibaca panel ini
 * (s.statusPutusan / s.verstek), atau dari panel SIPP yang menyimpannya di
 * "blangkoPutusanMassal".status = { nomor: { statusPutusan, verstek } }.
 * Baris pemetaan KHUSUS status (bukan baris jenis) menang atas blangko utama
 * hari itu; pilihan per perkara tetap menang atas semuanya. Berlaku di semua
 * tampilan - yang berubah hanya blangko yang dipakai, bukan tampilannya.
 */
async function p3BacaStatusSipp() {
  try {
    const x = await chrome.storage.local.get([A2_KUNCI_BLANGKO_SIPP]);
    const simpan = x && x[A2_KUNCI_BLANGKO_SIPP];
    return simpan && simpan.status && typeof simpan.status === "object" ? simpan.status : {};
  } catch {
    return {};
  }
}

/** Baris pemetaan khusus status untuk perkara ini, atau null (= jenis / utama). */
function p3PetaStatus(keadaan, s) {
  if (!keadaan || !s || typeof alatPetaUntukPerkara !== "function") return null;
  const st = (keadaan.statusSipp && keadaan.statusSipp[s.nomor]) || null;
  const statusPutusan = String(s.statusPutusan || (st && st.statusPutusan) || "");
  if (!statusPutusan) return null;
  // T 13 Okt: kumulasi (SIPP + petitum) ikut menentukan blangko - baris kumulasi menang atas baris status biasa.
  const h = alatPetaUntukPerkara(keadaan.peta, s.jenis, statusPutusan, Boolean(s.verstek) || Boolean(st && st.verstek), s.kumulasi, (s.keadaan && s.keadaan.length ? s.keadaan : st && st.keadaan) || []);
  return h && h.tingkat !== "jenis" && alatBlangkoTerpetakan(h.baris) ? h.baris : null;
}

/** Baris pemetaan menurut jenis + status (tanpa pilihan per perkara dan utama). */
function p3PetaJenis(keadaan, s) {
  if (typeof alatPetaUntukPerkara !== "function") return keadaan.peta[alatKunciJenis(s.jenis)];
  const st = (keadaan.statusSipp && keadaan.statusSipp[s.nomor]) || null;
  const h = alatPetaUntukPerkara(keadaan.peta, s.jenis, s.statusPutusan || (st && st.statusPutusan) || "", Boolean(s.verstek) || Boolean(st && st.verstek), s.kumulasi, (s.keadaan && s.keadaan.length ? s.keadaan : st && st.keadaan) || []);
  return h ? h.baris : undefined;
}

(globalThis.__aletaModulSelesai || (globalThis.__aletaModulSelesai = new Set())).add("abt-panel-beranda.js"); // K11-SELESAI
