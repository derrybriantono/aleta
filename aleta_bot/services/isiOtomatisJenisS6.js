"use strict";

/**
 * ============================================================================
 * ISIAN OTOMATIS BLANGKO DERRY - JENIS PERKARA AGEN S6 (20 Okt 2026)
 * ============================================================================
 *
 * Harta bersama (348), kewarisan (364), wasiat (365), hibah (366), wakaf (367), izin poligami (341), pencegahan /
 * penolakan / pembatalan perkawinan (342, 343, 344), hak asuh / penguasaan anak / nafkah anak (349, 350, 351), Lain-Lain
 * (369: hak asuh, pengangkatan anak, mafqud, permohonan umum), ekonomi syariah (370). Cerai/itsbat/ikrar = agen S3;
 * dispensasi kawin, wali adhal, asal usul, perwalian, P3HP = agen S5 - jenis itu tidak disentuh di sini.
 *
 * Dipanggil dari abtUsulanService.dariSipp (sumber "sipp": SELALU diminta panel Blangko Derry untuk SEMUA kategori
 * blangko - putusan/penetapan, BAS tiap sidang, relaas, PTSP, sita) lewat SATU sambungan sempit. Hasilnya usulan
 * berbentuk sama dengan usulan lain (kode, nilai, keyakinan, sumber, catatan) sehingga lencana "yakin: ...", "dari posita
 * gugatan", "sumber (n)" dan keterangan ikon "i" memakai jalur tampilan yang sudah ada:
 *
 *   pasti / cukup  -> ditulis sendiri bila saklar "Isi otomatis" menyala dan isiannya KOSONG (tidak pernah menimpa)
 *   ragu           -> saran (kotak samar, tekan Tab) beserta kalimat sumbernya
 *   tidak_ada_sumber (manual: true) -> lencana "diisi manual" + alasan; `opsional: true` + `labelPengguna` bagi isian
 *                     yang boleh dikosongkan (kolom CORET, isian bawaan ABT)
 *
 * Sumber:
 *   (1) data terstruktur SIPP (HANYA SELECT): gugatan rekonvensi (7084, 9283), perkara terdahulu pasangan yang sama dengan
 *       akta cerai (8706), akad syariah (9340), kesepakatan perdamaian di hadapan hakim (9352-9354);
 *   (2) posita + petitum SIPP lewat deteksi/isiS6.js (hibah, wakaf, wasiat, mafqud, pencegahan, pembatalan, ekonomi
 *       syariah, hak asuh, duplikat akta nikah);
 *   (3) tuntutan nafkah anak/mut'ah/madliyah dari petitum (isiGugatanService, mesin yang sama dengan berkas e-Court);
 *   (4) tabel isian yang memang tidak mungkin otomatis (penilaian hakim, hasil sidang, surat yang tidak tercatat di SIPP).
 *
 *
 * Aturan: tidak ada kata "ALETA" di nilai; jagaIsianLama pada semua usulan (isian petugas tidak ditimpa); satu pembacaan
 * yang gagal tidak menggagalkan yang lain.
 */

const isiS6 = require("./deteksi/isiS6");
const lanjutan = require("./abtIsianSippLanjutan");
const P = require("./deteksi/pembantuKebendaan");

/** Jenis perkara SIPP milik agen S6. */
const JENIS_S6 = Object.freeze([341, 342, 343, 344, 345, 348, 349, 350, 351, 352, 353, 359, 361, 364, 365, 366, 367, 369, 370]);
const ADA_JENIS = new Set(JENIS_S6);
/** Jenis yang pihaknya (mantan) suami-istri: dasar putusnya perkawinan dicari dari perkara cerai terdahulu. */
const JENIS_MANTAN_PASANGAN = new Set([348, 349, 350, 351, 369]);
const JENIS_ANAK = new Set([349, 350, 351, 369]);

