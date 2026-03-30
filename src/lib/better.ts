// @/lib/better.ts

export const getBetterPercentage = (points: number) => {
    const betterPercentage = Math.floor(points / 150) * 100;
    return betterPercentage;
};