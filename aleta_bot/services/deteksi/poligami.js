"use strict";

/**
 * ============================================================================
 * DETEKSI IZIN POLIGAMI (jenis_perkara_id 341) - butir 16, 13 Okt 2026
 * ============================================================================
 *
 * Blangko Derry "5 Izin Poligami" (menu 923): [01] Kabul memuat isian tangan
 * 1152, 8720, 8722-8726 (+ 9955/9881 umum). Sumbernya:
 *
 *   8723 nama calon istri kedua     posita ("perempuan bernama : Nama : X binti Y",
 *                                   "Nama istri kedua : X") + petitum ("calon isteri
 *                                   kedua Pemohon bernama ( X )")
 *   8724 status, umur, pekerjaan,   blok calon istri di posita (Umur/Pekerjaan/Alamat/
 *        alamat calon istri         Status, atau satu kalimat "X, umur 33 tahun, ...")
 *   8725 penghasilan Pemohon        SIPP perkara_alasan_nikah.nominal_penghasilan
 *                                   (diisi petugas pendaftaran) - bila kosong, posita
 *                                   "penghasilan ... Rp. 6.000.000,- (enam juta rupiah)"
 *   1152 alasan poligami            posita "alasan Pemohon untuk menikah lagi adalah
 *                                   karena ..." (blangko: "karena #1152#")
 *   8720 huruf alasan a/b/c         SIPP perkara_alasan_nikah.alasan_id (ref_izin_poligami
 *                                   1/2/3 = Pasal 4 (2) UUP huruf a/b/c); bila kosong dari
 *                                   kalimat alasan posita. HAL HUKUM: selalu "ragu".
 *   8722 harta bersama Pemohon &    daftar "memperoleh harta sebagai berikut:" di posita
 *        Termohon
 *   8726 SK izin atasan (PNS)       posita "izin ... atasan ... Nomor X tanggal Y"
 *
 * Diukur atas 12 perkara 341 sipp_donggala (8 berposita, 11 dikabulkan) -
 * angkanya di UKUR dan di laporan. Keyakinan "cukup" (tercentang) HANYA untuk
 * nilai dari kolom SIPP yang diisi petugas (8725) dan nama calon istri yang
 * terukur 11/11 sama dengan amar (8723); selebihnya "ragu".
 */

const P = require("./pembantuKebendaan");
const T = require("../tuntutanDeteksiService");

const variabel = Object.freeze([
  { kode: "8723", nama: "Nama calon istri kedua", sumber: "posita+petitum", blangko: ["putusan", "bas"] },
  { kode: "8724", nama: "Status, umur, pekerjaan dan alamat calon istri kedua", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "8725", nama: "Penghasilan Pemohon setiap bulan", sumber: "sipp+posita", blangko: ["putusan", "bas"] },
  { kode: "1152", nama: "Alasan poligami", sumber: "posita", blangko: ["putusan"] },
  { kode: "8720", nama: "Huruf alasan poligami (Pasal 4 ayat 2 UUP)", sumber: "sipp+posita", blangko: ["putusan"] },
  { kode: "8722", nama: "Harta bersama Pemohon dan Termohon", sumber: "posita", blangko: ["putusan"] },
  { kode: "8726", nama: "Izin atasan (PNS): nomor dan tanggal SK", sumber: "posita", blangko: ["putusan"] },
]);

/** Angka ukur (sipp_donggala 9 Okt; pembanding = amar putusan) - lihat laporan butir 16. */
const UKUR = Object.freeze({
  8723: { n: 11, tepat: 11, pembanding: "amar (nama calon istri yang diberi izin)" },
});

/* ---------------------------------------------------------------------------
 * CALON ISTRI KEDUA
 * ------------------------------------------------------------------------- */

