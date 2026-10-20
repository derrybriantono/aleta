"use strict";

/**
 * ============================================================================
 * DISPENSASI KAWIN (jenis_perkara_id 362) - isian "Perlu diisi" dari data calon mempelai SIPP
 * ============================================================================
 *
 * SIPP menyimpan calon mempelai di perkara_mempelai_dk (nama, tanggal lahir, pendidikan, pekerjaan, penghasilan,
 * jenis_mempelai 1 = pria / 2 = wanita), tetapi tidak satu pun pengisi lama membacanya: posita DK 2026 sering tidak
 * lagi memuat umur, pendidikan, atau pekerjaan calon mempelai, sehingga 0601/0609/0610/0349/6331 selalu kosong.
 *
 *   0600 / 0606   nama calon pria / wanita           mempelai.nama (sesuai bin/binti SIPP); posita dipakai pembanding
 *   0601 / 0607   umur calon pria / wanita           tanggal lahir SIPP pada tanggal pendaftaran perkara
 *   0349          tanggal lahir calon wanita          mempelai.tanggal_lahir
 *   0609          pendidikan calon wanita             ref_tingkat_pendidikan.kode (SD, SLTP, SLTA ...)
 *   0610          pekerjaan calon wanita              ref_pekerjaan
 *   6331          pekerjaan + penghasilan calon pria  ref_pekerjaan + nominal_penghasilan
 *   2029 / 2030   status calon pria / wanita          anak di bawah umur 19 tahun, posita tidak menyebut duda/janda
 *   9771          alasan mendesak (alasan lain)       kalimat "agar terhindar dari ..." di posita
 *
 * Aturan keyakinan: data SIPP yang DISETUJUI posita = pasti; data SIPP saja = cukup (nama, tanggal, umur) atau ragu
 * (pekerjaan; status calon dewasa: gaya penulisan petugas beragam); bila SIPP dan posita BERBEDA tentang orang/angka
 * yang sama, tidak ada usulan dari sini - bacaan posita yang sudah ada tetap berlaku dan petugas menimbang sendiri.
 */

const B = require("./bantu");

const PENDIDIKAN = Object.freeze({ 0: "", 1: "TK", 2: "SD", 3: "SLTP", 4: "SLTA", 5: "D1", 6: "D2", 7: "D3", 8: "D4", 9: "S1", 10: "S2", 11: "S3" });
/** Pekerjaan tanpa penghasilan yang lazim pada anak: gaya tulis petugas ("Belum bekerja", "Pelajar"). */
const PEKERJAAN_ANAK = Object.freeze({ 1: "belum bekerja", 2: "mengurus rumah tangga", 3: "pelajar" });
const REF_PEKERJAAN = Object.freeze({
  4: "pensiunan", 5: "pegawai negeri sipil", 6: "anggota TNI", 7: "anggota Polri", 8: "pedagang", 9: "petani", 10: "peternak", 11: "nelayan", 12: "pekerja industri",
  13: "pekerja konstruksi", 14: "pekerja transportasi", 15: "karyawan swasta", 16: "karyawan BUMN", 17: "karyawan BUMD", 18: "karyawan honorer", 19: "buruh harian lepas",
  20: "buruh tani", 21: "buruh nelayan", 22: "buruh peternakan", 23: "pembantu rumah tangga", 65: "guru", 81: "sopir", 84: "pedagang", 85: "perangkat desa",
});

const noRef = (kode) => (kode == null || kode === "" ? null : Number(kode));

/** Calon pria/wanita yang dimohonkan: tepat satu per jenis_mempelai, selainnya dianggap rancu (null). */
function pasangan(mempelai) {
  const aktif = (mempelai || []).filter((m) => String(m.dimohonkan == null ? "1" : m.dimohonkan) !== "0");
  const pria = aktif.filter((m) => String(m.jenis) === "1");
  const wanita = aktif.filter((m) => String(m.jenis) === "2");
  return { pria: pria.length === 1 ? pria[0] : null, wanita: wanita.length === 1 ? wanita[0] : null };
}

const angkaPertama = (t) => {
  const m = /\d+/.exec(String(t || ""));
  return m ? Number(m[0]) : null;
};

/** Usulan nama: SIPP, pembanding bacaan posita. */
function usulNama(kode, nama, orang, bacaPosita) {
  const nm = B.rapikanNama(orang && orang.nama);
  if (!nm || !/[A-Za-z]{3}/.test(nm)) return [];
  const pos = bacaPosita && bacaPosita[kode] ? String(bacaPosita[kode].nilai || "") : "";
  const kal = `Data calon mempelai di SIPP: ${nm}`;
  if (pos && !B.samaNama(nm, pos)) return [];
  return [
    B.butir({
      kode,
      nama,
      nilai: nm,
      keyakinan: pos ? "pasti" : "cukup",
      kalimat: kal,
      catatan: pos ? "Nama di data calon mempelai SIPP sama dengan nama di posita." : "Nama diambil dari data calon mempelai di SIPP (tidak tertulis di posita); periksa ejaannya dengan KTP.",
      kodePola: `s5-dk-${kode}-mempelai`,
    }),
  ];
}

