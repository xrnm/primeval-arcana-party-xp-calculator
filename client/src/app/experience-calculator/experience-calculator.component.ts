import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { XpCalculatorService } from '../services/xp-calculator.service';
import { Character, CharacterFormValue } from '../models/character.model';
import { Monster, MonsterFormValue } from '../models/monster.model';
import { CalculationResult, SavedCalculation } from '../models/calculation-result.model';

@Component({
  selector: 'app-experience-calculator',
  templateUrl: './experience-calculator.component.html',
  styleUrls: ['./experience-calculator.component.css']
})
export class ExperienceCalculatorComponent implements OnInit {
  calculatorForm: FormGroup;
  result: CalculationResult | null = null;
  savedCalculations: SavedCalculation[] = [];
  showSavedCalculations = false;
  
  constructor(
    private fb: FormBuilder,
    private xpCalculatorService: XpCalculatorService,
    private snackBar: MatSnackBar
  ) {
    this.calculatorForm = this.createForm();
    this.loadSavedCalculations();
  }

  ngOnInit(): void {}

  /**
   * Create the initial form structure
   */
  createForm(): FormGroup {
    return this.fb.group({
      characters: this.fb.array([this.createCharacterForm()]),
      monsters: this.fb.array([this.createMonsterForm()])
    });
  }

  /**
   * Create a character form group
   */
  createCharacterForm(): FormGroup {
    return this.fb.group({
      hitDice: [1, [Validators.required, Validators.min(1), Validators.max(20)]],
      modifier: [0, [Validators.required, Validators.min(-3), Validators.max(6)]]
    });
  }

  /**
   * Create a monster form group
   */
  createMonsterForm(): FormGroup {
    return this.fb.group({
      hitDice: [1, [Validators.required, Validators.min(1), Validators.max(20)]],
      modifier: [0, [Validators.required, Validators.min(-3), Validators.max(6)]],
      count: [1, [Validators.required, Validators.min(1), Validators.max(100)]]
    });
  }

  /**
   * Get the characters FormArray
   */
  get charactersArray(): FormArray {
    return this.calculatorForm.get('characters') as FormArray;
  }

  /**
   * Get the monsters FormArray
   */
  get monstersArray(): FormArray {
    return this.calculatorForm.get('monsters') as FormArray;
  }

  /**
   * Add a new character to the form
   */
  addCharacter(): void {
    this.charactersArray.push(this.createCharacterForm());
  }

  /**
   * Remove a character from the form
   */
  removeCharacter(index: number): void {
    if (this.charactersArray.length > 1) {
      this.charactersArray.removeAt(index);
    } else {
      this.snackBar.open('You need at least one character', 'OK', { duration: 3000 });
    }
  }

  /**
   * Add a new monster to the form
   */
  addMonster(): void {
    this.monstersArray.push(this.createMonsterForm());
  }

  /**
   * Remove a monster from the form
   */
  removeMonster(index: number): void {
    if (this.monstersArray.length > 1) {
      this.monstersArray.removeAt(index);
    } else {
      this.snackBar.open('You need at least one monster', 'OK', { duration: 3000 });
    }
  }

