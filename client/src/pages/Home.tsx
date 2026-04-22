import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2, Music2, Zap, Layers, Settings } from "lucide-react";
import { getLoginUrl } from "@/const";
import { SubtitleGenerator } from "@/components/SubtitleGenerator";
import { Link } from "wouter";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

return <DashboardPage user={user} />;
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
      {/* Nav */}
      <nav className="border-b border-white/10 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-sm">PS</span>
            </div>
            <span className="font-bold text-white text-lg">Perfect Sync</span>
          </div>
          <a
            href={getLoginUrl()}
            className="px-5 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg transition-colors text-sm font-medium shadow-lg"
          >
            로그인
          </a>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-4 py-28 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-500/20 border border-blue-400/30 rounded-full text-blue-300 text-sm font-medium mb-8">
          <Zap className="w-3.5 h-3.5" />
          AI 기반 자막 자동 생성
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold mb-6 leading-tight tracking-tight">
          완벽한 자막 동기화
          <br />
          <span className="text-blue-400">Perfect Sync</span>
        </h1>
        <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
          오디오를 업로드하고 더빙 스크립트를 입력하면, Whisper AI와 LLM이 자동으로 타임스탬프를 정렬하여 SRT 자막 파일을 생성합니다.
        </p>
        <a
          href={getLoginUrl()}
          className="inline-block px-10 py-4 bg-blue-500 hover:bg-blue-400 text-white rounded-xl font-semibold text-lg shadow-xl hover:shadow-blue-500/25 transition-all"
        >
          무료로 시작하기
        </a>
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-4 pb-24 grid grid-cols-1 md:grid-cols-3 gap-6">
        <FeatureCard
          icon={<Zap className="w-6 h-6 text-blue-400" />}
          title="Whisper 음성 인식"
          description="Manus 내장 Whisper API로 정확한 타임스탬프를 포함한 음성 인식을 수행합니다."
        />
        <FeatureCard
          icon={<Music2 className="w-6 h-6 text-purple-400" />}
          title="LLM 스크립트 정렬"
          description="Claude 또는 Gemini가 더빙 스크립트 라인을 오디오 타임스탬프와 정밀하게 정렬합니다."
        />
        <FeatureCard
          icon={<Layers className="w-6 h-6 text-green-400" />}
          title="다중 파일 지원"
          description="여러 오디오 파일을 순서대로 처리하고 자동으로 시간 오프셋을 계산합니다."
        />
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 py-8 text-center text-slate-500 text-sm">
        Perfect Sync © 2026
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors">
      <div className="mb-3">{icon}</div>
      <h3 className="font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function DashboardPage({ user }: { user: any }) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Nav */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">PS</span>
            </div>
            <span className="font-bold text-slate-900">Perfect Sync</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/settings">
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
                <Settings className="w-4 h-4" />
                설정
              </button>
            </Link>
            <div className="text-sm text-slate-500">
              <span className="font-medium text-slate-900">{user?.name ?? "사용자"}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">새 프로젝트</h1>
          <p className="text-sm text-slate-500 mt-1">오디오 파일과 스크립트를 업로드하여 SRT 자막을 자동 생성하세요.</p>
        </div>
        <SubtitleGenerator />
      </main>
    </div>
  );
}
