"use strict";

/**
 * ============================================================================
 * DETEKSI HAK-HAK BEKAS ISTRI / KEWAJIBAN BEKAS SUAMI (jenis_perkara_id 351, Pdt.G alur 15)
 * ============================================================================
 *
 * Gugatan TERSENDIRI sesudah perceraian: nafkah iddah, maskan, kiswah, mut'ah, nafkah lampau (madliyah), mahar terhutang dan biaya hadhanah
 * (Pasal 149 KHI). Blangko Derry folder "1f Hak Bekas Istri" (paket abt-w3a-blangko-baru-perkawinan, variabel 3740-3779).
 *
 * BATAS UKUR: di SIPP PA Donggala belum ada satu pun perkara jenis 351 (0 perkara, server 21 Okt 2026), jadi aturan di bawah dirancang dari bentuk
 * posita perceraian/nafkah PA Donggala dan DIUJI atas contoh sintetis (manajemen_surat/src/test/w3a-hak-bekas-istri-21okt.test.ts), bukan atas
 * isian hakim sungguhan. Karena itu hanya fakta yang tertulis tegas (nomor/tanggal putusan dan akta cerai, cara putus, tanggal ikrar,
 * kata "masih dalam masa iddah", kata dukhul/anak) yang berstatus "cukup"; semua yang berupa penilaian majelis (nusyuz, nebis in idem, besar hak,
 * waktu pembayaran) paling tinggi "ragu" - hanya saran, tidak pernah terisi sendiri. Jumlah dari PETITUM adalah tuntutan Penggugat, bukan putusan:
 * selalu "ragu" dan keputusan besar hak tetap pilihan hakim.
 *
 * Variabel:
 *   3740  putusan perceraian dan akta cerai (nomor, tanggal)          posita
 *   3741  cara perkawinan putus (cerai talak / cerai gugat)           posita
 *   3742  tanggal perkawinan putus (ikrar talak / berkekuatan tetap)  posita
 *   3743  masa iddah (pilihan Pasal 153 KHI)                          posita (ragu)
 *   3744  keadaan masa iddah saat gugatan (masih berjalan / berakhir) posita
 *   3745  fakta dukhul (bada / qobla)                                 posita
 *   3746  fakta nusyuz (saran: tidak ditemukan bukti nusyuz)         posita (ragu)
 *   3747  hak sudah diputus dalam perkara cerai? (saran)             posita (ragu)
 *   3751/3752/3753  maskan, kiswah, mahar terhutang                   petitum (ragu)
 *   9711/9712/9713  nafkah madliyah, iddah, mut'ah (variabel lama)   petitum (ragu)
 *   9740/9741/9747  nafkah anak/bulan, kenaikan, lampau anak (lama)  petitum (ragu)
 *   3756  waktu pembayaran                                            petitum (ragu)
 */

const B = require("./bantuAnak");

