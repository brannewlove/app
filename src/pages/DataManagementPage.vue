<script setup>
import { ref, onMounted } from 'vue';
import importApi from '../api/import';
import filterApi from '../api/filters';

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
            type: type === 'assets' ? 'import-assets' : 'import-users',
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

const autoBackupEnabled = ref(true);

const fetchBackupConfig = async () => {
    try {
        const response = await fetch('/api/backup/config');
        const data = await response.json();
        if (data.success) {
            autoBackupEnabled.value = data.data.auto_backup_enabled;
        }
    } catch (err) {
        console.error('Failed to fetch backup config:', err);
    }
};

const toggleAutoBackup = async () => {
    try {
        const response = await fetch('/api/backup/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: autoBackupEnabled.value })
        });
        const data = await response.json();
        if (!data.success) {
            autoBackupEnabled.value = !autoBackupEnabled.value; // Revert on failure
            throw new Error(data.error);
        }
    } catch (err) {
        error.value = '설정 저장 중 오류가 발생했습니다: ' + err.message;
    }
};

const savedFilters = ref([]);
const fetchFilters = async () => {
    try {
        const response = await filterApi.getFilters('assets');
        // 필터 관리에서 설정된 값 그대로 보여주고 저장하도록 수정
        savedFilters.value = response.map(f => {
            let data = {};
            try {
                data = (typeof f.filter_data === 'string' ? JSON.parse(f.filter_data) : f.filter_data) || {};
            } catch (e) {
                console.error('Failed to parse filter_data for ID:', f.id, e);
            }
            return { 
                ...f, 
                edit_name: f.name,
                is_protected: !!data.is_protected // 명시적으로 불리언 변환
            };
        });
    } catch (err) {
        console.error('Failed to fetch filters:', err);
    }
};

const toggleProtection = (filter) => {
    filter.is_protected = !filter.is_protected;
};

const moveFilter = (index, direction) => {
    const newFilters = [...savedFilters.value];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newFilters.length) return;
    
    [newFilters[index], newFilters[targetIndex]] = [newFilters[targetIndex], newFilters[index]];
    savedFilters.value = newFilters;
};

const deleteFilter = async (id) => {
    if (!confirm('정말로 이 필터를 삭제하시겠습니까?')) return;
    try {
        loading.value = true;
        await filterApi.deleteFilter(id);
        await fetchFilters();
        result.value = { message: '필터가 삭제되었습니다.', type: 'filter' };
    } catch (err) {
        error.value = '필터 삭제 실패: ' + err.message;
    } finally {
        loading.value = false;
    }
};

const saveFilterChanges = async () => {
    try {
        loading.value = true;
        // 1. 순서 업데이트
        const orders = savedFilters.value.map((f, i) => ({ id: f.id, sort_order: i }));
        await filterApi.reorderFilters(orders);
        
        // 2. 이름 및 보호 상태 업데이트 (수정된 것만)
        for (const filter of savedFilters.value) {
            let data = {};
            try {
                data = (typeof filter.filter_data === 'string' ? JSON.parse(filter.filter_data) : filter.filter_data) || {};
            } catch (e) {
                data = {};
            }
            
            const originalProtected = !!data.is_protected;
            const isNameChanged = filter.edit_name !== filter.name;
            const isProtectionChanged = filter.is_protected !== originalProtected;
            
            if (isNameChanged || isProtectionChanged) {
                // filter_data 업데이트
                const updatedData = { ...data, is_protected: filter.is_protected };
                await filterApi.updateFilter(filter.id, { 
                    name: filter.edit_name,
                    filter_data: updatedData
                });
            }
        }
        
        await fetchFilters();
        result.value = { message: '필터 설정이 저장되었습니다.', type: 'filter' };
    } catch (err) {
        error.value = '설정 저장 중 오류 발생: ' + err.message;
    } finally {
        loading.value = false;
    }
};

