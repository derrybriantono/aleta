# -*- coding: utf-8 -*-
"""Bangun paket abt-keputusan-a-rekonvensi-4nov (keputusan Derry 182 butir A2, 4 Nov 2026): CT Rekonvensi [02] disusun ulang jadi KERANGKA.
pakai: python -B bangun_rekonvensi.py <akar _blangko_abt SESUDAH keputusan-a-kerangka-4nov> <paket-satker> <hasil>
Berkas: 1a Perceraian CT/[02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).rtf (satu berkas, md5 dasar dijaga tambal_rtf.py).
Yang dikerjakan (tiap butir dihitung dan dijaga jumlahnya; salah satu tidak cocok = BERHENTI):
  - fakta/keterangan saksi contoh -> variabel isian yang sudah ada (#5110# #2004# #9944# #0100# #0104# #5171# #5271# #7035# #5127# #1001#);
  - nominal contoh (susu/makan anak, gaji PNS, mahar, nilai mut'ah, lama nikah) -> isian kosong "Rp_ (_ rupiah)" / "_" (bentuk yang sudah dipakai berkas ini);
  - nafkah iddah per bulan/hari -> #9268# / #9269# (variabel paket keputusan-a-kerangka-4nov);
  - jawaban Tergugat Rekonvensi (5 butir contoh) -> #11405# (isian rekonvensi yang sudah ada);
  - catatan kerja "(APABILA SAKSI SAMA DENGAN SAKSI KONVENSI)" dan "(UNTUK PNS)" dibuang; butir bukti uang resepsi Rp56.000.000 (PR.3/TR.3) dan butir fakta khusus-contoh dibuang.
Sebutan "Penggugat/Tergugat (Rekonvensi)" TIDAK diganti: istilah baku rekonvensi yang didefinisikan berkas ini sendiri; konvensi sudah memakai #0046#/#0047#."""
import os
import re
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SINI)
sys.path.insert(0, os.path.join(SINI, '..', '..', 'keputusan-a-mekanis-4nov', 'sumber'))
from abtlib import md5b, peta, ubah, periksa, kurung_seimbang, tulis_paket  # noqa: E402

REL = 'derry_briantono/1a Perceraian CT/[02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).rtf'
N = 'abt-keputusan-a-rekonvensi-4nov'

