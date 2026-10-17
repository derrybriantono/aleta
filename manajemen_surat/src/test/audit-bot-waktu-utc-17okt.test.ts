/**
 * Audit bot 17 Okt 2026 - waktu bot yang ditulis toMysqlDate (UTC) dibaca kembali.
 *
 * Driver `mysql` (tanpa dateStrings) mengubah DATETIME menjadi Date dengan
 * menafsirkan teksnya sebagai waktu LOKAL peti (TZ Asia/Makassar), dan
 * botDbService.fromMysqlDate membiarkan Date apa adanya. Terukur atas
 * aleta_bot laptop dengan driver sungguhan: kh-9906 (hadir 10.37 WITA, kunci
 * ms 1789007876081) terbaca jam "02:37". Pembaca baru (F3.2 kehadiran rinci,
 * L2 dokumen e-Court) kini memilih teks lewat DATE_FORMAT, lalu menegaskannya UTC.
 *
 * Tiruan di bawah meniru driver: kolom mentah -> Date LOKAL dari teks UTC-nya;
 * kolom DATE_FORMAT -> teks.
 */
import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import path from "node:path";

const akar = path.resolve(process.cwd(), "..");
const req = createRequire(path.join(akar, "aleta_bot/package.json"));

/** Seperti driver mysql: "YYYY-MM-DD HH:MM:SS" -> Date lokal. */
const dateDriver = (teks: string) => {
  const [t, j] = teks.split(" ");
  const [y, m, d] = t.split("-").map(Number);
  const [hh, mm, ss] = j.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, ss);
};
const jamLokal = (w: Date) => `${String(w.getHours()).padStart(2, "0")}:${String(w.getMinutes()).padStart(2, "0")}`;
const tglLokal = (w: Date) =>
  `${w.getFullYear()}-${String(w.getMonth() + 1).padStart(2, "0")}-${String(w.getDate()).padStart(2, "0")}`;

describe("kehadiranAntrianService.daftarKehadiran - jam dari waktu UTC", () => {
  it("jam hadir/pulang/diperiksa = jam setempat kejadiannya, bukan jam UTC", async () => {
    const botDbPath = req.resolve(path.join(akar, "aleta_bot/services/botDbService.js"));
    const asli = req(botDbPath);
    const layananPath = req.resolve(path.join(akar, "aleta_bot/services/kehadiranAntrianService.js"));
    delete req.cache[layananPath];
    const hadir = new Date("2026-09-10T02:37:56Z"); // 10.37 WITA
    const pulang = new Date("2026-09-10T03:15:00Z");
    const simpan = (w: Date) => asli.toMysqlDate(w) as string;
    const tiruan = {
      ...asli,
      query: async (sql: string) => {
        if (!/FROM aleta_bot_antrian_kehadiran/.test(sql) || !/^\s*SELECT/i.test(sql)) return [];
        const pilih = (kolom: string, nilai: string) => (new RegExp(`DATE_FORMAT\\(${kolom},`).test(sql) ? nilai : dateDriver(nilai));
        return [
          {
            id: "kh-9906-1789007876081-7d6c4562",
            perkaraId: "9906",
            peran: "saksi",
            urutanPihak: "1",
            sebagaiKuasa: 0,
            nama: "Siti",
            sisi: "saksi",
            waktuHadir: pilih("waktu_hadir", simpan(hadir)),
            sumber: "aleta",
            waChatId: "",
            saksiUntuk: "pihak_1",
            pulangPada: pilih("pulang_pada", simpan(pulang)),
            diperiksaPada: null,
          },
        ];
      },
    };
    req.cache[botDbPath]!.exports = tiruan;
    try {
      const layanan = req(layananPath);
      const peta = await layanan.daftarKehadiran(["9906"], "2026-09-10");
      const orang = peta["9906"].hadir[0];
      expect(orang.jam).toBe(jamLokal(hadir));
      expect(orang.pulangJam).toBe(jamLokal(pulang));
      expect(orang.waktuHadir).toBe(hadir.toISOString());
      expect(orang.diperiksaJam).toBe("");
    } finally {
      req.cache[botDbPath]!.exports = asli;
      delete req.cache[layananPath];
    }
  });
});

describe("sippIdeL2Service - tanggal unggah dokumen e-Court dari waktu UTC", () => {
  const layanan = req(path.join(akar, "aleta_bot/services/sippIdeL2Service.js"));

  it("waktuUtc menegaskan teks bot sebagai UTC", () => {
    expect(layanan.waktuUtc("2026-10-15 23:30:00").toISOString()).toBe("2026-10-15T23:30:00.000Z");
    expect(layanan.waktuUtc("")).toBeNull();
  });

  it("unggahan 07.30 WITA (23.30 UTC hari sebelumnya) bertanggal hari setempatnya", async () => {
    const unggah = new Date("2026-10-15T23:30:00Z"); // 16 Okt 07.30 WITA
    let sqlBot = "";
    const h = await layanan.faktaBanyakPerkara([11], {
      kueri: async () => [],
      skema: { tabelAda: async () => true },
      sita: async () => ({ sita: {}, eksekusi: {} }),
      bahanPenanda: async () => ({ izinCerai: {}, terbaca: { izinCerai: true } }),
      durasi: async () => ({}),
      nomorPer: { "11": "601/Pdt.G/2026/PA.Dgl" },
      botKueri: async (sql: string) => {
        sqlBot = sql;
        const teks = "2026-10-15 23:30:00";
        return [
          {
            nomorPerkara: "601/Pdt.G/2026/PA.Dgl",
            judulDokumen: "Replik",
            statusVerifikasi: "belum",
            diunggahPada: /DATE_FORMAT\(diunggah_pada,/.test(sql) ? teks : dateDriver(teks),
            terlihat: /DATE_FORMAT\(terakhir_terlihat,/.test(sql) ? teks : dateDriver(teks),
          },
        ];
      },
      ecourtStore: { dokumenMenungguMajelis: () => true },
    });
    expect(sqlBot).toMatch(/^\s*SELECT/);
    const dok = h.dokumen["601/pdt.g/2026/pa.dgl"][0];
    expect(dok.diunggah).toBe(tglLokal(unggah));
    expect(dok.terlihat).toBe(tglLokal(unggah));
  });
});
