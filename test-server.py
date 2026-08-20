#!/usr/bin/env python3
"""
Local HTTPS test server for YKW Home Web.
Proxies JS console.log to the terminal for debugging.

Usage:
  python3 test-server.py          # HTTPS on port 8443
  python3 test-server.py --http   # HTTP fallback
"""
import http.server, ssl, os, sys, pathlib, json, argparse, threading

PORT = 8443
DIR = pathlib.Path(__file__).parent
_console_logs = []
_console_lock = threading.Lock()

CERT = DIR / "cert.pem"
KEY  = DIR / "key.pem"

def generate_cert():
    if CERT.exists() and KEY.exists(): return
    print("[setup] Generating self-signed certificate...")
    os.system(f'openssl req -x509 -newkey rsa:2048 -nodes -keyout "{KEY}" -out "{CERT}" -days 365 -subj "/CN=localhost" 2>/dev/null')
    if CERT.exists(): print(f"[setup] Certificate created: {CERT}")
    else:
        print("[setup] WARNING: Could not generate certificate.")
        sys.exit(1)

class CORSHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.js': 'application/javascript', '.mjs': 'application/javascript',
                      '.json': 'application/json', '.css': 'text/css', '.html': 'text/html'}

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Appwrite-Project, X-Appwrite-Key, X-Fallback-Cookies")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        """Handle POST /logs from the frontend to capture console output"""
        if self.path == "/logs":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8") if length else ""
            try:
                data = json.loads(body)
                level = data.get("level", "log")
                args = data.get("args", [])
                msg = " ".join(str(a) for a in args)
                prefix = {"log": "  [JS]", "warn": "  [JS ⚠️]", "error": "  [JS ❌]"}.get(level, "  [JS]")
                print(f"{prefix} {msg}")
            except Exception as e:
                print(f"  [JS] (parse error: {e}) {body[:200]}")
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"ok")
            return
        self.send_response(404)
        self.end_headers()

    def log_message(self, fmt, *args):
        msg = args[0] if args else ""
        if "favicon" in msg: return
        sys.stderr.write(f"  {msg}\n")

# Inject JS that forwards console.log to the server
LOG_INJECT = """<script>
(function(){
  var _orig={log:console.log,warn:console.warn,error:console.error};
  ['log','warn','error'].forEach(function(m){
    console[m]=function(){
      try{
        var a=[];for(var i=0;i<arguments.length;i++){
          var v=arguments[i];a.push(typeof v==='object'?JSON.stringify(v):String(v));
        }
        fetch('/logs',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({level:m,args:a}),keepalive:true});
      }catch(e){}
      _orig[m].apply(console,arguments);
    };
  });
})();
</script>"""

class InjectingHandler(CORSHandler):
    def do_GET(self):
        # Only inject into HTML pages
        if self.path.endswith('/') or self.path.endswith('.html') or self.path == '':
            # Read the original file
            path = self.translate_path(self.path)
            if os.path.isfile(path) and path.endswith('.html'):
                with open(path, 'rb') as f:
                    content = f.read()
                # Inject before </body>
                content = content.replace(b'</body>', (LOG_INJECT + '</body>').encode())
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return
        super().do_GET()

def main():
    parser = argparse.ArgumentParser(description="YKW Home local test server")
    parser.add_argument("--http", action="store_true", help="Plain HTTP")
    parser.add_argument("--port", type=int, default=PORT)
    args = parser.parse_args()
    os.chdir(DIR)
    handler = InjectingHandler

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
║  URL: {scheme}://localhost:{args.port}{' '*(30-len(scheme)-len(str(args.port)))}║
║                                                      ║
║  JS console.log output will appear here:            ║
║  [JS] (messages from cloud.js, app.js, etc.)        ║
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
