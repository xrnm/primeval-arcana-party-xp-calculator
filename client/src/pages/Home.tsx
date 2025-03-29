import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cva } from "class-variance-authority";
import { useToast } from "@/hooks/use-toast";

// Define the schema for character form
const characterSchema = z.object({
  hitDice: z.number().int().min(1, "Hit dice must be at least 1").max(30, "Hit dice must be at most 30"),
  modifier: z.number().int().min(-5, "Modifier must be at least -5").max(10, "Modifier must be at most 10"),
});

// Define the schema for monster form
const monsterSchema = z.object({
  hitDice: z.number().int().min(1, "Hit dice must be at least 1").max(30, "Hit dice must be at most 30"),
  modifier: z.number().int().min(-5, "Modifier must be at least -5").max(10, "Modifier must be at most 10"),
  count: z.number().int().min(1, "Count must be at least 1").max(100, "Count must be at most 100"),
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

// Constants
const BASE_XP_PER_HD = 100;
const MODIFIER_FACTOR = 0.25;
const STORAGE_KEY = 'odnd-xp-calculations';

export default function Home() {
  const { toast } = useToast();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [savedCalculations, setSavedCalculations] = useState<SavedCalculation[]>([]);
  const [showSavedCalculations, setShowSavedCalculations] = useState(false);

  // Create character form
  const characterForm = useForm<z.infer<typeof characterSchema>>({
    resolver: zodResolver(characterSchema),
    defaultValues: {
      hitDice: 1,
      modifier: 0,
    },
  });

  // Create monster form
  const monsterForm = useForm<z.infer<typeof monsterSchema>>({
    resolver: zodResolver(monsterSchema),
    defaultValues: {
      hitDice: 1,
      modifier: 0,
      count: 1,
    },
  });

  // Helper function to calculate effective hit dice (including modifiers)
  const calculateEffectiveHitDice = (hitDice: number, modifier: number): number => {
    return hitDice + (modifier * MODIFIER_FACTOR);
  };

  // Helper function to calculate level adjustment based on party vs monster level
  const calculateAdjustmentFactor = (partyLevel: number, monsterLevel: number): number => {
    const ratio = monsterLevel / partyLevel;
    
    if (ratio >= 1) {
      return 1; // Fighting equal or stronger monsters gives full XP
    } else if (ratio >= 0.75) {
      return 0.8; // Fighting somewhat weaker monsters
    } else if (ratio >= 0.5) {
      return 0.5; // Fighting much weaker monsters
    } else {
      return 0.25; // Fighting very weak monsters
    }
  };

  // Load saved calculations from localStorage
  useEffect(() => {
    const loadSavedCalculations = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsedData = JSON.parse(saved);
          
          // Convert string dates back to Date objects
          const formattedData = parsedData.map((calc: any) => ({
            ...calc,
            date: new Date(calc.date)
          }));
          
          setSavedCalculations(formattedData);
        }
      } catch (error) {
        console.error('Error loading saved calculations', error);
      }
    };

    loadSavedCalculations();
  }, []);

  // Handle character form submission
  const onCharacterSubmit = (data: z.infer<typeof characterSchema>) => {
    const newId = characters.length > 0 ? Math.max(...characters.map(c => c.id)) + 1 : 1;
    const effectiveHD = calculateEffectiveHitDice(data.hitDice, data.modifier);
    
    const newCharacter: Character = {
      id: newId,
      hitDice: data.hitDice,
      modifier: data.modifier,
      effectiveHitDice: effectiveHD
    };
    
    setCharacters([...characters, newCharacter]);
    characterForm.reset();
    
    toast({
      title: "Character Added",
      description: `Hit Dice: ${data.hitDice}${data.modifier >= 0 ? '+' : ''}${data.modifier} (Effective: ${effectiveHD.toFixed(2)})`,
    });
  };

  // Handle monster form submission
  const onMonsterSubmit = (data: z.infer<typeof monsterSchema>) => {
    const newId = monsters.length > 0 ? Math.max(...monsters.map(m => m.id)) + 1 : 1;
    const effectiveHD = calculateEffectiveHitDice(data.hitDice, data.modifier);
    
    const newMonster: Monster = {
      id: newId,
      hitDice: data.hitDice,
      modifier: data.modifier,
      count: data.count,
      effectiveHitDice: effectiveHD
    };
    
    setMonsters([...monsters, newMonster]);
    monsterForm.reset({ hitDice: 1, modifier: 0, count: 1 });
    
    toast({
      title: "Monster Added",
      description: `${data.count}× HD: ${data.hitDice}${data.modifier >= 0 ? '+' : ''}${data.modifier} (Effective: ${effectiveHD.toFixed(2)})`,
    });
  };

  // Calculate XP
  const calculateXp = () => {
    if (characters.length === 0 || monsters.length === 0) {
      toast({
        title: "Cannot Calculate",
        description: "You need at least one character and one monster.",
        variant: "destructive",
      });
      return;
    }

    // Calculate total effective hit dice for all characters
    const totalPartyHitDice = characters.reduce(
      (total, char) => total + char.effectiveHitDice, 
      0
    );
    
    // Calculate average party level (used for adjustment factor)
    const averagePartyLevel = totalPartyHitDice / characters.length;
    
    // Calculate total effective hit dice for all monsters (including counts)
    const totalMonsterHitDice = monsters.reduce(
      (total, monster) => total + (monster.effectiveHitDice * monster.count), 
      0
    );
    
    // Calculate the level adjustment factor
    const adjustmentFactor = calculateAdjustmentFactor(
      averagePartyLevel, 
      totalMonsterHitDice / monsters.reduce((total, m) => total + m.count, 0)
    );
    
    // Calculate total XP
    const totalXp = Math.floor(totalMonsterHitDice * BASE_XP_PER_HD * adjustmentFactor);
    
    // Calculate XP per character
    const xpPerCharacter = Math.floor(totalXp / characters.length);
    
    // Set the result
    const newResult: CalculationResult = {
      totalPartyHitDice,
      totalMonsterHitDice,
      totalXp,
      xpPerCharacter,
      averagePartyLevel,
      adjustmentFactor
    };
    
    setResult(newResult);
    
    toast({
      title: "XP Calculated",
      description: `${xpPerCharacter} XP per character (${totalXp} total)`,
    });
  };

  // Save the current calculation
  const saveCalculation = () => {
    if (!result) return;
    
    const id = Date.now().toString();
    const date = new Date();
    
    const newSavedCalculation: SavedCalculation = {
      id,
      date,
      characters: [...characters],
      monsters: [...monsters],
      result: {...result}
    };
    
    const updatedCalculations = [...savedCalculations, newSavedCalculation];
    setSavedCalculations(updatedCalculations);
    
    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCalculations));
      toast({
        title: "Calculation Saved",
        description: "Your calculation has been saved.",
      });
    } catch (error) {
      console.error('Error saving calculation', error);
      toast({
        title: "Save Failed",
        description: "There was an error saving your calculation.",
        variant: "destructive",
      });
    }
  };

  // Load a saved calculation
  const loadCalculation = (savedCalc: SavedCalculation) => {
    setCharacters(savedCalc.characters);
    setMonsters(savedCalc.monsters);
    setResult(savedCalc.result);
    
    toast({
      title: "Calculation Loaded",
      description: `Loaded from ${formatDate(savedCalc.date)}`,
    });
  };

  // Delete a saved calculation
  const deleteCalculation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const updatedCalculations = savedCalculations.filter(calc => calc.id !== id);
    setSavedCalculations(updatedCalculations);
    
    // Update localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCalculations));
      toast({
        title: "Calculation Deleted",
        description: "Your saved calculation has been deleted.",
      });
    } catch (error) {
      console.error('Error deleting calculation', error);
    }
  };

  // Remove a character
  const removeCharacter = (id: number) => {
    setCharacters(characters.filter(char => char.id !== id));
  };

  // Remove a monster
  const removeMonster = (id: number) => {
    setMonsters(monsters.filter(monster => monster.id !== id));
  };

  // Reset the form
  const resetForm = () => {
    setCharacters([]);
    setMonsters([]);
    setResult(null);
    characterForm.reset();
    monsterForm.reset();
  };

  // Toggle saved calculations
  const toggleSavedCalculations = () => {
    setShowSavedCalculations(!showSavedCalculations);
  };

  // Format date for display
  const formatDate = (date: Date | string): string => {
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  };

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:py-12 flex flex-col items-center">
      <div className="container max-w-5xl">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2">oDND XP Calculator</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Calculate experience points for your oDND campaign based on hit dice with modifiers.
            Each modifier counts as 25% of a hit die.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Character Section */}
          <Card>
            <CardHeader>
              <CardTitle>Characters</CardTitle>
              <CardDescription>Add your party members here</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...characterForm}>
                <form onSubmit={characterForm.handleSubmit(onCharacterSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={characterForm.control}
                      name="hitDice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hit Dice</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} {...field} 
                              onChange={e => field.onChange(parseInt(e.target.value) || 1)} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={characterForm.control}
                      name="modifier"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Modifier</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} 
                              onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button type="submit" className="w-full">Add Character</Button>
                </form>
              </Form>

              {characters.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-medium mb-2">Party ({characters.length})</h3>
                  <div className="space-y-2">
                    {characters.map(char => (
                      <div key={char.id} className="flex justify-between items-center p-2 bg-muted rounded">
                        <div>
                          <Badge variant="outline">{char.id}</Badge>
                          <span className="ml-2">
                            HD: {char.hitDice}{char.modifier >= 0 ? '+' : ''}{char.modifier} 
                            <span className="text-muted-foreground text-xs ml-1">
                              (Effective: {char.effectiveHitDice.toFixed(2)})
                            </span>
                          </span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeCharacter(char.id)}>
                          ✕
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Monster Section */}
          <Card>
            <CardHeader>
              <CardTitle>Monsters</CardTitle>
              <CardDescription>Add the monsters the party encounters</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...monsterForm}>
                <form onSubmit={monsterForm.handleSubmit(onMonsterSubmit)} className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={monsterForm.control}
                      name="hitDice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hit Dice</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} {...field} 
                              onChange={e => field.onChange(parseInt(e.target.value) || 1)} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={monsterForm.control}
                      name="modifier"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Modifier</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} 
                              onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={monsterForm.control}
                      name="count"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Count</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} {...field} 
                              onChange={e => field.onChange(parseInt(e.target.value) || 1)} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button type="submit" className="w-full">Add Monster</Button>
                </form>
              </Form>

              {monsters.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-medium mb-2">Monsters ({monsters.reduce((sum, m) => sum + m.count, 0)})</h3>
                  <div className="space-y-2">
                    {monsters.map(monster => (
                      <div key={monster.id} className="flex justify-between items-center p-2 bg-muted rounded">
                        <div>
                          <Badge>{monster.count}×</Badge>
                          <span className="ml-2">
                            HD: {monster.hitDice}{monster.modifier >= 0 ? '+' : ''}{monster.modifier}
                            <span className="text-muted-foreground text-xs ml-1">
                              (Effective: {monster.effectiveHitDice.toFixed(2)})
                            </span>
                          </span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeMonster(monster.id)}>
                          ✕
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 mb-8 justify-center">
          <Button onClick={calculateXp} disabled={characters.length === 0 || monsters.length === 0}>
            Calculate XP
          </Button>
          <Button onClick={saveCalculation} disabled={!result} variant="outline">
            Save
          </Button>
          <Button onClick={toggleSavedCalculations} variant="outline">
            {showSavedCalculations ? 'Hide Saved' : 'Show Saved'}
          </Button>
          <Button onClick={resetForm} variant="destructive">
            Reset
          </Button>
        </div>

        {/* Results Section */}
        {result && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium mb-1">Party Stats</p>
                  <p>Total Characters: {characters.length}</p>
                  <p>Total Party HD: {result.totalPartyHitDice.toFixed(2)}</p>
                  <p>Average Party Level: {result.averagePartyLevel.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Monster Stats</p>
                  <p>Total Monsters: {monsters.reduce((sum, m) => sum + m.count, 0)}</p>
                  <p>Total Monster HD: {result.totalMonsterHitDice.toFixed(2)}</p>
                  <p>Adjustment Factor: {result.adjustmentFactor.toFixed(2)}</p>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="bg-muted rounded-lg p-4 text-center">
                <p className="text-sm mb-2">XP Reward</p>
                <p className="text-3xl font-bold">{result.xpPerCharacter} XP</p>
                <p>per character ({result.totalXp} total)</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Saved Calculations */}
        {showSavedCalculations && savedCalculations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Saved Calculations</CardTitle>
              <CardDescription>Click on a saved calculation to load it</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {savedCalculations.map(saved => (
                  <div
                    key={saved.id}
                    className="flex justify-between items-center p-3 bg-muted rounded cursor-pointer hover:bg-muted/80"
                    onClick={() => loadCalculation(saved)}
                  >
                    <div>
                      <p className="font-medium">
                        {saved.characters.length} Characters vs. {saved.monsters.reduce((sum, m) => sum + m.count, 0)} Monsters
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(saved.date)} - {saved.result.xpPerCharacter} XP per character
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => deleteCalculation(saved.id, e)}
                    >
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}