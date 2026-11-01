# -*- coding: utf-8 -*-
"""
Paket ABT tanya-jawab-format-1nov (keputusan pengguna 85 dan 86, 1 Nov 2026), KE-29, sesudah bas-lanjutan-1nov.

1. Semua tanya jawab yang TERTULIS TANGAN sebagai tabel dua kolom di blangko BAS/putusan Derry (majelis atau pihak bertanya kepada
   pihak/saksi: "Kepada Penggugat;", "Apakah ...?", jawaban) diubah ke bentuk keluaran ABT (Abt_model::kolom_kode_A4, jenis kertas A4):
   pertanyaan di sel KIRI (rata kanan-kiri), baris di bawahnya jawaban di sel KANAN diawali "- " (tanda "- " rata kanan di sel kiri),
   lebar sel 4250/8500 seragam. Teks pertanyaan/jawaban, huruf, dan penanda #nnnn# TIDAK diubah; yang berubah hanya kode tabelnya.
2. 99 BAS yang menulis "Susunan majelis yang bersidang sama dengan sidang yang lalu;" sebagai teks biasa diganti penanda #5404#
   (variabel ABT 5404, otomatis menyebut pergantian majelis/PP), dengan paragraf berformat sama seperti paket bas-lanjutan-1nov.

pakai: python bangun_paket.py <akar _blangko_abt sesudah 28 paket> <folder paket-satker> <folder hasil>
"""
import base64
import hashlib
import io
import os
import re
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SINI)
import tjformat as T  # noqa: E402
from tjformat import BS, Lewat  # noqa: E402
from rtf2txt import rtf_ke_teks  # noqa: E402

KALIMAT = 'Susunan majelis yang bersidang sama dengan sidang yang lalu;'
RE_FI = re.compile(r'\\fi(-?\d+)(?![0-9])')
RE_LI0 = re.compile(r'\\li0(?![0-9a-z])')
RE_GANTUNG = re.compile(r'\\fi-(\d+)(\s?)\\li(\d+)(?![0-9])')
PENANDA = re.compile(r'#\d{3,5}#')


def md5b(b):
    return hashlib.md5(b).hexdigest()


def seimbang(raw):
    d = 0
    k = 0
    while k < len(raw):
        c = raw[k]
        if c == BS:
            k += 2
            continue
        if c == '{':
            d += 1
        elif c == '}':
            d -= 1
            if d < 0:
                return False
        k += 1
    return d == 0


def teks_sel(rows):
    keluar = []
    for b in rows:
        for c in b['cells']:
            t = rtf_ke_teks(c).strip()
            if t:
                keluar.append(re.sub(r'\s+', ' ', t))
    return keluar


def periksa_region(rows, bentuk, baru):
    """Teks sama persis (kecuali tanda '- ' baru), penanda sama, kurung seimbang, semua sel berlebar ABT."""
    lama_t = teks_sel(rows)
    # teks baru: pecah per sel lewat \cell
    sel = re.split(r'\\cell(?![a-zA-Z])', baru)
    baru_t = []
    for s in sel:
        s = s.replace('}', '', 1) if False else s
        t = re.sub(r'\s+', ' ', rtf_ke_teks(s.split(BS + 'row ')[-1]).strip())
        if t:
            baru_t.append(t)
    baru_t = [t for t in baru_t if t != '-']
    if lama_t != baru_t:
        raise Lewat('teks berubah: %r != %r' % (lama_t[:3], baru_t[:3]))
    if not seimbang(baru):
        raise Lewat('kurung tidak seimbang di tabel baru')
    lama_raw = ''.join(c for b in rows for c in b['cells'])
    if sorted(PENANDA.findall(lama_raw)) != sorted(PENANDA.findall(baru)):
        raise Lewat('penanda berubah')
    for w in re.findall(r'\\cellx(\d+)', baru):
        if w not in ('4250', '8500'):
            raise Lewat('lebar sel bukan ABT: ' + w)
    # jumlah "\\row" = jumlah baris keluaran
    n_baris = sum(2 if j == 'B' else 1 for j in bentuk)
    if len(re.findall(r'\\row(?![a-z])', baru)) != n_baris:
        raise Lewat('jumlah baris keluaran salah')


