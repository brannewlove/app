<script setup>
import { ref } from 'vue';
import importApi from '../api/import';

const loading = ref(false);
const result = ref(null);
const error = ref(null);

const assetFile = ref(null);
const userFile = ref(null);
const assetPasteData = ref('');
const userPasteData = ref('');
const assetInputMode = ref('file'); // 'file' or 'paste'
const userInputMode = ref('file'); // 'file' or 'paste'

// TSV 헤더 정의
const ASSET_HEADERS = 'category\tmodel\tasset_number\tin_user\tserial_number\tday_of_start\tday_of_end';
const USER_HEADERS = 'cj_id\tname\tpart';

// 헤더 복사 함수
const copyHeaders = async (type) => {
    const headers = type === 'assets' ? ASSET_HEADERS : USER_HEADERS;
    try {
        await navigator.clipboard.writeText(headers);
    } catch (err) {
        console.error('클립보드 복사 실패:', err);
    }
};

const onFileChange = (e, type) => {
    const file = e.target.files[0];
    if (type === 'assets') assetFile.value = file;
    else if (type === 'users') userFile.value = file;
};

const parseTSV = (text) => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = lines[0].split('\t').map(h => h.trim());
    return lines.slice(1).map(line => {
        const values = line.split('\t');
        const obj = {};
        headers.forEach((header, index) => {
            let val = values[index];
            if (val !== undefined) {
                val = val.trim();
            }
            obj[header] = val;
        });
        return obj;
    });
};

const readFile = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file, 'utf-8');
    });
};

const handleImport = async (type) => {
    let data;
    
    // 입력 모드에 따라 데이터 가져오기
    if (type === 'assets') {
        if (assetInputMode.value === 'file') {
            if (!assetFile.value) {
                error.value = '파일을 선택해주세요.';
                return;
            }
            const text = await readFile(assetFile.value);
            data = parseTSV(text);
        } else {
            if (!assetPasteData.value.trim()) {
                error.value = 'TSV 데이터를 입력해주세요.';
                return;
            }
            data = parseTSV(assetPasteData.value);
        }
    } else {
        if (userInputMode.value === 'file') {
            if (!userFile.value) {
                error.value = '파일을 선택해주세요.';
                return;
            }
            const text = await readFile(userFile.value);
            data = parseTSV(text);
        } else {
            if (!userPasteData.value.trim()) {
                error.value = 'TSV 데이터를 입력해주세요.';
                return;
            }
            data = parseTSV(userPasteData.value);
        }
    }

    loading.value = true;
    error.value = null;
    result.value = null;

    try {
        
        if (data.length === 0) {
            throw new Error('파싱된 데이터가 없습니다. 파일 형식을 확인해주세요.');
        }

        let response;
        if (type === 'assets') {
            response = await importApi.importAssets(data);
        } else {
            response = await importApi.importUsers(data);
        }

        result.value = {
            type,
            total: response.total || data.length,
            inserted: response.inserted || 0,
            updated: response.updated || 0,
            message: response.message || '업로드 성공'
        };
    } catch (err) {
        error.value = err.message || '업로드 중 오류가 발생했습니다.';
        console.error('Import error:', err);
    } finally {
        loading.value = false;
    }
};

