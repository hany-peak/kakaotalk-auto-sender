"""
빠른 테스트 스크립트 (서버 없이 직접 실행)

사용법:
  python test_send.py
"""

from kakao_sender import KakaoSender
import time

sender = KakaoSender()

# 5초 후 발송 (카카오톡으로 창 전환할 시간)
print("5초 후 발송 시작합니다. 카카오톡을 실행해두세요...")
for i in range(5, 0, -1):
    print(f"  {i}초...")
    time.sleep(1)

# -------------------------------------------------------
# 테스트 케이스 수정 후 실행하세요
# -------------------------------------------------------

# 단일 발송 테스트
result = sender.send(
    room_name="정주희 대표님",   # ← 실제 채팅방 이름으로 변경
    message="테스트 메시지입니다. 🔔"
)
print(result)

# 여러 방 발송 테스트 (주석 해제 후 사용)
# results = sender.send_multiple([
#     {"room": "개발팀", "message": "배포 완료 ✅"},
#     {"room": "홍길동", "message": "확인 부탁드립니다."},
# ])
# for r in results:
#     print(r)
