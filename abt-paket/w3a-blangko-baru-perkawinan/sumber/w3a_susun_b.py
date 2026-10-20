# -*- coding: utf-8 -*-
"""Penyusun penetapan PERMOHONAN bersama untuk agen W3a-B (izin kawin dan pengesahan anak), 21 Okt 2026.

Dasar susunan: berkas Derry server "7 Wali Adhal/[01a]" (kerangka penetapan permohonan perkawinan: kepala, duduk perkara, bukti surat, dua saksi,
pertimbangan, amar, kaki putusan #8501#/#8502#/#8500#, rincian biaya). Paragraf dasar dipakai ulang lewat gaya paragrafnya; teks diganti seluruhnya.

Pakai:
    from w3a_susun_b import penetapan, sisip_bas, bas_header
    raw = penetapan(header='#3640# #3644#', dengar='Telah mendengar ...', duduk=[...], bukti='#3654#', timbang=[('b', '...'), ('n', '...'), ('h', '...')], amar=['...', '...'])
Jenis butir `timbang`:  ('b', teks) paragraf Menimbang | ('h', teks) judul sub-bagian | ('n', teks) butir bernomor (nomor otomatis 1., 2., ... bersambung
sampai ada butir bukan 'n').  `amar`: daftar teks butir amar (nomor otomatis).
"""
import re

import w3a_lib as L

DASAR = '7 Wali Adhal/[01a] [Kabul] Wali Adhal - Wali Hadir Tetap Enggan.rtf'
# indeks paragraf dasar (lihat alat/paragraf.py atas berkas dasar)
P_HEADER, P_DENGAR = 0, 11
P_DUDUK_MULAI, P_DUDUK_AKHIR = 17, 22          # paragraf 17-21 = acara sidang; 22 = "Bahwa untuk membuktikan ..."
P_BUKTI = 24
P_PERTIMBANGAN_HEAD, P_BODY, P_NOMOR = 32, 33, 39
P_TIMBANG_MULAI, P_TIMBANG_AKHIR = 33, 56        # 33..55 diganti
P_MENETAPKAN, P_AMAR_MULAI, P_AMAR_AKHIR = 56, 57, 61   # 57..60 diganti


def penetapan(header, dengar, duduk, bukti, timbang, amar, maksud=None):
    """RTF mentah penetapan permohonan. header: token isian tersembunyi (paragraf 0). dengar: kalimat "Telah mendengar ...".
    duduk: teks paragraf acara sidang (pengganti paragraf 17-21). bukti: token/teks daftar alat bukti surat. maksud: kalimat pembuka pertimbangan (opsional)."""
    d = L.dok(DASAR)
    out = []
    out.append(d.ganti_teks(P_HEADER, header))
    out.extend(d.par[1:P_DENGAR])
    out.append(d.ganti_teks(P_DENGAR, dengar))
    out.extend(d.par[P_DENGAR + 1:P_DUDUK_MULAI])
    for t in duduk:
        out.append(d.ganti_teks(P_DUDUK_MULAI, t))
    out.extend(d.par[P_DUDUK_AKHIR:P_BUKTI])
    out.append(d.ganti_teks(P_BUKTI, bukti))
    out.extend(d.par[P_BUKTI + 1:P_TIMBANG_MULAI])
    n = 0
    for jenis, t in timbang:
        if jenis == 'n':
            n += 1
            out.append(d.ganti_teks(P_NOMOR, '%d.\t%s' % (n, t)))
        else:
            n = 0
            out.append(d.ganti_teks(P_PERTIMBANGAN_HEAD if jenis == 'h' else P_BODY, t))
    out.append(d.par[P_MENETAPKAN])
    for i, t in enumerate(amar, 1):
        out.append(d.ganti_teks(P_NOMOR, '%d.\t%s' % (i, t)))
    out.extend(d.par[P_AMAR_AKHIR:])
    return d.rakit(out)


def tambah_header_bas(raw, token):
    """Ganti paragraf 0 (daftar token isian tersembunyi) sebuah BAS dengan `token`."""
    d = L.dok_dari_raw(raw)
    awal = d.isi(0)
    return d.rakit([d.ganti_teks(0, token)] + d.par[1:])


def sisip_sebelum(raw, cocok, teks_baru, klon_dari=None):
    """Sisipkan paragraf `teks_baru` SEBELUM paragraf pertama yang teksnya cocok regex `cocok`. Gaya paragraf = paragraf `klon_dari` (regex) atau paragraf pembanding sebelumnya."""
    d = L.dok_dari_raw(raw)
    rx = re.compile(cocok, re.S)
    target = next((i for i in range(len(d.par)) if rx.search(d.isi(i))), None)
    if target is None:
        raise SystemExit('sisip_sebelum: tidak ada paragraf /%s/' % cocok)
    sumber = target - 1
    if klon_dari:
        rk = re.compile(klon_dari, re.S)
        sumber = next(i for i in range(len(d.par)) if rk.search(d.isi(i)))
    baru = d.ganti_teks(sumber, teks_baru)
    return d.rakit(d.par[:target] + [baru] + d.par[target:])
