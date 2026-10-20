"use strict";

/**
 * ============================================================================
 * PEMBACA POSITA/PETITUM JENIS PERKARA AGEN S6 (20 Okt 2026)
 * ============================================================================
 *
 * Isian popup "Perlu diisi" blangko Derry untuk jenis yang belum punya modul deteksi sendiri:
 *
 *   Hibah (366)      9793 penghibah, 9794 bentuk & tanggal hibah, 9795 objek hibah, 9790 pokok tuntutan (huruf),
 *                    9802/9803/9806 kedudukan Penggugat/Tergugat/Pemohon
 *   Wakaf (367)      9823 wakif, 9824 nazhir, 9825 bentuk & tanggal ikrar, 9826 harta benda, 9827 peruntukan,
 *                    9820 pokok tuntutan (huruf), 9832/9833/9836 kedudukan, 9841 pihak yang menguasai
 *   Wasiat (365)     9475 pokok tuntutan (huruf), 9478 bentuk & tanggal wasiat, 9479 objek wasiat, 9486/9487 kedudukan
 *   Mafqud (369)     9860 nama orang hilang, 9861 kedudukan Pemohon, 9862 tempat & waktu terakhir diketahui, 9863 upaya
 *                    pencarian, 9864 lama tidak ada kabar, 9865 kepentingan Pemohon (huruf)
 *   Pencegahan (342) 9460 calon istri, 1029 calon suami, 9461 wilayah KUA, 9462 kedudukan Pemohon, 9463 alasan (huruf)
 *   Pembatalan (344) 9320 alasan (huruf)
 *   Ekonomi syariah  9340 akad, 9341 jumlah kewajiban yang digugat, 9345 fakta wanprestasi, 9490 klausula arbitrase
 *   Harta bersama    0889/1108 duplikat kutipan akta nikah (nomor/tanggal)
 *
 * MURNI: tidak membaca basis data, tidak menulis apa pun. Semua keluaran "ragu" kecuali yang tertulis eksplisit dengan
 * penanda yang tak terbantahkan (nomor + tanggal akad/akta); bentuk keluaran sama dengan modul deteksi lain:
 * { kode: { nilai, kalimat, yakin: "cukup"|"ragu", catatan, kodePola, asal: "posita-gugatan" } }.
 *
 * Aturan yang dijaga (dari kegagalan modul lain di repo ini):
 *   - tidak ada nilai lazim yang ditebak: tanpa kalimat sumber, tidak ada nilai;
 *   - nilai huruf (pokok tuntutan, alasan) hanya bila TEPAT SATU huruf yang cirinya tertulis; dua huruf bertentangan = kosong;
 *   - kata "ALETA" tidak pernah muncul di nilai.
 */

const B = require("./bantuAnak");
const P = require("./pembantuKebendaan");

const ASAL = "posita-gugatan";

/* ---------------------------------------------------------------------------
 * Pembantu
 * ------------------------------------------------------------------------- */

const potong = (t, n) => {
  const s = String(t || "").replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}...` : s;
};

/** Posita/petitum polos satu baris, butir dipisah "; ". */
function satuBaris(teks) {
  return P.satuBaris(teks).replace(/\s+/g, " ").trim();
}

/** Kalimat/butir: dipecah pada titik koma dan penanda butir "N. Bahwa". */
function butir(teks) {
  return B.kalimat(teks);
}

/** Fakta untuk peta hasil; undefined bila nilai kosong. */
function fakta(nilai, kalimat, yakin, kodePola, catatan) {
  const n = String(nilai || "").replace(/\s+/g, " ").trim();
  if (!n || /aleta/i.test(n)) return undefined;
  return { nilai: n, kalimat: String(kalimat || "").slice(0, 400), yakin: yakin === "cukup" ? "cukup" : "ragu", kodePola, asal: ASAL, catatan: catatan || "" };
}

function taruh(peta, kode, f) {
  if (f && f.nilai && !peta[kode]) peta[kode] = f;
}

/** Nama orang "X bin/binti Y" (huruf besar di awal tiap kata; "Alm." di depan dipertahankan sebagai almarhum/almarhumah). */
const POLA_NAMA = new RegExp(
  "(?:\\b(?:[Aa]lm(?:arhum(?:ah)?)?|[Aa]lmh|ALM(?:ARHUM(?:AH)?)?)\\.?\\s+)?(?:(?:H|Hj|Drs|Dra|Dr|Ir)\\.\\s*)?[A-Z][A-Za-z'’`.\\-]*(?:\\s+[A-Z][A-Za-z'’`.\\-]*){0,5}?(?:,\\s*[A-Z][A-Za-z.]{1,8})?\\s+(?:bin|binti|Bin|Binti|BIN|BINTI)\\s+[A-Z][A-Za-z'’`.\\-]*(?:\\s+[A-Z][A-Za-z'’`.\\-]*){0,3}",
  "g"
);

/** Semua nama "X bin/binti Y" di teks beserta letaknya. */
function semuaNama(teks) {
  const t = String(teks || "");
  const hasil = [];
  POLA_NAMA.lastIndex = 0;
  let m;
  while ((m = POLA_NAMA.exec(t))) {
    const mentah = m[0];
    const nama = bakuNama(mentah);
    if (nama.length >= 5) hasil.push({ nama, awal: m.index, akhir: m.index + mentah.length, almarhum: /^(?:alm|almh)/i.test(mentah) });
    if (m.index === POLA_NAMA.lastIndex) POLA_NAMA.lastIndex++;
  }
  return hasil;
}

/** Kata huruf besar di awal kalimat yang bukan bagian nama. */
const KATA_PEMBUKA = new Set(["bahwa", "maka", "dan", "pemohon", "penggugat", "tergugat", "termohon", "kepada", "yang", "adapun", "sebagai", "selanjutnya", "dengan", "atas", "oleh", "nama", "hal", "perihal", "dalam", "pada", "untuk", "karena", "sebab", "terhadap", "antara", "bernama", "wakif", "nazhir", "nadzir", "pewasiat", "penghibah", "saudara", "sdr", "ibu", "bapak"]);

/** "Alm. X bin Y" -> "almarhum X bin Y"; "Almh. X binti Y" -> "almarhumah X binti Y"; kata pembuka kalimat dibuang; spasi dirapikan. */
function bakuNama(mentah) {
  let n = String(mentah || "").replace(/\s+/g, " ").trim().replace(/[\s,.;:]+$/, "");
  let alm = "";
  const a = /^(?:alm(?:arhum(?:ah)?)?|almh)\.?\s+/i.exec(n);
  if (a) {
    n = n.slice(a[0].length);
    alm = /^almh|^almarhumah/i.test(a[0]) ? "almarhumah" : "almarhum";
  }
  const kata = n.split(" ");
  while (kata.length > 2 && KATA_PEMBUKA.has(kata[0].toLowerCase().replace(/[^a-z]/g, ""))) kata.shift();
  n = kata.join(" ");
  if (alm) {
    const perempuan = alm === "almarhumah" || /\bbinti\b/i.test(n);
    n = `${perempuan ? "almarhumah" : "almarhum"} ${n}`;
  }
  return n;
}

/** Nama terdekat SEBELUM indeks (maks `jarak` huruf) - yang berakhir paling dekat dengan indeks. */
function namaSebelum(teks, indeks, jarak = 140) {
  const potongan = String(teks).slice(Math.max(0, indeks - jarak), indeks);
  const dasar = Math.max(0, indeks - jarak);
  const daftar = semuaNama(potongan).filter((x) => dasar + x.akhir <= indeks);
  const akhir = daftar[daftar.length - 1];
  return akhir ? akhir.nama : "";
}

/** Nama terdekat SESUDAH indeks (maks `jarak` huruf). */
function namaSesudah(teks, indeks, jarak = 140) {
  const potongan = String(teks).slice(indeks, indeks + jarak);
  const daftar = semuaNama(potongan);
  return daftar[0] ? daftar[0].nama : "";
}

const BULAN_POLA = "(?:Januari|Februari|Pebruari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Nopember|Desember)";
const POLA_TGL = new RegExp(`\\d{1,2}\\s+${BULAN_POLA}\\s+\\d{4}`, "i");

/** Tanggal pertama di teks, bentuk "27 Juli 2011"; "" bila tidak ada. */
function tanggalDi(teks) {
  const t = P.tanggalBaku(teks);
  return t ? t.replace(/^0/, "") : "";
}

