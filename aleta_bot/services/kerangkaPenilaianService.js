"use strict";

/**
 * ============================================================================
 * KERANGKA PENILAIAN - MS01, MS04, MS05 DIJADIKAN SATU KONTRAK
 * ============================================================================
 *
 * Sebuah penilaian didaftarkan sekali di sini, lalu kerangka ini yang
 * mengurus tujuh jendela waktunya, pembatas penyebutnya, penyimpanan
 * riwayatnya, dan - yang paling menentukan - hubungan antara angkanya dan
 * buktinya.
 *
 * ============================================================================
 * MS04 - ANGKANYA DIHITUNG DARI BUKTINYA
 * ============================================================================
 *
 * Cara yang lazim: sebuah kueri agregat menghasilkan angka, lalu kueri kedua
 * yang berbeda menghasilkan daftar perkaranya. Keduanya ditulis terpisah,
 * perlahan menyimpang, dan pada suatu hari layar menampilkan "312 relaas
 * bertenggang kurang" di atas daftar yang berisi 287 baris.
 *
 * Tidak seorang pun akan menyadarinya. Yang membuka daftar tidak menghitung
 * barisnya, dan yang membaca angka tidak membuka daftarnya.
 *
 * Di sini hubungannya dibalik: penilaian menyerahkan DAFTAR BARIS beserta
 * penanda memenuhi atau tidak, lalu kerangka yang menghitung penyebut dan
 * pembilangnya. Angkanya karena itu tidak mungkin berselisih dengan buktinya -
 * ia turunan dari buktinya.
 *
 * Untuk penyebut yang sangat besar, penilaian boleh menyerahkan `ringkas()`
 * yang menghitung dengan agregat. Bila keduanya diserahkan, kerangka
 * MEMBANDINGKANNYA dan melaporkan selisihnya sebagai temuan - bukan memilih
 * salah satu diam-diam.
 *
 * ============================================================================
 * TIGA HAL YANG DITOLAK SAAT MENDAFTAR
 * ============================================================================
 *
 * Penolakan terjadi saat modul dimuat, bukan saat penilaiannya dibuka. Cacat
 * yang baru ketahuan ketika seorang hakim membuka layar adalah cacat yang
 * ditemukan di tempat yang paling mahal.
 */

const periode = require("./periodePenilaianService");
const ambang = require("./ambangPenilaianService");

const LANTAI_SAH = new Set(Object.keys(periode.LANTAI));

/** Daftar penilaian yang terdaftar. Tanpa induk - lihat analisaLanjutService. */
const TERDAFTAR = Object.create(null);

function bersih(x) {
  return String(x === undefined || x === null ? "" : x).trim();
}

/**
 * Memeriksa bentuk sebuah definisi penilaian.
 * Memulangkan daftar cela; kosong berarti sah.
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

  if (!LANTAI_SAH.has(bersih(def.lantai))) {
    cela.push(`lantai "${def.lantai}" tidak dikenali; yang sah: ${[...LANTAI_SAH].join(", ")}`);
  }

  // Penilaian WAJIB dapat menyebutkan buktinya. Inilah MS04, dan ia tidak
  // dapat ditawar: angka tanpa bukti tidak dapat dipertanggungjawabkan, dan
  // penilaian yang tidak dapat menyebutkan buktinya tidak boleh berdiri.
  if (typeof def.baris !== "function") {
    cela.push("tidak punya baris() - penilaian wajib dapat menyebutkan bukti penyusun angkanya");
  }

  if (def.ringkas !== undefined && typeof def.ringkas !== "function") {
    cela.push("ringkas() harus berupa fungsi bila diberikan");
  }

  if (!bersih(def.versiRumus)) {
    cela.push("versiRumus kosong - tanpa itu, perubahan rumus tidak dapat dibedakan dari perubahan data");
  }

  if (def.ambangDipakai !== undefined) {
    if (!Array.isArray(def.ambangDipakai)) cela.push("ambangDipakai harus berupa larik");
    else {
      def.ambangDipakai.forEach((k) => {
        if (!Object.prototype.hasOwnProperty.call(ambang.AMBANG, k)) {
          cela.push(`ambang "${k}" tidak ada pada daftar ambang`);
        }
      });
    }
  }

  return cela;
}

/**
 * Mendaftarkan satu penilaian.
 *
 * @param {object} def
 *   kunci         nama pendek, dipakai sebagai kunci penyimpanan
 *   judul         judul terbaca
 *   keterangan    satu kalimat yang menjelaskan apa yang dinilai
 *   lantai        periode terendah yang boleh menghasilkan nilai
 *   versiRumus    dinaikkan bila cara menghitungnya berubah
 *   ambangDipakai daftar kunci ambang yang dipakai
 *   baris(rentang)   -> [{ kunci, memenuhi, ... }] bukti penyusun angka
 *   ringkas(rentang) -> { terpenuhi, penyebut } (boleh tidak ada)
 */
function daftarkan(def) {
  const cela = celaDefinisi(def);
  if (cela.length) {
    throw new Error(`Penilaian "${def && def.kunci}" ditolak: ${cela.join("; ")}`);
  }
  const kunci = bersih(def.kunci);
  if (Object.prototype.hasOwnProperty.call(TERDAFTAR, kunci)) {
    throw new Error(`Penilaian "${kunci}" sudah terdaftar - dua penilaian berkunci sama akan saling menimpa riwayatnya`);
  }
  TERDAFTAR[kunci] = { ...def, kunci };
  return TERDAFTAR[kunci];
}

