import uuid
import re
import logging
from dataclasses import dataclass
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.embedding_service import embedding_service
from app.services.retrieval_service import RetrievalService, RetrievedChunk
from app.services.llm.factory import get_llm_provider
from app.schemas.chat import SourceCitation

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are KnowSphere, an intelligent enterprise AI assistant powered by Google Gemini.\n"
    "Your objective is to provide comprehensive, clear, and helpful answers to the user's questions.\n\n"
    "Guidelines:\n"
    "1. Knowledge Base Grounding: When context excerpts from the organization's knowledge base are provided, use them as your primary source of truth.\n"
    "2. Logical Comparisons: When asked to compare, contrast, or analyze two or more concepts that appear in the knowledge base, synthesize the information from the relevant sections into a structured comparison (e.g. definitions, key differences, use cases), even if the original documents did not explicitly compare them side-by-side.\n"
    "3. Typo Resilience: Understand user intent even with spelling mistakes, grammatical errors, or incomplete queries.\n"
    "4. Formatting: Keep explanations clean, natural, and well-structured using paragraphs and simple bullet points. Do NOT use awkward triple asterisks (***) or in-text citations like '[Document: ...]'; the UI displays sources separately.\n"
    "5. Continuity: If prior conversation history is present, seamlessly answer follow-ups in context."
)

# Common technical, grammatical, and domain typos & abbreviations map
TYPO_CORRECTIONS: dict[str, str] = {
    # Comparison keywords
    "comapre": "compare",
    "compair": "compare",
    "compere": "compare",
    "copmare": "compare",
    "comparision": "comparison",
    "diffrence": "difference",
    "diference": "difference",
    "differnce": "difference",
    "diffrnce": "difference",
    "diff": "difference",
    "btwn": "between",
    "betwen": "between",
    "contrst": "contrast",
    "distingush": "distinguish",
    "versas": "versus",
    # Common tech & workspace terms
    "machne": "machine",
    "machin": "machine",
    "learnin": "learning",
    "lerning": "learning",
    "artific": "artificial",
    "artifcl": "artificial",
    "inteligenc": "intelligence",
    "intellegence": "intelligence",
    "archtecture": "architecture",
    "architechture": "architecture",
    "databse": "database",
    "db": "database",
    "postgres": "postgresql",
    "postgre": "postgresql",
    "postgress": "postgresql",
    "mongoodb": "mongodb",
    "sqllite": "sqlite",
    "pythn": "python",
    "jva": "java",
    "anguler": "angular",
    "reat": "react",
    "documnt": "document",
    "documnts": "documents",
    "reimbrsmnt": "reimbursement",
    "reimbursemnt": "reimbursement",
    "polcy": "policy",
    "polic": "policy",
    "servce": "service",
    "servcs": "services",
    "leav": "leave",
    "implmentation": "implementation",
    "implemntation": "implementation",
    "authentcation": "authentication",
    "authoriztion": "authorization",
    "aplication": "application",
    "configration": "configuration",
}

def normalize_query(text: str) -> str:
    """Corrects common misspellings, typos, and abbreviations to improve semantic embedding matching."""
    if not text:
        return ""
    words = re.split(r"(\s+|[?!.,;:/()]+)", text)
    cleaned = []
    for w in words:
        low = w.lower()
        if low in TYPO_CORRECTIONS:
            # Preserve capitalization if the word was capitalized
            replacement = TYPO_CORRECTIONS[low]
            cleaned.append(replacement.capitalize() if w.istitle() else replacement)
        else:
            cleaned.append(w)
    return "".join(cleaned)

