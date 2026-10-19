// Tabel kurasi pengisi isian blangko Derry (daftar cek "Isi dari SIPP & input ke ABT").
// Setiap kelompok menyebut KODE dan BERKAS tempat kode itu benar-benar dikerjakan; bangun-daftar-cek.cjs
// dan uji penjaga memeriksa bahwa kode muncul sebagai token utuh di berkas itu.
//
// "untuk": "semua" = berlaku bagi blangko jenis perkara apa pun, atau daftar kunci modul deteksi
// (cerai, itsbat-nikah, dispensasi-kawin, izin-poligami, waris, harta-bersama, perwalian, asal-usul,
// pengangkatan-anak, wali-adhol, hadhanah, lain-lain).
// "tingkat": "otomatis" = ditulis tanpa dicentang; "usulan" = diusulkan ragu/bergantung data (tidak menimpa isian tangan).

const KELOMPOK = [
  {
    id: "kuasa-penggugat",
    kode: ["8537", "8538", "8539", "0132", "0156", "0184"],
    untuk: "semua",
    berkas: "ekstensi-sipp/abt.js",
    sumber: "surat gugatan e-Court (kantor, alamat, advokat, tanggal surat kuasa) + SIPP perkara_pengacara (nomor/tanggal register)",
    tingkat: "otomatis",
    syarat: "perkara yang berkuasa hukum (pemicu 11111)",
  },
  {
    id: "alamat-putusan",
    kode: ["8548", "8549"],
    untuk: "semua",
    berkas: "aleta_bot/services/abtUsulanService.js",
    sumber: "SIPP perkara_pihak1/2.alamat (+ surel e-Court)",
    tingkat: "otomatis",
    syarat: "",
  },
  {
    id: "elitigasi",
    kode: ["7139"],
    untuk: "semua",
    berkas: "ekstensi-sipp/blangko-derry-isian.js",
    sumber: "kontak e-Court ALETA (surel Tergugat/kuasa) -> 1 e-litigasi penuh, 2 hybrid",
    tingkat: "otomatis",
    syarat: "perkara e-Court; data kontak cukup",
  },
  {
    id: "ktp-teks",
    kode: ["1214", "9955", "9957", "0378", "9958", "9956", "9911"],
    untuk: "semua",
    berkas: "ekstensi-sipp/abt.js",
    sumber: "berkas KTP e-Court (bagian tanggal KTP di kalimat alat bukti; hanya yang kosong)",
    tingkat: "otomatis",
    syarat: "perkara e-Court dengan KTP terbaca",
  },
  {
    id: "ktp-tanggal",
    kode: ["0364", "0365", "0366", "2222"],
    untuk: "semua",
    berkas: "ekstensi-sipp/abt.js",
    sumber: "berkas KTP e-Court (tanggal terbit KTP)",
    tingkat: "otomatis",
    syarat: "perkara e-Court dengan KTP terbaca",
  },
  {
    id: "gugatan-ecourt",
    kode: ["6055", "6054", "7120", "6071", "6072", "7778", "5110", "5111", "0007", "2004", "5227"],
    untuk: "semua",
    berkas: "ekstensi-sipp/abt.js",
    sumber: "surat gugatan e-Court (petitum accessoir, anak, alasan cerai)",
    tingkat: "usulan",
    syarat: "perkara e-Court; berkeyakinan ragu tidak menimpa isian tangan",
  },
  {
    // JJ 18 Okt 2026: jawab-menjawab TERTULIS (jawaban, replik, duplik, rereplik, kesimpulan) dari e-Court.
    id: "jawab-menjawab-ecourt",
    kode: ["9881", "7084", "8436", "8437", "9355", "9491", "9681"],
    untuk: "semua",
    berkas: "aleta_bot/services/jawabMenjawabEcourtService.js",
    sumber:
      "jawaban/replik/duplik/kesimpulan e-Court: jenis dikenali dari jenis+judul e-Court DAN isi surat (kop, salam, identitas, penutup dibuang); 9881 tertulis bila berkasnya ada; 7084 hanya bila jawaban jelas memuat gugatan balik; 8436/8437 klausa kesimpulan kedua pihak; 9355/9491/9681 pokok jawaban dan eksepsi",
    tingkat: "usulan",
    syarat: "perkara e-Court dengan berkas jawab-menjawab berlapis teks (OCR bila pindaian); semua usulan ragu dan tidak menimpa isian petugas, belum diukur atas berkas sungguhan (ukur di server)",
  },
  {
    // JJ2 18 Okt 2026 (keputusan 74): jawaban/replik/duplik tertulis yang RAPI ditulis otomatis ke tanya-jawab ABT per sidang.
    id: "tanya-jawab-jawab-menjawab",
    kode: ["6112", "6113", "6114", "2018", "2019", "2020"],
    untuk: "semua",
    berkas: "ekstensi-sipp/blangko-derry-isian.js",
    sumber:
      "jawaban/replik/duplik e-Court yang lolos ukuran rapi (aleta_bot/services/tanyaJawabEcourtService.js: struktur dalil, tanpa kop/tanda tangan/nomor halaman/karakter rusak, panjang wajar, bukan OCR, satu berkas per peran) ditulis ke penyunting tanya-jawab sidang yang agendanya sesuai",
    tingkat: "otomatis",
    sebagian: true,
    syarat:
      "hanya berkas rapi dan hanya bila baris tanya-jawab sidang itu masih kosong (baris yang ada tidak pernah ditimpa); saklar 'Tanya-jawab jawab-menjawab otomatis' bawaan menyala; yang tidak rapi tetap disalin dan diperiksa petugas",
  },
  {
    // JJ2 18 Okt 2026 (keputusan 75a): daftar bukti P.n / T.n dari berkas daftar bukti e-Court (usulan ragu).
    id: "bukti-daftar-ecourt",
    kode: ["9470", "9488", "9489", "9492", "9493", "9951", "9952"],
    untuk: "semua",
    berkas: "aleta_bot/services/buktiEcourtService.js",
    sumber:
      "daftar bukti Penggugat P.n dan Tergugat T.n yang diunggah ke e-Court (judul Daftar Bukti, atau diunggah sebagai Kesimpulan): nama, jenis, nomor, tanggal; surat -> 9470/9488/9492 (P) dan 9489/9493 (T), bukti elektronik -> 9951/9952",
    tingkat: "usulan",
    syarat: "perkara e-Court dengan berkas daftar bukti berlapis teks; semua usulan ragu dan tidak menimpa isian petugas, belum diukur atas berkas sungguhan (ukur di server)",
  },
  {
    // JJ2 18 Okt 2026 (keputusan 71): No./Tgl. Surat Keterangan KUA = bukti P.3 itsbat.
    id: "surat-keterangan-kua-itsbat",
    kode: ["0654", "0655"],
    untuk: "semua",
    berkas: "aleta_bot/services/buktiEcourtService.js",
    sumber: "posita gugatan e-Court (nomor dan tanggal surat keterangan KUA / nikah tidak tercatat), lalu daftar bukti, lalu isi berkas bukti (OCR paling ragu)",
    tingkat: "usulan",
    syarat: "itsbat nikah; usulan ragu sampai diukur atas berkas sungguhan; tidak terbaca -> dikosongkan untuk diisi manual",
  },
  {
    // OCR-ECOURT 19 Okt 2026: lampiran e-Court hasil pindai (Dokumen Bukti 96% pindaian) dibaca OCR di latar.
    id: "lampiran-ecourt-ocr",
    kode: ["0185", "0157", "8894", "8895", "5171", "5271", "0652", "0653", "1108", "0889", "9709", "5110"],
    untuk: "semua",
    berkas: "aleta_bot/services/lampiranEcourtService.js",
    sumber:
      "lampiran e-Court (Dokumen Bukti, surat kuasa, surat keterangan): halaman dikenali dari isinya (KK, akta kelahiran/kematian/nikah/cerai, surat keterangan desa/KUA, surat kuasa khusus/insidentil, slip gaji), medan diurai, dicocokkan ke pihak SIPP lewat NIK/nama (NIK tidak pernah ditampilkan atau disimpan); 0185/0157 surat kuasa Tergugat, 8894/8895 kuasa insidentil, 5171/5271 slip gaji, 0652/0653 penolakan KUA, 1108/0889 duplikat akta nikah, 9709 TTL anak (asal-usul), 5110 nama anak dari akta kelahiran; kalimat salin alat bukti (KK, akta, surat keterangan) untuk 1214/9958/0378/9955",
    tingkat: "usulan",
    syarat:
      "perkara e-Court yang lampirannya sudah dibaca penyapu latar (satu berkas per 3 menit); semua ragu (terukur di bawah ambang 95%/20 perkara - UKURAN-OCR-ECOURT.json) dan tidak menimpa isian petugas",
  },
  {
    // JJ2 18 Okt 2026 (keputusan 75b dan 75c).
    id: "jawaban-sita-hb-rekonvensi",
    kode: ["9164", "9283"],
    untuk: "semua",
    berkas: "aleta_bot/services/jawabKhususEcourtService.js",
    sumber: "jawaban Tergugat e-Court: dalil bersikap tentang sita (9164); daftar objek harta bersama di bagian rekonvensi (9283)",
    tingkat: "usulan",
    syarat: "jawaban tertulis berlapis teks; usulan ragu dan tidak menimpa isian petugas, belum diukur atas berkas sungguhan",
  },
  {
    id: "itsbat-pasangan-meninggal",
    kode: ["1025", "1246", "1247", "1509"],
    untuk: ["itsbat-nikah"],
    berkas: "aleta_bot/services/deteksi/itsbat.js",
    sumber: "posita itsbat kontensius (pasangan yang sudah meninggal: nama, tanggal, sebab, tempat)",
    tingkat: "usulan",
    syarat: "itsbat nikah kontensius (gugatan); modul itsbat memancarkannya walau tidak tercatat di registri variabel",
  },
  {
    id: "sipp-lanjutan-pasti",
    kode: ["8705", "8704"],
    untuk: "semua",
    berkas: "aleta_bot/services/abtIsianSippLanjutan.js",
    sumber: "SIPP perkara_mediasi (hasil Y1 = akta perdamaian: tanggal dan isi kesepakatan)",
    tingkat: "otomatis",
    syarat: "perkara yang hasil mediasinya Y1 (blangko akta perdamaian hanya dipakai pada perkara itu)",
  },
  {
    id: "sipp-mediasi-sebagian",
    kode: ["8899"],
    untuk: "semua",
    berkas: "aleta_bot/services/abtIsianSippLanjutan.js",
    sumber: "SIPP perkara_mediasi hasil S (berhasil sebagian): topik yang disebut isi kesepakatan",
    tingkat: "otomatis",
    syarat: "perkara yang hasil mediasinya S; topik dibaca dari kata kunci",
  },
  {
    id: "sipp-mediasi-cabut",
    kode: ["8433"],
    untuk: "semua",
    berkas: "aleta_bot/services/abtIsianSippLanjutan.js",
    sumber: "SIPP perkara_mediasi hasil Y2 (berhasil dengan pencabutan)",
    tingkat: "otomatis",
    sebagian: true,
    syarat: "hanya pencabutan karena mediasi Y2; alasan lain (perbaikan gugatan, alamat tidak ditemukan) diketik hakim",
  },
  {
    id: "sipp-lanjutan-ragu",
    kode: ["1183", "0303", "0185"],
    untuk: "semua",
    berkas: "aleta_bot/services/abtIsianSippLanjutan.js",
    sumber: "SIPP: sidang ikrar pertama + 6 bulan; tanggal pendaftaran itsbat; tanggal kuasa Tergugat",
    tingkat: "usulan",
    syarat: "usulan ragu (tidak tercentang sendiri, tidak menimpa isian petugas)",
  },
];

