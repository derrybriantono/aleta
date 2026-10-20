# -*- coding: utf-8 -*-
"""Audit blangko putusan cerai Derry terhadap susunan putusan baku PA (U2, 20 Okt 2026).

Pakai: python audit_putusan.py <folder-teks> <berkas-variabel.sql> <keluar.json> [keluar.md]

- <folder-teks>: hasil rtf2txt per berkas (<folder>/<berkas>.txt), penanda #NNNN# masih utuh.
- <berkas-variabel.sql>: REPLACE INTO abt_variabel (...) hasil ambil_server_var.py (keadaan server, baca saja).
- Tiap penanda #NNNN# DIKEMBANGKAN dengan isi kuerinya (sql_query / default_data, sampai kedalaman 3) sebelum dicocokkan,
  sehingga bagian yang dibangun variabel (mis. #8528# analisis saksi) tidak dilaporkan "hilang".
- Bagian pertimbangan dan amar dipisah pada kata MENGADILI / MENETAPKAN supaya kata kunci di pertimbangan tidak dihitung sebagai amar.
Murni baca; tanpa jaringan."""
import glob, json, os, re, sys, collections

LP = chr(92) * 2 + '?' + chr(92)
KOL = ['no_var', 'nama', 'data_type', 'data_tabel', 'data_kolom', 'urutan_data', 'referensi', 'sql_query', 'default_data', 'multi_sidang', 'locked', 'modifier']


def muat_variabel(sql):
    out = {}
    for l in open(sql, encoding='ascii'):
        if not l.startswith('REPLACE'):
            continue
        isi = l[l.index('VALUES (') + 8:-3]
        v = []
        i = 0
        while i < len(isi):
            if isi[i] == 'X':
                j = isi.index("'", i + 2)
                v.append(bytes.fromhex(isi[i + 2:j]).decode('cp1252', 'replace'))
                i = j + 2
            else:
                j = isi.find(',', i)
                j = len(isi) if j < 0 else j
                v.append(isi[i:j])
                i = j + 1
        m = dict(zip(KOL, v))
        out[int(m['no_var'])] = m
    return out