# (lama, baru, jumlah) - atas teks tampak
TEKS = [
    # -- fakta anak / keterangan saksi (3 daftar keterangan saksi + 1 daftar fakta persidangan)
    ('anak Penggugat dan Tergugat tinggal dan ikut bersama Penggugat sebagai ibunya;',
     'anak Penggugat dan Tergugat bernama #5110# tinggal dan ikut bersama #2004# sebagai ibunya;', 3),
    ('Bahwa kebutuhan anak Penggugat dan Tergugat kurang lebih menurut saksi pertama untuk susu Rp. 200.000,00 (dua ratus ribu rupiah) setiap bulan sedangkan menurut saksi kedua Rp. 400.000,00 (empat ratus ribu rupiah) setiap bulan, untuk makan Rp. 20.000,00 (dua puluh ribu rupiah) setiap hari. #8554# mempertimbangkan keterangan saksi pertama Penggugat mengenai kebutuhan susu karena lebih menguntungkan Tergugat;',
     'Bahwa kebutuhan dasar anak Penggugat dan Tergugat menurut keterangan para saksi kurang lebih sejumlah Rp_ (_ rupiah) setiap bulan;', 3),
    ('Bahwa kebutuhan anak Penggugat dan Tergugat kurang lebih menurut saksi pertama sejumlah Rp200.000,00 (dua ratus ribu rupiah) setiap bulan sedangkan menurut saksi kedua sejumlah Rp400.000,00 (empat ratus ribu rupiah) setiap bulan, untuk makan sejumlah Rp20.000,00 (dua puluh ribu rupiah) setiap hari. #8554# mempertimbangkan keterangan saksi pertama Penggugat mengenai kebutuhan susu karena lebih menguntungkan Tergugat;',
     'Bahwa kebutuhan dasar anak Penggugat dan Tergugat kurang lebih sejumlah Rp_ (_ rupiah) setiap bulan;', 1),
    ('Bahwa Tergugat tidak menafkahi Penggugat selama berpisah tempat tinggal kurang lebih selama satu tahun;',
     'Bahwa Tergugat tidak menafkahi Penggugat selama berpisah tempat tinggal kurang lebih selama #9944#;', 3),
    ('Bahwa Tergugat saat ini belum memiliki pekerjaan;', 'Bahwa Tergugat saat ini bekerja sebagai #0100# #5171#;', 3),
    ('Bahwa Penggugat saat ini bekerja di salon;', 'Bahwa Penggugat saat ini bekerja sebagai #0104# #5271#;', 3),
    ('Bahwa yang pergi dari rumah tempat tinggal bersama adalah Penggugat;', 'Bahwa yang pergi dari rumah tempat tinggal bersama adalah #7035#;', 4),
    ('Bahwa Penggugat pergi dari rumah tempat tinggal bersama karena terjadi cekcok terus;', 'Bahwa #7035# pergi dari rumah tempat tinggal bersama karena #5127#;', 4),
    # -- daftar fakta persidangan: pekerjaan memakai pasangan variabel yang BENAR (Tergugat rekonvensi = #0046#, Penggugat rekonvensi = #0047#)
    ('Bahwa Tergugat saat ini bekerja sebagai #0104# _ #5271#;', 'Bahwa Tergugat saat ini bekerja sebagai #0100# #5171#;', 1),
    ('Bahwa Penggugat saat ini bekerja sebagai #0100# _ #5171#;', 'Bahwa Penggugat saat ini bekerja sebagai #0104# #5271#;', 1),
    # -- kebutuhan dasar anak (pertimbangan nafkah anak)
    ('kebutuhan dasar anak Penggugat dan Tergugat saat ini yaitu untuk susu Rp. 200.000,00 (dua ratus ribu rupiah) setiap bulan untuk makan Rp. 20.000,00 (dua puluh ribu rupiah) setiap hari dilipatkan selama 30 hari menjadi Rp. 600.000,00 (enam ratus ribu rupiah). Dua hal tersebut dalam penilaian #8554# adalah kebutuhan paling mendasar anak Penggugat dan Tergugat. Sehingga berdasarkan fakta tersebut, kebutuhan dasar anak Penggugat dan Tergugat adalah sejumlah Rp. 800.000,00 (delapan ratus ribu rupiah);',
     'kebutuhan dasar anak Penggugat dan Tergugat saat ini adalah sejumlah Rp_ (_ rupiah) setiap bulan, yang dalam penilaian #8554# adalah kebutuhan paling mendasar anak Penggugat dan Tergugat;', 1),
    # -- kemampuan suami (PNS)
    ('bekerja sebagai seorang guru pegawai negeri sipil dengan pangkat golongan ruang pembina (IV/a) dengan masa kerja kurang lebih 35 tahun',
     'bekerja sebagai seorang pegawai negeri sipil dengan pangkat golongan ruang _ dengan masa kerja kurang lebih _ tahun', 2),
    ('memiliki gaji sejumlah Rp5.000.000,00 (lima juta rupiah) setiap bulannya. Mengenai', 'memiliki gaji sejumlah Rp_ (_ rupiah) setiap bulannya. Mengenai', 2),
    ('gaji Tergugat rekonvensi setidaknya sejumlah Rp5.000.000,00 (lima juta rupiah) setiap bulannya; (UNTUK PNS)', 'gaji Tergugat rekonvensi setidaknya sejumlah Rp_ (_ rupiah) setiap bulannya;', 2),
    ('sebagai seorang guru. Dengan demikian', 'sebagai seorang pegawai negeri sipil. Dengan demikian', 1),
    # -- mahar dan mut'ah
    ('berupa emas 10 gram dan seperangkat alat sholat, maka', 'berupa #1001#, maka', 1),
    ('yakni emas 5 gram dan alat sholat. Emas sebesar 5 gram dan alat sholat jika dinilai dengan kurs pada saat ini kurang lebih senilai Rp5.000.000,00 (lima juta rupiah);',
     'yakni _. Bagian mahar tersebut jika dinilai pada saat ini kurang lebih senilai Rp_ (_ rupiah);', 1),
    ('telah berlangsung selama 5 (lima) tahun lamanya', 'telah berlangsung selama _ (_) tahun lamanya', 1),
    # -- nafkah iddah per bulan / per hari dari isian #6054# (variabel paket keputusan-a-kerangka-4nov)
    ('angka Rp_ (_ rupiah) setiap bulan atau Rp_ (_ rupiah) setiap harinya merupakan', 'angka #9268# setiap bulan atau #9269# setiap harinya merupakan', 1),
    # -- jawaban Tergugat rekonvensi: isian rekonvensi
    ('Tergugat menyampaikan jawaban rekonvensi yaitu;', 'Tergugat menyampaikan jawaban rekonvensi yang pada pokoknya #11405#;', 1),
    ('dengan alasan Tergugat rekonvensi merupakan istri yang durhaka, sehingga', 'dengan alasan sebagaimana dalam jawabannya, sehingga', 1),
    ('sebagai istri yang durhaka. Berdasarkan', 'sebagai istri yang nusyuz. Berdasarkan', 1),
    ('justru mendalilkan Penggugat rekonvensi sebagai istri yang durhaka. Atas dasar', 'justru mendalilkan Penggugat rekonvensi sebagai istri yang nusyuz. Atas dasar', 1),
]
# paragraf yang dibuang seluruhnya (teks persis, jumlah)
HAPUS = [
    ('(APABILA SAKSI SAMA DENGAN SAKSI KONVENSI)', 2),
    ('-\tBahwa berdasarkan bukti PR.3, terbukti bahwa sebelum menikah dengan Tergugat, Penggugat pernah mengirim uang total sejumlah Rp56.000.000,00 (lima puluh enam juta rupiah) kepada pihak keluarga Tergugat untuk keperluan biaya resepsi pernikahan Penggugat dengan Tergugat;', 1),
    ('-\tBahwa berdasarkan bukti TR.3, terbukti bahwa sebelum menikah dengan Tergugat, Penggugat pernah mengirim uang total sejumlah Rp56.000.000,00 (lima puluh enam juta rupiah) kepada pihak keluarga Tergugat untuk keperluan biaya resepsi pernikahan Penggugat dengan Tergugat;', 1),
    ('Bahwa Tergugat tidak pernah datang menjemput Penggugat;', 3),
    ('Bahwa Tergugat tidak pernah datang menjemput Penggugat serta tidak pernah berkomunikasi kembali;', 1),
    ('Bahwa mengenai tuntutan mut\u2019ah, Tergugat juga menolak karena sikap dan perilaku Penggugat yang tidak pernah berubah;', 1),
    ('Bahwa terhadap nafkah anak\xa0dan nafkah iddah Penggugat, Tergugat tidak berkeberatan namun mohon agar disesuaikan dengan kemampuan Tergugat;', 1),
    ('Bahwa mengenai tuntutan Penggugat atas nafkah lampau, Tergugat menolak karena sejak pisah tempat kediaman Tergugat tetap memberi nafkah kepada Penggugat;', 1),
    ('Bahwa hak pengasuhan terhadap #0007# orang anak tersebut mohon dibagi, untuk Penggugat dan Tergugat, karena Penggugat tidak mempunyai pekerjaan tetap;', 1),
    ('Dalam hal pemeliharaan anak dan nafkah anak Tergugat tidak menanggapi (referte);', 1),
]


