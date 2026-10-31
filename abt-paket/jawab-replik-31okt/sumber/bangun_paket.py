# -*- coding: utf-8 -*-
"""Bangun paket ABT jawab-replik-31okt (31 Okt 2026) - naskah utuh jawab-menjawab di BAS dan duduk perkara putusan.

pakai: python bangun_paket.py <akar _blangko_abt sesudah SEMUA paket rantai (21 paket)> <basis ABT sesudah semua paket>

Permintaan pengguna 31 Okt: isian Blangko Derry untuk jawaban (+ gugatan rekonvensi), replik (+ jawaban rekonvensi), duplik
(+ replik rekonvensi), duplik rekonvensi, kesimpulan Penggugat/Pemohon dan Tergugat/Termohon - terisi otomatis dari dokumen
e-Court (ekstensi/bot), dapat disunting, bentuknya benar. Arahan susulan: hanya dalil + petitum; WAJIB ada di semua putusan
kontradiktoir perkara gugatan (verstek dan Pdt.P tidak disisipi) dan di BAS sidang jawab-menjawab.

Isi (nomor BARU 12020-12036 dari blok 12020-12049):
  12020-12028  data_teks  isian naskah (teks polos berparagraf; dicetak lewat isian_rtf_butir: inden gantung menurut penanda)
  12030-12034  data_sql   BAS e-Court: jawaban+gugatan rekonvensi / replik+jawaban rekonvensi / duplik+replik rekonvensi /
                          duplik rekonvensi / kesimpulan kedua pihak - disisipkan sesudah kalimat "#7083# ... sebagai berikut;"
  12035-12036  data_sql   putusan kontradiktoir yang hanya memuat POKOK jawaban (ES sederhana, izin poligami, itsbat kontensius,
                          verzet, cabut sesudah jawaban, putusan sela, li'an): naskah tertulis menyusul sesudah kalimat jawaban /
                          kesimpulan - KOSONG bila isian tertulis kosong (cetakan lama tidak berubah)
  diubah: 9252 9253 9254 (jawaban/replik/duplik di duduk perkara: naskah tertulis bila ada, selain itu tanya jawab lisan seperti
          dulu), 9257 9258 (kesimpulan paragraf: naskah tertulis bila ada, selain itu isian 8436/8437 seperti dulu).
Blangko RTF (hanya derry_briantono, folder aktif - sama dengan aturan tinjau-31okt):
  - paragraf petunjuk merah/tebal "COPY FILE <JAWABAN|REPLIK|DUPLIK|DUPLIK REKONVENSI|KESIMPULAN> APABILA TERTULIS ..." diganti
    variabel penampilnya (dihapus bila variabel itu sudah tepat di paragraf sebelumnya);
  - kalimat "... mengajukan duplik rekonvensi secara ..." tanpa isi: disisipi #12033#;
  - BAS ALUR jawaban/replik/duplik/duplik rekonvensi/kesimpulan: #12030#-#12034# sesudah paragraf #7083#;
  - kelompok tersembunyi {\\*\\isianasal ...} berisi isian naskah di samping tiap variabel penampil (isian tampil di tabel ABT).
Keluaran: ../paket-satker (tambal ber-md5 + SQL) dan ../hasil.
"""
import collections
import difflib
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
TINJAU = os.path.join(SINI, '..', '..', 'tinjau-31okt', 'paket-satker')
MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
N = 'abt-jawab-replik-31okt'
TANGGAL = '2026-10-31 00:00:00'
BS = chr(92)


def DATA(n):
    return "(SELECT t.data FROM aps_badilag.abt_data_teks t WHERE t.no_var = %d AND t.perkara_id = '#perkara_id#' LIMIT 1)" % n


def ADA(n):
    return "CHAR_LENGTH(TRIM(REPLACE(REPLACE(IFNULL(%s, ''), CHAR(13), ''), CHAR(10), ''))) > 0" % DATA(n)


def BLOK(n):
    return "aps_badilag.isian_rtf_blok(%s, 'teks', 426)" % DATA(n)


def BUTIR(n):
    return "IFNULL(aps_badilag.isian_rtf_butir(%s, 'teks', 426), '')" % DATA(n)


def PAR(teks_sql, fi):
    """Satu paragraf rata kiri-kanan, spasi 1,5; teks_sql = ekspresi SQL. Garis miring terbalik lewat CHAR(92) (tanpa escape)."""
    return ("CONCAT(REPLACE('|pard|qj|fi%d|li0|sl360|slmult1|widctlpar ', '|', CHAR(92)), %s, REPLACE('|par ', '|', CHAR(92)))" % (fi, teks_sql))


def TGL(var):
    return "IF(TRIM('#%s#') <> '', CONCAT(' tanggal ', TRIM('#%s#')), '')" % (var, var)


