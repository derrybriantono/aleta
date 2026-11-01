"use strict";

/**
 * ============================================================================
 * P2 (1 Nov 2026, keputusan Derry 90) - MATRIKS DALIL SATU SUMBER
 * ============================================================================
 *
 * Dalil para pihak (posita/petitum gugatan, jawaban + gugatan rekonvensi, replik, duplik, kesimpulan) dipecah per butir SEKALI,
 * lalu dipakai bersama oleh deteksi alasan 5227 (tautan huruf), keterangan saksi (lencana "dari gugatan"/"dari jawaban"),
 * ALETA Ai (dalil yang belum dikuatkan saksi), dan nanti agen A2 (penilai pembuktian) serta A1 (draf putusan).
 *
 * Berkas ini MURNI (tanpa basis data, jaringan, ABT, SIPP). Teksnya datang dari pembaca yang SUDAH ada - tidak ada pembaca kedua:
 *   - berkas e-Court: teks yang dibaca portal (isi-gugatan.ts) dan disaring isiGugatanService.saringDokumen;
 *     dipotong menjadi paragraf dengan J.barisSurat + NJ.susunParagraf + NJ.potongIsi (pemotong naskah 12020-12028, keputusan 55);
 *   - perkara tanpa surat gugatan e-Court: posita/petitum SIPP (konteksPerkaraSaksi, HANYA SELECT) diubah ke teks dengan U.polosPosita.
 *
 * Tiap dalil:
 *   id         stabil: sumber + bagian + sidik teks (sama selama teksnya sama; urutan berkas tidak memengaruhi)
 *   sumber     gugatan | jawaban | replik | duplik | kesimpulan | rekonvensi (bagian rekonvensi jawaban = gugatan rekonvensi)
 *   pihak      "0046" (Penggugat/Pemohon) | "0047" (Tergugat/Termohon) + sebutannya
 *   bagian     pokok | eksepsi | provisi | konvensi | rekonvensi
 *   nomor      nomor butir ASLI ("3", "3.a", "3-1" untuk tanda "-"), urut (1, 2, ...), induk (id butir induk bagi a./b./-)
 *   teks       APA ADANYA (keputusan 55): hanya baris PDF yang terpotong disambung dan spasi ganda dirapatkan
 *   ringkas    ringkasan pendek ATURAN (bukan AI): kalimat pertama tanpa nomor/"Bahwa", paling panjang 160 huruf
 *   jenis      posita-fakta | alasan-hukum | petitum
 *   huruf      huruf alasan perceraian (A-H) yang ditunjuk kamus rincian alasan (deteksi/alasanRincian) - hanya perkara cerai
 *   tanggapan  tanggapan pihak lawan: diakui | dibantah | diakui-sebagian | tidak-jelas | tidak-ditanggapi | belum-dijawab,
 *              + ragu (true = periksa) + rincian [{dari, sumber, nomor, status, cara, kutipan}]; null untuk petitum/kesimpulan
 *   pembuktian null (diisi agen A2 nanti; disimpan portal terpisah supaya hitung ulang tidak menghapusnya)
 *
 * Pencocokan tanggapan (aturan, bukan AI), urut kekuatan:
 *   1. rujukan nomor   "membenarkan dalil permohonan Pemohon angka 1", "menolak dalil angka 4 dan angka 5", "angka 1 s/d 3";
 *                      sikap dibaca per klausa yang memuat rujukan; butir a./b. ikut induknya (cara rujukan-induk)
 *   2. kemiripan isi   kata isi bersama (>= 3 kata, koefisien tumpang >= 0,45) dengan dalil yang tidak dirujuk; < 0,6 = ragu
 *   3. bantahan umum   "menolak seluruh dalil gugatan kecuali yang diakui secara tegas" -> sisa dalil dibantah (ragu);
 *                      petitum "menolak gugatan seluruhnya" tanpa tanggapan lain = dibantah lemah (ragu)
 * Bertentangan antarberkas (jawaban mengakui, duplik membantah) = ragu.
 */

const crypto = require("crypto");
const T = require("./tuntutanDeteksiService");
const J = require("./jawabMenjawabEcourtService");
const NJ = require("./naskahJawabMenjawabService");
const U = require("./abtUsulanService");

const VERSI = 1;
const BATAS_DALIL = 400;
const BATAS_TEKS_DALIL = 6000;

// ─── Paragraf ────────────────────────────────────────────────────────────────

/** Entitas HTML umum -> hurufnya (polosPosita mengganti entitas dengan spasi; teks pihak harus tetap apa adanya). */
function dekodeEntitas(html) {
  return String(html || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&rsquo;|&lsquo;/gi, "'")
    .replace(/&rdquo;|&ldquo;/gi, '"')
    .replace(/&ndash;/gi, "-")
    .replace(/&mdash;/gi, "-");
}

/** Berkas e-Court -> paragraf isi (kop/salam/identitas/penutup dibuang oleh pemotong naskah 12020-12028). */
function paragrafSurat(teks) {
  const { baris } = J.barisSurat(T.rapikanTeks(teks));
  const potong = NJ.potongIsi(NJ.susunParagraf(baris));
  return { par: potong.isi.map((p) => ({ teks: p.teks, judul: p.judul || null })), yakin: potong.yakin };
}

