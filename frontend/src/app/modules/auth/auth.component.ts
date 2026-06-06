import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule
  ],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.css'
})
export class AuthComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  isLoginMode = signal<boolean>(true);
  hidePassword = signal<boolean>(true);
  loading = signal<boolean>(false);

  authForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  toggleMode(): void {
    this.isLoginMode.set(!this.isLoginMode());
    if (this.isLoginMode()) {
      this.authForm.removeControl('username');
    } else {
      this.authForm.addControl('username', this.fb.control('', Validators.required));
    }
    this.authForm.reset();
  }

  onSubmit(): void {
    if (this.authForm.invalid) return;

    this.loading.set(true);
    const formValue = this.authForm.value;

    const authObs = this.isLoginMode()
      ? this.authService.login(formValue)
      : this.authService.register(formValue);

    authObs.subscribe({
      next: (res) => {
        this.loading.set(false);
        this.snackBar.open(
          this.isLoginMode() ? 'Logged in successfully! Welcome.' : 'Account registered successfully! Welcome.',
          'Dismiss',
          { duration: 3000, horizontalPosition: 'right', verticalPosition: 'top' }
        );
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.snackBar.open(
          err.error?.message || 'Authentication failed. Please try again.',
          'Dismiss',
          { duration: 4000, horizontalPosition: 'right', verticalPosition: 'top' }
        );
      }
    });
  }
}
