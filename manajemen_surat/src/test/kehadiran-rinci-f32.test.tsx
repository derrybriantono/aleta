import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DaftarHadirRinci, RingkasKehadiran, UsulanKehadiranBlangko, daftarPilihanHadir } from "@/components/portal/kehadiran-rinci-sidang";

import {
  bahanKehadiranDariBaris,
  jamTitik,
  kalimatRingkas,
  kunciKehadiran,
  ringkasKehadiran,
  sebutanOrang,
  statusOrang,
  susunKehadiran,
  usulanBas,
  usulanDihadiriOleh,
  type KehadiranOrang,
} from "@/lib/kehadiran-rinci";

const P1: KehadiranOrang = { id: "a", peran: "penggugat", jam: "08:47", nama: "Ani" };
const KUASA_T: KehadiranOrang = { id: "b", peran: "tergugat", sebagaiKuasa: true, jam: "09:10", nama: "Budi, S.H." };
const SAKSI_P1: KehadiranOrang = { id: "c", peran: "saksi", saksiUntuk: "pihak_1", jam: "09:40", nama: "Siti" };

describe("F3.2 kehadiran rinci - ringkasan baris jadwal", () => {
  it("Penggugat hadir 08.47 · Tergugat belum · Saksi P 1/2", () => {
    const s = susunKehadiran([P1, SAKSI_P1], null);
    const teks = kalimatRingkas(ringkasKehadiran(s, { saksiDiajukanP: 2 }));
    expect(teks).toBe("Penggugat hadir 08.47 · Tergugat belum · Saksi P 1/2");
  });

  it("kuasa saja disebut kuasa; pribadi + kuasa digabung", () => {
    const s = susunKehadiran([KUASA_T, P1, { ...P1, id: "d", sebagaiKuasa: true, jam: "08:50" }], null);
    const teks = kalimatRingkas(ringkasKehadiran(s));
    expect(teks).toContain("Penggugat + kuasa hadir 08.47");
    expect(teks).toContain("Kuasa Tergugat hadir 09.10");
  });

  it("kolom mesin kios mengisi sisi tanpa catatan rinci", () => {
    const s = susunKehadiran([], { pihak1: "08:15", pihak2: "", saksi: "08:30" });
    expect(s.pihak1.hadir).toBe(true);
    expect(s.pihak1.dariAntrianSaja).toBe(true);
    expect(kalimatRingkas(ringkasKehadiran(s))).toBe("Penggugat hadir 08.15 · Tergugat belum · Saksi 1");
  });

  it("tidak ada catatan dan belum disidang = tanpa ringkasan", () => {
    expect(ringkasKehadiran(susunKehadiran([], null), { saksiDiajukanP: 2 })).toEqual([]);
  });

  it("sebutan perkara dipakai (Pemohon/Termohon), saksi T", () => {
    const s = susunKehadiran([{ peran: "pemohon", jam: "08:01" }, { peran: "saksi", saksiUntuk: "pihak_2", jam: "08:05" }], null);
    const teks = kalimatRingkas(ringkasKehadiran(s, { sebutanSatu: "Pemohon", sebutanDua: "Termohon", saksiDiajukanT: 1 }));
    expect(teks).toBe("Pemohon hadir 08.01 · Termohon belum · Saksi T 1/1");
  });

  it("sedang disidang dan pulang", () => {
    const s = susunKehadiran([{ ...P1, pulangJam: "10:12" }], { diRuang: 2 });
    const pot = ringkasKehadiran(s);
    expect(kalimatRingkas(pot)).toBe("Penggugat pulang 08.47 · Tergugat belum · sedang disidang R2");
    expect(statusOrang(P1, s).label).toBe("di ruang sidang 2");
    expect(statusOrang({ ...P1, pulangJam: "10:12" }, s).label).toBe("pulang 10.12");
  });
});

