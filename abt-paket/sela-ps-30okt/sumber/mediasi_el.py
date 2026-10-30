# -*- coding: utf-8 -*-
"""Blangko mediasi elektronik (PERMA 3/2022) dirakit dari blangko mediasi biasa Derry yang sudah ada (berkas lama TIDAK diubah):
- BAS sidang pertama mediasi: "BAS ALUR 04 [1] / 05 [1] BAS 1 P & T Hadir - Mediasi.rtf" di setiap folder BAS, dan ALUR 34 (poligami), 36 (cerai
  kumulasi itsbat), 37 (cerai gugat kumulasi hak asuh) "Sidang 1 - ... Mediasi.rtf" -> nama berkas baru lewat nama_elektronik();
  jangkar paragraf diperiksa, berkas tanpa jangkar lengkap dilewati dan DILAPORKAN (pembangun berhenti bila ada yang terlewat).
- 99 PTSP "@ 4a" dari "@ 4 - Penetapan Penunjukan Mediator.rtf".
Rujukan pasal dicocokkan dengan naskah resmi PERMA 3/2022 (salinan BN 2022 Nomor 535, dari pengguna 30 Okt): lihat MENIMBANG di bawah;
kehadiran audio visual dianggap kehadiran langsung = Pasal 5 ayat (3) dan Pasal 6 ayat (2) PERMA 1/2016 (berlaku lewat Pasal 25 PERMA 3/2022)."""
import os
import re
import sys

import rtfbuat as R

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'alat'))
import paragraf  # noqa: E402
import rtf2txt  # noqa: E402

PERMA3 = 'Peraturan Mahkamah Agung Nomor 3 Tahun 2022 tentang Mediasi di Pengadilan secara Elektronik'
PERMA1 = 'Peraturan Mahkamah Agung Nomor 1 Tahun 2016 tentang Prosedur Mediasi di Pengadilan'
ASAL_BAS = 'BAS ALUR 04 [1] BAS 1 P & T Hadir - Mediasi.rtf'
POLA_ASAL = re.compile(r'^(?:BAS ALUR 0[45] \[1\] BAS 1 P & T Hadir - Mediasi'
                       r'|BAS ALUR 34 Poligami - Sidang 1 - P & T Hadir - Mediasi'
                       r'|BAS ALUR 36 Cerai Kumulasi IN - T Hadir - Sidang 1 - Mediasi'
                       r'|BAS ALUR 37 CG Kumulasi Hak Asuh - Sidang 1 - P & T Hadir - Mediasi)\.rtf$')
ASAL_PTSP = ('derry_briantono/99 PTSP', '@ 4 - Penetapan Penunjukan Mediator.rtf')


def nama_elektronik(asal):
    """Nama berkas BAS mediasi elektronik dari nama BAS mediasi biasa; None bila bukan BAS sumber."""
    if not POLA_ASAL.match(asal):
        return None
    return asal.replace(' [1] BAS 1 ', ' [1e] BAS 1 ').replace(' - Mediasi.rtf', ' - Mediasi Elektronik (PERMA 3 2022).rtf')


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


# Bunyi naskah resmi PERMA 3/2022 (salinan BN 2022 Nomor 535): Pasal 5 ayat (1) persetujuan, Pasal 6 formulir, Pasal 8 ayat (2) penetapan penunjukan
# Mediator dan perintah melakukan Mediasi Elektronik, Pasal 10 ayat (3) aplikasi dalam persetujuan tertulis, Pasal 12 ruang virtual tempat mediasi yang
# sah, Pasal 23 pernyataan berhasil/tidak berhasil melalui SIP, Pasal 25 PERMA 1/2016 tetap berlaku.
MENIMBANG = ('Menimbang, bahwa para pihak telah menyatakan persetujuannya agar mediasi dilaksanakan secara elektronik #11400#, dan persetujuan tersebut '
             'dituangkan dalam formulir persetujuan Mediasi Elektronik yang ditandatangani para pihak, sehingga berdasarkan Pasal 5 ayat (1), Pasal 6, dan '
             'Pasal 8 ayat (2) ' + PERMA3 + ', perlu diterbitkan penetapan penunjukan Mediator dan perintah melakukan Mediasi Elektronik; dan berdasarkan '
             'Pasal 12 Peraturan Mahkamah Agung tersebut, Ruang Virtual Mediasi Elektronik merupakan tempat mediasi yang sah sebagaimana ruang mediasi di '
             'pengadilan, sedangkan berdasarkan Pasal 25-nya, ' + PERMA1 + ' tetap berlaku dalam Mediasi Elektronik sepanjang tidak ditentukan lain;')
LAPOR = ('menyampaikan pernyataan mediasi berhasil atau tidak berhasil secara elektronik melalui Sistem Informasi Pengadilan kepada')


