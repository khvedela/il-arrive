import { Component, inject, computed, signal } from '@angular/core';
import { ChangeDetectionStrategy } from '@angular/core';
import { FormGroup, FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { IaUIModule } from '@il-arrive/ui';

@Component({
  selector: 'app-accept-invitation',
  standalone: true,
  imports: [ReactiveFormsModule, IaUIModule],
  template: `
    <div class="auth-page">
      <div class="auth-page__card">
        <div class="auth-page__header">
          <h1 class="auth-page__title">Accepter l'invitation</h1>
          <p class="auth-page__subtitle">Créez votre compte pour rejoindre l'équipe.</p>
        </div>
        @if (success()) {
          <div class="auth-page__success" role="status">
            <p>Invitation acceptée !</p>
            <p>Redirection vers le tableau de bord...</p>
          </div>
        } @else {
          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="auth-page__form">
            <ia-input label="Prénom" placeholder="Ex. : Jean" [required]="true" [errorText]="firstNameError()" formControlName="firstName" />
            <ia-input label="Nom de famille" placeholder="Ex. : Dupont" [required]="true" [errorText]="lastNameError()" formControlName="lastName" />
            <ia-input label="Téléphone (optionnel)" type="tel" placeholder="06 12 34 56 78" formControlName="phone" />
            <ia-input label="Mot de passe" type="password" placeholder="••••••••" [required]="true" [errorText]="passwordError()" formControlName="password" />
            @if (generalError()) {
              <div class="auth-page__error" role="alert">{{ generalError() }}</div>
            }
            <ia-button type="submit" variant="primary" size="action" label="Accepter l'invitation" [loading]="loading()" [disabled]="loading()" />
          </form>
        }
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
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AcceptInvitationComponent {
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  token = this.route.snapshot.paramMap.get('token') ?? '';

  form = this.fb.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    phone: [''],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  loading = signal(false);
  success = signal(false);
  generalError = signal('');

  firstNameError = computed(() => this.fieldErr('firstName', 'Prénom requis'));
  lastNameError = computed(() => this.fieldErr('lastName', 'Nom requis'));
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
    this.authService.acceptInvitation({
      token: this.token, firstName: v.firstName!, lastName: v.lastName!, password: v.password!, phone: v.phone || undefined,
    }).subscribe({
      next: () => { this.loading.set(false); this.success.set(true); setTimeout(() => this.router.navigate(['/app']), 2000); },
      error: (err) => { this.loading.set(false); this.generalError.set(err.error?.message || 'Impossible d\'accepter l\'invitation'); },
    });
  }
}
