import { bacaPdfDariBita } from "@/server/modules/aleta-ecourt/baca-pdf";
import { bacaIsiGugatan, type HasilIsiGugatan } from "@/server/modules/aleta-ecourt/isi-gugatan";
import { bacaKuasaGugatan, type BarisKuasaSipp, type DokumenArsip, type HasilKuasaGugatan } from "@/server/modules/aleta-ecourt/kuasa-gugatan";
import { bacaTeksJawaban } from "@/server/modules/aleta-ecourt/penanda-jawaban";
import { ambilBerkasGateway, getGatewayAbtUsulan, getGatewayArsipRincian, postGatewayIsiGugatan } from "@/server/modules/aleta-bot/whatsapp-gateway-client";

/**
 * ============================================================================
 * PEMBACA e-COURT UNTUK ISIAN - SATU PEMBACA UNTUK RUTE DAN AGEN (19 Okt 2026)
 * ============================================================================
 *
 * Rute isi-gugatan dan kuasa-gugatan (dipanggil mesin bersama Isi dari SIPP di
 * ekstensi) dan agen draf putusan (sisi server) membaca surat gugatan dan
 * kuasa lewat pembaca yang SAMA di sini, sehingga usulan isiannya sama persis.
 * Hanya membaca; tidak ada yang ditulis.
 */

const tanpaOcr = { ocrAda: async () => false, ocrGambar: async () => "", halamanPdf: async () => [] as Buffer[] };

export function bacaGugatanEcourt(
  nomor: string,
  sebutan: { lawan: string; pelaku: string },
  majelis?: string,
  opsi: { denganBukti?: boolean } = {}
): Promise<HasilIsiGugatan> {
  return bacaIsiGugatan(
    nomor,
    sebutan,
    {
      rincian: async (n) => {
        const r = await getGatewayArsipRincian(n);
        return { ok: r.ok, dokumen: r.ok ? ((r.data.dokumen || []) as DokumenArsip[]) : [] };
      },
      ambilBerkas: async (key, format) => {
        const r = await ambilBerkasGateway(key, format);
        return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
      },
      halamanPdf: async (data) => {
        const isi = await bacaPdfDariBita(new Uint8Array(data), "berkas.pdf", 80);
        return isi.ada ? isi.halaman.map((h) => h.teks) : [];
      },
      bacaTeks: (data, bolehOcr) => (bolehOcr ? bacaTeksJawaban(data) : bacaTeksJawaban(data, tanpaOcr)),
      kirimBot: async (muatan) => {
        const r = await postGatewayIsiGugatan(muatan);
        return r.ok ? r.data : null;
      },
    },
    majelis,
    opsi
  );
}

export function bacaKuasaEcourt(nomor: string): Promise<HasilKuasaGugatan> {
  return bacaKuasaGugatan(nomor, {
    rincian: async (n) => {
      const r = await getGatewayArsipRincian(n);
      return { ok: r.ok, dokumen: r.ok ? ((r.data.dokumen || []) as DokumenArsip[]) : [] };
    },
    ambilBerkas: async (key, format) => {
      const r = await ambilBerkasGateway(key, format);
      return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
    },
    bacaTeks: (data, bolehOcr) => (bolehOcr ? bacaTeksJawaban(data) : bacaTeksJawaban(data, tanpaOcr)),
    sipp: async (n) => {
      const r = await getGatewayAbtUsulan({ nomorPerkara: n, sumber: "sipp" });
      const s = (r.ok ? r.data.sipp : null) as { ok?: boolean; kuasaSipp?: BarisKuasaSipp[]; tanggalDaftar?: string } | null;
      if (!s || s.ok === false) return null;
      return { kuasaSipp: Array.isArray(s.kuasaSipp) ? s.kuasaSipp : [], tanggalDaftar: String(s.tanggalDaftar || "") };
    },
  });
}
