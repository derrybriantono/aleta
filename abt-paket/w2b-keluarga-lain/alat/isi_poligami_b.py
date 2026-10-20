# -*- coding: utf-8 -*-
"""Butir izin poligami bagian B: persetujuan istri (setuju, keberatan, tidak mungkin dimintai persetujuan) dan Termohon tidak hadir. Agen W2b-A."""
from isi_poligami import S

SETUJU = {'sikapIstri': 'setuju'}

# ------------------------------------------------------------------ istri setuju (urutan 81-87)
S(id='setuju-tertulis', pokok='pp-persetujuan-istri', urut_abs=81, tingkat='inti', keadaan=SETUJU,
  teks='Apakah #0047# membuat surat pernyataan persetujuan tertulis agar #0046# menikah lagi dan apakah ia menandatanganinya sendiri?',
  varian=['Apakah ada surat persetujuan tertulis dari #0047# yang ditandatangani sendiri olehnya untuk rencana #0046# menikah lagi?'],
  hal='surat persetujuan tertulis #0047#', m='surat persetujuan tertulis #0047# atas rencana #0046# menikah lagi', fam='hadir',
  K=(['#0047# membuat surat pernyataan persetujuan tertulis dan menandatanganinya sendiri agar #0046# menikah lagi',
      'surat persetujuan agar #0046# menikah lagi ditulis dan ditandatangani sendiri oleh #0047#'],
     ['#0047# menandatangani sendiri surat pernyataan yang menyatakan ia menyetujui #0046# menikah lagi',
      'persetujuan #0047# atas rencana #0046# dituangkan dalam surat yang ia tandatangani sendiri']),
  P=(['#0047# membuat surat pernyataan persetujuan agar #0046# menikah lagi', 'surat persetujuan #0047# atas rencana #0046# menikah lagi memang ada'],
     ['#0047# menandatangani surat yang menyatakan ia menyetujui #0046# menikah lagi', 'persetujuan #0047# dituangkan dalam sebuah surat']),
  A=['#0047# menandatangani sendiri surat persetujuan itu', 'surat persetujuan itu ditandatangani langsung oleh #0047#'],
  B=['surat persetujuan itu ditulis oleh #0046# dan #0047# hanya membubuhkan tanda tangan', 'isi surat persetujuan itu diketik #0046# lalu #0047# yang menandatanganinya'],
  beda_pada='pelaku', beda_maksud='versi A: surat ditandatangani sendiri oleh istri; versi B: surat dibuat suami lalu istri hanya menandatangani - berselisih pada PELAKU pembuat surat')

S(id='setuju-keluarga-hadir', pokok='pp-persetujuan-istri', urut_abs=82, tingkat='pilihan', keadaan=SETUJU,
  teks='Apakah #0047# pernah menyatakan persetujuannya di hadapan keluarga atau orang lain dan siapa yang hadir pada waktu itu?',
  varian=['Siapa saja yang menyaksikan ketika #0047# menyatakan persetujuannya agar suaminya menikah lagi?'],
  hal='pernyataan persetujuan #0047# di hadapan keluarga', m='pernyataan persetujuan #0047# di hadapan keluarga', fam='hadir',
  K=(['#0047# menyatakan persetujuannya di hadapan keluarga kedua belah pihak yang hadir pada pertemuan itu',
      'ketika keluarga berkumpul #0047# menyatakan rela #0046# menikah lagi di depan mereka semua'],
     ['pertemuan keluarga dihadiri kerabat kedua pihak dan di sanalah #0047# menyatakan persetujuannya',
      'di depan keluarga yang berkumpul #0047# mengatakan ia setuju #0046# menikah lagi']),
  M='K',
  A=['persetujuan #0047# dinyatakan di depan keluarga kedua belah pihak', '#0047# menyatakan setuju di hadapan keluarga kedua pihak'],
  B=['persetujuan #0047# dinyatakan hanya kepada #0046# di dalam rumah', '#0047# menyatakan setuju hanya di hadapan #0046# di rumah mereka'],
  beda_pada='tempat', beda_maksud='versi A: persetujuan dinyatakan di depan keluarga; versi B: hanya kepada suami di dalam rumah - berselisih pada TEMPAT/kehadiran orang')

