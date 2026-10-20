"use strict";

/**
 * ============================================================================
 * ISIAN POPUP BLANGKO DERRY YANG DAPAT TERISI OTOMATIS - CERAI, IKRAR, ITSBAT (agen S3, 20 Okt 2026)
 * ============================================================================
 *
 * Melengkapi abtIsianSippLanjutan.js lewat kanal "Isi dari SIPP" yang sama (dariSipp -> usulan). HANYA SELECT ke SIPP,
 * tidak menulis apa pun. Tiap usulan membawa keyakinan (pasti / cukup / ragu), kalimat sumber dan catatan bahasa pengguna
 * (tampil di ikon ⓘ), serta jagaIsianLama: hanya mengisi isian yang kosong - ketikan petugas tidak pernah ditimpa.
 *
 * Sumber terstruktur SIPP (keyakinan pasti/cukup - ditulis sendiri bila saklar "Isi otomatis" menyala):
 *   1154 / 1232 / 5230   nomor surat, tanggal surat, ongkos panggilan permintaan bantuan panggilan  delegasi_keluar (Panggilan Sidang)
 *   1081                 tanggal penetapan hari sidang ikrar yang baru                              perkara_penetapan_kembali_ikrar
 *   8603 / 5110          nama anak                                                                  perkara_anak_pihak
 *   0709 / 0711          hubungan penggugat dan tergugat dengan anak (ibu / bapak kandung)           jenis perkara + adanya anak / petitum anak
 *   7211 / 7212          umur Pemohon I (laki-laki) / II (perempuan) saat menikah                    pihak.tanggal_lahir - tanggal nikah
 * Sumber posita dan petitum di SIPP (keyakinan ragu - hanya saran bertanda "yakin: ragu - periksa"; kecuali disebut lain):
 *   6054 6055 7120 6071 6072 7778 5111 2004   tuntutan accessoir (nafkah iddah, mut'ah, madliyah, nafkah anak, hak asuh) - mesin isiGugatanService
 *                                             yang sama dengan bacaan surat gugatan e-Court, di sini atas posita+petitum SIPP
 *   9711 9712 9713       jumlah nafkah madliyah / iddah / mut'ah menurut tuntutan (yang dituntut, bukan yang dikabulkan)
 *   9715                 "ya" bila posita/petitum menuntut pembayaran sebelum Tergugat mengambil akta cerai
 *   9050                 kenaikan nafkah anak per tahun menurut petitum
 *   7035 8503            yang meninggalkan rumah dan huruf alasan perceraian menurut posita (belum dikuatkan saksi)
 *   9686                 alasan Pemohon itsbat tidak mencatatkan pernikahan
 *
 * Tidak ada nilai yang memuat kata aplikasi ini; semua teks pengguna berbahasa Indonesia.
 */

const { isoKeTampil } = require("./abtIsianSippLanjutan");

const BATAS_PETITUM = 60000;

