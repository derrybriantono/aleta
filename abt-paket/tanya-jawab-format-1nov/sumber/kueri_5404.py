# -*- coding: utf-8 -*-
"""Kueri BARU variabel ABT #5404# "MAJELIS HAKIM DAN PANITERA SIDANG (OTOMATIS APABILA ADA PERGANTIAN)" (keputusan pengguna 86, 1 Nov 2026).

Dasar (SIPP): perkara_hakim_pn dan perkara_panitera_pn - tiap penetapan (PMH/PHT/PPP) = satu "gelombang" baris bertanggal
tanggal_penetapan; penggantian = gelombang baru, baris lama aktif='T' dengan tanggal_tidak_aktif = tanggal penetapan baru
(kadang aktif='T' tanpa tanggal bila penetapan diterbitkan ulang untuk orang yang sama).

Susunan yang BERLAKU pada tanggal sidang X = gelombang dengan tanggal_penetapan terbesar <= X (bila tak ada: gelombang tertua), tanpa baris
yang sudah berakhir pada X (tanggal_tidak_aktif <= X). Susunan sidang ini (#0033#) dibandingkan dengan susunan sidang SEBELUMNYA (#6091#):
orangnya (hakim_id / panitera_id), jabatannya (Ketua / Anggota / Tunggal), dan panitera pengganti. Sama -> kalimat lama
"Susunan majelis yang bersidang sama dengan sidang yang lalu;". Beda -> kalimat pergantian: siapa yang berganti, siapa penggantinya,
alasan (keterangan penetapan, bila ada dan berupa alasan), dasar (jenis penetapan pengganti, nomor bila ada, tanggal), lalu susunan baru.

Kueri lama membandingkan "tanggal penetapan = tanggal sidang" dan "tahun surat = tahun berjalan" (CURDATE()), sehingga pergantian yang
ditetapkan SEBELUM hari sidang tidak terdeteksi dan sidang tahun lalu salah; alasan kosong tercetak "sedang ,".
Hanya memakai #perkara_id#, #0033# (tanggal sidang), #6091# (tanggal sidang sebelumnya), #6034# (sebutan panitera) - semua sudah ada.
MariaDB 5.5: tanpa CTE/fungsi jendela.
"""

PID = '#perkara_id#'
CUR = '@C@'
PRV = '@P@'
SAMA = 'Susunan majelis yang bersidang sama dengan sidang yang lalu;'


def hb(y, tabel='perkara_hakim_pn', kol='h0'):
    return ('IFNULL((SELECT MAX(%s.tanggal_penetapan) FROM %s %s WHERE %s.perkara_id=%s AND %s.tanggal_penetapan<=%s),'
            '(SELECT MIN(%s.tanggal_penetapan) FROM %s %s WHERE %s.perkara_id=%s))') % (kol, tabel, kol, kol, PID, kol, y, kol, tabel, kol, kol, PID)


def baris_hakim(alias, gel, y):
    """FROM/WHERE baris hakim yang berlaku pada tanggal y di gelombang gel (kolom z.*)."""
    return ('perkara_hakim_pn %s LEFT JOIN hakim_pn b%s ON b%s.id=%s.hakim_id WHERE %s.perkara_id=%s AND %s.tanggal_penetapan=%s '
            'AND (%s.tanggal_tidak_aktif IS NULL OR %s.tanggal_tidak_aktif>%s OR NOT EXISTS (SELECT 1 FROM perkara_hakim_pn zz WHERE zz.perkara_id=%s AND zz.tanggal_penetapan>%s.tanggal_penetapan))') % (alias, alias, alias, alias, alias, PID, alias, gel, alias, alias, y, PID, alias)


def baris_pp(alias, gel, y):
    return ('perkara_panitera_pn %s WHERE %s.perkara_id=%s AND %s.tanggal_penetapan=%s '
            'AND (%s.tanggal_tidak_aktif IS NULL OR %s.tanggal_tidak_aktif>%s OR NOT EXISTS (SELECT 1 FROM perkara_panitera_pn zz WHERE zz.perkara_id=%s AND zz.tanggal_penetapan>%s.tanggal_penetapan))') % (alias, alias, PID, alias, gel, alias, alias, y, PID, alias)


def U(x):
    """semua teks dari kolom dipaksa utf8 supaya CONCAT tidak bentrok kolasi (kolom latin1 vs sambungan utf8)."""
    return "CONVERT(%s USING utf8)" % x


def norm(x):
    return "LOWER(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(%s),' ',''),',',''),'.',''),'-',''))" % U(x)


def kunci_h(a):
    return norm("IFNULL(b%s.nama_gelar,%s.hakim_nama)" % (a, a))


