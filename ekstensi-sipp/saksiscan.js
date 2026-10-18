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
  // Penjaga batas (audit jejak 18 Okt 2026): isian KTP/saksi/keterangan hubungan yang
  // memuat kata ALETA (selain data SIPP yang tampil di halaman) tidak diisikan.
  if (pesan && pesan.jenis === "isi" && typeof pesan.nilai === "string" && typeof AletaPenjagaTanda !== "undefined") {
    const tahan = AletaPenjagaTanda.periksaTeks(pesan.nilai, String(pesan.penunjuk || "isian"));
    if (!tahan.ok) return Promise.resolve({ ok: false, alasan: tahan.pesan });
  }
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
  // Bantu data saksi (bagian 10) berjalan sendiri - tanpa gerbang peran KTP.
  if (typeof saksibantuJadwalkanBantu === "function") saksibantuJadwalkanBantu();
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
        return !(t && t.closest && t.closest(".aleta-c2-saksi, .aleta-c2-saksi-pemicu, .aleta-c2-sbantu"));
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

/* ─── 10. Bantu data saksi: hubungan, usulan, saksi ganda (1.189.x butir 10-12) ── */

/**
 * ============================================================================
 * BANTU DATA SAKSI - KETERANGAN HUBUNGAN, USULAN TERUKUR, SAKSI GANDA
 * ============================================================================
 *
 * Dua blangko SIPP, keduanya hanya DIISI - Simpan tetap ditekan petugas:
 *
 *   form#frm_user (pihak_ke 13, "Tambah Saksi")   kotak HUBUNGAN di bawah
 *       Keterangan: daftar dari DATABASE ALETA (bisa ditambah) + ketik
 *       sendiri, digabung dengan sebutan pihak MENURUT JENIS PERKARA dari
 *       server (sebutanPihakService - nomor alur/jenis, bukan kata):
 *       "Ibu Kandung" + Pemohon -> "Ibu Kandung Pemohon". Keterangan lama
 *       yang belum rapi ("ibu kandung penggugat" di Cerai Talak) ditawarkan
 *       rapinya. Isian petugas TIDAK PERNAH ditimpa tanpa klik.
 *
 *   form#frm_ref_pihak ("Tambah Referensi Data Pihak" dari Cari pada blangko
 *       saksi)   lajur USULAN di atas blangko + peringatan SAKSI GANDA.
 *
 * UKURAN (16.643 saksi sipp_donggala, dump 9 Okt 2026) - dasar tiap usulan:
 *
 *   agama Islam              98,9%  -> diisi otomatis bila kosong (kuat)
 *   jenis kelamin dari kata  98,7%  -> diisi otomatis bila kosong (kuat)
 *     hubungan (ibu/tante/... = P, ayah/paman/... = L)
 *   warga negara Indonesia   99,9%  -> SIPP sudah memilihnya sendiri
 *   umur dari tanggal lahir         -> SIPP sudah menghitungnya sendiri
 *   pekerjaan menurut jenis  61%/69% -> usulan klik saja (Petani untuk L,
 *     kelamin                          Mengurus Rumah Tangga untuk P)
 *   status kawin "Kawin"     89%    -> usulan klik saja (umur >= 25)
 *   alamat sama dengan pihak  1,9%  -> usulan klik saja, hanya bila keluarga
 *   pendidikan               38%    -> TIDAK ditebak (SLTA 38, SD 30, SLTP 18)
 *   yang menghadirkan        98,5%  pihak pertama - SIPP sudah memilihnya
 *
 * "Kuat" hanya diisi bila medannya KOSONG, pada blangko TAMBAH (bukan Edit),
 * dan tiap medan paling banyak sekali: medan yang diubah petugas sesudahnya
 * tidak pernah disentuh lagi. Semua yang diisi tercantum di lajur usulan
 * dengan tombol Batalkan. Tidak ada atribut, kelas, atau tanda yang
 * ditempelkan ke medan SIPP.
 */

const SAKSIBANTU_API = "/aleta/api/aleta-ecourt/saksi-bantu";
const SAKSIBANTU_BORANG_REF = "form#frm_ref_pihak";
const SAKSIBANTU_JEDA_PANTAU_MS = 700;
const SAKSIBANTU_JEDA_GANDA_MS = 700;

const SAKSIBANTU_UKURAN = {
  agamaIslam: "98,9%",
  jkDariHubungan: "98,7%",
  petaniLaki: "61%",
  rumahTanggaPerempuan: "69%",
  kawin: "89%",
  alamatSama: "1,9%",
};

/* 10a. Fungsi murni - diuji tanpa DOM ───────────────────────────────────── */

/** Salah ketik dan ragam tulis yang TERUKUR di keterangan saksi satker. */
const SAKSIBANTU_GANTI = [
  [/\b(?:tewtangga|tetanggat|tetangg)\b/g, "tetangga"],
  [/\b(?:supupu|sepupun|sepupi)\b/g, "sepupu"],
  [/\b(?:saudra|sodara|saudarav|suadara)\b/g, "saudara"],
  [/\bkaka\b/g, "kakak"],
  [/\bade\b/g, "adik"],
  [/\b(?:ponakan|kemenakan|kemanakan)\b/g, "keponakan"],
  [/\b(?:pennggugat|pemggugat|penggugt|pengugat)\b/g, "penggugat"],
  [/^bu\s+kandung\b/, "ibu kandung"],
  [/^par\b/, "ipar"],
  [/\btbibi\b/g, "bibi"],
  [/\bom\b/g, "paman"],
  [/\bbapak\b/g, "ayah"],
  [/\banak\s+mantu\b/g, "menantu"],
  [/\borangtua\b/g, "orang tua"],
  [/\bkalli\b/g, "kali"],
  [/\bsatukali\b/g, "satu kali"],
  [/\bsau\s+kali\b/g, "satu kali"],
  [/\b(?:1|i|ix)\s*(?:x|kali)\b/g, "satu kali"],
  [/\b(?:2|ii)\s*(?:x|kali)\b/g, "dua kali"],
  [/\b(?:3|iii)\s*(?:x|kali)\b/g, "tiga kali"],
];

/** Kata sebutan pihak di keterangan - awal bagian "pihak" dari kalimatnya. */
const SAKSIBANTU_KATA_PIHAK = /^(?:penggugat|tergugat|pemohon|termohon|para|pihak|p|p[1-4]|pi{1,3}|piv)$/;
const SAKSIBANTU_KATA_SAMBUNG = new Set(["dari", "dengan", "dan", "sebagai", "untuk", "kepada", "/", "&", "atau"]);
const SAKSIBANTU_BUKAN_HUBUNGAN = /^(?:itsbat|isbat|istbat|cerai|dispensasi|verstek|tidak ada|saksi|asal usul|wali|poligami|pengesahan|harta|nafkah)\b/;
const SAKSIBANTU_ROMAWI = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

function saksibantuKe(token) {
  const t = String(token || "").toLowerCase();
  const peta = { i: 1, ii: 2, iii: 3, iv: 4, 1: 1, 2: 2, 3: 3, 4: 4, satu: 1, dua: 2, tiga: 3, empat: 4 };
  return peta[t] || null;
}

/** Bagian "pihak" dari keterangan -> { jenis: satu|dua|para|keduanya, ke }. */
function saksibantuUraiPihak(kata) {
  if (!kata.length) return null;
  const t = ` ${kata.join(" ")} `;
  if (/\spara\s/.test(t)) return { jenis: "para", ke: null };
  const satu = /\s(?:penggugat|pemohon|p|p[1-4]|pi{1,3}|piv)\s/.test(t);
  const dua = /\s(?:tergugat|termohon)\s/.test(t);
  if (satu && dua) return { jenis: "keduanya", ke: null };
  if (!satu && !dua) return /\spihak\s/.test(t) ? { jenis: "keduanya", ke: null } : null;
  const ke = new Set();
  for (let i = 0; i < kata.length; i += 1) {
    const k = kata[i];
    const m = /^p(\d|i{1,3}|iv)$/.exec(k);
    if (m) ke.add(saksibantuKe(m[1]));
    else if (/^(?:penggugat|pemohon|tergugat|termohon)$/.test(k) && saksibantuKe(kata[i + 1])) ke.add(saksibantuKe(kata[i + 1]));
  }
  if (ke.size > 1) return { jenis: "para", ke: null };
  return { jenis: dua ? "dua" : "satu", ke: ke.size === 1 ? [...ke][0] : null };
}

function saksibantuHurufBesar(kata) {
  return kata
    .map((k, i) => {
      if (/^(?:i{1,3}|iv|vi{0,3})$/.test(k)) return k.toUpperCase();
      if (i > 0 && (k === "dan" || k === "dari")) return k;
      return k.charAt(0).toUpperCase() + k.slice(1);
    })
    .join(" ");
}

