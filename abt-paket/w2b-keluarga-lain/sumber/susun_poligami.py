# -*- coding: utf-8 -*-
"""Menyusun blangko putusan IZIN POLIGAMI (folder Derry "5 Izin Poligami") - agen W2b-A, 21 Okt 2026.

Masukan : berkas dasar di folder W2B_ASLI (bawaan D:/aleta-dev/kerja/w2b-asli-server; salinan derry_briantono dari server).
Keluaran: timpa/derry_briantono/5 Izin Poligami/[01] [Kabul] ...rtf  (blangko LAMA ditambal; penjaga md5 di paket)
          rtf/derry_briantono/5 Izin Poligami/[01a] [01b] [03a] [03b] ...rtf  (blangko BARU)
          daftar-timpa-poligami.tsv (folder, berkas, md5 lama, md5 baru, keterangan)
Setiap suntingan dijaga awalan teks paragraf: bila berkas dasar sudah berubah di server (indeks bergeser) skrip berhenti.
"""
import hashlib
import os
import sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(AKAR, 'alat'))
from bangun import Dok, simpan, periksa_token  # noqa: E402

ASLI = os.environ.get('W2B_ASLI', 'D:/aleta-dev/kerja/w2b-asli-server')
FOLDER = '5 Izin Poligami'
PREFIKS = 'derry_briantono/'
DAFTAR_TIMPA = []

B01 = '[01] [Kabul] Izin Poligami.rtf'
B03 = '[03] [Tolak] Izin Poligami - Syarat Tidak Terbukti.rtf'


def md5b(b):
    return hashlib.md5(b).hexdigest()


def buka(berkas):
    return Dok(os.path.join(ASLI, FOLDER, berkas))


def rakit(d, sunting, sisip=None, sesudah=None):
    """sunting: {indeks: (awalan_wajib, teks_baru[, label])}; sisip: {indeks: [(templat, teks, label), ...]} disisipkan SEBELUM paragraf;
    sesudah: {indeks: [(templat, teks, label), ...]} disisipkan SESUDAH paragraf."""
    sisip = sisip or {}
    sesudah = sesudah or {}
    out = []
    for i in range(len(d.par)):
        for (tpl, teks, label) in sisip.get(i, []):
            out.append(d.ganti_teks(tpl, teks, label))
        if i in sunting:
            s = sunting[i]
            assert d.isi(i).startswith(s[0]), 'paragraf %d berubah: %r bukan awalan %r' % (i, d.isi(i)[:80], s[0])
            out.append(d.ganti_teks(i, s[1], s[2] if len(s) > 2 else None))
        else:
            out.append(d.par[i])
        for (tpl, teks, label) in sesudah.get(i, []):
            out.append(d.ganti_teks(tpl, teks, label))
    return d.rakit(out)


def tulis(jenis, berkas, isi, ket, lama_md5=None):
    pecah = periksa_token(isi)
    if pecah:
        raise SystemExit('token terpecah di %s: %r' % (berkas, pecah))
    sub = 'timpa' if jenis == 'timpa' else 'rtf'
    simpan(os.path.join(AKAR, sub, PREFIKS + FOLDER, berkas), isi)
    if jenis == 'timpa':
        DAFTAR_TIMPA.append((PREFIKS + FOLDER, berkas, lama_md5, md5b(isi.encode('latin1')), ket))
    print(jenis, berkas[:70], len(isi))


# --------------------------------------------------------------------------------------------------------------- teks bersama
VERSTEK_PANGGIL = ('Menimbang, bahwa #0046# telah dipanggil secara resmi dan patut untuk datang menghadap di muka persidangan pada hari-hari dan tanggal-tanggal sidang yang telah '
                   'ditetapkan, begitupula #0047# telah dipanggil secara resmi dan patut sesuai dengan ketentuan yang dimaksud oleh Pasal 55 dan 103 ayat (1) dan ayat (2) '
                   'Undang-Undang Nomor 7 Tahun 1989 yang sudah diubah dengan Undang-Undang Nomor 3 tahun 2006 dan Undang-Undang Nomor 50 Tahun 2009 tentang Peradilan Agama '
                   'jo. Pasal 145 dan Pasal 146 RBg;')
VERSTEK_TIDAK_HADIR = ('Menimbang, bahwa terhadap panggilan tersebut, #0046# hadir menghadap di muka persidangan, sedangkan #0047# tidak pernah hadir dan tidak menunjuk orang lain '
                       'sebagai wakil atau kuasanya, dan tidak ternyata tidak hadirnya itu disebabkan suatu halangan yang sah, oleh karena itu #0047# harus dinyatakan tidak hadir '
                       'dan perkara a quo diperiksa serta diputus tanpa hadirnya #0047# (verstek) sebagaimana Pasal 149 ayat (1) RBg;')
