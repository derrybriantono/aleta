/**
 * Tahap 1a-1c rencana agen: dua jalur AI, dan penyamaran isi perkara.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI ADALAH ARAH SALAHNYA
 * ============================================================================
 *
 * Penyamaran yang terlalu rajin hanya membuat kalimat hambar. Penyamaran yang
 * kelewatan membuat nama orang keluar dari peladen pengadilan ke peladen
 * perusahaan lain, dan itu tidak dapat ditarik kembali. Jadi tiap uji di sini
 * dipilih untuk menjaga arah yang kedua:
 *
 *   - gerbang jalur "perkara" MENOLAK tanpa bukti penyamaran - bukan
 *     memperingatkan, bukan mencatat lalu mengirim;
 *   - sisa yang masih menyerupai data pribadi menahan pengiriman, kecuali
 *     seseorang menyatakan tegas bahwa sisa itu memang bukan data pribadi;
 *   - pemindai sisa tidak memindai penandanya sendiri, sebab laporan yang
 *     menuduh pekerjaannya sendiri akan berhenti dipercaya.
 *
 * Angka yang menyertainya bukan karangan. Diukur atas 150 posita SUNGGUHAN di
 * sipp_donggala setempat (scripts/ukur-penyamaran.js): 147 bersih, 4 sisa -
 * dua di antaranya nama orang yang memang tidak tercatat di SIPP mana pun.
 */
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

const require_ = createRequire(import.meta.url);
const AKAR_BOT = path.resolve(__dirname, "../../../aleta_bot");
const penyamaran = require_(path.join(AKAR_BOT, "services/penyamaranPerkaraService.js"));
const adapter = require_(path.join(AKAR_BOT, "services/aiProviderAdapter.js"));
const konfig = require_(path.join(AKAR_BOT, "services/aiRuntimeConfigService.js"));

const PIHAK = [
  { nama: "Zakina binti Lukman", peran: "penggugat" },
  { nama: "Moh. Nurnas Islam alias Muhammad Nurnas Islam Bin Hi. Nasruddin", peran: "tergugat" },
  { nama: "Uwais Alqorni", peran: "anak" },
  { nama: "Fathiyah Lasyira", peran: "anak" },
];

describe("kamus penyamaran disusun dari pihak yang DIKETAHUI, bukan ditebak", () => {
  it("nama penuh diganti sebelum potongannya - hasilnya tidak setengah tersamar", () => {
    const kamus = penyamaran.susunKamus(PIHAK);
    const { teks } = penyamaran.samarkan("Zakina binti Lukman menggugat suaminya.", kamus);
    expect(teks).toBe("[PENGGUGAT] menggugat suaminya.");
    expect(teks).not.toContain("binti Lukman");
  });

  it("nama yang disebut sepotong tetap tertangkap", () => {
    const kamus = penyamaran.susunKamus(PIHAK);
    expect(penyamaran.samarkan("Menurut Zakina, rumah tangga sudah retak.", kamus).teks).toContain("[PENGGUGAT]");
  });

  it("huruf besar-kecil tidak menyelamatkan nama - posita kerap KAPITAL SELURUHNYA", () => {
    const kamus = penyamaran.susunKamus(PIHAK);
    expect(penyamaran.samarkan("anak bernama UWAIS ALQORNI", kamus).teks).toBe("anak bernama [ANAK-1]");
  });

  it("anak diberi nomor; penggugat tunggal tidak - nomor yang tidak perlu hanya derau", () => {
    const kamus = penyamaran.susunKamus(PIHAK);
    const hasil = penyamaran.samarkan("Uwais Alqorni dan Fathiyah Lasyira diasuh Zakina.", kamus);
    expect(hasil.teks).toContain("[ANAK-1]");
    expect(hasil.teks).toContain("[ANAK-2]");
    expect(hasil.teks).toContain("[PENGGUGAT]");
    expect(hasil.teks).not.toContain("[PENGGUGAT-1]");
  });

  it("kata sambung nama tidak menjadi kata kunci - 'bin' dan 'binti' tidak boleh mencabik kalimat", () => {
    const kamus = penyamaran.susunKamus([{ nama: "Erik bin Aris T", peran: "tergugat" }]);
    expect(kamus.some((k: { asal: string }) => k.asal.toLowerCase() === "bin")).toBe(false);
    expect(penyamaran.samarkan("Perkara ini bin rumit sekali", kamus).teks).toContain("bin rumit");
  });

  it("potongan yang terlalu pendek tidak dipakai - 'Hi.' akan mencabik kata lain", () => {
    const kamus = penyamaran.susunKamus(PIHAK);
    for (const k of kamus as Array<{ asal: string }>) {
      if (k.asal.includes(" ")) continue;
      expect(k.asal.length).toBeGreaterThanOrEqual(penyamaran.PANJANG_MIN_POTONGAN);
    }
  });

  it("NIK, NIP, telepon, dan surel ditutup tanpa perlu tahu siapa pemiliknya", () => {
    const { teks, perKategori } = penyamaran.samarkan(
      "NIK 7208010101900001, telepon 081234567890, surel budi@contoh.co.id",
      []
    );
    expect(teks).toContain("[NIK]");
    expect(teks).toContain("[TELEPON]");
    expect(teks).toContain("[SUREL]");
    expect(perKategori.NIK).toBe(1);
  });
});

