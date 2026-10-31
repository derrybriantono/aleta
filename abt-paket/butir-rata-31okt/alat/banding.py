# -*- coding: utf-8 -*-
"""Banding isian_rtf_butir LAMA vs BARU atas SELURUH masukan nyata fungsi itu (paket butir-rata-31okt).

pakai: python banding.py <basis ABT (fungsi lama terpasang)> <basis SIPP> <paket-satker> <keluaran.txt> [uji.tsv]

Masukan (semua jalur yang memanggil isian_rtf_butir: 9250/9251 langsung, 9252-9258 dan 12030-12036 lewat isian_rtf_blok/kalimat):
  - posita dan petitum SIPP seluruh perkara (mode html, variabel 9250/9251);
  - keterangan jawab-menjawab lisan ABT (isian_rtf_keterangan, mode teks, variabel 9252-9254 lama);
  - isian teks 8436/8437 dan naskah 12020-12028 yang tersimpan (mode teks).
Fungsi baru dipasang SEMENTARA sebagai isian_rtf_butir_banding di basis ABT itu, lalu dihapus.
Lolos bila: jumlah paragraf sama, dan SETIAP paragraf yang berbeda = paragraf tanpa penanda yang dulu "\\li<n>\\fi0" (lanjutan butir)
dan kini "\\li0\\fi720" dengan teks sama persis. Selain itu dicatat sebagai BEDA LAIN (harus 0).
"""
import collections
import hashlib
import os
import re
import subprocess
import sys

MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
BS = chr(92)


def jalan(db, q, masuk=None):
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '-N', '-r', '--default-character-set=latin1', db] + ([] if masuk else ['-e', q]),
                       input=masuk, capture_output=True)
    if r.returncode:
        raise SystemExit(r.stderr.decode('latin1')[-500:])
    return r.stdout.decode('latin1')


def paragraf(s):
    return s.split(BS + 'par ')


RE_LAMA = re.compile(r'^\\pard\\qj\\sl360\\slmult1\\widctlpar\\li(\d+)\\fi0 (.*)$', re.S)
RE_JUDUL = re.compile(r'^\\pard\\qj\\sl360\\slmult1\\widctlpar\\li0\\fi0 (.*)$', re.S)
RE_BARU = re.compile(r'^\\pard\\qj\\sl360\\slmult1\\widctlpar\\li0\\fi720 (.*)$', re.S)


def main():
    abt, sipp, paket, keluar = sys.argv[1:5]
    uji = sys.argv[5] if len(sys.argv) > 5 else ''
    f = open(os.path.join(paket, 'abt-butir-rata-31okt-FUNGSI.sql'), encoding='latin1').read()
    f = re.sub(r'isian_rtf_(butir|judul)(?![a-z_])', lambda m: 'isian_rtf_%s_banding' % m.group(1), f)
    jalan(abt, '', f.encode('latin1'))
    sumber = [
        ('posita SIPP', "SELECT p.perkara_id AS k, p.posita AS m, 'html' AS md FROM %s.perkara p WHERE p.posita IS NOT NULL AND p.posita <> ''" % sipp),
        ('petitum SIPP', "SELECT p.perkara_id AS k, p.petitum AS m, 'html' AS md FROM %s.perkara p WHERE p.petitum IS NOT NULL AND p.petitum <> ''" % sipp),
        ('keterangan lisan', "SELECT CONCAT(q.perkara_id, '/', q.pihak_id) AS k, isian_rtf_keterangan(q.perkara_id, q.pihak_id, 'Tergugat') AS m, 'teks' AS md FROM (SELECT DISTINCT perkara_id, pihak_id FROM aps_badilag.abt_keterangan_terdakwa) q"),
        ('isian teks 8436/8437/12020-12028', "SELECT CONCAT(t.no_var, '/', t.perkara_id) AS k, t.data AS m, 'teks' AS md FROM abt_data_teks t WHERE t.no_var IN (8436, 8437) OR t.no_var BETWEEN 12020 AND 12028"),
    ]
    lap = []
    contoh_uji = []
    total_beda_lain = 0
    for nama, q in sumber:
        sql = ("SELECT k, HEX(m), md, HEX(a), HEX(b), BINARY a = BINARY b FROM (SELECT x.k, x.m, x.md, isian_rtf_butir(x.m, x.md, 426) AS a, "
               "isian_rtf_butir_banding(x.m, x.md, 426) AS b FROM (%s) x) y" % q)
        baris = [l.split('\t') for l in jalan(abt, sql).splitlines() if l]
        sama = sum(1 for b in baris if b[5] == '1')
        ubah_par = 0
        lain = []
        awal = collections.Counter()
        for k, mh, md, ah, bh, s in baris:
            if s == '1':
                if len(contoh_uji) < 6 and nama.startswith('posita') and len(mh) < 12000:
                    contoh_uji.append((mh, md, hashlib.md5(bytes.fromhex(bh)).hexdigest()))
                continue
            a = paragraf(bytes.fromhex(ah).decode('latin1'))
            b = paragraf(bytes.fromhex(bh).decode('latin1'))
            if len(a) != len(b):
                lain.append((k, 'jumlah paragraf %d -> %d' % (len(a), len(b))))
                continue
            for pa, pb in zip(a, b):
                if pa == pb:
                    continue
                ma, mb = RE_LAMA.match(pa), RE_BARU.match(pb)
                mj = RE_JUDUL.match(pb)
                if mj and re.match(r'^(?:dalam\s+)?konvensi\s+dan\s+rekonvensi\s*[:.]?\s*$', mj.group(1), re.I) and pa.endswith(mj.group(1)):
                    ubah_par += 1
                    awal['(sub-judul) ' + mj.group(1)[:40]] += 1
                elif ma and mb and ma.group(2) == mb.group(1) and ma.group(1) != '0':
                    ubah_par += 1
                    awal[re.sub(r'\\[a-z]+-?\d* ?|\\\'[0-9a-f]{2}', '', mb.group(1))[:45]] += 1
                else:
                    lain.append((k, pa[:120] + ' || ' + pb[:120]))
            if len(contoh_uji) < 14 and len(mh) < 12000:
                contoh_uji.append((mh, md, hashlib.md5(bytes.fromhex(bh)).hexdigest()))
        total_beda_lain += len(lain)
        lap.append('== %s: %d masukan | sama persis %d | berubah %d (paragraf berubah %d) | BEDA LAIN %d' % (nama, len(baris), sama, len(baris) - sama, ubah_par, len(lain)))
        for t, n in awal.most_common(15):
            lap.append('   %4d  "%s..."' % (n, t))
        for k, x in lain[:10]:
            lap.append('   BEDA LAIN %s: %s' % (k, x))
    jalan(abt, 'DROP FUNCTION IF EXISTS isian_rtf_butir_banding'); jalan(abt, 'DROP FUNCTION IF EXISTS isian_rtf_judul_banding')
    lap.append('HASIL: %s' % ('LOLOS - hanya paragraf tanpa nomor sesudah butir bernomor yang berubah' if total_beda_lain == 0 else 'ADA BEDA LAIN'))
    open(keluar, 'w', encoding='utf-8', newline='\n').write('\n'.join(lap) + '\n')
    print('\n'.join(lap))
    if uji:
        with open(uji, 'w', newline='\n') as o:
            for mh, md, h in contoh_uji:
                o.write('%s\t%s\t%s\n' % (mh, md, h))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
