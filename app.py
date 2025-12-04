from flask import (
    Flask,
    render_template,
    request,
    url_for,
    redirect,
    flash,
    session,
    jsonify,
    abort,
)

import hashlib
from database import DBhandler
import os
import uuid
from werkzeug.utils import secure_filename
import sys
import datetime
from datetime import datetime as dt, timezone
from flask import abort
from flask import jsonify


app = Flask(__name__, template_folder="templates", static_folder="static")
app.secret_key = "some-secret"

UPLOAD_FOLDER = os.path.join(app.root_path, "static", "images")


DB = DBhandler()

# 더미 상품 (이미지 파일은 static/images/ 에 저장)
PRODUCTS = [
    {"id": 1, "name": "이화 로고 자수 반팔 티셔츠", "price": 19900, "img": "tshirt.png", "cat": "의류", "location": "서울특별시 서대문구"},
    {"id": 2, "name": "이화 반다나", "price": 14900, "img": "bandana.png", "cat": "잡화", "location": "서울특별시 마포구"},
    {"id": 3, "name": "이화 피그먼트 캡", "price": 24900, "img": "hat.png", "cat": "잡화", "location": "서울특별시 은평구"},
    {"id": 4, "name": "진공 청소기", "price": 99999, "img": "vacuum.png", "cat": "가전", "location": "서울특별시 종로구"},
    {"id": 5, "name": "이화 PP 포스트잇", "price": 4000, "img": "postit.png", "cat": "문구", "location": "서울특별시 종로구"},
    {"id": 6, "name": "텀블러", "price": 19000, "img": "tumbler.png", "cat": "생활", "location": "서울특별시 종로구"},
    {"id": 7, "name": "이화 로고 자수 반팔 티(그린)", "price": 19900, "img": "tshirt.png", "cat": "의류", "location": "서울특별시 종로구"},
    {"id": 8, "name": "이화 반다나(블랙)", "price": 14900, "img": "bandana.png", "cat": "잡화", "location": "서울특별시 종로구"},
    {"id": 9, "name": "이화 피그먼트 캡(블루)", "price": 25900, "img": "hat.png", "cat": "잡화", "location": "서울특별시 종로구"},
    {"id": 10, "name": "진공 청소기 Pro", "price": 129000, "img": "vacuum.png", "cat": "가전", "location": "서울특별시 종로구"},
]

PAGE_SIZE = 8


def render_list():
    page = int(request.args.get("page", 1))
    start = (page - 1) * PAGE_SIZE
    end = start + PAGE_SIZE
    total_pages = (len(PRODUCTS) + PAGE_SIZE - 1) // PAGE_SIZE

    #추가
    user_id = current_user_id()
    my_wishlist_ids = DB.get_wishlist_ids(user_id) if user_id else []

    return render_template(
        "list.html",
        products=PRODUCTS[start:end],
        page=page,
        total_pages=total_pages,
        my_wishlist_ids=my_wishlist_ids #추가
    )
    
def current_user_id():
    return session.get('id')  # 로그인 시 세션에 넣는 값 그대로 (추가)


# 홈 = 리스트
@app.route("/", strict_slashes=False)
def home():
    return redirect(url_for("view_list"))

def safe_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0

@app.route("/list", strict_slashes=False)
def view_list():
    page = request.args.get("page", 1, type=int)
    q = request.args.get("q", "").strip()
    sort = request.args.get("sort", "")

    per_page = 15

    data = DB.get_items() or {}  
    items = list(data.items())

    filtered = []
    for name, info in items:
        if not isinstance(info, dict):
            print("⚠ 잘못된 item 데이터:", name, type(info), info)
            continue
            
        seller = info.get("seller", "")
        if q:
            if (q.lower() not in name.lower()) and (q.lower() not in seller.lower()):
                continue
        filtered.append((name, info))

    if sort == "price_asc":
        filtered.sort(key=lambda kv: safe_int(kv[1].get("price")))
    elif sort == "price_desc":
        filtered.sort(
            key=lambda kv: safe_int(kv[1].get("price")),
            reverse=True
        )
    else:
        filtered.sort(
            key=lambda kv: float(kv[1].get("created_at", 0)),
            reverse=True
        )

    item_counts = len(filtered)

    page_count = (item_counts + per_page - 1) // per_page if item_counts > 0 else 1

    if page < 1:
        page = 1
    if page > page_count:
        page = page_count

    start_idx = (page - 1) * per_page
    end_idx = start_idx + per_page
    page_items = filtered[start_idx:end_idx]

    return render_template(
        "list.html",
        datas=page_items,
        limit=per_page,
        page=page,
        page_count=page_count,
        total=item_counts,
        q=q,
        sort=sort,
    )


