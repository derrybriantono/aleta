# -*- coding: utf-8 -*-
"""jalan180.py <akar _blangko_abt> <label> [kasus,...] - render kasus paket kaidah-fikih-2nov lewat render180 (renderer ABT php56 asli)."""
import sys, time
sys.path.insert(0, 'D:/Aplikasi/aleta/tmp/w180/alat')
import render180 as R

KASUS = {
    'bukti-kewarisan': (10225, '4b Kewarisan/[03b] [Tolak Verstek] Kewarisan - Dalil Tidak Terbukti.rtf', 1),
    'shulhu-hb': (10025, '4a Harta Bersama/[97] [Perdamaian] Akta Perdamaian.rtf', 2),
    'nisa32-hb': (10025, '4a Harta Bersama/[01b] [Kabul Verstek] HB.rtf', 2),
    'ianat-itsbat': (10276, '2a Itsbat Nikah Kontensius/[03b] [Tolak Verstek] IN Kontensius - Rukun dan Syarat Tidak Terbukti.rtf', 1),
    'nisa7-paw': (10178, '9 Penetapan Ahli Waris/[01b] [Kabul] PAW - Susunan Ahli Waris Dinamis (Pasangan, Anak, Ayah, Ibu - Pertimbangan Bagian Otomatis).rtf', 3),
    'tasharruf-wali': (10096, '6 Perwalian/[01b] [Kabul] Perwalian - Anak Yatim Piatu oleh Kerabat (Bukan Orang Tua).rtf', 1),
    'firasy-aua': (10090, '8 Asal Usul Anak/[01] [Kabul] AUA - Anak Sah dari Perkawinan Tercatat, Belum Punya Akta Kelahiran.rtf', 4),
    'ahzab-angkat': (9024, '9a Lain-Lain (Pengangkatan Anak)/[01] [Kabul] Pengangkatan Anak.rtf', 3),
    'poligami-01b': (8785, '5 Izin Poligami/[01b] [Kabul] Izin Poligami - Termohon Keberatan (Pasal 59 KHI).rtf', 1),
    'nisa3-tolak': (8785, '5 Izin Poligami/[03] [Tolak] Izin Poligami - Syarat Tidak Terbukti.rtf', 1),
    'hadhanah': (10284, '6a Hak Asuh Anak (Hadhanah)/[01b] [Kabul Verstek] Hak Asuh - Anak Belum Mumayyiz.rtf', 1),
    'nafkah-anak': (10284, '6c Nafkah Anak/[01b] [Kabul Verstek] Nafkah Anak.rtf', 1),
    'nisa19-kelalaian': (10284, '1e Kelalaian Kewajiban Suami Istri/[01b] [Kabul Verstek] Kelalaian Kewajiban Suami Istri.rtf', 1),
}
akar, label = sys.argv[1], sys.argv[2]
pilih = sys.argv[3].split(',') if len(sys.argv) > 3 else list(KASUS)
t = time.time()
R.render(akar, label, pilih, 'D:/Aplikasi/aleta/tmp/w180/render', {k: KASUS[k] for k in pilih})
print('waktu %.1f dtk untuk %d berkas' % (time.time() - t, len(pilih)))
