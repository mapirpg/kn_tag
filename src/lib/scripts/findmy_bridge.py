import sys
import json
import asyncio
import os
import socket
from pathlib import Path

# FORÇAR IPv4 (Para resolver o erro de timeout/reset no IPv6)
orig_getaddrinfo = socket.getaddrinfo
def getaddrinfo_ipv4(host, port, family=0, type=0, proto=0, flags=0):
    return orig_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)
socket.getaddrinfo = getaddrinfo_ipv4

from findmy import AsyncAppleAccount, RemoteAnisetteProvider, LoginState

SESSION_FILE = Path("apple_session.json")


def build_auth_error_payload(error_msg):
    if "Account limit reached" in error_msg:
        return {
            "status": "error",
            "message": "⚠️ CONTA BLOQUEADA TEMPORARIAMENTE ⚠️\n\n"
                      "A Apple bloqueou temporariamente novas autenticações para esta conta. "
                      "Isso pode acontecer mesmo na primeira tentativa neste app quando a Apple "
                      "classifica o login como sensível.\n\n"
                      "O que fazer agora:\n"
                      "1) Aguarde 24-48 horas sem tentar novamente\n"
                      "2) Confirme que 2FA está ativo na conta Apple\n"
                      "3) Depois tente novamente com a mesma conta\n"
                      "4) Se precisar testar já, use outra conta Apple"
        }

    if "Password authentication failed" in error_msg or "senha correta" in error_msg.lower():
        return {
            "status": "error",
            "message": "Falha na autenticação. Para este fluxo do Find My, a primeira autenticação deve usar a senha normal da Apple ID com 2FA ativo. Senha de aplicativo geralmente falha aqui. Verifique se o 2FA está ativo, use a senha normal da conta e informe o código de 6 dígitos quando solicitado."
        }

    return None

async def login_and_save(account, apple_id, password):
    if not password or password.strip() == "":
        print(json.dumps({"status": "error", "message": "APPLE_PASSWORD está vazio no arquivo .env. Configure a senha normal da Apple ID para o primeiro login e conclua o 2FA quando solicitado."}))
        return False
    
    # Normaliza a senha removendo hífens e espaços acidentais.
    clean_password = password.replace("-", "").strip()
    
    print(f"[DEBUG] Tentando login para: {apple_id}")
    print(f"[DEBUG] Senha formatada: {len(clean_password)} caracteres")
    
    try:
        state = await account.login(apple_id, clean_password)
    except Exception as e:
        error_msg = str(e)
        print(f"[DEBUG] Erro detalhado: {error_msg}")
        handled_error = build_auth_error_payload(error_msg)
        if handled_error:
            print(json.dumps(handled_error))
            return False
        raise
    
    while state == LoginState.REQUIRE_2FA:
        methods = await account.get_2fa_methods()
        if not methods:
            print("[ERROR] Nenhum método de 2FA disponível.")
            return False
            
        # Pega o primeiro método automaticamente (geralmente SMS ou Trusted Device)
        method = methods[0]
        m_type = "Dispositivo Confiável" if "TrustedDevice" in str(type(method)) else "SMS"
        
        print(f"\n[APPLE 2FA] Solicitando código via {m_type}...")
        # Nota: O findmy às vezes já dispara o SMS no login. 
        # Vamos tentar disparar apenas se necessário ou lidar com a exceção se já tiver sido enviado.
        try:
            await method.request()
        except Exception as e:
            handled_error = build_auth_error_payload(str(e))
            if handled_error:
                print(json.dumps(handled_error))
                return False
            # Se já foi enviado, apenas ignoramos o erro e pedimos o código
            if "already sent" not in str(e).lower():
                print(f"[DEBUG] Info sobre request: {e}")
        
        code = input("\nDigite o código de 6 dígitos recebido: ").strip()
        try:
            state = await method.submit(code)
        except Exception as e:
            handled_error = build_auth_error_payload(str(e))
            if handled_error:
                print(json.dumps(handled_error))
                return False
            raise
        print(f"Estado após envio: {state}")

    if state in (LoginState.LOGGED_IN, LoginState.AUTHENTICATED):
        print(f"\n[SUCCESS] Login realizado! Estado: {state}")
        print(f"Salvando sessão em {SESSION_FILE}")
        account.to_json(SESSION_FILE)
        return True
    else:
        print(f"\n[ERROR] Falha no login. Estado atual: {state}")
        return False

async def fetch_reports(apple_id, password, anisette_url, hashed_public_key):
    account = None
    try:
        anisette = RemoteAnisetteProvider(anisette_url)
        
        if SESSION_FILE.exists():
            try:
                account = AsyncAppleAccount.from_json(SESSION_FILE, anisette)
                if account.login_state not in (LoginState.LOGGED_IN, LoginState.AUTHENTICATED):
                    print("[INFO] Sessão inválida. Novo login...")
                    if not await login_and_save(account, apple_id, password):
                        return
            except Exception as e:
                print(f"[WARNING] Erro ao carregar sessão: {e}")
                account = AsyncAppleAccount(anisette)
                if not await login_and_save(account, apple_id, password):
                    return
        else:
            account = AsyncAppleAccount(anisette)
            if not await login_and_save(account, apple_id, password):
                return
        
        # Structure for fetch_raw_reports
        devices = [([hashed_public_key], [])]
        reports = await account.fetch_raw_reports(devices)
        
        results = []
        for report in reports:
            results.append({
                "payload": report.payload.hex() if hasattr(report.payload, 'hex') else str(report.payload),
                "timestamp": report.timestamp.isoformat() if hasattr(report.timestamp, 'isoformat') else str(report.timestamp),
                "latitude": report.latitude if hasattr(report, 'latitude') else None,
                "longitude": report.longitude if hasattr(report, 'longitude') else None,
                "accuracy": report.accuracy if hasattr(report, 'accuracy') else (report.horizontal_accuracy if hasattr(report, 'horizontal_accuracy') else None)
            })
            
        print("---JSON_START---")
        print(json.dumps({"status": "success", "reports": results}))
        
    except Exception as e:
        handled_error = build_auth_error_payload(str(e))
        print("---JSON_START---")
        if handled_error:
            print(json.dumps(handled_error))
        else:
            print(json.dumps({"status": "error", "message": str(e)}))
    finally:
        if account:
            await account.close()

if __name__ == "__main__":
    if len(sys.argv) < 5:
        print(json.dumps({"status": "error", "message": "Usage: findmy_bridge.py <apple_id> <password> <anisette_url> <hashed_public_key>"}))
        sys.exit(1)
        
    asyncio.run(fetch_reports(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]))
