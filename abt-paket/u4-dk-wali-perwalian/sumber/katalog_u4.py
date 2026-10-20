# -*- coding: utf-8 -*-
"""Menambah butir pertanyaan saksi pada katalog DISPENSASI KAWIN, WALI ADHAL dan PERWALIAN (versi 2, agen U4, 20 Okt 2026).

Prinsip: yang SUDAH ADA tidak dihapus atau diubah; hanya ditambah (butir, pokok pembuktian, variabel baru) dan `versi` dinaikkan.
Setiap butir disusun dari KERANGKA kalimat tetap per tingkat pengetahuan saksi (melihat, mendengar, de-auditu, sebagian) sehingga
himpunan penanda, angka dan jumlah negasi tiap varian sama (syarat periksaKatalog) dan kalimat saksi 1 berbeda dari saksi 2.
Jawaban memakai penanda variabel ABT (#nnnn#) yang terisi dari SIPP/posita (lihat PASANG.md), bukan titik-titik.

Pakai:  python katalog_u4.py [--tulis]    (tanpa --tulis hanya memeriksa dan mencetak ringkasan)
"""
import copy
import json
import os
import re
import subprocess
import sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.abspath(os.path.join(AKAR, '..', '..'))
KATALOG = os.path.join(REPO, 'ekstensi-sipp', 'saksi-katalog')

# ---------------------------------------------------------------------------------------------------------------------
# Kerangka kalimat
# ---------------------------------------------------------------------------------------------------------------------
MELIHAT_1 = ['saya melihat sendiri bahwa {P}', 'saya mengetahui sendiri bahwa {P}', 'saya menyaksikan langsung bahwa {P}', 'saya tahu betul bahwa {P}']
MELIHAT_2 = ['karena saya turut hadir maka saya terangkan bahwa {P}', 'yang saya ketahui secara langsung adalah bahwa {P}',
             '{P}, demikian yang tampak oleh saya waktu itu', '{P}, sebagaimana yang saya alami dalam pergaulan dengan mereka']
MENDENGAR_1 = ['saya mendengar sendiri ucapan mereka bahwa {P}', 'saya mendengar langsung perkataan mereka bahwa {P}',
               'dari ucapan mereka yang saya dengar sendiri diketahui bahwa {P}', 'saya sendiri mendengar mereka mengatakan bahwa {P}']
MENDENGAR_2 = ['saya turut mendengar langsung pembicaraan mereka bahwa {P}', 'perkataan mereka yang terdengar langsung oleh saya menerangkan bahwa {P}',
               '{P}, itulah ucapan mereka yang saya dengar sendiri', 'saya mendengar dengan telinga saya sendiri bahwa {P}']
DEAUDITU_1 = ['{{sumber}} bercerita kepada saya bahwa {P}', 'saya diberi tahu oleh {{sumber}} bahwa {P}', '{P}, begitulah cerita {{sumber}} kepada saya',
              'setahu saya berdasarkan cerita {{sumber}} bahwa {P}']
DEAUDITU_2 = ['dari penuturan {{sumber}} yang sampai kepada saya diketahui bahwa {P}', 'kabar dari {{sumber}} yang saya terima menyebutkan bahwa {P}',
              '{P}, demikian yang diceritakan {{sumber}} kepada saya', 'yang saya ketahui berasal dari cerita {{sumber}} yaitu bahwa {P}']
SEBAGIAN_1 = ['yang saya ketahui hanya sebagian saja yaitu bahwa {P}, sedangkan selebihnya kurang saya ketahui', 'saya hanya tahu sebagian yaitu bahwa {P}, dan selebihnya kurang saya ketahui',
              'sebagian saja yang saya ketahui yakni bahwa {P}', 'hanya sebatas itu yang saya ketahui yaitu bahwa {P}']
SEBAGIAN_2 = ['pengetahuan saya terbatas pada satu hal bahwa {P}, adapun selebihnya kurang jelas bagi saya', 'sejauh yang saya tahu bahwa {P}, sedangkan sisanya kurang saya pahami',
              'bagian yang saya kuasai hanyalah bahwa {P}, dan lainnya kurang saya pahami', 'yang bisa saya terangkan sebatas bahwa {P}, selebihnya kurang saya pahami']