describe("F3.2 usulan Dihadiri oleh (sandi SIPP)", () => {
  it("P+T 1, P 2, T 3, tidak ada catatan null (BUKAN 4)", () => {
    expect(usulanDihadiriOleh(susunKehadiran([P1, KUASA_T], null)).sandi).toBe(1);
    expect(usulanDihadiriOleh(susunKehadiran([P1], null)).sandi).toBe(2);
    expect(usulanDihadiriOleh(susunKehadiran([KUASA_T], null)).sandi).toBe(3);
    const kosong = usulanDihadiriOleh(susunKehadiran([], null));
    expect(kosong.sandi).toBeNull();
    expect(kosong.alasan).toContain("Belum ada");
  });

  it("permohonan tanpa pihak kedua: pemohon hadir = semua pihak", () => {
    const u = usulanDihadiriOleh(susunKehadiran([{ peran: "pemohon", jam: "08:00" }], null), { tanpaPihakKedua: true, sebutanSatu: "Pemohon" });
    expect(u.sandi).toBe(1);
  });

  it("turut tergugat: usulan utama tetap 1-4, sandi rinci 14 disebut", () => {
    const u = usulanDihadiriOleh(susunKehadiran([P1, { peran: "turut-tergugat", jam: "09:00" }], null), { adaTurut: true });
    expect(u.sandi).toBe(2);
    expect(u.sandiRinci).toBe(14);
    expect(u.labelRinci).toBe("Penggugat dan Turut Tergugat");
  });

  it("turut tergugat terdaftar tetapi belum hadir: 1 dengan catatan terus terang", () => {
    const u = usulanDihadiriOleh(susunKehadiran([P1, KUASA_T], null), { adaTurut: true });
    expect(u.sandi).toBe(1);
    expect(u.sandiRinci).toBeNull();
    expect(u.alasan).toContain("Turut Tergugat belum tercatat hadir");
  });

  it("intervensi terdaftar tetapi tidak hadir: 1 dengan rinci 9", () => {
    const u = usulanDihadiriOleh(susunKehadiran([P1, KUASA_T], null), { adaIntervensi: true });
    expect(u.sandi).toBe(1);
    expect(u.sandiRinci).toBe(9);
  });

  it("sebagian penggugat: rinci 10 hanya bila jumlah pihak diketahui dan tanpa kuasa", () => {
    const u = usulanDihadiriOleh(susunKehadiran([{ ...P1, urutanPihak: "I" }], null), { jumlahPihak1: 2 });
    expect(u.sandi).toBe(2);
    expect(u.sandiRinci).toBe(10);
    const dariKios = usulanDihadiriOleh(susunKehadiran([], { pihak1: "08:00" }), { jumlahPihak1: 2 });
    expect(dariKios.sandiRinci).toBeNull();
  });

  it("alasan menyebut siapa dan jamnya", () => {
    const u = usulanDihadiriOleh(susunKehadiran([P1, KUASA_T], null));
    expect(u.alasan).toBe("Tercatat hadir: Penggugat 08.47, kuasa Tergugat 09.10.");
  });
});

describe("F3.2 usulan BAS", () => {
  it("bunyi per pihak dan saksi diperiksa", () => {
    const s = susunKehadiran([P1, KUASA_T, { ...SAKSI_P1, diperiksaJam: "10:00" }, { ...SAKSI_P1, id: "e", nama: "Rudi" }], {
      diRuang: 1,
    });
    const u = usulanBas(s);
    expect(u.penggugat).toEqual({ hadir: true, bunyi: "hadir secara pribadi" });
    expect(u.tergugat).toEqual({ hadir: true, bunyi: "tidak hadir, diwakili kuasanya" });
    expect(u.saksiDiperiksa).toEqual([{ sisi: "P", nama: "Siti", jam: "09.40" }]);
    expect(u.saksiHadirBelumDiperiksa.map((x) => x.nama)).toEqual(["Rudi"]);
  });

  it("tidak hadir hanya bila sidang berjalan DAN sisi lain hadir", () => {
    expect(usulanBas(susunKehadiran([P1], null)).tergugat.hadir).toBeNull();
    expect(usulanBas(susunKehadiran([P1], { selesaiDisidang: true })).tergugat).toEqual({
      hadir: false,
      bunyi: "tidak hadir dan tidak pula menyuruh orang lain sebagai wakil/kuasanya",
    });
    expect(usulanBas(susunKehadiran([], { selesaiDisidang: true })).penggugat.hadir).toBeNull();
  });
});

