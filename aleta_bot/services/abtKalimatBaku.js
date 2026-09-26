"use strict";

/**
 * ============================================================================
 * PUSTAKA KALIMAT BAKU UNTUK ISIAN BLANGKO
 * ============================================================================
 *
 * Sebagian variabel ABT tidak meminta FAKTA, melainkan KALIMAT tentang fakta.
 * 1268 misalnya: yang perlu diketahui hanya "keluarga sudah berusaha atau
 * belum, dan berhasil atau tidak" - dua bit keterangan - tetapi yang masuk ke
 * putusan adalah satu kalimat penuh.
 *
 * Selama kalimatnya disusun ulang tiap kali, rumusannya berbeda antar majelis
 * untuk fakta yang persis sama, dan putusan pengadilan yang sama berbunyi
 * berlainan tanpa sebab. Karena itu kalimatnya dikumpulkan di sini - satu
 * tempat, bukan tersebar di dalam kode yang menurunkannya.
 *
 * ============================================================================
 * KENAPA BERKAS, BUKAN LAYAR PENGATURAN
 * ============================================================================
 *
 * Layar penyuntingan di portal memang lebih ramah, dan itu pantas dikerjakan.
 * Tetapi ia menuntut tabel, migrasi, rute, dan halaman - sementara yang
 * dibutuhkan hari ini hanya SATU TEMPAT yang dapat dicari dan diubah, dan
 * yang perubahannya ikut ke seluruh pengadilan begitu dipasang.
 *
 * Berkas ini adalah tempat itu. Mengubah kalimat di bawah mengubah seluruh
 * usulan berikutnya; pengujian menjaga bentuknya supaya perubahan yang
 * merusak tidak lolos diam-diam.
 *
 * YANG TIDAK BOLEH MASUK KE SINI: kalimat yang menyatakan hukum - bunyi pasal,
 * dasar putusan, pertimbangan. Itu ada di abtAturanAlasan.js, dan hanya boleh
 * disalin dari naskah resmi.
 */