function usulUmur(kode, nama, orang, tanggalDaftar, bacaPosita) {
  const u = B.umurTahun(orang && orang.lahir, tanggalDaftar);
  if (u === null || u < 8 || u > 90) return [];
  const pos = bacaPosita && bacaPosita[kode] ? angkaPertama(bacaPosita[kode].nilai) : null;
  if (pos !== null && pos !== u) return [];
  const lahir = B.isoKeIndonesia(orang.lahir);
  return [
    B.butir({
      kode,
      nama,
      nilai: `${u} tahun`,
      keyakinan: pos !== null ? "pasti" : "cukup",
      kalimat: `Tanggal lahir di SIPP ${lahir}; umur pada tanggal pendaftaran perkara`,
      catatan:
        pos !== null
          ? "Umur dihitung dari tanggal lahir di SIPP dan sama dengan umur di posita."
          : "Umur dihitung dari tanggal lahir calon mempelai di SIPP pada tanggal pendaftaran perkara; sesuaikan bila umur pada hari sidang berbeda.",
      kodePola: `s5-dk-${kode}-lahir`,
    }),
  ];
}

function usulTanggalLahir(kode, nama, orang, bacaPosita) {
  const tampil = B.isoKeTampil(orang && orang.lahir);
  if (!tampil) return [];
  const posIso = bacaPosita && bacaPosita[kode] ? B.indonesiaKeIso(bacaPosita[kode].nilai) : "";
  if (posIso && posIso !== orang.lahir) return [];
  return [
    B.butir({
      kode,
      nama,
      nilai: tampil,
      keyakinan: posIso ? "pasti" : "cukup",
      kalimat: `Tanggal lahir calon mempelai di SIPP: ${B.isoKeIndonesia(orang.lahir)}`,
      catatan: posIso ? "Sama dengan tanggal lahir di posita." : "Dari data calon mempelai di SIPP; cocokkan dengan akta kelahiran/KK.",
      kodePola: `s5-dk-${kode}-lahir`,
    }),
  ];
}

function usulPendidikan(kode, nama, orang) {
  const teks = PENDIDIKAN[noRef(orang && orang.pendidikan)];
  if (!teks) return [];
  return [
    B.butir({
      kode,
      nama,
      nilai: teks,
      keyakinan: "cukup",
      kalimat: `Pendidikan calon mempelai di SIPP: ${teks}`,
      catatan: "Dari data calon mempelai di SIPP (jenjang yang tercatat; cocok dengan isian petugas pada 30 dari 35 perkara, yang lain salah catat di SIPP). Petugas biasa menulisnya dengan ejaan sendiri (SMP, Sekolah Dasar); periksa dengan ijazah/keterangan sekolah.",
      kodePola: `s5-dk-${kode}-pendidikan`,
    }),
  ];
}

function labelPekerjaan(kode) {
  const k = noRef(kode);
  return PEKERJAAN_ANAK[k] || REF_PEKERJAAN[k] || "";
}

function usulPekerjaanAnak(kode, nama, orang) {
  const teks = PEKERJAAN_ANAK[noRef(orang && orang.pekerjaan)];
  if (!teks) return [];
  return [
    B.butir({
      kode,
      nama,
      nilai: teks.charAt(0).toUpperCase() + teks.slice(1),
      keyakinan: "ragu",
      kalimat: `Pekerjaan calon mempelai di SIPP: ${teks}`,
      catatan: "Dari data calon mempelai di SIPP. Petugas bervariasi menulis 'Belum bekerja', 'Tidak ada', 'Pelajar'; periksa dengan keterangan di persidangan.",
      kodePola: `s5-dk-${kode}-pekerjaan`,
    }),
  ];
}

/** 6331: "<pekerjaan> dengan penghasilan rata-rata sejumlah Rp... (... rupiah) per bulan" - hanya bila penghasilan tercatat. */
function usulPekerjaanPria(pria) {
  const label = labelPekerjaan(pria && pria.pekerjaan);
  const uang = B.rupiahBerbilang(pria && pria.nominal);
  if (!label) return [];
  // Pelajar dengan penghasilan tercatat hampir pasti salah catat di SIPP: pekerjaannya saja, tanpa penghasilan.
  const denganUang = uang && PEKERJAAN_ANAK[noRef(pria.pekerjaan)] !== "pelajar";
  return [
    B.butir({
      kode: "6331",
      nama: "Pekerjaan calon suami",
      nilai: denganUang ? `${label} dengan penghasilan rata-rata sejumlah ${uang} per bulan` : label,
      keyakinan: "ragu",
      kalimat: `Data calon mempelai pria di SIPP: pekerjaan ${label}${denganUang ? `, penghasilan ${uang}` : ""}`,
      catatan: denganUang
        ? "Pekerjaan dan penghasilan calon pria dari data calon mempelai di SIPP. Pekerjaan sebenarnya (mis. 'buruh bangunan', 'kerja kebun sawit') dan penghasilan per bulan/per hari ditentukan di persidangan; periksa."
        : "Pekerjaan calon pria dari data calon mempelai di SIPP; penghasilan rata-rata tidak tercatat di SIPP - tambahkan 'dengan penghasilan rata-rata sejumlah Rp... (... rupiah) per bulan' dari keterangan di sidang bila blangko memerlukannya.",
      kodePola: denganUang ? "s5-dk-6331-pekerjaan-penghasilan" : "s5-dk-6331-pekerjaan",
    }),
  ];
}