/** Dari teks: "Nomor : 025/ULS/xx tanggal 18 Desember 2019" -> { nomor, tanggal } (nomor sebelum "tanggal"). */
function nomorTanggal(teks) {
  const m = /(?:Nomor|No\.?)\s*[:.]?\s*([A-Za-z0-9][A-Za-z0-9./\-]{2,60})(?:[^;]{0,40}?)(?:tanggal|tgl\.?|tertanggal)\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{1,2}[-/]\d{1,2}[-/]\d{4})/i.exec(teks);
  if (!m) return null;
  return { nomor: m[1].replace(/[,.;]+$/, ""), tanggal: tanggalDi(m[2]), indeks: m.index, panjang: m[0].length };
}

/** Kata-kata kunci kedudukan: potongan sesudah "<Sebutan> adalah" sampai batas klausa. */
function kedudukan(teks, sebutan, pola) {
  const re = new RegExp(`\\b${sebutan}(?:\\s+(?:I|II|III))?\\s+(?:adalah|merupakan|selaku|sebagai)\\s+([^;.]{3,140})`, "gi");
  let m;
  while ((m = re.exec(teks))) {
    let isi = m[1].replace(/\s+/g, " ").trim();
    // klausa berhenti pada penghubung/keterangan lanjut
    isi = isi.split(/\s+(?:yang\s+(?!sah\b|berhak\b)|dan\s+(?:Tergugat|Penggugat|Pemohon|Termohon)|sebagaimana|berdasarkan|dalam\s+hal|selanjutnya|golongan)\b/i)[0];
    isi = isi.replace(/[,\s]+$/, "");
    if (isi.length >= 3 && isi.length <= 90 && pola.test(isi)) return { nilai: isi.charAt(0).toLowerCase() + isi.slice(1), kalimat: P.kalimatDi(teks, m.index, m[0].length) };
  }
  return null;
}

/**
 * Satu-satunya huruf yang cirinya tertulis. `peta` = [[huruf, RegExp], ...]. Bila lebih dari satu huruf cocok
 * (ciri bertentangan) hasilnya null: hakim yang memilih.
 */
function hurufTunggal(teks, peta) {
  const cocok = peta.filter(([, re]) => re.test(teks));
  if (cocok.length !== 1) return null;
  const m = cocok[0][1].exec(teks);
  return { huruf: cocok[0][0], kalimat: P.kalimatDi(teks, m.index, m[0].length) };
}

/* ---------------------------------------------------------------------------
 * HIBAH (366)
 * ------------------------------------------------------------------------- */

