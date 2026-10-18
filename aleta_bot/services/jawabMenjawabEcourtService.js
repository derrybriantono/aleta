"use strict";

/**
 * ============================================================================
 * JJ (18 Okt 2026) - JAWAB-MENJAWAB TERTULIS DARI e-COURT KE ABT
 * ============================================================================
 *
 * Permintaan hakim: "Jawab menjawab sekarang itu tertulis semua karena sekarang diunggah di e-Court, jadi buat
 * otomatis deteksi." Jawaban, replik, duplik, dan kesimpulan kini berupa berkas e-Court; blangko putusan Derry
 * masih menyuruh petugas "COPY FILE JAWABAN APABILA TERTULIS" dan mengetik pokoknya satu per satu.
 *
 * Berkas ini MURNI (tanpa basis data, tanpa jaringan, tanpa menulis apa pun). Teks berkas dibaca PORTAL dari arsip
 * e-Court (PDF berlapis teks; OCR hanya bila PDF pindaian) dan diteruskan ke isiGugatanService, yang memanggil
 * susunJawabMenjawab() di sini.
 *
 *   kenaliJenis        jawaban | replik | duplik | kesimpulan | gugatan | bukti | lain - dari jenis & judul e-Court
 *                      DAN isi teksnya (judul di kepala surat). Isi yang bertentangan dengan metadata menang tetapi
 *                      ditandai ragu (uploader sering salah pilih jenis: "Kesimpulan" berisi daftar bukti, "Rereplik"
 *                      berjudul "Kesimpulan Penggugat", "Replik" berjudul "Bukti ...").
 *   bersihkanSurat     membuang kop, salam, identitas, penutup/tanda tangan, nomor halaman, kepala-kaki berulang;
 *                      menyisakan paragraf dalil (+ petitum terpisah). Tidak ada kalimat karangan.
 *   pokokSurat         satu klausa per paragraf dalil ("Bahwa ..."), dipotong di batas klausa bila terlalu panjang.
 *   usulan             9881 (tertulis), 7084 (rekonvensi), 8436/8437 (kesimpulan Penggugat/Tergugat), 9355 (pokok
 *                      jawaban), 9491/9681 (pokok eksepsi). Semua "ragu" kecuali 9881; semua jagaIsianLama.
 *   kalimat            butir jawaban/replik/duplik/kesimpulan yang dapat disalin ke blangko putusan (tanya-jawab
 *                      2018/2019/2020 bertipe tanya_jawab: tidak ditulis otomatis, hanya disalin petugas).
 *
 * Aturan yang dijaga uji (jawab-menjawab-ecourt-18okt.test.ts): isian manual menang, tanpa kata "Aleta" dalam keluaran,
 * tanpa kode #nnnn# dalam teks tampil, kalimat hanya dari kata-kata surat.
 */

const T = require("./tuntutanDeteksiService");

const KODE = Object.freeze({
  tertulis: "9881",
  rekonvensi: "7084",
  kesimpulanLawan: "8436",
  kesimpulanPelaku: "8437",
  pokokJawaban: "9355",
  eksepsiArbitrase: "9491",
  eksepsiKewenangan: "9681",
});

const PERAN_JAWAB_MENJAWAB = Object.freeze(["jawaban", "replik", "duplik", "kesimpulan"]);
const NAMA_PERAN = Object.freeze({ jawaban: "Jawaban", replik: "Replik", duplik: "Duplik", kesimpulan: "Kesimpulan" });
const BATAS_KLAUSA = 240;
const BATAS_BUTIR = 10;
const BATAS_TOTAL = 1800;

// ─── Pengenalan jenis dokumen ────────────────────────────────────────────────

/** Jenis dokumen e-Court (pilihan uploader) -> peran. "Rereplik" = duplik rekonvensi (diunggah Penggugat konvensi). */
function peranDariJenis(jenis) {
  const s = String(jenis || "").trim().toLowerCase();
  if (!s) return { peran: "", rekonvensiDuplik: false };
  if (/^rereplik\b/.test(s)) return { peran: "duplik", rekonvensiDuplik: true };
  if (/^kesimpulan\b/.test(s)) return { peran: "kesimpulan", rekonvensiDuplik: false };
  if (/^duplik\b/.test(s)) return { peran: "duplik", rekonvensiDuplik: false };
  if (/^replik\b/.test(s)) return { peran: "replik", rekonvensiDuplik: false };
  if (/^jawaban\b/.test(s)) return { peran: "jawaban", rekonvensiDuplik: false };
  if (/perbaikan|gugatan|permohonan\s+(?!pencabutan)/.test(s)) return { peran: "gugatan", rekonvensiDuplik: false };
  return { peran: "lain", rekonvensiDuplik: false };
}

/** Kata peran PERTAMA yang muncul dalam sebuah judul ("Replik dan Jawaban Rekonvensi" -> replik). */
function peranPertamaDi(teks) {
  const s = String(teks || "").toLowerCase();
  const daftar = [
    ["duplik", /\brereplik\b|\bduplik\b/],
    ["replik", /\breplik(?:a)?\b/],
    ["jawaban", /\bjawab(?:an)?\b|\beksepsi\b/],
    ["kesimpulan", /\bkesimpulan\b/],
  ];
  let terbaik = null;
  for (const [peran, re] of daftar) {
    const m = re.exec(s);
    if (m && (!terbaik || m.index < terbaik.index)) terbaik = { peran, index: m.index };
  }
  return terbaik ? terbaik.peran : "";
}

function barisPertama(teks, n) {
  return T.rapikanTeks(String(teks || "").slice(0, 3000))
    .split(/[\n\f]/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, n);
}

function bagianHuruf(l) {
  const huruf = l.replace(/[^A-Za-z]/g, "");
  if (!huruf.length) return 0;
  return huruf.replace(/[^A-Z]/g, "").length / huruf.length;
}

