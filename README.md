# QualiRoot — AI-powered API Root Cause Analysis Copilot

A two-panel investigation workspace built to the challenge's mandatory stack: React + Redux, Python + FastAPI, LangGraph + Groq, and PostgreSQL (with SQLite fallback for a quick local run).

## What it demonstrates

- Natural-language incident intake from pasted deviation narratives or emails.
- PDF text extraction and AI-assisted form population.
- Conversational edit mode that sends the existing investigation state plus the requested change to the model.
- LangGraph workflow with separate intake and edit nodes.
- Structured 5 Whys, Ishikawa/fishbone categories, potential causes with evidence for/against and confidence, missing evidence, provisional risk rationale, and CAPA suggestions.
- Reviewable/editable fields and save-to-database endpoint.
- No automatic batch disposition, root-cause confirmation, or CAPA approval. QA review remains mandatory.

## Architecture

`React UI → Redux investigation state → FastAPI → LangGraph (intake/edit) → Groq ChatGroq → structured RCA JSON → Redux form state → SQL database on save`

PDFs are parsed with PyMuPDF before being passed into the intake graph. The application only accepts selectable-text PDFs; OCR for scanned documents is not included in this demo.

## Run locally (recommended)

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows PowerShell: .venv\\Scripts\\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env   # Windows; on macOS/Linux use: cp .env.example .env
```

Add your Groq key to `backend/.env`:

```env
GROQ_API_KEY=your_key_here
GROQ_MODEL=llama-3.3-70b-versatile
# Optional. Omit DATABASE_URL for a local SQLite file.
# DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/rca_copilot
```

Run:

```bash
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend (new terminal)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. FastAPI docs: http://localhost:8000/docs.

### 3. PostgreSQL option

Start PostgreSQL and set `DATABASE_URL` in `backend/.env`. A Docker Compose setup is also provided. For Compose, put your Groq key in `backend/.env`, then from the project root run `docker compose up --build`.

## Demo workflow

1. Open the app and click **Load sample API deviation** in the copilot, or paste the content from `sample_docs/sample_deviation_email.txt`.
2. Review the automatically populated incident, 5 Whys, fishbone, risk, evidence gaps and CAPA.
3. In the copilot, send: `The batch number is MFH261104B, not MFH261104A. The equipment ID is DR-205. Preserve all other information.`
4. Upload `sample_docs/sample_api_deviation.pdf` to demonstrate PDF extraction.
5. Edit any AI-generated form fields for QA review and click **Save investigation**.

## API endpoints

- `GET /api/health` — backend and AI configuration status.
- `POST /api/intake` — `{ "text": "...", "current": {} }`.
- `POST /api/edit` — `{ "instruction": "...", "current": { ... } }`.
- `POST /api/extract` — multipart PDF upload (`file`).
- `POST /api/investigations` — save an investigation JSON payload.
- `GET /api/investigations` — list recent saved records.

## Important limitations / quality safeguards

- The Groq API key is required for actual LLM extraction and conversational editing. Without it, intake uses a conservative demo fallback; fallback editing preserves the record and records the requested edit as a note rather than pretending it changed a field.
- AI root causes are hypotheses, not confirmed conclusions. Confidence is not proof. Confirm with batch records, equipment logs, calibration/maintenance history, analytical data, interviews, training records and trend data.
- Risk level is a preliminary screening, not a formal FMEA or final product-impact decision. A qualified Quality Unit must approve investigation scope, batch disposition and CAPA.
- PDF extraction uses embedded text; scanned-image PDFs need OCR before use.
- This is a technical challenge prototype, not a validated GxP / 21 CFR Part 11 system. It does not implement electronic signatures, audit trails, role-based approvals, validated access controls, retention policies or validated infrastructure. Do not use it for live GMP records.

## Research basis

The workflow is informed by ICH Q9(R1) risk-based quality management, ICH Q10 structured investigations and CAPA effectiveness evaluation, and FDA ICH Q7A expectations for API manufacturing records, equipment qualification, internal audits and product quality review. See links in the submission notes or official guidance:
- FDA: https://www.fda.gov/regulatory-information/search-fda-guidance-documents/q9r1-quality-risk-management
- FDA: https://www.fda.gov/regulatory-information/search-fda-guidance-documents/q10-pharmaceutical-quality-system
- FDA: https://www.fda.gov/regulatory-information/search-fda-guidance-documents/q7a-good-manufacturing-practice-guidance-active-pharmaceutical-ingredients
