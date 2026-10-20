/**
 * ============================================================================
 * PENANDA ISIAN "DIISI MANUAL" DAN "OPSIONAL" BLANGKO DERRY (20 Okt 2026, agen S3)
 * ============================================================================
 *
 * Isian popup yang TIDAK mungkin terisi otomatis ditandai terang di kartu "Perlu diisi" - tidak dibiarkan kosong tanpa kabar:
 *
 *   ISIAN_MANUAL    kode -> alasan singkat (bahasa pengguna). Tampil sebagai lencana "diisi manual" dan alasan di ikon ⓘ.
 *                   Hanya dipakai bila tidak ada pengisi yang menemukan nilai untuk perkara itu: pengisi otomatis tetap menang.
 *                   Isinya keputusan/penilaian majelis atau fakta persidangan yang tidak dicatat SIPP.
 *   ISIAN_OPSIONAL  kode -> label bahasa pengguna. Isian tambahan (bila ada) - bukan bagian "Perlu diisi"; layar memindahkannya
 *                   ke bagian tertutup "Isian tambahan (bila ada)".
 *
 * Berkas ini murni data (dibaca pula oleh skrip ukur scripts/isi-sipp-abt/ukur-isi-otomatis-20okt.cjs): dua objek literal
 * sederhana, tanpa ekspresi. Nama ABT tidak diubah; ini hanya tampilan.
 */

