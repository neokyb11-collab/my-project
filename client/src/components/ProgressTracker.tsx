import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export interface ProgressTrackerProps {
  isVisible: boolean;
  /** Error message to display. If set, shows error state. */
  error?: string | null;
  /** 0-100 progress value. Drives the progress bar. */
  progress: number;
  /** Short label for the current step */
  currentStep: string;
  /** Longer description of what is happening */
  message: string;
  /** Whether the generation has fully completed (DB write done) */
  isComplete: boolean;
  onComplete?: () => void;
}

const STEPS = [
  { id: "upload", label: "오디오 파일 업로드" },
  { id: "transcribe", label: "음성 인식 (Whisper)" },
  { id: "align", label: "스크립트 정렬 (AI)" },
  { id: "generate", label: "SRT 자막 생성" },
  { id: "save", label: "결과 저장" },
];

function getActiveStepIndex(progress: number): number {
  if (progress < 10) return 0;
  if (progress < 40) return 1;
  if (progress < 55) return 2;
  if (progress < 80) return 3;
  return 4;
}

export function ProgressTracker({
  isVisible,
  error,
  progress,
  currentStep,
  message,
  isComplete,
  onComplete,
}: ProgressTrackerProps) {
  if (!isVisible) return null;

  const activeIdx = getActiveStepIndex(progress);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold text-slate-900 mb-1">자막 생성 중</h2>
        <p className="text-sm text-slate-500 mb-6">{message}</p>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">전체 진행률</span>
            <span className="text-sm font-semibold text-blue-600">{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                error ? "bg-red-500" : "bg-gradient-to-r from-blue-500 to-blue-600"
              }`}
              style={{ width: `${error ? 100 : progress}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3 mb-6">
          {STEPS.map((step, idx) => {
            const isDone = !error && (isComplete || idx < activeIdx);
            const isActive = !error && !isComplete && idx === activeIdx;
            const isErr = !!error && idx === activeIdx;

            return (
              <div key={step.id} className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  {isDone && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                  {isActive && <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />}
                  {isErr && <AlertCircle className="w-5 h-5 text-red-500" />}
                  {!isDone && !isActive && !isErr && (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-300" />
                  )}
                </div>
                <span
                  className={`text-sm font-medium ${
                    isDone
                      ? "text-green-700"
                      : isActive
                      ? "text-blue-700"
                      : isErr
                      ? "text-red-700"
                      : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Error display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <p className="text-sm font-semibold text-red-800 mb-1">오류가 발생했습니다</p>
            <p className="text-sm text-red-700 break-words">{error}</p>
          </div>
        )}

        {/* Complete action */}
        {isComplete && !error && (
          <button
            onClick={onComplete}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors"
          >
            결과 확인하기
          </button>
        )}

        {/* Error close */}
        {error && (
          <button
            onClick={onComplete}
            className="w-full py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl transition-colors"
          >
            닫기
          </button>
        )}

        {!isComplete && !error && (
          <div className="mt-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-xs text-blue-700">
              오디오 길이에 따라 1~5분 정도 소요될 수 있습니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