def isi(kerangka, p):
    return [k.replace('{P}', p).replace('{{sumber}}', '{sumber}') for k in kerangka]


def kode_di(teks):
    return sorted(set(re.findall(r'#(\d{4})#', teks)))


class B:
    """Butir: pa/pb = proposisi saksi 1/2 (lengkap); sa/sb = proposisi sebagian; da/db = proposisi mendengar (opsional)."""

    def __init__(self, id, pokok, urutan, tingkat, kelompok, teks, hal, pa, pb, sa, sb, keadaan=None, teks_varian=None, mendengar=None, beda=None, pihak=('*',), maksud=None, menggantikan=None):
        self.d = dict(id=id, pokok=pokok, urutan=urutan, tingkat=tingkat, kelompok=kelompok, teks=teks, hal=hal, pa=pa, pb=pb, sa=sa, sb=sb, keadaan=keadaan or {},
                      teks_varian=teks_varian or [], mendengar=mendengar, beda=beda, pihak=list(pihak), maksud=maksud or hal, menggantikan=menggantikan)

    def json(self, ganti=None):
        d = self.d
        r = ganti or (lambda t: t)
        teks = r(d['teks'])
        jaw = {}
        m = d['maksud']
        jaw['melihat'] = dict(maksud='saksi menerangkan %s sebagai hal yang dilihat atau dialaminya sendiri' % r(m), saksi1=isi(MELIHAT_1, r(d['pa'])), saksi2=isi(MELIHAT_2, r(d['pb'])))
        if d['mendengar']:
            ma, mb = d['mendengar']
            jaw['mendengar'] = dict(maksud='saksi menerangkan %s dari ucapan yang didengarnya langsung, bukan dari penglihatan' % r(m), saksi1=isi(MENDENGAR_1, r(ma)), saksi2=isi(MENDENGAR_2, r(mb)))
        jaw['de-auditu'] = dict(maksud='saksi menerangkan %s hanya dari cerita orang lain, bukan yang disaksikannya sendiri' % r(m), saksi1=isi(DEAUDITU_1, r(d['pa'])), saksi2=isi(DEAUDITU_2, r(d['pb'])))
        jaw['sebagian'] = dict(maksud='saksi hanya mengetahui sebagian dari %s' % r(m), saksi1=isi(SEBAGIAN_1, r(d['sa'])), saksi2=isi(SEBAGIAN_2, r(d['sb'])))
        tb = []
        if d['beda']:
            pada, mk, s1, s2 = d['beda']
            jaw['berbeda'] = dict(maksud=r(mk), bedaPada=pada, saksi1=[r(x) for x in s1], saksi2=[r(x) for x in s2])
        else:
            tb.append('berbeda')
        semua = [teks] + [r(x) for x in d['teks_varian']]
        for jj in jaw.values():
            semua += jj['saksi1'] + jj['saksi2']
        q = dict(id=d['id'], pokok=d['pokok'], urutan=d['urutan'], tingkat=d['tingkat'], kelompok=d['kelompok'], pihakSaksi=d['pihak'], keadaan=d['keadaan'], teks=teks,
                 teksVarian=[r(x) for x in d['teks_varian']], hal=r(d['hal']), tidakBerlaku=tb, jawaban=jaw, variabelAbt=sorted(set(k for t in semua for k in kode_di(t))))
        if d['menggantikan']:
            q['menggantikan'] = d['menggantikan']
        return q


