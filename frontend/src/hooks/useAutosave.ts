import { useState, useEffect, useRef, useCallback } from 'react';
import { saveDraftLocally, getDraft, deleteDraft, DraftEntry } from '../lib/db';
import api from '../lib/api';

export type DraftStatus = 'idle' | 'saving_local' | 'saving_server' | 'saved' | 'error';

interface UseAutosaveOptions {
    formType: 'evaluation' | 'final_inspection';
    draftKey: string;
    getFormData: () => any;
    getImageSlots?: () => any;
    serverId?: string | null;           // existing inspection ID from editing
    enabled?: boolean;                  // can disable autosave (e.g. when viewing, not editing)
    localDebounceMs?: number;           // debounce for local save (default 2000ms)
}

interface UseAutosaveReturn {
    draftStatus: DraftStatus;
    lastSavedAt: Date | null;
    existingDraft: DraftEntry | null;   // populated if a draft was found on mount
    resumeDraft: () => DraftEntry | null; // call to get draft data for restoring
    clearDraft: () => Promise<void>;    // call after successful submit
    saveDraftNow: () => Promise<void>;  // manual draft save trigger
    dismissDraft: () => Promise<void>;  // discard local draft
    triggerLocalSave: () => void;       // trigger local save (debounced)
}

export function useAutosave({
    formType,
    draftKey,
    getFormData,
    getImageSlots,
    serverId = null,
    enabled = true,
    localDebounceMs = 2000,
}: UseAutosaveOptions): UseAutosaveReturn {
    const [draftStatus, setDraftStatus] = useState<DraftStatus>('idle');
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const [existingDraft, setExistingDraft] = useState<DraftEntry | null>(null);
    const [serverDraftId, setServerDraftId] = useState<string | null>(serverId || null);

    const localTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isDirtyRef = useRef(false);
    const mountedRef = useRef(true);
    const prevEnabledRef = useRef(enabled);

    // Track current values via refs to avoid re-creating callbacks
    const getFormDataRef = useRef(getFormData);
    const getImageSlotsRef = useRef(getImageSlots);
    const draftKeyRef = useRef(draftKey);
    const serverDraftIdRef = useRef(serverDraftId);

    // Sync serverDraftId when the serverId prop changes (e.g. opening a draft via Continue)
    useEffect(() => { setServerDraftId(serverId || null); }, [serverId]);

    useEffect(() => { getFormDataRef.current = getFormData; }, [getFormData]);
    useEffect(() => { getImageSlotsRef.current = getImageSlots; }, [getImageSlots]);
    useEffect(() => { draftKeyRef.current = draftKey; }, [draftKey]);
    useEffect(() => { serverDraftIdRef.current = serverDraftId; }, [serverDraftId]);

    // ===== Save to IndexedDB (local) =====
    const saveToLocal = useCallback(async () => {
        if (!enabled) return;
        try {
            setDraftStatus('saving_local');
            const formData = getFormDataRef.current();
            const imageSlots = getImageSlotsRef.current ? getImageSlotsRef.current() : [];

            const entry: DraftEntry = {
                draftKey: draftKeyRef.current,
                formData,
                imageSlots,
                serverId: serverDraftIdRef.current || undefined,
                updatedAt: Date.now(),
                formType,
            };

            await saveDraftLocally(entry);
            if (mountedRef.current) {
                setDraftStatus('saved');
                setLastSavedAt(new Date());
            }
        } catch (err) {
            console.error('[useAutosave] Local save failed:', err);
            if (mountedRef.current) setDraftStatus('error');
        }
    }, [enabled, formType]);

    // ===== Save to server =====
    const saveToServer = useCallback(async () => {
        if (!enabled || !navigator.onLine) return;

        try {
            setDraftStatus('saving_server');
            const formData = getFormDataRef.current();

            const endpoint = formType === 'evaluation' ? '/inspections/' : '/final-inspections/';
            const payload = { ...formData, is_draft: true };

            // Clean payload: remove empty strings for FK fields that expect null
            if (payload.customer === '' || payload.customer === undefined) payload.customer = null;
            if (payload.template === '' || payload.template === undefined) payload.template = null;

            let responseId: string;

            if (serverDraftIdRef.current) {
                // Update existing server draft
                await api.patch(`${endpoint}${serverDraftIdRef.current}/`, payload);
                responseId = serverDraftIdRef.current;
            } else {
                // Create new server draft — need at least a style name
                if (!payload.style || payload.style.trim() === '') {
                    // Not enough data to save to server yet, just keep local
                    setDraftStatus('saved');
                    return;
                }
                const response = await api.post(endpoint, payload);
                responseId = response.data.id;
                setServerDraftId(responseId);
            }

            // Update local draft with serverId
            const entry: DraftEntry = {
                draftKey: draftKeyRef.current,
                formData,
                imageSlots: getImageSlotsRef.current ? getImageSlotsRef.current() : [],
                serverId: responseId,
                updatedAt: Date.now(),
                formType,
            };
            await saveDraftLocally(entry);

            if (mountedRef.current) {
                setDraftStatus('saved');
                setLastSavedAt(new Date());
            }
        } catch (err) {
            console.error('[useAutosave] Server save failed:', err);
            if (mountedRef.current) setDraftStatus('error');
        }
    }, [enabled, formType]);

    // ===== Trigger local save with debounce =====
    const triggerLocalSave = useCallback(() => {
        if (!enabled) return;
        isDirtyRef.current = true;
        if (localTimerRef.current) clearTimeout(localTimerRef.current);
        localTimerRef.current = setTimeout(() => {
            saveToLocal();
        }, localDebounceMs);
    }, [enabled, localDebounceMs, saveToLocal]);

    // ===== Manual save-now (e.g. Save as Draft button) =====
    const saveDraftNow = useCallback(async () => {
        await saveToLocal();
        await saveToServer();
    }, [saveToLocal, saveToServer]);

    // NOTE: No periodic server sync — server saves only happen via "Save as Draft" button

    // ===== Check for existing draft when enabled transitions to true =====
    useEffect(() => {
        const justEnabled = enabled && !prevEnabledRef.current;
        prevEnabledRef.current = enabled;

        if (!enabled) {
            // Reset state when disabled (form closed) and clear any pending save
            if (localTimerRef.current) clearTimeout(localTimerRef.current);
            setExistingDraft(null);
            return;
        }

        if (justEnabled) {
            // Form just opened — check for existing draft
            const checkForDraft = async () => {
                try {
                    const draft = await getDraft(draftKey);
                    if (draft && mountedRef.current) {
                        console.log('[useAutosave] Found existing draft:', draft.draftKey, 'updated:', new Date(draft.updatedAt));
                        setExistingDraft(draft);
                        if (draft.serverId) {
                            setServerDraftId(draft.serverId);
                        }
                    }
                } catch (err) {
                    console.error('[useAutosave] Failed to check for draft:', err);
                }
            };
            checkForDraft();
        }
    }, [draftKey, enabled]);

    // ===== Resume draft — returns the draft data directly =====
    const resumeDraft = useCallback((): DraftEntry | null => {
        if (existingDraft) {
            const draft = existingDraft;
            if (draft.serverId) {
                setServerDraftId(draft.serverId);
            }
            setExistingDraft(null);
            return draft;
        }
        return null;
    }, [existingDraft]);

    // ===== Dismiss draft =====
    const dismissDraft = useCallback(async () => {
        try {
            await deleteDraft(draftKeyRef.current);
            setExistingDraft(null);
        } catch (err) {
            console.error('[useAutosave] Failed to dismiss draft:', err);
        }
    }, []);

    // ===== Clear draft (on successful submit) =====
    const clearDraft = useCallback(async () => {
        try {
            await deleteDraft(draftKeyRef.current);
            // If we had a server draft, it's now been finalized (is_draft=false via submit)
            setServerDraftId(null);
            setExistingDraft(null);
            setDraftStatus('idle');
            setLastSavedAt(null);
        } catch (err) {
            console.error('[useAutosave] Failed to clear draft:', err);
        }
    }, []);

    // ===== Cleanup on unmount =====
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (localTimerRef.current) clearTimeout(localTimerRef.current);
        };
    }, []);

    // ===== Listen for form changes — expose triggerLocalSave =====
    // The component using this hook should call triggerLocalSave() in a useEffect watching form state
    // We attach it to the return so the component can wire it up
    return {
        draftStatus,
        lastSavedAt,
        existingDraft,
        resumeDraft,
        clearDraft,
        saveDraftNow,
        dismissDraft,
        triggerLocalSave,
    };
}
