"use strict";

/**
 * ============================================================================
 * DETEKSI PENGESAHAN ANAK (jenis_perkara_id 352) - agen W3a-B, 21 Okt 2026
 * ============================================================================
 *
 * Blangko Derry: "8a Pengesahan Anak" dan "8a Pengesahan Anak - BAS" (ALUR 63). Pemohon = suami istri (Pemohon I dan II), anak yang dimohonkan
 * pengesahannya. Pola nama anak, tempat/tanggal lahir mengikuti modul asalUsul (posita permohonan anak PA Donggala memakai kalimat yang sama).
 * Perkara jenis ini TIDAK ADA di SIPP PA Donggala (0 perkara 352 pada 21 Okt 2026): pola disusun dari posita asal usul anak/itsbat serumpun dan DIUJI
 * dengan kalimat sintetis; belum diukur atas perkara nyata jenis ini, sehingga semua nilai tafsiran ditandai "ragu".
 *
 * Variabel (paket abt-w3a-blangko-baru-perkawinan, 3660-3689; 8603 = isian nama anak milik paket asal usul anak):
 *   8603 nama anak | 3660 tempat dan tanggal lahir anak | 3662 keadaan pencatatan pernikahan (A/B/C, teks pilihan lengkap) | 3664 akta nikah atau penetapan itsbat
 *   3665 sebab belum berakta | 3666 bukti hubungan darah | 3670 pengakuan ayah | 3672 tujuan pengesahan.
 * Tidak dideteksi: 3668 (status anak = pilihan majelis), 3669 (bukti surat), 3671 (penilaian majelis).
 */

const B = require("./bantuAnak");
const wilayah = require("./wilayah");
const asalUsul = require("./asalUsul");

const variabel = Object.freeze([
  { kode: "8603", nama: "Nama anak yang dimohonkan pengesahannya", sumber: "petitum", blangko: ["putusan", "bas"] },
  { kode: "3660", nama: "Tempat dan tanggal lahir anak", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "3662", nama: "Keadaan pencatatan pernikahan Pemohon (A/B/C)", sumber: "posita", blangko: ["putusan"] },
  { kode: "3664", nama: "Akta nikah atau penetapan itsbat nikah", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "3665", nama: "Sebab anak belum mempunyai akta kelahiran", sumber: "posita", blangko: ["putusan"] },
  { kode: "3666", nama: "Bukti hubungan darah anak dengan ayah biologis", sumber: "posita", blangko: ["putusan"] },
  { kode: "3670", nama: "Pengakuan ayah atas anak", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "3672", nama: "Tujuan pengesahan", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "3668", nama: "Status anak - pilihan majelis", sumber: "majelis", blangko: ["putusan"], deteksi: false },
  { kode: "3669", nama: "Alat bukti surat", sumber: "berkas-ecourt", blangko: ["putusan", "bas"], deteksi: false },
  { kode: "3671", nama: "Pertimbangan majelis atas dalil yang tidak terbukti", sumber: "majelis", blangko: ["putusan"], deteksi: false },
]);

const PILIHAN_A = "A · pernikahan baru dicatat Pegawai Pencatat Nikah sesudah anak lahir";
const PILIHAN_B = "B · pernikahan belum dicatat (nikah menurut agama)";
const PILIHAN_C = "C · pernikahan telah diitsbatkan Pengadilan";

