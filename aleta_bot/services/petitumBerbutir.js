"use strict";

/**
 * ============================================================================
 * PETITUM BERBUTIR (agen U6, 20 Okt 2026)
 * ============================================================================
 *
 * Petitum SIPP (perkara.petitum, HTML editor) -> daftar butir yang dapat dijadikan dasar butir amar dan pertimbangan per
 * petitum oleh U2-U5:
 *
 *     petitumBerbutir(petitumHtml, { posita, jenis, alur }) ->
 *       { ada, butir: [ { urut, nomor, bagian, utama, jenis, jenisLabel, varian, teks, nominal, dibebani, penerima,
 *                         didukungPosita, yakin, sumber } ],
 *         utama: butir yang bukan subsider/provisi,
 *         jenisAda: { "nafkah-iddah": 1, ... },
 *         ringkas: "..." }
 *
 *   - `bagian`  : primer | subsider | provisi | rekonvensi | eksepsi (menurut judul yang mendahului butir)
 *   - `jenis`   : jenis tuntutan - lihat JENIS_TUNTUTAN di bawah; "lain" bila tidak dikenal (tidak pernah dikarang)
 *   - `nominal` : { nilai, teks, cocok, perBulan, bulan, total } bila butir menyebut uang; `nilai` = angka yang tertulis di
 *                 petitum (yang DITUNTUT, bukan yang dikabulkan - besaran dikabulkan tetap keputusan majelis)
 *   - `dibebani`: P | T | "" - pihak yang diminta menanggung ("Menghukum Tergugat membayar ...")
 *   - `didukungPosita`: true/false/null - apakah posita menyebut pokok tuntutan itu (null = posita tidak diberikan)
 *   - `yakin`   : cukup bila jenis dikenali dari kata kuncinya; ragu bila butir tak dikenal ("lain") atau kalimat terpotong.
 *
 * Murni (tanpa jaringan/basis data). Teks dibersihkan dari HTML; "Primer"/"Subsider"/"Dalam Provisi"/"Dalam Rekonvensi" dibaca
 * sebagai judul bagian. Butir bernomor ("1.", "2)", "a.", "-") dipisah; baris lanjutan menempel ke butir sebelumnya;
 * sub-butir (a., b., -) di bawah butir bernomor tetap bagian butir induk dan dicatat di `sub`.
 */

const lazyT = () => require("./tuntutanDeteksiService");

/** Jenis tuntutan -> label (bahasa petugas). Urutan = urutan pemeriksaan pola (yang lebih khusus lebih dulu). */
const JENIS_TUNTUTAN = Object.freeze({
  "provisi-izin-berpisah": "Izin tinggal terpisah (provisi)",
  "talak-ikrar": "Izin mengikrarkan talak",
  "cerai-talak": "Menjatuhkan talak",
  "cerai-fasakh": "Fasakh / pembatalan nikah",
  "nafkah-iddah": "Nafkah iddah",
  mutah: "Mut'ah",
  "nafkah-madliyah": "Nafkah lampau (madliyah)",
  "nafkah-anak": "Nafkah anak",
  hadhanah: "Hak asuh anak (hadhanah)",
  "harta-bersama": "Harta bersama",
  mahar: "Mahar terutang",
  "itsbat-nikah": "Itsbat nikah",
  dispensasi: "Dispensasi kawin",
  "wali-adhal": "Wali adhal",
  perwalian: "Perwalian",
  "asal-usul-anak": "Asal usul anak",
  "ahli-waris": "Penetapan ahli waris / pembagian waris",
  hibah: "Hibah",
  wasiat: "Wasiat",
  wakaf: "Wakaf",
  poligami: "Izin poligami",
  sita: "Sita jaminan",
  "uang-paksa": "Uang paksa (dwangsom)",
  "serta-merta": "Putusan serta merta",
  eksekusi: "Perintah pelaksanaan / eksekusi",
  "pengangkatan-anak": "Pengangkatan anak",
  "ekonomi-syariah": "Sengketa ekonomi syariah",
  "pencatatan-akta": "Pemerintah mencatat / menerbitkan akta",
  biaya: "Biaya perkara",
  verstek: "Pernyataan ketidakhadiran / verstek",
  kabul: "Mengabulkan gugatan / permohonan",
  subsider: "Subsider (ex aequo et bono)",
  lain: "Lain-lain",
});

