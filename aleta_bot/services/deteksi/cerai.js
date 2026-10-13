"use strict";

/**
 * ============================================================================
 * DETEKSI CERAI GUGAT / CERAI TALAK (+ kumulasi) - 13 Okt 2026, butir 16
 * ============================================================================
 *
 * Variabel isian blangko Derry cerai (folder "1 Perceraian CG", "1a Perceraian
 * CT", BAS contra/verstek, ALUR 01-10; inventaris 13 Okt di server) dipetakan ke
 * sumbernya di VARIABEL. Sebagian besar sudah diisi jalur lama (alasan & waktu
 * dari posita/saksi: abtUsulanService; tempat tinggal: deteksiTempatTinggalService;
 * tuntutan accessoir & kuasa: isiGugatanService/abtUsulanService; tanggal KTP di
 * alat bukti: ekstensi). Berkas ini menambah yang BELUM terbaca padahal
 * tertulis di posita:
 *
 *   5105  tempat menikah   "Bahwa ... #0046# dan #0047# ... menikah pada tanggal #1011# di #5105#"
 *   0007  anak             "sudah berhubungan layaknya suami isteri dan #0007#"
 *   1267  komunikasi       "Bahwa selama pisah #0046# dan #0047# #1267#"
 *
 * Kumulasi cerai + itsbat (folder 1c) memakai jalur itsbat (deteksi/itsbat.js)
 * lewat tombol itsbat (blangkonya memuat #5197#/#8087#); #1002# di sana = status
 * pihak #0046# (Penggugat = istri) - lihat deteksi/itsbat.js.
 *
 * Murni: tidak menulis, tidak membaca basis data.
 */

const wilayah = require("./wilayah");
const itsbat = require("./itsbat");

const P = "posita";
/** Peta variabel isian blangko cerai -> sumber (yang `dihitung-abt` tidak diisi ALETA). */
const VARIABEL = Object.freeze([
  { kode: "0222", nama: "Awal konflik", sumber: `${P}+saksi`, oleh: "abtUsulanService" },
  { kode: "0246", nama: "Pisah rumah sejak", sumber: `${P}+saksi`, oleh: "abtUsulanService" },
  { kode: "9944", nama: "Lama pisah", sumber: `${P}+saksi`, oleh: "abtUsulanService" },
  { kode: "7035", nama: "Yang meninggalkan kediaman", sumber: `${P}+saksi`, oleh: "abtUsulanService" },
  { kode: "1268", nama: "Upaya damai keluarga", sumber: `${P}+saksi`, oleh: "abtUsulanService" },
  { kode: "5227", nama: "Alasan-alasan cerai", sumber: `${P}+berkas-ecourt`, oleh: "abtUsulanService/isiGugatanService" },
  { kode: "8503", nama: "Huruf alasan perceraian", sumber: "saksi-sipp+posita", oleh: "ekstensi (8503)" },
  { kode: "5127", nama: "Penyebab bertengkar (BAS saksi)", sumber: "salinan 5227", oleh: "deteksi/cerai.js (rute)" },
  { kode: "1006", nama: "Tempat tinggal setelah nikah", sumber: `${P}+saksi`, oleh: "deteksiTempatTinggalService" },
  { kode: "8570", nama: "Kediaman bersama terakhir", sumber: `${P}+saksi`, oleh: "deteksiTempatTinggalService" },
  { kode: "5105", nama: "Alamat tempat menikah", sumber: P, oleh: "deteksi/cerai.js" },
  { kode: "0007", nama: "Telah dikaruniai anak", sumber: `${P}+berkas-ecourt`, oleh: "deteksi/cerai.js, isiGugatanService" },
  { kode: "1267", nama: "Masih/tidak komunikasi", sumber: P, oleh: "deteksi/cerai.js" },
  { kode: "0156", nama: "Kantor kuasa Penggugat", sumber: "berkas-ecourt+sipp", oleh: "abtUsulanService (kuasa)" },
  { kode: "0132", nama: "Tgl. register kuasa", sumber: "sipp", oleh: "abtUsulanService (kuasa)" },
  { kode: "0184", nama: "Tgl. surat kuasa", sumber: "berkas-ecourt", oleh: "ekstensi (kuasa)" },
  { kode: "6054", nama: "Nafkah iddah / 6055 mut'ah / 6071-6072 nafkah anak / 7120 madliyah", sumber: "petitum+berkas-ecourt", oleh: "isiGugatanService" },
  { kode: "0709", nama: "Hadhanah (pemegang hak asuh) / 0711 / 2004 / 5110 / 5171", sumber: "petitum+posita", oleh: "deteksi/hadhanah.js, isiGugatanService" },
  { kode: "1214", nama: "Alat bukti CG/CT (bagian tanggal KTP) / 9955 / 9911", sumber: "ktp-ecourt", oleh: "ekstensi (KTP-TEKS)" },
  { kode: "2557", nama: "Berapa kali saksi melihat bertengkar (2558)", sumber: "saksi-sipp", oleh: "belum - tidak tertulis di posita" },
  { kode: "8433", nama: "Alasan cabut", sumber: "sipp (penetapan cabut)", oleh: "belum - tidak tertulis di posita" },
  { kode: "8436", nama: "Kesimpulan Penggugat / 8437 Tergugat", sumber: "berkas-ecourt (kesimpulan)", oleh: "belum" },
  { kode: "7178", nama: "Status panggilan tidak patut", sumber: "relaas", oleh: "belum" },
  { kode: "0157", nama: "Kantor kuasa Tergugat / 0185 tgl kuasa Tergugat", sumber: "sipp", oleh: "belum (jarang: 1 perkara)" },
  { kode: "1183", nama: "Tgl. batas waktu ikrar talak", sumber: "dihitung (BHT + 6 bulan)", oleh: "belum" },
]);

