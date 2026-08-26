import { SUPPLEMENTAL_BAS_QA_TEMPLATES } from "@/server/modules/judicia/legal-form/bas-qa/jlf-bas-qa-supplemental-seed-catalog";

type BasQaSeedItem = {
  id: string;
  order: number;
  question: string;
  answer: string;
};

type BasQaSeedTemplate = {
  id: string;
  code: string;
  name: string;
  caseType: string;
  paperSize: string;
  isActive: boolean;
  updatedAt: string;
  items: BasQaSeedItem[];
};

const UPDATED_AT = "2026-05-25T00:00:00.000Z";

type QuestionSeed = {
  question: string;
  answer?: string;
};

const foundationQuestions: QuestionSeed[] = [
  {
    question: "Apakah Saksi hadir dalam keadaan sehat, sadar, dan bersedia memberikan keterangan yang benar menurut agama serta hukum?",
    answer: "Saksi menjawab bahwa Saksi hadir dalam keadaan sehat, sadar, dan bersedia memberikan keterangan yang benar;",
  },
  {
    question: "Apakah Saksi memiliki hubungan keluarga, pekerjaan, hutang-piutang, atau kepentingan langsung dengan para pihak?",
    answer: "Saksi menerangkan hubungan Saksi dengan para pihak secara jelas untuk dinilai oleh majelis;",
  },
  {
    question: "Sejak kapan Saksi mengenal para pihak dan dari mana Saksi mengenal mereka?",
    answer: "Saksi menerangkan sejak kapan dan dalam hubungan apa Saksi mengenal para pihak;",
  },
  {
    question: "Apakah keterangan yang akan Saksi berikan berasal dari pengetahuan sendiri, melihat langsung, mendengar langsung, atau hanya dari cerita orang lain?",
    answer: "Saksi menjelaskan sumber pengetahuan Saksi atas peristiwa yang diterangkan;",
  },
  {
    question: "Apakah ada pihak yang mengarahkan, menekan, atau menjanjikan sesuatu kepada Saksi terkait keterangan ini?",
    answer: "Saksi menjawab tidak ada tekanan atau janji yang mempengaruhi keterangan Saksi;",
  },
  {
    question: "Apakah Saksi memahami bahwa keterangan palsu di depan persidangan dapat menimbulkan akibat hukum?",
    answer: "Saksi menjawab bahwa Saksi memahami akibat hukum dari keterangan palsu;",
  },
];

function item(templateId: string, order: number, seed: QuestionSeed): BasQaSeedItem {
  return {
    id: `${templateId}-q${String(order).padStart(2, "0")}`,
    order,
    question: seed.question,
    answer: seed.answer ?? "",
  };
}

function template(input: {
  id: string;
  code: string;
  name: string;
  caseType: string;
  questions: QuestionSeed[];
}): BasQaSeedTemplate {
  return {
    id: input.id,
    code: input.code,
    name: input.name,
    caseType: input.caseType,
    paperSize: "A4",
    isActive: true,
    updatedAt: UPDATED_AT,
    items: [...foundationQuestions, ...input.questions].map((seed, index) => item(input.id, index + 1, seed)),
  };
}

