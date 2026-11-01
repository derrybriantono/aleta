/**
 * Fixture RTF BAS pembuktian REKAAN untuk uji Z cross otomatis. Susunan meniru blangko BAS Derry: ukuran 21,5 x 29,7 cm, tepi 4/2/3/3 cm,
 * Arial 12, pengantar bukti, daftar bukti, paragraf "Bukti-bukti tersebut sebagai berikut:" yang memegang bentuk "SC Z 1x" + bentuk
 * bebas Z (templat lama), lalu pemisah seksi bernomor halaman tetap (\pgnstarts15) dan kalimat sesudahnya. Footer memuat nomor halaman
 * (field PAGE) supaya nomor halaman tercetak di PDF dan dapat diperiksa.
 */
export type OpsiFixture = {
  /** Jumlah bukti (baris daftar). */
  bukti: number;
  /** Jumlah paragraf pengisi sebelum pengantar bukti (mendorong Z ke halaman berikut). */
  isi?: number;
  /** Pakai bentuk templat lama ("SC Z 1x" + FreeForm) di paragraf jangkar. */
  templatZ?: boolean;
  /** Sertakan pemisah seksi + kalimat sesudah Z (bawaan ya). */
  bagianBerikut?: boolean;
  /** Tanpa pemisah seksi tetapi ada kalimat sesudahnya (uji penyisipan pemisah). */
  tanpaPemisah?: boolean;
  /** Paragraf jangkar: panjang kalimat dalam huruf Courier (60 huruf = satu baris penuh). Bawaan: kalimat biasa "Bukti-bukti tersebut sebagai berikut:". */
  hurufJangkarMono?: number;
  /** Pengantar bukti elektronik tambahan ("Selanjutnya ... bukti elektronik berupa:") dengan sekian butir. */
  elektronik?: number;
  /** Nomor halaman awal seksi pertama (\pgnrestart). */
  nomorAwal?: number;
  /** Tanpa jangkar sama sekali (BAS tanpa pembuktian). */
  tanpaJangkar?: boolean;
  /** Kata pembuka tiap paragraf pengisi (untuk membedakan fixture). */
  penanda?: string;
};

const PAR = "\\par\r\n";

const sp = (n: string, v: string | number) => `{\\sp{\\sn ${n}}{\\sv ${v}}}`;

const BENTUK_SC_Z =
  `{\\shp{\\*\\shpinst\\shpleft-501\\shptop1794\\shpright1858\\shpbottom2442\\shpfhdr0\\shpbxcolumn\\shpbxignore\\shpbypara\\shpbyignore\\shpwr3\\shpwrk0\\shpfblwtxt0\\shpz1\\shplid1026` +
  sp("shapeType", 202) + sp("fFlipH", 0) + sp("fFlipV", 0) + sp("fLockAspectRatio", 0) + sp("WrapText", 0) + sp("fLineOK", 1) + sp("fFilled", 0) + sp("fLine", 0) + sp("wzName", "Text Box 3") + sp("fLayoutInCell", 1) +
  `{\\shptxt \\pard\\plain\\li0\\ri0\\sa0\\sl240\\slmult1\\fs24 SC Z 1x\\par\\pard\\plain\\li0\\ri0\\sa0\\sl240\\slmult1\\fs24 31 Oktober 2026\\par}}}`;

const BENTUK_FREEFORM =
  `{\\shp{\\*\\shpinst\\shpleft-392\\shptop159\\shpright8112\\shpbottom1716\\shpfhdr0\\shpbxcolumn\\shpbxignore\\shpbypara\\shpbyignore\\shpwr3\\shpwrk0\\shpfblwtxt0\\shpz0\\shplid1027` +
  sp("shapeType", 0) + sp("fFlipH", 0) + sp("fFlipV", 0) + sp("fLockAspectRatio", 0) + sp("WrapText", 0) + sp("geoRight", 8504) + sp("geoBottom", 2486) + sp("shapePath", 4) +
  sp("pVerticies", "8;4;(5168,12);(8504,0);(0,2486);(8504,2486)") + sp("pSegmentInfo", "2;9;16384;44032;1;44032;1;44032;1;44032;32768") + sp("fFilled", 0) + sp("lineStyle", 0) + sp("fLine", 1) + sp("fArrowheadsOK", 1) + sp("wzName", "FreeForm 3") + sp("fLayoutInCell", 1) +
  `}}`;

const SEKSI = "\\pgwsxn12191\\pghsxn16840\\marglsxn2268\\margrsxn1134\\margtsxn1701\\margbsxn1701\\guttersxn0\\headery709\\footery709\\sectdefaultcl";

function paragrafIsi(n: number, penanda: string): string {
  const kata = ["majelis", "hakim", "pemeriksaan", "perkara", "persidangan", "keterangan", "pihak", "sebagaimana", "dimaksud", "diajukan"];
  let t = `${penanda} ${n + 1}. `;
  for (let i = 0; i < 38; i += 1) t += `${kata[(n * 7 + i * 3) % kata.length]} `;
  return `\\pard\\plain\\qj\\sa120\\sl300\\slmult1\\f0\\fs24 ${t.trim()}.${PAR}`;
}

