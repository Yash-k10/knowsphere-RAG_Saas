import pytest
import uuid

@pytest.mark.asyncio
async def test_register_and_login(async_client):
    unique_suffix = str(uuid.uuid4())[:8]
    email = f"alice_{unique_suffix}@example.com"
    password = "StrongPassword123!"

    # 1. Register
    reg_res = await async_client.post("/api/auth/register", json={
        "name": "Alice Developer",
        "email": email,
        "password": password,
        "organization_name": f"Acme Corp {unique_suffix}"
    })
    assert reg_res.status_code == 201, reg_res.text
    data = reg_res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

    # 2. Duplicate registration should be rejected
    dup_res = await async_client.post("/api/auth/register", json={
        "name": "Alice Clone",
        "email": email,
        "password": password
    })
    assert dup_res.status_code == 400

    # 3. Login with correct password
    login_res = await async_client.post("/api/auth/login", data={
        "username": email,
        "password": password
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]

    # 4. Login with wrong password should fail
    bad_login = await async_client.post("/api/auth/login", data={
        "username": email,
        "password": "WrongPassword!"
    })
    assert bad_login.status_code == 401

    # 5. Access protected /me route
    headers = {"Authorization": f"Bearer {token}"}
    me_res = await async_client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["user"]["email"] == email
    assert len(me_data["workspaces"]) >= 1
    assert me_data["workspaces"][0]["role"] == "OWNER"
