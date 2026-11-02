# -*- coding: utf-8 -*-
"""Perubahan format paragraf identitas pihak di blangko Derry (paket identitas-pihak-1nov; keputusan pengguna 101 dan 102).

Acuan (keputusan 102 = blangko "[01] [Kabul Verstek] Cerai (Format Lengkap)" folder "1 Perceraian CG", paragraf yang berisi HANYA penanda #7047# / #7048#):
    \\qj \\fi-1843 \\li2552 \\lin2552   = rata kanan-kiri; baris pertama menjorok 709 twips (1,25 cm); baris lanjutan menjorok gantung 2552 twips (4,5 cm);
    jarak 1,5 baris (\\sl360), nama pihak dan sebutan ("Penggugat") tebal - tebal berasal dari bunyi variabel (<strong>), bukan dari blangko.
Tiga golongan perubahan, semuanya hanya pada paragraf identitas (teks lain blangko tidak diubah):
  A. paragraf yang isinya HANYA #7047# atau #7048# tetapi menjorok lain (-1952/-1892/-1608/-1325 dst.) -> sepuluh angka menjorok disamakan dengan acuan.
  B. paragraf identitas TERTULIS TANGAN (nama, NIK, "tempat dan tanggal lahir (umur) ...", agama, pendidikan, pekerjaan, tempat kediaman, "sebagai Penggugat;" dst.
     dari variabel per bagian, tulisan "(umur)" tersisa) -> diganti penanda #7047# / #7048# dengan properti paragraf acuan: bunyinya sama dengan blangko putusan (kuasa ikut, tebal, umur).
  C. paragraf "#0046# I dan #0046# II selanjutnya ..." yang mengikuti dua paragraf Pemohon I/II (dispensasi kawin) -> menjorok acuan (hanya angka menjorok).
  D. (REVISI 2 Nov, keputusan 112) sisa tulisan umur di identitas tertulis tangan yang tidak tercakup B: "(umur) #nnnn#, #nnnn# (#nnnn# tahun)" -> "#nnnn#, #nnnn#".
Tidak diubah (disengaja): akta perdamaian ("I.<tab>#7047#" bernomor), identitas dalam sel tabel (BAS ikrar talak, BAS LAINNYA), relaas/PTSP, identitas ringkas."""
import re

BS = chr(92)
ACUAN = (-1843, 2552)
RE_PARD = re.compile(re.escape(BS + 'pard'))
RE_FI = re.compile(r'\\fi(-?\d+)(?![0-9a-z])')
RE_LIN = re.compile(r'\\lin(-?\d+)(?![0-9a-z])')
RE_LI = re.compile(r'\\li(-?\d+)(?![0-9a-z])')
RUN_BARU = '{\\fs24 \\rtlch \\ltrch \\dbch \\af5 \\hich \\af4 \\loch \\f4 %s}'

MANUAL = {
    '#0098#, NIK #0335#, tempat dan tanggal lahir (umur) #0341#, #0345# (#0099# tahun), agama #0011#, pendidikan #0021#, pekerjaan #0100#, tempat kediaman di #3517#, sebagai #0046#;': '#7047#',
    '#0102#, NIK #0337#, tempat dan tanggal lahir (umur) #0343#, #0347# (#0103# tahun), agama #0020#, pendidikan #0024#, pekerjaan #0104#, tempat kediaman di #3518#, sebagai #0047#;': '#7048#',
    '#0098#, NIK #0335#, tempat dan tanggal lahir (umur) #0341#, #0345# (#0099# tahun), agama #0011#, pendidikan #0021#, pekerjaan #0100#, tempat kediaman di #3517#, sebagai #0046# I;': '#7047#',
}
MANUAL_HAPUS = {
    '#1033#, NIK #0336#, tempat dan tanggal lahir (umur) #0342#, #0346# (#1034# tahun), agama #0010#, pendidikan #1176#, pekerjaan #1035#, tempat kediaman di #3519#, sebagai #0046# II;',
}
LANJUT = '#0046# I dan #0046# II selanjutnya'
RE_SENDIRI = re.compile(r'^(#7047#|#7048#)(#8710#)?(#7054#)?$')
# D (revisi 2 Nov, keputusan 112): identitas tertulis tangan yang TIDAK cocok dengan MANUAL (mis. ";" pada run terpisah di "[99] BAS LAINNYA" folder BAS lama):
# hanya tulisan umur "(umur)" dan "(#nnnn# tahun)" dibuang dari teksnya, gaya tulisan tangan dibiarkan.
RE_UMUR = re.compile(r'\(umur\) (#\d{4}#, #\d{4}#) \(#\d{4}# tahun\)')


