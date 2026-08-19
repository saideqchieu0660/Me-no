// @sandbox-feature: True
// @data-isolation: STRICT_MOCK_ONLY
// @target-core-override: None
// # REGION SANDBOX - DO NOT TOUCH CORE

import React, { useState, useEffect } from 'react';
import { SandboxStorage } from './core-isolation/sandbox-storage';
import { sandboxFetch, sandboxDb } from './core-isolation/sandbox-api';

export const SandboxExample = () => {
  const [data, setData] = useState('');
  const [storedData, setStoredData] = useState<string | null>(null);

  useEffect(() => {
    setStoredData(SandboxStorage.getItem('test_key'));
  }, []);

  const handleSave = () => {
    SandboxStorage.setItem('test_key', data);
    setStoredData(data);
    setData('');
    console.log('Saved to isolated sandbox storage');
  };

  const handleFetchCore = async () => {
    try {
      await sandboxFetch('/api/v1/users/profile'); // This should trigger the red-flag
    } catch (err: any) {
      alert(err.message);
    }
  };
  
  const handleMutateCoreDb = () => {
    try {
      sandboxDb.collection('users'); // This should trigger the red-flag
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8">
      <h2 className="text-2xl font-bold text-zinc-800 dark:text-zinc-200">
        Sandbox Strict Isolation Demo
      </h2>
      
      <div className="flex flex-col gap-4 p-6 border border-zinc-200 dark:border-zinc-800 rounded-lg w-full max-w-md">
        <h3 className="font-semibold text-zinc-700 dark:text-zinc-300">Isolated Storage</h3>
        <p className="text-sm text-zinc-500">Current stored value (sb_test_key): {storedData || 'None'}</p>
        <div className="flex gap-2">
          <input 
            value={data} 
            onChange={e => setData(e.target.value)} 
            className="border border-zinc-300 dark:border-zinc-700 p-2 rounded flex-1 bg-transparent text-zinc-900 dark:text-white"
            placeholder="Type isolated data..."
          />
          <button onClick={handleSave} className="bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 px-4 py-2 rounded font-medium">
            Save
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-6 border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-950/10 rounded-lg w-full max-w-md">
        <h3 className="font-semibold text-red-700 dark:text-red-400">Trigger Red-Flags</h3>
        <button onClick={handleFetchCore} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-medium transition-colors">
          Attempt Core API Fetch
        </button>
        <button onClick={handleMutateCoreDb} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-medium transition-colors">
          Attempt Core DB Access
        </button>
      </div>
    </div>
  );
};