const diam = (kerja) => {
  try {
    return Promise.resolve(kerja()).catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
};
const satu = (r) => (Array.isArray(r) && r[0]) || null;
const lazy = {
  U: () => require("./abtUsulanService"),
  G: () => require("./isiGugatanService"),
  T: () => require("./tuntutanDeteksiService"),
};

/** Teks polos dari HTML editor SIPP: tag dibuang, penutup paragraf/butir menjadi baris baru. */
function polos(html) {
  return String(html == null ? "" : html)
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*(?:div|p|li|tr|h\d)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/** Satu usulan dalam bentuk yang dikenal panel (sama dengan butir() di abtIsianSippLanjutan.js). */
function butir(kode, nama, nilai, keyakinan, o) {
  const x = o || {};
  const kalimat = x.kalimat ? String(x.kalimat).slice(0, 400) : "";
  return {
    kode,
    nama,
    nilai,
    keyakinan,
    bentrok: "",
    sumber: kalimat ? [{ saksi: 0, asal: x.asal || "sipp", kalimat }] : [],
    catatan: x.catatan || "",
    dihitung: false,
    jagaIsianLama: true,
    kodePola: x.kodePola || "",
  };
}
/** Pengisi menyatakan terus terang bahwa SIPP tidak punya datanya (layar menampilkan "diisi manual" + alasan). */
const tanpaSumber = (kode, nama, alasan) => butir(kode, nama, "", "tidak_ada_sumber", { catatan: alasan });

// ──────────────────────────────────────────────────────────────────────────────
// 1. Delegasi: permintaan bantuan panggilan (relaas [JS] 3.a)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Surat permintaan bantuan panggilan ke pengadilan lain (tab Delegasi SIPP, jenis "Panggilan Sidang"). Yang terbaru dipakai;
 * bila ada beberapa surat, catatan menyebutnya. biaya diisi angka saja: terbilang dan "Rp...,00" dibentuk blangko/ABT sendiri.
 */
function usulanDelegasi(rows) {
  const daftar = (Array.isArray(rows) ? rows : []).filter((r) => r && (String(r.nomor || "").trim() || isoKeTampil(r.tgl)));
  if (!daftar.length) {
    const alasan = "Belum ada surat permintaan bantuan panggilan di tab Delegasi SIPP; isi setelah suratnya dibuat.";
    return [
      tanpaSumber("1154", "Nomor surat permintaan bantuan panggilan", alasan),
      tanpaSumber("1232", "Tanggal surat", alasan),
      tanpaSumber("5230", "Ongkos panggilan permintaan bantuan", alasan),
    ];
  }
  const r = daftar[0];
  const banyak = daftar.length > 1 ? ` Ada ${daftar.length} surat bantuan panggilan di SIPP; yang dipakai surat terbaru.` : "";
  const tujuan = String(r.tujuan || "").trim();
  const dasar = `SIPP delegasi: surat${r.nomor ? ` nomor ${String(r.nomor).trim()}` : ""}${isoKeTampil(r.tgl) ? ` tanggal ${isoKeTampil(r.tgl)}` : ""}${tujuan ? ` kepada ${tujuan}` : ""}`;
  const hasil = [];
  if (String(r.nomor || "").trim()) {
    hasil.push(butir("1154", "Nomor surat permintaan bantuan panggilan", String(r.nomor).trim(), "pasti", { kalimat: dasar, catatan: `Nomor surat dari tab Delegasi SIPP.${banyak}`, kodePola: "sipp-delegasi-nomor" }));
  }
  if (isoKeTampil(r.tgl)) {
    hasil.push(butir("1232", "Tanggal surat", isoKeTampil(r.tgl), "pasti", { kalimat: dasar, catatan: `Tanggal surat dari tab Delegasi SIPP.${banyak}`, kodePola: "sipp-delegasi-tanggal" }));
  }
  const biaya = Math.round(Number(r.biaya));
  if (Number.isFinite(biaya) && biaya > 0) {
    hasil.push(
      butir("5230", "Ongkos panggilan permintaan bantuan", String(biaya), "cukup", {
        kalimat: `${dasar}; biaya Rp${String(biaya).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`,
        catatan: `Biaya dari tab Delegasi SIPP, ditulis angka saja (terbilangnya dibentuk otomatis).${banyak}`,
        kodePola: "sipp-delegasi-biaya",
      })
    );
  }
  return hasil;
}

// ──────────────────────────────────────────────────────────────────────────────
// 2. Ikrar talak: penetapan kembali hari sidang ikrar
// ──────────────────────────────────────────────────────────────────────────────

/** Tanggal PHS baru ikrar talak = tanggal penetapan kembali hari sidang ikrar terbaru (SIPP perkara_penetapan_kembali_ikrar). */
function usulanPhsBaruIkrar(rows) {
  const r = (Array.isArray(rows) ? rows : []).find((x) => x && isoKeTampil(x.penetapan));
  if (!r) return [tanpaSumber("1081", "Tgl. PHS Baru Ikrar Talak", "Belum ada penetapan kembali hari sidang ikrar talak di SIPP; isi setelah penetapannya dibuat.")];
  const tampil = isoKeTampil(r.penetapan);
  return [
    butir("1081", "Tgl. PHS Baru Ikrar Talak", tampil, "cukup", {
      kalimat: `SIPP penetapan kembali hari sidang ikrar: ditetapkan ${tampil}${isoKeTampil(r.sidang) ? ` untuk sidang ${isoKeTampil(r.sidang)}` : ""}`,
      catatan: "Tanggal penetapan kembali hari sidang ikrar talak yang terbaru di SIPP; bila hari sidang ikrar ditetapkan ulang lagi, ganti dengan tanggal yang berlaku.",
      kodePola: "sipp-ikrar-phs-baru",
    }),
  ];
}

// ──────────────────────────────────────────────────────────────────────────────
// 3. Anak
// ──────────────────────────────────────────────────────────────────────────────

/** "A", "A dan B", "A, B dan C". */
function daftarNama(nama) {
  if (nama.length <= 1) return nama.join("");
  return `${nama.slice(0, -1).join(", ")} dan ${nama[nama.length - 1]}`;
}

/** Nama anak dari tab Anak SIPP (perkara_anak_pihak) - 8603 (dipisah koma) dan 5110 (A, B dan C). */
function usulanAnak(rows) {
  const nama = [...new Set((Array.isArray(rows) ? rows : []).map((r) => String((r && r.nama) || "").replace(/\s+/g, " ").trim()).filter(Boolean))];
  if (!nama.length) return [];
  const dasar = `SIPP tab Anak: ${nama.join("; ")}`;
  return [
    butir("8603", "Nama anak yang dimohonkan", nama.join(", "), "cukup", {
      kalimat: dasar,
      catatan: "Nama anak dari tab Anak di SIPP. Bila yang dimohonkan hanya sebagian anak, hapus yang tidak dimohonkan.",
      kodePola: "sipp-anak-nama",
    }),
    butir("5110", "Nama anak", daftarNama(nama), "cukup", {
      kalimat: dasar,
      catatan: "Nama anak dari tab Anak di SIPP. Bila yang dimohonkan hanya sebagian anak, hapus yang tidak dimohonkan.",
      kodePola: "sipp-anak-nama",
    }),
  ];
}

/**
 * 0709 / 0711 pada cerai gugat dan cerai talak: Penggugat/Pemohon-Rekonvensi adalah ibu kandung dan Tergugat/Termohon-Rekonvensi
 * adalah bapak kandung anak (cerai gugat: istri menggugat suami; cerai talak: Termohon istri menggugat balik Pemohon suami).
 * Hanya bila perkara memang menyangkut anak (tab Anak terisi, atau petitum menyebut anak).
 */
function usulanHubunganOrangTua(o) {
  if (!o || !(o.jenis === 346 || o.jenis === 347) || !(o.adaAnak || /\banak\b/i.test(String(o.petitum || "")))) return [];
  const kalimat = o.adaAnak ? "SIPP: ada anak dari perkawinan (tab Anak)" : "Petitum perkara menyebut anak";
  const catatan =
    o.jenis === 347
      ? "Pada cerai gugat Penggugat adalah istri (ibu kandung anak) dan Tergugat adalah suami (bapak kandung anak)."
      : "Pada cerai talak, yang menuntut hak asuh (gugatan rekonvensi) adalah Termohon, istri (ibu kandung anak); Tergugat Rekonvensi adalah Pemohon, suami (bapak kandung anak).";
  return [
    butir("0709", "Hubungan Penggugat (rekonvensi) dengan anak", "ibu kandung", "cukup", { kalimat, catatan, kodePola: "jenis-ibu-kandung" }),
    butir("0711", "Hubungan Tergugat (rekonvensi) dengan anak", "bapak kandung", "cukup", { kalimat, catatan, kodePola: "jenis-bapak-kandung" }),
  ];
}

// ──────────────────────────────────────────────────────────────────────────────
// 4. Itsbat nikah: umur saat menikah dari tanggal lahir di SIPP
// ──────────────────────────────────────────────────────────────────────────────

/** Umur penuh (tahun) pada tanggal tertentu; null bila tanggal tidak sah atau lahir sesudah tanggal itu. */
function umurTahun(lahirIso, pada) {
  const l = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(lahirIso || ""));
  const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(pada || ""));
  if (!l || !p || l[1] === "0000" || l[2] === "00" || l[3] === "00") return null;
  let n = Number(p[1]) - Number(l[1]);
  if (Number(p[2]) < Number(l[2]) || (Number(p[2]) === Number(l[2]) && Number(p[3]) < Number(l[3]))) n -= 1;
  return n >= 0 && n < 120 ? n : null;
}

