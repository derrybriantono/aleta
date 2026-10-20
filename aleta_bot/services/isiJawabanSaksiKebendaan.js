"use strict";

/**
 * ============================================================================
 * POLA GUGATAN HARTA BERSAMA DAN KEWARISAN UNTUK JAWABAN SAKSI (agen W2a-K1, 21 Okt 2026)
 * ============================================================================
 *
 * MENAMBAH pola dari posita dan petitum gugatan harta bersama (348) dan gugatan kewarisan (364) tanpa mengubah pola yang sudah ada
 * (isiJawabanSaksiPositaLain.js hartaBersama() dan waris() memanggil berkas ini dan menambahkan hasilnya, kunci yang sudah terbaca tidak ditimpa).
 *
 * Dua macam keluaran, keduanya murni (tanpa jaringan), semuanya membawa SUMBER dan TINGKAT YAKIN:
 *
 *   1. fakta untuk jawaban saksi: hartaBersamaLanjut(butir, petitum) / warisLanjut(butir, petitum)
 *      -> [{ kunci, nilai, yakin: "cukup" | "ragu", ket }]   (kunci milik isiJawabanSaksiFakta.js: tglNikah, putusanCerai, hartaPeninggalan, ahliWaris, ...)
 *   2. saran KEADAAN perkara untuk katalog "Susun saksi" (butir mana yang tampil): saranKeadaan(jenis, posita, petitum)
 *      -> [{ kunci, nilai, yakin, sumber: "posita" | "petitum", ket }]   (kunci keadaan katalog: jenisObjek, penguasa, sita, ...)
 *
 * Aturan "otomatisasi berdasar" (keputusan pengguna 18 Okt): sebuah nilai hanya bertingkat "cukup" bila pola itu sudah DIUKUR atas gugatan nyata
 * dan cocok dengan putusan lama; selainnya "ragu - periksa". Hasil ukur ada di abt-paket/w2a-kebendaan/ukur/hasil-ukur.json dan diuji di
 * manajemen_surat/src/test/w2a-k1-hb-waris.test.ts. Yang tertulis saja yang diambil; tidak ada yang disimpulkan.
 */

const { bersihNilai, tanggalIndo, rapat } = require("./isiJawabanSaksiFakta");

const BULAN = "Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember|Pebruari|Nopember";
/** "14 bulan September tahun 2003" -> "14 September 2003" */
const tanpaKataBantu = (t) => String(t || "").replace(/\bbulan\s+/gi, "").replace(/\btahun\s+(?=(?:19|20)\d{2})/gi, "");
const TGL = `\\d{1,2}\\s+(?:${BULAN})\\s+(?:19|20)\\d{2}`;

const potong = (t, maks = 140) => {
  const s = rapat(t);
  if (s.length <= maks) return s;
  const p = s.slice(0, maks);
  return p.slice(0, Math.max(p.lastIndexOf(","), p.lastIndexOf(" "))).trim();
};

/** Teks polos petitum: baris dipisah baris baru (petitum bernomor dipisah di tiap nomor). */
function barisPetitum(petitum) {
  const t = String(petitum == null ? "" : petitum)
    .replace(/\\n/g, "\n")
    .replace(/<\/(li|p|ol|ul|div|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/[ \t]+/g, " ");
  return t
    .split(/\n|;\s+(?=[A-Z0-9])/)
    .map((x) => rapat(x))
    .filter((x) => x.length > 3);
}

const semuaTeks = (butir, petitum) => `${(butir || []).join("\n")}\n${barisPetitum(petitum).join("\n")}`;

// ============================================================================
// Harta bersama
// ============================================================================

const RE_KATA_OBJEK = /\b(?:tanah|rumah|bangunan|ruko|toko|kios|warung|kavling|petak|mobil|motor|sepeda\s+motor|kendaraan|truk|perahu|kapal|mesin|kebun|sawah|ladang|tabungan|rekening|deposito|emas|perhiasan|kulkas|lemari|televisi|sofa|spring\s*bed|usaha|piutang|investasi|saham|ternak|sapi|kambing)\b/i;
const RE_MULAI_OBJEK = /^(?:[-•*]\s*|\(?[a-z0-9]{1,3}[.)]\s*|\d+(?:\.\d+)*\s+)?(?:satu|sebuah|sebidang|seluas|\d+\s*(?:\([^)]*\)\s*)?(?:buah|unit|bidang|kavling|petak|set|ekor|lembar|lusin)?)?\s*(?:buah\s+|unit\s+|bidang\s+|kavling\s+|set\s+)?(?:tanah|rumah|bangunan|ruko|toko|kios|warung|mobil|motor|sepeda|kendaraan|truk|perahu|kapal|mesin|kebun|sawah|tabungan|rekening|deposito|emas|perhiasan|usaha|piutang|uang|investasi|saham|penitipan|ternak|sapi|kambing|kulkas|lemari|televisi|kursi|meja|spring|ac|tv|tabung|perabot|kredit|utang|hutang)/i;

