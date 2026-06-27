#!/usr/bin/env python3
"""Seed a dedicated Lighthouse user with 6 months of transactions.
Output: writes lh-user.txt with email / password / token / userId."""
import json, http.cookiejar, os, sys, urllib.request, datetime

API = "http://localhost:5117"
SUFFIX = os.environ.get("SMOKE_RUN_SUFFIX", "lhtest")
EMAIL = f"lh_user_{SUFFIX}@test.com"
PASSWORD = "TestPass123!"


def post(op, path, body, token=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(
        f"{API}{path}",
        data=json.dumps(body).encode(),
        headers=h,
        method="POST",
    )
    return json.loads(op.open(req).read())


def get(op, path, token=None):
    h = {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{API}{path}", headers=h)
    return json.loads(op.open(req).read())


# Register
cj = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
auth = post(op, "/api/auth/register", {
    "email": EMAIL, "password": PASSWORD, "displayName": "LH User"
})
token = auth["accessToken"]["token"]
user_id = auth["user"]["id"]
print(f"Registered {EMAIL} userId={user_id}")

# Fetch categories
cats = get(op, "/api/categories", token=token)
food = next(c["id"] for c in cats if c["name"] == "Food")
salary = next(c["id"] for c in cats if c["name"] == "Salary")
print(f"Found Food={food} Salary={salary}")

# Seed 6 months of income + expense
today = datetime.date.today()
months = []
y, m = today.year, today.month
for _ in range(6):
    months.append((y, m))
    m -= 1
    if m == 0:
        m = 12
        y -= 1
months.reverse()  # oldest first

count = 0
for i, (yy, mm) in enumerate(months):
    income_amt = 50000 + i * 2000
    expense_amt = 3000 + i * 500
    occ = f"{yy}-{mm:02d}-15"
    post(op, "/api/transactions", {
        "categoryId": salary, "type": 0,
        "amount": str(income_amt), "occurredOn": occ,
        "note": f"Income {occ}",
    }, token=token)
    post(op, "/api/transactions", {
        "categoryId": food, "type": 1,
        "amount": str(expense_amt), "occurredOn": occ,
        "note": f"Expense {occ}",
    }, token=token)
    count += 2

# Add some variety in the current month so the byCategory chart has more entries
post(op, "/api/transactions", {
    "categoryId": next(c["id"] for c in cats if c["name"] == "Bills"),
    "type": 1, "amount": "1500", "occurredOn": today.strftime("%Y-%m-%d"),
    "note": "Internet bill",
}, token=token)
post(op, "/api/transactions", {
    "categoryId": next(c["id"] for c in cats if c["name"] == "Transport"),
    "type": 1, "amount": "800", "occurredOn": today.strftime("%Y-%m-%d"),
    "note": "BTS",
}, token=token)
count += 2

# Save credentials for Lighthouse puppeteer login
with open("lh-user.txt", "w", encoding="utf-8") as f:
    f.write(f"{EMAIL}\n{PASSWORD}\n{token}\n{user_id}\n")

print(f"Seeded {count} transactions across 6 months. Credentials in lh-user.txt")
