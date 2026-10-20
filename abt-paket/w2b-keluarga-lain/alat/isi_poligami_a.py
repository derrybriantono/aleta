# -*- coding: utf-8 -*-
"""Butir izin poligami bagian A: riwayat pernikahan dan alasan (huruf a, b, c). Agen W2b-A."""
from isi_poligami import S

# ------------------------------------------------------------------ riwayat pernikahan (urutan 31-39)
S(id='lama-nikah', pokok='pp-pg-riwayat', urut_abs=31, tingkat='pilihan',
  teks='Sejak kapan {PAS} menikah dan sudah berapa lama mereka berumah tangga?',
  varian=['Kapan {PAS} menikah dan berapa lama usia rumah tangga mereka sekarang?'],
  hal='waktu dan lamanya pernikahan {PAS}', m='waktu dan lamanya pernikahan {PAS}', fam='tahu',
  K=(['{PAS} menikah pada #5197# dan hingga sekarang sudah berumah tangga selama #7777#',
      '{PAS} dinikahkan pada #5197# sehingga usia pernikahan mereka kini #7777#'],
     ['pernikahan {PAS} dilangsungkan pada #5197# dan telah berjalan selama #7777#',
      'sejak menikah pada #5197# {PAS} telah menjalani rumah tangga selama #7777#']),
  A=['{PAS} menikah pada #5197# dan berumah tangga selama #7777#', 'pernikahan {PAS} berlangsung pada #5197# dan usianya sudah #7777#'],
  B=['pernikahan {PAS} menurut ingatan saya terjadi sekitar setahun lebih awal dari tanggal yang tercatat',
     '{PAS} sudah menikah lebih lama dari yang tertulis dalam buku nikah mereka'],
  beda_pada='waktu', beda_maksud='versi A: menikah pada tanggal yang tercatat; versi B: menikah lebih awal dari yang tercatat - berselisih pada WAKTU pernikahan')

S(id='tercatat', pokok='pp-pg-riwayat', urut_abs=32, tingkat='pilihan',
  teks='Apakah pernikahan {PAS} dicatat oleh Kantor Urusan Agama dan apakah mereka memegang buku nikah?',
  varian=['Apakah {PAS} memiliki buku nikah dari Kantor Urusan Agama?'],
  hal='pencatatan pernikahan {PAS} oleh Kantor Urusan Agama', m='pencatatan pernikahan {PAS}', fam='tahu',
  K=(['pernikahan {PAS} dicatat oleh Kantor Urusan Agama dan keduanya memegang buku nikah',
      '{PAS} menikah secara resmi di hadapan pegawai pencatat nikah dan masing-masing memegang buku nikah'],
     ['{PAS} memiliki buku nikah karena pernikahan mereka dicatat oleh Kantor Urusan Agama',
      'pernikahan {PAS} tercatat resmi pada Kantor Urusan Agama dan buku nikahnya dipegang oleh mereka berdua']),
  P=(['pernikahan {PAS} dicatat oleh Kantor Urusan Agama', '{PAS} memegang buku nikah'],
     ['{PAS} menikah secara resmi di hadapan pegawai pencatat nikah', 'pernikahan {PAS} tercatat pada Kantor Urusan Agama']))

S(id='anak-jumlah', pokok='pp-pg-riwayat', urut_abs=33, tingkat='pilihan',
  teks='Apakah dari pernikahan {PAS} sudah ada anak dan berapa orang jumlahnya?',
  varian=['Berapa orang anak yang lahir dari pernikahan {PAS}?'],
  hal='anak dari pernikahan {PAS}', m='anak dari pernikahan {PAS}', fam='tahu',
  K=(['{PAS} #8535# dari pernikahan mereka', 'dari pernikahan {PAS} lahir anak dan jumlahnya sesuai keterangan yaitu #8535#'],
     ['dalam pernikahannya {PAS} #8535#', 'anak {PAS} berjumlah sesuai keterangan bahwa mereka #8535#']),
  P=(['dari pernikahan {PAS} lahir anak', 'anak {PAS} memang sudah ada'],
     ['dalam pernikahannya {PAS} sudah punya anak', 'anak dari {PAS} sudah ada']))

