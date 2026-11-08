import fitz, os
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .schemas import IntakeRequest, EditRequest
from .graph import rca_graph
from .database import (
    init_db,
    save_investigation,
    list_investigations,
    get_investigation,
    update_investigation
)

load_dotenv()
app = FastAPI(title="API RCA Copilot", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
@app.on_event("startup")
def startup(): init_db()
@app.get("/api/health")
def health(): return {"status":"ok", "ai_configured":bool(os.getenv("GROQ_API_KEY"))}
@app.post("/api/intake")
def intake(body: IntakeRequest):
    if not body.text.strip(): raise HTTPException(400,"Provide incident text")
    return rca_graph.invoke({"mode":"intake","text":body.text,"current":body.current or {}})["result"]
@app.post("/api/edit")
def edit(body: EditRequest):
    if not body.instruction.strip(): raise HTTPException(400,"Provide an edit instruction")
    return rca_graph.invoke({"mode":"edit","instruction":body.instruction,"current":body.current})["result"]
@app.post("/api/extract")
async def extract(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"): raise HTTPException(400,"Only PDF files are supported")
    data=await file.read()
    if len(data)>12*1024*1024: raise HTTPException(413,"PDF must be smaller than 12 MB")
    try:
        doc=fitz.open(stream=data,filetype="pdf")
        extracted="\n".join(page.get_text() for page in doc)
    except Exception as e: raise HTTPException(400,f"Could not read PDF: {e}")
    if not extracted.strip(): raise HTTPException(422,"No selectable text found. OCR is not enabled in this demo.")
    return rca_graph.invoke({"mode":"intake","text":extracted})["result"]
@app.post("/api/investigations")
def save(payload: dict):
    try:
        return {
            "id": save_investigation(payload),
            "message": "Investigation saved"
        }
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/api/investigations")
def get_saved():
    try:
        return list_investigations()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/investigations/{investigation_id}")
def get_saved_investigation(investigation_id: int):
    result = get_investigation(investigation_id)

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Investigation not found"
        )

    return result
@app.put("/api/investigations/{investigation_id}")
def update_saved_investigation(
    investigation_id: int,
    payload: dict
):
    try:
        updated = update_investigation(
            investigation_id,
            payload
        )

        if not updated:
            raise HTTPException(
                status_code=404,
                detail="Investigation not found"
            )

        return {
            "id": investigation_id,
            "message": "Investigation updated successfully"
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))