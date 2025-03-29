export interface CalculationResult {
  totalPartyHitDice: number;
  totalMonsterHitDice: number;
  totalXp: number;
  xpPerCharacter: number;
  averagePartyLevel: number;
  adjustmentFactor: number;
}

export interface SavedCalculation {
  id: string;
  date: Date;
  characters: any[];  // Store the raw character data
  monsters: any[];    // Store the raw monster data
  result: CalculationResult;
}
