import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { BAWAAN_HALAMAN, DAFTAR_CIRI, ciriSampulAwal, daftarSusulan, hitungDaftarIsi, rangkaiCiri, rangkaiSusulan, susunUrutan, tanggalIndonesia, teksRentang, uraiHalaman, type BarisDasar } from "@/lib/berkas-perkara";
import { pihakBanyak } from "@/lib/lampiran-pihak";
import { definisiAlasan } from "@/lib/lampiran-sampul";

/**
 * Layar kerja Sampul dan Daftar Isi di ekstensi (blangko-derry-berkas.js): bagian murninya kembaran lib/berkas-perkara.ts
 * (dijaga di sini), dan layar dijalankan di jsdom dengan host tiruan: tidak ada yang keluar kecuali permintaan ke portal.
 */

const AKAR = path.resolve(__dirname, "../../..");
const SUMBER = readFileSync(path.join(AKAR, "ekstensi-sipp/blangko-derry-berkas.js"), "utf8");
type Bebas = any;
let BK: Bebas;
const bot: Bebas = createRequire(import.meta.url)(path.join(AKAR, "aleta_bot/services/berkasPerkaraService.js"));

beforeAll(() => {
  const g = globalThis as Bebas;
  if (!g.CSS || typeof g.CSS.escape !== "function") g.CSS = { escape: (s: string) => String(s).replace(/([^\w-])/g, "\\$1") };
  (0, eval)(SUMBER);
  BK = g.AletaBerkasKhusus;
});

const dasar = (bundel: "A" | "B", kunci: string, halaman: number, sumber: "pasti" | "perkiraan" = "pasti"): BarisDasar => ({ bundel, grup: bundel === "A" ? "II. PENETAPAN AWAL" : "PASCA PUTUSAN", kunci, nama: `Dok ${kunci}`, tanggal: "2026-01-02", halaman, sumber });