/**
 * Keterangan saksi apa adanya -> { dasar, pihak, bukanHubungan }.
 *   "sepupu 1x penggugat."  -> dasar "Sepupu Satu Kali", pihak satu
 *   "paman pemohon ii"      -> dasar "Paman", pihak satu ke 2
 *   "tetangga para pemohon" -> dasar "Tetangga", pihak para
 *   "itsbat nikah"          -> bukanHubungan (jenis perkara salah tempat)
 */
function saksibantuUrai(teks) {
  let t = String(teks === null || teks === undefined ? "" : teks)
    .replace(/﻿/g, "")
    .toLowerCase()
    .replace(/[;.,()"'`:]+/g, " ")
    .replace(/\//g, " / ")
    .replace(/\s+/g, " ")
    .trim();
  for (const [pola, ganti] of SAKSIBANTU_GANTI) t = t.replace(pola, ganti);
  t = t.replace(/^(?:saksi\s+(?:ke\s*)?(?:\d+|i{1,3})?\s*|sebagai\s+)+(?=\S)/, (awal, i, utuh) => (utuh.length > awal.length ? "" : awal));
  let kata = t.split(" ").filter(Boolean);
  // Sebutan di DEPAN ("penggugat anak kandung", "pemohon ii ponakan",
  // "pemohon sebagai ipar"): dipindah ke belakang lebih dulu.
  if (kata.length > 1 && /^(?:penggugat|tergugat|pemohon|termohon)$/.test(kata[0])) {
    let j = 1;
    if (saksibantuKe(kata[j])) j += 1;
    if (j < kata.length) kata = [...kata.slice(j), ...kata.slice(0, j)];
  }
  let i = kata.findIndex((k) => SAKSIBANTU_KATA_PIHAK.test(k));
  if (i < 0) i = kata.length;
  const depan = kata.slice(0, i);
  while (depan.length && SAKSIBANTU_KATA_SAMBUNG.has(depan[depan.length - 1])) depan.pop();
  while (depan.length && SAKSIBANTU_KATA_SAMBUNG.has(depan[0])) depan.shift();
  const dasarKecil = depan.join(" ");
  const bukanHubungan = !dasarKecil || /^(?:\d+|i{1,3}|iv)$/.test(dasarKecil) || SAKSIBANTU_BUKAN_HUBUNGAN.test(dasarKecil);
  return {
    dasar: bukanHubungan ? "" : saksibantuHurufBesar(depan),
    pihak: saksibantuUraiPihak(kata.slice(i)),
    bukanHubungan,
  };
}

/** Pilihan sebutan sasaran menurut konteks perkara (sebutan dari server). */
function saksibantuDaftarSasaran(konteks) {
  const k = konteks || {};
  const s = k.sebutan || { satu: "Penggugat", dua: "Tergugat" };
  const n1 = Math.max(1, Array.isArray(k.pihakPertama) ? k.pihakPertama.length : 1);
  const n2 = Array.isArray(k.pihakKedua) ? k.pihakKedua.length : 0;
  const daftar = [];
  if (n1 > 1) {
    daftar.push({ kunci: "para", tulisan: `Para ${s.satu}` });
    for (let i = 1; i <= n1 && i < SAKSIBANTU_ROMAWI.length; i += 1) daftar.push({ kunci: `satu:${i}`, tulisan: `${s.satu} ${SAKSIBANTU_ROMAWI[i]}` });
  } else {
    daftar.push({ kunci: "satu", tulisan: s.satu });
  }
  if (n2 > 1) {
    daftar.push({ kunci: "para-dua", tulisan: `Para ${s.dua}` });
    for (let i = 1; i <= n2 && i < SAKSIBANTU_ROMAWI.length; i += 1) daftar.push({ kunci: `dua:${i}`, tulisan: `${s.dua} ${SAKSIBANTU_ROMAWI[i]}` });
  } else if (n2 === 1) {
    daftar.push({ kunci: "dua", tulisan: s.dua });
  }
  if (n2 >= 1) daftar.push({ kunci: "keduanya", tulisan: `${s.satu} dan ${s.dua}` });
  return daftar;
}

/**
 * Kunci sasaran untuk satu keterangan: dari sebutan yang tertulis di
 * keterangan bila ada, selain itu dari "Yang Menghadirkan" (sebutan di
 * keterangan sejalan dengan yang menghadirkan pada 99,0% saksi satker).
 */
function saksibantuKunciSasaran(pihak, konteks, yangMenghadirkan) {
  const k = konteks || {};
  const n1 = Math.max(1, Array.isArray(k.pihakPertama) ? k.pihakPertama.length : 1);
  const n2 = Array.isArray(k.pihakKedua) ? k.pihakKedua.length : 0;
  const p = pihak || { jenis: String(yangMenghadirkan) === "2" && n2 > 0 ? "dua" : "satu", ke: null };
  if (p.jenis === "keduanya") return n2 > 0 ? "keduanya" : "satu";
  if (p.jenis === "dua" && n2 > 0) {
    if (n2 > 1) return p.ke && p.ke <= n2 ? `dua:${p.ke}` : "para-dua";
    return "dua";
  }
  if (n1 > 1) return p.jenis !== "para" && p.ke && p.ke <= n1 ? `satu:${p.ke}` : "para";
  return "satu";
}

function saksibantuTulisanSasaran(kunci, konteks) {
  const ada = saksibantuDaftarSasaran(konteks).find((x) => x.kunci === kunci);
  return ada ? ada.tulisan : saksibantuDaftarSasaran(konteks)[0].tulisan;
}

/** "Ibu Kandung" + "Penggugat" -> "Ibu Kandung Penggugat". */
function saksibantuSusun(dasar, tulisanSasaran) {
  const d = String(dasar || "").replace(/\s+/g, " ").trim();
  if (!d) return "";
  const s = String(tulisanSasaran || "").trim();
  return s ? `${d} ${s}` : d;
}

/** Bentuk rapi keterangan yang sudah ada, menurut jenis perkara - "" bila tak dikenali. */
function saksibantuRapikan(teks, konteks, yangMenghadirkan) {
  const u = saksibantuUrai(teks);
  if (!u.dasar) return "";
  return saksibantuSusun(u.dasar, saksibantuTulisanSasaran(saksibantuKunciSasaran(u.pihak, konteks, yangMenghadirkan), konteks));
}

/** Jenis kelamin yang tersirat dari kata hubungan - 98,7% tepat atas data satker. */
function saksibantuJkHubungan(dasar, kamus) {
  const d = String(dasar || "").toLowerCase().trim();
  if (/^(?:ibu|tante|bibi|nenek|istri|bude|kakak perempuan|adik perempuan|anak perempuan)\b/.test(d)) return "P";
  if (/^(?:ayah|bapak|paman|om|kakek|suami|pakde|kakak laki|adik laki|anak laki)\b/.test(d)) return "L";
  // P5P6 10 Okt: dasar yang tidak dikenal aturan di atas dicari di kamus hubungan bot.
  const k = saksibantuDariKamus(d, kamus);
  return k && (k.jk === "L" || k.jk === "P") ? k.jk : "";
}

/** Hubungan keluarga (yang mungkin serumah) - syarat usulan alamat. */
function saksibantuKeluarga(dasar, kamus) {
  if (
    /^(?:ibu|ayah|bapak|orang tua|kakak|adik|saudara|anak|nenek|kakek|paman|tante|bibi|sepupu|keponakan|ipar|menantu|mertua|cucu|keluarga|kerabat|suami|istri)\b/i.test(
      String(dasar || "").trim()
    )
  ) {
    return true;
  }
  // P5P6 10 Okt: kamus hubungan bot (golongan keluarga) memperkaya - tidak pernah mengurangi.
  const k = saksibantuDariKamus(String(dasar || "").toLowerCase().trim(), kamus);
  return Boolean(k && k.golongan === "keluarga");
}

/* === P5P6 10 Okt === */
/**
 * Kamus hubungan dari bot (konteks.kamusHubungan: [{dasar, golongan, jk}]) -
 * pola deteksi P5 yang bisa ditambah lewat database tanpa rilis ekstensi.
 * Dicocokkan pada DASAR yang sudah dirapikan saksibantuUrai, tanpa beda besar-kecil.
 */
function saksibantuDariKamus(dasarKecil, kamus) {
  if (!dasarKecil || !Array.isArray(kamus)) return null;
  const sama = kamus.find((x) => x && String(x.dasar || "").toLowerCase() === dasarKecil);
  if (sama) return sama;
  // Pola istilahnya (dicocokkan UTUH, ^...$) - "mama kandung" dikenal sebagai Ibu Kandung.
  for (const x of kamus) {
    if (!x || !x.regex) continue;
    try {
      if (new RegExp(String(x.regex), String(x.flags || "i")).test(dasarKecil)) return x;
    } catch {
      // pola rusak dari database diabaikan
    }
  }
  return null;
}

/** { kodePola } bila dasar hubungan dikenali kamus - untuk jejak koreksi (agen 4). */
function saksibantuKodeKamus(dasar, kamus) {
  const k = saksibantuDariKamus(String(dasar || "").toLowerCase().trim(), kamus);
  return k && k.kode ? { kodePola: String(k.kode) } : {};
}

function saksibantuKamusHubungan() {
  try {
    const k = typeof saksibantuKeadaan !== "undefined" && saksibantuKeadaan.data && saksibantuKeadaan.data.konteks;
    return k && Array.isArray(k.kamusHubungan) ? k.kamusHubungan : [];
  } catch {
    return [];
  }
}
/* === AKHIR P5P6 === */

/** Pekerjaan blangko SIPP terisi? Pengadilan agama memakai #apakahtni + uraian. */
function saksibantuPekerjaanTerisi(k) {
  if (k.apakahTni !== null && k.apakahTni !== undefined && k.apakahTni !== "") {
    if (String(k.apakahTni) !== "2") return true;
  }
  return Boolean(String(k.pekerjaan || "").trim());
}

/**
 * Usulan untuk blangko referensi pihak (saksi) - MURNI. Hanya medan yang
 * KOSONG yang mendapat usulan; `kuat` = boleh diisi otomatis.
 *   k: { agama, pilihanAgama, jenisKelamin ("1"/"2"), pekerjaan, apakahTni
 *        (null bila tidak ada), statusKawin, umur, alamat, hubungan,
 *        alamatPihak, sebutanPihak }
 */
function saksibantuUsulan(k) {
  const x = k || {};
  const u = [];
  if (!String(x.agama || "").trim()) {
    const nilai = saksiscanNilaiAgama("islam", x.pilihanAgama);
    if (nilai) {
      u.push({
        medan: "agama", label: "Agama", tulisan: "Islam", kuat: true,
        alasan: `${SAKSIBANTU_UKURAN.agamaIslam} saksi di sini beragama Islam`,
        langkah: [{ penunjuk: "#pihak_agama", jenis: "pilih", nilai }],
      });
    }
  }
  const jkHub = saksibantuJkHubungan(x.hubungan, x.kamusHubungan);
  // P5P6 10 Okt: tebakan yang HANYA dikenal kamus belum terukur - usulan klik (tidak kuat) + kodePola.
  const kamusJk = !saksibantuJkHubungan(x.hubungan) && jkHub ? saksibantuDariKamus(String(x.hubungan || "").toLowerCase().trim(), x.kamusHubungan) : null;
  if (!String(x.jenisKelamin || "").trim() && jkHub) {
    u.push({
      medan: "jenisKelamin", label: "Jenis kelamin", tulisan: jkHub === "L" ? "Laki Laki" : "Perempuan", kuat: !kamusJk,
      alasan: kamusJk
        ? `dari hubungan "${x.hubungan}" menurut kamus hubungan ALETA - periksa dulu`
        : `dari hubungan "${x.hubungan}" (${SAKSIBANTU_UKURAN.jkDariHubungan} tepat)`,
      langkah: [{ penunjuk: "#pihak_jenis_kelamin", jenis: "pilih", nilai: jkHub === "L" ? "1" : "2" }],
      ...(kamusJk && kamusJk.kode ? { kodePola: String(kamusJk.kode) } : {}),
    });
  }
  const jk = String(x.jenisKelamin) === "1" ? "L" : String(x.jenisKelamin) === "2" ? "P" : jkHub;
  if (jk && !saksibantuPekerjaanTerisi(x)) {
    const teks = jk === "L" ? "Petani" : "Mengurus Rumah Tangga";
    const langkah = [];
    if (x.apakahTni !== null && x.apakahTni !== undefined) langkah.push({ penunjuk: "#apakahtni", jenis: "pilih", nilai: "2" });
    langkah.push({ penunjuk: "#pihak_pekerjaan", jenis: "teks", nilai: teks });
    u.push({
      medan: "pekerjaan", label: "Pekerjaan", tulisan: teks, kuat: false,
      alasan: `${jk === "L" ? SAKSIBANTU_UKURAN.petaniLaki : SAKSIBANTU_UKURAN.rumahTanggaPerempuan} saksi ${jk === "L" ? "laki-laki" : "perempuan"} - periksa dulu`,
      langkah,
    });
  }
  if (!String(x.statusKawin || "").trim() && Number(x.umur) >= 25) {
    u.push({
      medan: "statusKawin", label: "Status kawin", tulisan: "Kawin", kuat: false,
      alasan: `${SAKSIBANTU_UKURAN.kawin} saksi berstatus kawin - periksa dulu`,
      langkah: [{ penunjuk: "#pihak_status_kawin", jenis: "pilih", nilai: "1" }],
    });
  }
  if (!String(x.alamat || "").trim() && String(x.alamatPihak || "").trim() && saksibantuKeluarga(x.hubungan, x.kamusHubungan)) {
    u.push({
      medan: "alamat", label: "Alamat", tulisan: `sama dengan alamat ${x.sebutanPihak || "pihak"}`, kuat: false,
      alasan: `hanya bila serumah - ${SAKSIBANTU_UKURAN.alamatSama} saksi beralamat persis sama`,
      langkah: [{ penunjuk: "#pihak_alamat", jenis: "teks", nilai: String(x.alamatPihak).trim() }],
      ...(saksibantuKeluarga(x.hubungan) ? {} : saksibantuKodeKamus(x.hubungan, x.kamusHubungan)), // P5P6 10 Okt
    });
  }
  return u;
}

/**
 * Catat medan yang diubah petugas sesudah ALETA mengisinya: medan itu keluar
 * dari `diisi` dan masuk `disentuh` - tidak pernah diisi otomatis lagi.
 * `nilaiKini` = { medan: nilai sekarang di blangko }.
 */
function saksibantuCatatSentuhan(keadaan, nilaiKini) {
  for (const medan of Object.keys(keadaan.diisi)) {
    if (String(nilaiKini[medan] === undefined ? "" : nilaiKini[medan]) !== String(keadaan.diisi[medan])) {
      delete keadaan.diisi[medan];
      keadaan.disentuh.add(medan);
    }
  }
  return keadaan;
}

/** Usulan yang boleh diisi otomatis sekarang: kuat, blangko Tambah, belum pernah diisi/disentuh. */
function saksibantuOtomatis(usulan, keadaan, mode) {
  if (mode !== "add" || !keadaan || keadaan.otomatis === false) return [];
  return (usulan || []).filter((x) => x.kuat && !keadaan.disentuh.has(x.medan) && !(x.medan in keadaan.diisi));
}

/** Nilai medan blangko yang dibandingkan untuk catatan sentuhan. */
function saksibantuNilaiMedan(usulan) {
  const akhir = usulan.langkah[usulan.langkah.length - 1];
  return akhir ? String(akhir.nilai) : "";
}

/** Tanggal "dd/mm/yyyy" hari ini - bawaan #pihak_tgl_lahir SIPP pada blangko Tambah. */
function saksibantuHariIni(sekarang) {
  // Bukan instanceof: tanggal dari realm lain (uji, iframe) bukan instanceof Date realm ini.
  const d = sekarang && typeof sekarang.getDate === "function" ? sekarang : new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/**
 * Isian yang dikirim ke pemeriksa ganda, atau null bila belum layak dicari.
 * Tanggal lahir bawaan SIPP (hari ini) dianggap belum diisi.
 */
function saksibantuIsianGanda(k, sekarang) {
  const nama = String(k.nama || "").replace(/\s+/g, " ").trim();
  const nik = String(k.nik || "").replace(/\s+/g, "");
  const tgl = String(k.tglLahir || "").trim();
  const tanggalLahir = /^\d{2}\/\d{2}\/\d{4}$/.test(tgl) && tgl !== saksibantuHariIni(sekarang) ? tgl : "";
  if (nama.replace(/[^A-Za-z]/g, "").length < 3 && !/^\d{16}$/.test(nik)) return null;
  return { nama, nik: /^\d{16}$/.test(nik) ? nik : "", tanggalLahir };
}

function saksibantuKunciGanda(isian) {
  return isian ? `${isian.nama.toUpperCase()}|${isian.tanggalLahir}|${isian.nik}` : "";
}

/** Saksi perkara ini yang namanya sama dengan nama terpilih di blangko saksi. */
function saksibantuSaksiSamaDiPerkara(nama, konteks) {
  const baku = (x) => String(x || "").toUpperCase().replace(/[^A-Z]/g, "");
  const n = baku(nama);
  if (!n || !konteks || !Array.isArray(konteks.saksi)) return null;
  return konteks.saksi.find((s) => baku(s.nama) === n) || null;
}

/* 10b. Keadaan, permintaan ke portal ────────────────────────────────────── */

const saksibantuKeadaan = {
  data: null,
  dataNomor: "",
  dataJanji: null,
  dataPesan: "",
  kotak: null,
  lajur: null,
  jam: null,
  pantau: null,
  potretSaksi: "",
  potretRef: "",
  pilihan: { dasar: "", sasaran: "", sasaranDipilih: false, ditulis: "", namaSaat: "" },
  borangSaksiEl: null,
  refTampak: false,
  ref: null,
  gandaJam: null,
};

function saksibantuKeadaanRef() {
  return { diisi: {}, disentuh: new Set(), otomatis: true, gandaKunci: "", ganda: null, gandaPesan: "", abaikan: false, mode: "" };
}

async function saksibantuAmbil(alamat, opsi) {
  const o = { credentials: "include", cache: "no-store", ...(opsi || {}) };
  const r = typeof alatAmbil === "function" && (!o.method || o.method === "GET")
    ? await alatAmbil(alamat, o, "Membaca bantu data saksi")
    : await fetch(alamat, o);
  let luar = null;
  try {
    luar = await r.json();
  } catch {
    luar = null;
  }
  const isi = luar && luar.data ? luar.data : luar;
  if (r.status === 423) return { ok: false, pesan: "Ditahan mode coba - tidak ada yang dikirim ke ALETA." };
  if (r.status === 401 || r.status === 403) return { ok: false, pesan: "Belum masuk portal ALETA, atau peran ini tidak diberi akses panel." };
  if (!r.ok || !isi) return { ok: false, pesan: saksiscanTeksPesan(luar && (luar.message || luar.error)) || `Server ALETA menjawab ${r.status}.` };
  return { ok: true, isi };
}

function saksibantuNomorPerkara() {
  try {
    return typeof cariNomorPerkara === "function" ? String(cariNomorPerkara() || "") : "";
  } catch {
    return "";
  }
}

/** Daftar hubungan + konteks perkara - sekali per perkara. */
async function saksibantuMuatData(paksa) {
  const nomor = saksibantuNomorPerkara();
  if (!paksa && saksibantuKeadaan.data && saksibantuKeadaan.dataNomor === nomor) return saksibantuKeadaan.data;
  if (saksibantuKeadaan.dataJanji) return saksibantuKeadaan.dataJanji;
  saksibantuKeadaan.dataJanji = (async () => {
    try {
      const j = await saksibantuAmbil(`${SAKSIBANTU_API}${nomor ? `?nomorPerkara=${encodeURIComponent(nomor)}` : ""}`);
      if (!j.ok) {
        saksibantuKeadaan.dataPesan = j.pesan;
        return null;
      }
      saksibantuKeadaan.data = j.isi;
      saksibantuKeadaan.dataNomor = nomor;
      saksibantuKeadaan.dataPesan = j.isi.konteks ? "" : saksiscanTeksPesan(j.isi.konteksAlasan) || "";
      return j.isi;
    } catch {
      saksibantuKeadaan.dataPesan = "Server ALETA tidak dapat dihubungi.";
      return null;
    } finally {
      saksibantuKeadaan.dataJanji = null;
    }
  })();
  return saksibantuKeadaan.dataJanji;
}

async function saksibantuKirim(muatan) {
  try {
    return await saksibantuAmbil(SAKSIBANTU_API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(muatan),
    });
  } catch {
    return { ok: false, pesan: "Server ALETA tidak dapat dihubungi." };
  }
}

async function saksibantuIsiMedan(borang, penunjuk, jenis, nilai) {
  const j = await saksiscanJembatan({ jenis: "isi", penunjuk: `${borang} ${penunjuk}`, jenisMedan: jenis, nilai });
  return Boolean(j && j.ok === true);
}

/* 10c. Kotak HUBUNGAN di blangko saksi (form#frm_user, pihak_ke 13) ───────── */

function saksibantuBorangSaksi() {
  const f = document.querySelector(SAKSISCAN_BORANG_SAKSI);
  if (!f || !saksiscanTampak(f)) return null;
  const ke = f.querySelector("#pihak_ke");
  return ke && String(ke.value) === "13" ? f : null;
}

function saksibantuNilai(f, penunjuk) {
  const el = f ? f.querySelector(penunjuk) : null;
  return el ? String(el.value || "").trim() : "";
}

function saksibantuDaftarHubungan() {
  const d = saksibantuKeadaan.data;
  return d && Array.isArray(d.hubungan) ? d.hubungan.filter((h) => h.aktif !== false) : [];
}

function saksibantuIsiPilihanHubungan(sel) {
  const pilih = sel.value;
  sel.textContent = "";
  const awal = saksiscanEl("option", "", "- pilih hubungan -");
  awal.value = "";
  sel.appendChild(awal);
  const kelompok = [["keluarga", "Keluarga"], ["lain", "Bukan keluarga"]];
  for (const [kunci, label] of kelompok) {
    const isi = saksibantuDaftarHubungan().filter((h) => (h.kelompok === "keluarga" ? "keluarga" : "lain") === kunci);
    if (!isi.length) continue;
    const g = document.createElement("optgroup");
    g.label = label;
    for (const h of isi) {
      const o = saksiscanEl("option", "", h.teks);
      o.value = h.teks;
      g.appendChild(o);
    }
    sel.appendChild(g);
  }
  const lain = saksiscanEl("option", "", "Lainnya - ketik sendiri…");
  lain.value = "__ketik__";
  sel.appendChild(lain);
  if (pilih && Array.from(sel.options).some((o) => o.value === pilih)) sel.value = pilih;
}

function saksibantuIsiPilihanSasaran(sel, konteks, kunci) {
  sel.textContent = "";
  for (const x of saksibantuDaftarSasaran(konteks)) {
    const o = saksiscanEl("option", "", x.tulisan);
    o.value = x.kunci;
    sel.appendChild(o);
  }
  if (kunci && Array.from(sel.options).some((o) => o.value === kunci)) sel.value = kunci;
}

function saksibantuStatus(el, teks, nada) {
  if (!el) return;
  el.textContent = teks || "";
  el.hidden = !teks;
  if (nada) el.setAttribute("data-nada", nada);
  else el.removeAttribute("data-nada");
}

function saksibantuDasarKini(kotak) {
  const sel = kotak.querySelector(".aleta-c2-sbantu-hub");
  if (sel.value === "__ketik__") return saksibantuUrai(kotak.querySelector(".aleta-c2-sbantu-ketik").value).dasar;
  return sel.value;
}

function saksibantuHasilKini(kotak) {
  const konteks = saksibantuKeadaan.data && saksibantuKeadaan.data.konteks;
  const sasaran = kotak.querySelector(".aleta-c2-sbantu-sasaran").value;
  return saksibantuSusun(saksibantuDasarKini(kotak), saksibantuTulisanSasaran(sasaran, konteks));
}

/** Tulis ke Keterangan SIPP. `paksa` = petugas sudah menyetujui menimpa isian lain. */
async function saksibantuTulisKeterangan(kotak, paksa) {
  const f = saksibantuBorangSaksi();
  const status = kotak.querySelector(".aleta-c2-sbantu-status");
  const hasil = saksibantuHasilKini(kotak);
  if (!f || !hasil) return;
  const kini = saksibantuNilai(f, "#keterangan");
  const milikAleta = !kini || kini === saksibantuKeadaan.pilihan.ditulis;
  if (!milikAleta && !paksa && kini !== hasil) {
    const ganti = kotak.querySelector(".aleta-c2-sbantu-ganti");
    ganti.textContent = `Ganti "${kini.slice(0, 60)}" dengan "${hasil}"`;
    ganti.hidden = false;
    saksibantuStatus(status, "Keterangan sudah berisi isian lain - tidak ditimpa tanpa persetujuan Anda.", "mendesak");
    return;
  }
  const ok = await saksibantuIsiMedan(SAKSISCAN_BORANG_SAKSI, "#keterangan", "teks", hasil);
  if (ok) {
    saksibantuKeadaan.pilihan.ditulis = hasil;
    saksibantuKeadaan.pilihan.namaSaat = saksibantuNilai(f, "#fullname");
    kotak.querySelector(".aleta-c2-sbantu-ganti").hidden = true;
    saksibantuStatus(status, `Keterangan: "${hasil}" - BELUM TERSIMPAN, tekan Simpan SIPP sendiri.`, "aman");
  } else {
    saksibantuStatus(status, "Keterangan tidak dapat diisi - ketik sendiri di kotak Keterangan SIPP.", "lewat");
  }
}

async function saksibantuSimpanKeDaftar(kotak) {
  // Yang disimpan DASARNYA saja ("Sepupu Dua Kali") - sebutan pihak yang
  // terketik ikut dibuang, karena sebutan ditambahkan menurut jenis perkara.
  const mentah = kotak.querySelector(".aleta-c2-sbantu-ketik").value;
  const teks = saksibantuUrai(mentah).dasar || mentah;
  const status = kotak.querySelector(".aleta-c2-sbantu-status");
  const j = await saksibantuKirim({ aksi: "tambah", teks });
  if (!j.ok || !j.isi || j.isi.ok === false) {
    saksibantuStatus(status, saksiscanTeksPesan((j.isi && (j.isi.alasan || j.isi.pesan)) || j.pesan) || "Tidak tersimpan.", "lewat");
    return;
  }
  await saksibantuMuatData(true);
  const sel = kotak.querySelector(".aleta-c2-sbantu-hub");
  saksibantuIsiPilihanHubungan(sel);
  const baru = j.isi.hubungan && j.isi.hubungan.teks;
  if (baru) sel.value = baru;
  kotak.querySelector(".aleta-c2-sbantu-ketik-baris").hidden = sel.value !== "__ketik__";
  saksibantuStatus(status, `"${baru}" ${j.isi.sudahAda ? "sudah ada di" : "ditambahkan ke"} daftar hubungan.`, "aman");
}

async function saksibantuAturHubungan(kotak, kunci, aktif) {
  const j = await saksibantuKirim({ aksi: aktif ? "tampilkan" : "sembunyikan", kunci });
  const status = kotak.querySelector(".aleta-c2-sbantu-status");
  if (!j.ok || !j.isi || j.isi.ok === false) {
    saksibantuStatus(status, saksiscanTeksPesan((j.isi && j.isi.alasan) || j.pesan) || "Tidak berhasil.", "lewat");
    return;
  }
  await saksibantuMuatData(true);
  saksibantuIsiPilihanHubungan(kotak.querySelector(".aleta-c2-sbantu-hub"));
  saksibantuIsiKelola(kotak);
}

function saksibantuIsiKelola(kotak) {
  const wadah = kotak.querySelector(".aleta-c2-sbantu-kelola-isi");
  if (!wadah) return;
  wadah.textContent = "";
  const semua = (saksibantuKeadaan.data && saksibantuKeadaan.data.hubungan) || [];
  for (const h of semua) {
    const baris = saksiscanEl("div", "aleta-c2-sbantu-kelola-baris");
    baris.appendChild(saksiscanEl("span", "", `${h.teks}${h.bawaan ? "" : " (tambahan)"}${h.aktif === false ? " - disembunyikan" : ""}`));
    const b = saksiscanEl("button", "aleta-tombol", h.aktif === false ? "Tampilkan" : "Sembunyikan");
    b.type = "button";
    b.addEventListener("click", () => void saksibantuAturHubungan(kotak, h.kunci, h.aktif === false));
    baris.appendChild(b);
    wadah.appendChild(baris);
  }
}

function saksibantuBuatKotak() {
  const kotak = saksiscanEl("div", "aleta-c2-sbantu");
  kotak.appendChild(saksiscanEl("div", "aleta-c2-sbantu-judul", "Hubungan saksi (ALETA)"));
  kotak.appendChild(
    saksiscanEl("div", "aleta-c2-sbantu-lembut", "Pilih sebelum [Cari] - jenis kelamin ikut diusulkan di blangko data pihak. Keterangan diisi lengkap dengan sebutan pihak menurut jenis perkara.")
  );
  const baris = saksiscanEl("div", "aleta-c2-sbantu-baris");
  const hub = saksiscanEl("select", "aleta-c2-sbantu-hub");
  hub.setAttribute("aria-label", "Hubungan saksi dengan pihak");
  const dengan = saksiscanEl("span", "aleta-c2-sbantu-lembut", "dengan");
  const sasaran = saksiscanEl("select", "aleta-c2-sbantu-sasaran");
  sasaran.setAttribute("aria-label", "Pihak");
  baris.appendChild(hub);
  baris.appendChild(dengan);
  baris.appendChild(sasaran);
  kotak.appendChild(baris);

  const ketikBaris = saksiscanEl("div", "aleta-c2-sbantu-baris aleta-c2-sbantu-ketik-baris");
  const ketik = saksiscanEl("input", "aleta-c2-sbantu-ketik");
  ketik.type = "text";
  ketik.placeholder = "mis. Sepupu Dua Kali (tanpa sebutan pihak)";
  const simpanDaftar = saksiscanEl("button", "aleta-tombol", "+ Simpan ke daftar");
  simpanDaftar.type = "button";
  ketikBaris.appendChild(ketik);
  ketikBaris.appendChild(simpanDaftar);
  ketikBaris.hidden = true;
  kotak.appendChild(ketikBaris);

  const pratinjau = saksiscanEl("div", "aleta-c2-sbantu-hasil");
  kotak.appendChild(pratinjau);
  const ganti = saksiscanEl("button", "aleta-tombol aleta-c2-sbantu-ganti", "");
  ganti.type = "button";
  ganti.hidden = true;
  kotak.appendChild(ganti);
  const rapikan = saksiscanEl("button", "aleta-tombol aleta-c2-sbantu-rapikan", "");
  rapikan.type = "button";
  rapikan.hidden = true;
  kotak.appendChild(rapikan);
  const peringatan = saksiscanEl("div", "aleta-c2-sbantu-peringatan");
  peringatan.hidden = true;
  kotak.appendChild(peringatan);
  const status = saksiscanEl("div", "aleta-c2-sbantu-status");
  status.hidden = true;
  kotak.appendChild(status);

  const kelola = document.createElement("details");
  kelola.className = "aleta-c2-sbantu-kelola";
  kelola.hidden = true;
  kelola.appendChild(saksiscanEl("summary", "", "Kelola daftar hubungan (Admin)"));
  kelola.appendChild(saksiscanEl("div", "aleta-c2-sbantu-kelola-isi"));
  kelola.addEventListener("toggle", () => {
    if (kelola.open) saksibantuIsiKelola(kotak);
  });
  kotak.appendChild(kelola);

  const segarkan = () => {
    const h = saksibantuHasilKini(kotak);
    pratinjau.textContent = h ? `Hasil: ${h}` : "";
  };
  hub.addEventListener("change", () => {
    ketikBaris.hidden = hub.value !== "__ketik__";
    saksibantuKeadaan.pilihan.dasar = saksibantuDasarKini(kotak);
    segarkan();
    // Memilih dari daftar = mengisi Keterangan (bila kosong atau isian ALETA).
    if (hub.value && hub.value !== "__ketik__") void saksibantuTulisKeterangan(kotak, false);
  });
  sasaran.addEventListener("change", () => {
    saksibantuKeadaan.pilihan.sasaran = sasaran.value;
    saksibantuKeadaan.pilihan.sasaranDipilih = true;
    segarkan();
    if (saksibantuDasarKini(kotak)) void saksibantuTulisKeterangan(kotak, false);
  });
  ketik.addEventListener("input", () => {
    saksibantuKeadaan.pilihan.dasar = saksibantuDasarKini(kotak);
    segarkan();
  });
  ketik.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      void saksibantuTulisKeterangan(kotak, false);
    }
  });
  ketik.addEventListener("change", () => void saksibantuTulisKeterangan(kotak, false));
  simpanDaftar.addEventListener("click", () => void saksibantuSimpanKeDaftar(kotak));
  ganti.addEventListener("click", () => void saksibantuTulisKeterangan(kotak, true));
  rapikan.addEventListener("click", async () => {
    const f = saksibantuBorangSaksi();
    const rapi = rapikan.dataset.rapi || "";
    if (!f || !rapi) return;
    const ok = await saksibantuIsiMedan(SAKSISCAN_BORANG_SAKSI, "#keterangan", "teks", rapi);
    if (ok) {
      saksibantuKeadaan.pilihan.ditulis = rapi;
      rapikan.hidden = true;
      saksibantuStatus(status, `Keterangan dirapikan: "${rapi}" - BELUM TERSIMPAN, tekan Simpan SIPP sendiri.`, "aman");
    }
  });
  return kotak;
}

