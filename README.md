# QualiRoot – AI-Powered Root Cause Analysis

<p align="center">
  <strong>Intelligent Investigation. Evidence-Based Decisions.</strong>
</p>

<p align="center">
  An AI-powered Root Cause Analysis (RCA) application designed for pharmaceutical API manufacturing.
</p>

---

## About the Project

**QualiRoot** is an AI-powered Root Cause Analysis application that helps pharmaceutical manufacturing teams investigate production incidents and quality deviations through an intelligent, structured workflow.

Traditional root cause investigations can involve significant manual effort in reviewing incident descriptions, identifying potential causes, gathering evidence and preparing corrective and preventive actions.

QualiRoot simplifies this process by combining Large Language Models (LLMs), LangGraph and a modern web application.

Users can provide incident information through text or PDF documents. The AI processes the information, extracts relevant details and automatically populates the investigation form.

The application assists users with:

- Incident information extraction.
- Automated RCA form population.
- Five Whys analysis.
- Fishbone (Ishikawa) analysis.
- Potential root cause identification.
- Missing evidence identification.
- Investigation recommendations.
- Corrective and Preventive Actions (CAPA).
- Human review and editing.
- Investigation storage and retrieval.

**Important:** QualiRoot is an investigation assistance tool. AI-generated findings and recommendations require human review and appropriate Quality Assurance approval.

---

## Key Features

### 1. AI-Powered Incident Intake
- Accept incident descriptions through text input.
- Extract information from uploaded PDF documents.
- Identify relevant manufacturing and incident details.
- Automatically populate RCA investigation fields.

### 2. Five Whys Analysis
- Generates a structured Five Whys investigation.
- Connects successive why questions and answers.
- Helps investigate underlying causes.

### 3. Fishbone Analysis
Organizes potential causes into six categories:

| Category | Investigation Area |
|---|---|
| Man | Personnel and training |
| Machine | Equipment and machinery |
| Method | Procedures and processes |
| Material | Raw materials and components |
| Measurement | Instruments and measurements |
| Environment | Environmental conditions |

### 4. Potential Root Cause Analysis
- Identifies potential root causes.
- Evaluates supporting and contradicting evidence.
- Provides confidence assessments.
- Suggests verification activities.

### 5. Missing Evidence Identification
Identifies additional records and information required to strengthen the investigation.

### 6. CAPA Recommendations
Generates corrective and preventive action recommendations, including:
- Action descriptions.
- CAPA classification.
- Rationale.
- Linked potential root causes.
- Responsible owners.
- Suggested completion timelines.
- Effectiveness checks.

### 7. Human Review and Editing
Users can review, modify and refine AI-generated investigation information before saving it.

### 8. Investigation Management
- Save investigations.
- Retrieve previously saved investigations.
- Update existing investigation records.
- Maintain persistent investigation data using PostgreSQL.

---

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React 18 |
| State Management | Redux |
| Build Tool | Vite |
| Styling | CSS |
| Backend | Python |
| API Framework | FastAPI |
| AI Workflow | LangGraph |
| Large Language Model | Groq |
| Database | PostgreSQL |
| Document Processing | PDF Text Extraction |
| API Testing | FastAPI Swagger UI |
| Containerization | Docker |

---

## System Architecture

```text
              USER
                |
                v
       REACT FRONTEND
                |
          REDUX STORE
                |
                v
        FASTAPI BACKEND
                |
        +-------+-------+
        |               |
        v               v
   TEXT INPUT       PDF EXTRACTION
        |               |
        +-------+-------+
                |
                v
        LANGGRAPH WORKFLOW
                |
                v
          GROQ LLM
                |
                v
       STRUCTURED AI OUTPUT
                |
        +-------+-------+
        |               |
        v               v
    RCA ANALYSIS     CAPA
        |               |
        +-------+-------+
                |
                v
       FRONTEND FORM
       POPULATION
                |
                v
        HUMAN REVIEW
                |
                v
          POSTGRESQL
```

