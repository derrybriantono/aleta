"use strict";

/**
 * Perintah chat WhatsApp untuk e-Court, khusus nomor super admin.
 *
 *   ecourt status    sesi hidup/mati dan penarikan terakhir
 *   ecourt tarik     tarik sekarang (plus susulan bila ada rentang terlewat)
 *   ecourt masuk     minta captcha untuk login ulang
 *   ecourt batal     batalkan captcha yang sedang menunggu
 *   ecourt ringkas   ringkasan hari ini: perkara baru, dokumen baru, menunggu
 *
 * Pesan dari nomor lain TIDAK ditangani di sini (mengembalikan null) sehingga
 * mengalir ke penanganan chat biasa. Jawaban captcha (kode pada gambar) juga
 * lewat sini lebih dulu - lihat ecourtPulihService.tanganiJawaban.
 *
 * Balasan dikembalikan sebagai teks; app.js mengirimnya lewat balasChat, satu
 * pintu keluar yang sama dengan menu chat lain. Pemberitahuan proaktif
 * (captcha, hasil penarikan) lewat antrean kirim di ecourtPulihService.
 */

const pulih = require("./ecourtPulihService");
const logService = require("./logService");

const alat = {
  botDb: () => require("./botDbService"),
  store: () => require("./ecourtStoreService"),
  jadwal: () => require("./ecourtSchedulerService"),
  akun: () => require("./ecourtAkunService"),
  sekarang: () => Date.now(),
};

function aturAlat(baru = {}) {
  Object.assign(alat, baru);
}

const BANTUAN = [
  "*Perintah e-Court (khusus super admin)*",
  "- *ecourt status* - sesi dan penarikan terakhir",
  "- *ecourt tarik* - tarik sekarang (plus susulan)",
  "- *ecourt masuk* - minta captcha untuk login ulang",
  "- *ecourt batal* - batalkan captcha yang menunggu",
  "- *ecourt ringkas* - ringkasan hari ini",
].join("\n");

/** Mengurai "ecourt <perintah>" / "e-court <perintah>". null bila bukan. */
function uraiPerintah(teks) {
  const cocok = String(teks || "")
    .trim()
    .match(/^(?:ecourt|e-court)(?:\s+([a-z]+))?\s*$/i);
  if (!cocok) return null;
  return (cocok[1] || "bantuan").toLowerCase();
}

function jejakPerintah(perintah) {
  try {
    void logService.logSecurityEvent({
      eventType: "ecourt_wa_perintah",
      severity: "info",
      message: `Perintah e-Court lewat WhatsApp: ${perintah}.`,
      metadata: { perintah, jalur: "whatsapp" },
    });
  } catch {
    /* jejak gagal tidak menggagalkan perintah */
  }
}

async function ringkasHariIni() {
  const botDb = alat.botDb();
  const store = alat.store();
  const awal = botDb.SQL_AWAL_HARI_SETEMPAT;
  try {
    const dok = await botDb.query(
      `SELECT
         COUNT(*) AS dokumen_baru
       FROM aleta_bot_ecourt_documents
       WHERE pertama_terlihat >= ${awal}`
    );
    const perkara = await botDb.query(
      `SELECT COUNT(*) AS perkara_baru FROM (
         SELECT nomor_perkara FROM aleta_bot_ecourt_documents
          WHERE nomor_perkara <> ''
          GROUP BY nomor_perkara
         HAVING MIN(pertama_terlihat) >= ${awal}
       ) x`
    );
    const menunggu = await botDb.query(
      `SELECT
         SUM(CASE WHEN ${store.sqlMenungguMajelis()} THEN 1 ELSE 0 END) AS menunggu_majelis,
         SUM(CASE WHEN status_verifikasi = 'valid' AND diberitahukan_pada IS NULL AND alasan_tidak_diberitahukan = '' THEN 1 ELSE 0 END) AS menunggu_kirim
       FROM aleta_bot_ecourt_documents`
    );
    const putaran = await botDb.query(
      `SELECT COUNT(*) AS putaran, SUM(berkas_terunduh) AS berkas
         FROM aleta_bot_ecourt_sync_runs
        WHERE dimulai_pada >= ${awal}`
    );
    const n = (baris, kunci) => Number((Array.isArray(baris) && baris[0] && baris[0][kunci]) || 0);
    return {
      ok: true,
      dokumenBaru: n(dok, "dokumen_baru"),
      perkaraBaru: n(perkara, "perkara_baru"),
      menungguMajelis: n(menunggu, "menunggu_majelis"),
      menungguKirim: n(menunggu, "menunggu_kirim"),
      putaran: n(putaran, "putaran"),
      berkasTerunduh: n(putaran, "berkas"),
    };
  } catch (galat) {
    return { ok: false, alasan: String((galat && galat.message) || galat).slice(0, 120) };
  }
}