/** Sesuaikan kotak dengan keadaan blangko saksi - dipanggil tiap pemantauan. */
function saksibantuSegarkanKotak(f) {
  const kotak = saksibantuKeadaan.kotak;
  if (!kotak) return;
  const data = saksibantuKeadaan.data;
  const konteks = data && data.konteks;
  const yangMenghadirkan = saksibantuNilai(f, "#saksi_pihak_ke") || "1";
  const kini = saksibantuNilai(f, "#keterangan");
  const nama = saksibantuNilai(f, "#fullname");
  const potret = [yangMenghadirkan, kini, nama, data ? "1" : "0", saksibantuKeadaan.dataPesan].join("|");
  if (potret === saksibantuKeadaan.potretSaksi) return;
  saksibantuKeadaan.potretSaksi = potret;

  const hub = kotak.querySelector(".aleta-c2-sbantu-hub");
  const sasaran = kotak.querySelector(".aleta-c2-sbantu-sasaran");
  if (hub.options.length <= 1 || hub.dataset.jumlah !== String(saksibantuDaftarHubungan().length)) {
    saksibantuIsiPilihanHubungan(hub);
    hub.dataset.jumlah = String(saksibantuDaftarHubungan().length);
  }
  const pilihan = saksibantuKeadaan.pilihan;
  const urai = kini ? saksibantuUrai(kini) : null;
  const kunci = pilihan.sasaranDipilih ? pilihan.sasaran : saksibantuKunciSasaran(urai && urai.dasar ? urai.pihak : null, konteks, yangMenghadirkan);
  saksibantuIsiPilihanSasaran(sasaran, konteks, kunci);
  if (!pilihan.sasaranDipilih) pilihan.sasaran = sasaran.value;
  // Keterangan yang sudah ada -> pilih dasarnya di daftar (bila ada).
  if (!hub.value && urai && urai.dasar && Array.from(hub.options).some((o) => o.value === urai.dasar)) hub.value = urai.dasar;
  const h = saksibantuHasilKini(kotak);
  kotak.querySelector(".aleta-c2-sbantu-hasil").textContent = h ? `Hasil: ${h}` : "";

  const status = kotak.querySelector(".aleta-c2-sbantu-status");
  if (!data) saksibantuStatus(status, saksibantuKeadaan.dataPesan || "Membaca daftar hubungan…", saksibantuKeadaan.dataPesan ? "lewat" : "");
  else if (!konteks && saksibantuKeadaan.dataPesan) saksibantuStatus(status, `Sebutan pihak belum terbaca (${saksibantuKeadaan.dataPesan}) - dipakai Penggugat/Tergugat; periksa hasilnya.`, "mendesak");

  // SIPP mengisi Keterangan dari data pihak saat [Pilih] (fillForm) - pilihan
  // ALETA yang tertimpa diisikan lagi HANYA bila Keterangan kini kosong.
  if (pilihan.ditulis && kini !== pilihan.ditulis) {
    if (!kini && h && nama !== pilihan.namaSaat) void saksibantuTulisKeterangan(kotak, false);
    else if (!kini) pilihan.ditulis = "";
    else if (kini && h && kini !== h) {
      const ganti = kotak.querySelector(".aleta-c2-sbantu-ganti");
      ganti.textContent = `Ganti "${kini.slice(0, 60)}" dengan "${h}"`;
      ganti.hidden = false;
    }
  }

  // Tawaran merapikan keterangan yang ditulis tangan.
  const rapikan = kotak.querySelector(".aleta-c2-sbantu-rapikan");
  const rapi = kini && kini !== pilihan.ditulis ? saksibantuRapikan(kini, konteks, yangMenghadirkan) : "";
  if (rapi && rapi !== kini) {
    rapikan.dataset.rapi = rapi;
    rapikan.textContent = `Rapikan menjadi "${rapi}"`;
    rapikan.hidden = false;
  } else {
    rapikan.hidden = true;
  }

  // Saksi yang sama sudah tercatat di perkara ini.
  const peringatan = kotak.querySelector(".aleta-c2-sbantu-peringatan");
  const sama = nama ? saksibantuSaksiSamaDiPerkara(nama, konteks) : null;
  // Blangko Edit saksi: SIPP hanya mencetak tombol Hapus bila act == "edit".
  const sedangEdit = Boolean(f.querySelector("#hapus"));
  if (sama && !sedangEdit) {
    peringatan.textContent = `${sama.nama} sudah tercatat sebagai Saksi ke-${sama.urutan || "?"} perkara ini${sama.keterangan ? ` (${sama.keterangan})` : ""}. Bila orangnya sama, jangan ditambah lagi - sunting baris saksi yang ada.`;
    peringatan.hidden = false;
  } else {
    peringatan.hidden = true;
  }
  const kelola = kotak.querySelector(".aleta-c2-sbantu-kelola");
  kelola.hidden = !(data && data.bolehKelola);
}

