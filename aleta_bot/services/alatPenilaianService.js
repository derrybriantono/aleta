"use strict";

/**
 * ============================================================================
 * DUA PULUH ALAT DI DALAM PENILAIAN
 * ============================================================================
 *
 * Alat-alat ini menempel pada SETIAP layar penilaian - bukan menjadi menu
 * tersendiri di sisi kiri. Perbedaan itu penting dan pernah keliru dikerjakan:
 * dibuat sebagai menu, semuanya menjadi halaman yang harus dibuka satu per
 * satu, padahal gunanya justru hadir bersama angka yang sedang dilihat.
 *
 * ============================================================================
 * TIAP ALAT PUNYA DUA SISI, DAN KEDUANYA HARUS ADA
 * ============================================================================
 *
 * Sisi MESIN menghitung atau menyimpan; sisi LAYAR menggambar. Alat yang
 * mesinnya sudah ada tetapi layarnya belum tidak berguna bagi siapa pun -
 * angkanya terhitung tetapi tak terlihat. Sebaliknya, layar tanpa mesin akan
 * menggambar sesuatu yang dikarang.
 *
 * Karena itu tiap alat mencatat kedua sisinya terpisah, dan keadaannya
 * DIHITUNG dari situ - bukan ditulis sebagai "selesai" atau "belum".
 *
 * ============================================================================
 * YANG BELUM DIKERJAKAN MENYEBUTKAN SEBABNYA
 * ============================================================================
 *
 * Bukan "belum sempat", melainkan apa yang menghalangi. Delapan alat yang
 * belum lengkap di sini masing-masing menyebutkan apa yang dibutuhkannya
 * lebih dahulu - dan sebagian menunggu keputusan orang, bukan menunggu kode.
 */

const path = require("path");
const fs = require("fs");

const AKAR_BOT = path.resolve(__dirname, "..");
const AKAR_PORTAL = path.resolve(__dirname, "..", "..", "manajemen_surat");

/**
 * Dua puluh alat.
 *
 *   mesin  - berkas layanan di sisi bot yang menopangnya, atau null
 *   layar  - berkas komponen di sisi portal yang menggambarnya, atau null
 *   petunjuk - teks yang harus ADA di berkas layar itu; tanpa ini, berkas yang
 *              kebetulan bernama benar dianggap cukup padahal isinya lain
 *   sebab  - apa yang menghalangi, bila belum lengkap
 */
