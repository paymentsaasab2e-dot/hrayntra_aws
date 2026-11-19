import { OrgScopeContext } from '../../shared/org/org-scope.service';
export declare class OrgUnitService {
    static getTree(scope: OrgScopeContext): Promise<{
        id: any;
        tenantId: any;
        parentId: any;
        levelOrder: any;
        name: any;
        path: any;
        isLeaf: any;
        status: any;
        createdByUserId: any;
        children: any;
        _count: any;
        createdAt: any;
        updatedAt: any;
    }[]>;
    static getById(id: string, scope: OrgScopeContext): Promise<{
        id: any;
        tenantId: any;
        parentId: any;
        levelOrder: any;
        name: any;
        path: any;
        isLeaf: any;
        status: any;
        createdByUserId: any;
        children: any;
        _count: any;
        createdAt: any;
        updatedAt: any;
    }>;
    static create(data: {
        parentId: string;
        name: string;
        isLeaf: boolean;
    }, actor: {
        id: string;
        role: string;
    }, scope: OrgScopeContext): Promise<{
        id: any;
        tenantId: any;
        parentId: any;
        levelOrder: any;
        name: any;
        path: any;
        isLeaf: any;
        status: any;
        createdByUserId: any;
        children: any;
        _count: any;
        createdAt: any;
        updatedAt: any;
    }>;
    static approvePending(orgUnitId: string, actor: {
        id: string;
        role: string;
    }): Promise<{
        id: any;
        tenantId: any;
        parentId: any;
        levelOrder: any;
        name: any;
        path: any;
        isLeaf: any;
        status: any;
        createdByUserId: any;
        children: any;
        _count: any;
        createdAt: any;
        updatedAt: any;
    }>;
    static rejectPending(orgUnitId: string, actor: {
        id: string;
        role: string;
    }): Promise<{
        success: boolean;
    }>;
    static update(id: string, data: {
        name?: string;
    }, scope: OrgScopeContext): Promise<{
        id: any;
        tenantId: any;
        parentId: any;
        levelOrder: any;
        name: any;
        path: any;
        isLeaf: any;
        status: any;
        createdByUserId: any;
        children: any;
        _count: any;
        createdAt: any;
        updatedAt: any;
    }>;
    static delete(id: string, scope: OrgScopeContext, actorRole: string): Promise<{
        success: boolean;
    }>;
}
