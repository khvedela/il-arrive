import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { LoginComponent } from './login.component';

describe('LoginComponent (real forms)', () => {
  const login = jest.fn();

  function setup() {
    login.mockReset().mockReturnValue(of({}));
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: { login } }],
    });
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders labels, inputs and a submit button', () => {
    const el: HTMLElement = setup().nativeElement;
    const labels = Array.from(el.querySelectorAll('label')).map((l) => l.textContent?.trim());
    expect(labels).toEqual(['Email', 'Mot de passe']);
    expect(el.querySelectorAll('input')).toHaveLength(2);
    const submit = el.querySelector('button[type="submit"]');
    expect(submit).toBeTruthy();
    expect(submit?.textContent).toContain('Se connecter');
  });

  it('does not submit an empty form', () => {
    const fixture = setup();
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    expect(login).not.toHaveBeenCalled();
  });

  it('submits typed credentials', () => {
    const fixture = setup();
    const el: HTMLElement = fixture.nativeElement;
    const [email, password] = Array.from(el.querySelectorAll('input'));
    email.value = 'owner@plomberie-martin.dev';
    email.dispatchEvent(new Event('input'));
    password.value = 'password123';
    password.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (el.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    expect(login).toHaveBeenCalledWith({ email: 'owner@plomberie-martin.dev', password: 'password123' });
  });
});