def kepala(raw, a):
    return raw[a:raw.index('{', a)]


def rancang_5404(raw):
    """Paragraf kalimat "Susunan majelis ... lalu;" (satu run, beberapa run, atau teks langsung sesudah pard) -> "#5404#";
    paragraf berformat biasa (inden baris pertama = paragraf sesudahnya, kiri 0)."""
    kandidat = []
    for m in re.finditer('Susunan majelis', raw):
        i = m.start()
        a = raw.rfind(BS + 'pard', 0, i)
        zm = re.compile(r'\\par(?![a-z])').search(raw, i)
        if a < 0 or not zm:
            continue
        z = zm.start()
        gs = raw.rfind('{', i, z)
        akhir = gs if gs >= 0 and re.fullmatch(r'(?:\\[a-zA-Z]+-?\d* ?)*', raw[gs + 1:z]) else z
        k = raw.find('{', a)
        if 0 <= k < i:
            awal = k
        else:
            awal = i
        isi = raw[awal:akhir]
        if re.sub(r'\s+', ' ', rtf_ke_teks(isi).strip()) == KALIMAT and (a, awal) not in [(x[0], x[1]) for x in kandidat]:
            kandidat.append((a, awal, akhir, isi))
    if not kandidat:
        return [], ''
    if len(kandidat) != 1:
        raise Lewat('paragraf susunan majelis muncul %d kali' % len(kandidat))
    a, awal, akhir, isi = kandidat[0]
    hd = raw[a:awal]
    if '{' in hd or '}' in hd:
        raise Lewat('ada kurung di kepala paragraf')
    if isi.startswith('{'):
        mp = re.match(r'\{((?:\\[a-zA-Z]+-?\d* ?)*)', isi)
        baru_isi = '{' + mp.group(1) + '#5404#}'
        bentuk = 'grup' if isi.count('{') == 1 else 'banyak-run'
    else:
        baru_isi = '#5404#'
        bentuk = 'polos'
    ujung = akhir
    bm = re.compile(r'\\par(?![a-z])').search(raw, akhir)
    b = bm.start()
    a2 = raw.find(BS + 'pard', b)
    if a2 < 0:
        raise Lewat('tanpa paragraf sesudahnya')
    k2 = raw.find('{', a2)
    k3 = re.compile(r'\\par(?![a-z])').search(raw, a2 + 5)
    k3 = k3.start() if k3 else -1
    ujung_hd2 = min(x for x in (k2, k3, len(raw)) if x >= 0)
    hd2 = raw[a2:ujung_hd2]
    m2 = RE_FI.search(hd2)
    if not m2 or int(m2.group(1)) <= 0:
        raise Lewat('paragraf sesudahnya tanpa inden baris pertama')
    n_fi = m2.group(1)
    m_fi = RE_FI.search(hd)
    pot = [(awal, isi, baru_isi)]
    if m_fi and int(m_fi.group(1)) == int(n_fi) and RE_LI0.search(hd) and (BS + 'lin0') in hd:
        return pot, 'sudah-biasa-' + bentuk
    if m_fi and int(m_fi.group(1)) < 0:
        g = RE_GANTUNG.search(hd)
        if not g or g.group(1) != g.group(3):
            raise Lewat('inden gantung tak dikenal: ' + hd[:120])
        hd_baru = RE_GANTUNG.sub(lambda m: BS + 'fi' + n_fi + m.group(2) + BS + 'li0', hd, count=1)
        hd_baru = re.sub(r'\\lin' + g.group(3) + r'(?![0-9])', lambda m: BS + 'lin0', hd_baru, count=1)
        jenis = 'gantung-' + bentuk
    elif not m_fi:
        if len(RE_LI0.findall(hd)) != 1:
            raise Lewat('li0 tidak tunggal: ' + hd[:120])
        hd_baru = RE_LI0.sub(lambda m: BS + 'fi' + n_fi + ' ' + BS + 'li0', hd, count=1)
        jenis = 'tanpa-inden-' + bentuk
    else:
        raise Lewat('inden baris pertama lain: ' + hd[:120])
    if hd_baru == hd:
        raise Lewat('format tidak berubah')
    pot.append((a, hd, hd_baru))
    return pot, jenis


