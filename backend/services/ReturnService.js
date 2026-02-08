const BaseService = require('./BaseService');

class ReturnService extends BaseService {
    constructor() {
        super('returned_assets');
    }

    /**
     * 새로운 반납 건 등록
     * @param {Object} connection DB Connection
     * @param {Object} data 반납 데이터
     */
    async registerReturn(connection, data) {
        // 1. 자산 상태 확인 (이미 반납 처리된 경우 제외)
        const [assetCheck] = await connection.query(
            "SELECT state FROM assets WHERE asset_number = ?",
            [data.asset_number]
        );

        if (assetCheck.length > 0 && assetCheck[0].state === 'termination') {
            throw new Error('이미 반납 처리된 자산입니다.');
        }

        // 2. 반납 신청 내역 추가
        const [insertResult] = await connection.query(
            `INSERT INTO returned_assets
            (asset_number, return_reason, model, serial_number, return_type, end_date, user_id, user_name, department, handover_date, remarks)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                data.asset_number,
                data.return_reason || null,
                data.model,
                data.serial_number,
                data.return_type || null,
                data.end_date || null,
                data.user_id || null,
                data.user_name || null,
                data.department || null,
                data.handover_date || null,
                data.remarks || null
            ]
        );

        // 3. 자산 상태 변경 (process-ter: 반납 진행 중)
        await connection.query(
            "UPDATE assets SET state = 'process-ter' WHERE asset_number = ?",
            [data.asset_number]
        );

        return insertResult.insertId;
    }

    /**
     * 반납 처리 취소
     * @param {Object} connection DB Connection
     * @param {number} returnId 반납 ID
     */
    async cancelReturn(connection, returnId) {
        // 1. 반납 정보 조회
        const [existing] = await connection.query(
            "SELECT asset_number FROM returned_assets WHERE return_id = ?",
            [returnId]
        );

        if (existing.length === 0) {
            throw new Error('반납 자산을 찾을 수 없습니다.');
        }

        const { asset_number } = existing[0];

        // 2. 자산 상태 복구 (useable로 복구)
        await connection.query(
            "UPDATE assets SET state = 'useable' WHERE asset_number = ?",
            [asset_number]
        );

        // 3. 반납 레코드 삭제
        await connection.query(
            "DELETE FROM returned_assets WHERE return_id = ?",
            [returnId]
        );

        return true;
    }

    /**
     * 반납 정보 업데이트
     */
    async updateReturn(id, updateData) {
        // BaseService.update 사용하되 필드 필터링
        const filteredData = {};
        const allowedFields = [
            'return_reason', 'model', 'serial_number', 'return_type',
            'end_date', 'user_id', 'user_name', 'department',
            'handover_date', 'remarks', 'release_status', 'it_room_stock',
            'low_format', 'it_return', 'mail_return', 'actual_return', 'complete'
        ];

        for (const key of allowedFields) {
            if (updateData[key] !== undefined) {
                // 불리언 및 날짜 처리 로직은 서비스에서 캡슐화
                if (typeof updateData[key] === 'boolean') {
                    filteredData[key] = updateData[key] ? 1 : 0;
                } else if ((key === 'handover_date' || key === 'end_date') && updateData[key]) {
                    filteredData[key] = typeof updateData[key] === 'string' ? updateData[key].split('T')[0] : updateData[key];
                } else {
                    filteredData[key] = updateData[key];
                }
            }
        }

        return await this.update(id, filteredData, 'return_id');
    }
}

module.exports = new ReturnService();
