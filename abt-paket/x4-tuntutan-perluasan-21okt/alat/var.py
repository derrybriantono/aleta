# baca salinan HEX abt_variabel server (VAR_SERVER_HEX) -> dict no -> kolom (bytes terurai)
import os
HEXFILE = os.environ.get('VAR_SERVER_HEX', r'D:\Aplikasi\aleta\tmp\w26\var_server_hex.tsv')
def muat(f=HEXFILE):
    s = {}
    for b in open(f, encoding='latin1', newline='').read().split('\n')[1:]:
        if not b.strip(): continue
        k = b.split('\t')
        s[int(k[0])] = dict(nama=bytes.fromhex(k[1]).decode('latin1'), tipe=k[2], tabel=k[3], kolom=k[4], urut=k[5], ref=k[6],
                            sql=None if k[7] == 'NULL' else bytes.fromhex(k[7]).decode('latin1'), default=None if k[8] == 'NULL' else bytes.fromhex(k[8]).decode('latin1'),
                            multi=k[9], locked=k[10], modifier=k[11], modified=k[12])
    return s
if __name__ == '__main__':
    import sys
    V = muat()
    for a in sys.argv[1:]:
        lo, _, hi = a.partition('-'); hi = hi or lo
        for n in range(int(lo), int(hi) + 1):
            if n in V:
                v = V[n]; print('=====', n, v['tipe'], v['nama']); 
                if v['sql']: print('SQL:', v['sql'])
                if v['default']: print('DEF:', repr(v['default']))
