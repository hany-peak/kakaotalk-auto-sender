import pyautogui
import pyperclip
import subprocess
import time


def send_to_kakao_room(search_keyword, message):
    """
    카카오톡에서 키워드로 채팅방 검색 후 첫 번째 방에 메시지 전송
    """

    # 1. 카카오톡 활성화
    subprocess.run(['osascript', '-e', 'tell application "KakaoTalk" to activate'], capture_output=True)
    time.sleep(1)

    # 2. 카카오톡 검색창 열기 (Cmd+F)
    pyautogui.hotkey('command', 'f')
    time.sleep(0.5)

    # 2. 검색창에 키워드 입력
    pyperclip.copy(search_keyword)
    pyautogui.hotkey('command', 'v')
    time.sleep(1)  # 검색 결과 뜨는 시간

    # 3. 첫 번째 검색 결과 Enter로 진입
    pyautogui.press('enter')
    time.sleep(0.8)

    # 4. 메시지 클립보드 복사 후 입력창에 붙여넣기
    pyperclip.copy(message)
    pyautogui.hotkey('command', 'v')
    time.sleep(0.3)

    # 5. 전송
    pyautogui.press('enter')
    print(f"[완료] '{search_keyword}' 방에 메시지 전송: {message}")


# 실행
if __name__ == "__main__":
    keyword = input("검색할 채팅방 이름: ")
    msg = input("보낼 메시지: ")

    send_to_kakao_room(keyword, msg)
