/**
 * Jembatan TIRUAN untuk ALETA Bot - hanya untuk pengembangan tampilan.
 *
 * =============================================================================
 * UNTUK APA
 * =============================================================================
 *
 * Halaman penetapan, kesiapan akun, dan panel e-Court semuanya bergantung pada
 * rantai: portal -> aleta_bot (127.0.0.1:3003) -> MySQL SIPP (192.168.10.10).
 * Ketika server kantor mati, seluruh rantai itu putus dan halaman-halamannya
 * berbunyi "pemetaan jabatan tidak terbaca" - tidak ada tampilan yang dapat
 * dikerjakan.
 *
 * Berkas ini berdiri di tempat bot, menjawab operasi yang dipakai portal dengan
 * DATA CONTOH, supaya tata letak dan alurnya dapat dikerjakan tanpa server.
 *
 * =============================================================================
 * DATANYA CONTOH - INI TIDAK BOLEH SAMPAI DISALAHPAHAMI
 * =============================================================================
 *
 * Susunan majelis, nomor perkara, dan tanggal di sini DIKARANG. Struktur dan
 * namanya sengaja dibuat menyerupai keadaan sesungguhnya supaya tampilannya
 * terasa benar - dan justru karena itu ia mudah tertukar. Tiga penjaga:
 *
 *   1. Setiap jawaban membawa ruas "sumber": "jembatan-tiruan-lokal".
 *   2. Setiap permintaan dicatat ke layar, jadi jelas siapa yang menjawab.
 *   3. Ia hanya mendengar di 127.0.0.1 - tidak dapat dijangkau komputer lain.
 *
 * JANGAN pernah menyimpulkan keadaan perkara sungguhan dari tampilan yang
 * dijawab berkas ini, dan jangan menjalankannya di server.
 *
 * =============================================================================
 * MENJALANKAN
 * =============================================================================
 *
 *   node scripts/dev/jembatan-tiruan-bot.mjs
 *
 * Alamatnya mengikuti ALETA_BOT_BASE_URL di .env.local (bawaan 127.0.0.1:3003).
 * Tokennya tidak diperiksa: yang berharga tidak ada di sini, dan menolak
 * permintaan karena token hanya akan menyamarkan salah setel sebagai bot mati.
 */

import http from "node:http";

const PORT = Number(process.env.PORT || 3003);
const HOST = "127.0.0.1";

// --- Data contoh -------------------------------------------------------------
//
// Strukturnya mengikuti bentuk yang sungguhan: hakim bergrup "Ketua/Wakil
// Ketua" atau "Hakim", panitera dan juru sita terpisah, dan tiap orang punya
// pejabatId berupa ANGKA - itulah yang dipakai SIPP, bukan namanya.

const akun = (username, namaLengkap, grup, pejabatId, kode = "") => ({
  username,
  namaLengkap,
  grup,
  pejabatId,
  kode,
  nama: namaLengkap,
  nip: "",
  aktif: true,
  diblokir: false,
  kedaluwarsa: false,
  terakhirMasuk: "2026-09-01T08:00:00.000Z",
});

const PEMETAAN = {
  hakim: [
    akun("fahri", "FAHRI SAIFUDDIN, S.H.I., M.H.", "Ketua/Wakil Ketua", "32"),
    akun("sudarmin", "SUDARMIN H.I.M. TANG, S.H.I.,M.H", "Ketua/Wakil Ketua", "33"),
    akun("Himawan", "HIMAWAN TATURA WIJAYA, S.H.I.,M.H.", "Hakim", "34", "C1"),
    akun("Idris", "IDRIS, S.H.I., M.H.", "Hakim", "28", "C2"),
    akun("derry briantono", "DERRY BRIANTONO, S.H.", "Hakim", "31", "C3"),
  ],
  panitera: [akun("Sri Susilowati", "SRI SUSILOWATI, S.H.", "Panitera/Wakil Panitera", "26")],
  jurusita: [
    akun("syukri", "MOHAMMAD SYUKRI", "Juru Sita", "22"),
    akun("fikrianto", "FIKRIANTO", "Juru Sita Pengganti", "24"),
  ],
};