/**
 * 7211 (Pemohon I laki-laki) dan 7212 (Pemohon II perempuan): umur saat menikah = tanggal nikah - tanggal lahir di data pihak SIPP.
 * Pihak dikenali dari jenis kelamin, bukan urutan. Tanpa tanggal nikah yang pasti, tanpa jenis kelamin yang jelas, atau bila
 * umur yang didapat tidak masuk akal (<10 tahun), isian dilewati.
 */
function usulanUmurItsbat(pihak, tglNikahIso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(tglNikahIso || ""))) return [];
  const hasil = [];
  const L = (Array.isArray(pihak) ? pihak : []).filter((p) => String(p && p.jk).toUpperCase() === "L");
  const P = (Array.isArray(pihak) ? pihak : []).filter((p) => String(p && p.jk).toUpperCase() === "P");
  const buat = (kode, nama, daftar, sebutan) => {
    if (daftar.length !== 1) return; // dua laki-laki / dua perempuan: tidak ditebak
    const n = umurTahun(daftar[0].lahir, tglNikahIso);
    if (n === null || n < 10) return;
    hasil.push(
      butir(kode, nama, `${n} tahun`, "cukup", {
        kalimat: `SIPP data ${sebutan}: lahir ${isoKeTampil(daftar[0].lahir)}; menikah ${isoKeTampil(tglNikahIso)}`,
        catatan: `Dihitung dari tanggal lahir ${sebutan} di data pihak SIPP sampai tanggal nikah (${isoKeTampil(tglNikahIso)}). Bila posita menyebut umur yang berbeda, ikuti dalil permohonan.`,
        kodePola: "sipp-umur-saat-nikah",
      })
    );
  };
  buat("7211", "Umur Pemohon I (laki-laki) saat menikah", L, "pihak laki-laki");
  buat("7212", "Umur Pemohon II (perempuan) saat menikah", P, "pihak perempuan");
  return hasil;
}