const NAMA = Object.freeze({
  "7084": "Penanda konvensi/rekonvensi (1 apabila ada)",
  "8706": "Dasar putusnya perkawinan para pihak",
  "9283": "Harta bersama rekonvensi",
  "9340": "Akad yang disengketakan",
  "9341": "Jumlah kewajiban yang digugat",
  "9345": "Fakta wanprestasi",
  "9352": "Isi kesepakatan perdamaian di hadapan hakim",
  "9353": "Tanggal kesepakatan perdamaian",
  "9354": "Pihak yang dibebani biaya perkara menurut kesepakatan",
  "9490": "Klausula arbitrase dalam akad",
  "9748": "Fakta hukum asuhan dan kelalaian nafkah",
  "5171": "Penghasilan Penggugat/Pemohon perbulan",
  "5271": "Penghasilan Tergugat/Termohon perbulan",
  "0889": "Tanggal duplikat kutipan akta nikah",
  "1108": "Nomor duplikat surat nikah",
  "1029": "Nama calon suami",
  "9460": "Nama calon istri",
  "9461": "Wilayah KUA tempat perkawinan akan dilangsungkan",
  "9462": "Kedudukan Pemohon terhadap calon mempelai",
  "9463": "Alasan pencegahan perkawinan (huruf)",
  "9320": "Alasan pembatalan perkawinan (huruf)",
  "9790": "Pokok tuntutan hibah (huruf)",
  "9793": "Penghibah",
  "9794": "Bentuk dan tanggal hibah",
  "9795": "Objek hibah",
  "9802": "Kedudukan Penggugat (hibah)",
  "9803": "Kedudukan Tergugat (hibah)",
  "9806": "Kedudukan Pemohon (hibah)",
  "9820": "Pokok tuntutan wakaf (huruf)",
  "9823": "Wakif",
  "9824": "Nazhir",
  "9825": "Bentuk dan tanggal ikrar wakaf",
  "9826": "Harta benda wakaf",
  "9827": "Peruntukan wakaf",
  "9832": "Kedudukan Penggugat (wakaf)",
  "9833": "Kedudukan Tergugat (wakaf)",
  "9836": "Kedudukan Pemohon (wakaf)",
  "9841": "Pihak yang menguasai harta benda wakaf",
  "9475": "Pokok tuntutan wasiat (huruf)",
  "9478": "Bentuk dan tanggal wasiat",
  "9479": "Objek wasiat",
  "9486": "Kedudukan Penggugat (wasiat)",
  "9487": "Kedudukan Tergugat (wasiat)",
  "9860": "Nama orang yang hilang",
  "9861": "Kedudukan Pemohon terhadap orang yang hilang",
  "9862": "Tempat tinggal dan waktu terakhir diketahui",
  "9863": "Upaya pencarian",
  "9864": "Lama tidak ada kabar",
  "9865": "Kepentingan Pemohon (huruf)",
  "6071": "Nafkah anak",
  "6072": "Nafkah anak (masing-masing anak)",
  "6054": "Nafkah iddah",
  "6055": "Mut'ah",
  "7120": "Nafkah lampau (madliyah)",
});

/**
 * Isian yang TIDAK mungkin diisi otomatis. `jenis` = jenis perkara pemakai blangko (kosong = semua jenis S6); `alasan`
 * = kalimat untuk ikon "i" (bahasa petugas, tanpa istilah teknis); `opsional` + `labelPengguna` = boleh dikosongkan; `ecourt` = bacaan
 * utamanya berkas e-Court (hanya cadangan dinamis, tidak masuk petunjuk statis portal).
 * Isian yang ternyata terbaca dari data (mis. 9345) menggantikan entri di sini.
 */