# ---------------------------------------------------------------------------------------------------------------------
# Dispensasi kawin: butir per jenis kelamin anak (pr = anak perempuan, calon suami; lk = anak laki-laki, calon isteri)
# ---------------------------------------------------------------------------------------------------------------------
def dk_butir():
    daftar = []
    SISI = {
        'pr': dict(A='#0606#', C='#0600#', UA='#0607#', UC='#0601#', KERJA='#6331#', cs='calon suami', jk='perempuan'),
        'lk': dict(A='#0600#', C='#0606#', UA='#0601#', UC='#0607#', KERJA='#0610#', cs='calon isteri', jk='laki-laki'),
    }
    spek = [
        # (kode, pokok, tingkat, kelompok, teks, hal, pa, pb, sa, sb, mendengar, beda, keadaan_tambahan, hanya)
        ('penolakan-kua', 'pp-dk-penolakan-kua', 'inti', 'pokok',
         'Apakah rencana pernikahan «A» dan «C» sudah didaftarkan ke Kantor Urusan Agama, dan bagaimana jawaban KUA?',
         'penolakan pendaftaran nikah oleh Kantor Urusan Agama',
         'rencana pernikahan «A» dan «C» sudah didaftarkan ke #5178# tetapi ditolak karena «A» belum berumur 19 tahun',
         'pendaftaran nikah «A» dan «C» ke #5178# ditolak oleh petugas sebab «A» belum mencapai umur 19 tahun',
         'rencana pernikahan «A» dan «C» pernah didaftarkan ke #5178#', 'pendaftaran nikah «A» dan «C» pernah diajukan ke #5178#', None, None, {}, None),
        ('selisih-usia', 'pp-dk-selisih-usia', 'pilihan', 'pokok',
         'Berapa umur «A» dan berapa umur «C», dan sejauh mana selisih umur keduanya?',
         'umur dan selisih umur keduanya',
         'umur «A» adalah «UA» dan umur «C» adalah «UC»', '«A» sekarang berumur «UA» sedangkan «C» sekarang berumur «UC»',
         'umur «A» adalah «UA»', '«A» sekarang berumur «UA»', None, None, {}, None),
        ('kekerasan', 'pp-dk-kekerasan', 'inti', 'pokok',
         'Apakah «C» pernah berbuat kasar, mengancam atau memaksa «A» dalam bentuk apa pun?',
         'ada tidaknya kekerasan atau paksaan terhadap anak',
         '«C» tidak pernah berbuat kasar, mengancam, maupun memaksa «A» secara fisik, psikis, seksual atau ekonomi',
         'tidak pernah ada perbuatan kasar, ancaman ataupun paksaan dari «C» kepada «A»',
         '«C» tidak pernah berbuat kasar kepada «A»', 'tidak pernah ada perbuatan kasar dari «C» kepada «A»',
         ('«C» tidak pernah berkata kasar atau mengancam «A»', 'tidak pernah ada kata-kata kasar maupun ancaman dari «C» kepada «A»'), None, {}, None),
        ('ekonomi', 'pp-dk-ekonomi', 'inti', 'pokok',
         'Apa pekerjaan «C» dan apakah penghasilannya cukup untuk membiayai rumah tangga mereka kelak?',
         'pekerjaan dan penghasilan calon sebagai bekal rumah tangga',
         '«C» bekerja sebagai «KERJA» dan penghasilannya cukup untuk membiayai kebutuhan rumah tangga «A» dan «C»',
         'mata pencaharian «C» adalah «KERJA», hasilnya mencukupi untuk menghidupi rumah tangga «A» dan «C»',
         '«C» bekerja sebagai «KERJA»', 'mata pencaharian «C» adalah «KERJA»', None, None, {}, 'pr'),
        ('tinggal', 'pp-dk-ekonomi', 'pilihan', 'pokok',
         'Di mana «A» dan «C» akan tinggal setelah menikah dan siapa yang akan membantu mereka?',
         'rencana tempat tinggal dan bantuan keluarga setelah menikah',
         'setelah menikah «A» dan «C» akan tinggal bersama orang tua salah satu pihak yang siap membimbing dan membantu mereka',
         'rencananya «A» dan «C» menetap di rumah keluarga dan dibantu oleh orang tua kedua belah pihak',
         'setelah menikah «A» dan «C» akan tinggal bersama keluarga', 'rencananya «A» dan «C» menetap di rumah keluarga', None,
         ('tempat', 'versi A: tinggal di rumah orang tua calon; versi B: tinggal di rumah sendiri - berselisih pada TEMPAT',
          ['setahu saya setelah menikah «A» dan «C» akan tinggal di rumah orang tua «C»', 'saya mengetahui sendiri bahwa «A» dan «C» akan menetap di rumah orang tua «C» sesudah menikah',
           'sesudah menikah «A» dan «C» tinggal bersama orang tua «C», itulah yang saya ketahui', 'yang saya terangkan di sini adalah bahwa «A» dan «C» akan serumah dengan orang tua «C»'],
          ['sepengetahuan saya setelah menikah «A» dan «C» akan menempati rumah sendiri', 'rencana yang saya ketahui adalah «A» dan «C» akan mengontrak rumah sendiri sesudah menikah',
           'sesudah menikah «A» dan «C» menempati rumah mereka sendiri, begitu yang saya alami', 'yang saya ingat dan saya sampaikan adalah bahwa «A» dan «C» akan tinggal di rumah sendiri']), {}, None),
        ('upaya-tunda', 'pp-dk-upaya-tunda', 'inti', 'upaya',
         'Apakah orang tua pernah menasihati «A» agar menunda pernikahan sampai cukup umur, dan bagaimana tanggapan «A»?',
         'upaya orang tua menunda pernikahan sampai cukup umur',
         'orang tua sudah menasihati «A» agar menunda pernikahan sampai cukup umur tetapi «A» dan «C» tetap berkeinginan menikah',
         'sudah ada nasihat dari orang tua kepada «A» untuk menunda pernikahan hingga cukup umur namun «A» dan «C» tetap ingin menikah',
         'orang tua sudah menasihati «A» agar menunda pernikahan', 'sudah ada nasihat dari orang tua kepada «A» untuk menunda pernikahan', None, None, {}, None),
        ('lingkungan', 'pp-dk-lingkungan', 'pilihan', 'pokok',
         'Apakah kedekatan «A» dan «C» sudah menimbulkan kekhawatiran atau pembicaraan di lingkungan sekitar?',
         'kekhawatiran lingkungan atas kedekatan keduanya',
         'kedekatan «A» dan «C» sudah menimbulkan kekhawatiran keluarga dan pembicaraan warga sekitar jika keduanya tidak segera dinikahkan',
         'warga sekitar dan keluarga mulai mengkhawatirkan kedekatan «A» dan «C» apabila keduanya tidak lekas dinikahkan',
         'kedekatan «A» dan «C» sudah menimbulkan kekhawatiran keluarga', 'keluarga mulai mengkhawatirkan kedekatan «A» dan «C»', None, None, {}, None),
        ('pendampingan', 'pp-dk-pendampingan', 'pilihan', 'upaya',
         'Apakah «A» sudah pernah diperiksa atau berkonsultasi dengan dokter, bidan, psikolog atau lembaga pendamping anak?',
         'pemeriksaan atau pendampingan profesional terhadap anak',
         '«A» sudah pernah diperiksakan atau berkonsultasi dengan tenaga kesehatan atau lembaga pendamping sebelum perkara ini diajukan',
         'sebelum perkara ini diajukan «A» sudah dibawa memeriksakan diri ke tenaga kesehatan atau lembaga pendamping',
         '«A» sudah pernah diperiksakan ke tenaga kesehatan', '«A» sudah dibawa memeriksakan diri ke tenaga kesehatan', None, None, {}, None),
    ]
    urut = 1910
    for kode, pokok, tingkat, kelompok, teks, hal, pa, pb, sa, sb, mend, beda, ket, hanya in spek:
        for jk in ('pr', 'lk'):
            if hanya and hanya != jk:
                continue
            S = SISI[jk]

            def r(t, S=S):
                for k, v in S.items():
                    if k != 'jk':
                        t = t.replace('«%s»' % k, v)
                return t
            keadaan = dict(ket)
            keadaan['jenisKelaminAnak'] = S['jk']
            b = B('q-dk-%s-%s' % (kode, jk), pokok, urut, tingkat, kelompok, teks, hal, pa, pb, sa, sb, keadaan=keadaan, mendengar=mend, beda=beda)
            daftar.append(b.json(r))
            urut += 1
    # keikutsertaan orang tua calon (kedua calon di bawah umur): berlaku bagi kedua jenis kelamin
    for jk in ('pr', 'lk'):
        S = SISI[jk]

        def r(t, S=S):
            for k, v in S.items():
                if k != 'jk':
                    t = t.replace('«%s»' % k, v)
            return t
        b = B('q-dk-dua-keluarga-%s' % jk, 'pp-dk-dua-keluarga', urut, 'tambahan', 'pokok',
              'Apakah orang tua «C» juga ikut mengajukan permohonan dispensasi kawin untuk «C» dan apakah mereka menyetujui pernikahan ini?',
              'keikutsertaan orang tua calon sebagai pemohon dan restu mereka',
              'orang tua «C» ikut mengajukan permohonan dispensasi kawin untuk «C» dan menyetujui pernikahan «A» dan «C»',
              'permohonan dispensasi kawin untuk «C» juga diajukan oleh orang tua «C» yang merestui pernikahan «A» dan «C»',
              'orang tua «C» ikut mengajukan permohonan untuk «C»', 'permohonan untuk «C» juga diajukan oleh orang tua «C»',
              keadaan={'jenisKelaminAnak': S['jk'], 'calonJuga': 'di-bawah-umur'})
        daftar.append(b.json(r))
        urut += 1
    return daftar


