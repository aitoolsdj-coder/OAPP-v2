const API = {
    ENDPOINTS: {
        REQ_ADD: 'https://jakubdworak.app.n8n.cloud/webhook/oapp/zapotrzebowania/add',
        REQ_STATUS: 'https://jakubdworak.app.n8n.cloud/webhook/oapp/zapotrzebowania/status',
        REQ_LIST: 'https://jakubdworak.app.n8n.cloud/webhook/oapp/zapotrzebowania/list',
        Q_ADD: 'https://jakubdworak.app.n8n.cloud/webhook/oapp/pytania/add',
        Q_STATUS: 'https://jakubdworak.app.n8n.cloud/webhook/oapp/pytania/status',
        Q_LIST: 'https://jakubdworak.app.n8n.cloud/webhook-test/oapp/pytania/list'
    },

    async _fetch(url, options = {}) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 8000); // 8s timeout

        try {
            const response = await fetch(url, {
                ...options,
                cache: 'no-store',
                signal: controller.signal
            });
            clearTimeout(id);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.ok !== true && data.ok !== "true") { // strict check? sometimes n8n returns "true" string
                // Only throw if we explicitly expect {ok:true} structure, 
                // but for lists we expect {ok: true, items: []}
                if (data.items === undefined && data.id === undefined) {
                    // heuristic: if no items and no id, might be error or generic response
                }
            }
            return data;
        } catch (error) {
            clearTimeout(id);
            console.error('API Error:', error);
            throw error;
        }
    },

    async _post(url, data) {
        return this._fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async _get(url) {
        return this._fetch(url, { method: 'GET' });
    },

    async listRequirements() {
        return this._get(this.ENDPOINTS.REQ_LIST);
    },

    async addRequirement(data) {
        return this._post(this.ENDPOINTS.REQ_ADD, data);
    },

    async updateRequirementStatus(id, status) {
        return this._post(this.ENDPOINTS.REQ_STATUS, { id, status });
    },

    async listQuestions() {
        return this._get(this.ENDPOINTS.Q_LIST);
    },

    async addQuestion(data) {
        return this._post(this.ENDPOINTS.Q_ADD, data);
    },

    async updateQuestionStatus(id, status) {
        return this._post(this.ENDPOINTS.Q_STATUS, { id, status });
    }
};
