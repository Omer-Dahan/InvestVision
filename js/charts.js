// js/charts.js

class ChartManager {
    constructor() {
        this.netWorthChart = null;
        this.monteCarloChart = null;
        this.feesChart = null;
        
        // Setup Chart.js defaults for dark/light mode compatibility
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.color = this.getTextColor();
    }

    getTextColor() {
        return document.body.classList.contains('light-mode') ? '#475569' : '#94a3b8';
    }
    
    getGridColor() {
        return document.body.classList.contains('light-mode') ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
    }

    updateTheme() {
        const textColor = this.getTextColor();
        const gridColor = this.getGridColor();
        
        Chart.defaults.color = textColor;
        
        const updateChartTheme = (chart) => {
            if (!chart) return;
            if (chart.options.scales.x) {
                chart.options.scales.x.grid.color = gridColor;
                chart.options.scales.x.ticks.color = textColor;
            }
            if (chart.options.scales.y) {
                chart.options.scales.y.grid.color = gridColor;
                chart.options.scales.y.ticks.color = textColor;
            }
            chart.options.plugins.legend.labels.color = textColor;
            chart.update();
        };

        updateChartTheme(this.netWorthChart);
        updateChartTheme(this.monteCarloChart);
        updateChartTheme(this.feesChart);
    }

    renderNetWorthChart(canvasId, yearlyData) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        
        if (this.netWorthChart) {
            this.netWorthChart.destroy();
        }

        const labels = yearlyData.map(d => `שנה ${d.year}`);
        const reData = yearlyData.map(d => Math.round(d.reNetWorth));
        const stockData = yearlyData.map(d => Math.round(d.stockPortfolioValue));

        this.netWorthChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'שווי נקי נדל"ן (₪)',
                        data: reData,
                        borderColor: '#10b981', // green
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'שווי נקי שוק ההון (₪)',
                        data: stockData,
                        borderColor: '#8b5cf6', // purple
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true
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
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₪' + (value / 1000000).toFixed(1) + 'M';
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
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

    renderMonteCarloChart(canvasId, mcResults) {
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
                        label: 'נדל"ן',
                        data: [mcResults.percentiles.re.p5, mcResults.percentiles.re.p50, mcResults.percentiles.re.p95],
                        backgroundColor: '#10b981',
                        borderRadius: 4
                    },
                    {
                        label: 'שוק ההון',
                        data: [mcResults.percentiles.stock.p5, mcResults.percentiles.stock.p50, mcResults.percentiles.stock.p95],
                        backgroundColor: '#8b5cf6',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₪' + (value / 1000000).toFixed(1) + 'M';
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
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
                    backgroundColor: [
                        '#059669', // Darker green
                        '#34d399', // Lighter green
                        '#6d28d9', // Darker purple
                        '#a78bfa'  // Lighter purple
                    ],
                    borderWidth: 2,
                    borderColor: document.body.classList.contains('light-mode') ? '#ffffff' : '#0f172a'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                    },
                    tooltip: {
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
