"""Serve this project from its own folder and open it in the default browser."""

from __future__ import annotations

import argparse
import threading
import webbrowser
from functools import partial
from http.server import ThreadingHTTPServer
from ai_server import SanaHandler, load_env
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the AI Sana Challenge Hub locally.")
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Start the local server without opening a browser (useful for checks).",
    )
    args = parser.parse_args()

    load_env()
    handler = partial(SanaHandler, directory=str(PROJECT_ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    address, port = server.server_address
    url = f"http://{address}:{port}/"

    print(f"AI Sana is serving this project folder: {PROJECT_ROOT}", flush=True)
    print(f"Open: {url}", flush=True)
    print("Press Ctrl+C to stop the server.", flush=True)

    if not args.no_browser:
        threading.Timer(0.6, webbrowser.open_new_tab, args=(url,)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping AI Sana server.", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