S(id='anak-asuh', pokok='pp-pg-keluarga', urut_abs=34, tingkat='pilihan',
  teks='Dengan siapa anak-anak {PAS} sekarang tinggal dan siapa yang membiayai kebutuhan mereka?',
  varian=['Siapa yang mengasuh dan menanggung biaya hidup serta sekolah anak-anak {PAS} sekarang?'],
  hal='pengasuhan dan pembiayaan anak-anak {PAS}', m='pengasuhan dan pembiayaan anak {PAS}', fam='tahu',
  K=(['anak-anak {PAS} tinggal bersama ibunya dan seluruh biaya hidup serta sekolah mereka ditanggung oleh #0046#',
      'anak {PAS} diasuh oleh #0047# sedangkan biaya kebutuhan mereka dipenuhi oleh #0046#'],
     ['#0046# yang membiayai hidup dan sekolah anak-anaknya yang tinggal bersama #0047#',
      'kebutuhan anak-anak {PAS} dicukupi oleh #0046# dan mereka diasuh oleh ibunya']),
  A=['anak-anak {PAS} tinggal bersama #0047# dan biayanya ditanggung #0046#', 'anak {PAS} diasuh #0047# dengan biaya dari #0046#'],
  B=['anak-anak {PAS} sebagian tinggal bersama #0047# dan sebagian tinggal bersama neneknya', 'sebagian anak {PAS} diasuh oleh neneknya dengan biaya dari #0046#'],
  beda_pada='tempat', beda_maksud='versi A: seluruh anak tinggal bersama istri; versi B: sebagian tinggal bersama neneknya - berselisih pada TEMPAT tinggal anak')

S(id='tidak-cerai', pokok='pp-pg-riwayat', urut_abs=35, tingkat='pilihan',
  teks='Apakah #0046# tetap ingin mempertahankan rumah tangganya dengan #0047# dan tidak berniat menceraikannya?',
  varian=['Apakah rencana menikah lagi itu membuat #0046# hendak menceraikan #0047#?'],
  hal='niat #0046# mempertahankan rumah tangga dengan #0047#', m='niat #0046# mempertahankan rumah tangganya dengan #0047#', fam='tahu',
  K=(['#0046# tetap mempertahankan rumah tangganya dengan #0047# dan ia tidak pernah berniat menceraikannya',
      '#0046# ingin terus berumah tangga dengan #0047# serta tidak pernah mengatakan hendak menceraikannya'],
     ['rumah tangga #0046# dengan #0047# tetap ia pertahankan dan niat bercerai tidak pernah ia ucapkan',
      '#0046# berniat tetap bersama #0047# dan tidak pernah berencana menceraikannya']),
  M='K',
  P=(['#0046# tetap mempertahankan rumah tangganya dengan #0047#', '#0046# ingin terus berumah tangga dengan #0047#'],
     ['rumah tangga #0046# dengan #0047# tetap ia pertahankan', '#0046# berniat tetap bersama #0047#']))

S(id='kerukunan-kini', pokok='pp-pg-riwayat', urut_abs=36, tingkat='pilihan',
  teks='Bagaimana hubungan #0046# dan #0047# sehari-hari sekarang dan apakah mereka masih tinggal serumah?',
  varian=['Apakah #0046# dan #0047# masih hidup serumah dan bagaimana keadaan rumah tangga mereka sekarang?'],
  hal='keadaan hubungan dan tempat tinggal #0046# dan #0047# sekarang', m='hubungan dan tempat tinggal #0046# dan #0047# sekarang', fam='tahu',
  K=(['hubungan #0046# dan #0047# sehari-hari baik dan mereka masih tinggal serumah',
      '#0046# dan #0047# masih tinggal dalam satu rumah dan hubungan mereka berjalan baik'],
     ['#0046# dan #0047# masih serumah dan hubungan di antara mereka tetap baik',
      'rumah tangga #0046# dan #0047# berjalan baik dan mereka masih bersama dalam satu rumah']),
  keadaan={'rumahTanggaKini': 'serumah'},
  ragam=[dict(keadaan={'rumahTanggaKini': 'pisah-rumah'}, m='hubungan dan tempat tinggal #0046# dan #0047# yang sudah berpisah rumah', fam='tahu',
              K=(['#0046# dan #0047# sudah tinggal berpisah rumah tetapi hubungan keduanya tetap baik',
                  'sekarang #0046# dan #0047# tinggal di rumah yang berbeda namun masih saling berhubungan baik'],
                 ['#0046# dan #0047# tidak lagi serumah tetapi tetap berhubungan baik',
                  'keduanya sudah berpisah tempat tinggal dan hubungan mereka masih terjaga baik']))])

