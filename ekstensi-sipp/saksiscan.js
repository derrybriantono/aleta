"use strict";

/**
 * ============================================================================
 * ISI DATA SAKSI/PIHAK DARI FOTO KTP ATAU BLANGKO - SIPP (PERBAIKAN 2 OKT 2026)
 * ============================================================================
 *
 * Butir 16, kontrak K5 (agen C). Berkas BERDIRI SENDIRI: ia memasang dirinya
 * pada blangko SIPP "Tambah Referensi Data Pihak" (form#frm_ref_pihak di
 * views/pihak/pihak_list.php - blangko yang sama dipakai "Tambah Data Saksi",
 * addPihak dengan pihakke 13) tanpa menyentuh konten.js.
 *
 * ALURNYA
 *
 *   1. Petugas mengambil/mengunggah foto KTP atau blangko identitas, atau
 *      mengetik/menempel teksnya.
 *   2. Gambar dibaca: TextDetector peramban bila ada (diproses di peramban),
 *      selain itu dikirim ke POST /aleta/api/aleta-ecourt/saksi-scan (OCR di
 *      server bila server punya mesinnya - bila tidak, jawabannya terus terang
 *      "belum dapat membaca gambar"). Teks diurai di server yang sama.
 *   3. USULAN medan tampil di kartu tinjau dan DAPAT DIKOREKSI. Wilayah
 *      Provinsi > Kabupaten/Kota > Kecamatan > Kelurahan/Desa dipilih dari
 *      data wilayah SIPP sendiri (GET /aleta/api/aleta-ecourt/wilayah), induk
 *      ke anak. Nama hasil baca yang tidak cocok TEPAT tidak pernah dipilih
 *      sendiri - yang paling mirip ditawarkan di atas daftar, petugas memilih.
 *   4. Petugas mencentang "sudah saya periksa", lalu "Isi ke blangko SIPP".
 *      ALETA mengisi medan blangko lewat jembatan.js - TIDAK menekan Simpan.
 *      Petugas sendiri yang memeriksa lalu menyimpan.
 *
 * YANG TIDAK PERNAH DILAKUKAN
 *
 *   - Menyimpan foto KTP. Gambar hanya hidup di memori kartu ini sampai
 *     selesai dibaca, lalu dilepas; tidak ada chrome.storage, tidak ada
 *     localStorage, tidak ada arsip. Menutup kartu menghapus seluruh isian.
 *   - Menyisipkan penanda ALETA ke blangko SIPP (butir 14, kontrak K4). Yang
 *     diisikan hanya data orangnya; Keterangan tidak disentuh, tidak ada
 *     atribut/kelas yang ditempel ke medan SIPP, dan pilihan wilayah yang
 *     ditambahkan ke select berbentuk persis seperti yang dibuat SIPP sendiri
 *     (nama wilayah SIPP + nilai bersandi SIPP).
 *   - Menekan Simpan, atau mengisi tanpa klik + centang petugas.
 *
 * GERBANG
 *
 *   - Tampilan UI Baru saja (K1): Lama dan Baru tetap seperti 1.177.0.
 *   - Peran SELAIN hakim, panitera/PP, dan juru sita: alatGolonganPeran
 *     "lain" (operator, petugas PTSP, analis, staf, ...) dan "admin".
 */

const SAKSISCAN_API_SCAN = "/aleta/api/aleta-ecourt/saksi-scan";
const SAKSISCAN_API_WILAYAH = "/aleta/api/aleta-ecourt/wilayah";
const SAKSISCAN_API_SIAPA = "/aleta/api/aleta-ecourt/ekstensi/siapa";
const SAKSISCAN_BORANG = "form#frm_ref_pihak";
const SAKSISCAN_GOLONGAN_BOLEH = ["lain", "admin"];
/** Sisi terpanjang gambar yang dikirim - cukup untuk OCR KTP, jauh lebih ringan dari foto ponsel. */
const SAKSISCAN_SISI_MAKS = 1800;
const SAKSISCAN_BATAS_GAMBAR = 6 * 1024 * 1024;
/** OCR server menjalankan beberapa lintasan (praproses, --psm 6/4/11) - dibatasi 45 detik di sana. */
const SAKSISCAN_BATAS_WAKTU_MS = 60000;
/** Blangko SIPP pihak/saksi (pihak_pertama.php) - wilayahnya readonly, diisi lewat Cari -> pilih. */
const SAKSISCAN_BORANG_SAKSI = "form#frm_user";
const SAKSISCAN_TERIMA = "image/*,application/pdf,.pdf";
const SAKSISCAN_TINGKAT = [
  { kunci: "provinsi", label: "Provinsi", penunjuk: "#prop" },
  { kunci: "kabupaten", label: "Kabupaten/Kota", penunjuk: "#kab" },
  { kunci: "kecamatan", label: "Kecamatan", penunjuk: "#kec" },
  { kunci: "kelurahan", label: "Kelurahan/Desa", penunjuk: "#kel" },
];

/* ─── 1. Fungsi murni (diuji tanpa DOM) ─────────────────────────────────── */

/** Angka yang terbaca OCR di dalam nama wilayah -> hurufnya (dipakai di kedua sisi pembanding). */
const SAKSISCAN_ANGKA_HURUF = { 0: "O", 1: "I", 2: "Z", 4: "A", 5: "S", 6: "G", 8: "B" };

/** Nama wilayah tanpa awalan tingkat, huruf besar, tanpa tanda baca, angka OCR jadi huruf. */
function saksiscanNormal(nama) {
  return String(nama || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[|!]/g, "I")
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:PROVINSI|PROPINSI|PROV|KABUPATEN|KAB|KOTA ADMINISTRASI|KOTA|KECAMATAN|KEC|KELURAHAN|KEL|DESA)\s+/, "")
    .replace(/[0124568]/g, (c) => SAKSISCAN_ANGKA_HURUF[c] || c)
    .trim();
}

/** "kota" | "kabupaten" | "" - pembeda Kabupaten X dan Kota X. */
function saksiscanAwalan(nama) {
  const t = String(nama || "").toUpperCase().trim();
  if (/^KOTA\b/.test(t)) return "kota";
  if (/^(?:KABUPATEN|KAB)\b/.test(t)) return "kabupaten";
  return "";
}

