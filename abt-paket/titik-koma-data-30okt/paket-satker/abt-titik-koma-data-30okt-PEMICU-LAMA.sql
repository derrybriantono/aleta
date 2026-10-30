-- PULIH pemicu: persis seperti paket ket-saksi-baris-30okt (hanya ganti baris -> spasi).
DROP TRIGGER IF EXISTS `abt_keterangan_saksi_satu_baris_bi`;
DROP TRIGGER IF EXISTS `abt_keterangan_saksi_satu_baris_bu`;
DELIMITER ;;
CREATE DEFINER=CURRENT_USER TRIGGER `abt_keterangan_saksi_satu_baris_bi` BEFORE INSERT ON `abt_keterangan_saksi` FOR EACH ROW
BEGIN
  SET NEW.pertanyaan = isian_rtf_satu_baris(NEW.pertanyaan);
  SET NEW.jawaban = isian_rtf_satu_baris(NEW.jawaban);
END;;
CREATE DEFINER=CURRENT_USER TRIGGER `abt_keterangan_saksi_satu_baris_bu` BEFORE UPDATE ON `abt_keterangan_saksi` FOR EACH ROW
BEGIN
  SET NEW.pertanyaan = isian_rtf_satu_baris(NEW.pertanyaan);
  SET NEW.jawaban = isian_rtf_satu_baris(NEW.jawaban);
END;;
DELIMITER ;
