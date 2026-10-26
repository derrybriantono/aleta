"use strict";

/**
 * ============================================================================
 * PANEL SIPP - BAGIAN BERSAMA (K11)
 * ============================================================================
 *
 * Fungsi dan konstanta yang dipakai panel perkara DAN panel daftar, tetapi tidak oleh kode inti.
 * Dimuat lebih dulu (prasyarat konten-panel-perkara.js dan konten-panel-daftar.js).
 *
 * Potongan UTUH konten.js yang lama (K11, 26 Okt 2026): pernyataannya tidak
 * diubah, hanya dipindahkan. Dimuat modul-malas.js ke dunia terasing yang sama
 * dengan konten.js lewat pekerja latar (chrome.scripting.executeScript), sehingga
 * semua const/let/function tingkat atas tetap satu lingkup bersama konten.js.
 */

// Keadaan perkara selengkapnya - tahapan, berkas, putusan, upaya hukum, dan
// penilaian SK. Kapabilitasnya SAMA dengan sipp-konteks ("panel"), jadi menu
// tambahan ini tidak membuka satu pun pintu baru bagi peran mana pun.
const ALETA_API_STATUS = "/aleta/api/aleta-ecourt/status-perkara";
const ALETA_API_TULIS = "/aleta/api/aleta-bot/penunjukan/tulis";
const ALETA_API_ISIAN_PUTUSAN = "/aleta/api/aleta-ecourt/putusan/isian-sipp";
const ALETA_API_PRAPERIKSA_PUTUSAN = "/aleta/api/aleta-ecourt/putusan/praperiksa";
const ALETA_API_UNGGAH_NASKAH = "/aleta/api/aleta-ecourt/putusan/unggah-naskah";
const ALETA_API_UNGGAH_SIPP = "/aleta/api/aleta-ecourt/putusan/unggah-sipp";
/**
 * Mengunggah naskah lebih lama daripada membaca satu bagian panel: berkasnya
 * terkirim, diurai, lalu disimpan sebagai draf. Membatalkannya di detik
 * kesembilan tidak melindungi apa pun - naskahnya sudah sampai, dan yang
 * hilang hanya jawabannya.
 */
const BATAS_UNGGAH_NASKAH_MS = 45000;

/**
 * ============================================================================
 * MENULIS KE SIPP MENUNGGU LEBIH LAMA - DAN HARUS LEBIH LAMA DARIPADA GERBANG
 * ============================================================================
 *
 * Batas ini TIDAK boleh lebih pendek daripada batas gerbangnya. Terbaca dari
 * kedua angkanya:
 *
 *     gerbang   timeoutMs: 60000    whatsapp-gateway-client.ts, gatewayUnggahPutusanSipp
 *
 * Selama ini unggah ke SIPP memakai BATAS_UNGGAH_NASKAH_MS yang 45 detik -
 * lebih pendek daripada gerbangnya. Unggahan yang memakan 45 sampai 60 detik
 * karena itu dibatalkan ekstensi sementara botnya terus bekerja: petugas
 * melihat galat, dan berkasnya mungkin tetap tertulis. Komentar pada
 * gerbangnya sendiri sudah menyebut akibatnya - "membatalkannya di tengah
 * meninggalkan berkas yang sudah tertulis tanpa barisnya".
 *
 * Yang paling sering terkena ANONIMISASI, dan sebabnya aritmetika: putusan dan
 * anonimisasi dikirim dalam SATU permintaan, jadi bitanya dua kali lipat - dan
 * yang dua kali lipat itulah yang menyeberangi garis 45 detik.
 *
 * Urutan batas waktu harus MENAIK dari dalam ke luar: bot, gerbang, lalu
 * ekstensi. Yang di luar menyerah lebih dahulu meninggalkan pekerjaan setengah
 * jalan tanpa ada yang tahu hasilnya - dan itu keadaan yang paling sulit
 * diperbaiki, sebab tidak ada yang tahu apa yang sudah tertulis.
 *
 * Sejak 25 September 2026 (kontrak K6): bot 90 detik per konversi, dua
 * konversi sejajar; gerbang 120 detik (dahulu 60000); ekstensi 150 detik.
 * Putusan dan anonimisasi kini dikirim dalam DUA permintaan berurutan -
 * anonimisasi langsung sesudah jawaban atas putusannya - jadi tiap
 * permintaan membawa satu berkas, dan satu konversi, saja.
 */
const BATAS_UNGGAH_SIPP_MS = 150000;

/**
 * Memuat ulang halaman perkara ini. Lewat pintu masuk yang sah bila ada, dan
 * sebagai upaya terakhir memuat ulang apa adanya - halaman selain detail
 * perkara memang tidak punya masalah sesi ini.
 */
function muatUlangHalamanPerkara() {
  // Modul bersama (muat-ulang-sipp.js): ditahan selama antrean massal berjalan
  // (sekali di akhir), alamat disimpan, dan petugas dikembalikan ke alamat ini
  // bila SIPP menjatuhkan halaman ke dasbor. Tanpa modul: perilaku lama.
  const bersama = globalThis.aletaMuatUlangSipp;
  if (bersama) {
    if (bersama.tahanLegacy("")) return;
    void bersama.muatUlangSekarang("", null);
    return;
  }
  const alamat = alamatMasukPerkara();
  if (alamat) location.assign(alamat);
  else location.reload();
}

/**
 * Tombol unduh satu berkas.
 *
 * Berkasnya diambil lewat fetch lalu disimpan dari blob, bukan lewat tautan
 * biasa. Tautan biasa pada halaman SIPP akan berpindah halaman atau membuka
 * tab baru tanpa membawa sesi pada sebagian penyiapan - dan petugas menerima
 * halaman login alih-alih berkasnya, di tengah halaman perkara yang sedang
 * dikerjakan.
 */
/**
 * Membaca pesan dari jawaban galat portal.
 *
 * Bentuknya { ok: false, error: { message, details } } - error adalah OBYEK,
 * bukan teks. Memperlakukannya sebagai teks menghasilkan "[object Object]"
 * pada tombol, yang lebih tidak berguna daripada kata "gagal" saja.
 */
/**
 * AUDIT-GALAT 18 Okt 2026: "Awalan: sebab" TANPA mengulang awalan yang sudah dibawa
 * sebabnya. Galat ambilStatusPerkara sudah berbunyi "Keadaan perkara tidak terbaca
 * dari ALETA." - disambung buta menjadi "Keadaan perkara tidak terbaca: Keadaan
 * perkara tidak terbaca dari ALETA." di kartu Langkah berikutnya.
 *   galat  Error, teks, atau kosong.  titik  akhiri dengan tanda baca bila belum.
 */
function sambungSebab(awalan, galat, titik) {
  const a = String(awalan || "").trim();
  const pesan = String((galat && galat.message) || galat || "").trim();
  const datar = (x) => x.toLowerCase().replace(/\s+/g, " ").replace(/[\s.:;,!-]+$/, "");
  let hasil;
  if (!pesan) hasil = a;
  else if (a && datar(pesan).startsWith(datar(a))) hasil = pesan;
  else hasil = a ? `${a}: ${pesan}` : pesan;
  if (titik && !/[.!?]$/.test(hasil)) hasil += ".";
  return hasil;
}

function simpanLipatan(kunci, terlipat) {
  lipatanTersimpan = { ...(lipatanTersimpan || {}), [kunci]: terlipat };
  try {
    void chrome.storage.local.set({ [KUNCI_LIPATAN]: lipatanTersimpan });
  } catch {
    /* penyimpanan tidak tersedia: lipatan tetap bekerja, hanya tidak diingat */
  }
}

/**
 * Membuat satu bagian panel.
 *
 * @param {string} judul Judul yang terlihat petugas.
 * @param {string} kunci Nama tetap untuk mengingat lipatannya. TIDAK boleh
 *   diambil dari judul: judul memuat angka yang berubah - "Dokumen e-Court (3)"
 *   - sehingga lipatannya akan terlupa setiap jumlah dokumennya berubah.
 * @param {boolean} bawaanTerlipat Keadaan awal bila belum pernah diatur petugas.
 */
function bagian(judul, kunci = "", bawaanTerlipat = false) {
  const kotak = buatElemen("div", "aleta-bagian");
  const namaKunci = kunci || judul;
  kotak.dataset.kunci = namaKunci;

  const kepala = buatElemen("button", "aleta-bagian-judul");
  kepala.type = "button";
  kepala.appendChild(buatElemen("span", "aleta-bagian-panah", "▾"));
  kepala.appendChild(buatElemen("span", "aleta-bagian-teks", judul));

  // Tempat lencana, disiapkan kosong. Diisi belakangan oleh setLencana()
  // begitu keadaannya diketahui - sebagian seketika dari konteks, sebagian
  // sedetik kemudian dari panggilan latar.
  const tempatLencana = buatElemen("span", "aleta-bagian-lencana");
  kepala.appendChild(tempatLencana);

  const isi = buatElemen("div", "aleta-bagian-isi");

  const tersimpan = lipatanTersimpan ? lipatanTersimpan[namaKunci] : undefined;
  const terlipatAwal = typeof tersimpan === "boolean" ? tersimpan : bawaanTerlipat;
  terapkanLipatan(kepala, isi, terlipatAwal);

  kepala.addEventListener("click", () => {
    const sedangTerlipat = isi.style.display === "none";
    terapkanLipatan(kepala, isi, !sedangTerlipat);
    simpanLipatan(namaKunci, !sedangTerlipat);
  });

  kotak.appendChild(kepala);
  kotak.appendChild(isi);

  // Pemanggil menambahkan barisnya ke .aleta-bagian-isi, bukan ke kotaknya.
  kotak.isi = isi;
  kotak.lencana = tempatLencana;
  return kotak;
}

function terapkanLipatan(kepala, isi, terlipat) {
  isi.style.display = terlipat ? "none" : "";
  const panah = kepala.querySelector(".aleta-bagian-panah");
  if (panah) panah.textContent = terlipat ? "▸" : "▾";
  kepala.setAttribute("aria-expanded", terlipat ? "false" : "true");
}

/** Urutan yang tidak dapat dibalik - SIPP menolak PPP/PJS sebelum majelisnya ada. */
const URUTAN_TULIS = ["pmh", "ppp", "pjs", "phs"];

/**
 * Tanggal tiap penetapan yang SUDAH ada di SIPP menurut usulan (dibaca bot
 * dari perkara_penetapan) - { pmh, ppp, pjs, phs }, "" bila belum.
 */
function keadaanPenetapanUsulan(usulan) {
  const p = (usulan && usulan.penetapan) || {};
  // langkahAda: jawaban SATU sumber keadaan (tanggal terisi ATAU barisnya sudah
  // ada). Langkah yang ada tanpa tanggal terbaca tetap "sudah ada" - tidak
  // pernah ditawarkan untuk ditulis di atasnya.
  const ada = p.langkahAda || {};
  const hasil = {};
  for (const jenis of URUTAN_TULIS) {
    const nilai = String(p[jenis] || "").trim();
    hasil[jenis] = /^\d{4}-\d{2}-\d{2}/.test(nilai) ? nilai.slice(0, 10) : ada[jenis] === true ? "ada" : "";
  }
  return hasil;
}

/**
 * ============================================================================
 * JAWABAN PORTAL YANG TIDAK MEMBAWA KODE BOT (uji rilis 9 Okt 2026)
 * ============================================================================
 *
 * Rute tulis meneruskan penolakan bot beserta `alasan`-nya. Tetapi tidak
 * setiap jawaban berasal dari bot:
 *
 *   - 502/503 dari Apache selagi portal dibangun ulang berupa HALAMAN HTML -
 *     respons.json() melempar, dan yang dahulu terbaca petugas adalah
 *     "Unexpected token '<', "<html>..." is not valid JSON";
 *   - 401/403/500 dari portal sendiri berbentuk { ok:false, error:{ message } }
 *     tanpa `alasan` - dahulu satu kata "ditolak", dan 401 (sesi ALETA habis)
 *     tidak menghentikan antrean sehingga tiap perkara sisanya dicoba dan
 *     ditolak dengan kata yang sama.
 *
 * Mengembalikan null bila jawabannya memang jawaban bot (berhasil, atau
 * ditolak beralasan) - jalannya tidak berubah. Selain itu satu hasil gagal
 * yang sebabnya terbaca: 401/403 menjadi kode menyeluruh (antrean berhenti),
 * selebihnya gagal untuk perkara itu saja.
 */
function jawabanTulisTanpaAlasan(respons, jawab, jenis, kering) {
  const status = Number(respons && respons.status) || 0;
  const httpGagal = status > 0 && (status < 200 || status >= 300);
  const bentukSah = jawab !== null && typeof jawab === "object";
  if (bentukSah && jawab.alasan) return null;
  if (bentukSah && !httpGagal) return null;
  if (status === 401 || status === 403) {
    const kode = status === 401 ? "aleta_belum_masuk" : "aleta_tanpa_akses";
    return { jenis, ok: false, alasan: kode, bunyi: kalimatAlasan(kode), status };
  }
  const galat = bentukSah ? jawab.error : null;
  const pesanPortal = String((galat && (typeof galat === "string" ? galat : galat.message)) || "").trim();
  const sebab = pesanPortal
    ? `${pesanPortal.replace(/[.\s]+$/, "")} (ALETA menjawab ${status || "tanpa kode"})`
    : bentukSah
      ? `ALETA menjawab ${status}`
      : `jawaban ALETA tidak terbaca${status ? ` (ALETA menjawab ${status})` : ""} - server ALETA mungkin sedang dimuat ulang`;
  // Pada penulisan sungguhan jawabannya yang hilang, belum tentu tulisannya:
  // bot dapat sudah menulis sebelum gerbangnya menyerah. Disebut apa adanya -
  // menekan lagi aman, langkah yang sudah ada dilewati.
  const lanjut = kering
    ? ". Coba lagi sebentar lagi."
    : ". Belum pasti tertulis atau tidak - periksa di SIPP; bila ditekan lagi, langkah yang sudah ada dilewati.";
  return { jenis, ok: false, alasan: `jawaban_aleta_${status || "rusak"}`, bunyi: `${sebab}${lanjut}`, status };
}

/**
 * ============================================================================
 * SESI ALETA HABIS / TIDAK BERWENANG BUKAN "DITOLAK" (uji rilis U1, 9 Okt 2026)
 * ============================================================================
 *
 * Rute tulis menjawab 401 (sesi ALETA habis) dan 403 (peran tanpa kemampuan
 * "penunjukan") dengan bentuk galat portal { ok:false, error:{message} } -
 * TANPA `alasan`. Rantai lalu jatuh ke kata cadangan "ditolak": petugas yang
 * sesinya habis sesudah papan dimuat membaca "PMH: ditolak", dan penetapan
 * massal mengulang kegagalan yang sama pada tiap perkara alih-alih berhenti.
 *
 * Penolakan bersebab dari bot (alasan ada) dibiarkan apa adanya.
 */
function jawabPenetapanMenurutStatus(status, jawab) {
  if (jawab && typeof jawab.alasan === "string" && jawab.alasan) return jawab;
  const pesan = jawab && jawab.error && typeof jawab.error === "object" ? String(jawab.error.message || "") : "";
  if (Number(status) === 401) return { ...(jawab || {}), ok: false, alasan: "belum_masuk_aleta", pesan };
  if (Number(status) === 403) return { ...(jawab || {}), ok: false, alasan: "tidak_berwenang_aleta", pesan };
  return jawab;
}

async function rantaiPenetapan(usulan, data, kering) {
  const perkaraId = Number((usulan.perkara && usulan.perkara.perkaraId) || 0);
  if (!perkaraId) return [{ jenis: "pmh", ok: false, alasan: "perkara tidak dikenali" }];

  const pilihanManual = (data && data.pilihanManual) || {};
  const pejabat = (data && data.pejabatDipilih) || {};
  const rencana = (data && data.rencana && data.rencana.langkah) || [];

  const hasil = [];
  // Jenis yang SUDAH lulus lebih dahulu pada rantai ini. Dikirim supaya uji
  // kering menilai PHS atas keadaan yang akan ada sesudah PMH ditulis, bukan
  // atas keadaan sekarang - tanpa itu PHS selalu ditolak "pmh_belum_ada" pada
  // perkara yang baru didaftarkan, dan tidak satu pun penetapan pernah
  // tertulis.
  const rantaiSebelum = [];

  // ==========================================================================
  // TERCATAT DI SIPP ATAS AKUN PEJABAT; AKUN YANG MASUK = PENEKAN (jejak ALETA)
  // ==========================================================================
  //
  // Butir 17 (13 Okt 2026, menggantikan butir 39 untuk penetapan): "di riwayat
  // dan sys_audittrail itu tetap pejabatnya yang terinput namanya walaupun
  // yang login akun apapun". pejabatUsername tiap langkah (pilihan "Pejabat
  // yang menetapkan", bawaan pilihan ALETA) itulah yang dicatat SIPP; portal
  // dan bot memastikannya dan menolak akun yang tidak pasti.
  //
  // Akun yang sedang masuk tetap dibaca dari kepala halaman SIPP dan WAJIB
  // ada: ALETA mencatatnya sebagai penekan sebenarnya di jejak ALETA.
  const akunMasuk = typeof namaPenggunaSipp === "function" ? String(namaPenggunaSipp() || "").trim() : "";
  if (!akunMasuk) {
    return [
      {
        jenis: URUTAN_TULIS[0],
        ok: false,
        alasan: "akun_sipp_belum_terbaca",
        bunyi: kalimatAlasan("akun_sipp_belum_terbaca"),
      },
    ];
  }

  // ==========================================================================
  // YANG SUDAH ADA DI SIPP DILEWATI SEBELUM APA PUN DIMINTA (7 Okt 2026)
  // ==========================================================================
  //
  // Keluhan 4 & 5: "apabila sudah ada satu tahapannya yang dikerja manual
  // maka aleta kerjakan penetapan sisa lainnya". Sebelumnya langkah yang
  // sudah ada tetap disusun nilainya (idUntukTulis) dan dikirim ke bot hanya
  // untuk ditolak "_sudah_ada" - dan bila usulannya untuk langkah itu tidak
  // dapat disusun (mis. PMH tangan atas perkara yang bentuk majelisnya belum
  // tentu), rantainya PUTUS di sana: "belum ada usulan yang dapat ditulis",
  // padahal yang tersisa PPP, PJS, PHS.
  //
  // Keadaannya dibaca dari usulan.penetapan - perkara_penetapan, sumber yang
  // SAMA dengan penjaga _sudah_ada di bot (sumber-keadaan-penetapan). Yang
  // sudah bertanggal dicatat sudah ada, masuk rantaiSebelum (langkah
  // berikutnya menuntutnya), dan TIDAK dikirim. Bot tetap menjaga: keadaan
  // yang basi dijawabnya _sudah_ada dan dilewati di bawah.
  const sudahDiSipp = keadaanPenetapanUsulan(usulan);
  // Penulisan sungguhan: langkah sisa yang dikirim SEKALIGUS (lihat di bawah).
  const antreRantai = [];

  for (const jenis of URUTAN_TULIS) {
    if (sudahDiSipp[jenis]) {
      hasil.push({
        jenis,
        ok: false,
        sudahAda: true,
        alasan: `${jenis}_sudah_ada`,
        bunyi: kalimatAlasan(`${jenis}_sudah_ada`),
        tanggalPenetapan: sudahDiSipp[jenis],
        langkah: [],
        andaian: [],
        catatanTanggal: [],
        olehUsername: akunMasuk,
      });
      rantaiSebelum.push(jenis);
      continue;
    }

    const nilai = idUntukTulis(jenis, usulan, pilihanManual);
    if (!nilai) {
      hasil.push({ jenis, ok: false, alasan: "belum ada usulan yang dapat ditulis" });
      break;
    }

    // Butir 38: tanggal sidang pilihan tangan yang melanggar aturan DITOLAK
    // di sini dengan sebabnya - tidak pernah diganti usulan diam-diam.
    if (jenis === "phs") {
      const masalah = masalahTanggalSidang(usulan, pilihanManual);
      if (masalah) {
        hasil.push({ jenis, ok: false, alasan: "tanggal_sidang_pilihan_tidak_sah", bunyi: masalah });
        break;
      }
    }

    // Pejabat penetapnya: pilihan petugas bila ada, kalau tidak yang dipilih
    // mesin. Sejak butir 17 INILAH akun yang dicatat di SIPP.
    const langkah = rencana.find((x) => x.jenis === jenis);
    const otomatis = langkah && langkah.akun ? langkah.akun.username : "";
    const pejabatUsername = pejabat[jenis] || otomatis || "";
    const olehUsername = akunMasuk;

    // ========================================================================
    // PENULISAN SUNGGUHAN: SELURUH SISA DIKIRIM SEKALIGUS, UTUH ATAU BATAL
    // ========================================================================
    //
    // Uji rilis U1 (9 Okt 2026): langkah demi langkah dalam permintaan
    // terpisah dapat berhenti di tengah dan meninggalkan perkara separuh
    // tertulis (cacat tunda 273). Langkahnya dikumpulkan di sini lalu dikirim
    // dalam SATU permintaan; bot menuliskannya dalam satu transaksi dan
    // menjalani jeda manusia di antara langkah (jam audit sesudah jeda).
    if (!kering) {
      const tempat = { jenis, ok: false, menungguRantai: true, alasan: "", olehUsername: akunMasuk, langkah: [], andaian: [], catatanTanggal: [] };
      hasil.push(tempat);
      antreRantai.push({ tempat, kirim: { jenis, ...nilai, pejabatUsername } });
      rantaiSebelum.push(jenis);
      continue;
    }

    let jawab;
    let respons;
    try {
      respons = await alatAmbil(
        ALETA_API_TULIS,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jenis,
            perkaraId,
            tanggalPenetapan: usulan.tanggalPenetapan || "",
            ...nilai,
            olehUsername,
            pejabatUsername,
            kering,
            rantaiSebelum: rantaiSebelum.slice(),
          }),
        },
        kering ? "Menyusun rencana penetapan" : "Menulis penetapan"
      );
    } catch (galat) {
      hasil.push({ jenis, ok: false, alasan: String((galat && galat.message) || galat) });
      break;
    }
    // Badannya dibaca terpisah: halaman HTML 502 bukan galat jaringan, dan
    // sebabnya disusun jawabanTulisTanpaAlasan - bukan bunyi JSON.parse.
    let luar = null;
    try {
      luar = await respons.json();
    } catch {
      luar = null;
    }
    jawab = luar && luar.data ? luar.data : luar;
    const tanpaAlasan = jawabanTulisTanpaAlasan(respons, jawab, jenis, kering);
    if (tanpaAlasan) {
      hasil.push({ ...tanpaAlasan, olehUsername });
      break;
    }

    const berhasil = jawab && jawab.ok !== false;

    // Tulisan yang SUNGGUHAN mengubah SIPP membuat simpanan keadaan perkara
    // basi seketika. Dibatalkan di sini, bukan di pemanggil: tiap jenis
    // penetapan lewat gelung ini, dan menaruhnya di pemanggil berarti satu
    // jenis yang ditambahkan kelak akan terlewat tanpa berbunyi.
    //
    // Uji keringnya TIDAK membatalkan apa pun - ia memang tidak menulis.
    if (berhasil && !kering) lupakanStatusPerkara(String((usulan.perkara && usulan.perkara.nomorPerkara) || ""));

    const kode = berhasil ? "" : String((jawab && jawab.alasan) || "ditolak");
    hasil.push({
      jenis,
      ok: berhasil,
      sudahAda: !berhasil && /_sudah_ada$/.test(kode),
      // Kodenya dibawa apa adanya - penjaga _sudah_ada mencocokkannya.
      alasan: kode,
      // Dan bunyinya, untuk dibaca orang.
      bunyi: berhasil
        ? ""
        : kalimatAlasan(kode, (jawab && jawab.username) || pejabatUsername || olehUsername),
      atasNama: jawab && jawab.atasNama,
      langkah: (jawab && jawab.langkah) || [],
      andaian: (jawab && jawab.andaian) || [],
      // Kosong pada keadaan biasa. Berisi ketika rantainya dilanjutkan pada
      // hari yang berbeda - lihat catatanTanggal di penetapanTulisService.
      catatanTanggal: (jawab && jawab.catatanTanggal) || [],
      // Dibawa supaya hasil SESUDAH eksekusi dapat mengulang apa yang
      // sungguh ditulis, bukan hanya mengatakan "ditetapkan".
      tanggalPenetapan: (jawab && jawab.tanggalPenetapan) || "",
      olehUsername,
    });
    // ======================================================================
    // LANGKAH YANG SUDAH ADA DILEWATI - RANTAINYA TIDAK BERHENTI
    // ======================================================================
    //
    // Sebelumnya tiap penolakan memutus rantai, termasuk "pmh_sudah_ada" -
    // dan itu membuat perkara yang PMH-nya sudah ditetapkan tetapi PPP, PJS,
    // dan PHS-nya belum TIDAK PERNAH dapat dilanjutkan. Pada penetapan
    // massal akibatnya lebih besar lagi: satu perkara semacam itu di urutan
    // pertama menghentikan seluruh halaman.
    //
    // "Sudah ada" bukan kegagalan - ia keadaan yang memang dituju. Langkahnya
    // dicatat sebagai sudah ada, dimasukkan ke rantaiSebelum (sebab ia
    // sungguh-sungguh ada, dan langkah berikutnya menuntutnya), lalu rantai
    // berjalan terus. Yang benar-benar gagal tetap memutus.
    if (!berhasil) {
      if (/_sudah_ada$/.test(kode)) {
        rantaiSebelum.push(jenis);
        continue;
      }
      break;
    }
    rantaiSebelum.push(jenis);
  }

  if (!kering && antreRantai.length > 0) await kirimRantaiUtuh(usulan, perkaraId, akunMasuk, hasil, antreRantai);
  return hasil;
}

async function kirimRantaiUtuh(usulan, perkaraId, akunMasuk, hasil, antre, pilihJamKerja) {
  const jenisSebut = (j) => String(j || "").toUpperCase();
  const gagalPanel = hasil.find((x) => !x.ok && !x.sudahAda && !x.menungguRantai);
  const tandaiBatal = (tempat, sebab) => {
    tempat.menungguRantai = false;
    tempat.ok = false;
    tempat.alasan = "dibatalkan_rantai";
    tempat.bunyi = sebab;
  };
  if (gagalPanel) {
    for (const a of antre) {
      tandaiBatal(a.tempat, `Tidak ditulis - ${jenisSebut(gagalPanel.jenis)} belum dapat ditulis, jadi seluruh sisa penetapan ditahan.`);
    }
    return;
  }

  let jawab;
  try {
    const respons = await alatAmbil(
      ALETA_API_TULIS,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        // Bot menjalani jeda manusia per langkah - lebih lama dari satu langkah.
        batasMs: 150000,
        body: JSON.stringify({
          rantai: antre.map((a) => a.kirim),
          perkaraId,
          tanggalPenetapan: usulan.tanggalPenetapan || "",
          olehUsername: akunMasuk,
          kering: false,
          tanyaJamKerja: true,
          ...(pilihJamKerja ? { jamKerja: pilihJamKerja } : {}),
        }),
      },
      "Menulis penetapan"
    );
    // Badannya dibaca terpisah (perbaikan sesudah penggabungan U1+U2, 9 Okt
    // 2026): kiriman rantai utuh semula memanggil respons.json() di dalam try
    // yang sama, sehingga 502 berupa halaman HTML Apache terbaca petugas
    // sebagai "Unexpected token '<'", dan 500 JSON portal { error:{message} }
    // menjadi satu kata "ditolak". Kini melewati jawabanTulisTanpaAlasan yang
    // sama dengan langkah tunggal: 401/403 tetap kode menyeluruh (antrean
    // berhenti), selebihnya gagal untuk perkara ini saja dengan sebab terbaca.
    let luar = null;
    try {
      luar = await respons.json();
    } catch {
      luar = null;
    }
    const isi = luar && luar.data && luar.data.hasil ? luar.data : luar;
    // Keputusan 104: di luar jam kerja - tanya, lalu kirim ulang dengan pilihannya.
    if (!pilihJamKerja && isi && (isi.kode === "di_luar_jam_kerja" || isi.alasan === "di_luar_jam_kerja" || isi.perluPilihan)) {
      const pilih = await tanyaJamKerjaPenetapan(String(isi.pesan || isi.alasan || ""));
      return kirimRantaiUtuh(usulan, perkaraId, akunMasuk, hasil, antre, pilih);
    }
    if (isi && isi.diantrekan) {
      // Belum tertulis - langkah sesudahnya (e-Doc penetapan) tidak dijalankan.
      for (const a of antre) {
        Object.assign(a.tempat, {
          menungguRantai: false,
          ok: false,
          diantrekan: true,
          alasan: "diantrekan",
          bunyi: String(isi.pesan || "Di luar jam kerja - diantrekan, dikerjakan pada jam kerja berikutnya."),
        });
      }
      return;
    }
    const status = Number(respons && respons.status) || 0;
    const tanpaAlasan = status === 401 || status === 403 ? null : jawabanTulisTanpaAlasan(respons, isi, antre[0].tempat.jenis, false);
    jawab = tanpaAlasan
      ? { ok: false, alasan: tanpaAlasan.alasan, bunyiTetap: tanpaAlasan.bunyi }
      : jawabPenetapanMenurutStatus(respons.status, isi);
  } catch (galat) {
    // Batas waktu / jaringan putus: kalimat alatAmbil sudah terbaca. Pada
    // batas waktu bot dapat sudah meng-COMMIT sebelum gerbangnya menyerah,
    // jadi tidak disebut "tidak ada yang tertulis".
    const pesan = String((galat && galat.message) || galat).replace(/[.\s]+$/, "");
    jawab = {
      ok: false,
      alasan: pesan,
      bunyiTetap: `${pesan}. Belum pasti tertulis atau tidak - periksa di SIPP; bila ditekan lagi, langkah yang sudah ada dilewati.`,
    };
  }
  jawab = jawab || { ok: false, alasan: "tanpa_jawaban" };

  const rincian = Array.isArray(jawab.hasil) ? jawab.hasil : [];
  if (jawab.ok !== false) {
    lupakanStatusPerkara(String((usulan.perkara && usulan.perkara.nomorPerkara) || ""));
    for (const a of antre) {
      const r = rincian.find((x) => x && x.jenis === a.tempat.jenis) || {};
      a.tempat.menungguRantai = false;
      if (r.sudahAda) {
        Object.assign(a.tempat, { ok: false, sudahAda: true, alasan: `${a.tempat.jenis}_sudah_ada`, bunyi: kalimatAlasan(`${a.tempat.jenis}_sudah_ada`) });
        continue;
      }
      Object.assign(a.tempat, {
        ok: true,
        alasan: "",
        bunyi: "",
        atasNama: r.atasNama,
        langkah: r.langkah || [],
        catatanTanggal: r.catatanTanggal || [],
        tanggalPenetapan: r.tanggalPenetapan || usulan.tanggalPenetapan || "",
      });
    }
    return;
  }

  // Gagal: TIDAK ADA yang tertulis (transaksi dibatalkan). Langkah yang gagal
  // membawa sebabnya; yang lain disebut dibatalkan bersamanya.
  const jenisGagal = String(jawab.jenisGagal || "") || antre[0].tempat.jenis;
  const kodeGagal = String(jawab.alasan || "ditolak");
  const bunyiGagal = jawab.bunyiTetap || kalimatAlasan(kodeGagal, String(jawab.usernameGagal || "") || akunMasuk);
  // Jawaban yang hilang (bunyiTetap) sudah menyebut "belum pasti" - tidak
  // ditimpa "Tidak ada yang tertulis" yang belum tentu benar.
  const peringatan = jawab.bunyiTetap
    ? ""
    : jawab.dipulihkan === false
      ? " PERHATIAN: pembatalan di server tidak terkonfirmasi - periksa tab Penetapan SIPP sebelum mencoba lagi."
      : " Tidak ada yang tertulis - dapat dicoba lagi.";
  for (const a of antre) {
    const r = rincian.find((x) => x && x.jenis === a.tempat.jenis) || {};
    if (a.tempat.jenis === jenisGagal) {
      a.tempat.menungguRantai = false;
      a.tempat.ok = false;
      a.tempat.alasan = kodeGagal;
      a.tempat.bunyi = `${bunyiGagal}${jawab.pesan ? ` (${String(jawab.pesan).slice(0, 160)})` : ""}${peringatan}`;
    } else if (r.sudahAda) {
      Object.assign(a.tempat, { menungguRantai: false, ok: false, sudahAda: true, alasan: `${a.tempat.jenis}_sudah_ada`, bunyi: kalimatAlasan(`${a.tempat.jenis}_sudah_ada`) });
    } else if (jawab.bunyiTetap) {
      tandaiBatal(a.tempat, `Dikirim bersama ${jenisSebut(jenisGagal)} dalam satu transaksi - keadaannya sama dengan ${jenisSebut(jenisGagal)} (utuh tertulis atau tidak sama sekali).`);
    } else {
      tandaiBatal(a.tempat, `Tidak tertulis - seluruh sisa penetapan dibatalkan karena ${jenisSebut(jenisGagal)} gagal.${peringatan}`);
    }
  }
}

/**
 * ============================================================================
 * PRAPERIKSA - APA YANG AKAN TERJADI, DALAM KALIMAT
 * ============================================================================
 *
 * Uji kering dulu menjawab "7 pernyataan disiapkan" per langkah. Itu benar,
 * dan itu tidak menolong siapa pun: yang hendak diketahui petugas sebelum
 * menekan bukan berapa baris SQL yang akan berjalan, melainkan SIAPA yang
 * akan ditunjuk, KENAPA orang itu, KAPAN sidangnya, dan apakah ada yang
 * mengganjal.
 *
 * Rapor ini menjawab keempatnya, dan cacah pernyataannya tetap ada di bawah
 * sebagai rinciannya - yang dibaca ketika ada yang perlu ditelusuri.
 *
 * ============================================================================
 * SELURUHNYA DIHITUNG DI SINI, TANPA SATU PUN PANGGILAN BARU
 * ============================================================================
 *
 * Bahannya sudah ada di layar: usulan beserta sebabnya, pilihan manual yang
 * sedang berlaku, dan rencana kerja yang menyebut akun pelaksana tiap
 * langkah. Menambah panggilan hanya untuk merapikan kalimat berarti menunda
 * jawabannya demi jawaban yang sama.
 */