const HURUF_HIBAH = [
  ["A", /menarik\s+kembali\s+hibah|pencabutan\s+hibah|mencabut\s+hibah|hibah\s+(?:orang\s*tua|ayah|ibu)\s+kepada\s+anak/i],
  ["B", /melebihi\s+(?:1\/3|sepertiga|\(?\s*satu\s+per\s*tiga)/i],
  ["C", /penghibah\s+(?:belum\s+dewasa|tidak\s+cakap|tidak\s+memenuhi\s+syarat)|tidak\s+memenuhi\s+syarat\s+(?:sebagai\s+)?penghibah/i],
  ["D", /bukan\s+(?:milik|hak)\s+(?:sah\s+)?(?:dari\s+)?penghibah|harta\s+(?:itu|tersebut)\s+bukan\s+milik/i],
  ["E", /hibah\s+(?:yang\s+)?(?:dilakukan\s+)?(?:pada\s+saat|ketika|saat)\s+(?:penghibah\s+)?(?:sakit|menjelang\s+meninggal)|dalam\s+keadaan\s+sakit\s+(?:keras\s+)?(?:menjelang|dan)/i],
  ["F", /menyatakan\s+(?:sah|bahwa\s+hibah[^;]{0,60}?\bsah)[^;]{0,80}?hibah|menyatakan\s+hibah[^;]{0,80}?\bsah\b|mengesahkan\s+hibah/i],
  ["G", /(?:diperhitungkan|dihitung)\s+sebagai\s+(?:harta\s+)?warisan|dihitung\s+sebagai\s+warisan/i],
];

function deteksiHibah(posita, opsi = {}) {
  const satu = satuBaris(posita);
  const petitum = satuBaris(opsi.petitum || "");
  const hasil = {};
  if (!/hibah/i.test(satu + " " + petitum)) return hasil;
  const gabung = `${satu}; ${petitum}`;
  const kal = butir(satu);
  const sebutanPemohon = /\bPemohon\b/.test(satu) && !/\bPenggugat\b/.test(satu);

  // 9793 Penghibah
  let penghibah = "";
  let sumberPenghibah = "";
  const mH = /(?:telah\s+|pernah\s+)?menghibahkan\b/i.exec(satu);
  if (mH) {
    penghibah = namaSebelum(satu, mH.index, 120);
    if (!penghibah) {
      const sebelum = satu.slice(Math.max(0, mH.index - 40), mH.index);
      if (/\b(?:Penggugat|Pemohon)\s*$/i.test(sebelum) && Array.isArray(opsi.namaPihak) && opsi.namaPihak[0]) penghibah = String(opsi.namaPihak[0]).trim();
    }
    sumberPenghibah = P.kalimatDi(satu, mH.index, mH[0].length);
  }
  if (!penghibah) {
    const m = /(?:dihibahkan|hibah\s+dari|hibah\s+oleh|penghibah)\s*(?:oleh|adalah|yaitu|bernama|:)?\s*/i.exec(satu);
    if (m) {
      penghibah = namaSesudah(satu, m.index + m[0].length, 80);
      sumberPenghibah = P.kalimatDi(satu, m.index, m[0].length);
    }
  }
  taruh(hasil, "9793", fakta(penghibah, sumberPenghibah, "ragu", "hibah-penghibah", "Nama dibaca dari kalimat hibah di posita; tulis \"almarhum/almarhumah\" bila penghibah telah meninggal."));

  // 9795 Objek hibah
  if (mH) {
    const sesudah = satu.slice(mH.index + mH[0].length);
    const o = /^\s*(.{6,420}?)\s+(?:kepada|untuk)\s+(?=[A-Z]|anak|cucu|istri|isteri|suami|ahli|para|Penggugat|Tergugat|Pemohon)/i.exec(sesudah);
    const mentah = o ? o[1] : "";
    const objek = P.rapiBenda(mentah);
    if (objek && P.bendaSah(objek)) taruh(hasil, "9795", fakta(objek, P.kalimatDi(satu, mH.index, mH[0].length), "ragu", "hibah-objek", "Objek yang dihibahkan menurut posita; lengkapi bukti hak, luas, letak dan batas-batas bila belum tertulis."));
  }
  if (!hasil["9795"]) {
    const m = /\bhibah\s+(?:berupa|atas|meliputi|yaitu)\s+(.{6,420}?)(?=[;]|\s+(?:kepada|yang\s+dilakukan|dari)\s|$)/i.exec(satu);
    if (m && P.bendaSah(P.rapiBenda(m[1]))) taruh(hasil, "9795", fakta(P.rapiBenda(m[1]), P.kalimatDi(satu, m.index, m[0].length), "ragu", "hibah-objek-berupa", "Objek hibah menurut posita; periksa kelengkapan bukti hak, luas, letak dan batas."));
  }

  // 9794 Bentuk dan tanggal hibah
  const bentuk = bentukPerbuatan(kal, /hibah/i, "hibah");
  taruh(hasil, "9794", fakta(bentuk && bentuk.nilai, bentuk && bentuk.kalimat, bentuk && bentuk.akta ? "cukup" : "ragu", "hibah-bentuk-tanggal", "Bentuk dan tanggal hibah dari posita; yang lisan/tertulis tanpa akta sebaiknya dikuatkan bukti."));

  // 9790 Pokok tuntutan
  const huruf = hurufTunggal(petitum || satu, HURUF_HIBAH);
  if (huruf) taruh(hasil, "9790", fakta(huruf.huruf, huruf.kalimat, "ragu", "hibah-pokok-tuntutan", `Huruf ${huruf.huruf} dibaca dari ciri petitum; pilih huruf yang sesuai tuntutan sebenarnya.`));

  // Kedudukan
  const kedHibah = /penghibah|penerima\s+hibah|ahli\s+waris|anak|cucu|saudara|orang\s*tua|ayah|ibu|suami|istri|isteri/i;
  const kP = kedudukan(gabung, "Penggugat", kedHibah);
  const kT = kedudukan(gabung, "Tergugat", kedHibah);
  const kM = kedudukan(gabung, "Pemohon", kedHibah);
  if (kP) taruh(hasil, "9802", fakta(kP.nilai, kP.kalimat, "ragu", "hibah-kedudukan-penggugat", ""));
  if (kT) taruh(hasil, "9803", fakta(kT.nilai, kT.kalimat, "ragu", "hibah-kedudukan-tergugat", ""));
  if (kM || (sebutanPemohon && kP)) {
    const k = kM || kP;
    taruh(hasil, "9806", fakta(k.nilai, k.kalimat, "ragu", "hibah-kedudukan-pemohon", ""));
  }
  return hasil;
}

/**
 * Bentuk dan tanggal suatu perbuatan hukum (hibah/wakaf/wasiat) dari butir posita.
 *   akta Nomor ... tanggal ...  -> "dengan akta hibah Nomor X tanggal D" (+ pejabat bila ada)
 *   lisan                       -> "secara lisan pada tanggal D di hadapan N orang saksi"
 *   tertulis / surat            -> "secara tertulis tertanggal D"
 * @returns {{nilai, kalimat, akta: boolean}|null}
 */
function bentukPerbuatan(daftarButir, polaPerbuatan, kataAkta) {
  for (const k of daftarButir) {
    if (!polaPerbuatan.test(k)) continue;
    const akta = new RegExp(`(?:akta|Akta)\\s+(?:${kataAkta}|ikrar\\s+wakaf|wasiat|notaris)[^;]{0,80}?(?:Nomor|No\\.?)`, "i").test(k) ? nomorTanggal(k) : null;
    if (akta && akta.nomor) {
      const pejabat = /(?:di\s+hadapan|dibuat\s+oleh)\s+((?:Notaris|PPAT|PPAIW|Pejabat)[^;,]{3,60})/i.exec(k);
      const jenisAkta = /ikrar\s+wakaf/i.test(k) ? "Akta Ikrar Wakaf" : /notaris/i.test(k) && /wasiat/i.test(k) ? "akta wasiat" : `akta ${kataAkta}`;
      return {
        nilai: `dengan ${jenisAkta} Nomor ${akta.nomor}${akta.tanggal ? ` tanggal ${akta.tanggal}` : ""}${pejabat ? ` di hadapan ${pejabat[1].trim()}` : ""}`,
        kalimat: P.kalimatDi(k, 0, k.length),
        akta: true,
      };
    }
    const saksi = /(?:di\s+hadapan|disaksikan\s+oleh|dihadiri\s+oleh)\s+(?:(\d+)\s*(?:\(\s*[a-z]+\s*\)\s*)?|dua\s+|tiga\s+)?(?:orang\s+)?saksi/i.exec(k);
    const tgl = tanggalDi(k);
    const kata = saksi ? (saksi[1] === "3" || /tiga/i.test(saksi[0]) ? "3 (tiga) orang saksi" : "2 (dua) orang saksi") : "";
    if (/\blisan\b/i.test(k)) return { nilai: `secara lisan${tgl ? ` pada tanggal ${tgl}` : ""}${kata ? ` di hadapan ${kata}` : ""}`, kalimat: P.kalimatDi(k, 0, k.length), akta: false };
    if (/\b(?:tertulis|surat\s+(?:hibah|wasiat|pernyataan|keterangan)|di\s*bawah\s*tangan)\b/i.test(k)) {
      return { nilai: `secara tertulis${tgl ? ` tertanggal ${tgl}` : ""}${kata ? ` di hadapan ${kata}` : ""}`, kalimat: P.kalimatDi(k, 0, k.length), akta: false };
    }
    if (tgl && new RegExp(`(?:telah\\s+)?(?:menghibahkan|mewakafkan|mewasiatkan)`, "i").test(k)) {
      return { nilai: `pada tanggal ${tgl}${kata ? ` di hadapan ${kata}` : ""}`, kalimat: P.kalimatDi(k, 0, k.length), akta: false };
    }
  }
  return null;
}

/* ---------------------------------------------------------------------------
 * WAKAF (367)
 * ------------------------------------------------------------------------- */

const HURUF_WAKAF = [
  ["A", /(?:menyatakan\s+sah|mengesahkan|menetapkan\s+sah)[^;]{0,100}?wakaf|wakaf[^;]{0,80}?(?:sah\s+menurut\s+hukum|diserahkan\s+kepada\s+nazh?ir)|menyerahkan[^;]{0,80}?(?:kepada|ke)\s+nazh?ir/i],
  ["B", /wakaf[^;]{0,60}?(?:tidak\s+sah|batal|tidak\s+berlaku)|menyatakan\s+tidak\s+sah[^;]{0,60}?wakaf/i],
  ["C", /pengalihan[^;]{0,60}?wakaf|(?:menjual|dijual|jual\s+beli|menukar)[^;]{0,60}?(?:tanah|harta|benda)\s+wakaf|wakaf[^;]{0,60}?(?:dijual|dialihkan|diperjualbelikan)/i],
  ["D", /perubahan\s+peruntukan|mengubah\s+peruntukan|tukar\s+guling/i],
  ["E", /wasiat\s+wakaf[^;]{0,80}?(?:melebihi|lebih\s+dari)|wakaf\s+wasiat[^;]{0,80}?(?:1\/3|sepertiga)/i],
  ["F", /(?:melaksanakan|laksanakan)[^;]{0,60}?wakaf\s+wasiat|memerintahkan[^;]{0,80}?(?:ikrar|melaksanakan)[^;]{0,40}?wakaf/i],
];

const PERUNTUKAN = [
  [/\b(?:masjid|mesjid|mushalla|musholla|musala|langgar|surau)\b/i, "sarana ibadah (masjid)"],
  [/\b(?:madrasah|sekolah|pondok\s+pesantren|pesantren|taman\s+pendidikan|TPA|TPQ|panti\s+asuhan)\b/i, "sarana pendidikan"],
  [/\b(?:pemakaman|kuburan|makam|pekuburan)\b/i, "pemakaman"],
  [/\b(?:rumah\s+sakit|klinik|puskesmas)\b/i, "sarana kesehatan"],
];

function deteksiWakaf(posita, opsi = {}) {
  const satu = satuBaris(posita);
  const petitum = satuBaris(opsi.petitum || "");
  const hasil = {};
  if (!/wakaf|wakif|nazh?ir/i.test(satu + " " + petitum)) return hasil;
  const gabung = `${satu}; ${petitum}`;
  const kal = butir(satu);

  // 9823 Wakif
  let wakif = "";
  let sumberW = "";
  let m = /\bwakif\b\s*(?:adalah|yaitu|bernama|:|-)?\s*/i.exec(satu);
  if (m) {
    const sesudah = namaSesudah(satu, m.index + m[0].length, 70);
    const sebelum = namaSebelum(satu, m.index, 90);
    wakif = sesudah || sebelum;
    sumberW = P.kalimatDi(satu, m.index, m[0].length);
  }
  const mW = /(?:telah\s+)?mewakafkan\b/i.exec(satu);
  if (!wakif && mW) {
    wakif = namaSebelum(satu, mW.index, 120);
    sumberW = P.kalimatDi(satu, mW.index, mW[0].length);
  }
  taruh(hasil, "9823", fakta(wakif, sumberW, "ragu", "wakaf-wakif", "Tulis \"almarhum/almarhumah\" bila Wakif telah meninggal."));

  // 9824 Nazhir
  let nazhir = "";
  let sumberN = "";
  m = /\bnazh?ir\b\s*(?:adalah|yaitu|bernama|:|-)\s*([^;.]{3,100})/i.exec(satu);
  if (m) {
    nazhir = m[1].split(/\s+(?:dan\s+(?:Wakif|Tergugat|Penggugat)|yang\s|sebagaimana)/i)[0].replace(/[,\s]+$/, "");
    sumberN = P.kalimatDi(satu, m.index, m[0].length);
  }
  if (!nazhir) {
    m = /\b(?:selaku|sebagai|menjadi)\s+nazh?ir\b/i.exec(satu);
    if (m) {
      nazhir = namaSebelum(satu, m.index, 100) || "";
      if (!nazhir) {
        const sb = satu.slice(Math.max(0, m.index - 100), m.index);
        const org = /((?:Yayasan|Pengurus|Panitia|Takmir|Badan|Majelis|Lembaga|Pondok|Masjid|Komite)\s+[A-Z][^;,.]{2,70}?)\s*(?:\([^)]*\)\s*)?(?:,\s*)?(?:yang\s+)?$/.exec(sb);
        nazhir = org ? org[1].trim() : "";
      }
      sumberN = P.kalimatDi(satu, m.index, m[0].length);
    }
  }
  taruh(hasil, "9824", fakta(nazhir, sumberN, "ragu", "wakaf-nazhir", "Nazhir dapat perseorangan, organisasi atau badan hukum; periksa sebutannya."));

  // 9825 Bentuk dan tanggal ikrar
  const aiw = kal.find((k) => /akta\s+ikrar\s+wakaf|\bAIW\b/i.test(k));
  let bentuk = null;
  if (aiw) {
    const nt = nomorTanggal(aiw);
    const ppaiw = /(?:di\s+hadapan|oleh)\s+(PPAIW[^;,]{0,60}|Pejabat\s+Pembuat\s+Akta\s+Ikrar\s+Wakaf[^;,]{0,60})/i.exec(aiw);
    if (nt && nt.nomor) bentuk = { nilai: `dengan Akta Ikrar Wakaf Nomor ${nt.nomor}${nt.tanggal ? ` tanggal ${nt.tanggal}` : ""}${ppaiw ? ` di hadapan ${ppaiw[1].trim()}` : ""}`, kalimat: aiw, akta: true };
  }
  if (!bentuk) bentuk = bentukPerbuatan(kal, /wakaf/i, "wakaf");
  taruh(hasil, "9825", fakta(bentuk && bentuk.nilai, bentuk && bentuk.kalimat, bentuk && bentuk.akta ? "cukup" : "ragu", "wakaf-ikrar", "Bentuk dan tanggal ikrar wakaf dari posita; wakaf sebelum 15 Desember 2006 yang belum terdaftar dikuatkan keterangan saksi."));

  // 9826 Harta benda
  if (mW) {
    const sesudah = satu.slice(mW.index + mW[0].length);
    const o = /^\s*(.{6,420}?)\s+(?:untuk|guna|bagi|kepada|sebagai)\s+(?=[a-zA-Z])/i.exec(sesudah);
    const objek = P.rapiBenda(o ? o[1] : "");
    if (objek && P.bendaSah(objek)) taruh(hasil, "9826", fakta(objek, P.kalimatDi(satu, mW.index, mW[0].length), "ragu", "wakaf-harta-benda", "Benda wakaf menurut posita; lengkapi bukti hak, luas, letak dan batas-batas."));
  }
  if (!hasil["9826"]) {
    const bb = P.bendaBerletak(P.baris(posita));
    if (bb.benda.length) taruh(hasil, "9826", fakta(bb.benda[0], bb.kalimat, "ragu", "wakaf-harta-benda-letak", "Benda yang disebut posita berikut letaknya; periksa bahwa benda ini yang diwakafkan."));
  }

  // 9827 Peruntukan
  const kP = kal.find((k) => /wakaf|diwakafkan|mewakafkan/i.test(k) && /\b(?:untuk|guna|sebagai|peruntukan)\b/i.test(k) && PERUNTUKAN.some(([re]) => re.test(k)));
  if (kP) {
    const [re, label] = PERUNTUKAN.find(([r]) => r.test(kP));
    const kata = re.exec(kP)[0].toLowerCase();
    const nilai = label.startsWith("sarana ibadah") ? `sarana ibadah (${kata === "masjid" || kata === "mesjid" ? "masjid" : kata})` : label === "sarana pendidikan" ? `sarana pendidikan (${kata})` : label;
    taruh(hasil, "9827", fakta(nilai, kP, "ragu", "wakaf-peruntukan", "Peruntukan wakaf dibaca dari kata kunci; sesuaikan bunyinya dengan ikrar."));
  }

  // 9820 Pokok tuntutan
  const huruf = hurufTunggal(petitum || satu, HURUF_WAKAF);
  if (huruf) taruh(hasil, "9820", fakta(huruf.huruf, huruf.kalimat, "ragu", "wakaf-pokok-tuntutan", `Huruf ${huruf.huruf} dibaca dari ciri petitum; pilih huruf yang sesuai tuntutan sebenarnya.`));

  // Kedudukan
  const kedWakaf = /nazh?ir|wakif|ahli\s+waris|penerima|pembeli|pengurus|anak|cucu|saudara|penguasa|pengelola/i;
  const kPg = kedudukan(gabung, "Penggugat", kedWakaf);
  const kTg = kedudukan(gabung, "Tergugat", kedWakaf);
  const kPm = kedudukan(gabung, "Pemohon", kedWakaf);
  if (kPg) taruh(hasil, "9832", fakta(kPg.nilai, kPg.kalimat, "ragu", "wakaf-kedudukan-penggugat", ""));
  if (kTg) taruh(hasil, "9833", fakta(kTg.nilai, kTg.kalimat, "ragu", "wakaf-kedudukan-tergugat", ""));
  if (kPm || (!/\bPenggugat\b/.test(satu) && kPg)) {
    const k = kPm || kPg;
    taruh(hasil, "9836", fakta(k.nilai, k.kalimat, "ragu", "wakaf-kedudukan-pemohon", ""));
  }

  // 9841 Pihak yang menguasai
  m = /(?:dikuasai|dikelola|ditempati|digarap|dimanfaatkan)\s+oleh\s+([^;.]{3,100})/i.exec(satu);
  if (m) {
    const pihak = m[1].split(/\s+(?:sejak|tanpa|sehingga|karena|dan\s+tidak)\b/i)[0].replace(/[,\s]+$/, "");
    taruh(hasil, "9841", fakta(pihak, P.kalimatDi(satu, m.index, m[0].length), "ragu", "wakaf-penguasa", ""));
  }
  return hasil;
}

