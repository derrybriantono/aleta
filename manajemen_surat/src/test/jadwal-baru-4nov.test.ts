import { describe, expect, it } from "vitest";

import {
  alihPil,
  bacaAntarmuka,
  bacaSaringanTersimpan,
  buatIndeksPil,
  cocokPil,
  geserIso,
  jamDalamRentang,
  keadaanSegmen,
  lepasPil,
  pasangRentangJam,
  perkiraanBht,
  perluPbt,
  perluCatatHasil,
  pisahNamaHakim,
  rencanaCcBerikut,
  saranCari,
  tahapDariAgenda,
  tambahPil,
  tanggalPendekId,
  tanggalPendekTahunId,
  tanggalTundaBedaCc,
  type PetaMedan,
  type Pil,
  type TagSaran,
} from "@/lib/jadwal-baru";

/**
 * 4 Nov 2026 - tampilan baru Jadwal Sidang / Jadwal Mediasi. Yang diuji di sini PERILAKU bahan murninya:
 * pilihan lama/baru, kotak cari berpil (atau/dan), saran dengan jumlah, tahap proses, sidang berikutnya,
 * tindak lanjut putusan, dan segmen Tunda | Putus. Data rekaan semua.
 */

type Baris = { no: string; pihak: string[]; hakim: string[]; ruang: string; jam: string };
const DATA: Baris[] = [
  { no: "1/Pdt.G/2026/PA.Xxx", pihak: ["Alfa", "Beta"], hakim: ["Hakim Satu", "Hakim Dua"], ruang: "Ruang 1", jam: "09:00" },
  { no: "2/Pdt.G/2026/PA.Xxx", pihak: ["Gamma", "Delta"], hakim: ["Hakim Satu"], ruang: "Ruang 2", jam: "10:30" },
  { no: "3/Pdt.P/2026/PA.Xxx", pihak: ["Epsilon"], hakim: ["Hakim Tiga"], ruang: "Ruang 1", jam: "13:15" },
];
const MEDAN: PetaMedan<Baris> = {
  nomor: { label: "Nomor", ambil: (b) => [b.no] },
  pihak: { label: "Pihak", ambil: (b) => b.pihak },
  hakim: { label: "Hakim", ambil: (b) => b.hakim },
  ruang: { label: "Ruang", ambil: (b) => [b.ruang] },
  jamRentang: { label: "Jam", sembunyi: true, uji: (b, v) => jamDalamRentang(b.jam, v) },
};

describe("pilihan Tampilan lama / baru", () => {
  it("bawaan BARU; hanya tulisan lama yang mengembalikan tampilan lama", () => {
    expect(bacaAntarmuka(null)).toBe("baru");
    expect(bacaAntarmuka(undefined)).toBe("baru");
    expect(bacaAntarmuka("")).toBe("baru");
    expect(bacaAntarmuka("sembarang")).toBe("baru");
    expect(bacaAntarmuka("baru")).toBe("baru");
    expect(bacaAntarmuka("lama")).toBe("lama");
  });
});