export const ISIAN_MANUAL: Record<string, string> = {
  // Keterangan saksi di sidang (tidak ada di SIPP maupun posita)
  "2557": "Jumlah kali saksi pertama melihat dan mendengar pertengkaran diambil dari keterangan saksi di sidang; tidak tercatat di SIPP.",
  "2558": "Jumlah kali saksi kedua melihat dan mendengar pertengkaran diambil dari keterangan saksi di sidang; tidak tercatat di SIPP.",
  // Penilaian majelis
  "7178": "Alasan panggilan dianggap tidak patut adalah penilaian majelis atas relaas panggilan; diisi hakim.",
  "8729": "Penilaian keterangan saksi dan fakta yang tidak terbukti adalah penilaian hakim; tidak dapat diisi otomatis.",
  "9501": "Penilaian jawaban dan bukti Tergugat/Termohon adalah penilaian hakim; tidak dapat diisi otomatis.",
  "9680": "Alasan Tergugat/Termohon tidak menyetujui pencabutan disampaikan di sidang; tidak tercatat di SIPP.",
  "9682": "Fakta atau alasan perkara di luar kewenangan adalah pertimbangan majelis; diisi hakim.",
  "9684": "Fakta atau alasan perkara termasuk kewenangan pengadilan agama adalah pertimbangan majelis; diisi hakim.",
  "9685": "Pokok eksepsi Tergugat/Termohon dibaca dari jawaban yang diucapkan atau diunggah; belum ada jawaban yang dapat dibaca.",
  "9683": "Pihak yang masih terikat perkawinan lain, dan dengan siapa, adalah pertimbangan majelis; diisi hakim.",
  "9772": "Rukun atau syarat nikah yang tidak terbukti adalah penilaian majelis; diisi hakim.",
  "9687": "Penilaian alasan mendesak atau kesulitan yang sah adalah penilaian majelis; diisi hakim bila alasan mendesak terbukti.",
  "8901": "Butir amar kesepakatan perdamaian sebagian disusun majelis dari kesepakatan para pihak.",
  // Surat panitera yang belum dicatat terstruktur
  "8712": "Surat teguran panjar belum dicatat terstruktur di SIPP; ketik nomor dan tanggal dari surat panitera.",
  "8713": "Batas waktu menambah panjar tertulis di surat teguran panitera; tidak ada di SIPP.",
  "8714": "Laporan panitera bahwa panjar tidak ditambah belum dicatat terstruktur di SIPP; ketik nomor dan tanggal dari suratnya.",
  // Fakta yang tidak tertulis di posita (isian terisi otomatis bila posita menyebutnya; selain itu diisi dari saksi/bukti)
  "1267": "Posita tidak menyebut apakah para pihak masih berkomunikasi; isi dari keterangan saksi di sidang.",
  "7035": "Posita tidak menyebut jelas siapa yang meninggalkan rumah bersama; isi dari keterangan saksi di sidang.",
  "8503": "Huruf alasan perceraian ditentukan hakim dari dalil dan keterangan saksi; posita belum menyebut alasan yang cukup jelas.",
  "0222": "Posita tidak menyebut kapan perselisihan dimulai; isi dari keterangan saksi di sidang.",
  "0246": "Posita tidak menyebut sejak kapan pisah rumah; isi dari keterangan saksi di sidang.",
  "9944": "Posita tidak menyebut lama pisah rumah; isi dari keterangan saksi di sidang.",
  "1268": "Posita tidak menyebut upaya damai oleh keluarga; isi dari keterangan saksi di sidang.",
  "5127": "Posita tidak menyebut sebab perselisihan yang dapat dirangkai; isi dari keterangan saksi dan pilih bunyi alasan cerai.",
  "8433": "Alasan pencabutan perkara disampaikan Penggugat/Pemohon di sidang atau dalam surat pencabutan; SIPP hanya mencatat hasil mediasi dan tanggal cabut.",
  "8899": "Pokok kesepakatan perdamaian sebagian hanya ada bila mediasi berhasil sebagian; dibaca dari isi kesepakatan di tab Mediasi SIPP.",
  "8902": "Isi pasal kesepakatan perdamaian sebagian hanya ada bila mediasi berhasil sebagian; bila dikosongkan, diambil dari tab Mediasi SIPP.",
  "1183": "Batas waktu ikrar talak dihitung 6 bulan sejak penetapan hari sidang ikrar; belum ada penetapan hari sidang ikrar di SIPP.",
  "0709": "Hubungan dengan anak diisi bila perkara menyangkut hak asuh anak; perkara ini tidak punya anak di tab Anak SIPP.",
  "0711": "Hubungan dengan anak diisi bila perkara menyangkut hak asuh anak; perkara ini tidak punya anak di tab Anak SIPP.",
  "8603": "Nama anak yang dimohonkan tidak ada di tab Anak SIPP; isi dari petitum atau posita.",
  "9050": "Kenaikan nafkah anak per tahun diisi bila petitum menuntutnya; belum tertulis di petitum.",
  "9711": "Nafkah madliyah hanya bila Penggugat menuntutnya; jumlah yang dikabulkan ditetapkan majelis (kosong bila tidak dikabulkan).",
  "9712": "Nafkah iddah hanya bila Penggugat menuntutnya; jumlah yang dikabulkan ditetapkan majelis (kosong bila tidak dikabulkan).",
  "9713": "Mut'ah hanya bila Penggugat menuntutnya; jumlah atau bentuk yang dikabulkan ditetapkan majelis (kosong bila tidak dikabulkan).",
  "9714": "Dasar kemampuan Tergugat dan kebutuhan hidup adalah pertimbangan majelis dari pekerjaan, penghasilan, dan standar biaya hidup setempat.",
  "9715": "Isi \"ya\" hanya bila posita dan petitum menuntut nafkah dibayar sebelum Tergugat mengambil akta cerai; belum tertulis.",
  // Itsbat nikah: fakta pernikahan yang tidak tertulis di posita
  "1001": "Mas kawin tidak disebut di posita; isi dari keterangan saksi, buku nikah, atau bukti yang diajukan.",
  "7211": "Umur Pemohon laki-laki saat menikah tidak tertulis di posita dan tanggal lahir atau tanggal nikah belum lengkap; hitung dari KTP dan tanggal nikah.",
  "7212": "Umur Pemohon perempuan saat menikah tidak tertulis di posita dan tanggal lahir atau tanggal nikah belum lengkap; hitung dari KTP dan tanggal nikah.",
  "5197": "Tanggal nikah tidak tertulis jelas di posita dan data pernikahan SIPP belum diisi; isi dari buku nikah atau keterangan saksi.",
  "5105": "Tempat menikah tidak tertulis di posita; isi dari keterangan saksi atau bukti.",
  "5178": "KUA wilayah tempat menikah tidak tertulis di posita; isi dari keterangan saksi atau bukti.",
  "1046": "Hubungan wali nikah tidak tertulis di posita; isi dari keterangan saksi atau bukti.",
  "1217": "Nama wali nikah tidak tertulis di posita; isi dari keterangan saksi atau bukti.",
  "8087": "Yang menikahkan tidak tertulis di posita; isi dari keterangan saksi atau bukti.",
  "0650": "Saksi nikah tidak tertulis di posita; isi dari keterangan saksi atau bukti.",
  "0651": "Saksi nikah tidak tertulis di posita; isi dari keterangan saksi atau bukti.",
  "9686": "Alasan pernikahan tidak dicatatkan tidak tertulis di posita; isi dari keterangan Pemohon dan saksi.",
  "0228": "Alasan syahadah istifadhah dipakai bila saksi tidak menyaksikan akad langsung; isi dari keterangan saksi di sidang.",
  "1021": "Nama istri pertama baru ada bila Pemohon pernah beristri sebelumnya; isi dari keterangan atau bukti akta cerai/kematian.",
  "1321": "Akta cerai suami dengan istri sebelumnya hanya bila Pemohon laki-laki duda cerai; ambil dari bukti akta cerai.",
  "1322": "Akta cerai suami dengan istri sebelumnya hanya bila Pemohon laki-laki duda cerai; ambil dari bukti akta cerai.",
  "1324": "Akta cerai suami dengan istri sebelumnya hanya bila Pemohon laki-laki duda cerai; ambil dari bukti akta cerai.",
  "1325": "Akta cerai istri dengan suami sebelumnya hanya bila Pemohon perempuan janda cerai; ambil dari bukti akta cerai.",
  "1329": "Akta cerai istri dengan suami sebelumnya hanya bila Pemohon perempuan janda cerai; ambil dari bukti akta cerai.",
  "1331": "Akta cerai istri dengan suami sebelumnya hanya bila Pemohon perempuan janda cerai; ambil dari bukti akta cerai.",
  "1513": "Suami yang meninggal hanya diisi bila Pemohon perempuan janda mati; ambil dari akta kematian atau posita.",
  "1514": "Tanggal suami meninggal hanya diisi bila Pemohon perempuan janda mati; ambil dari akta kematian atau posita.",
  "1515": "Sebab suami meninggal hanya diisi bila Pemohon perempuan janda mati; ambil dari akta kematian atau posita.",
  "5015": "Tanggal istri sebelumnya meninggal hanya diisi bila Pemohon laki-laki duda mati; ambil dari akta kematian atau posita.",
  "5016": "Sebab istri sebelumnya meninggal hanya diisi bila Pemohon laki-laki duda mati; ambil dari akta kematian atau posita.",
  "1025": "Nama almarhum/almarhumah pasangan hanya diisi bila pemohon tunggal karena pasangannya telah meninggal; ambil dari posita atau akta kematian.",
  "1246": "Tanggal meninggal pasangan hanya diisi pada itsbat dengan pasangan yang telah meninggal; ambil dari posita atau akta kematian.",
  "1247": "Sebab meninggal pasangan hanya diisi pada itsbat dengan pasangan yang telah meninggal; ambil dari posita atau akta kematian.",
  "1509": "Tempat meninggal pasangan hanya diisi pada itsbat dengan pasangan yang telah meninggal; ambil dari posita atau akta kematian.",
  "9169": "Pokok jawaban Tergugat pada itsbat kontensius: bawaan blangko \"membenarkan dan mengakui\"; ubah bila Tergugat membantah.",
  "9719": "Pencairan dana (jenis dana, lembaga, atas nama) hanya pada itsbat kontensius yang menyangkut pencairan dana; ambil dari bukti.",
  // Tuntutan accessoir: terisi dari petitum SIPP atau gugatan e-Court bila ada; selain itu diisi dari keterangan/bukti
  "6054": "Nafkah iddah hanya bila dituntut; belum tertulis di petitum SIPP maupun gugatan e-Court.",
  "6055": "Mut'ah hanya bila dituntut; belum tertulis di petitum SIPP maupun gugatan e-Court.",
  "7120": "Nafkah lampau (madliyah) hanya bila dituntut; belum tertulis di petitum SIPP maupun gugatan e-Court.",
  "6071": "Nafkah anak hanya bila dituntut; belum tertulis di petitum SIPP maupun gugatan e-Court.",
  "6072": "Nafkah tiap anak hanya bila dituntut; belum tertulis di petitum SIPP maupun gugatan e-Court.",
  "7778": "Isi 1 bila petitum menuntut hak asuh anak (hadhanah); belum tertulis di petitum.",
  "5110": "Nama anak tidak ada di tab Anak SIPP maupun gugatan; isi dari posita atau akta kelahiran.",
  "5111": "Umur anak tidak tertulis di posita; isi dari akta kelahiran atau keterangan para pihak.",
  "2004": "Siapa yang kini mengasuh anak tidak tertulis di posita; isi dari keterangan para pihak atau saksi.",
  "0007": "Jumlah anak tidak tertulis di posita dan tab Anak SIPP kosong; isi dari keterangan para pihak.",
  // Jawab-menjawab dan gugatan yang dibaca dari berkas e-Court (tanpa berkasnya tidak ada sumber di SIPP)
  "7084": "Isi 1 hanya bila jawaban memuat gugatan balik (rekonvensi); belum ada jawaban yang terbaca dari e-Court.",
  "8436": "Kesimpulan Penggugat/Pemohon dibaca dari berkas kesimpulan di e-Court; bila disampaikan lisan di sidang, ketik ringkasannya.",
  "8437": "Kesimpulan Tergugat/Termohon dibaca dari berkas kesimpulan di e-Court; bila disampaikan lisan di sidang, ketik ringkasannya.",
  "9881": "Jawaban lisan atau tertulis diketahui dari berkas jawaban di e-Court atau sidang jawab-menjawab; belum ada yang terbaca.",
  "9681": "Isi eksepsi kewenangan dibaca dari jawaban Tergugat/Termohon; belum ada jawaban yang terbaca.",
  "5171": "Penghasilan Penggugat/Pemohon dibaca dari gugatan e-Court; bila tidak tertulis, isi dari keterangan atau bukti.",
  "5271": "Penghasilan Tergugat/Termohon dibaca dari gugatan e-Court; bila tidak tertulis, isi dari keterangan atau bukti.",
  // Tanggal KTP dibaca dari berkas KTP e-Court; tanpa berkas itu tidak ada sumber di SIPP
  "0364": "Tanggal KTP dibaca dari berkas KTP di e-Court; bila perkara tidak lewat e-Court atau berkasnya tidak terbaca, isi dari KTP.",
  "0365": "Tanggal KTP dibaca dari berkas KTP di e-Court; bila perkara tidak lewat e-Court atau berkasnya tidak terbaca, isi dari KTP.",
  "0366": "Tanggal KTP dibaca dari berkas KTP di e-Court; bila perkara tidak lewat e-Court atau berkasnya tidak terbaca, isi dari KTP.",
  "2222": "Tanggal KTP dibaca dari berkas KTP di e-Court; bila perkara tidak lewat e-Court atau berkasnya tidak terbaca, isi dari KTP.",
  // U2 20 Okt: keputusan majelis atas tuntutan akibat perceraian - pilihan hakim, tidak diputus mesin (4102 dan 4103 ada di ISIAN_OPSIONAL: tidak boleh di kedua daftar)
  "4100": "Keputusan atas tuntutan hak asuh anak adalah putusan majelis; pilih dikabulkan, dikabulkan sebagian, ditolak, tidak dapat diterima, atau ex officio.",
  "4101": "Keputusan atas tuntutan nafkah anak adalah putusan majelis; pilih dikabulkan, dikabulkan sebagian, ditolak, tidak dapat diterima, atau ex officio.",
  "4104": "Keputusan atas nafkah lampau (madliyah) adalah putusan majelis; pilih dikabulkan, dikabulkan sebagian, ditolak atau tidak dapat diterima.",
  "4105": "Keputusan atas tuntutan harta bersama adalah putusan majelis; pilih dikabulkan, dikabulkan sebagian, ditolak atau tidak dapat diterima.",
  "4107": "Dasar kemampuan pemberi nafkah adalah penilaian majelis atas pekerjaan dan penghasilan; kosong berarti pekerjaan di SIPP dipakai.",
  "4108": "Pendapat anak mumayyiz didengar majelis di persidangan; tidak tercatat di SIPP.",
  // W2a 21 Okt: harta bersama, kewarisan, ekonomi syariah - keputusan majelis per tuntutan (pilihan hakim, tidak diputus mesin)
  "4782": "Bagian masing-masing pihak atas harta bersama adalah putusan majelis; kosong berarti seperdua, bila petitum menyebut bagian lain majelis wajib memutuskan.",
  "4783": "Keputusan atas permohonan sita jaminan adalah putusan majelis; pilih sah dan berharga atau ditolak.",
  "4784": "Keputusan atas tuntutan uang paksa adalah putusan majelis; pilih ditolak atau dikabulkan beserta jumlahnya.",
  "4785": "Keputusan atas tuntutan putusan serta merta adalah putusan majelis; pilih ditolak atau dikabulkan beserta alasannya.",
  "4787": "Sikap Tergugat atas tiap objek berasal dari jawaban, replik dan duplik; tidak tercatat di SIPP.",
  "4842": "Keputusan atas tuntutan denda, ganti rugi atau ta'widh adalah putusan majelis; pilih dikabulkan atau ditolak.",
  "4843": "Keputusan atas tuntutan penyelesaian jaminan atau agunan adalah putusan majelis; pilih dikabulkan atau ditolak.",
  "4844": "Keputusan atas tuntutan pembatalan akad adalah putusan majelis; pilih dikabulkan atau ditolak.",
  // Fakta sidang ikrar
  "9220": "Keadaan Termohon saat ikrar (suci, haid, atau hamil) disampaikan Termohon di sidang ikrar; tidak tercatat di SIPP.",
  // Itsbat nikah dan asal usul anak (paket abt-u3-itsbat-aua, 20 Okt 2026): pilihan majelis yang wajib dipilih pada blangko varian itu
  "4311": "Nama laki-laki yang diakui sebagai ayah biologis anak tidak tertulis di posita; isi dari keterangan Pemohon dan saksi (blangko Anak Luar Perkawinan).",
  "4314": "Hubungan perdata anak luar perkawinan adalah pilihan majelis; pilih salah satu pada blangko Anak Luar Perkawinan.",
  "4315": "Status anak yang lahir kurang dari enam bulan setelah akad adalah pilihan majelis; pilih salah satu pada blangko Anak Lahir Kurang dari Enam Bulan.",
};

