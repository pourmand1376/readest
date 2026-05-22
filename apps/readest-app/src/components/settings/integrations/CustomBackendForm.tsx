import clsx from 'clsx';
import React, { useState } from 'react';
import { useEnv } from '@/context/EnvContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/store/settingsStore';
import { eventDispatcher } from '@/utils/event';
import { fetchBackendConfig, BackendConfigError } from '@/services/backendConfig';
import { setCustomBackendConfig, clearCustomBackendConfig } from '@/services/runtimeConfig';
import SubPageHeader from '../SubPageHeader';
import { SectionTitle, SettingLabel } from '../primitives';

interface CustomBackendFormProps {
  onBack: () => void;
}

/** Delay (ms) before reloading the page after saving backend config. */
const RELOAD_DELAY_MS = 1500;

/**
 * Show an informational toast then reload the page after a short delay so the
 * user can read the message before the transition.
 */
const reloadAfterToast = (message: string) => {
  eventDispatcher.dispatch('toast', { message, type: 'info' });
  setTimeout(() => window.location.reload(), RELOAD_DELAY_MS);
};

const CustomBackendForm: React.FC<CustomBackendFormProps> = ({ onBack }) => {
  const _ = useTranslation();
  const { settings, setSettings, saveSettings } = useSettingsStore();
  const { envConfig } = useEnv();

  const [url, setUrl] = useState(settings.customBackendUrl || '');
  const [isConnecting, setIsConnecting] = useState(false);

  const isConfigured = !!settings.customBackendConfig;

  const handleConnect = async () => {
    if (!url.trim()) return;
    setIsConnecting(true);
    try {
      const config = await fetchBackendConfig(url.trim());
      const newSettings = {
        ...settings,
        customBackendUrl: url.trim(),
        customBackendConfig: config,
      };
      setSettings(newSettings);
      await saveSettings(envConfig, newSettings);
      // Persist to localStorage so it is available synchronously on the next
      // page load (before async settings.json is read).
      setCustomBackendConfig(config);
      reloadAfterToast(_('Backend connected. Reloading to apply configuration…'));
    } catch (err) {
      const message = err instanceof BackendConfigError ? err.message : String(err);
      eventDispatcher.dispatch('toast', {
        message: `${_('Failed to connect')}: ${message}`,
        type: 'error',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    const newSettings = {
      ...settings,
      customBackendUrl: undefined,
      customBackendConfig: undefined,
    };
    setSettings(newSettings);
    await saveSettings(envConfig, newSettings);
    clearCustomBackendConfig();
    reloadAfterToast(_('Backend disconnected. Reloading to apply configuration…'));
  };

  const description: string = isConfigured
    ? _('Connected to {{url}}', { url: settings.customBackendUrl ?? '' })
    : _('Connect to a self-hosted Readest backend.');

  return (
    <div className='w-full'>
      <SubPageHeader
        parentLabel={_('Integrations')}
        currentLabel={_('Custom Backend')}
        description={description}
        onBack={onBack}
      />

      {isConfigured ? (
        <div className='space-y-5'>
          <div className='card eink-bordered border-base-200 bg-base-100 overflow-hidden border'>
            <div className='divide-base-200 divide-y'>
              <div className='-me-2 flex min-h-14 items-center justify-between gap-3 px-4'>
                <SettingLabel>{_('Backend URL')}</SettingLabel>
                <span className='text-base-content/65 max-w-[60%] truncate text-end text-sm'>
                  {settings.customBackendUrl}
                </span>
              </div>
            </div>
          </div>

          <div className='flex justify-end'>
            <button
              type='button'
              onClick={handleDisconnect}
              className={clsx(
                'eink-bordered',
                'h-10 rounded-lg px-4 text-sm font-medium',
                'text-error hover:bg-error/10',
                'transition-colors duration-150',
                'focus-visible:ring-error/40 focus-visible:outline-none focus-visible:ring-2',
              )}
            >
              {_('Disconnect')}
            </button>
          </div>
        </div>
      ) : (
        <div className='space-y-5'>
          <form
            className='space-y-4'
            onSubmit={(e) => {
              e.preventDefault();
              handleConnect();
            }}
          >
            <div className='space-y-1.5'>
              <SectionTitle as='label' htmlFor='custom-backend-url' className='block'>
                {_('Server URL')}
              </SectionTitle>
              <input
                id='custom-backend-url'
                type='url'
                placeholder='https://readest.myserver.com'
                className='input input-bordered eink-bordered h-11 w-full text-sm focus:outline-none'
                spellCheck='false'
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>

            <div className='flex justify-end pt-1'>
              <button
                type='submit'
                disabled={isConnecting || !url.trim()}
                className={clsx(
                  'btn btn-primary',
                  'h-10 min-h-10 rounded-lg border-0 px-5 text-sm font-medium',
                  'focus-visible:ring-primary/40 focus-visible:outline-none focus-visible:ring-2',
                  isConnecting && 'opacity-60',
                )}
              >
                {isConnecting ? (
                  <span className='loading loading-spinner loading-sm' />
                ) : (
                  _('Connect')
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default CustomBackendForm;
