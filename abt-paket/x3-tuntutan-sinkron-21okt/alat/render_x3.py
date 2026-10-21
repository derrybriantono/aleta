# -*- coding: utf-8 -*-
"""Render blangko Derry CG/CT verstek SEBELUM dan SESUDAH paket x3 memakai renderer php56 ABT ASLI (Abt_model::variabel_library,
lewat pengendali uji Uji_t) atas salinan ABT laptop. abt_variabel = tampilan ke aps_badilag_x3lama (sebelum, salinan persis server)
atau aps_badilag_x3 (sesudah, paket terpasang). Isian keputusan majelis uji ditulis ke aps_badilag.abt_data_teks LAPTOP lalu DIKEMBALIKAN
(baris yang sudah ada dicadangkan dulu). Hasil lengkap memuat data perkara: hanya di D:/Aplikasi/aleta/tmp/tuntutan24/render/out (bukan repo);
ringkasan tanpa data pribadi di hasil/render-ringkasan.json.

Yang diperiksa per cetakan:
  - [PERIKSA ...] tuntutan: hanya untuk tuntutan yang diminta petitum dan belum diputus;
  - kata kunci pertimbangan/amar tiap tuntutan (nafkah iddah, mut'ah, madliyah, nafkah anak, hak asuh) ada / tidak;
  - penomoran amar: nomor dihitung seperti Word dari daftar bernomor RTF (\\lsN), harus 1..n tanpa lompat dan tanpa butir kosong;
  - tidak ada paragraf kosong ganda dan tidak ada penanda #NNNN# tersisa.
pakai: python render_x3.py"""
import json, os, re, subprocess, sys

SALINAN = r'D:\Aplikasi\aleta\tmp\tuntutan24\render\abt-salinan'
PHP = r'D:\sipp-server\php56\php.exe'
MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
TMP = r'D:\Aplikasi\aleta\tmp'
RTF = r'D:\Aplikasi\aleta\tmp\tuntutan24\rtf-server\derry_briantono'
KELUAR = r'D:\Aplikasi\aleta\tmp\tuntutan24\render\out'
RINGKAS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'hasil', 'render-ringkasan.json')

CG01 = RTF + r'\1 Perceraian CG\[01] [Kabul Verstek] Cerai (Format Lengkap).rtf'
CT01 = RTF + r'\1a Perceraian CT\[01] [Kabul Verstek] Cerai (Format Lengkap).rtf'
CTMI = RTF + r"\1a Perceraian CT\[01] [Kabul Verstek] Cerai (Format Lengkap) - Mut'ah Iddah.rtf"