const KALIMAT = {
  /**
   * 1268 - upaya damai oleh keluarga.
   *
   * TIGA keadaan, bukan dua. Dahulu hanya "berhasil" dan "tidak berhasil", dan
   * apa pun yang bukan "tidak berhasil" dianggap berhasil - sehingga saksi
   * yang berkata "belum pernah ada upaya untuk merukunkan" menghasilkan
   * kalimat "pihak keluarga telah berusaha untuk mendamaikan ..." dengan
   * keyakinan pasti. Faktanya terbalik.
   *
   *   gagal      bunyi baku satker (194 + 29 isian 1268 manusia memakainya)
   *   berhasil   HANYA bila saksi menyebut "berhasil dirukunkan"
   *   belum-ada  TIDAK pernah diisi otomatis: keyakinannya "ragu" dan dua
   *              bunyi (gagal dan belum-ada) ditawarkan - keputusan pengguna 8.
   *              Bunyinya bentuk terbanyak di jawaban saksi manusia
   *              (abt_keterangan_saksi): 9 kemunculan di 9 perkara. Isian 1268
   *              manusia TIDAK punya satu pun bunyi "belum ada" (0 dari 350),
   *              jadi bunyi itu tidak dapat diambil dari sana.
   */
  // ==========================================================================
  // PENANDANYA BERMAKNA, BUKAN LETAK - DAN DULU TERBALIK
  // ==========================================================================
  //
  //   {lawan}  = variabel ABT 0046 = Penggugat / Pemohon (yang mengajukan)
  //   {pelaku} = variabel ABT 0047 = Tergugat / Termohon
  //
  // Sampai 2.35.0 bunyinya "mendamaikan {pelaku} dan {lawan}" dengan {pelaku}
  // diisi PENGAJU - arti penandanya dibalik di dalam fungsi pengisinya. Selama
  // bunyinya tertanam di kode itu tidak tampak; begitu bunyinya dapat ditambah
  // lewat pengaturan (daftar putusan.upaya-damai.bunyi), penanda yang artinya
  // terbalik dari daftar lain (bersama.alasan.frasa) akan menukar pihak di
  // putusan. Kini penanda berarti sama di semua daftar, dan kalimat yang
  // tercetak tidak berubah sehuruf pun.
  upayaDamai: {
    gagal: "pihak keluarga telah berusaha untuk mendamaikan {lawan} dan {pelaku}, namun tidak berhasil",
    berhasil: "pihak keluarga telah berusaha untuk mendamaikan {lawan} dan {pelaku}",
    "belum-ada": "belum pernah ada upaya untuk merukunkan {lawan} dan {pelaku}",
  },

  /**
   * ==========================================================================
   * 5227 - ALASAN-ALASAN GUGATAN, DISUSUN SEBAGAI FAKTA HUKUM
   * ==========================================================================
   *
   * Bentuk pertamanya menderetkan kalimat lengkap satu per satu:
   *
   *   "antara Penggugat dan Tergugat terus-menerus terjadi perselisihan dan
   *    pertengkaran, Tergugat melakukan Kekerasan Dalam Rumah Tangga terhadap
   *    Penggugat, Tergugat melalaikan kewajiban memberi nafkah kepada
   *    Penggugat dan Tergugat bersikap cemburu berlebihan"
   *
   * Itu bukan bahasa putusan. Empat hal keliru sekaligus:
   *
   *   1. SUBJEKNYA DIULANG. "Tergugat" muncul tiga kali dalam satu kalimat,
   *      padahal seluruh perbuatan itu dilakukan orang yang sama.
   *   2. TIDAK DIAWALI PELAKUNYA. Kalimatnya dibuka dengan keadaan bersama
   *      ("antara Penggugat dan Tergugat"), sehingga yang terbaca lebih dulu
   *      justru bukan siapa yang berbuat.
   *   3. PERSELISIHAN DISAMAKAN DENGAN PERBUATAN. Perselisihan terus-menerus
   *      itu AKIBAT dari perbuatan-perbuatan tadi, bukan salah satu di antara
   *      keduanya. Menderetkannya sejajar menghilangkan hubungan sebab-akibat
   *      yang justru menjadi inti pertimbangan.
   *   4. PENYAMBUNGNYA "dan". Dalam rumusan berdaftar, penutup yang lazim
   *      dipakai putusan adalah "serta".
   *
   * Yang benar satu kalimat berpelaku tunggal, daftar perbuatan tanpa
   * mengulang subjek, lalu akibatnya sebagai keterangan penutup:
   *
   *   "Tergugat melalaikan kewajiban nafkah lahir, bersikap cemburu
   *    berlebihan, serta melakukan Kekerasan Dalam Rumah Tangga (KDRT) yang
   *    memicu perselisihan terus-menerus dengan Penggugat"
   *
   * ==========================================================================
   * PELAKUNYA TIDAK DITEBAK
   * ==========================================================================
   *
   * Pada cerai gugat pelakunya "Tergugat"; pada cerai talak "Termohon". Kedua
   * kata itu tidak diturunkan dari jenis perkara di sini - ABT sudah
   * menyimpannya sebagai variabel tersendiri, 0046 dan 0047, dan ekstensi
   * membacanya dari halaman yang sedang dibuka. Menebaknya dari klasifikasi
   * perkara berarti salah menyebut pihak pada perkara yang klasifikasinya
   * tidak terduga.
   */
  frasaCiri: {
    // `urutan` menentukan tempatnya di dalam kalimat - bukan urutan kata kunci
    // ditemukan, yang bergantung pada cara saksi bertutur.
    //
    // `akibat` menandai ciri yang BUKAN perbuatan. Yang bertanda akibat tidak
    // pernah masuk daftar; ia menjadi keterangan penutup.
    //
    // `setara` (t2-ragam-bas-bot) - bunyi yang SAMA maknanya, sebagaimana
    // diucapkan saksi manusia. Dipakai HANYA di keterangan saksi SDG, supaya
    // label kunci ("pihak lain (wanita/pria idaman lain)") tidak tercetak
    // mentah di berita acara dan dua saksi tidak menyebut alasan dengan kata
    // yang sama persis. Kalimat 5227 di putusan tetap memakai `frasa`.
    // Angka di komentar = kemunculan / perkara di jawaban saksi manusia
    // aps_badilag Donggala (skrip t2-ragam-bas-bot/hitung-frasa.cjs), dengan
    // subjek {pelaku} di depannya. Yang menambah kata frekuensi ("sering") atau
    // mempersempit maknanya ("kurang menafkahi", "kekerasan fisik") TIDAK
    // dipakai - itu mengubah keterangan, bukan cara mengatakannya.
    "tidak memberi nafkah": {
      urutan: 10,
      frasa: "melalaikan kewajiban nafkah lahir",
      // 211/122, 36/24, 25/12
      setara: ["tidak memberikan nafkah", "tidak memberi nafkah", "tidak menafkahi {lawan}"],
    },
    cemburu: {
      urutan: 20,
      frasa: "bersikap cemburu berlebihan",
      // 44/27, 10/8
      setara: ["memiliki kecemburuan yang berlebihan", "cemburu berlebihan"],
    },
    "pihak lain (wanita/pria idaman lain)": {
      urutan: 30,
      frasa: "menjalin hubungan dengan pihak lain",
      // 41/32, 112/82 - tanpa "wanita/pria idaman lain" yang bergender
      setara: ["berselingkuh", "selingkuh"],
    },
    "kekerasan dalam rumah tangga": {
      urutan: 40,
      frasa: "melakukan Kekerasan Dalam Rumah Tangga (KDRT)",
      // 35/21, 24/19, 8/7
      setara: [
        "melakukan kekerasan dalam rumah tangga",
        "melakukan KDRT kepada {lawan}",
        "melakukan KDRT terhadap {lawan}",
      ],
    },
    // ========================================================================
    // MABUK, JUDI, DAN OBAT TERLARANG DIPISAH - DULU SATU FRASA UNTUK TIGANYA
    // ========================================================================
    //
    // Bentuk lamanya satu ciri berbunyi "menjadi pemabuk, penjudi, atau
    // pemakai obat terlarang". Ia dipakai apa pun pemicunya, sehingga saksi
    // yang hanya menerangkan judi menghasilkan kalimat yang menuduh mabuk dan
    // memakai obat terlarang sekaligus.
    //
    // Pada perkara 510/Pdt.G/2026/PA.Dgl keduanya menerangkan judi online -
    // tidak satu pun menyebut mabuk maupun obat - dan kalimat yang tersusun
    // tetap menuduh ketiganya. Itu bukan ketidaktepatan bahasa; itu
    // pertimbangan hukum yang menyebut perbuatan yang tidak dibuktikan.
    //
    // Ketiganya tetap satu huruf yang sama dalam Pasal 19 PP 9/1975 - itu
    // urusan 8503, bukan urusan kalimat ini. Yang ditulis di sini apa yang
    // benar-benar diterangkan.
    "mabuk": { urutan: 50, frasa: "menjadi pemabuk", setara: ["suka mabuk", "suka mabuk-mabukan"] }, // 14/12, 5/4
    "judi": { urutan: 51, frasa: "menjadi penjudi", setara: ["suka bermain judi", "bermain judi", "suka main judi"] }, // 38/28, 36/29, 16/11
    "obat terlarang": {
      urutan: 52,
      frasa: "menjadi pemakai obat terlarang",
      // 23/18 dan 12/8 (dua ejaan), 11/9
      setara: ["mengkonsumsi obat-obatan terlarang", "mengonsumsi obat-obatan terlarang", "mengonsumsi narkoba"],
    },
    "murtad/pindah agama": { urutan: 60, frasa: "berpindah agama" },
    // ========================================================================
    // CIRI BARU 25 SEPTEMBER 2026 - FRASANYA DIAMBIL DARI ISIAN 5227 MANUSIA
    // ========================================================================
    //
    // Bukan dikarang (keputusan pengguna 10). Yang dipakai bentuk terbanyak
    // pada 289 isian 5227 manusia yang diubah sebelum 1 September 2026
    // (aps_badilag.abt_data_teks, dibaca baca-saja; skrip dan hitungannya di
    // folder kerja t1-deteksi-saksi-bot/jelajah-frasa-5227.js):
    //
    //   bersikap temperamental  28 kemunculan / 28 perkara
    //                           (bentuk lain: "memiliki sifat tempramen" 3)
    //   berkata kasar           17 / 17  ("berkata-kata kasar" 4)
    //   bersikap kasar           3 / 3
    //   malas bekerja           21 / 21  ("malas dalam bekerja" 6)
    //
    // Syaratnya sama dengan varian BAS: sedikitnya 3 kemunculan di 3 perkara.
    "malas bekerja": { urutan: 15, frasa: "malas bekerja", setara: ["tidak mau bekerja"] }, // 165/119, 22/19
    temperamental: { urutan: 25, frasa: "bersikap temperamental", setara: ["suka marah", "mudah marah"] }, // 13/12, 8/8
    "berkata kasar": { urutan: 26, frasa: "berkata kasar" },
    "bersikap kasar": { urutan: 27, frasa: "bersikap kasar" },
    // ========================================================================
    // ZINA, PENJARA, CACAT BADAN, DAN TAKLIK SENGAJA TANPA FRASA
    // ========================================================================
    //
    // Keempatnya dicari di isian 5227 manusia yang sama, dan tidak satu pun
    // punya bentuk yang memenuhi syarat 3 kemunculan di 3 perkara:
    //
    //   zina       0 perkara
    //   taklik     0 perkara
    //   penjara    3 perkara, tiga bentuk berlainan (masing-masing 1 kali)
    //   cacat      1 perkara
    //
    // Frasanya karena itu TIDAK dikarang. Yang dijamin sebagai gantinya: ciri
    // yang terbaca tanpa frasa tidak pernah hilang diam-diam - susunAlasanRinci
    // memulangkannya sebagai `tanpaFrasa`, dan usulan 5227 menyebutnya di
    // catatan dengan keyakinan "ragu". Frasanya dapat ditambahkan lewat daftar
    // bersama.alasan.frasa sesudah disahkan atas perintah hakim.
    "perselisihan terus-menerus": {
      urutan: 90,
      akibat: true,
      // {lawan} ditulis di frasanya sendiri sejak 25 September 2026 - dahulu
      // ditempelkan fungsi penyusunnya di belakang, sehingga frasa yang
      // ditambah lewat pengaturan tidak dapat meletakkannya di tempat lain.
      frasa: "memicu perselisihan terus-menerus dengan {lawan}",
    },
  },

  /**
   * Penyambung berdaftar.
   *
   * "serta" untuk yang terakhir, bukan "dan". Tetapi komanya bergantung pada
   * BANYAKNYA butir: daftar tiga butir atau lebih memakai koma sebelum
   * "serta", sedangkan dua butir tidak - "A, serta B" bukan bentuk yang lazim,
   * sebab koma di sana memisahkan dua hal yang justru sudah tersambung.
   */
  penyambungAlasan: { antara: ", ", terakhirBanyak: ", serta ", terakhirDua: " serta " },

  /**
   * Ketika tidak ada satu pun PERBUATAN yang terbaca dan yang ada hanya
   * perselisihannya, kalimat berpelaku tunggal tidak dapat disusun - tidak ada
   * perbuatan untuk digantungi akibat. Yang dipakai rumusan bersama, dan itu
   * memang bentuk yang lazim untuk keadaan itu.
   */
  hanyaPerselisihan: "Antara {lawan} dan {pelaku} terus-menerus terjadi perselisihan dan pertengkaran",
};