// ──────────────────────────────────────────────────────────────────────────────
// 5. Tuntutan accessoir dari posita + petitum SIPP (cerai gugat / cerai talak)
// ──────────────────────────────────────────────────────────────────────────────

const KODE_GUGATAN = Object.freeze(["6055", "6054", "7120", "6071", "6072", "7778", "5111", "2004"]);
const NAMA_JENIS_TUNTUTAN = Object.freeze({ madliyah: "9711", iddah: "9712", mutah: "9713" });

/** "Rp4.500.000,00 (3 bulan x Rp1.500.000,00)" - jumlah dan rincian untuk amar putusan. */
function rincianNafkah(t, T) {
  const n = t.nominal;
  const rp = (x) => T.formatRupiah(x);
  if (!n) return "";
  if (t.jenis === "iddah") {
    const pb = n.perBulan || (n.total ? n.total / 3 : n.nilai);
    return pb ? `${rp(pb * 3)} (3 bulan x ${rp(pb)})` : "";
  }
  if (t.jenis === "madliyah") {
    if (n.perBulan && n.kali) return `${rp(n.perBulan * n.kali)} (${n.kali} bulan x ${rp(n.perBulan)})`;
    return rp(n.total || n.nilai);
  }
  if (t.jenis === "mutah") return `uang sejumlah ${rp(n.nilai)}`;
  return "";
}

/**
 * Posita+petitum SIPP dijalankan lewat isiGugatanService (aturan yang sama dengan bacaan surat gugatan e-Court). Semua hasil "ragu":
 * yang dibaca adalah tuntutan, bukan yang dikabulkan. 5110 (nama anak) tidak diambil di sini - tab Anak SIPP lebih pasti.
 * -> { usulan, tuntutan }
 */