S(id='pertengkaran', pokok='pp-pg-riwayat', urut_abs=37, tingkat='tambahan',
  teks='Apakah pernah terjadi pertengkaran besar antara #0046# dan #0047# sejak #0046# menyampaikan rencana menikah lagi?',
  varian=['Apakah rencana #0046# menikah lagi pernah menimbulkan pertengkaran hebat antara #0046# dan #0047#?'],
  hal='pertengkaran #0046# dan #0047# karena rencana menikah lagi', m='ada tidaknya pertengkaran besar karena rencana menikah lagi', fam='tahu',
  K=(['sejak rencana itu disampaikan tidak pernah ada pertengkaran besar antara #0046# dan #0047#',
      'rencana #0046# menikah lagi tidak pernah menimbulkan pertengkaran hebat dengan #0047#'],
     ['setelah #0046# menyampaikan rencananya tidak ada pertengkaran besar di antara mereka',
      'tidak pernah ada percekcokan hebat antara #0046# dan #0047# gara-gara rencana itu']),
  A=['tidak ada pertengkaran besar antara #0046# dan #0047# karena rencana itu', 'rencana itu tidak menimbulkan pertengkaran hebat di antara mereka'],
  B=['sempat ada pertengkaran antara #0046# dan #0047# ketika rencana itu pertama kali disampaikan', 'saat rencana itu disampaikan terjadi adu mulut antara #0046# dan #0047#'],
  beda_pada='peristiwa', beda_maksud='versi A: tidak ada pertengkaran besar; versi B: sempat terjadi adu mulut saat rencana pertama disampaikan - berselisih pada PERISTIWA')

# ------------------------------------------------------------------ alasan huruf a: istri tidak dapat menjalankan kewajiban (urutan 61-64)
S(id='alasan-a-kewajiban', pokok='pp-pg-alasan-a', urut_abs=61, tingkat='inti', keadaan={'alasanPoligami': 'a'},
  teks='Kewajiban apa sebagai istri yang sudah tidak dapat dijalankan oleh #0047# terhadap #0046#?',
  varian=['Dalam hal apa #0047# tidak lagi dapat menjalankan kewajibannya sebagai istri terhadap #0046#?'],
  hal='kewajiban istri yang tidak dapat dijalankan #0047#', m='kewajiban istri yang tidak dapat dijalankan #0047#', fam='tahu',
  K=(['#0047# tidak dapat lagi menjalankan kewajibannya sebagai istri yaitu #1152#',
      '#0047# sudah tidak mampu melayani dan mengurus kebutuhan #0046# sebagaimana seorang istri karena #1152#'],
     ['kewajiban #0047# sebagai istri tidak lagi dapat ia jalankan sebab #1152#',
      'pelayanan #0047# kepada #0046# sebagai istri sudah tidak dapat berjalan karena #1152#']),
  M='K',
  A=['#0047# tidak dapat melayani #0046# sebagai istri karena #1152#', 'pelayanan #0047# kepada suami terhenti karena #1152#'],
  B=['#0047# masih melayani #0046# seperti biasa namun sering sakit-sakitan', '#0047# masih mengurus rumah tangga tetapi tenaganya sudah jauh berkurang'],
  beda_pada='peristiwa', beda_maksud='versi A: istri sama sekali tidak dapat menjalankan kewajiban; versi B: masih menjalankan dengan tenaga berkurang - berselisih pada PERISTIWA')

