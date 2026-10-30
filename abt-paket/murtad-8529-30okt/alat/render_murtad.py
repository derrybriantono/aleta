# -*- coding: utf-8 -*-
"""Render php56 ABT ASLI (salinan renderer D:/Aplikasi/aleta/tmp/g1abt -> basis aps_badilag_g1 / sipp_g1) SEBELUM (pulih) dan SESUDAH
(pasang) paket abt-murtad-8529-30okt atas perkara nyata: CG dan CT, pihak pertama atau pihak kedua yang murtad.
Isian huruf alasan dipaksa "H" dan agama pihak (pihak urutan 1) diubah SEMENTARA di BASIS SALINAN, lalu dikembalikan.
pakai: python render_murtad.py <tugas.tsv> <keluar.json>
  tugas.tsv: perkara_id <TAB> blangko relatif derry_briantono ("-" = RTF uji) <TAB> label <TAB> agama_id pihak pertama <TAB> agama_id pihak
  kedua ("-" = tidak diubah)
Teks lengkap ke D:/Aplikasi/aleta/tmp/g1abt/render (memuat data perkara - TIDAK masuk repo); ringkasan tanpa nama ke keluar.json."""
import json, os, re, subprocess, sys
SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(SINI, '..', '..', 'bas-tanya-jawab-29okt', 'sumber'))
from rtf2txt import rtf_ke_teks  # noqa: E402

ABT = r'D:\Aplikasi\aleta\tmp\g1abt'
PHP = r'D:\sipp-server\php56\php.exe'
TMP = r'D:\Aplikasi\aleta\tmp'
OUT = os.path.join(ABT, 'render')
POHON = r'D:\Aplikasi\aleta\tmp\bas29\dasar2\derry_briantono'
MYSQL = r'D:\satker asal\website pa bungku\xampp\mysql\bin\mysql.exe'
DB = 'aps_badilag_g1'
PAKET = os.path.join(SINI, '..', 'paket-satker')
B = chr(92)
UJI = ('{' + B + 'rtf1' + B + 'ansi' + B + 'ansicpg1252' + B + 'deff0{' + B + 'fonttbl{' + B + 'f0 Times New Roman;}}\n'
       + ''.join(B + 'pard @@%s@@ #%s#' % (k, k) + B + 'par\n' for k in ('8503', '8529', '8521', '8531')) + B + 'pard @@AKHIR@@' + B + 'par}')
POLA_8529 = r'sehingga harus dinyatakan terbukti bahwa (\w+) telah keluar dari agama Islam'


def q(sql):
    r = subprocess.run([MYSQL, '-u', 'root', '-h', '127.0.0.1', '-N', '--default-character-set=latin1', DB, '-e', sql], capture_output=True)
    if r.returncode:
        raise RuntimeError(r.stderr.decode('latin1'))
    return r.stdout.decode('latin1').strip()


def paket(nama):
    env = dict(os.environ, ABT_LOKAL='1', ABT_DB=DB, PATH=r'D:\satker asal\website pa bungku\xampp\mysql\bin' + os.pathsep + os.environ['PATH'])
    r = subprocess.run([os.environ.get('BASH_GIT', r'C:\Program Files\Git\usr\bin\bash.exe'), nama], cwd=PAKET, env=env, capture_output=True)
    keluar = r.stdout.decode('utf-8', 'replace')
    if r.returncode:
        raise RuntimeError(keluar + r.stderr.decode('utf-8', 'replace'))
    return keluar.strip().splitlines()[-1]


def render(raw, pid):
    sem = os.path.join(ABT, '_blangko_abt', '_uji_g1m.rtf')
    open(sem, 'wb').write(raw)
    out = os.path.join(OUT, '_keluar_m_%s.rtf' % pid)
    tugas = os.path.join(OUT, '_tugas_m.json')
    json.dump({'perkara_id': int(pid), 'rtf': '_blangko_abt/_uji_g1m.rtf', 'keluar': out, 'sidang': ''}, open(tugas, 'w'))
    env = dict(os.environ, TMP=TMP, TEMP=TMP, UJI_T_TUGAS=tugas)
    if os.path.exists(out):
        os.remove(out)
    r = subprocess.run([PHP, '-d', 'memory_limit=1024M', 'index.php', 'uji_t', 'render'], cwd=ABT, env=env, capture_output=True, timeout=900)
    if not os.path.exists(out):
        raise RuntimeError('render gagal: ' + r.stdout.decode('cp1252', 'replace')[-400:] + r.stderr.decode('cp1252', 'replace')[-400:])
    b = open(out, 'rb').read()
    os.remove(out)
    return b


