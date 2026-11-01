import { getGatewayAbtPdf, postGatewayKonversiNaskah } from "@/server/modules/aleta-bot/whatsapp-gateway-client";

import type { Mesin } from "./mesin";

/**
 * Mesin Z cross di SERVER: soffice milik container bot lewat gerbang (container portal tidak memuat soffice). RTF -> PDF lewat jalur PDF
 * yang sama dengan cetak PDF (/abt/pdf, termasuk normalisasi bahasa RTF); selebihnya lewat /naskah/konversi.
 */
export function mesinBot(): Mesin {
  return {
    nama: "bot",
    async ubah(bita, dari, ke) {
      const b64 = Buffer.from(bita).toString("base64");
      if (dari === "rtf" && ke === "pdf") {
        const j = await getGatewayAbtPdf(b64, { salinan: false });
        if (!j.ok) throw new Error(`Konversi di server gagal: ${j.error || "pengubah PDF belum dapat dihubungi"}`);
        return new Uint8Array(Buffer.from(String(j.data?.pdfBase64 || ""), "base64"));
      }
      const j = await postGatewayKonversiNaskah({ berkasBase64: b64, ke });
      if (!j.ok) throw new Error(`Konversi di server gagal: ${j.error}`);
      return new Uint8Array(Buffer.from(String(j.data?.berkasBase64 || ""), "base64"));
    },
  };
}
