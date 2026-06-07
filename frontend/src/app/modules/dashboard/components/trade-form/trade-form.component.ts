import { Component, Input, OnInit, OnChanges, SimpleChanges, inject, Optional, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TradeService } from '../../../../core/services/trade.service';
import { AuthService } from '../../../../core/services/auth.service';

interface StockData {
  _id?: string;
  symbol: string;
  name: string;
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;
}

@Component({
  selector: 'app-trade-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule
  ],
  templateUrl: './trade-form.component.html',
  styleUrl: './trade-form.component.css'
})
export class TradeFormComponent implements OnInit, OnChanges {
  private fb = inject(FormBuilder);
  private tradeService = inject(TradeService);
  private snackBar = inject(MatSnackBar);
  authService = inject(AuthService);

  // Optional Dialog injection
  private dialogData = inject(MAT_DIALOG_DATA, { optional: true });
  private dialogRef = inject(MatDialogRef<TradeFormComponent>, { optional: true });

  @Input() stock: StockData | null = null;
  @Input() initialAction: 'BUY' | 'SELL' = 'BUY';

  isDialogMode = false;
  loadingTrade = signal<boolean>(false);
  tradeType = signal<'BUY' | 'SELL'>('BUY');
  tradeForm!: FormGroup;

  ngOnInit(): void {
    if (this.dialogData) {
      this.stock = this.dialogData.stock;
      this.initialAction = this.dialogData.action || 'BUY';
      this.isDialogMode = true;
    }
    
    this.tradeType.set(this.initialAction);
    this.initForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['stock'] && !changes['stock'].isFirstChange()) {
      this.resetForm();
    }
    if (changes['initialAction']) {
      this.tradeType.set(this.initialAction);
    }
  }

  private initForm(): void {
    this.tradeForm = this.fb.group({
      orderType: ['MARKET', Validators.required],
      shares: [null, [Validators.required, Validators.min(1)]],
      limitPrice: [null],
      assetType: ['STOCK', Validators.required],
      optionType: ['CALL'],
      strikePrice: [null],
      expiry: ['26-Jun-2026']
    });

    this.tradeForm.get('orderType')?.valueChanges.subscribe(type => {
      const limitPriceCtrl = this.tradeForm.get('limitPrice');
      if (type === 'LIMIT') {
        limitPriceCtrl?.setValidators([Validators.required, Validators.min(0.01)]);
      } else {
        limitPriceCtrl?.clearValidators();
      }
      limitPriceCtrl?.updateValueAndValidity();
    });

    this.tradeForm.get('assetType')?.valueChanges.subscribe(assetType => {
      const optionTypeCtrl = this.tradeForm.get('optionType');
      const strikePriceCtrl = this.tradeForm.get('strikePrice');
      const expiryCtrl = this.tradeForm.get('expiry');

      if (assetType === 'OPTION') {
        optionTypeCtrl?.setValidators([Validators.required]);
        strikePriceCtrl?.setValidators([Validators.required, Validators.min(0.01)]);
        expiryCtrl?.setValidators([Validators.required]);
      } else if (assetType === 'FUTURE') {
        optionTypeCtrl?.clearValidators();
        strikePriceCtrl?.clearValidators();
        expiryCtrl?.setValidators([Validators.required]);
      } else {
        optionTypeCtrl?.clearValidators();
        strikePriceCtrl?.clearValidators();
        expiryCtrl?.clearValidators();
      }

      optionTypeCtrl?.updateValueAndValidity();
      strikePriceCtrl?.updateValueAndValidity();
      expiryCtrl?.updateValueAndValidity();
    });
  }

  private resetForm(): void {
    if (this.tradeForm) {
      this.tradeForm.get('shares')?.reset();
      this.tradeForm.get('limitPrice')?.reset();
      this.tradeForm.get('assetType')?.setValue('STOCK');
      this.tradeForm.get('optionType')?.setValue('CALL');
      this.tradeForm.get('strikePrice')?.reset();
      this.tradeForm.get('expiry')?.setValue('26-Jun-2026');
    }
  }

  setTradeType(type: 'BUY' | 'SELL'): void {
    this.tradeType.set(type);
  }

  getAssetPrice(assetType: string, stockPrice: number, optionType?: string | null, strikePrice?: number | null): number {
    if (assetType === 'STOCK') return stockPrice;
    if (assetType === 'FUTURE') return stockPrice + 1.50;
    if (assetType === 'OPTION') {
      const strike = strikePrice || 0;
      if (optionType === 'CALL') {
        return Math.max(0.05, stockPrice - strike) + 2.00;
      } else if (optionType === 'PUT') {
        return Math.max(0.05, strike - stockPrice) + 2.00;
      }
    }
    return stockPrice;
  }

  estimatedCost(): number {
    const shares = this.tradeForm.get('shares')?.value || 0;
    const isLimit = this.tradeForm.get('orderType')?.value === 'LIMIT';
    if (isLimit) {
      return shares * (this.tradeForm.get('limitPrice')?.value || 0);
    }

    const assetType = this.tradeForm.get('assetType')?.value || 'STOCK';
    const stockPrice = this.stock?.price || 0;
    const optionType = this.tradeForm.get('optionType')?.value;
    const strikePrice = this.tradeForm.get('strikePrice')?.value;

    const unitPrice = this.getAssetPrice(assetType, stockPrice, optionType, strikePrice);
    return shares * unitPrice;
  }

  isOverdrawn(): boolean {
    if (this.tradeType() === 'SELL') return false;
    const user = this.authService.currentUser();
    const balance = user ? user.balance : 0;
    return this.estimatedCost() > balance;
  }

  closeDialog(success: boolean = false): void {
    if (this.dialogRef) {
      this.dialogRef.close(success);
    }
  }

  submitOrder(): void {
    if (this.tradeForm.invalid) return;
    if (!this.stock) return;

    this.loadingTrade.set(true);
    const formValue = this.tradeForm.value;

    const payload = {
      symbol: this.stock.symbol,
      type: this.tradeType(),
      orderType: formValue.orderType,
      shares: formValue.shares,
      limitPrice: formValue.orderType === 'LIMIT' ? formValue.limitPrice : undefined,
      assetType: formValue.assetType,
      optionType: formValue.assetType === 'OPTION' ? formValue.optionType : undefined,
      strikePrice: formValue.assetType === 'OPTION' ? formValue.strikePrice : undefined,
      expiry: ['OPTION', 'FUTURE'].includes(formValue.assetType) ? formValue.expiry : undefined
    };

    this.tradeService.placeOrder(payload).subscribe({
      next: (res: any) => {
        this.loadingTrade.set(false);
        this.snackBar.open(res.message || 'Order submitted successfully!', 'Dismiss', {
          duration: 4000,
          horizontalPosition: 'right',
          verticalPosition: 'top'
        });

        // Update the current user balance from response
        const currentUser = this.authService.currentUser();
        if (currentUser && res.balance !== undefined) {
          this.authService.currentUser.set({
            ...currentUser,
            balance: res.balance
          });
        } else if (currentUser && res.data && res.data.balance !== undefined) {
          this.authService.currentUser.set({
            ...currentUser,
            balance: res.data.balance
          });
        }

        this.resetForm();

        // Close and return true to indicate success
        if (this.isDialogMode) {
          this.closeDialog(true);
        }
      },
      error: (err) => {
        this.loadingTrade.set(false);
        this.snackBar.open(err.error?.message || 'Error placing order.', 'Dismiss', {
          duration: 4000,
          horizontalPosition: 'right',
          verticalPosition: 'top'
        });
      }
    });
  }
}