/**
 * Daftar objek yang tertulis sebagai butir/baris sesudah kalimat "harta bersama berupa ..." atau pada petitum.
 * Yang diambil hanya baris yang DIAWALI nama benda (bukan kalimat bantahan atau penguasaan).
 */
function daftarObjek(butir, petitum) {
  const dari = (baris, penanda) => {
    const hasil = [];
    let mulai = penanda ? baris.findIndex((b) => penanda.test(b)) : 0;
    if (mulai < 0) return hasil;
    for (let i = mulai; i < baris.length && hasil.length < 14; i += 1) {
      const b = baris[i];
      if (/\bharta\s+bawaan\b/i.test(b) && i > mulai) break;
      if (/^(?:bahwa\s+)?(?:sehingga\s+jumlah|jumlah\s+(?:seluruh|total)|nilai\s+total|oleh\s+karena|dari\s+perkawinan|hak\s+asuh|harta\s+bawaan|harta\s+bersama\s+tersebut)/i.test(b) && hasil.length) break;
      if (/^(?:sebelah|utara|selatan|timur|barat|batas)/i.test(b)) continue;
      if (RE_MULAI_OBJEK.test(b) && RE_KATA_OBJEK.test(b)) hasil.push(b);
    }
    return hasil;
  };
  const pet = dari(barisPetitum(petitum), /menetapkan\b[^.]{0,120}\bharta|objek\s+sengketa|harta\s+bersama/i);
  if (pet.length) return { daftar: pet, sumber: "petitum" };
  const pos = dari(butir, /(?:memperoleh|mendapat|diperoleh)[^.]{0,80}\bharta\s+bersama|harta\s+bersama\s+berupa|harta\s+(?:gono[- ]?gini|bersama)[^.]{0,30}:/i);
  return { daftar: pos, sumber: "posita" };
}

/** Ringkasan satu objek untuk kalimat: tanpa nomor urut di depan dan tanpa ekor panjang. */
function ringkasObjek(b) {
  return potong(
    bersihNilai(
      String(b)
        .replace(/^(?:[-•*]\s*|\(?[a-z0-9]{1,3}[.)]\s+|\d+(?:\.\d+)+\s+)/i, "")
        .replace(/\s*,?\s*(?:dengan\s+)?batas[- ]?batas.*$/i, "")
        .replace(/\s*(?:yang\s+)?(?:saat\s+ini\s+)?(?:berada\s+)?(?:dalam|di)\s+penguasaan\b.*$/i, "")
        .replace(/\s*senilai\s+Rp.*$/i, "")
    ),
    110
  );
}

