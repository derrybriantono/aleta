# -*- coding: utf-8 -*-
"""6.2 - titik koma di TENGAH paragraf teks RTF sumber blangko Derry (G6, 30 Okt 2026).

Keputusan pengguna 30 Okt: ";" hanya di AKHIR butir; ";" di tengah jadi ",". Paket titik-koma-30okt/-data-30okt sudah merapikan ISIAN
(fungsi perangkai dan data tersimpan). Di sini TEKS BLANGKO sendiri. Tiap ";" yang masih diikuti teks dalam paragraf yang sama digolongkan:

  kutipan-berhuruf   butir peraturan/daftar: sesudahnya "(b)", "b.", "(2)", "2.", "huruf", "angka" (benar - dibiarkan)
  pilih-petunjuk     petunjuk ketik untuk petugas: sesudahnya "(PILIH ...", "(APABILA ...", huruf besar (dibiarkan)
  susunan-majelis    "... sebagai Hakim Anggota; dan dibantu ...", "Ketua Majelis; ..." (gaya kaki putusan - dibiarkan)
  akhir-butir        sesudahnya HANYA penanda variabel yang hasilnya selalu diawali baris baru (<br>/\\n) atau kosong: di cetakan ";" ada
                     di akhir paragraf (benar - dibiarkan)
  penanda-sebaris    sesudahnya penanda yang hasilnya sebaris (nama, angka, kalimat) - TIDAK dapat dipastikan dari teks (dibiarkan, dilaporkan)
  salah-tanda-baca   sesudahnya kata huruf kecil yang MELANJUTKAN kalimat ("...tidak berhasil; dan oleh karena ...") -> DIPERBAIKI jadi ","
  lain               selain itu (dibiarkan, dilaporkan)
"""
import re

from rtf_peta import peta

RE_PENANDA = re.compile(r'#(\d{4,5})#')
BARIS_BARU = None  # diisi bangun_paket: set nomor variabel yang hasilnya selalu diawali baris baru atau kosong


def mulai_baris_baru(sql):
    """Kueri data_sql yang SEMUA cabang keluarannya diawali <br>/\\n atau kosong (heuristik ketat atas literal keluaran)."""
    if not sql:
        return False
    lit = re.findall(r'(?:THEN|ELSE|IF\([^,]*,|CONCAT\(|,)\s*(["\'])(.*?)\1', sql, re.S)
    if not lit:
        return False
    for _, isi in lit:
        if isi == '' or isi.startswith('<br') or isi.startswith('\\n') or isi.startswith('<li'):
            continue
        return False
    return True


def golong(sebelum, sesudah):
    s = sesudah.lstrip()
    b = sebelum.rstrip()
    if re.match(r'(dan|atau|serta)?\s*(\(\s*[a-zA-Z0-9]{1,3}\s*\)|[a-zA-Z0-9]{1,2}\.\s|huruf\s|angka\s)', s):
        return 'kutipan-berhuruf'
    if re.match(r'\(\s*[A-Z]{3,}', s) or re.match(r'[A-Z]{4,}\b', s):
        return 'pilih-petunjuk'
    if re.search(r'(Hakim Anggota|Ketua Majelis|Hakim Ketua|Hakim Tunggal|Panitera Pengganti|Panitera Sidang)$', b) or re.match(r'dan dibantu', s):
        return 'susunan-majelis'
    m = re.match(r'((?:#\d{4,5}#\s*)+)(.*)$', s)
    if m:
        nos = [int(x) for x in RE_PENANDA.findall(m.group(1))]
        if not m.group(2).strip() and BARIS_BARU is not None and all(n in BARIS_BARU for n in nos):
            return 'akhir-butir'
        return 'penanda-sebaris'
    if re.fullmatch(r'(dan|atau|serta)\s*', s):
        return 'akhir-butir-daftar'  # "...; dan" di akhir butir daftar (butir berikut di paragraf lain) - benar
    if re.match(r'bahwa\b', s):
        return 'bahwa-berangkai'  # "Menimbang, bahwa ...; bahwa ..." gaya pertimbangan berangkai - dibiarkan, ditanyakan
    if re.match(r'[a-z]', s) and not re.search(r'["“][^"”]*$', b):
        return 'salah-tanda-baca'
    return 'lain'


def semua(raw):
    """-> [(posisi_raw, golongan, sebelum, sesudah)] untuk tiap ';' tampak yang diikuti teks di paragraf yang sama."""
    teks, idx = peta(raw)
    hasil = []
    awal = 0
    for par in teks.split('\n'):
        akhir = awal + len(par)
        for m in re.finditer(';', par):
            sesudah = par[m.end():]
            if not re.search(r'[A-Za-z0-9#]', sesudah):
                continue
            sebelum = par[:m.start()]
            if re.search(r'&[A-Za-z#0-9]{2,8}$', sebelum):
                continue  # entitas HTML
            if sebelum[-1:] in (';', ',', '.', ':', ' '):
                g = 'tanda-ganda-atau-spasi'
            else:
                g = golong(sebelum, sesudah)
            hasil.append((idx[awal + m.start()], g, sebelum[-70:], sesudah[:50]))
        awal = akhir + 1
    return hasil


def rencana(rel, raw, catat):
    """Ubahan [(awal, akhir, ',')] untuk tiap ';' golongan salah-tanda-baca (koordinat raw); catat (berkas, sebelum, sesudah)."""
    keluar = []
    for pos, g, sb, sd in semua(raw):
        if g != 'salah-tanda-baca':
            continue
        assert pos >= 0 and raw[pos] == ';', (rel, pos)
        keluar.append((pos, pos + 1, ','))
        catat.append((rel, sb[-50:] + '[;]' + sd[:40], sb[-50:] + '[,]' + sd[:40]))
    return sorted(keluar)


def perbaiki(rel, raw, catat):
    """Ganti ';' golongan salah-tanda-baca dengan ',' tepat di posisinya; catat (berkas, sebelum, sesudah)."""
    ubah = [x for x in semua(raw) if x[1] == 'salah-tanda-baca']
    if not ubah:
        return raw
    s = list(raw)
    for pos, _, sb, sd in ubah:
        assert pos >= 0 and s[pos] == ';', (rel, pos)
        s[pos] = ','
        catat.append((rel, sb[-50:] + '[;]' + sd[:40], sb[-50:] + '[,]' + sd[:40]))
    return ''.join(s)