function saksibantuPasangKotak(f) {
  const ket = f.querySelector("#keterangan");
  if (!ket || !ket.parentElement) return;
  if (saksibantuKeadaan.kotak && saksibantuKeadaan.kotak.isConnected && ket.parentElement.contains(saksibantuKeadaan.kotak)) return;
  if (!saksibantuKeadaan.kotak) saksibantuKeadaan.kotak = saksibantuBuatKotak();
  saksibantuKeadaan.potretSaksi = "";
  ket.parentElement.appendChild(saksibantuKeadaan.kotak);
}

/* 10d. Lajur USULAN + saksi ganda di "Tambah Referensi Data Pihak" ─────── */

function saksibantuBorangRef() {
  const f = document.querySelector(SAKSIBANTU_BORANG_REF);
  return f && saksiscanTampak(f) ? f : null;
}

function saksibantuBacaRef(f) {
  const v = (p) => saksibantuNilai(f, p);
  const agama = f.querySelector("#pihak_agama");
  const tni = f.querySelector("#apakahtni");
  return {
    mode: v("#act_frm_ref_pihak") === "updt" ? "updt" : "add",
    nama: v("#pihak_fullname"),
    tglLahir: v("#pihak_tgl_lahir"),
    umur: v("#pihak_umur"),
    nik: v("#pihak_no_identitas"),
    agama: v("#pihak_agama"),
    pilihanAgama: agama ? Array.from(agama.options || []).map((o) => ({ nilai: o.value, tulisan: String(o.textContent || "").trim() })) : [],
    jenisKelamin: v("#pihak_jenis_kelamin"),
    pekerjaan: v("#pihak_pekerjaan"),
    apakahTni: tni ? v("#apakahtni") : null,
    statusKawin: v("#pihak_status_kawin"),
    alamat: v("#pihak_alamat"),
    pendidikan: v("#pihak_pendidikan"),
    tempatLahir: v("#pihak_tempat_lahir"),
  };
}