// Tanya jawab / keterangan saksi (kunci dari susun.ts kunciTanyaJawab) yang disusun "Susun keterangan saksi".
const TJ_DIDUKUNG = {
  berkas: "aleta_bot/services/abtUsulanService.js",
  kataBukti: "BATAS_SAKSI_SDG",
  kunci: ["saksi 1 p", "saksi 2 p", "saksi 3 p", "saksi 4 p", "saksi 5 p", "saksi 1 t", "saksi 2 t", "saksi 3 t", "saksi 4 t"],
  sumber: "keterangan saksi pada BAS/SIPP (disusun menjadi tanya-jawab)",
};

// Kode "F2.3" (aleta_bot/services/deteksi/blangkoDerry.js NAMA) -> jenis (modul) tempat diisi.
const F23 = {
  berkas: "aleta_bot/services/deteksi/blangkoDerry.js",
  peta: {
    "itsbat-nikah": ["1321", "1322", "1324", "1325", "1329", "1331"],
    "wali-adhol": ["9201", "9203", "9204", "9206"],
    "harta-bersama": ["9161", "9162", "9163"],
    waris: ["9161", "9162", "9163", "8719"],
  },
};

// Kode yang kodenya sendiri menyatakan TIDAK ADA sumber (komentar kode / registri `oleh: belum`).
// sumberMungkin = dari mana datanya kelak bila mau dibangun; "" = tidak ada.
const TANPA_SUMBER = {
  "0661": { sumberMungkin: "tidak ada", catatan: "Nomor SK prodeo tidak disimpan SIPP; ecourt_prodeo tidak memuat nomor penetapan. Terbukti di kode (abtUsulanService tidak_ada_sumber)." },
  "0663": { sumberMungkin: "tidak ada", catatan: "Tanggal penetapan prodeo tidak disimpan SIPP (hasil putusan sela/pertimbangan hakim)." },
  "0227": { sumberMungkin: "tidak ada", catatan: "Tanggal Tergugat berpindah agama/fasakh: SIPP tidak punya kolomnya." },
};