NAMA_ISIAN = {
    12020: 'URAIAN JAWABAN #0047# (TERTULIS; DALAM KONVENSI BILA ADA REKONVENSI) - ISIAN otomatis dari dokumen yang diunggah pihak: dalil dan petitum, satu paragraf per baris; kosong = jawaban lisan atau titik-titik',
    12021: 'URAIAN GUGATAN REKONVENSI #0047# (BAGIAN DALAM REKONVENSI JAWABAN SAMPAI PETITUM) - ISIAN otomatis dari dokumen jawaban; kosong = tidak dicetak',
    12022: 'URAIAN REPLIK #0046# (TERTULIS; DALAM KONVENSI BILA ADA REKONVENSI) - ISIAN otomatis dari dokumen yang diunggah pihak: dalil dan petitum, satu paragraf per baris; kosong = replik lisan atau titik-titik',
    12023: 'URAIAN JAWABAN REKONVENSI #0046# (BAGIAN DALAM REKONVENSI REPLIK) - ISIAN otomatis dari dokumen replik; kosong = tidak dicetak',
    12024: 'URAIAN DUPLIK #0047# (TERTULIS; DALAM KONVENSI BILA ADA REKONVENSI) - ISIAN otomatis dari dokumen yang diunggah pihak: dalil dan petitum, satu paragraf per baris; kosong = duplik lisan atau titik-titik',
    12025: 'URAIAN REPLIK REKONVENSI #0047# (BAGIAN DALAM REKONVENSI DUPLIK) - ISIAN otomatis dari dokumen duplik; kosong = tidak dicetak',
    12026: 'URAIAN DUPLIK REKONVENSI #0046# (TERTULIS) - ISIAN otomatis dari dokumen duplik rekonvensi yang diunggah pihak; kosong = titik-titik',
    12027: 'URAIAN KESIMPULAN #0046# (TERTULIS) - ISIAN otomatis dari dokumen kesimpulan yang diunggah pihak: dalil dan petitum; kosong = isian Kesimpulan oleh #0046#',
    12028: 'URAIAN KESIMPULAN #0047# (TERTULIS) - ISIAN otomatis dari dokumen kesimpulan yang diunggah pihak: dalil dan petitum; kosong = isian Kesimpulan oleh #0047#',
}

KES_P = "IF(%s, %s, %s)" % (ADA(12027), BLOK(12027), BLOK(8436))
KES_T = "IF(%s, %s, %s)" % (ADA(12028), BLOK(12028), BLOK(8437))

VAR_SQL = {
    12030: ('JAWAB-MENJAWAB BAS: JAWABAN #0047# DAN GUGATAN REKONVENSI TERTULIS (OTOMATIS dari isian 12020 dan 12021; paragraf berinden gantung; kosong = titik-titik)',
            "SELECT CONCAT(%s, %s) AS data" % (BLOK(12020), BUTIR(12021))),
    12031: ('JAWAB-MENJAWAB BAS: REPLIK #0046# DAN JAWABAN REKONVENSI TERTULIS (OTOMATIS dari isian 12022 dan 12023; kosong = titik-titik)',
            "SELECT CONCAT(%s, %s) AS data" % (BLOK(12022), BUTIR(12023))),
    12032: ('JAWAB-MENJAWAB BAS: DUPLIK #0047# DAN REPLIK REKONVENSI TERTULIS (OTOMATIS dari isian 12024 dan 12025; kosong = titik-titik)',
            "SELECT CONCAT(%s, %s) AS data" % (BLOK(12024), BUTIR(12025))),
    12033: ('JAWAB-MENJAWAB: DUPLIK REKONVENSI #0046# TERTULIS (OTOMATIS dari isian 12026; BAS dan duduk perkara; kosong = titik-titik)',
            "SELECT %s AS data" % BLOK(12026)),
    12034: ('JAWAB-MENJAWAB BAS: KESIMPULAN KEDUA PIHAK (OTOMATIS dari isian 12027/12028; kosong = isian Kesimpulan oleh #0046#/#0047#)',
            "SELECT CONCAT(%s, %s, %s, %s) AS data" % (PAR("'Kesimpulan #0046#:'", 0), KES_P, PAR("'Kesimpulan #0047#:'", 0), KES_T)),
    12035: ('JAWAB-MENJAWAB DUDUK PERKARA: NASKAH TERTULIS MENYUSUL KALIMAT POKOK JAWABAN (OTOMATIS dari isian 12020-12026; kosong bila belum ada naskah tertulis)',
            "SELECT CONCAT(" + ",\n ".join([
                "IF(%s OR %s, CONCAT(%s, %s, %s), '')" % (ADA(12020), ADA(12021), PAR("CONCAT('Bahwa, jawaban #0047# tersebut diajukan secara tertulis', %s, ' yang selengkapnya sebagai berikut:')" % TGL('7111'), 720), BLOK(12020), BUTIR(12021)),
                "IF(%s OR %s, CONCAT(%s, %s, %s), '')" % (ADA(12022), ADA(12023), PAR("CONCAT('Bahwa, terhadap jawaban #0047# tersebut, #0046# mengajukan replik secara tertulis', %s, ' yang pada pokoknya sebagai berikut:')" % TGL('7112'), 720), BLOK(12022), BUTIR(12023)),
                "IF(%s OR %s, CONCAT(%s, %s, %s), '')" % (ADA(12024), ADA(12025), PAR("CONCAT('Bahwa, terhadap replik #0046# tersebut, #0047# mengajukan duplik secara tertulis', %s, ' yang pada pokoknya sebagai berikut:')" % TGL('7113'), 720), BLOK(12024), BUTIR(12025)),
                "IF(%s, CONCAT(%s, %s), '')" % (ADA(12026), PAR("CONCAT('Bahwa, terhadap replik rekonvensi tersebut, #0046# mengajukan duplik rekonvensi secara tertulis', %s, ' yang pada pokoknya sebagai berikut:')" % TGL('7114'), 720), BLOK(12026)),
            ]) + ") AS data"),
    12036: ('JAWAB-MENJAWAB DUDUK PERKARA: NASKAH KESIMPULAN TERTULIS MENYUSUL KALIMAT KESIMPULAN (OTOMATIS dari isian 12027/12028; kosong bila belum ada naskah tertulis)',
            "SELECT CONCAT(" + ",\n ".join([
                "IF(%s, CONCAT(%s, %s), '')" % (ADA(12027), PAR("'Bahwa, kesimpulan #0046# yang diajukan secara tertulis selengkapnya sebagai berikut:'", 720), BLOK(12027)),
                "IF(%s, CONCAT(%s, %s), '')" % (ADA(12028), PAR("'Bahwa, kesimpulan #0047# yang diajukan secara tertulis selengkapnya sebagai berikut:'", 720), BLOK(12028)),
            ]) + ") AS data"),
}