/** HTML posita/petitum SIPP -> paragraf (satu baris HTML = satu paragraf; struktur br/p/div SIPP sudah tegas). */
function paragrafSipp(html, opsi) {
  const baris = [];
  for (const t0 of U.polosPosita(dekodeEntitas(html)).split("\n")) {
    const t = t0.replace(/\s+/g, " ").trim();
    if (!t || t.replace(/[^A-Za-z]/g, "").length < 2) continue;
    const sebelum = baris[baris.length - 1];
    // Baris yang dipatahkan <br> di tengah kalimat ("... dikaruniai seorang anak yang" / "kini tinggal bersama Penggugat") disambung
    // ke baris sebelumnya - pemulihan tata letak, isi tidak berubah. "bahwa ..." berhuruf kecil tetap butir baru.
    if (sebelum && /^[a-z]/.test(t) && !NJ.pisahPenanda(t).penanda && !/^bahwa\b/.test(t) && !/[.;:!?]$/.test(sebelum)) baris[baris.length - 1] = `${sebelum} ${t}`;
    else baris.push(t);
  }
  // Seluruh surat dalam SATU baris (posita 2020 tanpa ganti baris): dipecah tepat sebelum tiap "N. Bahwa"/"Bahwa" yang mengawali
  // kalimat - potongan teksnya tetap persis, hanya batas paragrafnya yang dipulihkan.
  const pecah = [];
  for (const t of baris) {
    const awal = [];
    if (t.length > 800) {
      const re = /(?:^|[;.:]\s+)((?:\d{1,2}\s*[.)]\s*)?Bahwa\b)/g;
      let mm;
      while ((mm = re.exec(t)) !== null) awal.push(mm.index + mm[0].length - mm[1].length);
    }
    if (awal.length < 3) {
      pecah.push(t);
      continue;
    }
    let dari = 0;
    for (const a of awal) {
      if (a > dari) pecah.push(t.slice(dari, a).trim());
      dari = a;
    }
    pecah.push(t.slice(dari).trim());
  }
  const par = pecah.filter(Boolean).map((t) => ({ teks: t, judul: NJ.judulBaku(t) }));
  // Posita lama (2015-2020) memuat seluruh surat: kop, salam, identitas, petitum, penutup, tanda tangan - dibuang dengan pemotong
  // naskah yang sama dengan berkas e-Court. Petitum tidak dipotong di sini (kolom petitum SIPP sumbernya).
  if (!(opsi && opsi.potong)) return par;
  const isi = NJ.potongIsi(par).isi.map((x) => ({ teks: x.teks, judul: x.judul || null }));
  // Pemotong tidak menemukan isi (mis. identitas dan dalil bercampur dalam satu paragraf): paragraf apa adanya.
  return isi.length ? isi : par;
}

// ─── Nomor, jenis, ringkasan ─────────────────────────────────────────────────

