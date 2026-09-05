"use strict";

/**
 * ALETA untuk SIPP — skrip konten.
 *
 * ============================================================================
 * TIDAK MENGUBAH SIPP SAMA SEKALI
 * ============================================================================
 *
 * Skrip ini hanya MENAMBAH elemen ke halaman. Ia tidak pernah:
 *   - mengubah atau menghapus elemen milik SIPP
 *   - mengisi formulir SIPP
 *   - mengirim apa pun ke SIPP
 *
 * Begitu ekstensi mulai menulis ke SIPP lewat formulirnya, seluruh keunggulan
 * "tidak menyentuh SIPP" hilang - dan kesalahannya akan tampak seperti
 * kesalahan petugas, bukan kesalahan ekstensi.
 *
 * ============================================================================
 * MENYERAH DIAM-DIAM
 * ============================================================================
 *
 * Bila nomor perkara tidak ditemukan, ALETA tidak terjangkau, atau tampilan
 * SIPP berubah sehingga tidak dikenali - skrip ini TIDAK menampilkan apa pun.
 * Tidak ada kotak galat, tidak ada tata letak yang bergeser.
 *
 * SIPP adalah aplikasi yang dipakai bekerja sehari-hari. Lapisan bantu yang
 * merusak tampilannya lebih merugikan daripada lapisan bantu yang absen.
 */

const ALETA_API = "/aleta/api/aleta-bot/sipp-konteks";
const ALETA_API_MASSAL = "/aleta/api/aleta-bot/sipp-konteks/massal";
const ALETA_API_PERMINTAAN = "/aleta/api/aleta-bot/ecourt/permintaan";
const ALETA_BERKAS = "/aleta/api/aleta-ecourt/berkas";
// Keadaan perkara selengkapnya - tahapan, berkas, putusan, upaya hukum, dan
// penilaian SK. Kapabilitasnya SAMA dengan sipp-konteks ("panel"), jadi menu
// tambahan ini tidak membuka satu pun pintu baru bagi peran mana pun.
const ALETA_API_STATUS = "/aleta/api/aleta-ecourt/status-perkara";
const ALETA_API_PENUNJUKAN = "/aleta/api/aleta-bot/penunjukan";
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
const ALETA_API_MASUK_PEJABAT = "/aleta/api/aleta-ecourt/masuk-pejabat";
const ALETA_API_EKSTENSI = "/aleta/api/aleta-ecourt/ekstensi";
const PENANDA = "aleta-panel-sipp";

/**
 * Mencari nomor perkara yang sedang DIBUKA, bukan sekadar yang pertama terlihat.
 *
 * ============================================================================
 * HALAMAN DAFTAR BUKAN HALAMAN PERKARA
 * ============================================================================
 *
 * Fungsi ini semula mengambil nomor perkara pertama yang ditemukan di halaman.
 * Di halaman Daftar Perkara, nomor pertama adalah baris teratas tabel - dan
 * panel pun memuat perkara itu, seolah petugas sedang membukanya. Padahal
 * petugas belum memilih apa pun.
 *
 * Akibatnya bukan sekadar salah tampil: panel menampilkan keadaan verifikasi
 * dan nomor pihak milik perkara yang tidak sedang diperiksa siapa pun, dan
 * tombol verifikasi hakim ikut muncul untuk perkara yang keliru.
 *
 * PENENTUNYA JUMLAH, BUKAN ALAMAT
 *
 * Halaman daftar selalu memuat LEBIH DARI SATU nomor perkara; halaman perkara
 * hanya satu. Aturan itu berlaku di semua jenis perkara dan semua versi SIPP.
 * Alamat halaman dipakai sebagai penguat saja - namanya berbeda-beda
 * (detil_perkara_agama, detil_perkara, dan seterusnya), jadi menggantungkan
 * keputusan padanya membuat ekstensi diam di halaman yang seharusnya aktif.
 */

/**
 * Halaman yang TIDAK BOLEH disentuh ekstensi sama sekali.
 *
 * ============================================================================
 * DOKUMEN RESMI TIDAK BOLEH MEMUAT KETERANGAN ALETA
 * ============================================================================
 *
 * "Cetak Relas" pada halaman Jadwal Sidang membuka halaman tersendiri, dan
 * alamatnya tetap di bawah /SIPP/ - misalnya
 *
 *     /SIPP/c_template_relaas_agama/popup_relaas/<blob>
 *
 * sehingga ekstensi ikut berjalan di sana. Halaman itu memuat tepat satu nomor
 * perkara, jadi pemeriksaan "lebih dari satu nomor berarti daftar" pun
 * meloloskannya - panel akan muncul, lalu ikut tercetak.
 *
 * Yang beredar kemudian adalah relas panggilan - dokumen resmi pengadilan yang
 * disampaikan jurusita kepada pihak berperkara - dengan keterangan dari sistem
 * yang bukan SIPP tercetak di dalamnya. Itu tidak boleh terjadi sekali pun.
 *
 * Daftar ini sengaja LEBIH LUAS daripada yang diketahui: nama templat cetak di
 * SIPP bermacam-macam dan bertambah antar versi. Salah menahan diri di halaman
 * yang sebenarnya aman hanya membuat panel tidak muncul di satu tempat; salah
 * menampilkan di halaman cetak merusak dokumen resmi.
 */
const POLA_HALAMAN_CETAK = [
  "/c_template",
  "/popup_",
  "/cetak",
  "/print",
  "/template_",
  "/laporan_cetak",
  "/amplop",
  "/instrumen",
];

function halamanCetakAtauTemplat() {
  const jalur = String(location.pathname || "").toLowerCase();
  return POLA_HALAMAN_CETAK.some((pola) => jalur.includes(pola));
}

const POLA_PERKARA = /\b(\d{1,5}\/[A-Za-z]{1,10}(?:\.[A-Za-z]{1,4})?\/\d{4}\/[A-Za-z]{2,4}\.[A-Za-z]{2,6})\b/g;

/** Apakah alamat halaman ini menyerupai halaman detail perkara? */
function alamatHalamanPerkara() {
  return /detil[_-]?perkara|detail[_-]?perkara/i.test(String(location.pathname || ""));
}

function cariNomorPerkara() {
  const teks = document.body ? String(document.body.innerText || "") : "";

  // Seluruh nomor perkara yang berbeda di halaman ini.
  const semua = new Set();
  POLA_PERKARA.lastIndex = 0;
  let cocok;
  while ((cocok = POLA_PERKARA.exec(teks)) !== null) {
    semua.add(cocok[1]);
    if (semua.size > 1) break; // sudah cukup untuk tahu ini daftar
  }

  // Lebih dari satu berarti halaman daftar. Diam.
  if (semua.size > 1) return "";

  if (semua.size === 1) return [...semua][0];

  // Tidak ada di badan halaman, tetapi mungkin ada di judul - sebagian halaman
  // SIPP memuat nomor perkara hanya di judul jendela.
  if (alamatHalamanPerkara()) {
    const dariJudul = String(document.title || "").match(
      /\b(\d{1,5}\/[A-Za-z]{1,10}(?:\.[A-Za-z]{1,4})?\/\d{4}\/[A-Za-z]{2,4}\.[A-Za-z]{2,6})\b/
    );
    if (dariJudul) return dariJudul[1];
  }

  return "";
}

/**
 * ============================================================================
 * SAKLAR DIBACA SEKALI, BUKAN SETIAP HALAMAN BERUBAH
 * ============================================================================
 *
 * Ketiga saklar dulu dibaca dari chrome.storage pada SETIAP penyegaran, dan
 * penyegaran dipicu tiap kali DOM SIPP berubah. Pada halaman bertabel besar
 * itu berarti ratusan pembacaan penyimpanan sepanjang satu halaman - masing-
 * masing melompat ke proses ekstensi dan kembali, dan seluruhnya menahan
 * penyegaran yang seharusnya seketika.
 *
 * Sekarang nilainya dibaca sekali lalu disimpan di memori. Perubahan tetap
 * sampai: chrome.storage.onChanged di kaki berkas ini memperbaruinya, dan
 * saklar dari popup tetap berlaku tanpa memuat ulang halaman.
 */
const saklar = { aktif: true, tandaiHalaman: false, sisipJadwal: false, siap: false };

async function muatSaklar() {
  if (saklar.siap) return saklar;
  try {
    const simpan = await chrome.storage.local.get(["aktif", "tandaiHalaman", "sisipJadwal"]);
    saklar.aktif = simpan.aktif !== false;
    saklar.tandaiHalaman = simpan.tandaiHalaman === true;
    saklar.sisipJadwal = simpan.sisipJadwal === true;
  } catch {
    // Penyimpanan tidak terjangkau: panel tetap menyala, penandaan tetap mati.
    saklar.aktif = true;
    saklar.tandaiHalaman = false;
    saklar.sisipJadwal = false;
  }
  saklar.siap = true;
  return saklar;
}

/** Apakah ekstensi dinyalakan? Bawaannya menyala. */
async function sedangAktif() {
  return (await muatSaklar()).aktif;
}

/**
 * Apakah petugas mengizinkan tampilan SIPP ditandai?
 *
 * Bawaannya MATI. Panel di sisi kanan hanya menambah lapisan di atas halaman
 * dan mudah diabaikan; menandai isi halaman SIPP sendiri lebih jauh dari itu -
 * dan halaman SIPP adalah tempat kerja orang, bukan tempat kita berkreasi.
 * Karena itu harus dinyalakan sendiri, bukan menyala diam-diam setelah
 * pembaruan.
 */
async function sedangMenandai() {
  return (await muatSaklar()).tandaiHalaman;
}

/**
 * Apakah petugas mengizinkan berkas disisipkan ke dalam tabel SIPP?
 *
 * Saklar TERSENDIRI, bukan ikut "Tandai halaman SIPP". Menandai hanya
 * menempelkan label kecil yang jelas bukan milik SIPP; menyisipkan berkas ke
 * dalam sel tabel membuat ALETA dan SIPP tampak menyatu - dan itu memang
 * tujuannya, tetapi juga yang membuatnya lebih berisiko disalahpahami
 * sebagai berkas resmi SIPP.
 *
 * Bawaannya MATI.
 */
async function sedangMenyisipkan() {
  return (await muatSaklar()).sisipJadwal;
}

function buatElemen(tag, kelas, teks) {
  const el = document.createElement(tag);
  if (kelas) el.className = kelas;
  if (teks !== undefined) el.textContent = teks;
  return el;
}

/** Keterangan sisa hari, dengan tenggat lewat dinyatakan tegas. */
function keteranganSisa(sisaHari, ambang) {
  if (sisaHari === null || sisaHari === undefined) return null;
  if (sisaHari < 0) return { teks: `lewat ${Math.abs(sisaHari)} hari`, nada: "lewat" };
  if (sisaHari === 0) return { teks: "hari ini", nada: "mendesak" };
  if (sisaHari <= ambang) return { teks: `${sisaHari} hari lagi`, nada: "mendesak" };
  return { teks: `${sisaHari} hari lagi`, nada: "aman" };
}

const STATUS_NOMOR = {
  terverifikasi: { teks: "nomor terkonfirmasi", nada: "aman" },
  menunggu: { teks: "menunggu jawaban konfirmasi", nada: "mendesak" },
  ditolak: { teks: "salah alamat — perbaiki di SIPP", nada: "lewat" },
  belum_pernah_ditanya: { teks: "belum dikonfirmasi", nada: "netral" },
};

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
async function pesanGalat(respons) {
  try {
    const isi = await respons.json();
    const galat = isi && isi.error;
    if (galat && typeof galat === "object") return String(galat.message || "");
    return String(galat || (isi && isi.message) || (isi && isi.alasan) || "");
  } catch {
    return "";
  }
}

