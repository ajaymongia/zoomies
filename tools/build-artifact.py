#!/usr/bin/env python3
"""Builds dist/index.html for publishing as a claude.ai Artifact.

The Artifact host wraps the page in its own <!doctype>/<head>/<body> skeleton (with charset and
viewport tags), so this strips those wrappers from index.html and keeps everything else as-is.
CSS and JS stay as separate files and are published alongside the page."""
import os, re

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(root, 'index.html'), encoding='utf-8').read()

drop = [
    r'<!doctype html>\s*', r'<html[^>]*>\s*', r'</html>\s*', r'<head>\s*', r'</head>\s*',
    r'<body>\s*', r'</body>\s*', r'<meta charset[^>]*>\s*', r'<meta name="viewport"[^>]*>\s*',
    r'<meta name="theme-color"[^>]*>\s*', r'<link rel="icon"[^>]*>\s*',
]
out = src
for pat in drop:
    out = re.sub(pat, '', out, flags=re.I)

os.makedirs(os.path.join(root, 'dist'), exist_ok=True)
dest = os.path.join(root, 'dist', 'index.html')
open(dest, 'w', encoding='utf-8').write(out)
print('wrote', os.path.relpath(dest, root), len(out), 'bytes')
