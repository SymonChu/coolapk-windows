param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('x64', 'arm64')]
  [string]$Architecture,

  [string]$RustTarget = ''
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$packageJson = Get-Content -LiteralPath (Join-Path $repoRoot 'package.json') -Raw | ConvertFrom-Json
$releaseDir = if ([string]::IsNullOrWhiteSpace($RustTarget)) {
  Join-Path $repoRoot 'src-tauri\target\release'
} else {
  Join-Path $repoRoot "src-tauri\target\$RustTarget\release"
}
$source = Join-Path $releaseDir 'coolapk_desktop.exe'

if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
  throw "未找到 Windows 可执行文件: $source"
}
if ((Get-Item -LiteralPath $source).Length -le 0) {
  throw "Windows 可执行文件为空: $source"
}

$outputDir = Join-Path $repoRoot 'src-tauri\target\portable'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$output = Join-Path $outputDir "coolapk-desktop_$($packageJson.version)_$Architecture-portable.exe"
Copy-Item -LiteralPath $source -Destination $output -Force
Write-Output $output