function saksiscanJarak(a, b) {
  const x = String(a || "");
  const y = String(b || "");
  if (x === y) return 0;
  if (!x.length) return y.length;
  if (!y.length) return x.length;
  let sebelum = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i += 1) {
    const kini = [i];
    for (let j = 1; j <= y.length; j += 1) {
      kini[j] = Math.min(sebelum[j] + 1, kini[j - 1] + 1, sebelum[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
    sebelum = kini;
  }
  return sebelum[y.length];
}

/** 0..1 - 1 berarti sama persis sesudah dinormalkan. */
function saksiscanSkor(a, b) {
  const x = saksiscanNormal(a);
  const y = saksiscanNormal(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  // OCR kerap menelan/menyisipkan spasi ("LABUANSALUMBONE") - dibandingkan juga tanpa spasi.
  const xs = x.replace(/ /g, "");
  const ys = y.replace(/ /g, "");
  if (xs === ys) return 0.97;
  const panjang = Math.max(xs.length, ys.length);
  let skor = 1 - saksiscanJarak(xs, ys) / panjang;
  // Satu memuat yang lain utuh ("BANAWA" di "BANAWA SELATAN") - mirip, tidak sama.
  if (x.includes(y) || y.includes(x)) skor = Math.max(skor, 0.7);
  return Math.max(0, Math.min(0.99, skor));
}

/**
 * Nama hasil baca -> { tepat, yakin, calon }.
 *   tepat  satu-satunya wilayah yang SAMA sesudah dinormalkan (dan awalan
 *          Kab./Kota cocok bila tertulis);
 *   yakin  tepat, ATAU satu-satunya yang sangat mirip: skor >= 0.8, jarak
 *          sunting kecil (1 per 6 huruf, paling sedikit 1), dan unggul jelas
 *          (>= 0.1) atas calon kedua - salah baca OCR "LABUAN SALUMBON",
 *          "BANAVVA". Dipilih sendiri TETAPI ditandai "periksa";
 *   calon  sampai lima yang paling mirip (skor >= 0.5) untuk DITAWARKAN.
 * Ragu (dua mirip berdekatan, atau jaraknya besar) = yakin null: tidak ada
 * yang dipilih sendiri, calonnya ditawarkan.
 */
function saksiscanCocokkan(namaBaca, daftar) {
  const nama = String(namaBaca || "").trim();
  const semua = Array.isArray(daftar) ? daftar : [];
  if (!nama || !semua.length) return { tepat: null, yakin: null, calon: [] };
  const awalan = saksiscanAwalan(nama);
  const norm = saksiscanNormal(nama);
  let sama = semua.filter((w) => saksiscanNormal(w.nama) === norm);
  if (sama.length > 1 && awalan) sama = sama.filter((w) => saksiscanAwalan(w.nama) === awalan);
  const calon = semua
    .map((w) => {
      let skor = saksiscanSkor(nama, w.nama);
      if (awalan && saksiscanAwalan(w.nama) && saksiscanAwalan(w.nama) !== awalan) skor *= 0.9;
      return { wilayah: w, skor };
    })
    .filter((x) => x.skor >= 0.5)
    .sort((p, q) => q.skor - p.skor)
    .slice(0, 5);
  const tepat = sama.length === 1 ? sama[0] : null;
  let yakin = tepat;
  if (!yakin && !sama.length && calon.length) {
    const [a, b] = calon;
    const xs = norm.replace(/ /g, "");
    const ys = saksiscanNormal(a.wilayah.nama).replace(/ /g, "");
    const jarak = saksiscanJarak(xs, ys);
    const batas = Math.max(1, Math.floor(Math.max(xs.length, ys.length) / 6));
    if (a.skor >= 0.8 && jarak <= batas && (!b || a.skor - b.skor >= 0.1)) yakin = a.wilayah;
  }
  return { tepat, yakin, calon };
}

/** Jenis kelamin -> nilai #pihak_jenis_kelamin SIPP (1 Laki Laki, 2 Perempuan). */
function saksiscanNilaiJenisKelamin(jk) {
  if (jk === "L") return "1";
  if (jk === "P") return "2";
  return "";
}

/** Status kawin KTP -> nilai #pihak_status_kawin SIPP (1 Kawin, 2 Belum, 3 Duda, 4 Janda). */
function saksiscanNilaiStatusKawin(status, jk) {
  const s = String(status || "").toLowerCase();
  if (s === "kawin") return "1";
  if (s === "belum kawin") return "2";
  if (s.startsWith("cerai")) {
    if (jk === "L") return "3";
    if (jk === "P") return "4";
  }
  return "";
}

/**
 * Pekerjaan -> #apakahtni (blangko pengadilan agama: 1 TNI, 3 PNS, 4 BUMN/BUMD,
 * 5 POLRI, 2 Lain-Lain + teks) dan teks #pihak_pekerjaan.
 */
function saksiscanPekerjaan(pekerjaan) {
  const teks = String(pekerjaan || "").trim();
  const t = teks.toUpperCase();
  if (!t) return { pilih: "", teks: "" };
  if (/PENSIUN/.test(t)) return { pilih: "2", teks };
  if (/\bTNI\b|TENTARA/.test(t)) return { pilih: "1", teks: "" };
  if (/\bPOLRI\b|KEPOLISIAN/.test(t)) return { pilih: "5", teks: "" };
  if (/\bPNS\b|PEGAWAI NEGERI/.test(t)) return { pilih: "3", teks: "" };
  if (/BUMN|BUMD/.test(t)) return { pilih: "4", teks: "" };
  return { pilih: "2", teks };
}

/** Kelompok sebutan pendidikan yang setara (SIPP dan gugatan memakai sebutan berbeda). */
const SAKSISCAN_SETARA_PENDIDIKAN = [
  ["TIDAKSEKOLAH", "TIDAKTAMATSD", "BELUMSEKOLAH"],
  ["SD", "SEDERAJAT", "SDMI", "MI"],
  ["SLTP", "SMP", "MTS", "SMPSEDERAJAT", "SLTPSEDERAJAT"],
  ["SLTA", "SMA", "SMK", "MA", "SMASEDERAJAT", "SLTASEDERAJAT"],
  ["D1", "DIPLOMAI"],
  ["D2", "DIPLOMAII"],
  ["D3", "DIPLOMAIII", "AKADEMI"],
  ["S1", "D4", "SARJANA", "STRATAI", "DIPLOMAIV"],
  ["S2", "MAGISTER", "STRATAII"],
  ["S3", "DOKTOR", "STRATAIII"],
];

/** Pendidikan -> nilai option #pihak_pendidikan (dicocokkan dengan tulisannya). */
function saksiscanNilaiPendidikan(pendidikan, pilihan) {
  const baku = (x) => String(x || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const p = baku(pendidikan);
  if (!p) return "";
  const kelompok = SAKSISCAN_SETARA_PENDIDIKAN.find((g) => g.includes(p) || g.some((x) => p.startsWith(x) && x.length >= 3)) || [p];
  for (const o of pilihan || []) {
    const t = baku(o.tulisan);
    if (!o.nilai || !t) continue;
    if (t === p || kelompok.includes(t)) return String(o.nilai);
  }
  for (const o of pilihan || []) {
    const t = baku(o.tulisan);
    if (o.nilai && t && kelompok.some((x) => x.length >= 3 && t.startsWith(x))) return String(o.nilai);
  }
  return "";
}

const SAKSISCAN_ALIAS_AGAMA = {
  islam: ["islam"],
  kristen: ["protestan", "kristen", "kristen protestan"],
  katolik: ["katolik", "katholik", "kristen katolik"],
  hindu: ["hindu"],
  budha: ["budha", "buddha"],
  konghucu: ["kong hu cu", "konghucu", "khonghucu"],
  lainnya: ["lainnya", "kepercayaan"],
};

/** Agama -> nilai option yang ada di blangko (dicocokkan dengan tulisannya). */
function saksiscanNilaiAgama(agama, pilihan) {
  const a = String(agama || "").toLowerCase().trim();
  if (!a) return "";
  const alias = SAKSISCAN_ALIAS_AGAMA[a] || [a];
  for (const p of pilihan || []) {
    const tulisan = String(p.tulisan || "").toLowerCase().trim();
    if (p.nilai && alias.includes(tulisan)) return String(p.nilai);
  }
  return "";
}

/** Kode desa SIPP ruas keempat 1xxx = kelurahan, 2xxx = desa (kode Kemendagri). */
function saksiscanSebutanDesa(kode) {
  const ruas = String(kode || "").split(".");
  const akhir = ruas[3] || "";
  if (akhir.startsWith("1")) return "Kelurahan";
  if (akhir.startsWith("2")) return "Desa";
  return "Desa/Kelurahan";
}

/** Alamat lengkap seperti yang lazim ditulis di SIPP - nama wilayah dari SIPP sendiri. */
function saksiscanSusunAlamat(medan, wilayah) {
  const m = medan || {};
  const w = wilayah || {};
  const bagian = [];
  if (m.alamat) bagian.push(String(m.alamat).trim());
  if (m.rt || m.rw) bagian.push(`RT ${m.rt || "-"}/RW ${m.rw || "-"}`);
  if (w.kelurahan && w.kelurahan.nama) bagian.push(`${saksiscanSebutanDesa(w.kelurahan.kode)} ${w.kelurahan.nama}`);
  if (w.kecamatan && w.kecamatan.nama) bagian.push(`Kecamatan ${w.kecamatan.nama}`);
  if (w.kabupaten && w.kabupaten.nama) bagian.push(w.kabupaten.nama);
  if (w.provinsi && w.provinsi.nama) bagian.push(`Provinsi ${w.provinsi.nama}`);
  return bagian.filter(Boolean).join(", ");
}

/**
 * Rencana pengisian blangko - MURNI, supaya dapat diperiksa sebelum satu medan
 * pun disentuh. Tiap langkah { penunjuk, jenis, nilai, label, opsi? }.
 * `opsi` (wilayah) = <option> yang ditambahkan dulu ke select SIPP.
 *
 * Wilayah (perbaikan 5 Okt butir 7): diisikan BERURUTAN induk ke anak -
 * Provinsi, Kabupaten/Kota, Kecamatan, Kelurahan/Desa - seperti select2 SIPP
 * yang tiap tingkatnya bergantung pada induknya, dan SEJAUH rantainya utuh.
 * Tingkat pertama yang kosong, tidak bersandi, atau bukan anak dari tingkat
 * di atasnya MENGHENTIKAN rantai di situ: tingkat di bawahnya tidak diisi
 * (anak tanpa induk yang benar akan tersimpan SIPP sebagai wilayah yang
 * salah), dan petugas memilihnya sendiri di blangko - select2 SIPP sudah
 * memuat pilihannya dari induk yang terisi.
 */
function saksiscanRencana(tinjau, borang) {
  const t = tinjau || {};
  const b = borang || {};
  const langkah = [];
  const tambah = (penunjuk, jenis, nilai, label, opsi) => {
    const v = nilai === undefined || nilai === null ? "" : String(nilai).trim();
    if (!v) return;
    if (b.ada && !b.ada.includes(penunjuk)) return;
    langkah.push(opsi ? { penunjuk, jenis, nilai: v, label, opsi } : { penunjuk, jenis, nilai: v, label });
  };
  tambah("#pihak_fullname", "teks", t.nama, "Nama");
  tambah("#pihak_tempat_lahir", "teks", t.tempatLahir, "Tempat lahir");
  tambah("#pihak_tgl_lahir", "tanggal", /^\d{2}\/\d{2}\/\d{4}$/.test(String(t.tanggalLahir || "")) ? t.tanggalLahir : "", "Tanggal lahir");
  if (/^\d{16}$/.test(String(t.nik || ""))) {
    tambah("#pihak_jenis_identitas", "pilih", "4", "Jenis identitas (KTP)");
    tambah("#pihak_no_identitas", "teks", t.nik, "NIK");
  }
  // Umur saja (gugatan kerap menulis "umur 29 tahun"): SIPP sendiri menghitung
  // tanggal lahirnya dari #pihak_umur. Hanya bila tanggal lahir tidak ada.
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(String(t.tanggalLahir || "")) && /^\d{1,3}$/.test(String(t.umur || "").trim())) {
    tambah("#pihak_umur", "teks", String(t.umur).trim(), "Umur");
  }
  tambah("#pihak_no_tlp", "teks", t.telepon, "No telepon");
  tambah("#pihak_email", "teks", /@/.test(String(t.surel || "")) ? t.surel : "", "Surel");
  tambah("#pihak_alamat", "teks", t.alamatLengkap, "Alamat");

  const w = t.wilayah || {};
  const rantai = SAKSISCAN_TINGKAT.map((x) => ({ ...x, pilih: w[x.kunci] || null }));
  const terisi = [];
  for (let i = 0; i < rantai.length; i += 1) {
    const p = rantai[i].pilih;
    if (!(p && p.kode && p.nama && p.nilaiSipp)) break;
    if (i > 0 && !String(p.kode).startsWith(`${terisi[i - 1].pilih.kode}.`)) break;
    terisi.push(rantai[i]);
  }
  for (const x of terisi) {
    tambah(x.penunjuk, "pilih", x.pilih.nilaiSipp, x.label, { tulisan: x.pilih.nama, nilai: x.pilih.nilaiSipp });
  }
  const bertingkat = terisi.length === rantai.length;

  tambah("#pihak_jenis_kelamin", "pilih", saksiscanNilaiJenisKelamin(t.jenisKelamin), "Jenis kelamin");
  tambah("#pihak_agama", "pilih", saksiscanNilaiAgama(t.agama, b.pilihanAgama), "Agama");
  const kerja = saksiscanPekerjaan(t.pekerjaan);
  if (b.apakahTni) {
    tambah("#apakahtni", "pilih", kerja.pilih, "Pekerjaan");
    if (kerja.pilih === "2") tambah("#pihak_pekerjaan", "teks", kerja.teks, "Pekerjaan (uraian)");
  } else {
    tambah("#pihak_pekerjaan", "teks", t.pekerjaan, "Pekerjaan");
  }
  tambah("#pihak_status_kawin", "pilih", saksiscanNilaiStatusKawin(t.statusKawin, t.jenisKelamin), "Status kawin");
  tambah("#pihak_pendidikan", "pilih", saksiscanNilaiPendidikan(t.pendidikan, b.pilihanPendidikan), "Pendidikan");
  tambah("#pihak_gol_darah", "pilih", /^(A|B|AB|O)$/.test(String(t.golonganDarah || "")) ? t.golonganDarah : "", "Golongan darah");
  return {
    langkah,
    wilayahDiisi: bertingkat,
    wilayahTerisi: terisi.length,
    wilayahDipilih: rantai.filter((x) => x.pilih).length,
  };
}

/**
 * Pesan apa pun -> kalimat. Galat rute portal berbentuk { message, details }
 * (handleRouteError) - ditulis apa adanya ke textContent ia menjadi
 * "[object Object]". Semua jalur pesan kartu lewat sini.
 */
function saksiscanTeksPesan(x) {
  if (x === null || x === undefined) return "";
  if (typeof x === "string") return x;
  if (typeof x === "object") {
    const isi = x.message || x.pesan || x.alasan || x.error;
    return isi && isi !== x ? saksiscanTeksPesan(isi) : "";
  }
  return String(x);
}

const SAKSISCAN_BULAN = {
  jan: 1, januari: 1, feb: 2, februari: 2, mar: 3, maret: 3, apr: 4, april: 4, mei: 5, jun: 6, juni: 6,
  jul: 7, juli: 7, agu: 8, agt: 8, agustus: 8, sep: 9, september: 9, okt: 10, oktober: 10, nov: 11,
  nopember: 11, november: 11, des: 12, desember: 12,
};

/** Tanggal dalam bentuk apa pun yang ditulis SIPP -> "dd/mm/yyyy", atau "". */
function saksiscanTanggalBaku(teks) {
  const s = String(teks || "");
  const dua = (n) => String(n).padStart(2, "0");
  let m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${dua(m[3])}/${dua(m[2])}/${m[1]}`;
  m = /(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(s);
  if (m) return `${dua(m[1])}/${dua(m[2])}/${m[3]}`;
  m = /(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})/.exec(s);
  if (m && SAKSISCAN_BULAN[m[2].toLowerCase()]) return `${dua(m[1])}/${dua(SAKSISCAN_BULAN[m[2].toLowerCase()])}/${m[3]}`;
  return "";
}

/** Nama orang untuk dibandingkan: huruf besar, huruf saja, spasi tunggal. */
function saksiscanNamaBaku(nama) {
  return String(nama || "")
    .toUpperCase()
    .replace(/[^A-Z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Batas permintaan wilayah untuk satu kali menyimpulkan (seluruhnya disinggah). */
const SAKSISCAN_BATAS_CARI = 60;

/**
 * ============================================================================
 * MENYIMPULKAN WILAYAH YANG TIDAK TERBACA (perbaikan 5 Okt butir 6)
 * ============================================================================
 *
 * Tingkat demi tingkat dari provinsi, atas data wilayah SIPP sendiri
 * (`ambil({induk})` = GET /aleta-ecourt/wilayah):
 *
 *   1. nama terbaca cocok TEPAT              -> cara "tepat"
 *   2. satu-satunya yang sangat MIRIP        -> cara "mirip"   (periksa)
 *   3. tidak terbaca / tidak ada yang mirip, tetapi 6 angka pertama NIK
 *      (kode kecamatan penerbit) menunjuk satu anak dari induk terpilih
 *                                            -> cara "nik"     (periksa)
 *      - bila nama terbaca dan calon miripnya ada, NIK hanya dipakai bila
 *        ia termasuk calon itu (cara "nik-mirip"); NIK tidak pernah
 *        menimpa nama yang terbaca jelas.
 *   4. masih kosong: tingkat di BAWAHNYA yang terbaca dicari di tiap anak -
 *      bila TEPAT SATU induk memuat anak yang cocok/yakin, induk itu yang
 *      dipilih -> cara "disimpulkan" (mis. kabupaten tak terbaca, tetapi
 *      kecamatan "LABUAN" hanya ada di Kab. Donggala).
 *   5. tetap ragu -> null; calonnya ditawarkan, petugas memilih.
 *
 * Hasil: { ok, pilih: {provinsi..kelurahan: {wilayah, cara, calon}}, daftar,
 * sandi }. Murni terhadap DOM - uji menjalankannya dengan `ambil` tiruan.
 */
async function saksiscanSimpulkanWilayah(baca, kodeNik, ambil, batas) {
  const b = baca || {};
  let sisa = Number.isFinite(batas) ? batas : SAKSISCAN_BATAS_CARI;
  let sandi = { ok: true };
  const muat = async (induk) => {
    if (sisa <= 0) return null;
    sisa -= 1;
    let j = null;
    try {
      j = await ambil({ induk });
    } catch {
      j = null;
    }
    if (!j || !j.ok) return null;
    if (j.sandi && j.sandi.ok === false) sandi = j.sandi;
    return Array.isArray(j.data) ? j.data : [];
  };
  const ruasNik = String(kodeNik || "").split(".");
  const kodeNikTingkat = (i) =>
    ruasNik.length > i && ruasNik.slice(0, i + 1).every((r) => /^\d{2}$/.test(r)) ? ruasNik.slice(0, i + 1).join(".") : "";
  const putuskan = (i, nama, daftar) => {
    const c = saksiscanCocokkan(nama, daftar);
    if (c.tepat) return { wilayah: c.tepat, cara: "tepat", calon: c.calon };
    if (c.yakin) return { wilayah: c.yakin, cara: "mirip", calon: c.calon };
    const kode = kodeNikTingkat(i);
    const dariNik = kode ? daftar.find((w) => w.kode === kode) : null;
    if (dariNik) {
      if (!String(nama || "").trim() || !c.calon.length) return { wilayah: dariNik, cara: "nik", calon: c.calon };
      if (c.calon.some((x) => x.wilayah.kode === dariNik.kode)) return { wilayah: dariNik, cara: "nik-mirip", calon: c.calon };
    }
    return { wilayah: null, cara: "", calon: c.calon };
  };
  const lewatAnak = async (i, daftar) => {
    if (i + 1 >= SAKSISCAN_TINGKAT.length) return null;
    const namaAnak = String(b[SAKSISCAN_TINGKAT[i + 1].kunci] || "").trim();
    if (!namaAnak || !daftar.length || daftar.length > sisa) return null;
    const temu = [];
    for (const w of daftar) {
      const anak = await muat(w.kode);
      if (!anak) continue;
      const c = saksiscanCocokkan(namaAnak, anak);
      if (c.tepat || c.yakin) temu.push(w);
    }
    return temu.length === 1 ? temu[0] : null;
  };

  const pilih = { provinsi: null, kabupaten: null, kecamatan: null, kelurahan: null };
  const daftarSemua = { provinsi: null, kabupaten: null, kecamatan: null, kelurahan: null };
  let induk = "";
  for (let i = 0; i < SAKSISCAN_TINGKAT.length; i += 1) {
    const x = SAKSISCAN_TINGKAT[i];
    if (i > 0 && !induk) break;
    const daftar = await muat(induk);
    if (!daftar) {
      if (i === 0) return { ok: false, pilih, daftar: daftarSemua, sandi };
      break;
    }
    daftarSemua[x.kunci] = daftar;
    let r = putuskan(i, b[x.kunci], daftar);
    if (!r.wilayah) {
      const w = await lewatAnak(i, daftar);
      if (w) r = { wilayah: w, cara: "disimpulkan", dari: SAKSISCAN_TINGKAT[i + 1].label, calon: r.calon };
    }
    pilih[x.kunci] = r;
    induk = r.wilayah ? r.wilayah.kode : "";
  }
  return { ok: true, pilih, daftar: daftarSemua, sandi };
}

/* ─── 2. Gerbang: tampilan dan peran ────────────────────────────────────── */

function saksiscanModeUi() {
  try {
    return typeof alatUjiMode === "function" && alatUjiMode() === "ui";
  } catch {
    return false;
  }
}

function saksiscanPeranBoleh(peran) {
  if (!String(peran || "").trim()) return false;
  if (typeof alatGolonganPeran !== "function") return false;
  return SAKSISCAN_GOLONGAN_BOLEH.includes(alatGolonganPeran(peran));
}

const saksiscanKeadaan = {
  siapa: null,
  siapaJanji: null,
  pemicu: null,
  kartu: null,
  pengamat: null,
  jamPeriksa: null,
  wilayahSinggah: new Map(),
  tinjau: null,
};

async function saksiscanMuatSiapa() {
  if (saksiscanKeadaan.siapa) return saksiscanKeadaan.siapa;
  if (saksiscanKeadaan.siapaJanji) return saksiscanKeadaan.siapaJanji;
  saksiscanKeadaan.siapaJanji = (async () => {
    try {
      const opsi = { credentials: "include", cache: "no-store" };
      const r = typeof alatAmbil === "function" ? await alatAmbil(SAKSISCAN_API_SIAPA, opsi, "Membaca akun ALETA") : await fetch(SAKSISCAN_API_SIAPA, opsi);
      if (!r.ok) return null;
      const luar = await r.json();
      const isi = luar && luar.data ? luar.data : luar;
      if (!isi || !isi.peran) return null;
      saksiscanKeadaan.siapa = { nama: String(isi.nama || ""), peran: String(isi.peran || "") };
      return saksiscanKeadaan.siapa;
    } catch {
      return null;
    } finally {
      saksiscanKeadaan.siapaJanji = null;
    }
  })();
  return saksiscanKeadaan.siapaJanji;
}

/* ─── 3. Blangko SIPP dan jembatan ──────────────────────────────────────── */

function saksiscanTampak(el) {
  if (!el) return false;
  for (let s = el; s && s.nodeType === 1; s = s.parentElement) {
    let gaya = null;
    try {
      gaya = window.getComputedStyle(s);
    } catch {
      gaya = null;
    }
    if (gaya && (gaya.display === "none" || gaya.visibility === "hidden")) return false;
  }
  return true;
}

function saksiscanBorang() {
  const f = document.querySelector(SAKSISCAN_BORANG);
  return f && saksiscanTampak(f) ? f : null;
}

/** Keadaan blangko yang perlu diketahui rencana: medan yang ada, pilihan agama, #apakahtni. */
function saksiscanBacaBorang(f) {
  const ada = [];
  const penunjuk = [
    "#pihak_fullname", "#pihak_tempat_lahir", "#pihak_tgl_lahir", "#pihak_jenis_identitas", "#pihak_no_identitas",
    "#pihak_no_tlp", "#pihak_alamat", "#prop", "#kab", "#kec", "#kel", "#pihak_jenis_kelamin", "#pihak_agama",
    "#apakahtni", "#pihak_pekerjaan", "#pihak_status_kawin", "#pihak_gol_darah",
    "#pihak_umur", "#pihak_pendidikan", "#pihak_email",
  ];
  // Medan yang disembunyikan SIPP (bukan perorangan, bukan WNI) tidak diisi:
  // isian tersembunyi tetap ikut terkirim saat petugas menekan Simpan.
  // Kecuali uraian pekerjaan - barisnya baru dimunculkan SIPP sesudah
  // #apakahtni bernilai Lain-Lain, yang diisikan lebih dulu.
  for (const p of penunjuk) {
    const el = f ? f.querySelector(p) : null;
    if (el && (p === "#pihak_pekerjaan" || saksiscanTampak(el))) ada.push(p);
  }
  const agama = f ? f.querySelector("#pihak_agama") : null;
  const pilihanAgama = agama
    ? Array.from(agama.options || []).map((o) => ({ nilai: o.value, tulisan: String(o.textContent || "").trim() }))
    : [];
  const pendidikan = f ? f.querySelector("#pihak_pendidikan") : null;
  const pilihanPendidikan = pendidikan
    ? Array.from(pendidikan.options || []).map((o) => ({ nilai: o.value, tulisan: String(o.textContent || "").trim() }))
    : [];
  return { ada, pilihanAgama, pilihanPendidikan, apakahTni: Boolean(f && f.querySelector("#apakahtni")) };
}

let saksiscanNomorPesan = 0;

/** Satu permintaan ke jembatan.js (dunia halaman) -> jawabannya, atau gagal sesudah batas waktu. */
function saksiscanJembatan(pesan, batasMs) {
  saksiscanNomorPesan += 1;
  const id = `aleta-saksiscan-${Date.now()}-${saksiscanNomorPesan}`;
  return new Promise((selesai) => {
    let jam = null;
    const dengar = (peristiwa) => {
      if (peristiwa.source !== window) return;
      const isi = peristiwa.data;
      if (!isi || isi.sumber !== "aleta-jembatan-jawab" || isi.id !== id) return;
      window.removeEventListener("message", dengar);
      clearTimeout(jam);
      selesai(isi);
    };
    jam = setTimeout(() => {
      window.removeEventListener("message", dengar);
      selesai({ ok: false, alasan: "jembatan_tidak_menjawab" });
    }, batasMs || 4000);
    window.addEventListener("message", dengar);
    window.postMessage({ sumber: "aleta-jembatan", id, ...pesan }, "*");
  });
}

/**
 * Pilihan wilayah ditambahkan ke select SIPP persis seperti SIPP sendiri
 * mengisi select2-nya (`$('#kab').empty().append(...)`): pilihan lama yang
 * bernilai dibuang, satu pilihan baru {nama wilayah SIPP, nilai bersandi SIPP}.
 */
function saksiscanSiapkanPilihan(f, penunjuk, opsi) {
  const sel = f.querySelector(penunjuk);
  if (!sel) return false;
  for (const o of Array.from(sel.options || [])) if (o.value) o.remove();
  const baru = document.createElement("option");
  baru.value = opsi.nilai;
  baru.textContent = opsi.tulisan;
  sel.appendChild(baru);
  return true;
}

async function saksiscanJalankan(rencana) {
  const hasil = [];
  for (const l of rencana.langkah) {
    const f = saksiscanBorang();
    if (!f) {
      hasil.push({ label: l.label, ok: false, sebab: "blangko SIPP sudah tertutup" });
      break;
    }
    if (l.opsi && !saksiscanSiapkanPilihan(f, l.penunjuk, l.opsi)) {
      hasil.push({ label: l.label, ok: false, sebab: "medan tidak ada di blangko" });
      continue;
    }
    const jawab = await saksiscanJembatan({
      jenis: "isi",
      penunjuk: `${SAKSISCAN_BORANG} ${l.penunjuk}`,
      jenisMedan: l.jenis,
      nilai: l.nilai,
    });
    hasil.push({ label: l.label, ok: jawab && jawab.ok === true, sebab: jawab && jawab.ok ? "" : String((jawab && jawab.alasan) || "tidak terisi") });
  }
  return hasil;
}

/* ─── 4. Permintaan ke portal ALETA ─────────────────────────────────────── */

async function saksiscanKirim(muatan) {
  const kendali = typeof AbortController === "function" ? new AbortController() : null;
  const jam = kendali ? setTimeout(() => kendali.abort(), SAKSISCAN_BATAS_WAKTU_MS) : null;
  try {
    const r = await fetch(SAKSISCAN_API_SCAN, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(muatan),
      signal: kendali ? kendali.signal : undefined,
    });
    let luar = null;
    try {
      luar = await r.json();
    } catch {
      luar = null;
    }
    if (r.status === 423) {
      return {
        ok: false,
        pesan: "Mode coba menahan pembacaan (dikirim ke server ALETA). Centang \"Izinkan tindakan nyata\" di popup ekstensi, atau isi blangko seperti biasa.",
      };
    }
    if (r.status === 401 || r.status === 403) return { ok: false, pesan: "Belum masuk portal ALETA, atau peran ini tidak diberi akses panel." };
    const isi = luar && luar.data ? luar.data : luar;
    if (!r.ok || !isi) {
      return { ok: false, pesan: saksiscanTeksPesan(luar && (luar.message || luar.error)) || `Server ALETA menjawab ${r.status}.` };
    }
    if (isi.ok !== true) {
      return { ok: false, pesan: saksiscanTeksPesan(isi.pesan || isi.alasan) || "Tidak terbaca.", teks: saksiscanTeksPesan(isi.teks) };
    }
    return { ok: true, isi };
  } catch (e) {
    return { ok: false, pesan: e && e.name === "AbortError" ? "Server ALETA terlalu lama menjawab." : "Server ALETA tidak dapat dihubungi." };
  } finally {
    if (jam) clearTimeout(jam);
  }
}

async function saksiscanWilayah(param) {
  const kunci = param.kode ? `kode:${param.kode}` : `induk:${param.induk || ""}`;
  if (saksiscanKeadaan.wilayahSinggah.has(kunci)) return saksiscanKeadaan.wilayahSinggah.get(kunci);
  const kueri = param.kode ? `kode=${encodeURIComponent(param.kode)}` : `induk=${encodeURIComponent(param.induk || "")}`;
  try {
    const opsi = { credentials: "include", cache: "no-store" };
    const alamat = `${SAKSISCAN_API_WILAYAH}?${kueri}`;
    const r = typeof alatAmbil === "function" ? await alatAmbil(alamat, opsi, "Membaca wilayah SIPP") : await fetch(alamat, opsi);
    const luar = await r.json();
    const isi = luar && luar.data ? luar.data : luar;
    if (!r.ok || !isi || isi.ok !== true) {
      return { ok: false, pesan: saksiscanTeksPesan(isi && (isi.alasan || isi.message || isi.error)) || "Data wilayah SIPP belum dapat dibaca.", data: [] };
    }
    const hasil = { ok: true, sandi: isi.sandi || { ok: true }, data: Array.isArray(isi.data) ? isi.data : [] };
    saksiscanKeadaan.wilayahSinggah.set(kunci, hasil);
    return hasil;
  } catch {
    return { ok: false, pesan: "Data wilayah SIPP belum dapat dibaca.", data: [] };
  }
}

/* ─── 5. Gambar: dibaca di memori, dikecilkan, lalu dilepas ─────────────── */

function saksiscanBacaBerkas(berkas) {
  return new Promise((selesai) => {
    try {
      const pembaca = new FileReader();
      pembaca.onload = () => selesai(String(pembaca.result || ""));
      pembaca.onerror = () => selesai("");
      pembaca.readAsDataURL(berkas);
    } catch {
      selesai("");
    }
  });
}

/** Foto ponsel diperkecil ke SAKSISCAN_SISI_MAKS (JPEG); tanpa kanvas dipakai apa adanya. */
function saksiscanKecilkan(dataUrl) {
  return new Promise((selesaiAsli) => {
    // Gambar yang tidak pernah memicu load/error tidak boleh menggantung kartu.
    let sudah = false;
    const jaga = setTimeout(() => selesai(dataUrl), 4000);
    function selesai(x) {
      if (sudah) return;
      sudah = true;
      clearTimeout(jaga);
      selesaiAsli(x);
    }
    try {
      const gambar = new Image();
      gambar.onload = () => {
        try {
          const skala = Math.min(1, SAKSISCAN_SISI_MAKS / Math.max(gambar.naturalWidth || 1, gambar.naturalHeight || 1));
          const kanvas = document.createElement("canvas");
          kanvas.width = Math.max(1, Math.round((gambar.naturalWidth || 1) * skala));
          kanvas.height = Math.max(1, Math.round((gambar.naturalHeight || 1) * skala));
          const ctx = kanvas.getContext && kanvas.getContext("2d");
          if (!ctx) return selesai(dataUrl);
          ctx.drawImage(gambar, 0, 0, kanvas.width, kanvas.height);
          const hasil = kanvas.toDataURL("image/jpeg", 0.88);
          kanvas.width = 0;
          kanvas.height = 0;
          selesai(hasil && hasil.startsWith("data:image/") ? hasil : dataUrl);
        } catch {
          selesai(dataUrl);
        }
      };
      gambar.onerror = () => selesai(dataUrl);
      gambar.src = dataUrl;
    } catch {
      selesai(dataUrl);
    }
  });
}

/**
 * TextDetector peramban (Shape Detection API) - bila diaktifkan di Chrome,
 * gambar dibaca di peramban sendiri dan yang dikirim hanya teksnya.
 * Tidak ada di Chrome bawaan; tidak ada = kosong, jatuh ke server.
 */
async function saksiscanBacaDiPeramban(berkas) {
  try {
    if (typeof TextDetector !== "function" || typeof createImageBitmap !== "function") return "";
    const bitmap = await createImageBitmap(berkas);
    const temuan = await new TextDetector().detect(bitmap);
    if (bitmap && typeof bitmap.close === "function") bitmap.close();
    return (temuan || []).map((x) => String(x.rawValue || "")).filter(Boolean).join("\n");
  } catch {
    return "";
  }
}

/* ─── 6. Kartu: ambil gambar -> tinjau -> isi ───────────────────────────── */

function saksiscanEl(tag, kelas, teks) {
  const e = document.createElement(tag);
  if (kelas) e.className = kelas;
  if (teks !== undefined && teks !== null) e.textContent = String(teks);
  return e;
}

const SAKSISCAN_MEDAN_TINJAU = [
  ["nama", "Nama"],
  ["nik", "NIK"],
  ["tempatLahir", "Tempat lahir"],
  ["tanggalLahir", "Tanggal lahir (dd/mm/yyyy)"],
  ["jenisKelamin", "Jenis kelamin"],
  ["agama", "Agama"],
  ["statusKawin", "Status kawin"],
  ["pekerjaan", "Pekerjaan"],
  ["golonganDarah", "Golongan darah"],
  ["telepon", "No telepon"],
  ["alamat", "Alamat (jalan/dusun)"],
  ["rt", "RT"],
  ["rw", "RW"],
  // Tidak ada medannya di blangko pihak SIPP - ditampilkan untuk dicocokkan
  // (dan dipakai variabel ABT "Tanggal KTP"), tidak diisikan.
  ["umur", "Umur (tahun, bila tanpa tanggal lahir)"],
  ["pendidikan", "Pendidikan"],
  ["surel", "Surel / domisili elektronik"],
  ["tanggalTerbit", "Tanggal terbit KTP"],
  ["kotaTerbit", "Kota terbit KTP"],
];

function saksiscanStatus(kartu, teks, nada) {
  const s = kartu.querySelector(".aleta-c2-saksi-status");
  if (!s) return;
  const kalimat = saksiscanTeksPesan(teks);
  s.textContent = kalimat;
  s.hidden = !kalimat;
  if (nada) s.setAttribute("data-nada", nada);
  else s.removeAttribute("data-nada");
}

/** Hapus seluruh isian kartu - data orang tidak tinggal di layar sesudah kartu ditutup. */
function saksiscanBersihkan() {
  saksiscanKeadaan.tinjau = null;
  const k = saksiscanKeadaan.kartu;
  if (!k) return;
  for (const el of Array.from(k.querySelectorAll("input, textarea"))) {
    if (el.type === "checkbox") el.checked = false;
    else el.value = "";
  }
  k._saksiTempel = null;
  k._saksiTetapTambah = false;
  const tempel = k.querySelector(".aleta-c2-saksi-tempel");
  if (tempel) tempel.textContent = "";
  const tinjau = k.querySelector(".aleta-c2-saksi-tinjau");
  if (tinjau) tinjau.hidden = true;
  const hasil = k.querySelector(".aleta-c2-saksi-hasil");
  if (hasil) hasil.textContent = "";
  saksiscanStatus(k, "");
}

/** Sembul SIPP digeser menjauhi kartu (konten.js, t7SetelSembul) bila ada. */
function saksiscanKabarSembul() {
  try {
    if (typeof t7SetelSembul === "function") t7SetelSembul();
  } catch {
    /* sembul tetap di tempatnya */
  }
}

function saksiscanTutup() {
  saksiscanBersihkan();
  if (saksiscanKeadaan.kartu) saksiscanKeadaan.kartu.hidden = true;
  saksiscanKabarSembul();
}

function saksiscanNilaiTinjau(kartu) {
  const t = { ...(saksiscanKeadaan.tinjau || {}) };
  for (const [kunci] of SAKSISCAN_MEDAN_TINJAU) {
    const el = kartu.querySelector(`[data-saksi-medan="${kunci}"]`);
    if (el) t[kunci] = String(el.value || "").trim();
  }
  const alamatLengkap = kartu.querySelector("[data-saksi-medan='alamatLengkap']");
  t.alamatLengkap = alamatLengkap ? String(alamatLengkap.value || "").trim() : "";
  t.wilayah = {};
  for (const x of SAKSISCAN_TINGKAT) {
    const sel = kartu.querySelector(`select[data-saksi-wilayah="${x.kunci}"]`);
    const pilih = sel && sel.value && sel._saksiDaftar ? sel._saksiDaftar.find((w) => w.kode === sel.value) : null;
    t.wilayah[x.kunci] = pilih || null;
  }
  return t;
}

/** Alamat lengkap disusun ulang selama petugas belum menyuntingnya sendiri. */
function saksiscanSegarkanAlamat(kartu) {
  const kotak = kartu.querySelector("[data-saksi-medan='alamatLengkap']");
  if (!kotak || kotak.dataset.disunting === "ya") return;
  const t = saksiscanNilaiTinjau(kartu);
  kotak.value = saksiscanSusunAlamat(t, t.wilayah);
}

/** Keterangan satu tingkat wilayah menurut cara terpilihnya. */
function saksiscanKetWilayah(namaBaca, keputusan, adaCalon) {
  const k = keputusan || {};
  const nama = String(namaBaca || "").trim();
  switch (k.cara) {
    case "tepat":
      return ["cocok tepat dengan data SIPP", "aman"];
    case "mirip":
      return [`terbaca "${nama}" - dipilih yang paling mirip, periksa`, "mendesak"];
    case "nik":
      return [`${nama ? `terbaca "${nama}" tidak dikenal` : "tidak terbaca"} - diambil dari NIK (wilayah penerbit KTP), periksa`, "mendesak"];
    case "nik-mirip":
      return [`terbaca "${nama}" - dipilih yang sesuai NIK, periksa`, "mendesak"];
    case "disimpulkan":
      return [`${nama ? `terbaca "${nama}" tidak dikenal` : "tidak terbaca"} - disimpulkan dari ${k.dari || "tingkat di bawahnya"}, periksa`, "mendesak"];
    default:
      if (!nama) return ["tidak terbaca - pilih sendiri", "mendesak"];
      if (adaCalon) return [`terbaca "${nama}" - tidak cocok tepat, pilih yang benar`, "mendesak"];
      return [`terbaca "${nama}" - tidak ada yang mirip, pilih sendiri`, "mendesak"];
  }
}

/**
 * Satu select wilayah: "Paling mirip" di atas, seluruh daftar di bawah.
 * Yang dipilih: `keputusan.wilayah` bila diberikan (hasil menyimpulkan),
 * selain itu yang tepat/yakin menurut saksiscanCocokkan.
 */
function saksiscanIsiSelectWilayah(sel, daftar, namaBaca, keterangan, keputusan) {
  sel.textContent = "";
  sel._saksiDaftar = daftar;
  const kosong = saksiscanEl("option", "", "- pilih -");
  kosong.value = "";
  sel.appendChild(kosong);
  const cocok = saksiscanCocokkan(namaBaca, daftar);
  const putus =
    keputusan ||
    (cocok.tepat
      ? { wilayah: cocok.tepat, cara: "tepat" }
      : cocok.yakin
        ? { wilayah: cocok.yakin, cara: "mirip" }
        : { wilayah: null, cara: "" });
  if (putus.cara !== "tepat" && cocok.calon.length) {
    const grup = document.createElement("optgroup");
    grup.label = "Paling mirip dengan hasil baca";
    for (const c of cocok.calon) {
      const o = saksiscanEl("option", "", c.wilayah.nama);
      o.value = c.wilayah.kode;
      grup.appendChild(o);
    }
    sel.appendChild(grup);
  }
  const grupSemua = document.createElement("optgroup");
  grupSemua.label = "Semua";
  for (const w of daftar) {
    const o = saksiscanEl("option", "", w.nama);
    o.value = w.kode;
    grupSemua.appendChild(o);
  }
  sel.appendChild(grupSemua);
  sel.value = putus.wilayah ? putus.wilayah.kode : "";
  if (keterangan) {
    const [teks, nada] = saksiscanKetWilayah(namaBaca, putus, cocok.calon.length > 0);
    keterangan.textContent = teks;
    keterangan.setAttribute("data-nada", nada);
  }
  return Boolean(putus.wilayah);
}

/** Select tingkat yang induknya belum dipilih. */
function saksiscanKosongkanTingkat(kartu, i) {
  const x = SAKSISCAN_TINGKAT[i];
  const sel = kartu.querySelector(`select[data-saksi-wilayah="${x.kunci}"]`);
  const ket = kartu.querySelector(`[data-saksi-ket="${x.kunci}"]`);
  if (!sel) return;
  sel.textContent = "";
  sel._saksiDaftar = [];
  const o = saksiscanEl("option", "", `- pilih ${SAKSISCAN_TINGKAT[i - 1].label} dulu -`);
  o.value = "";
  sel.appendChild(o);
  sel.disabled = true;
  if (ket) ket.textContent = "";
}

/** Muat anak satu tingkat dan seluruh tingkat di bawahnya (mengikuti yang terpilih). */
async function saksiscanMuatTingkat(kartu, indeks, induk) {
  for (let i = indeks; i < SAKSISCAN_TINGKAT.length; i += 1) {
    const x = SAKSISCAN_TINGKAT[i];
    const sel = kartu.querySelector(`select[data-saksi-wilayah="${x.kunci}"]`);
    const ket = kartu.querySelector(`[data-saksi-ket="${x.kunci}"]`);
    if (!sel) return;
    if (i > 0 && !induk) {
      saksiscanKosongkanTingkat(kartu, i);
      continue;
    }
    sel.disabled = true;
    const jawab = await saksiscanWilayah({ induk: i === 0 ? "" : induk });
    sel.disabled = false;
    if (!jawab.ok) {
      if (ket) {
        ket.textContent = jawab.pesan;
        ket.setAttribute("data-nada", "lewat");
      }
      return;
    }
    if (jawab.sandi && jawab.sandi.ok === false) {
      saksiscanStatus(kartu, `${saksiscanTeksPesan(jawab.sandi.message) || "Penyandi SIPP belum siap."} Wilayah tetap dapat ditinjau, tetapi tidak akan diisikan.`, "mendesak");
    }
    const baca = (saksiscanKeadaan.tinjau && saksiscanKeadaan.tinjau.bacaWilayah) || {};
    saksiscanIsiSelectWilayah(sel, jawab.data, baca[x.kunci] || "", ket);
    induk = sel.value || "";
  }
  saksiscanSegarkanAlamat(kartu);
}

/**
 * Sesudah terbaca: wilayah disimpulkan (tepat / mirip / NIK / dari tingkat
 * bawah) lalu keempat select diisi sekaligus. Gagal membaca data wilayah =
 * jalan lama (muat dari provinsi, cocok tepat/yakin saja).
 */
async function saksiscanTerapkanSimpulan(kartu) {
  const t = saksiscanKeadaan.tinjau || {};
  const s = await saksiscanSimpulkanWilayah(t.bacaWilayah || {}, t.kodeNik || "", saksiscanWilayah);
  if (saksiscanKeadaan.tinjau !== t) return;
  if (!s.ok) {
    await saksiscanMuatTingkat(kartu, 0, "");
    return;
  }
  if (s.sandi && s.sandi.ok === false) {
    saksiscanStatus(kartu, `${saksiscanTeksPesan(s.sandi.message) || "Penyandi SIPP belum siap."} Wilayah tetap dapat ditinjau, tetapi tidak akan diisikan.`, "mendesak");
  }
  for (let i = 0; i < SAKSISCAN_TINGKAT.length; i += 1) {
    const x = SAKSISCAN_TINGKAT[i];
    const sel = kartu.querySelector(`select[data-saksi-wilayah="${x.kunci}"]`);
    if (!sel) continue;
    const daftar = s.daftar[x.kunci];
    if (!daftar) {
      if (i > 0) saksiscanKosongkanTingkat(kartu, i);
      continue;
    }
    sel.disabled = false;
    saksiscanIsiSelectWilayah(sel, daftar, (t.bacaWilayah || {})[x.kunci] || "", kartu.querySelector(`[data-saksi-ket="${x.kunci}"]`), s.pilih[x.kunci] || { wilayah: null, cara: "" });
  }
  saksiscanSegarkanAlamat(kartu);
}

/** Usulan "menurut NIK": provinsi > kabupaten > kecamatan penerbit KTP - dipakai hanya bila diklik. */
async function saksiscanTerapkanNik(kartu, kodeKecamatan) {
  const jalur = await saksiscanWilayah({ kode: kodeKecamatan });
  if (!jalur.ok || !jalur.data.length) {
    saksiscanStatus(kartu, "Kode wilayah dari NIK tidak ditemukan di data wilayah SIPP.", "mendesak");
    return;
  }
  let induk = "";
  for (let i = 0; i < SAKSISCAN_TINGKAT.length; i += 1) {
    const x = SAKSISCAN_TINGKAT[i];
    const sel = kartu.querySelector(`select[data-saksi-wilayah="${x.kunci}"]`);
    const titik = jalur.data[i];
    if (!titik) {
      await saksiscanMuatTingkat(kartu, i, induk);
      return;
    }
    const daftar = await saksiscanWilayah({ induk: i === 0 ? "" : induk });
    if (!daftar.ok) return;
    sel.disabled = false;
    saksiscanIsiSelectWilayah(sel, daftar.data, titik.nama, kartu.querySelector(`[data-saksi-ket="${x.kunci}"]`), {
      wilayah: daftar.data.find((w) => w.kode === titik.kode) || titik,
      cara: "nik",
    });
    sel.value = titik.kode;
    induk = titik.kode;
  }
  saksiscanSegarkanAlamat(kartu);
}

function saksiscanTampilkanTinjau(kartu, isi) {
  const medan = isi.medan || {};
  saksiscanKeadaan.tinjau = {
    ...medan,
    kodeNik: isi.nik && isi.nik.sah ? String(isi.nik.kodeKecamatan || "") : "",
    bacaWilayah: { provinsi: medan.provinsi, kabupaten: medan.kabupaten, kecamatan: medan.kecamatan, kelurahan: medan.kelurahan },
  };
  for (const [kunci] of SAKSISCAN_MEDAN_TINJAU) {
    const el = kartu.querySelector(`[data-saksi-medan="${kunci}"]`);
    if (el) el.value = medan[kunci] || "";
  }
  const alamat = kartu.querySelector("[data-saksi-medan='alamatLengkap']");
  if (alamat) {
    alamat.value = "";
    delete alamat.dataset.disunting;
  }
  const daftarCatatan = kartu.querySelector(".aleta-c2-saksi-catatan");
  daftarCatatan.textContent = "";
  for (const c of isi.catatan || []) daftarCatatan.appendChild(saksiscanEl("li", "", saksiscanTeksPesan(c)));
  daftarCatatan.hidden = !daftarCatatan.childElementCount;

  const tombolNik = kartu.querySelector(".aleta-c2-saksi-nik");
  const nik = isi.nik && isi.nik.sah ? isi.nik : null;
  tombolNik.hidden = !nik;
  tombolNik.onclick = nik ? () => void saksiscanTerapkanNik(kartu, nik.kodeKecamatan) : null;

  const centang = kartu.querySelector(".aleta-c2-saksi-sudah");
  centang.checked = false;
  kartu._saksiTetapTambah = false;
  kartu.querySelector(".aleta-c2-saksi-isi").disabled = true;
  kartu.querySelector(".aleta-c2-saksi-hasil").textContent = "";
  kartu.querySelector(".aleta-c2-saksi-tinjau").hidden = false;
  saksiscanSegarkanTombolIsi(kartu);
  kartu._saksiSimpulan = saksiscanTerapkanSimpulan(kartu);
}

/**
 * ============================================================================
 * ISI PIHAK DARI DATA YANG SUDAH TERURAI (perbaikan 5 Okt butir 28)
 * ============================================================================
 *
 * Dipanggil tombol "Isi pihak ke SIPP" di Data Umum dari berkas gugatan (tab
 * PTSP, konten.js) - sesudah petugas melihat pratinjau pihak itu (terbaca vs
 * kosong). Data dimuat ke kartu KTP yang sama (terlihat dan dapat dikoreksi),
 * wilayahnya disimpulkan seperti hasil foto KTP, lalu blangko "Tambah
 * Referensi Data Pihak" dibuka lewat alur SIPP dan diisi. Tekanan tombol itu
 * sesudah pratinjau = pemeriksaan petugas; Simpan SIPP TIDAK ditekan.
 *
 * isi = { medan, nik?, catatan? } - medan berbentuk MedanPihakGugatan
 * (pihak-gugatan.ts): medan KTP + umur, pendidikan, surel, alamatLengkap.
 */
async function saksiscanIsiLangsung(isi) {
  const data = isi || {};
  const medan = data.medan || {};
  const kartu = saksiscanBuka();
  saksiscanBersihkan();
  saksiscanTampilkanTinjau(kartu, { medan, nik: data.nik || null, catatan: data.catatan || [] });
  const alamat = kartu.querySelector("[data-saksi-medan='alamatLengkap']");
  if (alamat && medan.alamatLengkap) {
    alamat.value = String(medan.alamatLengkap);
    alamat.dataset.disunting = "ya";
  }
  saksiscanStatus(kartu, `Data ${saksiscanTeksPesan(data.sebutan) || "pihak"} dari berkas gugatan dimuat - membuka blangko SIPP…`);
  try {
    await kartu._saksiSimpulan;
  } catch {
    /* wilayah tetap dapat dipilih sendiri */
  }
  const centang = kartu.querySelector(".aleta-c2-saksi-sudah");
  centang.checked = true;
  kartu.querySelector(".aleta-c2-saksi-isi").disabled = false;
  await saksiscanIsi(kartu);
  return kartu;
}

function saksiscanAdalahPdf(berkas) {
  return Boolean(berkas) && (/pdf/i.test(String(berkas.type || "")) || /\.pdf$/i.test(String(berkas.name || "")));
}

async function saksiscanBaca(kartu) {
  const berkasEl = kartu.querySelector(".aleta-c2-saksi-berkas");
  const teksEl = kartu.querySelector(".aleta-c2-saksi-teks");
  const berkas = (berkasEl && berkasEl.files && berkasEl.files[0]) || kartu._saksiTempel || null;
  const teks = String((teksEl && teksEl.value) || "").trim();
  const tombol = kartu.querySelector(".aleta-c2-saksi-baca");
  if (tombol.disabled && kartu._saksiMembaca) return;
  kartu._saksiMembaca = true;
  tombol.disabled = true;
  saksiscanStatus(kartu, berkas && !teks ? "Membaca… (OCR di server bisa sampai satu menit)" : "Membaca…");
  let muatan = null;
  try {
    if (teks) {
      muatan = { teks };
    } else if (berkas) {
      const pdf = saksiscanAdalahPdf(berkas);
      if (berkas.size > (pdf ? SAKSISCAN_BATAS_GAMBAR : SAKSISCAN_BATAS_GAMBAR * 2)) {
        saksiscanStatus(kartu, pdf ? "PDF terlalu besar (paling besar 6 MB)." : "Berkas terlalu besar. Pilih foto yang lebih kecil.", "lewat");
        return;
      }
      if (pdf) {
        // PDF dikirim APA ADANYA: server memakai lapisan teksnya, atau
        // menggambar halamannya sendiri - kanvas peramban tidak dapat
        // membuka PDF.
        const mentah = await saksiscanBacaBerkas(berkas);
        if (!mentah) {
          saksiscanStatus(kartu, "PDF tidak dapat dibuka.", "lewat");
          return;
        }
        muatan = { gambar: mentah.replace(/^data:[^;,]*;base64,/, "data:application/pdf;base64,") };
      } else {
        const dariPeramban = await saksiscanBacaDiPeramban(berkas);
        if (dariPeramban.trim()) {
          muatan = { teks: dariPeramban };
        } else {
          const mentah = await saksiscanBacaBerkas(berkas);
          const kecil = mentah ? await saksiscanKecilkan(mentah) : "";
          if (!kecil) {
            saksiscanStatus(kartu, "Gambar tidak dapat dibuka.", "lewat");
            return;
          }
          muatan = { gambar: kecil };
        }
      }
    } else {
      saksiscanStatus(kartu, "Seret/pilih foto atau PDF KTP, tempel gambarnya (Ctrl+V), atau ketik teksnya dulu.", "mendesak");
      return;
    }
    const jawab = await saksiscanKirim(muatan);
    if (!jawab.ok) {
      saksiscanStatus(kartu, jawab.pesan, "lewat");
      if (jawab.teks && teksEl && !teksEl.value) teksEl.value = jawab.teks;
      return;
    }
    if (jawab.isi.teks && teksEl) teksEl.value = saksiscanTeksPesan(jawab.isi.teks);
    saksiscanStatus(kartu, "Terbaca. Periksa dan koreksi tiap medan di bawah sebelum diisikan.", "aman");
    saksiscanTampilkanTinjau(kartu, jawab.isi);
  } finally {
    // Foto KTP dilepas begitu selesai dibaca - tidak ditahan sampai kartu ditutup.
    muatan = null;
    if (berkasEl) berkasEl.value = "";
    kartu._saksiTempel = null;
    kartu._saksiMembaca = false;
    const pratinjau = kartu.querySelector(".aleta-c2-saksi-tempel");
    if (pratinjau) pratinjau.textContent = "";
    tombol.disabled = false;
  }
}

/* ─── 7. Membuka blangko yang tepat (butir 7 & 10) ───────────────────────── */

function saksiscanTampakSel(penunjuk) {
  let el = null;
  try {
    el = document.querySelector(penunjuk);
  } catch {
    el = null;
  }
  return el && saksiscanTampak(el) ? el : null;
}

/** Tombol "Cari" pada blangko saksi/pihak SIPP (#frm_user) - penunjuknya untuk jembatan. */
function saksiscanTombolCari() {
  const f = saksiscanTampakSel(SAKSISCAN_BORANG_SAKSI);
  if (!f) return null;
  const t = Array.from(f.querySelectorAll("input[type='button'], button")).find(
    (b) => /^cari$/i.test(String(b.value || b.textContent || "").trim()) && saksiscanTampak(b)
  );
  return t ? { el: t, penunjuk: `${SAKSISCAN_BORANG_SAKSI} input[type="button"][value="${String(t.value || "Cari")}"]` } : null;
}

function saksiscanTunggu(periksa, batasMs) {
  return new Promise((selesai) => {
    const mulai = Date.now();
    const coba = () => {
      let h = null;
      try {
        h = periksa();
      } catch {
        h = null;
      }
      if (h) return selesai(h);
      if (Date.now() - mulai > batasMs) return selesai(null);
      setTimeout(coba, 100);
    };
    coba();
  });
}

/** Keadaan halaman: blangko mana yang sedang terbuka. */
function saksiscanKeadaanBlangko() {
  if (saksiscanBorang()) return "pihak";
  if (saksiscanTampakSel("#addPihak")) return "daftar";
  if (saksiscanTombolCari()) return "saksi";
  return "";
}

const SAKSISCAN_TULISAN_ISI = {
  pihak: "Isi ke blangko SIPP",
  daftar: "Tambah & isi (Tambah Referensi Data Pihak)",
  saksi: "Isi data saksi (Cari → Tambah)",
  "": "Isi ke blangko SIPP",
};

function saksiscanSegarkanTombolIsi(kartu) {
  const k = kartu || saksiscanKeadaan.kartu;
  if (!k) return;
  const keadaan = saksiscanKeadaanBlangko();
  const tombol = k.querySelector(".aleta-c2-saksi-isi");
  if (tombol && tombol.textContent !== SAKSISCAN_TULISAN_ISI[keadaan]) tombol.textContent = SAKSISCAN_TULISAN_ISI[keadaan];
  const ket = k.querySelector(".aleta-c2-saksi-blangko");
  if (ket) {
    const teks = keadaan
      ? ""
      : "Blangko pihak/saksi SIPP belum terbuka - buka Tambah Saksi (atau Tambah Pihak) pada perkara ini; kartu dan hasil bacanya tetap di sini.";
    if (ket.textContent !== teks) ket.textContent = teks;
    ket.hidden = !teks;
  }
}

/**
 * Baris daftar referensi pihak SIPP (#tablePerkaraAll) yang namanya sama
 * dengan nama KTP -> [{ nomor baris, tanggal lahir terbaca, penunjuk [Pilih] }].
 * Hanya yang TAMPAK di halaman daftar - tidak ada pencarian yang mengubah
 * kata kunci sesi SIPP.
 */
function saksiscanCariDiDaftar(nama) {
  const sasaran = saksiscanNamaBaku(nama);
  if (!sasaran) return [];
  const tabel = document.querySelector("#tablePerkaraAll");
  if (!tabel) return [];
  const hasil = [];
  const baris = Array.from(tabel.querySelectorAll(":scope > tbody > tr, :scope > tr"));
  baris.forEach((tr, i) => {
    const sel = tr.children;
    if (!sel || sel.length < 6) return;
    if (saksiscanNamaBaku(sel[3].textContent) !== sasaran) return;
    const pilih = sel[0].querySelector("a");
    if (!pilih) return;
    hasil.push({
      baris: i + 1,
      tanggalLahir: saksiscanTanggalBaku(sel[5].textContent),
      penunjuk: `#tablePerkaraAll > tbody > tr:nth-child(${i + 1}) > td:nth-child(1) > a`,
    });
  });
  return hasil;
}

