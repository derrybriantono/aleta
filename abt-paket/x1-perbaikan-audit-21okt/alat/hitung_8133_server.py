# -*- coding: utf-8 -*-
"""Hitung BACA SAJA di server: perkara yang isian 8133 tersimpannya masih memuat teks bawaan LAMA. Angka 16 digit diambil dari salinan HEX abt_variabel server
(D:/Aplikasi/aleta/tmp/x1/lab/var_server_hex.tsv) dan TIDAK dicetak. Di server sungguhan pakai paket-satker/hitung-8133.sh (dari cadangan)."""
import re, sys
sys.path.insert(0, 'D:/Aplikasi/aleta/tmp/x1')
from srv_sql import srv
for l in open('D:/Aplikasi/aleta/tmp/x1/lab/var_server_hex.tsv', encoding='latin1').read().split('\n')[1:]:
    k = l.split('\t')
    if k and k[0] == '8133':
        lama = bytes.fromhex(k[8]); break
angka = sorted(set(re.findall(rb'\d{16}', lama)))
w = ' OR '.join("data LIKE '%%%s%%'" % a.decode() for a in angka)
print('total isian 8133:', srv("SELECT COUNT(*) FROM aps_badilag.abt_data_teks WHERE no_var=8133")[0].split()[-1])
print('memuat deret:', srv("SELECT perkara_id FROM aps_badilag.abt_data_teks WHERE no_var=8133 AND (%s) ORDER BY perkara_id" % w)[0].split()[1:])
print('persis sama:', srv("SELECT perkara_id FROM aps_badilag.abt_data_teks WHERE no_var=8133 AND data = (SELECT default_data FROM aps_badilag.abt_variabel WHERE no_var=8133) ORDER BY perkara_id")[0].split()[1:])
