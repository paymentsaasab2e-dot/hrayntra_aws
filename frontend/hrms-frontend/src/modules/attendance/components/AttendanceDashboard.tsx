"use client"
import * as React from 'react'
import { SectionCard, Button, StatusBadge } from '@hryantra/ui'
import { useStore, CURRENT_USER_ID } from '@/store/StoreProvider'
import { LogIn, LogOut, Navigation2 } from 'lucide-react'

interface AttendanceDashboardProps {
  employeeId?: string
  employeeName?: string
}

export function AttendanceDashboard({ employeeId = CURRENT_USER_ID, employeeName }: AttendanceDashboardProps) {
  const { attendanceRecords, checkIn, checkOut, permissions } = useStore()
  
  const todayDate = new Date().toLocaleDateString('en-CA')
  const todayRecord = [...attendanceRecords]
    .filter(r => r.date === todayDate && r.employeeId === employeeId)
    .sort((a, b) => new Date(b.checkIn || b.date).getTime() - new Date(a.checkIn || a.date).getTime())[0]
  const activeTodayCount = attendanceRecords.filter(r => r.date === todayDate && !r.checkOut).length
  
  const hasCheckedIn = !!todayRecord
  const hasCheckedOut = !!todayRecord?.checkOut
  const canRemotePunch = permissions.actions.attendance_punch_remote_self === true
  
  const formatTime = (isoString?: string | null) => {
    if (!isoString) return '--:--'
    return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <SectionCard title="Today's Attendance">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 border-b border-ds-neutral-100 pb-4">
          <div className="flex flex-col">
            <span className="text-ds-label text-ds-neutral-500 uppercase mb-1">Employee</span>
            <span className="text-ds-body font-semibold text-ds-brand-navy">{employeeName || employeeId}</span>
            <span className="text-ds-caption text-ds-neutral-400">{employeeId}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-ds-label text-ds-neutral-500 uppercase mb-1">Punched In Today</span>
            <span className="text-ds-heading font-semibold text-ds-brand-navy">{activeTodayCount}</span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-ds-label text-ds-neutral-500 uppercase mb-1">Status</span>
              <div className="flex items-center">
                <StatusBadge status={todayRecord?.status || 'Absent'} />
              </div>
            </div>

            <div className="flex flex-col">
              <span className="text-ds-label text-ds-neutral-500 uppercase mb-1">Check In</span>
              <span className="text-ds-heading font-medium text-ds-brand-navy">{formatTime(todayRecord?.checkIn)}</span>
            </div>

            <div className="flex flex-col">
              <span className="text-ds-label text-ds-neutral-500 uppercase mb-1">Check Out</span>
              <span className="text-ds-heading font-medium text-ds-brand-navy">{formatTime(todayRecord?.checkOut)}</span>
            </div>

            {todayRecord?.approvalStatus && (
              <div className="flex flex-col">
                <span className="text-ds-label text-ds-neutral-500 uppercase mb-1">Late Approval</span>
                <div className="flex items-center">
                  <StatusBadge status={todayRecord.approvalStatus} />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!hasCheckedIn ? (
              <>
                <Button variant="default" onClick={() => checkIn('office', undefined, employeeId)}>
                  <LogIn className="size-4 mr-2" />
                  Office Check-in
                </Button>
                {canRemotePunch && (
                  <Button variant="outline" onClick={() => checkIn('remote', 'Home', employeeId)}>
                    <Navigation2 className="size-4 mr-2" />
                    Remote Check-in
                  </Button>
                )}
              </>
            ) : !hasCheckedOut ? (
              <Button variant="destructive-outline" onClick={() => checkOut(employeeId)}>
                <LogOut className="size-4 mr-2" />
                Check Out
              </Button>
            ) : (
              <span className="text-ds-body-sm font-medium text-ds-success pr-4">Session recorded</span>
            )}
          </div>
        </div>

        {todayRecord?.approvalRemark && (
          <div className="rounded-lg border border-ds-neutral-200 bg-ds-neutral-50 px-4 py-3 text-ds-body-sm text-ds-neutral-600">
            <span className="font-semibold text-ds-brand-navy">Attendance Note:</span> {todayRecord.approvalRemark}
          </div>
        )}
      </div>
    </SectionCard>
  )
}
