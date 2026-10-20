# -*- coding: utf-8 -*-
"""
Menyusun paket ABT "u6-fakta-sinkron" (variabel kueri 4600-4699): keterangan saksi dan alat bukti yang SUDAH tersimpan di BAS
dibaca kembali oleh duduk perkara dan pertimbangan putusan (jenis perkara apa pun).

Jalankan dari folder paket:   python alat/susun-paket.py
Menulis: PASANG.sql, PERIKSA.sql, PULIH-HAPUS-BARU.sql, variabel.json (sumber kebenaran isi), MD5SUMS.txt

Aturan paket (sama dengan paket ABT lain):
  - hanya BARIS BARU di abt_variabel (nomor 4600-4699); tidak mengubah satu pun baris lama;
  - PASANG berhenti keras (ERROR 1242) bila salah satu nomor sudah terpakai; satu transaksi; teks berupa literal heksadesimal;
  - PERIKSA membandingkan panjang dan MD5 sql_query tiap baris; baris terakhir harus 'SEMUA COCOK';
  - PULIH-HAPUS-BARU menghapus baris baru (tidak ada baris lama yang berubah, jadi cadangan mysqldump hanya untuk berjaga-jaga);
  - tanpa kata aplikasi ini di nama/isi; semua teks ASCII.
"""
import hashlib
import json
import os

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PID = "#perkara_id#"
KET = "aps_badilag.abt_keterangan_saksi"
DATA = "aps_badilag.abt_data_teks"

DIDENGAR = "exists (select 1 from %s k where k.saksi_id = s.id and k.perkara_id = %s)" % (KET, PID)


def sisi(n):
    return "s.saksi_pihak_ke = %d" % n


def q_jumlah(n):
    return "select count(*) as data from perkara_pihak5 s where s.perkara_id = %s and %s and %s" % (PID, sisi(n), DIDENGAR)


TERBILANG = ["tidak ada", "1 (satu)", "2 (dua)", "3 (tiga)", "4 (empat)", "5 (lima)", "6 (enam)", "7 (tujuh)", "8 (delapan)"]


def q_terbilang(n):
    cases = " ".join("when %d then '%s'" % (i, t) for i, t in enumerate(TERBILANG))
    return "select (case x.n %s else concat(x.n, ' orang') end) as data from (%s) x" % (
        cases,
        q_jumlah(n).replace("count(*) as data", "count(*) as n"),
    )


def q_nama(n):
    return "select group_concat(s.nama order by s.urutan separator ' dan ') as data from perkara_pihak5 s where s.perkara_id = %s and %s and %s" % (PID, sisi(n), DIDENGAR)


def q_hubungan(n):
    return "select group_concat(s.keterangan order by s.urutan separator ' dan ') as data from perkara_pihak5 s where s.perkara_id = %s and %s and %s" % (PID, sisi(n), DIDENGAR)


def q_ada():
    return "select (case when exists (select 1 from %s k where k.perkara_id = %s) then 'ya' else 'tidak' end) as data" % (KET, PID)


def q_sidang():
    return "select count(distinct k.sidang_id) as data from %s k where k.perkara_id = %s" % (KET, PID)


def teks_bukti(kodes):
    """Gabungan isian alat bukti (satu atau beberapa variabel) sebagai satu teks; NULL menjadi kosong."""
    bagian = ", ".join("(select data from %s where no_var = %d and perkara_id = %s)" % (DATA, k, PID) for k in kodes)
    return "concat_ws(char(10), %s)" % bagian


def q_maks_tanda(huruf, kodes):
    cases = " ".join(
        "when d regexp '(^|[^A-Za-z])%s[.] ?%d([^0-9]|$)' then %d" % (huruf, i, i) for i in range(20, 0, -1)
    )
    return "select (case %s else 0 end) as data from (select %s as d) x" % (cases, teks_bukti(kodes))


def q_rentang(huruf, kodes):
    inti = q_maks_tanda(huruf, kodes).replace(" as data from", " as n from")
    return "select (case when y.n = 0 then '' when y.n = 1 then '%s.1' else concat('%s.1 sampai dengan %s.', y.n) end) as data from (%s) y" % (huruf, huruf, huruf, inti)


def q_memuat(kodes, pola):
    sambung = " or ".join("d like '%%%s%%'" % p for p in pola)
    return "select (case when %s then 'ya' else 'tidak' end) as data from (select %s as d) x" % (sambung, teks_bukti(kodes))


