'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PromptInput } from '@/components/studio/home/PromptInput';
import { PlatformPicker } from '@/components/studio/home/PlatformPicker';
import { GenerateButton } from '@/components/studio/home/GenerateButton';
import { startGeneration } from '@/lib/studio/runGeneration';
import type { Platform, TwitterModeHint } from '@/lib/studio/types';

function parsePlatforms(value: string | null): Platform[] | null {
  if (!value) return null;
  const allowed = new Set<Platform>(['wechat', 'xhs', 'twitter', 'video']);
  const parsed = value
    .split(',')
    .map((v) => v.trim())
    .filter((v): v is Platform => allowed.has(v as Platform));
  return parsed.length > 0 ? parsed : null;
}

function StudioHome() {
  const router = useRouter();
  const search = useSearchParams();
  const initialPrompt = search.get('prompt') ?? '';
  const initialPlatforms = parsePlatforms(search.get('platforms')) ?? ['wechat', 'xhs'];
  const [input, setInput] = useState(initialPrompt);
  const [platforms, setPlatforms] = useState<Platform[]>(initialPlatforms);
  const [twitterHint, setTwitterHint] = useState<TwitterModeHint>('auto');
  const autoStarted = useRef(false);

  const canGenerate = input.trim().length > 0 && platforms.length > 0;

  function togglePlatform(p: Platform) {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }

  async function handleGenerate() {
    if (!canGenerate) return;
    const id = await startGeneration({ input: input.trim(), platforms, twitterHint });
    router.push(`/studio/workspace/${id}`);
  }

  useEffect(() => {
    if (autoStarted.current || search.get('auto') !== '1') return;
    const prompt = search.get('prompt')?.trim();
    if (!prompt) return;

    autoStarted.current = true;
    const selectedPlatforms = parsePlatforms(search.get('platforms')) ?? ['wechat'];

    startGeneration({ input: prompt, platforms: selectedPlatforms, twitterHint }).then((sessionId) => {
      const publish = search.get('publish') === 'wechat' && selectedPlatforms.includes('wechat');
      router.replace(`/studio/workspace/${sessionId}${publish ? '?publish=wechat' : ''}`);
    });
  }, [router, search, twitterHint]);

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

export default function HomePage() {
  return (
    <Suspense>
      <StudioHome />
    </Suspense>
  );
}