/* ---------------------------------------------------------------------------
 * WASIAT (365)
 * ------------------------------------------------------------------------- */

const HURUF_WASIAT = [
  ["A", /melebihi\s+(?:1\/3|sepertiga|\(?\s*satu\s+per\s*tiga)|lebih\s+dari\s+(?:1\/3|sepertiga)/i],
  ["B", /(?:kepada|untuk)\s+ahli\s+waris[^;]{0,80}?tanpa\s+persetujuan|tanpa\s+persetujuan\s+(?:ahli\s+waris|para\s+ahli\s+waris)/i],
  ["D", /bukan\s+(?:milik|hak)\s+(?:sah\s+)?(?:dari\s+)?(?:pewasiat|pewaris)/i],
  ["E", /pasal\s+197\b|\bkhi\s+197\b/i],
  ["F", /menyatakan\s+(?:sah|bahwa)[^;]{0,60}?wasiat[^;]{0,60}?\bsah\b|mengesahkan\s+wasiat|menyerahkan[^;]{0,60}?(?:sesuai|berdasarkan)\s+wasiat/i],
  ["G", /wasiat\s+wajibah/i],
];

function deteksiWasiat(posita, opsi = {}) {
  const satu = satuBaris(posita);
  const petitum = satuBaris(opsi.petitum || "");
  const hasil = {};
  if (!/wasiat|mewasiatkan|pewasiat/i.test(satu + " " + petitum)) return hasil;
  const gabung = `${satu}; ${petitum}`;
  const kal = butir(satu);

  // 9478 Bentuk dan tanggal
  let bentuk = null;
  const kSurat = kal.find((k) => /(?:surat\s+)?wasiat/i.test(k) && /(?:tertanggal|tanggal)\s+\d{1,2}/i.test(k));
  if (kSurat) {
    const notaris = /akta\s+(?:wasiat\s+)?(?:Notaris|notaris)/i.test(kSurat) ? nomorTanggal(kSurat) : null;
    if (notaris && notaris.nomor) bentuk = { nilai: `dengan akta Notaris Nomor ${notaris.nomor}${notaris.tanggal ? ` tanggal ${notaris.tanggal}` : ""}`, kalimat: kSurat, akta: true };
    else {
      const m = /surat\s+wasiat[^;]{0,80}?(?:tertanggal|tanggal)\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i.exec(kSurat) || /wasiat[^;]{0,80}?(?:tertanggal|tanggal)\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i.exec(kSurat);
      const tgl = m ? tanggalDi(m[1]) : tanggalDi(kSurat);
      if (tgl) bentuk = { nilai: `secara tertulis tertanggal ${tgl}`, kalimat: kSurat, akta: false };
    }
  }
  if (!bentuk) bentuk = bentukPerbuatan(kal, /wasiat/i, "wasiat");
  taruh(hasil, "9478", fakta(bentuk && bentuk.nilai, bentuk && bentuk.kalimat, bentuk && bentuk.akta ? "cukup" : "ragu", "wasiat-bentuk-tanggal", "Bentuk dan tanggal wasiat dari posita."));

  // 9479 Objek wasiat
  const mW = /(?:mewasiatkan|berwasiat\s+(?:agar|bahwa)?|wasiat\s+(?:berupa|atas|mengenai|meliputi))\s+/i.exec(satu);
  if (mW) {
    const sesudah = satu.slice(mW.index + mW[0].length);
    const o = /^(.{6,420}?)(?=\s+(?:kepada|untuk)\s+(?:[A-Z]|anak|cucu|istri|isteri|suami|ahli|para)|;|$)/i.exec(sesudah);
    const objek = P.rapiBenda(o ? o[1] : "");
    if (objek && P.bendaSah(objek)) taruh(hasil, "9479", fakta(objek, P.kalimatDi(satu, mW.index, mW[0].length), "ragu", "wasiat-objek", "Objek wasiat menurut posita; lengkapi bukti hak, luas, letak dan batas-batas."));
  }

  // 9475 Pokok tuntutan
  const huruf = hurufTunggal(petitum || satu, HURUF_WASIAT);
  if (huruf) taruh(hasil, "9475", fakta(huruf.huruf, huruf.kalimat, "ragu", "wasiat-pokok-tuntutan", `Huruf ${huruf.huruf} dibaca dari ciri petitum; pilih huruf yang sesuai tuntutan sebenarnya.`));
  else if (/(?:tidak\s+sah|batal\s+demi\s+hukum|membatalkan)[^;]{0,80}?wasiat|wasiat[^;]{0,80}?(?:tidak\s+sah|batal)/i.test(petitum)) {
    const m = /(?:tidak\s+sah|batal)/i.exec(petitum);
    taruh(hasil, "9475", fakta("C", P.kalimatDi(petitum, m.index, m[0].length), "ragu", "wasiat-pokok-batal-umum", "Petitum meminta wasiat dinyatakan tidak sah/batal tanpa menyebut dasarnya: C syarat pewasiat/bentuk, D harta bukan milik pewasiat, E Pasal 197 KHI. Pilih huruf yang sesuai."));
  }

  // Kedudukan
  const kedWasiat = /penerima\s+wasiat|ahli\s+waris|anak|cucu|saudara|pewasiat|pemegang|penguasa|pengelola/i;
  const kPg = kedudukan(gabung, "Penggugat", kedWasiat);
  const kTg = kedudukan(gabung, "Tergugat", kedWasiat);
  if (kPg) taruh(hasil, "9486", fakta(kPg.nilai, kPg.kalimat, "ragu", "wasiat-kedudukan-penggugat", ""));
  if (kTg) taruh(hasil, "9487", fakta(kTg.nilai, kTg.kalimat, "ragu", "wasiat-kedudukan-tergugat", ""));
  return hasil;
}

/* ---------------------------------------------------------------------------
 * MAFQUD (permohonan penetapan orang hilang, 369 Pdt.P)
 * ------------------------------------------------------------------------- */

const ANGKA_KATA = ["nol", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas", "dua belas"];
const KATA_ANGKA = new Map(ANGKA_KATA.map((k, i) => [k, i]));

function lamaTahun(teks) {
  const m = /(?:selama|sudah|telah|lebih\s+dari|kurang\s+lebih|sekitar|hingga\s+kini|hingga\s+sekarang)\s+(?:(\d{1,2})|(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas))\s*(?:\(\s*[a-z ]+\s*\)\s*)?tahun(?:\s+(?:(\d{1,2})\s*(?:\(\s*[a-z ]+\s*\)\s*)?bulan))?/i.exec(teks);
  if (!m) return null;
  const n = m[1] ? Number(m[1]) : KATA_ANGKA.get(m[2].toLowerCase());
  if (!Number.isFinite(n) || n < 1 || n > 60) return null;
  return { nilai: `${n} (${ANGKA_KATA[n] || n}) tahun${m[3] ? ` ${m[3]} bulan` : ""}`, indeks: m.index, panjang: m[0].length };
}

const POLA_MAFQUD_GATE = /mafqud|orang\s+hilang|menghilang|hilang\s+(?:tanpa|sejak)|tidak\s+diketahui\s+(?:keberadaan|kabar|tempat)|tidak\s+(?:ada|ada\s+lagi)\s+kabar|meninggalkan\s+(?:rumah|tempat\s+tinggal)[^;]{0,60}?(?:tidak\s+(?:kembali|pulang|diketahui)|hingga\s+kini)/i;

function deteksiMafqud(posita, opsi = {}) {
  const satu = satuBaris(posita);
  const hasil = {};
  if (!POLA_MAFQUD_GATE.test(satu)) return hasil;
  // Perkara kewarisan/waris yang MENYEBUT seorang ahli waris hilang bukan perkara mafqud: perihal (awal posita) atau petitum harus
  // menyebut mafqud / orang hilang / penetapan meninggal secara hukum.
  const penanda = /mafqud|orang\s+(?:yang\s+)?hilang|(?:ditetapkan|dinyatakan|dianggap)\s+(?:telah\s+)?(?:meninggal|mati)|meninggal\s+(?:dunia\s+)?secara\s+hukum/i;
  if (!penanda.test(satu.slice(0, 500)) && !penanda.test(satuBaris(opsi.petitum || ""))) return hasil;
  const kal = butir(satu);

  // 9860 Nama orang hilang
  let nama = "";
  let sumber = "";
  const AKSI_HILANG = /(?:menghilang|hilang\s+(?:tanpa|sejak)|pergi\s+meninggalkan|meninggalkan\s+(?:rumah|tempat)|tidak\s+diketahui\s+keberadaan|tidak\s+ada\s+kabar)/i;
  const kHilang = kal.find((k) => AKSI_HILANG.test(k) && !/^\s*Perihal\b/i.test(k));
  if (kHilang) {
    const idx = kHilang.search(AKSI_HILANG);
    nama = namaSebelum(kHilang, idx, 120) || namaSesudah(kHilang, 0, 160);
    sumber = kHilang;
  }
  if (!nama) {
    // "Pemohon adalah istri sah dari X" - nama orang yang hilang sebagai pasangan/keluarga Pemohon.
    const dari = /\bPemohon(?:\s+(?:I|II))?\s+(?:adalah|merupakan)\s+(?:istri|isteri|suami|anak|ibu|ayah|bapak|saudara|kakak|adik|menantu|cucu)[^;]{0,40}?\s+dari\s+/i.exec(satu);
    if (dari) {
      nama = namaSesudah(satu, dari.index + dari[0].length, 80);
      sumber = P.kalimatDi(satu, dari.index, dari[0].length);
    }
  }
  taruh(hasil, "9860", fakta(nama, sumber, "ragu", "mafqud-nama", "Nama orang yang hilang dibaca dari kalimat kepergiannya; pastikan bukan nama Pemohon."));

  // 9861 Kedudukan Pemohon
  const mK = /\bPemohon(?:\s+(?:I|II))?\s+(?:adalah|merupakan)\s+((?:istri|isteri|suami|anak|ibu|ayah|bapak|saudara|kakak|adik|ahli\s+waris|menantu|cucu)[^;.]{0,50}?)(?=\s+(?:dari|yang|sah|kandung)\b|[;.,]|$)/i.exec(satu);
  if (mK) {
    const kata = mK[1].replace(/\s+/g, " ").trim().toLowerCase().replace(/^isteri$/, "istri");
    taruh(hasil, "9861", fakta(kata, P.kalimatDi(satu, mK.index, mK[0].length), "ragu", "mafqud-kedudukan", ""));
  }

  // 9862 Tempat tinggal dan waktu terakhir diketahui
  const kTerakhir = kal.find((k) => /(?:terakhir|pergi|berangkat|meninggalkan|merantau)/i.test(k) && /(?:sejak|pada\s+(?:tanggal|bulan|tahun)|tahun\s+\d{4}|bulan\s+[A-Z])/i.test(k) && !/Pemohon\s+(?:adalah|merupakan)/i.test(k));
  if (kTerakhir) taruh(hasil, "9862", fakta(potong(kTerakhir.replace(/^(?:\d+[.)]\s*)?Bahwa\s+/i, ""), 300), kTerakhir, "ragu", "mafqud-terakhir", "Kalimat kepergian/kabar terakhir disalin dari posita; ringkas bila terlalu panjang."));

  // 9863 Upaya pencarian
  const kCari = kal.find((k) => /(?:mencari|pencarian|menghubungi|menelepon|menanyakan|bertanya|melapor(?:kan)?\s+(?:ke|kepada)|mencoba\s+menghubungi)/i.test(k) && /(?:tidak\s+(?:berhasil|ditemukan|ada|membuahkan)|belum\s+(?:berhasil|ditemukan)|sia-sia|nihil)/i.test(k));
  if (kCari) taruh(hasil, "9863", fakta(potong(kCari.replace(/^(?:\d+[.)]\s*)?Bahwa\s+/i, ""), 300), kCari, "ragu", "mafqud-pencarian", "Upaya pencarian dari posita (satu kalimat); ringkas bila perlu."));

  // 9864 Lama tidak ada kabar
  const lama = lamaTahun(satu);
  if (lama) taruh(hasil, "9864", fakta(lama.nilai, P.kalimatDi(satu, lama.indeks, lama.panjang), "ragu", "mafqud-lama", "Lama dihitung sampai hari penetapan; sesuaikan angkanya dengan tanggal penetapan."));
  else {
    const tahun = /(?:sejak|pada)\s+(?:bulan\s+[A-Za-z]+\s+)?(?:tahun\s+)?((?:19|20)\d{2})[^;]{0,60}?(?:pergi|menghilang|meninggalkan|tidak\s+(?:ada|diketahui))/i.exec(satu);
    if (tahun && opsi.tanggalDaftar) {
      const n = Number(String(opsi.tanggalDaftar).slice(0, 4)) - Number(tahun[1]);
      if (n >= 1 && n <= 60) taruh(hasil, "9864", fakta(`${n} (${ANGKA_KATA[n] || n}) tahun`, P.kalimatDi(satu, tahun.index, tahun[0].length), "ragu", "mafqud-lama-hitung", `Dihitung dari tahun ${tahun[1]} sampai tahun pendaftaran; sesuaikan dengan tanggal penetapan.`));
    }
  }

  // 9865 Kepentingan Pemohon (huruf)
  const kep = hurufTunggal(satu, [
    ["A", /harta\s+bersama|gono[\s-]?gini|pasal\s+96\s+khi/i],
    ["B", /warisan|pewarisan|harta\s+peninggalan|pasal\s+171\s+khi/i],
  ]);
  if (kep) taruh(hasil, "9865", fakta(kep.huruf, kep.kalimat, "ragu", "mafqud-kepentingan", `Huruf ${kep.huruf} dibaca dari kata kunci; C bila kepentingannya lain.`));
  return hasil;
}

