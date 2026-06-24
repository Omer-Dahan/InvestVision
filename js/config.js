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

        // Purchase Tax Brackets - Single / Primary Residence (Dira Yehida) 2024
        PURCHASE_TAX_BRACKETS_RESIDENT: [
            { limit: 1978745, rate: 0.00 },
            { limit: 2347040, rate: 0.035 },
            { limit: 6055070, rate: 0.05 },
            { limit: 20183565, rate: 0.08 },
            { limit: Infinity, rate: 0.10 }
        ],

        ARNONA_PER_SQM_YEARLY: 50, // ₪ per sqm/year (rough national average)

        CAPITAL_GAINS_TAX: 0.25 // 25% on real profit
    },

    // One-time setup costs when moving into a home — auto-estimated from apartment size (m²)
    SETUP_COSTS: {
        RENOVATION_PER_SQM: 1500,  // ₪/m²
        ELECTRICAL_PER_SQM: 200,   // ₪/m² (rewiring, points, panel)
        FURNITURE_PER_SQM: 700,    // ₪/m²
        KITCHEN_FIXED: 40000,      // ₪ (largely size-independent)
        AC_UNIT_COST: 4500,        // ₪ per split unit (incl. install)
        SQM_PER_AC_UNIT: 30        // one unit per ~30 m²
    },

    // Mode metadata for the landing screen / wizard
    MODES: {
        housing: {
            label: 'מגורים',
            title: 'לקנות בית או לשכור ולהשקיע?',
            description: 'אתה גר בנכס. משווים קניית בית עם משכנתא מול שכירת דירה והשקעת ההון + ההפרש החודשי במדד.'
        },
        investment: {
            label: 'השקעה',
            title: 'נכס להשקעה או שוק ההון?',
            description: 'קונים דירה ומשכירים אותה (הכנסת שכירות) מול השקעת ההון במדד.'
        }
    },

    // Generic defaults used by the wizard
    DEFAULTS: {
        livingRentMonthly: 5500, // ₪/month a renter would pay to live
        apartmentSqm: 100
    },

    // Bank financing limits and out-of-pocket / family gap loans
    FINANCING: {
        MAX_LTV_RESIDENT: 75,   // % max mortgage for a single residence
        MAX_LTV_INVESTOR: 50,   // % max mortgage for an investment property
        EXTERNAL_LOAN_RATE: 8,  // % default rate for non-bank / family gap loans
        EXTERNAL_LOAN_YEARS: 7  // years to repay the gap loan
    },

    // Ongoing / periodic property costs beyond mortgage
    PROPERTY_COSTS: {
        BUILDING_FEES_MONTHLY: 250,      // ₪/month house committee ( va'ad bayit, lobby etc.)
        PERIODIC_RENOVATION_PER_SQM: 500, // ₪/m² refresh
        PERIODIC_RENOVATION_YEARS: 10     // every N years
    },

    // Tail risks — applied in the Monte Carlo simulation only
    RISK: {
        CONTRACTOR_PROB: 2,        // % one-time chance of non-delivery / contractor collapse (off-plan)
        CONTRACTOR_LOSS: 50,       // % of property value lost if it happens
        DISASTER_PROB_YEARLY: 0.3, // % yearly chance of a major natural disaster (quake/flood/fire)
        DISASTER_LOSS: 20          // % of property value lost (net of insurance) if it happens
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