---

## Project Structure

```text
QualiRoot/
│
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── graph.py
│   │   ├── database.py
│   │   └── schemas.py
│   │
│   ├── migrate_sqlite_to_postgres.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── store.js
│   │   └── style.css
│   │
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js
│   └── Dockerfile
│
├── sample_docs/
│   ├── sample_api_deviation.pdf
│   └── sample_api_deviation_email.txt
│
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## Installation and Setup

### Prerequisites

Install the following:

- Python 3.10 or later.
- Node.js and npm.
- PostgreSQL.
- Git.
- Groq API key.

### 1. Clone the Repository

```bash
git clone https://github.com/Ravi7907/QualiRoot.git
```

```bash
cd QualiRoot
```

### 2. Backend Setup

Navigate to the backend directory:

```bash
cd backend
```

Create a virtual environment:

```bash
python -m venv .venv
```

Activate it on Windows:

```powershell
.venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Create a `.env` file inside the `backend` directory.

Add your configuration:

```env
GROQ_API_KEY=your_groq_api_key
DATABASE_URL=postgresql://username:password@localhost:5432/quali_root
```

Replace the placeholder values with your own credentials.

**Security:** Never commit your `.env` file or expose API keys and database passwords.

### 4. Database Setup

Create a PostgreSQL database named:

```sql
CREATE DATABASE quali_root;
```

Ensure PostgreSQL is running and the database connection details in `.env` are correct.

### 5. Start the Backend

From the `backend` directory, execute:

```bash
uvicorn app.main:app --reload --port 8000
```

Backend:

```text
http://localhost:8000
```

API documentation:

```text
http://localhost:8000/docs
```

### 6. Frontend Setup

Open another terminal and navigate to the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Frontend:

```text
http://localhost:5173
```

---

## Application Workflow

1. User enters a pharmaceutical manufacturing incident description or uploads a PDF.
2. FastAPI receives the input.
3. PDF content is extracted when a document is uploaded.
4. LangGraph orchestrates the AI investigation workflow.
5. Groq processes the incident information.
6. Structured investigation results are generated.
7. React and Redux update the RCA form with AI-generated information.
8. The user reviews and edits the generated findings.
9. The investigation is saved to PostgreSQL.
10. Previously saved investigations can be retrieved and updated.

---

## Example Investigation Scenario

**Incident:** Post-Use Filter Integrity Test Failure

| Field | Details |
|---|---|
| Incident ID | DEV-2026-084 |
| Product | Caffeine API |
| Batch | CAF261108D |
| Process | Final Filtration |
| Equipment | Filter Assembly FA-207 |
| Incident Date | 08-Nov-2026 |
| Test Result | 18 kPa pressure decay |
| Acceptance Limit | ≤10 kPa |

The application assists with identifying potential causes, such as filter membrane damage, incorrect assembly, sealing failure and instrument measurement issues.

It also identifies missing evidence, recommends verification activities and generates CAPA recommendations.

All potential causes remain subject to evidence-based verification.

---

## Future Enhancements

- Email-based incident intake.
- Advanced document processing.
- Improved investigation analytics and reporting.
- Export investigation reports as PDF.
- Role-based access control.
- Enhanced audit trail.
- Investigation dashboards.
- Advanced evidence traceability.

---

## Project Objective

The objective of QualiRoot is to demonstrate how Artificial Intelligence and workflow orchestration can support structured root cause investigations in pharmaceutical manufacturing.

By combining AI-assisted information extraction, investigation methodologies and persistent data management, QualiRoot aims to reduce manual investigation effort and improve the consistency of RCA documentation.

---

## Author

**Ravi Sabhahith**

GitHub: https://github.com/Ravi7907

---

<p align="center">
  <strong>QualiRoot – Insurance Simplified? No. Investigation Simplified.</strong>
</p>