/** Peran menurut ISI: judul di kepala surat (baris huruf besar / berawalan kata peran). "" bila tidak jelas. */
function peranDariIsi(teks) {
  const baris = barisPertama(teks, 14);
  if (!baris.length) return { peran: "", petunjuk: "" };
  const judul = baris.filter((l) => l.length <= 150 && (bagianHuruf(l) >= 0.6 || /^(?:jawaban|replik|duplik|kesimpulan|daftar|surat|gugatan|permohonan)\b/i.test(l)));
  // Daftar bukti: judul "DAFTAR BUKTI" / "BUKTI SURAT" dan isinya butir P-1/T-1.
  const adaJudulBukti = judul.some((l) => /\bdaftar\s+(?:alat\s+)?bukti\b|\bbukti\s+surat\b|\blampiran\s+bukti\b|\balat\s+bukti\b/i.test(l));
  const butirBukti = (String(teks || "").match(/^\s*(?:bukti\s+)?[PT]\s*[-.]?\s*\d{1,2}\b/gim) || []).length;
  if (adaJudulBukti && butirBukti >= 2) return { peran: "bukti", petunjuk: judul.find((l) => /bukti/i.test(l)) || "" };
  for (const l of judul) {
    const p = peranPertamaDi(l);
    if (p) return { peran: p, petunjuk: l };
  }
  // Surat gugatan/permohonan sungguhan (bukan gugatan rekonvensi dalam jawaban): judul "GUGATAN"/"PERMOHONAN" + petitum.
  const judulGugatan = judul.find((l) => /^(?:surat\s+)?(?:gugatan|permohonan)\b/i.test(l) && !/rekon[pv]ensi/i.test(l));
  if (judulGugatan && /\b(?:primair|petitum|mengadili|subsidair)\b/i.test(teks) && !/\bjawaban\b/i.test(baris.slice(0, 6).join(" "))) return { peran: "gugatan", petunjuk: judulGugatan };
  return { peran: "", petunjuk: "" };
}

function pihakDariKata(teks) {
  const s = String(teks || "").toLowerCase();
  const p = /\b(penggugat|pemohon)\b/.exec(s);
  const t = /\b(tergugat|termohon)\b/.exec(s);
  if (p && (!t || p.index < t.index)) return "0046";
  if (t) return "0047";
  return "";
}

/**
 * Kenali satu dokumen.
 * @param {{jenis?:string, judul?:string, pengunggah?:string, penuntutKode?:string, peran?:string, teks?:string}} d
 * @returns {{peran:string, pihak:string, turut:boolean, ragu:boolean, dasar:string, rekonvensiDuplik:boolean, catatan:string[]}}
 */
function kenaliJenis(d) {
  const x = d || {};
  const catatan = [];
  const jenis = peranDariJenis(x.jenis);
  const dariJudul = peranPertamaDi(x.judul);
  let meta = jenis.peran && jenis.peran !== "lain" ? jenis.peran : "";
  let dasarMeta = meta ? "jenis" : "";
  if (!meta && dariJudul) {
    meta = dariJudul;
    dasarMeta = "judul";
  } else if (!meta && x.peran && (PERAN_JAWAB_MENJAWAB.includes(String(x.peran)) || x.peran === "rekonvensi")) {
    // Pemanggil lama (tanpa jenis/judul e-Court) hanya menyebut peran; "rekonvensi" = gugatan balik yang menyertai jawaban.
    meta = x.peran === "rekonvensi" ? "jawaban" : String(x.peran);
    dasarMeta = "peran";
  }
  let ragu = false;
  if (jenis.peran && jenis.peran !== "lain" && dariJudul && dariJudul !== jenis.peran && !(jenis.peran === "duplik" && jenis.rekonvensiDuplik)) {
    ragu = true;
    catatan.push(`jenis e-Court "${x.jenis}" berbeda dari judul "${x.judul}"`);
  }
  const isi = peranDariIsi(x.teks);
  let peran = meta;
  let dasar = dasarMeta;
  if (isi.peran) {
    if (!meta) {
      peran = isi.peran;
      dasar = "isi";
    } else if (isi.peran !== meta) {
      // Isi surat bertentangan dengan metadata: isi menang (daftar bukti yang diunggah sebagai "Kesimpulan" tidak boleh
      // dihitung kesimpulan), tetapi ragu.
      if (isi.peran === "gugatan" && /rekon[pv]ensi/i.test(String(x.teks || "").slice(0, 600))) {
        peran = meta;
      } else {
        catatan.push(`isi surat berjudul "${isi.petunjuk}" - berbeda dari ${dasarMeta} e-Court (${meta})`);
        peran = isi.peran;
        dasar = "isi";
        ragu = true;
      }
    } else {
      dasar = `${dasarMeta}+isi`;
    }
  }
  if (!peran) peran = jenis.peran === "lain" ? "lain" : "";
  let pihak = x.penuntutKode === "0046" || x.penuntutKode === "0047" ? x.penuntutKode : "";
  const turut = /\bturut\b/i.test(String(x.pengunggah || "")) || /\bturut\s+(?:tergugat|termohon)\b/i.test(String(x.judul || ""));
  if (turut) pihak = "";
  if (!pihak && !turut) pihak = pihakDariKata(x.pengunggah) || "";
  if (!pihak && !turut && peran) {
    // Judul "Kesimpulan Termohon" / isi "KESIMPULAN PEMOHON".
    const kepala = barisPertama(x.teks, 6).join(" ");
    pihak = pihakDariKata(x.judul) || pihakDariKata(kepala) || "";
  }
  return { peran, pihak, turut, ragu, dasar, rekonvensiDuplik: jenis.rekonvensiDuplik, catatan };
}

// ─── Pembersihan surat ───────────────────────────────────────────────────────