describe("pemindai sisa MELAPORKAN, tidak mengubah", () => {
  it("nama yang tidak ada di kamus dilaporkan - inilah yang menahan pengiriman", () => {
    const hasil = penyamaran.siapkanMuatan({
      teks: "Saksi bernama BUDI KALESU menerangkan hal itu.",
      pihak: PIHAK,
    });
    expect(hasil.bukti.bersih).toBe(false);
    expect(JSON.stringify(hasil.bukti.sisa)).toContain("BUDI KALESU");
    // Teksnya TIDAK diubah oleh pemindai - ia hanya melapor.
    expect(hasil.teks).toContain("BUDI KALESU");
  });

  it("penanda hasil penyamaran sendiri tidak dilaporkan sebagai kebocoran", () => {
    // Diukur: "[TURUT TERGUGAT-1]" sempat dilaporkan sebagai "nama diduga",
    // yaitu laporan yang menuduh pekerjaannya sendiri.
    const temuan = penyamaran.periksaSisa("Gugatan [TURUT TERGUGAT-1] terhadap [SAKSI-2] dan [PENGGUGAT].");
    expect(temuan).toEqual([]);
  });

  it("kosakata hukum dan nama satker sendiri bukan nama orang", () => {
    // Nama satker berdiri di kepala hampir tiap naskah. Melaporkannya pada
    // tiap berkas membuat laporan penuh derau - dan laporan berderau berhenti
    // dibaca, yang justru membuat kebocoran sungguhan ikut terlewat.
    expect(penyamaran.periksaSisa("PENGADILAN AGAMA DONGGALA menjatuhkan PUTUSAN")).toEqual([]);
  });

  it("kata yang diketahui bukan nama dapat ditambahkan pemanggil, bukan ditumpuk ke kode", () => {
    // Daftar yang terus tumbuh pada akhirnya akan memuat nama seseorang, dan
    // sejak saat itu nama itu lolos diam-diam pada SETIAP perkara.
    expect(penyamaran.periksaSisa("laporan ke POLDA SULAWESI TENGAH")).toHaveLength(1);
    expect(penyamaran.periksaSisa("laporan ke POLDA SULAWESI TENGAH", ["SULAWESI", "TENGAH"])).toEqual([]);
    // Nama orang tetap tertangkap walau daftar dikenal diberikan.
    expect(penyamaran.periksaSisa("saksi BUDI KALESU hadir", ["SULAWESI"])).toHaveLength(1);
  });

  it("posita yang memang tidak menyebut nama menghasilkan nol penggantian - dan itu benar", () => {
    // Diukur: 18 dari 150 posita menulis "Penggugat"/"Tergugat" sepanjang
    // kalimat, tanpa satu pun nama. Nol penggantian di situ bukan kegagalan.
    const hasil = penyamaran.siapkanMuatan({
      teks: "Bahwa Penggugat dan Tergugat menikah pada tahun 2019 di KUA Kecamatan Banawa.",
      pihak: PIHAK,
    });
    expect(hasil.bukti.jumlahPenggantian).toBe(0);
    expect(hasil.bukti.bersih).toBe(true);
  });

  it("nomor perkara ikut ditanggalkan - ia menautkan seluruh isinya ke satu berkas", () => {
    const hasil = penyamaran.siapkanMuatan({
      teks: "Perkara 492/Pdt.G/2026/PA.Dgl diperiksa hari ini.",
      pihak: [],
      nomorPerkara: "492/Pdt.G/2026/PA.Dgl",
    });
    expect(hasil.teks).toContain("[NOMOR PERKARA]");
    expect(hasil.teks).not.toContain("492/Pdt.G");
  });
});

