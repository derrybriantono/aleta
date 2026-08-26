// requiring dependencies
const moment = require("moment");
moment.locale('en');
const axios = require("axios").default;
const fs = require("fs");
const path = require("path");
const { MessageMedia } = require("whatsapp-web.js");
const db = require("./db_config");
const db4 = require("./db_config4");
const mis = require("./mis");
const notification = require("./notifikasi");
const absen = require("./absen");
const pengumuman = require("./pengumuman");
const antrianOnlineService = require("./services/antrianOnlineService");
const dynamicQueryCommandService = require("./services/dynamicQueryCommandService");
const { guardCaseCommandAccess } = require("./services/publicQaVerificationService");
const sidangAgendaService = require("./services/sidangAgendaService");

const CASE_LEGACY_COMMANDS_REQUIRING_ACCESS = new Set([
  "jadwal",
  "status",
  "biaya",
  "akta",
  "pesan akta",
  "putusan",
  "saksi",
]);

function createLocalMediaIfExists(filePath, filename) {
  const resolvedPath = path.resolve(__dirname, filePath);
  if (!fs.existsSync(resolvedPath)) {
    return null;
  }

  const media = MessageMedia.fromFilePath(resolvedPath);
  if (filename) media.filename = filename;
  return media;
}

//pool on connect
db.on("connection", (connection) => console.log("CONNECTION USING POOL"));
db4.on("connection", (connection) => console.log("CONNECTION USING POOL"));

// inisiasi pesan masuk
const getData = async (message, context = {}) => {
  try {
    const dynamicResponse = await dynamicQueryCommandService.resolveDynamicQueryCommand(message, context);
    if (dynamicResponse) return dynamicResponse;
  } catch (error) {
    console.error("[ALETA Bot] Query dinamis gagal, lanjut ke handler legacy:", error.message);
  }

  let keyword = String(message || "").split("#");
  keyword[0] = String(keyword[0] || "").trim().toLowerCase();
  if (CASE_LEGACY_COMMANDS_REQUIRING_ACCESS.has(keyword[0]) && keyword.length > 1) {
    const access = await guardCaseCommandAccess({
      senderNumber: context.senderNumber || "",
      command: keyword[0],
      nomorPerkara: keyword.slice(1).join("#"),
    });
    if (!access.allowed) {
      return access.fallbackMessage || "Untuk keamanan data perkara, nomor WhatsApp ini belum dapat diverifikasi.";
    }
  }
  let pengadilan = "Pengadilan Agama Donggala";
  let web = "https://pa-donggala.go.id";
  return new Promise((resolve, reject) => {
    // mulai logic pesan
    if (keyword.length > 0 && (keyword[0] == "halo" || keyword[0] == "hallo" || keyword[0] == "hai" || keyword[0] == "hei" || keyword[0] == "assalamualaikum" || keyword[0] == "aslmkm" || keyword[0] == "ass")) {
      let responseMessage = `*_Assalamu’alaikum Warahmatullahi Wabarakatuh_*
      
      Perkenalkan saya Aleta, Bot AI ${pengadilan} yang akan memandu Bapak/Ibu untuk mendapatkan informasi yang bisa di akses secara _Real Time_. Silahkan balas pesan ini dengan mengetik :

      *DAFTAR*
      _Untuk mengetahui cara dan syarat daftar perkara sesuai dengan jenis perkara (Ketik "daftar" tanpa tanda kutip)_

      *ECOURT*
      _Untuk mendaftar, membayar dan bersidang perkara secara online_

      *PERKARA*
      _Untuk mengetahui status perkara (detail biaya perkara, jadwal sidang, putusan, akta cerai) (Ketik "perkara" tanpa tanda kutip)_
      
      *BOT*
      _Layanan Posbakum Online dengan bantuan AI Google (Gemini) yang akan membantu untuk menjawab seluruh masalah hukum anda (Tidak termasuk informasi mengenai biaya perkara dan keadaan perkara yang berjalan di *${pengadilan}*) (contoh ketik : "bot#ajukan pertanyaan hukum anda" tanpa tanda kutip)_

      *Untuk informasi yang lengkap silahkan ketik _info lengkap_ dan apabila ingin menghubungi petugas kami silahkan hubungi di nomor WA : *0822-7111-5021*`;

      resolve(responseMessage);
    } else if (keyword[0] == "info lengkap") {
      let responseMessage = `Silahkan ketik opsi sesuai dengan yang dibutuhkan (tanpa ketik "-") :
      *- ALAMAT*
      _Untuk mengetahui alamat dan Kontak ${pengadilan}_

      *- PERKARA*
      _Untuk salinan putusan (bukan salinan resmi), detail biaya perkara, status perkara, informasi jadwal sidang pada *${pengadilan}*_

      *- LAYANAN*
      _Untuk informasi Pelayanan Terpadu Satu Pintu pada *${pengadilan}*_

      *- BAPANJAR*
      _Layanan pangkas jarak pelayanan *${pengadilan}* untuk para pihak di Morowali Utara_

      *- ECOURT*
      _Untuk informasi berperkara secara elektronik _E-Court_ pada *${pengadilan}*_

      *- VALIDASI*
      _Untuk memvalidasi atau memeriksa keaslian akta cerai yang telah diterbitkan oleh *${pengadilan}*_

      *- INFORMASI*
      _Untuk informasi mengenai informasi secara detail pada *${pengadilan}*_

      *- PENGADUAN*
      _Untuk informasi mengenai tata cara pengaduan pada *${pengadilan}*_

      *- SURVEI*
      _Untuk informasi mengenai survei elektronik pada *${pengadilan}*_

      *- SIDANG HARI INI*
      _Untuk informasi jadwal sidang pada hari yang bersangkutan_

      *- SIDANG TANGGAL*
      _Untuk informasi jadwal sidang pada tanggal tertentu (contoh : sidang tanggal#20-12-2021)_

      *- STATISTIK*
      _Untuk informasi statistik perkara pada ${pengadilan} (contoh : statistik#2021) dan untuk statistik detail tiap perkara ${pengadilan} (contoh : statistik detail#2021)_

      *- COVID*
      _Untuk informasi Covid di Indonesia_
      
      *- BOT*
      _Layanan Posbakum Online dengan bantuan AI Google (Gemini) yang akan membantu untuk menjawab seluruh masalah hukum anda (Tidak termasuk informasi mengenai biaya perkara dan keadaan perkara yang berjalan di *${pengadilan})`;
      resolve(responseMessage);
    } else if (keyword[0] == "validasi") {
      let responseMessage = `*PENGADILAN AGAMA DONGGALA*
      Silahkan Klik Link berikut kemudian scan QR Code yang terdapat di akta cerai tersebut : https://covid-ac.pa-probolinggo.go.id/validasi-ac/`;
      resolve(responseMessage);
    } else if (keyword[0] == "akta_cerai") {
      let responseMessage = `Persyaratan pengambilan akta cerai adalah :
      1. KTP Asli dan Fotokopi 
      2. Menginformasikan nomor perkara, Tanggal Pengambilan dan jam pengambilan _Contoh : 123/Pdt.G/2021/PA.Dgl diambil tanggal 04 Januari 2022 Jam 09.00 WITA_ 
      3. Membayar PNBP sebesar Rp.10.000,- (sepuluh ribu rupiah) 
      4. Silahkan mengirim pesan whatsapp pemesanan ke nomor ini 0822-7111-5021

      Untuk mengetahui status akta cerai silahkan ketikkan : 
      *akta#nomor perkara*. _Contoh : akta#123.G.2021_`;

      resolve(responseMessage);
    } else if (keyword[0] == "alamat") {
      let responseMessage = `*PENGADILAN AGAMA DONGGALA*
      *Alamat* : Jalan Vatu Bala, Kabonga Kecil, Kecamatan Banawa, Kabupaten Donggala, Sulawesi Tengah, 94351 
      *Whatsapp* : 0822-7111-5021
      *Website* : https://www.pa-donggala.go.id/
      *Email* : padonggala@yahoo.co.id / pa.donggala@yahoo.co.id
      *Facebook* : https://www.facebook.com/pengadilanagamadonggala/
      *Instagram* : http://instagram.com/pa_donggala/
      *Twitter/X* : https://x.com/pa_donggala
      *Youtube* :https://www.youtube.com/channel/UCwgWuT8iNhK7v4jm-FLdl2A
      *Lokasi* : https://s.id/NRE6K
      
      Untuk mengetahui wewenang ${pengadilan} silahkan ketik "wewenang" tanpa tanda kutip`;

      resolve(responseMessage);
    } else if (keyword[0] == "wewenang") {
      let responseMessage = `Kewenangan ${pengadilan} saat ini :
- Pasal 49 Undang-undang Nomor 3 Tahun 2006: Pengadilan Agama bertugas dan berwenang memeriksa, memutus dan menyelesaikan perkara di tingkat pertama antara orang-orang yang beragama Islam di bidang:

  1. Perkawinan;
  2. Waris;
  3. Wasiat;
  4. Hibah;
  5. Wakaf;
  6. Zakat;
  7. Infaq;
  8. Shadaqah; dan
  9. Ekonomi Syari’ah.

- Penjelasan Pasal 49 Undang-Undang Nomor 3 Tahun 2006:
  Penyelesaian sengketa tidak hanya dibatasi di bidang perbankan syari’ah, melainkan juga di bidang ekonomi syari’ah lainnya.

  Yang dimaksud dengan “antara orang-orang yang beragama Islam” adalah termasuk orang atau badan hukum yang dengan sendirinya menundukkan diri dengan sukarela kepada hukum Islam mengenai hal-hal yang menjadi kewenangan Peradilan Agama sesuai dengan ketentuan Pasal ini.

  - Huruf (a)
  Yang dimaksud dengan “perkawinan” adalah hal-hal yang diatur dalam atau berdasarkan undang-undang mengenai perkawinan yang berlaku yang dilakukan menurut syari’ah, antara lain:

  1. izin beristri lebih dari seorang;
  2. izin melangsungkan perkawinan bagi orang yang belum berusia 21 (dua puluh satu) tahun, dalam hal orang tua wali, atau keluarga dalam garis lurus ada perbedaan pendapat;
  3. dispensasi kawin;
  4. pencegahan perkawinan;
  5. penolakan perkawinan oleh Pegawai Pencatat Nikah;
  6. pembatalan perkawinan;
  7. gugatan kelalaian atas kewajiban suami dan istri;
  8. perceraian karena talak;
  9. gugatan perceraian;
  10. penyelesaian harta bersama;
  11.penguasaan anak-anak;
  12. ibu dapat memikul biaya pemeliharaan dan pendidikan anak bilamana bapak yang seharusnya bertanggungjawab tidak mematuhinya;
  13. penentuan kewajiban memberi biaya penghidupan oleh suami kepada bekas istri atau penentuan suatu kewajiban bagi bekas istri;
  14. putusan tentang sah tidaknya seorang anak;
  15. putusan tentang pencabutan kekuasaan orang tua;
  16. pencabutan kekuasaan wali;
  17. penunjukan orang lain sebagai wali oleh pengadilan dalam hal kekuasaan seorang wali dicabut;
  penunjukan seorang wali dalam hal seorang anak yang belum cukup umur 18 (delapan belas) tahun yang ditinggal kedua orang tuanya;
  18. pembebanan kewajiban ganti kerugian atas harta benda anak yang ada di bawah kekuasaannya;
  19. penetapan asal-usul seorang anak dan penetapan pengangkatan anak berdasarkan hukum Islam;
  20. putusan tentang hal penolakan pemberian keterangan untuk melakukan perkawinan campuran;
  21. pernyataan tentang sahnya perkawinan yang terjadi sebelum Undang-undang Nomor 1 Tahun 1974 tentang Perkawinan dan dijalankan menurut peraturan yang lain.
  
  - Huruf (b)
  Yang dimaksud dengan “waris” adalah penentuan siapa yang menjadi ahli waris, penentuan mengenai harta peninggalan, penentuan bagian masing-masing ahli waris, dan melaksanakan pembagian harta peninggalan tersebut, serta penetapan pengadilan atas permohonan seseorang tentang penentuan siapa yang menjadi ahli waris, penentuan bagian masing-masing ahli waris.

  - Huruf (c)
  Yang dimaksud dengan “wasiat” adalah perbuatan seseorang memberikan suatu benda atau manfaat kepada orang lain atau lembaga/badan hukum, yang berlaku setelah yang memberi tersebut meninggal dunia.

  - Huruf (d)
  Yang dimaksud dengan “hibah” adalah pemberian suatu benda secara sukarela dan tanpa imbalan dari seseorang atau badan hukum kepada orang lain atau badan hukum untuk dimiliki.

  - Huruf (e)
  Yang dimaksud dengan “wakaf” adalah perbuatan seseorang atau sekelompok orang (wakif) untuk memisahkan dan/atau menyerahkan sebagian harta benda miliknya untuk dimanfaatkan selamanya atau untuk jangka waktu tertentu sesuai dengan kepentingannya guna keperluan ibadah dan/atau kesejahteraan umum menurut syari’ah.

  - Huruf (f)
  Yang dimaksud dengan “zakat” adalah harta yang wajib disisihkan oleh seorang muslim atau badan hukum yang dimiliki oleh orang muslim sesuai dengan ketentuan syari’ah untuk diberikan kepada yang berhak menerimanya.

  - Huruf (g)
  Yang dimaksud dengan “infaq” adalah perbuatan seseorang memberikan sesuatu kepada orang lain guna menutupi kebutuhan, baik berupa makanan, minuman, mendermakan, memberikan rezeki (karunia), atau menafkahkan sesuatu kepada orang lain berdasarkan rasa ikhlas, dan karena Allah Subhanahu wa ta’ala.

  - Huruf (h)
  Yang dimaksud dengan “shadaqah” adalah perbuatan seseorang memberikan sesuatu kepada orang lain atau lembaga/badan hukum secara spontan dan sukarela tanpa dibatasi oleh waktu dan jumlah tertentu dengan mengharap ridha Allah Subhanahu wa ta’ala dan pahala semata.

  - Huruf (i)
  Yang dimaksud dengan “ekonomi syari’ah” adalah perbuatan atau kegiatan usaha yang dilaksanakan menurut prinsip syari’ah, antara lain meliputi:

  1. bank syari’ah;
  2. lembaga keuangan mikro syari’ah;
  3. asuransi syari’ah;
  4. reasuransi syari’ah;
  5. reksa dana syari’ah;
  6. obligasi syari’ah dan surat berharga berjangka menengah syari’ah;
  7. sekuritas syari’ah;
  8. pembiayaan syari’ah;
  9. pegadaian syari’ah;
  10. dana pensiun lembaga keuangan syari’ah; dan
  11. bisnis syari’ah.

- Pasal 50 Undang-undang Nomor 3 Tahun 2006
  Dalam hal terjadi sengketa hak milik atau sengketa lain dalam perkara sebagaimana dimaksud dalam Pasal 49, khusus mengenai objek sengketa tersebut harus diputus lebih dahulu oleh pengadilan dalam lingkungan Peradilan Umum.

  Apabila terjadi sengketa hak milik sebagaimana dimaksud pada ayat (1) yang subjek hukumnya antara orang-orang yang beragama Islam, objek sengketa tersebut diputus oleh Pengadilan Agama bersama-sama perkara sebagaimana dimaksud dalam Pasal 49.

- Pasal 52 A, berbunyi sebagai berikut:
  Pengadilan Agama memberikan itsbat kesaksian rukyat hilal dalam penentuan awal bulan pada tahun Hijriyah.
  Penjelasan Pasal 50 ayat (2) Undang-undang Nomor 3 Tahun 2006:

  Ketentuan ini memberi wewenang kepada Pengadilan Agama untuk sekaligus memutuskan sengketa milik atau keperdataan lain yang terkait dengan objek sengketa yang diatur dalam Pasal 49 apabila subjek sengketa antara orang-orang yang beragama Islam.

  Hal ini menghindari upaya memperlambat atau mengulur waktu penyelesaian sengketa karena alasan adanya sengketa milik atau keperdataan lainnya tersebut sering dibuat oleh pihak yang merasa dirugikan dengan adanya gugatan di Pengadilan Agama.

  Sebaliknya apabila subjek yang mengajukan sengketa hak milik atau keperdataan lain tersebut bukan yang menjadi subjek bersengketa di Pengadilan Agama, sengketa di Pengadilan Agama ditunda untuk menunggu putusan gugatan yang diajukan ke Pengadilan di lingkungan Peradilan Umum.

  Penangguhan dimaksud hanya dilakukan jika pihak yang berkeberatan telah mengajukan bukti ke Pengadilan Agama bahwa telah didaftarkan gugatan di Pengadilan Negeri terhadap objek sengketa yang sama dengan sengketa di Pengadilan Agama.

  Dalam hal objek sengketa lebih dari dan yang tidak terkait dengan objek sengketa yang diajukan keberatannya, Pengadilan Agama tidak perlu menangguhkan putusannya, terhadap objek sengketa yang tidak terkait dimaksud.

- Pasal 52 A Undang-undang Nomor 3 Tahun 2006:
  Selama ini Pengadilan Agama diminta oleh Menteri Agama untuk memberikan penetapan (itsbat) terhadap kesaksian orang yang telah melihat atau menyaksikan hilal bulan pada setiap memasuki bulan Ramadhan dan awal bulan Syawal tahun Hijriyah dalam rangka Menteri Agama mengeluarkan penetapan secara nasional untuk penetapan 1 (satu) Ramadhan dan 1 (satu) Syawal.

  Pengadilan Agama dapat memberikan keterangan atau nasehat mengenai perbedaan penentuan arah Kiblat dan penentuan waktu shalat.`;

      resolve(responseMessage);
    } else if (keyword[0] == "layanan") {
      let responseMessage = `Silahkan balas pesan ini dengan mengetikkan layanan yang anda inginkan :      
      *- Perdata*
      *- Jinayah*
      *- Hukum*
      *- Gugatan_mandiri*
      *- Daftar*`;

      resolve(responseMessage);
    } else if (keyword[0] == "pidana") {
      let responseMessage = `Silahkan ketik layanan pidana yang anda inginkan :
      *- Pelimpahan_biasa*
      *- Pelimpahan_tipiring*
      *- Perpanjangan_penahanan*
      *- Penetapan_diversi*
      *- sita_geledah*`;

      resolve(responseMessage);
    } else if (keyword[0] == "jinayah") {
      let responseMessage = `Silahkan ketik layanan pidana yang anda inginkan :
      *- Jarimah*
      *- Pelimpahan_biasa*
      *- Pelimpahan_tipiring*
      *- Perpanjangan_penahanan*
      *- Penetapan_diversi*
      *- sita_geledah*`;

      resolve(responseMessage);
    } else if (keyword[0] == "jarimah") {
      let responseMessage = `Perkara pidana jarimah (Khusus Daerah Nanggroe Aceh Darussalam) yang menjadi wewenang Mahkamah Syar'iyah adalah :
      1. Khamar (minuman yang memabukkan)
      2. Maisir (Judi)
      3. Khalwat (berdua-duaan dengan lawan jenis yang bukan mahram di tempat tertutup) 
      4. Ikhtilath (bercampur baur/bermesraan dengan lawan jenis yang bukan mahram baik di tempat terbuka atau tertutup)
      5. Zina
      6. Pelecehan seksual
      7. Pemerkosaan
      8. Qadzaf (menuduh orang berzina)
      9. Liwath (Homoseksual)
      10.Musahaqah (Lesbian)
      10.Jaminan Produk Halal
      11.Pembinaan dan Perlindungan Aqidah`;

      resolve(responseMessage);
    } else if (keyword[0] == "pelimpahan_biasa") {
      let responseMessage = `Persyaratan pelimpahan berkas perkara pidana biasa adalah :
      1. Surat Pengantar
      2. Berkas Perkara Penyidik
      3. Surat Dakwaan/Soft Copy Dakwaan 
      4. Penetapan Penahanan
      5. Barang Bukti beserta Surat Pelimpahan Barang Bukti dan  Soft Copy`;

      resolve(responseMessage);
    } else if (keyword[0] == "pelimpahan_tipiring") {
      let responseMessage = `Persyaratan pelimpahan berkas perkara pidana biasa adalah :
      1. Surat Pengantar
      2. Berkas Perkara Penyidik
      3. Surat Dakwaan/Soft Copy Dakwaan 
      4. Barang Bukti
      5. Saat persidangan menghadirkan minimal satu orang saksi`;

      resolve(responseMessage);
    } else if (keyword[0] == "perpanjangan_penahanan") {
      let responseMessage = `Persyaratan permohonan perpanjangan penahanan adalah :
      1. Surat Permohonan
      2. Surat Perintah Penahanan
      3. Berita Acara Penahanan 
      4. Surat perpanjangan penahanan dari Kejaksaan`;

      resolve(responseMessage);
    } else if (keyword[0] == "penetapan_diversi") {
      let responseMessage = `Persyaratan permohonan penetapan diversi adalah :
      1. Surat Permohonan
      2. Laporan Polisis
      3. Kesepakatan Diversi 
      4. Berita Acara
      5. Surat Perintah dimulainya penyidikan
      6. Surat Perintah Penyidikan
      7. Surat Tanda Terima
      8. Resume`;

      resolve(responseMessage);
    } else if (keyword[0] == "sita_geledah") {
      let responseMessage = `Persyaratan permohonan penetapan peyitaan/penggeledahan adalah :
      1. Surat Pengantar
      2. Surat Laporan Polisis
      3. Surat Perintah Penyitaan/Penggeledahan 
      4. Berita Acara Penyitaan atau Penggeledahan
      5. Surat Perintah dimulainya penyidikan
      6. Surat Perintah Penyidikan
      7. Surat Tanda Penyitaan/Penggeledahan
      8. Soft Copy BB`;

      resolve(responseMessage);
    } else if (keyword[0] == "hukum") {
      let responseMessage = `Silahkan ketik layanan hukum yang anda inginkan :
      *- Badan_hukum*
      *- Surat_kuasa*
      *- Waarmeking*
      *- Kuasa_insidentil*
      *- Ijin_penelitian*
      *- Mediator*
      *- Surat_keterangan*
      *- Legalisir*
      *- Salinan_putusan*
      *- Salinan_penetapan*
      *- Informasi*
      *- Pengaduan*`;

      resolve(responseMessage);
    } else if (keyword[0] == "badan_hukum") {
      let responseMessage = `Persyaratan permohonan pendaftaran badan hukum adalah :
      1. Asli dan fotokopi akta pendirian badan hukum
      2. Fotokopi NPWP badan hukum
      3. Fotokopi KTP Pengurus 
      4. Materai Rp.10.000,-`;

      resolve(responseMessage);
    } else if (keyword[0] == "surat_kuasa") {
      let responseMessage = `Persyaratan  pendaftaran surat kuasa khusus adalah :
      1. Asli dan salinan surat kuasa khusus
      2. Fotokopi kartu advokat
      3. Fotokopi berita acara sumpah advokat 
      4. Fotokopi KTP,-
      5. Materai Rp.10.000,-`;

      resolve(responseMessage);
    } else if (keyword[0] == "waarmeking") {
      let responseMessage = `Persyaratan  permohonan legalisasi akta dibawah tangan/waarmeking adalah : 
      1. Surat permohonan 
      2.Fotokopi masing-masing ahli waris 
      3. Fotokopi Kartu Keluarga  
      4. Fotokopi buku tabungan atau objek waarmeking 
      5. Surat Keterangan Waris 
      6. Fotocopy Akta/Surat keterangan Kematian  
      7. Fotokopi akta kelahiran masing-masing ahli waris 
      8. Materai Rp.10.000,-`;

      resolve(responseMessage);
    } else if (keyword[0] == "kuasa_insidentil") {
      let responseMessage = `Persyaratan  permohonan ijin kuasa insidentil adalah :
      1. Surat permohonan
      2. Surat Keterangan Kepala Desa
      3. Fotocopy KTP pemberi kuasa
      4. Fotokopi KTP penerima kuasa
      5. Materai Rp.10.000,-`;

      resolve(responseMessage);
    } else if (keyword[0] == "ijin_penelitian") {
      let responseMessage = `Persyaratan  permohonan ijin penelitian adalah :
      1. Surat permohonan
      2. Fotocopy KTP
      3. Surat pengantar universitas/instansi
      4. Proposal`;

      resolve(responseMessage);
    } else if (keyword[0] == "mediator") {
      let responseMessage = `Persyaratan  permohonan penempatan dalam daftar mediator adalah :
      1. Salinan sah sertifikat mediator
      2. Salinan sah ijazah terakhi
      3. Pas foto berwarna 4x6 latar merah
      4. Daftar riwayat hidup (minimal memuat latar belakang pendidikan dan/atau pengalaman)`;

      resolve(responseMessage);
    } else if (keyword[0] == "surat_keterangan") {
      let responseMessage = `Persyaratan  permohonan surat keterangan dalam hal :
      1.Tidak pernah sebagai terpidana
      2.Tidak sedang dicabut hak pilihnya
      3.Dipidana karena kealpaan ringan atau alasan politik
      4.Tidak memiliki tanggungan utang secara perorangan dan/atau secara badan hukum yang menjadi tanggung jawabnya yang merugikan keuangan negara adalah : 
      1. Surat Permohona
      2. Fotokopi SKCK (dilegalisir
      3. Fotokopi KTP (Dilegalisir) .   
      4. Surat keterangan tidak pernah tersangkut perkara dan tidak pernah dicabut hak pilihnya dari Kantor Desa/Lurah .   
      5. Surat pernyataan tidak pernah terpidana dan tidak pernah dicabut hak pilihny 6. Foto berwarna 4x
      7. PNBP Rp. 10.000,-
      Juga dapat diakses melalui https://eraterang.badilum.mahkamahgung.go.id`;

      resolve(responseMessage);
    } else if (keyword[0] == "legalisir") {
      let responseMessage = `Persyaratan  untuk permohonan legalisir surat  adalah :
      1. Surat Permohonan
      2. Fotokopi KTP (Dilegalisir)
      3. Asli surat yang dilegalisir`;

      resolve(responseMessage);
    } else if (keyword[0] == "salinan_putusan") {
      let responseMessage = `Persyaratan  untuk permohonan salinan putusan BHT  adalah :
      1. Fotokopi KTP serta membawa aslinya
      2. Menginformasikan nomor perkara, Tanggal Pengambilan dan jam pengambilan _Contoh : 123/Pdt.G/2023/PA.Dgl diambil tanggal 04 Januari 2024 Jam 09.00 WITA_
      3. PNBP Rp 500,- dikalikan jml lembar dan PNBP Penyerahan sebesar Rp.10.000,-`;

      resolve(responseMessage);
    } else if (keyword[0] == "salinan_penetapan") {
      let responseMessage = `Persyaratan  untuk permohonan salinan putusan BHT  adalah :
      1. Fotokopi KTP serta membawa aslinya
      2. Menginformasikan nomor perkara, Tanggal Pengambilan dan jam pengambilan _Contoh : 0123/Pdt.P/2023/PA.Dgl diambil tanggal 04 Januari 2024 Jam 09.00 WITA_
      3. PNBP Rp 500,- dikalikan jml lembar dan PNBP Penyerahan sebesar Rp.10.000,-`;

      resolve(responseMessage);
    } else if (keyword[0] == "informasi") {
      let responseMessage = `Permohonan informasi pada ${pengadilan} dapat diperoleh melalui website resmi ${pengadilan} di ${web} atau dengan datang langsung ke meja informasi ${pengadilan}`;

      resolve(responseMessage);
    } else if (keyword[0] == "pengaduan") {
      let responseMessage = `Masyarakat dapat melaporkan indikasi pelanggaran yang terjadi di lingkungan ${pengadilan} melalui chat WhatsApp ke nomor 0822-7111-5021. Namun, untuk pengaduan terkait masalah perkara, harap kunjungi https://siwas.mahkamahagung.go.id."`;

      resolve(responseMessage);
    } else if (keyword[0] == "perdata") {
      let responseMessage = `Silahkan ketik layanan perdata yang anda inginkan :
      *- Pengajuan_gugatan*
      *- Pengajuan_permohonan*
      *- Gugatan_sederhana*
      *- Akta_cerai*
      *- Eksekusi*
      *- Konsinyasi*`;

      resolve(responseMessage);
    } else if (keyword[0] == "pengajuan_gugatan") {
      let responseMessage = `Persyaratan  untuk pengajuan gugatan  adalah :
      1. Surat gugatan (untuk lebih detail tiap perkara silahkan ketik "daftar")
      2. Surat kuasa apabila dikuasakan  .
      3. KTP Kuasa (apabila dikuasakan Kuasa)
      4. Berita Acara Sumpah Advokat (apabila dikuasakan Kuasa)
      'Dan sekarang masyarakat dapat menggunakan ecourt untuk mendaftarkan perkara perdata di alamat https://ecourt.mahkamahagung.go.id

      _-untuk lebih detail syarat pendaftaran tiap perkaranya silahkan ketik "daftar" (tanpa tanda kutip)_`;

      resolve(responseMessage);
    } else if (keyword[0] == "pengajuan_permohonan") {
      let responseMessage = `Persyaratan  untuk pengajuan permohonan  adalah :
      1. Surat permohonan (untuk lebih detail tiap perkara silahkan ketik "daftar")
      2. Surat kuasa apabila dikuasakan
      3. KTP Kuasa (apabila dikuasakan Kuasa)
      3. Berita Acara Sumpah Advokat (apabila dikuasakan Kuasa)
      Dan sekarang masyarakat dapat menggunakan ecourt untuk mendaftarkan perkara perdata di alamat https://ecourt.mahkamahagung.go.id
      
      _-untuk lebih detail syarat pendaftaran tiap perkaranya silahkan ketik "daftar" (tanpa tanda kutip)_`;

      resolve(responseMessage);
    } else if (keyword[0] == "gugatan_sederhana") {
      let responseMessage = `Persyaratan  untuk pengajuan gugatan sederhana  adalah :
      1. Surat gugatan (untuk lebih detail tiap perkara silahkan ketik "daftar")
      2. Bukti surat yang telah dilegalisir di kantor pos
      Dan sekarang masyarakat dapat menggunakan ecourt untuk mendaftarkan perkara perdata di alamat https://ecourt.mahkamahagung.go.id
      
      _-untuk lebih detail syarat pendaftaran tiap perkaranya silahkan ketik "daftar" (tanpa tanda kutip)_`;

      resolve(responseMessage);
    } else if (keyword[0] == "daftar") {
      let responseMessage = `Silahkan ketik syarat pendaftaran yang anda inginkan (Apabila ingin membuat gugatan/permohonan secara dipandu/mandiri silahkan ketik : gugatan_mandiri) :
      *- CG*
      Untuk melihat syarat pendaftaran Cerai Gugat (yang mengajukan perkara adalah Istri)

      *- CT*
      Untuk melihat syarat pendaftaran Cerai Talak (yang mengajukan perkara adalah Suami)

      *- IC*
      Untuk melihat syarat pendaftaran Itsbat Cerai Gugat/Talak (Perceraian pada pernikahan yang belum tercatat di KUA / nikah sirri)

      *- DK*
      Untuk melihat syarat pendaftaran Dispensasi Kawin/Nikah

      *- ISBAT*
      Untuk melihat syarat pendaftaran Itsbat Nikah (Pernikahan yang belum tercatat di KUA / nikah sirri)

      *- IN*
      Untuk melihat syarat pendaftaran Itsbat Nikah Kontentius (Pengesahan nikah yang belum tercatat di KUA/Nikah Sirri, di mana salah satu atau kedua-dua suami atau istri telah meninggal)
      
      *- PB*
      Untuk melihat syarat pendaftaran Pembatalan Nikah

      *- AUA*.
      Untuk melihat syarat pendaftaran Asal Usul Anak

      *- PAW*
      Untuk melihat syarat pendaftaran Penetapan Ahli Waris

      *- HB*
      Untuk melihat syarat pendaftaran Harta Bersama

      *- WA*
      Untuk melihat syarat pendaftaran Wali Adhol

      *- WALI*
      Untuk melihat syarat pendaftaran Perwalian Anak

      *- WARIS*
      Untuk melihat syarat pendaftaran Gugatan Kewarisan

      *- POLIGAMI*
      Untuk melihat syarat pendaftaran Izin Poligami

      *- PENGANGKATAN*
      Untuk melihat syarat pendaftaran Pengangkatan Anak

      *- HAA*
      Untuk melihat syarat pendaftaran Hak Asuh Anak

      untuk tata cara daftar secara elektronik silahkan ketik *ecourt*`;

      resolve(responseMessage);
    } else if (keyword[0] == "cg") {
      let responseMessage = `Persyaratan pendaftaran *Cerai Gugat* adalah :
      *Syarat Umum*
      1. Menyerahkan Surat Gugatan (rangkap 5)
      2. Asli dan Fotokopi Kutipan/Duplikat Akta Nikah (stempel kantor pos dan bermaterai Rp.10.000,-)
      3. Fotokopi KTP (stempel kantor pos dan bermaterai Rp.10.000,-)
      4. Fotokopi KK
      5. Membayar Panjar Biaya Perkara
      *Syarat Khusus*
      - Surat Keterangan Ghoib dari desa atau kelurahan apabila salah satu pihak tidak diketahui alamatnya secara jelas di wilayah Republik Indonesia
      - Surat ijin atau surat keterangan dari atasan bagi PNS/TNI/POLRI`;

      resolve(responseMessage);
    } else if (keyword[0] == "ct") {
      let responseMessage = `Persyaratan pendaftaran *Cerai Talak* adalah :
      *Syarat Umum*
      1. Menyerahkan Surat permohonan (rangkap 5)
      2. Asli dan Fotokopi Kutipan/Duplikat Akta Nikah (stempel kantor pos dan bermaterai Rp.10.000,-)
      3. Fotokopi KTP (stempel kantor pos dan bermaterai Rp.10.000,-)
      4. Fotokopi KK
      5. Membayar Panjar Biaya Perkara
      *Syarat Khusus*
      - Surat Keterangan Ghoib dari desa atau kelurahan apabila salah satu pihak tidak diketahui alamatnya secara jelas di wilayah RI
      - Surat ijin atau surat keterangan dari atasan bagi PNS/TNI/POLRI`;

      resolve(responseMessage);
    } else if (keyword[0] == "ic") {
      let responseMessage = `Persyaratan pendaftaran *Itsbat Cerai Gugat/Talak* adalah :
      *Syarat Umum*
      1. Menyerahkan Surat gugatan/permohonan (rangkap 5)
      2. Asli dan Fotokopi Surat Keterangan Tidak Tercatat dari wilayah yurisdiksi KUA tempat menikah (stempel kantor pos dan bermaterai Rp.10.000,-)
      3. Fotokopi KTP (stempel kantor pos dan bermaterai Rp.10.000,-)
      4. Fotokopi KK
      5. Membayar Panjar Biaya Perkara
      *Syarat Khusus*
      - Surat Keterangan Ghoib dari desa atau kelurahan apabila salah satu pihak tidak diketahui alamatnya secara jelas di wilayah RI
      - Surat ijin atau surat keterangan dari atasan bagi PNS/TNI/POLRI`;

      resolve(responseMessage);
    } else if (keyword[0] == "dk") {
      let responseMessage = `Persyaratan pendaftaran permohonan *Dispensasi Kawin* adalah :
      1. Menyerahkan Surat permohonan yang diajukan kedua orang tua Pemohon (rangkap 5)
      2. Fotokopi KTP Para Pemohon (stempel kantor pos dan bermaterai Rp.10.000,-)
      3. Fotokopi Akta Nikah Para Pemohon (stempel kantor pos dan bermaterai Rp.10.000,-)
      4. Fotokopi KK (stempel kantor pos dan bermaterai Rp.10.000,-)
      5. Fotokopi Akta Kelahiran anak para pemohon (stempel kantor pos dan bermaterai Rp.10.000,-)
      6. Fotokopi Ijazah anak para pemohon (stempel kantor pos dan bermaterai Rp.10.000,-)
      7. Fotokopi KTP calon suami / calon istri (stempel kantor pos dan bermaterai Rp.10.000,-)
      8.  Fotokopi Akta Kelahiran calon suami / calon istri (stempel kantor pos dan bermaterai Rp.10.000,-)
      9. Fotokopi Ijazah calon suami / calon istri (stempel kantor pos dan bermaterai Rp.10.000,-)
      10. Fotokopi Surat Penolakan menikahkan dari KUA setempat (stempel kantor pos dan bermaterai Rp.10.000,-)
      11. Fotokopi Surat Keterangan sehat dari dokter spesialis mengenai kesehatan reproduksi untuk calon mempelai perempuan (stempel kantor pos dan bermaterai Rp.10.000,-)
      12. Fotokopi Surat Keterangan sehat untuk kedua mempelai baik calon istri maupun calon suami dari puskesmas setempat (stempel kantor pos dan bermaterai Rp.10.000,-)
      13. Membayar Panjar Biaya Perkara`;

      resolve(responseMessage);
    } else if (keyword[0] == "isbat") {
      let responseMessage = `Persyaratan pendaftaran permohonan *Isbat Nikah* adalah: :
      1. Menyerahkan Surat Permohonan yang diajukan suami-istri (rangkap 5)
      2. Fotokopi KTP Para Pemohon (stempel kantor pos dan bermaterai Rp.10.000,-)
      3. Fotokopi KK (stempel kantor pos dan bermaterai Rp.10.000,-)
      4. Fotokopi Akta Cerai apabila status suami atau istri sebelum menikah duda/janda cerai hidup (stempel kantor pos dan bermaterai Rp.10.000,-)
      5. Surat kematian dari desa/kelurahan setempat apabila salah satu meninggal dunia (stempel kantor pos dan bermaterai Rp.10.000,-)
      6. Membayar Panjar Biaya Perkara`;

      resolve(responseMessage);
    } else if (keyword[0] == "aua") {
      let responseMessage = `Persyaratan pendaftaran permohonan *Asal Usul Anak* adalah :
      1. Menyerahkan Surat permohonan yang diajukan suami-istri (rangkap 5)
      2. Fotokopi KTP Para Pemohon (stempel kantor pos dan bermaterai Rp.10.000,-)
      3. Fotokopi Akta Nikah Para Pemohon (stempel kantor pos dan bermaterai Rp.10.000,-)
      4. Fotokopi KK (stempel kantor pos dan bermaterai Rp.10.000,-)
      5. Surat keterangan lahir dari bidan atau dokter/kelurahan (stempel kantor pos dan bermaterai Rp.10.000,-)
      6. Membayar Panjar Biaya Perkara`;

      resolve(responseMessage);
    } else if (keyword[0] == "paw") {
      let responseMessage = `Persyaratan pendaftaran permohonan *Penetapan Ahli Waris* adalah : 
      1. Menyerahkan Surat permohonan yang diajukan semua ahli waris (rangkap 5)
      2. Menyerahkan surat keterangan kematian pewaris yang dikeluarkan oleh kepala desa/kepala kelurahan (stempel kantor pos dan bermaterai Rp.10.000,-)
      3. Fotokopi KTP masing-masing ahli waris (stempel kantor pos dan bermaterai Rp.10.000,-)
      4. Fotokopi Kartu Keluarga (stempel kantor pos dan bermaterai Rp.10.000,-) 
      5. Fotokopi Akta Nikah/duplikat akta nikah pewaris (stempel kantor pos dan bermaterai Rp.10.000,-)  
      6. Menyerahkan susunan / silsilah ahli waris dari kepala desa/kepala kelurahan (stempel kantor pos dan bermaterai Rp.10.000,-)  
      7. Fotokopi akta kelahiran masing-masing ahli waris (stempel kantor pos dan bermaterai Rp.10.000,-)
      8. Membayar Panjar Biaya Perkara`;

      resolve(responseMessage);
    } else if (keyword[0] == "hb") {
      let responseMessage = `Persyaratan pendaftaran Gugatan *Harta Bersama* adalah :
      1. Menyerahkan Surat gugatan (rangkap 5)
      2. Fotocopy KTP Penggugat (stempel kantor pos dan bermaterai Rp.10.000,-)
      3. Fotokopi Akta Cerai/Duplikat Akta Cerai (stempel kantor pos dan bermaterai Rp.10.000,-)
      4. Menyerahkan Fotocopy bukti-bukti harta bersama yang digugat (stempel kantor pos dan bermaterai Rp.10.000,-)
      5. Membayar Panjar Biaya Perkara`;

      resolve(responseMessage);
    } else if (keyword[0] == "wa") {
      let responseMessage = `Persyaratan permohonan *Wali Adhol* adalah :
      1. Menyerahkan Surat permohonan (rangkap 5)
      2. Fotocopy KTP Pemohon (stempel kantor pos dan bermaterai Rp.10.000,-)
      3. Fotocopy Akta Kelahiran/Fotocopy Ijazah terakhir Pemohon (stempel kantor pos dan bermaterai Rp.10.000,-)
      4. Menyerahkan surat penolakan dari KUA (stempel kantor pos dan bermaterai Rp.10.000,-)
      5. Membayar Panjar Biaya Perkara`;

      resolve(responseMessage);
    } else if (keyword[0] == "wali") {
      let responseMessage = `Persyaratan permohonan *Perwalian Anak* adalah :
      1. Menyerahkan Surat permohonan (rangkap 5)
      2. Fotocopy KTP Pemohon (stempel kantor pos dan bermaterai Rp.10.000,-)
      3. Fotocopy KK (stempel kantor pos dan bermaterai Rp.10.000,-)
      4. Fotocopy Kutipan Akta Nikah/Duplikat akta nikah pemohon (stempel kantor pos dan bermaterai Rp.10.000,-)
      5. Fotocopy Akta Kelahiran anak dibawah umur (stempel kantor pos dan bermaterai Rp.10.000,-)
      6. Fotocopy Surat Kematian (stempel kantor pos dan bermaterai Rp.10.000,-)
      7. Membayar Panjar Biaya Perkara`;

      resolve(responseMessage);
    } else if (keyword[0] == "waris") {
      let responseMessage = `Persyaratan pendaftaran *Gugatan Kewarisan* adalah: :
      1. Menyerahkan Surat Gugatan (rangkap 5)
      2. Fotocopy KTP Penggugat (stempel kantor pos dan bermaterai Rp.10.000,-)
      3. Fotokopi Kartu Keluarga (stempel kantor pos dan bermaterai Rp.10.000,-)
      4. Surat Keterangan Ahli Waris dari desa/Kelurahan yang diketahui kecamatan (stempel kantor pos dan bermaterai Rp.10.000,-)
      5. Fotokopi surat-surat dan keterangan tentang Harta Warisan (stempel kantor pos dan bermaterai Rp.10.000,-)
      6. Membayar Panjar Biaya Perkara`;

      resolve(responseMessage);
    } else if (keyword[0] == "poligami") {
      let responseMessage = `Persyaratan pendaftaran permohonan *Izin Poligami* adalah: :
      1.  Menyerahkan Surat Gugatan (rangkap 5)
      2.  Fotokopi KTP Pemohon, KTP Istri Pertama dan Calon Istri
      3.  Fotokopi Kartu Keluarga Pemohon
      4.  Fotokopi Buku Nikah Pemohon
      5.  Surat Keterangan status calon istri dari desa, bila belum pernah menikah (apabila pernah terjadi perceraian melampirkan fotokopi akta cerai dan apabila meninggal dunia melampirkan surat kematian)
      6.  Surat keterangan penghasilan diketahui desa/instansi
      7.  Surat Ijin Atasan apabilan PNS/TNI/POLRI
      8.  Surat Pernyataan Berlaku Adil
      9.  Surat Pernyataan tidak keberatan dimadu dari istri pertama
      10. Surat Pernyataan tidak keberatan dimadu dari calon istri
      11. Surat Keterangan Pemisahan Harta Kekayaan
      12. Seluruh persyaratan dari No.1 sd 11 distempel kantor pos dan bermaterai Rp.10.000,
      13. Membayar Panjar Biaya Perkara`;

      resolve(responseMessage);
    } else if (keyword[0] == "pengangkatan") {
      let responseMessage = `Persyaratan permohonan *Pengangkatan Anak* adalah :
      1. Menyerahkan Surat permohonan (rangkap 5)
      2. Fotocopy KTP Para Pemohon (stempel kantor pos dan bermaterai Rp.10.000,-)
      3. Fotocopy KK (stempel kantor pos dan bermaterai Rp.10.000,-)
      4. Fotocopy Kutipan Akta Nikah/Duplikat akta nikah pemohon (stempel kantor pos dan bermaterai Rp.10.000,-)
      5. Fotocopy Akta Kelahiran (stempel kantor pos dan bermaterai Rp.10.000,-)
      6. Fotocopy Surat Persetujuan dari Orang Tua Kandung / Orang yang bertanggung jawab atas anak angkat, jika orang tua anak angkat telah meninggal dunia maka Pemohon harus menyerahkan Surat Keterangan Kematian dari Kepala Desa/Kepala Kelurahan. (stempel kantor pos dan bermaterai Rp.10.000,-)
      7. Fotocopy Surat Keterangan dari Dinas Sosial (stempel kantor pos dan bermaterai Rp.10.000,-).
      8. Menyerahkan asli Surat Keterangan Penghasilan Calon Orang Tua Angkat dari Kepala Desa/Kepala Kelurahan (stempel kantor pos dan bermaterai Rp.10.000,-).
      9. Membayar Panjar Biaya Perkara`;

      resolve(responseMessage);
    } else if (keyword[0] == "in") {
      let responseMessage = `Persyaratan untuk permohonan *Itsbat Nikah Kontentius* adalah:
      1. Menyerahkan Surat gugatan/permohonan (rangkap 5)
      2. Asli dan Fotokopi Surat Keterangan Tidak Tercatat dari wilayah yurisdiksi KUA tempat menikah (stempel kantor pos dan bermaterai Rp.10.000,-)
      3. Fotokopi KTP suami dan istri (stempel kantor pos dan bermaterai Rp.10.000,-)
      4. Fotokopi KK pewaris (stempel kantor pos dan bermaterai Rp.10.000,-)
      5. Fotokopi Akta kematian suami dan istri (stempel kantor pos dan bermaterai Rp.10.000,-)
      6. Fotokopi Akta kelahiran Ahli Waris (stempel kantor pos dan bermaterai Rp.10.000,-)
      7. Fotokopi KK Ahli Waris (stempel kantor pos dan bermaterai Rp.10.000,-)
      8. Membayar Panjar Biaya Perkara`;

      resolve(responseMessage);
    } else if (keyword[0] == "pb") {
      let responseMessage = `Persyaratan untuk permohonan *Pembatalan Pernikahan* adalah:
      1. Surat Permohonan yang diajukan suami-istri (rangkap 5)
      2. Fotokopi KTP Pemohon (stempel kantor pos dan bermaterai Rp.10.000,-)
      3. Asli dan Fotokopi Kutipan/Duplikat Akta Nikah atau Duplikat yang dibatalkan (stempel kantor pos dan bermaterai Rp.10.000,-)
      4. Membayar Panjar Biaya Perkara`;

      resolve(responseMessage);
    } else if (keyword[0] == "haa") {
      let responseMessage = `Persyaratan untuk permohonan *Hak Asuh Anak* adalah: :
      1. Surat Permohonan yang diajukan suami-istri (rangkap 5)
      2. Fotokopi KTP Para Pemohon (stempel kantor pos dan bermaterai Rp.10.000,-)
      3. Fotokopi KK (stempel kantor pos dan bermaterai Rp.10.000,-)
      4. Fotokopi Akta Cerai apabila status suami atau istri sebelum menikah duda/janda cerai hidup (stempel kantor pos dan bermaterai Rp.10.000,-)
      5. Fotokopi Akta Kelahiran anak (stempel kantor pos dan bermaterai Rp.10.000,-)
      6. Membayar Panjar Biaya Perkara`;

      resolve(responseMessage);
    } else if (keyword[0] == "eksekusi") {
      let responseMessage = `Silahkan ketik jenis eksekusi :
      *- Eksekusi_putusan*
      *- Eksekusi_akta_perdamaian*
      *- Eksekusi_serta_merta*
      *- Eksekusi_provisi*
      *- Eksekusi_lanjutan*
      *- Eksekusi_lelang*
      *- Eksekusi_kep_umum*`;

      resolve(responseMessage);
    } else if (keyword[0] == "eksekusi_putusan") {
      let responseMessage = `Persyaratan  untuk pengajuan eksekusi terhadap putusan pengadilan  adalah :
      1. Permohonan
      2. Surat kuasa khusus apabila dikuasakan
      3. FC salinan putusan
      4. Relaas pemberitahuan putusan
      5. Surat pernyataan yang menyatakan bahwa obyek eksekusi tidak terkait perkara lain
      6. Surat-surat lainnya yang dipandang perlu`;

      resolve(responseMessage);
    } else if (keyword[0] == "eksekusi_akta_perdamaian") {
      let responseMessage = `Persyaratan  untuk pengajuan eksekusi terhadap akta perdamaian adalah : 
      1. Permohonan
      2. Surat kuasa khusus apabila dikuasakan
      3. FC Akta perdamaian`;

      resolve(responseMessage);
    } else if (keyword[0] == "eksekusi_serta_merta") {
      let responseMessage = `Persyaratan  untuk pengajuan eksekusi terhadap putusan serta merta  adalah :
      1. Permohonan
      2. Surat kuasa khusus apabila dikuasakan
      3. FC salinan putusan serta merta
      4. Fotokopi akta otentik
      5. Jaminan/uang yang disimpan di bank`;

      resolve(responseMessage);
    } else if (keyword[0] == "eksekusi_provisi") {
      let responseMessage = `Persyaratan  untuk pengajuan eksekusi terhadap putusan provisi  adalah :
      1. Permohonan
      2. Surat kuasa khusus apabila dikuasakan
      3. FC salinan putusan provisi
      4. Akta otentik
      5. Jaminan pelaksanaan eksekusi provisi
      6. Surat-surat lainnya yang dipandang perlu`;

      resolve(responseMessage);
    } else if (keyword[0] == "eksekusi_lanjutan") {
      let responseMessage = `Persyaratan  untuk pengajuan eksekusi lanjutan  adalah :
      1. Permohonan
      2. Surat kuasa khusus apabila dikuasakan
      3. FC BA Eksekusi pertama`;

      resolve(responseMessage);
    } else if (keyword[0] == "eksekusi_lelang") {
      let responseMessage = `Persyaratan  untuk pengajuan eksekusi lelang adalah :
      1. Permohonan
      2. Surat kuasa khusus apabila dikuasakan
      3. FC SHM (IMB bila ada)
      4. Fotokopi sertifikat HT dan APHT
      5. Fotokopi SKMHT
      6. Fotokopi surat peringatan kepada debitur
      7. Fotokopi pembukuan bank mengenai jml utang debitur
      8. Fotokopi surat peringatan kepada debitur
      9. Permohonan penunnjukan apraisal atau penilai publik atas aset
      10. Surat-surat lainnya yang dipandang perlu`;

      resolve(responseMessage);
    } else if (keyword[0] == "eksekusi_kep_umum") {
      let responseMessage = `Persyaratan  pengosongan tanah untuk kepentingan umum  adalah :
      1. Permohonan
      2. Surat penetapan konsinyasi
      3. BA Konsinyasi
      4. Dokumen obyek eksekusi
      5. Surat pelepasa hak dari BPN
      6. Surat-surat lainnya yang dipandang perlu`;

      resolve(responseMessage);
    } else if (keyword[0] == "konsinyasi") {
      let responseMessage = `Persyaratan pencairan konsinyasi  adalah :
      1. Permohonan
      2. Surat kuasa khusus
      3. FC Salinan penetapan KPN tentang uang konsinyasi
      4. Surat pengantar dari ketua pelaksana pengadaan tanah
      5. Surat-surat lainnya yang dipandang perlu`;

      resolve(responseMessage);
    } else if (keyword[0] == "syarat prodeo") {
      let responseMessage = `Persyaratan pendaftaran perkara secara prodeo/gratis adalah :
      1. FC Kartu Tanda Penduduk (KTP) Penggugat/Pemohon;
      2. Surat Keterangan Tidak Mampu dari desa/kelurahan yang di tempel meterai Rp.10.000,-
      3. Surat Gugatan/Permohon perkara yang di daftarkan (dapat dibantu di oleh pegawai PTSP di kantor Pengadilan)`;

      resolve(responseMessage);
    } else if (keyword[0] == "ecourt") {
      let responseMessage = `E-Court Adalah layanan bagi Pengguna Terdaftar dan Pengguna Lain untuk Pendaftaran Perkara Secara Online, Mendapatkan Taksiran Panjar Biaya Perkara secara online, Pembayaran secara online, Pemanggilan yang dilakukan dengan saluran elektronik, dan Persidangan yang dilakukan secara Elektronik. Untuk memulai silahkan kunjungi https://ecourt.mahkamahagung.go.id`;

      resolve(responseMessage);
    } else if (keyword[0] == "daftar prodeo") {
      let responseMessage = `Silahkan klik link berikut ini untuk daftar (jangan lupa isi namanya) Prodeo di https://wa.me/6285240993139?text=Assalamuaikum%20Wr%20Wb%20Saya%20daftar%20prodeo%20atas%20nama%20:%20.......%20apakah%20masih%20tersedia%20prodeonya?`;

      resolve(responseMessage);
    } else if (keyword[0] == "bapanjar") {
      let responseMessage = `Bapanjar (Balai Pangkas Jarak) merupakan program ${pengadilan} untuk memangkas jarak pelayanan secara tatap muka langsung untuk masyarakat di daerah Kabupaten Morowali Utara, adapun hari layanan tersedia di hari Senin dari jam 08:00 - 15:00, kantor tersebut beralamat di 50m dari kantor Koramil Petasia, Kelurahan Kolonedale, Kecamatan Petasia, Kabupaten Morowali Utara. Silahkan ketik pelayanan yang ada inginkan :
      *- Daftar*
      *- Akta cerai*
      *- Pesan akta*
      *- Salinan_penetapan*
      *- Salinan_putusan*`;

      resolve(responseMessage);
    } else if (keyword[0] == "gugatan_mandiri") {
      let responseMessage = `Gugatan Mandiri adalah layanan pembuatan gugatan atau permohonan secara mandiri yang dapat diakses dari mana saja, selama terdapat akses internet melalui Handphone atau komputer. Untuk memulai, silakan kunjungi http://gugatanmandiri.badilag.net/gugatan_mandiri/gugatan/mulai.`;

      resolve(responseMessage);
    } else if (keyword[0] == "eraterangsss") {
      let responseMessage = `ERATERANG adalah layanan Permohonan Surat keterangan secara Elektronik yang dapat diakses oleh pemohon dimanapun ia berada (selama ada akses internet via HP/Gawai dan Komputer/PC). Untuk memulai silahkan kunjungi https://eraterang.badilum.mahkamahagung.go.id`;

      resolve(responseMessage);
    } else if (keyword[0] == "survei") {
      let responseMessage = `Untuk mengevaluasi kinerja pelayanan pada *Pengadilan Agama *****, kami telah menyediakan sarana survei elektronik yang bisa Bapak/Ibu akses di  https://simtalak.badilag.net/survey/`;

      resolve(responseMessage);
    } else if (keyword[0] == "monev") {
      console.log("Keyword 'monev' terdeteksi");
      let responseMessage = `*_Pilihan Untuk Monev (Khusus Pejabat dan Pegawai PA Donggala)_*\n\nmonev bas\nmonev relaas\nmonev pbt\nmonev minutasi\nmonev ecourt\nmonev ghaib\nmonev prodeo\nmonev mediasi\nmonev sidkel\nmonev publikasi\nmonev arsip\nmonev saksi salah\nmonev court calender\nmonev court calender edoc\nmonev putusan\nmonev lupa\nmonev putus lebih 30 hari\nmonev sidang lebih 30 hari\nmonev delegasi masuk\nmonev delegasi keluar\nmonev upaya hukum\nmonev cerai anak\nmonev verstek\nmonev bht\nmonev tunda mediasi\nmonev petitum\nmonev anom\nmonev panjar\nmonev meterai\nmonev alamat\nmonev identitas pihak\nmonev penetapan\nmonev kua cerai\nmonev capil cerai\nmonev patut\nmonev pos\nmonev sidang\nmonev sidang besok\nmonev sidang hari ini lengkap\nmonev penahanan\nmonev penerimaan\nmonev penerimaan lengkap\nmonev penerimaan semua\njumlah alasan cerai\njumlah mediasi\njumlah mediasi hakim\ndirput hukum\n\n*_Pilihan untuk keperluan monitoring perkara sehari-hari atau berdasarkan tanggal/bulan/tahun_*\n\nalasan cerai\npengumuman\nabsen pagi\nabsen sore\nnilai sipp\nnilai triwulan\nsidang js\nsidang besok\nsidang hari ini\nsidang hari ini lengkap\nmonev sidang tanggal |contoh : monev sidang tanggal#01-02-2024\nsidang tanggal | contoh : sidang tanggal#01-02-2024\nstatistik | contoh : statistik#2024\nstatistik detail | contoh : statistik detail#2024\nhakim | contoh : hakim#derry\npp | contoh : pp#basahir\njs | contoh : js#harbi\n\nKetik Monev tiap jabatan untuk tiap jabatan, contoh : monev ketua atau monev panitera\ncek  |contoh cek#7209998919219993\nsipp putus\nsipp minutasi\nsipp upload putusan\nsipp pendaftaran\nsipp pmh\nsipp input pmh\nsipp pp\nsipp input pp\nsipp js\nsipp input js\nsipp phs\nsipp input phs\nsipp relaas\nsipp mediasi\nsipp saksi\nsipp pbt\nsipp bht\nsipp sisa panjar\nsipp arsip\nsipp delegasi\nsipp edoc petitum\nsipp edoc relaas\nsipp edoc bas\nsipp edoc ac\nsipp agenda sidang\nsipp permohonan delegasi\nsipp verstek`;

      resolve(responseMessage);
    } else if (keyword[0] == "monev help") {
      let responseMessage = `*_Berikut Deskripsi kueri :_*\nmonev bas\nuntuk mengecek BAS belum dikerjakan/upload\n\nmonev relaas\nuntuk mengecek relaas yang belum dilaksanakan/upload\n\nmonev ghaib\nuntuk mengecek perkara yang terdaftar secara ghaib\n\nmonev prodeo\nuntuk mengecek perkara yang terdaftar secara prodeo\n\nmonev mediasi\nuntuk mengecek perkara yang melalui proses mediasi serta hasil mediasinya\n\nmonev pbt\nuntuk mengecek PBT yang belum diinput di SIPP\n\nmonev minutasi\nuntuk mengecek minutasi yang belum diinput di SIPP\n\nmonev ecourt\nuntuk mengecek perkara yang di daftar secara E-Court (mendeteksi Pengguna Terdaftar dan Pengguna Lainnya)\n\nmonev sidkel\nuntuk mengecek perkar yang bersidang diluar gedung (Sidkel)\n\nmonev publikasi\nuntuk mengecek publikasi yang tidak sesuai\n\nmonev arsip\nuntuk mengecek arsip/bundel A perkara yang belum dikerjakan/upload di SIPP\n\nmonev saksi salah\nuntuk mengecek PP yang lupa mengisi data saksi tetapi sudah diputus di SIPP\n\nmonev court calender\nuntuk mengecek perkara yang tidak menggunakan court calender\n\nmonev court calender edoc\nuntuk mengecek edoc court calender yang belum dikerjakan/upload\n\nmonev putusan\nuntuk mengecek edoc putusan yang belum diupload\n\nmonev lupa\nuntuk mengecek Hakim yang lupa input putusan padahal di jadwal sidang pada keterangan sudah memberikan keterangan putus, sekaligus mengecek PP yang lupa menunda persidangan dan mediasi di SIPP\n\nmonev putus lebih 30 hari\nuntuk mengecek perkara yang telah putus melebihi 30 hari (tidak mendapatkan nilai maksimal SIPP)\n\nmonev sidang lebih 30 hari\nuntuk mengecek perkara yang sedang berjalan persidangannya melebihi 30 hari (tidak mendapatkan nilai maksimal SIPP)\n\nmonev delegasi masuk\nuntuk mengecek delegasi masuk yang belum dilaksanakan/upload\n\nmonev delegasi keluar\nuntuk mengecek JS yang tidak menggunakan jalur  delegasi di SIPP dan memanggil secara manual\n\nmonev upaya hukum\nuntuk mengecek proses, biaya dan BHT upaya hukum Banding, Kasasi dan PK \n\nmonev cerai anak\nuntuk mengecek perkara cerai yang tidak menginput data anak tetapi di posita terdapat nama anaknya oleh petugas pendaftaran perkara\n\nmonev verstek\nuntuk mengecek perkara yang salah input verstek (biasanya lupa ganti menu verstek = ya di SIPP)\n\nmonev bht\nuntuk mengecek BHT yang belum diinput di SIPP padahal sudah waktunya untuk BHT\n\nmonev tunda mediasi\nuntuk mengecek mediasi yang lupa di tunda\n\nmonev petitum\nuntuk mengecek edoc petitum pendaftaran perkara yang belum di upload\n\nmonev anom\nuntuk mengecek edoc anonimisasi yang belum diupload\n\nmonev panjar\nuntuk mengecek panjar yang belum dikeluarkan\monev meterai\nuntuk mengecek meterai, redaksi dan PSP yang belum dikeluarkan\n\nmonev alamat\nuntuk mengecek alamat yang belum lengkap di input\n\nmonev identitas pihak\nuntuk mengecek seluruh identitas pihak yang terdaftar tahun berjalan\n\nmonev penetapan\nuntuk mengecek perkara yang belum ditetapkan PMH, Penunjukkan PP dan Penunjukkan JS serta PHS\n\nmonev kua cerai\nuntuk data yang akan dikirim ke KUA (Rencana Kerja Sama)\n\nmonev capil cerai\nuntuk data yang akan dirim ke Capil (Rencana Kerja Sama)\n\nmonev patut\nuntuk mengecek panggilan/relaas yang tidak patut (dibawah 3 hari/ hari ke-3 tidak dihitung (hitungan jari telunjuk dan ibu jari) dan untuk panggilan surat tercatat dihitung saat pengiriman ke Pos)\n\nmonev pos\nuntuk mengecek panggilan yang telah dilaksanakan Pos tapi tidak patut (dibawah 3 hari sebelum hari sidang)\n\nmonev sidang\nuntuk mengecek sidang hari ini\n\nmonev sidang besok\nuntuk mengecek sidang besok\n\nmonev sidang hari ini lengkap\nuntuk mengecek sidang pidana dan perdata lengkap\n\nmonev sidang tanggal\nuntuk mengecek sidang tanggal berapa (khusus pegawai PA)\n\nmonev penahanan\nuntuk mengecek data penahanan yang belum diinput (Pidana/Jinayah)\n\nmonev penerimaan\nuntuk melihat penerimaan perkara dan mediasi Hakim, Panitera Sidang dan Jurusita yang aktif\n\nmonev penerimaan lengkap\nuntuk melihat penerimaan perkara lengkap dan mediasi lengkap Hakim, Panitera Sidang dan Jurusita yang aktif\n\nmonev penerimaan semua\n\nuntuk melihat penerimaan perkara dan mediasi semua Hakim, Panitera Sidang dan Jurusita yang aktif dan tidak aktif\n\n\ndirput hukum\nuntuk mengecek putusan yang belum dikirim ke direktori putusan\n\nsidang js\nuntuk mengecek sidang yang telah putus dan ada PBT serta mengecek apabila ada pihak yang akan dipanggil oleh jurusita (hari itu)\n\nsidang besok\nuntuk mengecek sidang besok\n\nsidang hari ini\nuntuk mengecek sidang hari ini\n\nsidang hari ini lengkap\nuntuk mengecek sidang hari ini dengan ada pidana/jinayah\n\nsidang tanggal\nuntuk mengecek sidang sesuai tanggal, contoh : sidang tanggal#10-10-2024\n\nstatistik\nuntuk mengecek statistik perkara dalam 1 tahun\n\nstatistik detail\nuntuk mengecek statistik perkara dalam 1 tahun dengan tiap jenis perkera\n\nalasan cerai\nuntuk mengecek alasan-alasan perceraian yang dapat dipakai untuk pendaftaran cerai\nabsen pagi\nuntuk mengecek absen masuk/pagi seluruh Pejabat dan Pegawai ASN di Satker\n\nabsen sore\nuntuk mengecek absen keluar/sore seluruh Pejabat dan Pegawai ASN di Satker\n\nnilai sipp\nuntuk melihat perkara yang bermasalah di SIPP (penyebab nilai tidak maksimal)\n\nnilai triwulan\nuntuk melihat nilai triwulan\n\njumlah alasan cerai\nuntuk mengecek alasan cerai yang diputus kabul, ketik : jumlah alasan cerai#2021#1\n\nhakim\nuntuk menjelaskan statistik penerimaan perkara dan putus, perkara aktif dan mediasi aktif tiap hakim, contoh ketik : hakim#derry\n\npp\nuntuk menjelaskan statistik penerimaan perkara dan putus, perkara aktif dan status mediasi tiap Panitera Sidang, contoh ketik : pp#basahir\njs\nuntuk menjelaskan statistik penerimaan perkara dan putus, perkara aktif dan mediasi aktif tiap jurusita, contoh ketik : js#harbi\n\ncek\nUntuk mengecek pria/wanita pernah bercerai di ${pengadilan} dari tahun 2016 sampai sekarang dengan mengisi nomor Nomor Induk Kependudukan (NIK) (masih dalam lingkup Morowali dan Morowali Utara) (Ketik cek#Nomor Identitas Kependudukan | seperti contoh : cek#7209998919219993)\n\nsipp putus\n\nuntuk mendapatkan informasi mengenai data kriteria waktu putus yang bermasalah di SIPP.\n\nsipp minutasi\n\nuntuk mendapatkan informasi mengenai data minutasi berkas perkara yang bermasalah di SIPP.\n\nsipp upload putusan\n\nuntuk mendapatkan informasi mengenai data upload publikasi putusan yang bermasalah di SIPP.\n\nsipp pendaftaran\n\nuntuk mendapatkan informasi mengenai data pendaftaran perkara yang bermasalah di SIPP.\n\nsipp pmh\n\nuntuk mendapatkan informasi mengenai data penetapan majelis hakim yang bermasalah di SIPP.\n\nsipp input pmh\n\nuntuk mendapatkan informasi mengenai data pengimputan penetapan majelis hakim yang bermasalah di SIPP.\n\nsipp pp\n\nuntuk mendapatkan informasi mengenai data penunjukkan PP yang bermasalah di SIPP.\n\nsipp input pp\n\nuntuk mendapatkan informasi mengenai data pengimputan penunjukkan PP yang bermasalah di SIPP.\n\nsipp js\n\nuntuk mendapatkan informasi mengenai data penunjukkan jurusita yang bermasalah di SIPP.\n\nsipp input js\n\nuntuk mendapatkan informasi mengenai data pengimputan penunjukkan jurusita yang bermasalah di SIPP.\n\nsipp phs\n\nuntuk mendapatkan informasi mengenai data penetapan hari sidang yang bermasalah di SIPP.\n\nsipp input phs\n\nuntuk mendapatkan informasi mengenai data pengimputan penetapan hari sidang yang bermasalah di SIPP.\n\nsipp relaas\n\nuntuk mendapatkan informasi mengenai data pengisian data relaas yang bermasalah di SIPP.\n\nsipp mediasi\n\nuntuk mendapatkan informasi mengenai data pengisian mediasi yang bermasalah di SIPP.\n\nsipp saksi\n\nuntuk mendapatkan informasi mengenai data kepatuhan data saksi yang bermasalah di SIPP.\n\nsipp pbt\n\nuntuk mendapatkan informasi mengenai data pemberitahuan putusan penetapan yang bermasalah di SIPP.\n\nsipp bht\n\nuntuk mendapatkan informasi mengenai data pengisian BHT yang bermasalah di SIPP.\n\nsipp sisa panjar\n\nuntuk mendapatkan informasi mengenai data pencatatan sisa panjar biaya yang bermasalah di SIPP.\n\nsipp arsip\n\nuntuk mendapatkan informasi mengenai data pengisian data arsip yang bermasalah di SIPP.\n\nsipp delegasi\n\nuntuk mendapatkan informasi mengenai data penerimaan delegasi yang bermasalah di SIPP.\n\nsipp edoc petitum\n\nuntuk mendapatkan informasi mengenai data edoc petitum tuntutan yang bermasalah di SIPP.\n\nsipp edoc relaas\n\nuntuk mendapatkan informasi mengenai data edoc relaas yang bermasalah di SIPP.\n\nsipp edoc bas\n\nuntuk mendapatkan informasi mengenai data edoc BAS yang bermasalah di SIPP.\n\nsipp edoc ac\n\nuntuk mendapatkan informasi mengenai data edoc AC yang bermasalah di SIPP.\n\nsipp agenda sidang\n\nuntuk mendapatkan informasi mengenai data agenda sidang terakhir yang bermasalah di SIPP.\n\nsipp permohonan delegasi\n\nuntuk mendapatkan informasi mengenai data permohonan panggilan delegasi yang bermasalah di SIPP.\n\nsipp verstek\n\nuntuk mendapatkan informasi mengenai data jenis putusan verstek yang bermasalah di SIPP.`;

      resolve(responseMessage);
    } else if (keyword[0] == "alasan cerai") {
      let responseMessage = `1.	Alasan Zina atau Selingkuh
      -	Sejak bulan/tahun _ Tergugat selingkuh / menjalin hubungan asmara dengan Wanita yang bernama _ dan telah dikaruniai 1 orang anak / belum dikaruniai anak;
      -	Penggugat mendapat informasi bahwa tergugat telah memiliki kekasih baru dari Handphone Tergugat/laporan tetangga/pengakuan tergugat/media sosial Tergugat;
      
      2.	Alasan Mabuk Minuman Keras
      -	Sejak Januari 2019 Tergugat mulai berubah sikap yaitu pulang kerumah dalam keadaan mabuk karena minuman keras;
      -	Penggugat mengetahui kalau Tergugat mabuk melihat sendiri, Tergugat mabuk sebanyak 2 kali;
      
      3.	Alasan Narkoba
      -	Sejak Bulan Januari 2018 Tergugat mulai mengkonsumsi obat-obatan terlarang (narkoba), jenis sabu-sabu, Tergugat mengkonsumsi obat-obat terlarang sebanyak 5 kali;
      -	Penggugat mengetahui Tergugat mengkonsumsi obat-obatan terlarang dari Handphone Tergugat/laporan tetangga/pengakuan tergugat/media sosial Tergugat;
      -	Penggugat sudah mengingatkan Tergugat supaya berhenti mengkonsumsi obat-obatan terlarang (NARKOBA);
      
      4.	Alasan Judi
      -	Sejak bulan Januari 2017 Tergugat mulai menghamburkan uang untuk berjudi yaitu judi online/gaplek;
      -	Penggugat mengetahui Tergugat berbuat judi dengan melihat sendiri Penggugat sudah mengingatkan Tergugat supaya berhenti bermain judi 
      
      5.	Alasan Pisah 2 Tahun
      -	Bahwa sejak bulan _ Tergugat pergi meninggalkan Penggugat, Tergugat pergi ke rumah orang tua, Tergugat pergi untuk jalan-jalan;
      -	Bahwa Tergugat pergi tanpa ijin dari Penggugat;
      -	Bahwa kepergian Tergugat sampai saat ini sudah 2  tahun, selama  kepergian tersebut Tergugat tidak pernah kembali dan menghubungi Penggugat;
      
      6.	Alasan di Penjara
      -	Bahwa pada bulan _ Tergugat telah dinyatakan sah melakukan  tindak pidana pencurian dan difonis hukuman penjara selama _ tahun _ bulan di Lembaga Permsayarakatan _;
      
      7.	Alasan Kekerasan
      -	Bahwa sejak bulan _ Tergugat melakukan tindakan kekerasan dalam rumah tangga yaitu menganiaya Penggugat dengan cara fisik/psikis;
      -	Adapun penyebab Tergugat melakukan penganiayaan tersebut adalah cemburu;
      
      8.	Alasan Cacat Badan
      -	Bahwa sejak bulan _ Tergugat mengalami cacat badan, yaitu karena Impotensi/Stroke, sejak kejadian tersebut Tergugat tidak lagi bisa menjalankan fungsi untuk memberikan nafkah lahir/ batin kepada Penggugat. Akibat dari kondisi tersebut kebutuhan lahir dan batin  Penggugat tidak lagi terpenuhi;
      
      9.	Alasan Perselisihan dan Pertengkaran Secara Terus Menerus
      -	Bahwa sejak bulan _ hubungan antara Penggugat dan Tergugat mulai tidak harmonis, sering terjadi peselisihan dan pertengkaran yang di sebabkan oleh 
      -	Tergugat sering marah-marah kepada Penggugat
      -	Tergugat tidak mau mendengarkan nasihat Penggugat
      -	Tergugat berkata kasar kepada Penggugat
      -	Tergugat menghina dan tidak menghormati orang tua Penggugat
      -	Tergugat tidak memberikan nafkah kepada Penggugat
      -	Tergugat tidak memberikan nafkah yang layak kepada Penggugat
      -	Termohon sulit untuk diminta berhubungan badan dengan Pemohon;
      -	Termohon sering mengeluh tentang nafkah yang diberikan Pemohon;
      -	Bahwa puncak perselisihan dan pertengkaran terjadi pada bulan _ Tergugat meninggalkan rumah;
      -	Bahwa pihak keluarga telah berusaha memberi nasehat, akan tetapi tidak berhasil karena Penggugat tetap pada prinsip untuk bercerai karena Tergugat sudah tidak mempunyai itikad baik lagi untuk menjalankan kehidupan rumah tangga;
      
      10.	Alasan Murtad
      -	Bahwa Tergugat/Termohon telah meninggalkan agama Islam dan sekarang telah menganut agama Kristen;
      -	Bahwa Penggugat/Pemohon mengetahuinya dengan melihat Tergugat/Termohon beribadah di Gereja dan sekarang menggunakan atribut Kristen berupa kalung salib;`;

      resolve(responseMessage);
    } else if (keyword[0] == "perkara") {
      let responseMessage = `Gunakan kata kunci dibawah ini untuk layanan informasi perkara : 
      1. Untuk mendapatkan salinan putusan yang bukan salinan resmi (SK-KMA 1-144/KMA/SK/I/2011) silahkan ketikkan : 
      *Putusan#nomor perkara*. _Contoh : putusan#123.G.2021_ 
      
      2. Untuk mengetahui rincian biaya perkara silahkan ketikkan : 
      *Biaya#nomor perkara*. _Contoh : biaya#123.G.2021_ 
      
      3.Untuk mengetahui jadwal sidang silahkan ketikkan : 
      *jadwal#nomor perkara*. _Contoh : jadwal#123.G.2021_

      4.Untuk mengetahui status perkara silahkan ketikkan : 
      *status#nomor perkara*. _Contoh : status#123.G.2021_ 
      
      5. Untuk mengetahui status akta cerai silahkan ketikkan : 
      *akta#nomor perkara*. _Contoh : akta#123.G.2021_ 
      
      6. Untuk memesan dan mengambil akta cerai silahkan ketikkan : 
      *pesan akta#nomor perkara*. _Contoh : pesan akta#123.G.2021_
      
      7. Untuk mengajukan pendaftaran perkara secara prodeo/gratis silahkan ketikkan : 
      *daftar prodeo*
      
      -_untuk mengetahui syarat prodeo silahkan ketikkan :_
      *syarat prodeo*

      8. Untuk mengetahui jadwal sidang hari ini silahkan ketikkan : 
      *jadwal sidang hari ini*
      
      9. Untuk mengetahui alasan-alasan perceraian menurut hukum yang berlaku silahkan ketikkan : 
      *alasan cerai*
      
      Berikut adalah Kode Perkara Yang Bisa Digunakan :
      *Perdata*
      _Perdata Gugatan : G_
      _Perdata Permohonan : P_
      _Perdata Gugatan Sederhana : GS_
      
      *Jinayah (Khusus Mahkamah Syar'iyah)*
      _Jinayah : JN_
      _Jinayah Praperadilan : JN.Pra_
      
      *Info Lengkap Kunjungi http://sipp.pa-donggala.go.id*`;

      //// 6. Untuk mengetahui informasi denda tilang silahkan ketikkan :
      ///// *Tilang#nomor polisi*. _Contoh : Tilang#DK1234P (nomor polisi tanpa spasi)_

      // MULAI MENGGUNAKAN FUNCTION
      resolve(responseMessage);
    } else if (keyword[0] == "jadwal") {
      if (keyword.length == 1) {
        let responseMessage =
          "Perintah salah silahkan ketik jadwal#nomor perkara\ncontoh : jadwal#123.G.2021\n(untuk perkara gugatan : G dan permohonan : P)";
        resolve(responseMessage);
        return;
      }
      let nomor_perkara = keyword[1]; 
      let nomor_perkara_parts = nomor_perkara.split(".");
      let nomor_perkara_formatted;
      if (nomor_perkara_parts[1] == "GS") {
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pdt.G.S/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "B") { // Pidana Biasa
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pid.B/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "S") { // Pidana Singkat
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pid.S/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "C") { // Pidana Cepat
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pid.C/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "Pra") { // Pidana Praperadilan
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pid.Pra/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "Sus-Anak") { // Pidana Khusus Anak
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pid.Sus-Anak/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "JN") { // Pidana Khusus Anak
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/JN/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "PraJN") { // Pidana Khusus Anak
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/JN.Pra/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else {
        nomor_perkara_formatted =
          nomor_perkara_parts[0] +
          "/Pdt." +
          nomor_perkara_parts[1] +
          "/" +
          nomor_perkara_parts[2] +
          "/PA.Dgl";
      }      
      let query = `SELECT tanggal_sidang,agenda FROM perkara LEFT JOIN perkara_jadwal_sidang ON perkara.perkara_id=perkara_jadwal_sidang.perkara_id WHERE nomor_perkara='${nomor_perkara_formatted}'`;
      db.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          let responseMessage;
          if (result.length != 0) {
            let resultArray = [];
            result.forEach((r) => {
              resultArray.push(
                `${moment(r.tanggal_sidang).format("DD-MM-YYYY")} : ${r.agenda}`
              );
            });
            responseMessage = resultArray.join("\n\n");

            // Daftar di atas memuat seluruh riwayat sidang, sedangkan persiapan
            // hanya berarti untuk sidang yang BELUM berlangsung. Menempelkan
            // persiapan untuk agenda yang sudah lewat akan menyuruh pihak
            // membawa saksi ke sidang yang sudah selesai.
            const hariIni = moment().startOf("day");
            const sidangBerikutnya = result
              .filter((r) => r.tanggal_sidang && moment(r.tanggal_sidang).isSameOrAfter(hariIni))
              .sort((a, b) => moment(a.tanggal_sidang).valueOf() - moment(b.tanggal_sidang).valueOf())[0];
            if (sidangBerikutnya) {
              responseMessage = sidangAgendaService.appendPreparation(
                responseMessage,
                sidangBerikutnya.agenda
              );
            }
          } else {
            responseMessage = `Tidak ada data`;
          }
          resolve(responseMessage);
        }
      });
    } else if (keyword[0] == "pesan akta") {
      if (keyword.length == 1) {
        let responseMessage =
          "Perintah salah silahkan ketik pesan akta#nomor perkara\ncontoh : pesan akta#123.G.2021\n(untuk perkara gugatan : G dan permohonan : P)";
        resolve(responseMessage);
        return;
      }
      let nomor_perkara = keyword[1]; 
      let nomor_perkara_parts = nomor_perkara.split(".");
      let nomor_perkara_formatted;
      if (nomor_perkara_parts[1] == "GS") {
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pdt.G.S/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "B") { // Pidana Biasa
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pid.B/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "S") { // Pidana Singkat
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pid.S/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "C") { // Pidana Cepat
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pid.C/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "Pra") { // Pidana Praperadilan
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pid.Pra/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "Sus-Anak") { // Pidana Khusus Anak
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pid.Sus-Anak/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "JN") { // Pidana Khusus Anak
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/JN/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "PraJN") { // Pidana Khusus Anak
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/JN.Pra/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else {
        nomor_perkara_formatted =
          nomor_perkara_parts[0] +
          "/Pdt." +
          nomor_perkara_parts[1] +
          "/" +
          nomor_perkara_parts[2] +
          "/PA.Dgl";
      }
      let query = `SELECT DISTINCT (nomor_perkara), nomor_akta_cerai, tgl_akta_cerai, proses_terakhir_text FROM perkara LEFT JOIN perkara_akta_cerai ON perkara.perkara_id = perkara_akta_cerai.perkara_id WHERE nomor_perkara='${nomor_perkara_formatted}' AND nomor_akta_cerai IS NOT NULL ORDER BY tgl_akta_cerai DESC`;

      db.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          let responseMessage;
          if (result.length != 0) {
            let aktacerai = `Silahkan Klik Link Berikut ini untuk Pemesanan Akta Cerai di https://wa.me/6285240993139?text=Assalamuaikum%20Wr%20Wb%20Saya%20pesan%20akta%20cerai%20nomor%20perkara%20${result[0].nomor_perkara}, 
          *Proses Terakhir :* ${result[0].proses_terakhir_text}`;

            responseMessage = aktacerai;
          } else {
            responseMessage = `Akta Cerai Belum Terbit`;
          }
          resolve(responseMessage);
        }
      });
    } else if (keyword[0] == "akta") {
      if (keyword.length == 1) {
        let responseMessage =
          "Perintah salah silahkan ketik akta#nomor perkara\ncontoh : akta#123.G.2021\n(untuk perkara gugatan : G dan permohonan : P)";
        resolve(responseMessage);
        return;
      }
      let nomor_perkara = keyword[1]; 
      let nomor_perkara_parts = nomor_perkara.split(".");
      let nomor_perkara_formatted;
      if (nomor_perkara_parts[1] == "GS") {
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pdt.G.S/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else {
        nomor_perkara_formatted =
          nomor_perkara_parts[0] +
          "/Pdt." +
          nomor_perkara_parts[1] +
          "/" +
          nomor_perkara_parts[2] +
          "/PA.Dgl";
      }
      let query = `SELECT DISTINCT (nomor_perkara), nomor_akta_cerai, tgl_akta_cerai, proses_terakhir_text FROM perkara LEFT JOIN perkara_akta_cerai ON perkara.perkara_id = perkara_akta_cerai.perkara_id WHERE nomor_perkara='${nomor_perkara_formatted}' AND nomor_akta_cerai IS NOT NULL ORDER BY tgl_akta_cerai DESC`;

      db.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          let responseMessage;
          if (result.length != 0) {
            let aktacerai = `*No Perkara :* ${result[0].nomor_perkara}, 
        *Nomor Akta Cerai :* ${result[0].nomor_akta_cerai}, 
        *Tanggal Akta Cerai:* ${moment(result[0].tgl_akta_cerai).format(
          "DD-MM-YYYY"
        )}
        *Proses Terakhir :* ${result[0].proses_terakhir_text}`;

            responseMessage = aktacerai;
          } else {
            responseMessage = `Akta Cerai Belum Terbit`;
          }
          resolve(responseMessage);
        }
      });
    } else if (keyword[0] == "tilang") {
      if (keyword.length == 1) {
        let responseMessage =
          "Perintah salah silahkan ketik tilang#nomor polisi\ncontoh : tilang#DN4321AA";
        resolve(responseMessage);
        return;
      }
      let query = `SELECT amar_putusan FROM perkara_putusan LEFT JOIN perkara_lalulintas ON perkara_putusan.perkara_id=perkara_lalulintas.perkara_id WHERE nomor_polisi='${nomor_perkara_formatted}'`;
      db.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          let responseMessage;
          if (result.length != 0) {
            let dataAmar = result[0].amar_putusan.split("<br/>").join(" ");

            responseMessage = dataAmar;
          } else {
            responseMessage = `Tidak ada data`;
          }
          resolve(responseMessage);
        }
      });
      } else if (keyword[0] == "saksi") {
        if (keyword.length == 1) {
          let responseMessage =
            "Perintah salah silahkan ketik saksi#nomor perkara\ncontoh : saksi#123.G.2021\n(untuk perkara gugatan : G dan permohonan : P)";
          resolve(responseMessage);
          return;
        }
        let nomor_perkara = keyword[1]; 
        let nomor_perkara_parts = nomor_perkara.split(".");
        let nomor_perkara_formatted;
        if (nomor_perkara_parts[1] == "GS") {
          nomor_perkara_formatted =
            nomor_perkara_parts[0] + "/Pdt.G.S/" + nomor_perkara_parts[2] + "/PA.Dgl";
        } else if (nomor_perkara_parts[1] == "B") { // Pidana Biasa
          nomor_perkara_formatted =
            nomor_perkara_parts[0] + "/Pid.B/" + nomor_perkara_parts[2] + "/PA.Dgl";
        } else if (nomor_perkara_parts[1] == "S") { // Pidana Singkat
          nomor_perkara_formatted =
            nomor_perkara_parts[0] + "/Pid.S/" + nomor_perkara_parts[2] + "/PA.Dgl";
        } else if (nomor_perkara_parts[1] == "C") { // Pidana Cepat
          nomor_perkara_formatted =
            nomor_perkara_parts[0] + "/Pid.C/" + nomor_perkara_parts[2] + "/PA.Dgl";
        } else if (nomor_perkara_parts[1] == "Pra") { // Pidana Praperadilan
          nomor_perkara_formatted =
            nomor_perkara_parts[0] + "/Pid.Pra/" + nomor_perkara_parts[2] + "/PA.Dgl";
        } else if (nomor_perkara_parts[1] == "Sus-Anak") { // Pidana Khusus Anak
          nomor_perkara_formatted =
            nomor_perkara_parts[0] + "/Pid.Sus-Anak/" + nomor_perkara_parts[2] + "/PA.Dgl";
        } else if (nomor_perkara_parts[1] == "JN") { // Pidana Khusus Anak
          nomor_perkara_formatted =
            nomor_perkara_parts[0] + "/JN/" + nomor_perkara_parts[2] + "/PA.Dgl";
        } else if (nomor_perkara_parts[1] == "PraJN") { // Pidana Khusus Anak
          nomor_perkara_formatted =
            nomor_perkara_parts[0] + "/JN.Pra/" + nomor_perkara_parts[2] + "/PA.Dgl";
        } else {
          nomor_perkara_formatted =
            nomor_perkara_parts[0] +
            "/Pdt." +
            nomor_perkara_parts[1] +
            "/" +
            nomor_perkara_parts[2] +
            "/PA.Dgl";
        }
        let query = `SELECT nama FROM perkara_pihak5 left join perkara on perkara_pihak5.perkara_id = perkara.perkara_id WHERE saksi_pihak_ke=1 AND nomor_perkara='${nomor_perkara_formatted}' ORDER by urutan`;
        db.query(query, (err, result) => {
          if (err) {
            reject(err);
          } else {
            let responseMessage;
            if (result.length != 0) {
              let dataAmar = result[0].amar_putusan.split("<br/>").join(" ");

              responseMessage = dataAmar;
            } else {
              responseMessage = `Tidak ada data`;
            }
            resolve(responseMessage);
          }
        });
      } else if (["daftar antrian", "antrian online", "ambil antrian", "ambil antrian online", "daftar hadir"].includes(keyword[0])) {
        const nomorPerkaraInput = keyword.slice(1).join("#").trim();
        antrianOnlineService
          .registerOnlineQueue({
            nomorPerkara: nomorPerkaraInput,
            message,
            partySlot: keyword[0] == "antrian online" ? "pihak_2" : "pihak_1",
            senderNumber: context.senderNumber || "",
          })
          .then((result) => {
            console.log("Pesan balasan: " + result.answer);
            resolve(result.answer);
          })
          .catch((err) => {
            console.error("Error dalam antrian online: ", err);
            reject(err);
          });
    } else if (keyword[0] == "biaya") {
      if (keyword.length == 1) {
        let responseMessage =
          "Perintah salah silahkan ketik biaya#nomor perkara\ncontoh : biaya#123.G.2021\n(untuk perkara gugatan : G dan permohonan : P)";
        resolve(responseMessage);
        return;
      }
      let nomor_perkara = keyword[1]; 
      let nomor_perkara_parts = nomor_perkara.split(".");
      let nomor_perkara_formatted;
      if (nomor_perkara_parts[1] == "GS") {
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pdt.G.S/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "B") { // Pidana Biasa
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pid.B/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "S") { // Pidana Singkat
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pid.S/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "C") { // Pidana Cepat
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pid.C/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "Pra") { // Pidana Praperadilan
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pid.Pra/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "Sus-Anak") { // Pidana Khusus Anak
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pid.Sus-Anak/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "JN") { // Pidana Khusus Anak
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/JN/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "PraJN") { // Pidana Khusus Anak
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/JN.Pra/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else {
        nomor_perkara_formatted =
          nomor_perkara_parts[0] +
          "/Pdt." +
          nomor_perkara_parts[1] +
          "/" +
          nomor_perkara_parts[2] +
          "/PA.Dgl";
      }
      let queryBiayaMasuk = `SELECT nomor_perkara,jumlah,uraian FROM perkara LEFT JOIN perkara_biaya ON perkara.perkara_id=perkara_biaya.perkara_id WHERE nomor_perkara='${nomor_perkara_formatted}' AND jenis_transaksi=1`;
      let queryBiayaKeluar = `SELECT nomor_perkara,jumlah,uraian FROM perkara LEFT JOIN perkara_biaya ON perkara.perkara_id=perkara_biaya.perkara_id WHERE nomor_perkara='${nomor_perkara_formatted}' AND jenis_transaksi=-1`;

      const dataBiaya = async () => {
        const masuk = await biayaMasuk(queryBiayaMasuk);
        const keluar = await biayaKeluar(queryBiayaKeluar);
        const sisa = (masuk.detailJumlah - keluar.detailJumlah).toLocaleString();
        let biayaAsli = `${masuk.detailBiaya} \n\n ${keluar.detailBiaya} \n\n *Sisa* : ${sisa}`;
        // console.log(biayaAsli);
        return biayaAsli;
      };
      

      resolve(dataBiaya());
    } else if (keyword[0] == "putusan") {
      if (keyword.length == 1) {
        let responseMessage =
          "Perintah salah silahkan ketik putusan#nomor perkara\ncontoh : putusan#123.G.2021\n(untuk perkara gugatan : G dan permohonan : P)";
        resolve(responseMessage);
        return;
      }
      let nomor_perkara = keyword[1]; 
      let nomor_perkara_parts = nomor_perkara.split(".");
      let nomor_perkara_formatted;
      if (nomor_perkara_parts[1] == "GS") {
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pdt.G.S/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "B") { // Pidana Biasa
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pid.B/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "S") { // Pidana Singkat
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pid.S/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "C") { // Pidana Cepat
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pid.C/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "Pra") { // Pidana Praperadilan
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pid.Pra/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "Sus-Anak") { // Pidana Khusus Anak
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pid.Sus-Anak/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "JN") { // Pidana Khusus Anak
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/JN/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "PraJN") { // Pidana Khusus Anak
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/JN.Pra/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else {
        nomor_perkara_formatted =
          nomor_perkara_parts[0] +
          "/Pdt." +
          nomor_perkara_parts[1] +
          "/" +
          nomor_perkara_parts[2] +
          "/PA.Dgl";
      }
      let query = `SELECT DISTINCT(nomor_perkara), tanggal_putusan, link_dirput FROM perkara LEFT JOIN perkara_putusan ON perkara.perkara_id=perkara_putusan.perkara_id LEFT JOIN dirput_dokumen ON perkara.perkara_id=dirput_dokumen.perkara_id WHERE nomor_perkara='${nomor_perkara_formatted}' AND link_dirput IS NOT NULL ORDER BY tanggal_putusan DESC`;

      db.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          let responseMessage;
          if (result.length != 0) {
            let link_baru = result[0].link_dirput.split(".");
            let link2 = [link_baru[0] + "3"];
            link_baru.shift();
            let link_dirput = [...link2, ...link_baru].join(".");
            let linkPutusan = `No Perkara: ${result[0].nomor_perkara}, tanggal putusan: ${moment(result[0].tanggal_putusan).format("DD-MM-YYYY")}, link: ${link_dirput}`;

            responseMessage = linkPutusan;
          } else {
            responseMessage = `Tidak ada data`;
          }
          resolve(responseMessage);
        }
      });

      // LAGI DALAM PENGERJAAN
    } else if (keyword[0] === "status") {
      if (keyword.length === 1) {
        let responseMessage =
          "Perintah salah, silahkan ketik jadwal#nomor perkara\ncontoh : status#123.G.2021\n(untuk perkara gugatan : G dan permohonan : P)";
        resolve(responseMessage);
        return;
      }
      let nomor_perkara = keyword[1]; 
      let nomor_perkara_parts = nomor_perkara.split(".");
      let nomor_perkara_formatted;
      if (nomor_perkara_parts[1] == "GS") {
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pdt.G.S/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "B") { // Pidana Biasa
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pid.B/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "S") { // Pidana Singkat
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pid.S/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "C") { // Pidana Cepat
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pid.C/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "Pra") { // Pidana Praperadilan
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pid.Pra/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "Sus-Anak") { // Pidana Khusus Anak
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/Pid.Sus-Anak/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "JN") { // Pidana Khusus Anak
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/JN/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else if (nomor_perkara_parts[1] == "PraJN") { // Pidana Khusus Anak
        nomor_perkara_formatted =
          nomor_perkara_parts[0] + "/JN.Pra/" + nomor_perkara_parts[2] + "/PA.Dgl";
      } else {
        nomor_perkara_formatted =
          nomor_perkara_parts[0] +
          "/Pdt." +
          nomor_perkara_parts[1] +
          "/" +
          nomor_perkara_parts[2] +
          "/PA.Dgl";
      }
      let query = `SELECT 
      a.nomor_perkara,
      a.jenis_perkara_nama,
      a.tanggal_pendaftaran,
      b.tanggal_sidang,
      b.agenda,
      b.ruangan,
      FORMAT(
          (SELECT c.jumlah FROM perkara_biaya AS c WHERE a.perkara_id = c.perkara_id AND c.urutan = 1), 
          0
      ) AS jumlah,
      CASE 
          WHEN d.status_putusan_id = '62' THEN 'Dikabulkan'
          WHEN d.status_putusan_id = '63' THEN 'Ditolak'
          WHEN d.status_putusan_id = '64' THEN 'Niet/NO (Tidak Dapat Diterima)'
          WHEN d.status_putusan_id = '65' THEN 'Digugurkan'
          WHEN d.status_putusan_id = '93' THEN 'Gugur'
          WHEN d.status_putusan_id = '66' THEN 'Dicoret'
          WHEN d.status_putusan_id = '67' THEN 'Dicabut'
          WHEN d.status_putusan_id = '85' THEN 'Damai'
          ELSE '-'
            END AS status_putusan
      FROM 
            perkara AS a
      LEFT JOIN 
            perkara_jadwal_sidang AS b ON a.perkara_id = b.perkara_id 
      LEFT JOIN 
            perkara_putusan AS d ON a.perkara_id = d.perkara_id 
      WHERE 
            a.nomor_perkara = '${nomor_perkara_formatted}'
            AND b.tanggal_sidang = (
                SELECT MAX(tanggal_sidang) 
                FROM perkara_jadwal_sidang 
                WHERE perkara_id = a.perkara_id
            )
      GROUP BY 
            a.nomor_perkara, 
            a.jenis_perkara_nama,
            b.tanggal_sidang,
            b.agenda, 
            b.ruangan, 
            d.status_putusan_id
      ORDER BY 
            b.tanggal_sidang DESC;`;
    
      db.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          let responseMessage;
          if (result.length != 0) {
            let status = `*No Perkara:* ${result[0].nomor_perkara},\n*Jenis Perkara:* ${result[0].jenis_perkara_nama},\n*Tanggal Pendaftaran:* ${moment(result[0].tanggal_pendaftaran).format("DD-MM-YYYY")},\n*Tanggal Sidang Terakhir:* ${moment(result[0].tanggal_sidang).format("DD-MM-YYYY")},\n*Agenda Sidang:* ${result[0].agenda},\n*Ruang Sidang:* ${result[0].ruangan},\n*Biaya Panjar:* Rp ${result[0].jumlah.toLocaleString()}\n*Status Putusan:* ${result[0].status_putusan}\n\n*Info Lengkap Kunjungi http://sipp.pa-donggala.go.id*`;
    
            responseMessage = status;
          } else {
            responseMessage = `Tidak ada data`;
          }
          resolve(responseMessage);
        }
      });
    } else if (keyword[0] === "cek") {
      if (keyword.length === 1) {
        let responseMessage =
          "Perintah salah, silahkan ketik cek#nomor indentitas kependudukan\ncontoh : cek#7209998919219993";
        resolve(responseMessage);
        return;
      }
      let nomor_identitas = keyword[1];
      
      let query = `SELECT DISTINCT
      a.perkara_id, 
      a.nama, 
      b.telepon,
      b.nomor_indentitas,
      a.nomor_perkara,
      a.jenis_perkara_nama,
      REPLACE(c.para_pihak, '<br />', '\n') AS para_pihak,
      CASE WHEN b.jenis_kelamin = 'P' THEN 'Bu'
				ELSE 'Pak'
				END AS jenis_kelamin,
      x.link_dirput,
      v.status_putusan_kode
  FROM 
      v_pihak_perkara a
      JOIN pihak b ON b.id = a.pihak_id 
          AND b.telepon REGEXP '^[0-9]' 
          AND CHAR_LENGTH(b.telepon) > 8
      LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
      LEFT JOIN perkara_akta_cerai d ON d.perkara_id = a.perkara_id
      LEFT JOIN (
          SELECT 
              perkara_id, 
              MAX(tanggal_sidang) AS tanggal_sidang_terakhir,
              agenda,
              ruangan
          FROM 
              perkara_jadwal_sidang
          GROUP BY 
              perkara_id
      ) AS subq ON c.perkara_id = subq.perkara_id
      LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = subq.perkara_id
      LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
      LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
      JOIN perkara_putusan m ON m.perkara_id = c.perkara_id
      LEFT JOIN perkara_hakim_pn n ON n.perkara_id = c.perkara_id
      LEFT JOIN v_perkara v ON v.perkara_id = c.perkara_id
      LEFT JOIN dirput_dokumen x ON x.perkara_id = c.perkara_id
  WHERE 
      c.alur_perkara_id IN (15, 16, 17)
      AND c.jenis_perkara_id IN (346, 347)
      AND f.status_putusan_id = 62
      AND b.nomor_indentitas = ${nomor_identitas}
      AND (
          (c.jenis_perkara_id = 346 AND g.status_penetapan_ikrar_talak_id = 1) 
          OR c.jenis_perkara_id = 347
      )
  ORDER BY c.alur_perkara_id, c.perkara_id DESC;`;
    
      db.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          let responseMessage;
          if (result.length != 0) {
            let status = `Pihak atas nama ${result[0].jenis_kelamin} ${result[0].nama} dengan NIK ${result[0].nomor_indentitas} pernah mengajukan perceraian di ${pengadilan} dengan rincian sebagai berikut :\n*No Perkara: ${result[0].nomor_perkara}*,\n*Jenis Perkara:* ${result[0].jenis_perkara_nama},\n*Status Putusan:* ${result[0].status_putusan_kode}\n*Link Putusan:* ${result[0].link_dirput}\n\n*Info Lengkap Kunjungi http://sipp.pa-donggala.go.id*`;
    
            responseMessage = status;
          } else {
            responseMessage = `Tidak ada data`;
          }
          resolve(responseMessage);
        }
      });
    } else if (keyword[0] === "amar hari ini") {
      if (keyword.length < 2) {
        let responseMessage = "Perintah salah, silahkan ketik amar#nama jurusita lengkap\ncontoh : amar#Harbi";
        return Promise.reject(responseMessage);
      }
    
      let jurusitaNama = keyword.slice(1).join(' ');
    
      let query = `SELECT
          a.perkara_id,
          CASE 
            WHEN d.dihadiri_oleh = 2 THEN b.pihak2_text 
            WHEN d.dihadiri_oleh = 3 THEN b.pihak1_text 
            WHEN d.dihadiri_oleh = 4 THEN CONCAT(b.pihak1_text, ' AND ', b.pihak2_text) 
          END AS pihak_yang_dipanggil,
          a.amar_putusan,
          a.status_putusan_id,
          CASE WHEN a.putusan_verstek = 'Y' THEN 'Verstek' ELSE '-' END AS putusan_verstek,
          b.nomor_perkara,
          b.jenis_perkara_nama,
          c.jurusita_nama,
          CASE 
            WHEN a.status_putusan_id = '62' THEN 'Kabul'
            WHEN a.status_putusan_id = '63' THEN 'Tolak'
            WHEN a.status_putusan_id = '64' THEN 'Niet/NO'
            WHEN a.status_putusan_id = '65' THEN 'Digugurkan'
            WHEN a.status_putusan_id = '93' THEN 'Gugur'
            WHEN a.status_putusan_id = '66' THEN 'Coret'
            WHEN a.status_putusan_id = '67' THEN 'Cabut'
            WHEN a.status_putusan_id = '85' THEN 'Damai'
            ELSE 'Unknown'
          END AS jenis_putusan
        FROM 
          perkara_putusan AS a
        JOIN 
          perkara AS b ON a.perkara_id = b.perkara_id
        JOIN 
          perkara_jurusita AS c ON a.perkara_id = c.perkara_id
        JOIN
          perkara_jadwal_sidang AS d ON a.perkara_id = d.perkara_id
        WHERE 
          a.tanggal_putusan = CURDATE() AND d.dihadiri_oleh <> 1 AND c.jurusita_nama LIKE '%${jurusitaNama}%'`;
    
        db.query(query, [`%${jurusitaNama}%`], (err, result) => {
          if (err) {
            reject(err);
          } else {
            let responseMessage;
            if (result.length != 0) {
              let resultArray = [];
              let no = 1;
              result.forEach((r) => {
                resultArray.push(
                  `${no++}.*No Perkara :* ${r.nomor_perkara}${r.jenis_putusan}, \n*amar : ${r.amar_putusan},`
                );
              });
              responseMessage = resultArray.join("\n\n");
            } else {
              responseMessage = `Tidak ada data`;
            }
            resolve(responseMessage);
          }
        });
    } else if (keyword[0] == "covid") {
      let prov = "PALU";

      let dataProv = async () => {
        let data = await axios
          .get("https://data.covid19.go.id/public/api/prov.json")
          .then((response) => {
            let data = response.data.list_data.filter((obj) => {
              return obj.key == prov;
            });
            return `Provinsi : ${
              data[0].key
            } \nJumlah kasus : ${data[0].jumlah_kasus.toLocaleString()} \nJumlah sembuh : ${data[0].jumlah_sembuh.toLocaleString()} \nJumlah meninggal : ${data[0].jumlah_meninggal.toLocaleString()}`;
          })
          .catch((err) => {
            return "Api error";
          });

        return data;
      };

      let dataIndonesia = async () => {
        let data = axios
          .get("https://data.covid19.go.id/public/api/update.json")
          .then((response) => {
            return `Indonesia \nJumlah positif : ${response.data.update.total.jumlah_positif.toLocaleString()} \nJumlah sembuh : ${response.data.update.total.jumlah_sembuh.toLocaleString()} \nJumlah meninggal : ${response.data.update.total.jumlah_meninggal.toLocaleString()}`;
          })
          .catch((err) => {
            return "Api error";
          });
        return data;
      };

      let msg = async () => {
        let jmlProv = await dataProv();
        let jmlIndonesia = await dataIndonesia();
        return `${jmlProv} \n\n${jmlIndonesia}`;
      };

      resolve(msg());

      // axios
      //   .get("https://data.covid19.go.id/public/api/update.json")
      //   .then((response) => {
      //     let responseMessage = `Jumlah positif : *${response.data.update.total.jumlah_positif.toLocaleString()}* \nJumlah sembuh : *${response.data.update.total.jumlah_sembuh.toLocaleString()}* \nJumlah meninggal : *${response.data.update.total.jumlah_meninggal.toLocaleString()}*`;
      //     resolve(responseMessage);
      //   })
      //   .catch((err) => {
      //     let responseMessage = "Api error";
      //     resolve(responseMessage);
      //   });

      // try {
      //   axios.get("https://api.kawalcorona.com/indonesia").then((response) => {
      //     let responseMessage = `Jumlah positif : *${response.data[0].positif}* \nJumlah sembuh : *${response.data[0].sembuh}* \nJumlah meninggal : *${response.data[0].meninggal}*`;

      //     resolve(responseMessage);
      //   });
      // } catch (error) {
      //   let responseMessage = `Koneksi ke API error`;
      //   resolve(responseMessage);
      // }

      //QUERY UNTUK ORANG KANTOR
    } else if (keyword[0] == "monev bas") {
      let query = `SELECT nomor_perkara,tanggal_sidang,agenda,panitera_nama FROM perkara LEFT JOIN perkara_jadwal_sidang ON perkara.perkara_id=perkara_jadwal_sidang.perkara_id LEFT JOIN perkara_panitera_pn ON perkara.perkara_id=perkara_panitera_pn.perkara_id WHERE (alur_perkara_id=1 OR alur_perkara_id =2 OR alur_perkara_id=15 OR alur_perkara_id =16 OR alur_perkara_id=17 OR alur_perkara_id=111 OR alur_perkara_id=112 OR alur_perkara_id=118 OR alur_perkara_id=119 OR alur_perkara_id=120 OR alur_perkara_id=121) AND (YEAR(tanggal_sidang)=YEAR(NOW()) AND tanggal_sidang<=CURDATE()-1 AND edoc_bas IS NULL) ORDER BY tanggal_sidang DESC`;

      db.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          let responseMessage;
          if (result.length != 0) {
            let resultArray = [];
            let no = 1;
            result.forEach((r) => {
              resultArray.push(
                `${no++}.No Perkara : ${r.nomor_perkara}\ntanggal sidang : ${moment(
                  r.tanggal_sidang
                ).format("DD-MM-YYYY")}\nagenda : ${r.agenda}\nPP : ${
                  r.panitera_nama
                }`
              );
            });
            responseMessage = resultArray.join("\n\n");
          } else {
            responseMessage = `Tidak ada data`;
          }
          resolve(responseMessage);
        }
      });
    } else if (keyword[0] == "monev penahanan") {
      let query = `SELECT
      tanggal_akhir,
      id,
      nomor_perkara,
      tanggal_putusan
      FROM
      (
        SELECT
          MAX(sampai) as tanggal_akhir,
          penahanan_terdakwa.perkara_id as id
        FROM
          penahanan_terdakwa
        GROUP BY
          penahanan_terdakwa.perkara_id
        ORDER BY
          penahanan_terdakwa.perkara_id DESC
      ) AS custom
      LEFT JOIN perkara ON custom.id = perkara.perkara_id
      LEFT JOIN perkara_putusan ON custom.id = perkara_putusan.perkara_id
      WHERE
      tanggal_akhir >= CURDATE()
      AND tanggal_akhir <= CURDATE() + 10
      AND tanggal_putusan IS NULL`;

      db.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          let responseMessage;
          if (result.length != 0) {
            let resultArray = [];
            let no = 1;
            result.forEach((r) => {
              resultArray.push(
                `${no++}.Nomor perkara : ${
                  r.nomor_perkara
                }\n'Tanggal penahanan terakhir : ${moment(
                  r.tanggal_akhir
                ).format("DD-MM-YYYY")}`
              );
            });
            responseMessage = resultArray.join("\n\n");
          } else {
            responseMessage = `Tidak ada data`;
          }
          resolve(responseMessage);
        }
      });
    } else if (keyword[0] == "dirput hukum") {
      let query = `SELECT DISTINCT(nomor_perkara),tanggal_putusan,link_dirput,dokumen_ref_id
      FROM perkara
      LEFT JOIN perkara_putusan ON perkara.perkara_id=perkara_putusan.perkara_id
      LEFT JOIN dirput_dokumen ON perkara.perkara_id=dirput_dokumen.perkara_id
      WHERE (alur_perkara_id=1 OR alur_perkara_id =2 OR alur_perkara_id=8 OR alur_perkara_id=15 OR alur_perkara_id =16 OR alur_perkara_id=17 OR alur_perkara_id=111 OR alur_perkara_id=112 OR alur_perkara_id=118 OR alur_perkara_id=119 OR alur_perkara_id=120 OR alur_perkara_id=121 OR alur_perkara_id=122) AND (tanggal_putusan IS NOT NULL AND link_dirput IS NULL AND (dokumen_ref_id BETWEEN 88 AND 100) AND YEAR(tanggal_putusan)= YEAR(CURDATE()))
      ORDER BY tanggal_putusan DESC`;

      db.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          let responseMessage;
          if (result.length != 0) {
            let resultArray = [];
            let no = 1;
            result.forEach((r) => {
              resultArray.push(
                `${no++}. No Perkara : *${r.nomor_perkara}*\ntanggal putusan : ${moment(
                  r.tanggal_putusan
                ).format("DD-MM-YYYY")}`
              );
            });
            let link = resultArray.join("\n\n");
            let jml = resultArray.length;
            responseMessage = `Jumlah : ${jml} \n${link}`;
          } else {
            responseMessage = `Tidak ada data`;
          }
          resolve(responseMessage);
        }
      });
    } else if (keyword[0] == "monev relaas") {
      const message = async () => {
        let promiseBelumPanggilan = notification.getBelumPanggilan();
        let messageBelumPanggilan = await promiseBelumPanggilan;
        let msg = `*Panggilan belum dilaksanakan/belum upload* : \n${messageBelumPanggilan}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev pbt") {
      const message = async () => {
        let promisePemberitahuanPutusanBelum = notification.getDataPemberitahuanPutusanBelum();
        let messagePemberitahuanPutusanBelum = await promisePemberitahuanPutusanBelum;
        let msg = `*PBT belum dilaksanakan/belum upload* : \n${messagePemberitahuanPutusanBelum}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev minutasi") {
      const message = async () => {
        let promisePutusanBelumMinut = notification.getDataPutusanBelumMinut();
        let messagePutusanBelumMinut = await promisePutusanBelumMinut;
        let msg = `*Putusan belum diinput minutasi* : \n${messagePutusanBelumMinut}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev publikasi") {
      const message = async () => {
        let promiseDataPublikasi = notification.getDataPublikasi();
        let messageDataPublikasi = await promiseDataPublikasi;
        let msg = `*Perkara publikasi tidak sesuai* : \n${messageDataPublikasi}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev arsip") {
      const message = async () => {
        let promiseBelumSerahHukum = notification.getDataBelumSerahHukum();
        let messageBelumSerahHukum = await promiseBelumSerahHukum;
        let msg = `*Perkara yang belum diupload ke Arsip SIPP* : \n${messageBelumSerahHukum}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev saksi salah") {
      const message = async () => {
        let promiseSaksiTidakLengkap = notification.getDataSaksiTidakLengkap();
        let messageSaksiTidakLengkap = await promiseSaksiTidakLengkap;
        let msg = `*Saksi lupa diinput padahal sudah di putus* : \n${messageSaksiTidakLengkap}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev court calender") {
      const message = async () => {
        let promiseDataCourtCalendar = notification.getDataCourtCalendar();
        let messageDataCourtCalendar = await promiseDataCourtCalendar;
        let msg = `*Data Court Calendar belum diinput padahal sudah sampai putusan/penetapan* : \n${messageDataCourtCalendar}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev court calender edoc") {
      const message = async () => {
        let promiseBelumEdocCC = notification.getBelumEdocCourtCalendar();
        let messageBelumEdocCC = await promiseBelumEdocCC;
        let msg = `*Edoc Court Calendar belum diupload* : \n${messageBelumEdocCC}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev putusan") {
      const message = async () => {
        let promiseEdocPutusan = notification.getDataEdocPutusan();
        let messageEdocPutusan = await promiseEdocPutusan;
        let msg = `*Edoc Putusan belum diupload* : \n${messageEdocPutusan}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev patut") {
      const message = async () => {
        let promisePanggilanTidakPatut = notification.getPanggilanTidakPatut();
        let messagePanggilanTidakPatut = await promisePanggilanTidakPatut;
        let msg = `*Panggilan Tidak Patut* : \n${messagePanggilanTidakPatut}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev pos") {
      const message = async () => {
        let promisePanggilanPosTidakPatut = notification.getPanggilanPosTidakPatut();
        let messagePanggilanPosTidakPatut = await promisePanggilanPosTidakPatut;
        let msg = `*Panggilan Pos Tidak Patut* : \n${messagePanggilanPosTidakPatut}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev lupa") {
      const message = async () => {
        let promiseUploadPutusan = notification.getDataUploadPutusan();
        let messageUploadPutusan = await promiseUploadPutusan;
        let promiseTundaMediasi = notification.getDataTundaMediasi();
        let messageTundaMediasi = await promiseTundaMediasi;
        let promiseLupaTunda = notification.getDataLupaTunda();
        let messageLupaTunda = await promiseLupaTunda;
        let msg = `*Perkara yang lupa di putus* : \n${messageUploadPutusan} \n\n*Perkara yang belum tunda mediasi* : \n${messageTundaMediasi} \n\n*Perkara yang lupa tunda sidang* : \n${messageLupaTunda}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev putus lebih 30 hari") {
      const message = async () => {
        let promisePutusLebih30Hari = notification.getDataPutusLebih30Hari();
        let messagePutusLebih30Hari = await promisePutusLebih30Hari;
        let msg = `*Perkara yang putus lebih dari 30 hari* : \n${messagePutusLebih30Hari}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev sidang lebih 30 hari") {
      const message = async () => {
        let promiseSidangLebih30Hari = notification.getDataSidangLebih30Hari();
        let messageSidangLebih30Hari = await promiseSidangLebih30Hari;
        let msg = `*Perkara yang lagi berjalan sidangnya lebih dari 30 hari* : \n${messageSidangLebih30Hari}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev delegasi masuk") {
      const message = async () => {
        let promiseDataBelumDelegasi = notification.getDataBelumDelegasi();
        let messageDataBelumDelegasi = await promiseDataBelumDelegasi;
        let msg = `*Delegasi masuk yang belum dilaksanakan/belum upload* : \n${messageDataBelumDelegasi}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev delegasi keluar") {
      const message = async () => {
        let promiseBelumDelegasiKeluar = notification.getDataBelumDelegasiKeluar();
        let messageBelumDelegasiKeluar = await promiseBelumDelegasiKeluar;
        let msg = `*Delegasi keluar yang tidak melalui Delegasi SIPP* : \n${messageBelumDelegasiKeluar}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev upaya hukum") {
      const message = async () => {
        let promiseDatabanding = notification.getDataBanding();
        let messageDataBanding = await promiseDatabanding;
        let promiseSisaPanjarBanding = notification.getDataSisaPanjarBanding();
        let messageSisaPanjarBanding = await promiseSisaPanjarBanding;
        let promiseBelumBhtBanding = notification.getBelumBhtBanding();
        let messageBelumBhtBanding = await promiseBelumBhtBanding;
        let promiseDataKasasi = notification.getDataKasasi();
        let messageDataKasasi = await promiseDataKasasi;
        let promiseSisaPanjarKasasi = notification.getDataSisaPanjarKasasi();
        let messageSisaPanjarKasasi = await promiseSisaPanjarKasasi;
        let promiseBelumBhtKasasi = notification.getBelumBhtKasasi();
        let messageBelumBhtKasasi = await promiseBelumBhtKasasi;
        let promiseDataPK = notification.getDataPK();
        let messageDataPK = await promiseDataPK;
        let msg = `*Status Banding* : \n${messageDataBanding} \n\n*Sisa Panjar Banding* : \n${messageSisaPanjarBanding} \n\n*Belum BHT Banding* : \n${messageBelumBhtBanding} \n\n*Status Kasasi* : \n${messageDataKasasi} \n\n*Sisa Panjar Kasasi* : \n${messageSisaPanjarKasasi} \n\n*Belum BHT Kasasi* : \n${messageBelumBhtKasasi} \n\n*Status PK* : \n${messageDataPK}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev cerai anak") {
      const message = async () => {
        let promiseCeraiAnakBelum = notification.getDataCeraiAnakBelum();
        let messageCeraiAnakBelum = await promiseCeraiAnakBelum;
        let msg = `*Data anak dalam perkara perceraian yang tidak diinput di SIPP* : \n${messageCeraiAnakBelum}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev verstek") {
      const message = async () => {
        let promiseDataVerstek = notification.getDataVerstek();
        let messageDataVerstek = await promiseDataVerstek;
        let msg = `*Perkara verstek yang salah/lupa input di SIPP* : \n${messageDataVerstek}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev bht") {
      const message = async () => {
        let promiseBelumBhtPerdata = notification.getDataBelumBhtPerdata();
        let messageBelumBhtPerdata = await promiseBelumBhtPerdata;
        let msg = `*BHT yang belum diinput di SIPP* : \n${messageBelumBhtPerdata}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev tunda mediasi") {
      const message = async () => {
        let promiseTundaMediasi = notification.getDataTundaMediasi();
        let messageTundaMediasi = await promiseTundaMediasi;
        let msg = `*Mediasi yang lupa ditunda* : \n${messageTundaMediasi}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev petitum") {
      const message = async () => {
        let promiseDataPetitum = notification.getDataEdocPetitum();
        let messageDataPetitum = await promiseDataPetitum;
        let msg = `*Edoc Petitum yang belum diupload di SIPP* : \n${messageDataPetitum}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev anom") {
      const message = async () => {
        let promiseDataEdocAnonimisasi = notification.getDataEdocAnonimisasi();
        let messageDataAnonimisasi = await promiseDataEdocAnonimisasi;
        let msg = `*Edoc Anonimisasi yang belum diupload di SIPP* : \n${messageDataAnonimisasi}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev panjar") {
      const message = async () => {
        let promiseSisaPanjarPn = notification.getDataSisaPanjarPn();
        let messageSisaPanjarPn = await promiseSisaPanjarPn;
        let msg = `*Sisa panjar yang telah putus namun belum dikeluarkan* : \n${messageSisaPanjarPn}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev ecourt") {
      const message = async () => {
        let promiseDaftarEcourt = notification.getDataDaftarEcourt();
        let messageDaftarEcourt = await promiseDaftarEcourt;
        let msg = `*Daftar perkara yang terdaftar melalui E-Court :* \n${messageDaftarEcourt}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev prodeo") {
      const message = async () => {
        let promiseDaftarProdeo = notification.getDataDaftarProdeo();
        let messageDaftarProdeo = await promiseDaftarProdeo;
        let msg = `*Daftar perkara yang biayanya terdaftar secara Prodeo :* \n${messageDaftarProdeo}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev ghaib") {
      const message = async () => {
        let promiseDaftarGhaib = notification.getDataDaftarGhaib();
        let messageDaftarGhaib = await promiseDaftarGhaib;
        let msg = `*Daftar perkara yang terdaftar secara Ghaib :* \n${messageDaftarGhaib}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev mediasi") {
      const message = async () => {
        let promiseDaftarMediasi = notification.getDataDaftarMediasi();
        let messageDaftarMediasi = await promiseDaftarMediasi;
        let msg = `*Perkara yang mediasi :* \n${messageDaftarMediasi}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev sidkel") {
      const message = async () => {
        let promiseDaftarSidkel = notification.getDataDaftarSidkel();
        let messageDaftarSidkel = await promiseDaftarSidkel;
        let msg = `*Daftar perkara yang bersidang diluar gedung (Sidang Keliling):* \n${messageDaftarSidkel}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev meterai") {
      const message = async () => {
        let promiseMeteraiRedaksiPsp = notification.getDataMeteraiRedaksiPsp();
        let messageMeteraiRedaksiPsp = await promiseMeteraiRedaksiPsp;
        let msg = `*Perkara yang belum keluar meterai redaksi dan PSP :* \n${messageMeteraiRedaksiPsp}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev alamat") {
      const message = async () => {
        let promiseBelumInputAlamat = notification.getDataBelumInputAlamat();
        let messageBelumInputAlamat = await promiseBelumInputAlamat;
        let msg = `*Perkara yang belum Input Tiap Alamat :* \n${messageBelumInputAlamat}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev identitas pihak") {
      const message = async () => {
        let promiseIdentitasPihak = notification.getDataNoHpEmailParaPihak();
        let messageIdentitasPihak = await promiseIdentitasPihak;
        let msg = `*Identitas Para Pihak (Nama, KTP, No. HP dan Email) :* \n${messageIdentitasPihak}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev penetapan") {
      const message = async () => {
        let promiseDaftarPenetapan = notification.getDataDaftarPenetapan();
        let messageDaftarPenetapan = await promiseDaftarPenetapan;
        let msg = `*Perkara yang belum ditetapkan PMH, Penunjukkan PP dan Penunjukkan JS serta PHS :* \n${messageDaftarPenetapan}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev alasan cerai") {
      const message = async () => {
        let promiseAlasanCerai = notification.getDataJumlahAlasanCerai();
        let messageAlasanCerai = await promiseAlasanCerai;
        let msg = `*Data rekapitulasi alasan cerai tahun berjalan :* \n${messageAlasanCerai}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev kua cerai") {
      const message = async () => {
        let promiseKuaCerai = notification.getDataKuaCerai();
        let messageKuaCerai = await promiseKuaCerai;
        let msg = `*Data cerai tiap KUA* : \n${messageKuaCerai}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev capil cerai") {
      const message = async () => {
        let promiseCapilCerai = notification.getDataCapilCerai();
        let messageCapilCerai = await promiseCapilCerai;
        let msg = `*Data cerai tiap Desa (Capil)* : \n${messageCapilCerai}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "kode hakim" || keyword[0] == "kode panitera" || keyword[0] == "kode") {
      const message = async () => {
        let promiseKodeJabatan = notification.getDataKodeJabatan();
        let messageKodeJabatan = await promiseKodeJabatan;
        let msg = `${messageKodeJabatan}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "sipp putus") {
      const message = async () => {
        let promiseKriteriaWaktuPutus = notification.getDataKriteriaWaktuPutus();
        let messageKriteriaWaktuPutus = await promiseKriteriaWaktuPutus;
        let msg = `Data Kriteria Waktu Putus yang bermasalah di SIPP: \n${messageKriteriaWaktuPutus}`;
        return msg;
      };
    
      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "sipp minutasi") {
      const message = async () => {
        let promiseMinutasiBerkasPerkara = notification.getDataMinutasiBerkasPerkara();
        let messageMinutasiBerkasPerkara = await promiseMinutasiBerkasPerkara;
        let msg = `Data Minutasi Berkas Perkara yang bermasalah di SIPP: \n${messageMinutasiBerkasPerkara}`;
        return msg;
      };
    
      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "sipp upload putusan") {
      const message = async () => {
        let promiseUploadPublikasiPutusan = notification.getDataUploadPublikasiPutusan();
        let messageUploadPublikasiPutusan = await promiseUploadPublikasiPutusan;
        let msg = `Data Upload Publikasi Putusan yang bermasalah di SIPP: \n${messageUploadPublikasiPutusan}`;
        return msg;
      };
    
      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "sipp pendaftaran") {
      const message = async () => {
        let promisePendaftaranPerkara = notification.getDataPendaftaranPerkara();
        let messagePendaftaranPerkara = await promisePendaftaranPerkara;
        let msg = `Data Pendaftaran Perkara yang bermasalah di SIPP: \n ${messagePendaftaranPerkara}`;
        return msg;
      };
    
      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "sipp pmh") {
      const message = async () => {
        let promisePenetapanMajelisHakim = notification.getDataPenetapanMajelisHakim();
        let messagePenetapanMajelisHakim = await promisePenetapanMajelisHakim;
        let msg = `Data Penetapan Majelis Hakim yang bermasalah di SIPP: \n${messagePenetapanMajelisHakim}`;
        return msg;
      };
    
      let responseMessage = message();
      resolve(responseMessage);
    }
    
    else if (keyword[0] == "sipp input pmh") {
      const message = async () => {
        let promisePengimputanPenetapanMajelisHakim = notification.getDataPengimputanPenetapanMajelisHakim();
        let messagePengimputanPenetapanMajelisHakim = await promisePengimputanPenetapanMajelisHakim;
        let msg = `Data Pengimputan Penetapan Majelis Hakim yang bermasalah di SIPP: \n${messagePengimputanPenetapanMajelisHakim}`;
        return msg;
      };
    
      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "sipp pp") {
      const message = async () => {
        let promisePenunjukkanPp = notification.getDataPenunjukkanPp();
        let messagePenunjukkanPp = await promisePenunjukkanPp;
        let msg = `Data Penunjukkan PP yang bermasalah di SIPP: \n${messagePenunjukkanPp}`;
        return msg;
      };
    
      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "sipp input pp") {
      const message = async () => {
        let promisePengimputanPenunjukkanPp = notification.getDataPengimputanPenunjukkanPp();
        let messagePengimputanPenunjukkanPp = await promisePengimputanPenunjukkanPp;
        let msg = `Data Pengimputan Penunjukkan PP yang bermasalah di SIPP: \n${messagePengimputanPenunjukkanPp}`;
        return msg;
      };
    
      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "sipp js") {
      const message = async () => {
        let promisePenunjukkanJurusita = notification.getDataPenunjukkanJurusita();
        let messagePenunjukkanJurusita = await promisePenunjukkanJurusita;
        let msg = `Data Penunjukkan Jurusita yang bermasalah di SIPP: \n${messagePenunjukkanJurusita}`;
        return msg;
      };
    
      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "sipp input js") {
      const message = async () => {
        let promisePengimputanPenunjukkanJurusita = notification.getDataPengimputanPenunjukkanJurusita();
        let messagePengimputanPenunjukkanJurusita = await promisePengimputanPenunjukkanJurusita;
        let msg = `Data Pengimputan Penunjukkan Jurusita yang bermasalah di SIPP: \n${messagePengimputanPenunjukkanJurusita}`;
        return msg;
      };
    
      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "sipp phs") {
      const message = async () => {
        let promisePenetapanHariSidang = notification.getDataPenetapanHariSidang();
        let messagePenetapanHariSidang = await promisePenetapanHariSidang;
        let msg = `Data Penetapan Hari Sidang yang bermasalah di SIPP: \n${messagePenetapanHariSidang}`;
        return msg;
      };
    
      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "sipp input phs") {
      const message = async () => {
        let promisePengimputanPenetapanHariSidang = notification.getDataPengimputanPenetapanHariSidang();
        let messagePengimputanPenetapanHariSidang = await promisePengimputanPenetapanHariSidang;
        let msg = `Data Pengimputan Penetapan Hari Sidang yang bermasalah di SIPP: \n${messagePengimputanPenetapanHariSidang}`;
        return msg;
      };
    
      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "sipp relaas") {
      const message = async () => {
        let promisePengisianDataRelaas = notification.getDataPengisianDataRelaas();
        let messagePengisianDataRelaas = await promisePengisianDataRelaas;
        let msg = `Data Pengisian Data Relaas yang bermasalah di SIPP: \n${messagePengisianDataRelaas}`;
        return msg;
      };
    
      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "sipp mediasi") {
      const message = async () => {
        let promiseMediasi = notification.getDataMediasi();
        let messageMediasi = await promiseMediasi;
        let msg = `Data Pengisian Mediasi (Tidak Di isi laporan mediasi) yang bermasalah di SIPP: \n${messageMediasi}`;
        return msg;
      };
    
      let responseMessage = message();
      resolve(responseMessage);
    }
    
    else if (keyword[0] == "sipp saksi") {
      const message = async () => {
        let promiseKepatuhanDataSaksi = notification.getDataKepatuhanDataSaksi();
        let messageKepatuhanDataSaksi = await promiseKepatuhanDataSaksi;
        let msg = `Data Kepatuhan Data Saksi (tidak isi data identitas, no identitas dan no handphone) yang bermasalah di SIPP: \n${messageKepatuhanDataSaksi}`;
        return msg;
      };
    
      let responseMessage = message();
      resolve(responseMessage);
    }
    
    else if (keyword[0] == "sipp pbt") {
      const message = async () => {
        let promisePemberitahuanPutusanPenetapan = notification.getDataPemberitahuanPutusanPenetapan();
        let messagePemberitahuanPutusanPenetapan = await promisePemberitahuanPutusanPenetapan;
        let msg = `Data Pemberitahuan Putusan Penetapan (PBT) yang bermasalah di SIPP: \n${messagePemberitahuanPutusanPenetapan}`;
        return msg;
      };
    
      let responseMessage = message();
      resolve(responseMessage);
    }
    
    else if (keyword[0] == "sipp bht") {
      const message = async () => {
        let promisePengisianBht = notification.getDataPengisianBht();
        let messagePengisianBht = await promisePengisianBht;
        let msg = `Data Pengisian BHT yang bermasalah di SIPP: \n${messagePengisianBht}`;
        return msg;
      };
    
      let responseMessage = message();
      resolve(responseMessage);
    }
    
    else if (keyword[0] == "sipp sisa panjar") {
      const message = async () => {
        let promisePencatatanSisaPanjarBiaya = notification.getDataPencatatanSisaPanjarBiaya();
        let messagePencatatanSisaPanjarBiaya = await promisePencatatanSisaPanjarBiaya;
        let msg = `Data Pencatatan Sisa Panjar Biaya yang bermasalah di SIPP: \n${messagePencatatanSisaPanjarBiaya}`;
        return msg;
      };
    
      let responseMessage = message();
      resolve(responseMessage);
    }
    
    else if (keyword[0] == "sipp arsip") {
      const message = async () => {
        let promisePengisianDataArsip = notification.getDataPengisianDataArsip();
        let messagePengisianDataArsip = await promisePengisianDataArsip;
        let msg = `Data Pengisian Data Arsip yang bermasalah di SIPP: \n${messagePengisianDataArsip}`;
        return msg;
      };
    
      let responseMessage = message();
      resolve(responseMessage);
    }
    
    else if (keyword[0] == "sipp delegasi") {
      const message = async () => {
        let promisePenerimaanDelegasi = notification.getDataPenerimaanDelegasi();
        let messagePenerimaanDelegasi = await promisePenerimaanDelegasi;
        let msg = `Data Penerimaan Delegasi yang bermasalah di SIPP: \n${messagePenerimaanDelegasi}`;
        return msg;
      };
    
      let responseMessage = message();
      resolve(responseMessage);
    }
    
    else if (keyword[0] == "sipp edoc petitum") {
      const message = async () => {
        let promiseEdocPetitumTuntutan = notification.getDataEdocPetitumTuntutan();
        let messageEdocPetitumTuntutan = await promiseEdocPetitumTuntutan;
        let msg = `Data Edoc Petitum Tuntutan yang bermasalah di SIPP: \n${messageEdocPetitumTuntutan}`;
        return msg;
      };
    
      let responseMessage = message();
      resolve(responseMessage);
    }
    
    else if (keyword[0] == "sipp edoc relaas") {
      const message = async () => {
        let promiseEdocRelaas = notification.getDataEdocRelaas();
        let messageEdocRelaas = await promiseEdocRelaas;
        let msg = `Data Edoc Relaas yang bermasalah di SIPP: \n${messageEdocRelaas}`;
        return msg;
      };
    
      let responseMessage = message();
      resolve(responseMessage);
    }
    
    else if (keyword[0] == "sipp edoc bas") {
      const message = async () => {
        let promiseEdocBas = notification.getDataEdocBas();
        let messageEdocBas = await promiseEdocBas;
        let msg = `Data Edoc BAS yang bermasalah di SIPP: \n${messageEdocBas}`;
        return msg;
      };
    
      let responseMessage = message();
      resolve(responseMessage);
    }
    
    else if (keyword[0] == "sipp edoc ac") {
      const message = async () => {
        let promiseEdocAc = notification.getDataEdocAc();
        let messageEdocAc = await promiseEdocAc;
        let msg = `Data Edoc AC yang bermasalah di SIPP: \n${messageEdocAc}`;
        return msg;
      };
    
      let responseMessage = message();
      resolve(responseMessage);
    }
    
    else if (keyword[0] == "sipp agenda sidang") {
      const message = async () => {
        let promiseAgendaSidangTerakhir = notification.getDataAgendaSidangTerakhir();
        let messageAgendaSidangTerakhir = await promiseAgendaSidangTerakhir;
        let msg = `Data Agenda Sidang Terakhir yang bermasalah di SIPP: \n${messageAgendaSidangTerakhir}`;
        return msg;
      };
    
      let responseMessage = message();
      resolve(responseMessage);
    }
    
    else if (keyword[0] == "sipp permohonan delegasi") {
      const message = async () => {
        let promisePermohonanPanggilanDelegasi = notification.getDataPermohonanPanggilanDelegasi();
        let messagePermohonanPanggilanDelegasi = await promisePermohonanPanggilanDelegasi;
        let msg = `Data Permohonan Panggilan Delegasi yang bermasalah di SIPP: \n${messagePermohonanPanggilanDelegasi}`;
        return msg;
      };
    
      let responseMessage = message();
      resolve(responseMessage);
    }
    
    else if (keyword[0] == "sipp verstek") {
      const message = async () => {
        let promiseJenisPutusanVerstekContra = notification.getDataPengisianJenisPutusanVerstekContra();
        let messageJenisPutusanVerstekContra = await promiseJenisPutusanVerstekContra;
        let msg = `Data Jenis Putusan Verstek (salah input/lupa ganti verstek di putusan) yang bermasalah di SIPP: \n${messageJenisPutusanVerstekContra}`;
        return msg;
      };
    
      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "jumlah alasan cerai") {
      if (keyword.length == 1) {
        let responseMessage =
          "Perintah salah silahkan ketik jumlah alasan cerai#tahun#bulan, contoh: jumlah alasan cerai#2021#1";
        resolve(responseMessage);
        return;
      }
      let year = keyword[1];
      let month = keyword[2];
      const message = async () => {
        let promiseBulananAlasanCerai = getDataBulananAlasanCerai(year, month);
        let messageBulananAlasanCerai = await promiseBulananAlasanCerai;
        return messageBulananAlasanCerai;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } 
    // else if (keyword[0] == "jumlah mediasi") {
    //   if (keyword.length == 1) {
    //     let responseMessage =
    //       "Perintah salah silahkan ketik jumlah mediasi#tahun#bulan, contoh: jumlah mediasi#2021#1";
    //     resolve(responseMessage);
    //     return;
    //   }
    //   let year = keyword[1];
    //   let month = keyword[2];
    //   const message = async () => {
    //     let promiseBulananMediasi = getDataJumlahMediasi(year, month);
    //     let messageBulananMediasi = await promiseBulananMediasi;
    //     return messageBulananMediasi;
    //   };

    //   let responseMessage = message();
    //   resolve(responseMessage);
    // } else if (keyword[0] == "jumlah mediasi hakim") {
    //   if (keyword.length == 1) {
    //     let responseMessage =
    //       "Perintah salah silahkan ketik jumlah mediasi hakim#tahun#bulan, contoh: jumlah mediasi#2021#1";
    //     resolve(responseMessage);
    //     return;
    //   }
    //   let year = keyword[1];
    //   let month = keyword[2];
    //   const message = async () => {
    //     let promiseBulananMediasiHakim = notification.getDataJumlahMediasiHakim(year, month);
    //     let messageBulananMediasiHakim = await promiseBulananMediasiHakim;
    //     return messageBulananMediasiHakim;
    //   };

    //   let responseMessage = message();
    //   resolve(responseMessage);
    // } 
    else if (keyword[0] == "absen pagi") {
      const message = async () => {
        let pesanAbsenMasuk = await absen.getDataMasuk();
        let msg = `${pesanAbsenMasuk}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "absen sore") {
      const message = async () => {
        let pesanAbsenKeluar = await absen.getDataKeluar();
        let msg = `${pesanAbsenKeluar}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "pengumuman") {
      const message = async () => {
        let pengumumanMa = await pengumuman.getPengumumanMa();
        let pengumumanBadilag = await pengumuman.getPengumumanBadilag();
        let pengumumanPta = await pengumuman.getPengumumanPta();
        let msg = `*Pengumuman Mahkamah Agung* \n${pengumumanMa} \n\n*Pengumuman Badilag* \n${pengumumanBadilag} \n\n*Pengumuman PTA Palu* \n${pengumumanPta} `;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev ketua" || keyword[0] == "monev wakil ketua" || keyword[0] == "monev pimpinan") {
      const message = async () => {
        let promiseBA = notification.getDataBA();
        let messageBA = await promiseBA;
        let promisePutusanBelumMinut = notification.getDataPutusanBelumMinut();
        let messagePutusanBelumMinut = await promisePutusanBelumMinut;
        let promiseBelumBhtPerdata = notification.getDataBelumBhtPerdata();
        let messageBelumBhtPerdata = await promiseBelumBhtPerdata;
        let promiseSisaPanjarPn = notification.getDataSisaPanjarPn();
        let messageSisaPanjarPn = await promiseSisaPanjarPn;
        let promiseSisaPanjarBanding = notification.getDataSisaPanjarBanding();
        let messageSisaPanjarBanding = await promiseSisaPanjarBanding;
        let promiseSisaPanjarKasasi = notification.getDataSisaPanjarKasasi();
        let messageSisaPanjarKasasi = await promiseSisaPanjarKasasi;
        let promiseStatistikDetail = notification.getStatistikDetail();
        let messageStatistikDetail = await promiseStatistikDetail;
        let promiseBelumBhtBanding = notification.getBelumBhtBanding();
        let messageBelumBhtBanding = await promiseBelumBhtBanding;
        let promiseBelumBhtKasasi = notification.getBelumBhtKasasi();
        let messageBelumBhtKasasi = await promiseBelumBhtKasasi;
        let promiseBelumPanggilan = notification.getBelumPanggilan();
        let messageBelumPanggilan = await promiseBelumPanggilan;
        let promiseDatabanding = notification.getDataBanding();
        let messageDataBanding = await promiseDatabanding;
        let promiseDataKasasi = notification.getDataKasasi();
        let messageDataKasasi = await promiseDataKasasi;
        let promiseDataPK = notification.getDataPK();
        let messageDataPK = await promiseDataPK;
        let promiseDataPetitum = notification.getDataEdocPetitum();
        let messageDataPetitum = await promiseDataPetitum;
        let promiseDataEdocAnonimisasi = notification.getDataEdocAnonimisasi();
        let messageDataAnonimisasi = await promiseDataEdocAnonimisasi;
        let promiseDataBelumDelegasi = notification.getDataBelumDelegasi();
        let messageDataBelumDelegasi = await promiseDataBelumDelegasi;
        let promiseDataVerstek = notification.getDataVerstek();
        let messageDataVerstek = await promiseDataVerstek;
        let promiseTundaMediasi = notification.getDataTundaMediasi();
        let messageTundaMediasi = await promiseTundaMediasi;   
        let msg = `*_Hai, saya Aleta, berikut data keadaan perkara :_* \n\n*STATISTIK DETAIL PENANGANAN PERKARA TAHUN INI* : \n${messageStatistikDetail} \n\n*PERKARA YANG BELUM DI TUNDA MEDIASI* : \n${messageTundaMediasi} \n\n*PANGGILAN BELUM DILAKSANAKAN/RELAAS BELUM DIUPLOAD* : \n${messageBelumPanggilan} \n\n*SISA PANJAR PERKARA TINGKAT PERTAMA YANG TELAH PUTUS DAN BELUM DIKEMBALIKAN* : \n${messageSisaPanjarPn} \n\n*SISA PANJAR PERKARA TINGKAT BANDING YANG TELAH PUTUS DAN BELUM DIKEMBALIKAN* : \n${messageSisaPanjarBanding} \n\n*SISA PANJAR PERKARA TINGKAT KASASI YANG TELAH PUTUS DAN BELUM DIKEMBALIKAN* : \n${messageSisaPanjarKasasi} \n\n*DATA PERKARA YANG BELUM UPLOAD BAS* : \n${messageBA} \n\n*DATA DELEGASI BELUM DILAKSANAKAN* : \n${messageDataBelumDelegasi} \n\n*DATA PUTUSAN YANG BELUM DI MINUTASI* : \n${messagePutusanBelumMinut} \n\n*DATA PERKARA PERDATA YANG BELUM BERISI TANGGAL BHT* : \n${messageBelumBhtPerdata} \n\n*DATA PERKARA BANDING YANG BELUM BERISI TANGGAL BHT* : \n${messageBelumBhtBanding} \n\n*DATA PERKARA KASASI YANG BELUM BERISI TANGGAL BHT* : \n${messageBelumBhtKasasi} \n\n*DATA BANDING BELUM DIKIRIM* : \n${messageDataBanding} \n\n*DATA KASASI BELUM DIKIRIM* : \n${messageDataKasasi} \n\n*DATA PK BELUM DIKIRIM* : \n${messageDataPK} \n\n*DATA PERKARA BELUM BERISI EDOC PETITUM* : \n${messageDataPetitum} \n\n*PERKARA PUTUSAN BELUM ANONIMISASI* : \n${messageDataAnonimisasi} \n\n*JENIS PUTUSAN VERSTEK TIDAK SESUAI* : \n${messageDataVerstek}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev panitera") {
      const message = async () => {
        let promiseBA = notification.getDataBA();
        let messageBA = await promiseBA;
        let promisePutusanBelumMinut = notification.getDataPutusanBelumMinut();
        let messagePutusanBelumMinut = await promisePutusanBelumMinut;
        let promiseBelumBhtPerdata = notification.getDataBelumBhtPerdata();
        let messageBelumBhtPerdata = await promiseBelumBhtPerdata;
        let promiseBelumSerahHukum = notification.getDataBelumSerahHukum();
        let messageBelumSerahHukum = await promiseBelumSerahHukum;
        let promiseSaksiTidakLengkap = notification.getDataSaksiTidakLengkap();
        let messageSaksiTidakLengkap = await promiseSaksiTidakLengkap;
        let promiseSisaPanjarPn = notification.getDataSisaPanjarPn();
        let messageSisaPanjarPn = await promiseSisaPanjarPn;
        let promiseSisaPanjarBanding = notification.getDataSisaPanjarBanding();
        let messageSisaPanjarBanding = await promiseSisaPanjarBanding;
        let promiseSisaPanjarKasasi = notification.getDataSisaPanjarKasasi();
        let messageSisaPanjarKasasi = await promiseSisaPanjarKasasi;
        let promiseStatistikDetail = notification.getStatistikDetail();
        let messageStatistikDetail = await promiseStatistikDetail
        let promiseBelumBhtBanding = notification.getBelumBhtBanding();
        let messageBelumBhtBanding = await promiseBelumBhtBanding;
        let promiseBelumBhtKasasi = notification.getBelumBhtKasasi();
        let messageBelumBhtKasasi = await promiseBelumBhtKasasi;
        let promiseBelumPanggilan = notification.getBelumPanggilan();
        let messageBelumPanggilan = await promiseBelumPanggilan;
        let promiseDatabanding = notification.getDataBanding();
        let messageDataBanding = await promiseDatabanding;
        let promiseDataKasasi = notification.getDataKasasi();
        let messageDataKasasi = await promiseDataKasasi;
        let promiseDataPK = notification.getDataPK();
        let messageDataPK = await promiseDataPK;
        let promiseDataPetitum = notification.getDataEdocPetitum();
        let messageDataPetitum = await promiseDataPetitum;
        let promiseDataEdocAnonimisasi = notification.getDataEdocAnonimisasi();
        let messageDataAnonimisasi = await promiseDataEdocAnonimisasi;
        let promiseDataBelumDelegasi = notification.getDataBelumDelegasi();
        let messageDataBelumDelegasi = await promiseDataBelumDelegasi;
        let promiseDataVerstek = notification.getDataVerstek();
        let messageDataVerstek = await promiseDataVerstek;
        let promiseTundaMediasi = notification.getDataTundaMediasi();
        let messageTundaMediasi = await promiseTundaMediasi;
        let msg = `*_Hai, saya Aleta, berikut data keadaan perkara :_* \n\n*STATISTIK DETAIL PENANGANAN PERKARA TAHUN INI* : \n${messageStatistikDetail} \n\n*PANGGILAN BELUM DILAKSANAKAN/RELAAS BELUM DIUPLOAD* : \n${messageBelumPanggilan} \n\n*PERKARA YANG BELUM DI TUNDA MEDIASI* : \n${messageTundaMediasi} \n\n*SISA PANJAR PERKARA TINGKAT PERTAMA YANG TELAH PUTUS DAN BELUM DIKEMBALIKAN* : \n${messageSisaPanjarPn} \n\n*SISA PANJAR PERKARA TINGKAT BANDING YANG TELAH PUTUS DAN BELUM DIKEMBALIKAN* : \n${messageSisaPanjarBanding} \n\n*SISA PANJAR PERKARA TINGKAT KASASI YANG TELAH PUTUS DAN BELUM DIKEMBALIKAN* : \n${messageSisaPanjarKasasi} \n\n*DATA PERKARA YANG BELUM UPLOAD BAS* : \n${messageBA} \n\n*DATA DELEGASI BELUM DILAKSANAKAN* : \n${messageDataBelumDelegasi} \n\n*DATA PUTUSAN YANG BELUM DI MINUTASI* : \n${messagePutusanBelumMinut} \n\n*DATA PERKARA PERDATA YANG BELUM BERISI TANGGAL BHT* : \n${messageBelumBhtPerdata} \n\n*DATA PERKARA BANDING YANG BELUM BERISI TANGGAL BHT* : \n${messageBelumBhtBanding} \n\n*DATA PERKARA KASASI YANG BELUM BERISI TANGGAL BHT* : \n${messageBelumBhtKasasi} \n\n*DATA PERKARA YANG DATA SAKSI TIDAK LENGKAP* : \n${messageSaksiTidakLengkap} \n\n*DATA BANDING BELUM DIKIRIM* : \n${messageDataBanding} \n\n*DATA KASASI BELUM DIKIRIM* : \n${messageDataKasasi} \n\n*DATA PK BELUM DIKIRIM* : \n${messageDataPK} \n\n*DATA PERKARA BELUM BERISI EDOC PETITUM* : \n${messageDataPetitum} \n\n*PERKARA PUTUSAN BELUM ANONIMISASI* : \n${messageDataAnonimisasi} \n\n*JENIS PUTUSAN VERSTEK TIDAK SESUAI* : \n${messageDataVerstek} \n\n*DATA PERKARA YANG BELUM DISERAHKAN KE BAGIAN HUKUM* : \n${messageBelumSerahHukum}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev sekretaris") {
      const message = async () => {
        let promisePutusJurusita = notification.getDataPutusJurusita();
        let messagePutusJurusita = await promisePutusJurusita;
        let promiseTundaJurusita = notification.getDataTundaJurusita();
        let messageTundaJurusita = await promiseTundaJurusita;
        let msg = `*Perkara putus hari ini :* \n${messagePutusJurusita} \n\n*Perkara yang tunda hari ini :* \n${messageTundaJurusita}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev panmud gugatan") {
      const message = async () => {
        let promiseBA = notification.getDataBA();
        let messageBA = await promiseBA;
        let promisePutusanBelumMinut = notification.getDataPutusanBelumMinut();
        let messagePutusanBelumMinut = await promisePutusanBelumMinut;
        let promiseBelumBhtPerdata = notification.getDataBelumBhtPerdata();
        let messageBelumBhtPerdata = await promiseBelumBhtPerdata;
        let promiseSaksiTidakLengkap = notification.getDataSaksiTidakLengkap();
        let messageSaksiTidakLengkap = await promiseSaksiTidakLengkap;
        let promiseStatistik = notification.getStatistik();
        let messageStatistik = await promiseStatistik;
        let promiseDataPetitum = notification.getDataEdocPetitum();
        let messageDataPetitum = await promiseDataPetitum;
        let promiseTundaMediasi = notification.getDataTundaMediasi();
        let messageTundaMediasi = await promiseTundaMediasi;
        let promiseDataVerstek = notification.getDataVerstek();
        let messageDataVerstek = await promiseDataVerstek;
        let msg = `*_Hai, saya Aleta, berikut data keadaan perkara :_* \n\n*STATISTIK PENANGANAN PERKARA TAHUN INI* : \n${messageStatistik} \n\n*DATA PERKARA YANG BELUM UPLOAD BAS* : \n${messageBA} \n\n*PERKARA YANG BELUM DI TUNDA MEDIASI* : \n${messageTundaMediasi} \n\n*DATA PUTUSAN YANG BELUM DI MINUTASI* : \n${messagePutusanBelumMinut} \n\n*DATA PERKARA PERDATA YANG BELUM BERISI TANGGAL BHT* : \n${messageBelumBhtPerdata} \n\n*DATA PERKARA YANG DATA SAKSI TIDAK LENGKAP* : \n${messageSaksiTidakLengkap} \n\n*DATA PERKARA BELUM BERISI EDOC PETITUM* : \n${messageDataPetitum} \n\n*JENIS PUTUSAN VERSTEK TIDAK SESUAI* : \n${messageDataVerstek}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev panmud permohonan") {
      const message = async () => {
        let promiseBA = notification.getDataBA();
        let messageBA = await promiseBA;
        let promisePutusanBelumMinut = notification.getDataPutusanBelumMinut();
        let messagePutusanBelumMinut = await promisePutusanBelumMinut;
        let promiseBelumBhtPerdata = notification.getDataBelumBhtPerdata();
        let messageBelumBhtPerdata = await promiseBelumBhtPerdata;
        let promiseSaksiTidakLengkap = notification.getDataSaksiTidakLengkap();
        let messageSaksiTidakLengkap = await promiseSaksiTidakLengkap;
        let promiseStatistik = notification.getStatistik();
        let messageStatistik = await promiseStatistik;
        let promiseDataPetitum = notification.getDataEdocPetitum();
        let messageDataPetitum = await promiseDataPetitum;
        let promiseTundaMediasi = notification.getDataTundaMediasi();
        let messageTundaMediasi = await promiseTundaMediasi;
        let promiseDataVerstek = notification.getDataVerstek();
        let messageDataVerstek = await promiseDataVerstek;
        let msg = `*_Hai, saya Aleta, berikut data keadaan perkara :_* \n\n*STATISTIK PENANGANAN PERKARA TAHUN INI* : \n${messageStatistik} \n\n*DATA PERKARA YANG BELUM UPLOAD BAS* : \n${messageBA} \n\n*PERKARA YANG BELUM DI TUNDA MEDIASI* : \n${messageTundaMediasi} \n\n*DATA PUTUSAN YANG BELUM DI MINUTASI* : \n${messagePutusanBelumMinut} \n\n*DATA PERKARA PERDATA YANG BELUM BERISI TANGGAL BHT* : \n${messageBelumBhtPerdata} \n\n*DATA PERKARA YANG DATA SAKSI TIDAK LENGKAP* : \n${messageSaksiTidakLengkap} \n\n*DATA PERKARA BELUM BERISI EDOC PETITUM* : \n${messageDataPetitum} \n\n*JENIS PUTUSAN VERSTEK TIDAK SESUAI* : \n${messageDataVerstek}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev panmud hukum") {
      const message = async () => {
        let promiseBA = notification.getDataBA();
        let messageBA = await promiseBA;
        let promisePutusanBelumMinut = notification.getDataPutusanBelumMinut();
        let messagePutusanBelumMinut = await promisePutusanBelumMinut;
        let promiseBelumBhtPerdata = notification.getDataBelumBhtPerdata();
        let messageBelumBhtPerdata = await promiseBelumBhtPerdata;
        let promiseBelumSerahHukum = notification.getDataBelumSerahHukum();
        let messageBelumSerahHukum = await promiseBelumSerahHukum;
        let promiseSaksiTidakLengkap = notification.getDataSaksiTidakLengkap();
        let messageSaksiTidakLengkap = await promiseSaksiTidakLengkap;
        let promiseDataBelumDelegasi = notification.getDataBelumDelegasi();
        let messageDataBelumDelegasi = await promiseDataBelumDelegasi;
        let promiseStatistikDetail = notification.getStatistikDetail();
        let messageStatistikDetail = await promiseStatistikDetail;
        let promiseTundaMediasi = notification.getDataTundaMediasi();
        let messageTundaMediasi = await promiseTundaMediasi;
        let promiseDataVerstek = notification.getDataVerstek();
        let messageDataVerstek = await promiseDataVerstek;
        let msg = `*_Hai, saya Aleta, berikut data keadaan perkara :_* \n\n*STATISTIK DETAIL PENANGANAN PERKARA TAHUN INI* : \n${messageStatistikDetail} \n\n*DATA PERKARA YANG BELUM UPLOAD BAS* : \n${messageBA} \n\n*PERKARA YANG BELUM DI TUNDA MEDIASI* : \n${messageTundaMediasi} \n\n*DATA DELEGASI BELUM DILAKSANAKAN* : \n${messageDataBelumDelegasi} \n\n*DATA PUTUSAN YANG BELUM DI MINUTASI* : \n${messagePutusanBelumMinut} \n\n*DATA PERKARA PERDATA YANG BELUM BERISI TANGGAL BHT* : \n${messageBelumBhtPerdata} \n\n*DATA PERKARA YANG DATA SAKSI TIDAK LENGKAP* : \n${messageSaksiTidakLengkap} \n\n*DATA PERKARA YANG BELUM DISERAHKAN KE BAGIAN HUKUM* : \n${messageBelumSerahHukum} \n\n*JENIS PUTUSAN VERSTEK TIDAK SESUAI* : \n${messageDataVerstek}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev kasir") {
      const message = async () => {
        let promiseSisaPanjarPn = notification.getDataSisaPanjarPn();
        let messageSisaPanjarPn = await promiseSisaPanjarPn;
        let promiseSisaPanjarBanding = notification.getDataSisaPanjarBanding();
        let messageSisaPanjarBanding = await promiseSisaPanjarBanding;
        let promiseSisaPanjarKasasi = notification.getDataSisaPanjarKasasi();
        let messageSisaPanjarKasasi = await promiseSisaPanjarKasasi;
        let msg = `*_Hai, saya Aleta, berikut data keadaan perkara :_* \n\n*SISA PANJAR PERKARA TINGKAT PERTAMA YANG TELAH PUTUS DAN BELUM DIKEMBALIKAN* : \n${messageSisaPanjarPn} \n\n*SISA PANJAR PERKARA TINGKAT BANDING YANG TELAH PUTUS DAN BELUM DIKEMBALIKAN* : \n${messageSisaPanjarBanding} \n\n*SISA PANJAR PERKARA TINGKAT KASASI YANG TELAH PUTUS DAN BELUM DIKEMBALIKAN* : \n${messageSisaPanjarKasasi}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev delegasi") {
      const message = async () => {
        let promiseDataBelumDelegasi = notification.getDataBelumDelegasi();
        let messageDataBelumDelegasi = await promiseDataBelumDelegasi;
        let promiseBelumBhtPerdata = notification.getDataBelumBhtPerdata();
        let messageBelumBhtPerdata = await promiseBelumBhtPerdata;
        let promiseBelumBhtBanding = notification.getBelumBhtBanding();
        let messageBelumBhtBanding = await promiseBelumBhtBanding;
        let promiseBelumBhtKasasi = notification.getBelumBhtKasasi();
        let messageBelumBhtKasasi = await promiseBelumBhtKasasi;
        let msg = `*_Hai, saya Aleta, berikut data keadaan perkara :_* \n\n*DATA DELEGASI BELUM DILAKSANAKAN* : \n${messageDataBelumDelegasi} \n\n*DATA PERKARA PERDATA YANG BELUM BERISI TANGGAL BHT* : \n${messageBelumBhtPerdata} \n\n*DATA PERKARA BANDING YANG BELUM BERISI TANGGAL BHT* : \n${messageBelumBhtBanding} \n\n*DATA PERKARA KASASI YANG BELUM BERISI TANGGAL BHT* : \n${messageBelumBhtKasasi} `;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev arsip") {
      const message = async () => {
        let promiseBelumSerahHukum = notification.getDataBelumSerahHukum();
        let messageBelumSerahHukum = await promiseBelumSerahHukum;
        let msg = `*_Hai, saya Aleta, berikut data keadaan perkara :_* \n\n*DATA PERKARA YANG BELUM DISERAHKAN KE BAGIAN HUKUM/ARSIP* : \n${messageBelumSerahHukum}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev penjaga sidang") {
      const message = async () => {
        let promiseJadwalSidangPerdata = notification.getDataJadwalSidangPerdata();
        let messageJadwalSidangPerdata = await promiseJadwalSidangPerdata;
        let promiseJadwalMediasi = notification.getDataJadwalMediasi();
        let messageJadwalMediasi = await promiseJadwalMediasi;
        let msg = `*_Hai, saya Aleta, berikut data keadaan perkara :_* \n\n*JADWAL SIDANG HARI INI* : \n${messageJadwalSidangPerdata} \n\n*JADWAL MEDIASI HARI INI* : \n${messageJadwalMediasi}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev ptsp") {
      const message = async () => {
        let promiseBelumBhtPerdata = notification.getDataBelumBhtPerdata();
        let messageBelumBhtPerdata = await promiseBelumBhtPerdata;
        let promiseBelumBhtBanding = notification.getBelumBhtBanding();
        let messageBelumBhtBanding = await promiseBelumBhtBanding;
        let promiseBelumBhtKasasi = notification.getBelumBhtKasasi();
        let messageBelumBhtKasasi = await promiseBelumBhtKasasi;
        let promiseDatabanding = notification.getDataBanding();
        let messageDataBanding = await promiseDatabanding;
        let promiseDataKasasi = notification.getDataKasasi();
        let messageDataKasasi = await promiseDataKasasi;
        let promiseDataPK = notification.getDataPK();
        let messageDataPK = await promiseDataPK;
        let promiseDataPetitum = notification.getDataEdocPetitum();
        let messageDataPetitum = await promiseDataPetitum;
        let msg = `*_Hai, saya Aleta, berikut data keadaan perkara :_* \n\n*DATA PERKARA BELUM BERISI EDOC PETITUM* : \n${messageDataPetitum} \n\n*DATA PERKARA PERDATA YANG BELUM BERISI TANGGAL BHT* : \n${messageBelumBhtPerdata} \n\n*DATA PERKARA BANDING YANG BELUM BERISI TANGGAL BHT* : \n${messageBelumBhtBanding} \n\n*DATA PERKARA KASASI YANG BELUM BERISI TANGGAL BHT* : \n${messageBelumBhtKasasi} \n\n*DATA BANDING BELUM DIKIRIM* : \n${messageDataBanding} \n\n*DATA KASASI BELUM DIKIRIM* : \n${messageDataKasasi} \n\n*DATA PK BELUM DIKIRIM* : \n${messageDataPK}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev penerimaan") {
      const message = async () => {
        let promisePerkaraHakim = notification.getTotalPenerimaanPerkaraSemuaHakim();
        let messagePerkaraHakim = await promisePerkaraHakim;
        let promiseMediasiHakim = notification.getTotalPenerimaanMediasiSemuaHakim();
        let messageMediasiHakim = await promiseMediasiHakim;
        let promisePerkaraPanitera = notification.getTotalPenerimaanPerkaraSemuaPanitera();
        let messagePerkaraPanitera = await promisePerkaraPanitera;
        let promisePerkaraJurusita = notification.getTotalPenerimaanPerkaraSemuaJurusita();
        let messagePerkaraJurusita = await promisePerkaraJurusita;
        let msg = `*_Hai, saya Aleta, berikut data keadaan perkara :_*\n\n*DATA PENERIMAAN PERKARA SETIAP HAKIM, DARI JUMLAH TERBESAR KE TERKECIL* :\n${messagePerkaraHakim}\n\n*DATA MEDIASI SETIAP HAKIM, DARI JUMLAH KEBERHASILAN TERBESAR KE TERKECIL* :\n${messageMediasiHakim}\n\n*DATA PENERIMAAN PERKARA SETIAP PANITERA, DARI JUMLAH TERBESAR KE TERKECIL* :\n${messagePerkaraPanitera}\n\n*DATA PENERIMAAN PERKARA SETIAP JURUSITA, DARI JUMLAH TERBESAR KE TERKECIL* :\n${messagePerkaraJurusita}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev penerimaan lengkap") {
      const message = async () => {
        let promisePerkaraHakim = notification.getTotalPenerimaanPerkaraSemuaHakimLengkap();
        let messagePerkaraHakim = await promisePerkaraHakim;
        let promiseMediasiHakim = notification.getTotalPenerimaanMediasiSemuaHakim();
        let messageMediasiHakim = await promiseMediasiHakim;
        let promisePerkaraPanitera = notification.getTotalPenerimaanPerkaraSemuaPaniteraLengkap();
        let messagePerkaraPanitera = await promisePerkaraPanitera;
        let promisePerkaraJurusita = notification.getTotalPenerimaanPerkaraSemuaJurusitaLengkap();
        let messagePerkaraJurusita = await promisePerkaraJurusita;
        let msg = `*_Hai, saya Aleta, berikut data keadaan perkara :_*\n\n*DATA PENERIMAAN PERKARA SETIAP HAKIM LENGKAP, DARI JUMLAH TERBESAR KE TERKECIL* :\n${messagePerkaraHakim}\n\n*DATA MEDIASI SETIAP HAKIM, DARI JUMLAH KEBERHASILAN TERBESAR KE TERKECIL* :\n${messageMediasiHakim}\n\n*DATA PENERIMAAN PERKARA LENGKAP SETIAP PANITERA, DARI JUMLAH TERBESAR KE TERKECIL* :\n${messagePerkaraPanitera}\n\n*DATA PENERIMAAN PERKARA LENGKAP SETIAP JURUSITA, DARI JUMLAH TERBESAR KE TERKECIL* :\n${messagePerkaraJurusita}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev penerimaan semua") {
      const message = async () => {
        let promisePerkaraHakim = notification.getTotalPenerimaanPerkaraSemuaHakimLengkapAll();
        let messagePerkaraHakim = await promisePerkaraHakim;
        let promiseMediasiHakim = notification.getTotalPenerimaanMediasiSemuaHakimAll();
        let messageMediasiHakim = await promiseMediasiHakim;
        let promisePerkaraPanitera = notification.getTotalPenerimaanPerkaraSemuaPaniteraLengkapAll();
        let messagePerkaraPanitera = await promisePerkaraPanitera;
        let promisePerkaraJurusita = notification.getTotalPenerimaanPerkaraSemuaJurusitaLengkapAll();
        let messagePerkaraJurusita = await promisePerkaraJurusita;
        let msg = `*_Hai, saya Aleta, berikut data keadaan perkara :_*\n\n*DATA PENERIMAAN PERKARA SELURUH HAKIM, DARI JUMLAH TERBESAR KE TERKECIL* :\n${messagePerkaraHakim}\n\n*DATA MEDIASI SELURUH HAKIM, DARI JUMLAH KEBERHASILAN TERBESAR KE TERKECIL* :\n${messageMediasiHakim}\n\n*DATA PENERIMAAN PERKARA SELURUH PANITERA, DARI JUMLAH TERBESAR KE TERKECIL* :\n${messagePerkaraPanitera}\n\n*DATA PENERIMAAN PERKARA SELURUH JURUSITA, DARI JUMLAH TERBESAR KE TERKECIL* :\n${messagePerkaraJurusita}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "nilai sipp") {
      const message = async () => {
        let promiseKriteriaWaktuPutus = notification.getDataKriteriaWaktuPutus();
        let messageKriteriaWaktuPutus = await promiseKriteriaWaktuPutus;
        let promiseMinutasiBerkasPerkara = notification.getDataMinutasiBerkasPerkara();
        let messageMinutasiBerkasPerkara = await promiseMinutasiBerkasPerkara;
        let promiseUploadPublikasiPutusan = notification.getDataUploadPublikasiPutusan();
        let messageUploadPublikasiPutusan = await promiseUploadPublikasiPutusan;
        let promisePendaftaranPerkara = notification.getDataPendaftaranPerkara();
        let messagePendaftaranPerkara = await promisePendaftaranPerkara;
        let promisePenetapanMajelisHakim = notification.getDataPenetapanMajelisHakim();
        let messagePenetapanMajelisHakim = await promisePenetapanMajelisHakim;
        let promisePengimputanPenetapanMajelisHakim = notification.getDataPengimputanPenetapanMajelisHakim();
        let messagePengimputanPenetapanMajelisHakim = await promisePengimputanPenetapanMajelisHakim;
        let promisePenunjukkanPp = notification.getDataPenunjukkanPp();
        let messagePenunjukkanPp = await promisePenunjukkanPp;
        let promisePengimputanPenunjukkanPp = notification.getDataPengimputanPenunjukkanPp();
        let messagePengimputanPenunjukkanPp = await promisePengimputanPenunjukkanPp;
        let promisePenunjukkanJurusita = notification.getDataPenunjukkanJurusita();
        let messagePenunjukkanJurusita = await promisePenunjukkanJurusita;
        let promisePengimputanPenunjukkanJurusita = notification.getDataPengimputanPenunjukkanJurusita();
        let messagePengimputanPenunjukkanJurusita = await promisePengimputanPenunjukkanJurusita;
        let promisePenetapanHariSidang = notification.getDataPenetapanHariSidang();
        let messagePenetapanHariSidang = await promisePenetapanHariSidang;
        let promisePengimputanPenetapanHariSidang = notification.getDataPengimputanPenetapanHariSidang();
        let messagePengimputanPenetapanHariSidang = await promisePengimputanPenetapanHariSidang;
        let promisePengisianDataRelaas = notification.getDataPengisianDataRelaas();
        let messagePengisianDataRelaas = await promisePengisianDataRelaas;
        let promiseMediasi = notification.getDataMediasi();
        let messageMediasi = await promiseMediasi;
        let promiseKepatuhanDataSaksi = notification.getDataKepatuhanDataSaksi();
        let messageKepatuhanDataSaksi = await promiseKepatuhanDataSaksi;
        let promisePemberitahuanPutusanPenetapan = notification.getDataPemberitahuanPutusanPenetapan();
        let messagePemberitahuanPutusanPenetapan = await promisePemberitahuanPutusanPenetapan;
        let promisePengisianBht = notification.getDataPengisianBht();
        let messagePengisianBht = await promisePengisianBht;
        let promisePencatatanSisaPanjarBiaya = notification.getDataPencatatanSisaPanjarBiaya();
        let messagePencatatanSisaPanjarBiaya = await promisePencatatanSisaPanjarBiaya;
        let promisePengisianDataArsip = notification.getDataPengisianDataArsip();
        let messagePengisianDataArsip = await promisePengisianDataArsip;
        let promisePenerimaanDelegasi = notification.getDataPenerimaanDelegasi();
        let messagePenerimaanDelegasi = await promisePenerimaanDelegasi;
        let promiseEdocPetitumTuntutan = notification.getDataEdocPetitumTuntutan();
        let messageEdocPetitumTuntutan = await promiseEdocPetitumTuntutan;
        let promiseEdocRelaas = notification.getDataEdocRelaas();
        let messageEdocRelaas = await promiseEdocRelaas;
        let promiseEdocBas = notification.getDataEdocBas();
        let messageEdocBas = await promiseEdocBas;
        let promiseEdocAc = notification.getDataEdocAc();
        let messageEdocAc = await promiseEdocAc;
        let promiseAgendaSidangTerakhir = notification.getDataAgendaSidangTerakhir();
        let messageAgendaSidangTerakhir = await promiseAgendaSidangTerakhir;
        let promisePermohonanPanggilanDelegasi = notification.getDataPermohonanPanggilanDelegasi();
        let messagePermohonanPanggilanDelegasi = await promisePermohonanPanggilanDelegasi;
        let promisePengisianJenisPutusanVerstekContra = notification.getDataPengisianJenisPutusanVerstekContra();
        let messagePengisianJenisPutusanVerstekContra = await promisePengisianJenisPutusanVerstekContra;
        let msg = `*_Hai, saya Aleta, berikut data keadaan perkara SIPP yang bermasalah dan membuat nilai tidak maksimal :_* \n\n*_-KINERJA-_*\n\n*DATA KRITERIA WAKTU PUTUS* : \n${messageKriteriaWaktuPutus} \n\n*DATA MINUTASI BERKAS PERKARA* : \n${messageMinutasiBerkasPerkara} \n\n*DATA UPLOAD PUBLIKASI PUTUSAN* : \n${messageUploadPublikasiPutusan} \n\n*_-KEPATUHAN-_* \n*I. INPUT DATA SIPP*\n\n*DATA PENDAFTARAN PERKARA* : \n${messagePendaftaranPerkara} \n\n*DATA PENETAPAN MAJELIS HAKIM* : \n${messagePenetapanMajelisHakim} \n\n*DATA PENGIMPUTAN PENETAPAN MAJELIS HAKIM* : \n${messagePengimputanPenetapanMajelisHakim} \n\n*DATA PENUNJUKKAN PANITERA PENGGANTI* : \n${messagePenunjukkanPp} \n\n*DATA PENGIMPUTAN PENUNJUKKAN PP* : \n${messagePengimputanPenunjukkanPp} \n\n*DATA PENUNJUKKAN JURUSITA* : \n${messagePenunjukkanJurusita} \n\n*DATA PENGIMPUTAN PENUNJUKKAN JURUSITA* :\n${messagePengimputanPenunjukkanJurusita} \n\n*DATA PENETAPAN HARI SIDANG* : \n${messagePenetapanHariSidang} \n\n*DATA PENGIMPUTAN PENETAPAN HARI SIDANG* : \n${messagePengimputanPenetapanHariSidang} \n\n*DATA PENGISIAN DATA RELAAS* : \n${messagePengisianDataRelaas} \n\n*DATA MEDIASI* : \n${messageMediasi} \n\n*DATA KEPATUHAN DATA SAKSI* : \n${messageKepatuhanDataSaksi} \n\n*DATA PEMBERITAHUAN PUTUSAN PENETAPAN* : \n${messagePemberitahuanPutusanPenetapan} \n\n*DATA PENGISIAN BHT* : \n${messagePengisianBht} \n\n*DATA PENCATATAN SISA PANJAR BIAYA* : \n${messagePencatatanSisaPanjarBiaya} \n\n*DATA PENGISIAN DATA ARSIP* : \n${messagePengisianDataArsip} \n\n*DATA PENERIMAAN DELEGASI* : \n${messagePenerimaanDelegasi} \n\n*II. KELENGKAPAN DOKUMEN*\n\n*DATA EDOC PETITUM TUNTUTAN* : \n${messageEdocPetitumTuntutan} \n\n*DATA EDOC RELAAS* : \n${messageEdocRelaas} \n\n*DATA EDOC BAS* : \n${messageEdocBas} \n\n*DATA EDOC AC* : \n${messageEdocAc} \n\n*III. KESESUAIAN (NILAI PENGURANG)* \n\n*DATA AGENDA SIDANG TERAKHIR* : \n${messageAgendaSidangTerakhir} \n\n*DATA PERMOHONAN PANGGILAN DELEGASI* : \n${messagePermohonanPanggilanDelegasi} \n\n*DATA PENGISIAN JENIS PUTUSAN VERSTEK CONTRA* : \n${messagePengisianJenisPutusanVerstekContra}`;
        return msg;
    };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "nilai triwulan") {
      const message = async () => {
        let promiseTriwulanEcourt = notification.getDataTriwulanEcourt();
        let messageTriwulanEcourt = await promiseTriwulanEcourt;
        let promiseTriwulanMediasi = notification.getDataTriwulanMediasi();
        let messageTriwulanMediasi = await promiseTriwulanMediasi;
        let msg = `*_Hai, saya Aleta, berikut adalah nilai tiap triwulan :_* \n\n*TRIWULAN E-COURT* : \n${messageTriwulanEcourt} \n\n*TRIWULAN MEDIASI* : \n${messageTriwulanMediasi}`;
        return msg;
    };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev kepegawaian") {
      const message = async () => {
        let absenPagi = await absen.getDataMasuk();
        let absenSore = await absen.getDataKeluar();
        let msg = `Absen Pagi :\n${absenPagi}\n\nAbsen Sore :\n${absenSore}`;
        return msg;
      };
      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "hakim") {
      if (keyword.length < 2) {
        let responseMessage = "Perintah salah, silahkan ketik hakim#nama hakim lengkap\ncontoh : hakim#derry";
        return Promise.reject(responseMessage);
      }
    
      let namaHakim = keyword.slice(1).join(' ');

      let query = `SELECT DISTINCT
      b.tanggal_sidang,
      a.nomor_perkara,
      b.agenda,
      c.panitera_nama,
      a.perkara_id,
      a.tanggal_pendaftaran,
      a.jenis_perkara_nama,
      a.para_pihak,
      a.tahapan_terakhir_id,
      a.tahapan_terakhir_text,
      a.proses_terakhir_id,
      a.proses_terakhir_text,
      f.hakim_nama,
      n.majelis_hakim_kode,
      m.jurusita_nama,
      CASE
          WHEN f.jabatan_hakim_nama = 'Hakim Tunggal' THEN 'T'
          ELSE 'KM'
      END AS jabatan_hakim,
      CASE
          WHEN a.proses_terakhir_id < 210 THEN
              DATEDIFF(CURDATE(), a.tanggal_pendaftaran) - IFNULL(
                  (SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0
              )
          ELSE
              DATEDIFF(d.tanggal_putusan, a.tanggal_pendaftaran) - IFNULL(
                  (SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0
              )
      END + 1 AS durasi,
      CASE
          WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
          ELSE ''
      END AS ghaib,
      CASE
          WHEN a.prodeo = 1 THEN ' (_Prodeo_)'
          ELSE ''
      END AS prodeo,
      CASE
          WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
          ELSE ''
      END AS ecourt
  FROM 
      perkara AS a
  LEFT JOIN 
      (SELECT perkara_id, MAX(tanggal_sidang) AS tanggal_sidang_terakhir FROM perkara_jadwal_sidang GROUP BY perkara_id) AS subq 
      ON a.perkara_id = subq.perkara_id
  LEFT JOIN 
      perkara_jadwal_sidang AS b 
      ON a.perkara_id = b.perkara_id AND b.tanggal_sidang = subq.tanggal_sidang_terakhir
  LEFT JOIN 
      perkara_panitera_pn AS c 
      ON a.perkara_id = c.perkara_id
  LEFT JOIN 
      perkara_putusan AS d 
      ON a.perkara_id = d.perkara_id
  LEFT JOIN 
      perkara_hakim_pn AS f 
      ON a.perkara_id = f.perkara_id
  LEFT JOIN 
      perkara_pelaksanaan_relaas AS g 
      ON a.perkara_id = g.perkara_id
  LEFT JOIN 
      (SELECT perkara_id FROM perkara_efiling_id) AS h 
      ON a.perkara_id = h.perkara_id
  LEFT JOIN 
      (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i 
      ON a.perkara_id = i.perkara_id
  LEFT JOIN 
      perkara_pihak2 AS j 
      ON a.perkara_id = j.perkara_id
  LEFT JOIN 
      perkara_efiling_id AS k 
      ON a.perkara_id = k.perkara_id
  LEFT JOIN 
      perkara_pengacara AS l 
      ON a.perkara_id = l.perkara_id
  LEFT JOIN 
      perkara_jurusita AS m 
      ON a.perkara_id = m.perkara_id
  LEFT JOIN 
      perkara_penetapan AS n 
      ON a.perkara_id = n.perkara_id
  LEFT JOIN 
      perkara_ikrar_talak AS o
      ON a.perkara_id = o.perkara_id
  LEFT JOIN 
      v_pihak_perkara AS x 
      ON a.perkara_id = x.perkara_id
  LEFT JOIN 
      pihak AS w 
      ON x.pihak_id = w.id
  LEFT JOIN (
      SELECT
          a.pihak_id,
          MAX(CASE WHEN a.pihak_ke = 1 THEN CONCAT('+62', SUBSTRING(b.telepon, 2)) ELSE NULL END) AS teleponPenggugat,
          MAX(CASE WHEN a.pihak_ke = 2 THEN CONCAT('+62', SUBSTRING(b.telepon, 2)) ELSE NULL END) AS teleponTergugat
      FROM v_pihak_perkara AS a
      JOIN pihak AS b ON a.pihak_id = b.id 
                      AND b.telepon REGEXP '^[0-9]' 
                      AND CHAR_LENGTH(b.telepon) > 8
      GROUP BY a.pihak_id
  ) AS telepons ON x.pihak_id = telepons.pihak_id
  LEFT JOIN (
      SELECT
          perk.perkara_id,
          CASE
              WHEN datarelaas.tanggal_relaas IS NULL OR datarelaas.tanggal_relaas = '' THEN
              CASE
                  WHEN perkarapihak.pihakke = 1 THEN '(Belum Dipanggil P)'
                  WHEN perkarapihak.pihakke = 2 THEN '(Belum Dipanggil T)'
                  WHEN perkarapihak.pihakke IN (1,2) THEN '(Belum Dipanggil PT)'
                  WHEN perkarapihak.pihakke IN (1,2,4) THEN '(Belum Dipanggil PT & Turut T)'
                  WHEN perkarapihak.pihakke = 4 THEN '(Belum Dipanggil Turut Tergugat)'
                  ELSE '(Sudah Dipanggil dan Diupload)'
              END
          WHEN datarelaas.doc_relaas IS NULL OR datarelaas.doc_relaas = '' THEN
              CASE
                  WHEN perkarapihak.pihakke = 1 THEN '(Belum Diupload P)'
                  WHEN perkarapihak.pihakke = 2 THEN '(Belum Diupload T)'
                  WHEN perkarapihak.pihakke IN (1,2) THEN '(Belum Diupload PT)'
                  WHEN perkarapihak.pihakke IN (1,2,4) THEN '(Belum Diupload PT & Turut T)'
                  WHEN perkarapihak.pihakke = 4 THEN '(Belum Diupload Turut Tergugat)'
                  ELSE '(Sudah Dipanggil dan Diupload)'
              END
          ELSE '(Sudah Dipanggil dan Diupload)'
          END AS panggilan_status
      FROM
          perkara AS perk
          JOIN perkara_jadwal_sidang AS sidang ON sidang.perkara_id = perk.perkara_id
          JOIN (
              SELECT
                  p1.perkara_id,
                  p1.pihak_id,
                  p1.nama,
                  1 AS pihakke,
                  'pihak p' AS ketpihak,
                  '' AS pengacara_pihak_id
              FROM
                  perkara_pihak1 AS p1
                  JOIN perkara ON perkara.perkara_id = p1.perkara_id
              WHERE
                  alur_perkara_id < 111
              UNION
              SELECT
                  p2.perkara_id,
                  p2.pihak_id,
                  p2.nama,
                  2 AS pihakke,
                  'pihak t' AS ketpihak,
                  '' AS pengacara_pihak_id
              FROM
                  perkara_pihak2 AS p2
                  JOIN perkara ON perkara.perkara_id = p2.perkara_id
              WHERE
                  alur_perkara_id < 111
                  AND (
                      status_penahanan_id IS NULL
                      OR status_penahanan_id = 0
                  )
                  AND (
                      jenis_tahanan_id = 0
                      OR jenis_tahanan_id IS NULL
                  )
              UNION
              SELECT
                  p3.perkara_id,
                  p3.pihak_id,
                  p3.nama,
                  3 AS pihakke,
                  'intervensi' AS ketpihak,
                  '' AS pengacara_pihak_id
              FROM
                  perkara_pihak3 AS p3
              UNION
              SELECT
                  p4.perkara_id,
                  p4.pihak_id,
                  p4.nama,
                  4 AS pihakke,
                  'turut' AS ketpihak,
                  '' AS pengacara_pihak_id
              FROM
                  perkara_pihak4 AS p4
              UNION
              SELECT
                  p5.perkara_id,
                  p5.pengacara_id,
                  p5.nama,
                  p5.pihak_ke AS pihakke,
                  'pengacara' AS ketpihak,
                  p5.pihak_id AS pengacara_pihak_id
              FROM
                  perkara_pengacara AS p5
          ) AS perkarapihak 
          ON perkarapihak.perkara_id = perk.perkara_id
          LEFT JOIN perkara_pelaksanaan_relaas AS datarelaas 
          ON datarelaas.pihak_id = perkarapihak.pihak_id
          AND datarelaas.perkara_id = perk.perkara_id
          AND datarelaas.sidang_id = sidang.id
          LEFT JOIN (
              SELECT
                  perkara.perkara_id AS perkara_id,
                  perkara_jadwal_sidang.urutan AS urutan,
                  perkara_jadwal_sidang.dihadiri_oleh
              FROM
                  perkara
                  JOIN perkara_jadwal_sidang ON (
                      perkara_jadwal_sidang.perkara_id = perkara.perkara_id
                  )
          ) AS jadwalsidang 
          ON (
              jadwalsidang.perkara_id = perk.perkara_id
              AND jadwalsidang.urutan = sidang.urutan - 1
          )
          LEFT JOIN perkara_penetapan_hari_sidang AS phs 
          ON (
              phs.perkara_id = perk.perkara_id
              AND phs.jadwalsidang_id = sidang.id
          )
          JOIN alur_perkara AS alur 
          ON alur.id = perk.alur_perkara_id
      WHERE
          YEAR(perk.tanggal_pendaftaran) = YEAR(CURDATE())
          AND perk.alur_perkara_id < 111
          AND perkarapihak.pihak_id NOT IN (
              SELECT
                  pp.pihak_id
              FROM
                  perkara_pelaksanaan_relaas
                  JOIN perkara_pengacara AS pp 
                  ON pp.pengacara_id = perkara_pelaksanaan_relaas.pihak_id
                  AND pp.perkara_id = perkara_pelaksanaan_relaas.perkara_id
                  JOIN perkara ON pp.perkara_id = perkara.perkara_id
              WHERE
                  perk.alur_perkara_id < 111
                  AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
                  AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
                  AND (
                      perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL
                      OR perkara_pelaksanaan_relaas.tanggal_relaas <> ''
                  )
                  AND (
                      perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL
                      OR perkara_pelaksanaan_relaas.doc_relaas <> ''
                  )
              UNION
              SELECT
                  ppb.pengacara_id
              FROM
                  perkara_pelaksanaan_relaas
                  JOIN perkara_pengacara AS ppb 
                  ON ppb.pihak_id = perkara_pelaksanaan_relaas.pihak_id
                  AND ppb.perkara_id = perkara_pelaksanaan_relaas.perkara_id
                  JOIN perkara ON ppb.perkara_id = perkara.perkara_id
              WHERE
                  perk.alur_perkara_id < 111
                  AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
                  AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
                  AND (
                      perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL
                      OR perkara_pelaksanaan_relaas.tanggal_relaas <> ''
                  )
                  AND (
                      perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL
                      OR perkara_pelaksanaan_relaas.doc_relaas <> ''
                  )
          )
          AND (
              (
                  datarelaas.tanggal_relaas IS NULL
                  OR datarelaas.tanggal_relaas = ''
              )
              OR (
                  datarelaas.doc_relaas IS NULL
                  OR datarelaas.doc_relaas = ''
              )
          )
          AND(
              perk.alur_perkara_id >= 1
              AND perk.alur_perkara_id <= 17
          )
          AND (
              (jadwalsidang.dihadiri_oleh <> 1)
              AND (
                  jadwalsidang.dihadiri_oleh = 2
                  AND (
                      perkarapihak.pihakke = 2
                      OR perkarapihak.pihakke = 4
                  )
              )
              OR (
                  jadwalsidang.dihadiri_oleh = 3
                  AND perkarapihak.pihakke = 1
              )
              OR (
                  jadwalsidang.dihadiri_oleh = 4
                  OR jadwalsidang.dihadiri_oleh IS NULL
              )
          )
  ) AS doc_relaas_status 
  ON a.perkara_id = doc_relaas_status.perkara_id
      WHERE  
          YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE())
          AND f.hakim_nama LIKE '%${namaHakim}%'
          AND a.alur_perkara_id IN (15, 16, 17)
          AND c.aktif = 'Y'
          AND f.aktif = 'Y'
          AND m.aktif = 'Y'
          AND a.alur_perkara_id < 210
          AND (
              CASE 
                  WHEN a.jenis_perkara_id = 346 AND d.status_putusan_id = 62 AND o.amar_ikrar_talak IS NOT NULL THEN a.proses_terakhir_id < 296 
                  ELSE a.proses_terakhir_id < 218 
              END
          )
      ORDER BY 
          b.tanggal_sidang,
          c.panitera_nama, 
          a.alur_perkara_id,
          a.nomor_perkara, 
          ecourt, 
          ghaib, 
          prodeo DESC;`;
      
    // Tambahan query untuk mediator
    let queryMediator = `SELECT 
        p.nomor_perkara,
        p.jenis_perkara_nama,
        pmed.nama_mediator, 
        ppn.panitera_nama, 
        pj.tanggal_mediasi
    FROM perkara p
    LEFT JOIN perkara_mediasi pm ON p.perkara_id = pm.perkara_id  
    LEFT JOIN perkara_mediator pmed ON p.perkara_id = pmed.perkara_id 
    LEFT JOIN (
        SELECT 
            pm.mediasi_id,
            MAX(pj.tanggal_mediasi) AS tanggal_mediasi
        FROM perkara_jadwal_mediasi pj
        JOIN perkara_mediasi pm ON pj.mediasi_id = pm.mediasi_id
        GROUP BY pm.mediasi_id
    ) pj ON pm.mediasi_id = pj.mediasi_id 
    LEFT JOIN perkara_panitera_pn ppn ON p.perkara_id = ppn.perkara_id 
    WHERE YEAR(pj.tanggal_mediasi) = YEAR(CURDATE()) 
    AND ppn.aktif = 'Y' 
    AND pmed.aktif = 'Y'
    AND pm.tgl_laporan_mediator IS NULL
    AND pmed.nama_mediator LIKE '%${namaHakim}%'
    ORDER BY p.nomor_perkara DESC;`;

    // Tambahan query untuk persentase dan jumlah mediasi tiap mediator
    let queryTotalMediasi = `SELECT 
        perkara_mediator.nama_mediator,
        SUM(CASE WHEN hasil_mediasi = 'Y1' THEN 1 ELSE 0 END) AS 'Berhasil_Kesepakatan_Damai',
        SUM(CASE WHEN hasil_mediasi = 'Y2' THEN 1 ELSE 0 END) AS 'Berhasil_Dengan_Pencabutan',
        SUM(CASE WHEN hasil_mediasi = 'S' THEN 1 ELSE 0 END) AS 'Berhasil_Sebagian',
        SUM(CASE WHEN hasil_mediasi = 'D' THEN 1 ELSE 0 END) AS 'Tidak_Dapat_Dilaksanakan',
        SUM(CASE WHEN hasil_mediasi NOT IN ('Y1', 'Y2', 'S', 'D') THEN 1 ELSE 0 END) AS 'Tidak_Berhasil',
        COUNT(*) AS total_mediasi,
        ROUND(
            (SUM(CASE WHEN hasil_mediasi IN ('Y1', 'Y2') THEN 1 ELSE 0 END) * 100.0) / COUNT(*), 2
        ) AS persentase_berhasil
    FROM 
        perkara
    LEFT JOIN
        perkara_mediasi ON perkara.perkara_id = perkara_mediasi.perkara_id
    LEFT JOIN
        perkara_mediator ON perkara.perkara_id = perkara_mediator.perkara_id
    WHERE 
        perkara_mediasi.perkara_id IS NOT NULL 
        AND YEAR(keputusan_mediasi) = YEAR(CURDATE())
        AND perkara_mediator.aktif = 'Y'
        AND perkara_mediator.nama_mediator LIKE '%${namaHakim}%'
    GROUP BY 
        perkara_mediator.nama_mediator
    ORDER BY
        perkara_mediator.nama_mediator;`;

    // Tambahan query untuk jumlah erkara masuk, yang ditangani, yang putus dan persentase penerimaan perkara
    let queryTotalPenerimaanPutusanPerkara = `SELECT 
    COUNT(CASE 
      WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
          AND perkara.alur_perkara_id != 114 
          AND perkara_hakim_pn.hakim_nama LIKE '%${namaHakim}%'
          AND perkara_hakim_pn.aktif = 'Y'
      THEN perkara.perkara_id 
      END) AS jumlah_masuk,

    COUNT(CASE 
        WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
            AND perkara.alur_perkara_id != 114 
            AND perkara_hakim_pn.hakim_nama LIKE '%${namaHakim}%'
            AND perkara_hakim_pn.aktif = 'Y'
            AND perkara_hakim_pn.jabatan_hakim_id = 1
        THEN perkara.perkara_id 
        END) AS jumlah_ketua_majelis,

    COUNT(CASE 
        WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
            AND perkara.alur_perkara_id != 114 
            AND perkara_hakim_pn.hakim_nama LIKE '%${namaHakim}%'
            AND perkara_hakim_pn.aktif = 'Y'
            AND perkara_hakim_pn.jabatan_hakim_id = 3
        THEN perkara.perkara_id 
        END) AS jumlah_hakim_tunggal,

    (SELECT COUNT(*)
    FROM perkara
    WHERE YEAR(tanggal_pendaftaran) = YEAR(CURDATE())
      AND alur_perkara_id != 114
    ) AS total_perkara_masuk,

    COUNT(CASE 
        WHEN YEAR(perkara_putusan.tanggal_putusan) = YEAR(CURDATE()) 
            AND perkara_putusan.tanggal_putusan IS NOT NULL 
            AND perkara.alur_perkara_id != 114 
            AND perkara_hakim_pn.hakim_nama LIKE '%${namaHakim}%'
            AND perkara_hakim_pn.aktif = 'Y'
        THEN perkara.perkara_id 
        END) AS jumlah_putus,

    COUNT(CASE 
        WHEN YEAR(perkara_putusan.tanggal_putusan) = YEAR(CURDATE()) 
            AND perkara_putusan.tanggal_putusan IS NOT NULL 
            AND perkara.alur_perkara_id != 114
            AND perkara_hakim_pn.hakim_nama LIKE '%${namaHakim}%' 
            AND perkara_hakim_pn.aktif = 'Y'
            AND perkara_putusan.putusan_verstek = 'Y'
        THEN perkara.perkara_id 
        END) AS jumlah_putus_verstek,

    COUNT(CASE 
        WHEN YEAR(perkara_putusan.tanggal_putusan) = YEAR(CURDATE()) 
            AND perkara_putusan.tanggal_putusan IS NOT NULL 
            AND perkara.alur_perkara_id != 114
            AND perkara_hakim_pn.hakim_nama LIKE '%${namaHakim}%'
            AND perkara_hakim_pn.aktif = 'Y'
            AND perkara_putusan.putusan_verstek = 'T'
        THEN perkara.perkara_id 
        END) AS jumlah_putus_contra,

    -- Menambahkan kolom persentase
    CASE
        WHEN COUNT(CASE 
            WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
                AND perkara.alur_perkara_id != 114 
                AND perkara_hakim_pn.hakim_nama LIKE '%${namaHakim}%'
                AND perkara_hakim_pn.aktif = 'Y'
            THEN perkara.perkara_id 
            END) = 0 THEN 0
        ELSE 
            (COUNT(CASE 
                WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
                    AND perkara.alur_perkara_id != 114 
                    AND perkara_hakim_pn.hakim_nama LIKE '%${namaHakim}%'
                    AND perkara_hakim_pn.aktif = 'Y'
                THEN perkara.perkara_id 
                END) * 100.0 / (SELECT COUNT(*)
                                FROM perkara
                                WHERE YEAR(tanggal_pendaftaran) = YEAR(CURDATE())
                                  AND alur_perkara_id != 114
                              )) 
        END AS persentase_masuk
    FROM perkara
    LEFT JOIN perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id
    LEFT JOIN perkara_hakim_pn ON perkara_hakim_pn.perkara_id = perkara.perkara_id
    WHERE perkara_hakim_pn.aktif = 'Y'`;

         // Eksekusi query untuk penerimaan putusan perkara
        db.query(queryTotalPenerimaanPutusanPerkara, [`%${namaHakim}%`], (err, resultPenerimaan) => {
          if (err) {
              reject(err);
          } else {
              let responseMessagePenerimaan = '';
              if (resultPenerimaan.length != 0) {
                  let r = resultPenerimaan[0];
                  responseMessagePenerimaan += `*STATUS PERKARA YANG DI TANGANI :*\n`;
                  responseMessagePenerimaan += `- Perkara Ditangani : ${r.jumlah_masuk}\n          - Ketua Majelis : ${r.jumlah_ketua_majelis}\n          - Hakim Tunggal : ${r.jumlah_hakim_tunggal}\n- Perkara Putus : ${r.jumlah_putus} (${r.jumlah_putus_verstek} verstek) (${r.jumlah_putus_contra} contra/kabul)\n- Total Perkara Masuk di PA : ${r.total_perkara_masuk}\n- Persentase : ${r.persentase_masuk}%`; // Menyimpan hasil query penerimaan
              } else {
                  responseMessagePenerimaan += `*_-TIDAK ADA DATA UNTUK PENERIMAAN PERKARA TAHUN INI-_*\n\n`;
              }

              // Eksekusi query untuk mediasi
              db.query(queryTotalMediasi, [`%${namaHakim}%`], (err, resultMediasi) => {
                  if (err) {
                      reject(err);
                  } else {
                      let responseMessageMediasi = '';
                      if (resultMediasi.length != 0) {
                          let m = resultMediasi[0]; // Ambil hasil pertama
                          responseMessageMediasi += `*STATUS MEDIASI YANG DI TANGANI :*\n`;
                          responseMessageMediasi += `- Mediasi Ditangani : ${m.total_mediasi}\n- Persentase Keberhasilan : ${m.persentase_berhasil}%\n- Status Laporan Mediator :\n          - Kesepakatan Damai : ${m.Berhasil_Kesepakatan_Damai}\n          - Pencabutan : ${m.Berhasil_Dengan_Pencabutan}\n          - Berhasil Sebagian : ${m.Berhasil_Sebagian}\n          - Tidak Dapat Dilaksanakan : ${m.Tidak_Dapat_Dilaksanakan}\n          - Tidak Berhasil : ${m.Tidak_Berhasil}`; 
                      } else {
                          responseMessageMediasi += `*_-TIDAK ADA DATA MEDIASI TAHUN INI-_*`;
                      }

                      // Eksekusi query untuk sidang
                      db.query(query, [`%${namaHakim}%`], (err, result) => {
                        if (err) {
                            reject(err);
                        } else {
                            let responseMessage = '';
                            if (result.length != 0) {
                                let resultArray = [];
                                let no = 1;
                                resultArray.push(`*PERKARA AKTIF HINGGA HARI INI SEJUMLAH ${result.length} PERKARA, YAITU :*`);
                                result.forEach((r) => {
                                    resultArray.push(
                                        `*${no++}. ${r.nomor_perkara}* ${r.ecourt}${r.ghaib}${r.prodeo} (${r.durasi} Hari)\nMajelis Hakim : ${r.majelis_hakim_kode}\nTanggal Sidang : ${moment(r.tanggal_sidang).format("DD-MM-YYYY")}\nAgenda : ${r.agenda}\nPP : ${r.panitera_nama}\nJS : ${r.jurusita_nama}`
                                    );
                                });
                                responseMessage += resultArray.join("\n\n"); // Menyimpan hasil query pertama
                            } else {
                                responseMessage += `*_-TIDAK ADA DATA UNTUK SIDANG AKTIF HINGGA SAAT INI-_*\n\n`;
                            }

                            // Eksekusi query mediator
                            db.query(queryMediator, [`%${namaHakim}%`], (err, resultMediator) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    let mediatorResponseMessage = ''; // Pisahkan responseMessage untuk mediator
                                    if (resultMediator.length != 0) {
                                        let mediatorArray = [];
                                        let no = 1;
                                        mediatorArray.push(`*MEDIASI AKTIF HINGGA HARI INI: ${resultMediator.length} PERKARA, YAITU :*`);
                                        resultMediator.forEach((m) => {
                                            mediatorArray.push(
                                                `*${no++}. ${m.nomor_perkara}*\nTanggal Mediasi : ${moment(m.tanggal_mediasi).format("DD-MM-YYYY")}\nJenis Perkara : ${m.jenis_perkara_nama}\nPanitera: ${m.panitera_nama}`
                                            );
                                        });
                                        mediatorResponseMessage += mediatorArray.join("\n"); // Simpan hasil mediator
                                    } else {
                                        mediatorResponseMessage += `*_-TIDAK ADA DATA MEDIASI AKTIF HINGGA SAAT INI-_*`;
                                    }
                                    // Gabungkan semua responseMessage
                                    resolve(responseMessagePenerimaan + "\n\n" + responseMessageMediasi + "\n" + mediatorResponseMessage + "\n\n" + responseMessage); // Mengirimkan hasil gabungan
                                  }
                              });
                          }
                      });
                  }
              });
          }
      });
    } else if (keyword[0] == "pp") {
      if (keyword.length < 2) {
        let responseMessage = "Perintah salah, silahkan ketik pp#nama panitera sidang lengkap\ncontoh : pp#sugeng";
        return Promise.reject(responseMessage);
      }
    
      let ppNama = keyword.slice(1).join(' ');

      let query = `SELECT DISTINCT
      a.perkara_id,
      b.tanggal_sidang,
      a.nomor_perkara,
      b.agenda,
      c.panitera_nama,
      a.tanggal_pendaftaran,
      a.jenis_perkara_nama,
      a.para_pihak,
      a.tahapan_terakhir_id,
      a.tahapan_terakhir_text,
      a.proses_terakhir_id,
      a.proses_terakhir_text,
      n.majelis_hakim_kode,
      n.majelis_hakim_text,
      m.jurusita_nama,
      CASE
          WHEN f.jabatan_hakim_nama = 'Hakim Tunggal' THEN 'T'
          ELSE 'KM'
      END AS jabatan_hakim,
      CASE
          WHEN a.proses_terakhir_id < 210 THEN
              DATEDIFF(CURDATE(), a.tanggal_pendaftaran) - IFNULL(
                  (SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0
              )
          ELSE
              DATEDIFF(d.tanggal_putusan, a.tanggal_pendaftaran) - IFNULL(
                  (SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0
              )
      END + 1 AS durasi,
      CASE
          WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
          ELSE ''
      END AS ghaib,
      CASE
          WHEN a.prodeo = 1 THEN ' (_Prodeo_)'
          ELSE ''
      END AS prodeo,
      CASE
          WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
          ELSE ''
      END AS ecourt
  FROM 
      perkara AS a
  LEFT JOIN 
      (SELECT perkara_id, MAX(tanggal_sidang) AS tanggal_sidang_terakhir FROM perkara_jadwal_sidang GROUP BY perkara_id) AS subq 
      ON a.perkara_id = subq.perkara_id
  LEFT JOIN 
      perkara_jadwal_sidang AS b 
      ON a.perkara_id = b.perkara_id AND b.tanggal_sidang = subq.tanggal_sidang_terakhir
  LEFT JOIN 
      perkara_panitera_pn AS c 
      ON a.perkara_id = c.perkara_id
  LEFT JOIN 
      perkara_putusan AS d 
      ON a.perkara_id = d.perkara_id
  LEFT JOIN 
      perkara_hakim_pn AS f 
      ON a.perkara_id = f.perkara_id
  LEFT JOIN 
      perkara_pelaksanaan_relaas AS g 
      ON a.perkara_id = g.perkara_id
  LEFT JOIN 
      (SELECT perkara_id FROM perkara_efiling_id) AS h 
      ON a.perkara_id = h.perkara_id
  LEFT JOIN 
      (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i 
      ON a.perkara_id = i.perkara_id
  LEFT JOIN 
      perkara_pihak2 AS j 
      ON a.perkara_id = j.perkara_id
  LEFT JOIN 
      perkara_efiling_id AS k 
      ON a.perkara_id = k.perkara_id
  LEFT JOIN 
      perkara_pengacara AS l 
      ON a.perkara_id = l.perkara_id
  LEFT JOIN 
      perkara_jurusita AS m 
      ON a.perkara_id = m.perkara_id
  LEFT JOIN 
      perkara_penetapan AS n 
      ON a.perkara_id = n.perkara_id
  LEFT JOIN 
      perkara_ikrar_talak AS o
      ON a.perkara_id = o.perkara_id
  LEFT JOIN 
      v_pihak_perkara AS x 
      ON a.perkara_id = x.perkara_id
  LEFT JOIN 
      pihak AS w 
      ON x.pihak_id = w.id
  LEFT JOIN (
      SELECT
          a.pihak_id,
          MAX(CASE WHEN a.pihak_ke = 1 THEN CONCAT('+62', SUBSTRING(b.telepon, 2)) ELSE NULL END) AS teleponPenggugat,
          MAX(CASE WHEN a.pihak_ke = 2 THEN CONCAT('+62', SUBSTRING(b.telepon, 2)) ELSE NULL END) AS teleponTergugat
      FROM v_pihak_perkara AS a
      JOIN pihak AS b ON a.pihak_id = b.id 
                      AND b.telepon REGEXP '^[0-9]' 
                      AND CHAR_LENGTH(b.telepon) > 8
      GROUP BY a.pihak_id
  ) AS telepons ON x.pihak_id = telepons.pihak_id
  LEFT JOIN (
      SELECT
          perk.perkara_id,
          CASE
              WHEN datarelaas.tanggal_relaas IS NULL OR datarelaas.tanggal_relaas = '' THEN
              CASE
                  WHEN perkarapihak.pihakke = 1 THEN '(Belum Dipanggil P)'
                  WHEN perkarapihak.pihakke = 2 THEN '(Belum Dipanggil T)'
                  WHEN perkarapihak.pihakke IN (1,2) THEN '(Belum Dipanggil PT)'
                  WHEN perkarapihak.pihakke IN (1,2,4) THEN '(Belum Dipanggil PT & Turut T)'
                  WHEN perkarapihak.pihakke = 4 THEN '(Belum Dipanggil Turut Tergugat)'
                  ELSE '(Sudah Dipanggil dan Diupload)'
              END
          WHEN datarelaas.doc_relaas IS NULL OR datarelaas.doc_relaas = '' THEN
              CASE
                  WHEN perkarapihak.pihakke = 1 THEN '(Belum Diupload P)'
                  WHEN perkarapihak.pihakke = 2 THEN '(Belum Diupload T)'
                  WHEN perkarapihak.pihakke IN (1,2) THEN '(Belum Diupload PT)'
                  WHEN perkarapihak.pihakke IN (1,2,4) THEN '(Belum Diupload PT & Turut T)'
                  WHEN perkarapihak.pihakke = 4 THEN '(Belum Diupload Turut Tergugat)'
                  ELSE '(Sudah Dipanggil dan Diupload)'
              END
          ELSE '(Sudah Dipanggil dan Diupload)'
          END AS panggilan_status
      FROM
          perkara AS perk
          JOIN perkara_jadwal_sidang AS sidang ON sidang.perkara_id = perk.perkara_id
          JOIN (
              SELECT
                  p1.perkara_id,
                  p1.pihak_id,
                  p1.nama,
                  1 AS pihakke,
                  'pihak p' AS ketpihak,
                  '' AS pengacara_pihak_id
              FROM
                  perkara_pihak1 AS p1
                  JOIN perkara ON perkara.perkara_id = p1.perkara_id
              WHERE
                  alur_perkara_id < 111
              UNION
              SELECT
                  p2.perkara_id,
                  p2.pihak_id,
                  p2.nama,
                  2 AS pihakke,
                  'pihak t' AS ketpihak,
                  '' AS pengacara_pihak_id
              FROM
                  perkara_pihak2 AS p2
                  JOIN perkara ON perkara.perkara_id = p2.perkara_id
              WHERE
                  alur_perkara_id < 111
                  AND (
                      status_penahanan_id IS NULL
                      OR status_penahanan_id = 0
                  )
                  AND (
                      jenis_tahanan_id = 0
                      OR jenis_tahanan_id IS NULL
                  )
              UNION
              SELECT
                  p3.perkara_id,
                  p3.pihak_id,
                  p3.nama,
                  3 AS pihakke,
                  'intervensi' AS ketpihak,
                  '' AS pengacara_pihak_id
              FROM
                  perkara_pihak3 AS p3
              UNION
              SELECT
                  p4.perkara_id,
                  p4.pihak_id,
                  p4.nama,
                  4 AS pihakke,
                  'turut' AS ketpihak,
                  '' AS pengacara_pihak_id
              FROM
                  perkara_pihak4 AS p4
              UNION
              SELECT
                  p5.perkara_id,
                  p5.pengacara_id,
                  p5.nama,
                  p5.pihak_ke AS pihakke,
                  'pengacara' AS ketpihak,
                  p5.pihak_id AS pengacara_pihak_id
              FROM
                  perkara_pengacara AS p5
          ) AS perkarapihak 
          ON perkarapihak.perkara_id = perk.perkara_id
          LEFT JOIN perkara_pelaksanaan_relaas AS datarelaas 
          ON datarelaas.pihak_id = perkarapihak.pihak_id
          AND datarelaas.perkara_id = perk.perkara_id
          AND datarelaas.sidang_id = sidang.id
          LEFT JOIN (
              SELECT
                  perkara.perkara_id AS perkara_id,
                  perkara_jadwal_sidang.urutan AS urutan,
                  perkara_jadwal_sidang.dihadiri_oleh
              FROM
                  perkara
                  JOIN perkara_jadwal_sidang ON (
                      perkara_jadwal_sidang.perkara_id = perkara.perkara_id
                  )
          ) AS jadwalsidang 
          ON (
              jadwalsidang.perkara_id = perk.perkara_id
              AND jadwalsidang.urutan = sidang.urutan - 1
          )
          LEFT JOIN perkara_penetapan_hari_sidang AS phs 
          ON (
              phs.perkara_id = perk.perkara_id
              AND phs.jadwalsidang_id = sidang.id
          )
          JOIN alur_perkara AS alur 
          ON alur.id = perk.alur_perkara_id
      WHERE
          YEAR(perk.tanggal_pendaftaran) = YEAR(CURDATE())
          AND perk.alur_perkara_id < 111
          AND perkarapihak.pihak_id NOT IN (
              SELECT
                  pp.pihak_id
              FROM
                  perkara_pelaksanaan_relaas
                  JOIN perkara_pengacara AS pp 
                  ON pp.pengacara_id = perkara_pelaksanaan_relaas.pihak_id
                  AND pp.perkara_id = perkara_pelaksanaan_relaas.perkara_id
                  JOIN perkara ON pp.perkara_id = perkara.perkara_id
              WHERE
                  perk.alur_perkara_id < 111
                  AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
                  AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
                  AND (
                      perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL
                      OR perkara_pelaksanaan_relaas.tanggal_relaas <> ''
                  )
                  AND (
                      perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL
                      OR perkara_pelaksanaan_relaas.doc_relaas <> ''
                  )
              UNION
              SELECT
                  ppb.pengacara_id
              FROM
                  perkara_pelaksanaan_relaas
                  JOIN perkara_pengacara AS ppb 
                  ON ppb.pihak_id = perkara_pelaksanaan_relaas.pihak_id
                  AND ppb.perkara_id = perkara_pelaksanaan_relaas.perkara_id
                  JOIN perkara ON ppb.perkara_id = perkara.perkara_id
              WHERE
                  perk.alur_perkara_id < 111
                  AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
                  AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
                  AND (
                      perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL
                      OR perkara_pelaksanaan_relaas.tanggal_relaas <> ''
                  )
                  AND (
                      perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL
                      OR perkara_pelaksanaan_relaas.doc_relaas <> ''
                  )
          )
          AND (
              (
                  datarelaas.tanggal_relaas IS NULL
                  OR datarelaas.tanggal_relaas = ''
              )
              OR (
                  datarelaas.doc_relaas IS NULL
                  OR datarelaas.doc_relaas = ''
              )
          )
          AND(
              perk.alur_perkara_id >= 1
              AND perk.alur_perkara_id <= 17
          )
          AND (
              (jadwalsidang.dihadiri_oleh <> 1)
              AND (
                  jadwalsidang.dihadiri_oleh = 2
                  AND (
                      perkarapihak.pihakke = 2
                      OR perkarapihak.pihakke = 4
                  )
              )
              OR (
                  jadwalsidang.dihadiri_oleh = 3
                  AND perkarapihak.pihakke = 1
              )
              OR (
                  jadwalsidang.dihadiri_oleh = 4
                  OR jadwalsidang.dihadiri_oleh IS NULL
              )
          )
      ) AS doc_relaas_status 
      ON a.perkara_id = doc_relaas_status.perkara_id
      WHERE   
          YEAR(a.tanggal_pendaftaran) = YEAR(CURDATE())
          AND c.panitera_nama LIKE '%${ppNama}%'
          AND a.alur_perkara_id IN (15, 16, 17)
          AND c.aktif = 'Y'
          AND f.aktif = 'Y'
          AND m.aktif = 'Y'
          AND a.alur_perkara_id < 210
          AND (
              CASE 
                  WHEN a.jenis_perkara_id = 346 AND d.status_putusan_id = 62 AND o.amar_ikrar_talak IS NULL THEN a.proses_terakhir_id < 296 
                  ELSE a.proses_terakhir_id < 218 
              END
          )
      ORDER BY 
          b.tanggal_sidang,
          n.majelis_hakim_kode, 
          a.nomor_perkara, 
          a.alur_perkara_id, 
          ecourt, 
          ghaib, 
          prodeo DESC;`;
      
    // Tambahan query untuk jumlah erkara masuk, yang ditangani, yang putus dan persentase penerimaan perkara
    let queryTotalPenerimaanPutusanPerkara = `SELECT 
    COUNT(CASE 
        WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
            AND perkara.alur_perkara_id != 114 
            AND perkara_panitera_pn.panitera_nama LIKE '%${ppNama}%'
            AND perkara_panitera_pn.aktif = 'Y'
        THEN perkara.perkara_id 
        END) AS jumlah_masuk,

    (SELECT COUNT(*)
    FROM perkara
    WHERE YEAR(tanggal_pendaftaran) = YEAR(CURDATE())
      AND alur_perkara_id != 114
    ) AS total_perkara_masuk,

    COUNT(CASE 
        WHEN YEAR(perkara_putusan.tanggal_putusan) = YEAR(CURDATE()) 
            AND perkara_putusan.tanggal_putusan IS NOT NULL 
            AND perkara.alur_perkara_id != 114 
            AND perkara_panitera_pn.panitera_nama LIKE '%${ppNama}%'
            AND perkara_panitera_pn.aktif = 'Y'
        THEN perkara.perkara_id 
        END) AS jumlah_putus,

    -- Menambahkan kolom persentase
    CASE
        WHEN COUNT(CASE 
            WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
                AND perkara.alur_perkara_id != 114 
                AND perkara_panitera_pn.panitera_nama LIKE '%${ppNama}%'
                AND perkara_panitera_pn.aktif = 'Y'
            THEN perkara.perkara_id 
            END) = 0 THEN 0
        ELSE 
            (COUNT(CASE 
                WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
                    AND perkara.alur_perkara_id != 114 
                    AND perkara_panitera_pn.panitera_nama LIKE '%${ppNama}%'
                    AND perkara_panitera_pn.aktif = 'Y'
                THEN perkara.perkara_id 
                END) * 100.0 / (SELECT COUNT(*)
                                FROM perkara
                                WHERE YEAR(tanggal_pendaftaran) = YEAR(CURDATE())
                                  AND alur_perkara_id != 114
                              )) 
        END AS persentase_masuk
    FROM perkara
    LEFT JOIN perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id
    LEFT JOIN perkara_panitera_pn ON perkara_panitera_pn.perkara_id = perkara.perkara_id
    WHERE perkara_panitera_pn.aktif = 'Y'`;
      
          // Eksekusi query untuk penerimaan putusan perkara
          db.query(queryTotalPenerimaanPutusanPerkara, [`%${ppNama}%`], (err, resultPenerimaan) => {
            if (err) {
                reject(err);
            } else {
                let responseMessagePenerimaan = '';
                if (resultPenerimaan.length != 0) {
                    let r = resultPenerimaan[0];
                    responseMessagePenerimaan += `*STATUS PERKARA YANG DI TANGANI :*\n`;
                    responseMessagePenerimaan += `- Perkara Ditangani : ${r.jumlah_masuk}\n- Perkara Putus : ${r.jumlah_putus}\n- Total Perkara Masuk di PA : ${r.total_perkara_masuk}\n- Persentase : ${r.persentase_masuk}%`; // Menyimpan hasil query penerimaan
                } else {
                    responseMessagePenerimaan += `*_-TIDAK ADA DATA UNTUK PENERIMAAN PERKARA TAHUN INI-_*\n\n`;
                }

                // Eksekusi query untuk perkara yang aktif
                db.query(query, [`%${ppNama}%`], (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        let responseMessage = ''; // Inisialisasi responseMessage
                        if (result.length != 0) {
                            let resultArray = [];
                            let no = 1;
                            resultArray.push(`*PERKARA AKTIF HINGGA HARI INI SEJUMLAH ${result.length} PERKARA, YAITU :*`);
                            result.forEach((r) => {
                                resultArray.push(
                                    `*${no++}. ${r.nomor_perkara}*${r.ecourt}${r.ghaib}${r.prodeo} (${r.durasi} Hari)\nMajelis Hakim : ${r.majelis_hakim_kode}\nTanggal Sidang : ${moment(r.tanggal_sidang).format("DD-MM-YYYY")}\nAgenda : ${r.agenda}\nJS : ${r.jurusita_nama}`
                                );
                            });
                            responseMessage += resultArray.join("\n\n");
                        } else {
                            responseMessage += `Tidak ada data`;
                        }
                        // Gabungkan semua responseMessage
                        resolve(responseMessagePenerimaan + "\n\n" + responseMessage); // Mengirimkan hasil gabungan
                    }
                });
            }
          });
    } else if (keyword[0] == "js") {
      if (keyword.length < 2) {
        let responseMessage = "Perintah salah, silahkan ketik js#nama js lengkap\ncontoh : js#harbi";
        return Promise.reject(responseMessage);
      }
    
      let jsNama = keyword.slice(1).join(' ');

      let query = `SELECT
      perk.nomor_perkara,
      perk.perkara_id,
      perk.alur_perkara_id,
      perk.jenis_perkara_nama,
      alur.nama AS nama_alur,
      CASE
          WHEN k.perkara_id IS NOT NULL THEN " (*E-Court*)" 
          ELSE ""
      END AS ecourt,
      CASE
          WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
          ELSE ''
      END AS ghaib,
      CASE
          WHEN perk.prodeo = 1 THEN ' (_Prodeo_)'
          ELSE ''
      END AS prodeo,
      (
          SELECT
              GROUP_CONCAT(
                  DISTINCT hkpn.nama_gelar
                  ORDER BY
                      hk.id ASC SEPARATOR ' \n'
              ) AS nama_hakim
          FROM
              perkara_hakim_pn AS hk
              JOIN hakim_pn AS hkpn ON hkpn.id = hk.hakim_id
          WHERE
              hk.perkara_id = perk.perkara_id
              AND hk.aktif = 'Y'
          ORDER BY
              hk.urutan ASC
      ) AS majelis_hakim,
      (
          SELECT
              GROUP_CONCAT(
                  DISTINCT pp.nama
                  ORDER BY
                      ppp.id ASC SEPARATOR '<br>'
              ) AS nama_js
          FROM
              perkara_panitera_pn AS ppp
              JOIN panitera_pn AS pp ON pp.id = ppp.panitera_id
          WHERE
              ppp.perkara_id = perk.perkara_id
              AND ppp.aktif = 'Y'
          ORDER BY
              ppp.urutan ASC
      ) AS panitera_nama,
      (
          SELECT
              GROUP_CONCAT(
                  DISTINCT jspn.nama
                  ORDER BY
                      pjs.id ASC SEPARATOR '<br>'
              ) AS nama_js
          FROM
              perkara_jurusita AS pjs
              JOIN jurusita AS jspn ON jspn.id = pjs.jurusita_id
          WHERE
              pjs.perkara_id = perk.perkara_id
              AND pjs.aktif = 'Y'
          ORDER BY
              pjs.urutan ASC
      ) AS jurusita,
      sidang.id AS sidang_id,
      DATE_FORMAT(sidang.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
      sidang.agenda,
      perkarapihak.pihak_id,
      perkarapihak.nama AS nama_pihak,
      perkarapihak.pihakke,
      perkarapihak.ketpihak,
      perkarapihak.pengacara_pihak_id,
      datarelaas.id AS relaas_id,
      DATE_FORMAT(datarelaas.tanggal_relaas, '%d-%m-%Y') AS tanggal_relaas,
      datarelaas.doc_relaas,
      sidang.urutan,
      jadwalsidang.urutan AS urutan_sebelumnya,
      jadwalsidang.dihadiri_oleh AS status_kehadiran_sebelumnya,
      (
          CASE
              WHEN(phs.tahapan_id = 12) THEN 'Y'
              ELSE 'T'
          END
      ) AS sidang_pertama
    FROM
      perkara AS perk
      JOIN perkara_jadwal_sidang AS sidang ON sidang.perkara_id = perk.perkara_id
      JOIN (
          SELECT
              p1.perkara_id,
              p1.pihak_id,
              p1.nama,
              1 AS pihakke,
              'pihak p' AS ketpihak,
              '' AS pengacara_pihak_id
          FROM
              perkara_pihak1 AS p1
              JOIN perkara ON perkara.perkara_id = p1.perkara_id
          WHERE
              alur_perkara_id < 111
          UNION
          SELECT
              p2.perkara_id,
              p2.pihak_id,
              p2.nama,
              2 AS pihakke,
              'pihak t' AS ketpihak,
              '' AS pengacara_pihak_id
          FROM
              perkara_pihak2 AS p2
              JOIN perkara ON perkara.perkara_id = p2.perkara_id
          WHERE
              alur_perkara_id < 111
              AND (
                  status_penahanan_id IS NULL
                  OR status_penahanan_id = 0
              )
              AND (
                  jenis_tahanan_id = 0
                  OR jenis_tahanan_id IS NULL
              )
          UNION
          SELECT
              p3.perkara_id,
              p3.pihak_id,
              p3.nama,
              3 AS pihakke,
              'intervensi' AS ketpihak,
              '' AS pengacara_pihak_id
          FROM
              perkara_pihak3 AS p3
          UNION
          SELECT
              p4.perkara_id,
              p4.pihak_id,
              p4.nama,
              4 AS pihakke,
              'turut' AS ketpihak,
              '' AS pengacara_pihak_id
          FROM
              perkara_pihak4 AS p4
          UNION
          SELECT
              p5.perkara_id,
              p5.pengacara_id,
              p5.nama,
              p5.pihak_ke AS pihhkke,
              'pengacara' AS ketpihak,
              p5.pihak_id AS pengacara_pihak_id
          FROM
              perkara_pengacara AS p5
      ) AS perkarapihak ON perkarapihak.perkara_id = perk.perkara_id
      LEFT JOIN perkara_pelaksanaan_relaas AS datarelaas ON datarelaas.pihak_id = perkarapihak.pihak_id
      AND datarelaas.perkara_id = perk.perkara_id
      AND datarelaas.sidang_id = sidang.id
      LEFT JOIN (
          SELECT
              perkara.perkara_id AS perkara_id,
              perkara_jadwal_sidang.urutan AS urutan,
              perkara_jadwal_sidang.dihadiri_oleh
          FROM
              perkara
              JOIN perkara_jadwal_sidang ON (
                  perkara_jadwal_sidang.perkara_id = perkara.perkara_id
              )
      ) AS jadwalsidang ON (
          jadwalsidang.perkara_id = perk.perkara_id
          AND jadwalsidang.urutan = sidang.urutan - 1
      )
      LEFT JOIN perkara_penetapan_hari_sidang AS phs ON (
          phs.perkara_id = perk.perkara_id
          AND phs.jadwalsidang_id = sidang.id
      )
      JOIN alur_perkara AS alur ON alur.id = perk.alur_perkara_id
      LEFT JOIN 
        perkara_efiling_id AS k ON perk.perkara_id = k.perkara_id
      LEFT JOIN 
        (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i 
        ON perk.perkara_id = i.perkara_id
      LEFT JOIN
        perkara_jurusita AS m ON perk.perkara_id = m.perkara_id
    WHERE
      m.jurusita_nama LIKE '%${jsNama}%'
      AND YEAR(perk.tanggal_pendaftaran) = YEAR(CURDATE())
      AND perk.alur_perkara_id < 111
      AND perkarapihak.pihak_id NOT IN (
          SELECT
              pp.pihak_id
          FROM
              perkara_pelaksanaan_relaas
              JOIN perkara_pengacara AS pp ON pp.pengacara_id = perkara_pelaksanaan_relaas.pihak_id
              AND pp.perkara_id = perkara_pelaksanaan_relaas.perkara_id
              JOIN perkara ON pp.perkara_id = perkara.perkara_id
          WHERE
              perk.alur_perkara_id < 111
              AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
              AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
              AND (
                  perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL
                  OR perkara_pelaksanaan_relaas.tanggal_relaas <> ''
              )
              AND (
                  perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL
                  OR perkara_pelaksanaan_relaas.doc_relaas <> ''
              )
          UNION
          SELECT
              ppb.pengacara_id
          FROM
              perkara_pelaksanaan_relaas
              JOIN perkara_pengacara AS ppb ON ppb.pihak_id = perkara_pelaksanaan_relaas.pihak_id
              AND ppb.perkara_id = perkara_pelaksanaan_relaas.perkara_id
              JOIN perkara ON ppb.perkara_id = perkara.perkara_id
          WHERE
              perk.alur_perkara_id < 111
              AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
              AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
              AND (
                  perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL
                  OR perkara_pelaksanaan_relaas.tanggal_relaas <> ''
              )
              AND (
                  perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL
                  OR perkara_pelaksanaan_relaas.doc_relaas <> ''
              )
      )
      AND (
          (
              datarelaas.tanggal_relaas IS NULL
              OR datarelaas.tanggal_relaas = ''
          )
          OR (
              datarelaas.doc_relaas IS NULL
              OR datarelaas.doc_relaas = ''
          )
      )
      AND(
          perk.alur_perkara_id >= 1
          AND perk.alur_perkara_id <= 17
      )
      AND (
          (jadwalsidang.dihadiri_oleh <> 1)
          AND (
              jadwalsidang.dihadiri_oleh = 2
              AND (
                  perkarapihak.pihakke = 2
                  OR perkarapihak.pihakke = 4
              )
          )
          OR (
              jadwalsidang.dihadiri_oleh = 3
              AND perkarapihak.pihakke = 1
          )
          OR (
              jadwalsidang.dihadiri_oleh = 4
              OR jadwalsidang.dihadiri_oleh IS NULL
          )
      )
    ORDER BY
      perk.perkara_id DESC,
      sidang.tanggal_sidang ASC`;
      
    // Tambahan query untuk jumlah erkara masuk, yang ditangani, yang putus dan persentase penerimaan perkara
    let queryTotalPenerimaanPutusanPerkara = `SELECT 
    COUNT(CASE 
        WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
            AND perkara.alur_perkara_id != 114 
            AND perkara_jurusita.jurusita_nama LIKE '%${jsNama}%'
            AND perkara_jurusita.aktif = 'Y'
        THEN perkara.perkara_id 
        END) AS jumlah_masuk,

    (SELECT COUNT(*)
    FROM perkara
    WHERE YEAR(tanggal_pendaftaran) = YEAR(CURDATE())
      AND alur_perkara_id != 114
    ) AS total_perkara_masuk,

    COUNT(CASE 
        WHEN YEAR(perkara_putusan.tanggal_putusan) = YEAR(CURDATE()) 
            AND perkara_putusan.tanggal_putusan IS NOT NULL 
            AND perkara.alur_perkara_id != 114 
            AND perkara_jurusita.jurusita_nama LIKE '%${jsNama}%'
            AND perkara_jurusita.aktif = 'Y'
        THEN perkara.perkara_id 
        END) AS jumlah_putus,

    -- Menambahkan kolom persentase
    CASE
        WHEN COUNT(CASE 
            WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
                AND perkara.alur_perkara_id != 114 
                AND perkara_jurusita.jurusita_nama LIKE '%${jsNama}%'
                AND perkara_jurusita.aktif = 'Y'
            THEN perkara.perkara_id 
            END) = 0 THEN 0
        ELSE 
            (COUNT(CASE 
                WHEN YEAR(perkara.tanggal_pendaftaran) = YEAR(CURDATE()) 
                    AND perkara.alur_perkara_id != 114 
                    AND perkara_jurusita.jurusita_nama LIKE '%${jsNama}%'
                    AND perkara_jurusita.aktif = 'Y'
                THEN perkara.perkara_id 
                END) * 100.0 / (SELECT COUNT(*)
                                FROM perkara
                                WHERE YEAR(tanggal_pendaftaran) = YEAR(CURDATE())
                                  AND alur_perkara_id != 114
                              )) 
        END AS persentase_masuk
    FROM perkara
    LEFT JOIN perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id
    LEFT JOIN perkara_jurusita ON perkara_jurusita.perkara_id = perkara.perkara_id
    WHERE perkara_jurusita.aktif = 'Y'`;
      
          // Eksekusi query untuk penerimaan putusan perkara
          db.query(queryTotalPenerimaanPutusanPerkara, [`%${jsNama}%`], (err, resultPenerimaan) => {
            if (err) {
                reject(err);
            } else {
                let responseMessagePenerimaan = '';
                if (resultPenerimaan.length != 0) {
                    let r = resultPenerimaan[0];
                    responseMessagePenerimaan += `*STATUS PERKARA YANG DI TANGANI :*\n`;
                    responseMessagePenerimaan += `- Perkara Ditangani : ${r.jumlah_masuk}\n- Perkara Putus : ${r.jumlah_putus}\n- Total Perkara Masuk di PA : ${r.total_perkara_masuk}\n- Persentase : ${r.persentase_masuk}%`; // Menyimpan hasil query penerimaan
                } else {
                    responseMessagePenerimaan += `*_-TIDAK ADA DATA UNTUK PENERIMAAN PERKARA TAHUN INI-_*\n\n`;
                }

                // Eksekusi query untuk perkara yang aktif
                db.query(query, [`%${jsNama}%`], (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        let responseMessage = ''; // Inisialisasi responseMessage
                        if (result.length != 0) {
                            let resultArray = [];
                            let no = 1;
                            resultArray.push(`*PERKARA AKTIF HINGGA HARI INI SEJUMLAH ${result.length} PERKARA, YAITU :*`);
                            result.forEach((r) => {
                                resultArray.push(
                                    `*${no++}. ${r.nomor_perkara}* ${r.ecourt}${r.ghaib}${r.prodeo}\nTanggal Sidang : ${r.tanggal_sidang}\nNama Pihak : ${r.nama_pihak}\n*Jurusita : ${r.jurusita}*`
                                );
                            });
                            responseMessage += resultArray.join("\n\n");
                        } else {
                            responseMessage += `Tidak ada data`;
                        }
                        // Gabungkan semua responseMessage
                        resolve(responseMessagePenerimaan + "\n\n" + responseMessage); // Mengirimkan hasil gabungan
                    }
                });
            }
          });
    } else if (keyword[0] == "sidang js") {
      const message = async () => {
        let promisePutusJurusita = notification.getDataPutusJurusita();
        let messagePutusJurusita = await promisePutusJurusita;
        let promiseTundaJurusita = notification.getDataTundaJurusita();
        let messageTundaJurusita = await promiseTundaJurusita;
        let msg = `*Perkara putus hari ini :* \n${messagePutusJurusita} \n\n*Perkara yang tunda hari ini :* \n${messageTundaJurusita}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev sidang besok") {
      const message = async () => {
        let promiseJadwalBesok = notification.getDataJadwalBesok();
        let messageJadwalBesok = await promiseJadwalBesok;
        let msg = `*Jadwal sidang besok :* \n${messageJadwalBesok}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev sidang") {
      const message = async () => {
        let promiseJadwalSidangPerdata = notification.getDataJadwalSidangPerdata();
        let messageJadwalSidangPerdata = await promiseJadwalSidangPerdata;
        let promiseJadwalMediasi = notification.getDataJadwalMediasi();
        let messageJadwalMediasi = await promiseJadwalMediasi;
        let msg = `*Data Sidang Hari Ini* : \n${messageJadwalSidangPerdata}\n\n*Data Mediasi Hari Ini* : \n${messageJadwalMediasi}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev sidang hari ini lengkap") {
      const message = async () => {
        let promiseSidangPidana = notification.getJadwalSidangPidana();
        let messageSidangPidana = await promiseSidangPidana;
        let promiseSidangPerdata = notification.getJadwalSidangPerdata();
        let messageSidangPerdata = await promiseSidangPerdata;
        let promiseJadwalMediasi = notification.getDataJadwalMediasi();
        let messageJadwalMediasi = await promiseJadwalMediasi;
        let msg = `*Jadwal Sidang Pidana/Jinayat hari ini :* \n${messageSidangPidana} \n\n*Jadwal Sidang Perdata hari ini :* \n${messageSidangPerdata} \n\n*Jadwal Mediasi hari ini :* \n${messageJadwalMediasi}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "monev sidang tanggal") {
      if (keyword.length == 1) {
        let responseMessage =
          "Perintah salah silahkan ketik monev sidang tanggal#tanggal, contoh monev sidang tanggal#20-12-2021";
        resolve(responseMessage);
        return;
      }
      let tanggal = keyword[1];
      const message = async () => {
        let promiseSidangPidana = getJadwalSidangPidanaMonev(tanggal);
        let messageSidangPidana = await promiseSidangPidana
        let promiseSidangPerdata = getJadwalSidangPerdataMonev(tanggal);
        let messageSidangPerdata = await promiseSidangPerdata;
        let promiseJadwalMediasi = getDataJadwalMediasiMonev(tanggal);
        let messageJadwalMediasi = await promiseJadwalMediasi;
        let msg = `*Jadwal Sidang Pidana/Jinayat tanggal ${tanggal} :* \n${messageSidangPidana} \n\n*Jadwal Sidang Perdata tanggal ${tanggal} :* \n${messageSidangPerdata} \n\n*Jadwal Mediasi tanggal ${tanggal} :* \n${messageJadwalMediasi}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "sidang hari ini") {
      const message = async () => {
        let promiseSidangPerdata = getJadwalSidangPerdata();
        let messageSidangPerdata = await promiseSidangPerdata;
        let promiseJadwalMediasi = getDataJadwalMediasi();
        let messageJadwalMediasi = await promiseJadwalMediasi;
        let msg = `*Jadwal Sidang hari ini :* \n${messageSidangPerdata} \n\n*Jadwal Mediasi hari ini :* \n${messageJadwalMediasi}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "sidang besok") {
      const message = async () => {
        let promiseSidangPerdata = getJadwalSidangPerdataBesok();
        let messageSidangPerdata = await promiseSidangPerdata;
        let msg = `*Jadwal Sidang hari ini :* \n${messageSidangPerdata}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "sidang tanggal") {
      if (keyword.length == 1) {
        let responseMessage =
          "Perintah salah silahkan ketik sidang tanggal#tanggal, contoh sidang tanggal#20-12-2021";
        resolve(responseMessage);
        return;
      }
      let tanggal = keyword[1];
      const message = async () => {
        let promiseSidangPidana = getJadwalSidangPidana(tanggal);
        let messageSidangPidana = await promiseSidangPidana;
        let promiseSidangPerdata = getJadwalSidangPerdata(tanggal);
        let messageSidangPerdata = await promiseSidangPerdata;
        let promiseJadwalMediasi = getDataJadwalMediasi(tanggal);
        let messageJadwalMediasi = await promiseJadwalMediasi;
        let msg = `*Jadwal Sidang Pidana tanggal ${tanggal} :* \n${messageSidangPidana} \n\n*Jadwal Sidang Perdata  tanggal ${tanggal} :* \n${messageSidangPerdata} \n\n*Jadwal Mediasi tanggal ${tanggal} :* \n${messageJadwalMediasi}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "bas hakim") {
      if (keyword.length == 1) {
        let responseMessage =
          "Perintah salah silahkan ketik bas hakim#nama hakim, contoh sidang bas hakim#derry";
        resolve(responseMessage);
        return;
      }
      const message = async () => {
        let namaHakim = keyword.slice(1).join(' '); // Ambil nama hakim dari keyword
        let promiseBasHakim = notification.getDataBASHakim(namaHakim); // Kirim nama hakim ke fungsi
        let messageBasHakim = await promiseBasHakim;
        console.log(messageBasHakim); // Menambahkan console log untuk hasil
        let msg = `*BAS yang belum dikerjakan/diupload pada Majelis/Tunggal Hakim ${namaHakim} :\n${messageBasHakim}`;
        return msg;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "statistik") {
      if (keyword.length == 1) {
        let responseMessage =
          "Perintah salah silahkan ketik statistisk#tahun, contoh: statistik#2021";
        resolve(responseMessage);
        return;
      }
      let year = keyword[1];
      const message = async () => {
        let promiseStatistik = getStatistik(year);
        let messageStatistik = await promiseStatistik;
        return messageStatistik;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "statistik detail") {
      if (keyword.length == 1) {
        let responseMessage =
          "Perintah salah silahkan ketik statistisk detail#tahun, contoh: statistik detail#2021";
        resolve(responseMessage);
        return;
      }
      let year = keyword[1];
      const message = async () => {
        let promiseStatistik = getStatistikDetail(year);
        let messageStatistik = await promiseStatistik;
        return messageStatistik;
      };

      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "stikersss") {
      const stiker = async () => {
        return createLocalMediaIfExists("./public/sticker/Naruto_Uzumaki.png", "naruto") ||
          "File sticker belum tersedia di server.";
        // console.log(media);
      };

      stiker().then((obj) => {
        resolve(obj);
      });
      // resolve(stiker());
    } else if (keyword[0] == "misss") {
      const message = async () => {
        let promiseMis = mis();
        let messageMis = await promiseMis;
        return messageMis;
      };
      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "bhtcapilsss") {
      if (keywirod.length < 3) {
        let responseMessage = "Maaf, format keyword salah. Format keyword yang benar adalah: bhtcapil [tahun]#[bulan]. Contoh: bhtcapil#2021#01";
        resolve(responseMessage);
        return;
      }
      let year = keyword[1];
      let month = keyword[2];
      const message = async () => {
        let promiseBhtCapil = getBhtCapil(month, year);
        let messageBhtCapil = await promiseBhtCapil;
        return messageBhtCapil;
      };
      let responseMessage = message();
      resolve(responseMessage);
    } else if (keyword[0] == "derry") {
      let responseMessage = `Silahkan ketik _Halo_ untuk memulai`;
      resolve(responseMessage);
    }
  });
};

// Inisiasi pesan masuk
const getBiayaPerkara = (message, db) => {
  let pengadilan = "Pengadilan Agama Donggala";
  let keyword = message.body.toLowerCase().split(' ');
  let totalBiaya = 0; // Inisiasi total biaya
  let jenisPerkara = ""; // Simpan jenis perkara yang dipilih

 // Biaya yang ditetapkan
 const biayaList = {
  "Biaya Pendaftaran": 30000,
  "Biaya Proses/ATK": 75000,
  "PNBP Cabut": 10000,
  "PNBP Panggilan & PBT": 40000,
  "Redaksi": 10000,
  "Materai": 10000,
};

  return new Promise((resolve, reject) => {
    // Mulai logika pesan untuk pemilihan jenis perkara
    if (keyword.length > 0 && (keyword[0] == "mulai")) {
      let responseMessage = `*_Assalamu’alaikum Warahmatullahi Wabarakatuh_*\n
Pilih jenis perkara (Ketik sesuai dengan namanya dan tidak perlu ketik penjelasannya, contoh: Cerai Gugat):

- Cerai Gugat (Istri Gugat Cerai)
- Cerai Talak (Suami Gugat Cerai)
- Itsbat Nikah (Nikah Siri)
- Dispensasi Kawin (Nikah Dibawah Umur)
- P3HP/Penetapan Ahli Waris
- Pembatalan Perkawinan
- Izin Poligami
- Harta Bersama (Harta Gono Gini)
- Penguasaan Anak
- Nafkah Anak Oleh Ibu karena Ayah tidak mampu
- Hak - hak bekas istri/kewajiban bekas Suami
- Pencabutan Kekuasaan Orang Tua
- Pencabutan Kekuasaan Wali
- Penunjukan orang lain sebagai Wali oleh Pengadilan
- Ganti Rugi terhadap Wali
- Perkawinan Campuran
- Kewarisan
- Hibah
- Wakaf
- Ekonomi Syariah
- Kelalaian Atas Kewajiban Suami / Istri
- Pengesahan Anak
- Asal Usul Anak
- Wali Adhol`;

      resolve(responseMessage);
    } 
    // Jika jenis perkara sudah dipilih
    else if (keyword[0] == "cerai" || keyword[0] == "itsbat" || keyword[0] == "dispensasi" || keyword[0] == "p3hp" || keyword[0] == "pembatalan" || keyword[0] == "izin" || keyword[0] == "harta" || keyword[0] == "penguasaan" || keyword[0] == "nafkah" || keyword[0] == "hak" || keyword[0] == "pencabutan" || keyword[0] == "penunjukan" || keyword[0] == "ganti" || keyword[0] == "perkawinan" || keyword[0] == "kewarisan" || keyword[0] == "hibah" || keyword[0] == "wakaf" || keyword[0] == "ekonomi" || keyword[0] == "kelalaian" || keyword[0] == "pengesahan" || keyword[0] == "asal" || keyword[0] == "wali") {
      jenisPerkara = keyword.join(' ');
      let responseMessage = `Jenis perkara yang dipilih adalah: ${jenisPerkara}.\nSilahkan isi nama desa untuk Pihak Penggugat.`;
      resolve(responseMessage);
    } 
    else if (keyword[0] == "desa") {
      if (keyword.length == 1) {
        let responseMessage = "Perintah salah, silakan ketik nama desa setelah kata 'desa'.";
        resolve(responseMessage);
        return;
      }

      let namaDesa = keyword.slice(1).join(' ');
      let queryDesa = `SELECT kel, kec, kabkota, prop_name, nilai FROM tb_kelurahan_komdanas WHERE kel LIKE '%${namaDesa}%'`;

      db.query(queryDesa, (err, results) => {
        if (err) {
          reject(err);
        } else if (results.length == 0) {
          resolve(`Desa dengan nama ${namaDesa} tidak ditemukan.`);
        } else if (results.length == 1) {
          // Jika hanya ada satu hasil
          let result = results[0];
          let queryKelipatanP = `SELECT panggilan_p FROM kewenangan_satker WHERE nama_kewenangan LIKE '%${jenisPerkara}%'`;
          db.query(queryKelipatanP, (err, resultP) => {
            if (err) {
              reject(err);
            } else {
              let panggilanP = resultP.length > 0 ? resultP[0].panggilan_p : 1; // Default kelipatan 1 jika tidak ditemukan
              totalBiaya += result.nilai * panggilanP;
              resolve(`Biaya untuk Pihak Penggugat di desa ${result.kel}, kecamatan ${result.kec}, kabupaten ${result.kabkota}, provinsi ${result.prop_name}.\n\nSekarang, silakan ketik nama desa untuk Pihak Tergugat.`);
            }
          });
        } else {
          // Jika ada lebih dari satu hasil
          let responseMessage = `Terdapat beberapa desa dengan nama '${namaDesa}'. Silakan pilih kecamatan/kabupaten/provinsi yang sesuai:\n`;
          results.forEach((desa, index) => {
            responseMessage += `${index + 1}. Desa: ${desa.kel}, Kecamatan: ${desa.kec}, Kabupaten: ${desa.kabkota}, Provinsi: ${desa.prop_name}\n`;
          });
          responseMessage += `\nKetik angka yang sesuai dengan pilihan Anda.`;
          resolve(responseMessage);
        }
      });
    } 
    else if (keyword[0] == "pilih") {
      let pilihanIndex = parseInt(keyword[1]) - 1;
      let namaDesa = keyword.slice(2).join(' ');
      let queryDesa = `SELECT kel, kec, kabkota, prop_name, nilai FROM tb_kelurahan_komdanas WHERE kel LIKE '%${namaDesa}%'`;

      db.query(queryDesa, (err, results) => {
        if (err) {
          reject(err);
        } else if (results.length > pilihanIndex) {
          let result = results[pilihanIndex];
          let queryKelipatanP = `SELECT panggilan_p FROM kewenangan_satker WHERE nama_kewenangan LIKE '%${jenisPerkara}%'`;
          db.query(queryKelipatanP, (err, resultP) => {
            if (err) {
              reject(err);
            } else {
              let panggilanP = resultP.length > 0 ? resultP[0].panggilan_p : 1; // Default kelipatan 1 jika tidak ditemukan
              totalBiaya += result.nilai * panggilanP;
              resolve(`Biaya untuk Pihak Penggugat di desa ${result.kel}, kecamatan ${result.kec}, kabupaten ${result.kabkota}, provinsi ${result.prop_name}.\n\nSekarang, silakan ketik nama desa untuk Pihak Tergugat.`);
            }
          });
        } else {
          resolve(`Pilihan tidak valid. Silakan ulangi proses dengan memasukkan pilihan yang sesuai.`);
        }
      });
    } 
    else if (keyword[0] == "lawan") {
      if (keyword.length == 1) {
        let responseMessage = "Perintah salah, silakan ketik nama desa Pihak Tergugat setelah kata 'lawan'.";
        resolve(responseMessage);
        return;
      }

      let namaDesaLawan = keyword.slice(1).join(' ');
      let queryDesaLawan = `SELECT kel, kec, kabkota, prop_name, nilai FROM tb_kelurahan_komdanas WHERE kel LIKE '%${namaDesaLawan}%'`;

      db.query(queryDesaLawan, (err, results) => {
        if (err) {
          reject(err);
        } else if (results.length == 0) {
          resolve(`Desa dengan nama ${namaDesaLawan} tidak ditemukan.`);
        } else if (results.length == 1) {
          // Jika hanya ada satu hasil untuk Pihak Tergugat
          let result = results[0];
          let queryKelipatanT = `SELECT panggilan_t FROM kewenangan_satker WHERE nama_kewenangan LIKE '%${jenisPerkara}%'`;
          db.query(queryKelipatanT, (err, resultT) => {
            if (err) {
              reject(err);
            } else {
              let panggilanT = resultT.length > 0 ? resultT[0].panggilan_t : 1; // Default kelipatan 1 jika tidak ditemukan
              totalBiaya += result.nilai * panggilanT;
              resolve(`Biaya untuk Pihak Tergugat di desa ${result.kel}, kecamatan ${result.kec}, kabupaten ${result.kabkota}, provinsi ${result.prop_name}.\n\nTotal biaya perkara adalah Rp ${totalBiaya}.`);
            }
          });
        } else {
          // Jika ada lebih dari satu hasil untuk Pihak Tergugat
          let responseMessage = `Terdapat beberapa desa dengan nama '${namaDesaLawan}'. Silakan pilih kecamatan/kabupaten/provinsi yang sesuai:\n`;
          results.forEach((desa, index) => {
            responseMessage += `${index + 1}. Desa: ${desa.kel}, Kecamatan: ${desa.kec}, Kabupaten: ${desa.kabkota}, Provinsi: ${desa.prop_name}\n`;
          });
          responseMessage += `\nKetik angka yang sesuai dengan pilihan Anda.`;
          resolve(responseMessage);
        }
      });
    } 
    else {
      resolve("Perintah tidak dikenali. Silakan coba lagi.");
    }
  });
};


// Kode di atas adalah penambahan logika biaya perkara.


// // Inisiasi pesan masuk
// const getBiayaPerkara = (message, db) => {
//   const pengadilan = "Pengadilan Agama Donggala";
//   const keyword = message.body.toLowerCase().split(' ');
//   let totalBiayaAwal = 0; // Inisiasi total biaya untuk pihak pertama
//   let totalBiayaLawan = 0; // Inisiasi total biaya untuk pihak lawan
//   let selectedPerkara = ''; // Variabel untuk menyimpan jenis perkara

//   return new Promise((resolve, reject) => {
//     // Mulai logika pesan untuk biaya pihak pertama
//     if (keyword.length > 0 && (keyword[0] == "cek biaya" || keyword[0] == "cek panjar" || keyword[0] == "biaya perkara")) {
//       let responseMessage = `*_Assalamu’alaikum Warahmatullahi Wabarakatuh_*\n\nPerkenalkan saya Aleta, Bot AI ${pengadilan} yang akan memandu Bapak/Ibu untuk mendapatkan informasi biaya perkara secara _Real Time_.\nSilahkan isi nama Desa anda untuk pihak pertama.`;
//       resolve(responseMessage);
//     } else if (keyword[0] == "desa") {
//       if (keyword.length == 1) {
//         resolve("Perintah salah, silakan ketik nama desa setelah kata 'desa'.");
//         return;
//       }

//       const namaDesa = keyword.slice(1).join(' ');

//       // Query untuk cek kecocokan desa untuk pihak pertama
//       const queryDesa = `SELECT kel, kec, kabkota, prop_name, nilai FROM tb_kelurahan_komdanas WHERE kel LIKE '%${namaDesa}%'`;

//       db.query(queryDesa, (err, results) => {
//         if (err) {
//           reject(err);
//         } else {
//           if (results.length == 0) {
//             resolve(`Desa dengan nama ${namaDesa} tidak ditemukan.`);
//           } else {
//             const result = results[0]; // Ambil data pertama jika hanya ada satu kecocokan
//             totalBiayaAwal += result.nilai; // Tambah nilai untuk pihak pertama
//             resolve(`Biaya perkara untuk pihak pertama di desa ${result.kel}, kecamatan ${result.kec}, kabupaten ${result.kabkota}, provinsi ${result.prop_name} adalah Rp ${result.nilai}.\n\nSekarang, silakan ketik nama desa untuk pihak lawan.`);
//           }
//         }
//       });
//     } else if (keyword[0] == "lawan") {
//       if (keyword.length == 1) {
//         resolve("Perintah salah, silakan ketik nama desa pihak lawan setelah kata 'lawan'.");
//         return;
//       }

//       const namaDesaLawan = keyword.slice(1).join(' ');

//       // Query untuk cek kecocokan desa untuk pihak lawan
//       const queryDesaLawan = `SELECT kel, kec, kabkota, prop_name, nilai FROM tb_kelurahan_komdanas WHERE kel LIKE '%${namaDesaLawan}%'`;

//       db.query(queryDesaLawan, (err, results) => {
//         if (err) {
//           reject(err);
//         } else {
//           if (results.length == 0) {
//             resolve(`Desa dengan nama ${namaDesaLawan} tidak ditemukan.`);
//           } else {
//             const result = results[0]; // Ambil data pertama jika hanya ada satu kecocokan
//             totalBiayaLawan += result.nilai; // Tambah nilai untuk pihak lawan
//             resolve(`Biaya perkara untuk pihak lawan di desa ${result.kel}, kecamatan ${result.kec}, kabupaten ${result.kabkota}, provinsi ${result.prop_name} adalah Rp ${result.nilai}.\n\nSilahkan pilih jenis perkara yang sesuai dengan mengetikkan salah satu dari pilihan berikut:\n${tampilkanPilihanJenisPerkara()}`);
//           }
//         }
//       });
//     } else if (keyword[0] == "jenis") {
//       selectedPerkara = keyword.slice(1).join(' ');
//       const biayaMessage = hitungBiayaAkhir(selectedPerkara, totalBiayaAwal, totalBiayaLawan);
//       resolve(biayaMessage);
//     }
//   });
// };

// // Inisiasi variabel acuan per kalikan biaya berdasarkan jenis perkara
// const jenisPerkaraMultipliers = {
//   "Pembatalan Perkawinan": { biayaAwal: 2, biayaLawan: 3 },
//   "Izin Poligami": { biayaAwal: 2, biayaLawan: 3 },
//   "Kelalaian Atas Kewajiban Suami / Istri": { biayaAwal: 2, biayaLawan: 2 },
//   "Dispensasi Nikah 1 Pemohon": { biayaAwal: 2, biayaLawan: 3 },
//   "Dispensasi Nikah 2 Pemohon": { biayaAwal: 2, biayaLawan: 3 },
//   "Itsbat Nikah 1 Pemohon": { biayaAwal: 2, biayaLawan: 2 },
//   "Itsbat Nikah 2 Pemohon": { biayaAwal: 2, biayaLawan: 2 },
//   "Penguasaan Anak": { biayaAwal: 2, biayaLawan: 3 },
//   "Nafkah Anak Oleh Ibu karena Ayah tidak mampu": { biayaAwal: 3, biayaLawan: 3 },
//   "Hak - hak bekas istri/kewajiban bekas Suami": { biayaAwal: 3, biayaLawan: 3 },
//   "Pencabutan Kekuasaan Orang Tua": { biayaAwal: 3, biayaLawan: 3 },
//   "Pencabutan Kekuasaan Wali": { biayaAwal: 3, biayaLawan: 3 },
//   "Penunjukan orang lain sebagai Wali oleh Pengadilan": { biayaAwal: 3, biayaLawan: 3 },
//   "Ganti Rugi terhadap Wali": { biayaAwal: 3, biayaLawan: 3 },
//   "Perkawinan Campuran": { biayaAwal: 3, biayaLawan: 3 },
//   "Kewarisan": { biayaAwal: 3, biayaLawan: 3 },
//   "Hibah": { biayaAwal: 3, biayaLawan: 3 },
//   "Wakaf": { biayaAwal: 3, biayaLawan: 4 },
//   "Ekonomi Syariah": { biayaAwal: 3, biayaLawan: 3 },
//   "Harta Bersama": { biayaAwal: 3, biayaLawan: 4 },
//   "Pengesahan Anak": { biayaAwal: 3, biayaLawan: 3 },
//   "Asal Usul Anak": { biayaAwal: 3, biayaLawan: 3 },
//   "P3HP/Penetapan Ahli Waris": { biayaAwal: 2, biayaLawan: 2 },
//   "Dispensasi Kawin": { biayaAwal: 3, biayaLawan: 3 },
//   "Wali Adhol": { biayaAwal: 2, biayaLawan: 3 },
//   "Itsbat Nikah": { biayaAwal: 2, biayaLawan: 2 },
//   "Cerai Talak": { biayaAwal: 3, biayaLawan: 4 },
//   "Cerai Gugat": { biayaAwal: 2, biayaLawan: 3 }
// };

// // Fungsi untuk menampilkan pilihan jenis perkara
// const tampilkanPilihanJenisPerkara = () => {
//   return `
//   Silahkan pilih jenis perkara yang sesuai dengan mengetikkan salah satu dari pilihan berikut:
//   1. Cerai Gugat
//   2. Cerai Talak
//   3. Itsbat Nikah
//   4. Dispensasi Kawin
//   5. P3HP/Penetapan Ahli Waris
//   6. Pembatalan Perkawinan
//   7. Izin Poligami
//   8. Harta Bersama
//   9. Dispensasi Nikah 1 Pemohon
//   10. Dispensasi Nikah 2 Pemohon
//   11. Itsbat Nikah 1 Pemohon
//   12. Itsbat Nikah 2 Pemohon
//   13. Penguasaan Anak
//   14. Nafkah Anak Oleh Ibu karena Ayah tidak mampu
//   15. Hak - hak bekas istri/kewajiban bekas Suami
//   16. Pencabutan Kekuasaan Orang Tua
//   17. Pencabutan Kekuasaan Wali
//   18. Penunjukan orang lain sebagai Wali oleh Pengadilan
//   19. Ganti Rugi terhadap Wali
//   20. Perkawinan Campuran
//   21. Kewarisan
//   22. Hibah
//   23. Wakaf
//   24. Ekonomi Syariah
//   25. Kelalaian Atas Kewajiban Suami / Istri
//   26. Pengesahan Anak
//   27. Asal Usul Anak
//   28. Wali Adhol`;
//   };

// // Fungsi untuk mengalikan biaya berdasarkan jenis perkara
// const hitungBiayaAkhir = (jenisPerkara, totalBiayaAwal, totalBiayaLawan) => {
//   if (jenisPerkaraMultipliers[jenisPerkara]) {
//     const faktorAwal = jenisPerkaraMultipliers[jenisPerkara].biayaAwal;
//     const faktorLawan = jenisPerkaraMultipliers[jenisPerkara].biayaLawan;

//     const totalAkhirBiayaAwal = totalBiayaAwal * faktorAwal;
//     const totalAkhirBiayaLawan = totalBiayaLawan * faktorLawan;

//     const totalKeseluruhan = totalAkhirBiayaAwal + totalAkhirBiayaLawan;

//     return `Biaya perkara untuk jenis perkara ${jenisPerkara} dihitung sebagai berikut:
// - Biaya awal (pihak pertama): Rp ${totalAkhirBiayaAwal}
// - Biaya lawan (pihak kedua): Rp ${totalAkhirBiayaLawan}

// Total keseluruhan biaya: Rp ${totalKeseluruhan}`;
//   } else {
//     return "Jenis perkara tidak valid. Silahkan pilih ulang jenis perkara yang benar.";
//   }
// };

// function biaya masuk
const biayaMasuk = (query) => {
  return new Promise((resolve, reject) => {
    let detailBiaya;
    let detailJumlah;
    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        if (result.length != 0) {
          let biayaRaw = [];
          result.forEach((r) => {
            biayaRaw.push({
              uraian:`-${
                r.uraian
              },: Rp.${r.jumlah.toLocaleString()}`,
              jumlah: r.jumlah,
            });
          });
          let detailUraian = biayaRaw.map((obj) => obj.uraian).join("\n");
          detailJumlah = biayaRaw
            .map((obj) => obj.jumlah)
            .reduce((acc, current) => {
              return acc + current;
            });
          detailBiaya = `*Biaya Masuk* : \n ${detailUraian} \n*Total Biaya Masuk* : Rp.${detailJumlah.toLocaleString()}`;
        } else {
          detailBiaya = `Tidak ada data`;
          detailJumlah = "";
        }
        resolve({ detailBiaya, detailJumlah });
        // console.log(detailBiaya, detailJumlah);
      }
    });
  });
};

// function biaya keluar
const biayaKeluar = (query) => {
  return new Promise((resolve, reject) => {
    let detailBiaya;
    let detailJumlah;
    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        if (result.length != 0) {
          let biayaRaw = [];
          result.forEach((r) => {
            biayaRaw.push({
              uraian: `-${
                r.uraian
              } : Rp.${r.jumlah.toLocaleString()}`,
              jumlah: r.jumlah,
            });
          });
          let detailUraian = biayaRaw.map((obj) => obj.uraian).join("\n");
          detailJumlah = biayaRaw
            .map((obj) => obj.jumlah)
            .reduce((acc, current) => {
              return acc + current;
            });
          detailBiaya = `*Biaya Keluar* : \n ${detailUraian} \n*Total Biaya Keluar* : Rp.${detailJumlah.toLocaleString()}`;
        } else {
          detailBiaya = `Tidak ada data`;
          detailJumlah = "";
        }
        resolve({ detailBiaya, detailJumlah });
        // console.log(detailBiaya, detailJumlah);
      }
    });
  });
};

const breakPihak = (alurPerkara, jenisPerkara, pihakNama) => {
  let pihakSplit = pihakNama.split("<br />");
  let pihakPerkara;

  if (jenisPerkara === "Perceraian" || jenisPerkara === "Cerai Gugat" || jenisPerkara === "Cerai Talak" || jenisPerkara === "Dispensasi Kawin" || jenisPerkara === "Hak Asuh Anak" || jenisPerkara === "Asal Usul Anak" || alurPerkara === 118 || alurPerkara === 125) {
    pihakPerkara = "Disamarkan";
  } else {
    if (pihakSplit.length > 1) {
      pihakPerkara = `${pihakSplit[0].substring(2)}, dkk`;
    } else {
      pihakPerkara = pihakSplit[0];
    }
  }

  return pihakPerkara;
};

const getJadwalSidangPerdataBesok = () => {
  return new Promise((resolve, reject) => {
    let query = `SELECT nomor_perkara, pihak1_text, pihak2_text, agenda, jenis_perkara_nama, alur_perkara_id FROM perkara LEFT JOIN perkara_jadwal_sidang ON perkara.perkara_id=perkara_jadwal_sidang.perkara_id WHERE tanggal_sidang = CURDATE() AND (alur_perkara_id = 1 OR alur_perkara_id = 2 OR alur_perkara_id = 8 OR alur_perkara_id=15 OR alur_perkara_id =16 OR alur_perkara_id=17)`; // Menghapus kondisi tanggal
    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          let no = 1;
          result.forEach((r) => {
            if (r.pihak2_text === "" || r.pihak2_text === null) {
              resultArray.push(
                `${no++}. No Perkara : ${r.nomor_perkara}\nagenda : ${
                  r.agenda
                }\nPemohon : ${breakPihak(
                  r.alur_perkara_id,
                  r.jenis_perkara_nama,
                  r.pihak1_text
                )}`
              );
            } else {
              resultArray.push(
                `${no++}. No Perkara : ${r.nomor_perkara}\nagenda : ${
                  r.agenda
                }\nPenggugat : ${breakPihak(
                  r.alur_perkara_id,
                  r.jenis_perkara_nama,
                  r.pihak1_text
                )}\nTergugat : ${breakPihak(
                  r.alur_perkara_id,
                  r.jenis_perkara_nama,
                  r.pihak2_text
                )}`
              );
            }
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getJadwalSidangPerdata = (tanggal = null) => {
  return new Promise((resolve, reject) => {
    let query;
    if (tanggal == null) {
      query = `SELECT nomor_perkara, pihak1_text, pihak2_text, agenda, jenis_perkara_nama, alur_perkara_id FROM perkara LEFT JOIN perkara_jadwal_sidang ON perkara.perkara_id=perkara_jadwal_sidang.perkara_id WHERE tanggal_sidang = CURDATE() AND (alur_perkara_id = 1 OR alur_perkara_id = 2 OR alur_perkara_id = 8 OR alur_perkara_id=15 OR alur_perkara_id =16 OR alur_perkara_id=17)`;
    } else {
      let splitTanggal = tanggal.split("-");
      let tanggalReformat = `${splitTanggal[2]}-${splitTanggal[1]}-${splitTanggal[0]}`;

      query = `SELECT nomor_perkara, pihak1_text, pihak2_text, agenda, jenis_perkara_nama, alur_perkara_id FROM perkara LEFT JOIN perkara_jadwal_sidang ON perkara.perkara_id=perkara_jadwal_sidang.perkara_id WHERE tanggal_sidang = '${tanggalReformat}' AND (alur_perkara_id = 1 OR alur_perkara_id = 2 OR alur_perkara_id = 8 OR alur_perkara_id=15 OR alur_perkara_id =16 OR alur_perkara_id=17)`;
    }

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          let no = 1;
          result.forEach((r) => {
            if (r.pihak2_text === "" || r.pihak2_text === null) {
              resultArray.push(
                `${no++}. No Perkara : ${r.nomor_perkara}\nagenda : ${
                  r.agenda
                }\nPemohon : ${breakPihak(
                  r.alur_perkara_id,
                  r.jenis_perkara_nama,
                  r.pihak1_text
                )}`
              );
            } else {
              resultArray.push(
                `${no++}. No Perkara : ${r.nomor_perkara}\nagenda : ${
                  r.agenda
                }\nPenggugat : ${breakPihak(
                  r.alur_perkara_id,
                  r.jenis_perkara_nama,
                  r.pihak1_text
                )}\nTergugat : ${breakPihak(
                  r.alur_perkara_id,
                  r.jenis_perkara_nama,
                  r.pihak2_text
                )}`
              );
            }
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataJadwalMediasi = (tanggal = null) => {
  return new Promise((resolve, reject) => {
    let query;
    if (tanggal === null) {
      query = `SELECT nomor_perkara, nama_mediator, panitera_nama FROM perkara LEFT JOIN perkara_mediasi ON perkara.perkara_id=perkara_mediasi.perkara_id  LEFT JOIN perkara_mediator ON perkara.perkara_id=perkara_mediator.perkara_id LEFT JOIN perkara_jadwal_mediasi ON perkara_mediasi.mediasi_id=perkara_jadwal_mediasi.mediasi_id LEFT JOIN perkara_panitera_pn ON perkara.perkara_id=perkara_panitera_pn.perkara_id WHERE tanggal_mediasi = CURDATE() AND perkara_panitera_pn.aktif = 'Y' ORDER BY perkara.perkara_id DESC`;
    } else {
      let splitTanggal = tanggal.split("-");
      let tanggalReformat = `${splitTanggal[2]}-${splitTanggal[1]}-${splitTanggal[0]}`;
      
      query = `SELECT nomor_perkara, nama_mediator, panitera_nama FROM perkara LEFT JOIN perkara_mediasi ON perkara.perkara_id=perkara_mediasi.perkara_id  LEFT JOIN perkara_mediator ON perkara.perkara_id=perkara_mediator.perkara_id LEFT JOIN perkara_jadwal_mediasi ON perkara_mediasi.mediasi_id=perkara_jadwal_mediasi.mediasi_id LEFT JOIN perkara_panitera_pn ON perkara.perkara_id=perkara_panitera_pn.perkara_id WHERE tanggal_mediasi = '${tanggalReformat}' AND perkara_panitera_pn.aktif = 'Y' ORDER BY perkara.perkara_id DESC`;
    }

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          let no = 1;
          result.forEach((r) => {
            resultArray.push(
              `${no++}. No Perkara : ${r.nomor_perkara}\nNama Mediator : ${r.nama_mediator}\nPP : ${r.panitera_nama}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};


const getJadwalSidangPidana = (tanggal = null) => {
  return new Promise((resolve, reject) => {
    let query;
    if (tanggal == null) {
      query = `SELECT nomor_perkara, pihak1_text, pihak2_text, agenda, jenis_perkara_nama, alur_perkara_id FROM perkara LEFT JOIN perkara_jadwal_sidang ON perkara.perkara_id=perkara_jadwal_sidang.perkara_id WHERE tanggal_sidang = CURDATE() AND (alur_perkara_id = 111 OR alur_perkara_id = 112 OR alur_perkara_id = 122 OR alur_perkara_id = 123 OR alur_perkara_id = 125)`;
    } else {
      let splitTanggal = tanggal.split("-");
      let tanggalReformat = `${splitTanggal[2]}-${splitTanggal[1]}-${splitTanggal[0]}`;

      query = `SELECT nomor_perkara, pihak1_text, pihak2_text, agenda, jenis_perkara_nama, alur_perkara_id FROM perkara LEFT JOIN perkara_jadwal_sidang ON perkara.perkara_id=perkara_jadwal_sidang.perkara_id WHERE tanggal_sidang = '${tanggalReformat}' AND (alur_perkara_id = 111 OR alur_perkara_id = 112 OR alur_perkara_id = 118 OR alur_perkara_id = 122 OR alur_perkara_id = 123 OR alur_perkara_id = 125)`;
    }
    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r) => {
            resultArray.push(
              `No Perkara : ${r.nomor_perkara}\nagenda : ${
                r.agenda
              }, PU : ${breakPihak(
                r.alur_perkara_id,
                r.jenis_perkara_nama,
                r.pihak1_text
              )}\nTerdakwa : ${breakPihak(
                r.alur_perkara_id,
                r.jenis_perkara_nama,
                r.pihak2_text
              )}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getJadwalSidangPidanaMonev = (tanggal = null) => {
  return new Promise((resolve, reject) => {
    let query;
    if (tanggal == null) {
    query = `SELECT nomor_perkara, CASE WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)' ELSE '' END AS ecourt, agenda, panitera_nama FROM perkara LEFT JOIN perkara_jadwal_sidang ON perkara.perkara_id=perkara_jadwal_sidang.perkara_id LEFT JOIN perkara_panitera_pn ON perkara.perkara_id=perkara_panitera_pn.perkara_id LEFT JOIN perkara_efiling_id AS k ON perkara.perkara_id = k.perkara_id WHERE tanggal_sidang = CURDATE() AND (alur_perkara_id = 111 OR alur_perkara_id = 112 OR alur_perkara_id = 122 OR alur_perkara_id = 123 OR alur_perkara_id = 125) AND perkara_panitera_pn.aktif = 'Y' ORDER BY perkara.perkara_id DESC`;
    } else {
      let splitTanggal = tanggal.split("-");
      let tanggalReformat = `${splitTanggal[2]}-${splitTanggal[1]}-${splitTanggal[0]}`;
    
      query = `SELECT nomor_perkara, CASE WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)' ELSE '' END AS ecourt, agenda, panitera_nama FROM perkara LEFT JOIN perkara_jadwal_sidang ON perkara.perkara_id=perkara_jadwal_sidang.perkara_id LEFT JOIN perkara_panitera_pn ON perkara.perkara_id=perkara_panitera_pn.perkara_id LEFT JOIN perkara_efiling_id AS k ON perkara.perkara_id = k.perkara_id WHERE tanggal_sidang = '${tanggalReformat}' AND (alur_perkara_id = 111 OR alur_perkara_id = 112 OR alur_perkara_id = 122 OR alur_perkara_id = 123 OR alur_perkara_id = 125) AND perkara_panitera_pn.aktif = 'Y' ORDER BY perkara.perkara_id DESC`;
    }
    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}${r.ecourt}\nAgenda : ${r.agenda}\nPP : ${r.panitera_nama}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getJadwalSidangPerdataMonev = (tanggal = null) => {
  return new Promise((resolve, reject) => {
    let query;
    if (tanggal == null) {
    query = `SELECT DISTINCT
    a.perkara_id,
		b.tanggal_sidang,
    a.nomor_perkara,
    b.agenda,
    c.panitera_nama,
    a.tanggal_pendaftaran,
    a.jenis_perkara_nama,
    REPLACE(a.para_pihak, '<br />', '\n') AS para_pihak,
    a.tahapan_terakhir_id,
    a.tahapan_terakhir_text,
    a.proses_terakhir_id,
    a.proses_terakhir_text,
    n.majelis_hakim_kode,
    n.majelis_hakim_text,
    m.jurusita_nama,
    CASE
        WHEN f.jabatan_hakim_nama = 'Hakim Tunggal' THEN 'T'
        ELSE 'KM'
    END AS jabatan_hakim,
    CASE
        WHEN a.proses_terakhir_id < 210 THEN
            DATEDIFF(CURDATE(), a.tanggal_pendaftaran) - IFNULL(
                (SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0
            )
        ELSE
            DATEDIFF(d.tanggal_putusan, a.tanggal_pendaftaran) - IFNULL(
                (SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0
            )
    END + 1 AS durasi,
    CASE
        WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
        ELSE ''
    END AS ghaib,
    CASE
        WHEN a.prodeo = 1 THEN ' (_Prodeo_)'
        ELSE ''
    END AS prodeo,
    CASE
        WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
        ELSE ''
    END AS ecourt
  FROM 
      perkara AS a
  LEFT JOIN 
      (SELECT perkara_id, MAX(tanggal_sidang) AS tanggal_sidang_terakhir FROM perkara_jadwal_sidang GROUP BY perkara_id) AS subq 
      ON a.perkara_id = subq.perkara_id
  LEFT JOIN 
      perkara_jadwal_sidang AS b 
      ON a.perkara_id = b.perkara_id AND b.tanggal_sidang = subq.tanggal_sidang_terakhir
  LEFT JOIN 
      perkara_panitera_pn AS c 
      ON a.perkara_id = c.perkara_id
  LEFT JOIN 
      perkara_putusan AS d 
      ON a.perkara_id = d.perkara_id
  LEFT JOIN 
      perkara_hakim_pn AS f 
      ON a.perkara_id = f.perkara_id
  LEFT JOIN 
      perkara_pelaksanaan_relaas AS g 
      ON a.perkara_id = g.perkara_id
  LEFT JOIN 
      (SELECT perkara_id FROM perkara_efiling_id) AS h 
      ON a.perkara_id = h.perkara_id
  LEFT JOIN 
      (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i 
      ON a.perkara_id = i.perkara_id
  LEFT JOIN 
      perkara_pihak2 AS j 
      ON a.perkara_id = j.perkara_id
  LEFT JOIN 
      perkara_efiling_id AS k 
      ON a.perkara_id = k.perkara_id
  LEFT JOIN 
      perkara_pengacara AS l 
      ON a.perkara_id = l.perkara_id
  LEFT JOIN 
      perkara_jurusita AS m 
      ON a.perkara_id = m.perkara_id
  LEFT JOIN 
      perkara_penetapan AS n 
      ON a.perkara_id = n.perkara_id
  LEFT JOIN 
      perkara_ikrar_talak AS o
      ON a.perkara_id = o.perkara_id
  LEFT JOIN 
      v_pihak_perkara AS x 
      ON a.perkara_id = x.perkara_id
  LEFT JOIN 
      pihak AS w 
      ON x.pihak_id = w.id
  LEFT JOIN (
      SELECT
          a.pihak_id,
          MAX(CASE WHEN a.pihak_ke = 1 THEN CONCAT('+62', SUBSTRING(b.telepon, 2)) ELSE NULL END) AS teleponPenggugat,
          MAX(CASE WHEN a.pihak_ke = 2 THEN CONCAT('+62', SUBSTRING(b.telepon, 2)) ELSE NULL END) AS teleponTergugat
      FROM v_pihak_perkara AS a
      JOIN pihak AS b ON a.pihak_id = b.id 
                      AND b.telepon REGEXP '^[0-9]' 
                      AND CHAR_LENGTH(b.telepon) > 8
      GROUP BY a.pihak_id
  ) AS telepons ON x.pihak_id = telepons.pihak_id
  LEFT JOIN (
      SELECT
          perk.perkara_id,
          CASE
              WHEN datarelaas.tanggal_relaas IS NULL OR datarelaas.tanggal_relaas = '' THEN
              CASE
                  WHEN perkarapihak.pihakke = 1 THEN '(Belum Dipanggil P)'
                  WHEN perkarapihak.pihakke = 2 THEN '(Belum Dipanggil T)'
                  WHEN perkarapihak.pihakke IN (1,2) THEN '(Belum Dipanggil PT)'
                  WHEN perkarapihak.pihakke IN (1,2,4) THEN '(Belum Dipanggil PT & Turut T)'
                  WHEN perkarapihak.pihakke = 4 THEN '(Belum Dipanggil Turut Tergugat)'
                  ELSE '(Sudah Dipanggil dan Diupload)'
              END
          WHEN datarelaas.doc_relaas IS NULL OR datarelaas.doc_relaas = '' THEN
              CASE
                  WHEN perkarapihak.pihakke = 1 THEN '(Belum Diupload P)'
                  WHEN perkarapihak.pihakke = 2 THEN '(Belum Diupload T)'
                  WHEN perkarapihak.pihakke IN (1,2) THEN '(Belum Diupload PT)'
                  WHEN perkarapihak.pihakke IN (1,2,4) THEN '(Belum Diupload PT & Turut T)'
                  WHEN perkarapihak.pihakke = 4 THEN '(Belum Diupload Turut Tergugat)'
                  ELSE '(Sudah Dipanggil dan Diupload)'
              END
          ELSE '(Sudah Dipanggil dan Diupload)'
          END AS panggilan_status
      FROM
          perkara AS perk
          JOIN perkara_jadwal_sidang AS sidang ON sidang.perkara_id = perk.perkara_id
          JOIN (
              SELECT
                  p1.perkara_id,
                  p1.pihak_id,
                  p1.nama,
                  1 AS pihakke,
                  'pihak p' AS ketpihak,
                  '' AS pengacara_pihak_id
              FROM
                  perkara_pihak1 AS p1
                  JOIN perkara ON perkara.perkara_id = p1.perkara_id
              WHERE
                  alur_perkara_id < 111
              UNION
              SELECT
                  p2.perkara_id,
                  p2.pihak_id,
                  p2.nama,
                  2 AS pihakke,
                  'pihak t' AS ketpihak,
                  '' AS pengacara_pihak_id
              FROM
                  perkara_pihak2 AS p2
                  JOIN perkara ON perkara.perkara_id = p2.perkara_id
              WHERE
                  alur_perkara_id < 111
                  AND (
                      status_penahanan_id IS NULL
                      OR status_penahanan_id = 0
                  )
                  AND (
                      jenis_tahanan_id = 0
                      OR jenis_tahanan_id IS NULL
                  )
              UNION
              SELECT
                  p3.perkara_id,
                  p3.pihak_id,
                  p3.nama,
                  3 AS pihakke,
                  'intervensi' AS ketpihak,
                  '' AS pengacara_pihak_id
              FROM
                  perkara_pihak3 AS p3
              UNION
              SELECT
                  p4.perkara_id,
                  p4.pihak_id,
                  p4.nama,
                  4 AS pihakke,
                  'turut' AS ketpihak,
                  '' AS pengacara_pihak_id
              FROM
                  perkara_pihak4 AS p4
              UNION
              SELECT
                  p5.perkara_id,
                  p5.pengacara_id,
                  p5.nama,
                  p5.pihak_ke AS pihakke,
                  'pengacara' AS ketpihak,
                  p5.pihak_id AS pengacara_pihak_id
              FROM
                  perkara_pengacara AS p5
          ) AS perkarapihak 
          ON perkarapihak.perkara_id = perk.perkara_id
          LEFT JOIN perkara_pelaksanaan_relaas AS datarelaas 
          ON datarelaas.pihak_id = perkarapihak.pihak_id
          AND datarelaas.perkara_id = perk.perkara_id
          AND datarelaas.sidang_id = sidang.id
          LEFT JOIN (
              SELECT
                  perkara.perkara_id AS perkara_id,
                  perkara_jadwal_sidang.urutan AS urutan,
                  perkara_jadwal_sidang.dihadiri_oleh
              FROM
                  perkara
                  JOIN perkara_jadwal_sidang ON (
                      perkara_jadwal_sidang.perkara_id = perkara.perkara_id
                  )
          ) AS jadwalsidang 
          ON (
              jadwalsidang.perkara_id = perk.perkara_id
              AND jadwalsidang.urutan = sidang.urutan - 1
          )
          LEFT JOIN perkara_penetapan_hari_sidang AS phs 
          ON (
              phs.perkara_id = perk.perkara_id
              AND phs.jadwalsidang_id = sidang.id
          )
          JOIN alur_perkara AS alur 
          ON alur.id = perk.alur_perkara_id
      WHERE
          YEAR(perk.tanggal_pendaftaran) = YEAR(CURDATE())
          AND perk.alur_perkara_id < 111
          AND perkarapihak.pihak_id NOT IN (
              SELECT
                  pp.pihak_id
              FROM
                  perkara_pelaksanaan_relaas
                  JOIN perkara_pengacara AS pp 
                  ON pp.pengacara_id = perkara_pelaksanaan_relaas.pihak_id
                  AND pp.perkara_id = perkara_pelaksanaan_relaas.perkara_id
                  JOIN perkara ON pp.perkara_id = perkara.perkara_id
              WHERE
                  perk.alur_perkara_id < 111
                  AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
                  AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
                  AND (
                      perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL
                      OR perkara_pelaksanaan_relaas.tanggal_relaas <> ''
                  )
                  AND (
                      perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL
                      OR perkara_pelaksanaan_relaas.doc_relaas <> ''
                  )
              UNION
              SELECT
                  ppb.pengacara_id
              FROM
                  perkara_pelaksanaan_relaas
                  JOIN perkara_pengacara AS ppb 
                  ON ppb.pihak_id = perkara_pelaksanaan_relaas.pihak_id
                  AND ppb.perkara_id = perkara_pelaksanaan_relaas.perkara_id
                  JOIN perkara ON ppb.perkara_id = perkara.perkara_id
              WHERE
                  perk.alur_perkara_id < 111
                  AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
                  AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
                  AND (
                      perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL
                      OR perkara_pelaksanaan_relaas.tanggal_relaas <> ''
                  )
                  AND (
                      perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL
                      OR perkara_pelaksanaan_relaas.doc_relaas <> ''
                  )
          )
          AND (
              (
                  datarelaas.tanggal_relaas IS NULL
                  OR datarelaas.tanggal_relaas = ''
              )
              OR (
                  datarelaas.doc_relaas IS NULL
                  OR datarelaas.doc_relaas = ''
              )
          )
          AND(
              perk.alur_perkara_id >= 1
              AND perk.alur_perkara_id <= 17
          )
          AND (
              (jadwalsidang.dihadiri_oleh <> 1)
              AND (
                  jadwalsidang.dihadiri_oleh = 2
                  AND (
                      perkarapihak.pihakke = 2
                      OR perkarapihak.pihakke = 4
                  )
              )
              OR (
                  jadwalsidang.dihadiri_oleh = 3
                  AND perkarapihak.pihakke = 1
              )
              OR (
                  jadwalsidang.dihadiri_oleh = 4
                  OR jadwalsidang.dihadiri_oleh IS NULL
              )
          )
  ) AS doc_relaas_status 
  ON a.perkara_id = doc_relaas_status.perkara_id
  WHERE 
      b.tanggal_sidang = CURDATE()
      AND a.alur_perkara_id IN (15, 16, 17)
      AND c.aktif = 'Y'
      AND f.aktif = 'Y'
      AND m.aktif = 'Y'
      AND (
          CASE 
              WHEN a.jenis_perkara_id = 346 AND d.status_putusan_id = 62 AND o.amar_ikrar_talak IS NULL THEN a.proses_terakhir_id < 296
              ELSE a.proses_terakhir_id < 218 
          END
      )
  ORDER BY 
      a.alur_perkara_id,
      n.majelis_hakim_kode,
      a.jenis_perkara_id DESC,
      b.urutan DESC,
      c.panitera_nama,
      a.nomor_perkara, 
      ecourt, 
      ghaib, 
      prodeo DESC;`;
  } else {
    let splitTanggal = tanggal.split("-");
    let tanggalReformat = `${splitTanggal[2]}-${splitTanggal[1]}-${splitTanggal[0]}`;

    query = `SELECT DISTINCT
    a.perkara_id,
		b.tanggal_sidang,
    a.nomor_perkara,
    b.agenda,
    c.panitera_nama,
    a.tanggal_pendaftaran,
    a.jenis_perkara_nama,
    REPLACE(a.para_pihak, '<br />', '\n') AS para_pihak,
    a.tahapan_terakhir_id,
    a.tahapan_terakhir_text,
    a.proses_terakhir_id,
    a.proses_terakhir_text,
    n.majelis_hakim_kode,
    n.majelis_hakim_text,
    m.jurusita_nama,
    CASE
        WHEN f.jabatan_hakim_nama = 'Hakim Tunggal' THEN 'T'
        ELSE 'KM'
    END AS jabatan_hakim,
    CASE
        WHEN a.proses_terakhir_id < 210 THEN
            DATEDIFF(CURDATE(), a.tanggal_pendaftaran) - IFNULL(
                (SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0
            )
        ELSE
            DATEDIFF(d.tanggal_putusan, a.tanggal_pendaftaran) - IFNULL(
                (SELECT durasi_mediasi FROM v_durasi_mediasi e WHERE e.perkara_id = a.perkara_id), 0
            )
    END + 1 AS durasi,
    CASE
        WHEN i.perkara_id IS NOT NULL THEN ' (_Ghaib_)'
        ELSE ''
    END AS ghaib,
    CASE
        WHEN a.prodeo = 1 THEN ' (_Prodeo_)'
        ELSE ''
    END AS prodeo,
    CASE
        WHEN k.perkara_id IS NOT NULL THEN ' (*E-Court*)'
        ELSE ''
    END AS ecourt
  FROM 
      perkara AS a
  LEFT JOIN 
      (SELECT perkara_id, MAX(tanggal_sidang) AS tanggal_sidang_terakhir FROM perkara_jadwal_sidang GROUP BY perkara_id) AS subq 
      ON a.perkara_id = subq.perkara_id
  LEFT JOIN 
      perkara_jadwal_sidang AS b 
      ON a.perkara_id = b.perkara_id AND b.tanggal_sidang = subq.tanggal_sidang_terakhir
  LEFT JOIN 
      perkara_panitera_pn AS c 
      ON a.perkara_id = c.perkara_id
  LEFT JOIN 
      perkara_putusan AS d 
      ON a.perkara_id = d.perkara_id
  LEFT JOIN 
      perkara_hakim_pn AS f 
      ON a.perkara_id = f.perkara_id
  LEFT JOIN 
      perkara_pelaksanaan_relaas AS g 
      ON a.perkara_id = g.perkara_id
  LEFT JOIN 
      (SELECT perkara_id FROM perkara_efiling_id) AS h 
      ON a.perkara_id = h.perkara_id
  LEFT JOIN 
      (SELECT perkara_id FROM perkara_pihak2 WHERE ghaib = 1) AS i 
      ON a.perkara_id = i.perkara_id
  LEFT JOIN 
      perkara_pihak2 AS j 
      ON a.perkara_id = j.perkara_id
  LEFT JOIN 
      perkara_efiling_id AS k 
      ON a.perkara_id = k.perkara_id
  LEFT JOIN 
      perkara_pengacara AS l 
      ON a.perkara_id = l.perkara_id
  LEFT JOIN 
      perkara_jurusita AS m 
      ON a.perkara_id = m.perkara_id
  LEFT JOIN 
      perkara_penetapan AS n 
      ON a.perkara_id = n.perkara_id
  LEFT JOIN 
      perkara_ikrar_talak AS o
      ON a.perkara_id = o.perkara_id
  LEFT JOIN 
      v_pihak_perkara AS x 
      ON a.perkara_id = x.perkara_id
  LEFT JOIN 
      pihak AS w 
      ON x.pihak_id = w.id
  LEFT JOIN (
      SELECT
          a.pihak_id,
          MAX(CASE WHEN a.pihak_ke = 1 THEN CONCAT('+62', SUBSTRING(b.telepon, 2)) ELSE NULL END) AS teleponPenggugat,
          MAX(CASE WHEN a.pihak_ke = 2 THEN CONCAT('+62', SUBSTRING(b.telepon, 2)) ELSE NULL END) AS teleponTergugat
      FROM v_pihak_perkara AS a
      JOIN pihak AS b ON a.pihak_id = b.id 
                      AND b.telepon REGEXP '^[0-9]' 
                      AND CHAR_LENGTH(b.telepon) > 8
      GROUP BY a.pihak_id
  ) AS telepons ON x.pihak_id = telepons.pihak_id
  LEFT JOIN (
      SELECT
          perk.perkara_id,
          CASE
              WHEN datarelaas.tanggal_relaas IS NULL OR datarelaas.tanggal_relaas = '' THEN
              CASE
                  WHEN perkarapihak.pihakke = 1 THEN '(Belum Dipanggil P)'
                  WHEN perkarapihak.pihakke = 2 THEN '(Belum Dipanggil T)'
                  WHEN perkarapihak.pihakke IN (1,2) THEN '(Belum Dipanggil PT)'
                  WHEN perkarapihak.pihakke IN (1,2,4) THEN '(Belum Dipanggil PT & Turut T)'
                  WHEN perkarapihak.pihakke = 4 THEN '(Belum Dipanggil Turut Tergugat)'
                  ELSE '(Sudah Dipanggil dan Diupload)'
              END
          WHEN datarelaas.doc_relaas IS NULL OR datarelaas.doc_relaas = '' THEN
              CASE
                  WHEN perkarapihak.pihakke = 1 THEN '(Belum Diupload P)'
                  WHEN perkarapihak.pihakke = 2 THEN '(Belum Diupload T)'
                  WHEN perkarapihak.pihakke IN (1,2) THEN '(Belum Diupload PT)'
                  WHEN perkarapihak.pihakke IN (1,2,4) THEN '(Belum Diupload PT & Turut T)'
                  WHEN perkarapihak.pihakke = 4 THEN '(Belum Diupload Turut Tergugat)'
                  ELSE '(Sudah Dipanggil dan Diupload)'
              END
          ELSE '(Sudah Dipanggil dan Diupload)'
          END AS panggilan_status
      FROM
          perkara AS perk
          JOIN perkara_jadwal_sidang AS sidang ON sidang.perkara_id = perk.perkara_id
          JOIN (
              SELECT
                  p1.perkara_id,
                  p1.pihak_id,
                  p1.nama,
                  1 AS pihakke,
                  'pihak p' AS ketpihak,
                  '' AS pengacara_pihak_id
              FROM
                  perkara_pihak1 AS p1
                  JOIN perkara ON perkara.perkara_id = p1.perkara_id
              WHERE
                  alur_perkara_id < 111
              UNION
              SELECT
                  p2.perkara_id,
                  p2.pihak_id,
                  p2.nama,
                  2 AS pihakke,
                  'pihak t' AS ketpihak,
                  '' AS pengacara_pihak_id
              FROM
                  perkara_pihak2 AS p2
                  JOIN perkara ON perkara.perkara_id = p2.perkara_id
              WHERE
                  alur_perkara_id < 111
                  AND (
                      status_penahanan_id IS NULL
                      OR status_penahanan_id = 0
                  )
                  AND (
                      jenis_tahanan_id = 0
                      OR jenis_tahanan_id IS NULL
                  )
              UNION
              SELECT
                  p3.perkara_id,
                  p3.pihak_id,
                  p3.nama,
                  3 AS pihakke,
                  'intervensi' AS ketpihak,
                  '' AS pengacara_pihak_id
              FROM
                  perkara_pihak3 AS p3
              UNION
              SELECT
                  p4.perkara_id,
                  p4.pihak_id,
                  p4.nama,
                  4 AS pihakke,
                  'turut' AS ketpihak,
                  '' AS pengacara_pihak_id
              FROM
                  perkara_pihak4 AS p4
              UNION
              SELECT
                  p5.perkara_id,
                  p5.pengacara_id,
                  p5.nama,
                  p5.pihak_ke AS pihakke,
                  'pengacara' AS ketpihak,
                  p5.pihak_id AS pengacara_pihak_id
              FROM
                  perkara_pengacara AS p5
          ) AS perkarapihak 
          ON perkarapihak.perkara_id = perk.perkara_id
          LEFT JOIN perkara_pelaksanaan_relaas AS datarelaas 
          ON datarelaas.pihak_id = perkarapihak.pihak_id
          AND datarelaas.perkara_id = perk.perkara_id
          AND datarelaas.sidang_id = sidang.id
          LEFT JOIN (
              SELECT
                  perkara.perkara_id AS perkara_id,
                  perkara_jadwal_sidang.urutan AS urutan,
                  perkara_jadwal_sidang.dihadiri_oleh
              FROM
                  perkara
                  JOIN perkara_jadwal_sidang ON (
                      perkara_jadwal_sidang.perkara_id = perkara.perkara_id
                  )
          ) AS jadwalsidang 
          ON (
              jadwalsidang.perkara_id = perk.perkara_id
              AND jadwalsidang.urutan = sidang.urutan - 1
          )
          LEFT JOIN perkara_penetapan_hari_sidang AS phs 
          ON (
              phs.perkara_id = perk.perkara_id
              AND phs.jadwalsidang_id = sidang.id
          )
          JOIN alur_perkara AS alur 
          ON alur.id = perk.alur_perkara_id
      WHERE
          YEAR(perk.tanggal_pendaftaran) = YEAR(CURDATE())
          AND perk.alur_perkara_id < 111
          AND perkarapihak.pihak_id NOT IN (
              SELECT
                  pp.pihak_id
              FROM
                  perkara_pelaksanaan_relaas
                  JOIN perkara_pengacara AS pp 
                  ON pp.pengacara_id = perkara_pelaksanaan_relaas.pihak_id
                  AND pp.perkara_id = perkara_pelaksanaan_relaas.perkara_id
                  JOIN perkara ON pp.perkara_id = perkara.perkara_id
              WHERE
                  perk.alur_perkara_id < 111
                  AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
                  AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
                  AND (
                      perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL
                      OR perkara_pelaksanaan_relaas.tanggal_relaas <> ''
                  )
                  AND (
                      perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL
                      OR perkara_pelaksanaan_relaas.doc_relaas <> ''
                  )
              UNION
              SELECT
                  ppb.pengacara_id
              FROM
                  perkara_pelaksanaan_relaas
                  JOIN perkara_pengacara AS ppb 
                  ON ppb.pihak_id = perkara_pelaksanaan_relaas.pihak_id
                  AND ppb.perkara_id = perkara_pelaksanaan_relaas.perkara_id
                  JOIN perkara ON ppb.perkara_id = perkara.perkara_id
              WHERE
                  perk.alur_perkara_id < 111
                  AND perkara_pelaksanaan_relaas.perkara_id = perk.perkara_id
                  AND perkara_pelaksanaan_relaas.sidang_id = sidang.id
                  AND (
                      perkara_pelaksanaan_relaas.tanggal_relaas IS NOT NULL
                      OR perkara_pelaksanaan_relaas.tanggal_relaas <> ''
                  )
                  AND (
                      perkara_pelaksanaan_relaas.doc_relaas IS NOT NULL
                      OR perkara_pelaksanaan_relaas.doc_relaas <> ''
                  )
          )
          AND (
              (
                  datarelaas.tanggal_relaas IS NULL
                  OR datarelaas.tanggal_relaas = ''
              )
              OR (
                  datarelaas.doc_relaas IS NULL
                  OR datarelaas.doc_relaas = ''
              )
          )
          AND(
              perk.alur_perkara_id >= 1
              AND perk.alur_perkara_id <= 17
          )
          AND (
              (jadwalsidang.dihadiri_oleh <> 1)
              AND (
                  jadwalsidang.dihadiri_oleh = 2
                  AND (
                      perkarapihak.pihakke = 2
                      OR perkarapihak.pihakke = 4
                  )
              )
              OR (
                  jadwalsidang.dihadiri_oleh = 3
                  AND perkarapihak.pihakke = 1
              )
              OR (
                  jadwalsidang.dihadiri_oleh = 4
                  OR jadwalsidang.dihadiri_oleh IS NULL
              )
          )
  ) AS doc_relaas_status 
  ON a.perkara_id = doc_relaas_status.perkara_id
  WHERE 
      b.tanggal_sidang = '${tanggalReformat}'
      AND a.alur_perkara_id IN (15, 16, 17)
      AND c.aktif = 'Y'
      AND f.aktif = 'Y'
      AND m.aktif = 'Y'
      AND (
          CASE 
              WHEN a.jenis_perkara_id = 346 AND d.status_putusan_id = 62 AND o.amar_ikrar_talak IS NULL THEN a.proses_terakhir_id < 296
              ELSE a.proses_terakhir_id < 218 
          END
      )
  ORDER BY
      CASE
        WHEN b.alasan_ditunda LIKE '%putusan%' OR b.alasan_ditunda LIKE '%penetapan%' OR b.alasan_ditunda LIKE '%musyawarah%' THEN 1
        ELSE 2
      END,
      a.alur_perkara_id,
      n.majelis_hakim_kode,
      a.jenis_perkara_id DESC,
      b.urutan DESC,
      c.panitera_nama,
      a.nomor_perkara, 
      ecourt, 
      ghaib, 
      prodeo DESC;`;
  }

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `*${index + 1}. ${r.nomor_perkara}* ${r.ecourt}${r.ghaib}${r.prodeo} (${r.durasi} Hari)\nMajelis Hakim : *${r.majelis_hakim_kode}*\nAgenda : ${r.agenda}\nPP : ${r.panitera_nama}\nJS : ${r.jurusita_nama}\n*PARA PIHAK :*\n${r.para_pihak}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataJadwalMediasiMonev = (tanggal = null) => {
  return new Promise((resolve, reject) => {
    let query;
    if (tanggal == null) {
      query = `SELECT nomor_perkara, nama_mediator, panitera_nama FROM perkara LEFT JOIN perkara_mediasi ON perkara.perkara_id=perkara_mediasi.perkara_id  LEFT JOIN perkara_mediator ON perkara.perkara_id=perkara_mediator.perkara_id LEFT JOIN perkara_jadwal_mediasi ON perkara_mediasi.mediasi_id=perkara_jadwal_mediasi.mediasi_id LEFT JOIN perkara_panitera_pn ON perkara.perkara_id=perkara_panitera_pn.perkara_id WHERE tanggal_mediasi = CURDATE() AND perkara_panitera_pn.aktif = 'Y' ORDER BY perkara.perkara_id DESC`;
    } else {
      let splitTanggal = tanggal.split("-");
      let tanggalReformat = `${splitTanggal[2]}-${splitTanggal[1]}-${splitTanggal[0]}`;

      query = `SELECT nomor_perkara, nama_mediator, panitera_nama FROM perkara LEFT JOIN perkara_mediasi ON perkara.perkara_id=perkara_mediasi.perkara_id  LEFT JOIN perkara_mediator ON perkara.perkara_id=perkara_mediator.perkara_id LEFT JOIN perkara_jadwal_mediasi ON perkara_mediasi.mediasi_id=perkara_jadwal_mediasi.mediasi_id LEFT JOIN perkara_panitera_pn ON perkara.perkara_id=perkara_panitera_pn.perkara_id WHERE tanggal_mediasi = '${tanggalReformat}' AND perkara_panitera_pn.aktif = 'Y' ORDER BY perkara.perkara_id DESC`;
    }

    db.query(query, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r, index) => {
            resultArray.push(
              `${index + 1}. ${r.nomor_perkara}\nNama Mediator : ${r.nama_mediator}\nPP : ${r.panitera_nama}`
            );
          });
          responseMessage = resultArray.join("\n\n");
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getStatistik = async (year) => {
  let querySisaTahunLalu = `SELECT COUNT(perkara.perkara_id) as jumlah_sisa FROM perkara LEFT JOIN perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id WHERE alur_perkara_id != 114 and YEAR(tanggal_pendaftaran) < ${year} AND (tanggal_putusan IS NULL OR YEAR(tanggal_putusan) = ${year})`;
  let queryMasukTahunIni = `SELECT COUNT(perkara.perkara_id) as jumlah_masuk FROM perkara LEFT JOIN perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id WHERE alur_perkara_id != 114 and YEAR(tanggal_pendaftaran) = ${year} `;
  let queryPutusTahunIni = `SELECT COUNT(perkara.perkara_id) as jumlah_putus FROM perkara LEFT JOIN perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id WHERE alur_perkara_id != 114 AND YEAR(tanggal_putusan) = ${year} AND tanggal_putusan IS NOT NULL`;

  let jmlSisaTahunLalu = () => {
    return new Promise((resolve, reject) => {
      db.query(querySisaTahunLalu, async (err, result) => {
        if (err) {
          reject(err);
        } else {
          let jml = result;
          resolve(jml);
        }
      });
    });
  };

  let jmlMasukTahunIni = () => {
    return new Promise((resolve, reject) => {
      db.query(queryMasukTahunIni, async (err, result) => {
        if (err) {
          reject(err);
        } else {
          let jml = result;
          resolve(jml);
        }
      });
    });
  };

  let jmlPutusTahunIni = () => {
    return new Promise((resolve, reject) => {
      db.query(queryPutusTahunIni, async (err, result) => {
        if (err) {
          reject(err);
        } else {
          let jml = result;
          resolve(jml);
        }
      });
    });
  };

  let sisaTahunLalu = jmlSisaTahunLalu();
  let numberSisaTahunLalu = await sisaTahunLalu;
  let masukTahunIni = jmlMasukTahunIni();
  let numberMasukTahunIni = await masukTahunIni;
  let putusTahunIni = jmlPutusTahunIni();
  let numberPutusTahunIni = await putusTahunIni;
  let sisaTahunIni =
    numberSisaTahunLalu[0].jumlah_sisa +
    numberMasukTahunIni[0].jumlah_masuk -
    numberPutusTahunIni[0].jumlah_putus;
  let rasioPerkara =
    (numberPutusTahunIni[0].jumlah_putus /
      (numberSisaTahunLalu[0].jumlah_sisa +
        numberMasukTahunIni[0].jumlah_masuk)) *
    100;

  let rasioDisplay = rasioPerkara.toFixed(2);

  let message = `*Statistik Perkara Tahun ${year} :* \nJumlah sisa tahun lalu : ${numberSisaTahunLalu[0].jumlah_sisa}, \nJumlah masuk : ${numberMasukTahunIni[0].jumlah_masuk} \nJumlah putus : ${numberPutusTahunIni[0].jumlah_putus} \nSisa : ${sisaTahunIni} \n*Rasio Penanganan Perkara  : ${rasioDisplay}%*`;

  return message;
};

const getStatistikDetail = async (year) => {
  let querySisaTahunLalu = `SELECT COUNT(perkara.perkara_id) as jumlah_sisa,
  SUM(CASE WHEN jenis_perkara_id = 347 THEN 1 ELSE 0 END) as jumlah_sisa_cerai_gugat,
  SUM(CASE WHEN jenis_perkara_id = 346 THEN 1 ELSE 0 END) as jumlah_sisa_cerai_talak,
  SUM(CASE WHEN jenis_perkara_id = 362 THEN 1 ELSE 0 END) as jumlah_sisa_dispensasi_kawin,
  SUM(CASE WHEN jenis_perkara_id = 360 THEN 1 ELSE 0 END) as jumlah_sisa_itsbat_nikah,
  SUM(CASE WHEN jenis_perkara_id = 348 THEN 1 ELSE 0 END) as jumlah_sisa_harta_bersama,
  SUM(CASE WHEN jenis_perkara_id = 371 THEN 1 ELSE 0 END) as jumlah_sisa_penetapan_ahli_waris,
  SUM(CASE WHEN jenis_perkara_id = 349 THEN 1 ELSE 0 END) as jumlah_sisa_hadhanah,
  SUM(CASE WHEN jenis_perkara_id = 364 THEN 1 ELSE 0 END) as jumlah_sisa_kewarisan,
  SUM(CASE WHEN jenis_perkara_id = 341 THEN 1 ELSE 0 END) as jumlah_sisa_izin_poligami,
  SUM(CASE WHEN jenis_perkara_id = 354 THEN 1 ELSE 0 END) as jumlah_sisa_perwalian,
  SUM(CASE WHEN jenis_perkara_id = 367 THEN 1 ELSE 0 END) as jumlah_sisa_wakaf,
  SUM(CASE WHEN jenis_perkara_id = 363 THEN 1 ELSE 0 END) as jumlah_sisa_wali_adhol,
  SUM(CASE WHEN jenis_perkara_id = 358 THEN 1 ELSE 0 END) as jumlah_sisa_asal_usul_anak,
  SUM(CASE WHEN jenis_perkara_id = 352 THEN 1 ELSE 0 END) as jumlah_sisa_pengesahan_anak,
  SUM(CASE WHEN jenis_perkara_id = 344 THEN 1 ELSE 0 END) as jumlah_sisa_pembatalan_pernikahan,
  SUM(CASE WHEN jenis_perkara_id = 369 THEN 1 ELSE 0 END) as jumlah_sisa_lain_lain
  FROM perkara LEFT JOIN perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id WHERE alur_perkara_id != 114 AND YEAR(tanggal_pendaftaran) < ${year} AND (tanggal_putusan IS NULL OR YEAR(tanggal_putusan) = ${year})`;

  let queryMasukTahunIni = `SELECT COUNT(perkara.perkara_id) as jumlah_masuk,
  SUM(CASE WHEN jenis_perkara_id = 347 THEN 1 ELSE 0 END) as jumlah_masuk_cerai_gugat,
  SUM(CASE WHEN jenis_perkara_id = 346 THEN 1 ELSE 0 END) as jumlah_masuk_cerai_talak,
  SUM(CASE WHEN jenis_perkara_id = 362 THEN 1 ELSE 0 END) as jumlah_masuk_dispensasi_kawin,
  SUM(CASE WHEN jenis_perkara_id = 360 THEN 1 ELSE 0 END) as jumlah_masuk_itsbat_nikah,
  SUM(CASE WHEN jenis_perkara_id = 348 THEN 1 ELSE 0 END) as jumlah_masuk_harta_bersama,
  SUM(CASE WHEN jenis_perkara_id = 371 THEN 1 ELSE 0 END) as jumlah_masuk_penetapan_ahli_waris,
  SUM(CASE WHEN jenis_perkara_id = 349 THEN 1 ELSE 0 END) as jumlah_masuk_hadhanah,
  SUM(CASE WHEN jenis_perkara_id = 364 THEN 1 ELSE 0 END) as jumlah_masuk_kewarisan,
  SUM(CASE WHEN jenis_perkara_id = 341 THEN 1 ELSE 0 END) as jumlah_masuk_izin_poligami,
  SUM(CASE WHEN jenis_perkara_id = 354 THEN 1 ELSE 0 END) as jumlah_masuk_perwalian,
  SUM(CASE WHEN jenis_perkara_id = 367 THEN 1 ELSE 0 END) as jumlah_masuk_wakaf,
  SUM(CASE WHEN jenis_perkara_id = 363 THEN 1 ELSE 0 END) as jumlah_masuk_wali_adhol,
  SUM(CASE WHEN jenis_perkara_id = 358 THEN 1 ELSE 0 END) as jumlah_masuk_asal_usul_anak,
  SUM(CASE WHEN jenis_perkara_id = 352 THEN 1 ELSE 0 END) as jumlah_masuk_pengesahan_anak,
  SUM(CASE WHEN jenis_perkara_id = 344 THEN 1 ELSE 0 END) as jumlah_masuk_pembatalan_pernikahan,
  SUM(CASE WHEN jenis_perkara_id = 369 THEN 1 ELSE 0 END) as jumlah_masuk_lain_lain
   FROM perkara LEFT JOIN perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id WHERE alur_perkara_id != 114 AND YEAR(tanggal_pendaftaran) = ${year}`;

   let queryPutusTahunIni = `SELECT 
   COUNT(perkara.perkara_id) as jumlah_putus,
   SUM(CASE WHEN jenis_perkara_id = 347 THEN 1 ELSE 0 END) as jumlah_putus_cerai_gugat,
   SUM(CASE WHEN jenis_perkara_id = 346 THEN 1 ELSE 0 END) as jumlah_putus_cerai_talak,
   SUM(CASE WHEN jenis_perkara_id = 362 THEN 1 ELSE 0 END) as jumlah_putus_dispensasi_kawin,
   SUM(CASE WHEN jenis_perkara_id = 360 THEN 1 ELSE 0 END) as jumlah_putus_itsbat_nikah,
   SUM(CASE WHEN jenis_perkara_id = 348 THEN 1 ELSE 0 END) as jumlah_putus_harta_bersama,
   SUM(CASE WHEN jenis_perkara_id = 371 THEN 1 ELSE 0 END) as jumlah_putus_penetapan_ahli_waris,
   SUM(CASE WHEN jenis_perkara_id = 349 THEN 1 ELSE 0 END) as jumlah_putus_hadhanah,
   SUM(CASE WHEN jenis_perkara_id = 364 THEN 1 ELSE 0 END) as jumlah_putus_kewarisan,
   SUM(CASE WHEN jenis_perkara_id = 341 THEN 1 ELSE 0 END) as jumlah_putus_izin_poligami,
   SUM(CASE WHEN jenis_perkara_id = 354 THEN 1 ELSE 0 END) as jumlah_putus_perwalian,
   SUM(CASE WHEN jenis_perkara_id = 367 THEN 1 ELSE 0 END) as jumlah_putus_wakaf,
   SUM(CASE WHEN jenis_perkara_id = 363 THEN 1 ELSE 0 END) as jumlah_putus_wali_adhol,
   SUM(CASE WHEN jenis_perkara_id = 358 THEN 1 ELSE 0 END) as jumlah_putus_asal_usul_anak,
   SUM(CASE WHEN jenis_perkara_id = 352 THEN 1 ELSE 0 END) as jumlah_putus_pengesahan_anak,
   SUM(CASE WHEN jenis_perkara_id = 344 THEN 1 ELSE 0 END) as jumlah_putus_pembatalan_pernikahan,
   SUM(CASE WHEN jenis_perkara_id = 369 THEN 1 ELSE 0 END) as jumlah_putus_lain_lain
   FROM perkara
   LEFT JOIN perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id 
   WHERE alur_perkara_id != 114 AND YEAR(tanggal_putusan) = ${year} AND tanggal_putusan IS NOT NULL`;   

  let jmlSisaTahunLalu = () => {
    return new Promise((resolve, reject) => {
      db.query(querySisaTahunLalu, async (err, result) => {
        if (err) {
          reject(err);
        } else {
          let jml = result;
          resolve(jml);
        }
      });
    });
  };

  let jmlMasukTahunIni = () => {
    return new Promise((resolve, reject) => {
      db.query(queryMasukTahunIni, async (err, result) => {
        if (err) {
          reject(err);
        } else {
          let jml = result;
          resolve(jml);
        }
      });
    });
  };

  let jmlPutusTahunIni = () => {
    return new Promise((resolve, reject) => {
      db.query(queryPutusTahunIni, async (err, result) => {
        if (err) {
          reject(err);
        } else {
          let jml = result;
          resolve(jml);
        }
      });
    });
  };

  let sisaTahunLalu = jmlSisaTahunLalu();
  let numberSisaTahunLalu = await sisaTahunLalu;
  let masukTahunIni = jmlMasukTahunIni();
  let numberMasukTahunIni = await masukTahunIni;
  let putusTahunIni = jmlPutusTahunIni();
  let numberPutusTahunIni = await putusTahunIni;

// QUERY TENTANG SISA TIAP JENIS PERKARA
  let jumlahSisaCeraiGugat =
    numberSisaTahunLalu[0].jumlah_sisa_cerai_gugat || 0;
  let jumlahSisaCeraiTalak =
    numberSisaTahunLalu[0].jumlah_sisa_cerai_talak || 0;
  let jumlahSisaDispensasiKawin =
    numberSisaTahunLalu[0].jumlah_sisa_dispensasi_kawin || 0;
  let jumlahSisaItsbatNikah =
    numberSisaTahunLalu[0].jumlah_sisa_itsbat_nikah || 0;
  let jumlahSisaHartaBersama =
    numberSisaTahunLalu[0].jumlah_sisa_harta_bersama || 0;
  let jumlahSisaPenetapanAhliWaris =
    numberSisaTahunLalu[0].jumlah_sisa_penetapan_ahli_waris || 0;
  let jumlahSisaHadhanah = 
    numberSisaTahunLalu[0].jumlah_sisa_hadhanah || 0;
  let jumlahSisaKewarisan = 
    numberSisaTahunLalu[0].jumlah_sisa_kewarisan || 0;
  let jumlahSisaIzinPoligami =
    numberSisaTahunLalu[0].jumlah_sisa_izin_poligami || 0;
  let jumlahSisaPerwalian = 
    numberSisaTahunLalu[0].jumlah_sisa_perwalian || 0;
  let jumlahSisaWakaf = 
    numberSisaTahunLalu[0].jumlah_sisa_wakaf || 0;
  let jumlahSisaWaliAdhol = 
    numberSisaTahunLalu[0].jumlah_sisa_wali_adhol || 0;
  let jumlahSisaAsalUsulAnak =
    numberSisaTahunLalu[0].jumlah_sisa_asal_usul_anak || 0;
  let jumlahSisaPengesahanAnak =
    numberSisaTahunLalu[0].jumlah_sisa_pengesahan_anak || 0;
  let jumlahSisaPembatalanPernikahan =
    numberSisaTahunLalu[0].jumlah_sisa_pembatalan_pernikahan || 0;
  let jumlahSisaLainLain = 
    numberSisaTahunLalu[0].jumlah_sisa_lain_lain || 0;

// QUERY TENTANG MASUK TIAP JENIS PERKARA
  let jumlahMasukCeraiGugat =
    numberMasukTahunIni[0].jumlah_masuk_cerai_gugat || 0;
  let jumlahMasukCeraiTalak =
    numberMasukTahunIni[0].jumlah_masuk_cerai_talak || 0;
  let jumlahMasukDispensasiKawin =
    numberMasukTahunIni[0].jumlah_masuk_dispensasi_kawin || 0;
  let jumlahMasukItsbatNikah =
    numberMasukTahunIni[0].jumlah_masuk_itsbat_nikah || 0;
  let jumlahMasukHartaBersama =
    numberMasukTahunIni[0].jumlah_masuk_harta_bersama || 0;
  let jumlahMasukPenetapanAhliWaris =
    numberMasukTahunIni[0].jumlah_masuk_penetapan_ahli_waris || 0;
  let jumlahMasukHadhanah =
    numberMasukTahunIni[0].jumlah_masuk_hadhanah || 0;
  let jumlahMasukKewarisan =
    numberMasukTahunIni[0].jumlah_masuk_kewarisan || 0;
  let jumlahMasukIzinPoligami =
    numberMasukTahunIni[0].jumlah_masuk_izin_poligami || 0;
  let jumlahMasukPerwalian =
    numberMasukTahunIni[0].jumlah_masuk_perwalian || 0;
  let jumlahMasukWakaf =
    numberMasukTahunIni[0].jumlah_masuk_wakaf || 0;
  let jumlahMasukWaliAdhol =
    numberMasukTahunIni[0].jumlah_masuk_wali_adhol || 0;
  let jumlahMasukAsalUsulAnak =
    numberMasukTahunIni[0].jumlah_masuk_asal_usul_anak || 0;
  let jumlahMasukPengesahanAnak =
    numberMasukTahunIni[0].jumlah_masuk_pengesahan_anak || 0;
  let jumlahMasukPembatalanPernikahan =
    numberMasukTahunIni[0].jumlah_masuk_pembatalan_pernikahan || 0;
  let jumlahMasukLainLain =
    numberMasukTahunIni[0].jumlah_masuk_lain_lain || 0;

// QUERY TENTANG PUTUSAN TIAP JENIS PERKARA
  let jumlahPutusCeraiGugat =
    numberPutusTahunIni[0].jumlah_putus_cerai_gugat || 0;
  let jumlahPutusCeraiTalak =
    numberPutusTahunIni[0].jumlah_putus_cerai_talak || 0;
  let jumlahPutusDispensasiKawin =
    numberPutusTahunIni[0].jumlah_putus_dispensasi_kawin || 0;
  let jumlahPutusItsbatNikah =
    numberPutusTahunIni[0].jumlah_putus_itsbat_nikah || 0;
  let jumlahPutusHartaBersama =
    numberPutusTahunIni[0].jumlah_putus_harta_bersama || 0;
  let jumlahPutusPenetapanAhliWaris =
    numberPutusTahunIni[0].jumlah_putus_penetapan_ahli_waris || 0;
  let jumlahPutusHadhanah = 
    numberPutusTahunIni[0].jumlah_putus_hadhanah || 0;
  let jumlahPutusKewarisan = 
    numberPutusTahunIni[0].jumlah_putus_kewarisan || 0;
  let jumlahPutusIzinPoligami =
    numberPutusTahunIni[0].jumlah_putus_izin_poligami || 0;
  let jumlahPutusPerwalian = 
    numberPutusTahunIni[0].jumlah_putus_perwalian || 0;
  let jumlahPutusWakaf = 
    numberPutusTahunIni[0].jumlah_putus_wakaf || 0;
  let jumlahPutusWaliAdhol =
    numberPutusTahunIni[0].jumlah_putus_wali_adhol || 0;
  let jumlahPutusAsalUsulAnak =
    numberPutusTahunIni[0].jumlah_putus_asal_usul_anak || 0;
  let jumlahPutusPengesahanAnak =
    numberPutusTahunIni[0].jumlah_putus_pengesahan_anak || 0;
  let jumlahPutusPembatalanPernikahan =
    numberPutusTahunIni[0].jumlah_putus_pembatalan_pernikahan || 0;
  let jumlahPutusLainLain = 
    numberPutusTahunIni[0].jumlah_putus_lain_lain || 0;

  let sisaTahunIni =
    numberSisaTahunLalu[0].jumlah_sisa +
    numberMasukTahunIni[0].jumlah_masuk -
    numberPutusTahunIni[0].jumlah_putus;

  let rasioPerkara =
    (numberPutusTahunIni[0].jumlah_putus /
      (numberSisaTahunLalu[0].jumlah_sisa +
        numberMasukTahunIni[0].jumlah_masuk)) *
    100;

  let rasioDisplay = rasioPerkara.toFixed(2);

  let message = `*Statistik Perkara Tahun ${year} :* \n*Jumlah sisa tahun lalu : ${numberSisaTahunLalu[0].jumlah_sisa}*, \n*Jumlah masuk : ${numberMasukTahunIni[0].jumlah_masuk}* \n*Jumlah putus : ${numberPutusTahunIni[0].jumlah_putus}* \n\n*Sisa : ${sisaTahunIni}* \n*Rasio Penanganan Perkara  : ${rasioDisplay}%*\n\nJumlah Sisa Tiap Jenis Perkara\n\nJumlah sisa Cerai Gugat : ${jumlahSisaCeraiGugat} \nJumlah sisa Cerai Talak : ${jumlahSisaCeraiTalak} \nJumlah sisa Dispensasi Kawin : ${jumlahSisaDispensasiKawin} \nJumlah sisa Itsbat Nikah : ${jumlahSisaItsbatNikah} \nJumlah sisa Harta Bersama : ${jumlahSisaHartaBersama} \nJumlah sisa Penetapan Ahli Waris : ${jumlahSisaPenetapanAhliWaris} \nJumlah sisa Hadhanah : ${jumlahSisaHadhanah} \nJumlah sisa Kewarisan : ${jumlahSisaKewarisan} \nJumlah sisa Izin Poligami : ${jumlahSisaIzinPoligami} \nJumlah sisa Perwalian : ${jumlahSisaPerwalian} \nJumlah sisa Wakaf : ${jumlahSisaWakaf} \nJumlah sisa Wali Adhol : ${jumlahSisaWaliAdhol} \nJumlah sisa Asal Usul Anak : ${jumlahSisaAsalUsulAnak} \nJumlah sisa Pengesahan Anak : ${jumlahSisaPengesahanAnak} \nJumlah sisa Pembatalan Pernikahan : ${jumlahSisaPembatalanPernikahan} \nJumlah sisa Lain-Lain : ${jumlahSisaLainLain}\n\nJumlah Masuk Tiap Jenis Perkara\n\nJumlah masuk Cerai Gugat : ${jumlahMasukCeraiGugat} \nJumlah masuk Cerai Talak : ${jumlahMasukCeraiTalak} \nJumlah masuk Dispensasi Kawin : ${jumlahMasukDispensasiKawin} \nJumlah masuk Itsbat Nikah : ${jumlahMasukItsbatNikah} \nJumlah masuk Harta Bersama : ${jumlahMasukHartaBersama} \nJumlah masuk Penetapan Ahli Waris : ${jumlahMasukPenetapanAhliWaris} \nJumlah masuk Hadhanah : ${jumlahMasukHadhanah} \nJumlah masuk Kewarisan : ${jumlahMasukKewarisan} \nJumlah masuk Izin Poligami : ${jumlahMasukIzinPoligami} \nJumlah masuk Perwalian : ${jumlahMasukPerwalian} \nJumlah masuk Wakaf : ${jumlahMasukWakaf} \nJumlah masuk Wali Adhol : ${jumlahMasukWaliAdhol} \nJumlah masuk Asal Usul Anak : ${jumlahMasukAsalUsulAnak} \nJumlah masuk Pengesahan Anak : ${jumlahMasukPengesahanAnak} \nJumlah masuk Pembatalan Pernikahan : ${jumlahMasukPembatalanPernikahan} \nJumlah masuk Lain-Lain : ${jumlahMasukLainLain}\n\nJumlah Putus Tiap Jenis Perkara\n\nJumlah putus Cerai Gugat : ${jumlahPutusCeraiGugat} \nJumlah putus Cerai Talak : ${jumlahPutusCeraiTalak} \nJumlah putus Dispensasi Kawin : ${jumlahPutusDispensasiKawin} \nJumlah putus Itsbat Nikah : ${jumlahPutusItsbatNikah} \nJumlah putus Harta Bersama : ${jumlahPutusHartaBersama} \nJumlah putus Penetapan Ahli Waris : ${jumlahPutusPenetapanAhliWaris} \nJumlah putus Hadhanah : ${jumlahPutusHadhanah} \nJumlah putus Kewarisan : ${jumlahPutusKewarisan} \nJumlah putus Izin Poligami : ${jumlahPutusIzinPoligami} \nJumlah putus Perwalian : ${jumlahPutusPerwalian} \nJumlah putus Wakaf : ${jumlahPutusWakaf} \nJumlah putus Wali Adhol : ${jumlahPutusWaliAdhol} \nJumlah putus Asal Usul Anak : ${jumlahPutusAsalUsulAnak} \nJumlah putus Pengesahan Anak : ${jumlahPutusPengesahanAnak} \nJumlah putus Pembatalan Pernikahan : ${jumlahPutusPembatalanPernikahan} \nJumlah putus Lain-Lain : ${jumlahPutusLainLain}`;

  return message;
};

const getStatistikBulanan = async (month) => {
  let querySisaBulanLalu = `SELECT 
    COUNT(perkara.perkara_id) AS jumlah_sisa,
    SUM(CASE WHEN jenis_perkara_id = 347 THEN 1 ELSE 0 END) AS jumlah_sisa_cerai_gugat,
    SUM(CASE WHEN jenis_perkara_id = 346 THEN 1 ELSE 0 END) AS jumlah_sisa_cerai_talak,
    SUM(CASE WHEN jenis_perkara_id = 362 THEN 1 ELSE 0 END) AS jumlah_sisa_dispensasi_kawin,
    SUM(CASE WHEN jenis_perkara_id = 360 THEN 1 ELSE 0 END) AS jumlah_sisa_itsbat_nikah,
    SUM(CASE WHEN jenis_perkara_id = 348 THEN 1 ELSE 0 END) AS jumlah_sisa_harta_bersama,
    SUM(CASE WHEN jenis_perkara_id = 371 THEN 1 ELSE 0 END) AS jumlah_sisa_penetapan_ahli_waris,
    SUM(CASE WHEN jenis_perkara_id = 349 THEN 1 ELSE 0 END) AS jumlah_sisa_hadhanah,
    SUM(CASE WHEN jenis_perkara_id = 364 THEN 1 ELSE 0 END) AS jumlah_sisa_kewarisan,
    SUM(CASE WHEN jenis_perkara_id = 341 THEN 1 ELSE 0 END) AS jumlah_sisa_izin_poligami,
    SUM(CASE WHEN jenis_perkara_id = 354 THEN 1 ELSE 0 END) AS jumlah_sisa_perwalian,
    SUM(CASE WHEN jenis_perkara_id = 367 THEN 1 ELSE 0 END) AS jumlah_sisa_wakaf,
    SUM(CASE WHEN jenis_perkara_id = 363 THEN 1 ELSE 0 END) AS jumlah_sisa_wali_adhol,
    SUM(CASE WHEN jenis_perkara_id = 358 THEN 1 ELSE 0 END) AS jumlah_sisa_asal_usul_anak,
    SUM(CASE WHEN jenis_perkara_id = 352 THEN 1 ELSE 0 END) AS jumlah_sisa_pengesahan_anak,
    SUM(CASE WHEN jenis_perkara_id = 344 THEN 1 ELSE 0 END) AS jumlah_sisa_pembatalan_pernikahan,
    SUM(CASE WHEN jenis_perkara_id = 369 THEN 1 ELSE 0 END) AS jumlah_sisa_lain_lain
  FROM 
    perkara 
  LEFT JOIN 
    perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id 
  WHERE 
    alur_perkara_id != 114 AND 
    MONTH(tanggal_pendaftaran) < ${month} AND 
    (tanggal_putusan IS NULL OR MONTH(tanggal_putusan) = ${month})`;

  let queryMasukBulanIni = `SELECT COUNT(perkara.perkara_id) as jumlah_masuk,
  SUM(CASE WHEN jenis_perkara_id = 347 THEN 1 ELSE 0 END) as jumlah_masuk_cerai_gugat,
  SUM(CASE WHEN jenis_perkara_id = 346 THEN 1 ELSE 0 END) as jumlah_masuk_cerai_talak,
  SUM(CASE WHEN jenis_perkara_id = 362 THEN 1 ELSE 0 END) as jumlah_masuk_dispensasi_kawin,
  SUM(CASE WHEN jenis_perkara_id = 360 THEN 1 ELSE 0 END) as jumlah_masuk_itsbat_nikah,
  SUM(CASE WHEN jenis_perkara_id = 348 THEN 1 ELSE 0 END) as jumlah_masuk_harta_bersama,
  SUM(CASE WHEN jenis_perkara_id = 371 THEN 1 ELSE 0 END) as jumlah_masuk_penetapan_ahli_waris,
  SUM(CASE WHEN jenis_perkara_id = 349 THEN 1 ELSE 0 END) as jumlah_masuk_hadhanah,
  SUM(CASE WHEN jenis_perkara_id = 364 THEN 1 ELSE 0 END) as jumlah_masuk_kewarisan,
  SUM(CASE WHEN jenis_perkara_id = 341 THEN 1 ELSE 0 END) as jumlah_masuk_izin_poligami,
  SUM(CASE WHEN jenis_perkara_id = 354 THEN 1 ELSE 0 END) as jumlah_masuk_perwalian,
  SUM(CASE WHEN jenis_perkara_id = 367 THEN 1 ELSE 0 END) as jumlah_masuk_wakaf,
  SUM(CASE WHEN jenis_perkara_id = 363 THEN 1 ELSE 0 END) as jumlah_masuk_wali_adhol,
  SUM(CASE WHEN jenis_perkara_id = 358 THEN 1 ELSE 0 END) as jumlah_masuk_asal_usul_anak,
  SUM(CASE WHEN jenis_perkara_id = 352 THEN 1 ELSE 0 END) as jumlah_masuk_pengesahan_anak,
  SUM(CASE WHEN jenis_perkara_id = 344 THEN 1 ELSE 0 END) as jumlah_masuk_pembatalan_pernikahan,
  SUM(CASE WHEN jenis_perkara_id = 369 THEN 1 ELSE 0 END) as jumlah_masuk_lain_lain
   FROM perkara LEFT JOIN perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id WHERE alur_perkara_id != 114 AND YEAR(tanggal_pendaftaran) = ${month}`;

   let queryPutusBulanIni = `SELECT 
   COUNT(perkara.perkara_id) as jumlah_putus,
   SUM(CASE WHEN jenis_perkara_id = 347 THEN 1 ELSE 0 END) as jumlah_putus_cerai_gugat,
   SUM(CASE WHEN jenis_perkara_id = 346 THEN 1 ELSE 0 END) as jumlah_putus_cerai_talak,
   SUM(CASE WHEN jenis_perkara_id = 362 THEN 1 ELSE 0 END) as jumlah_putus_dispensasi_kawin,
   SUM(CASE WHEN jenis_perkara_id = 360 THEN 1 ELSE 0 END) as jumlah_putus_itsbat_nikah,
   SUM(CASE WHEN jenis_perkara_id = 348 THEN 1 ELSE 0 END) as jumlah_putus_harta_bersama,
   SUM(CASE WHEN jenis_perkara_id = 371 THEN 1 ELSE 0 END) as jumlah_putus_penetapan_ahli_waris,
   SUM(CASE WHEN jenis_perkara_id = 349 THEN 1 ELSE 0 END) as jumlah_putus_hadhanah,
   SUM(CASE WHEN jenis_perkara_id = 364 THEN 1 ELSE 0 END) as jumlah_putus_kewarisan,
   SUM(CASE WHEN jenis_perkara_id = 341 THEN 1 ELSE 0 END) as jumlah_putus_izin_poligami,
   SUM(CASE WHEN jenis_perkara_id = 354 THEN 1 ELSE 0 END) as jumlah_putus_perwalian,
   SUM(CASE WHEN jenis_perkara_id = 367 THEN 1 ELSE 0 END) as jumlah_putus_wakaf,
   SUM(CASE WHEN jenis_perkara_id = 363 THEN 1 ELSE 0 END) as jumlah_putus_wali_adhol,
   SUM(CASE WHEN jenis_perkara_id = 358 THEN 1 ELSE 0 END) as jumlah_putus_asal_usul_anak,
   SUM(CASE WHEN jenis_perkara_id = 352 THEN 1 ELSE 0 END) as jumlah_putus_pengesahan_anak,
   SUM(CASE WHEN jenis_perkara_id = 344 THEN 1 ELSE 0 END) as jumlah_putus_pembatalan_pernikahan,
   SUM(CASE WHEN jenis_perkara_id = 369 THEN 1 ELSE 0 END) as jumlah_putus_lain_lain
   FROM perkara
   LEFT JOIN perkara_putusan ON perkara.perkara_id = perkara_putusan.perkara_id 
   WHERE alur_perkara_id != 114 AND YEAR(tanggal_putusan) = ${month} AND tanggal_putusan IS NOT NULL`;   

  let jmlSisaBulanLalu = () => {
    return new Promise((resolve, reject) => {
      db.query(querySisaBulanLalu, async (err, result) => {
        if (err) {
          reject(err);
        } else {
          let jml = result;
          resolve(jml);
        }
      });
    });
  };

  let jmlMasukBulanIni = () => {
    return new Promise((resolve, reject) => {
      db.query(queryMasukBulanIni, async (err, result) => {
        if (err) {
          reject(err);
        } else {
          let jml = result;
          resolve(jml);
        }
      });
    });
  };

  let jmlPutusBulanIni = () => {
    return new Promise((resolve, reject) => {
      db.query(queryPutusBulanIni, async (err, result) => {
        if (err) {
          reject(err);
        } else {
          let jml = result;
          resolve(jml);
        }
      });
    });
  };

  let sisaBulanLalu = jmlSisaBulanLalu();
  let numberSisaBulanLalu = await sisaBulanLalu;
  let masukBulanIni = jmlMasukBulanIni();
  let numberMasukBulanIni = await masukBulanIni;
  let putusBulanIni = jmlPutusBulanIni();
  let numberPutusBulanIni = await putusBulanIni;

// QUERY TENTANG SISA TIAP JENIS PERKARA
  let jumlahSisaCeraiGugat =
    numberSisaBulanLalu[0].jumlah_sisa_cerai_gugat || 0;
  let jumlahSisaCeraiTalak =
    numberSisaBulanLalu[0].jumlah_sisa_cerai_talak || 0;
  let jumlahSisaDispensasiKawin =
    numberSisaBulanLalu[0].jumlah_sisa_dispensasi_kawin || 0;
  let jumlahSisaItsbatNikah =
    numberSisaBulanLalu[0].jumlah_sisa_itsbat_nikah || 0;
  let jumlahSisaHartaBersama =
    numberSisaBulanLalu[0].jumlah_sisa_harta_bersama || 0;
  let jumlahSisaPenetapanAhliWaris =
    numberSisaBulanLalu[0].jumlah_sisa_penetapan_ahli_waris || 0;
  let jumlahSisaHadhanah = 
    numberSisaBulanLalu[0].jumlah_sisa_hadhanah || 0;
  let jumlahSisaKewarisan = 
    numberSisaBulanLalu[0].jumlah_sisa_kewarisan || 0;
  let jumlahSisaIzinPoligami =
    numberSisaBulanLalu[0].jumlah_sisa_izin_poligami || 0;
  let jumlahSisaPerwalian = 
    numberSisaBulanLalu[0].jumlah_sisa_perwalian || 0;
  let jumlahSisaWakaf = 
    numberSisaBulanLalu[0].jumlah_sisa_wakaf || 0;
  let jumlahSisaWaliAdhol = 
    numberSisaBulanLalu[0].jumlah_sisa_wali_adhol || 0;
  let jumlahSisaAsalUsulAnak =
    numberSisaBulanLalu[0].jumlah_sisa_asal_usul_anak || 0;
  let jumlahSisaPengesahanAnak =
    numberSisaBulanLalu[0].jumlah_sisa_pengesahan_anak || 0;
  let jumlahSisaPembatalanPernikahan =
    numberSisaBulanLalu[0].jumlah_sisa_pembatalan_pernikahan || 0;
  let jumlahSisaLainLain = 
    numberSisaBulanLalu[0].jumlah_sisa_lain_lain || 0;

// QUERY TENTANG MASUK TIAP JENIS PERKARA
  let jumlahMasukCeraiGugat =
    numberMasukBulanIni[0].jumlah_masuk_cerai_gugat || 0;
  let jumlahMasukCeraiTalak =
    numberMasukBulanIni[0].jumlah_masuk_cerai_talak || 0;
  let jumlahMasukDispensasiKawin =
    numberMasukBulanIni[0].jumlah_masuk_dispensasi_kawin || 0;
  let jumlahMasukItsbatNikah =
    numberMasukBulanIni[0].jumlah_masuk_itsbat_nikah || 0;
  let jumlahMasukHartaBersama =
    numberMasukBulanIni[0].jumlah_masuk_harta_bersama || 0;
  let jumlahMasukPenetapanAhliWaris =
    numberMasukBulanIni[0].jumlah_masuk_penetapan_ahli_waris || 0;
  let jumlahMasukHadhanah =
    numberMasukBulanIni[0].jumlah_masuk_hadhanah || 0;
  let jumlahMasukKewarisan =
    numberMasukBulanIni[0].jumlah_masuk_kewarisan || 0;
  let jumlahMasukIzinPoligami =
    numberMasukBulanIni[0].jumlah_masuk_izin_poligami || 0;
  let jumlahMasukPerwalian =
    numberMasukBulanIni[0].jumlah_masuk_perwalian || 0;
  let jumlahMasukWakaf =
    numberMasukBulanIni[0].jumlah_masuk_wakaf || 0;
  let jumlahMasukWaliAdhol =
    numberMasukBulanIni[0].jumlah_masuk_wali_adhol || 0;
  let jumlahMasukAsalUsulAnak =
    numberMasukBulanIni[0].jumlah_masuk_asal_usul_anak || 0;
  let jumlahMasukPengesahanAnak =
    numberMasukBulanIni[0].jumlah_masuk_pengesahan_anak || 0;
  let jumlahMasukPembatalanPernikahan =
    numberMasukBulanIni[0].jumlah_masuk_pembatalan_pernikahan || 0;
  let jumlahMasukLainLain =
    numberMasukBulanIni[0].jumlah_masuk_lain_lain || 0;

// QUERY TENTANG PUTUSAN TIAP JENIS PERKARA
  let jumlahPutusCeraiGugat =
    numberPutusBulanIni[0].jumlah_putus_cerai_gugat || 0;
  let jumlahPutusCeraiTalak =
    numberPutusBulanIni[0].jumlah_putus_cerai_talak || 0;
  let jumlahPutusDispensasiKawin =
    numberPutusBulanIni[0].jumlah_putus_dispensasi_kawin || 0;
  let jumlahPutusItsbatNikah =
    numberPutusBulanIni[0].jumlah_putus_itsbat_nikah || 0;
  let jumlahPutusHartaBersama =
    numberPutusBulanIni[0].jumlah_putus_harta_bersama || 0;
  let jumlahPutusPenetapanAhliWaris =
    numberPutusBulanIni[0].jumlah_putus_penetapan_ahli_waris || 0;
  let jumlahPutusHadhanah = 
    numberPutusBulanIni[0].jumlah_putus_hadhanah || 0;
  let jumlahPutusKewarisan = 
    numberPutusBulanIni[0].jumlah_putus_kewarisan || 0;
  let jumlahPutusIzinPoligami =
    numberPutusBulanIni[0].jumlah_putus_izin_poligami || 0;
  let jumlahPutusPerwalian = 
    numberPutusBulanIni[0].jumlah_putus_perwalian || 0;
  let jumlahPutusWakaf = 
    numberPutusBulanIni[0].jumlah_putus_wakaf || 0;
  let jumlahPutusWaliAdhol =
    numberPutusBulanIni[0].jumlah_putus_wali_adhol || 0;
  let jumlahPutusAsalUsulAnak =
    numberPutusBulanIni[0].jumlah_putus_asal_usul_anak || 0;
  let jumlahPutusPengesahanAnak =
    numberPutusBulanIni[0].jumlah_putus_pengesahan_anak || 0;
  let jumlahPutusPembatalanPernikahan =
    numberPutusBulanIni[0].jumlah_putus_pembatalan_pernikahan || 0;
  let jumlahPutusLainLain = 
    numberPutusBulanIni[0].jumlah_putus_lain_lain || 0;

  let sisaBulanIni =
    numberSisaBulanLalu[0].jumlah_sisa +
    numberMasukBulanIni[0].jumlah_masuk -
    numberPutusBulanIni[0].jumlah_putus;

  let rasioPerkara =
    (numberPutusBulanIni[0].jumlah_putus /
      (numberSisaBulanLalu[0].jumlah_sisa +
        numberMasukBulanIni[0].jumlah_masuk)) *
    100;

  let rasioDisplay = rasioPerkara.toFixed(2);

  let message = `*Statistik Perkara Bulan ${bulan} :* \n*Jumlah sisa bulan lalu : ${numberSisaBulanLalu[0].jumlah_sisa}*, \n*Jumlah masuk : ${numberMasukBulanIni[0].jumlah_masuk}* \n*Jumlah putus : ${numberPutusBulanIni[0].jumlah_putus}* \n\n*Sisa : ${sisaBulanIni}* \n*Rasio Penanganan Perkara  : ${rasioDisplay}%*\n\nJumlah Sisa Tiap Jenis Perkara\n\nJumlah sisa Cerai Gugat : ${jumlahSisaCeraiGugat} \nJumlah sisa Cerai Talak : ${jumlahSisaCeraiTalak} \nJumlah sisa Dispensasi Kawin : ${jumlahSisaDispensasiKawin} \nJumlah sisa Itsbat Nikah : ${jumlahSisaItsbatNikah} \nJumlah sisa Harta Bersama : ${jumlahSisaHartaBersama} \nJumlah sisa Penetapan Ahli Waris : ${jumlahSisaPenetapanAhliWaris} \nJumlah sisa Hadhanah : ${jumlahSisaHadhanah} \nJumlah sisa Kewarisan : ${jumlahSisaKewarisan} \nJumlah sisa Izin Poligami : ${jumlahSisaIzinPoligami} \nJumlah sisa Perwalian : ${jumlahSisaPerwalian} \nJumlah sisa Wakaf : ${jumlahSisaWakaf} \nJumlah sisa Wali Adhol : ${jumlahSisaWaliAdhol} \nJumlah sisa Asal Usul Anak : ${jumlahSisaAsalUsulAnak} \nJumlah sisa Pengesahan Anak : ${jumlahSisaPengesahanAnak} \nJumlah sisa Pembatalan Pernikahan : ${jumlahSisaPembatalanPernikahan} \nJumlah sisa Lain-Lain : ${jumlahSisaLainLain}\n\nJumlah Masuk Tiap Jenis Perkara\n\nJumlah masuk Cerai Gugat : ${jumlahMasukCeraiGugat} \nJumlah masuk Cerai Talak : ${jumlahMasukCeraiTalak} \nJumlah masuk Dispensasi Kawin : ${jumlahMasukDispensasiKawin} \nJumlah masuk Itsbat Nikah : ${jumlahMasukItsbatNikah} \nJumlah masuk Harta Bersama : ${jumlahMasukHartaBersama} \nJumlah masuk Penetapan Ahli Waris : ${jumlahMasukPenetapanAhliWaris} \nJumlah masuk Hadhanah : ${jumlahMasukHadhanah} \nJumlah masuk Kewarisan : ${jumlahMasukKewarisan} \nJumlah masuk Izin Poligami : ${jumlahMasukIzinPoligami} \nJumlah masuk Perwalian : ${jumlahMasukPerwalian} \nJumlah masuk Wakaf : ${jumlahMasukWakaf} \nJumlah masuk Wali Adhol : ${jumlahMasukWaliAdhol} \nJumlah masuk Asal Usul Anak : ${jumlahMasukAsalUsulAnak} \nJumlah masuk Pengesahan Anak : ${jumlahMasukPengesahanAnak} \nJumlah masuk Pembatalan Pernikahan : ${jumlahMasukPembatalanPernikahan} \nJumlah masuk Lain-Lain : ${jumlahMasukLainLain}\n\nJumlah Putus Tiap Jenis Perkara\n\nJumlah putus Cerai Gugat : ${jumlahPutusCeraiGugat} \nJumlah putus Cerai Talak : ${jumlahPutusCeraiTalak} \nJumlah putus Dispensasi Kawin : ${jumlahPutusDispensasiKawin} \nJumlah putus Itsbat Nikah : ${jumlahPutusItsbatNikah} \nJumlah putus Harta Bersama : ${jumlahPutusHartaBersama} \nJumlah putus Penetapan Ahli Waris : ${jumlahPutusPenetapanAhliWaris} \nJumlah putus Hadhanah : ${jumlahPutusHadhanah} \nJumlah putus Kewarisan : ${jumlahPutusKewarisan} \nJumlah putus Izin Poligami : ${jumlahPutusIzinPoligami} \nJumlah putus Perwalian : ${jumlahPutusPerwalian} \nJumlah putus Wakaf : ${jumlahPutusWakaf} \nJumlah putus Wali Adhol : ${jumlahPutusWaliAdhol} \nJumlah putus Asal Usul Anak : ${jumlahPutusAsalUsulAnak} \nJumlah putus Pengesahan Anak : ${jumlahPutusPengesahanAnak} \nJumlah putus Pembatalan Pernikahan : ${jumlahPutusPembatalanPernikahan} \nJumlah putus Lain-Lain : ${jumlahPutusLainLain}`;

  return message;
};

const covid = async () => {
  let data;
  let dataCovid;
  // dataCovid = axios
  //   .get("https://data.covid19.go.id/public/api/update.json")
  //   .then((response) => {
  //     console.log(response);
  //   })
  //   .catch((err) => {
  //     console.log(err);
  //   });
  let prov = "SULAWESI TENGAH";
  let dataProv = await axios
    .get("https://data.covid19.go.id/public/api/prov.json")
    .then((response) => {
      let data = response.data.list_data.filter((obj) => {
        return obj.key == prov;
      });
      return `*Provinsi* : ${
        data[0].key
      } \nJumlah kasus : *${data[0].jumlah_kasus.toLocaleString()}* \nJumlah sembuh : *${data[0].jumlah_sembuh.toLocaleString()}* \nJumlah meninggal : *${data[0].jumlah_meninggal.toLocaleString()}*`;
    })
    .catch((err) => {
      return "Api error";
    });

  let dataIndonesia = await axios
    .get("https://data.covid19.go.id/public/api/update.json")
    .then((response) => {
      return `*Indonesia* \nJumlah positif : *${response.data.update.total.jumlah_positif.toLocaleString()}* \nJumlah sembuh : *${response.data.update.total.jumlah_sembuh.toLocaleString()}* \nJumlah meninggal : *${response.data.update.total.jumlah_meninggal.toLocaleString()}*`;
    })
    .catch((err) => {
      return "Api error";
    });

  let msg = `${dataProv} \n\n${dataIndonesia}`;

  console.log(msg);
};

const getBhtCapil = (year, month) => {
  let query = `SELECT nomor_perkara, tanggal_putusan, tanggal_bht FROM perkara LEFT JOIN perkara_putusan ON perkara.perkara_id=perkara_putusan.perkara_id WHERE tanggal_putusan IS NOT NULL AND tanggal_bht IS NOT NULL AND MONTH(tanggal_bht)=${month} AND YEAR(tanggal_bht)=${year} AND jenis_perkara_nama IN('Cerai Gugat', 'Cerai Talak') ORDER BY tanggal_bht DESC`;

  return new Promise((resolve, reject) => {
    db.query(query, async (err, result) => {
      if (err) {
        reject(err);
      } else {
        let responseMessage;
        if (result.length != 0) {
          let resultArray = [];
          result.forEach((r) => {
            resultArray.push(
              `Nomor perkara : ${r.nomor_perkara}\ntanggal putus : ${moment(
                r.tanggal_putusan
              ).format("DD-MM-YYYY")}\ntanggal bht : ${moment(
                r.tanggal_bht
              ).format("DD-MM-YYYY")}`
            );
          });
          responseMessage = resultArray.join(`\n\n`);
        } else {
          responseMessage = `Tidak ada data`;
        }
        resolve(responseMessage);
      }
    });
  });
};

const getDataBulananAlasanCerai = (year, month) => {
  let query = `SELECT 
  SUM(CASE faktor_perceraian_id WHEN 1 THEN 1 ELSE 0 END) AS zina,
  SUM(CASE faktor_perceraian_id WHEN 2 THEN 1 ELSE 0 END) AS mabuk,
  SUM(CASE faktor_perceraian_id WHEN 3 THEN 1 ELSE 0 END) AS madat,
  SUM(CASE faktor_perceraian_id WHEN 4 THEN 1 ELSE 0 END) AS judi,
  SUM(CASE WHEN faktor_perceraian_id IN (5,18) THEN 1 ELSE 0 END) AS meninggalkan,
  SUM(CASE WHEN faktor_perceraian_id IN (6,20) THEN 1 ELSE 0 END) AS dihukum,
  SUM(CASE WHEN faktor_perceraian_id IN (7,25,26) THEN 1 ELSE 0 END) AS kdrt,
  SUM(CASE WHEN faktor_perceraian_id IN (8,21) THEN 1 ELSE 0 END) AS cacat,
  SUM(CASE WHEN faktor_perceraian_id IN (9,24) THEN 1 ELSE 0 END) AS perselisihan,
  SUM(CASE WHEN faktor_perceraian_id IN (10,19) THEN 1 ELSE 0 END) AS kawin_paksa,
  SUM(CASE faktor_perceraian_id WHEN 11 THEN 1 ELSE 0 END) AS murtad,
  SUM(CASE faktor_perceraian_id WHEN 12 THEN 1 ELSE 0 END) AS ekonomi,
  SUM(CASE WHEN faktor_perceraian_id IN (13,15) THEN 1 ELSE 0 END) AS poligami, 
  SUM(CASE WHEN faktor_perceraian_id IN (16,17,22,23) THEN 1 ELSE 0 END) AS lain
FROM perkara_akta_cerai  
WHERE
  MONTH(tgl_akta_cerai) = ${month} AND YEAR(tgl_akta_cerai) = ${year}`;

  return new Promise((resolve, reject) => {
    db.query(query, async (err, result) => {
        if (err) {
            reject(err);
        } else {
            let responseMessage;
            if (result.length != 0) {
                let resultArray = result.map((r) => {
                    return `Rekapitulasi berdasarkan alasan cerai bulan ${month} ${year} :\nAlasan Zina : ${r.zina}\nAlasan Mabuk : ${r.mabuk}\nAlasan Madat : ${r.madat}\nAlasan Judi : ${r.judi}\nAlasan Meninggalkan 2 Tahun : ${r.meninggalkan}\nAlasan Dihukum : ${r.dihukum}\nAlasan KDRT : ${r.kdrt}\nAlasan Cacat : ${r.cacat}\nAlasan Perselisihan : ${r.perselisihan}\nAlasan Kawin Paksa : ${r.kawin_paksa}\nAlasan Murtad : ${r.murtad}\nAlasan Ekonomi : ${r.ekonomi}\nAlasan Poligami : ${r.poligami}\nAlasan Lain : ${r.lain}`;
                });
                responseMessage = resultArray.join(`\n\n`);
            } else {
                responseMessage = `Tidak ada data`;
            }
            resolve(responseMessage);
      }
    });
  });
};

// const stiker = async () => {
//   const media = MessageMedia.fromFilePath(
//     `./public/sticker/Naruto_Uzumaki.png`
//   );
//   media.filename = "naruto";
//   return media;
//   console.log(media);
// };
// stiker();
// getStatistik(2021).then((res) => console.log(res));
module.exports = getData;
