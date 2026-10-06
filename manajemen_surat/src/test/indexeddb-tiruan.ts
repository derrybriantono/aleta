/**
 * IndexedDB tiruan secukupnya untuk rak naskah edoc ekstensi (konten.js,
 * a30BukaRakNaskah dan kawan-kawannya): open/upgrade, satu toko ber-keyPath,
 * put/get/getAll/delete, dan transaksi yang selesai sesudah permintaannya.
 * SATU tiruan dipakai bersama semua "tab" - seperti IndexedDB asal SIPP.
 *
 * jsdom dan Node tidak punya IndexedDB; paket fake-indexeddb tidak terpasang.
 */
export function buatIndexedDbTiruan() {
  const basis = new Map<string, Map<string, { keyPath: string; data: Map<string, unknown> }>>();
  const nanti = (f: () => void) => setTimeout(f, 0);
  const salin = <T>(x: T): T => (x === undefined ? x : structuredClone(x));
  function dbDari(nama: string) {
    const toko = basis.get(nama)!;
    return {
      objectStoreNames: { contains: (n: string) => toko.has(n) },
      createObjectStore: (n: string, o: { keyPath: string }) => void toko.set(n, { keyPath: o.keyPath, data: new Map() }),
      close() {},
      transaction(n: string) {
        const t = toko.get(n);
        if (!t) throw new Error("NotFoundError");
        const tx: Record<string, any> = {};
        const minta = (kerja: () => unknown) => {
          const r: Record<string, any> = {};
          nanti(() => {
            r.result = kerja();
            if (r.onsuccess) r.onsuccess();
            nanti(() => tx.oncomplete && tx.oncomplete());
          });
          return r;
        };
        tx.objectStore = () => ({
          put: (v: Record<string, unknown>) => minta(() => void t.data.set(String(v[t.keyPath]), salin(v))),
          get: (k: string) => minta(() => salin(t.data.get(k))),
          getAll: () => minta(() => [...t.data.values()].map(salin)),
          delete: (k: string) => minta(() => void t.data.delete(k)),
        });
        return tx;
      },
    };
  }
  return {
    basis,
    /** Isi satu toko - untuk pemeriksaan (dan penyetelan) uji. Toko dibuat bila belum ada. */
    isi(nama: string, toko: string) {
      if (!basis.has(nama)) basis.set(nama, new Map());
      const b = basis.get(nama)!;
      if (!b.has(toko)) b.set(toko, { keyPath: "kunci", data: new Map() });
      return b.get(toko)!.data;
    },
    open(nama: string) {
      const r: Record<string, any> = {};
      nanti(() => {
        const baru = !basis.has(nama);
        if (baru) basis.set(nama, new Map());
        r.result = dbDari(nama);
        if (baru && r.onupgradeneeded) r.onupgradeneeded();
        if (r.onsuccess) r.onsuccess();
      });
      return r;
    },
  };
}