const RE_HUKUM =
  /\b(?:pasal\s+\d+|undang[\s-]*undang|UU\s*(?:No|Nomor|RI|\d)|kompilasi\s+hukum\s+islam|KHI|peraturan\s+(?:pemerintah|mahkamah\s+agung)|PP\s+(?:No|Nomor)|yurisprudensi|SEMA|PERMA|putusan\s+mahkamah\s+agung|HIR|R\.?Bg|firman\s+allah|QS\.?\s|al[\s-]?qur'?an|hadits?|kaidah\s+fiqh|doktrin)\b/i;

/** Sisa penutup yang lolos pemotong naskah ("Hormat Pemohon,", "Kuasa Hukum Penggugat") - bukan dalil. */
const RE_PENUTUP_PENDEK = /^(?:hormat\b|wassalam|wabillahi|tertanda\b|kuasa\s+hukum\b|(?:pemohon|penggugat|termohon|tergugat)\s*,?\s*$)/i;

function bagianDariJudul(judul, kini) {
  if (judul === "Dalam Eksepsi") return "eksepsi";
  if (judul === "Dalam Pokok Perkara") return kini === "rekonvensi" ? "rekonvensi" : "pokok";
  if (judul === "Dalam Konvensi") return "konvensi";
  if (judul === "Dalam Rekonvensi") return "rekonvensi";
  if (judul === "Dalam Provisi") return "provisi";
  if (judul === "Dalam Konvensi dan Rekonvensi") return "konvensi";
  return kini;
}

/** Awal butir petitum/amar ("Mengabulkan ...", "Primair", "Apabila Majelis berpendapat lain ..."). */
const RE_AMAR_AWAL =
  /^(?:Mengabulkan|Menolak|Menyatakan|Menetapkan|Menghukum|Membebankan|Memberi(?:kan)?\s+izin|Menjatuhkan|Memerintahkan|Mengizinkan|Menerima|Menceraikan|Memutuskan|Mewajibkan|Menyerahkan|Membagi|Mengesahkan|Membatalkan|Meletakkan|Mengangkat|Primair|Primer|Subsidair|Subsider|Atau\b|Apabila|Jika|Mohon)/i;

/** Ringkasan aturan: tanpa nomor dan "Bahwa", kalimat/klausa pertama, paling panjang 160 huruf (dipotong di batas kata). */
function ringkasDalil(teks) {
  let s = NJ.pisahPenanda(String(teks || "")).isi.replace(/^\s*(?:bahwa|BAHWA|Bahwa)\b[\s,]*/, "").trim();
  if (!s) return "";
  const ujung = s.search(/;|\.(?=\s+[A-Z])|:\s*$/);
  if (ujung >= 30) s = s.slice(0, ujung);
  s = s.replace(/[\s;:,.]+$/, "");
  if (s.length <= 160) return s.charAt(0).toUpperCase() + s.slice(1);
  const potong = s.slice(0, 160);
  const spasi = potong.lastIndexOf(" ");
  return `${(spasi > 100 ? potong.slice(0, spasi) : potong).replace(/[\s,;:]+$/, "").replace(/^./, (h) => h.toUpperCase())} ...`;
}

function normalTeks(t) {
  return String(t || "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const KODE_SUMBER = { gugatan: "G", jawaban: "J", replik: "R", duplik: "D", kesimpulan: "K", rekonvensi: "GR" };

function idDalil(sumber, bagian, pihak, teks) {
  const h = crypto.createHash("sha1").update(`${sumber}|${bagian}|${pihak}|${normalTeks(teks)}`).digest("hex").slice(0, 10);
  return `${KODE_SUMBER[sumber] || "X"}-${h}`;
}

/**
 * Paragraf satu berkas -> dalil (tanpa tanggapan). sumberDasar = peran berkas; bagian rekonvensi jawaban menjadi sumber "rekonvensi".
 * @param {Array<{teks:string, judul:string|null}>} par
 * @param {{sumber:string, pihak:string, sebutan:string, asal:string, dokumen:string, diunggah:string, ocr:boolean, semuaPetitum?:boolean, indeks:number}} m
 */
function dalilDariParagraf(par, m) {
  const hasil = [];
  // Posita SIPP: petitumnya kolom tersendiri - "7. Bahwa berdasarkan dalil di atas ... mohon" di posita tetap posita.
  const awalPetitum = m.semuaPetitum ? 0 : m.tanpaPetitum ? -1 : NJ.cariAwalPetitum(par);
  let bagian = m.sumber === "gugatan" ? "pokok" : "konvensi";
  let petitum = Boolean(m.semuaPetitum);
  let sudahAmar = Boolean(m.semuaPetitum);
  let induk = null; // dalil bernomor terakhir (tingkat atas)
  let anakKe = 0;
  const adaNomor = par.some((p) => !p.judul && /^\d/.test(NJ.pisahPenanda(p.teks).penanda));
  // Gaya nomor tingkat atas = gaya butir "Bahwa" bernomor pertama ("1." / "1)" / "(1)"); nomor bergaya lain ("(3)" kutipan pasal,
  // "1)" daftar anak) adalah anak butir. Posita "Bahwa ..." tanpa nomor: butir Bahwa diberi nomor urut, daftar bernomor di
  // dalamnya menjadi anak butir.
  const gayaNomor = (pn) => (/^\(\d/.test(pn) ? "kurung" : /^\d[\d.]*\)$/.test(pn) ? "tutup" : /^\d/.test(pn) ? "titik" : "");
  const pertamaBahwa = par.find((p) => !p.judul && /^\(?\d{1,2}\)?[.)]?$/.test(NJ.pisahPenanda(p.teks).penanda) && /^bahwa\b/i.test(NJ.pisahPenanda(p.teks).isi));
  const pertamaNomor = par.find((p) => !p.judul && gayaNomor(NJ.pisahPenanda(p.teks).penanda));
  const gayaAtas = gayaNomor(NJ.pisahPenanda((pertamaBahwa || pertamaNomor || { teks: "" }).teks).penanda);
  const modeUrut = !m.semuaPetitum && !pertamaBahwa && par.filter((p) => !p.judul && /^bahwa\b/i.test(p.teks)).length >= 2;
  // Butir sebelum nomor pertama yang kehilangan nomornya (daftar <ol>/<li> SIPP: "Bahwa ...", "Bahwa ...", lalu "4. Bahwa ...";
  // petitum "Mengabulkan ..." lalu "2. Menjatuhkan ...") diberi nomor urut sejauh cocok dengan nomor pertama itu.
  const indeksNomorPertama = par.findIndex((p) => !p.judul && /^\d{1,2}[.)]?$/.test(NJ.pisahPenanda(p.teks).penanda));
  const nomorPertama = indeksNomorPertama >= 0 ? Number(/^\d+/.exec(NJ.pisahPenanda(par[indeksNomorPertama].teks).penanda)[0]) : 0;
  const RE_AMAR_URUT = /^(?:Mengabulkan|Menolak|Menyatakan|Memutuskan|Menetapkan|Menghukum|Membebankan|Memberi|Menjatuhkan|Memerintahkan|Mengizinkan|Menceraikan|Mewajibkan|Menyerahkan|Membagi|Mengesahkan)/i;
  const sebelumNomorPertama = (i, teks) =>
    indeksNomorPertama > i && urutTanpaNomor + 1 < nomorPertama && (m.semuaPetitum ? RE_AMAR_URUT.test(teks) : /^bahwa\b/i.test(teks));
  let urutTanpaNomor = 0;
  par.forEach((p, i) => {
    if (i === awalPetitum && awalPetitum >= 0) petitum = true;
    if (p.judul) {
      if (/^(?:Primair|Subsidair|Lebih Subsidair|Petitum):$/.test(p.judul)) petitum = true;
      bagian = bagianDariJudul(p.judul, bagian);
      induk = null;
      anakKe = 0;
      return;
    }
    const teks = String(p.teks || "").replace(/\s+/g, " ").trim().slice(0, BATAS_TEKS_DALIL);
    if (!teks || (teks.length < 80 && RE_PENUTUP_PENDEK.test(teks))) return;
    const { penanda } = NJ.pisahPenanda(teks);
    let nomor = "";
    let tingkatAtas = false;
    let dariUrutan = false;
    const subKurung = !penanda ? /^\(?(\d{1,2})\)\s*\.?\s*(?=\S)/.exec(teks) : null;
    if (/^\(?\d/.test(penanda) && !petitum && (modeUrut || (gayaAtas && gayaNomor(penanda) !== gayaAtas)) && induk) {
      // Daftar bernomor di dalam butir (gaya lain dari nomor tingkat atas): anak butir induknya.
      const n = penanda.replace(/[()\s]/g, "").replace(/[.)]+$/, "");
      nomor = n.includes(".") ? n : `${induk.nomor}.${n}`;
    } else if (/^\(?\d/.test(penanda)) {
      nomor = penanda.replace(/[()\s]/g, "").replace(/[.)]+$/, "");
      tingkatAtas = !nomor.includes(".");
    } else if (subKurung && induk && !petitum) {
      // "1). Abdul Farel ..." (penanda yang tidak dikenali pemotong naskah) di dalam butir: anak butir.
      nomor = `${induk.nomor}.${subKurung[1]}`;
    } else if (/^\(?[a-z]\)?\.?$/.test(penanda) || /^\(?[a-z][.)]/.test(penanda)) {
      const huruf = penanda.replace(/[^a-z]/g, "");
      nomor = induk ? `${induk.nomor}.${huruf}` : huruf;
    } else if (/^[-\u2022\u2013\u2014*]$/.test(penanda)) {
      anakKe += 1;
      nomor = induk ? `${induk.nomor}-${anakKe}` : "";
    } else if (/^[IVX]+\.?$|^[A-H][.)]$/.test(penanda)) {
      nomor = penanda.replace(/[.)]$/, "");
      tingkatAtas = true;
    } else if (((modeUrut || !adaNomor) && /^bahwa\b/i.test(teks) && !petitum) || (!penanda && sebelumNomorPertama(i, teks))) {
      urutTanpaNomor += 1;
      nomor = String(urutTanpaNomor);
      tingkatAtas = true;
      dariUrutan = true;
    } else if (/^\d{1,2}\.\d{1,2}(?:\.\d{1,2})*\s+\S/.test(teks)) {
      // Nomor bertingkat tanpa titik penutup ("3.1 SADAM ...", "4.2 Tergugat ...") - anak butir induknya.
      nomor = /^(\d{1,2}(?:\.\d{1,2})+)/.exec(teks)[1];
    } else if (m.semuaPetitum && !adaNomor && RE_AMAR_URUT.test(teks)) {
      // Petitum SIPP dari daftar <ol>/<li> kehilangan nomornya: diberi nomor urut (ditandai), "Subsidair/Apabila ..." tidak.
      urutTanpaNomor += 1;
      nomor = String(urutTanpaNomor);
      tingkatAtas = true;
      dariUrutan = true;
    }
    const sumber = m.sumber === "jawaban" && bagian === "rekonvensi" ? "rekonvensi" : m.sumber;
    const isi = NJ.pisahPenanda(teks).isi;
    if (petitum && RE_AMAR_AWAL.test(isi)) sudahAmar = true;
    // Butir "Bahwa ..." sesudah kalimat pembuka petitum tetapi sebelum amar pertama (mis. "8. Bahwa Penggugat sanggup membayar biaya
    // perkara") masih posita; kalimat pembuka bernomor "7. Bahwa berdasarkan ... mohon" ditandai pembuka dan tetap posita.
    const masihPosita = petitum && !sudahAmar && /^bahwa\b/i.test(isi);
    // Eksepsi = keberatan hukum acara (kabur, kurang pihak, kewenangan) - bukan fakta yang dibuktikan saksi.
    const jenis = petitum && !masihPosita ? "petitum" : bagian === "eksepsi" || RE_HUKUM.test(teks) ? "alasan-hukum" : "posita-fakta";
    const d = {
      id: "",
      sumber,
      pihak: m.pihak,
      sebutan: m.sebutan,
      bagian,
      nomor,
      urut: hasil.length + 1,
      induk: !tingkatAtas && induk && nomor ? induk.id : null,
      lanjutan: !nomor && induk ? induk.id : null,
      teks,
      ringkas: ringkasDalil(teks),
      jenis,
      huruf: [],
      tanggapan: null,
      pembuktian: null,
      asal: m.asal,
      dokumen: m.dokumen,
      diunggah: m.diunggah,
      ocr: m.ocr,
      berkas: m.indeks,
      ...(petitum && i === awalPetitum ? { pembuka: true } : {}),
      ...(dariUrutan ? { nomorDariUrutan: true } : {}),
    };
    d.id = idDalil(sumber, bagian, m.pihak, teks);
    if (tingkatAtas) {
      induk = d;
      anakKe = 0;
    }
    hasil.push(d);
  });
  return hasil;
}