/** Nama anak dari petitum: "Menetapkan/Mengesahkan anak ... bernama X ... sebagai/adalah anak sah". */
function anakPetitum(petitum) {
  const t = String(petitum || "");
  const m = /(?:Menetapkan|Mengesahkan|Menyatakan(?:\s+sah)?)\s+(?:[^;]{0,60}?\b)?anak(?:-anak)?\b[^;:]{0,60}?\bbe?r?nama\s*:?\s*/i.exec(t);
  if (!m) return null;
  let isi = t.slice(m.index + m[0].length);
  const b = isi.search(/(?:;|\s)\s*(?:\d{1,2}\s*\.\s*)?(?:Membebankan|Menetapkan\s+biaya|Memerintahkan|SUBSID\w*)\b/i);
  if (b >= 0) isi = isi.slice(0, b);
  if (!/\b(?:adalah|sebagai|menjadi)\s+anak|\banak\s+(?:sah|kandung)\s+dari/i.test(isi)) return null;
  isi = isi
    .replace(/\b(?:adalah|sebagai|menjadi)\s+anak(?:-anak)?\s+(?:sah\s+|kandung\s+)?(?:dari\s+)?[^;]*?(?=;|\s(?:[a-h]|\d{1,2})\s*[.)]\s+[A-Z]|$)/gi, " ; ")
    .replace(/,?\s*(?:tanggal\s+lahir|bertempat\s+tinggal)\b[^;]*?(?=;|$)/gi, " ; ");
  const daftar = B.daftarNama(isi);
  return daftar.length ? { daftar, kalimat: t.slice(m.index, m.index + m[0].length + isi.length + 30) } : null;
}

function aktaNikah(kal) {
  for (const k of kal) {
    const nomor = /Akta\s+Nikah\s+Nomor\s*:?\s*([0-9A-Za-z./-]+)/i.exec(k);
    if (!nomor) continue;
    const tanggal = B.tanggalPertama(k.slice(nomor.index));
    const kua = /(?:Kantor\s+Urusan\s+Agama|KUA)[\s\S]*$/i.exec(k);
    const komp = wilayah.komponenWilayah(kua ? kua[0] : k);
    const bagian = [`Akta Nikah Nomor ${nomor[1].replace(/[.,]+$/, "")}`];
    if (tanggal) bagian.push(`tanggal ${tanggal}`);
    if (komp.kecamatan) bagian.push(`yang dikeluarkan oleh Kantor Urusan Agama Kecamatan ${komp.kecamatan}`);
    return { nilai: bagian.join(" "), kalimat: k };
  }
  return null;
}