const USULAN_CONTOH = {
  ok: true,
  perkaraId: "10096",
  tanggalPenetapan: "2026-09-04",
  pmh: {
    bentuk: "majelis",
    majelisKode: "B",
    anggota: [{ hakimId: "33" }, { hakimId: "28" }, { hakimId: "31" }],
    sebab: "giliran majelis (data contoh)",
  },
  ppp: { usulan: { paniteraId: "26" }, sebab: "beban paling sedikit tahun ini (data contoh)" },
  pjs: {
    usulan: { jurusitaId: "22", nama: "MOHAMMAD SYUKRI", dugaanBerhalangan: false },
    sebab: "giliran juru sita (data contoh)",
  },
  phs: { usulan: "2026-09-15", sebab: "hari sidang Majelis B - Selasa (data contoh)" },
};

// --- Operasi jembatan SQL ----------------------------------------------------

const OPERASI = {
  "jabatan.pemetaanAkun": () => PEMETAAN,
  "case.scheduleByDate": () => ({ rows: [] }),
};

// --- Titik akhir langsung ----------------------------------------------------
//
// Yang belum ditulis di sini sengaja dijawab ok:false berisi keterangan, BUKAN
// dibiarkan menggantung. Permintaan yang menggantung membuat halaman berputar
// tanpa akhir, dan itu jauh lebih membingungkan daripada penolakan yang jelas.

const RUTE = {
  "/internal/aleta-bot/status": () => ({
    ok: true,
    data: { online: true, whatsapp: "disconnected", catatan: "jembatan tiruan lokal" },
  }),
  "/internal/aleta-bot/penunjukan/usulan": () => ({ ok: true, data: USULAN_CONTOH }),
  "/internal/aleta-bot/penunjukan/periksa": () => ({ ok: true, data: { ok: true, temuan: [] } }),
  "/internal/aleta-bot/sipp/konteks": () => ({
    ok: true,
    data: {
      ok: true,
      nomorPerkara: "545/Pdt.G/2026/PA.Dgl",
      perkaraId: "10096",
      dokumen: [],
      diperiksa: new Date().toISOString(),
    },
  }),
  "/internal/aleta-bot/jlf/sipp/query": (badan) => {
    const operasi = String(badan?.operation || "");
    const jawab = OPERASI[operasi];
    if (!jawab) {
      return { ok: false, error: `Operasi "${operasi}" belum ada di jembatan tiruan.` };
    }
    return { ok: true, data: jawab(badan?.params ?? {}) };
  },
};

function bacaBadan(req) {
  return new Promise((selesai) => {
    let data = "";
    req.on("data", (potong) => {
      data += potong;
    });
    req.on("end", () => {
      try {
        selesai(data ? JSON.parse(data) : {});
      } catch {
        selesai({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const jalur = (req.url || "").split("?")[0];
  const badan = req.method === "POST" ? await bacaBadan(req) : {};

  const penangan = RUTE[jalur];
  const hasil = penangan
    ? penangan(badan)
    : { ok: false, error: `Titik akhir "${jalur}" belum ada di jembatan tiruan.` };

  // Penanda sumber ikut di SETIAP jawaban - termasuk yang gagal. Inilah yang
  // membedakannya dari bot sungguhan bila kelak ada yang memeriksa jejaknya.
  const isi = JSON.stringify({ ...hasil, sumber: "jembatan-tiruan-lokal" });

  const tanda = hasil.ok ? "OK " : "-- ";
  const tambahan = badan?.operation ? ` (${badan.operation})` : "";
  process.stdout.write(`${tanda}${req.method} ${jalur}${tambahan}\n`);

  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  res.end(isi);
});

server.listen(PORT, HOST, () => {
  process.stdout.write(
    [
      "",
      "  JEMBATAN TIRUAN ALETA BOT - DATA CONTOH, BUKAN DATA PERKARA",
      `  mendengar di http://${HOST}:${PORT}`,
      "",
      "  Dipakai hanya untuk mengerjakan tampilan selagi server kantor mati.",
      "  Setiap jawaban ditandai sumber: jembatan-tiruan-lokal.",
      "",
    ].join("\n")
  );
});
