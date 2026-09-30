"use strict";

/**
 * ============================================================================
 * MS02 - RAPOR BERJENJANG: NILAI YANG SAMA DITUMPUK BEBERAPA TINGKAT
 * ============================================================================
 *
 * Satu penilaian menghasilkan satu angka untuk pengadilan. Angka itu juga
 * dapat dipecah menurut siapa yang mengerjakannya - jurusita, panitera
 * pengganti, majelis - dan pecahannya adalah rapor aparatur.
 *
 * Yang penting: rapor aparatur BUKAN penilaian lain. Ia penilaian yang SAMA,
 * dilihat per orang. Menulisnya sebagai penilaian tersendiri berarti dua rumus
 * yang perlahan menyimpang, lalu jumlah rapor per orang tidak lagi sama dengan
 * angka pengadilan - dan tidak seorang pun tahu mana yang benar.
 *
 * ============================================================================
 * TIGA JAMINAN YANG DIPAKSAKAN
 * ============================================================================
 *
 *   1. TIDAK ADA BARIS YANG HILANG. Jumlah penyebut seluruh kelompok selalu
 *      sama dengan penyebut keseluruhan. Baris yang pelakunya tidak tercatat
 *      TIDAK dibuang - ia masuk kelompok bernama "tidak tercatat", dan itu
 *      sendiri temuan: pekerjaan yang tidak diketahui siapa pengerjanya.
 *
 *   2. TIDAK ADA BARIS YANG TERHITUNG DUA KALI. Satu baris masuk tepat satu
 *      kelompok. Bila sebuah pekerjaan memang dikerjakan dua orang, itu harus
 *      dinyatakan sebagai dua baris - bukan satu baris berpelaku dua.
 *
 *   3. PEMBATAS PENYEBUT BERLAKU PER KELOMPOK. Jurusita yang hanya menangani
 *      tiga panggilan tidak boleh punya nilai. Justru di sinilah pembatas itu
 *      paling penting: pada tingkat pengadilan penyebutnya selalu besar, pada
 *      tingkat orang ia kerap kecil - dan itulah tingkat yang namanya tertulis
 *      di sebelah angkanya.
 */

const periode = require("./periodePenilaianService");
const ambang = require("./ambangPenilaianService");

const TIDAK_TERCATAT = "(tidak tercatat)";

function bersih(x) {
  return String(x === undefined || x === null ? "" : x).trim();
}

/**
 * Memecah satu satuan periode menurut sebuah dimensi pelaku.
 *
 * @param satuan   hasil hitungSatuan() - memuat bukti berupa baris
 * @param dimensi  nama ruas pelaku pada tiap baris, mis. "jurusita"
 */
function pecahSatuan(satuan, dimensi) {
  const kunciDimensi = bersih(dimensi);
  if (!kunciDimensi) throw new Error("dimensi pelaku tidak boleh kosong");
  if (!satuan || !Array.isArray(satuan.bukti)) throw new Error("satuan tidak memuat bukti");

  const kelompok = new Map();
  satuan.bukti.forEach((baris) => {
    const pelaku = bersih(baris && baris[kunciDimensi]) || TIDAK_TERCATAT;
    if (!kelompok.has(pelaku)) kelompok.set(pelaku, { pelaku, terpenuhi: 0, penyebut: 0, bukti: [] });
    const k = kelompok.get(pelaku);
    k.penyebut += 1;
    if (baris.memenuhi) k.terpenuhi += 1;
    k.bukti.push(baris);
  });

  const batasAmbang = ambang.ambangBerlaku("pembatasPenyebut", satuan.unit.selesai);
  const batas = batasAmbang.nilai === null ? periode.CUKUP_PENYEBUT : batasAmbang.nilai;

  const hasil = [...kelompok.values()]
    .map((k) => {
      const n = periode.nilaiDenganPembatas(k.terpenuhi, k.penyebut, batas);
      return {
        pelaku: k.pelaku,
        terpenuhi: k.terpenuhi,
        penyebut: k.penyebut,
        nilai: n.nilai,
        cukup: n.cukup,
        sebabTidakCukup: n.cukup ? "" : n.sebab || "",
        bukti: k.bukti,
      };
    })
    // Terurut menurut nama, bukan menurut nilai. Mengurutkan menurut nilai
    // membuat "yang terburuk" selalu di atas, dan daftar yang selalu menuduh
    // orang yang sama akan berhenti dibaca. Pengurutan menurut nilai adalah
    // pilihan pembaca, bukan bawaan.
    .sort((a, b) => a.pelaku.localeCompare(b.pelaku, "id"));

  // Jaminan pertama dan kedua, diperiksa - bukan diandaikan.
  const jumlahPenyebut = hasil.reduce((s, x) => s + x.penyebut, 0);
  const jumlahTerpenuhi = hasil.reduce((s, x) => s + x.terpenuhi, 0);
  if (jumlahPenyebut !== satuan.penyebut || jumlahTerpenuhi !== satuan.terpenuhi) {
    throw new Error(
      `Pemecahan menurut "${kunciDimensi}" kehilangan atau menggandakan baris: ` +
        `penyebut ${jumlahPenyebut} lawan ${satuan.penyebut}, terpenuhi ${jumlahTerpenuhi} lawan ${satuan.terpenuhi}`
    );
  }

  return {
    unit: satuan.unit,
    dimensi: kunciDimensi,
    batasPenyebut: batas,
    keseluruhan: {
      terpenuhi: satuan.terpenuhi,
      penyebut: satuan.penyebut,
      nilai: satuan.nilai,
      cukup: satuan.cukup,
    },
    kelompok: hasil,
    adaYangTidakTercatat: hasil.some((x) => x.pelaku === TIDAK_TERCATAT),
  };
}

