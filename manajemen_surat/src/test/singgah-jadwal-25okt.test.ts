// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { BarisRekamAntrian } from "@/lib/rekam-antrian";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import {
  cakupanJadwal,
  getGatewayJadwalSidangSinggah,
  kunciPinjaman,
} from "@/server/modules/aleta-bot/jadwal-sidang-singgah";
import { RUANG_SINGGAH, terkenaTulisan } from "@/server/modules/aleta-bot/singgah-tulisan";
import {
  catatKehadiranAntrian,
  enqueueGatewayMessage,
  gatewayPegawaiPenunjukan,
  getGatewayAntrianSidang,
  getGatewayTagPerkara,
  panggilAntrian,
  postGatewayTundaSidang,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { bacaRekamAntrian, rekamAntrian } from "@/server/modules/aleta-ecourt/rekam-antrian";
import { intipSinggah, keadaanSinggah, singgahSingkat, tandaiTulisan } from "@/server/shared/singgah-singkat";

/**
 * K2 + K6 (25 Okt 2026): singgahan yang hanya membuang kunci yang terkena,
 * jawaban disimpan sekali sebagai teks, layar publik meminjam jawaban layar
 * Jadwal, antrian bersinggah, dan rekamAntrian menulis hanya bila berubah.
 */

const PESAN_UJI = { sourceApp: "uji", sourceFeature: "uji", recipientNumber: "0000", message: "x" };
const tunda = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeEach(() => tandaiTulisan());

describe("tandaiTulisan selektif", () => {
  it("tanpa keterangan membuang semuanya (perilaku lama)", async () => {
    await singgahSingkat("a", "1", 60_000, async () => ({ n: 1 }));
    await singgahSingkat("b", "1", 60_000, async () => ({ n: 1 }));
    tandaiTulisan();
    expect(keadaanSinggah().kunci).toBe(0);
  });

  it("ruang kosong = tidak membuang apa pun", async () => {
    await singgahSingkat("a", "1", 60_000, async () => ({ n: 1 }));
    tandaiTulisan({ ruang: [] });
    expect(keadaanSinggah().kunci).toBe(1);
  });

  it("hanya ruang yang terkena yang dibuang", async () => {
    let jalanA = 0;
    let jalanB = 0;
    await singgahSingkat("a", "1", 60_000, async () => ({ n: ++jalanA }));
    await singgahSingkat("b", "1", 60_000, async () => ({ n: ++jalanB }));
    tandaiTulisan({ ruang: ["a"] });
    await singgahSingkat("a", "1", 60_000, async () => ({ n: ++jalanA }));
    await singgahSingkat("b", "1", 60_000, async () => ({ n: ++jalanB }));
    expect(jalanA).toBe(2);
    expect(jalanB).toBe(1);
  });

  it("bertanggal: hanya kunci yang rentangnya memuat tanggal itu; tanpa cakupan = ikut dibuang", async () => {
    const jalan: Record<string, number> = {};
    const baca = (kunci: string, cakupan?: { dari: string; sampai: string }) =>
      singgahSingkat("j", kunci, 60_000, async () => ({ n: (jalan[kunci] = (jalan[kunci] || 0) + 1) }), { cakupan });
    await baca("kemarin", { dari: "2026-10-23", sampai: "2026-10-23" });
    await baca("pekan", { dari: "2026-10-19", sampai: "2026-10-25" });
    await baca("tak-diketahui");
    tandaiTulisan({ ruang: ["j"], tanggal: ["2026-10-25"] });
    await baca("kemarin", { dari: "2026-10-23", sampai: "2026-10-23" });
    await baca("pekan", { dari: "2026-10-19", sampai: "2026-10-25" });
    await baca("tak-diketahui");
    expect(jalan.kemarin).toBe(1); // tidak terkena
    expect(jalan.pekan).toBe(2); // memuat tanggalnya
    expect(jalan["tak-diketahui"]).toBe(2); // tidak tahu = buang
  });

  it("bacaan yang sedang berjalan di ruang terkena tidak disimpan; di ruang lain tetap", async () => {
    let lepasA: () => void = () => undefined;
    let lepasB: () => void = () => undefined;
    const a = singgahSingkat("a", "k", 60_000, async () => {
      await new Promise<void>((r) => (lepasA = r));
      return { dari: "a-lama" };
    });
    const b = singgahSingkat("b", "k", 60_000, async () => {
      await new Promise<void>((r) => (lepasB = r));
      return { dari: "b" };
    });
    await tunda(1);
    tandaiTulisan({ ruang: ["a"] });
    lepasA();
    lepasB();
    await Promise.all([a, b]);
    expect(intipSinggah("a", "k")).toBeUndefined();
    expect(intipSinggah("b", "k")).toEqual({ dari: "b" });
  });

  it("pemanggil serentak mendapat salinan sendiri-sendiri tanpa saling mencemari", async () => {
    const kerja = async () => {
      await tunda(5);
      return { sidang: [{ nomor: "1" }] };
    };
    const [x, y, z] = await Promise.all([1, 2, 3].map(() => singgahSingkat("s", "q", 60_000, kerja)));
    x.sidang[0].nomor = "DIUBAH-X";
    y.sidang.push({ nomor: "SISIPAN" });
    expect(z.sidang).toEqual([{ nomor: "1" }]);
    const lagi = await singgahSingkat("s", "q", 60_000, kerja);
    expect(lagi.sidang).toEqual([{ nomor: "1" }]);
  });

  it("jawaban disimpan sekali sebagai teks JSON - tidak memakai structuredClone per pemanggil", async () => {
    const spy = vi.spyOn(globalThis, "structuredClone");
    try {
      await singgahSingkat("s", "teks", 60_000, async () => ({ besar: Array.from({ length: 50 }, (_, i) => ({ i })) }));
      await singgahSingkat("s", "teks", 60_000, async () => ({ besar: [] }));
      await singgahSingkat("s", "teks", 60_000, async () => ({ besar: [] }));
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

describe("terkenaTulisan - jalur ke bot", () => {
  const hari = "2026-10-25";
  it("antrean pesan, WhatsApp, antrean mati, pekerja: tidak menyentuh singgahan", () => {
    for (const p of [
      "/internal/aleta-bot/messages/enqueue",
      "/internal/aleta-bot/whatsapp/connect",
      "/internal/aleta-bot/queue/dead-letters/resend",
      "/internal/aleta-bot/worker/control",
      "/internal/aleta-bot/kosakata",
    ]) {
      expect(terkenaTulisan(p, "{}", hari), p).toEqual({ ruang: [] });
    }
  });

  it("panggil/pemberitahuan: antrian + jadwal HARI INI saja; tag dan pegawai tidak", () => {
    const t = terkenaTulisan("/internal/aleta-bot/antrian/panggil", "{}", hari);
    expect(t).toEqual({ ruang: [RUANG_SINGGAH.antrian, RUANG_SINGGAH.jadwal], tanggal: [hari] });
  });

  it("hadir/batal-hadir/keadaan: ikut tag perkara", () => {
    for (const p of ["/antrian/hadir", "/antrian/batal-hadir", "/antrian/kehadiran/keadaan"]) {
      const t = terkenaTulisan(`/internal/aleta-bot${p}`, "{}", hari);
      expect(t?.ruang).toContain(RUANG_SINGGAH.tag);
      expect(t?.tanggal).toEqual([hari]);
    }
  });

  it("sinkron antrian memakai tanggal badan bila sah, selain itu semua kunci jadwal", () => {
    expect(terkenaTulisan("/antrian/sinkron", JSON.stringify({ tanggal: "2026-10-27" }), hari)?.tanggal).toEqual(["2026-10-27"]);
    expect(terkenaTulisan("/antrian/sinkron", JSON.stringify({ tanggal: "besok" }), hari)?.tanggal).toBeUndefined();
    expect(terkenaTulisan("/antrian/sinkron", "bukan json", hari)?.tanggal).toBeUndefined();
  });

  it("tunda/putus/penetapan: jadwal, antrian, tag - bukan daftar pegawai", () => {
    for (const p of ["/sidang/tunda", "/sidang/putus", "/penetapan/tulis", "/dokumen-penetapan/terbitkan"]) {
      const t = terkenaTulisan(`/internal/aleta-bot${p}`, "{}", hari);
      expect(t?.ruang).toEqual([RUANG_SINGGAH.jadwal, RUANG_SINGGAH.antrian, RUANG_SINGGAH.tag]);
      expect(t?.tanggal).toBeUndefined();
    }
  });

  it("jalur yang tidak dikenal = undefined = buang semuanya", () => {
    for (const p of ["/penunjukan/usulan", "/sipp/bas-unggah", "/ecourt/arsip", "/hari-libur/tambahan", "/rute/baru/entah"]) {
      expect(terkenaTulisan(`/internal/aleta-bot${p}`, "{}", hari), p).toBeUndefined();
    }
  });
});

describe("cakupan dan pinjaman kunci jadwal", () => {
  const dasar = { dari: "2026-10-25", sampai: "2026-10-25", cari: "", batas: 200, waktu: true };
  it("cakupan hanya untuk tanggal ISO yang masuk akal", () => {
    expect(cakupanJadwal(dasar)).toEqual({ dari: "2026-10-25", sampai: "2026-10-25" });
    expect(cakupanJadwal({ ...dasar, sampai: "" })).toEqual({ dari: "2026-10-25", sampai: "2026-10-25" });
    expect(cakupanJadwal({ ...dasar, dari: "" })).toBeUndefined();
    expect(cakupanJadwal({ ...dasar, sampai: "2026-10-01" })).toBeUndefined();
  });

  it("permintaan waktu:true tidak pernah meminjam jawaban tanpa waktu", () => {
    const kunci = kunciPinjaman(dasar);
    expect(kunci.length).toBeGreaterThan(0);
    expect(kunci.every((k) => (JSON.parse(k.kunci) as unknown[])[4] === true)).toBe(true);
  });

  it("permintaan tanpa waktu boleh meminjam jawaban dengan waktu", () => {
    const kunci = kunciPinjaman({ ...dasar, waktu: false, batas: 50 });
    expect(kunci.some((k) => (JSON.parse(k.kunci) as unknown[])[4] === true)).toBe(true);
  });
});

describe("jadwal sidang bersinggah: layar publik meminjam layar Jadwal; antrian bersinggah", () => {
  const alamat: Array<{ url: string; method: string }> = [];
  let jumlahSidang = 3;
  let nomorJawab = 0;

  beforeEach(() => {
    alamat.length = 0;
    nomorJawab = 0;
    jumlahSidang = 3;
    process.env.ALETA_SINGGAH_JADWAL_MS = "4000";
    process.env.ALETA_SINGGAH_PEGAWAI_MS = "60000";
    process.env.ALETA_SINGGAH_TAG_MS = "30000";
    process.env.ALETA_SINGGAH_ANTRIAN_MS = "2000";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        alamat.push({ url: String(url), method: String(init?.method || "GET") });
        nomorJawab += 1;
        await tunda(3);
        const sidang = Array.from({ length: jumlahSidang }, (_, i) => ({ sidangId: String(i + 1) }));
        return new Response(
          JSON.stringify({
            ok: true,
            dari: "",
            sampai: "",
            diperiksaPada: String(nomorJawab),
            sidang,
            hakim: [],
            tag: [],
            kelompok: [],
            dasar: [],
            jumlah: {},
            lingkup: null,
            peta: {},
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const n of [
      "ALETA_SINGGAH_JADWAL_MS",
      "ALETA_SINGGAH_PEGAWAI_MS",
      "ALETA_SINGGAH_TAG_MS",
      "ALETA_SINGGAH_ANTRIAN_MS",
    ]) {
      delete process.env[n];
    }
  });

  const layarJadwal = { dari: "2026-10-25", sampai: "2026-10-25", cari: "", batas: 200, waktu: true };
  const jadwalKeBot = () => alamat.filter((a) => a.url.includes("/sipp/jadwal-sidang?")).length;
  const antrianKeBot = () => alamat.filter((a) => a.url.includes("/antrian/sidang")).length;

  it("layar publik (tanpa waktu, batas lain) memakai jawaban layar Jadwal: satu kueri ke bot", async () => {
    await getGatewayJadwalSidangSinggah(layarJadwal);
    const publik50 = await getGatewayJadwalSidangSinggah({ ...layarJadwal, waktu: false, batas: 50 });
    const publik500 = await getGatewayJadwalSidangSinggah({ ...layarJadwal, waktu: false, batas: 500 });
    const ruang = await getGatewayJadwalSidangSinggah({ ...layarJadwal, waktu: false });
    expect(jadwalKeBot()).toBe(1);
    for (const h of [publik50, publik500, ruang]) expect(h.ok && h.data.sidang).toHaveLength(3);
  });

  it("jawaban terpotong oleh batasnya tidak dipinjam batas lain", async () => {
    jumlahSidang = 200; // tepat sama dengan batas layar Jadwal: mungkin terpotong
    await getGatewayJadwalSidangSinggah(layarJadwal);
    await getGatewayJadwalSidangSinggah({ ...layarJadwal, waktu: false, batas: 500 });
    expect(jadwalKeBot()).toBe(2);
  });

  it("daftar yang lebih besar dari batas yang diminta tidak dipinjam", async () => {
    jumlahSidang = 80;
    await getGatewayJadwalSidangSinggah(layarJadwal);
    await getGatewayJadwalSidangSinggah({ ...layarJadwal, waktu: false, batas: 50 });
    expect(jadwalKeBot()).toBe(2);
  });

  it("layar publik duluan, lalu layar Jadwal: Jadwal tetap bertanya sendiri (butuh waktu antrian)", async () => {
    await getGatewayJadwalSidangSinggah({ ...layarJadwal, waktu: false });
    await getGatewayJadwalSidangSinggah(layarJadwal);
    expect(jadwalKeBot()).toBe(2);
  });

  it("hasil pinjaman adalah salinan: mengubahnya tidak mencemari singgahan", async () => {
    await getGatewayJadwalSidangSinggah(layarJadwal);
    const a = await getGatewayJadwalSidangSinggah({ ...layarJadwal, waktu: false });
    if (a.ok) a.data.sidang.length = 0;
    const b = await getGatewayJadwalSidangSinggah(layarJadwal);
    expect(b.ok && b.data.sidang).toHaveLength(3);
  });

  it("antrean pesan WhatsApp TIDAK membuang jadwal, antrian, tag, maupun daftar hakim", async () => {
    await getGatewayJadwalSidangSinggah(layarJadwal);
    await getGatewayAntrianSidang();
    await getGatewayTagPerkara({ periode: "total", acuan: "2026-10-25" });
    await gatewayPegawaiPenunjukan();
    const sebelum = alamat.length;
    // POST tulisan murni WhatsApp (antrean pesan) lewat gerbang.
    await enqueueGatewayMessage(PESAN_UJI);
    await getGatewayJadwalSidangSinggah(layarJadwal);
    await getGatewayAntrianSidang();
    await getGatewayTagPerkara({ periode: "total", acuan: "2026-10-25" });
    await gatewayPegawaiPenunjukan();
    const baru = alamat.slice(sebelum).filter((a) => !a.url.includes("/messages/"));
    expect(baru).toHaveLength(0);
  });

  it("TUNDA membuang jadwal, antrian, dan tag, tetapi TIDAK daftar hakim", async () => {
    await getGatewayJadwalSidangSinggah(layarJadwal);
    await getGatewayAntrianSidang();
    await getGatewayTagPerkara({ periode: "total", acuan: "2026-10-25" });
    await gatewayPegawaiPenunjukan();
    await postGatewayTundaSidang({ perkaraId: "1", tanggalBerikut: "2026-11-01" });
    const sebelum = alamat.length;
    await getGatewayJadwalSidangSinggah(layarJadwal);
    await getGatewayAntrianSidang();
    await getGatewayTagPerkara({ periode: "total", acuan: "2026-10-25" });
    await gatewayPegawaiPenunjukan();
    const baru = alamat.slice(sebelum);
    expect(baru.some((a) => a.url.includes("/sipp/jadwal-sidang?"))).toBe(true);
    expect(baru.some((a) => a.url.includes("/antrian/sidang"))).toBe(true);
    expect(baru.some((a) => a.url.includes("/status-perkara/tag?"))).toBe(true);
    expect(baru.some((a) => a.url.includes("/penunjukan/pegawai"))).toBe(false);
  });

  it("panggil antrian: jadwal HARI INI dibuang, jadwal pekan lalu dan tag tetap", async () => {
    // tanggal "hari ini" dikunci lewat jadwal yang memuatnya.
    const { waktuPengadilan } = await import("@/lib/waktu-pengadilan");
    const hariIni = waktuPengadilan().tanggal;
    const lalu = { ...layarJadwal, dari: "2020-01-01", sampai: "2020-01-07" };
    const kini = { ...layarJadwal, dari: hariIni, sampai: hariIni };
    await getGatewayJadwalSidangSinggah(lalu);
    await getGatewayJadwalSidangSinggah(kini);
    await getGatewayTagPerkara({ periode: "total", acuan: hariIni });
    await getGatewayAntrianSidang();
    await panggilAntrian({ perkaraId: "1", nomorPerkara: "1/Pdt.G/2026/PA.Dgl", nomorAntrian: 1, noRuang: 1, oleh: "uji" });
    const sebelum = alamat.length;
    await getGatewayJadwalSidangSinggah(lalu);
    await getGatewayJadwalSidangSinggah(kini);
    await getGatewayTagPerkara({ periode: "total", acuan: hariIni });
    await getGatewayAntrianSidang();
    const baru = alamat.slice(sebelum);
    expect(baru.filter((a) => a.url.includes("/sipp/jadwal-sidang?"))).toHaveLength(1);
    expect(baru.some((a) => a.url.includes("/status-perkara/tag?"))).toBe(false);
    expect(baru.some((a) => a.url.includes("/antrian/sidang"))).toBe(true);
  });

  it("hadir: ikut membuang tag perkara", async () => {
    await getGatewayTagPerkara({ periode: "total", acuan: "2026-10-25" });
    await catatKehadiranAntrian({
      perkaraId: "1",
      nomorPerkara: "1/Pdt.G/2026/PA.Dgl",
      peran: "Penggugat",
      urutanPihak: "1",
      sebagaiKuasa: false,
      nama: "Rekaan",
      dicatatOleh: "uji",
    });
    const sebelum = alamat.length;
    await getGatewayTagPerkara({ periode: "total", acuan: "2026-10-25" });
    expect(alamat.slice(sebelum).some((a) => a.url.includes("/status-perkara/tag?"))).toBe(true);
  });

  it("antrian bersinggah: banyak layar serentak = satu kueri; galat tidak disimpan", async () => {
    await Promise.all([1, 2, 3, 4, 5].map(() => getGatewayAntrianSidang()));
    expect(antrianKeBot()).toBe(1);
    await getGatewayAntrianSidang();
    expect(antrianKeBot()).toBe(1);
  });
});

describe("rekamAntrian hanya menulis bila berubah (K6)", () => {
  let db: AletaDatabase | null = null;
  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: false });
  });
  afterAll(async () => {
    await db?.close();
    db = null;
  });
  const baris = (id: string, ubah: Partial<BarisRekamAntrian> = {}): BarisRekamAntrian => ({
    id: `2026-10-25|${id}`,
    tanggalSidang: "2026-10-25",
    sidangId: id,
    perkaraId: `p${id}`,
    nomorPerkara: `${id}/Pdt.G/2026/PA.Dgl`,
    ruangan: "Ruang Sidang 1",
    nomorAntrian: 1,
    urutanRuang: 1,
    waktuAmbil: "08:00",
    jamPanggil: "",
    online: false,
    keadaan: "menunggu",
    namaPetugas: "",
    jarakSebelumMenit: null,
    jarakBerikutMenit: null,
    waktuAmbilLengkap: "",
    jamJadwal: "",
    waktuPanggilPertama: "",
    waktuPanggilLengkap: "",
    jumlahPanggil: 0,
    menungguDetik: null,
    jarakSebelumDetik: null,
    lamaSidangDetik: null,
    adaWaktu: false,
    bersumber: true,
    ...ubah,
  });

  const mulai = async () => {
    const d = db as AletaDatabase;
    await d.run("DELETE FROM aleta_rekam_antrian");
    return d;
  };

  it("muat pertama menulis semua; muat kedua yang sama persis tidak menulis apa pun", async () => {
    const d = await mulai();
    const pertama = await rekamAntrian(d, [baris("1"), baris("2")]);
    expect(pertama).toEqual({ ditulis: 2, gagal: "" });
    const [satu] = await bacaRekamAntrian(d, "2026-10-25", "2026-10-25");
    const kedua = await rekamAntrian(d, [baris("1"), baris("2")]);
    expect(kedua).toEqual({ ditulis: 0, gagal: "", dilewati: 2 });
    const [lagi] = await bacaRekamAntrian(d, "2026-10-25", "2026-10-25");
    expect(lagi.direkamAt).toBe(satu.direkamAt);
  });

  it("hanya baris yang berubah yang ditulis", async () => {
    const d = await mulai();
    await rekamAntrian(d, [baris("1"), baris("2")]);
    const hasil = await rekamAntrian(d, [baris("1"), baris("2", { nomorAntrian: 9 })]);
    expect(hasil).toEqual({ ditulis: 1, gagal: "", dilewati: 1 });
    const terbaca = await bacaRekamAntrian(d, "2026-10-25", "2026-10-25");
    expect(terbaca.find((b) => b.sidangId === "2")?.nomorAntrian).toBe(9);
    expect(terbaca.find((b) => b.sidangId === "1")?.nomorAntrian).toBe(1);
  });

  it("perubahan hanya pada waktu antrian (adaWaktu) juga ditulis", async () => {
    const d = await mulai();
    await rekamAntrian(d, [baris("1")]);
    const hasil = await rekamAntrian(d, [baris("1", { adaWaktu: true, menungguDetik: 120, jumlahPanggil: 1 })]);
    expect(hasil.ditulis).toBe(1);
    const [b] = await bacaRekamAntrian(d, "2026-10-25", "2026-10-25");
    expect(b.menungguDetik).toBe(120);
  });

  it("baris yang dihapus dari luar ditulis ulang pada muat berikutnya (perbandingan atas basis data)", async () => {
    const d = await mulai();
    await rekamAntrian(d, [baris("1")]);
    await d.run("DELETE FROM aleta_rekam_antrian");
    const hasil = await rekamAntrian(d, [baris("1")]);
    expect(hasil.ditulis).toBe(1);
    expect(await bacaRekamAntrian(d, "2026-10-25", "2026-10-25")).toHaveLength(1);
  });

  it("muat tanpa waktu terbaca yang selebihnya sama tidak menulis dan tidak menghapus angka berdetik", async () => {
    const d = await mulai();
    await rekamAntrian(d, [baris("1", { adaWaktu: true, menungguDetik: 90, jumlahPanggil: 2 })]);
    const hasil = await rekamAntrian(d, [baris("1", { adaWaktu: false, menungguDetik: null, jumlahPanggil: 0 })]);
    expect(hasil).toEqual({ ditulis: 0, gagal: "", dilewati: 1 });
    const [b] = await bacaRekamAntrian(d, "2026-10-25", "2026-10-25");
    expect(b.menungguDetik).toBe(90);
    expect(b.jumlahPanggil).toBe(2);
  });

  it("gagal menulis dilaporkan tanpa melempar, dan muat berikutnya mencoba lagi", async () => {
    const d = await mulai();
    const rusak = baris("1", { id: "2026-10-25|1" });
    // Memaksa gagal: tabel sementara diganti nama.
    await d.run("ALTER TABLE aleta_rekam_antrian RENAME TO aleta_rekam_antrian_x");
    const gagal = await rekamAntrian(d, [rusak]);
    await d.run("ALTER TABLE aleta_rekam_antrian_x RENAME TO aleta_rekam_antrian");
    expect(gagal.ditulis).toBe(0);
    expect(gagal.gagal).not.toBe("");
    const ulang = await rekamAntrian(d, [rusak]);
    expect(ulang.ditulis).toBe(1);
  });
});
