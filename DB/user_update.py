import os
from pathlib import Path

import mysql.connector
import pandas as pd
import sys


def load_env(env_path: Path) -> None:
    """Minimal .env loader to avoid extra dependencies."""
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


PROJECT_ROOT = Path(__file__).resolve().parents[1]
load_env(PROJECT_ROOT / ".env")


def get_db_conn():
    return mysql.connector.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        user=os.environ.get("DB_USER", "root"),
        password=os.environ.get("DB_PASSWORD", ""),
        database=os.environ.get("DB_NAME", "assetdb"),
        port=int(os.environ.get("DB_PORT", 3306)),
    )


# Windows 터미널 한글 깨짐 방지
if os.name == "nt":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# CSV 읽기 (스크립트와 같은 폴더에서 찾음)
SCRIPT_DIR = Path(__file__).resolve().parent
csv_path = SCRIPT_DIR / "users_data.csv"
print(f"[INFO] CSV path: {csv_path}")
if csv_path.exists():
    stat = csv_path.stat()
    print(f"[INFO] CSV modified: {stat.st_mtime}")

if not csv_path.exists():
    print(f"[ERROR] CSV file not found: {csv_path}")
    print(f"[INFO] Create {csv_path} with columns: cj_id, name, part")
    exit(1)

df = pd.read_csv(csv_path, encoding="utf-8")
print(f"[INFO] Loaded {len(df)} user records from CSV")

# MySQL 연결
conn = get_db_conn()
cursor = conn.cursor()

# 기존 사용자 목록 조회 (cj_id -> (name, part))
cursor.execute("SELECT cj_id, name, part FROM users")
existing = {row[0]: (row[1], row[2]) for row in cursor.fetchall()}

# 신규 / 업데이트 대상 분리
new_rows_df = df[~df["cj_id"].isin(existing.keys())]
update_rows_df = df[df["cj_id"].isin(existing.keys())]
update_rows_df = update_rows_df[
    (update_rows_df["cj_id"].apply(lambda x: existing.get(x, (None, None))[0]) != update_rows_df["name"]) |
    (update_rows_df["cj_id"].apply(lambda x: existing.get(x, (None, None))[1]) != update_rows_df["part"])
]

insert_count = 0
update_count = 0

# 신규 삽입
if not new_rows_df.empty:
    insert_sql = """
    INSERT INTO users (cj_id, name, part)
    VALUES (%s, %s, %s)
    """
    new_data = [tuple(row) for row in new_rows_df[["cj_id", "name", "part"]].values]
    cursor.executemany(insert_sql, new_data)
    insert_count = cursor.rowcount
    conn.commit()

# 업데이트 (필요한 행만)
if not update_rows_df.empty:
    update_sql = """
    UPDATE users SET name = %s, part = %s WHERE cj_id = %s
    """
    update_data = [tuple(row) for row in update_rows_df[["name", "part", "cj_id"]].values]
    cursor.executemany(update_sql, update_data)
    update_count = cursor.rowcount
    conn.commit()

print(f"[SUCCESS] Inserted {insert_count} new users, updated {update_count} existing users")

cursor.close()
conn.close()