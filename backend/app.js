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
var returnedAssetsRouter = require('./routes/returnedAssets');
var importRouter = require('./routes/import');
var backupRouter = require('./routes/backup');
const { runBackup } = require('./utils/googleSheets');
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
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
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
app.use('/api/returned-assets', returnedAssetsRouter);
app.use('/api/import', importRouter);
app.use('/api/backup', backupRouter);
app.use('/db-test', dbTestRouter);

// 매일 13:00 자동 백업 스케줄 등록 (환경변수 설정 시에만 실행)
if (process.env.ENABLE_BACKUP_SCHEDULER === 'true') {
  cron.schedule('0 13 * * *', () => {
    console.log('Scheduled Backup: 13:00');
    runBackup().catch(err => console.error('Scheduled backup failed:', err));
  });
} else {
  console.log('Backup scheduler is disabled (ENABLE_BACKUP_SCHEDULER != true)');
}

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