/* ============================================================================
 * DAFTAR TIPE KELUARAN DARI PORTAL - DIBACA, DISARING, ATAU TIDAK DIPAKAI
 * ============================================================================
 *
 * Bot tidak membaca Postgres ALETA. Daftar yang dapat ditambah lewat layar
 * pengaturan (kontrak K2 nomor 8, 9, dan 10) ditumpangkan portal pada
 * permintaan /abt/usulan sebagai opsi.tipeKeluaran = {versi, daftar: {...}}.
 * Tanpa itu, atau bila satu daftar tidak ada di dalamnya, yang dipakai
 * konstanta di berkas ini - perilakunya persis seperti sebelum ada pengaturan.
 *
 * Daftar yang ADA tetapi kosong berarti semua entrinya dimatikan, dan itu
 * dihormati: kosong bukan "tidak ada".
 *
 * Masukan itu datang lewat peramban, jadi disaring (K6):
 *   - hanya daftar yang dikenal;
 *   - paling banyak 200 entri per daftar, nilai paling panjang 400 huruf;
 *   - tanpa '${', '<', atau ganti baris;
 *   - penanda yang sah hanya {pelaku} dan {lawan}; kata ciri tanpa penanda.
 *
 * Entri yang ditolak TIDAK dibuang diam-diam. Ia dipulangkan pada `ditolak`
 * beserta sebabnya, dan pemakainya menyebutkannya pada hasilnya.
 */