# Variabel lama: naskah tertulis didahulukan, selain itu persis kueri lama.
UBAH = {
    9252: ((12020, 12021), ' (31 Okt: naskah tertulis isian 12020/12021 didahulukan)'),
    9253: ((12022, 12023), ' (31 Okt: naskah tertulis isian 12022/12023 didahulukan)'),
    9254: ((12024, 12025), ' (31 Okt: naskah tertulis isian 12024/12025 didahulukan)'),
    9257: ((12027,), ' (31 Okt: naskah tertulis isian 12027 didahulukan)'),
    9258: ((12028,), ' (31 Okt: naskah tertulis isian 12028 didahulukan)'),
}


def kueri_ubah(no, lama):
    isi, _ = UBAH[no]
    m = re.match(r'^SELECT (.*) AS data$', lama, re.S)
    assert m, no
    if len(isi) == 2:
        tulis = "CONCAT(%s, %s)" % (BLOK(isi[0]), BUTIR(isi[1]))
        ada = "%s OR %s" % (ADA(isi[0]), ADA(isi[1]))
    else:
        tulis = BLOK(isi[0])
        ada = ADA(isi[0])
    return "SELECT IF(%s, %s, %s) AS data" % (ada, tulis, m.group(1))


# Isian naskah yang dibaca tiap variabel penampil (untuk kelompok tersembunyi isianasal).
ISIAN_PENAMPIL = {
    9252: (12020, 12021), 9253: (12022, 12023), 9254: (12024, 12025), 9257: (12027,), 9258: (12028,),
    12030: (12020, 12021), 12031: (12022, 12023), 12032: (12024, 12025), 12033: (12026,), 12034: (12027, 12028),
    12035: (12020, 12021, 12022, 12023, 12024, 12025, 12026), 12036: (12027, 12028),
}
PETUNJUK = {'JAWABAN': 9252, 'REPLIK': 9253, 'DUPLIK': 9254, 'DUPLIK REKONVENSI': 12033, 'KESIMPULAN': None}


def panjang(p):
    p = os.path.abspath(p)
    a = BS * 2 + '?' + BS
    return p if p.startswith(a) else a + p


def md5b(b):
    return hashlib.md5(b).hexdigest()


def tampak(seg):
    """Teks tampak potongan RTF (kasar: kata kendali, \\'xx, kurawal dibuang; tujuan tersembunyi {\\*...} dibuang)."""
    s = re.sub(r'\{\\\*[^{}]*\}', '', seg)
    s = re.sub(r"\\'[0-9a-fA-F]{2}", '?', s)
    s = re.sub(r'\\[a-zA-Z]+-?\d* ?', '', s)
    return re.sub(r'[{}]', '', s).replace('\r', '').replace('\n', '')


def asal(nos):
    return '{%s*%sisianasal %s}' % (BS, BS, ' '.join('#%d#' % n for n in nos))


def paragraf_baru(no, huruf):
    return ('%spard %splain %sqj %sli0 %sri0 %ssl360 %sslmult1 %swidctlpar %slin0 %srin0 %sitap0 {%sfs24 %sloch %sf%s #%d#}%s'
            % ((BS,) * 11 + (BS, BS, BS, huruf, no, asal(ISIAN_PENAMPIL[no]))))


def huruf_di(seg, cadangan='4'):
    m = re.findall(r'\\loch \\f(\d+)', seg)
    return m[-1] if m else cadangan


RE_PETUNJUK = re.compile(r'^\s*COPY FILE\s+(JAWABAN|REPLIK|DUPLIK REKONVENSI|DUPLIK|KESIMPULAN)\s+APABILA TERTULIS(?:\s+DAN HAPUS KETERANGAN DIATAS)?\s*$')


def akhir_paragraf(raw, pos):
    """Indeks sesudah '\\par }' / '\\par}' pertama sejak pos (penutup paragraf di kelompok teksnya)."""
    m = re.compile(r'\\par ?\}').search(raw, pos)
    return m.end() if m else -1