def kunci_p(a):
    return norm("%s.panitera_nama" % a)


def nama_h(a):
    return U("IFNULL(b%s.nama_gelar,%s.hakim_nama)" % (a, a))


def daftar_dan(kolom):
    """'A|B|C' -> 'A, B dan C' (tanpa menyentuh koma di dalam nama)."""
    n = "(LENGTH(%s)-LENGTH(REPLACE(%s,'|','')))" % (kolom, kolom)
    return ("IF(%s=0,%s,IF(%s=1,REPLACE(%s,'|',' dan '),CONCAT(REPLACE(SUBSTRING_INDEX(%s,'|',%s),'|',', '),' dan ',SUBSTRING_INDEX(%s,'|',-1))))"
            % (n, kolom, n, kolom, kolom, n, kolom))


# alasan: keterangan penetapan yang berupa alasan (bukan kode ruang/jenis sidang)
BUKAN_ALASAN = "'^(c[0-9]|[abc]|pmh|pht|phs|isbat terpadu|perkara sidkel|perkara sidang keliling|sidang keliling.*|sidkel.*)$'"


def alasan_h(gel_baru, gel_lama):
    """keterangan hakim: gelombang baru dulu, lalu gelombang lama (yang berakhir)."""
    def satu(g):
        return ("(SELECT GROUP_CONCAT(DISTINCT CONVERT(TRIM(k.keterangan) USING utf8) ORDER BY k.urutan SEPARATOR '; ') FROM perkara_hakim_pn k "
                "WHERE k.perkara_id=%s AND k.tanggal_penetapan=%s AND k.keterangan IS NOT NULL AND TRIM(k.keterangan)<>'' "
                "AND TRIM(k.keterangan) NOT REGEXP %s)") % (PID, g, BUKAN_ALASAN)
    return 'IFNULL(%s,%s)' % (satu(gel_baru), satu(gel_lama))


def alasan_p(gel_baru, gel_lama):
    def satu(g):
        return ("(SELECT GROUP_CONCAT(DISTINCT CONVERT(TRIM(k.keterangan) USING utf8) ORDER BY k.urutan SEPARATOR '; ') FROM perkara_panitera_pn k "
                "WHERE k.perkara_id=%s AND k.tanggal_penetapan=%s AND k.keterangan IS NOT NULL AND TRIM(k.keterangan)<>'' "
                "AND TRIM(k.keterangan) NOT REGEXP %s)") % (PID, g, BUKAN_ALASAN)
    return 'IFNULL(%s,%s)' % (satu(gel_baru), satu(gel_lama))


def frasa_alasan(r):
    """alasan (kolom r) -> '' bila kosong; 'sedang ...' bila pendek; '(...)' bila kalimat panjang."""
    bersih = "TRIM(TRAILING '.' FROM TRIM(TRAILING ';' FROM TRIM(%s)))" % r
    return ("IF(IFNULL(%s,'')='','',IF(LOWER(%s) REGEXP '^(sedang|telah|sudah)[ ]',CONCAT(' ',%s),"
            "IF(LENGTH(%s)<=40 AND LOWER(%s) NOT REGEXP '^(hakim|ketua|anggota|panitera|salah|perkara|majelis)',"
            "CONCAT(' sedang ',CONCAT(LOWER(LEFT(%s,1)),SUBSTRING(%s,2))),CONCAT(' (',%s,')'))))"
            % (r, bersih, bersih, bersih, bersih, bersih, bersih, bersih))


