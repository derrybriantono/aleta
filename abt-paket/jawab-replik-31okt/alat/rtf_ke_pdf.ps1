# Ubah RTF hasil render ABT menjadi PDF lewat Microsoft Word (untuk melihat butir "-" di cetakan). Baca saja atas berkas masukan.
# pakai: powershell -File rtf_ke_pdf.ps1 <rtf1> [<rtf2> ...]   -> <rtf>.pdf di sebelahnya
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Berkas)
$w = New-Object -ComObject Word.Application
$w.Visible = $false
$w.DisplayAlerts = 0
try {
  foreach ($b in $Berkas) {
    $p = (Resolve-Path $b).Path
    $d = $w.Documents.Open($p, $false, $true)
    $d.SaveAs([ref]($p + '.pdf'), [ref]17)
    $d.Close([ref]0)
    Write-Output "PDF $p.pdf"
  }
} finally {
  $w.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($w) | Out-Null
}
