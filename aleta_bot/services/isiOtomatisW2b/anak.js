"use strict";

/**
 * ============================================================================
 * ISIAN OTOMATIS KELUARGA ANAK - hak asuh, penguasaan anak, nafkah anak (agen W2b-B, 21 Okt 2026)
 * ============================================================================
 *
 * Membaca posita dan petitum SIPP (lewat petitumBerbutir.js, satu sumber fakta dengan faktaPerkara) untuk isian blangko putusan
 * keluarga anak yang BARU (variabel 4884-4905, paket abt-w2b-keluarga-lain). Dipanggil lewat SATU sambungan dari
 * isiOtomatisJenisS6.usulanDariKonteks. Semua usulan berkeyakinan "ragu" (saran, kotak samar, tekan Tab): kode baru belum terukur
 * atas isian petugas; usulan kenaikan keyakinan ada di abt-paket/w2b-keluarga-lain/untuk-sesi-utama/anak-gerbang.json.
 *
 *   4890  saklar penyerahan anak            "1" bila PETITUM meminta menyerahkan anak (kosong = tidak ada penyerahan)
 *   4899  jumlah nafkah anak yang dimohon   nominal petitum nafkah anak ("Rp1.500.000,00 (satu juta lima ratus ribu rupiah)")
 *   4888  rincian akses bertemu             frasa waktu atau cara bertemu bila petitum atau posita menyebutnya
 *   4884  kelayakan calon pemegang hadhanah kalimat posita tentang kesehatan, waktu, tempat tinggal, ekonomi, akhlak, agama Penggugat
 *   4901  ketidakmampuan ayah               kalimat posita tentang ayah tidak mampu atau tidak berpenghasilan (nafkah anak ibu/ayah tidak mampu)
 *   4905  status mumayyiz per anak          hanya bila anak-anak berumur di dua sisi batas 12 tahun; pemegang hadhanah tetap pilihan majelis
 *
 * Keputusan hakim (dikabulkan, besaran, siapa pemegang hak asuh) TIDAK diputus di sini: nilai selalu "yang dituntut" atau "yang tertulis".
 * Aturan: tanpa kata aplikasi di nilai; jagaIsianLama pada semua usulan; satu pembacaan yang gagal tidak menggagalkan yang lain.
 */

const B = require("../deteksi/bantuAnak");

const JENIS_ANAK = Object.freeze([349, 350, 351, 369, 743]);
const POLA_ANAK = /\bhak\s+asuh|hadh?[ao]nah|nafkah\s+anak|penguasaan\s+anak|pemeliharaan\s+anak/i;

const NAMA = Object.freeze({
  "4884": "Kelayakan calon pemegang hadhanah (fakta)",
  "4888": "Rincian waktu dan cara akses bertemu anak",
  "4890": "Saklar penyerahan anak (1 = dimohonkan dalam petitum)",
  "4899": "Jumlah nafkah anak yang dimohon dalam petitum",
  "4901": "Fakta ketidakmampuan ayah memberi nafkah anak",
  "4905": "Penetapan per anak (status mumayyiz)",
});

function puluhan(n) {
  return String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function rupiah(n) {
  let kata = "";
  try {
    kata = require("../tuntutanDeteksiService").terbilang(Number(n));
  } catch {
    kata = "";
  }
  return `Rp${puluhan(n)},00${kata ? ` (${kata} rupiah)` : ""}`;
}

function usulan(kode, nilai, kalimat, catatan, kodePola) {
  return {
    kode,
    nama: NAMA[kode] || kode,
    nilai: String(nilai || ""),
    keyakinan: "ragu",
    bentrok: "",
    sumber: kalimat ? [{ saksi: 0, asal: "posita-gugatan", kalimat: String(kalimat).slice(0, 400) }] : [],
    catatan: catatan || "",
    dihitung: false,
    jagaIsianLama: true,
    kodePola,
  };
}

/** Sebutan pihak di kalimat posita -> penanda ABT (ABT mengganti #0046# dan #0047# saat mencetak). */
function sebutan(t) {
  return String(t || "")
    .replace(/^\s*(?:\d{1,2}\s*[.)]\s*)?Bahwa\s+/i, "")
    .replace(/\bPenggugat\b/g, "#0046#")
    .replace(/\bTergugat\b/g, "#0047#")
    .replace(/\s+/g, " ")
    .replace(/[.;,\s]+$/, "")
    .trim();
}

function butirPetitum(petitum, posita, jenis) {
  if (!petitum) return [];
  try {
    const r = require("../petitumBerbutir").petitumBerbutir(petitum, { posita, jenis });
    return (r && r.butir) || [];
  } catch {
    return [];
  }
}

