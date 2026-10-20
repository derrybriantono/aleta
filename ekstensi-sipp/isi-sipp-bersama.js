"use strict";

/**
 * ============================================================================
 * ISI DARI SIPP - MESIN BERSAMA (19 Okt 2026)
 * ============================================================================
 *
 * Satu mesin untuk dua tempat:
 *   - panel "Isi dari SIPP & input ke ABT" (hakim) dan "(BAS)" (panitera) di abt.js,
 *   - "Isi otomatis dari SIPP" di Blangko ABT by Derry Briantono (blangko-derry-isian.js).
 *
 * Yang dipakai bersama (bukan disalin ke rumus lain):
 *   - rute bacaan yang sama: POST aleta-bot/abt/usulan (sumber "sipp", "saksi", "itsbat", "posita-lain"),
 *     GET aleta-ecourt/isi-gugatan, GET aleta-ecourt/kuasa-gugatan, GET aleta-ecourt/ktp-pihak;
 *   - pembobotan usulan (terdeteksi, bobot, pangkat keyakinan) dan tanda keyakinan/kesepakatan - berkas abt.js memakai
 *     bentuk yang sama persis; uji menjaga keduanya tetap sama;
 *   - petunjuk tanggal KTP per variabel (KTP_KODE_PIHAK).
 *
 * Aturan menulis sendiri (hakim dan panitera: semua isian, bukan usulan bercentang - keputusan pengguna):
 *   - usulan berkeyakinan "pasti" atau "cukup", bernilai, dan isiannya KOSONG -> ditulis;
 *   - isian yang sudah ada isinya (diketik petugas atau tersimpan di ABT) TIDAK PERNAH ditimpa, KECUALI nilai bawaan kueri
 *     ABT yang jelas mentah (memuat tag HTML, atau potongan posita panjang pada isian pendek) dan belum pernah disunting
 *     petugas: itu diganti hasil mesin bila pasti/cukup (penggantian dicatat di riwayat agar dapat diurungkan);
 *   - usulan "ragu", "bentrok", "ocr", atau yang hanya berupa pilihan -> hanya SARAN / pilihan bunyi;
 *   - yang dihitung ABT sendiri, huruf alasan perceraian (8503) dan alasan cerai (5227: bunyi dipilih petugas) tidak
 *     ditulis sendiri; nilai yang memuat kata "ALETA" tidak pernah ditulis;
 *   - elemen HTML dibuang dari nilai (kecuali variabel yang memang berisi HTML dari kuerinya: KODE_HTML);
 *   - periode ditulis baku: "bulan Januari 2023", "tahun 2023".
 *
 * Murni (tanpa DOM): seluruh akses jaringan lewat fungsi `ambil` yang diberikan pemanggil.
 */
