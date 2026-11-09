import { Component, inject, computed, signal } from '@angular/core';
import { ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { IaUIModule } from '@il-arrive/ui';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, IaUIModule],
  template: `
    <div class="auth-page">
      <div class="auth-page__card">
        <div class="auth-page__header">
          <h1 class="auth-page__title">Mot de passe oublié ?</h1>
          <p class="auth-page__subtitle">Nous vous enverrons un lien de réinitialisation.</p>
        </div>
        @if (submitted()) {
          <div class="auth-page__success" role="status">
            <p>Un lien de réinitialisation a été envoyé à <strong>{{ form.get('email')?.value }}</strong></p>
            <p>Vérifiez vos emails (et vos spams).</p>
          </div>
        } @else {
          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="auth-page__form">
            <ia-input label="Email" type="email" placeholder="votre@email.com" [required]="true" [errorText]="emailError()" formControlName="email" />
            @if (generalError()) {
              <div class="auth-page__error" role="alert">{{ generalError() }}</div>
            }
            <ia-button type="submit" variant="primary" size="action" label="Envoyer le lien" [loading]="loading()" [disabled]="loading()" />
          </form>
        }
        <a routerLink="/login" class="auth-page__link" tabindex="-1">Retour à la connexion</a>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--color-bg); padding: var(--space-4); }
    .auth-page__card { width: 420px; max-width: 100%; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--space-8); box-shadow: var(--shadow-sm); }
    .auth-page__header { text-align: center; margin-bottom: var(--space-6); }
    .auth-page__title { font-size: var(--text-2xl); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); margin-bottom: var(--space-2); }
    .auth-page__subtitle { font-size: var(--text-sm); color: var(--color-text-secondary); }
    .auth-page__form { display: flex; flex-direction: column; gap: var(--space-4); }
    .auth-page__error { font-size: var(--text-sm); color: var(--color-danger-text); text-align: center; }
    .auth-page__success { text-align: center; color: var(--color-success-fg); font-size: var(--text-sm); padding: var(--space-4) 0; }
    .auth-page__link { display: block; text-align: center; margin-top: var(--space-4); font-size: var(--text-sm); color: var(--color-text-secondary); text-decoration: none; }
    .auth-page__link:hover { color: var(--color-text-primary); text-decoration: underline; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordComponent {
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  form = this.fb.group({ email: ['', [Validators.required, Validators.email]] });
  loading = signal(false);
  submitted = signal(false);
  generalError = signal('');

  emailError = computed(() => {
    const ctrl = this.form.get('email');
    if (ctrl?.touched && ctrl?.errors) {
      if (ctrl.errors['email']) return 'Format d\'email invalide';
      return 'Un email est requis';
    }
    return '';
  });

  onSubmit(): void {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.generalError.set('');
    this.authService.requestPasswordReset({ email: this.form.get('email')!.value || '' }).subscribe({
      next: () => { this.loading.set(false); this.submitted.set(true); },
      error: (err) => { this.loading.set(false); this.generalError.set(err.error?.message || 'Erreur lors de l\'envoi'); },
    });
  }
}
