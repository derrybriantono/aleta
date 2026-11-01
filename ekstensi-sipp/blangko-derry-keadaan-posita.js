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

  function itsbat(butir, k) {
    const hasil = {};
    const semua = butir.join("\n");
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

  /**
   * @param {string} kunciKatalog kunci katalog saksi (itsbat-nikah, dispensasi-kawin, dispensasi-kawin-keterangan)
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
