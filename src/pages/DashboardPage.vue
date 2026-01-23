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
const categoryChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'right',
        }
    }
};
const stateChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            display: false
        }
    }
};

const fetchDashboardData = async () => {
    try {
        loading.value = true;
        const data = await dashboardApi.getDashboardStats();
        stats.value = data;

        // Prepare Category Chart Data
        const categoryLabels = data.category_stats.map(item => item.category || '미분류');
        const categoryCounts = data.category_stats.map(item => item.count);
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

        // Prepare State Chart Data
        const stateLabels = data.state_stats.map(item => item.state || '미정');
        const stateCounts = data.state_stats.map(item => item.count);
        
        stateChartData.value = {
            labels: stateLabels,
            datasets: [{
                label: '자산 수',
                backgroundColor: '#36A2EB',
                data: stateCounts
            }]
        };

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
    <div class="dashboard-container">
        <h1 class="page-title">대시보드</h1>
        
        <div v-if="loading" class="loading-state">
            <div class="spinner"></div> 로딩 중...
        </div>

        <div v-else-if="stats" class="dashboard-content">
            <!-- Summary Cards -->
            <div class="summary-cards">
                <div class="card summary-card">
                    <div class="card-icon blue">📦</div>
                    <div class="card-info">
                        <h3>총 자산</h3>
                        <p class="number">{{ stats.total_assets }}</p>
                    </div>
                </div>
                <div class="card summary-card">
                    <div class="card-icon green">👥</div>
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
                    <h3>자산 분류별 현황</h3>
                    <div class="chart-wrapper">
                        <Doughnut v-if="categoryChartData" :data="categoryChartData" :options="categoryChartOptions" />
                    </div>
                </div>
                <div class="card chart-card">
                    <h3>자산 상태별 현황</h3>
                    <div class="chart-wrapper">
                        <Bar v-if="stateChartData" :data="stateChartData" :options="stateChartOptions" />
                    </div>
                </div>
            </div>

            <!-- Recent Activity -->
            <div class="card recent-activity-card">
                <h3>최근 거래 이력</h3>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>날짜</th>
                                <th>작업유형</th>
                                <th>자산번호</th>
                                <th>모델명</th>
                                <th>사용자</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="trade in stats.recent_trades" :key="trade.trade_id">
                                <td>{{ trade.work_date }}</td>
                                <td><span class="badge">{{ trade.work_type }}</span></td>
                                <td>{{ trade.asset_number }}</td>
                                <td>{{ trade.model }}</td>
                                <td>{{ trade.cj_id }}</td>
                            </tr>
                            <tr v-if="stats.recent_trades.length === 0">
                                <td colspan="5" class="empty-state">최근 이력이 없습니다.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.dashboard-container {
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
}

.page-title {
    font-size: 24px;
    font-weight: 700;
    color: #333;
    margin-bottom: 25px;
}

.loading-state {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 300px;
    font-size: 18px;
    color: #666;
    gap: 10px;
}

.spinner {
    width: 24px;
    height: 24px;
    border: 3px solid #f3f3f3;
    border-top: 3px solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.summary-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
}

.card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    border: 1px solid #eee;
    padding: 24px;
    transition: transform 0.2s, box-shadow 0.2s;
}

.card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 12px rgba(0, 0, 0, 0.1);
}

.summary-card {
    display: flex;
    align-items: center;
    gap: 20px;
}

.card-icon {
    width: 60px;
    height: 60px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30px;
}

.card-icon.blue { background-color: #e3f2fd; color: #1976d2; }
.card-icon.green { background-color: #e8f5e9; color: #2e7d32; }

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
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
}

.chart-card h3 {
    margin-top: 0;
    margin-bottom: 20px;
    font-size: 16px;
    color: #444;
}

.chart-wrapper {
    height: 300px;
    position: relative;
}

.recent-activity-card h3 {
    margin-top: 0;
    margin-bottom: 20px;
    font-size: 18px;
    color: #333;
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
    border-bottom: 1px solid #eee;
}

.data-table th {
    background-color: #f8f9fa;
    color: #666;
    font-weight: 600;
}

.data-table tr:hover {
    background-color: #f8f9fa;
}

.badge {
    padding: 4px 8px;
    border-radius: 4px;
    background-color: #e0e0e0;
    font-size: 12px;
    font-weight: 500;
    color: #333;
}

.empty-state {
    text-align: center;
    color: #999;
    padding: 20px;
}
</style>
