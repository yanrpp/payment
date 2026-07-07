import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const bmpPath = path.join(root, "public", "images", "Logo.bmp");
const pngPath = path.join(root, "public", "images", "logo-banner.png");

const psScript = `
Add-Type -AssemblyName System.Drawing
$src = '${bmpPath.replace(/'/g, "''")}'
$dst = '${pngPath.replace(/'/g, "''")}'
$img = [System.Drawing.Image]::FromFile($src)
$targetW = 320
$targetH = 320
$bmp = New-Object System.Drawing.Bitmap $targetW, $targetH
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.Clear([System.Drawing.Color]::Transparent)
$g.DrawImage($img, 0, 0, $targetW, $targetH)
$bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose(); $img.Dispose()
Write-Output ((Get-Item $dst).Length)
`;

const result = spawnSync(
  "powershell",
  ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psScript],
  { encoding: "utf8" }
);

if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(1);
}

console.log(`Wrote ${pngPath} (${result.stdout.trim()} bytes)`);
