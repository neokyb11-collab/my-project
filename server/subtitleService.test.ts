import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Mock dependencies ────────────────────────────────────────────────────────

vi.mock("./db", () => ({
  getSubtitleProject: vi.fn(),
  getProjectAudioFiles: vi.fn(),
  updateAudioFileTranscription: vi.fn(),
  updateSubtitleProjectStatus: vi.fn(),
  getUserSettings: vi.fn(),
}));

vi.mock("./audioProcessing", () => ({
  transcribeAudioFile: vi.fn(),
  generateSubtitlesWithLLM: vi.fn(),
  mergeTranscriptions: vi.fn(),
  generateSrtContent: vi.fn(),
}));

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
  generateSrtContent,
} from "./audioProcessing";
import { generateSubtitlesForProject } from "./subtitleService";

const mockProject = {
  id: "proj_test_123",
  userId: 1,
  projectName: "Test Project",
  script: "안녕하세요\n오늘은 테스트입니다",
  status: "draft",
};

const mockAudioFile = {
  id: 1,
  userId: 1,
  projectId: "proj_test_123",
  fileName: "test.mp3",
  storageKey: "projects/proj_test_123/audio/0_test.mp3",
  fileOrder: 0,
};

const mockTranscription = {
  text: "안녕하세요 오늘은 테스트입니다",
  segments: [
    { start: 0, end: 2, text: "안녕하세요", words: [] },
    { start: 2, end: 5, text: "오늘은 테스트입니다", words: [] },
  ],
  duration: 5,
};

const mockSrtEntries = [
  { index: 1, startTime: "00:00:00,000", endTime: "00:00:02,000", text: "안녕하세요" },
  { index: 2, startTime: "00:00:02,000", endTime: "00:00:05,000", text: "오늘은 테스트입니다" },
];

const mockSrtContent = `1\n00:00:00,000 --> 00:00:02,000\n안녕하세요\n\n2\n00:00:02,000 --> 00:00:05,000\n오늘은 테스트입니다\n`;

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no user settings (falls back to built-in LLM)
  vi.mocked(getUserSettings).mockResolvedValue(null);
});

