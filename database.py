import pyrebase
import json
import datetime
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, auth

class DBhandler:
    # def __init__(self):
    #     """
    #     Firebase 인증 파일(firebase_auth.json)을 읽고
    #     데이터베이스 객체(self.db)를 초기화하는 부분
    #     """
    #     with open('./authentication/firebase_auth.json') as f:
    #         config = json.load(f)

    #     # Firebase 연결 초기화
    #     firebase = pyrebase.initialize_app(config)
    #     self.db = firebase.database()
    #     print("✅ Firebase 연결 완료")

    def __init__(self):
        with open('./authentication/firebase_auth.json') as f:
            config = json.load(f)

        # Firebase 연결 초기화
        firebase = pyrebase.initialize_app(config)
        self.db = firebase.database()
        print("✅ Pyrebase (Web) connected.")

        # Initialize Firebase Admin (for creating tokens)
        if not firebase_admin._apps:
            cred = credentials.Certificate('./authentication/serviceAccountKey.json')
            
            firebase_admin.initialize_app(cred, {
                'databaseURL': config.get('databaseURL')
            })
            print("✅ Firebase Admin (Server) connected.")

    def create_custom_token(self, user_id):
        try:
            # Create a token that expires in 1 hour 
            custom_token = auth.create_custom_token(user_id, {'expiresIn': 3600})
            return custom_token.decode('utf-8')
        except Exception as e:
            print(f"❌ Error creating custom token: {e}")
            return None

    # [과제1] 상품 정보 삽입 함수
    def insert_item(self, name, data, img_path):
        if isinstance(img_path, list):
            img_list = img_path
        else:
            img_list = [img_path]

        raw_price = data.get('price', '')
        digits_only = ''.join(ch for ch in str(raw_price) if ch.isdigit())

        created_at = datetime.utcnow().timestamp()

        item_info = {
            "seller": data.get('seller', ''),
            "addr": data.get('addr', ''),
            "price": digits_only,
            "status": data.get('status', ''),
            "negotiable": data.get('negotiable', ''),
            "description": data.get('description', ''),
            "email": data.get('email', ''),
            "category": data.get('category', ''),
            "card": data.get('card', ''),
            "phone": data.get('phone', ''),
            
            "img_paths": img_list,
            "img_path": img_list[0], 

            "created_at": created_at,
        }

        self.db.child("item").child(name).set(item_info)
        print(f"✅ 상품 '{name}' 등록 완료")
        return True

    # [과제2] ID 중복 체크 함수
    def user_duplicate_check(self, id_string):
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

    def find_user(self, id_, pw_):
        users = self.db.child("user").get()
        target_value=[]
        for res in users.each():
            value = res.val()
            if value['id'] == id_ and value['pw'] == pw_:
                return True
        return False
    
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

    # Add a message to a conversation
    def add_message(self, conversation_id, sender_id, text, image_url=None):
        """
        Saves a new message to a specific conversation node in Firebase.
        """
        try:
            timestamp = datetime.utcnow().isoformat()
            message_data = {
                "sender": sender_id,
                "text": text,
                "image": image_url or "",
                "timestamp": timestamp
            }
            
            self.db.child("conversations").child(conversation_id).push(message_data)
            print(f"✅ Message sent to: {conversation_id}")
            return True
        except Exception as e:
            print(f"⚠️ Error sending message: {e}")
            return False