def bas(raw):
    """Kembalikan RTF BAS mediasi elektronik, atau None bila jangkar tidak lengkap."""
    kep, ps, ekor = paragraf.pecah(raw)
    j = dict(b7=_cari(ps, '7.\tApabila para pihak sudah'), b6=_cari(ps, '6.\tApabila proses mediasi'), atas=_cari(ps, 'Atas penjelasan #4004#'),
             pilih=None, m154=_cari(ps, 'Menimbang, bahwa berdasarkan ketentuan Pasal 154'), ingat=_cari(ps, 'Memperhatikan ketentuan Pasal 20'),
             amar1=_cari(ps, '1.\tMemerintahkan kepada para pihak'), amar4=_cari(ps, '4.\tMemerintahkan kepada Mediator untuk melaporkan'),
             tunda=_cari(ps, 'Selanjutnya #4004# menyatakan sidang ditunda'))
    pilih = [i for i, p in enumerate(ps) if 'memilih #0056# sebagai mediator' in _teks(p)]
    j['pilih'] = pilih[0] if len(pilih) == 1 else None
    if any(v is None for v in j.values()) or not (j['b6'] + 1 == j['b7'] < j['atas'] < j['pilih'] < j['m154'] < j['ingat'] < j['amar1'] < j['tunda']):
        return None
    # sebutan para pihak mengikuti blangko asalnya (ALUR 34 memakai #0046#/#0047#, lainnya #7036#/#7037#)
    p_, t_ = ('#0046#', '#0047#') if _teks(ps[j['pilih']]).startswith('#0046#') else ('#7036#', '#7037#')
    ok = all([
        _ganti(ps, j['ingat'], 'Prosedur Mediasi di Pengadilan serta',
               'Prosedur Mediasi di Pengadilan jo. Pasal 5 ayat (1), Pasal 6, Pasal 8 ayat (2), dan Pasal 12 %s serta' % PERMA3),
        _ganti(ps, j['amar1'], 'untuk menempuh mediasi;', 'untuk menempuh mediasi secara elektronik #11400#;'),
        _ganti(ps, j['amar4'], 'melaporkan hasil mediasi kepada', LAPOR),
        _ganti(ps, j['tunda'], 'untuk mengikuti proses mediasi', 'untuk mengikuti proses mediasi secara elektronik'),
    ])
    if not ok:
        return None
    # sisip dari belakang agar indeks depan tetap
    ps.insert(j['m154'] + 1, R.par(ps[j['m154']], MENIMBANG))
    ps.insert(j['atas'] + 1, R.par(ps[j['atas']], 'Selanjutnya %s dan %s menyatakan sepakat agar mediasi dilaksanakan secara elektronik #11400#, lalu '
                                                 'menandatangani formulir persetujuan Mediasi Elektronik, dan masing-masing menyerahkan kartu tanda '
                                                 'penduduk atau kartu identitas lainnya dan pas foto berwarna terbaru dengan dilampiri keterangan Domisili '
                                                 'Elektronik untuk dicatat dalam Administrasi Mediasi Elektronik;' % (p_, t_)))
    lama7 = _teks(ps[j['b7']]).split('\t', 1)[1]
    assert not _nomor(lama7)
    ps[j['b7']] = _butir(ps[j['b6']], 8, lama7)
    ps.insert(j['b7'], _butir(ps[j['b6']], 7, 'Berdasarkan %s, Mediasi Elektronik merupakan alternatif tata cara mediasi di pengadilan dalam hal para '
                                              'pihak menghendaki (Pasal 3), dapat dilaksanakan setelah para pihak dan/atau kuasanya memberikan persetujuan, '
                                              'sedangkan apabila salah satu pihak tidak menyetujui, mediasi dilaksanakan secara manual (Pasal 5); persetujuan '
                                              'dituangkan dalam formulir persetujuan Mediasi Elektronik (Pasal 6); pertemuan diselenggarakan di ruang virtual '
                                              'dalam Aplikasi yang disepakati, yang merupakan tempat mediasi yang sah sebagaimana ruang mediasi di pengadilan, '
                                              'dan pembiayaan Aplikasi ditanggung para pihak (Pasal 11 dan Pasal 12); kesepakatan perdamaian dapat '
                                              'ditandatangani secara elektronik dengan Tanda Tangan Elektronik (Pasal 24 ayat (2)); dan berdasarkan Pasal 5 '
                                              'ayat (3) dan Pasal 6 ayat (2) %s, kehadiran para pihak melalui komunikasi audio visual jarak jauh dianggap '
                                              'sebagai kehadiran langsung;' % (PERMA3, PERMA1)))
    return R.rakit(kep, ps, ekor, [11399])


def ptsp(raw):
    kep, ps, ekor = paragraf.pecah(raw)
    m20 = _cari(ps, 'Menimbang, bahwa oleh karena para pihak telah #8017#')
    ingat = _cari(ps, 'Mengingat, Pasal 154 RBg')
    amar1 = _cari(ps, '-\tMemerintahkan para pihak dalam perkara')
    amar_m = _cari(ps, '-\tMemerintahkan Mediator untuk melaksanakan mediasi')
    assert None not in (m20, ingat, amar1, amar_m) and m20 < ingat < amar1 < amar_m
    assert _ganti(ps, amar1, 'untuk menempuh proses mediasi;', 'untuk menempuh proses mediasi secara elektronik #11400#;')
    assert _ganti(ps, amar_m, 'untuk melaksanakan mediasi dengan', 'untuk melaksanakan mediasi secara elektronik dengan')
    assert _ganti(ps, amar_m, 'melaporkan hasilnya secara tertulis kepada', LAPOR)
    assert _ganti(ps, ingat, 'dan Peraturan Mahkamah Agung Nomor 3 Tahun 2022',
                  'dan Pasal 5 ayat (1), Pasal 6, Pasal 8 ayat (2), dan Pasal 12 Peraturan Mahkamah Agung Nomor 3 Tahun 2022')
    ps.insert(m20 + 1, R.par(ps[m20], MENIMBANG))
    return R.rakit(kep, ps, ekor, [11399])