function tombolUnduh(dokumen, format, label) {
  const tombol = buatElemen("button", "aleta-unduh", label);
  tombol.title = `Unduh ${label} — ${dokumen.judulDokumen || "dokumen"}`;

  /** Menampilkan kegagalan pada tombolnya sendiri, lengkap dengan sebabnya. */
  function tandaiGagal(pesan, singkat) {
    const semula = tombol.dataset.labelAsli || label;
    tombol.textContent = singkat || "gagal";
    // Sebab lengkapnya masuk ke title: teksnya kerap sepanjang satu kalimat,
    // dan tombol di dalam baris dokumen tidak punya ruang untuk itu.
    tombol.title = pesan || `Unduh ${label}`;
    tombol.classList.add("aleta-unduh-gagal");
    setTimeout(() => {
      tombol.textContent = semula;
      tombol.title = `Unduh ${label} — ${dokumen.judulDokumen || "dokumen"}`;
      tombol.classList.remove("aleta-unduh-gagal");
      tombol.disabled = false;
    }, 6000);
  }

  tombol.dataset.labelAsli = label;

  tombol.addEventListener("click", async () => {
    const semula = tombol.textContent;
    tombol.disabled = true;
    tombol.textContent = "…";

    try {
      const alamat = `${ALETA_BERKAS}?documentKey=${encodeURIComponent(dokumen.documentKey)}&format=${format}`;
      const respons = await fetch(alamat, { credentials: "include", cache: "no-store" });

      if (!respons.ok) {
        const pesan = await pesanGalat(respons);
        if (respons.status === 401) {
          tandaiGagal("Sesi ALETA habis. Masuk lagi lalu ulangi.", "masuk dulu");
        } else if (respons.status === 403) {
          tandaiGagal(pesan || "Peran Anda tidak diberi akses mengunduh berkas.", "ditolak");
        } else {
          tandaiGagal(pesan || `Server menjawab ${respons.status}.`);
        }
        return;
      }

      // ======================================================================
      // JAWABAN GALAT TIDAK BOLEH TERSIMPAN SEBAGAI BERKAS
      // ======================================================================
      //
      // Server dapat menjawab 200 dengan tubuh JSON berisi sebab kegagalan.
      // Menyimpannya apa adanya menghasilkan berkas bernama berkas.json yang
      // tampak seperti unduhan berhasil - inilah sebab laporan "berkasnya
      // hilang": berkasnya tidak hilang, yang terunduh memang bukan berkasnya.
      const tipe = String(respons.headers.get("content-type") || "").toLowerCase();
      if (tipe.includes("application/json")) {
        const pesan = await pesanGalat(respons);
        tandaiGagal(pesan || "Server menjawab keterangan, bukan berkas.");
        return;
      }

      const blob = await respons.blob();

      // Berkas kosong berarti gagal, sekalipun statusnya 200.
      if (blob.size === 0) {
        tandaiGagal("Berkasnya kosong di server. Tarik ulang perkara ini.");
        return;
      }

      const url = URL.createObjectURL(blob);
      const tautan = document.createElement("a");
      tautan.href = url;
      tautan.download = namaBerkasDari(respons, dokumen, format);
      document.body.appendChild(tautan);
      tautan.click();
      tautan.remove();

      // Alamat obyek TIDAK dilepas seketika. Peramban membaca blobnya setelah
      // klik selesai diproses, dan melepasnya di baris yang sama membatalkan
      // sebagian unduhan tanpa pesan apa pun - berkas yang seolah hilang.
      setTimeout(() => URL.revokeObjectURL(url), 60000);

      tombol.textContent = semula;
      tombol.disabled = false;
    } catch (kesalahan) {
      tandaiGagal(`Gagal menghubungi ALETA: ${String((kesalahan && kesalahan.message) || kesalahan)}`);
    }
  });

  return tombol;
}

/** Nama berkas dari jawaban server, dengan cadangan bila tidak disebutkan. */
function namaBerkasDari(respons, dokumen, format) {
  const kepala = respons.headers.get("content-disposition") || "";
  const cocok = kepala.match(/filename="?([^";]+)"?/i);
  if (cocok) {
    try {
      return decodeURIComponent(cocok[1]);
    } catch {
      return cocok[1];
    }
  }
  const judul = (dokumen.judulDokumen || "dokumen").replace(/[\/:*?"<>|]/g, "");
  return `${judul}.${format === "word" ? "docx" : "pdf"}`;
}

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
    const respons = await fetch(ALETA_API, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentKey: dokumen.documentKey, keputusan, konfirmasi: true }),
    });

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
  } catch {
    return { ok: false, pesan: "Gagal menghubungi ALETA." };
  }
}

// ─── Bagian yang dapat dilipat sendiri-sendiri ───────────────────────────────
//
// Panel memuat empat jenis keterangan, dan petugas yang berbeda memerlukan yang
// berbeda: panitera melihat berkas, hakim melihat verifikasi, jurusita melihat
// nomor pihak. Memaksa semuanya tampil sekaligus membuat panel panjang dan
// menutupi halaman SIPP yang justru sedang dikerjakan.
//
// Keadaan lipatan disimpan PER BAGIAN, bukan per perkara: petugas yang tidak
// pernah memakai satu bagian melipatnya sekali, dan tetap terlipat di perkara
// berikutnya.

const KUNCI_LIPATAN = "lipatanBagian";

/** Keadaan lipatan, dibaca sekali lalu disimpan di memori. */
let lipatanTersimpan = null;

