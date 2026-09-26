import type { Cermin } from "@/lib/tipe-keluaran/kontrak";

/**
 * ============================================================================
 * CERMIN BAWAAN TIGA DAFTAR ALASAN (K10) - disalin PERSIS dari bot
 * ============================================================================
 *
 * Sumber: aleta_bot/services/abtUsulanService.js cerminAlasan(), yang membaca
 *   CIRI_ALASAN (satu baris satu entri)        -> putusan.alasan.ciri
 *   abtKalimatBaku.KALIMAT.frasaCiri            -> bersama.alasan.frasa
 *   abtKalimatBaku.KALIMAT.upayaDamai           -> putusan.upaya-damai.bunyi
 *
 * Pemiliknya t1-deteksi-saksi-bot. Uji tipe-keluaran-cermin-alasan.test.ts
 * me-require modul bot sungguhan dan menuntut cermin ini deep-equal dengan
 * cerminAlasan(); bila salah satu diubah tanpa yang lain, ujinya merah.
 *
 * BENTUK YANG DIPILIH, dan sebabnya:
 *
 *   ciri       kunci = kunci ciri, nilai = kata digabung ' + ', data {kata}.
 *              Satu kunci boleh punya banyak baris - satu baris satu BUNYI,
 *              dan semua kata sebaris harus muncul dalam SATU kalimat.
 *
 *   frasa      kunci = kunci ciri, nilai = frasa berpenanda {pelaku}/{lawan},
 *              data {urutan, akibat?, setara?}. 'urutan' = letaknya di dalam
 *              kalimat 5227; 'akibat' = bukan perbuatan, menjadi keterangan
 *              penutup; 'setara' = bunyi sepadan dari korpus saksi manusia,
 *              HANYA untuk keterangan saksi SDG (t2-ragam-bas-bot) - kalimat
 *              5227 tetap memakai nilainya.
 *              Zina, penjara, cacat badan, dan taklik SENGAJA tanpa frasa -
 *              tidak ada bentuk yang muncul di 3 perkara isian 5227 manusia.
 *              Ciri itu dipulangkan bot sebagai tanpaFrasa, bukan dibuang.
 *
 *   upaya      kunci 'gagal' | 'berhasil' | 'belum-ada', nilai = kalimat.
 *              {lawan} = variabel ABT 0046 = Penggugat/Pemohon;
 *              {pelaku} = variabel ABT 0047 = Tergugat/Termohon.
 *
 * 'urutan' entri = letaknya di sumber bot, sehingga gabungan portal (K3)
 * mengirim entri dalam urutan yang sama dengan konstanta tertanam - bot yang
 * menerima cermin ini menghasilkan keluaran yang sama persis dengan bot
 * tanpa tipeKeluaran (diuji di berkas uji yang sama).
 *
 * Dirangkai ke index.ts oleh orkestrator sesudah Tahap 1 (index.ts milik
 * t1-db-tipe).
 */
