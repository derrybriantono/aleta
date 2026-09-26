// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tiruanReplaceKetSaksi } from "@/lib/tipe-keluaran/ragam-jawaban";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";

/**
 * ============================================================================
 * PRATINJAU DAFTAR BAS - PENYUSUN BOT SUNGGUHAN, BUKAN SALINAN
 * ============================================================================
 *
 * Pratinjau menunjukkan keterangan saksi SEANDAINYA usulan disahkan. Yang
 * dijaga:
 *   1. muatan ke gerbang membawa tipeKeluaran CALON (usulan ditumpuk di atas
 *      daftar efektif), dan pembandingnya tanpa calon;
 *   2. jawaban yang tampil = keluaran susunKeteranganSaksiSdg bot sungguhan
 *      atas muatan itu - dibandingkan kata demi kata - dan calonnya sungguh
 *      terpakai (ada jawaban yang berubah);
 *   3. bunyi di putusan = tiruan replace_ket_saksi (bot dan portal sama);
 *   4. 2-4 saksi berdampingan; di luar itu 400; daftar bukan BAS 400;
 *   5. pratinjau tidak menulis riwayat maupun audit.
 */

const require_ = createRequire(import.meta.url);
type SaksiBot = { ke: number; jawaban: Array<{ no: string; tanya: string; jawab: string }> };
const bot = require_(path.resolve(process.cwd(), "../aleta_bot/services/abtUsulanService.js")) as {
  susunKeteranganSaksiSdg: (o: Record<string, unknown>) => { saksi: SaksiBot[]; tipeKeluaranDitolak?: unknown[] };
  tiruanReplaceKetSaksi: (j: string) => string;
};

/** Meniru rute /abt/usulan sumber 'saksi-sdg': modus kosong disaring, sisanya diteruskan ke penyusun bot. */
function susunLewatBot(m: Record<string, unknown>) {
  const modusKosong = { modus: "", sumber: "", sumberNama: "", alasan: [] };
  return bot.susunKeteranganSaksiSdg({
    templat: m.templat,
    alasan: m.alasan,
    posita: m.posita,
    pelaku: m.pelaku,
    lawan: m.lawan,
    nomorPerkara: m.nomorPerkara,
    kodeKumpulan: m.kodeKumpulan,
    // Rute /abt/usulan meneruskan keduanya apa adanya (String(body.x || "")).
    jenisPerkara: String(m.jenisPerkara || ""),
    alur: String(m.alur || ""),
    modus: { saksi1: modusKosong, saksi2: modusKosong },
    saksi: m.saksi,
    tipeKeluaran: m.tipeKeluaran,
  });
}

const tiruan = vi.hoisted(() => ({ muatan: [] as Array<Record<string, unknown>> }));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  gatewayUkurTipe: async () => ({ ok: false, error: "tidak dipakai di berkas ini" }),
  getGatewayAbtUsulan: async (m: Record<string, unknown>) => {
    tiruan.muatan.push(m);
    const saksiSdg = susunLewatBot(m);
    return { ok: true, data: { saksiSdg, tipeKeluaranDiterima: true, tipeKeluaranDitolak: saksiSdg.tipeKeluaranDitolak ?? [] } };
  },
}));

const modul = await import("@/server/modules/aleta-ecourt/tipe-keluaran");
const pratinjau = await import("@/server/modules/aleta-ecourt/tipe-keluaran-ukur");

let db: AletaDatabase | null = null;
const d = () => db as AletaDatabase;

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
  await modul.pastikanBenih(d());
  tiruan.muatan = [];
});

afterEach(async () => {
  await db?.close();
  db = null;
});

async function hitung(sql: string) {
  const b = await d().queryOne<{ n: string | number }>(sql);
  return Number(b?.n ?? 0);
}

async function usulPembuka() {
  const u = await modul.usul(d(), "usr-admin", { daftar: "bas.saksi.pembuka", nilai: "Benar, ", data: { bobot: 80 } });
  if (!u.ok) throw new Error(u.alasan.join("; "));
  return u.butir.id;
}

type Hasil = Awaited<ReturnType<typeof pratinjau.jalankanPratinjau>>;

