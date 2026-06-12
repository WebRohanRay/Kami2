export const getRotationAngle = (id: string) => {
  const charCodeSum = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return charCodeSum % 2 === 0 ? '1.2deg' : '-1.2deg';
};

export const getStarCoordinates = (index: number) => {
  const positions = [
    { x: 15, y: 12 }, { x: 72, y: 15 }, { x: 42, y: 28 }, { x: 80, y: 40 },
    { x: 20, y: 48 }, { x: 50, y: 62 }, { x: 82, y: 72 }, { x: 28, y: 78 },
    { x: 68, y: 82 }, { x: 12, y: 32 }, { x: 58, y: 10 }, { x: 88, y: 22 },
    { x: 28, y: 24 }, { x: 74, y: 30 }, { x: 34, y: 58 }, { x: 62, y: 50 },
    { x: 15, y: 68 }, { x: 48, y: 42 }, { x: 68, y: 64 }, { x: 88, y: 85 },
  ];
  return positions[index % positions.length];
};

export const getStarOpacity = (memoryDate: string) => {
  const ageDays = Math.max(1, (Date.now() - new Date(memoryDate).getTime()) / 86400000);
  const opacity = Math.max(0.35, 1.0 - (ageDays / 180));
  return opacity;
};
