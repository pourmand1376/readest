'use client';

import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { EnvConfigType } from '../services/environment';
import { AppService } from '@/types/system';
import env from '../services/environment';
import { bootstrapReplicaAdapters } from '@/services/sync/replicaBootstrap';
import { initReplicaSync } from '@/services/sync/replicaSync';
import { createSettingsCursorStore } from '@/services/sync/replicaCursorStore';
import { startReplicaTransferIntegration } from '@/services/sync/replicaTransferIntegration';
import { enableReplicaAutoPersist } from '@/services/sync/replicaPersist';
import { getCustomBackendConfig, setCustomBackendConfig } from '@/services/runtimeConfig';

interface EnvContextType {
  envConfig: EnvConfigType;
  appService: AppService | null;
}

const EnvContext = createContext<EnvContextType | undefined>(undefined);

export const EnvProvider = ({ children }: { children: ReactNode }) => {
  const [envConfig] = useState<EnvConfigType>(env);
  const [appService, setAppService] = useState<AppService | null>(null);

  React.useEffect(() => {
    bootstrapReplicaAdapters();
    enableReplicaAutoPersist(envConfig);
    envConfig.getAppService().then(async (service) => {
      setAppService(service);
      try {
        const settings = await service.loadSettings();
        // Sync custom backend config to localStorage so supabase.ts can pick it
        // up on the next page load (it reads localStorage synchronously at module
        // init time, before settings are loaded). This handles the common case
        // where localStorage was cleared but settings.json still has the config.
        if (settings.customBackendConfig) {
          const lsConfig = getCustomBackendConfig();
          if (!lsConfig || lsConfig.apiBaseUrl !== settings.customBackendConfig.apiBaseUrl) {
            setCustomBackendConfig(settings.customBackendConfig);
          }
        }
        if (settings.replicaDeviceId) {
          const ctx = initReplicaSync({
            deviceId: settings.replicaDeviceId,
            cursorStore: createSettingsCursorStore(service),
          });
          ctx.manager.startAutoSync();
          startReplicaTransferIntegration(service);
        }
      } catch (err) {
        console.warn('replica sync init failed', err);
      }
    });
    window.addEventListener('error', (e) => {
      if (e.message === 'ResizeObserver loop limit exceeded') {
        e.stopImmediatePropagation();
        e.preventDefault();
        return true;
      }
      return false;
    });
  }, [envConfig]);

  const value = useMemo(() => ({ envConfig, appService }), [envConfig, appService]);
  return <EnvContext.Provider value={value}>{children}</EnvContext.Provider>;
};

export const useEnv = (): EnvContextType => {
  const context = useContext(EnvContext);
  if (!context) throw new Error('useEnv must be used within EnvProvider');
  return context;
};