export function buatBasRtf(o: OpsiFixture): string {
  const bagianBerikut = o.bagianBerikut !== false;
  const penanda = o.penanda ?? "Uraian";
  const nomorAwal = o.nomorAwal != null ? `\\pgnrestart\\pgnstarts${o.nomorAwal}` : "";
  let s =
    `{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\fswiss\\fcharset0 Arial;}{\\f1\\fmodern\\fcharset0 Courier New;}}{\\colortbl;\\red0\\green0\\blue0;}\r\n` +
    `\\paperw12191\\paperh16840\\margl2268\\margr1134\\margt1701\\margb1701\r\n` +
    `\\sectd\\sbkpage${nomorAwal}${SEKSI}\r\n` +
    `{\\footer\\pard\\plain\\qc\\f0\\fs20 Halaman {\\field{\\*\\fldinst PAGE}{\\fldrslt 1}}\\par}\r\n` +
    `\\pard\\plain\\qc\\b\\f0\\fs24 BERITA ACARA SIDANG${PAR}\\pard\\plain\\qc\\f0\\fs24 Nomor 12/Pdt.G/2026/PA.Dgl${PAR}` +
    `\\pard\\plain\\qj\\sa120\\sl300\\slmult1\\fi720\\f0\\fs24 Pada hari ini Kamis tanggal 29 Oktober 2026 telah dilangsungkan persidangan perkara antara Penggugat melawan Tergugat.${PAR}`;
  for (let i = 0; i < (o.isi ?? 0); i += 1) s += paragrafIsi(i, penanda);
  if (!o.tanpaJangkar) {
    s += `\\pard\\plain\\qj\\sa120\\sl300\\slmult1\\fi720\\f0\\fs24 Atas pertanyaan Ketua Majelis, Penggugat menyatakan bahwa pada hari ini ia telah siap mengajukan alat bukti surat dan saksi-saksi. Selanjutnya Penggugat menyerahkan bukti surat berupa:${PAR}`;
    for (let i = 1; i <= o.bukti; i += 1) s += `\\pard\\plain\\qj\\sa60\\sl300\\slmult1\\li720\\f0\\fs24 Fotokopi surat nomor ${i}/2026, bermeterai cukup dan sesuai dengan aslinya (diberi tanda P.${i});${PAR}`;
    if (o.elektronik) {
      s += `\\pard\\plain\\qj\\sa120\\sl300\\slmult1\\fi720\\f0\\fs24 Selanjutnya Penggugat menyerahkan bukti elektronik berupa:${PAR}`;
      for (let i = 1; i <= o.elektronik; i += 1) s += `\\pard\\plain\\qj\\sa60\\sl300\\slmult1\\li720\\f0\\fs24 Tangkapan layar percakapan nomor ${i} (diberi tanda P.${o.bukti + i});${PAR}`;
    }
    const bentuk = o.templatZ ? BENTUK_SC_Z + BENTUK_FREEFORM : "";
    if (o.hurufJangkarMono) {
      const huruf = "Bukti-bukti tersebut sebagai berikut:";
      const isi = (huruf + " ".repeat(Math.max(0, o.hurufJangkarMono - huruf.length))).slice(0, Math.max(huruf.length, o.hurufJangkarMono));
      // kalimat berhuruf tetap: awali dengan pengisi supaya total huruf = hurufJangkarMono dan kata terakhir "berikut:" di ujung
      const depan = "x".repeat(Math.max(0, o.hurufJangkarMono - huruf.length - 1));
      void isi;
      s += `\\pard\\plain\\ql\\sa120\\sl300\\slmult1\\f1\\fs24 ${bentuk}${depan ? depan + " " : ""}${huruf}${PAR}`;
    } else {
      s += `\\pard\\plain\\ql\\sa120\\sl300\\slmult1\\f0\\fs24 ${bentuk}Bukti-bukti tersebut sebagai berikut:${PAR}`;
    }
  }
  if (bagianBerikut) {
    if (!o.tanpaPemisah) s += `\\pard\\plain\\f0\\fs24 \\sect\r\n\\sectd\\pgnrestart\\pgnstarts15\\sbkpage${SEKSI}\r\n`;
    s +=
      `\\pard\\plain\\qj\\sa120\\sl300\\slmult1\\fi720\\f0\\fs24 Selanjutnya atas pertanyaan Ketua Majelis, Penggugat menyatakan telah cukup dengan bukti suratnya.${PAR}` +
      `\\pard\\plain\\qj\\sa120\\sl300\\slmult1\\fi720\\f0\\fs24 Demikian berita acara ini dibuat dan ditandatangani.${PAR}`;
  }
  s += "}\r\n";
  return s;
}
