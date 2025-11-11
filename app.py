from flask import Flask, render_template, request, url_for, redirect, flash, session
import hashlib
from database import DBhandler
import sys

from flask import abort

app = Flask(__name__, template_folder="templates", static_folder="static")
app.secret_key="some-secret"

DB=DBhandler()

# 더미 상품 (이미지 파일은 static/images/ 에 저장)
PRODUCTS = [
    {"id": 1,  "name": "이화 로고 자수 반팔 티셔츠", "price": 19900,  "img": "tshirt.png",  "cat": "의류", "location": "서울특별시 서대문구"},
    {"id": 2,  "name": "이화 반다나",               "price": 14900,  "img": "bandana.png", "cat": "잡화", "location": "서울특별시 마포구"},
    {"id": 3,  "name": "이화 피그먼트 캡",          "price": 24900,  "img": "hat.png",     "cat": "잡화", "location": "서울특별시 은평구"},
    {"id": 4,  "name": "진공 청소기",               "price": 99999,  "img": "vacuum.png",  "cat": "가전", "location": "서울특별시 종로구"},
    {"id": 5,  "name": "이화 PP 포스트잇",          "price": 4000,   "img": "postit.png",  "cat": "문구", "location": "서울특별시 종로구"},
    {"id": 6,  "name": "텀블러",                    "price": 19000,  "img": "tumbler.png", "cat": "생활", "location": "서울특별시 종로구"},
    {"id": 7,  "name": "이화 로고 자수 반팔 티(그린)", "price": 19900,  "img": "tshirt.png",  "cat": "의류", "location": "서울특별시 종로구"},
    {"id": 8,  "name": "이화 반다나(블랙)",          "price": 14900,  "img": "bandana.png", "cat": "잡화", "location": "서울특별시 종로구"},
    {"id": 9,  "name": "이화 피그먼트 캡(블루)",     "price": 25900,  "img": "hat.png",     "cat": "잡화", "location": "서울특별시 종로구"},
    {"id": 10, "name": "진공 청소기 Pro",           "price": 129000, "img": "vacuum.png",  "cat": "가전", "location": "서울특별시 종로구"},
]

PAGE_SIZE = 8

def render_list():
    page = int(request.args.get("page", 1))
    start = (page - 1) * PAGE_SIZE
    end   = start + PAGE_SIZE
    total_pages = (len(PRODUCTS) + PAGE_SIZE - 1) // PAGE_SIZE
    return render_template(
        "list.html",
        products=PRODUCTS[start:end],
        page=page,
        total_pages=total_pages
    )

# 홈 = 리스트
@app.route("/", strict_slashes=False)
def home():
    #return render_list()
    return redirect(url_for('view_list'))

@app.route("/list", strict_slashes=False)
def view_list():
    page = request.args.get("page", 1,type=int)

    per_page = 18  # 한 페이지당 아이템 수

    data = DB.get_items() or {}  # DB에서 아이템 읽기
    items = list(data.items())   # dict -> 리스트로 변환 (순회/슬라이스 용)
    item_counts = len(items)     # 전체 상품 개수

    # 전체 페이지 수 (올림)
    page_count = (item_counts + per_page - 1) // per_page

    if page < 1:
        page = 1
    if page > page_count:
        page = page_count

    start_idx = (page - 1) * per_page
    end_idx   = start_idx + per_page
    page_items = items[start_idx:end_idx]

    return render_template(
        "list.html",
        datas=page_items,       # 템플릿에서 for key,value in datas
        limit=per_page,
        page=page,
        page_count=page_count,
        total=item_counts
    )

@app.route("/review", methods=['GET'], strict_slashes=False)
def review():
    page = request.args.get("page", 1, type=int)
    page_count = 1 
    return render_template(
        "review.html",
        page=page,
        page_count=page_count
    )

@app.route("/register_items", methods=['GET','POST'], strict_slashes=False)
def register_items():
    if 'id' not in session:
        flash("로그인을 해주세요!")
        return redirect(url_for('login'))
    return render_template('reg_items.html')

@app.route("/register_reviews", methods=['GET','POST'], strict_slashes=False)
def register_reviews():
    if 'id' not in session:
        flash("로그인을 해주세요!")
        return redirect(url_for('login'))
    return render_template('reg_reviews.html')

@app.route("/login")
def login():
    return render_template("login.html")

@app.route("/login_confirm", methods=['POST'])
def login_user():
    id_=request.form['id']
    pw=request.form['pw']
    pw_hash=hashlib.sha256(pw.encode('utf-8')).hexdigest()
    if DB.find_user(id_,pw_hash):
        session['id']=id_
        return redirect(url_for('home'))
    else:
        flash("잘못된 아이디 혹은 비밀번호 입니다!")
        return render_template("login.html")
def find_user(self, id_, pw_):
    users = self.db.child("user").get()
    target_value=[]
    for res in users.each():
        value = res.val()
        if value['id'] == id_ and value['pw'] == pw_:
            return True
    return False

@app.route("/logout")
def logout_user():
    session.clear()
    return redirect(url_for('home'))

@app.route("/signup")
def signup():
    return render_template("signup.html")

# 회원가입 처리
@app.route("/signup_post", methods=['POST'])
def register_user():
    form = request.form
    user_id = (form.get('userID') or '').strip()      # 폼 name과 맞춤
    pw      = form.get('password') or ''
    pw2     = form.get('passwordConfirm') or ''

    if not user_id or not pw:
        flash("아이디/비밀번호를 입력하세요.")
        return redirect(url_for("signup"))
    if pw != pw2:
        flash("비밀번호가 일치하지 않습니다.")
        return redirect(url_for("signup"))

    pw_hash = hashlib.sha256(pw.encode('utf-8')).hexdigest()

    if DB.insert_user(form, pw_hash):
        flash("회원가입이 완료되었습니다. 로그인 해주세요.")
        return redirect(url_for("login"))
    else:
        flash("이미 존재하는 아이디입니다.")
        return redirect(url_for("signup"))

@app.route("/submit_item_post", methods=['POST'], strict_slashes=False)
def reg_item_submit_post():
    image_file = request.files['file']
    image_file.save("static/images/{}".format(image_file.filename))
    data = request.form
    DB.insert_item(data['name'], data, image_file.filename)
    return render_template('submit_item_result.html', data = data, img_path = "static/images/{}".format(image_file.filename))

# just to check item_detait.html page

@app.route("/item_detail", strict_slashes=False)
def item_detail():
    return render_template("item_detail.html")
    
@app.route("/dynamicurl/<varible_name>/")
def DynamicUrl(varible_name):
    return str(varible_name)

@app.route("/view_detail/<name>/")
def view_item_detail(name):
    print("###name:",name)
    data = DB.get_item_byname(str(name))
    print("####data:",data)
    return render_template("item_detail.html", name=name, data=data)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
    
