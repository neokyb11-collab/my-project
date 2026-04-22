import {
  getSubtitleProject,
  getProjectAudioFiles,
  updateAudioFileTranscription,
  updateSubtitleProjectStatus,
  getUserSettings,
} from "./db";
import {
  transcribeAudioFile,
  generateSubtitlesWithLLM,
  mergeTranscriptions,
  type TranscriptionWord,
  generateSrtContent,
  type TranscriptionResult,
  type LlmSettings,
  type TranscriberSettings,
} from "./audioProcessing";

export interface SubtitleGenerationProgress {
  projectId: string;
  status: "idle" | "uploading" | "transcribing" | "aligning" | "generating" | "completed" | "error";
  progress: number;
  currentStep: string;
  message: string;
  error?: string;
}

/**
 * Orchestrate the full subtitle generation workflow:
 *   1. Load user LLM settings (Claude/Gemini API key + preferred provider)
 *   2. Load user transcriber settings (Deepgram + API key)
 *   3. Transcribe each audio file (storageKey → signed URL → selected transcriber)
 *   4. Merge transcriptions with time offsets
 *   5. Align script lines with LLM (uses user's preferred provider if configured)
 *   6. Generate SRT content
 *   7. Persist results to DB
 *
 * All mock/fallback data paths have been removed.
 * If a file has no storageKey, an error is thrown immediately.
 */
export async function generateSubtitlesForProject(
  projectId: string,
  userId: number,
  onProgress?: (progress: SubtitleGenerationProgress) => void
): Promise<{ success: boolean; srtContent?: string; error?: string }> {
  try {
    // ── Load project ──────────────────────────────────────────────────────────
    const project = await getSubtitleProject(projectId, userId);
    if (!project) throw new Error("Project not found");
    if (!project.script?.trim()) throw new Error("Project has no script");

    // ── Load user settings ────────────────────────────────────────────────────
    const userSettings = await getUserSettings(userId);
    
    const llmSettings: LlmSettings = {
      preferredLlm: userSettings?.preferredLlm ?? "gemini",
      claudeApiKey: userSettings?.claudeApiKey ?? null,
      geminiApiKey: userSettings?.geminiApiKey ?? null,
    };

    const transcriberSettings: TranscriberSettings = {
      preferredTranscriber: "deepgram",
      deepgramApiKey: userSettings?.deepgramApiKey ?? null,
    };

    // ── Load audio files ──────────────────────────────────────────────────────
    const audioFiles = await getProjectAudioFiles(projectId, userId);
    if (audioFiles.length === 0) throw new Error("No audio files found for this project");

    // Validate all files have storage keys BEFORE starting any transcription
    for (const file of audioFiles) {
      if (!file.storageKey) {
        throw new Error(
          `Audio file "${file.fileName}" has no storage key. Upload may have failed.`
        );
      }
    }

    // ── Step 1: Transcribe ────────────────────────────────────────────────────
    const transcriberLabel = transcriberSettings.preferredTranscriber === "deepgram" && transcriberSettings.deepgramApiKey
      ? "Deepgram"
      : "Deepgram";

    onProgress?.({
      projectId,
      status: "transcribing",
      progress: 10,
      currentStep: `${transcriberLabel}로 음성 인식 중`,
      message: `${audioFiles.length}개 파일 처리 중...`,
    });

    const transcriptions: TranscriptionResult[] = [];

    for (let i = 0; i < audioFiles.length; i++) {
      const file = audioFiles[i];

      // storageKey is guaranteed non-null here (validated above)
      const transcription = await transcribeAudioFile(
        file.storageKey as string,
        transcriberSettings
      );
      transcriptions.push(transcription);

      await updateAudioFileTranscription(
        file.id,
        JSON.stringify(transcription.segments),
        transcription.duration
      );

      onProgress?.({
        projectId,
        status: "transcribing",
        progress: 10 + ((i + 1) / audioFiles.length) * 25,
        currentStep: `음성 인식 완료 ${i + 1}/${audioFiles.length}`,
        message: `${file.fileName} 처리 완료 (${transcriberLabel})`,
      });
    }

    // ── Step 2: Merge ─────────────────────────────────────────────────────────
    onProgress?.({
      projectId,
      status: "aligning",
      progress: 40,
      currentStep: "타임스탬프 병합 중",
      message: "여러 파일의 타임스탬프를 합산하는 중...",
    });

    const { merged: mergedSegments, mergedWords, totalDuration } = mergeTranscriptions(transcriptions);

    // ── Step 3: LLM alignment ─────────────────────────────────────────────────
    const llmLabel = llmSettings.preferredLlm === "claude" && llmSettings.claudeApiKey
      ? "Claude"
      : llmSettings.preferredLlm === "gemini" && llmSettings.geminiApiKey
      ? "Gemini"
      : "내장 AI";

    onProgress?.({
      projectId,
      status: "generating",
      progress: 55,
      currentStep: "스크립트 정렬 중",
      message: `${llmLabel}가 스크립트와 오디오를 정렬하는 중...`,
    });

    const srtEntries = await generateSubtitlesWithLLM(project.script, mergedSegments, llmSettings, mergedWords);

    // ── Step 4: Generate SRT ──────────────────────────────────────────────────
    onProgress?.({
      projectId,
      status: "generating",
      progress: 80,
      currentStep: "SRT 파일 생성 중",
      message: "자막 파일을 생성하는 중...",
    });

    const srtContent = generateSrtContent(srtEntries);

    // ── Step 5: Persist to DB ─────────────────────────────────────────────────
    onProgress?.({
      projectId,
      status: "completed",
      progress: 95,
      currentStep: "저장 중",
      message: "결과를 저장하는 중...",
    });

    await updateSubtitleProjectStatus(projectId, "completed", srtContent, totalDuration);

    onProgress?.({
      projectId,
      status: "completed",
      progress: 100,
      currentStep: "완료",
      message: "자막 생성이 완료되었습니다!",
    });

    return { success: true, srtContent };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[subtitleService] Subtitle generation failed:", error);

    // Mark project as failed in DB (best-effort)
    try {
      await updateSubtitleProjectStatus(projectId, "failed");
    } catch (_) {
      // ignore secondary error
    }

    onProgress?.({
      projectId,
      status: "error",
      progress: 0,
      currentStep: "오류",
      message: errorMessage,
      error: errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}
