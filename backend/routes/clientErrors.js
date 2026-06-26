const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

router.post('/', (req, res) => {
  try {
    const { type, message, stack, info, url, userAgent, timestamp, prevValue, newValue, activeElement, triggerContext } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    const logDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logTime = timestamp ? new Date(timestamp).toLocaleString('ko-KR') : new Date().toLocaleString('ko-KR');

    if (type === 'work-type-change') {
      const logFilePath = path.join(logDir, 'work-type-changes.log');
      const elDesc = activeElement ? `<${activeElement.tagName} id="${activeElement.id || ''}" name="${activeElement.name || ''}" class="${activeElement.className || ''}">` : 'None';
      
      const logMessage = `[${logTime}] [IP: ${ip}]
URL: ${url || 'Unknown'}
User-Agent: ${userAgent || 'Unknown'}
이전 값: "${prevValue || ''}" ➡️ 변경된 값: "${newValue || ''}"
포커스 엘리먼트: ${elDesc}
이벤트 컨텍스트: ${triggerContext || 'Unknown'}
----------------------------------------------------------------------\n`;

      fs.appendFileSync(logFilePath, logMessage, 'utf8');
    } else {
      const logFilePath = path.join(logDir, 'client-errors.log');
      const logMessage = `[${logTime}] [IP: ${ip}]
URL: ${url || 'Unknown'}
User-Agent: ${userAgent || 'Unknown'}
Info: ${info || 'None'}
Message: ${message || 'No message'}
Stack: ${stack || 'No stack'}
----------------------------------------------------------------------\n`;

      fs.appendFileSync(logFilePath, logMessage, 'utf8');
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error logging client report:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
