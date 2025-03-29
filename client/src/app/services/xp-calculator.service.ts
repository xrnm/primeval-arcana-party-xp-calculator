import { Injectable } from '@angular/core';
import { Character } from '../models/character.model';
import { Monster } from '../models/monster.model';
import { CalculationResult, SavedCalculation } from '../models/calculation-result.model';

@Injectable({
  providedIn: 'root'
})
export class XpCalculatorService {
  private readonly STORAGE_KEY = 'odnd-xp-calculations';
  
  // Base XP per hit die (this is an approximation for oDND rules)
  private readonly BASE_XP_PER_HD = 100;
  
  // Modifier is worth 25% of a hit die in oDND
  private readonly MODIFIER_FACTOR = 0.25;
  
  constructor() { }

  /**
   * Calculate effective hit dice including modifiers
   */
  calculateEffectiveHitDice(hitDice: number, modifier: number): number {
    return hitDice + (modifier * this.MODIFIER_FACTOR);
  }

  /**
   * Calculate the level adjustment factor based on party level vs monster level
   * In oDND, XP is reduced when fighting lower-level monsters
   */
  calculateAdjustmentFactor(partyLevel: number, monsterLevel: number): number {
    const levelDiff = partyLevel - monsterLevel;
    
    if (levelDiff <= 0) return 1.0;  // Equal or higher level monsters give full XP
    
    // Adjustment scale for lower level monsters
    if (levelDiff === 1) return 0.8;
    if (levelDiff === 2) return 0.6;
    if (levelDiff === 3) return 0.4;
    if (levelDiff >= 4) return 0.2;
    
    return 1.0;
  }

  /**
   * Main calculation function for XP
   */
  calculateXp(characters: Character[], monsters: Monster[]): CalculationResult {
    if (!characters.length || !monsters.length) {
      return {
        totalPartyHitDice: 0,
        totalMonsterHitDice: 0,
        totalXp: 0,
        xpPerCharacter: 0,
        averagePartyLevel: 0,
        adjustmentFactor: 0
      };
    }

    // Calculate total party hit dice with modifiers
    const totalPartyHitDice = characters.reduce((sum, char) => 
      sum + this.calculateEffectiveHitDice(char.hitDice, char.modifier), 0);
    
    // Use hit dice as a rough proxy for level in oDND
    const averagePartyLevel = totalPartyHitDice / characters.length;
    
    // Calculate total monster hit dice with modifiers and count
    let totalMonsterHitDice = 0;
    let totalMonsterXp = 0;
    
    monsters.forEach(monster => {
      const effectiveHD = this.calculateEffectiveHitDice(monster.hitDice, monster.modifier);
      const count = monster.count || 1;
      
      // Calculate adjustment based on level difference
      const adjustmentFactor = this.calculateAdjustmentFactor(averagePartyLevel, effectiveHD);
      
      // Add to total hit dice
      totalMonsterHitDice += effectiveHD * count;
      
      // Calculate XP for this monster type
      const monsterXp = this.BASE_XP_PER_HD * effectiveHD * count * adjustmentFactor;
      totalMonsterXp += monsterXp;
    });
    
    // Overall adjustment factor (for display purposes)
    const adjustmentFactor = characters.length > 0 ? 
      totalMonsterXp / (this.BASE_XP_PER_HD * totalMonsterHitDice) : 1;
    
    // Divide XP among party members
    const xpPerCharacter = characters.length > 0 ? 
      Math.floor(totalMonsterXp / characters.length) : 0;
    
    return {
      totalPartyHitDice,
      totalMonsterHitDice,
      totalXp: Math.floor(totalMonsterXp),
      xpPerCharacter,
      averagePartyLevel,
      adjustmentFactor
    };
  }

  /**
   * Save a calculation to local storage
   */
  saveCalculation(characters: Character[], monsters: Monster[], result: CalculationResult): void {
    // Get existing saved calculations
    const existingData = this.getSavedCalculations();
    
    // Create new calculation entry
    const newCalculation: SavedCalculation = {
      id: Date.now().toString(),
      date: new Date(),
      characters,
      monsters,
      result
    };
    
    // Add to array and save back to storage
    existingData.push(newCalculation);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(existingData));
  }

  /**
   * Get all saved calculations from local storage
   */
  getSavedCalculations(): SavedCalculation[] {
    const data = localStorage.getItem(this.STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  /**
   * Delete a saved calculation
   */
  deleteSavedCalculation(id: string): void {
    const calculations = this.getSavedCalculations();
    const filtered = calculations.filter(calc => calc.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
  }
}