function raporPraperiksa(usulan, data, hasilKering) {
  const pilihanManual = (data && data.pilihanManual) || {};
  const baris = [];
  const ganjalan = [];

  // ==========================================================================
  // TANGGAL PENETAPAN - PALING ATAS, SEBAB IA MENGIKAT KETIGA LANGKAH LAIN
  // ==========================================================================
  //
  // Dahulu tidak pernah dipajang sama sekali. Selama seluruh langkah wajib
  // setanggal, itu masih dapat dimaklumi - tanggalnya hanya satu dan tidak
  // dapat lain. Sejak rantainya boleh dilanjutkan pada hari yang berbeda,
  // justru tanggal inilah yang paling perlu diperiksa sebelum ditekan.
  if (usulan.tanggalPenetapan) {
    baris.push({
      label: "Tanggal penetapan",
      nilai: sebutTanggal(usulan.tanggalPenetapan),
      sebab: "",
    });
  }

  const pmh = usulan.pmh || {};
  const susunan = susunanTerpilih(pmh, pilihanManual.majelis);
  const anggota = (susunan && susunan.anggota) || pmh.anggota || [];
  const namaMajelis = anggota.map((x) => x && x.nama).filter(Boolean).join(", ");
  if (namaMajelis) {
    baris.push({ label: pmh.bentuk === "majelis" ? "Majelis" : "Hakim", nilai: namaMajelis, sebab: pmh.sebab || "" });
  }
  if (pmh.perluNilai) ganjalan.push("Nilai sengketa belum diisi di SIPP - isi dahulu di Data Umum.");

  const ppp = usulan.ppp || {};
  const pppTerpilih = pilihanDari(ppp.calon, pilihanManual.ppp) || ppp.usulan;
  if (pppTerpilih) {
    baris.push({ label: "Panitera pengganti", nilai: pppTerpilih.nama || "", sebab: ppp.sebab || "" });
  }

  const pjs = usulan.pjs || {};
  const pjsTerpilih = pilihanDari(pjs.calon, pilihanManual.pjs) || pjs.usulan;
  if (pjsTerpilih) {
    baris.push({ label: "Juru sita", nilai: pjsTerpilih.nama || "", sebab: pjs.sebab || "" });
  }
  if (pjs.peringatan) ganjalan.push(pjs.peringatan);

  const phs = usulan.phs || {};
  const nilaiPhs = idUntukTulis("phs", usulan, pilihanManual);
  const tanggalSidang = (nilaiPhs && nilaiPhs.tanggalSidang) || "";
  if (tanggalSidang) {
    const sebabPhs = [phs.sebab, phs.jarakHari ? `${phs.jarakHari} hari sejak daftar` : ""]
      .filter(Boolean)
      .join(" · ");
    baris.push({ label: "Hari sidang", nilai: sebutTanggal(tanggalSidang), sebab: sebabPhs });
  }

  // ==========================================================================
  // RUANG SIDANG - DIKIRIM SEJAK LAMA, TIDAK PERNAH DIPAJANG
  // ==========================================================================
  //
  // pilihanManual.ruangan sudah diteruskan ke mesin tulis sejak ruangan dapat
  // dipilih, tetapi tidak pernah muncul di pratinjau. Akibatnya ruangan yang
  // keliru - sidang keliling yang tertulis di dalam gedung - tidak dapat
  // ketahuan sebelum ditekan, dan gagalnya diam: penetapannya berhasil,
  // berkasnya tercetak, sidangnya digelar, dan laporan sidang keliling
  // menghitung nol.
  //
  // Namanya dicari dari daftar yang sudah tersimpan, bukan nomornya yang
  // dipajang: "3" tidak memberi tahu siapa pun ruangan mana yang dimaksud.
  const idRuangan = Number(pilihanManual.ruangan);
  if (Number.isFinite(idRuangan) && idRuangan > 0) {
    const tempat = (ruanganTersimpan || []).find((r) => String(r.id) === String(idRuangan));
    baris.push({
      label: "Ruang sidang",
      // Daftarnya belum terbaca - dikatakan apa adanya, bukan disamarkan
      // menjadi nomor yang tampak pasti.
      nilai: tempat ? tempat.nama || `ruangan ${idRuangan}` : `ruangan ${idRuangan} (namanya belum terbaca)`,
      sebab: "pilihan Anda",
    });
  }

  // ==========================================================================
  // PEJABAT PENETAP TIAP LANGKAH - SIAPA YANG MENANDATANGANINYA
  // ==========================================================================
  //
  // Dahulu hanya muncul ketika BERMASALAH, sebagai ganjalan. Pada keadaan
  // biasa - yang paling sering - pratinjau sama sekali tidak menyebut atas
  // nama siapa penetapan akan tertulis, padahal namanya itulah yang mendarat
  // di kolom pengguna dan di sys_audittrail.
  //
  // Yang dipilih tangan ditandai. Tanpa tanda itu, petugas yang baru saja
  // memilih pejabat lain tidak punya cara memastikan pilihannya sampai -
  // dan pilihan yang tidak sampai tidak berbunyi apa pun.
  //
  // Butir 17 (13 Okt 2026, menggantikan butir 39 untuk penetapan): yang
  // DICATAT di SIPP - Riwayat Perkara "Diinput Oleh" dan Audit Trail - adalah
  // akun SIPP PEJABAT tiap langkah, apa pun akun yang sedang masuk. Akun yang
  // masuk hanya dicatat di jejak ALETA sebagai penekan sebenarnya. Keduanya
  // disebut di sini sebelum tombolnya ditekan.
  const akunTercatat = typeof namaPenggunaSipp === "function" ? String(namaPenggunaSipp() || "").trim() : "";
  baris.push({
    label: "Ditekan oleh",
    nilai: akunTercatat || "akun SIPP belum terbaca - masuk ke SIPP lebih dulu",
    sebab: akunTercatat ? "akun SIPP yang sedang masuk - dicatat di jejak ALETA saja, tidak di SIPP" : "",
  });
  const pejabatDipilih = (data && data.pejabatDipilih) || {};
  for (const langkah of (data && data.rencana && data.rencana.langkah) || []) {
    const jenis = String((langkah && langkah.jenis) || "").toUpperCase();
    if (!jenis) continue;
    const tangan = pejabatDipilih[String(langkah.jenis)];
    const akun = (langkah && langkah.akun) || {};
    // Jawaban uji kering bot menang: itulah akun yang sungguh akan dicatat.
    const dariBot = (hasilKering || []).find((x) => x && String(x.jenis) === String(langkah.jenis) && x.atasNama);
    const calonTangan =
      tangan && Array.isArray(langkah.calon) ? langkah.calon.find((x) => x && x.username === tangan) : null;
    const username = (dariBot && dariBot.atasNama.username) || tangan || akun.username || "";
    if (!username) continue;
    const nama =
      (dariBot && dariBot.atasNama.namaLengkap) ||
      (calonTangan && calonTangan.namaLengkap) ||
      (tangan && tangan !== akun.username ? "" : akun.namaLengkap || akun.nama || "");
    baris.push({
      label: `Penetap ${jenis}`,
      nilai: `akan dicatat atas nama ${nama || username} (akun SIPP ${username})`,
      sebab: tangan ? "pilihan Anda" : "",
    });
  }

  // Rantai yang dilanjutkan pada hari berbeda - dari bot, bukan dihitung
  // ulang di sini. Bukan ganjalan: ia sah, dan satu dari lima perkara di
  // satker ini memang begitu. Tetapi ia HARUS terbaca sebelum ditekan.
  for (const hasil of hasilKering || []) {
    for (const catatan of (hasil && hasil.catatanTanggal) || []) {
      if (catatan) ganjalan.push(catatan);
    }
  }

  // ==========================================================================
  // GANJALAN YANG TIDAK DAPAT DILIHAT DARI LAYAR SIPP
  // ==========================================================================
  //
  // Ketiganya keadaan yang sah menurut basis data - SIPP akan menerimanya
  // tanpa mengeluh - tetapi keliru menurut hukum acara atau menurut kalender.
  // Yang menemukannya sesudah penetapan tertulis harus membongkar empat
  // langkah untuk memperbaiki satu tanggal.
  const akhirPekan = hariAkhirPekan(tanggalSidang);
  if (akhirPekan) ganjalan.push(`Hari sidang jatuh pada ${akhirPekan}.`);

  const jarak = Number(phs.jarakHari);
  if (Number.isFinite(jarak) && jarak > 0 && jarak < JARAK_SIDANG_MINIMUM) {
    ganjalan.push(
      `Hari sidang hanya ${jarak} hari sejak pendaftaran - panggilan patut menuntut sekurang-kurangnya ${JARAK_SIDANG_MINIMUM} hari.`
    );
  }

  // Catatan tentang pejabat penetapnya: Plh yang tercatat tetapi tidak
  // dipakai, pejabat yang berhalangan tanpa Plh, ketua majelis yang baru
  // pasti sesudah PMH tersimpan.
  const langkahRencana = (data && data.rencana && data.rencana.langkah) || [];
  for (const langkah of langkahRencana) {
    const akun = langkah && langkah.akun;
    if (akun && akun.siap === false && akun.sebab) {
      ganjalan.push(`${String(langkah.jenis || "").toUpperCase()}: ${akun.sebab}`);
    }
    for (const c of (langkah && langkah.catatanPenetap) || []) {
      if (c) ganjalan.push(`${String(langkah.jenis || "").toUpperCase()}: ${c}`);
    }
  }

  // Yang DITOLAK uji kering karena sudah ada di SIPP - itu bukan kegagalan
  // ALETA, itu keadaan perkaranya, dan menyebutnya sebagai kegagalan membuat
  // orang mencari kerusakan yang tidak ada.
  const sudahAda = (hasilKering || [])
    .filter((x) => !x.ok && /_sudah_ada$/.test(String(x.alasan || "")))
    .map((x) => String(x.jenis).toUpperCase());

  return { baris, ganjalan, sudahAda };
}

/** Sekurang-kurangnya sekian hari antara pendaftaran dan sidang pertama. */
const JARAK_SIDANG_MINIMUM = 7;

/**
 * Pilihan orang untuk satu penetapan, pada cara MANUAL.
 *
 * ============================================================================
 * DAFTARNYA SUDAH ADA - HANYA BELUM PERNAH DIGAMBAR
 * ============================================================================
 *
 * Layanan penunjukan sejak awal mengirim SELURUH kolam calon, bukan hanya yang
 * terpilih: `daftar` untuk panitera pengganti dan juru sita, `hitungan` untuk
 * hakim. Yang tergambar selama ini hanya juaranya.
 *
 * Karena itu cara manual tidak menuntut satu pun panggilan baru ke server. Yang
 * ditambahkan hanya kemampuan MEMILIH yang lain dari daftar yang sudah datang.
 *
 * ============================================================================
 * URUTANNYA TIDAK DIACAK - YANG DIUSULKAN TETAP DI ATAS
 * ============================================================================
 *
 * Daftarnya sudah terurut menurut keadilan beban, dan urutan itu dipertahankan.
 * Manual berarti "saya boleh memilih yang lain", bukan "usulannya dibuang":
 * yang memilih manual pun tetap perlu tahu siapa yang semestinya, supaya
 * penyimpangannya adalah keputusan - bukan ketidaktahuan.
 */
function pilihanOrang(label, daftar, terpilihId, onPilih) {
  const baris = buatElemen("div", "aleta-pilih");
  baris.appendChild(buatElemen("span", "aleta-pilih-nama", label));

  const kotak = document.createElement("select");
  kotak.className = "aleta-pilih-kotak";

  for (const orang of daftar) {
    const opsi = document.createElement("option");
    opsi.value = String(orang.id);
    opsi.textContent = orang.label;
    // Hari libur tampil tetapi tidak dapat dipilih (18 Okt 2026).
    if (orang.mati) opsi.disabled = true;
    if (String(orang.id) === String(terpilihId)) opsi.selected = true;
    kotak.appendChild(opsi);
  }

  kotak.addEventListener("change", () => onPilih(kotak.value));
  baris.appendChild(kotak);
  return baris;
}

/**
 * Akun SIPP yang sedang dipakai, dari halaman SIPP sendiri.
 *
 * Dicatat karena akun SIPP dan akun ALETA belum tentu orang yang sama - panel
 * ini melayang di atas halaman yang punya sesi sendiri. Kalau tidak ketemu,
 * dikosongkan; menebaknya lebih buruk daripada mengakui tidak tahu.
 */
function akunSipp() {
  const petunjuk = document.querySelector(".user-name, .username, #user_name, .navbar .dropdown-toggle");
  return petunjuk ? String(petunjuk.textContent || "").trim().slice(0, 60) : "";
}

/**
 * ============================================================================
 * MENGUNGGAH PUTUSAN AKHIR DAN ANONIMISASINYA - SATU PEMILIH, DUA KIRIMAN
 * ============================================================================
 *
 * Keduanya diunggah lewat tingkap "Kelola Dokumen Elektronik (E-Doc)" SIPP,
 * satu per satu: dua kali buka tingkap, dua kali pilih berkas, dua kali
 * tunggu - padahal keduanya berasal dari naskah yang sama.
 *
 * Sejak 25 September 2026 keduanya dipilih dalam SATU pemilih dan dipasangkan
 * menurut nomor perkara dan nama berkasnya, lalu dikirim BERURUTAN dalam dua
 * permintaan: putusan lebih dahulu, anonimisasi langsung sesudah jawaban atas
 * putusannya tiba - tanpa jeda di antaranya. Lihat unggahBerpasangan.
 *
 * Yang ditulis mengikuti STRUKTUR SIPP - nama berkas, letak folder menurut
 * tanggal putusan, baris dirput_dokumen, dan antrean Direktori Putusan -
 * supaya SIPP dan Direktori Putusan dapat membacanya. Lihat
 * putusanUnggahService.js di bot untuk sumber tiap aturannya.
 */
/**
 * ============================================================================
 * KODE ALASAN, DAN KALIMAT YANG DAPAT DIKERJAKAN
 * ============================================================================
 *
 * Bot memulangkan kode seperti "akar_sipp_belum_disetel". Kode itu benar, dan
 * sampai 23 September 2026 kode itulah yang tampil apa adanya di layar -
 * merah, tanpa satu pun petunjuk apa yang harus diperbuat.
 *
 * Yang membaca layar ini panitera pengganti, bukan yang memasang peladen.
 * Kalimatnya karena itu menyebut apa yang tidak dapat dikerjakan ALETA DAN
 * siapa yang dapat mengerjakannya - bukan nama pengaturan yang tidak pernah
 * ia lihat.
 *
 * Kode yang tidak dikenali tetap ditampilkan apa adanya. Menyembunyikannya di
 * balik "terjadi kesalahan" menghapus satu-satunya keterangan yang tersisa.
 */
const PESAN_GAGAL_UNGGAH = {
  akar_sipp_belum_disetel:
    "ALETA belum tahu di folder mana SIPP menyimpan berkasnya. Minta petugas server " +
    "menyetel folder SIPP pada pengaturan ALETA.",
  akar_sipp_tidak_ada:
    "Folder SIPP tidak terjangkau dari ALETA. Minta petugas server memeriksa " +
    "pemasangan folder SIPP ke ALETA.",
  akar_sipp_hanya_baca:
    "ALETA hanya diizinkan MEMBACA folder SIPP, jadi berkasnya tidak dapat disimpan. " +
    "Minta petugas server memberi izin tulis pada folder putusan dan anonimisasi.",
  bentuk_tidak_dikenali:
    "Isi berkasnya bukan naskah putusan - dikenali dari isinya, bukan dari namanya. " +
    "Yang diterima RTF, DOC, DOCX, atau PDF.",
  berkas_tidak_dapat_ditulis: "Berkasnya tidak dapat disimpan ke folder SIPP.",
  nomor_atau_tanggal_putusan_tidak_sah:
    "Nomor perkara atau tanggal putusannya belum terisi benar di SIPP, sehingga nama " +
    "berkasnya tidak dapat disusun.",
  pdf_belum_dapat_dibuat:
    "Naskahnya tersimpan sebagai e-Doc, tetapi PDF untuk Direktori Putusan belum dapat " +
    "dibuat. Barisnya ditunda, bukan dibatalkan.",
  berkas_kosong: "Berkasnya kosong.",
};

function pesanGagalUnggah(b) {
  const kode = String((b && b.alasan) || "");
  const kenal = PESAN_GAGAL_UNGGAH[kode];
  if (kenal) return b && b.pesan ? `${kenal} (${b.pesan})` : kenal;
  return `${kode.replace(/_/g, " ")}${b && b.pesan ? ` — ${b.pesan}` : ""}`;
}

/** Nama yang menandai berkas anonimisasi: "anonim…", "…_putusan_anonimisasi", atau "anom" berdiri sendiri. */
function namaBerkasAnonim(nama) {
  return /anonim|(?:^|[^a-z])anom(?:[^a-z]|$)/i.test(String(nama || ""));
}

/**
 * Satu kiriman ke rute unggah-sipp - satu-satunya tempat unggahan e-Doc
 * dikirim dari halaman SIPP. Jawaban yang menolak (mis. 409: slot anonim yang
 * masih memuat nama pihak) dibaca kalimatnya, bukan hanya kodenya.
 */
async function kirimBadanUnggahSipp(badan, batasMs) {
  const respons = await alatAmbil(
    ALETA_API_UNGGAH_SIPP,
    { method: "POST", body: badan, credentials: "include", batasMs: batasMs || BATAS_UNGGAH_SIPP_MS },
    "Mengunggah putusan ke SIPP"
  );
  let luar = null;
  let galatBaca = null;
  try {
    luar = await respons.json();
  } catch (galat) {
    galatBaca = galat;
  }
  const jawab = luar && luar.data ? luar.data : luar;
  if (!respons.ok) {
    const kalimat =
      respons.status !== 401 && respons.status !== 403 && jawab
        ? jawab.sebab || jawab.pesan || jawab.alasan || jawab.error || ""
        : "";
    const galat = new Error(kalimat ? String(kalimat) : alatPesanGagal(null, respons.status, "Mengunggah putusan ke SIPP"));
    // 12OKT-I: penolakan beralasan (409) ikut dibawa - "Tetap unggah" membaca bolehTetapUnggah & nama.
    if (respons.status === 409 && jawab && typeof jawab === "object") galat.tolak = jawab;
    throw galat;
  }
  if (!jawab) {
    throw new Error(`Jawaban ALETA atas unggahan tidak terbaca: ${String((galatBaca && galatBaca.message) || "kosong")}.`);
  }
  return jawab;
}

/* === 12OKT-I: "Tetap unggah" anonimisasi yang tersamar sebagian === */
/**
 * kirimBadanUnggahSipp + keputusan petugas atas sisa nama di anonimisasi.
 *
 *   - opsi.tetapUnggah ({nama}) = petugas SUDAH merelakan nama-nama itu di
 *     dialog pemeriksa ekstensi; diteruskan supaya server tidak menolak lagi
 *     nama yang sama.
 *   - Server tetap menilai sendiri: bila ia menemukan nama yang belum dilihat
 *     petugas, atau tidak satu pun nama tersamar, ia menolak 409. Bila
 *     penolakannya membolehkan (bolehTetapUnggah) dan ada wadah, daftar
 *     sisanya ditampilkan dengan tombol "Tetap unggah" - dikonfirmasi, lalu
 *     dikirim ulang SEKALI. Tanpa penyamaran sama sekali tidak ada tombolnya.
 * Hak unggah tetap di server (Hakim/Admin/Super Admin).
 */
async function kirimUnggahSippTetap(badan, batasMs, opsi) {
  const o = opsi || {};
  const pasang = (nama) => {
    badan.set("tetapUnggah", "1");
    badan.set("tetapUnggahNama", JSON.stringify(nama.slice(0, 50)));
  };
  if (o.tetapUnggah && Array.isArray(o.tetapUnggah.nama) && o.tetapUnggah.nama.length) pasang(o.tetapUnggah.nama);
  try {
    return await kirimBadanUnggahSipp(badan, batasMs);
  } catch (galat) {
    const tolak = galat && galat.tolak;
    if (!tolak || tolak.alasan !== "slot_anonim_memuat_nama" || !tolak.bolehTetapUnggah || !o.wadah) throw galat;
    const nama = [].concat(tolak.nama || []).map(String);
    if (o.kabar) {
      o.kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      o.kabar.textContent = "Anonimisasi masih memuat nama pihak - pilih di bawah: samarkan dulu, atau tetap unggah.";
    }
    const ya = await a30Tanya(o.wadah, {
      judul: "Anonimisasi masih memuat nama pihak",
      baris: [
        String(tolak.sebab || galat.message || ""),
        "Berkas anonimisasi ini TERBIT di Direktori Putusan dan dapat dibaca umum, apa adanya. " +
          "Bila dilanjutkan, edoc putusan dan edoc anonimisasi diunggah sekaligus, dan keputusan Anda " +
          "(nama yang dibiarkan, akun, waktu) tercatat di jejak ALETA.",
      ],
      daftar: nama.map((n) => `nama pihak "${n}" masih tertulis`),
      centang: "Saya sudah memeriksa, dan sisa nama ini memang dibiarkan terbit",
      ya: "Tetap unggah",
      tidak: "Batalkan, samarkan dulu",
    });
    try {
      alatCatat("a30-anonim", ya ? "tetap unggah dipilih sesudah penolakan server" : "tetap unggah tidak dipilih", nama.join(", "));
    } catch {
      /* kotak hitam hanya catatan */
    }
    if (!ya) throw galat;
    const sebelumnya = (o.tetapUnggah && o.tetapUnggah.nama) || [];
    pasang(Array.from(new Set(sebelumnya.concat(nama))));
    if (o.kabar) {
      o.kabar.className = "aleta-abt-kabar";
      o.kabar.textContent = "Mengunggah ulang dengan keputusan tetap unggah…";
    }
    return kirimBadanUnggahSipp(badan, batasMs);
  }
}

/**
 * Berapa lama jawaban SIPP ditunggu sesudah borangnya TERKIRIM. Lewat dari
 * ini, jajak basis data yang lama berjalan - jawaban yang tiba belakangan
 * tetap dibaca di sela jajak itu.
 */
const BATAS_JAWABAN_SIMPAN_MS = 20000;
let nomorBuktiSimpan = 0;

/**
 * Telinga untuk SATU penekanan Simpan: menunggu jawaban SIPP yang diteruskan
 * jembatan (jenis "bukti-simpan") dengan id miliknya sendiri. Dipasang
 * SEBELUM tombol ditekan, supaya jawaban yang tiba cepat tidak terlewat.
 */
function dengarBuktiSimpan() {
  nomorBuktiSimpan += 1;
  const id = `aleta-bukti-${Date.now()}-${nomorBuktiSimpan}`;
  let jawaban = null;
  let penunggu = null;
  const dengar = (peristiwa) => {
    if (peristiwa.source !== window) return;
    const isi = peristiwa.data;
    if (!isi || isi.sumber !== "aleta-jembatan-jawab" || isi.id !== id || isi.jenis !== "bukti-simpan") return;
    window.removeEventListener("message", dengar);
    jawaban = {
      asal: String(isi.asal || ""),
      st: isi.st === 0 || isi.st === 1 ? isi.st : null,
      pesan: String(isi.pesan || "").slice(0, 400),
    };
    if (penunggu) penunggu(jawaban);
  };
  window.addEventListener("message", dengar);
  return {
    id,
    jawaban: () => jawaban,
    tunggu(batasMs) {
      if (jawaban) return Promise.resolve(jawaban);
      return new Promise((selesai) => {
        const jam = setTimeout(() => {
          penunggu = null;
          selesai(null);
        }, batasMs);
        penunggu = (isi) => {
          clearTimeout(jam);
          penunggu = null;
          selesai(isi);
        };
      });
    },
    lepas: () => window.removeEventListener("message", dengar),
  };
}

/**
 * Menekan Simpan borang putusan, dengan telinga bukti terpasang.
 *
 * Penunjuk berikutnya dicoba HANYA bila tombolnya tidak ada. Tombol yang ada
 * tetapi tersembunyi, mati, di luar borang, ditahan mode kering, atau yang
 * jawabannya belum tiba TIDAK dicari lewat penunjuk lain: kedua penunjuk
 * dapat menunjuk tombol yang SAMA, dan menekannya lagi berarti mengirim
 * borangnya dua kali.
 */
async function tekanSimpanPutusan(idBukti) {
  let ditekan = { ok: false, alasan: "tombol_tidak_ketemu" };
  // Butir 10 (30 Sep 2026, Baru & UI Baru): konfirmasi SIPP "Apakah Anda
  // Yakin Akan Menyimpan Data" di-OK-kan jembatan HANYA selama tekanan ALETA
  // ini, lalu window.confirm dikembalikan (lihat jembatan.js). Lama: tanpa ruas ini.
  const setujui = typeof a30SetujuiKonfirmasiSimpan === "function" && a30SetujuiKonfirmasiSimpan();
  for (const penunjuk of PENUNJUK_SIMPAN_PUTUSAN) {
    const pesan = { jenis: "tekan", penunjuk, bukti: { borang: "#frm_putusan", id: idBukti } };
    if (setujui) pesan.setujuiKonfirmasi = true;
    ditekan =
      (await kirimKeJembatan(pesan)) ||
      { ok: false, alasan: "jembatan_tidak_menjawab" };
    if (ditekan.ok || ditekan.alasan !== "tombol_tidak_ketemu") break;
  }
  return ditekan;
}

/** Kalimat untuk tombol Simpan yang TIDAK ditekan - sebabnya disebut apa adanya. */
function bunyiSimpanTidakDitekan(ditekan) {
  const alasan = String((ditekan && ditekan.alasan) || "");
  const awal = "Isiannya sudah masuk blangko, tetapi ";
  if (alasan === "tombol_tidak_ketemu") {
    return `${awal}tombol Simpan SIPP tidak ditemukan di halaman ini - tekan Simpan sendiri.`;
  }
  if (alasan === "tombol_tidak_tampak") {
    return `${awal}tombol Simpan SIPP sedang disembunyikan halaman, jadi TIDAK ditekan. Periksa blangkonya, lalu tekan Simpan sendiri bila memang sudah waktunya.`;
  }
  if (alasan === "tombol_mati") return `${awal}tombol Simpan SIPP sedang mati - tekan Simpan sendiri bila sudah menyala.`;
  if (alasan === "tombol_di_luar_borang") {
    return `${awal}tombol yang ditemukan bukan milik blangko Putusan Akhir, jadi TIDAK ditekan - tekan Simpan sendiri.`;
  }
  if (alasan === "mode_kering") return `${awal}mode kering aktif: Simpan ditahan, SIPP tidak menyimpan apa pun.`;
  if (alasan === "mode_coba") return `${awal}mode coba aktif: Simpan ditahan, SIPP tidak menyimpan apa pun.`;
  // Latihan tidak mengisi blangko sama sekali - kalimat pembukanya tidak berlaku.
  if (alasan === "mode_latihan") {
    return "LATIHAN: isian TIDAK dimasukkan ke blangko dan Simpan TIDAK ditekan - SIPP tidak menyimpan apa pun. Lihat catatan latihan.";
  }
  return `${awal}tombol Simpan tidak dapat ditekan (${alasan || "tanpa alasan"}) - tekan Simpan sendiri.`;
}

/** Keadaan putusan yang SEGAR - tanpa simpanan, sebab inilah yang dibandingkan. */
async function bacaPutusanSegar(nomorPerkara) {
  try {
    const respons = await alatAmbil(
      `${ALETA_API_STATUS}?nomor=${encodeURIComponent(nomorPerkara)}`,
      { credentials: "include", cache: "no-store" },
      "Membaca keadaan putusan"
    );
    if (!respons.ok) return null;
    const hasil = await respons.json();
    const isi = hasil?.data ?? hasil;
    const status = isi?.status;
    if (!status) return null;
    const p = status.putusan || {};
    const lengkap = status.putusanLengkap || {};
    return {
      sudahPutus: Boolean(p.sudahPutus),
      tanggal: String(lengkap.tanggalPutusan || p.tanggalPutusan || ""),
      status: String(lengkap.statusPutusan || ""),
    };
  } catch {
    // Tidak terbaca bukan "belum tersimpan" - dua keadaan yang berbeda, dan
    // menyamakannya membuat putusan yang benar-benar masuk dilaporkan gagal.
    return null;
  }
}

function samaPutusan(a, b) {
  if (!a || !b) return false;
  return a.sudahPutus === b.sudahPutus && a.tanggal === b.tanggal && a.status === b.status;
}

/**
 * Laporan e-Doc sesudah Putusan Akhir tersimpan (agen B2, 20 Okt 2026): satu baris per langkah
 * dan muat ulang tetap di halaman perkara lewat modul bersama (muat-ulang-sipp.js). Pulang true
 * bila laporan + muat ulang sudah ditangani di sini; false = pemanggil memakai jalur lama
 * (tanpa rincian langkah, atau modul muat ulang tidak ada).
 */
function b2LaporkanEdoc(nomorPerkara, wadah, edoc, judulTersimpan) {
  const langkah = edoc && Array.isArray(edoc.langkah) ? edoc.langkah : [];
  if (!langkah.length || typeof muatUlangSesudahTulis !== "function") return false;
  const baris = [{ jenis: "Putusan Akhir", teks: "tersimpan di SIPP", ok: true }].concat(
    langkah.map((l) => ({ jenis: l.judul, teks: l.teks, ok: l.nada !== "salah" }))
  );
  const hasil = muatUlangSesudahTulis({
    nomor: nomorPerkara,
    judulOk: `${judulTersimpan} e-Doc selesai.`,
    judulGagal: `${judulTersimpan} e-Doc belum selesai seluruhnya.`,
    baris,
    wadah: wadah || undefined,
  });
  return Boolean(hasil);
}

/**
 * Menekan Simpan, menunggu SIPP benar-benar mencatatnya, lalu membuka kembali
 * halaman perkaranya.
 *
 * Urutan bukti: (1) jawaban SIPP sendiri - st 0 selesai seketika dengan
 * pesannya, tanpa satu pun jajak; (2) basis data - dengan jawaban, jajak
 * pertama SEKETIKA; tanpa jawaban, jajak lama sedetik sekali.
 *
 * @returns {Promise<{ok: boolean, bunyi: string, pesanSipp?: string}>}
 */
async function simpanPutusanLaluBuka(nomorPerkara, kabar, opsi) {
  // opsi hanya dikirim Baru/UI Baru (perbaikan 30 Sep, butir 10 & 19) - lihat
  // a30OpsiSimpanPutusan. Tanpa opsi: persis semula.
  const o = opsi || {};
  const dibacaPemanggil = o.sebelum ? await Promise.resolve(o.sebelum).catch(() => null) : null;
  const sebelum = dibacaPemanggil || (await bacaPutusanSegar(nomorPerkara));
  const telinga = dengarBuktiSimpan();
  const ditekan = await tekanSimpanPutusan(telinga.id);
  const belumTerjawab = ditekan.alasan === "jembatan_tidak_menjawab";
  if (!ditekan.ok && !belumTerjawab) {
    telinga.lepas();
    return { ok: false, bunyi: bunyiSimpanTidakDitekan(ditekan) };
  }

  if (kabar) {
    kabar.textContent =
      ditekan.konfirmasi === "disetujui"
        ? "Simpan ditekan, konfirmasi SIPP disetujui ALETA - menunggu jawaban SIPP…"
        : "Simpan ditekan - menunggu jawaban SIPP…";
  }
  const mulaiTunggu = Date.now();
  const terkirim = belumTerjawab || ditekan.bukti === "terkirim";
  let jawaban = terkirim ? await telinga.tunggu(BATAS_JAWABAN_SIMPAN_MS) : null;
  let batasPutaran = 10;
  for (let ke = 0; ke < batasPutaran; ke += 1) {
    jawaban = jawaban || telinga.jawaban();
    if (jawaban && jawaban.st === 0) break;
    // SIPP sudah menjawab tersimpan: jajak lebih rapat, anggaran 10 detiknya sama.
    const rapat = o.jajakCepat === true && Boolean(jawaban) && jawaban.st === 1;
    if (rapat) batasPutaran = 25;
    if (ke > 0 || !jawaban) await new Promise((selesai) => setTimeout(selesai, rapat ? 400 : 1000));
    const sesudah = await bacaPutusanSegar(nomorPerkara);
    if (!sesudah) continue;
    // Berubah berarti tersimpan. Perkara yang belum pernah diputus berubah
    // dari sudahPutus=false; yang diperbaiki berubah tanggal atau statusnya.
    const berubah = !samaPutusan(sebelum, sesudah) || (!sebelum && sesudah.sudahPutus);
    // SIPP menjawab tersimpan atas perkara yang SUDAH putus, dan tanggal serta
    // statusnya memang tidak berubah: yang disimpan ulang naskahnya, yang
    // tidak terbaca dari keadaan putusan. Jawaban SIPP itulah buktinya.
    const simpanUlang = !berubah && jawaban && jawaban.st === 1 && sebelum && sebelum.sudahPutus;
    if (berubah || simpanUlang) {
      telinga.lepas();
      const bunyi = berubah
        ? "Tersimpan di SIPP."
        : `Tersimpan di SIPP (${jawaban.pesan || "SIPP menjawab berhasil"}); tanggal dan status putusannya memang tidak berubah.`;
      // Butir 19: edoc putusan + anonimisasi SESUDAH tersimpan terbukti dan
      // SEBELUM halaman dimuat ulang. Gagal = halaman dibiarkan, sebabnya terbaca.
      if (typeof o.sesudahTersimpan === "function") {
        let lanjut = null;
        try {
          lanjut = await o.sesudahTersimpan(kabar);
        } catch (galat) {
          lanjut = { ok: false, bunyi: sambungSebab("Edoc tidak terunggah", galat, true) };
        }
        const bunyiLanjut = `${bunyi} ${(lanjut && lanjut.bunyi) || ""}`.trim();
        // Hasil edoc dipulangkan tersendiri supaya antrean massal dapat
        // mencatatnya per perkara (butir 6, 6 Okt 2026).
        const edoc = {
          ok: Boolean(lanjut && lanjut.ok),
          bunyi: String((lanjut && lanjut.bunyi) || "Edoc tidak terunggah."),
          ...(lanjut && Array.isArray(lanjut.langkah) ? { langkah: lanjut.langkah, perluBerkas: Boolean(lanjut.perluBerkas) } : {}),
        };
        // Agen B2: e-Doc yang dikerjakan putusan-edoc-sekaligus.js melapor per langkah (tercatat / sudah ada /
        // gagal+sebab). Laporan dan muat ulang tetap di perkara ini lewat modul bersama; ada yang gagal =
        // tidak dimuat ulang sendiri, hanya tombol. Antrean massal tetap memakai jalur lama di bawah.
        if (o.lanjutWalauEdocGagal !== true && typeof b2LaporkanEdoc === "function" && b2LaporkanEdoc(nomorPerkara, o.wadahLaporan || null, edoc, "Putusan Akhir tersimpan di SIPP.")) {
          return { ok: true, bunyi: `${bunyi} ${edoc.bunyi}`.trim(), pesanSipp: jawaban ? jawaban.pesan : "", edoc };
        }
        if (!lanjut || !lanjut.ok) {
          // Antrean massal: edoc yang gagal TIDAK menghentikan antrean -
          // putusannya sudah tersimpan, sebabnya tercatat di butir antrean,
          // dan halaman tetap dibuka kembali untuk perkara berikutnya.
          if (o.lanjutWalauEdocGagal === true) {
            if (kabar) kabar.textContent = `${bunyiLanjut} Halaman perkara dibuka kembali…`;
            setTimeout(muatUlangHalamanPerkara, 900);
            return { ok: true, bunyi: bunyiLanjut, pesanSipp: jawaban ? jawaban.pesan : "", edoc };
          }
          const tetap = `${bunyiLanjut} Halaman TIDAK dimuat ulang supaya keterangan ini terbaca.`;
          if (kabar) kabar.textContent = tetap;
          return { ok: true, bunyi: tetap, pesanSipp: jawaban ? jawaban.pesan : "", edoc };
        }
        if (kabar) kabar.textContent = `${bunyiLanjut} Halaman perkara dibuka kembali…`;
        setTimeout(muatUlangHalamanPerkara, 900);
        return { ok: true, bunyi: bunyiLanjut, pesanSipp: jawaban ? jawaban.pesan : "", edoc };
      }
      if (kabar) kabar.textContent = `${bunyi} Halaman perkara dibuka kembali…`;
      setTimeout(muatUlangHalamanPerkara, 900);
      return { ok: true, bunyi, pesanSipp: jawaban ? jawaban.pesan : "" };
    }
  }
  telinga.lepas();
  jawaban = jawaban || telinga.jawaban();

  const jagaIsian = " Halaman TIDAK dimuat ulang supaya isian yang sudah masuk tidak hilang.";
  if (jawaban && jawaban.st === 0) {
    const pesan = String(jawaban.pesan || "tanpa keterangan").replace(/[.\s]+$/, "");
    return {
      ok: false,
      bunyi: `SIPP menolak menyimpan: ${pesan}.${jagaIsian}`,
      pesanSipp: jawaban.pesan,
    };
  }
  const tambahan = jawaban
    ? ` SIPP menjawab: "${jawaban.pesan || "(tanpa pesan)"}".`
    : ditekan.bukti === "tanpa-kiriman"
      ? " Tidak ada kiriman blangko yang teramati sesudah Simpan ditekan - konfirmasi SIPP mungkin dibatalkan."
      : "";
  // Jembatan yang tidak menjawab tidak berarti Simpan sudah ditekan - dan
  // tidak juga berarti belum: konfirmasi SIPP yang masih terbuka menahan
  // jawabannya. Yang tidak diketahui disebut tidak diketahui.
  const awal = belumTerjawab
    ? "Permintaan menekan Simpan tidak dijawab halaman, dan"
    : "Simpan sudah ditekan, tetapi";
  const lama = Math.max(1, Math.round((Date.now() - mulaiTunggu) / 1000));
  return {
    ok: false,
    bunyi:
      `${awal} sesudah ${lama} detik SIPP belum mencatat perubahan apa pun.` +
      tambahan +
      " Periksa blangkonya - biasanya ada isian wajib yang ditolak SIPP." +
      jagaIsian,
    pesanSipp: jawaban ? jawaban.pesan : "",
  };
}