/** Nilai medan usulan sekarang di blangko - untuk catatan sentuhan. */
function saksibantuNilaiKiniRef(b) {
  return {
    agama: b.agama,
    jenisKelamin: b.jenisKelamin,
    pekerjaan: b.pekerjaan,
    statusKawin: b.statusKawin,
    alamat: b.alamat,
  };
}

/** Pihak yang menghadirkan (alamatnya untuk usulan) - dari blangko saksi di belakang. */
function saksibantuPihakUntukAlamat() {
  const konteks = saksibantuKeadaan.data && saksibantuKeadaan.data.konteks;
  if (!konteks) return null;
  const fs = document.querySelector(SAKSISCAN_BORANG_SAKSI);
  const ke = fs ? saksibantuNilai(fs, "#saksi_pihak_ke") : "1";
  const daftar = ke === "2" ? konteks.pihakKedua : konteks.pihakPertama;
  const p = Array.isArray(daftar) && daftar[0];
  if (!p || !p.alamat) return null;
  const sebutan = konteks.sebutan ? (ke === "2" ? konteks.sebutan.dua : konteks.sebutan.satu) : "pihak";
  return { alamat: p.alamat, sebutan: Array.isArray(daftar) && daftar.length > 1 ? `${sebutan} I` : sebutan };
}

