"use strict";

/**
 * ============================================================================
 * BLANGKO ABT BY DERRY BRIANTONO - TANYA JAWAB SAKSI MENURUT KATALOG JENIS PERKARA (20 Okt 2026)
 * ============================================================================
 *
 * Bagian "Pengetahuan saksi" di Blangko Derry dahulu memakai pilihan perkara CERAI (DAFTAR_MODUS di
 * blangko-derry-saksi.js: "Tahu seluruh alasan, melihat sendiri", "pihak lain ...") untuk SEMUA perkara, juga itsbat
 * nikah. Berkas ini memberi lapisan yang sama dengan "Susun saksi" di panel ABT (saksi-katalog.js, saksi-katalog-data.js,
 * saksi-susun.js): KATALOG jenis perkara. Berkas ini BERDIRI SENDIRI (tanpa DOM, tanpa chrome.*) dan dimuat sesudah
 * saksi-katalog*.js dan sebelum blangko-derry-isian.js; ia menempel pada globalThis.AletaBdKatalog dan (di Node/vitest)
 * module.exports. Semua fungsi murni.
 *
 * ----------------------------------------------------------------------------
 * ATURAN POKOK
 * ----------------------------------------------------------------------------
 *   - Cerai (jenis 346/347, termasuk kumulasi) TIDAK diubah: kenali() menjawab mode "cerai" dan panel lama jalan seperti
 *     biasa. Jenis lain yang punya katalog = mode "katalog". Jenis tanpa katalog = mode "tanpa" (TIDAK pernah dianggap cerai).
 *   - Sebutan pihak ("Saksi 1 Pemohon") menurut NOMOR alur/jenis perkara, bukan menurut kata (sebutanPihak, kembaran
 *     manajemen_surat/src/lib/sebutan-pihak.ts; SIPP menulis "Istbat", bukan "itsbat").
 *   - Keadaan bersumber "borang" di katalog dipilih petugas, KECUALI yang dapat dibaca dari data perkara
 *     (keadaanDariData: kehadiran Tergugat/Termohon, bentuk itsbat, gugatan/permohonan) - itu terisi sendiri dan tetap
 *     dapat diubah.
 *   - Baris yang sudah diketik petugas tidak pernah ditimpa: gabung() mempertahankannya.
 *
 * ----------------------------------------------------------------------------
 * KONTRAK UNTUK PENGISI JAWABAN (agen "isi jawaban dari data")
 * ----------------------------------------------------------------------------
 * susun(masukan) mengembalikan:
 *
 *   {
 *     ada: true,
 *     kunciKatalog, judul,
 *     sebutan: {P, T, surat},
 *     variabelTanya: ["1025", ...],          kode #nnnn# yang dibutuhkan TEKS PERTANYAAN (untuk dibaca dari ABT lebih dulu)
 *     variabelAbt:   ["0600", ...],          semua kode #nnnn# yang disebut pertanyaan atau jawaban dasar, selain sebutan pihak
 *     peringatan: string[],
 *     saksi: [{
 *       kunci: "saksi 1 p", ke: 1, pihak: "P"|"T", nama: "Saksi 1 Pemohon", jenis: "melihat",
 *       keadaan: {...},                      keadaan efektif saksi ini (perkara + per saksi + pihakSaksi)
 *       baris: [{
 *         butir:        "q-in-kenal-pb",     id butir di katalog
 *         kunciJawaban: "itsbat-nikah/q-in-kenal-pb/melihat",   <kunciKatalog>/<butir>/<jenis pengetahuan yang dipakai>
 *         no, tanya, tanyaMentah, jawab,     tanya dan jawab SUDAH diisi penanda; jawab = kalimat dasar katalog ("..." bila
 *                                            data belum ada); jawab "" bila katalog tidak punya jawaban untuk jenis itu
 *         jenis,                             tingkat pengetahuan yang dipakai baris ini
 *         kelompok, tingkat, pokok,
 *         kosong:       ["#0600#", "{hal}"], penanda yang belum terisi pada tanya atau jawab
 *         variabelAbt:  ["0600"],            kode #nnnn# baris ini (tanya mentah + yang belum terisi pada jawab)
 *         tandaKuning, tanpaJawaban
 *       }]
 *     }]
 *   }
 *
 * Pengisi jawaban boleh mengganti `jawab` suatu baris dengan kalimat yang diturunkan dari data; kunci pencarinya
 * `kunciJawaban` (atau `butir` + `jenis`). Tiap jawaban yang diusulkan membawa {teks, yakin: "yakin"|"cukup"|"ragu", sumber}
 * (kontrak bersama); baris panel membawa `asal` = "data"|"ragu"|"kosong"|"manual" yang dihitung tampilan.
 *
 * TITIK PASANG pengisi jawaban (dipanggil blangko-derry-isian.js tiap kali susunan katalog dibuat; opsional):
 *   globalThis.AletaBdJawabanKatalog.usulkan({ perkara, kenal, keadaan, saksi, variabel }) -> Promise<{ [kunciJawaban]: {teks, yakin, sumber} }>
 *     perkara = {jenisPerkara, jenisPerkaraId, alurPerkaraId, nomorPerkara}; saksi = susun().saksi; variabel = nilai #nnnn# yang terbaca.
 *   Hasilnya dipasang oleh terapkanUsulan(): hanya pada baris yang belum diketik petugas; baris membawa `yakin` dan `sumberJawab`.
 *
 * Bentuk lain:
 *   terapkanUsulan(rows, usulan)         -> {rows, terisi, tertahan}
 *   kenali(perkara)                     -> {mode, kat, kunci, judul, jenisId, alurId, sebutan}
 *   keadaanDariData(kat, konteks)        -> {keadaan, dariData: [kunci...]}
 *   bidangKeadaan(kat, keadaan, sebutan, dariData) -> [{kunci,label,jamak,perSaksi,dariData,nilai:[{nilai,label}],terpilih}]
 *   pilihanPengetahuan(kat, keadaanSaksi, pihak, tingkat) -> [{nilai,label}]   (tingkat pengetahuan yang ADA di katalog)
 *   gabung(lama, baru, opsi)             -> {rows, dipertahankan, diganti, baru, dibuang}
 *   panelHtml(masukan)                   -> string HTML panel "Pengetahuan saksi" mode katalog
 */