/** Pola kata kunci per jenis (diperiksa berurutan; yang pertama cocok menang). Semua pada teks huruf kecil. */
const POLA = [
  ["subsider", /ex\s*aequo|seadil[- ]?adilnya|mohon\s+putusan\s+lain/],
  ["biaya", /membebankan\s+biaya|biaya\s+perkara|membebani\s+biaya|menghukum[^.;]{0,40}membayar\s+biaya/],
  ["serta-merta", /serta\s*merta|uitvoerbaar/],
  ["uang-paksa", /uang\s*paksa|dwangsom/],
  ["sita", /sita\s*(?:jaminan|marital)|conservatoir|conservatoire|meletakkan\s+sita/],
  ["provisi-izin-berpisah", /izin[^.;]{0,30}(?:tinggal|berdiam)\s+(?:terpisah|berpisah)|tinggal\s+terpisah|berpisah\s+tempat\s+tinggal/],
  ["talak-ikrar", /izin[^.;]{0,60}(?:menjatuhkan|mengikrarkan|ikrar)\s+(?:talak|ikrar)|ikrar\s+talak/],
  ["cerai-talak", /menjatuhkan\s+talak|jatuh\s+talak|talak\s+(?:satu|1|dua|2|tiga|3)\s+(?:ba|raj)|talak\s+(?:ba|raj)/],
  ["cerai-fasakh", /fasakh|membatalkan\s+(?:perkawinan|pernikahan)|pembatalan\s+(?:perkawinan|pernikahan)/],
  ["nafkah-iddah", /nafkah\s+(?:selama\s+)?(?:masa\s+)?'?iddah|nafkah\s+idah|nafkah\s+iddah|nafkah\s+'iddah/],
  ["mutah", /mut'?ah|mutah|mut\W?ah/],
  ["nafkah-madliyah", /nafkah\s+(?:lampau|madliyah|madhiyah|madiyah|yang\s+lalu|terdahulu|yang\s+tidak\s+dibayar)|madliyah|madhiyah/],
  ["nafkah-anak", /nafkah\s+(?:untuk\s+|bagi\s+)?(?:anak|pemeliharaan|hadhanah)|biaya\s+(?:hidup|pemeliharaan|pendidikan)\s+(?:untuk\s+)?anak|biaya\s+nafkah\s+anak/],
  ["hadhanah", /hadhanah|hadanah|hak\s+asuh|hak\s+pemeliharaan|pengasuhan|pemeliharaan\s+(?:dan\s+pendidikan\s+)?anak|di\s+bawah\s+(?:asuhan|pemeliharaan)/],
  ["harta-bersama", /harta\s+bersama|harta\s+gono|gono[- ]?gini|harta\s+perkawinan|membagi\s+harta/],
  ["mahar", /mahar|maskawin|mas\s+kawin/],
  ["itsbat-nikah", /itsbat|isbat|istbat|pengesahan\s+(?:nikah|perkawinan|pernikahan)|(?:menyatakan|menetapkan)\s+sah\s+(?:perkawinan|pernikahan|nikah)|sah\s+(?:perkawinan|pernikahan)\s+(?:antara\s+)?(?:pemohon|penggugat)|bahwa\s+(?:perkawinan|pernikahan)[^.;]{0,60}sah/],
  ["verstek", /verstek|dipanggil\s+(?:secara\s+)?resmi\s+dan\s+patut|tidak\s+hadir/],
  ["dispensasi", /dispensasi/],
  ["wali-adhal", /adhal|adlal|wali\s+hakim|enggan\s+menjadi\s+wali/],
  ["perwalian", /perwalian|menunjuk[^.;]{0,30}\bwali\b|menetapkan[^.;]{0,30}\bwali\b/],
  ["asal-usul-anak", /asal\s+usul\s+anak|anak\s+sah|anak\s+kandung[^.;]{0,40}(?:dari|pasangan)|status\s+anak/],
  ["ahli-waris", /ahli\s+waris|warisan|pewaris|waris\b|faraid|tirkah|harta\s+peninggalan/],
  ["hibah", /hibah/],
  ["wasiat", /wasiat/],
  ["wakaf", /wakaf|nazhir|nadzir/],
  ["poligami", /poligami|menikah\s+lagi|beristri\s+lebih|beristeri\s+lebih|izin\s+beristri/],
  ["pengangkatan-anak", /pengangkatan\s+anak|mengangkat\s+anak|adopsi/],
  ["pencatatan-akta", /mencatat|pencatat|menerbitkan\s+(?:akta|kutipan)|kutipan\s+akta|kantor\s+urusan\s+agama[^.;]{0,40}mencatat|dukcapil/],
  ["ekonomi-syariah", /akad|murabahah|mudharabah|musyarakah|ijarah|wanprestasi|ingkar\s+janji|pembiayaan|ganti\s+rugi|kerugian/],
  ["eksekusi", /melaksanakan\s+putusan|menghukum[^.;]{0,50}(?:menyerahkan|mengosongkan)|mengosongkan/],
];
/** Butir "Mengabulkan gugatan/permohonan ..." tanpa kata kunci jenis lain. */
const POLA_KABUL = /^\s*(?:[-–•*]\s*)?(?:menerima\s+dan\s+)?(?:mengabulkan|menerima|mengabulkangugatan)\s*(?:seluruh|gugatan|permohonan|para|pemohon|penggugat)/;

/** Judul bagian petitum. */
const JUDUL = [
  ["subsider", /^(?:subsider|subsidair|subsidiair|atau\s+subsider)\b[\s:.-]*/i],
  ["primer", /^(?:primer|primair|primaire|dalam\s+pokok\s+perkara|dalam\s+konvensi|pokok\s+perkara)\b[\s:.-]*/i],
  ["provisi", /^(?:dalam\s+provisi|provisi)\b[\s:.-]*/i],
  ["rekonvensi", /^(?:dalam\s+rekonvensi|rekonvensi|gugatan\s+rekonvensi)\b[\s:.-]*/i],
  ["eksepsi", /^(?:dalam\s+eksepsi|eksepsi)\b[\s:.-]*/i],
];

const rapat = (t) => String(t == null ? "" : t).replace(/\s+/g, " ").trim();

function polosHtml(html) {
  return String(html == null ? "" : html)
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*(?:div|p|li|tr|h\d)\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n- ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#0*39;|&apos;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[‘’‛`´ʼʻ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\r\n?/g, "\n");
}

/** Penomoran awal butir: "1.", "2)", "(3)", "a.", "-", "•" -> {nomor, sisa, tingkat} */
function bacaNomor(baris) {
  let m = /^\s*(\d{1,2})\s*[.)]\s*(?!\d)(.*)$/.exec(baris);
  if (m) return { nomor: m[1], sisa: m[2], tingkat: 1 };
  m = /^\s*\((\d{1,2})\)\s*(.*)$/.exec(baris);
  if (m) return { nomor: m[1], sisa: m[2], tingkat: 1 };
  m = /^\s*([a-hA-H])\s*[.)]\s+(.*)$/.exec(baris);
  if (m) return { nomor: m[1].toLowerCase(), sisa: m[2], tingkat: 2 };
  m = /^\s*[-–•*]\s+(.*)$/.exec(baris);
  if (m) return { nomor: "-", sisa: m[1], tingkat: 2 };
  return null;
}

