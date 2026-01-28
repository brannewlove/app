const pool = require('../utils/db');

class BaseService {
    constructor(tableName) {
        this.tableName = tableName;
        this.pool = pool;
    }

    async findAll() {
        const [rows] = await this.pool.query(`SELECT * FROM ${this.tableName}`);
        return rows;
    }

    async findById(id, idColumn = 'id') {
        const [rows] = await this.pool.query(
            `SELECT * FROM ${this.tableName} WHERE ${idColumn} = ?`,
            [id]
        );
        return rows[0];
    }

    async create(data) {
        const [result] = await this.pool.query(
            `INSERT INTO ${this.tableName} SET ?`,
            [data]
        );
        return result.insertId;
    }

    async update(id, data, idColumn = 'id') {
        const [result] = await this.pool.query(
            `UPDATE ${this.tableName} SET ? WHERE ${idColumn} = ?`,
            [data, id]
        );
        return result.affectedRows > 0;
    }

    async delete(id, idColumn = 'id') {
        const [result] = await this.pool.query(
            `DELETE FROM ${this.tableName} WHERE ${idColumn} = ?`,
            [id]
        );
        return result.affectedRows > 0;
    }
}

module.exports = BaseService;
