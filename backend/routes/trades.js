var express = require('express');
var router = express.Router();
const mysql = require('mysql2/promise');
const dbConfig = require('../config/db.config');

// MySQL 연결 풀
const pool = mysql.createPool({
  connectionLimit: 10,
  host: dbConfig.host,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  port: dbConfig.port,
  waitForConnections: true,
  enableKeepAlive: true
});

/* GET trades listing - 모든 거래 조회 (자산, 사용자 정보 포함) */
router.get('/', async (req, res, next) => {
  try {
    const connection = await pool.getConnection();
    const [trades] = await connection.query(`
      SELECT 
        t.*,
        a.model,
        u.name,
        u.part,
        u2.name AS ex_user_name,
        u2.part AS ex_user_part
      FROM trde t
      LEFT JOIN assets a ON t.asset_id = a.asset_number
      LEFT JOIN users u ON t.cj_id = u.cj_id
      LEFT JOIN users u2 ON t.ex_user = u2.cj_id
    `);
    connection.release();
    
    res.json({
      success: true,
      data: trades,
      count: trades.length
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/* GET trade by id - ID로 특정 거래 조회 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    const [trade] = await connection.query('SELECT * FROM trde WHERE trade_id = ?', [id]);
    connection.release();
    
    if (trade.length === 0) {
      return res.status(404).json({
        success: false,
        error: '거래를 찾을 수 없습니다.'
      });
    }
    
    res.json({
      success: true,
      data: trade[0]
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/* PUT trade by id - 거래 정보 수정 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const tradeData = req.body;
    
    const connection = await pool.getConnection();
    
    // trade_id, asset_state, asset_in_user는 수정 불가능하므로 제외
    const { trade_id, asset_state, asset_in_user, ...updateData } = tradeData;
    
    if (Object.keys(updateData).length === 0) {
      connection.release();
      return res.status(400).json({
        success: false,
        error: '수정할 데이터가 없습니다.'
      });
    }
    
    // 동적으로 UPDATE 쿼리 생성
    const columns = Object.keys(updateData);
    const values = Object.values(updateData);
    const setClause = columns.map(col => `${col} = ?`).join(', ');
    const query = `UPDATE trde SET ${setClause} WHERE trade_id = ?`;
    values.push(id);
    
    const [result] = await connection.query(query, values);
    connection.release();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: '거래를 찾을 수 없습니다.'
      });
    }
    
    res.json({
      success: true,
      message: '거래 정보가 수정되었습니다.',
      data: { trade_id: id, ...updateData }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/* POST new trades - 거래 목록 등록 */
router.post('/', async (req, res, next) => {
  try {
    const trades = req.body; // 배열로 받음
    console.log('📨 POST /trades 요청:', JSON.stringify(trades, null, 2));
    
    if (!Array.isArray(trades) || trades.length === 0) {
      return res.status(400).json({
        success: false,
        error: '등록할 거래 데이터가 없습니다.'
      });
    }
    
    const connection = await pool.getConnection();
    const results = [];
    
    for (const trade of trades) {
      // trade_id, asset_state, asset_in_user를 제외한 컬럼만 추출 (frontend 검증용 필드)
      const { trade_id, asset_state, asset_in_user, ...insertData } = trade;
      
      console.log(`  거래 처리: work_type=${insertData.work_type}, asset_id=${insertData.asset_id}, cj_id=${insertData.cj_id}`);
      
      if (Object.keys(insertData).length === 0) {
        console.log('  ⊘ 빈 거래 스킵');
        continue;
      }

      // 작업유형별 assets 테이블 업데이트 로직
      const { work_type, asset_id, cj_id } = insertData;
      
      if (work_type && asset_id) {
        console.log(`  ⚙️  자산 업데이트 시작: ${work_type}`);
        try {
          let result;
          switch (work_type) {
            case '이동':
              // assets의 in_user를 선택한 사용자로 변경
              [result] = await connection.query(
                'UPDATE assets SET in_user = ?, state = ? WHERE asset_number = ?',
                [cj_id, 'useable', asset_id]
              );
              console.log(`[이동] asset_id=${asset_id}, in_user=${cj_id}, state=useable, 영향받은 행=${result.affectedRows}`);
              break;

            case '입고':
              // assets의 in_user를 cjenc_inno로 변경
              [result] = await connection.query(
                'UPDATE assets SET in_user = ?, state = ? WHERE asset_number = ?',
                ['cjenc_inno', 'useable', asset_id]
              );
              console.log(`[입고] asset_id=${asset_id}, state=useable, 영향받은 행=${result.affectedRows}`);
              break;

            case '입고(재입사)':
              // 재입사: in_user를 cjenc_inno로, state를 wait로 설정
              [result] = await connection.query(
                'UPDATE assets SET in_user = ?, state = ? WHERE asset_number = ?',
                ['cjenc_inno', 'wait', asset_id]
              );
              console.log(`[입고(재입사)] asset_id=${asset_id}, 영향받은 행=${result.affectedRows}`);
              break;

            case '반납':
              // assets의 in_user를 aj_rent로 변경, state를 termination으로 변경
              [result] = await connection.query(
                'UPDATE assets SET in_user = ?, state = ? WHERE asset_number = ?',
                ['aj_rent', 'termination', asset_id]
              );
              console.log(`[반납] asset_id=${asset_id}, 영향받은 행=${result.affectedRows}`);
              break;

            case '대여':
              // assets의 in_user를 선택한 사용자로 변경, state를 rent로 변경
              // 유효성체크: assets의 in_user가 cjenc_inno, assets의 state가 useable
              console.log(`[대여] asset_id=${asset_id}, cj_id=${cj_id} - 업데이트 시작`);
              [result] = await connection.query(
                'UPDATE assets SET in_user = ?, state = ? WHERE asset_number = ? AND in_user = ? AND state = ?',
                [cj_id, 'rent', asset_id, 'cjenc_inno', 'useable']
              );
              console.log(`[대여] asset_id=${asset_id}, 영향받은 행=${result.affectedRows}`);
              if (result.affectedRows === 0) {
                // 조건을 만족하는 자산이 없으면 확인
                const [asset] = await connection.query('SELECT asset_number, state, in_user FROM assets WHERE asset_number = ?', [asset_id]);
                if (asset.length > 0) {
                  console.warn(`[대여] 조건 불일치: asset=${JSON.stringify(asset[0])}, required: in_user=cjenc_inno, state=useable`);
                }
              }
              break;

            case '수리':
              // assets의 state를 repair로 변경
              [result] = await connection.query(
                'UPDATE assets SET state = ? WHERE asset_number = ?',
                ['repair', asset_id]
              );
              console.log(`[수리] asset_id=${asset_id}, 영향받은 행=${result.affectedRows}`);
              break;

            case '대여반납':
              // assets의 state를 useable로 변경, in_user를 cjenc_inno로 변경
              // 유효성체크: assets의 state가 rent
              [result] = await connection.query(
                'UPDATE assets SET state = ?, in_user = ? WHERE asset_number = ? AND state = ?',
                ['useable', 'cjenc_inno', asset_id, 'rent']
              );
              console.log(`[대여반납] asset_id=${asset_id}, 영향받은 행=${result.affectedRows}`);
              break;

            case '수리반납':
              // assets의 state를 useable로 변경
              // 유효성체크: assets의 state가 repair
              [result] = await connection.query(
                'UPDATE assets SET state = ? WHERE asset_number = ? AND state = ?',
                ['useable', asset_id, 'repair']
              );
              console.log(`[수리반납] asset_id=${asset_id}, 영향받은 행=${result.affectedRows}`);
              break;
          }
        } catch (assetErr) {
          console.error(`[거래] ${work_type} 작업 중 assets 업데이트 실패:`, assetErr.message);
          // assets 업데이트 실패해도 거래 기록은 저장
        }
      }
      
      const columns = Object.keys(insertData);
      const values = Object.values(insertData);
      const placeholders = columns.map(() => '?').join(', ');
      const query = `INSERT INTO trde (${columns.join(', ')}) VALUES (${placeholders})`;
      
      const [result] = await connection.query(query, values);
      results.push({
        trade_id: result.insertId,
        ...insertData
      });
    }
    
    connection.release();
    
    console.log(`✅ 완료: ${results.length}개 거래 등록됨`);
    
    res.json({
      success: true,
      message: `${results.length}개의 거래가 등록되었습니다.`,
      data: results,
      count: results.length
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
