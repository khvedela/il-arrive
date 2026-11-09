import { Component, inject, computed, signal } from '@angular/core';
import { ChangeDetectionStrategy } from '@angular/core';
import { FormGroup, FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { IaUIModule } from '@il-arrive/ui';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, IaUIModule],
  template: `
    <div class="auth-page">
      <div class="auth-page__card">
        <div class="auth-page__header">
          <h1 class="auth-page__title">Créer un compte</h1>
        </div>
        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="auth-page__form" aria-label="Formulaire d'inscription">
          <ia-input label="Nom de l'entreprise" placeholder="Ex. : Plomberie Martin" [required]="true" [errorText]="businessError()" formControlName="businessName" />
          <ia-input label="Prénom" placeholder="Ex. : Jean" [required]="true" [errorText]="firstNameError()" formControlName="firstName" />
          <ia-input label="Nom de famille" placeholder="Ex. : Dupont" [required]="true" [errorText]="lastNameError()" formControlName="lastName" />
          <ia-input label="Email" type="email" placeholder="votre@email.com" [required]="true" [errorText]="emailError()" formControlName="email" />
          <ia-input label="Téléphone" type="tel" placeholder="06 12 34 56 78" [required]="true" [errorText]="phoneError()" formControlName="phone" />
          <ia-input label="Mot de passe" type="password" placeholder="••••••••" [required]="true" [errorText]="passwordError()" formControlName="password" />
          @if (generalError()) {
            <div class="auth-page__error" role="alert">{{ generalError() }}</div>
          }
          <ia-button type="submit" variant="primary" size="action" label="Créer mon compte" [loading]="loading()" [disabled]="loading()" />
        </form>
        <div class="auth-page__divider">ou</div>
        <ia-button variant="ghost" size="action" label="Se connecter" (clicked)="goLogin()" />
        <div class="auth-page__footer">
          <a href="/privacy" class="auth-page__footer-link" tabindex="-1">Confidentialité</a>
        </div>
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
    .auth-page__divider { text-align: center; color: var(--color-text-muted); font-size: var(--text-sm); margin: var(--space-4) 0; }
    .auth-page__footer { margin-top: var(--space-8); text-align: center; border-top: 1px solid var(--color-border); padding-top: var(--space-4); }
    .auth-page__footer-link { font-size: var(--text-xs); color: var(--color-text-muted); text-decoration: none; }
    .auth-page__footer-link:hover { color: var(--color-text-primary); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent {
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  form = this.fb.group({
    businessName: ['', [Validators.required]],
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  loading = signal(false);
  generalError = signal('');

  businessError = computed(() => this.fieldErr('businessName', 'Nom de l\'entreprise requis'));
  firstNameError = computed(() => this.fieldErr('firstName', 'Prénom requis'));
  lastNameError = computed(() => this.fieldErr('lastName', 'Nom de famille requis'));
  emailError = computed(() => {
    const ctrl = this.form.get('email');
    if (ctrl?.touched && ctrl?.errors) {
      if (ctrl.errors['email']) return 'Format d\'email invalide';
      return 'Un email est requis';
    }
    return '';
  });
  phoneError = computed(() => this.fieldErr('phone', 'Téléphone requis'));
  passwordError = computed(() => {
    const ctrl = this.form.get('password');
    if (ctrl?.touched && ctrl?.errors) {
      if (ctrl.errors['minlength']) return '8 caractères minimum';
      return 'Mot de passe requis';
    }
    return '';
  });

  private fieldErr(name: string, msg: string): string {
    const ctrl = this.form.get(name);
    return ctrl?.touched && ctrl?.errors ? msg : '';
  }

  onSubmit(): void {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.generalError.set('');
    const v = this.form.value;
    this.authService.register({
      email: v.email!, password: v.password!, firstName: v.firstName!, lastName: v.lastName!, businessName: v.businessName!, phone: v.phone!,
    }).subscribe({
      error: (err) => {
        this.loading.set(false);
        this.generalError.set(err.error?.message || 'Erreur lors de l\'inscription');
      },
    });
  }

  goLogin(): void {
    window.location.href = '/login';
  }
}
