from pathlib import Path
import pandas as pd
from utils import get_db_conn

# 경로 설정
SCRIPT_DIR = Path(__file__).resolve().parent
TSV_PATH = SCRIPT_DIR / "users_data.tsv"

def update_users():
    if not TSV_PATH.exists():
        print(f"[ERROR] TSV 파일을 찾을 수 없습니다: {TSV_PATH}")
        return

    # TSV 로드
    df = pd.read_csv(TSV_PATH, sep='\t', encoding="utf-8")
    print(f"[INFO] TSV에서 {len(df)}건의 사용자 정보를 로드했습니다.")

    if "cj_id" not in df.columns:
        print("[ERROR] CSV 스키마 오류: 'cj_id' 컬럼이 필수입니다.")
        return

    # 업데이트할 컬럼들
    cols = ["name", "part"]
    
    # UPSERT 쿼리 생성
    # cj_id가 PRIMARY KEY 또는 UNIQUE KEY여야 함
    upsert_sql = """
        INSERT INTO users (cj_id, name, part) 
        VALUES (%s, %s, %s)
        ON DUPLICATE KEY UPDATE name=VALUES(name), part=VALUES(part)
    """

    # 데이터 준비
    data = []
    for _, row in df.iterrows():
        data.append((
            row["cj_id"],
            row["name"] if pd.notna(row["name"]) else None,
            row["part"] if pd.notna(row["part"]) else None
        ))

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
    update_users()