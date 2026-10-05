/**
 * Butir 30 (5 Okt 2026): penanda verifikasi majelis untuk perkara e-Litigasi
 * yang bersidang hari ini - satu lencana tiga keadaan di samping nomor
 * perkara, dari simpanan bot; penarik latar bot satu perkara per putaran,
 * BERHENTI bila semua sudah diverifikasi, mulai lagi bila ada perkara baru.
 *
 * Perilaku: layanan bot dijalankan dengan basis data + penarik tiruan, fungsi
 * penanda portal, dan lencananya dirender.
 */
import path from "node:path";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { penandaVerifikasi, type DataVerifikasi } from "@/lib/penanda-verifikasi-ecourt";
import { LencanaVerifikasiMajelis } from "@/components/portal/aleta-ecourt-sidang";

const AKAR = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));

type Layanan = {
  keadaanHari: (t?: string) => Promise<{ ok: boolean; perkara: Record<string, { keadaan: string; menunggu: number; diverifikasiOleh: string[] }> }>;
  putaran: () => Promise<{ jalan: boolean; alasan?: string; nomorPerkara?: string }>;
};
const harianMod = require_(path.join(AKAR, "aleta_bot/services/ecourtVerifikasiHarianService.js")) as {
  buatLayanan: (deps: Record<string, unknown>) => Layanan;
};
const storeMod = require_(path.join(AKAR, "aleta_bot/services/ecourtStoreService.js")) as {
  dokumenMenungguMajelis: (d: Record<string, unknown>) => boolean;
};

const HARI = "2026-10-05";
const KINI = new Date(2026, 9, 5, 10, 0, 0);

function dunia() {
  const perkara = [
    { perkaraId: 1, nomorPerkara: "609/Pdt.G/2026/PA.Dgl" },
    // Permohonan: tidak diberi penanda verifikasi.
    { perkaraId: 2, nomorPerkara: "70/Pdt.P/2026/PA.Dgl" },
  ];
  const dokumen: Array<Record<string, unknown>> = [
    // Berkas pendaftaran lama - BUKAN yang menunggu majelis.
    { nomorPerkara: "609/Pdt.G/2026/PA.Dgl", judulDokumen: "Surat Gugatan", diunggahPada: null, statusVerifikasi: "belum", terakhirTerlihat: "2026-10-01 09:00:00" },
    { nomorPerkara: "609/Pdt.G/2026/PA.Dgl", judulDokumen: "Jawaban Tergugat", diunggahPada: "2026-10-03 08:00:00", statusVerifikasi: "belum", terakhirTerlihat: "2026-10-04 09:00:00" },
  ];
  const tarikan: string[] = [];
  const kueriSipp = async (sql: string) => (/perkara_efiling_id/.test(sql) ? perkara : []);
  const kueriBot = async (sql: string, nilai: unknown[] = []) => {
    if (/FROM aleta_bot_ecourt_documents/.test(sql)) return dokumen.filter((d) => (nilai as string[]).includes(String(d.nomorPerkara)));
    if (/FROM aleta_bot_ecourt_verifications/.test(sql)) return [{ nomorPerkara: "609/Pdt.G/2026/PA.Dgl", namaHakim: "Himawan", keputusan: "valid" }];
    return [];
  };
  let akun = true;
  const L = harianMod.buatLayanan({
    kueriSipp,
    kueriBot,
    menunggu: storeMod.dokumenMenungguMajelis,
    tarik: async (nomor: string) => {
      tarikan.push(nomor);
      return { kode: 0 };
    },
    akunSiap: () => akun,
    bolehJalan: () => true,
    sekarang: () => KINI,
  });
  return { L, perkara, dokumen, tarikan, setAkun: (x: boolean) => (akun = x) };
}

describe("definisi menunggu majelis", () => {
  it("berkas pendaftaran lama dan perkara permohonan tidak dihitung", () => {
    const m = storeMod.dokumenMenungguMajelis;
    expect(m({ nomorPerkara: "609/Pdt.G/2026/PA.Dgl", judulDokumen: "Jawaban", diunggahPada: "2026-10-03", statusVerifikasi: "belum" })).toBe(true);
    expect(m({ nomorPerkara: "609/Pdt.G/2026/PA.Dgl", judulDokumen: "Surat Gugatan", diunggahPada: null, statusVerifikasi: "belum" })).toBe(false);
    expect(m({ nomorPerkara: "70/Pdt.P/2026/PA.Dgl", judulDokumen: "Bukti", diunggahPada: "2026-10-03", statusVerifikasi: "belum" })).toBe(false);
    expect(m({ nomorPerkara: "609/Pdt.G/2026/PA.Dgl", judulDokumen: "Replik", diunggahPada: "2026-10-03", statusVerifikasi: "valid" })).toBe(false);
  });
});

