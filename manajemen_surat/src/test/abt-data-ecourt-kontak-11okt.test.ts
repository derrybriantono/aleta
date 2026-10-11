import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { bacaIsiGugatan } from "@/server/modules/aleta-ecourt/isi-gugatan";
import { bacaKontakEcourt, rencanaBacaKontak } from "@/server/modules/aleta-ecourt/kontak-ecourt";
import type { DokumenArsip } from "@/server/modules/aleta-ecourt/kuasa-gugatan";

/**
 * KONTAK-EC (11 Okt 2026, agen 5): (5) ABT otomatis mengambil data e-Court dan
 * (6) deteksi email + nomor WhatsApp dari e-Court ke SIPP dan ABT.
 *
 * Yang diuji PERILAKUNYA (bukan teks kode):
 *   - layanan bot sungguhan (kontakEcourtService) atas teks berbentuk berkas
 *     e-Court nyata (nama/nomor diganti) dan bahan SIPP tiruan;
 *   - kamus kelompok "kontak" lewat kamusDeteksi (lapis database berlaku);
 *   - modul portal kontak-ecourt dan isi-gugatan dengan bot sungguhan sebagai gateway;
 *   - lajur SIPP (blok KONTAK-EC di konten.js) dan lipatan ABT (blok di abt.js) di jsdom.
 */