const RE_NOMOR_HALAMAN = /^(?:[-–—]\s*)?(?:hal(?:aman)?\.?\s*)?\d{1,3}(?:\s*(?:dari|\/|of)\s*\d{1,3})?(?:\s*[-–—])?$/i;
const RE_IDENTITAS = /^(?:nama(?:\s+lengkap)?|nik|no\.?\s*nik|tempat\s*(?:\/|dan|,)?\s*(?:tgl\.?|tanggal)\.?\s*lahir|tempat\s+tanggal\s+lahir|tempat\/tanggal\s+lahir|ttl|umur|usia|pekerjaan|agama|alamat(?:\s+tempat\s+tinggal)?|pendidikan(?:\s+terakhir)?|kewarganegaraan|status(?:\s+perkawinan)?|no\.?\s*(?:hp|telp|telepon|wa)|telepon|telp|hp|e-?mail|surel|domisili)\s*[:\-–]/i;
const RE_SALAM = /^(?:bismillah\S*|assalamu\W*alaikum\b.*|assalamualaikum\b.*|puji\s+syukur\b.*|yth\.?\b.*|kepada\s+yth\b.*|kepada\s+yang\s+terhormat\b.*|yang\s+terhormat\b.*|dengan\s+hormat\s*[,.:]?|hal\s*:.*|perihal\s*:.*|lampiran\s*:.*|lamp\.?\s*:.*|sifat\s*:.*|perkara\s+(?:no|nomor)\b.*|nomor\s+perkara\b.*|no\.?\s*perkara\b.*|register\s+perkara\b.*)$/i;
const RE_TANGGAL_TEMPAT = /^[A-Z][A-Za-z ]{2,25},\s*\d{1,2}\s+(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+\d{4}\.?$/i;
const RE_KONTAK = /(?:https?:\/\/|www\.|@[a-z0-9.-]+\.[a-z]{2,}|\b0\d{2,3}[- ]?\d{6,9}\b)/i;

const RE_KATA_PEMBUKA = /^(?:Berdasarkan|Demikian|Hormat|Wassalam|Wabillah|Billahi|Oleh\s+karena|Dengan\s+demikian|Maka\b|Mohon|Memohon|Selanjutnya|Adapun|Sehubungan|Untuk\s+itu|Kuasa\s+Hukum|Tertanda|Atas\s+(?:perhatian|kebijaksanaan)|Terima\s+kasih|Petitum|Primair|Subsidair)/;
const RE_JUDUL_BAGIAN = /^(?:[ivx]{1,4}\s*[.)]\s*|[a-z]\s*[.)]\s*)?(?:dalam\s+)?(?:konvensi|rekon[pv]ensi|eksepsi|pokok\s+perkara|provisi|petitum)(?:\s+(?:dan|dan\/atau)\s+(?:rekon[pv]ensi|konvensi|pokok\s+perkara))?\s*[:;.]?$/i;
const RE_AWAL_PARAGRAF = /^(?:\(?\d{1,2}[.)]\s|\(?[a-z][.)]\s|[ivx]{1,4}[.)]\s|[-•–*]\s|Bahwa\b|BAHWA\b|Dalam\s+(?:Konvensi|Rekon[pv]ensi|Eksepsi|Pokok)\b|DALAM\s+\S)/;
// Awal petitum: paragraf yang DIMULAI dengan permohonan ("Berdasarkan ..., mohon ...", "Mohon ..."), atau judul PETITUM/PRIMAIR/SUBSIDAIR.
// Kata "memohon" di tengah dalil biasa bukan petitum.
const RE_PETITUM = /^(?:\(?\d{1,2}[.)]\s*)?(?:bahwa\s+)?(?:(?:berdasarkan|maka|oleh\s+karena|dengan\s+demikian|untuk\s+itu|sehubungan)\b[^.]{0,200}\b(?:mohon|memohon)\b|(?:mohon|memohon)\b|petitum\b|primair\b|subsidair\b|mengadili\b)/i;
const RE_DEFINISI = /\bselanjutnya\s+(?:disebut|disingkat)\b|\bdalam\s+(?:rekon[pv]ensi|konvensi)\s+disebut\b|\bsebagai\s+(?:penggugat|tergugat)\s+rekon[pv]ensi\s*$/i;
const RE_KUTIPAN_HUKUM = /\bpasal\s+\d+[^.]{0,100}\b(?:berbunyi|menyatakan|menentukan|mengatur)\b|\byurisprudensi\b|\bputusan\s+mahkamah\s+agung\b|\bsurat\s+edaran\b|\bfirman\s+allah\b|\bQS\.?\s/i;

/** Teks surat -> halaman -> baris (kepala/kaki berulang dan nomor halaman dibuang; dihitung). */
function barisSurat(teks) {
  const rapi = T.rapikanTeks(teks);
  // Baris kosong di pangkal/ujung halaman dibuang: batas halaman tidak menutup paragraf yang terpotong.
  const halaman = rapi.split("\f").map((h) => h.trim().split("\n").map((l) => l.replace(/[ \t ]+/g, " ").trim()));
  const dibuang = { nomorHalaman: 0, berulang: 0 };
  const hitung = new Map();
  const kunci = (l) => l.toLowerCase().replace(/\d+/g, "#");
  if (halaman.length >= 3) {
    for (const h of halaman) for (const k of new Set(h.filter((l) => l && l.length <= 130).map(kunci))) hitung.set(k, (hitung.get(k) || 0) + 1);
  }
  const ambangUlang = Math.max(3, Math.ceil(halaman.length * 0.6));
  const baris = [];
  halaman.forEach((h) => {
    for (const l of h) {
      if (!l) {
        baris.push("");
        continue;
      }
      if (RE_NOMOR_HALAMAN.test(l)) {
        dibuang.nomorHalaman += 1;
        continue;
      }
      if (halaman.length >= 3 && l.length <= 130 && (hitung.get(kunci(l)) || 0) >= ambangUlang && !RE_AWAL_PARAGRAF.test(l)) {
        dibuang.berulang += 1;
        continue;
      }
      baris.push(l);
    }
    // Batas halaman TIDAK menutup paragraf (PDF memotong kalimat di ujung halaman); hanya baris kosong asli yang menutup.
  });
  return { baris, dibuang };
}

function huruf(l) {
  return bagianHuruf(l);
}