const handleManualBackup = async () => {
    loading.value = true;
    error.value = null;
    result.value = null;

    try {
        const response = await fetch('/api/backup/manual', {
            method: 'POST'
        });
        const data = await response.json();

        if (data.success) {
            result.value = {
                message: `백업 성공! 파일명: ${data.data.fileName}`,
                type: 'backup'
            };
        } else {
            throw new Error(data.error || '백업 실패');
        }
    } catch (err) {
        error.value = '구글 시트 백업 중 오류가 발생했습니다: ' + err.message;
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <div class="page-content">
        <h1>데이터 관리</h1>
        <p class="description">TSV 파일을 업로드하여 자산 및 사용자 정보를 일괄 업데이트(Upsert)할 수 있습니다.</p>

        <div v-if="error" class="alert alert-error">
            ❌ {{ error }}
        </div>

        <div v-if="result && result.type !== 'backup'" class="alert alert-success">
            ✅ {{ result.message }}
        </div>

        <div class="import-grid">
            <!-- 자산 임포트 섹션 -->
            <div class="import-card">
                <div class="card-header">
                    <span class="icon">📦</span>
                    <h2>자산 데이터 임포트</h2>
                </div>
                <div class="card-body">
                    <p>자산 번호를 기준으로 신규 추가하거나 기존 정보를 업데이트합니다.</p>
                    
                    <!-- 입력 모드 탭 -->
                    <div class="input-mode-tabs">
                        <button 
                            :class="['tab-btn', { active: assetInputMode === 'file' }]"
                            @click="assetInputMode = 'file'"
                        >
                            📁 파일 업로드
                        </button>
                        <button 
                            :class="['tab-btn', { active: assetInputMode === 'paste' }]"
                            @click="assetInputMode = 'paste'"
                        >
                            📋 직접 입력
                        </button>
                    </div>
                    
                    <!-- 파일 업로드 모드 -->
                    <div v-if="assetInputMode === 'file'" class="file-input-group">
                        <label for="asset-file">TSV 파일 선택</label>
                        <input id="asset-file" type="file" accept=".tsv,.txt" @change="e => onFileChange(e, 'assets')" />
                    </div>
                    
                    <!-- 직접 입력 모드 -->
                    <div v-else class="paste-input-group">
                        <div class="label-with-button">
                            <label for="asset-paste">TSV 데이터 붙여넣기</label>
                            <button @click="copyHeaders('assets')" class="btn-copy-header" title="헤더 복사">
                                📋 헤더 복사
                            </button>
                        </div>
                        <textarea 
                            id="asset-paste"
                            v-model="assetPasteData"
                            placeholder="category | model | asset_number | in_user | serial_number | day_of_start | day_of_end"
                            rows="8"
                            class="paste-textarea"
                        ></textarea>
                    </div>
                </div>
                <div class="card-footer">
                    <button 
                        class="btn btn-save" 
                        :disabled="loading" 
                        @click="handleImport('assets')"
                    >
                        {{ loading ? '처리 중...' : '자산 정보 업데이트' }}
                    </button>
                </div>
            </div>

            <!-- 사용자 임포트 섹션 -->
            <div class="import-card">
                <div class="card-header">
                    <span class="icon">👥</span>
                    <h2>사용자 데이터 임포트</h2>
                </div>
                <div class="card-body">
                    <p>사용자 ID(cj_id)를 기준으로 성명 및 부서 정보를 업데이트합니다.</p>
                    
                    <!-- 입력 모드 탭 -->
                    <div class="input-mode-tabs">
                        <button 
                            :class="['tab-btn', { active: userInputMode === 'file' }]"
                            @click="userInputMode = 'file'"
                        >
                            📁 파일 업로드
                        </button>
                        <button 
                            :class="['tab-btn', { active: userInputMode === 'paste' }]"
                            @click="userInputMode = 'paste'"
                        >
                            📋 직접 입력
                        </button>
                    </div>
                    
                    <!-- 파일 업로드 모드 -->
                    <div v-if="userInputMode === 'file'" class="file-input-group">
                        <label for="user-file">TSV 파일 선택</label>
                        <input id="user-file" type="file" accept=".tsv,.txt" @change="e => onFileChange(e, 'users')" />
                    </div>
                    
                    <!-- 직접 입력 모드 -->
                    <div v-else class="paste-input-group">
                        <div class="label-with-button">
                            <label for="user-paste">TSV 데이터 붙여넣기</label>
                            <button @click="copyHeaders('users')" class="btn-copy-header" title="헤더 복사">
                                📋 헤더 복사
                            </button>
                        </div>
                        <textarea 
                            id="user-paste"
                            v-model="userPasteData"
                            placeholder="cj_id | name | part"
                            rows="8"
                            class="paste-textarea"
                        ></textarea>
                    </div>
                </div>
                <div class="card-footer">
                    <button 
                        class="btn btn-save" 
                        :disabled="loading" 
                        @click="handleImport('users')"
                    >
                        {{ loading ? '처리 중...' : '사용자 정보 업데이트' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- 구글 시트 백업 섹션 -->
        <div v-if="result && result.type === 'backup'" class="alert alert-success mb-20">
            ✅ {{ result.message }}
        </div>
        <div class="backup-section">
            <div class="import-card backup-card">
                <div class="card-header">
                    <span class="icon">📊</span>
                    <h2>구글 시트 백업 관리</h2>
                </div>
                <div class="card-body">
                    <div class="backup-info">
                        <p>현재 DB의 자산 및 거래 내역을 구글 시트로 백업합니다.</p>
                        <ul>
                            <li>자동 백업: 매일 <strong>13:00</strong></li>
                            <li>보관 정책: 최근 <strong>50개</strong> 파일 유지</li>
                        </ul>
                    </div>
                </div>
                <div class="card-footer">
                    <button 
                        class="btn btn-backup" 
                        :disabled="loading" 
                        @click="handleManualBackup"
                    >
                        {{ loading ? '백업 중...' : '지금 즉시 백업하기' }}
                    </button>
                </div>
            </div>
        </div>

        <div class="notice-section">
            <h3>📢 주의사항</h3>
            <ul>
                <li>파일 형식은 <strong>Tab-Separated Values (TSV)</strong>이어야 합니다.</li>
                <li>첫 번째 행은 반드시 컬럼명(헤더)이어야 합니다.</li>
                <li>자산 데이터는 <code>asset_number</code> 컬럼이 필수입니다.</li>
                <li>사용자 데이터는 <code>cj_id</code> 컬럼이 필수입니다.</li>
            </ul>
        </div>
    </div>
</template>

<style scoped>
.description {
    margin-bottom: 30px;
    color: #666;
}

.import-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 30px;
    margin-bottom: 40px;
}

.import-card {
    background: white;
    border-radius: 12px;
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.card-header {
    background: #f8f9fa;
    padding: 20px;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    gap: 12px;
}

.card-header .icon {
    font-size: 24px;
}

.card-header h2 {
    margin: 0;
    font-size: 18px;
    color: #333;
}

.card-body {
    padding: 25px;
    flex: 1;
}

.card-body p {
    margin-bottom: 20px;
    color: #666;
    font-size: 14px;
    line-height: 1.6;
}

.file-input-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.file-input-group label {
    font-weight: 600;
    font-size: 13px;
    color: #444;
}

.file-input-group input {
    padding: 10px;
    border: 2px dashed #ddd;
    border-radius: 8px;
    background: #fafafa;
    cursor: pointer;
    transition: all 0.2s;
}

.file-input-group input:hover {
    border-color: #bbb;
    background: #f0f0f0;
}

.input-mode-tabs {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
}

.tab-btn {
    flex: 1;
    padding: 10px 20px;
    border: 2px solid #ddd;
    background: white;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    color: #666;
    transition: all 0.2s;
}

.tab-btn:hover {
    border-color: #999;
    background: #f8f9fa;
}

.tab-btn.active {
    border-color: #4a4a4a;
    background: #4a4a4a;
    color: white;
}

.paste-input-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.paste-input-group label {
    font-weight: 600;
    font-size: 13px;
    color: #444;
}

.paste-textarea {
    width: 100%;
    padding: 12px;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-family: 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.5;
    resize: vertical;
    transition: all 0.2s;
}

.paste-textarea:focus {
    outline: none;
    border-color: #4a4a4a;
    background: #fafafa;
}

.paste-textarea::placeholder {
    color: #999;
    font-family: inherit;
}

.label-with-button {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.btn-copy-header {
    padding: 6px 12px;
    background: #4a4a4a;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-copy-header:hover {
    background: #333;
    transform: translateY(-1px);
}

.btn-copy-header:active {
    transform: translateY(0);
}

.card-footer {
    padding: 20px;
    background: #f8f9fa;
    border-top: 1px solid var(--border-color);
    text-align: right;
}

.alert-success {
    background: #e8f5e9;
    color: #2e7d32;
    border-left: 4px solid #2e7d32;
}

.notice-section {
    background: #fff8e1;
    padding: 25px;
    border-radius: 12px;
    border: 1px solid #ffe082;
}

.notice-section h3 {
    margin-bottom: 15px;
    font-size: 16px;
    color: #856404;
}

.notice-section ul {
    list-style-type: none;
    padding: 0;
}

.notice-section li {
    margin-bottom: 10px;
    font-size: 14px;
    color: #666;
    padding-left: 20px;
    position: relative;
}

.notice-section li::before {
    content: "•";
    position: absolute;
    left: 0;
    color: #856404;
    font-weight: bold;
}

/* 백업 섹션 스타일 */
.backup-section {
    margin-bottom: 40px;
}

.backup-card {
    border-left: 5px solid #4285f4;
}

.backup-info ul {
    list-style: none;
    padding: 0;
    margin: 10px 0;
}

.backup-info li {
    font-size: 14px;
    color: #555;
    margin-bottom: 5px;
    padding-left: 15px;
    position: relative;
}

.backup-info li::before {
    content: "•";
    position: absolute;
    left: 0;
    color: #4285f4;
}

.btn-backup {
    background: #4285f4;
    color: white;
    padding: 10px 24px;
}

.btn-backup:hover:not(:disabled) {
    background: #3367d6;
}

.mb-20 {
    margin-bottom: 20px;
}
</style>
