// js/monte-carlo.js

class MonteCarloSimulation {
    constructor(baseParams, baseResults) {
        this.params = baseParams;
        this.baseResults = baseResults; // We might need this for context, but mainly we use params
    }

    // Box-Muller transform for normal distribution
    randomNormal(mean = 0, stdev = 1) {
        const u = 1 - Math.random(); // Converting [0,1) to (0,1]
        const v = Math.random();
        const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        return z * stdev + mean;
    }

    run(iterations = CONFIG.MONTE_CARLO.ITERATIONS) {
        const results = {
            reFinalValues: [],
            stockFinalValues: [],
            reWins: 0,
            stockWins: 0,
            percentiles: {
                re: {},
                stock: {}
            }
        };

        for (let i = 0; i < iterations; i++) {
            // Clone params for this iteration to add noise
            const iterParams = { ...this.params };
            
            // Generate randomized return sequences
            const years = iterParams.investmentYears;
            
            // We run a simplified simulation for speed inside the MC loop
            let stockPortfolioValue = iterParams.initialCapital;
            
            // Deduct initial buy fee
            const totalStockBuyFee = CONFIG.STOCK_MARKET.BUY_SELL_FEE + CONFIG.STOCK_MARKET.CURRENCY_CONVERSION_FEE;
            stockPortfolioValue -= stockPortfolioValue * totalStockBuyFee;
            const stockInitialBasis = stockPortfolioValue;

            let currentPropertyValue = iterParams.propertyValue;
            let currentMortgageBalance = iterParams.propertyValue - (iterParams.initialCapital - this.calculateAcquisitionCosts(iterParams));
            
            // If capital wasn't enough to cover downpayment properly
            if (currentMortgageBalance > iterParams.propertyValue) {
                 currentMortgageBalance = iterParams.propertyValue;
            } else if (currentMortgageBalance < 0) {
                 currentMortgageBalance = 0;
            }

            const pmt = this.calculateMortgagePayment(currentMortgageBalance, iterParams.mortgageRate, years);
            let cumulativeReCashFlow = 0;
            const inflationMultiplier = 1 + (iterParams.inflationRate / 100);

            for (let year = 1; year <= years; year++) {
                // Add noise to returns
                const stockYearReturn = this.randomNormal(iterParams.stockReturn / 100, CONFIG.MONTE_CARLO.STOCK_VOLATILITY);
                const reYearReturn = this.randomNormal(iterParams.propertyAppreciation / 100, CONFIG.MONTE_CARLO.RE_VOLATILITY);

                // Stock update
                stockPortfolioValue *= (1 + stockYearReturn);
                stockPortfolioValue -= stockPortfolioValue * (iterParams.managementFee / 100);

                // RE update
                currentPropertyValue *= (1 + reYearReturn);
                const monthlyRentAdjusted = iterParams.monthlyRent * Math.pow(inflationMultiplier, year - 1);
                const yearlyRentIncome = monthlyRentAdjusted * (12 - iterParams.vacancyMonths);
                
                const maintenanceCost = currentPropertyValue * (iterParams.maintenanceYearly / 100);
                const insuranceCost = CONFIG.REAL_ESTATE.INSURANCE_YEARLY * Math.pow(inflationMultiplier, year - 1);
                const mortgageYearlyPayment = pmt * 12;

                if (currentMortgageBalance > 0) {
                    const monthlyRate = iterParams.mortgageRate / 100 / 12;
                    for (let m = 0; m < 12; m++) {
                        const interest = currentMortgageBalance * monthlyRate;
                        const principalPaid = pmt - interest;
                        currentMortgageBalance -= principalPaid;
                    }
                    if (currentMortgageBalance < 0) currentMortgageBalance = 0;
                }

                cumulativeReCashFlow += (yearlyRentIncome - maintenanceCost - insuranceCost - mortgageYearlyPayment);
            }

            // Final Taxes
            const totalInflationMultiplier = Math.pow(inflationMultiplier, years);
            
            // RE Tax
            const inflationAdjustedInitialProperty = iterParams.propertyValue * totalInflationMultiplier;
            let reRealProfit = currentPropertyValue - inflationAdjustedInitialProperty;
            // Simplified deduction
            reRealProfit -= (this.calculateAcquisitionCosts(iterParams) * totalInflationMultiplier);
            const masShevach = reRealProfit > 0 ? reRealProfit * CONFIG.REAL_ESTATE.CAPITAL_GAINS_TAX : 0;
            const finalReNetWorth = currentPropertyValue - currentMortgageBalance + cumulativeReCashFlow - masShevach;

            // Stock Tax
            const inflationAdjustedInitialStock = stockInitialBasis * totalInflationMultiplier;
            const stockRealProfit = stockPortfolioValue - inflationAdjustedInitialStock;
            const stockTax = stockRealProfit > 0 ? stockRealProfit * CONFIG.STOCK_MARKET.CAPITAL_GAINS_TAX : 0;
            const finalStockSellFee = stockPortfolioValue * CONFIG.STOCK_MARKET.BUY_SELL_FEE;
            const finalStockNetWorth = stockPortfolioValue - stockTax - finalStockSellFee;

            results.reFinalValues.push(finalReNetWorth);
            results.stockFinalValues.push(finalStockNetWorth);

            if (finalReNetWorth > finalStockNetWorth) {
                results.reWins++;
            } else {
                results.stockWins++;
            }
        }

        // Sort for percentiles
        results.reFinalValues.sort((a, b) => a - b);
        results.stockFinalValues.sort((a, b) => a - b);

        results.percentiles = {
            re: {
                p5: results.reFinalValues[Math.floor(iterations * 0.05)],
                p50: results.reFinalValues[Math.floor(iterations * 0.5)],
                p95: results.reFinalValues[Math.floor(iterations * 0.95)],
            },
            stock: {
                p5: results.stockFinalValues[Math.floor(iterations * 0.05)],
                p50: results.stockFinalValues[Math.floor(iterations * 0.5)],
                p95: results.stockFinalValues[Math.floor(iterations * 0.95)],
            }
        };

        results.winRate = {
            re: (results.reWins / iterations) * 100,
            stock: (results.stockWins / iterations) * 100
        };

        return results;
    }