S(id='alasan-a-sejak', pokok='pp-pg-alasan-a', urut_abs=62, tingkat='pilihan', keadaan={'alasanPoligami': 'a'},
  teks='Sejak kapan #0047# tidak dapat lagi menjalankan kewajibannya dan apa penyebabnya?',
  varian=['Sudah berapa lama keadaan itu berlangsung pada #0047# dan apa sebabnya?'],
  hal='waktu dan sebab #0047# tidak dapat menjalankan kewajiban istri', m='waktu dan sebab #0047# tidak dapat menjalankan kewajiban istri', fam='tahu',
  K=(['keadaan itu sudah berlangsung cukup lama pada #0047# dan penyebabnya adalah #1152#',
      '#0047# sudah lama berada dalam keadaan itu dan sebabnya ialah #1152#'],
     ['sejak beberapa waktu yang lalu #0047# berada dalam keadaan itu dengan sebab #1152#',
      'keadaan #0047# itu telah berlangsung lama dan bermula dari #1152#']),
  P=(['keadaan itu sudah cukup lama dialami oleh #0047#', '#0047# sudah lama berada dalam keadaan itu'],
     ['sejak beberapa waktu yang lalu #0047# berada dalam keadaan itu', 'keadaan #0047# itu telah berlangsung lama']),
  A=['keadaan itu sudah berlangsung bertahun-tahun pada #0047#', '#0047# sudah bertahun-tahun berada dalam keadaan itu'],
  B=['keadaan itu baru berlangsung beberapa bulan terakhir pada #0047#', '#0047# baru beberapa bulan terakhir berada dalam keadaan itu'],
  beda_pada='lama', beda_maksud='versi A: sudah bertahun-tahun; versi B: baru beberapa bulan - berselisih pada LAMA keadaan')

S(id='alasan-a-nasihat', pokok='pp-pg-alasan-a', urut_abs=63, tingkat='tambahan', keadaan={'alasanPoligami': 'a'},
  teks='Apakah #0046# pernah menegur atau menasihati #0047# agar kewajibannya dijalankan kembali dan bagaimana tanggapannya?',
  varian=['Bagaimana tanggapan #0047# ketika #0046# menasihatinya agar kembali menjalankan kewajibannya?'],
  hal='teguran #0046# kepada #0047# dan tanggapannya', m='teguran dan nasihat #0046# kepada #0047# serta tanggapannya', fam='hadir',
  K=(['#0046# pernah menasihati #0047# dengan baik agar kewajibannya dijalankan namun keadaannya tetap sama',
      '#0046# sudah beberapa kali mengingatkan #0047# secara baik-baik dan tetap saja demikian'],
     ['nasihat #0046# kepada #0047# sudah diberikan berulang kali tetapi keadaan #0047# tetap seperti semula',
      'teguran #0046# kepada #0047# disampaikan dengan baik dan #0047# menerimanya tetapi hasilnya sama saja']),
  M='K')

# ------------------------------------------------------------------ alasan huruf b: cacat badan / penyakit tidak dapat disembuhkan (65-68)
S(id='alasan-b-penyakit', pokok='pp-pg-alasan-b', urut_abs=65, tingkat='inti', keadaan={'alasanPoligami': 'b'},
  teks='Penyakit atau cacat badan apa yang diderita #0047# dan sudah berapa lama?',
  varian=['Apa jenis penyakit atau cacat yang dialami #0047# dan sejak kapan?'],
  hal='penyakit atau cacat badan yang diderita #0047#', m='penyakit atau cacat badan yang diderita #0047#', fam='tahu',
  K=(['#0047# menderita penyakit atau cacat badan yaitu #1152# yang sudah lama dideritanya',
      '#0047# mengalami sakit yang berkepanjangan yakni #1152# dan keadaan itu sudah lama berlangsung'],
     ['sudah lama #0047# menderita penyakit yang disebut #1152#',
      'penyakit yang diderita #0047# adalah #1152# dan telah dialami dalam waktu yang lama']),
  M='K',
  A=['#0047# menderita penyakit menahun yaitu #1152#', 'penyakit #0047# berlangsung menahun yakni #1152#'],
  B=['#0047# hanya sakit biasa yang kambuh sesekali', 'penyakit #0047# tidak parah dan hanya kambuh sewaktu-waktu'],
  beda_pada='peristiwa', beda_maksud='versi A: penyakit menahun; versi B: hanya sakit biasa yang kambuh sesekali - berselisih pada PERISTIWA (keadaan sakit)')