/* ---------------------------------------------------------------------------
 * PENCEGAHAN PERKAWINAN (342)
 * ------------------------------------------------------------------------- */

const HURUF_PENCEGAHAN = [
  ["A", /masih\s+(?:terikat|dalam\s+ikatan)\s+(?:perkawinan|pernikahan)|(?:sudah|telah)\s+(?:beristri|bersuami)|poligami\s+tanpa/i],
  ["B", /di\s*bawah\s+umur|belum\s+(?:cukup\s+umur|mencapai\s+(?:usia|umur)\s+(?:19|sembilan\s*belas))/i],
  ["C", /mahram|hubungan\s+(?:nasab|darah|semenda|sesusuan)|sepersusuan|saudara\s+(?:kandung|sesusuan)/i],
  ["D", /masa\s+iddah|dalam\s+iddah/i],
  ["E", /beda\s+agama|tidak\s+beragama\s+islam|non[\s-]?muslim/i],
  ["F", /talak\s+tiga|li'?an|ba'?in\s+kubra/i],
  ["G", /tanpa\s+(?:persetujuan|izin|restu)|tidak\s+(?:menyetujui|setuju|merestui|memberi\s+(?:izin|restu))/i],
  ["H", /dibawah\s+pengampuan|di\s*bawah\s+pengampuan|gangguan\s+jiwa|gila/i],
];