/**
 * ============================================================================
 * PRAPERIKSA PUTUSAN - AGEN YANG MEMBACA DAN BERHENTI (Tahap 2 rencana agen)
 * ============================================================================
 *
 * Tepat sebelum borang Putusan Akhir diisi dari draf ALETA, agen membaca
 * fakta SIPP - jadwal sidang, majelis, pihak, putusan yang sudah ada,
 * petitum - dan mengadunya dengan draf serta isian borang: tanggal putusan
 * yang diketik petugas, Status Putusan, verstek. Seluruh penimbangannya di
 * portal (src/lib/praperiksa-putusan.ts), di tempat yang dapat diuji; di
 * sini hanya membaca borang, meminta rapor, menggambarnya, dan BERHENTI.
 *
 * Tiga tingkat: hentikan (pertentangan yang dibuktikan dari SIPP - Isikan
 * mati, antrean menandai perkaranya ditahan), perhatian (tidak dapat
 * dipastikan mesin), catatan (apa yang diperiksa dan apa yang tidak dapat).
 * Tidak ada yang diperbaiki sendiri. Agen ini membaca; orang yang memutuskan.
 *
 * Yang tidak dapat diminta - portal tidak menjawab - DISEBUT, bukan
 * didiamkan: rapor yang kosong akan dibaca sebagai rapor yang lolos.
 */
const PENUNJUK_TANGGAL_PUTUSAN = ["#tgl_putusan", 'input[name="tgl_putusan"]', 'input[name="tanggal_putusan"]'];

/** Isian borang yang HANYA ada di halaman: tanggal putusan, status, verstek. */
async function bacaUsulanBorangPutusan() {
  // Perbaikan 1 Okt (S, butir 12 - UI Baru saja): ketiga bacaan berangkat
  // bersamaan. Hanya membaca; tanggal tetap diambil dari penunjuk PERTAMA
  // yang menjawab menurut urutan PENUNJUK_TANGGAL_PUTUSAN.
  if (typeof s1Aktif === "function" && s1Aktif() && typeof s1BacaUsulanBorangCepat === "function") {
    return s1BacaUsulanBorangCepat();
  }
  let tanggalPutusan = "";
  for (const penunjuk of PENUNJUK_TANGGAL_PUTUSAN) {
    const jawab = await kirimKeJembatan({ jenis: "nilai", penunjuk });
    if (jawab && jawab.ok) {
      tanggalPutusan = String(jawab.nilai || "");
      break;
    }
  }
  const terpilih = async (penunjuk) => {
    const jawab = await kirimKeJembatan({ jenis: "pilihan", penunjuk });
    if (!jawab || !jawab.ok) return { nilai: "", label: "" };
    const nilai = String(jawab.nilaiSekarang || "");
    const pilihan = (jawab.pilihan || []).find((x) => String(x.nilai) === nilai);
    return { nilai, label: pilihan ? String(pilihan.label || "") : "" };
  };
  const status = await terpilih('select[name="status_putusan"]');
  const verstek = await terpilih('select[name="verstek"]');
  return {
    tanggalPutusan,
    // "-1" adalah "Pilih Status Putusan" - belum dipilih, bukan status.
    statusPutusan: status.nilai === "-1" ? "" : status.label,
    // Borang SIPP menulis Y/T pada nilainya sendiri (edit_putusan_akhir.php).
    verstek: verstek.nilai === "Y" || verstek.nilai === "T" ? verstek.nilai : "",
  };
}

/** Meminta rapor praperiksa dari ALETA. Melempar bila ALETA tidak menjawab. */
async function mintaPraperiksaPutusan(nomorPerkara, usulan) {
  const respons = await alatAmbil(
    ALETA_API_PRAPERIKSA_PUTUSAN,
    {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nomorPerkara: nomorPerkara || "", ...(usulan || {}) }),
    },
    "Praperiksa putusan"
  );
  if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Praperiksa putusan"));
  const luar = await respons.json();
  return luar && luar.data ? luar.data : luar;
}

/** Judul-judul yang menahan, dalam satu kalimat - untuk catatan antrean dan kotak hitam. */
function ringkasHentikan(rapor) {
  return ((rapor && rapor.temuan) || [])
    .filter((t) => t.tingkat === "hentikan")
    .map((t) => t.judul)
    .join("; ");
}

/** Menggambar rapor agen: yang menahan di atas, perhatian di tengah, catatan di bawah. */
function gambarRaporAgen(rapor) {
  const kotak = buatElemen("div", "aleta-praperiksa aleta-praperiksa-agen");
  const kepala = buatElemen("div", "aleta-praperiksa-kepala");
  kepala.appendChild(buatElemen("span", "aleta-praperiksa-judul-agen", "Praperiksa ALETA"));
  kepala.appendChild(
    buatElemen(
      "span",
      `aleta-praperiksa-ringkas${rapor.hentikan ? " aleta-praperiksa-ringkas-henti" : ""}`,
      rapor.ringkas || ""
    )
  );
  kotak.appendChild(kepala);

  for (const t of rapor.temuan || []) {
    const kelas =
      t.tingkat === "hentikan"
        ? "aleta-praperiksa-henti"
        : t.tingkat === "perhatian"
        ? "aleta-praperiksa-ganjal"
        : "aleta-praperiksa-catatan";
    const baris = buatElemen("div", kelas);
    baris.appendChild(buatElemen("span", "aleta-praperiksa-judul", t.judul || ""));
    if (t.rincian) baris.appendChild(buatElemen("span", "aleta-praperiksa-rincian", t.rincian));
    kotak.appendChild(baris);
  }
  if (!(rapor.temuan || []).length) {
    kotak.appendChild(buatElemen("div", "aleta-praperiksa-catatan", "Tidak ada temuan."));
  }
  return kotak;
}

/**
 * Praperiksa untuk alur massal - tanpa wadah gambar; rapornya dipulangkan
 * dan yang menahan dituliskan pemanggil ke catatan antrean.
 *
 * Tidak dapat diminta bukan lolos, tetapi juga bukan pertentangan: dicatat
 * di kotak hitam, dan antrean berjalan seperti sebelum agen ini ada.
 */
async function praperiksaSebelumMengisi(nomorPerkara, kabar) {
  if (kabar) kabar.textContent = "Praperiksa: mengadu draf dengan fakta SIPP…";
  try {
    const usulan = await bacaUsulanBorangPutusan();
    const rapor = await mintaPraperiksaPutusan(nomorPerkara, usulan);
    if (!rapor || !rapor.ada) {
      alatCatat("praperiksa", `${nomorPerkara}: tidak dijalankan - ${(rapor && rapor.sebab) || "tidak ada jawaban"}`, "");
      return null;
    }
    alatCatat("praperiksa", `${nomorPerkara}: ${rapor.ringkas}`, ringkasHentikan(rapor));
    return rapor;
  } catch (galat) {
    alatCatat("praperiksa", `${nomorPerkara}: tidak dapat diminta - ${String((galat && galat.message) || galat)}`, "");
    return null;
  }
}

/**
 * ============================================================================
 * NILAI YANG DIPILIH BORANG SIPP SENDIRI - BUKAN PILIHAN SIAPA PUN
 * ============================================================================
 *
 * Pada borang Putusan Akhir yang baru dibuka (views/putusan/
 * edit_putusan_akhir.php dan managePutusanAkhir.php):
 *   verstek  tidak punya isian "Pilih", dan $verstek kosong - peramban
 *            memilih pilihan pertama, "Tidak".
 *   qobla    $qobla_bada hanya di-set dari baris perkara_akta_cerai, yang
 *            belum ada sebelum putusan. Variabel yang tidak di-set bernilai
 *            NULL, dan di PHP `NULL == 0` benar: "Qobla Dukhul" tercetak
 *            `selected` pada TIAP borang baru. (Di sipp_donggala 26 Sep
 *            2026: 0 dari 4.607 baris akta cerai ada sebelum putusan.)
 * Nilai itu tidak dianggap pilihan petugas - di panel satu perkara maupun di
 * antrean massal: tidak dikirim sebagai "terpilih" (usulan ALETA tidak
 * membeonya lewat hormatiTerpilih), boleh diganti usulan ALETA, dan di
 * antrean pilihan wajib yang MASIH pada nilai ini tanpa dikukuhkan usulan
 * ALETA menahan Simpan - "Qobla Dukhul" bawaan bukan jawaban.
 *
 * Isian "Pilih ..."/-1/kosong sudah dikenali nilaiTerpilihMedan. Akad
 * syariah sengaja tidak di sini: pilihannya berasal dari data perkara.
 */
const NILAI_BAWAAN_BORANG = {
  'select[name="verstek"]': "T",
  'select[name="qobla"]': "0",
};

/**
 * ============================================================================
 * YANG SUDAH TERPILIH DI HALAMAN IKUT DIKIRIM (KONTRAK K9)
 * ============================================================================
 *
 * Sampai 25 September 2026 portal hanya menerima daftar pilihan tiap medan,
 * tanpa tahu mana yang SUDAH dipilih petugas. Alasan dispensasi yang sudah
 * dipilih di halaman karena itu diusulkan ulang dari nol, dan cocok 0 dari 22
 * dengan isian manusia.
 *
 * Isian bawaan SIPP bukan pilihan, dan bentuknya tiga (edit_putusan_akhir.php):
 * nilai -1 ("Pilih Status", "Pilih Faktor", "Pilih Salah Satu"), nilai kosong
 * ("Pilih Keadaan Istri"), dan nilai 0 bertulisan "- Pilih -" atau
 * "Referensi belum ada" pada alasan dispensasi. Nilai 0 pada qobla justru SAH
 * ("Qobla Dukhul") - jadi yang menentukan tulisannya, bukan angkanya. Nilai
 * yang dipilih borang SIPP SENDIRI pada borang baru (qobla 0, verstek T)
 * disaring terpisah oleh nilaiTerpilihBukanBawaan di atas.
 *
 * Medan bernilai banyak (kotak centang sumber hukum) memulangkan daftar; yang
 * lain satu nilai. Yang belum terpilih memulangkan undefined, dan ruasnya
 * tidak ikut dikirim sama sekali.
 */
function nilaiTerpilihMedan(jawabPilihan, banyak) {
  const pilihan = (jawabPilihan && jawabPilihan.pilihan) || [];
  const isianBawaan = (x) => {
    const nilai = String(x && x.nilai !== undefined && x.nilai !== null ? x.nilai : "").trim();
    const label = String((x && x.label) || "").trim();
    return nilai === "" || nilai === "-1" || /^-?\s*pilih\b/i.test(label) || /^referensi belum ada$/i.test(label);
  };
  if (banyak) {
    const semua = pilihan.filter((x) => x && x.terpilih && !isianBawaan(x)).map((x) => String(x.nilai));
    return semua.length > 0 ? semua : undefined;
  }
  const sekarang = String(
    jawabPilihan && jawabPilihan.nilaiSekarang !== undefined && jawabPilihan.nilaiSekarang !== null
      ? jawabPilihan.nilaiSekarang
      : ""
  ).trim();
  if (!sekarang) return undefined;
  const opsi = pilihan.find((x) => String(x && x.nilai) === sekarang) || { nilai: sekarang, label: "" };
  return isianBawaan(opsi) ? undefined : sekarang;
}

/** Muatan POST isian-sipp untuk usulan medan pilihan - satu tempat, dapat diuji. */
function muatanUsulanMedan(nomorPerkara, jenisPerkara, daftar) {
  return {
    nomorPerkara: nomorPerkara || "",
    jenisPerkara: jenisPerkara || "",
    medan: (daftar || []).map((x) => {
      const butir = {
        kunci: x.kunci,
        label: x.label,
        pilihan: x.pilihan,
        banyak: x.banyak,
      };
      if (x.terpilih !== undefined) butir.terpilih = x.terpilih;
      return butir;
    }),
  };
}

function simpanPosisi(kiri, atas) {
  simpanKeadaanPanel({ kiri, atas });
}

function simpanUkuran(lebar, tinggi) {
  simpanKeadaanPanel({ lebar, tinggi });
}

function tombolTema(panel) {
  const tombol = buatElemen("button", "aleta-tema", "");
  tombol.type = "button";

  const perbaruiJudul = () => {
    const kini = keadaanTemaPusat();
    alatTampilkanTombolTema(tombol, kini.pilihan);
    tombol.title = judulTombolTemaSipp(kini.pilihan);
  };
  perbaruiJudul();

  tombol.addEventListener("click", (peristiwa) => {
    const pusat = globalThis.AletaTemaPusat;
    if (!pusat) return;
    // Pusat memasang penanda halaman SEKETIKA (sinkron) dan menyimpan
    // sesudahnya; pendengar tema di bawah menyegarkan panel dan tombol ini.
    if (peristiwa.shiftKey) {
      pusat.aturLapisan(!pusat.keadaan().lapisan);
    } else {
      const kini = pusat.keadaan();
      pusat.pilih(alatTemaDuaKeadaan() ? (kini.resolusi === "gelap" ? "terang" : "gelap") : ALAT_URUTAN_TEMA[kini.pilihan] || "terang");
    }
  });

  return tombol;
}

/**
 * Memasang lencananya dan pendengar yang membentangkannya kembali.
 *
 * Logonya dari berkas ekstensi, bukan huruf yang digambar dengan CSS: yang
 * melayang di atas halaman aplikasi lain harus dapat dikenali dalam sekejap
 * sebagai milik ALETA, dan sekejap itu tidak cukup untuk membaca.
 *
 * Tarikan DIBEDAKAN dari klik lewat JARAK, bukan waktu - lihat pasangGeser,
 * yang menandai panel dengan data-baru-digeser. Tanpa pembeda itu tiap
 * tarikan berakhir dengan lencana yang terbentang kembali, sebab tiap
 * tarikan diakhiri satu klik di atas lencananya.
 */
function pasangLencana(panel) {
  const lencana = buatElemen("div", "aleta-lencana");
  let alamatLogo = "";
  try {
    alamatLogo = chrome.runtime.getURL("ikon/aleta-32.png");
  } catch {
    /* di luar ekstensi - huruf yang dipakai sebagai gantinya */
  }
  if (alamatLogo) {
    const gambar = document.createElement("img");
    gambar.src = alamatLogo;
    gambar.alt = "ALETA";
    gambar.draggable = false;
    lencana.appendChild(gambar);
  } else {
    lencana.textContent = "A";
  }
  panel.appendChild(lencana);

  const bentangkan = (peristiwa) => {
    if (!panel.classList.contains(KELAS_LENCANA)) return;
    if (panel.dataset.baruDigeser === "1") {
      // Tarikan, bukan klik. Penandanya dilepas supaya klik BERIKUTNYA -
      // yang jarinya diam - dapat membentangkan.
      delete panel.dataset.baruDigeser;
      return;
    }
    peristiwa.preventDefault();
    peristiwa.stopPropagation();
    ciutkanKeLencana(panel, false);
  };
  lencana.addEventListener("click", bentangkan);
  lencana.addEventListener("dblclick", (peristiwa) => {
    delete panel.dataset.baruDigeser;
    bentangkan(peristiwa);
  });
  return lencana;
}

/**
 * Menjadikan kepala panel sebagai pegangan geser.
 *
 * Tombol di dalam kepala TIDAK ikut memulai geseran - kalau ikut, menekan
 * tombol lipat akan tertangkap sebagai awal geseran dan tombolnya jadi sulit
 * ditekan.
 */
/**
 * ============================================================================
 * MENARIK PANEL DARI SEGALA SISI
 * ============================================================================
 *
 * Delapan pegangan: empat sisi dan empat sudut.
 *
 * Menarik tepi KIRI atau ATAS mengubah dua hal sekaligus - ukurannya dan
 * tempatnya - sebab tepi seberangnya harus tetap diam. Menaruh lebar baru
 * tanpa memindahkan panelnya membuat seluruh panel ikut melompat ke kiri,
 * dan tarikan yang seharusnya memperlebar justru terasa menggeser.
 *
 * Batas dijepit LEBIH DULU, baru tempatnya dihitung dari ukuran yang sudah
 * dijepit itu. Kalau urutannya dibalik, panel yang sudah menyentuh lebar
 * minimum masih terus bergeser mengikuti kursor walau ukurannya berhenti
 * berubah - tepi seberang yang seharusnya diam malah berjalan sendiri.
 */
const ARAH_TARIK = [
  { nama: "u", x: 0, y: -1, sudut: false },
  { nama: "s", x: 0, y: 1, sudut: false },
  { nama: "b", x: -1, y: 0, sudut: false },
  { nama: "t", x: 1, y: 0, sudut: false },
  { nama: "ub", x: -1, y: -1, sudut: true },
  { nama: "ut", x: 1, y: -1, sudut: true },
  { nama: "sb", x: -1, y: 1, sudut: true },
  { nama: "st", x: 1, y: 1, sudut: true },
];

/** Sama dengan min-width/min-height di panel.css - dijaga sepasang. */
const TARIK_LEBAR_MIN = 260;
const TARIK_TINGGI_MIN = 150;

function pasangUbahUkuran(panel) {
  for (const arah of ARAH_TARIK) {
    const pegangan = buatElemen("div", "aleta-tarik aleta-tarik--" + arah.nama);
    if (arah.sudut) pegangan.classList.add("aleta-tarik--sudut");

    pegangan.addEventListener("pointerdown", (peristiwa) => {
      if (peristiwa.button !== 0) return;

      const kotak = panel.getBoundingClientRect();
      const mulaiX = peristiwa.clientX;
      const mulaiY = peristiwa.clientY;
      const awalKiri = kotak.left;
      const awalAtas = kotak.top;
      const awalLebar = kotak.width;
      const awalTinggi = kotak.height;

      // Batas atas dihitung sekali di awal tarikan, bukan tiap gerakan:
      // membaca innerWidth puluhan kali per detik memaksa peramban
      // menghitung ulang tata letak halaman SIPP di belakangnya.
      const lebarMaks = Math.min(window.innerWidth - 20, 900);
      const tinggiMaks = window.innerHeight - 20;

      const jepit = (nilai, kecil, besar) => Math.min(Math.max(nilai, kecil), Math.max(besar, kecil));

      const saatGerak = (gerak) => {
        const geserX = gerak.clientX - mulaiX;
        const geserY = gerak.clientY - mulaiY;

        let lebar = awalLebar;
        let tinggi = awalTinggi;
        let kiri = awalKiri;
        let atas = awalAtas;

        if (arah.x === 1) {
          lebar = jepit(awalLebar + geserX, TARIK_LEBAR_MIN, lebarMaks);
        } else if (arah.x === -1) {
          lebar = jepit(awalLebar - geserX, TARIK_LEBAR_MIN, lebarMaks);
          // Tepi kanan tetap di tempatnya.
          kiri = awalKiri + (awalLebar - lebar);
        }

        if (arah.y === 1) {
          tinggi = jepit(awalTinggi + geserY, TARIK_TINGGI_MIN, tinggiMaks);
        } else if (arah.y === -1) {
          tinggi = jepit(awalTinggi - geserY, TARIK_TINGGI_MIN, tinggiMaks);
          // Tepi bawah tetap di tempatnya.
          atas = awalAtas + (awalTinggi - tinggi);
        }

        if (arah.x !== 0) {
          panel.style.width = lebar + "px";
          panel.style.left = Math.max(kiri, 0) + "px";
          panel.style.right = "auto";
        }
        if (arah.y !== 0) {
          panel.style.height = tinggi + "px";
          panel.style.top = Math.max(atas, 0) + "px";
          panel.style.bottom = "auto";
          // Batas bawaan dilepas begitu tingginya diatur sendiri - kalau
          // tidak, panel setinggi apa pun tetap terpotong pada batas itu.
          panel.style.maxHeight = "none";
        }
      };

      const saatLepas = () => {
        document.removeEventListener("pointermove", saatGerak);
        document.removeEventListener("pointerup", saatLepas);
        document.removeEventListener("pointercancel", saatLepas);
        document.body.classList.remove("aleta-mengubah-ukuran");

        const akhir = panel.getBoundingClientRect();
        simpanUkuran(Math.round(akhir.width), Math.round(akhir.height));
        simpanPosisi(Math.round(akhir.left), Math.round(akhir.top));
      };

      // Dipasang pada document: kursor kerap mendahului tepi panel saat
      // ditarik cepat, dan pegangan selebar enam piksel tidak akan sempat
      // menerima gerakannya sendiri.
      document.addEventListener("pointermove", saatGerak);
      document.addEventListener("pointerup", saatLepas);
      document.addEventListener("pointercancel", saatLepas);
      document.body.classList.add("aleta-mengubah-ukuran");
      peristiwa.preventDefault();
      peristiwa.stopPropagation();
    });

    panel.appendChild(pegangan);
  }
}