const DAFTAR_TIPE = Object.freeze({
  ciri: "putusan.alasan.ciri",
  frasa: "bersama.alasan.frasa",
  upayaDamai: "putusan.upaya-damai.bunyi",
});
const BATAS_ENTRI_TIPE = 200;
const BATAS_NILAI_TIPE = 400;
const KEADAAN_UPAYA_DAMAI = Object.freeze(["gagal", "berhasil", "belum-ada"]);
const PENANDA_PIHAK = Object.freeze(["{pelaku}", "{lawan}"]);

/** Sebab teks ditolak, atau "" bila teksnya boleh dipakai. */
function periksaTeksTipe(teks, penandaSah) {
  const s = String(teks === undefined || teks === null ? "" : teks);
  if (!s.trim()) return "kosong";
  if (s.length > BATAS_NILAI_TIPE) return "lebih_dari_400_huruf";
  if (s.includes("${")) return "memuat_${";
  if (s.includes("<")) return "memuat_<";
  if (/[\r\n]/.test(s)) return "memuat_ganti_baris";
  for (const p of s.match(/\{[^{}]*\}/g) || []) {
    if (!penandaSah.includes(p)) return `penanda_tidak_sah:${p}`;
  }
  if (/[{}]/.test(s.replace(/\{[^{}]*\}/g, ""))) return "kurung_kurawal_lepas";
  return "";
}

