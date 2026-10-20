# -*- coding: utf-8 -*-
"""Menyusun blangko Derry keluarga LAIN-LAIN (agen W2b-C) dari berkas dasar server TERBARU.

  W2B_ASLI = folder salinan derry_briantono dari server (bawaan D:/aleta-dev/kerja/w2b-lain-asli/derry_briantono)
  python susun_lain.py          -> menulis timpa/derry_briantono/<folder>/<berkas>.rtf, rtf/derry_briantono/<folder>/<berkas>.rtf,
                                   daftar-timpa-lain.tsv (folder, berkas, md5 LAMA server, md5 BARU, keterangan)

Blangko lama yang ditambal (timpa, penjaga md5 saat pemasangan):
  9a Lain-Lain (Pengangkatan Anak)/[01] [Kabul] : hubungan keluarga atau bukan (4916), syarat calon anak angkat (4917), syarat calon orang tua angkat (4918),
                                                  akibat hukum: nasab, wasiat wajibah, wali nikah, pemberitahuan asal-usul (4919)
Blangko baru: lihat fungsi di bawah (9b Permohonan Umum Kabul dan Tolak, 9c, dst.).
Tidak ada yang dihapus dari blangko lama: hanya paragraf BARU disisipkan dan satu kalimat tetap diganti variabel yang berisi kalimat yang sama bila datanya ada.
"""
import hashlib
import os
import sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(AKAR, 'alat'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bangun import Dok, simpan, periksa_token  # noqa: E402

ASLI = os.environ.get('W2B_ASLI', 'D:/aleta-dev/kerja/w2b-lain-asli/derry_briantono')
PREFIKS = 'derry_briantono/'
DAFTAR = []  # (folder, berkas, md5_lama, md5_baru, ket)
# pemisah baris Menimbang di dalam satu paragraf berkas Derry: teks baru + akhir baris + awal baris berikutnya
SISIP_BARIS = 'TEKS' + chr(13) + chr(10) + chr(92) + 'par ' + chr(92) + 'hich' + chr(92) + 'af1' + chr(92) + 'dbch' + chr(92) + 'af13' + chr(92) + 'loch' + chr(92) + 'f1 ' + chr(13) + chr(10)


def md5b(b):
    return hashlib.md5(b).hexdigest()


def cek_token(isi, nama):
    pecah = periksa_token(isi)
    if pecah:
        raise SystemExit('token terpecah di %s: %r' % (nama, pecah))


def simpan_timpa(folder, berkas, d, out, ket):
    isi = d.rakit(out)
    cek_token(isi, berkas)
    simpan(os.path.join(AKAR, 'timpa', PREFIKS + folder, berkas), isi)
    lama = md5b(open(os.path.join(ASLI, folder, berkas), 'rb').read())
    DAFTAR.append((PREFIKS + folder, berkas, lama, md5b(isi.encode('latin1')), ket))
    print('timpa', folder, berkas[:70])


def simpan_baru(folder, berkas, d, out):
    isi = d.rakit(out)
    cek_token(isi, berkas)
    simpan(os.path.join(AKAR, 'rtf', PREFIKS + folder, berkas), isi)
    print('baru ', folder, berkas[:70])


def ada(d, awalan):
    return [i for i in range(len(d.par)) if d.isi(i).startswith(awalan)]


def satu(d, awalan):
    a = ada(d, awalan)
    if len(a) != 1:
        raise SystemExit('jangkar %r muncul %d kali' % (awalan[:70], len(a)))
    return a[0]


def ganti_raw(par, lama, baru):
    if par.count(lama) != 1:
        raise SystemExit('jangkar mentah %r muncul %d kali' % (lama[:70], par.count(lama)))
    return par.replace(lama, baru)


# ---------------------------------------------------------------------------------------------------------------------
def kabul_pengangkatan():
    folder, berkas = '9a Lain-Lain (Pengangkatan Anak)', '[01] [Kabul] Pengangkatan Anak.rtf'
    d = Dok(os.path.join(ASLI, folder, berkas))
    i_legal = satu(d, 'Menimbang, mengenai legal standing')
    i_fakta = satu(d, 'Bahwa #7036# adalah seorang Warga Negara Indonesia beragama Islam')
    i_lines = satu(d, 'Menimbang, bahwa selanjutnya #8554# akan meninjau permohonan ini')  # paragraf berisi beberapa baris Menimbang
    out = []
    for i in range(len(d.par)):
        if i == i_fakta:
            out.append(ganti_raw(d.par[i], 'Bahwa antara #7036# dan calon anak angkat terdapat hubungan keluarga, di mana #7036# adalah #8623# dari anak tersebut', '#4916#'))
        elif i == i_lines:
            kesimpulan = 'Menimbang, bahwa berdasarkan seluruh pertimbangan di atas'
            garis_baru = SISIP_BARIS.replace('TEKS', '#4919#')
            out.append(ganti_raw(d.par[i], kesimpulan, garis_baru + kesimpulan))
        else:
            out.append(d.par[i])
        if i == i_legal:
            out.append(d.ganti_teks(i, '#4917#'))
            out.append(d.ganti_teks(i, '#4918#'))
    simpan_timpa(folder, berkas, d, out, 'Pengangkatan anak Kabul: syarat calon anak angkat dan calon orang tua angkat (PP 54/2007), hubungan keluarga atau bukan, akibat hukum (nasab, wasiat wajibah, wali nikah, asal-usul)')


def main():
    kabul_pengangkatan()
    for mod in ('susun_lain_umum', 'susun_lain_mafqud'):
        try:
            m = __import__(mod)
        except ModuleNotFoundError as e:
            if e.name != mod:
                raise
            continue
        m.jalan(sys.modules[__name__])
    tsv = '\n'.join('\t'.join(x) for x in sorted(DAFTAR)) + '\n'
    with open(os.path.join(AKAR, 'daftar-timpa-lain.tsv'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('# folder<TAB>berkas<TAB>md5 LAMA server<TAB>md5 BARU<TAB>keterangan (keluarga lain-lain, agen W2b-C)\n' + tsv)


if __name__ == '__main__':
    main()
