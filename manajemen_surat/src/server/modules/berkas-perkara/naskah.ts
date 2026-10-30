import { buangGrupTersembunyiRtf } from "@/lib/buang-grup-tersembunyi-rtf";
import { BARIS_CEKLIST, BARIS_DAFTAR_ISI, LEBAR_ISI, PENANDA_LAMPIRAN_ABT, VAR_CIRI_GANDA, VAR_LAMPIRAN_ABT, VAR_TABEL_CEKLIST, VAR_TABEL_DAFTAR_ISI } from "@/lib/berkas-cetak";
import { type BarisDasar, type KodeKertas, type SunganBaris, KERTAS, hitungDaftarIsi, rapikanSampulAwal, saringNilaiTimpa, tanggalIndonesia } from "@/lib/berkas-perkara";
import { PENANDA_TABEL_CEKLIST, bersihkanBahanCeklist, kotaDariPengadilan, susunCeklist, tabelCeklistRtf, tempelTabelCeklist, teksRingkasCeklist } from "@/lib/ceklist-berkas";
import { tabelDaftarIsiRtf, ubahKopBundel } from "@/lib/daftar-isi-rtf";
import { bersihkanPihak, gabungLampiran, jumlahDariDaftar, pihakBanyak } from "@/lib/lampiran-pihak";
import { barisTurut, bersihkanAlasan, bersihkanAnak, bersihkanObjek, bersihkanSidang, kolomPihakSampul, susunLampiran, type HasilLampiran } from "@/lib/lampiran-sampul";
import { sisipLogoRtf } from "@/lib/logo-rtf";

/**
 * ============================================================================
 * SUSUNAN NASKAH SAMPUL / DAFTAR ISI / CEKLIST (dipindah dari rute sampul-berkas/naskah, 30 Okt 2026)
 * ============================================================================
 *
 * Murni terhadap dunia luar: pengisian blangko oleh mesin variabel ABT di bot, logo kop, dan identitas satker disuntikkan (`Dep`), sehingga
 * rute portal dan simulasi/uji memakai jalur yang SAMA. Tidak ada yang ditulis ke SIPP/ABT.
 *
 * Blangko paket sampul-rapi-30okt menerbitkan tabel daftar isi (#11300#-#11302#), tabel ceklist (#11303#-#11305#) dan lampiran sampul
 * (#11306#-#11317#) langsung dari ABT; di sini ketiganya ditimpa penanda lalu diganti susunan portal (halaman otomatis, OTO e-Court, alasan
 * terdeteksi). Blangko lama (#5850#) tetap dilayani.
 */

export type HasilIsiBlangko = { ok?: boolean; sebab?: string; berkas?: string; jumlahTerisi?: number; kosong?: Array<{ noVar: string }>; mesinGalat?: string; rtfBase64?: string };

export type DepNaskah = {
  /** isi blangko (folder/berkas sudah dipilih rute) dengan nilai timpa portal */
  isi: (nilai: Record<string, string>) => Promise<{ ok: boolean; data?: HasilIsiBlangko; error?: string }>;
  /** grup gambar RTF logo kop satker ("" = pakai logo tertanam di blangko) */
  logoKop: () => Promise<string>;
  namaPengadilan: () => Promise<string>;
  /** nama akun pencetak (petugas Meja I) */
  petugas: string;
  /** tanggal hari ini YYYY-MM-DD */
  hariIni: () => string;
};

export type JenisNaskah = "sampul" | "daftar-isi" | "ceklist";

const BATAS_BARIS = 400;
const teks = (x: unknown, maks = 200) => String(x ?? "").slice(0, maks);

/** Saring baris kiriman klien menjadi BarisDasar yang aman. */
export function bersihkanBaris(mentah: unknown): BarisDasar[] {
  if (!Array.isArray(mentah)) return [];
  const hasil: BarisDasar[] = [];
  for (const m of mentah.slice(0, BATAS_BARIS)) {
    if (!m || typeof m !== "object") continue;
    const r = m as Record<string, unknown>;
    const bundel = r.bundel === "B" ? "B" : r.bundel === "A" ? "A" : null;
    const kunci = teks(r.kunci, 60);
    if (!bundel || !/^[a-z0-9_:.\-]{1,60}$/i.test(kunci)) continue;
    const halaman = Math.max(1, Math.min(999, Math.round(Number(r.halaman) || 1)));
    hasil.push({
      bundel,
      grup: teks(r.grup, 80),
      kunci,
      nama: teks(r.nama, 200),
      ket: teks(r.ket, 100),
      tanggal: teks(r.tanggal, 40),
      halaman,
      sumber: r.sumber === "perkiraan" ? "perkiraan" : "pasti",
      dasar: teks(r.dasar, 120),
    });
  }
  return hasil;
}

