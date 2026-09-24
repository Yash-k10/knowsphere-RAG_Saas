"""
KnowSphere — End-to-End Multi-Tenant Demonstration Script
=========================================================
Demonstrates Section 29 Acceptance Criteria:
1. Tenant A ("ABC Technologies") registers and uploads Employee Handbook
2. Tenant A asks "What is the annual paid leave entitlement?" -> Receives answer + source citation
3. Tenant B ("XYZ Technologies") registers and uploads Bonus Plan
4. Security Test: Tenant A attempts to access Tenant B's document ID directly -> Rejected (404)
5. Security Test: Tenant A asks a question about Tenant B's confidential bonus -> Tenant B chunks are NOT retrieved!
"""

import sys
import time
import requests

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000/api"

def print_step(title):
    print(f"\n{'='*70}\n[STEP] {title}\n{'='*70}")

def run_demo():
    print("Starting KnowSphere Multi-Tenant Verification...")

    # 1. Register Tenant A
    print_step("1. Registering Tenant A (ABC Technologies)")
    uid_a = str(int(time.time()))
    res_a = requests.post(f"{BASE_URL}/auth/register", json={
        "name": "Alice Lead",
        "email": f"alice_{uid_a}@abctech.com",
        "password": "Password123!",
        "organization_name": "ABC Technologies"
    })
    assert res_a.status_code == 201, f"Failed to register Tenant A: {res_a.text}"
    token_a = res_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    tenant_a = requests.get(f"{BASE_URL}/tenants/current", headers=headers_a).json()
    print(f"[OK] Tenant A Created: {tenant_a['name']} (ID: {tenant_a['id']})")

    # 2. Register Tenant B
    print_step("2. Registering Tenant B (XYZ Technologies)")
    uid_b = str(int(time.time())) + "_b"
    res_b = requests.post(f"{BASE_URL}/auth/register", json={
        "name": "Bob Executive",
        "email": f"bob_{uid_b}@xyztech.com",
        "password": "Password123!",
        "organization_name": "XYZ Technologies"
    })
    assert res_b.status_code == 201, f"Failed to register Tenant B: {res_b.text}"
    token_b = res_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}
    tenant_b = requests.get(f"{BASE_URL}/tenants/current", headers=headers_b).json()
    print(f"[OK] Tenant B Created: {tenant_b['name']} (ID: {tenant_b['id']})")

    # 3. Tenant A uploads Leave Policy
    print_step("3. Tenant A Uploads Private Document (ABC_Leave_Policy.txt)")
    doc_a_text = (
        "ABC Technologies Global Leave Policy:\n"
        "All permanent employees are entitled to 24 annual paid leaves per calendar year.\n"
        "Leaves must be approved at least 7 days in advance by the department manager.\n"
        "Unused leaves up to 10 days can be carried forward to the following year."
    )
    up_a = requests.post(
        f"{BASE_URL}/documents/upload",
        headers=headers_a,
        files={"file": ("ABC_Leave_Policy.txt", doc_a_text.encode("utf-8"), "text/plain")}
    )
    assert up_a.status_code == 201, up_a.text
    doc_a_id = up_a.json()["id"]
    print(f"[OK] Uploaded Document A (ID: {doc_a_id}). Waiting for ingestion...")
    time.sleep(2)  # Wait for background ingestion

    # 4. Tenant B uploads Confidential Bonus Plan
    print_step("4. Tenant B Uploads Private Document (XYZ_Bonus_Plan.txt)")
    doc_b_text = (
        "XYZ Technologies Top Secret Executive Bonus Plan:\n"
        "The executive compensation pool for Q4 is set strictly at 5,000,000 USD.\n"
        "Eligible executives must achieve a minimum 120% target fulfillment."
    )
    up_b = requests.post(
        f"{BASE_URL}/documents/upload",
        headers=headers_b,
        files={"file": ("XYZ_Bonus_Plan.txt", doc_b_text.encode("utf-8"), "text/plain")}
    )
    assert up_b.status_code == 201, up_b.text
    doc_b_id = up_b.json()["id"]
    print(f"[OK] Uploaded Document B (ID: {doc_b_id}). Waiting for ingestion...")
    time.sleep(2)

    # 5. Cross-Tenant Direct ID Security Test
    print_step("5. SECURITY TEST: Tenant A attempts to access Tenant B's Document directly")
    leak_attempt = requests.get(f"{BASE_URL}/documents/{doc_b_id}", headers=headers_a)
    print(f"Status Code returned: {leak_attempt.status_code} (Expected: 404)")
    assert leak_attempt.status_code == 404, "SECURITY BREACH: Tenant A accessed Tenant B document directly!"
    print("[OK] PASS: Cross-tenant direct access was strictly rejected with 404 Not Found.")

    # 6. Tenant A asks question about their own document
    print_step("6. Tenant A asks: 'What is the annual paid leave entitlement?'")
    chat_a = requests.post(
        f"{BASE_URL}/chat",
        headers=headers_a,
        json={"message": "What is the annual paid leave entitlement?"}
    )
    assert chat_a.status_code == 200, chat_a.text
    chat_a_data = chat_a.json()
    print("AI Response:\n", chat_a_data["answer"])
    print("\nSources Cited:")
    for s in chat_a_data["sources"]:
        print(f" - [{s['document_name']}] match: {int(s['similarity']*100)}% | '{s['snippet'][:80]}...'")
    assert any("ABC_Leave_Policy" in s["document_name"] for s in chat_a_data["sources"]), "Source missing!"
    print("[OK] PASS: Relevant chunks retrieved and cited for Tenant A.")

    # 7. Cross-Tenant RAG Vector Search Isolation Test
    print_step("7. SECURITY TEST: Tenant A asks question about Tenant B's confidential bonus pool")
    chat_leak = requests.post(
        f"{BASE_URL}/chat",
        headers=headers_a,
        json={"message": "What is the executive bonus pool compensation in USD?"}
    )
    assert chat_leak.status_code == 200, chat_leak.text
    leak_data = chat_leak.json()
    print("AI Response to Tenant A:\n", leak_data["answer"])
    print("Sources retrieved for Tenant A:", leak_data["sources"])

    # Verify no chunks from Tenant B were retrieved
    for s in leak_data["sources"]:
        assert "XYZ_Bonus_Plan" not in s["document_name"], "CROSS-TENANT VECTOR LEAK: Tenant A retrieved Tenant B chunks!"
    assert "couldn't find relevant information" in leak_data["answer"].lower(), "Expected safe fallback for unrelated question!"
    print("[OK] PASS: Tenant A RAG search returned zero chunks from Tenant B and safe fallback!")

    print("\n" + "="*70)
    print(">>> ALL ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY! <<<")
    print("="*70)

if __name__ == "__main__":
    run_demo()