def ubah_petunjuk(raw, rel, catat):
    ubah = []
    for m in re.finditer(r'COPY FILE', raw):
        p = raw.rfind(BS + 'pard', 0, m.start())
        e = akhir_paragraf(raw, m.start())
        if p < 0 or e < 0:
            catat.append((rel, 'petunjuk', 'DILEWATI: batas paragraf tak terbaca'))
            continue
        t = tampak(raw[p:e])
        k = RE_PETUNJUK.match(t)
        if not k or re.search(r'#\d{4,5}#', raw[p:e]):
            catat.append((rel, 'petunjuk', 'DILEWATI: ' + t[:90]))
            continue
        jenis = k.group(1)
        sebelum_p = raw.rfind(BS + 'par', 0, p)
        sebelumnya = raw[raw.rfind(BS + 'pard', 0, max(0, sebelum_p)):p]
        no = PETUNJUK[jenis]
        if jenis == 'KESIMPULAN':
            pihak = re.search(r'#(0046|0047)#', tampak(sebelumnya))
            no = 9258 if pihak and pihak.group(1) == '0047' else 9257
        if ('#%d#' % no) in raw[sebelum_p:p] or ('#%d#' % no) in sebelumnya[-300:]:
            ubah.append((p, e, ''))
            catat.append((rel, jenis, 'petunjuk dihapus (variabel #%d# sudah di paragraf sebelumnya)' % no))
        else:
            ubah.append((p, e, paragraf_baru(no, huruf_di(raw[p:e]))))
            catat.append((rel, jenis, 'petunjuk diganti #%d#' % no))
    return ubah


def sisip_sesudah_paragraf(raw, pos, no):
    e = akhir_paragraf(raw, pos)
    if e < 0:
        return None
    return (e, e, paragraf_baru(no, huruf_di(raw[raw.rfind(BS + 'pard', 0, pos):e], '4')))


def duduk_perkara(raw):
    """Batas akhir duduk perkara (sebelum judul pertimbangan hukum) - indeks raw."""
    m = re.search(r'PERTIMBANGAN HUKUM|TENTANG HUKUMNYA|P E R T I M B A N G A N', raw)
    return m.start() if m else len(raw)


def paragraf_ke(raw, batas):
    """Paragraf (awal \\pard, akhir \\par }) sebelum batas -> [(awal, akhir, teks tampak)]."""
    keluar = []
    for m in re.finditer(r'\\pard\b', raw[:batas]):
        e = akhir_paragraf(raw, m.start())
        if e < 0 or e > batas:
            continue
        keluar.append((m.start(), e, tampak(raw[m.start():e])))
    # hanya paragraf terdalam (yang tidak memuat \pard lain sebelum penutupnya)
    hasil = []
    for i, (a, e, t) in enumerate(keluar):
        if i + 1 < len(keluar) and keluar[i + 1][0] < e:
            continue
        hasil.append((a, e, t))
    return hasil


def aktif(rel):
    atas = rel.split('/')[0]
    return not ('terhapus' in rel.lower() or re.match(r'(ALUR|- BAS .* -$)', atas))


FOLDER_GUGATAN = re.compile(r'^(1 |1a |1c |1d |1e |1f |2a |4a |4b |4c |4d |4e |5 |5a |6a |6b |6c |6d |6e |6g |6h |10 |10a |96a |97a )')
RE_BUKAN_KONTRA = re.compile(r'verstek|tidak hadir setelah mediasi|t tidak hadir|tidak pernah hadir|sebelum jawaban|gugur|coret|panjar habis|perdamaian|alamat t tidak|tidak hadir lagi|2x tidak hadir|kuasa insidentil tidak sah|permohonan penetapan|\[0[13]p\]|\[99p\]|setelah pembuktian|ikrar', re.I)


def golongan(rel):
    d, f = rel.split('/')[0], rel.split('/')[-1]
    if d.endswith(' - BAS'):
        return 'bas'
    if not FOLDER_GUGATAN.match(d + ' '):
        return ''
    return 'put'


def jenis_bas(f):
    if re.search(r'Duplik Rekonvensi', f):
        return 12033
    if re.search(r'Kesimpulan', f):
        return 12034
    if re.search(r'Duplik', f):
        return 12032
    if re.search(r'Replik', f):
        return 12031
    if re.search(r'Jawaban', f):
        return 12030
    return None


def terapkan(raw, ubah):
    ubah = sorted(ubah)
    hasil, pos = [], 0
    for s, e, g in ubah:
        assert s >= pos, (s, pos)
        hasil.append(raw[pos:s])
        hasil.append(g)
        pos = e
    hasil.append(raw[pos:])
    return ''.join(hasil)


def pengunggah_bas(raw, no, rel, catat):
    """31 Okt (sesi utama): "meneliti ... yang telah diunggah #7037# ke dalam SIP" benar untuk jawaban/duplik saja - replik dan duplik
    rekonvensi diunggah #7036#, kesimpulan oleh keduanya."""
    ganti = {12031: '#7036#', 12033: '#7036#', 12034: '#7036# dan #7037#'}.get(no)
    if not ganti:
        return []
    i = raw.find('telah diunggah')
    j = raw.find('#7037#', i, i + 600) if i >= 0 else -1
    if j < 0 or not re.search(r'telah diunggah\s*#7037#\s*ke dalam SIP', tampak(raw[i:j + 400])):
        catat.append((rel, 'PENGUNGGAH', 'DILEWATI: kalimat "telah diunggah #7037#" tidak terbaca'))
        return []
    catat.append((rel, 'PENGUNGGAH', 'diunggah #7037# -> %s' % ganti))
    return [(j, j + 6, ganti)]