def bangun():
    # ---- lapis 1: tanggal gelombang penetapan yang berlaku
    d = ("SELECT %s AS hc,%s AS hp,%s AS pc,%s AS pp,"
         "IF(STR_TO_DATE(%s,'%%Y-%%m-%%d') IS NULL,0,1) AS ada,par.cur AS cur,par.prv AS prv,par.pn AS pn") % (
        hb(CUR), hb(PRV), hb(CUR, 'perkara_panitera_pn'), hb(PRV, 'perkara_panitera_pn'), PRV)
    # PENTING (kinerja ABT): ABT memecahkan SETIAP kemunculan #nnnn# (satu per kemunculan, bukan per nomor) dengan pembacaan data dan, untuk
    # variabel sidang, "call perkara_jadwal_sidang_reorder". Jadi tiap penanda ditulis SEKALI di sini lalu dirujuk lewat kolom par.*
    # (#perkara_id# diganti str_replace biasa, bukan variabel, jadi boleh berulang).
    d = d.replace('@C@', 'par.cur').replace('@P@', 'par.prv')
    d += ' FROM (SELECT "#0033#" AS cur,"#6091#" AS prv,"#6034#" AS pn) par'
    H_CUR = lambda a: baris_hakim(a, 'd.hc', CUR)
    H_PRV = lambda a: baris_hakim(a, 'd.hp', PRV)
    P_CUR = lambda a: baris_pp(a, 'd.pc', CUR)
    P_PRV = lambda a: baris_pp(a, 'd.pp', PRV)

    def himpun(sql_from, kolom, urut='1', pisah='|', distinct=True):
        return "(SELECT GROUP_CONCAT(%s%s ORDER BY %s SEPARATOR '%s') FROM %s)" % ('DISTINCT ' if distinct else '', kolom, urut, pisah, sql_from)

    kolom = []

    def tambah(nama, ekspr):
        kolom.append((nama, ekspr))

    # --- cepat (berbasis id, tanpa join): hanya bila gelombang penetapan hakim/panitera berbeda dari sidang sebelumnya
    def sederhana(tabel, alias, gel, y, kol):
        return ("(SELECT GROUP_CONCAT(%s ORDER BY %s SEPARATOR '|') FROM %s %s WHERE %s.perkara_id=%s AND %s.tanggal_penetapan=%s "
                "AND (%s.tanggal_tidak_aktif IS NULL OR %s.tanggal_tidak_aktif>%s OR NOT EXISTS (SELECT 1 FROM %s zz WHERE zz.perkara_id=%s AND zz.tanggal_penetapan>%s.tanggal_penetapan)))") % (kol, kol, tabel, alias, alias, PID, alias, gel, alias, alias, y, tabel, PID, alias)
    kj = lambda a: "CONCAT(CAST(IFNULL(%s.jabatan_hakim_id,0) AS CHAR CHARACTER SET utf8),':',CAST(IFNULL(%s.hakim_id,0) AS CHAR CHARACTER SET utf8))" % (a, a)
    kp = lambda a: "CAST(IFNULL(%s.panitera_id,0) AS CHAR CHARACTER SET utf8)" % a
    tambah('hi_c', sederhana('perkara_hakim_pn', 'c1', 'd.hc', CUR, kj('c1')))
    tambah('hi_p', sederhana('perkara_hakim_pn', 'c2', 'd.hp', PRV, kj('c2')))
    tambah('pi_c', sederhana('perkara_panitera_pn', 'c3', 'd.pc', CUR, kp('c3')))
    tambah('pi_p', sederhana('perkara_panitera_pn', 'c4', 'd.pp', PRV, kp('c4')))
    # himpunan orang (kunci nama) dan peran, susunan sekarang dan sebelumnya (BERAT: hanya bila id berbeda)
    tambah('hs_c', himpun(H_CUR('a1'), kunci_h('a1'), kunci_h('a1')))
    tambah('hs_p', himpun(H_PRV('a2'), kunci_h('a2'), kunci_h('a2')))
    pr_c = "CONCAT(CAST(IFNULL(a3.jabatan_hakim_id,0) AS CHAR CHARACTER SET utf8),':',%s)" % kunci_h('a3')
    pr_p = "CONCAT(CAST(IFNULL(a4.jabatan_hakim_id,0) AS CHAR CHARACTER SET utf8),':',%s)" % kunci_h('a4')
    tambah('hr_c', himpun(H_CUR('a3'), pr_c, pr_c))
    tambah('hr_p', himpun(H_PRV('a4'), pr_p, pr_p))
    tambah('ps_c', himpun(P_CUR('a5'), kunci_p('a5'), kunci_p('a5')))
    tambah('ps_p', himpun(P_PRV('a6'), kunci_p('a6'), kunci_p('a6')))
    # yang keluar / yang masuk (nama bergelar), urut jabatan
    h_out = himpun(H_PRV('a7') + ' AND %s NOT IN (SELECT %s FROM %s)' % (kunci_h('a7'), kunci_h('a8'), H_CUR('a8')),
                   nama_h('a7'), 'a7.jabatan_hakim_id, a7.urutan, a7.id')
    h_in = himpun(H_CUR('a9') + ' AND %s NOT IN (SELECT %s FROM %s)' % (kunci_h('a9'), kunci_h('a10'), H_PRV('a10')),
                  nama_h('a9'), 'a9.jabatan_hakim_id, a9.urutan, a9.id')
    p_out = himpun(P_PRV('a11') + ' AND %s NOT IN (SELECT %s FROM %s)' % (kunci_p('a11'), kunci_p('a12'), P_CUR('a12')),
                   U('a11.panitera_nama'), 'a11.urutan, a11.id')
    p_in = himpun(P_CUR('a13') + ' AND %s NOT IN (SELECT %s FROM %s)' % (kunci_p('a13'), kunci_p('a14'), P_PRV('a14')),
                  U('a13.panitera_nama'), 'a13.urutan, a13.id')
    tambah('h_out', h_out)
    tambah('h_in', h_in)
    tambah('p_out', p_out)
    tambah('p_in', p_in)
    tambah('h_ket', alasan_h('d.hc', 'd.hp'))
    tambah('p_ket', alasan_p('d.pc', 'd.pp'))
    tambah('h_nomor', "(SELECT CONVERT(MAX(NULLIF(NULLIF(TRIM(k.nomor_sk_penetapan),''),'NULL')) USING utf8) FROM perkara_hakim_pn k WHERE k.perkara_id=%s AND k.tanggal_penetapan=d.hc)" % PID)
    tambah('p_nomor', "(SELECT CONVERT(MAX(NULLIF(NULLIF(TRIM(k.nomor_sk_penetapan),''),'NULL')) USING utf8) FROM perkara_panitera_pn k WHERE k.perkara_id=%s AND k.tanggal_penetapan=d.pc)" % PID)
    # susunan baru
    def nm(jab, urut_sql, a):
        return "(SELECT %s FROM %s AND %s.jabatan_hakim_id=%s ORDER BY %s.urutan, %s.id %s)" % (nama_h(a), H_CUR(a), a, jab, a, a, urut_sql)
    tambah('k_n', nm(1, 'LIMIT 1', 'b1'))
    tambah('a1_n', nm(2, 'LIMIT 1', 'b2'))
    tambah('a2_n', nm(2, 'LIMIT 1,1', 'b3'))
    tambah('t_n', nm(3, 'LIMIT 1', 'b4'))
    tambah('pp_n', himpun(P_CUR('b5'), U('b5.panitera_nama'), 'b5.urutan, b5.id', ' dan ', distinct=False))
    return d, kolom