DK_POKOK = [
    dict(id='pp-dk-penolakan-kua', judul='Penolakan pendaftaran nikah oleh Kantor Urusan Agama', uraian='rencana pernikahan sudah didaftarkan ke KUA dan ditolak karena belum cukup umur (dasar mengajukan dispensasi)', dasarHukum=['dh-uu16-2019-7-2-3'], wajib=False),
    dict(id='pp-dk-selisih-usia', judul='Umur dan selisih umur anak dengan calon', uraian='umur anak dan calon suami atau istri serta selisih umur keduanya sebagai bahan kepentingan terbaik anak', dasarHukum=['dh-perma5-2019-hakim'], wajib=False),
    dict(id='pp-dk-kekerasan', judul='Tidak ada kekerasan atau paksaan', uraian='tidak ada unsur paksaan psikis, fisik, seksual atau ekonomi dari calon terhadap anak (Pasal 16 huruf i PERMA 5/2019)', dasarHukum=['dh-perma5-2019-hakim'], wajib=True),
    dict(id='pp-dk-ekonomi', judul='Pekerjaan, penghasilan dan rencana tempat tinggal', uraian='kesiapan ekonomi calon dan rencana tempat tinggal serta bantuan keluarga setelah menikah', dasarHukum=['dh-perma5-2019-hakim'], wajib=False),
    dict(id='pp-dk-upaya-tunda', judul='Upaya orang tua menunda pernikahan', uraian='orang tua sudah menasihati agar pernikahan ditunda sampai cukup umur dan tanggapan anak', dasarHukum=['dh-perma5-2019-12-4'], wajib=False),
    dict(id='pp-dk-lingkungan', judul='Kekhawatiran lingkungan atas kedekatan anak dan calon', uraian='kedekatan keduanya menimbulkan kekhawatiran keluarga dan lingkungan', dasarHukum=['dh-uu16-2019-7-2-3'], wajib=False),
    dict(id='pp-dk-pendampingan', judul='Pemeriksaan atau pendampingan profesional terhadap anak', uraian='anak sudah diperiksa atau didampingi tenaga kesehatan, psikolog atau lembaga pendamping anak (Pasal 15 dan Pasal 16 huruf h PERMA 5/2019)', dasarHukum=['dh-perma5-2019-hakim'], wajib=False),
    dict(id='pp-dk-dua-keluarga', judul='Orang tua calon ikut mengajukan permohonan bila calon juga di bawah umur', uraian='bila calon juga belum 19 tahun orang tua calon turut menjadi pemohon dan merestui (Pasal 7 ayat (2) UU 1/1974 jo. UU 16/2019: orang tua pihak pria dan/atau pihak wanita)', dasarHukum=['dh-uu16-2019-7-2-3'], wajib=False),
]