describe("pratinjau pembuka BAS", () => {
  it("muatan ke gerbang membawa tipeKeluaran calon; pembandingnya tidak", async () => {
    const id = await usulPembuka();
    await pratinjau.jalankanPratinjau(d(), "usr-admin", { id });
    // Dua posita contoh x (dengan, tanpa).
    expect(tiruan.muatan).toHaveLength(4);
    const pembuka = (m: Record<string, unknown>) =>
      ((m.tipeKeluaran as { daftar: Record<string, Array<{ nilai: string }>> }).daftar["bas.saksi.pembuka"] ?? []).map((e) => e.nilai);
    expect(pembuka(tiruan.muatan[0])).toContain("Benar, ");
    expect(pembuka(tiruan.muatan[1])).not.toContain("Benar, ");
    expect(pembuka(tiruan.muatan[2])).toContain("Benar, ");
    for (const m of tiruan.muatan) {
      expect(m).toMatchObject({ sumber: "saksi-sdg", kodeKumpulan: "A1a", pelaku: "Tergugat", lawan: "Penggugat" });
      // Bentuk yang dikirim ekstensi: id jenis perkara SIPP + alur_perkara_id.
      expect(m).toMatchObject({ jenisPerkara: "347", alur: "15" });
      expect((m.templat as unknown[]).length).toBe(14);
      expect((m.saksi as unknown[]).length).toBe(2);
    }
    // Usulan yang belum disahkan TIDAK ikut ke muatan /abt/usulan biasa.
    const bot = await modul.untukBot(d());
    expect((bot.daftar["bas.saksi.pembuka"] ?? []).map((e) => e.nilai)).not.toContain("Benar, ");
  });

  it("jawaban yang tampil = keluaran penyusun bot sungguhan, kata demi kata; calon sungguh terpakai", async () => {
    const id = await usulPembuka();
    const h = (await pratinjau.jalankanPratinjau(d(), "usr-admin", { id })) as Hasil;
    const langsung = susunLewatBot(tiruan.muatan[0]).saksi;
    const tanpa = susunLewatBot(tiruan.muatan[1]).saksi;
    const p = h.perkara[0];
    expect(p.baris).toHaveLength(14);
    p.baris.forEach((b, k) => {
      b.saksi.forEach((s, i) => {
        expect(s.jawab, `${b.no} saksi ${s.ke}`).toBe(langsung[i].jawaban[k].jawab);
        expect(s.jawabTanpa).toBe(tanpa[i].jawaban[k].jawab);
        expect(s.putusan).toBe(bot.tiruanReplaceKetSaksi(s.jawab));
        expect(s.putusan).toBe(tiruanReplaceKetSaksi(s.jawab));
      });
    });
    // Pembuka calon sungguh muncul, dan hitungan 'berubah' sesuai sel yang beda.
    const semua = h.perkara.flatMap((x) => x.baris.flatMap((b) => b.saksi));
    expect(semua.some((s) => s.jawab.startsWith("Benar, "))).toBe(true);
    expect(h.berubah).toBe(semua.filter((s) => s.jawab !== s.jawabTanpa).length);
    expect(h.berubah).toBeGreaterThan(0);
    expect(h.diterimaBot).toBe(true);
    expect(h.calonDitolak).toEqual([]);
  });

  it("identik dalam BAS dan antar perkara dihitung dari jawaban yang tampil", async () => {
    const id = await usulPembuka();
    const h = (await pratinjau.jalankanPratinjau(d(), "usr-admin", { id, jumlahSaksi: 3 })) as Hasil;
    for (const p of h.perkara) {
      let kembarTanya = 0;
      let pasangan = 0;
      for (const b of p.baris) {
        let ada = false;
        for (let i = 0; i < b.saksi.length; i += 1)
          for (let j = i + 1; j < b.saksi.length; j += 1)
            if (b.saksi[i].jawab === b.saksi[j].jawab) {
              pasangan += 1;
              ada = true;
            }
        if (ada) kembarTanya += 1;
      }
      expect([p.identikDalamBas, p.pasanganIdentik, p.pasanganTotal]).toEqual([kembarTanya, pasangan, 14 * 3]);
    }
    let antar = 0;
    h.perkara[0].baris.forEach((b, k) => b.saksi.forEach((s, i) => (antar += s.jawab === h.perkara[1].baris[k].saksi[i].jawab ? 1 : 0)));
    expect([h.identikAntarPerkara, h.pembandingAntarPerkara]).toEqual([antar, 14 * 3]);
  });

  it("4 saksi berdampingan; 1 atau 5 saksi 400", async () => {
    const id = await usulPembuka();
    const h = (await pratinjau.jalankanPratinjau(d(), "usr-admin", { id, jumlahSaksi: 4 })) as Hasil;
    expect(h.perkara[0].baris[0].saksi.map((s) => s.ke)).toEqual([1, 2, 3, 4]);
    await expect(pratinjau.jalankanPratinjau(d(), "usr-admin", { id, jumlahSaksi: 5 })).rejects.toMatchObject({ status: 400 });
    await expect(pratinjau.jalankanPratinjau(d(), "usr-admin", { id, jumlahSaksi: 1 })).rejects.toMatchObject({ status: 400 });
  });

  it("tidak menulis riwayat maupun audit; panitera 403; daftar bukan BAS 400", async () => {
    const id = await usulPembuka();
    const r0 = await hitung("SELECT COUNT(*) AS n FROM aleta_tipe_keluaran_riwayat");
    const a0 = await hitung("SELECT COUNT(*) AS n FROM audit_logs");
    await pratinjau.jalankanPratinjau(d(), "usr-admin", { id });
    expect(await hitung("SELECT COUNT(*) AS n FROM aleta_tipe_keluaran_riwayat")).toBe(r0);
    expect(await hitung("SELECT COUNT(*) AS n FROM audit_logs")).toBe(a0);
    await expect(pratinjau.jalankanPratinjau(d(), "usr-panitera", { id })).rejects.toMatchObject({ status: 403 });
    const u = await modul.usul(d(), "usr-admin", { daftar: "bas.kehadiran.bunyi", nilai: "hadir melalui telekonferensi" });
    if (!u.ok) throw new Error(u.alasan.join("; "));
    await expect(pratinjau.jalankanPratinjau(d(), "usr-admin", { id: u.butir.id })).rejects.toMatchObject({ status: 400 });
  });
});

