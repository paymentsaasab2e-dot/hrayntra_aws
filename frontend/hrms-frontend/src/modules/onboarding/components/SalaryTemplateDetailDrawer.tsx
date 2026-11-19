"use client"

import * as React from 'react'
import {
  DrawerWrapper,
  Button,
  Input,
} from '@hryantra/ui'
import {
  ShieldCheck,
  CheckCircle2,
  FileText,
  Calculator,
  SlidersHorizontal,
  Building2,
  Scale,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Percent,
  Coins,
  Receipt,
  Info,
  ExternalLink,
  ChevronRight,
  Briefcase
} from 'lucide-react'

export interface SalaryTemplateDetailed {
  id: string
  name: string
  country: string
  flag: string
  currencyCode: string
  anchorType: string
  isDefault?: boolean
  legalBasis?: string
  description?: string
  statutorySummary?: string
  earningsSummary?: string
  components?: any[]
}

type Props = {
  open: boolean
  template: SalaryTemplateDetailed | null
  onClose: () => void
  onOpenSimulator?: (template: SalaryTemplateDetailed) => void
}

function formatMoney(amount: number, currency = 'INR'): string {
  const isINR = currency === 'INR'
  const isAED = currency === 'AED'
  const isUSD = currency === 'USD'

  if (isINR) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Math.round(amount))
  }

  if (isAED) {
    return `AED ${new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
    }).format(Math.round(amount))}`
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: isUSD ? 'USD' : currency,
    maximumFractionDigits: 0,
  }).format(Math.round(amount))
}

