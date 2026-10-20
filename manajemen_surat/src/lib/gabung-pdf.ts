import { PDFDocument } from "pdf-lib";

/**
 * Menggabung beberapa PDF (urutan sama dengan masukan) menjadi satu - bahan "PDF gabungan" Cetak massal Blangko Derry
 * (20 Okt 2026). Murni: tidak menyimpan apa pun, tidak mengubah isi halaman. Satu berkas rusak tidak menggagalkan yang lain:
 * namanya dicatat di `gagal` (indeks masukan) dan halamannya dilewati.
 */
export async function gabungkanPdf(daftar: Uint8Array[]): Promise<{ pdf: Uint8Array; halaman: number; gagal: number[] }> {
  const hasil = await PDFDocument.create();
  const gagal: number[] = [];
  let halaman = 0;
  for (let i = 0; i < daftar.length; i += 1) {
    try {
      const sumber = await PDFDocument.load(daftar[i], { ignoreEncryption: true });
      const salinan = await hasil.copyPages(sumber, sumber.getPageIndices());
      for (const h of salinan) hasil.addPage(h);
      halaman += salinan.length;
    } catch {
      gagal.push(i);
    }
  }
  if (halaman === 0) throw new Error("Tidak ada PDF yang dapat digabung.");
  return { pdf: await hasil.save(), halaman, gagal };
}
