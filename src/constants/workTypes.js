
const isHold = (state) => state && state.toLowerCase() === 'hold';

/**
 * 거래 작업 유형 정의 (WORK_TYPES)
 */
export const WORK_TYPES = [
    // --- 신규 (New) ---
    {
        id: '신규-계약',
        work_type: '신규-계약',
        description: '신규 계약 자산 등록',
        category: '신규',
        validate: () => ({ valid: true })
    },
    {
        id: '신규-고장교체',
        work_type: '신규-고장교체',
        description: '고장 자산 교체용 신규 등록',
        category: '신규',
        validate: () => ({ valid: true })
    },
    {
        id: '신규-기타',
        work_type: '신규-기타',
        description: '기타 사유 신규 등록',
        category: '신규',
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
        requiresDates: true
    },

    // --- 출고 (Outbound) ---
    {
        id: '출고-신규지급',
        work_type: '출고-신규지급',
        description: '신규입고자산을 사용자에게 지급',
        category: '출고',
        allowedStates: ['wait']
    },
    {
        id: '출고-신규교체',
        work_type: '출고-신규교체',
        description: '신규입고자산을 교체요청자에게 출고',
        category: '출고',
        allowedStates: ['wait']
    },
    {
        id: '출고-재고지급',
        work_type: '출고-재고지급',
        description: '전산실재고를 사용자에게 지급',
        category: '출고',
        allowedStates: ['useable'],
        sourceType: 'stock'
    },
    {
        id: '출고-재고교체',
        work_type: '출고-재고교체',
        description: '전산실재고를 교체요청자에게 출고',
        category: '출고',
        allowedStates: ['useable'],
        sourceType: 'stock'
    },
    {
        id: '출고-대여',
        work_type: '출고-대여',
        description: '자산 대여',
        category: '출고',
        allowedStates: ['useable'],
        sourceType: 'stock'
    },
    {
        id: '출고-사용자변경',
        work_type: '출고-사용자변경',
        description: '사용자에서 타사용자로 변경',
        category: '출고',
        allowedStates: ['useable'],
        sourceType: 'user',
        validate: ({ cj_id, asset_in_user }) => {
            if (asset_in_user && cj_id === asset_in_user) return { valid: false, message: '현재 사용자와 다른 사용자를 선택해야 합니다.' };
            return { valid: true };
        }
    },
    {
        id: '출고-수리완료',
        work_type: '출고-수리완료',
        description: '수리완료 반납',
        category: '출고',
        fixedCjId: 'no-change',
        displayFixedUser: '현재 보유자 유지 (자동)',
        allowedStates: ['repair']
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
        sourceType: 'user'
    },
    {
        id: '입고-불량교체',
        work_type: '입고-불량교체',
        description: '불량자산 교체 후 입고',
        category: '입고',
        fixedCjId: 'cjenc_inno',
        displayFixedUser: '회사 입고 (자동)',
        allowedStates: ['useable'],
        sourceType: 'user'
    },
    {
        id: '입고-모델교체',
        work_type: '입고-모델교체',
        description: '모델 변경으로 인한 기존 자산 입고',
        category: '입고',
        fixedCjId: 'cjenc_inno',
        displayFixedUser: '회사 입고 (자동)',
        allowedStates: ['useable'],
        sourceType: 'user'
    },
    {
        id: '입고-퇴사반납',
        work_type: '입고-퇴사반납',
        description: '퇴사자 자산 반납',
        category: '입고',
        fixedCjId: 'cjenc_inno',
        displayFixedUser: '회사 입고 (자동)',
        allowedStates: ['useable'],
        sourceType: 'user'
    },
    {
        id: '입고-임의반납',
        work_type: '입고-임의반납',
        description: '사용자 임의 반납',
        category: '입고',
        fixedCjId: 'cjenc_inno',
        displayFixedUser: '회사 입고 (자동)',
        allowedStates: ['useable'],
        sourceType: 'user'
    },
    {
        id: '입고-휴직반납',
        work_type: '입고-휴직반납',
        description: '휴직자 자산 보관',
        category: '입고',
        fixedCjId: 'no-change',
        displayFixedUser: '현재 보유자 유지 (자동)',
        allowedStates: ['useable'],
        sourceType: 'user'
    },
    {
        id: '입고-재입사예정',
        work_type: '입고-재입사예정',
        description: '재입사 예정자 자산 보관',
        category: '입고',
        fixedCjId: 'no-change',
        displayFixedUser: '현재 보유자 유지 (자동)',
        allowedStates: ['useable'],
        sourceType: 'user'
    },
    {
        id: '입고-대여반납',
        work_type: '입고-대여반납',
        description: '대여자산 반납',
        category: '입고',
        fixedCjId: 'cjenc_inno',
        displayFixedUser: '회사 입고 (자동)',
        allowedStates: ['rent']
    },
    {
        id: '입고-수리필요',
        work_type: '입고-수리필요',
        description: '수리 보내기',
        category: '입고',
        fixedCjId: 'no-change',
        displayFixedUser: '현재 보유자 유지 (자동)',
        allowedStates: ['useable']
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
        sourceType: 'stock'
    },
    {
        id: '반납-고장교체',
        work_type: '반납-고장교체',
        description: '고장자산 교체 반납',
        category: '반납',
        fixedCjId: 'aj_rent',
        displayFixedUser: '반납처 (자동)',
        requiresReplacement: true,
        allowedStates: ['useable', 'repair'],
        sourceType: 'stock'
    },
    {
        id: '반납-조기반납',
        work_type: '반납-조기반납',
        description: '조기 반납',
        category: '반납',
        fixedCjId: 'aj_rent',
        displayFixedUser: '반납처 (자동)',
        allowedStates: ['useable'],
        sourceType: 'stock'
    },
    {
        id: '반납-폐기',
        work_type: '반납-폐기',
        description: '자산 폐기',
        category: '반납',
        fixedCjId: 'aj_rent',
        displayFixedUser: '반납처 (자동)',
        allowedStates: ['useable'],
        sourceType: 'stock'
    },
    {
        id: '반납-기타',
        work_type: '반납-기타',
        description: '일반 반납',
        category: '반납',
        fixedCjId: 'aj_rent',
        displayFixedUser: '반납처 (자동)',
        allowedStates: ['useable'],
        sourceType: 'stock'
    },

    // --- 기타 (Misc) ---
    { id: '이동', work_type: '이동', description: '사용자간 자산 이동', category: '출고', allowedStates: ['useable'] },
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

export const validateTradeStrict = (tradeData, assetData, options = {}) => {
    const config = getWorkTypeConfig(tradeData.work_type || tradeData.id);
    if (!config) return { valid: false, message: '유효하지 않은 작업 유형입니다.' };

    const { state, in_user } = assetData;
    const isStock = in_user === 'cjenc_inno';

    // 1. Check Allowed States
    if (!isHold(state) && config.allowedStates && !config.allowedStates.includes(state)) {
        return { valid: false, message: `현재 상태(${state})는 이 작업에 허용되지 않습니다. (허용: ${config.allowedStates.join(', ')})` };
    }

    // 2. Check Source Type
    if (!isHold(state) && config.sourceType) {
        if (config.sourceType === 'stock' && !isStock) {
            return { valid: false, message: `전산실 재고(cjenc_inno)인 자산만 가능합니다. (현재 보유자: ${in_user})` };
        }
        if (config.sourceType === 'user' && isStock) {
            return { valid: false, message: `사용자 보유 중인 자산만 가능합니다. (현재 전산실 재고 상태)` };
        }
    }

    // 3. Check CJ ID if required (skip if requested)
    if (!options.skipCjIdCheck && !config.fixedCjId && !tradeData.cj_id) {
        return { valid: false, message: '사용자(CJ ID)를 선택해주세요.' };
    }

    // 4. Dates Check (재계약 등)
    if (config.requiresDates) {
        if (!tradeData.new_day_of_start || !tradeData.new_day_of_end) {
            return { valid: false, message: '계약 시작일과 종료일을 모두 입력해주세요.' };
        }
    }

    if (config.validate) {
        const ctx = {
            asset_state: state,
            asset_in_user: in_user,
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

    // HOLD 상태면 모든 작업 유형 가능 (기존 정책 유지)
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