describe("kembaran murni = lib portal", () => {
  it("daftar ciri sama (kunci, nama, kelompok, sisi bawaan)", () => {
    const a = BK._murni.CIRI.map((c: Bebas) => [c.k, c.n, c.g, c.s ?? ""]);
    const b = DAFTAR_CIRI.map((c) => [c.kunci, c.nama, c.kelompok, c.sisi ?? ""]);
    expect(a).toEqual(b);
    expect(BK._murni.BAWAAN_HALAMAN).toEqual(BAWAAN_HALAMAN);
  });

  it("rangkaian ciri, halaman, tanggal, rentang", () => {
    for (const aktif of [[], ["prodeo"], ["kuasa", "ghaib", "verstek", "kumulasi", "ikrar"]]) {
      const peta = Object.fromEntries(aktif.map((k) => [k, true]));
      expect(BK._murni.rangkaiCiri(peta)).toBe(rangkaiCiri(aktif));
    }
    for (const t of ["", "3", "5-9", "5–9", "abc", "0", "9-5", " 12 "]) expect(BK._murni.uraiHalaman(t), t).toEqual(uraiHalaman(t));
    expect(BK._murni.tanggalIndonesia("2026-03-12")).toBe(tanggalIndonesia("2026-03-12"));
    expect(BK._murni.teksRentang({ awal: 2, akhir: 4 })).toBe(teksRentang({ awal: 2, akhir: 4 }));
  });

  it("sampul awal: ciri, susulan, dan pihak banyak identik dengan lib portal", () => {
    const aktif = { ecourt: true, kuasa: true, ghaib: true, mafqud: true, verstek: true, mediasi: true, sita: true, kumulasi: true, pns: true };
    expect(BK._murni.ciriSampulAwal(aktif, { kuasa: "P+T" })).toEqual(ciriSampulAwal(aktif, { kuasa: "P+T" }));
    expect(BK._murni.ciriSampulAwal({}, {})).toEqual(ciriSampulAwal({}, {}));
    for (const [jenis, lawan] of [["cg", true], ["dk", false], ["in", false], ["waris", true], ["lain", false]] as const) {
      const a = BK._murni.daftarSusulan(jenis, lawan);
      expect(a).toEqual(daftarSusulan(jenis, lawan));
      const ef = Object.fromEntries(a.map((d: Bebas, i: number) => [d.kunci, i % 2 === 0]));
      expect(BK._murni.rangkaiSusulan(a, ef, { sita: true, setempat: true })).toBe(rangkaiSusulan(daftarSusulan(jenis, lawan), ef, { sita: true, setempat: true }));
    }
    for (const j of [{ p1: 1, p2: 1, p3: 0, p4: 0 }, { p1: 2, p2: 1, p3: 0, p4: 0 }, { p1: 9, p2: 8, p3: 0, p4: 3 }, { p1: 12, p2: 0, p3: 0, p4: 0 }, { p1: 1, p2: 1, p3: 1, p4: 0 }]) expect(BK._murni.pihakBanyak(j)).toBe(pihakBanyak(j));
  });

  it("daftar alasan di ekstensi sama dengan lib portal", () => {
    for (const jenis of ["cg", "ct", "in", "dk", "waris", "hb", "paw", "es", "lain"]) expect(BK._murni.definisiAlasan(jenis), jenis).toEqual(definisiAlasan(jenis));
  });

  it("hitung daftar isi dan susunan urutan identik pada banyak masukan", () => {
    const baris = [dasar("A", "a1", 3), dasar("A", "a2", 2, "perkiraan"), dasar("A", "a3", 4), dasar("B", "b1", 5), dasar("B", "b2", 1)];
    const sunting = [
      {},
      { a2: { tampil: false } },
      { a2: { halamanTeks: "6-7" }, b1: { halamanTeks: "2" } },
      { a1: { halamanTeks: "x" }, x1: { tambahan: true, judulManual: "Lain", tanggalManual: "2 Maret 2026", halamanTeks: "2" } },
    ];
    for (const s of sunting) {
      for (const bundelB of ["1", "lanjut"] as const) {
        const semua = [...baris, ...(s as Bebas).x1 ? [dasar("A", "x1", 1)] : []];
        const a = BK._murni.hitungDaftarIsi(semua, s, { bundelB });
        const b = hitungDaftarIsi(semua, s as Bebas, { bundelB });
        expect(JSON.parse(JSON.stringify(a))).toEqual(JSON.parse(JSON.stringify(b)));
      }
    }
    const urut = { a3: 1, a1: 2 };
    expect(BK._murni.susunUrutan(["a1", "a2", "a3"], urut, ["x1"])).toEqual(susunUrutan(["a1", "a2", "a3"], urut, ["x1"]));
    expect(BK._murni.susunUrutan(["a1", "a2"], {}, [])).toEqual(["a1", "a2"]);
  });

  it("hitung halaman PDF di ekstensi sama dengan di bot", () => {
    const pdf = (n: number, salah?: number) => {
      const anak = Array.from({ length: n }, (_, i) => `${3 + i} 0 R`).join(" ");
      let s = `%PDF-1.4\n2 0 obj\n<< /Type /Pages /Kids [${anak}] /Count ${salah ?? n} >>\nendobj\n`;
      for (let i = 0; i < n; i += 1) s += `${3 + i} 0 obj\n<< /Type /Page >>\nendobj\n`;
      return Buffer.from(s, "latin1");
    };
    for (const [n, salah] of [[1, undefined], [5, undefined], [4, 9]] as const) {
      const eks = BK._murni.halamanPdf(new Uint8Array(pdf(n, salah)).buffer);
      const sb = bot.strukturPdf(pdf(n, salah));
      expect(eks.halaman).toBe(sb.count || sb.objek);
      expect(eks.ragu).toBe(sb.count > 0 && sb.objek > 0 && sb.count !== sb.objek);
    }
    expect(BK._murni.halamanPdf(new Uint8Array(Buffer.from("bukan")).buffer)).toBeNull();
  });
});

