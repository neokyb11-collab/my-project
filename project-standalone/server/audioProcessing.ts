import { invokeLLM } from "./_core/llm";
import { transcribeAudio, type TranscriptionResponse, type TranscriptionError } from "./_core/voiceTranscription";
import { storageGetSignedUrl } from "./storage";

export interface TranscriptionWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  words: TranscriptionWord[];
}

export interface TranscriptionResult {
  text: string;
  segments: TranscriptionSegment[];
  words: TranscriptionWord[]; // 단어 레벨 타임스탬프 (Deepgram 직접 매핑에 활용)
  duration: number;
}

export interface SrtEntry {
  index: number;
  startTime: string;
  endTime: string;
  text: string;
}

export interface LlmSettings {
  preferredLlm?: "claude" | "gemini" | null;
  claudeApiKey?: string | null;
  geminiApiKey?: string | null;
}

export interface TranscriberSettings {
  preferredTranscriber?: "deepgram";
  deepgramApiKey?: string | null;
}

export async function transcribeAudioFileWithWhisper(storageKey: string): Promise<TranscriptionResult> {
  const signedUrl = await storageGetSignedUrl(storageKey);
  const result = await transcribeAudio({ audioUrl: signedUrl });
  if ("error" in result) {
    const err = result as TranscriptionError;
    throw new Error(`Whisper transcription failed: ${err.error}${err.details ? ` – ${err.details}` : ""}`);
  }
  const response = result as TranscriptionResponse;
  const segments: TranscriptionSegment[] = [];
  if (response.segments && Array.isArray(response.segments)) {
    for (const segment of response.segments) {
      segments.push({
        start: segment.start,
        end: segment.end,
        text: segment.text ?? "",
        words: [{ word: segment.text ?? "", start: segment.start, end: segment.end, confidence: 1.0 - (segment.no_speech_prob ?? 0) }],
      });
    }
  }
  return { text: response.text ?? "", segments, words: [], duration: response.duration ?? 0 };
}

