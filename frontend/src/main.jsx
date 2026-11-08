import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider, useDispatch, useSelector } from 'react-redux';

import {
    store,
    setInvestigation,
    setField,
    setBusy,
    addMessage,
    setSaved,
    reset
} from './store';

import {
    FlaskConical,
    Upload,
    Send,
    Paperclip,
    ShieldCheck,
    Activity,
    FileText,
    Save,
    RefreshCw,
    AlertTriangle,
    Clock3,
    Sparkles
} from 'lucide-react';

import './style.css';

const API = 'http://localhost:8000/api';

const SAMPLE = `Deviation report QN-2026-041. On 04-Nov-2026 at 14:20, during the final drying stage of Metformin Hydrochloride API, batch MFH261104A, at Unit 2 / API Block B, the operator observed that the product temperature remained at 68°C for 42 minutes although the approved batch instruction specifies 60–65°C. Dryer DR-204 was used. The high temperature alarm was acknowledged but the event was not escalated immediately. In-process sample was collected after the event; assay and related substances results are pending. No product was transferred from the dryer. The batch has been placed on QA hold. Initial interview indicates the temperature controller was recently serviced on 02-Nov-2026. The calibration certificate, maintenance work order, alarm history, executed batch record, trend data and impact assessment are requested. Reported by Production Supervisor, API Manufacturing.`;


// Normalize the API payload into the flat investigation object used by Redux.
function normalizeInvestigationResponse(payload) {
    let data = payload;

    if (typeof data === 'string') {
        try {
            data = JSON.parse(data);
        } catch {
            throw new Error('The RCA service returned text instead of investigation JSON.');
        }
    }

    if (data && typeof data === 'object' && !Array.isArray(data)) {
        data = data.result ?? data.investigation ?? data.data ?? data;
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('The RCA service returned an invalid investigation response.');
    }

    if (data.output && typeof data.output === 'object' && !Array.isArray(data.output)) {
        data = data.output;
    }

    const defaults = {
        status: 'Draft',
        incident_title: '', incident_date: '', site: '', department: '',
        process_stage: '', product_api: '', batch_lot: '', equipment_id: '',
        deviation_description: '', immediate_actions: '', batch_impact: '',
        containment: '', confirmed_facts: [], unverified_assumptions: [],
        investigation_method: '5 Whys', five_whys: [],
        fishbone: { Man: [], Machine: [], Method: [], Material: [], Measurement: [], Environment: [] },
        potential_root_causes: [], contributing_factors: [], missing_evidence: [],
        capa: [], risk_level: 'Not assessed', risk_rationale: '',
        evidence_summary: '', source_text: ''
    };

    const result = { ...defaults, ...data };

    for (const key of [
        'confirmed_facts', 'unverified_assumptions', 'five_whys',
        'potential_root_causes', 'contributing_factors', 'missing_evidence', 'capa'
    ]) {
        if (!Array.isArray(result[key])) result[key] = [];
    }

    const fishbone = result.fishbone && typeof result.fishbone === 'object'
        ? result.fishbone : {};
    result.fishbone = Object.fromEntries(
        ['Man', 'Machine', 'Method', 'Material', 'Measurement', 'Environment']
            .map(key => [key, Array.isArray(fishbone[key]) ? fishbone[key] : []])
    );

    result.five_whys = result.five_whys.slice(0, 5).map(item => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
            const question = item.why || item.question || '';
            const answer = item.answer || item.explanation || item.reason || item.finding || '';
            return [question, answer].filter(Boolean).join('\\n') || JSON.stringify(item);
        }
        return String(item ?? '');
    });

    result.potential_root_causes = result.potential_root_causes
        .filter(item => item && typeof item === 'object')
        .map(item => ({
            cause: item.cause || 'Unspecified potential cause',
            evidence_for: item.evidence_for || '',
            evidence_against: item.evidence_against || '',
            confidence: item.confidence || 'Low',
            verification: item.verification || ''
        }));

    result.capa = result.capa
        .filter(item => item && typeof item === 'object')
        .map(item => {
            const activity_type = item.activity_type === 'Investigation' ? 'Investigation' : 'CAPA';
            const type = activity_type === 'Investigation'
                ? 'Investigation'
                : (['Corrective', 'Preventive'].includes(item.type) ? item.type : 'Corrective');
            return {
                activity_type, type,
                action: item.action || '',
                rationale: item.rationale || '',
                linked_root_cause: item.linked_root_cause || '',
                verification_status: item.verification_status || 'Pending evidence',
                owner: item.owner || '',
                due_days: Number.isFinite(Number(item.due_days)) ? Number(item.due_days) : 0,
                effectiveness_check: item.effectiveness_check || ''
            };
        });

    return result;
}