/**
 * Menyiapkan blangko "Tambah Referensi Data Pihak" (#frm_ref_pihak) dengan
 * JALAN SIPP SENDIRI - ALETA hanya menekan tombol yang juga ditekan petugas:
 *
 *   blangko pihak terbuka        -> langsung diisi;
 *   daftar referensi pihak       -> [Tambah];
 *   blangko saksi/pihak (Cari)   -> [Cari] -> daftar referensi -> [Tambah].
 *
 * Sebelum [Tambah], daftar yang tampak diperiksa: nama KTP sudah ada dengan
 * tanggal lahir SAMA -> [Pilih] baris itu (cara SIPP yang paling langsung -
 * tidak ada referensi ganda); nama sama tetapi tanggal lahir lain/tidak
 * terbaca -> berhenti dan bertanya (tekan sekali lagi = tetap tambah baru).
 * Simpan TIDAK PERNAH ditekan.
 */
async function saksiscanSiapkanBlangko(kartu, tinjau) {
  const f = saksiscanBorang();
  if (f) return { borang: f };
  let keadaan = saksiscanKeadaanBlangko();
  if (!keadaan) {
    return {
      pesan: "Blangko pihak/saksi SIPP belum terbuka. Buka Tambah Saksi (atau Tambah Pihak) pada perkara ini, lalu tekan tombol ini lagi.",
    };
  }
  if (keadaan === "saksi") {
    const cari = saksiscanTombolCari();
    saksiscanStatus(kartu, "Membuka Cari (daftar referensi pihak SIPP)…");
    const j = await saksiscanJembatan({ jenis: "tekan", penunjuk: cari.penunjuk });
    if (!j || j.ok !== true) return { pesan: `Tombol Cari tidak dapat ditekan (${saksiscanTeksPesan(j && j.alasan) || "tidak menjawab"}).` };
    const ada = await saksiscanTunggu(() => saksiscanTampakSel("#addPihak"), 12000);
    if (!ada) return { pesan: "Daftar referensi pihak SIPP tidak terbuka. Tekan Cari sendiri, lalu Tambah." };
    keadaan = "daftar";
  }
  if (!kartu._saksiTetapTambah) {
    const sama = saksiscanCariDiDaftar(tinjau.nama);
    const persis = sama.filter((x) => x.tanggalLahir && x.tanggalLahir === tinjau.tanggalLahir);
    if (persis.length === 1) {
      const j = await saksiscanJembatan({ jenis: "tekan", penunjuk: persis[0].penunjuk });
      if (j && j.ok === true) return { dipilih: persis[0] };
    }
    if (sama.length) {
      kartu._saksiTetapTambah = true;
      return {
        pesan: `Nama ini sudah ada di daftar referensi SIPP (${sama.length} baris). Bila orangnya sama, klik [Pilih] di baris itu; bila bukan, tekan tombol ini sekali lagi untuk menambah baru.`,
        nada: "mendesak",
      };
    }
  }
  const j = await saksiscanJembatan({ jenis: "tekan", penunjuk: "#addPihak" });
  if (!j || j.ok !== true) return { pesan: `Tombol Tambah tidak dapat ditekan (${saksiscanTeksPesan(j && j.alasan) || "tidak menjawab"}).` };
  const borang = await saksiscanTunggu(() => saksiscanBorang(), 8000);
  if (!borang) return { pesan: "Blangko \"Tambah Referensi Data Pihak\" tidak terbuka. Tekan Tambah sendiri, lalu tombol ini lagi." };
  // SIPP mengosongkan blangko (clearAll) di dalam klik Tambah - beri jeda
  // satu putaran supaya isian ALETA tidak tertimpa.
  await new Promise((r) => setTimeout(r, 150));
  return { borang, lewatDaftar: true };
}

