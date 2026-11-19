import prisma from '../../../shared/prisma';
import { logger } from '../../../shared/logger';

export class TalentSuccessionService {
  /**
   * 9-Box Grid Matrix mapping
   */
  static readonly NINE_BOX_DEFINITIONS: Record<
    string,
    { key: string; title: string; category: string; actionGuidance: string }
  > = {
    '3_3': {
      key: 'STAR',
      title: 'Star (Future Executive)',
      category: 'Top Talent',
      actionGuidance: 'Accelerate leadership development, assign strategic high-impact initiatives, plan next succession move.',
    },
    '3_2': {
      key: 'HIGH_PERFORMER',
      title: 'High Performer (Future Leader)',
      category: 'Key Assets',
      actionGuidance: 'Expand operational scope, provide cross-functional leadership exposure, retention priority.',
    },
    '3_1': {
      key: 'TRUSTED_PROFESSIONAL',
      title: 'Trusted Professional (Workhorse)',
      category: 'Specialists',
      actionGuidance: 'Deepen subject matter expertise, reward consistent high delivery, utilize as technical mentor.',
    },
    '2_3': {
      key: 'RISING_STAR',
      title: 'Rising Star (Growth Potential)',
      category: 'High Potentials',
      actionGuidance: 'Coach on performance consistency, pair with executive mentor, increase project complexity.',
    },
    '2_2': {
      key: 'CORE_PLAYER',
      title: 'Core Player (Key Contributor)',
      category: 'Core Talent',
      actionGuidance: 'Maintain engagement, invest in skill development, optimize current domain impact.',
    },
    '2_1': {
      key: 'EFFECTIVE_PERFORMER',
      title: 'Effective Performer (Solid)',
      category: 'Stable Staff',
      actionGuidance: 'Clarify expectations, provide structured skill refreshment, monitor motivation.',
    },
    '1_3': {
      key: 'ROUGH_DIAMOND',
      title: 'Rough Diamond (Dilemma)',
      category: 'Enigmas',
      actionGuidance: 'Investigate performance blockers, evaluate role fit, assign focused 90-day coaching goals.',
    },
    '1_2': {
      key: 'INCONSISTENT',
      title: 'Inconsistent Performer',
      category: 'Under Watch',
      actionGuidance: 'Establish clear Performance Improvement Plan (PIP), set weekly deliverables, assess capability.',
    },
    '1_1': {
      key: 'UNDERPERFORMER',
      title: 'Risk (Underperformer)',
      category: 'Action Needed',
      actionGuidance: 'Execute formal performance correction or initiate smooth separation transition.',
    },
  };

  /**
   * Compute 9-box position from performance (1-3) and potential (1-3)
   */
  static calculateNineBox(performance: number, potential: number) {
    const p = Math.max(1, Math.min(3, Math.round(performance)));
    const pot = Math.max(1, Math.min(3, Math.round(potential)));
    const def = this.NINE_BOX_DEFINITIONS[`${p}_${pot}`] || this.NINE_BOX_DEFINITIONS['2_2'];
    return {
      performanceLevel: p,
      potentialLevel: pot,
      ...def,
    };
  }

