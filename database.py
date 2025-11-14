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

    # [과제1] 상품 정보 삽입 함수
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
            "price": data['price'],
            "img_path": img_path
        }

        # "item" 노드 아래 상품 이름(name)을 키로 데이터 저장
        self.db.child("item").child(name).set(item_info)
        print(f"✅ 상품 '{name}' 등록 완료")
        return True

    # [과제2] ID 중복 체크 함수
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

    # [과제2] 회원 등록 함수
    def insert_user(self, form_data, pw_hash):
        """
        form_data: request.form (signup.html의 name 속성 기준)
        - userID, password, passwordConfirm, email, emailDomain, tel1, tel2, tel3, ...
        pw_hash: app.py에서 SHA-256 등으로 해시된 비밀번호 문자열
        """
        # 폼 명칭과 백엔드 키 맞추기 (userID 사용)
        user_id = form_data.get('userID', '').strip()

        if not user_id:
            print("❌ 회원가입 실패: userID 누락")
            return False

        #중복 체크
        if not self.user_duplicate_check(user_id):
            print(f"❌ 회원가입 실패 (중복 ID): {user_id}")
            return False

        #저장 정보
        user_info = {
            "id": user_id,
            "pw": pw_hash
        }
        self.db.child("user").push(user_info)
        print(f"✅ 회원가입 완료: {user_id}")
        return True
    
    def get_items(self):
        items = self.db.child("item").get().val()
        return items
    
    def get_item_byname(self, name):
        items = self.db.child("item").get()
        target_value=""
        print("###########",name)
        for res in items.each():
            key_value = res.key()
            if key_value == name:
                target_value=res.val()
        return target_value

# 추가! 특정 유저의 특정 상품 하트 상태 가져오기
    # heart/{user_id}/{item} = {"interested": "Y" or "N"}
    def get_heart_byname(self, uid, name):
        snap = self.db.child("heart").child(uid).child(name).get()
        val = snap.val()

        if not val:
            return ""
        return val.get("interested", "")

    # 하트 업데이트 (Y or N)
    def update_heart(self, user_id, isHeart, item):
        heart_info = {
            "interested": isHeart
        }
        self.db.child("heart").child(user_id).child(item).set(heart_info)
        return True
        
    # 찜목록 기능


    def add_wishlist(self, user_id: str, product_key: str):
        self.db.child("wishlist").child(user_id).child(product_key).set(True)
        return True

    def remove_wishlist(self, user_id: str, product_key: str):
        self.db.child("wishlist").child(user_id).child(product_key).remove()
        return True

    def get_wishlist_ids(self, user_id: str):
        snap = self.db.child("wishlist").child(user_id).get()
        val = snap.val()

        if not val:
            return []

        if isinstance(val, dict):
            return list(val.keys())

        if isinstance(val, list):
            return [i for i, v in enumerate(val) if v]

        return []

    def is_in_wishlist(self, user_id: str, product_key: str) -> bool:
        val = self.db.child("wishlist").child(user_id).child(product_key).get().val()
        return bool(val)

    # 로그인 검증
    def find_user(self, id_string, pw_hash):
        users = self.db.child("user").get()

        if users.val() is None:
            return False

        for res in users.each():
            v = res.val()
            if v['id'] == id_string and v['pw'] == pw_hash:
                return True

        return False