S(id='setuju-sukarela', pokok='pp-persetujuan-istri', urut_abs=83, tingkat='inti', keadaan=SETUJU,
  teks='Apakah persetujuan #0047# diberikan dengan sukarela tanpa paksaan, ancaman atau imbalan dari #0046# maupun orang lain?',
  varian=['Apakah #0047# menyetujui rencana #0046# atas kemauannya sendiri dan bukan karena dipaksa atau diancam?'],
  hal='kesukarelaan persetujuan #0047#', m='kesukarelaan persetujuan #0047#', fam='tahu',
  K=(['#0047# menyetujui rencana itu dengan sukarela dan tidak ada paksaan atau ancaman dari siapa pun',
      'persetujuan #0047# lahir dari kemauannya sendiri dan tidak ada tekanan dari #0046# maupun orang lain'],
     ['tidak ada paksaan dalam persetujuan #0047# karena ia memberikannya atas kehendaknya sendiri',
      '#0047# memberikan persetujuan itu atas kemauan sendiri tanpa ancaman maupun imbalan']),
  M='K',
  P=(['#0047# menyetujui rencana itu atas kemauannya sendiri', 'persetujuan #0047# lahir dari kemauannya sendiri'],
     ['#0047# memberikan persetujuan itu dengan sukarela', 'persetujuan itu diberikan #0047# atas kehendaknya sendiri']))

S(id='setuju-paham', pokok='pp-persetujuan-istri', urut_abs=84, tingkat='pilihan', keadaan=SETUJU,
  teks='Apakah #0047# memahami bahwa dengan menyetujui #0046# menikah lagi ia akan berbagi nafkah dan perhatian dengan istri kedua?',
  varian=['Apakah #0047# sudah mengerti akibatnya bila #0046# beristri dua yaitu berbagi nafkah waktu dan perhatian?'],
  hal='pemahaman #0047# atas akibat suami beristri dua', m='pemahaman #0047# atas akibat suami beristri dua', fam='tahu',
  K=(['#0047# memahami bahwa nafkah waktu dan perhatian #0046# nanti dibagi dengan istri kedua dan ia tetap menyetujuinya',
      '#0047# sadar sepenuhnya bahwa ia akan berbagi nafkah dan perhatian dengan istri kedua #0046#'],
     ['sudah dipahami #0047# bahwa dengan adanya istri kedua nafkah dan perhatian #0046# akan terbagi',
      '#0047# mengerti bahwa bila #0046# beristri dua maka nafkah dan waktunya dibagi dan ia menerimanya']),
  M='K')

S(id='setuju-pembicaraan', pokok='pp-persetujuan-istri', urut_abs=85, tingkat='pilihan', keadaan=SETUJU,
  teks='Kapan dan di mana #0046# meminta persetujuan #0047# untuk menikah lagi dan bagaimana tanggapan #0047# waktu itu?',
  varian=['Bagaimana tanggapan #0047# ketika #0046# pertama kali meminta persetujuan #0047# agar ia boleh menikah lagi?'],
  hal='waktu dan tanggapan #0047# saat #0046# meminta persetujuan', m='waktu dan tanggapan #0047# saat #0046# meminta persetujuan menikah lagi', fam='hadir',
  K=(['#0046# meminta persetujuan #0047# di rumah mereka dan #0047# menanggapinya dengan menyatakan rela',
      'di rumah mereka #0046# menyampaikan rencananya kepada #0047# dan #0047# menjawab bahwa ia rela'],
     ['permintaan persetujuan #0046# kepada #0047# disampaikan di rumah dan dijawab dengan kerelaan #0047#',
      'waktu #0046# meminta persetujuan di rumah #0047# langsung menjawab bahwa ia rela']),
  M='K',
  A=['#0046# meminta persetujuan #0047# secara langsung di rumah dan #0047# langsung menjawab rela', 'di rumah #0046# meminta restu #0047# yang langsung menjawab rela'],
  B=['#0047# tidak langsung menjawab dan baru menyatakan rela beberapa hari kemudian', 'jawaban rela #0047# baru disampaikan beberapa hari setelah #0046# meminta restunya'],
  beda_pada='waktu', beda_maksud='versi A: istri langsung menjawab rela; versi B: istri baru menjawab beberapa hari kemudian - berselisih pada WAKTU jawaban')

