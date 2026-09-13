var createError = require('http-errors');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var assetsRouter = require('./routes/assets');
var tradesRouter = require('./routes/trades');
var selectBarRouter = require('./routes/selectBar');
var assetLogsRouter = require('./routes/assetLogs');
var confirmedAssetsRouter = require('./routes/confirmedAssets');
var confirmedReplacementsRouter = require('./routes/confirmedReplacements');
var returnedAssetsRouter = require('./routes/returnedAssets');
var importRouter = require('./routes/import');
var backupRouter = require('./routes/backup');
var filtersRouter = require('./routes/filters');
var dashboardRouter = require('./routes/dashboard');
var clientErrorsRouter = require('./routes/clientErrors');
var settingsRouter = require('./routes/settings');
const { runBackup, checkAndRunMissingBackup, getTokensFromCode } = require('./utils/googleSheets');
const { initDbSchema } = require('./utils/dbInit');
const cron = require('node-cron');

// 서버 기동 시 스키마 자동 점검 및 보정
initDbSchema();

var app = express();

// 기본 보안 헤더 및 CORS 설정
app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'SAMEORIGIN');
  res.header('X-XSS-Protection', '1; mode=block');

  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }

  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// 프로덕션 환경: Vue 빌드 파일 서빙 (정적 파일 우선)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'dist')));
}

// API 라우터들
app.use('/api/users', usersRouter);
app.use('/api/assets', assetsRouter);
app.use('/api/trades', tradesRouter);
app.use('/api/selectBar', selectBarRouter);
app.use('/api/assetLogs', assetLogsRouter);
app.use('/api/confirmedAssets', confirmedAssetsRouter);
app.use('/api/confirmedReplacements', confirmedReplacementsRouter);
app.use('/api/returned-assets', returnedAssetsRouter);
app.use('/api/import', importRouter);
app.use('/api/backup', backupRouter);
app.use('/api/saved-filters', filtersRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/system-report', clientErrorsRouter);
app.use('/api/settings', settingsRouter);

// OAuth2 Callback 처리
app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('<h2>인증 코드가 누락되었습니다.</h2>');
  }

  try {
    const tokens = await getTokensFromCode(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      return res.send(`
        <div style="font-family: sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #e53e3e;">⚠️ Refresh Token이 발급되지 않았습니다.</h2>
          <p>구글 계정 연결 설정에서 기존 동의를 취소하거나, 재인증 링크를 다시 실행해 보세요.</p>
          <p><strong>Access Token:</strong> <code>${tokens.access_token}</code></p>
        </div>
      `);
    }

    res.send(`
      <div style="font-family: sans-serif; max-width: 600px; margin: 40px auto; padding: 24px; border: 1px solid #48bb78; border-radius: 8px; background: #f0fff4;">
        <h2 style="color: #2f855a; margin-top: 0;">🎉 새로운 Google Refresh Token 발급 성공!</h2>
        <p>아래 <strong>GOOGLE_REFRESH_TOKEN</strong> 값을 사복하여 <code>.env</code> 파일의 해당 항목에 붙여넣어 주세요:</p>
        <div style="background: #2d3748; color: #68d391; padding: 12px; border-radius: 6px; font-family: monospace; word-break: break-all; font-size: 14px;">
          ${refreshToken}
        </div>
        <p style="margin-top: 16px; color: #4a5568; font-size: 13px;">.env 파일 수정 후 <code>docker compose restart app</code> 명령어로 컨테이너를 재시작하면 백업 기능이 즉시 정상 작동합니다.</p>
      </div>
    `);
  } catch (err) {
    console.error('OAuth Callback error:', err);
    res.status(500).send(`<h2>토큰 교환 실패</h2><p>${err.message}</p>`);
  }
});

const pool = require('./utils/db');

// 매일 13:00, 18:00 (KST 기준) 자동 백업 스케줄 등록
cron.schedule('0 13,18 * * *', async () => {
  try {
    const offset = 9 * 60 * 60 * 1000;
    const kstNow = new Date(new Date().getTime() + offset);
    const currentHour = kstNow.getUTCHours();

    // DB에서 자동 백업 활성화 여부 확인
    const [rows] = await pool.query("SELECT s_value FROM settings WHERE s_key = 'auto_backup_enabled'");
    const isEnabled = rows.length > 0 ? rows[0].s_value === 'true' : true;

    if (isEnabled) {
      console.log(`Scheduled Backup: ${currentHour}:00 KST (Enabled)`);
      await runBackup();
    } else {
      console.log(`Scheduled Backup: ${currentHour}:00 KST (Skipped - Disabled in settings)`);
    }
  } catch (err) {
    console.error('Scheduled backup failed:', err);
  }
}, { timezone: 'Asia/Seoul' });

// 서버 기동 후 5초 뒤 최초 1회 즉시 누락 백업 검증 실행
setTimeout(async () => {
  try {
    console.log('[Scheduler] 서버 기동에 따른 누락 백업 검사(최초 1회) 시작...');
    await checkAndRunMissingBackup();
  } catch (err) {
    console.error('[Scheduler] 최초 1회 누락 백업 검증 중 오류:', err);
  }
}, 5000);

// 매 30분마다 누락 백업이 있는지 주기적으로 검사 등록
cron.schedule('*/30 * * * *', async () => {
  try {
    console.log('[Scheduler] 매 30분 주기 누락 백업 검사 시작...');
    await checkAndRunMissingBackup();
  } catch (err) {
    console.error('[Scheduler] 주기적 누락 백업 검사 중 오류:', err);
  }
}, { timezone: 'Asia/Seoul' });

// 개발 환경에서만 Express 기본 라우터 사용
if (process.env.NODE_ENV !== 'production') {
  app.use('/', indexRouter);
}

// 프로덕션 환경: Vue Router용 SPA fallback (모든 라우터 이후)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
}

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
