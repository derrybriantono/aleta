-- Paket ABT "abt-titik-koma-data-30okt": pemicu jawaban baru ikut dirapikan (titik koma di tengah jadi koma, tanda baca ganda,
-- spasi) - aturan isian_rtf_butir_rapi = perapi panel (rapiButir). Nama pemicu SAMA dengan paket ket-saksi-baris-30okt
-- (MariaDB 5.5: satu pemicu per waktu/peristiwa), badannya diperluas: ganti baris -> spasi tetap, lalu jawaban dirapikan.
DROP TRIGGER IF EXISTS `abt_keterangan_saksi_satu_baris_bi`;
DROP TRIGGER IF EXISTS `abt_keterangan_saksi_satu_baris_bu`;
DELIMITER ;;
CREATE DEFINER=CURRENT_USER TRIGGER `abt_keterangan_saksi_satu_baris_bi` BEFORE INSERT ON `abt_keterangan_saksi` FOR EACH ROW
BEGIN
  SET NEW.pertanyaan = isian_rtf_satu_baris(NEW.pertanyaan);
  SET NEW.jawaban = isian_rtf_butir_rapi(isian_rtf_satu_baris(NEW.jawaban), '');
END;;
CREATE DEFINER=CURRENT_USER TRIGGER `abt_keterangan_saksi_satu_baris_bu` BEFORE UPDATE ON `abt_keterangan_saksi` FOR EACH ROW
BEGIN
  SET NEW.pertanyaan = isian_rtf_satu_baris(NEW.pertanyaan);
  SET NEW.jawaban = isian_rtf_butir_rapi(isian_rtf_satu_baris(NEW.jawaban), '');
END;;
DELIMITER ;