VERSTEK_BEBAN = ('Menimbang, bahwa oleh karena #0047# tidak pernah hadir, #0047# dapat dianggap tidak membantah dalil-dalil permohonan #0046#; namun karena perkara a quo menyangkut '
                 'izin beristri lebih dari seorang yang termasuk bidang perkawinan, dalil-dalil tersebut tetap perlu dibuktikan oleh #0046# berdasarkan Pasal 283 RBg, dan permohonan '
                 'hanya dapat dikabulkan sepanjang beralasan dan berdasar hukum sesuai Pasal 149 ayat (1) RBg;')


def sunting_kehadiran_verstek(tolak):
    """Suntingan duduk perkara dan pertimbangan kehadiran untuk varian Termohon tidak hadir (paragraf-paragraf sama pada [01] dan [03])."""
    s = {
        12: ('Telah mendengar keterangan', 'Telah mendengar keterangan #0046#, calon istri kedua #0046# dan saksi-saksi di persidangan;'),
        18: ('Bahwa pada hari sidang yang telah ditetapkan',
             'Bahwa pada hari sidang yang telah ditetapkan, #0046# hadir dalam persidangan, sedangkan #0047# tidak hadir dan tidak pula menyuruh orang lain sebagai wakil atau kuasanya '
             'yang sah, meskipun menurut relaas panggilan yang dibacakan di persidangan #0047# telah dipanggil secara resmi dan patut; #8554# telah memberikan nasihat kepada #0046# agar '
             'mengurungkan kehendaknya untuk beristri lebih dari seorang, tetapi tidak berhasil; #8509#'),
        19: ('Bahwa #0046# dan #0047# telah menempuh proses mediasi',
             'Bahwa oleh karena #0047# tidak pernah hadir di persidangan, upaya mediasi tidak dapat dilaksanakan;'),
        21: ('Bahwa atas permohonan #0046# tersebut',
             'Bahwa oleh karena #0047# tidak pernah hadir di persidangan, #0047# tidak mengajukan jawaban dan pemeriksaan dilanjutkan tanpa kehadiran #0047#;'),
        31: ('Bahwa atas keterangan saksi tersebut',
             'Bahwa selanjutnya #0046# membenarkan keterangan saksi-saksi tersebut dan tidak mengajukan sesuatu lagi dalam persidangan serta mohon putusan;'),
        37: ('Menimbang, bahwa #8554# telah memberikan nasihat',
             'Menimbang, bahwa #8554# telah memberikan nasihat agar #0046# mengurungkan kehendaknya untuk beristri lebih dari seorang (poligami), tetapi tidak berhasil, dan oleh karena '
             '#0047# tidak pernah hadir di persidangan maka upaya penyelesaian sengketa melalui mediasi sebagaimana Peraturan Mahkamah Agung Republik Indonesia Nomor 1 Tahun 2016 '
             'tidak dapat dilaksanakan;'),
        40: ('Menimbang, bahwa #0046# guna meneguhkan',
             'Menimbang, bahwa #0046# guna meneguhkan dalil-dalil permohonannya telah mengajukan alat bukti tertulis dan telah menghadirkan dua orang saksi, sedangkan #0047# tidak hadir '
             'sehingga tidak mengajukan alat bukti apa pun;'),
        43: ('Menimbang, bahwa keterangan yang bersifat pengakuan', VERSTEK_BEBAN),
        44: ('Menimbang, bahwa dari bukti-bukti tersebut', 'Menimbang, bahwa dari bukti-bukti tersebut di atas yang dihubungkan dengan keterangan #0046# di depan persidangan, maka telah ditemukan fakta-fakta sebagai berikut:'),
    }
    sisip = {37: [(37, VERSTEK_PANGGIL, None), (37, VERSTEK_TIDAK_HADIR, None)]}
    return s, sisip


def amar_verstek(d, kabul):
    """Amar [01]/[03] untuk verstek: tambah butir "Menyatakan ... tidak hadir" dan "secara verstek", nomor digeser."""
    t_amar = None
    for i in range(len(d.par)):
        if d.isi(i).startswith('Mengabulkan permohonan') or d.isi(i).startswith('Menolak permohonan'):
            t_amar = i
            break
    return t_amar


