const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();
const dbConfig = require('../config/db.config');

// MySQL 연결 풀 생성 (더 안정적)
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

// DB 연결 테스트 페이지
router.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>DB 연결 테스트</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        
        .container {
          background: white;
          border-radius: 10px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          padding: 40px;
          max-width: 600px;
          width: 100%;
        }
        
        h1 {
          color: #333;
          margin-bottom: 30px;
          text-align: center;
          font-size: 28px;
        }
        
        .test-section {
          margin-bottom: 30px;
        }
        
        .test-title {
          font-weight: bold;
          color: #667eea;
          margin-bottom: 15px;
          font-size: 18px;
        }
        
        .button-group {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        
        button {
          flex: 1;
          min-width: 150px;
          padding: 12px 20px;
          border: none;
          border-radius: 5px;
          font-size: 16px;
          cursor: pointer;
          font-weight: bold;
          transition: all 0.3s ease;
        }
        
        .btn-primary {
          background: #667eea;
          color: white;
        }
        
        .btn-primary:hover {
          background: #5568d3;
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        
        .btn-secondary {
          background: #f093fb;
          color: white;
        }
        
        .btn-secondary:hover {
          background: #e083eb;
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(240, 147, 251, 0.4);
        }
        
        #result {
          margin-top: 30px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 5px;
          border-left: 4px solid #667eea;
          min-height: 50px;
          font-size: 14px;
          line-height: 1.6;
          white-space: pre-wrap;
          word-break: break-all;
          max-height: 400px;
          overflow-y: auto;
        }
        
        .status-success {
          color: #27ae60;
          border-left-color: #27ae60;
          background: #f0fdf4;
        }
        
        .status-error {
          color: #e74c3c;
          border-left-color: #e74c3c;
          background: #fef2f2;
        }
        
        .status-loading {
          color: #667eea;
        }
        
        .info-box {
          background: #e7f3ff;
          border-left: 4px solid #2196F3;
          padding: 15px;
          border-radius: 5px;
          margin-bottom: 20px;
          font-size: 14px;
          color: #1565c0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🗄️ DB 연결 테스트</h1>
        
        <div class="info-box">
          <strong>데이터베이스 정보:</strong><br>
          호스트: ${dbConfig.HOST}<br>
          포트: ${dbConfig.port}<br>
          사용자: ${dbConfig.USER}<br>
          데이터베이스: ${dbConfig.DB}
        </div>
        
        <div class="test-section">
          <div class="test-title">연결 테스트</div>
          <div class="button-group">
            <button class="btn-primary" onclick="testConnection()">
              연결 테스트
            </button>
            <button class="btn-secondary" onclick="testQuery()">
              쿼리 테스트
            </button>
          </div>
        </div>
        
        <div class="test-section">
          <div class="test-title">결과</div>
          <div id="result">테스트를 실행해주세요</div>
        </div>
      </div>
      
      <script>
        const resultDiv = document.getElementById('result');
        
        async function testConnection() {
          resultDiv.textContent = '연결 중...';
          resultDiv.className = 'status-loading';
          
          try {
            const response = await fetch('/db-test/connection');
            const data = await response.json();
            
            if (data.success) {
              resultDiv.textContent = '✅ DB 연결 성공!\\n\\n' + 
                '상태: ' + data.message;
              resultDiv.className = 'status-success';
            } else {
              resultDiv.textContent = '❌ DB 연결 실패\\n\\n' + 
                '에러: ' + data.error;
              resultDiv.className = 'status-error';
            }
          } catch (error) {
            resultDiv.textContent = '❌ 요청 실패\\n\\n' + 
              '에러: ' + error.message;
            resultDiv.className = 'status-error';
          }
        }
        
        async function testQuery() {
          resultDiv.textContent = '쿼리 실행 중...';
          resultDiv.className = 'status-loading';
          
          try {
            const response = await fetch('/db-test/query');
            const data = await response.json();
            
            if (data.success) {
              resultDiv.textContent = '✅ 쿼리 실행 성공!\\n\\n' + 
                JSON.stringify(data.data, null, 2);
              resultDiv.className = 'status-success';
            } else {
              resultDiv.textContent = '❌ 쿼리 실행 실패\\n\\n' + 
                '에러: ' + data.error;
              resultDiv.className = 'status-error';
            }
          } catch (error) {
            resultDiv.textContent = '❌ 요청 실패\\n\\n' + 
              '에러: ' + error.message;
            resultDiv.className = 'status-error';
          }
        }
      </script>
    </body>
    </html>
  `);
});

// DB 연결 테스트 API
router.get('/connection', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    
    res.json({
      success: true,
      message: '데이터베이스 연결 완료'
    });
  } catch (err) {
    res.json({
      success: false,
      error: err.message
    });
  }
});

// 쿼리 테스트 API
router.get('/query', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [results] = await connection.query('SELECT 1 AS test, NOW() AS currentTime');
    connection.release();
    
    res.json({
      success: true,
      data: results
    });
  } catch (err) {
    res.json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