def ringkas(raw):
    t = rtf_ke_teks(raw.decode('latin1'))
    return {
        'paragraf_murtad_8529': len(re.findall(POLA_8529, t)),
        'pihak_murtad_8529': sorted(set(re.findall(POLA_8529, t))),
        'pakai_bukti_surat': t.count('dikuatkan oleh bukti surat tentang perpindahan agama'),
        'pakai_saksi': t.count('meskipun tidak diajukan bukti surat tentang perpindahan agama'),
        'pihak_murtad_8521': sorted(set(re.findall(r'Bahwa (\w+) telah keluar dari agama Islam', t))),
        'agama_belum_diubah': t.count('[AGAMA PIHAK YANG MURTAD BELUM DIUBAH DI SIPP]'),
        'huruf_belum_dipilih': t.count('[HURUF ALASAN PERCERAIAN BELUM DIPILIH]'),
        'penanda_sisa': sorted(set(re.findall(r'#(\d{4,5})#', t))),
    }, t


def pihak_pertama(t, pid):
    return q("SELECT pp.pihak_id FROM sipp_g1.%s pp WHERE pp.perkara_id = %d ORDER BY pp.urutan LIMIT 1" % (t, int(pid)))


def main():
    tugas = [l.rstrip('\n').split('\t') for l in open(sys.argv[1], encoding='utf-8') if l.strip() and not l.startswith('#')]
    os.makedirs(OUT, exist_ok=True)
    hasil = []
    for pid, rel, label, agP, agT in tugas:
        semula = q("SELECT data FROM abt_data_teks WHERE no_var=8503 AND perkara_id=%d" % int(pid))
        ubah = []
        for t, ag in (('perkara_pihak1', agP), ('perkara_pihak2', agT)):
            if ag != '-':
                ph = pihak_pertama(t, pid)
                ubah.append((ph, q("SELECT IFNULL(agama_id, 'NULL') FROM sipp_g1.pihak WHERE id = %s" % ph), ag))
        raw = UJI.encode('latin1') if rel == '-' else open(os.path.join(POHON, rel), 'rb').read()
        rec = dict(perkara_id=pid, blangko=rel, label=label, isian_huruf_semula=semula or '(kosong)')
        try:
            q("REPLACE INTO abt_data_teks (no_var, perkara_id, data, modifier) VALUES (8503, %d, 'H', 'uji')" % int(pid))
            for ph, _lama, ag in ubah:
                q("UPDATE sipp_g1.pihak SET agama_id = %d WHERE id = %s" % (int(ag), ph))
            rec['agama_sipp'] = ' / '.join(q("SELECT IFNULL(GROUP_CONCAT(DISTINCT ag.nama), '-') FROM sipp_g1.%s pp JOIN sipp_g1.pihak ph ON ph.id = pp.pihak_id "
                                             "LEFT JOIN sipp_g1.agama ag ON ag.id = ph.agama_id WHERE pp.perkara_id = %d" % (t, int(pid))) for t in ('perkara_pihak1', 'perkara_pihak2'))
            for tahap, skrip in (('sebelum', 'pulih-satker.sh'), ('sesudah', 'pasang-satker.sh')):
                rec['paket_' + tahap] = paket(skrip)
                r, teks = ringkas(render(raw, pid))
                rec[tahap] = r
                open(os.path.join(OUT, 'murtad-%s-%s-%s-%s.txt' % (pid, agP + agT, 'uji' if rel == '-' else 'blangko', tahap)), 'w', encoding='utf-8').write(teks)
        finally:
            for ph, lama, _ag in ubah:
                q("UPDATE sipp_g1.pihak SET agama_id = %s WHERE id = %s" % (lama, ph))
            if semula:
                q("UPDATE abt_data_teks SET data='%s' WHERE no_var=8503 AND perkara_id=%d" % (semula.replace("'", "''"), int(pid)))
            else:
                q("DELETE FROM abt_data_teks WHERE no_var=8503 AND perkara_id=%d AND modifier='uji'" % int(pid))
        hasil.append(rec)
        print(json.dumps(rec, ensure_ascii=False), flush=True)
    json.dump({'keterangan': 'render php56 ABT asli sebelum (pulih) dan sesudah (pasang) paket abt-murtad-8529-30okt; huruf alasan H dan agama pihak diubah SEMENTARA di basis salinan, dikembalikan sesudahnya', 'hasil': hasil},
              open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
