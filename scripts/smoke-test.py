#!/usr/bin/env python3
"""P4.4 Manual smoke test script — runs against localhost:5117
   Uses only Python stdlib (urllib + http.cookiejar) — no pip dependencies."""
import json, sys, http.cookiejar, urllib.request, urllib.error
from datetime import date

API = "http://localhost:5117"
ok = []
fail = []

# Use a per-run suffix so re-running the script against the same DB
# doesn't fail with "email already exists". Backend enforces 409 on
# duplicate register, but the smoke test is meant to be idempotent.
import os
_RUN_SUFFIX = os.environ.get("SMOKE_RUN_SUFFIX", "01")
U1 = f"p44_user1_{_RUN_SUFFIX}@test.com"
U2 = f"p44_user2_{_RUN_SUFFIX}@test.com"

def check(label, cond, detail=""):
    if cond:
        ok.append(label)
        print(f"  OK  {label}")
    else:
        fail.append(label)
        print(f"  FAIL {label} -- {detail}")

class Session:
    def __init__(self):
        self.cj = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cj))
        self._auth = None

    def _call(self, method, path, json_data=None):
        url = f"{API}{path}"
        h = {}
        if self._auth:
            h["Authorization"] = f"Bearer {self._auth}"
        data = None
        if json_data is not None:
            data = json.dumps(json_data).encode("utf-8")
            h["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=data, headers=h, method=method)
        try:
            resp = self.opener.open(req)
            body = resp.read()
            ct = resp.headers.get("Content-Type", "")
            parsed = json.loads(body) if "json" in ct and body else body
            return resp.status, parsed, resp.headers, body
        except urllib.error.HTTPError as e:
            body = e.read()
            ct = e.headers.get("Content-Type", "") if e.headers else ""
            try:
                parsed = json.loads(body) if body else {}
            except Exception:
                parsed = body.decode(errors="replace") if body else ""
            return e.code, parsed, e.headers or {}, body

    def get(self, path, **kw):
        return self._call("GET", path, **kw)
    def post(self, path, json_data=None, **kw):
        return self._call("POST", path, json_data=json_data, **kw)
    def put(self, path, json_data=None, **kw):
        return self._call("PUT", path, json_data=json_data, **kw)
    def delete(self, path, **kw):
        return self._call("DELETE", path, **kw)
    def set_auth(self, token):
        self._auth = token

s1 = Session()
s2 = Session()

# --- 1. Health ---
print("\n=== HEALTH ===")
status, data, _, _ = s1.get("/health")
check("Health endpoint returns 200", status == 200, f"got {status}")
check("Database is Healthy", data.get("database") == "Healthy", str(data))

# --- 2. Register User1 & User2 ---
print("\n=== REGISTER ===")
status, body, _, _ = s1.post("/api/auth/register", json_data={
    "email": U1, "password": "TestPass123!", "displayName": "P44 User 1"
})
check("User1 register 200", status == 200, f"got {status}")
token1 = body["accessToken"]["token"]

status, body, _, _ = s2.post("/api/auth/register", json_data={
    "email": U2, "password": "TestPass123!", "displayName": "P44 User 2"
})
check("User2 register 200", status == 200, f"got {status}")
token2 = body["accessToken"]["token"]

s1.set_auth(token1)
s2.set_auth(token2)

# --- 3. Auth /me ---
print("\n=== AUTH /me ===")
status, me, _, _ = s1.get("/api/auth/me")
check("/me returns 200", status == 200, f"got {status}")
check("/me shows correct user", me.get("email") == U1, str(me))

# --- 4. Categories ---
print("\n=== CATEGORIES ===")
status, cats, _, _ = s1.get("/api/categories")
sys_cats = [c for c in cats if c["isSystem"]]
check("System categories present (>=12)", len(sys_cats) >= 12, f"got {len(sys_cats)}")

status, cat_body, _, _ = s1.post("/api/categories", json_data={
    "name": "Coffee & Tea", "type": 1, "icon": "coffee", "color": "#6F4E37"
})
check("Create custom category 201", status == 201, f"got {status}")
cat_id = cat_body["id"]

status, _, _, _ = s1.put(f"/api/categories/{cat_id}", json_data={
    "name": "Coffee & Snacks", "type": 1, "icon": "coffee", "color": "#6F4E37"
})
check("Update custom category 200", status == 200, f"got {status}")

sys_id = sys_cats[0]["id"]
status, _, _, _ = s1.put(f"/api/categories/{sys_id}", json_data={"name": "Hacked", "type": 1})
check("Update system category -> 403", status == 403, f"got {status}")

status, _, _, _ = s2.get(f"/api/categories/{cat_id}")
check("Cross-user category access -> 404", status == 404, f"got {status}")

# --- 5. Transactions ---
print("\n=== TRANSACTIONS ===")
salary_cat = [c for c in cats if c["isSystem"] and c["name"] == "Salary"][0]["id"]

status, inc_body, _, _ = s1.post("/api/transactions", json_data={
    "categoryId": salary_cat, "type": 0, "amount": "50000.00",
    "occurredOn": "2026-01-15", "note": "January salary"
})
check("Create income transaction 201", status == 201, f"got {status}")
inc_id = inc_body["id"]

status, exp_body, _, _ = s1.post("/api/transactions", json_data={
    "categoryId": cat_id, "type": 1, "amount": "150.50",
    "occurredOn": "2026-02-10", "note": "Morning coffee"
})
check("Create expense transaction 201", status == 201, f"got {status}")
exp_id = exp_body["id"]

# More transactions across 6 months for chart data (including current month)
today = date.today()
cur_month = f"{today.year}-{today.month:02d}-01"

for month in ["2026-03-01", "2026-04-01", "2026-05-01", cur_month]:
    s1.post("/api/transactions", json_data={
        "categoryId": salary_cat, "type": 0, "amount": "50000",
        "occurredOn": month, "note": f"Income {month}"
    })
for month in ["2026-03-15", "2026-04-15", "2026-05-15", cur_month]:
    s1.post("/api/transactions", json_data={
        "categoryId": cat_id, "type": 1, "amount": "2000",
        "occurredOn": month, "note": f"Expense {month}"
    })

status, page, _, _ = s1.get("/api/transactions?pageSize=20")
check("List transactions 200", status == 200, f"got {status}")
check("Transaction list has items", page.get("totalCount", 0) >= 8, f"got {page.get('totalCount', 0)}")

status, exp_page, _, _ = s1.get("/api/transactions?type=1&pageSize=50")
check("Filter by type=expense works", all(t["type"] == 1 for t in exp_page.get("items", [])))

status, _, _, _ = s1.put(f"/api/transactions/{exp_id}", json_data={
    "categoryId": cat_id, "type": 1, "amount": "175.00",
    "occurredOn": "2026-02-10", "note": "Updated coffee"
})
check("Update transaction 200", status == 200, f"got {status}")

status, _, _, _ = s2.get(f"/api/transactions/{inc_id}")
check("Cross-user transaction access -> 404", status == 404, f"got {status}")

# --- 6. Dashboard ---
print("\n=== DASHBOARD ===")
status, d, _, _ = s1.get("/api/dashboard/summary")
check("Dashboard summary 200", status == 200, f"got {status}")
check("Dashboard has currentMonth", "currentMonth" in d)
check("Dashboard has last6Months (6)", len(d.get("last6Months", [])) == 6, f"got {len(d.get('last6Months', []))}")
check("Dashboard has byCategory", len(d.get("byCategory", [])) >= 1, f"got {len(d.get('byCategory', []))}")
cm = d.get("currentMonth", {})
check("Current month income > 0", cm.get("income", 0) > 0, f"got {cm.get('income')}")
check("Current month expense > 0", cm.get("expense", 0) > 0, f"got {cm.get('expense')}")

status2, _, _, _ = s1.get("/api/dashboard/summary")
check("Dashboard second call also 200 (no race)", status2 == 200, f"got {status2}")

# --- 7. CSV Exports ---
print("\n=== CSV EXPORTS ===")
status, _, headers, raw = s1.get("/api/exports/transactions.csv")
tx_text = raw.decode("utf-8-sig") if isinstance(raw, bytes) else str(raw)
check("Transactions CSV 200", status == 200, f"got {status}")
check("Transactions CSV has BOM", raw[:3] == b'\xef\xbb\xbf', f"first bytes: {raw[:3]}")
check("Transactions CSV has Thai headers", "วันที่" in tx_text)
check("Transactions CSV Content-Type correct", "text/csv" in headers.get("Content-Type", ""))
check("Transactions CSV Content-Disposition attachment", "attachment" in headers.get("Content-Disposition", ""))

status, _, _, raw_sm = s1.get("/api/exports/summary.csv")
sm_text = raw_sm.decode("utf-8-sig") if isinstance(raw_sm, bytes) else str(raw_sm)
check("Summary CSV 200", status == 200, f"got {status}")
check("Summary CSV has BOM", raw_sm[:3] == b'\xef\xbb\xbf')
check("Summary CSV has Thai headers", "เดือน" in sm_text)

status, _, _, raw_csv2 = s2.get("/api/exports/transactions.csv")
csv2_text = raw_csv2.decode("utf-8-sig") if isinstance(raw_csv2, bytes) else str(raw_csv2)
check("Cross-user export has no data (header only)", csv2_text.count("\n") <= 2, f"lines: {csv2_text.count(chr(10))}")

# CSV injection test
status, inj_cat, _, _ = s1.post("/api/categories", json_data={"name": "=CMD test", "type": 1})
status, inj_txn, _, _ = s1.post("/api/transactions", json_data={
    "categoryId": inj_cat["id"], "type": 1, "amount": "10.00",
    "occurredOn": "2026-06-01", "note": "=cmd|/c calc"
})
status, _, _, inj_raw = s1.get("/api/exports/transactions.csv")
inj_text = inj_raw.decode("utf-8-sig") if isinstance(inj_raw, bytes) else str(inj_raw)
check("CSV injection note is prefixed with apostrophe", "'=cmd|/c calc" in inj_text)
s1.delete(f"/api/transactions/{inj_txn['id']}")
s1.delete(f"/api/categories/{inj_cat['id']}")

# --- 8. Logout ---
print("\n=== LOGOUT ===")
status, _, _, _ = s1.post("/api/auth/logout")
check("Logout 204", status == 204, f"got {status}")

# Access token (JWT) is still valid for ~15 min — logout only revokes refresh.
# After refresh cookie is gone, next refresh call fails. Clear token to test.
s1._auth = None
status, _, _, _ = s1.get("/api/auth/me")
check("Me without token -> 401", status == 401, f"got {status}")

# --- 9. Rate Limiting ---
print("\n=== RATE LIMITING ===")
rate_session = Session()
rate_triggered = False
for i in range(8):
    status, _, _, _ = rate_session.post("/api/auth/login", json_data={
        "email": "nonexistent@test.com", "password": "wrong"
    })
    if status == 429:
        check(f"Rate limit triggered on attempt {i+1}", True)
        rate_triggered = True
        break
if not rate_triggered:
    check("Rate limit should trigger within 8 attempts", False, "no 429 received")

# --- 10. Cleanup / isolation ---
print("\n=== CLEANUP ===")
status, _, _, _ = s2.delete(f"/api/transactions/{exp_id}")
check("User2 cannot delete User1 transaction -> 404", status == 404, f"got {status}")

# --- SUMMARY ---
print("\n" + "=" * 60)
total = len(ok) + len(fail)
print(f"RESULTS: {len(ok)}/{total} passed, {len(fail)} failed")
if fail:
    print("\nFAILED CHECKS:")
    for f_name in fail:
        print(f"  FAIL  {f_name}")
    sys.exit(1)
else:
    print("ALL SMOKE TESTS PASSED")
    sys.exit(0)