export function bersihkanSunting(mentah: unknown): Record<string, Partial<SunganBaris>> {
  const hasil: Record<string, Partial<SunganBaris>> = {};
  if (!mentah || typeof mentah !== "object" || Array.isArray(mentah)) return hasil;
  for (const [kunci, v] of Object.entries(mentah as Record<string, unknown>).slice(0, BATAS_BARIS)) {
    if (!v || typeof v !== "object") continue;
    const r = v as Record<string, unknown>;
    hasil[kunci] = {
      tampil: r.tampil !== false,
      urutan: 0,
      halamanTeks: teks(r.halamanTeks, 12),
      judulManual: teks(r.judulManual, 200),
      tanggalManual: teks(r.tanggalManual, 40),
      tambahan: r.tambahan === true,
    };
  }
  return hasil;
}

export type HasilNaskah = {
  ok: true;
  rtf: Buffer;
  data: HasilIsiBlangko;
  lampiran: HasilLampiran["daftar"];
  muatPihak?: number;
  ceklist?: { baris: ReturnType<typeof susunCeklist>["baris"]; ringkas: ReturnType<typeof susunCeklist>["ringkas"] };
  ringkas: Record<string, unknown>;
  nilaiDikirim: number;
};

/**
 * Menyusun naskah RTF. `badan` = badan permintaan klien (sudah lolos hak akses di rute); jenis/kertas/bentuk/lawan/banyak sudah ditentukan rute.
 * Hasil `{ ok: false, alasan }` bila blangko tidak dapat diisi.
 */