/** 4890: petitum meminta anak diserahkan (bukan menyerahkan nafkah atau pengasuhan bersama). */
const POLA_SERAH = /menyerahkan\s+(?!nafkah|biaya|pengasuhan|pemeliharaan)(?:[^.;]{0,40}?)\banak\b|mengembalikan\s+anak|penyerahan\s+anak/i;
function bacaPenyerahan(butir) {
  const b = butir.find((x) => x.bagian !== "subsider" && POLA_SERAH.test(x.teks || "") && !/nafkah\s+(?:\d|\w+\s+\(\w+\)\s+orang)/i.test(x.teks || ""));
  if (!b) return null;
  return usulan(
    "4890",
    "1",
    `Petitum di SIPP: ${b.teks}`,
    "Petitum meminta anak diserahkan; isi 2 bila majelis menetapkan penyerahan walaupun tidak dimohonkan, kosongkan bila anak sudah bersama pemegang hak asuh.",
    "w2b-anak-4890-penyerahan"
  );
}

/** 4899: nominal nafkah anak yang DITUNTUT di petitum. Bila angka dan terbilang di petitum berbeda, teks asli petitum dipakai dan catatan memberi tahu. */
function bacaNominalNafkah(butir) {
  const b = butir.find((x) => x.jenis === "nafkah-anak" && x.bagian !== "subsider" && x.nominal && Number(x.nominal.nilai) > 0);
  if (!b) return null;
  const berbeda = b.nominal.cocok === false;
  const nilai = berbeda ? String(b.nominal.teks || "").replace(/\s+/g, " ").trim() : rupiah(b.nominal.nilai);
  return usulan(
    "4899",
    nilai,
    `Petitum di SIPP: ${b.teks}`,
    `Nominal yang DITUNTUT di petitum${b.nominal.perBulan ? " (setiap bulan)" : ""}; besaran yang dikabulkan diputus majelis.${berbeda ? " ANGKA DAN TERBILANG di petitum berbeda: periksa petitum sebelum memakainya." : ""}`,
    "w2b-anak-4899-nominal"
  );
}

const POLA_WAKTU = /\b((?:setiap|tiap)\s+(?:hari\s+)?(?:\w+\s+){0,2}?(?:minggu|pekan|bulan|sabtu|ahad|libur|lebaran|hari\s+raya)[^,;.]{0,60}|pada\s+hari\s+(?:sabtu|minggu|ahad|libur)[^,;.]{0,60})/i;

/** 4888: waktu atau cara bertemu anak, bila petitum atau posita menyebut akses/bertemu. */
function bacaAkses(butir, posita) {
  const sumber = [];
  for (const b of butir) if (/akses|bertemu|menjenguk|mengunjungi|berkunjung/i.test(b.teks || "")) sumber.push(b.teks);
  for (const k of B.kalimat(posita)) if (/akses|bertemu|menjenguk|mengunjungi/i.test(k) && /anak/i.test(k)) sumber.push(k);
  for (const s of sumber) {
    const m = POLA_WAKTU.exec(s);
    if (m) return usulan("4888", m[1].replace(/\s+/g, " ").trim(), s, "Frasa waktu atau cara bertemu dibaca dari petitum atau posita; periksa dan sesuaikan dengan penetapan majelis.", "w2b-anak-4888-akses");
  }
  return null;
}

const POLA_LAYAK = /Penggugat\s+(?:adalah\s+)?(?:seorang\s+)?(?:\w+\s+){0,2}?(?:sehat|mampu|bekerja|berpenghasilan|memiliki|mempunyai|taat|rajin|berakhlak|berperilaku\s+baik|sanggup|layak)/i;

/** 4884: kalimat posita tentang kelayakan Penggugat mengasuh (subjeknya Penggugat, tidak menyebut Tergugat). */
function bacaKelayakan(posita) {
  const ks = B.kalimat(posita).filter((k) => POLA_LAYAK.test(k) && !/Tergugat/i.test(k) && /\banak\b|mengasuh|merawat|mengurus/i.test(k));
  if (!ks.length) return null;
  const ambil = ks.slice(0, 2).map((k) => sebutan(k).slice(0, 220));
  return usulan(
    "4884",
    ambil.join("; "),
    ks.slice(0, 2).join(" | "),
    "Kalimat posita tentang kelayakan Penggugat mengasuh anak; majelis menilai dari bukti dan saksi, sesuaikan dengan fakta yang terbukti di persidangan.",
    "w2b-anak-4884-kelayakan"
  );
}