function deteksiPencegahan(posita, opsi = {}) {
  const satu = satuBaris(posita);
  const petitum = satuBaris(opsi.petitum || "");
  const hasil = {};
  if (!/pencegahan/i.test(satu + " " + petitum)) return hasil;
  const gabung = `${satu}; ${petitum}`;

  // 1029 Nama calon suami
  let m = /\(\s*(?:selaku\s+|sebagai\s+)?calon\s+(?:suami|mempelai\s+pria|pengantin\s+pria)\s*\)/i.exec(gabung);
  let suami = m ? namaSebelum(gabung, m.index, 80) : "";
  let ks = m ? P.kalimatDi(gabung, m.index, m[0].length) : "";
  if (!suami) {
    m = /calon\s+(?:suami|mempelai\s+pria|pengantin\s+pria)(?:nya)?\s*(?:yang\s+)?(?:bernama|adalah|yaitu|:)?\s*/i.exec(gabung);
    if (m) {
      suami = namaSesudah(gabung, m.index + m[0].length, 80);
      ks = P.kalimatDi(gabung, m.index, m[0].length);
    }
  }
  if (!suami) {
    m = /(?:laki-laki|lelaki|pria)\s+(?:yang\s+)?bernama\s+/i.exec(gabung);
    if (m) {
      const n = namaSesudah(gabung, m.index + m[0].length, 60);
      if (n) {
        suami = n;
        ks = P.kalimatDi(gabung, m.index, m[0].length);
      }
    }
  }
  taruh(hasil, "1029", fakta(suami, ks, "ragu", "pencegahan-calon-suami", ""));

  // 9460 Nama calon istri
  let istri = "";
  let ki = "";
  m = /\(\s*(?:selaku\s+|sebagai\s+)?calon\s+(?:istri|isteri|mempelai\s+(?:wanita|perempuan)|pengantin\s+(?:wanita|perempuan))\s*\)/i.exec(gabung);
  if (m) {
    istri = namaSebelum(gabung, m.index, 80);
    ki = P.kalimatDi(gabung, m.index, m[0].length);
  }
  if (!istri) {
    m = /calon\s+(?:istri|isteri|mempelai\s+(?:wanita|perempuan)|pengantin\s+(?:wanita|perempuan))(?:nya)?\s*(?:yang\s+)?(?:bernama|adalah|yaitu|:)?\s*/i.exec(gabung);
    if (m) {
      istri = namaSesudah(gabung, m.index + m[0].length, 80);
      ki = P.kalimatDi(gabung, m.index, m[0].length);
    }
  }
  if (!istri) {
    m = /pencegahan\s+perkawinan\s+terhadap\s+/i.exec(satu);
    if (m) {
      const n = namaSesudah(satu, m.index + m[0].length, 50);
      if (n && !/\bbin\b/i.test(n) && n !== suami) {
        istri = n;
        ki = P.kalimatDi(satu, m.index, m[0].length);
      }
    }
  }
  taruh(hasil, "9460", fakta(istri, ki, "ragu", "pencegahan-calon-istri", "Nama lengkap dengan \"binti ...\"; nama calon suami ada di isian terpisah."));

  // 9461 Wilayah KUA
  m = /Kantor\s+Urusan\s+Agama\s+(?:\(KUA\)\s+)?(Kecamatan\s+[A-Z][A-Za-z\s]{2,40}?)(?=[,.;]|\s+(?:Kabupaten|Kota|dan|untuk|agar|yang|sebagai|di)\b|$)(?:[,\s]+(?:Kabupaten|Kota)\s+([A-Z][A-Za-z\s]{2,30}?)(?=[,.;]|\s+(?:dan|untuk|agar|yang|Provinsi)\b|$))?/.exec(gabung);
  if (m) taruh(hasil, "9461", fakta(m[2] ? `${m[1].trim()}, Kabupaten ${m[2].trim()}` : m[1].trim(), P.kalimatDi(gabung, m.index, m[0].length), "ragu", "pencegahan-kua", "Kecamatan KUA tempat perkawinan akan dilangsungkan; tambahkan kabupatennya bila belum tertulis."));

  // 9462 Kedudukan Pemohon
  const mK = /\bPemohon\s+(?:adalah|merupakan|selaku|sebagai)\s+((?:orang\s*tua|ayah|bapak|ibu|wali|istri|isteri|suami|saudara|kakak|adik|paman|Pegawai\s+Pencatat\s+Nikah|Kepala\s+KUA)[^;.]{0,60}?)(?=\s+(?:dari|yang|sah)\b|[;.,]|$)/i.exec(satu);
  if (mK) taruh(hasil, "9462", fakta(mK[1].replace(/\s+/g, " ").trim().toLowerCase().replace(/\bisteri\b/, "istri"), P.kalimatDi(satu, mK.index, mK[0].length), "ragu", "pencegahan-kedudukan", ""));

  // 9463 Alasan (huruf)
  const h = hurufTunggal(satu, HURUF_PENCEGAHAN);
  if (h) taruh(hasil, "9463", fakta(h.huruf, h.kalimat, "ragu", "pencegahan-alasan", `Huruf ${h.huruf} dibaca dari ciri posita; huruf yang dipilih hakim menurut yang terbukti.`));
  return hasil;
}