S(id='setuju-kenal-calon', pokok='pp-persetujuan-istri', urut_abs=86, tingkat='tambahan', keadaan=SETUJU,
  teks='Apakah #0047# mengenal calon istri kedua #8723# dan bagaimana sikapnya terhadap calon istri itu?',
  varian=['Apakah #0047# pernah bertemu atau mengenal #8723# dan bagaimana tanggapannya?'],
  hal='perkenalan dan sikap #0047# terhadap calon istri kedua', m='perkenalan dan sikap #0047# terhadap calon istri kedua', fam='tahu',
  K=(['#0047# mengenal #8723# dan menerimanya sebagai calon madunya dengan baik',
      '#0047# sudah mengenal #8723# serta dengan senang hati menerimanya sebagai madu'],
     ['#8723# dikenal baik oleh #0047# dan ia menerimanya sebagai calon madu',
      'perkenalan #0047# dengan #8723# berjalan baik sehingga ia bersedia memadu']),
  P=(['#0047# mengenal #8723# yang akan menjadi calon madunya', '#0047# sudah mengenal #8723#'],
     ['#8723# dikenal oleh #0047# sebagai calon madunya', 'perkenalan #0047# dengan #8723# sudah ada']))

S(id='setuju-keluarga-sikap', pokok='pp-pg-keluarga', urut_abs=87, tingkat='tambahan', keadaan=SETUJU,
  teks='Bagaimana sikap keluarga besar #0046# dan #0047# serta anak-anak mereka terhadap rencana #0046# menikah lagi?',
  varian=['Apakah keluarga dan anak-anak #0046# dan #0047# mengetahui serta menyetujui rencana #0046# menikah lagi?'],
  hal='sikap keluarga dan anak-anak atas rencana #0046# menikah lagi', m='sikap keluarga dan anak-anak atas rencana #0046# menikah lagi', fam='tahu',
  K=(['keluarga besar dan anak-anak #0046# dan #0047# mengetahui rencana itu dan menerimanya dengan baik',
      'rencana #0046# menikah lagi sudah diketahui keluarga serta anak-anak dan mereka menerimanya'],
     ['keluarga kedua belah pihak serta anak-anak sudah mengetahui rencana itu dan menerimanya dengan baik',
      'anak-anak dan keluarga #0046# dan #0047# tahu rencana menikah lagi itu dan menerimanya']),
  peran={'anak-pemohon': (['saya sebagai anak #0046# dan #0047# mengetahui rencana ayah saya menikah lagi dan saya menerimanya dengan baik',
                           'sebagai anak mereka saya tahu rencana ayah menikah lagi dan saya menerimanya',
                           'saya anak mereka dan sudah mengetahui rencana ayah menikah lagi serta menerimanya dengan baik',
                           'saya yang menjadi anak #0046# dan #0047# sudah tahu rencana ayah menikah lagi dan tidak berkeberatan'],
                          ['sebagai anak dari #0046# dan #0047# saya mengetahui rencana itu dan saya menerimanya',
                           'saya anak kandung mereka dan telah mengetahui bahwa ayah hendak menikah lagi serta menerimanya',
                           'rencana ayah menikah lagi sudah saya ketahui sebagai anak mereka dan saya menerimanya dengan baik',
                           'sebagai anak saya diberi tahu rencana ayah menikah lagi dan saya tidak berkeberatan'])})

# ------------------------------------------------------------------ istri keberatan (urutan 88-92)
KEBERATAN = {'sikapIstri': 'keberatan'}

