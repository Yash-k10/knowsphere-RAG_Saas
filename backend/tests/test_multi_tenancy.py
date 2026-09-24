import pytest
import uuid
import io
from app.db.database import AsyncSessionLocal
from app.models.chunk import DocumentChunk
from app.models.document import Document, DocumentStatus
from app.services.retrieval_service import RetrievalService
from app.services.embedding_service import embedding_service

@pytest.mark.asyncio
async def test_strict_cross_tenant_isolation(async_client):
    """
    CRITICAL SECURITY & PORTFOLIO TEST:
    Verifies that Tenant A cannot access, retrieve, view, or delete
    any documents, chunks, or conversations belonging to Tenant B.
    """
    uid_a = str(uuid.uuid4())[:8]
    uid_b = str(uuid.uuid4())[:8]

    # 1. Register Tenant A (ABC Technologies)
    res_a = await async_client.post("/api/auth/register", json={
        "name": "Alice TenantA",
        "email": f"alice_{uid_a}@abctech.com",
        "password": "Password123!",
        "organization_name": f"ABC Technologies {uid_a}"
    })
    assert res_a.status_code == 201
    token_a = res_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Fetch Tenant A info
    curr_a = await async_client.get("/api/tenants/current", headers=headers_a)
    assert curr_a.status_code == 200
    tenant_a_id = curr_a.json()["id"]

    # 2. Register Tenant B (XYZ Enterprises)
    res_b = await async_client.post("/api/auth/register", json={
        "name": "Bob TenantB",
        "email": f"bob_{uid_b}@xyzent.com",
        "password": "Password123!",
        "organization_name": f"XYZ Enterprises {uid_b}"
    })
    assert res_b.status_code == 201
    token_b = res_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    curr_b = await async_client.get("/api/tenants/current", headers=headers_b)
    assert curr_b.status_code == 200
    tenant_b_id = curr_b.json()["id"]

    assert tenant_a_id != tenant_b_id

    # 3. Tenant A uploads a private document
    file_content_a = b"ABC Confidential: The annual paid leave entitlement is 24 days."
    upload_res_a = await async_client.post(
        "/api/documents/upload",
        headers=headers_a,
        files={"file": ("abc_leave_policy.txt", io.BytesIO(file_content_a), "text/plain")}
    )
    assert upload_res_a.status_code == 201
    doc_a_id = upload_res_a.json()["id"]

    # 4. Tenant B uploads a private document
    file_content_b = b"XYZ Secret: The executive performance bonus pool is 5 million dollars."
    upload_res_b = await async_client.post(
        "/api/documents/upload",
        headers=headers_b,
        files={"file": ("xyz_bonus_plan.txt", io.BytesIO(file_content_b), "text/plain")}
    )
    assert upload_res_b.status_code == 201
    doc_b_id = upload_res_b.json()["id"]

    # 5. TEST: Tenant A listing MUST NOT contain Tenant B's document
    list_a = await async_client.get("/api/documents", headers=headers_a)
    assert list_a.status_code == 200
    docs_a_ids = [d["id"] for d in list_a.json()]
    assert doc_a_id in docs_a_ids
    assert doc_b_id not in docs_a_ids

    # 6. TEST: Tenant A direct ID access to Tenant B document MUST BE REJECTED (404)
    direct_res = await async_client.get(f"/api/documents/{doc_b_id}", headers=headers_a)
    assert direct_res.status_code == 404, "Tenant A was able to access Tenant B's document ID directly!"

    # 7. TEST: Tenant A DELETE request to Tenant B document MUST BE REJECTED (404)
    del_res = await async_client.delete(f"/api/documents/{doc_b_id}", headers=headers_a)
    assert del_res.status_code == 404, "Tenant A was able to delete Tenant B's document!"

    # 8. TEST: Vector Search Isolation:
    # Directly insert READY chunks with embeddings for Tenant A and Tenant B
    emb_a = embedding_service.embed_text("Annual leave entitlement for ABC employees is 24 days.")
    emb_b = embedding_service.embed_text("Executive bonus pool for XYZ is 5 million dollars.")

    async with AsyncSessionLocal() as db:
        # Mark both docs READY for search test
        doc_a_rec = await db.get(Document, uuid.UUID(doc_a_id))
        doc_a_rec.processing_status = DocumentStatus.READY
        doc_b_rec = await db.get(Document, uuid.UUID(doc_b_id))
        doc_b_rec.processing_status = DocumentStatus.READY

        chunk_a = DocumentChunk(
            tenant_id=uuid.UUID(tenant_a_id),
            document_id=uuid.UUID(doc_a_id),
            chunk_index=0,
            content="Annual leave entitlement for ABC employees is 24 days.",
            embedding=emb_a,
            embedding_json=emb_a
        )
        chunk_b = DocumentChunk(
            tenant_id=uuid.UUID(tenant_b_id),
            document_id=uuid.UUID(doc_b_id),
            chunk_index=0,
            content="Executive bonus pool for XYZ is 5 million dollars.",
            embedding=emb_b,
            embedding_json=emb_b
        )
        db.add_all([chunk_a, chunk_b])
        await db.commit()

        # Query Tenant A with a question specifically targeting Tenant B's secret
        query_vec = embedding_service.embed_query("What is the executive bonus pool?")
        retrieved_for_a = await RetrievalService.search_similar_chunks(
            db=db,
            tenant_id=uuid.UUID(tenant_a_id),
            query_embedding=query_vec,
            top_k=5,
            similarity_threshold=0.10
        )

        # Tenant A must NEVER receive chunk B
        for chunk in retrieved_for_a:
            assert str(chunk.document_id) != doc_b_id, "CROSS-TENANT LEAK: Tenant A retrieved Tenant B's chunk!"
            assert "XYZ Secret" not in chunk.content
            assert "bonus pool" not in chunk.content

    # 9. TEST: Conversation Isolation:
    # Create conversation in Tenant B
    chat_b_res = await async_client.post(
        "/api/chat",
        headers=headers_b,
        json={"message": "What is our company bonus?"}
    )
    assert chat_b_res.status_code == 200
    conv_b_id = chat_b_res.json()["conversation_id"]

    # Tenant A attempts to view Tenant B's conversation -> MUST BE 404
    conv_leak_res = await async_client.get(f"/api/conversations/{conv_b_id}", headers=headers_a)
    assert conv_leak_res.status_code == 404, "Tenant A accessed Tenant B's conversation!"
