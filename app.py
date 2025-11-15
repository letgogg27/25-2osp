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
from werkzeug.utils import secure_filename
import sys
import datetime

app = Flask(__name__, template_folder="templates", static_folder="static")
app.secret_key = "some-secret"

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
    return render_template(
        "list.html",
        products=PRODUCTS[start:end],
        page=page,
        total_pages=total_pages,
    )


# 홈 = 리스트
@app.route("/", strict_slashes=False)
def home():
    return redirect(url_for("view_list"))


@app.route("/list", strict_slashes=False)
def view_list():
    page = request.args.get("page", 1, type=int)

    per_page = 15  # 한 페이지당 아이템 수

    data = DB.get_items() or {}  # DB에서 아이템 읽기
    items = list(data.items())  # dict -> 리스트로 변환 (순회/슬라이스 용)
    item_counts = len(items)  # 전체 상품 개수

    # 전체 페이지 수 (올림)
    page_count = (item_counts + per_page - 1) // per_page

    if page < 1:
        page = 1
    if page > page_count:
        page = page_count

    start_idx = (page - 1) * per_page
    end_idx = start_idx + per_page
    page_items = items[start_idx:end_idx]

    return render_template(
        "list.html",
        datas=page_items,  # 템플릿에서 for key,value in datas
        limit=per_page,
        page=page,
        page_count=page_count,
        total=item_counts,
    )


@app.route("/review", methods=["GET"], strict_slashes=False)
def review():
    page = request.args.get("page", 1, type=int)
    page_count = 1
    return render_template("review.html", page=page, page_count=page_count)


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


# -------------------------------
# 상품 등록 처리 (여러 장 업로드)
# -------------------------------
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
            filename = secure_filename(f.filename)
            save_path = os.path.join(image_dir, filename)
            f.save(save_path)
            filenames.append(filename)

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

    # DBhandler.insert_item이 기대하는 키(seller, addr, price, status...) 기준으로 매핑
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


@app.route("/item_detail", strict_slashes=False)
def item_detail():
    return render_template("item_detail.html")


@app.route("/dynamicurl/<varible_name>/")
def DynamicUrl(varible_name):
    return str(varible_name)


@app.route("/view_detail/<name>/")
def view_item_detail(name):
    data = DB.get_item_byname(str(name))
    return render_template("item_detail.html", name=name, data=data)


@app.route("/api/chat/link_inbox/<item_name>", methods=['POST'])
def link_chat_to_inbox(item_name):
    """
    Called by JS *after* a message is sent.
    Links chat to sender (if new)
    Links chat to receiver (if new) AND increments receiver's unread count.
    """
    if 'id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        data = request.json
        other_user_id = data.get('other_user_id') #  the RECEIVER
        current_user_id = session['id']           #  the SENDER

        if not other_user_id:
            return jsonify({"error": "Missing other_user_id"}), 400

        user_ids = sorted([current_user_id, other_user_id])
        conversation_id = f"{user_ids[0]}_{user_ids[1]}_{item_name}"
        
        # Link to Sender's Inbox 
        DB.link_user_to_conversation(
            user_id=current_user_id, 
            conversation_id=conversation_id, 
            item_name=item_name, 
            other_user_id=other_user_id,
            is_new_message_for_this_user=False 
        )
        # Link to Receiver's Inbox
        DB.link_user_to_conversation(
            user_id=other_user_id, 
            conversation_id=conversation_id, 
            item_name=item_name, 
            other_user_id=current_user_id,
            is_new_message_for_this_user=True #  a new msg for the receiver
        )
        
        return jsonify({"status": "success", "message": "Inbox linked/incremented"})

    except Exception as e:
        print(f"⚠️ Error linking inbox: {e}")
        return jsonify({"error": "Failed to link inbox"}), 500

@app.route("/api/chat/clear_unread", methods=['POST'])
def clear_unread():
    """
    Called by JS when a chat is opened.
    Sets the unread_count for that chat to 0.
    """
    if 'id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        data = request.json
        conversation_id = data.get('conversation_id')
        current_user_id = session['id']

        if not conversation_id:
            return jsonify({"error": "Missing conversation_id"}), 400

        DB.clear_unread_count(current_user_id, conversation_id)
        return jsonify({"status": "success", "message": "Count cleared"})

    except Exception as e:
        print(f"⚠️ Error clearing count: {e}")
        return jsonify({"error": "Failed to clear count"}), 500
    
@app.route("/my_messages")
def my_messages():
    if 'id' not in session:
        flash("Please log in first.")
        return redirect(url_for('login'))
    
    return render_template("my_messages.html")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