describe("dua jalur AI, dan gerbang yang menolak", () => {
  it("jalur yang tidak dikenal jatuh ke 'umum', bukan ke 'perkara'", () => {
    // Arah amannya jelas: salah ketik tidak boleh membuka jalur isi perkara.
    expect(konfig.normalkanJalur("perkara")).toBe("perkara");
    expect(konfig.normalkanJalur("ngawur")).toBe("umum");
    expect(konfig.normalkanJalur()).toBe("umum");
  });

  it("setelan jalur berdiri sendiri - memindahkan jalur umum tidak ikut memindahkan isi perkara", () => {
    const config = {
      jalur: {
        umum: { provider: "openai", endpointUrl: "https://openrouter.ai/api/v1/chat/completions" },
        perkara: { provider: "llama", endpointUrl: "http://127.0.0.1:11434/v1/chat/completions" },
      },
    };
    expect(konfig.setelanJalur(config, "umum").endpointUrl).toContain("openrouter.ai");
    expect(konfig.setelanJalur(config, "perkara").endpointUrl).toContain("127.0.0.1");
  });

  it("jalur 'perkara' yang belum disetel berarti kosong - keadaan awal yang benar", () => {
    expect(konfig.setelanJalur({}, "perkara").provider).toBe("");
  });

  it("tanpa bukti penyamaran, jalur 'perkara' DILEMPAR - bukan dikirim lalu dicatat", () => {
    expect(() => adapter.gerbangJalurPerkara({ jalur: "perkara", penyamaran: null })).toThrow(/bukti penyamaran/i);
    expect(() =>
      adapter.gerbangJalurPerkara({ jalur: "perkara", penyamaran: { diterapkan: false } })
    ).toThrow(/bukti penyamaran/i);
  });

  it("sisa menahan pengiriman, kecuali dinyatakan tegas bukan data pribadi", () => {
    const bukti = { diterapkan: true, bersih: false, sisa: [{ jenis: "nama diduga (kapital)", jumlah: 2 }] };
    expect(() => adapter.gerbangJalurPerkara({ jalur: "perkara", penyamaran: bukti })).toThrow(/menyisakan/i);
    expect(() => adapter.gerbangJalurPerkara({ jalur: "perkara", penyamaran: bukti, izinkanSisa: true })).not.toThrow();
  });

  it("muatan bersih lewat; jalur 'umum' tidak dituntut bukti sama sekali", () => {
    const bersih = penyamaran.siapkanMuatan({ teks: "Penggugat dan Tergugat menikah 2019.", pihak: PIHAK });
    expect(bersih.bukti.bersih).toBe(true);
    expect(() => adapter.gerbangJalurPerkara({ jalur: "perkara", penyamaran: bersih.bukti })).not.toThrow();
    expect(() => adapter.gerbangJalurPerkara({ jalur: "umum" })).not.toThrow();
  });

  it("bukti membawa hitungannya, bukan sekadar 'aman'", () => {
    const hasil = penyamaran.siapkanMuatan({ teks: "Zakina menggugat Moh. Nurnas Islam.", pihak: PIHAK });
    expect(hasil.bukti.diterapkan).toBe(true);
    expect(hasil.bukti.jumlahPenggantian).toBeGreaterThan(0);
    expect(hasil.bukti.jumlahKamus).toBeGreaterThan(0);
    expect(typeof hasil.bukti.padaIso).toBe("string");
  });
});

