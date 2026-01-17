from pathlib import Path
import pandas as pd
from utils import get_db_conn

# 경로 설정
SCRIPT_DIR = Path(__file__).resolve().parent
TSV_PATH = SCRIPT_DIR / "assets_data.tsv"

def update_assets():
    if not TSV_PATH.exists():
        print(f"[ERROR] TSV 파일을 찾을 수 없습니다: {TSV_PATH}")
        return

    # TSV 로드
    df = pd.read_csv(TSV_PATH, sep='\t', encoding="utf-8")
    print(f"[INFO] TSV에서 {len(df)}건의 자산 정보를 로드했습니다.")

    if "asset_number" not in df.columns:
        print("[ERROR] CSV 스키마 오류: 'asset_number' 컬럼이 필수입니다.")
        return

    # 업데이트할 컬럼들 추출
    cols = [col for col in df.columns if col != "asset_number"]
    
    # UPSERT 쿼리 생성
    # INSERT INTO assets (col1, col2, ...) VALUES (%s, %s, ...)
    # ON DUPLICATE KEY UPDATE col1=VALUES(col1), col2=VALUES(col2), ...
    columns_clause = ", ".join(["asset_number"] + cols)
    placeholders = ", ".join(["%s"] * len(df.columns))
    update_clause = ", ".join([f"{col}=VALUES({col})" for col in cols])
    
    upsert_sql = f"""
        INSERT INTO assets ({columns_clause}) 
        VALUES ({placeholders})
        ON DUPLICATE KEY UPDATE {update_clause}
    """

    # 데이터 준비 (NaN 처리)
    data = []
    for _, row in df.iterrows():
        row_values = []
        for col in ["asset_number"] + cols:
            val = row[col]
            row_values.append(val if pd.notna(val) else None)
        data.append(tuple(row_values))

    # DB 실행
    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        cursor.executemany(upsert_sql, data)
        conn.commit()
        print(f"[SUCCESS] 처리 완료 (추가/수정 포함 총 {cursor.rowcount}행 영향 받음)")
    except Exception as e:
        conn.rollback()
        print(f"[ERROR] DB 업데이트 중 오류 발생: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    update_assets()
