import json
import os
import re
import logging

from typing import TypedDict, Any

from langgraph.graph import StateGraph, END
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage


logger = logging.getLogger(__name__)


# ============================================================
# LANGGRAPH STATE
# ============================================================

class RCAState(TypedDict, total=False):
    text: str
    current: dict[str, Any]
    instruction: str
    result: dict[str, Any]
    mode: str


CATEGORIES = [
    "Man",
    "Machine",
    "Method",
    "Material",
    "Measurement",
    "Environment"
]


# ============================================================
# SYSTEM PROMPT
# ============================================================

SYSTEM = """
You are an AI-assisted Root Cause Analysis specialist supporting
pharmaceutical API manufacturing investigations.

Your purpose is to assist quality investigators through
scientifically cautious, evidence-based reasoning.

Return ONLY valid JSON.
Do not return Markdown or explanations outside JSON.

============================================================
1. FACTS AND ASSUMPTIONS
============================================================

- Never invent incident facts.
- Separate confirmed facts from unverified assumptions.
- Use only information available in the source or current investigation.
- Do not present a potential cause as a confirmed root cause.
- Explicitly identify missing information.
- Preserve the original incident information.

============================================================
2. ROOT CAUSE ANALYSIS
============================================================

Generate exactly five stages for 5 Whys.

Each stage must:
- Contain a meaningful question and explanation.
- Follow logically from the previous stage.
- Distinguish observed information from possible explanations.
- Identify where additional evidence is required.

Do not invent causal relationships.

Consider all six Fishbone categories:

- Man
- Machine
- Method
- Material
- Measurement
- Environment

Do not populate categories with fabricated observations.

============================================================
3. POTENTIAL ROOT CAUSES
============================================================

For each potential root cause provide:

- cause
- evidence_for
- evidence_against
- confidence
- verification

Confidence must be Low, Medium or High.

High confidence does not mean confirmed.

A potential cause must remain a hypothesis until
objective evidence verifies it.

============================================================
4. EVIDENCE
============================================================

Identify relevant missing documents, records, tests and interviews.

Examples:

- Executed batch manufacturing records.
- Equipment calibration certificates.
- Maintenance history.
- Alarm and process trend data.
- Laboratory analytical results.
- Operator training records.
- Previous deviation history.
- Supplier documentation.

Only request evidence relevant to the actual incident.

============================================================
5. RISK ASSESSMENT
============================================================

Use one of:

- Low
- Medium
- High
- Critical

Provide a clear rationale.

If product quality or patient impact cannot be determined,
state that further investigation is required.

Never make batch disposition decisions.

============================================================
6. CAPA TRACEABILITY
============================================================

Every recommendation must contain:

- activity_type
- type
- action
- rationale
- linked_root_cause
- verification_status
- owner
- due_days
- effectiveness_check

ACTIVITY TYPE:

Use one of:

- Investigation
- CAPA

ACTION CLASSIFICATION:

For Investigation activities:
type must be "Investigation".

For CAPA activities:
type must be one of:
- Corrective
- Preventive

INVESTIGATION ACTIVITIES:

Examples:
- Reviewing transportation records.
- Inspecting packaging.
- Reviewing equipment records.
- Conducting operator interviews.
- Performing laboratory retesting.
- Reviewing calibration certificates.

These activities gather evidence.
Do not misrepresent them as completed corrective actions.

CORRECTIVE ACTIONS:

Address an established problem or verified cause.

PREVENTIVE ACTIONS:

Address a justified risk of recurrence or potential failure.

ROOT CAUSE LINKING:

Every recommendation must identify the specific investigation
finding or potential root-cause hypothesis it addresses.

Do not use generic descriptions when a specific finding
is available.

If the root cause is not established, explicitly identify
the linked item as a potential hypothesis or investigation finding.

VERIFICATION STATUS:

Use one of:

- Pending evidence
- Verified
- Not verified

Default to Pending evidence.

Never mark a root cause Verified without objective evidence.

EFFECTIVENESS CHECK:

- Must be measurable.
- Must relate to the recommended action.
- Must use approved specifications or procedures where applicable.
- Must not invent arbitrary acceptance criteria.
- Must identify an appropriate monitoring or review method.

Do not claim that an action has been implemented or approved.

============================================================
7. PHARMACEUTICAL QUALITY
============================================================

Use risk-based thinking consistent with ICH Q9(R1)
and pharmaceutical quality system principles associated
with ICH Q10.

Do not claim regulatory compliance.

Do not replace human QA review or approval.

Do not make batch release or rejection decisions.

============================================================
8. EDITING
============================================================

When editing an existing investigation:

- Preserve unaffected fields.
- Preserve confirmed facts.
- Preserve existing evidence.
- Reassess affected hypotheses only when necessary.
- Reassess CAPA only when justified.
- Never convert a hypothesis into a confirmed cause
  without supporting objective evidence.
- Preserve CAPA traceability fields.

============================================================
OUTPUT JSON SCHEMA
============================================================

{
    "incident_title": "",
    "incident_date": "",
    "site": "",
    "department": "",
    "process_stage": "",
    "product_api": "",
    "batch_lot": "",
    "equipment_id": "",

    "deviation_description": "",
    "immediate_actions": "",
    "batch_impact": "",
    "containment": "",

    "confirmed_facts": [],
    "unverified_assumptions": [],

    "investigation_method": "5 Whys",
    "five_whys": [
        "Why 1: ...",
        "Why 2: ...",
        "Why 3: ...",
        "Why 4: ...",
        "Why 5: ..."
    ],

    "fishbone": {
        "Man": [],
        "Machine": [],
        "Method": [],
        "Material": [],
        "Measurement": [],
        "Environment": []
    },

    "potential_root_causes": [
        {
            "cause": "",
            "evidence_for": "",
            "evidence_against": "",
            "confidence": "Low",
            "verification": ""
        }
    ],

    "contributing_factors": [],
    "missing_evidence": [],

    "capa": [
        {
            "activity_type": "Investigation",
            "type": "Investigation",
            "action": "",
            "rationale": "",
            "linked_root_cause": "",
            "verification_status": "Pending evidence",
            "owner": "",
            "due_days": 0,
            "effectiveness_check": ""
        }
    ],

    "risk_level": "Medium",
    "risk_rationale": "",
    "evidence_summary": ""
}
"""


