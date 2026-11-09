import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { IaAvatarComponent } from './avatar.component';

@Component({
  standalone: true,
  imports: [IaAvatarComponent],
  template: `
    <ia-avatar [name]="name" [avatarUrl]="avatarUrl" [size]="size" [showRing]="showRing" />
  `,
})
class TestHostComponent {
  name = 'Marc Lefèvre';
  avatarUrl: string | null = null;
  size: 24 | 32 | 48 | 56 = 32;
  showRing = false;
}

describe('IaAvatarComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
  });

  it('creates', () => {
    expect(IaAvatarComponent).toBeTruthy();
  });

  it('renders fallback with initials when no photo', () => {
    fixture.detectChanges();
    const fallback = fixture.debugElement.query(By.css('.ia-avatar--fallback'));
    expect(fallback).toBeTruthy();
    expect(fallback.nativeElement.textContent).toContain('M');
  });

  it('renders image when avatarUrl is provided', () => {
    host.avatarUrl = 'https://example.com/avatar.jpg';
    fixture.detectChanges();
    const img = fixture.debugElement.query(By.css('img'));
    expect(img).toBeTruthy();
    expect(img.nativeElement.src).toContain('avatar.jpg');
  });

  it('renders correct size class', () => {
    host.size = 48;
    fixture.detectChanges();
    const avatar = fixture.debugElement.query(By.css('.ia-avatar'));
    expect(avatar.nativeElement.className).toContain('ia-avatar--48');
  });

  it('shows ring when showRing is true', () => {
    host.showRing = true;
    host.avatarUrl = 'https://example.com/photo.jpg';
    fixture.detectChanges();
    const img = fixture.debugElement.query(By.css('img'));
    expect(img.nativeElement.className).toContain('ia-avatar--ring');
  });

  it('fallback has role=img and aria-label', () => {
    fixture.detectChanges();
    const fallback = fixture.debugElement.query(By.css('.ia-avatar--fallback'));
    expect(fallback.nativeElement.getAttribute('role')).toBe('img');
    expect(fallback.nativeElement.getAttribute('aria-label')).toBe('');
  });

  it('image has alt text with name', () => {
    host.avatarUrl = 'https://example.com/photo.jpg';
    fixture.detectChanges();
    const img = fixture.debugElement.query(By.css('img'));
    expect(img.nativeElement.getAttribute('alt')).toBe('Photo de Marc Lefèvre');
  });

  it('first character of name as initial', () => {
    host.name = 'Sophie Martin';
    fixture.detectChanges();
    const fallback = fixture.debugElement.query(By.css('.ia-avatar--fallback'));
    expect(fallback.nativeElement.textContent).toContain('S');
  });
});