function saksibantuBuatLajur() {
  const lajur = saksiscanEl("div", "aleta-c2-sbantu aleta-c2-sbantu-ref");
  const kepala = saksiscanEl("div", "aleta-c2-sbantu-judul", "Usulan ALETA - periksa sebelum Simpan");
  lajur.appendChild(kepala);
  const label = saksiscanEl("label", "aleta-c2-sbantu-saklar");
  const kotak = document.createElement("input");
  kotak.type = "checkbox";
  kotak.checked = true;
  kotak.className = "aleta-c2-sbantu-otomatis";
  label.appendChild(kotak);
  label.appendChild(saksiscanEl("span", "", " Isi otomatis medan kosong yang pasti (agama, jenis kelamin dari hubungan)"));
  kotak.addEventListener("change", () => {
    if (saksibantuKeadaan.ref) saksibantuKeadaan.ref.otomatis = kotak.checked;
    saksibantuKeadaan.potretRef = "";
    saksibantuJadwalkanBantu();
  });
  lajur.appendChild(label);
  lajur.appendChild(saksiscanEl("div", "aleta-c2-sbantu-ganda"));
  lajur.appendChild(saksiscanEl("ul", "aleta-c2-sbantu-diisi"));
  lajur.appendChild(saksiscanEl("div", "aleta-c2-sbantu-chip"));
  lajur.appendChild(saksiscanEl("div", "aleta-c2-sbantu-kurang"));
  const status = saksiscanEl("div", "aleta-c2-sbantu-status");
  status.hidden = true;
  lajur.appendChild(status);
  return lajur;
}

