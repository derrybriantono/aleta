"use strict";

/**
 * ============================================================================
 * BLANGKO ABT BY DERRY BRIANTONO - KEADAAN PERKARA DARI POSITA (U2, 1 Nov 2026)
 * ============================================================================
 *
 * Pilihan keadaan perkara (borang katalog saksi) yang dahulu hanya bawaan di jalur Blangko Derry kini diturunkan dari posita
 * permohonan yang SUDAH dibaca (bahan saksi). Hanya sebagai nilai awal: pilihan petugas tetap menang (dijaga pemanggil:
 * ktKeadaanPerkara menimpa dengan st.keadaan), dan yang tidak jelas dari posita TIDAK ditebak (kunci tidak dikeluarkan).
 *
 *   itsbat nikah      bentuk        satu pemohon di SIPP padahal posita menyebut dua pemohon -> "permohonan-berdua";
 *                                   gugatan yang pasangannya meninggal -> "gugatan-pasangan-meninggal" (pola ketat)
 *                     dasarItsbat   Pasal 7 ayat (3) KHI: nikah sebelum 1974 -> huruf d; dalam rangka perceraian -> a;
 *                                   akta nikah hilang -> b; keraguan syarat -> c; selain itu huruf e (bawaan katalog)
 *   dispensasi kawin  sebabDK           hamil / hubungan-badan (posita menyebutnya)
 *                     calonJuga         umur calon pasangan < 19 tahun -> di-bawah-umur; >= 19 -> dewasa (hanya bila umurnya tertulis)
 *                     jenisKelaminAnak  "binti" / "Calon Suami Anak Pemohon" -> perempuan; "bin" / "Calon Istri Anak Pemohon" -> laki-laki
 *
 * Murni (tanpa jaringan, tanpa DOM): satu lintasan regex atas teks posita; hasil diingat per teks oleh pemanggil bila perlu.
 */
