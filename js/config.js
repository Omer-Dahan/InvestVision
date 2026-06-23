// js/config.js

const CONFIG = {
    // Default Scenarios
    SCENARIOS: {
        base: {
            inflationRate: 1.5,
            mortgageRate: 5.0,
            propertyAppreciation: 5.0,
            brokerFee: 2.0,
            lawyerFee: 1.0,
            stockReturn: 9.5,
            managementFee: 0.1
        },
        optimistic: { // Optimistic for Real Estate
            inflationRate: 2.0,
            mortgageRate: 3.5,
            propertyAppreciation: 7.0,
            brokerFee: 1.5,
            lawyerFee: 0.5,
            stockReturn: 7.0,
            managementFee: 0.15
        },
        pessimistic: { // Pessimistic for Real Estate
            inflationRate: 1.0,
            mortgageRate: 6.0,
            propertyAppreciation: 2.0,
            brokerFee: 2.0,
            lawyerFee: 1.0,
            stockReturn: 10.0,
            managementFee: 0.05
        }
    },

    // Fixed / Researched constants
    REAL_ESTATE: {
        APPRAISER_FEE: 3500, // ₪
        MORTGAGE_ADVISOR_FEE: 8000, // ₪
        RENOVATION_COST_PER_SQM: 1500, // ₪
        AVG_SQM: 100, // Assuming 100 sqm for renovation calc if needed
        INSURANCE_YEARLY: 3000, // ₪
        VAT: 0.18, // 18% VAT in Israel (since Jan 2025) — used only as a fallback default
        
        // Purchase Tax Brackets (Mas Rechisha) - Second Home (Investor) 2024
        PURCHASE_TAX_BRACKETS_INVESTOR: [
            { limit: 6055070, rate: 0.08 },
            { limit: Infinity, rate: 0.10 }
        ],
        
        CAPITAL_GAINS_TAX: 0.25 // 25% on real profit
    },

    STOCK_MARKET: {
        BUY_SELL_FEE: 0.0009, // 0.09% broker fee per transaction
        CURRENCY_CONVERSION_FEE: 0.005, // 0.5%
        CAPITAL_GAINS_TAX: 0.25, // 25% on real profit
        DIVIDEND_TAX: 0.25,
        DIVIDEND_YIELD: 0.015 // Assuming 1.5% of the total return comes from dividends (for tax calculation)
    },

    // Monte Carlo Config
    MONTE_CARLO: {
        ITERATIONS: 10000,
        STOCK_VOLATILITY: 0.15, // 15% standard deviation for stocks
        RE_VOLATILITY: 0.05,    // 5% standard deviation for real estate
    }
};