/**
 * Rapor berjenjang untuk seluruh satuan periode sebuah penilaian.
 *
 * Memulangkan pula ringkasan per pelaku sepanjang seluruh periode, sebab
 * itulah bentuk yang dipakai rapor: bukan "Rusdin pada minggu ke-31",
 * melainkan "Rusdin sepanjang triwulan ini".
 */
function berjenjang(hasilPenilaian, dimensi) {
  if (!hasilPenilaian || hasilPenilaian.ok !== true) {
    throw new Error("hasil penilaian tidak sah");
  }
  const perSatuan = hasilPenilaian.satuan.map((s) => pecahSatuan(s, dimensi));

  const gabung = new Map();
  perSatuan.forEach((p) => {
    p.kelompok.forEach((k) => {
      if (!gabung.has(k.pelaku)) gabung.set(k.pelaku, { pelaku: k.pelaku, terpenuhi: 0, penyebut: 0 });
      const g = gabung.get(k.pelaku);
      g.terpenuhi += k.terpenuhi;
      g.penyebut += k.penyebut;
    });
  });

  const akhir = hasilPenilaian.satuan[hasilPenilaian.satuan.length - 1];
  const batasAmbang = ambang.ambangBerlaku("pembatasPenyebut", akhir.unit.selesai);
  const batas = batasAmbang.nilai === null ? periode.CUKUP_PENYEBUT : batasAmbang.nilai;

  const ringkasPelaku = [...gabung.values()]
    .map((g) => {
      const n = periode.nilaiDenganPembatas(g.terpenuhi, g.penyebut, batas);
      return {
        pelaku: g.pelaku,
        terpenuhi: g.terpenuhi,
        penyebut: g.penyebut,
        nilai: n.nilai,
        cukup: n.cukup,
        sebabTidakCukup: n.cukup ? "" : n.sebab || "",
      };
    })
    .sort((a, b) => a.pelaku.localeCompare(b.pelaku, "id"));

  const totalPenyebut = hasilPenilaian.satuan.reduce((s, x) => s + x.penyebut, 0);
  const totalTerpenuhi = hasilPenilaian.satuan.reduce((s, x) => s + x.terpenuhi, 0);
  const jumlahPelaku = ringkasPelaku.reduce((s, x) => s + x.penyebut, 0);
  if (jumlahPelaku !== totalPenyebut) {
    throw new Error(
      `Ringkasan pelaku kehilangan baris: ${jumlahPelaku} lawan ${totalPenyebut}`
    );
  }

  return {
    kunci: hasilPenilaian.kunci,
    judul: hasilPenilaian.judul,
    dimensi: bersih(dimensi),
    periode: hasilPenilaian.periode,
    perSatuan,
    ringkasPelaku,
    keseluruhan: (() => {
      const n = periode.nilaiDenganPembatas(totalTerpenuhi, totalPenyebut, batas);
      return { terpenuhi: totalTerpenuhi, penyebut: totalPenyebut, nilai: n.nilai, cukup: n.cukup };
    })(),
    catatan:
      "Rapor ini penilaian yang SAMA dengan angka pengadilan, dilihat per pelaku - bukan penilaian lain. " +
      "Jumlah penyebut seluruh pelaku selalu sama dengan penyebut pengadilan; bila tidak, kerangkanya berhenti dengan error.",
  };
}

module.exports = { TIDAK_TERCATAT, pecahSatuan, berjenjang };