/** Satu entri daftar dinormalkan, atau {alasan} bila ditolak. */
function normalkanEntriTipe(kunciDaftar, e, indeks) {
  if (!e || typeof e !== "object") return { alasan: "bukan_objek" };
  const kunci = String(e.kunci === undefined || e.kunci === null ? "" : e.kunci).trim();
  const salahKunci = periksaTeksTipe(kunci, []);
  if (salahKunci) return { alasan: `kunci_${salahKunci}` };
  if (kunci.length > 80) return { alasan: "kunci_lebih_dari_80_huruf" };
  const data = e.data && typeof e.data === "object" ? e.data : {};

  if (kunciDaftar === DAFTAR_TIPE.ciri) {
    const sumberKata = Array.isArray(data.kata) ? data.kata : String(e.nilai || "").split("+");
    const kata = sumberKata.map((k) => String(k === undefined || k === null ? "" : k).trim().toLowerCase());
    if (!kata.length) return { alasan: "kata_kosong" };
    for (const k of kata) {
      const salah = periksaTeksTipe(k, []);
      if (salah) return { alasan: `kata_${salah}` };
      // Kata terlalu pendek menyala di mana-mana - pencocokannya potongan
      // teks, bukan kata utuh ("wil" pada "wilayah").
      if (k.length < 3) return { alasan: "kata_kurang_dari_3_huruf" };
      if (k.length > 60) return { alasan: "kata_lebih_dari_60_huruf" };
    }
    return { entri: { kunci, kata } };
  }

  const nilai = String(e.nilai === undefined || e.nilai === null ? "" : e.nilai);
  const salahNilai = periksaTeksTipe(nilai, PENANDA_PIHAK);
  if (salahNilai) return { alasan: `nilai_${salahNilai}` };

  if (kunciDaftar === DAFTAR_TIPE.frasa) {
    const urutanData = Number(data.urutan);
    const urutanEntri = Number(e.urutan);
    const urutan = Number.isFinite(urutanData) ? urutanData : Number.isFinite(urutanEntri) ? urutanEntri : indeks;
    // setara: bunyi sepadan untuk keterangan saksi. Disaring seperti nilainya;
    // satu yang ditolak menolak entrinya, bukan dibuang diam-diam.
    const setara = [];
    if (data.setara !== undefined) {
      if (!Array.isArray(data.setara)) return { alasan: "setara_bukan_larik" };
      for (const x of data.setara.slice(0, 10)) {
        const salah = periksaTeksTipe(x, PENANDA_PIHAK);
        if (salah) return { alasan: `setara_${salah}` };
        setara.push(String(x));
      }
    }
    return { entri: { kunci, frasa: nilai, urutan, akibat: data.akibat === true, setara } };
  }
  if (kunciDaftar === DAFTAR_TIPE.upayaDamai) {
    if (!KEADAAN_UPAYA_DAMAI.includes(kunci)) return { alasan: "kunci_bukan_gagal_berhasil_belum-ada" };
    return { entri: { kunci, nilai } };
  }
  return { alasan: "daftar_tidak_dikenal" };
}

