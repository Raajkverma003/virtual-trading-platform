import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthService } from '../../core/services/auth.service';

interface BankTransferLog {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  bankName: string;
  accountEnding: string;
  amount: number;
  status: 'COMPLETED' | 'PROCESSING';
  timestamp: Date;
}

@Component({
  selector: 'app-funds',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressBarModule
  ],
  templateUrl: './funds.component.html',
  styleUrl: './funds.component.css'
})
export class FundsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);
  authService = inject(AuthService);

  actionType = signal<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
  processing = signal<boolean>(false);
  logs = signal<BankTransferLog[]>([]);

  fundsForm!: FormGroup;

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    this.fundsForm = this.fb.group({
      bank: ['Chase Savings Account', Validators.required],
      amount: [null, [Validators.required, Validators.min(1)]]
    });

    // Check balance on withdrawal
    this.fundsForm.get('amount')?.valueChanges.subscribe(val => {
      const amountCtrl = this.fundsForm.get('amount');
      if (this.actionType() === 'WITHDRAWAL') {
        const user = this.authService.currentUser();
        const balance = user ? user.balance : 0;
        if (val > balance) {
          amountCtrl?.setErrors({ max: true });
        }
      }
    });
  }

  setActionType(type: 'DEPOSIT' | 'WITHDRAWAL'): void {
    this.actionType.set(type);
    this.fundsForm.get('amount')?.reset();
    this.fundsForm.get('amount')?.updateValueAndValidity();
  }

  handleTransfer(): void {
    if (this.fundsForm.invalid) return;

    const formVal = this.fundsForm.value;
    const user = this.authService.currentUser();
    if (!user) return;

    this.processing.set(true);

    // Simulate electronic processing delay
    setTimeout(() => {
      this.processing.set(false);

      const delta = formVal.amount;
      const newBalance = this.actionType() === 'DEPOSIT' 
        ? user.balance + delta 
        : user.balance - delta;

      // Update local storage and authService user signal
      this.authService.currentUser.set({
        ...user,
        balance: newBalance
      });

      // Add transfer history item
      const newLog: BankTransferLog = {
        id: Math.random().toString(36).substring(2, 9),
        type: this.actionType(),
        bankName: formVal.bank,
        accountEnding: formVal.bank === 'Chase Savings Account' ? '•••• 9876' : '•••• 4321',
        amount: delta,
        status: 'COMPLETED',
        timestamp: new Date()
      };

      this.logs.set([newLog, ...this.logs()]);

      this.snackBar.open(
        `Instant electronic ${this.actionType().toLowerCase()} of $${delta.toLocaleString()} succeeded.`,
        'Dismiss',
        { duration: 4000, horizontalPosition: 'right', verticalPosition: 'top' }
      );

      this.fundsForm.get('amount')?.reset();
    }, 2000);
  }
}
