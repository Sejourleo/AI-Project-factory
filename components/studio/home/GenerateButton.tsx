'use client';
import { Button } from '@/components/studio/ui/Button';

interface Props {
  disabled: boolean;
  onClick: () => void;
}

export function GenerateButton({ disabled, onClick }: Props) {
  return (
    <Button size="lg" onClick={onClick} disabled={disabled} className="w-full">
      生成
    </Button>
  );
}