function bagianDariJudul(baris) {
  const t = rapat(baris);
  if (!t || t.length > 90) return null;
  for (const [nama, re] of JUDUL) {
    const m = re.exec(t);
    if (m) {
      const sisa = t.slice(m[0].length).trim();
      // judul murni (tanpa isi) atau judul + keterangan pendek
      if (!sisa || sisa.length < 40) return { nama, sisa };
    }
  }
  return null;
}

/** Jenis tuntutan dari teks butir. */
function jenisButir(teks) {
  const k = rapat(teks).toLowerCase().replace(/^[-–•*]\s*/, "");
  for (const [jenis, re] of POLA) if (re.test(k)) return jenis;
  return POLA_KABUL.test(k) ? "kabul" : "lain";
}

/** Pihak yang dibebani: kalimat "Menghukum/Membebankan/Memerintahkan X ..." dengan sebutan pihak. */
function dibebaniDari(teks) {
  const m = /\b(?:menghukum|membebankan|memerintahkan|mewajibkan|memberi\s+izin\s+kepada)\s+(?:kepada\s+)?(?:para\s+)?(pemohon|termohon|penggugat|tergugat)/i.exec(teks);
  if (!m) return "";
  const x = m[1].toLowerCase();
  return x === "penggugat" || x === "pemohon" ? "P" : "T";
}
function penerimaDari(teks) {
  const m = /\bkepada\s+(pemohon|termohon|penggugat|tergugat)/i.exec(teks);
  if (!m) return "";
  const x = m[1].toLowerCase();
  return x === "penggugat" || x === "pemohon" ? "P" : "T";
}

