"use strict";

/**
 * Menavigasi daftar perkara e-Court.
 *
 * ============================================================================
 * KENAPA MODUL INI ADA
 * ============================================================================
 *
 * Alamat halaman e-Court BURAM. Alamat detail satu perkara berbentuk
 *
 *     /view_detil_pendaftaran/YTllOTE3Nzg5YTI4YWZkZWQyM2Q2ZjFjYmE0NTEyZDg3...
 *
 * yaitu blob terenkripsi, bukan id yang dapat disusun. Artinya ALETA tidak akan
 * pernah bisa MEMBUAT alamat untuk satu perkara - ia harus menemukannya dari
 * halaman daftar.
 *
 * ============================================================================
 * MENYAPU, BUKAN MENCARI SATU PER SATU
 * ============================================================================
 *
 * Halaman daftar memuat kolom "Kode & Tanggal Register" pada baris yang sama
 * dengan tautan detailnya. Jadi satu sapuan daftar sudah menghasilkan peta
 * lengkap nomor_register -> alamat detail.
 *
 * Untuk 867 perkara, bedanya besar bagi server Mahkamah Agung:
 *
 *     mencari satu per satu : 867 pencarian + 867 halaman detail
 *     menyapu daftar        : 9 halaman, lalu detail hanya seperlunya
 *
 * ============================================================================
 * BATAS YANG TIDAK BOLEH DILANGGAR
 * ============================================================================
 *
 * Modul ini HANYA menyentuh halaman DAFTAR. Halaman detail perkara memuat
 * tombol "Batal Verifikasi" dan "Hapus Tundaan Sidang" - tombol yang mengubah
 * keadaan resmi perkara. Satu klik yang salah di sana akan tercatat sebagai
 * perbuatan hakim pemilik akun.
 *
 * Karena itu di halaman detail, jembatan tidak pernah mengklik apa pun sama
 * sekali; berkas diambil dengan fetch ke alamatnya langsung. Modul ini menjaga
 * pemisahan itu: seluruh interaksinya berhenti di halaman daftar.
 */

const scraper = require("./scraper");

/** Jeda antar halaman daftar, mengikuti kesopanan yang sama dengan run.js. */
const JEDA_DAFTAR_MS = Number(process.env.ALETA_ECOURT_DAFTAR_DELAY_MS || 1200);

/** Batas menunggu tabel selesai menggambar ulang. */
const TUNGGU_TABEL_MS = Number(process.env.ALETA_ECOURT_TUNGGU_TABEL_MS || 20000);

/** Berapa halaman daftar paling banyak disapu per kategori. */
const MAKS_HALAMAN = Number(process.env.ALETA_ECOURT_MAKS_HALAMAN_DAFTAR || 40);

const tidur = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Kode alur perkara SIPP -> label menu e-Court.
 *
 * Diambil dari tabel alur_perkara pada SIPP peradilan agama. Nomor perkara
 * TIDAK diurai untuk menentukan ini: SIPP sudah menyimpannya sebagai data, dan
 * mengurai teks hanya menambah satu tempat lagi yang bisa salah.
 */
const MENU_PER_ALUR = {
  "PDT.G": "gugatan",
  "PDT.P": "permohonan",
  "PDT.G.S": "gugatan sederhana",
  JN: "jinayat",
};

/** Alur perkara -> kata kunci menu, dari kode maupun namanya. */
function menuUntukAlur(alurKode, alurNama) {
  const kode = String(alurKode || "").trim().toUpperCase();
  if (MENU_PER_ALUR[kode]) return MENU_PER_ALUR[kode];

  const nama = String(alurNama || "").trim().toLowerCase();
  if (nama.includes("sederhana")) return "gugatan sederhana";
  if (nama.includes("permohonan")) return "permohonan";
  if (nama.includes("gugatan")) return "gugatan";
  if (nama.includes("jinayat")) return "jinayat";
  return "";
}

/**
 * Membaca menu "Daftar Perkara" dari halaman, bukan dari alamat yang ditanam.
 *
 * Blob pada /pendaftaran/<blob> mungkin terikat sesi. Menanamnya di kode berarti
 * jembatan mati tanpa sebab yang jelas begitu blob itu berputar. Membacanya dari
 * DOM selalu segar dan tidak peduli blob-nya berganti.
 */
async function bacaMenuDaftarPerkara(page) {
  const tautan = await page.evaluate(() => {
    const hasil = [];
    for (const a of Array.from(document.querySelectorAll("a[href]"))) {
      const href = a.getAttribute("href") || "";
      if (!href.includes("/pendaftaran/")) continue;
      const label = String(a.textContent || "").replace(/\s+/g, " ").trim();
      if (!label) continue;
      hasil.push({ label, href: a.href });
    }
    return hasil;
  });

  const peta = new Map();
  for (const item of tautan) {
    const kunci = item.label.toLowerCase();
    if (!peta.has(kunci)) peta.set(kunci, item.href);
  }
  return peta;
}

