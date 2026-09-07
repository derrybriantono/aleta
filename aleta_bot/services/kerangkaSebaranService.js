"use strict";

/**
 * ============================================================================
 * KERANGKA SEBARAN - BENTUK PENILAIAN KEDUA
 * ============================================================================
 *
 * Kerangka penilaian yang pertama menjawab satu bentuk pertanyaan: "berapa
 * bagian yang memenuhi?" Tiap baris buktinya menjawab tegas - memenuhi atau
 * tidak - dan dari situ lahir nilai nol sampai seratus.
 *
 * Empat puluh sembilan butir katalog bukan pertanyaan seperti itu.
 *
 *     "Sebaran jenis perkara" tidak punya baris yang memenuhi.
 *     "Sebaran umur para pihak" tidak punya penyebut yang bermakna.
 *     "Profil upaya hukum" tidak dapat benar atau salah.
 *
 * Butir seperti itu adalah FOTO KEADAAN, bukan daftar hadir. Memaksakannya ke
 * dalam bentuk pertama menuntut mengarang jawaban "memenuhi" pada baris yang
 * tidak menjawab apa pun - dan begitu satu penilaian punya angka yang tidak
 * dapat dibuka menjadi daftar bukti, tidak ada lagi alasan menolak yang kedua.
 *
 * ============================================================================
 * ATURAN YANG PALING MENENTUKAN: TIDAK PERNAH ADA NILAI
 * ============================================================================
 *
 * Butir sebaran TIDAK menghasilkan angka nol sampai seratus. Tidak sekali pun,
 * tidak dalam keadaan apa pun.
 *
 * Godaannya nyata: begitu ada sebaran, seseorang akan bertanya "jadi berapa
 * nilainya?" - dan jawaban apa pun yang diberikan akan menjadi karangan, sebab
 * tidak ada yang dapat disebut benar atau salah pada sebaran. Sebaran jenis
 * perkara yang timpang bukan prestasi buruk; ia hanya gambaran perkara yang
 * masuk.
 *
 * Kerangka ini karena itu tidak punya jalan untuk menghasilkan nilai sama
 * sekali, dan penjaganya menolak butir yang mencoba menyelundupkannya.
 *
 * ============================================================================
 * YANG TETAP DIWARISI DARI KERANGKA PERTAMA
 * ============================================================================
 *
 *   1. Angka DITURUNKAN dari daftar barisnya. Jumlah tiap kelompok dihitung
 *      dari baris yang sama yang dapat dibuka orang, sehingga keduanya tidak
 *      mungkin berbeda.
 *
 *   2. Cakupan data disebutkan. Baris yang kelompoknya kosong tidak dibuang -
 *      ia dihitung sebagai "tidak terkategori", dan justru itulah temuannya.
 *
 *   3. Ruas yang diketik bebas ditandai keras. Sebaran atas 2.115 tulisan
 *      pekerjaan yang berbeda-beda bukan sebaran pekerjaan - ia sebaran EJAAN.
 *
 *   4. Terlalu sedikit baris berarti gambarnya belum dapat disimpulkan, dan
 *      itu dikatakan - bukan didiamkan.
 */

const periode = require("./periodePenilaianService");
const ambang = require("./ambangPenilaianService");

/**
 * Batas jumlah baris di bawah mana sebaran belum dapat disimpulkan.
 *
 * Berbeda dari pembatas penyebut pada kerangka pertama: di sana nilainya
 * DITAHAN, di sini gambarnya tetap ditampilkan. Sebaran dari lima belas baris
 * tetap sebaran yang benar - ia hanya belum boleh dipakai menyimpulkan
 * kebiasaan. Menyembunyikannya justru menghilangkan satu-satunya data yang ada.
 */
const CUKUP_MENYIMPULKAN = 30;

/** Berapa banyak tulisan berbeda sebelum sebuah ruas dianggap tidak baku. */
const BATAS_TULISAN_BERBEDA = 25;

const TERDAFTAR = Object.create(null);

function bersih(x) {
  return typeof x === "string" ? x.trim() : "";
}

/**
 * Apakah sebuah kategori benar-benar terisi?
 *
 * Sama dengan aturan pada penilaian integritas: spasi, tanda hubung, dan angka
 * nol tunggal bukan isi. Sebaran yang menghitung "0" sebagai satu kelompok
 * akan menampilkan kelompok terbesar bernama nol - dan itu bukan kategori,
 * melainkan ruas yang dilewati orang.
 */
function berkategori(nilai) {
  const s = bersih(nilai === null || nilai === undefined ? "" : String(nilai));
  if (!s) return false;
  if (/^[-.,_/\\\s]+$/.test(s)) return false;
  if (/^0+$/.test(s)) return false;
  return true;
}

/**
 * Cela pada definisi butir sebaran.
 *
 * Bentuknya sengaja mirip celaDefinisi pada kerangka pertama, tetapi
 * tuntutannya berbeda di dua tempat: butir sebaran WAJIB menyatakan apakah
 * kategorinya berasal dari ruas berkode atau ruas bebas, dan TIDAK BOLEH
 * membawa apa pun yang menghasilkan nilai.
 */
