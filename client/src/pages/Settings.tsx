import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, Save, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

export default function Settings() {
  const { isAuthenticated, loading } = useAuth();

  const [claudeApiKey, setClaudeApiKey] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [deepgramApiKey, setDeepgramApiKey] = useState("");
  const [preferredLlm, setPreferredLlm] = useState<"claude" | "gemini">("claude");
  const [preferredTranscriber, setPreferredTranscriber] = useState<"whisper" | "deepgram">("whisper");
  const [showClaude, setShowClaude] = useState(false);
  const [showGemini, setShowGemini] = useState(false);
  const [showDeepgram, setShowDeepgram] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  const getSettingsQuery = trpc.settings.getSettings.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const updateSettingsMutation = trpc.settings.updateSettings.useMutation();

  useEffect(() => {
    if (getSettingsQuery.data) {
      setClaudeApiKey(getSettingsQuery.data.claudeApiKey ?? "");
      setGeminiApiKey(getSettingsQuery.data.geminiApiKey ?? "");
      setDeepgramApiKey(getSettingsQuery.data.deepgramApiKey ?? "");
      setPreferredLlm((getSettingsQuery.data.preferredLlm as "claude" | "gemini") ?? "claude");
      setPreferredTranscriber((getSettingsQuery.data.preferredTranscriber as "whisper" | "deepgram") ?? "whisper");
    }
  }, [getSettingsQuery.data]);

  const handleSave = async () => {
    setSaveStatus("saving");
    try {
      await updateSettingsMutation.mutateAsync({
        claudeApiKey: claudeApiKey.trim() || undefined,
        geminiApiKey: geminiApiKey.trim() || undefined,
        deepgramApiKey: deepgramApiKey.trim() || undefined,
        preferredLlm,
        preferredTranscriber,
      });
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err) {
      console.error("Settings save failed:", err);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 4000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">설정을 보려면 로그인이 필요합니다.</p>
          <a href={getLoginUrl()} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            로그인
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/">
            <button className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">설정</h1>
            <p className="text-sm text-slate-500">API 키 및 선호도를 관리합니다</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Transcriber Selection */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-1">선호 음성인식 서비스</h2>
            <p className="text-sm text-slate-500 mb-4">오디오 파일을 음성인식할 때 사용할 서비스를 선택하세요.</p>
            <div className="grid grid-cols-2 gap-3">
              {(["whisper", "deepgram"] as const).map((transcriber) => (
                <button
                  key={transcriber}
                  onClick={() => setPreferredTranscriber(transcriber)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    preferredTranscriber === transcriber
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-900 capitalize">{transcriber === "whisper" ? "Whisper" : "Deepgram"}</span>
                    {preferredTranscriber === transcriber && (
                      <CheckCircle2 className="w-4 h-4 text-blue-500" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {transcriber === "whisper" ? "OpenAI Whisper" : "Deepgram Nova-2"}
                  </p>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-3">
              * Deepgram을 선택하려면 API 키를 입력해야 합니다. 기본값은 Whisper입니다.
            </p>
          </div>

          {/* LLM Selection */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-1">선호 LLM</h2>
            <p className="text-sm text-slate-500 mb-4">스크립트 정렬에 사용할 AI 모델을 선택하세요.</p>
            <div className="grid grid-cols-2 gap-3">
              {(["claude", "gemini"] as const).map((llm) => (
                <button
                  key={llm}
                  onClick={() => setPreferredLlm(llm)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    preferredLlm === llm
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-900 capitalize">{llm === "claude" ? "Claude" : "Gemini"}</span>
                    {preferredLlm === llm && (
                      <CheckCircle2 className="w-4 h-4 text-blue-500" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {llm === "claude" ? "Anthropic Claude" : "Google Gemini"}
                  </p>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-3">
              * 현재 버전에서는 Manus 내장 LLM(Gemini 2.5 Flash)을 기본으로 사용합니다. API 키를 입력하면 해당 모델로 전환됩니다.
            </p>
          </div>

          {/* Claude API Key */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Claude API 키</h2>
            <p className="text-sm text-slate-500 mb-4">
              Anthropic Claude API 키를 입력하세요.{" "}
              <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                발급받기 →
              </a>
            </p>
            <div className="relative">
              <input
                type={showClaude ? "text" : "password"}
                value={claudeApiKey}
                onChange={(e) => setClaudeApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full px-3 py-2.5 pr-10 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowClaude((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showClaude ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Gemini API Key */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Gemini API 키</h2>
            <p className="text-sm text-slate-500 mb-4">
              Google Gemini API 키를 입력하세요.{" "}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                발급받기 →
              </a>
            </p>
            <div className="relative">
              <input
                type={showGemini ? "text" : "password"}
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="AIza..."
                className="w-full px-3 py-2.5 pr-10 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowGemini((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showGemini ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Deepgram API Key */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Deepgram API 키</h2>
            <p className="text-sm text-slate-500 mb-4">
              Deepgram API 키를 입력하세요.{" "}
              <a href="https://console.deepgram.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                발급받기 →
              </a>
            </p>
            <div className="relative">
              <input
                type={showDeepgram ? "text" : "password"}
                value={deepgramApiKey}
                onChange={(e) => setDeepgramApiKey(e.target.value)}
                placeholder="dg_..."
                className="w-full px-3 py-2.5 pr-10 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowDeepgram((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showDeepgram ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Save */}
          <div className="space-y-3">
            <Button
              onClick={handleSave}
              disabled={saveStatus === "saving" || getSettingsQuery.isLoading}
              className="w-full gap-2"
              size="lg"
            >
              {saveStatus === "saving" ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  설정 저장
                </>
              )}
            </Button>

            {saveStatus === "success" && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                <p className="text-sm text-green-800">설정이 저장되었습니다.</p>
              </div>
            )}
            {saveStatus === "error" && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-800">저장에 실패했습니다. 다시 시도해주세요.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
