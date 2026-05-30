'use client';

import { useTheme } from '@/context/ThemeContext';
import CityCanvas          from './CityCanvas';
import RainforestCanvas    from './RainforestCanvas';
import SuburbanCanvas      from './SuburbanCanvas';
import SpaceCanvas         from './SpaceCanvas';
import CitySkylineCanvas   from './CitySkylineCanvas';
import NatureCanvas        from './NatureCanvas';
import DesertCanvas        from './DesertCanvas';
import SolarSystemCanvas   from './SolarSystemCanvas';

export default function BackgroundCanvas() {
  const { bgTheme } = useTheme();
  switch (bgTheme) {
    case 'rainforest':  return <RainforestCanvas />;
    case 'suburban':    return <SuburbanCanvas />;
    case 'space':       return <SpaceCanvas />;
    case 'skyline':     return <CitySkylineCanvas />;
    case 'nature':      return <NatureCanvas />;
    case 'desert':      return <DesertCanvas />;
    case 'solarsystem': return <SolarSystemCanvas />;
    default:            return <CityCanvas />;
  }
}