S(id='keberatan-alasan', pokok='pp-pg-keberatan', urut_abs=88, tingkat='inti', keadaan=KEBERATAN,
  teks='Apa alasan #0047# keberatan atau tidak menyetujui #0046# menikah lagi dan dari mana saksi mengetahuinya?',
  varian=['Mengapa #0047# tidak menyetujui rencana #0046# menikah lagi?'],
  hal='alasan keberatan #0047# atas rencana #0046# menikah lagi', m='alasan keberatan #0047# atas rencana #0046# menikah lagi', fam='hadir',
  K=(['#0047# keberatan #0046# menikah lagi karena #4851#',
      '#0047# menolak rencana #0046# beristri lagi sebab #4851#'],
     ['alasan #0047# menolak rencana itu adalah #4851#',
      'keberatan #0047# atas rencana #0046# berpangkal pada #4851#']),
  M='K',
  A=['#0047# keberatan karena merasa dirinya masih mampu menjalankan kewajiban sebagai istri', 'alasan keberatan #0047# adalah ia merasa tidak ada kekurangan dalam melayani suami'],
  B=['#0047# keberatan karena takut nafkah dan perhatian untuk anak-anak berkurang', 'alasan keberatan #0047# adalah khawatir kebutuhan anak-anak tidak terpenuhi'],
  beda_pada='penyebab', beda_maksud='versi A: keberatan karena merasa mampu menjalankan kewajiban; versi B: keberatan karena khawatir nafkah anak berkurang - berselisih pada PENYEBAB keberatan')

S(id='keberatan-musyawarah', pokok='pp-pg-keberatan', urut_abs=89, tingkat='pilihan', keadaan=KEBERATAN,
  teks='Apakah keberatan #0047# itu sudah dibicarakan dengan #0046# atau dimusyawarahkan keluarga dan apa hasilnya?',
  varian=['Upaya apa yang dilakukan keluarga untuk menyelesaikan keberatan #0047# atas rencana #0046# menikah lagi?'],
  hal='musyawarah atas keberatan #0047#', m='musyawarah keluarga atas keberatan #0047#', fam='hadir',
  K=(['keberatan #0047# sudah dibicarakan dengan #0046# dan dimusyawarahkan keluarga tetapi belum ada kesepakatan',
      'keluarga sudah mempertemukan #0046# dan #0047# untuk membahas keberatan itu namun belum tercapai kesepakatan'],
     ['pembicaraan tentang keberatan #0047# telah dilakukan bersama keluarga namun belum menemukan titik temu',
      '#0046# dan #0047# sudah dimusyawarahkan keluarganya tetapi belum ada kata sepakat']),
  M='K',
  A=['musyawarah keluarga sudah dilakukan lebih dari satu kali', 'keluarga sudah beberapa kali memusyawarahkan keberatan itu'],
  B=['musyawarah keluarga baru dilakukan satu kali', 'keluarga baru sekali memusyawarahkan keberatan itu'],
  beda_pada='jumlah', beda_maksud='versi A: lebih dari satu kali musyawarah; versi B: baru satu kali - berselisih pada JUMLAH musyawarah')

S(id='keberatan-tetap-bersama', pokok='pp-pg-keberatan', urut_abs=99, tingkat='pilihan', keadaan=KEBERATAN,
  teks='Apakah #0047# tetap bersedia hidup bersama #0046# sebagai istri bila Pengadilan memberi izin #0046# menikah lagi?',
  varian=['Bagaimana sikap #0047# terhadap kelangsungan rumah tangganya dengan #0046# jika izin untuk #0046# menikah lagi diberikan?'],
  hal='sikap #0047# atas kelangsungan rumah tangga bila izin diberikan', m='sikap #0047# atas kelangsungan rumah tangga bila izin poligami diberikan', fam='tahu',
  K=(['#0047# tetap ingin hidup bersama #0046# meskipun ia keberatan dimadu',
      '#0047# masih ingin mempertahankan rumah tangganya dengan #0046# walaupun menentang poligami'],
     ['meski berkeberatan #0047# tetap bersedia hidup bersama #0046# sebagai istrinya',
      'walau berkeberatan atas poligami #0047# tetap ingin bersama #0046#']),
  M='K')