describe("F3.2 bahan dari baris jadwal", () => {
  it("cerai talak = Pemohon/Termohon; turut tergugat disaring dari tergugat", () => {
    const b = bahanKehadiranDariBaris({
      alurPerkaraId: 15,
      jenisPerkaraId: 346,
      jenisPerkara: "Cerai Talak",
      nomorPerkara: "1/Pdt.G/2026/PA.Dgl",
      pihak: { penggugat: ["A"], tergugat: ["B", "C"], turutTergugat: ["C"] },
      saksiPihak1: 2,
    });
    expect(b.sebutanSatu).toBe("Pemohon");
    expect(b.sebutanDua).toBe("Termohon");
    expect(b.adaTurut).toBe(true);
    expect(b.jumlahPihak2).toBe(1);
    expect(b.tanpaPihakKedua).toBe(false);
    expect(b.saksiDiajukanP).toBe(2);
  });

  it("sebutan orang dan kunci peta", () => {
    expect(sebutanOrang(KUASA_T, { sebutanDua: "Termohon" })).toBe("Kuasa Termohon");
    expect(sebutanOrang({ peran: "saksi", saksiUntuk: "pihak_1", urutanPihak: "2" })).toBe("Saksi Penggugat 2");
    expect(kunciKehadiran(10094, "2026-10-01 00:00:00")).toBe("10094|2026-10-01");
    expect(jamTitik("08:47:12")).toBe("08.47");
  });
});

describe("F3.2 tampilan (UI Baru, bahasa awam)", () => {
  const bahan = { sebutanSatu: "Pemohon", sebutanDua: "Termohon", saksiDiajukanP: 2, namaSaksiP: ["Siti"], adaTurut: false };

  it("pilihan Siapa yang hadir: pilihan lama tetap ada + saksi per pihak bernama", () => {
    const label = daftarPilihanHadir(bahan).map((p) => p.label);
    expect(label.slice(0, 4)).toEqual(["Pemohon", "Kuasa Pemohon", "Termohon", "Kuasa Termohon"]);
    expect(label).toContain("Saksi Pemohon 1: Siti");
    expect(label).toContain("Saksi Pemohon 2");
    expect(label).toContain("Saksi Termohon");
    const kuasa = daftarPilihanHadir(bahan).find((p) => p.kunci === "kuasa-p2");
    // Kuasa dikirim sebagai peran pihaknya + sebagaiKuasa (peran "kuasa-tergugat" ditolak bot).
    expect(kuasa).toMatchObject({ peran: "termohon", sebagaiKuasa: true, sisi: "pihak_2" });
    expect(daftarPilihanHadir({ ...bahan, tanpaPihakKedua: true }).map((p) => p.label)).not.toContain("Termohon");
  });

  it("ringkasan, daftar hadir, dan usulan blangko tanpa istilah teknis", () => {
    const html = [
      renderToStaticMarkup(<RingkasKehadiran potongan={ringkasKehadiran(susunKehadiran([P1, SAKSI_P1], null), { saksiDiajukanP: 2 })} />),
      renderToStaticMarkup(<DaftarHadirRinci perkaraId="1" hadir={[P1, SAKSI_P1]} susun={{ ruang: "menunggu", noRuang: null }} bahan={{}} />),
      renderToStaticMarkup(
        <UsulanKehadiranBlangko kehadiran={[KUASA_T]} antrian={null} bahan={{}} dihadiri={4} pilihanSah={[1, 2, 3, 4]} onPakai={() => undefined} />
      ),
    ].join("");
    expect(html).toContain("Penggugat hadir 08.47");
    expect(html).toContain("Saksi P 1/2");
    expect(html).toContain("Pulang");
    expect(html).toContain("Diperiksa");
    expect(html).toContain("Pakai usulan: Tergugat saja");
    for (const teknis of ["pihak_1", "pihak_2", "sandi", "dihadiri_oleh", "undefined", "null"]) expect(html).not.toContain(teknis);
  });

  it("tanpa catatan apa pun, tidak ada yang digambar", () => {
    expect(renderToStaticMarkup(<RingkasKehadiran potongan={[]} />)).toBe("");
    expect(
      renderToStaticMarkup(<UsulanKehadiranBlangko kehadiran={[]} antrian={null} bahan={{}} dihadiri={4} pilihanSah={[1, 2, 3, 4]} onPakai={() => undefined} />)
    ).toBe("");
  });
});
