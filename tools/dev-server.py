#!/usr/bin/env python3
"""Static file server for local play-testing that disables browser caching."""
import functools, http.server, os, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()
    def log_message(self, *args):
        pass

port = int(sys.argv[1]) if len(sys.argv) > 1 else 5391
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
handler = functools.partial(NoCache, directory=root)
http.server.ThreadingHTTPServer(('127.0.0.1', port), handler).serve_forever()