def akhir_grup(raw, i):
    d, k = 0, i
    while k < len(raw):
        c = raw[k]
        if c == BS:
            k += 2
            continue
        if c == '{':
            d += 1
        elif c == '}':
            d -= 1
            if d == 0:
                return k
        k += 1
    return -1


RE_DAFTAR_BUKTI = re.compile(r'#(?:1117\d|1214|9955|9911|9958|0378|373[01]|375[78]|398[34])#')


def tanda_z_bukti(raw, rel, catat):
    """31 Okt (pengguna): tanda penutup "SC Z 1x" + garis Z + tanggal harus jatuh SESUDAH daftar bukti. Bentuk itu dijangkarkan ke paragraf
    tempatnya berada; bila paragraf jangkar berada SEBELUM daftar bukti (izin poligami ALUR 34: "Bukti-bukti tersebut sebagai berikut:"
    lalu #11170#), seluruh grup bentuknya dipindah ke awal paragraf sesudah daftar bukti - seperti blangko pembuktian lainnya."""
    z = raw.find('SC Z')
    if z < 0 or raw.count('SC Z') != 1:
        return None
    # kedalaman kurawal tiap posisi sampai z; grup pembungkus = grup terluar di tingkat badan dokumen (kedalaman 1) yang memuat z
    d, k, buka = 0, 0, []
    while k < z:
        c = raw[k]
        if c == BS:
            k += 2
            continue
        if c == '{':
            buka.append(k)
            d += 1
        elif c == '}':
            buka.pop()
            d -= 1
        k += 1
    if len(buka) < 2:
        return None
    w = buka[1]
    we = akhir_grup(raw, w)
    if we < z or BS + 'shp' not in raw[w:we]:
        return None
    sesudah = tampak(raw[we + 1:we + 3000])
    m = RE_DAFTAR_BUKTI.search(raw, we)
    if not m or m.start() - we > 6000 or not sesudah.lstrip().startswith('Bukti-bukti tersebut sebagai berikut'):
        return None
    # Bentuk Z mengisi ruang kosong sesudah paragraf jangkarnya ("Bukti-bukti tersebut sebagai berikut:" + ruang tempel bukti) - jadi
    # seluruh paragraf itu (beserta bentuknya) dipindah ke sesudah paragraf daftar bukti, sama dengan urutan blangko pembuktian lain:
    # "... menyerahkan bukti surat berupa:" / daftar bukti / "Bukti-bukti tersebut sebagai berikut:" + Z / kalimat berikutnya.
    b0 = raw.rfind(BS + 'pard', 0, w)
    b1 = raw.rfind(BS + 'pard', 0, m.start())
    e = akhir_paragraf(raw, m.end())
    q = raw.find(BS + 'pard', e)
    if b0 < 0 or not (b0 < w < we < b1) or e < 0 or q < 0:
        return None
    baru = raw[:b0] + raw[b1:q] + raw[b0:b1] + raw[q:]
    lama_kal = 'menyerahkan bukti surat.}'
    if baru[:b0].count(lama_kal) == 1:
        baru = baru.replace(lama_kal, 'menyerahkan bukti surat berupa:}', 1)
    catat.append((rel, 'TANDA Z', 'paragraf "Bukti-bukti tersebut sebagai berikut:" + bentuk "SC Z" dipindah dari sebelum daftar bukti ke sesudahnya'))
    return baru


def duplik_oleh(raw, rel, catat):
    """31 Okt (sesi utama): "... disampaikan oleh #0046#, kemudian #0046# mengajukan dupliknya" -> duplik oleh #0047#."""
    keluar = []
    for m in re.finditer(r'kemudian #0046# mengajukan dupliknya', raw):
        keluar.append((m.start() + len('kemudian '), m.start() + len('kemudian #0046#'), '#0047#'))
        catat.append((rel, 'DUPLIK OLEH', 'kemudian #0046# mengajukan dupliknya -> #0047#'))
    return keluar


