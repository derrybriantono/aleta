# -*- coding: utf-8 -*-
"""Daftar kelompok 540 baris teks merah berusulan "hitamkan atau isian" (A5): TIDAK mengubah blangko. Satu kelompok = satu bunyi rangkaian merah utuh
(token merah bersambung dalam satu paragraf). Usulan tetap/pilihan adalah usulan untuk diputuskan pemilik, bukan keputusan.
pakai: python -B alat/kelompok_540.py <akar pohon dasar> <daftar-teks-merah.csv> <folder keluar>  -> kelompok-540.csv, kelompok-540.html"""
import collections
import csv
import html
import os
import re
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(SINI, '..', 'sumber'))
import merahpos as mp  # noqa: E402

CATATAN = re.compile(r'\s*\((?:PERTIMBANGAN APABILA SAKSI HANYA MENGETAHUI PISAH TAPI TIDAK MELIHAT LANGSUNG APA MASALAHNYA)\);?')
# (awalan bunyi, usulan, alasan satu kalimat, ragu?)
U = [
    ('fotokopi Kartu Tanda Penduduk', 'tetap', 'Identitas bukti P.1/T.1 hampir selalu KTP dan petugas tetap dapat menyuntingnya bila lain.', False),
    ('Bahwa mengenai peristiwa perselisihan dan pertengkaran #0046#', 'pilihan', 'Hanya berlaku bila saksi Penggugat tidak mengetahui langsung pertengkaran, sesuai catatan kerja yang menyertainya.', False),
    ('- Bahwa bukti T.3 pada pokoknya', 'pilihan', 'Isi bukti T.3 ini contoh satu perkara, sehingga hanya dipakai bila bukti elektronik itu memang ada.', True),
    ('- Bahwa meskipun #0047# tidak dapat menunjukkan digital forensic', 'pilihan', 'Hanya berlaku bila Tergugat mengajukan bukti elektronik tanpa hasil digital forensic.', False),
    ('- Bahwa syarat materiil', 'pilihan', 'Hanya berlaku bila ada bukti elektronik yang dinilai dalam perkara itu.', False),
    ('Bahwa keluarga sudah merukunkan', 'pilihan', 'Tidak semua perkara ada upaya keluarga; isian #1268# yang sudah ada mungkin dapat dipakai.', True),
    ('Bahwa mengenai peristiwa perselisihan dan pertengkaran #0047#', 'pilihan', 'Hanya berlaku bila saksi Tergugat tidak mengetahui langsung pertengkaran.', False),
    ('Bahwa sejak #0222# antara', 'tetap', 'Butir fakta inti cerai yang isinya sudah datang dari variabel.', False),
    ('Bahwa sejak lebih dari #9944#', 'tetap', 'Butir fakta inti pisah rumah yang isinya sudah datang dari variabel.', False),
    ('Bahwa selama berpisah tempat tinggal', 'tetap', 'Kelanjutan fakta pisah rumah tanpa isian yang berubah; bisa jadi ada perkara yang pernah serumah lagi.', True),
    ('Menimbang, bahwa berdasarkan pertimbangan di atas, maka dapat ditarik kesimpulan', 'tetap', 'Kesimpulan yang lazim, tetapi memuat frasa sudah dirukunkan kembali yang tidak selalu terjadi.', True),
    ('Menimbang, bahwa ternyata saksi-saksi yang diajukan', 'pilihan', 'Hanya berlaku bila saksi kedua pihak tidak mengetahui langsung pertengkaran, dan menyebut bukti T.3.', False),
    ('maupun #0047#', 'pilihan', 'Hanya berlaku bila Tergugat juga berkuasa; data kuasa SIPP mungkin dapat menentukannya otomatis.', False),
    ('Artinya: “boleh bagi istri', 'pilihan', 'Terjemah kutipan untuk blok suami tidak bekerja, jadi mengikuti pilihan blok itu.', False),
    ('Menimbang, bahwa #8554# perlu mempertimbangkan fakta #0047# tidak bekerja', 'pilihan', 'Hanya berlaku bila suami tidak bekerja; juga ada salah ketik "#0046##" yang tercetak dengan tanda pagar.', False),
    ('Dalil mengenai …;', 'pilihan', 'Bagian kosong (tanda elipsis) seperti CT; dapat memakai isian 9289 atau dihapus bila tidak ada dalil lain.', False),
    ('- Dalil mengenai _;', 'pilihan', 'Bagian kosongnya sudah jadi isian 9289 di paket ini; yang tersisa hanya menghitamkan kata pembukanya.', False),
    ('maupun kuasa hukum #0047#', 'pilihan', 'Hanya berlaku bila Tergugat juga berkuasa.', False),
    ('. Selanjutnya telah dilakukan peletakan sita jaminan', 'pilihan', 'Hanya berlaku bila sita jaminan sudah diletakkan.', False),
    ('4, 5 dan 6', 'pilihan', 'Nomor posita berubah menurut permohonan, jadi lebih cocok sebagai isian daripada teks tetap.', True),
    ('HAPUS BAGIAN INI BILA TIDAK ADA OBJEK', 'pilihan', 'Petunjuk kerja, bukan isi putusan: tidak boleh dihitamkan, tetapi juga bukan kalimat pilihan biasa.', True),
    ('ISI KETERANGAN SAKSI TERGUGAT', 'pilihan', 'Petunjuk kerja untuk bagian yang harus diketik: lebih tepat isian kosong atau tetap merah sampai diisi.', True),
    ('ISI PERTIMBANGAN PEMBUKTIAN PER OBJEK', 'pilihan', 'Petunjuk kerja untuk bagian yang harus diketik: lebih tepat isian kosong atau tetap merah sampai diisi.', True),
    ('ISI PERTIMBANGAN PER OBJEK SENGKETA', 'pilihan', 'Petunjuk kerja untuk bagian yang harus diketik: lebih tepat isian kosong atau tetap merah sampai diisi.', True),
    ('Menimbang, bahwa dalam #0047# dalam persidangan mengajukan surat kuasa', 'pilihan', 'Hanya berlaku bila Tergugat berkuasa; juga ada salah ketik "bahwa dalam ... dalam persidangan".', False),
    ('Menimbang, bahwa dari hal-hal tersebut, para #0046# wajib membuktikan', 'tetap', 'Pertimbangan umum beban pembuktian itsbat yang berlaku di semua perkara blangko ini.', False),
    ('P.1 sampai dengan P.6', 'pilihan', 'Jumlah bukti berubah menurut perkara, jadi lebih cocok sebagai isian.', False),
    ('angka 1 dan 2', 'pilihan', 'Nomor posita berubah menurut permohonan, jadi lebih cocok sebagai isian daripada teks tetap.', True),
    ('maupun surat kuasa khusus #0047#', 'pilihan', 'Hanya berlaku bila Tergugat juga berkuasa.', False),
    ('_ (_) tahun', 'pilihan', 'Bagian kosong lama hidup bersama yang berubah per perkara, jadi lebih cocok sebagai isian.', False),
    ('#0046# I / II', 'pilihan', 'Sama dengan isian 9285 paket ini, jadi dapat memakai isian itu.', False),
    ('ANAK 1', 'pilihan', 'Penanda nama anak yang harus diganti, mungkin dari data anak SIPP.', True),
    ('ANAK 2', 'pilihan', 'Penanda nama anak yang harus diganti, mungkin dari data anak SIPP; tidak berlaku bila anak hanya satu.', True),
    ('Artinya: “Dan perdamaian itu lebih baik', 'tetap', 'Terjemah kutipan yang selalu relevan di blangko mediasi berhasil sebagian ini.', False),
    ('Artinya: “Perdamaian itu boleh', 'tetap', 'Terjemah kutipan yang selalu relevan di blangko mediasi berhasil sebagian ini.', False),
    ('BILA SEBAGIAN OBJEK REKONVENSI TERBUKTI', 'pilihan', 'Petunjuk kerja, bukan isi putusan: tidak boleh dihitamkan.', True),
    ('BILA SELURUH OBJEK REKONVENSI TERBUKTI', 'pilihan', 'Petunjuk kerja, bukan isi putusan: tidak boleh dihitamkan.', True),
    ('MULAI DARI SINI (NAMA AKTA CERAI', 'pilihan', 'Petunjuk kerja, bukan isi putusan: lebih tepat dibuang, tetapi di luar keputusan paket ini.', True),
    ('MULAI DARI SINI', 'pilihan', 'Petunjuk kerja, bukan isi putusan: lebih tepat dibuang, tetapi di luar keputusan paket ini.', True),
    ('belum bercerai/ bercerai secara resmi', 'pilihan', 'Dua keadaan bergaris miring dan satu bagian kosong yang harus dipilih per perkara.', False),
    ('kelas _', 'pilihan', 'Bagian kosong kelas anak yang berubah per perkara, jadi lebih cocok sebagai isian.', False),
    ('mengidap penyakit yang menghalangi', 'pilihan', 'Sebab tidak terjadi hubungan berbeda per perkara, walau blangko ini khusus alasan tersebut.', True),
    ('pria/wanita', 'pilihan', 'Sama dengan isian 9287 paket ini, jadi dapat memakai isian itu.', False),
    ('putra', 'pilihan', 'Jenis kelamin anak berubah per perkara, mungkin dari data anak SIPP.', False),
    ('putri', 'pilihan', 'Jenis kelamin anak berubah per perkara, mungkin dari data anak SIPP.', False),
]