const POLA_CALON = [
  /Nama\s+(?:calon\s+)?iste?ri\s+(?:kedua|ke-?2)\s*:\s*/i,
  /Nama\s+calon\s+iste?ri\s*:\s*/i,
  /(?:menikah\s+lagi|berpoligami|poligami|menikah)[^;]{0,80}?(?:perempuan|wanita)\s+(?:yang\s+)?bernama\s*[:,]*\s*(?:Nama\s*:\s*)?[,]?\s*/i,
  /calon\s+iste?ri\s+(?:kedua\s+)?(?:Pemohon\s+)?(?:yang\s+)?bernama\s*:?\s*\(?\s*/i,
];

function calonIstri(satu, petitum) {
  const kandidat = [];
  for (const [asal, teks] of [
    ["posita", satu],
    ["petitum", petitum],
  ]) {
    if (!teks) continue;
    for (const pola of POLA_CALON) {
      const r = P.namaSesudahPola(teks, pola);
      if (r.nama && r.nama.split(" ").length <= 8) {
        kandidat.push({ nama: r.nama, asal, index: r.index, teks });
        break;
      }
    }
  }
  if (!kandidat.length) return null;
  // Yang berbin/binti didahulukan; nama pendek dilengkapi dari teks lain bila bentuk lengkapnya ada.
  const semua = `${satu}; ${petitum || ""}`;
  for (const k of kandidat) k.nama = P.lengkapiBin(k.nama, semua);
  kandidat.sort((a, b) => Number(/\bbinti?\b/i.test(b.nama)) - Number(/\bbinti?\b/i.test(a.nama)) || b.nama.length - a.nama.length);
  const pilih = kandidat[0];
  const sepakat = kandidat.length < 2 || kandidat.every((k) => P.normal(pilih.nama).startsWith(P.normal(k.nama).split(" ")[0]));
  return { ...pilih, sepakat, kalimat: P.kalimatDi(pilih.teks, pilih.index, 120) };
}

/** Blok keterangan calon istri: dari namanya sampai "Selanjutnya disebut"/butir "Bahwa" berikutnya. */
function blokCalon(satu, calon) {
  if (!calon || calon.asal !== "posita") return "";
  const awal = satu.indexOf(calon.nama.split(" ")[0], Math.max(0, calon.index));
  if (awal < 0) return "";
  const sisa = satu.slice(awal);
  const akhir = sisa.search(/Selanjutnya\s+disebut|;\s*(?:\d{1,2}\s*[.)]\s*)?Bahwa\b/i);
  return sisa.slice(0, akhir < 0 ? 600 : akhir);
}

function rapiPekerjaan(p) {
  const t = String(p || "").replace(/\s+/g, " ").replace(/[\s,;.]+$/, "").trim();
  if (/^(?:tidak\s+ada|tidak\s+bekerja|belum\s+bekerja|-+)$/i.test(t)) return "tidak bekerja";
  return t;
}

function statusCalon(blok) {
  const m = /Status(?:\s+perkawinan)?\s*:?\s*(Perawan|Gadis|Janda|Belum\s+(?:pernah\s+)?(?:menikah|kawin))/i.exec(blok);
  if (!m) return "";
  return /janda/i.test(m[1]) ? "janda" : "gadis";
}

function keteranganCalon(blokMentah) {
  const blok = String(blokMentah || "").replace(/[\s;,.]+$/, "");
  if (!blok) return null;
  const umur = /(?:Umur|Usia)\s*:?\s*(\d{1,3})\s*(?:\([^)]*\)\s*)?tahun/i.exec(blok);
  const kerja = /Pekerjaan\s*:?\s*([^,;:]+?)(?=\s*(?:,|;|Status\b|Alamat\b|Agama\b|Pendidikan\b|tempat\s+tinggal\b|bertempat\b|$))/i.exec(blok);
  const alamat = /(?:Alamat|bertempat\s+tinggal\s+di|tempat\s+tinggal\s+di)\s*:?\s*([^;]+?)\s*\.?\s*$/i.exec(blok);
  const status = statusCalon(blok);
  const bagian = [];
  if (status) bagian.push(status);
  if (umur) bagian.push(`umur ${Number(umur[1])} tahun`);
  if (kerja && rapiPekerjaan(kerja[1])) bagian.push(`pekerjaan ${rapiPekerjaan(kerja[1])}`);
  if (alamat) bagian.push(`bertempat tinggal di ${alamat[1].replace(/\s+/g, " ").replace(/[\s,.]+$/, "").trim()}`);
  if (!bagian.length) return null;
  return { nilai: bagian.join(", "), lengkap: Boolean(umur && kerja && alamat) };
}