function hartaBersamaLanjut(butir, petitum) {
  const hasil = [];
  // tanggal nikah
  // dua bentuk kalimat: "melangsungkan pernikahan pada tanggal 7 Desember 2009" dan "pada tanggal 15 Desember 1990 Penggugat dan Tergugat melangsungkan pernikahan"
  const sesudahPemicu = new RegExp(`\\b(?:melangsungkan|melaksanakan|dilangsungkan|dilaksanakan|menikah|pernikahan|perkawinan)\\b[^.;]{0,100}?(?:pada\\s+)?(?:hari\\s+\\w+\\s*,?\\s*)?(?:tanggal|tgl\\.?)?\\s*(${TGL})`, "i");
  const sebelumPemicu = new RegExp(`\\bpada\\s+(?:hari\\s+\\w+\\s*,?\\s*)?(?:tanggal|tgl\\.?)\\s*(${TGL})[^.;]{0,70}?\\b(?:melangsungkan|melaksanakan|dilangsungkan|dilaksanakan|menikah|akad\\s+nikah|pernikahan)\\b`, "i");
  for (const b of butir) {
    const bb = tanpaKataBantu(b);
    const m = sesudahPemicu.exec(bb) || sebelumPemicu.exec(bb);
    if (m && !/\b(?:cerai|bercerai|putusan|putus\s+karena)\b/i.test(bb.slice(0, bb.toLowerCase().indexOf(m[1].toLowerCase())))) {
      const tgl = tanggalIndo(m[1]);
      if (tgl) {
        hasil.push({ kunci: "tglNikah", nilai: tgl, yakin: "cukup", ket: "Dari kalimat tentang pernikahan pada gugatan harta bersama." });
        break;
      }
    }
  }
  // putusan dan akta cerai
  const nomor = "([0-9A-Za-z]+(?:\\s*[/.\\-]\\s*[0-9A-Za-z.]+){0,6})";
  for (const b of butir) {
    const bb = tanpaKataBantu(b);
    const m = new RegExp(`\\bputusan\\b[^.;]{0,70}?\\b(?:Nomor|No\\.?)\\s*:?\\s*${nomor}[^.;]{0,50}?(?:tertanggal|tanggal|tgl\\.?)\\s*(${TGL})`, "i").exec(bb);
    if (m && /cerai|bercerai|talak|izin\s+ikrar/i.test(bb)) {
      const tgl = tanggalIndo(m[2]);
      if (tgl) {
        hasil.push({ kunci: "putusanCerai", nilai: `Nomor ${m[1].replace(/[\s.,;:]+$/, "").replace(/(?<=[A-Za-z]{2,})Ter$/, "").replace(/\s*\/\s*/g, "/")} tanggal ${tgl}`, yakin: "cukup", ket: "Dari kalimat tentang putusan cerai pada gugatan." });
        break;
      }
    }
  }
  for (const b of butir) {
    const m = new RegExp(`\\bAkta\\s+Cerai\\b[^.;]{0,30}?\\b(?:Nomor|No\\.?)\\s*:?\\s*${nomor}(?:[^.;]{0,30}?(?:tertanggal|tanggal|tgl\\.?)\\s*(${TGL}))?`, "i").exec(tanpaKataBantu(b));
    if (m) {
      const tgl = m[2] ? tanggalIndo(m[2]) : "";
      hasil.push({ kunci: "aktaCerai", nilai: `Nomor ${m[1].replace(/[\s.,;:]+$/, "").replace(/\s*\/\s*/g, "/")}${tgl ? ` tanggal ${tgl}` : ""}`, yakin: "cukup", ket: "Dari kalimat tentang akta cerai pada gugatan." });
      break;
    }
  }
  // daftar objek
  const { daftar, sumber } = daftarObjek(butir, petitum);
  if (daftar.length) {
    const ring = daftar.map(ringkasObjek).filter(Boolean);
    const tampil = ring.slice(0, 3).join("; ") + (ring.length > 3 ? `; dan ${ring.length - 3} objek lainnya` : "");
    hasil.push({ kunci: "hartaPeninggalan", nilai: tampil, yakin: "ragu", ket: `Objek dibaca dari ${sumber} gugatan (${ring.length} objek); periksa kelengkapan dan isi daftar lengkap pada isian objek harta bersama.` });
    hasil.push({ kunci: "jumlahObjek", nilai: String(ring.length), yakin: "ragu", ket: `Jumlah baris objek pada ${sumber} gugatan.` });
  }
  // nilai total yang disebut gugatan
  for (const b of butir) {
    const m = /\b(?:nilai\s+total|jumlah|total)\b[^.;]{0,50}?\bharta\b[^.;]{0,60}?Rp\.?\s*([\d.,]{5,})/i.exec(b);
    if (m) {
      hasil.push({ kunci: "nilaiTotalHarta", nilai: `Rp ${m[1].replace(/[.,]+$/, "")}`, yakin: "ragu", ket: "Angka total harta pada gugatan (dalil Penggugat, bukan penilaian saksi)." });
      break;
    }
  }
  return hasil;
}

// ============================================================================
// Kewarisan
// ============================================================================