# ---------------------------------------------------------------------------------------------------------------------
# Wali adhal
# ---------------------------------------------------------------------------------------------------------------------
def wa_butir():
    b = []
    b.append(B('q-lamaran', 'pp-maksud-calon', 215, 'pilihan', 'pokok',
               'Apakah calon suami #0046# sudah melamar #0046# kepada keluarganya, dan sudah diketahui oleh wali nasabnya?',
               'lamaran calon suami kepada keluarga dan sepengetahuan wali',
               '#1029# sudah datang melamar #0046# kepada keluarganya dan lamaran itu sudah diketahui oleh wali nasab',
               '#1029# telah menyampaikan lamaran untuk #0046# kepada pihak keluarga termasuk kepada wali nasab',
               '#1029# sudah datang melamar #0046# kepada keluarga', '#1029# telah menyampaikan lamaran untuk #0046# kepada pihak keluarga',
               mendengar=('#1029# menyampaikan lamaran untuk #0046# kepada keluarga dan hal itu diketahui oleh wali nasab', 'lamaran #1029# untuk #0046# disampaikan kepada keluarga dan sampai kepada wali nasab')).json())
    b.append(B('q-restu-keluarga-lain', 'pp-upaya-wali', 225, 'pilihan', 'upaya',
               'Apakah keluarga #0046# yang lain, seperti ibu atau saudara, menyetujui pernikahan #0046# dengan calon suaminya?',
               'sikap keluarga lain terhadap pernikahan',
               'keluarga #0046# yang lain sudah menyetujui pernikahan #0046# dengan #1029# dan hanya wali nasabnya yang enggan menikahkan',
               'selain wali nasab, keluarga #0046# yang lain merestui pernikahan #0046# dengan #1029#',
               'keluarga #0046# yang lain sudah menyetujui pernikahannya dengan #1029#', 'keluarga #0046# yang lain merestui pernikahan dengan #1029#').json())
    b.append(B('q-sejak-kapan-menolak', 'pp-penolakan-wali', 235, 'pilihan', 'pokok',
               'Sejak kapan wali tersebut menyatakan tidak mau menjadi wali nikah #0046#, dan sudah berapa kali ia menyatakannya?',
               'waktu dan berapa kali wali menyatakan penolakan',
               'wali #0046# sudah beberapa kali menyatakan tidak mau menikahkan #0046# sejak rencana pernikahan itu disampaikan kepada wali tersebut',
               'sejak rencana pernikahan disampaikan, wali #0046# berkali-kali menyatakan tidak bersedia menikahkan #0046#',
               'wali #0046# pernah menyatakan tidak mau menikahkan #0046#', 'wali #0046# pernah menyatakan tidak bersedia menikahkan #0046#',
               mendengar=('wali #0046# berulang kali berkata tidak mau menikahkan #0046#', 'saya mendengar wali #0046# menyatakan tidak bersedia menjadi wali nikah #0046# berkali-kali'),
               beda=('lama', 'versi A: wali menolak sejak rencana disampaikan; versi B: wali baru menolak belakangan - berselisih pada LAMA',
                     ['wali #0046# menyatakan tidak mau menikahkan #0046# sejak rencana pernikahan pertama kali disampaikan', 'saya menyaksikan sendiri wali #0046# tidak mau menikahkan #0046# sejak awal rencana pernikahan dibicarakan',
                      'sejak awal wali #0046# sudah tidak mau menjadi wali nikah, dan saya mengetahuinya langsung', 'penolakan wali #0046# sudah ada sejak awal rencana dan saya lihat sendiri bahwa ia tidak mau'],
                     ['wali #0046# baru menyatakan tidak mau menikahkan #0046# beberapa waktu sesudah rencana pernikahan disampaikan', 'sepengetahuan saya wali #0046# tidak menolak sejak awal, ia baru menolak belakangan',
                      'saya baru mendengar wali #0046# tidak mau menikahkan setelah beberapa waktu rencana itu dibicarakan', 'wali #0046# tidak langsung menolak, ia baru menolak sesudah beberapa waktu'])).json())
    b.append(B('q-bersedia-wali-hakim', 'pp-persetujuan-umur', 245, 'pilihan', 'akibat',
               'Apakah #0046# bersedia dinikahkan dengan wali hakim dari Kantor Urusan Agama apabila Pengadilan menetapkan wali nasabnya adhal?',
               'kesediaan dinikahkan dengan wali hakim bila wali ditetapkan adhal',
               '#0046# bersedia dinikahkan dengan wali hakim dari Kantor Urusan Agama apabila Pengadilan menetapkan walinya adhal',
               'bila Pengadilan menetapkan walinya adhal, #0046# menyatakan bersedia dinikahkan oleh wali hakim dari Kantor Urusan Agama',
               '#0046# bersedia dinikahkan dengan wali hakim', 'bila walinya ditetapkan adhal, #0046# menyatakan bersedia dinikahkan oleh wali hakim').json())
    b.append(B('q-rencana-nikah', 'pp-maksud-calon', 255, 'pilihan', 'pokok',
               'Di mana pernikahan #0046# dengan calon suaminya direncanakan akan dilangsungkan?',
               'tempat rencana pernikahan akan dilangsungkan',
               'pernikahan #0046# dengan #1029# direncanakan dilangsungkan di wilayah #9205# secepatnya setelah ada penetapan Pengadilan',
               'setelah ada penetapan Pengadilan, #0046# dan #1029# berencana menikah di wilayah #9205#',
               'pernikahan #0046# dengan #1029# direncanakan di wilayah #9205#', 'rencana pernikahan #0046# dan #1029# di wilayah #9205#').json())
    return b