const ALAT = [
  {
    kode: "D01",
    nama: "Pintu Masuk dari Nomor Perkara",
    letak: "kronologi perkara",
    keterangan: "Pada kronologi sebuah perkara tampil panel 'perkara ini pada penilaian lain'.",
    mesin: null,
    layar: null,
    sebab:
      "Menuntut pencarian balik: dari satu nomor perkara ke seluruh penilaian yang memuatnya. Baru dapat dikerjakan sesudah cukup banyak butir tersambung - dengan dua butir, panelnya hampir selalu kosong dan justru menyesatkan.",
  },
  {
    kode: "D02",
    nama: "Hak Jawab pada Baris",
    letak: "tabel rincian",
    keterangan: "Tombol catatan penjelasan pada tiap baris temuan, berpenulis dan bertanggal.",
    mesin: "services/catatanPenilaianService.js",
    layar: null,
    sebab: "Sisi mesin siap. Layarnya menunggu tabel rincian yang dapat menerima catatan per baris.",
  },
  {
    kode: "D03",
    nama: "Ambang dan Dasar Hukum",
    letak: "kaki penilaian",
    keterangan: "Kaki penilaian menyebut ambang yang dipakai beserta dasar hukumnya.",
    mesin: "services/ambangPenilaianService.js",
    layar: "src/components/portal/penilaian-hasil.tsx",
    petunjuk: "Ambang yang dipakai",
    sebab: "",
  },
  {
    kode: "D04",
    nama: "Penanda Titik Balik",
    letak: "diagram garis",
    keterangan: "Garis pada diagram garis, menandai sejak kapan nilai berbalik arah.",
    mesin: null,
    layar: "src/components/portal/bentuk-sajian.tsx",
    petunjuk: "peristiwa",
    sebab:
      "Layarnya sudah dapat menggambar penanda pada sumbu waktu. Yang belum: mesin yang MENEMUKAN titik baliknya. Menandai titik balik yang keliru lebih buruk daripada tidak menandai sama sekali.",
  },
  {
    kode: "D05",
    nama: "Sanding Berdampingan",
    letak: "panel atas",
    keterangan: "Panel pembanding: periode lain, majelis lain, atau rerata riwayat sendiri.",
    mesin: "services/penyandinganService.js",
    layar: "src/components/portal/penilaian-hasil.tsx",
    petunjuk: "disandingkan",
    sebab: "",
  },
  {
    kode: "D06",
    nama: "Lencana Ketergantungan",
    letak: "kepala penilaian",
    keterangan: "Tanda pada kepala penilaian bila nilai hulunya belum bersih.",
    mesin: "services/sasaranKinerjaService.js",
    layar: null,
    sebab: "Sisi mesin siap. Layarnya menunggu butir yang benar-benar punya hulu - dengan dua butir tersambung, belum ada rantai hulu-hilir yang nyata.",
  },
  {
    kode: "D07",
    nama: "Dampak bila Dibereskan",
    letak: "tabel rincian",
    keterangan: "Kolom pada tabel: berapa poin nilai naik bila baris ini diselesaikan.",
    mesin: "services/ketelitianNilaiService.js",
    layar: null,
    sebab: "Sisi mesin siap (dampakSatuBaris, urutanPengerjaan). Layarnya menunggu tabel rincian berkolom tambahan.",
  },
  {
    kode: "D08",
    nama: "Ekspor Blangko Resmi",
    letak: "bilah alat",
    keterangan: "Tombol cetak pada tiap penilaian, berkaki tanggal hitung dan ambang.",
    mesin: null,
    layar: "src/components/portal/bentuk-sajian.tsx",
    petunjuk: "BentukResmi",
    sebab:
      "Bentuk resminya sudah dapat digambar beserta kakinya. Yang belum: tombol yang mencetaknya dari layar penilaian.",
  },
  {
    kode: "D09",
    nama: "Kirim ke Penanggung Jawab",
    letak: "tabel dan bilah pilih",
    keterangan: "Tombol kirim pada baris dan pada kumpulan baris terpilih.",
    mesin: null,
    layar: null,
    sebab:
      "Menuntut keputusan orang lebih dahulu: siapa penanggung jawab tiap jenis temuan, dan lewat saluran apa dikirim. Membangunnya sebelum itu berarti menebak kepada siapa temuan dikirimkan.",
  },
  {
    kode: "D10",
    nama: "Penanda Cakupan Data",
    letak: "angka pokok",
    keterangan: "Keterangan di bawah angka pokok: dihitung dari berapa persen populasi.",
    mesin: "services/cakupanDataService.js",
    layar: "src/components/portal/bentuk-sajian.tsx",
    petunjuk: "cakupan",
    sebab: "",
  },
  {
    kode: "D11",
    nama: "Cara Hitung Terbuka",
    letak: "panel atas",
    keterangan: "Panel rumus: pembilang, penyebut, pengecualian, tabel dan ruas SIPP sumbernya.",
    mesin: "services/kerangkaPenilaianService.js",
    layar: "src/components/portal/penilaian-hasil.tsx",
    petunjuk: "Cara hitung",
    sebab: "",
  },
  {
    kode: "D12",
    nama: "Penyaring di Dalam Penilaian",
    letak: "panel atas",
    keterangan: "Pemotong data tanpa meninggalkan layar, menyebut sisa penyebutnya.",
    mesin: null,
    layar: null,
    sebab:
      "Menuntut tiap penilaian menyatakan ruas apa saja yang boleh dipakai menyaring. Menyaring dengan ruas sembarang menghasilkan penyebut yang tidak dapat diterangkan - dan penyebut yang tidak dapat diterangkan membatalkan seluruh angkanya.",
  },
  {
    kode: "D13",
    nama: "Keadaan Tindak Lanjut",
    letak: "tabel rincian",
    keterangan: "Tiap baris punya keadaan pengerjaan, bukan hanya keadaan nilai.",
    mesin: "services/catatanPenilaianService.js",
    layar: null,
    sebab: "Sisi mesin siap (keadaanTindakLanjut). Layarnya menunggu tabel rincian yang dapat menerima keadaan per baris.",
  },
  {
    kode: "D14",
    nama: "Disposisi Pimpinan",
    letak: "kaki penilaian",
    keterangan: "Kolom disposisi pada layar penilaian, ikut tercetak pada ekspor.",
    mesin: "services/catatanPenilaianService.js",
    layar: null,
    sebab: "Sisi mesin siap. Layarnya menunggu bersama D08 - disposisi baru berarti bila ikut tercetak.",
  },
  {
    kode: "D15",
    nama: "Sasaran Kinerja",
    letak: "angka pokok dan diagram",
    keterangan: "Garis sasaran pada diagram dan kolom selisih terhadap sasaran.",
    mesin: "services/sasaranKinerjaService.js",
    layar: "src/components/portal/bentuk-sajian.tsx",
    petunjuk: "sasaran",
    sebab: "",
  },
  {
    kode: "D16",
    nama: "Riwayat Ringkas dalam Baris",
    letak: "tabel rincian",
    keterangan: "Garis mini di dalam sel: dua belas periode terakhir baris itu.",
    mesin: "services/riwayatNilaiService.js",
    layar: "src/components/portal/bentuk-sajian.tsx",
    petunjuk: "GarisMini",
    sebab: "",
  },
  {
    kode: "D17",
    nama: "Rentang Keyakinan",
    letak: "angka pokok dan tabel",
    keterangan: "Nilai berpenyebut kecil disertai rentangnya, agar tidak dibaca pasti.",
    mesin: "services/ketelitianNilaiService.js",
    layar: "src/components/portal/bentuk-sajian.tsx",
    petunjuk: "rentang",
    sebab: "",
  },
  {
    kode: "D18",
    nama: "Anotasi Peristiwa",
    letak: "diagram garis",
    keterangan: "Penanda pada sumbu waktu: mutasi, libur, gangguan SIPP, perubahan wilayah.",
    mesin: "services/catatanPenilaianService.js",
    layar: "src/components/portal/bentuk-sajian.tsx",
    petunjuk: "PenandaPeristiwa",
    sebab: "",
  },
  {
    kode: "D19",
    nama: "Pilih Beberapa Baris",
    letak: "tabel rincian",
    keterangan: "Kotak centang, lalu bandingkan, tugaskan, atau ekspor sekaligus.",
    mesin: null,
    layar: null,
    sebab: "Menunggu D09 - memilih beberapa baris baru berguna bila ada yang dapat dikerjakan atas pilihan itu.",
  },
  {
    kode: "D20",
    nama: "Bagikan dan Tayangkan",
    letak: "bilah alat",
    keterangan: "Tautan keadaan layar, dan tampilan huruf besar untuk rapat pengawasan.",
    mesin: null,
    layar: null,
    sebab:
      "Tautan keadaan layar menuntut seluruh pilihan tersimpan pada alamat - jendela periode, tanggal acuan, penyaring. Dikerjakan sesudah D12, supaya tidak dua kali menyusun bentuk alamatnya.",
  },
];