(function isiSippBersamaModul(akar) {
  if (!akar || akar.AletaIsiSipp) return;

  const API = Object.freeze({
    usulan: "/aleta/api/aleta-bot/abt/usulan",
    gugatan: "/aleta/api/aleta-ecourt/isi-gugatan",
    kuasa: "/aleta/api/aleta-ecourt/kuasa-gugatan",
    ktp: "/aleta/api/aleta-ecourt/ktp-pihak",
  });

  /** Pangkat keyakinan usulan - yang lebih yakin menang bila dua sumber mengusulkan variabel yang sama. */
  const PANGKAT_YAKIN = Object.freeze({ pasti: 5, cukup: 4, ragu: 2, bentrok: 2, kosong: 0, tidak_ada_sumber: 0 });
  /** Keyakinan yang boleh ditulis sendiri. */
  const YAKIN_OTOMATIS = Object.freeze(["pasti", "cukup"]);
  /** Variabel tanggal KTP per pihak (sama dengan KTP_KODE_PIHAK di abt.js). */
  const KTP_KODE_PIHAK = Object.freeze({
    2222: Object.freeze({ cabang: 1, urutan: 1, sebutan: "Penggugat/Pemohon" }),
    "0364": Object.freeze({ cabang: 1, urutan: 1, sebutan: "Penggugat/Pemohon" }),
    "0365": Object.freeze({ cabang: 2, urutan: 1, sebutan: "Tergugat/Termohon" }),
    "0366": Object.freeze({ cabang: 1, urutan: 2, sebutan: "Pemohon II" }),
  });
  /**
   * Isian yang tidak pernah ditulis sendiri: huruf alasan perceraian (keputusan hakim) dan alasan-alasan cerai
   * (bunyi dipilih petugas dari varian - tampil sebagai pilihan bunyi).
   */
  const HANYA_SARAN = Object.freeze(["8503", "5227"]);
  /** Keterangan saksi yang dibaca mesin: kode isian yang berasal dari keterangan saksi / posita alasan cerai. */
  const VAR_ALASAN_CERAI = Object.freeze(["0222", "5227", "0246", "9944", "7035", "1268", "8503"]);
  /** Variabel yang memicu bacaan berkas bukti e-Court (P4_VAR_BUKTI di abt.js). */
  const VAR_BUKTI = Object.freeze(["9470", "9488", "9489", "9492", "9493", "9951", "9952", "0654", "0655"]);
  /** Variabel yang diisi dari berkas e-Court (P4_VAR_ECOURT + K5_VAR_KONTAK di abt.js): bacaan e-Court hanya diminta bila blangko memuatnya. */
  const VAR_ECOURT = Object.freeze([
    "6055", "6054", "7120", "6071", "6072", "7778", "5110", "5111", "0007", "2004", "7084", "9881", "5227", "8436", "8437", "9355", "9491", "9681", "9164", "9283", "9470", "9488", "9489", "9492", "9493", "9951", "9952", "0654", "0655",
    "0027", "0045", "8175", "8179", "8180", "0370", "0372", "0123", "7139", "8548", "8549", "8800", "8801", "8802", "8803", "8804", "8805", "8806", "8807", "8808", "8809", "8810", "8811", "8813",
  ]);
  /** Variabel kuasa dari surat gugatan (A3_VAR_KUASA di abt.js). */
  const VAR_KUASA = Object.freeze(["0156", "0184", "8538", "8537"]);
  /**
   * Variabel yang KUERINYA memang menghasilkan HTML (tag <br>, <li>, <strong>, ...), mis. 8500 "MAJELIS HAKIM/HAKIM TUNGGAL
   * (KHUSUS TTD PUTUSAN)" dan tabel/TTD sejenis. Daftar eksplisit dari katalog kueri ABT (kamus-variabel-awal.json: kolom q/d
   * bertag HTML); uji menjaganya tetap sama dengan katalog. Nilainya TIDAK dibersihkan dari HTML.
   */
  const KODE_HTML = Object.freeze([
    "0067", "0068", "0206", "10101", "10102", "4001", "5404", "6000", "6001", "7006", "7007", "7008", "7044", "7045", "7046", "7047", "7048", "7050", "7052", "7054", "7055", "7057", "7058", "7061", "7062", "7080", "7089", "7097", "7098", "7100", "7102", "7104", "7107", "7108", "7109", "7129", "7131", "7133", "7140", "7169", "7170", "8185", "8495", "8499", "8500", "8502", "8506", "8507", "8508", "8509", "8510", "8521", "8522", "8523", "8524", "8526", "8527", "8528", "8530", "8531", "8533", "8534", "8547",
  ]);
  /** Isian periode (awal konflik, pisah rumah): "bulan Januari 2023" / "tahun 2023". */
  const KODE_PERIODE = Object.freeze(["0222", "0246"]);
  /** Isian pendek (periode/lama pisah): nilai panjang di sini pasti potongan posita mentah, bukan isian. */
  const ISIAN_PENDEK = Object.freeze(["0222", "0246", "9944"]);
  const BATAS_PENDEK = 200;
  const NAMA_BULAN = Object.freeze(["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]);

  const teks = (v) => (v === null || v === undefined ? "" : String(v));

  // ──────────────────────────────────────────────────────────────────────────
  // Teks: HTML, periode
  // ──────────────────────────────────────────────────────────────────────────
  /** Memuat tag HTML atau entitas HTML? */
  function adaHtml(t) {
    return /<\s*\/?\s*[a-z][^>]*>|&(?:nbsp|amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/i.test(teks(t));
  }
  /** HTML -> teks rapi: <br>, penutup <div>/<p>/<li> menjadi pemisah baris; tag lain dibuang; entitas diurai; spasi dirapikan. */
  function htmlKeTeks(t) {
    let x = teks(t);
    if (!adaHtml(x)) return x;
    x = x
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\s*\/\s*(?:div|p|li|tr|h\d|ul|ol|table)\s*>/gi, "\n")
      .replace(/<\s*li\b[^>]*>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&apos;|&#0*39;/gi, "'")
      .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCharCode(parseInt(n, 16)))
      .replace(/&amp;/gi, "&");
    return x
      .split("\n")
      .map((baris) => baris.replace(/[ \t ]+/g, " ").trim())
      .filter(Boolean)
      .join("\n");
  }
  /** Nilai yang diisikan/ditampilkan: HTML dibuang kecuali variabel yang memang berisi HTML dari kuerinya. */
  function bersihkanNilai(kode, nilai) {
    return KODE_HTML.includes(teks(kode)) ? teks(nilai) : htmlKeTeks(nilai);
  }
  /** Periode baku: "Januari 2023" -> "bulan Januari 2023", "2023" -> "tahun 2023"; tidak menggandakan awalan. Selain itu apa adanya. */
  function formatPeriode(nilai) {
    const t = teks(nilai).replace(/\s+/g, " ").trim();
    let m = t.match(new RegExp(`^(?:bulan\\s+)*(${NAMA_BULAN.join("|")}|Pebruari|Nopember)\\s*,?\\s+(?:tahun\\s+)?(\\d{4})$`, "i"));
    if (m) {
      const kecil = m[1].toLowerCase();
      const baku = kecil === "pebruari" ? "februari" : kecil === "nopember" ? "november" : kecil;
      return `bulan ${NAMA_BULAN.find((b) => b.toLowerCase() === baku)} ${m[2]}`;
    }
    // "awal bulan Agustus 2025" bukan salah satu bentuk isian (bulan _ / tahun _ / awal tahun / akhir tahun): menjadi "bulan Agustus 2025".
    m = t.match(new RegExp(`^(?:awal|akhir|pertengahan)\\s+(?:bulan\\s+)+(${NAMA_BULAN.join("|")}|Pebruari|Nopember)\\s*,?\\s+(?:tahun\\s+)?(\\d{4})$`, "i"));
    if (m) {
      const kecil = m[1].toLowerCase();
      const baku = kecil === "pebruari" ? "februari" : kecil === "nopember" ? "november" : kecil;
      return `bulan ${NAMA_BULAN.find((b) => b.toLowerCase() === baku)} ${m[2]}`;
    }
    m = t.match(/^(awal|akhir|pertengahan)\s+(?:tahun\s+)*(\d{4})$/i);
    if (m) return `${m[1].toLowerCase()} tahun ${m[2]}`;
    m = t.match(/^(?:tahun\s+)*(\d{4})$/i);
    if (m) return `tahun ${m[1]}`;
    return t;
  }
  /** Nilai bawaan kueri ABT yang jelas mentah: bertag/berentitas HTML, atau terlalu panjang untuk isian pendek (potongan posita). */
  function jelasMentah(kode, nilai) {
    const t = teks(nilai);
    if (!t.trim() || KODE_HTML.includes(teks(kode))) return false;
    return adaHtml(t) || (ISIAN_PENDEK.includes(teks(kode)) && t.length > BATAS_PENDEK) || jelasSalahBentuk(kode, t);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Bentuk nilai menurut MAKNA isian (19 Okt, isian 2)
  // ──────────────────────────────────────────────────────────────────────────
  /**
   * Jenis makna tiap isian yang bentuk nilainya dijaga. Kunci = kode variabel ABT.
   *   periode       awal konflik / pisah rumah sejak       -> "bulan Juni 2020", "tahun 2020", "awal tahun 2020", "awal pernikahan"
   *   lama          lama pisah                              -> "1 tahun 4 bulan"
   *   pihak         yang meninggalkan rumah                 -> "Tergugat" / "Penggugat" (sebutan pihak saja)
   *   kalimat       upaya damai keluarga                    -> satu kalimat, tanpa baris baru
   *   anak          telah dikaruniai anak                   -> "telah dikaruniai 2 orang anak" / "belum dikaruniai anak"
   *   tempat        KUA tempat menikah (nama tempat)        -> "Kecamatan Palolo, Kabupaten Sigi" (bukan potongan posita)
   *   tanggalNikah  tanggal nikah                           -> "04 Juli 2011"
   */
  const BENTUK_KODE = Object.freeze({
    "0222": "periode",
    "0246": "periode",
    9944: "lama",
    7035: "pihak",
    1268: "kalimat",
    "0007": "anak",
    5178: "tempat",
    5197: "tanggalNikah",
  });
  const NAMA_BULAN_BAKU = NAMA_BULAN.join("|");
  const POLA_BULAN_ID = `(?:${NAMA_BULAN_BAKU}|Pebruari|Nopember)`;
  const ANGKA4 = /[0-9]{4}/.source;
  const POLA_PERIODE = new RegExp(
    "^(?:bulan " + POLA_BULAN_ID + " " + ANGKA4 + "|tahun " + ANGKA4 + "|(?:awal|akhir|pertengahan) (?:tahun " + ANGKA4 + "|bulan " + POLA_BULAN_ID + " " + ANGKA4 + ")|awal (?:pernikahan|perkawinan|menikah|berumah tangga))$",
    "i"
  );
  const POLA_LAMA = /^(?:(?:kurang lebih|sekitar|±|lebih dari)\s+)?\d{1,3}\s*(?:\([^)]{1,25}\)\s*)?(?:tahun|bulan|minggu|hari)(?:\s+(?:dan\s+)?\d{1,3}\s*(?:\([^)]{1,25}\)\s*)?(?:bulan|minggu|hari))?$/i;
  const POLA_PIHAK = /^(?:penggugat|tergugat|pemohon|termohon)(?:\s+(?:i|ii|iii|iv))?$/i;
  const POLA_TANGGAL_NIKAH = new RegExp("^[0-9]{1,2} " + POLA_BULAN_ID + " (?:19|20)[0-9]{2}$", "i");
  /** Kata yang menandakan potongan kalimat/dokumen, bukan nama tempat atau periode. */
  const POLA_KALIMAT_MENTAH = /sebagaimana|bahwa\b|nomor|nomer|tertanggal|melangsungkan|kutipan|akta|surat\s+keterangan|ghoib|ghaib|meninggalkan|\bpergi\b|\btelah\b|\bsudah\b|\byang\b|\bdan\b.*\bdan\b|\d{2,3}\/\d{1,3}\/[IVX]+\//i;
  const BARIS_BARU = /[\r\n]+/;
  /** Teks rapat: baris baru dan spasi ganda menjadi satu spasi. */
  const satuBaris = (t) => teks(t).replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
  /** Jenis makna isian ini ("" = tidak dijaga). Kode dari katalog, atau nama isian untuk periode. */
  function bentukIsian(kode, nama) {
    const k = BENTUK_KODE[teks(kode)];
    if (k) return k;
    return /(awal konflik|awal perselisihan|puncak|pisah rumah sejak)/i.test(teks(nama)) ? "periode" : "";
  }
  /**
   * Nilai ini sesuai makna isian? true bila isiannya tidak dijaga. Murni. `nilai` sudah dibersihkan dari HTML.
   * Periode diterima setelah dibakukan (formatPeriode), jadi "Juni 2020" sah.
   */
  function sahBentuk(kode, nilai, nama) {
    const jenis = bentukIsian(kode, nama);
    if (!jenis) return true;
    const t = satuBaris(nilai);
    if (!t) return false;
    if (jenis === "periode") return POLA_PERIODE.test(formatPeriode(t));
    if (jenis === "lama") return POLA_LAMA.test(t);
    if (jenis === "pihak") return POLA_PIHAK.test(t);
    if (jenis === "tanggalNikah") return POLA_TANGGAL_NIKAH.test(t);
    if (jenis === "kalimat") return t.length <= 400 && /(damai|rukun|nasihat|nasehat|musyawarah|mediasi|upaya|usaha|berusaha)/i.test(t) && !/[<>#]/.test(t);
    if (jenis === "anak") return t.length <= 250 && /anak/i.test(t) && /(dikaruniai|mempunyai|memiliki|punya|keturunan)/i.test(t) && !POLA_KALIMAT_MENTAH_ANAK.test(t);
    if (jenis === "tempat") return t.length <= 90 && !POLA_KALIMAT_MENTAH.test(t) && !/[<>#;]/.test(t);
    return true;
  }
  /** Anak: kalimat ghaib / dokumen ikut menolak, tetapi "dan" lazim ("anak A dan anak B"). */
  const POLA_KALIMAT_MENTAH_ANAK = /sebagaimana|nomor|tertanggal|melangsungkan|kutipan|akta|surat\s+keterangan|ghoib|ghaib/i;
  /**
   * Nilai yang sudah SAH dirapikan ke bentuk tulisnya: periode baku, satu baris untuk isian kalimat/anak. Selain itu apa adanya.
   */
  function rapikanBentuk(kode, nilai, nama) {
    const jenis = bentukIsian(kode, nama);
    if (jenis === "periode") return formatPeriode(satuBaris(nilai));
    if (jenis === "kalimat" || jenis === "anak" || jenis === "tempat" || jenis === "lama" || jenis === "pihak" || jenis === "tanggalNikah") return satuBaris(nilai);
    return teks(nilai);
  }
  /**
   * Nilai isian yang TERISI tetapi jelas bukan bentuk isiannya (kalimat ghaib di "Awal perselisihan", potongan posita di "KUA"):
   * boleh diganti hasil mesin yang pasti/cukup bila belum pernah disunting petugas. Lebih ketat daripada sahBentuk supaya ketikan
   * petugas yang sekadar tidak baku ("sejak lebaran 2020") TIDAK dianggap mentah: hanya yang panjang atau bernada kalimat peristiwa.
   */
  function jelasSalahBentuk(kode, nilai) {
    const jenis = bentukIsian(kode, "");
    if (!jenis || jenis === "kalimat") return false;
    const t = satuBaris(nilai);
    if (!t || sahBentuk(kode, t, "")) return false;
    if (jenis === "anak") return false;
    return t.length > 60 || POLA_KALIMAT_MENTAH.test(t) || BARIS_BARU.test(teks(nilai));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Bobot usulan
  // ──────────────────────────────────────────────────────────────────────────
  /** Usulan punya nilai, atau sekurang-kurangnya satu pilihan bernilai? (sama dengan soreTerdeteksi di abt.js) */
  function terdeteksi(u) {
    if (teks(u && u.nilai).trim()) return true;
    return Array.isArray(u && u.pilihan) && u.pilihan.some((p) => (p && typeof p === "object" ? teks(p.nilai).trim() : teks(p).trim()));
  }
  /** Bobot usulan (sama dengan soreBobot di abt.js). */
  function bobot(u) {
    return (terdeteksi(u) ? 10 : 0) + (PANGKAT_YAKIN[u.keyakinan] || 1);
  }

  /** Teks memuat kata ALETA (juga yang direnggangkan/disamarkan)? Pakai penjaga ekstensi bila ada. */
  function menyebutAleta(t) {
    const penjaga = akar.AletaPenjagaTanda;
    if (penjaga && typeof penjaga.menyebutAleta === "function") {
      try {
        if (penjaga.menyebutAleta(t)) return true;
      } catch {
        /* jatuh ke pemeriksaan dasar */
      }
    }
    const dasar = teks(t).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
    return dasar.includes("aleta") || /(?<![a-z0-9])a[\s._\-*·•/\\|,:;'"`~+]*l[\s._\-*·•/\\|,:;'"`~+]*e[\s._\-*·•/\\|,:;'"`~+]*t[\s._\-*·•/\\|,:;'"`~+]*a(?![a-z0-9])/i.test(dasar);
  }

  /** Usulan terbaik per kode dari beberapa sumber (Map kode -> usulan); hanya kode yang ada di `kodeBoleh` (Set) bila diberikan. */
  function pilihPerKode(sumber, kodeBoleh) {
    const perKode = new Map();
    for (const daftar of sumber || []) {
      for (const u of Array.isArray(daftar) ? daftar : []) {
        if (!u || !u.kode) continue;
        const kode = teks(u.kode);
        if (kodeBoleh && !kodeBoleh.has(kode)) continue;
        const lama = perKode.get(kode);
        if (!lama || bobot(u) > bobot(lama)) perKode.set(kode, u);
      }
    }
    return perKode;
  }

  /** Label pilihan bunyi dalam kalimat biasa: "templat hakim" -> "bunyi hakim", "(bentuk baku ALETA)" dibuang. */
  function labelBunyi(keadaan) {
    return teks(keadaan)
      .replace(/\s*\(\s*bentuk baku\s+aleta\s*\)/gi, "")
      .replace(/\s*bentuk baku\s+aleta\b/gi, "")
      .replace(/templat hakim/gi, "bunyi hakim")
      .replace(/\s+/g, " ")
      .trim();
  }
  /** Semua pilihan bunyi untuk satu kode dari semua sumber (tanpa duplikat, HTML dibuang, yang memuat ALETA dibuang). */
  function kumpulPilihan(sumber, kode) {
    const hasil = [];
    const lihat = new Set();
    for (const daftar of sumber || []) {
      for (const u of Array.isArray(daftar) ? daftar : []) {
        if (!u || teks(u.kode) !== teks(kode) || !Array.isArray(u.pilihan)) continue;
        u.pilihan.forEach((p, i) => {
          const o = p && typeof p === "object" ? p : { nilai: teks(p) };
          const nilai = bersihkanNilai(kode, o.nilai).trim();
          if (!nilai || lihat.has(nilai) || menyebutAleta(nilai)) return;
          lihat.add(nilai);
          hasil.push({ keadaan: labelBunyi(o.keadaan || `pilihan ${i + 1}`), nilai });
        });
      }
    }
    return hasil;
  }

  /** Nilai usulan yang akan dipakai: nilai, atau (hanya untuk keterangan) kosong bila usulan hanya berupa pilihan. */
  function nilaiUsulan(u) {
    const n = teks(u && u.nilai).trim();
    if (n) return { nilai: n, dariPilihan: false };
    const ada = (Array.isArray(u && u.pilihan) ? u.pilihan : []).some((x) => (x && typeof x === "object" ? teks(x.nilai) : teks(x)).trim());
    return { nilai: "", dariPilihan: ada };
  }

  /** Asal usulan untuk catatan jejak: kalimat awam. */
  function asalUsulan(u) {
    const sumber = Array.isArray(u && u.sumber) ? u.sumber : [];
    const a = sumber[0] ? teks(sumber[0].asal) : "";
    if (a === "ktp-ecourt") return "berkas KTP e-Court";
    if (a === "gugatan-ecourt") return "surat gugatan e-Court";
    if (a === "elitigasi") return "data pihak";
    if (a === "data-nikah") return "data pernikahan di SIPP";
    if (a === "posita-gugatan") return "posita gugatan";
    if (a === "bukti-akta") return "bukti akta nikah";
    if (sumber.some((s) => s && s.saksi)) return "keterangan saksi";
    if (sumber.length && sumber.every((s) => s && s.asal === "posita")) return "posita";
    return "SIPP";
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Lencana dan kutipan sumber (sama dengan kartu usulan di panel ABT: NADA_TINGKAT, NADA_KESEPAKATAN)
  // ──────────────────────────────────────────────────────────────────────────
  const NADA_TINGKAT = Object.freeze({
    pasti: Object.freeze({ kelas: "hijau", teks: "yakin: pasti" }),
    cukup: Object.freeze({ kelas: "kuning", teks: "yakin: cukup" }),
    ragu: Object.freeze({ kelas: "abu", teks: "yakin: ragu — periksa" }),
  });
  const NADA_KESEPAKATAN = Object.freeze({
    sama: Object.freeze({ kelas: "hijau", teks: "kedua saksi sama" }),
    berbeda: Object.freeze({ kelas: "merah", teks: "saksi berbeda" }),
    "satu saksi": Object.freeze({ kelas: "kuning", teks: "satu saksi" }),
    dihitung: Object.freeze({ kelas: "kuning", teks: "dihitung dari pisah rumah" }),
    posita: Object.freeze({ kelas: "kuning", teks: "dari posita — belum dikuatkan saksi" }),
  });
  /** Lencana satu usulan: { yakin, asal, sepakat|null } masing-masing { kelas, teks }. */
  function lencanaUsulan(u) {
    const kunciYakin = NADA_TINGKAT[u && u.tingkat] ? u.tingkat : teks(u && u.keyakinan) === "pasti" ? "pasti" : teks(u && u.keyakinan) === "cukup" ? "cukup" : "ragu";
    const sumber = Array.isArray(u && u.sumber) ? u.sumber : [];
    const a = sumber[0] ? teks(sumber[0].asal) : "";
    const hanyaPosita = sumber.length > 0 && sumber.every((s) => s && s.asal === "posita");
    let asal;
    if (a === "ktp-ecourt") asal = { kelas: "hijau", teks: "dari berkas KTP e-Court" };
    else if (a === "gugatan-ecourt") asal = { kelas: "kuning", teks: "dari berkas e-Court" };
    else if (a === "elitigasi") asal = { kelas: "hijau", teks: "dari data pihak" };
    else if (a === "data-nikah") asal = { kelas: "hijau", teks: "dari data pernikahan SIPP" };
    else if (a === "posita-gugatan") asal = { kelas: "kuning", teks: "dari posita gugatan" };
    else if (a === "bukti-akta") asal = { kelas: "kuning", teks: "dari bukti akta nikah" };
    else if (hanyaPosita) asal = { kelas: "kuning", teks: "dari posita — belum dikuatkan saksi" };
    else if (sumber.some((s) => s && s.saksi)) asal = { kelas: "abu", teks: "dari keterangan saksi" };
    else asal = { kelas: "abu", teks: "dari SIPP" };
    let sepakat = null;
    if (teks(u && u.bentrok).trim() || (u && u.keyakinan) === "bentrok") sepakat = { kelas: "merah", teks: "saksi berselisih" };
    else if (typeof (u && u.kesepakatan) === "string" && NADA_KESEPAKATAN[u.kesepakatan] && teks(u.nilai).trim() && !hanyaPosita) sepakat = NADA_KESEPAKATAN[u.kesepakatan];
    return { yakin: NADA_TINGKAT[kunciYakin], asal, sepakat };
  }
  /** Kutipan sumber satu usulan: [{ label, kalimat }] (label seperti di panel: Posita, Gugatan e-Court, KTP e-Court, Data pihak, Saksi N, SIPP). */
  function kutipanUsulan(u) {
    return (Array.isArray(u && u.sumber) ? u.sumber : [])
      .filter(Boolean)
      .map((s) => ({
        label: s.asal === "posita" ? "Posita" : s.asal === "gugatan-ecourt" ? "Gugatan e-Court" : s.asal === "ktp-ecourt" ? "KTP e-Court" : s.asal === "elitigasi" ? "Data pihak" : s.asal === "data-nikah" ? "Data pernikahan SIPP" : s.asal === "posita-gugatan" ? "Posita gugatan" : s.asal === "bukti-akta" ? "Bukti akta nikah" : s.saksi ? `Saksi ${s.saksi}` : "SIPP",
        kalimat: htmlKeTeks(s.kalimat || s.keterangan || "").slice(0, 400),
      }))
      .filter((s) => s.kalimat);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Keputusan
  // ──────────────────────────────────────────────────────────────────────────
  /**
   * Menentukan nasib satu usulan untuk satu isian.
   *   ctx: { kosong: boolean, bolehGanti?: boolean, jenis: "teks"|"tanggal", opsi: [{nilai,label}], keIso: fn, periode?: boolean }
   *   bolehGanti = isian terisi tetapi nilainya bawaan kueri ABT yang jelas mentah dan belum pernah disunting petugas.
   * -> { golongan: "tulis" | "saran" | "pilihan" | "lewati", nilai, sebab, ganti }
   */
  function putuskan(u, ctx) {
    const c = ctx || {};
    const kode = teks(u && u.kode);
    if (!u || !kode) return { golongan: "lewati", nilai: "", sebab: "tidak ada usulan", ganti: false };
    if (u.dihitung === true) return { golongan: "lewati", nilai: "", sebab: "dihitung ABT sendiri", ganti: false };
    if (!terdeteksi(u)) return { golongan: "lewati", nilai: "", sebab: "tidak terdeteksi", ganti: false };
    const { nilai: mentah, dariPilihan } = nilaiUsulan(u);
    if (dariPilihan) return { golongan: "pilihan", nilai: "", sebab: "pilihan", ganti: false };
    let nilai = bersihkanNilai(kode, mentah).trim();
    if (!nilai) return { golongan: "lewati", nilai: "", sebab: "kosong", ganti: false };
    if (KODE_PERIODE.includes(kode) || c.periode === true) nilai = formatPeriode(nilai);
    if (menyebutAleta(nilai)) return { golongan: "lewati", nilai: "", sebab: "memuat nama aplikasi", ganti: false };
    // 19 Okt (isian 2): nilai harus sesuai MAKNA isiannya; yang salah bentuk tidak ditulis dan tidak disarankan.
    if (c.jenis !== "tanggal") {
      if (!sahBentuk(kode, nilai, c.nama)) return { golongan: "lewati", nilai: "", sebab: "bentuk tidak sesuai isian", ganti: false };
      nilai = rapikanBentuk(kode, nilai, c.nama);
    }
    if (c.jenis === "tanggal") {
      const iso = typeof c.keIso === "function" ? c.keIso(nilai) : "";
      if (!iso) return { golongan: "lewati", nilai: "", sebab: "tanggal tidak terbaca", ganti: false };
      nilai = iso;
    } else if (Array.isArray(c.opsi) && c.opsi.length) {
      const cocok = c.opsi.find((o) => o && (teks(o.nilai) === nilai || teks(o.label).trim().toLowerCase() === nilai.toLowerCase()));
      if (!cocok) return { golongan: "lewati", nilai: "", sebab: "bukan salah satu pilihan isian", ganti: false };
      nilai = teks(cocok.nilai);
    }
    const kosong = c.kosong !== false;
    if (!kosong && c.bolehGanti !== true) return { golongan: "lewati", nilai, sebab: "sudah ada isinya", ganti: false };
    const ganti = !kosong;
    const yakin = teks(u.keyakinan);
    const yakinOto = YAKIN_OTOMATIS.includes(yakin) && !teks(u.bentrok).trim();
    if (!yakinOto || HANYA_SARAN.includes(kode)) return { golongan: "saran", nilai, sebab: HANYA_SARAN.includes(kode) ? "keputusan hakim" : yakin || "belum pasti", ganti };
    return { golongan: "tulis", nilai, sebab: yakin, ganti };
  }

  /** Bahan tampilan isian yang "diisi manual": lencana abu "diisi manual", tanpa sumber, alasan di catatan (ikon ⓘ). */
  function infoManual(kode, alasan) {
    return {
      kode,
      nilai: "",
      golongan: "manual",
      sebab: "diisi manual",
      keyakinan: "",
      asal: "",
      lencana: { yakin: { kelas: "abu", teks: "diisi manual" }, asal: null, sepakat: null },
      sumber: [],
      catatan: htmlKeTeks(teks(alasan)).slice(0, 500),
      bentrok: "",
      pilihan: [],
      ganti: false,
    };
  }

  /**
   * Rencana isian untuk satu blangko.
   *   usulan  : Map kode -> usulan terbaik (pilihPerKode)
   *   katalog : [{ kode, nama?, jenis: "teks"|"tanggal", opsi?, kosong: boolean, bolehGanti?: boolean }]
   *   semuaUsulan : [daftar usulan per sumber] (untuk menggabung pilihan bunyi)
   * -> { tulis, saran, lewati, info } ; info[kode] = bahan lencana/kutipan/pilihan untuk tampilan.
   */
  function rencanakan(usulan, katalog, keIso, semuaUsulan) {
    const hasil = { tulis: [], saran: [], lewati: [], info: {} };
    for (const b of katalog || []) {
      const kode = teks(b.kode);
      const u = usulan.get(kode);
      // 20 Okt (S3): isian yang tidak mungkin terisi otomatis diberi tanda "diisi manual" dan alasannya - tidak dibiarkan kosong tanpa kabar.
      if (!u) {
        if (b.manual === true && b.kosong !== false && teks(b.alasanManual).trim()) hasil.info[kode] = infoManual(kode, b.alasanManual);
        continue;
      }
      const periode = /(awal konflik|puncak|pisah rumah|sejak)/i.test(teks(b.nama)) && b.jenis === "teks";
      const h = putuskan(u, { kosong: b.kosong !== false, bolehGanti: b.bolehGanti === true, jenis: b.jenis, opsi: b.opsi, keIso, periode, nama: b.nama });
      // Pengisi menyatakan terus terang "tidak ada sumber" (mis. nomor SK prodeo) atau isian ditandai manual dan tak ada nilai: tanda "diisi manual".
      if (h.golongan === "lewati" && h.sebab === "tidak terdeteksi" && b.kosong !== false) {
        const alasan = htmlKeTeks(teks(u.catatan)).trim() || teks(b.alasanManual).trim();
        if (alasan && (teks(u.keyakinan) === "tidak_ada_sumber" || b.manual === true)) {
          hasil.info[kode] = infoManual(kode, alasan);
          continue;
        }
      }
      const butir = { kode, nilai: h.nilai, keyakinan: teks(u.keyakinan), asal: asalUsulan(u), ganti: h.ganti };
      if (h.golongan === "tulis") hasil.tulis.push(butir);
      else if (h.golongan === "saran") hasil.saran.push(butir);
      else if (h.golongan === "lewati") hasil.lewati.push({ kode, sebab: h.sebab });
      const pilihan = kumpulPilihan(semuaUsulan || [[u]], kode);
      if (h.golongan !== "lewati" || h.sebab === "sudah ada isinya" || pilihan.length) {
        hasil.info[kode] = {
          kode,
          nilai: h.nilai,
          golongan: h.golongan,
          sebab: h.sebab,
          keyakinan: teks(u.keyakinan),
          asal: butir.asal,
          lencana: lencanaUsulan(u),
          sumber: kutipanUsulan(u),
          catatan: htmlKeTeks(teks(u.catatan)).slice(0, 500),
          bentrok: htmlKeTeks(teks(u.bentrok)).slice(0, 300),
          pilihan,
          ganti: h.ganti,
        };
      }
    }
    return hasil;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Beracara secara elektronik (7139): SARAN bila belum cukup pasti untuk ditulis (19 Okt, isian 2)
  // ──────────────────────────────────────────────────────────────────────────
  const POLA_EMAIL = /^[^\s@,;:<>()]+@[^\s@,;:<>()]+\.[A-Za-z]{2,}$/;
  const EMAIL_INSTANSI = /@(?:pa-[\w-]+|[\w-]+\.mahkamahagung|mahkamahagung|badilag\.mahkamahagung)\.go\.id$/i;
  const emailPihak = (t) => {
    const x = teks(t).replace(/\s+/g, "").replace(/[.,;]+$/, "");
    return POLA_EMAIL.test(x) && !EMAIL_INSTANSI.test(x) ? x.toLowerCase() : "";
  };
  /**
   * Saran #7139 dari kontak perkara (bentuk kontak-pihak): perkara e-Court yang TERBUKTI (kontak.elitigasi.lewatEcourt) lalu
   *   - Tergugat/kuasanya punya email           -> "1" (e-litigasi penuh);
   *   - tidak ada email yang terbaca            -> "2" (hybrid: diunggah Panitera Sidang).
   * Yang bukan perkara e-Court tidak disarankan apa pun. Keputusan yang cukup pasti untuk ditulis tetap milik el7Putuskan di abt.js
   * (email pasti / hadir tanpa email); fungsi ini hanya mengisi kekosongan itu dengan SARAN. -> { nilai, keterangan } | null
   */
  function saranElitigasi(kontak) {
    if (!kontak || typeof kontak !== "object" || kontak.ada === false) return null;
    const f = kontak.elitigasi && typeof kontak.elitigasi === "object" ? kontak.elitigasi : null;
    if (!f || f.lewatEcourt !== true) return null;
    let email = "";
    const dom = kontak.domisili && typeof kontak.domisili === "object" ? kontak.domisili[2] : null;
    if (dom) email = emailPihak(dom.email);
    for (const o of Array.isArray(kontak.orang) ? kontak.orang : []) {
      if (email) break;
      if (!o || Number(o.pihakKe) !== 2) continue;
      email = emailPihak(o.sipp && o.sipp.email) || emailPihak(o.usulan && o.usulan.email && o.usulan.email.nilai);
    }
    return email
      ? { nilai: "1", keterangan: "Perkara e-Court dan Tergugat (atau kuasanya) memiliki email di data perkara." }
      : { nilai: "2", keterangan: "Perkara e-Court, tetapi tidak ada email Tergugat yang terbaca; berkas Tergugat diunggah Panitera Sidang." };
  }

  /** Usulan tanggal KTP per variabel dari pihak e-Court (ktp-pihak). Yang "ragu" menjadi saran; selain itu "cukup". */
  function usulanTanggalKtp(pihak, kodeAda) {
    const hasil = [];
    for (const kode of Object.keys(KTP_KODE_PIHAK)) {
      if (kodeAda && !kodeAda.has(kode)) continue;
      const peran = KTP_KODE_PIHAK[kode];
      const p = (Array.isArray(pihak) ? pihak : []).find((x) => Number(x.cabang) === peran.cabang && Number(x.urutan) === peran.urutan);
      if (!p || !p.tanggalKtp) continue;
      const pasti = p.yakin === "pasti";
      const ragu = p.yakin === "ragu";
      hasil.push({ kode, nama: `Tanggal KTP ${p.peran || peran.sebutan}`, nilai: teks(p.tanggalKtp), keyakinan: ragu ? "ragu" : pasti ? "pasti" : "cukup", sumber: [{ asal: "ktp-ecourt", keterangan: "berkas KTP e-Court" }] });
    }
    return hasil;
  }

  const kepala = { "Content-Type": "application/json" };
  /** Kunci jawaban bot untuk tiap sumber tambahan. */
  const KUNCI_JAWABAN = Object.freeze({ saksi: "saksi", itsbat: "itsbat", "posita-lain": "positaLain" });

  /**
   * Membaca semua sumber usulan untuk satu perkara. Satu sumber gagal tidak menggagalkan yang lain;
   * kegagalannya masuk `catatan` (untuk konsol/jejak, bukan untuk layar petugas).
   *   o: { ambil(alamat, opsi, yang) -> data JSON, nomor, kodeAda: Set, pelaku, lawan, ktp: boolean, batasKtpMs, hanyaKtp: boolean,
   *        tambahan: [{ sumber: "saksi"|"itsbat"|"posita-lain", muatan: {...} }] }
   *   ktp = baca juga berkas KTP e-Court (lambat: menunggu pemindaian); hanyaKtp = HANYA itu, tanpa sumber lain.
   *   tambahan = permintaan ke rute usulan bot yang sama dengan panel ABT (keterangan saksi, posita itsbat, posita perkara lain).
   * -> { usulan: [daftar usulan per sumber], info: { jumlahKuasa, prodeo, kontak }, bagian: { saksi, itsbat, positaLain }, pihakKtp: [], catatan: [] }
   */
  async function kumpulkan(o) {
    const nomor = teks(o && o.nomor).trim();
    const hasil = { usulan: [], info: { jumlahKuasa: 0, prodeo: false, kontak: null }, bagian: {}, pihakKtp: [], catatan: [] };
    if (!nomor || !o || typeof o.ambil !== "function") return hasil;
    const catat = (sumber, galat) => hasil.catatan.push(`${sumber}: ${teks((galat && galat.message) || galat)}`);
    const kodeAda = o.kodeAda instanceof Set ? o.kodeAda : new Set();
    const tugas = [];
    const lain = o.hanyaKtp !== true;
    if (lain) {
      tugas.push(
        (async () => {
          const isi = await o.ambil(API.usulan, { method: "POST", headers: kepala, body: JSON.stringify({ nomorPerkara: nomor, sumber: "sipp" }) }, "Membaca usulan");
          if (!isi || isi.available === false) throw new Error((isi && isi.message) || "bot tidak menjawab");
          const s = isi.sipp || {};
          if (s.ok === false) throw new Error(s.alasan || "SIPP tidak menjawab");
          hasil.usulan.push(Array.isArray(s.usulan) ? s.usulan : []);
          hasil.info.jumlahKuasa = Number(s.jumlahKuasa) || 0;
          hasil.info.prodeo = Boolean(s.prodeo);
        })().catch((g) => catat("SIPP", g))
      );
      for (const t of Array.isArray(o.tambahan) ? o.tambahan : []) {
        const kunci = KUNCI_JAWABAN[t && t.sumber];
        if (!kunci) continue;
        tugas.push(
          (async () => {
            const isi = await o.ambil(API.usulan, { method: "POST", headers: kepala, body: JSON.stringify({ nomorPerkara: nomor, ...t.muatan, sumber: t.sumber }) }, "Membaca usulan");
            if (!isi || isi.available === false) throw new Error((isi && isi.message) || "bot tidak menjawab");
            const bagian = isi[kunci];
            if (!bagian || bagian.ok === false) throw new Error((bagian && (bagian.alasan || bagian.message)) || "tidak terbaca");
            hasil.bagian[kunci] = bagian;
            hasil.usulan.push(Array.isArray(bagian.usulan) ? bagian.usulan : []);
          })().catch((g) => catat(t.sumber, g))
        );
      }
    }
    if (lain && VAR_ECOURT.some((k) => kodeAda.has(k))) {
      tugas.push(
        (async () => {
          const q = new URLSearchParams({ nomor, lawan: teks(o.lawan), pelaku: teks(o.pelaku) });
          if (VAR_BUKTI.some((k) => kodeAda.has(k))) q.set("bukti", "1");
          const isi = await o.ambil(`${API.gugatan}?${q.toString()}`, {}, "Membaca berkas e-Court");
          hasil.usulan.push(Array.isArray(isi && isi.usulan) ? isi.usulan : []);
          if (isi && isi.kontak && typeof isi.kontak === "object") hasil.info.kontak = isi.kontak;
        })().catch((g) => catat("berkas e-Court", g))
      );
    }
    if (lain && VAR_KUASA.some((k) => kodeAda.has(k))) {
      tugas.push(
        (async () => {
          const isi = await o.ambil(`${API.kuasa}?nomor=${encodeURIComponent(nomor)}`, {}, "Membaca kuasa dari gugatan");
          hasil.usulan.push(Array.isArray(isi && isi.usulan) ? isi.usulan : []);
        })().catch((g) => catat("kuasa", g))
      );
    }
    if (o.ktp === true) {
      tugas.push(
        (async () => {
          const isi = await o.ambil(`${API.ktp}?nomor=${encodeURIComponent(nomor)}&tunggu=1`, { batasMs: Number(o.batasKtpMs) || undefined }, "Membaca tanggal KTP");
          hasil.pihakKtp = Array.isArray(isi && isi.pihak) ? isi.pihak : [];
          hasil.usulan.push(usulanTanggalKtp(hasil.pihakKtp, kodeAda));
        })().catch((g) => catat("tanggal KTP", g))
      );
    }
    await Promise.all(tugas);
    return hasil;
  }

  akar.AletaIsiSipp = Object.freeze({
    API,
    PANGKAT_YAKIN,
    YAKIN_OTOMATIS,
    KTP_KODE_PIHAK,
    HANYA_SARAN,
    VAR_ALASAN_CERAI,
    VAR_BUKTI,
    VAR_ECOURT,
    VAR_KUASA,
    KODE_HTML,
    KODE_PERIODE,
    ISIAN_PENDEK,
    NADA_TINGKAT,
    NADA_KESEPAKATAN,
    adaHtml,
    htmlKeTeks,
    bersihkanNilai,
    formatPeriode,
    BENTUK_KODE,
    bentukIsian,
    sahBentuk,
    rapikanBentuk,
    jelasSalahBentuk,
    jelasMentah,
    terdeteksi,
    bobot,
    menyebutAleta,
    pilihPerKode,
    kumpulPilihan,
    labelBunyi,
    nilaiUsulan,
    asalUsulan,
    lencanaUsulan,
    kutipanUsulan,
    putuskan,
    rencanakan,
    infoManual,
    usulanTanggalKtp,
    saranElitigasi,
    kumpulkan,
  });
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : null);