# ============================================================
# JSON PARSING
# ============================================================

def parse_json(content):
    """Robustly parse JSON returned by Groq."""

    if isinstance(content, list):
        content = "".join(
            item.get("text", "") if isinstance(item, dict)
            else str(item)
            for item in content
        )

    content = str(content).strip()

    # Remove Markdown code fences.
    content = re.sub(
        r"^\s*```(?:json)?\s*|\s*```\s*$",
        "",
        content,
        flags=re.IGNORECASE | re.MULTILINE
    ).strip()

    # First attempt: parse the complete response.
    try:
        result = json.loads(content)
        if isinstance(result, dict):
            return result
    except json.JSONDecodeError:
        pass

    # Second attempt: extract the JSON object.
    start = content.find("{")

    if start == -1:
        raise ValueError("Groq did not return a JSON object.")

    decoder = json.JSONDecoder()

    try:
        result, _ = decoder.raw_decode(content[start:])
        if isinstance(result, dict):
            return result
    except json.JSONDecodeError as error:
        raise ValueError(
            f"Groq returned malformed or incomplete JSON: {error}"
        ) from error

    raise ValueError("Groq response is not a valid JSON object.")


# ============================================================
# FIVE WHYS NORMALIZATION
# ============================================================

def normalize_five_whys(items):
    """
    Convert AI-generated 5 Whys objects into strings.

    Prevents React from displaying [object Object].
    """

    if not isinstance(items, list):
        return []

    normalized = []

    for item in items:

        if isinstance(item, str):
            normalized.append(item)

        elif isinstance(item, dict):

            question = (
                item.get("why")
                or item.get("question")
                or ""
            )

            answer = (
                item.get("answer")
                or item.get("explanation")
                or item.get("reason")
                or item.get("finding")
                or ""
            )

            if question and answer:
                normalized.append(
                    f"{question}\n{answer}"
                )

            elif question or answer:
                normalized.append(
                    str(question or answer)
                )

            else:
                normalized.append(
                    json.dumps(item, ensure_ascii=False)
                )

        else:
            normalized.append(str(item))

    return normalized[:5]


# ============================================================
# FALLBACK INVESTIGATION
# ============================================================