function lupakanSemua() {
  Object.keys(TERDAFTAR).forEach((k) => delete TERDAFTAR[k]);
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
        lantai: d.lantai,
        versiRumus: d.versiRumus,
        ambangDipakai: (d.ambangDipakai || []).slice(),
        punyaRingkas: typeof d.ringkas === "function",
      };
    });
}

function ambil(kunci) {
  const k = bersih(kunci);
  return Object.prototype.hasOwnProperty.call(TERDAFTAR, k) ? TERDAFTAR[k] : null;
}

/**
 * Menghitung satu satuan periode.
 *
 * Angkanya diturunkan dari barisnya. Bila penilaian juga menyediakan
 * `ringkas()`, keduanya dibandingkan dan selisihnya DILAPORKAN - tidak ada
 * yang dipilih diam-diam.
 */
async function hitungSatuan(def, unit) {
  const rentang = { mulai: unit.mulai, selesai: unit.selesai, unit };

  const baris = await def.baris(rentang);
  if (!Array.isArray(baris)) {
    throw new Error(`baris() pada "${def.kunci}" tidak memulangkan larik`);
  }
  baris.forEach((b, i) => {
    if (!b || typeof b !== "object") throw new Error(`baris ke-${i + 1} pada "${def.kunci}" bukan objek`);
    if (typeof b.memenuhi !== "boolean") {
      throw new Error(`baris ke-${i + 1} pada "${def.kunci}" tidak punya penanda memenuhi berupa boolean`);
    }
  });

  const penyebut = baris.length;
  const terpenuhi = baris.filter((b) => b.memenuhi).length;

  let selisihRingkas = null;
  if (typeof def.ringkas === "function") {
    const r = await def.ringkas(rentang);
    const rp = Number(r && r.penyebut);
    const rt = Number(r && r.terpenuhi);
    if (rp !== penyebut || rt !== terpenuhi) {
      selisihRingkas = {
        dariBaris: { terpenuhi, penyebut },
        dariRingkas: { terpenuhi: rt, penyebut: rp },
        arti:
          "kueri agregat dan daftar buktinya tidak sepakat. Angka yang tampil diambil dari BUKTINYA, " +
          "sebab itulah yang dapat diperiksa manusia. Selisih ini temuan, bukan hal yang boleh diabaikan.",
      };
    }
  }

  const batasAmbang = ambang.ambangBerlaku("pembatasPenyebut", unit.selesai);
  const batas = batasAmbang.nilai === null ? periode.CUKUP_PENYEBUT : batasAmbang.nilai;
  const nilai = periode.nilaiDenganPembatas(terpenuhi, penyebut, batas);

  return {
    unit,
    terpenuhi,
    penyebut,
    nilai: nilai.nilai,
    cukup: nilai.cukup,
    sebabTidakCukup: nilai.cukup ? "" : nilai.sebab || "",
    batasPenyebut: batas,
    bukti: baris,
    selisihRingkas,
  };
}

/**
 * Menjalankan sebuah penilaian pada satu jendela periode.
 *
 * Di bawah lantainya, yang dipulangkan DAFTAR KERJA - bukan nilai. Membuat
 * nilai mingguan untuk penilaian yang aturannya bulanan berarti mengarang
 * angka yang tidak ada dasarnya.
 */
async function jalankan(kunci, jenisPeriode, acuan, opsi = {}) {
  const def = ambil(kunci);
  if (!def) return { ok: false, alasan: "penilaian_tidak_dikenali" };

  const p = periode.satuanPeriode(jenisPeriode, acuan, opsi);
  const bawahLantai = periode.dibawahLantai(def.lantai, jenisPeriode);

  const satuan = [];
  for (const unit of p.unit) {
    satuan.push(await hitungSatuan(def, unit));
  }

  return {
    ok: true,
    kunci: def.kunci,
    judul: def.judul,
    keterangan: def.keterangan,
    lantai: def.lantai,
    versiRumus: def.versiRumus,
    periode: { jenis: p.jenis, label: p.label, satuan: p.satuan, banyak: p.banyak },
    bawahLantai,
    // Di bawah lantai nilainya sengaja dibuang, tetapi buktinya TIDAK -
    // justru daftar itulah yang berguna pada periode sependek itu.
    satuan: satuan.map((s) =>
      bawahLantai
        ? {
            unit: s.unit,
            nilai: null,
            cukup: false,
            sebabTidakCukup: `penilaian ini berlantai ${def.lantai}; pada ${p.label.toLowerCase()} yang disajikan daftar kerja, bukan nilai`,
            jumlahBukti: s.bukti.length,
            belumMemenuhi: s.bukti.filter((b) => !b.memenuhi).length,
            bukti: s.bukti,
          }
        : s
    ),
    ambangDipakai: (def.ambangDipakai || []).map((k) => ambang.ambangBerlaku(k, p.unit[p.unit.length - 1].selesai)),
  };
}

module.exports = {
  TERDAFTAR,
  celaDefinisi,
  daftarkan,
  daftar,
  ambil,
  lupakanSemua,
  hitungSatuan,
  jalankan,
};