/**
 * Membaca satu daftar dari opsi.tipeKeluaran.
 *
 * @returns {{ada: boolean, entri: object[], ditolak: {daftar, kunci, alasan}[]}}
 *   ada=false berarti daftarnya tidak dikirim, dan pemakainya memakai
 *   konstanta tertanam.
 */
function bacaDaftarTipe(opsi, kunciDaftar) {
  const tipe = opsi && typeof opsi === "object" ? opsi.tipeKeluaran : null;
  const daftar = tipe && typeof tipe === "object" && tipe.daftar && typeof tipe.daftar === "object" ? tipe.daftar : null;
  if (!daftar || !Object.prototype.hasOwnProperty.call(daftar, kunciDaftar)) {
    return { ada: false, entri: [], ditolak: [] };
  }
  const mentah = daftar[kunciDaftar];
  if (!Array.isArray(mentah)) {
    return { ada: false, entri: [], ditolak: [{ daftar: kunciDaftar, kunci: "", alasan: "daftar_bukan_larik" }] };
  }
  const entri = [];
  const ditolak = [];
  const kunciTunggal = new Set();
  mentah.forEach((e, indeks) => {
    const kunciMentah = e && typeof e === "object" ? String(e.kunci || "").slice(0, 80) : "";
    if (indeks >= BATAS_ENTRI_TIPE) {
      ditolak.push({ daftar: kunciDaftar, kunci: kunciMentah, alasan: "lebih_dari_200_entri" });
      return;
    }
    const hasil = normalkanEntriTipe(kunciDaftar, e, indeks);
    if (!hasil.entri) {
      ditolak.push({ daftar: kunciDaftar, kunci: kunciMentah, alasan: hasil.alasan });
      return;
    }
    // Ciri boleh punya banyak baris sekunci (satu baris satu bunyi). Frasa
    // dan bunyi upaya damai tidak: yang kedua ditolak dan disebut, bukan
    // menimpa yang pertama tanpa jejak.
    if (kunciDaftar !== DAFTAR_TIPE.ciri) {
      if (kunciTunggal.has(hasil.entri.kunci)) {
        ditolak.push({ daftar: kunciDaftar, kunci: hasil.entri.kunci, alasan: "kunci_ganda" });
        return;
      }
      kunciTunggal.add(hasil.entri.kunci);
    }
    entri.push(hasil.entri);
  });
  return { ada: true, entri, ditolak };
}

