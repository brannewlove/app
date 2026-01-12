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
csv_path = SCRIPT_DIR / "assets_data.csv"
print(f"[INFO] CSV path: {csv_path}")
if csv_path.exists():
    stat = csv_path.stat()
    print(f"[INFO] CSV modified: {stat.st_mtime}")

if not csv_path.exists():
    print(f"[ERROR] CSV file not found: {csv_path}")
    print(f"[INFO] Create {csv_path} with columns: asset_number, category, model, serial_number, day_of_start, day_of_end, unit_price, contract_month, in_user, state")
    exit(1)

df = pd.read_csv(csv_path, encoding="utf-8")
print(f"[INFO] Loaded {len(df)} asset records from CSV")

# CSV에 있는 컬럼 확인 (asset_number는 필수)
if "asset_number" not in df.columns:
    print("[ERROR] CSV must have 'asset_number' column")
    exit(1)

csv_columns = [col for col in df.columns if col != "asset_number"]
print(f"[INFO] CSV columns to update: {', '.join(csv_columns)}")

# MySQL 연결
conn = get_db_conn()
cursor = conn.cursor()

# 기존 자산 목록 조회 (CSV에 있는 컬럼만, asset_number가 있는 행만)
if csv_columns:
    select_cols = ", ".join(csv_columns)
    cursor.execute(f"SELECT asset_number, {select_cols} FROM assets WHERE asset_number IS NOT NULL")
else:
    cursor.execute("SELECT asset_number FROM assets WHERE asset_number IS NOT NULL")

existing = {}
for row in cursor.fetchall():
    # asset_number는 str로 변환 (CSV와 타입 일치)
    asset_number = str(row[0])
    existing[asset_number] = row[1:] if len(row) > 1 else ()

# CSV의 asset_number도 str로 변환
df["asset_number"] = df["asset_number"].astype(str)

# 신규 / 업데이트 대상 분리
new_rows_df = df[~df["asset_number"].isin(existing.keys())]
update_rows_df = df[df["asset_number"].isin(existing.keys())]

# 업데이트가 필요한 행만 필터링
def needs_update(row):
    asset_number = row["asset_number"]
    if asset_number not in existing:
        return False
    
    old_values = existing[asset_number]
    new_values = tuple(row.get(col) for col in csv_columns)
    
    for old, new in zip(old_values, new_values):
        old_val = old if old is not None else ""
        new_val = new if pd.notna(new) else ""
        if str(old_val) != str(new_val):
            return True
    return False

if not update_rows_df.empty:
    update_rows_df = update_rows_df[update_rows_df.apply(needs_update, axis=1)]

insert_count = 0
update_count = 0

# 신규 삽입
if not new_rows_df.empty:
    insert_cols = ", ".join(["asset_number"] + csv_columns)
    placeholders = ", ".join(["%s"] * (len(csv_columns) + 1))
    insert_sql = f"INSERT INTO assets ({insert_cols}) VALUES ({placeholders})"
    
    new_data = []
    for _, row in new_rows_df.iterrows():
        values = [row["asset_number"]]
        for col in csv_columns:
            val = row.get(col)
            values.append(val if pd.notna(val) else None)
        new_data.append(tuple(values))
    
    cursor.executemany(insert_sql, new_data)
    insert_count = cursor.rowcount
    conn.commit()

# 업데이트 (필요한 행만)
if not update_rows_df.empty:
    set_clause = ", ".join([f"{col} = %s" for col in csv_columns])
    update_sql = f"UPDATE assets SET {set_clause} WHERE asset_number = %s"
    
    update_data = []
    for _, row in update_rows_df.iterrows():
        values = []
        for col in csv_columns:
            val = row.get(col)
            values.append(val if pd.notna(val) else None)
        values.append(row["asset_number"])
        update_data.append(tuple(values))
    
    cursor.executemany(update_sql, update_data)
    update_count = cursor.rowcount
    conn.commit()

print(f"[SUCCESS] Inserted {insert_count} new assets, updated {update_count} existing assets")

cursor.close()
conn.close()