const MANUAL = Object.freeze({
  // Surat/izin yang tidak tercatat terstruktur di SIPP
  "7178": { alasan: "Penilaian hakim atas hasil panggilan (relaas). SIPP hanya mencatat hasil relaas, bukan penilaian patut atau tidaknya panggilan." },
  "8894": { alasan: "Kuasa insidentil tidak punya kolom sendiri di SIPP; nama penerima kuasa dan izin Ketua hanya ada di suratnya." },
  "8895": { alasan: "Hubungan penerima kuasa insidentil dengan pemberi kuasa hanya tertulis di surat izin Ketua." },
  "8896": { alasan: "Nomor izin Ketua Pengadilan untuk kuasa insidentil tidak disimpan SIPP secara terstruktur." },
  "0182": { alasan: "Tanggal izin kuasa insidentil tidak disimpan SIPP secara terstruktur." },
  "0183": { alasan: "Tanggal izin kuasa insidentil Tergugat tidak disimpan SIPP secara terstruktur." },
  "9120": { alasan: "Penilaian hakim atas sah tidaknya kuasa insidentil." },
  "9123": { alasan: "Penilaian hakim atas sebab kuasa insidentil tidak sah." },
  "9125": { alasan: "Penilaian hakim atas keadaan kuasa insidentil yang tidak sah." },
  // Kolom CORET (kosong = paragraf dicoret/titik-titik)
  "8712": { opsional: true, labelPengguna: "Surat teguran panjar (isi hanya bila perkara gugur karena panjar tidak ditambah)", alasan: "Surat teguran panitera tidak tercatat di SIPP; isi hanya bila perkara gugur karena panjar tidak ditambah, selain itu biarkan kosong." },
  "8713": { opsional: true, labelPengguna: "Batas waktu menambah panjar (isi hanya bila perkara gugur karena panjar)", alasan: "Batas waktu tertulis di surat teguran, bukan di SIPP; isi hanya bila perkara gugur karena panjar tidak ditambah." },
  "8714": { opsional: true, labelPengguna: "Laporan panitera panjar tidak ditambah (isi hanya bila perkara gugur)", alasan: "Laporan panitera tidak tercatat di SIPP; isi hanya bila perkara gugur karena panjar tidak ditambah." },
  "9134": { opsional: true, labelPengguna: "Petunjuk perbaikan permohonan dari majelis (bila ada)", alasan: "Petunjuk perbaikan permohonan diberikan majelis di sidang dan tidak ada di SIPP; kosong = titik-titik." },
  // Penilaian dan fakta persidangan
  "9165": { jenis: [348, 364], alasan: "Hasil pemeriksaan setempat hanya diketahui di lokasi sidang; diketik panitera." },
  "9166": { jenis: [348, 364], alasan: "Aparat desa yang mendampingi dicatat panitera di lokasi sidang." },
  "9167": { jenis: [348, 364], alasan: "Hasil pemeriksaan tiap objek diketik panitera dari pemeriksaan setempat." },
  "9168": { jenis: [348, 364], alasan: "Tanggapan para pihak di lokasi dicatat panitera." },
  "9170": { jenis: [341], opsional: true, labelPengguna: "Pokok jawaban istri di persidangan (bila bukan menyetujui)", alasan: "Pokok jawaban istri diucapkan di sidang dan tidak ada di SIPP; kosong = menyetujui (bawaan ABT)." },
  "8726": { jenis: [341], opsional: true, labelPengguna: "SK izin atasan (hanya bila Pemohon PNS)", alasan: "Izin atasan hanya untuk Pemohon PNS; nomor dan tanggalnya terbaca dari posita bila ditulis, selainnya diketik dari surat izin atasan." },
  "9171": { jenis: [341], alasan: "Keterangan calon istri kedua diucapkan di persidangan; diketik panitera dari sidang." },
  "9309": { jenis: [349, 350, 351, 369], alasan: "Penilaian hakim atas keadaan yang membuat pemegang hak asuh tidak dapat menjamin keselamatan anak." },
  "9310": { jenis: [349, 350, 351, 369], alasan: "Pertimbangan hakim mengapa kepentingan terbaik anak tidak terpenuhi; bukan data perkara." },
  "9750": { jenis: [350, 351, 369], alasan: "Alasan hakim menolak sebagian petitum nafkah; diputus majelis." },
  "9329": { jenis: [344], alasan: "Fakta alasan pembatalan yang terbukti di persidangan diputus majelis dari bukti dan saksi." },
  "9330": { jenis: [344], alasan: "Pertimbangan hakim menolak pembatalan; bukan data perkara." },
  "9346": { jenis: [370], alasan: "Pertimbangan hakim bahwa dalil wanprestasi tidak terbukti; bukan data perkara." },
  "9466": { jenis: [342, 343], alasan: "Fakta alasan pencegahan yang terbukti diputus majelis dari bukti dan saksi." },
  "9467": { jenis: [342, 343], alasan: "Pertimbangan hakim bahwa alasan pencegahan tidak terbukti." },
  "9468": { jenis: [342, 343], alasan: "Pokok keterangan calon mempelai diucapkan di persidangan; diketik panitera." },
  "9469": { jenis: [342, 343], alasan: "Waktu dan tempat perkawinan yang ternyata sudah dilangsungkan adalah fakta persidangan." },
  "9482": { jenis: [365], alasan: "Fakta pokok tuntutan yang terbukti diputus majelis dari bukti dan saksi." },
  "9483": { jenis: [365], alasan: "Pertimbangan hakim bahwa dalil gugatan tidak terbukti." },
  "9485": { jenis: [365], alasan: "Pihak yang berkepentingan tetapi tidak ditarik sebagai pihak adalah penilaian hakim." },
  "9798": { jenis: [366], alasan: "Fakta pokok tuntutan hibah yang terbukti diputus majelis dari bukti dan saksi." },
  "9799": { jenis: [366], alasan: "Pertimbangan hakim bahwa dalil gugatan hibah tidak terbukti." },
  "9801": { jenis: [366], alasan: "Pihak yang berkepentingan tetapi tidak ditarik sebagai pihak adalah penilaian hakim." },
  "9807": { jenis: [366], alasan: "Fakta hibah yang terbukti diputus majelis dari bukti dan saksi." },
  "9808": { jenis: [366], alasan: "Pertimbangan hakim bahwa dalil permohonan hibah tidak terbukti." },
  "9809": { jenis: [366], alasan: "Sebab permohonan hibah tidak dapat diterima adalah penilaian formil hakim." },
  "9828": { jenis: [367], alasan: "Fakta pokok tuntutan wakaf yang terbukti diputus majelis dari bukti dan saksi." },
  "9829": { jenis: [367], alasan: "Pertimbangan hakim bahwa dalil gugatan wakaf tidak terbukti." },
  "9831": { jenis: [367], alasan: "Pihak yang berkepentingan tetapi tidak ditarik sebagai pihak adalah penilaian hakim." },
  "9837": { jenis: [367], alasan: "Fakta wakaf yang terbukti (ikrar sebelum 15 Desember 2006, belum terdaftar, dikuasai siapa) diputus majelis." },
  "9838": { jenis: [367], alasan: "Pertimbangan hakim bahwa dalil permohonan wakaf tidak terbukti." },
  "9839": { jenis: [367], alasan: "Sebab permohonan wakaf tidak dapat diterima adalah penilaian formil hakim." },
  "9870": { jenis: [369], alasan: "Fakta mafqud yang terbukti diputus majelis dari bukti dan saksi." },
  "9871": { jenis: [369], alasan: "Pertimbangan hakim bahwa dalil permohonan mafqud tidak terbukti." },
  "9872": { jenis: [369], alasan: "Sebab permohonan mafqud tidak dapat diterima adalah penilaian formil hakim." },
  "9868": { jenis: [369], opsional: true, labelPengguna: "Cara dan jangka waktu pengumuman (bila berbeda dari bawaan)", alasan: "Pengumuman dicatat panitera dan tidak tersimpan terstruktur di SIPP; kosong = papan pengumuman 14 hari." },
  "9869": { jenis: [369], opsional: true, labelPengguna: "Hasil pengumuman (bila ada yang memberi kabar)", alasan: "Hasil pengumuman dicatat panitera; kosong = tidak ada yang memberi kabar." },
  "9875": { jenis: [369], opsional: true, labelPengguna: "Tanggal berlaku mati secara hukum (bila bukan sejak penetapan diucapkan)", alasan: "Opsional; kosong = berlaku sejak penetapan diucapkan." },
  "9680": { jenis: [364], alasan: "Alasan Tergugat tidak menyetujui pencabutan diucapkan di sidang; diketik dari BAS." },
  "9682": { jenis: [348, 364], alasan: "Alasan hakim bahwa perkara di luar kewenangan; putusan sela." },
  "9684": { jenis: [348, 364], alasan: "Alasan hakim bahwa perkara termasuk kewenangan Pengadilan Agama; putusan sela." },
  "9685": { jenis: [348, 364], alasan: "Isi eksepsi kewenangan yang diucapkan di sidang; diketik dari BAS." },
  "0663": { alasan: "Tanggal penetapan prodeo tidak disimpan SIPP; tertulis di penetapan prodeo." },
  // Isian yang bacaan utamanya berkas e-Court (bila berkasnya ada, usulan e-Court menggantikan entri ini)
  "8433": { alasan: "Alasan pencabutan diucapkan Penggugat/Pemohon di sidang; SIPP hanya mencatat pencabutan karena mediasi berhasil (itu pun hanya bila hasil mediasinya tercatat)." },
  "8436": { ecourt: true, alasan: "Kesimpulan Penggugat/Pemohon dibaca dari berkas kesimpulan di e-Court; bila tidak diunggah, diketik dari sidang." },
  "8437": { ecourt: true, alasan: "Kesimpulan Tergugat/Termohon dibaca dari berkas kesimpulan di e-Court; bila tidak diunggah, diketik dari sidang." },
  "9881": { ecourt: true, alasan: "Jawab-menjawab tertulis dibaca dari berkas e-Court; bila tidak ada berkasnya, jawab-menjawab dilakukan lisan dan dicatat di BAS." },
  "9681": { ecourt: true, jenis: [348, 364], alasan: "Isi eksepsi kewenangan dibaca dari berkas jawaban e-Court; bila diucapkan lisan, diketik dari BAS." },
  "9355": { ecourt: true, jenis: [370], alasan: "Pokok jawaban Tergugat dibaca dari berkas jawaban e-Court; bila lisan, diketik dari BAS." },
  "9491": { ecourt: true, jenis: [370], alasan: "Pokok eksepsi Tergugat dibaca dari berkas jawaban e-Court; bila lisan, diketik dari BAS." },
  "9282": { jenis: [348], opsional: true, labelPengguna: "Putusan cerai para pihak (isi hanya bila server tidak menemukannya)", alasan: "Server mencari perkara cerai terdahulu kedua pihak di SIPP; isi hanya bila tidak ditemukan (mis. cerai di pengadilan lain): Pengadilan Agama X Nomor 12/Pdt.G/2024/PA.X tanggal 5 Maret 2024." },
  "8618": { jenis: [369], alasan: "Tempat lahir anak umumnya hanya tertulis di akta kelahiran (berkas e-Court); posita biasanya hanya menyebut tanggal lahirnya." },
  "8620": { jenis: [369], alasan: "Keterangan orang tua kandung diucapkan di persidangan; diketik panitera dari sidang." },
  "8621": { ecourt: true, jenis: [369], alasan: "Daftar alat bukti pengangkatan anak dibaca dari berkas daftar bukti e-Court; bila tidak ada, diketik dari sidang." },
});