describe("bot: keadaan dan penarik verifikasi harian", () => {
  it("keadaan: gugatan e-Litigasi saja; dokumen persidangan 'belum' = belum; nama yang memverifikasi ikut", async () => {
    const { L } = dunia();
    const k = await L.keadaanHari(HARI);
    expect(Object.keys(k.perkara)).toEqual(["609/Pdt.G/2026/PA.Dgl"]);
    expect(k.perkara["609/Pdt.G/2026/PA.Dgl"]).toMatchObject({ keadaan: "belum", menunggu: 1, diverifikasiOleh: ["Himawan"] });
  });

  it("satu tarikan per putaran; BERHENTI bila semua sudah diverifikasi; mulai lagi bila ada perkara e-Litigasi baru", async () => {
    const w = dunia();
    expect(await w.L.putaran()).toMatchObject({ jalan: true, nomorPerkara: "609/Pdt.G/2026/PA.Dgl" });
    expect(w.tarikan).toEqual(["609/Pdt.G/2026/PA.Dgl"]);
    // Masih menunggu majelis: ditarik lagi pada putaran berikutnya.
    await w.L.putaran();
    expect(w.tarikan).toHaveLength(2);

    // Hakim memverifikasi di e-Court; tarikan berikutnya membawanya.
    w.dokumen[1].statusVerifikasi = "valid";
    expect(await w.L.putaran()).toMatchObject({ jalan: false, alasan: "semua_sudah_diverifikasi" });
    expect(await w.L.putaran()).toMatchObject({ jalan: false, alasan: "semua_sudah_diverifikasi" });
    expect(w.tarikan).toHaveLength(2);
    expect((await w.L.keadaanHari(HARI)).perkara["609/Pdt.G/2026/PA.Dgl"].keadaan).toBe("sudah");

    // Perkara e-Litigasi baru hari itu: penarik bangun lagi untuknya.
    w.perkara.push({ perkaraId: 3, nomorPerkara: "615/Pdt.G/2026/PA.Dgl" });
    expect(await w.L.putaran()).toMatchObject({ jalan: true, nomorPerkara: "615/Pdt.G/2026/PA.Dgl" });
    expect(w.tarikan).toHaveLength(3);
  });

  it("tanpa akun penarik yang siap dan tanpa data: tidak konek, dan tidak menarik", async () => {
    const w = dunia();
    w.dokumen.length = 0;
    w.setAkun(false);
    expect(await w.L.putaran()).toMatchObject({ jalan: false, alasan: "akun_tidak_siap" });
    expect(w.tarikan).toHaveLength(0);
    expect((await w.L.keadaanHari(HARI)).perkara["609/Pdt.G/2026/PA.Dgl"].keadaan).toBe("tidak-konek");
  });
});

describe("portal: penanda satu lencana tiga keadaan", () => {
  const baris = { nomorPerkara: "609/Pdt.G/2026/PA.Dgl", tanggalSidang: HARI, lewatEcourt: true };
  const data = (keadaan: "sudah" | "belum" | "tidak-konek"): DataVerifikasi => ({
    terbaca: true,
    tanggal: HARI,
    perkara: {
      "609/Pdt.G/2026/PA.Dgl": {
        nomorPerkara: "609/Pdt.G/2026/PA.Dgl",
        keadaan,
        menunggu: keadaan === "belum" ? 2 : 0,
        dokumen: 3,
        terakhirDiperiksa: `${HARI} 09:45:00`,
        diverifikasiOleh: ["Himawan"],
      },
    },
  });

  it("hijau / kuning / abu, tooltip menyebut jam periksa dan yang memverifikasi", () => {
    const sudah = penandaVerifikasi(baris, data("sudah"), HARI)!;
    expect(sudah).toMatchObject({ keadaan: "sudah", label: "sudah diverifikasi" });
    expect(sudah.kelas).toContain("emerald");
    expect(sudah.keterangan).toContain("09:45");
    expect(sudah.keterangan).toContain("Himawan");
    expect(penandaVerifikasi(baris, data("belum"), HARI)).toMatchObject({ keadaan: "belum", label: "belum diverifikasi" });
    // Bot tidak tersambung: abu.
    expect(penandaVerifikasi(baris, { terbaca: false, tanggal: "", perkara: {} }, HARI)).toMatchObject({ keadaan: "tidak-konek", label: "tidak konek" });
  });

  it("tidak diberi penanda: bukan e-Litigasi, permohonan, atau bukan hari ini", () => {
    expect(penandaVerifikasi({ ...baris, lewatEcourt: false }, data("sudah"), HARI)).toBeNull();
    expect(penandaVerifikasi({ ...baris, nomorPerkara: "70/Pdt.P/2026/PA.Dgl" }, data("sudah"), HARI)).toBeNull();
    expect(penandaVerifikasi({ ...baris, tanggalSidang: "2026-10-06" }, data("sudah"), HARI)).toBeNull();
  });

  it("lencananya dirender di Jadwal Sidang", () => {
    const html = renderToStaticMarkup(createElement(LencanaVerifikasiMajelis, { penanda: penandaVerifikasi(baris, data("belum"), HARI) }));
    expect(html).toContain('data-verifikasi-majelis="belum"');
    expect(html).toContain("belum diverifikasi");
    expect(html).toContain("2 dokumen persidangan menunggu verifikasi majelis.");
  });
});