async function saksiscanIsi(kartu) {
  if (!kartu.querySelector(".aleta-c2-saksi-sudah").checked) return;
  const tombol = kartu.querySelector(".aleta-c2-saksi-isi");
  const hasilEl = kartu.querySelector(".aleta-c2-saksi-hasil");
  tombol.disabled = true;
  try {
    const tinjau = saksiscanNilaiTinjau(kartu);
    const siap = await saksiscanSiapkanBlangko(kartu, tinjau);
    saksiscanSegarkanTombolIsi(kartu);
    if (siap.dipilih) {
      hasilEl.textContent = "";
      saksiscanStatus(
        kartu,
        `Pihak ini sudah ada di referensi SIPP (nama dan tanggal lahir sama) - baris ${siap.dipilih.baris} dipilih. BELUM TERSIMPAN: periksa blangko lalu tekan Simpan sendiri.`,
        "aman"
      );
      return;
    }
    if (!siap.borang) {
      saksiscanStatus(kartu, siap.pesan, siap.nada || "lewat");
      return;
    }
    const rencana = saksiscanRencana(tinjau, saksiscanBacaBorang(siap.borang));
    hasilEl.textContent = "";
    const hasil = await saksiscanJalankan(rencana);
    for (const h of hasil) {
      const li = saksiscanEl("li", "", `${h.ok ? "✓" : "✗"} ${h.label}${h.ok ? "" : ` - ${saksiscanTeksPesan(h.sebab)}`}`);
      li.setAttribute("data-nada", h.ok ? "aman" : "lewat");
      hasilEl.appendChild(li);
    }
    if (!rencana.wilayahDiisi) {
      let teks = "• Wilayah tidak dipilih - pilih sendiri di blangko SIPP.";
      if (rencana.wilayahTerisi > 0) {
        const sampai = SAKSISCAN_TINGKAT[rencana.wilayahTerisi - 1].label;
        const sisa = SAKSISCAN_TINGKAT.slice(rencana.wilayahTerisi).map((x) => x.label).join(", ");
        teks = `• Wilayah diisi sampai ${sampai} - pilih ${sisa} sendiri di blangko SIPP.`;
      } else if (rencana.wilayahDipilih) {
        teks = "✗ Wilayah tidak diisikan: rantai Provinsi belum terpilih (atau penyandi SIPP belum siap).";
      }
      const li = saksiscanEl("li", "", teks);
      li.setAttribute("data-nada", "mendesak");
      hasilEl.appendChild(li);
    }
    const gagal = hasil.filter((h) => !h.ok).length;
    const pilihNanti = siap.lewatDaftar ? " Sesudah tersimpan, klik [Pilih] pada nama ini di daftar referensi." : "";
    saksiscanStatus(
      kartu,
      `${hasil.length - gagal} medan terisi${gagal ? `, ${gagal} tidak` : ""}. BELUM TERSIMPAN: periksa blangko SIPP lalu tekan Simpan sendiri.${pilihNanti}`,
      gagal ? "mendesak" : "aman"
    );
  } finally {
    tombol.disabled = !kartu.querySelector(".aleta-c2-saksi-sudah").checked;
  }
}

