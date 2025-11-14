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

    # ---사용자별 찜 추가
    def add_wishlist(self, user_id: str, product_id: int):
        # wishlist/{user_id}/{product_id} = true
        self.db.child("wishlist").child(user_id).child(str(product_id)).set(True)
        return True

    # 사용자별 찜 제거
    def remove_wishlist(self, user_id: str, product_id: int):
        # wishlist/{user_id}/{product_id} 삭제
        self.db.child("wishlist").child(user_id).child(str(product_id)).remove()
        return True

    # 사용자의 찜 ID 리스트 가져오기
    def get_wishlist_ids(self, user_id: str):
        snap = self.db.child("wishlist").child(user_id).get()
        val = snap.val()

        if not val:
            return []

    # case1: 딕셔너리 형태 (정상)
        if isinstance(val, dict):
            return [int(k) for k in val.keys()]

    # case2: 리스트 형태 (이전 데이터가 push로 들어간 경우)
        if isinstance(val, list):
        # 리스트 길이만큼 인덱스를 id로 쓸 수 있지만, 여기선 임시로 무시
        # 또는 True값만 count하는 용도로
            return [i for i, v in enumerate(val) if v]

    # 혹시 모르는 다른 타입 방어
        return []


    # 특정 상품이 찜 상태인지
    def is_in_wishlist(self, user_id: str, product_id: int) -> bool:
        val = self.db.child("wishlist").child(user_id).child(str(product_id)).get().val()
        return bool(val)


    def find_user(self, id_string, pw_hash):
        users = self.db.child("user").get() # 'user' 노드의 모든 데이터 가져오기 [cite: 85]
        
        # 데이터가 없을 경우
        if users.val() is None:
            return False

        # 모든 사용자 데이터를 반복하여 확인
        for res in users.each():
            value = res.val()
            
            # ID와 비밀번호 해시값이 모두 일치하는지 확인
            if value['id'] == id_string and value['pw'] == pw_hash:
                return True # 일치하는 사용자를 찾음
        
        return False # 일치하는 사용자를 찾지 못함

