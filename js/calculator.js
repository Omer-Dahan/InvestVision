// js/calculator.js

class FinancialCalculator {
    constructor(params) {
        this.params = params;
    }

    // --- Helper Functions ---

    calculatePurchaseTax(propertyValue) {
        let tax = 0;
        let remainingValue = propertyValue;
        let previousLimit = 0;

        for (const bracket of CONFIG.REAL_ESTATE.PURCHASE_TAX_BRACKETS_INVESTOR) {
            const bracketAmount = Math.min(Math.max(0, remainingValue), bracket.limit - previousLimit);
            tax += bracketAmount * bracket.rate;
            remainingValue -= bracketAmount;
            previousLimit = bracket.limit;
            if (remainingValue <= 0) break;
        }
        return tax;
    }

    calculateMortgagePayment(principal, annualRate, years) {
        if (annualRate === 0) return principal / (years * 12);
        const monthlyRate = annualRate / 100 / 12;
        const numberOfPayments = years * 12;
        return (principal * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
               (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    }

    // --- Main Simulation ---

    runSimulation() {
        const years = this.params.investmentYears;
        const results = {
            yearlyData: [],
            summary: {}
        };

        // --- Initial State: Real Estate ---
        const propertyValueInitial = this.params.propertyValue;
        const initialCapital = this.params.initialCapital;
        
        // Calculate Acquisition Costs
        const purchaseTax = this.calculatePurchaseTax(propertyValueInitial);
        const brokerFee = propertyValueInitial * (this.params.brokerFee / 100) * (1 + CONFIG.REAL_ESTATE.VAT);
        const lawyerFee = propertyValueInitial * (this.params.lawyerFee / 100) * (1 + CONFIG.REAL_ESTATE.VAT);
        const appraiserFee = CONFIG.REAL_ESTATE.APPRAISER_FEE * (1 + CONFIG.REAL_ESTATE.VAT);
        const advisorFee = CONFIG.REAL_ESTATE.MORTGAGE_ADVISOR_FEE * (1 + CONFIG.REAL_ESTATE.VAT);
        
        const totalAcquisitionCosts = purchaseTax + brokerFee + lawyerFee + appraiserFee + advisorFee;
        
        // Mortgage Amount = Property Value - (Initial Capital - Acquisition Costs)
        const effectiveDownPayment = initialCapital - totalAcquisitionCosts;
        let mortgagePrincipal = propertyValueInitial - effectiveDownPayment;
        let leftoverCapital = 0;

        if (mortgagePrincipal < 0) {
            // User has more than enough cash to buy without a mortgage
            leftoverCapital = Math.abs(mortgagePrincipal);
            mortgagePrincipal = 0;
        } else if (effectiveDownPayment <= 0) {
            // Capital doesn't even cover the fees. Loan must cover property + missing fees.
            mortgagePrincipal = propertyValueInitial + Math.abs(effectiveDownPayment);
        }
        
        const pmt = this.calculateMortgagePayment(mortgagePrincipal, this.params.mortgageRate, years); // Assuming mortgage term = investment term

        // --- Initial State: Stock Market ---
        // Assuming the same initial capital is invested in the stock market
        let stockPortfolioValue = initialCapital;
        
        // Deduct initial buy fee and conversion fee
        const totalStockBuyFee = CONFIG.STOCK_MARKET.BUY_SELL_FEE + CONFIG.STOCK_MARKET.CURRENCY_CONVERSION_FEE;
        stockPortfolioValue -= stockPortfolioValue * totalStockBuyFee;
        const stockInitialBasis = stockPortfolioValue;

        // --- Simulation Loop ---
        let currentPropertyValue = propertyValueInitial;
        let currentMortgageBalance = mortgagePrincipal;
        
        let cumulativeReCashFlow = 0;
        const inflationMultiplier = 1 + (this.params.inflationRate / 100);

        for (let year = 1; year <= years; year++) {
            // 1. Update Real Estate
            currentPropertyValue *= (1 + (this.params.propertyAppreciation / 100));
            
            // Rent calculation (adjusted for inflation)
            const monthlyRentAdjusted = this.params.monthlyRent * Math.pow(inflationMultiplier, year - 1);
            const activeMonths = 12 - this.params.vacancyMonths;
            const yearlyRentIncome = monthlyRentAdjusted * activeMonths;
            
            // Expenses
            const maintenanceCost = currentPropertyValue * (this.params.maintenanceYearly / 100);
            const insuranceCost = CONFIG.REAL_ESTATE.INSURANCE_YEARLY * Math.pow(inflationMultiplier, year - 1);
            const mortgageYearlyPayment = pmt * 12;
            
            // Calculate mortgage interest and principal for the year
            let yearlyInterest = 0;
            let yearlyPrincipal = 0;
            if (currentMortgageBalance > 0) {
                const monthlyRate = this.params.mortgageRate / 100 / 12;
                for (let m = 0; m < 12; m++) {
                    const interest = currentMortgageBalance * monthlyRate;
                    const principalPaid = pmt - interest;
                    yearlyInterest += interest;
                    yearlyPrincipal += principalPaid;
                    currentMortgageBalance -= principalPaid;
                }
                if (currentMortgageBalance < 0) currentMortgageBalance = 0;
            }

            // Cash flow for the year (Rent - Expenses - Mortgage Payment)
            const yearlyReCashFlow = yearlyRentIncome - maintenanceCost - insuranceCost - mortgageYearlyPayment;
            cumulativeReCashFlow += yearlyReCashFlow; // Assuming cash flow is kept as cash (0% interest) or we can reinvest it. For simplicity, we just accumulate it.

            // 2. Update Stock Market
            // We assume the user invests the same initial capital.
            // But what about the ongoing cash flow difference?
            // To make a fair comparison, if RE has negative cash flow, the Stock investor could have invested that amount.
            // If RE has positive cash flow, the RE investor gets that cash. 
            // In a pure investment vs investment without DRIP from RE cash flow, we just let Stock compound.
            
            stockPortfolioValue *= (1 + (this.params.stockReturn / 100));
            stockPortfolioValue -= stockPortfolioValue * (this.params.managementFee / 100); // Apply management fee

            // 3. Save Yearly Data
            results.yearlyData.push({
                year,
                propertyValue: currentPropertyValue,
                mortgageBalance: currentMortgageBalance,
                reNetWorth: currentPropertyValue - currentMortgageBalance + cumulativeReCashFlow + leftoverCapital,
                stockPortfolioValue: stockPortfolioValue,
                cumulativeReCashFlow: cumulativeReCashFlow,
                yearlyRentIncome: yearlyRentIncome,
                inflationAdjustedReNetWorth: (currentPropertyValue - currentMortgageBalance + cumulativeReCashFlow + leftoverCapital) / Math.pow(inflationMultiplier, year),
                inflationAdjustedStockValue: stockPortfolioValue / Math.pow(inflationMultiplier, year)
            });
        }

        // --- End of Simulation: Tax Calculations ---
        
        // Deflation indexation floor is 1.0 (cannot increase profit due to negative inflation)
        const totalInflationMultiplier = Math.max(1, Math.pow(inflationMultiplier, years));
        
        // RE Capital Gains Tax (Mas Shevach)
        const inflationAdjustedInitialProperty = propertyValueInitial * totalInflationMultiplier;
        let reRealProfit = currentPropertyValue - inflationAdjustedInitialProperty;
        const deductibleExpenses = totalAcquisitionCosts * totalInflationMultiplier;
        reRealProfit -= deductibleExpenses;

        const masShevach = reRealProfit > 0 ? reRealProfit * CONFIG.REAL_ESTATE.CAPITAL_GAINS_TAX : 0;
        const finalReNetWorth = currentPropertyValue - currentMortgageBalance + cumulativeReCashFlow + leftoverCapital - masShevach;

        // Stock Capital Gains Tax
        const finalStockSellFee = stockPortfolioValue * CONFIG.STOCK_MARKET.BUY_SELL_FEE;
        const stockValueAfterFees = stockPortfolioValue - finalStockSellFee;
        const inflationAdjustedInitialStock = stockInitialBasis * totalInflationMultiplier;
        
        const stockRealProfit = stockValueAfterFees - inflationAdjustedInitialStock;
        const stockTax = stockRealProfit > 0 ? stockRealProfit * CONFIG.STOCK_MARKET.CAPITAL_GAINS_TAX : 0;
        
        const finalStockNetWorth = stockValueAfterFees - stockTax;

        // --- Summarize Results ---
        results.summary = {
            finalReNetWorth,
            finalStockNetWorth,
            totalReTaxes: purchaseTax + masShevach,
            totalStockTaxes: stockTax,
            totalReFees: totalAcquisitionCosts - purchaseTax, // only fees
            totalStockFees: (initialCapital * totalStockBuyFee) + finalStockSellFee + (stockPortfolioValue * this.params.managementFee / 100 * years), // rough estimate of total management fees
            reROI: ((finalReNetWorth - initialCapital) / initialCapital) * 100,
            stockROI: ((finalStockNetWorth - initialCapital) / initialCapital) * 100,
            winner: finalReNetWorth > finalStockNetWorth ? 'real-estate' : 'stock',
            difference: Math.abs(finalReNetWorth - finalStockNetWorth)
        };

        return results;
    }
}
