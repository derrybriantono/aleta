-- =====================================================================================================
-- PS (28 Okt 2026): peringkat satu pihak dalam tabelnya (urut urutan, id). Pendaftaran e-Court menomori kolom urutan BERSAMBUNG lintas tabel
-- (perkara 656/Pdt.G/2026/PA.Dgl: Tergugat tunggal berurutan 25), sehingga kueri variabel yang memilih "pihak ke-N" dengan urutan = N salah memilih atau kosong.
-- Variabel yang diubah paket ini memanggil isian_rtf_pihak_peringkat(tabel, id) sebagai ganti kolom urutan: nilainya 1 untuk pihak pertama, 2 untuk kedua, dst.
-- Perkara yang urutannya mulai 1 dan rapat: peringkat = urutan, keluaran SAMA PERSIS dengan kueri lama.
-- Satu fungsi baru. Hanya MEMBACA SIPP.perkara_pihak1/2/3/4. Nama basis SIPP tertulis "SIPP" (di laptop pasang-satker.sh menggantinya). Komentar fungsi berawalan "PS:".
-- Catatan: klien mysql membuang komentar "--" di dalam badan fungsi (md5 definisi dihitung tanpa komentar), maka tidak ada komentar di badan.
-- Ditulis untuk MariaDB 5.5 (tanpa fitur 10.x). Tabel tak dikenal atau id tak ada: hasil NULL (kondisi "= N" tidak pernah benar, sama seperti baris yang tidak ada).
-- =====================================================================================================
DELIMITER $$

DROP FUNCTION IF EXISTS isian_rtf_pihak_peringkat$$
CREATE FUNCTION isian_rtf_pihak_peringkat(p_tabel INT, p_id BIGINT) RETURNS INT
  READS SQL DATA SQL SECURITY INVOKER COMMENT 'PS: peringkat satu pihak dalam perkaranya (urut urutan lalu id; 1 = pihak pertama) pada tabel 1 = perkara_pihak1, 2 = perkara_pihak2, 3 = perkara_pihak3, 4 = perkara_pihak4; NULL bila tidak ada'
BEGIN
  DECLARE v_perkara BIGINT DEFAULT NULL;
  DECLARE v_urutan INT DEFAULT 0;
  DECLARE v_n INT DEFAULT 0;
  IF p_tabel IS NULL OR p_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF p_tabel = 1 THEN
    SELECT perkara_id, IFNULL(urutan, 0) INTO v_perkara, v_urutan FROM SIPP.perkara_pihak1 WHERE id = p_id;
    IF v_perkara IS NULL THEN
      RETURN NULL;
    END IF;
    SELECT COUNT(*) INTO v_n FROM SIPP.perkara_pihak1 WHERE perkara_id = v_perkara AND (IFNULL(urutan, 0) < v_urutan OR (IFNULL(urutan, 0) = v_urutan AND id < p_id));
  ELSEIF p_tabel = 2 THEN
    SELECT perkara_id, IFNULL(urutan, 0) INTO v_perkara, v_urutan FROM SIPP.perkara_pihak2 WHERE id = p_id;
    IF v_perkara IS NULL THEN
      RETURN NULL;
    END IF;
    SELECT COUNT(*) INTO v_n FROM SIPP.perkara_pihak2 WHERE perkara_id = v_perkara AND (IFNULL(urutan, 0) < v_urutan OR (IFNULL(urutan, 0) = v_urutan AND id < p_id));
  ELSEIF p_tabel = 3 THEN
    SELECT perkara_id, IFNULL(urutan, 0) INTO v_perkara, v_urutan FROM SIPP.perkara_pihak3 WHERE id = p_id;
    IF v_perkara IS NULL THEN
      RETURN NULL;
    END IF;
    SELECT COUNT(*) INTO v_n FROM SIPP.perkara_pihak3 WHERE perkara_id = v_perkara AND (IFNULL(urutan, 0) < v_urutan OR (IFNULL(urutan, 0) = v_urutan AND id < p_id));
  ELSEIF p_tabel = 4 THEN
    SELECT perkara_id, IFNULL(urutan, 0) INTO v_perkara, v_urutan FROM SIPP.perkara_pihak4 WHERE id = p_id;
    IF v_perkara IS NULL THEN
      RETURN NULL;
    END IF;
    SELECT COUNT(*) INTO v_n FROM SIPP.perkara_pihak4 WHERE perkara_id = v_perkara AND (IFNULL(urutan, 0) < v_urutan OR (IFNULL(urutan, 0) = v_urutan AND id < p_id));
  ELSE
    RETURN NULL;
  END IF;
  RETURN v_n + 1;
END$$

DELIMITER ;