/* ---------------------------------------------------------------------------
 * PENGHASILAN, ALASAN, HARTA, IZIN ATASAN
 * ------------------------------------------------------------------------- */

function penghasilanPosita(daftarBaris) {
  for (const b of daftarBaris) {
    if (!/penghasilan|berpenghasilan|gaji/i.test(b)) continue;
    const n = T.nominalDari(b).filter((x) => x.nilai >= 100000);
    if (!n.length) continue;
    // "Rp4.000.000 sampai dengan Rp5.000.000" - rentang: yang memilih angka manusia.
    if (n.length > 1 && /sampai|hingga|s\.?\/?d|-\s*Rp/i.test(b)) return { nilai: "", kalimat: b, rentang: true };
    return { nilai: T.rupiahTerbilang(n[0].nilai), kalimat: b, angka: n[0].nilai };
  }
  return null;
}

const ALASAN_HURUF = [
  { huruf: "c", pola: /(?:tidak|belum)\s+(?:dapat|bisa|mampu)\s+(?:lagi\s+)?(?:memberi(?:kan)?|melahirkan|mempunyai|memiliki)\s+(?:keturunan|anak)|mandul/i },
  { huruf: "b", pola: /cacat\s+badan|penyakit\s+yang\s+tidak\s+(?:dapat|bisa)\s+disembuhkan|sakit\s+(?:keras|menahun|parah|tumor|kanker|stroke)|lumpuh/i },
  {
    huruf: "a",
    pola: /(?:tidak|kurang)\s+(?:dapat|bisa|mampu)\s+(?:lagi\s+)?(?:menjalankan\s+kewajiban|melayani|memenuhi\s+kebutuhan|mengurus(?:\s+kebutuhan)?)/i,
  },
];

function alasanPoligami(daftarBaris) {
  for (const b of daftarBaris) {
    const m = /alasan\s+(?:Pemohon\s+)?(?:untuk\s+|ingin\s+|hendak\s+)?(?:menikah\s+lagi|berpoligami|poligami|beristri\s+lebih)[^;]{0,30}?\b(?:adalah\s+|yaitu\s+)?(?:karena|disebabkan(?:\s+karena)?|oleh\s+karena)\s+(.+)$/i.exec(b);
    if (m) return { nilai: m[1].replace(/[\s;.]+$/, "").trim(), kalimat: b };
  }
  return null;
}

function hurufDariKalimat(kalimat) {
  const huruf = ALASAN_HURUF.filter((a) => a.pola.test(kalimat)).map((a) => a.huruf);
  return [...new Set(huruf)].sort().join(", ");
}

const PEMBUKA_HARTA =
  /(?:memperoleh|mendapatkan|memiliki|mempunyai|telah\s+(?:mendapat|memperoleh))\s+harta(?:\s+bersama)?\s*(?:berupa|sebagai\s+berikut|yaitu|antara\s+lain)?/i;

function izinAtasan(satu) {
  const m = /izin\s+(?:dari\s+)?atasan[^;]{0,120}?(?:Nomor|No\.?)\s*:?\s*([0-9A-Za-z./-]{3,60})[^;]{0,40}?tanggal\s+([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})/i.exec(satu);
  if (!m) return null;
  return { nilai: `Nomor ${m[1]} tanggal ${P.tanggalBaku(m[2]) || m[2]}`, kalimat: P.kalimatDi(satu, m.index, m[0].length) };
}

/* ---------------------------------------------------------------------------
 * DETEKSI (murni)
 * ------------------------------------------------------------------------- */

/**
 * @param {string} posita HTML/teks posita (variabel 5125)
 * @param {{petitum?: string, sipp?: {alasanNikah?: Array<{alasan_id, nominal_penghasilan}>}}} opsi
 */