const AKAR = path.resolve(process.cwd(), "..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
type Apa = any;
const K: Apa = muat(path.join(AKAR, "aleta_bot/services/kontakEcourtService.js"));
const kamus: Apa = muat(path.join(AKAR, "aleta_bot/services/kamusDeteksi.js"));

afterEach(() => {
  kamus.aturLapisDatabase({ pola: [], templat: [] });
  vi.useRealTimers();
});

// Jawaban e-Court ber-kuasa (bentuk 324/Pdt.G/2026, nama/alamat/nomor diganti).
const JAWABAN_BERKUASA = [
  "Kepada Yth. Ketua Pengadilan Agama Donggala",
  "Berdasarkan Surat Kuasa Khusus tanggal 26 Juni 2026 yang telah terdaftar di kepaniteraan Pengadilan Agama Donggala.",
  "Dalam hal ini memilih domisili hukum pada kantor kuasanya tersebut dibawah ini :",
  "SITI RAHMAWATI, S.H., Pekerjaan adalah Advokat yang berkantor pada “ Kantor Advokat H. ANWAR, SH & REKAN” di Jalan Merpati No. 9, Kota Palu, alamat domisili elektronik email; kantor.anwar@gmail.com, Selanjutnya disebut sebagai Termohon / Penggugat Rekonvensi;",
  "MELAWAN",
  "BUDI SANTOSO Bin HASAN, Tempat/tanggal lahir Palu 17 Desember 1988, Pekerjaan Wiraswasta, Alamat Jl. Kenari No. 51 Kota Palu, No. Hp. 0812-3456-7890, sebagai Pemohon / Tergugat Rekonvensi;",
  "Dengan ini Termohon mengajukan Jawaban sebagai berikut: NIK 7203123456780001 dan NIP 199390092021012345.",
].join("\n");

// Kop kantor advokat + identitas yang terpotong salinan PDF ("TER MO HON").
const DUPLIK_KOP = [
  "KANTOR ADVOKAT / KONSULTAN HUKUM ”NUR & REKAN”",
  "JL. S.Wera No. 160 Kota Palu, Telp. 0813-1111-2222",
  "DUPLIK DALAM KONVENSI",
  "Kesemuanya Advokat dan Konsultan Hukum yang tergabung pada Kantor Advokat tersebut,",
  "Domisili elekronik nurhana.sh @gmail.com.",
  "Dalam hal ini bertindak untuk dan atas nama serta mewakili kepentingan hukum Klien",
  "Kami selaku Pemberi Kuasa Ny. NURHIDAYATI, berdasarkan Surat Kuasa Khusus, selanjutnya disebut sebagai TER MO HON.",
].join("\n");

// Gugatan mandiri: Penggugat menulis HP & email sendiri, HP Tergugat untuk pemanggilan.
const GUGATAN_MANDIRI = [
  "SURAT GUGATAN CERAI",
  "Yang bertanda tangan di bawah ini: RINA WATI binti AHMAD, umur 30 tahun, alamat Desa Towale, No. HP/WA +62 852-1111-3333, email rina.wati@yahoo.co.id, selanjutnya disebut sebagai Penggugat;",
  "melawan",
  "JOKO bin SAMIN, umur 35 tahun, alamat Desa Towale, nomor HP 0853 4444 5555, selanjutnya disebut sebagai Tergugat;",
  "Hubungi kantor kami di info@pa-donggala.go.id.",
].join("\n");

describe("normalisasi nomor & email", () => {
  it("nomor Indonesia +62/62/08, spasi, titik, tanda hubung -> 08...; telepon rumah dibedakan; NIK bukan nomor", () => {
    expect(K.bakuNomor("+62 812-4592-1767")).toEqual({ nilai: "081245921767", jenis: "hp" });
    expect(K.bakuNomor("6285211113333")).toEqual({ nilai: "085211113333", jenis: "hp" });
    expect(K.bakuNomor("(0812) 3456.7890")).toEqual({ nilai: "081234567890", jenis: "hp" });
    expect(K.bakuNomor("0451 421234")).toEqual({ nilai: "0451421234", jenis: "telepon" });
    expect(K.bakuNomor("7203123456780001")).toBeNull();
    expect(K.bakuNomor("12345")).toBeNull();
    expect(K.nomorSipp("081234567890 / 0853 4444 5555").map((x: Apa) => x.nilai)).toEqual(["081234567890", "085344445555"]);
  });
  it("email divalidasi, huruf kecil, tanda baca penutup dibuang; surel pengadilan/sistem ditolak", () => {
    expect(K.bakuEmail(" Budi.SH@Gmail.com, ")).toBe("budi.sh@gmail.com");
    expect(K.bakuEmail("nama @ gmail.com")).toBe("nama@gmail.com");
    expect(K.bakuEmail("info@pa-donggala.go.id")).toBe("");
    expect(K.bakuEmail("noreply@mahkamahagung.go.id")).toBe("");
    expect(K.bakuEmail("bukan email")).toBe("");
  });
});

describe("deteksi kontak dari teks berkas e-Court (kamus kelompok kontak)", () => {
  it("kamus kontak termuat lewat kamusDeteksi dengan seluruh peran; tidak ada yang 'pasti' tanpa ukur", () => {
    const pola = kamus.polaKelompok("kontak");
    expect(new Set(pola.map((p: Apa) => p.peran))).toEqual(new Set(["email", "email-renggang", "hp", "telepon", "domisili", "label-pihak", "kuasa", "pemberi", "kop"]));
    expect(pola.every((p: Apa) => p.yakin !== "pasti")).toBe(true);
  });

  it("bagian kuasa: email kantor milik KUASA Termohon (sisi 2) bertanda domisili; HP di identitas Pemohon milik PIHAK sisi 1; NIK/NIP tidak terbaca nomor", () => {
    const h = K.kontakDariTeks(JAWABAN_BERKUASA, { sisiPengunggah: 2 });
    const email = h.find((x: Apa) => x.jenis === "email");
    expect(email).toMatchObject({ nilai: "kantor.anwar@gmail.com", milik: "kuasa", sisi: 2, domisili: true });
    const hp = h.find((x: Apa) => x.jenis === "hp");
    expect(hp).toMatchObject({ nilai: "081234567890", milik: "pihak", sisi: 1 });
    expect(hp.kodePola).toContain("kontak-label-pihak");
    expect(h).toHaveLength(2);
  });

  it("kop kantor hukum + sebutan terpotong 'TER MO HON' + email berspasi sebelum @: semuanya milik kuasa sisi 2", () => {
    const h = K.kontakDariTeks(DUPLIK_KOP, { sisiPengunggah: 2 });
    expect(h.find((x: Apa) => x.jenis === "hp")).toMatchObject({ nilai: "081311112222", milik: "kuasa", sisi: 2 });
    expect(h.find((x: Apa) => x.jenis === "email")).toMatchObject({ nilai: "nurhana.sh@gmail.com", milik: "kuasa", sisi: 2, domisili: true });
  });

  it("gugatan mandiri: HP + email Penggugat (sisi 1) dan HP Tergugat (sisi 2) - dua arah, tidak tertukar; surel pengadilan diabaikan", () => {
    const h = K.kontakDariTeks(GUGATAN_MANDIRI, { sisiPengunggah: 1 });
    const di = (jenis: string, sisi: number) => h.filter((x: Apa) => x.jenis === jenis && x.sisi === sisi).map((x: Apa) => x.nilai);
    expect(di("hp", 1)).toEqual(["085211113333"]);
    expect(di("email", 1)).toEqual(["rina.wati@yahoo.co.id"]);
    expect(di("hp", 2)).toEqual(["085344445555"]);
    expect(di("email", 2)).toEqual([]);
    expect(h.every((x: Apa) => x.milik === "pihak")).toBe(true);
    expect(h.some((x: Apa) => /go\.id/.test(x.nilai))).toBe(false);
  });

  it("kontak tanpa sebutan pihak sesudahnya tidak diberi pemilik (sisi 0)", () => {
    const h = K.kontakDariTeks("Untuk informasi hubungi 0812 9999 8888 pada jam kerja.", {});
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ sisi: 0, milik: "" });
  });
});