function tanggalHariIni() {
  const b = alat.jadwal().bagianWaktu(new Date(alat.sekarang()));
  const [y, m, d] = b.tanggal.split("-");
  return `${d}-${m}-${y}`;
}

async function perintahRingkas() {
  const r = await ringkasHariIni();
  if (!r.ok) return `Ringkasan e-Court hari ini tidak dapat dibaca dari basis data bot (${r.alasan}).`;
  return [
    `*Ringkasan e-Court ${tanggalHariIni()}*`,
    `- Perkara baru terbaca: ${r.perkaraBaru}`,
    `- Dokumen baru terbaca: ${r.dokumenBaru}`,
    `- Unggahan menunggu verifikasi majelis: ${r.menungguMajelis}`,
    `- Dokumen valid belum diberitahukan: ${r.menungguKirim}`,
    `- Putaran penarikan hari ini: ${r.putaran} (${r.berkasTerunduh} berkas terunduh)`,
  ].join("\n");
}

async function perintahStatus() {
  const jadwal = alat.jadwal();
  const st = jadwal.getStatus();
  const ps = pulih.getStatus();

  let sesiTeks;
  if (st.sedangJalan || st.adaPenarikanLain) {
    sesiTeks = "hidup (penarikan sedang berjalan)";
  } else if (ps.menungguCaptcha) {
    sesiTeks = "mati - menunggu jawaban captcha";
  } else {
    const hasil = await pulih.periksaSemuaSesi();
    sesiTeks =
      hasil.keadaan === "hidup"
        ? `hidup${hasil.slotHidup ? ` (akun ${hasil.slotHidup})` : ""}`
        : hasil.keadaan === "mati"
          ? "MATI - ketik *ecourt masuk*"
          : "tidak dapat dipastikan (menunggu penegasan e-Court)";
  }

  const terakhirMs = ps.terakhirBerhasilMs || (st.terakhirSelesai && st.terakhirKode === 0 ? Date.parse(st.terakhirSelesai) : 0);
  const baris = [
    "*Status e-Court*",
    `- Sesi: ${sesiTeks}`,
    `- Penarikan berhasil terakhir: ${terakhirMs ? pulih.teksWaktu(terakhirMs) : "belum tercatat"}`,
    `- Penjadwal: ${st.pengaturan && st.pengaturan.aktif ? "menyala" : "mati"}${st.sedangJalan ? ", sedang menarik" : ""}`,
  ];
  if (ps.ditunda) baris.push("- Captcha menunggu jam aman kirim");
  if (st.terakhirCatatan) baris.push(`- Catatan penarikan terakhir: ${st.terakhirCatatan}`);
  return baris.join("\n");
}