/**
 * Mencocokkan kata kunci menu ke tautan yang terbaca.
 *
 * Pencocokannya SIMETRIS: label menu diklasifikasikan dengan aturan yang sama
 * seperti alur perkara, lalu dibandingkan hasilnya. Pencocokan "mengandung"
 * yang lugu berbahaya di sini - mencari "gugatan" akan menangkap "Gugatan
 * Sederhana" bila kebetulan label itu lebih dulu di halaman, dan perkara pun
 * ditarik dari daftar yang salah.
 */
function pilihTautanMenu(menu, kataKunci) {
  if (!kataKunci) return "";
  if (menu.has(kataKunci)) return menu.get(kataKunci);

  for (const [label, href] of menu.entries()) {
    if (menuUntukAlur("", label) === kataKunci) return href;
  }
  return "";
}

/** Menaikkan jumlah entri per halaman agar sapuannya sesedikit mungkin. */
async function perbesarHalaman(page) {
  return page
    .evaluate(() => {
      const pilihan = document.querySelector('select[name$="_length"], .dataTables_length select');
      if (!pilihan) return 0;

      // Nilai terbesar yang memang ditawarkan halaman. Tidak memaksakan angka
      // sendiri: DataTables menolak nilai di luar daftarnya, dan memaksanya
      // hanya menghasilkan tabel kosong.
      let terbesar = 0;
      for (const opsi of Array.from(pilihan.options)) {
        const angka = Number(opsi.value);
        if (Number.isFinite(angka) && angka > terbesar) terbesar = angka;
      }
      if (!terbesar) return 0;

      pilihan.value = String(terbesar);
      pilihan.dispatchEvent(new Event("change", { bubbles: true }));
      return terbesar;
    })
    .catch(() => 0);
}

/** Membaca pasangan nomor register dan alamat detail dari baris tabel. */
async function bacaBarisDaftar(page) {
  return page
    .evaluate(() => {
      const hasil = [];
      for (const baris of Array.from(document.querySelectorAll("tr"))) {
        const tautan = baris.querySelector('a[href*="view_detil_pendaftaran"]');
        if (!tautan) continue;

        // Nomor register adalah teks tautannya sendiri - persis kolom
        // "Kode & Tanggal Register" pada halaman daftar.
        const teks = String(tautan.textContent || "").replace(/\s+/g, " ").trim();
        const kode = (teks.match(/[A-Z]{2}\.[A-Z]{3}-[A-Za-z0-9]+/) || [])[0] || "";
        hasil.push({ nomorRegister: kode, url: tautan.href });
      }
      return hasil;
    })
    .catch(() => []);
}

/** Menekan tombol "Next" bila masih ada halaman berikutnya. */
async function halamanBerikutnya(page) {
  return page
    .evaluate(() => {
      const tombol = document.querySelector(".paginate_button.next, li.next a, a.paginate_button.next");
      if (!tombol) return false;
      const mati =
        tombol.classList.contains("disabled") ||
        (tombol.parentElement && tombol.parentElement.classList.contains("disabled"));
      if (mati) return false;
      tombol.click();
      return true;
    })
    .catch(() => false);
}

/**
 * Menunggu tabel benar-benar berganti isi, bukan menunggu sekian detik.
 *
 * Menunggu dengan waktu tetap adalah kekeliruan yang mahal di sini. e-Court
 * lambat - satu halaman kategori butuh 5 sampai 9 detik - dan tabelnya
 * menggambar ulang lewat AJAX. Jeda tetap 1,2 detik membuat pembacaan terjadi
 * sebelum gambarnya selesai, sehingga yang terbaca adalah isi halaman
 * SEBELUMNYA.
 *
 * Akibatnya tidak terlihat sebagai galat sama sekali: 40 halaman terbaca, tiap
 * halaman melaporkan 10 baris, dan totalnya tetap 10 karena baris yang sama
 * dibaca berulang. Sapuan seolah berhasil padahal hanya menyentuh halaman
 * pertama.
 *
 * Karena itu yang ditunggu adalah PERUBAHANNYA: sidik jari isi tabel dipantau
 * sampai berbeda, atau sampai batas waktu habis.
 */
async function sidikJariTabel(page) {
  return page
    .evaluate(() => {
      const tautan = Array.from(document.querySelectorAll('a[href*="view_detil_pendaftaran"]'));
      const info = document.querySelector(".dataTables_info");
      return [
        info ? String(info.textContent || "").replace(/\s+/g, " ").trim() : "",
        tautan.length,
        tautan.length ? String(tautan[0].getAttribute("href") || "") : "",
        tautan.length ? String(tautan[tautan.length - 1].getAttribute("href") || "") : "",
      ].join("|");
    })
    .catch(() => "");
}