function deteksi(posita, opsi = {}) {
  const daftar = P.baris(posita);
  const satu = daftar.join("; ");
  const petitum = P.satuBaris(opsi.petitum || "");
  const hasil = {};

  const calon = calonIstri(satu, petitum);
  if (calon) {
    hasil["8723"] = {
      nilai: calon.nama,
      kalimat: calon.kalimat,
      asal: calon.asal,
      // Terukur 11/11 sama dengan amar; ragu bila posita dan petitum tidak sepakat.
      yakin: calon.sepakat && /\bbinti?\b/i.test(calon.nama) ? "cukup" : "ragu",
      kodePola: `poligami-calon-${calon.asal}`,
    };
    const ket = keteranganCalon(blokCalon(satu, calon));
    if (ket) hasil["8724"] = { nilai: ket.nilai, kalimat: blokCalon(satu, calon).slice(0, 400), yakin: "ragu", kodePola: "poligami-calon-keterangan" };
  }

  const sipp = (opsi.sipp && Array.isArray(opsi.sipp.alasanNikah) ? opsi.sipp.alasanNikah : []).filter(Boolean);
  const nominalSipp = sipp.map((a) => Number(a.nominal_penghasilan) || 0).find((n) => n > 0);
  const hasilPosita = penghasilanPosita(daftar);
  if (nominalSipp) {
    const beda = hasilPosita && hasilPosita.angka && hasilPosita.angka !== nominalSipp;
    hasil["8725"] = {
      nilai: T.rupiahTerbilang(nominalSipp),
      kalimat: `SIPP data pihak - penghasilan ${T.formatRupiah(nominalSipp)}`,
      asal: "sipp",
      yakin: beda ? "ragu" : "cukup",
      catatan: beda ? `Posita menyebut ${T.formatRupiah(hasilPosita.angka)} - berbeda dengan SIPP.` : "",
      kodePola: "poligami-penghasilan-sipp",
    };
  } else if (hasilPosita && hasilPosita.nilai) {
    hasil["8725"] = { nilai: hasilPosita.nilai, kalimat: hasilPosita.kalimat, yakin: "ragu", kodePola: "poligami-penghasilan-posita" };
  }

  const alasan = alasanPoligami(daftar);
  if (alasan) hasil["1152"] = { nilai: alasan.nilai, kalimat: alasan.kalimat, yakin: "ragu", kodePola: "poligami-alasan-posita" };

  const HURUF_SIPP = { 1: "a", 2: "b", 3: "c" };
  const hurufSipp = [...new Set(sipp.map((a) => HURUF_SIPP[Number(a.alasan_id)]).filter(Boolean))].sort().join(", ");
  const hurufPosita = alasan ? hurufDariKalimat(alasan.nilai) : "";
  if (hurufSipp || hurufPosita) {
    hasil["8720"] = {
      nilai: hurufSipp || hurufPosita,
      kalimat: hurufSipp ? `SIPP alasan izin poligami: ${sipp.map((a) => a.nama || a.alasan_id).join("; ")}` : alasan.kalimat,
      asal: hurufSipp ? "sipp" : "posita",
      // Huruf alasan adalah penilaian hukum - selalu diperiksa hakim.
      yakin: "ragu",
      catatan:
        hurufSipp && hurufPosita && hurufSipp !== hurufPosita
          ? `Kalimat alasan posita lebih dekat ke huruf ${hurufPosita} - periksa.`
          : "Huruf alasan Pasal 4 ayat (2) UUP adalah penilaian hakim - periksa sebelum dipakai.",
      kodePola: hurufSipp ? "poligami-huruf-sipp" : "poligami-huruf-posita",
    };
  }

  const harta = P.daftarSesudah(daftar, PEMBUKA_HARTA);
  if (harta.benda.length) {
    hasil["8722"] = { nilai: P.isianBernomor(harta.benda), kalimat: harta.kalimat, yakin: "ragu", kodePola: "poligami-harta-posita" };
  }

  const izin = izinAtasan(satu);
  if (izin) hasil["8726"] = { nilai: izin.nilai, kalimat: izin.kalimat, yakin: "ragu", kodePola: "poligami-izin-atasan" };
  return hasil;
}

module.exports = {
  kunci: "izin-poligami",
  jenisPerkaraId: [341],
  variabel,
  UKUR,
  deteksi,
  // diuji langsung
  calonIstri,
  keteranganCalon,
  penghasilanPosita,
  alasanPoligami,
  hurufDariKalimat,
};
