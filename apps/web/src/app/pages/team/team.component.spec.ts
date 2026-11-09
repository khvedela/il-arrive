import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { DashboardApi } from '../../dashboard/dashboard-api.service';
import { TeamComponent } from './team.component';

describe('TeamComponent', () => {
  const api = { members: jest.fn(), invite: jest.fn(), setRole: jest.fn(), removeMember: jest.fn() };
  const members = [
    { membershipId: 'm1', userId: 'u1', email: 'o@x.fr', firstName: 'Olga', lastName: 'Owner', role: 'OWNER', isTechnician: false },
    { membershipId: 'm2', userId: 'u2', email: 't@x.fr', firstName: 'Tom', lastName: 'Tech', role: 'TECHNICIAN', isTechnician: true },
  ];
  const flush = () => new Promise((r) => setTimeout(r, 0));

  async function setup(role = 'OWNER') {
    jest.resetAllMocks();
    api.members.mockReturnValue(of(members));
    TestBed.configureTestingModule({
      providers: [
        { provide: DashboardApi, useValue: api },
        { provide: AuthService, useValue: { activeMembership: () => ({ role }), user: () => ({ id: 'u1' }) } },
      ],
    });
    const fixture = TestBed.createComponent(TeamComponent);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    return { fixture, cmp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  it('lists members; owners get the invite form', async () => {
    const { el } = await setup();
    expect(el.textContent).toContain('Tom Tech');
    expect(el.querySelector('form')).not.toBeNull();
  });

  it('non-owners cannot invite or remove', async () => {
    const { el } = await setup('DISPATCHER');
    expect(el.querySelector('form')).toBeNull();
    expect(el.textContent).not.toContain('Retirer');
  });

  it('validates the invite email, then invites and reloads', async () => {
    const { cmp } = await setup();
    cmp.email.set('nope');
    await cmp.invite();
    expect(api.invite).not.toHaveBeenCalled();
    cmp.email.set('new@x.fr');
    api.invite.mockReturnValue(of({}));
    await cmp.invite();
    expect(api.invite).toHaveBeenCalledWith('new@x.fr', 'TECHNICIAN');
    expect(api.members).toHaveBeenCalledTimes(2);
  });

  it('changes a role and removes a member by userId', async () => {
    const { cmp } = await setup();
    api.setRole.mockReturnValue(of({}));
    await cmp.changeRole(cmp.members()[1], 'DISPATCHER');
    expect(api.setRole).toHaveBeenCalledWith('u2', 'DISPATCHER');
    api.removeMember.mockReturnValue(of(undefined));
    cmp.pendingRemoval.set(cmp.members()[1]);
    await cmp.confirmRemove();
    expect(api.removeMember).toHaveBeenCalledWith('u2');
    expect(cmp.pendingRemoval()).toBeNull();
  });
});
