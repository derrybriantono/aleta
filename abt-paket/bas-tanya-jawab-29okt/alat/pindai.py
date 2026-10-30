"""Pindai pohon blangko derry_briantono: per berkas RTF, variabel yang dirujuk dan penggolongan saksi.

Pakai: python pindai.py <akar derry_briantono> <keluar.tsv> [folder teks]
Kolom: folder, berkas, md5, var_tj (tanyajawab), var_ket (keterangan), var_sql_tj (9259-9265),
       var_naratif (variabel kalimat saksi jadi), var_identitas_saksi, semua_var
"""
import hashlib, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rtf2txt import rtf_ke_teks

TJ = {'5058', '5059', '5060', '6124', '8931', '6120', '6121', '6122', '8921', '8941'}
KET = {'2021', '2022', '2031', '8920', '8932', '2023', '2024', '2032', '8942'}
SQLTJ = {str(n) for n in range(9259, 9266)}
NARATIF = {'8511', '8512', '2555', '2556', '2557', '2558', '8486', '8487', '0384', '4422', '4503', '4508',
           '4511', '4610', '4611', '4612', '4613', '4614', '4615', '4616', '4617', '4618', '4848', '4849',
           '1126', '1215', '8528', '8607'}
IDENT = {'1197', '1203', '6132', '6144', '8924', '6100', '6106', '6138', '8934'}


def teks(path):
    return rtf_ke_teks(open(path, 'rb').read().decode('latin1'))


def panjang(p):
    p = os.path.abspath(p)
    awal = chr(92) * 2 + '?' + chr(92)
    if os.name == 'nt' and not p.startswith(awal):
        p = awal + p.replace('/', chr(92))
    return p


def main():
    akar, keluar = panjang(sys.argv[1]), sys.argv[2]
    if len(sys.argv) > 3:
        sys.argv[3] = panjang(sys.argv[3])
    baris = []
    for dp, dn, fn in os.walk(akar):
        dn.sort()
        for f in sorted(fn):
            if not f.lower().endswith('.rtf'):
                continue
            p = os.path.join(dp, f)
            raw = open(p, 'rb').read()
            t = rtf_ke_teks(raw.decode('latin1'))
            if len(sys.argv) > 3:
                rel0 = os.path.relpath(dp, akar)
                tp = os.path.join(sys.argv[3], rel0, f[:-4] + '.txt')
                os.makedirs(os.path.dirname(tp), exist_ok=True)
                open(tp, 'w', encoding='utf-8').write(t)
            v = re.findall(r'#(\d{4,5})#', t)
            s = set(v)
            rel = os.path.relpath(dp, akar).replace('\\', '/')
            baris.append('\t'.join([
                rel, f, hashlib.md5(raw).hexdigest(),
                ','.join(sorted(s & TJ)), ','.join(sorted(s & KET)), ','.join(sorted(s & SQLTJ)),
                ','.join(sorted(s & NARATIF)), ','.join(sorted(s & IDENT)), ','.join(sorted(s))]))
    with open(keluar, 'w', encoding='utf-8') as o:
        o.write('folder\tberkas\tmd5\ttj\tket\tsqltj\tnaratif\tident\tsemua\n')
        o.write('\n'.join(baris) + '\n')
    print(len(baris), 'berkas')


if __name__ == '__main__':
    main()