/* ---------------------------------------------------------------------------
 * PEMBATALAN PERKAWINAN (344)
 * ------------------------------------------------------------------------- */

const HURUF_PEMBATALAN = [
  ["A", /poligami\s+tanpa\s+izin|(?:beristri|bersuami)\s+(?:lagi\s+)?tanpa\s+izin|tanpa\s+izin\s+(?:pengadilan|istri\s+pertama)/i],
  ["B", /istri\s+orang\s+lain|masih\s+(?:terikat|menjadi\s+istri)|masa\s+iddah|sedang\s+(?:dalam\s+)?iddah/i],
  ["C", /di\s*bawah\s+umur|belum\s+(?:cukup\s+umur|mencapai\s+(?:usia|umur))/i],
  ["D", /tanpa\s+wali|wali\s+(?:nikah\s+)?(?:yang\s+)?(?:tidak\s+berhak|palsu|bukan)|wali\s+tidak\s+sah/i],
  ["E", /(?:di\s*bawah|dalam)\s+ancaman|paksaan|dipaksa/i],
  ["F", /mengandung\s+(?:anak\s+)?(?:benih\s+)?(?:biologis\s+)?(?:dari\s+)?(?:laki-laki\s+)?lain|hamil\s+(?:dari|oleh)\s+(?:laki-laki\s+)?lain|mengandung\s+biologis?\s+orang\s+lain|penipuan|menipu|salah\s+sangka|dibohongi|berbohong\s+mengenai/i],
  ["G", /pertalian\s+(?:nasab|darah|semenda|sesusuan)|sepersusuan|mahram/i],
];

function deteksiPembatalan(posita, opsi = {}) {
  const satu = satuBaris(posita);
  const petitum = satuBaris(opsi.petitum || "");
  const hasil = {};
  if (!/pembatalan\s+(?:perkawinan|nikah)|membatalkan\s+(?:perkawinan|nikah)/i.test(satu + " " + petitum)) return hasil;
  const h = hurufTunggal(satu, HURUF_PEMBATALAN);
  if (h) taruh(hasil, "9320", fakta(h.huruf, h.kalimat, "ragu", "pembatalan-alasan", `Huruf ${h.huruf} dibaca dari ciri posita (A poligami tanpa izin, B istri orang lain/iddah, C di bawah umur, D tanpa wali, E paksaan, F penipuan/salah sangka, G larangan kawin); hakim memilih menurut yang terbukti.`));
  return hasil;
}

/* ---------------------------------------------------------------------------
 * EKONOMI SYARIAH (370)
 * ------------------------------------------------------------------------- */

const AKAD = "(?:Murabahah|Mudharabah|Mudarabah|Musyarakah|Mudharabah|Ijarah(?:\\s+Muntahiya\\s+Bittamlik)?|IMBT|Istishna|Istisna|Salam|Qardh|Qard|Wadiah|Hawalah|Rahn|Wakalah|Kafalah|Tabarru|Musyarakah\\s+Mutanaqisah|Gadai\\s+Syariah|Tijarah)";
const POLA_AKAD = new RegExp(`((?:Akad|Perjanjian)\\s+(?:Pembiayaan\\s+|Jual\\s+Beli\\s+|Kerja\\s*sama\\s+|Sewa\\s+|Pinjaman\\s+)?(?:Murabahah|Mudharabah|Mudarabah|Musyarakah(?:\\s+Mutanaqisah)?|Ijarah(?:\\s+Muntahiya\\s+Bittamlik)?|Istishna|Istisna|Salam|Qardh|Qard|Wadiah|Hawalah|Rahn|Wakalah|Kafalah)[^;]{0,80}?)(?:Nomor|No\\.?)\\s*[:.]?\\s*([A-Za-z0-9][A-Za-z0-9./\\-]{2,60})(?:[^;]{0,30}?)(?:tanggal|tgl\\.?|tertanggal)\\s+(\\d{1,2}\\s+${BULAN_POLA}\\s+\\d{4})`, "gi");