onMounted(() => {
    fetchBackupConfig();
    fetchFilters();
});

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

        <div class="management-grid">
            <!-- 자산 임포트 섹션 -->
            <div class="import-card">
                <div v-if="result && result.type === 'import-assets'" class="alert alert-success mb-15">
                    ✅ {{ result.message }}
                </div>
                <div v-if="error && error.includes('자산')" class="alert alert-error mb-15">
                    ❌ {{ error }}
                </div>
                <div class="card-header">
                    <span class="icon">
                        <img src="/images/boxes.png" alt="assets" class="header-icon-img" />
                    </span>
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
                            <img src="/images/clipboard.png" alt="paste" class="btn-inline-icon" /> 직접 입력
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
                                <img src="/images/clipboard.png" alt="copy" class="btn-inline-icon" /> 헤더 복사
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
                <div v-if="result && result.type === 'import-users'" class="alert alert-success mb-15">
                    ✅ {{ result.message }}
                </div>
                <div v-if="error && error.includes('사용자')" class="alert alert-error mb-15">
                    ❌ {{ error }}
                </div>
                <div class="card-header">
                    <span class="icon">
                        <img src="/images/groups.png" alt="users" class="header-icon-img" />
                    </span>
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
                            <img src="/images/clipboard.png" alt="paste" class="btn-inline-icon" /> 직접 입력
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
                                <img src="/images/clipboard.png" alt="copy" class="btn-inline-icon" /> 헤더 복사
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

            <!-- 구글 시트 백업 섹션 -->
            <div class="import-card backup-card">
                <div v-if="result && result.type === 'backup'" class="alert alert-success mb-15">
                    ✅ {{ result.message }}
                </div>
                <div v-if="error && error.includes('백업')" class="alert alert-error mb-15">
                    ❌ {{ error }}
                </div>
                <div class="card-header">
                    <span class="icon">
                        <img src="/images/cloud_backup.png" alt="backup" class="header-icon-img" />
                    </span>
                    <h2>구글 시트 백업 관리</h2>
                </div>
                <div class="card-body">
                    <div class="backup-info">
                        <p>현재 DB를 구글 시트로 백업합니다.</p>
                        <ul>
                            <li>매일 <strong>13:00</strong> 자동 백업</li>
                            <li>최근 <strong>50개</strong> 파일 유지</li>
                        </ul>
                    </div>
                    
                    <div class="setting-item no-margin">
                        <div class="setting-label">
                            <strong>자동 백업 활성화</strong>
                        </div>
                        <label class="switch">
                            <input type="checkbox" v-model="autoBackupEnabled" @change="toggleAutoBackup">
                            <span class="slider round"></span>
                        </label>
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

            <!-- 저장된 필터 관리 섹션 -->
            <div class="import-card">
                <div v-if="result && result.type === 'filter'" class="alert alert-success mb-15">
                    ✅ {{ result.message }}
                </div>
                <div v-if="error && error.includes('필터')" class="alert alert-error mb-15">
                    ❌ {{ error }}
                </div>
                <div class="card-header">
                    <span class="icon">
                        <img src="/images/filter.png" alt="filter" class="header-icon-img" />
                    </span>
                    <h2>저장된 필터 관리</h2>
                </div>
                <div class="card-body">
                    <p>검색 필터의 순서와 이름을 관리합니다.</p>
                    <div class="filter-list">
                        <div v-for="(filter, index) in savedFilters" :key="filter.id" class="filter-item">
                            <div class="filter-order-btns">
                                <button @click="moveFilter(index, -1)" :disabled="index === 0" class="btn-order">▲</button>
                                <button @click="moveFilter(index, 1)" :disabled="index === savedFilters.length - 1" class="btn-order">▼</button>
                            </div>
                            <div class="filter-name-edit">
                                <input v-model="filter.edit_name" type="text" class="edit-input" />
                            </div>
                            <div class="filter-item-actions">
                                <div class="delete-btn-area">
                                    <button v-if="!filter.is_protected" @click="deleteFilter(filter.id)" class="btn-delete" title="삭제">
                                        <img src="/images/del.png" alt="삭제" class="icon-img" />
                                    </button>
                                </div>
                                <button @click="toggleProtection(filter)" class="btn-lock" :title="filter.is_protected ? '잠금 해제' : '보호 모드 (삭제 방지)'">
                                    {{ filter.is_protected ? '🔒' : '🔓' }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card-footer">
                    <button class="btn btn-save" :disabled="loading" @click="saveFilterChanges">
                        {{ loading ? '저장 중...' : '필터 설정 저장' }}
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

.mb-15 {
    margin-bottom: 15px;
}

.management-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 25px;
    margin-bottom: 40px;
    align-items: stretch;
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
    display: flex;
    align-items: center;
    justify-content: center;
}