async function muatLipatan() {
  if (lipatanTersimpan) return lipatanTersimpan;
  try {
    const simpan = await chrome.storage.local.get([KUNCI_LIPATAN]);
    lipatanTersimpan = simpan[KUNCI_LIPATAN] || {};
  } catch {
    lipatanTersimpan = {};
  }
  return lipatanTersimpan;
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

// ─── Keadaan perkara selengkapnya, diambil hanya bila diminta ────────────────
//
// ============================================================================
// DIMUAT SAAT DIBUKA, BUKAN SAAT PANEL DIGAMBAR
// ============================================================================
//
// Menu-menu di bawah ini membaca seluruh keadaan perkara: tahapan beserta
// ketepatan penginputannya, kelengkapan berkas, putusan, upaya hukum, dan
// penilaian SK. Itu bacaan yang jauh lebih berat daripada konteks e-Court -
// puluhan kueri ke SIPP untuk satu perkara.
//
// Menariknya setiap panel digambar berarti setiap perkara yang DILIHAT sekilas
// membayar ongkos penuh, padahal menu-menu ini jarang dibuka. Karena itu
// permintaannya baru berangkat saat menunya dibuka pertama kali, lalu hasilnya
// dipakai bersama seluruh menu - satu permintaan untuk semuanya.

let simpananStatus = { nomor: "", data: null, sedang: null };

async function ambilStatusPerkara(nomor) {
  if (simpananStatus.nomor === nomor) {
    if (simpananStatus.data) return simpananStatus.data;
    if (simpananStatus.sedang) return simpananStatus.sedang;
  }

  const janji = (async () => {
    const respons = await fetch(`${ALETA_API_STATUS}?nomor=${encodeURIComponent(nomor)}`, {
      credentials: "include",
      cache: "no-store",
    });
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

  // Menu ini sekarang tidak lagi menunggu ditekan untuk menyebutkan isinya:
  // lencananya diisi panggilan latar, dan itu yang membuat panel dapat dibaca
  // tanpa membuka satu pun menu.
  kotak.kunciLencana = kunci;

  const kepala = kotak.querySelector(".aleta-bagian-judul");
  kepala.addEventListener("click", () => {
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
  });

  return kotak;
}

/**
 * ============================================================================
 * PAPAN PENUNJUKAN
 * ============================================================================
 *
 * Menampilkan usulan PMH, PPP, PJS, dan PHS untuk perkara yang sedang dibuka.
 *
 * TAHAP INI BELUM MENULIS APA PUN. Tombol Kerjakan sengaja dibiarkan mati,
 * dan itu bukan pekerjaan yang tertinggal - selama beberapa hari pertama,
 * usulannya memang perlu diadu dengan penunjukan sungguhan sebelum ia diberi
 * izin menyentuh formulir. Kalau usulannya sering meleset, ketahuannya di sini,
 * bukan sesudah tercatat di SIPP.
 *
 * Dimuat malas seperti menu lain: hitungan gilirannya menyapu seluruh
 * penunjukan juru sita tahun berjalan, dan itu tidak pantas dijalankan pada
 * tiap perkara yang kebetulan dibuka.
 */
async function ambilUsulanPenunjukan(nomor) {
  const respons = await fetch(
    `${ALETA_API_PENUNJUKAN}?nomor=${encodeURIComponent(nomor)}`,
    { credentials: "include", cache: "no-store" }
  );

  if (respons.status === 401) throw new Error("Belum masuk ALETA.");
  if (respons.status === 403) {
    throw new Error("Peran Anda tidak diberi akses papan penunjukan.");
  }
  if (!respons.ok) throw new Error(`ALETA menjawab ${respons.status}.`);

  const isi = await respons.json();
  const data = isi && isi.data ? isi.data : isi;
  if (!data || data.available === false) {
    throw new Error((data && data.message) || "ALETA Bot belum dapat dihubungi.");
  }
  return data;
}

/**
 * ============================================================================
 * NAMA KOLOM YANG DIKENAL ALETA
 * ============================================================================
 *
 * Kunci di sini BUKAN nama kolom di SIPP - ia nama perannya menurut ALETA.
 * Peta kolom di pengaturanlah yang menghubungkan keduanya, dan itu sebabnya
 * daftar ini tetap sama walau formulir SIPP berganti bentuk.
 *
 * "simpan" berbeda dari yang lain: ia tombol, bukan isian. Ia hanya dipakai
 * bila penyimpanan otomatis dinyalakan di pengaturan - dan bawaannya mati.
 */
const MEDAN_DIKENAL = {
  pmh: ["tanggal_penetapan", "nomor_sk", "hakim_ketua", "hakim_anggota_1", "hakim_anggota_2"],
  ppp: ["tanggal_penetapan", "nomor_sk", "panitera"],
  pjs: ["tanggal_penetapan", "nomor_sk", "jurusita"],
  phs: ["tanggal_penetapan", "tanggal_sidang"],
};

/**
 * Nilai yang hendak diisikan untuk satu formulir, disusun dari usulannya.
 *
 * Yang tidak ada nilainya TIDAK dimasukkan sebagai teks kosong. Kolom yang
 * diisi kosong menimpa isian yang mungkin sudah benar di sana; kolom yang
 * dilewati membiarkannya apa adanya.
 */
function nilaiUntukBorang(formulir, usulan) {
  const nilai = {};
  const tanggal = usulan.tanggalPenetapan || "";
  if (tanggal) nilai.tanggal_penetapan = tanggal;

  if (formulir === "pmh") {
    const anggota = (usulan.pmh && usulan.pmh.anggota) || [];
    if (anggota[0]) nilai.hakim_ketua = anggota[0].nama;
    if (anggota[1]) nilai.hakim_anggota_1 = anggota[1].nama;
    if (anggota[2]) nilai.hakim_anggota_2 = anggota[2].nama;
  } else if (formulir === "ppp") {
    const pp = usulan.ppp && usulan.ppp.usulan;
    if (pp) nilai.panitera = pp.nama;
  } else if (formulir === "pjs") {
    const js = usulan.pjs && usulan.pjs.usulan;
    if (js) nilai.jurusita = js.nama;
  } else if (formulir === "phs") {
    const tanggalSidang = (usulan.phs && usulan.phs.usulan) || "";
    if (tanggalSidang) nilai.tanggal_sidang = tanggalSidang;
  }

  return nilai;
}

/** Baris catatan untuk satu formulir - apa yang diisikan, dan dari mana asalnya. */
function barisCatatan(formulir, nilai, usulan) {
  const sebab =
    formulir === "pmh"
      ? (usulan.pmh && usulan.pmh.sebab) || ""
      : formulir === "ppp"
        ? (usulan.ppp && usulan.ppp.sebab) || ""
        : formulir === "pjs"
          ? (usulan.pjs && usulan.pjs.sebab) || ""
          : (usulan.phs && usulan.phs.sebab) || "";

  return Object.entries(nilai).map(([medan, isi]) => ({
    jenis: formulir,
    medan,
    nilai: String(isi),
    // Tahap ini belum punya pilihan manual, jadi seluruhnya usulan otomatis.
    // Begitu pilihan manual ada, inilah yang membedakan keduanya.
    asal: "otomatis",
    alasan: sebab,
  }));
}

/** Sederet pil pilihan; yang aktif ditandai. Belum dapat ditekan. */
function saklarPapan(nama, pilihan, aktif) {
  const baris = buatElemen("div", "aleta-saklar");
  baris.appendChild(buatElemen("span", "aleta-saklar-nama", nama));
  for (const pil of pilihan) {
    const kelas = pil.nilai === aktif ? "aleta-saklar-pil aleta-saklar-aktif" : "aleta-saklar-pil";
    baris.appendChild(buatElemen("span", kelas, pil.label));
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

/**
 * Siapa yang menetapkan satu penetapan, beserta akun SIPP-nya.
 *
 * Dibaca dari rencana kerja - di situlah pelaksana tiap langkah sudah
 * ditentukan dari penautan akun-jabatan, bukan ditebak dari nama. Bila
 * rencananya belum ada, jabatannya saja yang disebut; itu tetap lebih berguna
 * daripada diam.
 */
function penetapUntuk(data, jenis) {
  const jabatan = SEBUTAN_PENETAP[jenis] || "";
  const rencana = data && data.rencana;
  const langkah =
    rencana && Array.isArray(rencana.langkah)
      ? rencana.langkah.find((x) => x.jenis === jenis)
      : null;
  const akun = langkah ? langkah.akun : null;

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
  if (akun.tentatif) teks += " · dipastikan ulang setelah PMH tersimpan";
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

  // --- saklar, masih penanda keadaan, belum dapat ditekan ---------------
  isi.appendChild(
    saklarPapan(
      "Cara",
      [
        { nilai: "manual", label: "Manual" },
        { nilai: "otomatis", label: "Otomatis" },
      ],
      data.bolehOtomatis ? "otomatis" : "manual"
    )
  );

  const aturan = (data.pengaturan && data.pengaturan.aturan) || {};
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

  // --- PMH ---------------------------------------------------------------
  const pmh = usulan.pmh || {};
  const namaMajelis = (pmh.anggota || []).map((x) => x.nama).join(", ");
  isi.appendChild(
    barisPenetapan(
      "PMH",
      namaMajelis,
      pmh.sebab,
      pmh.perluNilai ? "Nilai sengketa belum diisi di SIPP - isi dulu di Data Umum." : "",
      penetapUntuk(data, "pmh")
    )
  );

  // Hitungan hakim tunggal ditampilkan terbuka: angka inilah yang membuat
  // "paling sedikit" dapat diperiksa, bukan sekadar dipercaya.
  if ((pmh.hitungan || []).length > 1) {
    isi.appendChild(
      buatElemen(
        "div",
        "aleta-tetap-hitung",
        pmh.hitungan.map((x) => `${x.nama} ${x.jumlah}`).join("  ·  ")
      )
    );
  }

  // --- PPP ---------------------------------------------------------------
  const ppp = usulan.ppp || {};
  isi.appendChild(
    barisPenetapan(
      "PPP",
      ppp.usulan ? `${ppp.usulan.kode} — ${ppp.usulan.nama}` : "",
      ppp.sebab,
      "",
      penetapUntuk(data, "ppp")
    )
  );

  // --- PJS ---------------------------------------------------------------
  const pjs = usulan.pjs || {};
  isi.appendChild(
    barisPenetapan(
      "PJS",
      pjs.usulan ? pjs.usulan.nama : "",
      pjs.sebab,
      pjs.peringatan,
      penetapUntuk(data, "pjs")
    )
  );

  // --- PHS ---------------------------------------------------------------
  const phs = usulan.phs || {};
  isi.appendChild(
    barisPenetapan(
      "PHS",
      phs.sebut,
      phs.sebab + (phs.jarakHari ? ` · ${phs.jarakHari} hari sejak daftar` : ""),
      "",
      penetapUntuk(data, "phs")
    )
  );

  // --- keempatnya setanggal ----------------------------------------------
  if (usulan.tanggalPenetapan) {
    isi.appendChild(
      buatElemen(
        "div",
        "aleta-tetap-hitung",
        `Tanggal penetapan keempatnya: ${usulan.tanggalPenetapan}`
      )
    );
  }

  // --- tombol Kerjakan ----------------------------------------------------
  const kaki = buatElemen("div", "aleta-tetap-kaki");
  const tombol = buatElemen("button", "aleta-tombol aleta-tombol-mati", "Kerjakan");
  tombol.type = "button";
  tombol.disabled = true;
  const kabar = buatElemen("span", "aleta-tetap-sebab", "Memeriksa formulir di halaman ini…");
  kaki.appendChild(tombol);
  kaki.appendChild(kabar);
  isi.appendChild(kaki);

  void siapkanKerjakan(tombol, kabar, usulan, data);
}

/**
 * ============================================================================
 * MENYALAKAN TOMBOL KERJAKAN - ATAU MENJELASKAN KENAPA TIDAK
 * ============================================================================
 *
 * Empat hal harus benar sekaligus:
 *
 *   1. Perannya diberi kewenangan mengisi
 *   2. Peta kolom formulirnya sudah lengkap
 *   3. Borang itu memang sedang terbuka di halaman ini
 *   4. Ada nilai yang hendak diisikan
 *
 * Yang tidak terpenuhi DISEBUTKAN, bukan dibiarkan sebagai tombol kelabu
 * tanpa keterangan. Tombol mati tanpa alasan membuat orang menekannya
 * berulang kali lalu menyimpulkan aplikasinya rusak.
 */
/**
 * Nama pemakai SIPP yang SEDANG masuk, dibaca dari kepala halamannya.
 *
 * SIPP menulis di kepala tiap halaman:
 *
 *     Selamat Datang <font color='...'>NAMA LENGKAP</font>
 *     <br> Anda Login Sebagai <font color='...'>JABATAN</font>
 *
 * Keduanya berada dalam satu sel, jadi <font> PERTAMA-lah namanya.
 *
 * Mengembalikan "" bila tidak terbaca - dan itu ditangani sebagai "tidak tahu",
 * bukan sebagai "bukan siapa-siapa".
 */
function namaPenggunaSipp() {
  const semua = document.querySelectorAll("font");
  for (const huruf of semua) {
    const induk = huruf.parentElement;
    if (!induk) continue;
    if (!String(induk.textContent || "").includes("Selamat Datang")) continue;
    const nama = String(huruf.textContent || "").trim();
    if (nama) return nama;
  }
  return "";
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
    const respons = await fetch(alamat, { credentials: "include", cache: "no-store" });
    if (!respons.ok) throw new Error(`ALETA menjawab ${respons.status}.`);
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
    // Urutan disebutkan supaya yang membaca tahu ke halaman mana harus pergi,
    // bukan hanya bahwa halaman ini bukan tempatnya.
    kabar.textContent =
      "Borang penunjukan tidak terbuka di halaman ini. Urutannya: PMH, PPP, PJS, lalu PHS.";
    return;
  }

  const formulir = terbuka.formulir;
  const catatanBorang = (keadaan.borang || []).find((x) => x.borang === formulir);
  if (catatanBorang && catatanBorang.siap !== true) {
    kabar.textContent = `Peta kolom formulir ${formulir.toUpperCase()} belum lengkap: ${catatanBorang.alasan}`;
    return;
  }

  const nilai = nilaiUntukBorang(formulir, usulan);
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
    tombol.textContent = "Menunggu PMH";
    kabar.textContent =
      "Kerjakan PMH lebih dulu. Ketua majelis yang menetapkan hari sidang baru pasti sesudah PMH tersimpan, dan ALETA membacanya dari majelis yang tercatat - bukan dari usulan.";
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
    const respons = await fetch(ALETA_API_ANTREAN, {
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
    });
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

async function kerjakanBorang(rencana) {
  const { tombol, kabar, formulir, nilai, medanBorang, medanSimpan, simpanOtomatis, usulan } =
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
    const respons = await fetch(ALETA_API_CATAT, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        perkaraId: String((usulan.perkara && usulan.perkara.perkaraId) || ""),
        nomorPerkara: String((usulan.perkara && usulan.perkara.nomorPerkara) || ""),
        akunSipp: akunSipp(),
        baris: barisCatatan(formulir, nilai, usulan),
      }),
    });
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
    kembalikan(`Berhenti di ${hasilIsi.alasan}. Borang terisi sebagian - periksa sebelum menyimpan.`);
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
  kabar.textContent = "Menyimpan…";
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
    const respons = await fetch(ALETA_API_CATAT, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nomorPerkara: String((usulan.perkara && usulan.perkara.nomorPerkara) || ""),
        idBaris: dicatat,
        harapan: { [formulir]: usulan.tanggalPenetapan || "" },
      }),
    });
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
const NAMA_PETIKAN = {
  penggugat: "Penggugat / Pemohon",
  tergugat: "Tergugat / Termohon",
  umurPenggugat: "Umur",
  agamaPenggugat: "Agama",
  pekerjaanPenggugat: "Pekerjaan",
  pendidikanPenggugat: "Pendidikan",
  alamatPenggugat: "Alamat penggugat",
  alamatTergugat: "Alamat tergugat",
  nilaiSengketa: "Nilai sengketa",
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
    if (!petikan || !petikan.nilai) continue;
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

/** Data Umum dari berkas gugatan yang diunggah petugas. */
function bagianDataUmum() {
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
        const respons = await fetch(ALETA_API_BERKAS_GUGATAN, {
          method: "POST",
          credentials: "include",
          body: badan,
        });
        if (respons.status === 403) throw new Error("Peran Anda tidak diberi akses papan penunjukan.");
        if (!respons.ok) throw new Error(`ALETA menjawab ${respons.status}.`);

        const luar = await respons.json();
        const hasil = luar && luar.data ? luar.data : luar;

        if (!hasil || hasil.ok !== true) {
          kabar.textContent =
            (hasil && (hasil.pesan || hasil.alasan)) || "Berkas tidak dapat dibaca.";
          return;
        }

        kabar.textContent = `${hasil.nama} terbaca. Periksa tiap baris sebelum dipakai.`;
        gambarPetikan(hasilKotak, hasil);
      } catch (galat) {
        kabar.textContent = String(galat.message || galat).slice(0, 180);
      }
    })();
  });

  return kotak;
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
function bagianBacaBorang() {
  const kotak = bagian("Baca kolom formulir ini", "bacaBorang", true);
  let sudahDimuat = false;

  const kepala = kotak.querySelector(".aleta-bagian-judul");
  kepala.addEventListener("click", () => {
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

      isi.appendChild(
        buatElemen(
          "div",
          "aleta-tetap-sebab",
          `${berpenunjuk.length} kolom. Salin penunjuknya ke Pengaturan - Peta kolom formulir.`
        )
      );

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
  });

  return kotak;
}

/**
 * ============================================================================
 * PENETAPAN YANG MENUNGGU JABATAN INI
 * ============================================================================
 *
 * Inilah yang membuat penerusan berguna: pejabatnya tahu ada pekerjaan tanpa
 * ada yang perlu meneleponnya, dan tanpa harus membuka perkara satu per satu
 * untuk mencari tahu.
 *
 * Daftarnya menyebut perkaranya, dan menekan satu baris membawa ke halaman
 * perkara itu di SIPP - di sanalah formulirnya, dan di sanalah tombol Kerjakan
 * muncul dengan usulan yang sudah disiapkan.
 *
 * Kosong berarti tidak ada yang menunggu, dan itu disebut apa adanya - bukan
 * disembunyikan. Bagian yang lenyap ketika kosong tidak dapat dibedakan dari
 * fitur yang rusak.
 */
function bagianMenungguSaya() {
  const kotak = bagian("Menunggu penetapan Anda", "menungguSaya", true);
  let sudahDimuat = false;

  const kepala = kotak.querySelector(".aleta-bagian-judul");
  kepala.addEventListener("click", () => {
    const isi = kotak.isi;
    if (sudahDimuat || isi.style.display === "none") return;
    sudahDimuat = true;

    isi.appendChild(buatElemen("div", "aleta-memuat", "Memeriksa antrean…"));
    void (async () => {
      try {
        const respons = await fetch(ALETA_API_ANTREAN, {
          credentials: "include",
          cache: "no-store",
        });
        if (respons.status === 403) throw new Error("Peran Anda tidak diberi akses papan penunjukan.");

        // Papan penerusan BELUM TENTU terpasang. Alurnya bergantung pada tabel
        // antrean, dan pengadilan yang operatornya mengerjakan penetapan secara
        // langsung memang tidak memerlukannya - di situ rutenya tidak ada, dan
        // jawabannya 404.
        //
        // Itu bukan kerusakan, jadi tidak digambar sebagai kerusakan. Bagiannya
        // disembunyikan diam-diam, mengikuti sikap yang sama dengan bagian lain
        // panel ini: lapisan bantu yang menampilkan galat merah untuk fitur
        // yang memang tidak dipakai lebih merugikan daripada yang absen.
        if (respons.status === 404) {
          kotak.style.display = "none";
          return;
        }
        if (!respons.ok) throw new Error(`ALETA menjawab ${respons.status}.`);

        const luar = await respons.json();
        const data = luar && luar.data ? luar.data : luar;
        isi.textContent = "";

        const daftar = (data && data.untukSaya) || [];
        if (daftar.length === 0) {
          isi.appendChild(
            buatElemen(
              "div",
              "aleta-kosong",
              data && data.seluruhnya > 0
                ? `Tidak ada yang menunggu jabatan Anda. ${data.seluruhnya} penerusan menunggu pejabat lain.`
                : "Tidak ada penetapan yang diteruskan."
            )
          );
          return;
        }

        for (const penerusan of daftar) {
          const baris = buatElemen("div", "aleta-baris aleta-mendesak");
          baris.appendChild(
            buatElemen("div", "aleta-baris-judul", `${penerusan.sebutan} — ${penerusan.nomorPerkara}`)
          );
          if (penerusan.ringkasan) {
            baris.appendChild(buatElemen("div", "aleta-baris-ket", penerusan.ringkasan));
          }

          // Menekan barisnya membuka perkaranya di SIPP. Alamatnya disusun dari
          // asal halaman yang sedang dibuka, bukan dipatok mati - ALETA dapat
          // dipasang di satker lain dengan alamat SIPP yang berbeda.
          const tautan = buatElemen("a", "aleta-tombol", "Buka perkaranya");
          tautan.href = `${location.origin}/SIPP/detil_perkara_agama/index/${encodeURIComponent(
            penerusan.perkaraId
          )}`;
          tautan.title = "Buka perkara ini di SIPP, lalu buka formulir penetapannya.";
          baris.appendChild(tautan);

          isi.appendChild(baris);
        }
      } catch (galat) {
        isi.textContent = "";
        isi.appendChild(
          buatElemen("div", "aleta-gagal", String(galat.message || galat).slice(0, 200))
        );
        sudahDimuat = false;
      }
    })();
  });

  return kotak;
}

