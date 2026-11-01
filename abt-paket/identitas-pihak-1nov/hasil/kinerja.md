# Kinerja (arahan Derry 1 Nov): render identitas pihak di ABT

ABT memecah SETIAP kemunculan penanda `#nnnn#` di kueri variabel (bukan per nomor) dan mengevaluasinya SEBELUM kueri jalan; variabel 7047/7048 memuat ±45 penanda masing-masing (nama, NIK, tempat/tanggal lahir,
agama, pendidikan, pekerjaan, alamat per pihak I-IV, ...). Kini 2 penanda (sebutan dan kalimat kuasa) + satu panggilan fungsi yang membaca semua pihak dalam satu kursor.

Ukuran (laptop, php56 ABT asli, basis salinan sendiri; berurutan, beban sama; `alat/jalan.py`):
| operasi | sebelum | sesudah |
|---|---|---|
| render hanya #7047# melawan #7048#, 34 perkara contoh (1-19 pihak, kuasa, ghoib, alamat diubah) | 173,3 dtk (5,1 dtk/perkara) | 5,5 dtk (0,16 dtk/perkara) - sekitar 31x lebih cepat |
| render 7 blangko sungguhan (acuan, kuasa, CT, itsbat, DK, BAS, sela), tiap satu perkara | 56,1 dtk | 26,1 dtk |
Variabel-variabel lain di blangko tidak diubah (sisa waktu blangko sungguhan berasal dari sana). Tanpa tabel/indeks baru; fungsi hanya MEMBACA (`perkara_pihak1/2`, `pihak`, `agama`, `tingkat_pendidikan`, `perkara`
menurut kunci perkara_id); tanpa N+1 (satu kursor per sisi, satu pembacaan tanggal pendaftaran).
