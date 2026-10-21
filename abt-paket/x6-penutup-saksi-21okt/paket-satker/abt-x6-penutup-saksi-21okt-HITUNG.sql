-- Paket ABT "abt-x6-penutup-saksi-21okt": HITUNG (baca saja) = berapa kelompok saksi (perkara + saksi) yang keluaran isian_rtf_ket_saksi-nya memuat
-- butir kalimat penutup ("- Bahwa sudah cukup;", "cukup sekian", "tidak ada lagi ...", "sampai di sini"). Sebelum paket > 0, sesudah 0.
-- Detektor ini kasar dan berdiri sendiri (bukan pola penyaring); bentuk "tidak sanggup lagi" tidak dihitung (keterangan perkara
-- bila pertanyaannya soal mendamaikan).
SELECT COUNT(*) AS kelompok_memuat_penutup
FROM (SELECT DISTINCT perkara_id, saksi_id FROM abt_keterangan_saksi
       WHERE perkara_id IS NOT NULL AND saksi_id IS NOT NULL
         AND (jawaban LIKE '%cukup%' OR jawaban LIKE '%sekian%' OR jawaban LIKE '%tidak ada%' OR jawaban LIKE '%sampai di sini%')) g
WHERE isian_rtf_ket_saksi(g.perkara_id, CAST(g.saksi_id AS CHAR))
      REGEXP '(^|<br>)-   Bahwa ((tidak ada|tidak|ya|iya|baik), )?((saya|saksi) )?((sudah|telah|memang|sekarang) )*(cukup|sekian|tidak ada lagi|sampai di sini)( sekian| saja| dulu)*[ ;.,]*(<br>|$)';
