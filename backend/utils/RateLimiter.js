const { error } = require('./response');

/**
 * 인메모리 기반 Rate Limiter 클래스 (OOP)
 * 무차별 대입(Brute-Force) 및 과도한 요청 방지
 */
class RateLimiter {
    /**
     * @param {Object} options
     * @param {number} options.windowMs 시간 윈도우 (밀리초, 기본: 60초)
     * @param {number} options.maxRequests 윈도우 내 최대 허용 요청 수 (기본: 5회)
     * @param {string} options.message 초과 시 반환할 에러 메시지
     */
    constructor(options = {}) {
        this.windowMs = options.windowMs || 60 * 1000;
        this.maxRequests = options.maxRequests || 5;
        this.message = options.message || '요청 횟수 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.';
        this.records = new Map();

        // 5분마다 만료된 기록 정리 (메모리 누수 방지)
        this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
        if (this.cleanupInterval.unref) {
            this.cleanupInterval.unref();
        }
    }

    /**
     * 클라이언트 식별 키 추출 (IP 우선)
     * @param {import('express').Request} req
     * @returns {string}
     */
    getKey(req) {
        const forwarded = req.headers['x-forwarded-for'];
        if (forwarded) {
            return forwarded.split(',')[0].trim();
        }
        return req.socket.remoteAddress || 'unknown';
    }

    /**
     * 특정 키의 요청 제한 여부 판별
     * @param {string} key
     * @returns {{ limited: boolean, remaining: number, resetTime: number }}
     */
    check(key) {
        const now = Date.now();
        let record = this.records.get(key);

        if (!record || now > record.resetTime) {
            record = {
                count: 1,
                resetTime: now + this.windowMs
            };
            this.records.set(key, record);
            return {
                limited: false,
                remaining: this.maxRequests - 1,
                resetTime: record.resetTime
            };
        }

        record.count += 1;
        const limited = record.count > this.maxRequests;
        const remaining = Math.max(0, this.maxRequests - record.count);

        return {
            limited,
            remaining,
            resetTime: record.resetTime
        };
    }

    /**
     * 특정 키의 카운트 초기화
     * @param {string} key
     */
    reset(key) {
        this.records.delete(key);
    }

    /**
     * 만료된 레코드 정리
     */
    cleanup() {
        const now = Date.now();
        for (const [key, record] of this.records.entries()) {
            if (now > record.resetTime) {
                this.records.delete(key);
            }
        }
    }

    /**
     * Express 미들웨어 생성
     * @returns {import('express').RequestHandler}
     */
    middleware() {
        return (req, res, next) => {
            const key = this.getKey(req);
            const status = this.check(key);

            res.setHeader('X-RateLimit-Limit', this.maxRequests);
            res.setHeader('X-RateLimit-Remaining', status.remaining);
            res.setHeader('X-RateLimit-Reset', Math.ceil(status.resetTime / 1000));

            if (status.limited) {
                const retryAfterSec = Math.max(1, Math.ceil((status.resetTime - Date.now()) / 1000));
                res.setHeader('Retry-After', retryAfterSec);
                return error(res, this.message, 429);
            }

            next();
        };
    }

    /**
     * 타이머 정리
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.records.clear();
    }
}

module.exports = RateLimiter;
