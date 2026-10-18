"use strict";

/**
 * ============================================================================
 * B2 (10 Okt 2026, agen 3) - ISI DARI e-COURT KE ABT (USULAN)
 * ============================================================================
 *
 * Portal membaca berkas gugatan / jawaban / replik / duplik dari arsip e-Court
 * ALETA (kebenaran berkasnya di aleta_bot_ecourt_files - bukan kolom cermin
 * berkas_pdf/word yang basi) lalu mengirim TEKSNYA ke sini. Di sini teks itu
 * menjadi:
 *
 *   tuntutan  tuntutan accessoir per pihak (P4) - tuntutanDeteksiService
 *   anak      nama, umur, tanggal lahir anak (data yang tidak dicatat SIPP)
 *   jawab     ringkasan tiap jawaban/replik/duplik + dalil diakui/dibantah
 *   usulan    kartu panel "Isi dari SIPP & input ke ABT": variabel ABT
 *             (6055, 6054, 7120, 6071, 6072, 7778, 5110, 5111, 0007, 2004,
 *             7084, 9881) + bunyi pilihan 5227 - sumber "gugatan-ecourt"
 *             dengan kutipan "e-Court: <judul> hal. n"
 *   kalimat   rangkaian kata hakim (P7) untuk disalin/disunting
 *
 * JJ (18 Okt 2026): jawab-menjawab TERTULIS. Jawaban, replik, duplik, rereplik, dan kesimpulan kini diunggah ke e-Court.
 * jawabMenjawabEcourtService mengenali jenis berkasnya dari jenis/judul e-Court DAN isi suratnya (daftar bukti yang
 * diunggah sebagai "Kesimpulan" dikeluarkan), membuang kop/salam/identitas/penutup, lalu mengisi 9881 (tertulis), 7084
 * (hanya bila jawaban jelas memuat gugatan balik), 8436/8437 (kesimpulan), 9355/9491/9681 (pokok jawaban & eksepsi) -
 * semuanya jagaIsianLama dan ragu kecuali 9881 - dan menambah butir yang dapat disalin ke bagian kalimat.
 *
 * TIDAK menulis apa pun. Keyakinan: tuntutan, nominal, anak = "ragu" (tidak
 * dicentang sendiri; hasil ukur di hasil-agen3.md di bawah 95%). Hanya 9881
 * ("tertulis" - jawaban memang diunggah sebagai berkas e-Court) "cukup".
 * Nominal yang DITUNTUT bukan yang DIKABULKAN - tiap kartu menyebutnya.
 */

const T = require("./tuntutanDeteksiService");
const K = require("./kalimatHakimService");
const U = require("./abtUsulanService");
const J = require("./jawabMenjawabEcourtService");

const VAR = Object.freeze({
  mutah: "6055",
  iddah: "6054",
  madliyah: "7120",
  nafkahAnak: "6071",
  nafkahPerAnak: "6072",
  hadhanah: "7778",
  namaAnak: "5110",
  umurAnak: "5111",
  dikaruniai: "0007",
  diasuhOleh: "2004",
  rekonvensi: "7084",
  lisanTertulis: "9881",
  alasan: "5227",
  // 18 Okt 2026 (keputusan 14): saklar "petitum meminta penyerahan anak" blangko Penguasaan Anak (jenis 349, folder 6b).
  // 1 = petitum memintanya; 0 = tidak (amar+pertimbangan penyerahan tidak tercetak, anti ultra petita). PEMETAAN-ALETA i20: #9720#.
  penyerahanAnak: "9720",
});

const BATAS_TEKS = 400000;
const PERAN_SAH = new Set(["gugatan", "jawaban", "replik", "duplik", "kesimpulan", "rekonvensi"]);