S(id='alasan-b-berobat', pokok='pp-pg-alasan-b', urut_abs=66, tingkat='pilihan', keadaan={'alasanPoligami': 'b'},
  teks='Apakah #0047# sudah diperiksa atau berobat ke dokter dan apa kata dokter mengenai kemungkinan sembuhnya?',
  varian=['Bagaimana hasil pemeriksaan dokter atas penyakit #0047# dan apakah dinyatakan dapat disembuhkan?'],
  hal='pemeriksaan dokter atas penyakit #0047#', m='pemeriksaan dan pengobatan dokter atas penyakit #0047#', fam='tahu',
  K=(['#0047# sudah berulang kali berobat ke dokter dan menurut dokter penyakitnya tidak dapat disembuhkan',
      'pemeriksaan dokter atas #0047# sudah dijalani dan hasilnya penyakit itu tidak dapat disembuhkan'],
     ['#0047# telah berobat ke dokter dan dokter menyatakan penyakitnya tidak dapat disembuhkan',
      'setelah berkali-kali diperiksa dokter menyatakan penyakit #0047# tidak dapat sembuh']),
  P=(['#0047# sudah berobat ke dokter', 'pemeriksaan dokter atas #0047# sudah dijalani'],
     ['#0047# telah berobat ke dokter', 'berkali-kali #0047# diperiksa dokter']))

S(id='alasan-b-biaya', pokok='pp-pg-alasan-b', urut_abs=67, tingkat='tambahan', keadaan={'alasanPoligami': 'b'},
  teks='Siapa yang menanggung biaya pengobatan #0047# dan apakah #0046# tetap merawatnya?',
  varian=['Apakah #0046# yang membiayai dan merawat #0047# selama sakit?'],
  hal='biaya pengobatan dan perawatan #0047#', m='biaya pengobatan dan perawatan #0047# selama sakit', fam='tahu',
  K=(['biaya pengobatan #0047# ditanggung oleh #0046# dan ia tetap merawat #0047# dengan baik',
      '#0046# yang membiayai pengobatan #0047# serta tetap merawatnya sampai sekarang'],
     ['#0046# menanggung seluruh biaya berobat #0047# dan tetap memperhatikan perawatannya',
      'selama #0047# sakit #0046# yang mengeluarkan biaya pengobatan dan merawatnya']),
  A=['biaya pengobatan #0047# ditanggung #0046# sendiri', '#0046# sendiri yang membiayai pengobatan #0047#'],
  B=['biaya pengobatan #0047# ditanggung bersama oleh keluarga kedua pihak', 'keluarga kedua pihak ikut patungan membiayai pengobatan #0047#'],
  beda_pada='pelaku', beda_maksud='versi A: biaya ditanggung #0046# sendiri; versi B: ditanggung bersama keluarga - berselisih pada PELAKU yang membiayai')

# ------------------------------------------------------------------ alasan huruf c: tidak dapat melahirkan keturunan (69-72)
S(id='alasan-c-keturunan', pokok='pp-pg-alasan-c', urut_abs=68, tingkat='inti', keadaan={'alasanPoligami': 'c'},
  teks='Apakah selama menikah #0047# belum atau tidak dapat melahirkan keturunan bagi #0046#?',
  varian=['Apakah #0047# belum dapat memberikan keturunan bagi #0046# sepanjang pernikahan mereka?'],
  hal='keturunan dari pernikahan #0046# dan #0047#', m='tidak adanya keturunan dari pernikahan #0046# dan #0047#', fam='tahu',
  K=(['selama menikah #0047# tidak dapat melahirkan keturunan bagi #0046# padahal pernikahan mereka sudah #7777#',
      'pernikahan #0046# dan #0047# yang sudah #7777# tidak membuahkan keturunan dari #0047#'],
     ['#0047# tidak dapat melahirkan keturunan untuk #0046# meskipun mereka telah menikah selama #7777#',
      'dalam pernikahan selama #7777# #0047# tidak dapat melahirkan anak bagi #0046#']),
  M='K',
  A=['#0047# tidak dapat melahirkan keturunan selama pernikahan mereka', 'pernikahan mereka tidak membuahkan keturunan dari #0047#'],
  B=['#0047# pernah hamil tetapi keguguran sehingga belum memiliki keturunan', 'kehamilan #0047# pernah terjadi namun gugur sebelum waktunya'],
  beda_pada='peristiwa', beda_maksud='versi A: tidak pernah hamil; versi B: pernah hamil lalu keguguran - berselisih pada PERISTIWA')

