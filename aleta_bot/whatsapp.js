const { readRuntimeConfig, normalizeChatId, recipientsToMap } = require("./config/runtime-config");

const runtimeConfig = readRuntimeConfig();

///// Nomor admin ALETA Bot sekarang dapat diatur dari portal manajemen_surat.
// NOMOR WHATSAPP USER
const adminId = runtimeConfig.adminWhatsappChatId || normalizeChatId(process.env.ALETA_BOT_DEFAULT_ADMIN_WHATSAPP || "");

const groupId = {
    "Pengadilan Agama Donggala": "120363048551253827@g.us"
  };
const socketUrl = "https://websocket.pa-bungku.go.id:4141";

// NOMOR TIAP PEJABAT DAN PEGAWAI TIAP JENIS JABATAN
// Nomor Whatsapp Hakim
const hakimIds = {
  "Abdul Salam": "6281245893055@c.us",
  "Ali": "6281342081382@c.us",
  "Idris": "6281354235594@c.us",
  "Himawan Tatura": "6281253470225@c.us",
  "Derry Briantono": "6285255956962@c.us",
  // Tambahkan hakim lain di sini jika perlu
};

// Nomor Whatsapp Panitera
const paniteraIds = {
  "Sri Susilowati": "6285241166999@c.us",
  "Bulgis": "6285241117732@c.us",
  "Mannaria": "6285241287431@c.us",
  "Sri Wahyuni": "6285241158028@c.us",
  "Munifa": "6285211816522@c.us",
  "Qadariyah": "6281341007198@c.us",
  "Andini Puspita": "6285340860876@c.us",
  "Asrah Rachman": "6281240792565@c.us",
  "Unun Fidiyasari": "6281242389473@c.us",
  // Tambahkan panitera lain di sini jika perlu
};

// Nomor Whatsapp Jurusita
const jurusitaIds = {
  "Mohammad Syukri": "6281354332266@c.us",
  "Tanty Restianty": "6282192439324@c.us",
  "Mustini": "6282192485353@c.us",
  // Tambahkan jurusita lain di sini jika perlu
};

const ketuaId = {
  "Abdul Salam": "6281245893055@c.us",
  "Akbar Ali": "6281342081382@c.us",
};

const paniteraId = {
  "Sri Susilowati": "6285241166999@c.us",
};

const sekretarisId = {
  "Sudirman": "6285239968873@c.us"
};

const panmudGugatanId = {
  "Mannaria": "6285241287431@c.us",
};

const panmudPermohonanId = {
  "Sri Wahyuni": "6285241158028@c.us",
};

const panmudHukumId = {
  "Bulgis": "6285241117732@c.us",
};

const paniteraPenggantiId = {
  "Munifa": "6285211816522@c.us",
  "Qadariyah": "6281341007198@c.us",
  "Andini Puspita": "6285340860876@c.us",
  "Asrah Rachman": "6281240792565@c.us",
  "Unun Fidiyasari": "6281242389473@c.us",
};

const kasubagKepegawaianId = {
  "Lukman Hakim": "6282188336101@c.us"
};

const kasubagPtipId = {
  "Muhammad Rifai": "6285241187678@c.us"
};

const kasubagUmumId = {
  "Harman": "62813439566614@c.us"
};

const kasirId = {
  "Tanty Restianty": "6282192439324@c.us"
};

const tabayunId = {
  "Mannaria": "6285241287431@c.us"
};

const petugasArsipId = {
  "Bulgis": "6285241117732@c.us"
};

const ptspId = {
  "Rahma Anggorosiwi Yanu Pamungkas": "6281325352252@c.us",
  "Tiffany": "6285157525510@c.us"
};

const produkId = {
  "Dhanar Rezawara": "6285743235688@c.us",
  "Azzam": "6285156256294@c.us"
};

const publikasiId = {
  "Muammar": "6285718046490@c.us"
};

const penjagaSidangId = {
  "Saleh Dury": "6281245122288@c.us",
  "Samsuddin": "6285341226665@c.us",
  "Herdin": "6285244695983@c.us"
};

const honorerId = {
  "Saleh Dury": "6281245122288@c.us",
  "Samsuddin": "6285341226665@c.us",
  "Rahmat Sandi": "6281243784318@c.us"
};

const employeeRecipients = runtimeConfig.employeeRecipients || [];
function fromPortal(hints, fallback) {
  const mapped = recipientsToMap(employeeRecipients, hints);
  return Object.keys(mapped).length > 0 ? mapped : fallback;
}

// Ekspor semua ID untuk digunakan di file lain
module.exports = {
  adminId,
  groupId,
  socketUrl,
  hakimIds: fromPortal(["hakim"], hakimIds),
  paniteraIds: fromPortal(["panitera"], paniteraIds),
  jurusitaIds: fromPortal(["jurusita"], jurusitaIds),
  ketuaId: fromPortal(["ketua"], ketuaId),
  paniteraId: fromPortal(["panitera"], paniteraId),
  sekretarisId: fromPortal(["sekretaris"], sekretarisId),
  panmudGugatanId: fromPortal(["panmud gugatan", "gugatan"], panmudGugatanId),
  panmudPermohonanId: fromPortal(["panmud permohonan", "permohonan"], panmudPermohonanId),
  panmudHukumId: fromPortal(["panmud hukum", "hukum"], panmudHukumId),
  paniteraPenggantiId: fromPortal(["panitera pengganti", "pp"], paniteraPenggantiId),
  kasubagKepegawaianId: fromPortal(["kepegawaian"], kasubagKepegawaianId),
  kasubagPtipId: fromPortal(["ptip"], kasubagPtipId),
  kasubagUmumId: fromPortal(["umum"], kasubagUmumId),
  kasirId: fromPortal(["kasir"], kasirId),
  tabayunId: fromPortal(["tabayun"], tabayunId),
  petugasArsipId: fromPortal(["arsip"], petugasArsipId),
  ptspId: fromPortal(["ptsp"], ptspId),
  produkId: fromPortal(["produk"], produkId),
  publikasiId: fromPortal(["publikasi"], publikasiId),
  penjagaSidangId: fromPortal(["sidang"], penjagaSidangId),
  honorerId: fromPortal(["honorer"], honorerId)
};
