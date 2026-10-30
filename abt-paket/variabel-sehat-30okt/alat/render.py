# -*- coding: utf-8 -*-
"""Render dengan renderer php56 ABT ASLI (salinan milik sendiri D:/Aplikasi/aleta/tmp/vs30/abt -> sipp_vs + aps_badilag_vs;
teks "aps_badilag." di kueri katalog diarahkan ke salinan). Render MENULIS urutan sidang SIPP -> hanya salinan.
  python render.py blangko <tugas.tsv> <keluar-dir>     tugas: perkara_id TAB jalur RTF (mutlak) TAB label  -> teks .txt per tugas
  python render.py variabel <no,no,...> <sampel.tsv> <keluar.json>   satu RTF uji berisi tiap penanda di paragrafnya sendiri
Hasil teks memuat data perkara -> simpan di luar repo."""
import json, os, re, subprocess, sys, time
ABT = r'D:\Aplikasi\aleta\tmp\vs30\abt'
PHP = r'D:\sipp-server\php56\php.exe'
TMP = r'D:\Aplikasi\aleta\tmp'
SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(SINI, '..', '..', 'bas-tanya-jawab-29okt', 'sumber'))
from rtf2txt import rtf_ke_teks  # noqa: E402

B = chr(92)


def panjang(p):
    p = os.path.abspath(p)
    a = B * 2 + '?' + B
    return p if p.startswith(a) else a + p


def render(raw, pid, sidang=''):
    os.makedirs(os.path.join(ABT, '_blangko_abt'), exist_ok=True)
    sem = os.path.join(ABT, '_blangko_abt', '_uji_vs.rtf')
    open(sem, 'wb').write(raw)
    out = os.path.join(TMP, 'vs30', '_keluar_%s.rtf' % pid)
    tugas = os.path.join(TMP, 'vs30', '_tugas_vs.json')
    json.dump({'perkara_id': int(pid), 'rtf': '_blangko_abt/_uji_vs.rtf', 'keluar': out, 'sidang': sidang}, open(tugas, 'w'))
    env = dict(os.environ, TMP=TMP, TEMP=TMP, UJI_T_TUGAS=tugas)
    if os.path.exists(out):
        os.remove(out)
    r = subprocess.run([PHP, '-d', 'memory_limit=1024M', 'index.php', 'uji_t', 'render'], cwd=ABT, env=env, capture_output=True, timeout=1800)
    if not os.path.exists(out):
        raise RuntimeError('render gagal: ' + r.stdout.decode('cp1252', 'replace')[-400:] + r.stderr.decode('cp1252', 'replace')[-400:])
    b = open(out, 'rb').read()
    os.remove(out)
    return b, r.stdout.decode('cp1252', 'replace').strip()


def teks(raw):
    t = rtf_ke_teks(raw.decode('latin1'))
    return '\n'.join(re.sub(r'[ \t]+', ' ', x).strip() for x in t.split('\n') if x.strip())


def main():
    mode = sys.argv[1]
    if mode == 'blangko':
        tugas = [l.rstrip('\n').split('\t') for l in open(sys.argv[2], encoding='utf-8') if l.strip() and not l.startswith('#')]
        kel = sys.argv[3]
        os.makedirs(kel, exist_ok=True)
        for t in tugas:
            pid, rtf, label = t[:3]
            t0 = time.time()
            raw, info = render(open(panjang(rtf), 'rb').read(), pid, t[3] if len(t) > 3 else '')
            tx = teks(raw)
            open(os.path.join(kel, '%s_%s.txt' % (pid, label)), 'w', encoding='utf-8').write(tx)
            sisa = sorted(set(re.findall(r'#\d{4,5}#', tx)))
            print(pid, label, 'detik', round(time.time() - t0), 'sisa', sisa, info[:80], flush=True)
    elif mode == 'variabel':
        kode = [k.strip() for k in sys.argv[2].split(',') if k.strip()]
        sampel = [l.rstrip('\n').split('\t') for l in open(sys.argv[3], encoding='utf-8') if l.strip() and not l.startswith('#')]
        rtf = ('{' + B + 'rtf1' + B + 'ansi' + B + 'ansicpg1252' + B + 'deff0{' + B + 'fonttbl{' + B + 'f0 Times New Roman;}}\n'
               + ''.join(B + 'pard @@%s@@ #%s#' % (k, k) + B + 'par\n' for k in kode) + B + 'pard @@AKHIR@@' + B + 'par}')
        hasil = {}
        for row in sampel:
            pid = row[0]
            raw, info = render(rtf.encode('latin1'), pid, '')
            tx = rtf_ke_teks(raw.decode('latin1'))
            bag = re.split(r'@@(\d{4,5}|AKHIR)@@', tx)
            nilai = {bag[i]: re.sub(r'\s+', ' ', bag[i + 1]).strip() for i in range(1, len(bag) - 1, 2)}
            hasil[pid] = {k: nilai.get(k, '') for k in kode}
            print(pid, info[:80], flush=True)
            json.dump(hasil, open(sys.argv[4], 'w', encoding='utf-8'), ensure_ascii=False, indent=0)


if __name__ == '__main__':
    main()
