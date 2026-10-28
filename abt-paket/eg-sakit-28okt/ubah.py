# Paket ABT eg-sakit (28 Okt): pihak yang sakit (huruf E) dibaca dari 5227, dan paragraf F pada gabungan huruf
# menyebut SEMUA huruf (Pasal 19 PP 9/1975 a-f, Pasal 116 KHI a-h). Membaca h<var>.txt (HEX + MD5 server),
# menulis baru<var>.hex, PASANG.sql, PULIH.sql, PERIKSA.sql.
import hashlib, io, os

D = os.path.dirname(os.path.abspath(__file__))

POLA = ("{p}( yang| sedang| telah| masih)* (sakit|menderita|mengidap|mengalami (sakit|penyakit|strok|stroke|lumpuh|kelumpuhan|cacat|gangguan|kebutaan)|cacat|lumpuh|buta|terkena|terserang|divonis)"
        "|(sakit|penyakit|cacat|lumpuh|strok|stroke|kelumpuhan)(nya)?( yang)?( diderita| dialami| diidap)?( oleh)? {p}")
PP, PT = POLA.format(p="#0046#"), POLA.format(p="#0047#")
SAKIT_P = f"k5.v5227 REGEXP '{PP}' AND k5.v5227 NOT REGEXP '{PT}'"

def tambah_dasar(s):
    """v5227 di z, sp/sis di k (k-level membaca y.v5227)."""
    a = "END AS n) z"
    assert s.count(a) == 1, "z"
    s = s.replace(a, "END AS n, IFNULL((SELECT CONVERT(data USING utf8) FROM aps_badilag.abt_data_teks WHERE no_var=5227 AND perkara_id='#perkara_id#'), '') AS v5227) z")
    a = "SELECT z.n,"
    assert s.count(a) == 1, "y"
    s = s.replace(a, "SELECT z.n, z.v5227,")
    a = "CASE WHEN \"#0047#\" = 'Termohon' THEN 'istri' ELSE 'suami' END AS si"
    assert s.count(a) == 1, "si"
    sakit = SAKIT_P.replace("k5.", "y.")
    s = s.replace(a, a + ",\n    -- 28 Okt: pihak yang sakit (huruf E) menurut rincian 5227; bawaan pihak lawan seperti dulu\n"
                  f"    CASE WHEN {sakit} THEN \"#0046#\" ELSE \"#0047#\" END AS sp,\n"
                  f"    CASE WHEN {sakit} THEN (CASE WHEN \"#0047#\" = 'Termohon' THEN 'suami' ELSE 'istri' END) ELSE (CASE WHEN \"#0047#\" = 'Termohon' THEN 'istri' ELSE 'suami' END) END AS sis")
    return s

def ganti(s, lama, baru):
    assert s.count(lama) == 1, f"tidak tunggal: {lama[:80]}"
    return s.replace(lama, baru)

def daftar_huruf(s):
    """lpp (Pasal 19 PP: a-f) dan lkhi (Pasal 116 KHI: a-h) dirangkai '(e) dan (f)' / '(a), (b), dan (f)'."""
    a = "IF(INSTR(z.n, 'H') > 0, 1, 0) AS hH,"
    def rangkai(huruf):
        return "CONCAT_WS(', ', " + ", ".join(f"IF(INSTR(z.n, '{h}') > 0, '({h.lower()})', NULL)" for h in huruf) + ")"
    def jumlah(huruf):
        return "(" + " + ".join(f"(INSTR(z.n, '{h}') > 0)" for h in huruf) + ")"
    s = ganti(s, a, a + f"\n        {rangkai('ABCDEF')} AS lpp0,\n        {jumlah('ABCDEF')} AS npp,\n"
                     f"        {rangkai('ABCDEFGH')} AS lkhi0,\n        {jumlah('ABCDEFGH')} AS nkhi,")
    def rapi(l, n):
        return f"IF(y.{n} <= 1, y.{l}0, CONCAT(SUBSTRING_INDEX(y.{l}0, ', ', y.{n} - 1), IF(y.{n} = 2, ' dan ', ', dan '), SUBSTRING_INDEX(y.{l}0, ', ', -1)))"
    a = "END AS sis"
    s = ganti(s, a, a + f",\n    {rapi('lpp', 'npp')} AS lpp,\n    {rapi('lkhi', 'nkhi')} AS lkhi")
    return s