async function readInvestigationResponse(response) {
    const rawText = await response.text();
    let payload;
    try {
        payload = rawText ? JSON.parse(rawText) : {};
    } catch {
        throw new Error(`RCA service returned an unreadable response: ${rawText.slice(0, 300)}`);
    }
    if (!response.ok) {
        const detail = payload.detail || payload.message || rawText || `HTTP ${response.status}`;
        throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
    }
    return normalizeInvestigationResponse(payload);
}


function App() {

    const d = useDispatch();

    const {
        investigation: i,
        messages,
        busy,
        savedId
    } = useSelector(s => s.rca);

    const [input, setInput] = useState('');
    const [savedItems, setSavedItems] = useState([]);
    const [showSaved, setShowSaved] = useState(false);

    const fileRef = useRef();

    const update = (key, value) =>
        d(setField({ key, value }));


    // AI INCIDENT INTAKE AND EDITING

    async function processText(text) {

        if (!text.trim()) return;

        d(addMessage({
            role: 'user',
            text
        }));

        d(setBusy(true));
        setInput('');

        try {

            const hasData = Boolean(
                i.deviation_description || i.incident_title
            );

            const res = await fetch(
                API + (hasData ? '/edit' : '/intake'),
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(
                        hasData
                            ? { instruction: text, current: i }
                            : { text, current: i }
                    )
                }
            );

            const investigationData = await readInvestigationResponse(res);
            console.log('QualiRoot investigation response:', investigationData);
            d(setInvestigation(investigationData));

            d(addMessage({
                role: 'assistant',
                text: hasData
                    ? 'Investigation updated successfully. Existing information has been preserved. Review the updated RCA and CAPA.'
                    : 'Incident information extracted successfully. Preliminary RCA hypotheses and CAPA recommendations have been generated. Please review all AI-generated information.'
            }));

        } catch (e) {

            d(addMessage({
                role: 'assistant',
                text: 'Could not reach RCA service: ' + e.message
            }));

        } finally {

            d(setBusy(false));

        }
    }


    // PDF EXTRACTION

    async function upload(file) {

        if (!file) return;

        d(addMessage({
            role: 'user',
            text: `Uploaded document: ${file.name}`
        }));

        d(setBusy(true));

        try {

            const fd = new FormData();

            fd.append('file', file);

            const r = await fetch(
                API + '/extract',
                {
                    method: 'POST',
                    body: fd
                }
            );

            const investigationData = await readInvestigationResponse(r);
            console.log('QualiRoot PDF extraction response:', investigationData);
            d(setInvestigation(investigationData));

            d(addMessage({
                role: 'assistant',
                text: 'PDF extracted successfully. Review incident details, RCA hypotheses, missing evidence and CAPA recommendations.'
            }));

        } catch (e) {

            d(addMessage({
                role: 'assistant',
                text: 'Document extraction failed: ' + e.message
            }));

        } finally {

            d(setBusy(false));

            if (fileRef.current) {
                fileRef.current.value = '';
            }
        }
    }


    // SAVE OR UPDATE INVESTIGATION

    async function save() {

        try {

            const isUpdate = Boolean(savedId);

            const url = isUpdate
                ? `${API}/investigations/${savedId}`
                : `${API}/investigations`;

            const method = isUpdate ? 'PUT' : 'POST';

            const r = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(i)
            });

            if (!r.ok) {
                throw new Error(await r.text());
            }

            const result = await r.json();

            const recordId = savedId || result.id;

            d(setSaved(recordId));

            d(addMessage({
                role: 'assistant',
                text: isUpdate
                    ? `Investigation #${recordId} updated successfully.`
                    : `Investigation #${recordId} saved successfully.`
            }));

        } catch (e) {

            d(addMessage({
                role: 'assistant',
                text: 'Save failed: ' + e.message
            }));

        }
    }


    // FETCH SAVED INVESTIGATIONS

    async function fetchSaved() {

        try {

            const r = await fetch(
                `${API}/investigations`
            );

            if (!r.ok) {
                throw new Error(
                    'Could not load saved investigations'
                );
            }

            const data = await r.json();

            setSavedItems(data);
            setShowSaved(true);

        } catch (e) {

            alert(e.message);

        }
    }


    // LOAD COMPLETE INVESTIGATION BY ID

    async function loadSaved(id) {

        try {

            const r = await fetch(
                `${API}/investigations/${id}`
            );

            if (!r.ok) {
                throw new Error(
                    'Could not load investigation'
                );
            }

            const data = await r.json();

            d(setInvestigation(data));

            d(setSaved(id));

            setShowSaved(false);

            d(addMessage({
                role: 'assistant',
                text: `Investigation #${id} loaded successfully. Complete RCA and CAPA information has been restored.`
            }));

        } catch (e) {

            alert(e.message);

        }
    }


    // FORM FIELD COMPONENT

    const Field = ({
        label,
        k,
        wide = false,
        area = false,
        placeholder = ''
    }) => (

        <label className={wide ? 'field wide' : 'field'}>

            <span>{label}</span>

            {area

                ? <textarea
                    value={i[k] || ''}
                    placeholder={placeholder}
                    onChange={e =>
                        update(k, e.target.value)
                    }
                />

                : <input
                    value={i[k] || ''}
                    placeholder={placeholder}
                    onChange={e =>
                        update(k, e.target.value)
                    }
                />

            }

        </label>
    );


    return (

        <div className="app">

            {/* HEADER */}

            <header className="topbar">

                <div className="brand">

                    <div className="logo">
                        <FlaskConical size={20} />
                    </div>

                    <div>
                        <b>QualiRoot</b>
                        <small>
                            QUALITY INTELLIGENCE · API MANUFACTURING
                        </small>
                    </div>

                </div>


                <div className="topright">

                    <span className="live">
                        <i />
                        AI ENGINE {busy ? 'PROCESSING' : 'READY'}
                    </span>


                    {/* SAVED INVESTIGATIONS BUTTON */}

                    <button
                        className="reset"
                        onClick={fetchSaved}
                    >
                        <FileText size={15} />
                        Saved Investigations
                    </button>


                    {/* NEW INVESTIGATION BUTTON */}

                    <button
                        className="reset"
                        onClick={() => {
                            d(reset());
                        }}
                    >
                        <RefreshCw size={15} />
                        New investigation
                    </button>

                </div>

            </header>


            {/* WORKSPACE */}

            <div className="workspace">


                {/* SAVED INVESTIGATIONS PANEL */}

                {showSaved && (

                    <div className="saved-panel">

                        <div className="saved-header">

                            <h2>Saved Investigations</h2>

                            <button
                                onClick={() =>
                                    setShowSaved(false)
                                }
                            >
                                Close ✕
                            </button>

                        </div>


                        {savedItems.length === 0

                            ? <p>No saved investigations found.</p>

                            : savedItems.map(item => (

                                <div
                                    className="saved-item"
                                    key={item.id}
                                    onClick={() =>
                                        loadSaved(item.id)
                                    }
                                >

                                    <div>

                                        <strong>
                                            {item.incident_title}
                                        </strong>

                                        <p>
                                            Record #{item.id}
                                            {' · '}
                                            {item.status}
                                        </p>

                                        <small>
                                            {item.created_at}
                                        </small>

                                    </div>

                                    <button>
                                        Open →
                                    </button>

                                </div>

                            ))

                        }

                    </div>

                )}


                {/* LEFT FORM */}

                <main className="formpane">


                    <div className="pagehead">

                        <div>

                            <div className="eyebrow">
                                QUALITY EVENT MANAGEMENT / RCA
                            </div>

                            <h1>Root Cause Investigation</h1>

                            <p>
                                Deviation identification
                                <b> → </b>
                                Root cause analysis
                                <b> → </b>
                                CAPA
                            </p>

                        </div>

                        <span className={
                            'status ' +
                            (i.status === 'Saved' ? 'saved' : '')
                        }>
                            {i.status === 'Saved'
                                ? 'Saved'
                                : 'Draft · AI assisted'}
                        </span>

                    </div>


                    <div className="notice">

                        <ShieldCheck size={17} />

                        <span>
                            AI-generated content is a draft.
                            QA must verify evidence, confirm root
                            cause and approve CAPA before implementation.
                        </span>

                    </div>


                    {/* SECTION 01 */}

                    <section className="card">

                        <div className="sectionhead">

                            <span className="number">01</span>

                            <div>
                                <h2>Incident identification</h2>
                                <p>Core deviation and batch context</p>
                            </div>

                        </div>


                        <div className="grid">

                            <Field
                                label="Incident / deviation title"
                                k="incident_title"
                            />

                            <Field
                                label="Incident date & time"
                                k="incident_date"
                            />

                            <Field
                                label="Manufacturing site / block"
                                k="site"
                            />

                            <Field
                                label="Department"
                                k="department"
                            />

                            <Field
                                label="Process stage"
                                k="process_stage"
                            />

                            <Field
                                label="API / product"
                                k="product_api"
                            />

                            <Field
                                label="Batch / lot number"
                                k="batch_lot"
                            />

                            <Field
                                label="Equipment ID"
                                k="equipment_id"
                            />

                            <Field
                                label="Deviation description"
                                k="deviation_description"
                                wide
                                area
                            />

                            <Field
                                label="Immediate actions taken"
                                k="immediate_actions"
                                wide
                                area
                            />

                            <Field
                                label="Batch / product impact"
                                k="batch_impact"
                                wide
                                area
                            />

                            <Field
                                label="Containment / status"
                                k="containment"
                                wide
                            />

                        </div>

                    </section>


                    {/* SECTION 02 */}

                    <section className="card">

                        <div className="sectionhead">

                            <span className="number">02</span>

                            <div>
                                <h2>Root cause analysis</h2>
                                <p>
                                    Structured investigation tools
                                    and evidence-based hypotheses
                                </p>
                            </div>

                            <span className="tag">
                                {i.investigation_method || '5 Whys'}
                            </span>

                        </div>


                        <div className="subhead">
                            5 WHYS ANALYSIS
                        </div>


                        {(i.five_whys || []).length

                            ? <div className="whylist">

                                {i.five_whys.map((w, n) => {
                                    const displayValue =
                                        typeof w === 'string'
                                            ? w
                                            : typeof w === 'object' && w !== null
                                                ? [
                                                    w.why,
                                                    w.question,
                                                    w.answer,
                                                    w.reason,
                                                    w.explanation,
                                                    w.finding
                                                ].filter(Boolean).join('\n')
                                                : String(w ?? '');

                                    return (
                                        <label className="why" key={n}>
                                            <span>{n + 1}</span>

                                            <textarea
                                                value={displayValue}
                                                onChange={e =>
                                                    update(
                                                        'five_whys',
                                                        i.five_whys.map((v, j) =>
                                                            j === n ? e.target.value : v
                                                        )
                                                    )
                                                }
                                            />
                                        </label>
                                    );
                                })}

                            </div>

                            : <div className="empty">
                                Ask the AI copilot to generate a 5 Whys investigation.
                            </div>

                        }


                        <div className="subhead spaced">
                            FISHBONE / ISHIKAWA FACTORS
                        </div>


                        <div className="fishgrid">

                            {[
                                'Man',
                                'Machine',
                                'Method',
                                'Material',
                                'Measurement',
                                'Environment'
                            ].map(k => (

                                <div className="fish" key={k}>

                                    <b>{k}</b>

                                    <ul>
                                        {(i.fishbone?.[k] || []).map(
                                            (v, n) => (
                                                <li key={n}>{v}</li>
                                            )
                                        )}
                                    </ul>

                                    {!(i.fishbone?.[k] || []).length && (
                                        <small>Not identified</small>
                                    )}

                                </div>

                            ))}

                        </div>


                        <div className="subhead spaced">
                            POTENTIAL ROOT CAUSES · HYPOTHESES
                        </div>


                        {(i.potential_root_causes || []).length

                            ? i.potential_root_causes.map((c, n) => (

                                <div className="cause" key={n}>

                                    <div className="causehead">

                                        <b>{c.cause}</b>

                                        <span className="confidence">
                                            {c.confidence || 'Unrated'} confidence
                                        </span>

                                    </div>

                                    <p>
                                        <strong>Evidence for:</strong>
                                        {' '}
                                        {c.evidence_for || 'Not provided'}
                                    </p>

                                    <p>
                                        <strong>Evidence against:</strong>
                                        {' '}
                                        {c.evidence_against || 'Not provided'}
                                    </p>

                                    <p>
                                        <strong>Verification:</strong>
                                        {' '}
                                        {c.verification || 'Define evidence required'}
                                    </p>

                                </div>

                            ))

                            : <div className="empty">
                                No hypotheses generated yet.
                            </div>

                        }


                        {(i.contributing_factors || []).length > 0 && (

                            <>
                                <div className="subhead spaced">
                                    CONTRIBUTING FACTORS
                                </div>

                                <ul className="bullets">

                                    {i.contributing_factors.map((x, n) => (
                                        <li key={n}>{x}</li>
                                    ))}

                                </ul>
                            </>

                        )}

                    </section>


                    {/* SECTION 03 */}

                    <section className="card">

                        <div className="sectionhead">

                            <span className="number">03</span>

                            <div>
                                <h2>Evidence & risk review</h2>
                                <p>
                                    What is known, what is missing,
                                    and why it matters
                                </p>
                            </div>

                        </div>


                        <div className="riskrow">

                            <div className={
                                'riskbadge ' +
                                (i.risk_level || '').toLowerCase()
                            }>

                                <Activity size={19} />

                                <div>
                                    <small>PROVISIONAL RISK</small>
                                    <b>{i.risk_level || 'Not assessed'}</b>
                                </div>

                            </div>

                            <p>
                                {i.risk_rationale ||
                                    'Risk assessment will appear after AI intake.'}
                            </p>

                        </div>


                        <div className="subhead spaced">
                            MISSING EVIDENCE / INVESTIGATION ACTIONS
                        </div>


                        {(i.missing_evidence || []).length

                            ? <ul className="evidence">

                                {i.missing_evidence.map((x, n) => (

                                    <li key={n}>
                                        <AlertTriangle size={15} />
                                        {x}
                                    </li>

                                ))}

                            </ul>

                            : <div className="empty">
                                No evidence gaps identified.
                            </div>

                        }


                        <Field
                            label="Evidence summary"
                            k="evidence_summary"
                            wide
                            area
                        />

                    </section>


                    {/* SECTION 04 */}

                    <section className="card">

                        <div className="sectionhead">

                            <span className="number">04</span>

                            <div>
                                <h2>Corrective & preventive actions</h2>
                                <p>
                                    Recommendations with ownership
                                    and effectiveness checks
                                </p>
                            </div>

                        </div>


                        {(i.capa || []).length ? (
                            i.capa.map((c, n) => (
                                <div className="capa" key={n}>

                                    <div className="capabadge">
                                        {c.activity_type || "CAPA"}
                                    </div>

                                    <div className="capabody">

                                        <div className="grid">

                                            <label className="field">
                                                <span>Activity type</span>

                                                <select
                                                    value={c.activity_type || "CAPA"}
                                                    onChange={e =>
                                                        update(
                                                            "capa",
                                                            i.capa.map((v, j) =>
                                                                j === n
                                                                    ? { ...v, activity_type: e.target.value }
                                                                    : v
                                                            )
                                                        )
                                                    }
                                                >
                                                    <option value="Investigation">Investigation</option>
                                                    <option value="CAPA">CAPA</option>
                                                </select>
                                            </label>

                                            <label className="field">
                                                <span>Action classification</span>

                                                <select
                                                    value={c.type || "Corrective"}
                                                    onChange={e =>
                                                        update(
                                                            "capa",
                                                            i.capa.map((v, j) =>
                                                                j === n
                                                                    ? { ...v, type: e.target.value }
                                                                    : v
                                                            )
                                                        )
                                                    }
                                                >
                                                    <option value="Corrective">Corrective</option>
                                                    <option value="Preventive">Preventive</option>
                                                    <option value="Investigation">Investigation</option>
                                                </select>
                                            </label>

                                            <label className="field wide">
                                                <span>Action description</span>

                                                <textarea
                                                    value={c.action || ""}
                                                    onChange={e =>
                                                        update(
                                                            "capa",
                                                            i.capa.map((v, j) =>
                                                                j === n
                                                                    ? { ...v, action: e.target.value }
                                                                    : v
                                                            )
                                                        )
                                                    }
                                                />
                                            </label>

                                            <label className="field wide">
                                                <span>Linked root cause / investigation finding</span>

                                                <textarea
                                                    value={c.linked_root_cause || ""}
                                                    onChange={e =>
                                                        update(
                                                            "capa",
                                                            i.capa.map((v, j) =>
                                                                j === n
                                                                    ? { ...v, linked_root_cause: e.target.value }
                                                                    : v
                                                            )
                                                        )
                                                    }
                                                    placeholder="Identify the finding or hypothesis addressed by this action"
                                                />
                                            </label>

                                            <label className="field">
                                                <span>Verification status</span>

                                                <select
                                                    value={c.verification_status || "Pending evidence"}
                                                    onChange={e =>
                                                        update(
                                                            "capa",
                                                            i.capa.map((v, j) =>
                                                                j === n
                                                                    ? {
                                                                        ...v,
                                                                        verification_status: e.target.value
                                                                    }
                                                                    : v
                                                            )
                                                        )
                                                    }
                                                >
                                                    <option value="Pending evidence">
                                                        Pending evidence
                                                    </option>

                                                    <option value="Verified">
                                                        Verified
                                                    </option>

                                                    <option value="Not verified">
                                                        Not verified
                                                    </option>
                                                </select>
                                            </label>

                                            <label className="field">
                                                <span>Responsible owner</span>

                                                <input
                                                    value={c.owner || ""}
                                                    onChange={e =>
                                                        update(
                                                            "capa",
                                                            i.capa.map((v, j) =>
                                                                j === n
                                                                    ? { ...v, owner: e.target.value }
                                                                    : v
                                                            )
                                                        )
                                                    }
                                                />
                                            </label>

                                            <label className="field">
                                                <span>Due date (days)</span>

                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={c.due_days ?? 0}
                                                    onChange={e =>
                                                        update(
                                                            "capa",
                                                            i.capa.map((v, j) =>
                                                                j === n
                                                                    ? {
                                                                        ...v,
                                                                        due_days: Number(e.target.value)
                                                                    }
                                                                    : v
                                                            )
                                                        )
                                                    }
                                                />
                                            </label>

                                            <label className="field wide">
                                                <span>Rationale</span>

                                                <textarea
                                                    value={c.rationale || ""}
                                                    onChange={e =>
                                                        update(
                                                            "capa",
                                                            i.capa.map((v, j) =>
                                                                j === n
                                                                    ? { ...v, rationale: e.target.value }
                                                                    : v
                                                            )
                                                        )
                                                    }
                                                />
                                            </label>

                                            <label className="field wide">
                                                <span>Effectiveness check</span>

                                                <textarea
                                                    value={c.effectiveness_check || ""}
                                                    onChange={e =>
                                                        update(
                                                            "capa",
                                                            i.capa.map((v, j) =>
                                                                j === n
                                                                    ? {
                                                                        ...v,
                                                                        effectiveness_check: e.target.value
                                                                    }
                                                                    : v
                                                            )
                                                        )
                                                    }
                                                />
                                            </label>

                                        </div>

                                    </div>

                                </div>
                            ))
                        ) : (
                            <div className="empty">
                                CAPA recommendations will be generated from the investigation.
                            </div>
                        )}

                    </section>


                    {/* SAVE BUTTON */}

                    <div className="formfooter">

                        <span>
                            <Clock3 size={15} />
                            Review all AI suggestions before saving.
                        </span>

                        <button
                            className="primary"
                            onClick={save}
                            disabled={!i.deviation_description}
                        >
                            <Save size={16} />
                            {savedId
                                ? 'Update investigation'
                                : 'Save investigation'}
                        </button>

                    </div>

                </main>


                {/* RIGHT AI COPILOT */}

                <aside className="copilot">

                    <div className="copilothead">

                        <div className="aiicon">
                            <Sparkles size={18} />
                        </div>

                        <div>
                            <h2>RCA Copilot</h2>
                            <p>AI-assisted investigation workspace</p>
                        </div>

                        <span className="online" />

                    </div>


                    <div className="chatbody">

                        <div className="toolhint">

                            <b>QUICK START</b>

                            <p>
                                Describe the event in plain language,
                                paste an email, or upload a PDF
                                investigation report. I'll populate
                                the RCA record and identify evidence gaps.
                            </p>

                            <button
                                onClick={() => processText(SAMPLE)}
                            >
                                <Sparkles size={14} />
                                Load sample API deviation
                            </button>

                        </div>


                        {messages.map((m, n) => (

                            <div
                                className={'message ' + m.role}
                                key={n}
                            >

                                <div className="avatar">

                                    {m.role === 'assistant'
                                        ? <FlaskConical size={15} />
                                        : 'You'}

                                </div>

                                <div className="bubble">
                                    {m.text}
                                </div>

                            </div>

                        ))}


                        {busy && (

                            <div className="message assistant">

                                <div className="avatar">
                                    <Sparkles size={15} />
                                </div>

                                <div className="bubble typing">
                                    Analysing incident and building investigation
                                    <span>•••</span>
                                </div>

                            </div>

                        )}

                    </div>


                    {/* CHAT INPUT */}

                    <div className="chatcomposer">

                        <div className="uploadrow">

                            <button
                                onClick={() =>
                                    fileRef.current.click()
                                }
                            >
                                <Paperclip size={15} />
                                Attach PDF
                            </button>

                            <span>PDF · max 12 MB</span>

                            <input
                                ref={fileRef}
                                type="file"
                                accept="application/pdf"
                                hidden
                                onChange={e =>
                                    upload(e.target.files?.[0])
                                }
                            />

                        </div>


                        <div className="compose">

                            <textarea
                                value={input}
                                onChange={e =>
                                    setInput(e.target.value)
                                }
                                onKeyDown={e => {

                                    if (
                                        e.key === 'Enter' &&
                                        !e.shiftKey
                                    ) {
                                        e.preventDefault();
                                        processText(input);
                                    }

                                }}
                                placeholder="Describe a deviation or request an edit…"
                            />

                            <button
                                disabled={!input.trim() || busy}
                                onClick={() => processText(input)}
                            >
                                <Send size={17} />
                            </button>

                        </div>


                        <div className="composerfoot">

                            {i.deviation_description
                                ? 'EDIT MODE · Existing investigation context retained'
                                : 'NEW INVESTIGATION · Intake mode'}

                            <span>POWERED BY LANGGRAPH</span>

                        </div>

                    </div>

                </aside>

            </div>

        </div>

    );

}


createRoot(document.getElementById('root')).render(

    <Provider store={store}>
        <App />
    </Provider>

);