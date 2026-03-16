"""
카카오톡 단체 톡방 메시지 자동 전송 스크립트 (macOS)

사용법:
    python3 kakao_sender.py

설정:
    ROOM_NAME: 전송할 톡방 이름 (일부만 입력해도 됨)
    MESSAGE:   보낼 메시지
"""

import subprocess
import pyautogui
import pyperclip
import time

# ── 설정 ───────────────────────────────────────────────
ROOM_NAME = "정주희"          # 톡방 이름 (검색에 사용, 일부 키워드 가능)
MESSAGE   = "테스트"
# ───────────────────────────────────────────────────────

pyautogui.PAUSE = 0.4
pyautogui.FAILSAFE = True


def activate_kakao():
    """카카오톡 앱 활성화 (open 명령 사용 - 권한 불필요)"""
    subprocess.run(["open", "-a", "KakaoTalk"], check=True)
    time.sleep(1.5)


def main():
    print(f"카카오톡 '{ROOM_NAME}' 톡방으로 메시지 전송 시작...")
    print("(3초 후 시작 - 카카오톡 화면으로 이동하지 마세요)")
    time.sleep(3)

    # 1. 카카오톡 활성화
    activate_kakao()

    # 2. 채팅 검색창 열기 (Cmd+Option+F)
    pyautogui.hotkey('command', 'option', 'f')
    time.sleep(0.8)

    # 3. 이름 입력 (클립보드 통해 한글 입력)
    pyperclip.copy(ROOM_NAME)
    pyautogui.hotkey('command', 'v')
    time.sleep(1.0)

    # 4. 첫 번째 검색 결과 선택
    pyautogui.press('down')
    time.sleep(0.3)
    pyautogui.press('return')
    time.sleep(1.0)

    # 5. 입력창 포커스 - 화면 하단 중앙 클릭
    screen_w, screen_h = pyautogui.size()
    # KakaoTalk 창이 보통 화면 중앙에 있으므로 하단 입력창 위치 클릭
    pyautogui.click(screen_w // 2, screen_h - 100)
    time.sleep(0.5)

    # 6. 메시지 입력 후 전송
    pyperclip.copy(MESSAGE)
    pyautogui.hotkey('command', 'v')
    time.sleep(0.5)
    pyautogui.press('return')

    print(f"[OK] '{MESSAGE}' 전송 완료")


if __name__ == "__main__":
    main()