def v8522(s):
    s = tambah_dasar(s)
    s = daftar_huruf(s)
    s = ganti(s, '"Bahwa berdasarkan fakta hukum tersebut, #0047# mendapat cacat badan atau penyakit"',
              '"Bahwa berdasarkan fakta hukum tersebut, ", k.sp, " mendapat cacat badan atau penyakit"')
    s = ganti(s, '" yang mengakibatkan #0047# tidak dapat menjalankan kewajibannya sebagai ", k.si, IF(k.si = "suami",',
              '" yang mengakibatkan ", k.sp, " tidak dapat menjalankan kewajibannya sebagai ", k.sis, IF(k.sis = "suami",')
    s = ganti(s, 'IF(k.hE AND k.si = "suami", "Bahwa meskipun Pasal 75', 'IF(k.hE AND k.sp = "#0047#" AND k.si = "suami", "Bahwa meskipun Pasal 75')
    a = 'IF(k.hF, CONCAT("Bahwa berdasarkan fakta hukum tersebut, antara #0046# dan #0047# telah terjadi perselisihan'
    s = ganti(s, a, 'IF(k.hE AND k.sp = "#0046#", "Bahwa meskipun Pasal 75 Undang-Undang Nomor 7 Tahun 1989 tentang Peradilan Agama sebagaimana telah diubah terakhir dengan Undang-Undang Nomor 50 Tahun 2009 sejatinya memberi wewenang kepada Hakim untuk memerintahkan pihak yang bersangkutan untuk memeriksakan diri kepada dokter, #8554# menilai bahwa kondisi atau keadaan cacat badan atau penyakit pada diri #0046# tersebut tetap dapat dipertimbangkan dan dibuktikan secara sah melalui persesuaian keterangan para saksi serta alat bukti lain yang diajukan di persidangan;", NULL),\n        ' + a)
    s = ganti(s, '" dan tidak ada harapan akan hidup rukun lagi dalam rumah tangga, sehingga alasan sebagaimana dimaksud Pasal 19 huruf (f) Peraturan Pemerintah Nomor 9 Tahun 1975 <i>jo.</i> Pasal 116 huruf (f) Kompilasi Hukum Islam telah terpenuhi;")',
              '" dan tidak ada harapan akan hidup rukun lagi dalam rumah tangga, sehingga alasan", IF(k.nkhi > 1, " perceraian", ""), " sebagaimana dimaksud Pasal 19 huruf ", k.lpp, " Peraturan Pemerintah Nomor 9 Tahun 1975 <i>jo.</i> Pasal 116 huruf ", k.lkhi, " Kompilasi Hukum Islam telah terpenuhi", IF(k.nkhi > 1, " secara kumulatif", ""), ";")')
    return s

def v8521(s):
    s = tambah_dasar(s)
    return ganti(s, 'CONCAT("Bahwa #0047# mendapat cacat badan atau penyakit yang mengakibatkan #0047# tidak dapat menjalankan kewajibannya sebagai ", k.si, ";")',
                 'CONCAT("Bahwa ", k.sp, " mendapat cacat badan atau penyakit yang mengakibatkan ", k.sp, " tidak dapat menjalankan kewajibannya sebagai ", k.sis, ";")')

def v8528(s):
    s = tambah_dasar(s)
    return ganti(s, '"cacat badan atau penyakit yang diderita #0047# sehingga tidak dapat menjalankan kewajibannya"',
                 'CONCAT("cacat badan atau penyakit yang diderita ", k.sp, " sehingga tidak dapat menjalankan kewajibannya")')

def v8531(s):
    s = tambah_dasar(s)
    return ganti(s, 'CONCAT("#0047# mendapat cacat badan atau penyakit dengan akibat tidak dapat menjalankan kewajibannya sebagai ", k.si)',
                 'CONCAT(k.sp, " mendapat cacat badan atau penyakit dengan akibat tidak dapat menjalankan kewajibannya sebagai ", k.sis)')

def v8530(s):
    s = tambah_dasar(s)
    # Al-Muwatha': hak memilih istri yang SUAMINYA sakit - hanya bila yang sakit suami
    return ganti(s, 'IF(k.hE AND k.si = "suami", "Menimbang, bahwa #8554# perlu mengetengahkan', 'IF(k.hE AND k.sis = "suami", "Menimbang, bahwa #8554# perlu mengetengahkan')

UBAH = {"8521": v8521, "8522": v8522, "8528": v8528, "8530": v8530, "8531": v8531}
pasang, pulih, periksa = [], [], []
for v, f in UBAH.items():
    hx, md5 = io.open(os.path.join(D, f"h{v}.txt"), encoding="ascii").read().split()
    b = bytes.fromhex(hx)
    assert hashlib.md5(b).hexdigest() == md5, v
    lama = b.decode("latin1")
    baru = f(lama).encode("latin1")
    md5b = hashlib.md5(baru).hexdigest()
    io.open(os.path.join(D, f"baru{v}.sql"), "wb").write(baru)
    pasang.append(f"UPDATE aps_badilag.abt_variabel SET sql_query = 0x{baru.hex()} WHERE no_var = {v} AND MD5(sql_query) = '{md5}';")
    pulih.append(f"UPDATE aps_badilag.abt_variabel SET sql_query = 0x{hx} WHERE no_var = {v} AND MD5(sql_query) = '{md5b}';")
    periksa.append(f"SELECT {v}, CASE MD5(sql_query) WHEN '{md5b}' THEN 'BARU' WHEN '{md5}' THEN 'LAMA' ELSE 'LAIN' END FROM aps_badilag.abt_variabel WHERE no_var = {v};")
    print(v, md5, "->", md5b, len(b), "->", len(baru))
for n, isi in (("PASANG", pasang), ("PULIH", pulih), ("PERIKSA", periksa)):
    io.open(os.path.join(D, f"abt-eg-sakit-28okt-{n}.sql"), "w", encoding="ascii").write("\n".join(isi) + "\n")