// ============================================================================
// BENTUK BERSYARAT - PRATINJAU MENGIRIM JENIS PERKARA DAN ALUR SEPERTI EKSTENSI
// ============================================================================
//
// Bot menyaring bentuk ber-data.syarat dengan membandingkan syarat apa adanya
// terhadap jenisPerkara/alur muatan. Ekstensi mengirim id SIPP ("347") dan
// alur_perkara_id ("15"); pratinjau yang mengirim nama ("Cerai Gugat") tanpa
// alur menyembunyikan bentuk yang berlaku di ABT, dan menampakkan bentuk
// bersyarat nama yang tidak pernah berlaku di ABT.

describe("pratinjau bentuk bersyarat = yang berlaku di ABT", () => {
  const PENANDA = "selaku";
  async function pratinjauBentuk(syarat: Record<string, unknown>) {
    const u = await modul.usul(d(), "usr-admin", {
      daftar: "bas.saksi.bentuk",
      kunci: "kenal sebagai",
      nilai: `saya kenal dengan #0047# ${PENANDA} {slot}`,
      data: { syarat },
    });
    if (!u.ok) throw new Error(u.alasan.join("; "));
    const h = (await pratinjau.jalankanPratinjau(d(), "usr-admin", { id: u.butir.id, jumlahSaksi: 4 })) as Hasil;
    const semua = h.perkara.flatMap((x) => x.baris.flatMap((b) => b.saksi));
    return { tampak: semua.filter((s) => s.jawab.includes(PENANDA)).length, tanpa: semua.filter((s) => s.jawabTanpa.includes(PENANDA)).length };
  }

  it("syarat cerai gugat + gugatan (id dan alur SIPP) tampak di pratinjau", async () => {
    const r = await pratinjauBentuk({ jenisPerkaraId: "347", alur: "15" });
    expect(r.tanpa).toBe(0);
    expect(r.tampak).toBeGreaterThan(0);
  });

  it("syarat yang tidak berlaku di ABT tidak tampak: nama jenis perkara, cerai talak, permohonan", async () => {
    for (const syarat of [{ jenisPerkaraId: "Cerai Gugat" }, { jenisPerkaraId: "346" }, { alur: "16" }]) {
      const r = await pratinjauBentuk(syarat);
      expect(r.tampak, JSON.stringify(syarat)).toBe(0);
    }
  });

  it("jenis perkara dan alur pratinjau = pemetaan ekstensi (abt.js) untuk nomor contohnya", () => {
    const abt = readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/abt.js"), "utf8");
    expect(abt.match(/"cerai gugat":\s*"(\d+)"/)?.[1]).toBe(pratinjau.JENIS_PERKARA_PRATINJAU);
    const sumber = abt.match(/function idAlurPerkaraSipp\(nomor\) \{[\s\S]*?\n\}/)?.[0];
    expect(sumber, "idAlurPerkaraSipp di abt.js").toBeTruthy();
    const idAlur = new Function(`${sumber}; return idAlurPerkaraSipp;`)() as (n: string) => string;
    for (const n of [...pratinjau.POSITA_CONTOH.map((c) => c.nomorPerkara), "1/Pdt.P/2026/PA.X", "2/Pdt.G.S/2026/PA.X", "3/Pid/2026"]) {
      expect(pratinjau.alurPratinjau(n), n).toBe(idAlur(n));
    }
  });
});

describe("penghitung identik atas fixture kecil", () => {
  it("hitungIdentikBas dan hitungIdentikAntarPerkara", () => {
    const s = (ke: number, ...j: string[]) => ({ ke, jawaban: j.map((jawab, i) => ({ no: String(i + 1), tanya: "", jawab })) });
    const bas = [s(1, "a", "b", "c"), s(2, "a", "x", "c"), s(3, "a", "y", "z")];
    expect(pratinjau.hitungIdentikBas(bas)).toEqual({ identikDalamBas: 2, pasanganIdentik: 4, pasanganTotal: 9 });
    expect(pratinjau.hitungIdentikAntarPerkara(bas, [s(1, "a", "q", "c"), s(2, "a", "x", "r")])).toEqual({ identik: 4, total: 6 });
  });

  it("daftar yang dapat dipratinjau di layar = di peladen", async () => {
    const layar = await import("@/components/portal/aleta-ecourt-tipe-keluaran");
    expect([...layar.DAFTAR_DAPAT_PRATINJAU]).toEqual([...pratinjau.DAFTAR_PRATINJAU]);
  });
});
