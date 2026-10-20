# -*- coding: utf-8 -*-
"""
Analisis alat bukti surat otomatis dari daftar bukti yang diketik petugas (isian berbaris: satu bukti per baris, 'diberi tanda P.1').
Pola paket U5 (variabel 4530): satu tabel turunan membelah baris, memberi kelas, lalu pivot GROUP_CONCAT (<= 40 label, jauh di bawah 1024 huruf);
satu kalimat Menimbang per kelas yang ada. Daftar kosong -> keluaran kosong (blangko lama tampil sama).
"""
from sqlkit import lit, isi_mentah


def pecah_baris(isian_no, maks=60):
    nums = "SELECT 1 AS n" + "".join(" UNION ALL SELECT %d" % i for i in range(2, maks + 1))
    raw = "REPLACE(REPLACE(REPLACE(REPLACE(%s, '<br>', CHAR(10)), '<BR>', CHAR(10)), CHAR(13), ''), '&nbsp;', ' ')" % isi_mentah(isian_no)
    return (
        "SELECT nums.n AS n, TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(r.raw, CHAR(10), nums.n), CHAR(10), -1)) AS t "
        "FROM (SELECT %s AS raw) r JOIN (%s) nums ON nums.n <= LENGTH(r.raw) - LENGTH(REPLACE(r.raw, CHAR(10), '')) + 1" % (raw, nums)
    )


def analisis_bukti(isian_no, kelas, kalimat, awalan, ujung_kalimat=";"):
    """kelas: daftar (nomor_kelas, [kata kunci huruf kecil]) berurutan menurut prioritas; kelas lain = 99.
    kalimat: {nomor_kelas: 'teks dengan {L}'}; {L} diganti daftar label ('P.1 dan P.3' / 'P.1, P.2 dan P.5')."""
    nomor = sorted(set([k for k, _ in kelas] + [99]))
    when = []
    for no, kunci in kelas:
        kond = " OR ".join("LOWER(LEFT(b.t, 140)) LIKE '%%%s%%'" % k for k in kunci)
        when.append("WHEN %s THEN %d" % (kond, no))
    kl = "CASE " + " ".join(when) + " ELSE 99 END"
    label = (
        "IF(LOCATE('tanda ', b.t) > 0, TRIM(TRAILING ';' FROM TRIM(TRAILING ',' FROM TRIM(TRAILING '.' FROM SUBSTRING_INDEX(SUBSTRING_INDEX(b.t, 'tanda ', -1), ' ', 1)))), CONCAT('%s', b.n))"
        % awalan
    )
    dalam = "SELECT b.n AS n, %s AS kl, %s AS lb FROM (%s) b WHERE b.t <> ''" % (kl, label, pecah_baris(isian_no))
    pivot = "SELECT COUNT(*) AS jml, %s FROM (%s) c" % (
        ", ".join("GROUP_CONCAT(IF(c.kl = %d, c.lb, NULL) ORDER BY c.n SEPARATOR ', ') AS k%d" % (k, k) for k in nomor),
        dalam,
    )

    def rapi(k):
        return (
            "IF(LOCATE(', ', p.{k}) = 0, p.{k}, CONCAT(SUBSTRING(p.{k}, 1, CHAR_LENGTH(p.{k}) - CHAR_LENGTH(SUBSTRING_INDEX(p.{k}, ', ', -1)) - 2), ' dan ', SUBSTRING_INDEX(p.{k}, ', ', -1)))"
        ).format(k="k%d" % k)

    butir = []
    for k in nomor:
        if k not in kalimat:
            continue
        awal, akhir = kalimat[k].split("{L}")
        butir.append("IF(p.k%d IS NULL, NULL, CONCAT(%s, %s, %s))" % (k, lit("Menimbang, bahwa " + awal), rapi(k), lit(akhir + ujung_kalimat)))
    ungkapan = "IF(p.jml = 0, '', CONCAT_WS('<br>', %s))" % ", ".join(butir)
    return "SELECT IF(IFNULL(%s, '') = '', '', CONCAT(%s, '{}')) AS data FROM (%s) p" % (ungkapan, ungkapan, pivot)


def baris_ke_kalimat(isian_no, ekspresi_baris, maks=24, pemisah="<br>"):
    """Satu kalimat per baris isian (mis. per objek): `ekspresi_baris` memakai b.n (nomor) dan b.t (teks baris, sudah TRIM); hasil digabung dengan <br>.
    Pivot MAX(CASE) agar tidak terkena batas group_concat_max_len."""
    nums = "SELECT 1 AS n" + "".join(" UNION ALL SELECT %d" % i for i in range(2, maks + 1))
    raw = "REPLACE(REPLACE(REPLACE(REPLACE(%s, '<br>', CHAR(10)), '<BR>', CHAR(10)), CHAR(13), ''), '&nbsp;', ' ')" % isi_mentah(isian_no)
    belah = (
        "SELECT nums.n AS n, TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(r.raw, CHAR(10), nums.n), CHAR(10), -1)) AS t "
        "FROM (SELECT %s AS raw) r JOIN (%s) nums ON nums.n <= LENGTH(r.raw) - LENGTH(REPLACE(r.raw, CHAR(10), '')) + 1" % (raw, nums)
    )
    dalam = "SELECT b.n AS n, %s AS lt FROM (%s) b WHERE b.t <> ''" % (ekspresi_baris, belah)
    luar = "SELECT COUNT(*) AS jml, %s FROM (%s) z" % (", ".join("MAX(CASE WHEN z.n = %d THEN z.lt END) AS l%d" % (i, i) for i in range(1, maks + 1)), dalam)
    return luar, ", ".join("p.l%d" % i for i in range(1, maks + 1))
