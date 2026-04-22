import sys
sys.path.insert(0, '/Users/hany/workzone/claude-test/kakao-auto-sender')

from kakao_sender import KakaoSender

sender = KakaoSender()
TEST_ROOM = "정주희 대표님"
TEST_MSG = "테스트 메시지입니다. 🔔"

steps = [
    ("1. KakaoTalk 활성화", lambda: sender._activate_kakao()),
    ("2. 채팅방 찾아서 열기 (AX 직접)", lambda: sender._open_chat_room(TEST_ROOM)),
    ("3. 메시지 입력창 포커스", lambda: sender._focus_message_input()),
    ("4. 메시지 붙여넣기 + 전송", lambda: (sender._paste_text(TEST_MSG), __import__('time').sleep(0.5), sender._applescript_press("return"))),
]

for name, fn in steps:
    input(f"\n▶ [{name}] 실행하려면 Enter...")
    try:
        fn()
        print(f"   ✓ 완료")
    except Exception as e:
        print(f"   ✗ 오류: {e}")
        break

print("\n테스트 종료")