def extract_comparison_entities(query: str) -> list[str]:
    """
    Robustly detects comparison intents even with typos or varying phrasings:
    - 'comapre X and Y', 'compare X with Y', 'comparison between X and Y'
    - 'diffrence between X and Y', 'diff between X and Y'
    - 'X vs Y', 'X versus Y', 'X v/s Y'
    - 'how does X differ from Y', 'how does X compare to Y'
    - 'which is better: X or Y', 'is X better than Y'
    - 'contrast X and Y'
    """
    q = query.strip()
    patterns = [
        # compare / comparison / contrast
        r"(?:compare|comapre|compair|compere|copmare|comparison|comparision|contrast|contrst)\s+(?:between\s+|of\s+)?(.+?)\s+(?:and|with|to|vs\.?|versus|v/s)\s+(.+)",
        # difference / differences / diff
        r"(?:difference|differences|diffrence|diference|differnce|diffrnce|diff)\s+(?:between|in|of)\s+(.+?)\s+and\s+(.+)",
        # X vs Y, X versus Y, X v/s Y
        r"(.+?)\s+(?:vs\.?|versus|v/s)\s+(.+)",
        # how does X differ/compare from/to Y
        r"how\s+does\s+(.+?)\s+(?:differ|compare)\s+(?:from|to|with)\s+(.+)",
        # which is better: X or Y / is X better than Y
        r"(?:which\s+is\s+better|what\s+is\s+better|better)\s*[:,\-]?\s*(.+?)\s+(?:or|vs\.?|versus|and)\s+(.+)",
        r"(?:is\s+)?(.+?)\s+better\s+than\s+(.+)",
        # X or Y which is better / X or Y
        r"(.+?)\s+or\s+(.+?)(?:,\s*which\s+is\s+better|\s*\?|$)",
    ]

    clean_strip = re.compile(r"^(?:the|a|an|what\s+is|tell\s+me\s+about|explain)\s+", re.IGNORECASE)
    clean_punct = re.compile(r"[\?!\.,;:\"]+$")

    for p in patterns:
        m = re.search(p, q, re.IGNORECASE)
        if m:
            e1 = m.group(1).strip()
            e2 = m.group(2).strip()
            e1 = clean_punct.sub("", e1).strip()
            e2 = clean_punct.sub("", e2).strip()
            e1 = clean_strip.sub("", e1).strip()
            e2 = clean_strip.sub("", e2).strip()
            # Remove trailing question phrases from e2
            e2 = re.sub(
                r"(?:,\s*)?(?:which\s+is\s+better|what\s+is\s+the\s+difference|in\s+our\s+docs?)$",
                "",
                e2,
                flags=re.IGNORECASE
            ).strip()
            if len(e1) >= 2 and len(e2) >= 2 and e1.lower() != e2.lower():
                return [e1, e2]
    return []

@dataclass
class RAGResult:
    answer: str
    sources: list[SourceCitation]