describe("pil: sama medan = atau, antarmedan = dan", () => {
  const cocok = (pil: Pil[]) => DATA.filter((b) => cocokPil(b, pil, MEDAN)).map((b) => b.no[0]);

  it("tanpa pil semua cocok", () => {
    expect(cocok([])).toEqual(["1", "2", "3"]);
  });
  it("dua nilai pada medan yang sama dihitung ATAU", () => {
    expect(cocok([{ medan: "ruang", nilai: "Ruang 1" }, { medan: "ruang", nilai: "Ruang 2" }])).toEqual(["1", "2", "3"]);
    expect(cocok([{ medan: "hakim", nilai: "Hakim Dua" }, { medan: "hakim", nilai: "Hakim Tiga" }])).toEqual(["1", "3"]);
  });
  it("medan berbeda dihitung DAN", () => {
    expect(cocok([{ medan: "ruang", nilai: "Ruang 1" }, { medan: "hakim", nilai: "Hakim Satu" }])).toEqual(["1"]);
    expect(cocok([{ medan: "ruang", nilai: "Ruang 2" }, { medan: "hakim", nilai: "Hakim Tiga" }])).toEqual([]);
  });
  it("kecocokan persis, bukan potongan kata", () => {
    expect(cocok([{ medan: "pihak", nilai: "Alf" }])).toEqual([]);
    expect(cocok([{ medan: "pihak", nilai: "Alfa" }])).toEqual(["1"]);
  });
  it("rentang jam memakai uji, bukan kesamaan", () => {
    expect(cocok([{ medan: "jamRentang", nilai: "09:00–12:00" }])).toEqual(["1", "2"]);
    expect(cocok([{ medan: "jamRentang", nilai: "13:00–16:00" }])).toEqual(["3"]);
  });
  it("medan yang tidak dikenal tidak membuang baris", () => {
    expect(cocok([{ medan: "tidak-ada", nilai: "x" }])).toEqual(["1", "2", "3"]);
  });
  it("tambah/lepas/alih pil: tidak ganda, alih dua kali = lepas", () => {
    const a = tambahPil([], { medan: "ruang", nilai: "Ruang 1" });
    expect(tambahPil(a, { medan: "ruang", nilai: "Ruang 1" })).toHaveLength(1);
    expect(tambahPil(a, { medan: "ruang", nilai: "Ruang 2" })).toHaveLength(2);
    expect(lepasPil(tambahPil(a, { medan: "ruang", nilai: "Ruang 2" }), 0)).toEqual([{ medan: "ruang", nilai: "Ruang 2" }]);
    expect(alihPil(a, { medan: "ruang", nilai: "Ruang 1" })).toEqual([]);
    expect(alihPil(a, { medan: "hakim", nilai: "Hakim Satu" })).toHaveLength(2);
  });
  it("rentang jam dari panel mengganti rentang lama dan menukar bila terbalik", () => {
    const awal = pasangRentangJam([{ medan: "ruang", nilai: "Ruang 1" }], "08:00", "10:00");
    expect(awal).toContainEqual({ medan: "jamRentang", nilai: "08:00–10:00" });
    const ganti = pasangRentangJam(awal, "15:00", "11:00");
    expect(ganti.filter((p) => p.medan === "jamRentang")).toEqual([{ medan: "jamRentang", nilai: "11:00–15:00" }]);
    expect(ganti).toContainEqual({ medan: "ruang", nilai: "Ruang 1" });
    // isian jam yang kosong tidak membuat pil
    expect(pasangRentangJam(ganti, "", "10:00").some((p) => p.medan === "jamRentang")).toBe(false);
  });
});

describe("saran cari", () => {
  const indeks = buatIndeksPil(DATA, MEDAN);
  const tag: TagSaran[] = [
    { kunci: "belum-bas", label: "Belum ada BAS", jumlah: 2, nyala: false },
    { kunci: "retur", label: "Retur", jumlah: 0, nyala: false },
    { kunci: "ghaib", label: "Ghaib", jumlah: 1, nyala: true },
  ];

  it("indeks menghitung jumlah baris per nilai, terbanyak lebih dulu", () => {
    expect(indeks.ruang).toEqual([
      ["Ruang 1", 2],
      ["Ruang 2", 1],
    ]);
    expect(indeks.hakim?.[0]).toEqual(["Hakim Satu", 2]);
    expect(indeks.jamRentang).toBeUndefined();
  });
  it("mengetik menawarkan nilai dari data lengkap dengan jumlahnya", () => {
    const s = saranCari("hakim s", MEDAN, indeks, [], tag);
    expect(s).toContainEqual({ medan: "hakim", nilai: "Hakim Satu", jumlah: 2 });
    expect(s.some((x) => x.nilai === "Hakim Dua")).toBe(false);
  });
  it("beberapa kata harus semuanya ada", () => {
    expect(saranCari("hakim dua", MEDAN, indeks, [], tag).map((x) => x.nilai)).toEqual(["Hakim Dua"]);
  });
  it("medan:isi membatasi pada satu medan (kunci atau label)", () => {
    const s = saranCari("ruang:1", MEDAN, indeks, [], tag);
    expect(s.every((x) => x.medan === "ruang")).toBe(true);
    expect(s.map((x) => x.nilai)).toEqual(["Ruang 1"]);
    expect(saranCari("Pihak:alf", MEDAN, indeks, [], tag).map((x) => x.nilai)).toEqual(["Alfa"]);
  });
  it("nilai yang sudah menjadi pil tidak ditawarkan lagi", () => {
    const s = saranCari("ruang", MEDAN, indeks, [{ medan: "ruang", nilai: "Ruang 1" }], tag);
    expect(s.map((x) => x.nilai)).toEqual(["Ruang 2"]);
  });
  it("tag hanya ditawarkan bila berisi dan belum menyala", () => {
    const s = saranCari("bas", MEDAN, indeks, [], tag);
    expect(s).toContainEqual({ medan: "tag", nilai: "belum-bas", teks: "Belum ada BAS", jumlah: 2 });
    expect(saranCari("retur", MEDAN, indeks, [], tag)).toEqual([]);
    expect(saranCari("ghaib", MEDAN, indeks, [], tag)).toEqual([]);
  });
  it("medan tersembunyi tidak pernah muncul sebagai saran", () => {
    expect(saranCari("09", MEDAN, indeks, [], tag).some((x) => x.medan === "jamRentang")).toBe(false);
  });
  it("teks kosong menawarkan ciri dan tag yang berisi, tidak lebih dari batas", () => {
    const m: PetaMedan<Baris> = { ...MEDAN, ciri: { label: "Ciri", ambil: () => ["Ghaib", "Prodeo"] } };
    const s = saranCari("", m, buatIndeksPil(DATA, m), [], tag);
    expect(s.filter((x) => x.medan === "ciri")).toHaveLength(2);
    expect(s.filter((x) => x.medan === "tag").map((x) => x.nilai)).toEqual(["belum-bas"]);
  });
  it("hasil dibatasi sepuluh saran", () => {
    const besar = Array.from({ length: 40 }, (_, i) => ({ no: `${i}/x`, pihak: [`Nama ${i}`], hakim: [], ruang: "R", jam: "09:00" }));
    expect(saranCari("nama", MEDAN, buatIndeksPil(besar, MEDAN), [], []).length).toBe(10);
  });
});

