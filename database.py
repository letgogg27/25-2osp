import pyrebase
import json

class DBhandler:
    def __init__(self):
        """
        Firebase 인증 파일(firebase_auth.json)을 읽고
        데이터베이스 객체(self.db)를 초기화하는 부분
        """
        with open('./authentication/firebase_auth.json') as f:
            config = json.load(f)

        # Firebase 연결 초기화
        firebase = pyrebase.initialize_app(config)
        self.db = firebase.database()
        print("✅ Firebase 연결 완료")

    # -------------------------------
    # [과제1] 상품 정보 삽입 함수
    # -------------------------------
    def insert_item(self, name, data, img_path):
        """
        전달받은 상품 데이터를 JSON 형태로 구성하여
        Firebase DB의 'item' 노드에 저장
        """
        item_info = {
            "seller": data['seller'],
            "addr": data['addr'],
            "email": data['email'],
            "category": data['category'],
            "card": data['card'],
            "status": data['status'],
            "phone": data['phone'],
            "img_path": img_path
        }

        # "item" 노드 아래 상품 이름(name)을 키로 데이터 저장
        self.db.child("item").child(name).set(item_info)
        print(f"✅ 상품 '{name}' 등록 완료")
        return True

    # -------------------------------
    # [과제2] ID 중복 체크 함수
    # -------------------------------
    def user_duplicate_check(self, id_string):
        """
        'user' 노드를 조회하여 동일한 ID가 이미 존재하는지 확인
        존재하면 False, 없으면 True 반환
        """
        users = self.db.child("user").get()

        # 첫 번째 회원가입일 경우(None)
        if users.val() is None:
            print("🆕 첫 사용자 등록")
            return True

        # 이미 존재하는 id가 있는지 검사
        for res in users.each():
            value = res.val()
            if value['id'] == id_string:
                print(f"⚠️ 이미 존재하는 ID: {id_string}")
                return False

        print(f"✅ 사용 가능한 ID: {id_string}")
        return True

   # ------------------------------
# [과제2] 회원 등록 함수 (닉네임 제외 버전)
# ------------------------------
def insert_user(self, data, pw):
    """
    회원가입 정보(ID, 해시된 PW)를
    Firebase DB의 'user' 노드에 push()로 저장
    """
    user_info = {
        "id": data['id'],
        "pw": pw  # app.py에서 SHA-256으로 해시된 값이 전달됨
    }

    # 중복체크 후 저장
    if self.user_duplicate_check(data['id']):
        self.db.child("user").push(user_info)
        print(f"✅ 회원가입 완료: {data['id']}")
        return True
    else:
        print(f"❌ 회원가입 실패 (중복 ID): {data['id']}")
        return False