@app.route("/register_items", methods=["GET", "POST"], strict_slashes=False)
def register_items():
    if "id" not in session:
        flash("로그인을 해주세요!")
        return redirect(url_for("login"))
    return render_template("reg_items.html")


@app.route("/register_reviews", methods=["GET", "POST"], strict_slashes=False)
def register_reviews():
    if "id" not in session:
        flash("로그인을 해주세요!")
        return redirect(url_for("login"))
    return render_template("reg_reviews.html")


@app.route("/login")
def login():
    return render_template("login.html")


@app.route("/login_confirm", methods=["POST"])
def login_user():
    id_ = request.form["id"]
    pw = request.form["pw"]
    pw_hash = hashlib.sha256(pw.encode("utf-8")).hexdigest()
    if DB.find_user(id_, pw_hash):
        session["id"] = id_
        token = DB.create_custom_token(id_)
        session["firebase_token"] = token
        return redirect(url_for("home"))
    else:
        flash("잘못된 아이디 혹은 비밀번호 입니다!")
        return render_template("login.html")

@app.route("/logout")
def logout_user():
    session.clear()
    return redirect(url_for("home"))

@app.route("/signup")
def signup():
    return render_template("signup.html")

# 회원가입 처리
@app.route("/signup_post", methods=["POST"])
def register_user():
    form = request.form
    user_id = (form.get("userID") or "").strip()  # 폼 name과 맞춤
    pw = form.get("password") or ""
    pw2 = form.get("passwordConfirm") or ""

    if not user_id or not pw:
        flash("아이디/비밀번호를 입력하세요.")
        return redirect(url_for("signup"))
    if pw != pw2:
        flash("비밀번호가 일치하지 않습니다.")
        return redirect(url_for("signup"))

    pw_hash = hashlib.sha256(pw.encode("utf-8")).hexdigest()

    if DB.insert_user(form, pw_hash):
        flash("회원가입이 완료되었습니다. 로그인 해주세요.")
        return redirect(url_for("login"))
    else:
        flash("이미 존재하는 아이디입니다.")
        return redirect(url_for("signup"))

# 상품 등록 처리 (여러 장 업로드)
@app.route("/submit_item_post", methods=["POST"], strict_slashes=False)
def reg_item_submit_post():
    # 로그인 확인: 판매자 아이디는 세션에서 고정
    if "id" not in session:
        flash("로그인 후 이용해주세요.")
        return redirect(url_for("login"))

    # 1) 여러 장 파일 처리
    files = request.files.getlist("file")
    if not files or files[0].filename == "":
        flash("대표 사진을 업로드해주세요.")
        return redirect(url_for("register_items"))

    image_dir = os.path.join(app.static_folder, "images")
    os.makedirs(image_dir, exist_ok=True)

    filenames = []
    for f in files[:10]:  # 최대 10장
        if f and f.filename:
            original_name = secure_filename(f.filename)
            _, ext = os.path.splitext(original_name)
            unique_name = f"{uuid.uuid4().hex}{ext}"
            save_path = os.path.join(image_dir, unique_name)
            f.save(save_path)
            filenames.append(unique_name)

    if not filenames:
        flash("이미지 저장에 실패했습니다.")
        return redirect(url_for("register_items"))

    # 2) 폼 데이터 처리
    form = request.form

    item_name = (form.get("item_name") or "").strip()
    if not item_name:
        flash("상품 이름을 입력해주세요.")
        return redirect(url_for("register_items"))

    # 가격: 숫자만 추출해서 DB에는 "1000000" 형태로 저장
    raw_price = (form.get("item_price") or "").strip()
    digits_only = "".join(ch for ch in raw_price if ch.isdigit())
    if not digits_only:
        flash("가격을 숫자로 입력해주세요.")
        return redirect(url_for("register_items"))

    condition = form.get("condition", "used")
    negotiable = "yes" if form.get("negotiable") == "yes" else "no"
    address = (form.get("address") or "").strip()
    description = (form.get("description") or "").strip()
    seller_id = session["id"]  # 폼 값 대신 세션 사용

    data = {
        "seller": seller_id,
        "addr": address,
        "price": digits_only,
        "status": condition,
        "negotiable": negotiable,
        "description": description,
        "email": "",
        "category": "",
        "card": "",
        "phone": "",
    }

    # Firebase에 저장
    DB.insert_item(item_name, data, filenames)

    # 등록 결과 페이지 대신, 바로 상세 페이지로 이동
    return redirect(url_for("view_item_detail", name=item_name))