function pasangGeser(panel, kepala) {
  let menggeser = false;
  let mulaiX = 0;
  let mulaiY = 0;
  let awalKiri = 0;
  let awalAtas = 0;

  panel.addEventListener("mousedown", (peristiwa) => {
    if (peristiwa.button !== 0) return;
    if (peristiwa.target.closest("button, a, input, select, textarea, .aleta-warna-pilih")) return;
    // ========================================================================
    // LENCANA DIGESER DARI LENCANANYA, PANEL DARI KEPALANYA
    // ========================================================================
    //
    // Pendengar ini dulu dipasang pada KEPALA panel, dan kepala itu
    // display:none begitu panelnya menjadi lencana - sehingga lencana yang
    // dijanjikan dapat digeser sesungguhnya tidak pernah dapat digeser sama
    // sekali. Satu-satunya jalan menyingkirkannya adalah membentangkannya
    // kembali lalu menggeser panelnya, yaitu justru yang tidak diinginkan
    // orang yang baru saja menciutkannya.
    //
    // Sekarang dipasang pada panel, dengan pagar ini: panel yang terbentang
    // tetap hanya digeser dari kepalanya - menyeret badannya berarti menyeret
    // teks yang sedang dibaca - sedangkan lencana digeser dari mana saja.
    if (!panel.classList.contains(KELAS_LENCANA) && !kepala.contains(peristiwa.target)) return;
    // Pegangan tarik menindih enam piksel teratas kepala panel. Tanpa penjaga
    // ini, menarik tepi atas menggeser DAN mengubah ukuran sekaligus - panel
    // melompat menjauh dari kursor sambil memendek. pointerdown tidak dapat
    // menghentikan mousedown lewat stopPropagation, sebab keduanya deretan
    // peristiwa yang terpisah, jadi penjaganya harus di sini.
    if (peristiwa.target.closest(".aleta-tarik")) return;

    const kotak = panel.getBoundingClientRect();
    menggeser = true;
    mulaiX = peristiwa.clientX;
    mulaiY = peristiwa.clientY;
    awalKiri = kotak.left;
    awalAtas = kotak.top;

    panel.classList.add("aleta-menggeser");
    peristiwa.preventDefault();
  });

  const saatGerak = (peristiwa) => {
    if (!menggeser) return;
    // Ambang empat piksel memisahkan TARIKAN dari KLIK. Dibaca pendengar
    // klik pada panel yang sedang berbentuk logo: tanpa pembeda ini, tiap
    // tarikan berakhir dengan logo yang terbentang kembali - sebab tiap
    // tarikan diakhiri satu klik di atas logonya, dan logonya jadi terasa
    // tidak dapat dipindahkan sama sekali.
    if (Math.abs(peristiwa.clientX - mulaiX) > 4 || Math.abs(peristiwa.clientY - mulaiY) > 4) {
      panel.dataset.baruDigeser = "1";
    }
    const kotak = panel.getBoundingClientRect();
    const aman = jepitKeLayar(
      awalKiri + (peristiwa.clientX - mulaiX),
      awalAtas + (peristiwa.clientY - mulaiY),
      kotak.width,
      kotak.height
    );
    panel.style.left = `${aman.kiri}px`;
    panel.style.top = `${aman.atas}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  };

  const saatLepas = () => {
    if (!menggeser) return;
    menggeser = false;
    panel.classList.remove("aleta-menggeser");
    const kotak = panel.getBoundingClientRect();
    simpanPosisi(Math.round(kotak.left), Math.round(kotak.top));
  };

  // Dipasang pada document, bukan pada panel: kursor kerap keluar dari panel
  // saat digeser cepat, dan tanpa ini panel tersangkut mengikuti kursor.
  document.addEventListener("mousemove", saatGerak);
  document.addEventListener("mouseup", saatLepas);
}

/**
 * ============================================================================
 * SATU DERET TOMBOL KEPALA, DIPAKAI SEMUA PANEL
 * ============================================================================
 *
 * Dulu hanya panel PERKARA yang punya deretan lengkapnya. Panel daftar
 * perkara - yang tampil di dashboard, daftar perdata, dan tiap halaman SIPP
 * yang bukan halaman perkara - hanya punya tema dan tutup.
 *
 * Akibatnya persis yang dilaporkan: di halaman perkara panelnya dapat
 * diciutkan, dilayarpenuhkan, dan dikembalikan; di halaman lain tidak ada satu
 * pun dari ketiganya. Satu ekstensi dengan dua perilaku pada dua halaman
 * terbaca sebagai ekstensi yang rusak di salah satunya.
 *
 * Sekarang deretnya satu, dan keduanya memakainya.
 */
function pasangTombolKepala(panel, kepala, keadaanAwal) {
  let keadaanPanel = keadaanAwal || null;
  // Tombol tema - lihat pasangTema().
  // ==========================================================================
  // TOMBOL KEPALA DI KANAN, DALAM URUTAN YANG SAMA DENGAN PANEL ABT DAN ALETA
  // ==========================================================================
  //
  // Kedua panel itu menaruh tombolnya di dalam .aleta-alat-kepala, yang
  // margin-left: auto - tombolnya di ujung kanan, merek di kiri. Panel ini
  // menempelkannya langsung ke kepala satu per satu, sehingga seluruhnya
  // berkumpul di sebelah merek dengan ruang kosong di kanan. Tiga panel
  // satu ekstensi yang kepalanya berbeda-beda mengajari orang bahwa
  // ketiganya alat yang berbeda.
  //
  // Urutannya mengikuti panel-alat: tema, ciutkan, layar penuh, bawaan,
  // tutup - supaya jari yang sudah hafal di satu panel tidak salah tekan di
  // panel lain.
  const alatKepala = buatElemen("span", "aleta-alat-kepala");

  // Lingkungan lebih dahulu daripada chip peran: yang menentukan aman atau
  // tidaknya sebuah tekanan bukan siapa Anda, melainkan SIPP yang mana.
  const lencanaLingkungan = alatLencanaLingkungan(penggunaTerakhir && penggunaTerakhir.peran);
  if (lencanaLingkungan) alatKepala.appendChild(lencanaLingkungan);
  alatTandaiLingkungan(panel);
  // Didaftarkan supaya warna dari popup menemukannya - dan supaya pelepasan
  // warna panel ini dikenali alatSelaraskanWarna. temaHalaman sengaja false:
  // tema halaman SIPP diurus terapkanTemaSipp di berkas ini, dan dua yang
  // mengurus hal yang sama akan saling menimpa.
  alatDaftarkanPanelTema(panel, { temaHalaman: false }, KUNCI_POSISI);
  alatPasangGulir(panel);
  // Chip peran berdiri PALING KIRI di deret ini - tepat sebelum tombol
  // tema. Ia keterangan, bukan tombol, dan menaruhnya di tengah deret
  // tombol membuat orang mencoba menekannya.
  if (penggunaTerakhir && penggunaTerakhir.peran) {
    const chipPeran = buatElemen(
      "span",
      `aleta-kepala-peran ${alatKelasPeran(penggunaTerakhir.peran)}`,
      penggunaTerakhir.peran
    );
    chipPeran.title = `Peran Anda di ALETA: ${penggunaTerakhir.peran}.`;
    alatKepala.appendChild(chipPeran);
    // Perannya ikut ditandai pada AKAR panel, bukan hanya pada chipnya -
    // dari situlah rel gradasi di tepi atas panel mengambil warnanya. Satu
    // atribut, dan ketiga panel ikut tanpa satu baris tambahan.
    alatTandaiPeranPanel(panel, penggunaTerakhir.peran);
  }
  alatKepala.appendChild(tombolTema(panel));
  // Enam warna gelap super admin - ikon saja, sesudah tombol tema. Panel
  // SIPP menyusun kepalanya sendiri, jadi pemilihnya dipasang di sini; yang
  // tersimpan dipulihkan lebih dulu supaya titik yang aktif benar.
  void alatWarnaTersimpan().then((warna) => {
    alatTerapkanWarna(panel, warna, false);
    alatPemilihWarna(panel, alatKepala, { peran: penggunaTerakhir && penggunaTerakhir.peran });
    alatTombolPerkakas(panel, alatKepala, {
      peran: penggunaTerakhir && penggunaTerakhir.peran,
      perkara: cariNomorPerkara(),
      akun: {
        aleta: penggunaTerakhir && penggunaTerakhir.nama ? `ALETA ${penggunaTerakhir.nama}` : "",
        sipp: akunSipp() ? `SIPP ${akunSipp()}` : "",
      },
    });
  });

  // ==========================================================================
  // LAYAR PENUH DAN CIUT MENJADI LOGO
  // ==========================================================================
  //
  // Dua kebutuhan yang berlawanan, dan keduanya nyata pada hari kerja yang
  // sama:
  //
  //   LAYAR PENUH  ketika membaca daftar panjang - tahapan, berkas, penilaian.
  //                Panel selebar 340 piksel memaksa menggulung untuk sesuatu
  //                yang sebenarnya muat pada layar.
  //   LOGO         ketika sedang mengisi formulir SIPP dan panelnya menghalangi.
  //                Menciutkan ke kepala saja masih menyisakan sebatang kotak
  //                selebar panel yang menutupi kolom di bawahnya.
  //
  // Keduanya dapat dibatalkan dengan menekan tombol yang sama, dan keduanya
  // TIDAK menghapus posisi tersimpan - panel kembali ke tempatnya semula.
  const penuh = buatElemen("button", "aleta-penuh", "⛶");
  penuh.type = "button";
  penuh.title = "Layar penuh";
  penuh.addEventListener("click", () => {
    const sedangPenuh = panel.classList.toggle("aleta-panel-penuh");
    penuh.textContent = sedangPenuh ? "⤢" : "⛶";
    penuh.title = sedangPenuh ? "Keluar dari layar penuh" : "Layar penuh";
    // Gaya inline dari geser dan ubah ukuran harus MENGALAH pada layar penuh,
    // kalau tidak panel tetap terpaku di tempat lamanya walau kelasnya ganti.
    // Nilainya tidak dibuang - hanya dilepas, dan dipasang kembali saat keluar.
    if (sedangPenuh) {
      for (const sifat of ["left", "top", "width", "height", "maxHeight"]) {
        panel.style[sifat] = "";
      }
    } else if (keadaanPanel) {
      terapkanPosisi(panel, keadaanPanel);
    }
  });
  alatKepala.appendChild(penuh);


  // Lencana melayang beserta pendengar yang membentangkannya kembali -
  // lihat pasangLencana. Satu bentuk yang sama dengan panel ABT dan panel
  // halaman ALETA.
  pasangLencana(panel);

  // ==========================================================================
  // ESCAPE DAN KLIK GANDA DI LUAR - DUA JALAN KELUAR YANG SELAMA INI HILANG
  // ==========================================================================
  //
  // Keduanya dipasang alatPasangJalanKeluar, dan alatPasangJalanKeluar hanya
  // dipanggil dari alatPasangPanel - satu-satunya pintu yang TIDAK dilewati
  // panel SIPP. Panel ini menyusun kepalanya sendiri (lihat catatan di atas)
  // dan memasang geser serta ubah-ukurannya sendiri pula, sehingga kedua
  // jalan keluar itu tidak pernah sampai ke sini.
  //
  // Itulah "klik dua kali dan escape tidak berfungsi di sipp": bukan
  // pendengarnya yang salah, melainkan tidak ada satu pun pendengar yang
  // dipasang.
  //
  // Menciutnya lewat ciutkanKeLencana milik berkas ini, bukan alatCiutkan:
  // keadaan lencana panel SIPP disimpan lewat simpanKeadaanPanel, dan dua
  // penyimpan untuk satu keadaan akan saling menimpa.
  alatPasangJalanKeluar(panel, KUNCI_POSISI, {
    ciutkan: () => ciutkanKeLencana(panel, true),
    // Perbaikan 2 Okt (S, butir 11 - dipanggil W hanya di UI Baru): klik 2x
    // sudut juga berlaku untuk panel yang berlabuh kanan - lihat s2PindahKeSudut.
    pindahKeSudut: (sudut) => (typeof s2PindahKeSudut === "function" ? s2PindahKeSudut(panel, sudut) : null),
  });

  // Tombol kembali ke bawaan.
  //
  // Panel yang dapat digeser dan diubah ukurannya juga dapat tersesat: ditarik
  // ke luar layar, dikecilkan sampai tidak terbaca, atau dilebarkan menutupi
  // SIPP. Tanpa jalan pulang, satu-satunya cara memperbaikinya adalah membongkar
  // penyimpanan ekstensi - dan tidak ada petugas yang akan melakukan itu.
  const bawaan = buatElemen("button", "aleta-bawaan", "↺");
  bawaan.type = "button";
  bawaan.title = "Kembalikan ukuran dan posisi panel ke semula";
  bawaan.addEventListener("click", () => kembalikanBawaan(panel));
  alatKepala.appendChild(bawaan);

  // ==========================================================================
  // MENCIUTKAN BERARTI MENJADI LOGO - BUKAN MENYISAKAN KOTAK
  // ==========================================================================
  //
  // Dulu ada DUA tombol: berlian yang menciutkan menjadi logo, dan minus yang
  // menyembunyikan isi tetapi menyisakan kepalanya - sebatang kotak selebar
  // panel yang menutupi kolom di bawahnya tanpa menampilkan satu pun
  // keterangan. Yang kedua itu yang dilaporkan sebagai "kotak melayang".
  //
  // Dua tombol yang sama-sama "mengecilkan" tetapi menghasilkan bentuk yang
  // berbeda menuntut orang mengingat bedanya. Sekarang satu, dan hasilnya
  // yang memang berguna: logo bulat yang dapat digeser dan dibuka lagi
  // dengan satu klik.
  const lipat = buatElemen("button", "aleta-lipat", "–");
  lipat.type = "button";
  lipat.title = "Ciutkan menjadi lencana";
  lipat.addEventListener("click", () => {
    panel.classList.remove("aleta-panel-ciut");
    ciutkanKeLencana(panel, true);
  });
  // Ciutkan berdiri TEPAT sesudah tema, sebelum layar penuh - urutan
  // panel-alat. insertBefore, sebab tombol layar penuh sudah lebih dulu
  // dibuat di atas.
  alatKepala.insertBefore(lipat, penuh);

  // Saklar mati di kepala panel.
  //
  // Saklarnya memang sudah ada di popup ekstensi, tetapi popup itu berada
  // di bilah ekstensi Chrome - tempat yang harus dicari lebih dulu. Petugas
  // yang panelnya menghalangi pekerjaan butuh mematikannya SEKARANG, dan
  // yang tidak menemukan saklarnya akan menutup panel berulang kali setiap
  // halaman - lalu berhenti memakai ekstensinya sama sekali.
  alatKepala.appendChild(tombolMatikan());
  kepala.appendChild(alatKepala);

  // Klik ganda pada kepala: layar penuh, klik ganda lagi: kembali (butir 18,
  // 30 Sep 2026). Panel ini tidak lewat alatPasangPanel, jadi dipasang di
  // sini. Hanya Baru & UI Baru - a30KlikGandaKepala pulang seketika di Lama.
  kepala.addEventListener("dblclick", (peristiwa) => {
    if (typeof a30KlikGandaKepala === "function") a30KlikGandaKepala(panel, peristiwa);
  });
}

/**
 * Panel saat peran pengguna tidak diberi akses.
 *
 * ============================================================================
 * DITOLAK BUKAN BELUM MASUK
 * ============================================================================
 *
 * Sebelumnya 403 diperlakukan sama dengan 401, sehingga pengguna yang sudah
 * masuk tetapi tidak berwenang diminta "Masuk ke ALETA" - lalu masuk, lalu
 * ditolak lagi, tanpa pernah diberi tahu apa yang sebenarnya terjadi.
 *
 * Pesannya tidak menyebut kemampuan apa yang kurang secara rinci. Yang perlu
 * diketahui pengguna adalah kepada siapa harus meminta, bukan bagian mana dari
 * penjagaan yang menahannya.
 */
/**
 * Tombol matikan di kepala panel.
 *
 * Dulu disusun sebaris di dalam susunPanel, sehingga panel daftar - yang lahir
 * belakangan - tidak punya tombolnya sama sekali. Satu aturan di satu tempat:
 * tiap panel yang punya kepala mendapat tombol yang sama persis.
 */
function tombolMatikan() {
  const matikan = buatElemen("button", "aleta-matikan", "×");
  matikan.type = "button";
  matikan.title = "Matikan ALETA E-Court untuk halaman ini (dapat dinyalakan lagi dari ikon ekstensi)";
  // UI Baru: × hanya menutup - panel menciut ke lencana, ALETA tetap aktif
  // (lihat alatTutupHanyaMenciut di panel-alat.js). Lama dan Baru: semula.
  matikan.addEventListener("mouseenter", () => {
    matikan.title = alatTutupHanyaMenciut()
      ? ALAT_JUDUL_TUTUP_BARU
      : "Matikan ALETA E-Court untuk halaman ini (dapat dinyalakan lagi dari ikon ekstensi)";
  });
  matikan.addEventListener("click", () => {
    const panelIni = matikan.closest(".aleta-panel");
    if (alatTutupHanyaMenciut() && panelIni) {
      ciutkanKeLencana(panelIni, true);
      return;
    }
    try {
      void chrome.storage.local.set({ aktif: false });
    } catch {
      // Penyimpanan tidak tersedia: panel tetap ditutup untuk halaman ini.
      const lama = document.getElementById(PENANDA);
      if (lama) lama.remove();
    }
  });
  return matikan;
}

/*
 * ============================================================================
 * PUTUSAN MASSAL DI SIPP - MELANJUTKAN ANTREAN, SATU PERKARA DI HALAMANNYA
 * ============================================================================
 *
 * Dua jalan masuk, satu mesin:
 *
 *   FITUR 2  ALETA membaca sidang pada satu tanggal, menyusun antrean SIPP
 *            sendiri, dan mengisikan putusan tiap perkara.
 *   FITUR 3  Antrean datang dari tahap ABT (tab lain menuliskannya ke
 *            chrome.storage); di sini tinggal isian datanya.
 *
 * Kenapa PER PERKARA DI HALAMANNYA, bukan berpindah sendiri:
 *
 *   Borang putusan SIPP hanya dapat diisi ketika halamannya terbuka - jembatan
 *   menyentuh CKEditor dan select2 di halaman ini, bukan di halaman lain.
 *   Membuka perkara berikutnya menuntut tautan perkara_detil/<token>, dan
 *   tokennya hasil enkripsi SIPP yang tidak dapat dibuat dari sini. Karena itu
 *   antreannya melangkah bersama Anda: begitu satu perkara tersimpan, ALETA
 *   menandainya selesai dan menyebut perkara berikutnya - Anda membukanya,
 *   dan pada mode otomatis ALETA langsung mengisikannya begitu borangnya ada.
 *
 * Yang membuatnya AMAN: tiap perkara diperiksa lebih dulu apakah sudah putus
 * (tidak diisi ulang), isiannya dibuktikan tersimpan dari SIPP - bukan dari
 * tombol yang berhasil ditekan - dan satu perkara gagal tidak menyentuh sisa
 * antrean.
 */

/** Bagian antrean SIPP: muncul di panel perkara DAN panel daftar bila ada antrean. */
async function bagianAntreanSipp(nomorHalaman) {
  const antrean = await alatMuatAntrean();
  if (!antrean || antrean.tahap !== "sipp") return null;

  const kotak = bagian("Putusan massal · lanjutan SIPP", "antreanSipp", false);
  // Penanda untuk menggantinya di tempat - lihat tampilkanAntreanSipp.
  kotak.classList.add("aleta-antrean-sipp");
  const isi = kotak.isi;
  const h = alatAntreanRingkas(antrean);
  // 9 Okt 2026: tombol "Perbarui ekstensi" ditahan selama antrean ini masih
  // punya perkara menunggu/sedang dikerjakan - lihat alatLaporAntreanPutusanSipp.
  if (typeof alatLaporAntreanPutusanSipp === "function") alatLaporAntreanPutusanSipp(antrean);

  // "Tertahan" punya dua sebab yang ditangani petugas secara berbeda:
  // praperiksa menahan karena fakta SIPP bertentangan dengan draf, sedangkan
  // gagal-isi menahan karena medan borang tidak terisi sehingga Simpan tidak
  // ditekan. Sampai 26 September 2026 keduanya terhitung "ditahan
  // praperiksa". Butir tanpa sebabTahan berasal dari praperiksa - satu-satunya
  // penahan sebelum ruas itu lahir. Sebab yang belum bernama tetap dihitung
  // dan disebut apa adanya, tidak dibuang dari ringkasan.
  const tahan = { praperiksa: 0 };
  for (const b of antrean.butir) {
    if (b.keadaan !== "tertahan") continue;
    const sebab = b.sebabTahan || "praperiksa";
    tahan[sebab] = (tahan[sebab] || 0) + 1;
  }
  // Nama tiap sebab satu tempat dengan baris antrean dan kabar - lihat
  // NAMA_SEBAB_TAHAN di bawah jalankanAntreanSippSekali.
  const teksTahan = Object.keys(tahan)
    .map((sebab) => `${tahan[sebab]} ${NAMA_SEBAB_TAHAN[sebab] || `tertahan (${sebab})`}`)
    .join(", ");

  // Asalnya disebut apa adanya. Sampai 26 September 2026 kalimat ini berbunyi
  // "Antrean dari tahap ABT" untuk SETIAP antrean di sini - termasuk yang
  // disusun dari berkas dan dari jadwal sidang - sebab tahap ketiganya "sipp".
  const ASAL_ANTREAN = {
    abt: "tahap ABT",
    sidang: `jadwal sidang ${antrean.tanggalSidang || ""}`.trim(),
    berkas: "berkas naskah putusan",
  };
  isi.appendChild(
    buatElemen(
      "div",
      "aleta-tetap-sebab",
      `Antrean dari ${ASAL_ANTREAN[antrean.asal] || "putusan massal"} — ` +
        `${h.selesai} selesai, ${h.menunggu + h.jalan} menunggu, ${h.gagal} gagal, ${teksTahan}.`
    )
  );
  // ==========================================================================
  // YANG MENEKAN SIMPAN DISEBUT - DI TIAP MODE
  // ==========================================================================
  //
  // Kedua mode menekan tombol Simpan SIPP. Sampai 26 September 2026 layar
  // hanya berkata "Mode: otomatis", dan antrean dari berkas - yang diam-diam
  // menjadi otomatis - tidak menyebutnya di mana pun.
  isi.appendChild(
    buatElemen(
      "div",
      "aleta-tetap-sebab aleta-massal-simpan",
      antrean.modus === "otomatis"
        ? "Mode otomatis: begitu blangko Putusan Akhir perkara di antrean terbuka, ALETA mengisinya dari draf " +
            "lalu MENEKAN SIMPAN SIPP SENDIRI - satu kali per perkara. Perkara yang tertahan tidak disimpan."
        : "Mode manual: ALETA berhenti di tiap perkara. Tombol “Isi putusan & simpan” mengisi blangko " +
            "lalu MENEKAN SIMPAN SIPP untuk perkara itu."
    )
  );

  // Peta nomor→butir untuk mengenali "apakah perkara halaman ini di antrean".
  const berikutnya = alatAntreanBerikutnya(antrean);
  const daftar = buatElemen("div", "aleta-massal-daftar");
  for (const b of antrean.butir) {
    // Edoc antrean yang gagal (butir 6): putusannya tersimpan, edocnya belum - kuning, bukan hijau.
    const edocGagal = b.keadaan === "selesai" && /^gagal/.test(String(b.edoc || ""));
    const baris = buatElemen("div", `aleta-perkakas-baris ${edocGagal ? "aleta-perkakas-awas" : b.keadaan === "selesai" ? "aleta-perkakas-baik" : b.keadaan === "gagal" ? "aleta-perkakas-buruk" : b.keadaan === "dilewati" ? "" : "aleta-perkakas-awas"}`);
    baris.appendChild(buatElemen("span", "aleta-perkakas-nama", b.nomor));
    baris.appendChild(buatElemen("span", "aleta-perkakas-nilai", b.catatan || namaKeadaanButir(b)));
    daftar.appendChild(baris);
    // Pilihan borang yang diisikan ALETA dari BAWAAN - naskahnya diam, jadi
    // nilai itu kesimpulan, bukan kutipan. Disebut per perkara supaya
    // diperiksa, juga sesudah tersimpan (lihat isianPilihan pada 3a).
    const dariBawaan = (b.isianPilihan || []).filter((x) => x && x.asal === "bawaan");
    if (dariBawaan.length > 0) {
      daftar.appendChild(
        buatElemen(
          "div",
          "aleta-perkakas-baris aleta-perkakas-awas aleta-massal-bawaan",
          `${b.nomor}: diisi bawaan - periksa: ${dariBawaan.map((x) => `${x.medan} "${x.nilai}"`).join(", ")}`
        )
      );
    }
  }
  isi.appendChild(daftar);

  const kabar = buatElemen("div", "aleta-abt-kabar");
  isi.appendChild(kabar);

  const aksi = buatElemen("div", "aleta-abt-aksi");
  isi.appendChild(aksi);

  const halamanIni = nomorHalaman || cariNomorPerkara();
  const butirIni = antrean.butir.find(
    (x) => x.nomor === halamanIni && (x.keadaan === "menunggu" || x.keadaan === "jalan")
  );
  const adaBorang = Boolean(document.querySelector("#frm_putusan"));

  if (butirIni && adaBorang) {
    // Perkara halaman ini memang yang ditunggu, dan borangnya terbuka.
    const tombol = buatElemen("button", "aleta-permintaan-tombol", "Isi putusan & simpan (dari draf ALETA)");
    tombol.type = "button";
    aksi.appendChild(tombol);
    tombol.addEventListener("click", () => void jalankanAntreanSippSekali(antrean, butirIni, kabar, tombol, false));

    // Mode otomatis: langsung jalan, tanpa menunggu ditekan.
    //
    // ========================================================================
    // SATU PERKARA, SATU SIMPAN - WALAU PANELNYA DIGAMBAR ULANG
    // ========================================================================
    //
    // Panel perkara digambar ulang tiap borang di halaman berganti, dan tiap
    // gambar memanggil bagian ini. Sampai 26 September 2026 tiap gambar
    // memasang pewaktunya sendiri, dan pewaktu dari panel yang sudah dibuang
    // tetap berbunyi: dua gambar dalam 600 ms berarti dua pengisian serentak
    // atas perkara yang sama - dan Simpan SIPP ditekan dua kali. Kini pewaktu
    // panel yang sudah lepas dari halaman diam, dan jalankanAntreanSippSekali
    // menolak berjalan kedua kalinya di halaman yang sama.
    //
    // Perkara yang tercatat "sedang dikerjakan" ketika halaman dimuat berarti
    // pekerjaan sebelumnya TERPUTUS (halaman dimuat ulang atau ditutup di
    // tengah jalan). Simpan-nya mungkin sudah ditekan; mengulangnya sendiri
    // bisa menekannya lagi. Diserahkan ke petugas lewat tombolnya.
    if (antrean.modus === "otomatis") {
      if (butirIni.keadaan === "jalan") {
        kabar.textContent =
          `${butirIni.nomor} tercatat sedang dikerjakan ketika halaman ini dimuat - pekerjaan sebelumnya terputus. ` +
          "Tidak diulang sendiri: periksa blangkonya, lalu tekan tombol di bawah bila memang belum tersimpan.";
      } else {
        kabar.textContent = "Mode otomatis — mengisi perkara ini lalu menekan Simpan SIPP…";
        // 5 Okt 2026: tanpa jeda 600 ms tetap. Yang dulu ditunggunya -
        // CKEditor blangko yang belum siap - kini ditunggu menurut keadaannya
        // sendiri tepat sebelum diisi (kirimKeJembatan, CKEDITOR status).
        setTimeout(() => {
          if (!kotak.isConnected) return;
          void jalankanAntreanSippSekali(antrean, butirIni, kabar, tombol, true);
        }, 0);
      }
    }
  } else if (berikutnya) {
    // Bukan perkara yang ditunggu (atau borangnya belum dibuka). Sebutkan
    // yang berikutnya, dan biarkan orang membukanya - tautannya tidak dapat
    // dibuat dari sini.
    isi.appendChild(
      buatElemen(
        "div",
        "aleta-massal-jeda",
        adaBorang
          ? `Perkara berikutnya di antrean: ${berikutnya.nomor}. Buka perkara itu di SIPP, lalu buka blangko putusannya.`
          : antrean.modus === "otomatis"
            ? `Perkara berikutnya: ${berikutnya.nomor}. Buka halaman perkaranya — ALETA membuka blangko Putusan Akhir sendiri (tombol SIPP "Tambah Putusan Akhir"/"Edit Putusan Akhir"), mengisikannya, lalu menekan Simpan SIPP.`
            : `Perkara berikutnya: ${berikutnya.nomor}. Buka halaman perkaranya, lalu tekan "Buka blangko Putusan Akhir" (atau buka blangkonya sendiri) — ALETA akan mengisikannya.`
      )
    );
  } else {
    isi.appendChild(buatElemen("div", "aleta-tetap-sebab", "Seluruh antrean selesai."));
  }

  // Perkara halaman ini ada di antrean tetapi blangkonya belum terbuka:
  // ALETA membukanya sendiri lewat tombol SIPP ("Tambah Putusan Akhir" /
  // "Edit Putusan Akhir") - mode otomatis seketika, mode manual atas tombol.
  // Sampai 5 Oktober 2026 antrean berhenti di sini menunggu tangan petugas.
  if (butirIni && !adaBorang && typeof antreanPasangBukaBlangko === "function") {
    antreanPasangBukaBlangko({ kotak, aksi, kabar, antrean, butir: butirIni });
  }

  const hentikan = buatElemen("button", "aleta-perkakas-aksi", "Akhiri antrean");
  hentikan.type = "button";
  hentikan.title = "Membuang antrean ini. Perkara yang sudah tersimpan tetap tersimpan.";
  hentikan.addEventListener("click", async () => {
    // Penyimpanan yang tidak terjangkau (ekstensi dimuat ulang) tidak
    // mengakhiri apa pun - dahulu panelnya tetap dibuang, dan antrean yang
    // masih tersimpan hidup lagi di halaman berikutnya tanpa kabar.
    if ((await alatSimpanAntrean(null)) === false) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent =
        "Antrean BELUM diakhiri: penyimpanannya tidak terjangkau dari halaman ini (ALETA baru saja dimuat ulang atau diperbarui). Muat ulang halaman ini, lalu tekan Akhiri antrean lagi.";
      return;
    }
    alatCatat("massal", "antrean SIPP diakhiri oleh pengguna", "");
    if (typeof alatAntreanKerjaLepas === "function") alatAntreanKerjaLepas(`putusan-massal-sipp:${antrean.id || "aktif"}`);
    kotak.remove();
  });
  aksi.appendChild(hentikan);

  return kotak;
}

/**
 * Nomor perkara antrean yang SEDANG dikerjakan di halaman ini, atau kosong.
 * Satu halaman, satu pengerjaan - lihat catatan pada mode otomatis di
 * bagianAntreanSipp.
 */
let antreanSippBerjalan = "";

/**
 * Antrean tidak dapat dibaca/ditulis dari halaman ini (uji rilis 9 Okt 2026):
 * "terputus" = ekstensi dimuat ulang atau diperbarui selagi halaman terbuka;
 * "gagal-tulis" = penyimpanan peramban menolak. Bukan "antrean diakhiri" -
 * antreannya masih ada, halaman inilah yang kehilangan jalannya ke sana.
 */
function kalimatAntreanTakTerjangkau(sebab, nomor) {
  return sebab === "terputus"
    ? `ALETA baru saja dimuat ulang atau diperbarui, jadi antrean tidak terjangkau dari halaman ini. ${nomor} tidak dikerjakan dan Simpan tidak ditekan - muat ulang halaman ini (F5), lalu lanjutkan antreannya.`
    : `Antrean tidak dapat dicatat di penyimpanan peramban ini. ${nomor} tidak dikerjakan dan Simpan tidak ditekan - muat ulang halaman ini, lalu coba lagi.`;
}

/**
 * Pintu tunggal ke jalankanSatuAntreanSipp dari panel antrean - tombol maupun
 * mode otomatis.
 *
 * Keadaan perkaranya dibaca ULANG dari penyimpanan sebelum mulai: panel yang
 * digambar sebelum perkara ini disentuh memegang salinan lama, dan salinan
 * lama itulah yang dahulu menjawab "masih menunggu" atas perkara yang sudah
 * tersimpan. Mode otomatis hanya mengerjakan yang masih MENUNGGU; tombol
 * boleh pula melanjutkan yang terputus ("jalan").
 *
 * Membaca dan menandai "jalan" kini SATU baca-ubah-tulis (klaim) di bawah
 * kunci antrean - lihat alatUbahButirAntrean di panel-alat.js. Sampai 26
 * September 2026 keduanya terpisah: dua tab yang membuka borang perkara yang
 * sama sama-sama membaca "menunggu", lalu Simpan SIPP ditekan dua kali.
 */
async function jalankanAntreanSippSekali(antrean, butir, kabar, tombol, otomatis) {
  if (antreanSippBerjalan) {
    if (kabar) kabar.textContent = `${antreanSippBerjalan} sedang dikerjakan di halaman ini - tunggu sampai selesai.`;
    return;
  }
  antreanSippBerjalan = butir.nomor;
  try {
    const klaim = await alatUbahButirAntrean(antrean.id, butir.nomor, (b) => {
      const boleh = b.keadaan === "menunggu" || (!otomatis && b.keadaan === "jalan");
      if (!boleh) return false;
      b.keadaan = "jalan";
      b.pemegang = ALAT_PENANDA_HALAMAN;
    });
    if (!klaim.ok) {
      if (kabar) {
        kabar.textContent =
          klaim.sebab === "terputus" || klaim.sebab === "gagal-tulis"
            ? kalimatAntreanTakTerjangkau(klaim.sebab, butir.nomor)
            : klaim.sebab === "diakhiri" || klaim.sebab === "diganti"
              ? "Antrean ini sudah diakhiri atau diganti antrean lain - tidak ada yang dikerjakan."
              : `${butir.nomor} sudah ${klaim.butir ? namaKeadaanButir(klaim.butir) : "tidak ada di antrean"} - tidak dikerjakan lagi.`;
      }
      return;
    }
    const kini = klaim.butir;
    if (typeof alatLaporAntreanPutusanSipp === "function") alatLaporAntreanPutusanSipp(antrean);
    try {
      await jalankanSatuAntreanSipp(antrean, kini, kabar, tombol);
    } catch (galat) {
      // Tidak ditelan. Dahulu galat di sini hanya menjadi penolakan janji
      // yang tidak ditunggu siapa pun: perkaranya tertinggal "sedang
      // dikerjakan", tombolnya mati, dan kabarnya tetap "mengisi…". Kini ia
      // gagal beserta sebabnya, dan antrean dapat berlanjut. Simpan mungkin
      // sudah ditekan sebelum galatnya terjadi - itu disebut, bukan ditebak.
      const pesan = String((galat && galat.message) || galat);
      kini.keadaan = "gagal";
      kini.catatan = `pengerjaan terhenti oleh error: ${pesan} - periksa di SIPP apakah putusannya sudah tersimpan`;
      // Hanya butir ini, hanya pada antrean yang sama, dan hanya selama masih
      // dipegang halaman ini - bukan salinan utuh yang mungkin sudah basi.
      await alatUbahButirAntrean(antrean.id, kini.nomor, (b) => {
        if (b.pemegang && b.pemegang !== ALAT_PENANDA_HALAMAN) return false;
        b.keadaan = kini.keadaan;
        b.catatan = kini.catatan;
      });
      alatCatat("massal-galat", `${kini.nomor}: ${kini.catatan}`, "");
      if (kabar) {
        kabar.className = "aleta-abt-kabar aleta-abt-gagal";
        kabar.textContent = `${kini.nomor}: ${kini.catatan}`;
      }
      if (tombol) tombol.disabled = false;
    }
  } finally {
    antreanSippBerjalan = "";
    // Kemajuan sesudah butir ini - dibaca ULANG, salinan di tangan basi.
    if (typeof alatLaporAntreanPutusanSipp === "function") {
      void alatMuatAntrean()
        .then((segar) => alatLaporAntreanPutusanSipp(segar))
        .catch(() => undefined);
    }
  }
}

/**
 * Perkara antrean yang blangkonya sudah dicoba dibuka SENDIRI di halaman ini,
 * beserta kabar kegagalannya (kosong = berhasil/sedang). Satu percobaan
 * otomatis per perkara per pemuatan halaman - panel yang digambar ulang tidak
 * mengulangnya; tombolnya tetap ada untuk mencoba lagi.
 */
const antreanBlangkoDibuka = new Map();

/**
 * Tombol "Buka blangko Putusan Akhir" untuk perkara antrean halaman ini, dan
 * pada mode otomatis pembukaannya sendiri. Membuka tingkap SIPP lewat tombol
 * SIPP (s1BukaBlangkoPutusan) - tidak menulis apa pun. Sesudah blangkonya
 * lahir panel digambar ulang seketika (gambarUlangSesudahBlangko), dan cabang
 * "butirIni && adaBorang" di bagianAntreanSipp yang mengisi lalu menyimpan.
 */
function antreanPasangBukaBlangko(p) {
  if (typeof s1BukaBlangkoPutusan !== "function") return;
  const { kotak, aksi, kabar, antrean, butir } = p;
  const kunci = String(butir.nomor || "").replace(/\s+/g, "").toUpperCase();
  const tombol = buatElemen("button", "aleta-permintaan-tombol aleta-antrean-buka-blangko", "Buka blangko Putusan Akhir");
  tombol.type = "button";
  tombol.title = 'Membuka blangko lewat tombol SIPP "Tambah Putusan Akhir" (atau Edit Putusan Akhir) - tidak menyimpan apa pun.';
  if (aksi) aksi.appendChild(tombol);
  // Keadaan: "dijadwalkan" | "jalan" | "" (terbuka) | kalimat kegagalan.
  const SEDANG = ["dijadwalkan", "jalan"];
  const lama = antreanBlangkoDibuka.get(kunci);
  if (lama && !SEDANG.includes(lama) && kabar) {
    kabar.className = "aleta-abt-kabar aleta-abt-gagal";
    kabar.textContent = lama;
  }
  if (SEDANG.includes(lama)) tombol.disabled = true;

  // Kabar ditulis ke panel antrean yang SEDANG tampak - panel tempat
  // pembukaan dimulai bisa sudah digambar ulang di tengah jalan.
  const kabarkan = (pesan, gagal) => {
    const sasaran =
      kotak.isConnected && kabar
        ? kabar
        : document.querySelector(`#${PENANDA} .aleta-antrean-sipp .aleta-abt-kabar`);
    if (!sasaran) return;
    sasaran.className = gagal ? "aleta-abt-kabar aleta-abt-gagal" : "aleta-abt-kabar";
    sasaran.textContent = pesan;
  };

  const lepasTombol = () => {
    tombol.disabled = false;
    for (const t of Array.from(document.querySelectorAll(".aleta-antrean-buka-blangko"))) t.disabled = false;
  };
  const buka = async () => {
    if (antreanBlangkoDibuka.get(kunci) === "jalan") return;
    tombol.disabled = true;
    antreanBlangkoDibuka.set(kunci, "jalan");
    kabarkan(`Membuka blangko Putusan Akhir ${butir.nomor}…`, false);
    const hasil = await s1BukaBlangkoPutusan();
    if (!hasil.ok) {
      const pesan = `${butir.nomor}: ${hasil.pesan} Antrean menunggu perkara ini.`;
      antreanBlangkoDibuka.set(kunci, pesan);
      kabarkan(pesan, true);
      lepasTombol();
      return;
    }
    let digambar = false;
    try {
      digambar = typeof gambarUlangSesudahBlangko === "function" ? await gambarUlangSesudahBlangko(butir.nomor) : false;
    } catch {
      digambar = false;
    }
    antreanBlangkoDibuka.set(kunci, "");
    if (!digambar) {
      const pesan =
        `${butir.nomor}: blangko terbuka, tetapi panel tidak dapat digambar ulang untuknya (data perkara di panel belum terbaca). ` +
        "Muat ulang data perkara dari menu ⋯ - ALETA melanjutkan antreannya begitu panel menampilkan blangko.";
      antreanBlangkoDibuka.set(kunci, pesan);
      kabarkan(pesan, true);
      lepasTombol();
    }
  };
  tombol.addEventListener("click", () => void buka());

  // Mode otomatis: SEKALI per perkara per pemuatan halaman. Tetap berjalan
  // walau panel ini digambar ulang sebelum pewaktunya berbunyi - yang dibuka
  // tingkap SIPP, bukan isi panel, dan tidak ada yang ditulis.
  if (antrean.modus === "otomatis" && butir.keadaan === "menunggu" && !antreanBlangkoDibuka.has(kunci)) {
    antreanBlangkoDibuka.set(kunci, "dijadwalkan");
    tombol.disabled = true;
    setTimeout(() => {
      if (document.querySelector("#frm_putusan")) {
        antreanBlangkoDibuka.set(kunci, "");
        return;
      }
      void buka();
    }, 0);
  }
}

const NAMA_KEADAAN_ANTREAN = {
  menunggu: "menunggu",
  jalan: "sedang dikerjakan",
  selesai: "selesai",
  gagal: "gagal",
  dilewati: "dilewati",
  jeda: "dijeda",
  // Bunyinya menurut SEBAB-nya - lihat namaKeadaanButir. Sampai 26 September
  // 2026 di sini tertulis "ditahan praperiksa" untuk setiap sebab, sehingga
  // perkara yang tertahan karena medannya gagal terisi pun dikabarkan
  // "sudah ditahan praperiksa".
  tertahan: "tertahan",
};

/**
 * Nama sebab tertahan - satu tempat untuk ringkasan antrean, baris perkara,
 * dan kabar. "pilihan" adalah sebab gabungan butir yang tersimpan sebelum
 * pilihan kosong dan pilihan berbeda dipisah (26 September 2026).
 */
const NAMA_SEBAB_TAHAN = {
  praperiksa: "ditahan praperiksa",
  "pilihan-kosong": "tertahan karena pilihan wajib kosong",
  "pilihan-beda": "tertahan karena pilihan petugas berbeda",
  pilihan: "tertahan karena pilihan blangko belum pasti",
  "gagal-isi": "tertahan karena medan gagal terisi",
  "medan-tambahan": "tertahan karena medan tambahan satker",
  "antrean-diakhiri": "tertahan karena antrean diakhiri",
};

/** Keadaan satu butir dalam kata-kata - yang tertahan disebut sebabnya. */
function namaKeadaanButir(b) {
  if (!b) return "";
  if (b.keadaan === "tertahan") {
    // Butir tanpa sebabTahan berasal dari praperiksa - satu-satunya penahan
    // sebelum ruas itu lahir (lihat ringkasan di bagianAntreanSipp).
    const sebab = b.sebabTahan || "praperiksa";
    return NAMA_SEBAB_TAHAN[sebab] || `tertahan (${sebab})`;
  }
  return NAMA_KEADAAN_ANTREAN[b.keadaan] || b.keadaan;
}

/**
 * Satu perkara antrean, di halaman yang sedang terbuka:
 *   1. sudah putus?  -> lewati, jangan isi ganda
 *   2. baca draf ALETA
 *   3a. pilih medan pilihan borang (pintu lebih dulu)
 *   3. isi Pertimbangan, Amar, Amar Anonim
 *   3b/3b'. yang gagal terisi atau belum pasti menahan Simpan
 *   3p. praperiksa atas isian yang AKAN disimpan
 *   3c. medan tambahan satker menahan Simpan
 *   4. Simpan - hanya bila antreannya masih ada dan perkara ini masih
 *      dipegang halaman ini - dibuktikan dari SIPP
 * Sesudah itu antrean maju satu langkah.
 */