  /**
   * Calculate XP based on form data
   */
  calculateXp(): void {
    if (this.calculatorForm.invalid) {
      this.snackBar.open('Please fix the form errors before calculating', 'OK', { duration: 3000 });
      this.markFormGroupTouched(this.calculatorForm);
      return;
    }

    // Extract character data from form
    const characterValues: CharacterFormValue[] = this.charactersArray.value;
    const characters: Character[] = characterValues.map((char, index) => ({
      id: index,
      hitDice: char.hitDice,
      modifier: char.modifier,
      effectiveHitDice: this.xpCalculatorService.calculateEffectiveHitDice(char.hitDice, char.modifier)
    }));

    // Extract monster data from form
    const monsterValues: MonsterFormValue[] = this.monstersArray.value;
    const monsters: Monster[] = monsterValues.map((monster, index) => ({
      id: index,
      hitDice: monster.hitDice,
      modifier: monster.modifier,
      count: monster.count,
      effectiveHitDice: this.xpCalculatorService.calculateEffectiveHitDice(monster.hitDice, monster.modifier)
    }));

    // Calculate XP
    this.result = this.xpCalculatorService.calculateXp(characters, monsters);
    
    // Scroll to results
    setTimeout(() => {
      const resultsElement = document.getElementById('results');
      if (resultsElement) {
        resultsElement.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  }

  /**
   * Save the current calculation
   */
  saveCalculation(): void {
    if (!this.result) return;

    // Extract character data
    const characterValues = this.charactersArray.value;
    const characters = characterValues.map((char: CharacterFormValue, index: number) => ({
      id: index,
      hitDice: char.hitDice,
      modifier: char.modifier,
      effectiveHitDice: this.xpCalculatorService.calculateEffectiveHitDice(char.hitDice, char.modifier)
    }));

    // Extract monster data
    const monsterValues = this.monstersArray.value;
    const monsters = monsterValues.map((monster: MonsterFormValue, index: number) => ({
      id: index,
      hitDice: monster.hitDice,
      modifier: monster.modifier,
      count: monster.count,
      effectiveHitDice: this.xpCalculatorService.calculateEffectiveHitDice(monster.hitDice, monster.modifier)
    }));

    // Save calculation
    this.xpCalculatorService.saveCalculation(characters, monsters, this.result);
    this.loadSavedCalculations();
    this.snackBar.open('Calculation saved!', 'OK', { duration: 2000 });
  }

  /**
   * Load a saved calculation
   */
  loadCalculation(saved: SavedCalculation): void {
    // Reset the form
    this.calculatorForm = this.createForm();
    
    // Clear existing form arrays
    while (this.charactersArray.length > 0) {
      this.charactersArray.removeAt(0);
    }
    
    while (this.monstersArray.length > 0) {
      this.monstersArray.removeAt(0);
    }
    
    // Add characters
    saved.characters.forEach((char: Character) => {
      this.charactersArray.push(this.fb.group({
        hitDice: [char.hitDice, [Validators.required, Validators.min(1), Validators.max(20)]],
        modifier: [char.modifier, [Validators.required, Validators.min(-3), Validators.max(6)]]
      }));
    });
    
    // Add monsters
    saved.monsters.forEach((monster: Monster) => {
      this.monstersArray.push(this.fb.group({
        hitDice: [monster.hitDice, [Validators.required, Validators.min(1), Validators.max(20)]],
        modifier: [monster.modifier, [Validators.required, Validators.min(-3), Validators.max(6)]],
        count: [monster.count, [Validators.required, Validators.min(1), Validators.max(100)]]
      }));
    });
    
    // Set the result
    this.result = saved.result;
    
    this.snackBar.open('Calculation loaded!', 'OK', { duration: 2000 });
  }

  /**
   * Delete a saved calculation
   */
  deleteCalculation(id: string, event: Event): void {
    event.stopPropagation();
    this.xpCalculatorService.deleteSavedCalculation(id);
    this.loadSavedCalculations();
    this.snackBar.open('Calculation deleted!', 'OK', { duration: 2000 });
  }

  /**
   * Load all saved calculations from storage
   */
  loadSavedCalculations(): void {
    this.savedCalculations = this.xpCalculatorService.getSavedCalculations();
  }

  /**
   * Reset the form
   */
  resetForm(): void {
    this.calculatorForm = this.createForm();
    this.result = null;
  }

  /**
   * Helper to mark all controls in a form group as touched
   */
  markFormGroupTouched(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      } else if (control instanceof FormArray) {
        for (let i = 0; i < control.length; i++) {
          if (control.at(i) instanceof FormGroup) {
            this.markFormGroupTouched(control.at(i) as FormGroup);
          } else {
            control.at(i).markAsTouched();
          }
        }
      } else {
        control?.markAsTouched();
      }
    });
  }

  /**
   * Get a formatted date for display
   */
  formatDate(date: string | Date): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString();
  }

  /**
   * Toggle showing saved calculations
   */
  toggleSavedCalculations(): void {
    this.showSavedCalculations = !this.showSavedCalculations;
    if (this.showSavedCalculations) {
      this.loadSavedCalculations();
    }
  }
}