WA_POKOK = [dict(id='pp-lamaran-restu', judul='Lamaran dan restu keluarga lain', uraian='lamaran calon suami sudah disampaikan dan keluarga lain (selain wali nasab) merestui', dasarHukum=['dh-uup-7-khi-16'], wajib=False)]


# ---------------------------------------------------------------------------------------------------------------------
# Perwalian
# ---------------------------------------------------------------------------------------------------------------------
def pw_butir():
    def kl(id, pokok, urut, tingkat, kelompok, teks, hal, pa, pb, sa, sb, **kw):
        return B(id, pokok, urut, tingkat, kelompok, teks, hal, pa, pb, sa, sb, keadaan=dict(kw.pop('keadaan', {}), pemohonWali='keluarga-lain'), **kw)
    b = []
    b.append(kl('q-pw-hubungan-kerabat', 'pp-pw-kedudukan-pemohon', 1410, 'inti', 'pokok', 'Apa hubungan #7036# dengan anak yang dimohonkan perwalian?',
                'hubungan keluarga calon wali dengan anak',
                '#7036# adalah #4400# anak itu', 'kedudukan #7036# bagi anak itu adalah #4400#',
                '#7036# adalah #4400# anak itu', 'kedudukan #7036# bagi anak itu adalah #4400#', menggantikan=['q-pw-hubungan-kl']).json())
    b.append(kl('q-pw-orangtua-kerabat', 'pp-pw-orang-tua', 1420, 'inti', 'pokok', 'Siapa ayah dan ibu kandung anak itu, dan apakah keduanya sudah meninggal dunia?',
                'orang tua kandung anak dan kematian keduanya',
                '#4409#, sehingga anak itu sudah tidak berada di bawah kekuasaan orang tua', 'kedua orang tua anak itu sudah wafat, yaitu #4409#, sehingga anak itu tidak lagi di bawah kekuasaan orang tua',
                '#4409#', 'orang tua anak itu sudah wafat, yaitu #4409#',
                menggantikan=['q-pw-orangtua-kl']).json())
    b.append(kl('q-pw-pidana-sehat', 'pp-pw-kepatutan', 1430, 'inti', 'pokok', 'Apakah #7036# pernah dihukum karena suatu tindak pidana, dan bagaimana kesehatan jasmani dan rohaninya?',
                'riwayat hukuman dan kesehatan calon wali',
                '#7036# tidak pernah dihukum karena tindak pidana dan sehat jasmani maupun rohani sehingga mampu mengurus anak itu',
                'belum pernah ada catatan hukuman pada #7036# dan keadaan jasmani serta rohaninya baik sehingga mampu mengurus anak itu',
                '#7036# tidak pernah dihukum karena tindak pidana', 'belum pernah ada catatan hukuman pada #7036#',
                keadaan={}).json())
    b.append(kl('q-pw-penghasilan', 'pp-pw-kepatutan', 1440, 'pilihan', 'pokok', 'Apa pekerjaan #7036# dan apakah penghasilannya cukup untuk membiayai kebutuhan anak itu?',
                'pekerjaan dan penghasilan calon wali',
                '#7036# bekerja sebagai #6331# dan penghasilannya cukup untuk membiayai kebutuhan anak itu',
                'mata pencaharian #7036# adalah #6331#, hasilnya mencukupi untuk kebutuhan anak itu',
                '#7036# bekerja sebagai #6331#', 'mata pencaharian #7036# adalah #6331#').json())
    b.append(kl('q-pw-tinggal-anak', 'pp-pw-pemeliharaan', 1450, 'pilihan', 'pokok', 'Di mana anak itu tinggal sekarang dan bersama siapa?',
                'tempat tinggal anak dan pengasuhnya',
                '#5110# sekarang tinggal serumah dengan #7036# dan diasuh olehnya sehari-hari', 'sehari-hari #5110# tinggal bersama #7036# yang mengasuh anak itu',
                '#5110# sekarang tinggal serumah dengan #7036#', 'sehari-hari #5110# tinggal bersama #7036#').json())
    b.append(kl('q-pw-pendidikan-anak', 'pp-pw-anak-keadaan', 1460, 'pilihan', 'pokok', 'Bagaimana pendidikan dan kesehatan anak itu selama berada dalam asuhan #7036#?',
                'pendidikan dan kesehatan anak selama diasuh calon wali',
                '#5110# tetap bersekolah dan sehat selama diasuh oleh #7036#', 'selama berada dalam asuhan #7036#, #5110# terus bersekolah dan dalam keadaan sehat',
                '#5110# tetap bersekolah selama diasuh oleh #7036#', 'selama diasuh #7036#, #5110# terus bersekolah').json())
    b.append(kl('q-pw-kesanggupan-harta', 'pp-pw-harta', 1470, 'pilihan', 'akibat',
                'Apakah #7036# sanggup mengurus harta anak itu dengan baik, mencatat harta dan perubahannya, serta tidak memindahtangankannya kecuali untuk kepentingan anak?',
                'kesanggupan wali mengurus dan menjaga harta anak',
                '#7036# sanggup mengurus harta anak itu dengan baik, mencatat harta beserta setiap perubahan, dan tidak memindahtangankan harta anak kecuali untuk kepentingan anak',
                'saya yakin #7036# akan menjaga harta anak itu, mencatat setiap perubahan, dan tidak menjual atau mengalihkan harta itu kecuali untuk kepentingan anak',
                '#7036# sanggup mengurus harta anak itu dengan baik', 'saya yakin #7036# akan menjaga harta anak itu',
                keadaan={'hartaAnak': 'ada'}).json())
    return b