/** Baris -> paragraf: baris sambungan PDF digabung; judul bagian & butir bernomor berdiri sendiri. */
function susunParagraf(baris) {
  const hasil = [];
  let kini = null;
  let barisKini = "";
  const tutup = () => {
    if (kini && kini.teks.trim()) hasil.push({ ...kini, teks: kini.teks.replace(/\s+/g, " ").trim() });
    kini = null;
  };
  // Lebar baris PDF: persentil 90 baris panjang. Baris sambungan hampir selebar itu; baris terakhir paragraf lebih pendek.
  const panjang = baris.filter((x) => x.length > 40).map((x) => x.length).sort((a, b) => a - b);
  const lebar = panjang.length >= 4 ? panjang[Math.floor(panjang.length * 0.9)] : 0;
  for (const l of baris) {
    if (!l) {
      tutup();
      continue;
    }
    // Paragraf baru tanpa penanda: baris sebelumnya berakhir tanda baca akhir DAN (pendek, atau baris ini diawali kata pembuka/penutup surat).
    if (kini && /[.;:!?)]$/.test(barisKini) && /^[A-Z"(]/.test(l)) {
      const pendek = lebar > 0 && barisKini.length < lebar * 0.8;
      if (pendek || RE_KATA_PEMBUKA.test(l)) tutup();
    }
    barisKini = l;
    const judulHuruf = l.length <= 90 && huruf(l) >= 0.8 && l.replace(/[^A-Za-z]/g, "").length >= 4 && !/[,;]$/.test(l) && !/^(?:bahwa\b|\(?\d{1,2}[.)])/i.test(l) && l.split(" ").length <= 12;
    const judul = l.length <= 120 && (RE_JUDUL_BAGIAN.test(l) || judulHuruf);
    if (judul) {
      tutup();
      hasil.push({ teks: l, judul: true });
      continue;
    }
    if (RE_AWAL_PARAGRAF.test(l) || !kini) {
      tutup();
      kini = { teks: l, judul: false };
      continue;
    }
    // Baris sambungan.
    kini.teks += ` ${l}`;
  }
  tutup();
  return hasil;
}