(function () {
  const teks = (x) => String(x === undefined || x === null ? "" : x);
  const BATAS_UMUR_NIKAH = 19; // UU 16/2019: batas umur menikah 19 tahun

  /** Kalimat/baris posita (teks polos atau HTML ringan). */
  function butirDari(posita) {
    return teks(posita)
      .replace(/<\/(?:li|p|ol|ul|div|tr)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&[a-z#0-9]+;/gi, " ")
      .split(/\n|;\s+/)
      .map((k) => k.replace(/\s+/g, " ").trim())
      .filter((k) => k.length > 6)
      .slice(0, 400);
  }

  // --------------------------------------------------------------------------
  // Itsbat nikah
  // --------------------------------------------------------------------------

  const RE_DUA_PEMOHON = /\bPemohon\s*(?:II|2)(?![A-Za-z0-9])|\bpara\s+Pemohon\b|\bPemohon\s*I\s+(?:dan|dengan)\s+Pemohon\b/i;
  const RE_PASANGAN_MENINGGAL = [
    /\b(?:suami|isteri|istri)\s+(?:dari\s+)?(?:Pemohon|Penggugat)\b[^.;]{0,100}?\b(?:telah\s+)?(?:meninggal|wafat)\b/i,
    /\b(?:Pemohon|Penggugat)\s+dengan\s+(?:almarhum|almarhumah|alm\.?)\s/i,
    /\b(?:almarhum|almarhumah)\s+(?:suami|isteri|istri)\s+(?:dari\s+)?(?:Pemohon|Penggugat)\b/i,
  ];

  /** Tahun pernikahan yang tertulis di kalimat peristiwa nikah pertama; null bila tidak ada. */
  function tahunNikah(butir) {
    for (const b of butir) {
      if (!/\b(?:melangsungkan|menikah|dilangsungkan|dilaksanakan|terjadi|dinikahkan)\b/i.test(b)) continue;
      if (!/\b(?:pernikahan|perkawinan|nikah)\b/i.test(b)) continue;
      if (/\b(?:lahir|cerai|bercerai|meninggal|wafat|kematian|akta|nomor|surat|mengajukan|didaftarkan|terdaftar)\b/i.test(b)) continue;
      const y = /(?<![0-9])(19\d\d|20[0-3]\d)(?![0-9])/.exec(b);
      if (y) return Number(y[1]);
    }
    for (const b of butir) {
      const m = /(?:menetapkan|pengesahan)\s+(?:sahnya\s+)?(?:perkawinan|pernikahan)[^.;]*?(?:terjadi|dilangsungkan|dilaksanakan)\s+pada[^.;]*?(?<![0-9])(19\d\d|20[0-3]\d)(?![0-9])/i.exec(b);
      if (m) return Number(m[1]);
    }
    return null;
  }

  /** Pasal 7 ayat (3) KHI: kunci keadaan "huruf-?" atau "" (tidak jelas = bawaan). */
  function dasarItsbat(butir) {
    const semua = butir.join("\n");
    const tahun = tahunNikah(butir);
    if (tahun !== null && tahun < 1974) return "huruf-d";
    if (/\b(?:dalam\s+rangka|untuk\s+(?:keperluan|kepentingan|mengurus))\s+(?:penyelesaian\s+)?(?:perkara\s+)?perceraian\b|\bmengajukan\s+(?:gugatan|permohonan)\s+cerai\b|\bakan\s+(?:menggugat|mengajukan)\s+cerai\b/i.test(semua)) return "huruf-a";
    if (/\b(?:akta|kutipan|buku)\s+nikah\b[^.;]{0,60}\b(?:hilang|rusak|musnah|terbakar|dicuri)\b|\b(?:hilang|rusak|musnah|terbakar)\b[^.;]{0,40}\b(?:akta|kutipan|buku)\s+nikah\b/i.test(semua)) return "huruf-b";
    if (/\b(?:keraguan|diragukan)\b[^.;]{0,100}\b(?:sah|syarat)/i.test(semua)) return "huruf-c";
    return "";
  }

  // --------------------------------------------------------------------------
  // Yang menikahkan: wali sendiri atau imam/penghulu (keputusan Derry 111, 2 Nov 2026)
  // --------------------------------------------------------------------------
  //
  // Wali (biasanya ayah) kadang MENIKAHKAN SENDIRI anaknya. Bentuk posita yang terukur (sipp_2810, 3.123 posita itsbat):
  //   "wali nikah dan yang menikahkan adalah X (Ayah Kandung Pemohon II)"      "wali nikah sekaligus yang menikahkan yaitu X"
  //   "wali nikah yaitu X (...) dan yang menikahkan adalah X (...)" (nama sama) "yang menikahkan adalah Wali nikah Pemohon II"
  //   "wali hakim bernama X dan sekaligus menikahkan"                         "yang menikahkan adalah Ayah Kandung Pemohon II"
  // Pembaca bot (isiJawabanSaksiPositaNikah.peranNikah) memakai aturan yang sama untuk isian 8087/1217; di sini hanya keadaan
  // "penikah" untuk memilih butir pertanyaan. Tidak jelas = tidak dikeluarkan (bawaan katalog: imam/penghulu).

  const PENANDA_PERAN = /(?<![A-Za-z])(?:wali(?:\s+(?:nikah|nasab|hakim))*(?:nya)?|(?:yang\s+)?menikahkan(?:nya)?|dinikahkan\s+(?:secara\s+\w+\s+|langsung\s+|sendiri\s+)?oleh|dihadiri|disaksikan|saksi(?:[\s-]+nikah)?|mas\s*kawin|maskawin|mahar)(?![a-z])/gi;
  const HUB = "(?:ayah|ayahanda|bapak|orang\\s*tua|kakek|kakak|abang|adik|saudara|paman)(?:\\s*(?:kandung|kadung|tiri|seayah|sebapak))?";
  const RE_HUB_AWAL = new RegExp(`^\\s*(?:adalah|yaitu|ialah|oleh)?\\s*(?:langsung\\s+|sendiri\\s+)?(?:oleh\\s+)?(${HUB})(?![a-z])`, "i");
  const NAMA = "((?:[A-Z][\\w.'’`-]*)(?:\\s+(?:[A-Z][\\w.'’`-]*|bin|binti|Dg\\.?)){0,4})";
  const RE_NAMA_BERNAMA = new RegExp(`(?:[Bb]ernama|[Bb]enama|[Bb]ernma)\\s*:?\\s*(?:Bapak\\s+|Bpk\\.?\\s+|Pak\\s+)?${NAMA}`);
  const RE_NAMA_KURUNG = new RegExp(`^\\s*(?:adalah|yaitu|ialah|oleh)?\\s*(?:Bapak\\s+|Bpk\\.?\\s+|Pak\\s+)?${NAMA}\\s*\\(`);
  const RE_NAMA_LANGSUNG = new RegExp(`^\\s*(?:adalah|yaitu|ialah)\\s+(?:Bapak\\s+|Bpk\\.?\\s+|Pak\\s+)?${NAMA}\\s*(?:,|\\bdan\\b|$)`);
  const BUKAN_NAMA_KP = /^(?:Pemohon|Termohon|Penggugat|Tergugat|Ayah|Bapak|Ibu|Kakak|Adik|Saudara|Paman|Kakek|Wali|Kepala|Pegawai|Tidak|Kandung|Nasab|Bernama)$/;
  /** Penanda isian blangko yang tidak diganti ("WALI NIKAH", "SAKSI NIKAH I"): bukan nama orang. */
  const NAMA_ISIAN = /(?:^|\s)(?:NIKAH|WALI|SAKSI|PEMOHON|WAKIL)(?:\s|$)/;
  const akar = (h) => {
    const t = String(h || "").toLowerCase();
    if (/ayah|bapak|orang\s*tua/.test(t)) return "ayah";
    if (/kakak|abang|adik|saudara/.test(t)) return "saudara";
    const m = /kakek|paman/.exec(t);
    return m ? m[0] : "";
  };
  const kunciNama = (n) =>
    String(n || "")
      .toLowerCase()
      .replace(/\s+(?:bin|binti)\s+.*$/, "")
      .replace(/^(?:(?:h|hj|hi|haji|drs|dr|ir|ust|pak|bapak|bpk)\.?\s+)+/, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  /** Nama orang di awal/dalam satu potongan peran ("bernama X", "yaitu X (...)"), atau "". */
  function namaPotongan(s) {
    const m = RE_NAMA_BERNAMA.exec(s) || RE_NAMA_KURUNG.exec(s) || RE_NAMA_LANGSUNG.exec(s);
    if (!m) return "";
    const n = m[1].replace(/[.,]+$/, "");
    return BUKAN_NAMA_KP.test(n.split(/\s+/)[0]) || NAMA_ISIAN.test(n) ? "" : n;
  }

  /** Potongan peran satu kalimat; penanda di dalam kurung keterangan tidak memotong. */
  function potongan(b) {
    const tanpaKurung = b.replace(/\([^()]{0,200}\)/g, (m) => `(${" ".repeat(m.length - 2)})`);
    const hasil = [];
    PENANDA_PERAN.lastIndex = 0;
    let m;
    while ((m = PENANDA_PERAN.exec(tanpaKurung))) {
      const kata = m[0].toLowerCase();
      const jenis = /^wali/.test(kata) ? "wali" : /nikahkan/.test(kata) ? "penikah" : /mahar|kawin/.test(kata) ? "mahar" : "saksi";
      const sebelum = tanpaKurung.slice(Math.max(0, m.index - 16), m.index);
      if (jenis === "wali" && /(?:bernama|benama)\s*:?\s*(?:WAKIL\s+)?$/i.test(sebelum)) continue; // isian "bernama WALI NIKAH" yang tidak diganti
      hasil.push({ jenis, awal: m.index, akhir: m.index + m[0].length, sekaligus: /sekaligus\s*(?:yang\s*)?$/i.test(sebelum), batal: jenis === "penikah" && /(?:untuk|agar|guna|bersedia|enggan|tidak\s+mau|tidak\s+dapat|belum)\s*$/i.test(sebelum) });
    }
    for (let i = 0; i < hasil.length; i++) hasil[i].teks = b.slice(hasil[i].akhir, i + 1 < hasil.length ? hasil[i + 1].awal : b.length);
    return hasil.filter((p) => !p.batal);
  }

  const KOSONG = /^(?:\s|,|:|\bdan\b|\bserta\b|\bsekaligus\b|\bjuga\b|\bsebagai\b|\badalah\b|\byaitu\b|\bialah\b|\bantara\b|\bdengan\b|\bPemohon\b|\bII?\b|\bnikah\b|\bnasab\b)*$/i;

  /** "wali-sendiri" bila posita menyebut wali sendiri yang menikahkan; "imam-penghulu" bila menyebut orang lain; "" bila tidak jelas. */
  function penikahDariPosita(butir) {
    for (const b of butir) {
      if (!/nikahkan/i.test(b)) continue;
      const pot = potongan(b);
      const iP = pot.findIndex((p) => p.jenis === "penikah");
      if (iP < 0) continue;
      const p = pot[iP];
      const wali = pot.find((x) => x.jenis === "wali");
      const sebelumnya = pot[iP - 1];
      const berikut = pot[iP + 1];
      const isiKosong = KOSONG.test(p.teks);
      // wali yang sudah disebut lengkap lebih dulu di kalimat yang sama: "wali nikah ayah ... bernama X dan wali nikah dan yang ..." jarang;
      // penanda wali kosong sebelum "menikahkan" hanya berarti satu orang bila belum ada wali berisi sebelumnya
      const waliBerisi = pot.slice(0, Math.max(0, iP - 1)).some((x) => x.jenis === "wali" && !KOSONG.test(x.teks));
      if (sebelumnya && sebelumnya.jenis === "wali" && KOSONG.test(sebelumnya.teks) && !isiKosong && !waliBerisi) return "wali-sendiri";
      if (isiKosong && berikut && berikut.jenis === "wali") return "wali-sendiri";
      if (p.sekaligus && sebelumnya && sebelumnya.jenis === "wali") return "wali-sendiri";
      const nP = kunciNama(namaPotongan(p.teks));
      const nW = wali ? kunciNama(namaPotongan(wali.teks)) : "";
      if (nP && nW && nP.length >= 3 && nP === nW) return "wali-sendiri";
      const hP = RE_HUB_AWAL.exec(p.teks) || RE_HUB_AWAL.exec(p.teks.replace(/^\s*(?:adalah|yaitu)?\s*[A-Z][^()]{0,60}\(\s*/, ""));
      if (hP) {
        const hW = wali ? new RegExp(HUB, "i").exec(wali.teks) : null;
        const pihakI = /\b(?:Pemohon|Penggugat)\s+I(?![I\w])/.test(p.teks.slice(0, 120)) && !/\bII\b/.test(p.teks.slice(0, 120));
        if (!nP && hW && akar(hP[1]) === akar(hW[0])) return "wali-sendiri";
        if (!wali && !pihakI) return "wali-sendiri";
      }
      if (isiKosong) continue;
      return "imam-penghulu";
    }
    return "";
  }

  function itsbat(butir, k) {
    const hasil = {};
    const semua = butir.join("\n");
    const pn = penikahDariPosita(butir);
    if (pn === "wali-sendiri") hasil.penikah = "wali-sendiri";
    const alur = teks(k.alurId);
    if (alur === "16" && Number(k.jumlahPemohon) <= 1 && RE_DUA_PEMOHON.test(semua)) {
      // data pihak di SIPP hanya memuat satu Pemohon padahal permohonan ditulis oleh dua Pemohon: pertanyaannya "berdua"
      hasil.bentuk = "permohonan-berdua";
    } else if (alur === "15" && RE_PASANGAN_MENINGGAL.some((re) => re.test(semua))) {
      hasil.bentuk = "gugatan-pasangan-meninggal";
    }
    const d = dasarItsbat(butir);
    if (d) hasil.dasarItsbat = d;
    return hasil;
  }

  // --------------------------------------------------------------------------
  // Dispensasi kawin
  // --------------------------------------------------------------------------

  /** Umur calon pasangan dari baris identitasnya ("... bin Y, umur 25 tahun, ..." di bawah "laki-laki yang bernama :"). */
  function umurCalon(butir) {
    for (let i = 0; i < butir.length; i++) {
      const b = butir[i];
      if (!/(?:laki-laki|perempuan|pria|wanita)\s+(?:pilihan\s+)?(?:yang\s+)?bernama\s*:?\s*/i.test(b)) continue;
      if (!/(?:melaksanakan|melangsungkan)\s+(?:perkawinan|pernikahan)|menikah/i.test(b)) continue;
      const sisa = b.replace(/^.*?\bbernama\s*:?\s*/i, "");
      const baris = sisa.length > 5 ? sisa : butir[i + 1] || "";
      const m = /(?:umur|usia)\s+(\d{1,2})\s*(?:\([^)]*\)\s*)?tahun/i.exec(baris);
      if (m) return Number(m[1]);
    }
    // baris identitas yang diberi sebutan "Calon Suami/Istri Anak Pemohon" (di baris sendiri atau di akhir baris)
    for (let i = 0; i < butir.length; i++) {
      if (!/Selanjutnya\s+disebut\s+sebagai\s+Calon\s+(?:Suami|Istri|Isteri)/i.test(butir[i])) continue;
      const m = /(?:umur|usia)\s+(\d{1,2})\s*(?:\([^)]*\)\s*)?tahun/i.exec(butir[i]) || (i > 0 ? /(?:umur|usia)\s+(\d{1,2})\s*(?:\([^)]*\)\s*)?tahun/i.exec(butir[i - 1]) : null);
      if (m) return Number(m[1]);
    }
    return null;
  }

  function dispensasi(butir) {
    const hasil = {};
    const semua = butir.join("\n");
    // latar belakang: hamil (tersebut dengan "hamil", bukan "tidak/belum hamil") atau sudah berhubungan badan
    const hamil = /(?<!tidak\s)(?<!belum\s)\bhamil\b/i.test(semua) && !/\b(?:tidak|belum)\s+(?:sedang\s+)?hamil\b/i.test(semua);
    if (hamil) hasil.sebabDK = "hamil";
    else if (/\b(?:berhubungan\s+badan|hubungan\s+badan|hubungan\s+layaknya\s+suami\s+(?:dan\s+)?(?:istri|isteri))\b/i.test(semua)) hasil.sebabDK = "hubungan-badan";
    const umur = umurCalon(butir);
    if (umur !== null && umur >= 10 && umur <= 90) hasil.calonJuga = umur < BATAS_UMUR_NIKAH ? "di-bawah-umur" : "dewasa";
    const sebut = /Calon\s+(Suami|Istri|Isteri)\s+Anak\s+(?:para\s+)?Pemohon/i.exec(semua);
    const anak = /\banak\s+(?:para\s+)?Pemohon\s+(?:yang\s+)?bernama\s+([^.;,]{3,80}?)(?:\s+dengan\b|\s+untuk\b|,|$)/i.exec(semua);
    if (anak && /\bbinti\b/i.test(anak[1])) hasil.jenisKelaminAnak = "perempuan";
    else if (anak && /\bbin\b/i.test(anak[1])) hasil.jenisKelaminAnak = "laki-laki";
    else if (sebut) hasil.jenisKelaminAnak = /suami/i.test(sebut[1]) ? "perempuan" : "laki-laki";
    return hasil;
  }

  // --------------------------------------------------------------------------
  // Cerai (keputusan 116, 2 Nov 2026)
  // --------------------------------------------------------------------------
  //
  //   sebabF        "ekonomi-nafkah" (cerai gugat) bila gugatan mendalilkan Tergugat tidak memberi nafkah - memunculkan butir
  //                 sejak kapan / berapa lama tidak dinafkahi (SEMA 1/2022 Kamar Agama angka 1 huruf b poin 1: minimal 12 bulan)
  //   pengasuhAnak  "pengaju" / "lawan" bila gugatan menyebut anak tinggal bersama / diasuh salah satu pihak (satu arah saja)
  //   penikah       "wali-sendiri" untuk kumulasi itsbat nikah (sama dengan itsbat)
  // Pola nafkah sama dengan pembaca bot (aleta_bot/services/nafkahPosita.js), nafkah anak saja tidak dihitung.
  const RE_TIDAK_NAFKAH =
    /\b(?:tidak|tak|tidak\s+pernah|tidak\s+lagi|sudah\s+tidak|jarang|enggan|lalai|berhenti|menolak)\s+(?:\S+\s+){0,3}?(?:memberi(?:kan)?\s+(?:nafkah|uang\s+belanja|biaya\s+hidup|belanja)|menafkahi|mengirim(?:kan)?\s+(?:nafkah|uang|biaya)|menanggung\s+(?:nafkah|kebutuhan|biaya)|memenuhi\s+(?:nafkah|kebutuhan)|mencukupi\s+kebutuhan|melaksanakan\s+kewajiban(?:nya)?\s+(?:sebagai\s+suami|memberi\s+nafkah))|\btanpa\s+(?:pernah\s+)?(?:memberi(?:kan)?\s+)?nafkah\b|\bnafkah\s+(?:\S+\s+){0,3}?(?:tidak|tak)\s+(?:pernah\s+|lagi\s+)?(?:diberikan|dipenuhi|dikirim|ditunaikan)/i;
  const RE_MASIH_NAFKAH = /\b(?:masih|selalu|tetap|rutin)\s+(?:\S+\s+){0,2}?(?:memberi(?:kan)?|menafkahi|mengirim(?:kan)?)\b/i;
  const RE_HANYA_ANAK = /^\s*(?:lahir\s+(?:dan|maupun)\s+batin\s+)?(?:terhadap|kepada|untuk|bagi)\s+(?:anak|ke\s*\d|kedua\s+anak)/i;
  const RE_ANAK_IKUT = /\banak\b[^.;]{0,100}?\b(?:tinggal\s+(?:bersama|dengan)|ikut(?:\s+(?:bersama|dengan))?|diasuh(?:\s+oleh)?|dirawat(?:\s+oleh)?|dalam\s+(?:asuhan|pengasuhan|pemeliharaan|perawatan))\s+(?:oleh\s+)?(Penggugat|Tergugat|Pemohon|Termohon)\b/gi;

  function tidakDinafkahi(butir) {
    for (const b of butir) {
      const m = RE_TIDAK_NAFKAH.exec(b);
      if (!m) continue;
      if (RE_MASIH_NAFKAH.test(b.slice(Math.max(0, m.index - 40), m.index + m[0].length))) continue;
      if (RE_HANYA_ANAK.test(b.slice(m.index + m[0].length, m.index + m[0].length + 40))) continue;
      return true;
    }
    return false;
  }

  function cerai(butir, kunci) {
    const hasil = {};
    if (kunci === "cerai-gugat" && tidakDinafkahi(butir)) hasil.sebabF = ["ekonomi-nafkah"];
    const arah = new Set();
    for (const b of butir) {
      RE_ANAK_IKUT.lastIndex = 0;
      let m;
      while ((m = RE_ANAK_IKUT.exec(b))) {
        // pengandaian ("khawatir ... jika diasuh oleh Tergugat", "untuk tinggal bersama") bukan keadaan sekarang
        if (/\b(?:jika|apabila|bila|kalau|seandainya|andaikan|untuk|agar|supaya|khawatir|hendak|ingin|mohon)\b/i.test(b.slice(Math.max(0, m.index - 30), m.index + m[0].length))) continue;
        arah.add(/^(?:Penggugat|Pemohon)$/i.test(m[1]) ? "pengaju" : "lawan");
      }
    }
    if (arah.size === 1) hasil.pengasuhAnak = [...arah][0];
    if (penikahDariPosita(butir) === "wali-sendiri") hasil.penikah = "wali-sendiri";
    return hasil;
  }

  /**
   * @param {string} kunciKatalog kunci katalog saksi (itsbat-nikah, dispensasi-kawin, dispensasi-kawin-keterangan, cerai-gugat, cerai-talak)
   * @param {{posita?: string, alurId?: string, jumlahPemohon?: number}} konteks
   * @returns {Object<string,string>} kunci keadaan -> nilai (hanya yang jelas dari posita)
   */
  // Panel memanggil ini tiap gambar ulang; hasil terakhir diingat selama masukannya sama (hitung sekali lalu simpan).
  let ingat = null;

  function turunkan(kunciKatalog, konteks) {
    const k = konteks && typeof konteks === "object" ? konteks : {};
    const kunci = teks(kunciKatalog);
    const alur = teks(k.alurId);
    const jumlah = Number(k.jumlahPemohon) || 0;
    const posita = teks(k.posita);
    if (ingat && ingat.kunci === kunci && ingat.alur === alur && ingat.jumlah === jumlah && ingat.posita === posita) return { ...ingat.hasil };
    let hasil = {};
    const butir = butirDari(posita);
    if (butir.length) {
      switch (kunci) {
        case "itsbat-nikah":
          hasil = itsbat(butir, { alurId: alur, jumlahPemohon: jumlah });
          break;
        case "dispensasi-kawin":
        case "dispensasi-kawin-keterangan":
          hasil = dispensasi(butir);
          break;
        case "cerai-gugat":
        case "cerai-talak":
          hasil = cerai(butir, kunci);
          break;
        default:
          hasil = {};
      }
    }
    ingat = { kunci, alur, jumlah, posita, hasil };
    return { ...hasil };
  }

  const api = { turunkan, dasarItsbat, tahunNikah, butirDari };
  globalThis.AletaBdKeadaanPosita = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