async function jalankanSatuAntreanSipp(antrean, butir, kabar, tombol) {
  if (tombol) tombol.disabled = true;

  // ==========================================================================
  // TIAP TULIS: BUTIR INI SAJA, PADA ANTREAN SEGAR
  // ==========================================================================
  //
  // Sampai 26 September 2026 tiap langkah di bawah menulis `antrean` UTUH -
  // salinan yang dibaca saat pengerjaan dimulai. Tab lain yang sementara itu
  // menyelesaikan perkaranya sendiri kehilangan catatannya, antrean yang
  // diakhiri petugas hidup kembali, dan antrean baru dari berkas tertimpa.
  // Kini keadaan butir ini disalin ke antrean SEGAR (alatUbahButirAntrean),
  // hanya bila antreannya masih yang sama dan butirnya tidak dipegang halaman
  // lain. Yang tidak dapat ditulis tidak ditulis - antrean yang sudah
  // diakhiri tetap berakhir.
  const tulisButir = () =>
    alatUbahButirAntrean(antrean.id, butir.nomor, (b) => {
      if (b.pemegang && b.pemegang !== ALAT_PENANDA_HALAMAN) return false;
      b.pemegang = ALAT_PENANDA_HALAMAN;
      b.keadaan = butir.keadaan;
      b.catatan = butir.catatan || "";
      if (butir.sebabTahan) b.sebabTahan = butir.sebabTahan;
      else delete b.sebabTahan;
      if (butir.isianPilihan) b.isianPilihan = butir.isianPilihan;
      if (butir.edoc) b.edoc = butir.edoc;
    });

  butir.keadaan = "jalan";
  const awal = await tulisButir();
  if (!awal.ok) {
    if (kabar) {
      kabar.textContent =
        awal.sebab === "ditolak"
          ? `${butir.nomor} sedang dikerjakan di halaman lain - tidak dikerjakan di sini.`
          : awal.sebab === "terputus" || awal.sebab === "gagal-tulis"
            ? kalimatAntreanTakTerjangkau(awal.sebab, butir.nomor)
            : "Antrean ini sudah diakhiri atau diganti antrean lain - tidak ada yang dikerjakan.";
    }
    if (tombol) tombol.disabled = false;
    return;
  }

  // 1. Jangan isi ulang yang sudah putus.
  const segar = await bacaPutusanSegar(butir.nomor);
  if (segar && segar.sudahPutus) {
    butir.keadaan = "dilewati";
    butir.catatan = "sudah putus - tidak diisi ulang";
    await tulisButir();
    if (kabar) kabar.textContent = `${butir.nomor} sudah putus - dilewati.`;
    alatCatat("massal", `${butir.nomor}: dilewati (sudah putus)`, "");
    if (tombol) tombol.disabled = false;
    return;
  }

  // 2. Draf ALETA.
  let draf;
  try {
    if (kabar) kabar.textContent = "Membaca draf putusan…";
    const respons = await alatAmbil(
      `${ALETA_API_ISIAN_PUTUSAN}?nomorPerkara=${encodeURIComponent(butir.nomor)}`,
      { credentials: "include", cache: "no-store" },
      "Membaca draf putusan"
    );
    if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Membaca draf putusan"));
    const luar = await respons.json();
    draf = luar && luar.data ? luar.data : luar;
  } catch (galat) {
    butir.keadaan = "gagal";
    butir.catatan = String((galat && galat.message) || galat);
    await tulisButir();
    if (kabar) kabar.textContent = butir.catatan;
    alatCatat("massal-galat", `${butir.nomor}: draf ${butir.catatan}`, "");
    if (tombol) tombol.disabled = false;
    return;
  }
  if (!draf || !draf.ada) {
    butir.keadaan = "gagal";
    butir.catatan = (draf && draf.sebab) || "belum ada draf putusan";
    await tulisButir();
    if (kabar) kabar.textContent = butir.catatan;
    if (tombol) tombol.disabled = false;
    return;
  }

  // Praperiksa (dahulu 2b, di sini) kini berjalan SESUDAH pilihan borang
  // dipilih - lihat 3p di bawah.

  // 3a. Medan PILIHAN borang - Status Putusan, Verstek, Sumber Hukum, faktor
  // perceraian, keadaan istri, dan kawan-kawannya.
  //
  // ==========================================================================
  // SAMPAI 26 SEPTEMBER 2026 ANTREAN TIDAK PERNAH MENYIMPAN APA PUN
  // ==========================================================================
  //
  // Antrean hanya mengisi tiga medan naskah, lalu menekan Simpan. SIPP menolak
  // tiap borang Putusan Akhir yang Sumber Hukum, Status Putusan, atau
  // Verstek-nya belum dipilih (managePutusanAkhir::validateInput: "Sumber
  // Hukum Belum Dipilih", "Status Putusan Wajib Dipilih"). Pada borang yang
  // baru dibuka ketiganya kosong, dan mode otomatis mulai 600 ms sesudah
  // borangnya lahir - sebelum siapa pun sempat memilih. Setiap perkara
  // berakhir "gagal" dengan penolakan SIPP. Dijaga
  // ekstensi-massal-ujung-ke-ujung.test.ts, yang menjalankan antreannya atas
  // SIPP tiruan beraturan simpan yang sama.
  //
  // Daftar medannya sama dengan panel satu perkara (bagianIsiPutusan): dari
  // putusan.medan-borang (cadangan tertanam = CALON_MEDAN_PANEL), hanya yang
  // TAMPAK. Pintu (Status Putusan, Qobla) dibuka lebih dulu bila masih
  // kosong, lalu tiap medan yang masih kosong - atau masih pada nilai bawaan
  // borang SIPP (NILAI_BAWAAN_BORANG) - diisi usulan ALETA yang tidak
  // bentrok. Medan tambahan satker tidak diisi di sini - blok 3c yang
  // menahannya.
  //
  // Yang SUDAH dipilih petugas tidak ditimpa: pintu MAUPUN medan lain yang
  // berisi nilai selain kosong dan selain bawaan borang, dan berbeda dengan
  // usulan ALETA, menahan Simpan (sebab "pilihan-beda"). Sampai 26 September
  // 2026 hanya pintu yang dijaga begitu; faktor perceraian pilihan petugas
  // ditimpa usulan ALETA tanpa kabar, lalu disimpan.
  //
  // Beda dengan panel satu perkara, yang disengaja: panel MEMBUKA pintu
  // dengan usulan yang bentrok (petugas yang menekan Isikan melihatnya lebih
  // dulu), antrean tidak - pintu yang usulannya bentrok dibiarkan dan
  // menahan Simpan sebagai pilihan wajib yang kosong.
  //
  // CALON_PILIHAN adalah SALINAN CALON_MEDAN_PANEL di bagianIsiPutusan (di
  // sana ia tetapan dalam fungsi). Keduanya dijaga sama oleh uji yang sama.
  const CALON_PILIHAN = [
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
  const PINTU_PILIHAN = ['select[name="status_putusan"]', 'select[name="qobla"]'];
  // Yang ditolak SIPP bila kosong - selama medannya TAMPAK (SIPP
  // menyembunyikan faktor, qobla, nusyuz, dan keadaan istri bila tidak
  // berlaku). managePutusanAkhir::validateInput, alur 15, cerai dikabulkan:
  // "Qobla/Bada Belum Diisi" dan "Status Nusyuz Wajib Dipilih" ikut di
  // sini sejak 26 September 2026 - sebelumnya perkara tanpa usulan nusyuz
  // tetap dikirim, lalu ditolak SIPP.
  const PILIHAN_WAJIB = [
    'select[name="status_putusan"]',
    'select[name="verstek"]',
    'input[name="sumber_hukum[]"]',
    'select[name="faktor_cerai"]',
    'select[name="qobla"]',
    'input[name="status_nusyuz"]',
    'select[name="keadaan_istri"]',
  ];
  // NILAI_BAWAAN_BORANG (tingkat modul, di atas nilaiTerpilihMedan): nilai
  // yang dipilih borang SIPP sendiri, bukan pilihan petugas.
  // Asal nilai yang DIISIKAN ALETA - dicatat pada butir.isianPilihan dan
  // ditandai di daftar antrean:
  //   tegas   naskah menyebutnya tegas (keyakinan "pasti")
  //   bawaan  naskah diam - bawaan ALETA atau satker, tanpa kutipan naskah
  //   usulan  disimpulkan dari kalimat naskah, belum tegas
  const asalUsulan = (usul) =>
    usul.keyakinan === "pasti"
      ? "tegas"
      : usul.sumberUsulan === "bawaan-satker" || !String(usul.kutipan || "").trim()
        ? "bawaan"
        : "usulan";
  /** Pilihan borang yang diisikan ALETA pada perkara ini. */
  const isianPilihan = [];
  /** Medan yang nilainya diisikan (atau dikukuhkan) ALETA dari usulannya. */
  const dipastikan = new Set();
  const gagal = [];
  let daftarPilihan = CALON_PILIHAN;
  try {
    const hasilTipe = await alatTipeKeluaran("putusan.medan-borang", {
      tertanam: () =>
        CALON_PILIHAN.map((c, urutan) => ({
          kunci: "putusan-akhir",
          nilai: c.label,
          data: c.banyak ? { penunjuk: c.penunjuk, banyak: true } : { penunjuk: c.penunjuk },
          urutan,
          asal: "bawaan",
          sidik: "",
        })),
    });
    const bawaan = hasilTipe.entri
      .filter((e) => e.asal !== "tambahan")
      .map((e) => ({ penunjuk: e.data.penunjuk, label: e.nilai, banyak: Boolean(e.data.banyak) }));
    if (bawaan.length > 0) daftarPilihan = bawaan;
  } catch {
    // Cadangan tertanam dipakai. Kegagalan yang sama MENAHAN di blok 3c.
  }
  const bacaPilihan = async () => {
    const hasil = [];
    // Hanya MEMBACA - seluruh pertanyaan berangkat bersamaan (5 Okt 2026),
    // urutan jawabannya tetap urutan daftar. Jembatan menjawab tiap pesan
    // berurutan; yang hilang hanya tunggu bolak-balik satu per satu.
    const jawaban = await Promise.all(daftarPilihan.map((c) => kirimKeJembatan({ jenis: "pilihan", penunjuk: c.penunjuk })));
    for (let i = 0; i < daftarPilihan.length; i += 1) {
      const c = daftarPilihan[i];
      const j = jawaban[i];
      if (!j || !j.ok || !j.tampak) continue;
      const pilihan = (j.pilihan || []).map((x) => ({ nilai: x.nilai, label: x.label }));
      if (pilihan.length === 0) continue;
      const terpilihHalaman = nilaiTerpilihMedan(j, Boolean(c.banyak));
      const bawaanBorang =
        !c.banyak &&
        terpilihHalaman !== undefined &&
        NILAI_BAWAAN_BORANG[c.penunjuk] !== undefined &&
        String(terpilihHalaman) === NILAI_BAWAAN_BORANG[c.penunjuk];
      hasil.push({
        kunci: c.penunjuk,
        label: c.label,
        pilihan,
        banyak: Boolean(c.banyak),
        nilaiSekarang: j.nilaiSekarang || "",
        // Nilai bawaan borang bukan pilihan: tidak terpilih di mata usulan
        // maupun penjaga pilihan petugas di bawah.
        terpilih: bawaanBorang ? undefined : terpilihHalaman,
        bawaanBorang,
      });
    }
    return hasil;
  };
  const labelNilai = (medan, nilai) =>
    ((medan.pilihan || []).find((x) => String(x.nilai) === String(nilai)) || {}).label || String(nilai);
  /** Mencatat satu nilai yang BERHASIL diisikan ALETA - lihat isianPilihan. */
  const catatIsian = (medan, usul, nilai) => {
    dipastikan.add(medan.kunci);
    const label = labelNilai(medan, nilai);
    const ada = isianPilihan.find((x) => x.kunci === medan.kunci);
    if (ada) ada.nilai = medan.banyak ? `${ada.nilai}, ${label}` : label;
    else isianPilihan.push({ kunci: medan.kunci, medan: medan.label, nilai: label, asal: asalUsulan(usul) });
  };
  let usulanPilihan = [];
  let tampakPilihan = [];
  const pintuDisentuh = new Set();
  /** Pilihan petugas (pintu atau bukan) yang berbeda dengan usulan ALETA. */
  const bedaPilihan = [];
  /** Borang berubah (pintu dibuka) sesudah bacaan terakhir - baca lagi sebelum mengisi. */
  let bacaanBasi = false;
  for (let putaran = 0; putaran < 3; putaran += 1) {
    const terbaca = await bacaPilihan();
    bacaanBasi = false;
    const baru = terbaca.filter((x) => !tampakPilihan.some((y) => y.kunci === x.kunci));
    tampakPilihan = terbaca;
    if (baru.length === 0) break;
    try {
      if (kabar) kabar.textContent = "Menyusun usulan pilihan blangko…";
      const respons = await alatAmbil(
        ALETA_API_ISIAN_PUTUSAN,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(muatanUsulanMedan(butir.nomor, draf.jenisPerkara || "", baru)),
        },
        "Menyusun usulan pilihan"
      );
      if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Menyusun usulan pilihan"));
      const luar = await respons.json();
      const isiUsulan = luar && luar.data ? luar.data : luar;
      usulanPilihan = usulanPilihan.concat((isiUsulan && isiUsulan.usulan) || []);
    } catch (galat) {
      // Tanpa usulan, medan wajib tetap kosong dan SIPP pasti menolak -
      // menahan di 3b lebih jujur daripada menekan Simpan yang sia-sia.
      gagal.push(`usulan pilihan: ${String((galat && galat.message) || galat)}`);
      break;
    }
    let pintuTerbuka = false;
    for (const pintu of PINTU_PILIHAN) {
      if (pintuDisentuh.has(pintu)) continue;
      const medan = terbaca.find((x) => x.kunci === pintu);
      const usul = usulanPilihan.find((x) => x.kunci === pintu);
      if (!medan || !usul || !usul.nilai || usul.keyakinan === "bentrok") continue;
      pintuDisentuh.add(pintu);
      if (medan.terpilih !== undefined) {
        if (String(medan.terpilih) !== String(usul.nilai)) {
          bedaPilihan.push(
            `${medan.label}: blangko berisi "${labelNilai(medan, medan.terpilih)}", ` +
              `ALETA mengusulkan "${usul.nilaiLabel || labelNilai(medan, usul.nilai)}"`
          );
        }
        continue;
      }
      if (kabar) kabar.textContent = `Memilih ${medan.label}…`;
      const hasil = await kirimKeJembatan({ jenis: "isi", penunjuk: pintu, jenisMedan: "pilih", nilai: usul.nilai });
      if (hasil && hasil.ok) {
        pintuTerbuka = true;
        catatIsian(medan, usul, usul.nilai);
      } else gagal.push(`${medan.label}: ${(hasil && hasil.alasan) || "tidak terisi"}`);
    }
    if (!pintuTerbuka) break;
    bacaanBasi = true;
    // SIPP menggambar ulang bagian borangnya - sama dengan panel satu perkara.
    // 5 Okt 2026: menurut KEADAAN (medan tampak bertambah, diperiksa seketika)
    // bila s1TungguBerubah ada, bukan 350 ms tetap tiap pintu.
    if (typeof s1TungguBerubah === "function") {
      await s1TungguBerubah(
        async () => (await bacaPilihan()).length,
        terbaca.length,
        typeof S1_TUNGGU_PINTU_MS === "number" ? S1_TUNGGU_PINTU_MS : 350
      );
    } else {
      await new Promise((selesai) => setTimeout(selesai, 350));
    }
  }
  // Medan selain pintu: usulan yang tidak bentrok DIISIKAN ke medan yang
  // masih kosong atau masih pada nilai bawaan borang (NILAI_BAWAAN_BORANG) -
  // Putusan Verstek tidak punya isian "Pilih" dan selalu terbuka pada
  // "Tidak", jadi usulan "Ya" menggantikannya. Medan satu-nilai yang SUDAH
  // berisi pilihan lain tidak ditimpa: bila berbeda dengan usulan, Simpan
  // ditahan (bedaPilihan), sama seperti pintu. Yang sudah sama tidak
  // disentuh lagi; kotak centang hanya ditambah, tidak pernah dilepas.
  if (gagal.length === 0) {
    // Bacaan terakhir putaran di atas dipakai lagi bila borang tidak berubah
    // sesudahnya - satu putaran jembatan lebih sedikit per perkara.
    for (const medan of bacaanBasi ? await bacaPilihan() : tampakPilihan) {
      if (PINTU_PILIHAN.includes(medan.kunci)) continue;
      const usul = usulanPilihan.find((x) => x.kunci === medan.kunci);
      if (!usul || usul.keyakinan === "bentrok") continue;
      if (!medan.banyak && medan.terpilih !== undefined) {
        if (usul.nilai && String(medan.terpilih) !== String(usul.nilai)) {
          bedaPilihan.push(
            `${medan.label}: blangko berisi "${labelNilai(medan, medan.terpilih)}", ` +
              `ALETA mengusulkan "${usul.nilaiLabel || labelNilai(medan, usul.nilai)}"`
          );
        }
        continue;
      }
      const sudah = new Set([].concat(medan.terpilih === undefined ? [] : medan.terpilih).map(String));
      const nilaiDipakai = (
        medan.banyak
          ? (usul.nilaiBanyak || []).map((x) => String(x && x.nilai !== undefined ? x.nilai : x))
          : usul.nilai
            ? [String(usul.nilai)]
            : []
      ).filter((nilai) => !sudah.has(nilai));
      for (const nilai of nilaiDipakai) {
        if (kabar) kabar.textContent = `Memilih ${medan.label}…`;
        const hasil = await kirimKeJembatan({ jenis: "isi", penunjuk: medan.kunci, jenisMedan: "pilih", nilai });
        if (hasil && hasil.ok) catatIsian(medan, usul, nilai);
        else gagal.push(`${medan.label}: ${(hasil && hasil.alasan) || "tidak terisi"}`);
      }
    }
  }
  // Pilihan wajib yang TAMPAK dan masih kosong sesudah semua itu - dibaca
  // dari borang, bukan dari yang diminta. Nilai bawaan borang yang tidak
  // dikukuhkan usulan ALETA dihitung kosong. Usulan yang bentrok atau tidak
  // ada tidak ditebak.
  const wajibKosong = [];
  if (gagal.length === 0) {
    for (const medan of await bacaPilihan()) {
      if (!PILIHAN_WAJIB.includes(medan.kunci) || medan.terpilih !== undefined) continue;
      if (medan.bawaanBorang && dipastikan.has(medan.kunci)) continue;
      const usul = usulanPilihan.find((x) => x.kunci === medan.kunci);
      const sebab =
        usul && usul.keyakinan === "bentrok"
          ? "naskah menyebut lebih dari satu"
          : medan.bawaanBorang
            ? `masih bawaan blangko "${labelNilai(medan, medan.nilaiSekarang)}", tidak ada usulan ALETA`
            : "tidak ada usulan ALETA";
      wajibKosong.push(`${medan.label} (${sebab})`);
    }
  }
  butir.isianPilihan = isianPilihan.map(({ medan, nilai, asal }) => ({ medan, nilai, asal }));

  // 3. Isi tiga medan CKEditor.
  //
  // Versi 1.162.0 menyelidiki lebih dulu apakah tiap medan ada, dan menahan
  // perkara yang drafnya berisi untuk medan yang "tidak ada". Premisnya SALAH
  // - lihat catatan panjangnya pada panel satu perkara di atas: borang
  // putusan SIPP tetap punya ketiga bagian naskah pada status apa pun, dan
  // yang berganti hanyalah medan PILIHAN, yang sudah disaring bacaMedanTampak
  // lewat `tampak`.
  //
  // Yang tersisa dari percobaan itu satu hal yang memang benar dan dibiarkan:
  // medan yang sungguh gagal terisi TETAP menahan Simpan.
  const isian = [
    ["#perhum", draf.pertimbangan],
    ["#amar", draf.amar],
    ["#amar_anonim", draf.amarAnonim],
  ];
  let terisi = 0;
  for (const [penunjuk, teks] of isian) {
    if (!teks) continue;
    if (kabar) kabar.textContent = `Mengisi ${penunjuk}…`;
    const hasil = await kirimKeJembatan({ jenis: "isi", penunjuk, jenisMedan: "kaya", nilai: teks });
    if (hasil && hasil.ok) terisi += 1;
    else gagal.push(`${penunjuk}: ${(hasil && hasil.alasan) || "tidak terisi"}`);
  }

  // 3b. Yang gagal terisi MENAHAN Simpan - janji komentar di atas.
  //
  // Sampai 26 September 2026 janji itu hanya tertulis: `gagal` diisi lalu
  // tidak pernah dibaca, dan Simpan tetap ditekan atas borang yang belum
  // utuh. Panel satu perkara sudah menahannya sejak 1.123.0 ("Simpan TIDAK
  // ditekan selama masih ada yang gagal"); antrean massal kini sama.
  // Perkaranya ditandai tertahan beserta medan yang gagal, dan antrean
  // berlanjut ke perkara berikutnya tanpa menyimpan borang setengah terisi.
  // sebabTahan membedakannya dari tahanan praperiksa di ringkasan antrean.
  // Dijaga ekstensi-antrean-sipp-gagal-isi.test.ts, yang menjalankan fungsi
  // ini - penjaga teks yang lama tetap hijau walau blok ini dibuang.
  if (gagal.length > 0) {
    butir.keadaan = "tertahan";
    butir.sebabTahan = "gagal-isi";
    butir.catatan = `Simpan tidak ditekan - gagal terisi: ${gagal.join("; ")}`;
    await tulisButir();
    if (kabar) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = `${butir.nomor}: ${butir.catatan}. Periksa blangkonya, lalu Simpan sendiri bila sudah benar.`;
    }
    alatCatat("massal-galat", `${butir.nomor}: ${butir.catatan}`, "");
    if (tombol) tombol.disabled = false;
    return;
  }

  // 3b'. Pilihan wajib yang tidak dapat dipastikan, atau pilihan yang sudah
  // dipilih petugas berbeda dengan usulan ALETA - Simpan TIDAK ditekan.
  // Yang pertama ditolak SIPP (atau, pada nilai bawaan borang, disimpan
  // sebagai jawaban yang tidak diberikan siapa pun); yang kedua perbedaan
  // pendapat tentang bagaimana perkara ini diputus, dan yang memutuskannya
  // bukan antrean. Sebabnya dipisah sejak 26 September 2026; bila keduanya
  // ada, sebabnya pilihan petugas yang berbeda - itu yang harus dibaca orang.
  if (wajibKosong.length > 0 || bedaPilihan.length > 0) {
    butir.keadaan = "tertahan";
    butir.sebabTahan = bedaPilihan.length > 0 ? "pilihan-beda" : "pilihan-kosong";
    butir.catatan =
      "Simpan tidak ditekan - " +
      [
        wajibKosong.length ? `pilihan wajib belum terisi: ${wajibKosong.join(", ")}` : "",
        bedaPilihan.length ? `pilihan berbeda dengan usulan ALETA: ${bedaPilihan.join("; ")}` : "",
      ]
        .filter(Boolean)
        .join("; ");
    await tulisButir();
    if (kabar) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = `${butir.nomor}: ${butir.catatan}. Pilih sendiri di blangko, lalu Simpan sendiri.`;
    }
    alatCatat("massal-galat", `${butir.nomor}: ${butir.catatan}`, "");
    if (tombol) tombol.disabled = false;
    return;
  }

  // 3p. Praperiksa - agen yang membaca fakta SIPP dan BERHENTI bila
  // bertentangan. Di antrean tidak ada kotak centang "tetap isikan": yang
  // ditahan ditandai, disebut sebabnya, dan dibiarkan untuk dibuka orang.
  //
  // ==========================================================================
  // SESUDAH PILIHAN BORANG DIPILIH, BUKAN SEBELUMNYA
  // ==========================================================================
  //
  // Praperiksa membaca tanggal putusan, Status Putusan, dan verstek DARI
  // BORANG (bacaUsulanBorangPutusan) lalu mengadunya dengan amar. Sampai 26
  // September 2026 ia berjalan sebelum blok 3a, ketika borang yang baru
  // dibuka masih "Pilih Status Putusan" - sehingga status yang kemudian
  // dipilih ANTREAN SENDIRI tidak pernah diperiksa: "Dikabulkan" atas amar
  // "Menolak" tersimpan. Kini ia membaca isian yang akan disimpan. Yang
  // ditahan di sini sudah terisi di borang, tetapi Simpan tidak ditekan.
  const raporAgen = await praperiksaSebelumMengisi(butir.nomor, kabar);
  if (raporAgen && raporAgen.hentikan) {
    butir.keadaan = "tertahan";
    butir.sebabTahan = "praperiksa";
    butir.catatan = `ditahan praperiksa: ${ringkasHentikan(raporAgen)}`;
    await tulisButir();
    if (kabar) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = "";
      kabar.appendChild(gambarRaporAgen(raporAgen));
    }
    alatCatat("praperiksa", `${butir.nomor}: ${butir.catatan}`, "");
    if (tombol) tombol.disabled = false;
    return;
  }

  // 3c. Medan tambahan satker menahan Simpan - aturan yang sama dengan panel
  // satu perkara (bagianIsiPutusan). Yang dihitung hanya entri
  // putusan.medan-borang berasal 'tambahan' yang TAMPAK dan berpilihan di
  // borang ini - penyaring yang sama dengan bacaMedanTampak. Antrean hanya
  // mengisi medan pilihan BAWAAN (blok 3a), jadi medan tambahan yang tampak
  // berarti borang yang belum dinilai utuh oleh siapa pun. Cadangan tertanam sengaja
  // kosong: yang dicari hanya tambahan, dan portal mati berarti tidak ada
  // tambahan yang diketahui - perilaku sebelum daftar ini ada. Pemeriksaan
  // yang sendiri gagal MENAHAN, tidak diloloskan diam-diam.
  const medanTambahan = [];
  let galatTambahan = "";
  try {
    const daftarMedan = await alatTipeKeluaran("putusan.medan-borang", { tertanam: [] });
    for (const e of daftarMedan.entri) {
      if (e.asal !== "tambahan") continue;
      const jawab = await kirimKeJembatan({ jenis: "pilihan", penunjuk: e.data.penunjuk });
      if (jawab && jawab.ok && jawab.tampak && (jawab.pilihan || []).length > 0) medanTambahan.push(e.nilai);
    }
  } catch (galat) {
    galatTambahan = String((galat && galat.message) || galat);
  }
  if (medanTambahan.length > 0 || galatTambahan) {
    butir.keadaan = "tertahan";
    butir.sebabTahan = "medan-tambahan";
    butir.catatan = galatTambahan
      ? `Simpan tidak ditekan - medan tambahan satker tidak dapat diperiksa: ${galatTambahan}`
      : `Simpan tidak ditekan - blangko memuat medan tambahan satker: ${medanTambahan.join(", ")}`;
    await tulisButir();
    if (kabar) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = `${butir.nomor}: ${butir.catatan}. Isi medannya, periksa blangkonya, lalu Simpan sendiri.`;
    }
    alatCatat("massal-galat", `${butir.nomor}: ${butir.catatan}`, "");
    if (tombol) tombol.disabled = false;
    return;
  }

  // 3e. Edoc putusan + edoc anonimisasi (butir 6, 6 Okt 2026 - Baru & UI
  // Baru, sama dengan Putusan otomatis satu perkara). Sampai 1.185.0 antrean
  // hanya mengisi blangko lalu Simpan; edoc tidak pernah ikut. Kini naskah
  // asli perkara ini (disimpan di peramban saat "Kirim naskah lalu susun
  // antrean" atau saat naskahnya dikirim dari panel perkara) dipakai jalur
  // yang SAMA dengan panel satu perkara: a30OpsiSimpanPutusan menyiapkan
  // anonimisasinya SEBELUM Simpan, a30UnggahEdoc mengunggah keduanya
  // SESUDAH Simpan terbukti. Disiapkan di sini, sebelum 4a, supaya 4a tetap
  // pemeriksaan terakhir sebelum Simpan. Edoc yang gagal tidak menahan
  // Simpan dan tidak menghentikan antrean - dicatat pada butirnya.
  // Antrean dari ABT tidak ikut: edocnya sudah diurus di tahap ABT
  // (unggahBerkasAbt, pilihan "unggah ke SIPP" di sana).
  let opsiSimpanA30 = typeof a30OpsiSimpanMassal === "function" ? a30OpsiSimpanMassal(segar) : null;
  if (opsiSimpanA30 && antrean.asal !== "abt" && typeof a30OpsiEdocMassal === "function") {
    try {
      opsiSimpanA30 = await a30OpsiEdocMassal({
        opsi: opsiSimpanA30,
        nomorPerkara: butir.nomor,
        kabar,
        // Mode manual: petugas ada di depan layar - temuan pemeriksa anonim
        // ditanyakan. Otomatis: tidak ditanyakan; edocnya tidak diunggah.
        wadahTanya: antrean.modus === "manual" && kabar && kabar.parentNode ? kabar.parentNode : null,
      });
    } catch (galat) {
      const sebab = String((galat && galat.message) || galat);
      opsiSimpanA30 = {
        ...opsiSimpanA30,
        lanjutWalauEdocGagal: true,
        sesudahTersimpan: async () => ({ ok: false, bunyi: `Edoc tidak disiapkan: ${sebab}.` }),
      };
    }
  }

  // 4a. Antreannya masih ada, masih antrean yang sama, dan perkara ini masih
  // dipegang halaman ini? Dibaca segar TEPAT sebelum Simpan. Sampai 26
  // September 2026 hal itu hanya diperiksa saat pengerjaan dimulai: petugas
  // yang menekan "Akhiri antrean" selagi perkara dikerjakan tetap mendapati
  // Simpan-nya ditekan, dan antrean yang disusun ulang dari berkas tertimpa.
  const pegangan = await alatBacaButirAntrean(antrean.id, butir.nomor);
  if (!pegangan.ok || pegangan.butir.keadaan !== "jalan" || pegangan.butir.pemegang !== ALAT_PENANDA_HALAMAN) {
    const sebab = !pegangan.ok
      ? pegangan.sebab === "diganti"
        ? "antrean ini sudah diganti antrean lain"
        : pegangan.sebab === "tidak-ada"
          ? "perkara ini sudah tidak ada di antrean"
          : pegangan.sebab === "terputus"
            ? "ALETA dimuat ulang atau diperbarui di tengah pengerjaan (muat ulang halaman ini lalu lanjutkan)"
            : "antrean sudah diakhiri"
      : "perkara ini sudah dipegang halaman lain";
    butir.keadaan = "tertahan";
    butir.sebabTahan = "antrean-diakhiri";
    butir.catatan = `Simpan tidak ditekan - ${sebab} sebelum Simpan`;
    // Tidak menulis apa pun ke antrean yang sudah diakhiri atau diganti -
    // tulisButir menolaknya sendiri. Yang tersisa hanya kabar di halaman ini.
    await tulisButir();
    if (kabar) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = `${butir.nomor}: ${butir.catatan}. Isian blangko dibiarkan; Simpan sendiri bila memang dikehendaki.`;
    }
    alatCatat("massal", `${butir.nomor}: ${butir.catatan}`, "");
    if (tombol) tombol.disabled = false;
    return;
  }

  // 4. Simpan, dibuktikan dari SIPP. Baru & UI Baru (butir 10): keadaan
  // "sebelum" yang dibaca di langkah 1 dipakai lagi - satu bacaan
  // status-perkara per perkara lebih sedikit; blangko yang diisi sejak itu
  // tidak menulis apa pun ke basis data SIPP. Opsinya (beserta edoc) sudah
  // disusun di 3e.
  const hasilSimpan = opsiSimpanA30
    ? await simpanPutusanLaluBuka(butir.nomor, kabar, opsiSimpanA30)
    : await simpanPutusanLaluBuka(butir.nomor, kabar);
  if (hasilSimpan.ok) {
    butir.keadaan = "selesai";
    butir.catatan =
      "tersimpan di SIPP" +
      // Bagian yang memang tidak ada di borang statusnya ikut disebut. Tanpa
      // ini, "tersimpan" pada perkara cabut terbaca seolah ketiga bagian
      // naskahnya tertulis - padahal borangnya hanya punya satu.
      (raporAgen && raporAgen.jumlah && raporAgen.jumlah.perhatian
        ? ` · ${raporAgen.jumlah.perhatian} perhatian praperiksa`
        : raporAgen
        ? ""
        : " · tanpa praperiksa");
    alatCatatTindakan({
      jenis: "isi-putusan",
      penunjuk: butir.nomor,
      label: `putusan ${butir.nomor}`,
      nilaiBaru: "(tersimpan)",
      dapatPulih: false,
    });
    alatCatat("massal", `${butir.nomor}: putusan tersimpan`, "");
    // 4e. Hasil edoc per perkara (butir 6, 6 Okt 2026). Putusannya tetap
    // "selesai" - sudah tersimpan dan tidak boleh dikerjakan ulang - tetapi
    // edoc yang gagal disebut sebabnya dan barisnya tidak lagi hijau.
    if (hasilSimpan.edoc) {
      butir.edoc = hasilSimpan.edoc.ok ? "ok" : `gagal: ${hasilSimpan.edoc.bunyi}`;
      butir.catatan += hasilSimpan.edoc.ok ? ` · ${hasilSimpan.edoc.bunyi}` : ` · EDOC GAGAL: ${hasilSimpan.edoc.bunyi}`;
      if (!hasilSimpan.edoc.ok) alatCatat("massal-galat", `${butir.nomor}: edoc ${hasilSimpan.edoc.bunyi}`, "");
    }
  } else {
    butir.keadaan = "gagal";
    butir.catatan = hasilSimpan.bunyi;
    alatCatat("massal-galat", `${butir.nomor}: simpan ${hasilSimpan.bunyi}`, "");
  }
  await tulisButir();

  // simpanPutusanLaluBuka memuat ulang halaman perkara sendiri bila berhasil;
  // panel akan lahir kembali, membaca antrean, dan menunjuk perkara berikutnya.
  if (kabar && !hasilSimpan.ok) {
    kabar.className = "aleta-abt-kabar aleta-abt-gagal";
    kabar.textContent = butir.catatan;
  }
  if (tombol) tombol.disabled = false;
}


/**
 * ============================================================================
 * FITUR 3 - ANTREAN PUTUSAN MASSAL DARI BERKAS
 * ============================================================================
 *
 * Bermula dari BERKAS, bukan dari tanggal sidang. Petugas memilih beberapa
 * naskah putusan sekaligus; tiap berkas dicocokkan dengan perkaranya lewat
 * nomor yang tertulis pada NAMA berkasnya, dikirim ke ALETA sebagai draf, lalu
 * masuk antrean yang sama dengan antrean massal biasa.
 *
 * Sesudah antreannya jadi, pengisian borang SIPP dikerjakan mesin yang sudah
 * ada - satu perkara sekali, di halaman yang sedang dibuka. Tidak ada jalur
 * pengisian baru; yang ditambahkan hanya cara MENGISI ANTREANNYA.
 *
 * ============================================================================
 * YANG TIDAK DICOCOKKAN, TIDAK DITEBAK
 * ============================================================================
 *
 * Berkas yang nomor perkaranya tidak terbaca dari namanya ditandai dan
 * dilewati - bukan dipasangkan ke perkara terdekat, dan bukan pula dikirim
 * dengan nomor kosong.
 *
 * Memasangkan naskah putusan ke perkara yang salah berarti putusan orang lain
 * masuk ke berkas orang ini. Itu tidak dapat dibatalkan dengan menekan ulang:
 * drafnya sudah tersimpan, dan yang mengisi borang berikutnya akan membacanya
 * sebagai naskah yang sah.
 */

/**
 * ============================================================================
 * NOMOR PERKARA DARI NAMA BERKAS - EMPAT BENTUK YANG SUNGGUH ADA
 * ============================================================================
 *
 * Nama berkas tidak pernah memuat garis miring - Windows menolaknya - jadi
 * pola bergaris miring yang dahulu satu-satunya dipakai di sini cocok 0 dari
 * 8.614 nama dokumen nyata di folder unduhan petugas (diukur 25 September
 * 2026), termasuk 0 dari nama buatan ALETA sendiri. Yang sungguh ada:
 *
 *   100_Pdt.G_2026_PA.Dgl - [01] ....rtf       unduhan ALETA/ABT/Chrome (4.337)
 *   ..._OK_299_Pdt_G_2021_PA_Buk_.rtf           blangko lama bergaris bawah (970)
 *   PA.Dgl_2025_Pdt.G_637_putusan_akhir.rtf     e-Doc SIPP, nomornya terbalik (469)
 *   putusan_17_pdt.g_2021_pa.sgta_2021....pdf   unduhan Direktori Putusan MA (166)
 *
 * Bentuk bergaris miring tetap dikenali - nama yang disusun di luar Windows
 * masih dapat memuatnya.
 *
 * Nol di depan nomor DIPERTAHANKAN: SIPP sendiri menyimpan perkara 2015
 * sebagai "0001/Pdt.G/2015/PA.Buk" (323 nomor di PA Bungku, 607 di PA
 * Donggala). Membuangnya menanyakan perkara yang tidak ada.
 *
 * Nama yang memuat dua nomor BERBEDA tidak ditebak - dipulangkan kosong.
 * Begitu pula berkas kunci Word ("~$6_Pdt.P_..."): Word menimpa DUA huruf
 * pertama nama aslinya, jadi nomornya terpotong ("106" menjadi "6").
 */
function nomorDariNamaBerkas(nama) {
  const teks = String(nama || "");
  if (/^~\$/.test(teks)) return "";
  const temu = new Set();
  // "pdt.g.s" -> "Pdt.G.S": bagian satu huruf ditulis besar, sisanya Kapital.
  const jenisBaku = (jenis) =>
    String(jenis)
      .split(/[._]/)
      .filter(Boolean)
      .map((b) => (b.length === 1 ? b.toUpperCase() : b[0].toUpperCase() + b.slice(1).toLowerCase()))
      .join(".");
  for (const m of teks.matchAll(/(?:^|[^\d])(\d{1,5})_(Pdt(?:\.[A-Za-z]{1,3}){1,2})_(\d{4})_(PA\.[A-Za-z]{2,5})(?![A-Za-z])/g)) {
    temu.add(`${m[1]}/${m[2]}/${m[3]}/${m[4]}`);
  }
  for (const m of teks.matchAll(/(?:^|[^A-Za-z])(PA\.[A-Za-z]{2,5})_(\d{4})_(Pdt(?:\.[A-Za-z]{1,3}){1,2})_(\d{1,5})(?!\d)/g)) {
    temu.add(`${m[4]}/${m[3]}/${m[2]}/${m[1]}`);
  }
  for (const m of teks.matchAll(/(?:^|[^\d])(\d{1,5})_Pdt_([A-Z][a-z]{0,2}(?:_[A-Z])?)_(\d{4})_PA_([A-Za-z]{2,5})(?![A-Za-z])/g)) {
    temu.add(`${m[1]}/Pdt.${jenisBaku(m[2])}/${m[3]}/PA.${m[4]}`);
  }
  for (const m of teks.matchAll(/putusan_(\d{1,5})_pdt((?:\.[a-z]{1,3}){1,2})_(\d{4})_pa\.([a-z]{2,5})_\d{8}/gi)) {
    temu.add(`${m[1]}/${jenisBaku(`pdt${m[2]}`)}/${m[3]}/PA.${jenisBaku(m[4])}`);
  }
  // Bentuk lama bergaris miring. POLA_PERKARA berbendera /g dan MENGINGAT
  // posisinya di antara pemanggilan - lastIndex disetel ulang lebih dulu.
  POLA_PERKARA.lastIndex = 0;
  let cocok;
  while ((cocok = POLA_PERKARA.exec(teks)) !== null) temu.add(cocok[1]);
  return temu.size === 1 ? [...temu][0] : "";
}

/**
 * Nama yang menandai berkas BUKAN naskah putusan - ditandai dan tidak
 * dikirim, beserta sebabnya. Kata-katanya diukur atas nama nyata di folder
 * unduhan petugas: "mediasi", "gugatan", "ikrar", dan "kuasa" SENGAJA tidak
 * ada di sini, sebab keempatnya juga muncul pada nama blangko putusan yang
 * sah ("[98] [Cabut] ... Setelah Mediasi", "CT Ikrar Talak", "Kabul F Kuasa P").
 * Anonimisasi dikenali terpisah (namaBerkasAnonim) - ia punya slotnya sendiri
 * pada unggah e-Doc.
 */
