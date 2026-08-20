#!/usr/bin/env python3
"""
Local HTTPS test server for YKW Home Web.

HTTPS is required because:
1. Appwrite sets Secure cookies — they only work over HTTPS
2. Service Workers (if added later) require HTTPS
3. Matches production (GitHub Pages is HTTPS)

Usage:
  python3 test-server.py          # starts on https://localhost:8443
  python3 test-server.py --http   # plain HTTP fallback (no secure cookies)

The first run auto-generates a self-signed certificate.
Browsers will warn — click "Advanced → Proceed to localhost" to continue.
"""
import http.server, ssl, os, sys, pathlib, argparse

PORT = 8443
DIR = pathlib.Path(__file__).parent

# ── Generate self-signed cert if missing ──────────────────────
CERT = DIR / "cert.pem"
KEY  = DIR / "key.pem"

def generate_cert():
    if CERT.exists() and KEY.exists():
        return
    print("[setup] Generating self-signed certificate...")
    os.system(
        f'openssl req -x509 -newkey rsa:2048 -nodes '
        f'-keyout "{KEY}" -out "{CERT}" '
        f'-days 365 -subj "/CN=localhost" 2>/dev/null'
    )
    if CERT.exists():
        print(f"[setup] Certificate created: {CERT}")
    else:
        print("[setup] WARNING: Could not generate certificate.")
        print("[setup] Install openssl or use --http flag.")
        sys.exit(1)

# ── CORS headers for Appwrite ────────────────────────────────
class CORSHandler(http.server.SimpleHTTPRequestHandler):
    """Serves files with CORS headers and proper MIME types."""

    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'application/javascript',
        '.mjs': 'application/javascript',
        '.json': 'application/json',
        '.css': 'text/css',
        '.html': 'text/html',
    }

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Appwrite-Project, X-Appwrite-Key, X-Fallback-Cookies, X-Appwrite-Locale")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def log_message(self, fmt, *args):
        # Cleaner logging
        sys.stderr.write(f"  {args[0]}\n")

# ── Main ──────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="YKW Home local test server")
    parser.add_argument("--http", action="store_true", help="Use plain HTTP (no HTTPS)")
    parser.add_argument("--port", type=int, default=PORT, help=f"Port (default {PORT})")
    args = parser.parse_args()

    os.chdir(DIR)
    handler = CORSHandler

    if args.http:
        server = http.server.HTTPServer(("0.0.0.0", args.port), handler)
        scheme = "http"
    else:
        generate_cert()
        server = http.server.HTTPServer(("0.0.0.0", args.port), handler)
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(CERT, KEY)
        server.socket = ctx.wrap_socket(server.socket, server_side=True)
        scheme = "https"

    print(f"""
╔══════════════════════════════════════════════════════╗
║  YKW Home — Local Test Server                       ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  URL: {scheme}://localhost:{args.port}{' '*(30-len(scheme)-len(str(args.port)))}║
║                                                      ║
║  First run? Add these to Appwrite Console:           ║
║    Settings → Platforms → Add Platform → Web         ║
║    Hostname: localhost                               ║
║                                                      ║
║  Discord OAuth redirect URI must include:             ║
║    {scheme}://localhost:{args.port}/{' '*(30-len(scheme)-len(str(args.port))-1)}║
║                                                      ║
║  Press Ctrl+C to stop.                               ║
╚══════════════════════════════════════════════════════╝
""")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[server] Stopped.")
        server.server_close()

if __name__ == "__main__":
    main()