def ubah_berkas(rel, raw0, catat):
    gol = golongan(rel)
    f = rel.split('/')[-1]
    ubah = []
    if gol == 'bas':
        no = jenis_bas(f)
        if no and '#7083#' in raw0:
            ubah += pengunggah_bas(raw0, no, rel, catat)
        i = raw0.find('#7083#')
        if no and i >= 0:
            s = sisip_sesudah_paragraf(raw0, i, no)
            if s:
                ubah.append(s)
                catat.append((rel, 'BAS', 'sisip #%d# sesudah #7083#' % no))
        r = terapkan(raw0, ubah)
        return tanda_z_bukti(r, rel, catat) or r
    if gol != 'put':
        return raw0
    kontra = not RE_BUKAN_KONTRA.search(f)
    ubah += ubah_petunjuk(raw0, rel, catat)
    ubah += duplik_oleh(raw0, rel, catat)
    batas = duduk_perkara(raw0)
    par = paragraf_ke(raw0, batas)
    # duplik rekonvensi tanpa isi
    for a, e, t in par:
        if re.search(r'mengajukan duplik rekonvensi secara', t, re.I):
            sesudah = raw0[e:e + 1500]
            if not re.search(r'#12033#|COPY FILE DUPLIK REKONVENSI', sesudah[:900]):
                ubah.append((e, e, paragraf_baru(12033, huruf_di(raw0[a:e]))))
                catat.append((rel, 'DUPLIK REKONVENSI', 'sisip #12033# sesudah kalimat duplik rekonvensi'))
    ada_penampil = re.search(r'#925[2-8]#|COPY FILE', raw0)
    if kontra and not ada_penampil:
        # Putusan kontradiktoir yang hanya memuat POKOK jawaban: naskah tertulis menyusul kalimat jawaban dan kesimpulan.
        j = [x for x in par if re.search(r'\bjawab(?:an|annya)\b|membantah tuduhan', x[2], re.I) and not re.search(r'sebelum\s+jawaban', x[2], re.I)]
        if j:
            ubah.append((j[0][1], j[0][1], paragraf_baru(12035, huruf_di(raw0[j[0][0]:j[0][1]]))))
            catat.append((rel, 'SUSULAN', 'sisip #12035# sesudah: ' + j[0][2][:80]))
            k = [x for x in par if x[0] > j[0][0] and re.search(r'kesimpulan', x[2], re.I)]
            if k:
                ubah.append((k[0][1], k[0][1], paragraf_baru(12036, huruf_di(raw0[k[0][0]:k[0][1]]))))
                catat.append((rel, 'SUSULAN', 'sisip #12036# sesudah: ' + k[0][2][:80]))
        else:
            catat.append((rel, 'SUSULAN', 'TIDAK: kalimat jawaban tidak ditemukan'))
    r = terapkan(raw0, ubah)
    # isianasal di samping variabel penampil lama yang belum berdampingan dengannya
    tambah = []
    for no in (9252, 9253, 9254, 9257, 9258):
        tanda = '#%d#' % no
        i = r.find(tanda)
        if i >= 0 and not r.startswith('{%s*%sisianasal' % (BS, BS), i + len(tanda)):
            tambah.append((i + len(tanda), i + len(tanda), asal(ISIAN_PENAMPIL[no])))
    return terapkan(r, tambah)


def baca_variabel(db):
    q = "SELECT no_var, HEX(nama), data_type, HEX(IFNULL(sql_query, '')), IFNULL(modifier, '') FROM abt_variabel ORDER BY no_var"
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '-N', '--default-character-set=latin1', db, '-e', q], capture_output=True, check=True)
    v = {}
    for l in r.stdout.decode('latin1').splitlines():
        no, nm, jt, sq, mod = l.split('\t')
        v[int(no)] = dict(nama=bytes.fromhex(nm).decode('latin1'), jenis=jt, sql=bytes.fromhex(sq).decode('latin1'), pemilik=mod)
    return v


