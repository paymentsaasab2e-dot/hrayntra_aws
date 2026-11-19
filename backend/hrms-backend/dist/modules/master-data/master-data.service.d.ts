import { DepartmentMaster, DesignationMaster, GradeMaster, CostCentreMaster } from '../policies/policy-rules';
export declare class MasterDataService {
    static getMasterData(tenantId: string): Promise<{
        departments: {
            employeeCount: number;
            id: string;
            code: string;
            name: string;
            description?: string;
            headEmployeeId?: string;
            headEmployeeName?: string;
            costCenterId?: string;
            status: "ACTIVE" | "INACTIVE";
            createdAt?: string;
        }[];
        designations: {
            employeeCount: number;
            id: string;
            code: string;
            title: string;
            departmentId?: string;
            departmentName?: string;
            gradeId?: string;
            gradeCode?: string;
            approvalLevel?: "L1" | "L2" | "L3" | "NONE";
            status: "ACTIVE" | "INACTIVE";
            createdAt?: string;
        }[];
        grades: GradeMaster[];
        costCentres: CostCentreMaster[];
        totalEmployees: number;
        employeeOptions: {
            id: string;
            employeeId: string;
            name: string;
            department: string;
            designation: string;
        }[];
    }>;
    static upsertDepartment(tenantId: string, userId: string, data: Partial<DepartmentMaster>): Promise<{
        departments: {
            employeeCount: number;
            id: string;
            code: string;
            name: string;
            description?: string;
            headEmployeeId?: string;
            headEmployeeName?: string;
            costCenterId?: string;
            status: "ACTIVE" | "INACTIVE";
            createdAt?: string;
        }[];
        designations: {
            employeeCount: number;
            id: string;
            code: string;
            title: string;
            departmentId?: string;
            departmentName?: string;
            gradeId?: string;
            gradeCode?: string;
            approvalLevel?: "L1" | "L2" | "L3" | "NONE";
            status: "ACTIVE" | "INACTIVE";
            createdAt?: string;
        }[];
        grades: GradeMaster[];
        costCentres: CostCentreMaster[];
        totalEmployees: number;
        employeeOptions: {
            id: string;
            employeeId: string;
            name: string;
            department: string;
            designation: string;
        }[];
    }>;
    static deleteDepartment(tenantId: string, userId: string, id: string): Promise<{
        departments: {
            employeeCount: number;
            id: string;
            code: string;
            name: string;
            description?: string;
            headEmployeeId?: string;
            headEmployeeName?: string;
            costCenterId?: string;
            status: "ACTIVE" | "INACTIVE";
            createdAt?: string;
        }[];
        designations: {
            employeeCount: number;
            id: string;
            code: string;
            title: string;
            departmentId?: string;
            departmentName?: string;
            gradeId?: string;
            gradeCode?: string;
            approvalLevel?: "L1" | "L2" | "L3" | "NONE";
            status: "ACTIVE" | "INACTIVE";
            createdAt?: string;
        }[];
        grades: GradeMaster[];
        costCentres: CostCentreMaster[];
        totalEmployees: number;
        employeeOptions: {
            id: string;
            employeeId: string;
            name: string;
            department: string;
            designation: string;
        }[];
    }>;
    static upsertDesignation(tenantId: string, userId: string, data: Partial<DesignationMaster>): Promise<{
        departments: {
            employeeCount: number;
            id: string;
            code: string;
            name: string;
            description?: string;
            headEmployeeId?: string;
            headEmployeeName?: string;
            costCenterId?: string;
            status: "ACTIVE" | "INACTIVE";
            createdAt?: string;
        }[];
        designations: {
            employeeCount: number;
            id: string;
            code: string;
            title: string;
            departmentId?: string;
            departmentName?: string;
            gradeId?: string;
            gradeCode?: string;
            approvalLevel?: "L1" | "L2" | "L3" | "NONE";
            status: "ACTIVE" | "INACTIVE";
            createdAt?: string;
        }[];
        grades: GradeMaster[];
        costCentres: CostCentreMaster[];
        totalEmployees: number;
        employeeOptions: {
            id: string;
            employeeId: string;
            name: string;
            department: string;
            designation: string;
        }[];
    }>;
    static deleteDesignation(tenantId: string, userId: string, id: string): Promise<{
        departments: {
            employeeCount: number;
            id: string;
            code: string;
            name: string;
            description?: string;
            headEmployeeId?: string;
            headEmployeeName?: string;
            costCenterId?: string;
            status: "ACTIVE" | "INACTIVE";
            createdAt?: string;
        }[];
        designations: {
            employeeCount: number;
            id: string;
            code: string;
            title: string;
            departmentId?: string;
            departmentName?: string;
            gradeId?: string;
            gradeCode?: string;
            approvalLevel?: "L1" | "L2" | "L3" | "NONE";
            status: "ACTIVE" | "INACTIVE";
            createdAt?: string;
        }[];
        grades: GradeMaster[];
        costCentres: CostCentreMaster[];
        totalEmployees: number;
        employeeOptions: {
            id: string;
            employeeId: string;
            name: string;
            department: string;
            designation: string;
        }[];
    }>;
    static upsertGrade(tenantId: string, userId: string, data: Partial<GradeMaster>): Promise<{
        departments: {
            employeeCount: number;
            id: string;
            code: string;
            name: string;
            description?: string;
            headEmployeeId?: string;
            headEmployeeName?: string;
            costCenterId?: string;
            status: "ACTIVE" | "INACTIVE";
            createdAt?: string;
        }[];
        designations: {
            employeeCount: number;
            id: string;
            code: string;
            title: string;
            departmentId?: string;
            departmentName?: string;
            gradeId?: string;
            gradeCode?: string;
            approvalLevel?: "L1" | "L2" | "L3" | "NONE";
            status: "ACTIVE" | "INACTIVE";
            createdAt?: string;
        }[];
        grades: GradeMaster[];
        costCentres: CostCentreMaster[];
        totalEmployees: number;
        employeeOptions: {
            id: string;
            employeeId: string;
            name: string;
            department: string;
            designation: string;
        }[];
    }>;
    static deleteGrade(tenantId: string, userId: string, id: string): Promise<{
        departments: {
            employeeCount: number;
            id: string;
            code: string;
            name: string;
            description?: string;
            headEmployeeId?: string;
            headEmployeeName?: string;
            costCenterId?: string;
            status: "ACTIVE" | "INACTIVE";
            createdAt?: string;
        }[];
        designations: {
            employeeCount: number;
            id: string;
            code: string;
            title: string;
            departmentId?: string;
            departmentName?: string;
            gradeId?: string;
            gradeCode?: string;
            approvalLevel?: "L1" | "L2" | "L3" | "NONE";
            status: "ACTIVE" | "INACTIVE";
            createdAt?: string;
        }[];
        grades: GradeMaster[];
        costCentres: CostCentreMaster[];
        totalEmployees: number;
        employeeOptions: {
            id: string;
            employeeId: string;
            name: string;
            department: string;
            designation: string;
        }[];
    }>;
    static upsertCostCentre(tenantId: string, userId: string, data: Partial<CostCentreMaster>): Promise<{
        departments: {
            employeeCount: number;
            id: string;
            code: string;
            name: string;
            description?: string;
            headEmployeeId?: string;
            headEmployeeName?: string;
            costCenterId?: string;
            status: "ACTIVE" | "INACTIVE";
            createdAt?: string;
        }[];
        designations: {
            employeeCount: number;
            id: string;
            code: string;
            title: string;
            departmentId?: string;
            departmentName?: string;
            gradeId?: string;
            gradeCode?: string;
            approvalLevel?: "L1" | "L2" | "L3" | "NONE";
            status: "ACTIVE" | "INACTIVE";
            createdAt?: string;
        }[];
        grades: GradeMaster[];
        costCentres: CostCentreMaster[];
        totalEmployees: number;
        employeeOptions: {
            id: string;
            employeeId: string;
            name: string;
            department: string;
            designation: string;
        }[];
    }>;
    static deleteCostCentre(tenantId: string, userId: string, id: string): Promise<{
        departments: {
            employeeCount: number;
            id: string;
            code: string;
            name: string;
            description?: string;
            headEmployeeId?: string;
            headEmployeeName?: string;
            costCenterId?: string;
            status: "ACTIVE" | "INACTIVE";
            createdAt?: string;
        }[];
        designations: {
            employeeCount: number;
            id: string;
            code: string;
            title: string;
            departmentId?: string;
            departmentName?: string;
            gradeId?: string;
            gradeCode?: string;
            approvalLevel?: "L1" | "L2" | "L3" | "NONE";
            status: "ACTIVE" | "INACTIVE";
            createdAt?: string;
        }[];
        grades: GradeMaster[];
        costCentres: CostCentreMaster[];
        totalEmployees: number;
        employeeOptions: {
            id: string;
            employeeId: string;
            name: string;
            department: string;
            designation: string;
        }[];
    }>;
}