// ─── Sikap & rujukan ─────────────────────────────────────────────────────────

const RE_AKUI_NEGASI = /\btidak\s+(?:membantah|dibantah|menyangkal|disangkal|keberatan|menolak)\b/gi;
const RE_BANTAH_NEGASI = /\btidak\s+(?:benar|betul)\b|\bbukan\s+(?:benar|demikian)\b/gi;
const RE_BANTAH =
  /\b(?:tidak\s+benar|tidak\s+(?:sesuai|betul|tepat)|bukan\s+(?:benar|demikian)|membantah|dibantah|bantah(?:an)?|menyangkal|disangkal|menolak|ditolak|keberatan|bohong|fitnah|mengada[\s-]*ada|keliru|rekayasa|tidak\s+pernah|sama\s+sekali\s+tidak|tidaklah|tidak\s+(?:berdasar|beralasan))\b/i;
const RE_AKUI =
  /\b(?:membenarkan|dibenarkan|mengakui|diakui|benar\s+(?:bahwa|adanya|demikian)|adalah\s+benar|memang\s+benar|memang|betul|sependapat|sesuai\s+(?:dengan\s+)?(?:fakta|kenyataan)|tidak\s+(?:membantah|menyangkal|keberatan|menolak))\b/i;

const RE_SANGGUP = /\b(?:bersedia|sanggup|menyanggupi|kesanggupan)\b/i;

/** Sikap satu klausa: diakui | dibantah | diakui-sebagian | "" (tidak bersikap). */
function sikapKlausa(klausa) {
  const t = String(klausa || "");
  // Kesanggupan ("bersedia memberikan nafkah iddah ...", "sanggup ...") = mengakui tuntutan dengan besaran/syaratnya sendiri.
  if (RE_SANGGUP.test(t) && !RE_BANTAH.test(t.replace(RE_AKUI_NEGASI, " "))) return "diakui-sebagian";
  const tanpaNegasiAku = t.replace(RE_AKUI_NEGASI, " ");
  const tanpaNegasiBantah = t.replace(RE_BANTAH_NEGASI, " ");
  const bantah = RE_BANTAH.test(tanpaNegasiAku);
  const aku = RE_AKUI.test(tanpaNegasiBantah);
  if (bantah && aku) return "diakui-sebagian";
  if (aku) return /\bsebagian\b/i.test(t) ? "diakui-sebagian" : "diakui";
  if (bantah) return "dibantah";
  // Kamus deteksi (kelompok gugatan, peran jawab) - pola yang dapat ditambah Super Admin.
  try {
    const s = T.sikapJawaban(t.length >= 25 ? t : `${t} ${" ".repeat(25)}`);
    if (s.dibantah.length && s.diakui.length) return "diakui-sebagian";
    if (s.dibantah.length) return "dibantah";
    if (s.diakui.length) return "diakui";
  } catch (_) {
    /* kamus tidak terbaca: aturan di atas saja */
  }
  return "";
}

/** Pecah paragraf tanggapan menjadi klausa sikap (titik koma, kalimat baru, "namun/tetapi/sedangkan"). */
function klausaDari(teks) {
  return String(teks || "")
    .split(/;|\.\s+(?=[A-Z])|\s*,?\s*\b(?:namun(?:\s+demikian)?|akan\s+tetapi|tetapi|sedangkan|melainkan|adapun)\b\s*/i)
    .map((k) => (k || "").trim())
    .filter(Boolean);
}

const RE_RUJUK =
  /\b(?:angka|nomor|nomer|no\.|poin|point|butir|posita|dalil)\s*(?:ke\s*-?\s*)?(\d{1,2})((?:\s*(?:,|dan|serta|&|s\.?\s*\/\s*d\.?|s\.d\.?|sampai\s+dengan|sampai|hingga|-|–)\s*(?:(?:angka|nomor|nomer|poin|point|butir)\s*)?\d{1,2}\b)*)/gi;
