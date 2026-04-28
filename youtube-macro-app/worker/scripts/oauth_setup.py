"""
One-time Google Drive OAuth setup.

Usage:
  python scripts/oauth_setup.py

Reads GOOGLE_OAUTH_CLIENT_SECRETS and GOOGLE_TOKEN_PATH from .env
(or the environment), opens a browser for consent, and writes the
resulting token to GOOGLE_TOKEN_PATH.
"""
import sys
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow

from movie_shorts_worker.config import load_config
from movie_shorts_worker.drive import SCOPES


def main() -> int:
    cfg = load_config()
    if not cfg.google_oauth_client_secrets.exists():
        print(f"client_secret not found at {cfg.google_oauth_client_secrets}", file=sys.stderr)
        print(
            "Download the OAuth client_secret JSON from Google Cloud Console "
            "(APIs & Services → Credentials → OAuth 2.0 Client IDs → Desktop app) "
            "and place it at the path above.",
            file=sys.stderr,
        )
        return 2
    flow = InstalledAppFlow.from_client_secrets_file(
        str(cfg.google_oauth_client_secrets), SCOPES
    )
    creds = flow.run_local_server(port=0)
    cfg.google_token_path.parent.mkdir(parents=True, exist_ok=True)
    cfg.google_token_path.write_text(creds.to_json())
    cfg.google_token_path.chmod(0o600)
    print(f"Token saved to {cfg.google_token_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