function usulanDariGugatanSipp(o) {
  const posita = polos(o.posita);
  const petitum = polos(o.petitum).slice(0, BATAS_PETITUM);
  if (posita.length < 40 || petitum.length < 20) return { usulan: [], tuntutan: [] };
  const G = lazy.G();
  const T = lazy.T();
  const ct = o.jenis === 346;
  const sebutan = { lawan: ct ? "Pemohon" : "Penggugat", pelaku: ct ? "Termohon" : "Tergugat" };
  let h;
  try {
    h = G.susunIsiGugatan({ dokumen: [{ judul: "Posita dan petitum di SIPP", peran: "gugatan", teks: `${posita}\n\nPETITUM\n${petitum}`, baca: "teks" }], sebutan });
  } catch {
    return { usulan: [], tuntutan: [] };
  }
  const usulan = [];
  for (const u of (h && h.usulan) || []) {
    if (!KODE_GUGATAN.includes(String(u.kode)) || !String(u.nilai || "").trim()) continue;
    usulan.push({
      ...u,
      keyakinan: "ragu",
      sumber: (u.sumber || []).map((s) => ({ ...s, asal: "posita-gugatan", kalimat: String(s.kalimat || "").replace(/^e-Court: Posita dan petitum di SIPP\s*-\s*/, "Posita/petitum di SIPP - ") })),
      jagaIsianLama: true,
    });
  }
  // Jumlah untuk amar putusan (nafkah madliyah, iddah, mut'ah cerai gugat): yang DITUNTUT; besaran yang dikabulkan diputus majelis.
  for (const t of (h && h.tuntutan) || []) {
    const kode = NAMA_JENIS_TUNTUTAN[t.jenis];
    if (!kode || t.rekonvensi === true && o.jenis === 347 || t.untukAnak) continue;
    const nilai = rincianNafkah(t, T);
    if (!nilai || usulan.some((u) => u.kode === kode)) continue;
    usulan.push(
      butir(kode, `${t.label || t.jenis} yang dituntut`, nilai, "ragu", {
        asal: "posita-gugatan",
        kalimat: `Posita/petitum di SIPP - "${String(t.kutipan || "").slice(0, 260)}"`,
        catatan: "Yang diisikan adalah jumlah yang DITUNTUT di petitum; besaran yang dikabulkan diputus majelis - sesuaikan dengan amar.",
        kodePola: `petitum-${t.jenis}`,
      })
    );
  }
  return { usulan, tuntutan: (h && h.tuntutan) || [] };
}

const ANGKA_KATA = { 5: "lima", 10: "sepuluh", 15: "lima belas", 20: "dua puluh", 25: "dua puluh lima" };
/** 9050: kenaikan nafkah anak per tahun menurut petitum ("naik 10% setiap tahun"). -> {nilai, kalimat} | null */
function kenaikanNafkahAnak(petitumPolos) {
  const t = String(petitumPolos || "").replace(/\s+/g, " ");
  const m =
    /(?:kenaikan|penambahan|naik|bertambah|peningkatan)[^.;]{0,90}?(\d{1,2})\s*(?:\([^)]*\)\s*)?(?:%|persen)[^.;]{0,50}?(?:per\s+tahun|setiap\s+tahun|tiap\s+tahun|setahun|pertahun)/i.exec(t) ||
    /(\d{1,2})\s*(?:\([^)]*\)\s*)?(?:%|persen)[^.;]{0,60}?(?:per\s+tahun|setiap\s+tahun|tiap\s+tahun|pertahun)[^.;]{0,60}?(?:kenaikan|penambahan|naik|nafkah)/i.exec(t);
  if (!m) return null;
  const n = Number(m[1]);
  if (!(n >= 1 && n <= 50)) return null;
  const T = lazy.T();
  const kata = ANGKA_KATA[n] || (typeof T.terbilang === "function" ? T.terbilang(n) : "");
  return { nilai: kata ? `${n}% (${kata} persen)` : `${n}%`, kalimat: t.slice(Math.max(0, m.index - 20), m.index + m[0].length + 20) };
}

