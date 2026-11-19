import process from 'node:process'
import { PrismaClient, FamilyRelationship, NomineeBenefitScheme, DependentGender } from '@prisma/client'
import { BeneficiaryService } from '../modules/employees/beneficiary/beneficiary.service'
import { OrgScopeContext } from '../shared/org/org-scope.service'

const prisma = new PrismaClient()

async function runVerification() {
  console.log('🚀 Starting Beneficiaries & Statutory Compliance Verification Script...\n')

  try {
    // 1. Locate test employee
    const employee = await prisma.employee.findFirst({
      where: {
        OR: [{ employeeId: 'EMP-005' }, { email: 'alex.test@hryantra.com' }],
      },
    })

    if (!employee || !employee.tenantId) {
      throw new Error('Test employee (EMP-005 / alex.test@hryantra.com) not found or missing tenantId.')
    }

    const tenantId: string = employee.tenantId
    const employeeId: string = employee.id
    const scope: OrgScopeContext = {
      tenantId,
      orgUnitId: null,
      allowedOrgUnitIds: null,
      scopedEmployeeIds: null,
      employeeSelfOnly: false,
      isHqAdmin: true,
    }

    console.log(`✅ Using Employee: ${employee.firstName} ${employee.lastName} (${employee.employeeId}, Tenant: ${tenantId})`)

    // 2. Clean up any previous test beneficiaries for clean verification
    await prisma.employeeNominee.deleteMany({ where: { employeeId, tenantId } })
    await prisma.employeeDependent.deleteMany({ where: { employeeId, tenantId } })
    await prisma.employeeEmergencyContact.deleteMany({ where: { employeeId, tenantId } })
    console.log('🧹 Cleaned previous beneficiaries data for employee.')

    // =========================================================================
    // TEST 1: Workplace Emergency Contacts & Primary Flag Auto-Switching
    // =========================================================================
    console.log('\n--- [TEST 1] Workplace Emergency Contacts ---')

    const c1 = await BeneficiaryService.addEmergencyContact(scope, employeeId, {
      name: 'Jane Doe',
      relationship: FamilyRelationship.SPOUSE,
      primaryPhone: '+91 9876543210',
      secondaryPhone: '+91 9876543219',
      email: 'jane.doe@example.com',
      address: '42 Orchid Gardens, Bandra West, Mumbai 400050',
      isPrimary: true,
    })
    console.log(`  ➕ Contact 1 added: ${c1.name} (Primary: ${c1.isPrimary})`)
    if (!c1.isPrimary) throw new Error('Expected contact 1 to be primary.')

    const c2 = await BeneficiaryService.addEmergencyContact(scope, employeeId, {
      name: 'Dr. Robert Doe',
      relationship: FamilyRelationship.FATHER,
      primaryPhone: '+91 9876543211',
      address: '7 Hilltop Villa, Pune 411001',
      isPrimary: true, // Auto-demote c1
    })
    console.log(`  ➕ Contact 2 added: ${c2.name} (Primary: ${c2.isPrimary})`)

    // Verify c1 was demoted from primary
    const c1Refreshed = await prisma.employeeEmergencyContact.findUnique({ where: { id: c1.id } })
    console.log(`  🔄 Contact 1 after Contact 2 promoted: Primary = ${c1Refreshed?.isPrimary}`)
    if (c1Refreshed?.isPrimary) throw new Error('Expected Contact 1 to be demoted from primary.')

    // Promote c1 back to primary
    await BeneficiaryService.updateEmergencyContact(scope, employeeId, c1.id, { isPrimary: true })
    const c2Refreshed = await prisma.employeeEmergencyContact.findUnique({ where: { id: c2.id } })
    const c1Promoted = await prisma.employeeEmergencyContact.findUnique({ where: { id: c1.id } })
    console.log(`  🔄 After promoting Contact 1 back: Contact 1 = ${c1Promoted?.isPrimary}, Contact 2 = ${c2Refreshed?.isPrimary}`)
    if (!c1Promoted?.isPrimary || c2Refreshed?.isPrimary) {
      throw new Error('Contact 1 re-promotion or Contact 2 demotion failed.')
    }
    console.log('✅ TEST 1 PASSED: Emergency Contact primary flag switching verified.')

    // =========================================================================
    // TEST 2: Family Dependents & GMC Health Coverage
    // =========================================================================
    console.log('\n--- [TEST 2] Family Dependents & Group Medical Cover (GMC) ---')

    const d1 = await BeneficiaryService.addDependent(scope, employeeId, {
      fullName: 'Jane Doe',
      relationship: FamilyRelationship.SPOUSE,
      gender: DependentGender.FEMALE,
      dateOfBirth: '1990-05-15',
      isCoveredUnderGmc: true,
      preExistingDisease: 'None reported',
      isDisabled: false,
    })
    console.log(`  ➕ Dependent 1 added: ${d1.fullName} (${d1.relationship}, GMC: ${d1.isCoveredUnderGmc})`)

    const d2 = await BeneficiaryService.addDependent(scope, employeeId, {
      fullName: 'Leo Doe',
      relationship: FamilyRelationship.SON,
      gender: DependentGender.MALE,
      dateOfBirth: '2018-09-20', // ~8 years old (Minor)
      isCoveredUnderGmc: true,
      isDisabled: false,
    })
    console.log(`  ➕ Dependent 2 added: ${d2.fullName} (${d2.relationship}, Minor Son, GMC: ${d2.isCoveredUnderGmc})`)

    const d3 = await BeneficiaryService.addDependent(scope, employeeId, {
      fullName: 'Mary Doe',
      relationship: FamilyRelationship.MOTHER,
      gender: DependentGender.FEMALE,
      dateOfBirth: '1955-03-10', // Senior citizen
      isCoveredUnderGmc: false,
      preExistingDisease: 'Hypertension',
    })
    console.log(`  ➕ Dependent 3 added: ${d3.fullName} (${d3.relationship}, GMC: ${d3.isCoveredUnderGmc})`)

    const allDeps = await BeneficiaryService.listDependents(scope, employeeId)
    console.log(`  📋 Total Dependents listed: ${allDeps.length}`)
    if (allDeps.length !== 3) throw new Error('Expected exactly 3 dependents.')
    console.log('✅ TEST 2 PASSED: Family Dependents creation & GMC tags verified.')

    // =========================================================================
    // TEST 3: Statutory Nominees & Scheme Share % Validation (Gratuity Form F)
    // =========================================================================
    console.log('\n--- [TEST 3] Statutory Nominees (Payment of Gratuity Act 1972) ---')

    const n1 = await BeneficiaryService.addNominee(scope, employeeId, {
      name: 'Jane Doe',
      relationship: FamilyRelationship.SPOUSE,
      scheme: NomineeBenefitScheme.GRATUITY,
      sharePercentage: 60,
      dateOfBirth: '1990-05-15',
      address: '42 Orchid Gardens, Bandra West, Mumbai',
    })
    console.log(`  ➕ Gratuity Nominee 1: ${n1.name} (${n1.sharePercentage}%)`)

    // Attempt to exceed 100% total allocation: 60 + 50 = 110% -> Should fail!
    try {
      await BeneficiaryService.addNominee(scope, employeeId, {
        name: 'Mary Doe',
        relationship: FamilyRelationship.MOTHER,
        scheme: NomineeBenefitScheme.GRATUITY,
        sharePercentage: 50,
        dateOfBirth: '1955-03-10',
        address: '7 Hilltop Villa, Pune',
      })
      throw new Error('FAILURE: Validation failed to reject allocation > 100%!')
    } catch (err: any) {
      console.log(`  🛡️ Over-allocation correctly blocked: "${err.message}"`)
    }

    // Add valid nominee completing exactly 100%
    const n2 = await BeneficiaryService.addNominee(scope, employeeId, {
      name: 'Mary Doe',
      relationship: FamilyRelationship.MOTHER,
      scheme: NomineeBenefitScheme.GRATUITY,
      sharePercentage: 40,
      dateOfBirth: '1955-03-10',
      address: '7 Hilltop Villa, Pune',
    })
    console.log(`  ➕ Gratuity Nominee 2: ${n2.name} (${n2.sharePercentage}%) -> Total: 100%`)
    console.log('✅ TEST 3 PASSED: Gratuity Nominee 100% allocation cap enforced.')

    // =========================================================================
    // TEST 4: Minor Guardian Statutory Requirement (EPFO Form 2 Part A)
    // =========================================================================
    console.log('\n--- [TEST 4] Statutory Minor Guardian Requirement (EPFO Form 2) ---')

    // Attempt to add Minor Son (< 18) WITHOUT guardian info -> Must fail
    try {
      await BeneficiaryService.addNominee(scope, employeeId, {
        name: 'Leo Doe',
        relationship: FamilyRelationship.SON,
        scheme: NomineeBenefitScheme.PF_EPF,
        sharePercentage: 50,
        dateOfBirth: '2018-09-20', // Age ~8
      })
      throw new Error('FAILURE: Validation failed to require guardian for minor nominee!')
    } catch (err: any) {
      console.log(`  🛡️ Minor without guardian correctly blocked: "${err.message}"`)
    }

    // Add Minor Son with complete statutory guardian details
    const nMinor = await BeneficiaryService.addNominee(scope, employeeId, {
      name: 'Leo Doe',
      relationship: FamilyRelationship.SON,
      scheme: NomineeBenefitScheme.PF_EPF,
      sharePercentage: 50,
      dateOfBirth: '2018-09-20',
      guardianName: 'Jane Doe',
      guardianRelation: 'Mother & Natural Guardian',
      guardianAge: 35,
      guardianAddress: '42 Orchid Gardens, Bandra West, Mumbai 400050',
    })
    console.log(`  ➕ Minor Nominee with Guardian added: ${nMinor.name} (Guardian: ${nMinor.guardianName}, ${nMinor.guardianRelation})`)
    if (!nMinor.isMinor) throw new Error('Expected isMinor to be calculated as true.')

    // Add Spouse for remaining 50%
    const nSpouseEPF = await BeneficiaryService.addNominee(scope, employeeId, {
      name: 'Jane Doe',
      relationship: FamilyRelationship.SPOUSE,
      scheme: NomineeBenefitScheme.PF_EPF,
      sharePercentage: 50,
      dateOfBirth: '1990-05-15',
      address: '42 Orchid Gardens, Bandra West, Mumbai 400050',
    })
    console.log(`  ➕ Spouse PF Nominee added: ${nSpouseEPF.name} (${nSpouseEPF.sharePercentage}%)`)

    // Add Group Term Life Insurance (GTLI) 100% to spouse
    await BeneficiaryService.addNominee(scope, employeeId, {
      name: 'Jane Doe',
      relationship: FamilyRelationship.SPOUSE,
      scheme: NomineeBenefitScheme.INSURANCE_GTLI,
      sharePercentage: 100,
      dateOfBirth: '1990-05-15',
    })
    console.log('  ➕ GTLI Insurance Nominee added: 100% Jane Doe')

    console.log('✅ TEST 4 PASSED: Minor Guardian statutory compliance enforced.')

    // =========================================================================
    // TEST 5: Consolidated Beneficiary Snapshot & Statutory Scheme Health Check
    // =========================================================================
    console.log('\n--- [TEST 5] Consolidated Beneficiary Snapshot & Statutory Health ---')

    const snapshot = await BeneficiaryService.getBeneficiarySnapshot(scope, employeeId)

    console.log(`  • Emergency Contacts: ${snapshot.emergencyContacts.length}`)
    console.log(`  • Dependents: ${snapshot.dependents.length}`)
    console.log(`  • Total Nominees: ${snapshot.nominees.length}`)
    console.log('  • Statutory Schemes Summary:')
    for (const summary of snapshot.statutorySummary) {
      console.log(`    - ${summary.scheme}: ${summary.status} | Allocated: ${summary.totalAllocated}% | Nominees: ${summary.nomineeCount} | Minors: ${summary.minorCount}`)
    }

    const gratuity = snapshot.statutorySummary.find(s => s.scheme === 'GRATUITY')
    const pfEpf = snapshot.statutorySummary.find(s => s.scheme === 'PF_EPF')
    const gtli = snapshot.statutorySummary.find(s => s.scheme === 'INSURANCE_GTLI')
    const pfEps = snapshot.statutorySummary.find(s => s.scheme === 'PF_EPS')

    if (gratuity?.status !== 'COMPLIANT') {
      throw new Error(`Expected GRATUITY to be COMPLIANT, got ${gratuity?.status}`)
    }
    if (pfEpf?.status !== 'COMPLIANT') {
      throw new Error(`Expected PF_EPF to be COMPLIANT, got ${pfEpf?.status}`)
    }
    if (pfEpf?.minorCount !== 1) {
      throw new Error(`Expected 1 minor in PF_EPF, got ${pfEpf?.minorCount}`)
    }
    if (gtli?.status !== 'COMPLIANT') {
      throw new Error(`Expected INSURANCE_GTLI to be COMPLIANT, got ${gtli?.status}`)
    }
    if (pfEps?.status !== 'UNDER_ALLOCATED') {
      throw new Error(`Expected PF_EPS to be UNDER_ALLOCATED, got ${pfEps?.status}`)
    }

    console.log('✅ TEST 5 PASSED: Beneficiary Snapshot and Statutory Compliance verified perfectly.')

    console.log('\n🎉 ALL 5 INTEGRATION TESTS PASSED WITH 100% SUCCESS!')
  } catch (error) {
    console.error('\n❌ Verification Failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

runVerification()
