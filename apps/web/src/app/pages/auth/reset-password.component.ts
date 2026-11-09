import { Component, inject, computed, signal } from '@angular/core';
import { ChangeDetectionStrategy } from '@angular/core';
import { FormGroup, FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { IaUIModule } from '@il-arrive/ui';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, IaUIModule],
  template: `
    <div class="auth-page">
      <div class="auth-page__card">
        <div class="auth-page__header">
          <h1 class="auth-page__title">Nouveau mot de passe</h1>
        </div>
        @if (success()) {
          <div class="auth-page__success" role="status">
            <p>Mot de passe modifié avec succès.</p>
            <p>Redirection vers la connexion...</p>
          </div>
        } @else {
          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="auth-page__form">
            <ia-input label="Nouveau mot de passe" type="password" placeholder="••••••••" [required]="true" [errorText]="passwordError()" formControlName="password" />
            <ia-input label="Confirmer" type="password" placeholder="••••••••" [required]="true" [errorText]="confirmError()" formControlName="confirm" />
            @if (generalError()) {
              <div class="auth-page__error" role="alert">{{ generalError() }}</div>
            }
            <ia-button type="submit" variant="primary" size="action" label="Modifier le mot de passe" [loading]="loading()" [disabled]="loading()" />
          </form>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--color-bg); padding: var(--space-4); }
    .auth-page__card { width: 420px; max-width: 100%; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--space-8); box-shadow: var(--shadow-sm); }
    .auth-page__header { text-align: center; margin-bottom: var(--space-6); }
    .auth-page__title { font-size: var(--text-2xl); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
    .auth-page__form { display: flex; flex-direction: column; gap: var(--space-4); }
    .auth-page__error { font-size: var(--text-sm); color: var(--color-danger-text); text-align: center; }
    .auth-page__success { text-align: center; color: var(--color-success-fg); font-size: var(--text-sm); padding: var(--space-4) 0; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordComponent {
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  token = this.route.snapshot.paramMap.get('token') ?? '';

  form = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', [Validators.required]],
  });

  loading = signal(false);
  success = signal(false);
  generalError = signal('');

  passwordError = computed(() => {
    const ctrl = this.form.get('password');
    if (ctrl?.touched && ctrl?.errors) {
      if (ctrl.errors['minlength']) return '8 caractères minimum';
      return 'Mot de passe requis';
    }
    return '';
  });

  confirmError = computed(() => {
    const ctrl = this.form.get('confirm');
    if (ctrl?.touched && ctrl?.errors) {
      if (ctrl.errors['mismatch']) return 'Les mots de passe ne correspondent pas';
      return 'Confirmation requise';
    }
    return '';
  });

  onSubmit(): void {
    if (this.form.invalid || this.loading()) return;
    const v = this.form.value;
    if (v.password !== v.confirm) {
      this.form.get('confirm')?.setErrors({ mismatch: true });
      return;
    }
    this.loading.set(true);
    this.generalError.set('');
    this.authService.resetPassword({ token: this.token, password: v.password! }).subscribe({
      next: () => { this.loading.set(false); this.success.set(true); setTimeout(() => this.router.navigate(['/login']), 2000); },
      error: (err) => { this.loading.set(false); this.generalError.set(err.error?.message || 'Impossible de réinitialiser le mot de passe'); },
    });
  }
}