/** Masukan dari portal (sudah disaring portal; disaring sekali lagi di sini). */
function saringDokumen(dokumen) {
  let sisa = BATAS_TEKS;
  const hasil = [];
  // JJ 18 Okt: sampai 12 berkas (satu gugatan + jawaban, replik, duplik, rereplik, kesimpulan kedua pihak).
  for (const d of Array.isArray(dokumen) ? dokumen.slice(0, 12) : []) {
    if (!d || typeof d !== "object") continue;
    const peran = PERAN_SAH.has(String(d.peran)) ? String(d.peran) : "gugatan";
    const teks = String(d.teks || "").slice(0, Math.max(0, sisa));
    sisa -= teks.length;
    if (teks.trim().length < 40) continue;
    hasil.push({
      judul: String(d.judul || "dokumen e-Court").replace(/[\r\n]+/g, " ").slice(0, 160),
      peran,
      teks,
      baca: d.baca === "ocr" ? "ocr" : "teks",
      penuntutKode: d.penuntutKode === "0046" || d.penuntutKode === "0047" ? d.penuntutKode : "",
      rekonvensi: d.rekonvensi === "ada" ? "ada" : d.rekonvensi === "tidak" ? "tidak" : "",
      // Jenis dokumen & pengunggah menurut e-Court: dasar pengenalan jawaban/replik/duplik/kesimpulan (jawabMenjawabEcourtService).
      jenis: String(d.jenis || "").replace(/[\r\n]+/g, " ").slice(0, 60),
      pengunggah: String(d.pengunggah || "").replace(/[\r\n]+/g, " ").slice(0, 60),
    });
  }
  return hasil;
}

function labelSumber(dok, halaman) {
  return `e-Court: ${dok.judul}${halaman ? ` hal. ${halaman}` : ""}${dok.baca === "ocr" ? " (dibaca OCR)" : ""}`;
}

function sumberDari(dok, kutipan, halaman) {
  return [{ asal: "gugatan-ecourt", kalimat: `${labelSumber(dok, halaman)} - "${String(kutipan || "").slice(0, 260)}"` }];
}

function sebutanPihak(kode, sebutan) {
  return kode === "0046" ? (sebutan && sebutan.lawan) || "Penggugat" : (sebutan && sebutan.pelaku) || "Tergugat";
}

/** Bagian posita surat gugatan (sebelum petitum) - sumber ciri alasan, anak, waktu. */
function positaDari(teks) {
  const rapi = T.rapikanTeks(teks);
  const { petitum } = T.bagianDokumen(T.datarkan(rapi));
  return petitum.length ? rapi.slice(0, petitum[0][0]) : rapi;
}

/** Bagian PETITUM surat gugatan (dari penanda petitum sampai akhir); "" bila petitumnya tidak terbaca. */
function petitumDari(teks) {
  const rapi = T.rapikanTeks(teks);
  const { petitum } = T.bagianDokumen(T.datarkan(rapi));
  return petitum.length ? rapi.slice(petitum[0][0]) : "";
}

/** Petitum yang meminta anak diserahkan (Tergugat menyerahkan anak / penyerahan anak / anak diserahkan kepada Penggugat). */
const POLA_PENYERAHAN_ANAK =
  /(?:menyerahkan|mengembalikan)\s+(?:kembali\s+)?(?:\S+\s+){0,8}?anak|penyerahan\s+(?:kembali\s+)?(?:\S+\s+){0,5}?anak|anak\b[^.;\n]{0,100}?\b(?:diserahkan|dikembalikan)\b/i;

/**
 * Saklar #9720#: nilai "1"/"0" dari petitum gugatan. null bila petitum tidak terbaca atau tidak menyangkut anak sama sekali
 * (jangan menebak "0" dari teks yang bukan petitum - itu akan menghapus amar penyerahan dari putusan).
 */
function saklarPenyerahanAnak(teksGugatan) {
  const petitum = petitumDari(teksGugatan);
  if (!petitum || !/\banak\b/i.test(petitum)) return null;
  const m = POLA_PENYERAHAN_ANAK.exec(petitum);
  return { nilai: m ? "1" : "0", kutipan: m ? petitum.slice(Math.max(0, m.index - 40), m.index + m[0].length + 80).replace(/\s+/g, " ").trim() : "Petitum menyangkut anak tetapi tidak meminta penyerahan anak." };
}