export function SalaryTemplateDetailDrawer({
  open,
  template,
  onClose,
  onOpenSimulator,
}: Props) {
  const [activeTab, setActiveTab] = React.useState<'breakdown' | 'simulator'>('breakdown')
  const [simulatedCtc, setSimulatedCtc] = React.useState<number>(1200000)

  // Initialize simulated CTC based on currency
  React.useEffect(() => {
    if (!template) return
    setActiveTab('breakdown')
    if (template.currencyCode === 'AED') {
      setSimulatedCtc(180000)
    } else if (template.currencyCode === 'USD') {
      setSimulatedCtc(120000)
    } else {
      setSimulatedCtc(1200000)
    }
  }, [template, open])

  if (!template) return null

  const currency = template.currencyCode || 'INR'
  const isIndia = template.country === 'India' || currency === 'INR'
  const isUAE = template.country === 'UAE' || currency === 'AED'
  const isUS = template.country === 'United States' || (template.name && template.name.includes('North America'))

  // Calculate live itemized figures for the simulated CTC
  const benchmarkAnnual = simulatedCtc
  const benchmarkMonthly = benchmarkAnnual / 12

  // Formula engine for India
  const computeIndia = (ctc: number) => {
    const basicAnnual = ctc * 0.40
    const basicMonthly = basicAnnual / 12
    const hraAnnual = basicAnnual * 0.40
    const hraMonthly = hraAnnual / 12
    const conveyanceAnnual = 1600 * 12
    const conveyanceMonthly = 1600

    // PF capped at 1,800/mo if basic monthly > 15,000
    const pfMonthly = basicMonthly > 15000 ? 1800 : Math.round(basicMonthly * 0.12)
    const pfAnnual = pfMonthly * 12

    const gratuityAnnual = Math.round(basicAnnual * 0.0481)
    const gratuityMonthly = Math.round(gratuityAnnual / 12)

    // Employer contributions included in CTC
    const erOverheadAnnual = pfAnnual + gratuityAnnual
    const specialAllowanceAnnual = Math.max(0, ctc - (basicAnnual + hraAnnual + conveyanceAnnual + erOverheadAnnual))
    const specialAllowanceMonthly = Math.round(specialAllowanceAnnual / 12)

    const grossAnnual = basicAnnual + hraAnnual + conveyanceAnnual + specialAllowanceAnnual
    const grossMonthly = grossAnnual / 12

    // Estimated deductions
    const ptMonthly = 200
    const ptAnnual = 2400
    const estimatedTdsMonthly = Math.max(0, Math.round((grossMonthly - 50000) * 0.15))
    const estimatedTdsAnnual = estimatedTdsMonthly * 12

    const totalDeductionsMonthly = pfMonthly + ptMonthly + estimatedTdsMonthly
    const totalDeductionsAnnual = totalDeductionsMonthly * 12

    const netMonthly = grossMonthly - totalDeductionsMonthly
    const netAnnual = netMonthly * 12

    return {
      basic: { m: basicMonthly, a: basicAnnual },
      hra: { m: hraMonthly, a: hraAnnual },
      conveyance: { m: conveyanceMonthly, a: conveyanceAnnual },
      special: { m: specialAllowanceMonthly, a: specialAllowanceAnnual },
      gross: { m: grossMonthly, a: grossAnnual },
      pfEe: { m: pfMonthly, a: pfAnnual },
      pfEr: { m: pfMonthly, a: pfAnnual },
      gratuity: { m: gratuityMonthly, a: gratuityAnnual },
      pt: { m: ptMonthly, a: ptAnnual },
      tds: { m: estimatedTdsMonthly, a: estimatedTdsAnnual },
      totalDeductions: { m: totalDeductionsMonthly, a: totalDeductionsAnnual },
      netTakeHome: { m: netMonthly, a: netAnnual },
    }
  }

  // Formula engine for UAE
  const computeUAE = (ctc: number) => {
    const basicAnnual = ctc * 0.60
    const basicMonthly = basicAnnual / 12
    const housingAnnual = basicAnnual * 0.25
    const housingMonthly = housingAnnual / 12
    const otherAnnual = Math.max(0, ctc - (basicAnnual + housingAnnual))
    const otherMonthly = otherAnnual / 12

    const grossMonthly = basicMonthly + housingMonthly + otherMonthly
    const grossAnnual = ctc

    // GPSSA for UAE/GCC nationals (5% EE, 12.5% ER)
    const gpssaEeMonthly = Math.round(basicMonthly * 0.05)
    const gpssaEeAnnual = gpssaEeMonthly * 12
    const gpssaErMonthly = Math.round(basicMonthly * 0.125)
    const gpssaErAnnual = gpssaErMonthly * 12

    const totalDeductionsMonthly = gpssaEeMonthly
    const totalDeductionsAnnual = gpssaEeAnnual

    const netMonthly = grossMonthly - totalDeductionsMonthly
    const netAnnual = netMonthly * 12

    return {
      basic: { m: basicMonthly, a: basicAnnual },
      housing: { m: housingMonthly, a: housingAnnual },
      other: { m: otherMonthly, a: otherAnnual },
      gross: { m: grossMonthly, a: grossAnnual },
      gpssaEe: { m: gpssaEeMonthly, a: gpssaEeAnnual },
      gpssaEr: { m: gpssaErMonthly, a: gpssaErAnnual },
      totalDeductions: { m: totalDeductionsMonthly, a: totalDeductionsAnnual },
      netTakeHome: { m: netMonthly, a: netAnnual },
    }
  }

  // Formula engine for US
  const computeUS = (ctc: number) => {
    const baseAnnual = ctc * 0.85
    const baseMonthly = baseAnnual / 12
    const healthAnnual = ctc * 0.10
    const healthMonthly = healthAnnual / 12
    const match401kAnnual = ctc * 0.05
    const match401kMonthly = match401kAnnual / 12

    const grossAnnual = baseAnnual
    const grossMonthly = baseMonthly

    // FICA 7.65% + Fed/State ~15%
    const ficaMonthly = Math.round(grossMonthly * 0.0765)
    const ficaAnnual = ficaMonthly * 12
    const fedStateMonthly = Math.round(grossMonthly * 0.15)
    const fedStateAnnual = fedStateMonthly * 12

    const totalDeductionsMonthly = ficaMonthly + fedStateMonthly
    const totalDeductionsAnnual = totalDeductionsMonthly * 12

    const netMonthly = grossMonthly - totalDeductionsMonthly
    const netAnnual = netMonthly * 12

    return {
      base: { m: baseMonthly, a: baseAnnual },
      health: { m: healthMonthly, a: healthAnnual },
      match401k: { m: match401kMonthly, a: match401kAnnual },
      gross: { m: grossMonthly, a: grossAnnual },
      fica: { m: ficaMonthly, a: ficaAnnual },
      tax: { m: fedStateMonthly, a: fedStateAnnual },
      totalDeductions: { m: totalDeductionsMonthly, a: totalDeductionsAnnual },
      netTakeHome: { m: netMonthly, a: netAnnual },
    }
  }

  // Formula engine for Global Contractor
  const computeGlobal = (ctc: number) => {
    const feeAnnual = ctc
    const feeMonthly = ctc / 12
    return {
      fee: { m: feeMonthly, a: feeAnnual },
      gross: { m: feeMonthly, a: feeAnnual },
      totalDeductions: { m: 0, a: 0 },
      netTakeHome: { m: feeMonthly, a: feeAnnual },
    }
  }

  const indiaData = isIndia ? computeIndia(simulatedCtc) : null
  const uaeData = isUAE ? computeUAE(simulatedCtc) : null
  const usData = isUS ? computeUS(simulatedCtc) : null
  const globalData = !isIndia && !isUAE && !isUS ? computeGlobal(simulatedCtc) : null

  const netMonthly = indiaData?.netTakeHome.m ?? uaeData?.netTakeHome.m ?? usData?.netTakeHome.m ?? globalData?.netTakeHome.m ?? 0
  const grossMonthly = indiaData?.gross.m ?? uaeData?.gross.m ?? usData?.gross.m ?? globalData?.gross.m ?? 0
  const totalDeductionsMonthly = indiaData?.totalDeductions.m ?? uaeData?.totalDeductions.m ?? usData?.totalDeductions.m ?? globalData?.totalDeductions.m ?? 0
  const takeHomePercent = grossMonthly > 0 ? Math.round((netMonthly / grossMonthly) * 100) : 100

  // Presets based on currency
  const presets = currency === 'AED'
    ? [90000, 150000, 240000, 360000]
    : currency === 'USD'
    ? [60000, 100000, 150000, 220000]
    : [600000, 1200000, 2400000, 4000000]

  return (
    <DrawerWrapper
      open={open}
      onClose={onClose}
      size="xl"
      title={
        <div className="flex items-center gap-2.5">
          <span className="text-2xl shrink-0" role="img" aria-label={template.country}>
            {template.flag || (isIndia ? '🇮🇳' : isUAE ? '🇦🇪' : isUS ? '🇺🇸' : '🌐')}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold text-slate-900 leading-tight">
                {template.name}
              </span>
              {template.isDefault && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/90 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="size-3 text-emerald-600" /> Default Template
                </span>
              )}
            </div>
          </div>
        </div>
      }
      subtitle={
        template.description ||
        (isIndia
          ? 'Compliant with Code on Wages 2019 & Employees’ Provident Funds Act 1952. Auto-selected when candidate location is India.'
          : isUAE
          ? 'Structured for UAE Federal Decree-Law No. 33 of 2021 and GPSSA statutory contributions. Auto-selected for UAE joiners.'
          : isUS
          ? 'Structured for US/Canada payroll. Applies Federal/State W-4 parameters and 401(k) retirement matching.'
          : 'Direct contractor invoice disbursement with zero local statutory withholding and W-8BEN compliance.')
      }
      headerExtra={
        <div className="space-y-3">
          {/* Top Badges Meta */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
              <Coins className="size-3 text-slate-500" /> {currency} ({currency === 'INR' ? '₹' : currency === 'AED' ? 'د.إ' : '$'})
            </span>
            <span className="inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/80">
              <Scale className="size-3 text-indigo-500" />
              {isIndia ? 'Code on Wages Compliant' : isUAE ? 'UAE Labour Law No. 33' : isUS ? 'FLSA & W-4 Compliant' : 'Contractor Agreement'}
            </span>
            <span className="inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-md bg-slate-100/80 text-slate-600 border border-slate-200/80">
              <Building2 className="size-3 text-slate-500" /> Anchor: Annual CTC
            </span>
            <span className="inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              <ShieldCheck className="size-3 text-emerald-600" /> Auto-Match: {template.country}
            </span>
          </div>

          {/* Segmented Inspector Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 text-xs font-semibold w-fit shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab('breakdown')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'breakdown'
                  ? 'bg-white text-slate-900 shadow-xs font-bold border border-slate-200/70'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <SlidersHorizontal className="size-3.5 text-indigo-600" />
              <span>Full Itemized Breakdown</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'simulator'
                  ? 'bg-white text-slate-900 shadow-xs font-bold border border-slate-200/70'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Calculator className="size-3.5 text-emerald-600" />
              <span>Interactive CTC Simulator</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-100 text-emerald-800 font-bold">
                Live
              </span>
            </button>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full pr-20">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs h-8 text-slate-700 border-slate-200 hover:bg-slate-50"
          >
            Close Inspector
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = '/settings?tab=salary'}
              className="text-xs h-8 text-slate-700 border-slate-200 hover:bg-slate-50"
            >
              <ExternalLink className="size-3.5 mr-1 text-slate-500" />
              Edit Slabs in Settings
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                onClose()
                if (onOpenSimulator) onOpenSimulator(template)
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-8 shadow-xs"
            >
              <Calculator className="size-3.5 mr-1" />
              Open Live Simulator Modal
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6 pb-6">
        {/* TAB 1: COMPLETE ITEMIZED STRUCTURE */}
        {activeTab === 'breakdown' && (
          <div className="space-y-6">
            {/* Executive Highlights Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/50 p-3.5 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Core Base Ratio</span>
                <div className="text-base font-extrabold text-slate-900 mt-1 tracking-tight">
                  {isIndia ? '40% of CTC' : isUAE ? '60% of CTC' : isUS ? '85% Base' : '100% Direct'}
                </div>
                <span className="text-[11px] text-slate-500 mt-0.5 block font-medium">
                  {isIndia ? 'Complies with wage code' : isUAE ? 'Forms EOSB base' : isUS ? 'W-2 Base Salary' : 'Professional Retainer'}
                </span>
              </div>

              <div className="rounded-xl border border-indigo-100 bg-gradient-to-b from-indigo-50/40 via-white to-white p-3.5 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Employer Statutory</span>
                <div className="text-base font-extrabold text-indigo-700 mt-1 tracking-tight">
                  {isIndia ? '12% EPF + Gratuity' : isUAE ? '12.5% GPSSA (GCC)' : isUS ? '5% 401(k) Match' : '0% Direct Withholding'}
                </div>
                <span className="text-[11px] text-slate-500 mt-0.5 block font-medium">
                  {isIndia ? 'Capped at ₹1,800/mo PF' : isUAE ? 'End of Service Benefit' : isUS ? 'FICA + Retirement' : 'Self-filed via W-8BEN'}
                </span>
              </div>

              <div className="rounded-xl border border-emerald-100 bg-gradient-to-b from-emerald-50/40 via-white to-white p-3.5 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Tax Optimization</span>
                <div className="text-base font-extrabold text-emerald-700 mt-1 tracking-tight">
                  {isIndia ? 'Sec 10(13A) HRA' : isUAE ? '0% Personal Tax' : isUS ? 'Pre-Tax 401(k)' : 'Zero Tax at Source'}
                </div>
                <span className="text-[11px] text-slate-500 mt-0.5 block font-medium">
                  {isIndia ? '₹75,000 std deduction' : isUAE ? 'Tax-free sovereign state' : isUS ? 'W-4 allowance support' : 'Independent contractor'}
                </span>
              </div>

              <div className="rounded-xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/50 p-3.5 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Auto-Match Rule</span>
                <div className="text-base font-extrabold text-slate-900 mt-1 tracking-tight">
                  {template.country}
                </div>
                <span className="text-[11px] text-slate-500 mt-0.5 block font-medium">
                  Applied to L1-L7 Bands
                </span>
              </div>
            </div>

            {/* SECTION 1: ITEMIZED EARNINGS BREAKDOWN */}
            <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/70">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-600">
                    <Receipt className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                      Itemized Earnings Schedule (Annual CTC Breakdown)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Benchmark computed on benchmark value of {formatMoney(simulatedCtc, currency)} / year.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                  {formatMoney(simulatedCtc, currency)} / yr
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/90 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                    <tr>
                      <th className="py-2.5 px-4">Component Code & Name</th>
                      <th className="py-2.5 px-3">Calculation Basis</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3 text-right">Monthly ({currency})</th>
                      <th className="py-2.5 px-3 text-right">Annual ({currency})</th>
                      <th className="py-2.5 px-4">Taxability & Statutory Rules</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {isIndia && indiaData && (
                      <>
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            <div>Basic Salary</div>
                            <span className="font-mono text-[10px] text-slate-400">BASIC</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">40% of CTC</td>
                          <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">Fixed Base</span></td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatMoney(indiaData.basic.m, currency)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">{formatMoney(indiaData.basic.a, currency)}</td>
                          <td className="py-2.5 px-4 text-[11px] text-slate-500 max-w-[200px]">
                            100% Taxable. Base for EPF, Gratuity, and Statutory Bonus under Code on Wages.
                          </td>
                        </tr>
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            <div>House Rent Allowance</div>
                            <span className="font-mono text-[10px] text-slate-400">HRA</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">40% of Basic (16% CTC)</td>
                          <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700">Allowance</span></td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatMoney(indiaData.hra.m, currency)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">{formatMoney(indiaData.hra.a, currency)}</td>
                          <td className="py-2.5 px-4 text-[11px] text-slate-500 max-w-[200px]">
                            Partial tax exemption available under Section 10(13A) against valid rent receipts.
                          </td>
                        </tr>
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            <div>Conveyance Allowance</div>
                            <span className="font-mono text-[10px] text-slate-400">CONVEYANCE</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">Fixed ₹1,600 / mo</td>
                          <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">Fixed Travel</span></td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatMoney(indiaData.conveyance.m, currency)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">{formatMoney(indiaData.conveyance.a, currency)}</td>
                          <td className="py-2.5 px-4 text-[11px] text-slate-500 max-w-[200px]">
                            Standard allowance; taxable under Section 115BAC New Tax Regime.
                          </td>
                        </tr>
                        <tr className="hover:bg-slate-50/60 transition-colors bg-indigo-50/30">
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            <div>Special Allowance</div>
                            <span className="font-mono text-[10px] text-indigo-600 font-bold">BALANCING_FIGURE</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-indigo-700 font-bold">CTC - (Sum of Heads)</td>
                          <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">Balancing</span></td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-800">{formatMoney(indiaData.special.m, currency)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-800">{formatMoney(indiaData.special.a, currency)}</td>
                          <td className="py-2.5 px-4 text-[11px] text-slate-600 max-w-[200px]">
                            Fully taxable flexible balancing head to absorb the remainder of the annual CTC.
                          </td>
                        </tr>
                      </>
                    )}

                    {isUAE && uaeData && (
                      <>
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            <div>Basic Salary</div>
                            <span className="font-mono text-[10px] text-slate-400">BASIC</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">60% of CTC</td>
                          <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">Core Base</span></td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatMoney(uaeData.basic.m, currency)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">{formatMoney(uaeData.basic.a, currency)}</td>
                          <td className="py-2.5 px-4 text-[11px] text-slate-500 max-w-[200px]">
                            Mandatory base for End of Service Gratuity under UAE Labour Law No. 33.
                          </td>
                        </tr>
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            <div>Housing Allowance</div>
                            <span className="font-mono text-[10px] text-slate-400">HOUSING</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">25% of Basic</td>
                          <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700">Allowance</span></td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatMoney(uaeData.housing.m, currency)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">{formatMoney(uaeData.housing.a, currency)}</td>
                          <td className="py-2.5 px-4 text-[11px] text-slate-500 max-w-[200px]">
                            Disbursed monthly; 0% personal income tax withholding in UAE.
                          </td>
                        </tr>
                        <tr className="hover:bg-slate-50/60 transition-colors bg-indigo-50/30">
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            <div>Other Allowances</div>
                            <span className="font-mono text-[10px] text-indigo-600 font-bold">OTHER_ALLOW</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-indigo-700 font-bold">Residual Balancing</td>
                          <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">Balancing</span></td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-800">{formatMoney(uaeData.other.m, currency)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-800">{formatMoney(uaeData.other.a, currency)}</td>
                          <td className="py-2.5 px-4 text-[11px] text-slate-600 max-w-[200px]">
                            Covers transport and utility allowances.
                          </td>
                        </tr>
                      </>
                    )}

                    {isUS && usData && (
                      <>
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            <div>Base Salary (W-2)</div>
                            <span className="font-mono text-[10px] text-slate-400">BASE_SALARY</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">85% of Total</td>
                          <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">W-2 Base</span></td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatMoney(usData.base.m, currency)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">{formatMoney(usData.base.a, currency)}</td>
                          <td className="py-2.5 px-4 text-[11px] text-slate-500 max-w-[200px]">
                            Standard annualized base salary subject to Federal, State, and FICA withholdings.
                          </td>
                        </tr>
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            <div>Healthcare & Dental Benefit</div>
                            <span className="font-mono text-[10px] text-slate-400">HEALTHCARE</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">10% Employer Contribution</td>
                          <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">Pre-Tax Benefit</span></td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatMoney(usData.health.m, currency)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">{formatMoney(usData.health.a, currency)}</td>
                          <td className="py-2.5 px-4 text-[11px] text-slate-500 max-w-[200px]">
                            Employer-subsidized medical, vision, and dental insurance premiums (pre-tax).
                          </td>
                        </tr>
                      </>
                    )}

                    {!isIndia && !isUAE && !isUS && globalData && (
                      <tr className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-4 font-semibold text-slate-900">
                          <div>Direct Professional Fee</div>
                          <span className="font-mono text-[10px] text-slate-400">CONTRACTOR_RETAINER</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">100% Direct Disbursement</td>
                        <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">Contractor Fee</span></td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatMoney(globalData.fee.m, currency)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">{formatMoney(globalData.fee.a, currency)}</td>
                        <td className="py-2.5 px-4 text-[11px] text-slate-500 max-w-[200px]">
                          Flat monthly invoice payout via international wire. Zero local tax withholding.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50/90 font-bold border-t border-slate-200 text-slate-900">
                    <tr>
                      <td colSpan={3} className="py-2.5 px-4 text-xs">
                        Total Gross Earnings (Disbursed via Payroll)
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-indigo-700">
                        {formatMoney(grossMonthly, currency)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-indigo-700">
                        {formatMoney(grossMonthly * 12, currency)}
                      </td>
                      <td className="py-2.5 px-4 text-[11px] font-normal text-slate-500">
                        Gross Earnings Base
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* SECTION 2: ITEMIZED STATUTORY DEDUCTIONS & CONTRIBUTIONS */}
            <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/70">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600">
                    <Scale className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                      Itemized Statutory Deductions & Employer Contributions
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Mandatory legal liabilities, caps, and remittance authorities.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  {isIndia ? 'EPFO & IT Act 1961' : isUAE ? 'GPSSA & UAE MOHRE' : isUS ? 'IRS & SSA Rules' : 'Self-Filing W-8BEN'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/90 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                    <tr>
                      <th className="py-2.5 px-4">Head & Code</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Computation Rate</th>
                      <th className="py-2.5 px-3">Statutory Cap / Ceiling</th>
                      <th className="py-2.5 px-3 text-right">Monthly ({currency})</th>
                      <th className="py-2.5 px-4">Remittance Authority & Citation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {isIndia && indiaData && (
                      <>
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            <div>Employee PF (EE)</div>
                            <span className="font-mono text-[10px] text-slate-400">EPF_EE</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/60">
                              EE Deduction
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">12% of Basic</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 font-medium">₹1,800 / month cap</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">{formatMoney(indiaData.pfEe.m, currency)}</td>
                          <td className="py-2.5 px-4 text-[11px] text-slate-500 max-w-[200px]">
                            EPFO Portal remittance by 15th of following month. EPF Act 1952.
                          </td>
                        </tr>
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            <div>Employer PF (ER)</div>
                            <span className="font-mono text-[10px] text-slate-400">EPF_ER</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
                              ER Liability
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">12% of Basic (3.67% PF + 8.33% EPS)</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 font-medium">₹1,800 / month cap</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800">{formatMoney(indiaData.pfEr.m, currency)}</td>
                          <td className="py-2.5 px-4 text-[11px] text-slate-500 max-w-[200px]">
                            Included in CTC package; deposited to employee PF universal account.
                          </td>
                        </tr>
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            <div>Gratuity Accrual</div>
                            <span className="font-mono text-[10px] text-slate-400">GRATUITY</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
                              ER Liability
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">4.81% of Basic (15/26 days/yr)</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 font-medium">Max ₹20,00,000 tax-free</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800">{formatMoney(indiaData.gratuity.m, currency)}</td>
                          <td className="py-2.5 px-4 text-[11px] text-slate-500 max-w-[200px]">
                            Payment of Gratuity Act 1972. Vests after 5 continuous years of service.
                          </td>
                        </tr>
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            <div>Professional Tax (PT)</div>
                            <span className="font-mono text-[10px] text-slate-400">PT</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/60">
                              EE Deduction
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">State Slabs (MH, KA, TS)</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 font-medium">₹2,500 / year max statutory cap</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">{formatMoney(indiaData.pt.m, currency)}</td>
                          <td className="py-2.5 px-4 text-[11px] text-slate-500 max-w-[200px]">
                            State Commercial Taxes Department monthly filing.
                          </td>
                        </tr>
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            <div>Estimated TDS</div>
                            <span className="font-mono text-[10px] text-slate-400">TDS_EST</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/60">
                              EE Deduction
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">Per New Regime Slabs (115BAC)</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 font-medium">Nil up to ₹7,00,000 net taxable</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">{formatMoney(indiaData.tds.m, currency)}</td>
                          <td className="py-2.5 px-4 text-[11px] text-slate-500 max-w-[200px]">
                            Income Tax Department Challan 281 deposit by 7th of following month.
                          </td>
                        </tr>
                      </>
                    )}

                    {isUAE && uaeData && (
                      <>
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            <div>GPSSA Employee (GCC)</div>
                            <span className="font-mono text-[10px] text-slate-400">GPSSA_EE</span>
                          </td>
                          <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700">EE Deduction</span></td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">5% of Basic (Emirati/GCC)</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 font-medium">Exempt for Expatriates</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">{formatMoney(uaeData.gpssaEe.m, currency)}</td>
                          <td className="py-2.5 px-4 text-[11px] text-slate-500 max-w-[200px]">General Pension & Social Security Authority</td>
                        </tr>
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            <div>GPSSA Employer (GCC)</div>
                            <span className="font-mono text-[10px] text-slate-400">GPSSA_ER</span>
                          </td>
                          <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700">ER Liability</span></td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">12.5% of Basic (Emirati/GCC)</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 font-medium">Exempt for Expatriates</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800">{formatMoney(uaeData.gpssaEr.m, currency)}</td>
                          <td className="py-2.5 px-4 text-[11px] text-slate-500 max-w-[200px]">Employer statutory pension contribution</td>
                        </tr>
                      </>
                    )}

                    {isUS && usData && (
                      <>
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            <div>FICA (Social Security & Medicare)</div>
                            <span className="font-mono text-[10px] text-slate-400">FICA</span>
                          </td>
                          <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700">EE Deduction</span></td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">6.2% SS + 1.45% Medicare (7.65%)</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 font-medium">$168,600 SS wage base cap</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">{formatMoney(usData.fica.m, currency)}</td>
                          <td className="py-2.5 px-4 text-[11px] text-slate-500 max-w-[200px]">IRS Form 941 quarterly payroll tax filing</td>
                        </tr>
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            <div>401(k) Employer Match</div>
                            <span className="font-mono text-[10px] text-slate-400">MATCH_401K</span>
                          </td>
                          <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700">ER Benefit</span></td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">5.0% Employer Match</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 font-medium">$23,000 employee elective limit</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800">{formatMoney(usData.match401k.m, currency)}</td>
                          <td className="py-2.5 px-4 text-[11px] text-slate-500 max-w-[200px]">Deposited directly into employee 401(k) trust</td>
                        </tr>
                      </>
                    )}

                    {!isIndia && !isUAE && !isUS && (
                      <tr className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-4 font-semibold text-slate-900">
                          <div>Direct Contractor Disbursement</div>
                          <span className="font-mono text-[10px] text-slate-400">W8_BEN</span>
                        </td>
                        <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">Zero Local Withholding</span></td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">0.00%</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 font-medium">Self-filed tax compliance</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">{formatMoney(0, currency)}</td>
                        <td className="py-2.5 px-4 text-[11px] text-slate-500 max-w-[200px]">IRS Form W-8BEN / W-9 maintained on file</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50/90 font-bold border-t border-slate-200 text-slate-900">
                    <tr>
                      <td colSpan={4} className="py-2.5 px-4 text-xs">
                        Total Monthly Employee Deductions
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-700">
                        {formatMoney(totalDeductionsMonthly, currency)}
                      </td>
                      <td className="py-2.5 px-4 text-[11px] font-normal text-slate-500">
                        Deducted from gross salary before bank payout
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* SECTION 3: INTAKE & AUTO-MATCH RULES */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-emerald-600" />
                Intake & Automated Assignment Specification
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-200/70 bg-slate-50/60 p-3 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Candidate Country Match</span>
                  <div className="font-mono text-xs font-bold text-slate-900">
                    candidate.country == &apos;{template.country}&apos;
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Evaluated during manual candidate creation and bulk CSV import.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200/70 bg-slate-50/60 p-3 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Supported Worker Types</span>
                  <div className="text-xs font-bold text-slate-900">
                    {isIndia ? 'Full-Time, Probationary, Fixed-Term' : isUS ? 'Full-Time W-2, Hourly' : isUAE ? 'Standard Mainland & Free Zone' : 'Independent Contractor'}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Automatically initializes checklist and tax compliance forms.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200/70 bg-slate-50/60 p-3 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Audit & Governance</span>
                  <div className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="size-3 text-emerald-600" /> Immutable Versioning
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Modifications create version snapshots to protect historical offer letters.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: INTERACTIVE LIVE CTC SIMULATOR */}
        {activeTab === 'simulator' && (
          <div className="space-y-5">
            {/* Simulation Controls Card */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Live Annual CTC Simulator</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Adjust annual compensation to observe real-time component disaggregation, statutory caps, and take-home pay.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                  {formatMoney(simulatedCtc, currency)} / yr
                </span>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="text-xs font-bold text-slate-500 mr-1 uppercase tracking-wider text-[10px]">Presets:</span>
                {presets.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setSimulatedCtc(amt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer active:scale-[0.98] ${
                      simulatedCtc === amt
                        ? 'bg-indigo-600 text-white border border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/90 shadow-2xs'
                    }`}
                  >
                    {formatMoney(amt, currency)}
                  </button>
                ))}
              </div>

              {/* Slider & Custom Input */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="sm:col-span-2 flex flex-col justify-center">
                  <input
                    type="range"
                    min={currency === 'AED' ? 40000 : currency === 'USD' ? 30000 : 300000}
                    max={currency === 'AED' ? 600000 : currency === 'USD' ? 400000 : 6000000}
                    step={currency === 'AED' ? 5000 : currency === 'USD' ? 5000 : 50000}
                    value={simulatedCtc}
                    onChange={(e) => setSimulatedCtc(Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-200 rounded-lg appearance-none"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono font-medium">
                    <span>{formatMoney(currency === 'AED' ? 40000 : currency === 'USD' ? 30000 : 300000, currency)}</span>
                    <span>{formatMoney(currency === 'AED' ? 600000 : currency === 'USD' ? 400000 : 6000000, currency)}</span>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Custom Annual Value
                  </label>
                  <Input
                    type="number"
                    value={simulatedCtc}
                    onChange={(e) => setSimulatedCtc(Number(e.target.value) || 0)}
                    className="h-8.5 text-xs font-mono font-bold border-slate-200/90 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Simulation KPI Result Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/50 p-4 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gross Monthly Earnings</span>
                <div className="text-xl font-extrabold text-slate-900 mt-1 font-mono tabular-nums">
                  {formatMoney(grossMonthly, currency)}
                </div>
                <span className="text-[11px] text-slate-500 mt-0.5 block font-medium">
                  {formatMoney(grossMonthly * 12, currency)} / yr
                </span>
              </div>

              <div className="rounded-xl border border-rose-200/90 bg-gradient-to-b from-rose-50/50 via-white to-white p-4 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Total Deductions</span>
                <div className="text-xl font-extrabold text-rose-700 mt-1 font-mono tabular-nums">
                  - {formatMoney(totalDeductionsMonthly, currency)}
                </div>
                <span className="text-[11px] text-rose-600 mt-0.5 block font-medium">
                  PF, PT & Income Tax withholding
                </span>
              </div>

              <div className="rounded-xl border border-emerald-300 bg-gradient-to-b from-emerald-50/80 via-emerald-50/30 to-white p-4 shadow-xs ring-1 ring-emerald-500/20">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Net Take-Home Monthly</span>
                <div className="text-xl font-extrabold text-emerald-700 mt-1 font-mono tabular-nums">
                  {formatMoney(netMonthly, currency)}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-bold text-emerald-800">
                  <CheckCircle2 className="size-3 text-emerald-600" />
                  <span>{takeHomePercent}% In-Hand Pay Ratio</span>
                </div>
              </div>
            </div>

            {/* Visual Ratio Split Bar */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <span>Monthly Compensation Split</span>
                <span>{takeHomePercent}% Take-Home Ratio</span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-100 flex overflow-hidden">
                <div
                  style={{ width: `${takeHomePercent}%` }}
                  className="bg-emerald-500 h-full transition-all duration-300"
                  title={`Net Take-Home: ${takeHomePercent}%`}
                />
                <div
                  style={{ width: `${100 - takeHomePercent}%` }}
                  className="bg-rose-400 h-full transition-all duration-300"
                  title={`Deductions & Overhead: ${100 - takeHomePercent}%`}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span>Net In-Hand Bank Credit: {formatMoney(netMonthly, currency)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-rose-400" />
                  <span>Taxes & Deductions: {formatMoney(totalDeductionsMonthly, currency)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DrawerWrapper>
  )
}
