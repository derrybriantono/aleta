# -*- coding: utf-8 -*-
"""Tambalan RTF paket x8 (21 Okt 2026): blangko CT [02] Rekonvensi - harta bersama dalam gugatan rekonvensi.
Jangkar = potongan yang sudah ada di blangko (harus ditemukan TEPAT sekali; md5 berkas sebelum/sesudah dijaga tambal-rtf.pl).
  - pertimbangan: paragraf BARU (format paragraf pertimbangan blangko: rata kanan-kiri, menjorok 720, spasi 1,5) yang hanya berisi #3451#,
    disisipkan tepat sebelum judul "Dalam Konvensi Dan Rekonvensi" (akhir pertimbangan rekonvensi). #3451# berakhir <br>{} (= akhir paragraf)
    bila berisi; kosong = tidak ada paragraf (perintah format diikuti langsung oleh \pard judul - tidak ada baris kosong).
  - amar: #3452# disambung di ujung butir amar rekonvensi terakhir (nafkah anak, daftar bernomor otomatis Word); #3452# diawali <br> =
    butir bernomor berikutnya; kosong = tidak ada apa pun."""

REK = '1a Perceraian CT'
JANGKAR_PERT = '\\pard \\plain \\s65 \\qj \\fi-284 \\li284 \\ri0 \\sl360 \\slmult1 \\widctlpar \\lin284 \\rin0 \\tql \\tx284 \\tql \\tx720 \\tql \\tx1440 \\tql \\tx2160 \\tql \\tx2880 \\tql \\tx3600 \\tql \\tx4320 \\tql \\tx5040 \\tql \\tx5760 \\tql \\tx6480 \\tql \\tx7200 \\tql \\tx7920 \\tql \\tx8640 \\tql \\tx9360 \\itap0 \\fs28 \\rtlch \\ltrch \\dbch \\af9 \\hich \\af9 \\loch \\af9 {\\b1 \\fs24 \\rtlch \\ltrch \\dbch \\af9 \\hich \\af4 \\loch \\f4 Dalam Konvensi Dan Rekonvensi}'
JANGKAR_AMAR = '#6072# dengan kenaikan 5% (lima persen) setiap tahun sampai anak tersebut dewasa (umur 21 tahun atau telah menikah);}'
PARA_BARU = r'\pard\plain \qj \fi720 \li0 \ri0 \sl360 \slmult1 \widctlpar \itap0 {\fs24 \rtlch \ltrch \dbch \af9 \hich \af4 \loch \f4 #3451#}'
assert all(ord(c) >= 32 for c in PARA_BARU)

JENIS = {
    'rek': [(JANGKAR_PERT, PARA_BARU + JANGKAR_PERT, 1), (JANGKAR_AMAR, JANGKAR_AMAR[:-1] + '#3452#}', 1)],
}
BERKAS = [
    (REK, '[02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak)', 'rek'),
]