# --------------------------------------------------------------------------------------------------------------- [01] tambal
def tambal_01():
    d = buka(B01)
    lama = md5b(open(os.path.join(ASLI, FOLDER, B01), 'rb').read())
    sunting = {
        48: ('4.\tBahwa #0047# telah menyatakan persetujuannya',
             '4.\tBahwa #0047# telah menyatakan persetujuannya #4857# bagi #0046# untuk menikah lagi;'),
        55: ('Menimbang, bahwa berdasarkan fakta angka 6',
             d.isi(55) + '#4860##4861#'),
    }
    # isi() mengembalikan teks tanpa label; label dipertahankan oleh ganti_teks
    isi = rakit(d, sunting)
    tulis('timpa', B01, isi, 'Kabul: bentuk persetujuan istri (4857) dan pertimbangan status calon istri, iddah, halangan, jumlah istri, izin Pengadilan (4860, 4861)', lama)


# --------------------------------------------------------------------------------------------------------------- [01a] Kabul Verstek
def baru_01a():
    d = buka(B01)
    s, sisip = sunting_kehadiran_verstek(False)
    s[48] = ('4.\tBahwa #0047# telah menyatakan persetujuannya', '4.\tBahwa #4862#;')
    s[53] = ('Menimbang, bahwa berdasarkan fakta angka 4', '#4863#')
    s[55] = ('Menimbang, bahwa berdasarkan fakta angka 6', d.isi(55) + '#4860##4861#')
    # amar: 1 Menyatakan tidak hadir; 2 Mengabulkan secara verstek; 3 harta; 4 izin; 5 biaya
    s[62] = ('1.\tMengabulkan permohonan', '1.\tMenyatakan #0047# yang telah dipanggil secara resmi dan patut untuk menghadap ke persidangan, tidak hadir;')
    s[63] = ('2.\tMenetapkan harta bersama', '3.\tMenetapkan harta bersama #0046# dan #0047# berupa: #8722#;')
    s[64] = ('3.\tMemberi izin kepada', '4.\tMemberi izin kepada #0046# (#0098#) untuk menikah lagi (poligami) dengan seorang perempuan yang bernama #8723#;')
    s[65] = ('4.\t#8505#', '5.\t#8505# (#0155# #7095#).')
    sesudah = {62: [(62, '2.\tMengabulkan permohonan #0046# secara verstek;', '2.')]}
    isi = rakit(d, s, sisip, sesudah)
    tulis('baru', '[01a] [Kabul Verstek] Izin Poligami - Termohon Tidak Hadir.rtf', isi, 'dari [01]: Termohon tidak hadir (Pasal 149 ayat (1) RBg), persetujuan istri lewat surat tertulis atau Pasal 5 ayat (2) UU 1/1974')


# --------------------------------------------------------------------------------------------------------------- [01b] Kabul Termohon Keberatan
def baru_01b():
    d = buka(B01)
    s = {
        21: ('Bahwa atas permohonan #0046# tersebut',
             'Bahwa atas permohonan #0046# tersebut, #0047# telah mengajukan jawaban secara #9881# yang pada pokoknya menyatakan keberatan atas rencana #0046# untuk menikah lagi dengan '
             '#8723# dengan alasan #4858#;'),
        31: ('Bahwa atas keterangan saksi tersebut',
             'Bahwa atas keterangan saksi tersebut, #0046# membenarkannya sedangkan #0047# menyatakan tetap pada keberatannya, kemudian #0046# dan #0047# tidak mengajukan sesuatu lagi '
             'dalam persidangan dan selanjutnya mohon putusan;'),
        40: ('Menimbang, bahwa #0046# guna meneguhkan',
             'Menimbang, bahwa #0046# guna meneguhkan dalil-dalil permohonannya telah mengajukan alat bukti tertulis dan telah menghadirkan dua orang saksi, sedangkan #0047# tidak '
             'mengajukan alat bukti dan hanya menyampaikan keberatannya di persidangan;'),
        43: ('Menimbang, bahwa keterangan yang bersifat pengakuan', '#4864#'),
        48: ('4.\tBahwa #0047# telah menyatakan persetujuannya',
             '4.\tBahwa #0047# telah menyatakan keberatan atas rencana #0046# untuk menikah lagi dengan alasan #4858# dan tidak memberikan persetujuan;'),
        53: ('Menimbang, bahwa berdasarkan fakta angka 4',
             'Menimbang, bahwa berdasarkan fakta angka 4, #0047# tidak memberikan persetujuan sehingga syarat persetujuan istri sebagaimana Pasal 5 ayat (1) huruf a Undang-Undang Nomor 1 '
             'Tahun 1974 jo. Pasal 58 ayat (1) huruf a Kompilasi Hukum Islam tidak terpenuhi, akan tetapi berdasarkan Pasal 59 Kompilasi Hukum Islam keadaan tersebut tidak menghalangi '
             'Pengadilan Agama untuk menetapkan pemberian izin setelah memeriksa dan mendengar #0047# di persidangan, sepanjang alasan dan syarat lainnya terpenuhi;'),
        55: ('Menimbang, bahwa berdasarkan fakta angka 6', d.isi(55) + '#4860##4861#'),
        57: ('Menimbang, bahwa dengan berdasarkan fakta-fakta',
             'Menimbang, bahwa dengan berdasarkan fakta-fakta tersebut di atas, maka #8554# berpendapat bahwa permohonan izin poligami yang diajukan oleh #0046# telah memenuhi '
             'ketentuan Pasal 4 ayat (2) dan Pasal 5 ayat (1) huruf b dan huruf c Undang-Undang Nomor 1 Tahun 1974 jo. Pasal 55 ayat (2), Pasal 57, Pasal 58 ayat (1) huruf b dan '
             'huruf c dan Pasal 59 Kompilasi Hukum Islam, sedangkan keberatan #0047# tidak menghalangi pemberian izin, oleh karena itu permohonan #0046# tersebut patut untuk dikabulkan;'),
    }
    isi = rakit(d, s)
    tulis('baru', '[01b] [Kabul] Izin Poligami - Termohon Keberatan (Pasal 59 KHI).rtf', isi, 'dari [01]: Termohon hadir tetapi keberatan; izin tetap dapat diberikan setelah Termohon didengar (Pasal 59 KHI)')


