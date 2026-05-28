$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

docker compose down @args

if (Get-Command supabase -ErrorAction SilentlyContinue) {
  Write-Host "Stopping local Supabase…"
  supabase stop
}
