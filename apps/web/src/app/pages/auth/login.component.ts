import { Component, inject, computed, signal } from '@angular/core';
import { ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { IaUIModule } from '@il-arrive/ui';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, IaUIModule],
  template: `
    <div class="auth-page">
      <div class="auth-page__card">
        <div class="auth-page__header">
          <h1 class="auth-page__title">Se connecter</h1>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="auth-page__form" aria-label="Formulaire de connexion">
          <ia-input
            label="Email"
            type="email"
            placeholder="votre@email.com"
            [required]="true"
            [errorText]="emailError()"
            formControlName="email"
          />

          <ia-input
            label="Mot de passe"
            type="password"
            placeholder="••••••••"
            [required]="true"
            [errorText]="passwordError()"
            formControlName="password"
          />

          @if (generalError()) {
            <div class="auth-page__error" role="alert">{{ generalError() }}</div>
          }

          <ia-button
            type="submit"
            variant="primary"
            size="action"
            label="Se connecter"
            [loading]="loading()"
            [disabled]="loading()"
          />
        </form>

        <div class="auth-page__divider">ou</div>

        <ia-button
          variant="ghost"
          size="action"
          label="Créer un compte"
          (clicked)="goRegister()"
        />

        <a routerLink="/forgot-password" class="auth-page__link" tabindex="-1">Mot de passe oublié ?</a>

        <div class="auth-page__footer">
          <a href="/privacy" class="auth-page__footer-link" tabindex="-1">Confidentialité</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-bg);
      padding: var(--space-4);
    }
    .auth-page__card {
      width: 420px;
      max-width: 100%;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: var(--space-8);
      box-shadow: var(--shadow-sm);
    }
    .auth-page__header { text-align: center; margin-bottom: var(--space-6); }
    .auth-page__title { font-size: var(--text-2xl); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
    .auth-page__form { display: flex; flex-direction: column; gap: var(--space-4); }
    .auth-page__error { font-size: var(--text-sm); color: var(--color-danger-text); text-align: center; }
    .auth-page__divider { text-align: center; color: var(--color-text-muted); font-size: var(--text-sm); margin: var(--space-4) 0; }
    .auth-page__link { display: block; text-align: center; margin-top: var(--space-4); font-size: var(--text-sm); color: var(--color-text-secondary); text-decoration: none; }
    .auth-page__link:hover { color: var(--color-text-primary); text-decoration: underline; }
    .auth-page__footer { margin-top: var(--space-8); text-align: center; border-top: 1px solid var(--color-border); padding-top: var(--space-4); }
    .auth-page__footer-link { font-size: var(--text-xs); color: var(--color-text-muted); text-decoration: none; }
    .auth-page__footer-link:hover { color: var(--color-text-primary); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  loading = signal(false);
  generalError = signal('');

  emailError = computed(() => {
    const ctrl = this.form.get('email');
    if (ctrl?.touched && ctrl?.errors) {
      if (ctrl.errors['email']) return 'Format d\'email invalide';
      return 'Un email est requis';
    }
    return '';
  });

  passwordError = computed(() => {
    const ctrl = this.form.get('password');
    if (ctrl?.touched && ctrl?.errors) {
      return 'Un mot de passe est requis';
    }
    return '';
  });

  onSubmit(): void {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.generalError.set('');

    const values = this.form.value;
    this.authService.login({
      email: values.email!,
      password: values.password!,
    }).subscribe({
      error: (err) => {
        this.loading.set(false);
        this.generalError.set(err.error?.message || 'Identifiants incorrects');
      },
    });
  }

  goRegister(): void {
    window.location.href = '/register';
  }
}
