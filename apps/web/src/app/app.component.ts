import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IaToastContainerComponent } from '@il-arrive/ui';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, IaToastContainerComponent],
  template: `
    <router-outlet />
    <ia-toast-container />
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
    }
  `],
})
export class AppComponent implements OnInit {
  private authService = inject(AuthService);

  ngOnInit(): void {
    // The technician PWA (/tech) runs on its own mock API and must not trigger the dashboard auth bootstrap.
    if (typeof location !== 'undefined' && location.pathname.startsWith('/tech')) {
      return;
    }
    this.authService.bootstrap().subscribe({ error: () => undefined });
  }
}