// Sumber data yang MUNGKIN bagi isian yang belum terisi (dipakai kolom "sumber yang mungkin" di daftar cek).
const KURASI = {
  "tj:jawaban lisan 0047": ["lisan: diketik panitera (tidak ada kolom terstruktur di SIPP). Tertulis: berkas jawaban e-Court yang rapi ditulis otomatis ke tanya-jawab sidang beragenda jawaban bila barisnya kosong; yang tidak rapi disalin petugas (kalimat salin 'jawab-tertulis-jawaban')", "Blangko putusan: 'COPY FILE JAWABAN APABILA TERTULIS' - JJ2: ditulis otomatis bila rapi; 9881 diisi 'tertulis' bila berkasnya ada."],
  "tj:replik lisan 0046": ["lisan: diketik panitera. Tertulis: replik e-Court yang rapi ditulis otomatis ke tanya-jawab sidang beragenda replik bila barisnya kosong; yang tidak rapi disalin (kalimat salin 'jawab-tertulis-replik')", ""],
  "tj:duplik lisan 0047": ["lisan: diketik panitera. Tertulis: duplik e-Court yang rapi ditulis otomatis ke tanya-jawab sidang beragenda duplik bila barisnya kosong; yang tidak rapi disalin (kalimat salin 'jawab-tertulis-duplik'); rereplik tidak punya kolom sendiri", ""],
  "0711": ["posita/petitum hadhanah (belum ada aturan)", "Hanya 1 blangko."],
  "9220": ["keterangan Termohon di sidang ikrar (BAS ikrar)", "Hanya 1 blangko."],
  "8617": ["tidak ada (penilaian hakim atas cacat formil)", ""],
  "9164": ["jawaban e-Court (dalil Tergugat tentang sita) - JJ2: diusulkan ragu; tanggapan yang hanya diucapkan di sidang insidentil diketik petugas", "JJ2 18 Okt: hanya dalil yang subjeknya Tergugat dan bersikap tegas; belum diukur atas berkas sungguhan."],
  "9165": ["tidak ada (hasil pemeriksaan setempat)", "Perkara kebendaan, sangat jarang."],
  "9166": ["tidak ada (hasil pemeriksaan setempat)", ""],
  "9167": ["tidak ada (hasil pemeriksaan setempat)", ""],
  "9168": ["tidak ada (hasil pemeriksaan setempat)", ""],
  "0889": ["posita itsbat (duplikat akta nikah; belum ada aturan)", "Jarang."],
  "1108": ["posita itsbat (duplikat akta nikah; belum ada aturan)", "Jarang."],
  "9283": ["jawaban/gugatan rekonvensi e-Court - JJ2: objek dari daftar bernomor sesudah kalimat 'harta bersama berupa' di bagian rekonvensi (usulan ragu)", "Harta bersama dengan rekonvensi, sangat jarang; belum diukur atas berkas sungguhan."],
  "9460": ["gugatan e-Court pencegahan perkawinan", "Jenis 342: 0 perkara sejak 2023 (2 sejak 2018); belum ada modul jenisnya."],
  "9461": ["gugatan e-Court pencegahan perkawinan", "Jenis 342 sangat jarang."],
  "9462": ["gugatan e-Court pencegahan perkawinan", "Jenis 342 sangat jarang."],
  "9469": ["tidak ada (fakta persidangan)", "Jenis 342 sangat jarang."],
  "0652": ["berkas e-Court (lampiran surat penolakan KUA; butuh baca dokumen)", "Dispensasi/wali adhal; belum dibaca OCR."],
  "0653": ["berkas e-Court (lampiran surat penolakan KUA; butuh baca dokumen)", "Dispensasi/wali adhal; belum dibaca OCR."],
  "9479": ["gugatan e-Court wasiat", "Jenis 365: 1 perkara sejak 2023."],
  "9486": ["gugatan e-Court wasiat", ""],
  "9487": ["gugatan e-Court wasiat", ""],
  "9485": ["tidak ada (penilaian hakim)", ""],
  "0185": ["SIPP perkara_pengacara.tanggal_kuasa pihak 2 (usulan ragu) / e-Court lampiran surat kuasa", "Kolom SIPP sering tanggal register, bukan tanggal surat kuasa; Tergugat berkuasa ±1% perkara (34 dari 3267 sejak 2023)."],
  "0157": ["e-Court (surat kuasa/jawaban Tergugat)", "Nama kantor advokat tidak disimpan SIPP; Tergugat berkuasa ±1% perkara."],
  "9110": ["e-Court (kartu advokat/berita acara sumpah)", "Tergugat berkuasa ±1% perkara; bawaan layar: Pengadilan Tinggi Sulawesi Tengah."],
  "8892": ["e-Court (kartu advokat/berita acara sumpah pada lampiran kuasa)", "Bawaan layar Perlu diisi: Pengadilan Tinggi Sulawesi Tengah; ABT mengisi bila dikosongkan pada sebagian blangko."],
  "8894": ["SIPP perkara_jadwal_sidang.keterangan / penetapan izin kuasa insidentil (tidak terstruktur)", "Kuasa insidentil tidak punya kolom sendiri di SIPP; ±jarang."],
  "8895": ["tidak ada terstruktur (penetapan izin Ketua)", "Hubungan penerima kuasa dengan pemberi kuasa."],
  "8896": ["tidak ada terstruktur (penetapan izin Ketua)", "Nomor izin Ketua Pengadilan."],
  "0182": ["tidak ada terstruktur (penetapan izin Ketua)", ""],
  "0183": ["tidak ada terstruktur (penetapan izin Ketua)", ""],
  "9120": ["penilaian hakim", ""],
  "9123": ["penilaian hakim", ""],
  "9125": ["penilaian hakim", ""],
  "2557": ["keterangan saksi pada BAS (teks bebas)", "Registri cerai: belum - tidak tertulis di posita."],
  "2558": ["keterangan saksi pada BAS (teks bebas)", "Registri cerai: belum - tidak tertulis di posita."],
  "8564": ["ALETA panggilan ghaib / pengumuman (belum tercatat terstruktur)", "Tanggal pengumuman ghaib pertama dan kedua."],
  "0670": ["ALETA panggilan ghaib / pengumuman", ""],
  "0303": ["ALETA panggilan ghaib / pengumuman", ""],
  "8536": ["tidak ada (putusan pidana Tergugat diketahui dari bukti surat)", "Alasan C; ±jarang."],
  "7178": ["relaas panggilan (ALETA relaas) - penilaian hakim", ""],
  "8433": ["hakim mengetik (usulan hanya bila mediasi Y2)", "Sejak 2023: 41 isian petugas, hanya 4 berasal dari mediasi Y2; alasan lain (perbaikan gugatan, alamat tidak ditemukan) bebas."],
  "5171": ["berkas e-Court (gugatan: penghasilan)", ""],
  "5271": ["berkas e-Court (gugatan: penghasilan)", ""],
  "9050": ["berkas e-Court (petitum kenaikan nafkah anak)", ""],
  "8712": ["ALETA Kasir (teguran panjar) - belum dicatat terstruktur", ""],
  "8713": ["ALETA Kasir (teguran panjar) - belum dicatat terstruktur", ""],
  "8714": ["ALETA Kasir (laporan panjar) - belum dicatat terstruktur", ""],
  "1183": ["SIPP perkara_ikrar_talak.tanggal_sidang_pertama + 6 bulan (usulan ragu)", "Cocok persis dengan 7 dari 11 isian petugas; sisanya sidang ikrar pertama diundur."],
  "1081": ["SIPP perkara_ikrar_talak (tanggal PHS baru)", "Hanya 1 blangko."],
  "1154": ["ALETA/SIPP bantuan panggilan", "Hanya 1 blangko."],
  "1232": ["ALETA/SIPP bantuan panggilan", "Hanya 1 blangko."],
  "5230": ["ALETA Kasir (ongkos panggilan)", "Hanya 1 blangko."],
  "0303": ["tidak ada tanggal pasti di SIPP; usulan ragu = tanggal pendaftaran", "409 isian petugas (voluntair dan kontensius): 186 persis sama (45%), 92% jatuh 0-1 hari dari tanggal pendaftaran; juru sita memilih hari pengumuman."],
  "9134": ["belum dikaji", "Isian blangko BAS permohonan."],
  "8603": ["posita (modul asal-usul/hadhanah ada); modul cerai-kumulasi belum", ""],
  "9347": ["e-Court (surat kuasa/anggaran dasar badan hukum)", "Hanya perkara ekonomi syariah badan hukum."],
  "9348": ["e-Court (surat kuasa/anggaran dasar badan hukum)", "Hanya perkara ekonomi syariah badan hukum."],
  "1513": ["posita/bukti (akta kematian)", "Itsbat dengan suami meninggal."],
  "1514": ["posita/bukti (akta kematian)", ""],
  "1515": ["posita/bukti (akta kematian)", ""],
  // 18 Okt (paket i26 blangko jarang): PAW susunan lengkap [01c], DK ditolak alasan lain [03b]/[03c], cerai kumulasi itsbat ditolak [03b].
  "9762": ["bukti dan posita permohonan (susunan keluarga Pewaris; belum ada aturan baca - isian manual menang atas data keluarga yang dimiliki ALETA)", "PAW lanjutan: ahli waris pengganti harus berpasangan dengan cucu Pewaris (9763); sangat jarang."],
  "9763": ["bukti dan posita permohonan (susunan keluarga Pewaris; belum ada aturan baca)", "Berpasangan dengan 9762; sangat jarang."],
  "9764": ["bukti dan posita permohonan (susunan keluarga Pewaris; belum ada aturan baca)", "Kakek Pewaris; sangat jarang."],
  "9765": ["bukti dan posita permohonan (susunan keluarga Pewaris; belum ada aturan baca)", "Nenek dari pihak ibu; sangat jarang."],
  "9766": ["bukti dan posita permohonan (susunan keluarga Pewaris; belum ada aturan baca)", "Nenek dari pihak ayah; sangat jarang."],
  "9767": ["bukti dan posita permohonan (susunan keluarga Pewaris; belum ada aturan baca)", "Saudara seibu Pewaris; sangat jarang."],
  "9771": ["posita permohonan dispensasi (alasan mendesak yang dikemukakan Pemohon; belum ada aturan baca)", "Dispensasi kawin ditolak dengan alasan selain kehamilan atau pacaran; jarang."],
  "9772": ["tidak ada (penilaian hakim atas rukun atau syarat nikah yang tidak terbukti)", "Cerai kumulasi itsbat yang itsbatnya ditolak; sangat jarang."],
  // 18 Okt (paket i28 hibah 366, wakaf 367, penetapan mafqud 369 Pdt.P): belum ada aturan baca; sumbernya gugatan / permohonan e-Court (posita, petitum) dan bukti.
  "9790": ["petitum gugatan hibah (huruf pokok tuntutan A-G; belum ada aturan baca - pilih manual)", "Hibah: 0 perkara SIPP sejak 2023."],
  "9793": ["posita gugatan hibah (nama penghibah; belum ada aturan baca)", "Hibah: 0 perkara SIPP sejak 2023."],
  "9794": ["posita gugatan hibah (bentuk dan tanggal hibah; belum ada aturan baca)", ""],
  "9795": ["posita / petitum gugatan hibah (objek hibah: letak, luas, batas; belum ada aturan baca)", ""],
  "9820": ["petitum gugatan wakaf (huruf pokok tuntutan A-F; belum ada aturan baca - pilih manual)", "Wakaf: 0 perkara SIPP sejak 2023."],
  "9823": ["posita gugatan wakaf (nama Wakif; belum ada aturan baca)", "Wakaf: 0 perkara SIPP sejak 2023."],
  "9824": ["posita gugatan wakaf (nama Nazhir; belum ada aturan baca)", ""],
  "9825": ["posita gugatan wakaf (akta ikrar wakaf: nomor dan tanggal; belum ada aturan baca)", ""],
  "9826": ["posita / petitum gugatan wakaf (harta benda wakaf: letak, luas, batas; belum ada aturan baca)", ""],
  "9827": ["posita gugatan wakaf (peruntukan wakaf; belum ada aturan baca)", ""],
  "9860": ["identitas dan posita permohonan mafqud (nama orang yang hilang; belum ada aturan baca)", "Mafqud tidak punya jenis SIPP sendiri (369 Lain-Lain Pdt.P)."],
  "9861": ["posita permohonan mafqud (kedudukan Pemohon; belum ada aturan baca)", ""],
  "9862": ["posita permohonan mafqud (waktu dan tempat kepergian; belum ada aturan baca)", ""],
  "9863": ["posita permohonan mafqud (upaya pencarian; belum ada aturan baca)", ""],
  "9864": ["posita permohonan mafqud (lama tidak ada kabar; belum ada aturan baca)", ""],
  "9865": ["posita permohonan mafqud (huruf kepentingan Pemohon A-C; belum ada aturan baca - pilih manual)", ""],
  "9868": ["relaas / catatan pengumuman Panitera (cara dan jangka pengumuman; belum tercatat terstruktur)", "Bawaan papan pengumuman 14 hari."],
  "9869": ["catatan Panitera (hasil pengumuman; belum tercatat terstruktur)", "Bawaan: tidak ada yang memberi kabar."],
  "9875": ["tidak ada (opsional: tanggal berlaku mati secara hukum; kosong = sejak penetapan diucapkan)", ""],
};
const POLA_HAKIM = /pertimbangan|penilaian|fakta|kesimpulan|pokok|alasan (permohonan|pembatalan|pencegahan)|keadaan pengasuhan|mengapa|klausula|pihak yang menanggung|jumlah kewajiban|pilihan anak|kesepakatan|perdamaian/i;
const POLA_BUKTI = /alat bukti|bukti (surat|elektronik)|nomor|tanggal surat/i;

