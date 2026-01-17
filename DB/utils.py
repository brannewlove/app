import os
import sys
from pathlib import Path
import mysql.connector

def load_env():
    """Load .env file from project root."""
    project_root = Path(__file__).resolve().parents[1]
    env_path = project_root / ".env"
    
    if not env_path.is_file():
        return
        
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())

def get_db_conn():
    """Get MySQL connection using environment variables."""
    return mysql.connector.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        user=os.environ.get("DB_USER", "root"),
        password=os.environ.get("DB_PASSWORD", ""),
        database=os.environ.get("DB_NAME", "assetdb"),
        port=int(os.environ.get("DB_PORT", 3306)),
    )

def setup_terminal():
    """Setup terminal encoding for Windows to prevent Korean character corruption."""
    if os.name == "nt":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

load_env()
setup_terminal()