# (id, bagian, label, pola, wajib_untuk)  bagian: duduk | pert | amar
# wajib_untuk: kunci keadaan (lihat berlaku()); "semua" = semua putusan kabul/tolak perceraian
KOMP = [
 ('D1', 'duduk', 'Posita ringkas', r'#5125#|posita', 'semua'),
 ('D2', 'duduk', 'Petitum primer dan subsider', r'PRIMER|PRIMAIR|SUBSIDER', 'semua'),
 ('D3', 'duduk', 'Pemanggilan dan kehadiran para pihak', r'dipanggil secara resmi dan patut|#8507#|#8508#|#8509#|#8547#', 'semua'),
 ('D4', 'duduk', 'Upaya damai oleh hakim (Ps 82 UU 7/1989, 31 PP 9/1975)', r'menasehati|menasihati|mendamaikan', 'semua'),
 ('D5', 'duduk', 'Mediasi dan hasilnya (PERMA 1/2016)', r'mediasi', 'semua'),
 ('D6', 'duduk', 'Bukti surat dan saksi dalam duduk perkara', r'Saksi:', 'semua'),
 ('D7', 'duduk', 'Kesimpulan para pihak', r'kesimpulan', 'semua'),
 ('D8', 'duduk', 'Jawaban, replik, duplik', r'jawabannya|replik|duplik', 'kontra'),
 ('P1', 'pert', 'Kewenangan absolut', r'absolut|Personalitas Keislaman', 'semua'),
 ('P2', 'pert', 'Kewenangan relatif', r'relatif|Pasal 66 ayat \(2\)|Pasal 73 ayat \(1\)', 'semua'),
 ('P3', 'pert', 'Legal standing, hubungan hukum suami istri (akta nikah)', r'Akta Nikah|terikat sebagai suami', 'semua'),
 ('P4', 'pert', 'Pemanggilan patut dan verstek (149 RBg)', r'149 RBg|Pasal 125', 'verstek'),
 ('P5', 'pert', 'Mediasi (PERMA 1/2016 Ps 4)', r'Nomor 1 Tahun 2016', 'semua'),
 ('P6', 'pert', 'Klasifikasi dalil diakui dan dibantah', r'dalil yang diakui|Dalil yang diakui|dibantah', 'kontra'),
 ('P7', 'pert', 'Beban pembuktian (283 RBg)', r'283 RBg|1865', 'semua'),
 ('P8', 'pert', 'Analisis bukti surat per bukti', r'P\.1|bukti P', 'semua'),
 ('P9', 'pert', 'Saksi: syarat formil (172 RBg, 76 UU 7/1989, 22 PP 9/1975)', r'172 ayat \(1\) RBg|Pasal 76|Pasal 22 ayat|syarat formil', 'semua'),
 ('P10', 'pert', 'Saksi: analisis materiil per saksi', r'#8528#|syarat materiil|keterangan saksi', 'semua'),
 ('P11', 'pert', 'Fakta hukum bernomor', r'fakta hukum|fakta-fakta', 'semua'),
 ('P12', 'pert', 'Unsur perceraian dan broken marriage (SEMA 3/2018)', r'broken mari|pecah', 'semua'),
 ('P13', 'pert', 'Pertimbangan menurut huruf alasan A-H (Ps 19 PP 9/1975)', r'Pasal 19 huruf', 'semua'),
 ('P14', 'pert', 'Syarat SEMA 1/2022 (pisah 6 bulan / nafkah 12 bulan)', r'Nomor 1 Tahun 2022', 'sema'),
 ('P15', 'pert', 'Talak raji/bain (Ps 118-119 KHI)', r'raj.{1,3}i|ba.{1,3}in', 'kabul'),
 ('P16', 'pert', 'Tenggang ikrar talak 6 bulan sejak penetapan hari sidang ikrar (Ps 70(6) UU 7/1989)', r'70 ayat \(6\)', 'ct_kabul'),
 ('P17', 'pert', 'Pembayaran akibat cerai sebelum ikrar / sebelum akta cerai', r'sebelum pengucapan ikrar|sebelum ikrar|sebelum.{0,40}akta cerai', 'akibat'),
 ('P18', 'pert', 'Hadhanah: pertimbangan (Ps 105/156 KHI, kepentingan terbaik anak)', r'hadl?h?anah|pemeliharaan anak|hak asuh', 'hadhanah'),
 ('P19', 'pert', 'Hadhanah: anak mumayyiz (didengar, memilih) ', r'mumayyiz.{0,300}(memilih|didengar)|(memilih|didengar).{0,300}mumayyiz', 'hadhanah'),
 ('P20', 'pert', 'Nafkah anak (Ps 41 b UU 1/1974, 149 d, 156 d KHI, SEMA 3/2015 10-20%)', r'nafkah anak|biaya pemeliharaan', 'nafkahanak'),
 ('P21', 'pert', 'Nafkah iddah (Ps 149 b KHI, SEMA 3/2018)', r'nafkah.{0,12}iddah|iddah', 'akibat'),
 ('P22', 'pert', 'Mut\'ah (Ps 149 a KHI)', r'mut.{1,3}ah', 'akibat'),
 ('P23', 'pert', 'Nafkah madliyah', r'madliyah|madhiyah|nafkah lampau', 'madliyah'),
 ('P24', 'pert', 'Harta bersama (Ps 86 UU 7/1989, 97 KHI)', r'harta bersama', 'harta'),
 ('P25', 'pert', 'Biaya perkara (Ps 89 UU 7/1989)', r'Pasal 89|biaya perkara', 'semua'),
 ('A1', 'amar', 'Amar: verstek dinyatakan', r'tidak hadir', 'verstek'),
 ('A2', 'amar', 'Amar: mengabulkan', r'Mengabulkan|Menolak', 'semua'),
 ('A3', 'amar', 'Amar: talak/izin ikrar/fasakh', r'talak|fasakh|izin', 'kabul'),
 ('A4', 'amar', 'Amar: hadhanah (dengan akses orang tua lain)', r'hadhanah|hadlanah|pemeliharaan|hak asuh', 'hadhanah'),
 ('A5', 'amar', 'Amar: nafkah anak (kenaikan per tahun)', r'nafkah.{0,60}anak|anak.{0,60}nafkah', 'nafkahanak'),
 ('A6', 'amar', 'Amar: nafkah iddah', r'iddah', 'akibat'),
 ('A7', 'amar', 'Amar: mut\'ah', r'mut.{1,3}ah', 'akibat'),
 ('A8', 'amar', 'Amar: nafkah madliyah', r'madliyah|nafkah lampau', 'madliyah'),
 ('A9', 'amar', 'Amar: pembayaran sebelum ikrar / akta cerai', r'sebelum.{0,60}(ikrar|akta cerai)', 'akibat'),
 ('A10', 'amar', 'Amar: Menolak selebihnya', r'selain dan selebihnya|selebihnya', 'sebagian'),
 ('A11', 'amar', 'Amar: biaya perkara', r'biaya perkara|#8505#', 'semua'),
]