/* ---------------------------------------------------------------------------
 * Bentuk usulan
 * ------------------------------------------------------------------------- */

function butir({ kode, nilai, keyakinan, kalimat, catatan, kodePola, asal, manual, opsional, labelPengguna }) {
  const u = {
    kode,
    nama: NAMA[kode] || kode,
    nilai: String(nilai || ""),
    keyakinan,
    bentrok: "",
    sumber: kalimat ? [{ saksi: 0, asal: asal || "sipp", kalimat: String(kalimat).slice(0, 400) }] : [],
    catatan: catatan || "",
    dihitung: false,
    jagaIsianLama: true,
    kodePola: kodePola || `s6-${kode}`,
  };
  if (manual) u.manual = true;
  if (opsional) {
    u.opsional = true;
    if (labelPengguna) u.labelPengguna = labelPengguna;
  }
  return u;
}

/** Fakta modul posita -> usulan (nama dari tabel NAMA). */
function dariFakta(kode, f) {
  return butir({ kode, nilai: f.nilai, keyakinan: f.yakin === "cukup" ? "cukup" : "ragu", kalimat: f.kalimat, catatan: f.catatan, kodePola: f.kodePola, asal: f.asal || "posita-gugatan" });
}

/* ---------------------------------------------------------------------------
 * Usulan dari data terstruktur SIPP
 * ------------------------------------------------------------------------- */

