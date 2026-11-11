# JulyGateway — upload một lần, tự phiên âm và phân tích

Thay URL và token bằng cấu hình riêng. Các ví dụ cần service chạy phiên bản gateway; đây không phải xác nhận đã deploy.

```sh
BASE_URL='https://<gateway-host>'
TOKEN='<application-api-key>'
```

Mọi request `/v1/*` cần `Authorization: Bearer <TOKEN>`. Mỗi ứng dụng có API key riêng và chỉ xem được job của chính nó.

| Method | Endpoint                  | Chức năng                                                  |
| ------ | ------------------------- | ---------------------------------------------------------- |
| POST   | `/v1/transcriptions`      | Upload audio, tạo một job phiên âm và phân tích tự động    |
| POST   | `/v1/transcript-analyses` | Phân tích thủ công độc lập; không cần gọi cho luồng upload |
| GET    | `/v1/jobs/{job_id}`       | Lấy trạng thái và kết quả job                              |

## 1. Upload file một lần

```sh
curl -sS "$BASE_URL/v1/transcriptions" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Idempotency-Key: recording-001' \
  -H 'Content-Type: audio/webm' \
  --data-binary '@./recording.webm'
```

Response HTTP 202 chứa `job_id`. Giữ nguyên idempotency key khi retry chính request đó. Giới hạn upload mặc định 26214400 byte (25 MiB).

Server phiên âm trực tiếp với Groq. Task nền quét transcript mới mỗi **60 giây** và đưa vào hàng đợi phân tích qua 9router. Client không phải gửi transcript lại; dùng cùng `job_id` để lấy cả hai kết quả.

Body là file binary trực tiếp, không dùng `multipart/form-data`. Chỉ nhận `Content-Type: audio/webm` (không kèm `;codecs=opus`). Bắt buộc có `Content-Length` đúng số byte; lệnh curl trên tự thêm header này.

Ví dụ response khi vừa tạo job:

```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "transcription",
  "status": "queued",
  "created_at": 1794370000.0,
  "updated_at": 1794370000.0,
  "completed_at": null,
  "error_code": null,
  "result": null
}
```

Timestamp tính bằng Unix giây, có thể có phần thập phân. HTTP 202 xác nhận đã nhận job, không xác nhận xử lý thành công.

## 2. Lấy trạng thái và kết quả

```sh
JOB_ID='<job_id-from-response>'
curl -sS "$BASE_URL/v1/jobs/$JOB_ID" \
  -H "Authorization: Bearer $TOKEN"
```

Poll đến khi `status` là `completed` hoặc `failed`. Với upload mới, đọc `result.transcript` và `result.analysis`. Không dùng key của ứng dụng khác để lấy job.

Khuyến nghị poll mỗi 2–5 giây và dừng khi job đã có trạng thái cuối. Response HTTP 200 dùng cùng cấu trúc job ở trên.

```text
queued → transcribing → awaiting_analysis → queued → analyzing → completed / failed
```

`awaiting_analysis` nghĩa là transcript đã lưu và đang chờ lượt quét. Lượt quét đầu diễn ra sau 60 giây từ khi service khởi động, sau đó mỗi 60 giây; thời gian chờ còn phụ thuộc hàng đợi. `completed` chỉ được trả khi cả phiên âm và phân tích thành công.

Sau khi phiên âm xong, trường `result` có dạng (giá trị minh họa):

```json
{
  "transcript": {
    "text": "Nội dung transcript...",
    "language": "vi",
    "duration": 12.5,
    "segments": [{ "start": 0.0, "end": 3.2, "text": "Nội dung đoạn đầu..." }],
    "model": "whisper-large-v3-turbo"
  },
  "analysis": null
}
```

`language` và `duration` có thể là `null` nếu provider không trả về; `segments` có thể là mảng rỗng. Sau khi phân tích xong, `result.analysis` chứa object có `summary`, `decisions`, `action_items`, `key_points`, `model`, `prompt_version` như ví dụ phía dưới. Transcript được giữ nguyên trong `result.transcript`.

Nếu phiên âm lỗi, `status` là `failed` và `result` là `null`. Nếu phân tích lỗi, `status` là `failed` nhưng `result.transcript` vẫn có nội dung; `error_code` cho biết bước lỗi.

Nếu chưa cấu hình URL/model phân tích, job giữ ở `awaiting_analysis`. Phía vận hành cần điền `GATEWAY_LLM_BASE_URL`, `GATEWAY_LLM_MODEL`, `GATEWAY_LLM_API_KEY` cho 9router rồi restart service; scanner sẽ tiếp tục các transcript đang chờ. Client không cần upload lại.