@app.route("/item/delete/<name>/", methods=["POST"], strict_slashes=False)
def delete_item(name):
    # 1. 로그인 확인
    if "id" not in session:
        return jsonify({"msg": "로그인 후 이용해주세요."}), 401

    # DB에서 실제 삭제
    try:
        DB.delete_item(name)
    except Exception as e:
        print("❌ delete_item error:", e)
        return jsonify({"msg": "DB 삭제 중 오류가 발생했습니다."}), 500

    return jsonify({"msg": "상품이 삭제되었습니다."})

@app.route("/item/complete/<name>/", methods=["POST"])
def complete_item(name):
    if "id" not in session:
        return jsonify({"msg": "로그인 후 이용해주세요."}), 401

    item = DB.get_item_byname(name)
    if not item:
        return jsonify({"msg": "해당 상품이 존재하지 않습니다."}), 404

    if item.get("seller") != session["id"]:
        return jsonify({"msg": "본인이 등록한 상품만 변경할 수 있습니다."}), 403

    # 상태를 'sold' 로 표시
    DB.db.child("item").child(name).update({"status": "sold"})

    return jsonify({"msg": "거래완료로 표시되었습니다."})

@app.route("/wishlist")
def wishlist():
    user_id = current_user_id()
    if not user_id:
        flash("로그인 해주세요.")
        return redirect(url_for("login"))

    heart_data = DB.db.child("heart").child(user_id).get().val()
    if not heart_data:
        items = []
    else:
        liked_items = []

        for name, val in heart_data.items():
            if isinstance(val, dict):
                flag = val.get("interested")
            else:
                flag = val

            if flag == "Y":
                liked_items.append(name)
        
        all_items = DB.get_items() or {}
        
        items = []
        for k, v in all_items.items():
            if k in liked_items:
                info=dict(v)
                info["interested"] = "Y"   # 추가
                items.append((k, info))

    # --- 페이지네이션 ---
    page = request.args.get("page", 1, type=int)
    per_page = 15
    total = len(items)
    page_count = (total + per_page - 1) // per_page

    start = (page - 1) * per_page
    end = start + per_page
    page_items = items[start:end]

    return render_template(
        "wishlist.html",
        datas=page_items,
        page=page,
        page_count=page_count,
        total=total
    )


@app.route('/show_heart/<name>/', methods=['GET'])
def show_heart(name):
     my_heart = DB.get_heart_byname(session['id'],name)
     return jsonify({'my_heart': my_heart})
@app.route('/like/<name>/', methods=['POST'])
def like(name):
     my_heart = DB.update_heart(session['id'],'Y',name)
     return jsonify({'msg': '좋아요 추가 완료!'})
@app.route('/unlike/<name>/', methods=['POST'])
def unlike(name):
     my_heart = DB.update_heart(session['id'],'N',name)
     return jsonify({'msg': '좋아요 취소 완료!'})
     

@app.route("/item_detail", strict_slashes=False)
def item_detail():
    return render_template("item_detail.html")


@app.route("/dynamicurl/<varible_name>/")
def DynamicUrl(varible_name):
    return str(varible_name)


