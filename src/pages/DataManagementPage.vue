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
const ASSET_HEADERS = 'category\tmodel\tasset_number\tin_user\tserial_number\tday_of_start\tday_of_end\tstate\tunit_price\tcontract_month';
const USER_HEADERS = 'cj_id\tname\tpart\tstate';

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
        
        // DB 필터 데이터 파싱
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
                is_protected: !!data.is_protected
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
    
    // 시스템 필터끼리 혹은 사용자 필터끼리만 이동하게 하거나, 자유롭게 섞게 할 수 있음
    // 여기서는 모든 필터간 이동 허용하되 시스템 필터는 API 호출 시 제외됨
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
        if (orders.length > 0) {
            await filterApi.reorderFilters(orders);
        }
        
        // 2. 이름 및 보호 상태 업데이트
        for (const filter of savedFilters.value) {
            let data = {};
            try {
                data = (typeof filter.filter_data === 'string' ? JSON.parse(filter.filter_data) : filter.filter_data) || {};
            } catch (e) {
                data = {};
            }
            
            // filter_data 업데이트
            const updatedData = { ...data, is_protected: filter.is_protected };
            await filterApi.updateFilter(filter.id, { 
                name: filter.edit_name,
                filter_data: updatedData
            });
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
                    <img src="/images/checkmark.png" alt="success" class="checkmark-icon" /> {{ result.message }}
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
                            placeholder="category | model | asset_number | in_user | serial_number | day_of_start | day_of_end | state | unit_price | contract_month"
                            rows="8"
                            class="paste-textarea"
                        ></textarea>
                    </div>
                </div>
                <div class="card-footer">
                    <button 
                        class="btn btn-modal btn-save" 
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
                    <img src="/images/checkmark.png" alt="success" class="checkmark-icon" /> {{ result.message }}
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
                            placeholder="cj_id | name | part | state"
                            rows="8"
                            class="paste-textarea"
                        ></textarea>
                    </div>
                </div>
                <div class="card-footer">
                    <button 
                        class="btn btn-modal btn-save" 
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
                    <img src="/images/checkmark.png" alt="success" class="checkmark-icon" /> {{ result.message }}
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
                        class="btn btn-modal btn-backup" 
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
                    <img src="/images/checkmark.png" alt="success" class="checkmark-icon" /> {{ result.message }}
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
                                    <img :src="filter.is_protected ? '/images/lock.png' : '/images/unlock.png'" :alt="filter.is_protected ? 'Locked' : 'Unlocked'" class="lock-icon-img" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card-footer">
                    <button class="btn btn-modal btn-save" :disabled="loading" @click="saveFilterChanges">
                        {{ loading ? '저장 중...' : '필터 설정 저장' }}
                    </button>
                </div>
            </div>
        </div>

        <div class="notice-section">
            <h3>주의사항</h3>
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
    color: var(--text-muted);
}

.management-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
    gap: 25px;
    margin-bottom: 40px;
}

.import-card {
    background: var(--card-bg);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--border-light);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.card-header {
    background: var(--bg-muted);
    padding: 20px;
    border-bottom: 1px solid var(--border-light);
    display: flex;
    align-items: center;
    gap: 12px;
}

.header-icon-img {
    width: 20px;
    height: 20px;
    object-fit: contain;
}

.card-header h2 {
    margin: 0;
    font-size: 18px;
    color: var(--text-main);
}

.card-body {
    padding: 25px;
    flex: 1;
}

.card-body p {
    margin-bottom: 20px;
    color: var(--text-muted);
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
    color: var(--text-main);
}

.file-input-group input {
    padding: 30px;
    border: 2px dashed var(--border-color);
    border-radius: var(--radius-md);
    text-align: center;
    cursor: pointer;
    transition: all 0.3s ease;
    background: #fdfdfd;
}

.file-input-group input:hover {
    border-color: var(--brand-blue);
    background: var(--bg-muted);
}

.input-mode-tabs {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
}

.tab-btn {
    flex: 1;
    padding: 10px;
    border: 1.5px solid var(--border-color);
    background: white;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-muted);
    transition: all 0.2s;
}

.tab-btn:hover {
    border-color: var(--brand-blue);
    color: var(--brand-blue);
}

.tab-btn.active {
    border-color: var(--brand-blue);
    background: var(--brand-blue);
    color: white;
}

.paste-textarea {
    width: 100%;
    padding: 12px;
    border: 1.5px solid var(--border-color);
    border-radius: var(--radius-md);
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.5;
    resize: vertical;
    transition: all 0.2s;
}

.paste-textarea:focus {
    outline: none;
    border-color: var(--brand-blue);
    background: #fafafa;
}

.label-with-button {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.btn-copy-header {
    padding: 4px 10px;
    background: var(--bg-dark);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 11px;
    cursor: pointer;
}

.btn-inline-icon {
    width: 12px;
    height: 12px;
    filter: brightness(0) invert(1);
    vertical-align: middle;
}

.tab-btn:not(.active) .btn-inline-icon {
    filter: brightness(0) opacity(0.5);
}

.card-footer {
    padding: 20px;
    background: var(--bg-muted);
    border-top: 1px solid var(--border-light);
    text-align: right;
}

.notice-section {
    background: #fff8e1;
    padding: 25px;
    border-radius: var(--radius-lg);
    border: 1px solid #ffe082;
}

.notice-section h3 {
    margin-bottom: 15px;
    font-size: 16px;
    color: #856404;
}

.notice-section ul {
    list-style: none;
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

.backup-card {
    border-left: 5px solid var(--brand-blue);
}

.backup-info ul {
    list-style: none;
    padding: 0;
    margin: 15px 0;
}

.backup-info li {
    font-size: 14px;
    color: var(--text-muted);
    margin-bottom: 8px;
    padding-left: 20px;
    position: relative;
}

.backup-info li::before {
    content: "✓";
    position: absolute;
    left: 0;
    color: var(--success-color);
    font-weight: bold;
}

.btn-backup {
    background: var(--success-color);
    color: white;
}

.btn-backup:hover {
    filter: brightness(1.1);
}

/* Switch 스타일 */
.setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    background: var(--bg-muted);
    border-radius: var(--radius-md);
    margin-top: 20px;
}

.setting-item.no-margin { margin-top: 0; }

.setting-label strong {
    font-size: 14px;
    color: var(--text-main);
}

.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 22px;
}

.switch input { opacity: 0; width: 0; height: 0; }

.slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: var(--border-color);
  transition: .3s;
  border-radius: 22px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px; width: 18px;
  left: 2px; bottom: 2px;
  background-color: white;
  transition: .3s;
  border-radius: 50%;
}

input:checked + .slider { background-color: var(--success-color); }
input:checked + .slider:before { transform: translateX(22px); }

/* 필터 관리 */
.filter-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.filter-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 15px;
    background: white;
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
}

.btn-order {
    padding: 2px 4px;
    font-size: 10px;
    background: var(--bg-muted);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    cursor: pointer;
}

.filter-name-edit {
    flex: 1;
}

.filter-item-actions {
    display: flex;
    gap: 8px;
    align-items: center;
}

.delete-btn-area {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.edit-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    font-size: 14px;
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
    opacity: 0.5;
    transition: 0.2s;
}

.btn-delete:hover {
    background: #fee2e2;
    opacity: 1;
}

.btn-lock {
    background: white;
    border: 1px solid var(--border-color);
    width: 28px;
    height: 28px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: 0.2s;
}

.btn-lock:hover {
    background: var(--bg-muted);
}

.icon-img,
.lock-icon-img {
    width: 14px;
    height: 14px;
    object-fit: contain;
}
</style>
