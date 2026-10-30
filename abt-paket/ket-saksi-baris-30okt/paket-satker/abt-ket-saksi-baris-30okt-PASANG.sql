-- Paket ABT "abt-ket-saksi-baris-30okt": rapikan data tersimpan (satu transaksi). Pemicu BEFORE UPDATE juga menerapkan
-- fungsi yang sama; kolom diperbaharui_* tidak disentuh.
START TRANSACTION;
UPDATE abt_keterangan_saksi
   SET pertanyaan = isian_rtf_satu_baris(pertanyaan), jawaban = isian_rtf_satu_baris(jawaban)
 WHERE LOCATE(CHAR(10), CONCAT(IFNULL(pertanyaan, ''), IFNULL(jawaban, ''))) > 0
    OR LOCATE(CHAR(13), CONCAT(IFNULL(pertanyaan, ''), IFNULL(jawaban, ''))) > 0;
COMMIT;