/** 7084: perkara memuat gugatan rekonvensi (perkara_rekonvensi). */
function usulanRekonvensi(rek) {
  if (!rek) return [];
  const tgl = lanjutan.isoKeTampil(rek.tgl);
  return [
    butir({
      kode: "7084",
      nilai: "1",
      keyakinan: "pasti",
      kalimat: `SIPP: perkara memuat gugatan rekonvensi${tgl ? ` yang didaftarkan ${tgl}` : ""}`,
      catatan: "Terbaca dari tab Rekonvensi di SIPP: ada gugatan rekonvensi pada perkara ini.",
      kodePola: "s6-rekonvensi-ada",
      asal: "sipp",
    }),
  ];
}

const PEMBUKA_REKON = /(?:Menetapkan|Menyatakan)[^:;]{0,100}?harta[^:;]{0,100}?(?:berupa|sebagai\s+berikut|yaitu|masing-masing|:)/i;

/** 9283: objek harta bersama yang digugat dalam rekonvensi (petitum rekonvensi di SIPP). */
function usulanObjekRekonvensi(rek, jenis) {
  if (!rek || jenis !== 348 || !rek.petitum) return [];
  const baris = P.baris(rek.petitum);
  const d = P.daftarSesudah(baris, PEMBUKA_REKON, { polaPenutup: /^(?:adalah|merupakan|sebagai)\b/i });
  if (!d.benda.length) return [];
  return [
    butir({
      kode: "9283",
      nilai: P.isianBernomor(d.benda, ""),
      keyakinan: "ragu",
      kalimat: d.kalimat,
      catatan: "Benda yang digugat dalam rekonvensi (dari petitum rekonvensi di SIPP); salin sesuai yang ditetapkan, satu objek per baris.",
      kodePola: "s6-rekonvensi-objek",
      asal: "sipp",
    }),
  ];
}

/** Nama pengadilan dari akhiran nomor perkara "478/Pdt.G/2021/PA.Dgl". */
function namaPengadilan(nomorPerkara) {
  const kode = /\/PA\.?\s*([A-Za-z]{2,5})\s*$/i.exec(String(nomorPerkara || ""));
  if (!kode) return "";
  const peta = require("./deteksi/blangkoDerry").KODE_PA || {};
  return peta[kode[1].toLowerCase()] ? `Pengadilan Agama ${peta[kode[1].toLowerCase()]}` : "";
}

/** 8706: perkara cerai terdahulu pasangan yang sama (nama kedua pihak persis sama). */
function usulanDasarPutus(terdahulu) {
  const daftar = (Array.isArray(terdahulu) ? terdahulu : []).filter((x) => x && x.nomor && namaPengadilan(x.nomor));
  if (!daftar.length) return [];
  const bersertaAkta = daftar.filter((x) => String(x.nomorAkta || "").trim());
  const pilih = bersertaAkta.length === 1 ? bersertaAkta[0] : daftar.length === 1 ? daftar[0] : null;
  const yakin = pilih && String(pilih.nomorAkta || "").trim() ? "cukup" : "ragu";
  const dipakai = pilih || bersertaAkta[0] || daftar[0];
  const tgl = lanjutan.isoKeTampil(dipakai.tglPutusan);
  return [
    butir({
      kode: "8706",
      nilai: `${namaPengadilan(dipakai.nomor)} berdasarkan Putusan Nomor ${dipakai.nomor}`,
      keyakinan: yakin,
      kalimat: `SIPP: perkara cerai terdahulu ${dipakai.nomor}${tgl ? ` diputus ${tgl}` : ""} antara kedua pihak yang sama${String(dipakai.nomorAkta || "").trim() ? `; akta cerai ${String(dipakai.nomorAkta).trim()}` : ""}`,
      catatan:
        yakin === "cukup"
          ? "Perkara cerai terdahulu kedua pihak ditemukan di SIPP dan akta ceraianya sudah terbit."
          : `Perkara cerai terdahulu kedua pihak ditemukan di SIPP tetapi akta ceraianya belum tercatat${!pilih ? " atau ada lebih dari satu perkara" : ""}; periksa bahwa putusan itu mengabulkan cerai.`,
      kodePola: yakin === "cukup" ? "s6-dasar-putus-akta" : "s6-dasar-putus-nama",
      asal: "sipp",
    }),
  ];
}