const POLA_NIKAH = /\b(menikah|pernikahan|perkawinan|akad\s+nikah|melangsungkan\s+(?:pernikahan|perkawinan))\b/i;
/** Kalimat yang bercerita tentang tempat TINGGAL, bukan tempat menikah. */
const POLA_TINGGAL = /\b(tinggal|bertempat|kediaman|rumah\s+(?:orang\s*tua|kontrakan|bersama|sendiri)|membina\s+rumah\s+tangga|pindah|menetap)\b/i;

/**
 * Tempat menikah pada posita cerai. Lain dari itsbat: kalimat pertama yang
 * menyebut pernikahan + wilayah dan TIDAK bercerita tentang tempat tinggal
 * ("setelah menikah Penggugat dan Tergugat tinggal di Desa X" bukan tempat
 * menikah). Tempatnya harus menyusul kata nikah dalam 160 huruf.
 */
function tempatNikahCerai(kalimat) {
  for (const k of kalimat || []) {
    const m = POLA_NIKAH.exec(k);
    if (!m) continue;
    const seg = k.slice(m.index, m.index + 220).split(/\b(?:dan\s+tercatat|tercatat|sesuai|sebagaimana|berdasarkan|namun|sehingga|karena|setelah|kemudian|dan\s+telah|dengan\s+wali|selama)\b/i)[0];
    if (POLA_TINGGAL.test(seg)) continue;
    // Bentuk baku posita cerai satker: "melangsungkan pernikahan yang dicatat oleh Pegawai Pencatat Nikah
    // (pada) Kantor Urusan Agama (KUA) Kecamatan X, Kabupaten Y, Provinsi Z" - tempatnya = wilayah KUA itu.
    const kua = /\bdicatat\s+oleh\s+Pegawai\s+Pencatat\s+Nikah\s+(?:pada\s+)?((?:Kantor\s+Urusan\s+Agama|KUA)\b[^;]*)/i.exec(k);
    if (kua) {
      const komp = wilayah.komponenWilayah(kua[1].split(/\.\s|\b(?:sebagaimana|sesuai|dengan\s+Kutipan|berdasarkan)\b/i)[0]);
      if (komp.kecamatan) {
        const sisa = [komp.kabupaten, komp.provinsi].filter(Boolean).join(", ");
        return { nilai: `wilayah hukum Kantor Urusan Agama Kecamatan ${komp.kecamatan}${sisa ? `, ${sisa}` : ""}`, komponen: komp, kalimat: k };
      }
    }
    const di = seg.search(/\bdi\s+(?:wilayah\s+)?(?:hukum\s+)?(?:Desa|Kelurahan|Kecamatan|Kec\.|Kantor\s+Urusan|KUA|Kabupaten|Kota)\b/i);
    if (di < 0 || di > 160) continue;
    const komp = wilayah.komponenWilayah(seg.slice(di));
    if (!komp.desa && !komp.kecamatan) continue;
    return { nilai: wilayah.tulisWilayah(komp), komponen: komp, kalimat: k };
  }
  return { nilai: "", komponen: null, kalimat: "" };
}

