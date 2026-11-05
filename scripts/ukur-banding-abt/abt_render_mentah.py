# -*- coding: utf-8 -*-
"""Sisi ABT pembanding naskah utuh (Tahap 5): pecahan RTF MENTAH tiap #NNNN# menurut renderer php56 ABT ASLI (salinan milik sendiri).

Mengapa pecahan, bukan naskah utuh: variabel_library ABT hanya menghitung nilai tiap kemunculan penanda (get_variabel mengembalikan SEMUA
kemunculan, itulah yang membuat ABT lambat) lalu menyisipkannya dengan str_replace berurutan. Nilai satu penanda tidak bergantung pada
naskah di sekelilingnya, jadi naskah utuh ABT dapat dirakit dari pecahan ini dengan penyisipan yang sama (naskah.mts: cmd rakit) tanpa
mengulang ratusan menit render per blangko. Kesetaraan rakitan dengan render naskah utuh dibuktikan lewat naskah.mts: cmd verifikasi.

HANYA ABT salinan (sipp_vs + aps_badilag_vs) yang terlibat; render ABT menulis urutan sidang ke salinan itu, bukan ke SIPP sungguhan.
pakai: python abt_render_mentah.py <kode,kode,...|@berkas> <perkara_id> <keluar.json>        (env UJI_ABT_DIR, UJI_PHP, TMP)
       python abt_render_mentah.py --utuh <blangko.rtf> <perkara_id> <keluar.rtf>             (render naskah utuh, untuk verifikasi)
Keluaran memuat data perkara -> simpan di luar repo."""
import json, os, re, subprocess, sys

ABT = os.environ.get('UJI_ABT_DIR', r'D:\Aplikasi\aleta\tmp\vs30\abt')
PHP = os.environ.get('UJI_PHP', r'D:\sipp-server\php56\php.exe')
TMP = os.environ.get('TMP', r'D:\Aplikasi\aleta\tmp')
B = chr(92)


def jalankan(rtf_bita, pid, label):
    os.makedirs(os.path.join(ABT, '_blangko_abt'), exist_ok=True)
    rel = '_blangko_abt/_uji_t5_%s_%s.rtf' % (label, pid)
    out = os.path.join(TMP, 'uji_t5_keluar_%s_%s.rtf' % (label, pid))
    tugas = os.path.join(TMP, 'uji_t5_tugas_%s_%s.json' % (label, pid))
    berkas = os.path.join(ABT, rel.replace('/', os.sep))
    open(berkas, 'wb').write(rtf_bita)
    json.dump({'perkara_id': int(pid), 'rtf': rel, 'keluar': out, 'sidang': ''}, open(tugas, 'w'))
    env = dict(os.environ, TMP=TMP, TEMP=TMP, UJI_T_TUGAS=tugas)
    if os.path.exists(out):
        os.remove(out)
    r = subprocess.run([PHP, '-d', 'memory_limit=1024M', 'index.php', 'uji_t', 'render'], cwd=ABT, env=env, capture_output=True, timeout=6000)
    info = r.stdout.decode('cp1252', 'replace').strip()
    if not os.path.exists(out):
        raise SystemExit('render gagal: ' + info[-300:] + r.stderr.decode('cp1252', 'replace')[-300:])
    raw = open(out, 'rb').read()
    for f in (out, tugas, berkas):
        try:
            os.remove(f)
        except OSError:
            pass
    return raw, info


def pecahan(raw, kode):
    # "@@AKHIR@@" tanpa spasi sesudahnya (penutup dokumen uji): spasi dibuat opsional supaya pecahan penanda terakhir tidak ikut menelan penutup
    bag = re.split(r'\\pard @@(\d{3,5}|AKHIR)@@ ?', raw.decode('latin1'))
    hasil = {}
    for i in range(1, len(bag) - 1, 2):
        frag = bag[i + 1]
        hasil[bag[i]] = frag[:-4] if frag.endswith(B + 'par') else frag
    return {k: hasil.get(k) for k in kode}


def main():
    if sys.argv[1] == '--utuh':
        rtf, pid, keluar = sys.argv[2:5]
        raw, info = jalankan(open(rtf, 'rb').read(), pid, 'utuh')
        open(keluar, 'wb').write(raw)
        print(pid, 'OK', info[:100], flush=True)
        return
    kode, pid, keluar = sys.argv[1:4]
    kode = open(kode[1:], encoding='utf-8').read().strip() if kode.startswith('@') else kode
    kode = [k.strip() for k in re.split(r'[,\s]+', kode) if k.strip()]
    dok = ('{' + B + 'rtf1' + B + 'ansi' + B + 'ansicpg1252' + B + 'deff0{' + B + 'fonttbl{' + B + 'f0 Times New Roman;}}\n'
           + ''.join(B + 'pard @@%s@@ #%s#' % (k, k) + B + 'par\n' for k in kode) + B + 'pard @@AKHIR@@' + B + 'par}')
    raw, info = jalankan(dok.encode('latin1'), pid, 'mentah')
    json.dump({'perkara': pid, 'info': info[:120], 'mentah': pecahan(raw, kode)}, open(keluar, 'w', encoding='utf-8'), ensure_ascii=False)
    print(pid, 'OK', info[:100], flush=True)


if __name__ == '__main__':
    main()
