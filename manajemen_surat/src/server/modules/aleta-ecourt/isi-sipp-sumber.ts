import { bacaPdfDariBita } from "@/server/modules/aleta-ecourt/baca-pdf";
import { bacaIsiGugatan, type HasilIsiGugatan } from "@/server/modules/aleta-ecourt/isi-gugatan";
import { bacaKuasaGugatan, type BarisKuasaSipp, type DokumenArsip, type HasilKuasaGugatan } from "@/server/modules/aleta-ecourt/kuasa-gugatan";
import { bacaTeksJawaban } from "@/server/modules/aleta-ecourt/penanda-jawaban";
import { ambilBerkasGateway, getGatewayAbtUsulan, getGatewayArsipRincian, postGatewayIsiGugatan, postGatewayMatriksDalil } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { matriksSah } from "@/lib/matriks-dalil";
import { type AletaDatabase } from "@/server/db/client";
import { bacaSetelanBerkas } from "@/server/modules/aleta-ecourt/berkas-otomatis";
import { bacaGugatanSinggah } from "@/server/modules/aleta-ecourt/isi-gugatan-singgah";
import { pastikanMatriksDalil, type DepsMatriksDalil, type HasilMatriksDalil } from "@/server/modules/aleta-ecourt/matriks-dalil";

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
  opsi: { denganBukti?: boolean; otomatis?: { bukti: boolean; kesimpulan: boolean } } = {}
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

/**
 * P2 (1 Nov 2026): sumber matriks dalil = pembaca e-Court yang SAMA dengan rute isi-gugatan (bacaGugatanSinggah + bacaGugatanEcourt,
 * singgahan 30 menit bersama), atau posita/petitum SIPP lewat bot bila perkara tanpa berkas.
 */
export function depsMatriksDalil(db: AletaDatabase): DepsMatriksDalil {
  return {
    rincian: async (n) => {
      const r = await getGatewayArsipRincian(n);
      return { ok: r.ok, dokumen: r.ok ? ((r.data.dokumen || []) as DokumenArsip[]) : [] };
    },
    bacaEcourt: async (nomor, sebutan, ulang) => {
      const setelan = await bacaSetelanBerkas(db);
      const { hasil } = await bacaGugatanSinggah(nomor, sebutan, undefined, { denganBukti: false, otomatis: { bukti: setelan.bukti, kesimpulan: setelan.kesimpulan }, ulang }, bacaGugatanEcourt);
      return hasil;
    },
    bacaSipp: async (nomor, sebutan) => {
      const r = await postGatewayMatriksDalil({ nomorPerkara: nomor, sebutan });
      return r.ok ? { matriks: matriksSah(r.data.matriksDalil), sidik: String(r.data.sidikSipp || "") } : { matriks: null, sidik: "" };
    },
  };
}

/**
 * API agen A1/A2 (sisi server): matriks dalil terbaru satu perkara - dari simpanan bila berkas e-Court tidak berubah, selain itu
 * dihitung ulang dan disimpan (menunggu hasil, tanpa batas waktu). Hanya membaca SIPP/e-Court.
 */
export function matriksDalilPerkara(db: AletaDatabase, nomor: string, sebutan: { lawan: string; pelaku: string }): Promise<HasilMatriksDalil> {
  return pastikanMatriksDalil(db, nomor, sebutan, depsMatriksDalil(db));
}
