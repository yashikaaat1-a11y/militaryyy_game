export function getTerrainHeight(x, y, scenarioType) {
  let height = 0;
  
  if (scenarioType === 'MOUNTAIN') {
    height = Math.sin(x * 0.15) * 3 + Math.cos(y * 0.1) * 4 + Math.sin(x * 0.5 + y * 0.5) * 0.5;
    // Smoothly flatten the center to avoid a sharp square cliff
    const dist = Math.sqrt(x * x + y * y);
    if (dist < 8) {
      height *= (dist / 8); 
    }
  } else if (scenarioType === 'RIVER') {
    height = Math.sin(x * 0.2) * 0.5 + Math.cos(y * 0.2) * 0.5;
    // River trench
    if (x > -2 && x < 4) {
      height = -1.5;
    }
  } else if (scenarioType === 'DESERT') {
    // Dunes
    height = Math.sin(x * 0.3) * 0.8 + Math.sin(y * 0.2) * 0.6;
  } else {
    // URBAN (Rolling hills)
    height =
      Math.sin(x * 0.3) * 0.4 +
      Math.cos(y * 0.2) * 0.3 +
      Math.sin(x * 0.7 + y * 0.5) * 0.15;
  }
  
  return height;
}