S(id='keberatan-nafkah', pokok='pp-pg-keberatan', urut_abs=91, tingkat='tambahan', keadaan=KEBERATAN,
  teks='Apakah keberatan #0047# berkaitan dengan nafkah dan keadilan #0046# selama ini atau semata-mata karena ia tidak mau dimadu?',
  varian=['Apakah keberatan #0047# didasarkan pada kurangnya nafkah dari #0046# atau karena ia tidak bersedia dimadu?'],
  hal='dasar keberatan #0047#: nafkah atau penolakan dimadu', m='dasar keberatan #0047# apakah karena nafkah atau karena tidak mau dimadu', fam='tahu',
  K=(['keberatan #0047# tidak berkaitan dengan nafkah yang selama ini dicukupi #0046# melainkan karena ia tidak mau dimadu',
      '#0047# berkeberatan bukan karena soal nafkah yang selama ini dicukupi #0046# melainkan karena ia tidak ingin dimadu'],
     ['nafkah dari #0046# selama ini tercukupi sehingga keberatan #0047# bukan soal nafkah melainkan karena ia tidak ingin dimadu',
      'sikap #0047# menolak tidak ada hubungannya dengan nafkah yang selama ini tercukupi melainkan karena ia tidak mau dimadu']),
  A=['keberatan #0047# hanya karena ia tidak mau dimadu', '#0047# berkeberatan semata karena menolak dimadu'],
  B=['keberatan #0047# karena merasa nafkah dari #0046# selama ini kurang', '#0047# berkeberatan sebab menilai nafkah dari #0046# selama ini belum cukup'],
  beda_pada='penyebab', beda_maksud='versi A: keberatan hanya karena tidak mau dimadu; versi B: karena nafkah dirasa kurang - berselisih pada PENYEBAB keberatan')

S(id='keberatan-didengar', pokok='pp-pg-keberatan', urut_abs=92, tingkat='tambahan', keadaan=KEBERATAN,
  teks='Apakah #0047# bersedia dan pernah menyampaikan keberatannya kepada keluarga atau pihak lain, dan apa yang ia katakan?',
  varian=['Kepada siapa saja #0047# pernah menyampaikan keberatannya dan apa yang ia ucapkan?'],
  hal='penyampaian keberatan #0047# kepada keluarga atau pihak lain', m='penyampaian keberatan #0047# kepada keluarga atau pihak lain', fam='hadir',
  K=(['#0047# menyampaikan keberatannya kepada keluarga dan mengatakan bahwa ia belum rela dimadu',
      'di hadapan keluarga #0047# mengungkapkan keberatannya dan mengatakan belum rela dimadu'],
     ['keberatan #0047# disampaikan kepada keluarga dengan ucapan bahwa ia belum rela dimadu',
      '#0047# mengungkapkan kepada kerabat bahwa ia belum rela #0046# menikah lagi']),
  M=(['#0047# berkata di depan keluarga bahwa ia belum rela dimadu', '#0047# mengatakan langsung kepada keluarga bahwa ia belum bersedia dimadu'],
     ['saya mendengar #0047# menyampaikan bahwa ia belum rela dimadu', 'ucapan #0047# bahwa ia belum rela dimadu terdengar oleh saya']))

# ------------------------------------------------------------------ istri tidak mungkin dimintai persetujuan (urutan 93-95)
TIDAK_MUNGKIN = {'sikapIstri': 'tidak-mungkin'}