const SIPP_PIHAK = [
  { pihakKe: 1, urutan: 1, pihakId: 11, nama: "BUDI SANTOSO bin HASAN", email: "", telepon: "" },
  { pihakKe: 2, urutan: 1, pihakId: 22, nama: "SITI AMINAH binti RAHMAN", email: "", telepon: "082211110000" },
];

describe("penyusun per orang (susunKontak)", () => {
  it("akun pengunggah Tergugat tanpa kuasa -> email PIHAK 2 'cukup', SIPP kosong; tidak pernah ke pihak 1", () => {
    const h = K.susunKontak({ pihak: SIPP_PIHAK, kuasa: [], pengunggah: [{ peran: "Tergugat", email: "Siti.A@gmail.com" }] });
    const p2 = h.orang.find((o: Apa) => o.jenis === "pihak" && o.pihakKe === 2);
    const p1 = h.orang.find((o: Apa) => o.jenis === "pihak" && o.pihakKe === 1);
    expect(p2.usulan.email).toMatchObject({ nilai: "siti.a@gmail.com", keyakinan: "cukup", terhadapSipp: "kosong" });
    expect(p1.usulan.email).toBeNull();
    expect(h.domisili[2]).toMatchObject({ email: "siti.a@gmail.com", milik: "pihak", asal: "akun" });
  });

  it("sisi yang berkuasa di SIPP: surel pengunggah = surel KUASA, bukan pihak; domisili elektronik = email kuasa", () => {
    const kuasa = [{ pihakKe: 1, urutan: 1, pengacaraId: 91, nama: "ANWAR, S.H.", email: "", telepon: "" }];
    const h = K.susunKontak({ pihak: SIPP_PIHAK, kuasa, pengunggah: [{ peran: "Penggugat", email: "kantor.anwar@gmail.com" }] });
    expect(h.orang.find((o: Apa) => o.jenis === "kuasa").usulan.email).toMatchObject({ nilai: "kantor.anwar@gmail.com", keyakinan: "cukup" });
    expect(h.orang.find((o: Apa) => o.jenis === "pihak" && o.pihakKe === 1).usulan.email).toBeNull();
    expect(h.domisili[1]).toMatchObject({ email: "kantor.anwar@gmail.com", milik: "kuasa" });
  });

  it("isian SIPP yang sama -> 'sama'; yang lain -> 'beda' (diusulkan, tidak menimpa); telepon SIPP ganda dibaca", () => {
    const h = K.susunKontak({
      pihak: SIPP_PIHAK,
      kuasa: [],
      dokumen: [{ judul: "Jawaban", peran: "jawaban", penuntutKode: "0047", teks: GUGATAN_MANDIRI.replace("RINA WATI binti AHMAD", "BUDI SANTOSO bin HASAN").replace("JOKO bin SAMIN", "SITI AMINAH binti RAHMAN") }],
    });
    const p2 = h.orang.find((o: Apa) => o.pihakKe === 2);
    expect(p2.usulan.hp).toMatchObject({ nilai: "085344445555", terhadapSipp: "beda", keyakinan: "ragu" });
    const p1 = h.orang.find((o: Apa) => o.pihakKe === 1);
    expect(p1.usulan.hp).toMatchObject({ nilai: "085211113333", terhadapSipp: "kosong" });
    expect(p1.usulan.hp.sumber[0].label).toBe("e-Court: Jawaban");
    const sama = K.susunKontak({ pihak: [{ ...SIPP_PIHAK[1], telepon: "0812 0000 1111 / 085344445555" }], kuasa: [], dokumen: [{ judul: "G", peran: "gugatan", teks: GUGATAN_MANDIRI.replace("JOKO bin SAMIN", "SITI AMINAH binti RAHMAN") }] });
    expect(sama.orang[0].usulan.hp.terhadapSipp).toBe("sama");
  });

  it("beberapa advokat sekantor tanpa isian: surel kantor diusulkan 'ragu' ke tiap kuasa yang kosong; yang sudah berisi tidak diganggu", () => {
    const kuasa = [
      { pihakKe: 2, urutan: 2, pengacaraId: 1, nama: "SITI RAHMAWATI, S.H.", email: "", telepon: "" },
      { pihakKe: 2, urutan: 3, pengacaraId: 2, nama: "DEWI, S.H.", email: "dewi@law.id", telepon: "" },
    ];
    const h = K.susunKontak({ pihak: SIPP_PIHAK, kuasa, dokumen: [{ judul: "Jawaban", peran: "jawaban", penuntutKode: "0047", teks: JAWABAN_BERKUASA.replace("SITI RAHMAWATI, S.H., Pekerjaan", "Para Advokat") }] });
    const [k2, k3] = h.orang.filter((o: Apa) => o.jenis === "kuasa");
    expect(k2.usulan.email).toMatchObject({ nilai: "kantor.anwar@gmail.com", keyakinan: "ragu" });
    expect(k2.usulan.email.sumber[0].label).toContain("kantor kuasa (dipakai bersama)");
    expect(k3.usulan.email).toBeNull();
  });

  it("nama di identitas sebelum kontak memilih orangnya bila sisi itu beranggota lebih dari satu", () => {
    const kuasa = [
      { pihakKe: 2, urutan: 2, pengacaraId: 1, nama: "SITI RAHMAWATI, S.H.", email: "", telepon: "" },
      { pihakKe: 2, urutan: 3, pengacaraId: 2, nama: "DEWI, S.H.", email: "", telepon: "" },
    ];
    const h = K.susunKontak({ pihak: SIPP_PIHAK, kuasa, dokumen: [{ judul: "Jawaban", peran: "jawaban", penuntutKode: "0047", teks: JAWABAN_BERKUASA }] });
    const [siti, dewi] = h.orang.filter((o: Apa) => o.jenis === "kuasa");
    expect(siti.usulan.email).toMatchObject({ nilai: "kantor.anwar@gmail.com", keyakinan: "ragu" });
    expect(siti.usulan.email.sumber[0].label).not.toContain("dipakai bersama");
    expect(dewi.usulan.email).toBeNull();
  });

  it("kamus lapis database: pola kontak-label-pihak dinaikkan 'pasti' sesudah diukur -> kontak teks menjadi 'cukup'", () => {
    const asli = kamus.polaKelompok("kontak").find((p: Apa) => p.kode === "kontak-label-pihak");
    kamus.aturLapisDatabase({ pola: [{ ...asli, re: undefined, kelompok: "kontak", yakin: "pasti", status: "aktif" }], templat: [] });
    const h = K.susunKontak({ pihak: SIPP_PIHAK, kuasa: [], dokumen: [{ judul: "Gugatan", peran: "gugatan", teks: GUGATAN_MANDIRI.replace("JOKO bin SAMIN", "SITI AMINAH binti RAHMAN") }] });
    expect(h.orang.find((o: Apa) => o.pihakKe === 2).usulan.hp.keyakinan).toBe("cukup");
  });

  it("mode ukur mematikan 'cocokkan dengan SIPP' supaya ketepatan tidak melingkar", () => {
    const kuasa = [
      { pihakKe: 1, urutan: 1, pengacaraId: 1, nama: "A", email: "", telepon: "" },
      { pihakKe: 1, urutan: 2, pengacaraId: 2, nama: "B", email: "kantor@law.id", telepon: "" },
    ];
    const biasa = K.susunKontak({ pihak: SIPP_PIHAK, kuasa, pengunggah: [{ peran: "Penggugat", email: "kantor@law.id" }] });
    expect(biasa.orang.find((o: Apa) => o.nama === "B").usulan.email.terhadapSipp).toBe("sama");
    const ukur = K.susunKontak({ pihak: SIPP_PIHAK, kuasa, pengunggah: [{ peran: "Penggugat", email: "kantor@law.id" }], ukur: true });
    expect(ukur.orang.find((o: Apa) => o.nama === "B").usulan.email).toBeNull();
    expect(ukur.orang.find((o: Apa) => o.nama === "A").usulan.email.keyakinan).toBe("ragu");
  });

  it("baris ringkasan untuk variabel ABT: hanya nilai e-Court, kunci kontak.p/k<sisi>.<urutan>.<kolom>, telepon rumah dan email > 50 huruf dilewati", () => {
    const panjang = `${"a".repeat(45)}@gmail.com`;
    const h = K.susunKontak({
      pihak: SIPP_PIHAK,
      kuasa: [{ pihakKe: 1, urutan: 3, pengacaraId: 9, nama: "X", email: "", telepon: "" }],
      pengunggah: [{ peran: "Tergugat", email: "siti.a@gmail.com" }, { peran: "Penggugat", email: panjang }],
      ecourtPihak: [{ nama: "SITI AMINAH", peran: "Tergugat", email: "", telp: "0451 421234" }],
    });
    const baris = K.barisRingkasan(h);
    expect(baris.map((b: Apa) => b.kunci)).toEqual(["kontak.p2.1.email"]);
    expect(baris[0]).toMatchObject({ nilai: "siti.a@gmail.com", keyakinan: "cukup", asal: "akun" });
    expect(K.barisDariUsulanAbt([{ kode: "6055", nilai: "Rp1.000.000", keyakinan: "ragu", sumber: [{ kalimat: "e-Court: Jawaban" }] }, { kode: "abc", nilai: "x" }])).toEqual([
      { kunci: "abt.6055", nilai: "Rp1.000.000", keyakinan: "ragu", asal: "teks", sumber: "e-Court: Jawaban" },
    ]);
  });

  it("DDL tabel ringkasan bot SAMA dengan yang dipasang paket ABT (variabel tidak pernah galat)", () => {
    const paket = "D:/aleta-dev/kerja/abt-data-ecourt/paket-satker/abt-data-ecourt-PASANG.sql";
    const baku = (s: string) => s.replace(/aleta_bot\./g, "").replace(/\s+/g, " ").trim();
    expect(baku(K.DDL_RINGKASAN)).toMatch(/^CREATE TABLE IF NOT EXISTS aleta_bot_ecourt_ringkasan \(/);
    if (!existsSync(paket)) return; // paket hanya ada di laptop pengembang
    expect(baku(readFileSync(paket, "utf8"))).toContain(baku(K.DDL_RINGKASAN));
  });
});

// ── Portal ────────────────────────────────────────────────────────────────

const arsip = (judul: string, peran = "Penggugat", lain: Partial<DokumenArsip> = {}): DokumenArsip => ({
  documentKey: `k-${judul}`,
  judulDokumen: judul,
  jenisDokumen: "",
  peranPengunggah: peran,
  diunggahPada: "2026-07-01",
  adaPdf: false,
  adaWord: true,
  ...lain,
});

describe("portal: kontak-pihak (modul kontak-ecourt) dengan bot sungguhan", () => {
  it("membaca surat gugatan + surat kuasa + jawaban TANPA OCR, mengirim teksnya ke bot, memulangkan usulan per orang", async () => {
    const teks: Record<string, string> = {
      "k-Surat Gugatan": GUGATAN_MANDIRI.replace("RINA WATI binti AHMAD", "BUDI SANTOSO bin HASAN").replace("JOKO bin SAMIN", "SITI AMINAH binti RAHMAN"),
      "k-Surat Kuasa Khusus": "Surat kuasa: kosong",
      "k-Jawaban Tergugat": JAWABAN_BERKUASA,
    };
    const ocr: boolean[] = [];
    const dikirim: Apa[] = [];
    const h = await bacaKontakEcourt(
      { nomor: "324/Pdt.G/2026/PA.Dgl", teks: true },
      {
        rincian: async () => ({
          ok: true,
          dokumen: [arsip("Surat Gugatan"), arsip("Surat Kuasa Khusus"), arsip("Jawaban Tergugat", "Tergugat", { jenisDokumen: "Jawaban" }), arsip("Dokumen Bukti P-1")],
        }),
        ambilBerkas: async (key) => Buffer.from(key),
        halamanPdf: async () => [],
        bacaTeks: async (data, bolehOcr) => {
          ocr.push(bolehOcr);
          return { teks: teks[data.toString()] || "", sumber: "teks", sebab: "" };
        },
        kirimBot: async (muatan) => {
          dikirim.push(muatan);
          return { ok: true, ada: true, perkaraId: 9826, nomorPerkara: muatan.nomorPerkara, ...K.susunKontak({ pihak: SIPP_PIHAK, kuasa: [], dokumen: muatan.dokumen }) };
        },
      }
    );
    expect(ocr.every((x) => x === false)).toBe(true);
    expect(dikirim[0].dokumen.map((d: Apa) => `${d.peran}:${d.judul}`)).toEqual(["gugatan:Surat Gugatan", "jawaban:Jawaban Tergugat"]);
    expect(dikirim[0].dokumen[1].penuntutKode).toBe("0047");
    expect(h.dokumen.map((d) => `${d.peran}:${d.terbaca}`)).toEqual(["gugatan:true", "kuasa:false", "jawaban:true"]);
    expect(h.ada).toBe(true);
    const p1 = (h.orang as Apa[]).find((o) => o.pihakKe === 1);
    expect(p1.usulan.email.nilai).toBe("rina.wati@yahoo.co.id");
  });

  it("rencana baca: satu gugatan, surat kuasa, lalu jawab-menjawab; bukti tidak dibaca", () => {
    const r = rencanaBacaKontak([arsip("Dokumen Bukti"), arsip("Surat Gugatan"), arsip("Perbaikan Gugatan"), arsip("Surat Kuasa"), arsip("Replik", "Penggugat", { jenisDokumen: "Replik" })]);
    expect(r.map((d) => d.judulDokumen)).toEqual(["Perbaikan Gugatan", "Surat Kuasa", "Replik"]);
  });

  it("borang di luar halaman perkara (nama saja) dan bot lama: catatan jujur, tanpa usulan", async () => {
    const deps = {
      rincian: async () => ({ ok: false, dokumen: [] }),
      ambilBerkas: async () => null,
      halamanPdf: async () => [],
      bacaTeks: async () => ({ teks: "", sumber: "" as const, sebab: "" }),
    };
    const lama = await bacaKontakEcourt({ nama: "BUDI" }, { ...deps, kirimBot: async () => null });
    expect(lama.ada).toBe(false);
    expect(lama.catatan.join(" ")).toContain("rute /abt/kontak-ecourt");
    const tidakAda = await bacaKontakEcourt({ nama: "BUDI" }, { ...deps, kirimBot: async () => ({ ok: true, ada: false, sebab: "tidak_ada_perkara_ecourt" }) });
    expect(tidakAda.catatan).toEqual(["Nama ini tidak ditemukan pada perkara e-Court mana pun."]);
  });

  it("isi-gugatan meneruskan `kontak` dari bot ke panel ABT (bot lama tanpa kontak -> null)", async () => {
    const deps = {
      rincian: async () => ({ ok: true, dokumen: [arsip("Surat Gugatan")] }),
      ambilBerkas: async () => Buffer.from("x"),
      halamanPdf: async () => [],
      bacaTeks: async () => ({ teks: GUGATAN_MANDIRI.repeat(3), sumber: "teks" as const, sebab: "" }),
    };
    const kontak = { ok: true, ada: true, orang: [{ jenis: "pihak", pihakKe: 1 }] };
    const baru = await bacaIsiGugatan("1/Pdt.G/2026/PA.Dgl", { lawan: "Penggugat", pelaku: "Tergugat" }, { ...deps, kirimBot: async () => ({ ok: true, ada: true, usulan: [], kontak }) });
    expect(baru.kontak).toEqual(kontak);
    const lama = await bacaIsiGugatan("1/Pdt.G/2026/PA.Dgl", { lawan: "Penggugat", pelaku: "Tergugat" }, { ...deps, kirimBot: async () => ({ ok: true, ada: true, usulan: [] }) });
    expect(lama.kontak).toBeNull();
  });
});

// ── Ekstensi: lajur SIPP (konten.js) ─────────────────────────────────────

describe("lajur 'Kontak dari e-Court' di blangko Data Pihak SIPP (blok KONTAK-EC konten.js)", () => {
  const sumber = readFileSync(path.join(AKAR, "ekstensi-sipp/konten.js"), "utf8").replace(/\r\n/g, "\n");
  const awal = sumber.indexOf("/* === KONTAK-EC 11 Okt === */");
  const akhir = sumber.indexOf("/* K5 mulai */", awal);
  const blok = sumber.slice(awal, akhir);

  function pasang(jawaban: Apa, nomor = "324/Pdt.G/2026/PA.Dgl") {
    const jembatan: Apa[] = [];
    const diminta: string[] = [];
    const f = new Function(
      "saksiscanModeUi",
      "saksiscanTampak",
      "saksiscanEl",
      "saksiscanJembatan",
      "cariNomorPerkara",
      "alatAmbil",
      `${blok}\nreturn { k5BarisUsulan, k5CariOrang, k5Periksa, k5Keadaan: k5Keadaan_ };`
    );
    const api = f(
      () => true,
      (el: Apa) => Boolean(el && el.isConnected),
      (tag: string, kelas: string, teks?: string) => {
        const e = document.createElement(tag);
        if (kelas) e.className = kelas;
        if (teks !== undefined && teks !== null) e.textContent = String(teks);
        return e;
      },
      async (pesan: Apa) => {
        jembatan.push(pesan);
        const el = document.querySelector(pesan.penunjuk) as HTMLInputElement | null;
        if (el) el.value = pesan.nilai;
        return { ok: true };
      },
      () => nomor,
      async (alamat: string) => {
        diminta.push(alamat);
        return { ok: true, status: 200, json: async () => ({ data: jawaban }) };
      }
    );
    return { api, jembatan, diminta };
  }

  function borang(nama: string, email = "", hp = "") {
    document.body.innerHTML = `<div id="popup"><form id="frm_ref_pihak"><input id="pihak_fullname" value="${nama}"><input id="pihak_no_tlp" value="${hp}"><input id="pihak_email" value="${email}"><input type="hidden" id="act_frm_ref_pihak" value="updt"></form></div>`;
    return document.querySelector("form#frm_ref_pihak") as HTMLFormElement;
  }

  const ORANG = [
    {
      jenis: "pihak",
      pihakKe: 2,
      urutan: 1,
      nama: "SITI AMINAH binti RAHMAN",
      usulan: {
        email: { nilai: "siti.a@gmail.com", keyakinan: "cukup", terhadapSipp: "kosong", sumber: [{ label: "akun e-Court yang mengunggah berkas sebagai Tergugat", kutipan: "" }], nilaiLain: [] },
        hp: { nilai: "085344445555", keyakinan: "ragu", terhadapSipp: "beda", jenisNomor: "hp", sumber: [{ label: "e-Court: Surat Gugatan", kutipan: "nomor HP 0853 4444 5555" }], nilaiLain: [] },
      },
    },
  ];

  async function tunggu(api: Apa) {
    // pertama: nama dicatat (menunggu tenang), sesudah 0,7 detik: dibaca
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-11T08:00:00Z"));
    await api.k5Periksa();
    vi.setSystemTime(new Date("2026-10-11T08:00:01Z"));
    await api.k5Periksa();
  }

  it("keadaan per kolom: kosong -> Isi, sama -> tanpa tombol, beda -> perlu konfirmasi", () => {
    const { api } = pasang({});
    const baris = api.k5BarisUsulan(ORANG[0], { email: "", hp: "082211110000" });
    expect(baris.map((b: Apa) => [b.kolom, b.keadaan, b.perluKonfirmasi])).toEqual([
      ["email", "kosong", false],
      ["hp", "beda", true],
    ]);
    expect(api.k5BarisUsulan(ORANG[0], { email: "SITI.A@gmail.com", hp: "+62 853-4444-5555" }).map((b: Apa) => b.keadaan)).toEqual(["sama", "sama"]);
    expect(api.k5CariOrang(ORANG, "Siti Aminah Binti Rahman", "pihak")).toBe(ORANG[0]);
    expect(api.k5CariOrang(ORANG, "SITI", "pihak")).toBeNull();
  });

  it("lajur berdiri DI LUAR blangko; Isi mengisi medan kosong lewat jembatan; medan berisi lain hanya diganti sesudah dicentang; Simpan tidak ditekan", async () => {
    const f = borang("SITI AMINAH binti RAHMAN", "", "082211110000");
    const { api, jembatan, diminta } = pasang({ ada: true, nomorPerkara: "324/Pdt.G/2026/PA.Dgl", orang: ORANG });
    await tunggu(api);
    expect(diminta[0]).toBe("/aleta/api/aleta-ecourt/kontak-pihak?teks=1&nomor=324%2FPdt.G%2F2026%2FPA.Dgl&nama=SITI+AMINAH+binti+RAHMAN");
    const lajur = f.previousElementSibling as HTMLElement;
    expect(lajur.className).toContain("aleta-k5-kontak");
    expect(f.querySelectorAll("[class*='aleta'], [data-aleta]").length).toBe(0);
    expect(lajur.textContent).toContain("Email: siti.a@gmail.com");
    const tombol = Array.from(lajur.querySelectorAll("button")) as HTMLButtonElement[];
    expect(tombol.map((t) => t.textContent)).toEqual(["Isi", "Ganti isian blangko"]);
    expect(tombol[1].disabled).toBe(true);
    tombol[0].click();
    await new Promise((r) => setTimeout(r, 0));
    expect(jembatan).toEqual([{ jenis: "isi", penunjuk: "form#frm_ref_pihak #pihak_email", jenisMedan: "teks", nilai: "siti.a@gmail.com" }]);
    expect((f.querySelector("#pihak_email") as HTMLInputElement).value).toBe("siti.a@gmail.com");
    expect((f.querySelector("#pihak_no_tlp") as HTMLInputElement).value).toBe("082211110000");
    const centang = lajur.querySelector("input[type=checkbox]") as HTMLInputElement;
    centang.checked = true;
    centang.dispatchEvent(new Event("change"));
    expect(tombol[1].disabled).toBe(false);
    tombol[1].click();
    await new Promise((r) => setTimeout(r, 0));
    expect(jembatan[1]).toMatchObject({ penunjuk: "form#frm_ref_pihak #pihak_no_tlp", nilai: "085344445555" });
    expect(jembatan.some((j) => /simpan|submit/i.test(JSON.stringify(j)))).toBe(false);
  });

  it("nama yang tidak sama dengan pihak perkara: tidak ada tombol, disebut terus terang", async () => {
    const f = borang("ORANG LAIN");
    const { api } = pasang({ ada: true, nomorPerkara: "324/Pdt.G/2026/PA.Dgl", orang: ORANG });
    await tunggu(api);
    const lajur = f.previousElementSibling as HTMLElement;
    expect(lajur.querySelectorAll("button").length).toBe(0);
    expect(lajur.textContent).toContain("tidak sama dengan pihak perkara 324/Pdt.G/2026/PA.Dgl");
  });

  it("lajur bantu data saksi di antara lajur ini dan blangko tidak membuat keduanya saling memindahkan", async () => {
    const f = borang("SITI AMINAH binti RAHMAN");
    const { api } = pasang({ ada: true, nomorPerkara: "x", orang: ORANG });
    await tunggu(api);
    const lajur = f.previousElementSibling as HTMLElement;
    const saksi = document.createElement("div");
    saksi.className = "aleta-c2-sbantu aleta-c2-sbantu-ref";
    f.parentElement!.insertBefore(saksi, f);
    await api.k5Periksa();
    expect(lajur.nextElementSibling).toBe(saksi);
    expect(saksi.nextElementSibling).toBe(f);
  });
});

// ── Ekstensi: panel ABT (abt.js) ─────────────────────────────────────────

describe("panel ABT: bacaan e-Court otomatis memuat kontak & domisili elektronik (blok KONTAK-EC abt.js)", () => {
  const sumber = readFileSync(path.join(AKAR, "ekstensi-sipp/abt.js"), "utf8").replace(/\r\n/g, "\n");
  const ambilBlok = (mulai: string, selesai: string) => {
    const a = sumber.indexOf(mulai);
    return sumber.slice(a, sumber.indexOf(selesai, a));
  };
  const blokP4 = ambilBlok("const P4_VAR_ECOURT", "/* === AKHIR P4P7B2 === */");
  const blokK5 = ambilBlok("/* === KONTAK-EC 11 Okt === */", "/* === AKHIR KONTAK-EC === */");

  function pasang(peta: Map<string, { nilai: string }>, fetchPalsu: (url: string) => Promise<Apa>) {
    const buatElemen = (tag: string, kelas: string, teks?: string) => {
      const el = document.createElement(tag);
      if (kelas) el.className = kelas;
      if (teks !== undefined && teks !== null) el.textContent = teks;
      return el;
    };
    const f = new Function(
      "buatElemen",
      "barisVariabel",
      "nilaiVariabel",
      "nomorPerkaraAbt",
      "sorePesan",
      "VAR_PIHAK_LAWAN",
      "VAR_PIHAK_PELAKU",
      "fetch",
      `${blokK5}\n${blokP4}\nreturn { p4BacaGugatan, k5GambarKontak };`
    );
    return f(
      buatElemen,
      () => peta,
      (k: string) => (peta.get(k) || { nilai: "" }).nilai,
      () => "324/Pdt.G/2026/PA.Dgl",
      (g: Apa) => String((g && g.message) || g),
      "0046",
      "0047",
      fetchPalsu
    );
  }

  const KONTAK = {
    ok: true,
    ada: true,
    orang: [
      { jenis: "pihak", pihakKe: 1, urutan: 1, nama: "BUDI", usulan: { email: null, hp: { nilai: "085211113333", keyakinan: "ragu", terhadapSipp: "kosong", sumber: [{ label: "e-Court: Jawaban", kutipan: "No. Hp" }] } } },
      { jenis: "pihak", pihakKe: 2, urutan: 1, nama: "SITI", usulan: { email: { nilai: "siti.a@gmail.com", keyakinan: "cukup", terhadapSipp: "kosong", sumber: [{ label: "akun e-Court", kutipan: "" }] }, hp: null } },
      { jenis: "kuasa", pihakKe: 1, urutan: 1, nama: "ANWAR", usulan: { email: null, hp: null } },
    ],
    domisili: { 1: { email: "kantor@law.id", milik: "kuasa", asal: "sipp", keyakinan: "pasti" }, 2: { email: "siti.a@gmail.com", milik: "pihak", asal: "akun", keyakinan: "cukup" } },
  };

  it("blangko yang hanya memuat variabel kontak (8801) tetap memicu bacaan e-Court, dan kontak ikut tersimpan di data.gugatan", async () => {
    const peta = new Map([["8801", { nilai: "" }], ["0046", { nilai: "Pemohon" }], ["0047", { nilai: "Termohon" }]]);
    const diminta: string[] = [];
    const p = pasang(peta, async (url) => {
      diminta.push(url);
      return { ok: true, status: 200, json: async () => ({ data: { usulan: [], kontak: KONTAK } }) };
    });
    const data: Apa = { catatan: [] };
    await p.p4BacaGugatan(data);
    expect(diminta).toHaveLength(1);
    expect(data.gugatan.kontak).toEqual(KONTAK);
  });

  it("lipatan menyebut sebutan dua arah (0046 = Pemohon pihak ke-1, 0047 = Termohon pihak ke-2), kuasa tanpa usulan tidak ditampilkan, domisili per sisi", () => {
    const peta = new Map([["0046", { nilai: "Pemohon" }], ["0047", { nilai: "Termohon" }]]);
    const p = pasang(peta, async () => null);
    const wadah = document.createElement("div");
    p.k5GambarKontak(wadah, { gugatan: { kontak: KONTAK } });
    const teks = wadah.textContent || "";
    expect(teks).toContain("Kontak & domisili elektronik dari e-Court: 2 orang · 2 belum ada di SIPP");
    expect(teks).toContain("Pemohon - BUDI: HP/WA 085211113333 (SIPP kosong; ragu)");
    expect(teks).toContain("Termohon - SITI: email siti.a@gmail.com (SIPP kosong; cukup)");
    expect(teks).not.toContain("ANWAR");
    expect(teks).toContain("Domisili elektronik Pemohon: kantor@law.id (email kuasa, dari SIPP)");
    expect(teks).toContain("Domisili elektronik Termohon: siti.a@gmail.com (email pihak, dari e-Court, cukup)");
    const kosong = document.createElement("div");
    p.k5GambarKontak(kosong, { gugatan: { kontak: { ada: false } } });
    expect(kosong.children.length).toBe(0);
  });
});
