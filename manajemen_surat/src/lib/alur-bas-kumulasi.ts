/**
 * ============================================================================
 * ALUR BAS PERKARA KUMULASI & ITSBAT GUGUR/CABUT (Agen T, 13 Okt 2026; paket ABT "abt-putusan-bas-lengkap")
 * ============================================================================
 *
 * Butir 4 & 8 pengguna: BAS untuk perkara kumulasi (mis. cerai gugat kumulasi hak asuh anak / itsbat nikah) dan BAS per
 * jenis x status yang belum ada. Paket ABT menambah dua folder BAS di grup Blangko Derry:
 *
 *   945  "BAS Kumulasi Cerai Gugat Verstek (Hak Asuh Anak)" - BAS sidang putus verstek (2 saksi) yang amarnya memuat
 *        penetapan hak asuh (+ nafkah anak). Turunan ALUR 02 [2]; amar itsbat tetap lewat #7184# (bila kumulasinya tercatat
 *        di SIPP perkara_kumulasi).
 *   946  "BAS Itsbat Nikah Gugur dan Cabut" - itsbat gugur 269 perkara & dicabut 113+ (SIPP PA Donggala) tanpa BAS Derry.
 *
 * Berkas ini TIDAK mengubah peta alur hasil bangkitan (alur-bas.ts / ALUR_BAS); ia membungkus tentukanAlurBas:
 * perkara cerai gugat ber-kumulasi hak asuh yang jatuh ke langkah "putus verstek" (alur 02/03) diarahkan ke folder 945,
 * langkah aslinya tetap menjadi alternatif. Alur 06 (Tergugat pernah hadir lalu tidak hadir) TIDAK diarahkan: putusannya
 * kontradiktoir (paket agen S 13 Okt: BAS ALUR 06 [3] "Saksi dan Putusan"), sedangkan BAS 945 berbunyi verstek.
 * Kumulasi itsbat tidak mengubah langkah - BAS putus verstek alur 02/03 sudah
 * memuat #7184# - tetapi bila itsbatnya hanya terbaca dari petitum, sebabnya memperingatkan agar kumulasi dicatat di SIPP
 * (tanpa itu amar "Menetapkan sah perkawinan" tidak tercetak di BAS).
 */
import { tentukanAlurBas, grupJenisAlur, type AlurBas, type HasilAlurBas, type LangkahAlurBas, type MasukanAlurBas } from "@/lib/alur-bas";

export type ButirKumulasiAlur = { kode: string; sumber?: string };

export type MasukanAlurBasKumulasi = MasukanAlurBas & {
  /** Keterangan kumulasi bot ({daftar:[{kode, sumber}]}), daftar butir, atau daftar kode. */
  kumulasi?: unknown;
};

export const ALUR_BAS_KUMULASI: AlurBas[] = [
  {
    id: "alur-k1",
    nomor: 14,
    nama: "Cerai Gugat Verstek Kumulasi Hak Asuh Anak (Sidang Putus)",
    folder: "derry_briantono/BAS Kumulasi Cerai Gugat Verstek (Hak Asuh Anak)",
    menuId: 945,
    jenisMin: 347,
    jenisMaks: 347,
    langkah: [
      {
        kode: "2",
        berkas: "[2] BAS Putus Verstek CG Kumulasi Hak Asuh Anak - P Hadir & T Tidak Hadir (2 Saksi).rtf",
        ke: 0,
        peran: "terakhir",
        keterangan: "saksi + putusan verstek; amar hak asuh anak",
        asal: "derry",
        turunan: true,
      },
      {
        kode: "2b",
        berkas: "[2b] BAS Putus Verstek CG Kumulasi Hak Asuh Anak dan Nafkah Anak - P Hadir & T Tidak Hadir (2 Saksi).rtf",
        ke: 0,
        peran: "varian",
        keterangan: "saksi + putusan verstek; amar hak asuh & nafkah anak",
        asal: "derry",
        turunan: true,
      },
    ],
  },
  {
    id: "alur-k2",
    nomor: 15,
    nama: "Itsbat Nikah Gugur / Dicabut",
    folder: "derry_briantono/BAS Itsbat Nikah Gugur dan Cabut",
    menuId: 946,
    jenisMin: 360,
    jenisMaks: 360,
    langkah: [
      {
        kode: "G",
        berkas: "[G] BAS Putus Itsbat Nikah Gugur - Para Pemohon Tidak Hadir.rtf",
        ke: 0,
        peran: "terakhir",
        keterangan: "para Pemohon tidak hadir - gugur",
        asal: "derry",
        turunan: true,
      },
      {
        kode: "C",
        berkas: "[C] BAS Putus Itsbat Nikah Dicabut - Para Pemohon Hadir Mencabut.rtf",
        ke: 0,
        peran: "varian",
        keterangan: "para Pemohon hadir dan mencabut",
        asal: "derry",
        turunan: true,
      },
    ],
  },
];