export const CERMIN_ALASAN = {
  "putusan.alasan.ciri": [
    { kunci: "perselisihan terus-menerus", nilai: "perselisihan", data: { kata: ["perselisihan"] }, urutan: 0 },
    { kunci: "perselisihan terus-menerus", nilai: "pertengkaran", data: { kata: ["pertengkaran"] }, urutan: 1 },
    { kunci: "perselisihan terus-menerus", nilai: "percekcokan", data: { kata: ["percekcokan"] }, urutan: 2 },
    { kunci: "perselisihan terus-menerus", nilai: "cekcok", data: { kata: ["cekcok"] }, urutan: 3 },
    { kunci: "perselisihan terus-menerus", nilai: "bertengkar", data: { kata: ["bertengkar"] }, urutan: 4 },
    { kunci: "perselisihan terus-menerus", nilai: "berselisih", data: { kata: ["berselisih"] }, urutan: 5 },
    { kunci: "perselisihan terus-menerus", nilai: "tidak harmonis", data: { kata: ["tidak harmonis"] }, urutan: 6 },
    { kunci: "perselisihan terus-menerus", nilai: "tidak rukun", data: { kata: ["tidak rukun"] }, urutan: 7 },
    { kunci: "perselisihan terus-menerus", nilai: "tidak ada kecocokan", data: { kata: ["tidak ada kecocokan"] }, urutan: 8 },
    { kunci: "perselisihan terus-menerus", nilai: "syiqaq", data: { kata: ["syiqaq"] }, urutan: 9 },
    { kunci: "kekerasan dalam rumah tangga", nilai: "kdrt", data: { kata: ["kdrt"] }, urutan: 10 },
    { kunci: "kekerasan dalam rumah tangga", nilai: "memukul", data: { kata: ["memukul"] }, urutan: 11 },
    { kunci: "kekerasan dalam rumah tangga", nilai: "kekerasan", data: { kata: ["kekerasan"] }, urutan: 12 },
    { kunci: "kekerasan dalam rumah tangga", nilai: "menganiaya", data: { kata: ["menganiaya"] }, urutan: 13 },
    { kunci: "kekerasan dalam rumah tangga", nilai: "penganiayaan", data: { kata: ["penganiayaan"] }, urutan: 14 },
    { kunci: "kekerasan dalam rumah tangga", nilai: "menampar", data: { kata: ["menampar"] }, urutan: 15 },
    { kunci: "kekerasan dalam rumah tangga", nilai: "menendang", data: { kata: ["menendang"] }, urutan: 16 },
    { kunci: "kekerasan dalam rumah tangga", nilai: "mencekik", data: { kata: ["mencekik"] }, urutan: 17 },
    { kunci: "kekerasan dalam rumah tangga", nilai: "kekejaman", data: { kata: ["kekejaman"] }, urutan: 18 },
    { kunci: "kekerasan dalam rumah tangga", nilai: "main tangan", data: { kata: ["main tangan"] }, urutan: 19 },
    { kunci: "kekerasan dalam rumah tangga", nilai: "mengancam + bunuh", data: { kata: ["mengancam", "bunuh"] }, urutan: 20 },
    { kunci: "kekerasan dalam rumah tangga", nilai: "ancaman + senjata", data: { kata: ["ancaman", "senjata"] }, urutan: 21 },
    { kunci: "kekerasan dalam rumah tangga", nilai: "pemukulan", data: { kata: ["pemukulan"] }, urutan: 22 },
    { kunci: "kekerasan dalam rumah tangga", nilai: "dipukul", data: { kata: ["dipukul"] }, urutan: 23 },
    { kunci: "kekerasan dalam rumah tangga", nilai: "menyakiti + fisik", data: { kata: ["menyakiti", "fisik"] }, urutan: 24 },
    { kunci: "kekerasan dalam rumah tangga", nilai: "mengancam + tajam", data: { kata: ["mengancam", "tajam"] }, urutan: 25 },
    { kunci: "kekerasan dalam rumah tangga", nilai: "dicekik", data: { kata: ["dicekik"] }, urutan: 26 },
    { kunci: "kekerasan dalam rumah tangga", nilai: "ditampar", data: { kata: ["ditampar"] }, urutan: 27 },
    { kunci: "kekerasan dalam rumah tangga", nilai: "ditendang", data: { kata: ["ditendang"] }, urutan: 28 },
    { kunci: "kekerasan dalam rumah tangga", nilai: "menjambak", data: { kata: ["menjambak"] }, urutan: 29 },
    { kunci: "kekerasan dalam rumah tangga", nilai: "ringan tangan", data: { kata: ["ringan tangan"] }, urutan: 30 },
    { kunci: "tidak memberi nafkah", nilai: "nafkah", data: { kata: ["nafkah"] }, urutan: 31 },
    { kunci: "tidak memberi nafkah", nilai: "menelantarkan", data: { kata: ["menelantarkan"] }, urutan: 32 },
    { kunci: "tidak memberi nafkah", nilai: "terlantar", data: { kata: ["terlantar"] }, urutan: 33 },
    { kunci: "tidak memberi nafkah", nilai: "tidak menafkahi", data: { kata: ["tidak menafkahi"] }, urutan: 34 },
    { kunci: "tidak memberi nafkah", nilai: "tidak bertanggung jawab", data: { kata: ["tidak bertanggung jawab"] }, urutan: 35 },
    { kunci: "tidak memberi nafkah", nilai: "lalai + kewajiban", data: { kata: ["lalai", "kewajiban"] }, urutan: 36 },
    { kunci: "pihak lain (wanita/pria idaman lain)", nilai: "idaman lain", data: { kata: ["idaman lain"] }, urutan: 37 },
    { kunci: "pihak lain (wanita/pria idaman lain)", nilai: "selingkuh", data: { kata: ["selingkuh"] }, urutan: 38 },
    { kunci: "pihak lain (wanita/pria idaman lain)", nilai: "perselingkuhan", data: { kata: ["perselingkuhan"] }, urutan: 39 },
    { kunci: "pihak lain (wanita/pria idaman lain)", nilai: "pihak ketiga", data: { kata: ["pihak ketiga"] }, urutan: 40 },
    { kunci: "pihak lain (wanita/pria idaman lain)", nilai: "wanita lain", data: { kata: ["wanita lain"] }, urutan: 41 },
    { kunci: "pihak lain (wanita/pria idaman lain)", nilai: "perempuan lain", data: { kata: ["perempuan lain"] }, urutan: 42 },
    { kunci: "pihak lain (wanita/pria idaman lain)", nilai: "laki-laki lain", data: { kata: ["laki-laki lain"] }, urutan: 43 },
    { kunci: "pihak lain (wanita/pria idaman lain)", nilai: "lelaki lain", data: { kata: ["lelaki lain"] }, urutan: 44 },
    { kunci: "pihak lain (wanita/pria idaman lain)", nilai: "pria lain", data: { kata: ["pria lain"] }, urutan: 45 },
    { kunci: "menikah lagi", nilai: "menikah lagi", data: { kata: ["menikah lagi"] }, urutan: 46 },
    { kunci: "menikah lagi", nilai: "kawin lagi", data: { kata: ["kawin lagi"] }, urutan: 47 },
    { kunci: "menikah lagi", nilai: "menikah dengan wanita", data: { kata: ["menikah dengan wanita"] }, urutan: 48 },
    { kunci: "menikah lagi", nilai: "menikah dengan perempuan", data: { kata: ["menikah dengan perempuan"] }, urutan: 49 },
    { kunci: "menikah lagi", nilai: "menikah dengan laki", data: { kata: ["menikah dengan laki"] }, urutan: 50 },
    { kunci: "menikah lagi", nilai: "menikah dengan pria", data: { kata: ["menikah dengan pria"] }, urutan: 51 },
    { kunci: "menikah lagi", nilai: "menikah siri", data: { kata: ["menikah siri"] }, urutan: 52 },
    { kunci: "cemburu", nilai: "cemburu", data: { kata: ["cemburu"] }, urutan: 53 },
    { kunci: "obat terlarang", nilai: "sabu", data: { kata: ["sabu"] }, urutan: 54 },
    { kunci: "obat terlarang", nilai: "shabu", data: { kata: ["shabu"] }, urutan: 55 },
    { kunci: "obat terlarang", nilai: "obat + terlarang", data: { kata: ["obat", "terlarang"] }, urutan: 56 },
    { kunci: "obat terlarang", nilai: "narkoba", data: { kata: ["narkoba"] }, urutan: 57 },
    { kunci: "obat terlarang", nilai: "narkotika", data: { kata: ["narkotika"] }, urutan: 58 },
    { kunci: "obat terlarang", nilai: "pemadat", data: { kata: ["pemadat"] }, urutan: 59 },
    { kunci: "obat terlarang", nilai: "madat", data: { kata: ["madat"] }, urutan: 60 },
    { kunci: "obat terlarang", nilai: "ganja", data: { kata: ["ganja"] }, urutan: 61 },
    { kunci: "judi", nilai: "judi", data: { kata: ["judi"] }, urutan: 62 },
    { kunci: "judi", nilai: "togel", data: { kata: ["togel"] }, urutan: 63 },
    { kunci: "judi", nilai: "sabung ayam", data: { kata: ["sabung ayam"] }, urutan: 64 },
    { kunci: "judi", nilai: "slot", data: { kata: ["slot"] }, urutan: 65 },
    { kunci: "mabuk", nilai: "mabuk", data: { kata: ["mabuk"] }, urutan: 66 },
    { kunci: "mabuk", nilai: "minuman keras", data: { kata: ["minuman keras"] }, urutan: 67 },
    { kunci: "mabuk", nilai: "miras", data: { kata: ["miras"] }, urutan: 68 },
    { kunci: "mabuk", nilai: "pemabuk", data: { kata: ["pemabuk"] }, urutan: 69 },
    { kunci: "mabuk", nilai: "pemabok", data: { kata: ["pemabok"] }, urutan: 70 },
    { kunci: "malas bekerja", nilai: "malas bekerja", data: { kata: ["malas bekerja"] }, urutan: 71 },
    { kunci: "malas bekerja", nilai: "malas dalam bekerja", data: { kata: ["malas dalam bekerja"] }, urutan: 72 },
    { kunci: "malas bekerja", nilai: "malasbekerja", data: { kata: ["malasbekerja"] }, urutan: 73 },
    { kunci: "malas bekerja", nilai: "malas mencari pekerjaan", data: { kata: ["malas mencari pekerjaan"] }, urutan: 74 },
    { kunci: "malas bekerja", nilai: "malas cari pekerjaan", data: { kata: ["malas cari pekerjaan"] }, urutan: 75 },
    { kunci: "malas bekerja", nilai: "malas mencari kerja", data: { kata: ["malas mencari kerja"] }, urutan: 76 },
    { kunci: "malas bekerja", nilai: "malas + kerja", data: { kata: ["malas", "kerja"] }, urutan: 77 },
    { kunci: "malas bekerja", nilai: "tidak mau bekerja", data: { kata: ["tidak mau bekerja"] }, urutan: 78 },
    { kunci: "temperamental", nilai: "temperam", data: { kata: ["temperam"] }, urutan: 79 },
    { kunci: "temperamental", nilai: "tempram", data: { kata: ["tempram"] }, urutan: 80 },
    { kunci: "temperamental", nilai: "teperamen", data: { kata: ["teperamen"] }, urutan: 81 },
    { kunci: "temperamental", nilai: "temparamen", data: { kata: ["temparamen"] }, urutan: 82 },
    { kunci: "temperamental", nilai: "sering marah", data: { kata: ["sering marah"] }, urutan: 83 },
    { kunci: "temperamental", nilai: "marah-marah", data: { kata: ["marah-marah"] }, urutan: 84 },
    { kunci: "temperamental", nilai: "marah marah", data: { kata: ["marah marah"] }, urutan: 85 },
    { kunci: "temperamental", nilai: "mudah marah", data: { kata: ["mudah marah"] }, urutan: 86 },
    { kunci: "temperamental", nilai: "pemarah", data: { kata: ["pemarah"] }, urutan: 87 },
    { kunci: "temperamental", nilai: "suka marah", data: { kata: ["suka marah"] }, urutan: 88 },
    { kunci: "temperamental", nilai: "cepat marah", data: { kata: ["cepat marah"] }, urutan: 89 },
    { kunci: "temperamental", nilai: "gampang marah", data: { kata: ["gampang marah"] }, urutan: 90 },
    { kunci: "temperamental", nilai: "emosional", data: { kata: ["emosional"] }, urutan: 91 },
    { kunci: "temperamental", nilai: "tersulut emosi", data: { kata: ["tersulut emosi"] }, urutan: 92 },
    { kunci: "temperamental", nilai: "mudah emosi", data: { kata: ["mudah emosi"] }, urutan: 93 },
    { kunci: "berkata kasar", nilai: "kata kasar", data: { kata: ["kata kasar"] }, urutan: 94 },
    { kunci: "berkata kasar", nilai: "kata-kata kasar", data: { kata: ["kata-kata kasar"] }, urutan: 95 },
    { kunci: "berkata kasar", nilai: "bicara kasar", data: { kata: ["bicara kasar"] }, urutan: 96 },
    { kunci: "berkata kasar", nilai: "ucapan kasar", data: { kata: ["ucapan kasar"] }, urutan: 97 },
    { kunci: "berkata kasar", nilai: "berucap kasar", data: { kata: ["berucap kasar"] }, urutan: 98 },
    { kunci: "berkata kasar", nilai: "perkataan kasar", data: { kata: ["perkataan kasar"] }, urutan: 99 },
    { kunci: "bersikap kasar", nilai: "sikap kasar", data: { kata: ["sikap kasar"] }, urutan: 100 },
    { kunci: "bersikap kasar", nilai: "berlaku kasar", data: { kata: ["berlaku kasar"] }, urutan: 101 },
    { kunci: "bersikap kasar", nilai: "perlakuan kasar", data: { kata: ["perlakuan kasar"] }, urutan: 102 },
    { kunci: "bersikap kasar", nilai: "berbuat kasar", data: { kata: ["berbuat kasar"] }, urutan: 103 },
    { kunci: "bersikap kasar", nilai: "bertindak kasar", data: { kata: ["bertindak kasar"] }, urutan: 104 },
    {
      kunci: "tidak memiliki pekerjaan tetap",
      nilai: "tidak memiliki pekerjaan tetap",
      data: { kata: ["tidak memiliki pekerjaan tetap"] },
      urutan: 105,
    },
    {
      kunci: "tidak memiliki pekerjaan tetap",
      nilai: "tidak mempunyai pekerjaan tetap",
      data: { kata: ["tidak mempunyai pekerjaan tetap"] },
      urutan: 106,
    },
    {
      kunci: "tidak memiliki pekerjaan tetap",
      nilai: "tidak punya pekerjaan tetap",
      data: { kata: ["tidak punya pekerjaan tetap"] },
      urutan: 107,
    },
    {
      kunci: "tidak memiliki pekerjaan tetap",
      nilai: "belum memiliki pekerjaan tetap",
      data: { kata: ["belum memiliki pekerjaan tetap"] },
      urutan: 108,
    },
    {
      kunci: "tidak memiliki pekerjaan tetap",
      nilai: "belum mempunyai pekerjaan tetap",
      data: { kata: ["belum mempunyai pekerjaan tetap"] },
      urutan: 109,
    },
    {
      kunci: "tidak memiliki pekerjaan tetap",
      nilai: "tidak memiliki pekerjaan yang tetap",
      data: { kata: ["tidak memiliki pekerjaan yang tetap"] },
      urutan: 110,
    },
    {
      kunci: "tidak memiliki pekerjaan tetap",
      nilai: "tidak memiliki penghasilan tetap",
      data: { kata: ["tidak memiliki penghasilan tetap"] },
      urutan: 111,
    },
    {
      kunci: "tidak memiliki pekerjaan tetap",
      nilai: "tidak mempunyai penghasilan tetap",
      data: { kata: ["tidak mempunyai penghasilan tetap"] },
      urutan: 112,
    },
    { kunci: "masalah ekonomi", nilai: "masalah ekonomi", data: { kata: ["masalah ekonomi"] }, urutan: 113 },
    { kunci: "masalah ekonomi", nilai: "faktor ekonomi", data: { kata: ["faktor ekonomi"] }, urutan: 114 },
    { kunci: "masalah ekonomi", nilai: "persoalan ekonomi", data: { kata: ["persoalan ekonomi"] }, urutan: 115 },
    { kunci: "masalah ekonomi", nilai: "permasalahan ekonomi", data: { kata: ["permasalahan ekonomi"] }, urutan: 116 },
    { kunci: "masalah ekonomi", nilai: "alasan ekonomi", data: { kata: ["alasan ekonomi"] }, urutan: 117 },
    { kunci: "campur tangan keluarga", nilai: "ikut campur", data: { kata: ["ikut campur"] }, urutan: 118 },
    { kunci: "campur tangan keluarga", nilai: "turut campur", data: { kata: ["turut campur"] }, urutan: 119 },
    { kunci: "campur tangan keluarga", nilai: "campur tangan", data: { kata: ["campur tangan"] }, urutan: 120 },
    { kunci: "campur tangan keluarga", nilai: "mencampuri", data: { kata: ["mencampuri"] }, urutan: 121 },
    { kunci: "tidak menghargai", nilai: "tidak menghargai", data: { kata: ["tidak menghargai"] }, urutan: 122 },
    { kunci: "tidak menghargai", nilai: "tidak menghormati", data: { kata: ["tidak menghormati"] }, urutan: 123 },
    { kunci: "keluar malam", nilai: "keluar malam", data: { kata: ["keluar malam"] }, urutan: 124 },
    { kunci: "keluar malam", nilai: "pulang larut", data: { kata: ["pulang larut"] }, urutan: 125 },
    { kunci: "keluar malam", nilai: "pulang pagi", data: { kata: ["pulang pagi"] }, urutan: 126 },
    { kunci: "zina", nilai: "zina", data: { kata: ["zina"] }, urutan: 127 },
    { kunci: "zina", nilai: "berzina", data: { kata: ["berzina"] }, urutan: 128 },
    { kunci: "salah satu pihak menjalani pidana penjara", nilai: "dipenjara", data: { kata: ["dipenjara"] }, urutan: 129 },
    { kunci: "salah satu pihak menjalani pidana penjara", nilai: "dihukum + penjara", data: { kata: ["dihukum", "penjara"] }, urutan: 130 },
    {
      kunci: "salah satu pihak menjalani pidana penjara",
      nilai: "menjalani + pidana",
      data: { kata: ["menjalani", "pidana"] },
      urutan: 131,
    },
    {
      kunci: "salah satu pihak menjalani pidana penjara",
      nilai: "lembaga pemasyarakatan",
      data: { kata: ["lembaga pemasyarakatan"] },
      urutan: 132,
    },
    { kunci: "cacat badan atau penyakit", nilai: "cacat badan", data: { kata: ["cacat badan"] }, urutan: 133 },
    { kunci: "cacat badan atau penyakit", nilai: "cacat tetap", data: { kata: ["cacat tetap"] }, urutan: 134 },
    {
      kunci: "cacat badan atau penyakit",
      nilai: "penyakit + tidak dapat menjalankan",
      data: { kata: ["penyakit", "tidak dapat menjalankan"] },
      urutan: 135,
    },
    { kunci: "cacat badan atau penyakit", nilai: "impoten", data: { kata: ["impoten"] }, urutan: 136 },
    { kunci: "cacat badan atau penyakit", nilai: "gangguan jiwa", data: { kata: ["gangguan jiwa"] }, urutan: 137 },
    { kunci: "pelanggaran taklik talak", nilai: "taklik talak", data: { kata: ["taklik talak"] }, urutan: 138 },
    { kunci: "pelanggaran taklik talak", nilai: "taklik", data: { kata: ["taklik"] }, urutan: 139 },
    { kunci: "pelanggaran taklik talak", nilai: "ta'lik", data: { kata: ["ta'lik"] }, urutan: 140 },
    { kunci: "murtad/pindah agama", nilai: "murtad", data: { kata: ["murtad"] }, urutan: 141 },
    { kunci: "murtad/pindah agama", nilai: "pindah agama", data: { kata: ["pindah agama"] }, urutan: 142 },
    { kunci: "murtad/pindah agama", nilai: "keluar dari agama islam", data: { kata: ["keluar dari agama islam"] }, urutan: 143 },
  ],
  "bersama.alasan.frasa": [
    { kunci: "tidak memberi nafkah", nilai: "melalaikan kewajiban nafkah lahir", data: { urutan: 10 }, urutan: 0 },
    {
      kunci: "cemburu",
      nilai: "bersikap cemburu berlebihan",
      data: { urutan: 20, setara: ["memiliki kecemburuan yang berlebihan", "cemburu berlebihan"] },
      urutan: 1,
    },
    {
      kunci: "pihak lain (wanita/pria idaman lain)",
      nilai: "menjalin hubungan dengan pihak lain",
      data: { urutan: 30, setara: ["berselingkuh", "selingkuh"] },
      urutan: 2,
    },
    {
      kunci: "kekerasan dalam rumah tangga",
      nilai: "melakukan Kekerasan Dalam Rumah Tangga (KDRT)",
      data: { urutan: 40, setara: ["melakukan kekerasan dalam rumah tangga", "melakukan KDRT kepada {lawan}", "melakukan KDRT terhadap {lawan}"] },
      urutan: 3,
    },
    { kunci: "mabuk", nilai: "menjadi pemabuk", data: { urutan: 50, setara: ["suka mabuk", "suka mabuk-mabukan"] }, urutan: 4 },
    { kunci: "judi", nilai: "menjadi penjudi", data: { urutan: 51, setara: ["suka bermain judi", "suka main judi"] }, urutan: 5 },
    {
      kunci: "obat terlarang",
      nilai: "menjadi pemakai obat terlarang",
      data: { urutan: 52, setara: ["mengkonsumsi obat-obatan terlarang", "mengonsumsi obat-obatan terlarang", "mengonsumsi narkoba"] },
      urutan: 6,
    },
    { kunci: "murtad/pindah agama", nilai: "berpindah agama", data: { urutan: 60 }, urutan: 7 },
    { kunci: "malas bekerja", nilai: "malas bekerja", data: { urutan: 15 }, urutan: 8 },
    { kunci: "temperamental", nilai: "bersikap temperamental", data: { urutan: 25, setara: ["suka marah", "mudah marah"] }, urutan: 9 },
    { kunci: "berkata kasar", nilai: "berkata kasar", data: { urutan: 26 }, urutan: 10 },
    { kunci: "bersikap kasar", nilai: "bersikap kasar", data: { urutan: 27 }, urutan: 11 },
    { kunci: "tidak memiliki pekerjaan tetap", nilai: "tidak memiliki pekerjaan tetap", data: { urutan: 16 }, urutan: 12 },
    { kunci: "menikah lagi", nilai: "telah menikah lagi", data: { urutan: 31, setara: ["sudah menikah lagi"] }, urutan: 13 },
    {
      kunci: "perselisihan terus-menerus",
      nilai: "memicu perselisihan terus-menerus dengan {lawan}",
      data: { urutan: 90, akibat: true },
      urutan: 14,
    },
  ],
  "putusan.upaya-damai.bunyi": [
    { kunci: "gagal", nilai: "pihak keluarga telah berusaha untuk mendamaikan {lawan} dan {pelaku}, namun tidak berhasil", urutan: 0 },
    { kunci: "berhasil", nilai: "pihak keluarga telah berusaha untuk mendamaikan {lawan} dan {pelaku}", urutan: 1 },
    { kunci: "belum-ada", nilai: "belum pernah ada upaya untuk merukunkan {lawan} dan {pelaku}", urutan: 2 },
  ],
} satisfies Cermin;
