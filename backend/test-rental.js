const mysql = require('mysql2/promise');
const dbConfig = require('./config/db.config');

async function testRental() {
  const conn = await mysql.createConnection(dbConfig);
  
  try {
    // 1. 대여 가능한 자산 찾기
    console.log('1️⃣  대여 가능한 자산 찾기...');
    const [rentableAssets] = await conn.query(
      'SELECT asset_number, state, in_user, model FROM assets WHERE in_user = ? AND state = ? LIMIT 1',
      ['cjenc_inno', 'useable']
    );
    
    if (rentableAssets.length === 0) {
      console.log('❌ 대여 가능한 자산이 없습니다');
      return;
    }
    
    const asset = rentableAssets[0];
    console.log(`✅ 대여 가능한 자산 찾음:`, asset);
    
    // 2. 대여 거래 기록 삽입
    console.log('\n2️⃣  대여 거래 기록 삽입...');
    const [tradeResult] = await conn.query(
      'INSERT INTO trde (work_type, asset_id, cj_id, memo) VALUES (?, ?, ?, ?)',
      ['대여', asset.asset_number, 'rokmcssh', '테스트 대여']
    );
    console.log(`✅ 거래 기록 삽입됨 (trade_id=${tradeResult.insertId})`);
    
    // 3. 자산 상태 업데이트 (대여)
    console.log('\n3️⃣  자산 상태 업데이트 (대여)...');
    const [updateResult] = await conn.query(
      'UPDATE assets SET in_user = ?, state = ? WHERE asset_number = ? AND in_user = ? AND state = ?',
      ['rokmcssh', 'rent', asset.asset_number, 'cjenc_inno', 'useable']
    );
    console.log(`✅ 업데이트 완료 (영향받은 행=${updateResult.affectedRows})`);
    
    // 4. 업데이트 후 자산 상태 확인
    console.log('\n4️⃣  업데이트 후 자산 상태 확인...');
    const [updatedAsset] = await conn.query(
      'SELECT asset_number, state, in_user, model FROM assets WHERE asset_number = ?',
      [asset.asset_number]
    );
    
    if (updatedAsset.length > 0) {
      console.log(`✅ 최종 자산 상태:`, updatedAsset[0]);
      
      if (updatedAsset[0].state === 'rent' && updatedAsset[0].in_user === 'rokmcssh') {
        console.log('\n✅✅✅ 대여 성공! state가 "rent"로 변경되었습니다!');
      } else {
        console.log('\n❌ 자산 상태 업데이트 실패');
        console.log(`   - 예상: state="rent", in_user="rokmcssh"`);
        console.log(`   - 실제: state="${updatedAsset[0].state}", in_user="${updatedAsset[0].in_user}"`);
      }
    }
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
  } finally {
    conn.end();
  }
}

testRental();