function tandaBukanNaskahPutusan(nama) {
  const teks = String(nama || "");
  if (/^~\$/.test(teks)) return "berkas kunci sementara Word (~$), bukan naskah";
  if (/(?:^|[^A-Za-z0-9])(?:BAS|berita[\s_.-]*acara)(?=[^A-Za-z0-9]|$)/i.test(teks)) return "berita acara sidang (BAS)";
  if (
    /(?:^|[^A-Za-z0-9])(?:PHS|PMH|PPP|PJS)(?=[^A-Za-z0-9]|$)/i.test(teks) ||
    /penunjukan|penetapan[\s_.-]*(?:hari|majelis)/i.test(teks)
  ) {
    return "penetapan hari sidang, majelis, atau penunjukan (PHS/PMH/PPP/PJS)";
  }
  if (/rela{1,2}s(?![a-z])|panggilan|pemberitahuan/i.test(teks)) return "relaas";
  if (/sampul/i.test(teks)) return "sampul berkas";
  if (/akta/i.test(teks)) return "akta";
  if (/petitum/i.test(teks)) return "petitum";
  if (/laporan[\s_.-]*mediasi|kesepakatan[\s_.-]*(?:mediasi|perdamaian)|pernyataan[\s_.-]*(?:para[\s_.-]*)?(?:pihak|mediasi)/i.test(teks)) {
    return "dokumen mediasi";
  }
  // e-Doc SIPP yang bukan putusan: PA.Buk_2020_Pdt.G_142_petitum, _bas_2, _penetapan_ikrar.
  const edoc = /(?:^|[^A-Za-z])PA\.[A-Za-z]{2,5}_\d{4}_Pdt(?:\.[A-Za-z]{1,3}){1,2}_\d{1,5}_([A-Za-z][A-Za-z_]*)/.exec(teks);
  if (edoc && !/^putusan/i.test(edoc[1])) return `e-Doc SIPP berjenis "${edoc[1].replace(/_+$/, "")}", bukan putusan`;
  return "";
}

async function t7Baca(kunci) {
  try {
    return (await chrome.storage.local.get(kunci)) || {};
  } catch {
    return {};
  }
}

/*
 * ============================================================================
 * PERBAIKAN 30 SEPTEMBER 2026 - PANEL SIPP (butir 6, 7, 8, 10, 11, 18, 19, 26)
 * ============================================================================
 *
 * Temuan pengguna sesudah Reload 1.174.1 di SIPP sungguhan. Semuanya hidup di
 * tampilan Baru DAN UI Baru tanpa saklar (a30Aktif), dan tampilan Lama tetap
 * sama sampai ke DOM, permintaan, dan pesan jembatan - uji pembanding
 * ekstensi-sipp-tahap7.test.ts tetap berlaku.
 *
 *   6/26  penjelasan panjang dilipat di balik ⓘ (a30PasangLipat). Tidak ada
 *         yang dibuang: teksnya tetap di DOM dan terbuka dengan satu klik.
 *         Pesan error, peringatan, kabar, dan isian TIDAK dilipat.
 *   7     ☀ – ⛶ ↺ tetap di kepala dalam UI Baru; menu ⋯ memuat wakilnya
 *         (t7SusunKepala).
 *   8     putusan otomatis menerima DOCX/DOC/PDF: diubah menjadi RTF lewat
 *         K1 (POST konversi-naskah - hanya menghitung), lalu jalur unggah-
 *         naskah yang sama. PDF diberi peringatan tata letak.
 *   10    lebih cepat tanpa melepas pembuktian simpan: konfirmasi SIPP
 *         di-OK-kan jembatan HANYA selama tekanan Simpan ALETA; keadaan
 *         "sebelum" dibaca berbarengan dengan pengisian (dan dipakai ulang di
 *         antrean massal); pembacaan medan pilihan berbarengan; jajak basis
 *         data 400 ms sesudah SIPP menjawab tersimpan. Bukti simpan (jawaban
 *         SIPP + selisih basis data) TIDAK berubah.
 *   11/19 anonimisasi dibuat dalam BENTUK YANG SAMA (K2): K1 ke RTF bila perlu
 *         -> anonim ABT (POST abt/main/anonim, sesi ABT di peramban ini) -> K1
 *         kembali ke bentuk asal -> pemeriksa NIK/nama/alamat (peringatan +
 *         konfirmasi) -> kedua slot diunggah SEKALIGUS lewat unggah-sipp.
 *   18    klik ganda kepala = layar penuh; klik ganda lagi = kembali.
 *   15    bagian (Baru) / tab (UI Baru) Juru Sita memanggil jurusita.js.
 *
 * TIDAK ADA JALAN TULIS SIPP BARU: tulisan tetap lewat tombol Simpan blangko
 * (jembatan, bukti simpan) dan rute unggah-sipp yang sudah ada. Permintaan
 * non-GET baru: K1 (menghitung) dan abt/main/anonim (jalur abt.js) - keduanya
 * tunduk pada mode coba/kering/latihan lewat fetch yang dibungkus panel-alat.js,
 * dan 423-nya disebut apa adanya.
 */
const A30_API_KONVERSI = "/aleta/api/aleta-ecourt/putusan/konversi-naskah";
const A30_API_SIDANG = "/aleta/api/aleta-ecourt/sidang";
const A30_TERIMA_NASKAH = ".rtf,.txt,.docx,.doc,.pdf";
const A30_BATAS_KONVERSI_MS = 90000;
/**
 * Batas waktu anonimisasi (7 Okt 2026, "stuck di Menunggu anonimisasi siap").
 * ABT yang tidak menjawab diputus sesudah A30_BATAS_ANONIM_ABT_MS; Putusan
 * otomatis yang menunggu anonimisasi lebih dari A30_BATAS_TUNGGU_ANONIM_MS
 * (tidak termasuk waktu dialog pemeriksaan menunggu jawaban petugas)
 * menampilkan sebabnya beserta pilihan Tunggu lagi / Ulangi / putusan saja.
 */
const A30_BATAS_ANONIM_ABT_MS = 60000;
const A30_BATAS_TUNGGU_ANONIM_MS = 75000;
const A30_DETAK_TUNGGU_ANONIM_MS = 250;
const A30_MIME = {
  rtf: "application/rtf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};
/** Yang BUKAN penjelasan walau panjang: pesan error, peringatan, kabar, temuan, dialog. */
const A30_BUKAN_PENJELASAN = [
  ".aleta-abt-kabar",
  ".aleta-gagal",
  ".aleta-abt-gagal",
  ".aleta-tetap-awas",
  ".aleta-status-dipilih-beda",
  ".aleta-praperiksa",
  ".aleta-t7-menu",
  ".aleta-t7-bantuan",
  ".aleta-jurusita",
  ".aleta-a30-tanya",
].join(", ");
const A30_KLIK_GANDA_ABAIKAN = "button, a, input, select, textarea, [role='button'], .aleta-nomor-tukar, .aleta-t7-menu, .aleta-warna-pilih";

/** Dipanggil tekanSimpanPutusan: konfirmasi SIPP disetujui jembatan hanya di Baru & UI Baru. */
function a30SetujuiKonfirmasiSimpan() {
  return a30Aktif();
}

/** Antrean massal: keadaan "sebelum" dari langkah 1 dipakai ulang + jajak cepat. Lama: null. */
function a30OpsiSimpanMassal(segar) {
  if (!a30Aktif()) return null;
  return { sebelum: segar || null, jajakCepat: true };
}

// ─── Butir 18: klik ganda kepala ─────────────────────────────────────────────

/**
 * Klik ganda di kepala = tombol ⛶ yang sama: masuk layar penuh, dan klik
 * ganda berikutnya keluar ke ukuran sebelum layar penuh (untuk panel yang
 * belum pernah diubah ukurannya, itulah ukuran bawaan). Tombol, isian,
 * nomor perkara (klik ganda = salin), dan menu tidak ikut.
 */
function a30KlikGandaKepala(panel, peristiwa) {
  if (!a30Aktif() || !panel) return;
  const sasaran = peristiwa && peristiwa.target;
  if (sasaran && typeof sasaran.closest === "function" && sasaran.closest(A30_KLIK_GANDA_ABAIKAN)) return;
  if (panel.classList.contains(KELAS_LENCANA)) return;
  const penuh = panel.querySelector(".aleta-alat-kepala .aleta-penuh") || panel.querySelector(".aleta-penuh");
  if (!penuh) return;
  if (peristiwa && typeof peristiwa.preventDefault === "function") peristiwa.preventDefault();
  penuh.click();
  try {
    const pilihan = typeof window.getSelection === "function" ? window.getSelection() : null;
    if (pilihan && typeof pilihan.removeAllRanges === "function") pilihan.removeAllRanges();
  } catch {
    /* seleksi kata sisa klik ganda tidak mengganggu */
  }
}

/** Pengguna untuk matriks menu: objek akun (bolehKasir, peranTambahan) atau nama peran. */
function r11PenggunaMenu() {
  const p = typeof penggunaTerakhir !== "undefined" ? penggunaTerakhir : null;
  if (p && typeof p === "object" && p.peran) return p;
  return typeof mpsPeran === "function" ? mpsPeran() : "";
}
/* === AKHIR R 11 Okt === */

// ─── Butir 8: konversi naskah (K1) ───────────────────────────────────────────

function a30Bentuk(nama) {
  const m = /\.([A-Za-z0-9]{2,5})$/.exec(String(nama || ""));
  return m ? m[1].toLowerCase() : "";
}

/** DOCX/DOC/PDF perlu diubah ke RTF sebelum unggah-naskah membacanya. */
function a30PerluKeRtf(nama) {
  return ["docx", "doc", "pdf"].includes(a30Bentuk(nama));
}

function a30GantiAkhiran(nama, ke) {
  return `${String(nama || "naskah").replace(/\.[^.\\/]+$/, "")}.${ke}`;
}

function a30NamaAnonim(nama, ke) {
  return `${String(nama || "putusan").replace(/\.[^.\\/]+$/, "")} - anonimisasi.${ke}`;
}

/**
 * K1: satu berkas diubah bentuknya di server (soffice di bot). Hanya
 * menghitung, tidak menyimpan apa pun. TIDAK PERNAH melempar.
 * @returns {Promise<{ok: true, berkas: File, peringatan: string[]} | {ok: false, pesan: string}>}
 */
async function a30KonversiNaskah(berkas, ke) {
  const nama = String((berkas && berkas.name) || "naskah");
  const KE = String(ke || "rtf").toUpperCase();
  const badan = new FormData();
  badan.append("berkas", berkas, nama);
  badan.append("ke", ke);
  let respons;
  try {
    respons = await alatAmbil(
      A30_API_KONVERSI,
      { method: "POST", body: badan, credentials: "include", batasMs: A30_BATAS_KONVERSI_MS },
      "Mengubah bentuk naskah"
    );
  } catch (galat) {
    return { ok: false, pesan: `Mengubah ${nama} menjadi ${KE} gagal: ${String((galat && galat.message) || galat)}` };
  }
  let luar = null;
  try {
    luar = await respons.json();
  } catch {
    luar = null;
  }
  if (respons.status === 404) {
    return {
      ok: false,
      pesan: `Konversi naskah belum tersedia di server - simpan ulang ${nama} sebagai ${KE} di Word, lalu pilih lagi.`,
    };
  }
  if (respons.status === 423) return { ok: false, pesan: a30PesanDitahan(luar, `Mengubah ${nama} menjadi ${KE}`) };
  if (!respons.ok) {
    const kalimat = luar && luar.error && luar.error.message ? String(luar.error.message) : "";
    return { ok: false, pesan: kalimat || alatPesanGagal(null, respons.status, `Mengubah ${nama} menjadi ${KE}`) };
  }
  const data = luar && typeof luar === "object" && "data" in luar ? luar.data : luar;
  if (!data || !data.berkasBase64) return { ok: false, pesan: `Server tidak memulangkan berkas ${KE} hasil konversi ${nama}.` };
  let bita;
  try {
    bita = Uint8Array.from(atob(String(data.berkasBase64)), (c) => c.charCodeAt(0));
  } catch {
    return { ok: false, pesan: `Hasil konversi ${nama} tidak terbaca (base64 rusak).` };
  }
  const hasil = new File([bita], String(data.namaBerkas || a30GantiAkhiran(nama, ke)), {
    type: String(data.mime || A30_MIME[ke] || "application/octet-stream"),
  });
  const peringatan = [].concat(data.peringatan || []).map((x) => String(x)).filter(Boolean);
  if (a30Bentuk(nama) === "pdf" && ke === "rtf" && peringatan.length === 0) {
    peringatan.push("Naskah dari PDF: tata letaknya dapat berubah (baris terpotong, perabot halaman ikut). Periksa tiap bagian sebelum mengisikan.");
  }
  return { ok: true, berkas: hasil, peringatan };
}

// ─── Butir 11 / 19: anonimisasi dalam bentuk yang sama (K2) ──────────────────

/** Teks polos dari RTF - untuk pemeriksa anonim. Tabel huruf, gaya, gambar, dan tujuan \* dilewati. */
function a30TeksRtf(rtf) {
  return a30PetaRtf(rtf).teks;
}

/**
 * Teks polos RTF BESERTA asal tiap aksaranya di sumber RTF: aksara ke-k
 * berasal dari sumber[awal[k], akhir[k]); kendali[k] benar bila aksara itu
 * lahir dari kata kendali (\par, \tab, ...) yang tidak boleh dibuang.
 * Aturan bacanya SATU dengan a30TeksRtf (pemeriksa) - yang disamarkan
 * a30SamarkanSisaRtf persis yang dibaca pemeriksa.
 */
function a30PetaRtf(rtf) {
  const s = String(rtf || "");
  const LEWATI = /^(fonttbl|colortbl|stylesheet|info|pict|object|header|headerl|headerr|headerf|footer|footerl|footerr|footerf|listtable|listoverridetable|rsidtbl|generator|xmlnstbl|themedata|colorschememapping|latentstyles|datastore|pgdsctbl|filetbl|revtbl|fldinst)$/;
  const teks = [];
  const awal = [];
  const akhir = [];
  const kendali = [];
  const tambah = (aksara, dari, sampai, olehKendali) => {
    teks.push(aksara);
    awal.push(dari);
    akhir.push(sampai);
    kendali.push(olehKendali);
  };
  let aras = 0;
  let lewatiAras = -1;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "{") {
      aras += 1;
      i += 1;
      continue;
    }
    if (c === "}") {
      if (lewatiAras === aras) lewatiAras = -1;
      aras -= 1;
      i += 1;
      continue;
    }
    const lewati = lewatiAras !== -1;
    if (c === "\\") {
      const n = s[i + 1];
      if (n === "\\" || n === "{" || n === "}") {
        if (!lewati) tambah(n, i, i + 2, false);
        i += 2;
        continue;
      }
      if (n === "'") {
        const kode = parseInt(s.slice(i + 2, i + 4), 16);
        // 17 Okt: \'80-\'9f adalah cp1252 (\'92 = ’ dalam "Nur’aini"), bukan aksara kendali Latin-1.
        const CP1252 = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ";
        if (!lewati && Number.isFinite(kode)) tambah(kode >= 0x80 && kode <= 0x9f ? CP1252[kode - 0x80] : String.fromCharCode(kode), i, i + 4, false);
        i += 4;
        continue;
      }
      if (n === "*") {
        if (!lewati) lewatiAras = aras;
        i += 2;
        continue;
      }
      const m = /^([a-zA-Z]+)(-?\d+)? ?/.exec(s.slice(i + 1, i + 48));
      if (!m) {
        i += 2;
        continue;
      }
      const mulai = i;
      i += 1 + m[0].length;
      if (lewati) continue;
      const kata = m[1];
      if (LEWATI.test(kata)) {
        lewatiAras = aras;
        continue;
      }
      if (kata === "par" || kata === "line" || kata === "sect" || kata === "page" || kata === "row") tambah("\n", mulai, i, true);
      else if (kata === "tab" || kata === "cell") tambah(" ", mulai, i, true);
      else if (kata === "rquote" || kata === "lquote") tambah(kata === "rquote" ? "’" : "‘", mulai, i, false);
      else if (kata === "u" && m[2] !== undefined) {
        let kode = Number(m[2]);
        if (kode < 0) kode += 65536;
        // Pengganti ASCII sesudah \uN dilewati - dan ikut menjadi asal aksaranya.
        if (s[i] === "\\" && s[i + 1] === "'") i += 4;
        else if (s[i] && s[i] !== "\\" && s[i] !== "{" && s[i] !== "}") i += 1;
        tambah(String.fromCharCode(kode), mulai, i, false);
      }
      continue;
    }
    if (c !== "\r" && c !== "\n" && !lewati) tambah(c, i, i + 1, false);
    i += 1;
  }
  return { teks: teks.join(""), awal, akhir, kendali };
}

/** Kata umum dan jabatan yang tidak pernah disamarkan walau terbaca sebagai "nama". */
const A30_BUKAN_SAMARAN = /^(?:pengadilan|majelis|hakim|panitera|juru\s*sita|jurusita|mediator|ketua|anggota|penggugat|tergugat|pemohon|termohon|saksi|kuasa)\b/i;

/**
 * ============================================================================
 * SISA YANG DITINGGALKAN ANONIM ABT DISAMARKAN ALETA (7 Okt 2026, butir 4)
 * ============================================================================
 *
 * ABT (models/abt/Anonimisasi.php) menyamarkan dengan str_replace atas RTF
 * mentah: PERSIS besar-kecil hurufnya, persis spasinya, dan hanya nama serta
 * alamat pihak dari SIPP. Akibatnya "MUH. RIZAL Bin SUARDIN" di naskah lolos
 * karena SIPP menulisnya "Muh. Rizal Bin Suardin"; nama yang terpotong kode
 * format RTF lolos; nama saksi tidak pernah disentuh. Perkara 532/Pdt.G/2026
 * (7 Okt): 4 nama + 3 alamat utuh, dan alurnya berhenti di dialog pemeriksa.
 *
 * Yang dibaca pemeriksa (a30DataPribadiHalaman - pihak, saksi dari ALETA,
 * alamat) kini DISAMARKAN pada SALINAN anonimisasi - bukan pada edoc putusan
 * aslinya: tidak peka besar-kecil huruf, titik dan spasi lentur, menembus kode
 * format RTF. Bentuk samaran mengikuti amar anonim satker (isian-putusan-sipp.ts
 * SAMARAN_KURUNG/SAMARAN_NAMA): "( xxx )" bila nama itu satu-satunya isi
 * kurung, selebihnya "xxx". Nama majelis, panitera, juru sita, dan pengadilan
 * dilindungi di a30DataPribadiHalaman. Yang masih tersisa sesudahnya tetap
 * ditanyakan lewat dialog pemeriksa - tidak diunggah diam-diam.
 *
 * @returns {{rtf: string, diganti: Array<{jenis: string, kata: string, menjadi: string}>}}
 */
function a30SamarkanSisaRtf(rtf, data) {
  const asal = String(rtf || "");
  const peta = a30PetaRtf(asal);
  const t = peta.teks;
  const sasaran = []
    .concat(
      ((data && data.nama) || []).map((n) => ({
        jenis: "nama pihak",
        teks: String((n && n.teks) || ""),
        // 12OKT-I: potongan nama depan hanya sesudah "bernama"/"nama" (a30PolaSasaran).
        depan: Boolean(n && n.depan),
        lanjut: String((n && n.lanjut) || ""),
      }))
    )
    .concat(((data && data.alamat) || []).map((a) => ({ jenis: "alamat", teks: String((a && a.teks) || "") })))
    .filter((x) => x.teks.trim().length >= 4 && !A30_BUKAN_SAMARAN.test(x.teks.trim()))
    // Yang panjang lebih dulu: "Sulfiani binti H. Abd Hamid" sebelum "Sulfiani".
    .sort((a, b) => b.teks.length - a.teks.length);
  const terpakai = new Uint8Array(t.length);
  const ganti = [];
  const bebas = (dari, sampai) => {
    for (let k = dari; k < sampai; k += 1) if (terpakai[k]) return false;
    return true;
  };
  /* === 12OKT-I: NIK 16 angka ikut disamarkan === */
  // Bukti P.1 menulis "KTP-el atas nama ..., NIK 72032567...": ABT tidak
  // menyentuh NIK, dan pemeriksa hanya menanyakannya. Bentuk samarannya sama
  // dengan anonimisasi satker yang sudah terbit ("NIK xxxxxxxxxxxxxxxx").
  // 17 Okt: juga NIK/KK berpemisah ("72.03.01.410190.0001", "7203 0141 0190 0001") - tepat 16 angka.
  for (const m of t.matchAll(/(^|[^\d])(\d(?:[ .-]?\d){15})(?=[^\d]|$)/g)) {
    const mulai = m.index + m[1].length;
    const akhir = mulai + m[2].length;
    if (!bebas(mulai, akhir)) continue;
    for (let k = mulai; k < akhir; k += 1) terpakai[k] = 1;
    ganti.push({ mulai, akhir, menjadi: "x".repeat(16), jenis: "NIK", kata: m[2] });
  }
  /* === AKHIR 12OKT-I === */
  for (const satu of sasaran) {
    const pola = new RegExp(a30PolaSasaran(satu).source, "giu");
    for (const m of t.matchAll(pola)) {
      let mulai = m.index + m[1].length;
      let akhir = mulai + m[2].length;
      // Nama yang terbelah ganti paragraf bukan satu nama di naskah - dibiarkan
      // untuk pemeriksa, tidak ditebak.
      if (t.slice(mulai, akhir).includes("\n")) continue;
      if (!bebas(mulai, akhir)) continue;
      if (satu.depan && !a30DepanMilikPihak(t, akhir, satu.lanjut)) continue;
      let menjadi = "xxx";
      const kiri = /\(\s*$/.exec(t.slice(Math.max(0, mulai - 3), mulai));
      const kanan = /^\s*\)/.exec(t.slice(akhir, akhir + 3));
      if (satu.jenis === "nama pihak" && kiri && kanan && bebas(mulai - kiri[0].length, akhir + kanan[0].length)) {
        mulai -= kiri[0].length;
        akhir += kanan[0].length;
        menjadi = "( xxx )";
      }
      for (let k = mulai; k < akhir; k += 1) terpakai[k] = 1;
      ganti.push({ mulai, akhir, menjadi, jenis: satu.jenis, kata: m[2] });
    }
  }
  if (!ganti.length) return { rtf: asal, diganti: [] };
  // Tiap aksara yang disamarkan dibuang dari sumbernya; samarannya ditulis di
  // tempat aksara pertama. Kata kendali di tengahnya (format, \tab) tetap.
  const sunting = [];
  for (const g of ganti) {
    let pertama = true;
    for (let k = g.mulai; k < g.akhir; k += 1) {
      if (peta.kendali[k]) continue;
      sunting.push({ dari: peta.awal[k], sampai: peta.akhir[k], isi: pertama ? g.menjadi : "" });
      pertama = false;
    }
  }
  sunting.sort((a, b) => a.dari - b.dari);
  let keluar = "";
  let pos = 0;
  for (const s of sunting) {
    if (s.dari < pos) continue;
    keluar += asal.slice(pos, s.dari) + s.isi;
    pos = s.sampai;
  }
  keluar += asal.slice(pos);
  return { rtf: keluar, diganti: ganti.map((g) => ({ jenis: g.jenis, kata: g.kata, menjadi: g.menjadi })) };
}

/* === 12OKT-I: bentuk nama pihak (salinan aturan src/lib/anonim-nama-pihak.ts) === */
/**
 * Nama SIPP dipotong di " alias ". Ruas pertama selalu nama orang itu; ruas
 * sesudah "alias" juga namanya BILA ruas sebelumnya belum ber-bin/binti, atau
 * bila ruas itu sendiri ber-bin/binti. "Mariana binti Sapri alias Sapri M.
 * Arif" - alias itu milik nama ayah, tidak disamarkan sebagai nama pihak.
 * Nama diri = ruas sebelum bin/binti, minimal empat huruf. Aturannya SATU
 * dengan penjaga unggah di server; uji anonim-nama-pihak-12okt mengadu keduanya.
 * @returns {{utuh: string, ruas: string[], diri: string[]}}
 */
function a30BentukNamaPihak(nama) {
  const rapi = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  const utuh = rapi(nama);
  const ruas = [];
  let sebelumnyaBerbin = false;
  utuh
    .split(/\s+alias\s+/i)
    .map(rapi)
    .filter(Boolean)
    .forEach((satu, i) => {
      const berbin = /\s+(?:bin|binti)\s+/i.test(satu);
      if (i === 0 || !sebelumnyaBerbin || berbin) ruas.push(satu);
      sebelumnyaBerbin = berbin;
    });
  const diri = [];
  const lihat = new Set();
  for (const satu of ruas) {
    const inti = rapi(satu.split(/\s+(?:bin|binti)\s+/i)[0]);
    if (inti.length >= 4 && !lihat.has(inti.toLowerCase())) {
      lihat.add(inti.toLowerCase());
      diri.push(inti);
    }
  }
  return { utuh, ruas, diri };
}

/**
 * Potongan DEPAN nama diri yang bermakna: "Musdiman Lahauwa" -> "Musdiman",
 * "Moh. Nurnas Islam" -> "Moh. Nurnas". Keterangan saksi menulis "suami
 * Penggugat bernama Musdiman" (terukur pada 3 dari 108 putusan Donggala).
 * Potongan BELAKANG tidak dipakai: di naskah ia hampir selalu nama orang
 * lain ("Arjun Lahauwa", nama anak) atau kata biasa ("Mahkamah Agung",
 * "agama Islam", "Kartu Tanda Penduduk").
 * @returns {Array<{teks: string, lanjut: string}>}
 */
function a30PotonganDepan(diri) {
  // Gelar/sebutan yang sendirian bukan nama: "bernama Andi" tidak menunjuk siapa pun.
  const bukanNama = /^(?:andi|siti|sitti|moh|muh|mohd|muhammad|mohammad|mohamad|muhamad|muhammat|abd|abdul|haji|hajjah|hajah|daeng|dg|nur|sri|ni|la|wa|h|hj|ir|dr|drs|i)\.?$/i;
  const kata = String(diri || "").replace(/\s+/g, " ").trim().split(" ");
  const hasil = [];
  for (let k = 1; k < kata.length; k += 1) {
    const depan = kata.slice(0, k);
    if (depan.every((x) => bukanNama.test(x))) continue;
    if (depan.join("").replace(/[^\p{L}]/gu, "").length < 4) continue;
    hasil.push({ teks: depan.join(" "), lanjut: kata[k] });
  }
  return hasil;
}

/**
 * Pola satu sasaran samaran/pemeriksa. Nama utuh: di mana pun, spasi antar
 * kata lentur ("Sri Devi" = "SRIDEVI", "Alma Ningsi" = "Almaningsi").
 * Potongan depan: HANYA tepat sesudah "bernama"/"nama".
 */
function a30PolaSasaran(x) {
  if (!x || !x.depan) return a30PolaKata(x ? x.teks : "", Boolean(x) && x.jenis !== "alamat");
  return new RegExp(`((?:^|[^\\p{L}\\p{N}])(?:bernama|nama)\\s*:?\\s*)(${a30AmanKata(x.teks, true)})(?=[^\\p{L}\\p{N}]|$)`, "iu");
}

/**
 * Potongan depan yang disusul kata ber-huruf-besar LAIN, atau bin/binti,
 * adalah nama orang lain ("bernama Musdiman Saleh", "bernama Musdiman bin
 * Ladu") - tidak disamarkan.
 */
