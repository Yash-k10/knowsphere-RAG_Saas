import os
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import get_password_hash
from app.core.config import settings
from app.models.user import User
from app.models.tenant import Tenant, TenantMember, TenantRole
from app.models.document import Document, DocumentStatus
from app.models.chunk import DocumentChunk
from app.services.chunking_service import ChunkingService
from app.services.embedding_service import embedding_service

logger = logging.getLogger(__name__)

DEMO_ACCOUNTS = [
    {
        "company_name": "Acme Cloud Technologies",
        "slug": "acme-cloud",
        "join_code": "ACME-DEMO",
        "user_name": "Sarah Connor",
        "role_title": "Head of Engineering (Admin)",
        "email": "demo.acme@knowsphere.io",
        "password": "Password123!",
        "industry": "Cloud Infrastructure & SaaS",
        "accent_color": "emerald",
        "doc_filename": "Acme_Cloud_Employee_Handbook_2026.txt",
        "sample_question": "What is the annual paid vacation allowance and rollover policy?",
        "doc_content": (
            "Acme Cloud Technologies - Employee Operations & Handbook 2026\n\n"
            "Section 1: Annual Leave & Paid Time Off (PTO)\n"
            "All full-time permanent employees at Acme Cloud Technologies are entitled to 25 days of annual paid vacation, "
            "10 sick leaves, and 12 designated company holidays per calendar year. "
            "Vacation days accrue monthly. Up to 8 unused vacation days may be carried over into Q1 of the following year, "
            "expiring on March 31st if not utilized. Leave requests exceeding 3 consecutive business days require manager approval "
            "at least two weeks in advance.\n\n"
            "Section 2: Remote Work, Home Office & Equipment Stipends\n"
            "Acme Cloud operates on a remote-first hybrid work philosophy. "
            "Each new engineer and product team member receives a one-time $1,500 home office ergonomics setup stipend, "
            "along with an ongoing $100 per month high-speed internet reimbursement. "
            "Company-issued MacBooks and security hardware tokens must have FileVault and MDM security policies enabled at all times.\n\n"
            "Section 3: Health Insurance & Wellness Coverage\n"
            "Acme Cloud covers 100% of employee healthcare, dental, and vision insurance premiums across all standard tiers, "
            "and subsidizes 75% of dependent health premiums. "
            "Employees also receive an annual $600 mental wellness and gym subscription allowance, reimbursable through Expensify.\n\n"
            "Section 4: Performance Bonuses & Equity Vesting\n"
            "Performance cycles are evaluated semi-annually in June and December. "
            "Annual performance bonuses range from 15% to 25% of base salary depending on individual OKR attainment and "
            "overall company Annual Recurring Revenue (ARR) milestones. Standard employee equity grants follow a 4-year vesting schedule "
            "with a 1-year cliff."
        )
    },
    {
        "company_name": "BioNova Health Sciences",
        "slug": "bionova-health",
        "join_code": "BION-DEMO",
        "user_name": "Dr. Marcus Vance",
        "role_title": "Chief Compliance Officer (Admin)",
        "email": "demo.apex@knowsphere.io",
        "password": "Password123!",
        "industry": "Biotech & Clinical Compliance",
        "accent_color": "teal",
        "doc_filename": "BioNova_Clinical_Compliance_Protocol.txt",
        "sample_question": "What is the required timeline for reporting a Serious Adverse Event (SAE)?",
        "doc_content": (
            "BioNova Health Sciences - Clinical Trial Compliance & Data Security Protocol 2026\n\n"
            "Section 1: Good Clinical Practice (GCP) & FDA 21 CFR Part 11 Compliance\n"
            "All BioNova clinical trial phases (Phase I through Phase IV) strictly enforce international GCP guidelines "
            "and FDA 21 CFR Part 11 standards for electronic source records, audit trails, and electronic signatures. "
            "All investigators and clinical trial coordinators must recertify their GCP credentials every 24 months.\n\n"
            "Section 2: Protected Health Information (PHI) & Double-Blind Data Encryption\n"
            "Patient identifiable information (PII) and Protected Health Information (PHI) must remain completely isolated "
            "behind zero-trust cryptographic boundaries. Patient identifiers are pseudonymized with salted SHA-256 hashes. "
            "Under BioNova strict HIPAA governance, patient data must be encrypted with AES-256 both in transit and at rest, "
            "and raw patient master keys never leave the secure hardware enclave.\n\n"
            "Section 3: Serious Adverse Event (SAE) Notification Timeline\n"
            "Any Serious Adverse Event (SAE) observed during therapeutic trials must be documented within the Electronic Data "
            "Capture (EDC) system within 24 hours of site discovery. The Lead Clinical Investigator must formally submit a validated "
            "SAE report to the Institutional Review Board (IRB) and the Data Safety Monitoring Board (DSMB) within 7 calendar days. "
            "Life-threatening events or fatalities require immediate notification within 48 hours to regulatory authorities.\n\n"
            "Section 4: Clinical Data Retention & Immutable Audit Logs\n"
            "All clinical database snapshots, investigator agreements, and drug dispensation logs must maintain cryptographic checksums "
            "and must be retained in immutable cold storage for a mandatory statutory period of not less than 10 years following study closure."
        )
    }
]

