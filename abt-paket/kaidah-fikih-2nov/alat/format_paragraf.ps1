# Cetak format paragraf (rata, inden baris pertama, inden kiri, huruf, ukuran, miring) untuk paragraf yang memuat tiap kata dan N paragraf sesudahnya.
# pakai: format_paragraf.ps1 <rtf> <jumlah paragraf sesudah> <kata> [<kata> ...]. Word milik sendiri ditutup di akhir.
param([string]$Rtf, [int]$Lanjut, [Parameter(ValueFromRemainingArguments = $true)][string[]]$Kata)
$w = New-Object -ComObject Word.Application
$w.Visible = $false
$w.DisplayAlerts = 0
try {
  $d = $w.Documents.Open((Resolve-Path $Rtf).Path, $false, $true)
  foreach ($k in $Kata) {
    $r = $d.Content
    if (-not $r.Find.Execute($k)) { Write-Output "TIDAK KETEMU: $k"; continue }
    $p = $r.Paragraphs.Item(1)
    for ($i = 0; $i -le $Lanjut; $i++) {
      $t = $p.Range.Text.Trim()
      if ($t.Length -gt 70) { $t = $t.Substring(0, 70) }
      Write-Output ("rata={0} fi={1} li={2} huruf={3} pt={4} | {5}" -f $p.Alignment, $p.FirstLineIndent, $p.LeftIndent, $p.Range.Font.Name, $p.Range.Font.Size, $t)
      $p = $p.Next(1)
      if ($p -eq $null) { break }
    }
    Write-Output '--'
  }
  $d.Close([ref]0)
} finally {
  $w.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($w) | Out-Null
}