/** 9715: petitum/posita menuntut nafkah dibayar SEBELUM Tergugat mengambil akta cerai. */
function bayarSebelumAktaCerai(teksPolos) {
  const t = String(teksPolos || "").replace(/\s+/g, " ");
  const m = /(?:sebelum|sebelumnya)\b[^.;]{0,90}?(?:mengambil|pengambilan|mengambilnya|menerima)[^.;]{0,40}?akta\s+cerai|akta\s+cerai[^.;]{0,50}?(?:setelah|sesudah)[^.;]{0,50}?(?:membayar|dibayar|lunas|melunasi)/i.exec(t);
  return m ? { kalimat: t.slice(Math.max(0, m.index - 30), m.index + m[0].length + 20) } : null;
}

// ──────────────────────────────────────────────────────────────────────────────
// 6. Cerai: fakta dari posita yang belum dikuatkan saksi (7035, 8503)
// ──────────────────────────────────────────────────────────────────────────────

/** 7035: pihak yang meninggalkan rumah kediaman bersama menurut posita (siapaPergiPosita). Selalu "ragu": belum dikuatkan saksi. */
function usulanPergiDariPosita(posita, jenis) {
  const U = lazy.U();
  let r;
  try {
    r = U.siapaPergiPosita(U.kalimatPosita(posita));
  } catch {
    return [];
  }
  if (!r || !r.sisi) return [];
  const ct = jenis === 346;
  const pelaku = ct ? "Termohon" : "Tergugat";
  const lawan = ct ? "Pemohon" : "Penggugat";
  const nilai = r.sisi === "pelaku" ? pelaku : lawan;
  return [
    butir("7035", "Yang meninggalkan rumah bersama", nilai, "ragu", {
      asal: "posita-gugatan",
      kalimat: r.kalimat,
      catatan: `Menurut posita, ${nilai} yang meninggalkan rumah kediaman bersama. Ini dalil ${lawan}; kuatkan dengan keterangan saksi di sidang.`,
      kodePola: "posita-siapa-pergi",
    }),
  ];
}

/** 8503: huruf alasan perceraian yang tampak dari posita (saran saja - keputusan hakim). Mis. "F", "AF", "DF". */
function usulanHurufDariPosita(posita, jenis) {
  const U = lazy.U();
  const A = require("./deteksiAlasanService");
  let ringkas;
  try {
    const butirPosita = U.kalimatPositaSambung ? U.kalimatPositaSambung(posita) : U.kalimatPosita(posita);
    if (!butirPosita.length) return [];
    const ct = jenis === 346;
    const hasil = A.deteksiPerkara({ b1: [], b2: [], butirPosita, pihak: { pelaku: ct ? "Termohon" : "Tergugat", lawan: ct ? "Pemohon" : "Penggugat" }, lamaPisahBulan: null });
    ringkas = (hasil.huruf || []).filter((x) => x.didalilkan === true);
  } catch {
    return [];
  }
  let huruf = [...new Set(ringkas.map((x) => x.huruf))].filter((h) => "ACDEFGH".includes(h));
  // Posita yang menyangkal ada perselisihan ("tidak pernah terjadi perselisihan dan pertengkaran") bukan dalil huruf F.
  if (/tidak\s+pernah\s+(?:ada\s+|terjadi\s+)?(?:perselisihan|pertengkaran)/i.test(polos(posita))) huruf = huruf.filter((h) => h !== "F");
  if (!huruf.length) return [];
  const nilai = huruf.sort().join("");
  return [
    butir("8503", "Alasan perceraian", nilai, "ragu", {
      asal: "posita-gugatan",
      kalimat: `Posita menyebut peristiwa yang termasuk huruf ${huruf.join(", ")}`,
      catatan: "Huruf alasan perceraian adalah keputusan hakim. Yang tampil hanya huruf yang didalilkan posita; periksa dengan keterangan saksi dan pertimbangan majelis sebelum dipakai.",
      kodePola: "posita-huruf-alasan",
    }),
  ];
}

// ──────────────────────────────────────────────────────────────────────────────
// 7. Itsbat: alasan pernikahan tidak dicatatkan (9686)
// ──────────────────────────────────────────────────────────────────────────────