@app.route("/view_detail/<name>/")
def view_item_detail(name):
    data = DB.get_item_byname(str(name))
    if not data:
        # 안전하게 404 처리 (선택)
        from flask import abort
        abort(404)

    seller_id = data.get('seller')
    if seller_id:
        review_stats = DB.get_seller_review_stats(seller_id)
    else:
        review_stats = {"average_rating": 0.0, "total_reviews": 0}

    user_id = session.get("id")
    can_review = False
    transaction_status = None

    trans_data = DB.get_transaction_status(name) or {}
    transaction_status = trans_data.get("status")
    buyer_id = trans_data.get("buyer")

    if user_id and transaction_status == "sold" and buyer_id == user_id:
        can_review = True

    return render_template(
        "item_detail.html",
        name=name,
        data=data,
        review_stats=review_stats,
        transaction_status=transaction_status,
        can_review=can_review,
    )


# Gets the message history for a chat
@app.route("/api/chat/history/<item_name>")
def get_chat_history(item_name):
    # Check if user is logged in
    if 'id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    # Get seller ID from the item
    item_data = DB.get_item_byname(item_name)
    if not item_data:
        return jsonify({"error": "Item not found"}), 404

    seller_id = item_data.get("seller")
    buyer_id = session['id']

    user_ids = sorted([buyer_id, seller_id])
    conversation_id = f"{user_ids[0]}_{user_ids[1]}_{item_name}"

    messages = DB.get_messages(conversation_id)

    return jsonify(messages)

# Sends a new message
@app.route("/api/chat/send/<item_name>", methods=['POST'])
def send_chat_message(item_name):
    if 'id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json or {}
    text = (data.get("text") or "").strip()
    
    if not text:
        return jsonify({"error": "Empty message"}), 400

    item_data = DB.get_item_byname(item_name)
    if not item_data:
        return jsonify({"error": "Item not found"}), 404
    
    seller_id = item_data.get("seller")
    current_user_id = session['id']

    trans_data = DB.get_transaction_status(item_name)
    status = trans_data.get("status")
    reserved_buyer = trans_data.get("buyer")

    if status == "sold":
        return jsonify({"error": "거래가 완료된 상품입니다. 채팅 불가."}), 403
    
    if status == "reserved":
        # If I am NOT the seller AND NOT the chosen buyer, block me
        if current_user_id != seller_id and current_user_id != reserved_buyer:
            return jsonify({"error": "다른 사용자와 거래 진행중입니다."}), 403

    other_user_id = data.get("other_user_id")
    
    if current_user_id != seller_id:
        user_ids = sorted([current_user_id, seller_id])
        other_for_link = seller_id
    else:
        if not other_user_id:
            return jsonify({"error": "Missing other_user_id"}), 400
        user_ids = sorted([seller_id, other_user_id])
        other_for_link = other_user_id

    conversation_id = f"{user_ids[0]}_{user_ids[1]}_{item_name}"
    
    success = DB.add_message(conversation_id, current_user_id, text)
    
    if success:
        DB.link_user_to_conversation(current_user_id, conversation_id, item_name, other_for_link)
        DB.link_user_to_conversation(other_for_link, conversation_id, item_name, current_user_id)
        return jsonify({"status": "success"})
    
    return jsonify({"error": "Failed"}), 500