/** Papan penunjukan, dimuat hanya ketika menunya dibuka. */
function bagianPenunjukan(nomor) {
  const kotak = bagian("Penunjukan PMH, PPP, PJS, PHS", "penunjukan", true);
  let sudahDimuat = false;

  const kepala = kotak.querySelector(".aleta-bagian-judul");
  kepala.addEventListener("click", () => {
    const isi = kotak.isi;
    if (sudahDimuat || isi.style.display === "none") return;
    sudahDimuat = true;

    isi.appendChild(buatElemen("div", "aleta-memuat", "Menyusun usulan…"));
    void (async () => {
      try {
        const data = await ambilUsulanPenunjukan(nomor);
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
  });

  return kotak;
}

/**
 * ============================================================================
 * BERBICARA DENGAN JEMBATAN
 * ============================================================================
 *
 * jembatan.js berjalan di dunia UTAMA dan dapat menyentuh jQuery, select2,
 * serta CKEditor milik halaman SIPP - yang tidak terlihat dari sini sama
 * sekali. Percakapannya lewat postMessage, satu pertanyaan satu jawaban,
 * dicocokkan dengan nomor urut.
 *
 * Tiap permintaan punya batas waktu. Jembatan yang tidak menjawab - karena
 * halaman berpindah di tengah, atau skripnya belum sempat termuat - tidak
 * boleh membuat pengisian menggantung tanpa akhir: yang menunggu selamanya
 * tampak seperti aplikasi yang membeku, dan yang membacanya akan menekan
 * Kerjakan sekali lagi.
 */
const BATAS_TUNGGU_JEMBATAN = 5000;
let nomorPermintaan = 0;

function kirimKeJembatan(pesan) {
  return new Promise((selesai) => {
    nomorPermintaan += 1;
    const id = `aleta-${Date.now()}-${nomorPermintaan}`;
    let sudah = false;

    const dengar = (peristiwa) => {
      if (peristiwa.source !== window) return;
      const isi = peristiwa.data;
      if (!isi || isi.sumber !== "aleta-jembatan-jawab" || isi.id !== id) return;
      if (sudah) return;
      sudah = true;
      window.removeEventListener("message", dengar);
      clearTimeout(pewaktu);
      selesai(isi);
    };

    const pewaktu = setTimeout(() => {
      if (sudah) return;
      sudah = true;
      window.removeEventListener("message", dengar);
      selesai({ ok: false, alasan: "jembatan_tidak_menjawab" });
    }, BATAS_TUNGGU_JEMBATAN);

    window.addEventListener("message", dengar);
    window.postMessage({ sumber: "aleta-jembatan", id, ...pesan }, "*");
  });
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

/**
 * Mengisi satu formulir, kolom demi kolom.
 *
 * Berhenti pada kegagalan PERTAMA. Meneruskan sesudah satu kolom gagal
 * menghasilkan formulir yang terisi sebagian tanpa ada yang tahu bagian mana
 * yang kosong - dan yang menekan Simpan kemudian menyimpan campuran antara
 * yang diisi ALETA dan yang tertinggal dari isian sebelumnya.
 */
async function isiBorang(medanBorang, nilaiKolom) {
  const hasil = [];

  for (const kolom of medanBorang) {
    const nilai = nilaiKolom[kolom.medan];
    if (nilai === undefined || nilai === null || nilai === "") {
      if (kolom.wajib) {
        return { ok: false, alasan: `nilai untuk ${kolom.medan} belum ada`, hasil };
      }
      continue;
    }

    const jawab = await kirimKeJembatan({
      jenis: "isi",
      penunjuk: kolom.penunjuk,
      jenisMedan: kolom.jenis,
      nilai,
    });

    hasil.push({ medan: kolom.medan, nilai, ...jawab });
    if (!jawab.ok) {
      return { ok: false, alasan: `${kolom.medan}: ${jawab.alasan || "gagal diisi"}`, hasil };
    }
  }

  return { ok: true, alasan: "", hasil };
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
 * Menyusun kepala panel: seberapa segar datanya, dan keadaan perkara sekilas.
 *
 * ============================================================================
 * KAPAN DATA INI DIAMBIL
 * ============================================================================
 *
 * Ini bukan kenyamanan, melainkan penjagaan. Panel menampilkan keadaan perkara
 * menurut ALETA, dan ALETA hanya setahu penarikan terakhirnya. Bila penarikan
 * terakhir tiga hari lalu, "0 dokumen" berarti "belum ada tiga hari lalu" -
 * bukan "pihak belum mengunggah". Hakim yang tidak tahu bedanya dapat mengambil
 * keputusan atas dasar yang keliru.
 *
 * Karena itu umur data selalu ditampilkan, dan berubah mencolok setelah sehari.
 */

// ─── Panel dapat digeser, dan posisinya diingat ──────────────────────────────
//
// Panel melayang di sisi kanan dan menutupi kolom kanan tabel SIPP - pada
// halaman Daftar Perkara, kolom Status Perkara dan tombol [detil] tertutup
// seluruhnya. Petugas yang perlu kolom itu terpaksa menutup panel, dan panel
// yang selalu ditutup sama saja dengan panel yang tidak ada.
//
// Posisinya disimpan di penyimpanan ekstensi, bukan per halaman: petugas
// memindahkannya sekali, lalu tetap di sana.

const KUNCI_POSISI = "posisiPanel";

// Ukuran ikut disimpan bersama posisinya.
//
// Lebar 340 piksel cukup untuk sebagian besar layar, tetapi tidak untuk semua:
// pada layar sempit ia menutupi kolom SIPP, dan pada layar lebar ia memaksa
// menggulir untuk membaca daftar yang sebenarnya muat. Keduanya berakhir sama -
// panel yang ditutup, lalu tidak dipakai lagi.
//
// Disimpan di penyimpanan ekstensi, bukan per halaman: petugas mengaturnya
// sekali, lalu tetap begitu di seluruh SIPP.

let keadaanPanel = null;

async function muatPosisi() {
  try {
    const simpan = await chrome.storage.local.get([KUNCI_POSISI]);
    const posisi = simpan[KUNCI_POSISI];
    if (!posisi || typeof posisi !== "object") return null;
    return posisi;
  } catch {
    return null;
  }
}

/**
 * Menyimpan sebagian keadaan tanpa menghapus sisanya.
 *
 * Menggeser panel TIDAK BOLEH melupakan ukurannya, dan sebaliknya. Menulis
 * seluruh objek dari satu peristiwa saja adalah cara paling mudah kehilangan
 * yang satunya - dan hilangnya baru terasa sesudah petugas mengatur ulang
 * untuk kedua kalinya.
 */
function simpanKeadaanPanel(sebagian) {
  keadaanPanel = { ...(keadaanPanel || {}), ...sebagian };
  try {
    void chrome.storage.local.set({ [KUNCI_POSISI]: keadaanPanel });
  } catch {
    /* penyimpanan tidak tersedia: panel tetap dapat diatur, hanya tidak diingat */
  }
}

function simpanPosisi(kiri, atas) {
  simpanKeadaanPanel({ kiri, atas });
}

function simpanUkuran(lebar, tinggi) {
  simpanKeadaanPanel({ lebar, tinggi });
}

/** Mengembalikan panel ke ukuran dan tempat bawaannya. */
function kembalikanBawaan(panel) {
  keadaanPanel = null;
  try {
    void chrome.storage.local.remove(KUNCI_POSISI);
  } catch {
    /* penyimpanan tidak tersedia - yang penting tampilannya sudah kembali */
  }
  for (const sifat of ["left", "top", "right", "bottom", "width", "height", "maxHeight"]) {
    panel.style[sifat] = "";
  }
}

/** Menjaga panel tetap terlihat walau jendela diperkecil setelah digeser. */
function jepitKeLayar(kiri, atas, lebar, tinggi) {
  const batasKiri = Math.min(Math.max(kiri, 0), Math.max(window.innerWidth - lebar, 0));
  const batasAtas = Math.min(Math.max(atas, 0), Math.max(window.innerHeight - 40, 0));
  return { kiri: batasKiri, atas: batasAtas };
}

function terapkanPosisi(panel, posisi) {
  keadaanPanel = posisi ? { ...posisi } : null;
  if (!posisi) return;

  // Ukuran lebih dulu: posisinya dijepit terhadap ukuran yang SUDAH berlaku,
  // bukan terhadap ukuran bawaan yang sebentar lagi berubah.
  if (typeof posisi.lebar === "number" && posisi.lebar > 0) {
    panel.style.width = `${Math.min(posisi.lebar, Math.max(window.innerWidth - 20, 260))}px`;
  }
  if (typeof posisi.tinggi === "number" && posisi.tinggi > 0) {
    panel.style.height = `${Math.min(posisi.tinggi, Math.max(window.innerHeight - 20, 160))}px`;
    // Batas bawaan dilepas hanya bila tingginya memang diatur sendiri -
    // kalau tidak, panel setinggi apa pun tetap terpotong pada batas itu.
    panel.style.maxHeight = "none";
  }

  if (typeof posisi.kiri !== "number" || typeof posisi.atas !== "number") return;
  const kotak = panel.getBoundingClientRect();
  const aman = jepitKeLayar(posisi.kiri, posisi.atas, kotak.width || 320, kotak.height || 200);
  panel.style.left = `${aman.kiri}px`;
  panel.style.top = `${aman.atas}px`;
  panel.style.right = "auto";
  panel.style.bottom = "auto";
}

/**
 * Menjangkarkan panel pada kiri-atas, bukan pada kanan-atas.
 *
 * Bawaannya menempel ke tepi kanan (right: 14px). Pada jangkar itu, menarik
 * sudut kanan-bawah untuk MELEBARKAN justru menumbuhkan panel ke KIRI sementara
 * sudut yang ditarik diam di tempat - terasa terbalik, dan orang berhenti
 * mencoba. Dijangkarkan ulang sesudah terpasang, pada koordinat yang persis
 * sama, sehingga tampilannya tidak bergeser sedikit pun.
 */
function normalkanJangkar(panel) {
  if (panel.style.left) return;
  const kotak = panel.getBoundingClientRect();
  panel.style.left = `${Math.round(kotak.left)}px`;
  panel.style.top = `${Math.round(kotak.top)}px`;
  panel.style.right = "auto";
  panel.style.bottom = "auto";
}

/**
 * Menjaga panel tetap terjangkau saat jendela diperkecil.
 *
 * Sesudah dijangkarkan pada kiri-atas, panel tidak lagi mengikuti tepi kanan.
 * Jendela yang diperkecil - atau layar kedua yang dicabut - dapat meninggalkan
 * panel di luar layar, dan panel yang tidak terlihat tidak dapat digeser
 * kembali.
 */
function jagaTetapTerlihat() {
  const panel = document.getElementById(PENANDA);
  if (!panel || !panel.style.left) return;
  const kotak = panel.getBoundingClientRect();
  const aman = jepitKeLayar(kotak.left, kotak.top, kotak.width, kotak.height);
  panel.style.left = `${aman.kiri}px`;
  panel.style.top = `${aman.atas}px`;
}

window.addEventListener("resize", jagaTetapTerlihat);

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

  kepala.addEventListener("mousedown", (peristiwa) => {
    if (peristiwa.button !== 0) return;
    if (peristiwa.target.closest("button")) return;
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

/** Selisih waktu menjadi kalimat pendek: "3 jam lalu". */
function usiaData(waktuIso) {
  const waktu = new Date(String(waktuIso || ""));
  if (Number.isNaN(waktu.getTime())) return { teks: "waktu tidak diketahui", basi: true };

  const menit = Math.max(Math.round((Date.now() - waktu.getTime()) / 60000), 0);
  if (menit < 2) return { teks: "baru saja", basi: false };
  if (menit < 60) return { teks: `${menit} menit lalu`, basi: false };

  const jam = Math.round(menit / 60);
  if (jam < 24) return { teks: `${jam} jam lalu`, basi: false };

  const hari = Math.round(jam / 24);
  return { teks: `${hari} hari lalu`, basi: true };
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

/** Deretan angka keadaan perkara, hanya yang bernilai bukan nol. */
function barisRingkasan(ringkasan) {
  const r = ringkasan || {};
  const butir = [
    { nilai: r.selisihGenting, label: "selisih genting", warna: "merah" },
    { nilai: r.tenggatLewat, label: "tenggat lewat", warna: "merah" },
    { nilai: r.tenggatMendesak, label: "tenggat mendesak", warna: "kuning" },
    { nilai: r.menungguVerifikasi, label: "menunggu majelis", warna: "kuning" },
    { nilai: r.nomorBermasalah, label: "nomor bermasalah", warna: "kuning" },
    { nilai: r.dokumen, label: "dokumen", warna: "abu" },
  ].filter((x) => Number(x.nilai) > 0);

  if (butir.length === 0) return null;

  const baris = buatElemen("div", "aleta-ringkasan");
  for (const x of butir) {
    const chip = buatElemen("span", `aleta-chip aleta-chip-${x.warna}`);
    chip.appendChild(buatElemen("strong", "", String(x.nilai)));
    chip.appendChild(buatElemen("span", "", ` ${x.label}`));
    baris.appendChild(chip);
  }
  return baris;
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
    const chip = buatElemen("span", "aleta-tanda-jenis", identitas.jenisPerkara);
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
  } else {
    const chip = buatElemen("span", "aleta-tanda-tanpa-kuasa", "Tanpa kuasa hukum");
    chip.title = "SIPP tidak mencatat kuasa hukum pada perkara ini.";
    baris.appendChild(chip);
  }

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
  kepala.appendChild(buatElemen("span", "aleta-nomor", konteks.nomorPerkara));

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
  kepala.appendChild(bawaan);

  const lipat = buatElemen("button", "aleta-lipat", "–");
  lipat.title = "Sembunyikan panel";
  lipat.addEventListener("click", () => {
    const isi = panel.querySelector(".aleta-isi");
    const tersembunyi = isi.style.display === "none";
    isi.style.display = tersembunyi ? "" : "none";
    lipat.textContent = tersembunyi ? "–" : "+";
  });
  kepala.appendChild(lipat);

  // Saklar mati di kepala panel.
  //
  // Saklarnya memang sudah ada di popup ekstensi, tetapi popup itu berada
  // di bilah ekstensi Chrome - tempat yang harus dicari lebih dulu. Petugas
  // yang panelnya menghalangi pekerjaan butuh mematikannya SEKARANG, dan
  // yang tidak menemukan saklarnya akan menutup panel berulang kali setiap
  // halaman - lalu berhenti memakai ekstensinya sama sekali.
  const matikan = buatElemen("button", "aleta-matikan", "×");
  matikan.type = "button";
  matikan.title = "Matikan ALETA untuk SIPP (dapat dinyalakan lagi dari ikon ekstensi)";
  matikan.addEventListener("click", () => {
    try {
      void chrome.storage.local.set({ aktif: false });
    } catch {
      // Penyimpanan tidak tersedia: panel tetap ditutup untuk halaman ini.
      const lama = document.getElementById(PENANDA);
      if (lama) lama.remove();
    }
  });
  kepala.appendChild(matikan);

  panel.appendChild(kepala);
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

  // --- Baris 1: perkaranya -------------------------------------------------
  //
  // Yang disalin nomor PERKARA, bukan nomor register. Nomor perkara yang
  // dipakai sehari-hari - disebut di WhatsApp, dicari di SIPP, ditulis di
  // berkas - sedangkan nomor register e-Court hampir hanya dipakai saat
  // menelusuri e-Court itu sendiri. Registernya tetap ada, di baris kedua.
  const barisPerkara = buatElemen("div", "aleta-kepala-perkara");
  if (konteks.nomorPerkara) {
    barisPerkara.appendChild(tombolSalin(konteks.nomorPerkara, "Salin nomor perkara"));
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
  if (penggunaTerakhir && penggunaTerakhir.nama) {
    barisSiapa.appendChild(buatElemen("span", "aleta-kepala-nama", penggunaTerakhir.nama));
    if (penggunaTerakhir.peran) {
      barisSiapa.appendChild(buatElemen("span", "aleta-kepala-peran", penggunaTerakhir.peran));
    }
  }
  if (konteks.nomorRegister) {
    const reg = tombolSalin(konteks.nomorRegister, "Salin nomor register untuk dicari di e-Court");
    reg.classList.add("aleta-kepala-register");
    barisSiapa.appendChild(reg);
  }

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
  const kelompokSemua = [];

  /** Membuat menu malas sekaligus mendaftarkannya untuk diberi lencana. */
  const malas = (judul, kunci, gambar) => {
    const kotak = bagianMalas(judul, kunci, konteks.nomorPerkara, gambar);
    menuMalas[kunci] = kotak;
    return kotak;
  };

  // ==========================================================================
  // KELOMPOK 1 - BERKAS
  // ==========================================================================
  //
  // Terbuka sebagai bawaan. Inilah yang menjawab "apa yang harus saya
  // kerjakan sekarang" - dokumen yang masuk, tenggat yang berjalan, dan
  // berkas yang belum lengkap.
  const kelBerkas = kelompok("Berkas", "berkas", false);

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
    for (const d of konteks.dokumen) {
      const baris = buatElemen("div", "aleta-baris");
      baris.appendChild(buatElemen("div", "aleta-baris-judul", d.judulDokumen || "Dokumen"));

      const bagianKet = [];
      if (d.peranPengunggah) bagianKet.push(`dari ${d.peranPengunggah}`);
      if (d.statusVerifikasi === "tidak_perlu") {
        bagianKet.push("berkas pendaftaran");
      } else if (d.statusVerifikasi === "valid") {
        bagianKet.push("sudah diverifikasi");
      } else if (d.statusVerifikasi === "tidak_valid") {
        bagianKet.push("dinyatakan tidak valid");
      } else {
        bagianKet.push("menunggu majelis");
      }
      if (d.sudahDiberitahukan) bagianKet.push("pihak sudah diberi tahu");
      else if (d.alasanTidakDiberitahukan) {
        bagianKet.push(d.alasanTidakDiberitahukan.replace(/_/g, " "));
      }
      baris.appendChild(buatElemen("div", "aleta-baris-ket", bagianKet.join(" · ")));

      const tombolBerkas = buatElemen("div", "aleta-berkas");
      if (d.adaPdf) tombolBerkas.appendChild(tombolUnduh(d, "pdf", "PDF"));
      if (d.adaWord) tombolBerkas.appendChild(tombolUnduh(d, "word", "Word"));
      if (!d.adaPdf && !d.adaWord) {
        tombolBerkas.appendChild(
          buatElemen("span", "aleta-berkas-kosong", "berkas belum tersimpan")
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
      kotak.isi.appendChild(baris);
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

  if (konteks.nomorPihak.length > 0) {
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

  kelPerkara.isi.appendChild(malas("Penilaian SK 048/2024", "penilaianSk", gambarPenilaian));
  isi.appendChild(kelPerkara);
  kelompokSemua.push(kelPerkara);

  // ==========================================================================
  // KELOMPOK 3 - PUTUSAN
  // ==========================================================================
  //
  // Pada perkara yang belum putus, kedua menu di dalamnya memang kosong - dan
  // kepalanya menyebutkan "belum putus" tanpa perlu dibuka. Itulah yang dulu
  // menuntut membuka dua menu untuk menemukan dua keterangan kosong.
  const kelPutusan = kelompok("Putusan", "putusanKel", true);
  kelPutusan.isi.appendChild(malas("Putusan dan upaya hukum", "putusan", gambarPutusan));
  kelPutusan.isi.appendChild(malas("Putusan di e-Court", "putusanEcourt", gambarPutusanEcourt));
  isi.appendChild(kelPutusan);
  kelompokSemua.push(kelPutusan);

  // ==========================================================================
  // KELOMPOK 4 - KERJAKAN
  // ==========================================================================
  //
  // Satu-satunya kelompok yang MENGUBAH SIPP. Dipisah dari yang dibaca bukan
  // demi kerapian: mencampur menu yang menampilkan keterangan dengan menu
  // yang mengisi formulir membuat tombol yang menulis duduk di antara tombol
  // yang tidak - dan pada layar sesak, itu cara termudah salah tekan.
  //
  // Digambar hanya bila perannya memang berwenang. Sebelumnya ketiganya
  // tetap muncul untuk semua orang dan baru menolak sesudah ditekan.
  if (boleh("penunjukan")) {
    const kelKerja = kelompok("Kerjakan", "kerjakan", true);

    // Paling atas di kelompoknya: ini satu-satunya bagian yang menyebut
    // pekerjaan di perkara LAIN, dan pejabat yang membuka panel ini bisa jadi
    // sedang membuka perkara yang tidak ada hubungannya dengan penerusannya.
    kelKerja.isi.appendChild(bagianMenungguSaya());
    kelKerja.isi.appendChild(bagianPenunjukan(konteks.nomorPerkara));
    kelKerja.isi.appendChild(bagianDataUmum());

    // Alat pemasangan, bukan keterangan perkara - jawabannya sama pada perkara
    // mana pun. Dibatasi ke Super Admin dan Admin, yang memang satu-satunya
    // yang dapat menyunting peta kolomnya.
    if (boleh("penunjukan-otomatis") && penggunaTerakhir && /admin/i.test(penggunaTerakhir.peran || "")) {
      kelKerja.isi.appendChild(bagianBacaBorang());
    }

    isi.appendChild(kelKerja);
    kelompokSemua.push(kelKerja);
  }

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

  const kaki = buatElemen("div", "aleta-kaki");
  kaki.appendChild(buatElemen("span", "aleta-kaki-teks", "Keterangan dari ALETA. SIPP tidak diubah."));

  // Seri ekstensi yang BENAR-BENAR berjalan di peramban ini.
  //
  // Dibaca dari manifestnya sendiri, bukan dari angka yang ditulis terpisah.
  // Gunanya saat melapor: "panelnya keliru" tanpa nomor seri membuat pemeriksaan
  // dimulai dari menebak versi mana yang sedang dipakai orang itu - dan tebakan
  // itu hampir selalu meleset di kantor yang komputernya disegarkan sendiri.
  try {
    const seri = chrome.runtime.getManifest().version;
    if (seri) kaki.appendChild(buatElemen("span", "aleta-kaki-versi", `v${seri}`));
  } catch {
    /* di luar konteks ekstensi: kaki tetap tampil tanpa nomor seri */
  }

  panel.appendChild(kaki);

  return panel;
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
function susunPanelDitolak(pesan) {
  const panel = buatElemen("div", "aleta-panel");
  panel.id = PENANDA;

  const kepala = buatElemen("div", "aleta-kepala");
  kepala.appendChild(buatElemen("span", "aleta-merek", "ALETA"));
  panel.appendChild(kepala);

  const isi = buatElemen("div", "aleta-isi");
  isi.appendChild(
    buatElemen(
      "div",
      "aleta-kosong",
      pesan || "Peran Anda tidak diberi akses ke ekstensi ini. Hubungi administrator ALETA."
    )
  );

  panel.appendChild(isi);
  return panel;
}

function susunAjakanMasuk() {
  const panel = buatElemen("div", "aleta-panel");
  panel.id = PENANDA;

  const kepala = buatElemen("div", "aleta-kepala");
  kepala.appendChild(buatElemen("span", "aleta-merek", "ALETA"));
  panel.appendChild(kepala);

  const isi = buatElemen("div", "aleta-isi");
  isi.appendChild(buatElemen("div", "aleta-kosong", "Masuk ke ALETA untuk melihat keterangan perkara ini."));
  // Disebutkan supaya tidak ada yang memuat ulang halaman SIPP tanpa perlu -
  // dan supaya yang menunggu tahu bahwa memang ada yang ditunggu.
  isi.appendChild(
    buatElemen("div", "aleta-kosong-lembut", "Panel ini menyambung sendiri begitu Anda selesai masuk.")
  );

  const tautan = buatElemen("a", "aleta-tombol", "Buka ALETA");
  tautan.href = "/aleta";
  tautan.target = "_blank";
  tautan.rel = "noreferrer noopener";
  isi.appendChild(tautan);

  panel.appendChild(isi);
  return panel;
}

// ─── Menandai halaman SIPP ────────────────────────────────────────────────────
//
// Aturan yang tidak boleh dilanggar bagian ini:
//
//   1. HANYA MENAMBAH. Tidak mengubah teks, nilai, atribut, atau susunan yang
//      sudah ada di SIPP. Yang disisipkan hanya elemen baru bertanda
//      data-aleta-tanda, plus satu kelas sorotan pada baris.
//   2. DAPAT DICABUT UTUH. Mematikan saklarnya harus mengembalikan halaman ke
//      keadaan semula, tanpa memuat ulang.
//   3. TIDAK MENYENTUH FORMULIR. Tidak menekan tombol, tidak mengisi isian,
//      tidak mengirim apa pun. SIPP adalah sistem resmi; yang tercatat di sana
//      harus selalu hasil perbuatan manusia.
//
// Yang ditandai adalah keterangan yang MEMANG TIDAK ADA di SIPP: tenggat
// unggah e-Court dan keadaan nomor pihak. Menandai hal yang sudah tertulis di
// layar hanya menambah keramaian tanpa menambah pengetahuan.

const TANDA = "data-aleta-tanda";
const SOROT = "aleta-baris-disorot";

function bersihkanTanda() {
  // Melepas sorotan mengubah atribut class pada baris SIPP - perubahan yang
  // penyaring tidak dapat mengenali sebagai milik ALETA, karena barisnya
  // memang milik SIPP. Karena itu pembersihan pun dikerjakan tanpa pengamat.
  tanpaPengamat(() => {
    document.querySelectorAll(`[${TANDA}]`).forEach((el) => el.remove());
    document.querySelectorAll(`.${SOROT}`).forEach((el) => el.classList.remove(SOROT));
  });
}

function labelTanda(teks, warna) {
  const span = buatElemen("span", `aleta-tanda aleta-tanda-${warna}`, teks);
  span.setAttribute(TANDA, "1");
  return span;
}

function samakan(teks) {
  return String(teks || "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Menempelkan ringkasan e-Court di sebelah judul halaman perkara. */
function tandaiJudul(konteks) {
  const judul = document.querySelector("h1, h2, .page-title, .panel-title");
  if (!judul || judul.querySelector(`[${TANDA}]`)) return;

  const r = konteks.ringkasan || {};
  if (r.tenggatLewat > 0) {
    judul.appendChild(labelTanda(`${r.tenggatLewat} tenggat lewat`, "merah"));
  }
  if (r.tenggatMendesak > 0) {
    judul.appendChild(labelTanda(`${r.tenggatMendesak} tenggat mendesak`, "kuning"));
  }
  if (r.dokumen > 0) {
    judul.appendChild(labelTanda(`${r.dokumen} dokumen e-Court`, "hijau"));
  }
  if (r.nomorBermasalah > 0) {
    judul.appendChild(labelTanda(`${r.nomorBermasalah} nomor bermasalah`, "kuning"));
  }
}

/**
 * Menandai baris pihak yang nomornya belum terkonfirmasi atau tidak ada.
 *
 * Pencocokan dilakukan pada teks sel, bukan pada id atau struktur tabel SIPP -
 * struktur itu berbeda antar versi SIPP dan antar jenis perkara, sedangkan
 * namanya tetap. Yang tidak cocok dibiarkan tanpa tanda: lebih baik tidak
 * menandai daripada menandai baris yang salah.
 */
function tandaiPihak(konteks) {
  // ==========================================================================
  // NILAINYA "terverifikasi", BUKAN "terkonfirmasi"
  // ==========================================================================
  //
  // Sebelumnya dibandingkan dengan "terkonfirmasi" - nilai yang tidak pernah
  // dihasilkan server sama sekali. Akibatnya perbandingannya selalu benar,
  // dan SETIAP pihak ditandai "nomor belum dikonfirmasi" di halaman SIPP,
  // termasuk yang nomornya justru sudah diverifikasi.
  //
  // Salahnya tidak pernah terlihat karena pihak yang sudah terverifikasi
  // memang masih sedikit: penandanya tampak benar hampir sepanjang waktu, dan
  // baru keliru pada perkara yang justru sudah beres.
  const bermasalah = (konteks.nomorPihak || []).filter(
    (o) => !o.adaNomor || o.statusVerifikasi !== "terverifikasi"
  );
  if (bermasalah.length === 0) return;

  const sel = Array.from(document.querySelectorAll("td"));
  if (sel.length === 0) return;

  for (const orang of bermasalah) {
    const cari = samakan(orang.nama);
    if (!cari) continue;

    for (const td of sel) {
      if (td.querySelector(`[${TANDA}]`)) continue;
      if (!samakan(td.textContent).startsWith(cari)) continue;

      const baris = td.closest("tr");
      if (baris) baris.classList.add(SOROT);

      td.appendChild(
        orang.adaNomor
          ? labelTanda("nomor belum dikonfirmasi", "kuning")
          : labelTanda("tidak ada nomor di SIPP", "abu")
      );
      break; // Satu tanda per orang sudah cukup.
    }
  }
}

// ─── Menyisipkan dokumen e-Court ke baris Jadwal Sidang ──────────────────────
//
// ============================================================================
// KENAPA HANYA TANGGAL YANG DIPAKAI
// ============================================================================
//
// Baris Jadwal Sidang di SIPP dan dokumen di e-Court sama-sama punya agenda,
// dan menggodanya besar: "Jawaban Tergugat" ada di keduanya. Tetapi agenda
// adalah teks bebas - SIPP menulis "penyampaian perbaikan gugatan" sementara
// e-Court menulis "Perbaikan Gugatan", dan satu perkara dapat punya dua agenda
// yang bunyinya mirip.
//
// Dokumen yang muncul di baris agenda yang keliru berarti hakim membuka berkas
// yang salah - dan letaknya tampak masuk akal, sehingga tidak ada yang
// menyadarinya. Karena itu pencocokan HANYA memakai tanggal sidang, dan bila
// satu tanggal punya lebih dari satu dokumen, seluruhnya ditampilkan apa adanya
// tanpa menebak mana milik agenda yang mana.
//
// ============================================================================
// HANYA MENAMBAH DI AKHIR SEL
// ============================================================================
//
// Sel yang disisipi memuat tombol "Unggah BAS" - tombol yang mengunggah
// dokumen resmi ke SIPP. Sisipan selalu ditambahkan di AKHIR sel, tidak pernah
// di depan maupun di antara kontrol SIPP, supaya tidak ada tombol yang bergeser
// ke tempat yang tidak diharapkan petugas.

const BULAN_SINGKAT = {
  jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, jun: 5,
  jul: 6, agu: 7, agt: 7, sep: 8, okt: 9, nov: 10, nop: 10, des: 11,
};

/** Membaca "Selasa, 02 Des. 2025" menjadi tanggal. Mengembalikan "" bila gagal. */
function tanggalDariTeksSipp(teks) {
  // Nama bulan diterima singkat maupun lengkap. SIPP memakai keduanya:
  // "02 Des. 2025" pada Jadwal Sidang, "02 Januari 2026" pada Court Calendar.
  const cocok = String(teks || "").match(/(\d{1,2})\s+([A-Za-z]{3,10})\.?\s+(\d{4})/);
  if (!cocok) return "";

  const bulan = BULAN_SINGKAT[cocok[2].slice(0, 3).toLowerCase()];
  if (bulan === undefined) return "";

  const hari = Number(cocok[1]);
  const tahun = Number(cocok[3]);
  if (!hari || !tahun) return "";

  // Dibandingkan sebagai teks YYYY-MM-DD, bukan sebagai objek tanggal. Objek
  // tanggal membawa zona waktu, dan dokumen yang diunggah pukul 23.30 WIB dapat
  // jatuh ke tanggal sebelumnya bila dibandingkan dalam UTC.
  return `${tahun}-${String(bulan + 1).padStart(2, "0")}-${String(hari).padStart(2, "0")}`;
}

/** Tanggal ISO dari dokumen ALETA, dipotong ke hari saja. */
function tanggalDokumen(dokumen) {
  const nilai = dokumen && dokumen.tanggalSidang;
  if (!nilai) return "";
  const teks = String(nilai);
  const cocok = teks.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return cocok ? `${cocok[1]}-${cocok[2]}-${cocok[3]}` : "";
}

/** Sel "Ruang & Data Persidangan" pada satu baris jadwal. */
function selPersidangan(baris) {
  // Dikenali dari isinya, bukan dari urutan kolom: urutan kolom berbeda antar
  // jenis perkara, sedangkan tombol Unggah BAS selalu ada di sel ini.
  for (const sel of Array.from(baris.querySelectorAll("td"))) {
    if (/Unggah BAS|Data Persidangan/i.test(sel.textContent || "")) return sel;
  }
  return null;
}

/** Menyusun kotak sisipan untuk satu baris jadwal. */
function kotakSisipan(dokumenSehari, ambangHari) {
  const kotak = buatElemen("div", "aleta-sisip");
  kotak.setAttribute(TANDA, "1");

  // Bertanda ALETA secara terlihat. Tanpa ini, tautan di dalam tabel SIPP
  // terbaca sebagai bagian SIPP - dan petugas mengira berkasnya berasal dari
  // sistem resmi.
  kotak.appendChild(buatElemen("div", "aleta-sisip-judul", "ALETA · e-Court"));

  for (const dokumen of dokumenSehari) {
    const baris = buatElemen("div", "aleta-sisip-baris");

    const judul = buatElemen("span", "aleta-sisip-nama", dokumen.judulDokumen || dokumen.jenisDokumen || "Dokumen");
    baris.appendChild(judul);

    if (dokumen.adaPdf) baris.appendChild(tombolUnduh(dokumen, "pdf", "PDF"));
    if (dokumen.adaWord) baris.appendChild(tombolUnduh(dokumen, "word", "Word"));

    // Tenggat unggah ikut ditampilkan di baris yang sama - inilah keterangan
    // yang tidak dimiliki SIPP sama sekali.
    if (dokumen.sisaHari !== null && dokumen.sisaHari !== undefined) {
      const ket = keteranganSisa(dokumen.sisaHari, ambangHari);
      if (ket && ket.teks) {
        baris.appendChild(buatElemen("span", `aleta-tanda aleta-tanda-${ket.warna}`, ket.teks));
      }
    }

    if (dokumen.statusVerifikasi === "belum") {
      baris.appendChild(buatElemen("span", "aleta-tanda aleta-tanda-kuning", "menunggu majelis"));
    } else if (dokumen.statusVerifikasi === "valid") {
      baris.appendChild(buatElemen("span", "aleta-tanda aleta-tanda-hijau", "sudah diverifikasi"));
    }

    kotak.appendChild(baris);
  }

  return kotak;
}

/**
 * Menyisipkan dokumen e-Court ke tiap baris Jadwal Sidang yang tanggalnya cocok.
 *
 * Baris yang tidak punya dokumen dibiarkan apa adanya - menambahkan "tidak ada
 * dokumen" di setiap baris hanya menambah keramaian tanpa menambah pengetahuan.
 */
function sisipkanKeJadwalSidang(konteks) {
  const dokumen = Array.isArray(konteks.dokumen) ? konteks.dokumen : [];
  if (dokumen.length === 0) return;

  // Dikelompokkan per tanggal lebih dulu.
  const perTanggal = new Map();
  for (const d of dokumen) {
    const tanggal = tanggalDokumen(d);
    if (!tanggal) continue; // tanpa tanggal sidang: tidak dapat dicocokkan
    const daftar = perTanggal.get(tanggal) || [];
    daftar.push(d);
    perTanggal.set(tanggal, daftar);
  }
  if (perTanggal.size === 0) return;

  const ambang = Number(konteks.ambangMendesakHari) || 3;

  for (const baris of Array.from(document.querySelectorAll("tr"))) {
    const sel = selPersidangan(baris);
    if (!sel) continue;
    if (sel.querySelector(`[${TANDA}]`)) continue; // sudah disisipi

    // Tanggal dibaca dari sel kedua baris ini, tempat SIPP menuliskannya.
    const tanggal = tanggalDariTeksSipp(baris.textContent);
    if (!tanggal) continue;

    const cocok = perTanggal.get(tanggal);
    if (!cocok || cocok.length === 0) continue;

    sel.appendChild(kotakSisipan(cocok, ambang));
  }
}

async function terapkanTanda(konteks) {
  bersihkanTanda();

  // Dua saklar yang BERDIRI SENDIRI. Petugas boleh menyisipkan berkas ke
  // Jadwal Sidang tanpa menandai halaman, atau sebaliknya - memaksa yang
  // satu menuntut yang lain hanya membuat salah satunya tidak terpakai.
  const menandai = await sedangMenandai();
  const menyisipkan = await sedangMenyisipkan();
  if (!menandai && !menyisipkan) return;

  try {
    // Seluruh penulisan dikerjakan dengan pengamat dilepas - lihat catatan
    // pada tanpaPengamat. Penanda dan sisipan menyentuh puluhan sel tabel,
    // dan tiap sentuhan dulu menjadwalkan penyegaran berikutnya.
    tanpaPengamat(() => {
      if (menandai) {
        tandaiJudul(konteks);
        tandaiPihak(konteks);
      }
      if (menyisipkan) sisipkanKeJadwalSidang(konteks);
    });
  } catch {
    // Struktur halaman SIPP di luar dugaan. Tanda dibatalkan seluruhnya supaya
    // tidak ada sisa setengah jadi yang membingungkan.
    bersihkanTanda();
  }
}

// ─── Penanda baris pada halaman Daftar Perkara ───────────────────────────────
//
// Halaman daftar memuat sampai 50 perkara. Tanpa penanda, petugas harus membuka
// satu per satu untuk tahu mana yang perlu perhatian - dan itu berarti puluhan
// halaman SIPP dibuka hanya untuk menemukan bahwa tidak ada apa-apa.
//
// Ringkasannya diminta SEKALI untuk seluruh baris, bukan satu permintaan per
// perkara. Lima puluh permintaan sekaligus dari satu halaman membebani bot dan
// SIPP tanpa alasan.
//
// Yang ditandai hanya ANGKA - berapa dokumen menunggu majelis, berapa tenggat
// mendesak. Tidak ada nama pihak, tidak ada nomor telepon: halaman daftar
// terlihat siapa saja yang lewat di belakang layar.

const POLA_PERKARA_BARIS = /\b(\d{1,5}\/[A-Za-z]{1,10}(?:\.[A-Za-z]{1,4})?\/\d{4}\/[A-Za-z]{2,4}\.[A-Za-z]{2,6})\b/;

/** Mengumpulkan baris tabel yang memuat nomor perkara. */
function barisPerkaraDiHalaman() {
  const hasil = [];
  const terlihat = new Set();

  for (const baris of Array.from(document.querySelectorAll("tr"))) {
    if (baris.querySelector(`[${TANDA}]`)) continue;
    const cocok = String(baris.textContent || "").match(POLA_PERKARA_BARIS);
    if (!cocok) continue;

    const nomor = cocok[1];
    if (terlihat.has(nomor)) continue;
    terlihat.add(nomor);
    hasil.push({ nomor, baris });
  }
  return hasil;
}

/** Menempelkan penanda ringkas pada satu baris daftar. */
function tempelPenandaBaris(baris, nomor, ringkas) {
  const sel = baris.querySelector("td");
  if (!sel) return;

  // Belum pernah ditarik ALETA sama sekali - keterangan tersendiri, bukan
  // sama dengan "tidak punya dokumen".
  if (ringkas === null) {
    sel.appendChild(labelTanda("belum ditarik ALETA", "abu"));
    return;
  }

  if (ringkas.tenggatLewat > 0) {
    sel.appendChild(labelTanda(`${ringkas.tenggatLewat} tenggat lewat`, "merah"));
  }
  if (ringkas.tenggatMendesak > 0) {
    sel.appendChild(labelTanda(`${ringkas.tenggatMendesak} mendesak`, "kuning"));
  }
  if (ringkas.menungguVerifikasi > 0) {
    sel.appendChild(labelTanda(`${ringkas.menungguVerifikasi} menunggu majelis`, "kuning"));
  }
  if (
    ringkas.dokumen > 0 &&
    ringkas.tenggatLewat === 0 &&
    ringkas.tenggatMendesak === 0 &&
    ringkas.menungguVerifikasi === 0
  ) {
    sel.appendChild(labelTanda(`${ringkas.dokumen} dokumen`, "hijau"));
  }
}

let nomorDaftarTerakhir = "";

/** Menandai seluruh baris pada halaman daftar. */
async function tandaiHalamanDaftar() {
  if (!(await sedangMenandai())) return;

  const baris = barisPerkaraDiHalaman();
  if (baris.length < 2) return; // bukan halaman daftar

  // Halaman yang sama tidak diminta ulang setiap DOM berubah sedikit.
  const sidik = baris.map((x) => x.nomor).join("|");
  if (sidik === nomorDaftarTerakhir) return;
  nomorDaftarTerakhir = sidik;

  try {
    const respons = await fetch(ALETA_API_MASSAL, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nomorPerkara: baris.map((x) => x.nomor) }),
    });
    if (!respons.ok) return;

    const hasil = await respons.json();
    const isi = hasil?.data ?? hasil;
    if (!isi?.available || !isi?.perkara) return;

    tanpaPengamat(() => {
      for (const item of baris) {
        if (!(item.nomor in isi.perkara)) continue;
        tempelPenandaBaris(item.baris, item.nomor, isi.perkara[item.nomor]);
      }
    });
  } catch {
    // Halaman daftar tetap berjalan seperti biasa bila ALETA tidak terjangkau.
  }
}

// ─── Meneruskan permintaan penarikan ─────────────────────────────────────────
//
// Perkara yang belum pernah ditarik ALETA tidak dapat ditampilkan apa pun.
// Alih-alih panel kosong tanpa jalan keluar, petugas dapat meneruskan
// permintaan - dikerjakan penjadwal di putaran berikutnya, bukan saat itu juga.
//
// Menariknya seketika berarti petugas menunggu satu sampai tiga menit di depan
// layar: alamat e-Court buram, jadi daftar harus disapu lebih dulu sebelum
// halaman perkaranya dapat ditemukan.

function kotakPermintaan(nomorPerkara, keadaanAwal) {
  const kotak = buatElemen("div", "aleta-permintaan");

  const pesan = buatElemen("div", "aleta-permintaan-pesan");
  const tombol = buatElemen("button", "aleta-permintaan-tombol", "Tarik dari e-Court");
  tombol.type = "button";

  function tampilkanKeadaan(keadaan) {
    if (!keadaan) {
      pesan.textContent = "Perkara ini belum pernah ditarik ALETA.";
      tombol.style.display = "";
      return;
    }
    if (keadaan.status === "menunggu" || keadaan.status === "dikerjakan") {
      pesan.textContent =
        keadaan.status === "dikerjakan"
          ? "Sedang ditarik dari e-Court..."
          : "Sudah diantrekan. Akan ditarik pada putaran berikutnya.";
      tombol.style.display = "none";
      return;
    }
    if (keadaan.status === "gagal") {
      pesan.textContent = `Penarikan terakhir gagal${keadaan.catatan ? `: ${keadaan.catatan}` : "."}`;
      tombol.style.display = "";
      return;
    }
    pesan.textContent = "Penarikan terakhir sudah selesai. Muat ulang halaman untuk melihat hasilnya.";
    tombol.style.display = "none";
  }

  tombol.addEventListener("click", async () => {
    tombol.disabled = true;
    pesan.textContent = "Meneruskan permintaan...";
    try {
      const respons = await fetch(ALETA_API_PERMINTAAN, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomorPerkara }),
      });
      const hasil = await respons.json();
      const isi = hasil?.data ?? hasil;

      if (isi?.ok) {
        tampilkanKeadaan({ status: "menunggu" });
      } else {
        // Penolakan disampaikan apa adanya. "Baru saja ditarik" bukan
        // kegagalan - itu penjagaan yang bekerja, dan petugas berhak tahu
        // bedanya dari galat.
        pesan.textContent = ALASAN_PERMINTAAN[isi?.alasan] || `Tidak dapat diantrekan (${isi?.alasan || "tidak diketahui"}).`;
        tombol.disabled = false;
      }
    } catch {
      pesan.textContent = "ALETA tidak dapat dihubungi.";
      tombol.disabled = false;
    }
  });

  tampilkanKeadaan(keadaanAwal);
  kotak.appendChild(pesan);
  kotak.appendChild(tombol);
  return kotak;
}

const ALASAN_PERMINTAAN = {
  baru_saja_ditarik: "Perkara ini baru saja ditarik. Coba lagi nanti.",
  antrean_penuh: "Antrean penarikan sedang penuh. Coba lagi beberapa saat lagi.",
  sudah_diantrekan: "Sudah diantrekan sebelumnya.",
  nomor_perkara_kosong: "Nomor perkara tidak terbaca.",
  database_bot_tidak_siap: "Database ALETA Bot belum siap.",
};

/**
 * Menyisipkan kotak permintaan ke panel, setelah keadaannya diketahui.
 *
 * Keadaan dibaca lebih dulu supaya tombol tidak ditawarkan pada perkara yang
 * permintaannya sudah mengantre - petugas yang menekannya dua kali tidak
 * menghasilkan dua penarikan, tetapi juga tidak perlu dibuat bingung.
 */
async function sisipkanPermintaan(panel, nomorPerkara) {
  let keadaan = null;
  try {
    const respons = await fetch(
      `${ALETA_API_PERMINTAAN}?nomor=${encodeURIComponent(nomorPerkara)}`,
      { credentials: "include", cache: "no-store" }
    );
    if (respons.ok) {
      const hasil = await respons.json();
      const isi = hasil?.data ?? hasil;
      keadaan = isi?.keadaan ?? null;
    }
  } catch {
    keadaan = null;
  }

  const isiPanel = panel.querySelector(".aleta-isi");
  if (!isiPanel) return;
  isiPanel.appendChild(kotakPermintaan(nomorPerkara, keadaan));
}

function tampilkan(elemen) {
  tanpaPengamat(() => {
    const lama = document.getElementById(PENANDA);
    if (lama) {
      // Panel lama boleh masih menunggu panggilan latar untuk lencananya.
      // Membiarkannya berangkat berarti menembakkan kueri untuk perkara yang
      // sudah tidak dilihat siapa pun - dan berpindah perkara dengan cepat
      // akan meninggalkan antrean panggilan yang seluruhnya sia-sia.
      if (typeof lama.batalLencana === "function") lama.batalLencana();
      lama.remove();
    }
    document.body.appendChild(elemen);
  });
}

let nomorTerakhir = "";
let sedangAmbil = false;

// ─── Menunggu pengguna masuk portal ──────────────────────────────────────────
//
// Panel yang menampilkan "Masuk ke ALETA" dulu MENGUNCI nomor perkaranya, dan
// penjaga nomorTerakhir memotong setiap pemeriksaan berikutnya. Akibatnya
// petugas yang menuruti ajakan itu - masuk di tab lain, lalu kembali - tetap
// melihat ajakan yang sama, dan satu-satunya jalan keluarnya memuat ulang
// halaman SIPP. Yang tampak: ekstensi tidak bekerja meskipun sudah masuk.
//
// Sekarang panel itu menunggu sendiri. Yang menahan tidak dilepas seluruhnya -
// pemeriksaan berkala tetap dijeda supaya tidak memanggil ALETA tiap detik -
// tetapi kembalinya perhatian ke tab ini memicu pemeriksaan SEKETIKA, karena
// itulah saat yang paling mungkin sesudah orang selesai masuk.

const JEDA_TUNGGU_MASUK = 5000;
let jamTungguMasuk = null;

function mulaiMenungguMasuk() {
  if (jamTungguMasuk) return;
  jamTungguMasuk = setInterval(() => {
    nomorTerakhir = "";
    void segarkan();
  }, JEDA_TUNGGU_MASUK);
}

function berhentiMenungguMasuk() {
  if (!jamTungguMasuk) return;
  clearInterval(jamTungguMasuk);
  jamTungguMasuk = null;
}

/** Perhatian kembali ke tab ini - saat paling mungkin sesudah orang masuk. */
function periksaSegeraBilaMenunggu() {
  if (!jamTungguMasuk) return;
  if (document.visibilityState === "hidden") return;
  nomorTerakhir = "";
  void segarkan();
}

document.addEventListener("visibilitychange", periksaSegeraBilaMenunggu);
window.addEventListener("focus", periksaSegeraBilaMenunggu);
// Disimpan supaya saklar penandaan berlaku seketika tanpa memanggil ALETA
// lagi - data yang sama sudah ada di tangan.
let konteksTerakhir = null;

// Nama dan jabatan pengguna ALETA yang sedang masuk. Panel ini melayang di
// atas halaman SIPP, dan SIPP punya akun sendiri yang belum tentu orang yang
// sama - menyebutkannya membuat perbedaan itu terlihat sebelum ada yang
// terlanjur mengira keduanya satu.
let penggunaTerakhir = null;

/**
 * Kewenangan peran yang sedang masuk, dari rute konteks.
 *
 * null berarti belum terbaca - dan pada keadaan itu menu yang berkewenangan
 * TETAP digambar. Menyembunyikannya saat ragu akan membuat pemasangan baru
 * tampak kehilangan separuh fiturnya, dan yang disalahkan biasanya
 * ekstensinya, bukan jawaban yang belum sampai.
 */
let kapabilitasTerakhir = null;

/** Apakah peran ini boleh memakai satu kemampuan. Ragu berarti boleh. */
function boleh(kunci) {
  if (!kapabilitasTerakhir) return true;
  return kapabilitasTerakhir[kunci] !== false;
}

/**
 * Menyimpan alamat portal ALETA untuk dipakai popup ekstensi.
 *
 * Popup berjalan di origin chrome-extension://, sehingga tautan "/aleta" di
 * sana menunjuk ke dalam ekstensi - dan petugas menerima halaman "Your file
 * couldn't be accessed" alih-alih halaman login.
 *
 * Skrip konten inilah yang tahu alamat sesungguhnya, karena ia berjalan di
 * halaman SIPP. Disimpan lewat penyimpanan bersama, bukan dengan meminta izin
 * "tabs" - izin itu memberi ekstensi kemampuan membaca alamat SELURUH tab
 * peramban, jauh lebih luas daripada yang dibutuhkan.
 */
let asalSudahDicatat = false;

function catatAsalPortal() {
  // Alamatnya tidak berubah sepanjang halaman ini hidup, jadi menuliskannya
  // pada tiap penyegaran hanya menambah kerja tanpa menambah keterangan.
  if (asalSudahDicatat) return;
  asalSudahDicatat = true;
  try {
    void chrome.storage.local.set({ asalPortal: `${location.origin}/aleta` });
  } catch {
    /* penyimpanan tidak tersedia: popup memakai keterangan cadangan */
  }
}

async function segarkan() {
  // Halaman cetak dan templat diperiksa PALING AWAL, sebelum saklar mana
  // pun dibaca. Petugas yang menyalakan penandaan tidak sedang menyetujui
  // keterangan ALETA tercetak di relas panggilan.
  if (halamanCetakAtauTemplat()) return;

  catatAsalPortal();

  if (!(await sedangAktif())) {
    const lama = document.getElementById(PENANDA);
    if (lama) {
      if (typeof lama.batalLencana === "function") lama.batalLencana();
      lama.remove();
    }
    bersihkanTanda();
    nomorTerakhir = "";
    konteksTerakhir = null;
    return;
  }

  const nomor = cariNomorPerkara();
  if (!nomor) {
    // Bukan halaman perkara. Bila ini halaman daftar, barisnya ditandai -
    // itu justru tempat penanda paling berguna: petugas melihat puluhan
    // perkara sekaligus dan langsung tahu mana yang perlu dibuka.
    await tandaiHalamanDaftar();
    return;
  }
  if (nomor === nomorTerakhir || sedangAmbil) return;

  sedangAmbil = true;
  try {
    // Same-origin: cookie sesi portal ikut sendiri, tanpa CORS dan tanpa
    // menyimpan kredensial apa pun di ekstensi.
    const respons = await fetch(`${ALETA_API}?nomor=${encodeURIComponent(nomor)}`, {
      credentials: "include",
      cache: "no-store",
    });

    if (respons.status === 401) {
      nomorTerakhir = nomor;
      tampilkan(susunAjakanMasuk());
      mulaiMenungguMasuk();
      return;
    }

    // 403 berarti sudah masuk tetapi perannya tidak diberi akses - lihat
    // catatan pada susunPanelDitolak.
    if (respons.status === 403) {
      // Sudah masuk, hanya tidak berwenang. Menunggu tidak ada gunanya lagi.
      berhentiMenungguMasuk();
      nomorTerakhir = nomor;
      tampilkan(susunPanelDitolak(await pesanGalat(respons)));
      return;
    }
    if (!respons.ok) return; // Menyerah diam-diam.

    const hasil = await respons.json();
    const isi = hasil?.data ?? hasil;
    if (!isi?.available || !isi?.konteks?.ok) return;

    berhentiMenungguMasuk();
    nomorTerakhir = nomor;
    konteksTerakhir = isi.konteks;
    // Siapa yang sedang memakai ALETA - bukan siapa yang masuk SIPP.
    penggunaTerakhir = isi.pengguna || null;
    // Kewenangan perannya. Menu yang tidak dapat dipakai tidak digambar sama
    // sekali - sebelumnya ia tetap muncul dan baru menolak sesudah ditekan.
    kapabilitasTerakhir = isi.kapabilitas || null;

    // Keadaan lipatan dan posisi dibaca SEBELUM panel digambar, supaya
    // panel tidak sempat berkedip di tempat lama lalu melompat.
    await muatLipatan();
    const posisi = await muatPosisi();

    const panel = susunPanel(isi.konteks);
    tampilkan(panel);
    terapkanPosisi(panel, posisi);
    normalkanJangkar(panel);

    // Perkara tanpa dokumen sama sekali: tawarkan menariknya, jangan
    // biarkan panel kosong tanpa jalan keluar. Perkara yang SUDAH punya
    // dokumen tidak ditawari - penarikan berkala yang mengurusnya, dan
    // tombol yang selalu ada mengundang penekanan tanpa alasan.
    if ((isi.konteks.dokumen || []).length === 0) {
      void sisipkanPermintaan(panel, isi.konteks.nomorPerkara);
    }
    await terapkanTanda(isi.konteks);
  } catch {
    // Jaringan bermasalah, ALETA mati, jawaban bukan JSON - semuanya berakhir
    // sama: tidak menampilkan apa pun. SIPP tetap berjalan seperti biasa.
  } finally {
    sedangAmbil = false;
  }
}

/**
 * SIPP memuat isi tabnya lewat AJAX.
 *
 * Menyisipkan saat halaman siap saja TIDAK cukup - nomor perkara sering baru
 * muncul setelah tab pertama selesai dimuat. Inilah sebab paling umum lapisan
 * semacam ini "kadang muncul kadang tidak".
 *
 * Pengamat dibatasi jedanya supaya perubahan DOM yang beruntun tidak memicu
 * puluhan permintaan.
 */
let jeda = null;

/**
 * ============================================================================
 * SISIPAN ALETA SENDIRI TIDAK BOLEH MEMICU PENYEGARAN
 * ============================================================================
 *
 * Pengamat ini mendengarkan SELURUH isi halaman. Panel, penanda baris, dan
 * sisipan jadwal semuanya ditulis ke dalam halaman yang sama - sehingga tiap
 * kali ALETA menggambar, pengamatnya sendiri terpicu dan menjadwalkan
 * penyegaran berikutnya. Penyegaran itu menggambar lagi, dan seterusnya.
 *
 * Putarannya memang berhenti sendiri - penjaga nomorTerakhir memotongnya -
 * tetapi tidak sebelum beberapa putaran penuh berjalan pada tiap halaman,
 * lengkap dengan pembacaan penyimpanan dan penyapuan seluruh baris tabel.
 * Itulah yang terasa sebagai tersendat.
 *
 * Karena itu perubahan yang berasal DARI DALAM elemen ALETA diabaikan.
 */
function elemenAleta(simpul) {
  if (!simpul || simpul.nodeType !== 1) return false;
  const el = /** @type {Element} */ (simpul);
  if (el.id === PENANDA) return true;
  if (el.hasAttribute && el.hasAttribute(TANDA)) return true;
  const kelas = el.classList;
  return Boolean(kelas && (kelas.contains("aleta-sisip") || kelas.contains("aleta-tanda")));
}

/**
 * Apakah satu perubahan berasal dari ALETA sendiri?
 *
 * Pada perubahan childList, target adalah INDUKNYA - dan induk itu elemen
 * SIPP: panel disisipkan ke body, penanda ke sel tabel, sisipan jadwal ke
 * sel Ruang & Data Persidangan. Memeriksa targetnya saja karena itu tidak
 * menangkap apa pun; yang harus diperiksa simpul yang DITAMBAHKAN.
 */
function perubahanDariAleta(perubahan) {
  if (perubahan.type !== "childList") return elemenAleta(perubahan.target);

  const ditambah = Array.from(perubahan.addedNodes || []);
  const dihapus = Array.from(perubahan.removedNodes || []);
  if (ditambah.length === 0 && dihapus.length === 0) return false;

  // Hanya bila SELURUH simpul yang berubah milik ALETA. Satu simpul SIPP saja
  // sudah cukup menjadikannya perubahan yang perlu ditanggapi.
  return [...ditambah, ...dihapus].every(elemenAleta);
}

const pengamat = new MutationObserver((daftar) => {
  let adaDariSipp = false;
  for (const perubahan of daftar) {
    if (!perubahanDariAleta(perubahan)) {
      adaDariSipp = true;
      break;
    }
  }
  if (!adaDariSipp) return;

  if (jeda) clearTimeout(jeda);
  jeda = setTimeout(() => {
    // Dikerjakan saat peramban senggang, supaya penyapuan tabel tidak pernah
    // bersaing dengan gulir atau ketikan petugas. Peramban lama yang belum
    // punya requestIdleCallback tetap dilayani lewat jalur biasa.
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => void segarkan(), { timeout: 1200 });
    } else {
      void segarkan();
    }
  }, 400);
});

/**
 * Menjalankan penggambaran ALETA dengan pengamat DILEPAS.
 *
 * Penyaring di atas sudah menutup sebagian besar jalannya, tetapi ia bersandar
 * pada pengenalan tiap simpul - dan simpul yang terlewat mengenali dirinya
 * akan memicu putaran gambar-amati-gambar lagi. Melepas pengamat selama
 * menggambar menutup jalan itu seluruhnya, bukan sebagian.
 */
function tanpaPengamat(kerja) {
  pengamat.disconnect();
  try {
    kerja();
  } finally {
    // Perubahan yang menumpuk selama dilepas sengaja TIDAK diambil kembali:
    // itulah justru perubahan buatan ALETA sendiri.
    pengamat.takeRecords();
    pengamat.observe(document.body, { childList: true, subtree: true });
  }
}
pengamat.observe(document.body, { childList: true, subtree: true });

// Saklar dari popup berlaku seketika, tanpa memuat ulang halaman SIPP.
// Memuat ulang halaman kerja orang hanya karena sebuah saklar ditekan adalah
// gangguan yang tidak perlu - dan menghindarinya juga menghemat satu izin.
chrome.storage.onChanged.addListener((perubahan, wilayah) => {
  if (wilayah !== "local") return;

  // Salinan di memori diperbarui lebih dulu - itulah yang dibaca seluruh
  // pemeriksaan di bawah, dan membiarkannya basi berarti saklarnya seolah
  // tidak berfungsi sampai halaman dimuat ulang.
  if (perubahan.aktif) saklar.aktif = perubahan.aktif.newValue !== false;
  if (perubahan.tandaiHalaman) saklar.tandaiHalaman = perubahan.tandaiHalaman.newValue === true;
  if (perubahan.sisipJadwal) saklar.sisipJadwal = perubahan.sisipJadwal.newValue === true;

  if (perubahan.aktif) {
    nomorTerakhir = "";
    void segarkan();
    return;
  }

  // Saklar penandaan tidak perlu memanggil ALETA lagi: konteks perkara yang
  // sedang dibuka masih tersimpan.
  if (perubahan.tandaiHalaman || perubahan.sisipJadwal) {
    if (konteksTerakhir) void terapkanTanda(konteksTerakhir);
    else bersihkanTanda();
  }
});

void segarkan();
