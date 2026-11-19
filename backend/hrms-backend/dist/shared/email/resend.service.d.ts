export declare function isResendConfigured(): boolean;
/** Reserved for future login OTP flow (mobile / 2FA). */
export declare function isOtpTemplateConfigured(): boolean;
export type WelcomeEmailPayload = {
    to: string;
    displayName: string;
    email: string;
    password: string;
    role: string;
    employeeId?: string | null;
};
export type TenantAdminWelcomePayload = WelcomeEmailPayload & {
    tenantName: string;
};
export declare function sendTenantAdminWelcomeEmail(payload: TenantAdminWelcomePayload): Promise<{
    sent: boolean;
    skipped: boolean;
    message: string;
    id: string;
} | {
    sent: boolean;
    skipped: boolean;
    message: any;
    id?: undefined;
}>;
export declare function sendWelcomeUserEmail(payload: WelcomeEmailPayload): Promise<{
    sent: boolean;
    skipped: boolean;
    message: string;
    id: string;
} | {
    sent: boolean;
    skipped: boolean;
    message: any;
    id?: undefined;
}>;
