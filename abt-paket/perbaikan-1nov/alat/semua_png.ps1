# Cetak halaman penting render sebelum/sesudah (5 kasus) ke PNG. pakai: semua_png.ps1 <folder render> (hasil di <folder>/png)
param([string]$Folder = 'D:\Aplikasi\aleta\tmp\w174\render')
$env:TMP = 'D:\Aplikasi\aleta\tmp'; $env:TEMP = 'D:\Aplikasi\aleta\tmp'
$png = Join-Path $Folder 'png'
New-Item -ItemType Directory -Force $png | Out-Null
$tugas = @(
  @('a-bukti-baru', 'alat-alat buktinya', 'p'),
  @('a-bukti-berubah', 'alat-alat buktinya', 'p'),
  @('a-bukti-berubah', 'menguatkan bantahannya', 't'),
  @('b-khi7-ayat4', 'Pasal 7 ayat (4)', 'k'),
  @('b-dk-angka', 'sesuai dengan Pasal 1', 'k'),
  @('b-hb-ps35', 'Pasal 35 ayat', 'k')
)
foreach ($fase in @('sebelum', 'sesudah')) {
  foreach ($t in $tugas) {
    $rtf = Join-Path $Folder ("{0}-{1}.rtf" -f $fase, $t[0])
    $awal = Join-Path $png ("{0}-{1}-{2}" -f $fase, $t[0], $t[2])
    if (Get-ChildItem $png -Filter ("{0}-{1}-{2}-h*-h1.png" -f $fase, $t[0], $t[2]) -ErrorAction SilentlyContinue) { continue }
    & "$PSScriptRoot\halaman_png.ps1" -Rtf $rtf -Kata $t[1] -Awalan $awal | Out-Null
    Write-Output ("{0} {1} {2} selesai {3}" -f $fase, $t[0], $t[2], (Get-Date -Format 'HH:mm:ss'))
  }
}
Write-Output 'SEMUA PNG SELESAI'