describe("generateSubtitlesForProject", () => {
  it("성공 케이스: 전체 파이프라인이 올바른 순서로 실행된다", async () => {
    vi.mocked(getSubtitleProject).mockResolvedValue(mockProject);
    vi.mocked(getProjectAudioFiles).mockResolvedValue([mockAudioFile]);
    vi.mocked(getUserSettings).mockResolvedValue(null); // 기본 설정 사용
    vi.mocked(transcribeAudioFile).mockResolvedValue(mockTranscription);
    vi.mocked(updateAudioFileTranscription).mockResolvedValue(undefined);
    vi.mocked(mergeTranscriptions).mockReturnValue({
      merged: mockTranscription.segments,
      totalDuration: 5,
    });
    vi.mocked(generateSubtitlesWithLLM).mockResolvedValue(mockSrtEntries);
    vi.mocked(generateSrtContent).mockReturnValue(mockSrtContent);
    vi.mocked(updateSubtitleProjectStatus).mockResolvedValue(undefined);

    const result = await generateSubtitlesForProject("proj_test_123", 1);

    expect(result.success).toBe(true);
    expect(result.srtContent).toBe(mockSrtContent);

    // storageKey가 transcribeAudioFile에 전달되었는지 확인 (transcriberSettings와 함께)
    expect(transcribeAudioFile).toHaveBeenCalledWith(
      mockAudioFile.storageKey,
      expect.any(Object) // transcriberSettings
    );

    // DB 저장이 완료된 후 결과 반환
    expect(updateSubtitleProjectStatus).toHaveBeenCalledWith(
      "proj_test_123",
      "completed",
      mockSrtContent,
      5
    );
  });

  it("storageKey가 없는 파일이 있으면 에러를 반환한다 (mock 데이터 fallback 없음)", async () => {
    vi.mocked(getSubtitleProject).mockResolvedValue(mockProject);
    vi.mocked(getProjectAudioFiles).mockResolvedValue([
      { ...mockAudioFile, storageKey: null },
    ]);

    const result = await generateSubtitlesForProject("proj_test_123", 1);

    expect(result.success).toBe(false);
    expect(result.error).toContain("storage key");

    // transcribeAudioFile은 절대 호출되지 않아야 함
    expect(transcribeAudioFile).not.toHaveBeenCalled();
  });

  it("프로젝트가 없으면 에러를 반환한다", async () => {
    vi.mocked(getSubtitleProject).mockResolvedValue(null);

    const result = await generateSubtitlesForProject("nonexistent", 1);

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("스크립트가 없으면 에러를 반환한다", async () => {
    vi.mocked(getSubtitleProject).mockResolvedValue({ ...mockProject, script: "" });

    const result = await generateSubtitlesForProject("proj_test_123", 1);

    expect(result.success).toBe(false);
    expect(result.error).toContain("script");
  });

  it("오디오 파일이 없으면 에러를 반환한다", async () => {
    vi.mocked(getSubtitleProject).mockResolvedValue(mockProject);
    vi.mocked(getProjectAudioFiles).mockResolvedValue([]);

    const result = await generateSubtitlesForProject("proj_test_123", 1);

    expect(result.success).toBe(false);
    expect(result.error).toContain("audio");
  });

  it("음성 인식 실패 시 에러를 반환하고 프로젝트를 failed로 업데이트한다", async () => {
    vi.mocked(getSubtitleProject).mockResolvedValue(mockProject);
    vi.mocked(getProjectAudioFiles).mockResolvedValue([mockAudioFile]);
    vi.mocked(transcribeAudioFile).mockRejectedValue(new Error("Whisper API error"));
    vi.mocked(updateSubtitleProjectStatus).mockResolvedValue(undefined);

    const result = await generateSubtitlesForProject("proj_test_123", 1);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Whisper API error");
    expect(updateSubtitleProjectStatus).toHaveBeenCalledWith("proj_test_123", "failed");
  });

  it("LLM 정렬 실패 시 에러를 반환한다", async () => {
    vi.mocked(getSubtitleProject).mockResolvedValue(mockProject);
    vi.mocked(getProjectAudioFiles).mockResolvedValue([mockAudioFile]);
    vi.mocked(transcribeAudioFile).mockResolvedValue(mockTranscription);
    vi.mocked(updateAudioFileTranscription).mockResolvedValue(undefined);
    vi.mocked(mergeTranscriptions).mockReturnValue({
      merged: mockTranscription.segments,
      totalDuration: 5,
    });
    vi.mocked(generateSubtitlesWithLLM).mockRejectedValue(new Error("LLM timeout"));
    vi.mocked(updateSubtitleProjectStatus).mockResolvedValue(undefined);

    const result = await generateSubtitlesForProject("proj_test_123", 1);

    expect(result.success).toBe(false);
    expect(result.error).toContain("LLM timeout");
  });

  it("onProgress 콜백이 올바른 순서로 호출된다", async () => {
    vi.mocked(getSubtitleProject).mockResolvedValue(mockProject);
    vi.mocked(getProjectAudioFiles).mockResolvedValue([mockAudioFile]);
    vi.mocked(transcribeAudioFile).mockResolvedValue(mockTranscription);
    vi.mocked(updateAudioFileTranscription).mockResolvedValue(undefined);
    vi.mocked(mergeTranscriptions).mockReturnValue({
      merged: mockTranscription.segments,
      totalDuration: 5,
    });
    vi.mocked(generateSubtitlesWithLLM).mockResolvedValue(mockSrtEntries);
    vi.mocked(generateSrtContent).mockReturnValue(mockSrtContent);
    vi.mocked(updateSubtitleProjectStatus).mockResolvedValue(undefined);

    const progressCalls: string[] = [];
    await generateSubtitlesForProject("proj_test_123", 1, (p) => {
      progressCalls.push(p.status);
    });

    expect(progressCalls).toContain("transcribing");
    expect(progressCalls).toContain("generating");
    // 마지막 상태는 completed여야 함
    expect(progressCalls[progressCalls.length - 1]).toBe("completed");
  });
});