POKOK = [
    (4610, "pernikahan", "menikah|nikah|perkawinan|dinikahkan|wali"),
    (4611, "tempat tinggal bersama", "tinggal bersama|tempat tinggal|kediaman|serumah"),
    (4612, "anak", "anak|dikaruniai|dikarunia|diasuh|hak asuh"),
    (4613, "penyebab perselisihan dan pertengkaran", "penyebab|sebab|kenapa|mengapa|perselisihan|pertengkaran|cekcok"),
    (4614, "pisah rumah", "pisah|meninggalkan|pergi|berpisah"),
    (4615, "nafkah", "nafkah|iddah|mut"),
    (4616, "upaya damai", "damai|mendamaikan|rukun kembali|menasehati|menasihati|upaya"),
    (4617, "harta dan benda", "harta|barang|tanah|kendaraan|motor|mobil|kebun|sertifikat|rumah (milik|bersama)"),
    (4618, "kematian dan ahli waris", "meninggal( |$)|wafat|ahli waris|warisan|hutang|utang|peninggalan"),
]


def q_pokok(pola):
    return (
        "select substring(group_concat(concat(s.nama, ': ', left(trim(trailing ';' from k.jawaban), 150)) order by s.saksi_pihak_ke, s.urutan, k.urutan_pertanyaan separator '; '), 1, 900) as data "
        "from %s k join perkara_pihak5 s on s.id = k.saksi_id where k.perkara_id = %s and k.pertanyaan regexp '%s'" % (KET, PID, pola)
    )


V = []


def tambah(no, nama, sql):
    V.append({"no_var": no, "nama": nama, "data_type": "data_sql", "sql_query": sql})


tambah(4600, "BAS: jumlah saksi Penggugat/Pemohon yang diperiksa", q_jumlah(1))
tambah(4601, "BAS: jumlah saksi Tergugat/Termohon yang diperiksa", q_jumlah(2))
tambah(4602, "BAS: jumlah saksi Penggugat/Pemohon (angka dan terbilang)", q_terbilang(1))
tambah(4603, "BAS: jumlah saksi Tergugat/Termohon (angka dan terbilang)", q_terbilang(2))
tambah(4604, "BAS: nama saksi Penggugat/Pemohon yang diperiksa", q_nama(1))
tambah(4605, "BAS: nama saksi Tergugat/Termohon yang diperiksa", q_nama(2))
tambah(4606, "BAS: hubungan saksi dengan Penggugat/Pemohon", q_hubungan(1))
tambah(4607, "BAS: hubungan saksi dengan Tergugat/Termohon", q_hubungan(2))
tambah(4608, "BAS: ada keterangan saksi tersimpan (ya/tidak)", q_ada())
tambah(4609, "BAS: jumlah sidang pemeriksaan saksi", q_sidang())
for no, label, pola in POKOK:
    tambah(no, "BAS: keterangan saksi tentang %s (kutipan ringkas)" % label, q_pokok(pola))
tambah(4620, "BAS: jumlah bukti surat Penggugat/Pemohon", q_maks_tanda("P", [1214]))
tambah(4621, "BAS: jumlah bukti surat Tergugat/Termohon", q_maks_tanda("T", [9911, 1262]))
tambah(4622, "BAS: tanda bukti surat Penggugat/Pemohon (P.1 s.d. P.n)", q_rentang("P", [1214]))
tambah(4623, "BAS: tanda bukti surat Tergugat/Termohon (T.1 s.d. T.n)", q_rentang("T", [9911, 1262]))
tambah(4624, "BAS: bukti Penggugat/Pemohon memuat akta nikah (ya/tidak)", q_memuat([1214], ["akta nikah", "Akta Nikah", "buku nikah"]))
tambah(4625, "BAS: bukti Penggugat/Pemohon memuat KTP (ya/tidak)", q_memuat([1214], ["Tanda Penduduk", "KTP"]))
tambah(4626, "BAS: bukti Penggugat/Pemohon memuat Kartu Keluarga (ya/tidak)", q_memuat([1214], ["Kartu Keluarga"]))
tambah(4627, "BAS: bukti Penggugat/Pemohon memuat akta kelahiran (ya/tidak)", q_memuat([1214], ["Akta Kelahiran", "akta kelahiran"]))
tambah(4628, "BAS: bukti Penggugat/Pemohon memuat akta cerai atau kematian (ya/tidak)", q_memuat([1214], ["Akta Cerai", "akta cerai", "Akta Kematian", "akta kematian", "Surat Kematian"]))
tambah(4629, "BAS: bukti Tergugat/Termohon memuat akta nikah (ya/tidak)", q_memuat([9911, 1262], ["akta nikah", "Akta Nikah", "buku nikah"]))