def usul(teks):
    cocok = [u for u in U if teks.startswith(u[0])]
    if not cocok:
        raise SystemExit('tanpa usulan: ' + teks[:80])
    return max(cocok, key=lambda u: len(u[0]))


def kumpul(akar, daftar):
    rows = list(csv.DictReader(open(daftar, encoding='utf-8-sig')))
    per = collections.OrderedDict()
    for x in rows:
        per.setdefault(x['berkas'], []).append(x)
    grup = {}
    total = 0
    for rel, rr in per.items():
        if not any(x['usulan'] == 'hitamkan atau isian' for x in rr):
            continue
        p = mp.peta(open(os.path.join(akar, 'derry_briantono', rel), 'rb').read())
        bc = mp.baris_csv(p['toks'])
        assert len(bc) == len(rr), rel
        tanda = {id(t): x for x, t in zip(rr, bc)}
        bypara = collections.defaultdict(list)
        for t in p['toks']:
            bypara[t['para']].append(t)
        for k, ts in bypara.items():
            i = 0
            while i < len(ts):
                if not ts[i]['merah']:
                    i += 1
                    continue
                j = akhir = i
                while j + 1 < len(ts) and (ts[j + 1]['merah'] or not ts[j + 1]['teks'].strip()):
                    j += 1
                    if ts[j]['merah']:
                        akhir = j
                run = ts[i:akhir + 1]
                baris = [tanda[id(t)] for t in run if id(t) in tanda and tanda[id(t)]['usulan'] == 'hitamkan atau isian']
                if baris:
                    tx = p['para'][k][run[0]['p0']:run[-1]['p0'] + len(run[-1]['teks'])]
                    tx = CATATAN.sub('', re.sub(r'\s+', ' ', tx)).strip()
                    g = grup.setdefault(tx, {'teks': tx, 'berkas': collections.Counter(), 'baris': 0, 'muncul': 0})
                    g['berkas'][rel] += 1
                    g['baris'] += len(baris)
                    g['muncul'] += 1
                    total += len(baris)
                i = akhir + 1
    if total != 540:
        raise SystemExit('jumlah baris %d bukan 540' % total)
    return sorted(grup.values(), key=lambda g: (-g['muncul'], -len(g['berkas']), g['teks']))