/** "tidak dicatatkan ... karena X" pada posita itsbat -> X sebagai alasan Pemohon. -> {nilai, kalimat} | null */
function alasanTidakDicatat(posita) {
  const U = lazy.U();
  let butirPosita = [];
  try {
    butirPosita = U.kalimatPosita(posita);
  } catch {
    return null;
  }
  for (const b of butirPosita) {
    const t = String(b).replace(/\s+/g, " ").trim();
    if (!/tidak\s+(?:dicatat|terdaftar|tercatat|didaftarkan|dicatatkan)|belum\s+(?:dicatat|didaftarkan|terdaftar)/i.test(t)) continue;
    const m = /(?:karena|dikarenakan|disebabkan(?:\s+oleh)?|lantaran|sebab)\s+(.{8,260}?)(?:\s*(?:,|;)?\s*(?:sehingga|sementara|dan\s+(?:saat|sekarang|kini)|oleh\s+karena)\b|[;.]|$)/i.exec(t);
    if (!m) continue;
    let nilai = m[1].replace(/^bahwa\s+/i, "").replace(/[\s,;.]+$/, "").trim();
    if (nilai.length < 8) continue;
    nilai = nilai.charAt(0).toLowerCase() + nilai.slice(1);
    return { nilai, kalimat: t.slice(0, 400) };
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Perangkai
// ──────────────────────────────────────────────────────────────────────────────

const JENIS = Object.freeze({ cerai: [346, 347], itsbat: [360] });

/**
 * Semua usulan lengkap satu perkara. `runQuery(sql, params)` = pembaca SIPP baca-saja milik abtUsulanService.
 * Kegagalan satu pembacaan tidak menggagalkan yang lain.
 */
async function usulanLengkap(perkaraId, runQuery) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0 || typeof runQuery !== "function") return [];
  const perkara = satu(
    await diam(() =>
      runQuery(
        "SELECT jenis_perkara_id AS jenis, alur_perkara_id AS alur, posita, petitum FROM perkara WHERE perkara_id = ? LIMIT 1",
        [id]
      )
    )
  );
  if (!perkara) return [];
  const jenis = Number(perkara.jenis);
  const cerai = JENIS.cerai.includes(jenis);
  const itsbat = JENIS.itsbat.includes(jenis);
  if (!cerai && !itsbat) return [];

  const [delegasi, kembaliIkrar, anak, pihak] = await Promise.all([
    diam(() =>
      runQuery(
        `SELECT nomor_surat AS nomor, DATE_FORMAT(tgl_surat, '%Y-%m-%d') AS tgl, biaya, pn_tujuan_text AS tujuan
           FROM delegasi_keluar WHERE perkara_id = ? AND id_jenis_delegasi = 1 ORDER BY tgl_surat DESC, id DESC LIMIT 5`,
        [id]
      )
    ),
    jenis === 346
      ? diam(() =>
          runQuery(
            `SELECT DATE_FORMAT(tanggal_penetapan, '%Y-%m-%d') AS penetapan, DATE_FORMAT(tanggal_sidang, '%Y-%m-%d') AS sidang
               FROM perkara_penetapan_kembali_ikrar WHERE perkara_id = ? ORDER BY tanggal_penetapan DESC, id DESC LIMIT 3`,
            [id]
          )
        )
      : null,
    cerai ? diam(() => runQuery("SELECT nama_anak AS nama FROM perkara_anak_pihak WHERE perkara_id = ? AND nama_anak IS NOT NULL AND TRIM(nama_anak) <> '' ORDER BY anak_ke, id", [id])) : null,
    itsbat
      ? diam(() =>
          runQuery(
            `SELECT pp.urutan, pe.jenis_kelamin AS jk, DATE_FORMAT(pe.tanggal_lahir, '%Y-%m-%d') AS lahir
               FROM perkara_pihak1 pp JOIN pihak pe ON pe.id = pp.pihak_id WHERE pp.perkara_id = ? ORDER BY pp.urutan`,
            [id]
          )
        )
      : null,
  ]);

  const hasil = [];
  const tambah = (daftar) => {
    for (const u of daftar || []) if (u && u.kode && !hasil.some((x) => x.kode === u.kode)) hasil.push(u);
  };
  tambah(usulanDelegasi(delegasi));
  if (cerai) {
    const dataAnak = Array.isArray(anak) ? anak : [];
    if (jenis === 346) tambah(usulanPhsBaruIkrar(kembaliIkrar));
    tambah(usulanAnak(dataAnak));
    tambah(usulanHubunganOrangTua({ jenis, adaAnak: dataAnak.length > 0, petitum: polos(perkara.petitum) }));
    const g = usulanDariGugatanSipp({ jenis, posita: perkara.posita, petitum: perkara.petitum });
    tambah(g.usulan);
    const petitumPolos = polos(perkara.petitum);
    const semuaTeks = `${polos(perkara.posita)}\n${petitumPolos}`;
    if (jenis === 347) {
      const bayar = bayarSebelumAktaCerai(semuaTeks);
      if (bayar) {
        tambah([
          butir("9715", "Nafkah istri dibayar sebelum Tergugat mengambil akta cerai", "ya", "cukup", {
            asal: "posita-gugatan",
            kalimat: bayar.kalimat,
            catatan: "Posita/petitum menuntut nafkah dibayar sebelum Tergugat mengambil akta cerai (terisi \"ya\"). Hapus bila tidak dikabulkan.",
            kodePola: "petitum-bayar-sebelum-akta-cerai",
          }),
        ]);
      }
    }
    const naik = kenaikanNafkahAnak(petitumPolos);
    if (naik) {
      tambah([
        butir("9050", "Kenaikan nafkah anak per tahun", naik.nilai, "cukup", {
          asal: "posita-gugatan",
          kalimat: naik.kalimat,
          catatan: "Kenaikan nafkah anak per tahun menurut petitum. Besaran yang dikabulkan diputus majelis (SEMA 3/2015: 10% s.d. 20% per tahun).",
          kodePola: "petitum-kenaikan-nafkah-anak",
        }),
      ]);
    }
    tambah(usulanPergiDariPosita(perkara.posita, jenis));
    tambah(usulanHurufDariPosita(perkara.posita, jenis));
  }
  if (itsbat) {
    // Tanggal nikah yang pasti: data pernikahan SIPP, atau kalimat pernikahan di posita (sama dengan 5197).
    let tglNikah = "";
    try {
      const U = lazy.U();
      const u5197 = (await diam(() => U.usulanTanggalNikahSipp(id))) || [];
      const t = (Array.isArray(u5197) ? u5197 : []).find((x) => x && x.kode === "5197" && x.nilai);
      tglNikah = t ? ketanggalIso(t.nilai) : "";
    } catch {
      tglNikah = "";
    }
    tambah(usulanUmurItsbat(Array.isArray(pihak) ? pihak : [], tglNikah));
    const alasan = alasanTidakDicatat(perkara.posita);
    if (alasan) {
      tambah([
        butir("9686", "Alasan Pemohon tidak mencatatkan pernikahan", alasan.nilai, "ragu", {
          asal: "posita-gugatan",
          kalimat: alasan.kalimat,
          catatan: "Alasan pernikahan tidak dicatatkan menurut dalil permohonan; periksa dengan keterangan saksi dan bukti.",
          kodePola: "posita-alasan-tidak-dicatat",
        }),
      ]);
    }
  }
  return hasil;
}

const BULAN = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember", "pebruari", "nopember"];
/** "17 November 2025" / "17/11/2025" / "2025-11-17" -> "2025-11-17"; "" bila tidak terbaca. */
function ketanggalIso(teks) {
  const t = String(teks || "").trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return t;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = /^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})$/.exec(t);
  if (m) {
    let i = BULAN.indexOf(m[2].toLowerCase());
    if (i === 12) i = 1;
    if (i === 13) i = 10;
    if (i >= 0) return `${m[3]}-${String(i + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return "";
}

module.exports = {
  polos,
  usulanDelegasi,
  usulanPhsBaruIkrar,
  usulanAnak,
  usulanHubunganOrangTua,
  umurTahun,
  usulanUmurItsbat,
  rincianNafkah,
  usulanDariGugatanSipp,
  kenaikanNafkahAnak,
  bayarSebelumAktaCerai,
  usulanPergiDariPosita,
  usulanHurufDariPosita,
  alasanTidakDicatat,
  ketanggalIso,
  usulanLengkap,
};
