import { useState, useCallback } from 'react';

export type VatStep = 1 | 2 | 3 | 4 | 5;

export function useVatWorkflow() {
  const [step, setStepRaw] = useState<VatStep>(() => {
    const saved = localStorage.getItem('wfStep');
    return (saved ? parseInt(saved) : 1) as VatStep;
  });

  const [dateFolder, setDateFolder] = useState<string | null>(
    () => localStorage.getItem('kakaoFolder'),
  );

  const setStep = useCallback((s: VatStep) => {
    setStepRaw(s);
    localStorage.setItem('wfStep', String(s));
  }, []);

  const startFresh = useCallback(() => {
    localStorage.removeItem('wfStep');
    localStorage.removeItem('kakaoFolder');
    localStorage.removeItem('kakaoFilter');
    setStepRaw(1);
    setDateFolder(null);
  }, []);

  const saveFolder = useCallback((folder: string) => {
    setDateFolder(folder);
    localStorage.setItem('kakaoFolder', folder);
  }, []);

  return { step, setStep, dateFolder, setDateFolder: saveFolder, startFresh };
}