def hexs(t):
    return "0x" + t.encode("cp1252").hex()


def md5(t):
    return hashlib.md5(t.encode("cp1252")).hexdigest()


nomor = [v["no_var"] for v in V]
assert all(4600 <= n <= 4699 for n in nomor) and len(set(nomor)) == len(nomor)
for v in V:
    assert "aleta" not in (v["nama"] + v["sql_query"]).lower(), v["no_var"]
    v["sql_query"].encode("ascii")
    v["nama"].encode("ascii")

daftar = ", ".join(str(n) for n in nomor)
kolom = "no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier"
p = []
p.append("-- Paket ABT u6-fakta-sinkron: %d variabel kueri BARU (nomor 4600-4699) - keterangan saksi dan alat bukti BAS dibaca putusan." % len(V))
p.append("-- Dijalankan: mysql --default-character-set=latin1 aps_badilag < PASANG.sql   (sesudah CADANG: mysqldump aps_badilag abt_variabel)")
p.append("-- Hanya menambah baris; tidak ada baris lama yang diubah. Teks berupa literal heksadesimal - JANGAN disunting di editor.")
p.append("")
p.append("-- PRASYARAT: berhenti dengan galat 'Subquery returns more than 1 row' bila ada nomor yang sudah terpakai. Tidak ada yang ditulis.")
p.append("SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)) = 0, 1, (SELECT no_var FROM abt_variabel UNION ALL SELECT 0)) AS prasyarat_nomor_bebas;" % daftar)
p.append("")
p.append("START TRANSACTION;")
for v in V:
    p.append(
        "INSERT INTO abt_variabel (%s) VALUES (%d, %s, 'data_sql', NULL, NULL, NULL, NULL, %s, NULL, NULL, 0, 'admin');"
        % (kolom, v["no_var"], hexs(v["nama"]), hexs(v["sql_query"]))
    )
p.append("COMMIT;")
p.append("SELECT COUNT(*) AS baris_baru FROM abt_variabel WHERE no_var IN (%s);" % daftar)
open(os.path.join(AKAR, "PASANG.sql"), "w", encoding="ascii", newline="\n").write("\n".join(p) + "\n")

c = ["-- Periksa hasil pemasangan: tiap baris cocok = 1; baris terakhir harus SEMUA COCOK."]
bagian = []
for v in V:
    bagian.append(
        "SELECT %d AS no_var, LENGTH(sql_query) AS panjang, %d AS panjang_harap, (MD5(sql_query) = '%s' AND LENGTH(sql_query) = %d AND data_type = 'data_sql') AS cocok FROM abt_variabel WHERE no_var = %d"
        % (v["no_var"], len(v["sql_query"]), md5(v["sql_query"]), len(v["sql_query"]), v["no_var"])
    )
c.append("\nUNION ALL\n".join(bagian) + ";")
c.append("SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)) = %d AND (%s) = %d, 'SEMUA COCOK', 'ADA YANG TIDAK COCOK') AS hasil;" % (
    daftar,
    len(V),
    " + ".join("(SELECT COUNT(*) FROM abt_variabel WHERE no_var = %d AND MD5(sql_query) = '%s')" % (v["no_var"], md5(v["sql_query"])) for v in V),
    len(V),
))
open(os.path.join(AKAR, "PERIKSA.sql"), "w", encoding="ascii", newline="\n").write("\n".join(c) + "\n")

open(os.path.join(AKAR, "PULIH-HAPUS-BARU.sql"), "w", encoding="ascii", newline="\n").write(
    "-- Pemulihan: menghapus baris yang ditambahkan paket ini. Tidak ada baris lama yang berubah.\n"
    "DELETE FROM abt_variabel WHERE no_var IN (%s);\n"
    "SELECT COUNT(*) AS sisa_baris_baru FROM abt_variabel WHERE no_var IN (%s);\n" % (daftar, daftar)
)
json.dump(V, open(os.path.join(AKAR, "variabel.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)

sums = []
for nm in ["PASANG.sql", "PERIKSA.sql", "PULIH-HAPUS-BARU.sql", "variabel.json"]:
    sums.append("%s  %s" % (hashlib.md5(open(os.path.join(AKAR, nm), "rb").read()).hexdigest(), nm))
open(os.path.join(AKAR, "MD5SUMS.txt"), "w", encoding="ascii", newline="\n").write("\n".join(sums) + "\n")
print("variabel:", len(V), "nomor", min(nomor), "-", max(nomor))
