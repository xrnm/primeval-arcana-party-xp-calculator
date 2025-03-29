import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Trash, Plus, Calculator, Save, DownloadCloud, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Form schemas
const characterSchema = z.object({
  hitDice: z.number().min(1).max(20),
  modifier: z.number().min(-3).max(6)
});

const monsterSchema = z.object({
  hitDice: z.number().min(1).max(20),
  modifier: z.number().min(-3).max(6),
  count: z.number().min(1).max(100)
});

const calculatorSchema = z.object({
  characters: z.array(characterSchema).min(1),
  monsters: z.array(monsterSchema).min(1)
});

type Character = {
  id: number;
  hitDice: number;
  modifier: number;
  effectiveHitDice: number;
};

type Monster = {
  id: number;
  hitDice: number;
  modifier: number;
  count: number;
  effectiveHitDice: number;
};

type CalculationResult = {
  totalPartyHitDice: number;
  totalMonsterHitDice: number;
  totalXp: number;
  xpPerCharacter: number;
  averagePartyLevel: number;
  adjustmentFactor: number;
};

type SavedCalculation = {
  id: string;
  date: Date;
  characters: Character[];
  monsters: Monster[];
  result: CalculationResult;
};

export default function Home() {
  const { toast } = useToast();
  const [characters, setCharacters] = useState<Partial<Character>[]>([{ hitDice: 1, modifier: 0 }]);
  const [monsters, setMonsters] = useState<Partial<Monster>[]>([{ hitDice: 1, modifier: 0, count: 1 }]);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [savedCalculations, setSavedCalculations] = useState<SavedCalculation[]>([]);
  const [showSaved, setShowSaved] = useState(false);

  // Helper functions
  const calculateEffectiveHitDice = (hitDice: number, modifier: number) => {
    return hitDice + (modifier * 0.25);
  };

  const calculateAdjustmentFactor = (partyLevel: number, monsterLevel: number) => {
    if (partyLevel <= 0 || monsterLevel <= 0) return 1;
    
    // If monsters are lower level than party, reduce XP
    if (monsterLevel < partyLevel) {
      const ratio = monsterLevel / partyLevel;
      if (ratio < 0.25) return 0.25;
      if (ratio < 0.5) return 0.5;
      if (ratio < 0.75) return 0.75;
    }
    
    return 1;
  };

  const calculateXp = () => {
    // Convert partial characters to complete ones with effective hit dice
    const calculatedCharacters: Character[] = characters.map((char, idx) => ({
      id: idx,
      hitDice: char.hitDice || 1,
      modifier: char.modifier || 0,
      effectiveHitDice: calculateEffectiveHitDice(char.hitDice || 1, char.modifier || 0)
    }));

    // Convert partial monsters to complete ones with effective hit dice
    const calculatedMonsters: Monster[] = monsters.map((monster, idx) => ({
      id: idx,
      hitDice: monster.hitDice || 1,
      modifier: monster.modifier || 0,
      count: monster.count || 1,
      effectiveHitDice: calculateEffectiveHitDice(monster.hitDice || 1, monster.modifier || 0)
    }));

    // Calculate the total effective hit dice for the party
    const totalPartyHitDice = calculatedCharacters.reduce(
      (total, char) => total + char.effectiveHitDice, 
      0
    );

    // Calculate average party level
    const averagePartyLevel = totalPartyHitDice / calculatedCharacters.length;

    // Calculate total effective monster hit dice
    let totalMonsterHitDice = 0;
    for (const monster of calculatedMonsters) {
      totalMonsterHitDice += monster.effectiveHitDice * monster.count;
    }

    // Calculate adjustment factor based on level difference
    const adjustmentFactor = calculateAdjustmentFactor(
      averagePartyLevel,
      totalMonsterHitDice / calculatedMonsters.reduce((sum, m) => sum + m.count, 0)
    );

    // Calculate total XP (100 XP per hit die)
    const totalXp = totalMonsterHitDice * 100 * adjustmentFactor;

    // Calculate XP per character
    const xpPerCharacter = totalXp / calculatedCharacters.length;

    // Set the calculation result
    const newResult: CalculationResult = {
      totalPartyHitDice,
      totalMonsterHitDice,
      totalXp,
      xpPerCharacter,
      averagePartyLevel,
      adjustmentFactor
    };

    setResult(newResult);
  };

  const saveCalculation = () => {
    if (!result) return;

    // Convert partial characters to complete ones with effective hit dice
    const calculatedCharacters: Character[] = characters.map((char, idx) => ({
      id: idx,
      hitDice: char.hitDice || 1,
      modifier: char.modifier || 0,
      effectiveHitDice: calculateEffectiveHitDice(char.hitDice || 1, char.modifier || 0)
    }));

    // Convert partial monsters to complete ones with effective hit dice
    const calculatedMonsters: Monster[] = monsters.map((monster, idx) => ({
      id: idx,
      hitDice: monster.hitDice || 1,
      modifier: monster.modifier || 0,
      count: monster.count || 1,
      effectiveHitDice: calculateEffectiveHitDice(monster.hitDice || 1, monster.modifier || 0)
    }));

    // Create a new saved calculation
    const newSavedCalculation: SavedCalculation = {
      id: Date.now().toString(),
      date: new Date(),
      characters: calculatedCharacters,
      monsters: calculatedMonsters,
      result
    };

    // Save to localStorage
    const storedCalculations = localStorage.getItem('odnd-xp-calculations');
    let updatedCalculations: SavedCalculation[] = [];
    
    if (storedCalculations) {
      try {
        updatedCalculations = JSON.parse(storedCalculations);
      } catch (e) {
        console.error('Error parsing stored calculations', e);
      }
    }
    
    updatedCalculations.push(newSavedCalculation);
    localStorage.setItem('odnd-xp-calculations', JSON.stringify(updatedCalculations));
    
    // Update state
    setSavedCalculations(updatedCalculations);
    toast({
      title: "Calculation saved",
      description: "Your calculation has been saved successfully",
    });
  };

  const loadSavedCalculations = () => {
    const storedCalculations = localStorage.getItem('odnd-xp-calculations');
    
    if (storedCalculations) {
      try {
        const calculations = JSON.parse(storedCalculations);
        setSavedCalculations(calculations);
      } catch (e) {
        console.error('Error parsing stored calculations', e);
      }
    }
  };

  const loadCalculation = (savedCalc: SavedCalculation) => {
    setCharacters(savedCalc.characters);
    setMonsters(savedCalc.monsters);
    setResult(savedCalc.result);
    
    toast({
      title: "Calculation loaded",
      description: "Your saved calculation has been loaded",
    });
  };

  const deleteCalculation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Filter out the calculation to delete
    const updatedCalculations = savedCalculations.filter(calc => calc.id !== id);
    
    // Update localStorage
    localStorage.setItem('odnd-xp-calculations', JSON.stringify(updatedCalculations));
    
    // Update state
    setSavedCalculations(updatedCalculations);
    
    toast({
      title: "Calculation deleted",
      description: "Your calculation has been deleted",
    });
  };

  const addCharacter = () => {
    setCharacters([...characters, { hitDice: 1, modifier: 0 }]);
  };

  const removeCharacter = (index: number) => {
    if (characters.length <= 1) {
      toast({
        title: "Cannot remove character",
        description: "You need at least one character",
        variant: "destructive"
      });
      return;
    }
    
    const updatedCharacters = [...characters];
    updatedCharacters.splice(index, 1);
    setCharacters(updatedCharacters);
  };

  const updateCharacter = (index: number, field: keyof Character, value: number) => {
    const updatedCharacters = [...characters];
    updatedCharacters[index] = { ...updatedCharacters[index], [field]: value };
    setCharacters(updatedCharacters);
  };

  const addMonster = () => {
    setMonsters([...monsters, { hitDice: 1, modifier: 0, count: 1 }]);
  };

  const removeMonster = (index: number) => {
    if (monsters.length <= 1) {
      toast({
        title: "Cannot remove monster",
        description: "You need at least one monster",
        variant: "destructive"
      });
      return;
    }
    
    const updatedMonsters = [...monsters];
    updatedMonsters.splice(index, 1);
    setMonsters(updatedMonsters);
  };

  const updateMonster = (index: number, field: keyof Monster, value: number) => {
    const updatedMonsters = [...monsters];
    updatedMonsters[index] = { ...updatedMonsters[index], [field]: value };
    setMonsters(updatedMonsters);
  };

  const resetForm = () => {
    setCharacters([{ hitDice: 1, modifier: 0 }]);
    setMonsters([{ hitDice: 1, modifier: 0, count: 1 }]);
    setResult(null);
  };

  const toggleSavedCalculations = () => {
    setShowSaved(!showSaved);
    if (!showSaved) {
      loadSavedCalculations();
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString();
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-primary">oDND XP Calculator</h1>
        <p className="text-muted-foreground">Calculate experience points based on hit dice and modifiers</p>
      </header>

      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {/* Character Section */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex justify-between items-center">
                <span>Party Characters</span>
                <Button onClick={addCharacter} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" /> Add Character
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {characters.map((character, index) => (
                <div key={index} className="mb-4 p-4 border rounded-md">
                  <div className="flex justify-between items-center mb-2">
                    <Badge variant="outline">Character {index + 1}</Badge>
                    <Button 
                      onClick={() => removeCharacter(index)} 
                      size="sm" 
                      variant="ghost"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <FormLabel>Hit Dice</FormLabel>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={character.hitDice || 1}
                        onChange={(e) => updateCharacter(index, 'hitDice', parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div>
                      <FormLabel>Modifier</FormLabel>
                      <Input
                        type="number"
                        min={-3}
                        max={6}
                        value={character.modifier || 0}
                        onChange={(e) => updateCharacter(index, 'modifier', parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Effective Hit Dice: {calculateEffectiveHitDice(character.hitDice || 1, character.modifier || 0).toFixed(2)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Monster Section */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex justify-between items-center">
                <span>Defeated Monsters</span>
                <Button onClick={addMonster} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" /> Add Monster
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {monsters.map((monster, index) => (
                <div key={index} className="mb-4 p-4 border rounded-md">
                  <div className="flex justify-between items-center mb-2">
                    <Badge variant="outline">Monster {index + 1}</Badge>
                    <Button 
                      onClick={() => removeMonster(index)} 
                      size="sm" 
                      variant="ghost"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <FormLabel>Hit Dice</FormLabel>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={monster.hitDice || 1}
                        onChange={(e) => updateMonster(index, 'hitDice', parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div>
                      <FormLabel>Modifier</FormLabel>
                      <Input
                        type="number"
                        min={-3}
                        max={6}
                        value={monster.modifier || 0}
                        onChange={(e) => updateMonster(index, 'modifier', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <FormLabel>Count</FormLabel>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={monster.count || 1}
                        onChange={(e) => updateMonster(index, 'count', parseInt(e.target.value) || 1)}
                      />
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Effective Hit Dice: {calculateEffectiveHitDice(monster.hitDice || 1, monster.modifier || 0).toFixed(2)} 
                    × {monster.count || 1} = {(calculateEffectiveHitDice(monster.hitDice || 1, monster.modifier || 0) * (monster.count || 1)).toFixed(2)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={calculateXp}>
              <Calculator className="h-4 w-4 mr-2" /> Calculate XP
            </Button>
            <Button onClick={resetForm} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" /> Reset
            </Button>
            <Button 
              onClick={saveCalculation} 
              variant="outline"
              disabled={!result}
            >
              <Save className="h-4 w-4 mr-2" /> Save Calculation
            </Button>
            <Button 
              onClick={toggleSavedCalculations} 
              variant="outline"
            >
              <DownloadCloud className="h-4 w-4 mr-2" /> 
              {showSaved ? "Hide Saved" : "Show Saved"}
            </Button>
          </div>

          {/* Result Section */}
          {result && (
            <Card id="results">
              <CardHeader>
                <CardTitle>Calculation Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-medium">Party Information</h3>
                      <p>Total Party Hit Dice: {result.totalPartyHitDice.toFixed(2)}</p>
                      <p>Average Party Level: {result.averagePartyLevel.toFixed(2)}</p>
                    </div>
                    <div>
                      <h3 className="font-medium">Monster Information</h3>
                      <p>Total Monster Hit Dice: {result.totalMonsterHitDice.toFixed(2)}</p>
                      <p>Level Adjustment Factor: {result.adjustmentFactor.toFixed(2)}</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="text-center">
                    <h3 className="text-xl font-bold">Total XP: {result.totalXp.toFixed(0)}</h3>
                    <p className="text-lg">XP Per Character: {result.xpPerCharacter.toFixed(0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Saved Calculations Sidebar */}
        <div>
          {showSaved && (
            <Card>
              <CardHeader>
                <CardTitle>Saved Calculations</CardTitle>
              </CardHeader>
              <CardContent>
                {savedCalculations.length === 0 ? (
                  <p className="text-muted-foreground">No saved calculations yet</p>
                ) : (
                  <div className="space-y-4">
                    {savedCalculations.map((saved) => (
                      <div 
                        key={saved.id} 
                        className="p-3 border rounded-md cursor-pointer hover:bg-muted"
                        onClick={() => loadCalculation(saved)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-medium">{formatDate(saved.date)}</p>
                            <p className="text-xs text-muted-foreground">
                              {saved.characters.length} characters | {saved.monsters.reduce((sum, m) => sum + m.count, 0)} monsters
                            </p>
                            <p className="text-sm mt-1">
                              XP: {saved.result.totalXp.toFixed(0)} ({saved.result.xpPerCharacter.toFixed(0)} per character)
                            </p>
                          </div>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={(e) => deleteCalculation(saved.id, e)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <footer className="mt-8 text-center text-sm text-muted-foreground">
        <p>oDND XP Calculator - Calculate experience points based on hit dice and modifiers</p>
        <p>Hit dice modifiers count as 25% of a hit die</p>
      </footer>
    </div>
  );
}