const ANGKA_KATA = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh"];

function bunyiDikaruniai(nilai) {
  if (!nilai) return "";
  if (/belum/.test(nilai)) return "belum dikaruniai anak";
  const n = Number((/(\d+)/.exec(nilai) || [])[1]);
  if (!n) return "";
  if (n === 1) return "telah dikaruniai seorang anak";
  return `telah dikaruniai ${n} (${ANGKA_KATA[n] || T.terbilang(n)}) orang anak`;
}

/**
 * @param {object} masukan
 *   dokumen   [{judul, peran, teks, baca, penuntutKode, rekonvensi}]
 *   sebutan   {lawan: 0046, pelaku: 0047}
 *   majelis   "Majelis Hakim" | "Hakim" (opsional)
 */
function susunIsiGugatan(masukan) {
  const m = masukan || {};
  const sebutan = { lawan: String((m.sebutan && m.sebutan.lawan) || "").slice(0, 40) || "Penggugat", pelaku: String((m.sebutan && m.sebutan.pelaku) || "").slice(0, 40) || "Tergugat" };
  const dokumen = saringDokumen(m.dokumen);
  const catatan = [];
  if (!dokumen.length) return { ok: true, ada: false, tuntutan: [], anak: [], jawab: [], usulan: [], kalimat: [], diabaikan: [], catatan: ["Tidak ada teks berkas e-Court yang terbaca."] };

  // ── Tuntutan per dokumen, lalu digabung ──
  const semua = [];
  const diabaikan = [];
  for (const d of dokumen) {
    const h = T.deteksiTuntutan(d.teks, { peran: d.peran, sebutan, penuntutKode: d.penuntutKode });
    for (const t of h.tuntutan) semua.push({ ...t, dok: d });
    for (const x of h.diabaikan) diabaikan.push({ ...x, judul: d.judul });
  }
  const URUT_DOK = { gugatan: 0, jawaban: 1, rekonvensi: 1, replik: 2, duplik: 3, kesimpulan: 4 };
  const perKunci = new Map();
  for (const t of semua) {
    const k = `${t.jenis}|${t.penuntutKode}|${t.jenis === "madliyah" && t.untukAnak ? "anak" : ""}`;
    const lama = perKunci.get(k);
    const bobot = (x) => (x.diPetitum ? 8 : 0) + (x.nominal || x.benda ? 4 : 0) - URUT_DOK[x.dok.peran];
    if (!lama || bobot(t) > bobot(lama)) perKunci.set(k, { ...t, dariDokumenLain: lama ? [...(lama.dariDokumenLain || []), lama.dok.judul] : [] });
    else lama.dariDokumenLain = [...(lama.dariDokumenLain || []), t.dok.judul];
  }
  const tuntutan = [...perKunci.values()].sort((a, b) => T.URUT_JENIS.indexOf(a.jenis) - T.URUT_JENIS.indexOf(b.jenis));

  // ── Anak ──
  const gugatan = dokumen.find((d) => d.peran === "gugatan") || null;
  const anak = [];
  const kenal = new Set();
  for (const d of [gugatan, ...dokumen.filter((x) => x !== gugatan)].filter(Boolean)) {
    for (const a of T.anakDari(d.teks)) {
      const k = a.nama.split(/\s+(?:bin|binti)\s+/i)[0].toLowerCase().replace(/[^a-z]/g, "");
      if (kenal.has(k)) continue;
      kenal.add(k);
      anak.push({ ...a, dok: d });
    }
  }

  // ── Fakta posita ──
  const posita = gugatan ? positaDari(gugatan.teks) : "";
  const butir = posita ? U.kalimatPosita(posita) : [];
  const jumlahAnak = butir.length ? U.jumlahAnakPosita(butir) : { nilai: "", kalimat: "" };
  const ikut = butir.length ? U.anakIkutPosita(butir) : "";
  const ciri = posita ? U.alasanDariPosita(posita) : [];

  // ── Jawab-menjawab (JJ 18 Okt: jenis dikenali dari jenis/judul e-Court DAN isi surat) ──
  const jm = J.susunJawabMenjawab({ dokumen, sebutan });
  const infoJm = new Map(jm.dokumen.map((x) => [dokumen[x.indeks], x]));
  const jawab = dokumen
    .filter((d) => d.peran !== "gugatan")
    .filter((d) => {
      // Daftar bukti / surat gugatan yang diunggah sebagai "Kesimpulan" atau "Jawaban" bukan jawab-menjawab.
      const i = infoJm.get(d);
      return !(i && i.dipakai === false);
    })
    .map((d) => {
      const sikap = T.sikapJawaban(d.teks);
      const rapi = T.rapikanTeks(d.teks).replace(/[\f\s]+/g, " ").trim();
      const mulai = rapi.search(/\b(?:DALAM\s+KONVENSI|Dalam\s+Pokok\s+Perkara|Bahwa)\b/);
      const i = infoJm.get(d) || null;
      return {
        judul: d.judul,
        peran: i && i.peran ? i.peran : d.peran,
        baca: d.baca,
        // Pokok bersih (tanpa kop, salam, identitas, penutup) bila terbaca; selain itu awal teks seperti semula.
        ringkas: i && i.butir && i.butir.length ? i.butir.join("; ").slice(0, 700) : rapi.slice(Math.max(0, mulai), Math.max(0, mulai) + 700),
        butir: i ? i.butir : [],
        pihak: i ? i.pihak : "",
        ragu: i ? i.ragu : true,
        catatan: i ? i.catatan : [],
        diakui: sikap.diakui,
        dibantah: sikap.dibantah,
        rekonvensi: i && i.rekonvensi ? i.rekonvensi : d.rekonvensi || (T.bagianDokumen(T.datarkan(T.rapikanTeks(d.teks))).rekonvensi >= 0 ? "ada" : "tidak"),
        tuntutan: tuntutan.filter((t) => t.dok === d).length,
      };
    });

  // ── Usulan kartu ──
  const usulan = [];
  const CATATAN_NOMINAL = (t) =>
    `Nominal yang DITUNTUT ${sebutanPihak(t.penuntutKode, sebutan)}${t.rekonvensi ? " (rekonvensi)" : ""} - besaran yang dikabulkan diputus majelis; sunting sesuai amar.` +
    (t.nominal && t.nominal.cocokTerbilang === false ? ` Angka dan terbilang di berkas BERBEDA (${T.formatRupiah(t.nominal.nilai)} lawan "${t.nominal.terbilang}") - periksa.` : "") +
    (t.gabungan ? " Satu nominal di berkas untuk beberapa tuntutan sekaligus - pisahkan." : "") +
    (t.jenis === "iddah" && t.nominal && K.iddahTigaBulan(t.nominal) && K.iddahTigaBulan(t.nominal).catatan ? ` ${K.iddahTigaBulan(t.nominal).catatan}` : "");
  const tambah = (kode, nama, nilai, t, catatanKhusus, keyakinan) => {
    if (!nilai) return;
    usulan.push({
      kode,
      nama,
      nilai,
      keyakinan: keyakinan || "ragu",
      bentrok: "",
      sumber: sumberDari(t.dok, t.kutipan, t.halaman),
      catatan: catatanKhusus,
      // Jejak koreksi (D2): kode pola kamus yang memicu usulan ini.
      kodePola: t.kodePola || "",
    });
  };
  const ambil = (jenis, syarat) => tuntutan.find((t) => t.jenis === jenis && (!syarat || syarat(t)));
  const mutah = ambil("mutah");
  if (mutah) tambah(VAR.mutah, "Mut'ah", K.nilaiAbtTuntutan(mutah), mutah, mutah.nominal ? CATATAN_NOMINAL(mutah) : "Mut'ah berupa benda menurut berkas - periksa uraiannya.");
  const iddah = ambil("iddah");
  if (iddah) tambah(VAR.iddah, "Nafkah iddah", K.nilaiAbtTuntutan(iddah), iddah, CATATAN_NOMINAL(iddah));
  const madliyah = ambil("madliyah", (t) => !t.untukAnak);
  if (madliyah) tambah(VAR.madliyah, "Nafkah Lampau (Madliyah)", K.nilaiAbtTuntutan(madliyah), madliyah, CATATAN_NOMINAL(madliyah));
  const nafkahAnak = ambil("nafkah-anak");
  if (nafkahAnak) {
    const perAnak = /\b(?:masing-masing|tiap|setiap)\s+(?:orang\s+)?anak\b|\buntuk\s+(?:tiap|setiap)\s+anak/i.test(nafkahAnak.kutipan);
    tambah(perAnak ? VAR.nafkahPerAnak : VAR.nafkahAnak, perAnak ? "Nafkah anak (masing-masing anak)" : "Nafkah Anak", K.nilaiAbtTuntutan(nafkahAnak), nafkahAnak, CATATAN_NOMINAL(nafkahAnak));
  }
  const hadhanah = ambil("hadhanah");
  if (hadhanah) {
    tambah(VAR.hadhanah, "HADHANAH (Apabila Ada Ketik : 1)", "1", hadhanah, `Hak asuh dituntut ${sebutanPihak(hadhanah.penuntutKode, sebutan)}${anak.length ? ` atas ${anak.map((a) => a.nama).join(", ")}` : ""} - menandai bagian hadhanah di blangko.`);
  }
  // Saklar penyerahan anak (#9720#): hanya dari petitum SURAT GUGATAN; terisi otomatis (cukup), isian manual menang.
  const dokGugatan = dokumen.find((d) => d.peran === "gugatan");
  const saklarAnak = dokGugatan ? saklarPenyerahanAnak(dokGugatan.teks) : null;
  if (saklarAnak) {
    usulan.push({
      kode: VAR.penyerahanAnak,
      nama: "Petitum meminta penyerahan anak (saklar)",
      nilai: saklarAnak.nilai,
      keyakinan: "cukup",
      bentrok: "",
      sumber: sumberDari(dokGugatan, saklarAnak.kutipan, null),
      kodePola: "gugatan-petitum-penyerahan-anak",
      catatan: saklarAnak.nilai === "1" ? "Petitum gugatan meminta penyerahan anak - amar dan pertimbangan penyerahan tercetak." : "Petitum tidak meminta penyerahan anak - amar dan pertimbangan penyerahan tidak tercetak (anti ultra petita).",
      jagaIsianLama: true,
    });
  }
  if (anak.length) {
    const a0 = anak[0];
    const nama = anak.length === 1 ? a0.nama : `${anak.slice(0, -1).map((a) => a.nama).join(", ")} dan ${anak[anak.length - 1].nama}`;
    usulan.push({ kode: VAR.namaAnak, nama: "Nama anak", nilai: nama, keyakinan: "ragu", bentrok: "", sumber: sumberDari(a0.dok, a0.kutipan, a0.halaman), kodePola: "gugatan-anak-wilayah", catatan: `${anak.length} anak terbaca dari berkas e-Court - periksa ejaan nama dengan akta kelahiran.` });
    const umur = anak.filter((a) => a.umur);
    if (umur.length === anak.length) {
      usulan.push({
        kode: VAR.umurAnak,
        nama: "Umur anak",
        nilai: anak.length === 1 ? a0.umur : anak.map((a) => `${a.nama.split(/\s+(?:bin|binti)\s+/i)[0]} ${a.umur}`).join(", "),
        keyakinan: "ragu",
        bentrok: "",
        sumber: sumberDari(a0.dok, a0.kutipan, a0.halaman),
        kodePola: "gugatan-anak-umur",
        catatan: "Umur saat berkas dibuat - hitung ulang pada hari putusan.",
      });
    }
  }
  if (jumlahAnak.nilai && gugatan) {
    usulan.push({ kode: VAR.dikaruniai, nama: "Telah Dikarunai Anak", nilai: bunyiDikaruniai(jumlahAnak.nilai), keyakinan: "ragu", bentrok: "", sumber: sumberDari(gugatan, jumlahAnak.kalimat, null), kodePola: "", catatan: "Dari posita surat gugatan e-Court (ukur 10 Okt atas posita SIPP: 540 dari 578 sama dengan isian petugas, 93,4%)." });
  }
  if (ikut && gugatan) {
    usulan.push({ kode: VAR.diasuhOleh, nama: "kini anak tersebut diasuh oleh", nilai: ikut === "pelaku" ? sebutan.pelaku : sebutan.lawan, keyakinan: "ragu", bentrok: "", sumber: sumberDari(gugatan, butir.find((b) => /anak/i.test(b) && /(?:tinggal|ikut|asuh|pelihara)/i.test(b)) || "", null), kodePola: "", catatan: "Dari posita surat gugatan e-Court." });
  }
  // JJ 18 Okt: 9881 (tertulis), 7084 (rekonvensi - hanya dari jawaban yang jelas memuat gugatan balik), 8436/8437
  // (kesimpulan), 9355/9491/9681 (pokok jawaban & eksepsi) dari jawabMenjawabEcourtService. Semua jagaIsianLama.
  usulan.push(...jm.usulan);
  catatan.push(...jm.catatan);

  // 5227 - bunyi pilihan dari dalil gugatan (templat hakim)
  const v5227 = ciri.length ? K.varian5227(ciri, sebutan) : { varian: [], tanpaFrasa: [] };
  // R2 14 Okt: sebab yang tidak tertangkap ciri lama (cerai talak: keluarga Termohon ikut campur,
  // merendahkan Pemohon, tidak merasa cukup dengan nafkah, ...) - satu bunyi "sebab saja" di depan.
  let sebabGugatan = null;
  try {
    sebabGugatan = posita
      ? require("./deteksi/sebabCerai").perluas5227({
          ciri: [],
          ciriPositaPelaku: ciri,
          b1: [],
          b2: [],
          butirPosita: U.kalimatPosita(posita),
          pihak: sebutan,
          peta: require("./abtKalimatBaku").frasaCiriEfektif().peta,
          lama: { nilai: "", dariPosita: false, hanyaPerselisihan: false },
        })
      : null;
  } catch (_) {
    sebabGugatan = null;
  }
  const pilihanSebab =
    sebabGugatan && sebabGugatan.kodePola
      ? [{ keadaan: "sebab dari dalil gugatan (sesudah 'yang disebabkan')", nilai: sebabGugatan.nilai, kodePola: sebabGugatan.kodePola }]
      : [];
  if ((v5227.varian.length || pilihanSebab.length) && gugatan) {
    usulan.push({
      kode: VAR.alasan,
      nama: "Alasan-Alasan Cerai",
      nilai: "",
      keyakinan: "ragu",
      bentrok: "",
      // Bunyi templat hakim lebih dulu (urutan lama); bunyi sebab dari deteksi/sebabCerai di belakang -
      // pada cerai talak sering satu-satunya (ciri lama tanpa frasa / nafkah bukan kewajiban istri).
      pilihan: [...v5227.varian.map((v) => ({ keadaan: `templat hakim - ${v.label.replace(/^5227 - /, "")}`, nilai: v.nilai, kodePola: v.kode })), ...pilihanSebab],
      // Tiap bunyi membawa kode templatnya sendiri (pilihan[].kodePola); kartunya semua kode.
      kodePola: [...v5227.varian.map((v) => v.kode), ...pilihanSebab.map((p) => p.kodePola)].join(","),
      sumber: [{ asal: "gugatan-ecourt", kalimat: `${labelSumber(gugatan, null)} - dalil: ${[...ciri, ...(sebabGugatan ? sebabGugatan.butir.map((b) => b.sebab) : [])].join(", ")}` }],
      catatan: `Bunyi disusun dari dalil surat gugatan e-Court dengan templat hakim satker - pilih lalu sunting.${
        v5227.tanpaFrasa.filter((c) => !(sebabGugatan && sebabGugatan.tertutup.includes(c))).length
          ? ` Dalil tanpa frasa baku: ${v5227.tanpaFrasa.filter((c) => !(sebabGugatan && sebabGugatan.tertutup.includes(c))).join(", ")}.`
          : ""
      }`,
    });
  }

  // ── Kalimat hakim ──
  const namaAnak = anak.map((a) => a.nama).join(", ");
  const kalimat = [
    ...K.kalimatTuntutan(tuntutan, { sebutan, majelis: m.majelis, anak: namaAnak, pengasuh: ikut ? (ikut === "pelaku" ? sebutan.pelaku : sebutan.lawan) : "" }),
  ];
  if (gugatan) {
    const awal = U.awalKonflikPosita(butir);
    const pisah = U.pisahSejakPosita(butir);
    const lama = U.lamaPisahPosita(butir);
    kalimat.push(...K.dudukRingkas({ awal: awal.nilai, pisah: pisah.nilai, lama: lama.nilai, sebab: v5227.varian[0] ? v5227.varian[0].nilai : "" }, sebutan));
  }
  kalimat.push(...K.kalimatBersesuaian(sebutan, "lawan"));
  if (jawab.length) kalimat.push(...K.kalimatBersesuaian(sebutan, "pelaku"), ...K.kalimatBersesuaian(sebutan, "keduanya"));
  // JJ 18 Okt: butir jawaban/replik/duplik dan klausa kesimpulan tertulis, siap disalin ke blangko putusan.
  kalimat.push(...jm.kalimat);
  const ct = /pemohon/i.test(sebutan.lawan);
  if (ct) {
    const tidakAda = ["mutah", "iddah"].filter((j) => !tuntutan.some((t) => t.jenis === j));
    if (anak.length && !tuntutan.some((t) => t.jenis === "nafkah-anak")) tidakAda.push("nafkah-anak");
    kalimat.push(...K.kalimatExOfficio(tidakAda, sebutan, m.majelis));
  }

  for (const d of dokumen) if (d.baca === "ocr") catatan.push(`${d.judul}: dibaca OCR - ejaan dan angka lebih mungkin meleset.`);
  if (diabaikan.some((x) => x.sebab === "kesanggupan")) catatan.push("Ada kesanggupan pihak (mis. Pemohon bersedia memberi nafkah iddah) - bukan tuntutan, lihat daftar 'Bukan tuntutan'.");

  return {
    ok: true,
    ada: true,
    tuntutan: tuntutan.map((t) => ({
      jenis: t.jenis,
      label: t.label,
      penuntut: t.penuntutKode ? sebutanPihak(t.penuntutKode, sebutan) : "",
      penuntutKode: t.penuntutKode,
      dibebani: t.dibebaniKode ? sebutanPihak(t.dibebaniKode, sebutan) : "",
      dibebaniKode: t.dibebaniKode,
      rekonvensi: t.rekonvensi,
      untukAnak: Boolean(t.untukAnak),
      nominal: t.nominal,
      benda: t.benda || "",
      nilaiAbt: K.nilaiAbtTuntutan(t),
      kutipan: t.kutipan,
      sumber: labelSumber(t.dok, t.halaman),
      dariDokumenLain: t.dariDokumenLain || [],
    })),
    anak: anak.map((a) => ({ nama: a.nama, umur: a.umur, tanggalLahir: a.tanggalLahir, sumber: labelSumber(a.dok, a.halaman), kutipan: a.kutipan })),
    jawab,
    usulan,
    kalimat,
    diabaikan,
    catatan,
  };
}

module.exports = { susunIsiGugatan, saringDokumen, positaDari, bunyiDikaruniai, saklarPenyerahanAnak, petitumDari, VAR };
