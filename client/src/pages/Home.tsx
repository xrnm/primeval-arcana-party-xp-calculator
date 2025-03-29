import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "../components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { format } from "date-fns";
import { useToast } from "../hooks/use-toast";
import { Trash, Plus, Calculator, Save, List, RotateCcw, X } from "lucide-react";

// Types for our application
type Character = {
  id: number;
  name: string;
  hitDice: number;
  modifier: number;
  effectiveHitDice: number;
};

type Monster = {
  id: number;
  name: string;
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
  characterXp: {
    characterId: number;
    effectiveHitDice: number;
    adjustmentFactor: number;
    adjustedXp: number;
    monsterContributions: {
      monsterId: number;
      monsterName: string;
      baseXp: number;
      adjustmentFactor: number;
      adjustedXp: number;
    }[];
  }[];
};

type SavedCalculation = {
  id: string;
  date: Date;
  characters: Character[];
  monsters: Monster[];
  result: CalculationResult;
};

// Schemas for form validation
const characterSchema = z.object({
  name: z.string().optional(),
  hitDice: z.number().min(1, "Hit dice must be at least 1"),
  modifier: z.number(),
});

const monsterSchema = z.object({
  name: z.string().optional(),
  hitDice: z.number().min(1, "Hit dice must be at least 1"),
  modifier: z.number(),
  count: z.number().min(1, "Count must be at least 1"),
});

const calculatorSchema = z.object({
  characters: z.array(characterSchema).min(1, "Add at least one character"),
  monsters: z.array(monsterSchema).min(1, "Add at least one monster"),
});

// Helper functions
const calculateEffectiveHitDice = (hitDice: number, modifier: number): number => {
  return hitDice + modifier * 0.25;
};

const calculateTotalXp = (monsters: Monster[]): number => {
  return monsters.reduce((total, monster) => {
    return total + monster.effectiveHitDice * monster.count * 100;
  }, 0);
};

const calculateAdjustmentFactor = (characterHD: number, monsterHD: number): number => {
  if (characterHD <= monsterHD) {
    return 1.0; // Character gets 100% of XP if their HD is less than or equal to monster HD
  }
  return monsterHD / characterHD; // Reduced XP based on ratio
};

// Helper to format hit dice display with modifier
const formatHitDice = (hitDice: number, modifier: number): string => {
  if (modifier > 0) {
    return `${hitDice}+${modifier}`;
  } else if (modifier < 0) {
    return `${hitDice}${modifier}`;
  } else {
    return `${hitDice}`;
  }
};