async function perintahTarik() {
  const st = alat.jadwal().getStatus();
  if (st.sedangJalan || st.adaPenarikanLain) return "Penarikan sedang berjalan. Hasilnya saya kabari setelah selesai.";

  const sesi = await pulih.periksaSemuaSesi();
  if (sesi.keadaan === "mati") {
    const h = await pulih.sesiMati({ sumber: "perintah-tarik", manual: true });
    return h && h.diurus
      ? "Sesi e-Court mati. Captcha dikirim - balas dengan kodenya, lalu penarikan berjalan sendiri."
      : `Sesi e-Court mati dan captcha tidak dapat dibuat (${(h && h.alasan) || "tidak diketahui"}). Login dari ALETA - menu Integrasi e-Court.`;
  }
  const hasil = await pulih.tarikSusulan({ alasan: "perintah_wa", manual: true });
  if (!hasil.dimulai) return `Penarikan tidak dimulai (${hasil.alasan}).`;
  return `Penarikan dimulai (rentang ${hasil.tanggal[0]} s.d. ${hasil.tanggal[hasil.tanggal.length - 1]}, ${hasil.jumlahPerkara} perkara bersidang diutamakan). Hasilnya saya kabari setelah selesai.`;
}

async function perintahMasuk() {
  const sesi = await pulih.periksaSemuaSesi();
  if (sesi.keadaan === "hidup") {
    return `Sesi e-Court masih hidup${sesi.slotHidup ? ` (akun ${sesi.slotHidup})` : ""}; tidak perlu login. Balas *ecourt tarik* untuk menarik sekarang.`;
  }
  const h = await pulih.sesiMati({ sumber: "perintah-masuk", manual: true });
  if (h && h.diurus) {
    if (h.alasan === "captcha_sudah_dikirim") return "Captcha sudah dikirim dan masih menunggu jawaban Anda.";
    if (h.alasan === "petugas_sedang_login_portal") return "Ada petugas yang sedang login dari portal. Tunggu atau selesaikan dari sana.";
    return "Captcha sedang dikirim. Balas dengan kode pada gambar.";
  }
  if (h && h.alasan === "kredensial_belum_tersimpan") {
    return "Surel dan sandi akun e-Court belum tersimpan di ALETA, sedangkan sandi tidak boleh dikirim lewat WhatsApp. Simpan dahulu dari ALETA - menu Integrasi e-Court.";
  }
  return `Captcha tidak dapat dibuat (${(h && h.alasan) || "tidak diketahui"}). Login dari ALETA - menu Integrasi e-Court.`;
}

/**
 * Titik masuk dari app.js.
 *
 * @param {{ pengirim: string, teks: string, terkutip?: boolean }} masukan
 * @returns {Promise<{ reply: string } | null>} null = bukan urusan layanan ini
 */
async function tanganiPesan({ pengirim, teks, terkutip = false } = {}) {
  // Hanya super admin. Nomor lain jatuh ke penanganan biasa tanpa jawaban,
  // supaya keberadaan perintah ini tidak terlihat dari luar.
  if (!pulih.dariAdmin(pengirim)) return null;

  const perintah = uraiPerintah(teks);
  if (perintah === null) {
    return pulih.tanganiJawaban({ pengirim, teks, terkutip });
  }

  jejakPerintah(perintah);
  try {
    switch (perintah) {
      case "status":
        return { reply: await perintahStatus() };
      case "tarik":
        return { reply: await perintahTarik() };
      case "masuk":
        return { reply: await perintahMasuk() };
      case "ringkas":
        return { reply: await perintahRingkas() };
      case "batal":
        return {
          reply: pulih.batalkanCaptcha() ? "Captcha dibatalkan." : "Tidak ada captcha yang sedang menunggu.",
        };
      case "bantuan":
      case "help":
        return { reply: BANTUAN };
      default:
        // "ecourt <kata lain>" - bisa jadi "ecourt ABC12" (kode captcha).
        return (await pulih.tanganiJawaban({ pengirim, teks, terkutip })) || { reply: BANTUAN };
    }
  } catch (galat) {
    void logService.logSystemEvent({
      eventType: "ecourt_wa_perintah_gagal",
      severity: "warning",
      message: "Perintah e-Court lewat WhatsApp gagal diproses.",
      metadata: { perintah, errorMessage: String((galat && galat.message) || galat).slice(0, 200) },
    });
    return { reply: "Perintah e-Court gagal diproses. Coba lagi, atau lihat catatan sistem ALETA." };
  }
}

module.exports = { BANTUAN, aturAlat, ringkasHariIni, tanganiPesan, uraiPerintah };
