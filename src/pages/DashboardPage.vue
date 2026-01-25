<script setup>
import { ref, onMounted } from 'vue';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale, Title } from 'chart.js';
import { Doughnut, Bar } from 'vue-chartjs';
import dashboardApi from '../api/dashboard';

ChartJS.register(ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale, Title);

const loading = ref(true);
const stats = ref(null);
const categoryChartData = ref(null);
const stateChartData = ref(null);
const ageChartData = ref(null);
const expandedCard = ref(null); // 'category', 'state', 'age', 'recent', 'activity'
const expandedYears = ref([]);
const expandedMonths = ref([]);

const toggleYear = (year) => {
    const yStr = String(year);
    const index = expandedYears.value.indexOf(yStr);
    if (index > -1) {
        expandedYears.value.splice(index, 1);
    } else {
        expandedYears.value.push(yStr);
    }
};

const toggleMonth = (year, month) => {
    const key = `${year}-${month}`;
    const index = expandedMonths.value.indexOf(key);
    if (index > -1) {
        expandedMonths.value.splice(index, 1);
    } else {
        expandedMonths.value.push(key);
    }
};

const isYearExpanded = (year) => expandedYears.value.includes(String(year));
const isMonthExpanded = (year, month) => expandedMonths.value.includes(`${year}-${month}`);

const getCatName = (cat) => {
    const names = { new: '신규', out: '출고', in: '입고', ret: '반납', other: '기타' };
    return names[cat] || cat;
};

const getCatCount = (typesObj) => {
    return Object.values(typesObj).reduce((acc, count) => acc + count, 0);
};

const toggleExpand = (type) => {
    expandedCard.value = type;
};

const closeExpand = () => {
    expandedCard.value = null;
};
const categoryChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'right',
        },
        tooltip: {
            callbacks: {
                title: function(context) {
                    const fullLabel = context[0].label || '';
                    // 1. " (퍼센트%)" 부분 제거
                    // 2. 그 앞의 " 숫자" 부분 제거
                    // 예: "4년 초과 10 (5.0%)" -> "4년 초과"
                    // 예: "노트북 150 (45%)" -> "노트북"
                    return fullLabel.split(' (')[0].replace(/\s\d+$/, '');
                },
                label: function() {
                    return '';
                }
            },
            displayColors: false
        }
    }
};

