const BaseService = require('./BaseService');
const bcrypt = require('bcrypt');

class UserService extends BaseService {
    constructor() {
        super('users');
    }

    async login(cj_id, password) {
        if (!cj_id || !password) {
            throw new Error('아이디와 비밀번호를 입력하세요.');
        }

        const [users] = await this.pool.query(
            'SELECT * FROM users WHERE cj_id = ?',
            [cj_id]
        );

        if (users.length === 0) {
            throw new Error('아이디 또는 비밀번호가 일치하지 않습니다.');
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            throw new Error('아이디 또는 비밀번호가 일치하지 않습니다.');
        }

        const token = Buffer.from(cj_id + ':' + Date.now()).toString('base64');
        return {
            token,
            user: {
                user_id: user.user_id,
                cj_id: user.cj_id,
                name: user.name,
                sec_level: user.sec_level
            }
        };
    }

    async getUserByIdWithAssets(id) {
        const user = await this.findById(id, 'user_id');
        if (!user) {
            return null;
        }

        const [assetCounts] = await this.pool.query(
            'SELECT category, COUNT(*) as count FROM assets WHERE in_user = ? GROUP BY category',
            [user.cj_id]
        );

        return {
            ...user,
            asset_counts: assetCounts
        };
    }

    async registerTemporaryUser(name) {
        if (!name || !name.trim()) {
            throw new Error('이름을 입력해주세요.');
        }

        const [existingTempUser] = await this.pool.query(
            'SELECT name FROM users WHERE is_temporary = TRUE AND name = ?',
            [name.trim()]
        );

        if (existingTempUser.length > 0) {
            throw new Error('이미 동일한 이름의 임시 사용자가 존재합니다.');
        }

        let tempCjId;
        let attempts = 0;
        while (attempts < 5) {
            tempCjId = `TEMP_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
            const [existing] = await this.pool.query('SELECT cj_id FROM users WHERE cj_id = ?', [tempCjId]);
            if (existing.length === 0) break;
            attempts++;
        }

        if (attempts >= 5) {
            throw new Error('임시 ID 생성 실패. 다시 시도해주세요.');
        }

        const insertId = await this.create({
            name: name.trim(),
            cj_id: tempCjId,
            is_temporary: true
        });

        return {
            user_id: insertId,
            name: name.trim(),
            cj_id: tempCjId,
            is_temporary: true
        };
    }

    async finalizeUser(id, cj_id, part) {
        const connection = await this.pool.getConnection();
        try {
            const [existingUser] = await connection.query('SELECT * FROM users WHERE user_id = ?', [id]);
            if (existingUser.length === 0) throw new Error('사용자를 찾을 수 없습니다.');

            const oldCjId = existingUser[0].cj_id;
            const [duplicate] = await connection.query('SELECT * FROM users WHERE cj_id = ? AND user_id != ?', [cj_id.trim(), id]);
            if (duplicate.length > 0) throw new Error('이미 사용 중인 cj_id입니다.');

            await connection.beginTransaction();
            await connection.query('SET FOREIGN_KEY_CHECKS = 0');

            await connection.query('UPDATE assets SET in_user = ? WHERE in_user = ?', [cj_id.trim(), oldCjId]);
            await connection.query('UPDATE trade SET cj_id = ?, asset_in_user = ? WHERE cj_id = ?', [cj_id.trim(), cj_id.trim(), oldCjId]);
            await connection.query('UPDATE trade SET ex_user = ? WHERE ex_user = ?', [cj_id.trim(), oldCjId]);
            await connection.query('UPDATE returned_assets SET user_id = ?, department = ? WHERE user_id = ?', [cj_id.trim(), part ? part.trim() : null, oldCjId]);
            await connection.query('UPDATE users SET cj_id = ?, part = ?, is_temporary = FALSE WHERE user_id = ?', [cj_id.trim(), part ? part.trim() : null, id]);

            await connection.query('SET FOREIGN_KEY_CHECKS = 1');
            await connection.commit();

            return {
                user_id: id,
                cj_id: cj_id.trim(),
                part: part ? part.trim() : null,
                is_temporary: false
            };
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }
}

module.exports = new UserService();
