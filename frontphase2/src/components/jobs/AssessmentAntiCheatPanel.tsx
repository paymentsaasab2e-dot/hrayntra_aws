'use client';

import type { AntiCheatSettings } from '../../lib/preScreenAssessmentConfig';

const fieldClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400';

export function AssessmentAntiCheatPanel({
  value,
  onChange,
  disabled,
  showCodingOptions = false,
  showVideoOptions = false,
}: {
  value: AntiCheatSettings;
  onChange: (next: AntiCheatSettings) => void;
  disabled?: boolean;
  showCodingOptions?: boolean;
  showVideoOptions?: boolean;
}) {
  const patch = (p: Partial<AntiCheatSettings>) => onChange({ ...value, ...p });

  const Check = ({
    checked,
    onChecked,
    label,
  }: {
    checked: boolean;
    onChecked: (v: boolean) => void;
    label: string;
  }) => (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        className="rounded border-slate-300 text-violet-600"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChecked(e.target.checked)}
      />
      {label}
    </label>
  );

  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-900">Anti-cheat settings</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Monitored attempt — tab switches and paste events are logged on the candidate portal.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Check
          label="Detect tab switch"
          checked={value.detectTabSwitch}
          onChecked={(v) => patch({ detectTabSwitch: v })}
        />
        <Check
          label="Detect copy paste"
          checked={value.detectCopyPaste}
          onChecked={(v) => patch({ detectCopyPaste: v })}
        />
        <Check
          label="Disable right click"
          checked={value.disableRightClick}
          onChecked={(v) => patch({ disableRightClick: v })}
        />
        <Check
          label="Full screen mode"
          checked={value.fullScreenRequired}
          onChecked={(v) => patch({ fullScreenRequired: v })}
        />
        <Check
          label="Record screen (optional)"
          checked={value.recordScreen}
          onChecked={(v) => patch({ recordScreen: v })}
        />
        <Check
          label="Webcam monitoring (optional)"
          checked={value.webcamMonitoring}
          onChecked={(v) => patch({ webcamMonitoring: v, ...(v ? {} : {}) })}
        />
        {showCodingOptions ? (
          <Check
            label="Disable copy paste"
            checked={value.disableCopyPaste}
            onChecked={(v) => patch({ disableCopyPaste: v })}
          />
        ) : null}
      </div>

      {value.detectTabSwitch ? (
        <div className="max-w-xs">
          <label className="block text-xs font-medium text-slate-600 mb-1">Maximum tab switches</label>
          <input
            type="number"
            min={1}
            max={20}
            className={fieldClass}
            value={value.maxTabSwitches}
            disabled={disabled}
            onChange={(e) => patch({ maxTabSwitches: Math.max(1, Number(e.target.value) || 3) })}
          />
        </div>
      ) : null}

      {showVideoOptions ? (
        <p className="text-xs text-slate-500">
          Camera and microphone requirements are configured in the video test section above.
        </p>
      ) : null}
    </div>
  );
}