const LETAK_SAH = new Set([
  "kronologi perkara",
  "tabel rincian",
  "kaki penilaian",
  "diagram garis",
  "panel atas",
  "kepala penilaian",
  "bilah alat",
  "angka pokok",
  "angka pokok dan tabel",
  "angka pokok dan diagram",
  "tabel dan bilah pilih",
]);

function adaBerkas(akar, relatif) {
  return Boolean(relatif) && fs.existsSync(path.join(akar, relatif));
}

/**
 * Keadaan sebuah alat - dihitung dari berkas yang benar-benar ada.
 *
 * "siap" hanya bila KEDUA sisinya ada DAN berkas layarnya benar-benar memuat
 * petunjuknya. Berkas yang kebetulan ada tetapi tidak memuat apa pun yang
 * berhubungan bukan bukti bahwa alatnya tergambar.
 */
function keadaanAlat(a) {
  const mesinAda = adaBerkas(AKAR_BOT, a.mesin);
  const layarAda = adaBerkas(AKAR_PORTAL, a.layar);

  let layarBerisi = layarAda;
  if (layarAda && a.petunjuk) {
    const isi = fs.readFileSync(path.join(AKAR_PORTAL, a.layar), "utf8");
    layarBerisi = isi.includes(a.petunjuk);
  }

  let keadaan;
  if (mesinAda && layarBerisi) keadaan = "siap";
  else if (mesinAda || layarBerisi) keadaan = "sebelah";
  else keadaan = "belum";

  return {
    kode: a.kode,
    nama: a.nama,
    letak: a.letak,
    keterangan: a.keterangan,
    mesin: a.mesin,
    layar: a.layar,
    mesinAda,
    layarAda: layarBerisi,
    keadaan,
    sebab: keadaan === "siap" ? "" : a.sebab,
  };
}

