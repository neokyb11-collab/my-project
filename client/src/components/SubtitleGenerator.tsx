import { useRef, useState } from "react";
import { Upload, X, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ProgressTracker } from "./ProgressTracker";
import { SubtitleResults } from "./SubtitleResults";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  order: number;
  file: File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function SubtitleGenerator() {
  const [projectName, setProjectName] = useState("");
  const [script, setScript] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Progress state (driven by server response)
  const [showProgress, setShowProgress] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [progressStep, setProgressStep] = useState("");
  const [progressMessage, setProgressMessage] = useState("");
  const [progressError, setProgressError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  // Results state
  const [showResults, setShowResults] = useState(false);
  const [srtContent, setSrtContent] = useState("");
  const [savedProjectName, setSavedProjectName] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const createProjectMutation = trpc.subtitles.createProject.useMutation();
  const uploadAudioFileMutation = trpc.subtitles.uploadAudioFile.useMutation();
  const generateSubtitlesMutation = trpc.subtitles.generateSubtitles.useMutation();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.currentTarget.files;
    if (!selected) return;
    const newFiles: UploadedFile[] = [];
    for (let i = 0; i < selected.length; i++) {
      const f = selected[i];
      newFiles.push({ id: `${Date.now()}-${i}`, name: f.name, size: f.size, order: files.length + i, file: f });
    }
    setFiles((prev) => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id).map((f, i) => ({ ...f, order: i })));
  };

  const resetProgress = () => {
    setProgressValue(0);
    setProgressStep("");
    setProgressMessage("");
    setProgressError(null);
    setIsComplete(false);
  };

  const handleCreate = async () => {
    if (!projectName.trim() || !script.trim() || files.length === 0) {
      alert("프로젝트 이름, 스크립트를 입력하고 최소 하나의 오디오 파일을 업로드해주세요.");
      return;
    }

    setIsProcessing(true);
    resetProgress();
    setShowProgress(true);
    setSavedProjectName(projectName.trim());

    try {
      // ── Step 1: Create project ──────────────────────────────────────────────
      setProgressValue(5);
      setProgressStep("프로젝트 생성 중");
      setProgressMessage("프로젝트를 초기화하는 중...");

      const { projectId } = await createProjectMutation.mutateAsync({
        projectName: projectName.trim(),
        script: script.trim(),
      });

      // ── Step 2: Upload audio files ──────────────────────────────────────────
      setProgressValue(8);
      setProgressStep("파일 업로드 중");
      setProgressMessage(`${files.length}개 오디오 파일 업로드 중...`);

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const base64 = await fileToBase64(f.file);
        const mimeType = f.file.type || "audio/mpeg";

        await uploadAudioFileMutation.mutateAsync({
          projectId,
          fileName: f.name,
          fileData: base64,
          fileOrder: f.order,
          mimeType,
        });

        setProgressValue(8 + ((i + 1) / files.length) * 2);
        setProgressMessage(`업로드 완료: ${f.name}`);
      }

      // ── Step 3: Generate subtitles ──────────────────────────────────────────
      // generateSubtitles is synchronous on the server – it runs the full pipeline
      // and returns srtContent directly. This guarantees DB write is done before
      // we display results (fixes the timing bug).
      setProgressValue(10);
      setProgressStep("음성 인식 중");
      setProgressMessage("AI가 오디오를 분석하는 중...");

      // Simulate intermediate progress while waiting for server
      const progressInterval = setInterval(() => {
        setProgressValue((prev) => {
          if (prev >= 90) return prev;
          return prev + (90 - prev) * 0.05;
        });
      }, 1500);

      let result: { success: boolean; projectId: string; srtContent?: string };
      try {
        result = await generateSubtitlesMutation.mutateAsync({ projectId });
      } finally {
        clearInterval(progressInterval);
      }

      // Server returned successfully → DB write is already complete
      setProgressValue(100);
      setProgressStep("완료");
      setProgressMessage("자막 생성이 완료되었습니다!");
      setSrtContent(result.srtContent ?? "");
      setIsComplete(true);

      // Reset form
      setProjectName("");
      setScript("");
      setFiles([]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
      console.error("[SubtitleGenerator] Error:", error);
      setProgressError(msg);
      setProgressValue(0);
      setProgressStep("오류");
      setProgressMessage(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProgressComplete = () => {
    setShowProgress(false);
    if (!progressError && srtContent) {
      setShowResults(true);
    }
    resetProgress();
  };

  return (
    <>
      <ProgressTracker
        isVisible={showProgress}
        error={progressError}
        progress={progressValue}
        currentStep={progressStep}
        message={progressMessage}
        isComplete={isComplete}
        onComplete={handleProgressComplete}
      />
      <SubtitleResults
        projectName={savedProjectName || "subtitles"}
        srtContent={srtContent}
        isVisible={showResults}
        onClose={() => setShowResults(false)}
      />

      <div className="space-y-6">
        {/* Project Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900 mb-4">프로젝트 정보</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                프로젝트 이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="예: 인터뷰 녹음 2026-04"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                더빙 스크립트 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder={"줄바꿈으로 구분된 스크립트를 입력하세요.\n\n예:\n안녕하세요, 오늘은 AI 자막 생성에 대해 알아보겠습니다.\n먼저 오디오 파일을 업로드해주세요."}
                rows={8}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
              />
              <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                <Info className="w-3 h-3" />
                각 줄이 하나의 자막 항목이 됩니다. AI가 오디오와 자동으로 정렬합니다.
              </p>
            </div>
          </div>
        </div>

        {/* Audio Files */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900 mb-4">오디오 파일</h3>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all"
          >
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-700">클릭하여 오디오 파일 선택</p>
            <p className="text-xs text-slate-500 mt-1">MP3, WAV, M4A, OGG 지원 · 파일당 최대 16MB</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="audio/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-slate-700">{files.length}개 파일 선택됨</p>
              {files.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-bold text-slate-500 w-5 text-center">{f.order + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{f.name}</p>
                      <p className="text-xs text-slate-500">{formatFileSize(f.size)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(f.id)}
                    className="ml-2 p-1.5 hover:bg-slate-200 rounded-lg transition-colors flex-shrink-0"
                  >
                    <X className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
              ))}
              <p className="text-xs text-slate-500">파일은 번호 순서대로 처리됩니다.</p>
            </div>
          )}

          {files.length === 0 && (
            <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-700">자막 생성을 위해 최소 하나의 오디오 파일이 필요합니다.</p>
            </div>
          )}
        </div>

        {/* Submit */}
        <Button
          onClick={handleCreate}
          disabled={isProcessing || !projectName.trim() || !script.trim() || files.length === 0}
          className="w-full"
          size="lg"
        >
          {isProcessing ? "처리 중..." : "자막 생성 시작"}
        </Button>

        {/* How it works */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">작동 방식</h4>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>오디오 파일을 S3에 안전하게 업로드</li>
            <li>Whisper AI로 음성 인식 및 타임스탬프 추출</li>
            <li>LLM이 스크립트 라인과 타임스탬프를 정렬</li>
            <li>완벽하게 동기화된 SRT 자막 파일 다운로드</li>
          </ol>
        </div>
      </div>
    </>
  );
}
