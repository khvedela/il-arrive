import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { IaUIModule, IaToastService } from '@il-arrive/ui';
import type { Role } from '@il-arrive/contracts';
import { Role as RoleEnum } from '@il-arrive/contracts/enums';
import { AuthService } from '../../core/auth.service';
import { DashboardApi, type MemberDto } from '../../dashboard/dashboard-api.service';

export function roleLabel(r: Role): string {
  switch (r) {
    case 'OWNER': return $localize`:@@role.owner:Propriétaire`;
    case 'DISPATCHER': return $localize`:@@role.dispatcher:Dispatcheur`;
    case 'TECHNICIAN': return $localize`:@@role.technician:Technicien`;
  }
}

@Component({
  selector: 'app-team',
  standalone: true,
  imports: [FormsModule, IaUIModule],
  template: `
    <h1 class="title">{{ t.title }}</h1>

    @if (isOwner()) {
      <form class="invite" (ngSubmit)="invite()" [attr.aria-label]="t.invite">
        <ia-input [label]="t.email" type="email" [required]="true" [errorText]="emailError()" [value]="email()" (valueChange)="email.set($event)" />
        <ia-select [label]="t.role" [options]="roleOptions" [value]="role()" (valueChange)="role.set($event)" />
        <ia-button type="submit" variant="primary" size="md" [label]="t.invite" [loading]="busy()" [disabled]="busy()" />
      </form>
    }
    @if (error()) { <div class="error" role="alert">{{ error() }}</div> }

    @switch (state()) {
      @case ('error') { <ia-error-state [title]="t.loadError" (retryClicked)="load()" /> }
      @case ('ready') {
        <ul class="members" [attr.aria-label]="t.title">
          @for (m of members(); track m.userId) {
            <li class="member">
              <ia-avatar [name]="m.firstName + ' ' + m.lastName" />
              <div class="member__info">
                <strong>{{ m.firstName }} {{ m.lastName }}</strong>
                <span class="member__email">{{ m.email }}</span>
              </div>
              @if (isOwner() && m.userId !== myUserId()) {
                <ia-select [label]="t.role" [options]="roleOptions" [value]="m.role" (valueChange)="changeRole(m, $event)" />
                <ia-button variant="danger-ghost" size="sm" [label]="t.remove" (clicked)="pendingRemoval.set(m)" />
              } @else {
                <span class="member__role">{{ roleName(m.role) }}</span>
              }
            </li>
          }
        </ul>
      }
      @default { <ia-loading-state /> }
    }

    <ia-modal [isOpen]="!!pendingRemoval()" [title]="t.removeTitle" [label]="t.removeTitle" [showFooter]="true" (closed)="pendingRemoval.set(null)" (confirmed)="confirmRemove()">
      <p>{{ pendingRemoval()?.firstName }} {{ pendingRemoval()?.lastName }}</p>
      <div ia-modal-footer>
        <ia-button variant="ghost" size="md" [label]="t.cancel" (clicked)="pendingRemoval.set(null)" />
        <ia-button variant="danger" size="md" [label]="t.remove" (clicked)="confirmRemove()" [disabled]="busy()" />
      </div>
    </ia-modal>
  `,
  styles: [`
    :host { display: block; padding: var(--space-8); max-width: 800px; }
    .title { font-size: var(--text-2xl); font-weight: var(--font-weight-semibold); margin-bottom: var(--space-6); }
    .invite { display: flex; gap: var(--space-3); align-items: flex-end; flex-wrap: wrap; margin-bottom: var(--space-6); }
    .error { color: var(--color-danger-text); font-size: var(--text-sm); margin-bottom: var(--space-4); }
    .members { list-style: none; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
    .member { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); }
    .member__info { display: flex; flex-direction: column; flex: 1; }
    .member__email, .member__role { color: var(--color-text-muted); font-size: var(--text-sm); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamComponent implements OnInit {
  private api = inject(DashboardApi);
  private auth = inject(AuthService);
  private toast = inject(IaToastService);

  members = signal<MemberDto[]>([]);
  state = signal<'loading' | 'ready' | 'error'>('loading');
  email = signal('');
  role = signal<string>('TECHNICIAN');
  submitted = signal(false);
  busy = signal(false);
  error = signal('');
  pendingRemoval = signal<MemberDto | null>(null);

  isOwner = computed(() => this.auth.activeMembership()?.role === 'OWNER');
  myUserId = computed(() => this.auth.user()?.id);
  emailError = computed(() => (this.submitted() && !/^\S+@\S+\.\S+$/.test(this.email()) ? this.t.emailInvalid : null));

  protected t = {
    title: $localize`:@@team.title:Équipe`,
    invite: $localize`:@@team.invite:Inviter`,
    email: $localize`:@@team.email:Email`,
    role: $localize`:@@team.role:Rôle`,
    remove: $localize`:@@team.remove:Retirer`,
    cancel: $localize`:@@team.cancel:Annuler`,
    removeTitle: $localize`:@@team.removeTitle:Retirer ce membre ?`,
    loadError: $localize`:@@team.loadError:Impossible de charger l'équipe`,
    emailInvalid: $localize`:@@team.emailInvalid:Email invalide`,
    failed: $localize`:@@team.failed:L'action a échoué. Réessayez.`,
    invited: $localize`:@@team.invited:Invitation envoyée`,
  };
  protected roleOptions = (Object.values(RoleEnum) as Role[]).map((r) => ({ value: r, label: roleLabel(r) }));
  protected roleName = roleLabel;

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.state.set('loading');
    try {
      this.members.set(await firstValueFrom(this.api.members()));
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }

  async invite(): Promise<void> {
    this.submitted.set(true);
    if (this.emailError() || !this.email() || this.busy()) return;
    await this.run(async () => {
      await firstValueFrom(this.api.invite(this.email().trim(), this.role() as Role));
      this.toast.show(this.t.invited, 'success');
      this.email.set('');
      this.submitted.set(false);
    });
  }

  async changeRole(m: MemberDto, role: string): Promise<void> {
    if (role === m.role) return;
    await this.run(async () => {
      await firstValueFrom(this.api.setRole(m.userId, role as Role));
    });
  }

  async confirmRemove(): Promise<void> {
    const m = this.pendingRemoval();
    if (!m) return;
    await this.run(async () => {
      await firstValueFrom(this.api.removeMember(m.userId));
      this.pendingRemoval.set(null);
    });
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await fn();
      await this.load();
    } catch (e) {
      this.error.set((e as { error?: { message?: string } })?.error?.message ?? this.t.failed);
    } finally {
      this.busy.set(false);
    }
  }
}