(function (akar, pabrik) {
  const api = pabrik();
  if (typeof module === "object" && module && module.exports) module.exports = api;
  if (akar) akar.AletaBdKatalog = api;
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : null, function () {
  const Mesin = () => (typeof globalThis !== "undefined" ? globalThis.AletaSaksiKatalog : null) || null;
  const DataKatalog = () => (typeof globalThis !== "undefined" && Array.isArray(globalThis.ALETA_SAKSI_KATALOG_DATA) ? globalThis.ALETA_SAKSI_KATALOG_DATA : []);

  const teks = (x) => String(x === undefined || x === null ? "" : x);
  const daftar = (x) => (Array.isArray(x) ? x : []);
  const laRaya = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
  const rapat = (t) => teks(t).replace(/\s+/g, " ").trim();
  const norm = (t) =>
    teks(t)
      .toLowerCase()
      .replace(/#\d{4,5}#/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const esc = (t) => teks(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // ──────────────────────────────────────────────────────────────────────────
  // Jenis dan alur perkara, sebutan pihak
  // ──────────────────────────────────────────────────────────────────────────

  /** Nama jenis perkara SIPP -> jenis_perkara_id (cermin ID_JENIS_PERKARA_SIPP di abt.js; ejaan SIPP: "Istbat", "Adhol"). */
  const ID_JENIS = Object.freeze({
    "izin poligami": "341",
    "pencegahan perkawinan": "342",
    "penolakan perkawinan": "343",
    "pembatalan perkawinan": "344",
    "cerai talak": "346",
    "cerai gugat": "347",
    "harta bersama": "348",
    "penguasaan anak": "349",
    "pengesahan anak": "352",
    "kelalaian atas kewajiban suami / istri": "345",
    "hak - hak bekas istri/kewajiban bekas suami": "351",
    "perkawinan campuran": "359",
    "izin kawin": "361",
    perwalian: "354",
    "asal usul anak": "358",
    "istbat nikah": "360",
    "itsbat nikah": "360",
    "isbat nikah": "360",
    "pengesahan perkawinan/istbat nikah": "360",
    "dispensasi kawin": "362",
    "wali adhol": "363",
    "wali adhal": "363",
    kewarisan: "364",
    wasiat: "365",
    hibah: "366",
    wakaf: "367",
    "lain-lain": "369",
    "lain-lain *)": "369",
    "ekonomi syariah": "370",
    "p3hp/penetapan ahli waris": "371",
    "nafkah anak pasca perceraian": "743",
  });
  const JENIS_CERAI = Object.freeze(["346", "347"]);

  const NAMA_PERKARA = (p) => teks(p && (p.jenisPerkara || p.nama || p.jenisPerkaraNama));

  /** jenis_perkara_id: dari perkara bila ada, selain itu dari nama jenis. "" bila tidak dikenal. */
  function idJenis(perkara) {
    const p = perkara || {};
    const langsung = teks(p.jenisPerkaraId).trim();
    if (/^\d+$/.test(langsung)) return langsung;
    const nama = rapat(NAMA_PERKARA(p)).toLowerCase();
    if (!nama) return "";
    if (/^\d+$/.test(nama)) return nama;
    if (ID_JENIS[nama]) return ID_JENIS[nama];
    const luar = typeof globalThis !== "undefined" && typeof globalThis.idJenisPerkaraSipp === "function" ? teks(globalThis.idJenisPerkaraSipp(NAMA_PERKARA(p))) : "";
    return /^\d+$/.test(luar) ? luar : "";
  }

  /** alur_perkara_id: dari perkara bila ada, selain itu dari nomor perkara (15 gugatan, 16 permohonan, 17 gugatan sederhana). */
  function idAlur(perkara) {
    const p = perkara || {};
    const langsung = Number(p.alurPerkaraId);
    if (Number.isFinite(langsung) && langsung > 0) return String(langsung);
    const nomor = teks(p.nomorPerkara);
    if (/Pdt\.G\.S\b/i.test(nomor)) return "17";
    if (/Pdt\.G\b/i.test(nomor)) return "15";
    if (/Pdt\.P\b/i.test(nomor)) return "16";
    return "";
  }

  const POLA_PERMOHONAN =
    /permohonan|cerai\s*talak|istbat|itsbat|isbat|pengesahan\s*perkawinan|dispensasi|wali\s*adh[oa]l|poligami|asal.?usul|perwalian|pengangkatan|penetapan\s*ahli\s*waris|p3hp|pencegahan\s*perkawinan|penolakan\s*perkawinan|pengesahan\s*anak|izin\s*kawin|perkawinan\s*campuran/i;

  const POLA_PERLAWANAN = /perlawanan|verzet|derden/i;
  const POLA_BANTAHAN = /bantahan/i;

  /**
   * Sebutan para pihak, berjenjang dan memakai NOMOR sebelum kata (kembaran sebutan-pihak.ts):
   *   alur 122/123 -> Penuntut Umum/Terdakwa; alur 16, atau jenis 346/341 -> Pemohon/Termohon (meski bernomor /Pdt.G/);
   *   alur lain yang tercatat -> Penggugat/Tergugat; tanpa alur: nama jenis, lalu nomor perkara.
   * @returns {{P: string, T: string, surat: string, sumber: string}}
   */
  function sebutanPihak(perkara) {
    const p = perkara || {};
    const alur = Number(idAlur({ alurPerkaraId: p.alurPerkaraId })) || 0;
    const jenis = Number(teks(p.jenisPerkaraId).trim() || idJenis(p)) || 0;
    const permohonan = (sumber) => ({ P: "Pemohon", T: "Termohon", surat: "permohonan", sumber });
    const gugatan = (sumber) => ({ P: "Penggugat", T: "Tergugat", surat: "gugatan", sumber });
    if (alur === 122 || alur === 123) return { P: "Penuntut Umum", T: "Terdakwa", surat: "dakwaan", sumber: "alur" };
    if (alur === 16) return permohonan("alur");
    if (jenis === 346 || jenis === 341) return permohonan("jenis");
    // Perlawanan dan bantahan (D5): sebutannya sendiri, sebelum aturan alur gugatan (SIPP memberi keduanya alur gugatan).
    {
      const namaLawan = rapat(NAMA_PERKARA(p));
      const nomorLawan = rapat(p.nomorPerkara);
      if (namaLawan && POLA_PERLAWANAN.test(namaLawan)) return { P: "Pelawan", T: "Terlawan", surat: "perlawanan", sumber: "kata" };
      if (/\/Pdt\.Plw\b/i.test(nomorLawan)) return { P: "Pelawan", T: "Terlawan", surat: "perlawanan", sumber: "nomor" };
      if (namaLawan && POLA_BANTAHAN.test(namaLawan)) return { P: "Pembantah", T: "Terbantah", surat: "bantahan", sumber: "kata" };
      if (/\/Pdt\.Bth\b/i.test(nomorLawan)) return { P: "Pembantah", T: "Terbantah", surat: "bantahan", sumber: "nomor" };
    }
    if (alur) return gugatan("alur");
    const nama = rapat(NAMA_PERKARA(p));
    if (nama) return POLA_PERMOHONAN.test(nama) ? permohonan("kata") : gugatan("kata");
    const nomor = rapat(p.nomorPerkara);
    if (/\/Pdt\.P\//i.test(nomor)) return permohonan("nomor");
    if (/\/Pdt\.G\//i.test(nomor)) return gugatan("nomor");
    return gugatan("bawaan");
  }

  /** "saksi 1 p" -> "Saksi 1 Pemohon" (menurut sebutan yang diberikan); kunci lain -> "". */
  function namaSaksi(kunci, sebutan) {
    const m = teks(kunci).match(/^saksi\s+(\d+)\s+([pt])$/i);
    if (!m) return "";
    const sb = sebutan && sebutan.P ? sebutan : { P: "Penggugat", T: "Tergugat" };
    return `Saksi ${m[1]} ${m[2].toLowerCase() === "t" ? sb.T : sb.P}`;
  }

  /** Pihak yang mengajukan saksi menurut kunci: "saksi 2 t" -> "T"; selain itu "P". */
  const pihakDariKunci = (kunci) => (/\s+t$/i.test(teks(kunci).trim()) ? "T" : "P");

  // ──────────────────────────────────────────────────────────────────────────
  // Mode panel menurut jenis perkara
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Menentukan perilaku panel "Pengetahuan saksi" untuk perkara ini.
   *   mode "cerai"   : jenis 346/347 (juga bila jenis belum terbaca sama sekali) - panel LAMA, tidak diubah;
   *   mode "katalog" : jenis lain yang punya katalog - panel katalog;
   *   mode "tanpa"   : jenis dikenal tetapi tidak punya katalog - TIDAK dianggap cerai.
   * @param {{jenisPerkara?: string, jenisPerkaraId?: string|number, alurPerkaraId?: string|number, nomorPerkara?: string}} perkara
   */
  function kenali(perkara) {
    const m = Mesin();
    const p = perkara || {};
    const jenisId = idJenis(p);
    const alurId = idAlur(p);
    const nama = NAMA_PERKARA(p);
    const sebutan = sebutanPihak(Object.assign({}, p, { jenisPerkaraId: jenisId, alurPerkaraId: alurId }));
    const dasar = { mode: "tanpa", kat: null, kunci: "", judul: "", jenisId, alurId, sebutan };
    if (!m) return Object.assign(dasar, { mode: "cerai", sebab: "mesin-katalog-tidak-ada" });
    if (!jenisId && !rapat(nama)) return Object.assign(dasar, { mode: "cerai", sebab: "jenis-belum-terbaca" });
    const kat = jenisId ? m.kenaliPaket(DataKatalog(), { jenisPerkaraId: jenisId, alurPerkaraId: alurId, nama }) : null;
    if (JENIS_CERAI.includes(jenisId) || (!jenisId && /cerai/i.test(nama))) return Object.assign(dasar, { mode: "cerai", kat, kunci: kat ? kat.kunci : "", judul: kat ? kat.judul : "" });
    if (!kat) return Object.assign(dasar, { sebab: "katalog-tidak-ada" });
    return Object.assign(dasar, { mode: "katalog", kat, kunci: kat.kunci, judul: kat.judul });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Keadaan perkara: dari data, relevansi, label
  // ──────────────────────────────────────────────────────────────────────────

  /** Kehadiran Tergugat/Termohon dari nama blangko atau judul ("P Hadir & T Tidak Hadir" -> verstek). */
  function kehadiranDariTeks(t) {
    const x = teks(t);
    if (/T\s+Tidak\s+Hadir\s+Setelah\s+Mediasi/i.test(x) || /Hadir\s+(?:sampai|hingga)\s+Mediasi/i.test(x)) return "t-tidak-hadir-setelah-mediasi";
    if (/verstek/i.test(x)) return "verstek";
    if (/P\s*(?:&|dan)\s*T\s+Hadir/i.test(x)) return "kontradiktoir";
    if (/T\s+Tidak\s+Hadir/i.test(x)) return "verstek";
    return "";
  }

  /**
   * Keadaan yang dapat dibaca dari data perkara. Hanya kunci yang dipakai katalog ini.
   * @param {object} kat
   * @param {{alurId?: string, jumlahPemohon?: number, teksBlangko?: string, hadir?: number|null}} konteks
   *        hadir = kode kehadiran sidang SIPP (1 semua pihak, 2 pihak pertama saja, 3 pihak kedua saja, 4 tidak ada)
   * @returns {{keadaan: object, dariData: string[]}}
   */
  function keadaanDariData(kat, konteks) {
    const m = Mesin();
    const k = konteks || {};
    const keadaan = {};
    if (!m || !kat) return { keadaan, dariData: [] };
    const dek = laRaya(kat.keadaan) ? kat.keadaan : {};
    const dipakai = new Set(m.keadaanUntukBorang(kat).map((x) => x.kunci));
    const sah = (kunci, nilai) => !laRaya(dek[kunci]) || daftar(dek[kunci].nilai).map(String).includes(String(nilai));
    if (dipakai.has("kehadiran")) {
      let h = kehadiranDariTeks(k.teksBlangko);
      if (!h && Number(k.hadir) === 1) h = "kontradiktoir";
      if (!h && Number(k.hadir) === 2) h = "verstek";
      if (h && sah("kehadiran", h)) keadaan.kehadiran = h;
    }
    const alur = teks(k.alurId);
    if (dipakai.has("bentuk") && alur) {
      let b = "";
      if (alur === "16") b = Number(k.jumlahPemohon) >= 2 ? "permohonan-berdua" : Number(k.jumlahPemohon) === 1 ? "permohonan-sendiri" : "";
      else if (alur === "15") b = "gugatan";
      if (b && sah("bentuk", b)) keadaan.bentuk = b;
    }
    if (dipakai.has("perkara") && alur) {
      const b = alur === "16" ? "permohonan" : alur === "15" || alur === "17" ? "gugatan" : "";
      if (b && sah("perkara", b)) keadaan.perkara = b;
    }
    // U2 (1 Nov 2026): bentuk itsbat, dasar itsbat (Pasal 7 ayat 3 KHI), dan tiga pilihan dispensasi kawin dari posita yang sudah dibaca
    const KP = typeof globalThis !== "undefined" ? globalThis.AletaBdKeadaanPosita : null;
    if (KP && teks(k.posita).trim()) {
      let turun = {};
      try {
        turun = KP.turunkan(kat.kunci, { posita: k.posita, alurId: alur, jumlahPemohon: k.jumlahPemohon }) || {};
      } catch {
        turun = {};
      }
      for (const kunci of Object.keys(turun)) if (dipakai.has(kunci) && sah(kunci, turun[kunci])) keadaan[kunci] = turun[kunci];
    }
    return { keadaan, dariData: Object.keys(keadaan) };
  }

  /** Keadaan yang berbeda untuk tiap saksi (bukan satu untuk seluruh perkara). */
  const KEADAAN_PER_SAKSI = Object.freeze(["kedudukanSaksi"]);

  /** Tulisan khusus nilai keadaan (bahasa petugas). Yang tidak ada di sini jatuh ke tulisan umum. */
  const LABEL_KHUSUS = Object.freeze({
    bentuk: {
      "permohonan-berdua": "Permohonan oleh dua pemohon (suami dan istri)",
      "permohonan-sendiri": "Permohonan oleh satu pemohon",
      gugatan: "Gugatan (ada Tergugat)",
      "gugatan-pasangan-meninggal": "Gugatan, pasangannya sudah meninggal",
    },
    kedudukanSaksi: {
      "hadir-biasa": "Hadir di acara pernikahan (bukan wali atau saksi nikah)",
      "wali-nikah": "Wali nikah",
      "saksi-nikah": "Saksi nikah (saat ijab kabul)",
      penghulu: "Penghulu atau yang menikahkan",
    },
    pemohon: { "suami-istri": "Suami dan istri", "ibu-saja": "Ibu saja" },
    perkawinan: { "dicatat-sebelum-lahir": "Dicatat sebelum anak lahir", "sirri-dicatat-kemudian": "Siri, dicatat kemudian", "sirri-belum-dicatat": "Siri, belum dicatat" },
    waktuLahir: { "sesudah-enam-bulan": "Anak lahir sesudah 6 bulan dari akad nikah", "kurang-enam-bulan": "Anak lahir kurang dari 6 bulan dari akad nikah" },
    statusPemohon: { gadis: "Gadis", "janda-cerai": "Janda cerai", "janda-mati": "Janda ditinggal mati" },
    hubunganWali: { "ayah-kandung": "Ayah kandung", kakek: "Kakek", "saudara-kandung": "Saudara kandung", paman: "Paman", lainnya: "Lainnya" },
    waliHadir: { hadir: "Wali hadir di persidangan", "tidak-hadir": "Wali tidak hadir" },
    statusPewaris: { menikah: "Pewaris meninggalkan pasangan", "tidak-menikah": "Pewaris tidak meninggalkan pasangan" },
    orangTua: { "masih-hidup": "Masih hidup", "meninggal-lebih-dahulu": "Meninggal lebih dahulu dari pewaris" },
    calonMempelai: { hadir: "Hadir di persidangan", "tidak-hadir": "Tidak hadir" },
    pekerjaanSuami: { "asn-tni-polri": "ASN, TNI atau Polri", lainnya: "Pekerjaan lain" },
    sikapIstri: { setuju: "Istri setuju", keberatan: "Istri keberatan", "tidak-mungkin": "Istri tidak mungkin dimintai persetujuan" },
  });

  /** Tulisan satu nilai keadaan: tulisan katalog, tulisan khusus, tulisan baku, lalu bentuk umum. */
  function labelNilai(kat, kunci, nilai, sebutan) {
    const m = Mesin();
    const n = teks(nilai);
    const dek = kat && laRaya(kat.keadaan) && laRaya(kat.keadaan[kunci]) ? kat.keadaan[kunci] : null;
    if (dek && laRaya(dek.labelNilai) && dek.labelNilai[n]) return teks(dek.labelNilai[n]);
    if (LABEL_KHUSUS[kunci] && LABEL_KHUSUS[kunci][n]) return LABEL_KHUSUS[kunci][n];
    const sb = sebutan && sebutan.P ? sebutan : { P: "Penggugat", T: "Tergugat" };
    if (n === "pengaju") return sb.P;
    if (n === "lawan") return sb.T;
    if (m && m.LABEL_NILAI_BAKU && m.LABEL_NILAI_BAKU[n]) return m.LABEL_NILAI_BAKU[n];
    const umum = { keduanya: "Keduanya", bersama: "Bersama", "pihak-ketiga": "Pihak ketiga", ya: "Ya", tidak: "Tidak", ada: "Ada", "tidak-ada": "Tidak ada" };
    if (umum[n]) return umum[n];
    if (n.length === 1) return n;
    const h = n.replace(/-/g, " ");
    return h.charAt(0).toUpperCase() + h.slice(1);
  }

  /** Syarat keadaan di katalog yang memuat kunci ini (pada butir, jawaban, atau pokok). */
  function syaratMemuat(kat, kunci) {
    const m = Mesin();
    const hasil = [];
    const ambil = (sy) => {
      if (laRaya(sy) && (kunci in sy || `bukan:${kunci}` in sy)) hasil.push(sy);
    };
    for (const q of daftar(kat && kat.pertanyaan)) {
      ambil(q.keadaan);
      for (const j of Object.keys(laRaya(q.jawaban) ? q.jawaban : {})) for (const x of [].concat(q.jawaban[j])) ambil(x && x.keadaan);
    }
    for (const p of daftar(kat && kat.pokokPembuktian)) ambil(p.keadaan);
    void m;
    return hasil;
  }

  /** Isian keadaan hanya digambar bila ada butir yang memakainya dan syarat LAIN-nya terpenuhi. */
  function keadaanRelevan(kat, kunci, keadaan) {
    const m = Mesin();
    const pakai = syaratMemuat(kat, kunci);
    if (!pakai.length) return true;
    return pakai.some((sy) => {
      const sisa = Object.assign({}, sy);
      delete sisa[kunci];
      delete sisa[`bukan:${kunci}`];
      return m.cocokKeadaan(sisa, keadaan);
    });
  }

  /**
   * Isian keadaan untuk digambar di panel.
   * @param {object} kat
   * @param {object} keadaan  keadaan perkara saat ini (sudah termasuk bawaan, data, pilihan petugas)
   * @param {{P:string,T:string}} sebutan
   * @param {string[]} dariData kunci yang terisi dari data perkara
   */
  function bidangKeadaan(kat, keadaan, sebutan, dariData) {
    const m = Mesin();
    if (!m || !kat) return [];
    const ada = laRaya(keadaan) ? keadaan : {};
    const sah = new Set(daftar(dariData));
    const hasil = [];
    for (const f of m.keadaanUntukBorang(kat)) {
      if (f.tanpaPengaruh) continue; // 1 Nov 2026: tidak disebut satu syarat pun - pilihan tanpa akibat tidak digambar
      if (!keadaanRelevan(kat, f.kunci, ada)) continue;
      if (!f.nilai.length) continue;
      const sekarang = ada[f.kunci];
      const terpilih = f.jamak ? [].concat(sekarang === undefined ? [] : sekarang).map(String) : [sekarang === undefined ? teks(f.bawaan !== undefined ? [].concat(f.bawaan)[0] : f.nilai[0]) : teks([].concat(sekarang)[0])];
      hasil.push({
        kunci: f.kunci,
        label: f.label,
        jamak: f.jamak,
        perSaksi: KEADAAN_PER_SAKSI.includes(f.kunci),
        dariData: sah.has(f.kunci),
        nilai: f.nilai.map((n) => ({ nilai: n, label: labelNilai(kat, f.kunci, n, sebutan) })),
        terpilih,
      });
    }
    return hasil;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Tingkat pengetahuan yang ada di katalog
  // ──────────────────────────────────────────────────────────────────────────

  /** Urutan tampil pilihan pengetahuan (bahasa petugas dari LABEL_JENIS_KETERANGAN di mesin). */
  const URUTAN_JENIS = Object.freeze(["melihat", "mendengar", "de-auditu", "sebagian", "tidak-tahu", "ragu"]);

  /**
   * Tingkat pengetahuan saksi yang BENAR-BENAR ada jawabannya di katalog untuk keadaan ini (paling sedikit satu butir aktif
   * punya jawaban untuk tingkat itu). "melihat" selalu ada.
   * @returns {Array<{nilai: string, label: string, butir: number}>}
   */
  function pilihanPengetahuan(kat, keadaanSaksi, pihak, tingkat) {
    const m = Mesin();
    if (!m || !kat) return [{ nilai: "melihat", label: "Melihat sendiri", butir: 0 }];
    const butir = m.pertanyaanAktif(kat, keadaanSaksi, pihak, { tingkat });
    return URUTAN_JENIS.map((j) => {
      let n = 0;
      for (const q of butir) {
        if (!m.jenisKeteranganButir(q).includes(j)) continue;
        if (m.pilihObjekJawaban(kat, q, j, keadaanSaksi)) n += 1;
      }
      return { nilai: j, label: m.LABEL_JENIS_KETERANGAN[j] || j, butir: n };
    }).filter((x) => x.nilai === "melihat" || x.butir > 0);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Menyusun pertanyaan dan jawaban dasar
  // ──────────────────────────────────────────────────────────────────────────

  const kodeDi = (t) => Array.from(new Set(Array.from(teks(t).matchAll(/#(\d{4,5})#/g)).map((x) => x[1])));
  const TINGKAT_BAWAAN = Object.freeze(["inti", "pilihan", "tambahan"]);
  const TINGKAT_JARANG = Object.freeze(["inti", "pilihan", "tambahan", "jarang"]);

  /**
   * Menyusun tanya jawab seluruh saksi blangko dari katalog (satu panggilan, supaya dua saksi tidak berbunyi sama).
   *
   * @param {{
   *   kat: object,                          katalog (kenali().kat)
   *   sebutan: {P: string, T: string},
   *   benih?: string,                       mis. nomor perkara (pemilih varian deterministik)
   *   keadaan?: object,                     keadaan perkara (bawaan + data + pilihan petugas)
   *   saksi: Array<{kunci: string, pihak?: "P"|"T", jenis?: string, sumber?: string, keadaan?: object, perButir?: object, berbeda?: string[]}>,
   *   variabel?: (kode: string) => string|undefined,   nilai variabel ABT; #0046# dan #0047# diisi dari sebutan
   *   jarang?: boolean                      sertakan pertanyaan yang jarang diajukan
   * }} masukan
   */
  /** Jenis pengetahuan yang sah: tingkat katalog, atau "profil:<kunci>" yang ada di katalog.profilSaksi (saksi cerai); selain itu "melihat". */
  function jenisSah(kat, jenis) {
    if (URUTAN_JENIS.includes(jenis)) return jenis;
    const kode = teks(jenis).startsWith("profil:") ? teks(jenis).slice(7) : "";
    return kode && laRaya(kat && kat.profilSaksi) && laRaya(kat.profilSaksi[kode]) ? jenis : "melihat";
  }
  /** Pengetahuan ini memakai slot "cerita dari siapa" (de-auditu, atau profil yang bersumber)? */
  function perluSumber(kat, jenis) {
    if (jenis === "de-auditu") return true;
    const kode = teks(jenis).startsWith("profil:") ? teks(jenis).slice(7) : "";
    return Boolean(kode && laRaya(kat && kat.profilSaksi) && laRaya(kat.profilSaksi[kode]) && kat.profilSaksi[kode].sumber === true);
  }
  function susun(masukan) {
    const m = Mesin();
    const o = masukan || {};
    const kat = o.kat;
    if (!m || !kat) return { ada: false, saksi: [], peringatan: ["Katalog jenis perkara tidak ditemukan."], variabelTanya: [], variabelAbt: [] };
    const sebutan = o.sebutan && o.sebutan.P ? o.sebutan : { P: "Penggugat", T: "Tergugat" };
    const tingkat = o.jarang ? TINGKAT_JARANG : TINGKAT_BAWAAN;
    const benih = teks(o.benih);
    const variabel = (kode) => {
      if (kode === "0046") return sebutan.P;
      if (kode === "0047") return sebutan.T;
      const v = typeof o.variabel === "function" ? o.variabel(kode) : "";
      return v === undefined || v === null ? "" : teks(v);
    };
    const saksiMasuk = daftar(o.saksi).map((s) => {
      const pihak = s.pihak === "T" || s.pihak === "P" ? s.pihak : pihakDariKunci(s.kunci);
      return Object.assign({}, s, { pihak: sebutan.P === "Penuntut Umum" ? pihak : pihak });
    });
    const masukSaksi = saksiMasuk.map((s) => ({
      pihak: s.pihak,
      jenis: jenisSah(kat, s.jenis),
      perButir: laRaya(s.perButir) ? s.perButir : undefined,
      berbeda: Array.isArray(s.berbeda) ? s.berbeda : undefined,
      keadaan: laRaya(s.keadaan) ? s.keadaan : undefined,
    }));
    const slotSaksi = saksiMasuk.map((s) => (perluSumber(kat, s.jenis) && rapat(s.sumber) ? { sumber: rapat(s.sumber) } : {}));
    const hasil = m.susunSaksi(kat, { keadaan: laRaya(o.keadaan) ? o.keadaan : {}, benih, saksi: masukSaksi, variabel, slotSaksi, tingkat });

    const jumlah = saksiMasuk.length;
    const semuaTanya = new Set();
    const semuaAbt = new Set();
    const saksi = saksiMasuk.map((s, indeks) => {
      const ke = indeks + 1;
      const dariMesin = hasil.saksi[indeks] ? hasil.saksi[indeks].baris : [];
      const peta = new Map(dariMesin.map((b) => [b.butir, b]));
      const keadaan = Object.assign({}, m.keadaanBawaan(kat, laRaya(o.keadaan) ? o.keadaan : {}), { jumlahSaksi: String(Math.min(5, Math.max(2, jumlah || 2))) }, laRaya(s.keadaan) ? s.keadaan : {}, { pihakSaksi: s.pihak });
      const butir = m.pertanyaanAktif(kat, keadaan, s.pihak, { tingkat });
      const baris = [];
      butir.forEach((q) => {
        // T2 (25 Okt, keputusan pengguna): butir penutup tidak ditampilkan dan tidak disimpan untuk semua jenis perkara
        if (q.kelompok === "penutup") return;
        const asal = peta.get(q.id);
        const mentah = m.pilihTeksPertanyaan(q, ke, benih);
        const kodeTanya = kodeDi(mentah);
        kodeTanya.forEach((k) => {
          if (k !== "0046" && k !== "0047") semuaTanya.add(k);
        });
        let tanya;
        let jawab = "";
        let kosong = [];
        let jenis = URUTAN_JENIS.includes(s.jenis) ? s.jenis : "melihat";
        if (!m.jenisKeteranganButir(q).includes(jenis)) jenis = "melihat";
        let tandaKuning = false;
        let tanpaJawaban = false;
        if (asal) {
          tanya = asal.tanya;
          jawab = asal.jawab;
          kosong = asal.kosong || [];
          jenis = asal.jenis;
          tandaKuning = Boolean(asal.tandaKuning);
        } else {
          const t = m.isiPenanda(mentah, { variabel, slot: { hal: q.hal } });
          tanya = m.amankanKeAbt(t.teks);
          kosong = t.kosong.slice();
          tanpaJawaban = true;
        }
        const kodeKosong = kosong.map((x) => (/^#\d{4,5}#$/.test(x) ? x.slice(1, -1) : "")).filter(Boolean);
        const variabelAbt = Array.from(new Set([...kodeTanya, ...kodeKosong])).filter((k) => k !== "0046" && k !== "0047");
        variabelAbt.forEach((k) => semuaAbt.add(k));
        baris.push({
          butir: q.id,
          kunciJawaban: `${kat.kunci}/${q.id}/${jenis}`,
          no: baris.length + 1,
          tanya,
          tanyaMentah: mentah,
          jawab,
          jawabKode: asal ? teks(asal.jawabKode || "") : "",
          jenis,
          kelompok: q.kelompok,
          tingkat: q.tingkat,
          pokok: q.pokok,
          kosong,
          variabelAbt,
          tandaKuning,
          tanpaJawaban,
        });
      });
      return {
        kunci: teks(s.kunci),
        ke,
        pihak: s.pihak,
        nama: namaSaksi(s.kunci, sebutan) || `Saksi ${ke}`,
        jenis: masukSaksi[indeks].jenis,
        keadaan,
        baris,
      };
    });
    return {
      ada: true,
      kunciKatalog: kat.kunci,
      judul: kat.judul,
      sebutan,
      variabelTanya: Array.from(semuaTanya),
      variabelAbt: Array.from(semuaAbt),
      peringatan: hasil.peringatan.slice(),
      saksi,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Menggabungkan susunan baru dengan baris yang sudah ada (ketikan petugas bertahan)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Keadaan yang tampil di panel selalu sama dengan yang dipakai penyusun: isian tunggal yang belum dipilih/terbaca
   * diberi nilai pertama yang ditampilkan (isian jamak yang belum dipilih tetap kosong).
   */
  function lengkapiBawaan(kat, keadaan) {
    const m = Mesin();
    const hasil = Object.assign({}, laRaya(keadaan) ? keadaan : {});
    if (!m || !kat) return hasil;
    for (const f of m.keadaanUntukBorang(kat)) {
      if (hasil[f.kunci] !== undefined || f.jamak || !f.nilai.length) continue;
      hasil[f.kunci] = f.nilai[0];
    }
    return hasil;
  }

  /** Tingkat pertanyaan yang ikut disusun; `jarang` menambahkan yang jarang diajukan. */
  const tingkatDipakai = (jarang) => (jarang ? TINGKAT_JARANG : TINGKAT_BAWAAN).slice();

  /** Pilihan "cerita dari siapa" untuk saksi yang pengetahuannya dari cerita orang lain. */
  function pilihanSumberCerita() {
    const m = Mesin();
    const daftarSumber = m && Array.isArray(m.SUMBER_CERITA) ? m.SUMBER_CERITA : ["anak saya", "keluarga", "tetangga", "guru"];
    return daftarSumber.map((x) => ({ nilai: x, label: x.charAt(0).toUpperCase() + x.slice(1) }));
  }

  /** Jawaban hanya titik-titik/garis/kosong: belum ada isi yang berarti. */
  const jawabKosong = (j) => !/[A-Za-z0-9]/.test(teks(j));

  /** Jawaban DIKETIK PETUGAS (atau tersimpan di ABT): ada isi, dan bukan kalimat dasar katalog atau hasil susunan otomatis. */
  function diketikPetugas(r) {
    const j = teks(r && r.jawab);
    if (jawabKosong(j)) return false;
    if (r.dasar !== undefined && j === r.dasar) return false;
    if (r.otomatis !== undefined && j === r.otomatis) return false;
    return true;
  }

  const SAMA_MIRIP = 0.72;

  /**
   * Menggabungkan baris yang sudah ada (`lama`) dengan susunan katalog (`baru`, baris satu saksi dari susun()).
   *   - baris lama yang cocok dengan sebuah butir (butir yang sama, atau bunyi pertanyaan sama/mirip) dan jawabannya DIKETIK
   *     petugas dipertahankan apa adanya (diberi penanda butirnya);
   *   - baris lama yang cocok tetapi jawabannya belum diketik diganti susunan baru;
   *   - baris lama yang tidak cocok dengan butir mana pun (baris tambahan petugas) dipertahankan di tempatnya, kecuali
   *     `gantiDaftar` dan barisnya belum diketik (kosong/titik-titik): itu dibuang karena daftarnya diganti katalog;
   *   - butir katalog yang belum ada ditambahkan menurut urutan katalog.
   * @param {Array} lama
   * @param {Array} baru  baris dari susun().saksi[i].baris
   * @param {{gantiDaftar?: boolean}} [opsi]
   * @returns {{rows: Array, dipertahankan: number, diganti: number, baru: number, dibuang: number}}
   */
  function gabung(lama, baru, opsi) {
    const m = Mesin();
    const o = opsi || {};
    const L = daftar(lama).map((r) => Object.assign({}, r));
    const B = daftar(baru);
    const cocokIdx = new Map(); // indeks lama -> indeks baru
    const dipakaiB = new Set();
    // 1. butir yang sama
    L.forEach((r, i) => {
      if (!r.butir) return;
      const j = B.findIndex((b, jj) => b.butir === r.butir && !dipakaiB.has(jj));
      if (j >= 0) {
        cocokIdx.set(i, j);
        dipakaiB.add(j);
      }
    });
    // 2. bunyi pertanyaan sama persis (sesudah dinormalkan)
    L.forEach((r, i) => {
      if (cocokIdx.has(i) || r.butir) return;
      const n = norm(r.tanya);
      if (!n) return;
      const j = B.findIndex((b, jj) => !dipakaiB.has(jj) && norm(b.tanya) === n);
      if (j >= 0) {
        cocokIdx.set(i, j);
        dipakaiB.add(j);
      }
    });
    // 3. bunyi pertanyaan mirip (baris ketikan petugas yang bunyinya sedikit berbeda)
    L.forEach((r, i) => {
      if (cocokIdx.has(i) || r.butir || !m || !norm(r.tanya)) return;
      let terbaik = -1;
      let skor = SAMA_MIRIP;
      B.forEach((b, jj) => {
        if (dipakaiB.has(jj)) return;
        const s = m.jaccard(r.tanya, b.tanya);
        if (s >= skor) {
          skor = s;
          terbaik = jj;
        }
      });
      if (terbaik >= 0) {
        cocokIdx.set(i, terbaik);
        dipakaiB.add(terbaik);
      }
    });

    const barisBaru = (b) => ({ tanya: b.tanya, jawab: b.jawab, dasar: b.jawab, butir: b.butir, jenisKat: b.jenis, kunciJawaban: b.kunciJawaban });
    const hasil = new Array(B.length).fill(null);
    let dipertahankan = 0;
    let diganti = 0;
    let baruN = 0;
    B.forEach((b, j) => {
      const i = Array.from(cocokIdx.entries()).find(([, jj]) => jj === j);
      if (!i) {
        hasil[j] = barisBaru(b);
        baruN += 1;
        return;
      }
      const lamaRow = L[i[0]];
      if (diketikPetugas(lamaRow)) {
        hasil[j] = Object.assign({}, lamaRow, { butir: b.butir, jenisKat: lamaRow.jenisKat || b.jenis, kunciJawaban: lamaRow.kunciJawaban || b.kunciJawaban });
        dipertahankan += 1;
      } else {
        // jawaban belum diketik: pertanyaan dan jawaban dasar mengikuti katalog; tanda lain (mis. hasil isi otomatis) dibuang
        const baru2 = barisBaru(b);
        if (norm(lamaRow.tanya) !== norm(b.tanya) && teks(lamaRow.tanya).trim() && !lamaRow.butir) {
          // pertanyaan diketik sendiri oleh petugas: bunyinya dipertahankan
          baru2.tanya = lamaRow.tanya;
        }
        hasil[j] = baru2;
        diganti += 1;
      }
    });

    // Baris lama yang tidak cocok dengan butir mana pun: tetap di tempatnya (menempel pada pendahulu terdekat yang ikut keluar).
    let dibuang = 0;
    const ikut = B.map(() => []);
    const tanpaPendahulu = [];
    L.forEach((r, i) => {
      if (cocokIdx.has(i)) return;
      if (r.butir && !diketikPetugas(r) && !r.ditambah) {
        dibuang += 1; // butir katalog yang tidak berlaku lagi untuk keadaan ini (baris yang ditambahkan petugas dari katalog tetap)
        return;
      }
      if (o.gantiDaftar && !diketikPetugas(r)) {
        dibuang += 1; // daftar diganti katalog: baris contoh/titik-titik tidak ikut
        return;
      }
      let pos = -1;
      for (let k = i - 1; k >= 0; k -= 1) {
        if (cocokIdx.has(k)) {
          pos = cocokIdx.get(k);
          break;
        }
      }
      if (pos >= 0) ikut[pos].push(r);
      else tanpaPendahulu.push(r);
    });
    // yang tanpa pendahulu: sebelum butir penutup bila ada, selain itu di akhir
    const idxPenutup = B.findIndex((b) => b.kelompok === "penutup");
    let rows = [];
    hasil.forEach((r, j) => {
      if (j === idxPenutup) rows.push(...tanpaPendahulu);
      rows.push(r, ...ikut[j]);
    });
    if (idxPenutup < 0) rows.push(...tanpaPendahulu);
    rows = rows.map((r, i) => Object.assign({}, r, { no: String(i + 1) }));
    return { rows, dipertahankan, diganti, baru: baruN, dibuang };
  }

  /**
   * Memasang jawaban usulan (kontrak bersama {teks, yakin, sumber, ket}) pada baris hasil gabung().
   * `usulan` = { [kunciJawaban]: {teks, yakin, sumber, ket}, ["<kunciJawaban>@<kunciSaksi>"]: ... }. Pengisi jawaban dari data
   * mengembalikan kalimat yang dibedakan menurut saksi (saksi 2 memakai kalimat lain) di kunci berekor `@kunciSaksi`;
   * karena itu, bila `kunciSaksi` diberikan, kunci berekor dicoba LEBIH DULU lalu kunci polos.
   * Hanya baris yang BELUM diketik petugas yang diganti (kosong, kalimat dasar katalog, atau hasil susunan sebelumnya);
   * baris yang diketik petugas tidak pernah disentuh. Baris yang dipasang membawa `otomatis` (= teks),
   * `usulan` {teks, yakin, sumber, ket} (dibaca tampilan: warna kotak, lencana ragu, ikon i), serta `yakin` dan `sumberJawab`.
   * @param {Array} rows
   * @param {object} usulan
   * @param {string} [kunciSaksi]
   * @param {{timpa?: boolean}} [opsi]  timpa: ketikan petugas ikut diganti (hanya atas persetujuan di layar konfirmasi)
   * @returns {{rows: Array, terisi: number, tertahan: number, ragu: number}}
   */
  function terapkanUsulan(rows, usulan, kunciSaksi, opsi) {
    const u = laRaya(usulan) ? usulan : {};
    const ks = teks(kunciSaksi);
    let terisi = 0;
    let tertahan = 0;
    let ragu = 0;
    const hasil = daftar(rows).map((r) => {
      const kunci = teks(r && (r.kunciJawaban || (r.butir && r.jenisKat ? `${r.butir}/${r.jenisKat}` : "")));
      const polos = r && r.butir && r.jenisKat ? `${r.butir}/${r.jenisKat}` : "";
      const calon = [];
      if (ks) {
        if (kunci) calon.push(`${kunci}@${ks}`);
        if (polos && polos !== kunci) calon.push(`${polos}@${ks}`);
      }
      if (kunci) calon.push(kunci);
      if (polos && polos !== kunci) calon.push(polos);
      let cari;
      for (const c of calon) {
        if (u[c] && rapat(u[c].teks)) {
          cari = u[c];
          break;
        }
      }
      const isi = cari && rapat(cari.teks);
      if (!isi) return r;
      if (diketikPetugas(r) && !(opsi && opsi.timpa === true)) {
        // ketikan yang sudah sama dengan usulan tidak perlu ditahan atau diganti
        if (norm(r.jawab) !== norm(isi)) tertahan += 1;
        return r;
      }
      terisi += 1;
      const yakin = cari.yakin === "yakin" || cari.yakin === "ragu" ? cari.yakin : "cukup";
      if (yakin === "ragu") ragu += 1;
      const sumber = teks(cari.sumber);
      return Object.assign({}, r, { jawab: isi, otomatis: isi, yakin, sumberJawab: sumber, usulan: { teks: isi, yakin, sumber, ket: teks(cari.ket) } });
    });
    return { rows: hasil, terisi, tertahan, ragu };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Panel (HTML)
  // ──────────────────────────────────────────────────────────────────────────

  function opsiSelect(daftarOpsi, terpilih) {
    return daftarOpsi.map((x) => `<option value="${esc(x.nilai)}"${String(x.nilai) === String(terpilih) ? " selected" : ""}>${esc(x.label)}</option>`).join("");
  }

  /** Kartu keadaan perkara (satu untuk seluruh perkara): pilihan dari katalog, yang terbaca dari data diberi tanda. */
  function keadaanHtml(bidang, mati) {
    const perkara = bidang.filter((b) => !b.perSaksi);
    if (!perkara.length) return "";
    const isi = perkara
      .map((b) => {
        const tanda = b.dariData ? ` <span class="bd-chip ok" title="Terisi dari data perkara; boleh diubah">dari data perkara</span>` : "";
        if (b.jamak) {
          const centang = b.nilai
            .map((n) => `<label class="bd-skcentang"><input type="checkbox" data-skkunci="__perkara" data-skfld="kat-keadaan:${esc(b.kunci)}" value="${esc(n.nilai)}"${b.terpilih.includes(n.nilai) ? " checked" : ""}${mati}> ${esc(n.label)}</label>`)
            .join("");
          return `<fieldset class="bd-skalasan"><legend>${esc(b.label)}${tanda}</legend>${centang}</fieldset>`;
        }
        return `<label class="bd-sklbl">${esc(b.label)}${tanda}<select data-skkunci="__perkara" data-skfld="kat-keadaan:${esc(b.kunci)}"${mati}>${opsiSelect(b.nilai, b.terpilih[0])}</select></label>`;
      })
      .join("");
    return `<div class="bd-skkartu bd-skkeadaan" data-skkartu="__perkara"><b class="bd-sknama">Keadaan perkara</b>${isi}</div>`;
  }

  /**
   * Panel "Pengetahuan saksi" mode katalog.
   * @param {{
   *   judul: string, keys: string[], siap: boolean, jarang: boolean, ada: boolean,
   *   bidang: Array,                          dari bidangKeadaan()
   *   kartu: Array<{kunci, nama, jenis, pilihan: Array<{nilai,label}>, sumber: string, sumberPilihan: Array<{nilai,label}>, bidangSaksi: Array, status?: string, galat?: string}>
   * }} o
   */
  function panelHtml(o) {
    const mati = o.siap ? "" : " disabled";
    const kartu = daftar(o.kartu)
      .map((k) => {
        const saksi = daftar(k.bidangSaksi)
          .map((b) => `<label class="bd-sklbl">${esc(b.label)}<select data-skkunci="${esc(k.kunci)}" data-skfld="kat-saksi:${esc(b.kunci)}"${mati}>${opsiSelect(b.nilai, b.terpilih[0])}</select></label>`)
          .join("");
        const sumber =
          k.jenis === "de-auditu"
            ? `<label class="bd-sklbl">Cerita dari siapa<select data-skkunci="${esc(k.kunci)}" data-skfld="kat-sumber"${mati}>${opsiSelect(k.sumberPilihan, k.sumber)}</select></label>`
            : "";
        return (
          `<div class="bd-skkartu" data-skkartu="${esc(k.kunci)}"><b class="bd-sknama">${esc(k.nama)}</b>` +
          `<label class="bd-sklbl">Yang diketahui saksi<select data-skkunci="${esc(k.kunci)}" data-skfld="kat-jenis"${mati}>${opsiSelect(k.pilihan, k.jenis)}</select></label>` +
          sumber +
          saksi +
          (k.status ? `<p class="bd-catat" role="status">${esc(k.status)}</p>` : "") +
          (k.galat ? `<p class="bd-peringatan">${esc(k.galat)}</p>` : "") +
          `</div>`
        );
      })
      .join("");
    const jarang = `<label class="bd-skcentang"><input type="checkbox" data-skkunci="__perkara" data-skfld="kat-jarang"${o.jarang ? " checked" : ""}${mati}> Sertakan pertanyaan yang jarang diajukan</label>`;
    return (
      `<div class="bd-skpanel bd-skkatalog" role="group" aria-label="Pengetahuan saksi" data-katalog="${esc(o.judul)}">` +
      `<div class="bd-skhead"><span class="bd-lbl">Pengetahuan saksi · ${esc(o.judul)}</span><button type="button" class="bd-btn kecil" data-bd2="isioto" data-kunci="${esc(daftar(o.keys).join("|"))}"${mati}>Isi ulang dari data perkara</button></div>` +
      `${typeof o.konfirmasi === "string" ? o.konfirmasi : ""}` +
      `<div class="bd-skgrid">${keadaanHtml(daftar(o.bidang), mati)}${kartu}</div>${jarang}</div>`
    );
  }

  /** Panel untuk jenis perkara yang belum punya katalog: kabar singkat, tanpa pilihan cerai. */
  function panelTanpaHtml(nama) {
    return `<div class="bd-skpanel" role="group" aria-label="Pengetahuan saksi"><div class="bd-skhead"><span class="bd-lbl">Pengetahuan saksi</span></div><p class="bd-catat">Jenis perkara ${esc(nama || "ini")} belum punya katalog pertanyaan saksi. Ketik pertanyaan dan jawaban saksi sendiri, atau muat set pertanyaan dari ABT.</p></div>`;
  }


  // ──────────────────────────────────────────────────────────────────────────
  // 1 Nov 2026 (keputusan 79): "Tambah pertanyaan" - pertanyaan katalog yang TIDAK ikut tersusun (tidak cocok keadaan, tingkat
  // jarang, atau sudah dihapus petugas), dipilih lalu disisipkan di tengah keterangan saksi beserta jawaban bawaannya.
  // ──────────────────────────────────────────────────────────────────────────
  const JUDUL_KELOMPOK = Object.freeze({
    identitas: "Identitas saksi",
    hubungan: "Hubungan saksi dengan para pihak",
    pokok: "Pokok perkara",
    akibat: "Akibat",
    upaya: "Upaya",
  });
  const URUT_KELOMPOK = Object.freeze(["identitas", "hubungan", "pokok", "akibat", "upaya"]);


  // ──────────────────────────────────────────────────────────────────────────
  // 1 Nov 2026 (keputusan 79, perkara cerai): baris dari set pertanyaan lama / ABT tidak membawa id butir. Tiap baris dicocokkan ke
  // butir katalog menurut bunyi pertanyaan (kata-kata yang sama, penanda #nnnn#/{slot} dibuang, sebutan pihak diisi; semua rumusan
  // varian dipertimbangkan). Satu butir hanya untuk satu baris (yang paling mirip). Baris yang tidak cocok tidak diberi butir.
  // ──────────────────────────────────────────────────────────────────────────
  const AMBANG_COCOK = 0.5;
  const memoKata = new Map();
  const kataDari = (t) => {
    const k = teks(t);
    let h = memoKata.get(k);
    if (!h) {
      h = new Set(k.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean));
      if (memoKata.size > 4000) memoKata.clear();
      memoKata.set(k, h);
    }
    return h;
  };
  const mirip = (a, b) => {
    if (!a.size && !b.size) return 1;
    let irisan = 0;
    for (const w of a) if (b.has(w)) irisan += 1;
    return irisan / (a.size + b.size - irisan);
  };
  const bersihTanya = (t, sebutan) => rapat(teks(t).replace(/#0046#/g, sebutan.P).replace(/#0047#/g, sebutan.T).replace(/#\d{4,5}#|\{[a-zA-Z]+\}/g, " "));
  const memoIndeks = new WeakMap();
  function indeksTanya(kat, sebutan) {
    const kunci = `${sebutan.P}|${sebutan.T}`;
    let peta = memoIndeks.get(kat);
    if (!peta) memoIndeks.set(kat, (peta = new Map()));
    if (!peta.has(kunci)) {
      peta.set(
        kunci,
        daftar(kat.pertanyaan)
          .filter((q) => laRaya(q) && q.kelompok !== "penutup")
          .map((q) => ({ id: q.id, pihak: daftar(q.pihakSaksi), kata: [q.teks, ...daftar(q.teksVarian)].map((v) => kataDari(bersihTanya(v, sebutan))) }))
      );
    }
    return peta.get(kunci);
  }
  /**
   * @param {object} kat
   * @param {Array<{butir?: string, tanya?: string}>} rows
   * @param {"P"|"T"} pihak
   * @param {{P: string, T: string}} sebutan
   * @returns {string[]} id butir tiap baris ("" bila tidak cocok); baris yang sudah membawa `butir` memakai butirnya.
   */
  function cocokkanButir(kat, rows, pihak, sebutan) {
    const sb = sebutan && sebutan.P ? sebutan : { P: "Penggugat", T: "Tergugat" };
    const hasil = daftar(rows).map((r) => (r && r.butir ? teks(r.butir) : ""));
    if (!kat) return hasil;
    const dipakai = new Set(hasil.filter(Boolean));
    const indeks = indeksTanya(kat, sb).filter((x) => (x.pihak.includes("*") || x.pihak.includes(pihak)) && !dipakai.has(x.id));
    const pasangan = [];
    daftar(rows).forEach((r, i) => {
      if (!r || r.butir || !rapat(r.tanya)) return;
      const kata = kataDari(bersihTanya(r.tanya, sb));
      for (const x of indeks) {
        let terbaik = 0;
        for (const v of x.kata) terbaik = Math.max(terbaik, mirip(kata, v));
        if (terbaik >= AMBANG_COCOK) pasangan.push({ i, id: x.id, skor: terbaik });
      }
    });
    pasangan.sort((a, b) => b.skor - a.skor || a.i - b.i);
    const barisTerpakai = new Set();
    for (const p of pasangan) {
      if (barisTerpakai.has(p.i) || dipakai.has(p.id)) continue;
      hasil[p.i] = p.id;
      barisTerpakai.add(p.i);
      dipakai.add(p.id);
    }
    return hasil;
  }

  /** Katalog ringkas berisi hanya butir `ids`, syarat keadaan/tingkat/pihaknya dinetralkan supaya pasti ikut tersusun untuk saksi mana pun. */
  function katTambahan(kat, ids) {
    const pilih = new Set(daftar(ids));
    const butir = daftar(kat && kat.pertanyaan)
      .filter((q) => laRaya(q) && pilih.has(q.id))
      .map((q) => Object.assign({}, q, { keadaan: {}, tingkat: "inti", pihakSaksi: ["*"], pokok: undefined, menggantikan: [], kelompok: q.kelompok === "penutup" ? "pokok" : q.kelompok }));
    return Object.assign({}, kat, { pertanyaan: butir });
  }

  /**
   * Pertanyaan katalog yang belum ada pada saksi-saksi `target`, dikelompokkan menurut pokok pembuktiannya, dengan rumusan
   * pertanyaan dan jawaban bawaan MENURUT pengetahuan dan keadaan tiap saksi (jalur susun() yang sama).
   *   masukan = masukan susun() + { target: [kunciSaksi], rows: { [kunciSaksi]: baris-baris sekarang } }
   * @returns {{ada: boolean, calon: Array<{id, judul, tingkat, urutan, tanya, baris: Object<string, object>}>}}
   */
  function calonTambah(masukan) {
    const m = Mesin();
    const o = masukan || {};
    const kat = o.kat;
    if (!m || !kat) return { ada: false, calon: [] };
    const target = daftar(o.target).map(teks);
    const rowsDari = (k) => daftar(laRaya(o.rows) ? o.rows[k] : []);
    const sudah = new Set();
    for (const k of target) for (const id of cocokkanButir(kat, rowsDari(k), pihakDariKunci(k), o.sebutan)) if (id) sudah.add(id);
    const pihak = target.map((k) => pihakDariKunci(k));
    const urutan = (q) => (typeof q.urutan === "number" ? q.urutan : 0);
    const kandidat = daftar(kat.pertanyaan)
      .filter((q) => laRaya(q) && q.kelompok !== "penutup" && !sudah.has(q.id) && pihak.every((p) => daftar(q.pihakSaksi).includes("*") || daftar(q.pihakSaksi).includes(p)))
      .sort((a, b) => urutan(a) - urutan(b));
    if (!kandidat.length || !target.length) return { ada: true, calon: [] };
    // o.saring: pilihan disaring menurut keadaan perkara (perkara cerai): butir kumulasi yang tidak diminta "kumulasi" (tersembunyi,
    // hanya muncul lewat pencarian); butir yang syarat keadaan lainnya tidak cocok (huruf alasan yang tidak dipilih, dsb.) "lainnya".
    const semuaPokok = daftar(kat.pokokPembuktian);
    const keadaanPerkara = m.keadaanBawaan(kat, laRaya(o.keadaan) ? o.keadaan : {});
    const lipatDari = (q) => {
      const syarat = laRaya(q.keadaan) ? q.keadaan : {};
      const pokok = semuaPokok.find((x) => x && x.id === q.pokok);
      const syaratPokok = pokok && laRaya(pokok.keadaan) ? pokok.keadaan : {};
      const gabungan = Object.assign({}, syaratPokok, syarat);
      if (Object.prototype.hasOwnProperty.call(gabungan, "kumulasi") && !m.cocokKeadaan({ kumulasi: gabungan.kumulasi }, keadaanPerkara)) return "kumulasi";
      return m.cocokKeadaan(gabungan, keadaanPerkara) ? "" : "lainnya";
    };
    const hasil = susun(Object.assign({}, o, { kat: katTambahan(kat, kandidat.map((q) => q.id)), jarang: true }));
    const calon = [];
    for (const q of kandidat) {
      const baris = {};
      let lengkap = true;
      for (const k of target) {
        const sk = hasil.saksi.find((x) => x.kunci === k);
        const b = sk ? sk.baris.find((x) => x.butir === q.id) : null;
        if (!b) {
          lengkap = false;
          break;
        }
        baris[k] = b;
      }
      if (!lengkap) continue;
      const tanya = baris[target[0]].tanya;
      const pk = daftar(kat.pokokPembuktian).find((x) => x && x.id === q.pokok);
      const judul = (pk && teks(pk.judul)) || JUDUL_KELOMPOK[q.kelompok] || "Lainnya";
      calon.push({ id: q.id, judul, tingkat: teks(q.tingkat), urutan: urutan(q), kelompok: teks(q.kelompok), tanya, baris, lipat: o.saring === true ? lipatDari(q) : "" });
    }
    // kelompok menurut urutan butir pertamanya; di dalam kelompok menurut urutan katalog
    const awal = new Map();
    for (const c of calon) if (!awal.has(c.judul)) awal.set(c.judul, URUT_KELOMPOK.indexOf(c.kelompok) * 100000 + c.urutan);
    calon.sort((a, b) => awal.get(a.judul) - awal.get(b.judul) || a.urutan - b.urutan);
    return { ada: true, calon, peringatan: hasil.peringatan };
  }

  /** Baris tabel dari satu butir hasil susun() (bentuk sama dengan baris baru di gabung()), ditandai sebagai tambahan petugas. */
  const barisTambahan = (b) => ({ tanya: b.tanya, jawab: b.jawab, dasar: b.jawab, butir: b.butir, jenisKat: b.jenis, kunciJawaban: b.kunciJawaban, ditambah: true });

  /**
   * Pilihan tambah pertanyaan, dikelompokkan: [{judul, butir:[calon], lipat?: true}] dengan saringan kata (semua kata harus ada).
   * Tanpa kata cari: butir biasa dikelompokkan menurut pokoknya; butir "lainnya" (keadaan perkara tidak cocok) masuk satu kelompok
   * "Lainnya" di bawah (terlipat, `lipat: true`); butir "kumulasi" yang tidak diminta tidak tampil. Dengan kata cari: SEMUA butir dicari,
   * yang tidak cocok keadaan perkara masuk kelompok "Lainnya".
   */
  function kelompokkanCalon(calon, kataCari) {
    const k = rapat(kataCari).toLowerCase();
    const kata = k ? k.split(" ") : [];
    const kelompok = [];
    const lain = [];
    for (const c of daftar(calon)) {
      const t = `${c.tanya} ${c.judul}`.toLowerCase();
      if (kata.some((w) => !t.includes(w))) continue;
      const lipat = teks(c.lipat);
      if (lipat && (kata.length || lipat === "lainnya")) {
        lain.push(c);
        continue;
      }
      if (lipat) continue; // kumulasi yang tidak diminta: hanya lewat pencarian
      let g = kelompok.find((x) => x.judul === c.judul && !x.lipat);
      if (!g) kelompok.push((g = { judul: c.judul, butir: [] }));
      g.butir.push(c);
    }
    if (lain.length) kelompok.push({ judul: "Lainnya", butir: lain, lipat: true });
    return kelompok;
  }

  return Object.freeze({
    katTambahan,
    cocokkanButir,
    calonTambah,
    barisTambahan,
    kelompokkanCalon,
    ID_JENIS,
    KEADAAN_PER_SAKSI,
    URUTAN_JENIS,
    idJenis,
    idAlur,
    sebutanPihak,
    namaSaksi,
    pihakDariKunci,
    kenali,
    kehadiranDariTeks,
    keadaanDariData,
    labelNilai,
    bidangKeadaan,
    pilihanPengetahuan,
    susun,
    diketikPetugas,
    gabung,
    terapkanUsulan,
    lengkapiBawaan,
    tingkatDipakai,
    pilihanSumberCerita,
    panelHtml,
    panelTanpaHtml,
  });
});