@app.route("/api/chat/send_with_image/<item_name>", methods=["POST"])
def send_chat_with_image(item_name):
    if 'id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    text = (request.form.get("text") or "").strip()
    other_user_id = request.form.get("other_user_id")
    image_file = request.files.get("image")

    if not text and not image_file:
        return jsonify({"error": "Empty message"}), 400

    item_data = DB.get_item_byname(item_name)
    if not item_data:
        return jsonify({"error": "Item not found"}), 404

    item_owner_id = item_data.get("seller")
    current_user_id = session["id"]

    if current_user_id != item_owner_id:
        user_ids = sorted([current_user_id, item_owner_id])
        other_for_link = item_owner_id
    else:
        if not other_user_id:
            return jsonify({"error": "Missing other_user_id for seller chat"}), 400
        user_ids = sorted([item_owner_id, other_user_id])
        other_for_link = other_user_id

    conversation_id = f"{user_ids[0]}_{user_ids[1]}_{item_name}"

    # ==== Save image ====
    image_url = ""
    if image_file and image_file.filename:
        from werkzeug.utils import secure_filename
        import uuid, os

        filename = secure_filename(image_file.filename)
        _, ext = os.path.splitext(filename)
        unique_name = f"{uuid.uuid4().hex}{ext}"

        save_dir = os.path.join(app.static_folder, "chat_images")
        os.makedirs(save_dir, exist_ok=True)

        save_path = os.path.join(save_dir, unique_name)
        image_file.save(save_path)

        image_url = url_for("static", filename=f"chat_images/{unique_name}", _external=False)

    # ===== Save message to Firebase =====
    success = DB.add_message(
        conversation_id=conversation_id,
        sender_id=current_user_id,
        text=text,
        image_url=image_url or None
    )

    if not success:
        return jsonify({"error": "Failed to send message"}), 500

    DB.link_user_to_conversation(
        user_id=current_user_id,
        conversation_id=conversation_id,
        item_name=item_name,
        other_user_id=other_for_link
    )
    DB.link_user_to_conversation(
        user_id=other_for_link,
        conversation_id=conversation_id,
        item_name=item_name,
        other_user_id=current_user_id
    )

    return jsonify({"status": "success", "message": "Message with image sent"})

@app.route("/my_messages")
def my_messages():
    if 'id' not in session:
        flash(" 로그인을 해주세요!")
        return redirect(url_for('login'))
    
    my_id = session['id']
    
    # Get list of chats from DB
    conversations_dict = DB.get_user_conversations(my_id)
    
    # Convert to a list for the HTML loop
    conversations_list = list(conversations_dict.values()) if conversations_dict else []
    
    return render_template("my_messages.html", conversations=conversations_list)


@app.route("/api/chat/delete/<conversation_id>", methods=['POST'])
def delete_chat(conversation_id):
    if 'id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    user_id = session['id']
    
    # Call database to remove the link
    success = DB.delete_chat_link(user_id, conversation_id)
    
    if success:
        return jsonify({"status": "success", "msg": "Chat deleted from inbox"})
    else:
        return jsonify({"error": "Failed to delete"}), 500

@app.route("/mypage")
def mypage():
    if "id" not in session:
        flash("로그인 후 이용해주세요.")
        return redirect(url_for("login"))

    user_id = session["id"]

    all_my_uploads = DB.get_items_by_seller(user_id)

    history = DB.get_transactions_by_user(user_id)

    sold_items = {}
    bought_items = {}
    my_active_items = {}

    for name, info in history.items():
        # Items I sold 
        if info.get("seller") == user_id:
            sold_items[name] = info
        # Items I bought
        elif info.get("buyer") == user_id:
            bought_items[name] = info

    for name, info in all_my_uploads.items():
        
        # Active Items or Not sold yet
        if info.get("status") != "sold":
            if name not in sold_items:
                my_active_items[name] = info

        #  Sold Items 
        elif info.get("status") == "sold":
            if name not in sold_items:
                sold_items[name] = info

    return render_template(
        "mypage.html",
        my_items=my_active_items,
        sold_items=sold_items,
        bought_items=bought_items,
        user_id=user_id
    )

@app.route("/api/chat/typing/<item_name>", methods=['POST'])
def toggle_typing_status(item_name):
    if 'id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json or {}
    is_typing = data.get("is_typing", False)  
    other_user_id = data.get("other_user_id") 

    # 상품 정보 (Conversation ID 생성에 필요)
    item_data = DB.get_item_byname(item_name)
    if not item_data:
        return jsonify({"error": "Item not found"}), 404

    item_owner_id = item_data.get("seller")
    current_user_id = session['id']

    # 대화 상대 결정 
    if current_user_id != item_owner_id:
        # 구매자 입장: 상대는 seller
        other_for_link = item_owner_id
    else:
        # 판매자 입장: 상대는 other_user_id (buyer)
        if not other_user_id:
            return jsonify({"error": "Missing other_user_id for seller chat"}), 400
        other_for_link = other_user_id
    
    # Conversation ID 생성
    user_ids = sorted([current_user_id, other_for_link])
    conversation_id = f"{user_ids[0]}_{user_ids[1]}_{item_name}"
    
    # DB 핸들러 호출
    DB.set_typing_status(
        conversation_id=conversation_id,
        sender_id=current_user_id,
        is_typing=is_typing
    )
    
    return jsonify({"status": "success", "is_typing": is_typing})