export async function susunNaskahBerkas(
  badan: Record<string, unknown>,
  o: { jenis: JenisNaskah; kertas: KodeKertas; bentuk: "awal" | "lengkap"; lawan: boolean; banyak: boolean },
  dep: DepNaskah
): Promise<HasilNaskah | { ok: false; alasan: string }> {
  const { jenis, kertas, bentuk, lawan, banyak } = o;
  const pihak = bersihkanPihak(badan.pihak);
  const lebar = LEBAR_ISI[kertas];
  let nilai: Record<string, string>;
  let ringkas: Record<string, unknown> = {};
  let lamp: HasilLampiran | null = null;
  let ceklistTabel = "";
  let daftarIsiTabel = "";
  const bundelCetak: "A" | "B" = badan.bundelCetak === "B" ? "B" : "A";
  let ceklistHasil: ReturnType<typeof susunCeklist> | null = null;
  const penandaTabel = (kode: string) => ({ "5850": PENANDA_TABEL_CEKLIST, [kode]: PENANDA_TABEL_CEKLIST });

  if (jenis === "ceklist") {
    // Ceklist berkas Meja I: kerangka lewat ABT, tabel dokumen disusun di sini (jenis dan keadaan perkara) lalu ditempel menggantikan paragraf penanda.
    const bahan = bersihkanBahanCeklist(badan.ceklist);
    if (!bahan) return { ok: false, alasan: "Data ceklist (jenis dan fakta perkara) harus disertakan." };
    const hasilCek = susunCeklist(bahan);
    ceklistHasil = hasilCek;
    ceklistTabel = tabelCeklistRtf(hasilCek.baris, lebar, BARIS_CEKLIST[kertas]);
    const kota = kotaDariPengadilan(await dep.namaPengadilan());
    nilai = { ...penandaTabel(VAR_TABEL_CEKLIST[kertas]), "5848": teksRingkasCeklist(hasilCek.ringkas), "5860": hasilCek.penandaJenis, "5855": `${kota ? `${kota}, ` : ""}${tanggalIndonesia(dep.hariIni())}` };
    if (bahan.fakta.ppNama) nilai["5849"] = bahan.fakta.ppNama;
    const petugas = teks(dep.petugas, 80);
    if (petugas && !/aleta/i.test(petugas)) nilai["5838"] = petugas;
    ringkas = { ceklist: hasilCek.ringkas, jumlahBaris: hasilCek.baris.length };
  } else if (jenis === "sampul") {
    nilai = saringNilaiTimpa(badan.nilai);
    // Blangko paket sampul-rapi-30okt menampilkan ghaib/mafqud lewat 11318/11319 (isian 5807/5808; kosong tanpa titik-titik di ABT)
    if (nilai["5807"]) nilai[VAR_CIRI_GANDA["5807"]] = nilai["5807"];
    if (nilai["5808"]) nilai[VAR_CIRI_GANDA["5808"]] = nilai["5808"];
    if (bentuk === "awal") {
      // Lampiran HANYA bila perlu (pihak melebihi ruang, objek > 2, anak > 3, alasan terdeteksi, riwayat sidang melebihi baris sampul).
      // Lampiran ABT dari blangko (#11306#-#11317#) diganti penanda lalu dibuang: susunan portal yang dipakai (memuat alasan terdeteksi).
      for (const k of VAR_LAMPIRAN_ABT) nilai[k] = PENANDA_LAMPIRAN_ABT;
      lamp = susunLampiran({
        nomor: teks(badan.nomor, 80),
        lebar,
        lawan,
        pihak,
        anak: bersihkanAnak(badan.anak),
        objek: bersihkanObjek(badan.objek),
        riwayat: bersihkanSidang(badan.riwayat),
        alasan: bersihkanAlasan(badan.alasan, teks(badan.jenisPerkara, 10)),
        barisRiwayat: KERTAS[kertas].barisAwal,
        infoKhasBaris: Math.max(0, Math.min(20, Math.trunc(Number(badan.infoKhasBaris)) || 0)),
        sebutan: { 1: teks(badan.sebutanP, 20) || (lawan ? "Penggugat" : "Pemohon"), 2: teks(badan.sebutanT, 20) || (lawan ? "Tergugat" : "Termohon") },
        sebutanPihakI: teks(badan.sebutanP, 20) || (lawan ? "Penggugat" : "Pemohon"),
        sebutanPihakII: teks(badan.sebutanT, 20) || (lawan ? "Tergugat" : "Termohon"),
      });
      if (lamp.barisDepan.length) nilai["5832"] = lamp.barisDepan.join("\n");
      if (lamp.kaki) nilai["5833"] = lamp.kaki;
      // CATATAN: ALASAN hanya bila ada yang terdeteksi/dicentang (baris tidak tampil bila tidak); KETERANGAN otomatis (mis. ghaib) + garis tangan di blangko.
      if (lamp.barisAlasan) nilai["5834"] = lamp.barisAlasan;
      const ket = Array.isArray(badan.keterangan) ? badan.keterangan.map((x) => teks(x, 200)).filter((x) => x && !/aleta/i.test(x)).slice(0, 4) : [];
      if (ket.length) nilai["5835"] = ket.join("\n");
      if (banyak) {
        const nomorPihak = lamp.daftar.find((d) => d.kunci === "pihak")?.nomor ?? 1;
        const s1 = kolomPihakSampul(pihak.filter((x) => x.sisi === 1), lamp.muatPihak, nomorPihak);
        nilai["5890"] = s1.kiri;
        nilai["5891"] = s1.kanan;
        if (lawan) {
          const s2 = kolomPihakSampul(pihak.filter((x) => x.sisi === 2), lamp.muatPihak, nomorPihak);
          nilai["5892"] = s2.kiri;
          nilai["5893"] = s2.kanan;
        }
        const intervensi = pihak.filter((x) => x.sisi === 3);
        if (intervensi.length) nilai["5847"] = barisTurut(intervensi, nomorPihak, "INTERVENSI");
        const turut = barisTurut(pihak.filter((x) => x.sisi === 4), nomorPihak, teks(badan.sebutanT, 20) ? `TURUT ${teks(badan.sebutanT, 20).toUpperCase()}` : "TURUT TERGUGAT");
        if (turut) nilai["5897"] = turut;
      }
    }
  } else {
    const baris = bersihkanBaris(badan.baris);
    const hitung = hitungDaftarIsi(baris, bersihkanSunting(badan.sunting), { bundelB: badan.bundelB === "lanjut" ? "lanjut" : "1" });
    // Tabel daftar isi disusun di sini (baris tabel sungguhan) dan menggantikan paragraf penanda; satu bundel per cetakan (A tingkat pertama, B upaya hukum).
    nilai = penandaTabel(VAR_TABEL_DAFTAR_ISI[kertas]);
    daftarIsiTabel = tabelDaftarIsiRtf(hitung.baris, bundelCetak, lebar, BARIS_DAFTAR_ISI[kertas]);
    ringkas = { dokumen: hitung.total.A.dokumen + hitung.total.B.dokumen, halamanA: hitung.total.A.halaman, halamanB: hitung.total.B.halaman, perkiraan: hitung.total.A.perkiraan + hitung.total.B.perkiraan };
  }

  const hasil = await dep.isi(nilai);
  const data = hasil.data;
  if (!hasil.ok || !data?.ok || !data.rtfBase64) return { ok: false, alasan: data?.sebab ?? hasil.error ?? "Blangko tidak dapat diisi." };
  let t = Buffer.from(buangGrupTersembunyiRtf(Buffer.from(data.rtfBase64, "base64"))).toString("latin1");
  // Kotak centang ASCII jadi karakter kotak, tanda "..." variabel kosong dibuang (semua blangko berkas); logo satker (monokrom) di kop.
  t = rapikanSampulAwal(t);
  t = sisipLogoRtf(t, await dep.logoKop());
  if (jenis === "daftar-isi") t = tempelTabelCeklist(ubahKopBundel(t, bundelCetak), daftarIsiTabel);
  if (jenis === "ceklist") t = tempelTabelCeklist(t, ceklistTabel);
  // lampiran ABT (variabel di paragraf catatan kaki, sesudah #5833#) diganti lampiran susunan portal: penandanya saja yang dibuang
  if (jenis === "sampul") t = t.split(PENANDA_LAMPIRAN_ABT).join("");
  if (lamp && lamp.bagianRtf) t = gabungLampiran(t, lamp.bagianRtf);
  return {
    ok: true,
    rtf: Buffer.from(t, "latin1"),
    data,
    lampiran: lamp ? lamp.daftar : [],
    muatPihak: lamp ? lamp.muatPihak : undefined,
    ceklist: ceklistHasil ? { baris: ceklistHasil.baris, ringkas: ceklistHasil.ringkas } : undefined,
    ringkas,
    nilaiDikirim: Object.keys(nilai).length,
  };
}

export { jumlahDariDaftar, pihakBanyak };
