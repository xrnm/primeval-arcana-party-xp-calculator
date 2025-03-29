import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormGroup, FormControl, Validators } from '@angular/forms';

@Component({
  selector: 'app-hit-dice-input',
  templateUrl: './hit-dice-input.component.html',
  styleUrls: ['./hit-dice-input.component.css'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => HitDiceInputComponent),
      multi: true
    }
  ]
})
export class HitDiceInputComponent implements ControlValueAccessor {
  @Input() label = 'Hit Dice';
  @Input() showCount = false;

  form: FormGroup;
  
  constructor() {
    this.form = new FormGroup({
      hitDice: new FormControl(1, [Validators.required, Validators.min(1), Validators.max(20)]),
      modifier: new FormControl(0, [Validators.required, Validators.min(-3), Validators.max(6)]),
      count: new FormControl(1, [Validators.required, Validators.min(1), Validators.max(100)])
    });
    
    this.form.valueChanges.subscribe(value => {
      this.onChange(value);
      this.onTouched();
    });
  }

  // ControlValueAccessor methods
  onChange: any = () => {};
  onTouched: any = () => {};

  writeValue(value: any): void {
    if (value) {
      this.form.patchValue(value, { emitEvent: false });
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    isDisabled ? this.form.disable() : this.form.enable();
  }
}