const variabel = Object.freeze([
  { kode: "3740", nama: "Putusan perceraian dan akta cerai", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "3741", nama: "Cara perkawinan putus", sumber: "posita", blangko: ["putusan"] },
  { kode: "3742", nama: "Tanggal perkawinan putus", sumber: "posita", blangko: ["putusan"] },
  { kode: "3743", nama: "Masa iddah", sumber: "posita", blangko: ["putusan"] },
  { kode: "3744", nama: "Keadaan masa iddah saat gugatan", sumber: "posita", blangko: ["putusan"] },
  { kode: "3745", nama: "Fakta dukhul", sumber: "posita", blangko: ["putusan"] },
  { kode: "3746", nama: "Fakta nusyuz", sumber: "posita", blangko: ["putusan"] },
  { kode: "3747", nama: "Hak sudah diputus dalam perkara cerai", sumber: "posita", blangko: ["putusan"] },
  { kode: "3748", nama: "Hak yang sudah diputus", sumber: "putusan-hakim", blangko: ["putusan"], deteksi: false },
  { kode: "3749", nama: "Fakta kepatutan besaran", sumber: "saksi-sipp", blangko: ["putusan"], deteksi: false },
  { kode: "3750", nama: "Bantahan Tergugat", sumber: "berkas-ecourt", blangko: ["putusan"], deteksi: false },
  { kode: "3751", nama: "Maskan selama iddah", sumber: "petitum", blangko: ["putusan"] },
  { kode: "3752", nama: "Kiswah selama iddah", sumber: "petitum", blangko: ["putusan"] },
  { kode: "3753", nama: "Mahar yang masih terhutang", sumber: "petitum", blangko: ["putusan"] },
  { kode: "3754", nama: "Sita jaminan", sumber: "petitum", blangko: ["putusan"], deteksi: false },
  { kode: "3755", nama: "Alasan petitum ditolak", sumber: "putusan-hakim", blangko: ["putusan"], deteksi: false },
  { kode: "3756", nama: "Waktu pembayaran", sumber: "petitum", blangko: ["putusan"] },
  { kode: "9711", nama: "Nafkah madliyah", sumber: "petitum", blangko: ["putusan"] },
  { kode: "9712", nama: "Nafkah iddah", sumber: "petitum", blangko: ["putusan"] },
  { kode: "9713", nama: "Mut'ah", sumber: "petitum", blangko: ["putusan"] },
  { kode: "9740", nama: "Biaya hadhanah/nafkah anak per bulan", sumber: "petitum", blangko: ["putusan"] },
  { kode: "9741", nama: "Kenaikan nafkah anak per tahun", sumber: "petitum", blangko: ["putusan"] },
  { kode: "9747", nama: "Nafkah lampau anak", sumber: "petitum", blangko: ["putusan"] },
  { kode: "3757", nama: "Alat bukti surat Penggugat", sumber: "berkas-ecourt", blangko: ["bas", "putusan"], deteksi: false },
]);

const NOMOR = String.raw`([0-9]{1,5}\s*\/\s*[A-Za-z.]{2,8}\s*\/\s*\d{4}\s*\/\s*[A-Za-z.]{2,12}|[0-9]{1,5}\s*\/\s*[A-Za-z.]{2,8}\s*\/\s*\d{4})`;
const TANGGAL = String.raw`(\d{1,2}\s+(?:Januari|Pebruari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|Nopember|November|Desember)\s+\d{4})`;

const rapatNomor = (s) => String(s || "").replace(/\s+/g, "");

/** "Rp 4.500.000,-" / "Rp4500000" / "Rp. 4.500.000,00" -> 4500000; null bila bukan angka. */
function angkaRupiah(teks) {
  const m = /Rp\.?\s*([0-9][0-9.]*)(?:,\d{1,2}|,-)?/i.exec(String(teks || ""));
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function tulisRupiah(n) {
  return `Rp${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")},00`;
}

/** Klausa petitum: dipecah pada titik koma, ganti baris dan penanda butir. */
function klausaPetitum(petitum) {
  return B.polos(petitum)
    .split(/;\s*|\s(?=\d{1,2}\s*[.)]\s+[A-Z])|\s(?=[a-h]\s*[.)]\s+[A-Z])|\s-\s(?=[A-Za-z])/)
    .map((k) => k.trim())
    .filter((k) => k.length > 8);
}

/** Jumlah dari klausa: bila ada "N bulan" dan angka per bulan -> "RpTotal (N bulan x RpPerBulan)"; selain itu angka pertama. */
function jumlahKlausa(k) {
  const n = angkaRupiah(k);
  if (n === null) return null;
  const bulan = /\b(?:selama\s+)?(\d{1,3})\s*(?:\([^)]*\)\s*)?bulan\b/i.exec(k);
  const perBulan = /(?:setiap|tiap|per|\/)\s*bulan|perbulan|sebulan/i.test(k);
  if (bulan && perBulan && Number(bulan[1]) > 0) {
    const b = Number(bulan[1]);
    return `${tulisRupiah(n * b)} (${b} bulan x ${tulisRupiah(n)})`;
  }
  return tulisRupiah(n);
}