KEP = {'dikabulkan': 'dikabulkan seluruhnya', 'ex': 'diberikan secara ex officio (tidak dituntut)'}
# (kode, label, blangko, perkara_id, isian uji, tuntutan yang diharapkan tercetak, tuntutan diminta petitum)
SKENARIO = [
    ('s1-cg-cerai-saja', 'CG verstek, petitum cerai saja (nama Penggugat memuat "idah")', CG01, 7326, {}, [], []),
    ('s2-cg-tuntut-belum-diputus', 'CG, petitum menuntut nafkah anak, iddah, mut\'ah, madliyah - belum dipilih', CG01, 9089, {}, [], ['nafkah_anak', 'iddah', 'mutah', 'madliyah']),
    ('s3-cg-tuntut-diputus', 'CG, nafkah anak + iddah dikabulkan, mut\'ah + madliyah ditolak', CG01, 9089,
     {'4101': KEP['dikabulkan'], '9740': 'Rp1.000.000,00 (satu juta rupiah)', '4102': KEP['dikabulkan'], '9712': 'Rp3.000.000,00 (tiga juta rupiah)',
      '4103': 'ditolak: Penggugat tidak membuktikan dalil mut\'ah', '4104': 'ditolak: dalil nafkah lampau tidak terbukti'}, ['nafkah_anak', 'iddah'], ['nafkah_anak', 'iddah', 'mutah', 'madliyah']),
    ('s4-ct-tanpa-tuntutan', 'CT verstek tanpa tuntutan (nama Termohon memuat "idah")', CT01, 7522, {}, [], []),
    ('s5-ct-ex-officio', 'CT verstek, mut\'ah dan iddah ditetapkan karena jabatan', CT01, 7522,
     {'4102': KEP['ex'], '6054': 'Rp1.500.000,00 (satu juta lima ratus ribu rupiah)', '4103': KEP['ex'], '6055': 'uang sejumlah Rp2.000.000,00 (dua juta rupiah)'}, ['iddah', 'mutah'], []),
    ('s6-ct-tuntut-mutah-iddah', 'CT, petitum Pemohon memuat mut\'ah dan iddah - belum dipilih', CT01, 7868, {}, [], ['iddah', 'mutah']),
    ('s7-ct-tuntut-diputus', 'CT, mut\'ah dan iddah dikabulkan', CT01, 7868,
     {'4102': KEP['dikabulkan'], '6054': 'Rp1.500.000,00 (satu juta lima ratus ribu rupiah)', '4103': KEP['dikabulkan'], '6055': 'uang sejumlah Rp2.000.000,00 (dua juta rupiah)'}, ['iddah', 'mutah'], ['iddah', 'mutah']),
    ('s8-ct-varian-mutah-iddah', 'CT varian Mut\'ah Iddah (blangko ex officio), tanpa tuntutan', CTMI, 7522,
     {'6054': 'Rp1.500.000,00 (satu juta lima ratus ribu rupiah)', '6055': 'uang sejumlah Rp2.000.000,00 (dua juta rupiah)'}, ['iddah', 'mutah'], []),
]
KATA = {
    'iddah': re.compile(r"nafkah (?:selama )?(?:masa )?iddah", re.I),
    'mutah': re.compile(r"mut'ah", re.I),
    'madliyah': re.compile(r"madliyah|nafkah lampau", re.I),
    'nafkah_anak': re.compile(r"nafkah anak|biaya pemeliharaan anak|nafkah .{0,20}anak", re.I),
    'hadhanah': re.compile(r"hadhanah|hak asuh", re.I),
}


def sql(q, db='aps_badilag'):
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '--default-character-set=latin1', '-N', db], input=q.encode('latin1'), capture_output=True)
    if r.returncode:
        raise SystemExit('SQL gagal: ' + r.stderr.decode('latin1', 'replace')[:300])
    return r.stdout.decode('latin1')


def pakai_lab(db):
    sql("CREATE OR REPLACE VIEW aps_badilag_x3render.abt_variabel AS SELECT * FROM %s.abt_variabel;" % db, 'aps_badilag_x3render')


def esc(s):
    return s.replace('\\', '\\\\').replace("'", "''")


def tulis_isian(pid, isian):
    """isian uji -> aps_badilag.abt_data_teks laptop; kembalikan cadangan baris lama."""
    kode = sorted(set(isian) | {'8503'})
    lama = {}
    for baris in sql("SELECT no_var, HEX(data) FROM abt_data_teks WHERE perkara_id=%d AND no_var IN (%s);" % (pid, ','.join(kode))).splitlines():
        if baris.strip():
            k, h = baris.split('\t')
            lama[str(int(k)).zfill(4)] = h
    perintah = []
    for k, v in isian.items():
        perintah.append("REPLACE INTO abt_data_teks (no_var, perkara_id, data, modifier) VALUES (%s, %d, '%s', 'uji');" % (k, pid, esc(v)))
    if '8503' not in lama and '8503' not in isian:
        perintah.append("REPLACE INTO abt_data_teks (no_var, perkara_id, data, modifier) VALUES (8503, %d, 'F', 'uji');" % pid)
    if perintah:
        # isian keputusan paket u2 (4100-4109) belum ada di abt_variabel LAPTOP: pemeriksaan FK dimatikan untuk sesi ini saja
        sql('SET FOREIGN_KEY_CHECKS=0;\n' + '\n'.join(perintah))
    return kode, lama


