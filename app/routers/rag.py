from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.schemas import IngestRequest, IngestResponse
from app.services.rag import ingest_documents

router = APIRouter(prefix="/v1/rag", tags=["rag"])


@router.post("/ingest", response_model=IngestResponse, status_code=201)
async def ingest(body: IngestRequest, db: AsyncSession = Depends(get_db)):
    doc_ids = await ingest_documents(db, body.source, body.items)
    return IngestResponse(ingested_count=len(doc_ids), document_ids=doc_ids)