def cari_semua(teks, s):
    out, i = [], 0
    while True:
        j = teks.find(s, i)
        if j < 0:
            return out
        out.append(j)
        i = j + len(s)


def main():
    akar, keluar, hasil_dir = sys.argv[1:4]
    b = open(os.path.join(akar, REL), 'rb').read()
    teks, pos = peta(b)
    # --- ubahan teks
    ops, ringkas = [], []
    for lama, baru, n in TEKS:
        idx = cari_semua(teks, lama)
        if len(idx) != n:
            raise SystemExit('TEKS: %d kali (harap %d): %r' % (len(idx), n, lama[:90]))
        for a in idx:
            ops.append((a, a + len(lama), baru))
        ringkas.append((len(idx), lama[:70], baru[:70]))
    # --- paragraf dibuang
    P = [m.start() for m in re.finditer(rb'(?<=\})\\pard \\plain', b)]
    para = []  # (awal teks, akhir teks)
    s = 0
    for k, kata in enumerate(teks.split('\n')):
        para.append((s, s + len(kata), kata))
        s += len(kata) + 1
    hapus_raw = []
    for isi, n in HAPUS:
        idx = [p for p in para if p[2] == isi]
        if len(idx) != n:
            raise SystemExit('HAPUS: %d paragraf (harap %d): %r' % (len(idx), n, isi[:90]))
        for (s0, e0, _) in idx:
            o_awal = pos[s0][0]
            kand = [x for x in P if x <= o_awal]
            if not kand:
                raise SystemExit('HAPUS: awal paragraf tidak ditemukan')
            a = kand[-1]
            sesudah = [x for x in P if x > pos[e0][0]]
            z = sesudah[0] if sesudah else None
            if z is None:
                raise SystemExit('HAPUS: akhir paragraf tidak ditemukan')
            seg = b[a:z]
            t_seg, _ = peta(seg)
            if not kurung_seimbang(seg) or seg.count(b'\\par}') + len(re.findall(rb'\\par\b', seg)) < 1 or t_seg != isi + '\n':
                raise SystemExit('HAPUS: segmen paragraf tidak persis satu paragraf: %r vs %r' % (t_seg[:80], isi[:80]))
            hapus_raw.append((a, z, seg))
        ringkas.append((n, 'HAPUS ' + isi[:70], ''))
    hapus_raw.sort()
    for x, y in zip(hapus_raw, hapus_raw[1:]):
        if y[0] < x[1]:
            raise SystemExit('HAPUS bertumpuk')
    # --- terapkan teks lalu hapus
    h, pot, harap = ubah(b, ops, teks, pos)
    for a, z, seg in hapus_raw:
        for off, l0, l1 in pot:
            if not (off + len(l0) <= a or z <= off):
                raise SystemExit('ubahan teks bersinggungan dengan paragraf yang dibuang')
    pot_semua = list(pot) + [(a, seg, b'') for a, z, seg in hapus_raw]
    pot_semua.sort()
    h = b
    for off, l0, l1 in sorted(pot_semua, key=lambda x: -x[0]):
        assert h[off:off + len(l0)] == l0
        h = h[:off] + l1 + h[off + len(l0):]
    # teks harapan: ubahan teks lalu buang paragraf (dari belakang)
    harap2 = teks
    for a, z, baru in sorted(ops, reverse=True):
        harap2 = harap2[:a] + baru + harap2[z:]
    ps = harap2.split('\n')
    for isi, n in HAPUS:
        pass
    # paragraf yang dibuang dicocokkan dengan teks BARU (ubahan teks tidak menyentuh paragraf itu)
    sisa = []
    dibuang = {}
    for isi, n in HAPUS:
        dibuang[isi] = n
    for p in ps:
        if p in dibuang and dibuang[p] > 0:
            dibuang[p] -= 1
            continue
        sisa.append(p)
    harap3 = '\n'.join(sisa)
    periksa(b, h, harap3)
    if re.search(rb'(?i)aleta', h):
        raise SystemExit('nama aplikasi')
    # pemeriksaan isi: tak ada lagi fakta contoh
    t_baru, _ = peta(h)
    for kata in ('salon', 'Rp56', 'Rp. 200', 'Rp. 400', 'Rp. 20.000', 'Rp. 600', 'Rp. 800', 'Rp5.000.000', 'guru', 'IV/a', 'emas 10 gram', 'emas 5 gram', 'durhaka', 'APABILA SAKSI SAMA', 'UNTUK PNS', 'menjemput', 'kurang lebih selama satu tahun'):
        if kata in t_baru:
            raise SystemExit('fakta contoh masih ada: ' + kata)
    daftar = [('R0001', REL, md5b(b), md5b(h), len(pot_semua))]
    tambal = [('R0001', off, l0, l1) for off, l0, l1 in pot_semua]
    os.makedirs(keluar, exist_ok=True)
    os.makedirs(hasil_dir, exist_ok=True)
    tulis_paket(keluar, daftar, tambal, 'sesudah keputusan-a-kerangka-4nov (berkas tak disentuh paket itu: sesudah keputusan-a-mekanis-4nov)')
    # --- PRASYARAT SQL (baca saja): semua variabel yang dirujuk berkas baru ada di abt_variabel (termasuk 9268/9269 dari paket kerangka)
    nomor = sorted(set(re.findall(r'#(\d{4,5})#', t_baru)))
    open(os.path.join(keluar, 'nomor-dirujuk.txt'), 'w', newline='\n').write(''.join(n + '\n' for n in nomor))
    kepala = '-- PRASYARAT paket %s (BACA SAJA). Satu angka: banyaknya variabel yang dirujuk berkas baru dan ada di abt_variabel (harus %d; 9268/9269 = paket keputusan-a-kerangka-4nov).\n' % (N, len(nomor))
    open(os.path.join(keluar, '%s-PRASYARAT.sql' % N), 'w', newline='\n').write(
        kepala + 'SELECT COUNT(*) AS prasyarat FROM abt_variabel WHERE no_var IN (%s);\n' % ','.join(str(int(n)) for n in nomor))
    open(os.path.join(keluar, 'harap.txt'), 'w', newline='\n').write('%d\n' % len(nomor))
    import shutil
    for f_ in ('pasang-satker.sh', 'pulih-satker.sh'):
        shutil.copyfile(os.path.join(SINI, f_), os.path.join(keluar, f_))
    shutil.copyfile(os.path.join(SINI, '..', '..', 'keputusan-a-mekanis-4nov', 'paket-satker', 'tambal_rtf.py'), os.path.join(keluar, 'tambal_rtf.py'))
    semua = []
    for d_, _, fs in os.walk(keluar):
        for f_ in fs:
            if f_ not in ('MD5SUMS.txt',) and not d_.endswith('cadangan'):
                p_ = os.path.join(d_, f_)
                semua.append((os.path.relpath(p_, keluar).replace(os.sep, '/'), md5b(open(p_, 'rb').read())))
    with open(os.path.join(keluar, 'MD5SUMS.txt'), 'w', newline='\n') as o_:
        for rel_, m_ in sorted(semua):
            o_.write('%s  %s\n' % (m_, rel_))
    with open(os.path.join(hasil_dir, 'ubahan.txt'), 'w', encoding='utf-8', newline='\n') as f:
        for n, lama, baru in ringkas:
            f.write('%d x\t%s\t=>\t%s\n' % (n, lama.replace('\n', ' '), baru))
        f.write('POTONGAN %d (teks %d, paragraf dibuang %d); ukuran %d -> %d\n' % (len(pot_semua), len(pot), len(hapus_raw), len(b), len(h)))
    print('POTONGAN %d (teks %d, paragraf dibuang %d); ukuran %d -> %d' % (len(pot_semua), len(pot), len(hapus_raw), len(b), len(h)))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