function deteksiEkonomiSyariah(posita, opsi = {}) {
  const satu = satuBaris(posita);
  const petitum = satuBaris(opsi.petitum || "");
  const hasil = {};

  // 9340 Akad
  const akad = [];
  POLA_AKAD.lastIndex = 0;
  let m;
  while ((m = POLA_AKAD.exec(satu))) {
    const jenis = m[1].replace(/\s+/g, " ").replace(/[\s("“]+$/, "").trim();
    const nilai = `${jenis} Nomor ${m[2].replace(/[,.;]+$/, "")} tanggal ${tanggalDi(m[3])}`;
    if (!akad.some((a) => a.nilai === nilai)) akad.push({ nilai, kalimat: P.kalimatDi(satu, m.index, m[0].length) });
  }
  if (akad.length === 1) taruh(hasil, "9340", fakta(akad[0].nilai, akad[0].kalimat, "cukup", "es-akad", "Akad, nomor dan tanggal dibaca dari posita; periksa dengan bukti akad."));
  else if (akad.length > 1) {
    taruh(hasil, "9340", fakta(`${akad.slice(0, -1).map((a) => a.nilai).join("; ")}; dan ${akad[akad.length - 1].nilai}`, akad.map((a) => a.kalimat).join(" | "), "ragu", "es-akad-banyak", `Posita menyebut ${akad.length} akad; pilih yang disengketakan.`));
  } else {
    const jenis = new RegExp(`(?:Akad|Perjanjian)\\s+(?:Pembiayaan\\s+|Jual\\s+Beli\\s+)?${AKAD}`, "i").exec(satu);
    if (jenis) taruh(hasil, "9340", fakta(jenis[0].replace(/\s+/g, " "), P.kalimatDi(satu, jenis.index, jenis[0].length), "ragu", "es-akad-jenis", "Nomor/tanggal akad tidak tertulis di posita; lengkapi dari bukti."));
  }

  // 9341 Jumlah kewajiban yang digugat (angka saja)
  const mJ = /(?:membayar|melunasi|membayarkan)[^;]{0,200}?(?:sebesar|senilai|sejumlah|sebanyak)\s+Rp\.?\s*([\d.]+(?:,\d{1,2})?)/i.exec(petitum || satu);
  if (mJ) {
    const angka = mJ[1].replace(/\./g, "").replace(/,\d{1,2}$/, "");
    if (/^\d{4,}$/.test(angka)) taruh(hasil, "9341", fakta(angka, P.kalimatDi(petitum || satu, mJ.index, mJ[0].length), "ragu", "es-jumlah-digugat", "Ini jumlah yang DIGUGAT di petitum; isi dengan jumlah yang dikabulkan majelis."));
  }

  // 9345 Fakta wanprestasi
  const kal = butir(satu);
  const kW = kal.filter((k) => /(?:tidak\s+(?:membayar|melunasi|memenuhi)|cidera\s+janji|wanprestasi|menunggak|kredit\s+macet|pembiayaan\s+macet)/i.test(k) && /(?:angsuran|pembiayaan|pinjaman|kewajiban|tunggakan|outstanding)/i.test(k));
  const kS = kal.filter((k) => /surat\s+peringatan|somasi|teguran/i.test(k));
  if (kW.length) {
    const bagian = [potong(kW[0].replace(/^(?:\d+[.)]\s*)?Bahwa\s+/i, ""), 260)];
    const sp = kS.map((k) => /surat\s+peringatan[^;]{0,80}?sebanyak\s+([^,;.]{3,30}?kali)/i.exec(k)).find(Boolean);
    if (sp) bagian.push(`telah diberi surat peringatan sebanyak ${sp[1].trim()}`);
    taruh(hasil, "9345", fakta(bagian.join(", "), `${kW[0].slice(0, 200)}${kS.length ? ` | ${kS[0].slice(0, 180)}` : ""}`, "ragu", "es-wanprestasi", "Fakta wanprestasi disalin dari posita; ringkas menjadi satu kalimat sesudah kata \"Bahwa\" dan periksa sisa kewajibannya."));
  }

  // 9490 Klausula arbitrase
  const kA = kal.find((k) => /arbitrase|basyarnas|badan\s+arbitrase/i.test(k));
  if (kA) taruh(hasil, "9490", fakta(potong(kA.replace(/^(?:\d+[.)]\s*)?Bahwa\s+/i, ""), 260), kA, "ragu", "es-arbitrase", "Posita menyebut arbitrase; pasal akad dan lembaga arbitrase dilengkapi dari akad."));
  return hasil;
}

/* ---------------------------------------------------------------------------
 * HARTA BERSAMA / KEWARISAN: duplikat kutipan akta nikah
 * ------------------------------------------------------------------------- */

function deteksiDuplikatAktaNikah(posita) {
  const satu = satuBaris(posita);
  const hasil = {};
  const kal = butir(satu);
  const k = kal.find((x) => /duplikat/i.test(x) && /(?:akta|buku|kutipan|surat)\s+nikah|kutipan\s+akta/i.test(x));
  if (!k) return hasil;
  const dup = /duplikat[^;]{0,120}?(?:Nomor|No\.?)\s*[:.]?\s*([A-Za-z0-9][A-Za-z0-9./\-]{2,50})/i.exec(k);
  if (dup) taruh(hasil, "1108", fakta(dup[1].replace(/[,.;]+$/, ""), k, "cukup", "duplikat-nomor", "Nomor duplikat kutipan akta nikah disalin dari posita (tertulis dengan kata \"Duplikat ... Nomor\")."));
  const tg = /duplikat[^;]{0,200}?(?:tanggal|tgl\.?|tertanggal)\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i.exec(k);
  if (tg) taruh(hasil, "0889", fakta(tanggalDi(tg[1]), k, "cukup", "duplikat-tanggal", "Tanggal duplikat kutipan akta nikah disalin dari posita (tertulis dengan kata \"Duplikat ... tanggal\")."));
  return hasil;
}

/* ---------------------------------------------------------------------------
 * HAK ASUH / PENGUASAAN ANAK / NAFKAH ANAK (349, 350, 351, 369 Pdt.G)
 * ------------------------------------------------------------------------- */

/** Rupiah bentuk isian ABT: "Rp3.000.000,00 (tiga juta rupiah)". */
function bunyiRupiah(angka) {
  const T = require("../tuntutanDeteksiService");
  const n = Number(angka);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${T.formatRupiah(n)} (${T.terbilang(n)} rupiah)`;
}

function deteksiAsuhan(posita) {
  const satu = satuBaris(posita);
  const hasil = {};
  if (!satu) return hasil;
  const kal = butir(satu);

  // 5171 / 5271 Penghasilan per bulan
  for (const [kode, sebutan] of [["5171", "Penggugat|Pemohon"], ["5271", "Tergugat|Termohon"]]) {
    const re = new RegExp(String.raw`(?:penghasilan(?:nya)?\s+(?:${sebutan})|(?:${sebutan})\s+(?:berpenghasilan|memiliki\s+penghasilan|mempunyai\s+penghasilan|bergaji|menerima\s+gaji))[^;]{0,80}?Rp\.?\s*([\d.]+)(?:,\d{1,2})?`, "i");
    const m = re.exec(satu);
    if (m) {
      const angka = Number(m[1].replace(/\./g, ""));
      const bunyi = bunyiRupiah(angka);
      if (bunyi && angka >= 100000) taruh(hasil, kode, fakta(bunyi, P.kalimatDi(satu, m.index, m[0].length), "ragu", `asuhan-penghasilan-${kode}`, "Penghasilan per bulan menurut posita; tulis \"sekitar\" bila posita menyebut perkiraan."));
    }
  }

  // 9748 Fakta hukum asuhan dan kelalaian nafkah (kalimat sesudah kata "Bahwa")
  const kAsuh = kal.find((k) => /(?:diasuh|dipelihara|dirawat|tinggal\s+bersama|dalam\s+asuhan|berada\s+(?:dalam\s+)?(?:asuhan|pengasuhan)|ikut)\b/i.test(k) && /\banak\b/i.test(k));
  const kLalai = kal.find((k) => /(?:tidak\s+(?:pernah\s+)?(?:memberi|memberikan|menafkahi|membiayai|memenuhi)|lalai|menelantarkan|tidak\s+bertanggung\s*jawab)/i.test(k) && /(?:nafkah|biaya|anak)/i.test(k));
  if (kAsuh && kLalai && kAsuh !== kLalai) {
    const a = potong(kAsuh.replace(/^(?:\d+[.)]\s*)?Bahwa\s+/i, ""), 220);
    const l = potong(kLalai.replace(/^(?:\d+[.)]\s*)?Bahwa\s+/i, ""), 220);
    taruh(hasil, "9748", fakta(`${a}; ${l}`, `${kAsuh.slice(0, 180)} | ${kLalai.slice(0, 180)}`, "ragu", "asuhan-fakta", "Disalin dari dua butir posita (siapa mengasuh dan kelalaian nafkah); ringkas menjadi satu kalimat sesudah kata \"Bahwa\"."));
  } else if (kAsuh || kLalai) {
    const k = kAsuh || kLalai;
    taruh(hasil, "9748", fakta(potong(k.replace(/^(?:\d+[.)]\s*)?Bahwa\s+/i, ""), 300), k, "ragu", "asuhan-fakta-satu", "Hanya satu sisi (asuhan atau kelalaian nafkah) tertulis di posita; lengkapi sisi lainnya."));
  }
  return hasil;
}

/* ---------------------------------------------------------------------------
 * Pintu masuk
 * ------------------------------------------------------------------------- */

/** Kunci jenis S6 menurut id jenis perkara SIPP. */
const KUNCI_JENIS = Object.freeze({
  341: "izin-poligami",
  342: "pencegahan",
  343: "pencegahan",
  344: "pembatalan",
  348: "harta-bersama",
  364: "kewarisan",
  365: "wasiat",
  366: "hibah",
  367: "wakaf",
  369: "lain-lain",
  370: "ekonomi-syariah",
});

/**
 * @param {number|string} jenisPerkaraId id jenis SIPP
 * @param {string} posita
 * @param {{petitum?: string, namaPihak?: string[], tanggalDaftar?: string}} opsi
 * @returns {object} peta kode -> fakta
 */
function deteksi(jenisPerkaraId, posita, opsi = {}) {
  const id = Number(jenisPerkaraId);
  const hasil = {};
  const gabung = (peta) => {
    for (const [k, v] of Object.entries(peta || {})) if (!hasil[k]) hasil[k] = v;
  };
  try {
    if (id === 366) gabung(deteksiHibah(posita, opsi));
    else if (id === 367) gabung(deteksiWakaf(posita, opsi));
    else if (id === 365) gabung(deteksiWasiat(posita, opsi));
    else if (id === 342 || id === 343) gabung(deteksiPencegahan(posita, opsi));
    else if (id === 344) gabung(deteksiPembatalan(posita, opsi));
    else if (id === 370) gabung(deteksiEkonomiSyariah(posita, opsi));
    else if (id === 349 || id === 350 || id === 351) gabung(deteksiAsuhan(posita));
    else if (id === 369) {
      // Lain-Lain memuat banyak hal (hak asuh, pengangkatan anak, akta kematian, mafqud, ...): tiap pembaca menjaga gerbangnya sendiri.
      gabung(deteksiMafqud(posita, opsi));
      if (/\bhak\s+asuh|hadh?[ao]nah|nafkah\s+anak|penguasaan\s+anak/i.test(P.satuBaris(posita))) gabung(deteksiAsuhan(posita));
      gabung(deteksiWakaf(posita, opsi));
      gabung(deteksiHibah(posita, opsi));
      gabung(deteksiWasiat(posita, opsi));
    }
    if (id === 348 || id === 364 || id === 369) gabung(deteksiDuplikatAktaNikah(posita));
  } catch {
    /* pembaca per jenis tidak pernah menggagalkan usulan lain */
  }
  return hasil;
}

module.exports = {
  KUNCI_JENIS,
  deteksi,
  deteksiHibah,
  deteksiWakaf,
  deteksiWasiat,
  deteksiMafqud,
  deteksiPencegahan,
  deteksiPembatalan,
  deteksiEkonomiSyariah,
  deteksiDuplikatAktaNikah,
  deteksiAsuhan,
  bunyiRupiah,
  // pembantu (diuji)
  semuaNama,
  namaSebelum,
  namaSesudah,
  nomorTanggal,
  hurufTunggal,
  lamaTahun,
  bentukPerbuatan,
};
