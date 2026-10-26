/**
 * Basis data ALETA tiruan untuk penetapanKunciService (aleta_bot): meniru semantik SQL tabel
 * aleta_bot_kunci_penetapan (PRIMARY KEY perkara_id, kedaluwarsa dan detak menurut jam tiruan
 * `jam.sekarang` dalam detik). SQL yang tidak dikenal melempar, jadi perubahan kueri layanan yang tidak
 * diikuti tiruan ini ketahuan di uji.
 *
 * `kolomDetak:false` meniru tabel lama (sebelum 26 Okt 2026): SHOW COLUMNS kosong dan ALTER menambahkannya.
 */
export type BarisKunci = { token: string; pemilik: string; tujuan: string; diambil: number; sampai: number; detak: number | null };

export function basisKunciTiruan(opsi: { kolomDetak?: boolean } = {}) {
  const baris = new Map<number, BarisKunci>();
  const jam = { sekarang: Date.UTC(2026, 9, 26, 3, 40, 44) / 1000 };
  const sql: string[] = [];
  let punyaKolom = opsi.kolomDetak !== false;

  const query = async (teks: string, p: unknown[] = []) => {
    const s = teks.replace(/\s+/g, " ").trim();
    sql.push(s);
    if (/^CREATE TABLE/i.test(s)) return {};
    if (/^SHOW COLUMNS FROM \S+ LIKE 'detak'/i.test(s)) return punyaKolom ? [{ Field: "detak" }] : [];
    if (/^ALTER TABLE \S+ ADD COLUMN detak DATETIME NULL/i.test(s)) {
      punyaKolom = true;
      return {};
    }
    // perpanjangan (pemegang token): sampai (dan, sejak 26 Okt 2026, detak) digeser
    if (/^UPDATE \S+ SET sampai = DATE_ADD\(UTC_TIMESTAMP\(\), INTERVAL \? SECOND\)(, detak = UTC_TIMESTAMP\(\))? WHERE perkara_id = \? AND token = \? AND sampai >= UTC_TIMESTAMP\(\)/i.test(s)) {
      const [ttl, id, token] = p as [number, number, string];
      const b = baris.get(id);
      if (b && b.token === token && b.sampai >= jam.sekarang) {
        b.sampai = jam.sekarang + ttl;
        if (/detak = UTC_TIMESTAMP/i.test(s)) b.detak = jam.sekarang;
        return { affectedRows: 1 };
      }
      return { affectedRows: 0 };
    }
    // ambil alih kunci basi pemilik yang sama
    if (/^UPDATE \S+ SET token = \?, pemilik = \?, tujuan = \?, diambil = UTC_TIMESTAMP\(\), sampai = DATE_ADD\(UTC_TIMESTAMP\(\), INTERVAL \? SECOND\), detak = UTC_TIMESTAMP\(\) WHERE perkara_id = \? AND token = \? AND TIMESTAMPDIFF\(SECOND, COALESCE\(detak, diambil\), UTC_TIMESTAMP\(\)\) >= \?/i.test(s)) {
      const [tokenBaru, pemilik, tujuan, ttl, id, tokenLama, ambang] = p as [string, string, string, number, number, string, number];
      const b = baris.get(id);
      if (b && b.token === tokenLama && jam.sekarang - (b.detak ?? b.diambil) >= ambang) {
        Object.assign(b, { token: tokenBaru, pemilik, tujuan, diambil: jam.sekarang, sampai: jam.sekarang + ttl, detak: jam.sekarang });
        return { affectedRows: 1 };
      }
      return { affectedRows: 0 };
    }
    if (/^DELETE FROM \S+ WHERE perkara_id = \? AND sampai < UTC_TIMESTAMP\(\)/i.test(s)) {
      const id = p[0] as number;
      const b = baris.get(id);
      if (b && b.sampai < jam.sekarang) baris.delete(id);
      return { affectedRows: 1 };
    }
    if (/^INSERT IGNORE INTO/i.test(s)) {
      const [id, token, pemilik, tujuan, ttl] = p as [number, string, string, string, number];
      if (baris.has(id)) return { affectedRows: 0 };
      baris.set(id, { token, pemilik, tujuan, diambil: jam.sekarang, sampai: jam.sekarang + ttl, detak: null });
      return { affectedRows: 1 };
    }
    if (/^DELETE FROM \S+ WHERE perkara_id = \? AND token = \?/i.test(s)) {
      const [id, token] = p as [number, string];
      const b = baris.get(id);
      if (b && b.token === token) {
        baris.delete(id);
        return { affectedRows: 1 };
      }
      return { affectedRows: 0 };
    }
    if (/^SELECT perkara_id, token/i.test(s)) {
      const b = baris.get(p[0] as number);
      if (!b) return [];
      const tampil = (t: number) => new Date(t * 1000).toISOString().slice(0, 19).replace("T", " ");
      return [
        {
          perkara_id: p[0],
          token: b.token,
          pemilik: b.pemilik,
          tujuan: b.tujuan,
          diambil: tampil(b.diambil),
          sampai: tampil(b.sampai),
          detak: tampil(b.detak ?? b.diambil),
          sunyi: jam.sekarang - (b.detak ?? b.diambil),
          sisa: b.sampai - jam.sekarang,
          hidup: b.sampai >= jam.sekarang ? 1 : 0,
        },
      ];
    }
    throw new Error(`SQL tak dikenal: ${s.slice(0, 120)}`);
  };
  return { db: { query }, jam, baris, sql };
}