describe("agregator: satu kunci banyak model, tanpa mengubah kode", () => {
  it("permintaan bentuk OpenAI menghormati endpointUrl - itulah yang membuat agregator dapat dipakai", () => {
    const fs = require_("node:fs") as typeof import("node:fs");
    const isi = fs.readFileSync(path.join(AKAR_BOT, "services/aiProviderAdapter.js"), "utf8");
    expect(isi).toContain('const endpoint = config.endpointUrl || defaultEndpoint("openai");');
  });

  it("nama model bebas - hanya gpt-3.5 yang sengaja dialihkan", () => {
    const fs = require_("node:fs") as typeof import("node:fs");
    const isi = fs.readFileSync(path.join(AKAR_BOT, "services/aiProviderAdapter.js"), "utf8");
    // Model id agregator seperti "meta-llama/llama-3.3-70b-instruct" harus
    // lewat apa adanya; kalau tidak, gonta-ganti model mustahil.
    expect(isi).toContain('if (provider === "openai" && value.includes("gpt-3.5")) return "gpt-4o-mini";');
  });
});

// ============================================================================
describe("blangko dua jalur di portal - sisa Tahap 1c", () => {
  const require2 = createRequire(import.meta.url);
  const fs2 = require2("node:fs") as typeof import("node:fs");
  const AKAR_PORTAL = path.resolve(__dirname, "../..");

  const layananAi = fs2.readFileSync(path.join(AKAR_PORTAL, "src/server/modules/ai/service.ts"), "utf8");
  const layananBot = fs2.readFileSync(path.join(AKAR_PORTAL, "src/server/modules/aleta-bot/service.ts"), "utf8");
  const tipe = fs2.readFileSync(path.join(AKAR_PORTAL, "src/lib/types.ts"), "utf8");

  it("dua jalur menjadi MODUL, bukan komponen baru - layar Pengaturan AI sudah menggambar satu baris per modul", () => {
    expect(tipe).toContain('| "aleta_bot_umum"');
    expect(tipe).toContain('| "aleta_bot_perkara"');
    expect(layananAi).toContain('key: "aleta_bot_umum"');
    expect(layananAi).toContain('key: "aleta_bot_perkara"');
    // Keterangannya menyebut akibatnya, bukan hanya namanya.
    expect(layananAi).toMatch(/Dibiarkan kosong berarti isi perkara tidak dikirim/);
  });

  it("pengenal alias memeriksa jalur SEBELUM aleta_bot - keduanya berawalan sama", () => {
    const letakUmum = layananAi.indexOf('normalized === "aleta_bot_umum"');
    const letakBot = layananAi.indexOf('normalized === "aleta_bot" ||');
    expect(letakUmum).toBeGreaterThan(0);
    expect(letakBot).toBeGreaterThan(letakUmum);
  });

  it("jalur ikut dikirim ke bot saat sinkronisasi", () => {
    expect(layananBot).toContain('umum: jalurUntukBot(globalAiConfig, "aleta_bot_umum")');
    expect(layananBot).toContain('perkara: jalurUntukBot(globalAiConfig, "aleta_bot_perkara")');
  });

  it("jalur PERKARA tidak boleh mewarisi sambungan global - ia harus dipilih", () => {
    // Mewarisi berarti posita berangkat ke penyedia mana pun yang kebetulan
    // dipasang orang untuk keperluan lain, tanpa satu keputusan yang menyebutnya.
    const badan = layananBot.slice(layananBot.indexOf("function jalurUntukBot("));
    const fungsi = badan.slice(0, badan.indexOf("\n}\n"));
    expect(fungsi).toContain('if (moduleKey === "aleta_bot_perkara" && (modul.inheritGlobal || !modul.configuredConnectionId))');
    // Yang dipilih menang atas yang diwariskan, untuk kedua jalur.
    expect(fungsi).toContain("modul.configuredConnectionId ?? modul.activeConnectionId");
  });

  it("kunci API tidak digandakan per jalur", () => {
    // Menyalin rahasia yang sama ke lebih banyak tempat tidak menambah satu pun
    // kemampuan; ia hanya menambah tempat ia dapat bocor.
    const badan = layananBot.slice(layananBot.indexOf("function jalurUntukBot("));
    expect(badan.slice(0, badan.indexOf("\n}\n"))).toContain('apiKeyEnvKey: ""');
  });
});