describe("layar kerja (jsdom, host tiruan)", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  const fakta = () => ({
    perkara: { perkaraId: 5, nomor: "5/Pdt.G/2026/PA.Cth", jenisId: 362, jenisNama: "Dispensasi Kawin", jenis: "dk", permohonan: true, berlawanan: false, sebutanP: "Pemohon", sebutanT: "Termohon" },
    jumlahPihak: { p1: 1, p2: 0, p3: 0, p4: 0 },
    pihakSemua: [{ sisi: 1, urutan: 1, nama: "Pemohon Satu", alamat: "Jl. A" }],
    anak: [{ nama: "Anak Satu", umur: "17", diasuh: "" }],
    objek: [],
    riwayatSemua: [{ ke: 1, tanggal: "2026-02-01", hadir: "P", agenda: "Sidang pertama", alasan: "" }],
    susulan: { oto: { setempat: "agenda sidang", panjar: "biaya perkara" }, gagal: [] },
    alasan: { oto: { "1": { sumber: "alasan SIPP", kutipan: "anak sedang hamil", butir: 15, bagian: "posita" } }, gagal: false },
    ciri: { prodeo: { nyala: true, sisi: "" }, pns: { nyala: true, sisi: "T" } },
    isian: { b3: "Menghindari zina", mediator: "", tglpbt: "2026-04-01", konseptor: "Akbar Ali" },
    dokumen: [
      { bundel: "A", grup: "I. PENDAFTARAN", kunci: "gugatan", nama: "Surat Permohonan Pemohon", tanggal: "2026-01-04", halaman: 6, sumber: "pasti", dasar: "arsip" },
      { bundel: "A", grup: "II. PENETAPAN AWAL", kunci: "phs", nama: "Penetapan Hari Sidang (PHS)", tanggal: "2026-01-08", halaman: null, sumber: "perkiraan", jenisBawaan: "phs" },
      { bundel: "A", grup: "IV. PUTUSAN / PENETAPAN", kunci: "putusan", nama: "Penetapan", tanggal: "2026-02-01", halaman: null, sumber: "perkiraan", jenisBawaan: "putusan" },
      { bundel: "B", grup: "PASCA PUTUSAN", kunci: "minutasi", nama: "Penetapan Minutasi", tanggal: "2026-02-03", halaman: null, sumber: "perkiraan", jenisBawaan: "minutasi" },
    ],
  });

  function buatHost(ubahFakta?: (f: Bebas) => void) {
    const panggilan: Array<{ alamat: string; metode: string; badan: Bebas }> = [];
    const toast: string[] = [];
    const host = {
      ambilPortal: async (alamat: string, opsi: Bebas) => {
        const metode = String((opsi && opsi.method) || "GET");
        const badan = opsi && opsi.body ? JSON.parse(opsi.body) : null;
        panggilan.push({ alamat, metode, badan });
        if (alamat.includes("/naskah")) return { rtfBase64: btoa("{\\rtf1\\ansi Halo}"), kosong: [], mesinGalat: "", lampiran: (globalThis as Bebas).__lampiranTiruan ?? [] };
        if (metode === "PUT") return { ok: true, ditolak: [] };
        const f = fakta();
        if (ubahFakta) ubahFakta(f);
        return { fakta: f, sunting: { susunan: {}, tag: {}, isian: {} }, bawaan: { putusan: 13 } };
      },
      unduh: vi.fn(async () => ({ ok: true })),
      pdfDari: vi.fn(async () => ({ blob: new Blob(["x"]) })),
      namaUnduhan: (n: string, b: string, a: string) => `${n} - ${b}.${a}`,
      rtfKeHtml: (rtf: string) => `<p>${rtf.length}</p>`,
      toast: (t: string) => toast.push(t),
      bacaPenyimpanan: async () => ({}),
      tulisPenyimpanan: vi.fn(async () => true),
      sebagaiPeran: () => "",
    };
    return { host, panggilan, toast };
  }

  async function bukaLayar(jenis: "sampul" | "daftar-isi", bentuk: "awal" | "lengkap" = "lengkap", ubahFakta?: (f: Bebas) => void) {
    vi.useFakeTimers();
    const w = document.createElement("div");
    document.body.appendChild(w);
    const { host, panggilan, toast } = buatHost(ubahFakta);
    await BK.buka(w, host, { jenis, bentuk, perkaraId: "5", nomor: "5/Pdt.G/2026/PA.Cth" });
    await vi.advanceTimersByTimeAsync(50);
    return { w, host, panggilan, toast };
  }

  it("sampul: 25 ciri, yang otomatis berwarna, klik mengubah dan menyimpan setelah jeda", async () => {
    const { w, panggilan } = await bukaLayar("sampul");
    const chip = w.querySelectorAll(".bk-ciri");
    expect(chip).toHaveLength(25);
    expect(w.querySelectorAll(".bk-ciri.oto")).toHaveLength(2);
    expect(w.querySelector(".bk-f label[for=bk-in-b3]")).toBeTruthy(); // isian khas dispensasi
    (w.querySelector('[data-bkv="prodeo"]') as HTMLElement).click();
    expect(w.querySelector('[data-bkv="prodeo"]')!.className).toContain("mati-tgn");
    await vi.advanceTimersByTimeAsync(1600);
    const put = panggilan.filter((p) => p.metode === "PUT").at(-1)!;
    expect(put.badan.tag).toEqual({ prodeo: false });
    const naskah = panggilan.filter((p) => p.alamat.includes("/naskah")).at(-1)!;
    expect(naskah.badan.jenis).toBe("sampul");
    expect(naskah.badan.nilai["5801"]).toContain("PNS/ASN T");
    expect(naskah.badan.nilai["5801"]).not.toContain("PRODEO");
    expect(naskah.badan.nilai["5842"]).toBeUndefined(); // tidak diubah tangan: ABT yang menghitung
  });

  it("sampul cetak awal (bawaan): lencana tanpa ciri bagian lain, susulan otomatis OTO, tangan menimpa, nilai timpa 5861/5862", async () => {
    const { w, panggilan } = await bukaLayar("sampul", "awal");
    expect(w.querySelectorAll('[data-bk="ciri"]')).toHaveLength(20);   // tanpa verstek, rekonvensi, sita, mediasi, kumulasi
    expect(w.querySelector('[data-bkv="verstek"]')).toBeNull();
    const susulan = [...w.querySelectorAll('[data-bk="susulan"]')].map((e) => e.getAttribute("data-bkv"));
    expect(susulan).toEqual(["perbaikan", "setempat", "panjar", "cabut", "anak"]);
    expect(w.querySelector('[data-bk="susulan"][data-bkv="setempat"]')!.className).toContain("oto");
    expect(w.querySelector('[data-bk="susulan"][data-bkv="cabut"]')!.getAttribute("aria-pressed")).toBe("false");
    expect(w.querySelector("#bk-in-konseptor")).toBeTruthy();
    expect(w.querySelector("#bk-in-mediator")).toBeNull();   // permohonan: tanpa mediasi
    (w.querySelector('[data-bk="susulan"][data-bkv="cabut"]') as HTMLElement).click();      // dicentang tangan
    (w.querySelector('[data-bk="susulan"][data-bkv="panjar"]') as HTMLElement).click();     // otomatis dimatikan tangan
    await vi.advanceTimersByTimeAsync(1600);
    const naskah = panggilan.filter((p) => p.alamat.includes("/naskah")).at(-1)!;
    expect(naskah.badan.bentuk).toBe("awal");
    expect(naskah.badan.lawan).toBe(false);
    const n = naskah.badan.nilai;
    expect(n["5861"]).toContain("PRODEO");
    expect(n["5862"]).toBe("[ ] PERBAIKAN PERMOHONAN   [X] PEMERIKSAAN SETEMPAT (oto)   [ ] TAMBAHAN PANJAR   [X] PENCABUTAN   [ ] ANAK & CALON DIDENGAR");
    expect(n["5865"]).toBeUndefined();
    expect(naskah.badan.banyak).toBeUndefined();
    // data lampiran dikirim; portal yang memutuskan lampiran mana yang perlu
    expect(naskah.badan.anak).toHaveLength(1);
    expect(naskah.badan.riwayat).toHaveLength(1);
    expect(naskah.badan.pihak).toHaveLength(1);
    expect(naskah.badan.infoKhasBaris).toBeGreaterThanOrEqual(1);
    expect(w.querySelector("[data-bk-lamp]")!.textContent).toContain("tanpa lampiran");
    const put = panggilan.filter((p) => p.metode === "PUT").at(-1)!;
    expect(put.badan.tag).toMatchObject({ s_cabut: true, s_panjar: false });
    (w.querySelector('[data-bk="bentuk"][data-bkv="lengkap"]') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(300);
    expect(w.querySelectorAll('[data-bk="ciri"]')).toHaveLength(25);
    const lengkap = panggilan.filter((p) => p.alamat.includes("/naskah")).at(-1)!;
    expect(lengkap.badan.bentuk).toBe("lengkap");
    expect(lengkap.badan.nilai["5801"]).toContain("PRODEO");
  });

  it("sampul cetak awal: kartu alasan otomatis (OTO), tangan menimpa, dikirim ke portal; tanpa yang berlaku kartu menyebut baris tidak dicetak", async () => {
    const { w, panggilan } = await bukaLayar("sampul", "awal");
    const tombol = [...w.querySelectorAll('[data-bk="alasan"]')];
    expect(tombol.map((e) => e.getAttribute("data-bkv"))).toEqual(["1", "2", "3", "4"]);
    expect(w.querySelector('[data-bk="alasan"][data-bkv="1"]')!.className).toContain("oto");
    expect(w.querySelector('[data-bk="alasan"][data-bkv="2"]')!.getAttribute("aria-pressed")).toBe("false");
    expect(w.textContent).toContain("1 butir berlaku");
    (w.querySelector('[data-bk="alasan"][data-bkv="3"]') as HTMLElement).click();   // dicentang tangan
    (w.querySelector('[data-bk="alasan"][data-bkv="1"]') as HTMLElement).click();   // otomatis dimatikan tangan
    await vi.advanceTimersByTimeAsync(1600);
    const naskah = panggilan.filter((p) => p.alamat.includes("/naskah")).at(-1)!;
    expect(naskah.badan.jenisPerkara).toBe("dk");
    expect(naskah.badan.alasan.tangan).toEqual({ "1": false, "3": true });
    expect(naskah.badan.alasan.oto["1"].kutipan).toBe("anak sedang hamil");
    expect(naskah.badan.keterangan).toEqual([]);
    const put = panggilan.filter((p) => p.metode === "PUT").at(-1)!;
    expect(put.badan.tag).toMatchObject({ a_1: false, a_3: true });
    (w.querySelector('[data-bk="alasan"][data-bkv="3"]') as HTMLElement).click();
    (w.querySelector('[data-bk="alasan"][data-bkv="1"]') as HTMLElement).click();
    expect(w.textContent).toContain("1 butir berlaku");
    for (const k of ["1"]) (w.querySelector(`[data-bk="alasan"][data-bkv="${k}"]`) as HTMLElement).click();
    expect(w.textContent).toContain("baris ALASAN dan lampirannya tidak dicetak");
  });

  it("keterangan otomatis hanya dari fakta pasti (ghaib)", async () => {
    const { panggilan, w } = await bukaLayar("sampul", "awal", (f: Bebas) => {
      f.ciri.ghaib = { nyala: true, sisi: "T" };
    });
    (w.querySelector('[data-bk="ciri"][data-bkv="pns"]') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(1600);
    const naskah = panggilan.filter((p) => p.alamat.includes("/naskah")).at(-1)!;
    expect(naskah.badan.keterangan).toEqual(["Termohon ghaib"]);
    expect(naskah.badan.nilai["5807"]).toContain("GHAIB");
  });

  it("sampul cetak awal: perkara berlawanan menampilkan mediator; pihak banyak mengirim varian, kumulasi, dan keterangan lampiran dari portal", async () => {
    (globalThis as Bebas).__lampiranTiruan = [{ nomor: 1, kunci: "pihak", judul: "DAFTAR PARA PIHAK", alasan: "pihak I berjumlah 9 orang" }];
    const lawan = (f: Bebas) => {
      f.perkara.berlawanan = true;
      f.perkara.jenis = "waris";
      f.perkara.jenisNama = "Kewarisan";
      f.jumlahPihak = { p1: 9, p2: 3, p3: 0, p4: 1 };
      f.pihakSemua = Array.from({ length: 9 }, (_, i) => ({ sisi: 1, urutan: i + 1, nama: `P${i + 1}`, alamat: "x" }));
      f.ciri.kumulasi = { nyala: true, sisi: "2", nama: ["Hak Asuh Anak", "Nafkah Anak"] };
    };
    const { w, panggilan } = await bukaLayar("sampul", "awal", lawan);
    expect(w.querySelector("#bk-in-mediator")).toBeTruthy();
    expect(w.querySelector(".bk-pihak")!.textContent).toContain("Pihak banyak");
    expect([...w.querySelectorAll('[data-bk="susulan"]')]).toHaveLength(9);
    (w.querySelector('[data-bk="ciri"][data-bkv="pns"]') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(1600);
    const naskah = panggilan.filter((p) => p.alamat.includes("/naskah")).at(-1)!;
    expect(naskah.badan.lawan).toBe(true);
    expect(naskah.badan.banyak).toBe(true);
    expect(naskah.badan.pihak).toHaveLength(9);
    expect(naskah.badan.nilai["5867"]).toBe("Kewarisan Kumulasi");
    expect(naskah.badan.nilai["5868"]).toBe("Kumulasi: Hak Asuh Anak dan Nafkah Anak");
    expect(naskah.badan.sebutanP).toBe("Pemohon");
    expect(w.querySelector("[data-bk-lamp]")!.textContent).toContain("1 lampiran ikut tercetak");
    expect(w.querySelector("[data-bk-lamp]")!.textContent).toContain("DAFTAR PARA PIHAK");
    delete (globalThis as Bebas).__lampiranTiruan;
  });

  it("sampul: isian yang diubah tangan menimpa kode ABT; mengembalikan nilai otomatis menghapus timpaan", async () => {
    const { w, panggilan } = await bukaLayar("sampul");
    const kotak = w.querySelector("#bk-in-b3") as HTMLTextAreaElement;
    kotak.value = "Hamil di luar nikah";
    kotak.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(2000);
    let naskah = panggilan.filter((p) => p.alamat.includes("/naskah")).at(-1)!;
    expect(naskah.badan.nilai["5843"]).toContain("Alasan dispensasi: Hamil di luar nikah");
    kotak.value = "Menghindari zina";
    kotak.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(2000);
    naskah = panggilan.filter((p) => p.alamat.includes("/naskah")).at(-1)!;
    expect(naskah.badan.nilai["5843"]).toBeUndefined();
  });

  it("daftar isi: halaman manual, rentang, sembunyikan, tambah baris, dan muatan naskah", async () => {
    const { w, panggilan } = await bukaLayar("daftar-isi");
    const baris = () => w.querySelectorAll("tbody tr[data-key]");
    expect(baris()).toHaveLength(4);
    expect(w.querySelector('[data-rg="gugatan"]')!.textContent).toContain("1–6");
    expect(w.querySelector('[data-sb="gugatan"]')!.textContent).toContain("pasti");
    expect(w.querySelector('[data-sb="phs"]')!.textContent).toContain("perkiraan");
    // putusan: bawaan 13 hlm, ada pengisi dari PDF
    expect(w.querySelector('[data-bk-pdf="putusan"]')).toBeTruthy();
    const hal = w.querySelector('[data-bk-edit="halamanTeks"][data-bkk="phs"]') as HTMLInputElement;
    hal.value = "8-9";
    hal.dispatchEvent(new Event("input", { bubbles: true }));
    expect(w.querySelector('[data-sb="phs"]')!.textContent).toContain("manual");
    expect(w.querySelector('[data-rg="phs"]')!.textContent).toContain("8–9");
    expect(w.querySelector('[data-pr="phs"]')!.textContent).toContain("terlewat");
    hal.value = "dua";
    hal.dispatchEvent(new Event("input", { bubbles: true }));
    expect(hal.getAttribute("aria-invalid")).toBe("true");
    hal.value = "";
    hal.dispatchEvent(new Event("input", { bubbles: true }));
    (w.querySelector('[data-bk="sembunyi"][data-bkk="phs"]') as HTMLElement).click();
    expect(w.querySelector('tr[data-key="phs"]')!.className).toContain("tersembunyi");
    (w.querySelector('[data-bk="tambah"][data-bkv="A"]') as HTMLElement).click();
    expect(baris()).toHaveLength(5);
    await vi.advanceTimersByTimeAsync(2000);
    const naskah = panggilan.filter((p) => p.alamat.includes("/naskah")).at(-1)!;
    expect(naskah.badan.jenis).toBe("daftar-isi");
    expect(naskah.badan.baris.map((b: Bebas) => b.kunci)).toContain("x1");
    expect(naskah.badan.sunting.phs.tampil).toBe(false);
    expect(naskah.badan.sunting.x1.tambahan).toBe(true);
    const put = panggilan.filter((p) => p.metode === "PUT").at(-1)!;
    expect(put.badan.susunan.find((s: Bebas) => s.kunci === "phs")).toMatchObject({ tampil: false, bundel: "A" });
    expect(put.badan.isian.bundelB).toBe("1");
  });

  it("daftar isi: tingkat pertama = Bundel A saja; pilihan Bundel B hanya bila ada upaya hukum", async () => {
    const tanpa = await bukaLayar("daftar-isi");
    expect(tanpa.w.querySelector("[data-bk-bundelcetak]")).toBeNull();
    await vi.advanceTimersByTimeAsync(2000);
    expect(tanpa.panggilan.filter((p) => p.alamat.includes("/naskah")).at(-1)!.badan.bundelCetak).toBe("A");
    document.body.innerHTML = "";
    const dengan = await bukaLayar("daftar-isi", "lengkap", (f) => {
      f.upayaHukum = true;
    });
    const pilih = dengan.w.querySelector("[data-bk-bundelcetak]") as HTMLSelectElement;
    expect(pilih).toBeTruthy();
    pilih.value = "B";
    pilih.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(2000);
    expect(dengan.panggilan.filter((p) => p.alamat.includes("/naskah")).at(-1)!.badan.bundelCetak).toBe("B");
  });

  it("daftar isi: geser menukar urutan, urutan ikut tersimpan", async () => {
    const { w, panggilan } = await bukaLayar("daftar-isi");
    (w.querySelector('[data-bk="turun"][data-bkb="A"][data-bki="0"]') as HTMLElement).click();
    const kunci = [...w.querySelectorAll("tbody tr[data-key]")].map((r) => r.getAttribute("data-key"));
    expect(kunci.slice(0, 2)).toEqual(["phs", "gugatan"]);
    await vi.advanceTimersByTimeAsync(2000);
    const put = panggilan.filter((p) => p.metode === "PUT").at(-1)!;
    expect(put.badan.susunan.filter((s: Bebas) => s.bundel === "A").map((s: Bebas) => s.kunci).slice(0, 2)).toEqual(["phs", "gugatan"]);
  });

  it("cetak: RTF dan PDF diunduh dengan nama baku; kertas pilihan diingat", async () => {
    const { w, host } = await bukaLayar("sampul");
    const pilih = w.querySelector("[data-bk-kertas]") as HTMLSelectElement;
    pilih.value = "f4";
    pilih.dispatchEvent(new Event("change", { bubbles: true }));
    expect(host.tulisPenyimpanan).toHaveBeenCalledWith({ blangkoDerryKertas: "f4" });
    (w.querySelector('[data-bk="cetak"]') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(500);
    expect(host.unduh).toHaveBeenCalledTimes(2);
    const nama = (host.unduh.mock.calls as Bebas[]).map((c) => c[1]);
    expect(nama).toEqual(["5/Pdt.G/2026/PA.Cth - Sampul Berkas Perkara.rtf.rtf", "5/Pdt.G/2026/PA.Cth - Sampul Berkas Perkara.rtf.pdf"]);
  });

  it("jenis layar hanya untuk dua berkas itu", () => {
    expect(BK.jenisLayar("Sampul Berkas Perkara.rtf")).toBe("sampul");
    expect(BK.jenisLayar("Daftar Isi Berkas.rtf")).toBe("daftar-isi");
    expect(BK.jenisLayar("Sampul Berkas Perkara (F4).rtf")).toBe("");
    expect(BK.jenisLayar("Sampul Berkas Perkara (Lengkap).rtf")).toBe("sampul");
    expect(BK.bentukDari("Sampul Berkas Perkara (Lengkap).rtf")).toBe("lengkap");
    expect(BK.bentukDari("Sampul Berkas Perkara.rtf")).toBe("awal");
    expect(BK.jenisLayar("BAS Sidang Pertama.rtf")).toBe("");
    expect(BK.KODE_SAKLAR).toBe("berkas-perkara-khusus");
  });
});