async function saksibantuTerapkan(usulan, otomatis) {
  const r = saksibantuKeadaan.ref;
  let semua = true;
  for (const l of usulan.langkah) {
    const ok = await saksibantuIsiMedan(SAKSIBANTU_BORANG_REF, l.penunjuk, l.jenis, l.nilai);
    if (!ok) semua = false;
  }
  if (semua && r) {
    r.diisi[usulan.medan] = saksibantuNilaiMedan(usulan);
    r.label = r.label || {};
    r.label[usulan.medan] = { label: usulan.label, tulisan: usulan.tulisan, alasan: usulan.alasan, otomatis };
  }
  saksibantuKeadaan.potretRef = "";
  return semua;
}

async function saksibantuBatalkan(medan) {
  const r = saksibantuKeadaan.ref;
  if (!r) return;
  const penunjuk = {
    agama: ["#pihak_agama", "pilih"],
    jenisKelamin: ["#pihak_jenis_kelamin", "pilih"],
    pekerjaan: ["#pihak_pekerjaan", "teks"],
    statusKawin: ["#pihak_status_kawin", "pilih"],
    alamat: ["#pihak_alamat", "teks"],
  }[medan];
  if (penunjuk) await saksibantuIsiMedan(SAKSIBANTU_BORANG_REF, penunjuk[0], penunjuk[1], "");
  delete r.diisi[medan];
  r.disentuh.add(medan);
  saksibantuKeadaan.potretRef = "";
  saksibantuJadwalkanBantu();
}

function saksibantuGambarGanda(lajur, r) {
  const wadah = lajur.querySelector(".aleta-c2-sbantu-ganda");
  wadah.textContent = "";
  if (r.gandaPesan) {
    const p = saksiscanEl("div", "aleta-c2-sbantu-lembut", r.gandaPesan);
    wadah.appendChild(p);
  }
  const calon = (r.ganda || []).filter(Boolean);
  if (!calon.length || r.abaikan) return;
  const kuat = calon.filter((c) => c.tingkat === "pasti" || c.tingkat === "nik");
  const judul = saksiscanEl(
    "div",
    "aleta-c2-sbantu-peringatan",
    kuat.length
      ? `Orang ini SUDAH ADA di data pihak SIPP (${kuat.length} data). Pakai data yang ada - jangan membuat data baru.`
      : `Ada ${calon.length} data pihak SIPP bernama sama yang tanggal lahirnya belum terisi - periksa apakah orangnya sama.`
  );
  wadah.appendChild(judul);
  const ul = saksiscanEl("ul", "aleta-c2-sbantu-calon");
  for (const c of calon) {
    const li = saksiscanEl("li");
    const ttl = [c.tempatLahir, c.tanggalLahir].filter(Boolean).join(", ");
    li.appendChild(saksiscanEl("div", "aleta-c2-sbantu-calon-nama", `${c.nama}${ttl ? ` · lahir ${ttl}` : ""}${c.jenisKelamin ? ` · ${c.jenisKelamin}` : ""}`));
    const rinci = [];
    if (c.alamat) rinci.push(c.alamat);
    if (c.pekerjaan) rinci.push(c.pekerjaan);
    rinci.push(`dasar: ${c.dasar}`);
    if (c.jumlahPerkaraSaksi) rinci.push(`saksi di ${c.jumlahPerkaraSaksi} perkara`);
    li.appendChild(saksiscanEl("div", "aleta-c2-sbantu-lembut", rinci.join(" · ")));
    if (c.saksiDiPerkaraIni) {
      li.appendChild(saksiscanEl("div", "aleta-c2-sbantu-peringatan", `Sudah menjadi Saksi ke-${c.urutanDiPerkaraIni || "?"} perkara ini.`));
    }
    const kurang = [...(c.kurangWajib || []), ...(c.kurang || [])];
    if (kurang.length) {
      li.appendChild(
        saksiscanEl(
          "div",
          "aleta-c2-sbantu-lembut",
          `Data lama belum lengkap: ${kurang.join(", ")}${(c.kurangWajib || []).length ? " (SIPP menolak [Pilih] sebelum yang wajib dilengkapi)" : ""} - lengkapi lewat [Edit] pada baris itu.`
        )
      );
    }
    ul.appendChild(li);
  }
  wadah.appendChild(ul);
  const tombol = saksiscanEl("div", "aleta-c2-sbantu-baris");
  const pakai = saksiscanEl("button", "aleta-tombol aleta-c2-sbantu-pakai", "Pakai data yang ada (cari di daftar)");
  pakai.type = "button";
  pakai.addEventListener("click", () => void saksibantuPakaiYangAda(lajur, calon[0]));
  const abaikan = saksiscanEl("button", "aleta-tombol", "Bukan orang yang sama - tetap tambah baru");
  abaikan.type = "button";
  abaikan.addEventListener("click", () => {
    r.abaikan = true;
    saksibantuKeadaan.potretRef = "";
    saksibantuJadwalkanBantu();
  });
  tombol.appendChild(pakai);
  tombol.appendChild(abaikan);
  wadah.appendChild(tombol);
}

/**
 * Kembali ke daftar referensi pihak dan mencari nama itu - dengan tombol SIPP
 * sendiri (Kembali, kotak cari, Search). Memilih atau menyunting barisnya
 * tetap petugas: [Pilih] untuk memakai, [Edit] untuk melengkapi.
 */
async function saksibantuPakaiYangAda(lajur, calon) {
  const status = lajur.querySelector(".aleta-c2-sbantu-status");
  const kembali = await saksiscanJembatan({ jenis: "tekan", penunjuk: "#back_pihak" });
  if (!kembali || kembali.ok !== true) {
    saksibantuStatus(status, "Tombol Kembali SIPP tidak dapat ditekan - tekan Kembali sendiri, lalu cari namanya di daftar.", "lewat");
    return;
  }
  const kotakCari = await saksiscanTunggu(() => saksiscanTampakSel("#search-box"), 6000);
  if (!kotakCari) {
    saksibantuStatus(status, "Daftar referensi pihak tidak tampak - cari namanya sendiri di daftar.", "lewat");
    return;
  }
  await saksiscanJembatan({ jenis: "isi", penunjuk: "#search-box", jenisMedan: "teks", nilai: calon.nama });
  await saksiscanJembatan({ jenis: "tekan", penunjuk: "#search-btn1" });
  const ttl = calon.tanggalLahir ? ` bertanggal lahir ${calon.tanggalLahir}` : "";
  const kurangWajib = (calon.kurangWajib || []).length;
  saksibantuStatus(
    status,
    `Daftar dicari "${calon.nama}". Klik [Pilih] pada baris${ttl} untuk memakainya${kurangWajib ? "; bila SIPP menolak karena data belum lengkap, klik [Edit] pada baris itu, lengkapi, lalu Simpan" : ""}.`,
    "aman"
  );
}

function saksibantuGambarUsulan(lajur, r, usulan, b) {
  const diisiUl = lajur.querySelector(".aleta-c2-sbantu-diisi");
  diisiUl.textContent = "";
  for (const medan of Object.keys(r.diisi)) {
    const info = (r.label || {})[medan];
    if (!info) continue;
    const li = saksiscanEl("li", "", `${info.label}: ${info.tulisan} - usulan ${info.otomatis ? "otomatis" : "dipakai"} (${info.alasan}) `);
    const batal = saksiscanEl("button", "aleta-tombol", "Batalkan");
    batal.type = "button";
    batal.addEventListener("click", () => void saksibantuBatalkan(medan));
    li.appendChild(batal);
    diisiUl.appendChild(li);
  }
  diisiUl.hidden = !diisiUl.children.length;

  const chip = lajur.querySelector(".aleta-c2-sbantu-chip");
  chip.textContent = "";
  for (const x of usulan.filter((u) => !(u.medan in r.diisi) && (!u.kuat || b.mode !== "add" || r.disentuh.has(u.medan) || !r.otomatis))) {
    const t = saksiscanEl("button", "aleta-tombol aleta-c2-sbantu-usul", `Usulan ${x.label}: ${x.tulisan}`);
    t.type = "button";
    t.title = x.alasan;
    t.addEventListener("click", () => void saksibantuTerapkan(x, false).then(() => saksibantuJadwalkanBantu()));
    chip.appendChild(t);
  }
  chip.hidden = !chip.children.length;

  const kurangEl = lajur.querySelector(".aleta-c2-sbantu-kurang");
  if (b.mode === "updt") {
    const kurang = [];
    if (!b.tempatLahir) kurang.push("Tempat lahir");
    if (!b.jenisKelamin) kurang.push("Jenis kelamin");
    if (!b.agama) kurang.push("Agama");
    if (!saksibantuPekerjaanTerisi(b)) kurang.push("Pekerjaan (wajib)");
    if (!b.alamat) kurang.push("Alamat (wajib)");
    if (!b.statusKawin) kurang.push("Status kawin");
    if (!b.pendidikan) kurang.push("Pendidikan");
    if (!/^\d{16}$/.test(String(b.nik || ""))) kurang.push("NIK");
    kurangEl.textContent = kurang.length ? `Melengkapi data lama - masih kosong: ${kurang.join(", ")}.` : "Data pihak ini sudah lengkap.";
    kurangEl.hidden = false;
  } else {
    kurangEl.hidden = true;
  }
}