async def seed_demo_accounts(db: AsyncSession) -> None:
    """
    Idempotently seeds two enterprise demo tenants, users, documents, and vector embeddings.
    Allows interviewers to immediately evaluate multi-tenant RAG isolation without manual registration.
    """
    try:
        for item in DEMO_ACCOUNTS:
            email_clean = item["email"].lower().strip()
            # 1. Ensure User
            user_stmt = select(User).where(User.email == email_clean)
            res_user = await db.execute(user_stmt)
            user = res_user.scalar_one_or_none()

            if not user:
                user = User(
                    name=item["user_name"],
                    email=email_clean,
                    password_hash=get_password_hash(item["password"]),
                    is_active=True
                )
                db.add(user)
                await db.flush()
                logger.info(f"Seeded demo user: {user.email}")
            else:
                # Ensure password hash is valid
                user.password_hash = get_password_hash(item["password"])
                user.is_active = True
                await db.flush()

            # 2. Ensure Tenant
            tenant_stmt = select(Tenant).where(Tenant.slug == item["slug"])
            res_tenant = await db.execute(tenant_stmt)
            tenant = res_tenant.scalar_one_or_none()

            if not tenant:
                tenant = Tenant(
                    name=item["company_name"],
                    slug=item["slug"],
                    join_code=item["join_code"]
                )
                db.add(tenant)
                await db.flush()
                logger.info(f"Seeded demo tenant: {tenant.name}")

            # 3. Ensure Membership
            mem_stmt = select(TenantMember).where(
                TenantMember.tenant_id == tenant.id,
                TenantMember.user_id == user.id
            )
            res_mem = await db.execute(mem_stmt)
            member = res_mem.scalar_one_or_none()

            if not member:
                member = TenantMember(
                    tenant_id=tenant.id,
                    user_id=user.id,
                    role=TenantRole.OWNER
                )
                db.add(member)
                await db.flush()

            # 4. Ensure Document & Chunks
            doc_stmt = select(Document).where(
                Document.tenant_id == tenant.id,
                Document.filename == item["doc_filename"]
            )
            res_doc = await db.execute(doc_stmt)
            doc = res_doc.scalar_one_or_none()

            if not doc:
                tenant_dir = settings.UPLOAD_DIR / str(tenant.id)
                os.makedirs(tenant_dir, exist_ok=True)
                file_path = tenant_dir / item["doc_filename"]

                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(item["doc_content"])

                doc = Document(
                    tenant_id=tenant.id,
                    uploaded_by=user.id,
                    filename=item["doc_filename"],
                    file_type="TXT",
                    file_size=len(item["doc_content"].encode("utf-8")),
                    file_path=str(file_path),
                    processing_status=DocumentStatus.READY,
                    total_chunks=0
                )
                db.add(doc)
                await db.flush()

                # Chunk and embed
                chunker = ChunkingService()
                pages = [{"page_number": 1, "text": item["doc_content"]}]
                chunks = chunker.chunk_extracted_pages(pages)

                if chunks:
                    chunk_texts = [c.content for c in chunks]
                    embeddings = embedding_service.embed_documents(chunk_texts)
                    db_chunks = []
                    for chunk_item, emb in zip(chunks, embeddings):
                        db_chunks.append(
                            DocumentChunk(
                                tenant_id=tenant.id,
                                document_id=doc.id,
                                chunk_index=chunk_item.chunk_index,
                                content=chunk_item.content,
                                page_number=chunk_item.page_number,
                                char_count=chunk_item.char_count,
                                embedding=emb,
                                embedding_json=emb
                            )
                        )
                    db.add_all(db_chunks)
                    doc.total_chunks = len(chunks)
                    logger.info(f"Seeded document & {len(chunks)} chunks for {tenant.name}")

        await db.commit()
        logger.info("Demo accounts & documents verified/seeded successfully.")
    except Exception as e:
        logger.error(f"Error seeding demo accounts: {e}", exc_info=True)
        await db.rollback()
