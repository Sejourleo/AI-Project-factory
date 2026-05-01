'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PromptInput } from '@/components/studio/home/PromptInput';
import { PlatformPicker } from '@/components/studio/home/PlatformPicker';
import { GenerateButton } from '@/components/studio/home/GenerateButton';
import { startGeneration } from '@/lib/studio/runGeneration';
import type { Platform, TwitterModeHint } from '@/lib/studio/types';

export default function HomePage() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [platforms, setPlatforms] = useState<Platform[]>(['wechat', 'xhs']);
  const [twitterHint, setTwitterHint] = useState<TwitterModeHint>('auto');

  const canGenerate = input.trim().length > 0 && platforms.length > 0;

  function togglePlatform(p: Platform) {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }

  async function handleGenerate() {
    if (!canGenerate) return;
    const id = await startGeneration({ input: input.trim(), platforms, twitterHint });
    router.push(`/studio/workspace/${id}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 pt-12 pb-20 space-y-10">
      <header className="text-center space-y-2 mt-8">
        <h1 className="font-serif text-4xl">内容工厂</h1>
        <p className="text-[var(--color-muted)] text-sm">
          一次输入，多平台同步生成
        </p>
      </header>

      <PromptInput value={input} onChange={setInput} />
      <PlatformPicker
        selected={platforms}
        onToggle={togglePlatform}
        twitterHint={twitterHint}
        onTwitterHintChange={setTwitterHint}
      />
      <GenerateButton disabled={!canGenerate} onClick={handleGenerate} />
    </div>
  );
}
