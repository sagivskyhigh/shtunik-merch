# Makes web-sized copies of the product mockups.
#
#   Source  (full-res, kept as-is):  ./shirt-*.jpg  ./tank-*.jpg  ./hoodie-*.jpg
#   Output  (used by the site):      ./img/<same name>.jpg   (1200px, JPEG q85)
#
# Cards and the cart load the small copies; the zoom lightbox loads the originals.
# Re-run after replacing any mockup:
#   powershell -ExecutionPolicy Bypass -File tools\optimize-images.ps1

param([int]$Size = 1200, [int]$Quality = 85)

Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$out  = Join-Path $root 'img'
New-Item -ItemType Directory -Force $out | Out-Null

$codec  = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)

Get-ChildItem $root -File | Where-Object { $_.Name -match '^(shirt|tank|hoodie)-[a-z]+\.jpg$' } | ForEach-Object {
  $src = [System.Drawing.Image]::FromFile($_.FullName)
  try {
    $scale = [Math]::Min(1.0, $Size / [Math]::Max($src.Width, $src.Height))
    $w = [int][Math]::Round($src.Width * $scale); $h = [int][Math]::Round($src.Height * $scale)
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    # tile-flip wrap mode stops a faint dark fringe on the image edges
    $attr = New-Object System.Drawing.Imaging.ImageAttributes
    $attr.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
    $g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $w, $h), 0, 0, $src.Width, $src.Height, [System.Drawing.GraphicsUnit]::Pixel, $attr)
    $dest = Join-Path $out $_.Name
    $bmp.Save($dest, $codec, $params)
    $g.Dispose(); $bmp.Dispose(); $attr.Dispose()
    '{0,-18} {1}x{2}  {3,4} KB -> {4}x{5}  {6,4} KB' -f $_.Name, $src.Width, $src.Height, [int]($_.Length / 1KB), $w, $h, [int]((Get-Item $dest).Length / 1KB)
  } finally { $src.Dispose() }
}
