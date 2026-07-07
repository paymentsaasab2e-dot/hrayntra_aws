/** Maps AI workspace brief alert codes to Alerts Management setting ids. */
export const AI_ALERT_CODE_TO_SETTINGS_ID = {
  'client.followup_overdue': 'ai.client.followup_overdue',
  'lead.followup_overdue': 'ai.lead.followup_overdue',
  'task.overdue': 'ai.task.overdue',
  'job.low_applicants': 'ai.job.low_applicants',
  'candidate.pipeline_followup_overdue': 'ai.candidate.pipeline_followup_overdue',
  'interview.today': 'ai.interview.today',
  'placement.joining_overdue': 'ai.placement.joining_overdue',
  'team.request_pending': 'ai.team.request_pending',
};

export const AI_WORKSPACE_BRIEF_ALERT_ID = 'ai.workspace_brief';
export const AI_SCHEDULED_BRIEF_ALERT_ID = 'ai.scheduled_brief';
export const AI_GENERAL_ALERT_ID = 'ai.general';

export function resolveAiSettingsAlertId(alert) {
  if (alert?.settingsAlertId) return String(alert.settingsAlertId);
  const code = String(alert?.alertCode || '').trim();
  if (code && AI_ALERT_CODE_TO_SETTINGS_ID[code]) {
    return AI_ALERT_CODE_TO_SETTINGS_ID[code];
  }
  return AI_GENERAL_ALERT_ID;
}