def kembangkan(t, V, dalam=3, lihat=None):
    lihat = lihat or set()
    if dalam == 0:
        return t

    def ganti(m):
        n = int(m.group(1))
        if n in lihat or n not in V:
            return m.group(0)
        v = V[n]
        isi = ''
        if v.get('sql_query', 'NULL') != 'NULL':
            isi += ' ' + v['sql_query']
        if v.get('default_data', 'NULL') != 'NULL':
            isi += ' ' + v['default_data']
        if not isi.strip():
            return m.group(0)
        return m.group(0) + ' ' + kembangkan(isi, V, dalam - 1, lihat | {n})
    return re.sub(r'#(\d{4,5})#', ganti, t)


def pisah(t):
    ms = [m for m in re.finditer(r'MENGADILI|MENETAPKAN', t)]
    if not ms:
        return t, ''
    i = ms[-1].start()
    return t[:i], t[i:]


def keadaan(rel):
    n = rel.lower()
    k = set()
    folder = rel.split('/')[0].lower()
    if ' - bas' in folder or folder.startswith(('- bas', 'alur', 'bas ')):
        k.add('bas')
    if folder.startswith('1a'):
        k.add('ct')
    elif folder.startswith('1 '):
        k.add('cg')
    elif folder.startswith('1c'):
        k.add('kum_itsbat')
    elif folder.startswith('1d'):
        k.add('kum_asuh')
    if '[kabul' in n:
        k.add('kabul')
    for t, s in (('[tolak', 'tolak'), ('[no]', 'no'), ('[gugur', 'gugur'), ('[cabut', 'cabut'), ('[coret', 'coret'), ('[sela', 'sela'), ('[ikrar', 'ikrar')):
        if t in n:
            k.add(s)
    if 'verstek' in n or '[01]' in n.split('/')[-1][:5]:
        k.add('verstek')
    if 'setelah mediasi' in n and 'kontradiktoir' not in n:
        k.add('setelah_mediasi')
        k.discard('verstek')
    elif re.search(r'kontradiktoir|\] \[kabul\] c[gt] - f|\[02', n) or 'rekonvensi' in n:
        k.add('kontra')
        k.discard('verstek')
    return k


def berlaku(kunci, k, teks_lengkap):
    if kunci == 'semua':
        return bool(k & {'kabul', 'tolak'})
    if kunci == 'kontra':
        return 'kontra' in k
    if kunci == 'verstek':
        return 'verstek' in k and 'kabul' in k
    if kunci == 'kabul':
        return 'kabul' in k
    if kunci == 'sema':
        return 'kabul' in k and 'ct' in k or 'kabul' in k and 'cg' in k
    if kunci == 'ct_kabul':
        return 'kabul' in k and ('ct' in k or ('kum_itsbat' in k and 'CT' in teks_lengkap[:400]))
    return False  # akibat/hadhanah/... = hanya bila blangko memuatnya (tidak wajib untuk blangko biasa)