CSS = '''
:root{--latar:#fbfaf7;--kertas:#fff;--teks:#23221f;--redup:#6b6962;--garis:#e2dfd7;--merah:#a8201a;--tetap:#1d5c3f;--pilih:#27508f;--ragu:#8a5a00;--ragu-latar:#fdf3dc}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--latar:#191917;--kertas:#22221f;--teks:#ecebe6;--redup:#a5a39b;--garis:#3a3934;--merah:#ef8a84;--tetap:#7fcfa9;--pilih:#9dbdf0;--ragu:#f1c76c;--ragu-latar:#3a2f15}}
*{box-sizing:border-box}body{margin:0;background:var(--latar);color:var(--teks);font:15px/1.55 system-ui,"Segoe UI",sans-serif}
main{max-width:1180px;margin:0 auto;padding:20px 16px 56px}h1{font-size:22px;margin:0 0 6px}p{margin:6px 0}.redup{color:var(--redup)}
.alat{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:14px 0}.alat button{font:inherit;border:1px solid var(--garis);background:var(--kertas);color:var(--teks);padding:6px 12px;border-radius:6px;cursor:pointer}
.alat button[aria-pressed="true"]{border-color:var(--teks);font-weight:600}
.k{background:var(--kertas);border:1px solid var(--garis);border-radius:8px;padding:12px 14px;margin:10px 0}
.k.ragu{border-left:4px solid var(--ragu)}.kep{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:baseline;margin-bottom:6px;font-size:14px}.no{font-weight:600}
.b{color:var(--merah);overflow-wrap:anywhere}.b.pjg{max-height:7.8em;overflow:hidden}.b.buka{max-height:none}
.lab{font-weight:700}.lab.tetap{color:var(--tetap)}.lab.pilihan{color:var(--pilih)}.tag{background:var(--ragu-latar);color:var(--ragu);padding:0 7px;border-radius:4px;font-size:13px;font-weight:600}
details{margin-top:6px;font-size:14px}summary{cursor:pointer;color:var(--redup)}li{overflow-wrap:anywhere}.lagi{font:inherit;font-size:13px;border:0;background:none;color:var(--pilih);padding:2px 0;cursor:pointer}
'''
JS = '''
var tb=document.querySelectorAll('[data-saring]');tb.forEach(function(b){b.onclick=function(){var s=b.dataset.saring;tb.forEach(function(x){x.setAttribute('aria-pressed',x===b)});
document.querySelectorAll('.k').forEach(function(k){k.hidden=!(s==='semua'||(s==='ragu'&&k.classList.contains('ragu'))||k.dataset.u===s)})}});
document.querySelectorAll('.lagi').forEach(function(b){b.onclick=function(){var t=b.previousElementSibling;t.classList.toggle('buka');b.textContent=t.classList.contains('buka')?'Tutup':'Tampilkan utuh'}});
'''


