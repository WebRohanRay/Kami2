import React, { useState, useEffect } from 'react';
import KamiText from '@shared/ui/atoms/KamiText';
import { formatCountdown } from './utils';

interface CountdownTextProps {
  deliverAt: string;
  color?: string;
  style?: any;
  variant?: any;
}

export const CountdownText: React.FC<CountdownTextProps> = ({
  deliverAt,
  color = '#7f1d1d',
  style = { fontSize: 9 },
  variant = 'caption',
}) => {
  const [text, setText] = useState(() => formatCountdown(deliverAt));

  useEffect(() => {
    let timerId: any = null;

    const tick = () => {
      const diffMs = new Date(deliverAt).getTime() - Date.now();
      if (diffMs <= 0) {
        setText('Unlocked');
        return;
      }
      setText(formatCountdown(deliverAt));

      // Tick every second if < 5 mins, else tick every 60 seconds
      const nextInterval = diffMs < 300000 ? 1000 : 60000;
      timerId = setTimeout(tick, nextInterval);
    };

    tick();
    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [deliverAt]);

  return (
    <KamiText variant={variant} color={color} style={style}>
      {text}
    </KamiText>
  );
};
