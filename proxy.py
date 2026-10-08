#! /opt/homebrew/bin/python3
"""Pear Desktop Remote Proxy Server.
Serves static web assets and cleanly proxies API/Auth requests to Pear Desktop.
"""

import http.server
import urllib.error
import urllib.request

PORT = 8080
API_PORT = 26538


class ProxyHandler(http.server.SimpleHTTPRequestHandler):
  """HTTP request handler for static files and API/Auth proxy routing."""

  def do_GET(self):
    if self._is_proxied_route():
      self._handle_proxy()
    else:
      super().do_GET()

  def do_POST(self):
    self._route_or_error()

  def do_PATCH(self):
    self._route_or_error()

  def do_DELETE(self):
    self._route_or_error()

  def _is_proxied_route(self) -> bool:
    """Checks if the current request path should be proxied to the API."""
    return self.path.startswith(("/api/", "/auth/"))

  def _route_or_error(self):
    """Proxies allowed mutation methods or returns 405 Method Not Allowed."""
    if self._is_proxied_route():
      self._handle_proxy()
    else:
      self.send_error(405, "Method Not Allowed")

  def _handle_proxy(self):
    """Forwards incoming requests to the local Pear Desktop API server."""
    target_url = f"http://127.0.0.1:{API_PORT}{self.path}"

    try:
      content_length = int(self.headers.get("Content-Length", 0))
      request_data = (
        self.rfile.read(content_length) if content_length > 0 else None
      )

      # Filter out original host header to prevent proxy conflict
      filtered_headers = {
        key: val for key, val in self.headers.items() if key.lower() != "host"
      }

      req = urllib.request.Request(
        target_url,
        data=request_data,
        headers=filtered_headers,
        method=self.command,
      )

      with urllib.request.urlopen(req) as resp:
        self.send_response(resp.status)
        for key, val in resp.headers.items():
          if key.lower() not in ["transfer-encoding", "content-encoding"]:
            self.send_header(key, val)
        self.end_headers()
        self.wfile.write(resp.read())

    except urllib.error.HTTPError as e:
        self.send_response(e.code)
        for key, val in e.headers.items():
          if key.lower() not in ["transfer-encoding", "content-encoding"]:
            self.send_header(key, val)
        self.end_headers()
        self.wfile.write(e.read())
    except Exception as e:
      self.send_error(502, f"Bad Gateway: {e}")

  def log_message(self, format, *args):
    """Suppresses default HTTP request logs to keep terminal output clean."""


def run_server():
  server_address = ("localhost", PORT)
  httpd = http.server.HTTPServer(server_address, ProxyHandler)
  try:
    httpd.serve_forever()
  except KeyboardInterrupt:
    pass
  finally:
    httpd.server_close()


if __name__ == "__main__":
  run_server()