PW_VARIABEL_BARU = ['4400', '4409']


# ---------------------------------------------------------------------------------------------------------------------
def terapkan(berkas, butir, pokok, variabel_baru=(), catatan_versi=''):
    p = os.path.join(KATALOG, berkas)
    k = json.load(open(p, encoding='utf-8'))
    # idempoten: butir buatan generator ini diganti versi terbaru, yang bukan buatannya tidak disentuh
    milik = {q['id'] for q in butir}
    k['pertanyaan'] = [q for q in k['pertanyaan'] if q['id'] not in milik]
    milik_pokok = {x['id'] for x in pokok}
    k['pokokPembuktian'] = [x for x in k['pokokPembuktian'] if x['id'] not in milik_pokok]
    ada_urut = {q['urutan'] for q in k['pertanyaan']}
    ada_pokok = {x['id'] for x in k['pokokPembuktian']}
    for q in butir:
        assert q['urutan'] not in ada_urut, (berkas, q['id'], q['urutan'])
        k['pertanyaan'].append(q)
        ada_urut.add(q['urutan'])
    for x in pokok:
        if x['id'] not in ada_pokok:
            k['pokokPembuktian'].append(x)
    if variabel_baru:
        k['variabelBaru'] = sorted(set(map(str, (k.get('variabelBaru') or []) + list(variabel_baru))))
    k['pertanyaan'].sort(key=lambda q: q['urutan'])
    if k['versi'] == 1:
        k['versi'] = 2
    return p, k


def main():
    tulis = '--tulis' in sys.argv
    hasil = []
    hasil.append(terapkan('dispensasi-kawin.json', dk_butir(), DK_POKOK))
    hasil.append(terapkan('wali-adhal.json', wa_butir(), WA_POKOK, variabel_baru=['9205']))
    hasil.append(terapkan('perwalian.json', pw_butir(), [], variabel_baru=PW_VARIABEL_BARU))
    for p, k in hasil:
        print(os.path.basename(p), 'versi', k['versi'], 'butir', len(k['pertanyaan']), 'pokok', len(k['pokokPembuktian']))
        if tulis:
            with open(p, 'w', encoding='utf-8', newline='\n') as f:
                json.dump(k, f, ensure_ascii=False, indent=1)
                f.write('\n')


if __name__ == '__main__':
    main()
