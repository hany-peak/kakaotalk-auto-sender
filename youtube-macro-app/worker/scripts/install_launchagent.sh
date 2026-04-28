#!/usr/bin/env bash
# Install a LaunchAgent so movie-shorts-worker starts at login.
set -euo pipefail

PLIST="$HOME/Library/LaunchAgents/com.movie-shorts.worker.plist"
WORKER_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
PYTHON="$WORKER_DIR/.venv/bin/python"

if [[ ! -x "$PYTHON" ]]; then
  echo "Expected venv python at $PYTHON. Create the venv first:"
  echo "  cd $WORKER_DIR && python -m venv .venv && source .venv/bin/activate && pip install -e ."
  exit 1
fi

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>com.movie-shorts.worker</string>
    <key>ProgramArguments</key>
    <array>
        <string>$PYTHON</string>
        <string>-m</string>
        <string>movie_shorts_worker.menubar</string>
    </array>
    <key>WorkingDirectory</key><string>$WORKER_DIR</string>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key><string>$HOME/Library/Logs/movie-shorts-worker/launchd.out.log</string>
    <key>StandardErrorPath</key><string>$HOME/Library/Logs/movie-shorts-worker/launchd.err.log</string>
</dict>
</plist>
EOF

mkdir -p "$HOME/Library/Logs/movie-shorts-worker"
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "Installed: $PLIST"
echo "To uninstall:  launchctl unload \"$PLIST\" && rm \"$PLIST\""