  /**
   * Seed standard competency library and skills
   */
  static async seedStandardSkills(tenantId: string) {
    const skills = [
      {
        code: 'SKILL-SYS-ARCH',
        name: 'Distributed Systems & Scalable Architecture',
        category: 'TECHNICAL',
        description: 'Microservices, message queues, fault-tolerance, and high-throughput transactional engineering.',
        minRequiredLevel: 4,
      },
      {
        code: 'SKILL-CLOUD-K8S',
        name: 'Cloud Infrastructure & Kubernetes',
        category: 'TECHNICAL',
        description: 'Container orchestration, CI/CD pipelines, automated deployments, and zero-downtime scaling.',
        minRequiredLevel: 3,
      },
      {
        code: 'SKILL-LEAD-MENTOR',
        name: 'Engineering Team Leadership & Mentorship',
        category: 'LEADERSHIP',
        description: 'Coaching junior engineers, conducting technical reviews, conflict resolution, and performance management.',
        minRequiredLevel: 3,
      },
      {
        code: 'SKILL-STAKEHOLDER',
        name: 'Strategic Negotiation & Stakeholder Management',
        category: 'LEADERSHIP',
        description: 'Executive alignment, client relationship management, and commercial contract negotiations.',
        minRequiredLevel: 3,
      },
      {
        code: 'SKILL-STAT-COMPLY',
        name: 'Statutory Labor Law & Regulatory Compliance',
        category: 'COMPLIANCE',
        description: 'Indian labor laws (Maternity Benefit Act, POSH Act, PF/ESI/PT regulations), and audit defense.',
        minRequiredLevel: 4,
      },
      {
        code: 'SKILL-FIN-MODEL',
        name: 'Financial Modeling & Headcount Budgeting',
        category: 'DOMAIN',
        description: 'P&L tracking, compensation band structuring, variance analysis, and workforce planning.',
        minRequiredLevel: 3,
      },
    ];

    const results = [];
    for (const s of skills) {
      const existing = await prisma.skillDefinition.findUnique({
        where: { tenantId_code: { tenantId, code: s.code } },
      });
      if (!existing) {
        const created = await prisma.skillDefinition.create({
          data: {
            tenantId,
            code: s.code,
            name: s.name,
            category: s.category,
            description: s.description,
            minRequiredLevel: s.minRequiredLevel,
            isActive: true,
          },
        });
        results.push(created);
      } else {
        results.push(existing);
      }
    }

    logger.info('talent.skills.seeded', { tenantId, count: results.length });
    return results;
  }

  /**
   * List competencies and skills
   */
  static async listSkills(tenantId: string, category?: string) {
    const where: any = { tenantId, isActive: true };
    if (category) where.category = category;
    return prisma.skillDefinition.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Record and update employee skill proficiency
   */
  static async recordSkillProficiency(
    tenantId: string,
    employeeId: string,
    skillId: string,
    proficiencyLevel: number,
    verifiedByUserId?: string
  ) {
    const level = Math.max(1, Math.min(5, Math.round(proficiencyLevel)));

    const record = await prisma.employeeSkill.upsert({
      where: {
        employeeId_skillId: {
          employeeId,
          skillId,
        },
      },
      create: {
        tenantId,
        employeeId,
        skillId,
        proficiencyLevel: level,
        verifiedByUserId,
      },
      update: {
        proficiencyLevel: level,
        verifiedByUserId,
        lastEvaluatedAt: new Date(),
      },
      include: { skill: true },
    });

    return record;
  }

  /**
   * Get employee skill matrix with skill gap analysis
   */
  static async getEmployeeSkillMatrix(tenantId: string, employeeId: string) {
    const [allSkills, empSkills] = await Promise.all([
      prisma.skillDefinition.findMany({ where: { tenantId, isActive: true } }),
      prisma.employeeSkill.findMany({
        where: { tenantId, employeeId },
        include: { skill: true },
      }),
    ]);

    const empSkillMap = new Map<string, number>();
    empSkills.forEach((es) => empSkillMap.set(es.skillId, es.proficiencyLevel));

    return allSkills.map((skill) => {
      const current = empSkillMap.get(skill.id) || 1; // Default Level 1 Beginner
      const gap = Math.max(0, skill.minRequiredLevel - current);
      return {
        skillId: skill.id,
        code: skill.code,
        name: skill.name,
        category: skill.category,
        minRequiredLevel: skill.minRequiredLevel,
        currentProficiencyLevel: current,
        hasGap: gap > 0,
        skillGap: gap,
      };
    });
  }

  /**
   * Assess employee talent and place in 9-box grid
   */
  static async assessEmployeeTalent(
    tenantId: string,
    employeeId: string,
    input: {
      performanceLevel: number;
      potentialLevel: number;
      flightRisk?: string;
      impactOfLoss?: string;
      strengths?: string[];
      developmentAreas?: string[];
      assessedYear?: string;
    },
    assessedByUserId?: string
  ) {
    const { key } = this.calculateNineBox(input.performanceLevel, input.potentialLevel);

    const assessment = await prisma.talentAssessment.create({
      data: {
        tenantId,
        employeeId,
        performanceLevel: input.performanceLevel,
        potentialLevel: input.potentialLevel,
        nineBoxGrid: key,
        flightRisk: input.flightRisk || 'LOW',
        impactOfLoss: input.impactOfLoss || 'MEDIUM',
        strengths: input.strengths || [],
        developmentAreas: input.developmentAreas || [],
        assessedYear: input.assessedYear || '2026',
        assessedByUserId,
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, department: true, designation: true },
        },
      },
    });