## 3. API phân tích thủ công (tùy chọn)

Không gọi API này cho file đã upload ở bước 1. API vẫn được giữ cho trường hợp ứng dụng đã có transcript từ nguồn khác và chỉ muốn phân tích riêng.

Tạo `analysis-request.json` với nội dung `{"transcript":"Nội dung cần phân tích..."}` rồi gọi:

```sh
curl -sS "$BASE_URL/v1/transcript-analyses" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Idempotency-Key: analysis-001' \
  -H 'Content-Type: application/json' \
  --data-binary '@./analysis-request.json'
```

Response HTTP 202 chứa một `job_id` riêng. Poll bằng API ở bước 2. Job thủ công dùng trạng thái `queued → processing → completed / failed`, kết quả trực tiếp trong `result`.

Request chỉ nhận trường `transcript`; không được rỗng sau khi bỏ khoảng trắng đầu/cuối, tối đa 1.000.000 ký tự. Body JSON tối đa 12 MiB. Response có cùng cấu trúc job ở bước 1 nhưng `type` là `transcript_analysis`.

Object phân tích có dạng dưới đây. Với workflow upload nó nằm trong `result.analysis`; với job phân tích thủ công nó nằm trực tiếp trong `result`:

```json
{
  "summary": "Nhóm thống nhất kế hoạch phát hành.",
  "decisions": ["Phát hành vào thứ Sáu"],
  "action_items": [{ "task": "Kiểm thử", "owner": "Tony", "due": null }],
  "key_points": ["Cần kiểm thử trước khi phát hành"],
  "model": "<model-da-cau-hinh>",
  "prompt_version": "v1"
}
```

`owner` và `due` có thể là `null`; các mảng có thể rỗng nếu transcript không có thông tin tương ứng.

## Quy tắc tích hợp

- Luồng upload chỉ cần một POST và polling. Không tạo thêm job phân tích ở client vì server đã tự thực hiện.
- Mỗi thao tác mới dùng một `Idempotency-Key` mới, nên dùng UUID. Header bắt buộc, dài 1–128 ký tự và không chỉ gồm khoảng trắng.
- Khi mất kết nối và gửi lại cùng request, giữ nguyên key để nhận lại job cũ, kể cả job đã hoàn tất hoặc thất bại.
- Không dùng chung key giữa phiên âm và phân tích. Cùng key nhưng khác nội dung hoặc loại job trả 409. Key được cô lập theo ứng dụng.
- Job không tồn tại hoặc thuộc ứng dụng khác đều trả 404.
- Không có API retry riêng. Sau khi xử lý nguyên nhân lỗi, gửi request mới bằng key mới nếu muốn tạo lần xử lý khác.
- Worker có thể gọi lại provider khi phục hồi sau sự cố; không bảo đảm provider được gọi đúng một lần.
- Transcript đã lưu không bị phiên âm lại khi khôi phục bước phân tích. Quét nhiều lần không tạo thêm lượt phân tích cho một job đã được xếp hàng.
- Job phiên âm lịch sử được tạo trước khi có workflow tự động giữ nguyên hợp đồng cũ (`result.text`, hoàn tất sau phiên âm), không được tự quét lại. Hợp đồng mới áp dụng cho upload mới.

## Lỗi

- 400: `Content-Length` sai định dạng.
- 401: thiếu hoặc sai key.
- 404: job không tồn tại hoặc không thuộc ứng dụng.
- 409: idempotency key đã dùng với nội dung khác.
- 411: upload thiếu `Content-Length`.
- 413: request vượt giới hạn.
- 415: định dạng audio không hỗ trợ.
- 422: input không hợp lệ.
- 503: provider phân tích transcript chưa được cấu hình; phiên âm vẫn sử dụng được nếu Groq đã cấu hình.

HTTP 202 không phải kết quả xử lý. Kiểm tra `status` và `error_code` khi poll. Job thất bại có thể được gửi lại thành job mới bằng idempotency key mới sau khi đã xử lý nguyên nhân.

| `error_code` của job   | Ý nghĩa                        |
| ---------------------- | ------------------------------ |
| `transcription_failed` | Xử lý phiên âm thất bại        |
| `analysis_failed`      | Xử lý phân tích thất bại       |
| `recording_missing`    | Không tìm thấy audio cần xử lý |

Lỗi xử lý được trả trong response polling HTTP 200 với `status: failed`, không phải HTTP 202 ban đầu. Response không trả raw exception hoặc secret của provider.