function celaDefinisi(def) {
  const cela = [];
  if (!def || typeof def !== "object") return ["definisi bukan objek"];

  if (!bersih(def.kunci)) cela.push("kunci kosong");
  else if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(bersih(def.kunci))) {
    cela.push(`kunci "${def.kunci}" harus diawali huruf dan hanya memuat huruf, angka, atau garis bawah`);
  }

  if (!bersih(def.judul)) cela.push("judul kosong");
  if (!bersih(def.keterangan)) cela.push("keterangan kosong");
  if (!bersih(def.versiRumus)) cela.push("versiRumus kosong");

  if (typeof def.baris !== "function") {
    cela.push("tidak punya baris() - butir sebaran wajib dapat menyebutkan baris penyusun kelompoknya");
  }

  if (!bersih(def.ruasKategori)) {
    cela.push("ruasKategori kosong - butir sebaran wajib menyebut ruas mana yang menjadi kelompoknya");
  }

  // Inilah tuntutan yang khas kerangka ini. Ruas yang diketik bebas
  // menghasilkan sebaran EJAAN, bukan sebaran hal yang dimaksud - dan itu
  // harus dinyatakan di muka, bukan ditemukan orang saat melihat hasilnya.
  if (typeof def.ruasBebas !== "boolean") {
    cela.push("ruasBebas wajib dinyatakan - true bila kategorinya diketik bebas di SIPP, false bila berkode");
  } else if (def.ruasBebas && bersih(def.catatanBebas).length < 40) {
    cela.push("ruas bebas WAJIB disertai catatanBebas yang menerangkan apa yang menjadi risikonya");
  } else if (!def.ruasBebas && bersih(def.catatanBebas)) {
    cela.push("ruas berkode tidak boleh membawa catatanBebas");
  }

  // Butir sebaran tidak boleh punya jalan apa pun menuju nilai.
  ["memenuhi", "ambangNilai", "nilai", "lantaiNilai"].forEach((k) => {
    if (Object.prototype.hasOwnProperty.call(def, k)) {
      cela.push(`butir sebaran tidak boleh membawa "${k}" - sebaran tidak menghasilkan nilai`);
    }
  });

  const ch = def.caraHitung;
  if (!ch || typeof ch !== "object") {
    cela.push("tidak punya caraHitung - butir sebaran wajib menerangkan dari mana kelompoknya datang");
  } else {
    [
      ["kelompok", "apa yang menjadi kelompoknya"],
      ["baris", "satu baris itu apa"],
      ["dikecualikan", "apa yang sengaja tidak ikut dihitung"],
      ["tabelSumber", "tabel SIPP yang dibaca"],
      ["ruasSumber", "ruas yang dibaca"],
    ].forEach(([kunci, arti]) => {
      const isi = bersih(ch[kunci]);
      if (!isi) cela.push(`caraHitung.${kunci} kosong - ${arti}`);
      else if (isi.length < 8) cela.push(`caraHitung.${kunci} terlalu pendek untuk menerangkan apa pun`);
    });
  }

  return cela;
}

function daftarkan(def) {
  const cela = celaDefinisi(def);
  if (cela.length) {
    throw new Error(`Butir sebaran "${def && def.kunci}" ditolak: ${cela.join("; ")}`);
  }
  TERDAFTAR[bersih(def.kunci)] = def;
}

function lupakanSemua() {
  Object.keys(TERDAFTAR).forEach((k) => {
    delete TERDAFTAR[k];
  });
}

function ambil(kunci) {
  const k = bersih(kunci);
  return Object.prototype.hasOwnProperty.call(TERDAFTAR, k) ? TERDAFTAR[k] : null;
}

function daftar() {
  return Object.keys(TERDAFTAR)
    .sort()
    .map((k) => {
      const d = TERDAFTAR[k];
      return {
        kunci: d.kunci,
        judul: d.judul,
        keterangan: d.keterangan,
        versiRumus: d.versiRumus,
        ruasKategori: d.ruasKategori,
        ruasBebas: Boolean(d.ruasBebas),
        catatanBebas: d.catatanBebas || "",
        caraHitung: { ...d.caraHitung },
        bentuk: "sebaran",
      };
    });
}

/**
 * Menghitung sebaran satu satuan periode.
 *
 * Yang dipulangkan bukan nilai, melainkan gambar: daftar kelompok beserta
 * jumlah dan bagiannya, ditambah tiga keterangan yang menentukan apakah gambar
 * itu boleh dipercaya - cakupan, jumlah tulisan berbeda, dan kecukupan baris.
 */
