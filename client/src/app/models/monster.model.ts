export interface Monster {
  id: number;
  hitDice: number;
  modifier: number;
  count: number;
  effectiveHitDice: number; // calculated field: hitDice + (modifier * 0.25)
}

export interface MonsterFormValue {
  hitDice: number;
  modifier: number;
  count: number;
}
