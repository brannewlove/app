/**
 * Advanced Search Query Parser
 * Supports: col:val, AND, OR, >, <, =, !=, (), and global search
 */
export const parseAndFilter = (item, query, searchFields = []) => {
    if (!query) return true;

    // "이름 (조건)" 형식 검사 및 실제 조건 추출
    let actualQuery = query;
    const bracketMatch = query.match(/^.+ \((.+)\)$/);
    if (bracketMatch) {
        actualQuery = bracketMatch[1];
    }

    // 특수 예약어 처리 (컴포넌트 단에서 filtering 로직을 직접 수행하는 경우)
    if (actualQuery === '1인 다PC 보유자' || actualQuery === '가용재고') return true;

    // 이후 로직에서 query 대신 actualQuery 사용
    if (!actualQuery.includes(':') && !actualQuery.includes('>') && !actualQuery.includes('<') && !actualQuery.includes('OR') && !actualQuery.includes('AND')) {
        const keywords = actualQuery.toLowerCase().split(/\s+/).filter(k => k.length > 0);
        const itemString = (searchFields.length > 0
            ? searchFields.map(f => item[f])
            : Object.values(item)
        ).map(v => String(v).toLowerCase()).join(' ');
        return keywords.every(keyword => itemString.includes(keyword));
    }

    // 2. 고령화된 파싱 로직 (단순화된 버전의 토큰화 및 평가)
    const tokens = actualQuery.match(/\(|\)|"([^"]*)"|(\w+)([:><=!]+)([^ ")]+)|"([^"]*)"|\S+/g);
    if (!tokens) return true;

    try {
        return evaluateTokens(item, tokens);
    } catch (e) {
        console.error('Query parsing error:', e);
        return true;
    }
};

const evaluateTokens = (item, tokens) => {
    // 실제 복잡한 파서 트리 대신 간단한 AND/OR 우선순위 처리
    // 1차: OR로 나누기 (OR의 우선순위가 낮음)
    let orGroups = [];
    let currentGroup = [];
    let parenDepth = 0;

    for (let token of tokens) {
        if (token === '(') parenDepth++;
        if (token === ')') parenDepth--;

        if (token === 'OR' && parenDepth === 0) {
            orGroups.push(currentGroup);
            currentGroup = [];
        } else {
            currentGroup.push(token);
        }
    }
    orGroups.push(currentGroup);

    // 어떤 그룹이라도 참이면 전체 참 (OR 로직)
    return orGroups.some(group => {
        if (group.length === 0) return false;

        // 2차: AND 처리
        let andGroups = [];
        let subGroup = [];
        let pDepth = 0;
        for (let t of group) {
            if (t === '(') pDepth++;
            if (t === ')') pDepth--;
            if (t === 'AND' && pDepth === 0) {
                andGroups.push(subGroup);
                subGroup = [];
            } else {
                subGroup.push(t);
            }
        }
        andGroups.push(subGroup);

        // 모든 그룹이 참이어야 함 (AND 로직)
        return andGroups.every(tokens => evaluateAtomic(item, tokens));
    });
};

const evaluateAtomic = (item, tokens) => {
    if (tokens.length === 0) return true;

    // 괄호 제거
    if (tokens[0] === '(' && tokens[tokens.length - 1] === ')') {
        return evaluateTokens(item, tokens.slice(1, -1));
    }

    const token = tokens.join(' ');

    // 비교 연산 처리 (col:val, col>val 등)
    const match = token.match(/^(\w+)([:><=!]+)(.+)$/);
    if (match) {
        const [_, field, op, value] = match;
        const itemVal = item[field];
        const cleanValue = value.replace(/"/g, '');

        if (itemVal === undefined) return false;

        const v1 = isNaN(itemVal) ? String(itemVal).toLowerCase() : parseFloat(itemVal);
        const v2 = isNaN(cleanValue) ? String(cleanValue).toLowerCase() : parseFloat(cleanValue);

        switch (op) {
            case ':': return String(itemVal).toLowerCase().includes(String(cleanValue).toLowerCase());
            case '=': case '==': return v1 == v2;
            case '!=': return v1 != v2;
            case '>': return v1 > v2;
            case '<': return v1 < v2;
            case '>=': return v1 >= v2;
            case '<=': return v1 <= v2;
            default: return false;
        }
    }

    // 일반 키워드 검색
    const keyword = token.toLowerCase().replace(/"/g, '');
    const itemString = Object.values(item).map(v => String(v).toLowerCase()).join(' ');
    return itemString.includes(keyword);
};