describe("saringan tersimpan", () => {
  it("membaca daftar yang sah dan membuang yang rusak", () => {
    const baik = JSON.stringify([{ nama: "Ruang 1 pagi", pil: [{ medan: "ruang", nilai: "Ruang 1" }, { medan: 3, nilai: "x" }] }, { nama: 5 }, "x"]);
    expect(bacaSaringanTersimpan(baik)).toEqual([{ nama: "Ruang 1 pagi", pil: [{ medan: "ruang", nilai: "Ruang 1" }] }]);
    expect(bacaSaringanTersimpan("bukan json")).toEqual([]);
    expect(bacaSaringanTersimpan(null)).toEqual([]);
    expect(bacaSaringanTersimpan('{"a":1}')).toEqual([]);
  });
});

describe("tahap proses sidang (titik di lajur Agenda)", () => {
  const t = (agenda: string, o: { permohonan?: boolean; ikrar?: boolean } = {}) => tahapDariAgenda(agenda, o);
  it("urutan gugatan dan posisi titik", () => {
    expect(t("Pembacaan gugatan").nama).toBe("Pemeriksaan");
    expect(t("Mediasi").nama).toBe("Mediasi");
    expect(t("Jawaban Tergugat").nama).toBe("Jawab-menjawab");
    expect(t("Replik").nama).toBe("Jawab-menjawab");
    expect(t("Pembuktian Penggugat (saksi)").nama).toBe("Pembuktian");
    expect(t("Kesimpulan").nama).toBe("Pembuktian");
    expect(t("Putusan").nama).toBe("Putusan");
    expect(t("Musyawarah majelis").nama).toBe("Putusan");
    expect(t("Putusan").ke).toBe(4);
    expect(t("Pemeriksaan").daftar).toHaveLength(5);
  });
  it("pembacaan gugatan bukan pembacaan putusan", () => {
    expect(t("Pembacaan gugatan").nama).toBe("Pemeriksaan");
    expect(t("Pembacaan putusan").nama).toBe("Putusan");
  });
  it("ikrar talak punya tahap Ikrar di ujung", () => {
    const k = t("Penyaksian ikrar talak", { ikrar: true });
    expect(k.nama).toBe("Ikrar");
    expect(k.daftar.at(-1)).toBe("Ikrar");
    expect(k.ke).toBe(k.daftar.length - 1);
  });
  it("permohonan hanya tiga tahap, putusan disebut Penetapan", () => {
    const k = t("Pembacaan penetapan", { permohonan: true });
    expect(k.daftar).toEqual(["Pemeriksaan", "Pembuktian", "Penetapan"]);
    expect(k.nama).toBe("Penetapan");
    expect(t("Pembuktian saksi", { permohonan: true }).ke).toBe(1);
  });
  it("agenda kosong atau tak dikenal jatuh ke Pemeriksaan, tidak melempar galat", () => {
    expect(t("").nama).toBe("Pemeriksaan");
    expect(tahapDariAgenda(undefined).nama).toBe("Pemeriksaan");
    expect(t("Sidang keliling aneh").ke).toBe(0);
  });
});

