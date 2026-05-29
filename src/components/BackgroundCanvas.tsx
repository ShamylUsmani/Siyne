'use client';

import { useTheme } from '@/context/ThemeContext';
import CityCanvas from './CityCanvas';
import RainforestCanvas from './RainforestCanvas';

export default function BackgroundCanvas() {
  const { bgTheme } = useTheme();
  return bgTheme === 'rainforest' ? <RainforestCanvas /> : <CityCanvas />;
}