const ANGKA_KATA = { satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10, sebelas: 11, "dua belas": 12 };

/** Nominal pertama pada butir + periodenya (per bulan, N bulan) dan total bila dapat dihitung. */
function nominalButir(teks) {
  const T = lazyT();
  let daftar = [];
  try {
    daftar = T.nominalDari(teks);
  } catch {
    daftar = [];
  }
  if (!daftar.length) return null;
  const n = daftar[0];
  const k = rapat(teks).toLowerCase();
  const perBulan = /(?:setiap|tiap|per|sebulan|\/)\s*bulan|perbulan|per\s*bulan/.test(k);
  let bulan = null;
  const m = /(?:selama|sebanyak|sejak|\bx|dikali|kali)\s*(\d{1,3})\s*(?:\([a-z\s]+\)\s*)?bulan/.exec(k) || /(\d{1,3})\s*(?:\([a-z\s]+\)\s*)?bulan\s*(?:x|kali|dikali)/.exec(k) || /(\d{1,3})\s*(?:\([a-z\s]+\)\s*)?bulan/.exec(k);
  if (m) bulan = Number(m[1]);
  else {
    const mk = /selama\s+(dua belas|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas)\s+bulan/.exec(k);
    if (mk) bulan = ANGKA_KATA[mk[1]] || null;
  }
  const total = perBulan && bulan && daftar.length === 1 ? n.nilai * bulan : n.nilai;
  return { nilai: n.nilai, teks: n.teks, cocok: n.cocok, perBulan, bulan, total, jumlahNominal: daftar.length };
}

const KATA_DUKUNG = {
  "nafkah-iddah": /iddah|idah/i,
  mutah: /mut'?ah/i,
  "nafkah-madliyah": /madliyah|madhiyah|lampau|tidak\s+(?:memberi|diberi|memberikan)\s+nafkah|nafkah\s+(?:yang\s+)?(?:lalu|terdahulu)/i,
  "nafkah-anak": /nafkah\s+anak|biaya\s+(?:hidup|pendidikan|pemeliharaan)/i,
  hadhanah: /hadhanah|hak\s+asuh|pengasuhan|pemeliharaan|diasuh|asuh/i,
  "harta-bersama": /harta\s+bersama|harta\s+gono|gono|harta\s+yang\s+diperoleh/i,
  mahar: /mahar|mas\s*kawin|maskawin/i,
  "uang-paksa": /uang\s*paksa|dwangsom/i,
  sita: /sita/i,
};

function adaDiPosita(jenis, posita) {
  if (posita == null) return null;
  const re = KATA_DUKUNG[jenis];
  if (!re) return null;
  return re.test(polosHtml(posita));
}

/** Varian singkat: ba'in/raj'i, satu/dua/tiga, sughra/kubra. */
function varianButir(jenis, teks) {
  const k = rapat(teks).toLowerCase();
  if (jenis === "cerai-talak" || jenis === "talak-ikrar") {
    const bain = /ba'?in|bain/.test(k);
    const raji = /raj'?i|raji/.test(k);
    const sughra = /sughra|shughra|sugra/.test(k);
    const kubra = /kubra|kubro/.test(k);
    const ke = /talak\s+(?:satu|1|i\b)/.test(k) ? "satu" : /talak\s+(?:dua|2)/.test(k) ? "dua" : /talak\s+(?:tiga|3)/.test(k) ? "tiga" : "";
    return [ke ? `talak ${ke}` : "", bain ? (sughra ? "ba'in sughra" : kubra ? "ba'in kubra" : "ba'in") : raji ? "raj'i" : ""].filter(Boolean).join(" ");
  }
  if (jenis === "hadhanah") {
    if (/di\s+bawah\s+(?:asuhan|pemeliharaan)\s+(?:pemohon|penggugat)|kepada\s+(?:pemohon|penggugat)/.test(k)) return "kepada Penggugat/Pemohon";
    if (/(?:tergugat|termohon)/.test(k) && /asuh|pelihara/.test(k)) return "kepada Tergugat/Termohon";
  }
  return "";
}