// Custom plugin to show percentages on slices
const doughnutLabelsPlugin = {
    id: 'doughnutLabels',
    afterDraw(chart) {
        const { ctx, data } = chart;
        ctx.save();
        const dataset = data.datasets[0];
        // Calculate total only for visible slices
        const visibleTotal = dataset.data.reduce((acc, val, index) => {
            return chart.getDataVisibility(index) ? acc + val : acc;
        }, 0);
        
        if (visibleTotal === 0) return;

        chart.getDatasetMeta(0).data.forEach((datapoint, index) => {
            // Skip if slice is hidden
            if (!chart.getDataVisibility(index)) return;

            const { x, y } = datapoint.tooltipPosition();
            const val = dataset.data[index];
            // Percentage relative to the currently visible total
            const percentage = ((val / visibleTotal) * 100).toFixed(1);
            
            // Only show if slice is large enough (e.g., > 4%)
            if (parseFloat(percentage) > 4) {
                ctx.fillStyle = 'white';
                ctx.shadowBlur = 2;
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${percentage}%`, x, y);
            }
        });
        ctx.restore();
    }
};
const stateChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            display: false
        },
        tooltip: {
            callbacks: {
                title: function(context) {
                    const label = context[0].label || '';
                    // 콤마나 개행으로 분리된 배열 형태일 경우 첫 번째 요소만 사용
                    if (Array.isArray(label)) return label[0];
                    return String(label).split(',')[0];
                },
                label: function() {
                    return '';
                }
            },
            displayColors: false
        }
    }
};

const fetchDashboardData = async () => {
    try {
        loading.value = true;
        const data = await dashboardApi.getDashboardStats();
        stats.value = data;

        // Prepare Category Chart Data
        const totalCategoryCount = data.category_stats.reduce((acc, curr) => acc + curr.count, 0);
        const sortedCategoryStats = [...data.category_stats].sort((a, b) => b.count - a.count);
        const categoryLabels = sortedCategoryStats.map(item => {
            const pct = totalCategoryCount > 0 ? ((item.count / totalCategoryCount) * 100).toFixed(1) : 0;
            return `${item.category || '미분류'} ${item.count} (${pct}%)`;
        });
        const categoryCounts = sortedCategoryStats.map(item => item.count);
        const backgroundColors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
        ];
        
        categoryChartData.value = {
            labels: categoryLabels,
            datasets: [{
                backgroundColor: backgroundColors,
                data: categoryCounts
            }]
        };

        // Sort State Stats by count descending
        const sortedStateStats = [...data.state_stats].sort((a, b) => b.count - a.count);

        const stateLabelsMap = {
            'in-use': '사용중',
            'it-room-stock': '전산실재고',
            'wait': '출고대기',
            'rent': '대여중',
            'repair': '수리중',
            'process-ter': '입고처리중'
        };
        const stateLabels = sortedStateStats.map(item => {
            const label = stateLabelsMap[item.state] || item.state || '미정';
            return [label, item.count]; // 배열로 리턴하여 개행 처리
        });
        const stateCounts = sortedStateStats.map(item => item.count);
        
        stateChartData.value = {
            labels: stateLabels,
            datasets: [{
                label: '자산 수',
                backgroundColor: '#36A2EB',
                data: stateCounts
            }]
        };

        // 7. 장비 노후도 차트 데이터 준비
        if (data.age_stats) {
            const totalAgeCount = data.age_stats.reduce((acc, curr) => acc + curr.count, 0);
            const ageLabels = data.age_stats.map(item => {
                const pct = totalAgeCount > 0 ? ((item.count / totalAgeCount) * 100).toFixed(1) : 0;
                return `${item.age_group} ${item.count} (${pct}%)`;
            });
            const ageCounts = data.age_stats.map(item => item.count);
            const ageColors = ['#4BC0C0', '#36A2EB', '#FFCE56', '#FF6384', '#C9CBCF'];

            ageChartData.value = {
                labels: ageLabels,
                datasets: [{
                    backgroundColor: ageColors,
                    data: ageCounts
                }]
            };
        }

    } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
    } finally {
        loading.value = false;
    }
};

onMounted(() => {
    fetchDashboardData();
});
</script>

<template>
    <div class="page-content">
        <h1>대시보드</h1>
        
        <div v-if="loading" class="loading-state">
            <div class="spinner"></div> 로딩 중...
        </div>

        <div v-else-if="stats" class="dashboard-content">
            <!-- Summary Cards -->
            <div class="stats-grid">
                <div class="stats-card">
                    <div class="card-icon blue">
                        <img src="/images/boxes.png" alt="Assets" class="icon-img" />
                    </div>
                    <div class="card-info">
                        <h3>총 자산</h3>
                        <p class="number">{{ stats.total_assets }}</p>
                    </div>
                </div>
                <div class="stats-card">
                    <div class="card-icon green">
                        <img src="/images/groups.png" alt="Users" class="icon-img" />
                    </div>
                    <div class="card-info">
                        <h3>총 사용자</h3>
                        <p class="number">{{ stats.total_users }}</p>
                    </div>
                </div>
                <!-- Add more summary cards if needed -->
            </div>

            <!-- Charts Section -->
            <div class="charts-grid">
                <div class="card chart-card">
                    <div class="card-header">
                        <h3>자산 분류별 현황</h3>
                        <button class="expand-btn" @click="toggleExpand('category')" title="확대">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                        </button>
                    </div>
                    <div class="chart-wrapper">
                        <Doughnut v-if="categoryChartData" :data="categoryChartData" :options="categoryChartOptions" :plugins="[doughnutLabelsPlugin]" />
                    </div>
                </div>
                <div class="card chart-card">
                    <div class="card-header">
                        <h3>자산 상태별 현황</h3>
                        <button class="expand-btn" @click="toggleExpand('state')" title="확대">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                        </button>
                    </div>
                    <div class="chart-wrapper">
                        <Bar v-if="stateChartData" :data="stateChartData" :options="stateChartOptions" />
                    </div>
                </div>
                <div class="card chart-card">
                    <div class="card-header">
                        <h3>장비 노후도 현황</h3>
                        <button class="expand-btn" @click="toggleExpand('age')" title="확대">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                        </button>
                    </div>
                    <div class="chart-wrapper">
                        <Doughnut v-if="ageChartData" :data="ageChartData" :options="categoryChartOptions" :plugins="[doughnutLabelsPlugin]" />
                    </div>
                </div>
            </div>

            <!-- New/Return Activity Section -->
            <div class="card activity-card">
                <div class="card-header">
                    <h3>연도별/월별 작업 통계</h3>
                    <button class="expand-btn" @click="toggleExpand('activity')" title="확대">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                    </button>
                </div>
                <div class="activity-table-wrapper">
                    <table class="activity-table">
                        <thead>
                            <tr>
                                <th>기간</th>
                                <th class="text-right">신규</th>
                                <th class="text-right">출고</th>
                                <th class="text-right">입고</th>
                                <th class="text-right">반납</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody v-for="yearData in stats.activity_stats" :key="yearData.year">
                            <tr class="year-row" @click="toggleYear(yearData.year)">
                                <td class="year-label">
                                    <span class="toggle-icon">{{ isYearExpanded(yearData.year) ? '▼' : '▶' }}</span>
                                    {{ yearData.year }}년
                                </td>
                                <td class="text-right count-new">{{ yearData.new_count }}</td>
                                <td class="text-right count-out">{{ yearData.out_count }}</td>
                                <td class="text-right count-in">{{ yearData.in_count }}</td>
                                <td class="text-right count-return">{{ yearData.return_count }}</td>
                                <td class="text-center"><span class="badge">YEAR</span></td>
                            </tr>
                            <template v-if="isYearExpanded(yearData.year)">
                                <template v-for="monthData in yearData.months" :key="`${yearData.year}-${monthData.month}`">
                                    <tr class="month-row" @click="toggleMonth(yearData.year, monthData.month)">
                                        <td class="month-label">
                                            <span class="toggle-icon-small">{{ isMonthExpanded(yearData.year, monthData.month) ? '▼' : '▶' }}</span>
                                            {{ monthData.month }}월
                                        </td>
                                        <td class="text-right">{{ monthData.new_count }}</td>
                                        <td class="text-right">{{ monthData.out_count }}</td>
                                        <td class="text-right">{{ monthData.in_count }}</td>
                                        <td class="text-right">{{ monthData.return_count }}</td>
                                        <td></td>
                                    </tr>
                                    <tr v-if="isMonthExpanded(yearData.year, monthData.month)" class="detail-row">
                                        <td colspan="6">
                                            <div class="detail-grid">
                                                <div v-for="cat in ['new', 'out', 'in', 'ret', 'other']" :key="cat" class="detail-cat-box" v-show="monthData.details[cat] && Object.keys(monthData.details[cat]).length > 0">
                                                    <div class="cat-header-inner">
                                                        <span class="cat-tag" :class="`tag-${cat}`">{{ getCatName(cat) }}</span>
                                                        <span class="cat-total">총 {{ getCatCount(monthData.details[cat]) }}건</span>
                                                    </div>
                                                    <div class="detail-items">
                                                        <div v-for="(count, type) in monthData.details[cat]" :key="type" class="detail-item">
                                                            <span class="item-type">{{ type }}</span>
                                                            <span class="item-count">{{ count }}건</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                </template>
                            </template>
                        </tbody>
                    </table>
                </div>
            </div>


        </div>

        <!-- Expanded Modal -->
        <div v-if="expandedCard" class="expand-modal-overlay" @click.self="closeExpand">
            <div class="expand-modal-content">
                <div class="expand-modal-header">
                    <div style="display: flex; align-items: center; gap: 20px;">
                        <h2 style="margin: 0;">
                            {{ expandedCard === 'category' ? '자산 분류별 현황' : 
                               expandedCard === 'state' ? '자산 상태별 현황' : 
                               expandedCard === 'age' ? '장비 노후도 현황' :
                               '연도별/월별 작업 통계' }}
                        </h2>
                        <div v-if="['category', 'state', 'age'].includes(expandedCard)" class="total-assets-badge">
                            총 자산: {{ stats.total_assets }}
                        </div>
                    </div>
                    <button class="close-expand-btn" @click="closeExpand">✕</button>
                </div>
                <div class="expand-modal-body">
                    <div v-if="expandedCard === 'category'" class="chart-wrapper expanded">
                        <Doughnut :data="categoryChartData" :options="categoryChartOptions" :plugins="[doughnutLabelsPlugin]" />
                    </div>
                    <div v-if="expandedCard === 'state'" class="chart-wrapper expanded">
                        <Bar :data="stateChartData" :options="stateChartOptions" />
                    </div>
                    <div v-if="expandedCard === 'age'" class="chart-wrapper expanded">
                        <Doughnut :data="ageChartData" :options="categoryChartOptions" :plugins="[doughnutLabelsPlugin]" />
                    </div>
                    <div v-if="expandedCard === 'activity'" class="table-container expanded">
                         <table class="activity-table expanded">
                            <thead>
                                <tr>
                                    <th>기간</th>
                                    <th class="text-right">신규</th>
                                    <th class="text-right">출고</th>
                                    <th class="text-right">입고</th>
                                    <th class="text-right">반납</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody v-for="yearData in stats.activity_stats" :key="'exp-'+yearData.year">
                                <tr class="year-row" @click="toggleYear(yearData.year)">
                                    <td class="year-label">
                                        <span class="toggle-icon">{{ isYearExpanded(yearData.year) ? '▼' : '▶' }}</span>
                                        {{ yearData.year }}년
                                    </td>
                                    <td class="text-right count-new">{{ yearData.new_count }}</td>
                                    <td class="text-right count-out">{{ yearData.out_count }}</td>
                                    <td class="text-right count-in">{{ yearData.in_count }}</td>
                                    <td class="text-right count-return">{{ yearData.return_count }}</td>
                                    <td class="text-center"><span class="badge-year">YEAR</span></td>
                                </tr>
                                <template v-if="isYearExpanded(yearData.year)">
                                    <template v-for="monthData in yearData.months" :key="`exp-${yearData.year}-${monthData.month}`">
                                        <tr class="month-row" @click.stop="toggleMonth(yearData.year, monthData.month)">
                                            <td class="month-label">
                                                <span class="toggle-icon-small">{{ isMonthExpanded(yearData.year, monthData.month) ? '▼' : '▶' }}</span>
                                                {{ monthData.month }}월
                                            </td>
                                            <td class="text-right">{{ monthData.new_count }}</td>
                                            <td class="text-right">{{ monthData.out_count }}</td>
                                            <td class="text-right">{{ monthData.in_count }}</td>
                                            <td class="text-right">{{ monthData.return_count }}</td>
                                            <td></td>
                                        </tr>
                                        <tr v-if="isMonthExpanded(yearData.year, monthData.month)" class="detail-row">
                                            <td colspan="6">
                                                <div class="detail-grid expanded">
                                                    <div v-for="cat in ['new', 'out', 'in', 'ret', 'other']" :key="cat" class="detail-cat-box" v-show="monthData.details[cat] && Object.keys(monthData.details[cat]).length > 0">
                                                        <div class="cat-header-inner large">
                                                            <span class="cat-tag large" :class="`tag-${cat}`">{{ getCatName(cat) }}</span>
                                                            <span class="cat-total large">총 {{ getCatCount(monthData.details[cat]) }}건</span>
                                                        </div>
                                                        <div class="detail-items">
                                                            <div v-for="(count, type) in monthData.details[cat]" :key="type" class="detail-item-large">
                                                                <span class="type-name">{{ type }}</span>
                                                                <span class="type-count">{{ count }}건</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    </template>
                                </template>
                            </tbody>
                        </table>
                    </div>

                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>






.stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 30px;
    width: 100%;
}

.stats-card {
    background: var(--card-bg);
    padding: 24px;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    display: flex;
    align-items: center;
    gap: 20px;
    transition: transform 0.2s, box-shadow 0.2s;
    min-width: 0;
}

.stats-card:hover {
    transform: translateY(-5px);
    box-shadow: var(--shadow-md);
}

.card-icon {
    width: 60px;
    height: 60px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.icon-img {
    width: 32px;
    height: 32px;
    object-fit: contain;
}

.card-icon.blue { background-color: #e3f2fd; color: #1976d2; }
.card-icon.green { background-color: #e8f5e9; color: #2e7d32; }
.card-icon.orange { background-color: #fff3e0; color: #ef6c00; }
.card-icon.purple { background-color: #f3e5f5; color: #7b1fa2; }

.card-info h3 {
    margin: 0;
    font-size: 14px;
    color: #666;
    font-weight: 500;
}

.card-info .number {
    margin: 5px 0 0;
    font-size: 28px;
    font-weight: 700;
    color: #333;
}

.charts-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 30px;
    width: 100%;
}

@media (max-width: 1150px) {
    .stats-grid,
    .charts-grid {
        grid-template-columns: 1fr;
    }
}

.chart-card {
    background: var(--card-bg);
    padding: 24px;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    min-width: 0;
}

.chart-card h3 {
    margin-top: 0;
    margin-bottom: 20px;
    font-size: 16px;
    color: var(--text-muted);
}

.chart-wrapper {
    height: 300px;
    position: relative;
}

.table-container {
    overflow-x: auto;
}

.data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
}

.data-table th, .data-table td {
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid var(--border-light);
}

.data-table th {
    background-color: var(--bg-muted);
    color: var(--text-muted);
    font-weight: 600;
}

.data-table tr:hover {
    background-color: var(--bg-muted);
}

.badge-status {
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-weight: 600;
}

.badge-status.useable { background-color: #e8f5e9; color: #2e7d32; }
.badge-status.rent { background-color: #e3f2fd; color: #1976d2; }
.badge-status.repair { background-color: #fff3e0; color: #ef6c00; }

.empty-state {
    text-align: center;
    color: #999;
    padding: 20px;
}

/* Expandable Card Styles */
.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.card-header h3 {
    margin: 0 !important;
}

.expand-btn {
    background: none;
    border: none;
    font-size: 18px;
    color: #999;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.2s;
    line-height: 1;
}

.expand-btn:hover {
    background: #f0f0f0;
    color: var(--brand-blue);
}

.activity-card {
    margin-bottom: 30px;
    background: var(--card-bg);
    padding: 24px;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
}

.activity-table {
    width: 100%;
    border-collapse: collapse;
}

.activity-table th {
    background: var(--bg-muted);
    padding: 12px;
    border-bottom: 2px solid var(--border-light);
    text-align: left;
    font-size: 13px;
    color: var(--text-muted);
}

.activity-table td {
    padding: 12px;
    border-bottom: 1px solid var(--border-light);
    font-size: 14px;
}

.year-row {
    background-color: #fcfcfc;
    cursor: pointer;
    transition: background-color 0.2s;
    font-weight: 700;
}

.year-row:hover {
    background-color: #f0f7ff;
}

.month-label {
    padding-left: 35px !important;
    color: var(--text-muted);
    font-weight: 500;
}

.detail-grid {
    padding: 10px 10px 10px 45px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.detail-cat-box {
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: white;
    padding: 12px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-light);
    align-self: stretch;
}

.cat-header-inner {
    display: flex;
    align-items: center;
    gap: 10px;
    border-bottom: 2px solid var(--bg-muted);
    padding-bottom: 8px;
}

.cat-total {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-light);
}

.cat-tag {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    color: white;
    font-weight: bold;
    min-width: 35px;
    text-align: center;
}

.tag-new { background-color: var(--age-warning); }
.tag-in { background-color: var(--age-safe); }
.tag-out { background-color: var(--brand-blue); }
.tag-ret { background-color: var(--confirm-color); }
.tag-other { background-color: var(--text-light); }

.detail-items {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
}

.detail-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-main);
    min-width: 140px;
}

.item-type {
    color: var(--text-muted);
    flex: 1;
}

.item-count {
    font-weight: 700;
    color: var(--text-main);
    background: var(--bg-color);
    padding: 2px 6px;
    border-radius: 4px;
    min-width: 35px;
    text-align: center;
}

.count-new { color: var(--age-warning); font-weight: 700; }
.count-in { color: var(--age-safe); font-weight: 700; }
.count-out { color: var(--brand-blue); font-weight: 700; }
.count-return { color: var(--confirm-color); font-weight: 700; }

.expand-btn {
    background: none;
    border: none;
    font-size: 18px;
    color: #999;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.2s;
    line-height: 1;
}

.expand-btn:hover {
    background: #f0f0f0;
    color: var(--brand-blue);
}

/* Expand Modal Styles */
.expand-modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    padding: 40px;
}

.expand-modal-content {
    background: white;
    border-radius: var(--radius-lg);
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
}

.expand-modal-header {
    background: var(--bg-dark);
    color: white;
    padding: 15px 25px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.expand-modal-header h2 {
    margin: 0;
    font-size: 20px;
    color: white;
}

.total-assets-badge {
    background: rgba(255, 255, 255, 0.15);
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 600;
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    gap: 8px;
}

.close-expand-btn {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    font-size: 24px;
    cursor: pointer;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background 0.2s;
}

.expand-modal-body {
    flex: 1;
    overflow: auto;
    padding: 20px;
    background-color: var(--bg-muted);
}

.chart-wrapper.expanded {
    height: 100%;
    min-height: 500px;
}
</style>