export const ISIAN_OPSIONAL: Record<string, string> = {
  // #9134# = petunjuk perbaikan permohonan dari majelis pada BAS permohonan (keputusan pengguna 20 Okt: bukan bagian "Perlu diisi").
  "9134": "Petunjuk perbaikan permohonan (bila majelis memberi petunjuk)",
  // Itsbat nikah dan asal usul anak (paket abt-u3-itsbat-aua, 20 Okt 2026): pilihan majelis bernilai bawaan atau isian khusus keadaan tertentu
  "4300": "Dasar itsbat nikah menurut Pasal 7 ayat (3) KHI (pilihan majelis; kosong = huruf d bila nikah sebelum 1974, selain itu huruf e)",
  "4301": "Keraguan atas syarat perkawinan (hanya bila dasar itsbat huruf c)",
  "4302": "Keterangan hilangnya akta nikah (hanya bila dasar itsbat huruf b)",
  "4305": "Kedudukan hukum Pemohon menurut Pasal 7 ayat (4) KHI (kosong = suami atau istri)",
  "4310": "Nomor dan tanggal penetapan itsbat nikah orang tua anak (bila pernikahan siri sudah diitsbatkan)",
  // U2 20 Okt: keputusan nafkah iddah dan mut'ah (ex officio) serta waktu pembayaran: ada pada sebagian kecil perkara
  "4102": "Keputusan nafkah iddah (bila ada tuntutan atau diberikan ex officio)",
  "4103": "Keputusan mut'ah (bila ada tuntutan atau diberikan ex officio)",
  "4109": "Waktu pembayaran akibat cerai (bila ada nafkah iddah, mut'ah atau nafkah lampau)",
  // W2a 21 Okt: isian pilihan majelis yang boleh kosong (kosong = bunyi lama blangko)
  "4780": "Keputusan atas tuntutan penetapan dan pembagian harta bersama (kosong = seluruhnya bila semua objek terbukti)",
  "4781": "Objek yang tidak terbukti sebagai harta bersama (kosong = semua objek terbukti)",
  "4786": "Utang bersama para pihak (kosong = tidak ada utang bersama)",
  "4815": "Keputusan atas tuntutan penetapan (kosong = bunyi lama blangko: kewarisan dan ekonomi syariah sebagian, wasiat, hibah dan wakaf seluruhnya)",
  "4816": "Objek yang tidak terbukti sebagai harta peninggalan (kosong = semua objek terbukti)",
  "4817": "Pihak yang menguasai harta peninggalan (kosong = Tergugat)",
  "4818": "Harta bersama pewaris dengan pasangannya (kosong = tidak ada)",
  "4819": "Utang, wasiat dan biaya pengurusan jenazah pewaris (kosong = tidak ada)",
};