async function saksibantuPeriksaGanda(b) {
  const r = saksibantuKeadaan.ref;
  if (!r || b.mode !== "add") return;
  const isian = saksibantuIsianGanda(b);
  const kunci = saksibantuKunciGanda(isian);
  if (kunci === r.gandaKunci) return;
  r.gandaKunci = kunci;
  r.abaikan = false;
  if (!isian) {
    r.ganda = null;
    r.gandaPesan = "";
    saksibantuKeadaan.potretRef = "";
    return;
  }
  clearTimeout(saksibantuKeadaan.gandaJam);
  saksibantuKeadaan.gandaJam = setTimeout(async () => {
    const j = await saksibantuKirim({ aksi: "ganda", ...isian, nomorPerkara: saksibantuNomorPerkara() });
    const rr = saksibantuKeadaan.ref;
    if (!rr || rr.gandaKunci !== kunci) return;
    if (!j.ok || !j.isi || j.isi.ok === false) {
      rr.ganda = null;
      rr.gandaPesan = `Pemeriksaan saksi ganda tidak berjalan: ${saksiscanTeksPesan((j.isi && j.isi.alasan) || j.pesan) || "server tidak menjawab"}.`;
    } else {
      rr.ganda = Array.isArray(j.isi.calon) ? j.isi.calon : [];
      rr.gandaPesan = "";
    }
    saksibantuKeadaan.potretRef = "";
    saksibantuJadwalkanBantu();
  }, SAKSIBANTU_JEDA_GANDA_MS);
}

async function saksibantuSegarkanLajur(f) {
  const lajur = saksibantuKeadaan.lajur;
  if (!lajur) return;
  const b = saksibantuBacaRef(f);
  let r = saksibantuKeadaan.ref;
  if (!r || r.mode !== b.mode) {
    r = saksibantuKeadaan.ref = saksibantuKeadaanRef();
    r.mode = b.mode;
    r.otomatis = lajur.querySelector(".aleta-c2-sbantu-otomatis").checked;
  }
  saksibantuCatatSentuhan(r, saksibantuNilaiKiniRef(b));
  const pihak = saksibantuPihakUntukAlamat();
  const usulan = saksibantuUsulan({
    ...b,
    hubungan: saksibantuKeadaan.pilihan.dasar,
    kamusHubungan: saksibantuKamusHubungan(), // P5P6 10 Okt
    alamatPihak: pihak ? pihak.alamat : "",
    sebutanPihak: pihak ? pihak.sebutan : "",
  });
  const potret = JSON.stringify([b, usulan.map((u) => u.medan), Object.keys(r.diisi), [...r.disentuh], r.otomatis, r.gandaKunci, Boolean(r.ganda), r.abaikan, r.gandaPesan]);
  if (potret === saksibantuKeadaan.potretRef) return;
  saksibantuKeadaan.potretRef = potret;

  for (const x of saksibantuOtomatis(usulan, r, b.mode)) await saksibantuTerapkan(x, true);
  const sesudah = saksibantuBacaRef(f);
  const usulanAkhir = saksibantuUsulan({
    ...sesudah,
    hubungan: saksibantuKeadaan.pilihan.dasar,
    kamusHubungan: saksibantuKamusHubungan(), // P5P6 10 Okt
    alamatPihak: pihak ? pihak.alamat : "",
    sebutanPihak: pihak ? pihak.sebutan : "",
  });
  saksibantuGambarUsulan(lajur, r, usulanAkhir, sesudah);
  saksibantuGambarGanda(lajur, r);
  void saksibantuPeriksaGanda(sesudah);
}

function saksibantuPasangLajur(f) {
  if (saksibantuKeadaan.lajur && saksibantuKeadaan.lajur.isConnected && saksibantuKeadaan.lajur.nextElementSibling === f) return;
  if (!saksibantuKeadaan.lajur) saksibantuKeadaan.lajur = saksibantuBuatLajur();
  saksibantuKeadaan.ref = null;
  saksibantuKeadaan.potretRef = "";
  f.parentElement.insertBefore(saksibantuKeadaan.lajur, f);
}

/* 10e. Pemantauan ───────────────────────────────────────────────────────── */

/**
 * SIPP mengisi medan lewat jQuery .val() (fillForm, edit, clearAll) - tanpa
 * peristiwa apa pun. Selama salah satu blangko saksi terbuka, nilainya
 * dibaca ulang tiap 0,7 detik; tidak ada yang digambar ulang bila tidak ada
 * yang berubah (potret).
 */
async function saksibantuPeriksa() {
  if (!saksiscanModeUi()) {
    saksibantuBersihkan();
    return false;
  }
  // Blangko saksi SIPP (#popup_form) dibuat baru tiap dibuka dan DIBUANG saat
  // ditutup; selama Cari ia hanya disembunyikan (popup_form2nd). Jadi:
  // tidak ada di DOM = bersihkan; elemen lain = blangko baru, pilihan direset;
  // tersembunyi = jeda saja (pilihan hubungan dipakai di blangko data pihak).
  const ada = document.querySelector(SAKSISCAN_BORANG_SAKSI);
  const untukSaksi = Boolean(ada && ada.querySelector("#pihak_ke") && String(ada.querySelector("#pihak_ke").value) === "13");
  if (!untukSaksi) {
    saksibantuBersihkan();
    return false;
  }
  if (saksibantuKeadaan.borangSaksiEl !== ada) {
    saksibantuBersihkan();
    saksibantuKeadaan.borangSaksiEl = ada;
  }
  const fs = saksibantuBorangSaksi();
  const fr = saksibantuBorangRef();
  if (!fs && !fr) {
    if (saksibantuKeadaan.pantau) {
      clearInterval(saksibantuKeadaan.pantau);
      saksibantuKeadaan.pantau = null;
    }
    return false;
  }
  if (!saksibantuKeadaan.data && !saksibantuKeadaan.dataJanji) void saksibantuMuatData(false).then(() => saksibantuJadwalkanBantu());
  if (fs) {
    saksibantuPasangKotak(fs);
    saksibantuSegarkanKotak(fs);
  }
  if (fr) {
    // Tiap kali blangko data pihak MUNCUL (Tambah/Edit baru) catatannya baru:
    // SIPP mengosongkan isiannya (clearAll) sebelum menampilkannya.
    if (!saksibantuKeadaan.refTampak) {
      saksibantuKeadaan.ref = null;
      saksibantuKeadaan.potretRef = "";
    }
    saksibantuKeadaan.refTampak = true;
    saksibantuPasangLajur(fr);
    await saksibantuSegarkanLajur(fr);
  } else {
    saksibantuKeadaan.refTampak = false;
    if (saksibantuKeadaan.lajur && saksibantuKeadaan.lajur.isConnected) {
      saksibantuKeadaan.lajur.remove();
      saksibantuKeadaan.ref = null;
    }
  }
  if (!saksibantuKeadaan.pantau) saksibantuKeadaan.pantau = setInterval(() => saksibantuJadwalkanBantu(), SAKSIBANTU_JEDA_PANTAU_MS);
  return true;
}

function saksibantuBersihkan() {
  if (saksibantuKeadaan.pantau) {
    clearInterval(saksibantuKeadaan.pantau);
    saksibantuKeadaan.pantau = null;
  }
  if (saksibantuKeadaan.kotak && saksibantuKeadaan.kotak.isConnected) saksibantuKeadaan.kotak.remove();
  if (saksibantuKeadaan.lajur && saksibantuKeadaan.lajur.isConnected) saksibantuKeadaan.lajur.remove();
  saksibantuKeadaan.kotak = null;
  saksibantuKeadaan.lajur = null;
  saksibantuKeadaan.ref = null;
  saksibantuKeadaan.potretSaksi = "";
  saksibantuKeadaan.potretRef = "";
  saksibantuKeadaan.pilihan = { dasar: "", sasaran: "", sasaranDipilih: false, ditulis: "", namaSaat: "" };
  saksibantuKeadaan.borangSaksiEl = null;
}

let saksibantuSedang = false;
function saksibantuJadwalkanBantu() {
  if (saksibantuKeadaan.jam) return;
  saksibantuKeadaan.jam = setTimeout(async () => {
    saksibantuKeadaan.jam = null;
    if (saksibantuSedang) return;
    saksibantuSedang = true;
    try {
      await saksibantuPeriksa();
    } catch {
      /* bantu saksi diam bila gagal - blangko SIPP tetap seperti biasa */
    } finally {
      saksibantuSedang = false;
    }
  }, 150);
}

saksiscanPasang();
