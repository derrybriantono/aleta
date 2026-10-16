// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

/**
 * Rute jadwal sidang (Q3, 16 Okt 2026): tiap baris membawa `keadaanPutusan` (untuk pemilihan blangko putusan per keadaan di ekstensi), dan
 * `?rekomendasi=1` menambahkan `rekomendasiBlangko` (untuk tampilan Blangko ABT). Bot, basis data, dan akses ditiru; yang dijalankan SUNGGUHAN adalah rute.
 */

const sidang = [
  {
    sidangId: "1",
    perkaraId: "11",
    nomorPerkara: "11/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Cerai Gugat",
    tanggalSidang: "2026-10-16",
    jamSidang: "09:00",
    agenda: "Pembacaan putusan",
    urutanSidang: 4,
    dihadiriOleh: 2,
    alasanDitunda: "",
    ditunda: false,
    sudahPutus: true,
    statusPutusan: "Dikabulkan",
    verstekPutusan: false,
    panggilan: { hadirSebelumnya: 1, tergugatPernahHadir: true, penggugatPernahHadir: true, wajibDipanggil: [], belumDipanggil: 0, retur: 0, aman: true },
    mediasi: { hasil: "T" },
    mediasiTerbaca: true,
    lewatEcourt: true,
    kumulasi: null,
  },
  {
    sidangId: "2",
    perkaraId: "12",
    nomorPerkara: "12/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Cerai Gugat",
    tanggalSidang: "2026-10-16",
    jamSidang: "09:30",
    agenda: "Sidang",
    urutanSidang: 7,
    dihadiriOleh: 1,
    alasanDitunda: "Duplik Tergugat",
    ditunda: true,
    sudahPutus: false,
    panggilan: { hadirSebelumnya: 1, tergugatPernahHadir: true, penggugatPernahHadir: true, wajibDipanggil: [], belumDipanggil: 0, retur: 0, aman: true },
    mediasi: { hasil: "S" },
    mediasiTerbaca: true,
  },
  {
    sidangId: "3",
    perkaraId: "13",
    nomorPerkara: "13/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Cerai Gugat",
    tanggalSidang: "2026-10-16",
    jamSidang: "10:00",
    agenda: "Sidang pertama",
    urutanSidang: 1,
    dihadiriOleh: 2,
    alasanDitunda: "0",
    ditunda: true,
    sudahPutus: false,
    panggilan: { hadirSebelumnya: null, tergugatPernahHadir: false, penggugatPernahHadir: false, wajibDipanggil: [], belumDipanggil: 0, retur: 0, aman: true },
    mediasi: null,
    mediasiTerbaca: true,
    lewatEcourt: true,
  },
];

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr-uji" }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({ pastikanKapabilitas: async () => ({ name: "Uji", roleId: "admin" }) }));
vi.mock("@/server/modules/aleta-ecourt/penanda-jawaban", () => ({ picuPindaiJawaban: () => undefined }));
vi.mock("@/server/modules/aleta-ecourt/rekam-antrian", () => ({ bacaRekamAntrian: async () => [], rekamAntrian: async () => ({ ditulis: 0, gagal: "" }) }));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  getGatewayJadwalSidang: async () => ({ ok: true, data: { dari: "2026-10-16", sampai: "2026-10-16", diperiksaPada: "x", sidang } }),
  getGatewayArsipRincian: async () => ({ ok: false }),
  getGatewayKalenderSidang: async () => ({ ok: false }),
  getGatewayKesiapanBanyak: async () => ({ ok: false }),
  getGatewayKesiapanSatu: async () => ({ ok: false }),
  getGatewayRincianSidang: async () => ({ ok: false }),
  getGatewaySippKonteks: async () => ({ ok: false }),
}));

async function panggil(kueri: string) {
  const { GET } = await import("@/app/api/aleta-ecourt/sidang/route");
  const url = new URL(`http://uji.local/api/aleta-ecourt/sidang${kueri}`);
  const jawaban = await GET({ nextUrl: url, headers: new Headers(), url: url.href } as unknown as Parameters<typeof GET>[0]);
  return (await jawaban.json()) as { data: { sidang: Array<Record<string, any>> } };
}

describe("rute jadwal sidang: keadaanPutusan dan rekomendasiBlangko", () => {
  it("tiap baris membawa keadaanPutusan; rekomendasi TIDAK ikut tanpa ?rekomendasi=1", async () => {
    const { data } = await panggil("?dari=2026-10-16&sampai=2026-10-16");
    expect(data.sidang).toHaveLength(3);
    // T hadir mediasi (hasil T) lalu tidak hadir saat putusan -> t-tidak-hadir-setelah-mediasi
    expect(data.sidang[0].keadaanPutusan).toEqual(["t-tidak-hadir-setelah-mediasi", "sesudah-mediasi"]);
    // sidang ke-7: mediasi sebagian, T hadir
    expect(data.sidang[1].keadaanPutusan).toEqual(["mediasi-sebagian", "kontradiktoir", "sesudah-mediasi"]);
    // sidang 1 verstek: tanpa mediasi, T tidak pernah hadir, bendera verstek belum ada -> dianggap verstek
    expect(data.sidang[2].keadaanPutusan).toEqual(["verstek-tanpa-bendera"]);
    expect(data.sidang[0].rekomendasiBlangko).toBeUndefined();
    // ruas asli baris tidak hilang
    expect(data.sidang[0].nomorPerkara).toBe("11/Pdt.G/2026/PA.Dgl");
  });

  it("?rekomendasi=1: BAS, putusan, dan relaas per baris (alasan tunda 'Duplik Tergugat' menentukan langkah)", async () => {
    const { data } = await panggil("?dari=2026-10-16&sampai=2026-10-16&rekomendasi=1");
    const a = data.sidang[0].rekomendasiBlangko;
    expect(a.putusan[0].berkas).toBe("[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi.rtf");
    // putus tanpa hadirnya T (bukan verstek) pada perkara e-Court: pemberitahuan biasa [JS] 2 untuk T + amplopnya
    expect(a.relaas.map((x: { berkas: string }) => x.berkas)).toEqual(["[JS] 2. Relaas Pemberitahuan Putusan T.rtf", "[JS] 8.2.2. Amplop Relaas Pemberitahuan Putusan T.rtf"]);
    const b = data.sidang[1].rekomendasiBlangko;
    expect(b.sumberTeks).toBe("alasan-tunda");
    expect(b.bas[0].label.startsWith("[5]")).toBe(true);
    expect(b.relaas).toEqual([]); // semua pihak hadir: tidak ada yang dipanggil
    const c = data.sidang[2].rekomendasiBlangko;
    expect(c.sumberTeks).toBe("agenda"); // alasan tunda "0" bukan isi
    expect(c.relaas.map((x: { berkas: string }) => x.berkas)).toEqual(["[JS] 5.2. Relaas Panggilan Sidang T (e-Court).rtf", "[JS] --AMPLOP PANGGILAN SURAT TERCATAT--.rtf"]);
  });
});