/* ─── 8. Kartu ───────────────────────────────────────────────────────────── */

const SAKSISCAN_SVG = "http://www.w3.org/2000/svg";

/** Ikon unggah (awan + panah) - digambar sendiri, tanpa berkas/huruf dari luar. */
function saksiscanIkonUnggah() {
  const svg = document.createElementNS(SAKSISCAN_SVG, "svg");
  svg.setAttribute("viewBox", "0 0 48 48");
  svg.setAttribute("width", "44");
  svg.setAttribute("height", "44");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "aleta-c2-saksi-zona-ikon");
  const jalur = [
    "M14 34h-2a9 9 0 0 1-1-17.9A13 13 0 0 1 36 13a9 9 0 0 1 1 18h-3",
    "M24 40V22",
    "M17 28l7-7 7 7",
  ];
  for (const d of jalur) {
    const p = document.createElementNS(SAKSISCAN_SVG, "path");
    p.setAttribute("d", d);
    p.setAttribute("fill", "none");
    p.setAttribute("stroke", "currentColor");
    p.setAttribute("stroke-width", "2.6");
    p.setAttribute("stroke-linecap", "round");
    p.setAttribute("stroke-linejoin", "round");
    svg.appendChild(p);
  }
  return svg;
}

/** Berkas yang diseret/dipilih/ditempel -> dipegang di memori kartu lalu langsung dibaca. */
function saksiscanTerimaBerkas(kartu, berkas) {
  if (!berkas) return;
  const boleh = /^image\//i.test(String(berkas.type || "")) || saksiscanAdalahPdf(berkas);
  const tempat = kartu.querySelector(".aleta-c2-saksi-tempel");
  if (!boleh) {
    if (tempat) tempat.textContent = "";
    saksiscanStatus(kartu, "Berkas itu bukan gambar atau PDF.", "lewat");
    return;
  }
  kartu._saksiTempel = berkas;
  if (tempat) tempat.textContent = `${berkas.name || (saksiscanAdalahPdf(berkas) ? "PDF" : "Gambar")} - sedang dibaca…`;
  void saksiscanBaca(kartu);
}