describe("sidang berikutnya: tundaan dan rencana Court Calendar terpisah", () => {
  const cc = [
    { tanggal: "2026-11-03", agenda: "Hari ini" },
    { tanggal: "2026-11-24", agenda: "Pembuktian" },
    { tanggal: "2026-11-10", agenda: "Jawaban" },
  ];
  it("memilih rencana terdekat SESUDAH tanggal pembanding, bukan hari itu sendiri", () => {
    expect(rencanaCcBerikut(cc, "2026-11-03")).toEqual({ tanggal: "2026-11-10", agenda: "Jawaban" });
    expect(rencanaCcBerikut(cc, "2026-11-10")).toEqual({ tanggal: "2026-11-24", agenda: "Pembuktian" });
    expect(rencanaCcBerikut(cc, "2026-12-01")).toBeNull();
    expect(rencanaCcBerikut(undefined, "2026-11-03")).toBeNull();
    expect(rencanaCcBerikut([{ tanggal: "rusak", agenda: "x" }], "2026-11-03")).toBeNull();
  });
  it("peringatan hanya bila KEDUANYA ada dan tanggalnya berbeda", () => {
    const sepuluh = { tanggal: "2026-11-10", agenda: "Jawaban" };
    expect(tanggalTundaBedaCc("2026-11-10", sepuluh)).toBe(false);
    expect(tanggalTundaBedaCc("2026-11-10T00:00:00", sepuluh)).toBe(false);
    expect(tanggalTundaBedaCc("2026-11-11", sepuluh)).toBe(true);
    expect(tanggalTundaBedaCc("", sepuluh)).toBe(false);
    expect(tanggalTundaBedaCc("2026-11-11", null)).toBe(false);
  });
  it("tanggal pendek berbahasa Indonesia", () => {
    expect(tanggalPendekId("2026-11-10")).toBe("10 Nov");
    expect(tanggalPendekId("2026-08-01")).toBe("1 Agu");
    expect(tanggalPendekTahunId("2026-11-10")).toBe("10 Nov 2026");
    expect(tanggalPendekId("")).toBe("");
    expect(tanggalPendekId("bukan tanggal")).toBe("bukan tanggal");
  });
  it("menggeser tanggal melewati batas bulan dan tahun", () => {
    expect(geserIso("2026-12-25", 14)).toBe("2027-01-08");
    expect(geserIso("2026-02-20", 14)).toBe("2026-03-06");
  });
});

describe("perkiraan BHT: tidak mengarang", () => {
  it("tanggal BHT dari SIPP selalu dipakai", () => {
    expect(perkiraanBht({ tanggalBht: "2026-11-30", tanggalPutusan: "2026-11-01", verstek: true })).toEqual({ iso: "2026-11-30", sumber: "sipp" });
  });
  it("kontradiktoir: putusan + 14 hari, ditandai perkiraan", () => {
    expect(perkiraanBht({ tanggalPutusan: "2026-11-03", dihadiriOleh: 1, verstek: false })).toEqual({ iso: "2026-11-17", sumber: "perkiraan-putusan" });
  });
  it("verstek: PBT + 14 hari bila PBT terbaca; tanpa PBT TIDAK ditebak", () => {
    expect(perkiraanBht({ tanggalPutusan: "2026-11-03", tanggalPbt: "2026-11-06", dihadiriOleh: 2, verstek: true })).toEqual({ iso: "2026-11-20", sumber: "perkiraan-pbt" });
    expect(perkiraanBht({ tanggalPutusan: "2026-11-03", dihadiriOleh: 1, verstek: true })).toBeNull();
    // verstek tidak pernah dihitung dari tanggal putusan, walau PBT ada
    expect(perkiraanBht({ tanggalPutusan: "2026-11-03", tanggalPbt: "2026-11-10", dihadiriOleh: 1, verstek: true })?.iso).toBe("2026-11-24");
  });
  it("tidak semua pihak hadir (bukan verstek): menunggu PBT; tanggal putusan tak ada: tidak ditebak", () => {
    expect(perkiraanBht({ tanggalPutusan: "2026-11-03", dihadiriOleh: 2 })).toBeNull();
    expect(perkiraanBht({ tanggalPutusan: "2026-11-03", tanggalPbt: "2026-11-05", dihadiriOleh: 2 })?.iso).toBe("2026-11-19");
    expect(perkiraanBht({ tanggalPutusan: "", dihadiriOleh: 1 })).toBeNull();
    expect(perkiraanBht({ tanggalBht: "0000-00-00", tanggalPbt: "0000-00-00", tanggalPutusan: "", dihadiriOleh: 1 })).toBeNull();
  });
  it("yang menunggu PBT: verstek atau tidak semua pihak hadir", () => {
    expect(perluPbt({ verstek: true, dihadiriOleh: 1 })).toBe(true);
    expect(perluPbt({ verstek: false, dihadiriOleh: 2 })).toBe(true);
    expect(perluPbt({ verstek: false, dihadiriOleh: 1 })).toBe(false);
  });
});