/** Butir kumulasi bersih dari bentuk apa pun yang dikirim bot / ekstensi. */
export function butirKumulasiAlur(kumulasi: unknown): ButirKumulasiAlur[] {
  const daftar: unknown[] = Array.isArray(kumulasi)
    ? kumulasi
    : kumulasi && typeof kumulasi === "object" && Array.isArray((kumulasi as { daftar?: unknown }).daftar)
      ? ((kumulasi as { daftar: unknown[] }).daftar)
      : [];
  const hasil: ButirKumulasiAlur[] = [];
  for (const x of daftar) {
    if (typeof x === "string" && x.trim()) hasil.push({ kode: x.trim().toLowerCase() });
    else if (x && typeof x === "object" && typeof (x as { kode?: unknown }).kode === "string") {
      const b = x as { kode: string; sumber?: unknown };
      hasil.push({ kode: b.kode.trim().toLowerCase(), ...(typeof b.sumber === "string" ? { sumber: b.sumber } : {}) });
    }
  }
  return hasil;
}

function langkahK(alurId: string, kode: string): { alur: AlurBas; langkah: LangkahAlurBas } {
  const alur = ALUR_BAS_KUMULASI.find((a) => a.id === alurId)!;
  return { alur, langkah: alur.langkah.find((l) => l.kode === kode)! };
}

/** Langkah "putus verstek dengan saksi" pada alur cerai verstek (02 [2..2c], 03 [3..3c]). */
function langkahPutusVerstek(h: HasilAlurBas): boolean {
  if (!h.alur || !h.langkah) return false;
  if (h.alur.id === "alur-02") return /^2[a-c]?$/.test(h.langkah.kode);
  if (h.alur.id === "alur-03") return /^3[a-c]?$/.test(h.langkah.kode); // alur 06 = kontradiktoir, tidak ikut
  return false;
}

/**
 * tentukanAlurBas + kumulasi + itsbat gugur/cabut. Murni: tanpa jaringan dan tanpa basis data.
 */
export function tentukanAlurBasKumulasi(m: MasukanAlurBasKumulasi): HasilAlurBas {
  const dasar = tentukanAlurBas(m);
  const grup = grupJenisAlur(m.jenisPerkara);
  const butir = butirKumulasiAlur(m.kumulasi);
  const ada = (kode: string) => butir.some((b) => b.kode === kode);

  if (grup === "itsbat" && (m.akhir === "gugur" || m.akhir === "cabut")) {
    const { alur, langkah } = langkahK("alur-k2", m.akhir === "gugur" ? "G" : "C");
    return { alur, langkah, alternatif: dasar.langkah ? [dasar.langkah] : [], perkiraan: false, sebab: `Itsbat nikah ${m.akhir === "gugur" ? "gugur" : "dicabut"}.` };
  }
  if (grup === "itsbat" && m.dihadiriOleh === 4 && (m.urutanSidang || 0) >= 2) {
    const { alur, langkah } = langkahK("alur-k2", "G");
    return {
      alur,
      langkah,
      alternatif: dasar.langkah ? [dasar.langkah] : [],
      perkiraan: true,
      sebab: "Itsbat nikah: para Pemohon tidak hadir lagi - putus gugur (Pasal 148 RBg), atau tunda panggil bila Majelis memanggil sekali lagi.",
    };
  }

  if (grup === "cerai-gugat" && ada("hak-asuh-anak") && langkahPutusVerstek(dasar)) {
    const { alur, langkah } = langkahK("alur-k1", ada("nafkah-anak") ? "2b" : "2");
    const lain = langkahK("alur-k1", ada("nafkah-anak") ? "2" : "2b").langkah;
    const petitum = butir.filter((b) => b.sumber === "petitum" && (b.kode === "hak-asuh-anak" || b.kode === "nafkah-anak")).length > 0;
    return {
      alur,
      langkah,
      alternatif: [lain, ...(dasar.langkah ? [dasar.langkah] : []), ...dasar.alternatif],
      perkiraan: dasar.perkiraan,
      sebab:
        `${dasar.sebab} Kumulasi hak asuh anak${ada("nafkah-anak") ? " & nafkah anak" : ""}: BAS yang amarnya memuat penetapan hak asuh.` +
        (petitum ? " Kumulasi terbaca dari petitum (belum dicatat di SIPP) - lengkapi data kumulasi di SIPP." : ""),
    };
  }

  if ((grup === "cerai-gugat" || grup === "cerai-talak") && ada("itsbat-nikah") && langkahPutusVerstek(dasar)) {
    const dariPetitum = butir.some((b) => b.kode === "itsbat-nikah" && b.sumber === "petitum");
    return {
      ...dasar,
      sebab:
        `${dasar.sebab} Kumulasi itsbat nikah: amar "Menetapkan sah perkawinan" tercetak lewat #7184#` +
        (dariPetitum ? " HANYA bila kumulasinya dicatat di SIPP - kini baru terbaca dari petitum, lengkapi data kumulasi di SIPP." : "."),
    };
  }
  return dasar;
}