    logger.info('talent.assessed', {
      tenantId,
      employeeId,
      grid: key,
      perf: input.performanceLevel,
      pot: input.potentialLevel,
    });

    return assessment;
  }

  /**
   * Get 9-Box Matrix view of workforce
   */
  static async getNineBoxMatrix(tenantId: string, year: string = '2026') {
    const assessments = await prisma.talentAssessment.findMany({
      where: { tenantId, assessedYear: year },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, department: true, designation: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Deduplicate by latest assessment per employee
    const latestMap = new Map<string, typeof assessments[0]>();
    assessments.forEach((a) => {
      if (!latestMap.has(a.employeeId)) latestMap.set(a.employeeId, a);
    });

    const deduped = Array.from(latestMap.values());

    // Build standard 9 boxes
    const grid: Record<string, { definition: any; employees: any[] }> = {};
    for (const [coord, def] of Object.entries(this.NINE_BOX_DEFINITIONS)) {
      grid[def.key] = {
        definition: { ...def, coordinate: coord },
        employees: deduped.filter((a) => a.nineBoxGrid === def.key),
      };
    }

    return {
      assessedYear: year,
      totalAssessed: deduped.length,
      hiPoCount: deduped.filter((a) => a.nineBoxGrid === 'STAR' || a.nineBoxGrid === 'RISING_STAR').length,
      riskCount: deduped.filter((a) => a.nineBoxGrid === 'UNDERPERFORMER' || a.nineBoxGrid === 'INCONSISTENT').length,
      grid,
    };
  }

  /**
   * Create critical role succession plan
   */
  static async createSuccessionPlan(
    tenantId: string,
    input: {
      positionTitle: string;
      department: string;
      currentIncumbentId?: string;
      criticality?: string;
      targetReadinessDate?: Date | string;
    }
  ) {
    const plan = await prisma.successionPlan.create({
      data: {
        tenantId,
        positionTitle: input.positionTitle,
        department: input.department,
        currentIncumbentId: input.currentIncumbentId || null,
        criticality: input.criticality || 'HIGH',
        targetReadinessDate: input.targetReadinessDate ? new Date(input.targetReadinessDate) : null,
      },
      include: { currentIncumbent: true },
    });

    logger.info('talent.succession.created', { tenantId, planId: plan.id, role: plan.positionTitle });
    return plan;
  }

  /**
   * List succession plans with candidate bench
   */
  static async listSuccessionPlans(tenantId: string, department?: string) {
    const where: any = { tenantId, status: 'ACTIVE' };
    if (department) where.department = department;

    return prisma.successionPlan.findMany({
      where,
      include: {
        currentIncumbent: {
          select: { id: true, firstName: true, lastName: true, department: true, designation: true },
        },
        candidates: {
          include: {
            candidateEmployee: {
              select: { id: true, firstName: true, lastName: true, department: true, designation: true },
            },
          },
          orderBy: { ranking: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Add or update candidate to succession bench
   */
  static async addCandidate(
    tenantId: string,
    planId: string,
    input: {
      candidateEmployeeId: string;
      readiness: 'READY_NOW' | 'READY_1_YEAR' | 'READY_2_YEARS' | 'EMERGENCY_BACKUP';
      ranking?: number;
      notes?: string;
    }
  ) {
    const candidate = await prisma.successionCandidate.upsert({
      where: {
        planId_candidateEmployeeId: {
          planId,
          candidateEmployeeId: input.candidateEmployeeId,
        },
      },
      create: {
        tenantId,
        planId,
        candidateEmployeeId: input.candidateEmployeeId,
        readiness: input.readiness,
        ranking: input.ranking || 1,
        notes: input.notes,
      },
      update: {
        readiness: input.readiness,
        ranking: input.ranking || 1,
        notes: input.notes,
      },
      include: {
        candidateEmployee: true,
      },
    });

    logger.info('talent.candidate.added', { tenantId, planId, candidate: input.candidateEmployeeId });
    return candidate;
  }
}