function deteksi(posita, opsi = {}) {
  const t = B.polos(posita);
  const peta = {};
  const petitum = B.polos(opsi.petitum || "");

  if (t) {
    // 3740 - putusan perceraian dan akta cerai
    const putusan = new RegExp(String.raw`[Pp]utusan(?:\s+(?:cerai|perceraian|Pengadilan\s+Agama(?:\s+[A-Z][a-z]+)?))?[^;]{0,50}?\b(?:Nomor|No\.?)\s*:?\s*${NOMOR}[^;]{0,60}?(?:tanggal|tgl\.?)\s*${TANGGAL}`, "i").exec(t);
    const akta = new RegExp(String.raw`Akta\s+Cerai[^;]{0,30}?\b(?:Nomor|No\.?)\s*:?\s*${NOMOR}[^;]{0,40}?(?:tanggal|tgl\.?)\s*${TANGGAL}`, "i").exec(t);
    if (putusan || akta) {
      const bagian = [];
      let kal = "";
      if (putusan) {
        const tetap = /berkekuatan\s+hukum\s+tetap|inkracht/i.test(t);
        bagian.push(`putusan Nomor ${rapatNomor(putusan[1])} tanggal ${B.tanggalPertama(putusan[2]) || putusan[2]}${tetap ? " yang telah berkekuatan hukum tetap" : ""}`);
        kal += putusan[0];
      }
      if (akta) {
        bagian.push(`Akta Cerai Nomor ${rapatNomor(akta[1])} tanggal ${B.tanggalPertama(akta[2]) || akta[2]}`);
        kal += ` ${akta[0]}`;
      }
      B.taruh(peta, "3740", B.fakta(bagian.join(" dan "), kal, "cukup", "hak-bekas-istri-3740-putusan"));
    }

    // 3741 - cara putus: hanya bila salah satu cara tertulis tegas dan lainnya tidak.
    const talak = /cerai\s+talak|ikrar\s+talak|diucapkan\s+talak|dijatuhi\s+talak\s+(?:satu\s+)?raj/i.exec(t);
    const gugat = /cerai\s+gugat|gugatan\s+cerai\s+(?:yang\s+)?diajukan\s+(?:oleh\s+)?Penggugat|Penggugat\s+(?:telah\s+)?menggugat\s+cerai/i.exec(t);
    if (talak && !gugat) B.taruh(peta, "3741", B.fakta("cerai talak", t.slice(Math.max(0, talak.index - 40), talak.index + 80), "cukup", "hak-bekas-istri-3741-talak"));
    else if (gugat && !talak) B.taruh(peta, "3741", B.fakta("cerai gugat", t.slice(Math.max(0, gugat.index - 40), gugat.index + 80), "cukup", "hak-bekas-istri-3741-gugat"));

    // 3742 - tanggal perkawinan putus: ikrar talak (tegas) > berkekuatan hukum tetap (tegas) > tanggal akta cerai (ragu).
    const ikrar = new RegExp(String.raw`ikrar(?:kan)?\s+talak[^;.]{0,80}?(?:pada\s+)?(?:tanggal|tgl\.?)\s*${TANGGAL}`, "i").exec(t);
    const tetapTgl = new RegExp(String.raw`berkekuatan\s+hukum\s+tetap\s+(?:pada\s+)?(?:tanggal|tgl\.?)\s*${TANGGAL}`, "i").exec(t);
    if (ikrar) B.taruh(peta, "3742", B.fakta(B.tanggalPertama(ikrar[1]) || ikrar[1], ikrar[0], "cukup", "hak-bekas-istri-3742-ikrar"));
    else if (tetapTgl) B.taruh(peta, "3742", B.fakta(B.tanggalPertama(tetapTgl[1]) || tetapTgl[1], tetapTgl[0], "cukup", "hak-bekas-istri-3742-bht"));
    else if (akta) B.taruh(peta, "3742", B.fakta(B.tanggalPertama(akta[2]) || akta[2], akta[0], "ragu", "hak-bekas-istri-3742-akta"));

    // 3744 - keadaan masa iddah saat gugatan
    const iddahJalan = /(?:masih|sedang)\s+(?:dalam|menjalani)\s+masa\s+(?:iddah|idah|tunggu)|masa\s+(?:iddah|idah)(?:\s+\w+){0,2}?\s+(?:belum\s+(?:berakhir|habis|selesai)|masih\s+berjalan)/i.exec(t);
    const iddahAkhir = /masa\s+(?:iddah|idah|tunggu)(?:\s+\w+){0,2}?\s+(?:telah|sudah)\s+(?:berakhir|habis|selesai|lewat|terlampaui)|(?:telah|sudah)\s+(?:melewati|habis)\s+masa\s+(?:iddah|idah)/i.exec(t);
    if (iddahJalan && !iddahAkhir) B.taruh(peta, "3744", B.fakta("masih berjalan", iddahJalan[0], "cukup", "hak-bekas-istri-3744-jalan"));
    else if (iddahAkhir && !iddahJalan) B.taruh(peta, "3744", B.fakta("telah berakhir", iddahAkhir[0], "cukup", "hak-bekas-istri-3744-akhir"));

    // 3743 - masa iddah (pilihan Pasal 153 KHI) - hanya saran
    if (/\bhamil\b/i.test(t) && /iddah|idah|masa\s+tunggu/i.test(t) && !/tidak\s+(?:dalam\s+keadaan\s+)?hamil|tidak\s+sedang\s+hamil/i.test(t)) {
      B.taruh(peta, "3743", B.fakta("sampai melahirkan karena dalam keadaan hamil", t.slice(Math.max(0, t.search(/hamil/i) - 60), t.search(/hamil/i) + 60), "ragu", "hak-bekas-istri-3743-hamil"));
    } else if (/(?:masa\s+)?(?:iddah|idah)[^;.]{0,40}?(?:3|tiga)\s*(?:\([^)]*\)\s*)?(?:bulan|kali\s+suci)|(?:3|tiga)\s*(?:\([^)]*\)\s*)?(?:bulan|kali\s+suci)[^;.]{0,30}(?:iddah|idah)/i.test(t)) {
      B.taruh(peta, "3743", B.fakta("3 (tiga) kali suci dengan sekurang-kurangnya 90 (sembilan puluh) hari", t.slice(Math.max(0, t.search(/iddah|idah/i) - 60), t.search(/iddah|idah/i) + 100), "ragu", "hak-bekas-istri-3743-tiga"));
    }

    // 3745 - dukhul: qobla (tegas) / bada (ada anak dari perkawinan, atau tertulis tegas)
    const qobla = /qob?lah?\s*(?:al|ad)?\s*-?\s*dukhul|qabla\s*(?:al|ad)?\s*-?\s*dukhul|belum\s+pernah\s+(?:berhubungan|bergaul|berkumpul|hidup\s+bersama|melakukan\s+hubungan)\s*(?:badan|suami\s+istri|layaknya\s+suami\s+istri)?/i.exec(t);
    const bada = /ba[']?da\s*(?:al|ad)?\s*-?\s*dukhul|(?:telah|sudah)\s+(?:hidup\s+bersama|berhubungan|bergaul|berkumpul)\s+(?:sebagaimana|layaknya|selayaknya|sebagai)\s+suami\s+istri|di\s*karuni(?:a|ai)\w*\s+(?:\d{1,2}\s*(?:\([^)]*\)\s*)?|seorang\s+|satu\s+|dua\s+|tiga\s+|empat\s+)?(?:orang\s+)?anak/i.exec(t);
    if (qobla && !bada) {
      B.taruh(peta, "3745", B.fakta("antara #0046# dan #0047# belum pernah terjadi hubungan sebagaimana layaknya suami istri (qobla al dukhul)", qobla[0], "cukup", "hak-bekas-istri-3745-qobla"));
    } else if (bada && !qobla) {
      B.taruh(peta, "3745", B.fakta("selama menjadi suami istri #0046# dan #0047# telah bergaul sebagaimana layaknya suami istri (bada al dukhul)", bada[0], "cukup", "hak-bekas-istri-3745-bada"));
    }

    // 3746 - nusyuz: hanya saran bila posita menegaskan Penggugat tidak nusyuz (temuan tetap milik majelis)
    const bukanNusyuz = /tidak\s+(?:pernah\s+)?(?:berbuat\s+|melakukan\s+)?nusyuz|bukan\s+karena\s+nusyuz/i.exec(t);
    if (bukanNusyuz) B.taruh(peta, "3746", B.fakta("dalam perkara ini tidak ditemukan bukti bahwa #0046# berbuat nusyuz", bukanNusyuz[0], "ragu", "hak-bekas-istri-3746-tidak-nusyuz"));

    // 3747 - hak sudah diputus di perkara cerai? (saran)
    const sudah = /(?:telah|sudah)\s+diputus\s+(?:dalam|di)\s+(?:perkara|putusan)\s+(?:perceraian|cerai)/i.exec(t);
    const belum = /(?:belum|tidak)\s+pernah\s+(?:diputus|dituntut|dibahas|diperiksa|diberikan)[^;.]{0,80}(?:perkara|putusan)\s+(?:perceraian|cerai)|(?:perkara|putusan)\s+(?:perceraian|cerai)[^;.]{0,100}(?:tidak|belum)\s+(?:memutus|menuntut|mengatur|memuat|menetapkan)|tidak\s+(?:menuntut|mengajukan)\s+[^;.]{0,60}(?:dalam|pada)\s+perkara\s+(?:perceraian|cerai)/i.exec(t);
    if (sudah && !belum) B.taruh(peta, "3747", B.fakta("hak-hak bekas istri yang dituntut dalam perkara ini telah diputus dalam perkara perceraian #0046# dan #0047#", sudah[0], "ragu", "hak-bekas-istri-3747-sudah"));
    else if (belum && !sudah) B.taruh(peta, "3747", B.fakta("hak-hak bekas istri yang dituntut dalam perkara ini belum pernah dituntut dan belum pernah diputus dalam perkara perceraian #0046# dan #0047#", belum[0], "ragu", "hak-bekas-istri-3747-belum"));
  }

  // --- tuntutan dalam PETITUM (hanya saran "ragu": Penggugat menuntut, majelis memutus) ---
  const sumberTuntut = petitum || t;
  if (sumberTuntut) {
    const dipakai = new Set();
    const taruhJumlah = (kode, klausa, kodePola) => {
      if (dipakai.has(kode)) return;
      const j = jumlahKlausa(klausa);
      if (j) {
        dipakai.add(kode);
        B.taruh(peta, kode, B.fakta(j, klausa, "ragu", kodePola, petitum ? "petitum" : "posita"));
      }
    };
    const KOMP = [
      ["9712", (k) => /nafkah\s+(?:selama\s+(?:masa\s+)?)?(?:iddah|idah)/i.test(k) || (/iddah|idah/i.test(k) && !/maskan|tempat\s+tinggal|tempat\s+kediaman|kiswah|pakaian|sandang|mut[^a-z]{0,2}ah/i.test(k)), "hak-bekas-istri-9712-iddah"],
      ["3751", /maskan|tempat\s+tinggal|tempat\s+kediaman/i, "hak-bekas-istri-3751-maskan"],
      ["3752", /kiswah|pakaian|sandang/i, "hak-bekas-istri-3752-kiswah"],
      ["9713", /mut[^a-z]{0,2}ah/i, "hak-bekas-istri-9713-mutah"],
      ["3753", /mahar|mas\s*kawin/i, "hak-bekas-istri-3753-mahar"],
    ];
    const tangani = (k) => {
      const anak = /\banak\b/i.test(k);
      if (anak && /hadh?anah|nafkah[^;]{0,40}anak|anak[^;]{0,40}nafkah|biaya[^;]{0,30}anak/i.test(k)) {
        if (/lampau|madli|yang\s+lalu|terlewat/i.test(k)) taruhJumlah("9747", k, "hak-bekas-istri-9747-anak-lampau");
        else if (/(?:setiap|tiap|per)\s*bulan|perbulan|sebulan/i.test(k)) {
          taruhJumlah("9740", k.replace(/(\d{1,3})\s*(?:\([^)]*\)\s*)?bulan/i, ""), "hak-bekas-istri-9740-anak-bulanan");
          const naik = /kenaikan\s+(?:sebesar\s+)?(\d{1,2})\s*%/i.exec(k);
          if (naik) B.taruh(peta, "9741", B.fakta(`${naik[1]}%`, naik[0], "ragu", "hak-bekas-istri-9741-kenaikan", "petitum"));
        }
        return;
      }
      const madli = /madli|madhi|lampau|yang\s+lalu/i.test(k) && !/iddah|idah|mut[^a-z]{0,2}ah/i.test(k);
      const cocok = KOMP.filter(([, rx]) => (typeof rx === "function" ? rx(k) : rx.test(k)));
      const jumlahKomp = cocok.length + (madli ? 1 : 0);
      if (jumlahKomp > 1) {
        // beberapa hak dalam satu klausa: hanya dipecah bila tiap bagian memuat angkanya sendiri; selain itu dilewati (tidak menebak)
        const bagian = k.split(/\s+(?:serta|dan|,)\s+|,\s+/i).filter((x) => x.trim());
        const berkata = bagian.filter((x) => KOMP.some(([, rx]) => (typeof rx === "function" ? rx(x) : rx.test(x))) || /madli|madhi|lampau|yang\s+lalu/i.test(x));
        if (bagian.length > 1 && berkata.length > 1 && berkata.every((x) => angkaRupiah(x) !== null)) for (const x of berkata) tangani(x);
        return;
      }
      if (madli) taruhJumlah("9711", k, "hak-bekas-istri-9711-madliyah");
      for (const [kode, rx, pola] of cocok) taruhJumlah(kode, k, pola);
    };
    for (const k of klausaPetitum(petitum || "")) tangani(k);
    const waktu = /paling\s+lambat\s+(\d{1,3})\s*(?:\(([^)]*)\)\s*)?hari/i.exec(petitum);
    if (waktu) {
      const kata = waktu[2] ? ` (${waktu[2].trim().toLowerCase()})` : "";
      B.taruh(peta, "3756", B.fakta(`paling lambat ${waktu[1]}${kata} hari sejak putusan ini berkekuatan hukum tetap`, waktu[0], "ragu", "hak-bekas-istri-3756-waktu", "petitum"));
    }
  }
  return peta;
}

/** Gugatan hak bekas istri? (untuk jenis lain yang mungkin mendaftar gugatan ini sebagai "Lain-Lain") */
function cocokTeks(teks) {
  const t = String(teks || "");
  return /bekas\s+ist(?:e)?ri|mantan\s+ist(?:e)?ri/i.test(t) && /nafkah\s+(?:iddah|idah)|mut[^a-z]{0,2}ah|maskan|kiswah|mahar\s+(?:yang\s+)?terhutang/i.test(t);
}

module.exports = { kunci: "hak-bekas-istri", jenisPerkaraId: [351], variabel, deteksi, cocokTeks, angkaRupiah, jumlahKlausa };