const POLA_TAK_MAMPU = /(?:Tergugat|ayah\w*)\s+(?:\w+\s+){0,3}?(?:tidak\s+(?:mampu|berpenghasilan|memiliki\s+penghasilan|mempunyai\s+(?:pekerjaan|penghasilan)|bekerja|punya\s+penghasilan)|menganggur|sakit(?!\s+hati)|cacat|lumpuh)/i;

/** 4901: kalimat posita yang menyatakan ayah tidak mampu memberi nafkah (subjeknya Tergugat atau ayah). */
function bacaTakMampu(posita) {
  const ks = B.kalimat(posita).filter((k) => POLA_TAK_MAMPU.test(k) && /nafkah|biaya|penghasilan|bekerja|pekerjaan/i.test(k));
  if (!ks.length) return null;
  return usulan(
    "4901",
    sebutan(ks[0]).slice(0, 240),
    ks[0],
    "Kalimat posita tentang ketidakmampuan ayah; hanya dipakai pada gugatan nafkah anak ibu ikut memikul biaya, periksa dengan bukti dan saksi.",
    "w2b-anak-4901-takmampu"
  );
}

/** 4905: status mumayyiz per anak hanya bila anak berada di dua sisi batas 12 tahun. */
function bacaMumayyizPerAnak(posita) {
  const t = B.polos(posita);
  const anak = /di\s*karuni(?:a|ai)\w*\s+[^;]{0,60}?anak\b[^;:]{0,40}?\bbe?r?nama\s*:?\s*/i.exec(t);
  if (!anak) return null;
  let isi = t.slice(anak.index + anak[0].length);
  const b = isi.search(/;?\s(?:\d{1,2}\s*\.\s*)?Bahwa\b/);
  if (b >= 0) isi = isi.slice(0, b);
  // Anak yang sudah 21 tahun atau lebih bukan objek hadhanah (Pasal 98 ayat (1) KHI): tidak ikut daftar.
  const daftar = B.daftarNama(isi).filter((d) => d.umur !== null && d.umur < 21);
  if (daftar.length < 2) return null;
  const mumayyiz = daftar.filter((d) => d.umur >= 12).length;
  if (mumayyiz === 0 || mumayyiz === daftar.length) return null;
  const baris = daftar.map((d) => (d.umur >= 12 ? `${d.nama} - mumayyiz memilih -` : `${d.nama} - belum mumayyiz - ibu kandung`));
  return usulan(
    "4905",
    baris.join("\n"),
    anak[0] + isi.slice(0, 200),
    "Anak-anak yang belum 21 tahun berumur di dua sisi batas 12 tahun (Pasal 105 KHI). Pemegang hadhanah anak yang sudah mumayyiz diisi majelis menurut pilihan anak di persidangan; umur dibaca dari posita pada saat gugatan.",
    "w2b-anak-4905-mumayyiz"
  );
}

/**
 * @param {object} k konteks satu perkara: { jenisPerkaraId, posita, petitum }
 * @returns {object[]} usulan (semua berkeyakinan "ragu")
 */
function usulanAnak(k) {
  const jenis = Number(k && k.jenisPerkaraId);
  if (!JENIS_ANAK.includes(jenis)) return [];
  const posita = String((k && k.posita) || "");
  const petitum = String((k && k.petitum) || "");
  if (jenis === 369 && !POLA_ANAK.test(B.polos(posita)) && !POLA_ANAK.test(B.polos(petitum))) return [];
  const butir = butirPetitum(petitum, posita, jenis);
  const keluar = [];
  const taruh = (baca) => {
    try {
      const u = baca();
      if (u) keluar.push(u);
    } catch {
      /* satu pembacaan yang gagal tidak menggagalkan yang lain */
    }
  };
  const hadhanah = jenis !== 350 && jenis !== 743;
  if (hadhanah) {
    taruh(() => bacaPenyerahan(butir));
    taruh(() => bacaAkses(butir, posita));
    taruh(() => bacaKelayakan(posita));
    taruh(() => bacaMumayyizPerAnak(posita));
  }
  taruh(() => bacaNominalNafkah(butir));
  if (jenis === 350 || jenis === 743 || /nafkah\s+anak/i.test(B.polos(petitum))) taruh(() => bacaTakMampu(posita));
  return keluar;
}

module.exports = {
  JENIS_ANAK,
  KODE: Object.freeze(Object.keys(NAMA)),
  usulanAnak,
  bacaPenyerahan,
  bacaNominalNafkah,
  bacaAkses,
  bacaKelayakan,
  bacaTakMampu,
  bacaMumayyizPerAnak,
  rupiah,
};