RINGAN = ('hi_c', 'hi_p', 'pi_c', 'pi_p')


def kueri():
    d, kolom = bangun()
    # tiga lapis supaya kasus tersering ("sama dengan sidang yang lalu") murah: d = tanggal gelombang; e = perbandingan orang/jabatan
    # (6 himpunan kecil, berindeks perkara_id) + penanda berubah; z = bagian BERAT (nama, alasan, nomor) HANYA dihitung bila berubah.
    NB = chr(10)
    ringan = (',' + NB + '  ').join('IF(d.ada=1 AND (d.hc<>d.hp OR d.pc<>d.pp),%s,NULL) AS %s' % (e.replace('@C@', 'd.cur').replace('@P@', 'd.prv'), n) for n, e in kolom if n in RINGAN)
    e1 = 'SELECT d.*,' + NB + '  ' + ringan + NB + 'FROM (' + d + ') d'
    flag = ("IF(e1.ada=1 AND (e1.hc<>e1.hp OR e1.pc<>e1.pp) AND (IFNULL(e1.hi_c,'')<>IFNULL(e1.hi_p,'') OR IFNULL(e1.pi_c,'')<>IFNULL(e1.pi_p,'')),1,0)")
    e = 'SELECT e1.*, ' + flag + ' AS chg' + NB + 'FROM (' + e1 + ') e1'

    def ke_e(x):
        for k in ('hc', 'hp', 'pc', 'pp'):
            x = x.replace('d.' + k, 'e.' + k)
        return x.replace('@C@', 'e.cur').replace('@P@', 'e.prv')
    berat = (',' + NB + '  ').join('IF(e.chg=1,%s,NULL) AS %s' % (ke_e(x), n) for n, x in kolom if n not in RINGAN)
    z = 'SELECT e.*,' + NB + '  ' + berat + NB + 'FROM (' + e + ') e'

    h_ubah = "(IFNULL(z.hs_c,'')<>IFNULL(z.hs_p,'') OR IFNULL(z.hr_c,'')<>IFNULL(z.hr_p,''))"
    p_ubah = "(IFNULL(z.ps_c,'')<>IFNULL(z.ps_p,''))"
    h_orang = "(IFNULL(z.hs_c,'')<>IFNULL(z.hs_p,''))"
    # bagian hakim
    bag_h = ("IF(NOT %s,'',IF(NOT %s,'terjadi perubahan susunan jabatan Majelis Hakim',"
             "IF(IFNULL(z.h_out,'')<>'' AND IFNULL(z.h_in,'')<>'',CONCAT('Hakim bernama ',%s,' yang sebelumnya bertugas',%s,' digantikan oleh ',%s),"
             "IF(IFNULL(z.h_in,'')<>'',CONCAT('Hakim bernama ',%s,' ditunjuk menjadi bagian dari susunan majelis'),"
             "CONCAT('Hakim bernama ',%s,' tidak lagi bertugas',%s)))))") % (
        h_ubah, h_orang, daftar_dan('z.h_out'), frasa_alasan('z.h_ket'), daftar_dan('z.h_in'),
        daftar_dan('z.h_in'), daftar_dan('z.h_out'), frasa_alasan('z.h_ket'))
    bag_p = ("IF(NOT %s,'',IF(IFNULL(z.p_out,'')<>'' AND IFNULL(z.p_in,'')<>'',"
             "CONCAT(z.pn,' bernama ',%s,' yang sebelumnya bertugas',%s,' digantikan oleh ',%s),"
             "IF(IFNULL(z.p_in,'')<>'',CONCAT(z.pn,' bernama ',%s,' ditunjuk mendampingi sidang'),"
             "CONCAT(z.pn,' bernama ',%s,' tidak lagi bertugas',%s))))") % (
        p_ubah, daftar_dan('z.p_out'), frasa_alasan('z.p_ket'), daftar_dan('z.p_in'),
        daftar_dan('z.p_in'), daftar_dan('z.p_out'), frasa_alasan('z.p_ket'))
    tunggal = "(z.t_n IS NOT NULL)"
    dasar_h = ("IF(NOT %s,'',CONCAT('Penetapan ',IF(%s,'Hakim Tunggal (PHT)','Majelis Hakim (PMH)'),' pengganti',"
               "IF(IFNULL(z.h_nomor,'')<>'',CONCAT(' Nomor ',z.h_nomor),''),' tanggal ',TRIM(LEADING '0' FROM CONVERT(convert_tanggal_indonesia(z.hc) USING utf8))))") % (h_ubah, tunggal)
    dasar_p = ("IF(NOT %s,'',CONCAT('Penunjukan Panitera Pengganti (PPP) pengganti',"
               "IF(IFNULL(z.p_nomor,'')<>'',CONCAT(' Nomor ',z.p_nomor),''),' tanggal ',TRIM(LEADING '0' FROM CONVERT(convert_tanggal_indonesia(z.pc) USING utf8))))") % p_ubah
    # satu tanggal dan tanpa nomor: satu kalimat dasar
    dasar = ("IF(%s AND %s AND z.hc=z.pc AND IFNULL(z.h_nomor,'')='' AND IFNULL(z.p_nomor,'')='',"
             "CONCAT('Penetapan ',IF(%s,'Hakim Tunggal (PHT)','Majelis Hakim (PMH)'),' dan Penunjukan Panitera Pengganti (PPP) pengganti tanggal ',TRIM(LEADING '0' FROM CONVERT(convert_tanggal_indonesia(z.hc) USING utf8))),"
             "CONCAT_WS(' dan ',NULLIF(%s,''),NULLIF(%s,'')))") % (h_ubah, p_ubah, tunggal, dasar_h, dasar_p)
    pp_baris = "CONCAT('<br><li><strong>',IFNULL(z.pp_n,'-'),'</strong> sebagai ',z.pn,';')"
    susunan = ("IF(%s,CONCAT('<br>-<li><strong>',z.t_n,'</strong> sebagai Hakim Tunggal; dan dibantu',%s),"
               "CONCAT('<br>1.<li><strong>',IFNULL(z.k_n,'-'),'</strong> sebagai Ketua Majelis;',"
               "IF(z.a1_n IS NULL,'',CONCAT('<br>2.<li><strong>',z.a1_n,'</strong> sebagai Hakim Anggota;')),"
               "IF(z.a2_n IS NULL,'',CONCAT('<br>3.<li><strong>',z.a2_n,'</strong> sebagai Hakim Anggota;')),"
               "' dan dibantu',%s))") % (tunggal, pp_baris, pp_baris)
    kalimat = ("CONCAT('Susunan majelis sidang sebelumnya mengalami perubahan karena ',"
               "CONCAT_WS(' dan ',NULLIF(%s,''),NULLIF(%s,'')),"
               "', berdasarkan ',%s,"
               "', sehingga susunan majelis bersidang menjadi sebagai berikut:',%s)") % (bag_h, bag_p, dasar, susunan)
    luar = ("SELECT CASE WHEN z.chg=0 OR NOT (%s OR %s) THEN '%s' ELSE %s END AS data\nFROM (\n%s\n) z") % (h_ubah, p_ubah, SAMA, kalimat, z)
    return luar


if __name__ == '__main__':
    import sys
    sys.stdout.write(kueri())