# --------------------------------------------------------------------------------------------------------------- [03a] Tolak Verstek
def baru_03a():
    d = buka(B03)
    s, sisip = sunting_kehadiran_verstek(True)
    s[43] = ('Menimbang, bahwa keterangan yang bersifat pengakuan', VERSTEK_BEBAN)
    s[51] = ('1.\tMenolak permohonan', '1.\tMenyatakan #0047# yang telah dipanggil secara resmi dan patut untuk menghadap ke persidangan, tidak hadir;')
    s[52] = ('2.\t#8505#', '3.\t#8505# (#0155# #7095#).')
    sesudah = {51: [(51, '2.\tMenolak permohonan #0046# secara verstek;', '2.')]}
    isi = rakit(d, s, sisip, sesudah)
    tulis('baru', '[03a] [Tolak Verstek] Izin Poligami - Termohon Tidak Hadir.rtf', isi, 'dari [03]: Termohon tidak hadir (Pasal 149 ayat (1) RBg), syarat tidak terbukti')


# --------------------------------------------------------------------------------------------------------------- [03b] Tolak Termohon Keberatan
def baru_03b():
    d = buka(B03)
    s = {
        21: ('Bahwa atas permohonan #0046# tersebut',
             'Bahwa atas permohonan #0046# tersebut, #0047# telah mengajukan jawaban secara #9881# yang pada pokoknya menyatakan keberatan atas rencana #0046# untuk menikah lagi dengan '
             '#8723# dengan alasan #4858#;'),
        31: ('Bahwa atas keterangan saksi tersebut',
             'Bahwa atas keterangan saksi tersebut, #0046# membenarkannya sedangkan #0047# menyatakan tetap pada keberatannya, kemudian #0046# dan #0047# tidak mengajukan sesuatu lagi '
             'dalam persidangan dan selanjutnya mohon putusan;'),
        40: ('Menimbang, bahwa #0046# guna meneguhkan',
             'Menimbang, bahwa #0046# guna meneguhkan dalil-dalil permohonannya telah mengajukan alat bukti tertulis dan telah menghadirkan dua orang saksi, sedangkan #0047# tidak '
             'mengajukan alat bukti dan hanya menyampaikan keberatannya di persidangan;'),
        43: ('Menimbang, bahwa keterangan yang bersifat pengakuan', '#4864#'),
    }
    isi = rakit(d, s)
    tulis('baru', '[03b] [Tolak] Izin Poligami - Termohon Keberatan.rtf', isi, 'dari [03]: Termohon keberatan dan syarat tidak terbukti')


def main():
    tambal_01()
    baru_01a()
    baru_01b()
    baru_03a()
    baru_03b()
    with open(os.path.join(AKAR, 'daftar-timpa-poligami.tsv'), 'w', encoding='utf-8', newline='\n') as f:
        for b in DAFTAR_TIMPA:
            f.write('\t'.join(b) + '\n')


if __name__ == '__main__':
    main()