KUNCI_CUKUP = 'telah cukup dengan bukti suratnya'
LAMA5 = ['46', '47', '46', '46', '46']
BARU5 = ['47', '46', '47', '47', '47']


def rancang_pihak(raw):
    """BAS ALUR 05 [3a] (pembuktian P dan T): bagian pembuktian pihak kedua (Tergugat/Termohon) menyalin kalimat bagian pihak pertama
    sehingga menyebut #0046# - dibetulkan HANYA di bagian itu: (1) "... menyatakan telah cukup dengan bukti suratnya", (2) "kesempatan kepada ...
    memeriksa bukti ... diajukan oleh ..." (dua sebutan bertukar), (3) "... mengajukan 2 (dua) orang saksi", (4) "saksi ... yang pertama",
    (5) "saksi kedua ..." (sesudah "saksi pertama #0047# meninggalkan ruang sidang")."""
    if raw.count('mengajukan 2 (dua) orang saksi') != 2 or raw.count(KUNCI_CUKUP) not in (1, 2):
        return []
    i2 = raw.rindex(KUNCI_CUKUP)
    a = raw.rfind('#0046#', 0, i2)
    awal = [(m.start(), m.group(0)) for m in re.finditer(r'#004[67]#', raw[a:])][:5]
    if [t[1][3:5] for t in awal] != LAMA5:
        raise Lewat('urutan penyebut pihak awal bagian Tergugat tidak seperti dugaan: ' + ','.join(t[1][3:5] for t in awal))
    pot = []
    for (off, lama), baru in zip(awal, BARU5):
        if lama[3:5] != baru:
            pot.append((a + off, lama, '#00%s#' % baru))
    kunci = 'saksi pertama #0047# meninggalkan ruang sidang'
    if raw.count(kunci) != 1:
        raise Lewat('kalimat "%s" muncul %d kali' % (kunci, raw.count(kunci)))
    j = raw.index(kunci)
    m = re.compile('#0046#').search(raw, j)
    if not m or m.start() - j > 400 or 'saksi kedua' not in raw[j:m.start()]:
        raise Lewat('penyebut saksi kedua tidak ditemukan sesudah "%s"' % kunci)
    pot.append((m.start(), '#0046#', '#0047#'))
    return pot


def rancang(raw):
    """-> (potongan [(offset, lama, baru)], ringkasan dict) atau Lewat."""
    pot = []
    info = {'region': 0, 'baris': 0, 'lebar': [], 'lanjutan': ''}
    if BS + 'trowd' in raw:
        for rows, bentuk in T.region_qa(raw):
            awal, akhir = rows[0]['start'], rows[-1]['end']
            lama = raw[awal:akhir]
            baru = T.bangun_region(rows, bentuk)
            periksa_region(rows, bentuk, baru)
            pot.append((awal, lama, baru))
            info['region'] += 1
            info['baris'] += len(rows)
            info['lebar'].append('/'.join(str(x) for x in rows[0]['lebar']))
    pot_pihak = rancang_pihak(raw)
    pot.extend(pot_pihak)
    info['pihak'] = len(pot_pihak)
    if 'Susunan majelis' in raw:
        p5, jenis = rancang_5404(raw)
        pot.extend(p5)
        info['lanjutan'] = jenis
    # potongan tidak boleh bertumpuk
    pot.sort(key=lambda x: x[0])
    for (o1, l1, _), (o2, _l2, _b2) in zip(pot, pot[1:]):
        if o1 + len(l1) > o2:
            raise Lewat('potongan bertumpuk')
    return pot, info


def terapkan(raw, pot):
    for off, lama, baru in sorted(pot, key=lambda x: -x[0]):
        assert raw[off:off + len(lama)] == lama, (off, lama[:50])
        raw = raw[:off] + baru + raw[off + len(lama):]
    return raw


def sasaran(akar):
    dasar = os.path.join(akar, 'derry_briantono')
    for dp, dn, fn in os.walk(dasar):
        dn.sort()
        rel_d = os.path.relpath(dp, dasar).replace(os.sep, '/')
        if rel_d == 'terhapus' or rel_d.startswith('terhapus/'):
            continue
        for f in sorted(fn):
            if f.lower().endswith('.rtf'):
                yield ('derry_briantono/' + rel_d + '/' + f) if rel_d != '.' else ('derry_briantono/' + f)