class Lewat(Exception):
    pass


def teks(seg):
    """teks polos paragraf: buang kelompok/kendali RTF sederhana (cukup untuk paragraf identitas), spasi dirapatkan."""
    t = re.sub(r'\{\\listtext.*?\}', '', seg, flags=re.S)
    t = re.sub(r'\\\'[0-9a-fA-F]{2}', '?', t)
    t = t.replace('\\tab', ' ').replace('\\~', ' ')
    t = re.sub(r'\\par(?![a-z])', ' ', t)
    t = re.sub(r'\\[a-zA-Z]+-?\d* ?', '', t)
    t = t.replace('{', '').replace('}', '')
    return re.sub(r'\s+', ' ', t).strip()


def paragraf(raw):
    pos = [m.start() for m in RE_PARD.finditer(raw)]
    return [(a, z) for a, z in zip(pos, pos[1:] + [len(raw)])]


def ppr_akhir(seg):
    e = seg.find('{')
    if e < 0:
        raise Lewat('paragraf tanpa kelompok')
    return e


def ppr_acuan(ppr):
    """ppr dengan \\fi \\li \\lin diganti acuan; ketiganya wajib ada (diperiksa)."""
    for rx in (RE_FI, RE_LI, RE_LIN):
        if len(rx.findall(ppr)) != 1:
            raise Lewat('properti menjorok tidak tunggal')
    baru = RE_FI.sub('\\\\fi%d' % ACUAN[0], ppr)
    baru = RE_LIN.sub('\\\\lin%d' % ACUAN[1], baru)
    baru = RE_LI.sub('\\\\li%d' % ACUAN[1], baru)
    return baru


def sudah_acuan(ppr):
    return RE_FI.findall(ppr) == [str(ACUAN[0])] and RE_LI.findall(ppr) == [str(ACUAN[1])] and RE_LIN.findall(ppr) == [str(ACUAN[1])]


def rancang(raw):
    """-> (potongan [(offset, lama, baru)], info dict). info: A, B, C (jumlah paragraf per golongan)."""
    pot = []
    info = {'A': 0, 'B': 0, 'C': 0, 'D': 0, 'hapus': 0}
    par = paragraf(raw)
    i = 0
    sesudah_hapus = False
    while i < len(par):
        a, z = par[i]
        seg = raw[a:z]
        habis_hapus, sesudah_hapus = sesudah_hapus, False
        if not habis_hapus and '#7047#' not in seg and '#7048#' not in seg and 'NIK #03' not in seg and '#1033#' not in seg:
            i += 1
            continue
        t = teks(seg)
        if '{' not in seg:
            i += 1
            continue
        e = ppr_akhir(seg)
        ppr = seg[:e]
        if BS + 'intbl' in ppr:
            i += 1
            continue
        if RE_SENDIRI.match(t):
            if not sudah_acuan(ppr):
                pot.append((a, ppr, ppr_acuan(ppr)))
                info['A'] += 1
        elif t in MANUAL:
            idx = seg.rfind('{')
            akhir = seg[idx:]
            if BS + 'par' not in akhir:
                raise Lewat('akhir paragraf tanpa \\par')
            baru = ppr_acuan(ppr) + (RUN_BARU % MANUAL[t]) + akhir
            pot.append((a, seg, baru))
            info['B'] += 1
        elif t in MANUAL_HAPUS:
            # hanya dibuang bila paragraf sebelumnya baru saja diganti (pasangan I/II)
            if not (pot and pot[-1][0] == par[i - 1][0] and info['B']):
                raise Lewat('paragraf Pemohon II tanpa pasangan Pemohon I')
            pot.append((a, seg, ''))
            info['hapus'] += 1
            sesudah_hapus = True
        elif habis_hapus and t.startswith(LANJUT):
            if not sudah_acuan(ppr):
                pot.append((a, ppr, ppr_acuan(ppr)))
                info['C'] += 1
        i += 1
    for m in RE_UMUR.finditer(raw):
        if any(o <= m.start() < o + len(l) for o, l, _ in pot):
            continue
        pot.append((m.start(), m.group(0), m.group(1)))
        info['D'] += 1
    return pot, info


def terapkan(raw, pot):
    for off, lama, baru in sorted(pot, key=lambda x: -x[0]):
        assert raw[off:off + len(lama)] == lama, (off, lama[:50])
        raw = raw[:off] + baru + raw[off + len(lama):]
    return raw
