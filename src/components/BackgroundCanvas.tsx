'use client';

import { useTheme } from '@/context/ThemeContext';
import CityCanvas        from './CityCanvas';
import RainforestCanvas  from './RainforestCanvas';
import SuburbanCanvas    from './SuburbanCanvas';
import SpaceCanvas       from './SpaceCanvas';
import CitySkylineCanvas from './CitySkylineCanvas';
import NatureCanvas      from './NatureCanvas';
import DesertCanvas      from './DesertCanvas';
import AlpsCanvas        from './AlpsCanvas';

export default function BackgroundCanvas() {
  const { bgTheme } = useTheme();
  switch (bgTheme) {
    case 'rainforest': return <RainforestCanvas />;
    case 'suburban':   return <SuburbanCanvas />;
    case 'space':      return <SpaceCanvas />;
    case 'skyline':    return <CitySkylineCanvas />;
    case 'nature':     return <NatureCanvas />;
    case 'desert':     return <DesertCanvas />;
    case 'alps':       return <AlpsCanvas />;
    default:           return <CityCanvas />;
  }
}
