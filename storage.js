const Storage = {
    KEYS: {
        REQ: 'oapp_requirements',
        QUESTIONS: 'oapp_questions',
        SETTINGS: 'oapp_settings'
    },

    getRequirements() {
        const data = localStorage.getItem(this.KEYS.REQ);
        return data ? JSON.parse(data) : [];
    },

    saveRequirements(items) {
        localStorage.setItem(this.KEYS.REQ, JSON.stringify(items));
    },

    addRequirement(item) {
        const items = this.getRequirements();
        items.push(item);
        this.saveRequirements(items);
    },

    updateRequirement(updatedItem) {
        const items = this.getRequirements();
        const index = items.findIndex(i => i.id === updatedItem.id);
        if (index !== -1) {
            items[index] = updatedItem;
            this.saveRequirements(items);
        }
    },

    getQuestions() {
        const data = localStorage.getItem(this.KEYS.QUESTIONS);
        return data ? JSON.parse(data) : [];
    },

    saveQuestions(items) {
        localStorage.setItem(this.KEYS.QUESTIONS, JSON.stringify(items));
    },

    addQuestion(item) {
        const items = this.getQuestions();
        items.push(item);
        this.saveQuestions(items);
    },

    updateQuestion(updatedItem) {
        const items = this.getQuestions();
        const index = items.findIndex(i => i.id === updatedItem.id);
        if (index !== -1) {
            items[index] = updatedItem;
            this.saveQuestions(items);
        }
    },

    getSettings() {
        const data = localStorage.getItem(this.KEYS.SETTINGS);
        return data ? JSON.parse(data) : { author: 'Kuba' };
    },

    saveSettings(settings) {
        localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(settings));
    },

    clearAll() {
        localStorage.removeItem(this.KEYS.REQ);
        localStorage.removeItem(this.KEYS.QUESTIONS);
        // keep settings? user asked to clear local data, usually implies content
        // specs say "Wyczyść dane lokalne (czyści tylko localStorage)"
        // safest to clear everything then restore default settings or let them be recreated
        localStorage.clear();
    }
};
