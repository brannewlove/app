
const isHold = (state) => state && state.toLowerCase() === 'hold';

/**
 * 거래 작업 유형 정의 (WORK_TYPES)
 * 
 * 새로운 작업 유형을 추가할 때 아래 스키마를 참고하세요.
 * 
 * @typedef {Object} WorkTypeConfig
 * @property {string} id - 고유 식별자 (보통 work_type과 동일)
 * @property {string} work_type - 실제 거래 로직이나 DB에 저장되는 작업 유형 문자열
 * @property {string} description - UI에 표시될 설명 (툴팁, 리스트 등)
 * @property {string} category - 카테고리 그룹 ('신규' | '출고' | '입고' | '반납')
 * 
 * @property {string|null} [fixedCjId] - 거래 등록 시 '사용자(CJ ID)' 필드에 자동 할당될 값
 *  - null: 사용자 수동 입력 필요 (기본값)
 *  - 'no-change': 현재 자산의 보유자(in_user)를 그대로 유지
 *  - 'cjenc_inno': 전산실 입고 (특정 ID로 고정)
 *  - 'aj_rent': 렌탈사 반납 (특정 ID로 고정)
 * 
 * @property {string|null} [displayFixedUser] - fixedCjId가 설정되었을 때 UI에 표시될 읽기 전용 텍스트
 *  - 예: '회사 입고 (자동)', '반납처 (자동)' 등
 * 
 * @property {string[]} [allowedStates] - 이 작업이 허용되는 자산의 현재 상태 목록
 *  - 예: ['wait'] (신규 자산만), ['useable'] (사용 가능 자산만)
 * 
 * @property {string} [sourceType] - 이 작업이 허용되는 자산의 현재 보유 주체
 *  - 'any': 누구든 상관 없음 (기본값)
 *  - 'stock': 전산실 재고(cjenc_inno)인 경우만 가능
 *  - 'user': 사용자 보유 상태인 경우만 가능 (전산실 제외)
 * 
 * @property {boolean} [requiresReplacement] - true일 경우 반납 처리 시 교체할 자산 정보를 입력받음 (예: 고장교체)
 * 
 * @property {(context: { asset_state: string, asset_in_user: string, cj_id?: string }) => { valid: boolean, message?: string }} [validate]
 *  - 추가적인 커스텀 유효성 검사 로직 함수.
 *  - context: 검사 시점의 자산 상태와 입력된 거래 정보
 *  - return: { valid: true } 또는 { valid: false, message: '에러 메시지' }
 */
