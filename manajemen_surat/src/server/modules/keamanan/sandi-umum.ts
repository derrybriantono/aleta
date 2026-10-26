/**
 * Sandi yang terlalu umum untuk dipakai (25 Okt 2026, 6a). Daftar ringkas yang
 * ditulis sendiri: yang paling sering dicoba penyerang di dunia dan di
 * Indonesia, ditambah kata yang lazim dipakai pegawai instansi. Bukan daftar
 * bocoran siapa pun, bukan sandi akun ALETA.
 */
const DASAR = [
  "password", "passw0rd", "pass1234", "password1", "password12", "password123", "sandi", "sandi123", "katasandi",
  "kata sandi", "rahasia", "rahasia123", "123456", "1234567", "12345678", "123456789", "1234567890", "12345",
  "1234", "111111", "11111111", "000000", "00000000", "121212", "123123", "123321", "112233", "654321", "666666",
  "696969", "987654321", "159753", "147258369", "qwerty", "qwerty123", "qwertyuiop", "qwe123", "asdfgh", "asdfghjkl",
  "zxcvbnm", "1q2w3e4r", "1qaz2wsx", "q1w2e3r4", "abc123", "abcd1234", "abcdef", "abcdefg", "abc12345", "admin",
  "admin123", "admin1234", "admin12345", "administrator", "root", "toor", "user", "user123", "test", "test123",
  "tes123", "coba", "coba123", "guest", "default", "welcome", "welcome1", "welcome123", "login", "letmein",
  "monkey", "dragon", "master", "shadow", "sunshine", "princess", "football", "baseball", "iloveyou", "trustno1",
  "indonesia", "indonesia123", "indonesia1945", "garuda", "garuda123", "pancasila", "merdeka", "merdeka45",
  "bismillah", "bismillah123", "allahuakbar", "alhamdulillah", "assalamualaikum", "sayang", "cintaku", "sayangku",
  "kamukamu", "jakarta", "jakarta123", "palu", "palu123", "donggala", "donggala123", "sulteng", "sulawesi",
  "pengadilan", "pengadilan123", "pengadilanagama", "pa-donggala", "padonggala", "padonggala123", "mahkamahagung",
  "mahkamah", "mahkamah123", "badilag", "badilag123", "sipp", "sipp123", "sippadmin", "aleta", "aleta123", "aleta1234",
  "aleta12345", "hakim", "hakim123", "panitera", "panitera123", "pegawai", "pegawai123", "kantor", "kantor123",
  "ganti", "gantisandi", "ubahsandi", "berubah", "baru123", "sandibaru", "passwordbaru", "iniPassword", "ini123",
];

export const DAFTAR_SANDI_UMUM: ReadonlySet<string> = new Set(DASAR.map((x) => x.toLowerCase().replace(/\s+/g, "")));

/** Sandi dengan akhiran angka/tanda dibuang ("password2026!" -> "password"). */
function inti(sandi: string) {
  return sandi
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[0-9!@#$%^&*._\-+=?]+$/g, "");
}

/** "p@ssw0rd" -> "password": penggantian huruf-angka yang lazim. */
function tanpaSamaran(sandi: string) {
  const peta: Record<string, string> = { "@": "a", "4": "a", "3": "e", "1": "i", "!": "i", "0": "o", "5": "s", $: "s", "7": "t" };
  return sandi
    .toLowerCase()
    .split("")
    .map((c) => peta[c] ?? c)
    .join("");
}

export function sandiTerlaluUmum(sandi: string): boolean {
  const kecil = sandi.toLowerCase().replace(/\s+/g, "");
  if (!kecil) return false;
  if (DAFTAR_SANDI_UMUM.has(kecil)) return true;
  const dasar = inti(sandi);
  if (dasar.length >= 4 && DAFTAR_SANDI_UMUM.has(dasar)) return true;
  const polos = tanpaSamaran(kecil);
  if (DAFTAR_SANDI_UMUM.has(polos)) return true;
  const polosInti = inti(polos);
  if (polosInti.length >= 4 && DAFTAR_SANDI_UMUM.has(polosInti)) return true;
  // satu karakter diulang ("aaaaaaaa") atau deret naik/turun sederhana ("abcdefgh", "87654321")
  if (/^(.)\1+$/.test(kecil)) return true;
  if (kecil.length >= 6) {
    let naik = true;
    let turun = true;
    for (let i = 1; i < kecil.length; i += 1) {
      const d = kecil.charCodeAt(i) - kecil.charCodeAt(i - 1);
      if (d !== 1) naik = false;
      if (d !== -1) turun = false;
    }
    if (naik || turun) return true;
  }
  return false;
}