function saksiscanBuatZona(kartu) {
  const zona = saksiscanEl("div", "aleta-c2-saksi-zona");
  zona.tabIndex = 0;
  zona.setAttribute("role", "button");
  zona.setAttribute("aria-label", "Seret foto atau PDF KTP ke sini, atau tekan untuk memilih berkas");
  zona.appendChild(saksiscanIkonUnggah());
  zona.appendChild(saksiscanEl("div", "aleta-c2-saksi-zona-judul", "Seret foto/PDF KTP ke sini atau klik untuk memilih"));
  zona.appendChild(saksiscanEl("div", "aleta-c2-saksi-zona-ket", "JPG, PNG, WEBP, atau PDF · paling besar 6 MB · Ctrl+V menempel gambar"));
  zona.appendChild(saksiscanEl("div", "aleta-c2-saksi-tempel"));
  const berkas = document.createElement("input");
  berkas.type = "file";
  berkas.accept = SAKSISCAN_TERIMA;
  berkas.className = "aleta-c2-saksi-berkas";
  berkas.tabIndex = -1;
  berkas.addEventListener("change", () => {
    const b = berkas.files && berkas.files[0];
    if (b) saksiscanTerimaBerkas(kartu, b);
  });
  berkas.addEventListener("click", (e) => e.stopPropagation());
  zona.appendChild(berkas);
  zona.addEventListener("click", () => berkas.click());
  zona.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      berkas.click();
    }
  });
  let lapis = 0;
  const sorot = (nyala) => {
    if (nyala) zona.setAttribute("data-sorot", "ya");
    else zona.removeAttribute("data-sorot");
  };
  zona.addEventListener("dragenter", (e) => {
    e.preventDefault();
    lapis += 1;
    sorot(true);
  });
  zona.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    sorot(true);
  });
  zona.addEventListener("dragleave", () => {
    lapis = Math.max(0, lapis - 1);
    if (!lapis) sorot(false);
  });
  zona.addEventListener("drop", (e) => {
    e.preventDefault();
    lapis = 0;
    sorot(false);
    const b = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    saksiscanTerimaBerkas(kartu, b || null);
  });
  return zona;
}