# NEW: Update user's last active time
@app.route("/api/user/active", methods=['POST'])
def update_user_activity():
    data = request.get_json() or {}
    user_id = data.get("user_id")

    if not user_id:
        return jsonify({"status": "ignored", "reason": "missing user_id"}), 400
    print("🔥 Presence update from:", user_id)
    print(f"{dt.now(timezone.utc).timestamp()*1000}")
    timestamp = int(dt.now(timezone.utc).timestamp() * 1000)
    # Update Firebase presence
    success = DB.set_user_activity(user_id, timestamp)

    return jsonify({"status": "updated" if success else "failed", "user_id": user_id, "timestamp": timestamp})

@app.route("/reg_review_init/<name>/")
def reg_review_init(name):
    user_id = session.get("id")
    if not user_id:
        return redirect(url_for("login"))
    trans_data = DB.get_transaction_status(item_name) or {}
    status = trans_data.get("status")
    buyer_id = trans_data.get("buyer")

    if not (status == "sold" and buyer_id == user_id):
        flash("거래를 완료한 구매자만 리뷰를 등록할 수 있습니다.")
        return redirect(url_for("view_item_detail", name=item_name))

    data = DB.get_item_byname(name)   
    return render_template("reg_reviews.html", name=name, data=data)

@app.route("/reg_review", methods=['POST'])
def reg_review():
    data = request.form
    files = request.files.getlist("images[]")

    # 이미지 저장
    img_names = []
    for f in files:
        if f and f.filename:
            filename = secure_filename(f.filename)
            f.save(os.path.join("static/images", filename))
            img_names.append(filename)

    review_info = {
        "user": session["id"], 
        "title": data.get("title", ""),
        "review": data.get("content", ""),
        "rate": data.get("rating", "0"),
        "pros": data.get("pros", ""),
        "date": datetime.datetime.now().strftime("%Y-%m-%d"),
        "img_path": img_names[0] if img_names else ""
    }

    item_name = data.get("name")   # ★ 반드시 form에서 넘어와야 함

    DB.db.child("review").child(item_name).set(review_info)

    return redirect(url_for("view_review"))

@app.route("/review/<name>/")
def view_review_detail(name):
    review = DB.get_review_byname(name)   # 리뷰 데이터
    item = DB.get_item_byname(name)       # 해당 상품 데이터 가져오기

    return render_template(
        "review_detail.html",
        name=name,
        data=review,
        item=item
    )
    