function a30DepanMilikPihak(teks, akhir, lanjut) {
  const m = /^[ \t]+([\p{L}][\p{L}.'-]*)/u.exec(String(teks || "").slice(akhir, akhir + 60));
  if (!m) return true;
  if (/^(?:bin|binti)$/i.test(m[1])) return false;
  if (/^\p{Lu}/u.test(m[1]) && m[1].toLowerCase() !== String(lanjut || "").toLowerCase()) return false;
  return true;
}
/* === AKHIR 12OKT-I === */

/**
 * Nama pihak dan penggalan alamat yang TERBACA di halaman SIPP ini (tabel
 * pihak, baris label-nilai) dan di konteks ALETA. Yang tidak terbaca tidak
 * diperiksa - dan jumlah yang diperiksa disebut di kabarnya.
 */
function a30DataPribadiHalaman() {
  const nama = new Map();
  const alamat = new Map();
  const tambahNama = (teks, dari) => {
    const t = String(teks || "").replace(/\s+/g, " ").trim();
    if (t.length < 4 || t.length > 80 || /\d/.test(t) || /^(penggugat|tergugat|pemohon|termohon|nama|tidak ada)$/i.test(t)) return;
    nama.set(t.toLowerCase(), { teks: t, dari });
    /* === 12OKT-I: bentuk nama ber-"alias" ikut disamarkan === */
    // Dahulu hanya dipotong di bin/binti: "Almaningsi Astuti alias Alma Ningsi
    // Astuti binti Asmin Y" tidak pernah menjadikan "Almaningsi Astuti" sasaran,
    // padahal bukti P.1 (ABT 1214) menulis "atas nama ALMANINGSI ASTUTI" (564/
    // Pdt.G/2026). Tiap ruas alias dan nama dirinya kini ikut - lihat a30BentukNamaPihak.
    const bentuk = a30BentukNamaPihak(t);
    for (const x of bentuk.ruas.concat(bentuk.diri)) {
      if (x && x.length >= 4 && !nama.has(x.toLowerCase())) nama.set(x.toLowerCase(), { teks: x, dari });
    }
    // Potongan depan ("suami Penggugat bernama Musdiman") - hanya sesudah
    // "bernama"/"nama"; kuncinya berawalan supaya tidak menimpa nama utuh.
    for (const d of bentuk.diri) {
      for (const p of a30PotonganDepan(d)) {
        const kunci = `depan:${p.teks.toLowerCase()}`;
        if (!nama.has(p.teks.toLowerCase()) && !nama.has(kunci)) nama.set(kunci, { teks: p.teks, dari, depan: true, lanjut: p.lanjut });
      }
    }
    /* === AKHIR 12OKT-I === */
  };
  const tambahAlamat = (teks, dari) => {
    for (const potong of String(teks || "").split(/[,;\n]/)) {
      const b = potong.replace(/\s+/g, " ").trim();
      if (b.length < 6 || b.length > 80) continue;
      if (!/^(jl\.?|jln\.?|jalan|dusun|dsn\.?|lorong|lr\.?|rt\b|rw\b|desa|kelurahan|kel\.|btn|perumahan|perum\b|kompleks|komp\.|gang|gg\.)/i.test(b)) continue;
      alamat.set(b.toLowerCase(), { teks: b, dari });
    }
  };
  const konteks = typeof konteksTerakhir !== "undefined" && konteksTerakhir ? konteksTerakhir : null;
  for (const o of (konteks && konteks.nomorPihak) || []) tambahNama(o && o.nama, "ALETA");
  // Nama majelis, panitera, juru sita, dan mediator TIDAK PERNAH disamarkan
  // (7 Okt 2026): tabel SIPP yang berjudul jabatan itu dikumpulkan sebagai
  // pelindung, dan tidak dibaca sebagai tabel pihak.
  const PELINDUNG = /\b(?:hakim|majelis|panitera|juru\s*sita|jurusita|mediator)\b/i;
  const tabelLindung = new Set();
  let teksLindung = "";
  for (const tabel of Array.from(document.querySelectorAll("table"))) {
    if (tabel.closest(".aleta-panel")) continue;
    // Hanya tabel daun (tabel majelis SIPP): tabel tata letak yang memuat
    // tabel lain akan ikut membawa nama pihak ke dalam pelindung.
    if (tabel.querySelector("table")) continue;
    const kepala = Array.from(tabel.rows || []).slice(0, 2).map((tr) => String(tr.textContent || "")).join(" ");
    if (PELINDUNG.test(kepala)) {
      tabelLindung.add(tabel);
      teksLindung += ` ${String(tabel.textContent || "")}`;
    }
  }
  if (konteks && konteks.hakim && konteks.hakim.nama) teksLindung += ` ${konteks.hakim.nama}`;
  teksLindung = teksLindung.replace(/\s+/g, " ").toLowerCase();
  for (const tabel of Array.from(document.querySelectorAll("table"))) {
    if (tabel.closest(".aleta-panel")) continue;
    if (tabelLindung.has(tabel)) continue;
    const baris = Array.from(tabel.rows || []);
    baris.forEach((tr, i) => {
      const sel = Array.from(tr.cells || []);
      sel.forEach((td, j) => {
        const judul = String(td.textContent || "").replace(/\s+/g, " ").trim();
        const jenis = /^(penggugat|tergugat|pemohon|termohon|nama|nama lengkap)$/i.test(judul)
          ? "nama"
          : /^alamat\b/i.test(judul) && judul.length <= 30
            ? "alamat"
            : "";
        if (!jenis) return;
        const tambah = jenis === "nama" ? tambahNama : tambahAlamat;
        // Baris label-nilai ("Alamat | Jl. ...") atau kolom berjudul.
        if (sel.length === 2 && j === 0) tambah(sel[1].textContent, "SIPP");
        else for (let k = i + 1; k < Math.min(baris.length, i + 12); k += 1) {
          const c = baris[k].cells && baris[k].cells[j];
          if (c) tambah(c.textContent, "SIPP");
        }
      });
    });
  }
  const dilindungi = (x) => {
    const k = String(x.teks || "").replace(/\s+/g, " ").toLowerCase();
    return Boolean(teksLindung) && k.length >= 4 && teksLindung.includes(k);
  };
  return { nama: Array.from(nama.values()).filter((x) => !dilindungi(x)), alamat: Array.from(alamat.values()) };
}

function a30PolaKata(teks, spasiLentur) {
  return new RegExp(`(^|[^\\p{L}\\p{N}])(${a30AmanKata(teks, spasiLentur)})(?=[^\\p{L}\\p{N}]|$)`, "iu");
}

function a30AmanKata(teks, spasiLentur) {
  // Titik singkatan dan spasi sesudahnya lentur: "Muh. Rizal", "MUH.RIZAL",
  // dan "Muh Rizal" orang yang sama (7 Okt 2026). Besar-kecil huruf: bendera i.
  // 12OKT-I: untuk NAMA, spasi antar kata pun lentur - "Alma Ningsi Astuti"
  // ditulis "ALMANINGSI ASTUTI", "Sri Devi" ditulis "Sridevi" (465/Pdt.G/2026).
  return String(teks)
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\.\s+/g, "\\.?\\s*")
    .replace(/\s+/g, spasiLentur ? "\\s*" : "\\s+")
    .replace(/\\\.(?!\?)/g, "\\.?")
    // 17 Okt: apostrof nama lentur dan boleh tidak ada - "Nur'aini" = "Nur’aini" = "Nuraini" (paritas portal lenturkanApostrof).
    .replace(/['’‘`´\u0092]/g, "['’‘`´\\u0092]?");
}

/** Data pribadi yang masih utuh di teks anonim, beserta potongan kalimat di sekitarnya. */
function a30PeriksaAnonim(teks, data) {
  const t = String(teks || "");
  const temuan = [];
  const catat = (jenis, kata, indeks, dari) => {
    const awal = Math.max(0, indeks - 50);
    const akhir = Math.min(t.length, indeks + kata.length + 50);
    temuan.push({
      jenis,
      kata,
      dari,
      konteks: `${awal > 0 ? "…" : ""}${t.slice(awal, akhir).replace(/\s+/g, " ")}${akhir < t.length ? "…" : ""}`,
    });
  };
  for (const m of t.matchAll(/(?<!\d)\d(?:[ .-]?\d){15}(?!\d)/g)) catat("NIK", m[0], m.index, "");
  for (const n of (data && data.nama) || []) {
    // 12OKT-I: pola yang SAMA dengan penyamar (spasi lentur; potongan depan
    // hanya sesudah "bernama") - yang dicari pemeriksa = yang disamarkan.
    const pola = new RegExp(a30PolaSasaran({ ...n, jenis: "nama pihak" }).source, "giu");
    for (const m of t.matchAll(pola)) {
      const mulai = m.index + m[1].length;
      if (n.depan && !a30DepanMilikPihak(t, mulai + m[2].length, n.lanjut)) continue;
      catat("nama pihak", m[2], mulai, n.dari);
      break;
    }
  }
  for (const a of (data && data.alamat) || []) {
    const m = a30PolaKata(a.teks).exec(t);
    if (m) catat("alamat", m[2], m.index + m[1].length, a.dari);
  }
  return { temuan, diperiksa: { nama: ((data && data.nama) || []).length, alamat: ((data && data.alamat) || []).length } };
}

/**
 * Konfirmasi di dalam panel (bukan window.confirm): judul, keterangan, daftar
 * temuan, centang "sudah saya periksa", lalu dua tombol. Pulang true/false.
 */
function a30Tanya(wadah, o) {
  return new Promise((selesai) => {
    const kartu = buatElemen("div", "aleta-a30-tanya");
    kartu.setAttribute("role", "alertdialog");
    kartu.appendChild(buatElemen("div", "aleta-a30-tanya-judul", o.judul || "Periksa dulu"));
    for (const b of o.baris || []) if (b) kartu.appendChild(buatElemen("div", "aleta-a30-tanya-baris", b));
    if (o.daftar && o.daftar.length) {
      const ul = buatElemen("ul", "aleta-a30-tanya-daftar");
      for (const x of o.daftar) ul.appendChild(buatElemen("li", "", x));
      kartu.appendChild(ul);
    }
    const label = buatElemen("label", "aleta-a30-tanya-centang");
    const cek = document.createElement("input");
    cek.type = "checkbox";
    label.append(cek, buatElemen("span", "", o.centang || "Sudah saya periksa"));
    const ya = buatElemen("button", "aleta-permintaan-tombol aleta-a30-tanya-ya", o.ya || "Lanjutkan");
    ya.type = "button";
    ya.disabled = true;
    const tidak = buatElemen("button", "aleta-permintaan-tombol aleta-a30-tanya-tidak", o.tidak || "Batalkan");
    tidak.type = "button";
    cek.addEventListener("change", () => {
      ya.disabled = !cek.checked;
    });
    const aksi = buatElemen("div", "aleta-a30-tanya-aksi");
    aksi.append(ya, tidak);
    kartu.append(label, aksi);
    const tutup = (hasil) => {
      kartu.remove();
      selesai(hasil);
    };
    ya.addEventListener("click", () => tutup(true));
    tidak.addEventListener("click", () => tutup(false));
    wadah.appendChild(kartu);
    if (typeof kartu.scrollIntoView === "function") kartu.scrollIntoView({ block: "nearest" });
  });
}

/**
 * perkara_id yang dituntut ABT (Abt::html_anonim membaca pihaknya dari situ).
 * Blangko SIPP jarang membawanya, jadi ALETA ditanya lewat rute sidang yang
 * sudah ada (GET, rincian SIPP satu perkara).
 */
async function a30PerkaraIdUntukAbt(nomorPerkara) {
  const dariHalaman = perkaraIdDariHalaman();
  if (/^\d+$/.test(dariHalaman)) return dariHalaman;
  try {
    const r = await alatAmbil(
      `${A30_API_SIDANG}?nomor=${encodeURIComponent(String(nomorPerkara || ""))}`,
      { credentials: "include", cache: "no-store" },
      "Membaca nomor induk perkara"
    );
    if (!r.ok) return "";
    const luar = await r.json();
    const isi = luar && luar.data ? luar.data : luar;
    const id = String((isi && isi.sipp && isi.sipp.perkaraId) || "");
    return /^\d+$/.test(id) && !/^0+$/.test(id) ? id : "";
  } catch {
    return "";
  }
}

/** Jawaban ABT adalah halaman masuk (sesi ABT tidak ada) - sama dengan relaasHalamanMasuk di latar.js. */
function a30HalamanMasukAbt(teks, alamatAkhir) {
  if (/\/login(?:\/|\?|#|$)/i.test(String(alamatAkhir || ""))) return true;
  const t = String(teks || "");
  return /login\/signin/i.test(t) || /type=["']password["']/i.test(t);
}

/**
 * Anonim ABT atas satu RTF - jalur yang sama dengan abt.js (POST abt/main/anonim,
 * multipart perkara_id, perkara_no, file_putusan), dengan sesi ABT petugas
 * sendiri di peramban ini. TIDAK PERNAH melempar.
 */
async function a30AnonimAbt(rtf, nomorPerkara, perkaraId) {
  const borang = new FormData();
  borang.set("perkara_id", String(perkaraId || ""));
  borang.set("perkara_no", String(nomorPerkara || ""));
  borang.set("file_putusan", rtf, String((rtf && rtf.name) || "putusan.rtf"));
  let respons;
  // ABT yang tidak menjawab (php-cgi mati, soffice menggantung) dahulu
  // membuat Putusan otomatis menunggu tanpa akhir - kini diputus.
  const batasMs = typeof A30_BATAS_ANONIM_ABT_MS === "number" ? A30_BATAS_ANONIM_ABT_MS : 60000;
  const putus = typeof AbortController === "function" ? new AbortController() : null;
  const pewaktu = putus ? setTimeout(() => putus.abort(), batasMs) : null;
  try {
    respons = await fetch(`${location.origin}/aps_badilag/abt/main/anonim`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      body: borang,
      ...(putus ? { signal: putus.signal } : {}),
    });
  } catch (galat) {
    if (pewaktu) clearTimeout(pewaktu);
    if (putus && putus.signal.aborted) {
      return {
        ok: false,
        pesan: `ABT tidak menjawab dalam ${Math.round(batasMs / 1000)} detik saat menganonimkan - anonimisasi tidak dibuat. Periksa ABT di tab lain (masih masuk?), lalu ulangi.`,
      };
    }
    return { ok: false, pesan: `ABT tidak terjangkau untuk anonimisasi: ${String((galat && galat.message) || galat)}` };
  }
  if (respons.status === 423) {
    if (pewaktu) clearTimeout(pewaktu);
    let badan = null;
    try {
      badan = await respons.json();
    } catch {
      badan = null;
    }
    return { ok: false, pesan: a30PesanDitahan(badan, "Anonimisasi ABT") };
  }
  if (!respons.ok) {
    if (pewaktu) clearTimeout(pewaktu);
    return { ok: false, pesan: `ABT menjawab ${respons.status} saat menganonimkan - anonimisasi tidak dibuat.` };
  }
  let bita;
  try {
    // Badannya pun tunduk pada batas yang sama - kepala yang tiba tidak
    // menjamin isinya ikut tiba.
    bita = new Uint8Array(await respons.arrayBuffer());
  } catch (galat) {
    return {
      ok: false,
      pesan:
        putus && putus.signal.aborted
          ? `ABT tidak selesai mengirim hasil anonim dalam ${Math.round(batasMs / 1000)} detik - anonimisasi tidak dibuat. Ulangi sebentar lagi.`
          : `Hasil anonim ABT tidak terbaca: ${String((galat && galat.message) || galat)}`,
    };
  } finally {
    if (pewaktu) clearTimeout(pewaktu);
  }
  const awal = String.fromCharCode(...Array.from(bita.subarray(0, 5)));
  if (awal !== "{\\rtf") {
    const teks = new TextDecoder().decode(bita);
    if (a30HalamanMasukAbt(teks, respons.url)) {
      return {
        ok: false,
        perluAbt: true,
        pesan: "Masuk ABT dulu: anonimisasi dibuat oleh ABT dengan akun ABT Anda di peramban ini. Buka ABT di tab lain, masuk, lalu ulangi.",
      };
    }
    const gagal = teks.match(/Proses Anonim Gagal[^<]*/i);
    return { ok: false, pesan: gagal ? `ABT: ${gagal[0].slice(0, 160).trim()}` : "ABT tidak mengembalikan berkas RTF anonim - anonimisasi tidak dibuat." };
  }
  // Satu bita = satu aksara, persis (TextDecoder "latin1" di peramban adalah
  // windows-1252 dan tidak dapat dikembalikan bita demi bita) - salinan
  // anonimisasi yang disamarkan ALETA ditulis kembali dari teks ini.
  return { ok: true, bita, teksRtf: a30BitaKeTeks(bita) };
}

/** Bita -> teks, satu aksara per bita (0-255), dapat dikembalikan persis lewat a30TeksKeBita. */
function a30BitaKeTeks(bita) {
  const b = bita instanceof Uint8Array ? bita : new Uint8Array(bita || []);
  let keluar = "";
  for (let i = 0; i < b.length; i += 8192) keluar += String.fromCharCode.apply(null, Array.from(b.subarray(i, i + 8192)));
  return keluar;
}

/** Teks satu-aksara-per-bita -> bita. Aksara di atas 255 (tidak pernah dari a30BitaKeTeks) menjadi "?". */
function a30TeksKeBita(teks) {
  const s = String(teks || "");
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) {
    const k = s.charCodeAt(i);
    b[i] = k > 255 ? 63 : k;
  }
  return b;
}

/**
 * K2 untuk satu edoc putusan: pulang berkas anonimisasi dalam BENTUK YANG SAMA
 * (rtf/docx/doc/pdf) sesudah lolos pemeriksa atau dikonfirmasi petugas.
 * Tidak mengirim apa pun ke SIPP. TIDAK PERNAH melempar.
 */
async function a30SiapkanAnonimisasi(p) {
  const lapor = (teks) => {
    if (p.kabar) {
      p.kabar.className = "aleta-abt-kabar";
      p.kabar.textContent = teks;
    }
  };
  const berkas = p.berkas;
  const nama = String((berkas && berkas.name) || "");
  const bentuk = a30Bentuk(nama);
  if (!["rtf", "docx", "doc", "pdf"].includes(bentuk)) {
    return { ok: false, pesan: `Anonimisasi otomatis hanya untuk RTF, DOCX, DOC, atau PDF - ${nama || "berkas ini"} bukan.` };
  }
  try {
    let rtf = p.rtf || (bentuk === "rtf" ? berkas : null);
    if (!rtf) {
      lapor(`Anonimisasi 1/4: mengubah ${nama} menjadi RTF…`);
      const u = await a30KonversiNaskah(berkas, "rtf");
      if (!u.ok) return { ok: false, pesan: sambungSebab("Anonimisasi tidak dibuat", u.pesan) };
      rtf = u.berkas;
    }
    lapor("Anonimisasi 2/4: meminta ABT menganonimkan…");
    const perkaraId = await a30PerkaraIdUntukAbt(p.nomorPerkara);
    if (!perkaraId) {
      return {
        ok: false,
        pesan: "Anonimisasi tidak dibuat: nomor induk perkara (perkara_id) tidak terbaca, dan ABT membutuhkannya. Coba lagi sebentar lagi.",
      };
    }
    const anon = await a30AnonimAbt(rtf, p.nomorPerkara, perkaraId);
    if (!anon.ok) return anon;

    lapor("Anonimisasi 3/4: menyamarkan sisa nama pihak, saksi, dan alamat, lalu memeriksa…");
    // Butir 4 (7 Okt 2026): sisa yang ditinggalkan ABT disamarkan ALETA pada
    // SALINAN anonimisasi ini (edoc putusan asli tidak disentuh), lalu
    // salinan itulah yang diperiksa dan diunggah. Lihat a30SamarkanSisaRtf.
    let teksAnon = anon.teksRtf;
    let bitaAnon = anon.bita;
    let disamarkan = [];
    let periksa;
    try {
      const data = a30DataPribadiHalaman();
      try {
        const samar = a30SamarkanSisaRtf(teksAnon, data);
        if (samar.diganti.length) {
          teksAnon = samar.rtf;
          bitaAnon = a30TeksKeBita(teksAnon);
          disamarkan = samar.diganti;
        }
      } catch {
        /* penyamaran gagal = hasil ABT apa adanya; pemeriksa yang berbicara */
      }
      periksa = a30PeriksaAnonim(a30TeksRtf(teksAnon), data);
    } catch (galat) {
      periksa = { temuan: [], galat: String((galat && galat.message) || galat), diperiksa: { nama: 0, alamat: 0 } };
    }
    if (disamarkan.length) {
      try {
        alatCatat(
          "a30-anonim",
          `${p.nomorPerkara || ""}: ${disamarkan.length} sisa disamarkan ALETA pada salinan anonimisasi (edoc putusan asli tidak diubah)`,
          disamarkan.map((x) => x.jenis).join(", ")
        );
      } catch {
        /* kotak hitam hanya catatan */
      }
    }
    if (periksa.galat || periksa.temuan.length) {
      const jumlah = (jenis) => periksa.temuan.filter((x) => x.jenis === jenis).length;
      const ya = p.wadahTanya
        ? await a30Tanya(p.wadahTanya, {
            judul: "Pemeriksaan anonimisasi sebelum unggah ke SIPP",
            baris: [
              periksa.galat
                ? `Anonimisasi tidak dapat diperiksa (${periksa.galat}). Periksa berkasnya sendiri sebelum melanjutkan.`
                : `${jumlah("NIK") ? `⚠ ${jumlah("NIK")} NIK utuh` : "✓ NIK tersamar"} · ${
                    jumlah("nama pihak") ? `⚠ ${jumlah("nama pihak")} nama pihak utuh` : "✓ nama pihak tersamar"
                  } · ${jumlah("alamat") ? `⚠ ${jumlah("alamat")} alamat utuh` : "✓ alamat tersamar"}`,
              disamarkan.length
                ? `ALETA sudah menyamarkan ${disamarkan.length} sisa yang ditinggalkan ABT (pada salinan anonimisasi saja; edoc putusan tidak diubah). ` +
                  "Yang di bawah ini TIDAK dapat disamarkan otomatis. Bila dibatalkan: samarkan di ABT, lalu ulangi."
                : "Yang di bawah ini TIDAK dapat disamarkan otomatis. Bila dibatalkan: samarkan di ABT, lalu ulangi.",
              // 12OKT-I
              "Bila tetap diunggah, berkas anonimisasi ini TERBIT apa adanya di Direktori Putusan, dan keputusan Anda tercatat di jejak ALETA.",
            ],
            daftar: periksa.temuan
              .slice(0, 12)
              .map((x) => `${x.jenis} "${x.kata}"${x.dari ? ` (dari ${x.dari})` : ""}: ${x.konteks}`)
              .concat(periksa.temuan.length > 12 ? [`… dan ${periksa.temuan.length - 12} lagi.`] : []),
            centang: "Sudah saya periksa",
            ya: "Tetap unggah",
            tidak: "Batalkan unggah",
          })
        : false;
      try {
        alatCatat("a30-anonim", ya ? "unggah dilanjutkan sesudah konfirmasi anonim" : "unggah dibatalkan di pemeriksaan anonim", `${periksa.temuan.length} temuan`);
      } catch {
        /* kotak hitam hanya catatan */
      }
      if (!ya) {
        return {
          ok: false,
          batal: true,
          pesan: `Unggah dibatalkan: ${periksa.temuan.length} data pribadi masih utuh di anonimisasi. Samarkan di ABT, lalu ulangi.`,
        };
      }
    }

    let hasil = new File([bitaAnon], a30NamaAnonim(nama, "rtf"), { type: A30_MIME.rtf });
    if (bentuk !== "rtf") {
      lapor(`Anonimisasi 4/4: mengubah kembali menjadi ${bentuk.toUpperCase()}…`);
      const k = await a30KonversiNaskah(hasil, bentuk);
      if (!k.ok) return { ok: false, pesan: sambungSebab("Anonimisasi tidak dibuat", k.pesan) };
      hasil = new File([k.berkas], a30NamaAnonim(nama, bentuk), { type: k.berkas.type || A30_MIME[bentuk] });
    }
    lapor(`Anonimisasi siap: ${hasil.name}${disamarkan.length ? ` (${disamarkan.length} sisa disamarkan ALETA)` : ""}.`);
    // 12OKT-I: nama yang SUDAH dilihat dan direlakan petugas di dialog di atas
    // diteruskan ke server ("Tetap unggah"), supaya tidak ditolak lagi.
    const namaDirelakan = Array.from(new Set(periksa.temuan.filter((x) => x.jenis === "nama pihak").map((x) => String(x.kata))));
    return {
      ok: true,
      berkas: hasil,
      temuan: periksa.temuan.length,
      diperiksa: periksa.diperiksa,
      disamarkan: disamarkan.length,
      ...(namaDirelakan.length ? { tetapUnggah: { nama: namaDirelakan } } : {}),
    };
  } catch (galat) {
    return { ok: false, pesan: sambungSebab("Anonimisasi tidak dibuat", galat) };
  }
}

/** Kiriman edoc sesudah putusan tersimpan (butir 19) - rute unggah-sipp yang sudah ada. */
async function a30UnggahEdoc(p) {
  // Rincian per langkah (tercatat / gagal + sebab) untuk laporan dan kotak muat ulang bersama
  // (putusan-edoc-sekaligus.js, agen B2). Tanpa modul itu hasilnya persis semula.
  const akhiri = (x) => {
    const m = typeof globalThis !== "undefined" ? globalThis.aletaPutusanEdoc : null;
    return m && typeof m.langkahDariUnggah === "function"
      ? { ...x, langkah: m.langkahDariUnggah(x, { putusan: Boolean(p.putusan), anonimisasi: Boolean(p.anonimisasi) }) }
      : x;
  };
  if (p.kabar) {
    p.kabar.textContent = p.putusan
      ? `Tersimpan di SIPP. Mengunggah edoc putusan${p.anonimisasi ? " dan edoc anonimisasi sekaligus" : ""}…`
      : "Tersimpan di SIPP. Mengunggah edoc anonimisasi…";
  }
  const badan = new FormData();
  badan.append("perkaraId", perkaraIdDariHalaman());
  badan.append("nomorPerkara", p.nomorPerkara || "");
  badan.append("olehUsername", namaPenggunaSipp() || "");
  // Putusan boleh kosong (agen B2): e-Doc putusannya sudah ada di SIPP dan tidak diganti,
  // hanya anonimisasinya yang menyusul.
  if (p.putusan) badan.append("putusan", p.putusan);
  if (p.anonimisasi) badan.append("anonimisasi", p.anonimisasi);
  // Anonimisasi buatan penyamar: sisa nama pihak/NIK yang masih lolos disamarkan lagi di rute
  // pada salinan anonimisasi (putusan asli tidak diubah) - sama dengan unggah massal di ABT.
  if (p.samarkanSisa && p.anonimisasi) badan.append("samarkanSisa", "1");
  try {
    // 12OKT-I: keputusan "Tetap unggah" dari dialog pemeriksa ikut; penolakan
    // server yang membolehkan ditawarkan di wadah pemanggil (bila ada). Hanya
    // wadah yang disebut pemanggil: antrean massal tidak punya wadah, dan
    // dialog tanpa orang di depannya akan menahan antrean selamanya.
    const batas = p.anonimisasi ? BATAS_UNGGAH_SIPP_MS * 2 : BATAS_UNGGAH_SIPP_MS;
    let jawab;
    try {
      jawab =
        typeof kirimUnggahSippTetap === "function"
          ? await kirimUnggahSippTetap(badan, batas, {
              tetapUnggah: p.anonimisasi ? p.tetapUnggah || null : null,
              wadah: p.wadah || null,
              kabar: p.kabar || null,
            })
          : await kirimBadanUnggahSipp(badan, batas);
    } catch (galat) {
      // ======================================================================
      // 14 Okt: PENOLAKAN SLOT ANONIMISASI TIDAK MENAHAN EDOC PUTUSAN
      // ======================================================================
      //
      // Perkara 564 (12 Okt): unggah-sipp 409 dua kali - slot anonimisasi
      // ditolak pemeriksa isi, dan karena satu kiriman memuat keduanya, edoc
      // PUTUSAN ikut tidak masuk. Kiriman yang ditolak 409 belum menulis apa
      // pun ke SIPP, jadi putusan dikirim ulang SENDIRIAN (setara
      // unggahBerkasAbt di abt.js); anonimisasinya menyusul.
      const tolak = galat && galat.tolak;
      if (!p.anonimisasi || !p.putusan || !tolak || tolak.slot !== "anonimisasi") throw galat;
      try {
        alatCatat("a30-anonim", "anonimisasi ditolak server - edoc putusan dikirim sendirian", String(tolak.alasan || ""));
      } catch {
        /* kotak hitam hanya catatan */
      }
      if (p.kabar) p.kabar.textContent = "Anonimisasi ditolak server - mengunggah edoc putusan sendirian…";
      badan.delete("anonimisasi");
      badan.delete("tetapUnggah");
      badan.delete("tetapUnggahNama");
      const sendiri = await kirimBadanUnggahSipp(badan, BATAS_UNGGAH_SIPP_MS);
      const masuk = Boolean(sendiri && sendiri.ok) && (sendiri.berkas || []).some((b) => b.ok);
      return akhiri({
        ok: false,
        // Rincian per berkas untuk laporan per langkah (putusan-edoc-sekaligus.js).
        berkas: (sendiri && sendiri.berkas) || [],
        anonimDitolak: String(galat.message || tolak.alasan || "ditolak"),
        bunyi: masuk
          ? `Edoc putusan terunggah; edoc anonimisasi TIDAK diunggah: ${String(galat.message || "ditolak")} ` +
            'Perbaiki anonimisasinya lalu unggah lewat bagian "Unggah putusan ke SIPP".'
          : sambungSebab("Edoc tidak terunggah", (sendiri && (sendiri.sebab || sendiri.pesan)) || galat.message, true),
      });
    }
    if (!jawab.ok) return akhiri({ ok: false, bunyi: sambungSebab("Edoc tidak terunggah", jawab.sebab || jawab.pesan || jawab.alasan || "ditolak", true) });
    const semua = jawab.berkas || [];
    const gagal = semua.filter((b) => !b.ok);
    if (!semua.length || gagal.length) {
      const masuk = semua.filter((b) => b.ok).map((b) => (b.jenis === "anonimisasi" ? "anonimisasi" : "putusan"));
      return akhiri({
        ok: false,
        berkas: semua,
        bunyi: `Edoc terunggah: ${masuk.join(" dan ") || "tidak ada"}; gagal: ${gagal
          .map((b) => `${b.jenis === "anonimisasi" ? "anonimisasi" : "putusan"} - ${pesanGagalUnggah(b)}`)
          .join("; ") || "tidak ada jawaban per berkas"}.`,
      });
    }
    // Butir 6 (6 Okt): naskah yang disimpan di peramban untuk edoc antrean
    // tidak disimpan lebih lama dari perlunya - edocnya sudah masuk.
    // 14 Okt: hanya bila anonimisasinya IKUT masuk - putusan yang terunggah
    // sendirian masih memerlukan naskahnya untuk anonimisasi yang menyusul.
    if (p.anonimisasi && typeof a30HapusNaskahEdoc === "function") {
      try {
        await a30HapusNaskahEdoc(p.nomorPerkara);
      } catch {
        /* simpanan peramban hanya pembantu */
      }
    }
    return akhiri({
      ok: true,
      berkas: semua,
      bunyi: `${p.putusan ? `Edoc putusan${p.anonimisasi ? " dan edoc anonimisasi" : ""}` : "Edoc anonimisasi"} terunggah${jawab.antrean ? ", dan perkara ini masuk antrean Direktori Putusan" : ""}.`,
    });
  } catch (galat) {
    return akhiri({ ok: false, bunyi: sambungSebab("Edoc tidak terunggah", galat) });
  }
}

/**
 * ============================================================================
 * MENUNGGU ANONIMISASI - DENGAN BATAS DAN KABAR (7 Okt 2026, butir 3)
 * ============================================================================
 *
 * "13 isian terisi. Menunggu anonimisasi siap..." lalu diam selamanya
 * (perkara 532/Pdt.G/2026). Sebabnya: anonimisasi yang disiapkan di latar
 * berhenti di dialog pemeriksa yang tergambar di kotak naskah di PUNCAK
 * bagian Putusan, jauh di atas tombol Isikan, sedangkan penantian di bawah
 * tidak membatasi diri dan tidak menyebut apa yang ditunggunya. ABT yang tidak
 * menjawab pun membuatnya menunggu tanpa akhir.
 *
 * Kini: selama dialog pemeriksa terbuka (keputusan manusia) waktunya tidak
 * dihitung dan kabarnya menunjuk dialog itu; selebihnya sesudah batasMs
 * petugas ditanya - Tunggu lagi / Ulangi anonimisasi / Simpan dan unggah edoc
 * putusan saja - dengan langkah terakhir yang terbaca sebagai sebabnya. Tanpa
 * wadah (antrean massal) batas itu langsung menjadi kegagalan bersebab.
 * Tidak menulis apa pun ke SIPP. TIDAK PERNAH melempar.
 */
async function a30TungguAnonim(p) {
  const tangkap = (janji) =>
    Promise.resolve(janji).catch((galat) => ({ ok: false, pesan: sambungSebab("Anonimisasi tidak dibuat", galat) }));
  let janji = tangkap(p.janji);
  const batasMs = Math.max(1000, Number(p.batasMs) || (typeof A30_BATAS_TUNGGU_ANONIM_MS === "number" ? A30_BATAS_TUNGGU_ANONIM_MS : 75000));
  const detak = typeof A30_DETAK_TUNGGU_ANONIM_MS === "number" ? A30_DETAK_TUNGGU_ANONIM_MS : 250;
  const berlaku = () => (typeof p.masihBerlaku === "function" ? p.masihBerlaku() : true);
  const tanyaTerbuka = () => (p.wadah ? p.wadah.querySelector(".aleta-a30-tanya:not(.aleta-a30-tunggu)") : null);
  const langkah = () => String((p.kabarLangkah && p.kabarLangkah.textContent) || "").trim();
  const detik = Math.round(batasMs / 1000);
  for (;;) {
    let sisa = batasMs;
    let tadiTanya = false;
    let siap = null;
    while (!siap) {
      siap = await Promise.race([janji.then((x) => ({ x })), new Promise((r) => setTimeout(() => r(null), detak))]);
      if (siap) break;
      if (!berlaku()) return { ok: false, pesan: "Penantian anonimisasi ditinggalkan." };
      const tanya = tanyaTerbuka();
      if (tanya) {
        // Keputusan manusia: tidak dihitung, dan kabarnya menunjuk dialognya.
        if (!tadiTanya) {
          tadiTanya = true;
          if (p.kabar && p.kabar !== p.kabarLangkah) {
            p.kabar.className = "aleta-abt-kabar";
            p.kabar.textContent = "Pemeriksaan anonimisasi menunggu jawaban Anda di bawah ini - Simpan menunggu jawaban itu.";
          }
          if (typeof tanya.scrollIntoView === "function") tanya.scrollIntoView({ block: "nearest" });
        }
        continue;
      }
      tadiTanya = false;
      sisa -= detak;
      if (sisa <= 0) break;
    }
    if (siap) return siap.x;
    const terakhir = langkah();
    const sebab =
      `Anonimisasi belum siap sesudah ${detik} detik` +
      (terakhir ? ` - langkah terakhir: "${terakhir}"` : "") +
      ". Biasanya ABT lambat atau sesinya habis (buka ABT di tab lain).";
    if (!p.wadah) return { ok: false, pesan: `${sebab} Edoc tidak diunggah.` };
    const pilihan = await a30PilihSesudahBatas(p.wadah, `${sebab} Putusan BELUM disimpan.`, janji, berlaku);
    if (pilihan && pilihan.x) return pilihan.x;
    if (pilihan === "tunggu") continue;
    if (pilihan === "ulangi") {
      janji = tangkap(Promise.resolve().then(p.ulangi));
      continue;
    }
    if (pilihan === "tinggal") return { ok: false, pesan: "Penantian anonimisasi ditinggalkan." };
    return { ok: false, dilewati: true, pesan: `anonimisasi dilewati atas pilihan Anda sesudah ${detik} detik menunggu` };
  }
}

/** Kartu pilihan sesudah batas waktu. Pulang "tunggu" | "ulangi" | "lewati" | "tinggal" | {x} bila anonimisasinya keburu siap. */
function a30PilihSesudahBatas(wadah, sebab, janji, berlaku) {
  return new Promise((selesai) => {
    const kartu = buatElemen("div", "aleta-a30-tanya aleta-a30-tunggu");
    kartu.setAttribute("role", "alertdialog");
    kartu.appendChild(buatElemen("div", "aleta-a30-tanya-judul", "Anonimisasi belum siap"));
    kartu.appendChild(buatElemen("div", "aleta-a30-tanya-baris", sebab));
    const aksi = buatElemen("div", "aleta-a30-tanya-aksi");
    let usai = false;
    const tutup = (hasil) => {
      if (usai) return;
      usai = true;
      kartu.remove();
      selesai(hasil);
    };
    for (const [teks, nilai] of [
      ["Tunggu lagi", "tunggu"],
      ["Ulangi anonimisasi", "ulangi"],
      ["Simpan, unggah edoc putusan saja", "lewati"],
    ]) {
      const b = buatElemen("button", "aleta-permintaan-tombol", teks);
      b.type = "button";
      b.setAttribute("data-a30-pilih", nilai);
      b.addEventListener("click", () => tutup(nilai));
      aksi.appendChild(b);
    }
    kartu.appendChild(aksi);
    wadah.appendChild(kartu);
    if (typeof kartu.scrollIntoView === "function") kartu.scrollIntoView({ block: "nearest" });
    // Anonimisasi yang keburu siap menutup kartunya sendiri.
    Promise.resolve(janji).then((x) => tutup({ x }));
    const jaga = () => {
      if (usai) return;
      if (!kartu.isConnected || (typeof berlaku === "function" && !berlaku())) return tutup("tinggal");
      setTimeout(jaga, 500);
    };
    setTimeout(jaga, 500);
  });
}

/**
 * Opsi simpanPutusanLaluBuka dari Putusan otomatis (Baru & UI Baru): keadaan
 * sebelum yang sudah dibaca, jajak cepat, dan - bila dicentang - edoc yang
 * DISIAPKAN sekarang (sebelum Simpan) lalu diunggah sesudah Simpan terbukti.
 * Edoc yang gagal disiapkan TIDAK menahan Simpan putusan: sebabnya ikut
 * bunyi akhir dan halaman dibiarkan supaya terbaca.
 */
async function a30OpsiSimpanPutusan(p) {
  const opsi = { sebelum: p.sebelum || null, jajakCepat: true };
  if (!p.edoc || !p.edoc.asli) return opsi;
  // Perbaikan 1 Okt (S, butir 4 - hanya UI Baru yang mengisi edoc.anonim):
  // anonimisasi yang DIPILIH petugas diunggah apa adanya, tanpa dibuat ulang.
  if (p.edoc.anonim) {
    const anonimDipilih = p.edoc.anonim;
    opsi.sesudahTersimpan = (kabar) =>
      a30UnggahEdoc({ nomorPerkara: p.nomorPerkara, putusan: p.edoc.asli, anonimisasi: anonimDipilih, kabar });
    return opsi;
  }
  // UI Baru (perbaikan 1 Okt, butir 12): anonimisasi yang sudah disiapkan di
  // latar sejak naskah dibaca dipakai; selain itu disiapkan sekarang.
  // 7 Okt 2026: penantiannya dibatasi (a30TungguAnonim) - sebelumnya ia
  // menunggu tanpa akhir dan tanpa kabar.
  const siapkan = () =>
    a30SiapkanAnonimisasi({
      berkas: p.edoc.asli,
      rtf: p.edoc.rtf,
      nomorPerkara: p.nomorPerkara,
      kabar: p.kabar,
      wadahTanya: p.wadah,
    });
  const janjiAnon = p.anonSiap ? p.anonSiap : siapkan();
  const anon =
    typeof a30TungguAnonim === "function"
      ? await a30TungguAnonim({
          janji: janjiAnon,
          ulangi: siapkan,
          wadah: p.wadah || null,
          kabar: p.kabar || null,
          kabarLangkah: p.kabarLangkah || p.kabar || null,
          masihBerlaku: p.masihBerlaku,
        })
      : await janjiAnon;
  // 14 Okt: anonimisasi yang GAGAL (ABT 500 - perkara 473, 13 Okt: "Maximum
  // execution time of 30 seconds exceeded" di Anonimisasi.php atas RTF hasil
  // DOCX) atau dibatalkan petugas tidak lagi menahan edoc PUTUSAN. Dahulu
  // cabang !anon.ok menjawab "Edoc TIDAK diunggah" tanpa mengirim apa pun,
  // sehingga putusan yang sudah tersimpan tidak punya edoc sama sekali.
  if (anon && (anon.dilewati || !anon.ok)) {
    // Pilihan petugas sesudah batas waktu, atau anonimisasi gagal: putusan
    // disimpan, edoc putusan tetap diunggah, anonimisasinya menyusul lewat
    // "Unggah putusan ke SIPP".
    opsi.sesudahTersimpan = async (kabar) => {
      const unggah = await a30UnggahEdoc({ nomorPerkara: p.nomorPerkara, putusan: p.edoc.asli, anonimisasi: null, kabar });
      return {
        ok: false,
        // Laporan per langkah: putusan menurut hasil unggah, anonimisasi menurut sebab di bawah.
        ...(Array.isArray(unggah.langkah)
          ? {
              langkah: unggah.langkah.concat([
                {
                  kunci: "anonimisasi",
                  judul: "e-Doc anonimisasi",
                  teks: `${anon.dilewati ? "dilewati atas pilihan Anda" : "belum diunggah"} - ${String(anon.pesan || "anonimisasi tidak siap").replace(/\s+/g, " ").trim()}`,
                  nada: anon.dilewati ? "lewat" : "salah",
                },
              ]),
            }
          : {}),
        bunyi:
          `${unggah.bunyi} Edoc anonimisasi BELUM diunggah (${anon.pesan}) - unggah lewat bagian ` +
          '"Unggah putusan ke SIPP" sesudah anonimisasinya siap.',
      };
    };
    return opsi;
  }
  if (!anon) {
    opsi.sesudahTersimpan = (kabar) =>
      a30UnggahEdoc({ nomorPerkara: p.nomorPerkara, putusan: p.edoc.asli, anonimisasi: null, kabar });
    return opsi;
  }
  opsi.sesudahTersimpan = (kabar) =>
    a30UnggahEdoc({
      nomorPerkara: p.nomorPerkara,
      putusan: p.edoc.asli,
      anonimisasi: anon.berkas,
      kabar,
      tetapUnggah: anon.tetapUnggah || null,
      wadah: p.wadah || null,
    });
  return opsi;
}

/*
 * ============================================================================
 * EDOC PADA PUTUSAN MASSAL (6 Oktober 2026, butir 6)
 * ============================================================================
 *
 * "Putusan otomatis sudah bisa mengisi blangko putusan, tetapi tidak ikut
 * mengunggah edoc putusan, dan edoc anonimisasi tidak dibuatkan."
 *
 * Antrean massal bekerja di halaman tiap perkara, SESUDAH halaman dimuat
 * ulang - berkas naskah yang dipilih petugas di halaman daftar sudah tidak
 * ada lagi di sana, dan portal sengaja tidak menyimpan berkas aslinya (rute
 * unggah-naskah hanya menyimpan draf hasil pemotongan). Karena itu naskah
 * asli disimpan di PERAMBAN INI (IndexedDB asal SIPP - bukan di server),
 * per nomor perkara, saat:
 *   - "Kirim naskah lalu susun antrean" (Putusan massal - dari berkas);
 *   - naskah dikirim dari Putusan otomatis panel satu perkara (supaya
 *     "Putusan massal - SIPP" atas draf itu pun dapat mengunggah edocnya).
 * Simpanannya dibuang sesudah edocnya terunggah, dan yang berumur lebih dari
 * 14 hari dibuang sendiri. Bentuk yang diterima sama dengan a30BarisSekaligus
 * (RTF/DOCX/DOC/PDF); TXT tidak disimpan.
 *
 * Unggah dan anonimisasinya TIDAK ditulis ulang: a30OpsiSimpanPutusan dan
 * a30UnggahEdoc yang sama dengan panel satu perkara.
 */
const A30_RAK_NASKAH = { nama: "aleta-naskah-edoc", toko: "naskah", umurMs: 14 * 24 * 60 * 60 * 1000 };

const a30KunciRak = (nomor) => String(nomor || "").trim().toLowerCase();

/** Basis data rak naskah, atau null bila IndexedDB tidak ada/ditolak. TIDAK PERNAH melempar. */
function a30BukaRakNaskah() {
  return new Promise((selesai) => {
    let idb = null;
    try {
      idb = typeof indexedDB !== "undefined" && indexedDB ? indexedDB : null;
    } catch {
      idb = null;
    }
    if (!idb) return selesai(null);
    let minta;
    try {
      minta = idb.open(A30_RAK_NASKAH.nama, 1);
    } catch {
      return selesai(null);
    }
    minta.onupgradeneeded = () => {
      try {
        const db = minta.result;
        if (!db.objectStoreNames.contains(A30_RAK_NASKAH.toko)) db.createObjectStore(A30_RAK_NASKAH.toko, { keyPath: "kunci" });
      } catch {
        /* gagal dibuat: onerror yang menjawab */
      }
    };
    minta.onsuccess = () => selesai(minta.result);
    minta.onerror = () => selesai(null);
    minta.onblocked = () => selesai(null);
  });
}

/** Satu transaksi rak. Pulang {ok, hasil}; TIDAK PERNAH melempar. */
async function a30TransaksiRak(mode, kerja) {
  const db = await a30BukaRakNaskah();
  if (!db) return { ok: false, hasil: null };
  return new Promise((selesai) => {
    let hasil = null;
    const tutup = (ok) => {
      try {
        db.close();
      } catch {
        /* sudah tertutup */
      }
      selesai({ ok, hasil: ok ? hasil : null });
    };
    try {
      const tx = db.transaction(A30_RAK_NASKAH.toko, mode);
      const m = kerja(tx.objectStore(A30_RAK_NASKAH.toko));
      if (m) {
        m.onsuccess = () => {
          hasil = m.result;
        };
      }
      tx.oncomplete = () => tutup(true);
      tx.onerror = () => tutup(false);
      tx.onabort = () => tutup(false);
    } catch {
      tutup(false);
    }
  });
}

async function a30BitaBerkas(berkas) {
  if (!berkas) return null;
  const bita = typeof berkas.arrayBuffer === "function" ? await berkas.arrayBuffer() : null;
  if (!bita) return null;
  return { nama: String(berkas.name || ""), tipe: String(berkas.type || ""), bita };
}

/**
 * Menyimpan naskah asli (dan RTF-nya bila sudah diubah) untuk edoc antrean.
 * Pulang true bila tersimpan. TIDAK PERNAH melempar.
 */
async function a30SimpanNaskahEdoc(nomor, asli, rtf) {
  try {
    const kunci = a30KunciRak(nomor);
    if (!kunci || !asli || !["rtf", "docx", "doc", "pdf"].includes(a30Bentuk(asli.name))) return false;
    const rekam = {
      kunci,
      nomor: String(nomor),
      asli: await a30BitaBerkas(asli),
      rtf: rtf && rtf !== asli ? await a30BitaBerkas(rtf) : null,
      waktu: Date.now(),
    };
    if (!rekam.asli) return false;
    // Yang kedaluwarsa dibuang sekalian - rak ini tidak tumbuh tanpa batas.
    const semua = await a30TransaksiRak("readonly", (toko) => toko.getAll());
    for (const lama of (semua.ok && Array.isArray(semua.hasil) ? semua.hasil : [])) {
      if (lama && Date.now() - Number(lama.waktu || 0) > A30_RAK_NASKAH.umurMs) {
        await a30TransaksiRak("readwrite", (toko) => toko.delete(lama.kunci));
      }
    }
    const simpan = await a30TransaksiRak("readwrite", (toko) => toko.put(rekam));
    return simpan.ok;
  } catch {
    return false;
  }
}

/** Naskah tersimpan untuk satu nomor: {asli: File, rtf: File|null}, atau null. TIDAK PERNAH melempar. */
async function a30AmbilNaskahEdoc(nomor) {
  try {
    const kunci = a30KunciRak(nomor);
    if (!kunci) return null;
    const baca = await a30TransaksiRak("readonly", (toko) => toko.get(kunci));
    const r = baca.ok ? baca.hasil : null;
    if (!r || !r.asli || !r.asli.bita) return null;
    if (Date.now() - Number(r.waktu || 0) > A30_RAK_NASKAH.umurMs) return null;
    const jadi = (b) => new File([b.bita], b.nama, { type: b.tipe || A30_MIME[a30Bentuk(b.nama)] || "" });
    return { asli: jadi(r.asli), rtf: r.rtf && r.rtf.bita ? jadi(r.rtf) : null };
  } catch {
    return null;
  }
}

async function a30HapusNaskahEdoc(nomor) {
  const kunci = a30KunciRak(nomor);
  if (!kunci) return false;
  const hapus = await a30TransaksiRak("readwrite", (toko) => toko.delete(kunci));
  return hapus.ok;
}

/**
 * Opsi simpanPutusanLaluBuka untuk SATU perkara antrean massal (Baru & UI
 * Baru): opsi dasar a30OpsiSimpanMassal + edoc dari naskah tersimpan, lewat
 * a30OpsiSimpanPutusan yang sama dengan panel satu perkara. Selalu
 * lanjutWalauEdocGagal - antrean tidak berhenti karena edoc.
 */
async function a30OpsiEdocMassal(p) {
  const dasar = p.opsi || {};
  const naskah = await a30AmbilNaskahEdoc(p.nomorPerkara);
  if (!naskah) {
    // Agen B2 (20 Okt): tanpa naskah di peramban ini, edoc putusan + anonimisasi dicetak dari Blangko Derry
    // di ABT sesudah Simpan terbukti (putusan-edoc-sekaligus.js) - selama saklarnya menyala. Antrean tidak
    // berhenti karena edoc; hasilnya tercatat per perkara. Tanpa modul/saklar mati: jalan keluar lama.
    const mod = typeof globalThis !== "undefined" ? globalThis.aletaPutusanEdoc : null;
    if (mod && typeof mod.jalankan === "function" && typeof mod.bacaSaklar === "function" && (await mod.bacaSaklar())) {
      return {
        ...dasar,
        lanjutWalauEdocGagal: true,
        sesudahTersimpan: (kabarLangkah) =>
          mod.jalankan({ nomorPerkara: p.nomorPerkara, kabar: p.kabar || kabarLangkah || null, wadah: p.wadahTanya || null }),
      };
    }
    return {
      ...dasar,
      lanjutWalauEdocGagal: true,
      sesudahTersimpan: async () => ({
        ok: false,
        bunyi:
          "Edoc putusan dan edoc anonimisasi TIDAK diunggah: naskah aslinya tidak tersimpan di peramban ini " +
          "(kirim naskahnya lewat “Kirim naskah lalu susun antrean” atau Putusan otomatis perkara ini di PC ini). " +
          "Unggah lewat bagian “Unggah putusan ke SIPP” di halaman perkaranya.",
      }),
    };
  }
  const opsi = await a30OpsiSimpanPutusan({
    nomorPerkara: p.nomorPerkara,
    kabar: p.kabar,
    wadah: p.wadahTanya || null,
    sebelum: dasar.sebelum || null,
    edoc: naskah,
  });
  // Terunggah: a30UnggahEdoc sendiri membuang naskah tersimpannya.
  return { ...dasar, ...opsi, lanjutWalauEdocGagal: true };
}
const MPS_GELAR_DEPAN = new Set(["dr", "dra", "drs", "hj", "h", "ir", "prof", "kh", "ust", "ustadz", "ustazah"]);
const MPS_GELAR_BELAKANG = new Set([
  "sh", "shi", "mh", "mhi", "mag", "sag", "sy", "ssy", "lc", "ma", "mm", "se", "si", "amd", "sthi", "skom",
  "spd", "mpd", "ssos", "msi", "mkn", "llm", "phd", "sip", "mhum", "shum", "sth", "mth", "st", "mt",
]);

/**
 * Penjelasan TEKNIS di panel SIPP (butir 3, KONTRAK K5) - ditandai kelas
 * aleta-teknis supaya saklar "Sembunyikan penjelasan teknis" (W) dapat
 * menyembunyikannya. Pesan error, peringatan, kabar, dan konfirmasi TIDAK
 * PERNAH ditandai (A30_BUKAN_PENJELASAN, dan pola teks yang sempit).
 */
const MPS_TEKNIS = [
  // "diperiksa 2 menit lalu" - keterangan umur data. Yang BASI (aleta-usia-basi) peringatan, tidak ditandai.
  [".aleta-kepala-usia", null],
  // Penjelasan cara kerja yang memang ditandai "remeh" sejak lama.
  [".aleta-tetap-sebab.aleta-remeh", null],
  [".aleta-kosong-lembut", /^Tercatat di basis data ALETA/],
  [".aleta-t7-ket.aleta-t7-lembut", /^(Hanya tersimpan di peramban|Disisipkan ke kotak|Tidak berlaku selagi|Dari checklist milestone|\d+ belum selesai dari)/],
  [".aleta-baris-ket", /^Penandanya tertempel di bawah nomor perkara/],
];

function mpsPeran() {
  return typeof penggunaTerakhir !== "undefined" && penggunaTerakhir && penggunaTerakhir.peran ? String(penggunaTerakhir.peran) : "";
}

function mpsSiapMatriks() {
  return (
    typeof a30Aktif === "function" &&
    a30Aktif() &&
    typeof alatMenuPeran === "function" &&
    typeof alatGolonganPeran === "function"
  );
}

// ─── Nama: akun ALETA / SIPP dicocokkan dengan petugas perkara ───────────────

/** Inti nama tanpa gelar depan/belakang: "Dra. Hj. Munifa, S.H.I., M.H." -> ["munifa"]. */
function mpsNamaInti(nama) {
  const sebelumKoma = String(nama || "").split(",")[0];
  const hasil = [];
  for (const mentah of sebelumKoma.split(/\s+/)) {
    if (!mentah) continue;
    // Titik DI TENGAH kata = singkatan gelar (S.H.I, M.Ag). Titik di ujung saja
    // (Muh., Hj.) disingkirkan dulu lalu diperiksa daftar gelar.
    const tanpaUjung = mentah.replace(/^\.+|\.+$/g, "");
    if (tanpaUjung.includes(".")) continue;
    const kata = tanpaUjung.toLowerCase().replace(/[^a-zÀ-ɏ'-]/g, "");
    if (!kata || MPS_GELAR_DEPAN.has(kata) || MPS_GELAR_BELAKANG.has(kata)) continue;
    hasil.push(kata);
  }
  return hasil;
}

/**
 * Sama orangnya? Seluruh kata inti nama yang lebih pendek ada di nama yang
 * lebih panjang. Sengaja longgar: cocok yang keliru hanya berarti menu TIDAK
 * dikurangi - arah kesalahan yang aman.
 */
function mpsNamaCocok(a, b) {
  const x = mpsNamaInti(a);
  const y = mpsNamaInti(b);
  if (!x.length || !y.length) return false;
  const [pendek, panjang] = x.length <= y.length ? [x, y] : [y, x];
  if (pendek.join("").length < 4) return false;
  return pendek.every((k) => panjang.includes(k));
}

// ─── Penjelasan teknis (butir 3) ─────────────────────────────────────────────

function mpsTandaiTeknis(akar) {
  if (!akar || typeof akar.querySelectorAll !== "function") return;
  for (const [pilih, pola] of MPS_TEKNIS) {
    for (const el of Array.from(akar.querySelectorAll(pilih))) {
      if (el.classList.contains("aleta-teknis")) continue;
      if (el.closest(A30_BUKAN_PENJELASAN)) continue;
      if (pola && !pola.test(String(el.textContent || "").replace(/\s+/g, " ").trim())) continue;
      el.classList.add("aleta-teknis");
      // Tombol ⓘ milik penjelasan terlipat ikut: tanpa penjelasannya ia tidak berarti.
      const info = el.previousElementSibling;
      if (info && info.hasAttribute("data-a30-info")) info.classList.add("aleta-teknis");
    }
  }
}
const S1_API_SIDANG = "/aleta/api/aleta-ecourt/sidang";

function s1Aktif() {
  try {
    return typeof t7Modern === "function" && t7Modern();
  } catch {
    return false;
  }
}

function s1Golongan() {
  try {
    return typeof alatGolonganPeran === "function" ? alatGolonganPeran(mpsPeran()) : "lain";
  } catch {
    return "lain";
  }
}

/**
 * Butir 12: menunggu borang SIPP menggambar ulang sesudah pintu diisi.
 * Berhenti begitu jumlah medan yang tampak melampaui `awal` - diperiksa
 * seketika, lalu tiap 50 ms; bila tidak pernah bertambah, berhenti sesudah
 * batasMs (S1_TUNGGU_PINTU_MS; 350 ms tetap sampai 5 Okt 2026).
 */
const S1_TUNGGU_PINTU_MS = 150;
async function s1TungguBerubah(hitung, awal, batasMs) {
  const mulai = Date.now();
  // 5 Okt 2026: dibaca SEKETIKA lebih dulu. Penangan change Status Putusan
  // dan Qobla di edit_putusan_akhir.php hanya .show()/.hide() serentak, jadi
  // medan yang muncul sudah tampak begitu jembatan menjawab isian pintunya -
  // menidurkan 70 ms dulu hanya memperlambat.
  for (let pertama = true; ; pertama = false) {
    const sisa = batasMs - (Date.now() - mulai);
    if (!pertama && sisa <= 0) return false;
    if (!pertama) await s1Jeda(Math.min(50, sisa));
    let kini = 0;
    try {
      kini = Number(await hitung()) || 0;
    } catch {
      kini = 0;
    }
    if (kini > awal) return true;
  }
}

/** Butir 12: bacaan praperiksa serentak - hasilnya sama dengan bacaUsulanBorangPutusan. */
async function s1BacaUsulanBorangCepat() {
  const terpilih = async (penunjuk) => {
    const jawab = await kirimKeJembatan({ jenis: "pilihan", penunjuk });
    if (!jawab || !jawab.ok) return { nilai: "", label: "" };
    const nilai = String(jawab.nilaiSekarang || "");
    const pilihan = (jawab.pilihan || []).find((x) => String(x.nilai) === nilai);
    return { nilai, label: pilihan ? String(pilihan.label || "") : "" };
  };
  const [tanggal, status, verstek] = await Promise.all([
    Promise.all(PENUNJUK_TANGGAL_PUTUSAN.map((penunjuk) => kirimKeJembatan({ jenis: "nilai", penunjuk }))),
    terpilih('select[name="status_putusan"]'),
    terpilih('select[name="verstek"]'),
  ]);
  const pertama = tanggal.find((j) => j && j.ok);
  return {
    tanggalPutusan: pertama ? String(pertama.nilai || "") : "",
    statusPutusan: status.nilai === "-1" ? "" : status.label,
    verstek: verstek.nilai === "Y" || verstek.nilai === "T" ? verstek.nilai : "",
  };
}

/** Kunci ingat buka/tutup untuk kartu statis (yang dulu tidak dapat dilipat). */
function s1KunciLipat(el) {
  if (!el.classList.contains("aleta-t7-kartu")) return "";
  const fitur = el.getAttribute("data-t7-fitur") || "";
  const judul = el.querySelector(":scope > .aleta-t7-kartu-judul");
  return `sipp-kartu:${fitur || String((judul && judul.textContent) || "").trim().toLowerCase()}`;
}

function s1LipatkanSemua(akar) {
  if (typeof alatJadikanLipat !== "function" || !akar || typeof akar.querySelectorAll !== "function") return;
  const bertab = Boolean(akar.querySelector(":scope > .aleta-t7-tabbar"));
  for (const el of Array.from(akar.querySelectorAll(".aleta-bagian, .aleta-kelompok, .aleta-t7-kartu, details"))) {
    if (el.__aletaLipat || el.classList.contains("aleta-lipatan")) continue;
    // Kelompok yang menjadi tab: kepalanya disembunyikan Tahap 7 dan isinya
    // selalu tampak - menjadikannya lipatan hanya menambah kepala kedua.
    if (bertab && el.classList.contains("aleta-kelompok")) continue;
    // Bagian milik berkas lain yang sudah memasang lipatnya sendiri dilewati.
    if (el.closest(".aleta-t7-menu")) continue;
    const kunci = s1KunciLipat(el);
    // Perbaikan 2 Okt (butir 19): kartu tambahan DI DALAM tab (tenggat,
    // catatan, komentar BAS, templat) tertutup sebagai bawaan; ingatan
    // petugas tetap menang (alatJadikanLipat memakai `terbuka` hanya bila
    // kuncinya belum pernah diingat).
    const tertutup = typeof s2KartuTertutup === "function" && s2KartuTertutup(el);
    try {
      alatJadikanLipat(el, kunci ? (tertutup ? { kunci, terbuka: false } : { kunci }) : tertutup ? { terbuka: false } : undefined);
    } catch {
      /* bentuk lama tetap bekerja */
    }
  }
}

/** Menyapu sekarang dan tiap kali bagian malas lahir belakangan. */
function s1PasangLipat(akar) {
  if (!akar || akar.__s1Lipat) return;
  akar.__s1Lipat = true;
  s1LipatkanSemua(akar);
  let jadwal = 0;
  try {
    new MutationObserver(() => {
      if (jadwal) return;
      jadwal = setTimeout(() => {
        jadwal = 0;
        if (akar.isConnected && s1Aktif()) s1LipatkanSemua(akar);
      }, 0);
    }).observe(akar, { childList: true, subtree: true });
  } catch {
    /* tanpa pengamat: bagian yang lahir belakangan tetap berbentuk lama */
  }
}

/** Cadangan bila basmassal.js (M) belum termuat - kata yang sama, lebih sempit. */
function s1AlasanPutusanCadangan(s) {
  const alasan = String((s && s.alasanDitunda) || "").toLowerCase();
  const agenda = String((s && s.agenda) || "").toLowerCase();
  if (/\b(?:di)?putus\b|dikabulkan|ditolak|tidak dapat diterima|dicabut|gugur|dicoret/.test(alasan)) {
    return { layak: true, jenis: "putus", sebab: `Hasil sidang: ${s.alasanDitunda}` };
  }
  if (/musyawarah|pembacaan putusan|pembacaan penetapan/.test(alasan)) {
    return { layak: true, jenis: "tunda-putusan", sebab: `Ditunda untuk: ${s.alasanDitunda}` };
  }
  if (!alasan.trim() && /musyawarah|pembacaan putusan|\bputus\b/.test(agenda)) {
    return { layak: true, jenis: "agenda-putusan", sebab: `Agenda hari itu: ${s.agenda}` };
  }
  return { layak: false, jenis: "", sebab: "" };
}

/**
 * Elemen ini sungguh ditawarkan halaman? Leluhur ber-display:none (jQuery
 * .hide() SIPP) = tidak. Tanpa tata letak (jsdom) tetap dianggap tampak -
 * yang diperiksa hanya gaya, bukan kotak.
 */
function s1TautanTampak(el) {
  for (let x = el; x && x.nodeType === 1; x = x.parentElement) {
    let gaya = null;
    try {
      gaya = window.getComputedStyle(x);
    } catch {
      gaya = null;
    }
    const tampilan = gaya ? gaya.display : x.style && x.style.display;
    if (tampilan === "none") return false;
    if (gaya && (gaya.visibility === "hidden" || gaya.visibility === "collapse")) return false;
  }
  return true;
}

/**
 * Tombol "Tambah Putusan Akhir" SIPP - baris tombol atas halaman detail
 * perkara (detil_perkara_agama.php):
 *
 *   <a onClick="popup_form('…/add_putusan_akhir/<enc>/tambah')">Tambah Putusan Akhir</a>
 *
 * (alur 2/16: "Tambah Penetapan (Putusan Akhir)"). SIPP mencetaknya hanya bila
 * putusan BELUM ada (sudah_putusan == 0), hasil sidang sudah dicatat, dan akun
 * yang masuk berwenang sebagai hakim/panitera perkara itu. Tingkapnya sama
 * dengan "Edit Putusan Akhir" - managePutusanAkhir::edit_data, borang
 * #frm_putusan yang sama - hanya act-nya "tambah".
 *
 * Yang dicocokkan: alamat berakhir tepat "/tambah" (bukan tambah_sppa, bukan
 * /tambah/tidakberwenang|dikembalikan|meninggal) DAN tulisannya "Tambah …
 * Putusan …". "Terdakwa Meninggal", "Tidak Berwenang", dan "Gugatan Tidak
 * Diperbaiki" memakai alamat yang sama tetapi bukan blangko putusan biasa.
 */
function s1CariTambahPutusan() {
  return (
    Array.from(document.querySelectorAll('a[onclick*="add_putusan_akhir/"]')).find((a) => {
      const klik = String(a.getAttribute("onclick") || "");
      if (!/add_putusan_akhir\/[^'"\s]+\/tambah['"]/.test(klik)) return false;
      const tulisan = String(a.textContent || "").replace(/\s+/g, " ").trim();
      return /^Tambah\b/i.test(tulisan) && /Putusan/i.test(tulisan) && s1TautanTampak(a);
    }) || null
  );
}

/** Tautan "Edit Putusan Akhir" di tab Putusan Akhir (putusan sudah ada). */
function s1CariEditPutusan() {
  return (
    Array.from(document.querySelectorAll('a[onclick*="add_putusan_akhir/"]')).find((a) =>
      /\/update['"]/.test(String(a.getAttribute("onclick") || ""))
    ) || null
  );
}

/**
 * 21 Okt 2026: ADA-TIDAKNYA draf putusan ALETA untuk satu perkara (baca saja, rute yang sama dengan
 * "Ambil usulan dari ALETA"). Dipakai tombol "Putusan Otomatis" halaman SIPP (putusan-sipp.js) SEBELUM
 * blangko dibuka: tanpa draf dan tanpa berkas putusan tidak ada yang dapat diisikan, jadi blangko tidak
 * dibuka sia-sia. Pulang { ada:true, versi } | { ada:false, sebab } | { ada:null, sebab }. Tidak pernah melempar.
 */
async function cekDrafPutusanAleta(nomorPerkara) {
  try {
    const r = await alatAmbil(
      `${ALETA_API_ISIAN_PUTUSAN}?nomorPerkara=${encodeURIComponent(nomorPerkara || "")}`,
      { credentials: "include", cache: "no-store" },
      "Memeriksa draf putusan"
    );
    if (!r.ok) return { ada: null, sebab: alatPesanGagal(null, r.status, "Memeriksa draf putusan") };
    const luar = await r.json();
    const d = luar && luar.data ? luar.data : luar;
    if (d && d.ada) return { ada: true, versi: d.versi };
    return { ada: false, sebab: String((d && d.sebab) || "Belum ada draf putusan ALETA untuk perkara ini.") };
  } catch (galat) {
    return { ada: null, sebab: String((galat && galat.message) || galat) };
  }
}

/**
 * Membuka blangko Putusan Akhir SIPP seperti petugas, lewat jalan yang
 * ditawarkan SIPP sendiri:
 *
 *   1. "Edit Putusan Akhir" yang sudah termuat (putusan sudah ada),
 *   2. "Tambah Putusan Akhir" di baris tombol atas (putusan BELUM ada) -
 *      sampai 5 Oktober 2026 jalan ini tidak dikenal, dan perkara yang
 *      belum diputus ditolak dengan "Tab Putusan Akhir belum ada" padahal
 *      tombolnya terpampang; putusan massal pun berhenti menunggu tangan,
 *   3. tab "Putusan Akhir" (#tabs10, dimuat lewat AJAX) lalu Edit.
 *
 * Menekan tautan = SIPP sendiri yang menjalankan popup_form() miliknya
 * (handler onclick halaman); tidak ada alamat yang dirakit di sini. Membuka
 * tingkap, tidak menulis apa pun. Menunggu menurut keadaan (borang lahir),
 * bukan waktu tetap. Tidak pernah melempar.
 */
async function s1BukaBlangkoPutusan(opsi) {
  const o = opsi || {};
  const batas = o.batasMs || 15000;
  const jeda = o.jedaMs || 50;
  if (document.querySelector("#frm_putusan")) return { ok: true, sudah: true };
  let tautan = s1CariEditPutusan() || s1CariTambahPutusan();
  let lewat = tautan && /\/tambah['"]/.test(String(tautan.getAttribute("onclick") || "")) ? "tambah" : "edit";
  if (!tautan) {
    const tab = document.querySelector('a[href="#tabs10"]');
    if (!tab) {
      return {
        ok: false,
        pesan:
          'Tombol "Tambah Putusan Akhir" maupun tab Putusan Akhir tidak ada di halaman SIPP perkara ini. SIPP baru memunculkan ' +
          "tombol itu bila putusan belum diinput, hasil sidang sudah dicatat, dan akun SIPP yang masuk berwenang sebagai " +
          "hakim/panitera perkara ini. Catat hasil sidang lebih dulu (atau masuk dengan akun majelisnya), muat ulang halaman, lalu jalankan lagi.",
      };
    }
    tab.click();
    tautan = await s1Tunggu(() => s1CariEditPutusan() || s1CariTambahPutusan(), batas, jeda);
    lewat = tautan && /\/tambah['"]/.test(String(tautan.getAttribute("onclick") || "")) ? "tambah" : "edit";
    if (!tautan) {
      return {
        ok: false,
        pesan:
          "Tab Putusan Akhir terbuka, tetapi tombol Edit Putusan Akhir tidak muncul - akun SIPP ini mungkin tidak berwenang mengubah putusan. " +
          "Buka blangkonya sendiri bila memang berwenang.",
      };
    }
  }
  tautan.click();
  const borang = await s1Tunggu(() => document.querySelector("#frm_putusan"), batas, jeda);
  if (!borang) {
    const pop = document.querySelector("#form_pop");
    const kata = pop ? String(pop.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160) : "";
    return {
      ok: false,
      pesan:
        `Blangko Putusan Akhir tidak terbuka dalam ${Math.round(batas / 1000)} detik sesudah ` +
        `"${lewat === "tambah" ? "Tambah Putusan Akhir" : "Edit Putusan Akhir"}" ditekan` +
        (kata ? ` - SIPP menampilkan: "${kata}"` : " - SIPP tidak menjawab") +
        ". Periksa sambungan ke SIPP, lalu jalankan lagi.",
    };
  }
  return { ok: true, lewat };
}

/**
 * Panel digambar ulang SEKARANG untuk blangko yang baru dibuka - tidak
 * menunggu pengamat DOM (jeda 400 ms + waktu senggang sampai 1,2 detik), dan
 * tidak bergantung pada pembacaan nomor dari halaman. Konteks perkara yang
 * sudah terbaca dipakai; portal tidak ditanya lagi.
 *
 * Pulang true bila panel kini menggambarkan blangko itu (digambar di sini,
 * atau segarkan() sudah mendahuluinya), false bila tidak dapat - blangkonya
 * belum ada, atau konteks yang terbaca milik perkara lain.
 */
async function gambarUlangSesudahBlangko(nomor) {
  if (!document.querySelector("#frm_putusan")) return false;
  if (typeof konteksTerakhir === "undefined" || !konteksTerakhir) return false;
  const kunci = (x) => String(x || "").replace(/\s+/g, "").toUpperCase();
  if (nomor && kunci(konteksTerakhir.nomorPerkara) !== kunci(nomor)) return false;
  const tanda = tandaBorang();
  // segarkan() sudah menggambar ulang untuk borang ini - jangan dua kali.
  if (tanda === borangTerakhir && document.querySelector(`#${PENANDA} .aleta-bagian[data-kunci="isiPutusan"]:not([data-s1-fitur])`)) {
    return true;
  }
  borangTerakhir = tanda;
  await gambarUlangKonteks();
  return true;
}
/** Butir 7: tag peran per bagian panel perkara (data-kunci). */
const S2_PERAN_BAGIAN = {
  penunjukan: "Ketua",
  s2EdocPenetapan: "Ketua",
  s2EdocPenetapanManual: "Ketua",
  penetapanMassal: "Ketua",
  dataUmum: "PTSP",
  isiAlasanPerkara: "PTSP",
  saksiKtp: "PTSP",
  rapikanPihak: "PTSP",
  e6EdocPenetapan: "PTSP",
  bacaBorang: "Admin",
  isiPutusan: "Hakim",
  unggahPutusanSipp: "Hakim",
  s1UnggahEcourt: "Hakim",
  putusanMassalSipp: "Hakim",
  antreanSipp: "Hakim",
  juruSita: "Jurusita",
  courtCalendarOtomatis: "Panitera",
  // R 13 Okt (butir 3): Kasir per perkara (halaman detil_biaya) seperti hakim/panitera.
  kasirPerkara: "Kasir",
};
/** Butir 7: tag peran per menu massal halaman daftar (data-mps-massal). */
const S2_PERAN_MASSAL = {
  "penetapan-massal": "Ketua",
  "putusan-massal": "Hakim",
  "bas-massal": "Panitera",
  "relaas-pbt-massal": "Jurusita",
  // R 13 Okt (butir 3): Kasir otomatis, pengingat, massal, rekap di daftar Jurnal Keuangan Perkara.
  "kasir-harian": "Kasir",
};

function s2Aktif() {
  return typeof s1Aktif === "function" && s1Aktif();
}

// ─── Butir 7: tag peran di kepala lipatan ────────────────────────────────────

function s2TeksTag(kepala) {
  const tag = kepala && typeof kepala.querySelector === "function" ? kepala.querySelector(":scope > .aleta-lipat-peran") : null;
  return tag && !tag.hidden ? String(tag.textContent || "").trim() : "";
}

/**
 * Memasang tag `peran` di kepala lipatan `el` (alatJadikanLipat milik W).
 * Kepala yang SUDAH bertag dibiarkan - pemilik bagiannya yang menentukan.
 * Cadangan untuk panel-alat.js tanpa opsi peran: span yang sama dipasang sendiri.
 */
function s2TandaiPeran(el, peran) {
  if (!el || el.nodeType !== 1 || !peran) return false;
  const sudah = el.__aletaLipat && el.__aletaLipat.kepala;
  if (sudah && s2TeksTag(sudah)) return false;
  let pegangan = null;
  if (typeof alatJadikanLipat === "function") {
    try {
      pegangan = alatJadikanLipat(el, { peran });
    } catch {
      pegangan = null;
    }
  }
  const kepala = (pegangan && pegangan.kepala) || (el.__aletaLipat && el.__aletaLipat.kepala) || null;
  if (!kepala) return false;
  if (s2TeksTag(kepala)) return true;
  let tag = kepala.querySelector(":scope > .aleta-lipat-peran");
  if (!tag) {
    tag = buatElemen("span", "aleta-lipat-peran");
    const panah = kepala.querySelector(":scope > .aleta-lipat-panah, :scope > .aleta-bagian-panah");
    kepala.insertBefore(tag, panah ? panah.nextSibling : kepala.firstChild);
  }
  tag.hidden = false;
  tag.textContent = peran;
  tag.title = `Bagian ini untuk: ${peran}`;
  return true;
}

/** Lipatan teratas di dalam `wadah` (yang tidak berada di dalam lipatan lain di wadah itu). */
function s2LipatPuncak(wadah) {
  if (!wadah || typeof wadah.querySelectorAll !== "function") return [];
  const pola = ".aleta-bagian, .aleta-lipatan, details";
  if (typeof wadah.matches === "function" && wadah.matches(pola)) return [wadah];
  return Array.from(wadah.querySelectorAll(pola)).filter((el) => {
    for (let x = el.parentElement; x && x !== wadah; x = x.parentElement) if (x.matches(pola)) return false;
    return true;
  });
}

function s2TandaiPeranSemua(akar) {
  if (!akar || typeof akar.querySelectorAll !== "function") return;
  for (const [kunci, peran] of Object.entries(S2_PERAN_BAGIAN)) {
    for (const el of Array.from(akar.querySelectorAll(`.aleta-bagian[data-kunci="${kunci}"]`))) s2TandaiPeran(el, peran);
  }
  for (const [kunci, peran] of Object.entries(S2_PERAN_MASSAL)) {
    for (const wadah of Array.from(akar.querySelectorAll(`[data-mps-massal="${kunci}"]`))) {
      for (const el of s2LipatPuncak(wadah)) s2TandaiPeran(el, peran);
    }
  }
}

/** Menandai sekarang dan tiap kali isi lahir belakangan (menu massal milik R/M dimuat asinkron). */
function s2PasangPeran(akar) {
  if (!akar || akar.__s2Peran) return;
  akar.__s2Peran = true;
  s2TandaiPeranSemua(akar);
  let jadwal = 0;
  try {
    new MutationObserver(() => {
      if (jadwal) return;
      jadwal = setTimeout(() => {
        jadwal = 0;
        if (akar.isConnected && s2Aktif()) s2TandaiPeranSemua(akar);
      }, 0);
    }).observe(akar, { childList: true, subtree: true });
  } catch {
    /* tanpa pengamat: yang lahir belakangan tanpa tag */
  }
}

// ─── Butir 19: bawaan buka/tutup ─────────────────────────────────────────────

/** Kartu tambahan di DALAM tab (bukan kartu atas Langkah/Perkara berikutnya) tertutup sebagai bawaan. */
function s2KartuTertutup(el) {
  if (!s2Aktif() || !el || !el.classList || !el.classList.contains("aleta-t7-kartu")) return false;
  // Kartu Penetapan satu klik adalah tindakan utama tab ini - terbuka (18 Okt 2026).
  if (el.classList.contains("aleta-t7-penetapan")) return false;
  return Boolean(el.closest(".aleta-kelompok"));
}

// ─── Butir 11 (W): klik 2x sudut juga untuk panel SIPP yang berlabuh ─────────

/**
 * opsi.pindahKeSudut alatPasangJalanKeluar (W memanggilnya hanya di UI Baru).
 * Panel berlabuh kanan (html[data-aleta-sipp-labuh]) DILEPAS dulu - dicatat
 * sebagai keadaanPanel.lepasLabuh, sehingga t7TerapkanLabuh tidak memasangnya
 * lagi sampai "↺ kembali ke bawaan" - lalu dipindah ke sudut. Letak disimpan
 * lewat simpanKeadaanPanel (satu penyimpan untuk KUNCI_POSISI, bukan dua).
 */
function s2PindahKeSudut(panel, sudut) {
  if (!panel || !sudut) return null;
  let berlabuh = false;
  try {
    berlabuh = document.documentElement.hasAttribute(T7_ATRIBUT_LABUH);
  } catch {
    berlabuh = false;
  }
  if (berlabuh) {
    simpanKeadaanPanel({ lepasLabuh: true });
    if (typeof t7TerapkanLabuh === "function") t7TerapkanLabuh();
  }
  const hasil = typeof alatSudutPindahkan === "function" ? alatSudutPindahkan(panel, "", sudut) : null;
  if (hasil && Number.isFinite(hasil.kiri) && Number.isFinite(hasil.atas)) simpanKeadaanPanel({ kiri: hasil.kiri, atas: hasil.atas });
  return hasil;
}

(globalThis.__aletaModulSelesai || (globalThis.__aletaModulSelesai = new Set())).add("konten-panel-bersama.js"); // K11-SELESAI