def pulihkan_isian(pid, kode, lama):
    perintah = ["DELETE FROM abt_data_teks WHERE perkara_id=%d AND no_var IN (%s);" % (pid, ','.join(kode))]
    for k, h in lama.items():
        perintah.append("INSERT INTO abt_data_teks (no_var, perkara_id, data, modifier) VALUES (%s, %d, UNHEX('%s'), 'pulih');" % (k, pid, h))
    sql('\n'.join(perintah))


def render(rtf_berkas, pid):
    sem = os.path.join(SALINAN, '_blangko_abt', '_uji_x3_sementara.rtf')
    open(sem, 'wb').write(open(rtf_berkas, 'rb').read())
    out = os.path.join(TMP, 'tuntutan24', '_keluar_%d.rtf' % pid)
    tugas = os.path.join(TMP, 'tuntutan24', '_tugas.json')
    json.dump({'perkara_id': int(pid), 'rtf': '_blangko_abt/_uji_x3_sementara.rtf', 'keluar': out, 'sidang': ''}, open(tugas, 'w'))
    env = dict(os.environ, TMP=TMP, TEMP=TMP, UJI_T_TUGAS=tugas)
    r = subprocess.run([PHP, '-d', 'memory_limit=1024M', 'index.php', 'uji_t', 'render'], cwd=SALINAN, env=env, capture_output=True, timeout=900)
    st = r.stdout.decode('cp1252', 'replace').strip()
    os.remove(sem)
    if not os.path.exists(out):
        raise SystemExit('render gagal: ' + st + r.stderr.decode('cp1252', 'replace')[:300])
    data = open(out, 'rb').read().decode('latin1')
    os.remove(out)
    return st, data


def paragraf(rtf):
    """RTF -> daftar (ls, teks) per paragraf; ls = nomor daftar (\\lsN) yang berlaku, None bila bukan butir bernomor.
    \\listtext (angka simpanan Word) dibuang - nomor dihitung ulang seperti Word."""
    hasil = []
    buf = []
    ls = None
    i, n = 0, len(rtf)
    stack = []
    skip = False
    lewati = {'fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'header', 'footer', 'headerl', 'headerr', 'footerl', 'footerr', 'listtable',
              'listoverridetable', 'rsidtbl', 'xmlnstbl', 'mmathPr', 'themedata', 'colorschememapping', 'datastore', 'latentstyles', 'generator',
              'pgdsctbl', 'fldinst', 'object', 'shp', 'shppict', 'nonshppict', 'bkmkstart', 'bkmkend', 'wgrffmtfilter', 'filetbl', 'listtext'}
    while i < n:
        c = rtf[i]
        if c == '{':
            stack.append(skip); i += 1; continue
        if c == '}':
            skip = stack.pop() if stack else False; i += 1; continue
        if c == '\\':
            i += 1
            c2 = rtf[i] if i < n else ''
            if c2 in '\\{}':
                if not skip: buf.append(c2)
                i += 1; continue
            if c2 == "'":
                if not skip:
                    try: buf.append(bytes([int(rtf[i + 1:i + 3], 16)]).decode('cp1252'))
                    except Exception: pass
                i += 3; continue
            if c2 == '*':
                skip = True; i += 1; continue
            m = re.match(r'([a-zA-Z]+)(-?\d+)? ?', rtf[i:])
            if m:
                w, arg = m.group(1), m.group(2)
                i += m.end()
                if w in lewati:
                    skip = True
                elif w == 'pard' and not skip:  # \pard di dalam {\listtext ...} bukan milik paragraf
                    ls = None
                elif w == 'ls' and not skip:
                    ls = int(arg or 0)
                elif not skip:
                    if w == 'par':
                        hasil.append((ls, ''.join(buf).strip()))
                        buf = []
                    elif w in ('line',):
                        buf.append('\n')
                    elif w in ('tab', 'cell'):
                        buf.append(' ')
                    elif w == 'u' and arg:
                        v = int(arg)
                        buf.append(chr(v + 65536 if v < 0 else v))
                        i += 1
                continue
            i += 1; continue
        if c in '\r\n':
            i += 1; continue
        if not skip:
            buf.append(c)
        i += 1
    if ''.join(buf).strip():
        hasil.append((ls, ''.join(buf).strip()))
    return hasil


