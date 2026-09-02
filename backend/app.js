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
var dbTestRouter = require('./routes/db-test');
var confirmedAssetsRouter = require('./routes/confirmedAssets');
var confirmedReplacementsRouter = require('./routes/confirmedReplacements');
var returnedAssetsRouter = require('./routes/returnedAssets');
var importRouter = require('./routes/import');
var backupRouter = require('./routes/backup');
var filtersRouter = require('./routes/filters');
var dashboardRouter = require('./routes/dashboard');
var clientErrorsRouter = require('./routes/clientErrors');
const { runBackup, checkAndRunMissingBackup } = require('./utils/googleSheets');
const cron = require('node-cron');

var app = express();

// CORS 설정
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: false }));
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
app.use('/db-test', dbTestRouter);

const pool = require('./utils/db');

// 매일 13:00, 18:00 자동 백업 스케줄 등록
cron.schedule('0 13,18 * * *', async () => {
  try {
    const now = new Date();
    const currentHour = now.getHours();

    // DB에서 자동 백업 활성화 여부 확인
    const [rows] = await pool.query("SELECT s_value FROM settings WHERE s_key = 'auto_backup_enabled'");
    const isEnabled = rows.length > 0 ? rows[0].s_value === 'true' : true;

    if (isEnabled) {
      console.log(`Scheduled Backup: ${currentHour}:00 (Enabled)`);
      await runBackup();
    } else {
      console.log(`Scheduled Backup: ${currentHour}:00 (Skipped - Disabled in settings)`);
    }
  } catch (err) {
    console.error('Scheduled backup failed:', err);
  }
});

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
});

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
