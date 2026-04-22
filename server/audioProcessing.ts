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

  // metadata.duration이 0이거나 없으면 단어 타임스탬프에서 직접 계산 (offset 버그 방지)
  const metaDuration = data.metadata?.duration ?? 0;
  const wordsDuration = words.length > 0 ? words[words.length - 1].end : 0;
  const duration = metaDuration > 0 ? metaDuration : wordsDuration;
  return { text: alternative.transcript ?? "", segments, words, duration };
}

export async function transcribeAudioFile(storageKey: string, transcriberSettings?: TranscriberSettings): Promise<TranscriptionResult> {
  // Deepgram API 키가 있으면 Deepgram 사용, 없으면 Whisper 폴백
  if (transcriberSettings?.deepgramApiKey) {
    console.log('[transcribe] Deepgram 사용');
    return transcribeAudioFileWithDeepgram(storageKey, transcriberSettings.deepgramApiKey);
  }
  
  console.log('[transcribe] Deepgram 키 없음 → Whisper 폴백');
  return transcribeAudioFileWithWhisper(storageKey);
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

// ─── 두 문자열 간 단어 겹침 유사도 (0~1) ─────────────────────────────────
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
  // ── 진단 로그: 서버 콘솔에서 확인 가능 ─────────────────────────────────
  console.log('[subtitle] allWords:', allWords?.length ?? 0, '단어 | 스크립트:', scriptLines.length, '줄');
  if (allWords && allWords.length > 0) {
    console.log('[subtitle] 첫 단어:', allWords[0].start.toFixed(2), 's / 마지막 단어:', allWords[allWords.length-1].end.toFixed(2), 's (총 오디오:', totalDuration.toFixed(2), 's)');
  }

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
    // 이전 줄이 사용한 timestamp 구간의 끝 인덱스(exclusive)를 추적합니다.
    // bestTsPtr은 반드시 lastTsEnd 이상이어야 합니다 — 역주행/이중 자막 방지.
    let lastTsEnd = 0;

    for (let li = 0; li < scriptLines.length; li++) {
      const line = scriptLines[li];
      const n = line.split(" ").filter(Boolean).length;
      if (n === 0) continue;

      // ── wordPtr 소진 시: 남은 모든 줄을 남은 오디오 시간에 균등 분배 ──
      if (wordPtr >= allWords.length) {
        const prevEnd = entries.length > 0 ? toSec(entries[entries.length - 1].endTime) : 0;
        // 현재 줄(li)부터 끝까지의 모든 남은 줄 계산
        const remainingLines = scriptLines.slice(li).filter(l => l.split(' ').filter(Boolean).length > 0);
        const remainingTime = Math.max(totalDuration - prevEnd, remainingLines.length * 1.5);
        const slotSize = remainingTime / remainingLines.length;
        let t = prevEnd;
        
        for (let ri = 0; ri < remainingLines.length; ri++) {
          const rLine = remainingLines[ri];
          const startTime = secondsToSrtTime(t);
          const endTime = secondsToSrtTime(Math.min(t + slotSize - 0.05, totalDuration));
          entries.push({ 
            index: entries.length + 1, 
            startTime, 
            endTime, 
            text: rLine 
          });
          t += slotSize;
        }
        console.log(`[subtitle] ✓ wordPtr 소진 (line ${li}) — 남은 ${remainingLines.length}줄을 ${slotSize.toFixed(1)}s 간격으로 분배`);
        break; // 모든 남은 줄이 처리됨
      }

      // 기본 구간: lastTsEnd와 wordPtr 중 더 앞선 위치에서 시작 (역주행 방지)
      const baseStart = Math.max(wordPtr, lastTsEnd);

      // 크래시 가드: baseStart가 배열 끝을 넘어서면 균등 분배로 전환
      if (baseStart >= allWords.length) {
        const prevEnd2 = entries.length > 0 ? toSec(entries[entries.length - 1].endTime) : 0;
        const remLines2 = scriptLines.slice(li).filter(l => l.split(" ").filter(Boolean).length > 0);
        const remTime2 = Math.max(totalDuration - prevEnd2, remLines2.length * 1.5);
        const slot2 = remTime2 / remLines2.length;
        let t2 = prevEnd2;
        
        for (let ri = 0; ri < remLines2.length; ri++) {
          const rLine2 = remLines2[ri];
          const startTime2 = secondsToSrtTime(t2);
          const endTime2 = secondsToSrtTime(Math.min(t2 + slot2 - 0.05, totalDuration));
          entries.push({ 
            index: entries.length + 1, 
            startTime: startTime2, 
            endTime: endTime2, 
            text: rLine2 
          });
          t2 += slot2;
        }
        console.log(`[subtitle] ✓ baseStart 경계 도달 (line ${li}) — 나머지 ${remLines2.length}줄 균등 분배`);
        break;
      }

      const baseSliceEnd = Math.min(baseStart + n, allWords.length);
      let baseScore = wordOverlapScore(line, allWords.slice(baseStart, baseSliceEnd).map(w => w.word).join(" "));
      let bestTsPtr = baseStart; // offset 대신 절대 인덱스로 추적

      // ±DRIFT_SEARCH 범위에서 유사도가 더 높은 위치의 타임스탬프를 탐색.
      // s < lastTsEnd 인 경우는 건너뜀 → 이전 줄 timestamp 구간과 절대 겹치지 않음.
      // wordPtr은 이 탐색과 무관하게 항상 정확히 n씩 전진 → 소진/후퇴 구조적으로 불가.
      for (let offset = -DRIFT_SEARCH; offset <= DRIFT_SEARCH; offset++) {
        if (offset === 0) continue;
        const s = wordPtr + offset;
        const e = s + n;
        if (s < lastTsEnd || s < 0 || e > allWords.length) continue; // lastTsEnd 미만 차단
        const sc = wordOverlapScore(line, allWords.slice(s, e).map(w => w.word).join(" "));
        if (sc > baseScore + DRIFT_THRESHOLD) {
          baseScore = sc;
          bestTsPtr = s;
        }
      }

      // 타임스탬프는 bestTsPtr 위치에서 읽고, wordPtr은 항상 정확히 n 전진
      const segStart = allWords[bestTsPtr].start;
      const segEndIdx = Math.min(bestTsPtr + n - 1, allWords.length - 1);
      const segEnd = allWords[segEndIdx].end;

      entries.push({ 
        index: entries.length + 1, 
        startTime: secondsToSrtTime(segStart), 
        endTime: secondsToSrtTime(segEnd), 
        text: line 
      });
      lastTsEnd = bestTsPtr + n; // 다음 줄은 이 위치 이후에서만 timestamp 탐색
      wordPtr += n; // 항상 정확히 n 전진
    }

    // 단조증가 최종 보장 + 최소 duration 확보
    for (let k = 1; k < entries.length; k++) {
      const prevEnd = toSec(entries[k - 1].endTime);
      const currStart = toSec(entries[k].startTime);
      const currEnd = toSec(entries[k].endTime);
      
      // 겹침 방지: 현재 시작 < 이전 끝 → 현재 시작을 이전 끝으로 조정
      if (currStart < prevEnd) {
        entries[k].startTime = entries[k - 1].endTime;
      }
      
      // 최소 duration 확보: 끝 <= 시작 → 끝을 시작 + 0.5초로 조정
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