def periksa(rtf):
    par = paragraf(rtf)
    # nomor per daftar seperti Word: tiap \lsN menghitung terus selama dokumen
    hitung = {}
    baris = []
    kosong_butir = 0
    for ls, t in par:
        if ls:
            hitung[ls] = hitung.get(ls, 0) + 1
            baris.append('%d. %s' % (hitung[ls], t))
            if not t:
                kosong_butir += 1
        else:
            baris.append(t)
    teks = '\n'.join(baris)
    # bagian amar: sesudah "M E N G A D I L I" / "MENGADILI"
    k = re.search(r'M\s*E\s*N\s*G\s*A\s*D\s*I\s*L\s*I', teks)
    amar = teks[k.end():] if k else ''
    akhir = re.search(r'Demikian diputuskan', amar)
    amar = amar[:akhir.start()] if akhir else amar
    nomor = [int(m.group(1)) for m in re.finditer(r'(?m)^(\d+)\. ', amar)]
    ganda = len(re.findall(r'\n\s*\n\s*\n', teks))
    pertimbangan = teks[:k.start()] if k else teks
    return dict(
        teks=teks,
        periksa=re.findall(r'\[PERIKSA:[^\]]{0,160}\]', teks),
        tuntutan_pertimbangan={x: bool(KATA[x].search(pertimbangan.split('Menimbang', 1)[-1])) for x in KATA},
        tuntutan_amar={x: bool(KATA[x].search(amar)) for x in KATA},
        nomor_amar=nomor,
        nomor_urut=nomor == list(range(1, len(nomor) + 1)),
        butir_kosong=kosong_butir,
        paragraf_kosong_ganda=ganda,
        penanda_sisa=sorted(set(re.findall(r'#\d{3,5}#', teks))),
    )


def main():
    os.makedirs(KELUAR, exist_ok=True)
    ring = {}
    for kode, label, rtf, pid, isian, harap_cetak, diminta in SKENARIO:
        kd, lama = tulis_isian(pid, isian)
        try:
            for lab, db in (('sebelum', 'aps_badilag_x3lama'), ('sesudah', 'aps_badilag_x3')):
                pakai_lab(db)
                st, data = render(rtf, pid)
                h = periksa(data)
                open(os.path.join(KELUAR, '%s-%s.txt' % (kode, lab)), 'w', encoding='utf-8').write(h.pop('teks'))
                h['status'] = st[:60]
                ring.setdefault(kode, {'label': label, 'perkara_id': pid, 'harap_tercetak': harap_cetak, 'diminta_petitum': diminta})[lab] = h
        finally:
            pulihkan_isian(pid, kd, lama)
            pakai_lab('aps_badilag_x3')
        s = ring[kode]['sesudah']
        print(kode, '| PERIKSA', len(s['periksa']), '| amar', s['nomor_amar'], 'urut' if s['nomor_urut'] else 'TIDAK URUT', '| kosong', s['butir_kosong'], s['paragraf_kosong_ganda'],
              '| amar memuat', [x for x, v in s['tuntutan_amar'].items() if v], '| sebelum PERIKSA', len(ring[kode]['sebelum']['periksa']))
    json.dump(ring, open(RINGKAS, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