const POLA_PERNAH_NIKAH = /\b(?:janda|duda|bercerai|perceraian|cerai\s+(?:hidup|mati)|pernah\s+menikah|pernikahan\s+sebelumnya)\b/i;

/** 2029/2030: anak di bawah umur 19 tahun yang posita-nya tidak menyebut perceraian/kematian pasangan = bujang / gadis. */
function usulStatus(kode, nama, orang, tanggalDaftar, posita, kata) {
  const u = B.umurTahun(orang && orang.lahir, tanggalDaftar);
  if (u === null || u > 40) return [];
  const nm = B.rapat(String(orang.nama || "").split(/\s+(?:bin|binti)\s+/i)[0]);
  // Kalimat posita yang menyebut orangnya DAN status pernah menikah => bukan bujang/gadis.
  const kalimat = String(posita || "").split(/;|\.\s+(?=[A-Z])|\s(?=\d{1,2}\s*\.\s*Bahwa\b)/);
  const sebut = kalimat.some((k) => POLA_PERNAH_NIKAH.test(k) && nm.length >= 3 && B.rapat(k).includes(nm));
  if (sebut) return [];
  const minor = u < 19;
  return [
    B.butir({
      kode,
      nama,
      nilai: kata,
      keyakinan: minor ? "cukup" : "ragu",
      kalimat: `Umur menurut SIPP ${u} tahun; posita tidak menyebut perceraian atau kematian pasangan`,
      catatan: minor
        ? "Anak di bawah umur nikah (kurang dari 19 tahun) dan posita tidak menyebut pernah menikah, sehingga statusnya belum pernah menikah. Petugas juga menulis 'jejaka'/'perawan'; sesuaikan."
        : "Umur calon sudah 19 tahun atau lebih; status 'belum pernah menikah' hanya tebakan dari posita yang tidak menyebut perceraian/kematian - periksa.",
      kodePola: `s5-dk-${kode}-status`,
    }),
  ];
}

function usulAlasanLain(posita) {
  const m = /\b((?:agar|supaya|untuk)\s+(?:terhindar|menghindari|menghindarkan)[^;.]{6,160})/i.exec(String(posita || ""));
  if (!m) return [];
  return [
    B.butir({
      kode: "9771",
      nama: "Alasan mendesak yang dikemukakan Pemohon",
      nilai: m[1].replace(/\s+/g, " ").replace(/[,\s]+$/, "").trim(),
      keyakinan: "ragu",
      kalimat: m[0],
      asal: "posita-gugatan",
      catatan: "Kalimat alasan yang dikemukakan Pemohon di posita; ringkas menjadi satu frasa tanpa titik akhir sesuai bentuk isian.",
      kodePola: "s5-dk-9771-posita",
    }),
  ];
}

/**
 * @param {{perkara: {tanggalDaftar: string, posita: string}, mempelai: object[]}} d
 * @param {{bacaPosita?: Function}} [opsi] bacaPosita(posita) -> peta kode -> {nilai} (deteksiDk.nilai) untuk pembanding
 */
function usulanDk(d, opsi = {}) {
  const { pria, wanita } = pasangan(d.mempelai);
  const posita = String((d.perkara && d.perkara.posita) || "");
  const tanggal = d.perkara && d.perkara.tanggalDaftar;
  const baca = typeof opsi.bacaPosita === "function" ? opsi.bacaPosita(posita) || {} : {};
  const hasil = [];
  if (pria) {
    hasil.push(...usulNama("0600", "Nama calon mempelai pria", pria, baca));
    hasil.push(...usulUmur("0601", "Umur calon mempelai pria", pria, tanggal, baca));
    hasil.push(...usulPekerjaanPria(pria));
    hasil.push(...usulStatus("2029", "Status calon mempelai pria", pria, tanggal, B.polos(posita), "bujang"));
  }
  if (wanita) {
    hasil.push(...usulNama("0606", "Nama calon mempelai wanita", wanita, baca));
    hasil.push(...usulUmur("0607", "Umur calon mempelai wanita", wanita, tanggal, baca));
    hasil.push(...usulTanggalLahir("0349", "Tanggal lahir calon mempelai wanita", wanita, baca));
    hasil.push(...usulPendidikan("0609", "Pendidikan calon mempelai wanita", wanita));
    hasil.push(...usulPekerjaanAnak("0610", "Pekerjaan calon mempelai wanita", wanita));
    hasil.push(...usulStatus("2030", "Status calon mempelai wanita", wanita, tanggal, B.polos(posita), "gadis"));
  }
  hasil.push(...usulAlasanLain(B.polos(posita)));
  return hasil;
}

module.exports = { usulanDk, pasangan, usulNama, usulUmur, usulPekerjaanPria, usulStatus, labelPekerjaan, PENDIDIKAN, PEKERJAAN_ANAK };
