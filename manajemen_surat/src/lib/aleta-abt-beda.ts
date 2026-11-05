/**
 * ============================================================================
 * BEDA DUA URUTAN - ALETA ABT Tahap 3 (5 Nov 2026)
 * ============================================================================
 *
 * Algoritma Myers (O(ND)) atas urutan bilangan bulat, tanpa pustaka. Dipakai dua tempat:
 *   - penyunting: beda aksara antara paragraf sebelum dan sesudah diketik, supaya hanya aksara yang berubah yang
 *     menyentuh RTF (sisanya tidak disentuh sama sekali);
 *   - pembanding versi: beda paragraf antar dua versi blangko, lalu beda kata di paragraf yang berubah.
 *
 * Bila bedanya terlalu besar (D melewati batas) hasilnya satu penggantian utuh: lebih kasar tetapi tetap benar.
 */

export type OpBeda = {
  t: "=" | "-" | "+";
  /** Awal di urutan A (untuk "+" : titik sisip di A). */
  a: number;
  /** Awal di urutan B. */
  b: number;
  /** Panjang: yang sama, yang dibuang dari A, atau yang ditambah dari B. */
  n: number;
};

/** Myers pada dua larik bilangan; kembalian: urutan op yang berdampingan dan berjalan dari awal ke akhir. */
export function bedaLarik(A: ArrayLike<number>, B: ArrayLike<number>, batasD = 1500): OpBeda[] {
  const N = A.length;
  const M = B.length;
  let awal = 0;
  while (awal < N && awal < M && A[awal] === B[awal]) awal += 1;
  let akhirA = N;
  let akhirB = M;
  while (akhirA > awal && akhirB > awal && A[akhirA - 1] === B[akhirB - 1]) {
    akhirA -= 1;
    akhirB -= 1;
  }
  const hasil: OpBeda[] = [];
  const dorong = (t: OpBeda["t"], a: number, b: number, n: number) => {
    if (n <= 0) return;
    const akhir = hasil[hasil.length - 1];
    if (akhir && akhir.t === t) {
      const aUjung = akhir.a + (t === "+" ? 0 : akhir.n);
      const bUjung = akhir.b + (t === "-" ? 0 : akhir.n);
      if (aUjung === a && bUjung === b) {
        akhir.n += n;
        return;
      }
    }
    hasil.push({ t, a, b, n });
  };
  if (awal > 0) dorong("=", 0, 0, awal);
  const n = akhirA - awal;
  const m = akhirB - awal;
  if (n === 0 && m === 0) {
    // sama persis
  } else if (n === 0) {
    dorong("+", awal, awal, m);
  } else if (m === 0) {
    dorong("-", awal, awal, n);
  } else {
    const tengah = myers(A, B, awal, n, m, batasD);
    if (!tengah) {
      dorong("-", awal, awal, n);
      dorong("+", awal + n, awal, m);
    } else {
      for (const op of tengah) dorong(op.t, op.a, op.b, op.n);
    }
  }
  if (akhirA < N) dorong("=", akhirA, akhirB, N - akhirA);
  return hasil;
}

function myers(A: ArrayLike<number>, B: ArrayLike<number>, o: number, N: number, M: number, batasD: number): OpBeda[] | null {
  const maks = Math.min(N + M, batasD);
  const ofs = maks + 1;
  const v = new Int32Array(2 * maks + 3);
  const jejak: Int32Array[] = [];
  let ketemu = -1;
  for (let d = 0; d <= maks && ketemu < 0; d += 1) {
    jejak.push(v.slice(ofs - d - 1, ofs + d + 2));
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[ofs + k - 1] < v[ofs + k + 1])) x = v[ofs + k + 1];
      else x = v[ofs + k - 1] + 1;
      let y = x - k;
      while (x < N && y < M && A[o + x] === B[o + y]) {
        x += 1;
        y += 1;
      }
      v[ofs + k] = x;
      if (x >= N && y >= M) {
        ketemu = d;
        break;
      }
    }
  }
  if (ketemu < 0) return null;
  // Telusur mundur.
  const mundur: OpBeda[] = [];
  let x = N;
  let y = M;
  for (let d = ketemu; d > 0; d -= 1) {
    const sebelum = jejak[d];
    const dasar = d + 1; // v.slice(ofs - d - 1 ...) : indeks k -> k + d + 1
    const k = x - y;
    const turun = k === -d || (k !== d && sebelum[k - 1 + dasar] < sebelum[k + 1 + dasar]);
    const kLama = turun ? k + 1 : k - 1;
    const xLama = sebelum[kLama + dasar];
    const yLama = xLama - kLama;
    const xAntara = turun ? xLama : xLama + 1;
    const yAntara = turun ? yLama + 1 : yLama;
    if (x > xAntara) mundur.push({ t: "=", a: o + xAntara, b: o + yAntara, n: x - xAntara });
    if (turun) mundur.push({ t: "+", a: o + xLama, b: o + yLama, n: 1 });
    else mundur.push({ t: "-", a: o + xLama, b: o + yLama, n: 1 });
    x = xLama;
    y = yLama;
  }
  if (x > 0) mundur.push({ t: "=", a: o, b: o, n: x });
  return mundur.reverse();
}

const kodeAksara = (s: string) => {
  const u = new Uint16Array(s.length);
  for (let i = 0; i < s.length; i += 1) u[i] = s.charCodeAt(i);
  return u;
};

/** Beda aksara dua string. */
export function bedaTeks(a: string, b: string, batasD = 1500): OpBeda[] {
  return bedaLarik(kodeAksara(a), kodeAksara(b), batasD);
}

/** Beda dua daftar string (mis. paragraf). */
export function bedaDaftar(a: string[], b: string[], batasD = 3000): OpBeda[] {
  const id = new Map<string, number>();
  const ke = (s: string) => {
    let n = id.get(s);
    if (n === undefined) {
      n = id.size;
      id.set(s, n);
    }
    return n;
  };
  return bedaLarik(Int32Array.from(a.map(ke)), Int32Array.from(b.map(ke)), batasD);
}

/** Pecah teks menjadi kata + pemisah (spasi/tanda) supaya beda kata terbaca; gabungan potongan = teks asal. */
export function potongKata(s: string): string[] {
  return s.match(/[\p{L}\p{N}_#]+|\s+|[^\p{L}\p{N}_#\s]/gu) ?? [];
}

export type PotongBeda = { t: string; d?: "hapus" | "tambah" };

/** Beda kata dua teks: dua larik potongan (sisi lama dan sisi baru) dengan tanda yang dibuang/ditambah. */
export function bedaKata(a: string, b: string): { lama: PotongBeda[]; baru: PotongBeda[] } {
  const pa = potongKata(a);
  const pb = potongKata(b);
  const lama: PotongBeda[] = [];
  const baru: PotongBeda[] = [];
  const dorong = (daftar: PotongBeda[], t: string, d?: PotongBeda["d"]) => {
    if (!t) return;
    const akhir = daftar[daftar.length - 1];
    if (akhir && akhir.d === d) akhir.t += t;
    else daftar.push(d ? { t, d } : { t });
  };
  for (const op of bedaDaftar(pa, pb)) {
    if (op.t === "=") {
      const t = pa.slice(op.a, op.a + op.n).join("");
      dorong(lama, t);
      dorong(baru, t);
    } else if (op.t === "-") dorong(lama, pa.slice(op.a, op.a + op.n).join(""), "hapus");
    else dorong(baru, pb.slice(op.b, op.b + op.n).join(""), "tambah");
  }
  return { lama, baru };
}