async function hitungSatuan(def, unit) {
  const rentang = { mulai: unit.mulai, selesai: unit.selesai, unit };

  const baris = await def.baris(rentang);
  if (!Array.isArray(baris)) {
    throw new Error(`baris() pada "${def.kunci}" tidak memulangkan larik`);
  }
  baris.forEach((b, i) => {
    if (!b || typeof b !== "object") throw new Error(`baris ke-${i + 1} pada "${def.kunci}" bukan objek`);
    if (!Object.prototype.hasOwnProperty.call(b, "kategori")) {
      throw new Error(`baris ke-${i + 1} pada "${def.kunci}" tidak punya ruas kategori`);
    }
  });

  const jumlahBaris = baris.length;
  const terkategori = baris.filter((b) => berkategori(b.kategori));
  const takTerkategori = jumlahBaris - terkategori.length;

  const hitung = new Map();
  terkategori.forEach((b) => {
    const k = String(b.kategori).trim();
    hitung.set(k, (hitung.get(k) || 0) + 1);
  });

  const kelompok = [...hitung.entries()]
    .map(([nama, jumlah]) => ({
      nama,
      jumlah,
      bagian: terkategori.length ? Number(((jumlah / terkategori.length) * 100).toFixed(1)) : null,
    }))
    .sort((a, b) => b.jumlah - a.jumlah || a.nama.localeCompare(b.nama, "id"));

  // Jumlah seluruh kelompok HARUS sama dengan baris yang terkategori. Bila
  // tidak, ada baris yang hilang saat dikelompokkan - dan sebaran yang
  // kehilangan baris menggambarkan keadaan yang tidak pernah ada.
  const jumlahKelompok = kelompok.reduce((s, k) => s + k.jumlah, 0);
  if (jumlahKelompok !== terkategori.length) {
    throw new Error(
      `Sebaran "${def.kunci}" kehilangan baris: ${jumlahKelompok} lawan ${terkategori.length}`
    );
  }

  const cakupanPersen = jumlahBaris ? Number(((terkategori.length / jumlahBaris) * 100).toFixed(1)) : null;
  const ambangCakupan = ambang.ambangBerlaku("cakupanRendah", unit.selesai);
  const batasCakupan = ambangCakupan.nilai === null ? 50 : ambangCakupan.nilai;

  const peringatan = [];
  if (cakupanPersen !== null && cakupanPersen < batasCakupan) {
    peringatan.push(
      `Cakupan ${cakupanPersen} persen - di bawah ambang ${batasCakupan} persen. Sebaran ini menggambarkan sebagian kecil datanya saja, dan tidak boleh dibaca sebagai gambaran seluruh perkara.`
    );
  }
  if (jumlahBaris < CUKUP_MENYIMPULKAN) {
    peringatan.push(
      `Baru ${jumlahBaris} baris - di bawah ${CUKUP_MENYIMPULKAN}. Gambarnya benar, tetapi belum cukup untuk menyimpulkan kebiasaan.`
    );
  }
  if (def.ruasBebas && kelompok.length > BATAS_TULISAN_BERBEDA) {
    peringatan.push(
      `${kelompok.length} tulisan berbeda pada ruas yang diketik bebas. Ini sebaran EJAAN, bukan sebaran ${def.ruasKategori} - dan tidak boleh dibaca sebagai yang kedua sebelum daftarnya dibakukan.`
    );
  }

  return {
    unit,
    jumlahBaris,
    terkategori: terkategori.length,
    takTerkategori,
    cakupanPersen,
    jumlahKelompok: kelompok.length,
    terbesar: kelompok.length ? kelompok[0] : null,
    kelompok,
    cukupMenyimpulkan: jumlahBaris >= CUKUP_MENYIMPULKAN,
    peringatan,
    // Ditulis terang-terangan pada tiap satuan, bukan hanya di keterangan
    // kerangka. Yang membaca jawaban ini lewat rute mungkin tidak pernah
    // membaca berkas ini.
    nilai: null,
    sebabTanpaNilai:
      "Butir sebaran tidak menghasilkan nilai. Tidak ada yang dapat disebut benar atau salah pada sebuah sebaran; ia gambaran keadaan, bukan capaian.",
    bukti: baris,
  };
}

/** Menjalankan satu butir sebaran pada satu jendela periode. */
async function jalankan(kunci, jenisPeriode, acuan, opsi = {}) {
  const def = ambil(kunci);
  if (!def) return { ok: false, alasan: "butir_sebaran_tidak_dikenali" };

  const p = periode.satuanPeriode(jenisPeriode, acuan, opsi);
  const satuan = [];
  for (const unit of p.unit) {
    satuan.push(await hitungSatuan(def, unit));
  }

  return {
    ok: true,
    bentuk: "sebaran",
    kunci: def.kunci,
    judul: def.judul,
    keterangan: def.keterangan,
    versiRumus: def.versiRumus,
    ruasKategori: def.ruasKategori,
    ruasBebas: Boolean(def.ruasBebas),
    catatanBebas: def.catatanBebas || "",
    periode: { jenis: p.jenis, label: p.label, satuan: p.satuan, banyak: p.banyak },
    caraHitung: { ...def.caraHitung },
    satuan,
  };
}

module.exports = {
  CUKUP_MENYIMPULKAN,
  BATAS_TULISAN_BERBEDA,
  berkategori,
  celaDefinisi,
  daftarkan,
  lupakanSemua,
  ambil,
  daftar,
  jalankan,
};
