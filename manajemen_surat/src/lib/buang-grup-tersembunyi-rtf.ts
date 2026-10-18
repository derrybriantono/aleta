/**
 * Keputusan 18 Okt 2026 (butir 18): grup RTF tersembunyi penanda asal blangko -
 * {\*\isianasal ...} dan {\*\aletaasal ...} - dibuang BESERTA ISINYA sebelum berkas
 * ditulis atau diunggah ke SIPP. Salinan sisi portal dari
 * aleta_bot/services/metadataTanpaAletaService.js (diuji bersama); jalur bot
 * tetap membuangnya sendiri, ini lapis pertama.
 *
 * Berkas yang bukan RTF, atau tanpa grup itu, dikembalikan apa adanya (objek yang sama).
 */
const PENANDA = /\{\\\*\s*\\(?:isianasal|aletaasal)(?![a-z])/gi;

function akhirGrup(s: string, dari: number): number {
  let dalam = 1;
  let i = dari;
  for (; i < s.length && dalam > 0; i += 1) {
    const c = s[i];
    if (c === "\\") i += 1;
    else if (c === "{") dalam += 1;
    else if (c === "}") dalam -= 1;
  }
  return i;
}

export function buangGrupTersembunyiRtfTeks(s: string): string {
  PENANDA.lastIndex = 0;
  if (!PENANDA.test(s)) return s;
  PENANDA.lastIndex = 0;
  let keluar = "";
  let akhir = 0;
  let m: RegExpExecArray | null;
  while ((m = PENANDA.exec(s))) {
    if (m.index < akhir) continue;
    const i = akhirGrup(s, m.index + m[0].length);
    keluar += s.slice(akhir, m.index);
    akhir = i;
    PENANDA.lastIndex = i;
  }
  return keluar + s.slice(akhir);
}

export function buangGrupTersembunyiRtf(bita: Uint8Array): Uint8Array {
  if (bita.length < 5) return bita;
  const kepala = Buffer.from(bita.subarray(0, 5)).toString("latin1");
  if (kepala !== "{\\rtf") return bita;
  const s = Buffer.from(bita).toString("latin1");
  const baru = buangGrupTersembunyiRtfTeks(s);
  return baru === s ? bita : new Uint8Array(Buffer.from(baru, "latin1"));
}
