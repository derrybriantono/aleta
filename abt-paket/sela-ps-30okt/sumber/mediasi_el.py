# -*- coding: utf-8 -*-
"""Blangko mediasi elektronik (PERMA 3/2022) dirakit dari blangko mediasi biasa Derry yang sudah ada (berkas lama TIDAK diubah):
- BAS ALUR 04 [1e] di setiap folder BAS yang memuat "BAS ALUR 04 [1] BAS 1 P & T Hadir - Mediasi.rtf" (struktur paragrafnya diperiksa; folder dilewati bila jangkar tidak ada)
- 99 PTSP "@ 4a" dari "@ 4 - Penetapan Penunjukan Mediator.rtf".
Paragraf yang diubah disusun ulang dari teksnya dengan gaya paragraf aslinya; nomor variabel paragraf asal wajib sama sesudah diubah."""
import os
import re
import sys

import rtfbuat as R

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'alat'))
import paragraf  # noqa: E402
import rtf2txt  # noqa: E402

PERMA3 = 'Peraturan Mahkamah Agung Nomor 3 Tahun 2022 tentang Mediasi di Pengadilan secara Elektronik'
ASAL_BAS = 'BAS ALUR 04 [1] BAS 1 P & T Hadir - Mediasi.rtf'
ASAL_PTSP = ('derry_briantono/99 PTSP', '@ 4 - Penetapan Penunjukan Mediator.rtf')


def _teks(p):
    return rtf2txt.rtf_ke_teks(p).strip()


def _nomor(t):
    return sorted(set(re.findall(r'#\d{4,5}#', t)))


def _cari(ps, awal):
    hit = [i for i, p in enumerate(ps) if _teks(p).startswith(awal)]
    return hit[0] if len(hit) == 1 else None


def _ganti(ps, i, a, b):
    """Ganti frasa di dalam paragraf mentah (format asli tetap); frasa wajib utuh dalam satu potongan teks dan muncul sekali."""
    if ps[i].count(a) != 1 or _teks(ps[i]).count(a) != 1:
        return False
    ps[i] = ps[i].replace(a, b)
    return True


def _butir(contoh, nomor, teks):
    """Butir daftar bernomor bergaya butir contoh: nomor tegak, isi miring (seperti butir penjelasan mediasi Derry)."""
    return R.par(contoh, '%s.\t<i>%s</i>' % (nomor, teks))


def bas(raw):
    """Kembalikan RTF BAS mediasi elektronik, atau None bila jangkar tidak lengkap."""
    kep, ps, ekor = paragraf.pecah(raw)
    j = dict(b7=_cari(ps, '7.\tApabila para pihak sudah'), b6=_cari(ps, '6.\tApabila proses mediasi'), atas=_cari(ps, 'Atas penjelasan #4004#'),
             m154=_cari(ps, 'Menimbang, bahwa berdasarkan ketentuan Pasal 154'), ingat=_cari(ps, 'Memperhatikan ketentuan Pasal 20'),
             amar1=_cari(ps, '1.\tMemerintahkan kepada para pihak'), tunda=_cari(ps, 'Selanjutnya #4004# menyatakan sidang ditunda'))
    if any(v is None for v in j.values()) or not (j['b6'] + 1 == j['b7'] < j['atas'] < j['m154'] < j['ingat'] < j['amar1'] < j['tunda']):
        return None
    ok = all([
        _ganti(ps, j['ingat'], 'Prosedur Mediasi di Pengadilan serta', 'Prosedur Mediasi di Pengadilan jo. %s serta' % PERMA3),
        _ganti(ps, j['amar1'], 'untuk menempuh mediasi;', 'untuk menempuh mediasi secara elektronik #11400#;'),
        _ganti(ps, j['tunda'], 'untuk mengikuti proses mediasi', 'untuk mengikuti proses mediasi secara elektronik'),
    ])
    if not ok:
        return None
    # sisip dari belakang agar indeks depan tetap
    ps.insert(j['m154'] + 1, R.par(ps[j['m154']], 'Menimbang, bahwa para pihak telah menyatakan persetujuannya agar mediasi dilaksanakan secara elektronik #11400#, '
                                                 'sehingga berdasarkan %s, mediasi dalam perkara ini dilaksanakan secara elektronik dengan tetap memperhatikan '
                                                 'ketentuan Peraturan Mahkamah Agung Nomor 1 Tahun 2016 tentang Prosedur Mediasi di Pengadilan;' % PERMA3))
    ps.insert(j['atas'] + 1, R.par(ps[j['atas']], 'Selanjutnya #7036# dan #7037# menyatakan sepakat agar mediasi dilaksanakan secara elektronik #11400#, '
                                                 'dan masing-masing menyampaikan alamat domisili elektronik serta nomor telepon yang dapat dihubungi untuk keperluan mediasi;'))
    lama7 = _teks(ps[j['b7']]).split('\t', 1)[1]
    assert not _nomor(lama7)
    ps[j['b7']] = _butir(ps[j['b6']], 8, lama7)
    ps.insert(j['b7'], _butir(ps[j['b6']], 7, 'Berdasarkan %s, atas persetujuan para pihak, mediasi dapat dilaksanakan secara elektronik melalui media '
                                              'komunikasi audio visual jarak jauh yang memungkinkan semua pihak saling melihat dan mendengar secara langsung, dan '
                                              'kehadiran para pihak melalui sarana tersebut dianggap sebagai kehadiran langsung;' % PERMA3))
    return R.rakit(kep, ps, ekor, [11399])


def ptsp(raw):
    kep, ps, ekor = paragraf.pecah(raw)
    m20 = _cari(ps, 'Menimbang, bahwa oleh karena para pihak telah #8017#')
    amar1 = _cari(ps, '-\tMemerintahkan para pihak dalam perkara')
    amar_m = _cari(ps, '-\tMemerintahkan Mediator untuk melaksanakan mediasi')
    assert None not in (m20, amar1, amar_m) and m20 < amar1 < amar_m
    assert _ganti(ps, amar1, 'untuk menempuh proses mediasi;', 'untuk menempuh proses mediasi secara elektronik #11400#;')
    assert _ganti(ps, amar_m, 'untuk melaksanakan mediasi dengan', 'untuk melaksanakan mediasi secara elektronik dengan')
    ps.insert(m20 + 1, R.par(ps[m20], 'Menimbang, bahwa para pihak telah menyatakan persetujuannya agar mediasi dilaksanakan secara elektronik #11400#, '
                                      'sehingga berdasarkan %s, mediasi dalam perkara ini dilaksanakan secara elektronik dengan tetap memperhatikan ketentuan '
                                      'Peraturan Mahkamah Agung Nomor 1 Tahun 2016 tentang Prosedur Mediasi di Pengadilan;' % PERMA3))
    return R.rakit(kep, ps, ekor, [11399])