export const WORK_TYPES = [
    // --- 신규 (New) ---
    {
        id: '신규-계약',
        work_type: '신규-계약',
        description: '신규 계약 자산 등록',
        category: '신규',
        fixedCjId: null,
        displayFixedUser: null,
        // 신규 등록은 자산 상태 체크 불필요 (보통 생성 시점)
        validate: () => ({ valid: true })
    },
    {
        id: '신규-고장교체',
        work_type: '신규-고장교체',
        description: '고장 자산 교체용 신규 등록',
        category: '신규',
        fixedCjId: null,
        displayFixedUser: null,
        validate: () => ({ valid: true })
    },
    {
        id: '신규-기타',
        work_type: '신규-기타',
        description: '기타 사유 신규 등록',
        category: '신규',
        fixedCjId: null,
        displayFixedUser: null,
        validate: () => ({ valid: true })
    },
    {
        id: '신규-재계약',
        work_type: '신규-재계약',
        description: '반납 장비 재계약 입고',
        category: '신규',
        fixedCjId: 'cjenc_inno',
        displayFixedUser: '회사 입고 (자동)',
        allowedStates: ['termination'],
        requiresDates: true,
        validate: ({ asset_state }) => {
            if (asset_state !== 'termination') return { valid: false, message: '반납완료(termination) 상태인 자산만 재계약이 가능합니다.' };
            return { valid: true };
        }
    },

    // --- 출고 (Outbound) ---
    {
        id: '출고-신규지급',
        work_type: '출고-신규지급',
        description: '신규입고자산을 사용자에게 지급',
        category: '출고',
        fixedCjId: null,
        displayFixedUser: null,
        allowedStates: ['wait'],
        sourceType: 'any', // wait 상태면 소유자 상관 없음 (보통 cjenc_inno겠지만)
        validate: ({ asset_state, cj_id }) => {
            if (!isHold(asset_state) && asset_state !== 'wait') return { valid: false, message: `상태가 "${asset_state}"입니다. "wait" 상태만 가능합니다.` };
            if (!cj_id) return { valid: false, message: '사용자(CJ ID)를 선택해주세요.' };
            return { valid: true };
        }
    },
    {
        id: '출고-신규교체',
        work_type: '출고-신규교체',
        description: '신규입고자산을 교체요청자에게 출고',
        category: '출고',
        fixedCjId: null,
        displayFixedUser: null,
        allowedStates: ['wait'],
        sourceType: 'any',
        validate: ({ asset_state, cj_id }) => {
            if (!isHold(asset_state) && asset_state !== 'wait') return { valid: false, message: `상태가 "${asset_state}"입니다. "wait" 상태만 가능합니다.` };
            if (!cj_id) return { valid: false, message: '사용자(CJ ID)를 선택해주세요.' };
            return { valid: true };
        }
    },
    {
        id: '출고-재고지급',
        work_type: '출고-재고지급',
        description: '전산실재고를 사용자에게 지급',
        category: '출고',
        fixedCjId: null,
        displayFixedUser: null,
        allowedStates: ['useable'],
        sourceType: 'stock', // 전산실 재고만
        validate: ({ asset_state, asset_in_user, cj_id }) => {
            if (!isHold(asset_state) && asset_in_user !== 'cjenc_inno') return { valid: false, message: `보유자가 "${asset_in_user}"입니다. "cjenc_inno"여야 합니다.` };
            if (!isHold(asset_state) && asset_state !== 'useable') return { valid: false, message: `상태가 "${asset_state}"입니다. "useable" 상태만 가능합니다.` };
            if (!cj_id) return { valid: false, message: '사용자(CJ ID)를 선택해주세요.' };
            return { valid: true };
        }
    },
    {
        id: '출고-재고교체',
        work_type: '출고-재고교체',
        description: '전산실재고를 교체요청자에게 출고',
        category: '출고',
        fixedCjId: null,
        displayFixedUser: null,
        allowedStates: ['useable'],
        sourceType: 'stock',
        validate: ({ asset_state, asset_in_user, cj_id }) => {
            if (!isHold(asset_state) && asset_in_user !== 'cjenc_inno') return { valid: false, message: `보유자가 "${asset_in_user}"입니다. "cjenc_inno"여야 합니다.` };
            if (!isHold(asset_state) && asset_state !== 'useable') return { valid: false, message: `상태가 "${asset_state}"입니다. "useable" 상태만 가능합니다.` };
            if (!cj_id) return { valid: false, message: '사용자(CJ ID)를 선택해주세요.' };
            return { valid: true };
        }
    },
    {
        id: '출고-대여',
        work_type: '출고-대여',
        description: '자산 대여',
        category: '출고',
        fixedCjId: null,
        displayFixedUser: null,
        allowedStates: ['useable'],
        sourceType: 'stock',
        validate: ({ asset_state, asset_in_user, cj_id }) => {
            if (!isHold(asset_state) && asset_in_user !== 'cjenc_inno') return { valid: false, message: `보유자가 "${asset_in_user}"입니다. "cjenc_inno"여야 합니다.` };
            if (!isHold(asset_state) && asset_state !== 'useable') return { valid: false, message: `상태가 "${asset_state}"입니다. "useable" 상태만 가능합니다.` };
            if (!cj_id) return { valid: false, message: '사용자(CJ ID)를 선택해주세요.' };
            return { valid: true };
        }
    },
    {
        id: '출고-사용자변경',
        work_type: '출고-사용자변경',
        description: '사용자에서 타사용자로 변경',
        category: '출고',
        fixedCjId: null,
        displayFixedUser: null,
        allowedStates: ['useable'],
        sourceType: 'user', // 사용자 보유 자산만
        validate: ({ asset_state, cj_id, asset_in_user }) => {
            if (!isHold(asset_state) && asset_state !== 'useable') return { valid: false, message: `상태가 "${asset_state}"입니다. "useable" 상태만 가능합니다.` };
            if (!cj_id) return { valid: false, message: '사용자(CJ ID)를 선택해주세요.' };
            if (asset_in_user && cj_id === asset_in_user) return { valid: false, message: '현재 사용자와 다른 사용자를 선택해야 합니다.' };
            return { valid: true };
        }
    },
    {
        id: '출고-수리',
        work_type: '출고-수리',
        description: '수리 보내기',
        category: '출고',
        fixedCjId: 'no-change',
        displayFixedUser: '현재 보유자 유지 (자동)',
        allowedStates: ['useable'],
        sourceType: 'any', // 전산실/사용자 모두 가능
        validate: ({ asset_state }) => {
            if (!isHold(asset_state) && asset_state !== 'useable') return { valid: false, message: `상태가 "${asset_state}"입니다. "useable" 상태만 가능합니다.` };
            return { valid: true };
        }
    },

    // --- 입고 (Inbound) ---
    {
        id: '입고-노후교체',
        work_type: '입고-노후교체',
        description: '노후자산 교체 후 입고',
        category: '입고',
        fixedCjId: 'cjenc_inno',
        displayFixedUser: '회사 입고 (자동)',
        allowedStates: ['useable'],
        sourceType: 'user',
        validate: ({ asset_state, asset_in_user }) => {
            if (!isHold(asset_state) && asset_in_user === 'cjenc_inno') return { valid: false, message: `이미 회사 입고 상태(cjenc_inno)입니다.` };
            if (!isHold(asset_state) && asset_state !== 'useable') return { valid: false, message: `상태가 "${asset_state}"입니다. "useable" 상태만 가능합니다.` };
            return { valid: true };
        }
    },
    {
        id: '입고-불량교체',
        work_type: '입고-불량교체',
        description: '불량자산 교체 후 입고',
        category: '입고',
        fixedCjId: 'cjenc_inno',
        displayFixedUser: '회사 입고 (자동)',
        allowedStates: ['useable'],
        sourceType: 'user',
        validate: ({ asset_state, asset_in_user }) => {
            if (!isHold(asset_state) && asset_in_user === 'cjenc_inno') return { valid: false, message: `이미 회사 입고 상태(cjenc_inno)입니다.` };
            if (!isHold(asset_state) && asset_state !== 'useable') return { valid: false, message: `상태가 "${asset_state}"입니다. "useable" 상태만 가능합니다.` };
            return { valid: true };
        }
    },
    {
        id: '입고-모델교체',
        work_type: '입고-모델교체',
        description: '모델 변경으로 인한 기존 자산 입고',
        category: '입고',
        fixedCjId: 'cjenc_inno',
        displayFixedUser: '회사 입고 (자동)',
        allowedStates: ['useable'],
        sourceType: 'user',
        validate: ({ asset_state, asset_in_user }) => {
            if (!isHold(asset_state) && asset_in_user === 'cjenc_inno') return { valid: false, message: `이미 회사 입고 상태(cjenc_inno)입니다.` };
            if (!isHold(asset_state) && asset_state !== 'useable') return { valid: false, message: `상태가 "${asset_state}"입니다. "useable" 상태만 가능합니다.` };
            return { valid: true };
        }
    },
    {
        id: '입고-퇴사반납',
        work_type: '입고-퇴사반납',
        description: '퇴사자 자산 반납',
        category: '입고',
        fixedCjId: 'cjenc_inno',
        displayFixedUser: '회사 입고 (자동)',
        allowedStates: ['useable'],
        sourceType: 'user',
        validate: ({ asset_state, asset_in_user }) => {
            if (!isHold(asset_state) && asset_in_user === 'cjenc_inno') return { valid: false, message: `이미 회사 입고 상태(cjenc_inno)입니다.` };
            if (!isHold(asset_state) && asset_state !== 'useable') return { valid: false, message: `상태가 "${asset_state}"입니다. "useable" 상태만 가능합니다.` };
            return { valid: true };
        }
    },
    {
        id: '입고-임의반납',
        work_type: '입고-임의반납',
        description: '사용자 임의 반납',
        category: '입고',
        fixedCjId: 'cjenc_inno',
        displayFixedUser: '회사 입고 (자동)',
        allowedStates: ['useable'],
        sourceType: 'user',
        validate: ({ asset_state, asset_in_user }) => {
            if (!isHold(asset_state) && asset_in_user === 'cjenc_inno') return { valid: false, message: `이미 회사 입고 상태(cjenc_inno)입니다.` };
            if (!isHold(asset_state) && asset_state !== 'useable') return { valid: false, message: `상태가 "${asset_state}"입니다. "useable" 상태만 가능합니다.` };
            return { valid: true };
        }
    },
    {
        id: '입고-휴직반납',
        work_type: '입고-휴직반납',
        description: '휴직자 자산 보관',
        category: '입고',
        fixedCjId: 'no-change',
        displayFixedUser: '현재 보유자 유지 (자동)',
        allowedStates: ['useable'],
        sourceType: 'user',
        validate: ({ asset_state, asset_in_user }) => {
            // 휴직반납도 입고의 일종이라면 cjenc_inno가 아니어야 함? 
            // AssetsPage 로직 동일 적용
            if (!isHold(asset_state) && asset_in_user === 'cjenc_inno') return { valid: false, message: `이미 회사 입고 상태(cjenc_inno)입니다.` };
            if (!isHold(asset_state) && asset_state !== 'useable') return { valid: false, message: `상태가 "${asset_state}"입니다. "useable" 상태만 가능합니다.` };
            return { valid: true };
        }
    },
    {
        id: '입고-재입사예정',
        work_type: '입고-재입사예정',
        description: '재입사 예정자 자산 보관',
        category: '입고',
        fixedCjId: 'no-change',
        displayFixedUser: '현재 보유자 유지 (자동)',
        allowedStates: ['useable'],
        sourceType: 'user',
        validate: ({ asset_state, asset_in_user }) => {
            if (!isHold(asset_state) && asset_in_user === 'cjenc_inno') return { valid: false, message: `이미 회사 입고 상태(cjenc_inno)입니다.` };
            if (!isHold(asset_state) && asset_state !== 'useable') return { valid: false, message: `상태가 "${asset_state}"입니다. "useable" 상태만 가능합니다.` };
            return { valid: true };
        }
    },
    {
        id: '입고-대여반납',
        work_type: '입고-대여반납',
        description: '대여자산 반납',
        category: '입고',
        fixedCjId: 'cjenc_inno',
        displayFixedUser: '회사 입고 (자동)',
        allowedStates: ['rent'],
        sourceType: 'any',
        validate: ({ asset_state, asset_in_user }) => {
            if (!isHold(asset_state) && asset_in_user === 'cjenc_inno') return { valid: false, message: `이미 회사 입고 상태(cjenc_inno)입니다.` };
            if (!isHold(asset_state) && asset_state !== 'rent') return { valid: false, message: `상태가 "${asset_state}"입니다. "rent" 상태만 가능합니다.` };
            return { valid: true };
        }
    },
    {
        id: '입고-수리반납',
        work_type: '입고-수리반납',
        description: '수리완료 반납',
        category: '입고',
        fixedCjId: 'no-change',
        displayFixedUser: '현재 보유자 유지 (자동)',
        allowedStates: ['repair'],
        sourceType: 'any',
        validate: ({ asset_state }) => {
            if (!isHold(asset_state) && asset_state !== 'repair') return { valid: false, message: `상태가 "${asset_state}"입니다. "repair" 상태만 가능합니다.` };
            return { valid: true };
        }
    },

    // --- 반납 (Return) ---
    {
        id: '반납-노후반납',
        work_type: '반납-노후반납',
        description: '노후자산 렌탈사 반납',
        category: '반납',
        fixedCjId: 'aj_rent',
        displayFixedUser: '반납처 (자동)',
        allowedStates: ['useable'],
        sourceType: 'stock',
        validate: ({ asset_state }) => {
            // 원래는 재고 상태에서 반납하지만, 로직상으로는 useable 등만 체크하면 될 듯
            if (!isHold(asset_state) && asset_state !== 'useable') return { valid: false, message: `상태가 "${asset_state}"입니다. "useable" 상태만 가능합니다.` };
            return { valid: true };
        }
    },
    {
        id: '반납-고장교체',
        work_type: '반납-고장교체',
        description: '고장자산 교체 반납',
        category: '반납',
        fixedCjId: 'aj_rent',
        displayFixedUser: '반납처 (자동)',
        requiresReplacement: true,
        allowedStates: ['useable'],
        sourceType: 'stock',
        validate: ({ asset_state }) => {
            if (!isHold(asset_state) && asset_state !== 'useable') return { valid: false, message: `상태가 "${asset_state}"입니다. "useable" 상태만 가능합니다.` };
            return { valid: true };
        }
    },
    {
        id: '반납-조기반납',
        work_type: '반납-조기반납',
        description: '조기 반납',
        category: '반납',
        fixedCjId: 'aj_rent',
        displayFixedUser: '반납처 (자동)',
        allowedStates: ['useable'],
        sourceType: 'stock',
        validate: ({ asset_state }) => {
            if (!isHold(asset_state) && asset_state !== 'useable') return { valid: false, message: `상태가 "${asset_state}"입니다. "useable" 상태만 가능합니다.` };
            return { valid: true };
        }
    },
    {
        id: '반납-폐기',
        work_type: '반납-폐기',
        description: '자산 폐기',
        category: '반납',
        fixedCjId: 'aj_rent',
        displayFixedUser: '반납처 (자동)',
        allowedStates: ['useable'],
        sourceType: 'stock',
        validate: ({ asset_state }) => {
            if (!isHold(asset_state) && asset_state !== 'useable') return { valid: false, message: `상태가 "${asset_state}"입니다. "useable" 상태만 가능합니다.` };
            return { valid: true };
        }
    },
    {
        id: '반납-기타',
        work_type: '반납-기타',
        description: '일반 반납',
        category: '반납',
        fixedCjId: 'aj_rent',
        displayFixedUser: '반납처 (자동)',
        allowedStates: ['useable'],
        sourceType: 'stock',
        validate: ({ asset_state }) => {
            if (!isHold(asset_state) && asset_state !== 'useable') return { valid: false, message: `상태가 "${asset_state}"입니다. "useable" 상태만 가능합니다.` };
            return { valid: true };
        }
    },
];

