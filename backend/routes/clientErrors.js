const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

// DoS 방어용 입력값 길이 제한 함수 (디스크 고갈 방지)
const truncate = (val, maxLen = 2000) => {
  if (typeof val !== 'string') return String(val ?? '');
  return val.length > maxLen ? val.substring(0, maxLen) + '... [TRUNCATED]' : val;
};

router.post('/', async (req, res) => {
  try {
    const { type, message, stack, info, url, userAgent, timestamp, prevValue, newValue, activeElement, triggerContext } = req.body || {};
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

    const logDir = path.join(__dirname, '../logs');
    if (!fsSync.existsSync(logDir)) {
      await fs.mkdir(logDir, { recursive: true });
    }

    const logTime = timestamp ? new Date(timestamp).toLocaleString('ko-KR') : new Date().toLocaleString('ko-KR');

    if (type === 'work-type-change') {
      const logFilePath = path.join(logDir, 'work-type-changes.log');
      const elDesc = activeElement ? `<${truncate(activeElement.tagName, 50)} id="${truncate(activeElement.id, 50)}" name="${truncate(activeElement.name, 50)}" class="${truncate(activeElement.className, 100)}">` : 'None';
      
      const logMessage = `[${logTime}] [IP: ${truncate(ip, 50)}]
URL: ${truncate(url, 200) || 'Unknown'}
User-Agent: ${truncate(userAgent, 300) || 'Unknown'}
이전 값: "${truncate(prevValue, 100)}" ➡️ 변경된 값: "${truncate(newValue, 100)}"
포커스 엘리먼트: ${elDesc}
이벤트 컨텍스트: ${truncate(triggerContext, 200) || 'Unknown'}
----------------------------------------------------------------------\n`;

      await fs.appendFile(logFilePath, logMessage, 'utf8');
    } else {
      const logFilePath = path.join(logDir, 'client-errors.log');
      const logMessage = `[${logTime}] [IP: ${truncate(ip, 50)}]
URL: ${truncate(url, 200) || 'Unknown'}
User-Agent: ${truncate(userAgent, 300) || 'Unknown'}
Info: ${truncate(info, 500) || 'None'}
Message: ${truncate(message, 1000) || 'No message'}
Stack: ${truncate(stack, 2000) || 'No stack'}
----------------------------------------------------------------------\n`;

      await fs.appendFile(logFilePath, logMessage, 'utf8');
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error logging client report:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
