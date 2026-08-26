import { describe, expect, it } from "vitest";

import {
  extractSqlParameters,
  formatTanggalIndonesia,
  geserTanggal,
  mendukungTanggalAcuan,
  tanggalHariIniPengadilan,
  findNotificationForQuery,
  pickRowValue,
  suggestTemplateIdForQuery,
} from "@/components/portal/aleta-bot-manual-send";
import { sanitizePublicErrorMessage } from "@/server/shared/error-sanitizer";

const queries = [
  { id: "legacy-hakim-sidang-hari-ini", category: "employee" },
  { id: "legacy-pihak-sebelum-sidang", category: "party" },
  { id: "sipp-pihak-sidang-per-tanggal", category: "party" },
  { id: "query-tanpa-kerabat", category: "public" },
];

const notifications = [
  { id: "hakim-sidang-hari-ini", queryId: "legacy-hakim-sidang-hari-ini", templateId: "hakim-jadwal-tugas-sidang", isActive: true },
  { id: "pihak-sebelum-sidang", queryId: "legacy-pihak-sebelum-sidang", templateId: "jadwal-sidang", isActive: false },
  { id: "pihak-sebelum-sidang-lama", queryId: "legacy-pihak-sebelum-sidang", templateId: "template-lama", isActive: false },
];

describe("findNotificationForQuery", () => {
  it("menemukan isi pesan pasangan sebuah sumber data", () => {
    const found = findNotificationForQuery(notifications, "legacy-hakim-sidang-hari-ini");
    expect(found?.templateId).toBe("hakim-jadwal-tugas-sidang");
  });

  it("mendahulukan notifikasi yang aktif bila satu query dipakai beberapa notifikasi", () => {
    const banyak = [
      { id: "nonaktif", queryId: "q1", templateId: "template-nonaktif", isActive: false },
      { id: "aktif", queryId: "q1", templateId: "template-aktif", isActive: true },
    ];
    expect(findNotificationForQuery(banyak, "q1")?.templateId).toBe("template-aktif");
  });

  it("memakai kandidat pertama bila tidak ada yang aktif", () => {
    expect(findNotificationForQuery(notifications, "legacy-pihak-sebelum-sidang")?.templateId).toBe("jadwal-sidang");
  });

  it("mengembalikan null untuk query tanpa notifikasi maupun pilihan kosong", () => {
    expect(findNotificationForQuery(notifications, "sipp-pihak-sidang-per-tanggal")).toBeNull();
    expect(findNotificationForQuery(notifications, "")).toBeNull();
  });
});

describe("suggestTemplateIdForQuery", () => {
  it("memakai pasangan langsung dari tab Notifikasi bila ada", () => {
    const hasil = suggestTemplateIdForQuery(notifications, queries, "legacy-hakim-sidang-hari-ini");
    expect(hasil).toEqual({ templateId: "hakim-jadwal-tugas-sidang", matchedNotification: true });
  });

  it("jatuh ke isi pesan sekategori untuk query kirim-manual berparameter tanggal", () => {
    // Query tanggal sengaja tidak dipakai notifikasi terjadwal, tapi operator
    // tetap harus dapat contoh isi pesan pihak, bukan kotak kosong.
    const hasil = suggestTemplateIdForQuery(notifications, queries, "sipp-pihak-sidang-per-tanggal");
    expect(hasil.templateId).toBe("jadwal-sidang");
    expect(hasil.matchedNotification).toBe(false);
  });

  it("tidak menebak bila tidak ada sumber data sekategori yang punya isi pesan", () => {
    expect(suggestTemplateIdForQuery(notifications, queries, "query-tanpa-kerabat")).toEqual({
      templateId: "",
      matchedNotification: false,
    });
  });

  it("tidak menebak untuk query yang tidak dikenal", () => {
    expect(suggestTemplateIdForQuery(notifications, queries, "tidak-ada")).toEqual({
      templateId: "",
      matchedNotification: false,
    });
  });
});

describe("extractSqlParameters", () => {
  it("membaca parameter tanggal dari SQL tanpa bantuan runtime bot", () => {
    const sql = "SELECT a.nama FROM pihak a WHERE a.tanggal_sidang = {{tanggal_sidang}}";
    expect(extractSqlParameters(sql)).toEqual(["tanggal_sidang"]);
  });

  it("membaca beberapa parameter dan membuang duplikat", () => {
    const sql = "SELECT 1 WHERE x = {{ tanggal_sidang }} AND y = {{jenis}} AND z = {{tanggal_sidang}}";
    expect(extractSqlParameters(sql)).toEqual(["tanggal_sidang", "jenis"]);
  });

  it("mengembalikan daftar kosong untuk SQL tanpa parameter dan input kosong", () => {
    expect(extractSqlParameters("SELECT 1 WHERE tanggal = CURDATE()")).toEqual([]);
    expect(extractSqlParameters("")).toEqual([]);
  });
});

describe("sanitizePublicErrorMessage untuk kegagalan koneksi bot", () => {
  it("melaporkan bot tidak terhubung, bukan gangguan AI", () => {
    const pesan = sanitizePublicErrorMessage(
      "ALETA Bot tidak dapat dihubungi di http://127.0.0.1:3003/internal/preview (fetch failed)."
    );
    expect(pesan).toContain("ALETA Bot belum dapat dihubungi");
  });

  it("tidak lagi menyalahartikan kata 'failed' sebagai masalah AI", () => {
    // Pola lama /ai/ ikut cocok dengan huruf "ai" di dalam kata "failed".
    expect(sanitizePublicErrorMessage("ECONNREFUSED: request failed")).not.toContain("Layanan AI");
  });

  it("tetap mengenali gangguan AI yang sesungguhnya", () => {
    // Harus berupa pesan teknis (di sini TypeError) agar masuk klasifikasi.
    expect(sanitizePublicErrorMessage("TypeError: gemini provider menolak permintaan")).toContain("Layanan AI");
  });

  it("membedakan gangguan WhatsApp Gateway dari kegagalan bot", () => {
    expect(sanitizePublicErrorMessage("Protocol error: target closed")).toContain("WhatsApp Gateway");
  });
});