function SUMBER_MUNGKIN(r) {
  if (r.cadangan === "titik" && r.status !== "ya") return { sumberMungkin: "opsional: bila dikosongkan ABT mencetak titik-titik/bawaan; isi hanya bila hakim ingin", catatan: (KURASI[r.kode[0]] || [])[0] || "" };
  if (r.kunci && KURASI[r.kunci]) return { sumberMungkin: KURASI[r.kunci][0], catatan: KURASI[r.kunci][1] };
  for (const k of r.kode) if (KURASI[k]) return { sumberMungkin: KURASI[k][0], catatan: KURASI[k][1] };
  if (r.status === "sebagian") {
    const tak = (r.folderTakTertutup || []).slice(0, 3).join("; ");
    return {
      sumberMungkin: tak ? `terisi di jenis utama; belum di: ${tak}` : "baru diusulkan (ragu), belum terisi otomatis",
      catatan: "",
    };
  }
  const nama = `${r.nama} ${r.namaAsli}`;
  if (r.status === "ya") return { sumberMungkin: "", catatan: "" };
  if (r.cadangan === "titik") return { sumberMungkin: "opsional: bila dikosongkan ABT mencetak titik-titik/bawaan; isi hanya bila hakim ingin", catatan: "" };
  if (POLA_HAKIM.test(nama)) return { sumberMungkin: "tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak)", catatan: "" };
  if (POLA_BUKTI.test(nama)) return { sumberMungkin: "berkas e-Court (lampiran bukti; butuh baca dokumen)", catatan: "" };
  return { sumberMungkin: "belum dikaji", catatan: "" };
}

// Catatan tambahan yang selalu ditempel pada baris isian (apa pun statusnya).
const CATATAN = {
  "5197": "Pada blangko cerai isian ini hanya terbaca lewat variabel 7184 (kumulasi itsbat, bersyarat jenis perkara 360); pada cerai biasa tidak tercetak.",
  "5178": "Pada blangko cerai isian ini hanya terbaca lewat variabel 7184 (kumulasi itsbat, bersyarat jenis perkara 360); pada cerai biasa tidak tercetak.",
};

module.exports = { KELOMPOK, TJ_DIDUKUNG, F23, TANPA_SUMBER, SUMBER_MUNGKIN, CATATAN };