const RE_RUJUK_BUKAN_SESUDAH = /^\s*(?:tahun|\/|\.\d|[,.]\d|\d)/i;
const RE_RUJUK_BUKAN_SEBELUM = /(?:undang[\s-]*undang|\buu\b|\bpp\b|peraturan|pasal|perkara|akta|register|kutipan|surat\s+(?:keterangan|kuasa|nikah)|keputusan|sema|perma|putusan|reg\.?)[^.;]{0,14}$/i;

/** Daftar nomor dari bagian rujukan "4 dan angka 5" / "1 s/d 3" / "1, 2 dan 3". */
function nomorRujukan(pertama, sisa) {
  const hasil = [Number(pertama)];
  const re = /(,|dan|serta|&|s\.?\s*\/\s*d\.?|s\.d\.?|sampai\s+dengan|sampai|hingga|-|–)\s*(?:(?:angka|nomor|nomer|poin|point|butir)\s*)?(\d{1,2})/gi;
  let m;
  while ((m = re.exec(String(sisa || ""))) !== null) {
    const n = Number(m[2]);
    const sebelum = hasil[hasil.length - 1];
    if (/^(?:s|sampai|hingga|-|–)/i.test(m[1]) && n > sebelum && n - sebelum <= 40) for (let k = sebelum + 1; k <= n; k += 1) hasil.push(k);
    else hasil.push(n);
  }
  return [...new Set(hasil.filter((n) => n >= 1 && n <= 99))];
}

/** Sasaran rujukan menurut kata di depannya: gugatan | jawaban | replik | duplik | rekonvensi | "" (tidak disebut). */
function sasaranRujukan(depan) {
  const s = String(depan || "").toLowerCase().slice(-90);
  const posisi = [
    ["rekonvensi", s.search(/rekon[pv]ensi(?![\s\S]*rekon[pv]ensi)/)],
    ["duplik", s.search(/duplik(?![\s\S]*duplik)/)],
    ["replik", s.search(/replik(?![\s\S]*replik)/)],
    ["jawaban", s.search(/jawab(?:an)?(?![\s\S]*jawab)/)],
    ["gugatan", s.search(/(?:gugatan|permohonan|posita)(?![\s\S]*(?:gugatan|permohonan|posita))/)],
  ].filter((x) => x[1] >= 0);
  if (!posisi.length) return "";
  posisi.sort((a, b) => b[1] - a[1]);
  return posisi[0][0];
}

/**
 * Rujukan nomor di satu paragraf tanggapan -> [{nomor:number[], sasaran, sikap, klausa}].
 * Sikap dibaca dari klausa yang memuat rujukan; bila klausanya tidak bersikap, dari klausa berikutnya dalam paragraf yang sama.
 */
function rujukanDi(teks) {
  const hasil = [];
  const klausa = klausaDari(teks);
  klausa.forEach((k, i) => {
    RE_RUJUK.lastIndex = 0;
    let m;
    while ((m = RE_RUJUK.exec(k)) !== null) {
      const sesudah = k.slice(m.index + m[0].length, m.index + m[0].length + 10);
      const sebelum = k.slice(0, m.index);
      if (RE_RUJUK_BUKAN_SESUDAH.test(sesudah) || RE_RUJUK_BUKAN_SEBELUM.test(sebelum)) continue;
      const nomor = nomorRujukan(m[1], m[2]);
      if (!nomor.length) continue;
      let sikap = sikapKlausa(k);
      if (!sikap && klausa[i + 1] && !RE_RUJUK.test(klausa[i + 1])) sikap = sikapKlausa(klausa[i + 1]);
      RE_RUJUK.lastIndex = m.index + m[0].length;
      hasil.push({ nomor, sasaran: sasaranRujukan(`${klausa.slice(Math.max(0, i - 1), i).join(" ")} ${sebelum}`), sikap, klausa: k });
    }
  });
  return hasil;
}

const RE_UMUM_BANTAH =
  /\b(?:menolak|membantah|menyangkal|tidak\s+membenarkan)\b[^.;]{0,80}\b(?:seluruh|semua|segala|keseluruhan)\b[^.;]{0,60}\b(?:dalil|posita|gugatan|permohonan|replik|jawaban|alasan)/i;
const RE_UMUM_BANTAH_KECUALI = /\b(?:menolak|membantah|menyangkal)\b\s+(?:dengan\s+tegas\s+)?(?:dalil[\s-]*dalil|posita)\b[^.;]{0,80}\bkecuali\b/i;
const RE_UMUM_AKUI = /\b(?:membenarkan|mengakui)\b[^.;]{0,60}\b(?:seluruh|semua|segala|keseluruhan)\b[^.;]{0,40}\b(?:dalil|posita|isi\s+gugatan|isi\s+permohonan)/i;
const RE_PETITUM_TOLAK = /\b(?:menolak)\s+(?:gugatan|permohonan)\b[^.;]{0,80}\b(?:seluruh(?:nya)?|untuk\s+seluruhnya)\b|\btidak\s+dapat\s+diterima\b/i;

// ─── Kemiripan isi ───────────────────────────────────────────────────────────

const KATA_UMUM = new Set(
  (
    "bahwa yang dengan tersebut adalah karena telah tidak akan untuk dalam pada dari oleh sebagai atau juga sudah belum bukan hanya kepada " +
    "terhadap antara serta para pihak penggugat tergugat pemohon termohon konvensi rekonvensi rekonpensi konpensi dalil dalilnya gugatan " +
    "permohonan jawaban replik duplik majelis hakim angka nomor benar membenarkan menolak membantah mengakui diakui dibantah halnya " +
    "sebagaimana seperti selama sejak sampai hingga ketika saat masih lagi kembali setelah sebelum kemudian namun tetapi akan tetap " +
    "dapat bisa harus selalu sering pernah sangat lebih kurang adapun maka sehingga agar supaya jika apabila bila kalau yaitu yakni " +
    "kami saya kita mereka beliau tanggal bulan tahun hari demikian sebenarnya sebetulnya kenyataannya fakta faktanya justru"
  ).split(/\s+/)
);

