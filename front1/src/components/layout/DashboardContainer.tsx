'use client';

import { ReactNode } from 'react';

interface DashboardContainerProps {
    children: ReactNode;
    className?: string;
}

export default function DashboardContainer({ children, className = '' }: DashboardContainerProps) {
    return (
        <div className={`mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8 overflow-x-hidden ${className}`}>
            {children}
        </div>
    );
}