/** Nama orang di awal baris daftar ahli waris: tanpa sebutan "Bapak/Ibu/Sdr", berhenti sebelum kurung, koma, "selaku", "adalah". */
const RE_NAMA_AHLI = /^(?:[-•*]\s*|\d{1,2}[.)]\s*)?(?:(?:Bapak|Ibu|Sdr\.?|Sdri\.?|Saudara|Saudari|H\.|Hj\.)\s+)?([A-Z][A-Za-z.'`-]*(?:\s+(?:bin|binti|Bin|Binti|alias|[A-Z][A-Za-z.'`-]*)){0,6})(?=\s*(?:[(,;:]|$|\s+(?:selaku|adalah|sebagai|ahli|anak|istri|isteri|suami)\b))/;

function warisLanjut(butir, petitum) {
  const hasil = [];
  const pet = barisPetitum(petitum);
  // ahli waris: baris petitum sesudah "Menetapkan ... ahli waris ..."
  const iAhli = pet.findIndex((b) => /\bmenetapkan\b[^.]{0,80}\bahli\s+waris\b/i.test(b));
  if (iAhli >= 0) {
    const nama = [];
    const dariBaris = (b) => {
      const sesudah = b.replace(/^.*\bahli\s+waris\b[^:]{0,60}:?/i, "");
      return sesudah.length > 3 ? sesudah : "";
    };
    const awal = dariBaris(pet[iAhli]);
    const kandidat = [awal, ...pet.slice(iAhli + 1, iAhli + 14)];
    for (const b of kandidat) {
      if (!b) continue;
      if (/^menetapkan\b/i.test(b) || /\bharta\s+peninggalan\b/i.test(b)) break;
      const m = RE_NAMA_AHLI.exec(b);
      if (m && nama.length < 12) {
        const hub = /\(([^()]{3,70}(?:\([^()]*\))?[^()]{0,30})\)/.exec(b);
        const sebagai = /\b(?:selaku|sebagai)\s+(?:Penggugat|Tergugat|Turut\s+Tergugat)[^,;]{0,12}\s+adalah\s+([a-z][^,;.]{3,40})/i.exec(b);
        const hubungan = hub ? hub[1].replace(/^(?:ahli\s+waris\s+dari\s+)/i, "ahli waris dari ").trim() : sebagai ? sebagai[1].trim() : "";
        nama.push(`${bersihNilai(m[1])}${hubungan ? ` (${potong(hubungan, 50)})` : ""}`);
      }
    }
    if (nama.length) hasil.push({ kunci: "ahliWaris", nilai: nama.join("; "), yakin: "ragu", ket: `Daftar ahli waris dibaca dari petitum (${nama.length} baris); periksa nama dan hubungannya.` });
  }
  // harta peninggalan: baris petitum sesudah "Menetapkan harta peninggalan ..."
  const iHarta = pet.findIndex((b) => /\bmenetapkan\b[^.]{0,80}\bharta\s+(?:peninggalan|warisan|waris)\b/i.test(b));
  if (iHarta >= 0) {
    const objek = [];
    for (const b of pet.slice(iHarta, iHarta + 24)) {
      if (objek.length && /^(?:menetapkan|menghukum|meletakkan|membebankan|menyatakan|apabila|subsidair)/i.test(b)) break;
      if (/^(?:utara|selatan|timur|barat|sebelah|batas)/i.test(b)) continue;
      if (/\b(?:objek|obyek)\s*(?:\w+|\([^)]*\))\s*:?$/i.test(b) || (RE_KATA_OBJEK.test(b) && b.length > 12)) {
        if (!/^menetapkan\b/i.test(b)) objek.push(b);
      }
    }
    if (objek.length) {
      const ring = objek.map(ringkasObjek).filter(Boolean);
      hasil.push({ kunci: "hartaPeninggalan", nilai: ring.slice(0, 3).join("; ") + (ring.length > 3 ? `; dan ${ring.length - 3} objek lainnya` : ""), yakin: "ragu", ket: `Objek dibaca dari petitum (${ring.length} baris); periksa kelengkapan dan isi daftar lengkap pada isian harta peninggalan.` });
    }
  }
  // meninggal dunia dengan kalimat "Pada Tanggal 1 Agustus 1989 telah meninggal ayah kandung Penggugat yang bernama PAKU di Desa ..."
  for (const b of butir) {
    const m = new RegExp(`\\bpada\\s+tanggal\\s+(${TGL})\\s+telah\\s+meninggal(?:\\s+dunia)?\\s+(?:\\w+\\s+){0,4}?(?:yang\\s+)?bernama\\s+([A-Z][A-Za-z.'\`-]*(?:\\s+(?:bin|binti|Bin|Binti|[A-Z][A-Za-z.'\`-]*)){0,5})`, "i").exec(tanpaKataBantu(b));
    if (m) {
      const tgl = tanggalIndo(m[1]);
      if (tgl) {
        hasil.push({ kunci: "wafatTgl", nilai: tgl, yakin: "ragu", ket: "Dari kalimat 'pada tanggal ... telah meninggal ... bernama ...' pada gugatan; kalimat itu bisa tentang ayah atau ibu pewaris, periksa." });
        break;
      }
    }
  }
  return hasil;
}

// ============================================================================
// Saran keadaan perkara (butir mana yang tampil di katalog Susun saksi)
// ============================================================================

const ADA = (re, teks) => re.test(teks);
const tanpaSangkal = (teks, re) => {
  const g = new RegExp(re.source, "gi");
  let m;
  while ((m = g.exec(teks))) {
    const depan = teks.slice(Math.max(0, m.index - 30), m.index);
    if (!/\b(?:tidak|belum|bukan|tanpa)\s+(?:pernah\s+|ada\s+|memiliki\s+|mempunyai\s+|meninggalkan\s+|membuat\s+|mengadakan\s+|melakukan\s+|menandatangani\s+|menghibahkan\s+|berwasiat\s+|punya\s+)*$/i.test(depan)) return true;
  }
  return false;
};

const JENIS_OBJEK = [
  ["tanah-bangunan", /\b(?:tanah|rumah(?!\s+tangga)|bangunan|ruko|toko|kavling|petak|kos-kosan|pekarangan)\b/i, "cukup"],
  ["kendaraan", /\b(?:mobil|motor|sepeda\s+motor|kendaraan|truk|pick\s*up|perahu|kapal|bpkb)\b/i, "cukup"],
  ["kebun-ternak", /\b(?:kebun|sawah|ladang|ternak|sapi|kambing|pohon|kelapa|cengkeh|kakao|coklat)\b/i, "cukup"],
  ["rekening-uang", /\b(?:tabungan|rekening|deposito|uang\s+tunai|dana\s+simpanan|simpanan)\b/i, "ragu"],
  ["perhiasan-perabot", /\b(?:emas|perhiasan|perabot|kulkas|lemari|televisi|sofa|spring\s*bed|mesin\s+cuci|kursi|meja|elektronik)\b/i, "cukup"],
  ["usaha", /\b(?:usaha(?!\s+(?:mereka|bersama\s+untuk))|perusahaan|dagangan|stok\s+barang|modal\s+usaha|bengkel|kios|warung)\b/i, "ragu"],
  ["utang", /\b(?:utang|hutang|kredit|pinjaman|angsuran|cicilan)\b/i, "ragu"],
  ["piutang", /\bpiutang\b/i, "ragu"],
  ["asuransi-pensiun", /\b(?:asuransi|pensiun|tabungan\s+haji|bpjs|taspen|jaminan\s+hari\s+tua)\b/i, "ragu"],
  ["investasi", /\b(?:investasi|saham|penitipan\s+modal|penyertaan\s+modal|titip\s+modal)\b/i, "ragu"],
];

/** Subjek penguasaan: kembali "lawan" (Tergugat), "pengaju" (Penggugat), "campur" atau "". */
function penguasaDari(teks) {
  const lawan = /\b(?:dikuasai|dalam\s+penguasaan|dipegang|ditempati|dikelola|dikuasakan)\b[^.;]{0,60}?\b(?:oleh\s+)?Tergugat/i;
  const pengaju = /\b(?:dikuasai|dalam\s+penguasaan|dipegang|ditempati|dikelola)\b[^.;]{0,60}?\b(?:oleh\s+)?Penggugat/i;
  const a = lawan.test(teks);
  const b = pengaju.test(teks);
  if (a && b) return "campur";
  if (a) return "lawan";
  if (b) return "pengaju";
  return "";
}

function saranKeadaanHb(posita, petitum) {
  const butir = typeof posita === "string" ? butirDariTeks(posita) : posita || [];
  const teks = semuaTeks(butir, petitum);
  const hasil = [];
  const tambah = (kunci, nilai, yakin, sumber, ket) => hasil.push({ kunci, nilai, yakin, sumber, ket });
  const { daftar } = daftarObjek(butir, petitum);
  const teksPetitum = barisPetitum(petitum).join("\n");
  const dasarObjek = daftar.length ? daftar.join("\n") : RE_KATA_OBJEK.test(teksPetitum) ? teksPetitum : "";
  const jenis = [];
  for (const [nama, re, yakin] of JENIS_OBJEK) if (ADA(re, dasarObjek)) jenis.push([nama, yakin]);
  if (jenis.length) tambah("jenisObjek", jenis.map((x) => x[0]), "ragu", daftar.length ? "daftar objek gugatan" : "petitum gugatan", "Jenis objek dari kata benda pada daftar objek gugatan; hanya saran, periksa.");
  const pk = penguasaDari(teks);
  if (pk === "lawan" || pk === "pengaju") tambah("penguasa", pk, "ragu", "kalimat gugatan", "Dari kalimat 'dikuasai/dalam penguasaan ...' pada gugatan.");
  // bukan kunci keadaan katalog (penguasa hanya satu nilai): keterangan untuk petugas agar memilih sesuai objek yang diterangkan saksi
  if (pk === "campur") tambah("penguasaCampur", "lawan dan pengaju", "ragu", "kalimat gugatan", "Gugatan menyebut sebagian objek dikuasai Penggugat dan sebagian Tergugat: pilih keadaan penguasa sesuai objek yang diterangkan saksi.");
  if (/\bsita\s+(?:jaminan|marital|konservatoir|conservatoir)|conservatoir\s+beslag|\bsita\b[^.;]{0,30}\bharta\s+bersama/i.test(teks)) {
    const sudah = /\b(?:telah|sudah)\s+(?:dilakukan|diletakkan)\s+sita|penetapan\s+sita|berita\s+acara\s+(?:peletakan\s+)?sita/i.test(teks);
    if (sudah) tambah("sita", "ada", "ragu", "petitum/posita", "Gugatan menyebut sita sudah diletakkan; periksa penetapan sita.");
    else tambah("sitaDiminta", "ya", "ragu", "petitum/posita", "Gugatan hanya MEMINTA sita jaminan (hampir semua gugatan memintanya, jauh lebih sedikit yang benar-benar disita): tandai keadaan sita bila penetapan sita sudah dijatuhkan.");
  }
  if (/\b(?:seperdua|setengah|separuh|separo|sebesar\s+50\s*%|50\s*%|1\s*\/\s*2|½)\b/i.test(teks)) tambah("pembagianDiminta", "seperdua", "ragu", "petitum/posita", "Gugatan meminta pembagian seperdua.");
  else if (/\b(?:2\s*\/\s*3|sepertiga|1\s*\/\s*3|dua\s+pertiga)\b/i.test(teks)) tambah("pembagianDiminta", "tidak-sama", "ragu", "petitum/posita", "Gugatan menyebut bagian selain seperdua.");
  if (/\bistri\s+(?:kedua|lain|muda|pertama)|\bpoligami\b|\bmenikah\s+lagi\b|\bmenikah\s+siri\b/i.test(teks)) tambah("poligami", "ya", "ragu", "kalimat gugatan", "Gugatan menyebut perkawinan lain; periksa.");
  if (tanpaSangkal(teks, /\bperjanjian\s+(?:perkawinan|pra\s*nikah|pisah\s+harta)\b/i)) tambah("perjanjianKawin", "ada", "ragu", "kalimat gugatan", "Gugatan menyebut perjanjian perkawinan; periksa apakah ada atau dibantah.");
  if (tanpaSangkal(teks, /\b(?:agunan|dijaminkan|jaminan\s+kredit|digadaikan|sertifikat\s+asli[^.;]{0,40}agunan)\b/i)) tambah("agunan", "ada", "ragu", "kalimat gugatan", "Gugatan menyebut objek menjadi agunan atau jaminan utang.");
  if (/\b(?:disewakan|uang\s+sewa|hasil\s+(?:panen|sewa|usaha)|rumah\s+kos|kos-kosan|petak\s+kos)\b/i.test(teks)) tambah("hasilObjek", "ada", "ragu", "kalimat gugatan", "Gugatan menyebut hasil sewa atau panen dari objek.");
  if (/\b(?:nilai\s+pasar|taksiran|NJOP|harga\s+pasar|senilai|seharga)\b[^.;]{0,50}Rp/i.test(teks)) tambah("taksiran", "ada", "ragu", "kalimat gugatan", "Gugatan menyebut nilai pasar atau taksiran objek.");
  if (/\b(?:kredit|angsur|cicil)\w*\b/i.test(teks)) tambah("sumberDana", ["kredit-bank"], "ragu", "kalimat gugatan", "Gugatan menyebut kredit atau angsuran.");
  if (/\bsertifikat|\bSHM\b|\bhak\s+milik\b/i.test(teks)) tambah("statusTanah", "bersertifikat", "ragu", "kalimat gugatan", "Gugatan menyebut sertifikat.");
  else if (/\b(?:girik|segel|surat\s+keterangan\s+(?:tanah|kepala\s+desa)|kwitansi\s+pembelian|belum\s+bersertifikat)\b/i.test(teks)) tambah("statusTanah", "belum-bersertifikat", "ragu", "kalimat gugatan", "Gugatan menyebut surat tanah selain sertifikat.");
  const meninggal = /\b(Tergugat|Penggugat)\s+(?:telah\s+)?(?:meninggal|wafat)\b/i.exec(teks);
  if (meninggal) tambah("pihakMeninggal", /^tergugat$/i.test(meninggal[1]) ? "lawan" : "pengaju", "ragu", "kalimat gugatan", "Gugatan menyebut salah satu pihak meninggal dunia; periksa siapa yang meninggal.");
  if (/\b(?:bersepakat|kesepakatan|musyawarah|kekeluargaan)\b[^.;]{0,80}\b(?:bagi|pembagian|harta)\b/i.test(teks)) tambah("kesepakatan", "ada", "ragu", "kalimat gugatan", "Gugatan menyebut upaya atau kesepakatan pembagian secara kekeluargaan.");
  return hasil;
}

function saranKeadaanWaris(posita, petitum) {
  const butir = typeof posita === "string" ? butirDariTeks(posita) : posita || [];
  const teks = semuaTeks(butir, petitum);
  const hasil = [];
  const tambah = (kunci, nilai, yakin, sumber, ket) => hasil.push({ kunci, nilai, yakin, sumber, ket });
  const ahli = [];
  if (/\b(?:anak\s+(?:kandung|pertama|kedua|ketiga|keempat|kelima|keenam|ketujuh|kedelapan)|anak-anak|putra|putri)\b/i.test(teks)) ahli.push("anak");
  if (/\b(?:ayah|ibu|bapak|orang\s*tua)\s+(?:kandung\s+)?(?:pewaris|almarhum|alm\.?)|\b(?:ayah|ibu)\s+kandung\s+Penggugat\b/i.test(teks)) ahli.push("orang-tua");
  if (/\b(?:saudara\s+(?:kandung|seayah|seibu|laki-laki|perempuan)|kakak\s+kandung|adik\s+kandung)\b/i.test(teks)) ahli.push("saudara");
  if (/\bahli\s+waris\s+(?:dari|pengganti)\s+(?:alm|almh|almarhum)|\bahli\s+waris\s+pengganti\b|\bcucu\b/i.test(teks)) ahli.push("cucu-pengganti");
  if (/\b(?:tidak\s+diketahui\s+keberadaannya|tidak\s+diketahui\s+(?:alamat|tempat\s+tinggal)|keberadaannya\s+tidak\s+diketahui|hilang|ghaib|gaib)\b/i.test(teks)) ahli.push("ahli-waris-gaib");
  if (/\b(?:anak\s+angkat|anak\s+asuh|nikah\s+siri|perkawinan\s+tidak\s+tercatat)\b/i.test(teks)) ahli.push("hubungan-khusus");
  if (ahli.length) tambah("ahliWaris", ahli, "ragu", "kalimat gugatan", "Golongan ahli waris dari kata hubungan pada gugatan; periksa daftar ahli waris.");
  if (/\b(?:istri|isteri|suami|janda|duda)\s+(?:pewaris|almarhum|alm\.?)|\bmenikah\s+dengan\b|\bmeninggalkan\s+(?:seorang\s+)?(?:istri|isteri|suami)\b/i.test(teks)) tambah("statusPewaris", "menikah", "ragu", "kalimat gugatan", "Gugatan menyebut suami atau istri pewaris.");
  if (/\b(?:ayah|ibu|orang\s*tua)\b[^.;]{0,40}\b(?:telah\s+)?(?:meninggal|wafat)\s+(?:lebih\s+(?:dulu|dahulu)|terlebih\s+dahulu)/i.test(teks)) tambah("orangTua", "meninggal-lebih-dahulu", "ragu", "kalimat gugatan", "Gugatan menyebut orang tua pewaris meninggal lebih dahulu.");
  const jenis = [];
  for (const [nama, re, yakin] of JENIS_OBJEK) if (["tanah-bangunan", "kendaraan", "kebun-ternak", "rekening-uang", "usaha", "perhiasan-perabot"].includes(nama) && ADA(re, teks)) jenis.push([nama === "kebun-ternak" ? "kebun-sawah" : nama === "rekening-uang" ? "uang-simpanan" : nama, yakin]);
  if (jenis.length) tambah("jenisHarta", jenis.map((x) => x[0]), "ragu", "kalimat gugatan", "Jenis harta dari kata benda pada gugatan; periksa daftar harta peninggalan.");
  if (/\b(?:harta\s+bersama|gono[- ]?gini|selama\s+(?:masa\s+)?(?:perkawinan|pernikahan)|dicari\s+bersama)\b/i.test(teks)) tambah("asalHarta", "bersama-pasangan", "ragu", "kalimat gugatan", "Gugatan menyebut harta yang diperoleh selama perkawinan pewaris.");
  else if (/\b(?:warisan|peninggalan)\s+(?:dari\s+)?(?:orang\s*tua|leluhur|kakek|nenek)\b|\bpeninggalan\s+orang\s*tua\b/i.test(teks)) tambah("asalHarta", "warisan-leluhur", "ragu", "kalimat gugatan", "Gugatan menyebut harta berasal dari warisan orang tua atau leluhur pewaris.");
  const pk = penguasaDari(teks);
  if (pk === "lawan" || pk === "pengaju") tambah("penguasa", pk, "ragu", "kalimat gugatan", "Dari kalimat 'dikuasai/dalam penguasaan ...' pada gugatan.");
  if (/\bdikuasai\s+(?:secara\s+)?sepihak\b|\bdikuasai\s+oleh\s+(?:Tergugat|para\s+Tergugat)/i.test(teks) && pk !== "lawan") tambah("penguasa", "lawan", "ragu", "kalimat gugatan", "Gugatan menyebut harta dikuasai sepihak.");
  if (/\bsita\s+(?:jaminan|marital|konservatoir|conservatoir)|conservatoir\s+beslag/i.test(teks)) {
    if (/\b(?:telah|sudah)\s+(?:dilakukan|diletakkan)\s+sita|penetapan\s+sita|berita\s+acara\s+(?:peletakan\s+)?sita|sita\b[^.;]{0,60}\bsah\s+dan\s+berharga/i.test(teks)) tambah("sita", "ada", "ragu", "petitum/posita", "Gugatan menyebut sita sudah diletakkan atau meminta pengesahannya; periksa penetapan sita.");
    else tambah("sitaDiminta", "ya", "ragu", "petitum/posita", "Gugatan hanya MEMINTA sita jaminan: tandai keadaan sita bila penetapan sita sudah dijatuhkan.");
  }
  if (tanpaSangkal(teks, /\b(?:utang|hutang)\s+(?:pewaris|almarhum|alm\.?)|\bpewaris\b[^.;]{0,40}\b(?:utang|hutang)\b/i)) tambah("hutang", "ada", "ragu", "kalimat gugatan", "Gugatan menyebut hutang pewaris.");
  if (tanpaSangkal(teks, /\bwasiat\b/i) && !/\bc\.\s*wasiat\b/i.test(teks)) tambah("wasiat", "ada", "ragu", "kalimat gugatan", "Gugatan menyebut wasiat (kutipan Pasal 49 tentang kewenangan tidak dihitung).");
  if (tanpaSangkal(teks, /\b(?:dihibahkan|menghibahkan|hibah)\b/i) && !/\bd\.\s*hibah\b/i.test(teks)) tambah("hibahSemasaHidup", "ada", "ragu", "kalimat gugatan", "Gugatan menyebut hibah.");
  if (tanpaSangkal(teks, /\banak\s+angkat\b/i)) tambah("anakAngkat", "ada", "ragu", "kalimat gugatan", "Gugatan menyebut anak angkat.");
  if (/\b(?:non[- ]?muslim|beragama\s+(?:Kristen|Katolik|Hindu|Budha|Buddha|Protestan)|berpindah\s+agama|murtad)\b/i.test(teks)) tambah("bedaAgama", "ada", "ragu", "kalimat gugatan", "Gugatan menyebut kerabat beda agama.");
  if (/\b(?:istri|isteri)\s+(?:kedua|lain|muda)|\bpoligami\b/i.test(teks)) tambah("jumlahPasangan", "lebih-dari-satu", "ragu", "kalimat gugatan", "Gugatan menyebut istri lain pewaris.");
  if (/\b(?:bercerai|akta\s+cerai|perceraian)\b[^.;]{0,60}\b(?:pewaris|almarhum|alm\.?)|\b(?:pewaris|almarhum|alm\.?)\b[^.;]{0,60}\b(?:bercerai|akta\s+cerai)\b/i.test(teks)) tambah("statusPasangan", "bercerai", "ragu", "kalimat gugatan", "Gugatan menyebut perceraian pewaris.");
  if (/\b(?:di\s+luar\s+nikah|di\s+luar\s+perkawinan|anak\s+luar\s+kawin)\b/i.test(teks)) tambah("anakLuarNikah", "ada", "ragu", "kalimat gugatan", "Gugatan menyebut anak di luar perkawinan.");
  if (/\bbelum\s+dewasa|\bdi\s+bawah\s+umur\b|\bdi\s+bawah\s+pengampuan\b/i.test(teks)) tambah("ahliWarisBelumDewasa", "ada", "ragu", "kalimat gugatan", "Gugatan menyebut ahli waris di bawah umur.");
  if (/\bbelum\s+(?:pernah\s+)?dibagi|\bbelum\s+dibagikan\b/i.test(teks) === false && /\bsudah\s+dibagi\b/i.test(teks)) tambah("kesepakatan", "ada", "ragu", "kalimat gugatan", "Gugatan menyebut pembagian yang sudah dilakukan.");
  return hasil;
}

function butirDariTeks(posita) {
  return String(posita == null ? "" : posita)
    .replace(/\\n/g, "\n")
    .replace(/<\/(li|p|ol|ul|div|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .split(/\n|;\s+/)
    .map((k) => k.replace(/^\s*(?:\d+[.)]\s*)?(?:bahwa\s+)?/i, "").replace(/\s+/g, " ").trim())
    .filter((k) => k.length > 8);
}

/**
 * @param {"hb"|"waris"} jenis
 * @param {string|string[]} posita  HTML/teks posita atau butir
 * @param {string} petitum          HTML/teks petitum (boleh kosong)
 */
function saranKeadaan(jenis, posita, petitum) {
  try {
    if (jenis === "hb") return saranKeadaanHb(posita, petitum);
    if (jenis === "waris") return saranKeadaanWaris(posita, petitum);
  } catch (_galat) {
    /* tanpa saran */
  }
  return [];
}

module.exports = { hartaBersamaLanjut, warisLanjut, saranKeadaan, saranKeadaanHb, saranKeadaanWaris, daftarObjek, ringkasObjek, barisPetitum, butirDariTeks, penguasaDari, JENIS_OBJEK };