function daftar() {
  return ALAT.map(keadaanAlat);
}

function ringkas() {
  const d = daftar();
  const hitung = (k) => d.filter((x) => x.keadaan === k).length;
  return {
    jumlah: d.length,
    siap: hitung("siap"),
    sebelah: hitung("sebelah"),
    belum: hitung("belum"),
  };
}

function alat(kode) {
  const k = String(kode || "").trim().toUpperCase();
  const a = ALAT.find((x) => x.kode === k);
  return a ? keadaanAlat(a) : null;
}

/** Cela pada daftar alat itu sendiri. */
function celaAlat() {
  const cela = [];
  const terlihat = new Set();

  ALAT.forEach((a, i) => {
    const di = `alat ke-${i + 1} (${a.kode})`;
    if (!/^D\d{2}$/.test(a.kode)) cela.push(`${di}: kode tidak berbentuk D dan dua angka`);
    if (terlihat.has(a.kode)) cela.push(`${di}: kode kembar`);
    terlihat.add(a.kode);

    if (!a.nama || a.nama.length < 5) cela.push(`${di}: nama terlalu pendek`);
    if (!a.keterangan || a.keterangan.length < 20) cela.push(`${di}: keterangan terlalu pendek`);
    if (!LETAK_SAH.has(a.letak)) cela.push(`${di}: letak "${a.letak}" tidak dikenali`);

    // Inilah pemeriksaan yang menjaga kejujurannya: alat yang belum lengkap
    // WAJIB menyebutkan apa yang menghalanginya. "Belum sempat" bukan sebab.
    const k = keadaanAlat(a);
    if (k.keadaan !== "siap" && (!a.sebab || a.sebab.length < 40)) {
      cela.push(`${di}: belum lengkap tetapi tidak menyebutkan apa yang menghalanginya`);
    }
    if (k.keadaan === "siap" && a.sebab) {
      cela.push(`${di}: sudah siap tetapi masih membawa sebab yang menghalangi`);
    }
    if (a.layar && !a.petunjuk) {
      cela.push(`${di}: menyebut berkas layar tanpa petunjuk isinya - berkas yang kebetulan ada bukan bukti`);
    }
  });

  if (ALAT.length !== 20) cela.push(`jumlah alat ${ALAT.length}, seharusnya dua puluh`);

  return cela;
}

module.exports = { ALAT, LETAK_SAH, daftar, ringkas, alat, celaAlat };
