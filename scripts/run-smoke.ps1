param(
  [ValidateSet("preview", "dev")]
  [string]$Mode = "dev",
  [string]$Session,
  [switch]$NoForceSaveFallback
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$logPath = Join-Path $PSScriptRoot ("smoke-" + $Mode + "-last.log")
if (Test-Path -LiteralPath $logPath) {
  Remove-Item -LiteralPath $logPath -Force
}

function Log-Line {
  param([string]$Message)
  $line = ("[{0}] {1}" -f (Get-Date).ToString("HH:mm:ss"), $Message)
  Add-Content -LiteralPath $logPath -Value $line
  Write-Output $line
}

function Wait-Url {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [int]$TimeoutSeconds = 45
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return
      }
    } catch {
      Start-Sleep -Milliseconds 300
    }
  }

  throw "Timed out waiting for $Url"
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$port = if ($Mode -eq "preview") { 4173 } else { 4174 }
$url = "http://127.0.0.1:$port/PixelForge/"
if (-not $Session) {
  $Session = "pixelforge-smoke-$Mode"
}

if ($Mode -eq "preview") {
  Log-Line "Running npm run build for preview smoke"
  Push-Location $repoRoot
  try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
      throw "npm run build failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

$serverArgs = if ($Mode -eq "preview") {
  @("run", "preview", "--", "--host", "127.0.0.1", "--port", "$port")
} else {
  @("run", "dev", "--", "--host", "127.0.0.1", "--port", "$port")
}

$server = Start-Process -FilePath "npm.cmd" -ArgumentList $serverArgs -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden

try {
  Log-Line "Started $Mode server on $url (PID $($server.Id))"
  Wait-Url -Url $url -TimeoutSeconds 45
  Log-Line "Server reachable"

  $codePath = Join-Path $PSScriptRoot "pixelforge-smoke.run-code.js"
  $env:PIXELFORGE_SMOKE_URL = $url
  $env:PIXELFORGE_FORCE_SAVE_FALLBACK = if ($NoForceSaveFallback) { "0" } else { "1" }
  Log-Line "Running playwright open for session $Session"

  Push-Location $repoRoot
  try {
    & npx --yes --package @playwright/cli playwright-cli -s $Session open $url 2>&1 | ForEach-Object { Log-Line $_.ToString() }
    if ($LASTEXITCODE -ne 0) {
      throw "playwright-cli open returned exit code $LASTEXITCODE"
    }

    Log-Line "Running playwright smoke script from $codePath"
    $outputLines = & npx --yes --package @playwright/cli playwright-cli -s $Session run-code --filename $codePath 2>&1
    foreach ($line in $outputLines) {
      Log-Line $line.ToString()
    }
    if ($LASTEXITCODE -ne 0) {
      throw "playwright-cli returned exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }

  $marker = "PIXELFORGE_SMOKE_RESULT "
  $resultLine = $outputLines |
    ForEach-Object { $_.ToString().Trim() } |
    Where-Object { $_.StartsWith($marker) } |
    Select-Object -First 1

  if (-not $resultLine) {
    $jsonResultLine = $outputLines |
      ForEach-Object { $_.ToString().Trim() } |
      Where-Object { $_.StartsWith("{") -and $_.Contains('"baseUrl"') -and $_.Contains('"failures"') } |
      Select-Object -First 1

    if (-not $jsonResultLine) {
      throw "Smoke result marker not found in Playwright output."
    }

    $resultJson = $jsonResultLine
  } else {
    $resultJson = $resultLine.Substring($marker.Length)
  }

  $result = $resultJson | ConvertFrom-Json

  $summary = [ordered]@{
    passed = $result.passes.Count
    failed = $result.failures.Count
    consoleErrors = $result.consoleErrors.Count
    url = $result.baseUrl
  }
  Write-Host ""
  Log-Line ("Smoke summary: " + ($summary | ConvertTo-Json -Compress))

  if ($result.failures.Count -gt 0) {
    Log-Line "Smoke failures:"
    foreach ($failure in $result.failures) {
      $detail = $failure.detail | ConvertTo-Json -Compress
      Log-Line ("- " + $failure.step + ": " + $detail)
    }
    exit 1
  }
} finally {
  if ($server) {
    Log-Line "Stopping server PID $($server.Id)"
    try {
      & taskkill /PID $server.Id /T /F | Out-Null
    } catch {
      try {
        Stop-Process -Id $server.Id -Force
      } catch {}
    }
  }
}
