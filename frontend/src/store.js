import { configureStore, createSlice } from '@reduxjs/toolkit';

const initial = {
    investigation: {
        status: 'Draft',
        incident_title: '',
        incident_date: '',
        site: '',
        department: '',
        process_stage: '',
        product_api: '',
        batch_lot: '',
        equipment_id: '',
        deviation_description: '',
        immediate_actions: '',
        batch_impact: '',
        containment: '',
        investigation_method: '5 Whys',
        five_whys: [],
        fishbone: {},
        potential_root_causes: [],
        contributing_factors: [],
        missing_evidence: [],
        capa: [],
        risk_level: 'Not assessed',
        risk_rationale: '',
        evidence_summary: '',
        source_text: ''
    },

    messages: [
        {
            role: 'assistant',
            text: 'Welcome to QualiRoot. Describe an API manufacturing incident, paste an investigation email, or upload a PDF. I will extract the facts, structure the RCA and propose evidence-led CAPA for QA review.'
        }
    ],

    busy: false,
    savedId: null,
    savedInvestigations: []
};

const slice = createSlice({
    name: 'rca',
    initialState: initial,

    reducers: {
        setInvestigation: (state, action) => {
            state.investigation = {
                ...state.investigation,
                ...action.payload
            };
        },

        setField: (state, action) => {
            state.investigation[action.payload.key] =
                action.payload.value;
        },

        setBusy: (state, action) => {
            state.busy = action.payload;
        },

        addMessage: (state, action) => {
            state.messages.push(action.payload);
        },

        setSaved: (state, action) => {
            state.savedId = action.payload;
            state.investigation.status = 'Saved';
        },

        setSavedInvestigations: (state, action) => {
            state.savedInvestigations = action.payload;
        },

        loadInvestigation: (state, action) => {
            state.investigation = {
                ...initial.investigation,
                ...action.payload
            };

            state.savedId = action.payload.id;

            state.investigation.status = 'Saved';

            state.messages = [
                {
                    role: 'assistant',
                    text: `Investigation #${action.payload.id} loaded successfully. You can review or edit the RCA and CAPA using the AI Copilot.`
                }
            ];
        },

        reset: () => initial
    }
});

export const {
    setInvestigation,
    setField,
    setBusy,
    addMessage,
    setSaved,
    setSavedInvestigations,
    loadInvestigation,
    reset
} = slice.actions;

export const store = configureStore({
    reducer: {
        rca: slice.reducer
    }
});