def fallback_extract(text, current=None):
    """
    Conservative fallback when Groq is unavailable.
    """

    result = dict(current or {})

    defaults = {

        "incident_title": "Investigation required",
        "incident_date": "",
        "site": "",
        "department": "",
        "process_stage": "",
        "product_api": "",
        "batch_lot": "",
        "equipment_id": "",

        "deviation_description": text[:1800],
        "immediate_actions": "",

        "batch_impact": (
            "Not established. Further investigation required."
        ),

        "containment": "",

        "confirmed_facts": [],
        "unverified_assumptions": [],

        "investigation_method": "5 Whys",

        "five_whys": [
            "Why did the observed event occur? Evidence required.",
            "Why did the preceding condition exist? Evidence required.",
            "Why was the condition not detected earlier? Evidence required.",
            "Why did the existing control not prevent the event? Evidence required.",
            "Why did the quality system permit this gap? Evidence required."
        ],

        "fishbone": {
            category: []
            for category in CATEGORIES
        },

        "potential_root_causes": [
            {
                "cause": (
                    "Undetermined — insufficient investigation evidence."
                ),
                "evidence_for": "Incident narrative only.",
                "evidence_against": (
                    "Objective supporting records have not been reviewed."
                ),
                "confidence": "Low",
                "verification": (
                    "Review relevant batch records, equipment history, "
                    "calibration records, process trends and interviews."
                )
            }
        ],

        "contributing_factors": [],

        "missing_evidence": [
            "Executed batch manufacturing record",
            "Relevant equipment maintenance and calibration history",
            "Process trend and alarm records",
            "Relevant analytical results",
            "Operator training and interview records",
            "Previous deviation and trend history"
        ],

        "capa": [
            {
                "activity_type": "Investigation",
                "type": "Investigation",
                "action": (
                    "Review relevant investigation evidence "
                    "before determining corrective actions."
                ),
                "rationale": (
                    "Establishes whether the suspected cause "
                    "is supported by objective evidence."
                ),
                "linked_root_cause": (
                    "Potential cause requires objective verification."
                ),
                "verification_status": "Pending evidence",
                "owner": "Quality Assurance",
                "due_days": 7,
                "effectiveness_check": (
                    "Document review completed and findings recorded."
                )
            }
        ],

        "risk_level": "Medium",

        "risk_rationale": (
            "Provisional screening only. Product impact cannot be "
            "established without supporting evidence and QA assessment."
        ),

        "evidence_summary": (
            "Incident narrative is the only available source."
        )
    }

    for key, value in defaults.items():
        result.setdefault(key, value)

    return result


# ============================================================
# RESULT NORMALIZATION
# ============================================================

def normalize_result(result):
    """Validate and normalize investigation output."""

    if not isinstance(result, dict):
        raise ValueError(
            "Investigation result must be a JSON object."
        )

    # Ensure required list fields.
    list_fields = [
        "confirmed_facts",
        "unverified_assumptions",
        "five_whys",
        "contributing_factors",
        "missing_evidence",
        "potential_root_causes",
        "capa"
    ]

    for key in list_fields:

        if not isinstance(result.get(key), list):
            result[key] = []

    # Normalize 5 Whys.
    result["five_whys"] = normalize_five_whys(
        result["five_whys"]
    )

    # Fishbone normalization.
    fishbone = result.get("fishbone")

    if not isinstance(fishbone, dict):
        fishbone = {}

    result["fishbone"] = {
        category: (
            fishbone.get(category, [])
            if isinstance(fishbone.get(category, []), list)
            else []
        )
        for category in CATEGORIES
    }

    # Potential root causes.
    for cause in result["potential_root_causes"]:

        if not isinstance(cause, dict):
            continue

        if cause.get("confidence") not in [
            "Low",
            "Medium",
            "High"
        ]:
            cause["confidence"] = "Low"

    # Risk level.
    if result.get("risk_level") not in [
        "Low",
        "Medium",
        "High",
        "Critical"
    ]:
        result["risk_level"] = "Medium"

    # CAPA traceability normalization.
    for action in result["capa"]:

        if not isinstance(action, dict):
            continue

        activity = action.get("activity_type", "CAPA")

        if activity not in [
            "Investigation",
            "CAPA"
        ]:
            activity = "CAPA"

        action["activity_type"] = activity

        if activity == "Investigation":

            action["type"] = "Investigation"

        else:

            if action.get("type") not in [
                "Corrective",
                "Preventive"
            ]:
                action["type"] = "Corrective"

        action.setdefault("action", "")
        action.setdefault("rationale", "")

        action.setdefault(
            "owner",
            "To be assigned"
        )

        action.setdefault("due_days", 0)

        action.setdefault(
            "effectiveness_check",
            ""
        )

        if not action.get("linked_root_cause"):

            action["linked_root_cause"] = (
                "Specific investigation finding requires identification."
            )

        if action.get("verification_status") not in [
            "Pending evidence",
            "Verified",
            "Not verified"
        ]:

            action["verification_status"] = (
                "Pending evidence"
            )

    return result


# ============================================================
# GROQ LLM CALL
# ============================================================

