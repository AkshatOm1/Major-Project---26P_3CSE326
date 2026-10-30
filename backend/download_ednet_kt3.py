"""Download the official EdNet-KT3 archive from Riiid's published Drive link."""

import os
import re
import time
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path


FILE_ID = "1TVyGIWU1Mn3UCjjeD6bcZ57YspByUV7-"
TARGET = Path(__file__).parent / "data" / "ednet" / "ednet-kt3.zip"


def request(url, headers=None):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", **(headers or {})})
    return urllib.request.urlopen(req, timeout=60)


def get_download_url():
    query = urllib.parse.urlencode({"export": "download", "id": FILE_ID})
    with request(f"https://drive.google.com/uc?{query}") as response:
        content_type = response.headers.get("Content-Type", "")
        if "text/html" not in content_type:
            return response.geturl()
        page = response.read(64 * 1024).decode("utf-8", "replace")

    params = {}
    for name in ("confirm", "uuid"):
        match = re.search(rf'name="{name}"\s+value="([^"]+)"', page)
        if match:
            params[name] = match.group(1)
    params.update({"id": FILE_ID, "export": "download"})
    return "https://drive.usercontent.google.com/download?" + urllib.parse.urlencode(params)


def main():
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    partial = TARGET.with_suffix(TARGET.suffix + ".part")
    offset = partial.stat().st_size if partial.exists() else 0
    headers = {"Range": f"bytes={offset}-"} if offset else {}

    with request(get_download_url(), headers=headers) as response:
        if offset and response.status != 206:
            offset = 0
        total = int(response.headers.get("Content-Length") or 0) + offset
        mode = "ab" if offset else "wb"
        downloaded = offset
        last_report = time.monotonic()
        with partial.open(mode) as output:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                output.write(chunk)
                downloaded += len(chunk)
                if time.monotonic() - last_report >= 3:
                    if total:
                        print(f"Downloaded {downloaded / (1024**2):.0f}/{total / (1024**2):.0f} MiB", flush=True)
                    else:
                        print(f"Downloaded {downloaded / (1024**2):.0f} MiB", flush=True)
                    last_report = time.monotonic()

    if not zipfile.is_zipfile(partial):
        raise RuntimeError(f"Download is incomplete or not a ZIP archive. Partial file kept at {partial}")
    os.replace(partial, TARGET)
    print(f"Verified archive saved to {TARGET} ({TARGET.stat().st_size / (1024**2):.1f} MiB)")


if __name__ == "__main__":
    main()