function deteksi(posita, opsi = {}) {
  const peta = {};
  const t = B.polos(posita);
  if (!t) return peta;
  const kal = B.kalimat(posita);

  // 8603 - nama anak (petitum lebih kuat daripada posita; keduanya sepakat = cukup).
  const pet = anakPetitum(B.polos(opsi.petitum || ""));
  const pos = asalUsul.anakPosita(t);
  if (pet) {
    const sepakat = pos && pet.daftar.every((a) => pos.daftar.some((b) => B.sama(a.nama, b.nama)));
    B.taruh(peta, "8603", B.fakta(pet.daftar.map((d) => d.nama).join(", "), pet.kalimat, sepakat ? "cukup" : "ragu", "pengesahan-8603-petitum", "petitum"));
  } else if (pos) {
    B.taruh(peta, "8603", B.fakta(pos.daftar.map((d) => d.nama).join(", "), pos.kalimat, "ragu", "pengesahan-8603-posita"));
  }

  // 3660 - tempat dan tanggal lahir (hanya bila posita menyebut tepat satu kelahiran).
  const lahir = asalUsul.lahirAnak(kal);
  if (lahir) B.taruh(peta, "3660", B.fakta(lahir.nilai, lahir.kalimat, "cukup", "pengesahan-3660-lahir"));

  // 3664 / 3662 - akta nikah atau penetapan itsbat; keadaan pencatatan.
  const itsbat = asalUsul.penetapanItsbat(kal);
  const akta = aktaNikah(kal);
  if (itsbat) {
    B.taruh(peta, "3664", B.fakta(`Penetapan Itsbat Nikah ${itsbat.nilai}`, itsbat.kalimat, "ragu", "pengesahan-3664-itsbat"));
    B.taruh(peta, "3662", B.fakta(PILIHAN_C, itsbat.kalimat, "ragu", "pengesahan-3662-itsbat"));
  } else if (akta) {
    B.taruh(peta, "3664", B.fakta(akta.nilai, akta.kalimat, "ragu", "pengesahan-3664-akta"));
    const sesudah = /(?:dicatat|tercatat|dicatatkan)[^;]{0,220}?\b(?:setelah|sesudah|kemudian)\b|\b(?:setelah|sesudah)\b[^;]{0,80}?\b(?:anak|lahir)\b[^;]{0,80}?(?:dicatat|tercatat|dicatatkan)/i.exec(akta.kalimat);
    if (sesudah) B.taruh(peta, "3662", B.fakta(PILIHAN_A, akta.kalimat, "ragu", "pengesahan-3662-dicatat-kemudian"));
  } else {
    const belum = kal.find((k) => /\b(?:nikah|pernikahan|perkawinan)[^;]{0,80}?\b(?:belum|tidak)\s+(?:pernah\s+)?(?:dicatat|tercatat|dicatatkan)\b/i.test(k) || /\bbelum\s+(?:dicatat|tercatat)\s+(?:di|pada|oleh)\s+(?:Kantor\s+Urusan\s+Agama|KUA|Pegawai\s+Pencatat)/i.test(k));
    if (belum) B.taruh(peta, "3662", B.fakta(PILIHAN_B, belum, "ragu", "pengesahan-3662-belum-dicatat"));
  }

  // 3665 - sebab belum berakta.
  for (const k of kal) {
    const m = /\bbelum\s+(?:mempunyai|memiliki)\s+akta\s+kelahiran(?:\s+(?:karena|sebab|dikarenakan)\s+([^;]{6,200}?))?(?=\s*;|\s+(?:\d{1,2}\s*\.\s*)?Bahwa\b|\.\s+[A-Z]|$)/i.exec(k);
    if (m) {
      const nilai = m[1] ? `belum mempunyai akta kelahiran karena ${m[1].trim().replace(/[.,;:]+$/, "")}` : "belum mempunyai akta kelahiran";
      B.taruh(peta, "3665", B.fakta(nilai, k, "ragu", "pengesahan-3665-sebab"));
      break;
    }
  }

  // 3666 - bukti hubungan darah (tes DNA).
  const dna = kal.find((k) => /\b(?:tes|uji|test|pemeriksaan)\s+DNA\b|\bDNA\b/i.test(k));
  if (dna) B.taruh(peta, "3666", B.fakta("dibuktikan dengan hasil tes DNA", dna, "ragu", "pengesahan-3666-dna"));

  // 3670 - pengakuan ayah atas anak.
  const akui = kal.find((k) => /\b(?:mengakui|mengaku)\b[^;]{0,80}?\banak\b/i.test(k));
  if (akui) B.taruh(peta, "3670", B.fakta("mengakui anak tersebut sebagai anak kandungnya", akui, "ragu", "pengesahan-3670-pengakuan"));

  // 3672 - tujuan pengesahan.
  for (const k of kal) {
    const m = /\bagar\b[^;]{0,200}?\buntuk\s+(?:keperluan\s+|kepentingan\s+)?((?:mengurus|pengurusan|pembuatan|membuat)\s+[^;]{3,140}?)(?=\s*;|\s+(?:\d{1,2}\s*\.\s*)?Bahwa\b|\.\s+[A-Z]|$)/i.exec(k)
      || /\buntuk\s+(?:keperluan\s+|kepentingan\s+)?((?:mengurus|pengurusan|pembuatan|membuat)\s+(?:akta\s+kelahiran)[^;]{0,120}?)(?=\s*;|\s+(?:\d{1,2}\s*\.\s*)?Bahwa\b|\.\s+[A-Z]|$)/i.exec(k);
    if (m) {
      B.taruh(peta, "3672", B.fakta(m[1].trim().replace(/[.,;:]+$/, ""), k, "ragu", "pengesahan-3672-tujuan"));
      break;
    }
  }
  return peta;
}

module.exports = { kunci: "pengesahan-anak", jenisPerkaraId: [352], variabel, deteksi, anakPetitum, aktaNikah };