/** 9340: akad dari referensi akad syariah SIPP bila posita tidak menyebut nomor/tanggal akadnya. */
function usulanAkadReferensi(namaAkad) {
  const daftar = (Array.isArray(namaAkad) ? namaAkad : []).map((x) => String(x || "").trim()).filter(Boolean);
  if (!daftar.length) return [];
  return [
    butir({
      kode: "9340",
      nilai: daftar.length === 1 ? `Akad ${daftar[0]}` : `Akad ${daftar.join(", ")}`,
      keyakinan: "ragu",
      kalimat: `SIPP: jenis akad syariah yang dipilih pada pendaftaran: ${daftar.join(", ")}`,
      catatan: "Hanya jenis akad dari data pendaftaran; nomor dan tanggal akad tidak tertulis di posita - lengkapi dari bukti akad.",
      kodePola: "s6-akad-referensi",
      asal: "sipp",
    }),
  ];
}

/** 9352-9354: kesepakatan perdamaian di hadapan hakim (ekonomi syariah, gugatan sederhana tanpa mediasi). */
function usulanDamaiEs(k) {
  const m = k.mediasi || null;
  const keluar = [];
  const hasilY1 = m && String(m.hasil || "").toUpperCase() === "Y1";
  const tglMediasi = hasilY1 ? lanjutan.isoKeTampil(m.tgl) : "";
  const tglPerkara = lanjutan.isoKeTampil(k.tglDamai);
  const tgl = tglMediasi || tglPerkara;
  if (tgl) {
    keluar.push(
      butir({
        kode: "9353",
        nilai: tgl,
        keyakinan: tglMediasi ? "cukup" : "ragu",
        kalimat: tglMediasi ? `SIPP mediasi: kesepakatan perdamaian ${tgl}` : `SIPP: tanggal pengesahan perdamaian pada data perkara ${tgl}`,
        catatan: "Tanggal kesepakatan perdamaian di hadapan hakim dari data SIPP; sesuaikan dengan BAS bila berbeda.",
        kodePola: tglMediasi ? "s6-damai-tanggal-mediasi" : "s6-damai-tanggal-perkara",
        asal: "sipp",
      })
    );
  }
  const isi = m && hasilY1 ? lanjutan.htmlKeBaris(m.isi) : "";
  if (isi && isi.length <= 6000) {
    keluar.push(
      butir({
        kode: "9352",
        nilai: isi,
        keyakinan: "cukup",
        kalimat: `SIPP mediasi: ${isi.slice(0, 160)}`,
        catatan: "Disalin dari isian kesepakatan perdamaian di SIPP; periksa bahwa yang tertulis memang butir kesepakatannya.",
        kodePola: "s6-damai-isi",
        asal: "sipp",
      })
    );
    const b = /biaya\s+perkara[^<>;]{0,120}?(?:dibebankan|ditanggung|dibayar|menjadi\s+beban)\s+(?:kepada|oleh)?\s*(Penggugat|Tergugat(?:\s+[IVX]+)?|kedua\s+belah\s+pihak|masing-masing\s+pihak)/i.exec(isi.replace(/<br>/g, " "));
    if (b) {
      keluar.push(
        butir({
          kode: "9354",
          nilai: /kedua|masing/i.test(b[1]) ? "kedua belah pihak secara tanggung renteng" : b[1],
          keyakinan: "ragu",
          kalimat: `SIPP mediasi: ${isi.replace(/<br>/g, " ").slice(Math.max(0, b.index - 20), b.index + b[0].length + 20)}`,
          catatan: "Pihak yang menanggung biaya perkara dibaca dari butir kesepakatan; periksa kalimat sumbernya.",
          kodePola: "s6-damai-biaya",
          asal: "sipp",
        })
      );
    }
  }
  return keluar;
}