S(id='tidakmungkin-keadaan', pokok='pp-pg-tidak-mungkin', urut_abs=93, tingkat='inti', keadaan=TIDAK_MUNGKIN,
  teks='Keadaan apa yang membuat #0047# tidak mungkin dimintai persetujuan oleh #0046#?',
  varian=['Mengapa #0047# tidak dapat dimintai persetujuan atas rencana #0046# menikah lagi?'],
  hal='keadaan #0047# yang membuatnya tidak mungkin dimintai persetujuan', m='keadaan #0047# yang membuatnya tidak mungkin dimintai persetujuan', fam='tahu',
  K=(['#0047# tidak dapat dimintai persetujuan karena #4852#',
      'persetujuan #0047# tidak dapat diminta sebab #4852#'],
     ['keadaan #0047# yaitu #4852# membuat ia tidak dapat dimintai persetujuan',
      'karena #4852# #0047# berada dalam keadaan yang tidak memungkinkan dimintai persetujuan']),
  A=['#0047# tidak dapat dimintai persetujuan karena kondisinya sendiri', 'keadaan diri #0047# yang membuat persetujuannya tidak dapat diminta'],
  B=['#0047# tidak dapat dimintai persetujuan karena keberadaannya tidak diketahui', 'persetujuan #0047# tidak dapat diminta sebab tempat tinggalnya tidak diketahui'],
  beda_pada='penyebab', beda_maksud='versi A: karena kondisi diri istri; versi B: karena keberadaan istri tidak diketahui - berselisih pada PENYEBAB')

S(id='tidakmungkin-lama', pokok='pp-pg-tidak-mungkin', urut_abs=94, tingkat='pilihan', keadaan=TIDAK_MUNGKIN,
  teks='Sudah berapa lama #0047# berada dalam keadaan itu atau tidak ada kabar beritanya?',
  varian=['Sejak kapan #0047# tidak dapat dihubungi atau berada dalam keadaan itu?'],
  hal='lamanya #0047# berada dalam keadaan tidak mungkin dimintai persetujuan', m='lamanya #0047# berada dalam keadaan tidak mungkin dimintai persetujuan', fam='tahu',
  K=(['#0047# sudah lama berada dalam keadaan itu dan lamanya mencapai dua tahun atau lebih',
      'keadaan #0047# itu telah berlangsung sekurang-kurangnya dua tahun'],
     ['sejak lebih dari dua tahun yang lalu #0047# berada dalam keadaan itu',
      'sudah dua tahun lebih lamanya #0047# berada dalam keadaan itu']),
  P=(['#0047# sudah lama berada dalam keadaan itu', 'keadaan #0047# itu telah berlangsung lama'],
     ['sejak waktu yang lalu #0047# berada dalam keadaan itu', 'sudah lama #0047# berada dalam keadaan itu']),
  A=['#0047# berada dalam keadaan itu selama kurang lebih tiga tahun', 'keadaan itu telah dialami #0047# sekitar tiga tahun'],
  B=['#0047# berada dalam keadaan itu selama kurang lebih lima tahun', 'keadaan itu telah dialami #0047# sekitar lima tahun'],
  beda_pada='lama', beda_maksud='versi A: sekitar tiga tahun; versi B: sekitar lima tahun - berselisih pada LAMA keadaan')

S(id='tidakmungkin-upaya', pokok='pp-pg-tidak-mungkin', urut_abs=95, tingkat='pilihan', keadaan=TIDAK_MUNGKIN,
  teks='Upaya apa yang sudah dilakukan #0046# atau keluarga untuk menghubungi atau menemui #0047#?',
  varian=['Apakah #0046# atau keluarga pernah berusaha mencari tahu keadaan dan keberadaan #0047#?'],
  hal='upaya menghubungi atau menemui #0047#', m='upaya #0046# atau keluarga menghubungi atau menemui #0047#', fam='hadir',
  K=(['#0046# dan keluarga sudah berusaha menghubungi dan mencari tahu keadaan #0047# tetapi tidak berhasil',
      'upaya mencari tahu keadaan #0047# telah dilakukan #0046# bersama keluarga namun tidak membuahkan hasil'],
     ['berbagai cara sudah ditempuh #0046# dan keluarga untuk menghubungi #0047# tetapi tidak ada hasilnya',
      '#0046# sudah menanyakan kepada keluarga dan kenalan untuk menemui #0047# namun tidak berhasil']),
  M='K')

# ------------------------------------------------------------------ Termohon tidak hadir di sidang (urutan 96-98)
TIDAK_HADIR = {'kehadiran': ['verstek', 't-tidak-hadir-setelah-mediasi']}