const CORE_BAS_QA_TEMPLATES: BasQaSeedTemplate[] = [
  template({
    id: "jlf-bas-qa-saksi-umum",
    code: "JLF-BAS-UMUM",
    name: "Saksi Umum - Pemeriksaan Identitas dan Sumber Pengetahuan",
    caseType: "Umum Peradilan Agama",
    questions: [
      { question: "Apakah Saksi mengetahui nomor perkara {{nomor_perkara}} dan para pihak yang berperkara dalam perkara ini?" },
      { question: "Apa hubungan Saksi dengan {{nama_penggugat}} dan {{nama_tergugat}}?" },
      { question: "Apakah Saksi pernah melihat langsung peristiwa pokok yang menjadi alasan perkara ini?" },
      { question: "Kapan, di mana, dan dalam keadaan apa Saksi mengetahui peristiwa tersebut?" },
      { question: "Apakah keterangan Saksi didukung oleh dokumen, percakapan, foto, saksi lain, atau peristiwa yang Saksi alami sendiri?" },
      { question: "Apakah ada bagian dari keterangan Saksi yang hanya Saksi dengar dari orang lain?" },
      { question: "Apakah Saksi mengetahui adanya upaya perdamaian, musyawarah keluarga, mediasi, atau penyelesaian lain sebelum perkara diajukan?" },
      { question: "Apakah masih ada hal penting yang menurut Saksi perlu diterangkan kepada majelis?" },
    ],
  }),
  template({
    id: "jlf-bas-qa-cerai-gugat",
    code: "JLF-BAS-CG",
    name: "Saksi Cerai Gugat - Perselisihan, Pisah Rumah, dan Nafkah",
    caseType: "Cerai Gugat",
    questions: [
      { question: "Apakah Saksi mengetahui hubungan perkawinan antara Penggugat dan Tergugat masih berlangsung atau sudah berpisah tempat tinggal?" },
      { question: "Sejak kapan Penggugat dan Tergugat mulai sering berselisih atau bertengkar?" },
      { question: "Apa penyebab perselisihan yang Saksi ketahui secara langsung?" },
      { question: "Apakah pertengkaran tersebut terjadi berulang dan sulit didamaikan?" },
      { question: "Sejak kapan para pihak pisah rumah, siapa yang meninggalkan rumah, dan apa sebabnya?" },
      { question: "Selama pisah rumah, apakah Tergugat masih memberi nafkah lahir kepada Penggugat dan anak-anak?" },
      { question: "Apakah Saksi mengetahui adanya kekerasan, ancaman, penelantaran, perselingkuhan, mabuk, judi, atau perilaku lain yang menjadi alasan gugatan?" },
      { question: "Apakah keluarga atau tokoh masyarakat pernah berupaya mendamaikan para pihak? Bagaimana hasilnya?" },
      { question: "Apakah menurut pengetahuan Saksi rumah tangga para pihak masih mungkin dipertahankan?" },
      { question: "Apakah ada anak dari perkawinan tersebut dan dengan siapa anak tinggal selama ini?" },
      { question: "Apakah Saksi mengetahui kebutuhan anak dan siapa yang selama ini menanggung biaya anak?" },
    ],
  }),
  template({
    id: "jlf-bas-qa-cerai-talak",
    code: "JLF-BAS-CT",
    name: "Saksi Cerai Talak - Alasan Talak dan Kelayakan Ikrar",
    caseType: "Cerai Talak",
    questions: [
      { question: "Apakah Saksi mengetahui Pemohon dan Termohon adalah suami istri yang sah?" },
      { question: "Sejak kapan Pemohon dan Termohon mengalami perselisihan atau tidak harmonis?" },
      { question: "Apa alasan utama Pemohon ingin menjatuhkan talak menurut pengetahuan Saksi?" },
      { question: "Apakah Termohon masih tinggal serumah dengan Pemohon atau sudah berpisah tempat tinggal?" },
      { question: "Apakah Pemohon masih memberi nafkah kepada Termohon dan anak-anak selama pisah rumah?" },
      { question: "Apakah Saksi mengetahui adanya upaya perdamaian dari keluarga, tokoh masyarakat, atau mediator?" },
      { question: "Apakah Saksi mengetahui kondisi Termohon, termasuk apakah sedang hamil atau tidak, sepanjang diketahui Saksi?" },
      { question: "Apakah ada anak yang masih membutuhkan nafkah dan pemeliharaan?" },
      { question: "Apakah Saksi mengetahui kemampuan ekonomi Pemohon untuk nafkah iddah, mutah, madhiyah, atau nafkah anak?" },
      { question: "Apakah menurut Saksi rumah tangga Pemohon dan Termohon masih dapat dirukunkan?" },
    ],
  }),
  template({
    id: "jlf-bas-qa-ghaib-verstek",
    code: "JLF-BAS-GHAIB",
    name: "Saksi Ghaib/Verstek - Keberadaan dan Pemanggilan Pihak",
    caseType: "Ghaib, Verstek, dan Relas",
    questions: [
      { question: "Apakah Saksi mengetahui alamat terakhir pihak yang tidak hadir dalam perkara ini?" },
      { question: "Sejak kapan pihak tersebut tidak diketahui keberadaannya atau tidak tinggal di alamat tersebut?" },
      { question: "Upaya apa saja yang pernah dilakukan keluarga atau lingkungan untuk mencari keberadaan pihak tersebut?" },
      { question: "Apakah Saksi mengetahui pihak tersebut pernah menerima panggilan, pemberitahuan, atau mengetahui adanya perkara ini?" },
      { question: "Apakah alamat yang tercantum dalam gugatan/permohonan sesuai dengan alamat terakhir yang Saksi ketahui?" },
      { question: "Apakah pihak tersebut masih memiliki keluarga atau kerabat di alamat tersebut?" },
      { question: "Apakah Saksi mengetahui alasan pihak tersebut tidak hadir di persidangan?" },
      { question: "Apakah keterangan Saksi mengenai keberadaan pihak tersebut berasal dari pengetahuan langsung?" },
    ],
  }),
  template({
    id: "jlf-bas-qa-nafkah",
    code: "JLF-BAS-NAFKAH",
    name: "Saksi Nafkah - Madhiyah, Iddah, Mutah, dan Nafkah Anak",
    caseType: "Nafkah",
    questions: [
      { question: "Apakah Saksi mengetahui sejak kapan kewajiban nafkah dipersoalkan dalam perkara ini?" },
      { question: "Apakah pihak yang berkewajiban memberi nafkah memiliki pekerjaan, penghasilan, atau kemampuan ekonomi tertentu?" },
      { question: "Berapa kebutuhan wajar pihak istri/anak yang Saksi ketahui untuk makan, pendidikan, kesehatan, tempat tinggal, dan kebutuhan harian?" },
      { question: "Apakah selama pisah rumah masih ada nafkah yang diberikan? Jika ada, berapa dan seberapa sering?" },
      { question: "Apakah ada bukti pengeluaran, transfer, saksi keluarga, atau kebiasaan nafkah yang Saksi ketahui?" },
      { question: "Apakah anak masih sekolah atau memiliki kebutuhan khusus?" },
      { question: "Siapa yang selama ini mengasuh dan menanggung biaya anak?" },
      { question: "Apakah Saksi mengetahui keadaan ekonomi masing-masing pihak secara langsung?" },
    ],
  }),
  template({
    id: "jlf-bas-qa-hadhanah",
    code: "JLF-BAS-HADHANAH",
    name: "Saksi Hadhanah - Pengasuhan dan Kepentingan Terbaik Anak",
    caseType: "Hadhanah/Hak Asuh Anak",
    questions: [
      { question: "Apakah Saksi mengenal anak yang menjadi objek sengketa pengasuhan?" },
      { question: "Sejak kapan anak tinggal bersama salah satu pihak dan bagaimana kondisi anak selama diasuh?" },
      { question: "Siapa yang selama ini memenuhi kebutuhan makan, sekolah, kesehatan, ibadah, dan perhatian harian anak?" },
      { question: "Apakah Saksi mengetahui kedekatan emosional anak dengan masing-masing orang tua?" },
      { question: "Apakah ada perilaku salah satu pihak yang membahayakan fisik, psikis, pendidikan, atau akhlak anak?" },
      { question: "Apakah pihak yang memohon hak asuh memiliki waktu, tempat tinggal, dan kemampuan merawat anak?" },
      { question: "Apakah pihak lain tetap diberi kesempatan bertemu atau berkomunikasi dengan anak?" },
      { question: "Menurut pengetahuan Saksi, apa kondisi yang paling menjaga kepentingan terbaik anak?" },
    ],
  }),
  template({
    id: "jlf-bas-qa-harta-bersama",
    code: "JLF-BAS-HB",
    name: "Saksi Harta Bersama - Perolehan, Penguasaan, dan Pembagian",
    caseType: "Harta Bersama",
    questions: [
      { question: "Apakah Saksi mengetahui objek harta yang disengketakan dalam perkara ini?" },
      { question: "Kapan harta tersebut diperoleh dan apakah diperoleh selama perkawinan?" },
      { question: "Dari mana sumber dana atau usaha untuk memperoleh harta tersebut?" },
      { question: "Siapa yang menguasai, memakai, menyewakan, menjual, atau mengalihkan harta tersebut saat ini?" },
      { question: "Apakah harta tersebut berasal dari warisan, hibah, hadiah, atau bawaan salah satu pihak?" },
      { question: "Apakah ada bukti kepemilikan seperti sertifikat, BPKB, kuitansi, rekening, atau dokumen lain yang Saksi ketahui?" },
      { question: "Apakah ada hutang bersama yang berkaitan dengan harta tersebut?" },
      { question: "Apakah pernah ada kesepakatan pembagian harta antara para pihak?" },
    ],
  }),
  template({
    id: "jlf-bas-qa-itsbat-nikah",
    code: "JLF-BAS-ITSBAT",
    name: "Saksi Itsbat Nikah - Rukun, Syarat, dan Tidak Ada Halangan",
    caseType: "Itsbat Nikah/Pengesahan Perkawinan",
    questions: [
      { question: "Apakah Saksi hadir atau mengetahui langsung akad nikah para Pemohon?" },
      { question: "Kapan dan di mana akad nikah dilaksanakan?" },
      { question: "Siapa wali nikah, calon suami, calon istri, dan dua orang saksi nikah pada saat akad?" },
      { question: "Apakah ijab kabul dilakukan dalam satu majelis dan diketahui oleh Saksi?" },
      { question: "Apakah ada mahar? Jika ada, apa bentuk dan jumlahnya menurut pengetahuan Saksi?" },
      { question: "Apakah pada saat menikah para pihak tidak sedang terikat perkawinan lain yang menghalangi?" },
      { question: "Apakah para pihak memiliki hubungan nasab, semenda, sesusuan, atau halangan lain yang dilarang hukum?" },
      { question: "Mengapa perkawinan tersebut tidak tercatat di KUA atau belum memiliki buku nikah?" },
      { question: "Apakah setelah akad para pihak hidup sebagai suami istri dan diketahui masyarakat?" },
      { question: "Apakah dari perkawinan tersebut lahir anak? Jika ada, siapa nama anak dan kapan lahirnya?" },
    ],
  }),
  template({
    id: "jlf-bas-qa-dispensasi-kawin",
    code: "JLF-BAS-DK",
    name: "Saksi Dispensasi Kawin - Kesiapan, Perlindungan Anak, dan Alasan Mendesak",
    caseType: "Dispensasi Kawin",
    questions: [
      { question: "Apakah Saksi mengenal anak yang dimohonkan dispensasi kawin dan calon pasangannya?" },
      { question: "Berapa usia anak dan calon pasangannya menurut pengetahuan Saksi?" },
      { question: "Apa alasan mendesak diajukannya permohonan dispensasi kawin?" },
      { question: "Apakah anak dan calon pasangannya saling mengenal dan menyatakan kehendak menikah tanpa paksaan?" },
      { question: "Apakah Saksi mengetahui kesiapan fisik, psikis, pendidikan, ekonomi, dan agama anak?" },
      { question: "Apakah ada kehamilan, hubungan yang terlalu dekat, atau risiko sosial yang menjadi alasan permohonan?" },
      { question: "Apakah orang tua/wali telah memberi nasihat mengenai risiko perkawinan anak?" },
      { question: "Apakah calon suami memiliki pekerjaan atau kemampuan menafkahi?" },
      { question: "Apakah ada potensi kekerasan, eksploitasi, perdagangan orang, atau tekanan keluarga?" },
      { question: "Menurut pengetahuan Saksi, apakah perkawinan tersebut melindungi kepentingan terbaik anak?" },
    ],
  }),
  template({
    id: "jlf-bas-qa-wali-adhal",
    code: "JLF-BAS-WA",
    name: "Saksi Wali Adhal - Penolakan Wali dan Kelayakan Calon Suami",
    caseType: "Wali Adhal",
    questions: [
      { question: "Apakah Saksi mengetahui hubungan Pemohon dengan wali nasabnya?" },
      { question: "Apakah Pemohon telah meminta wali untuk menikahkan dengan calon suami?" },
      { question: "Apa alasan wali menolak atau tidak bersedia menikahkan menurut pengetahuan Saksi?" },
      { question: "Apakah alasan penolakan wali berkaitan dengan halangan syar'i atau alasan lain?" },
      { question: "Apakah calon suami seagama, cakap, dan tidak memiliki halangan perkawinan?" },
      { question: "Apakah calon suami memiliki akhlak, pekerjaan, dan kemampuan bertanggung jawab?" },
      { question: "Apakah Pemohon dan calon suami saling rela menikah tanpa paksaan?" },
      { question: "Apakah ada upaya keluarga atau tokoh masyarakat untuk menasihati wali?" },
    ],
  }),
  template({
    id: "jlf-bas-qa-asal-usul-anak",
    code: "JLF-BAS-AUA",
    name: "Saksi Asal Usul Anak - Nasab, Kelahiran, dan Perkawinan Orang Tua",
    caseType: "Asal Usul Anak/Pengesahan Anak",
    questions: [
      { question: "Apakah Saksi mengenal anak yang dimohonkan penetapan asal-usulnya?" },
      { question: "Kapan dan di mana anak tersebut lahir menurut pengetahuan Saksi?" },
      { question: "Siapa ayah dan ibu anak tersebut menurut pengetahuan Saksi?" },
      { question: "Apakah orang tua anak hidup sebagai suami istri sebelum atau setelah anak lahir?" },
      { question: "Apakah Saksi mengetahui adanya akad nikah orang tua anak tersebut?" },
      { question: "Apakah ada pengakuan ayah atau keluarga terhadap anak tersebut?" },
      { question: "Apakah anak tersebut diasuh, dinafkahi, atau diperkenalkan kepada masyarakat sebagai anak para pihak?" },
      { question: "Apakah ada dokumen kelahiran, kartu keluarga, sekolah, atau keterangan lain yang Saksi ketahui?" },
    ],
  }),
  template({
    id: "jlf-bas-qa-pembatalan-nikah",
    code: "JLF-BAS-BATAL-NIKAH",
    name: "Saksi Pembatalan Nikah - Halangan dan Cacat Syarat Perkawinan",
    caseType: "Pembatalan Nikah",
    questions: [
      { question: "Apakah Saksi mengetahui kapan dan di mana perkawinan para pihak dilangsungkan?" },
      { question: "Apakah pada saat perkawinan terdapat halangan nasab, semenda, sesusuan, agama, umur, atau status perkawinan?" },
      { question: "Apakah ada dugaan pemalsuan identitas, status jejaka/duda/perawan/janda, atau dokumen perkawinan?" },
      { question: "Apakah wali, saksi nikah, ijab kabul, atau mahar dilaksanakan sesuai ketentuan yang Saksi ketahui?" },
      { question: "Kapan pihak yang memohon pembatalan mengetahui adanya cacat atau halangan tersebut?" },
      { question: "Apakah setelah mengetahui halangan tersebut para pihak masih hidup bersama?" },
      { question: "Apakah terdapat anak atau akibat hukum lain dari perkawinan tersebut?" },
    ],
  }),
  template({
    id: "jlf-bas-qa-izin-poligami",
    code: "JLF-BAS-POLIGAMI",
    name: "Saksi Izin Poligami - Alasan, Kemampuan, dan Keadilan",
    caseType: "Izin Poligami",
    questions: [
      { question: "Apakah Saksi mengetahui Pemohon masih terikat perkawinan dengan istri yang sah?" },
      { question: "Apa alasan Pemohon mengajukan izin poligami menurut pengetahuan Saksi?" },
      { question: "Apakah istri memberi persetujuan atau keberatan terhadap rencana poligami tersebut?" },
      { question: "Apakah Saksi mengetahui kondisi kesehatan, keturunan, atau alasan lain yang dijadikan dasar permohonan?" },
      { question: "Apakah Pemohon memiliki penghasilan dan kemampuan menafkahi lebih dari satu keluarga?" },
      { question: "Apakah Pemohon dinilai mampu berlaku adil dalam nafkah, tempat tinggal, dan waktu?" },
      { question: "Apakah calon istri kedua mengetahui status Pemohon dan rela menikah?" },
      { question: "Apakah ada harta bersama yang perlu dijelaskan atau dilindungi sebelum izin diberikan?" },
    ],
  }),
  template({
    id: "jlf-bas-qa-waris",
    code: "JLF-BAS-WARIS",
    name: "Saksi Waris - Pewaris, Ahli Waris, dan Harta Peninggalan",
    caseType: "Waris/Faraidh",
    questions: [
      { question: "Apakah Saksi mengenal pewaris dan kapan pewaris meninggal dunia?" },
      { question: "Apakah pewaris beragama Islam pada saat meninggal dunia?" },
      { question: "Siapa saja ahli waris yang masih hidup pada saat pewaris meninggal?" },
      { question: "Apakah ada ahli waris yang telah meninggal lebih dahulu, tidak diketahui, atau terhalang mewaris?" },
      { question: "Apakah pewaris meninggalkan suami/istri, anak, orang tua, saudara, atau ahli waris pengganti?" },
      { question: "Apa saja harta peninggalan pewaris yang Saksi ketahui?" },
      { question: "Apakah ada hutang pewaris, wasiat, biaya pemakaman, atau kewajiban lain yang harus diselesaikan?" },
      { question: "Apakah pernah ada pembagian waris atau kesepakatan keluarga sebelumnya?" },
      { question: "Apakah ada sengketa mengenai status ahli waris atau objek waris?" },
    ],
  }),
  template({
    id: "jlf-bas-qa-hibah-wasiat",
    code: "JLF-BAS-HIBAH-WASIAT",
    name: "Saksi Hibah/Wasiat - Kehendak, Objek, dan Batasan Hukum",
    caseType: "Hibah/Wasiat",
    questions: [
      { question: "Apakah Saksi mengetahui adanya hibah atau wasiat yang menjadi pokok perkara?" },
      { question: "Kapan, di mana, dan di hadapan siapa hibah atau wasiat tersebut dibuat?" },
      { question: "Apakah pemberi hibah/wasiat dalam keadaan sehat, sadar, dan tanpa paksaan?" },
      { question: "Apa objek hibah/wasiat dan apakah objek tersebut benar milik pemberi?" },
      { question: "Apakah hibah telah diserahkan atau dikuasai penerima?" },
      { question: "Apakah nilai wasiat melebihi sepertiga harta atau merugikan ahli waris menurut pengetahuan Saksi?" },
      { question: "Apakah ada ahli waris yang menyetujui, menolak, atau menggugat hibah/wasiat tersebut?" },
      { question: "Apakah ada dokumen akta, surat, saksi lain, atau bukti penguasaan objek?" },
    ],
  }),
  template({
    id: "jlf-bas-qa-wakaf-zis",
    code: "JLF-BAS-WAKAF-ZIS",
    name: "Saksi Wakaf, Zakat, Infak, dan Sedekah",
    caseType: "Wakaf/Zakat/Infak/Sedekah",
    questions: [
      { question: "Apakah Saksi mengetahui objek wakaf atau dana zakat/infak/sedekah yang menjadi sengketa?" },
      { question: "Siapa wakif/muzakki/pemberi dan siapa nazhir/pengelola atau penerima manfaatnya?" },
      { question: "Kapan ikrar wakaf atau penyerahan dana/barang dilakukan?" },
      { question: "Apakah objek wakaf telah digunakan sesuai peruntukan yang ditetapkan?" },
      { question: "Apakah ada Akta Ikrar Wakaf, sertifikat wakaf, catatan pengelolaan, atau laporan keuangan?" },
      { question: "Apakah Saksi mengetahui adanya penyimpangan, pengalihan, penjualan, atau penggunaan yang tidak sesuai?" },
      { question: "Apakah masyarakat atau penerima manfaat masih menggunakan objek tersebut?" },
      { question: "Apakah pernah ada musyawarah atau teguran kepada pengelola?" },
    ],
  }),
  template({
    id: "jlf-bas-qa-ekonomi-syariah",
    code: "JLF-BAS-EKSYAR",
    name: "Saksi Ekonomi Syariah - Akad, Prestasi, dan Kerugian",
    caseType: "Ekonomi Syariah",
    questions: [
      { question: "Apakah Saksi mengetahui akad atau perjanjian syariah yang menjadi dasar hubungan para pihak?" },
      { question: "Kapan akad dibuat dan siapa saja pihak yang menandatangani atau menyetujuinya?" },
      { question: "Apa jenis akad yang Saksi ketahui, seperti murabahah, musyarakah, mudharabah, ijarah, qardh, atau akad lainnya?" },
      { question: "Apa kewajiban masing-masing pihak menurut akad tersebut?" },
      { question: "Apakah ada pihak yang tidak melaksanakan kewajibannya? Kapan dan bagaimana bentuk wanprestasinya?" },
      { question: "Apakah ada pembayaran, jaminan, restrukturisasi, teguran, somasi, atau musyawarah penyelesaian?" },
      { question: "Apakah Saksi mengetahui jumlah kewajiban, kerugian, margin, bagi hasil, atau denda yang dipersoalkan?" },
      { question: "Apakah dokumen akad, rekening koran, bukti transfer, jaminan, atau surat peringatan pernah Saksi lihat?" },
    ],
  }),
  template({
    id: "jlf-bas-qa-perwalian-pengampuan",
    code: "JLF-BAS-WALI-AMPU",
    name: "Saksi Perwalian dan Pengampuan",
    caseType: "Perwalian/Pengampuan",
    questions: [
      { question: "Apakah Saksi mengenal anak/orang yang dimohonkan perwalian atau pengampuan?" },
      { question: "Apa hubungan Pemohon dengan anak/orang yang dimohonkan perlindungan hukum?" },
      { question: "Mengapa perwalian atau pengampuan diperlukan menurut pengetahuan Saksi?" },
      { question: "Apakah orang tua/wali sebelumnya telah meninggal, tidak mampu, tidak diketahui, atau berhalangan?" },
      { question: "Apakah Pemohon memiliki kelayakan moral, ekonomi, dan kemampuan mengurus kepentingan yang dimohonkan?" },
      { question: "Apakah ada harta, pendidikan, kesehatan, atau kepentingan administrasi yang perlu dilindungi?" },
      { question: "Apakah ada keberatan dari keluarga lain terhadap permohonan ini?" },
      { question: "Apakah penetapan ini menurut Saksi diperlukan untuk kepentingan terbaik anak/orang yang dilindungi?" },
    ],
  }),
  template({
    id: "jlf-bas-qa-jinayat",
    code: "JLF-BAS-JINAYAT",
    name: "Saksi Jinayat - Peristiwa, Identitas, dan Pembuktian",
    caseType: "Jinayat/Mahkamah Syar'iyah",
    questions: [
      { question: "Apakah Saksi melihat, mendengar, atau mengalami langsung peristiwa jinayat yang diperiksa?" },
      { question: "Kapan dan di mana peristiwa tersebut terjadi?" },
      { question: "Siapa saja orang yang Saksi lihat berada di tempat kejadian?" },
      { question: "Apa yang dilakukan terdakwa/terlapor menurut pengamatan langsung Saksi?" },
      { question: "Apakah Saksi mengenali korban, terdakwa/terlapor, atau barang bukti yang diajukan?" },
      { question: "Apakah ada keadaan yang meringankan, memberatkan, paksaan, ancaman, atau perdamaian yang Saksi ketahui?" },
      { question: "Apakah keterangan Saksi pernah diberikan di hadapan penyidik, jaksa, atau pejabat lain sebelumnya?" },
      { question: "Apakah keterangan Saksi hari ini sama dengan keterangan sebelumnya? Jika berbeda, apa alasannya?" },
    ],
  }),
];

export const COMPREHENSIVE_BAS_QA_TEMPLATES: BasQaSeedTemplate[] = [
  ...CORE_BAS_QA_TEMPLATES,
  ...SUPPLEMENTAL_BAS_QA_TEMPLATES,
];
