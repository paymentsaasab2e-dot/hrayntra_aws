"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateCompensation = calculateCompensation;
exports.applyComponentOverrides = applyComponentOverrides;
function round2(n) {
    return Math.round(n * 100) / 100;
}
function anchorToAnnual(anchorType, anchorValue) {
    if (anchorType === 'ANNUAL_CTC')
        return anchorValue;
    if (anchorType === 'MONTHLY_CTC')
        return anchorValue * 12;
    return anchorValue * 12;
}
function anchorToMonthly(anchorType, anchorValue) {
    if (anchorType === 'ANNUAL_CTC')
        return anchorValue / 12;
    if (anchorType === 'MONTHLY_CTC')
        return anchorValue;
    return anchorValue;
}
function resolveBaseAnnual(baseRef, anchorAnnual, computed, grossAnnual) {
    if (!baseRef || baseRef === 'ANCHOR')
        return anchorAnnual;
    if (baseRef === 'GROSS')
        return grossAnnual;
    return computed[baseRef] ?? 0;
}
function calculateCompensation(input) {
    const sorted = [...input.components].sort((a, b) => a.order - b.order);
    const overrides = input.componentOverrides || {};
    const anchorAnnual = anchorToAnnual(input.anchorType, input.anchorValue);
    const computedAnnual = {};
    const lines = [];
    const earnings = sorted.filter((c) => c.section === 'EARNING');
    const nonBalanceEarnings = earnings.filter((c) => c.calcType !== 'BALANCE_OF_GROSS');
    const balanceEarnings = earnings.filter((c) => c.calcType === 'BALANCE_OF_GROSS');
    for (const comp of nonBalanceEarnings) {
        const value = overrides[comp.code] ?? comp.value;
        let annual = 0;
        const grossSoFar = Object.entries(computedAnnual)
            .filter(([code]) => earnings.some((e) => e.code === code))
            .reduce((sum, [, v]) => sum + v, 0);
        if (comp.calcType === 'FIXED') {
            annual = value * 12;
        }
        else if (comp.calcType === 'PERCENT_OF_ANCHOR') {
            annual = (anchorAnnual * value) / 100;
        }
        else if (comp.calcType === 'PERCENT_OF_GROSS') {
            annual = (grossSoFar * value) / 100;
        }
        else if (comp.calcType === 'PERCENT_OF_COMPONENT') {
            const base = resolveBaseAnnual(comp.baseRef, anchorAnnual, computedAnnual, grossSoFar);
            annual = (base * value) / 100;
        }
        annual = round2(annual);
        computedAnnual[comp.code] = annual;
        lines.push({
            code: comp.code,
            name: comp.name,
            section: comp.section,
            annual,
            monthly: round2(annual / 12),
            calcType: comp.calcType,
            value,
            baseRef: comp.baseRef,
        });
    }
    let grossAnnual = Object.entries(computedAnnual)
        .filter(([code]) => earnings.some((e) => e.code === code && e.calcType !== 'BALANCE_OF_GROSS'))
        .reduce((sum, [, v]) => sum + v, 0);
    for (const comp of balanceEarnings) {
        const targetGross = input.anchorType === 'MONTHLY_GROSS'
            ? input.anchorValue * 12
            : grossAnnual > 0
                ? grossAnnual
                : anchorAnnual * 0.6;
        const annual = round2(Math.max(0, targetGross - grossAnnual));
        computedAnnual[comp.code] = annual;
        grossAnnual += annual;
        lines.push({
            code: comp.code,
            name: comp.name,
            section: comp.section,
            annual,
            monthly: round2(annual / 12),
            calcType: comp.calcType,
            value: overrides[comp.code] ?? comp.value,
            baseRef: comp.baseRef,
        });
    }
    grossAnnual = round2(Object.entries(computedAnnual)
        .filter(([code]) => earnings.some((e) => e.code === code))
        .reduce((sum, [, v]) => sum + v, 0));
    const deductions = sorted.filter((c) => c.section === 'DEDUCTION');
    for (const comp of deductions) {
        const value = overrides[comp.code] ?? comp.value;
        let annual = 0;
        if (comp.calcType === 'FIXED') {
            annual = value * 12;
        }
        else if (comp.calcType === 'PERCENT_OF_ANCHOR') {
            annual = (anchorAnnual * value) / 100;
        }
        else if (comp.calcType === 'PERCENT_OF_GROSS') {
            annual = (grossAnnual * value) / 100;
        }
        else if (comp.calcType === 'PERCENT_OF_COMPONENT') {
            const base = resolveBaseAnnual(comp.baseRef, anchorAnnual, computedAnnual, grossAnnual);
            annual = (base * value) / 100;
        }
        const monthlyCap = comp.cap ?? null;
        if (monthlyCap != null) {
            annual = Math.min(annual, monthlyCap * 12);
        }
        annual = round2(annual);
        computedAnnual[comp.code] = annual;
        lines.push({
            code: comp.code,
            name: comp.name,
            section: comp.section,
            annual,
            monthly: round2(annual / 12),
            calcType: comp.calcType,
            value,
            baseRef: comp.baseRef,
        });
    }
    const employer = sorted.filter((c) => c.section === 'EMPLOYER_CONTRIBUTION');
    for (const comp of employer) {
        const value = overrides[comp.code] ?? comp.value;
        let annual = 0;
        if (comp.calcType === 'FIXED') {
            annual = value * 12;
        }
        else if (comp.calcType === 'PERCENT_OF_ANCHOR') {
            annual = (anchorAnnual * value) / 100;
        }
        else if (comp.calcType === 'PERCENT_OF_GROSS') {
            annual = (grossAnnual * value) / 100;
        }
        else if (comp.calcType === 'PERCENT_OF_COMPONENT') {
            const base = resolveBaseAnnual(comp.baseRef, anchorAnnual, computedAnnual, grossAnnual);
            annual = (base * value) / 100;
        }
        const monthlyCap = comp.cap ?? null;
        if (monthlyCap != null) {
            annual = Math.min(annual, monthlyCap * 12);
        }
        annual = round2(annual);
        computedAnnual[comp.code] = annual;
        lines.push({
            code: comp.code,
            name: comp.name,
            section: comp.section,
            annual,
            monthly: round2(annual / 12),
            calcType: comp.calcType,
            value,
            baseRef: comp.baseRef,
        });
    }
    const annualDeductions = round2(lines.filter((l) => l.section === 'DEDUCTION').reduce((s, l) => s + l.annual, 0));
    const annualEmployer = round2(lines.filter((l) => l.section === 'EMPLOYER_CONTRIBUTION').reduce((s, l) => s + l.annual, 0));
    const annualNet = round2(grossAnnual - annualDeductions);
    const annualCtc = round2(grossAnnual + annualEmployer);
    return {
        anchorType: input.anchorType,
        anchorValue: input.anchorValue,
        currencyCode: input.currencyCode || 'INR',
        lines,
        totals: {
            annualGross: grossAnnual,
            monthlyGross: round2(grossAnnual / 12),
            annualDeductions,
            monthlyDeductions: round2(annualDeductions / 12),
            annualEmployerContributions: annualEmployer,
            monthlyEmployerContributions: round2(annualEmployer / 12),
            annualNet,
            monthlyNet: round2(annualNet / 12),
            annualCtc,
            monthlyCtc: round2(annualCtc / 12),
        },
    };
}
function applyComponentOverrides(components, overrides) {
    if (!overrides)
        return components;
    return components.map((c) => ({
        ...c,
        value: overrides[c.code] ?? c.value,
    }));
}
//# sourceMappingURL=salary-calculator.js.map