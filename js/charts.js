// js/charts.js

class ChartManager {
    constructor() {
        this.netWorthChart = null;
        this.monteCarloChart = null;
        this.feesChart = null;
        
        // Setup Chart.js defaults for dark/light mode compatibility
        Chart.defaults.font.family = "'Heebo', system-ui, sans-serif";
        Chart.defaults.color = this.getTextColor();
    }

    isLight() {
        return document.body.classList.contains('light-mode');
    }

    getTextColor() {
        return this.isLight() ? '#6b6f78' : '#9b9ca3';
    }

    getGridColor() {
        return this.isLight() ? 'rgba(28,25,23,0.06)' : 'rgba(255,255,255,0.06)';
    }

    // Semantic accents — terracotta (property) vs teal (markets)
    getReColor() { return this.isLight() ? '#b5634a' : '#d98a6a'; }
    getStockColor() { return this.isLight() ? '#2c6f66' : '#5fb3a8'; }

    updateTheme() {
        const textColor = this.getTextColor();
        const gridColor = this.getGridColor();
        
        Chart.defaults.color = textColor;
        
        const updateChartTheme = (chart) => {
            if (!chart) return;
            const scales = chart.options.scales || {};
            if (scales.x) {
                scales.x.grid.color = gridColor;
                scales.x.ticks.color = textColor;
            }
            if (scales.y) {
                scales.y.grid.color = gridColor;
                scales.y.ticks.color = textColor;
            }
            chart.options.plugins.legend.labels.color = textColor;
            chart.update();
        };

        updateChartTheme(this.netWorthChart);
        updateChartTheme(this.monteCarloChart);
        updateChartTheme(this.feesChart);
    }

    renderNetWorthChart(canvasId, yearlyData, seriesLabels = { re: 'נדל"ן', stock: 'שוק ההון' }) {
        const ctx = document.getElementById(canvasId).getContext('2d');

        if (this.netWorthChart) {
            this.netWorthChart.destroy();
        }

        const labels = yearlyData.map(d => `שנה ${d.year}`);
        const reData = yearlyData.map(d => Math.round(d.reNetWorth));
        const stockData = yearlyData.map(d => Math.round(d.stockPortfolioValue));

        const reColor = this.getReColor();
        const stockColor = this.getStockColor();
        const reFill = ctx.createLinearGradient(0, 0, 0, 360);
        reFill.addColorStop(0, this.isLight() ? 'rgba(181,99,74,0.16)' : 'rgba(217,138,106,0.20)');
        reFill.addColorStop(1, 'rgba(0,0,0,0)');
        const stockFill = ctx.createLinearGradient(0, 0, 0, 360);
        stockFill.addColorStop(0, this.isLight() ? 'rgba(44,111,102,0.16)' : 'rgba(95,179,168,0.20)');
        stockFill.addColorStop(1, 'rgba(0,0,0,0)');

        this.netWorthChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: seriesLabels.re,
                        data: reData,
                        borderColor: reColor,
                        backgroundColor: reFill,
                        borderWidth: 2.5,
                        tension: 0.35,
                        fill: true,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        pointHoverBackgroundColor: reColor
                    },
                    {
                        label: seriesLabels.stock,
                        data: stockData,
                        borderColor: stockColor,
                        backgroundColor: stockFill,
                        borderWidth: 2.5,
                        tension: 0.35,
                        fill: true,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        pointHoverBackgroundColor: stockColor
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: this.getTextColor(), maxTicksLimit: 8 }
                    },
                    y: {
                        beginAtZero: true,
                        border: { display: false },
                        grid: { color: this.getGridColor() },
                        ticks: {
                            color: this.getTextColor(),
                            callback: function(value) {
                                return '₪' + (value / 1000000).toFixed(1) + 'M';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        align: 'end',
                        labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, padding: 16, color: this.getTextColor() }
                    },
                    tooltip: {
                        rtl: true,
                        padding: 12,
                        boxPadding: 6,
                        usePointStyle: true,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }

    renderMonteCarloChart(canvasId, mcResults, seriesLabels = { re: 'נדל"ן', stock: 'שוק ההון' }) {
        const ctx = document.getElementById(canvasId).getContext('2d');

        if (this.monteCarloChart) {
            this.monteCarloChart.destroy();
        }

        this.monteCarloChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['5% הגרועים ביותר', 'חציון (50%)', '5% הטובים ביותר'],
                datasets: [
                    {
                        label: seriesLabels.re,
                        data: [mcResults.percentiles.re.p5, mcResults.percentiles.re.p50, mcResults.percentiles.re.p95],
                        backgroundColor: this.getReColor(),
                        borderRadius: 5,
                        maxBarThickness: 46
                    },
                    {
                        label: seriesLabels.stock,
                        data: [mcResults.percentiles.stock.p5, mcResults.percentiles.stock.p50, mcResults.percentiles.stock.p95],
                        backgroundColor: this.getStockColor(),
                        borderRadius: 5,
                        maxBarThickness: 46
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: this.getTextColor() }
                    },
                    y: {
                        beginAtZero: true,
                        border: { display: false },
                        grid: { color: this.getGridColor() },
                        ticks: {
                            color: this.getTextColor(),
                            callback: function(value) {
                                return '₪' + (value / 1000000).toFixed(1) + 'M';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        align: 'end',
                        labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, padding: 14, color: this.getTextColor() }
                    },
                    tooltip: {
                        rtl: true,
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(context.parsed.y);
                            }
                        }
                    }
                }
            }
        });
    }

    renderFeesChart(canvasId, summary) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        
        if (this.feesChart) {
            this.feesChart.destroy();
        }

        const isLight = this.isLight();
        this.feesChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['מיסי נדל"ן (רכישה ושבח)', 'עמלות נדל"ן', 'מס שוק ההון', 'עמלות שוק ההון'],
                datasets: [{
                    data: [
                        summary.totalReTaxes,
                        summary.totalReFees,
                        summary.totalStockTaxes,
                        summary.totalStockFees
                    ],
                    backgroundColor: isLight
                        ? ['#9e4f38', '#d49a82', '#235a53', '#7fb3aa']   // warm RE pair · teal stock pair
                        : ['#c9785a', '#e3ab90', '#3f8c82', '#8bcabf'],
                    borderWidth: 2,
                    borderColor: isLight ? '#ffffff' : '#1c1e25',
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '62%',
                plugins: {
                    legend: {
                        position: 'right',
                        rtl: true,
                        labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, padding: 12, color: this.getTextColor() }
                    },
                    tooltip: {
                        rtl: true,
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                return ' ' + new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(context.raw);
                            }
                        }
                    }
                }
            }
        });
    }
}