def main():
    akar, db = sys.argv[1:3]
    keluar = os.path.join(SINI, '..', 'paket-satker')
    hasil = os.path.join(SINI, '..', 'hasil')
    os.makedirs(hasil, exist_ok=True)
    var = baca_variabel(db)
    for n in list(NAMA_ISIAN) + list(VAR_SQL):
        assert n not in var, n
    akar_d = os.path.join(akar, 'derry_briantono')
    rels = []
    for d, _, fs in os.walk(panjang(akar_d)):
        for f in fs:
            if f.lower().endswith('.rtf'):
                rel = os.path.relpath(os.path.join(d, f), panjang(akar_d)).replace(os.sep, '/')
                if aktif(rel):
                    rels.append(rel)
    rels.sort()
    berkas = {}
    catat = []
    for rel in rels:
        raw0 = open(panjang(os.path.join(akar_d, rel)), 'rb').read().decode('latin1')
        r = ubah_berkas(rel, raw0, catat)
        if r != raw0:
            berkas[rel] = (raw0, r)
    baru = []
    for n, nama in sorted(NAMA_ISIAN.items()):
        baru.append(dict(no=n, nama=nama[:200], jenis='data_teks', sql=''))
    for n, (nama, sql) in sorted(VAR_SQL.items()):
        baru.append(dict(no=n, nama=nama[:200], jenis='data_sql', sql=sql))
    ubah_var = {}
    for no, (_, akhiran) in UBAH.items():
        v = var[no]
        ubah_var[no] = dict(lama=v['sql'], baru=kueri_ubah(no, v['sql']), nama_lama=v['nama'], nama_baru=(v['nama'] + akhiran)[:200])
    # 31 Okt (sesi utama): "dilangsungkan#0206# di" tercetak "dilangsungkansecara elektronik" - ABT memangkas spasi tepi nilai (trim
    # sesudah filter_var membuang <i> </i>). Spasi tak terpecah RTF (\~) tidak dipangkas; perkara biasa tetap kosong.
    v = var[206]
    lama_i = "'<i> </i>secara elektronik'"
    assert v['sql'].count(lama_i) == 1, 'kueri 0206 berubah'
    ubah_var[206] = dict(lama=v['sql'], baru=v['sql'].replace(lama_i, "CONCAT(CHAR(92), '~secara elektronik')"), nama_lama=v['nama'],
                         nama_baru=(v['nama'] + ' (31 Okt: spasi pemisah tak terpecah, tidak terpangkas ABT)')[:200])
    tulis(keluar, berkas, ubah_var, baru)
    with open(os.path.join(hasil, 'ubahan.tsv'), 'w', encoding='utf-8', newline='\n') as o:
        o.write('berkas\tbagian\tubahan\n')
        for b in catat:
            o.write('\t'.join(str(x).replace('\t', ' ').replace('\n', ' ')[:300] for x in b) + '\n')
    json.dump(baru, open(os.path.join(hasil, 'variabel.json'), 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
    hit = collections.Counter(b[2].split(' (')[0].split(':')[0] for b in catat)
    print('berkas RTF diubah', len(berkas), '| variabel baru', len(baru), '| diubah', len(ubah_var))
    for k, v in sorted(hit.items()):
        print('  %4d  %s' % (v, k))


def hexs(s):
    return '0x' + s.encode('latin1').hex() if s else "''"


SIDIK = "MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), IFNULL(referensi, ''), IFNULL(multi_sidang, ''), locked, IFNULL(modifier, '')))"


def sidik_py(x):
    return md5b('|'.join([x['nama'], x['jenis'], x['sql'], '', '', '0', 'admin']).encode('latin1'))


def sidik_ubah(nama, sql):
    return md5b('|'.join([nama, sql]).encode('latin1'))


def tulis(keluar, berkas, ubah_var, baru):
    import base64
    if os.path.isdir(keluar):
        shutil.rmtree(panjang(keluar))
    os.makedirs(keluar)
    shutil.copy(os.path.join(TINJAU, 'tambal_rtf.py'), os.path.join(keluar, 'tambal_rtf.py'))
    for f in ('pasang-satker.sh', 'pulih-satker.sh'):
        shutil.copy(os.path.join(SINI, f), os.path.join(keluar, f))
    with open(os.path.join(keluar, 'daftar-tambal.tsv'), 'w', encoding='utf-8', newline='\n') as d, \
            open(os.path.join(keluar, 'tambal.tsv'), 'w', encoding='utf-8', newline='\n') as t:
        d.write('# kode\tberkas\tmd5_lama\tmd5_baru\tjumlah potongan - berkas diubah HANYA bila md5 persis md5_lama (keadaan sesudah 21 paket rantai 31 Okt)\n')
        t.write('# kode\toffset\tb64(teks lama)\tb64(teks baru)\n')
        for i, rel in enumerate(sorted(berkas), 1):
            lama, baru_ = berkas[rel]
            kode = 'J%04d' % i
            pot = potongan(lama, baru_)
            h = lama
            for o_, l_, n_ in sorted(pot, key=lambda x: -x[0]):
                assert h[o_:o_ + len(l_)] == l_
                h = h[:o_] + n_ + h[o_ + len(l_):]
            assert h == baru_, rel
            d.write('%s\tderry_briantono/%s\t%s\t%s\t%d\n' % (kode, rel, md5b(lama.encode('latin1')), md5b(baru_.encode('latin1')), len(pot)))
            for o_, l_, n_ in pot:
                t.write('%s\t%d\t%s\t%s\n' % (kode, o_, base64.b64encode(l_.encode('latin1')).decode('ascii'), base64.b64encode(n_.encode('latin1')).decode('ascii')))
    uv = sorted(ubah_var.items())
    nb = [x['no'] for x in baru]
    kepala = '-- Paket ABT "%s" (31 Okt 2026): naskah utuh jawab-menjawab (jawaban/replik/duplik/rekonvensi/kesimpulan) di BAS dan duduk perkara. Hanya derry_briantono.\n' % N
    open(os.path.join(keluar, 'nomor-variabel.txt'), 'w', newline='\n').write('# variabel BARU\n' + ''.join('%d\n' % n for n in nb))
    open(os.path.join(keluar, 'nomor-diubah.txt'), 'w', newline='\n').write('# variabel LAMA yang nama + kuerinya diubah\n' + ''.join('%d\n' % n for n, _ in uv))
    nl = ' UNION ALL '.join("SELECT %d AS n, '%s' AS h" % (x['no'], sidik_py(x)) for x in baru)
    sv = SIDIK.replace("nama", "v.nama").replace("data_type", "v.data_type").replace("sql_query", "v.sql_query").replace("referensi", "v.referensi") \
        .replace("multi_sidang", "v.multi_sidang").replace("locked", "v.locked").replace("modifier", "v.modifier")
    s2 = "MD5(CONCAT_WS('|', nama, IFNULL(sql_query, '')))"
    lama_c = ' OR '.join("(no_var = %d AND %s = '%s')" % (n, s2, sidik_ubah(u['nama_lama'], u['lama'])) for n, u in uv)
    baru_d = ' OR '.join("(no_var = %d AND %s = '%s')" % (n, s2, sidik_ubah(u['nama_baru'], u['baru'])) for n, u in uv)
    fungsi = "(SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name IN ('isian_rtf_blok', 'isian_rtf_butir', 'isian_rtf_par', 'isian_rtf_keterangan'))"
    pras = kepala + ('-- PRASYARAT "A|B|C|D|E": A = 12020-12049 berisi lain (0) | B = variabel baru persis (0/%d) | C = variabel lama persis dasar (%d/0) | '
                     'D = variabel lama sudah isi baru (0/%d) | E = fungsi isian_rtf_blok/butir/par/keterangan ada (4)\n' % (len(nb), len(uv), len(uv)))
    pras += ("SELECT CONCAT_WS('|',\n (SELECT COUNT(*) FROM abt_variabel v WHERE v.no_var BETWEEN 12020 AND 12049 AND NOT EXISTS (SELECT 1 FROM (%s) p WHERE p.n = v.no_var AND p.h = %s)),\n"
             " (SELECT COUNT(*) FROM abt_variabel v JOIN (%s) p ON p.n = v.no_var AND p.h = %s),\n (SELECT COUNT(*) FROM abt_variabel WHERE %s),\n"
             " (SELECT COUNT(*) FROM abt_variabel WHERE %s),\n %s) AS p;\n" % (nl, sv, nl, sv, lama_c, baru_d, fungsi))
    open(os.path.join(keluar, '%s-PRASYARAT.sql' % N), 'w', encoding='latin1', newline='\n').write(pras)
    open(os.path.join(keluar, 'harap.txt'), 'w', newline='\n').write('0|0|%d|0|4\n0|%d|0|%d|4\n' % (len(uv), len(nb), len(uv)))
    p = [kepala, 'START TRANSACTION;\n']
    for x in baru:
        p.append("INSERT INTO abt_variabel (no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier, modified) "
                 "SELECT %d, %s, '%s', NULL, NULL, NULL, NULL, %s, NULL, NULL, 0, 'admin', '%s' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM abt_variabel WHERE no_var = %d);\n"
                 % (x['no'], hexs(x['nama']), x['jenis'], hexs(x['sql']) if x['sql'] else 'NULL', TANGGAL, x['no']))
    for n, u in uv:
        p.append("UPDATE abt_variabel SET nama = %s, sql_query = %s WHERE no_var = %d AND %s = '%s';\n" % (hexs(u['nama_baru']), hexs(u['baru']), n, s2, sidik_ubah(u['nama_lama'], u['lama'])))
    p.append('COMMIT;\n')
    open(os.path.join(keluar, '%s-PASANG.sql' % N), 'w', encoding='latin1', newline='\n').write(''.join(p))
    bag = ["SELECT 'var %d' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = %d AND %s = '%s') AS ok" % (x['no'], x['no'], SIDIK, sidik_py(x)) for x in baru]
    bag += ["SELECT 'ubah %d' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = %d AND %s = '%s') AS ok" % (n, n, s2, sidik_ubah(u['nama_baru'], u['baru'])) for n, u in uv]
    q = kepala + 'SELECT label, ok FROM (\n' + '\nUNION ALL '.join(bag) + '\n) x WHERE ok <> 1\nUNION ALL SELECT IF((SELECT COUNT(*) FROM (' + \
        '\nUNION ALL '.join(bag) + ") y WHERE y.ok <> 1) = 0, 'SEMUA COCOK', 'ADA BEDA'), '';\n"
    open(os.path.join(keluar, '%s-PERIKSA.sql' % N), 'w', encoding='latin1', newline='\n').write(q)
    r = [kepala, 'START TRANSACTION;\n']
    r += ["DELETE FROM abt_variabel WHERE no_var = %d AND %s = '%s';\n" % (x['no'], SIDIK, sidik_py(x)) for x in baru]
    r += ["UPDATE abt_variabel SET nama = %s, sql_query = %s WHERE no_var = %d AND %s = '%s';\n" % (hexs(u['nama_lama']), hexs(u['lama']), n, s2, sidik_ubah(u['nama_baru'], u['baru'])) for n, u in uv]
    r.append('COMMIT;\n')
    open(os.path.join(keluar, '%s-PULIH.sql' % N), 'w', encoding='latin1', newline='\n').write(''.join(r))
    # kueri baru & ubah untuk UJI di server (baca saja): satu baris per kueri, base64
    with open(os.path.join(keluar, 'uji-kueri.tsv'), 'w', encoding='utf-8', newline='\n') as o:
        for x in baru:
            if x['sql']:
                o.write('%d\t%s\n' % (x['no'], base64.b64encode(x['sql'].encode('latin1')).decode('ascii')))
        for n, u in uv:
            o.write('%d\t%s\n' % (n, base64.b64encode(u['baru'].encode('latin1')).decode('ascii')))
    semua = []
    for d_, _, fs in os.walk(panjang(keluar)):
        for f in fs:
            if f != 'MD5SUMS.txt':
                p_ = os.path.join(d_, f)
                semua.append((os.path.relpath(p_, panjang(keluar)).replace(os.sep, '/'), md5b(open(p_, 'rb').read())))
    with open(os.path.join(keluar, 'MD5SUMS.txt'), 'w', newline='\n') as o:
        for rel, m in sorted(semua):
            o.write('%s  %s\n' % (m, rel))


def potongan(lama, baru):
    """Selisih dua teks yang hanya berbeda di beberapa tempat -> [(offset lama, teks lama, teks baru)] (difflib atas baris rakitan)."""
    # RTF tanpa ganti baris: pecah di tiap '\\pard' supaya difflib bekerja atas potongan paragraf.
    def pecah(s):
        return [x for x in re.split(r'(?=\\pard\b)', s)]
    a, b = pecah(lama), pecah(baru)
    off = [0]
    for x in a:
        off.append(off[-1] + len(x))
    pot = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if op != 'equal':
            pot.append((off[i1], ''.join(a[i1:i2]), ''.join(b[j1:j2])))
    return pot


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