function kataIsi(teks) {
  const hasil = new Set();
  const isi = NJ.pisahPenanda(teks).isi;
  // Nominal ("Rp2.000.000,00") menjadi satu kata "2000000": tanda kuat bahwa dua butir membicarakan tuntutan yang sama.
  for (const n of isi.match(/\d{1,3}(?:\.\d{3})+/g) || []) hasil.add(n.replace(/\./g, ""));
  for (const w of normalTeks(isi).split(" ")) {
    if (!w) continue;
    if (/^\d+$/.test(w)) {
      if (w.length === 4) hasil.add(w);
      continue;
    }
    if (w.length < 4 || KATA_UMUM.has(w)) continue;
    hasil.add(w.length > 7 ? w.replace(/(?:nya|lah|kan|an)$/, "") : w);
  }
  return hasil;
}

function tumpang(a, b) {
  if (!a.size || !b.size) return { skor: 0, sama: 0 };
  let sama = 0;
  for (const x of a) if (b.has(x)) sama += 1;
  return { skor: sama / Math.min(a.size, b.size), sama };
}

// ─── Tanggapan ───────────────────────────────────────────────────────────────

/**
 * Siapa menanggapi siapa: sasaran (sumber dalil) -> daftar penanggap {sumber, bagian}. Bagian rekonvensi replik = jawaban
 * rekonvensi (Penggugat menanggapi gugatan rekonvensi); duplik yang diunggah Penggugat (rereplik) = duplik rekonvensi.
 */
function penanggap(dalil) {
  if (dalil.sumber === "gugatan") return (x) => (x.sumber === "jawaban" || x.sumber === "duplik") && x.pihak === "0047" && x.bagian !== "rekonvensi";
  if (dalil.sumber === "rekonvensi") return (x) => x.pihak === "0046" && (x.sumber === "replik" || x.sumber === "duplik") && (x.bagian === "rekonvensi" || x.sumber === "duplik");
  if (dalil.sumber === "jawaban") return (x) => x.sumber === "replik" && x.pihak === "0046" && x.bagian !== "rekonvensi";
  if (dalil.sumber === "replik" && dalil.bagian !== "rekonvensi") return (x) => x.sumber === "duplik" && x.pihak === "0047" && x.bagian !== "rekonvensi";
  if (dalil.sumber === "replik" && dalil.bagian === "rekonvensi") return (x) => x.sumber === "duplik" && x.pihak === "0047" && x.bagian === "rekonvensi";
  return null;
}

/** Sasaran bawaan rujukan tanpa kata benda, menurut penanggapnya. */
function sasaranBawaan(r) {
  if (r.sumber === "jawaban" || r.sumber === "rekonvensi") return "gugatan";
  if (r.sumber === "replik") return r.bagian === "rekonvensi" ? "rekonvensi" : "jawaban";
  if (r.sumber === "duplik") return r.pihak === "0046" ? "rekonvensi" : "replik";
  return "";
}

const PERINGKAT = { rujukan: 4, "rujukan-induk": 3, kemiripan: 2, umum: 1, "umum-petitum": 0 };

function kutip(t) {
  const s = String(t || "");
  return s.length > 300 ? `${s.slice(0, 297)}...` : s;
}