export async function transcribeAudioFileWithDeepgram(storageKey: string, deepgramApiKey: string): Promise<TranscriptionResult> {
  const signedUrl = await storageGetSignedUrl(storageKey);
  // utterances=true: 발화 단위 세그먼트 반환, utt_split=0.8: 0.8초 침묵으로 발화 구분
  const response = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-2&punctuate=true&utterances=true&utt_split=0.8",
    {
      method: "POST",
      headers: { Authorization: `Token ${deepgramApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: signedUrl }),
    }
  );
  if (!response.ok) {
    const err = await response.text().catch(() => "Unknown error");
    throw new Error(`Deepgram transcription failed (${response.status}): ${err}`);
  }
  const data = (await response.json()) as any;
  if (!data.results?.channels?.[0]?.alternatives?.[0]) throw new Error("Deepgram returned unexpected response format");
  const alternative = data.results.channels[0].alternatives[0];

  // 단어 레벨 타임스탬프를 전부 보존합니다.
  const words: TranscriptionWord[] = [];
  if (alternative.words && Array.isArray(alternative.words)) {
    for (const w of alternative.words) {
      words.push({
        word: w.punctuated_word || w.word,
        start: w.start,
        end: w.end,
        confidence: w.confidence ?? 0.9,
      });
    }
  }

  // utterances(발화 단위)를 세그먼트로 사용합니다 — 문장 경계가 정확합니다.
  const segments: TranscriptionSegment[] = [];
  if (data.results?.utterances && Array.isArray(data.results.utterances) && data.results.utterances.length > 0) {
    for (const utt of data.results.utterances) {
      const uttWords = words.filter(w => w.start >= utt.start - 0.01 && w.end <= utt.end + 0.01);
      segments.push({ start: utt.start, end: utt.end, text: utt.transcript ?? "", words: uttWords });
    }
  } else {
    // utterances 없으면 단어 1개 = 세그먼트 1개로 저장 (직접 매핑 정밀도 최대화)
    for (const w of words) {
      segments.push({ start: w.start, end: w.end, text: w.word, words: [w] });
    }
  }

  return { text: alternative.transcript ?? "", segments, words, duration: data.metadata?.duration ?? 0 };
}

export async function transcribeAudioFile(storageKey: string, transcriberSettings?: TranscriberSettings): Promise<TranscriptionResult> {
  if (!transcriberSettings?.deepgramApiKey) {
    throw new Error("Deepgram API 키가 설정되지 않았습니다. 설정 페이지에서 Deepgram API 키를 입력해주세요.");
  }
  return transcribeAudioFileWithDeepgram(storageKey, transcriberSettings.deepgramApiKey);
}

export function mergeTranscriptions(transcriptions: TranscriptionResult[]): { merged: TranscriptionSegment[]; mergedWords: TranscriptionWord[]; totalDuration: number } {
  const merged: TranscriptionSegment[] = [];
  const mergedWords: TranscriptionWord[] = [];
  let currentOffset = 0;
  let totalDuration = 0;
  for (const transcription of transcriptions) {
    const offsetSegments = transcription.segments.map((seg) => ({
      ...seg,
      start: seg.start + currentOffset,
      end: seg.end + currentOffset,
      words: seg.words.map(w => ({ ...w, start: w.start + currentOffset, end: w.end + currentOffset })),
    }));
    merged.push(...offsetSegments);
    const offsetWords = (transcription.words ?? []).map(w => ({ ...w, start: w.start + currentOffset, end: w.end + currentOffset }));
    mergedWords.push(...offsetWords);
    currentOffset += transcription.duration;
    totalDuration += transcription.duration;
  }
  return { merged, mergedWords, totalDuration };
}

export function secondsToSrtTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return [String(hours).padStart(2, "0"), String(minutes).padStart(2, "0"), String(secs).padStart(2, "0")].join(":") + "," + String(ms).padStart(3, "0");
}

export function generateSrtContent(entries: SrtEntry[]): string {
  return entries.map((e) => `${e.index}\n${e.startTime} --> ${e.endTime}\n${e.text}\n`).join("\n");
}

// ─── 텍스트 정규화 ────────────────────────────────────────────────────────────
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s\uAC00-\uD7A3]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── 두 문자열 간 단어 겹침 유사도 (0~1) ─────────────────────────────────────
function wordOverlapScore(a: string, b: string): number {
  const wa = normalizeText(a).split(" ").filter(Boolean);
  const wb = new Set(normalizeText(b).split(" ").filter(Boolean));
  if (wa.length === 0 || wb.size === 0) return 0;
  let common = 0;
  wa.forEach(w => { if (wb.has(w)) common++; });
  return common / Math.max(wa.length, wb.size);
}

/**
 * Deepgram 단어 레벨 타임스탬프를 사용해 스크립트 줄과 직접 매핑합니다.
 *
 * 핵심 전략:
 * - allWords(Deepgram 단어 배열)를 순서대로 스캔하며 각 스크립트 줄의 단어들을 찾습니다.
 * - 타임스탬프는 100% Deepgram 원본값만 사용합니다. LLM이 만들지 않습니다.
 * - allWords가 없을 때(Whisper 등)만 세그먼트 유사도 매핑 + LLM 보조로 폴백합니다.
 */
export async function generateSubtitlesWithLLM(
  script: string,
  transcriptionSegments: TranscriptionSegment[],
  llmSettings?: LlmSettings,
  allWords?: TranscriptionWord[]
): Promise<SrtEntry[]> {
  const scriptLines = script.split("\n").filter(line => line.trim() !== "");
  if (scriptLines.length === 0) throw new Error("Script has no lines.");
  if (transcriptionSegments.length === 0) throw new Error("No transcription segments available.");

  const totalDuration = transcriptionSegments[transcriptionSegments.length - 1].end;

  // ══════════════════════════════════════════════════════════════════════════
  // 경로 A: Deepgram 단어 레벨 직접 매핑 (allWords 있을 때)
  // ══════════════════════════════════════════════════════════════════════════
  if (allWords && allWords.length > 0) {
    // ── 누적 단어 포인터 방식 + 드리프트 보정 ──────────────────────────────
    // Deepgram은 스크립트 단어와 순서가 같으므로, 각 스크립트 줄의 단어 수(n)만큼
    // 배열에서 순서대로 슬라이스해 타임스탬프를 읽습니다.
    // Deepgram이 필러(um/uh)를 추가하거나 단어를 다르게 받아쓰는 경우를 대비해
    // ±DRIFT_SEARCH 범위에서 유사도 비교로 포인터를 미세 보정합니다.
    const DRIFT_SEARCH = 12; // 드리프트 보정 탐색 범위 (단어 수)
    const DRIFT_THRESHOLD = 0.05; // 이 이상 유사도가 높아질 때만 포인터 보정

    const toSec = (t: string) => {
      const [hms, ms] = t.split(",");
      const [h, m, s] = hms.split(":").map(Number);
      return h * 3600 + m * 60 + s + Number(ms) / 1000;
    };

    const entries: SrtEntry[] = [];
    let wordPtr = 0;

    for (let li = 0; li < scriptLines.length; li++) {
      const line = scriptLines[li];
      const n = line.split(" ").filter(Boolean).length;
      if (n === 0) continue;

      if (wordPtr >= allWords.length) {
        // wordPtr 소진 — 직전 끝 시간 기준으로 2초씩 배정
        const prevEnd = entries.length > 0 ? toSec(entries[entries.length - 1].endTime) : totalDuration;
        entries.push({ index: li + 1, startTime: secondsToSrtTime(prevEnd), endTime: secondsToSrtTime(Math.min(prevEnd + 2.0, totalDuration)), text: line });
        continue;
      }

      // 기본 구간: [wordPtr, wordPtr+n)
      const baseEnd = Math.min(wordPtr + n, allWords.length);
      let baseScore = wordOverlapScore(line, allWords.slice(wordPtr, baseEnd).map(w => w.word).join(" "));
      let bestTsOffset = 0; // 타임스탬프 결정에만 사용 — wordPtr 전진에 영향 없음

      // ±DRIFT_SEARCH 범위에서 유사도가 더 높은 위치의 타임스탬프를 탐색
      // wordPtr은 이 offset과 무관하게 항상 정확히 n씩 전진 → 소진/후퇴 없음
      for (let offset = -Math.min(DRIFT_SEARCH, wordPtr); offset <= DRIFT_SEARCH; offset++) {
        if (offset === 0) continue;
        const s = wordPtr + offset;
        const e = s + n;
        if (s < 0 || e > allWords.length) continue;
        const sc = wordOverlapScore(line, allWords.slice(s, e).map(w => w.word).join(" "));
        if (sc > baseScore + DRIFT_THRESHOLD) {
          baseScore = sc;
          bestTsOffset = offset;
        }
      }

      // 타임스탬프는 bestTsOffset 위치에서 읽고
      // wordPtr은 항상 정확히 n 전진
      const tsPtr = wordPtr + bestTsOffset;
      const segStart = allWords[tsPtr].start;
      const segEndIdx = Math.min(tsPtr + n - 1, allWords.length - 1);
      const segEnd = allWords[segEndIdx].end;

      entries.push({ index: li + 1, startTime: secondsToSrtTime(segStart), endTime: secondsToSrtTime(segEnd), text: line });
      wordPtr += n; // 항상 정확히 n 전진
    }

    // 단조증가 최종 보장
    for (let k = 1; k < entries.length; k++) {
      if (toSec(entries[k].startTime) < toSec(entries[k - 1].endTime)) {
        entries[k].startTime = entries[k - 1].endTime;
      }
      if (toSec(entries[k].endTime) <= toSec(entries[k].startTime)) {
        entries[k].endTime = secondsToSrtTime(toSec(entries[k].startTime) + 0.5);
      }
    }

    return entries.map((e, i) => ({ ...e, index: i + 1 }));
  }

  // allWords가 없으면 Deepgram 단어 레벨 데이터가 없다는 뜻 → 에러
  throw new Error("Deepgram 단어 레벨 타임스탬프가 없습니다. Deepgram API 키가 올바른지 확인해주세요.");
}

async function callClaudeApi(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 8192,
      system: "You are a subtitle synchronization expert. Return only valid JSON.",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) {
    const err = await response.text().catch(() => "");
    throw new Error(`Claude API error (${response.status}): ${err}`);
  }
  const data = await response.json() as any;
  return data.content?.[0]?.text ?? "";
}

async function callGeminiApi(apiKey: string, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: "You are a subtitle synchronization expert. Return only valid JSON.\n\n" + prompt }] }],
      generationConfig: { maxOutputTokens: 8192 },
    }),
  });
  if (!response.ok) {
    const err = await response.text().catch(() => "");
    throw new Error(`Gemini API error (${response.status}): ${err}`);
  }
  const data = await response.json() as any;
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}