    calculateAcquisitionCosts(params) {
        // Simplified version of the one in calculator for MC speed
        let tax = 0;
        let remainingValue = params.propertyValue;
        let previousLimit = 0;
        for (const bracket of CONFIG.REAL_ESTATE.PURCHASE_TAX_BRACKETS_INVESTOR) {
            const bracketAmount = Math.min(Math.max(0, remainingValue), bracket.limit - previousLimit);
            tax += bracketAmount * bracket.rate;
            remainingValue -= bracketAmount;
            previousLimit = bracket.limit;
            if (remainingValue <= 0) break;
        }
        
        const brokerFee = params.propertyValue * (params.brokerFee / 100) * (1 + CONFIG.REAL_ESTATE.VAT);
        const lawyerFee = params.propertyValue * (params.lawyerFee / 100) * (1 + CONFIG.REAL_ESTATE.VAT);
        const appraiserFee = CONFIG.REAL_ESTATE.APPRAISER_FEE * (1 + CONFIG.REAL_ESTATE.VAT);
        const advisorFee = CONFIG.REAL_ESTATE.MORTGAGE_ADVISOR_FEE * (1 + CONFIG.REAL_ESTATE.VAT);
        
        return tax + brokerFee + lawyerFee + appraiserFee + advisorFee;
    }

    calculateMortgagePayment(principal, annualRate, years) {
        if (annualRate === 0) return principal / (years * 12);
        const monthlyRate = annualRate / 100 / 12;
        const numberOfPayments = years * 12;
        return (principal * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
               (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    }
}
