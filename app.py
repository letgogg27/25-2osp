from flask import Flask, render_template, request

app = Flask(__name__, template_folder="templates", static_folder="static")

# 더미 상품 (이미지 파일은 static/images/ 에 저장)
PRODUCTS = [
    {"id": 1,  "name": "이화 로고 자수 반팔 티셔츠", "price": 19900,  "img": "tshirt.png",  "cat": "의류"},
    {"id": 2,  "name": "이화 반다나",               "price": 14900,  "img": "bandana.png", "cat": "잡화"},
    {"id": 3,  "name": "이화 피그먼트 캡",          "price": 24900,  "img": "hat.png",     "cat": "잡화"},
    {"id": 4,  "name": "진공 청소기",               "price": 99999,  "img": "vacuum.png",  "cat": "가전"},
    {"id": 5,  "name": "이화 PP 포스트잇",          "price": 4000,   "img": "postit.png",  "cat": "문구"},
    {"id": 6,  "name": "텀블러",                    "price": 19000,  "img": "tumbler.png", "cat": "생활"},
    {"id": 7,  "name": "이화 로고 자수 반팔 티(그린)", "price": 19900,  "img": "tshirt.png",  "cat": "의류"},
    {"id": 8,  "name": "이화 반다나(블랙)",          "price": 14900,  "img": "bandana.png", "cat": "잡화"},
    {"id": 9,  "name": "이화 피그먼트 캡(블루)",     "price": 25900,  "img": "hat.png",     "cat": "잡화"},
    {"id": 10, "name": "진공 청소기 Pro",           "price": 129000, "img": "vacuum.png",  "cat": "가전"},
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
    return render_list()

# /list 로 접근해도 동일
@app.route("/list", strict_slashes=False)
def product_list():
    return render_list()

@app.route("/review", methods=['GET','POST'], strict_slashes=False)
def review():
    return render_template("review.html")


@app.route("/register_items", methods=['GET','POST'], strict_slashes=False)
def register_items():
    return render_template('reg_items.html')

@app.route("/register_reviews", methods=['GET','POST'], strict_slashes=False)
def register_reviews():
    return render_template('reg_reviews.html')

@app.route("/login")
def login():
    return render_template("login.html")

@app.route("/submit_item_post", methods=['POST'], strict_slashes=False)
def reg_item_submit_post():
    image_file = request.files['file']
    image_file.save("static/images/{}".format(image_file.filename))
    data = request.form
    return render_template('submit_item_result.html', data = data, img_path = "static/images/{}".format(image_file.filename))

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