def main():
    akar, keluar, hasil = sys.argv[1], sys.argv[2], sys.argv[3]
    for x in (keluar, hasil):
        if not os.path.isdir(x):
            os.makedirs(x)
    daftar, lewat = [], []
    n_region = n_baris = n_lanj = 0
    lebar_n = {}
    lanj_n = {}
    for rel in sorted(sasaran(akar)):
        b = open(os.path.join(akar, rel), 'rb').read()
        raw = b.decode('latin1')
        if BS + 'trowd' not in raw and 'Susunan majelis' not in raw:
            continue
        try:
            pot, info = rancang(raw)
        except Lewat as e:
            lewat.append((rel, str(e)))
            continue
        if not pot:
            continue
        baru = terapkan(raw, pot)
        if not seimbang(baru) or not seimbang(raw):
            raise SystemExit('neraca kurung berubah: ' + rel)
        daftar.append((rel, b, baru.encode('latin1'), pot, info))
        n_region += info['region']
        n_baris += info['baris']
        for w in info['lebar']:
            lebar_n[w] = lebar_n.get(w, 0) + 1
        if info['lanjutan']:
            n_lanj += 1
            lanj_n[info['lanjutan']] = lanj_n.get(info['lanjutan'], 0) + 1
    with io.open(os.path.join(keluar, 'daftar-tambal.tsv'), 'w', encoding='utf-8', newline='\n') as d, \
            io.open(os.path.join(keluar, 'tambal.tsv'), 'w', encoding='utf-8', newline='\n') as t:
        d.write(u'# kode\tberkas\tmd5_lama\tmd5_baru\tjumlah potongan - berkas diubah HANYA bila md5 persis md5_lama (keadaan sesudah 28 paket ../URUTAN-PASANG-1nov.md)\n')
        t.write(u'# kode\toffset\tb64(teks lama)\tb64(teks baru)\n')
        for i, (rel, lama, baru, pot, info) in enumerate(daftar, 1):
            kode = 'M%04d' % i
            d.write(u'%s\t%s\t%s\t%s\t%d\n' % (kode, rel, md5b(lama), md5b(baru), len(pot)))
            for off, a, z in pot:
                t.write(u'%s\t%d\t%s\t%s\n' % (kode, off, base64.b64encode(a.encode('latin1')).decode('ascii'), base64.b64encode(z.encode('latin1')).decode('ascii')))
    with io.open(os.path.join(hasil, 'rincian.tsv'), 'w', encoding='utf-8', newline='\n') as o:
        o.write(u'# kode\tberkas\ttabel tanya jawab diubah\tbaris\tlebar lama\tkalimat susunan majelis -> 5404\n')
        for i, (rel, lama, baru, pot, info) in enumerate(daftar, 1):
            o.write(u'M%04d\t%s\t%d\t%d\t%s\t%s\n' % (i, rel, info['region'], info['baris'], ' '.join(info['lebar']), info['lanjutan']))
    with io.open(os.path.join(hasil, 'lewat.tsv'), 'w', encoding='utf-8', newline='\n') as o:
        o.write(u'# berkas bertabel/berkalimat sasaran yang TIDAK diubah\talasan\n')
        for rel, alasan in lewat:
            o.write(u'%s\t%s\n' % (rel, alasan))
    ringkas = 'BERKAS DIUBAH=%d | TABEL=%d (baris %d; lebar lama %s) | SUSUNAN MAJELIS->5404=%d (%s) | DILEWATI=%d' % (
        len(daftar), n_region, n_baris, ', '.join('%s x%d' % kv for kv in sorted(lebar_n.items())), n_lanj,
        ', '.join('%s %d' % kv for kv in sorted(lanj_n.items())), len(lewat))
    with io.open(os.path.join(hasil, 'ringkas.txt'), 'w', encoding='utf-8', newline='\n') as o:
        o.write(ringkas + u'\n')
    print(ringkas)


if __name__ == '__main__':
    main()