@app.route("/review", strict_slashes=False)
def view_review():
    # --- 쿼리 파라미터 ---
    page = request.args.get("page", 1, type=int)
    q = request.args.get("q", "").strip()
    sort = request.args.get("sort", "")

    per_page = 15  

    # DB에서 전체 리뷰 가져오기: { item_name: review_info, ... }
    raw = DB.get_reviews() or {}
    items = list(raw.items())   # [(item_name, review_dict), ...]

    # --- 검색 필터링 ---
    filtered = []
    for item_name, rv in items:
        rv = rv or {}
        user = rv.get("user", "")
        title = rv.get("title", "")

        if q:
            q_lower = q.lower()
            # 상품명(item_name), 리뷰 작성자(user), 리뷰 제목(title)에서 검색
            if (
                q_lower not in item_name.lower()
                and q_lower not in user.lower()
                and q_lower not in title.lower()
            ):
                continue

        filtered.append((item_name, rv))

    # --- 정렬 ---
    from datetime import datetime

    def to_datetime_safe(s):
        if not s:
            return datetime.min
        for fmt in ("%Y-%m-%d", "%Y.%m.%d"):
            try:
                return datetime.strptime(s, fmt)
            except ValueError:
                continue
        return datetime.min

    if sort == "star_asc":
        # 별점 낮은 순
        filtered.sort(key=lambda kv: safe_int(kv[1].get("rate")))
    elif sort == "star_desc":
        # 별점 높은 순
        filtered.sort(key=lambda kv: safe_int(kv[1].get("rate")), reverse=True)
    else:
        # 최신순: date 기준 내림차순
        filtered.sort(
            key=lambda kv: to_datetime_safe(kv[1].get("date")),
            reverse=True,
        )

    # --- 페이지네이션 ---
    item_counts = len(filtered)
    page_count = (item_counts + per_page - 1) // per_page or 1

    if page < 1:
        page = 1
    if page > page_count:
        page = page_count

    start_idx = (page - 1) * per_page
    page_items = filtered[start_idx : start_idx + per_page]

    # --- 템플릿에 넘길 데이터 변환 ---
    converted = []
    for key, rv in page_items:
        rv = rv or {}

        converted.append(
            (
                key,  # item_name (리뷰/상품의 이름)
                {
                    "img_path": rv.get("img_path") or "no_image.png",
                    "rate": rv.get("rate") or 0,
                    "review": rv.get("review") or "(리뷰 내용 없음)",
                    "user": rv.get("user") or "ewha_user",
                    "title": rv.get("title") or "제목 없음",
                    "profile_img": rv.get("profile_img") or "fake_profile.png",
                    "pros": rv.get("pros") or "",       # 해시태그
                    "helpful": rv.get("helpful") or 0,
                    "date": rv.get("date") or "2025.01.01",
                },
            )
        )

    return render_template(
        "review.html",
        datas=converted,
        page=page,
        page_count=page_count,
        total=item_counts,
        q=q,
        sort=sort,
    )



@app.route("/api/item/status/<item_name>")
def get_item_status(item_name):
    # 1. Get Item Info (to find the seller)
    item_data = DB.get_item_byname(item_name)
    if not item_data:
        return jsonify({"status": "unknown"})

    # 2. Get Transaction Info (from the NEW separate node)
    trans_data = DB.get_transaction_status(item_name)

    return jsonify({
        "status": trans_data.get("status", "active"), # active / reserved / sold
        "buyer_id": trans_data.get("buyer", None),    # The buyer ID
        "seller": item_data.get("seller")             # Seller ID (from item info)
    })

@app.route("/api/transaction/start", methods=["POST"])
def start_transaction_route():
    if 'id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
        
    data = request.json
    item_name = data.get("item_name")
    buyer_id = data.get("buyer_id")
    
    # Check if I am the seller
    item_data = DB.get_item_byname(item_name)
    if item_data.get("seller") != session['id']:
        return jsonify({"error": "Only seller can start transaction"}), 403

    # 🔥 UPDATE: Save to 'transactions' node
    DB.update_transaction_status(item_name, "reserved", buyer_id)
    
    return jsonify({"status": "success", "new_state": "reserved"})

@app.route("/api/transaction/confirm", methods=["POST"])
def confirm_transaction_route():
    if 'id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    item_name = data.get("item_name")
    
    # Check if I am the assigned buyer
    trans_data = DB.get_transaction_status(item_name)
    if trans_data.get("buyer") != session['id']:
        return jsonify({"error": "Only the assigned buyer can confirm"}), 403

    # 🔥 UPDATE: Save to 'transactions' node
    DB.update_transaction_status(item_name, "sold", session['id'])
    
    return jsonify({"status": "success", "new_state": "sold"})

@app.route("/reg_review_able")
def reg_review_able():
    if "id" not in session:
        flash("로그인 후 이용해주세요.")
        return redirect(url_for("login"))

    buyer_id = session["id"]
    # 현재 로그인한 유저가 구매했고, 아직 리뷰가 없는 상품들
    items_for_review = DB.get_items_for_review(buyer_id)

    return render_template(
        "reg_review_able.html",
        items=items_for_review
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