def main():
    akar, daftar, keluar = sys.argv[1:4]
    L = kumpul(akar, daftar)
    with open(os.path.join(keluar, 'kelompok-540.csv'), 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        w.writerow(['kelompok', 'bunyi', 'muncul', 'baris daftar', 'jumlah berkas', 'usulan', 'alasan', 'ragu', 'berkas (jumlah muncul)', 'keputusan'])
        for i, g in enumerate(L, 1):
            u = usul(g['teks'])
            w.writerow([i, g['teks'], g['muncul'], g['baris'], len(g['berkas']), u[1], u[2], 'ragu' if u[3] else '', ' | '.join('%s (%d)' % kv for kv in g['berkas'].items()), ''])
    n = collections.Counter(usul(g['teks'])[1] for g in L)
    rg = sum(1 for g in L if usul(g['teks'])[3])
    h = ['<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Kelompok teks merah</title><style>%s</style></head><body><main>' % CSS,
         '<h1>540 baris teks merah, %d kelompok</h1>' % len(L),
         '<p>Baris berusulan "hitamkan atau isian" di daftar A5, disatukan per bunyi rangkaian merah yang sama, urut dari yang paling banyak muncul. '
         'Ini usulan untuk diputuskan pemilik, bukan keputusan. Tidak ada blangko yang diubah karena daftar ini.</p>',
         '<p class="redup">Tetap = warna merah dihilangkan, kalimat selalu tercetak. Pilihan = kalimat hanya berlaku pada keadaan tertentu atau harus diisi per perkara. '
         'Usulan: %d tetap, %d pilihan, %d ditandai ragu. Catatan kerja "(PERTIMBANGAN APABILA ...)" tidak ditampilkan karena dibuang paket a5-merah-5nov.</p>' % (n['tetap'], n['pilihan'], rg),
         '<div class="alat"><button data-saring="semua" aria-pressed="true">Semua</button><button data-saring="ragu" aria-pressed="false">Ragu (%d)</button><button data-saring="tetap" aria-pressed="false">Tetap (%d)</button><button data-saring="pilihan" aria-pressed="false">Pilihan (%d)</button></div>' % (rg, n['tetap'], n['pilihan'])]
    for i, g in enumerate(L, 1):
        u = usul(g['teks'])
        pjg = len(g['teks']) > 520
        h.append('<section class="k%s" data-u="%s"><div class="kep"><span class="no">#%d</span><span>muncul %d kali</span><span>%d berkas</span><span class="redup">%d baris daftar</span>%s</div>'
                 % (' ragu' if u[3] else '', u[1], i, g['muncul'], len(g['berkas']), g['baris'], '<span class="tag">Ragu</span>' if u[3] else ''))
        h.append('<div class="b%s">%s</div>%s' % (' pjg' if pjg else '', html.escape(g['teks']), '<button class="lagi">Tampilkan utuh</button>' if pjg else ''))
        h.append('<p><span class="lab %s">%s.</span> %s</p>' % (u[1], u[1].capitalize(), html.escape(u[2])))
        h.append('<details><summary>Daftar berkas (%d)</summary><ul>%s</ul></details></section>' % (len(g['berkas']), ''.join('<li>%s%s</li>' % (html.escape(k), ' (%d kali)' % v if v > 1 else '') for k, v in g['berkas'].items())))
    h.append('<script>%s</script></main></body></html>' % JS)
    open(os.path.join(keluar, 'kelompok-540.html'), 'w', encoding='utf-8', newline='\n').write('\n'.join(h))
    print('kelompok', len(L), dict(n), 'ragu', rg)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
