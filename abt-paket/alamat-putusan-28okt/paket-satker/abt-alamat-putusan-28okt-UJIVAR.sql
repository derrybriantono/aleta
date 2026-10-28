-- Paket ABT "abt-alamat-putusan-28okt" (28 Okt 2026): keterangan arah di dalam KURUNG pada alamat pihak dibuang di PUTUSAN (relaas tetap utuh). 6 variabel diubah (7047, 7048, 8700, 8890, 9349, 9350), 2 fungsi paket 27 Okt diganti, 3 fungsi baru (AP).
-- Prasyarat: paket pihak-urut-ecourt-27okt dan pihak-urut-sisa-28okt sudah terpasang.
-- UJIVAR: kueri baru tiap variabel diubah dijalankan pasang-satker.sh atas beberapa perkara contoh (@pid diisi skrip; rujukan #NNNN# = 0). Hanya memeriksa kueri berjalan tanpa galat.
SELECT 7047 AS no_var, COUNT(*) AS baris FROM (SELECT 
    CASE 
        WHEN COALESCE(p1.rapat, 0) = 0 THEN aps_badilag.isian_rtf_pihak_identitas(@pid, 1, "0", "tempat kediaman di", IFNULL(NULLIF(TRIM((SELECT CONVERT(REPLACE(t.data, '"', '') USING utf8) FROM aps_badilag.abt_data_teks t WHERE t.perkara_id = @pid AND t.no_var = 8548 LIMIT 1)), ''), ''), "0")
        WHEN p1.urutan = 1 THEN
            CASE
                WHEN EXISTS (
                    SELECT 1 FROM perkara WHERE perkara_id = @pid AND "0" != ""
                ) THEN 
                    CONCAT(
                        CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pendidikan 0, pekerjaan 0, tempat kediaman di ", IFNULL(NULLIF(TRIM((SELECT CONVERT(REPLACE(t.data, '"', '') USING utf8) FROM aps_badilag.abt_data_teks t WHERE t.perkara_id = @pid AND t.no_var = 8548 LIMIT 1)), ''), aps_badilag.isian_rtf_alamat_putusan("0")), ", dalam hal ini 0, sebagai <strong>0</strong>;")
                    )
                ELSE 
                    CONCAT(
                        CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, tempat kediaman di ", IFNULL(NULLIF(TRIM((SELECT CONVERT(REPLACE(t.data, '"', '') USING utf8) FROM aps_badilag.abt_data_teks t WHERE t.perkara_id = @pid AND t.no_var = 8548 LIMIT 1)), ''), aps_badilag.isian_rtf_alamat_putusan("0")), ", sebagai <strong>0</strong>;")
                    )
            END
        WHEN p1.urutan = 2 THEN 
            CASE
                WHEN EXISTS (
                    SELECT 1 FROM perkara WHERE perkara_id = @pid AND "0" != ""
                ) THEN 
                    CONCAT(
                        CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pendidikan 0, pekerjaan 0, tempat kediaman di ", IFNULL(NULLIF(TRIM((SELECT CONVERT(REPLACE(t.data, '"', '') USING utf8) FROM aps_badilag.abt_data_teks t WHERE t.perkara_id = @pid AND t.no_var = 8548 LIMIT 1)), ''), aps_badilag.isian_rtf_alamat_putusan("0")), CONCAT(", sebagai <strong>0 I</strong>;<br><strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, tempat kediaman di ", aps_badilag.isian_rtf_alamat_putusan("0"), ", sebagai <strong>0 II</strong>;<br>Dalam hal ini 0 I dan 0 II 0, selanjutnya disebut sebagai <strong>0</strong>;"))
                    )
                ELSE 
                    CONCAT(
                        CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, tempat kediaman di ", IFNULL(NULLIF(TRIM((SELECT CONVERT(REPLACE(t.data, '"', '') USING utf8) FROM aps_badilag.abt_data_teks t WHERE t.perkara_id = @pid AND t.no_var = 8548 LIMIT 1)), ''), aps_badilag.isian_rtf_alamat_putusan("0")), CONCAT(", sebagai <strong>0 I</strong>;<br><strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, tempat kediaman di ", aps_badilag.isian_rtf_alamat_putusan("0"), ", sebagai <strong>0 II</strong>;"))
                    )
            END
        WHEN p1.urutan = 3 THEN 
            CASE
                WHEN EXISTS (
                    SELECT 1 FROM perkara WHERE perkara_id = @pid AND "0" != ""
                ) THEN 
                    CONCAT(
                        CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pendidikan 0, pekerjaan 0, tempat kediaman di ", IFNULL(NULLIF(TRIM((SELECT CONVERT(REPLACE(t.data, '"', '') USING utf8) FROM aps_badilag.abt_data_teks t WHERE t.perkara_id = @pid AND t.no_var = 8548 LIMIT 1)), ''), aps_badilag.isian_rtf_alamat_putusan("0")), CONCAT(", sebagai <strong>0 I</strong>;<br><strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, tempat kediaman di ", aps_badilag.isian_rtf_alamat_putusan("0"), ", sebagai <strong>0 II</strong>;<br><strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, tempat kediaman di ", aps_badilag.isian_rtf_alamat_putusan("0"), ", sebagai <strong>0 III</strong>;<br>Dalam hal ini 0 I, 0 II dan 0 III 0, selanjutnya disebut sebagai <strong>0</strong>;"))
                    )
                ELSE 
                    CONCAT(
                        CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, tempat kediaman di ", IFNULL(NULLIF(TRIM((SELECT CONVERT(REPLACE(t.data, '"', '') USING utf8) FROM aps_badilag.abt_data_teks t WHERE t.perkara_id = @pid AND t.no_var = 8548 LIMIT 1)), ''), aps_badilag.isian_rtf_alamat_putusan("0")), CONCAT(", sebagai <strong>0 I</strong>;<br><strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, tempat kediaman di ", aps_badilag.isian_rtf_alamat_putusan("0"), ", sebagai <strong>0 II</strong>;<br><strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, tempat kediaman di ", aps_badilag.isian_rtf_alamat_putusan("0"), ", sebagai <strong>0 III</strong>;"))
                    )
            END
        WHEN p1.urutan = 4 THEN 
            CASE
                WHEN EXISTS (
                    SELECT 1 FROM perkara WHERE perkara_id = @pid AND "0" != ""
                ) THEN 
                    CONCAT(
                        CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, tempat kediaman di ", IFNULL(NULLIF(TRIM((SELECT CONVERT(REPLACE(t.data, '"', '') USING utf8) FROM aps_badilag.abt_data_teks t WHERE t.perkara_id = @pid AND t.no_var = 8548 LIMIT 1)), ''), aps_badilag.isian_rtf_alamat_putusan("0")), CONCAT(", sebagai <strong>0 I</strong>;<br><strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, tempat kediaman di ", aps_badilag.isian_rtf_alamat_putusan("0"), ", sebagai <strong>0 II</strong>;<br><strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, tempat kediaman di ", aps_badilag.isian_rtf_alamat_putusan("0"), ", sebagai <strong>0 III</strong>;<br><strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, tempat kediaman di ", aps_badilag.isian_rtf_alamat_putusan("0"), ", sebagai <strong>0 IV</strong>;<br>Dalam hal ini 0 I, 0 II, 0 III dan 0 IV 0, selanjutnya disebut sebagai <strong>0</strong>;"))
                    )
                ELSE 
                    CONCAT(
                        CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, tempat kediaman di ", IFNULL(NULLIF(TRIM((SELECT CONVERT(REPLACE(t.data, '"', '') USING utf8) FROM aps_badilag.abt_data_teks t WHERE t.perkara_id = @pid AND t.no_var = 8548 LIMIT 1)), ''), aps_badilag.isian_rtf_alamat_putusan("0")), CONCAT(", sebagai <strong>0 I</strong>;<br><strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, tempat kediaman di ", aps_badilag.isian_rtf_alamat_putusan("0"), ", sebagai <strong>0 II</strong>;<br><strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, tempat kediaman di ", aps_badilag.isian_rtf_alamat_putusan("0"), ", sebagai <strong>0 III</strong>;<br><strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, tempat kediaman di ", aps_badilag.isian_rtf_alamat_putusan("0"), ", sebagai <strong>0 IV</strong>;"))
                    )
            END
        --  (lanjutkan pola yang sama untuk urutan?5?s.d.?10)            
        WHEN p1.urutan >= 5 THEN
            CONCAT(
                CONCAT(
                        CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, tempat kediaman di ", IFNULL(NULLIF(TRIM((SELECT CONVERT(REPLACE(t.data, '"', '') USING utf8) FROM aps_badilag.abt_data_teks t WHERE t.perkara_id = @pid AND t.no_var = 8548 LIMIT 1)), ''), aps_badilag.isian_rtf_alamat_putusan("0")), CONCAT(", sebagai <strong>0 I</strong>;<br><strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, tempat kediaman di ", aps_badilag.isian_rtf_alamat_putusan("0"), ", sebagai <strong>0 II</strong>;<br><strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, tempat kediaman di ", aps_badilag.isian_rtf_alamat_putusan("0"), ", sebagai <strong>0 III</strong>;<br><strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, tempat kediaman di ", aps_badilag.isian_rtf_alamat_putusan("0"), ", sebagai <strong>0 IV</strong>;"))
                    ),
                "<br>",
                "0",
                IF(EXISTS (SELECT 1 FROM perkara WHERE perkara_id = @pid AND "0" != ""), "<br>Dalam hal ini 0 0, selanjutnya disebut sebagai <strong>0</strong>;", "")
            )
        ELSE ""
    END AS data
FROM (
    SELECT perkara_id, MAX(urutan) AS urutan, (MIN(urutan) = 1 AND MAX(urutan) = COUNT(*) AND COUNT(DISTINCT urutan) = COUNT(*)) AS rapat
    FROM perkara_pihak1
    WHERE perkara_id = @pid
    GROUP BY perkara_id
) p1) AS uji_7047;
SELECT 7048 AS no_var, COUNT(*) AS baris FROM (SELECT 
    CASE
        WHEN COALESCE(p1.rapat, 0) = 0 THEN aps_badilag.isian_rtf_pihak_identitas(@pid, 2, "0", "tempat kediaman di", IFNULL(NULLIF(TRIM((SELECT CONVERT(REPLACE(t.data, '"', '') USING utf8) FROM aps_badilag.abt_data_teks t WHERE t.perkara_id = @pid AND t.no_var = 8549 LIMIT 1)), ''), ''), "0")
        WHEN COALESCE(p1.urutan, 0) = 1 AND EXISTS (
            SELECT 1 
            FROM perkara 
            WHERE perkara_id = @pid AND "0" != ""
        ) THEN
            CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir (umur) 0, 0 (0 tahun), agama 0, pendidikan 0, pekerjaan 0, tempat kediaman di ", IFNULL(NULLIF(TRIM((SELECT CONVERT(REPLACE(t.data, '"', '') USING utf8) FROM aps_badilag.abt_data_teks t WHERE t.perkara_id = @pid AND t.no_var = 8549 LIMIT 1)), ''), aps_badilag.isian_rtf_alamat_putusan("0")), ", dalam hal ini 0, sebagai <strong>0</strong>;")
        
        WHEN COALESCE(p1.urutan, 0) = 1 THEN
            CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, 0 ", IFNULL(NULLIF(TRIM((SELECT CONVERT(REPLACE(t.data, '"', '') USING utf8) FROM aps_badilag.abt_data_teks t WHERE t.perkara_id = @pid AND t.no_var = 8549 LIMIT 1)), ''), aps_badilag.isian_rtf_alamat_putusan("0")), ", sebagai <strong>0;</strong>")
             
        WHEN COALESCE(p1.urutan, 0) = 2 AND EXISTS (
            SELECT 1 
            FROM perkara 
            WHERE perkara_id = @pid AND "0" != ""
        ) THEN 
            CONCAT(
                CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, 0 ", IFNULL(NULLIF(TRIM((SELECT CONVERT(REPLACE(t.data, '"', '') USING utf8) FROM aps_badilag.abt_data_teks t WHERE t.perkara_id = @pid AND t.no_var = 8549 LIMIT 1)), ''), aps_badilag.isian_rtf_alamat_putusan("0")), ", sebagai <strong>0 I</strong>;<br>"),
                "Dalam hal ini 0 I dan 0 II 0, sebagai <strong>0</strong>;"
            )

        WHEN COALESCE(p1.urutan, 0) = 2 THEN 
            CONCAT(
                CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, 0 ", IFNULL(NULLIF(TRIM((SELECT CONVERT(REPLACE(t.data, '"', '') USING utf8) FROM aps_badilag.abt_data_teks t WHERE t.perkara_id = @pid AND t.no_var = 8549 LIMIT 1)), ''), aps_badilag.isian_rtf_alamat_putusan("0")), ", sebagai <strong>0 I</strong>;<br>")
            )

        WHEN COALESCE(p1.urutan, 0) = 3 AND EXISTS (
            SELECT 1 
            FROM perkara 
            WHERE perkara_id = @pid AND "0" != ""
        ) THEN 
            CONCAT(
                CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, 0 ", IFNULL(NULLIF(TRIM((SELECT CONVERT(REPLACE(t.data, '"', '') USING utf8) FROM aps_badilag.abt_data_teks t WHERE t.perkara_id = @pid AND t.no_var = 8549 LIMIT 1)), ''), aps_badilag.isian_rtf_alamat_putusan("0")), ", sebagai <strong>0 I</strong>;<br>"),
                "<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, 0 0, sebagai <strong>0 II</strong>;<br>",
                "Dalam hal ini 0 I, 0 II dan 0 III 0, sebagai <strong>0</strong>;"
            )

        WHEN COALESCE(p1.urutan, 0) = 3 THEN 
            CONCAT(
                CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, 0 ", IFNULL(NULLIF(TRIM((SELECT CONVERT(REPLACE(t.data, '"', '') USING utf8) FROM aps_badilag.abt_data_teks t WHERE t.perkara_id = @pid AND t.no_var = 8549 LIMIT 1)), ''), aps_badilag.isian_rtf_alamat_putusan("0")), ", sebagai <strong>0 I</strong>;<br>"),
                "<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, 0 0, sebagai <strong>0 II</strong>;<br>"
            )

        WHEN COALESCE(p1.urutan, 0) = 4 AND EXISTS (
            SELECT 1 
            FROM perkara 
            WHERE perkara_id = @pid AND "0" != ""
        ) THEN 
            CONCAT(
                CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, 0 ", IFNULL(NULLIF(TRIM((SELECT CONVERT(REPLACE(t.data, '"', '') USING utf8) FROM aps_badilag.abt_data_teks t WHERE t.perkara_id = @pid AND t.no_var = 8549 LIMIT 1)), ''), aps_badilag.isian_rtf_alamat_putusan("0")), ", sebagai <strong>0 I</strong>;<br>"),
                "<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, 0 0, sebagai <strong>0 II</strong>;<br>",
                CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, 0 ", aps_badilag.isian_rtf_alamat_putusan("0"), ", sebagai <strong>0 III</strong>;<br>"),
                CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, 0 ", aps_badilag.isian_rtf_alamat_putusan("0"), ", sebagai <strong>0 IV</strong>;<br>"),
                "Dalam hal ini 0 I, 0 II, 0 III dan 0 IV 0, sebagai <strong>0</strong>;"
            )

        WHEN COALESCE(p1.urutan, 0) = 4 THEN 
            CONCAT(
                CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, 0 ", IFNULL(NULLIF(TRIM((SELECT CONVERT(REPLACE(t.data, '"', '') USING utf8) FROM aps_badilag.abt_data_teks t WHERE t.perkara_id = @pid AND t.no_var = 8549 LIMIT 1)), ''), aps_badilag.isian_rtf_alamat_putusan("0")), ", sebagai <strong>0 I</strong>;<br>"),
                "<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, 0 0, sebagai <strong>0 II</strong>;<br>",
                CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, 0 ", aps_badilag.isian_rtf_alamat_putusan("0"), ", sebagai <strong>0 III</strong>;<br>"),
                CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, 0 ", aps_badilag.isian_rtf_alamat_putusan("0"), ", sebagai <strong>0 IV</strong>;<br>")
            )

        WHEN COALESCE(p1.urutan, 0) = 5 AND EXISTS (
            SELECT 1 
            FROM perkara 
            WHERE perkara_id = @pid AND "0" != ""
        ) THEN 
            CONCAT(
                CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, 0 ", IFNULL(NULLIF(TRIM((SELECT CONVERT(REPLACE(t.data, '"', '') USING utf8) FROM aps_badilag.abt_data_teks t WHERE t.perkara_id = @pid AND t.no_var = 8549 LIMIT 1)), ''), aps_badilag.isian_rtf_alamat_putusan("0")), ", sebagai <strong>0 I</strong>;<br>"),
                "<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, 0 0, sebagai <strong>0 II</strong>;<br>",
                CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, 0 ", aps_badilag.isian_rtf_alamat_putusan("0"), ", sebagai <strong>0 III</strong>;<br>"),
                CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, 0 ", aps_badilag.isian_rtf_alamat_putusan("0"), ", sebagai <strong>0 IV</strong>;<br>"),
                "Dalam hal ini 0 I, 0 II, 0 III, 0 IV dan 0 V 0, sebagai <strong>0</strong>;"
            )

        WHEN COALESCE(p1.urutan, 0) = 5 THEN 
            CONCAT(
                CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, 0 ", IFNULL(NULLIF(TRIM((SELECT CONVERT(REPLACE(t.data, '"', '') USING utf8) FROM aps_badilag.abt_data_teks t WHERE t.perkara_id = @pid AND t.no_var = 8549 LIMIT 1)), ''), aps_badilag.isian_rtf_alamat_putusan("0")), ", sebagai <strong>0 I</strong>;<br>"),
                "<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, 0 0, sebagai <strong>0 II</strong>;<br>",
                CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, 0 ", aps_badilag.isian_rtf_alamat_putusan("0"), ", sebagai <strong>0 III</strong>;<br>"),
                CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, 0 ", aps_badilag.isian_rtf_alamat_putusan("0"), ", sebagai <strong>0 IV</strong>;<br>"),
                CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, 0 ", aps_badilag.isian_rtf_alamat_putusan("0"), ", sebagai <strong>0 V</strong>;")
            )

        WHEN COALESCE(p1.urutan, 0) >= 6 THEN
            CONCAT(
                CONCAT(
                CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, 0 ", IFNULL(NULLIF(TRIM((SELECT CONVERT(REPLACE(t.data, '"', '') USING utf8) FROM aps_badilag.abt_data_teks t WHERE t.perkara_id = @pid AND t.no_var = 8549 LIMIT 1)), ''), aps_badilag.isian_rtf_alamat_putusan("0")), ", sebagai <strong>0 I</strong>;<br>"),
                "<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, 0 0, sebagai <strong>0 II</strong>;<br>",
                CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, 0 ", aps_badilag.isian_rtf_alamat_putusan("0"), ", sebagai <strong>0 III</strong>;<br>"),
                CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, 0 ", aps_badilag.isian_rtf_alamat_putusan("0"), ", sebagai <strong>0 IV</strong>;<br>"),
                CONCAT("<strong>0</strong>, NIK 0, tempat dan tanggal lahir 0, 0, agama 0, pekerjaan 0, pendidikan 0, 0 ", aps_badilag.isian_rtf_alamat_putusan("0"), ", sebagai <strong>0 V</strong>;")
            ),
                "<br>",
                "0",
                IF(EXISTS (SELECT 1 FROM perkara WHERE perkara_id = @pid AND "0" != ""), "<br>Dalam hal ini 0 0, sebagai <strong>0</strong>;", "")
            )
        ELSE ""
    END AS data
FROM (
    SELECT COALESCE(pp.urutan, 0) AS urutan, pp.rapat AS rapat
    FROM (SELECT 1) AS single
    LEFT JOIN (
        SELECT MAX(urutan) AS urutan, (MIN(urutan) = 1 AND MAX(urutan) = COUNT(*) AND COUNT(DISTINCT urutan) = COUNT(*)) AS rapat
        FROM perkara_pihak2
        WHERE perkara_id = @pid
        GROUP BY perkara_id
    ) AS pp ON 1 = 1
) p1) AS uji_7048;
SELECT 8700 AS no_var, COUNT(*) AS baris FROM (SELECT CASE WHEN p.jenis_perkara_id = 346 THEN CONCAT("Menimbang, bahwa 0 bertempat kediaman di ", IFNULL(CONVERT(aps_badilag.isian_rtf_alamat_putusan((SELECT x.alamat FROM perkara_pihak2 x WHERE x.perkara_id=p.perkara_id ORDER BY x.urutan LIMIT 1)) USING utf8),''), ", yang termasuk wilayah hukum 0. Berdasarkan Pasal 66 ayat (2) Undang-Undang Nomor 7 Tahun 1989 sebagaimana telah diubah terakhir dengan Undang-Undang Nomor 50 Tahun 2009, permohonan cerai talak diajukan kepada Pengadilan yang daerah hukumnya meliputi tempat kediaman Termohon. Dengan demikian 0 berwenang secara relatif memeriksa dan mengadili perkara <i>a quo</i>;") ELSE CONCAT("Menimbang, bahwa 0 bertempat kediaman di ", IFNULL(CONVERT(aps_badilag.isian_rtf_alamat_putusan((SELECT x.alamat FROM perkara_pihak1 x WHERE x.perkara_id=p.perkara_id ORDER BY x.urutan LIMIT 1)) USING utf8),''), ", yang termasuk wilayah hukum 0. Berdasarkan Pasal 73 ayat (1) Undang-Undang Nomor 7 Tahun 1989 sebagaimana telah diubah terakhir dengan Undang-Undang Nomor 50 Tahun 2009, gugatan perceraian diajukan oleh istri atau kuasanya kepada Pengadilan yang daerah hukumnya meliputi tempat kediaman penggugat. Dengan demikian 0 berwenang secara relatif memeriksa dan mengadili perkara <i>a quo</i>;") END AS data FROM perkara p WHERE p.perkara_id = @pid) AS uji_8700;
SELECT 8890 AS no_var, COUNT(*) AS baris FROM (SELECT CASE WHEN p.jenis_perkara_id <> 346 THEN CONCAT("Menimbang, bahwa berdasarkan relaas panggilan nomor: 0 terbukti bahwa 0 bertempat tinggal di wilayah ", aps_badilag.isian_rtf_alamat_putusan("0"), " yang merupakan wilayah hukum 0, sebagaimana ketentuan Pasal 73 ayat (1) Undang-Undang Nomor 7 Tahun 1989 yang sudah diubah dengan Undang-Undang Nomor 3 tahun 2006 dan Undang-Undang Nomor 50 Tahun 2009 tentang Peradilan Agama, maka 0 telah tepat mengajukan perkaranya di 0;") WHEN IFNULL(t.kab, '') = '' OR EXISTS (SELECT 1 FROM perkara z JOIN perkara_pihak1 zp ON zp.perkara_id = z.perkara_id AND aps_badilag.isian_rtf_pihak_peringkat(1, zp.id) = 1 JOIN pihak zh ON zh.id = zp.pihak_id WHERE z.jenis_perkara_id = 347 AND zh.kabupaten = t.kab) THEN CONCAT("Menimbang, bahwa berdasarkan relaas panggilan nomor: 0 terbukti bahwa 0 bertempat tinggal di wilayah ", aps_badilag.isian_rtf_alamat_putusan("0"), " yang merupakan wilayah hukum 0, sebagaimana ketentuan Pasal 66 ayat (2) Undang-Undang Nomor 7 Tahun 1989 yang sudah diubah dengan Undang-Undang Nomor 3 tahun 2006 dan Undang-Undang Nomor 50 Tahun 2009 tentang Peradilan Agama, maka 0 telah tepat mengajukan perkaranya di 0;") ELSE CONCAT("[PERIKSA: menurut SIPP 0 bertempat tinggal di luar wilayah hukum 0; uraikan dasar pengecualian Pasal 66 ayat (2)/(3)] Menimbang, bahwa berdasarkan relaas panggilan nomor: 0 terbukti bahwa 0 bertempat tinggal di wilayah ", aps_badilag.isian_rtf_alamat_putusan("0"), " yang merupakan wilayah hukum 0, sebagaimana ketentuan Pasal 66 ayat (2) Undang-Undang Nomor 7 Tahun 1989 yang sudah diubah dengan Undang-Undang Nomor 3 tahun 2006 dan Undang-Undang Nomor 50 Tahun 2009 tentang Peradilan Agama, maka 0 telah tepat mengajukan perkaranya di 0;") END AS data FROM perkara p LEFT JOIN (SELECT x.perkara_id, MAX(y.kabupaten) AS kab FROM perkara_pihak2 x JOIN pihak y ON y.id = x.pihak_id WHERE x.perkara_id = @pid AND aps_badilag.isian_rtf_pihak_peringkat(2, x.id) = 1 GROUP BY x.perkara_id) t ON t.perkara_id = p.perkara_id WHERE p.perkara_id = @pid) AS uji_8890;
SELECT 9349 AS no_var, COUNT(*) AS baris FROM (SELECT IF(IFNULL(b.jenis_pihak_id, 1) <> 1, CONCAT('<strong>', TRIM(CONVERT(p.nama USING utf8)), '</strong>, berkedudukan di ', TRIM(CONVERT(aps_badilag.isian_rtf_alamat_putusan(IFNULL(NULLIF(TRIM(p.alamat), ''), b.alamat)) USING utf8)), IF(IFNULL((SELECT TRIM(CONVERT(t.data USING utf8)) FROM aps_badilag.abt_data_teks t WHERE t.no_var = 9347 AND t.perkara_id = @pid LIMIT 1), '') NOT IN ('', '...', '-'), CONCAT(', dalam hal ini diwakili oleh ', IFNULL((SELECT TRIM(CONVERT(t.data USING utf8)) FROM aps_badilag.abt_data_teks t WHERE t.no_var = 9347 AND t.perkara_id = @pid LIMIT 1), '')), IF("0" <> '', CONCAT(', dalam hal ini ', "0"), '')), ', sebagai <strong>0</strong>;'), "0") AS data FROM perkara_pihak1 p LEFT JOIN pihak b ON b.id = p.pihak_id WHERE p.perkara_id = @pid ORDER BY p.urutan LIMIT 1) AS uji_9349;
SELECT 9350 AS no_var, COUNT(*) AS baris FROM (SELECT IF(IFNULL(b.jenis_pihak_id, 1) <> 1, CONCAT('<strong>', TRIM(CONVERT(p.nama USING utf8)), '</strong>, berkedudukan di ', TRIM(CONVERT(aps_badilag.isian_rtf_alamat_putusan(IFNULL(NULLIF(TRIM(p.alamat), ''), b.alamat)) USING utf8)), IF(IFNULL((SELECT TRIM(CONVERT(t.data USING utf8)) FROM aps_badilag.abt_data_teks t WHERE t.no_var = 9348 AND t.perkara_id = @pid LIMIT 1), '') NOT IN ('', '...', '-'), CONCAT(', dalam hal ini diwakili oleh ', IFNULL((SELECT TRIM(CONVERT(t.data USING utf8)) FROM aps_badilag.abt_data_teks t WHERE t.no_var = 9348 AND t.perkara_id = @pid LIMIT 1), '')), ''), ', sebagai <strong>0</strong>;'), "0") AS data FROM perkara_pihak2 p LEFT JOIN pihak b ON b.id = p.pihak_id WHERE p.perkara_id = @pid ORDER BY p.urutan LIMIT 1) AS uji_9350;
