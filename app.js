console.log('APP.JS LOADED v2026-01--REFRESH');
document.addEventListener('DOMContentLoaded', () => {
    console.log('[APP] app.js loaded', new Date().toISOString());
    // --- State & Constants ---
    const STATUSES = ['Nowe', 'W toku', 'Zrealizowane'];
    let currentDragItem = null;
    let currentDragType = null; // 'req' or 'q'

    // --- DOM Elements ---
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    // Modals
    const modalReq = document.getElementById('modal-req');
    const modalQ = document.getElementById('modal-q');
    const closeBtns = document.querySelectorAll('.close-modal');

    // Forms
    const formReq = document.getElementById('form-req');
    const formQ = document.getElementById('form-q');

    // Boards
    const reqBoard = document.getElementById('req-board');
    const qBoard = document.getElementById('q-board');

    // Settings
    const settingsAuthorInput = document.getElementById('settings-author');
    const clearDataBtn = document.getElementById('clear-data-btn');

    // --- Initialization ---
    init();

    function init() {
        console.log('[APP] init');
        setupTabs();
        setupModals();
        setupForms();
        setupSettings();
        setupGlobalEvents();

        bindRefreshButtons();
        setupConnectivity();

        // szybki render z cache
        renderRequirements();
        renderQuestions();

        // startowy sync (backend -> cache)
        syncRequirements();
        syncQuestions();

        // auto-refresh aktywnej zakładki co 120s
        setInterval(() => {
            if (!navigator.onLine) return;
            const activeTab = document.querySelector('.tab-btn.active')?.dataset?.tab;
            if (activeTab === 'zapotrzebowania') syncRequirements();
            if (activeTab === 'pytania') syncQuestions();
        }, 86400000);
    }

    // --- Tabs ---
    function setupTabs() {
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                contents.forEach(c => c.classList.remove('active'));

                tab.classList.add('active');
                document.getElementById(tab.dataset.tab).classList.add('active');

                if (navigator.onLine) {
                    if (tab.dataset.tab === 'zapotrzebowania') syncRequirements();
                    if (tab.dataset.tab === 'pytania') syncQuestions();
                }
            });
        });
    }
    function bindRefreshButtons() {
        const refreshReqBtn = document.getElementById('refresh-req-btn');
        const refreshQBtn = document.getElementById('refresh-q-btn');

        console.log('[APP] bindRefreshButtons', { hasReq: !!refreshReqBtn, hasQ: !!refreshQBtn });

        if (refreshReqBtn) {
            refreshReqBtn.addEventListener('click', () => {
                console.log('[UI] refresh-req click');
                if (!navigator.onLine) return showToast('Brak sieci', 'error');
                showToast('Odświeżanie...', 'info');
                syncRequirements();
            });
        } else {
            console.warn('[UI] refresh-req-btn not found');
        }

        if (refreshQBtn) {
            refreshQBtn.addEventListener('click', () => {
                console.log('[UI] refresh-q click');
                if (!navigator.onLine) return showToast('Brak sieci', 'error');
                showToast('Odświeżanie...', 'info');
                syncQuestions();
            });
        } else {
            console.warn('[UI] refresh-q-btn not found');
        }
    }

    function setupConnectivity() {
        window.addEventListener('online', () => {
            showToast('Odzyskano połączenie', 'info');
            syncRequirements();
            syncQuestions();
        });
        window.addEventListener('offline', () => {
            showToast('Brak połączenia z siecią', 'error');
        });
    }

    async function syncRequirements() {
        if (!navigator.onLine) return;

        try {
            // UWAGA: ta funkcja musi istnieć w api.js (API.listRequirements)
            const data = await API.listRequirements();
            if (!data?.ok || !Array.isArray(data.items)) throw new Error('Bad LIST response');

            const items = data.items
                .filter(i => (i.co ?? '').trim().length > 0)
                .map(i => ({
                    ...i,
                    autor: i.autor ?? i['autor (opcjonalnie)'] ?? '',
                    uwagi: i.uwagi ?? i['uwagi (opcjonalnie)'] ?? '',
                    status: (i.status && i.status.trim()) ? i.status : 'Nowe',
                    syncError: false,
                }));

            Storage.saveRequirements(items);
            renderRequirements();
            showToast('Odświeżono', 'success');
        } catch (e) {
            console.error('syncRequirements error', e);
            showToast('Błąd synchronizacji', 'error');
        }
    }

    async function syncQuestions() {
        if (!navigator.onLine) return;

        try {
            const data = await API.listQuestions();
            if (!data?.ok || !Array.isArray(data.items)) throw new Error('Bad LIST response');

            const normalizeStatus = (s) => {
                const v = (s ?? '').trim().toLowerCase();
                if (v === 'w toku') return 'W toku';
                if (v === 'zrealizowane') return 'Zrealizowane';
                return 'Nowe';
            };

            const items = data.items
                .filter(i => (i.opis ?? '').trim().length > 0)
                .map(i => ({
                    ...i,
                    status: normalizeStatus(i.status),
                    odpowiedz: i.odpowiedz ?? i['odpowiedz (opcjonalnie)'] ?? '',
                    syncError: false,
                }));

            Storage.saveQuestions(items);
            renderQuestions();
            showToast('Odświeżono', 'success');
        } catch (e) {
            console.error('syncQuestions error', e);
            showToast('Błąd synchronizacji', 'error');
        }
    }

    // --- Modals ---
    function setupModals() {
        document.getElementById('add-req-btn').addEventListener('click', () => {
            modalReq.style.display = 'flex';
        });

        document.getElementById('add-q-btn').addEventListener('click', () => {
            modalQ.style.display = 'flex';
        });

        closeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
            });
        });

        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }

    // --- Forms & Data Handling ---
    function setupForms() {
        formReq.addEventListener('submit', async (e) => {
            e.preventDefault();
            const co = document.getElementById('req-what').value;
            const ilosc = document.getElementById('req-amount').value;
            const producent = document.getElementById('req-producer').value;
            const uwagi = document.getElementById('req-notes').value;
            const settings = Storage.getSettings();

            if (!co || !ilosc) return; // Basic validation

            const newItem = {
                id: 'local-' + Date.now(),
                co: co,
                ilosc: ilosc,
                producent: producent,
                uwagi: uwagi,
                autor: settings.author,
                status: 'Nowe',
                createdAt: Date.now(),
                syncError: false
            };

            // Local Save
            Storage.addRequirement(newItem);
            renderRequirements();
            modalReq.style.display = 'none';
            formReq.reset();
            showToast('Dodano zapotrzebowanie', 'success');

            // API Sync
            try {
                const response = await API.addRequirement({
                    co: co, ilosc: ilosc, producent: producent, autor: settings.author, uwagi: uwagi
                });

                // Update ID from server if available
                if (response.id) {
                    newItem.id = response.id; // Correct update logic requires finding item again or robust ID handling. 
                    // For simplicity, we assume we might get a real ID. 
                    // Ideally we update the local item with the server ID to avoid dupes/issues.
                    // However, finding it by local-ID is tricky if we don't keep that reference.
                    // Let's reload items, find by local-ID (timestamp) and update.
                    const items = Storage.getRequirements();
                    const index = items.findIndex(i => i.createdAt === newItem.createdAt);
                    if (index !== -1) {
                        items[index].id = response.id;
                        Storage.saveRequirements(items);
                        renderRequirements();
                    }
                }
            } catch (err) {
                console.error("Sync error", err);
                markSyncError('req', newItem.id);
            }
        });

        formQ.addEventListener('submit', async (e) => {
            e.preventDefault();
            const opis = document.getElementById('q-desc').value;
            const termin = document.getElementById('q-date').value;
            const priorytet = document.getElementById('q-priority').value;
            const settings = Storage.getSettings();

            if (!opis) return;

            const newItem = {
                id: 'local-' + Date.now(),
                opis: opis,
                termin_odpowiedzi: termin,
                priorytet: priorytet,
                autor: settings.author,
                status: 'Nowe',
                createdAt: Date.now(),
                syncError: false
            };

            Storage.addQuestion(newItem);
            renderQuestions();
            modalQ.style.display = 'none';
            formQ.reset();
            showToast('Dodano pytanie', 'success');

            try {
                const response = await API.addQuestion({
                    opis: opis, termin_odpowiedzi: termin, priorytet: priorytet, autor: settings.author
                });
                // Similar ID update logic
                if (response.id) {
                    const items = Storage.getQuestions();
                    const index = items.findIndex(i => i.createdAt === newItem.createdAt);
                    if (index !== -1) {
                        items[index].id = response.id;
                        Storage.saveQuestions(items);
                        renderQuestions();
                    }
                }
            } catch (err) {
                markSyncError('q', newItem.id);
            }
        });
    }

    function markSyncError(type, id) {
        if (type === 'req') {
            const items = Storage.getRequirements();
            const item = items.find(i => i.id === id);
            if (item) {
                item.syncError = true;
                Storage.saveRequirements(items);
                renderRequirements();
            }
        } else {
            const items = Storage.getQuestions();
            const item = items.find(i => i.id === id);
            if (item) {
                item.syncError = true;
                Storage.saveQuestions(items);
                renderQuestions();
            }
        }
        showToast('Błąd synchronizacji', 'error');
    }

    // --- Rendering ---
    function renderRequirements() {
        const items = Storage.getRequirements();
        // Clear lists
        document.getElementById('req-list-nowe').innerHTML = '';
        document.getElementById('req-list-w-toku').innerHTML = '';
        document.getElementById('req-list-zrealizowane').innerHTML = '';

        items.forEach(item => {
            const card = createCard('req', item);
            const status = STATUSES.includes(item.status) ? item.status : 'Nowe';
            const listId = `req-list-${status.toLowerCase().replace(' ', '-')}`;
            const list = document.getElementById(listId);
            if (list) list.appendChild(card);
        });
    }

    function renderQuestions() {
        const items = Storage.getQuestions();
        document.getElementById('q-list-nowe').innerHTML = '';
        document.getElementById('q-list-w-toku').innerHTML = '';
        document.getElementById('q-list-zrealizowane').innerHTML = '';

        items.forEach(item => {
            const card = createCard('q', item);
            const status = STATUSES.includes(item.status) ? item.status : 'Nowe';
            const listId = `q-list-${status.toLowerCase().replace(' ', '-')}`;
            const list = document.getElementById(listId);
            if (list) list.appendChild(card);
        });
    }

    function createCard(type, item) {
        const div = document.createElement('div');
        div.className = 'card';
        if (item.syncError) div.classList.add('sync-error');
        div.draggable = true;
        div.dataset.id = item.id;
        div.dataset.type = type;

        // Error Badge
        if (item.syncError) {
            const badge = document.createElement('div');
            badge.className = 'error-badge';
            badge.innerText = '!';
            div.appendChild(badge);
        }

        if (type === 'q') {
            // New Compact Header Layout for Questions
            const headerRow = document.createElement('div');
            headerRow.className = 'card-header-row';

            const leftSide = document.createElement('div');
            leftSide.className = 'card-header-left';

            const title = document.createElement('span');
            title.className = 'card-title compact-title';
            title.innerText = shortenText(item.opis);

            const priorityBadge = document.createElement('span');
            priorityBadge.className = `priority-badge priority-${(item.priorytet || 'Sredni').toLowerCase()}`;
            priorityBadge.innerText = item.priorytet || 'Średni';

            leftSide.appendChild(title);
            leftSide.appendChild(priorityBadge);

            const actionsRight = document.createElement('div');
            actionsRight.className = 'card-header-actions';

            // Add 'Next State' buttons depending on current state
            if (item.status === 'Nowe') {
                actionsRight.appendChild(createCompactMoveBtn('W toku', type, item.id));
            } else if (item.status === 'W toku') {
                actionsRight.appendChild(createCompactMoveBtn('Zrealizowane', type, item.id, true)); // true = isForward? or just icon
                actionsRight.appendChild(createCompactMoveBtn('Nowe', type, item.id));
            } else if (item.status === 'Zrealizowane') {
                actionsRight.appendChild(createCompactMoveBtn('W toku', type, item.id));
            }

            headerRow.appendChild(leftSide);
            headerRow.appendChild(actionsRight);
            div.appendChild(headerRow);

            // Details
            const details = document.createElement('div');
            details.className = 'card-details compact-details';
            let answerHtml = '';
            if (item.odpowiedz) {
                answerHtml = `<span class="answer-row"><strong>Odpowiedź:</strong> ${item.odpowiedz}</span>`;
            } else {
                answerHtml = `<span class="answer-row"><strong>Odpowiedź:</strong> -</span>`;
            }

            details.innerHTML = `
                <span><strong>Termin:</strong> ${item.termin_odpowiedzi || '-'}</span>
                <span><strong>Autor:</strong> ${item.autor}</span>
                ${answerHtml}
            `;
            div.appendChild(details);

        } else {
            // Original Layout for Requirements
            const title = document.createElement('div');
            title.className = 'card-title';
            title.innerText = item.co;
            div.appendChild(title);

            const details = document.createElement('div');
            details.className = 'card-details';
            details.innerHTML = `
                <span>Ilość: ${item.ilosc}</span>
                <span>Autor: ${item.autor}</span>
                ${item.producent ? `<span>Prod: ${item.producent}</span>` : ''}
            `;
            div.appendChild(details);

            const actions = document.createElement('div');
            actions.className = 'card-actions';

            if (item.status === 'Nowe') {
                actions.appendChild(createMoveBtn('W toku', type, item.id));
            } else if (item.status === 'W toku') {
                actions.appendChild(createMoveBtn('Zrealizowane', type, item.id));
                actions.appendChild(createMoveBtn('Nowe', type, item.id));
            } else if (item.status === 'Zrealizowane') {
                actions.appendChild(createMoveBtn('W toku', type, item.id));
            }
            div.appendChild(actions);
        }

        // Retry Action (if error) - append at end or manage separately?
        // Current logic had retry button in actions.
        // For compact layout, maybe put retry in actionsRight as well?
        // Let's stick to simple append for now to not overcomplicate, 
        // but for 'q' layout, retry should go into actionsRight if possible.
        if (item.syncError) {
            const retryBtn = document.createElement('button');
            retryBtn.className = 'action-btn retry-btn-small';
            retryBtn.innerText = '↺';
            retryBtn.onclick = (e) => {
                e.stopPropagation();
                retrySync(type, item);
            };
            // If q, append to header actions, else legacy actions
            if (type === 'q') {
                div.querySelector('.card-header-actions').appendChild(retryBtn);
            } else {
                div.querySelector('.card-actions').appendChild(retryBtn);
            }
        }

        // Drag Events
        div.addEventListener('dragstart', (e) => {
            currentDragItem = item;
            currentDragType = type;
            e.dataTransfer.setData('text/plain', JSON.stringify({ id: item.id, type }));
            div.style.opacity = '0.5';
        });

        div.addEventListener('dragend', () => {
            div.style.opacity = '1';
            currentDragItem = null;
            currentDragType = null;
        });

        return div;
    }

    function createCompactMoveBtn(targetStatus, type, id) {
        const btn = document.createElement('button');
        btn.className = 'action-btn compact-action-btn';
        // Icon mapping or short text
        let icon = '→';
        if (targetStatus === 'Zrealizowane') icon = '✓';
        if (targetStatus === 'W toku') icon = '▶';
        if (targetStatus === 'Nowe') icon = '↺';

        // For right-aligned buttons, maybe text is too long.
        // User asked for "→ Zrealizowane" etc, but "Compact".
        // Let's try short text.
        // "→ Zrealizowane" takes a lot of space.
        // Let's use abbreviations or just icons if flexible, but prompt says "Klikalne na telefonie".
        // I'll stick to text but smaller padding defined in CSS.
        btn.innerText = `→ ${targetStatus}`;
        btn.onclick = (e) => {
            e.stopPropagation();
            changeStatus(type, id, targetStatus);
        };
        return btn;
    }

    function createMoveBtn(targetStatus, type, id) {
        const btn = document.createElement('button');
        btn.className = 'action-btn';
        btn.innerText = `-> ${targetStatus}`;
        btn.onclick = (e) => {
            e.stopPropagation();
            changeStatus(type, id, targetStatus);
        };
        return btn;
    }

    function shortenText(text) {
        return text.length > 30 ? text.substring(0, 30) + '...' : text;
    }

    // --- Actions ---
    async function changeStatus(type, id, newStatus) {
        // Optimistic Update
        if (String(id).startsWith('local-')) {
            showToast('Ten wpis nie jest jeszcze zsynchronizowany. Kliknij Odśwież i spróbuj ponownie.', 'error');
            return;
        }
        let item, items;
        if (type === 'req') {
            items = Storage.getRequirements();
            item = items.find(i => i.id == id); // loose equal for string/number id mix
        } else {
            items = Storage.getQuestions();
            item = items.find(i => i.id == id);
        }

        if (!item) return;
        const oldStatus = item.status;
        item.status = newStatus;

        if (type === 'req') {
            Storage.saveRequirements(items);
            renderRequirements();
        } else {
            Storage.saveQuestions(items);
            renderQuestions();
        }

        showToast(`Status zmieniony na: ${newStatus}`, 'success');

        // Verify with API
        try {
            let res;
            if (type === 'req') {
                res = await API.updateRequirementStatus(item.id, newStatus);
            } else {
                res = await API.updateQuestionStatus(item.id, newStatus);
            }

            if (!res.ok) throw new Error("Status update failed");
        } catch (err) {
            console.error("Status update error", err);
            // Revert
            item.status = oldStatus;
            if (type === 'req') {
                Storage.saveRequirements(items);
                renderRequirements();
            } else {
                Storage.saveQuestions(items);
                renderQuestions();
            }
            showToast('Nie udało się zapisać statusu online', 'error');
        }
    }

    async function retrySync(type, item) {
        // Remove error flag first (optimistic)
        item.syncError = false;
        if (type === 'req') Storage.updateRequirement(item);
        else Storage.updateQuestion(item);

        if (type === 'req') renderRequirements();
        else renderQuestions();

        try {
            // Note: Retrying ADD vs UPDATE logic is needed.
            // Simplified: If it was an ADD error, we call add. If STATUS error... complex to track.
            // For MVP: We assume most errors are ADD errors or we just try ADD again if it looks like a local ID.

            // Logic: If ID starts with 'local-', it's an un-synced ADD.
            // If ID is real (db ID), it's likely a STATUS update failure (or we don't handle that yet clearly).
            // The prompt says "if error -> undo change". So status errors revert immediately.
            // Thus, syncError persists primarily for failed ADDs that we kept locally.

            if (String(item.id).startsWith('local-')) {
                // Retry Add
                let res;
                if (type === 'req') {
                    res = await API.addRequirement(item); // item has extra fields but API should ignore/handle
                } else {
                    res = await API.addQuestion(item);
                }

                if (res && res.id) {
                    item.id = res.id;
                    if (type === 'req') Storage.updateRequirement(item);
                    else Storage.updateQuestion(item);
                    showToast('Zsynchronizowano pomyślnie', 'success');
                }
            } else {
                // Used to be a status update error? 
                // But we revert status updates on error.
                // So this branch might not be reached unless we change logic.
                // Leaving for safety.
                showToast('Brak akcji dla tego błędu', 'error');
            }
        } catch (err) {
            item.syncError = true;
            if (type === 'req') Storage.updateRequirement(item);
            else Storage.updateQuestion(item);
            if (type === 'req') renderRequirements();
            else renderQuestions();
            showToast('Ponowna próba nieudana', 'error');
        }
    }

    // --- Drag & Drop (Global for Columns) ---
    function setupGlobalEvents() {
        const columns = document.querySelectorAll('.kanban-column');
        columns.forEach(col => {
            col.addEventListener('dragover', (e) => {
                e.preventDefault();
                col.classList.add('drag-over');
            });
            col.addEventListener('dragleave', () => {
                col.classList.remove('drag-over');
            });
            col.addEventListener('drop', (e) => {
                e.preventDefault();
                col.classList.remove('drag-over');
                const targetStatus = col.dataset.status;

                if (currentDragItem && currentDragItem.status !== targetStatus) {
                    changeStatus(currentDragType, currentDragItem.id, targetStatus);
                }
            });
        });
    }

    // --- Settings ---
    function setupSettings() {
        const settings = Storage.getSettings();
        settingsAuthorInput.value = settings.author;

        settingsAuthorInput.addEventListener('change', () => {
            const newSettings = { author: settingsAuthorInput.value };
            Storage.saveSettings(newSettings);
            showToast('Zapisano ustawienia', 'success');
        });

        clearDataBtn.addEventListener('click', () => {
            if (confirm('Czy na pewno wyczyścić wszystkie dane lokalne?')) {
                Storage.clearAll();
                location.reload();
            }
        });
    }

    // --- Toast ---
    function showToast(msg, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast show';
        if (type === 'error') toast.style.backgroundColor = '#FF3B30';
        if (type === 'success') toast.style.backgroundColor = '#34C759';

        toast.innerText = msg;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
});
