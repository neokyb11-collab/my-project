# Perfect Sync - TODO

## DB & Schema
- [x] drizzle/schema.ts - subtitleProjects, audioFiles, userSettings 테이블 정의 (defaultNow 포함)
- [x] SQL 마이그레이션 실행

## 서버
- [x] server/db.ts - DB 헬퍼 함수 (createSubtitleProject, getSubtitleProject, addAudioFile, getProjectAudioFiles, updateAudioFileTranscription, updateSubtitleProjectStatus, getUserSettings, upsertUserSettings)
- [x] server/audioProcessing.ts - transcribeAudioFile (storageGetSignedUrl 변환 포함), generateSubtitlesWithLLM, mergeTranscriptions, generateSrtContent
- [x] server/subtitleService.ts - generateSubtitlesForProject (mock 데이터 fallback 완전 제거, storageKey 없으면 에러 throw)
- [x] server/routers.ts - subtitles, settings 라우터 구현

## 프론트엔드
- [x] client/src/pages/Home.tsx - 랜딩 페이지 + 대시보드
- [x] client/src/pages/Settings.tsx - Claude/Gemini API 키 설정 페이지
- [x] client/src/components/SubtitleGenerator.tsx - 오디오 업로드 + 스크립트 입력 + 에러 표시 수정
- [x] client/src/components/ProgressTracker.tsx - generateSubtitles 완료 후 onComplete 호출 (타이밍 버그 수정)
- [x] client/src/components/SubtitleResults.tsx - SRT 결과 표시 + 다운로드
- [x] client/src/App.tsx - 라우트 설정 (/settings 추가)

## 테스트
- [x] server/subtitleService.test.ts - 핵심 로직 테스트 (9개 통과)

## 버그 수정 체크리스트
- [x] storageKey → storageGetSignedUrl() 변환 후 Whisper API 전달 (audioProcessing.ts)
- [x] mock 데이터 fallback 로직 완전 제거 (subtitleService.ts)
- [x] generateSubtitles 실패 시 에러 메시지 화면 표시 (SubtitleGenerator.tsx + ProgressTracker.tsx)
- [x] ProgressTracker: DB 저장 완료 후 조회 (generateSubtitles가 srtContent를 직접 반환하므로 타이밍 보장)

## Deepgram 음성인식 옵션 추가
- [x] drizzle/schema.ts - userSettings에 deepgramApiKey, preferredTranscriber 필드 추가
- [x] SQL 마이그레이션 실행
- [x] audioProcessing.ts - transcribeAudioFileWithDeepgram 함수 추가, transcribeAudioFile에서 선택 로직 구현
- [x] subtitleService.ts - transcriberSettings 로드 및 전달
- [x] server/db.ts - upsertUserSettings에 Deepgram 필드 추가
- [x] server/routers.ts - settings 라우터에 Deepgram 필드 추가
- [x] client/src/pages/Settings.tsx - Deepgram API 키 입력 및 음성인식 서비스 선택 UI 추가
- [x] 테스트 9개 통과