S(id='alasan-c-periksa', pokok='pp-pg-alasan-c', urut_abs=69, tingkat='pilihan', keadaan={'alasanPoligami': 'c'},
  teks='Apakah #0047# sudah diperiksakan ke dokter dan apa hasilnya?',
  varian=['Bagaimana hasil pemeriksaan dokter mengenai kemampuan #0047# untuk hamil dan melahirkan?'],
  hal='pemeriksaan dokter atas kemampuan #0047# melahirkan', m='pemeriksaan dokter atas kemampuan #0047# melahirkan', fam='tahu',
  K=(['#0047# sudah diperiksakan ke dokter dan hasilnya #0047# tidak dapat melahirkan keturunan',
      'pemeriksaan dokter atas #0047# telah dilakukan dan dinyatakan #0047# tidak dapat hamil dan melahirkan'],
     ['dokter telah memeriksa #0047# dengan hasil #0047# tidak dapat melahirkan keturunan',
      '#0047# sudah menjalani pemeriksaan medis dan dokter menyatakan ia tidak dapat hamil dan melahirkan']),
  P=(['#0047# sudah diperiksakan ke dokter', 'pemeriksaan dokter atas #0047# telah dilakukan'],
     ['dokter telah memeriksa #0047#', '#0047# sudah menjalani pemeriksaan medis']))

S(id='alasan-c-upaya', pokok='pp-pg-alasan-c', urut_abs=71, tingkat='tambahan', keadaan={'alasanPoligami': 'c'},
  teks='Upaya apa saja yang sudah ditempuh #0046# dan #0047# agar memperoleh keturunan?',
  varian=['Apakah #0046# dan #0047# sudah berusaha berobat atau menjalani program kehamilan untuk memperoleh keturunan?'],
  hal='upaya #0046# dan #0047# memperoleh keturunan', m='upaya #0046# dan #0047# memperoleh keturunan', fam='tahu',
  K=(['#0046# dan #0047# sudah berusaha berobat ke dokter dan menjalani pengobatan agar memperoleh keturunan',
      'berbagai upaya pengobatan telah ditempuh #0046# dan #0047# supaya mendapat keturunan'],
     ['upaya memperoleh keturunan sudah dilakukan #0046# dan #0047# dengan berobat secara medis dan tradisional',
      '#0046# dan #0047# telah mencoba pengobatan secara medis maupun tradisional demi mendapatkan keturunan']),
  A=['#0046# dan #0047# sudah berobat ke dokter selama bertahun-tahun', 'pengobatan ke dokter dijalani #0046# dan #0047# bertahun-tahun'],
  B=['#0046# dan #0047# baru berobat ke dokter dalam beberapa bulan terakhir', 'pengobatan ke dokter baru dijalani #0046# dan #0047# beberapa bulan terakhir'],
  beda_pada='lama', beda_maksud='versi A: berobat bertahun-tahun; versi B: baru beberapa bulan - berselisih pada LAMA upaya pengobatan')

S(id='alasan-c-pengganti', pokok='pp-pg-alasan-c', urut_abs=72, tingkat='tambahan', keadaan={'alasanPoligami': 'c'},
  teks='Apakah #0046# dan #0047# pernah membicarakan cara lain untuk memperoleh keturunan sebelum #0046# berencana menikah lagi?',
  varian=['Apakah sebelum #0046# berencana poligami ada pembicaraan #0046# dan #0047# tentang cara lain memperoleh keturunan?'],
  hal='pembicaraan #0046# dan #0047# tentang cara lain memperoleh keturunan', m='pembicaraan #0046# dan #0047# tentang cara lain memperoleh keturunan', fam='tahu',
  K=(['#0046# dan #0047# pernah membicarakan cara lain untuk memperoleh keturunan sebelum rencana menikah lagi muncul',
      'sebelum rencana poligami itu ada #0046# dan #0047# sudah membahas jalan lain agar mendapat keturunan'],
     ['pembicaraan tentang cara lain memperoleh keturunan pernah dilakukan #0046# dan #0047# lebih dulu',
      '#0046# dan #0047# lebih dahulu berembuk mengenai cara lain mendapatkan keturunan']),
  M='K')

