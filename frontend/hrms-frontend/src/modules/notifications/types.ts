export type NotificationType = 'task' | 'leave' | 'attendance' | 'performance' | 'system'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  description: string
  relatedId?: string
  relatedPath?: string
  userId: string
  isRead: boolean
  createdAt: string
}