/** Frasa ciri yang berlaku: dari portal bila dikirim, selain itu konstanta. */
function frasaCiriEfektif(opsi) {
  const baca = bacaDaftarTipe(opsi, DAFTAR_TIPE.frasa);
  if (!baca.ada) return { peta: KALIMAT.frasaCiri, asal: "tertanam", ditolak: baca.ditolak };
  const peta = {};
  for (const e of baca.entri) {
    const aturan = e.akibat ? { urutan: e.urutan, akibat: true, frasa: e.frasa } : { urutan: e.urutan, frasa: e.frasa };
    if (e.setara && e.setara.length) aturan.setara = e.setara;
    peta[e.kunci] = aturan;
  }
  return { peta, asal: "portal", ditolak: baca.ditolak };
}

/** Bunyi upaya damai yang berlaku, per keadaan. */
function bunyiUpayaDamaiEfektif(opsi) {
  const baca = bacaDaftarTipe(opsi, DAFTAR_TIPE.upayaDamai);
  if (!baca.ada) return { bunyi: KALIMAT.upayaDamai, asal: "tertanam", ditolak: baca.ditolak };
  const bunyi = {};
  for (const e of baca.entri) bunyi[e.kunci] = e.nilai;
  return { bunyi, asal: "portal", ditolak: baca.ditolak };
}

/** Mengisi penanda {pelaku} dan {lawan} - SELURUH kemunculannya, bukan yang pertama saja. */
function isiPenandaPihak(teks, pelaku, lawan) {
  return String(teks).split("{pelaku}").join(pelaku).split("{lawan}").join(lawan);
}

/**
 * Menyusun kalimat 5227 beserta ciri yang TIDAK dapat ikut di dalamnya.
 *
 * @param daftarCiri ciri yang benar-benar disebut saksi
 * @param pihak      { pelaku, lawan } - dibaca dari variabel 0047 dan 0046
 * @param opsi       { tipeKeluaran? } - daftar bersama.alasan.frasa dari portal
 * @returns {{kalimat: string, tanpaFrasa: string[], ditolak: object[]}}
 *
 * ============================================================================
 * CIRI TANPA FRASA TIDAK BOLEH HILANG DIAM-DIAM
 * ============================================================================
 *
 * Bentuk lamanya menyaring ciri yang tidak punya frasa lalu diam: saksi yang
 * sama-sama menerangkan zina menghasilkan kalimat yang hanya menyebut
 * perselisihan, dan tidak ada yang tahu alasan terberat perkaranya tertinggal.
 * Kini ciri itu dipulangkan pada `tanpaFrasa`, dan pemakainya wajib
 * menyebutkannya.
 */