async function tungguTabelBerubah(page, sidikSebelum, batasMs = TUNGGU_TABEL_MS) {
  const mulai = Date.now();
  while (Date.now() - mulai < batasMs) {
    await tidur(400);

    // Selama DataTables masih menampilkan "Processing", jangan dibaca dulu -
    // isinya masih isi lama.
    const sibuk = await page
      .evaluate(() => {
        const proses = document.querySelector(".dataTables_processing");
        if (!proses) return false;
        const gaya = window.getComputedStyle(proses);
        return gaya.display !== "none" && gaya.visibility !== "hidden";
      })
      .catch(() => false);
    if (sibuk) continue;

    const sekarang = await sidikJariTabel(page);
    if (sekarang && sekarang !== sidikSebelum) return true;
  }
  return false;
}

/**
 * Menyapu seluruh halaman daftar satu kategori.
 *
 * Mengembalikan peta nomor_register -> alamat detail. Perkara tanpa nomor
 * register yang terbaca tetap disertakan dengan kunci alamatnya, supaya tidak
 * hilang - memadankannya urusan pemanggil.
 */
async function sapuDaftar(page, catat = () => {}) {
  const peta = new Map();

  // Tabel bisa saja belum tergambar saat halaman baru selesai dimuat.
  await tungguTabelBerubah(page, "", TUNGGU_TABEL_MS);

  const sebelumPerbesar = await sidikJariTabel(page);
  const perbesar = await perbesarHalaman(page);
  if (perbesar) {
    const berubah = await tungguTabelBerubah(page, sebelumPerbesar);
    catat(
      `  Entri per halaman dinaikkan ke ${perbesar}${berubah ? "." : " (tabel tidak menggambar ulang)."}`
    );
  }

  for (let halaman = 1; halaman <= MAKS_HALAMAN; halaman += 1) {
    const baris = await bacaBarisDaftar(page);
    let baru = 0;
    for (const item of baris) {
      const kunci = item.nomorRegister || item.url;
      if (peta.has(kunci)) continue;
      peta.set(kunci, item.url);
      baru += 1;
    }
    catat(`  Halaman ${halaman}: ${baris.length} baris, ${baru} baru (total ${peta.size}).`);

    if (baris.length === 0) break;

    // Halaman yang tidak menyumbang satu pun baris baru berarti kita membaca
    // isi yang sama lagi. Meneruskannya hanya membuang waktu dan membebani
    // server Mahkamah Agung tanpa hasil.
    if (baru === 0 && halaman > 1) {
      catat("  Tidak ada baris baru, sapuan dihentikan.");
      break;
    }

    const sebelum = await sidikJariTabel(page);
    const lanjut = await halamanBerikutnya(page);
    if (!lanjut) break;

    const berubah = await tungguTabelBerubah(page, sebelum);
    if (!berubah) {
      catat("  Halaman berikutnya tidak kunjung tergambar, sapuan dihentikan.");
      break;
    }
  }

  return peta;
}
/**
 * Mencari satu perkara lewat kotak pencarian daftar.
 *
 * Dipakai untuk penarikan tertarget - satu perkara sesuai permintaan - bukan
 * untuk penarikan berkala. Menyapu daftar jauh lebih hemat bila yang dicari
 * banyak.
 */
async function cariPerkara(page, nomorRegister) {
  const kata = String(nomorRegister || "").trim();
  if (!kata) return "";

  const terisi = await page
    .evaluate((nilai) => {
      const kotak = document.querySelector('.dataTables_filter input[type="search"], input[aria-controls^="table_"]');
      if (!kotak) return false;
      kotak.value = nilai;
      kotak.dispatchEvent(new Event("keyup", { bubbles: true }));
      kotak.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }, kata)
    .catch(() => false);

  if (!terisi) return "";
  await tidur(JEDA_DAFTAR_MS);

  const baris = await bacaBarisDaftar(page);
  const cocok = baris.find(
    (item) => item.nomorRegister.toUpperCase() === kata.toUpperCase()
  );

  // Hanya kecocokan PERSIS yang diterima. Pencarian DataTables mencocokkan
  // sebagian, dan mengambil baris pertama begitu saja berarti menarik dokumen
  // perkara yang salah - lalu mengirimkannya ke pihak yang salah.
  return cocok ? cocok.url : "";
}

module.exports = {
  JEDA_DAFTAR_MS,
  MAKS_HALAMAN,
  MENU_PER_ALUR,
  bacaBarisDaftar,
  bacaMenuDaftarPerkara,
  cariPerkara,
  menuUntukAlur,
  perbesarHalaman,
  pilihTautanMenu,
  sapuDaftar,
  sidikJariTabel,
  tungguTabelBerubah,
  TUNGGU_TABEL_MS,
  scraperVersi: typeof scraper.BASE_URL === "string" ? scraper.BASE_URL : "",
};
