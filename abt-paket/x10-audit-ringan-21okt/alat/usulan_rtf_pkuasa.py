# -*- coding: utf-8 -*-
"""USULAN - TIDAK DIJALANKAN, tidak termasuk paket-satker. Memperbaiki dua BAS "P (Kuasa)" (berita_acara_sidang/1 BAS Pertama Standar, BUKAN blangko Derry)
yang menulis "surat kuasa khusus tanggal #0207# ... terdaftar pada Kepaniteraan nomor #0197# tanggal #0184#": #0184# adalah Tgl. Surat Kuasa (BAS saudaranya
01-a/08-b/08-c memakai #0184# di tempat pertama dan #0111# = tgl register SIPP di tempat kedua), sehingga tanggal surat kuasa tercetak dua kali dan tanggal register
tidak pernah tercetak. Perbaikan: satu penanda per berkas, "#0184#" -> "#0111#" (penanda #0207# sudah = #0184# sejak paket x2).
Hanya dijalankan atas persetujuan pengguna: python usulan_rtf_pkuasa.py <folder _blangko_abt> [--tulis]  (tanpa --tulis hanya melaporkan; dengan --tulis membuat .bak-x10)."""
import glob, os, shutil, sys

akar = sys.argv[1]
tulis = '--tulis' in sys.argv
POLA = ['01-b. BAS Pertama P (Kuasa) Tidak Hadir*Tunda Panggil PKuasanya*.rtf', '01-c. BAS Pertama P (Kuasa) Hadir*Tunda Panggil T.PA.Mj.rtf']
n = 0
for pola in POLA:
    for f in sorted(glob.glob(os.path.join(akar, 'berita_acara_sidang', '1 BAS Pertama Standar', pola))):
        b = open(f, 'rb').read()
        if b.count(b'#0184#') != 1 or b.count(b'#0207#') != 1 or b.count(b'#0111#') != 0:
            print('LEWATI (bentuk tak terduga):', os.path.basename(f), b.count(b'#0184#'), b.count(b'#0207#'), b.count(b'#0111#'))
            continue
        print(('TULIS ' if tulis else 'AKAN  ') + os.path.basename(f))
        if tulis:
            shutil.copy2(f, f + '.bak-x10')
            open(f, 'wb').write(b.replace(b'#0184#', b'#0111#'))
        n += 1
print(n, 'berkas')
