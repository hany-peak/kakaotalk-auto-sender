"""
이벤트 기반 발송 서버 (Flask HTTP API)

사용법:
  python server.py

엔드포인트:
  POST /send          - 단일 메시지 발송
  POST /send/multiple - 여러 방에 동시 발송
  GET  /health        - 서버 상태 확인

예시 요청:
  curl -X POST http://localhost:5100/send \
    -H "Content-Type: application/json" \
    -d '{"room": "개발팀", "message": "배포 완료되었습니다."}'
"""

from flask import Flask, request, jsonify
from kakao_sender import KakaoSender

app = Flask(__name__)
sender = KakaoSender()


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/send", methods=["POST"])
def send():
    data = request.get_json(force=True)

    room = data.get("room", "").strip()
    message = data.get("message", "").strip()

    if not room:
        return jsonify({"success": False, "error": "room 필드가 필요합니다."}), 400
    if not message:
        return jsonify({"success": False, "error": "message 필드가 필요합니다."}), 400

    result = sender.send(room, message)
    status_code = 200 if result["success"] else 500
    return jsonify(result), status_code


@app.route("/send/multiple", methods=["POST"])
def send_multiple():
    data = request.get_json(force=True)

    targets = data.get("targets", [])
    if not targets:
        return jsonify({"success": False, "error": "targets 필드가 필요합니다."}), 400

    # 각 항목 유효성 검사
    for i, t in enumerate(targets):
        if not t.get("room", "").strip():
            return jsonify({"success": False, "error": f"targets[{i}].room 이 비어있습니다."}), 400
        if not t.get("message", "").strip():
            return jsonify({"success": False, "error": f"targets[{i}].message 가 비어있습니다."}), 400

    results = sender.send_multiple(targets)
    all_success = all(r["success"] for r in results)
    return jsonify({"success": all_success, "results": results}), 200


if __name__ == "__main__":
    print("KakaoTalk 자동 발송 서버 시작: http://localhost:5100")
    print("주의: KakaoTalk 앱이 실행 중이어야 합니다.")
    app.run(host="127.0.0.1", port=5100, debug=False)
