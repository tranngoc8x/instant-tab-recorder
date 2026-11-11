# Plan: cloud transcription qua 9router

Ngày: 10/11/2026 - Phụ trách: Tony

## Hiện trạng

- Recording lưu local (OPFS + IndexedDB). Không có upload ra ngoài.
- Đã có transcription local: `TranscriptionSession` (`src/transcription/session.ts`) chạy Whisper qua WebGPU trong offscreen, kết quả `TranscriptionResult { segments[{startSec,endSec,text}], transcribedAt, modelId, language }` lưu vào IndexedDB. Player hiển thị, Summary dùng lại transcript.
- Trigger: bấm nút trong player (`startTranscription`) -> message `start-transcription` -> offscreen.
- Setting: `transcription { enabled, language }` (language dạng `vietnamese`, map sang code `vi` qua `TRANSCRIPTION_LANGUAGES`).
- CSP `connect-src` chỉ cho huggingface.

## Hướng làm (đề xuất)

API 9router là API transcription (OpenAI-compatible), không phải storage. Ý tưởng: thêm backend "cloud" cho transcription có sẵn, kết quả lưu như transcript local nên player + summary dùng được ngay.

- [ ] Config: thêm `transcription.cloud { enabled, apiKey }` (non-sync, đã nằm trong `NON_SYNC_KEYS` qua key `transcription`). Key nhập trong Settings, không hardcode.
- [ ] `src/transcription/cloud.ts`: `transcribeCloud(blob, { apiKey, language, signal, fetch })`
  - Nén audio trước khi gửi: mediabunny convert -> webm/opus mono 16kHz ~24kbps (1h ~ 11MB) để không vượt giới hạn upload (Groq whisper ~25MB).
  - POST multipart `https://9router.hubs.io.vn/v1/audio/transcriptions`: `model=groq/whisper-large-v3-turbo`, `file`, `language=<code>`, `response_format=verbose_json`.
  - Map `segments[{start,end,text}]` -> `TranscriptionSegment`; validate bằng `isTranscriptionSegment`.
- [ ] `TranscriptionSession.transcribe`: nếu cloud bật thì gọi `transcribeCloud`, ngược lại giữ luồng WebGPU. Giữ nguyên save/broadcast/progress.
- [ ] Manifest CSP: thêm `https://9router.hubs.io.vn` vào `connect-src`.
- [ ] Settings UI: toggle "Cloud transcription" + ô API key (password).
- [ ] (Tuỳ chọn) Tự transcribe sau khi dừng ghi Meet.
- [ ] Test: mapping verbose_json, lỗi HTTP/401/413, abort; build + tsc + lint.

## Quyết định (10/11/2026)

- Lưu trữ = transcript. File audio chỉ gửi lên 9router để lấy transcript, server không lưu.
- Có transcript rồi thì xoá file audio local, giữ record + transcript (+ summary).

### Xoá audio, giữ transcript

Hiện tại `GET /api/recordings/:name` thấy file mất sẽ tự xoá record IndexedDB ("self-healing orphan", `src/handler.ts:550`) -> nếu chỉ xoá file thì mất luôn transcript. Cần:

- [ ] `RecordingRecord.audioDeleted?: true` (không cần migrate DB, field optional).
- [ ] Orphan cleanup bỏ qua record có `audioDeleted`.
- [ ] Sau khi `saveTranscription` thành công và có >= 1 segment có chữ: xoá main file + sub-files trong OPFS, set `audioDeleted`, `fileSize=0`. Lỗi/rỗng thì giữ file.
- [ ] List: record `audioDeleted` hiện nhãn "Transcript only", ẩn download/play; player chỉ hiện transcript + summary.

## Câu hỏi còn mở

1. Tự gửi ngay khi dừng ghi Meet, hay bấm tay trong player? (Đề xuất: tự gửi với bản ghi Meet, bản ghi khác bấm tay.)
2. API key: mỗi user tự nhập trong Settings (đề xuất), hay dùng chung?
3. Xoá audio áp dụng cho mọi bản ghi được transcribe cloud, hay chỉ bản ghi Meet?

## Rủi ro

- Audio cuộc họp gửi sang bên thứ ba (9router -> Groq): cần Legal duyệt theo NĐ 13/2023.
- Giới hạn kích thước upload của 9router chưa rõ; cuộc họp rất dài có thể cần cắt chunk.

## Chốt (10/11/2026)

- Tự gửi khi bản ghi Meet kết thúc (bấm stop hoặc đóng tab Meet). Rời cuộc gọi mà không đóng tab thì chưa tính là kết thúc.
- Một người dùng: key lấy lúc build từ biến môi trường `NINEROUTER_KEY`, ngôn ngữ cố định `vi`. Không có key thì giữ luồng local như cũ.
- Chỉ bản ghi Meet bị xoá audio. Bản ghi tab thường giữ nguyên; bấm transcribe trong player sẽ đi cloud nếu có key (player vẫn yêu cầu model local đã tải).

## Review

- Đã làm: `src/transcription/cloud.ts` (nén opus 24kbps mono 16kHz, POST multipart, map verbose_json), nhánh cloud trong `TranscriptionSession`, `OffscreenHandler.transcribeMeetingAndDropAudio`, cờ `audioDeleted` (DB, list API, bỏ qua orphan cleanup, list UI link sang .vtt, Save all bỏ file media), CSP + `host_permissions` cho 9router, define `process.env.NINEROUTER_KEY` trong `vite.config.ts`.
- Kiểm tra: tsc, oxlint, oxfmt OK; 981 test pass (thêm test mapping/HTTP/size, nén audio thật trong Chromium, luồng xoá audio/giữ file khi lỗi, orphan cleanup); build OK, key chỉ nằm trong `extension/dist/offscreen.js` (thư mục đã gitignore).
- Chưa kiểm tra: gọi API 9router thật (máy build không có key), cuộc họp Meet thật.
- Giới hạn: 1 request tối đa 25MB (~2.3h). Player của bản ghi đã xoá audio vẫn hiện khung video trống, transcript vẫn xem được.

## Phân tích bằng LLM (10/11/2026)

- Sau khi lưu transcript + xoá audio: gọi `POST https://9router.hubs.io.vn/v1/chat/completions` (OpenAI-compatible) với prompt Summary có sẵn (`config.summary.prompt`, mặc định `DEFAULT_SUMMARY_PROMPT`: Overview / Key Points / Action Items, trả lời cùng ngôn ngữ transcript).
- Kết quả lưu vào `record.summary` (player hiển thị, tải được `summary.md`). Bỏ khối `<think>` của model reasoning.
- Bật khi build có cả `NINEROUTER_KEY` và `NINEROUTER_CHAT_MODEL`; thiếu model thì bỏ qua bước phân tích.
- Lỗi phân tích không ảnh hưởng transcript. Chưa có nút chạy lại bằng cloud: nút Summarize trong player vẫn đòi model local đã tải.
- Kiểm tra: 984 test pass, build OK (có/không env). Chưa gọi API thật.