function susunAlasanRinci(daftarCiri, pihak, opsi) {
  const pelaku = String((pihak && pihak.pelaku) || "Tergugat").trim() || "Tergugat";
  const lawan = String((pihak && pihak.lawan) || "Penggugat").trim() || "Penggugat";
  const { peta, ditolak } = frasaCiriEfektif(opsi);

  const dikenal = [];
  const tanpaFrasa = [];
  for (const nama of daftarCiri || []) {
    const aturan = Object.prototype.hasOwnProperty.call(peta, nama) ? peta[nama] : null;
    if (aturan) dikenal.push({ nama, aturan });
    else if (!tanpaFrasa.includes(nama)) tanpaFrasa.push(nama);
  }
  dikenal.sort((a, b) => a.aturan.urutan - b.aturan.urutan);

  const perbuatan = dikenal.filter((x) => !x.aturan.akibat).map((x) => isiPenandaPihak(x.aturan.frasa, pelaku, lawan));
  const akibat = dikenal.find((x) => x.aturan.akibat);

  if (perbuatan.length === 0) {
    const kalimat = akibat ? isiPenandaPihak(KALIMAT.hanyaPerselisihan, pelaku, lawan) : "";
    return { kalimat, tanpaFrasa, ditolak };
  }

  const penyambungAkhir =
    perbuatan.length === 2
      ? KALIMAT.penyambungAlasan.terakhirDua
      : KALIMAT.penyambungAlasan.terakhirBanyak;
  const daftar =
    perbuatan.length === 1
      ? perbuatan[0]
      : perbuatan.slice(0, -1).join(KALIMAT.penyambungAlasan.antara) +
        penyambungAkhir +
        perbuatan[perbuatan.length - 1];

  const penutup = akibat ? ` yang ${isiPenandaPihak(akibat.aturan.frasa, pelaku, lawan)}` : "";
  return { kalimat: `${pelaku} ${daftar}${penutup}`, tanpaFrasa, ditolak };
}

/** Kalimat 5227 saja - bentuk lama, dipertahankan untuk pemakai yang sudah ada. */
function susunAlasan(daftarCiri, pihak, opsi) {
  return susunAlasanRinci(daftarCiri, pihak, opsi).kalimat;
}

/**
 * Kalimat upaya damai keluarga, bersebutan pihak perkara ini.
 *
 * pihak.lawan  = variabel ABT 0046 = "Penggugat" / "Pemohon"   -> {lawan}
 * pihak.pelaku = variabel ABT 0047 = "Tergugat"  / "Termohon"  -> {pelaku}
 *
 * Nama ruasnya kebalikan dari yang disangka - periksa sebelum menyunting.
 * Yang disebut lebih dulu dalam kalimat adalah yang MENGAJUKAN, yaitu 0046.
 *
 * @param keadaan "gagal" | "berhasil" | "belum-ada" - atau boolean, bentuk
 *                lamanya: true = gagal, false = berhasil
 * @returns kalimatnya, atau "" bila bunyi keadaan itu tidak tersedia (mis.
 *          dimatikan di pengaturan) - bukan kalimat keadaan lain
 *
 * Tanpa pihak, kalimatnya jatuh ke bentuk gugatan seperti sebelumnya - itu
 * bentuk yang benar untuk 82% perkara, dan menolak menyusun kalimat karena
 * sebutannya belum terbaca hanya mengosongkan blangko yang dapat diisi.
 */
function kalimatUpayaDamai(keadaan, pihak, opsi) {
  const kunci = keadaan === true ? "gagal" : keadaan === false ? "berhasil" : String(keadaan || "");
  const { bunyi } = bunyiUpayaDamaiEfektif(opsi);
  const pola = Object.prototype.hasOwnProperty.call(bunyi, kunci) ? bunyi[kunci] : "";
  if (!pola) return "";
  const lawan = String((pihak && pihak.lawan) || "").trim() || "Penggugat";
  const pelaku = String((pihak && pihak.pelaku) || "").trim() || "Tergugat";
  return isiPenandaPihak(pola, pelaku, lawan);
}

module.exports = {
  KALIMAT,
  DAFTAR_TIPE,
  KEADAAN_UPAYA_DAMAI,
  susunAlasan,
  susunAlasanRinci,
  kalimatUpayaDamai,
  bacaDaftarTipe,
  frasaCiriEfektif,
  bunyiUpayaDamaiEfektif,
  periksaTeksTipe,
};
