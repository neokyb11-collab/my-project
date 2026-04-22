/**
 * audioProcessing.ts 점검 시뮬레이션
 * 
 * 테스트 시나리오:
 * 1. Deepgram 단어 배열 정상 케이스
 * 2. wordPtr 소진 케이스 (뒷부분 균등 분배)
 * 3. baseStart 경계 도달 케이스
 * 4. 싱크 정확도 (단조증가 보장)
 */

// ─── 헬퍼 함수 ──────────────────────────────────────────────────────────────

function secondsToSrtTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return [String(hours).padStart(2, "0"), String(minutes).padStart(2, "0"), String(secs).padStart(2, "0")].join(":") + "," + String(ms).padStart(3, "0");
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s\uAC00-\uD7A3]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordOverlapScore(a, b) {
  const wa = normalizeText(a).split(" ").filter(Boolean);
  const wb = new Set(normalizeText(b).split(" ").filter(Boolean));
  if (wa.length === 0 || wb.size === 0) return 0;
  let common = 0;
  wa.forEach(w => { if (wb.has(w)) common++; });
  return common / Math.max(wa.length, wb.size);
}

function toSec(t) {
  const [hms, ms] = t.split(",");
  const [h, m, s] = hms.split(":").map(Number);
  return h * 3600 + m * 60 + s + Number(ms) / 1000;
}

// ─── 테스트 시나리오 ────────────────────────────────────────────────────────

console.log("═══════════════════════════════════════════════════════════════");
console.log("audioProcessing.ts 점검 시뮬레이션");
console.log("═══════════════════════════════════════════════════════════════\n");

// 테스트 1: Deepgram 단어 배열 정상 케이스
console.log("【테스트 1】Deepgram 단어 배열 정상 케이스");
console.log("─────────────────────────────────────────────────────────────");

const script1 = "Hello world\nHow are you\nI am fine";
const allWords1 = [
  { word: "Hello", start: 0.0, end: 0.5 },
  { word: "world", start: 0.5, end: 1.0 },
  { word: "How", start: 1.5, end: 2.0 },
  { word: "are", start: 2.0, end: 2.5 },
  { word: "you", start: 2.5, end: 3.0 },
  { word: "I", start: 3.5, end: 4.0 },
  { word: "am", start: 4.0, end: 4.5 },
  { word: "fine", start: 4.5, end: 5.0 },
];
const totalDuration1 = 5.0;

const scriptLines1 = script1.split("\n").filter(l => l.trim());
console.log(`✓ 스크립트 줄 수: ${scriptLines1.length}`);
console.log(`✓ Deepgram 단어 수: ${allWords1.length}`);
console.log(`✓ 총 오디오 길이: ${totalDuration1}s`);

// 시뮬레이션: 단어 포인터 진행
let wordPtr = 0;
let lastTsEnd = 0;
const entries1 = [];

for (let li = 0; li < scriptLines1.length; li++) {
  const line = scriptLines1[li];
  const n = line.split(" ").filter(Boolean).length;
  console.log(`\n  줄 ${li + 1}: "${line}" (단어 수: ${n})`);
  
  if (wordPtr >= allWords1.length) {
    console.log(`  ⚠️ wordPtr 소진 (${wordPtr} >= ${allWords1.length})`);
    break;
  }
  
  const baseStart = Math.max(wordPtr, lastTsEnd);
  console.log(`  wordPtr=${wordPtr}, lastTsEnd=${lastTsEnd}, baseStart=${baseStart}`);
  
  if (baseStart >= allWords1.length) {
    console.log(`  ⚠️ baseStart 경계 도달`);
    break;
  }
  
  const baseSliceEnd = Math.min(baseStart + n, allWords1.length);
  const segStart = allWords1[baseStart].start;
  const segEndIdx = Math.min(baseStart + n - 1, allWords1.length - 1);
  const segEnd = allWords1[segEndIdx].end;
  
  const startTime = secondsToSrtTime(segStart);
  const endTime = secondsToSrtTime(segEnd);
  
  entries1.push({ index: li + 1, startTime, endTime, text: line });
  console.log(`  ✓ 타임스탬프: ${startTime} --> ${endTime}`);
  
  lastTsEnd = baseStart + n;
  wordPtr += n;
}

console.log(`\n✓ 생성된 자막 수: ${entries1.length}/${scriptLines1.length}`);

// 테스트 2: wordPtr 소진 케이스 (뒷부분 균등 분배)
console.log("\n【테스트 2】wordPtr 소진 케이스 (뒷부분 균등 분배)");
console.log("─────────────────────────────────────────────────────────────");

const script2 = "First line\nSecond line\nThird line\nFourth line\nFifth line";
const allWords2 = [
  { word: "First", start: 0.0, end: 0.5 },
  { word: "line", start: 0.5, end: 1.0 },
  { word: "Second", start: 1.5, end: 2.0 },
  { word: "line", start: 2.0, end: 2.5 },
];
const totalDuration2 = 10.0;

const scriptLines2 = script2.split("\n").filter(l => l.trim());
console.log(`✓ 스크립트 줄 수: ${scriptLines2.length}`);
console.log(`✓ Deepgram 단어 수: ${allWords2.length}`);
console.log(`✓ 총 오디오 길이: ${totalDuration2}s`);

