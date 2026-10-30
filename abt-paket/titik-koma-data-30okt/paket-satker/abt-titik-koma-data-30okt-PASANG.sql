-- Paket ABT "abt-titik-koma-data-30okt": rapikan jawaban tersimpan yang titik komanya di tengah/ganda (satu transaksi).
-- Aturan = isian_rtf_butir_rapi(jawaban, '') (sama dengan perangkai putusan dan panel); ujung jawaban tidak ditambah.
-- Pertanyaan tidak disentuh (0 baris di dump 28 Okt). Kolom diperbaharui_* tidak disentuh.
START TRANSACTION;
UPDATE abt_keterangan_saksi
   SET jawaban = isian_rtf_butir_rapi(jawaban, '')
 WHERE REPLACE(REPLACE(jawaban, CHAR(10), ' '), CHAR(13), ' ') REGEXP ';.*[[:alnum:]]|;[[:space:]]*;|^[[:space:]]*;|:[[:space:]]*;' AND jawaban LIKE '%;%'
   AND CHAR_LENGTH(jawaban) - CHAR_LENGTH(REPLACE(jawaban, ';', '')) > CHAR_LENGTH(isian_rtf_butir_rapi(jawaban, '')) - CHAR_LENGTH(REPLACE(isian_rtf_butir_rapi(jawaban, ''), ';', ''));
COMMIT;
