import { PrismaClient, FamilyRelationship, NomineeBenefitScheme } from '@prisma/client'
import { BeneficiaryService } from '../modules/employees/beneficiary/beneficiary.service'
import { EmployeeChangeService } from '../modules/employees/employee-change.service'
import { OrgScopeContext } from '../shared/org/org-scope.service'

const prisma = new PrismaClient()

async function runEndToEndVerification() {
  console.log('🚀 Running Comprehensive End-to-End Consistency & Visibility Verification...\n')

  try {
    // 1. Locate test employee
    const employee = await prisma.employee.findFirst({
      where: {
        OR: [{ employeeId: 'EMP-005' }, { email: 'alex.test@hryantra.com' }],
      },
    })

    if (!employee || !employee.tenantId) {
      throw new Error('Test employee (EMP-005 / alex.test@hryantra.com) not found.')
    }

    const tenantId: string = employee.tenantId
    const employeeId: string = employee.id
    const employeeCode: string = employee.employeeId
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN', tenantId } })

    if (!adminUser) throw new Error('Admin user not found')

    const adminScope: OrgScopeContext = {
      tenantId,
      orgUnitId: null,
      allowedOrgUnitIds: null,
      scopedEmployeeIds: null,
      employeeSelfOnly: false,
      isHqAdmin: true,
    }

    console.log(`👤 Verified Employee: ${employee.firstName} ${employee.lastName} (${employeeCode}, ObjectId: ${employeeId})`)

    // =========================================================================
    // STEP 1: Verify Beneficiaries & Statutory Compliance Visibility
    // =========================================================================
    console.log('\n--- [CHECK 1] Beneficiaries, Dependents & Statutory Schemes ---')

    const snapshotByCode = await BeneficiaryService.getBeneficiarySnapshot(adminScope, employeeCode)
    const snapshotById = await BeneficiaryService.getBeneficiarySnapshot(adminScope, employeeId)

    if (snapshotByCode.emergencyContacts.length !== snapshotById.emergencyContacts.length) {
      throw new Error('Discrepancy between lookup by employeeCode vs ObjectId!')
    }

    console.log(`  • Emergency Contacts: ${snapshotById.emergencyContacts.length} (Primary: ${snapshotById.emergencyContacts.find(c => c.isPrimary)?.name})`)
    console.log(`  • Family Dependents: ${snapshotById.dependents.length} (GMC Covered: ${snapshotById.dependents.filter(d => d.isCoveredUnderGmc).length})`)
    console.log(`  • Nominees: ${snapshotById.nominees.length}`)

    for (const scheme of snapshotById.statutorySummary) {
      console.log(`    - ${scheme.scheme}: ${scheme.status} (${scheme.totalAllocated}% allocated, ${scheme.minorCount} minors)`)
    }

    const gratuity = snapshotById.statutorySummary.find(s => s.scheme === 'GRATUITY')
    const pfEpf = snapshotById.statutorySummary.find(s => s.scheme === 'PF_EPF')
    if (gratuity?.status !== 'COMPLIANT' || pfEpf?.status !== 'COMPLIANT') {
      throw new Error('Expected GRATUITY and PF_EPF to be COMPLIANT!')
    }
    console.log('✅ CHECK 1 PASSED: Beneficiaries & Statutory compliance data consistent across dual lookups.')

    // =========================================================================
    // STEP 2: Full Lifecycle of Employee Change Request
    // =========================================================================
    console.log('\n--- [CHECK 2] Employee Change Request Lifecycle & Approval Mirroring ---')

    const currentDesignation = employee.designation
    const proposedDesignation = 'Senior Lead Specialist'

    console.log(`  Submitting change request: "${currentDesignation}" ➔ "${proposedDesignation}"`)
    const changeReq = await EmployeeChangeService.submitChangeRequest(
      adminScope,
      employeeId,
      adminUser.id,
      {
        category: 'JOB_ROLE',
        effectiveDate: new Date(),
        reason: 'Performance merit promotion to Senior Lead Specialist',
        changes: {
          designation: { oldValue: currentDesignation, newValue: proposedDesignation },
        },
      }
    )

    console.log(`  ➕ Change Request Created: ID ${changeReq.id}, Status: ${changeReq.status}`)
    if (changeReq.status !== 'PENDING') throw new Error('Expected status to be PENDING')

    // Verify it appears in pending query by employeeCode
    const pendingList = await EmployeeChangeService.getChangeRequests(adminScope, {
      employeeId: employeeCode,
      status: 'PENDING',
    })
    console.log(`  🔍 Queried pending requests by employeeCode "${employeeCode}": Found ${pendingList.length}`)
    if (pendingList.length === 0 || pendingList[0].id !== changeReq.id) {
      throw new Error('Pending change request not found via employeeCode lookup!')
    }

    // Verify mirrored ApprovalRequest
    const approvalReq = await prisma.approvalRequest.findFirst({
      where: { referenceId: changeReq.id, type: 'EMPLOYEE_CHANGE', tenantId },
    })
    console.log(`  🔗 Mirrored ApprovalRequest in /approvals queue: ID ${approvalReq?.id}, Type: ${approvalReq?.type}, Status: ${approvalReq?.status}`)
    if (!approvalReq || approvalReq.status !== 'PENDING') {
      throw new Error('Mirrored ApprovalRequest was not created in PENDING state!')
    }

    // =========================================================================
    // STEP 3: Approve Change Request & Verify Cascading Updates
    // =========================================================================
    console.log('\n--- [CHECK 3] Approval Execution & Cascading Profile / History Update ---')

    const approvalResult = await EmployeeChangeService.updateChangeRequestStatus(
      adminScope,
      changeReq.id,
      adminUser.id,
      'APPROVED',
      'Approved by Executive Committee'
    )
    console.log(`  ✨ Change request approved: Status = ${approvalResult.status}`)
    if (approvalResult.status !== 'APPROVED') throw new Error('Expected approved status')

    // Verify employee record was updated
    const updatedEmployee = await prisma.employee.findUnique({ where: { id: employeeId } })
    console.log(`  🔄 Employee profile designation updated: "${updatedEmployee?.designation}"`)
    if (updatedEmployee?.designation !== proposedDesignation) {
      throw new Error(`Employee designation was not updated to ${proposedDesignation}!`)
    }

    // Verify EmploymentHistory milestone was automatically created
    const historyMilestones = await EmployeeChangeService.getEmploymentHistory(adminScope, employeeCode)
    console.log(`  📜 Career History Milestones count: ${historyMilestones.length}`)
    const latestMilestone = historyMilestones[0]
    console.log(`  🏆 Latest Milestone: ${latestMilestone.changeType} - "${latestMilestone.designation}" (${latestMilestone.remarks})`)
    if (latestMilestone.changeType !== 'PROMOTION' || latestMilestone.designation !== proposedDesignation) {
      throw new Error('EmploymentHistory milestone was not properly recorded for the promotion!')
    }

    // Verify linked ApprovalRequest was updated to APPROVED
    const updatedApprovalReq = await prisma.approvalRequest.findFirst({
      where: { referenceId: changeReq.id, type: 'EMPLOYEE_CHANGE', tenantId },
    })
    console.log(`  ✅ Unified ApprovalRequest status: ${updatedApprovalReq?.status}`)
    if (updatedApprovalReq?.status !== 'APPROVED') {
      throw new Error('Unified ApprovalRequest was not updated to APPROVED!')
    }

    console.log('✅ CHECK 3 PASSED: Full lifecycle approved and cascaded across Profile, Career History, and Approvals.')

    // =========================================================================
    // STEP 4: Reset designation cleanly back to original for idempotent future runs
    // =========================================================================
    await prisma.employee.update({
      where: { id: employeeId },
      data: { designation: currentDesignation },
    })
    console.log(`\n🧹 Maintained clean state: Reset designation back to "${currentDesignation}".`)

    console.log('\n🎉 ALL END-TO-END DATA VISIBILITY CHECKS PASSED WITH 100% SUCCESS!')
  } catch (error) {
    console.error('\n❌ End-to-End Verification Failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

runEndToEndVerification()