wordPtr = 0;
lastTsEnd = 0;
const entries2 = [];

for (let li = 0; li < scriptLines2.length; li++) {
  const line = scriptLines2[li];
  const n = line.split(" ").filter(Boolean).length;
  console.log(`\n  줄 ${li + 1}: "${line}" (단어 수: ${n})`);
  
  if (wordPtr >= allWords2.length) {
    console.log(`  ⚠️ wordPtr 소진 (${wordPtr} >= ${allWords2.length})`);
    const prevEnd = entries2.length > 0 ? toSec(entries2[entries2.length - 1].endTime) : 0;
    const remainingLines = scriptLines2.slice(li).filter(l => l.split(' ').filter(Boolean).length > 0);
    const remainingTime = Math.max(totalDuration2 - prevEnd, remainingLines.length * 1.5);
    const slotSize = remainingTime / remainingLines.length;
    let t = prevEnd;
    
    console.log(`  → 남은 줄: ${remainingLines.length}개, 남은 시간: ${remainingTime.toFixed(1)}s, 슬롯 크기: ${slotSize.toFixed(1)}s`);
    
    for (let ri = 0; ri < remainingLines.length; ri++) {
      const rLine = remainingLines[ri];
      const startTime = secondsToSrtTime(t);
      const endTime = secondsToSrtTime(Math.min(t + slotSize - 0.05, totalDuration2));
      entries2.push({ index: entries2.length + 1, startTime, endTime, text: rLine });
      console.log(`    ✓ 줄 ${ri + 1}: ${startTime} --> ${endTime}`);
      t += slotSize;
    }
    break;
  }
  
  const baseStart = Math.max(wordPtr, lastTsEnd);
  const baseSliceEnd = Math.min(baseStart + n, allWords2.length);
  const segStart = allWords2[baseStart].start;
  const segEndIdx = Math.min(baseStart + n - 1, allWords2.length - 1);
  const segEnd = allWords2[segEndIdx].end;
  
  const startTime = secondsToSrtTime(segStart);
  const endTime = secondsToSrtTime(segEnd);
  
  entries2.push({ index: li + 1, startTime, endTime, text: line });
  console.log(`  ✓ 타임스탬프: ${startTime} --> ${endTime}`);
  
  lastTsEnd = baseStart + n;
  wordPtr += n;
}

console.log(`\n✓ 생성된 자막 수: ${entries2.length}/${scriptLines2.length}`);

// 테스트 3: 싱크 정확도 (단조증가 보장)
console.log("\n【테스트 3】싱크 정확도 (단조증가 보장)");
console.log("─────────────────────────────────────────────────────────────");

const testEntries = [
  { index: 1, startTime: "00:00:00,000", endTime: "00:00:02,000", text: "First" },
  { index: 2, startTime: "00:00:01,500", endTime: "00:00:03,000", text: "Second" }, // 겹침
  { index: 3, startTime: "00:00:03,000", endTime: "00:00:02,500", text: "Third" },  // 역순
  { index: 4, startTime: "00:00:04,000", endTime: "00:00:06,000", text: "Fourth" },
];

console.log("원본 자막:");
testEntries.forEach(e => console.log(`  ${e.index}: ${e.startTime} --> ${e.endTime} | ${e.text}`));

// 단조증가 보정
for (let k = 1; k < testEntries.length; k++) {
  const prevEnd = toSec(testEntries[k - 1].endTime);
  const currStart = toSec(testEntries[k].startTime);
  const currEnd = toSec(testEntries[k].endTime);
  
  if (currStart < prevEnd) {
    testEntries[k].startTime = testEntries[k - 1].endTime;
    console.log(`  ✓ 줄 ${k + 1}: 겹침 보정 → ${testEntries[k].startTime}`);
  }
  
  if (toSec(testEntries[k].endTime) <= toSec(testEntries[k].startTime)) {
    testEntries[k].endTime = secondsToSrtTime(toSec(testEntries[k].startTime) + 0.5);
    console.log(`  ✓ 줄 ${k + 1}: 역순 보정 → ${testEntries[k].endTime}`);
  }
}

console.log("\n보정된 자막:");
testEntries.forEach(e => console.log(`  ${e.index}: ${e.startTime} --> ${e.endTime} | ${e.text}`));

// 최종 검증
console.log("\n【최종 검증】");
console.log("─────────────────────────────────────────────────────────────");

let isMonotonic = true;
for (let k = 1; k < testEntries.length; k++) {
  const prevEnd = toSec(testEntries[k - 1].endTime);
  const currStart = toSec(testEntries[k].startTime);
  if (currStart < prevEnd) {
    console.log(`✗ 줄 ${k + 1}: 겹침 발견 (${prevEnd.toFixed(2)}s >= ${currStart.toFixed(2)}s)`);
    isMonotonic = false;
  }
}

if (isMonotonic) {
  console.log("✓ 모든 자막이 단조증가 조건을 만족합니다.");
}

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("✓ 점검 시뮬레이션 완료");
console.log("═══════════════════════════════════════════════════════════════");
