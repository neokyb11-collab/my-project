import { Download, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SubtitleResultsProps {
  projectName: string;
  srtContent: string;
  isVisible: boolean;
  onClose: () => void;
}

export function SubtitleResults({ projectName, srtContent, isVisible, onClose }: SubtitleResultsProps) {
  if (!isVisible) return null;

  const handleDownload = () => {
    const blob = new Blob([srtContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName.replace(/[^a-zA-Z0-9가-힣_-]/g, "_")}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const lineCount = srtContent.split("\n").filter((l) => l.match(/^\d+$/)).length;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">자막 생성 완료</h2>
              <p className="text-sm text-slate-500">{lineCount}개 자막 항목</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* SRT Preview */}
        <div className="flex-1 overflow-auto px-6 py-4">
          <pre className="text-xs font-mono text-slate-700 bg-slate-50 rounded-xl p-4 whitespace-pre-wrap border border-slate-200 leading-relaxed">
            {srtContent}
          </pre>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex gap-3">
          <Button onClick={handleDownload} className="flex-1 gap-2" size="lg">
            <Download className="w-4 h-4" />
            SRT 파일 다운로드
          </Button>
          <Button variant="outline" onClick={onClose} size="lg">
            닫기
          </Button>
        </div>
      </div>
    </div>
  );
}