export const getAllWorkTypes = () => WORK_TYPES;

export const getWorkTypeConfig = (workTypeId) => {
    return WORK_TYPES.find(wt => wt.work_type === workTypeId) || null;
};

export const isCjIdDisabled = (workTypeId) => {
    const config = getWorkTypeConfig(workTypeId);
    return config ? !!config.fixedCjId : false;
};

export const getFixedCjId = (workTypeId) => {
    const config = getWorkTypeConfig(workTypeId);
    return config ? config.fixedCjId : '';
};

export const getFixedCjIdDisplay = (workTypeId) => {
    const config = getWorkTypeConfig(workTypeId);
    return config ? config.displayFixedUser : '';
};

export const requiresReplacementAsset = (workTypeId) => {
    const config = getWorkTypeConfig(workTypeId);
    return config ? !!config.requiresReplacement : false;
};

export const validateTradeStrict = (tradeData, assetData) => {
    const config = getWorkTypeConfig(tradeData.work_type);
    if (!config) return { valid: false, message: '유효하지 않은 작업 유형입니다.' };

    if (config.validate) {
        const ctx = {
            asset_state: assetData.state,
            asset_in_user: assetData.in_user,
            cj_id: tradeData.cj_id
        };
        return config.validate(ctx);
    }

    return { valid: true };
};

export const getAvailableWorkTypesForAsset = (asset) => {
    if (!asset) return [];

    const { state, in_user } = asset;
    if (!state) return [];

    // HOLD 상태면 모든 작업 유형 가능... 은 위험하지만 기존 로직 유지
    if (isHold(state)) return WORK_TYPES;

    const isStock = in_user === 'cjenc_inno';

    return WORK_TYPES.filter(wt => {
        // 1. Check Allowed States
        if (wt.allowedStates && !wt.allowedStates.includes(state)) {
            return false;
        }

        // 2. Check Source Type
        if (wt.sourceType) {
            if (wt.sourceType === 'stock' && !isStock) return false;
            if (wt.sourceType === 'user' && isStock) return false;
        }

        return true;
    });
};