def llm_call(prompt):
    """Execute Groq LLM request."""

    key = os.getenv("GROQ_API_KEY")

    if not key:
        raise ValueError(
            "GROQ_API_KEY is not configured."
        )

    model = os.getenv(
        "GROQ_MODEL",
        "openai/gpt-oss-120b"
    )

    llm = ChatGroq(
    model=model,
    temperature=0,
    max_tokens=12000,
    model_kwargs={
        "response_format": {"type": "json_object"}
    },
    api_key=key
    )

    response = llm.invoke([
        SystemMessage(content=SYSTEM),
        HumanMessage(content=prompt)
    ])

    return normalize_result(
        parse_json(response.content)
    )


# ============================================================
# INTAKE NODE
# ============================================================

def intake_node(state):
    """Process new pharmaceutical incident intake."""

    current = state.get("current") or {}
    source = state.get("text", "")

    prompt = f"""
Analyse the following pharmaceutical manufacturing incident.

Extract available facts and perform a preliminary RCA.

Preserve known current investigation fields unless contradicted
by new source information.

Clearly separate confirmed facts from unverified assumptions.

Generate five logical 5 Whys stages.

Consider all six Fishbone categories.

Generate potential root causes with supporting evidence,
contradicting evidence, confidence and verification activities.

Generate investigation activities separately from CAPA.

Every CAPA must contain a specific linked investigation finding
or potential root-cause hypothesis.

Do not invent information.

CURRENT INVESTIGATION:

{json.dumps(current, ensure_ascii=False)}

INCIDENT SOURCE:

{source}
"""

    try:

        result = llm_call(prompt)

        logger.info(
            "Groq intake completed successfully"
        )

    except Exception as error:

        logger.exception(
            "GROQ INTAKE ERROR: %s",
            error
        )

        result = fallback_extract(
            source,
            current
        )

        result["ai_status"] = (
            "Fallback mode — AI analysis unavailable."
        )

    result = normalize_result(result)

    result["source_text"] = source[:12000]

    result["ai_disclaimer"] = (
        "AI-generated investigation content is preliminary. "
        "Potential causes are hypotheses, not verified root causes. "
        "QA must verify evidence and approve all quality decisions."
    )

    return {
        "result": result
    }


# ============================================================
# EDIT NODE
# ============================================================

def edit_node(state):
    """Apply conversational edits to an existing investigation."""

    current = state.get("current") or {}
    instruction = state.get("instruction", "")

    prompt = f"""
Update the existing pharmaceutical RCA investigation.

USER INSTRUCTION:

{instruction}

CURRENT INVESTIGATION:

{json.dumps(current, ensure_ascii=False)}

REQUIREMENTS:

1. Apply the requested changes.

2. Preserve unrelated fields.

3. Preserve confirmed facts.

4. Do not invent supporting evidence.

5. Keep unverified causes as hypotheses.

6. Reassess risk and CAPA only if justified.

7. Preserve existing investigation evidence.

8. Every CAPA must identify the investigation finding
   or potential root cause it addresses.

9. Include activity_type:
   - Investigation
   - CAPA

10. Include type:
    - Investigation for investigation activities.
    - Corrective or Preventive for CAPA activities.

11. Include verification_status:
    - Pending evidence
    - Verified
    - Not verified

12. Do not classify evidence collection, laboratory retesting,
    interviews or document reviews as completed corrective actions.

13. Never mark a cause Verified without objective evidence.

14. CAPA effectiveness checks must be measurable and relevant.

15. Do not invent arbitrary acceptance criteria.

16. Return the complete investigation JSON.
"""

    try:

        result = llm_call(prompt)

        logger.info(
            "Groq edit completed successfully"
        )

    except Exception as error:

        logger.exception(
            "GROQ EDIT ERROR: %s",
            error
        )

        result = dict(current)

        result.setdefault(
            "missing_evidence",
            []
        )

        result["edit_note"] = instruction

        result["missing_evidence"].append(
            "Verify requested edit: " + instruction
        )

        result["ai_status"] = (
            "Fallback mode — edit requires review."
        )

    result = normalize_result(result)

    result["source_text"] = current.get(
        "source_text",
        ""
    )

    result["ai_disclaimer"] = (
        "AI-generated investigation content is preliminary. "
        "Potential causes are hypotheses, not verified root causes. "
        "QA must verify evidence and approve all quality decisions."
    )

    return {
        "result": result
    }


# ============================================================
# BUILD LANGGRAPH WORKFLOW
# ============================================================

graph = StateGraph(RCAState)

graph.add_node(
    "intake",
    intake_node
)

graph.add_node(
    "edit",
    edit_node
)

graph.add_conditional_edges(
    "__start__",
    lambda state: state.get("mode", "intake"),
    {
        "intake": "intake",
        "edit": "edit"
    }
)

graph.add_edge(
    "intake",
    END
)

graph.add_edge(
    "edit",
    END
)

rca_graph = graph.compile()