class RAGService:
    @staticmethod
    async def answer_query(
        db: AsyncSession,
        tenant_id: uuid.UUID,
        query: str,
        history: list[dict] | None = None
    ) -> RAGResult:
        """
        Executes robust RAG workflow:
        1. Normalizes query against typos, misspellings, and abbreviations.
        2. Detects comparison queries and performs independent retrieval for each entity,
           enabling accurate synthesis even if the entities appear in different sections/documents.
        3. Employs adaptive retrieval thresholds so typo-heavy queries are not prematurely discarded.
        4. If the topic is not found in the knowledge base, answers using General AI Knowledge
           and prominently displays the official disclaimer note.
        5. Grounded synthesis handles disconnected topics, partial context, and follow-ups.
        """
        normalized_q = normalize_query(query)
        logger.info(f"Processing query: '{query}' (Normalized: '{normalized_q}') for tenant {tenant_id}")

        # Step 1: Primary vector retrieval with original query
        query_embedding = embedding_service.embed_query(query)
        relevant_chunks: list[RetrievedChunk] = await RetrievalService.search_similar_chunks(
            db=db,
            tenant_id=tenant_id,
            query_embedding=query_embedding,
            similarity_threshold=0.40
        )

        seen_ids = {c.chunk_id for c in relevant_chunks}

        # Step 1b: If query had typos or normalization changed the query, retrieve with normalized embedding
        if normalized_q.lower() != query.lower():
            norm_embedding = embedding_service.embed_query(normalized_q)
            norm_chunks = await RetrievalService.search_similar_chunks(
                db=db,
                tenant_id=tenant_id,
                query_embedding=norm_embedding,
                similarity_threshold=0.35
            )
            for nc in norm_chunks:
                if nc.chunk_id not in seen_ids:
                    relevant_chunks.append(nc)
                    seen_ids.add(nc.chunk_id)

        # Step 2: Multi-entity comparison retrieval enhancement
        # Detect comparison entities from both raw query and normalized query
        sub_entities = extract_comparison_entities(query) or extract_comparison_entities(normalized_q)
        if sub_entities:
            logger.info(f"Comparison query detected for entities: {sub_entities}")
            for entity in sub_entities:
                # Embed both raw entity and normalized entity to catch typos in entity names
                e_clean = normalize_query(entity)
                search_terms = {entity}
                if e_clean:
                    search_terms.add(e_clean)

                for st in search_terms:
                    entity_emb = embedding_service.embed_query(st)
                    extra_chunks = await RetrievalService.search_similar_chunks(
                        db=db,
                        tenant_id=tenant_id,
                        query_embedding=entity_emb,
                        top_k=4,
                        similarity_threshold=0.32
                    )
                    for ec in extra_chunks:
                        if ec.chunk_id not in seen_ids:
                            relevant_chunks.append(ec)
                            seen_ids.add(ec.chunk_id)

        # Step 2b: Fallback adaptive search with relaxed threshold if initial retrieval is empty
        # This handles cases where severe typos or short incomplete words lowered cosine similarity
        if not relevant_chunks:
            logger.info("Initial retrieval returned 0 chunks. Attempting relaxed threshold retrieval (0.30)...")
            relaxed_chunks = await RetrievalService.search_similar_chunks(
                db=db,
                tenant_id=tenant_id,
                query_embedding=query_embedding,
                similarity_threshold=0.30
            )
            for rc in relaxed_chunks:
                if rc.chunk_id not in seen_ids:
                    relevant_chunks.append(rc)
                    seen_ids.add(rc.chunk_id)

            if not relevant_chunks and normalized_q.lower() != query.lower():
                norm_embedding = embedding_service.embed_query(normalized_q)
                relaxed_norm_chunks = await RetrievalService.search_similar_chunks(
                    db=db,
                    tenant_id=tenant_id,
                    query_embedding=norm_embedding,
                    similarity_threshold=0.30
                )
                for rnc in relaxed_norm_chunks:
                    if rnc.chunk_id not in seen_ids:
                        relevant_chunks.append(rnc)
                        seen_ids.add(rnc.chunk_id)

        # Format recent conversation history if provided
        history_text = ""
        if history and len(history) > 0:
            history_lines = []
            for item in history[-4:]:
                sender = "User" if item.get("role") == "user" else "Assistant"
                msg_snippet = item.get("content", "").strip()[:500]
                history_lines.append(f"{sender}: {msg_snippet}")
            if history_lines:
                history_text = "PRIOR CONVERSATION HISTORY:\n" + "\n".join(history_lines) + "\n\n"

        # Step 3: Out-of-Knowledge-Base handling (Answer via General AI Knowledge)
        # If no chunks were found across strict, normalized, and relaxed searches:
        if not relevant_chunks:
            logger.info(f"No chunks found for tenant {tenant_id}. Answering with General AI Knowledge disclaimer.")
            general_prompt = (
                f"{history_text}"
                f"The following question was asked by a user, but it is NOT found in their organization's uploaded knowledge base documents.\n\n"
                f"USER QUESTION: {query}\n\n"
                f"INSTRUCTIONS:\n"
                f"1. You MUST begin your response with this exact note on the very first line:\n"
                f"> **Note:** *This topic was not found in your organization's knowledge base. The following answer is generated using general AI knowledge.*\n\n"
                f"2. Provide a clear, comprehensive, and accurate answer to directly help the user with their question.\n"
                f"3. Do not refuse, apologize, or say you cannot answer. Answer completely using general AI knowledge."
            )
            llm = get_llm_provider()
            answer = await llm.generate_answer(prompt=general_prompt, system_prompt=SYSTEM_PROMPT)
            return RAGResult(
                answer=answer,
                sources=[]
            )

        # Step 4: Build grounded prompt
        context_parts = []
        sources: list[SourceCitation] = []
        for chunk in relevant_chunks:
            page_info = f" (Page {chunk.page_number})" if chunk.page_number else ""
            context_parts.append(
                f"[Document: {chunk.document_name}{page_info}]\n{chunk.content}"
            )
            sources.append(SourceCitation(
                document_id=str(chunk.document_id),
                document_name=chunk.document_name,
                page=chunk.page_number,
                similarity=chunk.similarity,
                snippet=chunk.content[:220] + ("..." if len(chunk.content) > 220 else "")
            ))

        formatted_context = "\n\n---\n\n".join(context_parts)

        # Dynamic comparison instructions if entities were detected
        comparison_instructions = ""
        if sub_entities:
            comparison_instructions = (
                f"COMPARISON DIRECTIVE for entities {sub_entities}:\n"
                f"- The user is asking to compare, contrast, or analyze differences between these concepts.\n"
                f"- Even if the source documents discuss them in separate sections or different files and NEVER explicitly compare them side-by-side, you MUST synthesize the facts for each entity from the excerpts into a structured, side-by-side comparison (definitions, key differences, features, use cases).\n"
                f"- Do NOT state that the documents do not compare them if the concepts are present. Synthesize the comparison from the provided facts.\n"
                f"- If one concept is present in the context excerpts and the other is NOT mentioned: state what is known about the present concept from the knowledge base, explain the missing concept using general AI knowledge, and prepend with:\n"
                f"  > **Note:** Information regarding {sub_entities[0]} is retrieved from your organization's knowledge base, while details for {sub_entities[1]} are generated using general AI knowledge as it was not found in the documents.\n\n"
            )

        prompt = (
            f"CONTEXT FROM ORGANIZATION KNOWLEDGE BASE:\n"
            f"-----------------------------------------\n"
            f"{formatted_context}\n"
            f"-----------------------------------------\n\n"
            f"{history_text}"
            f"USER QUESTION: {query}\n\n"
            f"INSTRUCTIONS:\n"
            f"1. Primary Source of Truth: When the provided context excerpts contain the answer, base your response directly on the facts in the context.\n"
            f"{comparison_instructions}"
            f"2. Out-of-Knowledge-Base Handling:\n"
            f"   - If the provided context excerpts do NOT contain the necessary information to answer the question (i.e. the question is out of scope or the excerpts are irrelevant), DO NOT refuse or say you don't know.\n"
            f"   - Answer the question helpfully using general AI knowledge, and start your response with this exact note on the first line:\n"
            f"     > **Note:** *This topic was not found in your organization's knowledge base. The following answer is generated using general AI knowledge.*\n"
            f"3. Typo Resilience: Understand user intent naturally even with spelling mistakes, grammatical errors, or incomplete queries (e.g. 'comapre pythn and jva' -> compare Python and Java). Answer smoothly without pointing out the user's typos.\n"
            f"4. Formatting: Keep explanations clean, natural, and well-structured using paragraphs and simple bullet points. Do not include awkward citation tags like '[Document: ...]'; sources are displayed separately in the UI.\n\n"
            f"ANSWER:"
        )

        # Step 5: Send context to LLM Provider
        llm = get_llm_provider()
        answer = await llm.generate_answer(prompt=prompt, system_prompt=SYSTEM_PROMPT)

        return RAGResult(
            answer=answer,
            sources=sources
        )
