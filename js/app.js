// js/app.js

document.addEventListener('DOMContentLoaded', () => {
    
    // --- State & Managers ---
    const chartManager = new ChartManager();
    let currentResults = null;
    let currentMcResults = null;

    // --- DOM Elements ---
    const calculateBtn = document.getElementById('calculate-btn');
    const themeToggle = document.getElementById('theme-toggle');
    const scenarioSelect = document.getElementById('scenario-select');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    const exportCsvBtn = document.getElementById('export-csv-btn');

    // Auto Toggles
    const autoToggles = document.querySelectorAll('.toggle input[type="checkbox"]');

    // --- Initialize ---
    loadSettingsFromStorage();
    initTheme();
    bindEvents();
    
    // Initial Calculation
    runFullSimulation();

    // --- Core Logic ---

    function getParamsFromForm() {
        return {
            initialCapital: parseFloat(document.getElementById('initial-capital').value) || 0,
            investmentYears: parseInt(document.getElementById('investment-years').value) || 30,
            inflationRate: parseFloat(document.getElementById('inflation-rate').value) || 0,
            
            propertyValue: parseFloat(document.getElementById('property-value').value) || 0,
            monthlyRent: parseFloat(document.getElementById('monthly-rent').value) || 0,
            mortgageRate: parseFloat(document.getElementById('mortgage-rate').value) || 0,
            propertyAppreciation: parseFloat(document.getElementById('property-appreciation').value) || 0,
            brokerFee: parseFloat(document.getElementById('broker-fee').value) || 0,
            lawyerFee: parseFloat(document.getElementById('lawyer-fee').value) || 0,
            maintenanceYearly: parseFloat(document.getElementById('maintenance-yearly').value) || 0,
            vacancyMonths: parseFloat(document.getElementById('vacancy-months').value) || 0,
            
            stockReturn: parseFloat(document.getElementById('stock-return').value) || 0,
            managementFee: parseFloat(document.getElementById('management-fee').value) || 0,
        };
    }

    function updateFormFromScenario(scenarioKey) {
        if (scenarioKey === 'custom') return;
        
        const scenario = CONFIG.SCENARIOS[scenarioKey];
        if (!scenario) return;

        const updateField = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value;
        };

        updateField('inflation-rate', scenario.inflationRate);
        updateField('mortgage-rate', scenario.mortgageRate);
        updateField('property-appreciation', scenario.propertyAppreciation);
        updateField('broker-fee', scenario.brokerFee);
        updateField('lawyer-fee', scenario.lawyerFee);
        updateField('stock-return', scenario.stockReturn);
        updateField('management-fee', scenario.managementFee);

        // Turn ON auto toggles
        autoToggles.forEach(toggle => {
            toggle.checked = true;
            const inputId = toggle.id.replace('auto-', '');
            const input = document.getElementById(inputId);
            if(input) input.disabled = true;
        });
    }

    function formatCurrency(value) {
        return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(value);
    }

    function runFullSimulation() {
        const params = getParamsFromForm();
        saveSettingsToStorage(params);
        
        // 1. Run Standard Simulation
        const calc = new FinancialCalculator(params);
        currentResults = calc.runSimulation();

        // 2. Run Monte Carlo Simulation
        const mc = new MonteCarloSimulation(params, currentResults);
        currentMcResults = mc.run();

        // 3. Update UI
        updateDashboard(currentResults.summary, currentMcResults);
        
        // 4. Update Charts
        chartManager.renderNetWorthChart('netWorthChart', currentResults.yearlyData);
        chartManager.renderMonteCarloChart('monteCarloChart', currentMcResults);
        chartManager.renderFeesChart('feesChart', currentResults.summary);
    }

    function updateDashboard(summary, mcResults) {
        // Summary Cards
        document.getElementById('final-re-net-worth').textContent = formatCurrency(summary.finalReNetWorth);
        document.getElementById('re-roi').textContent = `תשואה כוללת: ${summary.reROI.toFixed(1)}%`;
        
        document.getElementById('final-stock-net-worth').textContent = formatCurrency(summary.finalStockNetWorth);
        document.getElementById('stock-roi').textContent = `תשואה כוללת: ${summary.stockROI.toFixed(1)}%`;

        const winnerEl = document.getElementById('winner-text');
        const winnerDiffEl = document.getElementById('winner-diff');
        
        if (summary.winner === 'real-estate') {
            winnerEl.textContent = 'נדל"ן';
            winnerEl.className = 'card-value real-estate-color';
        } else {
            winnerEl.textContent = 'שוק ההון';
            winnerEl.className = 'card-value stock-color';
        }
        
        winnerDiffEl.textContent = `פער של ${formatCurrency(summary.difference)}`;

        // We can add the win rate to the subtitle of the charts or somewhere in UI if wanted
        // console.log(`MC Win rate: RE ${mcResults.winRate.re}%, Stock ${mcResults.winRate.stock}%`);
    }

    // --- Events ---

    function bindEvents() {
        // Calculate Button
        calculateBtn.addEventListener('click', () => {
            calculateBtn.textContent = 'מחשב...';
            setTimeout(() => {
                runFullSimulation();
                calculateBtn.textContent = 'חשב והשווה';
            }, 50); // slight delay to allow UI to update
        });

        // Tabs
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                tabBtns.forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.param-group').forEach(c => c.classList.remove('active'));
                
                const target = e.target.dataset.target;
                e.target.classList.add('active');
                document.getElementById(target).classList.add('active');
            });
        });

        // Auto Toggles
        autoToggles.forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                const isAuto = e.target.checked;
                const inputId = e.target.id.replace('auto-', '');
                const input = document.getElementById(inputId);
                
                if (input) {
                    input.disabled = isAuto;
                    if (isAuto) {
                        // Re-apply base scenario value when turned auto
                        const scenario = CONFIG.SCENARIOS['base'];
                        
                        // Map input id to scenario key
                        const keyMap = {
                            'inflation-rate': 'inflationRate',
                            'mortgage-rate': 'mortgageRate',
                            'property-appreciation': 'propertyAppreciation',
                            'broker-fee': 'brokerFee',
                            'lawyer-fee': 'lawyerFee',
                            'stock-return': 'stockReturn',
                            'management-fee': 'managementFee'
                        };
                        
                        const key = keyMap[inputId];
                        if (key && scenario[key] !== undefined) {
                            input.value = scenario[key];
                        }
                    }
                }
                
                // If user changes from auto to manual, set scenario to custom
                if (!isAuto) {
                    scenarioSelect.value = 'custom';
                }
            });
        });

        // Scenario Selector
        scenarioSelect.addEventListener('change', (e) => {
            updateFormFromScenario(e.target.value);
            runFullSimulation();
        });

        // Inputs change -> auto custom
        document.querySelectorAll('input[type="number"]').forEach(input => {
            input.addEventListener('input', () => {
                scenarioSelect.value = 'custom';
            });
        });

        // Theme Toggle
        themeToggle.addEventListener('click', () => {
            const isDark = document.body.classList.contains('dark-mode');
            if (isDark) {
                document.body.classList.remove('dark-mode');
                document.body.classList.add('light-mode');
                themeToggle.textContent = '☀️';
                localStorage.setItem('investvision_theme', 'light');
            } else {
                document.body.classList.remove('light-mode');
                document.body.classList.add('dark-mode');
                themeToggle.textContent = '🌙';
                localStorage.setItem('investvision_theme', 'dark');
            }
            chartManager.updateTheme();
        });

        // Export (to be implemented in export.js)
        exportPdfBtn.addEventListener('click', () => {
            if (window.exportToPDF) window.exportToPDF();
        });
        
        exportCsvBtn.addEventListener('click', () => {
            if (window.exportToCSV && currentResults) window.exportToCSV(currentResults.yearlyData);
        });
    }

    function initTheme() {
        const savedTheme = localStorage.getItem('investvision_theme');
        if (savedTheme === 'light') {
            document.body.classList.remove('dark-mode');
            document.body.classList.add('light-mode');
            themeToggle.textContent = '☀️';
        }
    }

    function saveSettingsToStorage(params) {
        // Only save custom values to not override updates in future versions if auto is checked
        localStorage.setItem('investvision_params', JSON.stringify(params));
        localStorage.setItem('investvision_scenario', scenarioSelect.value);
        
        const togglesState = {};
        autoToggles.forEach(toggle => {
            togglesState[toggle.id] = toggle.checked;
        });
        localStorage.setItem('investvision_toggles', JSON.stringify(togglesState));
    }

    function loadSettingsFromStorage() {
        try {
            const savedScenario = localStorage.getItem('investvision_scenario');
            if (savedScenario) {
                scenarioSelect.value = savedScenario;
            }

            const savedParams = JSON.parse(localStorage.getItem('investvision_params'));
            if (savedParams && savedScenario === 'custom') {
                Object.keys(savedParams).forEach(key => {
                    // Convert camelCase to kebab-case to find the DOM element
                    const id = key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
                    const el = document.getElementById(id);
                    if (el) el.value = savedParams[key];
                });
            }

            const savedToggles = JSON.parse(localStorage.getItem('investvision_toggles'));
            if (savedToggles) {
                autoToggles.forEach(toggle => {
                    if (savedToggles[toggle.id] !== undefined) {
                        toggle.checked = savedToggles[toggle.id];
                        const inputId = toggle.id.replace('auto-', '');
                        const input = document.getElementById(inputId);
                        if(input) input.disabled = toggle.checked;
                    }
                });
            }
        } catch (e) {
            console.error("Error loading settings from local storage", e);
        }
    }
});