/** Mengisi tanggapan setiap dalil yang dapat ditanggapi (mengubah `dalil` di tempat). */
function isiTanggapan(dalil) {
  const catatan = new Map(); // id sasaran -> rincian[]
  const tambah = (sasaran, r, status, cara, ekstra) => {
    const daftar = catatan.get(sasaran.id) || [];
    if (daftar.some((x) => x.dari === r.id && x.cara === cara)) return;
    daftar.push({ dari: r.id, sumber: r.sumber, nomor: r.nomor, status: status || "tidak-jelas", cara, kutipan: kutip(r.teks), diunggah: r.diunggah || "", ...(ekstra || {}) });
    catatan.set(sasaran.id, daftar);
  };
  const dapatDitanggapi = dalil.filter((d) => d.jenis !== "petitum" && d.sumber !== "kesimpulan" && penanggap(d));
  const adaPenanggap = new Map();
  for (const d of dapatDitanggapi) adaPenanggap.set(d.id, dalil.some(penanggap(d)));

  // Penanggap: semua butir bukan petitum dari berkas jawab-menjawab.
  const pengirim = dalil.filter((r) => ["jawaban", "replik", "duplik", "rekonvensi"].includes(r.sumber));
  const kataSasaran = new Map(dapatDitanggapi.map((d) => [d.id, kataIsi(d.teks)]));
  const umum = []; // {r, status, cara}
  for (const r of pengirim) {
    if (r.jenis === "petitum") {
      if (RE_PETITUM_TOLAK.test(r.teks)) umum.push({ r, status: "dibantah", cara: "umum-petitum" });
      continue;
    }
    // 1. Rujukan nomor.
    const rujuk = rujukanDi(r.teks);
    for (const rj of rujuk) {
      const sasaranSumber = rj.sasaran || sasaranBawaan(r);
      for (const n of rj.nomor) {
        const tepat = dapatDitanggapi.filter((d) => {
          const f = penanggap(d);
          if (!f || !f(r)) return false;
          if (sasaranSumber && d.sumber !== sasaranSumber && !(sasaranSumber === "gugatan" && d.sumber === "gugatan")) return false;
          return d.nomor === String(n) || (d.nomorDariUrutan && d.nomor === String(n));
        });
        for (const d of tepat) {
          tambah(d, r, rj.sikap, "rujukan");
          for (const anak of dapatDitanggapi.filter((x) => x.induk === d.id || x.lanjutan === d.id)) tambah(anak, r, rj.sikap, "rujukan-induk");
        }
      }
    }
    // 2. Bantahan/pengakuan umum.
    const cocokUmum = RE_UMUM_BANTAH.exec(r.teks) || RE_UMUM_BANTAH_KECUALI.exec(r.teks);
    const cocokAkui = cocokUmum ? null : RE_UMUM_AKUI.exec(r.teks);
    const umumIni = cocokUmum ? "dibantah" : cocokAkui ? "diakui" : "";
    // Sasaran bantahan umum dari kata bendanya ("dalil-dalil replik" bukan bantahan atas gugatan); tanpa kata benda = sasaran bawaan.
    if (umumIni) umum.push({ r, status: umumIni, cara: "umum", sasaran: sasaranRujukan((cocokUmum || cocokAkui)[0]) || sasaranBawaan(r) });
    // 3. Kemiripan isi (hanya paragraf yang tidak merujuk nomor dan bukan tanggapan umum).
    if (rujuk.length || umumIni) continue;
    const kr = kataIsi(r.teks);
    if (kr.size < 2) continue;
    let terbaik = null;
    for (const d of dapatDitanggapi) {
      const f = penanggap(d);
      if (!f || !f(r)) continue;
      const ks = kataSasaran.get(d.id);
      const t = tumpang(kr, ks);
      const pendek = Math.min(kr.size, ks.size) <= 5;
      if (pendek ? t.sama < 2 || t.skor < 0.5 : t.sama < 3 || t.skor < 0.45) continue;
      if (!terbaik || t.skor > terbaik.skor) terbaik = { d, skor: t.skor };
    }
    if (terbaik) {
      const sikap = sikapKlausa(r.teks);
      tambah(terbaik.d, r, sikap, "kemiripan", { skor: Math.round(terbaik.skor * 100) / 100 });
    }
  }

  for (const d of dapatDitanggapi) {
    const f = penanggap(d);
    let rincian = catatan.get(d.id) || [];
    if (!rincian.length) {
      // Butir jawaban yang sendiri menanggapi gugatan ("membenarkan dalil angka 1") bukan dalil baru: bantahan umum replik tidak
      // dikenakan padanya (anak butirnya - fakta tandingan - tetap).
      const tanggapanSendiri = d.sumber !== "gugatan" && rujukanDi(d.teks).length > 0;
      const u = tanggapanSendiri ? [] : umum.filter((x) => f(x.r) && (!x.sasaran || x.sasaran === d.sumber));
      const tegas = u.find((x) => x.cara === "umum") || u[0];
      if (tegas) rincian = [{ dari: tegas.r.id, sumber: tegas.r.sumber, nomor: tegas.r.nomor, status: tegas.status, cara: tegas.cara, kutipan: kutip(tegas.r.teks), diunggah: tegas.r.diunggah || "" }];
    }
    if (rincian.length === 1 && rincian[0].cara === "umum-petitum") {
      // Petitum "menolak gugatan seluruhnya" bukan tanggapan atas dalil ini: tetap tidak ditanggapi, ditandai untuk diperiksa.
      d.tanggapan = { status: "tidak-ditanggapi", ragu: true, cara: "umum-petitum", catatan: "Tidak ditanggapi satu per satu; petitum lawan meminta gugatan ditolak seluruhnya.", rincian };
      continue;
    }
    if (!rincian.length) {
      d.tanggapan = adaPenanggap.get(d.id)
        ? { status: "tidak-ditanggapi", ragu: false, rincian: [] }
        : { status: "belum-dijawab", ragu: false, rincian: [] };
      continue;
    }
    const puncak = Math.max(...rincian.map((x) => PERINGKAT[x.cara] ?? 0));
    const utama = rincian.filter((x) => (PERINGKAT[x.cara] ?? 0) === puncak).sort((a, b) => String(a.diunggah).localeCompare(String(b.diunggah)));
    const bersikap = utama.filter((x) => x.status !== "tidak-jelas");
    const pilih = bersikap[0] || utama[0];
    const beda = new Set(bersikap.map((x) => x.status)).size > 1 || rincian.some((x) => x.status !== "tidak-jelas" && x.status !== pilih.status && (PERINGKAT[x.cara] ?? 0) >= 2);
    const ragu = beda || pilih.status === "tidak-jelas" || pilih.status === "diakui-sebagian" || pilih.cara === "umum" || pilih.cara === "umum-petitum" || (pilih.cara === "kemiripan" && Number(pilih.skor) < 0.6);
    d.tanggapan = { status: pilih.status, ragu, cara: pilih.cara, rincian: rincian.slice(0, 6) };
  }
}

// ─── Huruf alasan ────────────────────────────────────────────────────────────

/** Huruf alasan perceraian per dalil dari kamus rincian alasan (hanya bila perkara cerai dan kamusnya terbaca). */
function isiHuruf(dalil, sebutan) {
  let R;
  let set;
  try {
    R = require("./deteksi/alasanRincian");
    const jenis = /pemohon/i.test(sebutan.lawan) && /termohon/i.test(sebutan.pelaku) ? "CT" : "CG";
    set = R.polaUntuk(jenis);
  } catch (_) {
    return;
  }
  if (!set || !set.daftar || !set.daftar.length) return;
  for (const d of dalil) {
    if (d.jenis !== "posita-fakta" || !["gugatan", "rekonvensi", "jawaban"].includes(d.sumber)) continue;
    try {
      const sm = R.simpulKalimat(NJ.pisahPenanda(d.teks).isi, set, {});
      d.huruf = [...new Set(sm.map((s) => s.pola && s.pola.huruf).filter(Boolean))].sort();
    } catch (_) {
      d.huruf = [];
    }
  }
}

// ─── Rakit ───────────────────────────────────────────────────────────────────

function sebutanUntuk(pihak, sebutan) {
  return pihak === "0047" ? sebutan.pelaku : sebutan.lawan;
}

/**
 * @param {{dokumen?:Array<object>, sebutan?:{lawan:string, pelaku:string}, sipp?:{posita?:string, petitum?:string}}} masukan
 *   dokumen  bentuk saringDokumen isiGugatanService (judul, peran, teks, baca, penuntutKode, jenis, pengunggah, diunggah)
 *   sipp     posita/petitum SIPP (HTML) - dipakai bila tidak ada surat gugatan e-Court yang terbaca
 */