const POLA_TANPA_KOMUNIKASI =
  /\b(?:tidak|tak|belum)\s+(?:pernah\s+)?(?:lagi\s+)?(?:ada\s+)?(?:saling\s+)?(?:ber)?komunikasi\b|\b(?:tanpa|putus|hilang(?:nya)?)\s+komunikasi\b|\bkomunikasi\s+(?:sudah\s+|telah\s+)?(?:terputus|putus|tidak\s+(?:ada|berjalan|lancar))\b/i;
const POLA_MASIH_KOMUNIKASI = /\b(?:masih|tetap)\s+(?:sering\s+|saling\s+)?(?:ber)?komunikasi\b/i;

/** "Bahwa selama pisah ... #1267#" -> "tidak berkomunikasi lagi" / "masih berkomunikasi"; "" bila posita tak menyebut. */
function komunikasi(kalimat) {
  for (const k of kalimat || []) {
    if (!/komunikasi/i.test(k)) continue;
    if (POLA_TANPA_KOMUNIKASI.test(k)) return { nilai: "tidak berkomunikasi lagi", kalimat: k };
    if (POLA_MASIH_KOMUNIKASI.test(k)) return { nilai: "masih berkomunikasi", kalimat: k };
  }
  return { nilai: "", kalimat: "" };
}

/** Fakta cerai dari posita - murni. */
function deteksi(posita, opsi = {}) {
  const kalimat = opsi.kalimat || require("../abtUsulanService").kalimatPosita(posita);
  const hasil = {};
  const tempat = tempatNikahCerai(kalimat);
  if (tempat.nilai) hasil["5105"] = { nilai: tempat.nilai, kalimat: tempat.kalimat, yakin: "cukup", kodePola: "cerai-tempat-nikah" };
  const anak = itsbat.anakDariPosita(kalimat);
  if (anak.nilai) hasil["0007"] = { nilai: anak.nilai, kalimat: anak.kalimat, yakin: "cukup", kodePola: "cerai-anak" };
  const kom = komunikasi(kalimat);
  if (kom.nilai) hasil["1267"] = { nilai: kom.nilai, kalimat: kom.kalimat, yakin: "cukup", kodePola: "cerai-komunikasi" };
  return hasil;
}

/**
 * Sambungan rute /abt/usulan (sumber saksi/semua): usulan cerai yang BELUM ada di `daftar` ditambahkan;
 * 5127 (penyebab bertengkar di BAS saksi) = salinan usulan 5227 bila ada. Mengembalikan daftar baru.
 */
function tambahUsulanCerai(daftar, posita, opsi = {}) {
  const ada = new Set((daftar || []).filter((u) => u && String(u.nilai || "").trim()).map((u) => String(u.kode)));
  const tambahan = [];
  const fakta = deteksi(posita, opsi);
  for (const [kode, f] of Object.entries(fakta)) {
    if (ada.has(kode)) continue;
    const v = VARIABEL.find((x) => x.kode === kode);
    tambahan.push({
      kode,
      nama: v ? v.nama : kode,
      nilai: f.nilai,
      keyakinan: f.yakin === "ragu" ? "ragu" : "cukup",
      bentrok: "",
      catatan: "",
      dihitung: false,
      sumber: [{ saksi: 0, asal: "posita", kalimat: String(f.kalimat).slice(0, 400) }],
      kodePola: f.kodePola,
    });
  }
  const u5227 = (daftar || []).find((u) => u && String(u.kode) === "5227" && String(u.nilai || "").trim());
  if (u5227 && !ada.has("5127")) {
    tambahan.push({ ...u5227, kode: "5127", nama: "Penyebab bertengkar (BAS saksi, sama dengan 5227)", kodePola: "cerai-5127-dari-5227" });
  }
  return [...(daftar || []), ...tambahan];
}

module.exports = {
  kunci: "cerai",
  jenisPerkaraId: [346, 347],
  variabel: VARIABEL,
  deteksi,
  tempatNikahCerai,
  komunikasi,
  tambahUsulanCerai,
};
