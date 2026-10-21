# -*- coding: utf-8 -*-
"""Render templat RTF kecil (atau berkas) memakai renderer php56 ABT asli (Abt_model::variabel_library) atas salinan ABT
D:\\Aplikasi\\aleta\\tmp\\x1\\render\\abt-salinan -> basis aps_badilag_x9render (abt_variabel = tampilan ke aps_badilag_x1) + sipp_donggala.
pakai: python rend.py "<teks templat dengan #NNNN#>" perkara_id[:sidang] ...   |  python rend.py @berkas.rtf perkara_id ..."""
import json, os, re, subprocess, sys

SALINAN = r'D:\Aplikasi\aleta\tmp\x1\w39\render\abt-salinan'
PHP = r'D:\sipp-server\php56\php.exe'
TMP = r'D:\Aplikasi\aleta\tmp'
sys.path.insert(0, r'D:\aleta-dev\wt\integrasi21\abt-paket\w3b-blangko-baru-kuasa-wali\alat')


def rtf_teks(s):
    s = re.sub(r'\\u(-?\d+)\??', lambda m: chr(int(m.group(1)) % 65536), s)
    s = re.sub(r"\\'([0-9a-f]{2})", lambda m: bytes.fromhex(m.group(1)).decode('cp1252', 'replace'), s)
    s = re.sub(r'\\par[d]?\b', '\n', s)
    s = re.sub(r'\\line\b', '\n', s)
    s = re.sub(r'\\tab\b', '\t', s)
    s = re.sub(r'\\[a-zA-Z]+-?\d* ?', '', s)
    s = re.sub(r'[{}]', '', s)
    return s.strip()


def render(templat, pid, sidang=''):
    if templat.startswith('@'):
        rtf = open(templat[1:], 'rb').read().decode('latin1')
    else:
        rtf = '{\\rtf1\\ansi\\deff0 ' + templat + '}'
    sem = os.path.join(SALINAN, '_blangko_abt', '_uji_t_sementara.rtf')
    open(sem, 'wb').write(rtf.encode('latin1'))
    out = os.path.join(TMP, 'x1', 'w39', '_keluar_%s.rtf' % pid)
    tugas = os.path.join(TMP, 'x1', 'w39', '_tugas.json')
    json.dump({'perkara_id': int(pid), 'rtf': '_blangko_abt/_uji_t_sementara.rtf', 'keluar': out, 'sidang': sidang}, open(tugas, 'w'))
    env = dict(os.environ, TMP=TMP, TEMP=TMP, UJI_T_TUGAS=tugas)
    r = subprocess.run([PHP, '-d', 'memory_limit=512M', 'index.php', 'uji_t', 'render'], cwd=SALINAN, env=env, capture_output=True)
    st = r.stdout.decode('cp1252', 'replace').strip()
    if not os.path.exists(out):
        return st + ' ' + r.stderr.decode('cp1252', 'replace')[:300]
    t = rtf_teks(open(out, 'rb').read().decode('latin1'))
    os.remove(out)
    return t


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    tpl = sys.argv[1]
    for a in sys.argv[2:]:
        pid, _, sd = a.partition(':')
        print('--- perkara %s' % pid)
        print(render(tpl, pid, sd))
