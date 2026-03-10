if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

PYTHON_CMD=".venv/Scripts/python.exe"

# Se não existe venv ou python no Windows, tenta python3/python
if [ ! -f "$PYTHON_CMD" ]; then
    PYTHON_CMD="python"
    if ! command -v $PYTHON_CMD &> /dev/null; then
        PYTHON_CMD="python3"
    fi
fi

echo "----------------------------------------------------"
echo "Iniciando Teste de Login Apple (FindMy Bridge)"
echo "ID: $APPLE_ID"
echo "Anisette: $ANISETTE_SERVER_URL"
echo "Python: $PYTHON_CMD"
echo "----------------------------------------------------"

# Chama o script Python com as variáveis de ambiente
$PYTHON_CMD src/lib/scripts/findmy_bridge.py "$APPLE_ID" "$APPLE_PASSWORD" "$ANISETTE_SERVER_URL" "$DEFAULT_HASH"