# Carrega variáveis do .env
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.+)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim('"')
        [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
}

$APPLE_ID = $env:APPLE_ID
$APPLE_PASSWORD = $env:APPLE_PASSWORD
$ANISETTE_URL = $env:ANISETTE_SERVER_URL
$DEFAULT_HASH = $env:DEFAULT_HASH

Write-Host "----------------------------------------------------" -ForegroundColor Cyan
Write-Host "Iniciando Teste de Login Apple (FindMy Bridge)" -ForegroundColor Cyan
Write-Host "ID: $APPLE_ID" -ForegroundColor Yellow
Write-Host "Anisette: $ANISETTE_URL" -ForegroundColor Yellow
Write-Host "----------------------------------------------------" -ForegroundColor Cyan
Write-Host ""

# Executa o script Python
& ".venv/Scripts/python.exe" "src/lib/scripts/findmy_bridge.py" $APPLE_ID $APPLE_PASSWORD $ANISETTE_URL $DEFAULT_HASH