# ------------------------------------------------------------------ alasan umum (urutan 73-76)
S(id='alasan-diketahui-istri', pokok='pp-alasan', urut_abs=73, tingkat='pilihan',
  teks='Apakah #0047# mengetahui alasan #0046# ingin menikah lagi dan bagaimana saksi mengetahui hal itu?',
  varian=['Apakah alasan #0046# ingin menikah lagi sudah diketahui oleh #0047#?'],
  hal='pengetahuan #0047# atas alasan #0046# menikah lagi', m='pengetahuan #0047# atas alasan #0046# menikah lagi', fam='tahu',
  K=(['#0047# mengetahui alasan #0046# ingin menikah lagi karena #0046# sendiri yang menyampaikannya kepadanya',
      'alasan #0046# ingin menikah lagi sudah diketahui oleh #0047# sebab #0046# menjelaskannya langsung kepada #0047#'],
     ['#0046# sudah menerangkan alasan menikah lagi kepada #0047# sehingga #0047# mengetahuinya',
      '#0047# tahu alasan #0046# hendak menikah lagi karena #0046# menjelaskannya kepadanya']),
  M='K')

S(id='alasan-sejak-rencana', pokok='pp-alasan', urut_abs=74, tingkat='pilihan',
  teks='Sejak kapan #0046# berencana menikah lagi dan kepada siapa ia pertama kali menyampaikan rencana itu?',
  varian=['Kapan #0046# mulai berniat menikah lagi dan siapa yang pertama kali mengetahuinya?'],
  hal='waktu rencana #0046# menikah lagi dan orang yang pertama mengetahuinya', m='waktu rencana #0046# menikah lagi dan orang yang pertama mengetahuinya', fam='tahu',
  K=(['rencana menikah lagi itu sudah #0046# pikirkan cukup lama dan yang pertama ia beri tahu adalah #0047#',
      '#0046# sudah lama berniat menikah lagi dan #0047# adalah orang pertama yang ia ajak bicara'],
     ['#0046# merencanakan hal itu sejak beberapa waktu lalu dan #0047# yang pertama ia beritahu',
      'niat #0046# untuk menikah lagi sudah ada cukup lama dan ia sampaikan lebih dulu kepada #0047#']),
  P=(['rencana menikah lagi itu sudah #0046# pikirkan cukup lama', '#0046# sudah lama berniat menikah lagi'],
     ['#0046# merencanakan hal itu sejak beberapa waktu lalu', 'niat #0046# untuk menikah lagi sudah ada cukup lama']))

S(id='alasan-bukan-nafsu', pokok='pp-alasan', urut_abs=75, tingkat='tambahan',
  teks='Apakah saksi mengetahui alasan lain di luar yang dikemukakan #0046# di pengadilan, misalnya karena ada orang yang menghasut atau semata-mata mengikuti hawa nafsu?',
  varian=['Apakah menurut yang saksi ketahui rencana #0046# menikah lagi didorong alasan lain di luar alasan yang disampaikannya?'],
  hal='ada tidaknya alasan lain di luar alasan yang dikemukakan #0046#', m='ada tidaknya alasan lain di luar alasan yang dikemukakan #0046#', fam='tahu',
  K=(['tidak ada alasan lain selain #1152# dan tidak ada orang yang menghasut #0046#',
      'alasan lain selain #1152# tidak ada dan tidak ada yang menyuruh #0046# menikah lagi'],
     ['setahu saya selain #1152# tidak ada alasan lain dan tidak ada pihak yang mendorong #0046#',
      'tidak ada alasan di luar #1152# dan tidak ada orang yang membujuk #0046# untuk menikah lagi']),
  P=(['#0046# menyampaikan alasan menikah lagi yaitu #1152#', 'alasan yang disampaikan #0046# untuk menikah lagi adalah #1152#'],
     ['alasan menikah lagi yang diungkapkan #0046# ialah #1152#', 'sebab yang dikemukakan #0046# bagi niatnya menikah lagi adalah #1152#']))
