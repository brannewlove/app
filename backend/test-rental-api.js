const mysql = require('mysql2/promise');
const http = require('http');
const dbConfig = require('./config/db.config');

async function testRentalViaAPI() {
  const conn = await mysql.createConnection(dbConfig);
  
  try {
    // 1. 대여 가능한 자산 찾기
    console.log('📌 Step 1: 대여 가능한 자산 찾기...');
    const [rentableAssets] = await conn.query(
      'SELECT asset_number, state, in_user FROM assets WHERE in_user = ? AND state = ? LIMIT 1',
      ['cjenc_inno', 'useable']
    );
    
    if (rentableAssets.length === 0) {
      console.log('❌ 대여 가능한 자산이 없습니다');
      return;
    }
    
    const assetNumber = rentableAssets[0].asset_number;
    console.log(`✅ 자산 찾음: ${assetNumber}`);
    
    // 2. POST /trades API 호출 (대여 거래 등록)
    console.log('\n📌 Step 2: POST /trades로 대여 거래 등록...');
    const tradeData = [{
      work_type: '대여',
      asset_id: assetNumber,
      cj_id: 'rokmcssh',
      memo: '자동 테스트',
      asset_state: 'useable',  // frontend 검증용
      asset_in_user: 'cjenc_inno'  // frontend 검증용
    }];
    
    const body = JSON.stringify(tradeData);
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/trades',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const postPromise = new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, body: data });
          }
        });
      });

      req.on('error', (err) => {
        console.error('HTTP Request Error:', err.message);
        reject(err);
      });
      req.write(body);
      req.end();
    });

    const response = await postPromise;
    console.log('Response status:', response.status);
    console.log('Response body:', response.body);
    
    // 3. 자산 상태 확인
    console.log('\n📌 Step 3: 자산 상태 확인...');
    const [updatedAsset] = await conn.query(
      'SELECT asset_number, state, in_user FROM assets WHERE asset_number = ?',
      [assetNumber]
    );
    
    if (updatedAsset.length > 0) {
      const asset = updatedAsset[0];
      console.log(`현재 자산 상태:`, asset);
      
      if (asset.state === 'rent') {
        console.log('\n✅✅✅ 성공! state가 "rent"로 변경됨');
      } else {
        console.log(`\n❌ 실패! state는 "${asset.state}" (예상: "rent")`);
      }
    }
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
  } finally {
    conn.end();
  }
}

testRentalViaAPI();