describe("pickRowValue", () => {
  it("mengambil kolom sesuai nama yang dipakai sumber data", () => {
    const row = { nomor_perkara: "123/Pdt.G/2026/PA.Dgl", nama_pihak: "Siti", jenis_perkara_nama: "Cerai Gugat" };
    expect(pickRowValue(row, ["nomor_perkara", "no_perkara"])).toBe("123/Pdt.G/2026/PA.Dgl");
    expect(pickRowValue(row, ["jenis_perkara_nama", "jenis_perkara"])).toBe("Cerai Gugat");
  });

  it("memakai nama kolom alternatif bila sumber data memakai penamaan berbeda", () => {
    // Query legacy memakai "nama", query SQL baru memakai "nama_pihak".
    expect(pickRowValue({ nama: "Budi" }, ["nama_pihak", "nama"])).toBe("Budi");
    expect(pickRowValue({ NOMOR_PERKARA: "9/Pdt.P/2026" }, ["nomor_perkara"])).toBe("9/Pdt.P/2026");
  });

  it("melewati kolom yang ada tapi kosong", () => {
    expect(pickRowValue({ nama_pihak: "   ", nama: "Andi" }, ["nama_pihak", "nama"])).toBe("Andi");
  });

  it("mengembalikan string kosong bila baris tidak ada atau kolom tidak ditemukan", () => {
    expect(pickRowValue(undefined, ["nomor_perkara"])).toBe("");
    expect(pickRowValue({ lain: "x" }, ["nomor_perkara"])).toBe("");
  });
});

describe("tampilan tanggal pada parameter Kirim Manual", () => {
  it("menampilkan tanggal dalam bahasa Indonesia lengkap dengan harinya", () => {
    expect(formatTanggalIndonesia("2026-08-15")).toBe("Sabtu, 15 Agustus 2026");
  });

  it("mengembalikan apa adanya bila bukan format tanggal", () => {
    expect(formatTanggalIndonesia("")).toBe("");
    expect(formatTanggalIndonesia("bukan tanggal")).toBe("bukan tanggal");
  });

  it("menghitung hari ini memakai zona waktu pengadilan, bukan zona peramban", () => {
    expect(tanggalHariIniPengadilan()).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Bukti zona benar-benar dipakai: WITA (UTC+8) selalu lebih dulu atau sama
    // dengan Honolulu (UTC-10) yang berjarak 18 jam di belakangnya. Bila zona
    // diabaikan, keduanya akan selalu identik apa pun jamnya.
    const wita = tanggalHariIniPengadilan("Asia/Makassar");
    const honolulu = tanggalHariIniPengadilan("Pacific/Honolulu");
    expect(wita >= honolulu).toBe(true);
  });
});

describe("tanggal acuan berlaku untuk semua sumber data SQL", () => {
  it("mendukung SQL yang memuat CURDATE atau CURRENT_DATE", () => {
    expect(mendukungTanggalAcuan("SELECT 1 WHERE t = CURDATE()")).toBe(true);
    expect(mendukungTanggalAcuan("SELECT 1 WHERE t = CURRENT_DATE")).toBe(true);
  });

  it("mendukung SQL yang punya parameter tanggal", () => {
    expect(mendukungTanggalAcuan("SELECT 1 WHERE t = {{tanggal_sidang}}")).toBe(true);
  });

  it("kini juga mendukung sumber data jalur lama", () => {
    // Semula tidak didukung karena tanggalnya ditulis di notifikasi.js. Kini
    // CURDATE() jalur lama ikut digantikan saat eksekusi lewat satu pintu
    // db_config.js (lihat aleta_bot/services/legacyDateContext.js), sehingga
    // seluruh sumber data — termasuk jalur lama — bisa memakai tanggal acuan.
    expect(mendukungTanggalAcuan("legacy:notifikasi.getDataJadwalSidangPerdataHakim")).toBe(true);
  });

  it("tetap tidak mendukung pseudo-query portal atau runtime", () => {
    // Keduanya dieksekusi layanan khusus, bukan SQL, jadi tidak ada CURDATE()
    // yang bisa digantikan.
    expect(mendukungTanggalAcuan("runtime:antrianOnline.registerOnlineQueue")).toBe(false);
    expect(mendukungTanggalAcuan("portal:disposisi.deadline")).toBe(false);
  });

  it("tidak mendukung SQL tanpa unsur tanggal", () => {
    expect(mendukungTanggalAcuan("SELECT 1 WHERE x = 2")).toBe(false);
    expect(mendukungTanggalAcuan("")).toBe(false);
  });
});

describe("geserTanggal untuk pilihan cepat", () => {
  it("menggeser maju sesuai jumlah hari", () => {
    expect(geserTanggal("2026-07-28", 0)).toBe("2026-07-28");
    expect(geserTanggal("2026-07-28", 1)).toBe("2026-07-29");
    expect(geserTanggal("2026-07-28", 3)).toBe("2026-07-31");
  });

  it("menangani pergantian bulan dan tahun", () => {
    expect(geserTanggal("2026-07-30", 3)).toBe("2026-08-02");
    expect(geserTanggal("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("jatuh ke hari ini bila masukan bukan tanggal", () => {
    expect(geserTanggal("bukan tanggal", 0)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