/** Tuntutan nominal (nafkah anak, mut'ah, iddah, madliyah) dari petitum, dengan mesin yang sama dengan berkas e-Court. */
const KODE_TUNTUTAN = new Set(["6071", "6072", "6054", "6055", "7120"]);
function usulanTuntutan(posita, petitum) {
  let G;
  try {
    G = require("./isiGugatanService");
  } catch {
    return [];
  }
  const teks = `${P.satuBaris(posita)}\n\nPETITUM\n${P.satuBaris(petitum)}`;
  if (teks.length < 80 || !/nafkah|mut'?ah|madh?iyah|madliyah/i.test(petitum)) return [];
  let r;
  try {
    r = G.susunIsiGugatan({ dokumen: [{ peran: "gugatan", judul: "Gugatan di SIPP", teks }], sebutan: { lawan: "Penggugat", pelaku: "Tergugat" } });
  } catch {
    return [];
  }
  return ((r && r.usulan) || [])
    .filter((u) => KODE_TUNTUTAN.has(String(u.kode)) && String(u.nilai || "").trim())
    .map((u) =>
      butir({
        kode: String(u.kode),
        nilai: u.nilai,
        keyakinan: "ragu",
        kalimat: ((u.sumber && u.sumber[0] && u.sumber[0].kalimat) || "").replace(/^e-Court:\s*Gugatan di SIPP\s*-?\s*/i, "Petitum di SIPP: "),
        catatan: u.catatan || "Nominal yang DITUNTUT di petitum SIPP; besaran yang dikabulkan diputus majelis.",
        kodePola: u.kodePola || `s6-tuntutan-${u.kode}`,
        asal: "posita-gugatan",
      })
    );
}

/* ---------------------------------------------------------------------------
 * Menyusun usulan dari konteks (murni) dan dari SIPP (SELECT)
 * ------------------------------------------------------------------------- */

/**
 * @param {object} k konteks satu perkara:
 *   { jenisPerkaraId, posita, petitum, pihak1: string[], pihak2: string[], tanggalDaftar, tglDamai,
 *     rekonvensi: {tgl, petitum}|null, akad: string[], mediasi: {hasil, tgl, isi}|null, terdahulu: Array<{nomor, tglPutusan, nomorAkta}> }
 * @returns {object[]} usulan
 */
function usulanDariKonteks(k) {
  const jenis = Number(k && k.jenisPerkaraId);
  if (!ADA_JENIS.has(jenis)) return [];
  const keluar = [];
  const ada = new Set();
  const tambah = (daftar) => {
    for (const u of daftar || []) {
      if (!u || !u.kode || ada.has(u.kode)) continue;
      ada.add(u.kode);
      keluar.push(u);
    }
  };

  // (1) data terstruktur SIPP
  tambah(usulanRekonvensi(k.rekonvensi));
  tambah(usulanObjekRekonvensi(k.rekonvensi, jenis));
  if (JENIS_MANTAN_PASANGAN.has(jenis)) tambah(usulanDasarPutus(k.terdahulu));
  if (jenis === 370) tambah(usulanDamaiEs(k));

  // (2) posita + petitum
  let fakta = {};
  try {
    fakta = isiS6.deteksi(jenis, k.posita || "", { petitum: k.petitum || "", namaPihak: k.pihak1 || [], tanggalDaftar: k.tanggalDaftar || "" });
  } catch {
    fakta = {};
  }
  for (const [kode, f] of Object.entries(fakta)) tambah([dariFakta(kode, f)]);
  if (jenis === 370 && !ada.has("9340")) tambah(usulanAkadReferensi(k.akad));
  tambah(require("./isiOtomatisW2b/lain").usulanLain(k, butir)); // W2b-C: Lain-Lain 369 (pengangkatan anak, mafqud, permohonan umum; variabel 4910-4939)

  // (3) tuntutan nominal anak/nafkah
  if (JENIS_ANAK.has(jenis) && (jenis !== 369 || /\bhak\s+asuh|hadh?[ao]nah|nafkah\s+anak|penguasaan\s+anak/i.test(P.satuBaris(k.posita || "")))) {
    tambah(usulanTuntutan(k.posita || "", k.petitum || ""));
  }
  // W2b-B: isian blangko keluarga anak (4884-4905), semua saran "ragu" - isiOtomatisW2b/anak.js
  tambah(require("./isiOtomatisW2b/anak").usulanAnak(k));

  // (4) isian yang memang manual (hanya yang belum terbaca dari data)
  tambah(usulanManual(jenis, ada));
  return keluar;
}

/** Entri "diisi manual" + alasan untuk jenis ini, kecuali kode yang sudah punya usulan. */
function usulanManual(jenis, sudah) {
  const keluar = [];
  for (const [kode, m] of Object.entries(MANUAL)) {
    if (sudah && sudah.has(kode)) continue;
    if (Array.isArray(m.jenis) && !m.jenis.includes(jenis)) continue;
    keluar.push(
      butir({
        kode,
        nilai: "",
        keyakinan: "tidak_ada_sumber",
        kalimat: "",
        catatan: m.alasan,
        kodePola: `s6-manual-${kode}`,
        manual: true,
        opsional: m.opsional === true,
        labelPengguna: m.labelPengguna,
      })
    );
  }
  return keluar;
}

/** Satu pembacaan yang gagal (galat atau penolakan) menjadi null; pembacaan lain jalan terus. */
const diam = (kerja) => {
  try {
    return Promise.resolve(kerja()).catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
};
const satu = (r) => (Array.isArray(r) && r[0]) || null;

/** Membaca konteks satu perkara dari SIPP (HANYA SELECT). null bila bukan jenis S6 (tanpa pembacaan lain). */
async function bacaKonteks(perkaraId, runQuery) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0 || typeof runQuery !== "function") return null;
  const perkara = satu(
    await diam(() =>
      runQuery(
        `SELECT p.jenis_perkara_id AS jenis, p.alur_perkara_id AS alur, p.nomor_perkara AS nomor, p.posita AS posita, p.petitum AS petitum,
                DATE_FORMAT(p.tanggal_pendaftaran, '%Y-%m-%d') AS tanggalDaftar,
                DATE_FORMAT(p.tanggal_pengesahan_perdamaian, '%Y-%m-%d') AS tglDamai
           FROM perkara p WHERE p.perkara_id = ? LIMIT 1`,
        [id]
      )
    )
  );
  if (!perkara) return null;
  const jenis = Number(perkara.jenis);
  if (!ADA_JENIS.has(jenis)) return null;
  const [p1, p2, rek, akad, med] = await Promise.all([
    diam(() => runQuery("SELECT nama FROM perkara_pihak1 WHERE perkara_id = ? ORDER BY urutan", [id])),
    diam(() => runQuery("SELECT nama FROM perkara_pihak2 WHERE perkara_id = ? ORDER BY urutan", [id])),
    diam(() => runQuery("SELECT DATE_FORMAT(tanggal_pendaftaran, '%Y-%m-%d') AS tgl, isi_petitum AS petitum FROM perkara_rekonvensi WHERE perkara_id = ? LIMIT 1", [id])),
    jenis === 370
      ? diam(() => runQuery("SELECT r.nama AS nama FROM perkara_ref_akad_syariah x JOIN ref_akad_syariah r ON r.id = x.ref_id WHERE x.perkara_id = ?", [id]))
      : null,
    jenis === 370
      ? diam(() =>
          runQuery(
            `SELECT m.hasil_mediasi AS hasil, DATE_FORMAT(m.tgl_kesepakatan_perdamaian, '%Y-%m-%d') AS tgl, m.isi_kesepakatan_perdamaian AS isi
               FROM perkara_mediasi m WHERE m.perkara_id = ? ORDER BY (m.hasil_mediasi IS NULL), m.mediasi_id DESC LIMIT 1`,
            [id]
          )
        )
      : null,
  ]);
  const nama1 = (Array.isArray(p1) ? p1 : []).map((x) => String(x.nama || "").trim()).filter(Boolean);
  const nama2 = (Array.isArray(p2) ? p2 : []).map((x) => String(x.nama || "").trim()).filter(Boolean);
  let terdahulu = [];
  if (JENIS_MANTAN_PASANGAN.has(jenis) && nama1[0] && nama2[0]) {
    const r = await diam(() =>
      runQuery(
        `SELECT p.nomor_perkara AS nomor, DATE_FORMAT(pp.tanggal_putusan, '%Y-%m-%d') AS tglPutusan, ac.nomor_akta_cerai AS nomorAkta
           FROM perkara p
           JOIN perkara_pihak1 a ON a.perkara_id = p.perkara_id
           JOIN perkara_pihak2 b ON b.perkara_id = p.perkara_id
           LEFT JOIN perkara_putusan pp ON pp.perkara_id = p.perkara_id
           LEFT JOIN perkara_akta_cerai ac ON ac.perkara_id = p.perkara_id
          WHERE p.jenis_perkara_id IN (346, 347) AND p.perkara_id <> ? AND pp.tanggal_putusan IS NOT NULL
            AND ((a.nama = ? AND b.nama = ?) OR (a.nama = ? AND b.nama = ?))
          ORDER BY pp.tanggal_putusan DESC LIMIT 5`,
        [id, nama1[0], nama2[0], nama2[0], nama1[0]]
      )
    );
    terdahulu = Array.isArray(r) ? r : [];
  }
  return {
    jenisPerkaraId: jenis,
    alur: String(perkara.alur || ""),
    nomor: String(perkara.nomor || ""),
    posita: String(perkara.posita || ""),
    petitum: String(perkara.petitum || ""),
    tanggalDaftar: String(perkara.tanggalDaftar || ""),
    tglDamai: String(perkara.tglDamai || ""),
    pihak1: nama1,
    pihak2: nama2,
    rekonvensi: satu(rek),
    akad: (Array.isArray(akad) ? akad : []).map((x) => x.nama),
    mediasi: satu(med),
    terdahulu,
  };
}

/**
 * Pintu masuk dari dariSipp. `runQuery(sql, params)` = pembaca SIPP baca-saja milik abtUsulanService.
 * Perkara di luar jenis S6 dijawab [] sesudah SATU pembacaan kecil.
 */
async function usulanJenisS6(perkaraId, runQuery) {
  const k = await bacaKonteks(perkaraId, runQuery);
  if (!k) return [];
  return usulanDariKonteks(k);
}

module.exports = {
  JENIS_S6,
  NAMA,
  MANUAL,
  butir,
  usulanRekonvensi,
  usulanObjekRekonvensi,
  usulanDasarPutus,
  usulanAkadReferensi,
  usulanDamaiEs,
  usulanTuntutan,
  usulanManual,
  usulanDariKonteks,
  bacaKonteks,
  usulanJenisS6,
};
