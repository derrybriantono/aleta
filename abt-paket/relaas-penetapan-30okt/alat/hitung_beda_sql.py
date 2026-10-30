# -*- coding: utf-8 -*-
"""Hitung, atas SEMUA perkara SIPP (sipp_rp30 = salinan sipp_2810), berapa perkara yang keluarannya berubah karena tiap aturan paket,
langsung dari data yang menentukan perubahan itu (melengkapi render php56 contoh). pakai: python hitung_beda_sql.py <keluar.json>"""
import json
import subprocess
import sys

MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
DB = 'sipp_rp30'
HADIR = ("EXISTS (SELECT 1 FROM perkara_jadwal_sidang j WHERE j.perkara_id = p.perkara_id AND j.dihadiri_oleh IN (1, 3, 8, 9, 11, 15) "
         "AND j.tanggal_sidang <= u.tanggal_putusan)")
EF = "EXISTS (SELECT 1 FROM perkara_efiling_id f WHERE f.perkara_id = p.perkara_id AND f.efiling_id <> '')"

Q = {
    "perkara": "SELECT COUNT(*) FROM perkara",
    "alur15": "SELECT COUNT(*) FROM perkara WHERE alur_perkara_id = 15",
    "alur16": "SELECT COUNT(*) FROM perkara WHERE alur_perkara_id = 16",
    # 11204: e-Court dengan PHS -> '2026yang' jadi '2026 yang'
    "11204_ecourt_ber_PHS": "SELECT COUNT(*) FROM perkara p JOIN perkara_penetapan t ON t.perkara_id = p.perkara_id "
                            "WHERE t.penetapan_hari_sidang IS NOT NULL AND " + EF,
    "11204_bukan_ecourt (identik)": "SELECT COUNT(*) FROM perkara p WHERE NOT " + EF,
    # 11214 (relaas ikrar T): perintah = PHS ikrar; beda tanggal bila PHS ikrar ada
    "11214_ikrar_ber_PHS_ikrar": "SELECT COUNT(*) FROM perkara_ikrar_talak WHERE tanggal_penetapan_sidang_ikrar IS NOT NULL",
    "11214_PHS_ikrar_beda_PHS_pokok": "SELECT COUNT(*) FROM perkara_ikrar_talak i JOIN perkara_penetapan t ON t.perkara_id = i.perkara_id "
                                      "WHERE i.tanggal_penetapan_sidang_ikrar IS NOT NULL AND i.tanggal_penetapan_sidang_ikrar <> IFNULL(t.penetapan_hari_sidang, '1900-01-01')",
    # 11205
    "11205_alur15_koma": "SELECT COUNT(*) FROM perkara WHERE alur_perkara_id = 15",
    "11205_alur15_P_banyak (+ I)": "SELECT COUNT(*) FROM perkara p WHERE p.alur_perkara_id = 15 AND (SELECT COUNT(*) FROM perkara_pihak1 a WHERE a.perkara_id = p.perkara_id) > 1",
    "11205_alur16_P_tunggal (- I)": "SELECT COUNT(*) FROM perkara p WHERE p.alur_perkara_id = 16 AND (SELECT COUNT(*) FROM perkara_pihak1 a WHERE a.perkara_id = p.perkara_id) <= 1",
    # 11206
    "11206_agama_T_kosong (tetap Islam, sama)": "SELECT COUNT(*) FROM perkara p JOIN perkara_pihak2 a ON a.perkara_id = p.perkara_id JOIN pihak b ON b.id = a.pihak_id "
                                 "LEFT JOIN agama g ON g.id = b.agama_id WHERE p.alur_perkara_id = 15 AND a.urutan = (SELECT MIN(urutan) FROM perkara_pihak2 x WHERE x.perkara_id = p.perkara_id) "
                                 "AND IFNULL(g.nama, '') = ''",
    "11206_agama_T_bukan_Islam": "SELECT COUNT(*) FROM perkara p JOIN perkara_pihak2 a ON a.perkara_id = p.perkara_id JOIN pihak b ON b.id = a.pihak_id "
                                 "LEFT JOIN agama g ON g.id = b.agama_id WHERE p.alur_perkara_id = 15 AND a.urutan = (SELECT MIN(urutan) FROM perkara_pihak2 x WHERE x.perkara_id = p.perkara_id) "
                                 "AND IFNULL(g.nama, '') <> 'Islam'",
    "11206_agama_T_bukan_Islam_rinci": "SELECT IFNULL(g.nama, '(kosong)'), COUNT(*) FROM perkara p JOIN perkara_pihak2 a ON a.perkara_id = p.perkara_id JOIN pihak b ON b.id = a.pihak_id "
                                       "LEFT JOIN agama g ON g.id = b.agama_id WHERE p.alur_perkara_id = 15 AND a.urutan = (SELECT MIN(urutan) FROM perkara_pihak2 x WHERE x.perkara_id = p.perkara_id) "
                                       "AND IFNULL(g.nama, '') <> 'Islam' GROUP BY 1",
    "11206_T_banyak (+ I)": "SELECT COUNT(*) FROM perkara p WHERE p.alur_perkara_id = 15 AND (SELECT COUNT(*) FROM perkara_pihak2 a WHERE a.perkara_id = p.perkara_id) > 1",
    # 11207/11208
    "PBT_putus_verstek (P: verzet->banding)": "SELECT COUNT(*) FROM perkara_putusan WHERE LOCATE('Verstek', amar_putusan) > 0",
    "PBT_putus_bukan_verstek (T: dasar 153->199)": "SELECT COUNT(*) FROM perkara_putusan WHERE amar_putusan IS NOT NULL AND LOCATE('Verstek', amar_putusan) = 0",
    "PBT_P_bukan_ecourt_T_ghaib (cabang Bupati dibuang)": "SELECT COUNT(*) FROM perkara p WHERE NOT " + EF + " AND (SELECT ghaib FROM perkara_pihak2 WHERE perkara_id = p.perkara_id LIMIT 1) = 1",
    # upaya hukum menurut kehadiran (keputusan pengguna 30 Okt): gugatan putus x verstek x Tergugat pernah hadir; permohonan = kasasi
    "UH_gugatan_verstek_T_tidak_pernah_hadir (verzet, sama)": "SELECT COUNT(*) FROM perkara p JOIN perkara_putusan u ON u.perkara_id = p.perkara_id "
        "WHERE p.alur_perkara_id = 15 AND LOCATE('Verstek', u.amar_putusan) > 0 AND NOT " + HADIR,
    "UH_gugatan_verstek_T_pernah_hadir (verzet -> banding)": "SELECT COUNT(*) FROM perkara p JOIN perkara_putusan u ON u.perkara_id = p.perkara_id "
        "WHERE p.alur_perkara_id = 15 AND LOCATE('Verstek', u.amar_putusan) > 0 AND " + HADIR,
    "UH_gugatan_bukan_verstek_T_pernah_hadir (banding, dasar 153 -> 199)": "SELECT COUNT(*) FROM perkara p JOIN perkara_putusan u ON u.perkara_id = p.perkara_id "
        "WHERE p.alur_perkara_id = 15 AND u.amar_putusan IS NOT NULL AND LOCATE('Verstek', u.amar_putusan) = 0 AND " + HADIR,
    "UH_gugatan_bukan_verstek_T_tidak_pernah_hadir (banding -> verzet)": "SELECT COUNT(*) FROM perkara p JOIN perkara_putusan u ON u.perkara_id = p.perkara_id "
        "WHERE p.alur_perkara_id = 15 AND u.amar_putusan IS NOT NULL AND LOCATE('Verstek', u.amar_putusan) = 0 AND NOT " + HADIR,
    "UH_permohonan_tunggal (kasasi Pemohon)": "SELECT COUNT(*) FROM perkara p JOIN perkara_putusan u ON u.perkara_id = p.perkara_id WHERE p.alur_perkara_id = 16 "
        "AND (SELECT COUNT(*) FROM perkara_pihak1 a WHERE a.perkara_id = p.perkara_id) <= 1",
    "UH_permohonan_para (kasasi Para Pemohon)": "SELECT COUNT(*) FROM perkara p JOIN perkara_putusan u ON u.perkara_id = p.perkara_id WHERE p.alur_perkara_id = 16 "
        "AND (SELECT COUNT(*) FROM perkara_pihak1 a WHERE a.perkara_id = p.perkara_id) > 1",
    "PBT_tanggal_perintah_PHS_ke_putusan (beda tanggal)": "SELECT COUNT(*) FROM perkara_putusan u JOIN perkara_penetapan t ON t.perkara_id = u.perkara_id "
        "WHERE u.tanggal_putusan IS NOT NULL AND NOT (u.tanggal_putusan <=> t.penetapan_hari_sidang)",
    # 11209/11210: relaas kepada kuasa
    "relaas_kepada_kuasa_P (baris)": "SELECT COUNT(*) FROM perkara_pelaksanaan_relaas r WHERE r.pihak_id IN (SELECT k.pengacara_id FROM perkara_pengacara k WHERE k.perkara_id = r.perkara_id AND k.pihak_ke = 1)",
    "relaas_kepada_kuasa_T (baris)": "SELECT COUNT(*) FROM perkara_pelaksanaan_relaas r WHERE r.pihak_id IN (SELECT k.pengacara_id FROM perkara_pengacara k WHERE k.perkara_id = r.perkara_id AND k.pihak_ke = 2)",
    "11209_sidang_berubah_P": "SELECT COUNT(*) FROM (SELECT r.perkara_id, r.sidang_id, MAX(IF(r.pihak_id IN (SELECT a.pihak_id FROM perkara_pihak1 a WHERE a.perkara_id = r.perkara_id), r.tanggal_relaas, NULL)) l, "
                              "MAX(r.tanggal_relaas) b FROM perkara_pelaksanaan_relaas r WHERE r.tanggal_relaas > '1900-01-01' AND (r.pihak_id IN (SELECT a.pihak_id FROM perkara_pihak1 a WHERE a.perkara_id = r.perkara_id) "
                              "OR r.pihak_id IN (SELECT k.pengacara_id FROM perkara_pengacara k WHERE k.perkara_id = r.perkara_id AND k.pihak_ke = 1)) GROUP BY 1, 2) x WHERE NOT (x.l <=> x.b)",
    "11210_sidang_berubah_T": "SELECT COUNT(*) FROM (SELECT r.perkara_id, r.sidang_id, MAX(IF(r.pihak_id IN (SELECT a.pihak_id FROM perkara_pihak2 a WHERE a.perkara_id = r.perkara_id), r.tanggal_relaas, NULL)) l, "
                              "MAX(r.tanggal_relaas) b FROM perkara_pelaksanaan_relaas r WHERE r.tanggal_relaas > '1900-01-01' AND (r.pihak_id IN (SELECT a.pihak_id FROM perkara_pihak2 a WHERE a.perkara_id = r.perkara_id) "
                              "OR r.pihak_id IN (SELECT k.pengacara_id FROM perkara_pengacara k WHERE k.perkara_id = r.perkara_id AND k.pihak_ke = 2)) GROUP BY 1, 2) x WHERE NOT (x.l <=> x.b)",
    # 11202/11203
    "delegasi_keluar_perkara (PA tujuan dari SIPP)": "SELECT COUNT(DISTINCT perkara_id) FROM delegasi_keluar WHERE TRIM(pn_tujuan_text) LIKE 'PENGADILAN AGAMA %'",
}


def main():
    hasil = {}
    for k, q in Q.items():
        r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '-N', '--batch', DB, '-e', q], capture_output=True)
        if r.returncode:
            hasil[k] = 'GALAT ' + r.stderr.decode('latin1')[:200]
        else:
            t = r.stdout.decode('latin1').strip()
            hasil[k] = int(t) if t.isdigit() else t.split('\n')
        print(k, hasil[k], flush=True)
    json.dump(hasil, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


main()
