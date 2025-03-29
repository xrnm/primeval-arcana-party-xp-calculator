export interface Character {
  id: number;
  hitDice: number;
  modifier: number;
  effectiveHitDice: number; // calculated field: hitDice + (modifier * 0.25)
}

export interface CharacterFormValue {
  hitDice: number;
  modifier: number;
}