S(id='verstek-tinggal', pokok='pp-persetujuan-istri', urut_abs=96, tingkat='pilihan', keadaan=TIDAK_HADIR, pihakSaksi=['P'],
  teks='Di mana #0047# tinggal sekarang dan apakah #0046# masih berhubungan dengannya?',
  varian=['Apakah saksi mengetahui tempat tinggal #0047# sekarang dan apakah #0046# masih berhubungan dengannya?'],
  hal='tempat tinggal #0047# dan hubungannya dengan #0046# sekarang', m='tempat tinggal #0047# dan hubungannya dengan #0046# sekarang', fam='tahu',
  K=(['#0047# tinggal di alamat yang diketahui #0046# dan keduanya masih berhubungan',
      '#0046# mengetahui tempat tinggal #0047# sekarang dan masih berhubungan dengannya'],
     ['tempat tinggal #0047# sekarang diketahui oleh #0046# dan hubungan di antara mereka masih terjalin',
      'alamat #0047# sekarang diketahui #0046# yang masih berkomunikasi dengannya']),
  ragam=[dict(keadaan={'rumahTanggaKini': 'serumah'}, m='#0047# yang masih tinggal serumah dengan #0046#', fam='tahu',
              K=(['#0047# masih tinggal serumah dengan #0046# sehingga keduanya setiap hari berhubungan',
                  'sampai sekarang #0047# serumah dengan #0046# dan tentu masih saling berhubungan'],
                 ['#0047# dan #0046# masih satu rumah dan setiap hari bertemu',
                  'keduanya masih tinggal bersama sehingga berhubungan setiap hari']))])

S(id='verstek-sikap-hadir', pokok='pp-persetujuan-istri', urut_abs=97, tingkat='pilihan', keadaan=TIDAK_HADIR, pihakSaksi=['P'],
  teks='Apakah #0047# pernah menyampaikan kepada #0046# atau keluarga bahwa ia tidak keberatan dan tidak akan hadir di persidangan?',
  varian=['Apakah #0047# pernah menyatakan melalui #0046# atau keluarga bahwa ia menyerahkan keputusan kepada pengadilan dan tidak akan hadir?'],
  hal='pernyataan #0047# tentang ketidakhadirannya di persidangan', m='pernyataan #0047# tentang ketidakhadirannya di persidangan', fam='tahu',
  K=(['#0047# pernah menyampaikan kepada #0046# bahwa ia tidak keberatan dan tidak akan hadir di persidangan',
      '#0047# mengatakan kepada #0046# bahwa ia tidak berkeberatan dan tidak perlu hadir di pengadilan'],
     ['kepada keluarga #0047# pernah berkata bahwa ia tidak berkeberatan dan tidak akan datang ke persidangan',
      '#0047# menitipkan pesan bahwa ia tidak berkeberatan dan tidak akan hadir di sidang']),
  M='K')

S(id='verstek-diberitahu-sidang', pokok='pp-persetujuan-istri', urut_abs=98, tingkat='tambahan', keadaan=TIDAK_HADIR, pihakSaksi=['P'],
  teks='Apakah #0047# mengetahui bahwa #0046# telah mengajukan permohonan izin poligami ke Pengadilan Agama?',
  varian=['Apakah #0047# sudah tahu perkara izin poligami ini sudah didaftarkan #0046# di Pengadilan Agama?'],
  hal='pengetahuan #0047# atas pendaftaran perkara izin poligami', m='pengetahuan #0047# atas pendaftaran perkara izin poligami', fam='tahu',
  K=(['#0047# mengetahui bahwa #0046# sudah mengajukan permohonan izin poligami ke Pengadilan Agama karena #0046# sendiri yang memberitahunya',
      '#0046# sudah memberi tahu #0047# bahwa permohonan izin poligami didaftarkan di Pengadilan Agama'],
     ['pendaftaran permohonan izin poligami itu telah diketahui #0047# sebab #0046# menyampaikannya sendiri',
      '#0047# tahu perkara izin poligami itu sudah didaftarkan karena diberitahu langsung oleh #0046#']))