export default function Home() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [savedCalculations, setSavedCalculations] = useState<SavedCalculation[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const { toast } = useToast();
  
  // Load saved calculations on component mount
  useEffect(() => {
    const saved = localStorage.getItem("odnd-xp-calculations");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Convert string dates to Date objects
        const calculations: SavedCalculation[] = parsed.map((calc: any) => ({
          ...calc,
          date: new Date(calc.date),
        }));
        setSavedCalculations(calculations);
      } catch (error) {
        console.error("Failed to parse saved calculations", error);
      }
    }
  }, []);

  // Setup form
  const form = useForm<z.infer<typeof calculatorSchema>>({
    resolver: zodResolver(calculatorSchema),
    defaultValues: {
      characters: [{ name: "", hitDice: 1, modifier: 0 }],
      monsters: [{ name: "", hitDice: 1, modifier: 0, count: 1 }],
    },
  });

  const onSubmit = (data: z.infer<typeof calculatorSchema>) => {
    // Reset previous state
    setCharacters([]);
    setMonsters([]);
    setResult(null);
    
    // Process characters
    const newCharacters = data.characters.map((char, index) => {
      const effectiveHD = calculateEffectiveHitDice(char.hitDice, char.modifier);
      return {
        id: index + 1,
        name: char.name || `Character ${index + 1}`,
        hitDice: char.hitDice,
        modifier: char.modifier,
        effectiveHitDice: effectiveHD,
      };
    });
    
    // Process monsters
    const newMonsters = data.monsters.map((monster, index) => {
      const effectiveHD = calculateEffectiveHitDice(monster.hitDice, monster.modifier);
      return {
        id: index + 1,
        name: monster.name || `Monster ${index + 1}`,
        hitDice: monster.hitDice,
        modifier: monster.modifier,
        count: monster.count,
        effectiveHitDice: effectiveHD,
      };
    });
    
    // Calculate party stats
    const totalPartyHitDice = newCharacters.reduce((total, char) => total + char.effectiveHitDice, 0);
    const averagePartyLevel = totalPartyHitDice / newCharacters.length;
    
    // Calculate monster stats
    const totalMonsterCount = newMonsters.reduce((total, monster) => total + monster.count, 0);
    const totalMonsterHitDice = newMonsters.reduce(
      (total, monster) => total + monster.effectiveHitDice * monster.count, 
      0
    );
    const averageMonsterLevel = totalMonsterCount > 0 
      ? totalMonsterHitDice / totalMonsterCount 
      : 0;
    
    // Calculate total XP
    const totalXp = calculateTotalXp(newMonsters);
    const xpPerCharacter = totalXp / newCharacters.length;
    
    // Calculate the overall adjustment factor
    const overallAdjustmentFactor = calculateAdjustmentFactor(averagePartyLevel, averageMonsterLevel);
    
    // Calculate per-character adjusted XP
    const characterXp = newCharacters.map(char => {
      // Calculate adjustment factors for each monster type
      let totalAdjustedXp = 0;
      
      // Track contribution from each monster
      const monsterContributions = newMonsters.map(monster => {
        // Calculate the XP contribution of this monster type
        const monsterXpContribution = monster.effectiveHitDice * monster.count * 100 / newCharacters.length;
        
        // Calculate the adjustment factor for this character vs this monster
        const adjustmentFactor = calculateAdjustmentFactor(char.effectiveHitDice, monster.effectiveHitDice);
        
        // Calculate adjusted XP from this monster
        const adjustedXpFromMonster = monsterXpContribution * adjustmentFactor;
        
        // Add to total
        totalAdjustedXp += adjustedXpFromMonster;
        
        return {
          monsterId: monster.id,
          monsterName: monster.name,
          baseXp: monsterXpContribution,
          adjustmentFactor: adjustmentFactor,
          adjustedXp: adjustedXpFromMonster
        };
      });
      
      // Calculate the overall adjustment factor by comparing total adjusted XP to base share
      const overallAdjustmentFactor = totalAdjustedXp / xpPerCharacter;
      
      return {
        characterId: char.id,
        effectiveHitDice: char.effectiveHitDice,
        adjustmentFactor: overallAdjustmentFactor,
        adjustedXp: Math.floor(totalAdjustedXp), // Round down to whole number
        monsterContributions: monsterContributions
      };
    });
    
    // Find the lowest level character to give them the remainder XP
    const lowestLevelCharIndex = characterXp.reduce(
      (lowestIdx, curr, idx, arr) => 
        curr.effectiveHitDice < arr[lowestIdx].effectiveHitDice ? idx : lowestIdx, 
      0
    );
    
    // Calculate total rounded XP and the remainder
    const totalRoundedXp = characterXp.reduce((sum, char) => sum + char.adjustedXp, 0);
    const remainder = totalXp - totalRoundedXp;
    
    // Give the remainder to the lowest level character
    if (remainder > 0 && characterXp.length > 0) {
      characterXp[lowestLevelCharIndex].adjustedXp += remainder;
    }
    
    // Set state with all calculated values
    setCharacters(newCharacters);
    setMonsters(newMonsters);
    setResult({
      totalPartyHitDice,
      totalMonsterHitDice,
      totalXp,
      xpPerCharacter,
      averagePartyLevel,
      adjustmentFactor: overallAdjustmentFactor,
      characterXp,
    });
    
    toast({
      title: "Calculation Complete",
      description: `Total XP: ${totalXp.toLocaleString()} XP`,
      variant: "default",
    });
  };

  const addCharacter = () => {
    const characters = form.getValues("characters");
    form.setValue("characters", [...characters, { name: "", hitDice: 1, modifier: 0 }]);
  };

  const removeCharacter = (index: number) => {
    const characters = form.getValues("characters");
    if (characters.length > 1) {
      form.setValue(
        "characters",
        characters.filter((_, i) => i !== index)
      );
    }
  };

  const addMonster = () => {
    const monsters = form.getValues("monsters");
    form.setValue("monsters", [...monsters, { name: "", hitDice: 1, modifier: 0, count: 1 }]);
  };

  const removeMonster = (index: number) => {
    const monsters = form.getValues("monsters");
    if (monsters.length > 1) {
      form.setValue(
        "monsters",
        monsters.filter((_, i) => i !== index)
      );
    }
  };

  const resetForm = () => {
    form.reset({
      characters: [{ name: "", hitDice: 1, modifier: 0 }],
      monsters: [{ name: "", hitDice: 1, modifier: 0, count: 1 }],
    });
    setCharacters([]);
    setMonsters([]);
    setResult(null);
    toast({
      title: "Form Reset",
      description: "Calculator has been reset to default values",
    });
  };

  const saveCalculation = () => {
    if (!result || characters.length === 0 || monsters.length === 0) {
      toast({
        title: "Nothing to Save",
        description: "Calculate XP first before saving",
        variant: "destructive",
      });
      return;
    }

    const newSavedCalculation: SavedCalculation = {
      id: Date.now().toString(),
      date: new Date(),
      characters,
      monsters,
      result,
    };

    const updatedSaved = [...savedCalculations, newSavedCalculation];
    setSavedCalculations(updatedSaved);
    localStorage.setItem("odnd-xp-calculations", JSON.stringify(updatedSaved));

    toast({
      title: "Calculation Saved",
      description: "Your calculation has been saved",
      variant: "default",
    });
  };

  const loadCalculation = (savedCalc: SavedCalculation) => {
    // Convert saved data to form values
    const characterFormValues = savedCalc.characters.map((char) => ({
      name: char.name,
      hitDice: char.hitDice,
      modifier: char.modifier,
    }));

    const monsterFormValues = savedCalc.monsters.map((monster) => ({
      name: monster.name,
      hitDice: monster.hitDice,
      modifier: monster.modifier,
      count: monster.count,
    }));

    // Reset form with saved values
    form.reset({
      characters: characterFormValues,
      monsters: monsterFormValues,
    });

    // Restore calculation state
    setCharacters(savedCalc.characters);
    setMonsters(savedCalc.monsters);
    setResult(savedCalc.result);

    // Close saved calculations panel
    setShowSaved(false);

    toast({
      title: "Calculation Loaded",
      description: `Loaded calculation from ${format(savedCalc.date, "PPp")}`,
    });
  };

  const deleteCalculation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the load action
    
    const updatedSaved = savedCalculations.filter((calc) => calc.id !== id);
    setSavedCalculations(updatedSaved);
    localStorage.setItem("odnd-xp-calculations", JSON.stringify(updatedSaved));

    toast({
      title: "Calculation Deleted",
      description: "The saved calculation has been deleted",
    });
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-3xl">oDND XP Calculator</CardTitle>
              <CardDescription>Calculate experience points based on character and monster hit dice</CardDescription>
            </div>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowSaved(!showSaved)}
              >
                {showSaved ? <X className="h-4 w-4 mr-2" /> : <List className="h-4 w-4 mr-2" />}
                {showSaved ? "Close" : "Saved"}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={resetForm}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {showSaved ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Saved Calculations</h3>
              {savedCalculations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No saved calculations yet.</p>
              ) : (
                <div className="space-y-2">
                  {savedCalculations.map((calc) => (
                    <Card 
                      key={calc.id} 
                      className="cursor-pointer hover:bg-secondary/50"
                      onClick={() => loadCalculation(calc)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">{format(calc.date, "PPp")}</p>
                            <p className="text-sm text-muted-foreground">
                              {calc.characters.length} characters 
                              {calc.characters.some(c => c.name) ? 
                                ` (${calc.characters.filter(c => c.name).map(c => c.name).join(", ")})` : 
                                ""} 
                              vs. {calc.monsters.reduce((sum, m) => sum + m.count, 0)} monsters
                              {calc.monsters.some(m => m.name) ? 
                                ` (${calc.monsters.filter(m => m.name).map(m => m.name).join(", ")})` : 
                                ""}
                            </p>
                            <p className="text-sm font-medium">
                              Total: {calc.result.totalXp.toLocaleString()} XP
                            </p>
                          </div>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={(e) => deleteCalculation(calc.id, e)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Characters Section */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Characters</h3>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={addCharacter}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Character
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    {form.watch("characters").map((character, index) => (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <FormField
                              control={form.control}
                              name={`characters.${index}.name`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Name (Optional)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="text"
                                      placeholder={`Character ${index + 1}`}
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name={`characters.${index}.hitDice`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Hit Dice</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min={1}
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                      value={field.value}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name={`characters.${index}.modifier`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Modifier</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                      value={field.value}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <div className="flex items-end">
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => removeCharacter(index)}
                                disabled={form.watch("characters").length <= 1}
                                className="mb-1"
                              >
                                <Trash className="h-4 w-4 mr-2" />
                                Remove
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
                
                <Separator />
                
                {/* Monsters Section */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Monsters</h3>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={addMonster}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Monster
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    {form.watch("monsters").map((monster, index) => (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            <FormField
                              control={form.control}
                              name={`monsters.${index}.name`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Name (Optional)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="text"
                                      placeholder={`Monster ${index + 1}`}
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name={`monsters.${index}.hitDice`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Hit Dice</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min={1}
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                      value={field.value}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name={`monsters.${index}.modifier`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Modifier</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                      value={field.value}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name={`monsters.${index}.count`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Count</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min={1}
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                      value={field.value}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <div className="flex items-end">
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => removeMonster(index)}
                                disabled={form.watch("monsters").length <= 1}
                                className="mb-1"
                              >
                                <Trash className="h-4 w-4 mr-2" />
                                Remove
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
                
                <div className="flex justify-end gap-4">
                  <Button 
                    type="submit" 
                    className="w-full sm:w-auto"
                  >
                    <Calculator className="h-4 w-4 mr-2" />
                    Calculate XP
                  </Button>
                  
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full sm:w-auto"
                    onClick={saveCalculation}
                    disabled={!result}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
              </form>
            </Form>
          )}
          
          {/* Results Section */}
          {result && !showSaved && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4">Results</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl">Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Party Hit Dice:</span>
                        <span className="font-medium">{result.totalPartyHitDice.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Monster Hit Dice:</span>
                        <span className="font-medium">{result.totalMonsterHitDice.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Average Party Level:</span>
                        <span className="font-medium">{result.averagePartyLevel.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Overall Adjustment Factor:</span>
                        <span className="font-medium">{result.adjustmentFactor.toFixed(2)}</span>
                      </div>
                      <Separator className="my-2" />
                      <div className="flex justify-between font-medium text-lg">
                        <span>Total XP:</span>
                        <span className="text-primary">{result.totalXp.toLocaleString()} XP</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Base XP Per Character:</span>
                        <span>{Math.round(result.xpPerCharacter).toLocaleString()} XP</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl">Per Character XP</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {result.characterXp.map((charXp) => {
                        const character = characters.find(c => c.id === charXp.characterId);
                        return (
                          <div key={charXp.characterId} className="border rounded-lg p-3">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium">
                                {character && character.name ? character.name : `Character ${charXp.characterId}`}
                              </span>
                              <Badge>
                                {character && formatHitDice(character.hitDice, character.modifier)}
                              </Badge>
                            </div>
                            <div className="space-y-4 text-sm">
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Effective HD:</span>
                                  <span>{charXp.effectiveHitDice.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Adjustment Factor:</span>
                                  <span>{charXp.adjustmentFactor.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between font-medium text-base">
                                  <span>Adjusted XP:</span>
                                  <span className="text-primary">{charXp.adjustedXp.toLocaleString()} XP</span>
                                </div>
                              </div>
                              
                              {/* Monster breakdown section */}
                              {charXp.monsterContributions && (
                                <div className="border-t pt-2 mt-2">
                                  <div className="font-medium mb-1">XP Breakdown by Monster</div>
                                  <div className="space-y-2">
                                    {charXp.monsterContributions.map((contribution) => {
                                      const monster = monsters.find(m => m.id === contribution.monsterId);
                                      return (
                                        <div key={contribution.monsterId} className="bg-secondary/30 p-2 rounded-sm">
                                          <div className="flex justify-between items-center text-xs">
                                            <span className="font-medium">{contribution.monsterName}</span>
                                            <Badge variant="outline" className="text-xs">
                                              {monster && formatHitDice(monster.hitDice, monster.modifier)} × {monster?.count || 0}
                                            </Badge>
                                          </div>
                                          <div className="mt-1 space-y-0.5">
                                            <div className="flex justify-between text-xs">
                                              <span className="text-muted-foreground">Base XP:</span>
                                              <span>{Math.round(contribution.baseXp).toLocaleString()} XP</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                              <span className="text-muted-foreground">Adjustment:</span>
                                              <span>{contribution.adjustmentFactor.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs font-medium">
                                              <span>Adj. XP:</span>
                                              <span>{Math.round(contribution.adjustedXp).toLocaleString()} XP</span>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex flex-col items-start">
          <p className="text-sm text-muted-foreground">
            In oDND, experience points are calculated based on monster hit dice. 
            Modifiers count as 0.25 of a hit die, and XP is reduced for high-level characters 
            fighting lower-level monsters. XP is rounded to whole numbers, with any remainder 
            given to the lowest-level character in the party.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}