#  Get all messages for a conversation
    def get_messages(self, conversation_id):
        """
        Retrieves all messages for a specific conversation_id.
        """
        try:
            messages = self.db.child("conversations").child(conversation_id).get().val()
            
            return messages or {}
        except Exception as e:
            print(f"⚠️ Error fetching messages: {e}")
            return {}
        
    # Save a link so the user can see this chat in their inbox
    def link_user_to_conversation(self, user_id, conversation_id, item_name, other_user_id):
        try:
            chat_info = {
                "conversation_id": conversation_id,
                "item_name": item_name,
                "with_user": other_user_id
            }
            # Save under "user_chats/USER_ID/CONVERSATION_ID"
            self.db.child("user_chats").child(user_id).child(conversation_id).set(chat_info)
            return True
        except Exception as e:
            print(f"❌ Error linking user to chat: {e}")
            return False

    #  Get the list of chats for the Inbox page
    def get_user_conversations(self, user_id):
        try:
            conversations = self.db.child("user_chats").child(user_id).get().val()
            return conversations or {}
        except Exception as e:
            print(f"❌ Error fetching user chats: {e}")
            return {} 

    # Set typing status for a conversation
    def set_typing_status(self, conversation_id, sender_id, is_typing: bool):
        """
        Updates the typing status of a user in the 'typing_status' node.
        
        Data structure:
        typing_status/CONVERSATION_ID/SENDER_ID = True/False
        """
        try:
            #  only store the status if it's True. remove if False.
            if is_typing:
                self.db.child("typing_status").child(conversation_id).child(sender_id).set(True)
                print(f"Typing status set to TRUE for user {sender_id} in chat {conversation_id}")
            else:
                self.db.child("typing_status").child(conversation_id).child(sender_id).remove()
                print(f" Typing status removed for user {sender_id} in chat {conversation_id}")
            return True
        except Exception as e:
            print(f"⚠️ Error setting typing status: {e}")
            return False
            
    # Get typing status
    def get_typing_status(self, conversation_id):
        try:
            return self.db.child("typing_status").child(conversation_id).get().val() or {}
        except Exception as e:
            print(f"⚠️ Error getting typing status: {e}")
            return {} 
    
    # New: Set user's last activity time
    def set_user_activity(self, user_id,timestamp=None):
        """
        Updates a user's 'last_active' timestamp in Firebase.
        """
        try:
            if timestamp is None:
                utc_now = datetime.datetime.now(datetime.timezone.utc)
                timestamp = int(round(utc_now.timestamp() * 1000))
            self.db.child("user_status").child(user_id).update({"last_active": timestamp})
            print(f"✅ Activity updated for user: {user_id}, last_active={timestamp}")
            return True
        except Exception as e:
            print(f"⚠️ Error setting user activity: {e}")
            return False
            
    # New: Get a user's last activity time
    def get_user_activity(self, user_id):
        """
        Retrieves a user's 'last_active' timestamp.
        """
        try:
            status_data = self.db.child("user_status").child(user_id).get().val()
            return status_data.get("last_active") if status_data else None
        except Exception as e:
            print(f"⚠️ Error getting user activity: {e}")
            return None

# 특정 유저의 특정 상품 하트 상태 가져오기
    # heart/{user_id}/{item} = {"interested": "Y" or "N"}
    def get_heart_byname(self, uid, name):
        snap = self.db.child("heart").child(uid).child(name).get()
        val = snap.val()

        if not val:
            return {"interested": "N"}

        return val

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

    def reg_review(self, data, img_path):
        review_info = {
            "title": data['title'],
            "rate": data['rating'],
            "review": data['content'],
            "img_path": img_path,
            "date": datetime.now().strftime("%Y-%m-%d"),
            "pros": data.get("pros", ""),
        }
        self.db.child("review").child(data['name']).set(review_info)
        return True

    
    def get_reviews(self):
        reviews = self.db.child("review").get().val()
        return reviews
    
    def get_review_byname(self, name):
        reviews = self.db.child("review").get()
        target_value=""
        print("###########",name)
        for res in reviews.each():
            key_value = res.key()
            if key_value == name:
                target_value=res.val()
        return target_value
    def get_seller_review_stats(self, seller_id):
        """
        Calculates the average star rating and total count for a seller's reviews.
        This searches through all 'review' nodes that match the seller_id in 'item' nodes.
        """
        try:
            all_items = self.db.child("item").get().val() or {}
            seller_items = [
                name for name, info in all_items.items()
                if isinstance(info, dict) and info.get('seller') == seller_id
            ]

            if not seller_items:
                return {"average_rating": 0.0, "total_reviews": 0}

            all_reviews = self.db.child("review").get().val() or {}
            
            total_rate = 0
            review_count = 0
            
            for item_name in seller_items:
                review_data = all_reviews.get(item_name)
                if isinstance(review_data, dict):
                    try:
                        rate = float(review_data.get('rate', 0))
                        if rate > 0:
                            total_rate += rate
                            review_count += 1
                    except ValueError:
                        pass

            if review_count == 0:
                return {"average_rating": 0.0, "total_reviews": 0}

            average_rating = total_rate / review_count
            
            return {
                "average_rating": round(average_rating, 1),
                "total_reviews": review_count
            }

        except Exception as e:
            print(f"❌ Error getting seller review stats for {seller_id}: {e}")
            return {"average_rating": 0.0, "total_reviews": 0}
        
# database.py

    # 1. Update Transaction Status (Writes to 'transactions' node)
    def update_transaction_status(self, item_name, status, buyer_id=None):
        update_data = {
            "status": status  # "reserved" or "sold"
        }
        if buyer_id:
            update_data["buyer"] = buyer_id
            
        # 🔥 CHANGE: We save this under "transactions", NOT "item"
        self.db.child("transactions").child(item_name).update(update_data)
        return True

    # 2. Get Transaction Status (Reads from 'transactions' node)
    def get_transaction_status(self, item_name):
        # Look inside "transactions" folder
        data = self.db.child("transactions").child(item_name).get().val()
        
        # If no data exists in 'transactions', it means it's still 'active' (On Sale)
        if not data:
            return {"status": "active", "buyer": None}
            
        return data