function susunMatriksDalil(masukan) {
  const mulai = Date.now();
  const m = masukan || {};
  const sebutan = { lawan: String((m.sebutan && m.sebutan.lawan) || "Penggugat"), pelaku: String((m.sebutan && m.sebutan.pelaku) || "Tergugat") };
  const catatan = [];
  const dokumen = [];
  let dalil = [];
  let sumberGugatan = "";
  const berkas = Array.isArray(m.dokumen) ? m.dokumen : [];
  berkas.forEach((d, indeks) => {
    if (!d || d.peran === "bukti" || String(d.teks || "").trim().length < 40) return;
    const k = d.peran === "gugatan" ? { peran: "gugatan", pihak: "0046", turut: false } : J.kenaliJenis(d);
    if (k.turut || !["gugatan", "jawaban", "replik", "duplik", "kesimpulan"].includes(k.peran)) return;
    if (k.peran === "gugatan" && sumberGugatan) return; // satu surat gugatan saja (perbaikan gugatan dibaca lebih dulu oleh portal)
    const pihak = k.peran === "gugatan" ? "0046" : k.pihak || (k.peran === "replik" ? "0046" : k.peran === "kesimpulan" ? "" : "0047");
    if (!pihak) {
      catatan.push(`${d.judul}: pihak pengunggah tidak dikenali - dalilnya tidak dimasukkan.`);
      return;
    }
    const { par, yakin } = paragrafSurat(d.teks);
    const butir = dalilDariParagraf(par, {
      sumber: k.peran,
      pihak,
      sebutan: sebutanUntuk(pihak, sebutan),
      asal: "ecourt",
      dokumen: String(d.judul || ""),
      diunggah: String(d.diunggah || ""),
      ocr: d.baca === "ocr",
      indeks,
    });
    if (k.peran === "gugatan" && butir.length) sumberGugatan = "ecourt";
    if (!yakin) catatan.push(`${d.judul}: awal isi surat tidak terpisah jelas dari kop - periksa butir pertama.`);
    dokumen.push({ indeks, judul: String(d.judul || ""), sumber: k.peran, pihak, diunggah: String(d.diunggah || ""), baca: d.baca === "ocr" ? "ocr" : "teks", jumlah: butir.length, ragu: Boolean(k.ragu) });
    dalil.push(...butir);
  });
  if (!sumberGugatan && m.sipp && String(m.sipp.posita || "").replace(/<[^>]*>/g, " ").trim().length >= 50) {
    const petitum = String(m.sipp.petitum || "").replace(/<[^>]*>/g, " ").trim()
      ? dalilDariParagraf(paragrafSipp(m.sipp.petitum), { sumber: "gugatan", pihak: "0046", sebutan: sebutan.lawan, asal: "sipp", dokumen: "petitum SIPP", diunggah: "", ocr: false, indeks: -1, semuaPetitum: true })
      : [];
    // Petitum yang ikut tersalin di kolom posita (surat lama) = salinan kolom petitum: dibuang bila kolom petitum berisi.
    const posita = dalilDariParagraf(paragrafSipp(m.sipp.posita, { potong: true }), { sumber: "gugatan", pihak: "0046", sebutan: sebutan.lawan, asal: "sipp", dokumen: "posita SIPP", diunggah: "", ocr: false, indeks: -1 }).filter(
      (d) => !(petitum.length && d.jenis === "petitum")
    );
    dalil = [...posita, ...petitum, ...dalil];
    if (posita.length) {
      sumberGugatan = "sipp";
      dokumen.unshift({ indeks: -1, judul: "posita dan petitum SIPP", sumber: "gugatan", pihak: "0046", diunggah: "", baca: "teks", jumlah: posita.length + petitum.length, ragu: false });
    }
  }
  if (dalil.length > BATAS_DALIL) {
    catatan.push(`Dalil dipotong pada ${BATAS_DALIL} butir (berkas terlalu panjang).`);
    dalil = dalil.slice(0, BATAS_DALIL);
  }
  // id kembar (dua berkas jawaban yang isinya sama, atau paragraf berulang) diberi akhiran supaya tetap unik dan stabil.
  const terpakai = new Map();
  for (const d of dalil) {
    const n = terpakai.get(d.id) || 0;
    terpakai.set(d.id, n + 1);
    if (n) d.id = `${d.id}-${n + 1}`;
  }
  dalil.forEach((d, i) => {
    d.urut = i + 1;
  });
  isiHuruf(dalil, sebutan);
  isiTanggapan(dalil);
  return { versi: VERSI, sumberGugatan, dalil, dokumen, ringkas: ringkasMatriks(dalil), catatan, ms: Date.now() - mulai };
}

/** Hitungan untuk tampilan/agen: jumlah per sumber, per jenis, per status tanggapan, dan yang ragu. */
function ringkasMatriks(dalil) {
  const per = (f) => dalil.reduce((o, d) => ((o[f(d)] = (o[f(d)] || 0) + 1), o), {});
  const ditanggapi = dalil.filter((d) => d.tanggapan);
  return {
    jumlah: dalil.length,
    perSumber: per((d) => d.sumber),
    perJenis: per((d) => d.jenis),
    tanggapan: ditanggapi.reduce((o, d) => ((o[d.tanggapan.status] = (o[d.tanggapan.status] || 0) + 1), o), {}),
    ragu: ditanggapi.filter((d) => d.tanggapan.ragu).length,
    huruf: [...new Set(dalil.flatMap((d) => d.huruf || []))].sort(),
  };
}

/**
 * Dalil tempat sebuah kalimat (mis. kalimatGugatan rincian alasan 5227, atau jawaban saksi) berasal: teks dalil memuat kalimatnya,
 * atau kata isinya bertumpang >= 0,6. -> {id, sumber, pihak, nomor} | null.
 */
function cariDalil(matriks, kalimat, opsi) {
  const daftar = matriks && Array.isArray(matriks.dalil) ? matriks.dalil : [];
  const k = normalTeks(kalimat);
  if (k.length < 12) return null;
  const sumber = opsi && opsi.sumber ? new Set(opsi.sumber) : null;
  const calon = daftar.filter((d) => d.jenis !== "petitum" && (!sumber || sumber.has(d.sumber)));
  const tepat = calon.find((d) => normalTeks(d.teks).includes(k));
  if (tepat) return { id: tepat.id, sumber: tepat.sumber, pihak: tepat.pihak, nomor: tepat.nomor, skor: 1 };
  const kk = kataIsi(kalimat);
  let terbaik = null;
  for (const d of calon) {
    const t = tumpang(kk, kataIsi(d.teks));
    if (t.sama >= 3 && t.skor >= 0.6 && (!terbaik || t.skor > terbaik.skor)) terbaik = { id: d.id, sumber: d.sumber, pihak: d.pihak, nomor: d.nomor, skor: Math.round(t.skor * 100) / 100 };
  }
  return terbaik;
}

module.exports = {
  VERSI,
  susunMatriksDalil,
  ringkasMatriks,
  cariDalil,
  // diuji langsung
  paragrafSurat,
  paragrafSipp,
  dalilDariParagraf,
  ringkasDalil,
  sikapKlausa,
  rujukanDi,
  nomorRujukan,
  kataIsi,
  idDalil,
};