.header-icon-img {
    width: 24px;
    height: 24px;
    object-fit: contain;
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
    border: 2px dashed var(--border-color);
    border-radius: 8px;
    padding: 30px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s ease;
    background: #fdfdfd;
}

.upload-area.active {
    border: 2px solid var(--brand-blue);
    background: #f0f7ff;
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
    border: 2px solid var(--border-color);
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
    border: 2px solid var(--border-color);
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

.btn-inline-icon {
    width: 14px;
    height: 14px;
    object-fit: contain;
    vertical-align: middle;
    margin-right: 4px;
    filter: brightness(0) invert(1); /* 기본적으로 흰색 (다크 배경 버튼용) */
}

/* 배경이 밝은 버튼(활성화되지 않은 탭) 내부의 아이콘만 검은색으로 */
.tab-btn:not(.active) .btn-inline-icon {
    filter: brightness(0);
}

.btn-copy-header .btn-inline-icon {
    filter: brightness(0) invert(1);
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
    border-left: 5px solid var(--brand-blue);
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
    color: var(--brand-blue);
}

.btn-backup {
    background: darkolivegreen;
    color: white;
    padding: 10px 24px;
}

.btn-backup:hover:not(:disabled) {
    background: #4a5d29;
}

.mb-20 {
    margin-bottom: 20px;
}

/* Switch 스타일 */
.setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 15px;
    background: #f8f9fa;
    border-radius: 8px;
    margin-top: 15px;
}

.setting-item.no-margin {
    margin-top: 0;
}

.setting-label {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.setting-label strong {
    font-size: 14px;
    color: #333;
}

.setting-label span {
    font-size: 12px;
    color: #666;
}

.switch {
  position: relative;
  display: inline-block;
  width: 46px;
  height: 24px;
}

.switch input { 
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--border-color);
  -webkit-transition: .4s;
  transition: .4s;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  -webkit-transition: .4s;
  transition: .4s;
}

input:checked + .slider {
  background-color: var(--brand-blue);
}

input:focus + .slider {
  box-shadow: 0 0 1px var(--brand-blue);
}

input:checked + .slider:before {
  -webkit-transform: translateX(22px);
  -ms-transform: translateX(22px);
  transform: translateX(22px);
}

.slider.round {
  border-radius: 24px;
}

.slider.round:before {
  border-radius: 50%;
}

/* 필터 관리 스타일 */
.filter-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.filter-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 12px;
    background: #fcfcfc;
    border: 1px solid #eee;
    border-radius: 8px;
}

.filter-order-btns {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.btn-order {
    padding: 2px 6px;
    font-size: 10px;
    background: #eee;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
}

.btn-order:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

.filter-name-edit {
    flex: 1;
}

.edit-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
}

.edit-input:focus {
    border-color: var(--brand-blue);
    outline: none;
    box-shadow: 0 0 0 2px rgba(0, 120, 215, 0.1);
}

.filter-item-actions {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    width: 68px;
    justify-content: flex-end;
}

.delete-btn-area {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.btn-delete {
    background: transparent;
    border: none;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    opacity: 0.6;
}

.btn-delete:hover {
    background: #ffebee;
    opacity: 1;
    transform: scale(1.1);
}

.btn-delete .icon-img {
    width: 18px;
    height: 18px;
    object-fit: contain;
}

.btn-lock {
    background: transparent;
    border: 1px solid #ddd;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    background: white;
}

.btn-lock:hover {
    background: #f0f0f0;
    border-color: #ccc;
}

.system-badge {
    font-size: 11px;
    background: #e6f7ff;
    color: #1890ff;
    padding: 2px 8px;
    border-radius: 10px;
    border: 1px solid #91d5ff;
}

.mb-40 {
    margin-bottom: 40px;
}
</style>