describe("segmen Tunda | Putus", () => {
  const dasar = { boleh: true, sidangSelesai: false, ditunda: false, sampaiPendek: "", putus: false, amar: "", ikrar: false, ikrarSelesai: false };
  it("belum ada hasil: dua tombol kosong yang boleh ditekan", () => {
    const k = keadaanSegmen(dasar);
    expect(k).toMatchObject({ tampil: true, bisa: true, tundaNyala: false, putusNyala: false, labelTunda: "Tunda", labelPutus: "Putus" });
  });
  it("yang terisi disorot dan memuat ringkasan, dan TIDAK dapat ditekan lagi (tak ada penundaan kedua)", () => {
    const k = keadaanSegmen({ ...dasar, ditunda: true, sampaiPendek: "10 Nov", sidangSelesai: true });
    expect(k).toMatchObject({ bisa: false, tundaNyala: true, labelTunda: "Ditunda 10 Nov", tampil: true });
    const p = keadaanSegmen({ ...dasar, putus: true, amar: "Dikabulkan", sidangSelesai: true });
    expect(p).toMatchObject({ bisa: false, putusNyala: true, labelPutus: "Putus · Dikabulkan" });
  });
  it("tanpa izin (saklar/peran) dan tanpa hasil: segmen tidak digambar sama sekali", () => {
    expect(keadaanSegmen({ ...dasar, boleh: false }).tampil).toBe(false);
  });
  it("tanpa izin tetapi hasil sudah ada: hasil tetap tampak, hanya tidak dapat ditekan", () => {
    const k = keadaanSegmen({ ...dasar, boleh: false, ditunda: true, sidangSelesai: true });
    expect(k.tampil).toBe(true);
    expect(k.bisa).toBe(false);
  });
  it("ikrar: label berganti dan ikrar yang sudah dilaksanakan menyala di sisi Putus", () => {
    expect(keadaanSegmen({ ...dasar, ikrar: true })).toMatchObject({ labelTunda: "Tunda ikrar", labelPutus: "Ikrar dilaksanakan", putusNyala: false });
    const selesai = keadaanSegmen({ ...dasar, ikrar: true, ikrarSelesai: true, sidangSelesai: true });
    expect(selesai).toMatchObject({ putusNyala: true, bisa: false });
  });
  it("merah 'Catat hasil sidang' hanya bila selesai tetapi hasil kosong", () => {
    const x = { selesai: true, ditunda: false, putus: false, ikrarSelesai: false };
    expect(perluCatatHasil(x)).toBe(true);
    expect(perluCatatHasil({ ...x, selesai: false })).toBe(false);
    expect(perluCatatHasil({ ...x, ditunda: true })).toBe(false);
    expect(perluCatatHasil({ ...x, putus: true })).toBe(false);
    expect(perluCatatHasil({ ...x, ikrarSelesai: true })).toBe(false);
  });
});

describe("memecah nama majelis", () => {
  it("gelar yang memakai koma dilekatkan kembali ke namanya", () => {
    expect(pisahNamaHakim("Dr. Ahmad Fulan, S.H., M.H., Budi Santoso, S.Ag., Citra Dewi, Lc., M.A.")).toEqual([
      "Dr. Ahmad Fulan, S.H., M.H.",
      "Budi Santoso, S.Ag.",
      "Citra Dewi, Lc., M.A.",
    ]);
  });
  it("satu nama, kosong, dan tanpa gelar", () => {
    expect(pisahNamaHakim("Hakim Tunggal, S.H.")).toEqual(["Hakim Tunggal, S.H."]);
    expect(pisahNamaHakim("")).toEqual([]);
    expect(pisahNamaHakim(undefined)).toEqual([]);
    expect(pisahNamaHakim("Nama Satu, Nama Dua")).toEqual(["Nama Satu", "Nama Dua"]);
  });
});