/**
 * @param {string} petitumHtml
 * @param {{posita?: string, jenis?: number, alur?: number}} [opsi]
 */
function petitumBerbutir(petitumHtml, opsi) {
  const o = opsi && typeof opsi === "object" ? opsi : {};
  const polos = polosHtml(petitumHtml);
  const baris = polos.split("\n").map((b) => b.replace(/\s+$/, ""));
  const butir = [];
  let bagian = "primer";
  let sedangSubsider = false;
  let induk = null;
  const tutup = () => {
    if (induk) {
      induk.teks = rapat(induk.teks);
      induk = null;
    }
  };
  for (const mentah of baris) {
    const b = mentah.trim();
    if (!b) continue;
    const judul = bagianDariJudul(b);
    if (judul) {
      tutup();
      bagian = judul.nama;
      sedangSubsider = bagian === "subsider";
      if (judul.sisa) {
        // judul + butir sebaris ("Subsider: Jika Majelis Hakim berpendapat lain ...")
        induk = { nomor: "", teks: judul.sisa, bagian, sub: [] };
        butir.push(induk);
      }
      continue;
    }
    const nm = bacaNomor(b);
    if (nm && nm.tingkat === 1) {
      tutup();
      induk = { nomor: nm.nomor, teks: nm.sisa, bagian, sub: [] };
      butir.push(induk);
    } else if (nm && nm.tingkat === 2 && induk) {
      induk.sub.push(rapat(nm.sisa));
      induk.teks += ` ${nm.sisa}`;
    } else if (induk) {
      induk.teks += ` ${b}`;
    } else if (b.length > 3) {
      // teks tanpa penomoran sebelum butir pertama: satu butir sendiri
      induk = { nomor: "", teks: b, bagian, sub: [] };
      butir.push(induk);
    }
  }
  tutup();

  const hasil = butir
    .filter((b) => b.teks.length >= 3)
    .map((b, i) => {
      const teks = rapat(b.teks);
      let jenis = b.bagian === "subsider" ? "subsider" : jenisButir(teks);
      if (b.bagian === "subsider" && !/ex\s*aequo|seadil/.test(teks.toLowerCase())) jenis = jenisButir(teks);
      const nominal = jenis === "subsider" || jenis === "biaya" || jenis === "cerai-talak" || jenis === "kabul" ? null : nominalButir(teks);
      const terpotong = !/[.;)]\s*$/.test(teks) && teks.length > 30 && !/(?:perkara|hukum|berlaku|lain|adil|ini|tersebut|anak|nikah)$/i.test(teks);
      const yakin = jenis === "lain" ? "ragu" : terpotong ? "cukup" : "cukup";
      return {
        urut: i + 1,
        nomor: b.nomor,
        bagian: b.bagian,
        utama: b.bagian !== "subsider",
        jenis,
        jenisLabel: JENIS_TUNTUTAN[jenis] || jenis,
        varian: varianButir(jenis, teks),
        teks,
        sub: b.sub,
        nominal,
        dibebani: dibebaniDari(teks),
        penerima: penerimaDari(teks),
        didukungPosita: adaDiPosita(jenis, o.posita),
        yakin,
        sumber: "petitum SIPP",
      };
    });

  const jenisAda = {};
  for (const b of hasil) if (b.utama && b.jenis !== "kabul" && b.jenis !== "biaya") jenisAda[b.jenis] = (jenisAda[b.jenis] || 0) + 1;
  return {
    ada: hasil.length > 0,
    butir: hasil,
    utama: hasil.filter((b) => b.utama),
    jenisAda,
    ringkas: hasil
      .filter((b) => b.utama && b.jenis !== "kabul" && b.jenis !== "biaya")
      .map((b) => b.jenisLabel + (b.nominal ? ` Rp${String(b.nominal.nilai).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}${b.nominal.perBulan ? "/bulan" : ""}` : ""))
      .join("; "),
  };
}

module.exports = { petitumBerbutir, jenisButir, nominalButir, dibebaniDari, varianButir, polosHtml, JENIS_TUNTUTAN, POLA };