function saksiscanBuatKartu() {
  const kartu = saksiscanEl("div", "aleta-c2-saksi");
  kartu.setAttribute("role", "dialog");
  kartu.setAttribute("aria-label", "Isi data dari foto KTP");
  kartu.hidden = true;

  const kepala = saksiscanEl("div", "aleta-c2-saksi-kepala");
  kepala.appendChild(saksiscanEl("span", "aleta-c2-saksi-judul", "Isi dari foto KTP / blangko"));
  kepala.appendChild(saksiscanEl("span", "aleta-c2-saksi-peran", "PTSP/Operator"));
  const tutup = saksiscanEl("button", "aleta-c2-saksi-tutup", "×");
  tutup.type = "button";
  tutup.title = "Tutup (seluruh isian dihapus)";
  tutup.setAttribute("aria-label", "Tutup kartu (seluruh isian dihapus)");
  tutup.addEventListener("click", saksiscanTutup);
  kepala.appendChild(tutup);
  kartu.appendChild(kepala);

  const badan = saksiscanEl("div", "aleta-c2-saksi-badan");
  const ambil = saksiscanEl("div", "aleta-c2-saksi-ambil");
  ambil.appendChild(saksiscanBuatZona(kartu));
  const teks = document.createElement("textarea");
  teks.className = "aleta-c2-saksi-teks";
  teks.rows = 3;
  teks.placeholder = "…atau ketik/tempel teks KTP di sini (NIK : …, Nama : …, Alamat : …), lalu Baca.";
  ambil.appendChild(teks);
  const baca = saksiscanEl("button", "aleta-c2-saksi-baca aleta-tombol", "Baca");
  baca.type = "button";
  baca.addEventListener("click", () => void saksiscanBaca(kartu));
  ambil.appendChild(baca);
  ambil.appendChild(
    saksiscanEl("div", "aleta-c2-saksi-ket", "Foto/PDF hanya dibaca lalu dilepas - tidak disimpan di ALETA maupun di peramban.")
  );
  badan.appendChild(ambil);

  const status = saksiscanEl("div", "aleta-c2-saksi-status");
  status.hidden = true;
  status.setAttribute("role", "status");
  badan.appendChild(status);

  const tinjau = saksiscanEl("div", "aleta-c2-saksi-tinjau");
  tinjau.hidden = true;
  tinjau.appendChild(saksiscanEl("div", "aleta-c2-saksi-subjudul", "Tinjau & koreksi"));
  const catatan = saksiscanEl("ul", "aleta-c2-saksi-catatan");
  catatan.hidden = true;
  tinjau.appendChild(catatan);
  const kisi = saksiscanEl("div", "aleta-c2-saksi-kisi");
  for (const [kunci, judul] of SAKSISCAN_MEDAN_TINJAU) {
    const baris = saksiscanEl("label", "aleta-c2-saksi-baris");
    baris.appendChild(saksiscanEl("span", "", judul));
    let el;
    if (kunci === "jenisKelamin" || kunci === "statusKawin" || kunci === "golonganDarah" || kunci === "agama") {
      el = document.createElement("select");
      const pilihan = {
        jenisKelamin: [["", "-"], ["L", "Laki-laki"], ["P", "Perempuan"]],
        statusKawin: [["", "-"], ["Kawin", "Kawin"], ["Belum Kawin", "Belum Kawin"], ["Cerai Hidup", "Cerai Hidup"], ["Cerai Mati", "Cerai Mati"]],
        golonganDarah: [["", "-"], ["A", "A"], ["B", "B"], ["AB", "AB"], ["O", "O"]],
        agama: [["", "-"], ["Islam", "Islam"], ["Kristen", "Kristen (Protestan)"], ["Katolik", "Katolik"], ["Hindu", "Hindu"], ["Budha", "Budha"], ["Konghucu", "Konghucu"], ["Lainnya", "Lainnya"]],
      }[kunci];
      for (const [nilai, tulisan] of pilihan) {
        const o = saksiscanEl("option", "", tulisan);
        o.value = nilai;
        el.appendChild(o);
      }
    } else {
      el = document.createElement("input");
      el.type = "text";
    }
    el.setAttribute("data-saksi-medan", kunci);
    if (kunci === "alamat" || kunci === "rt" || kunci === "rw") el.addEventListener("input", () => saksiscanSegarkanAlamat(kartu));
    baris.appendChild(el);
    kisi.appendChild(baris);
  }
  tinjau.appendChild(kisi);

  const wilayah = saksiscanEl("div", "aleta-c2-saksi-wilayah");
  wilayah.appendChild(saksiscanEl("div", "aleta-c2-saksi-subjudul", "Wilayah (data SIPP, bertingkat)"));
  const nik = saksiscanEl("button", "aleta-c2-saksi-nik aleta-tombol", "Pakai wilayah menurut NIK");
  nik.type = "button";
  nik.hidden = true;
  nik.title = "Enam angka pertama NIK = kecamatan tempat KTP diterbitkan - alamat sekarang bisa berbeda.";
  wilayah.appendChild(nik);
  SAKSISCAN_TINGKAT.forEach((x, i) => {
    const baris = saksiscanEl("label", "aleta-c2-saksi-baris");
    baris.appendChild(saksiscanEl("span", "", x.label));
    const sel = document.createElement("select");
    sel.setAttribute("data-saksi-wilayah", x.kunci);
    sel.addEventListener("change", () => {
      const ket = kartu.querySelector(`[data-saksi-ket="${x.kunci}"]`);
      if (ket && sel.value) {
        ket.textContent = "dipilih petugas";
        ket.setAttribute("data-nada", "aman");
      }
      void saksiscanMuatTingkat(kartu, i + 1, sel.value || "");
    });
    baris.appendChild(sel);
    baris.appendChild(saksiscanEl("span", "aleta-c2-saksi-wket")).setAttribute("data-saksi-ket", x.kunci);
    wilayah.appendChild(baris);
  });
  tinjau.appendChild(wilayah);

  const barisAlamat = saksiscanEl("label", "aleta-c2-saksi-baris aleta-c2-saksi-penuh");
  barisAlamat.appendChild(saksiscanEl("span", "", "Alamat yang diisikan ke blangko"));
  const alamat = document.createElement("textarea");
  alamat.rows = 3;
  alamat.setAttribute("data-saksi-medan", "alamatLengkap");
  alamat.addEventListener("input", () => {
    alamat.dataset.disunting = "ya";
  });
  barisAlamat.appendChild(alamat);
  tinjau.appendChild(barisAlamat);

  const setuju = saksiscanEl("label", "aleta-c2-saksi-setuju");
  const centang = document.createElement("input");
  centang.type = "checkbox";
  centang.className = "aleta-c2-saksi-sudah";
  setuju.appendChild(centang);
  setuju.appendChild(document.createTextNode(" Sudah saya periksa dengan KTP/blangko aslinya"));
  tinjau.appendChild(setuju);
  const isi = saksiscanEl("button", "aleta-c2-saksi-isi aleta-tombol", SAKSISCAN_TULISAN_ISI[""]);
  isi.type = "button";
  isi.disabled = true;
  centang.addEventListener("change", () => {
    isi.disabled = !centang.checked;
  });
  isi.addEventListener("click", () => void saksiscanIsi(kartu));
  tinjau.appendChild(isi);
  const blangko = saksiscanEl("div", "aleta-c2-saksi-ket aleta-c2-saksi-blangko");
  blangko.hidden = true;
  tinjau.appendChild(blangko);
  tinjau.appendChild(
    saksiscanEl(
      "div",
      "aleta-c2-saksi-ket aleta-c2-saksi-alur",
      "Saksi: ALETA menekan Cari lalu Tambah (Tambah Referensi Data Pihak) dan mengisinya - Anda yang menekan Simpan, lalu [Pilih] nama itu di daftar."
    )
  );
  tinjau.appendChild(saksiscanEl("ul", "aleta-c2-saksi-hasil"));
  badan.appendChild(tinjau);
  kartu.appendChild(badan);

  // Gambar/PDF yang DITEMPEL (Ctrl+V) - dipegang di memori kartu lalu dibaca.
  kartu.addEventListener("paste", (e) => {
    const item =
      e.clipboardData && Array.from(e.clipboardData.items || []).find((x) => /^image\//.test(x.type) || /pdf/i.test(x.type));
    if (!item) return;
    const b = item.getAsFile();
    if (!b) return;
    e.preventDefault();
    kartu._saksiTempel = b;
    const tempat = kartu.querySelector(".aleta-c2-saksi-tempel");
    if (tempat) tempat.textContent = "Gambar tempelan siap dibaca - tekan Baca.";
  });
  return kartu;
}

/**
 * Tema kartu = tema panel ALETA (UI Baru: token --aleta-* kulit modern,
 * terang/gelap). Tanpa panel: mengikuti tema SIPP.
 */
function saksiscanSinkronTema(kartu) {
  const k = kartu || saksiscanKeadaan.kartu;
  if (!k) return;
  let tema = "terang";
  try {
    const panel = document.getElementById("aleta-panel-sipp");
    if (panel) tema = panel.getAttribute("data-tema") === "terang" ? "terang" : "gelap";
    else tema = document.documentElement.getAttribute("data-aleta-tema-sipp") === "gelap" ? "gelap" : "terang";
  } catch {
    tema = "terang";
  }
  if (k.getAttribute("data-tema") !== tema) k.setAttribute("data-tema", tema);
}

function saksiscanBuka() {
  if (!saksiscanKeadaan.kartu) {
    saksiscanKeadaan.kartu = saksiscanBuatKartu();
    document.body.appendChild(saksiscanKeadaan.kartu);
  }
  saksiscanKeadaan.kartu.hidden = false;
  saksiscanSinkronTema(saksiscanKeadaan.kartu);
  saksiscanSegarkanTombolIsi(saksiscanKeadaan.kartu);
  saksiscanKabarSembul();
  const zona = saksiscanKeadaan.kartu.querySelector(".aleta-c2-saksi-zona");
  if (zona && typeof zona.focus === "function") {
    try {
      zona.focus({ preventScroll: true });
    } catch {
      /* fokus bukan syarat */
    }
  }
  return saksiscanKeadaan.kartu;
}

function saksiscanPemicu() {
  if (saksiscanKeadaan.pemicu) return saksiscanKeadaan.pemicu;
  const b = saksiscanEl("button", "aleta-c2-saksi-pemicu", "📷 Isi dari foto KTP");
  b.type = "button";
  b.title = "Isi data saksi/pihak dari foto atau PDF KTP - ditinjau dulu, Simpan tetap ditekan sendiri";
  b.hidden = true;
  b.addEventListener("click", saksiscanBuka);
  document.body.appendChild(b);
  saksiscanKeadaan.pemicu = b;
  return b;
}

/* ─── 9. Pemasangan sendiri ──────────────────────────────────────────────── */

async function saksiscanPeriksa() {
  const ui = saksiscanModeUi();
  const kartu = saksiscanKeadaan.kartu;
  if (!ui) {
    if (saksiscanKeadaan.pemicu) saksiscanKeadaan.pemicu.hidden = true;
    // Keluar dari UI Baru = kartu ditutup dan dikosongkan.
    if (kartu && !kartu.hidden) saksiscanTutup();
    return false;
  }
  // Butir 10: kartu TIDAK lagi ikut tertutup bersama blangko - hasil baca
  // tetap di kartu sampai petugas menutupnya, dan tombol isinya membuka
  // blangko yang tepat sendiri.
  if (kartu && !kartu.hidden) {
    saksiscanSinkronTema(kartu);
    saksiscanSegarkanTombolIsi(kartu);
  }
  if (!saksiscanKeadaanBlangko()) {
    if (saksiscanKeadaan.pemicu) saksiscanKeadaan.pemicu.hidden = true;
    return false;
  }
  const siapa = await saksiscanMuatSiapa();
  const tampil = Boolean(siapa) && saksiscanPeranBoleh(siapa.peran) && Boolean(saksiscanKeadaanBlangko());
  if (tampil) saksiscanPemicu().hidden = false;
  else if (saksiscanKeadaan.pemicu) saksiscanKeadaan.pemicu.hidden = true;
  return tampil;
}

function saksiscanJadwalkan() {
  if (saksiscanKeadaan.jamPeriksa) return;
  saksiscanKeadaan.jamPeriksa = setTimeout(() => {
    saksiscanKeadaan.jamPeriksa = null;
    void saksiscanPeriksa();
  }, 400);
}

function saksiscanPasang() {
  if (globalThis.__aletaSaksiscanTerpasang) return false;
  globalThis.__aletaSaksiscanTerpasang = true;
  if (!document.body) return false;
  try {
    saksiscanKeadaan.pengamat = new MutationObserver((daftar) => {
      // Perubahan di dalam kartu/pemicu sendiri tidak perlu memeriksa ulang.
      const luar = daftar.some((m) => {
        const t = m.target;
        return !(t && t.closest && t.closest(".aleta-c2-saksi, .aleta-c2-saksi-pemicu"));
      });
      if (luar) saksiscanJadwalkan();
    });
    saksiscanKeadaan.pengamat.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });
  } catch {
    /* tanpa pengamat: tidak ada pemicu - SIPP tetap seperti biasa */
  }
  saksiscanJadwalkan();
  return true;
}

saksiscanPasang();
