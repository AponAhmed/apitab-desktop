import { useCallback } from 'react';
import { useRequestStore } from '@/stores/requestStore';
import { useDialogStore } from '@/stores/dialogStore';
import { useActiveVariables } from './useActiveVariables';
import { prepareRequest } from '@/services/requestService';
import { buildCurl } from '@/utils/curl';
import { toast } from '@/stores/toastStore';

/** Shared request actions wired to keyboard shortcuts and toolbar buttons. */
export function useRequestActions() {
  const vars = useActiveVariables();

  const save = useCallback(() => {
    const { savedRef, updateSaved } = useRequestStore.getState();
    if (savedRef) {
      updateSaved();
      toast.success('Request updated');
    } else {
      useDialogStore.getState().openSaveRequest();
    }
  }, []);

  const copyCurl = useCallback(async () => {
    const { request } = useRequestStore.getState();
    const curl = buildCurl(prepareRequest(request, vars));
    try {
      await navigator.clipboard.writeText(curl);
      toast.success('cURL copied to clipboard');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }, [vars]);

  const send = useCallback(() => {
    void useRequestStore.getState().send();
  }, []);

  const newRequest = useCallback(() => {
    useRequestStore.getState().newRequest();
    toast.info('New request');
  }, []);

  return { save, copyCurl, send, newRequest };
}