function lcfirst(s) {
  if (!s) return s;
  // Sebutan pihak (Penggugat, Tergugat, Pemohon, Termohon, Majelis Hakim) tetap berhuruf besar.
  if (/^(?:Penggugat|Tergugat|Pemohon|Termohon|Turut|Majelis|Hakim|Pengadilan|Kuasa)\b/.test(s)) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function tanpaNomor(s) {
  return String(s || "")
    .replace(/^\(?(?:\d{1,2}|[a-z]|[ivx]{1,4})[.)]\s*/i, "")
    .replace(/^[-•–*]\s*/, "")
    .trim();
}

/**
 * Surat -> bagian-bagiannya.
 * @returns {{dalil:string[], petitum:string[], judulBagian:Array<{teks:string, indeks:number}>, paragraf:object[], dibuang:object, yakin:boolean}}
 */
function bersihkanSurat(teks) {
  const { baris, dibuang } = barisSurat(teks);
  const semua = susunParagraf(baris);
  const hitung = { kop: 0, salam: 0, identitas: 0, penutup: 0, ...dibuang };
  // 1. Awal isi: paragraf dalil pertama ("Bahwa ...") atau judul bagian (DALAM KONVENSI / EKSEPSI / POKOK PERKARA).
  let awal = semua.findIndex((p) => (!p.judul && /^(?:\(?\d{1,2}[.)]\s*)?bahwa\b/i.test(p.teks) && p.teks.length >= 40) || (p.judul && RE_JUDUL_BAGIAN.test(p.teks)));
  let yakin = true;
  if (awal < 0) {
    // Tanpa penanda: seluruh paragraf panjang dianggap isi, tetapi tidak yakin.
    awal = 0;
    yakin = false;
  }
  hitung.kop = semua.slice(0, awal).length;
  // 2. Akhir isi: penutup (Demikian ... / Hormat kami / tempat-tanggal / tanda tangan).
  let akhir = semua.length;
  for (let i = awal + 1; i < semua.length; i += 1) {
    const t = semua[i].teks;
    if (/^(?:demikian\b|hormat\s+(?:kami|saya)\b|wassalam|wabillah|billahi|dibuat\s+(?:di|oleh)\b|tertanda\b|atas\s+(?:perhatian|kebijaksanaan)|terima\s+kasih)/i.test(t) || RE_TANGGAL_TEMPAT.test(t)) {
      akhir = i;
      break;
    }
  }
  hitung.penutup = semua.length - akhir;
  const isi = semua.slice(awal, akhir);
  // 3. Petitum: dari paragraf "mohon ... Majelis" / PETITUM / PRIMAIR sampai penutup.
  let awalPetitum = -1;
  for (let i = 0; i < isi.length; i += 1) {
    const p = isi[i];
    if (i >= 1 && (RE_PETITUM.test(p.teks) || (p.judul && /^(?:petitum|primair|subsidair)\b/i.test(p.teks)))) {
      awalPetitum = i;
      break;
    }
  }
  const dalilPar = awalPetitum >= 0 ? isi.slice(0, awalPetitum) : isi;
  const petitumPar = awalPetitum >= 0 ? isi.slice(awalPetitum) : [];
  const judulBagian = [];
  const dalil = [];
  dalilPar.forEach((p) => {
    if (p.judul) {
      judulBagian.push({ teks: p.teks, indeks: dalil.length });
      return;
    }
    if (RE_IDENTITAS.test(tanpaNomor(p.teks))) {
      hitung.identitas += 1;
      return;
    }
    if (RE_SALAM.test(tanpaNomor(p.teks)) || (RE_KONTAK.test(p.teks) && p.teks.length < 90)) {
      hitung.salam += 1;
      return;
    }
    if (p.teks.replace(/[^A-Za-z]/g, "").length < 12) return;
    dalil.push(p.teks);
  });
  return {
    dalil,
    petitum: petitumPar.filter((p) => !p.judul).map((p) => p.teks),
    judulBagian,
    paragraf: isi,
    dibuang: hitung,
    yakin: yakin && dalil.length > 0,
  };
}

// ─── Pokok dalil ─────────────────────────────────────────────────────────────

const SINGKATAN = /\b(?:Rp|No|Nomor|Jl|Kel|Kec|Kab|Prov|H|Hj|Drs|Dr|S\.H|SH|Tgl|tgl|dkk|dll|dsb|dst|a\.n|Moh|Muh|Hi|M|Pdt|Ps|UU|KHI|RI|alm|Almh|Ny|Tn|SE|PA|Pt|Sdr|Sdri|cq|jo|vs|dg)\.$/;

function pecahKalimat(s) {
  const bagian = [];
  let awal = 0;
  const re = /(?<=[.;!?])\s+(?=[A-Z"(\d])/g;
  let m;
  while ((m = re.exec(s))) {
    const sebelum = s.slice(awal, m.index + 1);
    if (SINGKATAN.test(sebelum)) continue;
    bagian.push(sebelum);
    awal = m.index + m[0].length;
  }
  bagian.push(s.slice(awal));
  return bagian.map((x) => x.trim()).filter(Boolean);
}

function akhiriKlausa(s) {
  return s.replace(/[\s.;:,\-–]+$/, "").trim();
}

/** Potong di batas klausa terdekat sebelum `maks`; { teks, terpotong }. */
function potongKlausa(s, maks) {
  if (s.length <= maks) return { teks: akhiriKlausa(s), terpotong: false };
  const kepala = s.slice(0, maks);
  const batas = Math.max(kepala.lastIndexOf(", "), kepala.lastIndexOf(" karena "), kepala.lastIndexOf(" sehingga "), kepala.lastIndexOf(" yaitu "), kepala.lastIndexOf(" sedangkan "));
  if (batas >= maks * 0.5) return { teks: akhiriKlausa(kepala.slice(0, batas)), terpotong: true };
  const spasi = kepala.lastIndexOf(" ");
  return { teks: akhiriKlausa(kepala.slice(0, spasi > 0 ? spasi : maks)), terpotong: true };
}

/** "Penggugat/Pemohon" -> sebutan perkara; "saya"/"kami" -> sebutan penulis bila aman. */
function samakanSebutan(s, sebutan, penulis) {
  let hasil = s;
  const lawan = (sebutan && sebutan.lawan) || "Penggugat";
  const pelaku = (sebutan && sebutan.pelaku) || "Tergugat";
  hasil = hasil.replace(/\b(?:Penggugat|Pemohon)\s*\/\s*(?:Penggugat|Pemohon)\b/g, lawan).replace(/\b(?:Tergugat|Termohon)\s*\/\s*(?:Tergugat|Termohon)\b/g, pelaku);
  let diganti = false;
  const klien = /\bklien\s+kami\b|\bkuasa\s+hukum\s+kami\b|\bkami\s+selaku\s+kuasa\b/i.test(hasil);
  if (penulis && !klien && /\b(?:saya|kami|aku)\b/i.test(hasil)) {
    hasil = hasil.replace(/\b(?:saya|kami|aku)\b/gi, penulis);
    diganti = true;
  }
  return { teks: hasil, orangPertamaTersisa: klien && /\b(?:saya|kami|aku)\b/i.test(hasil), diganti };
}

/** Satu paragraf dalil -> satu klausa pokok. */
function klausaPokok(par, opsi) {
  const o = opsi || {};
  let bersih = tanpaNomor(par).replace(/\s+/g, " ");
  // Surat diketik HURUF BESAR semua: diturunkan, sebutan pihak dikembalikan berhuruf awal besar; nama orang tak dapat dipulihkan -> ragu.
  const hurufBesar = bagianHuruf(bersih) >= 0.8 && bersih.replace(/[^A-Za-z]/g, "").length >= 12;
  if (hurufBesar) bersih = bersih.toLowerCase().replace(/^(?:bahwa)\b/, "Bahwa").replace(/\b(penggugat|tergugat|pemohon|termohon|rekonvensi)\b/g, (x) => x.charAt(0).toUpperCase() + x.slice(1));
  const kalimat = pecahKalimat(bersih);
  let pertama = kalimat[0] || "";
  if (pertama.length < 45 && kalimat[1]) pertama = `${pertama.replace(/[.;:]$/, ";")} ${kalimat[1]}`;
  const sama = samakanSebutan(pertama, o.sebutan, o.penulis);
  const potong = potongKlausa(sama.teks, o.maks || BATAS_KLAUSA);
  return { teks: potong.teks.replace(/^bahwa[,]?\s+/i, "Bahwa "), terpotong: potong.terpotong, orangPertamaTersisa: sama.orangPertamaTersisa, diganti: sama.diganti || hurufBesar, hurufBesar };
}

/** Surat tanpa gaya "Bahwa ...": tiap kalimat paragraf menjadi dalil sendiri (paling banyak 6 per paragraf). */
function dalilPerKalimat(dalil) {
  const gayaBahwa = dalil.filter((p) => /^(?:\(?\d{1,2}[.)]\s*)?bahwa\b/i.test(p)).length >= 2;
  if (gayaBahwa) return dalil;
  return dalil.flatMap((p) => pecahKalimat(tanpaNomor(p)).filter((k) => k.length >= 25).slice(0, 6));
}

/** Pokok surat: satu klausa per paragraf dalil, batas jumlah & panjang. */
function pokokSurat(dalil, opsi) {
  const butir = [];
  let panjang = 0;
  let terpotong = false;
  let ragu = false;
  let hurufBesar = false;
  let dipangkas = 0;
  for (const par of dalil) {
    if (RE_KUTIPAN_HUKUM.test(par) && !/\b(?:tidak\s+benar|membantah|menolak|mengakui|benar|tetap)\b/i.test(par)) continue;
    if (RE_DEFINISI.test(par) && !/\b(?:tidak\s+benar|membantah|menolak|mengakui|membenarkan)\b/i.test(par)) continue;
    const k = klausaPokok(par, opsi);
    if (k.teks.length < 25) continue;
    if (butir.length >= BATAS_BUTIR || panjang + k.teks.length > BATAS_TOTAL) {
      dipangkas += 1;
      continue;
    }
    butir.push(k.teks);
    panjang += k.teks.length;
    if (k.terpotong) terpotong = true;
    if (k.orangPertamaTersisa || k.diganti) ragu = true;
    if (k.hurufBesar) hurufBesar = true;
  }
  return { butir, terpotong, ragu, dipangkas, hurufBesar };
}

// ─── Rekonvensi, eksepsi, kesimpulan ─────────────────────────────────────────

/**
 * Gugatan balik yang JELAS: judul bagian "DALAM REKONVENSI" / judul surat memuat "Gugatan Rekonvensi" atau
 * "dan Rekonvensi"; pasangan "Penggugat Rekonvensi" + "Tergugat Rekonvensi". Negasi ("tidak mengajukan rekonvensi")
 * membatalkan. Sebutan sambil lalu ("hak mengajukan rekonvensi kelak") bukan rekonvensi.
 */
function deteksiRekonvensi(teks, bersih) {
  const s = T.rapikanTeks(teks);
  const negasi = /\btidak\s+(?:akan\s+)?(?:mengajukan|ada|menuntut\s+balik)\s+(?:adanya\s+)?(?:gugatan\s+)?(?:rekon[pv]ensi|gugat(?:an)?\s+balik)|\btanpa\s+(?:gugatan\s+)?rekon[pv]ensi|\bbelum\s+(?:akan\s+)?mengajukan\s+(?:gugatan\s+)?rekon[pv]ensi/i;
  const judulBagian = ((bersih && bersih.judulBagian) || []).some((j) => /^(?:[ivx]{1,4}\s*[.)]\s*|[a-z]\s*[.)]\s*)?dalam\s+rekon[pv]ensi\b/i.test(j.teks));
  const kepala = barisPertama(teks, 8).join(" ");
  const judulSurat = /gugatan\s+(?:rekon[pv]ensi|balik)|\bdan\s+(?:gugatan\s+)?rekon[pv]ensi\b|rekon[pv]ensi\b/i.test(kepala) && bagianHuruf(kepala) >= 0.4;
  const pasangan = /penggugat\s+rekon[pv]ensi/i.test(s) && /tergugat\s+rekon[pv]ensi/i.test(s);
  const alasan = [];
  if (judulBagian) alasan.push("bagian \"Dalam Rekonvensi\"");
  if (judulSurat) alasan.push("judul surat memuat rekonvensi");
  if (pasangan) alasan.push("Penggugat dan Tergugat Rekonvensi");
  if (negasi.test(s) && !judulBagian && !pasangan) return { ada: "tidak", alasan: ["jawaban menyatakan tidak mengajukan rekonvensi"] };
  // Jelas = bagian/judul DAN (pasangan ATAU petitum rekonvensi).
  const petitumRekon = /rekon[pv]ensi[\s\S]{0,400}\b(?:menghukum|menetapkan|mengabulkan|membayar|menyatakan)\b/i.test(s);
  if ((judulBagian || judulSurat) && (pasangan || petitumRekon || judulBagian)) return { ada: "ada", alasan };
  if (pasangan) return { ada: "ada", alasan };
  return { ada: "tidak", alasan: [] };
}

function deteksiEksepsi(bersih) {
  const j = bersih.judulBagian.find((x) => /\beksepsi\b/i.test(x.teks));
  if (!j) return { ada: false, jenis: "", kutipan: "" };
  // Isi eksepsi: dalil sesudah judul sampai judul bagian berikutnya.
  const berikut = bersih.judulBagian.find((x) => x.indeks > j.indeks);
  const isi = bersih.dalil.slice(j.indeks, berikut ? berikut.indeks : bersih.dalil.length);
  if (!isi.length) return { ada: true, jenis: "", kutipan: "" };
  const gabung = isi.join(" ");
  const jenis = /arbitrase|basyarnas|klausul\w*\s+arbitrase/i.test(gabung) ? "arbitrase" : /kewenangan|berwenang|kompetensi|absolut|relatif/i.test(gabung) ? "kewenangan" : "lain";
  return { ada: true, jenis, kutipan: isi[0], isi };
}

/** Klausa "tetap pada ..." / "memohon ... menolak ..." / "tidak ingin bercerai" dari penutup/petitum/dalil kesimpulan. */
function klausaKesimpulan(bersih) {
  const sumber = [...bersih.dalil.slice(-4), ...bersih.petitum];
  const gabung = sumber.join(" ").replace(/\s+/g, " ");
  const potong = (s) => potongKlausa(s, 200).teks;
  let m = /\btetap\s+(?:pada|berpegang\s+pada|dengan)\s+(?:dalil[- ]dalil\s+)?(?:gugatan|permohonan|jawaban|replik|duplik|dalil)\w*[^.;]{0,140}/i.exec(gabung);
  // Bunyi blangko: "tetap pada gugatan semula ..." - akhiran -nya dibuang (perubahan ejaan saja, bukan isi).
  if (m) return { klausa: potong(m[0]).replace(/\b(gugatan|permohonan|jawaban|replik|duplik)nya\b/gi, "$1"), pola: "kesimpulan-tetap-pada" };
  m = /\b(?:keberatan|tidak\s+(?:ingin|bersedia|mau|setuju|rela))\s+(?:untuk\s+)?(?:bercerai|diceraikan|perceraian|dicerai|cerai)[^.;]{0,120}/i.exec(gabung);
  if (m) return { klausa: potong(m[0]), pola: "kesimpulan-keberatan-cerai" };
  m = /\b(?:memohon|mohon)\s+(?:kepada\s+)?(?:yang\s+mulia\s+)?(?:majelis\s+hakim|hakim|pengadilan)[^.;]{0,50}?\s+(?:untuk\s+|agar\s+(?:kiranya\s+)?)?(?:menolak|mengabulkan|menerima|menjatuhkan|memutus)[^.;]{0,150}/i.exec(gabung);
  if (m) return { klausa: potong(m[0]), pola: "kesimpulan-mohon-putusan" };
  return { klausa: "", pola: "" };
}

// ─── Penyusunan ──────────────────────────────────────────────────────────────

function sumberDok(dok, kutipan) {
  return [{ asal: "gugatan-ecourt", kalimat: `e-Court: ${dok.judul}${dok.baca === "ocr" ? " (dibaca OCR)" : ""} - "${String(kutipan || "").replace(/\s+/g, " ").slice(0, 260)}"` }];
}

function sebutanPeran(peran, pihak, sebutan, turut) {
  const lawan = (sebutan && sebutan.lawan) || "Penggugat";
  const pelaku = (sebutan && sebutan.pelaku) || "Tergugat";
  if (turut) return `Turut ${pelaku}`;
  if (pihak === "0046") return lawan;
  if (pihak === "0047") return pelaku;
  if (peran === "jawaban" || peran === "duplik") return pelaku;
  if (peran === "replik") return lawan;
  return "";
}

/**
 * @param {{dokumen: Array<{judul:string, peran:string, jenis?:string, pengunggah?:string, teks:string, baca?:string, penuntutKode?:string}>,
 *          sebutan?: {lawan:string, pelaku:string}}} masukan
 */
function susunJawabMenjawab(masukan) {
  const m = masukan || {};
  const sebutan = m.sebutan || { lawan: "Penggugat", pelaku: "Tergugat" };
  const hasil = { dokumen: [], usulan: [], kalimat: [], catatan: [] };
  const diolah = [];
  const masuk = Array.isArray(m.dokumen) ? m.dokumen : [];
  for (let ix = 0; ix < masuk.length; ix += 1) {
    const d = masuk[ix];
    if (!d || d.peran === "gugatan") continue;
    const k = kenaliJenis(d);
    if (!PERAN_JAWAB_MENJAWAB.includes(k.peran)) {
      if (k.peran === "bukti" || k.peran === "lain" || k.peran === "gugatan") {
        hasil.catatan.push(`${d.judul}: bukan jawab-menjawab (${k.peran === "bukti" ? "daftar bukti" : k.peran === "gugatan" ? "surat gugatan" : "jenis lain"}) - tidak dipakai${k.catatan.length ? `; ${k.catatan.join("; ")}` : ""}.`);
        hasil.dokumen.push({ indeks: ix, judul: d.judul, peran: k.peran, pihak: k.pihak, dipakai: false, dasar: k.dasar, ragu: true, butir: [], catatan: k.catatan });
      }
      continue;
    }
    const bersih = bersihkanSurat(d.teks);
    const penulis = sebutanPeran(k.peran, k.pihak, sebutan, k.turut);
    const pokok = pokokSurat(dalilPerKalimat(bersih.dalil), { sebutan, penulis: k.turut ? "" : penulis });
    const rekon = k.peran === "jawaban" ? deteksiRekonvensi(d.teks, bersih) : { ada: "", alasan: [] };
    const eksepsi = k.peran === "jawaban" ? deteksiEksepsi(bersih) : { ada: false, jenis: "", kutipan: "" };
    const catatanDok = [...k.catatan];
    if (!bersih.yakin) catatanDok.push("kop dan isi surat tidak terpisah jelas - pokok diambil dari seluruh paragraf");
    if (pokok.terpotong) catatanDok.push("ada dalil yang dipotong di batas klausa");
    if (pokok.dipangkas) catatanDok.push(`${pokok.dipangkas} dalil lain tidak dimuat (terlalu panjang)`);
    if (pokok.hurufBesar) catatanDok.push("surat diketik huruf besar semua dan diturunkan - ejaan nama dan sebutan perlu diperiksa");
    else if (pokok.ragu) catatanDok.push("kata ganti orang pertama (saya/kami) diganti sebutan pihak - periksa");
    if (d.baca === "ocr") catatanDok.push("dibaca OCR");
    const ragu = k.ragu || !bersih.yakin || pokok.ragu || d.baca === "ocr" || pokok.terpotong || !pokok.butir.length;
    diolah.push({ d, k, bersih, pokok, rekon, eksepsi, penulis, ragu, catatanDok });
    hasil.dokumen.push({
      indeks: ix,
      judul: d.judul,
      peran: k.peran,
      pihak: k.pihak,
      turut: k.turut,
      dipakai: true,
      dasar: k.dasar,
      ragu,
      rekonvensi: rekon.ada,
      eksepsi: eksepsi.ada ? eksepsi.jenis || "lain" : "",
      butir: pokok.butir,
      dibuang: bersih.dibuang,
      catatan: catatanDok,
    });
  }

  if (!diolah.length) return hasil;
  const tandai = (extra) => ({ bentrok: "", jagaIsianLama: true, ...extra });

  // 9881 - "tertulis": ada berkas jawab-menjawab/kesimpulan sungguhan di e-Court.
  {
    const d0 = diolah[0];
    hasil.usulan.push(
      tandai({
        kode: KODE.tertulis,
        nama: "lisan atau tertulis (jawaban replik dan duplik)",
        nilai: "tertulis",
        // Keberadaan berkas jawab-menjawab di e-Court menentukan "tertulis" (terukur 4/4 atas isian petugas, lihat laporan JJ);
        // bila jenis/judul/isi saling bertentangan pada SEMUA berkas, turun ke ragu.
        keyakinan: diolah.some((x) => !x.k.ragu) ? "cukup" : "ragu",
        sumber: sumberDok(d0.d, `${diolah.length} berkas jawab-menjawab diunggah di e-Court: ${diolah.map((x) => x.d.judul).join("; ")}`),
        kodePola: "",
        catatan: "Dokumennya ada di e-Court - jawab-menjawab diajukan tertulis.",
      })
    );
  }

  // 7084 - penanda rekonvensi: hanya dari JAWABAN yang jelas memuat gugatan balik.
  {
    const r = diolah.find((x) => x.rekon.ada === "ada");
    if (r) {
      hasil.usulan.push(
        tandai({
          kode: KODE.rekonvensi,
          nama: "PENANDA KONVENSI/REKONVENSI (1 apabila ada)",
          nilai: "1",
          keyakinan: "ragu",
          sumber: sumberDok(r.d, r.bersih.judulBagian.filter((j) => /rekon[pv]ensi/i.test(j.teks)).map((j) => j.teks).join(" / ") || r.rekon.alasan.join("; ")),
          kodePola: "tuntutan-bagian-rekonvensi",
          catatan: `Jawaban memuat gugatan balik (${r.rekon.alasan.join("; ")}) - pastikan rekonvensi diajukan sebelum pembuktian.`,
        })
      );
    }
  }

  // 8436 / 8437 - kesimpulan Penggugat / Tergugat: kesimpulan terakhir per pihak.
  for (const [kode, pihak, nama] of [
    [KODE.kesimpulanLawan, "0046", "Kesimpulan Penggugat/Pemohon"],
    [KODE.kesimpulanPelaku, "0047", "Kesimpulan Tergugat/Termohon"],
  ]) {
    const kandidat = diolah.filter((x) => x.k.peran === "kesimpulan" && x.k.pihak === pihak && !x.k.turut);
    const x = kandidat[kandidat.length - 1];
    if (!x) continue;
    const kl = klausaKesimpulan(x.bersih);
    const klausa = kl.klausa || (x.pokok.butir[0] ? x.pokok.butir[0].replace(/^Bahwa\s+/i, "") : "");
    if (!klausa) continue;
    x.klausaKesimpulan = klausa;
    hasil.usulan.push(
      tandai({
        kode,
        nama,
        nilai: lcfirst(klausa),
        keyakinan: "ragu",
        sumber: sumberDok(x.d, klausa),
        kodePola: kl.pola || "kesimpulan-dalil-pertama",
        catatan: kl.klausa
          ? "Klausa diambil apa adanya dari surat kesimpulan di e-Court (kata 'yang pada pokoknya' sudah ada di blangko) - periksa sebelum dipakai."
          : "Surat kesimpulan tidak memuat kalimat 'tetap pada ...' atau permohonan yang jelas; dipakai dalil pertamanya - periksa.",
      })
    );
  }

  // 9355 / 9491 / 9681 - pokok jawaban & eksepsi (satu kalimat tanpa titik akhir) dari jawaban Tergugat.
  const jawabUtama = diolah.find((x) => x.k.peran === "jawaban" && !x.k.turut && (x.k.pihak === "0047" || !x.k.pihak));
  if (jawabUtama) {
    const bagianPokok = jawabUtama.bersih.judulBagian.find((j) => /pokok\s+perkara|konvensi/i.test(j.teks));
    const dalilPokok = bagianPokok ? jawabUtama.bersih.dalil.slice(bagianPokok.indeks) : jawabUtama.bersih.dalil;
    const eks = jawabUtama.eksepsi;
    const pokokJawab = pokokSurat(dalilPokok.filter((p) => !(eks.isi || []).includes(p)), { sebutan, penulis: jawabUtama.penulis, maks: 200 });
    if (pokokJawab.butir[0]) {
      hasil.usulan.push(
        tandai({
          kode: KODE.pokokJawaban,
          nama: "Pokok jawaban Tergugat/Termohon (satu kalimat)",
          nilai: lcfirst(pokokJawab.butir[0].replace(/^Bahwa\s+/i, "")),
          keyakinan: "ragu",
          sumber: sumberDok(jawabUtama.d, pokokJawab.butir[0]),
          kodePola: "jawaban-pokok-pertama",
          catatan: "Dalil pertama jawaban pada bagian pokok perkara, apa adanya - pilih dalil yang paling mewakili jawaban.",
        })
      );
    }
    if (eks.ada && eks.kutipan) {
      const klausaEks = klausaPokok(eks.kutipan, { sebutan, penulis: jawabUtama.penulis, maks: 200 });
      const nilai = lcfirst(klausaEks.teks.replace(/^Bahwa\s+/i, ""));
      if (eks.jenis === "arbitrase") {
        hasil.usulan.push(tandai({ kode: KODE.eksepsiArbitrase, nama: "Pokok eksepsi Tergugat/Termohon (satu kalimat)", nilai, keyakinan: "ragu", sumber: sumberDok(jawabUtama.d, eks.kutipan), kodePola: "jawaban-eksepsi-arbitrase", catatan: "Eksepsi tentang arbitrase dalam jawaban e-Court." }));
      } else if (eks.jenis === "kewenangan") {
        hasil.usulan.push(tandai({ kode: KODE.eksepsiKewenangan, nama: "Eksepsi kewenangan - isi eksepsi Tergugat/Termohon", nilai, keyakinan: "ragu", sumber: sumberDok(jawabUtama.d, eks.kutipan), kodePola: "jawaban-eksepsi-kewenangan", catatan: "Eksepsi kewenangan dalam jawaban e-Court." }));
      }
    }
  }

  // Kalimat yang dapat disalin (tanya-jawab 2018/2019/2020 bertipe tanya_jawab: tidak ditulis otomatis).
  for (const x of diolah) {
    if (!x.pokok.butir.length) continue;
    const siapa = sebutanPeran(x.k.peran, x.k.pihak, sebutan, x.k.turut) || "";
    if (x.k.peran === "kesimpulan") {
      if (!x.klausaKesimpulan) continue;
      hasil.kalimat.push({
        kode: `jawab-tertulis-kesimpulan-${x.k.pihak || "x"}`,
        label: `Kesimpulan ${siapa} (tertulis, e-Court)`.replace(/\s+/g, " "),
        bagian: "jawab-menjawab",
        jenis: "",
        teks: `yang pada pokoknya ${lcfirst(x.klausaKesimpulan)}`,
        kosong: [],
      });
      continue;
    }
    hasil.kalimat.push({
      kode: `jawab-tertulis-${x.k.peran}-${x.k.pihak || (x.k.turut ? "turut" : "x")}`,
      label: `${NAMA_PERAN[x.k.peran]} ${siapa} (tertulis, e-Court) - butir pokok`.replace(/\s+/g, " "),
      bagian: "jawab-menjawab",
      jenis: "",
      teks: x.pokok.butir.map((b) => `- ${b}`).join("\n"),
      kosong: [],
    });
  }
  if (diolah.some((x) => x.ragu)) hasil.catatan.push("Pokok jawab-menjawab disusun otomatis dari berkas e-Court - baca ulang sebelum dipakai di putusan; yang berlabel ragu belum diukur atas berkas sungguhan.");
  return hasil;
}

module.exports = {
  KODE,
  PERAN_JAWAB_MENJAWAB,
  kenaliJenis,
  peranDariJenis,
  peranDariIsi,
  bersihkanSurat,
  pokokSurat,
  klausaPokok,
  deteksiRekonvensi,
  deteksiEksepsi,
  klausaKesimpulan,
  susunJawabMenjawab,
  // JJ2 (18 Okt): dipakai tanyaJawabEcourtService / buktiEcourtService (pembersih yang sama, tanpa menyalin).
  samakanSebutan,
  tanpaNomor,
  lcfirst,
  pecahKalimat,
  bagianHuruf,
  barisSurat,
  susunParagraf,
  RE_NOMOR_HALAMAN,
  RE_SALAM,
  RE_IDENTITAS,
  RE_TANGGAL_TEMPAT,
  RE_KONTAK,
  RE_KUTIPAN_HUKUM,
  RE_DEFINISI,
  sebutanPeran,
};