def tulis_md(jalur, hasil, kurang):
    nama = {c[0]: c for c in KOMP}
    b = ['# Audit blangko putusan cerai Derry terhadap susunan putusan baku (U2, 20 Okt 2026)', '',
         'Dibangun oleh `alat/audit_putusan.py` atas %d blangko putusan kabul/tolak perceraian (folder 1, 1a, 1c, 1d; keadaan server 17 Okt + paket sampai 19 Okt).' % len(hasil),
         'Penanda #NNNN# dikembangkan dengan isi kueri variabel server sebelum dicocokkan, jadi bagian yang dibangun variabel (mis. #8528# analisis saksi) tidak dilaporkan hilang.',
         '"wajib" = komponen yang harus ada pada blangko jenis itu (kabul/tolak, verstek, kontradiktoir, cerai talak); komponen akibat perceraian (P17-P24, A4-A10) tidak wajib pada blangko biasa tetapi dilaporkan di bagian "kemampuan menampung".', '',
         '| id | komponen | blangko wajib | kurang |', '|---|---|---:|---:|']
    for c in KOMP:
        w = sum(1 for x in hasil if x['wajib'][c[0]])
        if w:
            b.append('| %s | %s | %d | %d |' % (c[0], c[2], w, len(kurang[c[0]])))
    b += ['', '## Rincian blangko yang kurang (komponen wajib)', '']
    for c in KOMP:
        if kurang[c[0]]:
            b.append('### %s - %s (%d blangko)' % (c[0], c[2], len(kurang[c[0]])))
            for r in kurang[c[0]][:40]:
                b.append('- ' + r)
            b.append('')
    b += ['## Kemampuan menampung akibat perceraian (bukan kewajiban, hanya fakta)', '',
          'Jumlah blangko kabul yang SUDAH memuat pertimbangan/amar komponen tersebut (dari %d):' % sum(1 for x in hasil if 'kabul' in x['keadaan']), '', '| id | komponen | memuat |', '|---|---|---:|']
    for c in KOMP:
        if c[4] in ('akibat', 'hadhanah', 'nafkahanak', 'madliyah', 'harta'):
            n = sum(1 for x in hasil if 'kabul' in x['keadaan'] and x['ada_raw'].get(c[0]))
            b.append('| %s | %s | %d |' % (c[0], c[2], n))
    open(jalur, 'w', encoding='utf-8', newline=chr(10)).write(chr(10).join(b) + chr(10))


def main():
    dir_teks, sql, keluar = sys.argv[1], sys.argv[2], sys.argv[3]
    V = muat_variabel(sql)
    hasil = []
    for p in sorted(glob.glob(os.path.join(dir_teks, '**', '*.txt'), recursive=True)):
        rel = os.path.relpath(p, dir_teks).replace(chr(92), '/')[:-4]
        folder = rel.split('/')[0]
        if rel.split('/')[-1].startswith('BAS '):
            continue
        if not folder.startswith(('1 Perceraian CG', '1a Perceraian CT', '1c ', '1d ')) or folder.endswith('BAS'):
            continue
        t = open(p, encoding='utf-8', errors='replace').read()
        k = keadaan(rel)
        if k & {'gugur', 'cabut', 'coret', 'ikrar', 'sela', 'no'}:
            continue
        eff = kembangkan(t, V)
        kep, amar_t = pisah(eff)
        ada = {}
        for (cid, bag, lab, pola, wajib) in KOMP:
            sumber = amar_t if bag == 'amar' else kep
            ada[cid] = bool(re.search(pola, sumber, re.I | re.S))
        # akibat perceraian: hanya teks blangko sendiri + penanda variabel akibat yang sudah ada (97xx), tanpa mengembangkan kueri umum
        kep_raw, amar_raw = pisah(t)
        tok = r'#9716#|#9717#|#97[2-5]\d#|#93\d\d#'
        ada_raw = {}
        for (cid, bag, lab, pola, wajib) in KOMP:
            if wajib in ('akibat', 'hadhanah', 'nafkahanak', 'madliyah', 'harta'):
                sumber_raw = amar_raw if bag == 'amar' else kep_raw
                ada_raw[cid] = bool(re.search(pola, sumber_raw, re.I | re.S)) or bool(re.search(tok, sumber_raw))
        hasil.append({'berkas': rel, 'keadaan': sorted(k), 'ada': ada, 'ada_raw': ada_raw, 'wajib': {c[0]: berlaku(c[4], k, t) for c in KOMP}})
    json.dump({'komponen': [dict(id=c[0], bagian=c[1], label=c[2], wajib=c[4]) for c in KOMP], 'berkas': hasil}, open(keluar, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # ringkasan: komponen wajib yang tidak ada, per komponen
    kurang = collections.defaultdict(list)
    for b in hasil:
        for c in KOMP:
            if b['wajib'][c[0]] and not b['ada'][c[0]]:
                kurang[c[0]].append(b['berkas'])
    if len(sys.argv) > 4:
        tulis_md(sys.argv[4], hasil, kurang)
    print('berkas', len(hasil))
    for c in KOMP:
        w = sum(1 for b in hasil if b['wajib'][c[0]])
        print(c[0].ljust(4), c[2][:62].ljust(63), 'wajib', str(w).rjust(3), 'kurang', str(len(kurang[c[0]])).rjust(3))


if __name__ == '__main__':
    main()
