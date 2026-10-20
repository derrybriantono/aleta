# -*- coding: utf-8 -*-
"""Menjalankan kueri variabel baru di SERVER (MariaDB 5.5) lewat /root/lihat-jejak.sh - HANYA SELECT, baca saja.
  python uji_server_baca.py [perkara_id ...]   (tanpa argumen: itsbat voluntair terbaru dan asal usul anak terbaru)
Memastikan kueri sah di MariaDB 5.5 dan menghasilkan baris; tidak menulis apa pun."""
import os, subprocess, sys, base64

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from variabel import VAR  # noqa: E402


def ssh(sql):
    # kueri dikirim lewat base64 agar tanda kutip/persen/garis miring tidak berubah di jalan
    b64 = base64.b64encode(sql.encode('utf-8'))
    perintah = 'q=$(base64 -d); bash /root/lihat-jejak.sh "$q"'
    r = subprocess.run(['ssh', 'aleta', perintah], input=b64, capture_output=True, timeout=120)
    return r.returncode, r.stdout.decode('utf-8', 'replace').strip(), r.stderr.decode('utf-8', 'replace').strip()


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    if len(sys.argv) > 1:
        pids = [int(x) for x in sys.argv[1:]]
    else:
        pids = []
        for s in ("SELECT MAX(perkara_id) FROM perkara WHERE jenis_perkara_id=360 AND alur_perkara_id=16", "SELECT MAX(perkara_id) FROM perkara WHERE jenis_perkara_id=358"):
            rc, out, err = ssh(s)
            pids += [int(x) for x in out.split() if x.isdigit()]
    print('perkara:', pids)
    gagal = 0
    for pid in pids:
        for v in VAR:
            if v['tipe'] != 'data_sql':
                continue
            rc, out, err = ssh('SELECT x.data FROM (%s) x' % v['sql'].replace('#perkara_id#', str(pid)))
            if rc != 0 or 'ERROR' in err or 'ERROR' in out:
                gagal += 1
                print('  [%d] perkara %d GALAT %s' % (v['no'], pid, (err or out)[:300]))
            else:
                print('  [%d] perkara %d OK %s' % (v['no'], pid, out.splitlines()[1][:110] if len(out.splitlines()) > 1 else '(kosong)'))
    print('GALAT=%d' % gagal)
    sys.exit(1 if gagal else 0)


if __name__ == '__main__':
    main()
